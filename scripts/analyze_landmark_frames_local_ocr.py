"""Suggest indoor landmark labels from extracted frames using optional local OCR.

This script never edits review_manifest.csv. OpenCV is used only for image loading
and preprocessing; it is not treated as an OCR engine. If pytesseract and a
Tesseract executable are unavailable, every frame is recorded as needs_review.
"""

from __future__ import annotations

import csv
import argparse
import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

import cv2


ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
OUTPUT = WORK / "local_ocr_suggestions.json"
LABEL_PATTERNS = {
    "aricc": (r"\baricc\b",),
    "rio": (r"\brio\b",),
    "fablab": (r"fab\s*lab", r"fablab"),
    "caesar": (r"\bcaesar\b",),
    "recon": (r"\brecon\b",),
    "ovprei": (r"ovprei",),
    "olcpd_office": (r"olcpd",),
    "emh_department": (r"\bemh\b", r"emh\s+department"),
    "elevator_4f": (r"elevator", r"4\s*(?:th|f|floor)"),
    "elevator": (r"elevator",),
    "itso": (r"\bitso\b",),
    "iot_plaque": (r"internet\s+of\s+things", r"iot"),
}


def detect_ocr() -> tuple[Any | None, str | None, list[str]]:
    try:
        import pytesseract  # type: ignore
    except ImportError:
        return None, None, ["pytesseract Python module is not installed."]
    candidates = [
        shutil.which("tesseract"),
        shutil.which("tesseract.exe"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
    ]
    executable = next((candidate for candidate in candidates if candidate and Path(candidate).is_file()), None)
    if not executable:
        return None, None, ["Tesseract executable is not available on PATH."]
    pytesseract.pytesseract.tesseract_cmd = executable
    return pytesseract, executable, []


def preprocess(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enlarged = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    return cv2.threshold(enlarged, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]


def classify_text(text: str) -> tuple[str, str, str] | None:
    normalized = re.sub(r"\s+", " ", text.lower()).strip()
    if not normalized:
        return None
    if re.search(r"internet\s+of\s+things|\biot\b", normalized):
        return "iot_plaque", "high", "Recognized IoT wording in OCR text."
    if re.search(r"elevator", normalized) and re.search(r"4\s*(?:th|f|floor)", normalized):
        return "elevator_4f", "high", "Recognized elevator and fourth-floor wording in OCR text."
    for label, patterns in LABEL_PATTERNS.items():
        if all(re.search(pattern, normalized) for pattern in patterns):
            return label, "high", f"Recognized landmark text matching {label}."
    return None


def confidence_from_data(data: dict[str, Any]) -> str:
    try:
        confidence = float(data.get("conf", -1))
    except (TypeError, ValueError):
        return "uncertain"
    if confidence >= 80:
        return "high"
    if confidence >= 55:
        return "medium"
    return "low"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--indices", nargs="*", type=int, help="Manifest indices to process; defaults to every frame.")
    arguments = parser.parse_args()
    pytesseract, executable, availability_errors = detect_ocr()
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    selected_indices = arguments.indices if arguments.indices is not None else list(range(len(rows)))
    results = []
    for index in selected_indices:
        row = rows[index]
        result = {
            "manifest_index": index,
            "frame_path": row["frame_path"],
            "source_video": row["source_video"],
            "timestamp_seconds": row["timestamp_seconds"],
            "suggested_label": "unknown",
            "recognized_text": "",
            "ocr_confidence": None,
            "confidence": "uncertain",
            "review_status": "needs_review",
            "training_suitable": False,
            "visual_evidence": "No readable landmark text was established by local OCR.",
            "reason": "OCR unavailable; do not infer a landmark from a corridor, door, filename, or route position.",
            "engine": "none",
        }
        if pytesseract is not None:
            frame = cv2.imread(str(WORK.parent / row["frame_path"]))
            if frame is not None:
                try:
                    data = pytesseract.image_to_data(preprocess(frame), config="--psm 11", output_type=pytesseract.Output.DICT)
                    words = [word.strip() for word in data.get("text", []) if word.strip()]
                    recognized_text = " ".join(words)
                    result["recognized_text"] = recognized_text
                    confidences = [float(value) for value in data.get("conf", []) if str(value).strip() not in {"", "-1"}]
                    result["ocr_confidence"] = round(sum(confidences) / len(confidences), 2) if confidences else None
                    result["confidence"] = confidence_from_data({"conf": result["ocr_confidence"]})
                    match = classify_text(recognized_text)
                    if match and result["confidence"] in {"high", "medium"}:
                        label, label_confidence, reason = match
                        result.update({
                            "suggested_label": label,
                            "confidence": label_confidence if result["confidence"] == "high" else "medium",
                            "review_status": "local_ocr_suggested_pending_human_review",
                            "training_suitable": result["confidence"] == "high",
                            "visual_evidence": f"OCR recognized: {recognized_text}",
                            "reason": reason,
                            "engine": f"pytesseract + {executable}",
                        })
                    elif recognized_text:
                        result["visual_evidence"] = f"OCR text did not match an approved landmark: {recognized_text}"
                        result["reason"] = "Recognized text is insufficient or does not identify an approved landmark."
                        result["engine"] = f"pytesseract + {executable}"
                except Exception as error:  # OCR failures remain reviewable, not approved.
                    result["reason"] = f"Local OCR failed for this frame: {error}"
        results.append(result)
        if len(results) % 50 == 0 or len(results) == len(selected_indices):
            print(f"Processed {len(results)}/{len(selected_indices)}")

    output = {
        "status": "complete",
        "analysis_type": "local_ocr_only",
        "vision_understanding_equivalent": False,
        "ocr_available": pytesseract is not None,
        "ocr_engine": executable,
        "ocr_executable_size_bytes": Path(executable).stat().st_size if executable else 0,
        "availability_notes": availability_errors,
        "source_manifest": "review_manifest.csv",
        "source_review_notes_used": False,
        "source_videos_available": len({row["source_video"] for row in rows}),
        "frames_processed": len(results),
        "counts": {
            "confident_suggestions": sum(item["confidence"] == "high" and item["suggested_label"] != "unknown" for item in results),
            "uncertain_frames": sum(item["review_status"] == "needs_review" for item in results),
            "training_suitable_candidates": sum(item["training_suitable"] for item in results),
        },
        "policy": {
            "suggestions_do_not_change_manifest": True,
            "human_approval_required": True,
            "generic_views_are_unknown": True,
            "unknown_and_rejected_excluded_from_training": True,
        },
        "suggestions": results,
    }
    arguments.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(arguments.output), **output["counts"]}, indent=2))


if __name__ == "__main__":
    main()