"""
Build the binary gate_dataset (exhibit vs background) described in
START_EXHIBIT_GATE.md, using the already-organized ARICC exhibit frames
as the "exhibit" class and synthetically generated frames as "background".

Outputs:
  gate_dataset/train/exhibit
  gate_dataset/train/background
  gate_dataset/val/exhibit
  gate_dataset/val/background
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

SCRIPT_DIR = Path(__file__).resolve().parent
EXHIBIT_SOURCE_DEFAULT = SCRIPT_DIR / "hierarchical_dataset" / "ARICC"
OUTPUT_DEFAULT = SCRIPT_DIR / "gate_dataset"
RANDOM_SEED = 42


def collect_exhibit_images(source_root: Path) -> list[Path]:
    class_dirs = sorted(d for d in source_root.iterdir() if d.is_dir())
    images: list[Path] = []
    for class_dir in class_dirs:
        images.extend(sorted(class_dir.glob("*.jpg")))
    return images


def sample_balanced_exhibit_images(source_root: Path, total: int, rng: random.Random) -> list[Path]:
    class_dirs = sorted(d for d in source_root.iterdir() if d.is_dir())
    per_class = max(1, total // len(class_dirs))
    picked: list[Path] = []
    for class_dir in class_dirs:
        images = sorted(class_dir.glob("*.jpg"))
        rng.shuffle(images)
        picked.extend(images[:per_class])
    rng.shuffle(picked)
    return picked[:total]


def save_synthetic_background(dest: Path, rng: random.Random, kind: str, source: Image.Image | None) -> None:
    if kind == "solid":
        color = tuple(rng.randint(0, 255) for _ in range(3))
        image = Image.new("RGB", (224, 224), color)
    elif kind == "noise":
        noise_rng = np.random.default_rng(rng.randint(0, 2**31 - 1))
        array = noise_rng.integers(0, 256, size=(224, 224, 3), dtype=np.uint8)
        image = Image.fromarray(array, mode="RGB")
    elif kind == "gradient":
        start = np.array([rng.randint(0, 255) for _ in range(3)], dtype=np.float32)
        end = np.array([rng.randint(0, 255) for _ in range(3)], dtype=np.float32)
        ramp = np.linspace(0.0, 1.0, 224, dtype=np.float32)
        array = (start[None, :] * (1 - ramp[:, None]) + end[None, :] * ramp[:, None]).astype(np.uint8)
        array = np.tile(array[:, None, :], (1, 224, 1))
        image = Image.fromarray(array)
    elif kind == "blur" and source is not None:
        image = source.convert("RGB").resize((224, 224))
        image = image.filter(ImageFilter.GaussianBlur(radius=rng.uniform(4, 10)))
        image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.4, 1.4))
    elif kind == "dark":
        image = Image.new("RGB", (224, 224), (rng.randint(0, 30),) * 3)
    else:
        image = Image.new("RGB", (224, 224), (127, 127, 127))

    image.save(dest, format="JPEG", quality=85)


def build_backgrounds(dest_dir: Path, count: int, exhibit_pool: list[Path], rng: random.Random) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    kinds = ["solid", "noise", "gradient", "blur", "dark"]
    for index in range(count):
        kind = kinds[index % len(kinds)]
        source = Image.open(rng.choice(exhibit_pool)).convert("RGB") if kind == "blur" and exhibit_pool else None
        save_synthetic_background(dest_dir / f"background_{index:04d}.jpg", rng, kind, source)


def build_exhibit_split(dest_dir: Path, images: list[Path]) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for index, src in enumerate(images):
        dest = dest_dir / f"exhibit_{index:04d}.jpg"
        dest.write_bytes(src.read_bytes())


def main() -> None:
    parser = argparse.ArgumentParser(description="Build gate_dataset (exhibit vs background)")
    parser.add_argument("--source", type=Path, default=EXHIBIT_SOURCE_DEFAULT)
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT)
    parser.add_argument("--train-count", type=int, default=200)
    parser.add_argument("--val-count", type=int, default=50)
    args = parser.parse_args()

    if not args.source.exists():
        raise FileNotFoundError(f"Exhibit source folder not found: {args.source}")

    rng = random.Random(RANDOM_SEED)

    train_exhibit = sample_balanced_exhibit_images(args.source, args.train_count, rng)
    remaining_pool = [p for p in collect_exhibit_images(args.source) if p not in set(train_exhibit)]
    rng.shuffle(remaining_pool)
    val_exhibit = remaining_pool[: args.val_count]

    build_exhibit_split(args.output / "train" / "exhibit", train_exhibit)
    build_exhibit_split(args.output / "val" / "exhibit", val_exhibit)

    build_backgrounds(args.output / "train" / "background", args.train_count, train_exhibit, rng)
    build_backgrounds(args.output / "val" / "background", args.val_count, val_exhibit, rng)

    print(f"train/exhibit:    {len(train_exhibit)} images")
    print(f"train/background: {args.train_count} images")
    print(f"val/exhibit:      {len(val_exhibit)} images")
    print(f"val/background:   {args.val_count} images")
    print(f"\nDataset ready at: {args.output}")


if __name__ == "__main__":
    main()
