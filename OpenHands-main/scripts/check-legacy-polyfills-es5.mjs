/**
 * Fails if `public/legacy-polyfills.js` is not pure ES5.
 *
 * This file is the one thing on the page that must run on the oldest WebView
 * the APK supports, so it has to parse there. Nothing else in the toolchain
 * enforces that:
 *
 *   - `vite build` does not touch `public/` - the file is copied verbatim.
 *   - `build.target` applies to the bundled modules, not to this file.
 *   - prettier happily rewrites it with `trailingComma: "all"` and
 *     `arrowParens: "always"`, i.e. ES2017 syntax (see .prettierignore).
 *   - the browser-based check cannot see the problem either: it deletes
 *     *globals* but still parses with a modern engine, which accepts ES2017.
 *
 * A parse error here is silent and total: the WebView discards the whole file,
 * the TextEncoderStream shim never installs, react-router's inline bootstrap
 * throws, and the app shows a black screen with an empty console.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const FILE = fileURLToPath(
  new URL("../public/legacy-polyfills.js", import.meta.url),
);

const source = readFileSync(FILE, "utf8");

try {
  parse(source, { ecmaVersion: 5, sourceType: "script" });
} catch (error) {
  const position = error.pos ?? 0;
  const before = source.slice(0, position);
  const line = before.split("\n").length;
  const excerpt = source
    .slice(Math.max(0, position - 70), position + 30)
    .replace(/\n/g, "\\n");

  console.error(
    `public/legacy-polyfills.js is not ES5 (line ${line}): ${error.message}\n` +
      `  near: ${excerpt}\n` +
      "An old WebView would discard the whole prelude and show a black screen.\n" +
      "Rewrite the offending construct without ES2015+ syntax " +
      "(no trailing commas in argument lists, no arrow functions, no const/let).",
  );
  process.exit(1);
}

console.log("public/legacy-polyfills.js parses as ES5.");
