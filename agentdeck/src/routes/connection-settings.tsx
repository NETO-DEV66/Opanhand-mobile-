import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { useChat } from "#/agentdeck/use-chat";
import { ProviderSetup } from "#/agentdeck/components/provider-setup";
import { PROVIDERS } from "#/agentdeck/providers";
import { useState } from "react";

export const meta: MetaFunction = () => [{ title: "Connection settings" }];

export default function ConnectionSettingsRoute() {
  const chat = useChat();

  if (!chat.connection) {
    return <ProviderSetup onConnect={chat.updateConnection} />;
  }

  return (
    <ConnectionSettingsForm
      connection={chat.connection}
      onSave={chat.updateConnection}
      onDisconnect={chat.disconnect}
    />
  );
}

interface FormProps {
  connection: NonNullable<ReturnType<typeof useChat>["connection"]>;
  onSave: (
    partial: Partial<NonNullable<ReturnType<typeof useChat>["connection"]>>,
  ) => void;
  onDisconnect: () => void;
}

function ConnectionSettingsForm({
  connection,
  onSave,
  onDisconnect,
}: FormProps) {
  const [providerId, setProviderId] = useState(connection.providerId);
  const [apiKey, setApiKey] = useState(connection.apiKey);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [model, setModel] = useState(connection.model);
  const [saved, setSaved] = useState(false);

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? null;

  const changeProvider = (nextId: string) => {
    const next = PROVIDERS.find((p) => p.id === nextId) ?? null;
    setProviderId(nextId);
    setBaseUrl("");
    setModel(next?.defaultModel ?? "");
    setSaved(false);
  };

  const save = () => {
    onSave({
      providerId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model || provider?.defaultModel || "",
    });
    setSaved(true);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-12 text-contrast">
      <Link
        to="/"
        className="mb-6 text-xs text-muted transition hover:text-contrast"
      >
        &larr; Back to chat
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">
        Connection settings
      </h1>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Provider</span>
          <select
            value={providerId}
            onChange={(e) => changeProvider(e.target.value)}
            className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaved(false);
            }}
            placeholder={provider?.keyHint || "Paste your key"}
            autoComplete="off"
            className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
          />
        </label>

        {provider?.editableBaseUrl ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Base URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setSaved(false);
              }}
              placeholder={provider.baseUrl || "https://example.com/v1"}
              className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
            />
          </label>
        ) : null}

        {provider && provider.models.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Model</span>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setSaved(false);
              }}
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
              onChange={(e) => {
                setModel(e.target.value);
                setSaved(false);
              }}
              placeholder="model-id"
              className="rounded-xl border border-contrast/10 bg-surface px-3 py-2 text-sm outline-none transition focus:border-contrast/40"
            />
          </label>
        )}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
          >
            Disconnect
          </button>
          {saved ? <span className="text-xs text-muted">Saved</span> : null}
        </div>
      </div>
    </div>
  );
}
