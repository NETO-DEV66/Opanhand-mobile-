import { setLlmConfigProvider } from "./agent";
import { enableLocalEventPersistence } from "./conversation-store";
import { isLocalRuntimeEnabled } from "./enabled";
import { getLocalLlmConfig } from "./llm-store";
import { installLocalWebSocket } from "./session-socket";

export { getLocalLlmConfig, setLocalLlmConfig } from "./llm-store";
export { isLocalRuntimeEnabled } from "./enabled";
export { installInProcessFetch } from "./fetch-shim";

let installed = false;

/**
 * Install the local runtime. Must run before the app renders so every
 * `new WebSocket(...)` — including the first conversation connect — goes
 * through the shim.
 */
export function installLocalRuntime(): void {
  if (installed || typeof window === "undefined") return;
  if (!isLocalRuntimeEnabled()) return;
  installed = true;
  enableLocalEventPersistence();
  setLlmConfigProvider(getLocalLlmConfig);
  installLocalWebSocket();
}
