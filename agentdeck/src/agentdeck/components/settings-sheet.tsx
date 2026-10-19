import { useState } from "react";
import { PROVIDERS } from "../providers";
import type { Connection } from "../storage";

interface SettingsSheetProps {
  connection: Connection;
  onSave: (partial: Partial<Connection>) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export function SettingsSheet({
  connection,
  onSave,
  onDisconnect,
  onClose,
}: SettingsSheetProps) {
  const [providerId, setProviderId] = useState(connection.providerId);
  const [apiKey, setApiKey] = useState(connection.apiKey);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [model, setModel] = useState(connection.model);

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? null;

  const changeProvider = (nextId: string) => {
    const next = PROVIDERS.find((p) => p.id === nextId) ?? null;
    setProviderId(nextId);
    setBaseUrl("");
    setModel(next?.defaultModel ?? "");
  };

  const save = () => {
    onSave({
      providerId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model || provider?.defaultModel || "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <div className="w-full max-w-lg rounded-t-2xl border border-contrast/10 bg-canvas-base p-6 text-contrast sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted transition hover:text-contrast"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
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
              onChange={(e) => setApiKey(e.target.value)}
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
                onChange={(e) => setBaseUrl(e.target.value)}
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
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-xl border border-danger/40 px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger/10"
          >
            Disconnect
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
