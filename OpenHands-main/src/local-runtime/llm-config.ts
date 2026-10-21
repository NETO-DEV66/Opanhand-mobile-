/**
 * Which LLM the local runtime should call, resolved from the app's saved
 * settings or LLM profile. Provider/model strings follow the app's
 * `"<provider>/<model>"` convention (e.g. `"anthropic/claude-sonnet-4-5"`).
 */
export interface LocalLlmConfig {
  model: string;
  apiKey: string;
  /** Overrides the provider's default endpoint (OpenAI-compatible base URL). */
  baseUrl?: string | null;
}

export type LocalLlmProvider = "openai" | "anthropic" | "google" | "unknown";

export function splitModel(model: string): {
  provider: string;
  model: string;
} {
  const slash = model.indexOf("/");
  if (slash === -1) return { provider: "", model };
  return {
    provider: model.slice(0, slash).toLowerCase(),
    model: model.slice(slash + 1),
  };
}

export function resolveLocalLlmProvider(model: string): LocalLlmProvider {
  const { provider } = splitModel(model);
  if (provider === "openai" || provider === "anthropic") return provider;
  if (provider === "google" || provider === "gemini") return "google";
  return "unknown";
}
