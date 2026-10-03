"""Build and optionally train a multi-exhibit Caesar classification dataset.

The default source directory is intentionally flat. Annotation mode uses
explicit regions; filename mode is available when each recording contains one
exhibit and the filename is the requested label.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import shutil
from pathlib import Path

import cv2


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "CAESAR"
ANNOTATIONS = SOURCE_DIR / "annotations.json"
DATASET_DIR = ROOT / "runs" / "caesar_annotated_dataset"
RUNS_DIR = ROOT / "runs" / "classify"
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic", ".heif", ".mov", ".mp4", ".avi", ".mkv"}
VIDEO_EXTENSIONS = {".mov", ".mp4", ".avi", ".mkv"}


def slugify(value: str) -> str:
    value = re.sub(r"[^\w\s-]", "", value.strip())
    return re.sub(r"[-\s]+", "_", value).strip("_").lower() or "unknown"


def filename_label(source: Path) -> str:
    """Use the filename stem, ignoring a trailing recording number."""
    stem = re.sub(r"[\s_-]+\d+$", "", source.stem).strip()
    stem = re.sub(r"multi[- ]paramter", "multi-parameter", stem, flags=re.IGNORECASE)
    return slugify(stem)


def load_annotations(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("annotations") if isinstance(payload, dict) else payload
    if not isinstance(records, list):
        raise ValueError("annotations JSON must contain an 'annotations' list")
    for index, record in enumerate(records):
        if not isinstance(record, dict) or not record.get("source"):
            raise ValueError(f"annotation {index} must contain a source filename")
        regions = record.get("regions", [])
        if not isinstance(regions, list):
            raise ValueError(f"annotation {index} regions must be a list")
        for region_index, region in enumerate(regions):
            if not isinstance(region, dict) or not region.get("label"):
                raise ValueError(f"annotation {index} region {region_index} needs a label")
            if not region.get("exclude") and region.get("box") is None and region.get("label") != "unknown_background":
                raise ValueError(f"annotation {index} region {region_index} needs a box or exclude=true")
            if region.get("label") == "unknown_background" and region.get("box") is None:
                region["box"] = [0, 0, 1, 1]
    return records


def frame_bounds(record: dict, fps: float, total_frames: int) -> tuple[int, int]:
    start = record.get("start_frame")
    end = record.get("end_frame")
    if start is None:
        start = round(float(record.get("start_seconds", 0)) * fps)
    if end is None:
        end = round(float(record.get("end_seconds", total_frames / fps)))
    return max(0, int(start)), min(total_frames, max(int(start) + 1, int(end)))


def normalized_box(box: list[float], width: int, height: int) -> tuple[int, int, int, int] | None:
    if len(box) != 4:
        return None
    x1, y1, x2, y2 = (float(value) for value in box)
    if max(abs(x1), abs(y1), abs(x2), abs(y2)) <= 1.0:
        x1, x2 = x1 * width, x2 * width
        y1, y2 = y1 * height, y2 * height
    left = max(0, min(width, round(min(x1, x2))))
    top = max(0, min(height, round(min(y1, y2))))
    right = max(0, min(width, round(max(x1, x2))))
    bottom = max(0, min(height, round(max(y1, y2))))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def acceptable_crop(crop, box: tuple[int, int, int, int], frame_shape: tuple[int, ...], region: dict, min_blur: float) -> bool:
    left, top, right, bottom = box
    height, width = frame_shape[:2]
    area_ratio = ((right - left) * (bottom - top)) / (width * height)
    if region.get("exclude") or region.get("ambiguous") or area_ratio < 0.01:
        return False
    if region.get("label") != "unknown_background" and area_ratio >= 0.98 and not region.get("allow_full_frame"):
        return False
    if crop.shape[0] < 48 or crop.shape[1] < 48:
        return False
    if min_blur > 0 and float(cv2.Laplacian(crop, cv2.CV_64F).var()) < min_blur:
        return False
    return True


def save_region(frame, region: dict, output_dir: Path, stem: str, index: int, min_blur: float) -> tuple[str, str] | None:
    box = normalized_box(region["box"], frame.shape[1], frame.shape[0])
    if box is None:
        return None
    left, top, right, bottom = box
    crop = frame[top:bottom, left:right]
    if not acceptable_crop(crop, box, frame.shape, region, min_blur):
        return None
    label = slugify(region["label"])
    destination = output_dir / label / f"{stem}__{label}__region{index:02d}.jpg"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(destination), crop, [cv2.IMWRITE_JPEG_QUALITY, 95]):
        raise RuntimeError(f"Could not write crop: {destination}")
    return label, str(destination)


def read_image(source: Path):
    if source.suffix.lower() in {".heic", ".heif"}:
        from pillow_heif import register_heif_opener
        from PIL import Image

        register_heif_opener()
        with Image.open(source) as image:
            rgb = image.convert("RGB")
        return cv2.cvtColor(__import__("numpy").array(rgb), cv2.COLOR_RGB2BGR)
    return cv2.imread(str(source))


def build_filename_dataset(args: argparse.Namespace) -> dict:
    source_files = sorted(
        [path for path in args.source.iterdir() if path.is_file() and path.suffix.lower() in MEDIA_EXTENSIONS],
        key=lambda path: path.name.casefold(),
    )
    if not source_files:
        raise RuntimeError(f"No Caesar media found in {args.source}")

    if args.output.exists():
        shutil.rmtree(args.output)
    randomizer = random.Random(args.seed)
    split_by_source = {
        path.name: ("val" if len(source_files) > 1 and randomizer.random() < args.validation_ratio else "train")
        for path in source_files
    }
    sources_by_label: dict[str, list[Path]] = {}
    for source in source_files:
        sources_by_label.setdefault(filename_label(source), []).append(source)
    for label_sources in sources_by_label.values():
        if all(split_by_source[source.name] == "val" for source in label_sources):
            split_by_source[randomizer.choice(label_sources).name] = "train"
    if args.validation_ratio and all(split == "train" for split in split_by_source.values()) and len(source_files) > 1:
        split_by_source[source_files[-1].name] = "val"

    summary = {"train": {}, "val": {}, "sources": split_by_source, "label_source": "filename_stem_without_trailing_number"}
    for source in source_files:
        split = split_by_source[source.name]
        label = filename_label(source)
        destination_dir = args.output / split / label
        destination_dir.mkdir(parents=True, exist_ok=True)
        written = 0
        if source.suffix.lower() in VIDEO_EXTENSIONS:
            capture = cv2.VideoCapture(str(source))
            if not capture.isOpened():
                raise RuntimeError(f"Could not open video: {source}")
            frame_index = 0
            while written < args.max_frames:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % max(1, args.frame_step) == 0:
                    target = destination_dir / f"{slugify(source.stem)}__f{frame_index:06d}.jpg"
                    if not cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                        raise RuntimeError(f"Could not write frame: {target}")
                    written += 1
                frame_index += 1
            capture.release()
        else:
            frame = read_image(source)
            if frame is None:
                raise RuntimeError(f"Could not read image: {source}")
            target = destination_dir / f"{slugify(source.stem)}.jpg"
            if not cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                raise RuntimeError(f"Could not write image: {target}")
            written = 1
        summary[split][label] = summary[split].get(label, 0) + written

    if not summary["train"]:
        raise RuntimeError("No filename-labeled training data was produced")
    (args.output / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def build_dataset(args: argparse.Namespace) -> dict:
    records = load_annotations(args.annotations)
    by_source: dict[str, list[dict]] = {}
    for record in records:
        by_source.setdefault(Path(record["source"]).name.casefold(), []).append(record)

    source_files = {
        path.name.casefold(): path
        for path in args.source.iterdir()
        if path.is_file() and path.suffix.lower() in MEDIA_EXTENSIONS
    }
    missing = sorted(set(by_source) - set(source_files))
    if missing:
        raise FileNotFoundError(f"Annotated source files not found: {', '.join(missing)}")

    if args.output.exists():
        shutil.rmtree(args.output)
    randomizer = random.Random(args.seed)
    split_by_source = {
        key: ("val" if len(by_source) > 1 and randomizer.random() < args.validation_ratio else "train")
        for key in by_source
    }
    if args.validation_ratio and all(split == "train" for split in split_by_source.values()) and len(split_by_source) > 1:
        split_by_source[sorted(split_by_source)[-1]] = "val"

    summary = {"train": {}, "val": {}, "skipped": 0, "sources": split_by_source}
    for key, records_for_source in by_source.items():
        source = source_files[key]
        split = split_by_source[key]
        if source.suffix.lower() in VIDEO_EXTENSIONS:
            capture = cv2.VideoCapture(str(source))
            if not capture.isOpened():
                raise RuntimeError(f"Could not open video: {source}")
            fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            for annotation in records_for_source:
                start, end = frame_bounds(annotation, fps, total_frames)
                for frame_index in range(start, end, max(1, args.frame_step)):
                    capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
                    ok, frame = capture.read()
                    if not ok:
                        continue
                    for region_index, region in enumerate(annotation["regions"]):
                        result = save_region(frame, region, args.output / split, f"{slugify(source.stem)}__f{frame_index:06d}", region_index, args.min_blur)
                        if result:
                            label, _ = result
                            summary[split][label] = summary[split].get(label, 0) + 1
                        else:
                            summary["skipped"] += 1
            capture.release()
        else:
            frame = read_image(source)
            if frame is None:
                raise RuntimeError(f"Could not read image: {source}")
            for record_index, annotation in enumerate(records_for_source):
                for region_index, region in enumerate(annotation["regions"]):
                    result = save_region(frame, region, args.output / split, f"{slugify(source.stem)}__image{record_index:03d}", region_index, args.min_blur)
                    if result:
                        label, _ = result
                        summary[split][label] = summary[split].get(label, 0) + 1
                    else:
                        summary["skipped"] += 1

    if not summary["train"]:
        raise RuntimeError("No usable training crops were produced; check annotations and quality thresholds")
    (args.output / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def train_model(args: argparse.Namespace, summary: dict) -> str:
    from ultralytics import YOLO

    model = YOLO(args.model)
    model.train(task="classify", data=str(args.output), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, project=str(RUNS_DIR), name=args.run_name, device=args.device, workers=0, exist_ok=True)
    best_path = RUNS_DIR / args.run_name / "weights" / "best.pt"
    if not best_path.exists():
        raise RuntimeError(f"Training did not produce {best_path}")
    trained = YOLO(str(best_path))
    onnx_path = Path(trained.export(format="onnx", imgsz=args.imgsz, simplify=True, opset=12))
    labels = sorted({label for split in ("train", "val") for label in summary[split]})
    metadata_path = RUNS_DIR / args.run_name / f"{args.run_name}_metadata.json"
    metadata_path.write_text(json.dumps({
        "displayNames": labels,
        "classes": labels,
        "dataset_summary": str(args.output / "dataset_summary.json"),
        "onnx": str(onnx_path),
        "input_shape": [1, 3, args.imgsz, args.imgsz],
        "inputSize": args.imgsz,
        "preprocessing": {
            "mean": [0, 0, 0],
            "std": [1, 1, 1],
            "layout": "NCHW",
            "input_format": "RGB"
        },
        "output_type": "logits"
    }, indent=2), encoding="utf-8")
    return str(onnx_path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE_DIR)
    parser.add_argument("--annotations", type=Path, default=ANNOTATIONS)
    parser.add_argument("--output", type=Path, default=DATASET_DIR)
    parser.add_argument("--frame-step", type=int, default=10)
    parser.add_argument("--max-frames", type=int, default=120)
    parser.add_argument("--validation-ratio", type=float, default=0.25)
    parser.add_argument("--min-blur", type=float, default=20.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--model", default="yolov8n-cls.pt")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--run-name", default="caesar_annotated_v1")
    parser.add_argument(
        "--filename-labels",
        action="store_true",
        help="Use each filename stem as its class label, ignoring trailing recording numbers.",
    )
    args = parser.parse_args()
    if not args.source.is_dir():
        raise FileNotFoundError(f"Source directory not found: {args.source}")
    if not args.filename_labels and not args.annotations.exists():
        raise FileNotFoundError(f"Create the annotation file first: {args.annotations}")
    summary = build_filename_dataset(args) if args.filename_labels else build_dataset(args)
    print(json.dumps(summary, indent=2))
    if args.train:
        if args.device == "auto":
            args.device = "0" if __import__("torch").cuda.is_available() else "cpu"
        print(json.dumps({"onnx": train_model(args, summary)}, indent=2))


if __name__ == "__main__":
    main()