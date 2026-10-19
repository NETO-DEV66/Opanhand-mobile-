# SEO and discoverability — AgentDeck

This file explains how to get `https://neto-dev66.github.io/Opanhand-mobile-/` and the
GitHub repo to show up in Google, and what was already done for you.

Nothing here is required for the app to work. It is about being *found*.

---

## 1. What was already done (technical SEO)

| Item | Status | Where |
| --- | --- | --- |
| `robots.txt` | added | `docs/robots.txt` |
| `sitemap.xml` | added | `docs/sitemap.xml` |
| Branded `404.html` | added | `docs/404.html` |
| `FAQPage` structured data | added | `docs/index.html` |
| `HowTo` structured data | added | `docs/index.html` |
| `BreadcrumbList` structured data | added | `docs/index.html` |
| `SoftwareApplication` structured data | already existed | `docs/index.html` |
| Title / description keyword tuning | done | `docs/index.html` |
| `og:locale`, `robots`, `keywords` meta | done | `docs/index.html` |
| README keyword headings + FAQ table | done | `README.md` |
| GitHub release notes | improved | release `v1.28.2` |

---

## 2. Google Search Console — do this first

This is the single highest-impact step. Without it, indexing takes weeks or
months. With it, often 2-3 days.

1. Go to <https://search.google.com/search-console> and sign in with the Google
   account you want to own the property.
2. Click **Add property** -> choose **URL prefix** (not Domain).
3. Enter exactly:
   ```
   https://neto-dev66.github.io/Opanhand-mobile-/
   ```
4. For verification, expand **HTML tag**. You will see something like:
   ```html
   <meta name="google-site-verification" content="AbC123...xyz" />
   ```
5. Copy only the `content` value (the `AbC123...xyz` part).
6. Open `docs/index.html` and replace the placeholder:
   ```html
   <meta name="google-site-verification" content="REPLACE_WITH_GOOGLE_SEARCH_CONSOLE_TOKEN">
   ```
   with your real value. Commit and push. Wait ~1 minute for Pages to redeploy.
7. Back in Search Console, click **Verify**.
8. Once verified, open **Sitemaps** in the left menu and submit:
   ```
   sitemap.xml
   ```
9. Open **URL Inspection**, paste your homepage URL, and click
   **Request Indexing**. Repeat once for `https://github.com/NETO-DEV66/Opanhand-mobile-`.

> The verification tag can stay in the page forever. It does not hurt anything.

### If Search Console shows the "HTML file" method instead

Search Console sometimes offers **HTML file** upload rather than the meta tag. Both
work; pick whichever you like.

**Option A — switch to the meta tag (easiest).** On the verification screen, click
the arrow next to **HTML file** and choose **HTML tag** instead. Then follow the
steps above.

**Option B — use the HTML file.** Google gives you a file named something like
`google1a2b3c4d5e6f7g8h.html`. Its whole contents are one line:

```
google-site-verification: google1a2b3c4d5e6f7g8h.html
```

Create that exact file in `docs/` (the folder GitHub Pages publishes), with the
exact name Google gave you, and commit it:

```bash
cd docs
printf 'google-site-verification: google1a2b3c4d5e6f7g8h.html\n' \
  > google1a2b3c4d5e6f7g8h.html
git add google1a2b3c4d5e6f7g8h.html
git commit -m "Add Google Search Console verification file"
git push
```

Wait about a minute, then confirm it is live:

```
https://neto-dev66.github.io/Opanhand-mobile-/google1a2b3c4d5e6f7g8h.html
```

It must return the verification line, not a 404. Then click **Verify**.

> Replace `google1a2b3c4d5e6f7g8h` everywhere with the real name from Google.
> The file name is different for every property, so copy it exactly.

### Same steps for Bing (covers DuckDuckGo too)

<https://www.bing.com/webmasters> -> Add site -> import from Google Search
Console (easiest) or use the meta tag method with
`msvalidate.01`.

---

## 3. Why it is not showing up yet

Two reasons, both normal:

**The repo is new.** It was created 2026-10-15. Google typically takes 2 weeks to
2 months to index a brand-new site, and 3-6 months to rank it. This is not a bug
in your setup.

