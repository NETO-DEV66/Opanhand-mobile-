#!/usr/bin/env python3
"""Generate the site favicon and app icons from this project's own mark."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "docs", "assets")


def main():
    os.makedirs(ASSETS, exist_ok=True)
    brand.tile(180).save(os.path.join(ASSETS, "favicon.png"))
    brand.tile(512).save(os.path.join(ASSETS, "icon-512.png"))
    brand.tile(32).save(os.path.join(ASSETS, "icon-32.png"))
    print("wrote favicon.png, icon-512.png, icon-32.png")


if __name__ == "__main__":
    main()
