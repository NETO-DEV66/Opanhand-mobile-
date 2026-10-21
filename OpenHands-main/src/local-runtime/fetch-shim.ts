import { getResponse } from "msw";
import { handlers } from "#/mocks/handlers";

let installed = false;

/**
 * Serve the mock REST handlers from inside the page, without a service worker.
 *
 * The service worker is the normal path, but it is not always available: some
 * Android WebViews refuse to register one, and a private-mode browser has no
 * service worker at all. Without a fallback the app would render against an
 * unmocked `fetch` and hang on its first request. This patches `window.fetch`
 * to resolve the same handler list in-process, and leaves anything no handler
 * matches to the native `fetch` (the `onUnhandledRequest: "bypass"` contract).
 */
export function installInProcessFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    let request: Request;
    try {
      request =
        input instanceof Request
          ? input.clone()
          : new Request(new URL(String(input), window.location.href), init);
    } catch {
      // A malformed request is the native fetch's error to report.
      return nativeFetch(input, init);
    }

    const response = await getResponse(handlers, request);
    if (response) return response;
    return nativeFetch(input, init);
  };
}
