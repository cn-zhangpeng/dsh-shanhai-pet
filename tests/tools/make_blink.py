#!/usr/bin/env python3
"""Derive a closed-eye frame that shares the SAME base as the open-eye frame.

``frames/breathopen.png`` and ``frames/breath.png`` were generated separately, so
swapping them during a blink looks like the whole picture changed. This script
keeps ``breathopen.png`` as the base and transplants only the eyelids from the
closed render, after aligning the two faces by their eye positions.

Usage:
    python make_blink.py
    python make_blink.py --base frames/breathopen.png --ref frames/breath.png \\
        --out frames/breathopen_closed.png --debug-dir tests/out
"""

from __future__ import annotations

import argparse
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# dark-pixel hunting box inside the 344x520 sprite (x0, y0, x1, y1)
EYE_BAND = (92, 214, 240, 266)
DARK = 120
# ellipse half-size around each eye when pasting, and the ring used to match skin tone
EYE_RX, EYE_RY = 27, 18
RING_RX, RING_RY = 42, 30


def dark_components(image: Image.Image, band=EYE_BAND, threshold=DARK):
    """Connected dark blobs inside ``band`` -> [(cx, cy, area, x0, x1, y0, y1)]."""
    pixels = np.asarray(image.convert('RGB')).astype(int)
    lum = pixels.mean(axis=2)
    mask = np.zeros(lum.shape, dtype=bool)
    x0, y0, x1, y1 = band
    mask[y0:y1, x0:x1] = lum[y0:y1, x0:x1] < threshold

    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    found = []
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or seen[y, x]:
                continue
            queue = deque([(y, x)])
            seen[y, x] = True
            points = []
            while queue:
                cy, cx = queue.popleft()
                points.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            queue.append((ny, nx))
            if len(points) < 20:
                continue
            ys = [p[0] for p in points]
            xs = [p[1] for p in points]
            found.append((float(np.mean(xs)), float(np.mean(ys)), len(points), min(xs), max(xs), min(ys), max(ys)))
    return found


def pick_eyes(components):
    """Take the two blobs that look like an eye pair (similar area, side by side)."""
    if len(components) < 2:
        raise SystemExit('could not find two eye blobs')
    best = None
    for i in range(len(components)):
        for j in range(i + 1, len(components)):
            a, b = components[i], components[j]
            if a[0] > b[0]:
                a, b = b, a
            area_ratio = min(a[2], b[2]) / max(a[2], b[2])
            dy = abs(a[1] - b[1])
            if area_ratio < 0.55 or dy > 16:
                continue
            score = area_ratio - dy / 100.0
            if best is None or score > best[0]:
                best = (score, a, b)
    if best is None:
        raise SystemExit('could not pair up two eye blobs')
    _, a, b = best
    return np.array([a[0], a[1]]), np.array([b[0], b[1]])


def similarity(base_pair, ref_pair):
    """Map ref eye pair onto base eye pair: scale, rotation, translation."""
    base_center = (base_pair[0] + base_pair[1]) / 2.0
    ref_center = (ref_pair[0] + ref_pair[1]) / 2.0
    base_vec = base_pair[1] - base_pair[0]
    ref_vec = ref_pair[1] - ref_pair[0]
    scale = float(np.linalg.norm(base_vec) / max(np.linalg.norm(ref_vec), 1e-6))
    angle = math.atan2(base_vec[1], base_vec[0]) - math.atan2(ref_vec[1], ref_vec[0])
    return base_center, ref_center, scale, angle


def warp_to_base(ref: Image.Image, base_size, base_center, ref_center, scale, angle):
    """Return ``ref`` resampled so its eyes land on the base's eyes."""
    cos_a, sin_a = math.cos(-angle) / scale, math.sin(-angle) / scale

    def to_ref(px, py):
        dx, dy = px - base_center[0], py - base_center[1]
        return (cos_a * dx + sin_a * dy + ref_center[0],
                -sin_a * dx + cos_a * dy + ref_center[1])

    origin = to_ref(0, 0)
    step_x = to_ref(1, 0)
    step_y = to_ref(0, 1)
    coeffs = (step_x[0] - origin[0], step_y[0] - origin[0], origin[0],
              step_x[1] - origin[1], step_y[1] - origin[1], origin[1])
    return ref.transform(base_size, Image.AFFINE, coeffs, resample=Image.BICUBIC)


