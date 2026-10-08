"""Train and evaluate an experimental source-video-disjoint landmark embedder."""
from __future__ import annotations

import csv
import hashlib
import json
import random
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
PROPOSAL = ROOT / "runs" / "landmark_reduced_experiment" / "reduced_landmark_split_proposal.json"
OUTPUT = ROOT / "runs" / "landmark_metric_learning_experiment"
BASELINE_METADATA = ROOT / "public" / "models" / "landmark_browser_candidate" / "retrieval.metadata.json"
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
SEED = 20261008
CALIBRATION_VIDEOS = {"IMG_4525.MOV", "IMG_4643.MOV"}
TEST_VIDEOS = {"IMG_4529.MOV", "IMG_4599.MOV", "IMG_4632.MOV", "IMG_4645.MOV"}


class RowDataset(Dataset):
    def __init__(self, rows, class_to_index, transform):
        self.rows = rows
        self.class_to_index = class_to_index
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        image = Image.open(WORK.parent / row["frame_path"]).convert("RGB")
        return self.transform(image), self.class_to_index[row["label"]], index


class MetricModel(nn.Module):
    def __init__(self, embedding_size=128, class_count=1):
        super().__init__()
        backbone = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        self.features = backbone.features
        self.pool = backbone.avgpool
        self.projection = nn.Sequential(nn.Linear(576, 256), nn.Hardswish(), nn.Dropout(0.1), nn.Linear(256, embedding_size))
        self.classifier = nn.Linear(embedding_size, class_count)

    def forward(self, images):
        vector = self.pool(self.features(images)).flatten(1)
        embedding = nn.functional.normalize(self.projection(vector), dim=1)
        return embedding, self.classifier(embedding)


def seed_everything():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


def batch_hard_triplet(embeddings, labels, margin=0.2):
    distances = 1.0 - embeddings @ embeddings.T
    same = labels[:, None].eq(labels[None, :])
    different = ~same
    positive = distances.masked_fill(~same, -1.0).max(dim=1).values
    negative = distances.masked_fill(~different, 1e6).min(dim=1).values
    valid = same.sum(dim=1).gt(1) & different.any(dim=1)
    return nn.functional.relu(positive[valid] - negative[valid] + margin).mean() if valid.any() else embeddings.sum() * 0.0


def collect_embeddings(model, rows, class_to_index, device):
    loader = DataLoader(RowDataset(rows, class_to_index, transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])), batch_size=32, shuffle=False, num_workers=0)
    vectors, labels, indices = [], [], []
    model.eval()
    with torch.no_grad():
        for images, targets, batch_indices in loader:
            embedding, _ = model(images.to(device))
            vectors.append(embedding.cpu())
            labels.extend(targets.tolist())
            indices.extend(batch_indices.tolist())
    return torch.cat(vectors), labels, indices


def retrieval_metrics(reference_vectors, reference_labels, vectors, labels, classes, threshold, margin):
    references = torch.stack(reference_vectors)
    similarities = vectors @ references.T
    predictions, accepted, scores, gaps = [], [], [], []
    for row in similarities:
        order = torch.argsort(row, descending=True)
        best = int(order[0])
        next_score = max((float(row[index]) for index in order.tolist() if reference_labels[index] != reference_labels[best]), default=0.0)
        score = float(row[best])
        gap = score - next_score
        scores.append(score)
        gaps.append(gap)
        accepted.append(score >= threshold and gap >= margin)
        predictions.append(reference_labels[best] if accepted[-1] else -1)
    correct = [prediction == label for prediction, label in zip(predictions, labels) if prediction >= 0]
    per_class = {}
    for index, label in enumerate(classes):
        class_rows = [position for position, actual in enumerate(labels) if actual == index]
        class_accepted = [position for position in class_rows if accepted[position]]
        class_correct = [position for position in class_accepted if predictions[position] == index]
        per_class[label] = {"frames": len(class_rows), "accepted": len(class_accepted), "correct": len(class_correct), "recall": len(class_correct) / len(class_rows) if class_rows else None, "acceptedAccuracy": len(class_correct) / len(class_accepted) if class_accepted else None}
    return {"frames": len(labels), "accepted": sum(accepted), "coverage": sum(accepted) / len(labels) if labels else 0.0, "acceptedAccuracy": sum(correct) / len(correct) if correct else 0.0, "falseAcceptanceCount": sum(1 for prediction, label, is_accepted in zip(predictions, labels, accepted) if is_accepted and prediction != label), "unknownOrRejected": len(labels) - sum(accepted), "perLandmarkRecall": per_class, "predictions": predictions, "similarities": scores, "margins": gaps}


