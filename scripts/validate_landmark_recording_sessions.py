"""Validate reviewed new landmark sessions and propose a held-out test split."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
SESSION_ROOT = WORK / "incoming_landmark_sessions"
ORIGINAL_MANIFEST = WORK / "review_manifest.csv"
OUTPUT = ROOT / "runs" / "landmark_recording_validation"
FIELDS = ["frame_path", "source_video", "source_type", "frame_index", "timestamp_seconds", "label", "review_status", "split", "review_notes"]


def read_rows(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sessions-root", type=Path, default=SESSION_ROOT)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    original_rows = read_rows(ORIGINAL_MANIFEST)
    session_manifests = sorted(args.sessions_root.glob("*/review_manifest.csv"))
    new_rows = [row for manifest in session_manifests for row in read_rows(manifest)]
    labels = sorted({row["label"] for row in original_rows if row["label"] not in {"", "unknown"}})
    reviewed = [row for row in new_rows if row.get("review_status") == "reviewed"]
    pending = [row for row in new_rows if row.get("review_status") != "reviewed"]
    invalid_labels = sorted({row["label"] for row in reviewed if row["label"] not in labels and row["label"] != "unknown"})
    missing_files = [row["frame_path"] for row in new_rows if not (WORK.parent / row["frame_path"]).exists()]
    source_video_sessions = defaultdict(set)
    for row in new_rows:
        source_video_sessions[row["source_video"].split("__", 1)[0]].add(row["source_video"])
    coverage = {}
    for label in labels:
        label_rows = [row for row in reviewed if row["label"] == label]
        coverage[label] = {"new_reviewed_frames": len(label_rows), "new_source_videos": sorted({row["source_video"] for row in label_rows}), "new_source_video_count": len({row["source_video"] for row in label_rows}), "new_sessions": sorted({row["source_video"].split("__", 1)[0] for row in label_rows})}
    test_sessions = sorted({row["source_video"].split("__", 1)[0] for row in reviewed})
    proposal = {"status": "proposal_only", "manifest_modified": False, "original_manifest": str(ORIGINAL_MANIFEST), "new_session_manifests": [str(path) for path in session_manifests], "original_validation_preserved": True, "train_source_videos": "Retain approved original train videos until a new proposal is approved.", "validation_source_videos": "Retain approved original validation videos until a new proposal is approved.", "held_out_test_sessions": test_sessions, "held_out_test_policy": "Keep all reviewed new-session videos out of the original validation set; select a complete session for held-out test after coverage review.", "coverage": coverage}
    report = {"status": "ready_for_review" if not invalid_labels and not missing_files and not pending else "needs_review", "original_rows": len(original_rows), "new_session_count": len(session_manifests), "new_rows": len(new_rows), "new_reviewed_rows": len(reviewed), "pending_rows": len(pending), "unknown_rows": sum(row["label"] == "unknown" for row in reviewed), "invalid_labels": invalid_labels, "missing_files": missing_files, "session_source_video_counts": {session: len(videos) for session, videos in sorted(source_video_sessions.items())}, "held_out_test_sessions": test_sessions, "split_proposal": str(args.output / "new_video_split_proposal.json"), "manual_actions": ["Confirm every pending frame in the session review interface.", "Inspect contact sheets for sign visibility and ambiguous corridor views.", "Choose at least one complete reviewed session as held-out test.", "Approve a new source-video split before training."], "manifest_modified": False}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "new_video_split_proposal.json").write_text(json.dumps(proposal, indent=2) + "\n", encoding="utf-8")
    (args.output / "session_validation_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
