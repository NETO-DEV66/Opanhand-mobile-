import React from "react";
import { useTranslation } from "react-i18next";
import { FaBitbucket, FaGithub, FaGitlab } from "react-icons/fa6";
import OpenHandsLogoWhite from "#/assets/branding/openhands-logo-white.svg?react";
import { I18nKey } from "#/i18n/declaration";
import { useDeviceFlow } from "#/hooks/use-device-flow";
import type { CloudConnectionSource } from "#/services/cloud-funnel-analytics";
import { cn } from "#/utils/utils";
import {
  buildCloudProviderLoginUrl,
  deviceVerifyPathFromVerificationUrl,
  isNativeShell,
  openExternalUrl,
  type CloudLoginProvider,
} from "#/api/cloud-provider-login";

interface ProviderOption {
  id: CloudLoginProvider;
  /** Brand spelling shown in the button label, never translated. */
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

/** Providers the hosted `/login` page offers, in the same order. */
const CLOUD_LOGIN_PROVIDERS: readonly ProviderOption[] = [
  { id: "github", label: "GitHub", Icon: FaGithub },
  { id: "gitlab", label: "GitLab", Icon: FaGitlab },
  { id: "bitbucket", label: "Bitbucket", Icon: FaBitbucket },
];

interface UseCloudLoginOptions {
  /** OpenHands Cloud origin to authenticate against. */
  host: string;
  onAuthenticated: (apiKey: string) => void;
  source?: CloudConnectionSource;
}

/**
 * Cloud sign-in behaviour shared by the full-screen login page and the
 * onboarding backend step.
 *
 * Clicking a provider starts the OAuth 2.0 device flow and, once the flow has
 * minted a user code, opens that provider's consent screen in the browser.
 * The device-verify path is handed to Keycloak as `state.redirect_url` so the
 * user lands back on the confirm-code page after authenticating.
 */
function useCloudLogin({
  host,
  onAuthenticated,
  source = "onboarding",
}: UseCloudLoginOptions) {
  const deviceFlow = useDeviceFlow();
  const [pendingProvider, setPendingProvider] =
    React.useState<CloudLoginProvider | null>(null);
  const [popupBlocked, setPopupBlocked] = React.useState(false);
  const popupRef = React.useRef<Window | null>(null);

  const closePopup = React.useCallback(() => {
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  React.useEffect(() => closePopup, [closePopup]);

  React.useEffect(() => {
    if (deviceFlow.status === "success" && deviceFlow.apiKey) {
      closePopup();
      onAuthenticated(deviceFlow.apiKey);
    }
  }, [deviceFlow.status, deviceFlow.apiKey, closePopup, onAuthenticated]);

  React.useEffect(() => {
    if (
      deviceFlow.status !== "awaiting_authorization" ||
      !deviceFlow.verificationUrl ||
      !pendingProvider
    ) {
      return;
    }

    const providerUrl = buildCloudProviderLoginUrl(
      host,
      pendingProvider,
      deviceVerifyPathFromVerificationUrl(deviceFlow.verificationUrl),
    );

    if (!isNativeShell() && !popupRef.current) setPopupBlocked(true);
    openExternalUrl(providerUrl, popupRef.current);
    popupRef.current = null;
  }, [deviceFlow.status, deviceFlow.verificationUrl, pendingProvider, host]);

  const startWithProvider = React.useCallback(
    (provider: CloudLoginProvider) => {
      setPendingProvider(provider);
      setPopupBlocked(false);

      if (!isNativeShell()) {
        // Open the tab synchronously inside the click so the popup blocker
        // cannot reject it; its URL is assigned once the flow returns a code.
        popupRef.current = window.open("about:blank", "_blank");
        if (!popupRef.current) setPopupBlocked(true);
      }

      deviceFlow.start(host, source);
    },
    [deviceFlow, host, source],
  );

  const cancel = React.useCallback(() => {
    deviceFlow.reset();
    setPendingProvider(null);
    setPopupBlocked(false);
    closePopup();
  }, [closePopup, deviceFlow]);

  const retry = React.useCallback(() => {
    if (pendingProvider) startWithProvider(pendingProvider);
  }, [pendingProvider, startWithProvider]);

  const isBusy =
    deviceFlow.status === "starting" ||
    deviceFlow.status === "awaiting_authorization";

  return {
    status: deviceFlow.status,
    error: deviceFlow.error,
    verificationUrl: deviceFlow.verificationUrl,
    isBusy,
    popupBlocked,
    startWithProvider,
    cancel,
    retry,
  };
}

function CloudProviderButtons({
  onSelect,
  testIdRoot,
  className,
}: {
  onSelect: (provider: CloudLoginProvider) => void;
  testIdRoot: string;
  className?: string;
}) {
  const { t } = useTranslation("openhands");

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {CLOUD_LOGIN_PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          data-testid={`${testIdRoot}-provider-${id}`}
          className={cn(
            "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border",
            "bg-surface-raised px-4 py-3 text-sm font-medium text-contrast",
            "transition-colors hover:bg-interactive-hover",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          )}
        >
          <Icon className="size-4.5" />
          {t(I18nKey.CLOUD_LOGIN$LOG_IN_WITH, { provider: label })}
        </button>
      ))}
    </div>
  );
}

