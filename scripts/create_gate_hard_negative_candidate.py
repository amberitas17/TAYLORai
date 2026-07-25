from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def image_files(path: Path) -> list[Path]:
    return [p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS]


def save_rgb(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, "JPEG", quality=90)


def add_negative_variants(src: Path, out_dir: Path, stem: str) -> int:
    try:
        img = Image.open(src).convert("RGB")
    except Exception:
        return 0

    w, h = img.size
    variants = [
        ("orig", img),
        ("blur", img.filter(ImageFilter.GaussianBlur(radius=3))),
        ("motion", img.filter(ImageFilter.BoxBlur(radius=5))),
        ("dark", ImageEnhance.Brightness(img).enhance(0.45)),
        ("bright", ImageEnhance.Brightness(img).enhance(1.65)),
        ("low_contrast", ImageEnhance.Contrast(img).enhance(0.55)),
    ]

    if w > 20 and h > 20:
        crop_boxes = [
            (0, 0, max(1, int(w * 0.55)), max(1, int(h * 0.55))),
            (max(0, int(w * 0.45)), 0, w, max(1, int(h * 0.55))),
            (0, max(0, int(h * 0.45)), max(1, int(w * 0.55)), h),
            (max(0, int(w * 0.45)), max(0, int(h * 0.45)), w, h),
        ]
        for idx, box in enumerate(crop_boxes):
            variants.append((f"partial_{idx}", img.crop(box).resize((w, h))))

    written = 0
    for suffix, variant in variants:
        save_rgb(variant, out_dir / f"{stem}_{suffix}.jpg")
        written += 1
    return written


def copy_exhibits(source_dir: Path, output_dir: Path, max_images: int, rng: random.Random) -> int:
    files = image_files(source_dir)
    rng.shuffle(files)
    selected = files[:max_images]
    output_dir.mkdir(parents=True, exist_ok=True)
    for src in selected:
        shutil.copy2(src, output_dir / f"{src.stem}_{abs(hash(str(src))) % 100000}{src.suffix.lower()}")
    return len(selected)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gate-dataset", type=Path, default=Path("gate_dataset"))
    parser.add_argument("--background-source", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("datasets/gate_hard_negative_candidate"))
    parser.add_argument("--max-exhibit-per-split", type=int, default=500)
    parser.add_argument("--max-background-source-per-split", type=int, default=80)
    parser.add_argument("--seed", type=int, default=123)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    reset_dir(args.output)

    background_files = image_files(args.background_source)
    rng.shuffle(background_files)

    for split in ("train", "val"):
        exhibit_count = copy_exhibits(
            args.gate_dataset / split / "exhibit",
            args.output / split / "exhibit",
            args.max_exhibit_per_split,
            rng,
        )

        split_bg = background_files[: args.max_background_source_per_split]
        background_files = background_files[args.max_background_source_per_split :] + split_bg
        negative_dir = args.output / split / "background"
        negative_count = 0
        for idx, src in enumerate(split_bg):
            negative_count += add_negative_variants(src, negative_dir, f"bg_{idx:04d}_{src.stem}")

        print(f"{split}: exhibit={exhibit_count} background_variants={negative_count}")

    print(f"Candidate hard-negative gate dataset: {args.output}")
    print("This dataset is not wired into the app until a candidate model is trained and manually promoted.")


if __name__ == "__main__":
    main()
