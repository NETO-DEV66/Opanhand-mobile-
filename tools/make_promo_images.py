#!/usr/bin/env python3
"""Build the promo art for docs/promo/ from the current AgentDeck brand.

The old PNGs shipped with the pre-rebrand "OpenHands Mobile / AI coding agents"
copy and a dead URL, so they are regenerated here from the same palette and mark
as the landing page and the OG card.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "promo")

INK = (8, 8, 10)
INK_3 = (20, 20, 24)
LINE = (38, 38, 44)
TEXT = (240, 240, 242)
FAINT = (150, 150, 158)
ACCENT = (255, 194, 75)
ACCENT_2 = (61, 220, 151)

URL = "neto-dev66.github.io/Opanhand-mobile-"


def font(size, bold=False):
    names = (["DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"] if bold
             else ["DejaVuSans.ttf", "LiberationSans-Regular.ttf"])
    for n in names:
        for d in ("/usr/share/fonts/truetype/dejavu",
                  "/usr/share/fonts/truetype/liberation",
                  "/usr/share/fonts", ""):
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def backdrop(w, h):
    canvas = Image.new("RGB", (w, h), INK)
    d = ImageDraw.Draw(canvas)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)],
               fill=(int(8 + 8 * t), int(8 + 8 * t), int(10 + 12 * t)))
    return canvas


def frame(d, w, h, m):
    d.rounded_rectangle((m, m, w - m, h - m), radius=int(m * 0.5), outline=LINE, width=2)
    d.rounded_rectangle((m, m, m + 10, h - m), radius=5, fill=ACCENT)


def wrap(text, f, max_w):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if f.getlength(trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def draw_lines(d, xy, text, f, fill, max_w, leading):
    x, y = xy
    for line in wrap(text, f, max_w):
        d.text((x, y), line, font=f, fill=fill)
        y += leading
    return y


def pill(d, x, y, text, f, fg=ACCENT, outline=LINE, bg=INK_3, pad=(22, 12)):
    tw = d.textlength(text, font=f)
    th = f.size
    box = (x, y, x + tw + pad[0] * 2, y + th + pad[1] * 2)
    d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=bg, outline=outline, width=2)
    d.text((x + pad[0], y + pad[1] - 2), text, font=f, fill=fg)
    return box[2]


def eyebrow(d, x, y, text, f):
    d.text((x, y), text, font=f, fill=ACCENT_2)


def footer_url(d, w, h, m, f):
    uw = d.textlength(URL, font=f)
    d.text((w - m - uw, h - m - f.size - 10), URL, font=f, fill=FAINT)


def wordmark(d, x, y, size):
    f = font(int(size), True)
    d.text((x, y), "AgentDeck", font=f, fill=TEXT)
    return f


def save(canvas, name):
    path = os.path.join(OUT, name)
    canvas.save(path, optimize=True)
    print(f"wrote {name} ({canvas.width}x{canvas.height}, {os.path.getsize(path)} bytes)")


# --------------------------------------------------------------------------- #

def hero(w, h, name, eyebrow_txt, headline, sub, badges, compact=False):
    m = 60 if w >= 1200 else 56
    canvas = backdrop(w, h)
    d = ImageDraw.Draw(canvas)
    frame(d, w, h, m)

    logo_s = int(w * 0.13)
    logo = brand.tile(logo_s)
    lx, ly = m + 52, m + 52
    canvas.paste(logo, (lx, ly), logo)

    f_eye = font(int(w * 0.020), True)
    eyebrow(d, lx + logo_s + 26, ly + int(logo_s * 0.16), eyebrow_txt, f_eye)
    wordmark(d, lx + logo_s + 26, ly + int(logo_s * 0.40), w * 0.058)

    ty = ly + logo_s + int(h * 0.055)
    f_h = font(int(w * (0.070 if compact else 0.078)), True)
    ty = draw_lines(d, (m + 52, ty), headline, f_h, TEXT, w - 2 * (m + 52), int(f_h.size * 1.18))

    f_s = font(int(w * 0.030))
    ty += int(h * 0.012)
    ty = draw_lines(d, (m + 52, ty), sub, f_s, FAINT, int((w - 2 * (m + 52)) * 0.86), int(f_s.size * 1.35))

    by = min(ty + int(h * 0.03), h - m - 150)
    f_b = font(int(w * 0.023), True)
    bx = m + 52
    for b in badges:
        nx = pill(d, bx, by, b, f_b)
        bx = nx + 16
        if bx > w - m - 60:
            bx = m + 52
            by += f_b.size + 40

    footer_url(d, w, h, m + 52, font(int(w * 0.024), True))
    save(canvas, name)


def list_slide(w, h, name, eyebrow_txt, heading, bullets, note=None):
    m = 56
    canvas = backdrop(w, h)
    d = ImageDraw.Draw(canvas)
    frame(d, w, h, m)

    x = m + 52
    y = m + 60
    eyebrow(d, x, y, eyebrow_txt, font(int(w * 0.026), True))
    y += int(h * 0.075)
    f_h = font(int(w * 0.082), True)
    y = draw_lines(d, (x, y), heading, f_h, TEXT, w - 2 * x, int(f_h.size * 1.15))

    y += int(h * 0.03)
    d.line([(x, y), (x + int(w * 0.12), y)], fill=ACCENT, width=5)
    y += int(h * 0.045)

    f_b = font(int(w * 0.031))
    for b in bullets:
        d.ellipse((x, y + int(f_b.size * 0.35), x + 14, y + int(f_b.size * 0.35) + 14), fill=ACCENT_2)
        draw_lines(d, (x + 40, y), b, f_b, TEXT, w - x - 40 - (m + 20), int(f_b.size * 1.3))
        y += int(f_b.size * 1.3) * len(wrap(b, f_b, w - x - 40 - (m + 20))) + int(h * 0.022)

    if note:
        f_n = font(int(w * 0.026))
        ny = h - m - 150
        d.rounded_rectangle((x, ny, w - x, ny + 96), radius=18, fill=INK_3, outline=LINE, width=2)
        draw_lines(d, (x + 24, ny + 24), note, f_n, FAINT, w - 2 * x - 48, int(f_n.size * 1.3))

    footer_url(d, w, h, m + 52, font(int(w * 0.024), True))
    save(canvas, name)


def steps_slide(w, h, name, steps, note):
    m = 56
    canvas = backdrop(w, h)
    d = ImageDraw.Draw(canvas)
    frame(d, w, h, m)

    x = m + 52
    y = m + 60
    eyebrow(d, x, y, "HOW IT WORKS", font(int(w * 0.026), True))
    y += int(h * 0.075)
    f_h = font(int(w * 0.088), True)
    d.text((x, y), "Two steps.", font=f_h, fill=TEXT)
    y += int(h * 0.095)

    for i, (title, body) in enumerate(steps, 1):
        d.rounded_rectangle((x, y, x + 56, y + 56), radius=16, fill=ACCENT)
        d.text((x + 20, y + 9), str(i), font=font(int(w * 0.038), True), fill=INK)
        tx = x + 84
        f_t = font(int(w * 0.040), True)
        d.text((tx, y + 2), title, font=f_t, fill=TEXT)
        f_b = font(int(w * 0.030))
        draw_lines(d, (tx, y + int(w * 0.055)), body, f_b, FAINT, w - tx - (m + 20), int(f_b.size * 1.32))
        y += int(h * 0.185)

    f_n = font(int(w * 0.028))
    ny = h - m - 190
    d.rounded_rectangle((x, ny, w - x, ny + 130), radius=18, fill=INK_3, outline=LINE, width=2)
    draw_lines(d, (x + 26, ny + 24), note, f_n, TEXT, w - 2 * x - 52, int(f_n.size * 1.32))

    footer_url(d, w, h, m + 52, font(int(w * 0.024), True))
    save(canvas, name)


def cta_slide(w, h, name, headline, sub):
    m = 56
    canvas = backdrop(w, h)
    d = ImageDraw.Draw(canvas)
    frame(d, w, h, m)
    x = m + 52

    logo_s = int(w * 0.15)
    logo = brand.tile(logo_s)
    canvas.paste(logo, (x, m + 60), logo)

    eyebrow(d, x, m + 60 + logo_s + 40, "FREE  ·  OPEN SOURCE", font(int(w * 0.026), True))
    y = m + 60 + logo_s + int(h * 0.10)
    f_h = font(int(w * 0.11), True)
    y = draw_lines(d, (x, y), headline, f_h, TEXT, w - 2 * x, int(f_h.size * 1.1))

    f_s = font(int(w * 0.032))
    y = draw_lines(d, (x, y + int(h * 0.02)), sub, f_s, FAINT, int((w - 2 * x) * 0.9), int(f_s.size * 1.35))

    f_b = font(int(w * 0.026), True)
    by = min(y + int(h * 0.04), h - m - 220)
    pill(d, x, by, "Download APK  →", f_b, fg=INK, bg=ACCENT, outline=ACCENT)

    f_t = font(int(w * 0.026), True)
    for i, b in enumerate(["5.7 MB", "Android 6.0+", "MIT licence"]):
        d.text((x + i * int(w * 0.26), by + 90), b, font=f_t, fill=ACCENT_2)

    wordmark(d, x, h - m - 120, w * 0.05)
    footer_url(d, w, h, m + 52, font(int(w * 0.024), True))
    save(canvas, name)


def flow_slide(w, h, name):
    """Schematic of the two-step setup, drawn from the brand palette. This is a
    diagram of the flow, not a photo of the app."""
    m = 56
    canvas = backdrop(w, h)
    d = ImageDraw.Draw(canvas)
    frame(d, w, h, m)
    x = m + 52

    eyebrow(d, x, m + 60, "LOOK INSIDE", font(int(w * 0.026), True))
    y = m + 60 + int(h * 0.075)
    f_h = font(int(w * 0.082), True)
    y = draw_lines(d, (x, y), "The setup, start to finish.", f_h, TEXT, w - 2 * x, int(f_h.size * 1.15))

    # Card 1 — pick a provider
    cy = y + int(h * 0.03)
    ch = int(h * 0.30)
    d.rounded_rectangle((x, cy, w - x, cy + ch), radius=20, fill=INK_3, outline=LINE, width=2)
    d.text((x + 26, cy + 22), "1 · Pick a provider", font=font(int(w * 0.032), True), fill=TEXT)
    chips = ["OpenAI", "Anthropic", "Gemini", "OpenRouter", "Groq", "DeepSeek",
             "Mistral", "xAI Grok", "Ollama", "Custom"]
    f_c = font(int(w * 0.024), True)
    gx, gy = x + 26, cy + 78
    for c in chips:
        nx = pill(d, gx, gy, c, f_c, fg=TEXT, pad=(16, 9))
        gx = nx + 12
        if gx > w - x - 40:
            gx = x + 26
            gy += f_c.size + 30

    # Card 2 — paste the key
    cy2 = cy + ch + int(h * 0.03)
    ch2 = int(h * 0.24)
    d.rounded_rectangle((x, cy2, w - x, cy2 + ch2), radius=20, fill=INK_3, outline=LINE, width=2)
    d.text((x + 26, cy2 + 22), "2 · Paste your API key", font=font(int(w * 0.032), True), fill=TEXT)
    field = (x + 26, cy2 + 84, w - x - 26, cy2 + 84 + int(h * 0.055))
    d.rounded_rectangle(field, radius=14, fill=INK, outline=LINE, width=2)
    d.text((field[0] + 20, field[1] + 16), "sk-••••••••••••••••••••••••", font=font(int(w * 0.026)), fill=FAINT)
    f_n = font(int(w * 0.024))
    d.text((x + 26, cy2 + ch2 - 44), "Ollama and Custom also take a base URL.", font=f_n, fill=ACCENT_2)

    f_b = font(int(w * 0.028))
    by = cy2 + ch2 + int(h * 0.035)
    d.text((x, by), "Then chat — replies stream in, and your key stays on the device.",
           font=f_b, fill=FAINT)

    footer_url(d, w, h, m + 52, font(int(w * 0.024), True))
    save(canvas, name)


def main():
    os.makedirs(OUT, exist_ok=True)

    # Wide banner (also the README hero).
    hero(1600, 900, "banner-wide-1600x900.png",
         "FREE  ·  OPEN SOURCE",
         "Your AI models, now in your pocket.",
         "Chat with any AI model, straight from your phone. Bring your own API key.",
         ["OpenAI", "Anthropic", "Gemini", "OpenRouter", "Groq", "DeepSeek",
          "Mistral", "xAI Grok", "Ollama", "Custom"],
         compact=True)

    # Single posts.
    hero(1080, 1350, "instagram-post-1080x1350.png",
         "FREE  ·  OPEN SOURCE",
         "Your AI models, now in your pocket.",
         "Pick a provider, paste your own API key, and chat.",
         ["5.7 MB", "Android 6.0+", "No account", "MIT licence"])
    hero(1080, 1080, "instagram-square-1080.png",
         "FREE  ·  OPEN SOURCE",
         "Your AI models, now in your pocket.",
         "Pick a provider, paste your own API key, and chat.",
         ["5.7 MB", "Android 6.0+", "No account", "MIT licence"])

    why_bullets = [
        "Pick a provider, paste a key",
        "Streaming replies, stop anytime",
        "Saved conversations on device",
        "Switch provider or model anytime",
        "Ollama and custom endpoints",
        "Lightweight: 5.7 MB",
        "Internet permission only",
        "No account, no telemetry",
        "Open source, MIT licence",
    ]
    list_slide(1080, 1350, "instagram-carousel-1-why-1080x1350.png",
               "WHY YOU'LL LIKE IT", "Small app. Real chat.", why_bullets)
    list_slide(1080, 1080, "instagram-square-why-1080.png",
               "WHY YOU'LL LIKE IT", "Small app. Real chat.", why_bullets)

    how_note = ("Good to know: this is a chat client. It needs an API key for a hosted "
                "provider (Ollama and Custom need none) and a working connection to it.")
    how_steps = [
        ("Pick a provider",
         "OpenAI, Anthropic, Gemini, OpenRouter, Groq, DeepSeek, Mistral, xAI Grok, "
         "Ollama or a custom OpenAI-compatible endpoint."),
        ("Paste your API key",
         "Enter the key for that provider. Ollama and Custom also let you set a base URL."),
    ]
    steps_slide(1080, 1350, "instagram-carousel-2-how-1080x1350.png", how_steps, how_note)
    steps_slide(1080, 1080, "instagram-square-how-1080.png", how_steps, how_note)

    cta_sub = "Chat with the AI models you already use. No server to run, no account to create."
    cta_slide(1080, 1350, "instagram-carousel-3-download-1080x1350.png", "Get it now.", cta_sub)
    cta_slide(1080, 1080, "instagram-square-download-1080.png", "Get it now.", cta_sub)

    flow_slide(1080, 1350, "instagram-carousel-4-screens-1080x1350.png")
    flow_slide(1080, 1080, "instagram-square-screens-1080.png")


if __name__ == "__main__":
    main()
