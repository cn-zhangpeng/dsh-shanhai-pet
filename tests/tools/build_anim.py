"""把多帧轨道合成一张循环播放的动态 WebP，放在 assets/ranran/anim/<track>.webp。

思路：豆包给的「睁眼 / 闭眼」两张图姿势几乎一样，只是眼睛与轻微呼吸差别；
硬切会像"闪一下"，所以这里在两张之间插几帧交叉淡入淡出，做成真正的眨眼动画。

跑法：
    <bundled python> tests/tools/build_anim.py

会读取 assets/ranran/pet.json 里的轨道：
    "frames": [...], "durations": [...]（第 1 帧的 duration 当作"睁眼停留"）
多帧轨道才生成动图；单帧轨道跳过（客户端直接用 png）。

输出文件名把 `:` 换成 `-`（`tool:ink` → `anim/tool-ink.webp`），
客户端按同样的规则去取，取不到就回落到逐帧 png。
"""
import json
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ASSETS = os.path.join(ROOT, 'assets', 'ranran')
FRAMES = os.path.join(ASSETS, 'frames')
ANIM = os.path.join(ASSETS, 'anim')

# 相邻两帧之间插的过渡帧数 / 每帧时长（毫秒）。眨眼只有 200ms，
# 过渡必须短而快，否则交叉淡化会显出"叠影"。
BLEND_STEPS = 2
BLEND_MS = 30

# 两帧平均差小于该阈值时，认为底片相同、只是局部（如眼睛）变了，
# 直接硬切最干净：交叉淡化反而会在眼睛上糊出一层灰影。
BLEND_SKIP_DIFF = 6.0


def frame_diff(a, b):
    """两帧的平均绝对差（0..255），用于判断要不要加过渡帧。"""
    if a.size != b.size:
        return 255.0
    diff = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
    histogram = diff.convert('L').histogram()
    total = sum(histogram) or 1
    return sum(value * count for value, count in enumerate(histogram)) / total


def load_frame(name):
    return Image.open(os.path.join(FRAMES, name + '.png')).convert('RGBA')


def blend(a, b, alpha):
    """a 向 b 交叉淡入：alpha=0 全 a，alpha=1 全 b。"""
    return Image.blend(a, b, alpha) if a.size == b.size else a


def build_track(track):
    frames = track.get('frames') or []
    durations = track.get('durations') or []
    if len(frames) < 2:
        return None

    # 合并相邻重复帧（pet.json 里常见 A, B, A 的写法），并把首尾同名帧并成一次停留
    seq = []
    for index, name in enumerate(frames):
        hold = max(int(durations[index] if index < len(durations) else 400), 20)
        if seq and seq[-1][0] == name:
            seq[-1][1] += hold
        else:
            seq.append([name, hold])
    if len(seq) > 1 and seq[0][0] == seq[-1][0]:
        seq[0][1] += seq[-1][1]
        seq.pop()
    if len(seq) < 2:
        return None

    out, dur = [], []
    for index, (name, hold) in enumerate(seq):
        image = load_frame(name)
        out.append(image)
        dur.append(hold)
        # 到下一帧（循环时回到第 0 帧）之间插过渡帧；底片相同就硬切
        nxt = load_frame(seq[(index + 1) % len(seq)][0])
        if frame_diff(image, nxt) < BLEND_SKIP_DIFF:
            continue
        for step in range(1, BLEND_STEPS + 1):
            out.append(Image.blend(image, nxt, step / (BLEND_STEPS + 1)))
            dur.append(BLEND_MS)
    return out, dur


def main():
    manifest_path = os.path.join(ASSETS, 'pet.json')
    with open(manifest_path, 'r', encoding='utf-8') as handle:
        manifest = json.load(handle)

    tracks = (manifest.get('frames2d') or {}).get('tracks') or {}
    os.makedirs(ANIM, exist_ok=True)

    built = 0
    for name, track in tracks.items():
        result = build_track(track)
        if result is None:
            continue
        images, durations = result
        slug = name.replace(':', '-')
        target = os.path.join(ANIM, slug + '.webp')
        images[0].save(
            target,
            save_all=True,
            append_images=images[1:],
            duration=durations,
            loop=0,
            quality=92,
            method=6,
        )
        size = os.path.getsize(target)
        print(f'{name:12s} -> anim/{slug}.webp  {len(images)} 帧  {size / 1024:.0f} KB  '
              f'总时长 {sum(durations)} ms')
        built += 1

    if built == 0:
        print('没有多帧轨道，跳过。')
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
