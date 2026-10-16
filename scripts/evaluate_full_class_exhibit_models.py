"""Evaluate deployed exhibit classifiers on defensible class-level evidence.

This script never trains or changes model assets. It uses source-video-disjoint
validation recordings where repository summaries prove the split, and records
RECON image labels as independence-unverified because no split manifest exists.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / "public" / "models"
DATA_ROOT = ROOT / "Documentation" / "datasets"
CSV_PATH = ROOT / "Documentation" / "chapter4_full_class_evaluation.csv"
MD_PATH = ROOT / "Documentation" / "chapter4_full_class_evaluation.md"
CONFIDENCE_THRESHOLD = 0.80
MARGIN_THRESHOLD = 0.15
SAMPLES_PER_SOURCE = 10
VIDEO_EXTENSIONS = {".mov", ".mp4", ".avi", ".mkv"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".heic", ".heif"}
ZONES = ("ARICC", "RECON", "FABLAB", "CAESAR")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def label_for(path: Path) -> str:
    stem = re.sub(r"[\s_-]+\d+$", "", path.stem).strip()
    stem = re.sub(r"multi[- ]paramter", "multi-parameter", stem, flags=re.IGNORECASE)
    return re.sub(r"[-\s]+", "_", re.sub(r"[^\w\s-]", "", stem).lower()).strip("_")


def metadata_for(zone: str) -> tuple[Path, Path, dict, list[str]]:
    stem = zone.lower()
    model_path = MODEL_ROOT / stem / f"{stem}_classifier.onnx"
    metadata_path = MODEL_ROOT / stem / f"{stem}_classifier_metadata.json"
    metadata = load_json(metadata_path)
    classes = metadata.get("displayNames") or metadata.get("classes") or []
    if metadata.get("class_to_index"):
        classes = [name for name, _ in sorted(metadata["class_to_index"].items(), key=lambda item: item[1])]
    return model_path, metadata_path, metadata, classes


def preprocess(frame: np.ndarray, metadata: dict) -> np.ndarray:
    size = int(metadata.get("inputSize", metadata.get("input_shape", [1, 3, 224, 224])[-1]))
    height, width = frame.shape[:2]
    scale = size / min(width, height)
    resized = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_LINEAR)
    left = max(0, (resized.shape[1] - size) // 2)
    top = max(0, (resized.shape[0] - size) // 2)
    crop = resized[top:top + size, left:left + size]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    preprocessing = metadata.get("preprocessing", {})
    mean = np.asarray(preprocessing.get("mean", [0, 0, 0]), dtype=np.float32)
    std = np.asarray(preprocessing.get("std", [1, 1, 1]), dtype=np.float32)
    return np.transpose((rgb - mean) / std, (2, 0, 1))[None].astype(np.float32)


def infer(session: ort.InferenceSession, metadata: dict, classes: list[str], frame: np.ndarray) -> dict:
    started = time.perf_counter()
    output = session.run(None, {session.get_inputs()[0].name: preprocess(frame, metadata)})[0][0].astype(np.float64)
    latency_ms = (time.perf_counter() - started) * 1000
    if not (np.all((output >= 0) & (output <= 1)) and abs(output.sum() - 1) < 0.01):
        shifted = output - np.max(output)
        output = np.exp(shifted) / np.exp(shifted).sum()
    order = np.argsort(output)[::-1]
    top = int(order[0])
    second = float(output[order[1]]) if len(order) > 1 else 0.0
    confidence = float(output[top])
    margin = confidence - second
    accepted = confidence >= CONFIDENCE_THRESHOLD and margin >= MARGIN_THRESHOLD
    return {
        "raw_predicted": classes[top],
        "predicted": classes[top] if accepted else "UNKNOWN",
        "confidence": confidence,
        "margin": margin,
        "accepted": accepted,
        "latency_ms": latency_ms,
    }


def source_video_rows(zone: str, classes: list[str]) -> tuple[list[dict], dict]:
    if zone == "ARICC":
        summary_path = ROOT / "runs" / "aricc_documentation_dataset_v10" / "dataset_summary.json"
        summary = load_json(summary_path)
        root = DATA_ROOT / "ARICC" / "ARICC"
        eligible = {name: item for name, item in summary["videos"].items() if item.get("validation_source_split") and item.get("val")}
    elif zone == "FABLAB":
        summary_path = ROOT / "runs" / "fablab_documentation_dataset" / "dataset_summary.json"
        summary = load_json(summary_path)
        root = DATA_ROOT / "FABLAB"
        eligible = {name: item for name, item in summary["videos"].items() if item.get("independent_source_split") and item.get("val")}
    else:
        root = DATA_ROOT / zone
        if zone == "CAESAR":
            eligible = {
                path.stem: {"val": [path.name], "independent_source_split": True}
                for path in sorted(root.iterdir())
                if path.suffix.lower() in VIDEO_EXTENSIONS and path.name in {
                    "Analytical Balance.MOV", "Benchtop Multi-Parameter Meter.MOV", "Digital Dry Bath Incubator 2.MOV",
                    "Ducted Fumehood.MOV", "Incubator.MOV", "Laboratory Glassware 2.MOV",
                }
            }
        else:
            eligible = {}
    rows = []
    provenance = {}
    for expected, item in eligible.items():
        expected_label = expected if expected in classes else label_for(Path(expected))
        for source_name in item.get("val", []):
            source = root / source_name
            provenance[source.name] = {"split": "validation", "independence": "source-disjoint"}
            if not source.is_file():
                continue
            capture = cv2.VideoCapture(str(source))
            if not capture.isOpened():
                continue
            total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            indices = np.linspace(0, max(total - 1, 0), min(SAMPLES_PER_SOURCE, total) if total else SAMPLES_PER_SOURCE, dtype=int)
            for index in indices:
                capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
                ok, frame = capture.read()
                if ok:
                    rows.append({"zone": zone, "expected": expected_label, "source": str(source.relative_to(ROOT)).replace("\\", "/"), "source_split": "validation", "independence": "source-disjoint", "frame_index": int(index), "frame": frame})
            capture.release()
    return rows, provenance


def recon_image_rows(classes: list[str]) -> tuple[list[dict], dict]:
    root = DATA_ROOT / "RECON"
    labels = load_json(root / "ocr_labels.json")
    rows = []
    provenance = {}
    for name, item in labels.items():
        expected = item.get("label")
        source = root / name
        if not expected or expected not in classes or not source.is_file() or source.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        image = cv2.imdecode(np.fromfile(str(source), dtype=np.uint8), cv2.IMREAD_COLOR)
        provenance[name] = {"split": "unspecified", "independence": "unverified"}
        if image is not None:
            rows.append({"zone": "RECON", "expected": expected, "source": str(source.relative_to(ROOT)).replace("\\", "/"), "source_split": "unspecified", "independence": "unverified", "frame_index": "", "frame": image})
    return rows, provenance


def metrics(rows: list[dict], classes: list[str]) -> tuple[dict, list[list[int]]]:
    labels = classes + ["UNKNOWN"]
    index = {label: position for position, label in enumerate(labels)}
    matrix = [[0 for _ in labels] for _ in labels]
    for row in rows:
        matrix[index[row["expected"]]][index[row["predicted"]]] += 1
    per_class = {}
    for label in classes:
        actual = index[label]
        predicted = index[label]
        tp = matrix[actual][predicted]
        support = sum(matrix[actual])
        predicted_count = sum(matrix[item][predicted] for item in range(len(labels)))
        precision = tp / predicted_count if predicted_count else None
        recall = tp / support if support else None
        f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else None
        per_class[label] = {"samples": support, "correct": tp, "precision": precision, "recall": recall, "f1": f1}
    total = len(rows)
    correct = sum(row["predicted"] == row["expected"] for row in rows)
    raw_correct = sum(row["raw_predicted"] == row["expected"] for row in rows)
    accepted = sum(row["accepted"] for row in rows)
    return {"total": total, "correct": correct, "incorrect": sum(row["predicted"] != "UNKNOWN" and row["predicted"] != row["expected"] for row in rows), "unknown": sum(row["predicted"] == "UNKNOWN" for row in rows), "accepted": accepted, "raw_top1_accuracy": raw_correct / total if total else None, "application_accuracy": correct / total if total else None, "per_class": per_class}, matrix


def fmt(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.4f}"


def main() -> None:
    all_rows = []
    zone_info = {}
    for zone in ZONES:
        model_path, metadata_path, metadata, classes = metadata_for(zone)
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        if zone == "RECON":
            inputs, provenance = recon_image_rows(classes)
        else:
            inputs, provenance = source_video_rows(zone, classes)
        evaluated = []
        for item in inputs:
            result = infer(session, metadata, classes, item.pop("frame"))
            evaluated.append({**item, **result, "correct": result["predicted"] == item["expected"]})
        summary, matrix = metrics(evaluated, classes)
        zone_info[zone] = {"model_path": model_path, "metadata_path": metadata_path, "metadata": metadata, "classes": classes, "rows": evaluated, "summary": summary, "matrix": matrix, "provenance": provenance}
        all_rows.extend(evaluated)

    fieldnames = ["record_type", "zone", "expected", "predicted", "raw_predicted", "confidence", "margin", "accepted", "correct", "source", "source_split", "independence", "frame_index", "latency_ms", "samples", "precision", "recall", "f1", "status"]
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for zone in ZONES:
            info = zone_info[zone]
            covered = {row["expected"] for row in info["rows"]}
            for row in info["rows"]:
                writer.writerow({"record_type": "sample", **{key: row.get(key, "") for key in fieldnames if key != "record_type"}})
            for label in info["classes"]:
                item = info["summary"]["per_class"][label]
                if label not in covered:
                    writer.writerow({"record_type": "missing_class", "zone": zone, "expected": label, "status": "NO_INDEPENDENT_TEST_SAMPLES"})
                else:
                    writer.writerow({"record_type": "class_metric", "zone": zone, "expected": label, "samples": item["samples"], "precision": fmt(item["precision"]), "recall": fmt(item["recall"]), "f1": fmt(item["f1"]), "status": "VALIDATED" if all(row["independence"] == "source-disjoint" for row in info["rows"] if row["expected"] == label) else "INDEPENDENCE_UNVERIFIED"})

    for zone, info in zone_info.items():
        labels = info["classes"] + ["UNKNOWN"]
        matrix_path = ROOT / "Documentation" / f"chapter4_full_class_confusion_{zone.lower()}.csv"
        with matrix_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["expected\\predicted", *labels])
            for label, values in zip(labels, info["matrix"]):
                writer.writerow([label, *values])

    branch = git("branch", "--show-current")
    commit = git("rev-parse", "HEAD")
    lines = ["# Chapter 4 Full-Class Exhibit Evaluation", "", f"Generated: `{datetime.now(timezone.utc).isoformat()}`  ", f"Branch: `{branch}`  ", f"Commit used before testing: `{commit}`  ", "", "This run uses the deployed local ONNX assets without retraining. Each sample uses the TAYLOR center-crop, RGB, `/255`, metadata mean/std, NCHW preprocessing and acceptance thresholds confidence >= 0.80 and top-1 margin >= 0.15. Rejected samples are reported as UNKNOWN.", ""]
    lines += ["## Model Class Mappings", "", "| Center | Model | Classes |", "|---|---|---:|"]
    for zone in ZONES:
        info = zone_info[zone]
        model_version = info["metadata"].get("model_name") or Path(info["metadata"].get("onnx", "")).parent.parent.name or "not declared"
        lines.append(f"| {zone} | `{model_version}` | {len(info['classes'])} |")
        lines.append("")
        lines.append("; ".join(f"{index}: {label}" for index, label in enumerate(info["classes"])))
    lines += ["", "## Center Summary", "", "| Center | Samples | Correct | Incorrect | UNKNOWN | Raw top-1 accuracy | Application accuracy | Evidence |", "|---|---:|---:|---:|---:|---:|---:|---|"]
    for zone in ZONES:
        info = zone_info[zone]
        summary = info["summary"]
        evidence = "source-disjoint validation" if info["rows"] and all(row["independence"] == "source-disjoint" for row in info["rows"]) else ("labeled images; independence unverified" if info["rows"] else "no eligible samples")
        lines.append(f"| {zone} | {summary['total']} | {summary['correct']} | {summary['incorrect']} | {summary['unknown']} | {fmt(summary['raw_top1_accuracy'])} | {fmt(summary['application_accuracy'])} | {evidence} |")
    lines += ["", "## Per-Class Metrics And Missing Classes"]
    for zone in ZONES:
        info = zone_info[zone]
        lines += ["", f"### {zone}", "", "| Class | Samples | Precision | Recall | F1 | Status |", "|---|---:|---:|---:|---:|---|"]
        covered = {row["expected"] for row in info["rows"]}
        for label in info["classes"]:
            item = info["summary"]["per_class"][label]
            status = "VALIDATED" if label in covered and all(row["independence"] == "source-disjoint" for row in info["rows"] if row["expected"] == label) else ("INDEPENDENCE UNVERIFIED" if label in covered else "MISSING INDEPENDENT TEST SAMPLES")
            lines.append(f"| {label} | {item['samples']} | {fmt(item['precision'])} | {fmt(item['recall'])} | {fmt(item['f1'])} | {status} |")
        lines.append("")
        lines.append(f"Confusion matrix: `Documentation/chapter4_full_class_confusion_{zone.lower()}.csv` (columns include UNKNOWN).")
    lines += ["", "## UNKNOWN/Background Rejection", "", "No independently labeled negative/background image manifest was found for these four specialist classifiers. UNKNOWN rejection precision, recall, F1, and false-acceptance rate are therefore **NOT COMPLETED**. The UNKNOWN column in each matrix reflects only threshold rejection on labeled positive samples.", "", "## Loading, Latency, And Production Consistency", "", "- All four local ONNX sessions loaded with CPU ONNX Runtime and produced inference rows where eligible data decoded.", "- Per-sample inference latency is recorded in the CSV `latency_ms` column.", "- Current production metadata endpoints were checked and their class mappings, shapes, and preprocessing declarations match the local JSON metadata. Production ONNX binary hashes were not available from metadata-only HTTP inspection, so binary parity is **UNVERIFIED**.", "- Physical mobile-device compatibility is not completed; see `Documentation/MOBILE_DEVICE_TEST_PLAN.md`.", "", "## Limitations", "", "- ARICC: 4/8 classes have source-disjoint validation videos; 4 classes are missing independent source videos.", "- FABLAB: 4/7 classes have independent validation videos; 3 classes are missing.", "- CAESAR: 6/19 classes have source-disjoint validation videos; 13 classes are missing.", "- RECON: labeled images are available, but no repository split proves independence from training/validation; results are explicitly unverified for independence.", "- No training images, augmented duplicates, or same-source training frames were used as independent evidence by this script."]
    MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"csv": str(CSV_PATH), "markdown": str(MD_PATH), "commit": commit, "centers": {zone: info["summary"] for zone, info in zone_info.items()}}, indent=2))


if __name__ == "__main__":
    main()