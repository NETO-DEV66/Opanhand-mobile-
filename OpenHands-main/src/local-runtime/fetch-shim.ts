import { getResponse } from "msw";
import { BatchInterceptor } from "@mswjs/interceptors";
import { FetchInterceptor } from "@mswjs/interceptors/fetch";
import { XMLHttpRequestInterceptor } from "@mswjs/interceptors/XMLHttpRequest";
import { handlers } from "#/mocks/handlers";

let installed = false;

/**
 * Serve the mock REST handlers from inside the page, without a service worker.
 *
 * The service worker is the normal path, but it is not always available: some
 * Android WebViews refuse to register one, and a private-mode browser has no
 * service worker at all. It can also register and then never activate, in which
 * case `worker.start()` waits forever (see `mocks/start-mock-worker.ts`).
 * Without a fallback the app would render against an unmocked transport and
 * hang on its first request.
 *
 * Two transports need patching, not one:
 *
 * - `fetch`, which the agent-server SDK calls directly;
 * - `XMLHttpRequest`, which axios prefers in the browser (`defaults.adapter` is
 *   `["xhr", "http", "fetch"]`). Patching only `fetch` left the axios callers
 *   (the automation service, main-app auth) talking to the network, where the
 *   dev server answered `/api/...` with the SPA shell — a 200 that parses as
 *   neither JSON nor a valid automation response.
 *
 * `@mswjs/interceptors` already ships both patches (the same pair MSW applies
 * in its own no-service-worker fallback), so this reuses them rather than
 * re-implementing XHR by hand. Requests no handler matches are left to the
 * native transport, matching the `onUnhandledRequest: "bypass"` contract the
 * service worker path uses.
 */
export function installInProcessFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const interceptor = new BatchInterceptor({
    name: "openhands-local-runtime",
    interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()],
  });

  interceptor.on("request", async ({ request, controller }) => {
    const response = await getResponse(handlers, request);
    if (response) controller.respondWith(response);
    else await controller.passthrough();
  });

  interceptor.apply();
}
