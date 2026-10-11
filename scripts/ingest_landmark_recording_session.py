"""Stage a new landmark recording session without modifying the approved manifest."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "Documentation" / "datasets" / "Landmark Recognition" / "landmark_recognition"
SESSION_ROOT = WORK / "incoming_landmark_sessions"
VIDEO_EXTENSIONS = {".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"}
FIELDS = ["frame_path", "source_video", "source_type", "frame_index", "timestamp_seconds", "label", "review_status", "split", "review_notes"]


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def perceptual_signature(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    return small.astype("float32")


def frame_distance(first, second):
    return float(cv2.absdiff(first.astype("uint8"), second.astype("uint8")).mean())


def extract_video(video, session_dir, session_id, every_seconds, minimum_difference):
    capture = cv2.VideoCapture(str(video))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, round(fps * every_seconds))
    frame_dir = session_dir / "frames" / slug(video.stem)
    frame_dir.mkdir(parents=True, exist_ok=True)
    source_id = f"{session_id}__{video.name}"
    rows = []
    previous_signature = None
    kept = 0
    skipped_repetitive = 0
    for frame_index in range(0, total_frames, step):
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = capture.read()
        if not ok:
            continue
        signature = perceptual_signature(frame)
        if previous_signature is not None and frame_distance(previous_signature, signature) < minimum_difference:
            skipped_repetitive += 1
            continue
        timestamp = frame_index / fps
        output = frame_dir / f"{slug(video.stem)}__t{timestamp:08.2f}.jpg"
        cv2.imwrite(str(output), frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
        relative = output.relative_to(WORK.parent)
        rows.append({"frame_path": str(relative), "source_video": source_id, "source_type": "new_video_frame", "frame_index": str(frame_index), "timestamp_seconds": f"{timestamp:.2f}", "label": "", "review_status": "pending", "split": "", "review_notes": ""})
        previous_signature = signature
        kept += 1
    capture.release()
    return rows, {"source_video": source_id, "input_file": str(video), "sampled_frames": int(total_frames // step + (1 if total_frames % step else 0)), "kept_frames": kept, "skipped_repetitive_frames": skipped_repetitive, "sampling_interval_seconds": every_seconds, "near_duplicate_threshold": minimum_difference}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Directory containing newly recorded videos.")
    parser.add_argument("--session-id", required=True, help="Unique recording-session ID, e.g. 2026-10-08_mobile_aricc_rio.")
    parser.add_argument("--every-seconds", type=float, default=1.0)
    parser.add_argument("--near-duplicate-threshold", type=float, default=4.0, help="Mean grayscale pixel difference below which a frame is skipped.")
    args = parser.parse_args()
    if args.every_seconds <= 0 or args.near_duplicate_threshold < 0:
        parser.error("Sampling interval must be positive and duplicate threshold must be non-negative.")
    session_id = slug(args.session_id)
    if not session_id:
        parser.error("Session ID must contain at least one alphanumeric character.")
    source = args.source.resolve()
    if not source.is_dir():
        parser.error(f"Source directory does not exist: {source}")
    session_dir = SESSION_ROOT / session_id
    if session_dir.exists():
        raise RuntimeError(f"Session already exists; choose a new ID: {session_dir}")
    session_dir.mkdir(parents=True)
    raw_dir = session_dir / "source_videos"
    raw_dir.mkdir()
    all_rows = []
    video_reports = []
    for video in sorted((item for item in source.iterdir() if item.suffix.lower() in VIDEO_EXTENSIONS), key=lambda item: item.name.lower()):
        copied = raw_dir / video.name
        shutil.copy2(video, copied)
        rows, report = extract_video(copied, session_dir, session_id, args.every_seconds, args.near_duplicate_threshold)
        all_rows.extend(rows)
        video_reports.append(report)
    if not video_reports:
        raise RuntimeError(f"No supported videos found in {source}")
    with (session_dir / "review_manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)
    session_report = {"status": "pending_human_review", "session_id": session_id, "session_directory": str(session_dir), "source_video_count": len(video_reports), "frame_count": len(all_rows), "video_reports": video_reports, "manifest": str(session_dir / "review_manifest.csv"), "review_url": f"http://127.0.0.1:4178/?session={session_id}", "original_manifest_modified": False, "labels_must_be_human_confirmed": True, "split_policy": "Keep this session separate from the original validation set; assign train or held_out_test only after review.", "content_hashes": [hashlib.sha256((session_dir / "source_videos" / Path(report["input_file"]).name).read_bytes()).hexdigest() for report in video_reports]}
    (session_dir / "session_report.json").write_text(json.dumps(session_report, indent=2) + "\n", encoding="utf-8")
    (session_dir / "REVIEW_NOTES.md").write_text("# New Landmark Recording Session\n\nReview every pending frame at the session URL in `session_report.json`. Confirm labels from visible evidence only. Keep this session separate from the original validation videos; use `held_out_test` planning outside the current manifest until the next split proposal is approved.\n", encoding="utf-8")
    print(json.dumps(session_report, indent=2))


if __name__ == "__main__":
    main()
