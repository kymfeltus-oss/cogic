"""Measure neon countdown ovals on holding-room.png (run when art changes)."""

from PIL import Image
import numpy as np

PNG_W, PNG_H = 926, 1698
STRIP_CENTERS = [("days", 13.5), ("hours", 37.5), ("minutes", 60.5), ("seconds", 84.5)]


def is_ring(r: int, g: int, b: int) -> bool:
    return max(r, g, b) > 85 and (b > 100 or r > 100)


def measure_strip(im: np.ndarray, cx_pct: float, half_w_pct: float = 8.0):
    h, w = im.shape[:2]
    x0 = max(0, int(w * (cx_pct - half_w_pct) / 100))
    x1 = min(w, int(w * (cx_pct + half_w_pct) / 100))
    ring_pts = []
    for y in range(int(h * 0.43), int(h * 0.58)):
        for x in range(x0, x1):
            r, g, b = im[y, x]
            if is_ring(r, g, b):
                ring_pts.append((x, y))
    if len(ring_pts) < 30:
        return None
    xs, ys = zip(*ring_pts)
    left, right = min(xs), max(xs)
    top, bot = min(ys), max(ys)
    return {
        "cx": (left + right) / 2 / w * 100,
        "cy": (top + bot) / 2 / h * 100,
        "left": left / w * 100,
        "top": top / h * 100,
        "width": (right - left) / w * 100,
        "height": (bot - top) / h * 100,
    }


def main() -> None:
    im = np.array(Image.open("public/holding page/holding-room.png").convert("RGB"))
    print("HOLDING_ROOM_COUNTDOWN_CIRCLES = [")
    for name, cx in STRIP_CENTERS:
        m = measure_strip(im, cx)
        if not m:
            print(f"  // FAILED {name}")
            continue
        print(
            f'  {{ id: "{name}", cx: {m["cx"]:.2f}, cy: {m["cy"]:.2f}, '
            f'left: {m["left"]:.2f}, top: {m["top"]:.2f}, '
            f'width: {m["width"]:.2f}, height: {m["height"]:.2f} }},'
        )
    print("] as const;")


if __name__ == "__main__":
    main()
