"""Create timestamped contact sheets for manual walkthrough review."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DEFAULT_ROOT = Path("documentation/datasets/Landmark Recognition/landmark_recognition")
THUMBNAIL_SIZE = (180, 320)
CELL_SIZE = (200, 360)


def frame_timestamp(frame: Path) -> str:
    return frame.stem.rsplit("__t", 1)[-1]


def make_sheet(frame_dir: Path, output: Path, columns: int) -> None:
    frames = sorted(frame_dir.glob("*.jpg"), key=lambda path: float(frame_timestamp(path)))
    if not frames:
        return
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGB", (columns * CELL_SIZE[0], rows * CELL_SIZE[1]), "white")
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        image = Image.open(frame).convert("RGB")
        image.thumbnail(THUMBNAIL_SIZE)
        x = (index % columns) * CELL_SIZE[0] + (CELL_SIZE[0] - image.width) // 2
        y = (index // columns) * CELL_SIZE[1] + 4
        sheet.paste(image, (x, y))
        draw.text(((index % columns) * CELL_SIZE[0] + 8, y + image.height + 6), f"t={frame_timestamp(frame)}s", fill="black")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=90)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--columns", type=int, default=6)
    args = parser.parse_args()
    frames_root = args.root / "frames"
    output_root = args.root / "contact_sheets"
    for frame_dir in sorted((path for path in frames_root.iterdir() if path.is_dir()), key=lambda path: path.name):
        make_sheet(frame_dir, output_root / f"{frame_dir.name}.jpg", args.columns)
    print(f"Contact sheets: {output_root}")


if __name__ == "__main__":
    main()