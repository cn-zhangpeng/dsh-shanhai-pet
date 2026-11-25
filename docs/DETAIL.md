# 山海灵宠 · 详情

## 她是什么

一只给 DeepSeek Harness 的桌面小灵宠。她住在会话旁边，用姿态跟着任务走：
你推理她掐指琢磨，你改文件她铺纸研墨，你跑命令她御风赶路，你收工她点亮灯笼——
气泡上说大白话：琢磨中 / 改文件 / 跑命令 / 干完了。

她能感知的只有"会话的结构化状态"：哪个工具在跑、这一轮成没成。
她不读取、不缓存、不发送任何消息正文。

## 数据来源（全部为结构化字段）

Host 半区订阅两类事件：

1. `session/event`
   - `turn/start` → `listening`
   - `step/start` → `thinking`
   - `tool/call` → `tool`（按工具族细分：改文件 / 跑命令 / 读代码 / 查资料 / 理清单 / 派分身 / 翻记忆 / 看日程 / 查插件）
   - `tool/result` → 有错误 `failed`，否则回到 `thinking`
   - `turn/end`：completed → `done`；error / max-tokens / interrupted → `failed`；
     blocked → `waiting`；其余（aborted / forked 等）→ `idle`
2. `agent/assistant-stream`（仅 chunk 帧）
   - `reasoning-delta` → `thinking`
   - `text-delta` → `review`
   - 工具执行中不打断 `tool`
3. `todo/write` → 进度播报台词（不改变相位）
   - 有 `in_progress` 项 → `state: 'step'`（`n` 为清单位置、`content` 为当前步内容）
   - 全部 pending → `state: 'plan'`；全部 completed → `state: 'alldone'`
   - 台词只带结构化字段（kind / state / 计数），文案由 Client 按语言渲染

相位 `done` / `failed` 会在 2.6 秒后自动回落到 `idle`；
`waiting` 12 秒后回落。子代理会话（`header.origin === 'subagent'`）不驱动灵宠——
会话事件与 `agent/assistant-stream` 流帧两路都按这个规则过滤。另有一层兜底：
`listening` / `thinking` / `review` 这些会持续吐流帧的相位，若 5 分钟内没有任何更新，
就判定该会话已经结束并回落 `idle`，避免丢失 `turn/end` 时一直停在"琢磨中"。

## 接口

`GET /api/shanhai-pet/state`

```json
{
  "ok": true,
  "phase": "tool",
  "since": 1760240000000,
  "updatedAt": 1760240000100,
  "detail": { "family": "ink", "key": "grind", "label": "改文件", "tool": "edit", "hint": "src/a.js" },
  "speech": { "kind": "todo", "state": "step", "n": 2, "content": "写测试", "done": 1, "total": 3,
              "at": 1760240000500 },
  "company": { "date": "2026-11-20", "firstSeenAt": 1760240000000, "minutes": 96,
               "days": 12, "milestone": 0 },
  "sessions": 1,
  "version": 42,
  "settings": { "visible": true, "height": 250, "right": 24, "bottom": 14,
                "blink": true, "float": true, "bubble": true, "poke": true, "narrate": true,
                "greet": true }
}
```

相位部分是只读的。Host 侧只保留最近活跃的一个会话相位用于显示，
其余会话只用于计数；状态 30 分钟无活动自动过期。

`speech` 是进度播报：`kind` 取 `todo`（清单步骤，state 为 step / plan / alldone）、
`done`（整轮收工，可带 done/total）、`failed`（整轮失败）、`waiting`（等审批）。
同一台词 2 秒内不重复；Client 收到后保持 8 秒（`speech.at` 变化重新计时），
期间气泡优先显示台词，过期回落相位 / 工具 label。单次工具失败只显示
`出错了` label，不抢台词；`turn/start` 清空清单（与核心 todo 投影按轮清空一致）。

## 每日陪伴与相识天数（company）

