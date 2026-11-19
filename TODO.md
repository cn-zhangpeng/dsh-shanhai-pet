# 待办

当前版本 v0.1.0：事件 → 相位 → 帧轨道已跑通，冉冉 12 张新动作帧已接入。
下面按优先级列还没做的事。

## 素材

- [ ] **分身动作**：`tool:split` 目前用御风代演，还缺专属的「分身」帧。
- [ ] **多帧化**：点灯 / 抱尾 / 摆棋 / 展卷 现在都是单帧定格，各补 2~3 帧
      循环会更像"在动"（尤其点灯：火苗微晃）。补完帧后跑
      `python tests/tools/build_anim.py` 就能生成对应的 `anim/*.webp`。
- [ ] **视频动画**：用视频模型出动作短片（提示词见
      `docs/ANIM_PROMPTS.md`），`tests/tools/video_to_anim.py` 转成 WebP 替换静帧；
      比补中间帧更省事，也不会有帧拼接的跳变。
- [x] **idle 原生动画**：`breathopen`/`breath` 两帧烘成 `anim/idle.webp`
      （交叉淡化过渡），由浏览器原生播放，彻底没有换帧空白帧（2026-11-19）。
- [x] **水印**：生成图右下角淡色「豆包AI生成」水印已用
      `tests/tools/remove_watermark.py` 程序化去除（12 帧，2026-11-19）。
- [ ] **旧帧清理**：早期 25 张生活动作帧（walk/wave/phone 等）已不被轨道引用，
      确认不再需要后删除，能省约 3.7MB。
- [ ] **伴生灵**：`ant_walk.png`（9 格雪碧图）小蚂蚁还没接入，可做伴生层
      （跟随、蹲肩、被抱三种状态）。

## Host

- [ ] **celebrate 相位**：`goal/changed`、todo 全清、`workflow` 结束这类"收大工"
      事件还没接，可加 celebrate → 追光/转圈的短演出。
- [ ] **waiting 区分**：waiting 与 listening 共用竖耳帧，可给 waiting 单独一帧
      （歪头等）。
- [ ] **多会话**：现在只跟随最近活跃会话；多会话并行时可考虑
      "每会话一只"或切换器。
- [ ] **调试端点**：`/api/shanhai-pet/client-report` 是排障用的，建议收进
      debug 开关或后续删除。

## Client

- [ ] **拖动与持久化**：浮层固定在右下角，目前只能在设置页调位置，还不能拖动。
- [x] **设置页**：外观（显示 / 高度 / 距右 / 距底）、动作（眨眼 / 浮动）、
      互动（气泡 / 点击），写回 `$DSH_HOME/shanhai-pet/settings.json`，多窗口同步
      （2026-11-19）。语言切换走 DSH 全局语言设置，页面文案已双语。
- [ ] **点击交互**：摸头 + 亲密度（可参考 dsh-pet 的摸头/喂食经济）。
- [ ] **气泡细节**：正在 review 时可显示"在读哪个文件"（只读结构化字段）。

## 工程

- [ ] **发布**：`dsh-shanhai-pet` 名字未被占用，可 npm 发 0.0.1 占名，
      GitHub Release 同步。
- [x] **设置页预览**：`tests/preview-settings.mjs` 把设置页渲染成静态 HTML
      （`tests/out/settings-preview.html`），改样式后先截图看排版（2026-11-19）。
- [ ] **CI**：GitHub Actions 加 `node tests/smoke-host.mjs` +
      `node tests/smoke-client.mjs`。
- [ ] **展示**：README 加截图/GIF（右上角浮层 + 一个动作循环）。
- [ ] **素材原始件**：`tests/new-frames/` 里的豆包原图与去背中间件要不要入库，
      目前 `.gitignore` 忽略了 inbox/ 与 selected/，只留 preview/。
