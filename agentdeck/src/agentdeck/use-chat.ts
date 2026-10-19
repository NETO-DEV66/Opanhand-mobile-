import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProvider } from "./providers";
import { DEFAULT_SYSTEM_PROMPT, type ChatMessage, streamChat } from "./llm";
import {
  type Connection,
  type StoredConversation,
  type StoredMessage,
  clearConnection,
  loadConnection,
  loadConversations,
  newId,
  resolveBaseUrl,
  saveConnection,
  saveConversations,
} from "./storage";

export interface UseChat {
  connection: Connection | null;
  conversations: StoredConversation[];
  activeId: string | null;
  activeConversation: StoredConversation | null;
  isStreaming: boolean;
  error: string | null;
  send: (text: string) => void;
  stop: () => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  updateConnection: (partial: Partial<Connection>) => void;
  disconnect: () => void;
}

const hasWindow = () => typeof window !== "undefined";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
      return "Could not reach the provider. Check your connection, the base URL, and whether the provider allows browser requests (CORS).";
    }
    return error.message;
  }
  return "Something went wrong while contacting the provider.";
}

export function useChat(): UseChat {
  const [connection, setConnection] = useState<Connection | null>(() =>
    hasWindow() ? loadConnection() : null,
  );
  const [conversations, setConversations] = useState<StoredConversation[]>(
    () => (hasWindow() ? loadConversations() : []),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hasWindow()) return;
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (!hasWindow()) return;
    if (connection) saveConnection(connection);
    else clearConnection();
  }, [connection]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !connection) return;
      const provider = getProvider(connection.providerId);
      if (!provider) {
        setError("Unknown provider. Reconnect from settings.");
        return;
      }

      const existing = conversations.find((c) => c.id === activeId) ?? null;
      const conversationId = existing?.id ?? newId();
      const userMessage: StoredMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
      };
      const assistantId = newId();
      const assistantMessage: StoredMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };
      const history = [...(existing?.messages ?? []), userMessage];

      setConversations((prev) => [
        {
          id: conversationId,
          title: existing?.title ?? trimmed.slice(0, 40),
          updatedAt: Date.now(),
          messages: [...history, assistantMessage],
        },
        ...prev.filter((c) => c.id !== conversationId),
      ]);
      setActiveId(conversationId);
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const messages: ChatMessage[] = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      streamChat({
        provider,
        apiKey: connection.apiKey,
        baseUrl: resolveBaseUrl(provider, connection.baseUrl),
        model: connection.model || provider.defaultModel,
        messages,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        signal: controller.signal,
        onDelta: (chunk) => {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    updatedAt: Date.now(),
                    messages: c.messages.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + chunk }
                        : m,
                    ),
                  }
                : c,
            ),
          );
        },
      })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          const message = toErrorMessage(err);
          setError(message);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    updatedAt: Date.now(),
                    messages: c.messages.map((m) =>
                      m.id === assistantId
                        ? { ...m, error: true, content: m.content || message }
                        : m,
                    ),
                  }
                : c,
            ),
          );
        })
        .finally(() => {
          setIsStreaming(false);
          if (abortRef.current === controller) abortRef.current = null;
        });
    },
    [activeId, connection, conversations],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const newConversation = useCallback(() => {
    setActiveId(null);
    setError(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    const next = title.trim();
    if (!next) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: next, updatedAt: Date.now() } : c,
      ),
    );
  }, []);

  const updateConnection = useCallback((partial: Partial<Connection>) => {
    setConnection((prev) => ({
      providerId: prev?.providerId ?? "",
      apiKey: prev?.apiKey ?? "",
      baseUrl: prev?.baseUrl ?? "",
      model: prev?.model ?? "",
      ...partial,
    }));
  }, []);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setError(null);
    setConnection(null);
    setActiveId(null);
  }, []);

  return {
    connection,
    conversations,
    activeId,
    activeConversation,
    isStreaming,
    error,
    send,
    stop,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    updateConnection,
    disconnect,
  };
}
