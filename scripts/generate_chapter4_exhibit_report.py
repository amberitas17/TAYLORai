"""Generate Chapter 4 exhibit-recognition evaluation exports from recorded runs."""

from __future__ import annotations

import csv
import hashlib
import json
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / "public" / "models"
QA_PATH = ROOT / "Documentation" / "video_detection_qa_results.json"
CAESAR_PATH = ROOT / "runs" / "caesar_controlled_experiment_v4" / "evaluation.json"
CSV_PATH = ROOT / "Documentation" / "chapter4_exhibit_evaluation.csv"
MD_PATH = ROOT / "Documentation" / "chapter4_exhibit_evaluation.md"
ZONES = ("ARICC", "RECON", "FABLAB", "CAESAR")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def model_evidence(zone: str) -> dict:
    stem = zone.lower()
    model = MODEL_ROOT / stem / f"{stem}_classifier.onnx"
    metadata_path = MODEL_ROOT / stem / f"{stem}_classifier_metadata.json"
    metadata = load_json(metadata_path)
    return {
        "model_path": str(model.relative_to(ROOT)).replace("\\", "/"),
        "metadata_path": str(metadata_path.relative_to(ROOT)).replace("\\", "/"),
        "model_name": metadata.get("model_name") or Path(metadata.get("onnx", "")).parent.parent.name or "not declared",
        "model_sha256": sha256(model),
        "metadata_sha256": sha256(metadata_path),
        "classes": metadata.get("displayNames") or metadata.get("classes") or [],
        "asset_version": "20261010-recon-13class-v1",
    }


def empty_counts() -> dict:
    return {"total": 0, "correct": 0, "incorrect": 0, "unknown": 0}


def qa_counts(rows: list[dict], approved_only: bool) -> dict:
    selected = [row for row in rows if not approved_only or row.get("approved_ground_truth")]
    counts = empty_counts()
    counts["total"] = len(selected)
    counts["unknown"] = sum(row["predicted"] == "UNKNOWN" for row in selected)
    counts["correct"] = sum(row["predicted"] != "UNKNOWN" and row["predicted"] == row["expected"] for row in selected)
    counts["incorrect"] = counts["total"] - counts["correct"] - counts["unknown"]
    return counts


def binary_metrics(rows: list[dict], labels: list[str]) -> tuple[dict, list[list[int]]]:
    matrix = [[0 for _ in labels] for _ in labels]
    label_index = {label: index for index, label in enumerate(labels)}
    for row in rows:
        actual = label_index.get(row.get("expected"))
        predicted = label_index.get(row.get("predicted"))
        if actual is not None and predicted is not None:
            matrix[actual][predicted] += 1
    per_class = {}
    for index, label in enumerate(labels):
        tp = matrix[index][index]
        support = sum(matrix[index])
        predicted = sum(matrix[row][index] for row in range(len(labels)))
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {"precision": precision, "recall": recall, "f1": f1, "support": support}
    total = sum(sum(row) for row in matrix)
    correct = sum(matrix[index][index] for index in range(len(labels)))
    macro = lambda key: sum(item[key] for item in per_class.values()) / len(labels) if labels else 0.0
    return {
        "accuracy": correct / total if total else None,
        "macro_precision": macro("precision"),
        "macro_recall": macro("recall"),
        "macro_f1": macro("f1"),
        "per_class": per_class,
    }, matrix


def format_metric(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.4f}"


