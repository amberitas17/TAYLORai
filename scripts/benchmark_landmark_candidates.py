"""Benchmark the reviewed 12-class landmark checkpoint and browser export."""
from __future__ import annotations

import csv
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
PROPOSAL = ROOT / "runs" / "landmark_reduced_experiment" / "reduced_landmark_split_proposal.json"
CHECKPOINT = ROOT / "runs" / "landmark_browser_candidate" / "training" / "best_mobilenet_v3_small.pth"
OUTPUT = ROOT / "runs" / "landmark_browser_candidate"
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def metric(labels, predictions, classes):
    matrix = np.zeros((len(classes), len(classes)), dtype=np.int64)
    for label, prediction in zip(labels, predictions):
        matrix[label, prediction] += 1
    per_class = []
    for index, label in enumerate(classes):
        tp = matrix[index, index]
        fp = matrix[:, index].sum() - tp
        fn = matrix[index, :].sum() - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class.append({"label": label, "precision": float(precision), "recall": float(recall), "f1": float(f1), "support": int(matrix[index].sum())})
    return {"accuracy": float(np.trace(matrix) / matrix.sum()) if matrix.sum() else 0.0, "macro_f1": float(np.mean([item["f1"] for item in per_class])), "per_class": per_class, "confusion_matrix": matrix.tolist(), "classes": classes}


def load_model(classes):
    payload = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
    model = models.mobilenet_v3_small(weights=None)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    model.load_state_dict(payload["state_dict"])
    return model.eval()


def image_tensor(path, transform):
    return transform(Image.open(path).convert("RGB")).unsqueeze(0)


def embedding(model, image):
    with torch.no_grad():
        features = model.features(image)
        features = model.avgpool(features).flatten(1)
        return features[0] / features[0].norm().clamp_min(1e-8)


class EmbeddingModel(nn.Module):
    def __init__(self, source):
        super().__init__()
        self.features = source.features
        self.avgpool = source.avgpool

    def forward(self, image):
        vector = self.avgpool(self.features(image)).flatten(1)
        return vector / vector.norm(dim=1, keepdim=True).clamp_min(1e-8)


