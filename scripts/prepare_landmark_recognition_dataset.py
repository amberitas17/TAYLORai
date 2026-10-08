"""Extract, review, and split walkthrough frames for landmark classification.

The extractor deliberately leaves every frame unlabeled. A reviewer assigns a
label and optional split in ``review_manifest.csv`` before ``build`` creates an
ImageFolder dataset. Splitting is by source video, never by individual frame.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import cv2


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "documentation" / "datasets" / "Landmark Recognition"
DEFAULT_WORK = DEFAULT_SOURCE / "landmark_recognition"
VIDEO_EXTENSIONS = {".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"}
IMAGE_EXTENSIONS = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}
CLASSES = (
    "aricc",
    "caesar",
    "elevator",
    "elevator_1f",
    "elevator_4f",
    "emh_department",
    "entrance_aricc",
    "entrance_caesar",
    "entrance_fablab",
    "entrance_ovprei",
    "entrance_rio",
    "fablab",
    "hallway_to_aricc",
    "hallway_to_fablab",
    "intersection",
    "itso",
    "olcpd_office",
    "ovprei",
    "rio",
    "small_opening",
    "stairs",
    "unknown",
    "window_near_bathroom",
)
TRAINING_CLASSES = tuple(label for label in CLASSES if label != "unknown")
REVIEW_FIELDS = (
    "frame_path",
    "source_video",
    "source_type",
    "frame_index",
    "timestamp_seconds",
    "label",
    "review_status",
    "split",
    "review_notes",
)


def slug(value: str) -> str:
    return "".join(character.lower() if character.isalnum() else "_" for character in value).strip("_")


def extract_video(video: Path, source_root: Path, frames_dir: Path, every_seconds: float) -> list[dict[str, str]]:
    capture = cv2.VideoCapture(str(video))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, round(fps * every_seconds))
    video_dir = frames_dir / slug(video.stem)
    video_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []

    for frame_index in range(0, total_frames, step):
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = capture.read()
        if not ok:
            continue
        timestamp = frame_index / fps
        output = video_dir / f"{slug(video.stem)}__t{timestamp:08.2f}.jpg"
        if not output.exists():
            cv2.imwrite(str(output), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        rows.append(
            {
                "frame_path": str(output.relative_to(source_root)),
                "source_video": str(video.relative_to(source_root)),
                "source_type": "video_frame",
                "frame_index": str(frame_index),
                "timestamp_seconds": f"{timestamp:.2f}",
                "label": "",
                "review_status": "pending",
                "split": "",
                "review_notes": "",
            }
        )

    capture.release()
    return rows


def extract_images(source: Path, source_root: Path, frames_dir: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for image in sorted(source.iterdir(), key=lambda path: path.name.lower()):
        if image.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        output = frames_dir / "stills" / f"{slug(image.stem)}{image.suffix.lower()}"
        output.parent.mkdir(parents=True, exist_ok=True)
        if not output.exists():
            shutil.copy2(image, output)
        rows.append(
            {
                "frame_path": str(output.relative_to(source_root)),
                "source_video": str(image.relative_to(source_root)),
                "source_type": "image",
                "frame_index": "",
                "timestamp_seconds": "",
                "label": "",
                "review_status": "pending",
                "split": "",
                "review_notes": "",
            }
        )
    return rows


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def extract(args: argparse.Namespace) -> None:
    source = args.source.resolve()
    work = args.work.resolve()
    frames_dir = work / "frames"
    videos = [path for path in source.iterdir() if path.suffix.lower() in VIDEO_EXTENSIONS]
    rows: list[dict[str, str]] = []
    for video in sorted(videos, key=lambda path: path.name.lower()):
        print(f"Extracting {video.name}")
        rows.extend(extract_video(video, source, frames_dir, args.every_seconds))
    rows.extend(extract_images(source, source, frames_dir))
    manifest = work / "review_manifest.csv"
    write_csv(manifest, rows)
    source_frames = defaultdict(list)
    for row in rows:
        source_frames[row["source_video"]].append(row["timestamp_seconds"])
    extraction_report = {
        "status": "awaiting_manual_review",
        "manifest": str(manifest),
        "videos": len(videos),
        "frames": len(rows),
        "sampling_fps": 1 / args.every_seconds,
        "source_video_timestamps": {source_name: timestamps for source_name, timestamps in sorted(source_frames.items())},
        "manual_review_required": [
            "Assign labels by visible location, not by source video name.",
            "Use unknown for ambiguous, blurred, blocked, floor, generic, or transition frames.",
            "Mark complete source videos as train or val when a recording-session split is known.",
        ],
    }
    (work / "extraction_report.json").write_text(json.dumps(extraction_report, indent=2), encoding="utf-8")
    print(json.dumps(extraction_report | {"source_video_timestamps": "written to extraction_report.json"}, indent=2))


def split_video(source_video: str, train_ratio: float) -> str:
    digest = hashlib.sha256(source_video.encode("utf-8")).digest()
    value = int.from_bytes(digest[:8], "big") / 2**64
    return "train" if value < train_ratio else "val"


def build(args: argparse.Namespace) -> None:
    work = args.work.resolve()
    rows = read_csv(work / "review_manifest.csv")
    invalid = [row for row in rows if row.get("review_status") != "reviewed" or row.get("label") not in CLASSES]
    if invalid:
        raise RuntimeError(
            f"{len(invalid)} frames are not reviewed with a valid label. "
            "Complete review_manifest.csv before building or training."
        )

    source_splits: dict[str, str] = {}
    for row in rows:
        source = row["source_video"]
        requested = row.get("split", "").strip().lower()
        source_splits.setdefault(source, requested if requested in {"train", "val"} else split_video(source, args.train_ratio))
        if source_splits[source] != requested and requested in {"train", "val"}:
            raise RuntimeError(f"Source video has conflicting split assignments: {source}")

    dataset = work / "dataset"
    if dataset.exists():
        shutil.rmtree(dataset)
    counts: dict[str, Counter[str]] = {"train": Counter(), "val": Counter()}
    sources: dict[str, dict[str, list[str]]] = {"train": defaultdict(list), "val": defaultdict(list)}
    for index, row in enumerate(rows):
        if row["label"] == "unknown":
            continue
        split = source_splits[row["source_video"]]
        source = DEFAULT_SOURCE / row["frame_path"]
        destination = dataset / split / row["label"] / f"{index:06d}_{source.name}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        counts[split][row["label"]] += 1
        sources[split][row["source_video"]].append(row["label"])

    timestamps_by_class: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        timestamps_by_class[row["label"]][row["source_video"]].append(row["timestamp_seconds"])
    report = {
        "ready_for_training": all(counts[split][label] > 0 for split in ("train", "val") for label in TRAINING_CLASSES),
        "classes": list(TRAINING_CLASSES),
        "excluded_unknown_frames": sum(1 for row in rows if row["label"] == "unknown"),
        "counts": {split: dict(sorted(value.items())) for split, value in counts.items()},
        "sources_by_split": {split: dict(sorted(value.items())) for split, value in sources.items()},
        "source_splits": dict(sorted(source_splits.items())),
        "insufficient_classes": [label for label in TRAINING_CLASSES if counts["train"][label] < args.minimum_per_class or counts["val"][label] < 1],
        "timestamps_by_class": {
            label: dict(sorted(source_timestamps.items()))
            for label, source_timestamps in sorted(timestamps_by_class.items())
        },
        "ambiguous_frames": [
            {"source_video": row["source_video"], "timestamp_seconds": row["timestamp_seconds"], "frame_path": row["frame_path"]}
            for row in rows
            if row["label"] == "unknown"
        ],
        "manual_review_recommendations": [
            f"Review all {counts['train']['unknown'] + counts['val']['unknown']} unknown frames for consistent visual ambiguity.",
            *[f"Collect or review more {label} frames." for label in TRAINING_CLASSES if counts["train"][label] < args.minimum_per_class],
        ],
        "manifest": str(work / "review_manifest.csv"),
    }
    (work / "dataset_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("extract", "build"))
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--work", type=Path, default=DEFAULT_WORK)
    parser.add_argument("--every-seconds", type=float, default=1.0)
    parser.add_argument("--train-ratio", type=float, default=0.8)
    parser.add_argument("--minimum-per-class", type=int, default=20)
    args = parser.parse_args()
    if args.every_seconds <= 0:
        parser.error("--every-seconds must be positive")
    if args.command == "extract":
        extract(args)
    else:
        build(args)


if __name__ == "__main__":
    main()