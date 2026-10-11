"""Audit reviewed landmark labels and propose whole-video train/validation splits."""

from __future__ import annotations

import csv
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
AUDIT_JSON = WORK / "landmark_label_audit.json"
AUDIT_MD = WORK / "landmark_label_audit.md"
SPLIT_JSON = WORK / "landmark_split_proposal.json"
SPLIT_CSV = WORK / "landmark_split_proposal.csv"
GROUPS = WORK / "visual_similarity_groups.json"

CATEGORIES = {
    "trainable_visual_landmark": {
        "aricc", "caesar", "cit_entrance", "door_near_caesar", "emh_department", "entrance_aricc",
        "entrance_caesar", "entrance_fablab", "entrance_ovprei", "entrance_rio",
        "fablab", "olcpd_office", "ovprei", "recon", "recon_entrance", "rio",
    },
    "distinctive_navigation_scene": {
        "4f_hallway", "eec_hallway", "elevator_1f", "elevator_4f", "first_floor_stairs",
        "restroom", "small_opening", "stairs_to_3f", "stairs_to_4f",
    },
    "route_cue_or_transition": {
        "aricc_to_ovprei", "aricc_to_rio", "emh_bulletin_to_small_opening",
        "fablab_to_rio", "fablab_to_stairs", "hallway_to_caesar", "hallway_to_fablab",
        "hallway_to_restroom", "pot_near_fablab", "restroom_to_recon", "rio_to_aricc",
        "rio_to_fablab", "way_near_itso", "window_near_bathroom",
    },
    "unknown_or_unsuitable_for_training": {"unknown"},
}

DUPLICATE_FAMILIES = [
    ["aricc", "entrance_aricc"], ["caesar", "entrance_caesar"],
    ["fablab", "entrance_fablab"], ["ovprei", "entrance_ovprei"],
    ["rio", "entrance_rio"], ["recon", "recon_entrance"],
    ["elevator_1f", "elevator_4f"], ["4f_hallway", "hallway_to_caesar", "hallway_to_fablab"],
    ["stairs_to_3f", "stairs_to_4f", "first_floor_stairs"],
]


def load_rows():
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def summarize(rows):
    by_label = defaultdict(list)
    for row in rows:
        by_label[row["label"]].append(row)
    groups = json.loads(GROUPS.read_text(encoding="utf-8")) if GROUPS.exists() else {"groups": []}
    group_by_index = {}
    for group in groups.get("groups", []):
        for index in group["manifest_indexes"]:
            group_by_index[int(index)] = group
    output = {}
    for label, label_rows in sorted(by_label.items()):
        videos = sorted({row["source_video"] for row in label_rows})
        times = [float(row["timestamp_seconds"]) for row in label_rows]
        group_ids = {group_by_index[index]["group_id"] for index, row in enumerate(rows) if row["label"] == label and index in group_by_index}
        category = next((name for name, labels in CATEGORIES.items() if label in labels), "unclassified")
        output[label] = {
            "label": label,
            "category": category,
            "frames": len(label_rows),
            "reviewed_frames": sum(row["review_status"] == "reviewed" for row in label_rows),
            "source_video_count": len(videos),
            "source_videos": videos,
            "timestamp_start": min(times),
            "timestamp_end": max(times),
            "timestamp_span_seconds": round(max(times) - min(times), 2),
            "visual_group_count": len(group_ids),
            "can_have_video_disjoint_validation": len(videos) >= 2,
            "notes": [],
        }
        if len(videos) == 1:
            output[label]["notes"].append("Only one source video; cannot appear in both video-disjoint splits.")
        if len(label_rows) < 5:
            output[label]["notes"].append("Very small frame count; inspect for duplication and over-specific labeling.")
        if category == "route_cue_or_transition":
            output[label]["notes"].append("Route/transition state, not a destination landmark class without separate policy approval.")
        if label == "unknown":
            output[label]["notes"].append("Retain for audit and negatives; exclude from positive training classes.")
    return output


def choose_split(video_to_labels, selected_labels, videos):
    rng = random.Random(42)
    best = None
    for _ in range(100000):
        shuffled = list(videos)
        rng.shuffle(shuffled)
        cut = max(1, min(len(shuffled) - 1, round(len(shuffled) * 0.7)))
        train = set(shuffled[:cut])
        validation = set(shuffled[cut:])
        valid_classes = sum(bool(video_to_labels[label] & train) and bool(video_to_labels[label] & validation) for label in selected_labels)
        balance = min(sum(len(video_to_labels[label] & train) for label in selected_labels), sum(len(video_to_labels[label] & validation) for label in selected_labels))
        score = (valid_classes, balance, -abs(len(train) - len(validation)))
        if best is None or score > best[0]:
            best = (score, train, validation)
        if valid_classes == len(selected_labels):
            break
    return best[1], best[2], best[0]


