# 逐条出片清单（提示词 ↔ 首帧图，一对一）

每条：**上传这张图** → **粘这段提示词** → 出 3~4 秒竖构图 → 存成 `<文件名>.mp4`。
图片来源：`assets/ranran/frames/*.png`（透明原图，344×520）；
上传用：`tests/out/firstframes-3x4/*.png`（已压纯绿 `#00FF00` 底、按 3:4 竖屏排好，1080×1440）。

---

## 出片参数（在界面上设，不写进提示词）

| 项 | 取值 | 说明 |
| --- | --- | --- |
| 画面比例 | **3:4** | 与首帧图（1080×1440）一致；比例由界面选项决定，写进提示词无效 |
| 分辨率 | **480P** 起步 | 最终只缩到 344×520，480P 足够；确认效果后再上 720P |
| 时长 | **2 秒** 起步 | 呼吸/眨眼这类小动作 2 秒就能循环，省钱 |
| 模式 | 图生视频（首帧） | 别开"全息参考"这类按参考时长计费的模式 |
| 首帧图 | `tests/out/firstframes-3x4/<轨道>.png` | 已是纯绿底 3:4，模型不需要自己裁 |

> **为什么提示词里不写"3:4"**：视频模型的画幅是**参数**，不是提示词——
> 在提示词里写"9:16 竖屏"多数模型直接忽略，个别还会理解成"画面里再放一个竖屏画框"。
> 真正管用的是界面上那个比例选择器；提示词里只保留"全身正面、人物居中、头顶留余量"这类构图描述。

---

## 1. idle · 坐忘吐纳

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\idle.png`

**中文**：同一个角色（白兔耳兜帽小女孩）。画她盘腿坐着，双手轻轻放在膝上，怀里抱着红色小蚂蚁玩偶。胸腔随呼吸缓慢起伏，肩膀随之微微上下；约第 3 秒轻轻眨一次眼再睁开；兔耳和额前发丝随呼吸轻微摆动。固定机位、全身正面、纯绿背景、Q 版二次元软水彩风格，动作柔缓，首尾姿势一致可无缝循环，4 秒。

**English**: Same chibi girl in a white bunny-ear hoodie, sitting cross-legged with a small red ant plush in her lap. Her chest and shoulders rise and fall slowly with each breath; around second 3 she blinks slowly once and opens her eyes; bunny ears and bangs sway subtly. Locked-off camera, full body front view, pure green screen background, soft watercolor anime style, gentle motion, seamless loop, 4 seconds.

**出片存为**：`idle.mp4` → 转成 `assets/ranran/anim/idle.webp`

---

## 2. listening · 竖耳倾听

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\listening.png`

**中文**：同一个角色。画她坐着，白色兔耳忽然竖起并朝画面左侧倾斜，头微微转向左侧，眼睛睁大，身体前倾半寸，耳朵带着细小的颤动。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character, seated. Her white bunny ears perk up and tilt toward the left of frame, head turning slightly left, eyes widen, body leans forward a little, ears trembling faintly. Locked-off camera, full body, green screen, soft watercolor anime, seamless 3 s loop.

**出片存为**：`listening.mp4` → `assets/ranran/anim/listening.webp`

---

## 3. thinking · 掐指推算

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\thinking.png`

**中文**：同一个角色。画她盘腿而坐，双手抬到胸前掐诀推算，手指小幅快速点动交替，眉头微蹙、眼睛半闭，视线停在前方空中，头部轻轻左右微晃像在默数。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character sitting cross-legged, hands raised to her chest doing a fortune-telling mudra, fingers tapping in small quick alternation, brows slightly knitted, eyes half closed, gaze floating ahead, head swaying a little as if counting. Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

**出片存为**：`thinking.mp4` → `assets/ranran/anim/thinking.webp`

---

## 4. tool:ink · 砚前磨墨

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\tool-ink.png`

**中文**：同一个角色。画她跪坐在矮桌前，双手握墨锭在砚台上缓慢画圈磨墨，动作匀速，肩膀随手腕小幅度前后起伏，低头专注，桌上铺着宣纸，纸角被呼吸带得轻动。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环。

**English**: Same character kneeling at a low desk, holding an ink stick and grinding ink in slow circles on an inkstone, steady rhythm, shoulders shifting slightly with the motion, head down in concentration, rice paper on the desk stirring faintly. Locked-off camera, full body, green screen, watercolor anime, seamless 4 s loop.

