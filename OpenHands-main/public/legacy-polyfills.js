/*
 * Compatibility prelude for the WebView the APK actually runs in.
 *
 * The web bundle assumes a recent Chrome. Android System WebView is not that:
 * it is a separate app that updates on its own schedule, and minSdk 23 admits
 * devices whose WebView predates the bundle's assumptions. When such a WebView
 * meets a global it does not have, the failure is silent and total - the module
 * graph throws before React mounts and the user gets a black screen with no
 * console output, because nothing on the page can report it.
 *
 * This file is loaded as a classic script in <head>, before every module, so it
 * only ever runs on the plainest path. It is written in ES5 on purpose: an
 * arrow function or a `const` here would be a parse error on the very WebViews
 * it exists to support, taking the whole document with it.
 *
 * Every definition is additive. Nothing is overwritten when the platform
 * already provides it, so a current browser executes this and changes nothing.
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;

  // Run each definition on its own so one unexpected failure cannot stop the
  // rest of the prelude.
  function define(name, install) {
    try {
      install();
    } catch (error) {
      try {
        console.warn("[compat] could not define " + name, error);
      } catch (_) {
        /* nothing else we can do */
      }
    }
  }

  /*
   * Boot-critical, and therefore first.
   *
   * `index.html` carries an inline classic script that runs
   * `new ReadableStream(...).pipeThrough(new TextEncoderStream())` with no
   * guard, before any module. If TextEncoderStream is missing, that script
   * throws, `__reactRouterContext.stream` is never created, and the app never
   * mounts - a black screen. Every other definition here is additive and can
   * wait; these two cannot.
   *
   * `TransformStream` has to come before both, because `TextEncoderStream`
   * below is built on it and so is code in the bundle (`class extends
   * TransformStream`, the brotli interceptor). The platform gained
   * `ReadableStream` and `WritableStream` in Chrome 43 but `TransformStream`
   * only in Chrome 67, so a WebView in between - which minSdk 23 admits - hits
   * `new TransformStream(...)` at module scope, throws `TransformStream is not
   * defined`, and leaves a black screen with an empty console. That was the
   * shipped v1.32.3 failure.
   *
   * This is built on the *native* streams rather than on a bundled polyfill on
   * purpose: native `pipeThrough`/`pipeTo` brand-check the streams they are
   * given, and would reject a polyfilled `readable`/`writable`.
   */
  define("TransformStream", function () {
    if (typeof window.TransformStream === "function") return;
    if (typeof window.ReadableStream !== "function") return;
    if (typeof window.WritableStream !== "function") return;

    window.TransformStream = function (
      transformer,
      writableStrategy,
      readableStrategy
    ) {
      var source = transformer || {};
      var readableController = null;

      // `start` runs synchronously from the constructor, so the controller is
      // in hand before the writable side can call `transform`.
      var readable = new window.ReadableStream(
        {
          start: function (controller) {
            readableController = controller;
          },
        },
        readableStrategy
      );

      // The transformer is written against the TransformStreamDefaultController
      // surface; expose the parts it uses and no more.
      var transformController = {
        enqueue: function (chunk) {
          readableController.enqueue(chunk);
        },
        error: function (reason) {
          readableController.error(reason);
        },
        terminate: function () {
          readableController.close();
        },
        get desiredSize() {
          return readableController.desiredSize;
        },
      };

      var writable = new window.WritableStream(
        {
          write: function (chunk) {
            if (typeof source.transform === "function") {
              source.transform(chunk, transformController);
            } else {
              readableController.enqueue(chunk);
            }
          },
          close: function () {
            if (typeof source.flush === "function") {
              source.flush(transformController);
            }
            readableController.close();
          },
          abort: function (reason) {
            readableController.error(
              reason === undefined ? new Error("aborted") : reason
            );
          },
        },
        writableStrategy
      );

      this.readable = readable;
      this.writable = writable;
    };
  });

  define("TextEncoderStream", function () {
    if (typeof window.TextEncoderStream === "function") return;
    if (typeof TransformStream !== "function") return;
    window.TextEncoderStream = function () {
      var encoder = new TextEncoder();
      var stream = new TransformStream({
        transform: function (chunk, controller) {
          controller.enqueue(encoder.encode(chunk));
        },
        flush: function (controller) {
          var tail = encoder.encode();
          if (tail.byteLength > 0) controller.enqueue(tail);
        },
      });
      this.readable = stream.readable;
      this.writable = stream.writable;
    };
  });

  define("TextDecoderStream", function () {
    if (typeof window.TextDecoderStream === "function") return;
    if (typeof TransformStream !== "function") return;
    window.TextDecoderStream = function (label, options) {
      var decoder = new TextDecoder(label, options);
      var stream = new TransformStream({
        transform: function (chunk, controller) {
          var text = decoder.decode(chunk, { stream: true });
          if (text) controller.enqueue(text);
        },
        flush: function (controller) {
          var text = decoder.decode();
          if (text) controller.enqueue(text);
        },
      });
      this.readable = stream.readable;
      this.writable = stream.writable;
    };
  });

  define("globalThis", function () {
    if (typeof globalThis === "undefined") window.globalThis = window;
  });

  // Chrome 98. Used at module scope by the mock settings handlers, so a missing
  // implementation blanks the app before the first render.
  define("structuredClone", function () {
    if (typeof window.structuredClone === "function") return;

    function clone(value, seen, copies) {
      if (value === null || typeof value !== "object") return value;
      if (value instanceof Date) return new Date(value.getTime());
      if (value instanceof RegExp) return new RegExp(value.source, value.flags);
      if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
        return value.slice(0);
      }
      if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
        return new value.constructor(value);
      }

      // Hand back the copy already in progress for this object, so a cycle
      // closes on the clone instead of on the original.
      var existing = seen.indexOf(value);
      if (existing !== -1) return copies[existing];

      seen.push(value);
      var result;
      if (Array.isArray(value)) {
        result = [];
      } else if (typeof Map !== "undefined" && value instanceof Map) {
        result = new Map();
      } else if (typeof Set !== "undefined" && value instanceof Set) {
        result = new Set();
      } else {
        result = {};
      }
      copies.push(result);

      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++)
          result[i] = clone(value[i], seen, copies);
      } else if (typeof Map !== "undefined" && value instanceof Map) {
        value.forEach(function (item, key) {
          result.set(clone(key, seen, copies), clone(item, seen, copies));
        });
      } else if (typeof Set !== "undefined" && value instanceof Set) {
        value.forEach(function (item) {
          result.add(clone(item, seen, copies));
        });
      } else {
        for (var key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            result[key] = clone(value[key], seen, copies);
          }
        }
      }

      return result;
    }

    window.structuredClone = function (value) {
      return clone(value, [], []);
    };
  });

  // Chrome 93. Used by the theme bootstrap in <head> and by the markdown
  // vendor chunk, both of which run on the critical path.
  define("Object.hasOwn", function () {
    if (typeof Object.hasOwn === "function") return;
    Object.hasOwn = function (object, property) {
      return Object.prototype.hasOwnProperty.call(Object(object), property);
    };
  });

  // Chrome 92.
  define("Array.prototype.at", function () {
    if (typeof Array.prototype.at === "function") return;
    Array.prototype.at = function (index) {
      var length = this.length >>> 0;
      var relative = Math.trunc(index) || 0;
      if (relative < 0) relative += length;
      if (relative < 0 || relative >= length) return undefined;
      return this[relative];
    };
  });

  define("String.prototype.at", function () {
    if (typeof String.prototype.at === "function") return;
    String.prototype.at = function (index) {
      var length = this.length >>> 0;
      var relative = Math.trunc(index) || 0;
      if (relative < 0) relative += length;
      if (relative < 0 || relative >= length) return undefined;
      return this[relative];
    };
  });

  // Chrome 97.
  define("Array.prototype.findLast", function () {
    if (typeof Array.prototype.findLast === "function") return;
    Array.prototype.findLast = function (predicate, thisArg) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    };
  });

  define("Array.prototype.findLastIndex", function () {
    if (typeof Array.prototype.findLastIndex === "function") return;
    Array.prototype.findLastIndex = function (predicate, thisArg) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    };
  });

  // Chrome 85.
  define("String.prototype.replaceAll", function () {
    if (typeof String.prototype.replaceAll === "function") return;
    String.prototype.replaceAll = function (search, replacement) {
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError("replaceAll must be called with a global RegExp");
        }
        return this.replace(search, replacement);
      }
      var escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return this.replace(new RegExp(escaped, "g"), replacement);
    };
  });

  // Chrome 76.
  define("Promise.allSettled", function () {
    if (typeof Promise.allSettled === "function") return;
    Promise.allSettled = function (iterable) {
      var items = Array.prototype.slice.call(iterable);
      return Promise.all(
        items.map(function (item) {
          return Promise.resolve(item).then(
            function (value) {
              return { status: "fulfilled", value: value };
            },
            function (reason) {
              return { status: "rejected", reason: reason };
            }
          );
        })
      );
    };
  });

  // Chrome 85.
  define("Promise.any", function () {
    if (typeof Promise.any === "function") return;
    Promise.any = function (iterable) {
      var items = Array.prototype.slice.call(iterable);
      return new Promise(function (resolve, reject) {
        var errors = [];
        var remaining = items.length;
        if (remaining === 0) {
          reject(new Error("All promises were rejected"));
          return;
        }
        items.forEach(function (item, index) {
          Promise.resolve(item).then(resolve, function (reason) {
            errors[index] = reason;
            remaining -= 1;
            if (remaining === 0) {
              if (typeof AggregateError === "function") {
                reject(
                  new AggregateError(errors, "All promises were rejected")
                );
              } else {
                reject(new Error("All promises were rejected"));
              }
            }
          });
        });
      });
    };
  });

  // Chrome 103.
  define("AbortSignal.timeout", function () {
    if (typeof AbortSignal === "undefined") return;
    if (typeof AbortSignal.timeout === "function") return;
    AbortSignal.timeout = function (milliseconds) {
      var controller = new AbortController();
      setTimeout(function () {
        var reason;
        if (typeof DOMException === "function") {
          reason = new DOMException("signal timed out", "TimeoutError");
        } else {
          reason = new Error("signal timed out");
          reason.name = "TimeoutError";
        }
        controller.abort(reason);
      }, milliseconds);
      return controller.signal;
    };
  });

  // Chrome 92.
  define("crypto.randomUUID", function () {
    if (typeof crypto === "undefined") return;
    if (typeof crypto.randomUUID === "function") return;
    if (typeof crypto.getRandomValues !== "function") return;
    crypto.randomUUID = function () {
      var bytes = crypto.getRandomValues(new Uint8Array(16));
      // Version 4 (random) and variant 10xx, per RFC 4122.
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = [];
      for (var i = 0; i < 16; i++) {
        hex.push((bytes[i] + 0x100).toString(16).slice(1));
      }
      return (
        hex.slice(0, 4).join("") +
        "-" +
        hex.slice(4, 6).join("") +
        "-" +
        hex.slice(6, 8).join("") +
        "-" +
        hex.slice(8, 10).join("") +
        "-" +
        hex.slice(10, 16).join("")
      );
    };
  });

  // Chrome 71. Both are cheap, and both are called from module scope in
  // dependencies where a TypeError is unrecoverable.
  define("queueMicrotask", function () {
    if (typeof window.queueMicrotask === "function") return;
    window.queueMicrotask = function (callback) {
      Promise.resolve()
        .then(callback)
        .catch(function (error) {
          setTimeout(function () {
            throw error;
          }, 0);
        });
    };
  });

  define("requestIdleCallback", function () {
    if (typeof window.requestIdleCallback === "function") return;
    window.requestIdleCallback = function (callback) {
      var start = Date.now();
      return setTimeout(function () {
        callback({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };
    window.cancelIdleCallback = function (handle) {
      clearTimeout(handle);
    };
  });

  // Chrome 64. HeroUI and framer-motion observe element size. There is no way
  // to synthesise real resize notifications, so this reports the current size
  // once and then stays quiet: layout may not reflow on rotation, but the app
  // renders instead of throwing at module scope.
  define("ResizeObserver", function () {
    if (typeof window.ResizeObserver === "function") return;
    window.ResizeObserver = function (callback) {
      this._callback = callback;
    };
    window.ResizeObserver.prototype.observe = function (target) {
      var callback = this._callback;
      if (typeof callback !== "function") return;
      var observer = this;
      var rect = target.getBoundingClientRect
        ? target.getBoundingClientRect()
        : { width: 0, height: 0 };
      setTimeout(function () {
        try {
          callback([{ target: target, contentRect: rect }], observer);
        } catch (_) {
          /* observers must not break their subject */
        }
      }, 0);
    };
    window.ResizeObserver.prototype.unobserve = function () {};
    window.ResizeObserver.prototype.disconnect = function () {};
  });

  /*
   * Diagnostics.
   *
   * The failures above are silent by construction: when a WebView cannot parse
   * the bundle, or cannot run modules at all, the code that would report the
   * error never runs and the console stays empty. This prelude is the one thing
   * on the page that always executes, so it is also the only place that can put
   * something on screen when everything else has failed.
   */

  function webViewLabel() {
    var userAgent = (navigator && navigator.userAgent) || "";
    var match = /Chrome\/(\d+)/.exec(userAgent);
    return match ? "Chrome/" + match[1] : userAgent.slice(0, 90);
  }

  function renderNotice(title, detail) {
    try {
      if (document.getElementById("compat-notice")) return;
      var box = document.createElement("div");
      box.id = "compat-notice";
      box.setAttribute(
        "style",
        [
          "position:fixed",
          // Not `inset:0`: the shorthand is Chrome 87+, and this notice exists
          // for WebViews older than that. Without the longhands the box would
          // shrink to its content in the top-left corner.
          "top:0",
          "right:0",
          "bottom:0",
          "left:0",
          "z-index:2147483647",
          "display:flex",
          "flex-direction:column",
          "justify-content:center",
          // `gap` in a flex container is Chrome 84+. Spacing the children with
          // a margin instead keeps the notice laid out on the WebViews that
          // need it most.
          "padding:28px",
          "background:#101014",
          "color:#f4f4f5",
          "font:14px/1.55 system-ui,-apple-system,sans-serif",
          "-webkit-user-select:text",
          "user-select:text",
        ].join(";")
      );
      var heading = document.createElement("div");
      heading.setAttribute(
        "style",
        "font-weight:600;font-size:16px;margin-bottom:8px"
      );
      heading.appendChild(document.createTextNode(title));
      var body = document.createElement("div");
      body.setAttribute("style", "opacity:.8");
      body.appendChild(document.createTextNode(detail));
      box.appendChild(heading);
      box.appendChild(body);
      (document.body || document.documentElement).appendChild(box);
    } catch (error) {
      /* if even this fails there is nothing left to try */
    }
  }

  // `noModule` is the standard probe for `<script type="module">` support. It
  // only chooses the wording of the notice below, never whether to show one: a
  // feature probe can be wrong, and a false positive would cover a working app.
  // The trigger is always the observable outcome - the page is still blank.
  var supportsModules = true;
  try {
    supportsModules = "noModule" in document.createElement("script");
  } catch (error) {
    supportsModules = true;
  }

  function pageIsBlank() {
    try {
      if (!document.body) return true;
      // Visible text is the signal, and the only one that matches what the user
      // sees. `body.children.length` is not usable: the react-router bootstrap
      // leaves its own <script> elements in the body, so a page that never
      // rendered still has children.
      var text = document.body.innerText ? document.body.innerText.trim() : "";
      return text.length === 0;
    } catch (error) {
      return true;
    }
  }

  // Capture the first uncaught error or rejection so the notice can name a
  // cause instead of only a symptom. Without this the console is the sole record
  // and a screenshot of a black screen says nothing about why.
  var firstFailure = "";
  function rememberFailure(label, value) {
    if (firstFailure) return;
    var detail = "";
    try {
      if (value && value.message) {
        detail = value.message;
      } else {
        detail = String(value);
      }
    } catch (error) {
      detail = "";
    }
    firstFailure = label + ": " + detail.slice(0, 160);
  }

  try {
    window.addEventListener("error", function (event) {
      rememberFailure("error", event.error || event.message);
    });
    window.addEventListener("unhandledrejection", function (event) {
      rememberFailure("rejection", event.reason);
    });
  } catch (error) {
    /* no event listeners; the notice falls back to the generic wording */
  }

  function blankNoticeDetail() {
    var fallback = supportsModules
      ? "The interface did not load on this device"
      : "This device's WebView cannot run modern JavaScript";
    return (
      fallback +
      " (" +
      webViewLabel() +
      ")" +
      (firstFailure ? ".\n\nReported: " + firstFailure : "") +
      '. Update "Android System WebView" and "Chrome" in the Play Store, then reopen the app.'
    );
  }

  // A blank page is indistinguishable from a crash, and on these WebViews it is
  // silent: the code that would report the error never ran. This prelude is the
  // only thing guaranteed to have executed, so it reports the WebView version
  // and the first error itself.
  //
  // The trigger is deliberately the observable outcome, not `__openhandsMounted`.
  // That flag is set the moment `hydrateRoot` is *called*, which is not the same
  // as React having rendered: if hydration throws, the flag is still set and a
  // flag-gated watchdog would stay silent over a black screen.
  //
  // Note the deliberate limit: "text present but unstyled" is *not* detected
  // here. A computed-style probe is a feature test, and a feature test can be
  // wrong - jsdom reports every declaration as unapplied - so gating the notice
  // on one would cover a working app. The stylesheet that caused that state is
  // caught at build time instead, by `flatten:css` and `check:css-compat`.
  var blankChecks = 0;
  var watchdog = setInterval(function () {
    blankChecks += 1;
    if (!pageIsBlank()) {
      clearInterval(watchdog);
      return;
    }
    // Give a slow device time to paint before accusing it, then stop.
    if (blankChecks < 20) return;
    clearInterval(watchdog);
    renderNotice(
      supportsModules
        ? "OpenHands could not start"
        : "Android System WebView is out of date",
      blankNoticeDetail()
    );
  }, 1000);
})();