Host 在 `GET /api/shanhai-pet/state` 的每次请求上推进陪伴计时：客户端只在浮层可见时轮询，
所以相邻两次请求间隔 ≤ 15 秒才计入在场时长，间隔更长（浮层隐藏、应用刚打开）不计。
数据落盘在 `$DSH_HOME/shanhai-pet/company.json`（累计满 30 秒原子写一次），
持久化 `metAt`（初次相遇时刻，永久保留）；本地日期跨天时今日累计清零、
`firstSeenAt` 重新起算。state 响应里只带
`{ date, firstSeenAt, minutes, days, milestone }` 视图：
`days` 是相遇第 N 天（安装当天为第 1 天），`milestone` 命中里程碑时等于 N，
否则为 0（里程碑名单：1 / 7 / 30 / 100 / 200 / 365 / 500 / 1000 天）。

闲时问候由渲染层触发：打开后第一次 + 闲置约 30 分钟一次，气泡停留 10 秒，
文案按时段分桶（清晨/中午/下午/晚上/深夜），副行带"相遇第 N 天 · 今天已陪 X"；
**里程碑日的第一次问候**换成特别台词（"今天是我们相遇的第 N 天，谢谢你的陪伴！"）
并用 `done` 轨道（点灯）庆祝，每个里程碑只提醒一次。
悬停立绘时副行同样显示相识天数与今日陪伴。
"闲时问候"开关（`greet`）在设置页互动组。

## 自定义皮肤（skins）

皮肤目录 `$DSH_HOME/shanhai-pet/skins/<皮肤名>/`，结构与内置一致：
`pet.json`（帧清单，`frames2d.width/height` 可不同，客户端按比例缩放）+
`frames/*.png` + `anim/*.webp`。安装两条路：

1. **上传**：`POST /api/shanhai-pet/skins`，body `{op:'upload', name, path, data(base64)}`，
   逐文件一请求；`path` 白名单 `pet.json` / `frames/*.(png|webp|gif)` / `anim/*.(webp|gif)`，
   单文件解码后 ≤ 8MB（超限 413），每套 ≤ 120 个文件，目录名 1-32 位字母数字汉字_-
2. **目录扫描**：手动把文件夹放进 `skins/`，`GET /api/shanhai-pet/skins` 会列出
   （`pet.json` 可解析且含 `frames2d.tracks` 才算皮肤，坏目录跳过）

切换：`POST` `{op:'select', name}`（空串 = 回内置），写进 `settings.activeSkin`
持久化。解析规则：

- `pet.json` 路由：activeSkin 的清单可解析就返回它，坏清单回落内置
- `assets/*` 路由：逐文件"皮肤目录优先、缺失回落内置"——皮肤没给的帧显示内置图
- 渲染层轮询发现 `settings.activeSkin` 变化后自动重拉帧清单，切换即时生效
- 删除皮肤：手动移除对应文件夹；列表由扫描实时生成

### 设置

`GET|POST /api/shanhai-pet/settings`

- `GET` / `HEAD` 返回 `{ ok: true, settings }`。
- `POST` body 为部分字段，Host 只接受下表已知字段、按范围夹取后写入内存并返回生效值；
  未提交的字段保持不变，类型不对的字段保留旧值。
- 持久化：`$DSH_HOME/shanhai-pet/settings.json`（缺省 `~/.dsh/shanhai-pet/settings.json`），
  临时文件 + `rename` 原子替换，写失败返回 500 `write failed: ...`；读不出来回落默认值。
- 坏 JSON → 400 `invalid json`；body 不是对象 → 400 `invalid body`；
  非 `GET/HEAD/POST` → 405，响应头 `allow: GET, HEAD, POST`。

| 字段 | 默认 | 范围 | 说明 |
| --- | --- | --- | --- |
| `visible` | true | bool | 关掉后整个浮层隐藏（设置页仍可打开） |
| `height` | 250 | 96–640 | 立绘显示高度上限（px），宽度按 344×520 比例换算；小屏按视口收缩（宽 ≤30vw、高 ≤38vh） |
| `right` | 24 | 0–4000 | 距视口右边（px） |
| `bottom` | 14 | 0–4000 | 距视口底边（px） |
| `blink` | true | bool | 待机眨眼（时长烘在动画里；关掉停在睁眼帧） |
| `float` | true | bool | 呼吸浮动动画 |
| `idleAct` | true | bool | 待机小动作（18–60 秒随机播招手/看手机/踱步等短轨道） |
| `bubble` | true | bool | 非待机时头顶显示相位气泡 |
| `poke` | true | bool | 点击换姿势说台词 |
| `narrate` | true | bool | 任务进度播报（清单步骤、收工、碰壁台词） |
| `greet` | true | bool | 闲时温馨问候（打开时一次 + 闲置半小时一次） |

