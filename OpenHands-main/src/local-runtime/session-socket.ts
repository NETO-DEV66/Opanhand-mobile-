import type {
  DurableFrame,
  ItemStartedFrame,
  SessionFrame,
  SyncFrame,
} from "#/types/agent-server/session-frames";
import { runLocalAgentTurn, type LlmConfigProvider } from "./agent";
import { listLocalEvents, subscribeLocalEvents } from "./conversation-store";

/**
 * A `WebSocket`-shaped shim that speaks the agent-server
 * `/sockets/session/{id}` envelope protocol against the in-process local
 * runtime.
 *
 * The app's socket layer (`use-websocket.ts`) only touches the standard
 * surface — `readyState`, `send`, `close`, and the `onopen` / `onmessage` /
 * `onclose` / `onerror` handlers — so implementing that surface is enough to
 * take the socket over without touching the chat code.
 *
 * Capacitor's Android WebView has no usable service worker, so the mock
 * worker cannot intercept this socket; this shim runs in the page instead.
 */
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

type EventHandler = ((event: unknown) => void) | null;

function parseAfterSeq(url: string): number {
  try {
    const seq = new URL(url, "http://localhost").searchParams.get("after_seq");
    const parsed = seq === null ? -1 : Number(seq);
    return Number.isFinite(parsed) ? parsed : -1;
  } catch {
    return -1;
  }
}

function conversationIdFromUrl(url: string): string | null {
  const match = /\/sockets\/session\/([^/?#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function messageText(message: {
  content?: Array<{ type?: string; text?: string }>;
}): string {
  return (message.content ?? [])
    .filter((part) => part?.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export class LocalSessionWebSocket {
  readonly url: string;
  readonly protocol = "";
  readonly extensions = "";
  readonly bufferedAmount = 0;
  readonly binaryType = "blob";

  readyState = CONNECTING;

  onopen: EventHandler = null;
  onmessage: EventHandler = null;
  onclose: EventHandler = null;
  onerror: EventHandler = null;

  private readonly conversationId: string | null;
  private unsubscribe: (() => void) | null = null;
  private readonly connectTimer: ReturnType<typeof setTimeout>;

  constructor(url: string) {
    this.url = url;
    this.conversationId = conversationIdFromUrl(url);

    // Connect on the next tick so the caller can attach handlers first, the
    // same ordering a real socket guarantees.
    this.connectTimer = setTimeout(() => this.open(), 0);
  }

  private open(): void {
    if (this.readyState !== CONNECTING) return;
    this.readyState = OPEN;
    this.onopen?.({ type: "open", target: this });

    if (!this.conversationId) return;
    this.replayHistory();
    this.unsubscribe = subscribeLocalEvents(
      this.conversationId,
      (event, seq) => {
        this.deliver({ type: "durable", seq, event } satisfies DurableFrame);
      },
    );
  }

  private replayHistory(): void {
    if (!this.conversationId) return;
    const afterSeq = parseAfterSeq(this.url);
    const events = listLocalEvents(this.conversationId);
    const sync: SyncFrame = {
      type: "sync",
      from_seq: afterSeq + 1,
      through_seq: events.length - 1,
    };
    this.deliver(sync);
    events.forEach((event, seq) => {
      if (seq <= afterSeq) return;
      this.deliver({ type: "durable", seq, event } satisfies DurableFrame);
    });
  }

  private deliver(frame: SessionFrame): void {
    if (this.readyState !== OPEN) return;
    this.onmessage?.({
      type: "message",
      data: JSON.stringify(frame),
      target: this,
    });
  }

  send(data: string): void {
    if (this.readyState !== OPEN) return;
    let parsed: {
      type?: string;
      role?: string;
      content?: Array<{ type?: string; text?: string }>;
    };
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    // Auth and any other control frames carry no conversation payload.
    if (parsed.type === "auth" || parsed.role !== "user") return;
    if (!this.conversationId) return;

    void this.handleUserMessage(parsed);
  }

  private async handleUserMessage(message: {
    content?: Array<{ type?: string; text?: string }>;
  }): Promise<void> {
    if (!this.conversationId) return;
    const text = messageText(message);
    if (!text.trim()) return;

    // Open the streaming slot before the provider call so the chat shows the
    // agent "typing"; the durable message that follows retires it.
    await runLocalAgentTurn(this.conversationId, text, {
      onStreamStart: (itemId) => {
        this.deliver({
          type: "item_started",
          item_id: itemId,
          anchor_seq: null,
        } satisfies ItemStartedFrame);
      },
    });
  }

  close(): void {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSING;
    clearTimeout(this.connectTimer);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.readyState = CLOSED;
    this.onclose?.({ type: "close", code: 1000, reason: "", wasClean: true });
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (type === "open") this.onopen = handler;
    else if (type === "message") this.onmessage = handler;
    else if (type === "close") this.onclose = handler;
    else if (type === "error") this.onerror = handler;
  }

  removeEventListener(type: string, handler: (event: unknown) => void): void {
    const key = `on${type}` as "onopen" | "onmessage" | "onclose" | "onerror";
    if ((this[key] as unknown) === handler) {
      this[key] = null;
    }
  }

  dispatchEvent(): boolean {
    return true;
  }
}

/** `readyState` constants, mirrored onto the shim like the real global. */
export const LOCAL_WEBSOCKET_STATES = { CONNECTING, OPEN, CLOSING, CLOSED };

/**
 * Swap `globalThis.WebSocket` for the local shim. Idempotent: the original
 * constructor is captured once so repeated installs are safe.
 */
let originalWebSocket: typeof WebSocket | null = null;

export function installLocalWebSocket(): void {
  if (typeof window === "undefined" || originalWebSocket) return;
  const NativeWebSocket = window.WebSocket;
  originalWebSocket = NativeWebSocket;

  // Only the conversation session socket is ours. Any other socket in the app
  // (a dev tool, an extension) must keep the native behaviour, so anything
  // that does not match the session path is delegated to the real constructor.
  const shim = function (url: string | URL, protocols?: string | string[]) {
    const target = String(url);
    if (!/\/sockets\/session\//.test(target)) {
      return new NativeWebSocket(target, protocols);
    }
    return new LocalSessionWebSocket(target);
  } as unknown as typeof WebSocket;
  const constants = shim as unknown as Record<string, number>;
  constants.CONNECTING = CONNECTING;
  constants.OPEN = OPEN;
  constants.CLOSING = CLOSING;
  constants.CLOSED = CLOSED;

  window.WebSocket = shim;
}

export function uninstallLocalWebSocket(): void {
  if (typeof window === "undefined" || !originalWebSocket) return;
  window.WebSocket = originalWebSocket;
  originalWebSocket = null;
}

export type { LlmConfigProvider };
