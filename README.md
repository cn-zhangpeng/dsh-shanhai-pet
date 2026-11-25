# dsh-shanhai-pet

[![CI](https://github.com/cn-zhangpeng/dsh-shanhai-pet/actions/workflows/ci.yml/badge.svg)](https://github.com/cn-zhangpeng/dsh-shanhai-pet/actions/workflows/ci.yml)

DeepSeek Harness 桌宠插件（山海紫穹系列）：一只住在会话旁的桌面小灵宠「冉冉」。

她不读你的对话，只读会话的**结构化状态**：这一轮在推理、在改代码、在跑命令，
还是收工了。然后她换成对应的姿势，并在头顶气泡里说大白话：

| 你在做什么 | 气泡显示 | 相位 |
| --- | --- | --- |
| 没事做 | 发呆 | `idle` |
| 你刚发出任务 | 听你说 | `listening` |
| 正在推理 | 琢磨中 | `thinking` |
| 改文件 | 改文件 | `tool` + ink |
| 跑命令 | 跑命令 | `tool` + wind |
| 读代码 | 读代码 | `tool` + sniff |
| 查资料 | 查资料 | `tool` + gaze |
| 整理清单 | 理清单 | `tool` + chess |
| 派子任务 | 派分身 | `tool` + split |
| 正在答复 | 写答复 | `review` |
| 这一轮完成 | 干完了 | `done` |
| 出错 / 中断 | 出错了 | `failed` |
| 被阻塞等待 | 等你点头 | `waiting` |

点她一下还有四句随机台词，各配一个动作帧（眨眼 / 听风 / 蜷尾 / 望你）。

任务进行时她会**用台词播报进度**：Harness 会话里写了 todo 清单的话，
每步开始她都会说"第 N 步：<在做什么>"（副行带"已完成几/几"），
收工、碰壁、等你审批时也各有一句；没写清单的任务就只换姿势不啰嗦。
播报可以在设置页的「进度播报」开关里关掉。

没事做的时候她也会**冒泡问候**：打开 DSH 时说一声时段问候（早上好呀 / 中午好 /
下午好 / 晚上好 / 夜深了早点休息），副行带**相识天数与当日陪伴时长**——
"相遇第 N 天 · 今天已陪 X 分钟"（在场时间累计，跨天清零；相遇第 N 天从装插件
那天起算，设置页外观组也能看到）。闲置约半小时她会再问候一次；
「闲时问候」开关在设置页互动组。**鼠标停在她头上**会弹一张小卡片：时段问候、
相遇天数与今日陪伴、当前状态和皮肤，以及回到原位 / 动一下 / 气泡 / 打盹 / 藏起来
几个动作（手机上长按头像打开同一张卡）。

**相遇纪念日有小惊喜**：第 1 / 7 / 30 / 100 / 200 / 365 / 500 / 1000 天的第一次
问候会变成特别台词——"今天是我们相遇的第 100 天，谢谢你的陪伴！"，冉冉还会
为你点亮一次灯笼。

## 自定义皮肤

想把冉冉换成自己的角色？准备一套皮肤文件夹并在设置页上传即可，**切换即时生效，
缺的帧自动回落内置冉冉**：

```
我的皮肤/
  pet.json        # 帧清单（与内置同格式，width/height 可不同，按比例缩放）
  frames/         # 立绘帧 PNG（名字与 pet.json 里轨道引用的帧名一致）
  anim/           # 可选：多帧轨道的循环动画 webp
```

- 设置页 → 素材 → **上传皮肤文件夹**（选整个文件夹），传完自动启用；
  也可以直接把文件夹放进 `$DSH_HOME/shanhai-pet/skins/`，设置页会扫描出来
- 上传限额：单文件 ≤ 8MB、每套 ≤ 120 个文件
- 切换：素材组里点"启用"；切回内置选"内置冉冉"
- 删除皮肤：手动移除 `skins/` 下对应文件夹

## 特性

- 数据来自 DSH 会话的**结构化事件**（`session/event` 的 `turn/start` / `step/start` /
  `tool/call` / `tool/result` / `turn/end` / `todo/write` 与 `agent/assistant-stream`
  的 chunk 类型），**不读取、不缓存任何消息正文**
- 播报台词只带结构化字段（kind / state / 计数 / 当前步骤文字），文案在渲染层按语言渲染，
  界面中英双语（跟随 DSH 全局语言设置）
- 事件 → 相位 → 帧轨道：8 条相位轨道 + 6 条工具族轨道各配专属动作帧；
  多帧轨道优先播 `anim/*.webp` 循环动画（浏览器原生播放，无换帧空白），缺失回落静态首帧
- 设置页（外观 / 动作 / 互动三组：显示、大小、位置、眨眼、浮动、待机小动作、气泡、播报、
  问候、点击，外观组顶部显示当日陪伴时长），
  写回 `$DSH_HOME/shanhai-pet/settings.json`，多窗口同步
- 闲时问候 + 相识天数：按时段打招呼，副行带"相遇第 N 天 · 今天已陪 X 分钟"；
  里程碑日（1/7/30/100/200/365/500/1000 天）第一次问候有点灯庆祝的小惊喜
- **自定义皮肤**：设置页上传自己的 pet.json + 立绘 + 动画（或手动放进 skins 目录），
  即点即换，缺帧回落内置冉冉
- **小屏自适应 + 点击穿透**：立绘高度按视口收缩（宽 ≤30vw、高 ≤38vh），手机上不再
  占掉半个屏幕；浮层只有头像区可点，立绘压住的输入框、发送键和工具条照常能点
- **拖动与信息卡**：按住头像可拖到任意位置，松手自动保存（窗口缩放/转屏后自动收进
  视口）；悬停或长按弹出信息卡：回到原位 / 动一下 / 气泡开关 / 打盹 / 藏起来
- **打盹与召唤**：打盹后缩到角落半透明、停掉小动作和气泡，点一下叫醒；真正藏起来后
  屏幕边缘会留一个小按钮，点它召唤回来
- **气泡可收起**：长台词挡视线时点气泡即可收起，切换状态后自动恢复；气泡带
  `aria-live`，读屏也会播报
- **待机小动作**：闲下来时每 18–60 秒随机招手、看手机、踱两步，干活时不打扰
- **跟随系统「减少动态效果」**：开启后停掉呼吸浮动、倾斜与待机小动作，只留静帧
- 深浅色主题自适应（使用 DSW 设计变量）；子代理会话不驱动灵宠

## 兼容性

| 项目 | 范围 | 说明 |
|---|---|---|
| DSH | `>=0.2.0 <0.3.0`（`package.json` `engines.dsh`） | 验证基线：DSH 0.2.2-rc.3（桌面端） |
| Node.js | `>=24.9.0`（`package.json` `engines.node`） | 与 DSH 运行时要求一致 |
| 第三方运行依赖 | 无 | 只用 DSH 注入的 `webServer` 与事件总线 |

`engines.dsh` 由 DSH 安装器与 profile 启动检查：运行中的 DSH 不满足该范围时，
安装或启动会被拒绝。

## 权限与边界

| 能力 | 声明 | 具体行为 |
|---|---|---|
| 文件 | 仅自身数据文件 | 写入仅限 `$DSH_HOME/shanhai-pet/` 下：`settings.json`（外观设置）、`company.json`（陪伴时长与相遇日期）、`skins/**`（用户上传的自定义皮肤），均为 tmp + rename 原子写；读取仅限插件自带素材、locale 与上述数据 |
| 数据读取边界 | 只读结构化字段 | 订阅会话事件的事件类型、工具名、工具参数白名单字段（`file_path` / `path` / `pattern` / `query` / `url` / `command`）、todo 清单条目与回合结束原因；**不读消息正文**，播报台词里的步骤文字截断到 24 字 |
| 网络 | 仅同源本地 API | Host 半在 DSH 的 `webServer` 上注册 `/api/shanhai-pet/*` 只读路由；Client 半用同源 `fetch` 读取。不访问任何外部域名或第三方服务 |
| 命令 | 无 | 不执行子进程或 shell 命令 |
| 凭据 | 无 | 不读取凭据文件或模型 API Key；唯一读取的环境变量是 `DSH_HOME`（定位设置文件） |
| 外部服务 | 无 | 不需要任何外部 API、数据库或云服务 |
| 失败边界 | 只读降级 | 设置文件损坏回落默认值；帧清单加载失败自动重试并回落静态帧；所有路由只读，不阻塞 DSH 启动或其他插件 |

## 安装

### 方式一：插件命令（推荐）

```bash
dsh plugin --profile web add github:cn-zhangpeng/dsh-shanhai-pet
```

> 锁定版本安装（更安全，推荐生产环境）：
> ```bash
> dsh plugin --profile web add github:cn-zhangpeng/dsh-shanhai-pet#v1.2.0
> ```

更新 / 卸载：

```bash
dsh plugin --profile web update dsh-shanhai-pet
dsh plugin --profile web remove dsh-shanhai-pet
```

安装后打开 DSH，右下角即是冉冉；在 设置 → 山海灵宠 调整显示与互动。

### 方式二：手动部署 / 本地调试（桌面端 profile）

桌面端 profile 位于 `~/.dsh/profiles/desktop/`（`DSH_HOME=~/.dsh`）：

1. 在 profile 目录把本插件登记为本地 link 依赖（用 DSH 自带 runtime 的 pnpm）：

   ```bash
   cd ~/.dsh/profiles/desktop
   pnpm add link:<本仓库绝对路径>
   ```

2. 确认 profile `package.json` 的 `dsh.profile.bundles` 数组里有 `"dsh-shanhai-pet"`；
3. 重启 DSH 生效。`link:` 依赖指向源码目录，改代码后重启桌面端即可（Host 路由在启动时注册）。

> 也可以在 DSH 里执行 `plugin_manager install_bundle`，target 指向本目录的绝对路径。

## 上架复核

DSH STORE 的自动检查与复核材料见 [STORE_REVIEW.md](STORE_REVIEW.md)：其中记录
兼容性声明、依赖、权限边界，以及一次性 Profile 的安装 / 启动 / 卸载验证步骤。

## 架构

```
Host 半（Cordis 插件，index.js）
  webServer 注入（声明 inject，等 webServer 就绪再注册路由）
  → 订阅 session/event + agent/assistant-stream
  → 投影成每会话相位状态（只保留最近活跃会话用于显示，其余只计数）
  → todo/write 与 turn/end 折成结构化播报数据（speech）
  → GET /api/shanhai-pet/state | pet.json | assets/* 只读接口 + settings 读写

Client 半（浏览器 bundle，client.js）
  React.createElement 渲染，900ms 轮询 /api/shanhai-pet/state
  → 相位帧轨道 / webp 动画 / 气泡（poke 台词 > 播报台词 > 相位与工具 label）
  → settings.section 注册「山海灵宠」设置页
```

## 素材

- `pet.json`：帧轨道清单。8 条相位轨道 + `tool:ink`（磨墨）/ `tool:wind`（御风）/
  `tool:sniff`（嗅风）/ `tool:gaze`（望山）/ `tool:chess`（摆棋）/ `tool:split`（分身）。
- `frames/*.png`：37 张立绘帧（12 张新动作 + 原有生活动作），统一 344×520。
- `anim/*.webp`：多帧轨道烘焙成的循环动画（`idle.webp` 待机呼吸眨眼、
  `poke1.webp` 点击眨眼），浏览器原生播放；缺 webp 时回落同名 `.gif`，再回落静态首帧。

## 目录

```
dsh-shanhai-pet/
  package.json        # 插件元信息、engines 兼容范围与打包配置
  cordis.patch.yml    # 插件注册补丁
  index.js            # Host 半：事件投影 + 播报 + HTTP 接口 + 设置持久化
  client.js           # Client 半：浮层渲染 + 气泡播报 + 设置页
  assets/ranran/      # pet.json 帧清单 + frames/ 立绘帧 + anim/ 循环动画
  docs/               # DETAIL.md 技术细节、ANIM_PROMPTS.md 动画素材提示词
  locale/             # meta.title / meta.description（zh / en）
  tests/              # Host/Client 烟测 + 设置页预览 + 素材工具
  STORE_REVIEW.md     # DSH STORE 上架复核材料
```

## 开发

```bash
node --check index.js
node --check client.js
node tests/smoke-host.mjs     # 事件投影 / 播报 / 路由 / 设置 端到端
node tests/smoke-client.mjs   # 浏览器模块工厂 + 双语台词渲染
# 可选：把设置页渲染成静态 HTML，用浏览器截图自检排版
node tests/preview-settings.mjs   # → tests/out/settings-preview.html
```

素材生成链路（豆包 CDP 自动化）与去背脚本在 `tests/tools/`：
`cdp.ps1`、`actions.ps1`、`gen-one.ps1`、`process_frames.py`、`remove_watermark.py`。

多帧轨道重建动画（改过帧图或 durations 后跑一次，产物要一起提交）：

```bash
python tests/tools/build_anim.py   # 帧图 → assets/ranran/anim/<轨道名>.webp
```

闭眼帧 `frames/breathopen_closed.png` 是从 `frames/breath.png` 按眼睛对位搬过来的派生图，
保证和 `breathopen.png` 同一张底片（只有眼睛在动）：

```bash
python tests/tools/make_blink.py --debug-dir tests/out/blink-debug
```

用视频模型做更顺滑的动作（提示词见 [docs/ANIM_PROMPTS.md](docs/ANIM_PROMPTS.md)）：

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\tools\video_to_anim.ps1 `
  -In .\idle.mp4 -Name idle -Bg green -Fps 14
```

## License

MIT
