"""Turn Doubao-generated beige-background frames into transparent 344x520 pet frames.

Background is a smooth warm gradient that is very close to the character's white fur,
so colour keying fails. Instead: flood-fill the background from the image border,
comparing each step against the neighbour we came from (tolerance on local step),
which follows the gradient but stops at the drawn edge. Then feather the mask.

Usage:
  python process_frames.py <srcdir> <outdir> [--preview]
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

W, H = 344, 520
STEP = 3.2      # max per-step colour distance while walking the background
FEATHER = 1.0   # mask blur radius


def background_mask(rgb):
    h, w, _ = rgb.shape
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if seen[y, x]:
            continue
        seen[y, x] = True
        c = rgb[y, x]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny, nx]:
                if np.abs(rgb[ny, nx] - c).max() <= STEP:
                    q.append((nx, ny))
    return seen


def fit_into(rgb_img, mask):
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(FEATHER))
    bbox = alpha.point(lambda p: 255 if p > 24 else 0).getbbox()
    if not bbox:
        return Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rgba = rgb_img.crop(bbox).convert("RGBA")
    rgba.putalpha(alpha.crop(bbox))
    cw, ch = rgba.size
    scale = min(W / cw, (H - 2) / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    rgba = rgba.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(rgba, ((W - nw) // 2, H - nh), rgba)
    return canvas


def checkerboard(size):
    tile = 16
    board = Image.new("RGB", size, (255, 255, 255))
    px = board.load()
    for y in range(size[1]):
        for x in range(size[0]):
            if ((x // tile) + (y // tile)) % 2:
                px[x, y] = (226, 226, 226)
    return board


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    preview = "--preview" in sys.argv
    out.mkdir(parents=True, exist_ok=True)
    if preview:
        (out.parent / "preview").mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*.png")):
        img = Image.open(f)
        rgb = np.asarray(img.convert("RGB")).astype(np.int16)
        mask = background_mask(rgb)
        frame = fit_into(img.convert("RGB"), mask)
        frame.save(out / f.name)
        print(f"{f.name}: bg={(mask.mean() * 100):.1f}% -> 344x520 {(out / f.name).stat().st_size}B")
        if preview:
            board = checkerboard((W, H))
            board.paste(frame, (0, 0), frame)
            board.save(out.parent / "preview" / f.name)


if __name__ == "__main__":
    main()