def main() -> None:
    qa = load_json(QA_PATH)["results"]
    caesar = load_json(CAESAR_PATH)["baseline"]
    rows_by_zone = defaultdict(list)
    for row in qa:
        rows_by_zone[row["zone"]].append(row)

    recon_rows = [row for row in rows_by_zone["RECON"] if row.get("approved_ground_truth")]
    recon_labels = sorted({row["expected"] for row in recon_rows})
    recon_metrics, recon_matrix = binary_metrics(recon_rows, recon_labels)

    caesar_rows = caesar["rows"]
    caesar_counts = {
        "total": len(caesar_rows),
        "correct": sum(row["accepted"] and row["prediction"] == row["expected"] for row in caesar_rows),
        "incorrect": sum(row["accepted"] and row["prediction"] != row["expected"] for row in caesar_rows),
        "unknown": sum(not row["accepted"] for row in caesar_rows),
    }

    counts = {
        "ARICC": qa_counts(rows_by_zone["ARICC"], False),
        "RECON": qa_counts(rows_by_zone["RECON"], True),
        "FABLAB": qa_counts(rows_by_zone["FABLAB"], False),
        "CAESAR": caesar_counts,
    }
    eligibility = {
        "ARICC": ("NOT VALIDATED", "Filename-derived smoke-test labels; no approved independent test manifest."),
        "RECON": ("VALIDATED SUBSET", "Approved labels and spatial crop annotations; sampled frames, not full-video accuracy."),
        "FABLAB": ("NOT VALIDATED", "Filename-derived smoke-test labels; selected BCN3d source has no independent split."),
        "CAESAR": ("PARTIAL VALIDATION", "Source-disjoint validation run; 6 of 19 classes covered and 12/24 rejected as UNKNOWN."),
    }
    metrics = {
        "RECON": recon_metrics,
        "CAESAR": {"accuracy": caesar["accuracy"]},
    }

    evidence = {zone: model_evidence(zone) for zone in ZONES}
    branch = git("branch", "--show-current")
    commit = git("rev-parse", "HEAD")
    generated = datetime.now(timezone.utc).isoformat()

    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "center", "status", "total_test_images", "correct_predictions", "incorrect_predictions",
            "unknown_results", "application_accuracy", "raw_top1_accuracy", "macro_precision", "macro_recall",
            "macro_f1", "model_name", "model_sha256", "metadata_sha256", "model_path", "evidence_note",
        ])
        writer.writeheader()
        for zone in ZONES:
            zone_metrics = metrics.get(zone, {})
            writer.writerow({
                "center": zone,
                "status": eligibility[zone][0],
                "total_test_images": counts[zone]["total"],
                "correct_predictions": counts[zone]["correct"],
                "incorrect_predictions": counts[zone]["incorrect"],
                "unknown_results": counts[zone]["unknown"],
                "application_accuracy": format_metric(counts[zone]["correct"] / counts[zone]["total"] if counts[zone]["total"] else None),
                "raw_top1_accuracy": format_metric(zone_metrics.get("accuracy")),
                "macro_precision": format_metric(zone_metrics.get("macro_precision")),
                "macro_recall": format_metric(zone_metrics.get("macro_recall")),
                "macro_f1": format_metric(zone_metrics.get("macro_f1")),
                "model_name": evidence[zone]["model_name"],
                "model_sha256": evidence[zone]["model_sha256"],
                "metadata_sha256": evidence[zone]["metadata_sha256"],
                "model_path": evidence[zone]["model_path"],
                "evidence_note": eligibility[zone][1],
            })

    lines = [
        "# Chapter 4 Exhibit Recognition Evaluation",
        "",
        f"Generated: `{generated}`  ",
        f"Branch: `{branch}`  ",
        f"Commit used: `{commit}`  ",
        "",
        "This report evaluates the deployed local ONNX assets without retraining or changing them. Accuracy claims are restricted to labeled evidence identified as approved or source-disjoint in repository artifacts. Filename-derived smoke tests are reported as execution evidence only.",
        "",
        "## Summary",
        "",
        "| Center | Status | Test images | Correct | Incorrect | UNKNOWN | Application accuracy | Raw top-1 accuracy | Macro precision | Macro recall | Macro F1 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for zone in ZONES:
        zone_metrics = metrics.get(zone, {})
        application_accuracy = counts[zone]["correct"] / counts[zone]["total"] if counts[zone]["total"] else None
        lines.append(
            f"| {zone} | {eligibility[zone][0]} | {counts[zone]['total']} | {counts[zone]['correct']} | {counts[zone]['incorrect']} | {counts[zone]['unknown']} | {format_metric(application_accuracy)} | {format_metric(zone_metrics.get('accuracy'))} | {format_metric(zone_metrics.get('macro_precision'))} | {format_metric(zone_metrics.get('macro_recall'))} | {format_metric(zone_metrics.get('macro_f1'))} |"
        )
    lines += [
        "",
        "Application accuracy counts an accepted prediction equal to the labeled target. A rejected prediction is reported as UNKNOWN. Raw top-1 accuracy ignores the acceptance threshold and is included only where the source artifact recorded raw predictions.",
        "",
        "## Models",
        "",
        "| Center | Model name | ONNX asset | ONNX SHA-256 | Metadata SHA-256 | Classes |",
        "|---|---|---|---|---|---:|",
    ]
    for zone in ZONES:
        item = evidence[zone]
        lines.append(f"| {zone} | `{item['model_name']}` | `{item['model_path']}` | `{item['model_sha256']}` | `{item['metadata_sha256']}` | {len(item['classes'])} |")
    lines += [
        "",
        "All four specialist assets use the runtime cache/version identifier `20261010-recon-13class-v1`. The per-model metadata is the authoritative class and preprocessing declaration.",
        "",
        "## Confusion Matrices",
        "",
        "### RECON approved subset",
        "",
        "Rows are expected labels and columns are raw top-1 labels; the subset contains three Fluke 971 frames and six Fluke 2042 frames/crops.",
        "",
        "| Expected \\ Predicted | " + " | ".join(recon_labels) + " |",
        "|---|" + "---:|" * len(recon_labels),
    ]
    for label, row in zip(recon_labels, recon_matrix):
        lines.append(f"| {label} | " + " | ".join(str(value) for value in row) + " |")
    lines += [
        "",
        "### CAESAR source-disjoint run",
        "",
        "The source artifact reports 24 validation images from six covered classes and raw top-1 accuracy of 22/24. Its stored per-row predictions do not reconcile to that aggregate accuracy, so a detailed raw confusion matrix is intentionally not exported. The application-level outcome remains 12 accepted correct results and 12 UNKNOWN results.",
        "",
        "Confusion matrix: **not available from the recorded artifact**. Exporting a diagonal matrix would be misleading.",
    ]
    lines += [
        "",
        "## Dataset And Evaluation Scope",
        "",
        "- RECON: `Documentation/video_detection_qa_results.json`; nine approved samples, including three approved spatial crops. This is a labeled sampled subset, not a full-video estimate.",
        "- CAESAR: `runs/caesar_controlled_experiment_v4/evaluation.json`; 24 source-disjoint validation images, six of 19 model classes represented. The recorded raw accuracy is 22/24 (0.9167), with 12/24 accepted and zero false acceptances.",
        "- ARICC: three current harness frames matched the filename-derived `Robotic Arm` label, but the selected source is not an approved independent test set. No accuracy claim is made.",
        "- FABLAB: three current harness frames matched the filename-derived `BCN3d` label, but the selected source is not independent of training. No accuracy claim is made.",
        "- No approved labeled UNKNOWN/background set was found for these four specialist classifiers; UNKNOWN rejection precision/recall and false-acceptance rate cannot be completed.",
        "",
        "## QA Coverage",
        "",
        "| QA area | Evidence | Result |",
        "|---|---|---|",
        "| Model loading | `Documentation/TAYLOR_VIDEO_DETECTION_QA.md`, current harness run | PASS locally for all four ONNX assets; no model changes |",
        "| Recognition confidence | Current harness JSON records confidence, margin, acceptance, and latency per sample | PASS locally; CAESAR smoke samples were rejected below the 0.80 confidence threshold |",
        "| Error handling | `src/services/exhibitDetectionService.js` and QA report | Local load timeout/retry/cache/error states are implemented and exercised; production upload accuracy remains untested due to asset mismatch |",
        "| Mobile compatibility | `Documentation/MOBILE_DEVICE_TEST_PLAN.md` | NOT COMPLETED; physical Android/iPhone evidence is absent |",
        "| Production parity | `Documentation/TAYLOR_VIDEO_DETECTION_QA.md` | BLOCKED; production RECON asset metadata differs from local Fluke 971 model |",
        "",
        "## Limitations",
        "",
        "No deployed model, metadata, threshold, or training artifact was modified. The report does not replace the missing independent ARICC/FABLAB/CAESAR full-class test manifests or physical-device QA. The repository’s recorded RECON metadata includes prior training/validation metrics, but this report uses only the independently executed current harness subset for its RECON result.",
    ]
    MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"csv": str(CSV_PATH), "markdown": str(MD_PATH), "branch": branch, "commit": commit}, indent=2))


if __name__ == "__main__":
    main()