#!/usr/bin/env python3
"""Generate Android launcher icons and splash screens from the official
OpenHands mark (OpenHands-main/public/android-chrome-512x512.png)."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "OpenHands-main")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
SRC = os.path.join(ROOT, "public", "android-chrome-512x512.png")
BG = (255, 255, 255, 255)

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def mark():
    im = Image.open(SRC).convert("RGBA")
    return im.crop(im.getbbox())


def fit(logo, box_w, box_h):
    """Scale the mark to fit inside the given box, preserving aspect."""
    s = min(box_w / logo.width, box_h / logo.height)
    return logo.resize((max(1, round(logo.width * s)), max(1, round(logo.height * s))), Image.LANCZOS)


def paste_center(canvas, art):
    canvas.alpha_composite(art, ((canvas.width - art.width) // 2,
                                 (canvas.height - art.height) // 2))


def circle_mask(size):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def main():
    logo = mark()
    print(f"official mark cropped to {logo.size}")

    for name, size in DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{name}")
        os.makedirs(d, exist_ok=True)

        square = Image.new("RGBA", (size, size), BG)
        paste_center(square, fit(logo, size * 0.72, size * 0.72))
        square.save(os.path.join(d, "ic_launcher.png"))

        round_ic = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        disc = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        disc.paste(BG, (0, 0, size, size), circle_mask(size))
        round_ic.alpha_composite(disc)
        paste_center(round_ic, fit(logo, size * 0.60, size * 0.60))
        round_ic.save(os.path.join(d, "ic_launcher_round.png"))

        fg = Image.new("RGBA", (ADAPTIVE[name], ADAPTIVE[name]), (0, 0, 0, 0))
        safe = ADAPTIVE[name] * 0.60
        paste_center(fg, fit(logo, safe, safe))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))

        print(f"  mipmap-{name}: legacy {size}px, adaptive fg {ADAPTIVE[name]}px")

    for dirpath, _dirs, files in os.walk(RES):
        if "splash.png" not in files:
            continue
        p = os.path.join(dirpath, "splash.png")
        w, h = Image.open(p).size
        canvas = Image.new("RGBA", (w, h), BG)
        s = min(w, h) * 0.26
        paste_center(canvas, fit(logo, s, s))
        canvas.save(p)
        print(f"  splash {os.path.relpath(p, RES)} -> {w}x{h} with mark")


if __name__ == "__main__":
    main()
