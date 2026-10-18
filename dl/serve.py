#!/usr/bin/env python3
"""Static server for the OpenHands Mobile download page.

The APK itself is NOT served from here. GitHub Releases is the durable host:
the asset URL below is permanent and always points at the newest signed build.
This server previously kept a local copy of the APK, which silently went stale
after every new release and handed users an outdated binary. It now redirects
to the release asset instead, so a stale copy is impossible.
"""
import http.server
import os
import socketserver

PORT = int(os.environ.get("APK_PORT") or os.environ.get("PORT") or "12000")
ROOT = os.path.dirname(os.path.abspath(__file__))

RELEASE = "https://github.com/NETO-DEV66/Opanhand-mobile-/releases/latest/download"

INDEX = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenHands Mobile APK</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0b0b0f; color:#eee;
           display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; padding:1.5rem; }
    .card { background:#17171d; padding:2rem 2.5rem; border-radius:16px;
            box-shadow:0 10px 40px rgba(0,0,0,.5); text-align:center; max-width:520px; }
    h1 { margin:0 0 .25rem; font-size:1.5rem; }
    h2 { font-size:1rem; color:#c9c9d1; margin:1.6rem 0 .4rem; text-align:left; }
    p { color:#9aa0a6; font-size:.9rem; }
    a.btn { display:inline-block; margin-top:.4rem; padding:.8rem 1.6rem; border-radius:10px;
            background:#6c5ce7; color:#fff; text-decoration:none; font-weight:600; }
    a.btn:hover { background:#5b4bd6; }
    code { color:#8ce99a; }
    ul { text-align:left; color:#9aa0a6; font-size:.85rem; padding-left:1.1rem; }
    .meta { font-size:.75rem; color:#6b7280; margin-top:.3rem; }
    .note { font-size:.78rem; color:#f0b429; margin-top:1.4rem; text-align:left; }
  </style>
</head>
<body>
  <div class="card">
    <h1>OpenHands Mobile</h1>
    <p>Agent Canvas wrapped with Capacitor for Android</p>

    <h2>Download the APK</h2>
    <a class="btn" href="__RELEASE__/app-release.apk" download>Download APK</a>
    <div class="meta">Signed release build, hosted on GitHub Releases &mdash; always the latest version</div>

    <h2>Install</h2>
    <ul>
      <li>Uninstall any older OpenHands Mobile build first &mdash; the app was re-signed.</li>
      <li>Allow install from unknown sources for your browser or file manager.</li>
      <li>Open the APK on the phone and install it.</li>
      <li>On first launch, add your agent server host and API key.</li>
    </ul>

    <p class="note">
      This page only redirects. The APK is served by GitHub Releases so that the
      download link can never go stale or offline.
    </p>
  </div>
</body>
</html>
""".replace("__RELEASE__", RELEASE)

# Paths that used to serve a local APK copy. Send them to the release instead.
REDIRECTS = {
    "/openhands.apk": f"{RELEASE}/app-release.apk",
    "/openhands-debug.apk": f"{RELEASE}/app-release.apk",
    "/app-release.apk": f"{RELEASE}/app-release.apk",
    "/app-debug.apk": f"{RELEASE}/app-release.apk",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _dispatch(self, body):
        # body=True for GET, False for HEAD. Headers are identical; only the
        # payload differs. Download managers and chat link previews use HEAD,
        # so it has to answer the same as GET rather than 404 on the missing
        # local file.
        if self.path in ("/", "/index.html"):
            payload = INDEX.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if body:
                self.wfile.write(payload)
            return
        if self.path in REDIRECTS:
            self.send_response(302)
            self.send_header("Location", REDIRECTS[self.path])
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if body:
            super().do_GET()
        else:
            super().do_HEAD()

    def do_GET(self):
        self._dispatch(body=True)

    def do_HEAD(self):
        self._dispatch(body=False)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)


class ReuseServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReuseServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Serving {ROOT} on port {PORT} (APK redirects to GitHub Releases)", flush=True)
        httpd.serve_forever()
