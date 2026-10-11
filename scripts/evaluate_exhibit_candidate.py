"""Evaluate a candidate ONNX exhibit classifier against its deployed baseline.

The evaluator reproduces the browser specialist contract: RGB images are resized
by shortest edge, center-cropped to the declared input size, converted to NCHW,
normalized with the deployed metadata, and interpreted as logits/probabilities.
It never writes production assets. A passing candidate is READY_FOR_REVIEW only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from retraining_memory import collect, memory_limit_mb, memory_snapshot, rss_mb

CONFIDENCE_THRESHOLD = 0.80
MARGIN_THRESHOLD = 0.15
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def metadata_classes(metadata: dict) -> list[str]:
    values = metadata.get("class_to_index")
    if isinstance(values, dict):
        ordered = sorted(values.items(), key=lambda item: item[1])
        classes = [str(item[0]) for item in ordered]
    else:
        classes = metadata.get("classes") or metadata.get("class_names") or metadata.get("displayNames") or metadata.get("display_names") or []
    return [str(value) for value in classes]


def metadata_label_aliases(metadata: dict) -> dict[str, str]:
    classes = metadata_classes(metadata)
    display_names = metadata.get("displayNames") or metadata.get("display_names") or classes
    return {str(alias): classes[index] for index, alias in enumerate(display_names) if index < len(classes)}


def preprocessing(metadata: dict) -> tuple[list[float], list[float]]:
    config = metadata.get("preprocessing") or metadata
    mean = [float(value) for value in config.get("mean", [0, 0, 0])]
    std = [float(value) for value in config.get("std", [1, 1, 1])]
    if len(mean) != 3 or len(std) != 3 or any(value == 0 for value in std):
        raise ValueError("preprocessing must define three non-zero mean/std values")
    return mean, std


def declared_shape(metadata: dict, key: str) -> list[int] | None:
    value = metadata.get(key)
    return [int(item) for item in value] if isinstance(value, list) and all(isinstance(item, (int, float)) for item in value) else None


def inspect_model(model_path: Path, metadata: dict) -> dict:
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    outputs = session.get_outputs()
    if len(inputs) != 1 or len(outputs) != 1:
        raise ValueError("candidate and production models must have exactly one input and one output")
    input_shape = [int(value) if isinstance(value, (int, np.integer)) else -1 for value in inputs[0].shape]
    output_shape = [int(value) if isinstance(value, (int, np.integer)) else -1 for value in outputs[0].shape]
    expected_input = declared_shape(metadata, "input_shape")
    expected_output = declared_shape(metadata, "output_shape")
    if expected_input and input_shape != expected_input:
        raise ValueError(f"ONNX input shape {input_shape} disagrees with metadata {expected_input}")
    if expected_output and output_shape != expected_output:
        raise ValueError(f"ONNX output shape {output_shape} disagrees with metadata {expected_output}")
    return {
        "session": session,
        "input_name": inputs[0].name,
        "output_name": outputs[0].name,
        "input_shape": input_shape,
        "output_shape": output_shape,
        "architecture": metadata.get("architecture") or metadata.get("model_type") or metadata.get("model_name"),
    }


def validate_contract(production: dict, candidate: dict, production_metadata: dict, candidate_metadata: dict) -> list[str]:
    errors = []
    production_classes = metadata_classes(production_metadata)
    candidate_classes = metadata_classes(candidate_metadata)
    if not production_classes or not candidate_classes:
        errors.append("missing class mapping")
    elif candidate_classes != production_classes:
        errors.append("candidate class mapping differs from production")
    if production["input_shape"] != candidate["input_shape"]:
        errors.append("candidate input architecture differs from production")
    if production["output_shape"] != candidate["output_shape"]:
        errors.append("candidate output architecture differs from production")
    try:
        production_mean, production_std = preprocessing(production_metadata)
        candidate_mean, candidate_std = preprocessing(candidate_metadata)
        if not np.allclose(production_mean, candidate_mean) or not np.allclose(production_std, candidate_std):
            errors.append("candidate preprocessing differs from production")
    except ValueError as error:
        errors.append(str(error))
    if production_metadata.get("output_type", "logits") != candidate_metadata.get("output_type", "logits"):
        errors.append("candidate output type differs from production")
    return errors


def image_rows(test_dir: Path, classes: list[str], aliases: dict[str, str]) -> list[tuple[str, Path]]:
    if not test_dir.is_dir():
        return []
    rows = []
    for label_dir in sorted(path for path in test_dir.iterdir() if path.is_dir()):
        label = aliases.get(label_dir.name)
        if label not in classes:
            continue
        for image_path in sorted(path for path in label_dir.rglob("*") if path.suffix.lower() in IMAGE_EXTENSIONS):
            rows.append((label, image_path))
    return rows


def preprocess(image_path: Path, input_size: int, mean: list[float], std: list[float]) -> np.ndarray:
    image = Image.open(image_path).convert("RGB")
    scale = input_size / min(image.width, image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.BILINEAR)
    left = (resized.width - input_size) // 2
    top = (resized.height - input_size) // 2
    cropped = resized.crop((left, top, left + input_size, top + input_size))
    values = np.asarray(cropped, dtype=np.float32) / 255.0
    values = (values - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    return np.transpose(values, (2, 0, 1))[None, ...].astype(np.float32)


def probabilities(raw: np.ndarray, output_type: str) -> np.ndarray:
    values = np.asarray(raw, dtype=np.float64).reshape(-1)
    if output_type == "probabilities" or (np.all(values >= 0) and np.all(values <= 1) and math.isclose(float(values.sum()), 1.0, abs_tol=0.01)):
        return values
    shifted = values - values.max()
    exp = np.exp(shifted)
    return exp / exp.sum()


def infer(model: dict, metadata: dict, image_path: Path) -> dict:
    shape = model["input_shape"]
    if shape != [1, 3, 224, 224]:
        raise ValueError(f"browser specialist contract requires [1, 3, 224, 224], got {shape}")
    mean, std = preprocessing(metadata)
    output = model["session"].run([model["output_name"]], {model["input_name"]: preprocess(image_path, shape[-1], mean, std)})[0]
    values = probabilities(output, metadata.get("output_type", "logits"))
    order = np.argsort(values)[::-1]
    top = int(order[0])
    second = float(values[order[1]]) if len(order) > 1 else 0.0
    confidence = float(values[top])
    margin = confidence - second
    return {"index": top, "confidence": confidence, "margin": margin, "accepted": confidence >= CONFIDENCE_THRESHOLD and margin >= MARGIN_THRESHOLD}


def release_sessions(models: list[dict]) -> None:
    for model in models:
        session = model.get("session")
        release = getattr(getattr(session, "_sess", None), "release", None)
        if callable(release):
            release()
        model["session"] = None
    collect()


def metric(matrix: list[list[int]], accepted: int, false_acceptances: int, classes: list[str]) -> dict:
    per_class = {}
    for index, label in enumerate(classes):
        true_positive = matrix[index][index]
        support = sum(matrix[index])
        predicted = sum(matrix[row][index] for row in range(len(classes)))
        precision = true_positive / predicted if predicted else 0.0
        recall = true_positive / support if support else 0.0
        per_class[label] = {"precision": precision, "recall": recall, "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0, "support": support}
    samples = sum(sum(row) for row in matrix)
    accuracy = sum(matrix[index][index] for index in range(len(classes))) / samples if samples else 0.0
    return {
        "accuracy": accuracy,
        "per_class": per_class,
        "confusion_matrix": matrix,
        "accepted": accepted,
        "false_acceptance_count": false_acceptances,
        "false_acceptance_rate": false_acceptances / accepted if accepted else 0.0,
        "samples": samples,
    }


def evaluate(args: argparse.Namespace) -> dict:
    batch_size = max(1, int(getattr(args, "batch_size", 2)))
    memory_limit = int(getattr(args, "memory_limit_mb", memory_limit_mb()))
    memory_log = getattr(args, "memory_log", None)
    production_metadata = load_json(args.production_metadata)
    candidate_metadata = load_json(args.candidate_metadata)
    classes = metadata_classes(production_metadata)
    production = inspect_model(args.production_model, production_metadata)
    try:
        candidate = inspect_model(args.candidate_model, candidate_metadata)
    except Exception:
        release_sessions([production])
        raise
    models = [production, candidate]
    contract_errors = validate_contract(production, candidate, production_metadata, candidate_metadata)
    rows = image_rows(args.test_dir, classes, metadata_label_aliases(production_metadata))
    counts = Counter(label for label, _ in rows)
    missing_classes = [label for label in classes if counts[label] < args.minimum_samples_per_class]
    reasons = list(contract_errors)
    if not rows:
        reasons.append("missing evaluation data")
    if missing_classes:
        reasons.append(f"insufficient test coverage: {', '.join(missing_classes)}")
    baseline_matrix = [[0 for _ in classes] for _ in classes]
    candidate_matrix = [[0 for _ in classes] for _ in classes]
    baseline_accepted = candidate_accepted = 0
    baseline_false_acceptances = candidate_false_acceptances = 0
    memory_snapshot("evaluation_start", memory_log)
    if not reasons:
        try:
            for start in range(0, len(rows), batch_size):
                batch = rows[start:start + batch_size]
                for label, image_path in batch:
                    actual = classes.index(label)
                    baseline_prediction = infer(production, production_metadata, image_path)
                    candidate_prediction = infer(candidate, candidate_metadata, image_path)
                    baseline_matrix[actual][baseline_prediction["index"]] += 1
                    candidate_matrix[actual][candidate_prediction["index"]] += 1
                    if baseline_prediction["accepted"]:
                        baseline_accepted += 1
                        baseline_false_acceptances += int(baseline_prediction["index"] != actual)
                    if candidate_prediction["accepted"]:
                        candidate_accepted += 1
                        candidate_false_acceptances += int(candidate_prediction["index"] != actual)
                collect()
                current_rss = rss_mb()
                memory_snapshot(f"evaluation_batch_{start // batch_size + 1}", memory_log)
                if current_rss is not None and current_rss > memory_limit:
                    raise MemoryError(f"evaluation RSS {current_rss:.1f} MB exceeded limit {memory_limit} MB")
        except Exception:
            release_sessions(models)
            raise
    baseline_metrics = metric(baseline_matrix, baseline_accepted, baseline_false_acceptances, classes)
    candidate_metrics = metric(candidate_matrix, candidate_accepted, candidate_false_acceptances, classes)
    recall_delta = {label: candidate_metrics["per_class"][label]["recall"] - baseline_metrics["per_class"][label]["recall"] for label in classes}
    regression = {
        "accuracy_delta": candidate_metrics["accuracy"] - baseline_metrics["accuracy"],
        "false_acceptance_rate_delta": candidate_metrics["false_acceptance_rate"] - baseline_metrics["false_acceptance_rate"],
        "per_class_recall_delta": recall_delta,
    }
    if not reasons:
        if regression["accuracy_delta"] < -args.max_accuracy_regression:
            reasons.append("accuracy regression exceeds gate")
        if regression["false_acceptance_rate_delta"] > args.max_false_acceptance_regression:
            reasons.append("false acceptance regression exceeds gate")
        if any(value < -args.max_recall_regression for value in recall_delta.values()):
            reasons.append("per-class recall regression exceeds gate")
    passed = not reasons
    result = {
        "schema_version": 1,
        "production_model": {"path": str(args.production_model), "sha256": sha256(args.production_model), "metadata": production_metadata},
        "candidate_model": {"path": str(args.candidate_model), "sha256": sha256(args.candidate_model), "metadata": candidate_metadata},
        "evaluation_data": {"path": str(args.test_dir), "samples": len(rows), "class_counts": dict(counts), "minimum_samples_per_class": args.minimum_samples_per_class},
        "contract": {"input_shape": production["input_shape"], "preprocessing": production_metadata.get("preprocessing", {}), "confidence_threshold": CONFIDENCE_THRESHOLD, "margin_threshold": MARGIN_THRESHOLD, "errors": contract_errors},
        "classes": classes,
        "baseline": baseline_metrics,
        "candidate": candidate_metrics,
        "regression": regression,
        "promotion_decision": "READY_FOR_REVIEW" if passed else "REJECTED",
        "quality_gate": {"passed": passed, "reasons": reasons, "production_model_changed": False, "automatic_deployment": False},
    }
    memory_snapshot("evaluation_complete", memory_log)
    result["memory"] = {"limit_mb": memory_limit, "peak_rss_mb": rss_mb(), "batch_size": batch_size, "sessions_released": False}
    release_sessions(models)
    result["memory"]["rss_after_release_mb"] = rss_mb()
    result["memory"]["sessions_released"] = True
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--production-model", type=Path, required=True)
    parser.add_argument("--production-metadata", type=Path, required=True)
    parser.add_argument("--candidate-model", type=Path, required=True)
    parser.add_argument("--candidate-metadata", type=Path, required=True)
    parser.add_argument("--test-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--minimum-samples-per-class", type=int, default=2)
    parser.add_argument("--max-accuracy-regression", type=float, default=0.02)
    parser.add_argument("--max-recall-regression", type=float, default=0.05)
    parser.add_argument("--max-false-acceptance-regression", type=float, default=0.02)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--memory-limit-mb", type=int, default=memory_limit_mb())
    parser.add_argument("--memory-log", type=Path, default=None)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    evaluation_lock = args.output.parent / ".evaluation.lock"
    lock_acquired = False
    try:
        evaluation_lock.open("x").write(str(args.output))
        lock_acquired = True
        if args.memory_log is None:
            args.memory_log = args.output.with_name("memory.log")
        result = evaluate(args)
    except (OSError, ValueError, RuntimeError, MemoryError) as error:
        result = {"schema_version": 1, "promotion_decision": "REJECTED", "quality_gate": {"passed": False, "reasons": [str(error)], "production_model_changed": False, "automatic_deployment": False}}
    finally:
        if lock_acquired:
            evaluation_lock.unlink(missing_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["quality_gate"]["passed"] else 3)


if __name__ == "__main__":
    main()