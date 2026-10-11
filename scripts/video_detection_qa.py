import json
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / "public" / "models"
OUTPUT = ROOT / "Documentation" / "video_detection_qa_results.json"
FRAME_ROOT = ROOT / "Documentation" / "video_detection_qa_frames"

CASES = [
    ("ARICC", "Documentation/datasets/ARICC/ARICC/Robotic Arm.MOV", "Robotic Arm", False),
    ("RECON", "Documentation/datasets/RECON/Fluke 971 Temperature Humidity Meter (2).MOV", "fluke_971_temperature_humidity_meter", True),
    ("RECON", "Documentation/datasets/RECON/Fluke 2042 Cable Tracer.MOV", "fluke_2042_cable_tracer", True),
    ("FABLAB", "Documentation/datasets/FABLAB/BCN3d.MOV", "BCN3d", False),
    ("CAESAR", "Documentation/datasets/CAESAR/Analytical Balance.MOV", "analytical_balance", False),
]


def center_crop_tensor(frame, metadata):
    input_size = int(metadata.get("inputSize", metadata.get("input_shape", [1, 3, 224, 224])[-1]))
    height, width = frame.shape[:2]
    scale = input_size / min(width, height)
    resized_width = round(width * scale)
    resized_height = round(height * scale)
    resized = cv2.resize(frame, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)
    x = max(0, (resized_width - input_size) // 2)
    y = max(0, (resized_height - input_size) // 2)
    crop = resized[y:y + input_size, x:x + input_size]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    preprocessing = metadata.get("preprocessing", {})
    mean = np.asarray(preprocessing.get("mean", [0, 0, 0]), dtype=np.float32)
    std = np.asarray(preprocessing.get("std", [1, 1, 1]), dtype=np.float32)
    return np.transpose((rgb - mean) / std, (2, 0, 1))[None, ...].astype(np.float32)


def softmax(values):
    shifted = values - np.max(values)
    probabilities = np.exp(shifted)
    return probabilities / probabilities.sum()


def classify(session, metadata, frame):
    tensor = center_crop_tensor(frame, metadata)
    started = time.perf_counter()
    output = session.run(None, {session.get_inputs()[0].name: tensor})[0][0].astype(np.float64)
    latency_ms = (time.perf_counter() - started) * 1000
    probabilities = output if np.all((output >= 0) & (output <= 1)) and abs(output.sum() - 1) < 0.01 else softmax(output)
    order = np.argsort(probabilities)[::-1]
    top1, top2 = int(order[0]), int(order[1])
    confidence = float(probabilities[top1])
    margin = float(probabilities[top1] - probabilities[top2])
    display_names = metadata.get("displayNames", metadata.get("classes", []))
    predicted = display_names[top1] if top1 < len(display_names) else f"class_{top1}"
    accepted = confidence >= 0.80 and margin >= 0.15 and predicted not in {"UNKNOWN", "OTHER", "unknown_background"}
    return {
        "predicted": predicted if accepted else "UNKNOWN",
        "raw_top1": predicted,
        "confidence": confidence,
        "margin": margin,
        "accepted": accepted,
        "latency_ms": latency_ms,
    }


def main():
    results = []
    session_cache = {}
    for zone, relative_video, expected, approved in CASES:
        video_path = ROOT / relative_video
        metadata_path = MODEL_ROOT / zone.lower() / f"{zone.lower()}_classifier_metadata.json"
        model_path = MODEL_ROOT / zone.lower() / f"{zone.lower()}_classifier.onnx"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        session = session_cache.setdefault(zone, ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"]))
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            raise RuntimeError(f"Could not open {video_path}")
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        duration = frame_count / fps if fps else 0
        timestamps = [duration * fraction for fraction in (0.25, 0.5, 0.75)]
        for timestamp in timestamps:
            capture.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
            ok, frame = capture.read()
            if not ok:
                continue
            frame_dir = FRAME_ROOT / zone.lower() / video_path.stem.replace(" ", "_")
            frame_dir.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(frame_dir / f"full_{timestamp:.3f}s.jpg"), frame)
            prediction = classify(session, metadata, frame)
            results.append({
                "zone": zone,
                "video": str(video_path.relative_to(ROOT)),
                "expected": expected,
                "approved_ground_truth": approved,
                "timestamp_s": timestamp,
                "duration_s": duration,
                "fps": fps,
                **prediction,
                "correct": prediction["predicted"] == expected,
            })
        capture.release()

    # Approved spatial annotation from RECON ocr_labels.json. The crop is
    # evaluated separately because the application classifier itself is single-frame.
    zone = "RECON"
    video_path = ROOT / "Documentation/datasets/RECON/Fluke 2042 Cable Tracer and Fluke 941 Temperature Humidity Meter.MOV"
    metadata = json.loads((MODEL_ROOT / "recon/recon_classifier_metadata.json").read_text(encoding="utf-8"))
    session = session_cache.setdefault(zone, ort.InferenceSession(str(MODEL_ROOT / "recon/recon_classifier.onnx"), providers=["CPUExecutionProvider"]))
    capture = cv2.VideoCapture(str(video_path))
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    duration = (int(capture.get(cv2.CAP_PROP_FRAME_COUNT)) / fps) if fps else 0
    for timestamp in (11.0, 13.0, 15.5):
        capture.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
        ok, frame = capture.read()
        if not ok:
            continue
        height, width = frame.shape[:2]
        left, top, right, bottom = (int(width * 0.015), int(height * 0.29), int(width * 0.445), int(height * 0.91))
        crop = frame[top:bottom, left:right]
        frame_dir = FRAME_ROOT / "recon" / "approved_fluke_2042_crop"
        frame_dir.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(frame_dir / f"crop_{timestamp:.3f}s.jpg"), crop)
        prediction = classify(session, metadata, crop)
        results.append({
            "zone": zone,
            "video": str(video_path.relative_to(ROOT)),
            "sample_type": "approved_spatial_crop",
            "crop_box_normalized": [0.015, 0.29, 0.445, 0.91],
            "expected": "fluke_2042_cable_tracer",
            "approved_ground_truth": True,
            "timestamp_s": timestamp,
            "duration_s": duration,
            "fps": fps,
            **prediction,
            "correct": prediction["predicted"] == "fluke_2042_cable_tracer",
        })
    capture.release()
    OUTPUT.write_text(json.dumps({"preprocessing": "TAYLOR center crop, RGB, /255, metadata mean/std, NCHW", "results": results}, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "frames": len(results), "results": results}, indent=2))


if __name__ == "__main__":
    main()