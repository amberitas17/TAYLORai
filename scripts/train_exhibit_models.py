"""
Train exhibit gate and zone YOLO classification models on this machine.

Uses datasets prepared by prepare_exhibit_dataset.py.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
DATASETS = ROOT / "datasets"
RUNS = ROOT / "runs" / "classify"


def resolve_device(requested: str) -> str:
    if requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "0"
    return "cpu"


def train_one(
    data_dir: Path,
    model_name: str,
    run_name: str,
    epochs: int,
    batch: int,
    imgsz: int,
    device: str,
) -> dict:
    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset not found: {data_dir}")

    model = YOLO(model_name)
    result = model.train(
        task="classify",
        data=str(data_dir),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        patience=max(10, epochs // 4),
        project=str(RUNS),
        name=run_name,
        device=device,
        workers=0,
        exist_ok=True,
        verbose=True,
    )

    best_pt = RUNS / run_name / "weights" / "best.pt"
    export_path = None
    metadata_path = None

    if best_pt.exists():
        export_model = YOLO(str(best_pt))
        export_file = export_model.export(format="onnx", imgsz=imgsz, simplify=True, opset=12)
        export_path = str(export_file)

        class_names = list(export_model.names.values())
        metadata = {
            "model_name": run_name,
            "classes": class_names,
            "trained_at": datetime.now().isoformat(),
            "source_dataset": str(data_dir),
            "preprocessing": {
                "resize": [imgsz, imgsz],
                "normalize": {
                    "mean": [0.485, 0.456, 0.406],
                    "std": [0.229, 0.224, 0.225],
                },
            },
        }
        metadata_path = RUNS / run_name / f"{run_name}_metadata.json"
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return {
        "run_name": run_name,
        "best_pt": str(best_pt),
        "onnx": export_path,
        "metadata": str(metadata_path) if metadata_path else None,
        "result_dir": str(RUNS / run_name),
        "metrics": str(result) if result is not None else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train exhibit YOLO classify models")
    parser.add_argument("--which", choices=["gate", "zone", "all"], default="all")
    parser.add_argument("--model", default="yolov8n-cls.pt", help="Base YOLO classify checkpoint")
    parser.add_argument("--epochs-gate", type=int, default=30)
    parser.add_argument("--epochs-zone", type=int, default=40)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--device", default="auto", help="auto, cpu, or CUDA device id like 0")
    parser.add_argument("--gate-model", default=None, help="Checkpoint for gate training/fine-tune")
    parser.add_argument("--zone-model", default=None, help="Checkpoint for zone training/fine-tune")
    parser.add_argument("--gate-run-name", default="exhibit_gate_v2")
    parser.add_argument("--zone-run-name", default="zone_dwt_eap_egn_local")
    args = parser.parse_args()

    device = resolve_device(args.device)
    print(f"Using device: {device}")
    if device == "cpu":
        print("CUDA not available to PyTorch; training will run on CPU.")

    gate_checkpoint = args.gate_model or str(RUNS / "exhibit_gate_local" / "weights" / "best.pt")
    if args.which in {"gate", "all"} and not Path(gate_checkpoint).exists():
        gate_checkpoint = args.model

    zone_checkpoint = args.zone_model or args.model

    outputs = []

    if args.which in {"gate", "all"}:
        print("\n=== Training gate model (exhibit vs background) ===")
        print(f"Gate checkpoint: {gate_checkpoint}")
        outputs.append(
            train_one(
                DATASETS / "gate_dataset",
                gate_checkpoint,
                args.gate_run_name,
                args.epochs_gate,
                args.batch,
                args.imgsz,
                device,
            )
        )

    if args.which in {"zone", "all"}:
        print("\n=== Training zone model (DWT/EAP/EGN) ===")
        print(f"Zone checkpoint: {zone_checkpoint}")
        outputs.append(
            train_one(
                DATASETS / "zone_dataset",
                zone_checkpoint,
                args.zone_run_name,
                args.epochs_zone,
                args.batch,
                args.imgsz,
                device,
            )
        )

    report_path = RUNS / "local_training_report.json"
    report_path.write_text(json.dumps(outputs, indent=2), encoding="utf-8")
    print("\nTraining complete.")
    print(json.dumps(outputs, indent=2))
    print(f"\nReport: {report_path}")


if __name__ == "__main__":
    main()
