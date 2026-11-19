# 动作动画提示词包（视频模型 → WebP/GIF）

给每个动作准备的提示词，拿去喂视频模型（可灵 / 即梦 / 海螺 / Runway / Veo / Sora 皆可），
生成 3~4 秒短片，再转成循环动画喂给插件。比"两张图硬切"丝滑得多，因为动作是真的连续。

## 怎么用（三步）

1. **图生视频**：把每个动作对应的现有帧当**首帧参考图**上传（`assets/ranran/frames/<帧名>.png`），
   角色一致性全靠它；再把下面的提示词粘进去。
2. **出片**：竖构图、3~4 秒、固定机位、纯色背景（绿幕最好），不要字幕/水印/转场。
3. **转动画**：跑 `powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\tools\video_to_anim.ps1 -In <视频> -Name idle -Bg green`
   → 直接得到 `assets/ranran/anim/idle.webp`（同时给一份 `.gif` 备用），放进仓库即可。

> **为什么推荐 WebP 而不是 GIF**：GIF 只有 256 色 + 1 位透明，边缘全是锯齿，
> 体积还大得离谱——同一段动画实测 GIF 是 WebP 的 **26 倍**（4220KB vs 159KB）。
> 插件两种都认（优先 `.webp`，没有再用 `.gif`），但导进仓库的请优先用 WebP。

## 通用规则（每条提示词都默认满足）

- **角色**：Q 版二次元软水彩，白兔耳兜帽小女孩，黑色齐刘海短发，白色连帽卫衣、
  粉色短裙、白袜，怀里常抱一只红色小蚂蚁玩偶。与参考图完全一致，不要换脸换衣服。
- **构图**：全身正面立绘，头顶与脚底留一点余量，角色居中偏下。
- **背景**：纯绿色幕布（`#00FF00`）或纯浅米色，干净无渐变、无道具、无地面阴影以外的杂物。
- **镜头**：固定机位，不推拉不摇移不缩放，不要景深变化。
- **动作**：单一动作、小幅度、匀速；首帧与末帧姿势尽量接近，方便循环。
- **时长**：3~4 秒；24 或 30 fps；输出至少 720×1088（竖）。
- **禁止**：字幕、文字、水印、logo、转场、镜头切换、多人、额外角色。

## 逐动作提示词

索引（轨道名 → 现有帧 → 建议时长 → 循环方式）：

| # | 轨道 | 现有帧 | 时长 | 循环 |
| --- | --- | --- | --- | --- |
| 1 | `idle` | breathopen / breath | 4s | 无缝循环 |
| 2 | `listening` | earperk | 3s | 无缝循环 |
| 3 | `thinking` | divine | 3s | 无缝循环 |
| 4 | `tool:ink` | grindink | 4s | 无缝循环 |
| 5 | `tool:wind` | ridewind | 3s | 无缝循环 |
| 6 | `tool:sniff` | sniff | 3s | 无缝循环 |
| 7 | `tool:gaze` | gaze | 4s | 无缝循环 |
| 8 | `tool:chess` | chess | 4s | 无缝循环 |
| 9 | `review` | unroll | 4s | 无缝循环 |
| 10 | `done` | lantern | 3s | 单次（尾帧≈首帧） |
| 11 | `failed` | tailhug | 3s | 无缝循环 |
| 12 | `waiting` | earperk | 3s | 无缝循环 |
| 13 | `poke1~4` | 复用现有帧 | 2s | 单次 |

---

### 1. idle · 坐忘吐纳

**中文**：同一个角色（白兔耳兜帽小女孩）。画她盘腿坐着，双手轻轻放在膝上，怀里抱着红色小蚂蚁玩偶。
胸腔随呼吸缓慢起伏，肩膀随之微微上下；约第 3 秒轻轻眨一次眼再睁开；兔耳和额前发丝随呼吸轻微摆动。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩风格，动作柔缓，首尾姿势一致可无缝循环，4 秒。

**English**: Same chibi girl in a white bunny-ear hoodie, sitting cross-legged with a small red ant plush in her lap.
Her chest and shoulders rise and fall slowly with each breath; around second 3 she blinks slowly once and opens her eyes;
bunny ears and bangs sway subtly. Locked-off camera, full body front view, pure green screen background,
soft watercolor anime style, gentle motion, seamless loop, 4 seconds.

---

### 2. listening · 竖耳倾听

**中文**：同一个角色。画她坐着，白色兔耳忽然竖起并朝画面左侧倾斜，头微微转向左侧，
眼睛睁大，身体前倾半寸，耳朵带着细小的颤动。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，
3 秒无缝循环。

