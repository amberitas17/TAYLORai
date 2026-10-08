"""Evaluate the experimental retrieval model on reviewed camera-video timestamps."""
from __future__ import annotations

import argparse
import base64
import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
MEDIA = ROOT / "Documentation" / "datasets" / "Landmark Recognition"
PROPOSAL = ROOT / "runs" / "landmark_reduced_experiment" / "reduced_landmark_split_proposal.json"
DEFAULT_METADATA = ROOT / "public" / "models" / "landmark_browser_candidate" / "retrieval.metadata.json"
DEFAULT_OUTPUT = ROOT / "runs" / "landmark_browser_candidate" / "camera_video_validation_report.json"


def embedding(session, frame, preprocessing):
    height = int(preprocessing["height"])
    width = int(preprocessing["width"])
    image = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (width, height), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
    image = (image - np.asarray(preprocessing["mean"], dtype=np.float32)) / np.asarray(preprocessing["std"], dtype=np.float32)
    image = np.transpose(image, (2, 0, 1))[None, ...]
    return session.run(None, {session.get_inputs()[0].name: image})[0][0]


def load_local_references(path, feature_version):
    if not path or not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    examples = payload.get("examples", payload) if isinstance(payload, dict) else payload
    return [
        {"label": example.get("label"), "embedding": example.get("modelEmbedding"), "referenceId": example.get("id", "local"), "landmarkId": f"landmark-{str(example.get('label', '')).lower().replace('_', '-') }"}
        for example in examples
        if example.get("label") and example.get("embeddingModelVersion") == feature_version and isinstance(example.get("modelEmbedding"), list)
    ]


