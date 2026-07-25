from pathlib import Path
from PIL import Image, ImageFilter
import json
import math
import random


ROOT = Path("gate_dataset")
OUT = Path("public/models/exhibit_gate/gate_similarity_index.json")
SIZE = 64
MAX_PER_CLASS = 220
SEED = 7


def image_files(folder):
    paths = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        paths.extend(folder.glob(ext))
    return sorted(paths)


def feature_for_image(path):
    img = Image.open(path).convert("RGB").resize((SIZE, SIZE))
    pixels = list(img.getdata())
    total = len(pixels)

    # Color histograms: coarse but fast in browser too.
    rgb_hist = [0] * 24
    gray_hist = [0] * 12
    saturation_sum = 0.0
    brightness_sum = 0.0

    for r, g, b in pixels:
        rgb_hist[min(7, r // 32)] += 1
        rgb_hist[8 + min(7, g // 32)] += 1
        rgb_hist[16 + min(7, b // 32)] += 1

        gray = int(0.299 * r + 0.587 * g + 0.114 * b)
        gray_hist[min(11, gray // 22)] += 1
        brightness_sum += gray / 255.0

        mx = max(r, g, b)
        mn = min(r, g, b)
        saturation_sum += 0 if mx == 0 else (mx - mn) / mx

    rgb_hist = [v / (total * 3) for v in rgb_hist]
    gray_hist = [v / total for v in gray_hist]
    brightness = brightness_sum / total
    saturation = saturation_sum / total

    gray_img = img.convert("L")
    edges = gray_img.filter(ImageFilter.FIND_EDGES)
    edge_values = list(edges.getdata())
    edge_mean = sum(edge_values) / (len(edge_values) * 255.0)

    gray_values = list(gray_img.getdata())
    gray_mean = sum(gray_values) / len(gray_values)
    contrast = math.sqrt(sum((v - gray_mean) ** 2 for v in gray_values) / len(gray_values)) / 255.0

    return rgb_hist + gray_hist + [brightness, saturation, edge_mean, contrast]


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def nearest_distance(vec, bank):
    return min(distance(vec, item["vector"]) for item in bank)


def sample(paths):
    random.shuffle(paths)
    return paths[:MAX_PER_CLASS]


def main():
    random.seed(SEED)
    train_exhibit = sample(image_files(ROOT / "train" / "exhibit"))
    train_background = sample(image_files(ROOT / "train" / "background"))
    val_exhibit = image_files(ROOT / "val" / "exhibit")
    val_background = image_files(ROOT / "val" / "background")

    exhibit_bank = [{"file": str(p).replace("\\", "/"), "vector": feature_for_image(p)} for p in train_exhibit]
    background_bank = [{"file": str(p).replace("\\", "/"), "vector": feature_for_image(p)} for p in train_background]

    exhibit_to_exhibit = [nearest_distance(feature_for_image(p), exhibit_bank) for p in val_exhibit]
    background_to_exhibit = [nearest_distance(feature_for_image(p), exhibit_bank) for p in val_background]

    exhibit_sorted = sorted(exhibit_to_exhibit)
    background_sorted = sorted(background_to_exhibit)

    # Keep most true exhibits, but reject backgrounds that are far from the exhibit bank.
    exhibit_p95 = exhibit_sorted[min(len(exhibit_sorted) - 1, int(len(exhibit_sorted) * 0.95))] if exhibit_sorted else 0.35
    background_p10 = background_sorted[min(len(background_sorted) - 1, int(len(background_sorted) * 0.10))] if background_sorted else 0.45
    threshold = max(0.18, min(0.42, (exhibit_p95 + background_p10) / 2))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "version": "gate-similarity-20260610",
        "featureSize": len(exhibit_bank[0]["vector"]) if exhibit_bank else 40,
        "imageSize": SIZE,
        "maxNearestExhibitDistance": threshold,
        "notes": "Camera frames must be visually close to gate_dataset exhibit examples before showing Exhibit detected.",
        "stats": {
            "trainExhibit": len(exhibit_bank),
            "trainBackground": len(background_bank),
            "valExhibit": len(val_exhibit),
            "valBackground": len(val_background),
            "valExhibitP95Distance": exhibit_p95,
            "valBackgroundP10Distance": background_p10
        },
        "exhibit": exhibit_bank,
        "background": background_bank
    }, indent=2))

    print(f"Wrote {OUT}")
    print(f"threshold={threshold:.4f} exhibit_p95={exhibit_p95:.4f} background_p10={background_p10:.4f}")
    print(f"indexed exhibit={len(exhibit_bank)} background={len(background_bank)}")


if __name__ == "__main__":
    main()
