import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { parse } from "acorn";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  resolve(process.cwd(), "public/legacy-polyfills.js"),
  "utf8",
);

type Realm = {
  eval: (code: string) => unknown;
  flushTimers: () => void;
};

/**
 * A fresh realm with the browser globals the prelude expects, minus the ones a
 * test asks to remove. A fresh realm matters: the prelude writes to `Object` and
 * `Array.prototype`, and doing that to the test process' own intrinsics would
 * leak into every other suite.
 *
 * Assertions are evaluated *inside* the realm and returned as primitives. An
 * object built in one realm fails `instanceof` against another realm's
 * constructors, so pulling realm objects out to assert on them tests the
 * harness rather than the prelude.
 */
function makeRealm({ timers = false } = {}): Realm {
  const pending: Array<() => void> = [];
  const intervals = new Map<() => void, number>();
  let nextHandle = 1;
  const context = createContext({
    console,
    // The prelude arms a watchdog. Capturing its callback instead of scheduling
    // it keeps the suite fast and lets a test decide when the watchdog fires, so
    // nothing depends on wall-clock time.
    setTimeout: (callback: () => void) => {
      if (timers) pending.push(callback);
      return 0;
    },
    clearTimeout: () => {},
    setInterval: (callback: () => void) => {
      const handle = nextHandle++;
      if (timers) intervals.set(callback, handle);
      return handle;
    },
    clearInterval: (handle: number) => {
      for (const [callback, id] of intervals) {
        if (id === handle) intervals.delete(callback);
      }
    },
    TextEncoder,
    TextDecoder,
    TransformStream,
    AbortController,
    crypto,
  });
  runInContext("globalThis.window = globalThis;", context);

  return {
    eval(code) {
      return runInContext(code, context);
    },
    flushTimers() {
      // The watchdog is an interval that must be allowed to stop itself, so a
      // tick that clears it is not rescheduled. Bounded to avoid a runaway loop
      // if a test's stub never reports content.
      for (let tick = 0; tick < 200 && intervals.size > 0; tick += 1) {
        const due = Array.from(intervals.keys());
        for (const callback of due) {
          if (intervals.has(callback)) callback();
        }
      }
      while (pending.length) pending.shift()!();
    },
  };
}

function setup({ remove = [] as string[], timers = false } = {}): Realm {
  const realm = makeRealm({ timers });
  for (const path of remove) realm.eval(`delete globalThis.${path};`);
  return realm;
}

function load(realm: Realm): Realm {
  realm.eval(SOURCE);
  return realm;
}

