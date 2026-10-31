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
  const usesMockRuntime =
    import.meta.env.DEV || import.meta.env.VITE_MOCK_API === "true";

  // Install the in-process transport first. It is a local module (no network),
  // and it is what makes every request answerable. If the startup deadline
  // below fires while the i18n fetch is still in flight, the UI rendered then
  // must already have a transport, or it shows a spurious "no backend" screen.
  //
  // The socket shim must also be in place before the first request: a service
  // worker cannot intercept a WebSocket, and Capacitor's Android WebView has no
  // usable service worker at all.
  const mockRuntime = usesMockRuntime ? await import("./local-runtime") : null;
  mockRuntime?.installLocalRuntime();

  // DigitalOcean Managed Agents in the browser: present only when the server
  // this page came from hosts the MARS bridge (scripts/mars-web-bridge.mjs).
  // Must settle before render — the UI reads `window.marsBridge` synchronously.
  // Both steps resolve rather than reject on the paths that matter, but nothing
  // here is worth a blank screen, so a throw is contained below.
  // The mock worker and i18n both gate the first render, and neither is worth
  // serialising: run them together so a slow locale fetch cannot delay the
  // transport (and vice versa). The worker path is bounded internally (4s), so
  // a WebView that never activates the worker cannot hold up i18n.
  const startTransport = async () => {
    if (!usesMockRuntime || !shouldStartMockWorker()) return;
    const { worker } = await import("./mocks/browser");

    // Never await the worker unbounded: a WebView that registers the worker
    // but never activates it would otherwise hang startup forever and the
    // app would render nothing. The helper falls back to the in-process
    // handlers when the worker does not come up in time.
    await startMockWorkerWithFallback({
      startWorker: () => worker.start({ onUnhandledRequest: "bypass" }),
      installFallback: () => mockRuntime?.installInProcessFetch(),
      stopWorker: () => worker.stop(),
    });
  };

  await Promise.all([
    waitForI18n(),
    installMarsWebBridge(),
    startTransport(),
  ]);

  if (import.meta.env.DEV) {
    const { installPendingChatPreview } = await import(
      "./dev/seed-pending-chat-preview"
    );
    installPendingChatPreview();
  }
}

/**
 * Hydrate, and never leave the screen empty because startup failed.
 *
 * `prepareApp()` is best-effort preparation: the mock transport, the local
 * runtime shims, the MARS bridge. None of it is required to *mount* the app, and
 * there are two distinct ways it can fail to hand over:
 *
 *  - It *rejects* (a WebView missing an API a dependency calls at import time,
 *    say). The `.catch` below covers that; the previous `.then()` form skipped
 *    `hydrateRoot` entirely and left a black screen with nothing on the page to
 *    report one.
 *  - It *hangs*. Nothing catches a promise that never settles, so `hydrateRoot`
 *    would never run and the result is the same black screen, this time with an
 *    empty console. i18next's HTTP backend is the realistic candidate: it
 *    fetches `locales/*.json`, and a request that never settles (captive portal,
 *    flaky radio, a WebView that drops it) leaves the promise pending forever.
 *
 * So preparation races a deadline and render runs exactly once, whichever
 * finishes first. A working UI whose first request failed beats no UI at all.
 */
const STARTUP_DEADLINE_MS = 8000;

let rendered = false;

function renderApp() {
  if (rendered) return;
  rendered = true;

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
  });
}

const startupDeadline = setTimeout(() => {
  console.warn(
    `App preparation did not finish within ${STARTUP_DEADLINE_MS}ms; rendering anyway.`,
  );
  renderApp();
}, STARTUP_DEADLINE_MS);

prepareApp()
  .catch((error: unknown) => {
    console.error("App preparation failed; rendering anyway.", error);
  })
  .then(() => {
    clearTimeout(startupDeadline);
    renderApp();
  });
