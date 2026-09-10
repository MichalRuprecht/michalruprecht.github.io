#!/usr/bin/env python3
"""Build small, modern assets used on the portfolio's initial page load."""

from __future__ import annotations

from pathlib import Path
import re
from urllib.request import urlopen

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
FONT_URLS = {
    "dm-sans-latin.woff2": "https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXg.woff2",
    "newsreader-latin.woff2": "https://fonts.gstatic.com/s/newsreader/v26/cY9AfjOCX1hbuyalUrK4397yjIJFJpc.woff2",
}


def featured_clips() -> list[int]:
    text = (ROOT / "_data" / "portfolio.yml").read_text(encoding="utf-8")
    match = re.search(r"(?ms)^featured_ids:\s*\n(?P<items>(?:\s+-\s+[^\n]+\n)+)", text)
    if not match:
        raise RuntimeError("No featured_ids list found in _data/portfolio.yml")
    return [int(value) for value in re.findall(r"\d+", match.group("items"))]


def all_clip_ids() -> list[str]:
    return sorted(
        (
            path.stem
            for path in (ROOT / "pages" / "clips").glob("*.md")
            if path.stem.isdigit()
        ),
        key=int,
    )


def download_fonts() -> None:
    destination = ROOT / "assets" / "fonts"
    destination.mkdir(parents=True, exist_ok=True)
    for filename, url in FONT_URLS.items():
        font_path = destination / filename
        if font_path.exists() and font_path.stat().st_size >= 10_000:
            continue
        with urlopen(url, timeout=30) as response:
            payload = response.read()
        if len(payload) < 10_000:
            raise RuntimeError(f"Downloaded font is unexpectedly small: {filename}")
        font_path.write_bytes(payload)


def open_image(path: str) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(ROOT / path))


def resize_width(image: Image.Image, width: int) -> Image.Image:
    if image.width <= width:
        return image.copy()
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def save_webp(image: Image.Image, path: str, quality: int = 76) -> None:
    destination = ROOT / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=quality, method=6)


def build_images() -> None:
    profile = open_image("assets/profile.jpg").crop((0, 252, 1641, 2048))
    save_webp(resize_width(profile, 480), "assets/images/profile-hero-480.webp", 76)
    save_webp(resize_width(profile, 720), "assets/images/profile-hero.webp", 78)

    # Give search engines a choice of high-resolution portrait crops in the
    # aspect ratios Google recommends for profile imagery. These are separate
    # from the visible hero asset so search/social metadata never changes the
    # homepage design.
    profile_search_crops = (
        ((1200, 1200), (0.5, 0.45), "assets/images/michal-ruprecht-1x1.webp"),
        ((1200, 900), (0.5, 0.40), "assets/images/michal-ruprecht-4x3.webp"),
        ((1200, 675), (0.5, 0.21), "assets/images/michal-ruprecht-16x9.webp"),
    )
    for dimensions, centering, destination in profile_search_crops:
        crop = ImageOps.fit(profile, dimensions, Image.Resampling.LANCZOS, centering=centering)
        save_webp(crop, destination, 82)

    supporting_images = (
        ("assets/photos/cnn-sanjay-gupta-crop.jpg", "assets/photos/cnn-sanjay-gupta-320.webp", 320, 72),
        ("assets/photos/cnn-sanjay-gupta-crop.jpg", "assets/photos/cnn-sanjay-gupta.webp", 480, 72),
        ("assets/photos/npr-tiny-desk.jpg", "assets/photos/npr-tiny-desk-320.webp", 320, 70),
        ("assets/photos/npr-tiny-desk.jpg", "assets/photos/npr-tiny-desk.webp", 600, 70),
        ("assets/photos/reporting-uganda-lake-victoria.jpg", "assets/photos/reporting-uganda-lake-victoria-520.webp", 520, 72),
        ("assets/photos/reporting-uganda-lake-victoria.jpg", "assets/photos/reporting-uganda-lake-victoria.webp", 720, 72),
        ("assets/ceramics/cutouts-v2/fluc_b.webp", "assets/ceramics/cutouts-v2/fluc_b-720.webp", 720, 76),
    )
    for source, destination, width, quality in supporting_images:
        save_webp(resize_width(open_image(source), width), destination, quality)

    derivatives = []
    for clip_id in all_clip_ids():
        image = open_image(f"pages/clips/assets/photo/{clip_id}.jpg")
        mobile = resize_width(image, 480)
        standard = resize_width(image, 720)
        save_webp(mobile, f"assets/images/reporting/{clip_id}-480.webp", 72)
        save_webp(standard, f"assets/images/reporting/{clip_id}.webp", 74)
        derivatives.extend((
            f'  "{clip_id}":',
            f'    path_480: /assets/images/reporting/{clip_id}-480.webp',
            f'    width_480: {mobile.width}',
            f'    height_480: {mobile.height}',
            f'    path: /assets/images/reporting/{clip_id}.webp',
            f'    width: {standard.width}',
            f'    height: {standard.height}',
        ))

    data_path = ROOT / "_data" / "image_derivatives.yml"
    data_path.write_text("reporting:\n" + "\n".join(derivatives) + "\n", encoding="utf-8")


def main() -> None:
    download_fonts()
    build_images()
    print("Built local fonts and optimized initial-load images.")


if __name__ == "__main__":
    main()
