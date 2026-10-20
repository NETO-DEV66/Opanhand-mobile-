import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test-utils";
import { CloudSettingsLink } from "./cloud-settings-link";
import { IntegrationsSettingsLink } from "./integrations-settings-link";

const { isNativeShellMock, activeBackend } = vi.hoisted(() => ({
  isNativeShellMock: vi.fn(),
  activeBackend: {
    backend: {
      id: "cloud-ohe",
      name: "OpenHands Cloud",
      host: "https://app.all-hands.dev",
      kind: "cloud" as const,
    },
    orgId: "org-1",
  },
}));

vi.mock("#/api/native-shell", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/api/native-shell")>()),
  isNativeShell: isNativeShellMock,
}));

vi.mock("#/contexts/active-backend-context", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("#/contexts/active-backend-context")
  >()),
  useActiveBackendContext: () => ({ active: activeBackend }),
}));

afterEach(() => vi.clearAllMocks());

describe("CloudSettingsLink", () => {
  it("links to the Cloud host's settings page in a browser", () => {
    isNativeShellMock.mockReturnValue(false);

    renderWithProviders(<CloudSettingsLink />);

    expect(screen.getByTestId("settings-cloud-link")).toHaveAttribute(
      "href",
      "https://app.all-hands.dev/settings?org=org-1",
    );
  });

  it("renders nothing in the native shell so no browser opens", () => {
    isNativeShellMock.mockReturnValue(true);

    renderWithProviders(<CloudSettingsLink />);

    expect(screen.queryByTestId("settings-cloud-link")).toBeNull();
  });
});

describe("IntegrationsSettingsLink", () => {
  it("links to the Cloud host's integrations page in a browser", () => {
    isNativeShellMock.mockReturnValue(false);

    renderWithProviders(<IntegrationsSettingsLink />);

    expect(screen.getByTestId("settings-integrations-link")).toHaveAttribute(
      "href",
      "https://app.all-hands.dev/settings/integrations?org=org-1",
    );
  });

  it("renders nothing in the native shell so no browser opens", () => {
    isNativeShellMock.mockReturnValue(true);

    renderWithProviders(<IntegrationsSettingsLink />);

    expect(screen.queryByTestId("settings-integrations-link")).toBeNull();
  });
});
