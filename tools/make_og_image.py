#!/usr/bin/env python3
"""Build the 1200x630 Open Graph social preview card for the landing page."""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "og-image.png")

INK = (8, 8, 10)
INK_3 = (20, 20, 24)
LINE = (38, 38, 44)
TEXT = (240, 240, 242)
FAINT = (150, 150, 158)
ACCENT = (255, 194, 75)

W, H = 1200, 630


def font(size, bold=False):
    names = (["DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"] if bold
             else ["DejaVuSans.ttf", "LiberationSans-Regular.ttf"])
    for n in names:
        for d in ("/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation",
                  "/usr/share/fonts", ""):
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    canvas = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(canvas)

    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(8 + 8 * t), int(8 + 8 * t), int(10 + 12 * t)))

    d.rounded_rectangle((56, 56, W - 56, H - 56), radius=28, outline=LINE, width=2)
    d.rounded_rectangle((56, 56, 66, H - 56), radius=5, fill=ACCENT)

    logo = brand.tile(210)
    canvas.paste(logo, (112, 112), logo)

    d.text((112, 356), "OpenHands Mobile", font=font(78, True), fill=TEXT)
    d.text((114, 452), "Run AI coding agents from your phone", font=font(36), fill=FAINT)

    pill = "FREE  ·  OPEN SOURCE  ·  ANDROID 6.0+"
    f = font(23, True)
    tw = d.textlength(pill, font=f)
    d.rounded_rectangle((114, 512, 114 + tw + 44, 560), radius=24, fill=INK_3, outline=LINE, width=2)
    d.text((136, 526), pill, font=f, fill=ACCENT)

    url = "neto-dev66.github.io/Opanhand-mobile-"
    fu = font(26, True)
    uw = d.textlength(url, font=fu)
    d.text((W - 112 - uw, 524), url, font=fu, fill=FAINT)

    canvas.save(OUT, optimize=True)
    print(f"wrote {OUT} ({W}x{H}, {os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
