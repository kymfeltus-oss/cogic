from PIL import Image
from pathlib import Path

SOURCE = Path("source.png")
OUT_DIR = Path("mobile_intro_assets")
OUT_DIR.mkdir(exist_ok=True)

img = Image.open(SOURCE).convert("RGB")

def cover_center_crop(image, target_size):
    target_w, target_h = target_size
    src_w, src_h = image.size

    scale = max(target_w / src_w, target_h / src_h)

    resized_w = round(src_w * scale)
    resized_h = round(src_h * scale)

    resized = image.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    left = (resized_w - target_w) // 2
    top = (resized_h - target_h) // 2

    return resized.crop((left, top, left + target_w, top + target_h))

ASSETS = {
    "ios_universal_splash_2732x2732.png": (2732, 2732),
    "android_large_splash_1080x2340.png": (1080, 2340),
    "baseline_ui_360x640_1x.png": (360, 640),
    "baseline_ui_720x1280_2x.png": (720, 1280),
    "baseline_ui_1080x1920_3x.png": (1080, 1920),
}

for filename, size in ASSETS.items():
    output = cover_center_crop(img, size)
    output.save(OUT_DIR / filename, "PNG", optimize=True)

print("Assets generated successfully.")
