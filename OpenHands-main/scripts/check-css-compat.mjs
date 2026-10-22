/**
 * Fails if the shipped stylesheet uses a CSS feature that a supported WebView
 * drops *with its whole block*.
 *
 * This is the CSS half of the black-screen class. Tailwind v4 wraps every rule
 * in `@layer`, and cascade layers are Chrome 99+. An older WebView does not
 * know the at-rule, and the CSS spec says to drop an unknown at-rule together
 * with everything inside it - so the entire stylesheet contributes nothing. The
 * app still mounts, `document.body.innerText` is non-empty, and the
 * compatibility prelude's blank-page watchdog therefore stays silent: the user
 * gets a black screen with no notice.
 *
 * `scripts/flatten-css-layers.mjs` removes `@layer` at build time. This gate is
 * what notices if that step is ever skipped or undone, because a build flag is
 * a promise and the shipped file is the fact.
 *
 * Other post-floor features are reported as warnings: they drop *declarations*
 * or single rules rather than a whole sheet, so they degrade the UI without
 * blanking it, and failing the build on them would be disproportionate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const BUILD_DIR = fileURLToPath(new URL("../build", import.meta.url));

function collectStylesheets(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...collectStylesheets(path));
    } else if (entry.endsWith(".css")) {
      found.push(path);
    }
  }
  return found;
}

let files;
try {
  files = collectStylesheets(BUILD_DIR);
} catch {
  console.error(
    `No build output at ${BUILD_DIR}.\n` +
      "Run `npm run build:app` first - this gate inspects the shipped CSS.",
  );
  process.exit(1);
}

// At-rules whose block is dropped wholesale by an engine that does not know
// them. `@layer` is the one that costs the screen: Tailwind wraps every rule in
// it, so dropping it empties the entire stylesheet while the DOM still has text,
// which is what silences the blank-page watchdog.
const BLOCK_DROPPING = [
  { pattern: /@layer\b/, label: "@layer (cascade layers) - Chrome 99" },
];

// At-rules and declarations that are dropped in place or wrap only a few
// rules: the UI degrades, it does not blank. `@container` belongs here rather
// than above because Tailwind uses it only for the `@min-[..]` responsive
// utilities, so the rules lost are enhancements on top of a working layout.
// Flattening it would be wrong - a container query's rules must stay
// conditional - so the correct response is a warning, not a build failure.
const DEGRADING = [
  {
    pattern: /@container\b/,
    label: "@container (container queries) - Chrome 105",
  },
  { pattern: /color-mix\(/, label: "color-mix() - Chrome 111" },
  { pattern: /\boklch\(/, label: "oklch() - Chrome 111" },
  { pattern: /\blab\(|\blch\(/, label: "lab()/lch() - Chrome 111" },
  { pattern: /:has\(/, label: ":has() - Chrome 105" },
  { pattern: /light-dark\(/, label: "light-dark() - Chrome 123" },
  {
    pattern: /\d+dvh\b|\d+svh\b|\d+lvh\b/,
    label: "viewport units dvh/svh/lvh - Chrome 108",
  },
];

const failures = [];
const warnings = [];

for (const path of files) {
  const name = relative(BUILD_DIR, path);
  const source = readFileSync(path, "utf8");
  for (const { pattern, label } of BLOCK_DROPPING) {
    const count = (source.match(new RegExp(pattern.source, "g")) || []).length;
    if (count > 0) failures.push({ name, label, count });
  }
  for (const { pattern, label } of DEGRADING) {
    const count = (source.match(new RegExp(pattern.source, "g")) || []).length;
    if (count > 0) warnings.push({ name, label, count });
  }
}

for (const w of warnings) {
  console.warn(`warning: ${w.name} uses ${w.label} in ${w.count} place(s)`);
}
if (warnings.length) {
  console.warn(
    "  These drop in place, so the UI degrades instead of blanking. Fix only if a specific surface looks wrong.",
  );
}

if (failures.length) {
  console.error(
    "\nCSS features that blank the screen on the supported WebView:",
  );
  for (const f of failures) {
    console.error(`  ${f.name}: ${f.label} in ${f.count} place(s)`);
  }
  console.error(
    "\nRun `npm run flatten:css` (part of `npm run build:app`) and re-check.",
  );
  process.exit(1);
}

console.log(
  `CSS compatibility OK: ${files.length} stylesheet(s), no block-dropping at-rules.`,
);