**出片存为**：`tool-ink.mp4` → `assets/ranran/anim/tool-ink.webp`

---

## 5. tool:wind · 御风疾行

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\tool-wind.png`

**中文**：同一个角色。画她张开双臂站在风中，衣摆、短裙和发丝持续向后飘动，兔耳被风压得向后倒，脚边有一缕淡青色风纹缓缓流动，身体随气流轻轻前后摇晃，表情轻快。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character standing with arms spread in the wind, hoodie hem, skirt and hair flowing backward continuously, bunny ears pressed back by the wind, a wisp of pale cyan wind curling around her feet, body swaying gently, cheerful expression. Locked-off camera, full body, green screen, watercolor anime, seamless 3 s loop.

**出片存为**：`tool-wind.mp4` → `assets/ranran/anim/tool-wind.webp`

---

## 6. tool:sniff · 俯身嗅风

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\tool-sniff.png`

**中文**：同一个角色。画她微微踮起脚尖，鼻尖轻轻抽动嗅了嗅，一绺发丝和一只兔耳朝风向歪过去，眼睛亮亮的，头小幅转动像在分辨气味，随后回到原位。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character on tiptoe, nose twitching as she sniffs the air, a strand of hair and one bunny ear leaning with the breeze, eyes bright, head turning slightly as if identifying a scent, then easing back. Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

**出片存为**：`tool-sniff.mp4` → `assets/ranran/anim/tool-sniff.webp`

---

## 7. tool:gaze · 抬手望山

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\tool-gaze.png`

**中文**：同一个角色。画她一手搭在额前遮光，微微仰头望向远处，风把裙摆和发丝吹向一侧，身体重心缓缓左右移动，眼睛微微眯起，兔耳偶尔抖一下。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环。

**English**: Same character shading her eyes with one hand, chin lifted to look into the distance, wind pushing her skirt and hair to one side, weight shifting slowly left and right, eyes narrowing, ears twitching now and then. Locked-off camera, full body, green screen, watercolor anime, seamless 4 s loop.

**出片存为**：`tool-gaze.mp4` → `assets/ranran/anim/tool-gaze.webp`

---

## 8. tool:chess · 棋盘落子

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\tool-chess.png`

**中文**：同一个角色。画她坐在棋盘前，两指捏着一枚棋子悬在棋盘上方停顿片刻，然后轻轻落下，再抬手指向下一处，歪头思考，视线在棋盘上移动。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环（末帧回到举棋悬停）。

**English**: Same character seated at a Go board, holding a stone between two fingers, hovering briefly, then placing it gently, lifting the hand again toward the next point, head tilted in thought, eyes moving across the board. Locked-off camera, full body, green screen, watercolor anime, 4 s seamless loop ending back in the hovering pose.

**出片存为**：`tool-chess.mp4` → `assets/ranran/anim/tool-chess.webp`

---

## 9. review · 展卷阅读

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\review.png`

**中文**：同一个角色。画她双手捧着一卷展开的长卷轴，低头阅读，视线沿卷轴从左向右缓慢移动，眉头偶尔轻动，卷轴纸面随呼吸微微起伏，发丝垂落。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，4 秒无缝循环。

**English**: Same character holding an unrolled scroll in both hands, reading with head down, gaze traveling slowly across the scroll, brows shifting now and then, paper breathing faintly, hair hanging. Locked-off camera, full body, green screen, watercolor anime, seamless 4 s loop.

**出片存为**：`review.mp4` → `assets/ranran/anim/review.webp`

---

## 10. done · 点灯

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\done.png`

**中文**：同一个角色。画她双手捧着一盏暖黄色小灯笼，灯笼里的火光轻轻跳动、明暗呼吸，暖光在脸上和兜帽上晃动，她安静地微笑，眼睛弯起。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒单次播放，尾帧姿势与首帧接近。

**English**: Same character cupping a small warm-yellow lantern, the flame flickering and breathing inside, warm light wavering on her face and hood, a quiet smile, eyes curving. Locked-off camera, full body, green screen, watercolor anime, 3 s single shot, last pose close to the first.

**出片存为**：`done.mp4` → `assets/ranran/anim/done.webp`

