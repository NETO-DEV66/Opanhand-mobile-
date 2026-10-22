import { describe, expect, it } from "vitest";
import { flatten } from "../../scripts/flatten-css-layers.mjs";

/**
 * Tailwind v4 emits every rule inside `@layer`. Cascade layers are Chrome 99+,
 * and an engine that does not know the at-rule drops the whole block, which
 * leaves the app mounted, text present in the DOM, and nothing painted. Because
 * `document.body.innerText` is then non-empty, the compatibility prelude's
 * blank-page watchdog stays silent and the user gets a black screen with no
 * notice. `scripts/flatten-css-layers.mjs` removes the wrapper at build time.
 */
describe("flatten-css-layers", () => {
  it("removes the layer wrapper and keeps its declarations", () => {
    const { css, removed } = flatten("@layer utilities{.a{color:red}}");
    expect(removed).toBe(1);
    expect(css).not.toContain("@layer");
    expect(css).toContain(".a");
    expect(css).toContain("color:red");
  });

  it("keeps declaration order, so cascade order is unchanged", () => {
    const { css } = flatten(
      "@layer base{.a{color:red}}@layer utilities{.a{color:blue}}",
    );
    expect(css.indexOf("color:red")).toBeLessThan(css.indexOf("color:blue"));
  });

  it("flattens nested layers too", () => {
    const { css } = flatten("@layer a{@layer b{.x{color:green}}}");
    expect(css).not.toContain("@layer");
    expect(css).toContain("color:green");
  });

  it("drops the declaration-only form that establishes order", () => {
    const { css, removed } = flatten("@layer a, b;.x{color:red}");
    expect(removed).toBe(1);
    expect(css).not.toContain("@layer");
    expect(css).toContain("color:red");
  });

  it("leaves a stylesheet with no layers untouched", () => {
    const input = ".a{color:red}";
    const { css, removed } = flatten(input);
    expect(removed).toBe(0);
    expect(css).toBe(input);
  });

  it("does not disturb @media, @supports or @property", () => {
    const { css } = flatten(
      "@property --x{syntax:'<color>';inherits:false}@media (min-width:1px){@supports (color:red){.a{color:red}}}",
    );
    expect(css).toContain("@property");
    expect(css).toContain("@media");
    expect(css).toContain("@supports");
  });
});
