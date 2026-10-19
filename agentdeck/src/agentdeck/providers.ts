/**
 * Provider catalog for AgentDeck's direct-connect mode.
 *
 * Every entry carries its own base URL, so the first-launch screen only ever
 * asks the user for an API key. Nothing here talks to a self-hosted server.
 */

export type ProviderApiStyle = "openai" | "anthropic" | "gemini";

export interface ProviderModel {
  id: string;
  label: string;
}

export interface Provider {
  id: string;
  label: string;
  /** Short line shown under the name on the picker. */
  tagline: string;
  apiStyle: ProviderApiStyle;
  baseUrl: string;
  /** Where the user creates a key; shown as a "Get a key" link. */
  keyUrl: string;
  /** Prefix hint for the key field, e.g. "sk-". Empty when there is none. */
  keyHint: string;
  /** Whether a base URL field is shown (true only for the custom entry). */
  editableBaseUrl: boolean;
  /** Whether the key may be left empty (local runtimes like Ollama). */
  keyOptional: boolean;
  models: ProviderModel[];
  defaultModel: string;
  accent: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "openai",
    label: "OpenAI",
    tagline: "GPT models",
    apiStyle: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "gpt-5.1", label: "GPT-5.1" },
      { id: "gpt-5.1-mini", label: "GPT-5.1 mini" },
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "o4-mini", label: "o4-mini" },
    ],
    defaultModel: "gpt-5.1-mini",
    accent: "#10a37f",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    tagline: "Claude models",
    apiStyle: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-1", label: "Claude Opus 4.1" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    ],
    defaultModel: "claude-sonnet-4-5",
    accent: "#d97757",
  },
  {
    id: "google",
    label: "Google Gemini",
    tagline: "Gemini models",
    apiStyle: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
    defaultModel: "gemini-2.5-flash",
    accent: "#4285f4",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    tagline: "One key, every model",
    apiStyle: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
      { id: "openai/gpt-5.1", label: "GPT-5.1" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
      { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B" },
    ],
    defaultModel: "anthropic/claude-sonnet-4.5",
    accent: "#8b5cf6",
  },
  {
    id: "groq",
    label: "Groq",
    tagline: "Fast open models",
    apiStyle: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2" },
    ],
    defaultModel: "llama-3.3-70b-versatile",
    accent: "#f55036",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    tagline: "DeepSeek models",
    apiStyle: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyHint: "sk-...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3" },
      { id: "deepseek-reasoner", label: "DeepSeek R1" },
    ],
    defaultModel: "deepseek-chat",
    accent: "#4d6bfe",
  },
  {
    id: "mistral",
    label: "Mistral",
    tagline: "Mistral models",
    apiStyle: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
    keyHint: "",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "mistral-large-latest", label: "Mistral Large" },
      { id: "mistral-medium-latest", label: "Mistral Medium" },
      { id: "codestral-latest", label: "Codestral" },
    ],
    defaultModel: "mistral-large-latest",
    accent: "#fa520f",
  },
  {
    id: "xai",
    label: "xAI Grok",
    tagline: "Grok models",
    apiStyle: "openai",
    baseUrl: "https://api.x.ai/v1",
    keyUrl: "https://console.x.ai",
    keyHint: "xai-...",
    editableBaseUrl: false,
    keyOptional: false,
    models: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-3", label: "Grok 3" },
      { id: "grok-3-mini", label: "Grok 3 mini" },
    ],
    defaultModel: "grok-4",
    accent: "#111827",
  },
  {
    id: "ollama",
    label: "Ollama",
    tagline: "Local models, no key",
    apiStyle: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyUrl: "https://ollama.com/download",
    keyHint: "",
    editableBaseUrl: true,
    keyOptional: true,
    models: [
      { id: "llama3.2", label: "Llama 3.2" },
      { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
      { id: "gemma3", label: "Gemma 3" },
      { id: "phi4", label: "Phi 4" },
    ],
    defaultModel: "llama3.2",
    accent: "#0f172a",
  },
  {
    id: "custom",
    label: "Custom",
    tagline: "Any OpenAI-compatible API",
    apiStyle: "openai",
    baseUrl: "",
    keyUrl: "",
    keyHint: "",
    editableBaseUrl: true,
    keyOptional: true,
    models: [],
    defaultModel: "",
    accent: "#64748b",
  },
];

export function getProvider(id: string | null | undefined): Provider | null {
  if (!id) return null;
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export function providerSupportsModel(
  provider: Provider,
  model: string,
): boolean {
  return provider.models.some((m) => m.id === model);
}
