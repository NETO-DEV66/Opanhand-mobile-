/*
 * Flatten CSS cascade layers in the built stylesheet.
 *
 * Tailwind v4 emits every rule inside `@layer` (properties, theme, base,
 * utilities). Cascade layers are Chrome 99+. An older WebView does not know the
 * at-rule, and the CSS spec says an unknown at-rule is dropped *with its entire
 * block* - so on those WebViews the app loads, mounts, and paints nothing:
 * text is in the DOM, the pixels are empty, and because `document.body.innerText`
 * is non-empty the compatibility prelude's blank-page watchdog stays silent.
 * The user sees a black screen with no notice.
 *
 * Flattening replaces `@layer name { ... }` with its contents, in document
 * order. Tailwind already writes the blocks in cascade order
 * (properties, theme, base, utilities), so on an engine without layers the
 * result has the same precedence. Engines that do support layers see the same
 * declarations, just without the layer wrapper - which also removes a source of
 * surprising specificity for the in-app theme override.
 *
 * Run after the web bundle is built, before `cap sync` copies it into the APK.
 */
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

async function findStylesheets(dir) {
  const found = [];
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    if ((await stat(path)).isDirectory()) {
      found.push(...(await findStylesheets(path)));
    } else if (path.endsWith(".css")) {
      found.push(path);
    }
  }
  return found;
}

function flatten(css) {
  const root = postcss.parse(css, { from: undefined });
  let removed = 0;

  // Innermost first: replacing a nested layer with its nodes re-parents them
  // into the outer layer, which a later pass then flattens too.
  const collect = (node, out) => {
    node.each((child) => {
      if (child.type === "atrule" && child.name === "layer") out.push(child);
      if (child.nodes) collect(child, out);
    });
  };

  let pass = 0;
  for (;;) {
    const layers = [];
    collect(root, layers);
    if (layers.length === 0) break;
    pass += 1;
    if (pass > 10) throw new Error("layer flattening did not converge");
    for (const layer of layers) {
      removed += 1;
      if (layer.nodes) {
        layer.replaceWith(layer.nodes);
      } else {
        // Declaration-only form: `@layer a, b;` establishes order, nothing else.
        layer.remove();
      }
    }
  }

  return { css: root.toString(), removed };
}

async function main() {
  const dir = process.argv[2] || "build";
  const targets = await findStylesheets(dir);
  let touched = 0;
  for (const path of targets) {
    const source = await readFile(path, "utf8");
    if (!source.includes("@layer")) continue;
    const { css, removed } = flatten(source);
    if (css.includes("@layer")) {
      throw new Error(`@layer survived flattening in ${path}`);
    }
    await writeFile(path, css);
    touched += 1;
    console.log(`flattened ${removed} layer block(s) in ${path}`);
  }
  console.log(
    touched === 0
      ? "no stylesheet used @layer; nothing to flatten"
      : `flattened ${touched} stylesheet(s)`,
  );
}

const invokedDirectly =
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { flatten, findStylesheets };
