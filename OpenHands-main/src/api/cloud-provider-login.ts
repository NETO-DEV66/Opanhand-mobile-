/**
 * Provider deep links for the Cloud login screen.
 *
 * OpenHands Cloud authenticates through a Keycloak realm (`allhands`) that
 * brokers GitHub / GitLab / Bitbucket identities. The hosted `/login` page
 * builds the same URL these helpers build: it points the browser straight at
 * the realm's authorization endpoint with `kc_idp_hint` set to the chosen
 * provider, so the user lands on the provider's consent screen without an
 * intermediate provider picker.
 *
 * The device flow still mints the API key (a native app cannot receive the
 * Keycloak redirect cookie cross-origin); `state.redirect_url` therefore
 * sends the browser back to the device-verify page, where the signed-in user
 * approves the pending code and the app's polling picks up the token.
 */

import { isNativeShell } from "./native-shell";

export { isNativeShell };

export type CloudLoginProvider = "github" | "gitlab" | "bitbucket";

const KEYCLOAK_REALM = "allhands";
const KEYCLOAK_CLIENT_ID = "allhands";
const KEYCLOAK_SCOPE = "openid email profile";
/** Same callback the hosted app registers with the realm. */
const KEYCLOAK_REDIRECT_PATH = "/oauth/keycloak/callback";

/**
 * Keycloak lives on an `auth.` sibling of the app host — `auth.app.all-hands.dev`
 * for `app.all-hands.dev`, `auth.example.com` for `example.com`. A plain
 * localhost dev origin has no sibling realm, so it falls back to the hosted
 * staging realm the same way the hosted app does.
 */
export function getCloudAuthOrigin(cloudHost: string): string {
  try {
    const url = new URL(cloudHost);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return "https://auth.staging.all-hands.dev";
    }
    return `${url.protocol}//auth.${url.hostname}`;
  } catch {
    return "https://auth.app.all-hands.dev";
  }
}

function encodeState(redirectUrl: string): string {
  return btoa(JSON.stringify({ redirect_url: redirectUrl }));
}

/**
 * Build the Keycloak authorization URL that goes straight to `provider`.
 *
 * `deviceVerifyPath` is the in-app path the user should land on once the
 * provider has authenticated them (the device-verify page carrying the
 * `user_code`).
 */
export function buildCloudProviderLoginUrl(
  cloudHost: string,
  provider: CloudLoginProvider,
  deviceVerifyPath: string,
): string {
  const authOrigin = getCloudAuthOrigin(cloudHost);
  const redirectUri = `${cloudHost.replace(/\/+$/, "")}${KEYCLOAK_REDIRECT_PATH}`;
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    kc_idp_hint: provider,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: KEYCLOAK_SCOPE,
    state: encodeState(deviceVerifyPath),
  });

  return `${authOrigin}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?${params.toString()}`;
}

/**
 * The provider path a browser should visit after authenticating, derived from
 * the server-issued verification URL so the `user_code` always matches the
 * code the app is polling for.
 */
export function deviceVerifyPathFromVerificationUrl(
  verificationUrl: string,
): string {
  try {
    const url = new URL(verificationUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return verificationUrl;
  }
}

/**
 * Open `url` outside the app: the system browser on the native shell, a new
 * tab on the web.
 *
 * On native this deliberately navigates the top-level frame — the shell
 * intercepts the off-origin load and forwards it to the browser without
 * unloading the app. On the web a real popup is used so the app (which keeps
 * polling for the device token) stays alive; `popup` is the window opened
 * synchronously during the click, which is what keeps the popup unblocked
 * after an `await`.
 */
export function openExternalUrl(
  url: string,
  popup?: Window | null,
): Window | null {
  if (typeof window === "undefined") return null;

  let target = popup;

  if (isNativeShell()) {
    target?.close();
    window.location.assign(url);
    return null;
  }

  if (target && !target.closed) {
    try {
      target.location.href = url;
      return target;
    } catch {
      // Cross-origin handle we no longer control — fall through to a fresh open.
    }
  }

  target = window.open(url, "_blank", "noopener,noreferrer");
  return target;
}