interface CloudLoginStatusProps {
  testIdRoot: string;
  status: string;
  error: string | null;
  verificationUrl: string | null;
  popupBlocked: boolean;
  onCancel: () => void;
  onRetry: () => void;
}

/** In-progress / failed device-flow feedback shown in place of the buttons. */
function CloudLoginStatus({
  testIdRoot,
  status,
  error,
  verificationUrl,
  popupBlocked,
  onCancel,
  onRetry,
}: CloudLoginStatusProps) {
  const { t } = useTranslation("openhands");

  if (status === "error") {
    return (
      <div
        role="alert"
        data-testid={`${testIdRoot}-error`}
        className="flex w-full flex-col gap-3 rounded-lg border border-danger bg-canvas-base p-4"
      >
        <p className="text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          data-testid={`${testIdRoot}-retry`}
          className="w-full cursor-pointer rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-contrast transition-colors hover:bg-interactive-hover"
        >
          {t(I18nKey.BACKEND$AUTH_RETRY)}
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`${testIdRoot}-status`}
      className="flex w-full flex-col items-center gap-4"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-contrast"
        />
        <span className="text-sm font-medium text-contrast">
          {status === "starting"
            ? t(I18nKey.BACKEND$AUTH_STARTING)
            : t(I18nKey.BACKEND$AUTH_AWAITING)}
        </span>
      </div>
      <p className="text-center text-sm leading-relaxed text-muted">
        {t(I18nKey.CLOUD_LOGIN$SECURE_BROWSER)}
      </p>
      {popupBlocked && verificationUrl ? (
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`${testIdRoot}-manual-link`}
          className="break-all text-center text-xs text-accent hover:underline"
        >
          {verificationUrl}
        </a>
      ) : null}
      <button
        type="button"
        onClick={onCancel}
        data-testid={`${testIdRoot}-cancel`}
        className="w-full cursor-pointer rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-contrast transition-colors hover:bg-interactive-hover"
      >
        {t(I18nKey.BACKEND$AUTH_CANCEL)}
      </button>
    </div>
  );
}

interface CloudLoginScreenProps {
  /** OpenHands Cloud origin the login is performed against. */
  host: string;
  /** Called with the API key once the device flow completes. */
  onAuthenticated: (apiKey: string) => void;
  source?: CloudConnectionSource;
  testIdRoot?: string;
}

/**
 * Full-screen Cloud sign-in, modelled on the hosted OpenHands `/login` page:
 * one button per Git provider, each sending the browser straight to that
 * provider's consent screen.
 *
 * The API key still comes from the OAuth 2.0 device flow — a native app cannot
 * receive the Keycloak redirect cookie — so the browser is pointed at the
 * provider with a device-verify redirect: once the provider authenticates the
 * user, Keycloak returns them to the device-verify page, they approve the
 * pending code, and the polling here picks up the token.
 */
export function CloudLoginScreen({
  host,
  onAuthenticated,
  source,
  testIdRoot = "cloud-login",
}: CloudLoginScreenProps) {
  const { t } = useTranslation("openhands");
  const login = useCloudLogin({ host, onAuthenticated, source });

  return (
    <main
      data-testid={`${testIdRoot}-screen`}
      className="flex min-h-screen items-center justify-center bg-base-secondary p-6"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <OpenHandsLogoWhite
            width={64}
            height={64}
            className="text-contrast [&_path:not([fill=transparent])]:fill-current"
            aria-hidden
          />
          <h1
            className="text-center text-2xl font-medium text-contrast"
            data-testid={`${testIdRoot}-title`}
          >
            {t(I18nKey.CLOUD_LOGIN$TITLE)}
          </h1>
          <p className="text-center text-sm leading-relaxed text-muted">
            {t(I18nKey.CLOUD_LOGIN$SUBTITLE)}
          </p>
        </div>

        {login.isBusy || login.status === "error" ? (
          <CloudLoginStatus
            testIdRoot={testIdRoot}
            status={login.status}
            error={login.error}
            verificationUrl={login.verificationUrl}
            popupBlocked={login.popupBlocked}
            onCancel={login.cancel}
            onRetry={login.retry}
          />
        ) : (
          <CloudProviderButtons
            testIdRoot={testIdRoot}
            onSelect={login.startWithProvider}
          />
        )}

        <p className="text-center text-xs text-text-dim">
          {t(I18nKey.CLOUD_LOGIN$ONCE_PER_DEVICE)}
        </p>
      </div>
    </main>
  );
}
