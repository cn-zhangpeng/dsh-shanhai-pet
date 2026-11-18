# 山海灵宠 · 详情

## 她是什么

一只给 DeepSeek Harness 的桌面小灵宠。她住在会话旁边，用姿态跟着任务走：
你推理她看云，你改代码她磨墨，你跑命令她御风，你收工她点灯。

她能感知的只有"会话的结构化状态"：哪个工具在跑、这一轮成没成。
她不读取、不缓存、不发送任何消息正文。

## 数据来源（全部为结构化字段）

Host 半区订阅两类事件：

1. `session/event`
   - `turn/start` → `listening`
   - `step/start` → `thinking`
   - `tool/call` → `tool`（按工具族细分：磨墨 / 御风 / 嗅风 / 望山 / 摆棋 / 分身 / 拾忆 / 观时 / 探脉）
   - `tool/result` → 有错误 `failed`，否则回到 `thinking`
   - `turn/end`：completed → `done`；error / max-tokens / interrupted → `failed`；
     blocked → `waiting`；其余（aborted / forked 等）→ `idle`
2. `agent/assistant-stream`（仅 chunk 帧）
   - `reasoning-delta` → `thinking`
   - `text-delta` → `review`
   - 工具执行中不打断 `tool`

相位 `done` / `failed` 会在 2.6 秒后自动回落到 `idle`；
`waiting` 12 秒后回落。子代理会话（`header.origin === 'subagent'`）不驱动灵宠。

## 接口

`GET /api/shanhai-pet/state`

```json
{
  "ok": true,
  "phase": "tool",
  "since": 1760240000000,
  "updatedAt": 1760240000100,
  "detail": { "family": "ink", "label": "磨墨", "tool": "edit", "hint": "src/a.js" },
  "sessions": 1,
  "version": 42
}
```

只读，无写接口。Host 侧只保留最近活跃的一个会话相位用于显示，
其余会话只用于计数；状态 30 分钟无活动自动过期。

静态资源：

- `GET /api/shanhai-pet/pet.json`：帧清单（`frames2d.tracks` + `frames2d.phases`）。
- `GET /api/shanhai-pet/assets/frames/<帧名>.png`：帧图；帧名只允许
  `[a-z0-9_-]+`，带路径分隔符或 `..` 一律 404。

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
| idle | 吐纳 | breathopen → breath → breathopen（睁眼呼吸，夹杂一次闭眼，循环） |
| listening | 竖耳 | earperk（竖耳） |
| thinking | 掐指 | divine（掐指推演） |
| tool | 行法 | 默认 ridewind；有工具族轨道时优先（见上表） |
| review | 展卷 | unroll（展卷阅读） |
| done | 点灯 | lantern（点亮灯笼，播完回落 idle） |
| failed | 抱尾 | tailhug（抱尾自省，渲染层加灰暗滤镜） |
| waiting | 歪头 | earperk（竖耳等令） |

帧清单在 `assets/ranran/pet.json`（`frames2d.tracks` + `frames2d.phases`），
帧图在 `assets/ranran/frames/*.png`（344×520）。

新动作帧由豆包按冉冉 base.png 作参考图生成（1280×1920），再用
`tests/tools/process_frames.py` 从四边洪泛去背、裁切缩放成 344×520 透明底；
右下角保留淡色「豆包AI生成」水印。早期 25 帧生活动作（走路/招手/看手机等）
仍留在 `frames/` 里，暂未被轨道引用。

伴生灵小蚂蚁（`ant_walk.png`，9 格雪碧图）暂未接入，后续可做伴生层。

## 已知边界

- 浮层固定在右下角，暂不支持拖动。
- 无设置页；暂不支持隐藏/召唤。
- 只跟随"最近活跃会话"，多会话并行时显示最后动过的那个。
