import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudLoginScreen } from "./cloud-login-screen";

const { startDeviceFlowMock, pollForTokenMock } = vi.hoisted(() => ({
  startDeviceFlowMock: vi.fn(),
  pollForTokenMock: vi.fn(),
}));

vi.mock("#/api/device-flow-client", async () => {
  const actual = await vi.importActual<
    typeof import("#/api/device-flow-client")
  >("#/api/device-flow-client");
  return {
    ...actual,
    startDeviceFlow: startDeviceFlowMock,
    pollForToken: pollForTokenMock,
  };
});

const VERIFICATION_URL =
  "https://app.all-hands.dev/oauth/device/verify?user_code=AB12CD34";

/** Popup handles handed out by the stubbed `window.open`, in call order. */
let openedWindows: { location: { href: string }; close: () => void }[] = [];
const openMock = vi.fn();

beforeEach(() => {
  startDeviceFlowMock.mockResolvedValue({
    device_code: "device-code",
    user_code: "AB12CD34",
    verification_uri: "https://app.all-hands.dev/oauth/device/verify",
    verification_uri_complete: VERIFICATION_URL,
    expires_in: 600,
    interval: 5,
  });
  openMock.mockReset();
  openedWindows = [];
  vi.stubGlobal("open", (...args: unknown[]) => {
    openMock(...args);
    const popup = { location: { href: "" }, close: vi.fn() };
    openedWindows.push(popup);
    return popup as unknown as Window;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CloudLoginScreen", () => {
  it("offers the three hosted git providers", () => {
    render(
      <CloudLoginScreen
        host="https://app.all-hands.dev"
        onAuthenticated={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("cloud-login-provider-github"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cloud-login-provider-gitlab"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cloud-login-provider-bitbucket"),
    ).toBeInTheDocument();
  });

  it("starts the device flow and opens the provider consent screen for the clicked provider", async () => {
    // Keep the flow parked on the authorization step so the assertion targets
    // the browser hand-off rather than the token exchange.
    pollForTokenMock.mockReturnValue(new Promise(() => {}));

    render(
      <CloudLoginScreen
        host="https://app.all-hands.dev"
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("cloud-login-provider-gitlab"));

    await waitFor(() =>
      expect(startDeviceFlowMock).toHaveBeenCalledWith(
        "https://app.all-hands.dev",
      ),
    );

    // The pre-opened tab is navigated to the GitLab-hinted Keycloak URL.
    await waitFor(() => expect(openedWindows).toHaveLength(1));
    await waitFor(() => expect(openedWindows[0].location.href).not.toBe(""));
    const consentUrl = new URL(openedWindows[0].location.href);
    expect(consentUrl.searchParams.get("kc_idp_hint")).toBe("gitlab");
    expect(consentUrl.searchParams.get("redirect_uri")).toBe(
      "https://app.all-hands.dev/oauth/keycloak/callback",
    );
    const state = JSON.parse(
      atob(consentUrl.searchParams.get("state") ?? ""),
    ) as { redirect_url: string };
    expect(state.redirect_url).toBe("/oauth/device/verify?user_code=AB12CD34");
  });

  it("reports the API key once the device flow succeeds", async () => {
    pollForTokenMock.mockResolvedValue({
      access_token: "cloud-api-key",
      token_type: "Bearer",
    });
    const onAuthenticated = vi.fn();

    render(
      <CloudLoginScreen
        host="https://app.all-hands.dev"
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.click(screen.getByTestId("cloud-login-provider-github"));

    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith("cloud-api-key"),
    );
  });

  it("shows the awaiting status while the user authorizes in the browser", async () => {
    pollForTokenMock.mockReturnValue(new Promise(() => {}));

    render(
      <CloudLoginScreen
        host="https://app.all-hands.dev"
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("cloud-login-provider-github"));

    expect(await screen.findByTestId("cloud-login-status")).toBeInTheDocument();
  });

  it("surfaces an error with a retry affordance when the flow cannot start", async () => {
    startDeviceFlowMock.mockRejectedValue(new Error("network down"));

    render(
      <CloudLoginScreen
        host="https://app.all-hands.dev"
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("cloud-login-provider-github"));

    const error = await screen.findByTestId("cloud-login-error");
    expect(error).toHaveTextContent("network down");
    expect(screen.getByTestId("cloud-login-retry")).toBeInTheDocument();
  });
});
