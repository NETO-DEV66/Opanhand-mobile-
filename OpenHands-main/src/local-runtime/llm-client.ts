import type { LocalLlmConfig } from "./llm-config";
import { resolveLocalLlmProvider, splitModel } from "./llm-config";

export interface LocalChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LocalChatUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LocalChatResult {
  text: string;
  usage: LocalChatUsage | null;
}

export class LocalLlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LocalLlmError";
  }
}

const DEFAULT_ENDPOINTS = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
} as const;

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  if (!body) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const nested = parsed.error;
    const message =
      (typeof nested === "string" ? nested : nested?.message) ??
      parsed.message ??
      body;
    return `HTTP ${response.status}: ${message}`;
  } catch {
    return `HTTP ${response.status}: ${body.slice(0, 400)}`;
  }
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // A network failure or CORS rejection surfaces as a TypeError; the
    // provider is unreachable from the WebView, so name it explicitly
    // rather than leaking "Failed to fetch".
    throw new LocalLlmError(
      `Could not reach the LLM provider: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!response.ok) {
    throw new LocalLlmError(await readError(response), response.status);
  }
  return (await response.json()) as Record<string, unknown>;
}

async function callOpenAi(
  config: LocalLlmConfig,
  messages: LocalChatMessage[],
): Promise<LocalChatResult> {
  const { model } = splitModel(config.model);
  const baseUrl = config.baseUrl || DEFAULT_ENDPOINTS.openai;
  const payload = await requestJson(joinUrl(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  const choice = (
    payload.choices as Array<Record<string, unknown>> | undefined
  )?.[0];
  const message = choice?.message as { content?: string } | undefined;
  const usage = payload.usage as
    | { prompt_tokens?: number; completion_tokens?: number }
    | undefined;
  return {
    text: message?.content ?? "",
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
        }
      : null,
  };
}

async function callAnthropic(
  config: LocalLlmConfig,
  messages: LocalChatMessage[],
): Promise<LocalChatResult> {
  const { model } = splitModel(config.model);
  const baseUrl = config.baseUrl || DEFAULT_ENDPOINTS.anthropic;
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  const payload = await requestJson(joinUrl(baseUrl, "/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: conversation,
    }),
  });

  const blocks = (payload.content as Array<Record<string, unknown>> | undefined)
    ?.filter((block) => block.type === "text")
    .map((block) => String(block.text ?? ""));
  const usage = payload.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;
  return {
    text: blocks?.join("") ?? "",
    usage: usage
      ? {
          promptTokens: usage.input_tokens ?? 0,
          completionTokens: usage.output_tokens ?? 0,
        }
      : null,
  };
}

async function callGoogle(
  config: LocalLlmConfig,
  messages: LocalChatMessage[],
): Promise<LocalChatResult> {
  const { model } = splitModel(config.model);
  const baseUrl = config.baseUrl || DEFAULT_ENDPOINTS.google;
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const url = `${joinUrl(baseUrl, `/models/${model}:generateContent`)}?key=${encodeURIComponent(config.apiKey)}`;
  const payload = await requestJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(systemText
        ? { systemInstruction: { parts: [{ text: systemText }] } }
        : {}),
      contents,
    }),
  });

  const candidates = payload.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const parts = (
    candidates?.[0]?.content as { parts?: Array<{ text?: string }> } | undefined
  )?.parts;
  const usage = payload.usageMetadata as
    | { promptTokenCount?: number; candidatesTokenCount?: number }
    | undefined;
  return {
    text: parts?.map((part) => part.text ?? "").join("") ?? "",
    usage: usage
      ? {
          promptTokens: usage.promptTokenCount ?? 0,
          completionTokens: usage.candidatesTokenCount ?? 0,
        }
      : null,
  };
}

/**
 * Run one non-streaming chat completion against the configured provider.
 *
 * Only the direct-to-provider path is implemented: the runtime is meant to be
 * self-contained inside the WebView, so there is no gateway to route through.
 */
export async function runLocalChat(
  config: LocalLlmConfig,
  messages: LocalChatMessage[],
): Promise<LocalChatResult> {
  if (!config.apiKey.trim()) {
    throw new LocalLlmError("No API key configured for the local runtime.");
  }
  if (!config.model.trim()) {
    throw new LocalLlmError("No model configured for the local runtime.");
  }

  switch (resolveLocalLlmProvider(config.model)) {
    case "openai":
      return callOpenAi(config, messages);
    case "anthropic":
      return callAnthropic(config, messages);
    case "google":
      return callGoogle(config, messages);
    default: {
      // Unknown providers fall back to the OpenAI-compatible contract, which
      // every gateway and most local servers speak; a custom base URL is
      // required so we never silently post a private key to a guessed host.
      if (!config.baseUrl) {
        throw new LocalLlmError(
          `Unsupported LLM provider for "${config.model}". Set an OpenAI-compatible base URL to use it.`,
        );
      }
      return callOpenAi(config, messages);
    }
  }
}