def classify(vector, references, threshold, margin):
    ranked = sorted(
        ((float(np.dot(vector, np.asarray(reference["embedding"], dtype=np.float32))), reference) for reference in references),
        key=lambda item: item[0],
        reverse=True,
    )
    if not ranked:
        return {"landmark": "unknown", "similarity": 0.0, "margin": 0.0, "accepted": False}
    best_score, best = ranked[0]
    next_score = next((score for score, candidate in ranked if candidate["label"] != best["label"]), ranked[1][0] if len(ranked) > 1 else 0.0)
    gap = best_score - next_score
    accepted = best_score >= threshold and gap >= margin
    return {"landmark": best["label"] if accepted else "unknown", "bestLabel": best["label"], "similarity": best_score, "margin": gap, "accepted": accepted, "referenceId": best.get("referenceId")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--local-examples", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--independent", action="store_true", help="Use only proposal validation videos and references from proposal training videos")
    args = parser.parse_args()
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    session = ort.InferenceSession(str(ROOT / "public" / metadata["url"].lstrip("/")), providers=["CPUExecutionProvider"])
    references = list(metadata["references"])
    proposal = json.loads(PROPOSAL.read_text(encoding="utf-8"))
    train_videos = set(proposal["train_source_videos"])
    validation_videos = set(proposal["validation_source_videos"])
    reference_videos = {reference.get("sourceVideo") for reference in references}
    if args.independent:
        references = [reference for reference in references if reference.get("referenceId", "").startswith("original-") and reference.get("sourceVideo") in train_videos]
        reference_videos = {reference.get("sourceVideo") for reference in references}
    local_references = load_local_references(args.local_examples, metadata["featureExtractorVersion"])
    combined_references = references + local_references
    selected = set(metadata.get("classes") or [reference["label"] for reference in references])
    rows = list(csv.DictReader((DATASET / "review_manifest.csv").open(newline="", encoding="utf-8")))
    rows = [row for row in rows if row["review_status"] == "reviewed" and row["label"] in selected and (MEDIA / row["source_video"]).exists()]
    if args.independent:
        rows = [row for row in rows if row["source_video"] in validation_videos]
    by_video = defaultdict(list)
    for row in rows:
        by_video[row["source_video"]].append(row)
    results = []
    confusion = Counter()
    per_class = defaultdict(lambda: {"frames": 0, "accepted": 0, "correct": 0, "unknown": 0})
    for video_name, video_rows in sorted(by_video.items()):
        capture = cv2.VideoCapture(str(MEDIA / video_name))
        for row in video_rows:
            capture.set(cv2.CAP_PROP_POS_MSEC, float(row["timestamp_seconds"]) * 1000)
            ok, frame = capture.read()
            if not ok:
                continue
            prediction = classify(embedding(session, frame, metadata["preprocessing"]), combined_references, metadata["similarityThreshold"], metadata["minimumMargin"])
            expected = row["label"]
            per_class[expected]["frames"] += 1
            if prediction["accepted"]:
                per_class[expected]["accepted"] += 1
                per_class[expected]["correct"] += prediction["landmark"] == expected
                confusion[(expected, prediction["landmark"])] += 1
            else:
                per_class[expected]["unknown"] += 1
            results.append({"video": video_name, "timestamp": float(row["timestamp_seconds"]), "expected": expected, **prediction})
        capture.release()
    accepted = [item for item in results if item["accepted"]]
    correct = [item for item in accepted if item["landmark"] == item["expected"]]
    false_acceptances = [item for item in accepted if item["landmark"] != item["expected"]]
    recall = {label: {**stats, "recall": stats["correct"] / stats["frames"] if stats["frames"] else None, "acceptedAccuracy": stats["correct"] / stats["accepted"] if stats["accepted"] else None} for label, stats in sorted(per_class.items())}
    requested = {label: recall.get(label, {"frames": 0, "recall": None, "status": "not_evaluable_or_not_in_reviewed_video"}) for label in ["aricc", "rio", "fablab", "caesar", "recon"]}
    report = {
        "status": "experimental_validation",
        "source": "reviewed timestamps decoded from supplied MOV videos",
        "separateReferenceAndEvaluationSessions": "not proven by manifest; source-video provenance is retained",
        "cameraAngleAnnotations": "not available in supplied manifest; front/left/right/near/far/lighting cannot be scored independently",
        "featureExtractorVersion": metadata["featureExtractorVersion"],
        "referenceCounts": {"original": sum(reference.get("referenceId", "").startswith("original-") for reference in references), "experimentalExtensions": sum(reference.get("referenceId", "").startswith("extension-") for reference in references), "localCompatible": len(local_references), "combined": len(combined_references)},
        "referenceSourceVideos": sorted(reference_videos),
        "evaluationSourceVideos": sorted(by_video),
        "referenceEvaluationOverlap": sorted(reference_videos & set(by_video)),
        "calibrationSourceVideos": sorted(validation_videos),
        "calibrationEvaluationOverlap": sorted(validation_videos & set(by_video)),
        "independentSourceDisjoint": not bool(reference_videos & set(by_video)),
        "splitDefinition": {"mode": "proposal-validation-videos" if args.independent else "all-reviewed-video-rows", "trainingVideos": sorted(train_videos), "validationVideos": sorted(validation_videos)},
        "threshold": metadata["similarityThreshold"],
        "minimumMargin": metadata["minimumMargin"],
        "framesEvaluated": len(results),
        "coverage": len(accepted) / len(results) if results else 0.0,
        "acceptedAccuracy": len(correct) / len(accepted) if accepted else 0.0,
        "falseAcceptanceCount": len(false_acceptances),
        "falseAcceptanceRate": len(false_acceptances) / len(results) if results else 0.0,
        "unknownOrRejected": len(results) - len(accepted),
        "unknownOrRejectedRate": (len(results) - len(accepted)) / len(results) if results else 0.0,
        "perLandmarkRecall": recall,
        "requestedLandmarks": requested,
        "ariccRioConfusion": {f"{left}->{right}": count for (left, right), count in confusion.items() if {left, right} == {"aricc", "rio"}},
        "beforeAddingLocalReferences": {"referenceCount": len(references), "coverage": len(accepted) / len(results) if results else 0.0, "acceptedAccuracy": len(correct) / len(accepted) if accepted else 0.0},
        "afterAddingLocalReferences": {"referenceCount": len(combined_references), "localExamplesProvided": bool(args.local_examples)},
        "videoResults": dict(Counter(item["video"] for item in results)),
        "frameResults": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ["framesEvaluated", "coverage", "acceptedAccuracy", "unknownOrRejected", "referenceCounts", "requestedLandmarks", "ariccRioConfusion"]}, indent=2))


if __name__ == "__main__":
    main()