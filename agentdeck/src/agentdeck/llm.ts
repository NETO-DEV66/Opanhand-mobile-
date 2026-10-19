import type { Provider } from "./providers";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are AgentDeck, a helpful assistant. Answer clearly and concisely.";

/** Human-readable text for any failure the user could hit. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export function describeHttpError(status: number, body: string): LlmError {
  const detail = body.trim().slice(0, 400);
  if (status === 401 || status === 403) {
    return new LlmError(
      "The provider rejected the API key. Check the key and try again.",
      status,
    );
  }
  if (status === 404) {
    return new LlmError(
      "Model or endpoint not found. Check the model name. " + detail,
      status,
    );
  }
  if (status === 429) {
    return new LlmError(
      "Rate limited by the provider. Wait a moment and retry.",
      status,
    );
  }
  return new LlmError("Provider error " + status + ". " + detail, status);
}

export async function readSseLines(
  response: Response,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new LlmError("The provider returned an empty stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) onLine(line.trim());
  }
  if (buffer.trim()) onLine(buffer.trim());
}

export function dataPayload(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  return line.slice(5).trim();
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw describeHttpError(response.status, text);
  }
  return response;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function streamOpenAiCompatible(
  options: StreamOptions,
): Promise<void> {
  const { provider, apiKey, baseUrl, model, messages, systemPrompt, signal } =
    options;
  const headers: Record<string, string> = {
    authorization: "Bearer " + (apiKey || "local"),
  };
  if (provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/NETO-DEV66/Opanhand-mobile-";
    headers["X-Title"] = "AgentDeck";
  }
  const payload = {
    model,
    stream: true,
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
  };
  const response = await postJson(
    trimSlash(baseUrl) + "/chat/completions",
    headers,
    payload,
    signal,
  );
  let sawData = false;
  await readSseLines(response, (line) => {
    const data = dataPayload(line);
    if (data === null) return;
    const delta = parseOpenAiDelta(data);
    if (delta) {
      sawData = true;
      options.onDelta(delta);
    }
  });
  if (!sawData) {
    throw new LlmError("The provider returned no content.");
  }
}
export function parseOpenAiDelta(data: string): string {
  if (!data || data === "[DONE]") return "";
  try {
    const parsed = JSON.parse(data) as {
      choices?: { delta?: { content?: string | null } }[];
    };
    return parsed.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

export async function streamAnthropic(options: StreamOptions): Promise<void> {
  const { apiKey, baseUrl, model, messages, systemPrompt, signal } = options;
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  const payload: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemPrompt) payload.system = systemPrompt;
  const response = await postJson(
    trimSlash(baseUrl) + "/messages",
    headers,
    payload,
    signal,
  );
  let sawData = false;
  await readSseLines(response, (line) => {
    const data = dataPayload(line);
    if (data === null || data === "[DONE]") return;
    const delta = parseAnthropicDelta(data);
    if (delta) {
      sawData = true;
      options.onDelta(delta);
    }
  });
  if (!sawData) {
    throw new LlmError("The provider returned no content.");
  }
}

export function parseAnthropicDelta(data: string): string {
  if (!data || data === "[DONE]") return "";
  try {
    const parsed = JSON.parse(data) as {
      type?: string;
      delta?: { type?: string; text?: string | null };
    };
    if (
      parsed.type === "content_block_delta" &&
      parsed.delta?.type === "text_delta"
    ) {
      return parsed.delta.text ?? "";
    }
    return "";
  } catch {
    return "";
  }
}

export async function streamGemini(options: StreamOptions): Promise<void> {
  const { apiKey, baseUrl, model, messages, systemPrompt, signal } = options;
  const headers: Record<string, string> = { "x-goog-api-key": apiKey };
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const payload: Record<string, unknown> = { contents };
  if (systemPrompt) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  const url =
    trimSlash(baseUrl) +
    "/models/" +
    encodeURIComponent(model) +
    ":streamGenerateContent?alt=sse";
  const response = await postJson(url, headers, payload, signal);
  let sawData = false;
  await readSseLines(response, (line) => {
    const data = dataPayload(line);
    if (data === null || data === "[DONE]") return;
    const delta = parseGeminiDelta(data);
    if (delta) {
      sawData = true;
      options.onDelta(delta);
    }
  });
  if (!sawData) {
    throw new LlmError("The provider returned no content.");
  }
}

export function parseGeminiDelta(data: string): string {
  if (!data || data === "[DONE]") return "";
  try {
    const parsed = JSON.parse(data) as {
      candidates?: { content?: { parts?: { text?: string | null }[] } }[];
    };
    const parts = parsed.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("");
  } catch {
    return "";
  }
}

export function streamChat(options: StreamOptions): Promise<void> {
  switch (options.provider.apiStyle) {
    case "anthropic":
      return streamAnthropic(options);
    case "gemini":
      return streamGemini(options);
    default:
      return streamOpenAiCompatible(options);
  }
}
