from __future__ import annotations

import argparse
import csv
import re
import shutil
from pathlib import Path


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic", ".heif"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}
SKIP_FILE_NAME_PARTS = {
    "void",
    "floor plan",
    "logo",
}


def slugify(value: str) -> str:
    value = value.strip()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[-\s]+", "_", value)
    return value.strip("_") or "unknown"


def should_skip(path: Path) -> bool:
    name = path.name.lower()
    return any(part in name for part in SKIP_FILE_NAME_PARTS)


def copy_image(src: Path, dst_dir: Path, label_slug: str, rows: list[dict]) -> int:
    dst_dir.mkdir(parents=True, exist_ok=True)
    is_heic = src.suffix.lower() in {".heic", ".heif"}
    out_suffix = ".jpg" if is_heic else src.suffix.lower()
    out_name = f"{label_slug}__{slugify(src.stem)}{out_suffix}"
    dst = dst_dir / out_name
    if not dst.exists():
        if is_heic:
            try:
                from pillow_heif import register_heif_opener
                from PIL import Image

                register_heif_opener()
                with Image.open(src) as img:
                    img.convert("RGB").save(dst, "JPEG", quality=92)
            except Exception as exc:
                print(f"WARNING: could not convert HEIC image: {src} ({exc})")
                return 0
        else:
            shutil.copy2(src, dst)
    rows.append(
        {
            "output_path": str(dst),
            "label": dst_dir.name,
            "source_path": str(src),
            "source_type": "image",
            "frame_index": "",
            "timestamp_seconds": "",
        }
    )
    return 1


def extract_video_frames(
    src: Path,
    dst_dir: Path,
    label_slug: str,
    every_seconds: float,
    max_frames_per_video: int,
    rows: list[dict],
) -> int:
    import cv2

    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        print(f"WARNING: could not open video: {src}")
        return 0

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, int(round(fps * every_seconds)))
    stem = slugify(src.stem)
    written = 0
    frame_index = 0
    dst_dir.mkdir(parents=True, exist_ok=True)

    while frame_index < total_frames:
        if written >= max_frames_per_video:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = cap.read()
        if not ok:
            break
        timestamp = frame_index / fps
        out_name = f"{label_slug}__{stem}__t{timestamp:07.2f}.jpg"
        dst = dst_dir / out_name
        if not dst.exists():
            cv2.imwrite(str(dst), frame)
        rows.append(
            {
                "output_path": str(dst),
                "label": dst_dir.name,
                "source_path": str(src),
                "source_type": "video_frame",
                "frame_index": frame_index,
                "timestamp_seconds": f"{timestamp:.2f}",
            }
        )
        written += 1
        frame_index += step

    cap.release()
    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--every-seconds", type=float, default=2.0)
    parser.add_argument("--max-frames-per-video", type=int, default=120)
    args = parser.parse_args()

    source = args.source
    output = args.output
    output.mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict] = []
    counts: dict[str, int] = {}

    top_level_dirs = [p for p in source.iterdir() if p.is_dir()]
    for label_dir in sorted(top_level_dirs, key=lambda p: p.name.lower()):
        label_slug = slugify(label_dir.name)
        dst_label_dir = output / label_slug
        counts[label_slug] = 0

        for media in sorted(label_dir.rglob("*"), key=lambda p: str(p).lower()):
            if not media.is_file() or should_skip(media):
                continue

            ext = media.suffix.lower()
            if ext in IMAGE_EXTS:
                counts[label_slug] += copy_image(media, dst_label_dir, label_slug, manifest_rows)
            elif ext in VIDEO_EXTS:
                counts[label_slug] += extract_video_frames(
                    media,
                    dst_label_dir,
                    label_slug,
                    args.every_seconds,
                    args.max_frames_per_video,
                    manifest_rows,
                )

    manifest_path = output / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "output_path",
                "label",
                "source_path",
                "source_type",
                "frame_index",
                "timestamp_seconds",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest_rows)

    print(f"Output: {output}")
    print(f"Manifest: {manifest_path}")
    print(f"Total files prepared: {sum(counts.values())}")
    for label, count in sorted(counts.items()):
        print(f"{label}: {count}")


if __name__ == "__main__":
    main()
