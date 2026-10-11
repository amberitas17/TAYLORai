"""Diagnose baseline errors and run controlled MobileNetV3-Small fine-tuning."""

from __future__ import annotations

import argparse
import csv
import json
import random
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
PROPOSAL = ROOT / "runs" / "landmark_reduced_experiment" / "reduced_landmark_split_proposal.json"
BASELINE = ROOT / "runs" / "landmark_reduced_experiment" / "training"
OUTPUT = ROOT / "runs" / "landmark_reduced_experiment" / "finetuning_v2"
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
SEED = 20261008


class ManifestDataset(Dataset):
    def __init__(self, rows, class_to_index, transform):
        self.rows = rows
        self.class_to_index = class_to_index
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        image = Image.open(WORK.parent / row["frame_path"]).convert("RGB")
        return self.transform(image), self.class_to_index[row["label"]], row


def collate_batch(batch):
    images, targets, rows = zip(*batch)
    return torch.stack(images), torch.tensor(targets, dtype=torch.long), list(rows)


def seed_everything():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


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
        per_class.append({"precision": float(precision), "recall": float(recall), "f1": float(f1), "support": int(matrix[index, :].sum())})
    return {"accuracy": float(np.trace(matrix) / matrix.sum()), "macro_f1": float(np.mean([item["f1"] for item in per_class])), "per_class": per_class, "confusion_matrix": matrix.tolist(), "samples": int(matrix.sum())}


def predict(model, loader, device, class_count):
    model.eval()
    labels, predictions, rows = [], [], []
    with torch.no_grad():
        for images, targets, batch_rows in loader:
            output = model(images.to(device)).argmax(1).cpu().tolist()
            labels.extend(targets.tolist())
            predictions.extend(output)
            rows.extend(batch_rows)
    return metrics(labels, predictions, class_count), labels, predictions, rows


