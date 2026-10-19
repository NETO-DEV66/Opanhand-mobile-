// End-to-end check of AgentDeck's direct-connect chat path against a local
// mock provider. Exercises the real streamChat/parse code in
// src/agentdeck/llm.ts over real HTTP, plus the storage helpers.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import assert from "node:assert/strict";

import {
  DEFAULT_SYSTEM_PROMPT,
  LlmError,
  streamChat,
  type StreamOptions,
} from "./src/agentdeck/llm";
import { getProvider } from "./src/agentdeck/providers";

const PORT = 8791;

interface RecordedBody {
  model?: string;
  stream?: boolean;
  system?: string;
  max_tokens?: number;
  systemInstruction?: { parts?: { text?: string }[] };
  messages?: { role?: string; content?: string }[];
}

let lastRequest: {
  url: string;
  headers: Record<string, string>;
  body: RecordedBody | null;
} = {
  url: "",
  headers: {},
  body: null,
};

function sse(res: ServerResponse, chunks: string[]) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const c of chunks) res.write(c);
  res.end();
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (d: Buffer) => (raw += d.toString()));
    req.on("end", () => resolve(raw));
  });
}

function openAiChunk(text: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}
function anthropicChunk(text: string) {
  return `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`;
}
function geminiChunk(text: string) {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
}

const server = createServer(async (req, res) => {
  const body = await readBody(req);
  lastRequest = {
    url: req.url ?? "",
    headers: req.headers as Record<string, string>,
    body: body ? JSON.parse(body) : null,
  };
  const url = req.url ?? "";
  if (url.includes("/messages"))
    return sse(res, [anthropicChunk("Hello "), anthropicChunk("Anthropic")]);
  if (url.includes("streamGenerateContent"))
    return sse(res, [geminiChunk("Hello "), geminiChunk("Gemini")]);
  if (url.includes("/chat/completions"))
    return sse(res, [openAiChunk("Hello "), openAiChunk("OpenAI")]);
  res.writeHead(404).end();
});

function options(
  providerId: string,
  overrides: Partial<StreamOptions> = {},
): StreamOptions {
  const provider = getProvider(providerId);
  assert.ok(provider, `provider ${providerId} missing`);
  const baseUrl = `http://127.0.0.1:${PORT}`;
  return {
    provider: { ...provider, baseUrl },
    apiKey: "test-key",
    baseUrl,
    model: provider.defaultModel || "test-model",
    messages: [{ role: "user", content: "hi" }],
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    onDelta: () => {},
    ...overrides,
  };
}

function lastBody(): RecordedBody {
  assert.ok(lastRequest.body, "no request body was recorded");
  return lastRequest.body;
}

async function collect(opts: StreamOptions): Promise<string> {
  let text = "";
  await streamChat({ ...opts, onDelta: (c) => (text += c) });
  return text;
}

const tests: [string, () => Promise<void>][] = [];

function test(name: string, fn: () => Promise<void>) {
  tests.push([name, fn]);
}

test("openai-style provider streams deltas over real HTTP", async () => {
  const text = await collect(options("openai"));
  assert.equal(text, "Hello OpenAI");
  assert.equal(lastRequest.url, "/chat/completions");
  assert.equal(lastRequest.headers["authorization"], "Bearer test-key");
  assert.equal(lastBody().model, getProvider("openai")!.defaultModel);
  assert.equal(lastBody().stream, true);
  assert.deepEqual(lastBody().messages?.[0], {
    role: "system",
    content: DEFAULT_SYSTEM_PROMPT,
  });
  assert.equal(lastBody().messages?.[1].content, "hi");
});

test("anthropic provider uses x-api-key and version header", async () => {
  const text = await collect(options("anthropic"));
  assert.equal(text, "Hello Anthropic");
  assert.equal(lastRequest.url, "/messages");
  assert.equal(lastRequest.headers["x-api-key"], "test-key");
  assert.equal(lastRequest.headers["anthropic-version"], "2023-06-01");
  assert.equal(lastBody().system, DEFAULT_SYSTEM_PROMPT);
  assert.equal(lastBody().max_tokens, 4096);
});

