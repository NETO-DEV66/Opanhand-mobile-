/**
 * `localStorage` helpers for the local runtime.
 *
 * Everything the runtime keeps in memory is lost when the WebView is torn down,
 * so the chat log and the conversations the user created have to survive a
 * restart. `localStorage` is the only durable store the app has; the backend
 * registry already uses it for the same reason.
 */

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode: the in-memory state still serves this session.
  }
}
