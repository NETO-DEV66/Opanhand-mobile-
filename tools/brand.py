#!/usr/bin/env python3
"""The app's own mark: a terminal prompt on a dark tile.

Deliberately not the OpenHands logo. This repository is an unofficial
packaging of their app, so it ships its own identity and credits the upstream
project in the README rather than reusing its artwork.
"""
from PIL import Image, ImageDraw

TILE = (16, 16, 20, 255)
ACCENT = (255, 194, 75, 255)


def _capped_line(draw, p1, p2, width, fill):
    """A line with round caps. PIL's line() draws square ends, which look
    chipped at icon sizes."""
    draw.line([p1, p2], fill=fill, width=width)
    r = width / 2
    for x, y in (p1, p2):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def draw_prompt(canvas, box, stroke_ratio=0.13):
    """Draw a '>_' prompt centred in `canvas`, sized to the square `box`."""
    d = ImageDraw.Draw(canvas)
    x, y, side = box
    w = max(2, round(side * stroke_ratio))

    # The chevron occupies the left two thirds, the underscore the right third.
    left = x + side * 0.10
    mid_x = x + side * 0.46
    top = y + side * 0.14
    bottom = y + side * 0.86
    middle = y + side * 0.50

    _capped_line(d, (left, top), (mid_x, middle), w, ACCENT)
    _capped_line(d, (mid_x, middle), (left, bottom), w, ACCENT)
    _capped_line(d, (x + side * 0.58, bottom), (x + side * 0.94, bottom), w, ACCENT)
    return canvas


def tile(size, glyph_ratio=0.78):
    """A square tile: dark background with the prompt mark centred."""
    canvas = Image.new("RGBA", (size, size), TILE)
    side = size * glyph_ratio
    off = (size - side) / 2
    return draw_prompt(canvas, (off, off, side))


def circle(size, glyph_ratio=0.62):
    """A circular tile, for the round launcher icon."""
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)

    disc = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    disc.paste(TILE, (0, 0, size, size), mask)
    side = size * glyph_ratio
    off = (size - side) / 2
    return draw_prompt(disc, (off, off, side))


def foreground(size, glyph_ratio=0.46):
    """Transparent canvas for an adaptive icon foreground. The glyph stays
    inside the 66/108 safe zone so no launcher shape clips it."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    side = size * glyph_ratio
    off = (size - side) / 2
    return draw_prompt(canvas, (off, off, side))