def error_sheets(rows, labels, predictions, classes, output):
    error_root = output / "baseline_error_contact_sheets"
    error_root.mkdir(parents=True, exist_ok=True)
    by_true = defaultdict(list)
    for row, true_index, prediction in zip(rows, labels, predictions):
        if true_index != prediction and classes[true_index] in {"aricc", "rio", "fablab"}:
            by_true[classes[true_index]].append((row, classes[prediction]))
    for true_label, items in by_true.items():
        columns, cell_w, cell_h = 4, 280, 330
        sheet = Image.new("RGB", (columns * cell_w, ((len(items) + columns - 1) // columns) * cell_h), "white")
        draw = ImageDraw.Draw(sheet)
        for index, (row, predicted_label) in enumerate(items):
            image = Image.open(WORK.parent / row["frame_path"]).convert("RGB")
            image.thumbnail((250, 260))
            x = index % columns * cell_w + (cell_w - image.width) // 2
            y = index // columns * cell_h + 4
            sheet.paste(image, (x, y))
            draw.multiline_text((index % columns * cell_w + 6, y + image.height + 6), f"true: {true_label}\npred: {predicted_label}\n{row['source_video']} {row['timestamp_seconds']}s", fill="black")
        sheet.save(error_root / f"{true_label}_errors.jpg", quality=92)
    return {label: len(items) for label, items in by_true.items()}


def evaluate_training(model, loader, device, class_count, criterion):
    model.eval()
    labels, predictions, total_loss = [], [], 0.0
    with torch.no_grad():
        for images, targets, _ in loader:
            logits = model(images.to(device))
            total_loss += float(criterion(logits, targets.to(device)).item()) * len(targets)
            labels.extend(targets.tolist())
            predictions.extend(logits.argmax(1).cpu().tolist())
    result = metrics(labels, predictions, class_count)
    result["loss"] = total_loss / len(labels)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=40)
    args = parser.parse_args()
    seed_everything()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    proposal = json.loads(PROPOSAL.read_text(encoding="utf-8"))
    classes = proposal["selected_classes"]
    class_to_index = {label: index for index, label in enumerate(classes)}
    train_videos = set(proposal["train_source_videos"])
    validation_videos = set(proposal["validation_source_videos"])
    with (WORK / "review_manifest.csv").open(newline="", encoding="utf-8") as handle:
        all_rows = list(csv.DictReader(handle))
    train_rows = [row for row in all_rows if row["label"] in class_to_index and row["source_video"] in train_videos]
    validation_rows = [row for row in all_rows if row["label"] in class_to_index and row["source_video"] in validation_videos]
    if {row["source_video"] for row in train_rows} & {row["source_video"] for row in validation_rows}:
        raise RuntimeError("Video overlap detected.")

    validation_transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    baseline_loader = DataLoader(ManifestDataset(validation_rows, class_to_index, validation_transform), batch_size=16, shuffle=False, num_workers=0, collate_fn=collate_batch)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    baseline_payload = torch.load(BASELINE / "best_mobilenet_v3_small.pth", map_location="cpu", weights_only=False)
    baseline_model = models.mobilenet_v3_small(weights=None)
    baseline_model.classifier[-1] = nn.Linear(baseline_model.classifier[-1].in_features, len(classes))
    baseline_model.load_state_dict(baseline_payload["state_dict"])
    baseline_model.to(device)
    baseline_metrics, baseline_labels, baseline_predictions, baseline_error_rows = predict(baseline_model, baseline_loader, device, len(classes))
    error_counts = error_sheets(baseline_error_rows, baseline_labels, baseline_predictions, classes, OUTPUT)
    (OUTPUT / "baseline_diagnosis.json").write_text(json.dumps({"metrics": baseline_metrics, "error_counts_by_true_class": error_counts, "augmentation_review": {"baseline_train_augmentation": "RandomResizedCrop scale 0.88-1.0, ColorJitter, RandomAffine degrees=3", "v2_train_augmentation": "conservative crop scale 0.95-1.0, mild ColorJitter, RandomAffine degrees=2, no horizontal flip", "reason": "Preserve readable signage and room identifiers."}}, indent=2) + "\n", encoding="utf-8")

    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.95, 1.0), ratio=(0.96, 1.04)),
        transforms.ColorJitter(brightness=0.08, contrast=0.08, saturation=0.06),
        transforms.RandomAffine(degrees=2, translate=(0.01, 0.01)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    train_data = ManifestDataset(train_rows, class_to_index, train_transform)
    validation_data = ManifestDataset(validation_rows, class_to_index, validation_transform)
    train_counts = Counter(row["label"] for row in train_rows)
    class_weights = torch.tensor([np.sqrt(len(train_rows) / (len(classes) * train_counts[label])) for label in classes], dtype=torch.float32)
    train_loader = DataLoader(train_data, batch_size=16, shuffle=True, num_workers=0, collate_fn=collate_batch)
    validation_loader = DataLoader(validation_data, batch_size=16, shuffle=False, num_workers=0, collate_fn=collate_batch)

    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    # Start from the baseline classifier while restoring pretrained backbone weights.
    model.load_state_dict(baseline_payload["state_dict"])
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    for block in list(model.features.children())[-3:]:
        for parameter in block.parameters():
            parameter.requires_grad = True
    for parameter in model.classifier.parameters():
        parameter.requires_grad = True
    model.to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
    backbone_parameters = [parameter for name, parameter in model.named_parameters() if parameter.requires_grad and name.startswith("features")]
    head_parameters = [parameter for name, parameter in model.named_parameters() if parameter.requires_grad and name.startswith("classifier")]
    optimizer = torch.optim.AdamW([{"params": backbone_parameters, "lr": 0.00002}, {"params": head_parameters, "lr": 0.0002}], weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=3)
    best_state, best_score, stale = None, -1.0, 0
    history = []
    for epoch in range(args.epochs):
        model.train()
        train_loss, samples = 0.0, 0
        for images, targets, _ in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images.to(device)), targets.to(device))
            loss.backward()
            optimizer.step()
            train_loss += float(loss.item()) * len(targets)
            samples += len(targets)
        validation = evaluate_training(model, validation_loader, device, len(classes), criterion)
        scheduler.step(validation["macro_f1"])
        record = {"epoch": epoch + 1, "train_loss": train_loss / samples, "validation": validation, "learning_rates": [group["lr"] for group in optimizer.param_groups]}
        history.append(record)
        print(f"epoch {epoch + 1}/{args.epochs}: val_accuracy={validation['accuracy']:.4f} macro_f1={validation['macro_f1']:.4f}")
        if validation["macro_f1"] > best_score:
            best_score = validation["macro_f1"]
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
        if stale >= 8:
            print(f"early stopping after epoch {epoch + 1}")
            break
    if best_state is None:
        raise RuntimeError("No fine-tuned checkpoint produced.")
    model.load_state_dict(best_state)
    final_metrics = evaluate_training(model, validation_loader, device, len(classes), criterion)
    checkpoint = OUTPUT / "best_mobilenet_v3_small_finetuned.pth"
    torch.save({"state_dict": best_state, "classes": classes, "class_to_index": class_to_index, "architecture": "mobilenet_v3_small", "proposal": str(PROPOSAL), "baseline_checkpoint": str(BASELINE / "best_mobilenet_v3_small.pth")}, checkpoint)
    (OUTPUT / "training_history.json").write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "class_mapping.json").write_text(json.dumps({"classes": classes, "class_to_index": class_to_index}, indent=2) + "\n", encoding="utf-8")
    per_class = {label: final_metrics["per_class"][index] for label, index in class_to_index.items()}
    confusion = {"classes": classes, "rows_true_columns_predicted": final_metrics["confusion_matrix"]}
    cpu_model = model.cpu().eval()
    sample = torch.zeros(1, 3, 224, 224)
    with torch.no_grad():
        for _ in range(10):
            cpu_model(sample)
        start = time.perf_counter()
        for _ in range(100):
            cpu_model(sample)
        latency = (time.perf_counter() - start) * 1000 / 100
    evaluation = {"baseline": {"accuracy": baseline_metrics["accuracy"], "macro_f1": baseline_metrics["macro_f1"]}, "finetuned": {"accuracy": final_metrics["accuracy"], "macro_f1": final_metrics["macro_f1"], "loss": final_metrics["loss"], "samples": final_metrics["samples"], "per_class": per_class, "confusion_matrix": confusion, "cpu_batch1_latency_ms": latency, "checkpoint_size_bytes": checkpoint.stat().st_size}, "deltas": {"accuracy": final_metrics["accuracy"] - baseline_metrics["accuracy"], "macro_f1": final_metrics["macro_f1"] - baseline_metrics["macro_f1"]}, "priority_pair_errors": {"aricc_vs_entrance_aricc": {"aricc_to_entrance_aricc": final_metrics["confusion_matrix"][class_to_index["aricc"]][class_to_index["entrance_aricc"]], "entrance_aricc_to_aricc": final_metrics["confusion_matrix"][class_to_index["entrance_aricc"]][class_to_index["aricc"]]}, "rio_vs_entrance_rio": {"rio_to_entrance_rio": final_metrics["confusion_matrix"][class_to_index["rio"]][class_to_index["entrance_rio"]], "entrance_rio_to_rio": final_metrics["confusion_matrix"][class_to_index["entrance_rio"]][class_to_index["rio"]]}, "fablab_recall": final_metrics["per_class"][class_to_index["fablab"]]["recall"]}, "manifest_modified": False, "onnx_exported": False}
    (OUTPUT / "evaluation_metrics.json").write_text(json.dumps(evaluation, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "confusion_matrix.json").write_text(json.dumps(confusion, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "experiment_metadata.json").write_text(json.dumps({"proposal": str(PROPOSAL), "baseline_checkpoint": str(BASELINE / "best_mobilenet_v3_small.pth"), "train_rows": len(train_rows), "validation_rows": len(validation_rows), "unfrozen_feature_blocks": 3, "backbone_learning_rate": 0.00002, "classifier_learning_rate": 0.0002, "class_balancing": "sqrt inverse-frequency weighted cross-entropy", "augmentation": "conservative training-only crop/color/affine; no horizontal flip", "early_stopping": "macro F1 patience 8", "manifest_modified": False, "onnx_exported": False}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"baseline_accuracy": baseline_metrics["accuracy"], "baseline_macro_f1": baseline_metrics["macro_f1"], "finetuned_accuracy": final_metrics["accuracy"], "finetuned_macro_f1": final_metrics["macro_f1"], "accuracy_delta": evaluation["deltas"]["accuracy"], "macro_f1_delta": evaluation["deltas"]["macro_f1"], "fablab_recall": evaluation["priority_pair_errors"]["fablab_recall"], "latency_ms": latency, "checkpoint_size_bytes": checkpoint.stat().st_size, "baseline_error_sheets": error_counts}, indent=2))


if __name__ == "__main__":
    main()
