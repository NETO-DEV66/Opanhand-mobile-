import type { Provider } from "./providers";

const STORAGE_KEY = "agentdeck-connection";
const CONVERSATIONS_KEY = "agentdeck-conversations";

export interface Connection {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function loadConnection(): Connection | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Connection>;
    if (!parsed.providerId) return null;
    return {
      providerId: parsed.providerId,
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl ?? "",
      model: parsed.model ?? "",
    };
  } catch {
    return null;
  }
}

export function saveConnection(connection: Connection): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export function clearConnection(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function resolveBaseUrl(provider: Provider, baseUrl: string): string {
  return (baseUrl || provider.baseUrl).replace(/\/+$/, "");
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

export interface StoredConversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
}

export function loadConversations(): StoredConversation[] {
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredConversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: StoredConversation[]): void {
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
