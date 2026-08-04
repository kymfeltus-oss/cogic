from PIL import Image
import numpy as np
import sys

PNG_W, PNG_H = 926, 1698
WIDTH_RATIO = (PNG_W * 1920) / (PNG_H * 1080)
X_OFFSET = (1 - WIDTH_RATIO) / 2 * 100

# Measured neon ovals — keep in sync with holding-room-countdown-circles.ts
CIRCLES = [
    ("days", 13.39, 50.44, 5.4, 42.99, 15.98, 14.9),
    ("hours", 37.42, 50.82, 29.48, 43.76, 15.87, 14.13),
    ("minutes", 60.42, 50.82, 52.48, 43.76, 15.87, 14.13),
    ("seconds", 84.4, 50.44, 76.46, 42.99, 15.87, 14.9),
]

ANCHOR_VALUE = (8.4, 48.5, 12.8, 9.2)
ANCHOR_LABEL = (8.4, 54.4, 13.0, 3.5)

im = np.array(Image.open("public/holding page/holding-room.png").convert("RGB"))
failures = 0

anchor = CIRCLES[0]
_, acx, acy, _, _, aw, ah = anchor
vl, vt, vw, vh = ANCHOR_VALUE
ll, lt, lw, lh = ANCHOR_LABEL
vcx = vl + vw / 2
vcy = vt + vh / 2
centering = {
    "ox": vcx - acx,
    "oy": vcy - acy,
    "wr": vw / aw,
    "hr": vh / ah,
    "label_gap": lt - vt,
    "label_wr": lw / aw,
    "label_h": lh,
}

print(
    f"anchor centering: ox={centering['ox']:.2f}% oy={centering['oy']:.2f}% "
    f"wr={centering['wr']:.3f} hr={centering['hr']:.3f}"
)

for sid, cx, cy, _, _, cw, ch in CIRCLES:
    vw = cw * centering["wr"]
    vh = ch * centering["hr"]
    vcx = cx + centering["ox"]
    vcy = cy + centering["oy"]
    left = vcx - vw / 2
    top = vcy - vh / 2
    stage_left = X_OFFSET + left * WIDTH_RATIO
    stage_top = top
    px = int(PNG_W * (left + vw / 2) / 100)
    py = int(PNG_H * (top + vh / 2) / 100)
    rx = int(PNG_W * vw / 200)
    ry = int(PNG_H * vh / 200)
    bright = total = 0
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            x, y = px + dx, py + dy
            if x < 0 or y < 0 or x >= PNG_W or y >= PNG_H:
                continue
            total += 1
            if im[y, x].max() > 150:
                bright += 1
    ratio = bright / total if total else 0
    ok = ratio >= 0.06
    failures += 0 if ok else 1
    status = "PASS" if ok else "FAIL"
    print(
        f"{status} {sid:7} mask({left:.2f}%, {top:.2f}%, {vw:.2f}x{vh:.2f}) "
        f"circle({cx:.2f}%, {cy:.2f}%) stage({stage_left:.2f}%, {stage_top:.2f}%) "
        f"bright={ratio * 100:.1f}%"
    )

print(f"letterbox x={X_OFFSET:.2f}% width-scale={WIDTH_RATIO:.4f}")
sys.exit(1 if failures else 0)