test("gemini provider hits streamGenerateContent with key header", async () => {
  const text = await collect(options("google"));
  assert.equal(text, "Hello Gemini");
  assert.match(
    lastRequest.url,
    new RegExp(
      "/models/" +
        getProvider("google")!.defaultModel +
        ":streamGenerateContent\\?alt=sse$",
    ),
  );
  assert.equal(lastRequest.headers["x-goog-api-key"], "test-key");
  assert.equal(
    lastBody().systemInstruction?.parts?.[0]?.text,
    DEFAULT_SYSTEM_PROMPT,
  );
});

test("custom OpenAI-compatible endpoint works with a user model", async () => {
  const text = await collect(
    options("custom", { model: "my-local-model", apiKey: "" }),
  );
  assert.equal(text, "Hello OpenAI");
  assert.equal(lastBody().model, "my-local-model");
  assert.equal(lastRequest.headers["authorization"], "Bearer local");
});

test("401 surfaces a friendly key error", async () => {
  const failing = createServer((_req, res) => {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "bad key" } }));
  });
  await new Promise<void>((r) => failing.listen(PORT + 1, r));
  try {
    const opts = options("openai", { baseUrl: `http://127.0.0.1:${PORT + 1}` });
    opts.provider = { ...opts.provider, baseUrl: opts.baseUrl };
    await assert.rejects(collect(opts), (err: unknown) => {
      assert.ok(err instanceof LlmError);
      assert.equal(err.status, 401);
      assert.match(err.message, /rejected the API key/);
      return true;
    });
  } finally {
    await new Promise<void>((r) => failing.close(() => r()));
  }
});

test("empty stream is reported instead of hanging", async () => {
  const empty = createServer((_req, res) => sse(res, []));
  await new Promise<void>((r) => empty.listen(PORT + 2, r));
  try {
    const opts = options("openai", { baseUrl: `http://127.0.0.1:${PORT + 2}` });
    opts.provider = { ...opts.provider, baseUrl: opts.baseUrl };
    await assert.rejects(collect(opts), /returned no content/);
  } finally {
    await new Promise<void>((r) => empty.close(() => r()));
  }
});

test("abort signal cancels an in-flight request", async () => {
  const controller = new AbortController();
  const slow = createServer(async (_req, res) => {
    await new Promise((r) => setTimeout(r, 300));
    sse(res, [openAiChunk("late")]);
  });
  await new Promise<void>((r) => slow.listen(PORT + 3, r));
  try {
    const opts = options("openai", {
      baseUrl: `http://127.0.0.1:${PORT + 3}`,
      signal: controller.signal,
    });
    opts.provider = { ...opts.provider, baseUrl: opts.baseUrl };
    const pending = collect(opts);
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(pending);
  } finally {
    await new Promise<void>((r) => slow.close(() => r()));
  }
});

test("storage round-trips connection and conversations", async () => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  const { loadConnection, saveConnection, clearConnection, resolveBaseUrl } =
    await import("./src/agentdeck/storage");

  assert.equal(loadConnection(), null);
  saveConnection({
    providerId: "groq",
    apiKey: "k",
    baseUrl: "",
    model: "llama-3.3-70b-versatile",
  });
  const loaded = loadConnection();
  assert.equal(loaded?.providerId, "groq");
  assert.equal(loaded?.apiKey, "k");

  const provider = getProvider("groq");
  assert.ok(provider);
  assert.equal(resolveBaseUrl(provider, ""), provider.baseUrl);
  assert.equal(
    resolveBaseUrl(provider, "https://x.test/v1///"),
    "https://x.test/v1",
  );

  clearConnection();
  assert.equal(loadConnection(), null);
  assert.equal(store.size, 0);
});

async function main() {
  await new Promise<void>((r) => server.listen(PORT, r));
  let failed = 0;
  try {
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  ok  ${name}`);
      } catch (err) {
        failed++;
        console.error(`FAIL  ${name}`);
        console.error("      " + (err as Error).message);
      }
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  if (failed) process.exit(1);
}

void main();