def write_split(rows, audit):
    selected = sorted(label for label, item in audit.items() if item["category"] in {"trainable_visual_landmark", "distinctive_navigation_scene"} and item["source_video_count"] >= 2 and item["frames"] >= 5)
    video_to_labels = defaultdict(set)
    for label in selected:
        for video in audit[label]["source_videos"]:
            video_to_labels[label].add(video)
    videos = sorted({row["source_video"] for row in rows})
    train, validation, score = choose_split(video_to_labels, selected, videos)
    assignments = [{"source_video": video, "split": "train" if video in train else "val"} for video in videos]
    class_coverage = {}
    for label in selected:
        class_coverage[label] = {
            "train_videos": sorted(video_to_labels[label] & train),
            "validation_videos": sorted(video_to_labels[label] & validation),
            "train_frames": sum(row["label"] == label and row["source_video"] in train for row in rows),
            "validation_frames": sum(row["label"] == label and row["source_video"] in validation for row in rows),
        }
    proposal = {
        "status": "proposal_only",
        "manifest_modified": False,
        "source_manifest": "review_manifest.csv",
        "source_video_count": len(videos),
        "selected_classes": selected,
        "excluded_classes": sorted(set(audit) - set(selected)),
        "split_objective": "Every selected class must have at least one source video in train and validation; all frames from a source video stay together.",
        "train_source_videos": sorted(train),
        "validation_source_videos": sorted(validation),
        "video_overlap": sorted(train & validation),
        "class_coverage": class_coverage,
        "score": {"classes_with_both_splits": score[0], "selected_class_count": len(selected)},
        "assignments": assignments,
    }
    SPLIT_JSON.write_text(json.dumps(proposal, indent=2) + "\n", encoding="utf-8")
    with SPLIT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source_video", "split"])
        writer.writeheader()
        writer.writerows(assignments)
    return proposal


def markdown(audit, proposal, rows):
    category_names = {
        "trainable_visual_landmark": "Trainable visual landmark",
        "distinctive_navigation_scene": "Distinctive navigation scene",
        "route_cue_or_transition": "Route cue or transition metadata",
        "unknown_or_unsuitable_for_training": "Unknown or unsuitable for training",
        "unclassified": "Unclassified",
    }
    lines = ["# TAYLOR Landmark Label Audit", "", "Status: proposal only; the manifest was not modified.", "", f"- Manifest rows: {len(rows)}", f"- Reviewed rows: {sum(row['review_status'] == 'reviewed' for row in rows)}", f"- Distinct labels: {len(audit)}", "", "## Full Label Audit", "", "| Label | Category | Frames | Source videos | Timestamp span | Groups | Validation possible |", "|---|---|---:|---:|---:|---:|---|"]
    for label, item in audit.items():
        lines.append(f"| `{label}` | {category_names[item['category']]} | {item['frames']} | {item['source_video_count']} | {item['timestamp_span_seconds']}s | {item['visual_group_count']} | {'yes' if item['can_have_video_disjoint_validation'] else 'no'} |")
    lines += ["", "## Category Summary", ""]
    for category in category_names:
        members = [label for label, item in audit.items() if item["category"] == category]
        if members:
            lines.append(f"- **{category_names[category]}** ({len(members)}): {', '.join(f'`{label}`' for label in members)}")
    lines += ["", "## Overlap and Ambiguity Flags", "", "These are audit findings only. No labels were renamed, merged, or deleted."]
    for family in DUPLICATE_FAMILIES:
        present = [label for label in family if label in audit]
        if len(present) > 1:
            lines.append(f"- Potential overlap family: {', '.join(f'`{label}`' for label in present)}")
    lines += ["", "## Proposed Split", "", f"- Selected classes: {len(proposal['selected_classes'])}", f"- Train videos ({len(proposal['train_source_videos'])}): {', '.join(proposal['train_source_videos'])}", f"- Validation videos ({len(proposal['validation_source_videos'])}): {', '.join(proposal['validation_source_videos'])}", f"- Video overlap: {proposal['video_overlap'] or 'none'}", "", "| Class | Train frames/videos | Validation frames/videos |", "|---|---:|---:|"]
    for label in proposal["selected_classes"]:
        item = proposal["class_coverage"][label]
        lines.append(f"| `{label}` | {item['train_frames']} / {len(item['train_videos'])} | {item['validation_frames']} / {len(item['validation_videos'])} |")
    lines += ["", "## Classes Requiring More Data", ""]
    for label, item in audit.items():
        if item["category"] in {"trainable_visual_landmark", "distinctive_navigation_scene"} and item["source_video_count"] < 2:
            lines.append(f"- `{label}`: only {item['source_video_count']} source video; cannot support video-disjoint validation.")
        elif item["category"] in {"trainable_visual_landmark", "distinctive_navigation_scene"} and item["frames"] < 5:
            lines.append(f"- `{label}`: only {item['frames']} frames; requires diversity review before training.")
    lines += ["", "## Decision", "", "Do not train yet. This proposal is intentionally separate from the manifest. The class inventory contains route cues and overlapping destination/entrance labels; approve the class selection and split proposal before applying any splits or building training data."]
    AUDIT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    rows = load_rows()
    audit = summarize(rows)
    proposal = write_split(rows, audit)
    payload = {"status": "audit_only", "manifest_modified": False, "row_count": len(rows), "reviewed_count": sum(row["review_status"] == "reviewed" for row in rows), "label_count": len(audit), "labels": audit, "overlap_families": DUPLICATE_FAMILIES, "split_proposal_file": SPLIT_JSON.name}
    AUDIT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    markdown(audit, proposal, rows)
    print(json.dumps({"audit": str(AUDIT_JSON), "report": str(AUDIT_MD), "split_proposal": str(SPLIT_JSON), "labels": len(audit), "selected_classes": len(proposal["selected_classes"]), "train_videos": len(proposal["train_source_videos"]), "validation_videos": len(proposal["validation_source_videos"]), "manifest_modified": False}, indent=2))


if __name__ == "__main__":
    main()