**English**: Same character, seated. Her white bunny ears perk up and tilt toward the left of frame,
head turning slightly left, eyes widen, body leans forward a little, ears trembling faintly.
Locked-off camera, full body, green screen, soft watercolor anime, seamless 3 s loop.

---

### 3. thinking · 掐指推算

**中文**：同一个角色。画她盘腿而坐，双手抬到胸前掐诀推算，手指小幅快速点动交替，
眉头微蹙、眼睛半闭，视线停在前方空中，头部轻轻左右微晃像在默数。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character sitting cross-legged, hands raised to her chest doing a fortune-telling mudra,
fingers tapping in small quick alternation, brows slightly knitted, eyes half closed, gaze floating ahead,
head swaying a little as if counting. Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

---

### 4. tool:ink · 砚前磨墨

**中文**：同一个角色。画她跪坐在矮桌前，双手握墨锭在砚台上缓慢画圈磨墨，动作匀速，
肩膀随手腕小幅度前后起伏，低头专注，桌上铺着宣纸，纸角被呼吸带得轻动。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环。

**English**: Same character kneeling at a low desk, holding an ink stick and grinding ink in slow circles on an inkstone,
steady rhythm, shoulders shifting slightly with the motion, head down in concentration, rice paper on the desk stirring faintly.
Locked-off camera, full body, green screen, watercolor anime, seamless 4 s loop.

---

### 5. tool:wind · 御风疾行

**中文**：同一个角色。画她张开双臂站在风中，衣摆、短裙和发丝持续向后飘动，兔耳被风压得向后倒，
脚边有一缕淡青色风纹缓缓流动，身体随气流轻轻前后摇晃，表情轻快。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character standing with arms spread in the wind, hoodie hem, skirt and hair flowing backward continuously,
bunny ears pressed back by the wind, a wisp of pale cyan wind curling around her feet, body swaying gently, cheerful expression.
Locked-off camera, full body, green screen, watercolor anime, seamless 3 s loop.

---

### 6. tool:sniff · 俯身嗅风

**中文**：同一个角色。画她微微踮起脚尖，鼻尖轻轻抽动嗅了嗅，一绺发丝和一只兔耳朝风向歪过去，
眼睛亮亮的，头小幅转动像在分辨气味，随后回到原位。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character on tiptoe, nose twitching as she sniffs the air, a strand of hair and one bunny ear leaning with the breeze,
eyes bright, head turning slightly as if identifying a scent, then easing back.
Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

---

### 7. tool:gaze · 抬手望山

**中文**：同一个角色。画她一手搭在额前遮光，微微仰头望向远处，风把裙摆和发丝吹向一侧，
身体重心缓缓左右移动，眼睛微微眯起，兔耳偶尔抖一下。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环。

**English**: Same character shading her eyes with one hand, chin lifted to look into the distance,
wind pushing her skirt and hair to one side, weight shifting slowly left and right, eyes narrowing, ears twitching now and then.
Locked-off camera, full body, green screen, watercolor anime, seamless 4 s loop.

---

### 8. tool:chess · 棋盘落子

**中文**：同一个角色。画她坐在棋盘前，两指捏着一枚棋子悬在棋盘上方停顿片刻，然后轻轻落下，
再抬手指向下一处，歪头思考，视线在棋盘上移动。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环（末帧回到举棋悬停）。

**English**: Same character seated at a Go board, holding a stone between two fingers, hovering briefly, then placing it gently,
lifting the hand again toward the next point, head tilted in thought, eyes moving across the board.
Locked-off camera, full body, green screen, watercolor anime, 4 s seamless loop ending back in the hovering pose.

---

### 9. review · 展卷阅读

**中文**：同一个角色。画她双手捧着一卷展开的长卷轴，低头阅读，视线沿卷轴从左向右缓慢移动，
眉头偶尔轻动，卷轴纸面随呼吸微微起伏，发丝垂落。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环。

**English**: Same character holding an unrolled scroll in both hands, reading with head down,
gaze traveling slowly across the scroll, brows shifting now and then, paper breathing faintly, hair hanging.
Locked-off camera, full body, green screen, watercolor anime, seamless 4 s loop.

---

### 10. done · 点灯

**中文**：同一个角色。画她双手捧着一盏暖黄色小灯笼，灯笼里的火光轻轻跳动、明暗呼吸，
暖光在脸上和兜帽上晃动，她安静地微笑，眼睛弯起。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒单次播放，尾帧姿势与首帧接近。

