/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { HydratedRouter } from "react-router/dom";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { AgentServerUIProviders } from "./components/providers";
import { installMarsWebBridge } from "./api/mars/mars-web-bridge";
import { waitForI18n } from "./i18n";
import { shouldStartMockWorker } from "./mocks/should-start-mock-worker";
import { startMockWorkerWithFallback } from "./mocks/start-mock-worker";

async function prepareApp() {
  // DigitalOcean Managed Agents in the browser: present only when the server
  // this page came from hosts the MARS bridge (scripts/mars-web-bridge.mjs).
  // Must settle before render — the UI reads `window.marsBridge` synchronously.
  await Promise.all([waitForI18n(), installMarsWebBridge()]);

  if (import.meta.env.DEV || import.meta.env.VITE_MOCK_API === "true") {
    // The socket shim must be in place before the first request: a service
    // worker cannot intercept a WebSocket, and Capacitor's Android WebView has
    // no usable service worker at all.
    const { installInProcessFetch, installLocalRuntime } =
      await import("./local-runtime");
    installLocalRuntime();

    if (shouldStartMockWorker()) {
      const { worker } = await import("./mocks/browser");

      // Never await the worker unbounded: a WebView that registers the worker
      // but never activates it would otherwise hang startup forever and the
      // app would render nothing. The helper falls back to the in-process
      // handlers when the worker does not come up in time.
      await startMockWorkerWithFallback({
        startWorker: () => worker.start({ onUnhandledRequest: "bypass" }),
        installFallback: installInProcessFetch,
        stopWorker: () => worker.stop(),
      });
    }
  }

  if (import.meta.env.DEV) {
    const { installPendingChatPreview } =
      await import("./dev/seed-pending-chat-preview");
    installPendingChatPreview();
  }
}

prepareApp().then(() =>
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <AgentServerUIProviders
          // Analytics off: this build must not contact OpenHands' telemetry
          // endpoint (z.openhands.dev). Passing `false` means PostHog is never
          // initialized, so no install/session event leaves the device and the
          // consent banner is never shown.
          analytics={false}
          withStyleRoot={false}
        >
          <HydratedRouter />
        </AgentServerUIProviders>
      </StrictMode>,
    );
  }),
);