def eye_mask(size, centers):
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    for cx, cy in centers:
        draw.ellipse([cx - EYE_RX, cy - EYE_RY, cx + EYE_RX, cy + EYE_RY], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(5))


def ring_mask(size, centers):
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    for cx, cy in centers:
        draw.ellipse([cx - RING_RX, cy - RING_RY, cx + RING_RX, cy + RING_RY], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(3))


def mean_diff(a: Image.Image, b: Image.Image):
    na = np.asarray(a.convert('RGBA')).astype(int)
    nb = np.asarray(b.convert('RGBA')).astype(int)
    per_pixel = np.abs(na - nb).mean(axis=2)
    ys, xs = np.nonzero(per_pixel > 8)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None
    return float(per_pixel.mean()), int((per_pixel > 8).sum()), box


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--base', default='frames/breathopen.png')
    parser.add_argument('--ref', default='frames/breath.png')
    parser.add_argument('--out', default='frames/breathopen_closed.png')
    parser.add_argument('--debug-dir', default=None)
    args = parser.parse_args()

    here = Path(__file__).resolve().parent
    assets = here.parents[1] / 'assets' / 'ranran'
    base_path = (assets / args.base) if not Path(args.base).is_absolute() else Path(args.base)
    ref_path = (assets / args.ref) if not Path(args.ref).is_absolute() else Path(args.ref)
    out_path = (assets / args.out) if not Path(args.out).is_absolute() else Path(args.out)

    base = Image.open(base_path).convert('RGBA')
    ref = Image.open(ref_path).convert('RGBA')

    base_pair = np.array(pick_eyes(dark_components(base)))
    ref_pair = np.array(pick_eyes(dark_components(ref)))
    print('base eyes:', base_pair.round(1).tolist(), ' ref eyes:', ref_pair.round(1).tolist())

    base_center, ref_center, scale, angle = similarity(base_pair, ref_pair)
    print('scale %.4f  rotation %.2f deg' % (scale, math.degrees(angle)))
    warped = warp_to_base(ref, base.size, base_center, ref_center, scale, angle)

    centers = [tuple(base_pair[0]), tuple(base_pair[1])]
    mask = eye_mask(base.size, centers)
    ring = ring_mask(base.size, centers)
    ring_np = np.asarray(ring).astype(float) / 255.0
    core_np = np.asarray(mask).astype(float) / 255.0

    alpha = np.asarray(base)[:, :, 3] > 200
    ring_only = np.clip(ring_np - core_np, 0, 1)
    valid = alpha & (ring_only > 0.5)
    warped_rgb = np.asarray(warped.convert('RGB')).astype(float)
    base_rgb = np.asarray(base.convert('RGB')).astype(float)
    delta = np.array([(base_rgb[:, :, i][valid] - warped_rgb[:, :, i][valid]).mean() for i in range(3)])
    print('skin tone offset on eyes ring:', delta.round(1).tolist())

    patch_rgb = np.clip(warped_rgb + delta, 0, 255)
    patch = Image.fromarray(np.dstack([patch_rgb, np.asarray(warped)[:, :, 3]]).astype(np.uint8), 'RGBA')
    result = Image.composite(patch, base, mask)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(out_path)
    mean, changed, box = mean_diff(base, result)
    print('written %s' % out_path)
    print('mean abs diff vs base: %.3f  changed px: %d  bbox: %s' % (mean, changed, box))

    if args.debug_dir:
        debug = Path(args.debug_dir)
        debug.mkdir(parents=True, exist_ok=True)
        warped.save(debug / 'blink-warped.png')
        result.save(debug / 'blink-result.png')
        print('debug images written to %s' % debug)


if __name__ == '__main__':
    main()
