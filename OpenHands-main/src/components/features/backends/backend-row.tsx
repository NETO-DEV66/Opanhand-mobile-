import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";

import { type Backend } from "#/api/backend-registry/types";
import {
  isInvalidBackendApiKeyHealthError,
  type BackendHealth,
} from "#/hooks/query/use-backends-health";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import { BackendStatusDot } from "./backend-status-dot";
import { BackendVersion } from "./backend-version";
import { getBackendStatusLabel } from "./backend-status-label";

const ROW_ACTION_BUTTON_CLASS =
  "inline-flex cursor-pointer items-center justify-center rounded-md p-1 text-muted transition-colors hover:bg-interactive-hover hover:text-contrast";

interface BackendRowProps {
  backend: Backend;
  health: BackendHealth | undefined;
  orgLabel?: string;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function BackendRow({
  backend,
  health,
  orgLabel,
  onSelect,
  onEdit,
  onRemove,
}: BackendRowProps) {
  const { t } = useTranslation("openhands");
  const isInvalidApiKey = isInvalidBackendApiKeyHealthError(health?.lastError);
  const statusDetail =
    !isInvalidApiKey && health?.isConnected === false && health.lastError
      ? health.lastError
      : null;
  const statusLabel = getBackendStatusLabel(t, backend, health);
  const statusClassName =
    health?.isConnected === true
      ? "text-feedback-success"
      : health?.isConnected === false
        ? "text-feedback-error"
        : "text-muted";
  const dotStatus = isInvalidApiKey ? false : (health?.isConnected ?? null);
  // The host is a tunnel's loopback port, owned by the Managed Agents screen.
  const isMarsSession = Boolean(backend.marsSessionId);
  // A MARS session reads offline whenever its tunnel is gone (e.g. after a
  // restart), and selecting it is what reopens the tunnel — so it stays
  // selectable rather than forcing a new session.
  const canSelect =
    (health?.isConnected === true || isMarsSession) && !isInvalidApiKey;

  return (
    <li
      className="flex items-stretch"
      data-testid={`manage-backends-row-${backend.name}`}
    >
      <button
        type="button"
        disabled={!canSelect}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left",
          canSelect
            ? "cursor-pointer transition-colors hover:bg-interactive-hover focus-visible:bg-interactive-hover focus-visible:outline-none"
            : "cursor-default",
        )}
      >
        <BackendStatusDot isConnected={dotStatus} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm text-contrast">
              {backend.name}
            </span>
            <BackendVersion backend={backend} />
          </div>
          {orgLabel ? (
            <span
              data-testid={`manage-backends-org-${backend.name}`}
              className="truncate text-xs text-text-secondary"
            >
              {orgLabel}
            </span>
          ) : null}
          <span className="truncate text-xs text-muted">
            {isMarsSession ? t(I18nKey.DO_AGENTS$HOSTED_SESSION) : backend.host}
          </span>
          <span
            data-testid={`manage-backends-status-${backend.name}`}
            className={cn("truncate text-xs", statusClassName)}
          >
            {statusLabel}
          </span>
          {statusDetail ? (
            <span
              data-testid={`manage-backends-status-detail-${backend.name}`}
              title={statusDetail}
              className="text-xs text-feedback-error whitespace-normal break-words"
            >
              {statusDetail}
            </span>
          ) : null}
        </div>
        <span className="px-2 py-1 rounded-full text-[11px] uppercase tracking-wide text-text-tertiary bg-surface border border-border">
          {isMarsSession
            ? t(I18nKey.DO_AGENTS$BADGE)
            : backend.kind === "cloud"
              ? t(I18nKey.BACKEND$KIND_CLOUD)
              : t(I18nKey.BACKEND$KIND_LOCAL)}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2 px-3 py-3">
        {!isMarsSession && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t(I18nKey.BACKEND$EDIT)}
            data-testid={`manage-backends-edit-${backend.name}`}
            className={ROW_ACTION_BUTTON_CLASS}
          >
            <Pencil aria-hidden className="size-4" strokeWidth={2} />
          </button>
        )}
        {
          <button
            type="button"
            onClick={onRemove}
            aria-label={t(I18nKey.BACKEND$REMOVE)}
            data-testid={`manage-backends-remove-${backend.name}`}
            className={ROW_ACTION_BUTTON_CLASS}
          >
            <Trash2 aria-hidden className="size-4" strokeWidth={2} />
          </button>
        }
      </div>
    </li>
  );
}
