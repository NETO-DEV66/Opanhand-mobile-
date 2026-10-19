#!/usr/bin/env python3
"""Generate Android launcher icons and splash screens from this project's own
mark (tools/brand.py).

The upstream OpenHands logo is intentionally NOT used: this is an unofficial
packaging, so it carries its own identity and credits OpenHands in the README.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agentdeck")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def main():
    for name, size in DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{name}")
        os.makedirs(d, exist_ok=True)

        brand.tile(size).save(os.path.join(d, "ic_launcher.png"))
        brand.circle(size).save(os.path.join(d, "ic_launcher_round.png"))
        brand.foreground(ADAPTIVE[name]).save(
            os.path.join(d, "ic_launcher_foreground.png")
        )
        print(f"  mipmap-{name}: legacy {size}px, adaptive fg {ADAPTIVE[name]}px")

    for dirpath, _dirs, files in os.walk(RES):
        if "splash.png" not in files:
            continue
        p = os.path.join(dirpath, "splash.png")
        w, h = Image.open(p).size
        canvas = Image.new("RGBA", (w, h), brand.TILE)
        side = min(w, h) * 0.26
        off_x, off_y = (w - side) / 2, (h - side) / 2
        brand.draw_prompt(canvas, (off_x, off_y, side))
        canvas.save(p)
        print(f"  splash {os.path.relpath(p, RES)} -> {w}x{h} with mark")


if __name__ == "__main__":
    main()
