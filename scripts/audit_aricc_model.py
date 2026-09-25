"""Audit PyTorch and ONNX ARICC predictions on the same preprocessed images."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from ultralytics import YOLO


def preprocess(path: Path, size: int) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    scale = size / min(image.width, image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.BILINEAR)
    left = (resized.width - size) // 2
    top = (resized.height - size) // 2
    image = resized.crop((left, top, left + size, top + size))
    pixels = np.asarray(image, dtype=np.float32) / 255.0
    return np.transpose(pixels, (2, 0, 1))[None, ...].astype(np.float32)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--onnx", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    checkpoint = YOLO(str(args.checkpoint))
    names = {int(index): name for index, name in checkpoint.names.items()}
    labels = sorted(names)
    matrix = np.zeros((len(labels), len(labels)), dtype=np.int64)
    session = ort.InferenceSession(str(args.onnx), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    max_abs_logit_delta = 0.0
    agreement = 0
    total = 0

    for label in labels:
        image_paths = sorted((args.dataset / "val" / names[label]).glob("*.jpg"))
        if args.limit:
            image_paths = image_paths[: args.limit]
        for image_path in image_paths:
            batch = preprocess(image_path, 224)
            with torch.inference_mode():
                torch_output = checkpoint.model(torch.from_numpy(batch))
                if isinstance(torch_output, (tuple, list)):
                    torch_output = torch_output[0]
                torch_logits = torch_output.cpu().numpy()[0]
            onnx_logits = np.asarray(session.run([output_name], {input_name: batch})[0])[0]
            max_abs_logit_delta = max(max_abs_logit_delta, float(np.max(np.abs(torch_logits - onnx_logits))))
            torch_prediction = int(np.argmax(torch_logits))
            onnx_prediction = int(np.argmax(onnx_logits))
            agreement += int(torch_prediction == onnx_prediction)
            matrix[label, onnx_prediction] += 1
            total += 1

    per_class = {}
    for label in labels:
        support = int(matrix[label].sum())
        correct = int(matrix[label, label])
        per_class[names[label]] = {
            "support": support,
            "correct": correct,
            "accuracy": correct / support if support else None,
            "predicted_as": {
                names[prediction]: int(matrix[label, prediction])
                for prediction in labels
                if matrix[label, prediction]
            },
        }

    print(json.dumps({
        "classes": names,
        "samples": total,
        "onnx_accuracy": int(np.trace(matrix)) / total if total else None,
        "pytorch_onnx_prediction_agreement": agreement / total if total else None,
        "max_absolute_logit_delta": max_abs_logit_delta,
        "confusion_matrix_rows_true_columns_predicted": matrix.tolist(),
        "per_class": per_class,
    }, indent=2))


if __name__ == "__main__":
    main()