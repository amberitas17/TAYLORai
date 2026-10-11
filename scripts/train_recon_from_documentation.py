"""Train a separate RECON Center exhibit classifier from documentation media."""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import stat
from pathlib import Path

import cv2
from ultralytics import YOLO

from retraining_memory import configure_cpu_threads, memory_snapshot


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "RECON"
WORK_DIR = ROOT / "runs" / "recon_documentation_dataset_ocr_v1"
RUNS_DIR = ROOT / "runs" / "classify"
DEPLOY_DIR = ROOT / "public" / "models" / "recon"
OCR_MANIFEST = SOURCE_DIR / "ocr_labels.json"
UNKNOWN_BACKGROUND_DIR = ROOT / "Documentation" / "training" / "unknown_background"

REGISTERED_CLASS_NAMES = [
    "Industrial Measurement Instrumentation",
    "Food and Thermal Processing Machinery",
    "Unmanned Aerial Systems",
    "Renewable Energy Training Systems",
    "Fluid Transfer Systems",
]
CLASS_NAMES = [*REGISTERED_CLASS_NAMES, "unknown_background"]


def remove_readonly(func, path, _exc_info):
    Path(path).chmod(stat.S_IWRITE)
    func(path)


def load_ocr_labels(path: Path) -> dict[str, dict]:
    if not path.exists():
        raise RuntimeError(
            f"OCR manifest not found: {path}. Create it from verified placard OCR; filenames are not accepted as labels."
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise RuntimeError("OCR manifest must be an object keyed by source filename")
    labels = {}
    for filename, record in raw.items():
        if not isinstance(record, dict):
            raise RuntimeError(f"OCR manifest entry for {filename} must be an object")
        segments = record.get("segments")
        if segments is not None:
            if not isinstance(segments, list) or not segments:
                raise RuntimeError(f"OCR manifest segments for {filename} must be a non-empty list")
            for index, segment in enumerate(segments):
                if not isinstance(segment, dict) or not segment.get("label") or not segment.get("text"):
                    raise RuntimeError(f"OCR manifest segment {index} for {filename} requires text and label")
                if segment["label"] not in CLASS_NAMES:
                    raise RuntimeError(f"Unsupported OCR label for {filename}: {segment['label']}")
                if segment.get("end_seconds", 0) <= segment.get("start_seconds", 0):
                    raise RuntimeError(f"OCR manifest segment {index} for {filename} requires end_seconds > start_seconds")
            labels[filename] = {"segments": segments}
            continue
        if not record.get("label") or not record.get("text"):
            raise RuntimeError(f"OCR manifest entry for {filename} requires non-empty text and label")
        if record["label"] not in CLASS_NAMES:
            raise RuntimeError(f"Unsupported OCR label for {filename}: {record['label']}")
        labels[filename] = {"label": record["label"], "text": record["text"]}
    return labels


def extract_video(path: Path, output: Path, step: int, limit: int, start: int = 0, end: int | None = None) -> int:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {path}")
    output.mkdir(parents=True, exist_ok=True)
    frame_index = 0
    saved = 0
    while saved < limit:
        ok, frame = capture.read()
        if not ok:
            break
        if frame_index >= start and (end is None or frame_index < end) and frame_index % step == 0:
            target = output / f"{path.stem}_{frame_index:06d}.jpg"
            cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            saved += 1
        frame_index += 1
    capture.release()
    return saved


def collect_background_files(path: Path) -> list[Path]:
    if not path.is_dir():
        raise RuntimeError(f"Unknown-background directory not found: {path}")
    files = [item for item in sorted(path.iterdir()) if item.is_file() and item.suffix.lower() in {".mov", ".mp4", ".avi", ".mkv", ".jpg", ".jpeg", ".png", ".webp", ".bmp"}]
    if not files:
        raise RuntimeError(f"Add confirmed non-exhibit frames or recordings to: {path}")
    return files


def extract_background(path: Path, output: Path, step: int, limit: int) -> int:
    if path.suffix.lower() in {".mov", ".mp4", ".avi", ".mkv"}:
        return extract_video(path, output, step, limit)
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"{path.stem}.jpg"
    shutil.copy2(path, target)
    return 1


def read_image(path: Path):
    if path.suffix.lower() in {".heic", ".heif"}:
        try:
            from pillow_heif import register_heif_opener
            from PIL import Image
            import numpy as np
        except ImportError as exc:
            raise RuntimeError("HEIC training images require pillow-heif, Pillow, and numpy") from exc
        register_heif_opener()
        with Image.open(path) as image:
            return cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    return cv2.imread(str(path))


def build_dataset(seed: int, validation_ratio: float, step: int, limit: int, unknown_background_dir: Path) -> dict:
    random.seed(seed)
    ocr_labels = load_ocr_labels(OCR_MANIFEST)
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR, onerror=remove_readonly)
    source_records = []
    for path in sorted(SOURCE_DIR.glob("*.MOV")):
        record = ocr_labels.get(path.name)
        if not record:
            raise RuntimeError(f"No OCR label for source video: {path.name}")
        segments = record.get("segments") or [{**record, "start_seconds": 0}]
        source_records.append((path, segments))
    random.shuffle(source_records)
    val_count = max(1, round(len(source_records) * validation_ratio)) if len(source_records) > 1 else 0
    val_sources = {path for path, _ in source_records[:val_count]}
    summary = {"train": {}, "val": {}, "videos": {}, "source_images": [], "ocr_labels": ocr_labels}
    for path, segments in source_records:
        split = "val" if path in val_sources else "train"
        summary["videos"][path.name] = {"split": split, "segments": segments}
        capture = cv2.VideoCapture(str(path))
        if not capture.isOpened():
            raise RuntimeError(f"Could not open {path}")
        fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        for segment_index, segment in enumerate(segments):
            label = segment["label"]
            start = max(0, round(float(segment.get("start_seconds", 0)) * fps))
            end = min(total, max(start + 1, round(float(segment.get("end_seconds", total / fps)) * fps)))
            target = WORK_DIR / split / label
            count = extract_video(path, target, step, limit, start, end)
            summary[split][label] = summary[split].get(label, 0) + count
        capture.release()
    for path in sorted(SOURCE_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic", ".heif"}:
            continue
        record = ocr_labels.get(path.name)
        if not record:
            raise RuntimeError(f"No OCR label for source image: {path.name}")
        if record.get("segments"):
            raise RuntimeError(f"Image source {path.name} cannot use video segments")
        target = WORK_DIR / "train" / record["label"] / f"{path.stem}.jpg"
        target.parent.mkdir(parents=True, exist_ok=True)
        image = read_image(path)
        if image is None or not cv2.imwrite(str(target), image, [cv2.IMWRITE_JPEG_QUALITY, 95]):
            raise RuntimeError(f"Could not convert source image: {path}")
        summary["source_images"].append(path.name)
    background_files = collect_background_files(unknown_background_dir) if unknown_background_dir.exists() else []
    random.shuffle(background_files)
    background_val_count = max(1, round(len(background_files) * validation_ratio)) if len(background_files) > 1 else 0
    background_val = set(background_files[:background_val_count])
    for path in background_files:
        split = "val" if path in background_val else "train"
        target = WORK_DIR / split / "unknown_background"
        summary[split]["unknown_background"] = summary[split].get("unknown_background", 0) + extract_background(path, target, step, limit)
    (WORK_DIR / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    global OCR_MANIFEST
    global WORK_DIR
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="yolov8n-cls.pt")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--frame-step", type=int, default=10)
    parser.add_argument("--max-frames", type=int, default=120)
    parser.add_argument("--validation-ratio", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--run-name", default="recon_documentation_v1")
    parser.add_argument("--reuse-dataset", action="store_true")
    parser.add_argument("--deploy", action="store_true")
    parser.add_argument("--ocr-manifest", type=Path, default=OCR_MANIFEST)
    parser.add_argument("--dataset-dir", type=Path, default=WORK_DIR)
    parser.add_argument("--unknown-background-dir", type=Path, default=UNKNOWN_BACKGROUND_DIR)
    args = parser.parse_args()
    configure_cpu_threads()
    memory_log = Path(os.environ["TAYLOR_MEMORY_LOG"]) if os.environ.get("TAYLOR_MEMORY_LOG") else None
    memory_snapshot("training_start", memory_log)
    device = args.device
    if device == "auto":
        device = "0" if __import__("torch").cuda.is_available() else "cpu"
    OCR_MANIFEST = args.ocr_manifest
    WORK_DIR = args.dataset_dir if args.dataset_dir.is_absolute() else ROOT / args.dataset_dir
    summary = {"reused": True, "dataset": str(WORK_DIR)} if args.reuse_dataset else build_dataset(
        args.seed, args.validation_ratio, args.frame_step, args.max_frames, args.unknown_background_dir
    )
    print(json.dumps(summary, indent=2))
    model = YOLO(args.model)
    model.train(task="classify", data=str(WORK_DIR), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                patience=max(8, args.epochs // 4), project=str(RUNS_DIR), name=args.run_name,
                device=device, workers=0, exist_ok=True)
    best = RUNS_DIR / args.run_name / "weights" / "best.pt"
    trained = YOLO(str(best))
    model_class_names = [trained.names[index] for index in range(len(trained.names))]
    onnx = Path(trained.export(format="onnx", imgsz=args.imgsz, simplify=True, opset=12))
    metadata = {
        "model_name": args.run_name,
        "displayNames": model_class_names,
        "source_dataset": str(SOURCE_DIR),
        "dataset_summary": str(WORK_DIR / "dataset_summary.json"),
        "input_shape": [1, 3, args.imgsz, args.imgsz],
        "output_shape": [1, len(model_class_names)],
        "output_type": "logits",
        "preprocessing": {"mean": [0.0, 0.0, 0.0], "std": [1.0, 1.0, 1.0]},
    }
    metadata_path = RUNS_DIR / args.run_name / f"{args.run_name}_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    if args.deploy:
        DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(onnx, DEPLOY_DIR / "recon_classifier.onnx")
        shutil.copy2(metadata_path, DEPLOY_DIR / "recon_classifier_metadata.json")
    memory_snapshot("training_complete", memory_log)
    print(json.dumps({"best_pt": str(best), "onnx": str(onnx), "metadata": str(metadata_path)}, indent=2))


if __name__ == "__main__":
    main()