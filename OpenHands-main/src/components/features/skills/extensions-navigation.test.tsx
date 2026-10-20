import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test-utils";
import { NavigationProvider } from "#/context/navigation-context";
import { ExtensionsNavigation } from "./extensions-navigation";
import { ExtensionsMobileHub } from "./extensions-mobile-hub";

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
  useActiveBackendContext: () => ({ active: activeBackend, backends: [] }),
  useActiveBackend: () => activeBackend,
}));

const navigation = {
  currentPath: "/skills",
  conversationId: null,
  isNavigating: false,
  navigate: vi.fn(),
};

function renderInNavigation(ui: React.ReactElement) {
  return renderWithProviders(
    <NavigationProvider value={navigation}>{ui}</NavigationProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe("ExtensionsNavigation", () => {
  it("links Skills to the Cloud host's page in a browser", () => {
    isNativeShellMock.mockReturnValue(false);

    renderInNavigation(<ExtensionsNavigation />);

    expect(screen.getByTestId("sidebar-extensions-/skills")).toHaveAttribute(
      "href",
      "https://app.all-hands.dev/settings/skills",
    );
  });

  it("keeps Skills on the in-app route in the native shell", () => {
    isNativeShellMock.mockReturnValue(true);

    renderInNavigation(<ExtensionsNavigation />);

    // `/skills` resolves through the in-app router, not the Cloud host, so the
    // link must stay a relative anchor (no absolute cloud origin, no new tab).
    const link = screen.getByTestId("sidebar-extensions-/skills");
    expect(link).toHaveAttribute("href", "/skills");
    expect(link).not.toHaveAttribute("target", "_blank");
  });
});

describe("ExtensionsMobileHub", () => {
  it("links Skills to the Cloud host's page in a browser", () => {
    isNativeShellMock.mockReturnValue(false);

    renderInNavigation(<ExtensionsMobileHub />);

    expect(screen.getByTestId("sidebar-extensions-/skills")).toHaveAttribute(
      "href",
      "https://app.all-hands.dev/settings/skills",
    );
  });

  it("keeps Skills on the in-app route in the native shell", () => {
    isNativeShellMock.mockReturnValue(true);

    renderInNavigation(<ExtensionsMobileHub />);

    const link = screen.getByTestId("sidebar-extensions-/skills");
    expect(link).toHaveAttribute("href", "/skills");
    expect(link).not.toHaveAttribute("target", "_blank");
  });
});
