import type { OpenHandsEvent } from "#/types/agent-server/core";
import { ExecutionStatus } from "#/types/agent-server/core";
import { readJson, writeJson } from "./persistence";

/**
 * In-memory conversation log for the local runtime.
 *
 * The app talks to the agent-server over a mix of REST (`GET
 * /api/conversations/:id/events/search`, `.../events/count`) and the
 * `/sockets/session/{id}` socket. Both must see the same events, so this store
 * is the single source of truth: the REST handlers and the socket transport
 * read and append here instead of keeping their own copies.
 *
 * Events are held in `seq` order; `seq` is the index in the log, matching the
 * agent-server's durable-frame contract.
 */
interface LocalConversationLog {
  events: OpenHandsEvent[];
  listeners: Set<(event: OpenHandsEvent, seq: number) => void>;
  executionStatus: ExecutionStatus;
}

const logs = new Map<string, LocalConversationLog>();

/** One entry per conversation: its events and its last execution status. */
type PersistedLog = {
  events: OpenHandsEvent[];
  executionStatus: ExecutionStatus;
};

const EVENTS_STORAGE_KEY = "openhands-local-events";
/** Cap per conversation so a long chat cannot exhaust the storage quota. */
const MAX_PERSISTED_EVENTS = 500;

let persistEnabled = false;
let loaded = false;

/**
 * Enable persistence of the event log. Off by default so unit tests and
 * server-side rendering never touch `localStorage`.
 */
export function enableLocalEventPersistence(): void {
  persistEnabled = true;
}

function loadFromStorage(): void {
  if (loaded || !persistEnabled) return;
  loaded = true;
  const stored = readJson<Record<string, PersistedLog>>(EVENTS_STORAGE_KEY, {});
  for (const [conversationId, entry] of Object.entries(stored)) {
    if (!Array.isArray(entry?.events)) continue;
    logs.set(conversationId, {
      events: entry.events,
      listeners: new Set(),
      executionStatus: entry.executionStatus ?? ExecutionStatus.IDLE,
    });
  }
}

function persist(conversationId: string, log: LocalConversationLog): void {
  if (!persistEnabled) return;
  const stored = readJson<Record<string, PersistedLog>>(EVENTS_STORAGE_KEY, {});
  stored[conversationId] = {
    events: log.events.slice(-MAX_PERSISTED_EVENTS),
    executionStatus: log.executionStatus,
  };
  writeJson(EVENTS_STORAGE_KEY, stored);
}

function getLog(conversationId: string): LocalConversationLog {
  loadFromStorage();
  let log = logs.get(conversationId);
  if (!log) {
    log = {
      events: [],
      listeners: new Set(),
      executionStatus: ExecutionStatus.IDLE,
    };
    logs.set(conversationId, log);
  }
  return log;
}

export function listLocalEvents(conversationId: string): OpenHandsEvent[] {
  return [...getLog(conversationId).events];
}

export function localEventCount(conversationId: string): number {
  return getLog(conversationId).events.length;
}

export function appendLocalEvent(
  conversationId: string,
  event: OpenHandsEvent,
): number {
  const log = getLog(conversationId);
  const seq = log.events.length;
  log.events.push(event);
  persist(conversationId, log);
  for (const listener of log.listeners) {
    listener(event, seq);
  }
  return seq;
}

export function subscribeLocalEvents(
  conversationId: string,
  listener: (event: OpenHandsEvent, seq: number) => void,
): () => void {
  const log = getLog(conversationId);
  log.listeners.add(listener);
  return () => {
    log.listeners.delete(listener);
  };
}

export function getLocalExecutionStatus(
  conversationId: string,
): ExecutionStatus {
  return getLog(conversationId).executionStatus;
}

export function setLocalExecutionStatus(
  conversationId: string,
  status: ExecutionStatus,
): void {
  const log = getLog(conversationId);
  log.executionStatus = status;
  persist(conversationId, log);
  appendLocalEvent(conversationId, {
    id: `status-${log.events.length}`,
    timestamp: new Date().toISOString(),
    source: "environment",
    kind: "ConversationStateUpdateEvent",
    key: "execution_status",
    value: status,
  } as OpenHandsEvent);
}

export function resetLocalConversations(): void {
  logs.clear();
  if (persistEnabled && typeof window !== "undefined") {
    window.localStorage.removeItem(EVENTS_STORAGE_KEY);
  }
}
