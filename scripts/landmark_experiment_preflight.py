"""Preflight an approved video-disjoint landmark experiment and create contact sheets."""

from __future__ import annotations

import csv
import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
AUDIT = WORK / "landmark_label_audit.json"
PROPOSAL = WORK / "landmark_split_proposal.json"
OUTPUT = ROOT / "runs" / "landmark_experiment_preflight"
CONTACT = OUTPUT / "contact_sheets"


def load(proposal_path=PROPOSAL):
    rows = list(csv.DictReader(MANIFEST.open(newline="", encoding="utf-8")))
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    proposal = json.loads(proposal_path.read_text(encoding="utf-8"))
    return rows, audit, proposal


def image_path(row):
    return WORK.parent / row["frame_path"]


def representative(rows, limit=24):
    if len(rows) <= limit:
        return rows
    step = (len(rows) - 1) / (limit - 1)
    return [rows[round(index * step)] for index in range(limit)]


def make_contact_sheets(rows, selected, contact_root=CONTACT):
    by_label = defaultdict(list)
    for row in rows:
        if row["label"] in selected:
            by_label[row["label"]].append(row)
    contact_root.mkdir(parents=True, exist_ok=True)
    for label, label_rows in sorted(by_label.items()):
        chosen = representative(label_rows)
        columns = 6
        cell_w, cell_h = 220, 280
        sheet = Image.new("RGB", (columns * cell_w, math.ceil(len(chosen) / columns) * cell_h), "white")
        draw = ImageDraw.Draw(sheet)
        for index, row in enumerate(chosen):
            path = image_path(row)
            image = Image.open(path).convert("RGB")
            image.thumbnail((200, 225))
            x = (index % columns) * cell_w + (cell_w - image.width) // 2
            y = (index // columns) * cell_h + 4
            sheet.paste(image, (x, y))
            caption = f"{row['source_video']}\n{row['timestamp_seconds']}s"
            draw.multiline_text(((index % columns) * cell_w + 5, y + image.height + 5), caption, fill="black")
        sheet.save(contact_root / f"{label}.jpg", quality=92)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proposal", type=Path, default=PROPOSAL)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    output = args.output
    contact_root = output / "contact_sheets"
    rows, audit, proposal = load(args.proposal)
    selected = set(proposal["selected_classes"])
    train_videos = set(proposal["train_source_videos"])
    val_videos = set(proposal["validation_source_videos"])
    selected_rows = [row for row in rows if row["label"] in selected]
    train_rows = [row for row in selected_rows if row["source_video"] in train_videos]
    val_rows = [row for row in selected_rows if row["source_video"] in val_videos]
    video_sets = {"train": {row["source_video"] for row in train_rows}, "validation": {row["source_video"] for row in val_rows}}
    by_label = defaultdict(list)
    for row in selected_rows:
        by_label[row["label"]].append(row)
    hashes = defaultdict(list)
    for row in selected_rows:
        path = image_path(row)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes[digest].append(row)
    duplicate_groups = [items for items in hashes.values() if len(items) > 1]
    class_counts = {}
    for label in sorted(selected):
        label_rows = by_label[label]
        class_counts[label] = {
            "train_frames": sum(row in train_rows for row in label_rows),
            "validation_frames": sum(row in val_rows for row in label_rows),
            "total_frames": len(label_rows),
            "train_videos": sorted({row["source_video"] for row in label_rows if row["source_video"] in train_videos}),
            "validation_videos": sorted({row["source_video"] for row in label_rows if row["source_video"] in val_videos}),
        }
    make_contact_sheets(selected_rows, selected, contact_root)
    critical = []
    if video_sets["train"] & video_sets["validation"]:
        critical.append("Source-video overlap exists between train and validation.")
    for label, counts in class_counts.items():
        if not counts["train_frames"] or not counts["validation_frames"]:
            critical.append(f"{label} is missing a train or validation frame.")
        if len(counts["validation_videos"]) == 1 and counts["validation_frames"] <= 4:
            critical.append(f"{label} has weak validation coverage: {counts['validation_frames']} frame(s) from one video.")
    result = {
        "status": "critical_issue" if critical else "passed_with_risks",
        "manifest_modified": False,
        "rows": len(rows),
        "selected_classes": sorted(selected),
        "class_counts": class_counts,
        "train_video_count": len(video_sets["train"]),
        "validation_video_count": len(video_sets["validation"]),
        "video_overlap": sorted(video_sets["train"] & video_sets["validation"]),
        "duplicate_image_hash_groups": [[item["frame_path"] for item in group] for group in duplicate_groups],
        "class_imbalance": {"largest_class": max(class_counts, key=lambda label: class_counts[label]["train_frames"] + class_counts[label]["validation_frames"]), "smallest_class": min(class_counts, key=lambda label: class_counts[label]["train_frames"] + class_counts[label]["validation_frames"])},
        "contact_sheets": str(contact_root),
        "critical_issues": critical,
        "visual_review_required": True,
        "note": "Embedding groups and image hashes identify candidates only; semantic label correctness requires human review of the contact sheets.",
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "preflight.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
