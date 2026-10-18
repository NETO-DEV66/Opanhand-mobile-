import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "#/mocks/node";
import { setRegisteredBackends } from "#/api/backend-registry/active-store";
import type { Backend } from "#/api/backend-registry/types";

// A local backend is what most suites implicitly assume: `getEffectiveLocalBackend()`
// throws `NoBackendAvailableError` when the registry is empty, and jsdom starts
// with no `openhands-backends` entry and no launcher-supplied host/API key to
// seed one. Registering one here matches the deployed app (which always has a
// backend the user picked) without touching the network — MSW answers the calls.
const TEST_BACKEND: Backend = {
  id: "test-local",
  name: "Local",
  host: "http://127.0.0.1:8000",
  apiKey: "test-session-key",
  kind: "local",
};

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  setRegisteredBackends([TEST_BACKEND]);
});

afterEach(() => {
  // Unmount first: React Testing Library mounts into a shared document, and
  // queries in the next test must not match nodes left behind by this one.
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
