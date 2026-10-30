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
    // A WebView between Chrome 43 and 66 has these two but not TransformStream,
    // which is the floor this suite cares about. All three are injected so a
    // test can remove exactly the one it means to.
    ReadableStream,
    WritableStream,
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
    // TransformStream has to come before even that, because TextEncoderStream is
    // built on it.
    const transformAt = SOURCE.indexOf('define("TransformStream"');
    const encoderAt = SOURCE.indexOf('define("TextEncoderStream"');
    const decoderAt = SOURCE.indexOf('define("TextDecoderStream"');
    const firstOther = SOURCE.indexOf('define("globalThis"');
    expect(transformAt).toBeGreaterThan(-1);
    expect(encoderAt).toBeGreaterThan(-1);
    expect(decoderAt).toBeGreaterThan(-1);
    expect(transformAt).toBeLessThan(encoderAt);
    expect(encoderAt).toBeLessThan(firstOther);
    expect(decoderAt).toBeLessThan(firstOther);
  });

  it("defines TransformStream on a WebView between Chrome 43 and 66", () => {
    // The shipped v1.32.3 black screen. `ReadableStream` and `WritableStream`
    // arrived in Chrome 43 but `TransformStream` only in Chrome 67, so a device
    // in between - which minSdk 23 admits - has the native streams the shim
    // needs and no TransformStream. Without this the bundle's `class extends
    // TransformStream` and the inline bootstrap's pipeThrough both throw before
    // React mounts.
    const realm = load(setup({ remove: ["TransformStream"] }));

    expect(realm.eval("typeof TransformStream")).toBe("function");
    expect(realm.eval("new TransformStream() instanceof TransformStream")).toBe(
      true,
    );
    expect(
      realm.eval("new TransformStream().readable instanceof ReadableStream"),
    ).toBe(true);
    expect(
      realm.eval("new TransformStream().writable instanceof WritableStream"),
    ).toBe(true);
  });

  it("round-trips a chunk through a shimmed TransformStream", async () => {
    const realm = load(setup({ remove: ["TransformStream"] }));

    // The real use: a source piped through a transform, read back out. Values
    // are pulled out of the realm as strings so no cross-realm object crosses
    // the boundary.
    const result = realm.eval(`
      (function () {
        var source = new ReadableStream({
          start: function (controller) {
            controller.enqueue("hello");
            controller.close();
          },
        });
        var upper = new TransformStream({
          transform: function (chunk, controller) {
            controller.enqueue(chunk.toUpperCase());
          },
        });
        return source.pipeThrough(upper);
      })()
    `) as { getReader: () => { read: () => Promise<{ value: unknown }> } };

    const reader = result.getReader();
    const first = await reader.read();
    expect(String(first.value)).toBe("HELLO");
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

  it("encodes through a shimmed TextEncoderStream without a native TransformStream", () => {
    // The combination the old-WebView floor actually presents: TextEncoderStream
    // missing *and* TransformStream missing. The encoder shim returns early when
    // TransformStream is absent, so it only works because the prelude defines
    // that first.
    const realm = load(
      setup({ remove: ["TransformStream", "TextEncoderStream"] }),
    );

    expect(
      realm.eval(
        "new ReadableStream({ start: function (c) { c.enqueue('ok'); c.close(); } })" +
          ".pipeThrough(new TextEncoderStream()) instanceof ReadableStream",
      ),
    ).toBe(true);
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

  it("defines Object.fromEntries so a module-scope theme table can build", () => {
    const realm = load(setup({ remove: ["Object.fromEntries"] }));
    expect(realm.eval("typeof Object.fromEntries")).toBe("function");
    // The real use: `Object.fromEntries(keys.map(k => [k, value]))`.
    expect(
      realm.eval(
        "JSON.stringify(Object.fromEntries([['a', 1], ['b', 2]]))",
      ),
    ).toBe('{"a":1,"b":2}');
    // Entries may arrive as any iterable, not just an array.
    expect(
      realm.eval(
        "JSON.stringify(Object.fromEntries(new Map([['x', 9]])))",
      ),
    ).toBe('{"x":9}');
    expect(realm.eval("JSON.stringify(Object.fromEntries([]))")).toBe("{}");
  });

  it("defines Object.entries and Object.values for own properties only", () => {
    const realm = load(
      setup({ remove: ["Object.entries", "Object.values"] }),
    );
    expect(realm.eval("typeof Object.entries")).toBe("function");
    expect(realm.eval("typeof Object.values")).toBe("function");
    expect(
      realm.eval(
        "JSON.stringify(Object.entries({ a: 1, b: 2 }))",
      ),
    ).toBe('[["a",1],["b",2]]');
    expect(
      realm.eval("JSON.stringify(Object.values({ a: 1, b: 2 }))"),
    ).toBe("[1,2]");
    // Inherited enumerable properties are not own entries.
    expect(
      realm.eval(
        "JSON.stringify(Object.entries(Object.create({ inherited: 1 })))",
      ),
    ).toBe("[]");
  });

  it("defines Array.prototype.flat and flatMap at the requested depth", () => {
    const realm = load(
      setup({ remove: ["Array.prototype.flat", "Array.prototype.flatMap"] }),
    );
    expect(realm.eval("JSON.stringify([1, [2, [3]]].flat())")).toBe(
      "[1,2,[3]]",
    );
    expect(realm.eval("JSON.stringify([1, [2, [3]]].flat(2))")).toBe(
      "[1,2,3]",
    );
    expect(realm.eval("JSON.stringify([1, [2]].flatMap((n) => [n, n]))")).toBe(
      "[1,1,[2],[2]]",
    );
    expect(realm.eval("JSON.stringify([1, 2].flatMap((n) => [n, n * 10]))")).toBe(
      "[1,10,2,20]",
    );
  });

  it("defines the pad and trim string helpers", () => {
    const realm = load(
      setup({
        remove: [
          "String.prototype.padStart",
          "String.prototype.padEnd",
          "String.prototype.trimStart",
          "String.prototype.trimEnd",
        ],
      }),
    );
    expect(realm.eval("'5'.padStart(3, '0')")).toBe("005");
    expect(realm.eval("'5'.padEnd(3, '0')")).toBe("500");
    expect(realm.eval("'   x   '.trimStart()")).toBe("x   ");
    expect(realm.eval("'   x   '.trimEnd()")).toBe("   x");
  });

  it("defines String.prototype.matchAll over a global RegExp", () => {
    const realm = load(setup({ remove: ["String.prototype.matchAll"] }));
    expect(realm.eval("typeof String.prototype.matchAll")).toBe("function");
    expect(
      realm.eval(
        "JSON.stringify(Array.from('a1b2'.matchAll(/[a-z](\\d)/g)).map((m) => m[1]))",
      ),
    ).toBe('["1","2"]');
    expect(realm.eval("typeof Object.getOwnPropertyDescriptors")).toBe(
      "function",
    );
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

  it("takes the notice back down when the app paints after the deadline", () => {
    // The slow-device case seen on a cold emulator: the app is blank past the
    // threshold, so the notice appears, and only then does the app render. A
    // one-shot notice would stay up over a working app forever - and because
    // its background is near-black, that stale notice *is* the black screen it
    // was written to explain. The watchdog must keep watching and clear it.
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "window.__removed = [];" +
        "window.__checks = 0;" +
        "window.__noticeNode = null;" +
        "function makeNode() {" +
        "  return { id: '', innerText: '', textContent: '', parentNode: null," +
        "    setAttribute: function () {}," +
        "    appendChild: function (child) { this.textContent += (child.textContent || ''); } };" +
        "}" +
        "var bodyNode = {" +
        "  appendChild: function (node) { node.parentNode = bodyNode; window.__noticeNode = node; window.__notices.push(node.id); }," +
        "  removeChild: function (node) { window.__removed.push(node.id); node.parentNode = null; window.__noticeNode = null; }" +
        "};" +
        "Object.defineProperty(bodyNode, 'innerText', { get: function () {" +
        "  window.__checks += 1;" +
        "  var own = window.__noticeNode ? window.__noticeNode.textContent : '';" +
        "  var app = window.__checks > 30 ? 'Choose your agent' : '';" +
        "  return own + app;" +
        "} });" +
        "window.document = {" +
        "  createElement: function () { return makeNode(); }," +
        "  createTextNode: function (text) { return { textContent: text }; }," +
        "  getElementById: function (id) { return (window.__noticeNode && window.__noticeNode.id === id) ? window.__noticeNode : null; }," +
        "  body: bodyNode," +
        "  documentElement: { appendChild: function () {} }" +
        "};" +
        "window.navigator = { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' };",
    );
    load(realm);
    realm.flushTimers();

    // Shown while blank...
    expect(realm.eval("window.__notices.length")).toBe(1);
    // ...and gone once the app's own text arrived.
    expect(realm.eval("window.__removed.length")).toBe(1);
    expect(realm.eval("window.__removed[0]")).toBe("compat-notice");
  });

  it("does not mistake the notice's own text for a rendered app", () => {
    // `pageIsBlank` reads `body.innerText`, which includes the notice. Counting
    // the notice as content would blind the watchdog to a page that never
    // rendered, so a dead page must keep reporting blank even with the notice
    // on screen.
    const realm = setup({ timers: true });
    realm.eval(
      "window.__notices = [];" +
        "window.__removed = [];" +
        "window.__noticeNode = null;" +
        "function makeNode() {" +
        "  return { id: '', innerText: '', textContent: '', parentNode: null," +
        "    setAttribute: function () {}," +
        "    appendChild: function (child) { this.textContent += (child.textContent || ''); } };" +
        "}" +
        "var bodyNode = {" +
        "  appendChild: function (node) { node.parentNode = bodyNode; window.__noticeNode = node; window.__notices.push(node.id); }," +
        "  removeChild: function (node) { window.__removed.push(node.id); node.parentNode = null; }" +
        "};" +
        "Object.defineProperty(bodyNode, 'innerText', { get: function () {" +
        "  return window.__noticeNode ? window.__noticeNode.textContent : '';" +
        "} });" +
        "window.document = {" +
        "  createElement: function () { return makeNode(); }," +
        "  createTextNode: function (text) { return { textContent: text }; }," +
        "  getElementById: function (id) { return (window.__noticeNode && window.__noticeNode.id === id) ? window.__noticeNode : null; }," +
        "  body: bodyNode," +
        "  documentElement: { appendChild: function () {} }" +
        "};" +
        "window.navigator = { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' };",
    );
    load(realm);
    realm.flushTimers();

    expect(realm.eval("window.__notices.length")).toBe(1);
    // A permanently blank page must never have the notice taken away.
    expect(realm.eval("window.__removed.length")).toBe(0);
  });
});