**The name collides with a much bigger project.** "OpenHands" is an existing
open-source project with a large audience (`github.com/OpenHands/OpenHands`,
`openhands.dev`). Searching the bare word "openhands" will always surface them
first — they have years of authority and thousands of backlinks.

**So do not compete on "openhands". Compete on intent.**

### Keywords to target (lower competition, real demand)

- `openhands android app`
- `openhands mobile`
- `openhands apk`
- `run openhands on phone`
- `openhands agent canvas android`
- `ai coding agent android app`
- `sideload ai agent apk`

These are already woven into the page title, description, README headings and the
overview copy.

---

## 4. Promotion (this is what actually moves the needle)

Meta tags help Google understand a page. Backlinks and traffic make Google
*trust* it. Search ranking follows attention, not the other way around.

Post in these places. Each one is a real backlink and real visitors.

### Reddit

**r/selfhosted**, **r/androidapps**, **r/SideProject**, **r/opensource**,
**r/LocalLLaMA**

Rules: read each subreddit's self-promotion rules first. Lead with the problem
and be honest that you built it. Do not paste the same text everywhere.

Title options:

- `I built an Android app for OpenHands so I can supervise my coding agent from my phone`
- `OpenHands had no mobile app, so I packaged the Agent Canvas as a sideloadable APK`

Body:

```
OpenHands runs agents great on a laptop, but there was no way to check on a run
from my phone. The Agent Canvas needs Docker and Node, so it can't run on-device.

So I packaged the existing Agent Canvas web UI in a Capacitor shell and shipped it
as an Android app. The agent still runs on your own server — the phone is just the
client. Sideload the APK, point it at your backend URL, done.

It's MIT licensed, no account, no telemetry, INTERNET permission only.

- Site + install steps: https://neto-dev66.github.io/Opanhand-mobile-/
- Source: https://github.com/NETO-DEV66/Opanhand-mobile-

Not affiliated with the OpenHands team, just a community wrapper. Feedback welcome.
```

### Hacker News (Show HN)

<https://news.ycombinator.com/submit>

- Title: `Show HN: AgentDeck – run OpenHands coding agents from Android`
- URL: `https://neto-dev66.github.io/Opanhand-mobile-/`

Be present in the comments. Answer technical questions honestly, including the
limitations (agent runs server-side, not on-device).

### Product Hunt

Launch with the banner and the demo video. Category: Developer Tools.

### X / Twitter

```
OpenHands had no mobile app. So I built one.

The agent still runs on your server — this is the client, in your pocket.

• Sideloadable APK, 6 MB
• MIT, no account, no telemetry
• Works with any OpenHands backend

https://neto-dev66.github.io/Opanhand-mobile-/
```

Attach the demo video. A video gets far more engagement than a link alone.

### The demo video

There is a rendered ad video available locally. Upload it to X, YouTube, or
Reddit as a native video — do not just link it. Native uploads rank and spread
much better.

---

## 5. Small wins, do them all

- **Stars.** A repo with 0 stars looks abandoned to both humans and Google. Ask
  a few developer friends to star it. 50 stars changes how it is perceived.
- **Repo social preview.** GitHub -> Settings -> Social preview -> upload
  `docs/promo/banner-wide-1600x900.png`. This is the card shown when the link is
  shared on X, WhatsApp, Slack or Discord. It has to be set in the web UI; the
  API does not expose it.
- **Keep releasing.** Google indexes active repositories more readily. Every
  release is a new page it can crawl.
- **Link from anywhere you are present.** Your personal site, a blog post, a
  comment where it is genuinely relevant, a gist.
- **Add real screenshots to the README** so image search can surface them.

---

## 6. Realistic timeline

| Timeframe | What to expect |
| --- | --- |
| 2-3 days | Google Search Console verifies; indexing requested |
| 1-2 weeks | Homepage appears for `site:neto-dev66.github.io` and brand searches |
| 1-2 months | Appears for long-tail queries like `openhands android app` |
| 3-6 months | Starts ranking competitively, if backlinks and stars grow |

There is no way to make this faster except backlinks and traffic. Anyone selling
a faster route is selling something that does not work.
