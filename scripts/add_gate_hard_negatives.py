from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import random
import math


ROOT = Path("gate_dataset")
SPLITS = {
    "train": 260,
    "val": 80,
}
SIZE = 224
RANDOM_SEED = 42


def add_noise(img, amount=10):
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            delta = random.randint(-amount, amount)
            pixels[x, y] = (
                max(0, min(255, r + delta)),
                max(0, min(255, g + delta)),
                max(0, min(255, b + delta)),
            )
    return img


def bright_wall():
    base = random.randint(185, 250)
    tint = random.choice([(base, base, base), (base, base - 8, base - 18), (base - 12, base, base - 8), (base - 18, base - 10, base)])
    img = Image.new("RGB", (SIZE, SIZE), tint)
    draw = ImageDraw.Draw(img)
    for _ in range(random.randint(2, 8)):
        x0 = random.randint(-40, SIZE)
        y0 = random.randint(-40, SIZE)
        x1 = x0 + random.randint(40, 180)
        y1 = y0 + random.randint(20, 160)
        color = tuple(max(0, min(255, c + random.randint(-18, 18))) for c in tint)
        draw.rectangle([x0, y0, x1, y1], fill=color)
    return add_noise(img, 8).filter(ImageFilter.GaussianBlur(radius=random.uniform(0, 1.2)))


def laptop_screen():
    bg = random.choice([(245, 247, 250), (235, 241, 248), (250, 250, 255), (230, 236, 245)])
    img = Image.new("RGB", (SIZE, SIZE), bg)
    draw = ImageDraw.Draw(img)
    bar_h = random.randint(16, 30)
    draw.rectangle([0, 0, SIZE, bar_h], fill=random.choice([(28, 35, 45), (240, 240, 242), (20, 90, 160)]))
    for _ in range(random.randint(5, 16)):
        x = random.randint(6, SIZE - 50)
        y = random.randint(bar_h + 8, SIZE - 20)
        w = random.randint(20, 90)
        h = random.randint(8, 36)
        color = random.choice([(255, 255, 255), (220, 226, 235), (180, 195, 215), (90, 140, 210), (235, 235, 235)])
        draw.rounded_rectangle([x, y, min(SIZE - 4, x + w), min(SIZE - 4, y + h)], radius=random.randint(1, 5), fill=color)
    for _ in range(random.randint(4, 12)):
        x = random.randint(8, SIZE - 20)
        y = random.randint(bar_h + 10, SIZE - 10)
        r = random.randint(4, 13)
        draw.ellipse([x, y, x + r, y + r], fill=random.choice([(70, 130, 210), (240, 180, 40), (80, 180, 120), (220, 90, 90)]))
    return add_noise(img, 5)


def white_page():
    img = Image.new("RGB", (SIZE, SIZE), random.choice([(255, 255, 255), (248, 248, 244), (242, 245, 250)]))
    draw = ImageDraw.Draw(img)
    angle_lines = random.choice([True, False])
    for i in range(random.randint(8, 24)):
        y = random.randint(18, SIZE - 18)
        x0 = random.randint(8, 40)
        x1 = random.randint(120, SIZE - 8)
        color = random.choice([(180, 180, 180), (205, 205, 205), (120, 150, 210)])
        if angle_lines:
            draw.line([x0, y, x1, y + random.randint(-8, 8)], fill=color, width=random.randint(1, 2))
        else:
            draw.line([x0, y, x1, y], fill=color, width=random.randint(1, 2))
    return add_noise(img, 4).filter(ImageFilter.GaussianBlur(radius=random.uniform(0, 0.7)))


def hand_like():
    bg = random.choice([(235, 235, 230), (245, 245, 245), (220, 230, 240), (250, 245, 235)])
    img = Image.new("RGB", (SIZE, SIZE), bg)
    draw = ImageDraw.Draw(img)
    skin = random.choice([(224, 174, 132), (198, 142, 98), (170, 108, 72), (238, 196, 154), (126, 78, 54)])
    cx = random.randint(70, 150)
    cy = random.randint(80, 150)
    draw.ellipse([cx - 38, cy - 28, cx + 44, cy + 34], fill=skin)
    for i in range(random.randint(3, 5)):
        fx = cx - 45 + i * random.randint(18, 24)
        fy = cy - random.randint(55, 85)
        draw.rounded_rectangle([fx, fy, fx + random.randint(12, 22), cy], radius=8, fill=skin)
    draw.ellipse([cx + 25, cy - 8, cx + 78, cy + 22], fill=skin)
    return add_noise(img, 7).filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.3)))


def bright_object():
    img = Image.new("RGB", (SIZE, SIZE), random.choice([(245, 245, 245), (230, 238, 250), (250, 248, 238)]))
    draw = ImageDraw.Draw(img)
    for _ in range(random.randint(1, 5)):
        color = random.choice([(255, 255, 255), (240, 220, 130), (180, 210, 250), (240, 160, 150), (210, 230, 180)])
        x0 = random.randint(-20, SIZE - 40)
        y0 = random.randint(-20, SIZE - 40)
        x1 = x0 + random.randint(50, 180)
        y1 = y0 + random.randint(50, 180)
        if random.choice([True, False]):
            draw.ellipse([x0, y0, x1, y1], fill=color)
        else:
            draw.rounded_rectangle([x0, y0, x1, y1], radius=random.randint(4, 20), fill=color)
    return add_noise(img, 8).filter(ImageFilter.GaussianBlur(radius=random.uniform(0, 1.0)))


GENERATORS = [bright_wall, laptop_screen, white_page, hand_like, bright_object]


def main():
    random.seed(RANDOM_SEED)
    for split, count in SPLITS.items():
        out_dir = ROOT / split / "background"
        out_dir.mkdir(parents=True, exist_ok=True)
        for idx in range(count):
            generator = GENERATORS[idx % len(GENERATORS)]
            img = generator()
            img.save(out_dir / f"hard_negative_bright_{idx:04d}.jpg", quality=92)
        print(f"Added {count} hard-negative background images to {out_dir}")


if __name__ == "__main__":
    main()
