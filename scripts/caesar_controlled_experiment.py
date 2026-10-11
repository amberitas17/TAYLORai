"""Run a source-video-disjoint CAESAR candidate experiment.

The experiment deliberately keeps the production model untouched. It audits
filename labels, builds an isolated dataset from complete source videos, and
compares the current ONNX model with an experimental YOLO classification model
on the same held-out video frames.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import time
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "CAESAR"
PRODUCTION_MODEL = ROOT / "public" / "models" / "caesar" / "caesar_classifier.onnx"
PRODUCTION_METADATA = ROOT / "public" / "models" / "caesar" / "caesar_classifier_metadata.json"
DEFAULT_OUTPUT = ROOT / "runs" / "caesar_controlled_experiment_v1"
VIDEO_EXTENSIONS = {".mov", ".mp4", ".avi", ".mkv"}
CONFIDENCE_THRESHOLD = 0.80
MARGIN_THRESHOLD = 0.15

# Fixed, complete held-out recordings. These classes also have training
# recordings; single-recording classes are trained but receive no fabricated
# independent validation score.
VALIDATION_SOURCES = {
    "Analytical Balance.MOV",
    "Benchtop Multi-Parameter Meter.MOV",
    "Digital Dry Bath Incubator 2.MOV",
    "Ducted Fumehood.MOV",
    "Incubator.MOV",
    "Laboratory Glassware 2.MOV",
}


def label_for(path: Path) -> str:
    stem = re.sub(r"[\s_-]+\d+$", "", path.stem).strip()
    stem = re.sub(r"multi[- ]paramter", "multi-parameter", stem, flags=re.IGNORECASE)
    return re.sub(r"[-\s]+", "_", re.sub(r"[^\w\s-]", "", stem).lower()).strip("_") or "unknown"


def source_inventory() -> list[Path]:
    return sorted((path for path in SOURCE_DIR.iterdir() if path.suffix.lower() in VIDEO_EXTENSIONS), key=lambda path: path.name.casefold())


def audit_sources(sources: list[Path]) -> dict:
    labels = defaultdict(list)
    for source in sources:
        labels[label_for(source)].append(source.name)
    collisions = defaultdict(list)
    for source in sources:
        raw = source.stem.lower()
        normalized = label_for(source)
        if raw != normalized and not re.search(r"[\s_-]+\d+$", source.stem):
            collisions[normalized].append(source.name)
    class_sources = {label: sorted(names) for label, names in sorted(labels.items())}
    ambiguous = {
        "img": {
            "sources": sorted(path.name for path in SOURCE_DIR.iterdir() if path.suffix.lower() in {".heic", ".heif"}),
            "reason": "IMG filenames contain no exhibit identity; do not merge them into one exhibit class.",
            "action": "excluded from this candidate because the source files are images and have no verified labels",
        }
    }
    return {
        "source_count": len(sources),
        "video_sources": [source.name for source in sources],
        "class_sources": class_sources,
        "multi_source_classes": sorted(label for label, names in class_sources.items() if len(names) >= 2),
        "single_source_classes": sorted(label for label, names in class_sources.items() if len(names) == 1),
        "known_filename_normalizations": dict(collisions),
        "ambiguous_labels": ambiguous,
        "distinct_classes_preserved": [
            "nichipet_ex_ii",
            "nichipet_ex_ii_and_biobase_vortex_mixer",
        ],
    }


def extract_dataset(sources: list[Path], output: Path, frame_step: int, max_frames: int) -> dict:
    if output.exists():
        shutil.rmtree(output)
    summary = {"train": Counter(), "val": Counter(), "sources": {}, "frame_step": frame_step, "max_frames": max_frames}
    for source in sources:
        split = "val" if source.name in VALIDATION_SOURCES else "train"
        summary["sources"][source.name] = {"split": split, "label": label_for(source)}
        capture = cv2.VideoCapture(str(source))
        if not capture.isOpened():
            raise RuntimeError(f"Could not open source video: {source}")
        destination = output / split / label_for(source)
        destination.mkdir(parents=True, exist_ok=True)
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        sample_count = min(max_frames, total_frames) if total_frames else max_frames
        frame_indices = np.linspace(0, max(0, total_frames - 1), sample_count, dtype=int) if total_frames else range(max_frames)
        written = 0
        for frame_index in frame_indices:
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(frame_index))
            ok, frame = capture.read()
            if not ok:
                continue
            target = destination / f"{source.stem}__f{int(frame_index):06d}.jpg"
            if not cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                raise RuntimeError(f"Could not write {target}")
            written += 1
        capture.release()
        summary[split].update({label_for(source): written})
    summary["train"] = dict(summary["train"])
    summary["val"] = dict(summary["val"])
    train_sources = {name for name, item in summary["sources"].items() if item["split"] == "train"}
    val_sources = {name for name, item in summary["sources"].items() if item["split"] == "val"}
    if train_sources & val_sources:
        raise RuntimeError("Source-video leakage detected")
    summary["train_sources"] = sorted(train_sources)
    summary["validation_sources"] = sorted(val_sources)
    (output / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def preprocess(frame: np.ndarray, metadata: dict) -> np.ndarray:
    size = int(metadata["inputSize"])
    height, width = frame.shape[:2]
    scale = size / min(width, height)
    resized = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_LINEAR)
    x = max(0, (resized.shape[1] - size) // 2)
    y = max(0, (resized.shape[0] - size) // 2)
    crop = resized[y:y + size, x:x + size]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    preprocessing = metadata.get("preprocessing", {})
    mean = np.asarray(preprocessing.get("mean", [0, 0, 0]), dtype=np.float32)
    std = np.asarray(preprocessing.get("std", [1, 1, 1]), dtype=np.float32)
    return np.transpose((rgb - mean) / std, (2, 0, 1))[None].astype(np.float32)


def probabilities(session, metadata: dict, frame: np.ndarray) -> tuple[np.ndarray, float]:
    started = time.perf_counter()
    output = session.run(None, {session.get_inputs()[0].name: preprocess(frame, metadata)})[0][0].astype(np.float64)
    if np.all((output >= 0) & (output <= 1)) and abs(output.sum() - 1) < 0.01:
        result = output
    else:
        shifted = output - np.max(output)
        result = np.exp(shifted) / np.exp(shifted).sum()
    return result, (time.perf_counter() - started) * 1000


def evaluate_model(model_path: Path, metadata_path: Path, sources: list[Path]) -> dict:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    names = metadata["displayNames"]
    rows = []
    for source in sources:
        capture = cv2.VideoCapture(str(source))
        if not capture.isOpened():
            continue
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        duration = frame_count / fps if fps else 0
        expected = label_for(source)
        for fraction in (0.2, 0.4, 0.6, 0.8):
            capture.set(cv2.CAP_PROP_POS_MSEC, duration * fraction * 1000)
            ok, frame = capture.read()
            if not ok:
                continue
            scores, latency = probabilities(session, metadata, frame)
            order = np.argsort(scores)[::-1]
            top1, top2 = int(order[0]), int(order[1])
            confidence = float(scores[top1])
            margin = float(scores[top1] - scores[top2])
            prediction = names[top1]
            accepted = confidence >= CONFIDENCE_THRESHOLD and margin >= MARGIN_THRESHOLD
            rows.append({"source": source.name, "expected": expected, "prediction": prediction, "confidence": confidence, "margin": margin, "accepted": accepted, "latency_ms": latency})
        capture.release()
    by_class = {}
    for expected in sorted({row["expected"] for row in rows}):
        class_rows = [row for row in rows if row["expected"] == expected]
        accepted = [row for row in class_rows if row["accepted"]]
        correct = [row for row in accepted if row["prediction"] == expected]
        by_class[expected] = {
            "samples": len(class_rows),
            "accepted": len(accepted),
            "acceptance_rate": len(accepted) / len(class_rows) if class_rows else 0,
            "accuracy": sum(row["prediction"] == expected for row in class_rows) / len(class_rows) if class_rows else 0,
            "false_acceptance": sum(row["prediction"] != expected for row in accepted),
            "accepted_precision": len(correct) / len(accepted) if accepted else None,
            "mean_latency_ms": sum(row["latency_ms"] for row in class_rows) / len(class_rows) if class_rows else 0,
        }
    accepted_rows = [row for row in rows if row["accepted"]]
    return {
        "model": str(model_path),
        "samples": len(rows),
        "accepted": len(accepted_rows),
        "accuracy": sum(row["prediction"] == row["expected"] for row in rows) / len(rows) if rows else 0,
        "false_acceptance": sum(row["prediction"] != row["expected"] for row in accepted_rows),
        "mean_latency_ms": sum(row["latency_ms"] for row in rows) / len(rows) if rows else 0,
        "per_class": by_class,
        "rows": rows,
    }


def train_candidate(args: argparse.Namespace, dataset: Path, output: Path) -> Path:
    from ultralytics import YOLO

    model = YOLO(str(args.base_model))
    model.train(
        task="classify",
        data=str(dataset),
        epochs=args.epochs,
        imgsz=224,
        batch=args.batch,
        project=str(output.resolve()),
        name="training",
        device=args.device,
        workers=0,
        exist_ok=True,
        degrees=8,
        translate=0.08,
        scale=0.20,
        shear=3,
        fliplr=0.0,
        hsv_h=0.015,
        hsv_s=0.45,
        hsv_v=0.25,
    )
    best = output / "training" / "weights" / "best.pt"
    if not best.exists():
        raise RuntimeError(f"Training did not produce {best}")
    exported = YOLO(str(best)).export(format="onnx", imgsz=224, simplify=True, opset=12)
    return Path(exported)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--frame-step", type=int, default=10)
    parser.add_argument("--max-frames", type=int, default=120)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--base-model", type=Path, default=ROOT / "yolov8n-cls.pt")
    parser.add_argument("--dataset", type=Path, help="Use an existing source-atomic dataset instead of decoding videos")
    parser.add_argument("--candidate-checkpoint", type=Path, help="Evaluate an already-trained Ultralytics checkpoint without retraining")
    parser.add_argument("--train", action="store_true")
    args = parser.parse_args()

    sources = source_inventory()
    audit = audit_sources(sources)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "label_audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    dataset = args.dataset or args.output / "dataset"
    if args.dataset:
        summary_path = dataset / "dataset_summary.json"
        if not summary_path.exists():
            raise FileNotFoundError(f"Existing dataset summary not found: {summary_path}")
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        train_sources = {name for name, split in summary["sources"].items() if split == "train"}
        validation_sources = {name for name, split in summary["sources"].items() if split == "val"}
        if train_sources & validation_sources:
            raise RuntimeError("Existing dataset contains source-video overlap")
        summary["train_sources"] = sorted(train_sources)
        summary["validation_sources"] = sorted(validation_sources)
    else:
        summary = extract_dataset(sources, dataset, args.frame_step, args.max_frames)
    if args.dataset:
        train_labels = sorted(path.name for path in (dataset / "train").iterdir() if path.is_dir())
        validation_labels = sorted(path.name for path in (dataset / "val").iterdir() if path.is_dir())
    else:
        train_labels = sorted({item["label"] for item in summary["sources"].values()})
        validation_labels = sorted({item["label"] for item in summary["sources"].values() if item["split"] == "val"})
    if not set(validation_labels).issubset(set(train_labels)):
        raise RuntimeError("Validation label has no training source")
    (args.output / "experiment_config.json").write_text(json.dumps({"thresholds": {"confidence": CONFIDENCE_THRESHOLD, "margin": MARGIN_THRESHOLD}, "validation_sources": sorted(VALIDATION_SOURCES), "train_labels": train_labels, "validation_labels": validation_labels, "production_model": str(PRODUCTION_MODEL), "production_metadata": str(PRODUCTION_METADATA)}, indent=2), encoding="utf-8")
    if not args.train:
        print(json.dumps({"status": "audit_and_dataset_ready", "output": str(args.output), "train_sources": len(summary["train_sources"]), "validation_sources": len(summary["validation_sources"]), "single_source_classes": audit["single_source_classes"]}, indent=2))
        return
    if args.candidate_checkpoint:
        from ultralytics import YOLO
        candidate_model = Path(YOLO(str(args.candidate_checkpoint)).export(format="onnx", imgsz=224, simplify=True, opset=12))
    else:
        candidate_model = train_candidate(args, dataset, args.output)
    validation_sources = [source for source in sources if source.name in VALIDATION_SOURCES]
    baseline = evaluate_model(PRODUCTION_MODEL, PRODUCTION_METADATA, validation_sources)
    candidate_metadata = args.output / "candidate_metadata.json"
    candidate_classes = sorted({path.name for path in (dataset / "train").iterdir() if path.is_dir()})
    candidate_metadata.write_text(json.dumps({"displayNames": candidate_classes, "classes": candidate_classes, "inputSize": 224, "preprocessing": {"mean": [0, 0, 0], "std": [1, 1, 1]}}, indent=2), encoding="utf-8")
    candidate = evaluate_model(candidate_model, candidate_metadata, validation_sources)
    payload = {"audit": audit, "dataset": summary, "baseline": baseline, "candidate": candidate, "candidate_model": str(candidate_model), "thresholds": {"confidence": CONFIDENCE_THRESHOLD, "margin": MARGIN_THRESHOLD}}
    (args.output / "evaluation.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"status": "complete", "evaluation": str(args.output / "evaluation.json"), "candidate_model": str(candidate_model), "baseline_accuracy": baseline["accuracy"], "candidate_accuracy": candidate["accuracy"], "baseline_false_acceptance": baseline["false_acceptance"], "candidate_false_acceptance": candidate["false_acceptance"], "baseline_latency_ms": baseline["mean_latency_ms"], "candidate_latency_ms": candidate["mean_latency_ms"]}, indent=2))


if __name__ == "__main__":
    main()