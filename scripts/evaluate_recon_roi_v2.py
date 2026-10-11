"""Evaluate preserved RECON V2 on full frames and annotation-isolated ROIs."""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import torch
from torchvision import models, transforms


ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "Documentation" / "datasets" / "RECON" / "RECON_003.MOV"
MANIFEST = ROOT / "Documentation" / "datasets" / "RECON" / "ocr_labels.json"
V2_RUN = ROOT / "runs" / "recon_unified_mobilenet_v2"
OUTPUT = ROOT / "runs" / "recon_roi_v2"
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
PROBES = [
    (1.5, "root_crop_slicing_machine"),
    (8.0, "charcoal_oven_machine"),
    (22.5, "root_crop_slicing_machine"),
    (31.5, "charcoal_oven_machine"),
    (39.0, "root_crop_slicing_machine"),
    (42.0, "charcoal_oven_machine"),
]


def active_region(segments: list[dict], seconds: float) -> dict:
    for segment in segments:
        if segment["start_seconds"] <= seconds < segment["end_seconds"]:
            return segment["regions"][0]
    raise ValueError(f"No spatial annotation for {seconds}s")


def crop(frame, box: list[float]):
    height, width = frame.shape[:2]
    left, top, right, bottom = [float(value) for value in box]
    left, right = sorted((max(0, round(left * width)), min(width, round(right * width))))
    top, bottom = sorted((max(0, round(top * height)), min(height, round(bottom * height))))
    return frame[top:bottom, left:right], [left / width, top / height, right / width, bottom / height]


def predict(model, image, transform, classes):
    tensor = transform(cv2.cvtColor(image, cv2.COLOR_BGR2RGB)).unsqueeze(0)
    with torch.no_grad():
        probabilities = torch.softmax(model(tensor), dim=1)[0]
    values, indices = torch.topk(probabilities, 2)
    return {
        "prediction": classes[int(indices[0])],
        "confidence": float(values[0]),
        "second_best_prediction": classes[int(indices[1])],
        "second_best_confidence": float(values[1]),
        "confidence_margin": float(values[0] - values[1]),
    }


def main() -> None:
    metadata = json.loads((V2_RUN / "recon_classifier_metadata.json").read_text(encoding="utf-8"))
    checkpoint = torch.load(V2_RUN / "best_model.pth", map_location="cpu")
    classes = metadata["displayNames"]
    model = models.mobilenet_v3_small(weights=None)
    model.classifier[-1] = torch.nn.Linear(model.classifier[-1].in_features, len(classes))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    segments = manifest["RECON_003.MOV"]["spatial_segments"]
    capture = cv2.VideoCapture(str(VIDEO))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {VIDEO}")
    results = []
    for seconds, expected in PROBES:
        capture.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
        ok, frame = capture.read()
        if not ok:
            raise RuntimeError(f"Could not read {seconds}s from {VIDEO}")
        region = active_region(segments, seconds)
        roi, coordinates = crop(frame, region["box"])
        results.append({
            "seconds": seconds,
            "expected": expected,
            "annotation_label": region["label"],
            "roi_coordinates_normalized": coordinates,
            "full_frame": predict(model, frame, transform, classes),
            "oracle_roi": predict(model, roi, transform, classes),
        })
    capture.release()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {
        "model": "recon_unified_mobilenet_v2",
        "checkpoint": str(V2_RUN / "best_model.pth"),
        "detector_available": False,
        "roi_source": "RECON_003.MOV spatial annotations (oracle localization)",
        "results": results,
    }
    (OUTPUT / "recon_003_v2_roi_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()