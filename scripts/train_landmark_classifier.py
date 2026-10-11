"""Train a MobileNetV3-Small landmark classifier after manual review."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms


MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval()
    correct = total = 0
    with torch.no_grad():
        for images, labels in loader:
            predictions = model(images.to(device)).argmax(1)
            correct += int((predictions == labels.to(device)).sum())
            total += labels.size(0)
    return {"accuracy": correct / total if total else 0.0, "samples": total}


def run(args: argparse.Namespace) -> None:
    report_path = args.work / "dataset_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if not report.get("ready_for_training"):
        raise RuntimeError(
            f"Dataset is not ready for training: {report_path}. "
            "Finish review and ensure every class has train and validation examples."
        )

    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    train_data = datasets.ImageFolder(args.work / "dataset" / "train", transform=train_transform)
    val_data = datasets.ImageFolder(args.work / "dataset" / "val", transform=val_transform)
    if train_data.classes != val_data.classes:
        raise RuntimeError(f"Train/validation class mismatch: {train_data.classes} / {val_data.classes}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_loader = DataLoader(train_data, batch_size=args.batch, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_data, batch_size=args.batch, shuffle=False, num_workers=0)
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(train_data.classes))
    model.to(device)
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=args.learning_rate)
    criterion = nn.CrossEntropyLoss()
    best_accuracy = -1.0
    best_state: dict[str, torch.Tensor] | None = None

    for epoch in range(args.epochs):
        model.train()
        for images, labels in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images.to(device)), labels.to(device))
            loss.backward()
            optimizer.step()
        validation = evaluate(model, val_loader, device)
        print(f"epoch {epoch + 1}/{args.epochs}: val_accuracy={validation['accuracy']:.4f}")
        if validation["accuracy"] > best_accuracy:
            best_accuracy = validation["accuracy"]
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    if best_state is None:
        raise RuntimeError("No model checkpoint was produced")
    model.load_state_dict(best_state)
    model.cpu().eval()
    args.output.mkdir(parents=True, exist_ok=True)
    checkpoint = args.output / "landmark_mobilenet_v3_small.pth"
    torch.save({"state_dict": best_state, "classes": train_data.classes, "architecture": "mobilenet_v3_small"}, checkpoint)
    onnx_path = args.output / "landmark_classifier.onnx"
    torch.onnx.export(
        model,
        torch.zeros(1, 3, 224, 224),
        onnx_path,
        input_names=["images"],
        output_names=["logits"],
        opset_version=12,
        dynamo=False,
    )
    metadata = {
        "model_name": "taylor_landmark_mobilenet_v3_small",
        "classes": train_data.classes,
        "class_to_index": {name: index for index, name in enumerate(train_data.classes)},
        "input_shape": [1, 3, 224, 224],
        "output_type": "logits",
        "preprocessing": {"mean": MEAN, "std": STD},
        "validation": evaluate(model, val_loader, torch.device("cpu")),
        "source_dataset_report": str(report_path),
    }
    (args.output / "landmark_classifier_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"checkpoint": str(checkpoint), "onnx": str(onnx_path), "metadata": metadata}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", type=Path, default=Path("documentation/datasets/Landmark Recognition/landmark_recognition"))
    parser.add_argument("--output", type=Path, default=Path("runs/landmark_recognition"))
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=0.0005)
    run(parser.parse_args())