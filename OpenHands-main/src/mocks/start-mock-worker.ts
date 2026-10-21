/**
 * How long startup will wait for the mock service worker to report back.
 *
 * `worker.start()` resolves only after the worker has activated *and* answered
 * its `MOCK_ACTIVATE` handshake. Neither step is bounded: a worker that
 * registers but never activates, or activates but never replies, leaves the
 * promise pending forever. That is not hypothetical — Capacitor's Android
 * WebView is such an environment, and the app rendered a blank screen because
 * `prepareApp()` awaited that promise before calling `hydrateRoot`.
 */
export const MOCK_WORKER_START_TIMEOUT_MS = 4000;

export type MockWorkerOutcome = "worker" | "fallback";

/**
 * Start the mock service worker, but never let it block startup.
 *
 * Resolves `"worker"` when the worker came up. Otherwise — it rejected, or it
 * did not report back within `timeoutMs` — installs the in-process fallback and
 * resolves `"fallback"`. A worker that finishes starting *after* the fallback
 * was installed is stopped, so the two transports cannot both handle requests.
 */
export async function startMockWorkerWithFallback({
  startWorker,
  installFallback,
  stopWorker,
  timeoutMs = MOCK_WORKER_START_TIMEOUT_MS,
  warn = console.warn,
}: {
  startWorker: () => Promise<unknown>;
  installFallback: () => void;
  stopWorker?: () => void;
  timeoutMs?: number;
  warn?: (...args: unknown[]) => void;
}): Promise<MockWorkerOutcome> {
  const startResult = startWorker().then(
    () => "worker" as const,
    (error: unknown) => {
      warn("Mock service worker did not start:", error);
      return "error" as const;
    },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  const outcome = await Promise.race([startResult, timedOut]);
  if (timer !== undefined) clearTimeout(timer);

  if (outcome === "worker") return "worker";

  if (outcome === "timeout") {
    warn(
      `Mock service worker did not activate within ${timeoutMs}ms; serving mock responses in-process instead.`,
    );
    void startResult.then((late) => {
      if (late === "worker") stopWorker?.();
    });
  }

  installFallback();
  return "fallback";
}
