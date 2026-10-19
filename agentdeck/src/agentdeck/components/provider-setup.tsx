import { useState } from "react";
import { PROVIDERS, type Provider } from "../providers";
import type { Connection } from "../storage";

interface ProviderSetupProps {
  onConnect: (connection: Connection) => void;
  initial?: Connection | null;
}

export function ProviderSetup({ onConnect, initial }: ProviderSetupProps) {
  const [provider, setProvider] = useState<Provider | null>(() =>
    initial
      ? (PROVIDERS.find((p) => p.id === initial.providerId) ?? null)
      : null,
  );
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [model, setModel] = useState(
    initial?.model ||
      PROVIDERS.find((p) => p.id === initial?.providerId)?.defaultModel ||
      "",
  );

  const selectProvider = (next: Provider) => {
    setProvider(next);
    setApiKey("");
    setBaseUrl("");
    setModel(next.defaultModel);
  };

  const canConnect = provider
    ? provider.keyOptional || apiKey.trim().length > 0
    : false;

  const connect = () => {
    if (!provider) return;
    onConnect({
      providerId: provider.id,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model || provider.defaultModel,
    });
  };

  if (!provider) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12 text-contrast">
        <h1 className="text-2xl font-semibold tracking-tight">AgentDeck</h1>
        <p className="mt-2 text-sm text-muted">
          Connect a model provider to start chatting. Your key stays in this
          browser.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProvider(p)}
              className="flex items-start gap-3 rounded-2xl border border-contrast/10 bg-canvas-base p-4 text-left transition hover:border-contrast/30 hover:bg-surface-raised"
            >
              <span
                className="mt-1 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.accent }}
                aria-hidden
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs text-muted">{p.tagline}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12 text-contrast">
      <button
        type="button"
        onClick={() => setProvider(null)}
        className="mb-6 self-start text-xs text-muted transition hover:text-contrast"
      >
        &larr; All providers
      </button>
      <div className="flex items-center gap-3">
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: provider.accent }}
          aria-hidden
        />
        <h1 className="text-xl font-semibold tracking-tight">
          {provider.label}
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted">{provider.tagline}</p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider.keyHint || "Paste your key"}
            autoComplete="off"
            className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
          />
          {provider.keyUrl ? (
            <a
              href={provider.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start text-xs text-primary hover:underline"
            >
              Get a key
            </a>
          ) : null}
        </label>

        {provider.editableBaseUrl ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Base URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider.baseUrl || "https://example.com/v1"}
              className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
            />
          </label>
        ) : null}

        {provider.models.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Model</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model-id"
              className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
            />
          </label>
        )}

        <button
          type="button"
          onClick={connect}
          disabled={!canConnect}
          className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