> 注意：`webServer` 的 resource 路由只放行 `GET/HEAD`，所以设置接口用的是
> `kind: 'exact'` + 原生 `handler(req, res)`，可以自己收 POST body。

静态资源：

- `GET /api/shanhai-pet/pet.json`：帧清单（`frames2d.tracks` + `frames2d.phases`）。
- `GET /api/shanhai-pet/assets/frames/<帧名>.png`：帧图；帧名只允许
  `[a-z0-9_-]+`，带路径分隔符或 `..` 一律 404。
- `GET /api/shanhai-pet/assets/anim/<轨道名>.webp|gif`：烘焙好的循环动画
  （轨道名里的 `:` 换成 `-`，如 `tool:ink` → `tool-ink`），浏览器原生播放。

调试用：`GET /api/shanhai-pet/client-report?d=<JSON>` 记录客户端上报，
`GET /api/shanhai-pet/client-report` 回读（仅内存保留最近 30 条）。

## 工具族 → 帧轨道

`tool/call` 时 Host 会带出 `detail.family`，客户端优先找同名轨道
`tool:<family>`，没有才回落到 `phases.tool`：

| 工具族 | 触发工具（节选） | 轨道 | 当前帧 |
| --- | --- | --- | --- |
| ink | edit / write / apply_patch / compress | `tool:ink` | grindink（砚前磨墨） |
| wind | bash / pwsh / shell | `tool:wind` | ridewind（御风疾行） |
| sniff | read / grep / glob / cordis_inspect | `tool:sniff` | sniff（俯身嗅探） |
| gaze | web_search / web_fetch / schedule_* / skill | `tool:gaze` | gaze（远望） |
| chess | todo_write | `tool:chess` | chess（棋盘前落子） |
| split | subagent / workflow / job_* | `tool:split` | ridewind（分身赶路，暂代） |

## 动作表（豆包生成的 12 张新动作帧）

| 相位 | 动作意象 | 当前帧轨道 |
| --- | --- | --- |
| idle | 吐纳 | anim/idle.webp（睁眼呼吸 + 一次 200ms 闭眼，循环） |
| listening | 竖耳 | earperk（竖耳） |
| thinking | 掐指 | divine（掐指推演） |
| tool | 干活中 | 默认 ridewind；有工具族轨道时优先（见上表） |
| review | 展卷 | unroll（展卷阅读） |
| done | 点灯 | lantern（点亮灯笼，播完回落 idle） |
| failed | 抱尾 | tailhug（抱尾自省，渲染层加灰暗滤镜） |
| waiting | 歪头 | earperk（竖耳等令） |

帧清单在 `assets/ranran/pet.json`（`frames2d.tracks` + `frames2d.phases`），
帧图在 `assets/ranran/frames/*.png`（344×520）；多帧轨道另有一张
`assets/ranran/anim/<轨道名>.webp` 循环动画，浏览器原生播放，缺失时再试同名 `.gif`，
都没有就回落到静态首帧。

动画有两条产出路径：

- `tests/tools/build_anim.py`：从现有帧图烘焙。相邻停留之间的过渡帧会自动判断：
  两帧平均差 ≥ 6 时插 2 帧 30ms 交叉淡化，差得很少（如"同一张底片只闭眼"）就硬切，
  避免眼睛上糊出一层灰影。
- `tests/tools/video_to_anim.py`：视频模型出的短片 → 抠绿 → 裁边缩放 → WebP/GIF，
  每个动作的提示词见 [ANIM_PROMPTS.md](ANIM_PROMPTS.md)。

闭眼帧 `frames/breathopen_closed.png` 不是独立生成的（独立生成会和 `breathopen.png`
差一整张图，眨眼看起来像换照片），而是 `tests/tools/make_blink.py` 从 `breath.png`
里把睫毛/眼睑按眼角对齐搬过来：脚本按深色块定位两只眼睛、算出缩放+旋转+平移，
再按椭圆羽化只贴回眼眶。改完帧图要重跑 `build_anim.py` 才会进 `anim/idle.webp`。

