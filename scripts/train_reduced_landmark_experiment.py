"""Train and evaluate the approved reduced TAYLOR landmark experiment."""

from __future__ import annotations

import csv
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
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
PROPOSAL = ROOT / "runs" / "landmark_reduced_experiment" / "reduced_landmark_split_proposal.json"
OUTPUT = ROOT / "runs" / "landmark_reduced_experiment" / "training"
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
        image_path = WORK.parent / row["frame_path"]
        image = Image.open(image_path).convert("RGB")
        return self.transform(image), self.class_to_index[row["label"]], row


def seed_everything():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


def metrics_from_predictions(labels, predictions, class_count):
    matrix = np.zeros((class_count, class_count), dtype=np.int64)
    for label, prediction in zip(labels, predictions):
        matrix[label, prediction] += 1
    per_class = []
    for index in range(class_count):
        true_positive = matrix[index, index]
        false_positive = matrix[:, index].sum() - true_positive
        false_negative = matrix[index, :].sum() - true_positive
        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
        recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class.append({"precision": precision, "recall": recall, "f1": f1, "support": int(matrix[index, :].sum())})
    accuracy = float(np.trace(matrix) / matrix.sum()) if matrix.sum() else 0.0
    return {"accuracy": accuracy, "macro_f1": float(np.mean([item["f1"] for item in per_class])), "per_class": per_class, "confusion_matrix": matrix.tolist(), "samples": int(matrix.sum())}


def evaluate(model, loader, device, class_count):
    model.eval()
    labels = []
    predictions = []
    losses = []
    criterion = nn.CrossEntropyLoss()
    with torch.no_grad():
        for images, targets, _ in loader:
            logits = model(images.to(device))
            losses.append(float(criterion(logits, targets.to(device)).item()) * len(targets))
            labels.extend(targets.tolist())
            predictions.extend(logits.argmax(1).cpu().tolist())
    result = metrics_from_predictions(labels, predictions, class_count)
    result["loss"] = sum(losses) / len(labels) if labels else 0.0
    return result