describe("legacy-polyfills prelude", () => {
  it("parses as ES5 so an old WebView can run it", () => {
    // This is the whole reason the file exists, and the only check that catches
    // every ES2015+ construct at once. A keyword scan is not enough: prettier's
    // `trailingComma: "all"` added ES2017 trailing commas to argument lists,
    // which a scan for `const`/`let`/`=>` misses entirely. On the WebViews this
    // file targets that is a parse error, the file is discarded whole, the
    // TextEncoderStream shim below never installs, react-router's inline
    // bootstrap throws, and the app shows a black screen.
    expect(() =>
      parse(SOURCE, { ecmaVersion: 5, sourceType: "script" }),
    ).not.toThrow();
  });

  it("keeps the boot-critical stream shims first", () => {
    // index.html's inline bootstrap needs TextEncoderStream before any module
    // runs, so the shim must not sit behind a later definition that throws.
    const encoderAt = SOURCE.indexOf('define("TextEncoderStream"');
    const decoderAt = SOURCE.indexOf('define("TextDecoderStream"');
    const firstOther = SOURCE.indexOf('define("globalThis"');
    expect(encoderAt).toBeGreaterThan(-1);
    expect(decoderAt).toBeGreaterThan(-1);
    expect(encoderAt).toBeLessThan(firstOther);
    expect(decoderAt).toBeLessThan(firstOther);
  });

  it("defines structuredClone when the platform lacks it", () => {
    const realm = load(setup({ remove: ["structuredClone"] }));

    expect(
      realm.eval(
        "JSON.stringify(structuredClone({ a: 1, nested: { b: [1, 2] } }))",
      ),
    ).toBe('{"a":1,"nested":{"b":[1,2]}}');
    expect(realm.eval("var o = { a: 1 }; structuredClone(o) !== o")).toBe(true);
    expect(
      realm.eval("var o = { a: 1, n: { b: 1 } }; structuredClone(o).n !== o.n"),
    ).toBe(true);
    expect(realm.eval("structuredClone(new Date(0)) instanceof Date")).toBe(
      true,
    );
    expect(realm.eval("structuredClone(new Date(0)).getTime()")).toBe(0);
  });

  it("closes a cycle on the clone, not the original", () => {
    const realm = load(setup({ remove: ["structuredClone"] }));

    expect(
      realm.eval(
        "var o = { a: 1 }; o.self = o; var c = structuredClone(o); c.self === c",
      ),
    ).toBe(true);
    expect(
      realm.eval(
        "var o = { a: 1 }; o.self = o; var c = structuredClone(o); c.self !== o",
      ),
    ).toBe(true);
  });

  it("defines Object.hasOwn with own-property semantics", () => {
    const realm = load(setup({ remove: ["Object.hasOwn"] }));

    expect(realm.eval("Object.hasOwn({ a: 1 }, 'a')")).toBe(true);
    expect(realm.eval("Object.hasOwn({ a: 1 }, 'b')")).toBe(false);
    expect(realm.eval("Object.hasOwn(Object.create({ a: 1 }), 'a')")).toBe(
      false,
    );
    expect(realm.eval("Object.hasOwn([1], '0')")).toBe(true);
  });

  it("defines Array.prototype.at with negative indexing", () => {
    const realm = load(setup({ remove: ["Array.prototype.at"] }));

    expect(realm.eval("[10, 20, 30].at(-1)")).toBe(30);
    expect(realm.eval("[10, 20, 30].at(0)")).toBe(10);
    expect(realm.eval("[10, 20, 30].at(-3)")).toBe(10);
    expect(realm.eval("[10, 20, 30].at(9)")).toBeUndefined();
    expect(realm.eval("[10, 20, 30].at(-9)")).toBeUndefined();
  });

  it("defines replaceAll and rejects a non-global RegExp", () => {
    const realm = load(setup({ remove: ["String.prototype.replaceAll"] }));

    expect(realm.eval("'a-b-c'.replaceAll('-', '_')")).toBe("a_b_c");
    expect(realm.eval("'a.b.c'.replaceAll('.', '-')")).toBe("a-b-c");
    expect(realm.eval("'aaa'.replaceAll('aa', 'b')")).toBe("ba");
    expect(
      realm.eval(
        "var threw = false; try { 'abc'.replaceAll(/a/, 'x'); } catch (e) { threw = e instanceof TypeError; } threw",
      ),
    ).toBe(true);
  });

  it("defines TextEncoderStream so the SPA bootstrap can pipe through it", () => {
    const realm = load(setup({ remove: ["TextEncoderStream"] }));

    expect(realm.eval("typeof TextEncoderStream")).toBe("function");
    expect(
      realm.eval("new TextEncoderStream() instanceof TextEncoderStream"),
    ).toBe(true);
    expect(realm.eval("new TextEncoderStream().readable !== undefined")).toBe(
      true,
    );
    expect(realm.eval("new TextEncoderStream().writable !== undefined")).toBe(
      true,
    );
  });

  it("leaves a global the platform already provides untouched", () => {
    const realm = setup();
    realm.eval("window.structuredClone = function () { return 'original'; };");
    load(realm);

    expect(realm.eval("structuredClone()")).toBe("original");
  });

  it("keeps defining globals when one definition throws", () => {
    // A hostile TransformStream makes the TextEncoderStream block fail; the
    // prelude must carry on rather than abandon the rest of the list.
    const realm = setup({ remove: ["structuredClone", "Object.hasOwn"] });
    realm.eval(
      "window.TransformStream = function () { throw new Error('nope'); };",
    );
    load(realm);

    expect(realm.eval("typeof structuredClone")).toBe("function");
    expect(realm.eval("typeof Object.hasOwn")).toBe("function");
    expect(realm.eval("typeof queueMicrotask")).toBe("function");
    expect(realm.eval("typeof requestIdleCallback")).toBe("function");
  });

  it("tells the user to update once the page is still blank after the watchdog", () => {
    // Modules unsupported (no `noModule` probe) and nothing rendered: the notice
    // must appear, and must say the WebView is out of date.
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "function stubNode(id) {" +
        "  return { id: id || '', setAttribute: function () {}, appendChild: function () {} };" +
        "}" +
        "window.document = {" +
        "  createElement: function () { return stubNode(''); }," +
        "  createTextNode: function () { return stubNode(''); }," +
        "  getElementById: function () { return null; }," +
        "  body: { innerText: '', appendChild: function (node) { window.__notices.push(node.id); } }," +
        "  documentElement: { appendChild: function () {} }" +
        "};" +
        "window.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 6.0) Chrome/55.0.2883.91' };",
    );
    load(realm);
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(1);
    expect(realm.eval("window.__notices[0]")).toBe("compat-notice");
  });

  it("still reports a blank page after hydrateRoot was called", () => {
    // The flag is set when hydrateRoot is *called*, not when React has rendered.
    // A flag-gated watchdog went quiet here and left a black screen, so the
    // notice must still appear even though the app "mounted".
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "function stubNode(id) {" +
        "  return { id: id || '', setAttribute: function () {}, appendChild: function () {} };" +
        "}" +
        "window.document = {" +
        "  createElement: function () { return stubNode(''); }," +
        "  createTextNode: function () { return stubNode(''); }," +
        "  getElementById: function () { return null; }," +
        "  body: { innerText: '', appendChild: function (node) { window.__notices.push(node.id); } }," +
        "  documentElement: { appendChild: function () {} }" +
        "};" +
        "window.navigator = { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' };",
    );
    load(realm);
    realm.eval("window.__openhandsMounted = true;");
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(1);
  });

  it("names the first error in the notice when one was captured", () => {
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "window.__listeners = {};" +
        "window.addEventListener = function (type, handler) { window.__listeners[type] = handler; };" +
        "function stubNode(id) {" +
        "  return { id: id || '', setAttribute: function () {}, appendChild: function () {} };" +
        "}" +
        "window.__text = [];" +
        "window.document = {" +
        "  createElement: function () { return { setAttribute: function () {}, appendChild: function (n) { window.__text.push(n.text); } }; }," +
        "  createTextNode: function (text) { return { text: text }; }," +
        "  getElementById: function () { return null; }," +
        "  body: { innerText: '', appendChild: function (node) { window.__notices.push(node.id); } }," +
        "  documentElement: { appendChild: function () {} }" +
        "};" +
        "window.navigator = { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' };",
    );
    load(realm);
    realm.eval(
      "window.__listeners.error({ error: { message: 'TransformStream is not defined' } });",
    );
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(1);
    expect(realm.eval("window.__text.join(' ')")).toContain(
      "TransformStream is not defined",
    );
  });

  it("stays quiet when the app has rendered content", () => {
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "window.document = {" +
        "  createElement: function () { return { noModule: false }; }," +
        "  createTextNode: function () { return {}; }," +
        "  getElementById: function () { return null; }," +
        "  body: { innerText: 'Choose your agent', appendChild: function (node) { window.__notices.push(node.id); } }," +
        "  documentElement: { appendChild: function () {} }" +
        "};",
    );
    load(realm);
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(0);
  });

  it("stays quiet once content appears before the watchdog gives up", () => {
    // A slow device may paint after the first few checks; the watchdog must
    // stop rather than accuse a working app.
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "window.__checks = 0;" +
        "window.document = {" +
        "  createElement: function () { return { noModule: false }; }," +
        "  createTextNode: function () { return {}; }," +
        "  getElementById: function () { return null; }," +
        "  body: {" +
        "    get innerText() { window.__checks += 1; return window.__checks > 3 ? 'Choose your agent' : ''; }," +
        "    appendChild: function (node) { window.__notices.push(node.id); }" +
        "  }," +
        "  documentElement: { appendChild: function () {} }" +
        "};",
    );
    load(realm);
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(0);
  });
});
