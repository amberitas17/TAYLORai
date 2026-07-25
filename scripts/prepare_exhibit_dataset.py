"""
Prepare YOLO classification datasets from extracted Science Centre frames.

Outputs:
  datasets/gate_dataset/train|val/{exhibit,background}
  datasets/zone_dataset/train|val/{DWT,EAP,EGN}

Background images are synthesized when no external background dataset exists.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import shutil
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

MANIFEST_DEFAULT = Path(r"C:\Users\Administrator\Desktop\datasets\extracted frames\manifest.csv")
EXTERNAL_BACKGROUND_DEFAULT = Path(
    r"C:\Users\Administrator\Desktop\images.cv_wy6p0tm5ycotkipopzvn2i\data"
)
OUTPUT_DEFAULT = Path(__file__).resolve().parent.parent / "datasets"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

ZONE_FOLDER_TO_CODE = {
    "Hall_B_DWT_Dialogue_with_Time": "DWT",
    "Hall_B_EAP_Earth_Alive_Planet": "EAP",
    "Hall_B_EG_Energy_Story": "EGN",
}

BACKGROUND_KEYWORDS = (
    "walkthrough",
    "corridor",
    "dna_corridor",
    "img_",
    "vid20",
)

MIN_SECONDS_BETWEEN_FRAMES = 6.0
TRAIN_RATIO = 0.85
RANDOM_SEED = 42


def parse_exhibit_key(filename: str) -> str:
    stem = Path(filename).stem
    parts = stem.split("__")
    return parts[1] if len(parts) >= 2 else stem


def is_background_candidate(row: dict) -> bool:
    label = row["label"].lower()
    path_blob = f"{row['output_path']} {row['source_path']}".lower()
    if "corridor" in label or "dna" in label:
        return True
    return any(keyword in path_blob for keyword in BACKGROUND_KEYWORDS)


def laplacian_variance(image: Image.Image) -> float:
    gray = np.array(image.convert("L"), dtype=np.float32)
    laplacian = (
        -4 * gray
        + np.roll(gray, 1, axis=0)
        + np.roll(gray, -1, axis=0)
        + np.roll(gray, 1, axis=1)
        + np.roll(gray, -1, axis=1)
    )
    return float(laplacian.var())


def row_timestamp(row: dict) -> float:
    raw = (row.get("timestamp_seconds") or "").strip()
    if raw:
        try:
            return float(raw)
        except ValueError:
            pass
    try:
        return float(row.get("frame_index", 0)) / 30.0
    except (TypeError, ValueError):
        return 0.0


def dedupe_rows(rows: list[dict], min_seconds: float) -> list[dict]:
    kept: list[dict] = []
    last_timestamp_by_video: dict[str, float] = {}

    for row in sorted(rows, key=lambda r: (r["source_path"], row_timestamp(r))):
        video = row["source_path"]
        timestamp = row_timestamp(row)
        last_ts = last_timestamp_by_video.get(video)
        if last_ts is not None and timestamp - last_ts < min_seconds:
            continue
        last_timestamp_by_video[video] = timestamp
        kept.append(row)
    return kept


def split_by_video(rows: list[dict], train_ratio: float) -> tuple[list[dict], list[dict]]:
    videos = sorted({row["source_path"] for row in rows})
    rng = random.Random(RANDOM_SEED)
    rng.shuffle(videos)
    split_index = max(1, int(len(videos) * train_ratio))
    if len(videos) > 1 and split_index >= len(videos):
        split_index = len(videos) - 1

    train_videos = set(videos[:split_index])
    train_rows = [row for row in rows if row["source_path"] in train_videos]
    val_rows = [row for row in rows if row["source_path"] not in train_videos]
    return train_rows, val_rows


def copy_or_link(src: Path, dest: Path, use_symlinks: bool) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return
    if use_symlinks:
        dest.symlink_to(src)
    else:
        shutil.copy2(src, dest)


def save_synthetic_background(dest: Path, rng: random.Random, kind: str, source: Image.Image | None = None) -> None:
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
        image = source.convert("RGB")
        image = image.resize((224, 224))
        image = image.filter(ImageFilter.GaussianBlur(radius=rng.uniform(4, 10)))
        image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.4, 1.4))
    elif kind == "dark":
        image = Image.new("RGB", (224, 224), (rng.randint(0, 30),) * 3)
    else:
        image = Image.new("RGB", (224, 224), (127, 127, 127))

    image.save(dest, format="JPEG", quality=85)


def build_synthetic_backgrounds(
    dest_dir: Path,
    count: int,
    exhibit_sources: list[Path],
    prefix: str,
    rng: random.Random,
) -> int:
    dest_dir.mkdir(parents=True, exist_ok=True)
    kinds = ["solid", "noise", "gradient", "blur", "dark"]
    created = 0

    for index in range(count):
        dest = dest_dir / f"{prefix}_{index:04d}.jpg"
        if dest.exists():
            created += 1
            continue
        kind = kinds[index % len(kinds)]
        source = None
        if kind == "blur" and exhibit_sources:
            source = Image.open(rng.choice(exhibit_sources)).convert("RGB")
        save_synthetic_background(dest, rng, kind, source)
        created += 1
    return created


def collect_external_backgrounds(
    external_root: Path,
    max_train: int,
    max_val: int,
) -> tuple[list[Path], list[Path]]:
    if not external_root.exists():
        return [], []

    train_files = [
        path
        for path in (external_root / "train").rglob("*")
        if path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    val_files = [
        path
        for path in (external_root / "val").rglob("*")
        if path.suffix.lower() in IMAGE_EXTENSIONS
    ]

    rng = random.Random(RANDOM_SEED)
    rng.shuffle(train_files)
    rng.shuffle(val_files)
    return train_files[:max_train], val_files[:max_val]


def prepare_gate_dataset(
    rows: list[dict],
    output_dir: Path,
    use_symlinks: bool,
    max_exhibit_per_split: int,
    max_real_background_per_split: int,
    external_background_root: Path | None = None,
    max_external_background_train: int = 0,
    max_external_background_val: int = 0,
    max_synthetic_background_train: int | None = None,
    max_synthetic_background_val: int | None = None,
) -> dict:
    exhibit_rows = [row for row in rows if not is_background_candidate(row)]
    real_background_rows = [row for row in rows if is_background_candidate(row)]

    exhibit_rows = dedupe_rows(exhibit_rows, MIN_SECONDS_BETWEEN_FRAMES)
    real_background_rows = dedupe_rows(real_background_rows, MIN_SECONDS_BETWEEN_FRAMES)

    train_exhibit, val_exhibit = split_by_video(exhibit_rows, TRAIN_RATIO)
    train_background, val_background = split_by_video(real_background_rows, TRAIN_RATIO)

    rng = random.Random(RANDOM_SEED)
    rng.shuffle(train_exhibit)
    rng.shuffle(val_exhibit)
    train_exhibit = train_exhibit[:max_exhibit_per_split]
    val_exhibit = val_exhibit[: max(20, max_exhibit_per_split // 5)]

    train_background = train_background[:max_real_background_per_split]
    val_background = val_background[: max(10, max_real_background_per_split // 5)]

    exhibit_sources = [Path(row["output_path"]) for row in train_exhibit if Path(row["output_path"]).exists()]

    external_train, external_val = collect_external_backgrounds(
        external_background_root,
        max_external_background_train,
        max_external_background_val,
    )

    stats = {
        "train_exhibit_real": 0,
        "val_exhibit_real": 0,
        "train_background_video": 0,
        "val_background_video": 0,
        "train_background_external": 0,
        "val_background_external": 0,
        "train_background_synthetic": 0,
        "val_background_synthetic": 0,
    }

    for split_name, split_rows, class_name, stat_key in (
        ("train", train_exhibit, "exhibit", "train_exhibit_real"),
        ("val", val_exhibit, "exhibit", "val_exhibit_real"),
        ("train", train_background, "background", "train_background_video"),
        ("val", val_background, "background", "val_background_video"),
    ):
        for index, row in enumerate(split_rows):
            src = Path(row["output_path"])
            if not src.exists():
                continue
            dest = output_dir / split_name / class_name / f"{class_name}_{split_name}_{index:05d}.jpg"
            copy_or_link(src, dest, use_symlinks)
            stats[stat_key] += 1

    for split_name, split_files, stat_key, prefix in (
        ("train", external_train, "train_background_external", "external_train"),
        ("val", external_val, "val_background_external", "external_val"),
    ):
        for index, src in enumerate(split_files):
            if not src.exists():
                continue
            dest = output_dir / split_name / "background" / f"{prefix}_{index:05d}.jpg"
            copy_or_link(src, dest, use_symlinks)
            stats[stat_key] += 1

    train_background_total = (
        stats["train_background_video"]
        + stats["train_background_external"]
    )
    val_background_total = (
        stats["val_background_video"]
        + stats["val_background_external"]
    )

    if max_synthetic_background_train is None:
        max_synthetic_background_train = max(0, stats["train_exhibit_real"] - train_background_total)
    if max_synthetic_background_val is None:
        max_synthetic_background_val = max(0, stats["val_exhibit_real"] - val_background_total)

    stats["train_background_synthetic"] = build_synthetic_backgrounds(
        output_dir / "train" / "background",
        max_synthetic_background_train,
        exhibit_sources,
        "synthetic_train",
        rng,
    )
    stats["val_background_synthetic"] = build_synthetic_backgrounds(
        output_dir / "val" / "background",
        max_synthetic_background_val,
        exhibit_sources,
        "synthetic_val",
        rng,
    )
    return stats


def prepare_zone_dataset(
    rows: list[dict],
    output_dir: Path,
    use_symlinks: bool,
    max_per_class_per_split: int,
) -> dict:
    zone_rows = [row for row in rows if row["label"] in ZONE_FOLDER_TO_CODE]
    zone_rows = dedupe_rows(zone_rows, MIN_SECONDS_BETWEEN_FRAMES)

    by_zone: dict[str, list[dict]] = defaultdict(list)
    for row in zone_rows:
        by_zone[ZONE_FOLDER_TO_CODE[row["label"]]].append(row)

    stats: dict[str, int] = {}
    for zone_code, zone_items in sorted(by_zone.items()):
        train_rows, val_rows = split_by_video(zone_items, TRAIN_RATIO)
        rng = random.Random(RANDOM_SEED + hash(zone_code) % 1000)
        rng.shuffle(train_rows)
        rng.shuffle(val_rows)
        train_rows = train_rows[:max_per_class_per_split]
        val_rows = val_rows[: max(15, max_per_class_per_split // 5)]

        for split_name, split_rows in (("train", train_rows), ("val", val_rows)):
            for index, row in enumerate(split_rows):
                src = Path(row["output_path"])
                if not src.exists():
                    continue
                dest = output_dir / split_name / zone_code / f"{zone_code}_{split_name}_{index:05d}.jpg"
                copy_or_link(src, dest, use_symlinks)
                stats[f"{split_name}_{zone_code}"] = stats.get(f"{split_name}_{zone_code}", 0) + 1
    return stats


def write_dataset_readme(output_dir: Path) -> None:
    readme = output_dir / "README.md"
    readme.write_text(
        "\n".join(
            [
                "# Generated exhibit training datasets",
                "",
                "Created by `scripts/prepare_exhibit_dataset.py`.",
                "",
                "## Layout (YOLO classify format)",
                "",
                "```text",
                "gate_dataset/",
                "  train/exhibit/",
                "  train/background/",
                "  val/exhibit/",
                "  val/background/",
                "",
                "zone_dataset/",
                "  train/DWT/",
                "  train/EAP/",
                "  train/EGN/",
                "  val/DWT/",
                "  val/EAP/",
                "  val/EGN/",
                "```",
                "",
                "Background images combine corridor/walkthrough video frames, optional external",
                "background datasets, and a small amount of synthetic blur/noise when needed.",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare exhibit YOLO classification datasets")
    parser.add_argument("--manifest", type=Path, default=MANIFEST_DEFAULT)
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT)
    parser.add_argument("--copy", action="store_true", help="Copy images instead of creating symlinks")
    parser.add_argument("--max-exhibit", type=int, default=400, help="Max exhibit images per gate split")
    parser.add_argument("--max-zone-per-class", type=int, default=250, help="Max images per zone class per split")
    parser.add_argument(
        "--external-background",
        type=Path,
        default=EXTERNAL_BACKGROUND_DEFAULT,
        help="External background dataset root containing train/ and val/ folders",
    )
    parser.add_argument(
        "--max-external-background-train",
        type=int,
        default=450,
        help="Max external background images for gate train split",
    )
    parser.add_argument(
        "--max-external-background-val",
        type=int,
        default=90,
        help="Max external background images for gate val split",
    )
    parser.add_argument(
        "--max-synthetic-background-train",
        type=int,
        default=30,
        help="Synthetic background images to add on train split",
    )
    parser.add_argument(
        "--max-synthetic-background-val",
        type=int,
        default=10,
        help="Synthetic background images to add on val split",
    )
    parser.add_argument(
        "--gate-only",
        action="store_true",
        help="Only rebuild gate_dataset (leave zone_dataset untouched)",
    )
    args = parser.parse_args()

    if not args.manifest.exists():
        raise FileNotFoundError(f"Manifest not found: {args.manifest}")

    rows = list(csv.DictReader(args.manifest.open(encoding="utf-8")))
    output_dir = args.output
    gate_dir = output_dir / "gate_dataset"
    zone_dir = output_dir / "zone_dataset"

    if gate_dir.exists():
        shutil.rmtree(gate_dir)
    if not args.gate_only and zone_dir.exists():
        shutil.rmtree(zone_dir)

    external_background_root = args.external_background if args.external_background.exists() else None
    gate_stats = prepare_gate_dataset(
        rows,
        gate_dir,
        use_symlinks=not args.copy,
        max_exhibit_per_split=args.max_exhibit,
        max_real_background_per_split=80,
        external_background_root=external_background_root,
        max_external_background_train=args.max_external_background_train,
        max_external_background_val=args.max_external_background_val,
        max_synthetic_background_train=args.max_synthetic_background_train,
        max_synthetic_background_val=args.max_synthetic_background_val,
    )
    zone_stats = None
    if not args.gate_only:
        zone_stats = prepare_zone_dataset(
            rows,
            zone_dir,
            use_symlinks=not args.copy,
            max_per_class_per_split=args.max_zone_per_class,
        )

    summary = {
        "manifest": str(args.manifest),
        "external_background": str(external_background_root) if external_background_root else None,
        "output_dir": str(output_dir),
        "gate_dataset": gate_stats,
        "zone_dataset": zone_stats,
        "notes": [
            "YOLO classify expects train/ and val/ folders with one subfolder per class.",
            "Gate backgrounds use external dataset + corridor/walkthrough frames + small synthetic set.",
            "Splits are grouped by source video to reduce leakage.",
        ],
    }
    write_dataset_readme(output_dir)
    stats_path = output_dir / "dataset_stats.json"
    stats_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(json.dumps(summary, indent=2))
    print(f"\nWrote datasets to {output_dir}")
    print(f"Stats: {stats_path}")


if __name__ == "__main__":
    main()
