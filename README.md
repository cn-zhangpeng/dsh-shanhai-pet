# 山海灵宠 · dsh-shanhai-pet

一只住在 DeepSeek Harness 会话旁的桌面小灵宠。

她不读你的对话，只读会话的**结构化状态**：这一轮在推理、在改代码、在跑命令，
还是收工了。然后她换成对应的姿势：

| 你在做什么 | 她在做什么 | 相位 |
| --- | --- | --- |
| 没事做 | 坐着吐纳 | `idle` |
| 你刚发出任务 | 竖耳听令 | `listening` |
| 正在推理 | 掐指推演 | `thinking` |
| 改文件 | 磨墨 | `tool` + ink |
| 跑命令 | 御风 | `tool` + wind |
| 读代码 | 嗅风 | `tool` + sniff |
| 查资料 | 望山 | `tool` + gaze |
| 整理清单 | 摆棋 | `tool` + chess |
| 派子任务 | 分身 | `tool` + split |
| 正在答复 | 展卷 | `review` |
| 这一轮完成 | 点灯 | `done` |
| 出错 / 中断 | 抱尾 | `failed` |
| 被阻塞等待 | 歪头 | `waiting` |

点她一下还有四句随机台词，各配一个动作帧（眨眼 / 听风 / 蜷尾 / 望你）。

## 结构

- **Host 半区** `index.js`
  - 订阅 `session/event`（turn/start、step/start、tool/call、tool/result、turn/end）
    与 `agent/assistant-stream`（reasoning-delta / text-delta）。
  - 把事件投影成每会话的相位状态，只读结构化字段，不触碰消息正文。
  - 通过 `webServer` 暴露只读接口 `GET /api/shanhai-pet/state`、
    `GET /api/shanhai-pet/pet.json`、`GET /api/shanhai-pet/assets/frames/<帧名>.png`
    与 `GET /api/shanhai-pet/assets/anim/<轨道名>.webp`。
  - 设置接口 `GET|POST /api/shanhai-pet/settings`：POST 只接受已知字段并按范围夹取，
    原子写回 `$DSH_HOME/shanhai-pet/settings.json`（tmp + rename）；读文件失败回落默认值。
- **Client 半区** `client.js`
  - 在 `shell.overlay`（全帧浮层，点击穿透）注册冉冉立绘。
  - 拉 `pet.json` 帧清单，按相位播放帧轨道；多帧轨道优先播 `anim/*.webp`，
    缺失或加载失败回落静态首帧；气泡文案走 Client locale（zh / en）。
  - 在 `settings.section` 注册「山海灵宠」设置页（外观 / 动作 / 互动三组），
    改动即时作用于浮层，260ms 防抖后写回 Host，多窗口改设置也能同步。
- **素材** `assets/ranran/`
  - `pet.json`：帧轨道清单。8 条相位轨道各配专属动作帧：
    坐忘呼吸（睁眼/闭眼两帧）、竖耳、掐指、御风、展卷、点灯、抱尾；
    另有按工具族细分的 `tool:ink`（磨墨）/ `tool:wind`（御风）/
    `tool:sniff`（嗅风）/ `tool:gaze`（望山）/ `tool:chess`（摆棋，棋盘前落子）/
    `tool:split`（分身赶路）。
  - `frames/*.png`：37 张立绘帧（12 张新动作 + 原有生活动作），统一 344×520。
  - `anim/*.webp`：多帧轨道烘焙成的循环动画（目前 `idle.webp`），
    浏览器原生播放，换帧不再经过 JS，也就没有空白帧；缺 webp 时回落同名 `.gif`。
- **清单** `cordis.patch.yml`：一行 `insert`，同时挂上 Host 与 Client 两个半区。

## 安装（本地 bundle）

```powershell
# 在 DSH 里执行：
# plugin_manager install_bundle，target 指向本目录的绝对路径
```

## 开发

```powershell
node --check index.js
node --check client.js
node tests/smoke-host.mjs
node tests/smoke-client.mjs
# 可选：把设置页渲染成静态 HTML，用浏览器截图自检排版
node tests/preview-settings.mjs   # → tests/out/settings-preview.html
```

素材生成链路（豆包 CDP 自动化）与去背脚本在 `tests/tools/`：
`cdp.ps1`、`actions.ps1`、`gen-one.ps1`、`process_frames.py`、`remove_watermark.py`。

多帧轨道重建动画（改过帧图或 durations 后跑一次，产物要一起提交）：

```powershell
python tests/tools/build_anim.py   # 帧图 → assets/ranran/anim/<轨道名>.webp
```

闭眼帧 `frames/breathopen_closed.png` 是从 `frames/breath.png` 按眼睛对位搬过来的派生图，
保证和 `breathopen.png` 同一张底片（只有眼睛在动）：

```powershell
python tests/tools/make_blink.py --debug-dir tests/out/blink-debug
```

用视频模型做更顺滑的动作（提示词见 [docs/ANIM_PROMPTS.md](docs/ANIM_PROMPTS.md)）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\tools\video_to_anim.ps1 `
  -In .\idle.mp4 -Name idle -Bg green -Fps 14
```

## 状态与待办

- 版本：`0.1.0`（本地 bundle，未发布 npm）。
- 已完成：事件投影 / 八相位 / 工具族帧轨道 / 12 张新动作帧 / 点击台词联动 /
  设置页（显示、大小、位置、眨眼、浮动、气泡、点击）/ idle 原生 WebP 动画 /
  两条烟测。
- 未做：拖动与位置持久化（改由设置页调位置）、分身专属帧、多帧动作
  （其余 17 条轨道都只有一张静帧，要做动画得先补中间帧素材）、
  celebrate 相位、伴生灵小蚂蚁、npm 发布与 CI。完整清单见 [TODO.md](TODO.md)。

接下去的路：新动作帧（呼吸 / 掐指 / 磨墨 / 御风 / 嗅风 / 望山 / 摆棋 /
展卷 / 点灯 / 抱尾 / 竖耳）已经接进 `pet.json`；`tool:split` 暂用御风代演，
后续要补「分身」专属画面时，加 PNG 帧并在 `pet.json` 加 track 即可，不用动代码。

## 设计取舍

- 不做"读对话内容"：一切只由事件类型、工具名和工具参数白名单字段驱动。
- 不做自己的第二个应用：浮层挂在官方 `shell.overlay`，随页面卸载一起清理。
- 形象用冉冉立绘（frames2d 逐帧），12 张新动作帧由豆包按参考图生成、
  程序化去背成 344×520 透明底；事件 → 相位 → 轨道全在 `pet.json` 里配。
