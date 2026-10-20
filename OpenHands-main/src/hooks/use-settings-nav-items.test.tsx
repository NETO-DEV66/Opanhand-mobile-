import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCKED_CLOUD_SETTINGS_NAV_PATH } from "#/constants/settings-nav";
import { useSettingsNavItems } from "./use-settings-nav-items";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function navPaths(): string[] {
  return renderHook(() => useSettingsNavItems(), { wrapper })
    .result.current.filter((entry) => entry.type === "item")
    .map((entry) => (entry as { item: { to: string } }).item.to);
}

function setNativeShell(native: boolean) {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => native,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("useSettingsNavItems", () => {
  it("lists every settings page for an unlocked build", () => {
    vi.stubEnv("VITE_LOCK_TO_CLOUD", "off");

    const paths = navPaths();

    expect(paths).toContain(LOCKED_CLOUD_SETTINGS_NAV_PATH);
    expect(paths).toContain("/settings/agents");
    expect(paths.length).toBeGreaterThan(1);
  });

  it("lists only the Application page when locked to Cloud in a browser", () => {
    vi.stubEnv("VITE_LOCK_TO_CLOUD", "https://app.all-hands.dev");

    expect(navPaths()).toEqual([LOCKED_CLOUD_SETTINGS_NAV_PATH]);
  });

  it("keeps the in-app settings pages in the native shell", () => {
    vi.stubEnv("VITE_LOCK_TO_CLOUD", "https://app.all-hands.dev");
    setNativeShell(true);

    const paths = navPaths();

    expect(paths).toContain("/settings/agents");
    expect(paths.length).toBeGreaterThan(1);
  });
});
