"""Train a separate RECON Center exhibit classifier from documentation media."""

from __future__ import annotations

import argparse
import json
import random
import shutil
import stat
from pathlib import Path

import cv2
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "RECON"
WORK_DIR = ROOT / "runs" / "recon_documentation_dataset_ocr_v1"
RUNS_DIR = ROOT / "runs" / "classify"
DEPLOY_DIR = ROOT / "public" / "models" / "recon"
OCR_MANIFEST = SOURCE_DIR / "ocr_labels.json"

CLASS_NAMES = [
    "Industrial Measurement Instrumentation",
    "Food and Thermal Processing Machinery",
    "Unmanned Aerial Systems",
    "Renewable Energy Training Systems",
    "Fluid Transfer Systems",
]


def remove_readonly(func, path, _exc_info):
    Path(path).chmod(stat.S_IWRITE)
    func(path)


def load_ocr_labels(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        raise RuntimeError(
            f"OCR manifest not found: {path}. Create it from verified placard OCR; filenames are not accepted as labels."
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise RuntimeError("OCR manifest must be an object keyed by source filename")
    labels = {}
    for filename, record in raw.items():
        if not isinstance(record, dict) or not record.get("label") or not record.get("text"):
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


def build_dataset(seed: int, validation_ratio: float, step: int, limit: int) -> dict:
    random.seed(seed)
    ocr_labels = load_ocr_labels(OCR_MANIFEST)
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR, onerror=remove_readonly)
    sources: dict[str, list[Path]] = {name: [] for name in CLASS_NAMES}
    for path in sorted(SOURCE_DIR.glob("*.MOV")):
        record = ocr_labels.get(path.name)
        if not record:
            raise RuntimeError(f"No OCR label for source video: {path.name}")
        sources[record["label"]].append(path)
    summary = {"train": {}, "val": {}, "videos": {}, "source_images": [], "ocr_labels": ocr_labels}
    for label, paths in sources.items():
        if not paths:
            raise RuntimeError(f"No RECON source media mapped to {label}")
        random.shuffle(paths)
        val_count = max(1, round(len(paths) * validation_ratio)) if len(paths) > 1 else 0
        val_paths = set(paths[:val_count])
        summary["videos"][label] = {
            "train": [p.name for p in paths if p not in val_paths],
            "val": [p.name for p in paths if p in val_paths],
            "independent_source_split": len(paths) > 1,
        }
        for split in ("train", "val"):
            selected = [p for p in paths if (p in val_paths) == (split == "val")]
            target = WORK_DIR / split / label
            if len(paths) == 1:
                capture = cv2.VideoCapture(str(paths[0]))
                total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
                capture.release()
                midpoint = total // 2
                count = extract_video(paths[0], target, step, limit, 0 if split == "train" else midpoint, midpoint if split == "train" else None)
            else:
                count = sum(extract_video(p, target, step, limit) for p in selected)
            summary[split][label] = count
    for path in sorted(SOURCE_DIR.glob("*.JPG")):
        record = ocr_labels.get(path.name)
        if not record:
            raise RuntimeError(f"No OCR label for source image: {path.name}")
        target = WORK_DIR / "train" / record["label"] / path.name
        shutil.copy2(path, target)
        summary["source_images"].append(path.name)
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
    parser.add_argument("--deploy", action="store_true")
    parser.add_argument("--ocr-manifest", type=Path, default=OCR_MANIFEST)
    parser.add_argument("--dataset-dir", type=Path, default=WORK_DIR)
    args = parser.parse_args()
    device = args.device
    if device == "auto":
        device = "0" if __import__("torch").cuda.is_available() else "cpu"
    OCR_MANIFEST = args.ocr_manifest
    WORK_DIR = args.dataset_dir if args.dataset_dir.is_absolute() else ROOT / args.dataset_dir
    summary = build_dataset(args.seed, args.validation_ratio, args.frame_step, args.max_frames)
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
    print(json.dumps({"best_pt": str(best), "onnx": str(onnx), "metadata": str(metadata_path)}, indent=2))


if __name__ == "__main__":
    main()