def choose_threshold(reference_vectors, reference_labels, vectors, labels):
    candidates = []
    for threshold in np.arange(0.70, 0.991, 0.005):
        for margin in np.arange(0.0, 0.101, 0.005):
            result = retrieval_metrics(reference_vectors, reference_labels, vectors, labels, [str(index) for index in sorted(set(labels))], float(threshold), float(margin))
            if result["accepted"] and result["acceptedAccuracy"] >= 0.90:
                candidates.append((result["accepted"], result["acceptedAccuracy"], float(threshold), float(margin)))
    return {"similarityThreshold": 1.0, "minimumMargin": 1.0, "accepted": 0, "acceptedAccuracy": 0.0} if not candidates else {"similarityThreshold": max(candidates, key=lambda item: (item[0], item[1]))[2], "minimumMargin": max(candidates, key=lambda item: (item[0], item[1]))[3], "accepted": max(candidates, key=lambda item: (item[0], item[1]))[0], "acceptedAccuracy": max(candidates, key=lambda item: (item[0], item[1]))[1]}


def main():
    seed_everything()
    proposal = json.loads(PROPOSAL.read_text(encoding="utf-8"))
    classes = proposal["selected_classes"]
    class_to_index = {label: index for index, label in enumerate(classes)}
    train_videos = set(proposal["train_source_videos"])
    rows = list(csv.DictReader(MANIFEST.open(newline="", encoding="utf-8")))
    eligible = [row for row in rows if row["review_status"] == "reviewed" and row["label"] in class_to_index]
    train_rows = [row for row in eligible if row["source_video"] in train_videos]
    calibration_rows = [row for row in eligible if row["source_video"] in CALIBRATION_VIDEOS]
    test_rows = [row for row in eligible if row["source_video"] in TEST_VIDEOS]
    if train_videos & CALIBRATION_VIDEOS or train_videos & TEST_VIDEOS or CALIBRATION_VIDEOS & TEST_VIDEOS:
        raise RuntimeError("Source-video overlap detected")
    training_transform = transforms.Compose([transforms.RandomResizedCrop(224, scale=(0.85, 1.0), ratio=(0.9, 1.1)), transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.12), transforms.RandomAffine(degrees=4, translate=(0.04, 0.04)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    train_dataset = RowDataset(train_rows, class_to_index, training_transform)
    counts = Counter(row["label"] for row in train_rows)
    weights = torch.DoubleTensor([1.0 / counts[row["label"]] for row in train_rows])
    sampler = WeightedRandomSampler(weights, num_samples=max(len(train_rows), len(classes) * 16), replacement=True)
    loader = DataLoader(train_dataset, batch_size=16, sampler=sampler, num_workers=0, drop_last=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MetricModel(class_count=len(classes)).to(device)
    for parameter in model.features.parameters():
        parameter.requires_grad = False
    optimizer = torch.optim.AdamW([parameter for parameter in model.parameters() if parameter.requires_grad], lr=0.0005, weight_decay=0.01)
    history = []
    for epoch in range(10):
        model.train()
        losses = []
        for images, targets, _ in loader:
            optimizer.zero_grad(set_to_none=True)
            embeddings, logits = model(images.to(device))
            loss = batch_hard_triplet(embeddings, targets.to(device)) + 0.25 * nn.functional.cross_entropy(logits, targets.to(device))
            loss.backward()
            optimizer.step()
            losses.append(float(loss.item()))
        history.append({"epoch": epoch + 1, "loss": float(np.mean(losses))})
    model.eval()
    train_vectors, train_labels, train_indices = collect_embeddings(model, train_rows, class_to_index, device)
    calibration_vectors, calibration_labels, _ = collect_embeddings(model, calibration_rows, class_to_index, device)
    test_vectors, test_labels, _ = collect_embeddings(model, test_rows, class_to_index, device)
    reference_vectors, reference_labels = [], []
    for label in range(len(classes)):
        for index, train_label in zip(train_indices, train_labels):
            if train_label == label:
                reference_vectors.append(train_vectors[index])
                reference_labels.append(label)
    calibration = choose_threshold(reference_vectors, reference_labels, calibration_vectors, calibration_labels)
    test = retrieval_metrics(reference_vectors, reference_labels, test_vectors, test_labels, classes, calibration["similarityThreshold"], calibration["minimumMargin"])
    baseline = json.loads(BASELINE_METADATA.read_text(encoding="utf-8"))
    reference_set = {reference["sourceVideo"] for reference in baseline["references"] if reference.get("referenceId", "").startswith("original-")}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    checkpoint = OUTPUT / "metric_mobilenet_v3_small_projection.pth"
    torch.save({"state_dict": model.state_dict(), "classes": classes, "architecture": "mobilenet_v3_small_projection_128", "pretrained_weights": "MobileNet_V3_Small_Weights.DEFAULT", "train_source_videos": sorted(train_videos), "calibration_source_videos": sorted(CALIBRATION_VIDEOS), "test_source_videos": sorted(TEST_VIDEOS)}, checkpoint)
    onnx_path = OUTPUT / "metric_mobilenet_v3_small_projection.onnx"
    torch.onnx.export(model.cpu().eval(), torch.zeros(1, 3, 224, 224), onnx_path, input_names=["image"], output_names=["embedding", "scores"], opset_version=17, dynamo=False)
    parity_session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    parity_input = torch.zeros(1, 3, 224, 224)
    with torch.no_grad():
        torch_embedding, torch_scores = model(parity_input)
    onnx_embedding, onnx_scores = parity_session.run(None, {parity_session.get_inputs()[0].name: parity_input.numpy()})
    parity = {"maxEmbeddingAbsDifference": float(np.max(np.abs(torch_embedding.numpy() - onnx_embedding))), "maxScoreAbsDifference": float(np.max(np.abs(torch_scores.numpy() - onnx_scores)))}
    for _ in range(10):
        model(parity_input)
    start = time.perf_counter()
    for _ in range(50):
        model(parity_input)
    latency_ms = (time.perf_counter() - start) * 1000 / 50
    test_summary = {key: value for key, value in test.items() if key not in {"predictions", "similarities", "margins"}}
    test_summary["falseAcceptanceRate"] = test["falseAcceptanceCount"] / test["frames"] if test["frames"] else 0.0
    test_summary["unknownRejectionRate"] = test["unknownOrRejected"] / test["frames"] if test["frames"] else 0.0
    report = {"status": "experimental_metric_learning", "loss": "batch-hard triplet margin=0.2 + 0.25 cross-entropy", "train_rows": len(train_rows), "calibration_rows": len(calibration_rows), "test_rows": len(test_rows), "sourceVideos": {"train": sorted(train_videos), "calibration": sorted(CALIBRATION_VIDEOS), "test": sorted(TEST_VIDEOS), "referenceEvaluationOverlap": sorted(reference_set & TEST_VIDEOS)}, "classCoverage": {split: {label: sum(row["label"] == label for row in split_rows) for label in classes} for split, split_rows in (("train", train_rows), ("calibration", calibration_rows), ("test", test_rows))}, "calibration": calibration, "test": test_summary, "thresholds": {"baselineSimilarity": baseline["similarityThreshold"], "baselineMargin": baseline["minimumMargin"], "metricSimilarity": calibration["similarityThreshold"], "metricMargin": calibration["minimumMargin"]}, "history": history, "checkpoint": str(checkpoint), "checkpointSizeBytes": checkpoint.stat().st_size, "onnx": str(onnx_path), "onnxSizeBytes": onnx_path.stat().st_size, "cpuLatencyMsBatch1": latency_ms, "parity": parity, "device": str(device), "onnxExported": True}
    (OUTPUT / "experiment_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checkpoint": str(checkpoint), "onnx": str(onnx_path), "calibration": calibration, "test": report["test"], "onnxSizeBytes": report["onnxSizeBytes"], "cpuLatencyMsBatch1": latency_ms, "parity": parity, "testRows": len(test_rows), "onnxExported": True}, indent=2))


if __name__ == "__main__":
    main()