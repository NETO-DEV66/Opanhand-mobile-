import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runLocalAgentTurn, setLlmConfigProvider } from "./agent";
import {
  enableLocalEventPersistence,
  listLocalEvents,
  resetLocalConversations,
} from "./conversation-store";
import type { LocalLlmConfig } from "./llm-config";

const CONFIG: LocalLlmConfig = {
  model: "openai/gpt-4o-mini",
  apiKey: "sk-test",
  baseUrl: null,
};

/** Minimal event shapes the assertions read back out of the store. */
type StoredEvent = {
  source?: string;
  llm_message?: { role?: string; content?: Array<{ text?: string }> };
};

function textOf(event: StoredEvent): string {
  return (event.llm_message?.content ?? [])
    .map((part) => part.text ?? "")
    .join("");
}

function stubChatCompletion(content: string, usage = true) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({
      choices: [{ message: { role: "assistant", content } }],
      ...(usage ? { usage: { prompt_tokens: 12, completion_tokens: 5 } } : {}),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetLocalConversations();
  enableLocalEventPersistence();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setLlmConfigProvider(() => null);
  resetLocalConversations();
});

describe("runLocalAgentTurn", () => {
  it("appends the user turn and the assistant reply to the conversation", async () => {
    setLlmConfigProvider(() => CONFIG);
    stubChatCompletion("Hello from the local runtime");

    await runLocalAgentTurn("conv-1", "hi there");

    const events = listLocalEvents("conv-1");
    const messages = events
      .filter((event) => (event as StoredEvent).llm_message)
      .map((event) => ({
        role: (event as StoredEvent).llm_message?.role,
        text: textOf(event as StoredEvent),
      }));

    expect(messages).toEqual([
      { role: "user", text: "hi there" },
      { role: "assistant", text: "Hello from the local runtime" },
    ]);
  });

  it("sends the model without the provider prefix and the accumulated history", async () => {
    setLlmConfigProvider(() => CONFIG);
    stubChatCompletion("first");
    await runLocalAgentTurn("conv-2", "one");

    const secondFetch = stubChatCompletion("second");
    await runLocalAgentTurn("conv-2", "two");

    const [url, init] = secondFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };

    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "first" },
      { role: "user", content: "two" },
    ]);
  });

  it("honours a custom base URL when the config supplies one", async () => {
    setLlmConfigProvider(() => ({
      ...CONFIG,
      baseUrl: "http://127.0.0.1:11434/v1",
    }));
    const fetchMock = stubChatCompletion("local model");

    await runLocalAgentTurn("conv-3", "ping");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:11434/v1/chat/completions",
    );
  });

  it("records an error event when no LLM is configured", async () => {
    setLlmConfigProvider(() => null);

    await runLocalAgentTurn("conv-4", "are you there?");

    const events = listLocalEvents("conv-4");
    const kinds = events.map((event) => (event as { kind?: string }).kind);
    expect(kinds).toContain("AgentErrorEvent");
    expect(
      events.some((event) =>
        textOf(event as StoredEvent).includes("No LLM is configured"),
      ),
    ).toBe(false);
  });

  it("records an error event when the provider rejects the request", async () => {
    setLlmConfigProvider(() => CONFIG);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: "bad key" } }, { status: 401 }),
      ),
    );

    await runLocalAgentTurn("conv-5", "hello");

    const error = listLocalEvents("conv-5").find(
      (event) => (event as { kind?: string }).kind === "AgentErrorEvent",
    ) as { error?: string } | undefined;
    expect(error?.error).toContain("401");
    expect(error?.error).toContain("bad key");
  });

  it("ignores a blank message", async () => {
    setLlmConfigProvider(() => CONFIG);
    const fetchMock = stubChatCompletion("unused");

    await runLocalAgentTurn("conv-6", "   ");

    expect(listLocalEvents("conv-6")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
