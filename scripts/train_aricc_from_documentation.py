"""Train the browser ARICC classifier from the documented source videos.

Videos are split before frame extraction so frames from one video cannot land
in both training and validation sets.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import shutil
import stat
from pathlib import Path

import cv2
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "Documentation" / "datasets" / "ARICC" / "ARICC"
WORK_DIR = ROOT / "runs" / "aricc_documentation_dataset"
RUNS_DIR = ROOT / "runs" / "classify"
DEPLOY_DIR = ROOT / "public" / "models" / "aricc"

CLASS_NAMES = [
    "3D Printer",
    "Collaborative Robot",
    "FDAS",
    "Industrial Robot",
    "Pick & Place Machine",
    "Robotic Arm",
    "Smart Systems",
    "Speech Home Automation",
]


def remove_readonly(func, path, _exc_info):
    Path(path).chmod(stat.S_IWRITE)
    func(path)


def canonical_class_name(stem: str) -> str | None:
    normalized = stem.lower().strip()
    for class_name in CLASS_NAMES:
        if normalized == class_name.lower() or normalized.startswith(class_name.lower() + " "):
            return class_name
    return None


def collect_videos() -> dict[str, list[Path]]:
    videos: dict[str, list[Path]] = {name: [] for name in CLASS_NAMES}
    for path in sorted(SOURCE_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() not in {".mov", ".mp4", ".avi", ".mkv"}:
            continue
        class_name = canonical_class_name(path.stem)
        if class_name:
            videos[class_name].append(path)
    missing = [name for name, paths in videos.items() if not paths]
    if missing:
        raise RuntimeError(f"No source video found for: {', '.join(missing)}")
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
        in_range = frame_index >= start_frame and (end_frame is None or frame_index < end_frame)
        if in_range and frame_index % frame_step == 0:
            target = output_dir / f"{video_path.stem}_{frame_index:06d}.jpg"
            if not cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                raise RuntimeError(f"Could not write frame: {target}")
            saved += 1
        frame_index += 1
    capture.release()
    return saved


def build_dataset(
    seed: int,
    validation_ratio: float,
    frame_step: int,
    max_frames: int,
    always_train_videos: set[str] | None = None,
) -> dict:
    random.seed(seed)
    videos = collect_videos()
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR, onerror=remove_readonly)

    summary = {"train": {}, "val": {}, "videos": {}}
    for class_name, class_videos in videos.items():
        shuffled = class_videos[:]
        random.shuffle(shuffled)
        # A class with one recording cannot provide both independent train and
        # validation recordings. Keep it in training and report that limitation
        # instead of silently creating a class with zero training examples.
        validation_count = max(1, round(len(shuffled) * validation_ratio)) if len(shuffled) > 1 else 0
        forced_train = {
            path for path in shuffled
            if path.name in (always_train_videos or set())
        }
        eligible_validation = [path for path in shuffled if path not in forced_train]
        validation_videos = set(eligible_validation[:min(validation_count, len(eligible_validation))])
        summary["videos"][class_name] = {
            "train": [path.name for path in shuffled if path not in validation_videos],
            "val": [path.name for path in shuffled if path in validation_videos],
            "validation_source_split": len(shuffled) > 1,
        }

        if len(shuffled) == 1:
            summary.setdefault("limitations", []).append(
                f"{class_name}: one source recording; train/val are disjoint temporal ranges, not independent recordings"
            )

        for split in ("train", "val"):
            split_dir = WORK_DIR / split / class_name
            selected = [path for path in shuffled if (path in validation_videos) == (split == "val")]
            if len(shuffled) == 1:
                # Ultralytics requires every class in val. For singleton classes,
                # use disjoint temporal ranges and label the resulting metric as
                # non-independent in the dataset summary.
                path = shuffled[0]
                capture = cv2.VideoCapture(str(path))
                total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
                capture.release()
                midpoint = total_frames // 2
                if split == "train":
                    frame_count = extract_video(path, split_dir, frame_step, max_frames, 0, midpoint)
                else:
                    frame_count = extract_video(path, split_dir, frame_step, max_frames, midpoint, None)
            else:
                frame_count = sum(extract_video(path, split_dir, frame_step, max_frames) for path in selected)
            summary[split][class_name] = frame_count

    (WORK_DIR / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def balance_training_classes(target_count: int) -> dict[str, int]:
    counts = {}
    if target_count <= 0:
        return counts
    for class_name in CLASS_NAMES:
        class_dir = WORK_DIR / "train" / class_name
        images = sorted(class_dir.glob("*.jpg"))
        if not images:
            raise RuntimeError(f"No training images found for {class_name}")
        for copy_index in range(max(0, target_count - len(images))):
            source = images[copy_index % len(images)]
            target = class_dir / f"{source.stem}_balanced_{copy_index:04d}.jpg"
            shutil.copy2(source, target)
        counts[class_name] = len(list(class_dir.glob("*.jpg")))
    return counts


def filter_training_images(min_blur_score: float) -> dict[str, int]:
    removed = {}
    if min_blur_score <= 0:
        return removed
    for class_name in CLASS_NAMES:
        class_dir = WORK_DIR / "train" / class_name
        seen_hashes = set()
        removed[class_name] = 0
        for image_path in sorted(class_dir.glob("*.jpg")):
            image_hash = hashlib.sha256(image_path.read_bytes()).hexdigest()
            image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
            blur_score = float(cv2.Laplacian(image, cv2.CV_64F).var()) if image is not None else 0
            if image_hash in seen_hashes or blur_score < min_blur_score:
                image_path.unlink()
                removed[class_name] += 1
            else:
                seen_hashes.add(image_hash)
    return removed


def train(args: argparse.Namespace) -> dict:
    if args.device == "auto":
        device = "0" if __import__("torch").cuda.is_available() else "cpu"
    else:
        device = args.device
    model = YOLO(args.model)
    model.train(
        task="classify",
        data=str(WORK_DIR),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=max(10, args.epochs // 4),
        project=str(RUNS_DIR),
        name=args.run_name,
        device=device,
        workers=0,
        exist_ok=True,
    )

    best_path = RUNS_DIR / args.run_name / "weights" / "best.pt"
    if not best_path.exists():
        raise RuntimeError(f"Training did not produce {best_path}")

    trained = YOLO(str(best_path))
    onnx_path = Path(trained.export(format="onnx", imgsz=args.imgsz, simplify=True, opset=12))
    metadata = {
        "model_name": args.run_name,
        "classes": ["ARICC-1", "ARICC-2", "ARICC-3", "ARICC-4", "ARICC-5", "ARICC-6", "ARICC-7", "ARICC-8"],
        "displayNames": CLASS_NAMES,
        "trained_at": __import__("datetime").datetime.now().isoformat(),
        "source_dataset": str(SOURCE_DIR),
        "input_shape": [1, 3, args.imgsz, args.imgsz],
        "output_shape": [1, len(CLASS_NAMES)],
        "output_type": "logits",
        "preprocessing": {"mean": [0.0, 0.0, 0.0], "std": [1.0, 1.0, 1.0]},
        "dataset_summary": str(WORK_DIR / "dataset_summary.json"),
    }
    metadata_path = RUNS_DIR / args.run_name / f"{args.run_name}_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    result = {"onnx": str(onnx_path), "metadata": str(metadata_path), "best_pt": str(best_path)}
    if args.deploy:
        DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(onnx_path, DEPLOY_DIR / "aricc_classifier.onnx")
        shutil.copy2(metadata_path, DEPLOY_DIR / "aricc_classifier_metadata.json")
        result["deployed_to"] = str(DEPLOY_DIR)
    return result


def main() -> None:
    global WORK_DIR
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="yolov8n-cls.pt")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--frame-step", type=int, default=10)
    parser.add_argument("--max-frames", type=int, default=120)
    parser.add_argument("--validation-ratio", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--run-name", default="aricc_documentation_v1")
    parser.add_argument("--dataset-dir", type=Path, default=WORK_DIR)
    parser.add_argument("--reuse-dataset", action="store_true")
    parser.add_argument("--balance-train-to", type=int, default=0)
    parser.add_argument("--min-blur-score", type=float, default=0)
    parser.add_argument(
        "--always-train-video",
        action="append",
        default=[],
        help="Source video filename that must remain in the training split; may be repeated.",
    )
    parser.add_argument("--deploy", action="store_true")
    args = parser.parse_args()
    WORK_DIR = args.dataset_dir

    summary = {"reused": True, "dataset": str(WORK_DIR)} if args.reuse_dataset else build_dataset(
        args.seed,
        args.validation_ratio,
        args.frame_step,
        args.max_frames,
        set(args.always_train_video),
    )
    balanced_counts = balance_training_classes(args.balance_train_to)
    removed_images = filter_training_images(args.min_blur_score)
    if balanced_counts:
        summary["balanced_train_counts"] = balanced_counts
        (WORK_DIR / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if any(removed_images.values()):
        summary["removed_training_images"] = removed_images
        (WORK_DIR / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(json.dumps(train(args), indent=2))


if __name__ == "__main__":
    main()