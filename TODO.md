# 待办

当前版本 v1.1.0（2026-11-24）：事件 → 相位 → 帧轨道、自定义皮肤、闲时问候与陪伴时长均已上线；
本版补了拖动持久化、右键菜单、待机小动作与「减少动态效果」适配。
下面按优先级列还没做的事（2026-11-22 复核过一遍状态，未做的都按当前代码实况更新了说明）。

## 素材

- [ ] **分身动作**：`tool:split` 目前仍用 `ridewind`（御风）代演，缺专属的「分身」帧。
- [ ] **多帧化**：点灯（lantern）/ 抱尾（tailhug）/ 摆棋（chess）/ 展卷（unroll）仍是单帧定格；
      `anim/` 目前只有 `idle.webp` 和 `poke1.webp`。各补 2~3 帧循环会更像"在动"
      （尤其点灯：火苗微晃）。补完帧后跑 `python tests/tools/build_anim.py` 生成对应 `anim/*.webp`。
- [ ] **视频动画**：用视频模型出动作短片（提示词见 `docs/ANIM_PROMPTS.md`），
      `tests/tools/video_to_anim.ps1` 转成 WebP 替换静帧；比补中间帧更省事，也不会有帧拼接的跳变。
- [x] **idle 原生动画**：`breathopen`/`breath` 两帧烘成 `anim/idle.webp`
      （交叉淡化过渡），由浏览器原生播放，彻底没有换帧空白帧（2026-11-19）。
- [x] **水印**：生成图右下角淡色「豆包AI生成」水印已用
      `tests/tools/remove_watermark.py` 程序化去除（12 帧，2026-11-19）。
- [ ] **旧帧清理**：38 张帧里只有 12 张被轨道引用，26 张未被引用
      （`base blink breath footSwing handEar noant nt* phone ropeAir ropeLand smile stand
      talk turn turnL walkA walkB walkP1 walkP2 wave`，合计约 3.6MB）。
      确认不再需要后删除，注意 `noant.png` 是"无蚂蚁"底图，可能仍作素材留用。
- [ ] **伴生灵**：TODO 里记的 `ant_walk.png`（9 格雪碧图）已在仓库中找不到，
      素材层只剩 `noant.png`（无蚂蚁底图）。要做伴生层需重新产出雪碧图
      （跟随 / 蹲肩 / 被抱三种状态）。

## Host

- [ ] **celebrate 相位**：`goal/changed`、todo 全清、`workflow` 结束这类"收大工"
      事件还没接（`index.js` 目前没有 celebrate 分支），可加 celebrate → 追光/转圈的短演出。
- [ ] **waiting 区分**：`pet.json` 里 `waiting` 轨仍引用 `earperk`，与 `listening` 同帧，
      可给 waiting 单独一帧（歪头等）。
- [ ] **多会话**：现在只跟随最近活跃会话；多会话并行时可考虑
      "每会话一只"或切换器。
- [ ] **调试端点**：`/api/shanhai-pet/client-report` 仍在 `index.js` 注册、`client.js` 也在调用，
      排障用的，建议收进 debug 开关或后续删除。

## Client

- [x] **拖动与持久化**：按住头像拖动（Pointer Events + 指针捕获），松手把「距右/距底」
      写回设置；窗口缩放后渲染时自动收进视口（2026-11-24）。
- [x] **右键菜单**：右键/触屏长按打开：回到原位 / 动一下 / 气泡开关 / 先藏起来（2026-11-24）。
- [x] **待机小动作**：idle 时每 18–60 秒随机播招手/看手机/踱步等短轨道，用的是原先
      未被引用的生活帧；设置页动作组可关（2026-11-24）。
- [x] **减少动态效果**：跟随 `prefers-reduced-motion`，停浮动/倾斜/小动作（2026-11-24）。
- [x] **设置页**：外观（显示 / 高度 / 距右 / 距底）、动作（眨眼 / 浮动）、
      互动（气泡 / 点击），写回 `$DSH_HOME/shanhai-pet/settings.json`，多窗口同步
      （2026-11-19）。语言切换走 DSH 全局语言设置，页面文案已双语。
- [ ] **点击交互**：现在只有 4 句随机 poke 台词 + 动作帧；摸头 + 亲密度
      （可参考 dsh-pet 的摸头/喂食经济）还没做。
- [ ] **气泡细节**：工具相位已有 `hintOf()` 白名单字段做副行提示，
      但 review 相位仍只有「写答复」标签，没显示"在读哪个文件"。

## 工程

- [ ] **npm 占名**：`dsh-shanhai-pet` 在 npm registry 仍是 404（未发布）；发版流程已就绪
      （`.github/workflows/publish.yml` 手动触发，需要仓库 Secret `NPM_TOKEN`），
      本地 `npm login` 后也可直接 `npm publish --access public --provenance`。
      发布前可先清理 26 张未引用帧，把包体从 6.4MB 降到 ~2.8MB。
- [x] **设置页预览**：`tests/preview-settings.mjs` 把设置页渲染成静态 HTML
      （`tests/out/settings-preview.html`），改样式后先截图看排版（2026-11-19）。
- [x] **CI**：`.github/workflows/ci.yml` 在 push / PR 上跑语法检查、host/client 烟测、
      设置页预览与截图存档、`npm pack --dry-run`；首次 Linux 跑挂掉的盘符断言已修
      （2026-11-25，run 3 通过）。
- [ ] **展示**：README 仍无截图/GIF（右上角浮层 + 一个动作循环），上架页缺少直观展示。
- [ ] **素材原始件**：`tests/new-frames/` 里的豆包原图与去背中间件要不要入库，
      目前 `.gitignore` 忽略了 `inbox/` 与 `selected/`，只留 `preview/`。
