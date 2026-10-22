/**
 * Fails if any shipped app chunk needs syntax newer than the WebView floor.
 *
 * This is the gate for the *other* half of the v1.32.2 black screen. That
 * release shipped an ES2017-only prelude and, before it, ES2020-only chunks,
 * and both failed the same way: the WebView could not *parse* the file, so
 * nothing executed and the screen stayed black with an empty console. A syntax
 * floor is a property of the shipped artifact, and nothing upstream guarantees
 * it: a dependency can emit `?.` in its own source and Vite will only lower it
 * if `build.target` covers it, and a new plugin can bypass that.
 *
 * So this checks the build output itself, at the level the app declares support
 * for (Chrome 76 / ES2019). Run it after `react-router build`.
 *
 * `public/legacy-polyfills.js` is deliberately excluded: it must be ES5, and
 * `check-legacy-polyfills-es5.mjs` enforces that far stricter rule.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { parse } from "acorn";

const BUILD_DIR = fileURLToPath(new URL("../build", import.meta.url));

const ECOSYSTEM_LEVEL = 2019;

function collectJavaScript(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...collectJavaScript(path));
    } else if (entry.endsWith(".js")) {
      found.push(path);
    }
  }
  return found;
}

let files;
try {
  files = collectJavaScript(BUILD_DIR);
} catch {
  console.error(
    `No build output at ${BUILD_DIR}.\n` +
      "Run `npm run build:app` first - this gate inspects the shipped chunks, " +
      "not the source tree.",
  );
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No JavaScript in ${BUILD_DIR}; the build looks incomplete.`);
  process.exit(1);
}

// Parse as a script first, then as a module: chunks are scripts, but a file
// that happens to use top-level `await` or `import` would only fail the first.
//
// `ecmaVersion` is 2020, not 2019, because acorn gates *dynamic* `import()` -
// which Chrome has supported since 63 - behind ES2020. The constructs Chrome 76
// genuinely lacks are found by walking the AST below instead, which is precise
// where a version number is not.
function parseAny(source, sourceType) {
  return parse(source, {
    ecmaVersion: 2020,
    sourceType,
    allowReturnOutsideFunction: true,
  });
}

// Optional chaining and nullish coalescing are Chrome 80, logical assignment is
// Chrome 85. None of them can be lowered by a runtime shim, so a chunk that
// contains one cannot run on the WebView floor and must not ship.
function findTooNewSyntax(source) {
  let ast;
  try {
    ast = parseAny(source, "script");
  } catch (scriptError) {
    try {
      ast = parseAny(source, "module");
    } catch {
      return { message: scriptError.message, pos: scriptError.pos ?? 0 };
    }
  }

  let found = null;
  const visit = (node) => {
    if (!node || typeof node !== "object" || found) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === "ChainExpression") {
      found = { label: "optional chaining (`?.`) - Chrome 80", node };
    } else if (node.type === "LogicalExpression" && node.operator === "??") {
      found = { label: "nullish coalescing (`??`) - Chrome 80", node };
    } else if (
      node.type === "AssignmentExpression" &&
      (node.operator === "||=" ||
        node.operator === "&&=" ||
        node.operator === "??=")
    ) {
      found = { label: `logical assignment (\`${node.operator}\`) - Chrome 85`, node };
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end") continue;
      visit(node[key]);
    }
  };
  visit(ast);

  return found
    ? {
        message: `${found.label} needs syntax above ES2019`,
        pos: found.node.start,
      }
    : null;
}

const failures = [];
const warnings = [];

// `build/mockServiceWorker.js` is the one shipped script that is allowed to miss
// the floor. It is MSW's generated worker, it only runs when a service worker
// registers, and `startMockWorkerWithFallback` answers the same handlers
// in-process when registration fails - verified by the "service worker
// blocked/missing/throwing/hanging" cases in `verify-old-webview.mjs`. A parse
// error there costs nothing; the same error in an app chunk costs the screen.
for (const path of files) {
  const name = relative(BUILD_DIR, path);
  if (name.endsWith("legacy-polyfills.js")) continue;

  const source = readFileSync(path, "utf8");
  const error = findTooNewSyntax(source);
  if (!error) continue;

  const position = error.pos ?? 0;
  const line = source.slice(0, position).split("\n").length;
  const report =
    `${name} (line ${line}): ${error.message}\n` +
    `    near: ${source
      .slice(Math.max(0, position - 70), position + 30)
      .replace(/\n/g, "\\n")}`;

  if (name.includes("mockServiceWorker")) {
    warnings.push(report);
  } else {
    failures.push(report);
  }
}

if (failures.length > 0) {
  console.error(
    `${failures.length} shipped chunk(s) need syntax above ES${ECOSYSTEM_LEVEL} ` +
      "(Chrome 76), so an older Android System WebView cannot parse them and " +
      "the app will show a black screen with no error:\n\n" +
      failures.join("\n\n") +
      "\n\nLower it at the source, or widen `build.target` in vite.config.ts " +
      "if the floor really moved.",
  );
  process.exit(1);
}

for (const warning of warnings) {
  console.warn(
    `warning: ${warning}\n` +
      "    The mock service worker is optional (the app falls back in-process), " +
      "so this is not fatal.",
  );
}

console.log(
  `All app chunks parse at ES${ECOSYSTEM_LEVEL} (Chrome 76 floor).`,
);
