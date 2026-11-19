"""Remove the light "豆包AI生成" watermark from the bottom-right corner of pet frames.

The watermark is a right-aligned beige-gray glyph row (glyph tops y ≥ 498) over
transparent background or the soft ground shadow. Detection: strict anchor
components prove the row exists, then the row rectangle absorbs adjacent
in-band fragments while skipping solid shapes (fur chunks, ant feet, blobs).
Inpainting fills masked pixels from background-only sources — unmasked text
remnants never act as sources, so partial coverage cannot smear dark glyph
colour into the result; a second pass peels whatever the first missed.

Usage:
  python remove_watermark.py <frame.png|dir> [--preview <out.png>] [--apply]
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

# search window: bottom-right corner
X0, Y0 = 150, 450
# watermark row: right-aligned "豆包AI生成", glyph tops in y ≥ 498, beige-gray
BAND_Y = 498          # anchor components must start below this
SWEEP_Y = 494         # mask sweep never starts above this line
RIGHT_MIN = 250       # anchor right edge must reach this far
RB_RANGE = (12, 42)   # text warmth: mean R-B
LUM_RANGE = (140, 232)
ROW_MAX_W = 130       # row rectangle never reaches further left than this
ABSORB_GAP = 12       # in-band fragments within this gap join the row
DILATE = 2            # catch anti-aliased halo around glyphs
PAD = 24              # inpaint works on the mask bbox grown by this margin
PASSES = 2            # detect+inpaint iterations

# per-frame text-row rectangles (x0, y0, x1, y1), hand-measured from gridded
# zooms of the 12 Doubao frames; the anchor path handles any future frame
RECTS = {
    "breath":     (263, 503, 333, 520),
    "breathopen": (260, 499, 328, 520),
    "chess":      (283, 500, 344, 520),
    "divine":     (257, 503, 325, 520),
    "earperk":    (259, 502, 330, 520),
    "gaze":       (243, 497, 312, 520),
    "grindink":   (276, 496, 343, 520),
    "lantern":    (244, 503, 312, 520),
    "ridewind":   (278, 503, 344, 520),
    "sniff":      (243, 497, 310, 520),
    "tailhug":    (256, 506, 330, 520),
    "unroll":     (258, 503, 325, 520),
}


def components(mask):
    """4-connected components of a bool mask → list of pixel-index arrays."""
    labels = np.zeros(mask.shape, dtype=np.int32)
    comps = []
    for sy, sx in zip(*np.nonzero(mask)):
        if labels[sy, sx]:
            continue
        label = len(comps) + 1
        labels[sy, sx] = label
        q = deque([(sy, sx)])
        pixels = [(sy, sx)]
        while q:
            y, x = q.popleft()
            for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = label
                    q.append((ny, nx))
                    pixels.append((ny, nx))
        comps.append(np.array(pixels))
    return comps


def dilate(mask, passes):
    for _ in range(passes):
        grew = mask.copy()
        grew[1:, :] |= mask[:-1, :]
        grew[:-1, :] |= mask[1:, :]
        grew[:, 1:] |= mask[:, :-1]
        grew[:, :-1] |= mask[:, 1:]
        mask = grew
    return mask


def mask_from_rect(rgba, rect, solid_n=300):
    """Mask candidates inside a hand-measured text rectangle. Protects pixels
    near the saturated red ant body and big solid comps (fur, feet, desk leg);
    everything else faint in the rect is glyph or shadow and refills invisibly."""
    h, w, _ = rgba.shape
    x1, y1 = min(X0, w), min(Y0, h)
    region = rgba[y1:, x1:, :].astype(np.float32)
    a = region[..., 3]
    lum = region[..., :3].mean(axis=2)
    sat = region[..., :3].max(axis=2) - region[..., :3].min(axis=2)
    cand = (a > 20) & (lum > 105) & (sat < 85)
    rx0, ry0, rx1, ry1 = rect
    rect_mask = np.zeros(region.shape[:2], dtype=bool)
    rect_mask[max(0, ry0 - y1):min(h, ry1) - y1, max(0, rx0 - x1):min(w, rx1) - x1] = True
    protect = dilate(sat >= 90, 2)
    protect |= (a >= 210) & (lum <= 118)     # opaque dark: art outline strokes
    for comp in components(cand):
        if len(comp) >= solid_n:
            protect[comp[:, 0], comp[:, 1]] = True
    mask = cand & rect_mask & ~protect
    full = np.zeros((h, w), dtype=bool)
    forbid = np.zeros((h, w), dtype=bool)
    full[y1:, x1:] = dilate(mask, DILATE)
    forbid[y1:, x1:] = (cand & ~mask) | protect
    return full, forbid


def analyze(rgba):
    """→ (mask, forbid): pixels to clear, and candidate pixels never to fill from."""
    h, w, _ = rgba.shape
    x1, y1 = min(X0, w), min(Y0, h)
    region = rgba[y1:, x1:, :].astype(np.float32)
    r, g, b, a = region[..., 0], region[..., 1], region[..., 2], region[..., 3]
    lum = (r + g + b) / 3
    sat = region[..., :3].max(axis=2) - region[..., :3].min(axis=2)
    cand = (a > 20) & (lum > 105) & (sat < 85)
    full = np.zeros((h, w), dtype=bool)
    forbid = np.zeros((h, w), dtype=bool)

    # stage 1: strict anchors prove the right-aligned text row exists
    band = np.zeros(region.shape[:2], dtype=bool)
    band[BAND_Y - y1:, :] = True
    anchor_cand = (a > 25) & (lum > 110) & (lum <= LUM_RANGE[1] + 8) & (sat < 80) & band
    row = np.zeros(region.shape[:2], dtype=bool)
    rx0 = rx1 = None
    for comp in components(anchor_cand):
        ys, xs = comp[:, 0], comp[:, 1]
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        fill = len(comp) / (bw * bh)
        if len(comp) < 8 or bw > 150 or bh > 20 or fill > 0.62:
            continue
        rb = (r[ys, xs] - b[ys, xs]).mean()
        lm = lum[ys, xs].mean()
        if not (RB_RANGE[0] <= rb <= RB_RANGE[1] and LUM_RANGE[0] <= lm <= LUM_RANGE[1]):
            continue
        if ys.min() + y1 < BAND_Y or xs.max() + x1 < RIGHT_MIN:
            continue
        row[ys, xs] = True
        rx0 = int(xs.min()) if rx0 is None else min(rx0, int(xs.min()))
        rx1 = int(xs.max()) if rx1 is None else max(rx1, int(xs.max()))
    if rx0 is None:
        forbid[y1:, x1:] = cand
        return full, forbid

    # stage 2: sweep every candidate inside the row's rectangle, protecting
    # solid structures (fur chunks, ant feet: big comps or anything near the
    # saturated red ant body) — glyphs and faint shadow bits get masked and
    # the inpaint refills the shadow bits invisibly
    lx = max(0, rx1 + 1 - ROW_MAX_W)
    rect = np.zeros(region.shape[:2], dtype=bool)
    rect[SWEEP_Y - y1:, lx:rx1 + 1] = True
    wide = np.zeros(region.shape[:2], dtype=bool)
    top = max(0, 470 - y1)
    wide[top:, :] = (a > 25)[top:, :] & (lum > 110)[top:, :] \
        & (lum <= LUM_RANGE[1] + 8)[top:, :] & (sat < 80)[top:, :]
    solid = np.zeros(region.shape[:2], dtype=bool)
    for comp in components(wide):
        if len(comp) > 150:
            solid[comp[:, 0], comp[:, 1]] = True
    near_sat = dilate(sat >= 90, 2)
    mask = cand & rect & ~solid & ~near_sat
    full[y1:, x1:] = dilate(mask, DILATE)
    forbid[y1:, x1:] = cand & ~mask
    return full, forbid


def shifted(arr, dy, dx):
    """result[y, x] = arr[y+dy, x+dx], out-of-bounds = 0 (spatial axes only)."""
    by, ay = max(-dy, 0), max(dy, 0)
    bx, ax = max(-dx, 0), max(dx, 0)
    pad = [(by, ay), (bx, ax)] + [(0, 0)] * (arr.ndim - 2)
    p = np.pad(arr, pad)
    return p[max(dy, 0):max(dy, 0) + arr.shape[0], max(dx, 0):max(dx, 0) + arr.shape[1]]


def inpaint(rgba, mask, forbid):
    """Fill masked pixels from background-only sources: unmasked candidate
    (text remnant) pixels never contribute, so glyph colour cannot smear."""
    ysn, xsn = np.nonzero(mask)
    y0, y1c = max(0, ysn.min() - PAD), min(rgba.shape[0], ysn.max() + 1 + PAD)
    x0, x1c = max(0, xsn.min() - PAD), min(rgba.shape[1], xsn.max() + 1 + PAD)
    img = rgba[y0:y1c, x0:x1c].astype(np.float32)
    m = mask[y0:y1c, x0:x1c]
    fb = forbid[y0:y1c, x0:x1c]

    prem = img.copy()
    prem[..., :3] *= img[..., 3:4] / 255.0
    bg = ~(m | fb)                            # original background: always a source
    filled = np.zeros(m.shape, dtype=bool)
    for _ in range(80):
        if filled.all():
            break
        source = bg | filled
        kcount = np.zeros(img.shape[:2], dtype=np.float32)
        ksum = np.zeros(img.shape[:2] + (4,), dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                kcount += shifted(source.astype(np.float32), dy, dx)
                ksum += shifted(prem * source[..., None], dy, dx)
        newly = m & ~filled & (kcount > 0)
        if not newly.any():
            break
        prem[newly] = ksum[newly] / kcount[newly][:, None]
        filled[newly] = True

    out = img.copy()
    vals = prem[m]
    fa = np.maximum(vals[..., 3], 1.0)[..., None]
    vals = np.concatenate([np.clip(vals[..., :3] / fa, 0, 255), vals[..., 3:]], axis=1)
    out[m] = vals
    result = rgba.copy()
    result[y0:y1c, x0:x1c] = out.round().astype(np.uint8)
    return result


def run_pass(rgba, name=None):
    """One detect+inpaint iteration; returns (cleaned_rgba, n_masked)."""
    if name is not None and name in RECTS:
        rect = RECTS[name]
        mask, forbid = mask_from_rect(rgba, rect, solid_n=2000 if name == "tailhug" else 300)
    else:
        mask, forbid = analyze(rgba)
    n = int(mask.sum())
    if n == 0:
        return rgba, 0
    cleaned = inpaint(rgba, mask, forbid)
    return cleaned, n


def process(path, apply):
    rgba = np.array(Image.open(path).convert("RGBA"))
    total = 0
    for _ in range(PASSES):
        rgba, n = run_pass(rgba, name=path.stem)
        total += n
        if n == 0:
            break
    if apply and total:
        Image.fromarray(rgba, "RGBA").save(path)
    return total


def preview(frames, out):
    """Before/after contact sheet of the corner region for eyeball check."""
    Z = 3
    box = (X0, Y0, 344, 520)
    cw, ch = box[2] - box[0], box[3] - box[1]
    sheet = Image.new("RGB", (2 * (cw * Z + 8) + 8, len(frames) * (ch * Z + 8) + 8), (90, 90, 100))
    for i, f in enumerate(frames):
        rgba = np.array(Image.open(f).convert("RGBA"))
        orig = rgba.copy()
        total = 0
        for _ in range(PASSES):
            rgba, n = run_pass(rgba, name=f.stem)
            total += n
            if n == 0:
                break
        for col, arr in ((0, orig), (1, rgba)):
            im = Image.fromarray(arr, "RGBA")
            bg = Image.new("RGBA", im.size, (140, 140, 150, 255))
            bg.alpha_composite(im)
            crop = bg.crop(box).resize((cw * Z, ch * Z), Image.NEAREST)
            sheet.paste(crop.convert("RGB"), (8 + col * (cw * Z + 8), 8 + i * (ch * Z + 8)))
        print(f"{f.stem}: {total} px cleaned")
    sheet.save(out)
    print("preview →", out)


def main():
    args = sys.argv[1:]
    apply = "--apply" in args
    preview_path = None
    if "--preview" in args:
        preview_path = args[args.index("--preview") + 1]
    args = [a for a in args if a not in ("--preview", preview_path, "--apply")]
    targets = []
    for arg in args:
        p = Path(arg)
        if p.is_dir():
            targets.extend(sorted(p.glob("*.png")))
        else:
            targets.append(p)
    if preview_path and not apply:
        preview(targets, preview_path)
        return
    for f in targets:
        n = process(f, apply)
        print(f"{f.stem}: {n} px cleaned")


if __name__ == "__main__":
    main()
