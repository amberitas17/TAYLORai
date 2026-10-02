"""Train a FABLAB equipment classifier from the documented source videos."""

from __future__ import annotations

import argparse
import json
import random
import shutil
import stat
from pathlib import Path

import cv2
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "FABLAB"
WORK_DIR = ROOT / "runs" / "fablab_documentation_dataset"
RUNS_DIR = ROOT / "runs" / "classify"
DEPLOY_DIR = ROOT / "public" / "models" / "fablab"

CLASS_NAMES = [
    "3D Outputs",
    "BCN3d",
    "Crealty Ender 3D Printer",
    "Digital Embroidery Machine",
    "Leapfrog Bolt Pro",
    "STRATASYS",
    "VAQUFORM",
]


def remove_readonly(func, path, _exc_info):
    Path(path).chmod(stat.S_IWRITE)
    func(path)


def canonical_class_name(stem: str) -> str | None:
    normalized = stem.lower().strip()
    for class_name in sorted(CLASS_NAMES, key=len, reverse=True):
        candidate = class_name.lower()
        if normalized == candidate or normalized.startswith(candidate + " "):
            return class_name
    return None


def collect_videos() -> dict[str, list[Path]]:
    videos = {name: [] for name in CLASS_NAMES}
    for path in sorted(SOURCE_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() not in {".mov", ".mp4", ".avi", ".mkv"}:
            continue
        class_name = canonical_class_name(path.stem)
        if class_name:
            videos[class_name].append(path)
    return videos


def extract_video(
    video_path: Path,
    output_dir: Path,
    frame_step: int,
    max_frames: int,
    start_frame: int = 0,
    end_frame: int | None = None,
) -> int:
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")
    output_dir.mkdir(parents=True, exist_ok=True)
    frame_index = 0
    saved = 0
    while saved < max_frames:
        ok, frame = capture.read()
        if not ok:
            break
        if frame_index >= start_frame and (end_frame is None or frame_index < end_frame) and frame_index % frame_step == 0:
            target = output_dir / f"{video_path.stem}_{frame_index:06d}.jpg"
            if not cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                raise RuntimeError(f"Could not write frame: {target}")
            saved += 1
        frame_index += 1
    capture.release()
    return saved


def build_dataset(seed: int, validation_ratio: float, frame_step: int, max_frames: int) -> dict:
    random.seed(seed)
    sources = collect_videos()
    missing = [name for name, paths in sources.items() if not paths]
    if missing:
        raise RuntimeError(f"No source video found for: {', '.join(missing)}")
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR, onerror=remove_readonly)

    summary = {"train": {}, "val": {}, "videos": {}, "excluded_sources": []}
    mixed = SOURCE_DIR / "STRATASYS, LeapFrog Bolt Pro, & Digital Embroidery Machine.MOV"
    if mixed.exists():
        summary["excluded_sources"].append({"file": mixed.name, "reason": "multiple equipment classes in one recording"})

    for class_name, class_videos in sources.items():
        random.shuffle(class_videos)
        val_count = max(1, round(len(class_videos) * validation_ratio)) if len(class_videos) > 1 else 0
        val_videos = set(class_videos[:val_count])
        summary["videos"][class_name] = {
            "train": [path.name for path in class_videos if path not in val_videos],
            "val": [path.name for path in class_videos if path in val_videos],
            "independent_source_split": len(class_videos) > 1,
        }

        for split in ("train", "val"):
            target = WORK_DIR / split / class_name
            selected = [path for path in class_videos if (path in val_videos) == (split == "val")]
            if len(class_videos) == 1:
                capture = cv2.VideoCapture(str(class_videos[0]))
                total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
                capture.release()
                midpoint = total_frames // 2
                count = extract_video(
                    class_videos[0], target, frame_step, max_frames,
                    0 if split == "train" else midpoint,
                    midpoint if split == "train" else None,
                )
            else:
                count = sum(extract_video(path, target, frame_step, max_frames) for path in selected)
            summary[split][class_name] = count

    (WORK_DIR / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    global WORK_DIR
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="yolov8n-cls.pt")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--frame-step", type=int, default=10)
    parser.add_argument("--max-frames", type=int, default=120)
    parser.add_argument("--validation-ratio", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--run-name", default="fablab_documentation_v1")
    parser.add_argument("--dataset-dir", type=Path, default=WORK_DIR)
    parser.add_argument("--deploy", action="store_true")
    args = parser.parse_args()
    WORK_DIR = args.dataset_dir if args.dataset_dir.is_absolute() else ROOT / args.dataset_dir
    device = args.device
    if device == "auto":
        device = "0" if __import__("torch").cuda.is_available() else "cpu"

    summary = build_dataset(args.seed, args.validation_ratio, args.frame_step, args.max_frames)
    print(json.dumps(summary, indent=2))
    model = YOLO(args.model)
    model.train(
        task="classify", data=str(WORK_DIR), epochs=args.epochs, imgsz=args.imgsz,
        batch=args.batch, patience=max(8, args.epochs // 4), project=str(RUNS_DIR),
        name=args.run_name, device=device, workers=0, exist_ok=True,
    )

    best = RUNS_DIR / args.run_name / "weights" / "best.pt"
    if not best.exists():
        raise RuntimeError(f"Training did not produce {best}")
    trained = YOLO(str(best))
    onnx = Path(trained.export(format="onnx", imgsz=args.imgsz, simplify=True, opset=12))
    model_class_names = [trained.names[index] for index in range(len(trained.names))]
    metadata = {
        "model_name": args.run_name,
        "classes": model_class_names,
        "displayNames": model_class_names,
        "source_dataset": str(SOURCE_DIR),
        "dataset_summary": str(WORK_DIR / "dataset_summary.json"),
        "input_shape": [1, 3, args.imgsz, args.imgsz],
        "output_shape": [1, len(model_class_names)],
        "output_type": "logits",
        "preprocessing": {"mean": [0.0, 0.0, 0.0], "std": [1.0, 1.0, 1.0]},
    }
    metadata_path = RUNS_DIR / args.run_name / f"{args.run_name}_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    result = {"best_pt": str(best), "onnx": str(onnx), "metadata": str(metadata_path)}
    if args.deploy:
        DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(onnx, DEPLOY_DIR / "fablab_classifier.onnx")
        shutil.copy2(metadata_path, DEPLOY_DIR / "fablab_classifier_metadata.json")
        result["deployed_to"] = str(DEPLOY_DIR)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()