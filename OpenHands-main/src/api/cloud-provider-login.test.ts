import { describe, expect, it } from "vitest";
import {
  buildCloudProviderLoginUrl,
  deviceVerifyPathFromVerificationUrl,
  getCloudAuthOrigin,
  isNativeShell,
} from "./cloud-provider-login";

describe("getCloudAuthOrigin", () => {
  it("uses the auth sibling of the cloud host", () => {
    expect(getCloudAuthOrigin("https://app.all-hands.dev")).toBe(
      "https://auth.app.all-hands.dev",
    );
    expect(getCloudAuthOrigin("https://canvas.openhands.dev")).toBe(
      "https://auth.canvas.openhands.dev",
    );
  });

  it("falls back to the staging realm for a localhost dev origin", () => {
    expect(getCloudAuthOrigin("https://localhost")).toBe(
      "https://auth.staging.all-hands.dev",
    );
    expect(getCloudAuthOrigin("http://127.0.0.1:8000")).toBe(
      "https://auth.staging.all-hands.dev",
    );
  });

  it("falls back to the hosted realm when the host is unparseable", () => {
    expect(getCloudAuthOrigin("not a url")).toBe(
      "https://auth.app.all-hands.dev",
    );
  });
});

describe("buildCloudProviderLoginUrl", () => {
  const url = buildCloudProviderLoginUrl(
    "https://app.all-hands.dev",
    "github",
    "/oauth/device/verify?user_code=AB12CD34",
  );
  const parsed = new URL(url);

  it("points at the Keycloak realm authorization endpoint", () => {
    expect(parsed.origin).toBe("https://auth.app.all-hands.dev");
    expect(parsed.pathname).toBe(
      "/realms/allhands/protocol/openid-connect/auth",
    );
  });

  it("hints the selected provider so the picker is skipped", () => {
    expect(parsed.searchParams.get("kc_idp_hint")).toBe("github");
    expect(parsed.searchParams.get("client_id")).toBe("allhands");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
  });

  it("redirects the callback back to the cloud host", () => {
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.all-hands.dev/oauth/keycloak/callback",
    );
  });

  it("encodes the device-verify path in the OAuth state", () => {
    const state = JSON.parse(atob(parsed.searchParams.get("state") ?? "")) as {
      redirect_url: string;
    };
    expect(state.redirect_url).toBe("/oauth/device/verify?user_code=AB12CD34");
  });

  it("carries each provider's hint", () => {
    for (const provider of ["gitlab", "bitbucket"] as const) {
      const p = new URL(
        buildCloudProviderLoginUrl("https://app.all-hands.dev", provider, "/x"),
      );
      expect(p.searchParams.get("kc_idp_hint")).toBe(provider);
    }
  });
});

describe("deviceVerifyPathFromVerificationUrl", () => {
  it("keeps the path and query, dropping the origin", () => {
    expect(
      deviceVerifyPathFromVerificationUrl(
        "https://app.all-hands.dev/oauth/device/verify?user_code=XYZ",
      ),
    ).toBe("/oauth/device/verify?user_code=XYZ");
  });

  it("returns the input unchanged when it is not a URL", () => {
    expect(deviceVerifyPathFromVerificationUrl("/oauth/device/verify")).toBe(
      "/oauth/device/verify",
    );
  });
});

describe("isNativeShell", () => {
  it("is false in a plain browser", () => {
    expect(isNativeShell()).toBe(false);
  });

  it("is true when Capacitor reports a native platform", () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    try {
      expect(isNativeShell()).toBe(true);
    } finally {
      delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    }
  });
});
