import {
  getAgentServerBaseUrl,
  getAgentServerSessionApiKey,
} from "../agent-server-config";
import {
  isLocalRuntimeEnabled,
  LOCAL_RUNTIME_SESSION_KEY,
} from "#/local-runtime/enabled";
import type { Backend } from "./types";

/** Session key for the seeded backend, or null when this is a server build. */
function getLocalRuntimeSessionKey(): string | null {
  return isLocalRuntimeEnabled() ? LOCAL_RUNTIME_SESSION_KEY : null;
}

/**
 * Stable id for the seeded default local backend that is auto-registered in
 * the backend registry when the launcher provides both a backend host and
 * API key. After seeding, this backend is a normal registered entry — the
 * user can rename it, edit its host/api key, or remove it like any other
 * backend.
 */
export const SEEDED_DEFAULT_BACKEND_ID = "default-local";

export const DEFAULT_LOCAL_BACKEND_NAME = "Local";

/**
 * Construct the default local backend from environment/runtime config.
 * Returns null unless both a backend location and API key are available.
 *
 * Used as the seed entry written to `openhands-backends` on first load;
 * if it returns null, onboarding is responsible for collecting backend
 * connection details from the user.
 */
export function makeDefaultLocalBackend(): Backend | null {
  const host = getAgentServerBaseUrl();
  // The in-process runtime does not authenticate, but the registry only seeds
  // this entry when a key is present. Supply a placeholder so a standalone
  // build lands on the agent/LLM onboarding steps instead of the backend form.
  const apiKey = getAgentServerSessionApiKey() ?? getLocalRuntimeSessionKey();

  if (!host || !apiKey) return null;

  return {
    id: SEEDED_DEFAULT_BACKEND_ID,
    name: DEFAULT_LOCAL_BACKEND_NAME,
    host,
    apiKey,
    kind: "local",
  };
}