---

## 11. failed · 抱尾自省

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\failed.png`

**中文**：同一个角色。画她坐下来抱住自己毛绒绒的白兔尾巴，脸轻轻贴在尾巴上，肩膀缓慢起伏（像在叹气），尾巴被抱得微微变形，兔耳无力地垂下。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character sitting and hugging her fluffy white bunny tail, cheek resting against it, shoulders rising and falling slowly like a sigh, tail slightly squished, ears drooping. Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

**出片存为**：`failed.mp4` → `assets/ranran/anim/failed.webp`

---

## 12. waiting · 歪头等令

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\waiting.png`

**中文**：同一个角色。画她头歪向一侧，一边兔耳高一边低，时不时眨一下眼，一只脚尖轻轻点地打拍子，表情耐心又有点期待。固定机位、全身正面、纯绿背景、Q 版二次元软水彩，3 秒无缝循环。

**English**: Same character tilting her head to one side, one bunny ear up and one down, blinking now and then, one toe tapping the ground lightly, patient and slightly hopeful. Locked-off camera, full body, green screen, watercolor anime, 3 s seamless loop.

**出片存为**：`waiting.mp4` → `assets/ranran/anim/waiting.webp`

---

## 13. poke1 · 被戳一愣再笑

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\poke1.png`

**中文**：同一个角色。被你戳到，先是眨眼一愣，然后弯起眼睛笑，兔耳跟着抖一下。固定机位、全身正面、纯绿背景、Q 版二次元软水彩、2 秒、首尾姿势接近。

**English**: Poked: blinks in surprise, then smiles, ears flicking once. Locked-off camera, full body, green background, watercolor anime, 2 s, first and last pose close.

**出片存为**：`poke1.mp4` → `assets/ranran/anim/poke1.webp`

---

## 14. poke2 · 耳朵被戳

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\poke2.png`

**中文**：同一个角色。耳朵被戳，她歪头躲了一下，耳朵像果冻一样弹回来。固定机位、全身正面、纯绿背景、Q 版二次元软水彩、2 秒、首尾姿势接近。

**English**: Ears poked: she tilts away, ears jiggling back like jelly. Locked-off camera, full body, green background, watercolor anime, 2 s, first and last pose close.

**出片存为**：`poke2.mp4` → `assets/ranran/anim/poke2.webp`

---

## 15. poke3 · 抱紧小蚂蚁

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\poke3.png`

**中文**：同一个角色。把怀里的小蚂蚁抱得更紧，低头蹭了蹭它的头。固定机位、全身正面、纯绿背景、Q 版二次元软水彩、2 秒、首尾姿势接近。

**English**: Hugs the little ant plush tighter and nuzzles its head. Locked-off camera, full body, green background, watercolor anime, 2 s, first and last pose close.

**出片存为**：`poke3.mp4` → `assets/ranran/anim/poke3.webp`

---

## 16. poke4 · 抬头害羞

**图片**：`E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\out\firstframes-3x4\poke4.png`

**中文**：同一个角色。抬头看你，眼睛慢慢睁大，歪头，然后有点害羞地移开视线。固定机位、全身正面、纯绿背景、Q 版二次元软水彩、2 秒、首尾姿势接近。

**English**: Looks up at you, eyes widening, head tilting, then shyly looks away. Locked-off camera, full body, green background, watercolor anime, 2 s, first and last pose close.

**出片存为**：`poke4.mp4` → `assets/ranran/anim/poke4.webp`

---

## 附：原图对照（如需重出绿底图）

| 上传文件 | 原始帧 |
| --- | --- |
| `idle.png` / `poke1.png` | `frames/breathopen.png` |
| `listening.png` / `waiting.png` / `poke2.png` | `frames/earperk.png` |
| `thinking.png` | `frames/divine.png` |
| `tool-ink.png` | `frames/grindink.png` |
| `tool-wind.png` | `frames/ridewind.png` |
| `tool-sniff.png` | `frames/sniff.png` |
| `tool-gaze.png` / `poke4.png` | `frames/gaze.png` |
| `tool-chess.png` | `frames/chess.png` |
| `review.png` | `frames/unroll.png` |
| `done.png` | `frames/lantern.png` |
| `failed.png` / `poke3.png` | `frames/tailhug.png` |
