"""Validate and optionally retrain a local MobileNet V3 Small landmark candidate.

The input is the JSON downloaded from the browser's verified-example export.
Only confirmed/corrected records are accepted. Source sessions, rather than
individual frames, are assigned to splits so validation remains independent.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parent.parent
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
SEED = 20261008


def read_examples(path: Path):
    text = path.read_text(encoding="utf-8")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = [json.loads(line) for line in text.splitlines() if line.strip()]
    if isinstance(payload, dict):
        examples = payload.get("examples", [payload])
    else:
        examples = payload
    if not isinstance(examples, list):
        raise ValueError("Expected an export object containing an examples array.")
    accepted = []
    rejected = []
    seen = set()
    for item in examples:
        status = item.get("status")
        label = str(item.get("label") or "").strip().lower()
        session = str(item.get("sourceSession") or "").strip()
        image_url = item.get("imageDataUrl")
        reason = None
        if status not in {"confirmed", "corrected"}:
            reason = "record is not confirmed or corrected"
        elif not label:
            reason = "missing label"
        elif not session:
            reason = "missing sourceSession"
        elif not isinstance(image_url, str) or not image_url.startswith("data:image/"):
            reason = "missing imageDataUrl"
        if reason:
            rejected.append({"id": item.get("id"), "reason": reason})
            continue
        try:
            encoded = image_url.split(",", 1)[1]
            image_bytes = base64.b64decode(encoded, validate=True)
            Image.open(io.BytesIO(image_bytes)).verify()
        except Exception as error:  # noqa: BLE001
            rejected.append({"id": item.get("id"), "reason": f"invalid image: {error}"})
            continue
        digest = hashlib.sha256(image_bytes).hexdigest()
        if digest in seen:
            rejected.append({"id": item.get("id"), "reason": "duplicate image bytes"})
            continue
        seen.add(digest)
        accepted.append({"id": item.get("id"), "label": label, "session": session, "image": image_bytes, "digest": digest})
    if rejected:
        print(json.dumps({"rejected_records": len(rejected), "reasons": rejected}, indent=2))
    return accepted


def split_by_session(examples, validation_fraction, test_fraction):
    sessions = sorted({item["session"] for item in examples})
    random.Random(SEED).shuffle(sessions)
    validation_count = max(1, round(len(sessions) * validation_fraction)) if len(sessions) > 2 else 0
    test_count = max(1, round(len(sessions) * test_fraction)) if len(sessions) > 3 else 0
    test_sessions = set(sessions[:test_count])
    validation_sessions = set(sessions[test_count:test_count + validation_count])
    train_sessions = set(sessions[test_count + validation_count:])
    if not train_sessions:
        raise ValueError("Not enough independent sessions for a training split.")
    return (
        [item for item in examples if item["session"] in train_sessions],
        [item for item in examples if item["session"] in validation_sessions],
        [item for item in examples if item["session"] in test_sessions],
    )


def readiness(examples, minimum_per_class, minimum_sessions):
    counts = Counter(item["label"] for item in examples)
    sessions = {item["session"] for item in examples}
    missing = sorted(label for label, count in counts.items() if count < minimum_per_class)
    return {"ready": bool(examples) and len(sessions) >= minimum_sessions and not missing,
            "examples": len(examples), "classes": len(counts), "per_class": dict(sorted(counts.items())),
            "sessions": len(sessions), "minimum_per_class": minimum_per_class,
            "minimum_sessions": minimum_sessions, "underrepresented_labels": missing}


class ExampleDataset(Dataset):
    def __init__(self, examples, class_to_index, transform):
        self.examples = examples
        self.class_to_index = class_to_index
        self.transform = transform

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, index):
        item = self.examples[index]
        image = Image.open(io.BytesIO(item["image"])).convert("RGB")
        return self.transform(image), self.class_to_index[item["label"]]


def metrics(labels, predictions, class_count):
    matrix = np.zeros((class_count, class_count), dtype=np.int64)
    for label, prediction in zip(labels, predictions):
        matrix[label, prediction] += 1
    per_class = []
    for index in range(class_count):
        tp = matrix[index, index]
        fp = matrix[:, index].sum() - tp
        fn = matrix[index, :].sum() - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class.append({"precision": float(precision), "recall": float(recall), "f1": float(f1), "support": int(matrix[index].sum())})
    return {"accuracy": float(np.trace(matrix) / matrix.sum()) if matrix.sum() else 0.0,
            "macro_f1": float(np.mean([item["f1"] for item in per_class])) if per_class else 0.0,
            "per_class": per_class, "confusion_matrix": matrix.tolist(), "samples": int(matrix.sum())}


def evaluate(model, loader, device, class_count):
    model.eval()
    labels, predictions = [], []
    with torch.no_grad():
        for images, targets in loader:
            predictions.extend(model(images.to(device)).argmax(1).cpu().tolist())
            labels.extend(targets.tolist())
    return metrics(labels, predictions, class_count)


def train_candidate(train_rows, validation_rows, test_rows, classes, baseline_path, epochs, output):
    class_to_index = {label: index for index, label in enumerate(classes)}
    training_transform = transforms.Compose([transforms.RandomResizedCrop(224, scale=(0.92, 1.0)), transforms.ColorJitter(brightness=0.08, contrast=0.08, saturation=0.06), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    evaluation_transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    train_loader = DataLoader(ExampleDataset(train_rows, class_to_index, training_transform), batch_size=16, shuffle=True, num_workers=0)
    validation_loader = DataLoader(ExampleDataset(validation_rows, class_to_index, evaluation_transform), batch_size=16, shuffle=False, num_workers=0)
    test_loader = DataLoader(ExampleDataset(test_rows, class_to_index, evaluation_transform), batch_size=16, shuffle=False, num_workers=0)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    payload = torch.load(baseline_path, map_location="cpu", weights_only=False)
    model = models.mobilenet_v3_small(weights=None)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    baseline_state = payload["state_dict"]
    head_prefix = f"classifier.{len(model.classifier) - 1}"
    head_weight_key = f"{head_prefix}.weight"
    head_bias_key = f"{head_prefix}.bias"
    model_state = {key: value for key, value in baseline_state.items() if key not in {head_weight_key, head_bias_key}}
    model.load_state_dict(model_state, strict=False)
    baseline_classes = payload.get("classes", [])
    if baseline_classes and head_weight_key in baseline_state:
        with torch.no_grad():
            for label, index in class_to_index.items():
                if label in baseline_classes:
                    old_index = baseline_classes.index(label)
                    model.classifier[-1].weight[index].copy_(baseline_state[head_weight_key][old_index])
                    model.classifier[-1].bias[index].copy_(baseline_state[head_bias_key][old_index])
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.to(device)
    counts = Counter(item["label"] for item in train_rows)
    weights = torch.tensor([len(train_rows) / (len(classes) * counts[label]) for label in classes], dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=0.0002, weight_decay=0.01)
    best_state, best_score = None, -1.0
    for epoch in range(epochs):
        model.train()
        for images, targets in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images.to(device)), targets.to(device))
            loss.backward()
            optimizer.step()
        result = evaluate(model, validation_loader, device, len(classes))
        print(f"epoch {epoch + 1}/{epochs}: val_accuracy={result['accuracy']:.4f} macro_f1={result['macro_f1']:.4f}")
        if result["macro_f1"] > best_score:
            best_score = result["macro_f1"]
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
    if best_state is None:
        raise RuntimeError("No candidate checkpoint was produced.")
    output.mkdir(parents=True, exist_ok=True)
    checkpoint = output / "candidate_mobilenet_v3_small.pth"
    torch.save({"state_dict": best_state, "classes": classes, "class_to_index": class_to_index, "architecture": "mobilenet_v3_small", "baseline_checkpoint": str(baseline_path)}, checkpoint)
    model.load_state_dict(best_state)
    held_out_metrics = evaluate(model, test_loader, device, len(classes)) if test_rows else {"samples": 0}
    onnx_path = output / "candidate_mobilenet_v3_small.onnx"
    try:
        model.cpu().eval()
        torch.onnx.export(model, torch.zeros(1, 3, 224, 224), onnx_path, input_names=["image"], output_names=["scores"], opset_version=17)
    except Exception as error:  # noqa: BLE001
        print(f"ONNX export unavailable; retaining PyTorch candidate: {error}")
        onnx_path = None
    return checkpoint, onnx_path, result, held_out_metrics


def run_once(args):
    lock_path = args.output / ".training.lock"
    args.output.mkdir(parents=True, exist_ok=True)
    try:
        with lock_path.open("x", encoding="utf-8") as lock:
            lock.write(str(time.time()))
    except FileExistsError:
        print(json.dumps({"status": "already_running", "lock": str(lock_path)}))
        return 4
    try:
        return _run_once_locked(args)
    finally:
        lock_path.unlink(missing_ok=True)


def _run_once_locked(args):
    examples = read_examples(args.export)
    report = readiness(examples, args.minimum_per_class, args.minimum_sessions)
    (args.output / "readiness.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.dry_run or not report["ready"]:
        print(json.dumps(report, indent=2))
        return 0 if args.dry_run else 2
    train_rows, validation_rows, test_rows = split_by_session(examples, args.validation_fraction, args.test_fraction)
    classes = sorted({item["label"] for item in examples})
    checkpoint, onnx_path, validation_metrics, held_out_metrics = train_candidate(train_rows, validation_rows, test_rows, classes, args.baseline, args.epochs, args.output)
    metadata = {"model_id": f"landmark-{time.strftime('%Y%m%d-%H%M%S')}", "status": "candidate", "classes": classes, "source_sessions": len({item['session'] for item in examples}), "train_sessions": sorted({item['session'] for item in train_rows}), "validation_sessions": sorted({item['session'] for item in validation_rows}), "held_out_sessions": sorted({item['session'] for item in test_rows}), "validation": validation_metrics, "held_out": held_out_metrics, "checkpoint": checkpoint.name, "onnx": onnx_path.name if onnx_path else None, "sha256": hashlib.sha256(checkpoint.read_bytes()).hexdigest(), "approved": False}
    if args.baseline_metrics and args.baseline_metrics.exists():
        baseline = json.loads(args.baseline_metrics.read_text(encoding="utf-8"))
        baseline_f1 = baseline.get("macro_f1", baseline.get("finetuned", {}).get("macro_f1", 0.0))
        metadata["quality_gate"] = {"baseline_macro_f1": baseline_f1, "passed": validation_metrics["macro_f1"] >= baseline_f1 - args.max_regression}
        if not metadata["quality_gate"]["passed"]:
            metadata["status"] = "rejected"
            checkpoint.unlink(missing_ok=True)
    (args.output / "candidate_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))
    return 0 if metadata["status"] == "candidate" else 3


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline-metrics", type=Path)
    parser.add_argument("--minimum-per-class", type=int, default=8)
    parser.add_argument("--minimum-sessions", type=int, default=3)
    parser.add_argument("--validation-fraction", type=float, default=0.2)
    parser.add_argument("--test-fraction", type=float, default=0.2)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--max-regression", type=float, default=0.02)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--watch-seconds", type=int, default=0)
    args = parser.parse_args()
    random.seed(SEED)
    if args.watch_seconds <= 0:
        raise SystemExit(run_once(args))
    previous_digest = None
    while True:
        if not args.export.exists():
            time.sleep(args.watch_seconds)
            continue
        digest = hashlib.sha256(args.export.read_bytes()).hexdigest()
        if digest != previous_digest:
            previous_digest = digest
            run_once(args)
        time.sleep(args.watch_seconds)


if __name__ == "__main__":
    main()
