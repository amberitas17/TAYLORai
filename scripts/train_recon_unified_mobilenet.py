"""Train and evaluate a candidate unified 13-class RECON MobileNet model."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "runs" / "recon_unified_dataset"
REPORT = DATASET / "unified_manifest_report.json"
RUN = ROOT / "runs" / "recon_unified_mobilenet_v3"
VIDEO = ROOT / "Documentation" / "datasets" / "RECON" / "RECON_003.MOV"
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def metric_report(true, predicted, confidence, classes):
    matrix = [[0] * len(classes) for _ in classes]
    for actual, guess in zip(true, predicted):
        matrix[actual][guess] += 1
    per_class = {}
    for index, name in enumerate(classes):
        tp = matrix[index][index]
        fp = sum(row[index] for row in matrix) - tp
        fn = sum(matrix[index]) - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[name] = {"precision": precision, "recall": recall, "f1": f1, "support": tp + fn}
    return {
        "accuracy": sum(a == p for a, p in zip(true, predicted)) / len(true),
        "macro_precision": sum(v["precision"] for v in per_class.values()) / len(classes),
        "macro_recall": sum(v["recall"] for v in per_class.values()) / len(classes),
        "macro_f1": sum(v["f1"] for v in per_class.values()) / len(classes),
        "per_class": per_class,
        "confusion_matrix": matrix,
        "confidence_distribution": {
            "mean": float(np.mean(confidence)),
            "median": float(np.median(confidence)),
            "p10": float(np.percentile(confidence, 10)),
            "p90": float(np.percentile(confidence, 90)),
            "correct_mean": float(np.mean([c for c, a, p in zip(confidence, true, predicted) if a == p])) if any(a == p for a, p in zip(true, predicted)) else 0.0,
            "incorrect_mean": float(np.mean([c for c, a, p in zip(confidence, true, predicted) if a != p])) if any(a != p for a, p in zip(true, predicted)) else 0.0,
        },
        "classes": classes,
    }


def evaluate(model, loader, classes, device):
    model.eval()
    true, predicted, confidence = [], [], []
    with torch.no_grad():
        for images, labels in loader:
            probabilities = torch.softmax(model(images.to(device)), dim=1)
            values, guesses = probabilities.max(1)
            true.extend(labels.tolist())
            predicted.extend(guesses.cpu().tolist())
            confidence.extend(values.cpu().tolist())
    return metric_report(true, predicted, confidence, classes)


def run(args):
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    if not report.get("ready_for_training"):
        raise RuntimeError(f"Dataset audit failed: {REPORT}")
    classes = [report["class_to_index"][str(i)] for i in range(len(report["class_to_index"]))]
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.88, 1.0), ratio=(0.92, 1.08)),
        transforms.RandomAffine(5, translate=(0.04, 0.04), scale=(0.96, 1.04), shear=3),
        transforms.RandomPerspective(0.12, p=0.25),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.ToTensor(), transforms.Normalize(MEAN, STD),
    ])
    val_transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    train_data = datasets.ImageFolder(DATASET / "train", transform=train_transform)
    val_data = datasets.ImageFolder(DATASET / "val", transform=val_transform)
    if train_data.classes != classes or val_data.classes != classes:
        raise RuntimeError(f"Class index mismatch: {train_data.classes} / {val_data.classes} / {classes}")
    train_loader = DataLoader(train_data, batch_size=args.batch, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_data, batch_size=args.batch, shuffle=False, num_workers=0)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    model.to(device)
    criterion = nn.CrossEntropyLoss()
    checkpoint = RUN / "best_model.pth"
    if args.reuse_checkpoint and checkpoint.exists():
        best_state = torch.load(checkpoint, map_location="cpu")["state_dict"]
    else:
        optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=args.head_lr)
        best_f1, best_state = -1.0, None
        total_epochs = args.head_epochs + args.finetune_epochs
        for epoch in range(total_epochs):
            if epoch == args.head_epochs:
                for block in list(model.features.children())[-4:]:
                    for parameter in block.parameters(): parameter.requires_grad = True
                optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=args.finetune_lr)
            model.train()
            for images, labels in train_loader:
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(model(images.to(device)), labels.to(device))
                loss.backward(); optimizer.step()
            validation = evaluate(model, val_loader, classes, device)
            print(f"epoch {epoch + 1}/{total_epochs}: val_macro_f1={validation['macro_f1']:.4f}")
            if validation["macro_f1"] > best_f1:
                best_f1 = validation["macro_f1"]
                best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
    if best_state is None: raise RuntimeError("No best checkpoint produced")
    model.load_state_dict(best_state); model.to(device)
    evaluation = evaluate(model, val_loader, classes, device)
    RUN.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": best_state, "classes": classes, "architecture": "mobilenet_v3_small"}, checkpoint)
    onnx_path = RUN / "recon_classifier.onnx"
    model.cpu().eval()
    torch.onnx.export(model, torch.zeros(1, 3, 224, 224), onnx_path, input_names=["images"], output_names=["output0"], opset_version=12, dynamo=False)
    metadata = {"model_name": "recon_unified_mobilenet_v2", "displayNames": classes, "class_to_index": {name: i for i, name in enumerate(classes)}, "input_shape": [1, 3, 224, 224], "output_shape": [1, len(classes)], "output_type": "logits", "preprocessing": {"mean": MEAN, "std": STD}, "evaluation": evaluation, "source_manifest_report": str(REPORT)}
    metadata_path = RUN / "recon_classifier_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    evaluation.update({"checkpoint": str(checkpoint), "onnx": str(onnx_path), "metadata": str(metadata_path), "class_to_index": metadata["class_to_index"]})
    (RUN / "evaluation.json").write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    print(json.dumps(evaluation, indent=2))
    if not args.skip_video_test:
        video_test(model, classes, device)


def video_test(model, classes, device):
    crops = [(1.5, [0.08, 0.18, 0.72, 0.94], "root_crop_slicing_machine"), (8.0, [0.02, 0.27, 0.82, 0.99], "charcoal_oven_machine"), (22.5, [0.25, 0.24, 0.78, 0.92], "root_crop_slicing_machine"), (31.5, [0.02, 0.29, 0.78, 0.99], "charcoal_oven_machine"), (39.0, [0.38, 0.27, 0.92, 0.93], "root_crop_slicing_machine"), (42.0, [0.42, 0.30, 1.0, 0.99], "charcoal_oven_machine")]
    transform = transforms.Compose([transforms.ToPILImage(), transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    capture = cv2.VideoCapture(str(VIDEO)); results = []
    for second, box, expected in crops:
        capture.set(cv2.CAP_PROP_POS_MSEC, second * 1000); ok, frame = capture.read()
        if not ok: continue
        h, w = frame.shape[:2]; left, top, right, bottom = [round(v * d) for v, d in zip(box, (w, h, w, h))]
        image = transform(cv2.cvtColor(frame[top:bottom, left:right], cv2.COLOR_BGR2RGB)).unsqueeze(0)
        with torch.no_grad():
            probabilities = torch.softmax(model(image.to(device)), dim=1)[0]
        index = int(probabilities.argmax()); results.append({"seconds": second, "expected": expected, "predicted": classes[index], "confidence": float(probabilities[index])})
    capture.release(); (RUN / "recon_003_inference.json").write_text(json.dumps(results, indent=2), encoding="utf-8"); print(json.dumps({"recon_003_inference": results}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--head-epochs", type=int, default=8)
    parser.add_argument("--finetune-epochs", type=int, default=20)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--head-lr", type=float, default=0.0005)
    parser.add_argument("--finetune-lr", type=float, default=0.00003)
    parser.add_argument("--skip-video-test", action="store_true")
    parser.add_argument("--reuse-checkpoint", action="store_true")
    run(parser.parse_args())
