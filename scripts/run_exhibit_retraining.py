"""Run the remote exhibit retraining job without touching production assets.

The runner consumes server-synced JSONL records. It never uses a prediction as
the label, never modifies the original dataset or held-out validation folders,
and writes a candidate job directory plus a recovery state file. The current
production models are YOLO/ONNX for all four zones, so promotion remains
blocked until a production-model evaluation adapter is configured.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import shutil
import subprocess
import time
from collections import Counter, defaultdict
from pathlib import Path

from retraining_memory import configure_cpu_threads, memory_limit_mb, memory_snapshot

ROOT = Path(__file__).resolve().parent.parent
ZONES = ("ARICC", "RECON", "FABLAB", "CAESAR")
DATASETS = {
    "ARICC": ROOT / "runs" / "aricc_documentation_dataset",
    "RECON": ROOT / "runs" / "recon_unified_dataset",
    "FABLAB": ROOT / "runs" / "fablab_documentation_dataset",
    "CAESAR": ROOT / "runs" / "caesar_annotated_dataset",
}
PRODUCTION_MODELS = {
    zone: ROOT / "public" / "models" / zone.lower() / f"{zone.lower()}_classifier.onnx"
    for zone in ZONES
}
TRAINING_SCRIPTS = {
    "ARICC": ROOT / "scripts" / "train_aricc_from_documentation.py",
    "RECON": ROOT / "scripts" / "train_recon_from_documentation.py",
    "FABLAB": ROOT / "scripts" / "train_fablab_from_documentation.py",
    "CAESAR": ROOT / "scripts" / "train_caesar_from_annotations.py",
}


def read_records(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def decode_image(record: dict) -> bytes | None:
    value = record.get("imageDataUrl")
    if not isinstance(value, str) or not value.startswith("data:image/") or "," not in value:
        return None
    try:
        return base64.b64decode(value.split(",", 1)[1], validate=True)
    except Exception:  # noqa: BLE001
        return None


def eligibility(records: list[dict], minimum_per_class: int, minimum_sessions: int) -> dict:
    accepted = []
    rejected = Counter()
    for record in records:
        zone = str(record.get("zone", "")).upper()
        image = decode_image(record)
        reasons = record.get("reasons", [])
        evidence = record.get("evidence", {})
        if zone not in ZONES:
            rejected["unsupported_zone"] += 1
        elif record.get("status") != "VERIFIED" or record.get("independentlyVerified") is not True:
            rejected["not_independently_verified"] += 1
        elif record.get("consented") is not True:
            rejected["missing_consent"] += 1
        elif not record.get("label"):
            rejected["missing_verified_label"] += 1
        elif image is None:
            rejected["missing_image_data"] += 1
        elif not (evidence.get("uncertainFrames", 0) >= 2 or ("UNSTABLE" in reasons and evidence.get("distinctLabels", 0) >= 3) or
                  ("USER_REPORTED_MISCLASSIFICATION" in reasons and evidence.get("userCorrection") is True and
                   record.get("verificationSource") not in (None, "", "model") and record.get("label") == record.get("proposedLabel"))):
            rejected["insufficient_repeated_trigger_evidence"] += 1
        else:
            accepted.append({**record, "imageBytes": image, "digest": hashlib.sha256(image).hexdigest()})

    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for record in accepted:
        grouped[(str(record["zone"]).upper(), str(record["label"]))].append(record)
    eligible = []
    classes = {}
    for key, examples in grouped.items():
        zone, label = key
        sessions = {example.get("source", {}).get("sessionId") for example in examples if example.get("source", {}).get("sessionId")}
        unique_images = {example["digest"] for example in examples}
        class_report = {
            "zone": zone,
            "label": label,
            "verified_examples": len(examples),
            "unique_images": len(unique_images),
            "sessions": len(sessions),
            "ready": len(examples) >= minimum_per_class and len(unique_images) >= minimum_per_class and len(sessions) >= minimum_sessions,
        }
        classes[f"{zone}:{label}"] = class_report
        if class_report["ready"]:
            eligible.extend(examples)
        else:
            rejected["class_not_ready"] += 1
    ready_zones = sorted({example["zone"] for example in eligible})
    return {"ready": bool(eligible), "eligible_zones": ready_zones, "eligible_examples": len(eligible), "classes": classes, "rejected": dict(rejected), "records": eligible}


def stage_examples(job_dir: Path, records: list[dict]) -> dict:
    staged = Counter()
    for record in records:
        zone = str(record["zone"]).upper()
        label = str(record["label"])
        target = job_dir / "datasets" / zone / "train" / label
        target.mkdir(parents=True, exist_ok=True)
        destination = target / f"verified-{record['id']}.jpg"
        destination.write_bytes(record["imageBytes"])
        staged[zone] += 1
    return dict(staged)


def prepare_datasets(job_dir: Path, zones: list[str]) -> dict[str, Path]:
    datasets = {}
    for zone in zones:
        source = DATASETS[zone]
        target = job_dir / "datasets" / zone
        shutil.copytree(source, target, dirs_exist_ok=True)
        datasets[zone] = target
    return datasets


def training_command(zone: str, dataset: Path, run_name: str) -> list[str]:
    common = ["--model", str(ROOT / "yolov8n-cls.pt"), "--run-name", run_name, "--device", "cpu", "--batch", os.environ.get("TAYLOR_TRAIN_BATCH", "4")]
    if zone == "CAESAR":
        return [str(TRAINING_SCRIPTS[zone]), "--output", str(dataset), "--reuse-dataset", "--train", *common]
    return [str(TRAINING_SCRIPTS[zone]), "--dataset-dir", str(dataset), "--reuse-dataset", *common]


def evaluate_candidate(job_dir: Path, zone: str, run_name: str) -> dict:
    model_path = ROOT / "runs" / run_name / "weights" / "best.onnx"
    metadata_path = ROOT / "runs" / run_name / f"{run_name}_metadata.json"
    report_path = job_dir / "evaluation" / f"{zone.lower()}.json"
    if not model_path.is_file() or not metadata_path.is_file():
        raise RuntimeError(f"{zone} training did not produce candidate ONNX and metadata artifacts")
    command = [
        str(ROOT / ".venv" / "Scripts" / "python.exe"),
        str(ROOT / "scripts" / "evaluate_exhibit_candidate.py"),
        "--production-model", str(PRODUCTION_MODELS[zone]),
        "--production-metadata", str(PRODUCTION_MODELS[zone].with_name(f"{zone.lower()}_classifier_metadata.json")),
        "--candidate-model", str(model_path),
        "--candidate-metadata", str(metadata_path),
        "--test-dir", str(job_dir / "datasets" / zone / "val"),
        "--output", str(report_path),
        "--batch-size", os.environ.get("TAYLOR_EVAL_BATCH_SIZE", "2"),
        "--memory-limit-mb", os.environ.get("TAYLOR_EVAL_MEMORY_LIMIT_MB", str(memory_limit_mb())),
        "--memory-log", str(job_dir / "memory.log"),
    ]
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
    if not report_path.is_file():
        raise RuntimeError(f"{zone} evaluation did not produce a report")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["runner"] = {"command": command, "returncode": completed.returncode, "stderr": completed.stderr[-4000:]}
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def execute_training(job_dir: Path, zones: list[str], job_id: str, memory_limit: int) -> tuple[list[dict], list[list[str]], list[dict]]:
    datasets = prepare_datasets(job_dir, zones)
    results = []
    commands = []
    evaluations = []
    for zone in zones:
        run_name = f"exhibit_retraining_{zone.lower()}_{job_id}"
        command = training_command(zone, datasets[zone], run_name)
        commands.append(command)
        job_env = {**os.environ, "TAYLOR_MEMORY_LIMIT_MB": str(memory_limit), "TAYLOR_MEMORY_LOG": str(job_dir / "memory.log")}
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False, env=job_env)
        results.append({
            "zone": zone,
            "returncode": completed.returncode,
            "stdout": completed.stdout[-4000:],
            "stderr": completed.stderr[-4000:],
        })
        if completed.returncode != 0:
            raise RuntimeError(f"{zone} training failed with exit code {completed.returncode}")
        evaluations.append(evaluate_candidate(job_dir, zone, run_name))
    return results, commands, evaluations


def run_job(args: argparse.Namespace) -> int:
    args.output.mkdir(parents=True, exist_ok=True)
    lock = args.output / ".training.lock"
    global_lock = ROOT / "data" / "exhibit-retraining" / ".active-job.lock"
    state_path = args.output / "job-state.json"
    job_id = time.strftime("%Y%m%d-%H%M%S")
    memory_log = args.output / "memory.log"
    global_lock_acquired = False
    configure_cpu_threads()
    memory_snapshot("job_start", memory_log)
    try:
        lock.open("x").write(job_id)
    except FileExistsError:
        recovered = {"status": "recovered_existing_job", "job_id": job_id}
        state_path.write_text(json.dumps(recovered, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(recovered, indent=2))
        return 4
    try:
        global_lock.parent.mkdir(parents=True, exist_ok=True)
        global_lock.open("x").write(str(args.output))
        global_lock_acquired = True
    except FileExistsError:
        lock.unlink(missing_ok=True)
        recovered = {"status": "recovered_existing_job", "job_id": job_id, "reason": "another retraining job is active"}
        state_path.write_text(json.dumps(recovered, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(recovered, indent=2))
        return 4
    state = {"job_id": job_id, "status": "running", "production_model_changed": False, "started_at": time.time(), "memory_limit_mb": args.memory_limit_mb, "memory_log": str(memory_log)}
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    try:
        records = read_records(args.records)
        report = eligibility(records, args.minimum_per_class, args.minimum_sessions)
        report_path = args.output / "eligibility.json"
        report_path.write_text(json.dumps({key: value for key, value in report.items() if key != "records"}, indent=2) + "\n", encoding="utf-8")
        if not report["ready"]:
            state.update({"status": "blocked_insufficient_verified_data", "eligibility": str(report_path)})
            state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(state, indent=2))
            return 2
        staged = stage_examples(args.output / "candidate", report["records"])
        missing_datasets = sorted(zone for zone in report["eligible_zones"] if not (DATASETS[zone] / "train").is_dir() or not (DATASETS[zone] / "val").is_dir())
        missing_production_models = sorted(zone for zone in report["eligible_zones"] if not PRODUCTION_MODELS[zone].is_file())
        state.update({"status": "dry_run", "eligibility": str(report_path), "staged_examples": staged, "missing_original_datasets": missing_datasets, "missing_production_models": missing_production_models, "training_executed": False})
        if not args.dry_run:
            if missing_datasets:
                state["status"] = "blocked_missing_original_dataset"
            elif args.production_evaluator:
                raise RuntimeError("A production evaluator was requested, but no safe evaluator implementation is configured for these YOLO/ONNX models.")
            else:
                training_results, commands, evaluations = execute_training(args.output / "candidate", report["eligible_zones"], job_id, args.memory_limit_mb)
                evaluations_passed = all(item.get("quality_gate", {}).get("passed") is True for item in evaluations)
                state.update({"status": "READY_FOR_REVIEW" if evaluations_passed else "candidate_rejected", "training_executed": True, "training_commands": commands, "training_results": training_results, "evaluations": evaluations, "automatic_deployment": False})
        state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(state, indent=2))
        return 0 if args.dry_run or state["status"] == "READY_FOR_REVIEW" else 3
    except Exception as error:  # noqa: BLE001
        state.update({"status": "failed", "error": str(error), "recovered": True})
        state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(state, indent=2))
        return 1
    finally:
        lock.unlink(missing_ok=True)
        if global_lock_acquired:
            global_lock.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--records", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--minimum-per-class", type=int, default=8)
    parser.add_argument("--minimum-sessions", type=int, default=3)
    parser.add_argument("--production-evaluator", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--memory-limit-mb", type=int, default=memory_limit_mb())
    args = parser.parse_args()
    raise SystemExit(run_job(args))


if __name__ == "__main__":
    main()