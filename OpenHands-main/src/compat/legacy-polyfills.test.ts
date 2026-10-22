import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  resolve(process.cwd(), "public/legacy-polyfills.js"),
  "utf8",
);

/** Strip comments and string literals so keyword checks only see real code. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

const CODE = codeOnly(SOURCE);

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
  const context = createContext({
    console,
    // The prelude arms a 20s watchdog. Capturing its callback instead of
    // scheduling it keeps the suite fast and lets a test decide when the
    // watchdog fires, so nothing depends on wall-clock time.
    setTimeout: (callback: () => void) => {
      if (timers) pending.push(callback);
      return 0;
    },
    clearTimeout: () => {},
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
  it("stays ES5 so an old WebView can parse it", () => {
    // A `const`, arrow or template literal in real code would be a parse error
    // on the very WebViews this file exists to support - and a parse error in
    // <head> takes the whole document down.
    expect(CODE).not.toMatch(/=>/);
    expect(CODE).not.toMatch(/\b(const|let|class)\b/);
    expect(CODE).not.toMatch(/`/);
    expect(CODE).not.toMatch(/\?\./);
    expect(CODE).not.toMatch(/\?\?/);
    expect(CODE).not.toMatch(/\bfor\s*\([^)]*\bof\b/);
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
    // Modules unsupported (no `noModule` probe) and nothing mounted: the notice
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

  it("stays quiet when the app mounted before the watchdog fired", () => {
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "window.document = {" +
        "  createElement: function () { return { noModule: false }; }," +
        "  createTextNode: function () { return {}; }," +
        "  getElementById: function () { return null; }," +
        "  body: { innerText: '', appendChild: function (node) { window.__notices.push(node.id); } }," +
        "  documentElement: { appendChild: function () {} }" +
        "};" +
        "window.navigator = { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' };",
    );
    load(realm);
    realm.eval("window.__openhandsMounted = true;");
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(0);
  });

  it("stays quiet when the page has visible content", () => {
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
});