**English**: Same character cupping a small warm-yellow lantern, the flame flickering and breathing inside,
warm light wavering on her face and hood, a quiet smile, eyes curving.
Locked-off camera, full body, green screen, watercolor anime, 3 s single shot, last pose close to the first.

---

### 11. failed · 抱尾自省

**中文**：同一个角色。画她坐下来抱住自己毛绒绒的白兔尾巴，脸轻轻贴在尾巴上，
肩膀缓慢起伏（像在叹气），尾巴被抱得微微变形，兔耳无力地垂下。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character sitting and hugging her fluffy white bunny tail, cheek resting against it,
shoulders rising and falling slowly like a sigh, tail slightly squished, ears drooping.
Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

---

### 12. waiting · 歪头等令

**中文**：同一个角色。画她头歪向一侧，一边兔耳高一边低，时不时眨一下眼，
一只脚尖轻轻点地打拍子，表情耐心又有点期待。
固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character tilting her head to one side, one bunny ear up and one down, blinking now and then,
one toe tapping the ground lightly, patient and slightly hopeful.
Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

---

### 13. poke1~4 · 点击互动（各 2 秒单次）

现在点她只是借用别的轨道，做了专属动画后改 `pet.json` 的 `poke1~4` 即可。

| 轨道 | 中文 | English |
| --- | --- | --- |
| `poke1` | 被你戳到，先是眨眼一愣，然后弯起眼睛笑，兔耳跟着抖一下。 | Poked: blinks in surprise, then smiles, ears flicking once. |
| `poke2` | 耳朵被戳，她歪头躲了一下，耳朵像果冻一样弹回来。 | Ears poked: she tilts away, ears jiggling back like jelly. |
| `poke3` | 把怀里的小蚂蚁抱得更紧，低头蹭了蹭它的头。 | Hugs the little ant plush tighter and nuzzles its head. |
| `poke4` | 抬头看你，眼睛慢慢睁大，歪头，然后有点害羞地移开视线。 | Looks up at you, eyes widening, head tilting, then shyly looks away. |

公共后缀：固定机位、全身正面、纯绿背景、Q 版二次元软水彩、2 秒、首尾姿势接近。

## 交付规格

| 项 | 要求 |
| --- | --- |
| 尺寸 | 竖构图 9:13.6（≈344:520）；源片至少 720×1088 |
| 时长 | 2~4 秒（越短越容易做出无缝循环） |
| 帧率 | 24 或 30 fps 源片，转动画时降到 12~15 fps 省体积 |
| 背景 | 纯绿 `#00FF00` 或纯浅米色，不能有渐变/纹理/地面杂物 |
| 体积 | 单个 `.webp` 建议 ≤ 800KB（超过就降 fps 或裁尺寸） |
| 命名 | `assets/ranran/anim/<轨道名，冒号换连字符>.webp`，如 `tool-ink.webp` |

## 转换命令

```powershell
# 绿幕 → 透明 → 裁边缩放 344×520 → WebP（同时导出一份 GIF 备用）
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\tools\video_to_anim.ps1 `
  -In .\idle.mp4 -Name idle -Bg green -Fps 14

# 已经是随机透明/纯色底、不需要抠色
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\tools\video_to_anim.ps1 `
  -In .\idle.mp4 -Name idle -Bg none
```

脚本做的事：ffmpeg 抽帧（`--fps`，可选 `colorkey` 抠绿）→ 按所有帧透明区域的并集裁边
→ 等比缩放到 344×520 居中补透明 → Pillow 写 `assets/ranran/anim/<name>.webp`
→ 再用 ffmpeg 出一份同名 `.gif`（palettegen 保留透明）。

实测对比（一段 10 秒、720×1088 的绿幕测试片转成 344×520）：**WebP 159KB，GIF 4220KB**，
差了 26 倍，而 GIF 只有 256 色、边缘还有锯齿。所以别把 GIF 当交付物，它只是兜底。

## 接入清单

1. 视频转好后放到 `assets/ranran/anim/`，文件名对上轨道（`idle.webp`、`tool-ink.webp`…）。
2. `pet.json` 里该轨道的 `frames` 保留（做回退用），不用改。
3. 重新载入插件（Host 只缓存文件内容，改了资源刷新页面即可看到）。
4. `node tests/smoke-host.mjs` 会校验 `anim/idle.webp` 能正常读出。

多帧轨道会自动优先播 `anim/<轨道>.webp`，没有就试 `.gif`，再没有就回落到静态首帧。
