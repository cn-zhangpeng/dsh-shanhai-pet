#!/usr/bin/env python
"""视频 → 灵宠循环动画（WebP + GIF）。

把视频模型出的短片（绿幕或已带透明通道）转成插件能直接播的动画：

    python tests/tools/video_to_anim.py -i idle.mp4 -n idle --bg green

流程：ffmpeg 抽帧（按 --fps，可选 colorkey 抠绿）→ 按所有帧透明区域的并集裁边
→ 等比缩放到 344×520 居中补透明 → Pillow 写 assets/ranran/anim/<name>.webp
→ 再用 ffmpeg 出一份同名 .gif 备用。

依赖：ffmpeg 在 PATH 里（或 --ffmpeg 指定绝对路径），Python 侧只要 Pillow。
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ANIM_DIR = ROOT / "assets" / "ranran" / "anim"


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout + "\n" + proc.stderr + "\n")
        raise SystemExit(f"命令失败：{' '.join(cmd[:3])} …")


def extract_frames(ffmpeg: str, src: Path, out_dir: Path, args) -> int:
    filters = [f"fps={args.fps}"]
    if args.bg == "green":
        filters.append(f"colorkey={args.key_color}:{args.similarity}:{args.blend}")
    vf = ",".join(filters)
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
    if args.start:
        cmd += ["-ss", str(args.start)]
    if args.duration:
        cmd += ["-t", str(args.duration)]
    cmd += ["-i", str(src), "-vf", vf, "-pix_fmt", "rgba", str(out_dir / "f%05d.png")]
    run(cmd)
    frames = sorted(out_dir.glob("f*.png"))
    return len(frames)


def content_bbox(frames: list[Image.Image], threshold: int = 8):
    """所有帧透明区域的并集外框：裁掉大片空白，让角色尽量填满画布。"""
    left = top = 10**9
    right = bottom = -1
    for frame in frames:
        alpha = frame.getchannel("A").point(lambda a: 255 if a > threshold else 0)
        box = alpha.getbbox()
        if not box:
            continue
        left = min(left, box[0])
        top = min(top, box[1])
        right = max(right, box[2])
        bottom = max(bottom, box[3])
    if right < 0:
        return None
    return (left, top, right, bottom)


def fit_bounds(frames: list[Image.Image], box, width: int, height: int) -> list[Image.Image]:
    """按并集外框裁切，再等比缩放到 width×height 内居中（保持透明边）。"""
    left, top, right, bottom = box
    bw, bh = right - left, bottom - top
    scale = min(width / bw, height / bh)
    out_w, out_h = max(1, round(bw * scale)), max(1, round(bh * scale))
    out: list[Image.Image] = []
    for frame in frames:
        crop = frame.crop((left, top, right, bottom))
        resized = crop.resize((out_w, out_h), Image.LANCZOS)
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((width - out_w) // 2, (height - out_h) // 2))
        out.append(canvas)
    return out


def save_webp(frames: list[Image.Image], target: Path, fps: int, quality: int) -> None:
    durations = [max(20, round(1000 / fps))] * len(frames)
    frames[0].save(
        target,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        quality=quality,
        method=6,
    )


def save_gif(ffmpeg: str, frames_dir: Path, target: Path, fps: int, width: int, height: int) -> bool:
    """透明 GIF：palettegen 保留透明色 + paletteuse 按 alpha 二值化。"""
    pattern = str(frames_dir / "g%05d.png")
    palette = str(frames_dir / "palette.png")
    try:
        run([
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", str(fps), "-i", pattern,
            "-vf", f"fps={min(fps, 12)},split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128",
            "-loop", "0", str(target),
        ])
    except SystemExit:
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="视频转灵宠循环动画")
    parser.add_argument("-i", "--in", dest="src", required=True, help="输入视频")
    parser.add_argument("-n", "--name", dest="name", required=True, help="轨道名，如 idle / tool-ink")
    parser.add_argument("--bg", choices=["green", "none"], default="green", help="green=抠绿幕，none=源片自带透明")
    parser.add_argument("--key-color", default="0x00FF00", help="绿幕颜色，默认 0x00FF00")
    parser.add_argument("--similarity", type=float, default=0.30)
    parser.add_argument("--blend", type=float, default=0.10)
    parser.add_argument("--fps", type=int, default=14)
    parser.add_argument("--start", type=float, default=0.0, help="从第几秒开始截")
    parser.add_argument("--duration", type=float, default=0.0, help="截多长，0=整段")
    parser.add_argument("--width", type=int, default=344)
    parser.add_argument("--height", type=int, default=520)
    parser.add_argument("--quality", type=int, default=88)
    parser.add_argument("--no-crop", action="store_true", help="不做透明区域裁边")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="ffmpeg 可执行文件路径")
    parser.add_argument("--out-dir", default=str(ANIM_DIR))
    args = parser.parse_args()

    src = Path(args.src).resolve()
    if not src.is_file():
        raise SystemExit(f"找不到输入视频：{src}")
    ffmpeg = args.ffmpeg if Path(args.ffmpeg).is_file() else (shutil.which(args.ffmpeg) or "")
    if not ffmpeg:
        raise SystemExit("找不到 ffmpeg，请用 --ffmpeg 指定路径")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = args.name.replace(":", "-")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp) / "src"
        gif_dir = Path(tmp) / "gif"
        tmp_dir.mkdir()
        gif_dir.mkdir()

        count = extract_frames(ffmpeg, src, tmp_dir, args)
        if count == 0:
            raise SystemExit("没抽到帧：检查 --start / --duration 是否超出视频长度")
        frames = [Image.open(p).convert("RGBA") for p in sorted(tmp_dir.glob("f*.png"))]

        if not args.no_crop:
            box = content_bbox(frames)
            if box:
                frames = fit_bounds(frames, box, args.width, args.height)
        else:
            frames = [
                f.resize((args.width, args.height), Image.LANCZOS) if f.size != (args.width, args.height) else f
                for f in frames
            ]

        webp = out_dir / f"{name}.webp"
        save_webp(frames, webp, args.fps, args.quality)

        for index, frame in enumerate(frames, start=1):
            frame.save(gif_dir / f"g{index:05d}.png")

        gif = out_dir / f"{name}.gif"
        made_gif = save_gif(ffmpeg, gif_dir, gif, args.fps, args.width, args.height)

    size_kb = webp.stat().st_size / 1024
    print(f"{name}: {len(frames)} 帧 / {args.fps} fps → {webp} ({size_kb:.0f} KB)")
    if made_gif:
        print(f"  备用 GIF → {gif} ({gif.stat().st_size / 1024:.0f} KB)")
    if size_kb > 800:
        print("  提示：超过 800KB，可以降低 --fps 或用 --width/--height 缩小")


if __name__ == "__main__":
    main()
