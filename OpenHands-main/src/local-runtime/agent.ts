import type { OpenHandsEvent } from "#/types/agent-server/core";
import { ExecutionStatus } from "#/types/agent-server/core";
import {
  appendLocalEvent,
  listLocalEvents,
  setLocalExecutionStatus,
} from "./conversation-store";
import { runLocalChat } from "./llm-client";
import type { LocalChatMessage } from "./llm-client";
import type { LocalLlmConfig } from "./llm-config";

/** Resolve the LLM config at send time, not construction time. */
export type LlmConfigProvider = () => LocalLlmConfig | null;

let llmConfigProvider: LlmConfigProvider = () => null;

export function setLlmConfigProvider(provider: LlmConfigProvider): void {
  llmConfigProvider = provider;
}

function messageEvent(
  id: string,
  source: "user" | "agent",
  role: "user" | "assistant",
  text: string,
): OpenHandsEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    source,
    llm_message: { role, content: [{ type: "text", text }] },
    activated_skills: [],
    extended_content: [],
  } as OpenHandsEvent;
}

function statsEvent(
  config: LocalLlmConfig,
  result: {
    promptTokens: number;
    completionTokens: number;
  },
): OpenHandsEvent {
  return {
    id: `stats-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    source: "environment",
    kind: "ConversationStateUpdateEvent",
    key: "stats",
    value: {
      usage_to_metrics: {
        default: {
          model_name: config.model,
          accumulated_cost: 0,
          max_budget_per_task: null,
          accumulated_token_usage: {
            model: config.model,
            prompt_tokens: result.promptTokens,
            completion_tokens: result.completionTokens,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            context_window: 0,
            per_turn_token: result.promptTokens + result.completionTokens,
            response_id: "",
          },
          costs: [],
          response_latencies: [],
          token_usages: [],
        },
      },
    },
  } as OpenHandsEvent;
}

function errorEvent(detail: string): OpenHandsEvent {
  return {
    id: `error-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    source: "agent",
    kind: "AgentErrorEvent",
    error: detail,
  } as unknown as OpenHandsEvent;
}

/**
 * Run one user turn against the configured LLM and append both sides of the
 * exchange to the conversation log.
 *
 * `onStreamStart` fires after the user event is committed but before the
 * provider call, so a socket can open a streaming slot and show the agent
 * "typing". `itemId` is the id the assistant event will carry, which is what
 * retires that slot.
 *
 * Appending to the store is what delivers the events: every subscribed socket
 * receives them as durable frames.
 */
export async function runLocalAgentTurn(
  conversationId: string,
  text: string,
  options: { onStreamStart?: (itemId: string) => void } = {},
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  appendLocalEvent(
    conversationId,
    messageEvent(`user-${crypto.randomUUID()}`, "user", "user", trimmed),
  );
  setLocalExecutionStatus(conversationId, ExecutionStatus.RUNNING);

  const config = llmConfigProvider();
  if (!config) {
    appendLocalEvent(
      conversationId,
      errorEvent(
        "No LLM is configured. Open Settings, then LLM, and add a provider, model, and API key.",
      ),
    );
    setLocalExecutionStatus(conversationId, ExecutionStatus.ERROR);
    return;
  }

  const itemId = `assistant-${crypto.randomUUID()}`;
  options.onStreamStart?.(itemId);

  try {
    const history = buildHistory(conversationId);
    const result = await runLocalChat(config, history);
    appendLocalEvent(
      conversationId,
      messageEvent(
        itemId,
        "agent",
        "assistant",
        result.text.trim() || "(empty response)",
      ),
    );
    if (result.usage) {
      appendLocalEvent(conversationId, statsEvent(config, result.usage));
    }
    setLocalExecutionStatus(conversationId, ExecutionStatus.IDLE);
  } catch (error) {
    appendLocalEvent(
      conversationId,
      errorEvent(error instanceof Error ? error.message : String(error)),
    );
    setLocalExecutionStatus(conversationId, ExecutionStatus.ERROR);
  }
}

function buildHistory(conversationId: string): LocalChatMessage[] {
  const messages: LocalChatMessage[] = [];
  for (const event of listLocalEvents(conversationId)) {
    const candidate = event as {
      llm_message?: { role?: string; content?: Array<{ text?: string }> };
    };
    const role = candidate.llm_message?.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = (candidate.llm_message?.content ?? [])
      .map((part) => part.text ?? "")
      .join("");
    if (text) messages.push({ role, content: text });
  }
  return messages;
}
