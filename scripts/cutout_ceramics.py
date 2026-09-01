#!/usr/bin/env python3
"""Create faithful transparent PNGs from the raster photos embedded in ceramics SVGs.

The originals remain untouched. The script learns a small palette from the outer
edge of each photograph, removes only matching pixels connected to that edge,
then softly feathers the resulting object mask for use on the portfolio.
"""

from __future__ import annotations

import argparse
import base64
from collections import deque
from io import BytesIO
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageFilter


EMBEDDED_IMAGE = re.compile(
    r'data:image/(?:jpeg|jpg|png);base64,([^\"\']+)', re.DOTALL | re.IGNORECASE
)


def embedded_photo(svg_path: Path) -> Image.Image:
    match = EMBEDDED_IMAGE.search(svg_path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError("no embedded photo found")
    payload = re.sub(r"\s+", "", match.group(1))
    return Image.open(BytesIO(base64.b64decode(payload))).convert("RGB")


def edge_samples(pixels: np.ndarray, edge: int = 18) -> np.ndarray:
    top = pixels[:edge].reshape(-1, 3)
    bottom = pixels[-edge:].reshape(-1, 3)
    left = pixels[edge:-edge, :edge].reshape(-1, 3)
    right = pixels[edge:-edge, -edge:].reshape(-1, 3)
    samples = np.concatenate((top, bottom, left, right), axis=0)
    return samples[:: max(1, len(samples) // 8000)].astype(np.float32)


def palette_from_edge(samples: np.ndarray, colors: int = 18) -> np.ndarray:
    """Deterministic k-means palette representing the studio backdrop."""
    luminance = samples @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    order = np.argsort(luminance)
    centers = samples[order[np.linspace(0, len(order) - 1, colors).astype(int)]].copy()
    for _ in range(12):
        distances = ((samples[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        labels = distances.argmin(axis=1)
        updated = centers.copy()
        for index in range(colors):
            members = samples[labels == index]
            if len(members):
                updated[index] = members.mean(axis=0)
        if np.allclose(updated, centers, atol=0.25):
            break
        centers = updated
    return centers


def flood_background(passable: np.ndarray) -> np.ndarray:
    height, width = passable.shape
    background = np.zeros_like(passable, dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if passable[0, x]: background[0, x] = True; queue.append((0, x))
        if passable[-1, x]: background[-1, x] = True; queue.append((height - 1, x))
    for y in range(1, height - 1):
        if passable[y, 0]: background[y, 0] = True; queue.append((y, 0))
        if passable[y, -1]: background[y, -1] = True; queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < height and 0 <= nx < width and passable[ny, nx] and not background[ny, nx]:
                background[ny, nx] = True
                queue.append((ny, nx))
    return background


def foreground_mask(photo: Image.Image) -> Image.Image:
    working = photo.copy()
    working.thumbnail((520, 520), Image.Resampling.LANCZOS)
    pixels = np.asarray(working, dtype=np.float32)
    palette = palette_from_edge(edge_samples(pixels))

    # Perceptual-ish RGB distance: people notice green differences most strongly.
    weights = np.array([0.8, 1.25, 0.7], dtype=np.float32)
    differences = (pixels[:, :, None, :] - palette[None, None, :, :]) * weights
    distance = np.sqrt((differences * differences).sum(axis=3)).min(axis=2)

    # Studio paper varies considerably; the palette plus a modest threshold keeps
    # that texture connected while stopping at the ceramic object's edge.
    background = flood_background(distance < 26)
    mask = Image.fromarray((~background).astype(np.uint8) * 255, mode="L")
    mask = mask.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(11))
    mask = mask.resize(photo.size, Image.Resampling.LANCZOS)
    return mask.filter(ImageFilter.GaussianBlur(1.15))


def trim_transparency(image: Image.Image, padding: int = 36) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
    if not bounds:
        return image
    left, top, right, bottom = bounds
    return image.crop((
        max(0, left - padding), max(0, top - padding),
        min(image.width, right + padding), min(image.height, bottom + padding),
    ))


def create_cutout(source: Path, destination: Path) -> None:
    photo = embedded_photo(source)
    photo.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
    mask = foreground_mask(photo)
    rgba = photo.convert("RGBA")
    rgba.putalpha(mask)
    trim_transparency(rgba).save(destination, "WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", default="assets/ceramics")
    parser.add_argument("output", nargs="?", default="assets/ceramics/cutouts")
    args = parser.parse_args()
    source = Path(args.source)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    completed = 0
    for svg_path in sorted(source.glob("*.svg")):
        if svg_path.stem == "profile":
            continue
        try:
            create_cutout(svg_path, output / f"{svg_path.stem}.webp")
            completed += 1
            print(f"Cut out {svg_path.stem}")
        except Exception as error:  # one bad legacy file should not stop the batch
            print(f"Skipped {svg_path.stem}: {error}")
    print(f"Created {completed} transparent images in {output}")


if __name__ == "__main__":
    main()
