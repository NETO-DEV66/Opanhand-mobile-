import { describe, expect, it, vi } from "vitest";
import { startMockWorkerWithFallback } from "./start-mock-worker";

const noop = () => {};

describe("startMockWorkerWithFallback", () => {
  it("reports 'worker' when the worker starts promptly", async () => {
    const installFallback = vi.fn();

    const outcome = await startMockWorkerWithFallback({
      startWorker: async () => undefined,
      installFallback,
      warn: noop,
    });

    expect(outcome).toBe("worker");
    expect(installFallback).not.toHaveBeenCalled();
  });

  it("falls back when registration rejects", async () => {
    const installFallback = vi.fn();
    const warn = vi.fn();

    const outcome = await startMockWorkerWithFallback({
      startWorker: async () => {
        throw new Error("service workers are not supported");
      },
      installFallback,
      warn,
    });

    expect(outcome).toBe("fallback");
    expect(installFallback).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it("falls back instead of hanging when the worker never reports back", async () => {
    const installFallback = vi.fn();
    const warn = vi.fn();

    // The Capacitor WebView case: `worker.start()` never settles.
    const outcome = await startMockWorkerWithFallback({
      startWorker: () => new Promise<never>(() => {}),
      installFallback,
      timeoutMs: 10,
      warn,
    });

    expect(outcome).toBe("fallback");
    expect(installFallback).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it("stops a worker that starts only after the fallback took over", async () => {
    const installFallback = vi.fn();
    const stopWorker = vi.fn();

    const outcome = await startMockWorkerWithFallback({
      startWorker: () =>
        new Promise<void>((resolve) => setTimeout(resolve, 20)),
      installFallback,
      stopWorker,
      timeoutMs: 5,
      warn: noop,
    });

    expect(outcome).toBe("fallback");
    expect(installFallback).toHaveBeenCalledTimes(1);

    // The late worker must not stay alive alongside the in-process handlers.
    await vi.waitFor(() => expect(stopWorker).toHaveBeenCalledTimes(1));
  });

  it("leaves a late-starting worker alone once the fallback is installed", async () => {
    const stopWorker = vi.fn();

    await startMockWorkerWithFallback({
      startWorker: () => Promise.reject(new Error("nope")),
      installFallback: noop,
      stopWorker,
      warn: noop,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopWorker).not.toHaveBeenCalled();
  });
});
