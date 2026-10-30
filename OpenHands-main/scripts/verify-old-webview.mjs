/**
 * Guards the compatibility promise for old Android System WebViews.
 *
 * The shipped bundle once blanked the screen on devices whose WebView lacks the
 * modern globals the app imports at module scope. Nothing in the unit suite can
 * catch that: it is a property of the built bundle plus the prelude in <head>,
 * not of any one module. This script builds nothing and mocks nothing - it
 * serves the real `build/` output to a real Chromium with those globals removed
 * and asserts the app still mounts.
 *
 * Usage:
 *   npm run build && npx serve -s build -l 5500 &
 *   BASE=http://127.0.0.1:5500 node scripts/verify-old-webview.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const base = process.env.BASE || "http://127.0.0.1:5500";
const executablePath =
  process.env.CHROMIUM_PATH ||
  (process.env.CI ? undefined : "/usr/bin/chromium");

const MIN_VISIBLE = 50;

// Delete-the-globals alone is not a real old-WebView test. Chromium still
// *parses* with a modern engine, so ES2017 syntax in the prelude passes here and
// still black-screens on a device that cannot parse it. The prelude is therefore
// parsed at ES5 up front, which is the property the whole file exists for.
const preludePath = fileURLToPath(
  new URL("../public/legacy-polyfills.js", import.meta.url),
);
try {
  parse(readFileSync(preludePath, "utf8"), {
    ecmaVersion: 5,
    sourceType: "script",
  });
} catch (error) {
  console.error(
    `FAIL  public/legacy-polyfills.js is not ES5: ${error.message}\n` +
      "      An old WebView would discard it and show a black screen.",
  );
  process.exit(1);
}
console.log("ok    public/legacy-polyfills.js parses as ES5");

// Names are applied inside the page; a function map cannot
// cross the addInitScript boundary, so only the names are sent.
const ALL = [
  "ts",
  "tes",
  "sc",
  "uuid",
  "hasown",
  "at",
  "fromentries",
  "entries",
  "flat",
  "matchall",
  "pad",
];

const CASES = [
  {
    name: "old webview: every modern global missing",
    kill: ALL,
  },
  ...ALL.map((key) => ({
    name: `old webview: only ${key} missing`,
    kill: [key],
  })),
  {
    name: "old webview + service worker blocked",
    kill: ALL,
    context: { serviceWorkers: "block" },
  },
  {
    name: "old webview + no service worker API",
    kill: ALL,
    noServiceWorkerApi: true,
  },
  {
    name: "old webview + service worker throws",
    kill: ALL,
    serviceWorkerThrows: true,
  },
  {
    name: "old webview + service worker hangs",
    kill: ALL,
    serviceWorkerHangs: true,
    settleMs: 12000,
  },
];

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"],
});

let failed = 0;
try {
  for (const testCase of CASES) {
    const context = await browser.newContext(testCase.context || {});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) =>
      errors.push("PAGEERROR " + error.message.slice(0, 140)),
    );
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push("console: " + message.text().slice(0, 140));
      }
    });

    await page.addInitScript(
      ({
        kill,
        noServiceWorkerApi,
        serviceWorkerThrows,
        serviceWorkerHangs,
      }) => {
        // Each entry mirrors the Chrome floor the prelude documents.
        const remove = {
          ts: () => {
            // Chrome 67. The one that was missed: `ReadableStream` and
            // `WritableStream` arrived in Chrome 43 but `TransformStream` only
            // in 67, so a WebView in between has the native streams the shim
            // needs and no TransformStream. The bundle has `class extends
            // TransformStream` at module scope and the inline bootstrap pipes
            // through TextEncoderStream (itself built on TransformStream), so
            // both throw and the app never mounts - the shipped v1.32.3 black
            // screen. Deleting only this, leaving the rest, is exactly that
            // device.
            try {
              delete window.TransformStream;
            } catch {
              /* already absent */
            }
          },
          tes: () => {
            // Chrome 105.
            for (const name of ["TextEncoderStream", "TextDecoderStream"]) {
              try {
                delete window[name];
              } catch {
                /* already absent */
              }
            }
          },
          sc: () => {
            // Chrome 98.
            try {
              delete window.structuredClone;
            } catch {
              /* already absent */
            }
          },
          uuid: () => {
            // Chrome 92.
            try {
              delete Crypto.prototype.randomUUID;
            } catch {
              /* already absent */
            }
          },
          hasown: () => {
            // Chrome 93.
            try {
              delete Object.hasOwn;
            } catch {
              /* already absent */
            }
          },
          at: () => {
            // Chrome 92.
            try {
              delete Array.prototype.at;
            } catch {
              /* already absent */
            }
          },
          fromentries: () => {
            // Chrome 73. The bundle builds the color-theme table with
            // `Object.fromEntries` at module scope, so a WebView older than this
            // throws before React mounts - the shipped v1.34.0 black screen on a
            // WebView that already had the stream shims.
            try {
              delete Object.fromEntries;
            } catch {
              /* already absent */
            }
          },
          entries: () => {
            // Chrome 54.
            for (const name of ["entries", "values", "getOwnPropertyDescriptors"]) {
              try {
                delete Object[name];
              } catch {
                /* already absent */
              }
            }
          },
          flat: () => {
            // Chrome 69.
            for (const name of ["flat", "flatMap"]) {
              try {
                delete Array.prototype[name];
              } catch {
                /* already absent */
              }
            }
          },
          matchall: () => {
            // Chrome 73.
            try {
              delete String.prototype.matchAll;
            } catch {
              /* already absent */
            }
          },
          pad: () => {
            // Chrome 57.
            for (const name of [
              "padStart",
              "padEnd",
              "trimStart",
              "trimEnd",
            ]) {
              try {
                delete String.prototype[name];
              } catch {
                /* already absent */
              }
            }
          },
        };
        for (const name of kill) remove[name]();

        const define = (value) =>
          Object.defineProperty(navigator, "serviceWorker", {
            get: () => value,
            configurable: true,
          });
        if (noServiceWorkerApi) define(undefined);
        if (serviceWorkerThrows) {
          define({
            register() {
              throw new TypeError("service worker unsupported");
            },
            getRegistrations: () => Promise.reject(new Error("unsupported")),
            getRegistration: () => Promise.reject(new Error("unsupported")),
            controller: null,
            addEventListener() {},
            ready: Promise.reject(new Error("unsupported")),
          });
        }
        if (serviceWorkerHangs) {
          const never = () => new Promise(() => {});
          define({
            register: never,
            getRegistrations: never,
            getRegistration: never,
            controller: null,
            addEventListener() {},
            ready: never(),
          });
        }
      },
      {
        kill: testCase.kill,
        noServiceWorkerApi: !!testCase.noServiceWorkerApi,
        serviceWorkerThrows: !!testCase.serviceWorkerThrows,
        serviceWorkerHangs: !!testCase.serviceWorkerHangs,
      },
    );

    await page.goto(base + "/", { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(testCase.settleMs || 8000);

    const visible = await page.evaluate(() =>
      document.body.innerText.trim().replace(/\s+/g, " "),
    );
    const notice = await page.evaluate(() =>
      document.getElementById("compat-notice") ? true : false,
    );
    const mounted = visible.length > MIN_VISIBLE;

    if (!mounted || notice) {
      failed += 1;
      console.log(
        `FAIL  ${testCase.name} -> visible=${visible.length} notice=${notice}`,
      );
      if (errors.length) {
        console.log(`      errors: ${errors.slice(0, 3).join(" | ")}`);
      }
    } else {
      console.log(`ok    ${testCase.name} -> visible=${visible.length}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failed) {
  console.error(
    `\n${failed} case(s) failed: an old WebView would show a blank screen.`,
  );
  process.exit(1);
}
console.log(`\nAll ${CASES.length} cases mount on an old WebView.`);
