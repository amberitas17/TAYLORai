"""
Organize flat ARICC frame dumps (from extract_all_egn_frames.py) into
per-exhibit ARICC-<n> folders expected by train_egn_balanced_fixed.py.

Frames are named: ARICC_ARICC_<ExhibitName>_<framenum>.jpg
Numbered variants of the same exhibit (e.g. "Smart Systems 2", "Smart Systems 3")
are grouped under the same base exhibit name ("Smart Systems").
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

FRAME_PATTERN = re.compile(r"^ARICC_ARICC_(.+)_(\d{6})\.jpg$", re.IGNORECASE)
TRAILING_NUMBER_PATTERN = re.compile(r"^(.*?)\s+\d+$")

SOURCE_DEFAULT = Path(__file__).resolve().parent.parent / "datasets" / "ARICC"
OUTPUT_DEFAULT = Path(__file__).resolve().parent / "hierarchical_dataset" / "ARICC"


def base_exhibit_name(exhibit_name: str) -> str:
    match = TRAILING_NUMBER_PATTERN.match(exhibit_name.strip())
    return match.group(1) if match else exhibit_name.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Group ARICC frames into ARICC-<n> folders")
    parser.add_argument("--source", type=Path, default=SOURCE_DEFAULT, help="Folder containing extracted frames")
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT, help="Folder to create ARICC-<n> subfolders in")
    parser.add_argument("--copy", action="store_true", help="Copy files instead of moving them")
    args = parser.parse_args()

    if not args.source.exists():
        raise FileNotFoundError(f"Source folder not found: {args.source}")

    frames_by_base_name: dict[str, list[Path]] = {}
    skipped: list[str] = []

    for path in sorted(args.source.glob("*.jpg")):
        match = FRAME_PATTERN.match(path.name)
        if not match:
            skipped.append(path.name)
            continue
        base_name = base_exhibit_name(match.group(1))
        frames_by_base_name.setdefault(base_name, []).append(path)

    if not frames_by_base_name:
        print("No matching frames found. Nothing to do.")
        return

    ordered_names = sorted(frames_by_base_name)
    name_to_folder = {name: f"ARICC-{index + 1}" for index, name in enumerate(ordered_names)}

    print("Exhibit -> folder mapping:")
    for name in ordered_names:
        print(f"  {name_to_folder[name]:8s} = {name} ({len(frames_by_base_name[name])} frames)")

    transfer = shutil.copy2 if args.copy else shutil.move
    for name, frames in frames_by_base_name.items():
        dest_dir = args.output / name_to_folder[name]
        dest_dir.mkdir(parents=True, exist_ok=True)
        for frame_path in frames:
            transfer(str(frame_path), str(dest_dir / frame_path.name))

    if skipped:
        print(f"\nSkipped {len(skipped)} non-matching file(s), e.g. {skipped[:5]}")

    print(f"\nDone. Wrote {len(ordered_names)} ARICC folders to {args.output}")


if __name__ == "__main__":
    main()
