#!/usr/bin/env python3
"""Extract content images from Gmail-printed masterclass PDFs (drops headers/footers)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("Install pymupdf: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT_ROOT = PUBLIC / "guides" / "masterclass"
MANIFEST_PUBLIC = OUT_ROOT / "manifest.json"
MANIFEST_SRC = ROOT / "src" / "data" / "masterclassManifest.json"

SOURCES = {
    "part-2": PUBLIC / "Lawn Masterclass Part 2.pdf",
    "part-3": PUBLIC / "Lawn Masterclass Part 3.pdf",
    "part-4": PUBLIC / "Lawn Masterclass Part 4.pdf",
    "part-5": PUBLIC / "Lawn Masterclass Part 5.pdf",
}


def image_blocks(page: fitz.Page) -> list[tuple[tuple[float, float, float, float], int]]:
    """Return (bbox, xref) for each image on the page, top-to-bottom."""
    blocks: list[tuple[tuple[float, float, float, float], int]] = []
    for xref in page.get_images(full=True):
        xref_id = xref[0]
        for rect in page.get_image_rects(xref_id):
            blocks.append((tuple(rect), xref_id))
    blocks.sort(key=lambda item: (item[0][1], item[0][0]))
    return blocks


def save_extracted_image(doc: fitz.Document, xref: int, out_path: Path) -> None:
    info = doc.extract_image(xref)
    ext = info["ext"].lower()
    image_bytes = info["image"]

    if ext == "webp":
        out_path.write_bytes(image_bytes)
        return

    try:
        from io import BytesIO

        from PIL import Image

        img = Image.open(BytesIO(image_bytes))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.save(out_path, "WEBP", quality=85, method=6)
    except ImportError:
        # Fallback: keep original format if Pillow is unavailable
        fallback = out_path.with_suffix(f".{ext}")
        fallback.write_bytes(image_bytes)
        if fallback != out_path:
            fallback.replace(out_path)


def keep_image(page_index: int, page_count: int, bbox: tuple[float, float, float, float]) -> bool:
    x0, y0, x1, y1 = bbox
    width = x1 - x0
    height = y1 - y0

    if width < 60 or height < 60:
        return False

    # Gmail logo on page 1
    if page_index == 0 and x0 < 150 and y0 < 100:
        return False

    # Final page is usually unsubscribe / address footer only
    if page_index == page_count - 1:
        return False

    # Thin header strips on the first page (logo bar, spacers)
    if page_index == 0 and height < 120:
        return False

    # Gmail footer chrome at the bottom of content pages
    if y0 > 520 and height < 150:
        return False

    return True


def extract_part(part_id: str, pdf_path: Path) -> list[str]:
    out_dir = OUT_ROOT / part_id
    out_dir.mkdir(parents=True, exist_ok=True)

    for old in out_dir.glob("*.webp"):
        old.unlink()

    doc = fitz.open(pdf_path)
    paths: list[str] = []
    index = 1

    for page_index in range(len(doc)):
        page = doc[page_index]
        for bbox, xref in image_blocks(page):
            if not keep_image(page_index, len(doc), bbox):
                continue

            filename = f"{index:02d}.webp"
            out_path = out_dir / filename
            save_extracted_image(doc, xref, out_path)
            paths.append(f"/guides/masterclass/{part_id}/{filename}")
            index += 1

    doc.close()
    return paths


def main() -> None:
    manifest: dict[str, list[str]] = {}

    for part_id, pdf_path in SOURCES.items():
        if not pdf_path.exists():
            print(f"Missing {pdf_path}", file=sys.stderr)
            sys.exit(1)
        manifest[part_id] = extract_part(part_id, pdf_path)
        print(f"{part_id}: {len(manifest[part_id])} images")

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    manifest_json = json.dumps(manifest, indent=2)
    MANIFEST_PUBLIC.write_text(manifest_json, encoding="utf-8")
    MANIFEST_SRC.write_text(manifest_json, encoding="utf-8")
    print(f"Wrote {MANIFEST_PUBLIC}")
    print(f"Wrote {MANIFEST_SRC}")


if __name__ == "__main__":
    main()
