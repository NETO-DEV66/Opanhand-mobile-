import React from "react";
import { useNavigate } from "react-router";
import { isNativeShell } from "#/api/native-shell";
import { closeTopEscapeLayer } from "#/hooks/use-close-on-escape";
import { readAndroidBackButtonStepsBack } from "#/components/features/settings/app-settings/android-back-button-storage";

/**
 * Minimal shape of the `@capacitor/app` plugin as reached through the native
 * bridge. The plugin is not a JS dependency of the web app (Capacitor injects
 * `window.Capacitor` into the WebView), so it is typed here rather than
 * imported.
 */
interface BackButtonListenerHandle {
  remove: () => void | Promise<void>;
}

interface CapacitorAppPlugin {
  addListener: (
    eventName: "backButton",
    listenerFunc: (event: { canGoBack: boolean }) => void,
  ) => BackButtonListenerHandle | Promise<BackButtonListenerHandle>;
  exitApp: () => void | Promise<void>;
}

function getAppPlugin(): CapacitorAppPlugin | null {
  if (!isNativeShell()) return null;
  const capacitor = (
    window as unknown as {
      Capacitor?: { Plugins?: { App?: CapacitorAppPlugin } };
    }
  ).Capacitor;
  return capacitor?.Plugins?.App ?? null;
}

/**
 * Whether the in-app router has somewhere to go back to.
 *
 * React Router stores a monotonically increasing `idx` on the history entry;
 * `0` means the app is on its first in-app route, where BACK should leave the
 * app rather than loop. `idx` is absent on the very first load, which is also
 * treated as "at the root".
 */
function hasInAppHistory(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

/**
 * Route the Android hardware back button through the app.
 *
 * Order matches what a user expects from "one step back":
 *   1. close the topmost open overlay (menu, popover, dialog) — one per press;
 *   2. otherwise go back one route in the in-app history;
 *   3. otherwise, at the app root, exit the app.
 *
 * Registering the `backButton` listener also disables Capacitor's default
 * behaviour (finishing the activity on any press), which is what makes the
 * route/overlay handling above run at all.
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate();
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;

  React.useEffect(() => {
    const app = getAppPlugin();
    if (!app) return undefined;

    let disposed = false;
    let handle: BackButtonListenerHandle | null = null;

    // `@capacitor/app`'s JS implementation resolves a Promise, but the Android
    // native bridge injects a plugin whose `addListener` returns the handle
    // object directly. Accept either shape: assuming a Promise throws
    // `addListener(...).then is not a function` on the device and the listener
    // is never registered. A failure here must never reach the render tree —
    // an effect that throws unmounts the app and leaves a blank screen — so
    // the whole registration is guarded.
    let registered:
      | BackButtonListenerHandle
      | Promise<BackButtonListenerHandle>;
    try {
      registered = app.addListener("backButton", () => {
        // The setting can be flipped at any time; read it on each press rather
        // than capturing it when the listener was registered.
        if (!readAndroidBackButtonStepsBack()) {
          void app.exitApp();
          return;
        }

        // An open menu or dialog takes the press first, exactly like Escape.
        if (closeTopEscapeLayer()) return;

        if (hasInAppHistory()) {
          navigateRef.current(-1);
          return;
        }

        void app.exitApp();
      });
    } catch {
      return undefined;
    }

    if (registered instanceof Promise) {
      registered
        .then((resolved) => {
          // The listener may resolve after the effect was torn down (a fast
          // unmount); remove it immediately in that case so it cannot leak.
          if (disposed) {
            void resolved.remove();
          } else {
            handle = resolved;
          }
        })
        .catch(() => {
          // No native plugin (web build, or a shell without it): the browser's
          // own back handling applies and there is nothing to wire up.
        });
    } else {
      handle = registered;
    }

    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, []);
}
