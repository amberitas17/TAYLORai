"""Train the unified individual-exhibit RECON classifier without deployment."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "runs" / "recon_unified_dataset"
REPORT_PATH = DATASET_DIR / "unified_manifest_report.json"
RUNS_DIR = ROOT / "runs" / "classify"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="yolov8n-cls.pt")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--run-name", default="recon_unified_v1")
    args = parser.parse_args()

    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    if not report.get("ready_for_training"):
        raise RuntimeError(f"Dataset is not ready: {REPORT_PATH}")
    if not (DATASET_DIR / "train").is_dir() or not (DATASET_DIR / "val").is_dir():
        raise RuntimeError(f"Expected train and val folders under {DATASET_DIR}")

    model = YOLO(args.model)
    model.train(
        task="classify",
        data=str(DATASET_DIR),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=max(8, args.epochs // 4),
        project=str(RUNS_DIR),
        name=args.run_name,
        device=args.device,
        workers=0,
        exist_ok=True,
    )

    run_dir = RUNS_DIR / args.run_name
    best = run_dir / "weights" / "best.pt"
    if not best.exists():
        raise RuntimeError(f"Training did not produce {best}")
    trained = YOLO(str(best))
    model_class_names = [trained.names[index] for index in range(len(trained.names))]
    onnx = Path(trained.export(format="onnx", imgsz=args.imgsz, simplify=True, opset=12))
    metadata = {
        "model_name": args.run_name,
        "displayNames": model_class_names,
        "source_dataset": str(DATASET_DIR),
        "source_manifest_report": str(REPORT_PATH),
        "input_shape": [1, 3, args.imgsz, args.imgsz],
        "output_shape": [1, len(model_class_names)],
        "output_type": "logits",
        "preprocessing": {"mean": [0.0, 0.0, 0.0], "std": [1.0, 1.0, 1.0]},
    }
    metadata_path = run_dir / f"{args.run_name}_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"best_pt": str(best), "onnx": str(onnx), "metadata": str(metadata_path)}, indent=2))


if __name__ == "__main__":
    main()