def main():
    seed_everything()
    proposal = json.loads(PROPOSAL.read_text(encoding="utf-8"))
    classes = proposal["selected_classes"]
    class_to_index = {label: index for index, label in enumerate(classes)}
    train_videos = set(proposal["train_source_videos"])
    validation_videos = set(proposal["validation_source_videos"])
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    train_rows = [row for row in rows if row["label"] in class_to_index and row["source_video"] in train_videos]
    validation_rows = [row for row in rows if row["label"] in class_to_index and row["source_video"] in validation_videos]
    if {row["source_video"] for row in train_rows} & {row["source_video"] for row in validation_rows}:
        raise RuntimeError("Video overlap detected; refusing to train.")
    if set(row["label"] for row in train_rows) != set(classes) or set(row["label"] for row in validation_rows) != set(classes):
        raise RuntimeError("Every proposed class must occur in both splits.")

    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.88, 1.0), ratio=(0.9, 1.1)),
        transforms.ColorJitter(brightness=0.18, contrast=0.18, saturation=0.12),
        transforms.RandomAffine(degrees=3, translate=(0.03, 0.03)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    validation_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    train_data = ManifestDataset(train_rows, class_to_index, train_transform)
    validation_data = ManifestDataset(validation_rows, class_to_index, validation_transform)
    train_counts = Counter(row["label"] for row in train_rows)
    class_weights = torch.tensor([len(train_rows) / (len(classes) * train_counts[label]) for label in classes], dtype=torch.float32)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_loader = DataLoader(train_data, batch_size=16, shuffle=True, num_workers=0)
    validation_loader = DataLoader(validation_data, batch_size=16, shuffle=False, num_workers=0)

    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    model.to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=0.0005, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=3)
    best_state = None
    best_score = -1.0
    patience = 8
    stale_epochs = 0
    history = []
    max_epochs = 40

    for epoch in range(max_epochs):
        model.train()
        train_loss = 0.0
        train_samples = 0
        for images, targets, _ in train_loader:
            optimizer.zero_grad(set_to_none=True)
            logits = model(images.to(device))
            loss = criterion(logits, targets.to(device))
            loss.backward()
            optimizer.step()
            train_loss += float(loss.item()) * len(targets)
            train_samples += len(targets)
        validation = evaluate(model, validation_loader, device, len(classes))
        scheduler.step(validation["macro_f1"])
        epoch_record = {"epoch": epoch + 1, "train_loss": train_loss / train_samples, "validation": validation, "learning_rate": optimizer.param_groups[0]["lr"]}
        history.append(epoch_record)
        print(f"epoch {epoch + 1}/{max_epochs}: val_accuracy={validation['accuracy']:.4f} macro_f1={validation['macro_f1']:.4f}")
        if validation["macro_f1"] > best_score:
            best_score = validation["macro_f1"]
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
            stale_epochs = 0
        else:
            stale_epochs += 1
        if stale_epochs >= patience:
            print(f"early stopping after epoch {epoch + 1}")
            break

    if best_state is None:
        raise RuntimeError("No checkpoint was produced.")
    model.load_state_dict(best_state)
    model.eval()
    final_metrics = evaluate(model, validation_loader, device, len(classes))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    checkpoint_path = OUTPUT / "best_mobilenet_v3_small.pth"
    torch.save({"state_dict": best_state, "classes": classes, "class_to_index": class_to_index, "architecture": "mobilenet_v3_small", "pretrained_weights": "MobileNet_V3_Small_Weights.DEFAULT", "proposal": str(PROPOSAL)}, checkpoint_path)
    (OUTPUT / "class_mapping.json").write_text(json.dumps({"classes": classes, "class_to_index": class_to_index}, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "training_history.json").write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
    per_class = {label: final_metrics["per_class"][index] for label, index in class_to_index.items()}
    confusion = {"classes": classes, "rows_true_columns_predicted": final_metrics["confusion_matrix"]}
    (OUTPUT / "confusion_matrix.json").write_text(json.dumps(confusion, indent=2) + "\n", encoding="utf-8")

    cpu_model = model.cpu().eval()
    sample = torch.zeros(1, 3, 224, 224)
    with torch.no_grad():
        for _ in range(10):
            cpu_model(sample)
        start = time.perf_counter()
        for _ in range(100):
            cpu_model(sample)
        latency_ms = (time.perf_counter() - start) * 1000 / 100
    evaluation = {"accuracy": final_metrics["accuracy"], "macro_f1": final_metrics["macro_f1"], "loss": final_metrics["loss"], "samples": final_metrics["samples"], "per_class": per_class, "confusion_matrix": confusion, "most_confused_pairs": sorted(((classes[true], classes[pred], int(final_metrics["confusion_matrix"][true][pred])) for true in range(len(classes)) for pred in range(len(classes)) if true != pred and final_metrics["confusion_matrix"][true][pred]), key=lambda item: item[2], reverse=True), "latency_ms_cpu_batch1": latency_ms, "checkpoint_size_bytes": checkpoint_path.stat().st_size, "device_training": str(device)}
    (OUTPUT / "evaluation_metrics.json").write_text(json.dumps(evaluation, indent=2) + "\n", encoding="utf-8")
    metadata = {"proposal": str(PROPOSAL), "manifest": str(MANIFEST), "manifest_modified": False, "onnx_exported": False, "classes": classes, "train_rows": len(train_rows), "validation_rows": len(validation_rows), "train_video_count": len({row['source_video'] for row in train_rows}), "validation_video_count": len({row['source_video'] for row in validation_rows}), "class_weights": {label: float(class_weights[index]) for label, index in class_to_index.items()}, "augmentation": "RandomResizedCrop, ColorJitter, RandomAffine applied to training images only", "early_stopping_patience": patience, "epochs_completed": len(history), "pretrained_weights": "MobileNet_V3_Small_Weights.DEFAULT", "deployment": False}
    (OUTPUT / "experiment_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checkpoint": str(checkpoint_path), "epochs": len(history), "validation_accuracy": evaluation["accuracy"], "macro_f1": evaluation["macro_f1"], "latency_ms_cpu_batch1": latency_ms, "checkpoint_size_bytes": evaluation["checkpoint_size_bytes"], "most_confused_pairs": evaluation["most_confused_pairs"]}, indent=2))


if __name__ == "__main__":
    main()
