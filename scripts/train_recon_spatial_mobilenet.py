"""Build, inspect, train, and evaluate spatial RECON exhibit crops."""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

import cv2
import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "RECON"
MANIFEST = SOURCE_DIR / "ocr_labels.json"
SOURCE_NAME = "Fluke 2042 Cable Tracer and Fluke 941 Temperature Humidity Meter.MOV"
DATASET_DIR = ROOT / "runs" / "recon_spatial_dataset"
RUN_DIR = ROOT / "runs" / "recon_spatial_mobilenet"
CONTACT_SHEET = RUN_DIR / "crop_contact_sheet.jpg"


def normalized_box(box: list[float], width: int, height: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    return (
        max(0, round(left * width)),
        max(0, round(top * height)),
        min(width, round(right * width)),
        min(height, round(bottom * height)),
    )


def crop_frame(frame, box: list[float]):
    left, top, right, bottom = normalized_box(box, frame.shape[1], frame.shape[0])
    return frame[top:bottom, left:right]


def crop_difference(current, previous) -> float:
    current_small = cv2.resize(cv2.cvtColor(current, cv2.COLOR_BGR2GRAY), (32, 32))
    previous_small = cv2.resize(cv2.cvtColor(previous, cv2.COLOR_BGR2GRAY), (32, 32))
    return float(cv2.absdiff(current_small, previous_small).mean())


def build_dataset(args: argparse.Namespace) -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    record = manifest.get(SOURCE_NAME)
    if not record or not record.get("spatial_regions"):
        raise RuntimeError(f"Missing spatial_regions for {SOURCE_NAME} in {MANIFEST}")
    split_config = record.get("spatial_split", {})
    validation_start = float(split_config.get("validation_start_seconds", 11.0))
    validation_end = float(split_config.get("validation_end_seconds", 15.65))
    interval = float(split_config.get("selection_interval_seconds", 0.375))
    threshold = float(split_config.get("deduplicate_threshold", 4.0))
    source = SOURCE_DIR / SOURCE_NAME
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {source}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total_frames / fps
    validation_end = min(validation_end, duration)
    if DATASET_DIR.exists():
        shutil.rmtree(DATASET_DIR)
    if RUN_DIR.exists():
        shutil.rmtree(RUN_DIR)
    RUN_DIR.mkdir(parents=True, exist_ok=True)

    accepted = []
    previous_crops = {}
    sample_number = 0
    second = 0.0
    while second < validation_end:
        frame_index = min(total_frames - 1, round(second * fps))
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = capture.read()
        if not ok:
            second += interval
            continue
        split = "val" if second >= validation_start else "train"
        crops = {}
        duplicate = False
        for region in record["spatial_regions"]:
            label = region["label"]
            crop = crop_frame(frame, region["box"])
            crops[label] = crop
            if label in previous_crops and crop_difference(crop, previous_crops[label]) < threshold:
                duplicate = True
        if not duplicate:
            for label, crop in crops.items():
                destination = DATASET_DIR / split / label / f"{SOURCE_NAME[:-4]}__{sample_number:04d}.jpg"
                destination.parent.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(destination), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
            accepted.append({"seconds": round(second, 3), "split": split, "frame": frame_index})
            sample_number += 1
        previous_crops = crops
        second += interval
    capture.release()
    if not accepted:
        raise RuntimeError("No spatial crops were extracted")

    summary = {
        "source": SOURCE_NAME,
        "fps": fps,
        "duration_seconds": duration,
        "validation_start_seconds": validation_start,
        "validation_end_seconds": validation_end,
        "selection_interval_seconds": interval,
        "deduplicate_threshold": threshold,
        "regions": record["spatial_regions"],
        "accepted_frames": accepted,
        "counts": {
            split: {
                region["label"]: sum(1 for item in accepted if item["split"] == split)
                for region in record["spatial_regions"]
            }
            for split in ("train", "val")
        },
    }
    (DATASET_DIR / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    make_contact_sheet(record["spatial_regions"], accepted)
    print(json.dumps(summary, indent=2))
    return summary


def make_contact_sheet(regions: list[dict], accepted: list[dict]) -> None:
    images = []
    for split in ("train", "val"):
        for region in regions:
            label = region["label"]
            files = sorted((DATASET_DIR / split / label).glob("*.jpg"))
            for path in files:
                image = cv2.imread(str(path))
                image = cv2.resize(image, (180, 260))
                cv2.putText(image, label[:20], (4, 18), cv2.FONT_HERSHEY_SIMPLEX, .38, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, split, (4, 35), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1, cv2.LINE_AA)
                images.append(image)
    cols = 4
    rows = math.ceil(len(images) / cols)
    blank = images[0].copy() * 0
    while len(images) % cols:
        images.append(blank.copy())
    sheet = cv2.vconcat([cv2.hconcat(images[row * cols:(row + 1) * cols]) for row in range(rows)])
    cv2.imwrite(str(CONTACT_SHEET), sheet)


def metrics(true: list[int], predicted: list[int], class_names: list[str]) -> dict:
    matrix = [[0 for _ in class_names] for _ in class_names]
    for actual, guess in zip(true, predicted):
        matrix[actual][guess] += 1
    per_class = {}
    for index, name in enumerate(class_names):
        tp = matrix[index][index]
        fp = sum(matrix[row][index] for row in range(len(class_names))) - tp
        fn = sum(matrix[index]) - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[name] = {"precision": precision, "recall": recall, "f1": f1, "support": tp + fn}
    return {"classes": class_names, "per_class": per_class, "confusion_matrix": matrix}


def train(args: argparse.Namespace, summary: dict) -> dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.88, 1.0), ratio=(0.92, 1.08)),
        transforms.RandomAffine(degrees=5, translate=(0.04, 0.04), scale=(0.96, 1.04), shear=3),
        transforms.RandomPerspective(distortion_scale=0.12, p=0.25),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 0.7))], p=0.15),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    train_data = datasets.ImageFolder(DATASET_DIR / "train", transform=train_transform)
    val_data = datasets.ImageFolder(DATASET_DIR / "val", transform=val_transform)
    if train_data.classes != val_data.classes or len(train_data.classes) != 2:
        raise RuntimeError(f"Expected the same two classes in train and val, got {train_data.classes} and {val_data.classes}")
    if min(len(train_data), len(val_data)) < 2:
        raise RuntimeError("Held-out validation set is too small")
    train_loader = DataLoader(train_data, batch_size=args.batch, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_data, batch_size=args.batch, shuffle=False, num_workers=0)
    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(train_data.classes))
    if model.classifier[-1].out_features != 2:
        raise RuntimeError(f"Expected exactly two classifier outputs, got {model.classifier[-1].out_features}")
    model.to(device)
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=args.head_learning_rate)
    criterion = nn.CrossEntropyLoss()
    best_f1 = -1.0
    best_state = None
    for epoch in range(args.head_epochs + args.finetune_epochs):
        if epoch == args.head_epochs:
            for block in list(model.features.children())[-4:]:
                for parameter in block.parameters():
                    parameter.requires_grad = True
            optimizer = torch.optim.AdamW(
                filter(lambda parameter: parameter.requires_grad, model.parameters()),
                lr=args.finetune_learning_rate,
            )
        model.train()
        for images, labels in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(images.to(device)), labels.to(device))
            loss.backward()
            optimizer.step()
        model.eval()
        true, predicted = [], []
        with torch.no_grad():
            for images, labels in val_loader:
                outputs = model(images.to(device))
                true.extend(labels.tolist())
                predicted.extend(outputs.argmax(1).cpu().tolist())
        report = metrics(true, predicted, train_data.classes)
        mean_f1 = sum(item["f1"] for item in report["per_class"].values()) / len(train_data.classes)
        phase = "head" if epoch < args.head_epochs else "fine-tune"
        print(f"epoch {epoch + 1}/{args.head_epochs + args.finetune_epochs} ({phase}): val_macro_f1={mean_f1:.4f}")
        if mean_f1 > best_f1:
            best_f1 = mean_f1
            best_state = {key: value.cpu() for key, value in model.state_dict().items()}
    if best_state is None:
        raise RuntimeError("Training did not produce a checkpoint")
    final_model = models.mobilenet_v3_small(weights=None)
    final_model.classifier[-1] = nn.Linear(final_model.classifier[-1].in_features, len(train_data.classes))
    final_model.load_state_dict(best_state)
    final_model.to(device).eval()
    true, predicted = [], []
    with torch.no_grad():
        for images, labels in val_loader:
            true.extend(labels.tolist())
            predicted.extend(final_model(images.to(device)).argmax(1).cpu().tolist())
    report = metrics(true, predicted, train_data.classes)
    report["macro_f1"] = sum(item["f1"] for item in report["per_class"].values()) / len(train_data.classes)
    report["counts"] = summary["counts"]
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": best_state, "classes": train_data.classes, "architecture": "mobilenet_v3_small"}, RUN_DIR / "best_model.pth")
    (RUN_DIR / "evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--head-epochs", type=int, default=8)
    parser.add_argument("--finetune-epochs", type=int, default=20)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--head-learning-rate", type=float, default=0.0005)
    parser.add_argument("--finetune-learning-rate", type=float, default=0.00003)
    args = parser.parse_args()
    summary = build_dataset(args)
    if not args.prepare_only:
        train(args, summary)


if __name__ == "__main__":
    main()