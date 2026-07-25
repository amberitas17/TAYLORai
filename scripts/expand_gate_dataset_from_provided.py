from pathlib import Path
import random
import shutil


SOURCE_ROOT = Path(r"C:\Users\Administrator\Desktop\datasets")
GATE_ROOT = Path("gate_dataset")
SEED = 17

EXHIBIT_LIMIT = 700
BACKGROUND_LIMIT = 700

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
BACKGROUND_KEYWORDS = [
    "void",
    "entrance",
    "overview",
    "walkthrough",
    "walk in",
    "corridor",
    "hall c row",
    "hall f walkthrough",
    "general",
]
EXCLUDE_FOR_EXHIBIT = BACKGROUND_KEYWORDS + ["logo", "floor plan", "site plan"]


def image_files_under(path):
    if not path.exists():
        return []
    return [p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS]


def is_background_candidate(path):
    text = str(path).lower()
    return any(keyword in text for keyword in BACKGROUND_KEYWORDS)


def is_exhibit_candidate(path):
    text = str(path).lower()
    if any(keyword in text for keyword in EXCLUDE_FOR_EXHIBIT):
        return False
    return any(part in text for part in [
        "single_classifier_dset",
        "stratified_balanced_200",
        "intelligently_balanced_224",
        "updated dataset",
        "science center machine vision videos",
    ])


def clear_previous_generated():
    for split in ("train", "val"):
        for cls in ("exhibit", "background"):
            folder = GATE_ROOT / split / cls
            folder.mkdir(parents=True, exist_ok=True)
            for file in folder.glob("provided_dataset_*.jpg"):
                file.unlink()


def copy_split(files, cls, prefix):
    random.shuffle(files)
    split_at = int(len(files) * 0.8)
    splits = {
        "train": files[:split_at],
        "val": files[split_at:],
    }
    counts = {}
    for split, split_files in splits.items():
        out_dir = GATE_ROOT / split / cls
        out_dir.mkdir(parents=True, exist_ok=True)
        for idx, src in enumerate(split_files):
            dst = out_dir / f"provided_dataset_{prefix}_{idx:04d}.jpg"
            try:
                shutil.copy2(src, dst)
            except Exception as exc:
                print(f"Skipping {src}: {exc}")
        counts[split] = len(split_files)
    return counts


def main():
    random.seed(SEED)
    all_images = image_files_under(SOURCE_ROOT)

    background = [p for p in all_images if is_background_candidate(p)]
    exhibit = [p for p in all_images if is_exhibit_candidate(p) and not is_background_candidate(p)]

    random.shuffle(background)
    random.shuffle(exhibit)
    background = background[:BACKGROUND_LIMIT]
    exhibit = exhibit[:EXHIBIT_LIMIT]

    clear_previous_generated()
    exhibit_counts = copy_split(exhibit, "exhibit", "exhibit")
    background_counts = copy_split(background, "background", "background")

    print(f"Total source images found: {len(all_images)}")
    print(f"Added exhibit samples: {len(exhibit)} -> {exhibit_counts}")
    print(f"Added background samples: {len(background)} -> {background_counts}")
    print("Background keywords used:", ", ".join(BACKGROUND_KEYWORDS))


if __name__ == "__main__":
    main()
