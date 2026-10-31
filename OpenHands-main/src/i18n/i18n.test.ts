import { describe, expect, it } from "vitest";

import { createAgentServerI18n } from "./index";

describe("agent-server i18n", () => {
  it("does not suspend on a pending translation load", () => {
    // The startup path awaits `waitForI18n()` but races an 8s deadline. On a
    // slow device the deadline wins and the tree renders while the locale fetch
    // is still in flight; with react-i18next's default (`useSuspense: true`)
    // every `useTranslation()` suspends and React cannot hydrate the
    // prerendered shell, leaving a blank screen. This pins the opt-out.
    const instance = createAgentServerI18n();
    expect(instance.options.react?.useSuspense).toBe(false);
  });
});
