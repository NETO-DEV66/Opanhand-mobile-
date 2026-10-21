/**
 * Whether this build runs against the in-process local runtime instead of a
 * remote agent server.
 *
 * Kept in its own module so low-level config (`agent-server-config.ts`) can ask
 * the question without pulling in the socket shim or the LLM client.
 */
export function isLocalRuntimeEnabled(): boolean {
  return import.meta.env.VITE_MOCK_API === "true";
}

/**
 * Placeholder session key used when the build has no launcher to inject one.
 *
 * The in-process runtime does not authenticate, but the backend registry only
 * seeds its default local backend when *both* a host and a key are present —
 * without a key, first launch would show the "add a backend" form instead of
 * the agent/LLM steps.
 */
export const LOCAL_RUNTIME_SESSION_KEY = "local-runtime";
