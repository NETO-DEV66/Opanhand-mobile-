import type { LocalLlmConfig } from "./llm-config";

/**
 * Persisted LLM configuration for the local runtime.
 *
 * The shipped Android build has no server to hold settings, so the mock
 * agent-server's in-memory state is gone after the WebView is torn down. The
 * API key therefore has to live in `localStorage` — it is the only durable
 * store available, and it is already where the app keeps the backend registry.
 */
const STORAGE_KEY = "openhands-local-llm";

type Listener = (config: LocalLlmConfig | null) => void;

const listeners = new Set<Listener>();

function read(): LocalLlmConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalLlmConfig>;
    if (typeof parsed.model !== "string" || typeof parsed.apiKey !== "string") {
      return null;
    }
    return {
      model: parsed.model,
      apiKey: parsed.apiKey,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : null,
    };
  } catch {
    return null;
  }
}

export function getLocalLlmConfig(): LocalLlmConfig | null {
  return read();
}

export function setLocalLlmConfig(config: LocalLlmConfig | null): void {
  if (typeof window === "undefined") return;
  try {
    if (config) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); the in-memory listeners
    // still fire so the running session picks the change up.
  }
  for (const listener of listeners) listener(config);
}

export function subscribeLocalLlmConfig(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Record an LLM configuration seen on the wire (a settings PATCH or an LLM
 * profile save/activate) so the local runtime can call the provider directly.
 *
 * Only complete configurations are stored: a redacted key (`**********`) or an
 * encrypted blob is not usable, and overwriting a good key with one would break
 * the running session.
 */
export function mirrorLlmConfigFromSettings(
  llm: Record<string, unknown> | null | undefined,
): void {
  if (!llm) return;
  const model = typeof llm.model === "string" ? llm.model.trim() : "";
  const apiKey = typeof llm.api_key === "string" ? llm.api_key.trim() : "";
  if (!model || !apiKey || apiKey === "**********") return;
  if (apiKey.startsWith("gAAAAA_mock_encrypted_")) return;

  const rawBaseUrl =
    typeof llm.base_url === "string" ? llm.base_url.trim() : "";
  const baseUrl = rawBaseUrl.length > 0 ? rawBaseUrl : null;

  const current = read();
  if (
    current?.model === model &&
    current.apiKey === apiKey &&
    current.baseUrl === baseUrl
  ) {
    return;
  }
  setLocalLlmConfig({ model, apiKey, baseUrl });
}
