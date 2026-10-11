import json
import re
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Documentation" / "datasets" / "CAESAR"
MODEL = ROOT / "public" / "models" / "caesar" / "caesar_classifier.onnx"
METADATA = ROOT / "public" / "models" / "caesar" / "caesar_classifier_metadata.json"
TRAIN = ROOT / "runs" / "caesar_filename_dataset"
OUTPUT = ROOT / "Documentation" / "caesar_class_qa_results.json"


def label_for(path):
    stem = re.sub(r"[\s_-]+\d+$", "", path.stem).strip()
    stem = re.sub(r"multi[- ]paramter", "multi-parameter", stem, flags=re.I)
    return re.sub(r"[-\s]+", "_", re.sub(r"[^\w\s-]", "", stem).lower()).strip("_")


def preprocess(frame, metadata):
    size = int(metadata["inputSize"])
    height, width = frame.shape[:2]
    scale = size / min(width, height)
    resized = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_LINEAR)
    x = max(0, (resized.shape[1] - size) // 2)
    y = max(0, (resized.shape[0] - size) // 2)
    crop = resized[y:y + size, x:x + size]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    preprocessing = metadata.get("preprocessing", {})
    mean = np.asarray(preprocessing.get("mean", [0, 0, 0]), dtype=np.float32)
    std = np.asarray(preprocessing.get("std", [1, 1, 1]), dtype=np.float32)
    return np.transpose((rgb - mean) / std, (2, 0, 1))[None].astype(np.float32)


def classify(session, metadata, frame):
    started = time.perf_counter()
    output = session.run(None, {session.get_inputs()[0].name: preprocess(frame, metadata)})[0][0].astype(np.float64)
    if np.all((output >= 0) & (output <= 1)) and abs(output.sum() - 1) < 0.01:
        probabilities = output
    else:
        shifted = output - np.max(output)
        probabilities = np.exp(shifted) / np.exp(shifted).sum()
    order = np.argsort(probabilities)[::-1]
    names = metadata["displayNames"]
    top1, top2 = int(order[0]), int(order[1])
    return {
        "raw_top1": names[top1],
        "raw_top1_confidence": float(probabilities[top1]),
        "raw_top2": names[top2],
        "raw_top2_confidence": float(probabilities[top2]),
        "margin": float(probabilities[top1] - probabilities[top2]),
        "accepted": bool(probabilities[top1] >= 0.80 and probabilities[top1] - probabilities[top2] >= 0.15),
        "latency_ms": (time.perf_counter() - started) * 1000,
    }


def crop_variant(frame, variant):
    if variant == "full_center_crop":
        return frame
    height, width = frame.shape[:2]
    fractions = {"center_70": 0.70, "center_80": 0.80, "approved_balance_box": None}
    if variant == "approved_balance_box":
        box = (0.18, 0.12, 0.76, 0.88)
        return frame[int(height * box[1]):int(height * box[3]), int(width * box[0]):int(width * box[2])]
    fraction = fractions[variant]
    left = int(width * (1 - fraction) / 2)
    top = int(height * (1 - fraction) / 2)
    return frame[top:int(height * (1 + fraction) / 2), left:int(width * (1 + fraction) / 2)]


def main():
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    results = []
    videos = sorted(SOURCE.glob("*.MOV"), key=lambda path: path.name.casefold())
    for video in videos:
        capture = cv2.VideoCapture(str(video))
        if not capture.isOpened():
            continue
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        duration = frame_count / fps if fps else 0
        samples = []
        for fraction in (0.2, 0.4, 0.6, 0.8):
            capture.set(cv2.CAP_PROP_POS_MSEC, duration * fraction * 1000)
            ok, frame = capture.read()
            if not ok:
                continue
            full_height, full_width = frame.shape[:2]
            variants = {"full_center_crop": classify(session, metadata, frame)}
            if label_for(video) == "analytical_balance":
                for variant in ("center_70", "center_80", "approved_balance_box"):
                    variants[variant] = classify(session, metadata, crop_variant(frame, variant))
            samples.append({
                "timestamp_s": duration * fraction,
                "frame_size": [full_width, full_height],
                "variants": variants,
            })
        capture.release()
        train_dir = TRAIN / "train" / label_for(video)
        val_dir = TRAIN / "val" / label_for(video)
        results.append({
            "video": video.name,
            "expected_class": label_for(video),
            "duration_s": duration,
            "frame_count": frame_count,
            "train_frame_count": len(list(train_dir.glob("*.jpg"))),
            "validation_frame_count": len(list(val_dir.glob("*.jpg"))),
            "samples": samples,
        })
    payload = {
        "model": str(MODEL.relative_to(ROOT)),
        "metadata_classes": metadata["classes"],
        "preprocessing": metadata["preprocessing"],
        "thresholds": {"confidence": 0.80, "margin": 0.15},
        "results": results,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "videos": len(results), "classes": len(metadata["classes"])}, indent=2))


if __name__ == "__main__":
    main()
