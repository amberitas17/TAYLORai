"""Group landmark frames by lightweight visual similarity.

The encoder is loaded only from the already-cached TorchVision checkpoint. Groups
are review aids, not labels; OCR evidence remains in local_ocr_suggestions.json.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MANIFEST = WORK / "review_manifest.csv"
OUTPUT = WORK / "visual_similarity_groups.json"
CHECKPOINT = Path(torch.hub.get_dir()) / "checkpoints" / "mobilenet_v3_small-047dcff4.pth"
SIMILARITY_THRESHOLD = 0.90


def load_encoder():
    if not CHECKPOINT.is_file():
        raise RuntimeError(f"Cached checkpoint not found: {CHECKPOINT}")
    weights = MobileNet_V3_Small_Weights.DEFAULT
    model = mobilenet_v3_small(weights=None)
    model.load_state_dict(torch.load(CHECKPOINT, map_location="cpu", weights_only=True))
    model.classifier = torch.nn.Identity()
    model.eval()
    return model, weights.transforms()


def embedding(model, transform, frame_path: Path) -> np.ndarray:
    image = cv2.imread(str(frame_path))
    if image is None:
        raise RuntimeError(f"Frame could not be read: {frame_path}")
    image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    with torch.inference_mode():
        vector = model(transform(image).unsqueeze(0)).squeeze(0).numpy()
    vector /= max(float(np.linalg.norm(vector)), 1e-12)
    return vector


def timestamp(row: dict[str, str]) -> float:
    return float(row["timestamp_seconds"])


def group_source(rows: list[dict[str, str]], model, transform) -> tuple[list[dict], int]:
    groups = []
    current = []
    previous_vector = None
    transitions = 0
    for row in rows:
        vector = embedding(model, transform, WORK.parent / row["frame_path"])
        similarity = float(np.dot(previous_vector, vector)) if previous_vector is not None else 1.0
        if current and similarity < SIMILARITY_THRESHOLD:
            transitions += 1
            groups.append((current, "visual_similarity_boundary", similarity))
            current = []
        current.append((row, vector, similarity))
        previous_vector = vector
    if current:
        groups.append((current, "end_of_source_video", None))

    output = []
    for group_index, (items, boundary_reason, boundary_similarity) in enumerate(groups):
        vectors = np.stack([item[1] for item in items])
        centroid = vectors.mean(axis=0)
        centroid /= max(float(np.linalg.norm(centroid)), 1e-12)
        similarities = vectors @ centroid
        representative_index = int(np.argmax(similarities))
        first_row = items[0][0]
        last_row = items[-1][0]
        output.append({
            "group_id": f"{first_row['source_video'].rsplit('.', 1)[0]}_g{group_index + 1:03d}",
            "source_video": first_row["source_video"],
            "manifest_indexes": [int(row["manifest_index"]) for row, _, _ in items],
            "frame_count": len(items),
            "timestamp_start": timestamp(first_row),
            "timestamp_end": timestamp(last_row),
            "representative_manifest_index": int(items[representative_index][0]["manifest_index"]),
            "representative_frame_path": items[representative_index][0]["frame_path"],
            "boundary_before": boundary_reason,
            "boundary_similarity": boundary_similarity,
            "quality": {
                "mean_centroid_similarity": round(float(similarities.mean()), 5),
                "min_centroid_similarity": round(float(similarities.min()), 5),
                "safe_for_batch_review": bool(len(items) > 1 and float(similarities.min()) >= 0.90),
            },
            "review_status": "unreviewed",
            "review_label": "unknown",
            "review_note": "Visual similarity is grouping evidence only; reviewer must inspect OCR and representative frames.",
        })
    return output, transitions


def main() -> None:
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    for index, row in enumerate(rows):
        row["manifest_index"] = str(index)
    model, transform = load_encoder()
    groups = []
    transitions = 0
    for source_video in dict.fromkeys(row["source_video"] for row in rows):
        source_rows = [row for row in rows if row["source_video"] == source_video]
        source_groups, source_transitions = group_source(source_rows, model, transform)
        groups.extend(source_groups)
        transitions += source_transitions
        print(f"Grouped {source_video}: {len(source_groups)} groups")
    output = {
        "status": "complete",
        "analysis_type": "cached_mobilenet_v3_small_visual_similarity",
        "encoder": "torchvision.models.mobilenet_v3_small",
        "weights_source": "local_cache_only",
        "checkpoint": str(CHECKPOINT),
        "checkpoint_size_bytes": CHECKPOINT.stat().st_size,
        "download_performed": False,
        "similarity_threshold": SIMILARITY_THRESHOLD,
        "frames_processed": len(rows),
        "source_videos": len({row["source_video"] for row in rows}),
        "group_count": len(groups),
        "visual_transitions": transitions,
        "safe_for_batch_review": sum(group["quality"]["safe_for_batch_review"] for group in groups),
        "labeling_policy": "Do not assign labels from visual similarity alone; use OCR evidence and explicit human review.",
        "manifest_modified": False,
        "groups": groups,
    }
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "frames_processed": len(rows), "group_count": len(groups), "visual_transitions": transitions, "safe_for_batch_review": output["safe_for_batch_review"]}, indent=2))


if __name__ == "__main__":
    main()