def main():
    proposal = json.loads(PROPOSAL.read_text(encoding="utf-8"))
    classes = proposal["selected_classes"]
    class_to_index = {label: index for index, label in enumerate(classes)}
    train_videos = set(proposal["train_source_videos"])
    validation_videos = set(proposal["validation_source_videos"])
    rows = list(csv.DictReader((WORK / "review_manifest.csv").open(newline="", encoding="utf-8")))
    eligible = [row for row in rows if row["label"] in class_to_index]
    train_rows = [row for row in eligible if row["source_video"] in train_videos]
    validation_rows = [row for row in eligible if row["source_video"] in validation_videos]
    transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    model = load_model(classes)
    labels, predictions, confidences, validation_embeddings = [], [], [], []
    references = []
    with torch.no_grad():
        for row in train_rows:
            path = WORK.parent / row["frame_path"]
            references.append((embedding(model, image_tensor(path, transform)), class_to_index[row["label"]]))
        for row in validation_rows:
            output = model(image_tensor(WORK.parent / row["frame_path"], transform))
            probabilities = output.softmax(1)[0]
            prediction = int(probabilities.argmax())
            labels.append(class_to_index[row["label"]])
            predictions.append(prediction)
            confidences.append(float(probabilities.max()))
            validation_embeddings.append(embedding(model, image_tensor(WORK.parent / row["frame_path"], transform)))
    standard = metric(labels, predictions, classes)
    retrieval_predictions = []
    retrieval_evidence = []
    for vector in validation_embeddings:
        similarities = [(float(torch.dot(vector, reference)), label) for reference, label in references]
        ranked = sorted(similarities, reverse=True)
        best_similarity, best_label = ranked[0]
        next_similarity = next((similarity for similarity, label in ranked if label != best_label), ranked[1][0] if len(ranked) > 1 else 0.0)
        retrieval_predictions.append(best_label)
        retrieval_evidence.append((best_similarity, best_similarity - next_similarity))
    retrieval = metric(labels, retrieval_predictions, classes)
    calibration = None
    for threshold in np.arange(0.80, 0.991, 0.005):
        for margin in np.arange(0.0, 0.101, 0.005):
            accepted = [index for index, (similarity, gap) in enumerate(retrieval_evidence) if similarity >= threshold and gap >= margin]
            if not accepted:
                continue
            precision = sum(retrieval_predictions[index] == labels[index] for index in accepted) / len(accepted)
            candidate = {"similarityThreshold": round(float(threshold), 3), "minimumMargin": round(float(margin), 3), "accepted": len(accepted), "rejected": len(labels) - len(accepted), "acceptedAccuracy": float(precision)}
            if precision >= 0.90 and (calibration is None or len(accepted) > calibration["accepted"] or (len(accepted) == calibration["accepted"] and precision > calibration["acceptedAccuracy"])):
                calibration = candidate
    if calibration is None:
        calibration = {"similarityThreshold": 1.0, "minimumMargin": 1.0, "accepted": 0, "rejected": len(labels), "acceptedAccuracy": 0.0}

    unknown_rows = [row for row in rows if row["label"] == "unknown"]
    unknown_confidences = []
    for row in unknown_rows:
        unknown_confidences.append(float(model(image_tensor(WORK.parent / row["frame_path"], transform)).softmax(1).max()))
    threshold = 0.58
    unknown_rejection = {"threshold": threshold, "unknown_frames": len(unknown_rows), "rejected_unknown": sum(confidence < threshold for confidence in unknown_confidences), "unknown_confidences": unknown_confidences}

    sample = torch.zeros(1, 3, 224, 224)
    for _ in range(10): model(sample)
    start = time.perf_counter()
    for _ in range(100): model(sample)
    latency_ms = (time.perf_counter() - start) * 1000 / 100

    OUTPUT.mkdir(parents=True, exist_ok=True)
    checkpoint_copy = OUTPUT / "landmark_mobilenet_v3_small_experimental.pth"
    checkpoint_copy.write_bytes(CHECKPOINT.read_bytes())
    onnx_path = OUTPUT / "landmark_mobilenet_v3_small_experimental.onnx"
    export_error = None
    try:
        torch.onnx.export(model, sample, onnx_path, input_names=["image"], output_names=["scores"], opset_version=17, dynamo=False)
    except Exception as error:  # noqa: BLE001
        export_error = str(error)
    parity = {"tested": False, "max_abs_difference": None, "error": None}
    if onnx_path.exists():
        try:
            import onnxruntime as ort
            session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
            reference = image_tensor(WORK.parent / validation_rows[0]["frame_path"], transform).numpy()
            pytorch_scores = model(torch.from_numpy(reference)).detach().numpy()
            onnx_scores = session.run(None, {session.get_inputs()[0].name: reference})[0]
            parity = {"tested": True, "max_abs_difference": float(np.max(np.abs(pytorch_scores - onnx_scores))), "within_tolerance": bool(np.allclose(pytorch_scores, onnx_scores, atol=1e-4, rtol=1e-4))}
        except Exception as error:  # noqa: BLE001
            parity["error"] = str(error)
    retrieval_onnx = OUTPUT / "landmark_mobilenet_v3_small_retrieval_experimental.onnx"
    retrieval_export_error = None
    try:
        torch.onnx.export(EmbeddingModel(model), sample, retrieval_onnx, input_names=["image"], output_names=["embedding"], opset_version=17, dynamo=False)
    except Exception as error:  # noqa: BLE001
        retrieval_export_error = str(error)
    reference_vectors = [{"label": row["label"], "embedding": vector.tolist(), "sourceVideo": row["source_video"], "framePath": row["frame_path"], "timestampSeconds": float(row["timestamp_seconds"]), "frameIndex": int(row["frame_index"])} for row, (vector, _) in zip(train_rows, references)]
    extension_rows = []
    for label in ("caesar", "recon"):
        label_rows = [row for row in rows if row["label"] == label and row["review_status"] == "reviewed"]
        seen_videos = set()
        for row in label_rows:
            if row["source_video"] in seen_videos:
                continue
            seen_videos.add(row["source_video"])
            extension_rows.append(row)
    extension_vectors = []
    with torch.no_grad():
        for row in extension_rows:
            vector = embedding(model, image_tensor(WORK.parent / row["frame_path"], transform))
            extension_vectors.append({"label": row["label"], "embedding": vector.tolist(), "sourceVideo": row["source_video"], "framePath": row["frame_path"], "timestampSeconds": float(row["timestamp_seconds"]), "frameIndex": int(row["frame_index"]), "referenceStatus": "reviewed-experimental-extension"})
    all_references = [{**reference, "referenceId": f"original-{index}", "landmarkId": f"landmark-{reference['label']}"} for index, reference in enumerate(reference_vectors)]
    all_references.extend({**reference, "referenceId": f"extension-{index}", "landmarkId": f"landmark-{reference['label']}"} for index, reference in enumerate(extension_vectors))
    retrieval_manifest = {"id": "landmark-mobilenet-v3-small-retrieval-experimental-20261008", "featureExtractorVersion": "mobilenet-v3-small-20261008", "approved": False, "status": "experimental", "mode": "retrieval", "url": "/models/landmark_browser_candidate/landmark_mobilenet_v3_small_retrieval_experimental.onnx", "metadataUrl": "/models/landmark_browser_candidate/retrieval.metadata.json", "sha256": hashlib.sha256(retrieval_onnx.read_bytes()).hexdigest() if retrieval_onnx.exists() else None, "preprocessing": {"width": 224, "height": 224, "mean": MEAN, "std": STD, "channelOrder": "RGB"}, "similarityThreshold": calibration["similarityThreshold"], "minimumMargin": calibration["minimumMargin"], "maxViewsPerLandmark": 12, "dedupeSimilarity": 0.995, "references": all_references, "metrics": {"retrieval": retrieval, "held_out_calibration": calibration, "experimental_extensions": {"labels": ["caesar", "recon"], "referenceCount": len(extension_vectors), "sourceVideos": sorted({row['source_video'] for row in extension_rows})}}, "parity": {"export_error": retrieval_export_error}}
    (OUTPUT / "retrieval.metadata.json").write_text(json.dumps(retrieval_manifest, indent=2) + "\n", encoding="utf-8")
    manifest = {"id": "landmark-mobilenet-v3-small-experimental-20261008", "approved": False, "status": "experimental", "url": "/models/landmark_browser_candidate/landmark_mobilenet_v3_small_experimental.onnx", "metadataUrl": "/models/landmark_browser_candidate/manifest.metadata.json", "sha256": hashlib.sha256(onnx_path.read_bytes()).hexdigest() if onnx_path.exists() else None, "classes": classes, "preprocessing": {"width": 224, "height": 224, "mean": MEAN, "std": STD, "channelOrder": "RGB"}, "metrics": {"standard": standard, "retrieval": retrieval, "unknown_rejection": unknown_rejection, "cpu_latency_ms_batch1": latency_ms}, "parity": parity, "retrieval_artifact": retrieval_manifest}
    (OUTPUT / "manifest.metadata.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"train_rows": len(train_rows), "validation_rows": len(validation_rows), "standard": standard, "retrieval": retrieval, "unknown_rejection": unknown_rejection, "cpu_latency_ms_batch1": latency_ms, "onnx": str(onnx_path) if onnx_path.exists() else None, "onnx_size_bytes": onnx_path.stat().st_size if onnx_path.exists() else None, "onnx_export_error": export_error, "parity": parity, "manifest": str(OUTPUT / "manifest.json")}, indent=2))


if __name__ == "__main__":
    main()
