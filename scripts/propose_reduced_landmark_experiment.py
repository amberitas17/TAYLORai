"""Create a reduced landmark experiment proposal from the approved audit and split."""

from __future__ import annotations

import csv
import json
import random
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
AUDIT = WORK / "landmark_label_audit.json"
ORIGINAL_PROPOSAL = WORK / "landmark_split_proposal.json"
OUTPUT = ROOT / "runs" / "landmark_reduced_experiment"
PROPOSAL = OUTPUT / "reduced_landmark_split_proposal.json"
CSV_OUTPUT = OUTPUT / "reduced_landmark_split_proposal.csv"

# Priority targets are retained only when they pass the same evidence gate below.
PRIORITY = {"aricc", "entrance_aricc", "rio", "entrance_rio", "fablab", "entrance_fablab", "caesar", "entrance_caesar", "recon", "recon_entrance"}
CONFUSION_RISK_FAMILIES = [
    ["aricc", "entrance_aricc"],
    ["rio", "entrance_rio"],
    ["fablab", "entrance_fablab"],
    ["caesar", "entrance_caesar"],
    ["ovprei", "entrance_ovprei"],
    ["4f_hallway", "stairs_to_3f"],
]


def load():
    rows = list(csv.DictReader(MANIFEST.open(newline="", encoding="utf-8")))
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))["labels"]
    original = json.loads(ORIGINAL_PROPOSAL.read_text(encoding="utf-8"))
    return rows, audit, original


def passes_gate(label, rows, original):
    train_videos = set(original["train_source_videos"])
    validation_videos = set(original["validation_source_videos"])
    label_rows = [row for row in rows if row["label"] == label]
    train_rows = [row for row in label_rows if row["source_video"] in train_videos]
    validation_rows = [row for row in label_rows if row["source_video"] in validation_videos]
    validation_sources = {row["source_video"] for row in validation_rows}
    # This is exactly the existing preflight coverage gate: both splits, no
    # one-video validation set with <= 4 frames.
    return bool(train_rows and validation_rows) and not (len(validation_sources) == 1 and len(validation_rows) <= 4)


def choose_splits(rows, selected, original):
    videos = sorted({row["source_video"] for row in rows if row["label"] in selected})
    video_labels = defaultdict(set)
    video_frame_counts = defaultdict(lambda: defaultdict(int))
    for row in rows:
        if row["label"] in selected:
            video_labels[row["label"]].add(row["source_video"])
            video_frame_counts[row["source_video"]][row["label"]] += 1
    candidates = [(set(original["train_source_videos"]), set(original["validation_source_videos"]))]
    rng = random.Random(20261008)
    for _ in range(100000):
        order = list(videos)
        rng.shuffle(order)
        cut = max(1, min(len(order) - 1, round(len(order) * 0.7)))
        train = set(order[:cut])
        validation = set(order[cut:])
        candidates.append((train, validation))
    best = None
    for train, validation in candidates:
        coverage = {}
        valid = True
        for label in selected:
            train_videos = video_labels[label] & train
            val_videos = video_labels[label] & validation
            train_frames = sum(video_frame_counts[video][label] for video in train_videos)
            val_frames = sum(video_frame_counts[video][label] for video in val_videos)
            coverage[label] = {"train_videos": sorted(train_videos), "validation_videos": sorted(val_videos), "train_frames": train_frames, "validation_frames": val_frames}
            if not train_videos or not val_videos or (len(val_videos) == 1 and val_frames <= 4):
                valid = False
        score = (sum(bool(value["train_videos"]) and bool(value["validation_videos"]) for value in coverage.values()), min(sum(value["train_frames"] for value in coverage.values()), sum(value["validation_frames"] for value in coverage.values())))
        if best is None or score > best[0]:
            best = (score, train, validation, coverage)
        if valid:
            return train, validation, coverage
    raise RuntimeError("No reduced source-video split satisfies the existing preflight gate.")


def main():
    rows, audit, original = load()
    original_selected = set(original["selected_classes"])
    passing = {label for label in original_selected if passes_gate(label, rows, original)}
    selected = sorted(passing)
    train, validation, coverage = choose_splits(rows, selected, original)
    risks = []
    for family in CONFUSION_RISK_FAMILIES:
        present = [label for label in family if label in selected]
        if len(present) > 1:
            risks.append({"labels": present, "reason": "Related destination/entrance or scene semantics; inspect jointly during evaluation."})
    proposal = {
        "status": "proposal_only",
        "manifest_modified": False,
        "source_manifest": "review_manifest.csv",
        "source_audit": "landmark_label_audit.json",
        "source_original_proposal": "landmark_split_proposal.json",
        "selection_rule": "Retain only original proposal classes with at least 5 total frames and at least 2 source videos; recalculate the split so no class has <=4 validation frames from one video.",
        "priority_targets": sorted(PRIORITY),
        "priority_targets_retained": sorted(PRIORITY & set(selected)),
        "priority_targets_rejected": sorted(PRIORITY - set(selected)),
        "selected_classes": selected,
        "excluded_from_reduced_proposal": sorted(set(audit) - set(selected)),
        "train_source_videos": sorted(train),
        "validation_source_videos": sorted(validation),
        "video_overlap": sorted(train & validation),
        "class_coverage": coverage,
        "confusion_risks": risks,
        "recon_status": "No RECON label passes the evidence gate; additional independent RECON recordings are required.",
        "approval_required_before_training": True,
        "training_started": False,
        "onnx_exported": False,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PROPOSAL.write_text(json.dumps(proposal, indent=2) + "\n", encoding="utf-8")
    with CSV_OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source_video", "split"])
        writer.writeheader()
        writer.writerows([{"source_video": video, "split": "train" if video in train else "val"} for video in sorted(train | validation)])
    print(json.dumps({"proposal": str(PROPOSAL), "selected_classes": selected, "train_videos": len(train), "validation_videos": len(validation), "priority_retained": proposal["priority_targets_retained"], "priority_rejected": proposal["priority_targets_rejected"], "video_overlap": proposal["video_overlap"]}, indent=2))


if __name__ == "__main__":
    main()
