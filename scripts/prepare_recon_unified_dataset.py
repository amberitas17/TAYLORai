"""Prepare and audit the unified individual-exhibit RECON dataset."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import cv2
from PIL import Image
from pillow_heif import register_heif_opener


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "RECON"
MANIFEST = SOURCE_DIR / "ocr_labels.json"
OUTPUT_DIR = ROOT / "runs" / "recon_unified_dataset"
CONTACT_DIR = OUTPUT_DIR / "contact_sheets"
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic", ".heif", ".mov", ".mp4", ".avi", ".mkv"}
VIDEO_EXTENSIONS = {".mov", ".mp4", ".avi", ".mkv"}


def read_image(path: Path):
    if path.suffix.lower() in {".heic", ".heif"}:
        register_heif_opener()
        with Image.open(path) as image:
            import numpy as np
            return cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    return cv2.imread(str(path))


def crop(frame, box: list[float]):
    height, width = frame.shape[:2]
    left, top, right, bottom = [float(value) for value in box]
    left, right = sorted((max(0, round(left * width)), min(width, round(right * width))))
    top, bottom = sorted((max(0, round(top * height)), min(height, round(bottom * height))))
    return frame[top:bottom, left:right]


def different(current, previous, threshold: float) -> bool:
    if previous is None:
        return True
    current = cv2.resize(cv2.cvtColor(current, cv2.COLOR_BGR2GRAY), (32, 32))
    previous = cv2.resize(cv2.cvtColor(previous, cv2.COLOR_BGR2GRAY), (32, 32))
    return float(cv2.absdiff(current, previous).mean()) >= threshold


def write_sample(frame, split: str, label: str, source: str, token: str, counts: dict) -> Path:
    destination = OUTPUT_DIR / split / label / f"{source}__{token}.jpg"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(destination), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
        raise RuntimeError(f"Could not write {destination}")
    counts[split][label] = counts[split].get(label, 0) + 1
    return destination


def extract_video(path: Path, record: dict, args: argparse.Namespace, counts: dict, source_splits: dict, samples: list, excluded_classes: set[str]):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {path}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total / fps
    spatial = record.get("spatial_regions")
    spatial_segments = record.get("spatial_segments")
    config = record.get("spatial_split", {})
    validation_start = float(config.get("validation_start_seconds", duration * 0.8))
    validation_end = min(duration, float(config.get("validation_end_seconds", duration)))
    interval = float(config.get("selection_interval_seconds", args.interval))
    threshold = float(config.get("deduplicate_threshold", args.deduplicate_threshold))
    source_splits[path.name] = {"train": [0, validation_start], "val": [validation_start, validation_end]}
    previous = {}
    index = 0
    second = 0.0
    segment_list = spatial_segments or ([{"start_seconds": 0, "end_seconds": validation_end, "regions": spatial}] if spatial else None)
    while second < validation_end:
        frame_index = min(total - 1, round(second * fps))
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = capture.read()
        if not ok:
            second += interval
            continue
        if segment_list:
            active = next((segment for segment in segment_list if segment["start_seconds"] <= second < segment["end_seconds"]), None)
            if active is None:
                second += interval
                continue
            segment_start = float(active["start_seconds"])
            segment_end = float(active["end_seconds"])
            split = "val" if second >= segment_start + (segment_end - segment_start) * 0.8 else "train"
            regions = active["regions"]
        else:
            split = "val" if second >= validation_start else "train"
            regions = [{"label": record["label"], "box": [0, 0, 1, 1]}]
        for region in regions:
            label = region["label"]
            if label in excluded_classes:
                continue
            image = crop(frame, region["box"]) if (spatial or spatial_segments) else frame
            if not different(image, previous.get(label), threshold):
                continue
            previous[label] = image.copy()
            token = f"f{frame_index:06d}"
            write_sample(image, split, label, path.stem, token, counts)
            samples.append({"source": path.name, "frame": frame_index, "seconds": round(second, 3), "split": split, "label": label})
        second += interval
    capture.release()


def extract_image(path: Path, record: dict, counts: dict, samples: list, excluded_classes: set[str]):
    image = read_image(path)
    if image is None:
        raise RuntimeError(f"Could not read {path}")
    regions = record.get("spatial_regions") or [{"label": record["label"], "box": [0, 0, 1, 1]}]
    for index, region in enumerate(regions):
        if region["label"] in excluded_classes:
            continue
        value = crop(image, region["box"]) if record.get("spatial_regions") else image
        write_sample(value, "train", region["label"], path.stem, f"image{index:02d}", counts)
        samples.append({"source": path.name, "frame": None, "seconds": None, "split": "train", "label": region["label"]})


def contact_sheets(classes: list[str]):
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    for label in classes:
        files = sorted(OUTPUT_DIR.glob(f"*/{label}/*.jpg"))
        if not files:
            continue
        tiles = []
        for path in files:
            image = cv2.imread(str(path))
            image = cv2.resize(image, (180, 240))
            cv2.putText(image, path.parent.parent.name, (4, 18), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1, cv2.LINE_AA)
            tiles.append(image)
        columns = 5
        rows = math.ceil(len(tiles) / columns)
        blank = tiles[0].copy() * 0
        while len(tiles) % columns:
            tiles.append(blank.copy())
        sheet = cv2.vconcat([cv2.hconcat(tiles[row * columns:(row + 1) * columns]) for row in range(rows)])
        cv2.imwrite(str(CONTACT_DIR / f"{label}.jpg"), sheet)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=float, default=0.5)
    parser.add_argument("--deduplicate-threshold", type=float, default=4.0)
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    counts = {"train": {}, "val": {}}
    samples = []
    source_splits = {}
    unresolved = []
    excluded_classes = {
        record["label"]
        for record in manifest.values()
        if record.get("label") and record.get("trainable") is False
    }
    for record in manifest.values():
        for region in record.get("spatial_regions", []):
            if region.get("trainable") is False:
                excluded_classes.add(region["label"])
        for segment in record.get("spatial_segments", []):
            for region in segment.get("regions", []):
                if region.get("trainable") is False:
                    excluded_classes.add(region["label"])
    excluded_classes = sorted(excluded_classes)
    source_files = {path.name: path for path in SOURCE_DIR.iterdir() if path.is_file() and path.suffix.lower() in MEDIA_EXTENSIONS}
    for name, path in sorted(source_files.items(), key=lambda item: item[0].casefold()):
        record = manifest.get(name)
        if not record:
            unresolved.append({"source": name, "reason": "missing manifest entry"})
            continue
        if record.get("review_required"):
            unresolved.append({"source": name, "reason": record.get("reason", "manifest review required")})
            continue
        if record.get("trainable") is False:
            continue
        if not record.get("label") and not record.get("spatial_regions") and not record.get("spatial_segments"):
            unresolved.append({"source": name, "reason": "no label or spatial regions"})
            continue
        if path.suffix.lower() in VIDEO_EXTENSIONS:
            extract_video(path, record, args, counts, source_splits, samples, set(excluded_classes))
        else:
            extract_image(path, record, counts, samples, set(excluded_classes))

    classes = sorted(set(counts["train"]) | set(counts["val"]))
    hashes = {}
    duplicate_samples = []
    conflicting_labels = []
    for path in OUTPUT_DIR.glob("train/*/*.jpg"):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes.setdefault(digest, []).append(("train", path.parent.name, path.name))
    for path in OUTPUT_DIR.glob("val/*/*.jpg"):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes.setdefault(digest, []).append(("val", path.parent.name, path.name))
    for items in hashes.values():
        if len(items) > 1:
            duplicate_samples.append(items)
            if len({item[1] for item in items}) > 1:
                conflicting_labels.append(items)
    insufficient = [
        {"class": label, "train": counts["train"].get(label, 0), "val": counts["val"].get(label, 0)}
        for label in classes
        if counts["train"].get(label, 0) < 5 or counts["val"].get(label, 0) < 2
    ]
    source_counts = {
        label: len({item["source"] for item in samples if item["label"] == label})
        for label in classes
    }
    contamination_flags = []
    for name, record in manifest.items():
        regions_by_segment = [segment["regions"] for segment in record.get("spatial_segments", [])]
        if record.get("spatial_regions"):
            regions_by_segment.append(record["spatial_regions"])
        for segment_index, regions in enumerate(regions_by_segment):
            for first_index, first in enumerate(regions):
                for second in regions[first_index + 1:]:
                    left = max(first["box"][0], second["box"][0])
                    top = max(first["box"][1], second["box"][1])
                    right = min(first["box"][2], second["box"][2])
                    bottom = min(first["box"][3], second["box"][3])
                    overlap = max(0, right - left) * max(0, bottom - top)
                    first_area = (first["box"][2] - first["box"][0]) * (first["box"][3] - first["box"][1])
                    second_area = (second["box"][2] - second["box"][0]) * (second["box"][3] - second["box"][1])
                    if overlap / min(first_area, second_area) > 0.1:
                        contamination_flags.append({"source": name, "segment": segment_index, "labels": [first["label"], second["label"]], "overlap_ratio": overlap / min(first_area, second_area)})
    mapping = {str(index): label for index, label in enumerate(classes)}
    report = {
        "class_to_index": mapping,
        "source_files_per_class": {label: sorted({item["source"] for item in samples if item["label"] == label}) for label in classes},
        "counts": counts,
        "independent_source_count_per_class": source_counts,
        "excluded_non_trainable_classes": excluded_classes,
        "insufficient_samples": insufficient,
        "unresolved_files": unresolved,
        "duplicate_sample_groups": duplicate_samples,
        "conflicting_duplicate_labels": conflicting_labels,
        "crop_contamination_flags": contamination_flags,
        "source_splits": source_splits,
        "same_source_train_validation_leakage": False,
        "contact_sheets": {label: str(CONTACT_DIR / f"{label}.jpg") for label in classes},
        "ready_for_training": not unresolved and not conflicting_labels and not insufficient and not contamination_flags,
    }
    (OUTPUT_DIR / "unified_manifest_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    contact_sheets(classes)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()