新动作帧由豆包按冉冉 base.png 作参考图生成（1280×1920），再用
`tests/tools/process_frames.py` 从四边洪泛去背、裁切缩放成 344×520 透明底；
右下角「豆包AI生成」水印已用 `tests/tools/remove_watermark.py` 程序化去除。
早期 25 帧生活动作（走路/招手/看手机等）
仍留在 `frames/` 里，暂未被轨道引用。

伴生灵小蚂蚁（`ant_walk.png`，9 格雪碧图）暂未接入，后续可做伴生层。

## 浮层尺寸与点击穿透

- **尺寸自适应**：`settings.height` 只是上限。渲染时按视口再封顶——宽度不超过视口
  30%、高度不超过 38%，窗口缩放 / 横竖屏切换会重新计算（`fitPetSize`），
  手机竖屏上立绘约 180px 高，不再是桌面的 250px。
- **点击穿透**：浮层根节点与 `.shp-pet` 都是 `pointer-events:none`，只有头像区域的
  `.shp-hit`（left 12%、top 2%、宽 76%、高 42%）接收点击与悬停。立绘压住输入框、
  发送键或工具条时，没被 `.shp-hit` 覆盖的位置照常点得到底下的按钮。
- 安全区：浮层定位用 `calc(...px + env(safe-area-inset-*))`，刘海屏/手势条下不会贴边。
- **拖动**：在头像热区按下（Pointer Events + `setPointerCapture`）后移动超过 5px 进入拖动，
  位移换算成新的「距右/距底」并用视口夹取（`dragPosition`），松手才 POST 保存；
  拖动中停掉过渡、浮动与 hover 抬升。窗口缩放后渲染时也会把位置收进视口。
- **信息卡**：桌面悬停头像 320ms、触屏长按 520ms 或右键打开同一张卡（`PetCard`），
  卡里是名字、时段问候、相遇天数/今日陪伴、当前状态、皮肤，以及回到原位 / 动一下 /
  气泡开关 / 打盹 / 藏起来；鼠标移进卡片不会关，移开 220ms 后关闭；点别处或 Esc 也关。
- **打盹与召唤**：打盹是本地瞬时状态（不落盘），缩到 0.86 倍、45% 透明度并停掉小动作和
  气泡，点一下叫醒；相位离开 idle 时自动醒。真正隐藏（`visible:false`）时浮层只渲染
  右下角一个 `.shp-summon` 小按钮，点它恢复显示，避免「藏起来找不回来」。
- **气泡收起**：气泡可点击（`pointer-events:auto`），点掉后按台词文本记住，相位变化时
  清空；气泡带 `role="status"` + `aria-live="polite"`。
- **待机小动作**：`useIdleAct` 在 idle 相位每 18–60 秒从 `IDLE_ACTS` 里挑一条
  `pet.json` 实际存在的短轨道播 ~2.2 秒；`idleAct` 关闭、`prefers-reduced-motion`
  命中或离开 idle 时自动停。
- **减少动态效果**：`useReducedMotion` 监听 `(prefers-reduced-motion: reduce)`，
  命中后不挂 `shp-float`、不播小动作，CSS 同时关掉浮动/倾斜/气泡入场动画。

## 设置页

在「设置 → 山海灵宠」里（`settings.section` 槽位，`order: 45`），与浮层共用一份
模块级 `settingsStore`：改动即时生效、260ms 防抖后自动写回 Host，无需保存按钮。

- 三组卡片：外观（显示 / 立绘高度 / 距右边 / 距底部）、动作（眨眼 / 呼吸浮动）、
  互动（状态气泡 / 进度播报 / 点击互动），底部「恢复默认」。
- 控件：`role="switch"` + `aria-checked` 的开关、`<input type="range">` 滑杆，
  只用 `--dsw-alias-*` 主题 token，不引入任何宿主包。
- 文案走 Client locale 服务（`ctx.locale.register`，中英双份）。
- 浮层每 900ms 轮询 `/state`，响应里带 `settings`，所以多窗口下改了设置，
  各窗口的灵宠都会跟着变。

## 已知边界

- 位置支持拖动（松手持久化），也可在设置页用「距右边 / 距底部」精确调。
- 设置是全局单份（`$DSH_HOME/shanhai-pet/settings.json`），不按会话区分。
- 只跟随"最近活跃会话"，多会话并行时显示最后动过的那个。
