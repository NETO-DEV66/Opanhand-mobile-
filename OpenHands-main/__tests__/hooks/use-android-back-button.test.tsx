import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useAndroidBackButton } from "#/hooks/use-android-back-button";

type BackListener = (event: { canGoBack: boolean }) => void;

/**
 * Install a fake `window.Capacitor` shaped like the real Android bridge.
 *
 * `sync` selects how `addListener` hands back the listener handle: the Android
 * native bridge returns the `{ remove }` object directly, while the
 * `@capacitor/app` JS implementation resolves it through a Promise. Both must
 * work — the hook used to assume a Promise and threw
 * `addListener(...).then is not a function` on the device.
 */
function installNativeShell({ sync = true }: { sync?: boolean } = {}) {
  const listeners: BackListener[] = [];
  const exitApp = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);

  (
    window as unknown as {
      Capacitor: {
        isNativePlatform: () => boolean;
        Plugins: {
          App: {
            addListener: (
              event: string,
              listener: BackListener,
            ) =>
              | { remove: () => Promise<void> }
              | Promise<{ remove: () => Promise<void> }>;
            exitApp: () => Promise<void>;
          };
        };
      };
    }
  ).Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      App: {
        addListener: (_event, listener) => {
          listeners.push(listener);
          const handle = { remove };
          return sync ? handle : Promise.resolve(handle);
        },
        exitApp,
      },
    },
  };

  return { listeners, exitApp, remove };
}

function Home() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function Harness() {
  useAndroidBackButton();
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Home />} />
    </Routes>
  );
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={["/", initialPath]}>
      <Harness />
    </MemoryRouter>,
  );
}

async function fireBack(listener: BackListener) {
  await act(async () => {
    listener({ canGoBack: true });
  });
}

describe("useAndroidBackButton", () => {
  beforeEach(() => {
    vi.spyOn(window.history, "replaceState");
    window.history.replaceState({ idx: 0 }, "");
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it("does nothing when not running inside the native shell", () => {
    const listenerSpy = vi.fn();
    (
      window as unknown as {
        Capacitor: { isNativePlatform: () => boolean; Plugins: unknown };
      }
    ).Capacitor = { isNativePlatform: () => false, Plugins: {} };

    renderAt("/settings");
    expect(listenerSpy).not.toHaveBeenCalled();
  });

  it("exits the app when there is no in-app history to go back to", async () => {
    const { listeners, exitApp } = installNativeShell();
    renderAt("/");

    // A fresh MemoryRouter entry carries no `idx` (or idx 0) — the app root.
    await fireBack(listeners[0]);

    expect(exitApp).toHaveBeenCalledOnce();
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("navigates back one route when the router has history", async () => {
    const { listeners, exitApp } = installNativeShell();
    window.history.replaceState({ idx: 2 }, "");
    renderAt("/settings");

    await fireBack(listeners[0]);

    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("exits immediately when the step-back setting is turned off", async () => {
    const { listeners, exitApp } = installNativeShell();
    window.localStorage.setItem(
      "openhands.android-back-button-step-back",
      "false",
    );
    window.history.replaceState({ idx: 5 }, "");
    renderAt("/settings");

    await fireBack(listeners[0]);

    expect(exitApp).toHaveBeenCalledOnce();
    // The route must not move — Back left the app instead of navigating.
    expect(screen.getByTestId("path").textContent).toBe("/settings");
  });

  it("registers the listener when addListener returns the handle synchronously (Android bridge)", async () => {
    const { listeners, exitApp } = installNativeShell({ sync: true });
    renderAt("/settings");

    // The listener must actually be registered — a Promise-only assumption
    // threw here on the device and left Back doing nothing.
    expect(listeners).toHaveLength(1);

    window.history.replaceState({ idx: 3 }, "");
    await fireBack(listeners[0]);

    expect(exitApp).not.toHaveBeenCalled();
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("still supports the Promise-returning @capacitor/app JS implementation", async () => {
    const { listeners, exitApp } = installNativeShell({ sync: false });
    renderAt("/settings");

    expect(listeners).toHaveLength(1);
    await fireBack(listeners[0]);
    expect(exitApp).toHaveBeenCalledOnce();
  });

  it("removes the native listener on unmount", async () => {
    const { remove } = installNativeShell();
    const { unmount } = renderAt("/settings");

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(remove).toHaveBeenCalledOnce();
  });
});
