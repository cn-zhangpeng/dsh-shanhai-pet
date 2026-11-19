# DSH STORE 上架复核 / Review Evidence

本文件对应 DSH STORE 自动检查提出的三类检查项（与 [dsh-shanhai-stats 的复核](https://github.com/cn-zhangpeng/dsh-shanhai-stats/blob/main/STORE_REVIEW.md) 同一套流程：显式兼容性声明、权限与边界说明、一次性 DSH Profile 的安装 / 启动 / 卸载实测），记录 dsh-shanhai-pet 的声明与验证证据。

- 插件版本 / Plugin version: **0.1.0**
- 复核日期 / Date: **2026-11-20**
- 仓库 / Repository: <https://github.com/cn-zhangpeng/dsh-shanhai-pet>

## 1. 兼容性声明 / Compatibility declarations

`package.json` 显式声明两个范围，安装器与 profile 启动可直接校验：

```json
"engines": {
  "node": ">=24.9.0",
  "dsh": ">=0.2.0 <0.3.0"
}
```

| 项目 / Item | 声明 / Declared | 验证基线 / Verified against |
|---|---|---|
| DSH | `>=0.2.0 <0.3.0` (`engines.dsh`) | 0.2.2-rc.3（桌面端日常运行）+ 一次性 web-profile |
| Node.js | `>=24.9.0` (`engines.node`) | v24.18.1 |
| 第三方运行依赖 / Runtime deps | 无 / none | 只用 DSH 注入的 `webServer` 与事件总线 |

## 2. 依赖、权限与边界 / Dependencies, permissions and boundaries

### Dependencies

- **No third-party runtime dependencies.** `dependencies` / `peerDependencies` 均不存在。
- Host 半只依赖 DSH 注入的 `webServer`（`inject = ['webServer']`，等服务就绪再注册路由）与 `ctx.on` 事件总线（`session/event`、`agent/assistant-stream`）。
- Client 半只依赖 DSH client runtime（`dsh.client.platform: 'web'`），渲染用内联 `React.createElement`。
- **No install-time code execution:** 无 `preinstall` / `install` / `postinstall` / `prepare` 脚本，`package.json` 不含 `scripts`。

### Permissions and failure bounds

| 能力 / Capability | 行为 / Behavior |
|---|---|
| 文件系统 / Filesystem | 读取仅限插件自带资产（`assets/ranran/*`、`locale/*`）；写入仅限 `$DSH_HOME/shanhai-pet/` 下：`settings.json`（设置）、`company.json`（陪伴时长与相遇日期）、`skins/**`（用户上传的自定义皮肤，文件路径白名单 + 大小/数量限额，tmp + rename 原子写）。 |
| 会话数据 / Session data | 只订阅**结构化字段**：事件类型、工具名、工具参数白名单字段（`file_path` / `path` / `pattern` / `query` / `url` / `command`）、`todo/write` 的清单条目、`turn/end` 的 `reason.kind`。**不读消息正文，不缓存对话。** 播报台词里的步骤文字截断到 24 字。 |
| 网络 / Network | Host 半在 DSH 自有 `webServer` 上注册只读同源路由 `/api/shanhai-pet/state`、`/pet.json`、`/assets/*` 与 `GET|POST /settings`；Client 半同源 `fetch`。**无外部域名、无第三方 API、无遥测。** |
| 命令 / Commands | None. 无 `child_process`、无 shell。 |
| 凭据 / Credentials | None. 不读凭据文件或模型 API Key；唯一读取的环境变量是 `DSH_HOME`（定位设置文件）。 |
| 外部服务 / External services | None. 无数据库、云服务或远程端点。 |
| 失败边界 / Failure bounds | 只读降级：设置文件损坏回落默认值；帧清单加载失败自动重试并回落静态帧；路由只读，不阻塞 DSH 启动或其他插件。 |

唯一的"网络"代码路径是浏览器 bundle 对 Host 同源路由的 `fetch`，不出本机 DSH 服务。

## 3. 一次性 Profile 验证 / Disposable-Profile verification

2026-11-20 在 Windows 11 x64 上以**全新临时 `DSH_HOME`** 实测，未触碰用户 Profile；测后临时目录已删除。

### Environment

```
DSH      0.2.2-rc.3
Node.js  v24.18.1
pnpm     11.21.0 (invoked by `dsh plugin`)
DSH_HOME C:\Users\<user>\AppData\Local\Temp\tmp.2ikIEXBesB（临时，已删除）
```

### 3.1 Create the disposable profile from the shipped `web` template

```bash
dsh --profile storecheck-pet --from-default-profile web
```

Resulting profile bundles:

```text
@deepseek-ai/dsh-base
@deepseek-ai/dsh-web-app
```

> 与 stats 同：base-only profile 没有 web app 与 shell overlay 槽位，本插件的 Client 半
> 需要 `dsh-web-app`，从官方 `web` 模板起步才是真实的一键场景。

### 3.2 Install

```bash
dsh plugin --profile storecheck-pet add E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet
```

Observed output:

```text
dependencies:
+ dsh-shanhai-pet link:E:/Workspace/ProjectWorkspace/harness-plugin/dsh-shanhai-pet
Done in 532ms using pnpm v11.21.0
```

插件即时激活，无警告，无安装钩子执行。（本地目录安装会落成 `link:` 软链依赖；
走 GitHub ref 安装时是常规 npm checkout，见 §4。）

### 3.3 Start

```bash
dsh --profile storecheck-pet --port 31999 --no-open
```

> 注：本机 3080 默认端口被宿主占用，一次性 profile 用 `--port` 指定端口启动；
> 插件路由不绑定固定端口，无影响。

Observed:

```text
dsh web: http://127.0.0.1:31999/?token=<redacted>
```

Health checks against that disposable server:

| Request | Result |
|---|---|
| `GET /` (with the printed token) | HTTP 303（重定向，宿主行为） |
| `GET /api/shanhai-pet/state` | **HTTP 200**, JSON 234 bytes |
| `GET /api/shanhai-pet/pet.json` | **HTTP 200**, JSON 2,001 bytes |
| `GET /api/shanhai-pet/assets/anim/idle.webp` | **HTTP 200**, 43,498 bytes |
| `GET /api/shanhai-pet/assets/anim/poke1.webp` | **HTTP 200**, 43,136 bytes |

`state` 返回的空聚合（空 `DSH_HOME`、无会话事件的预期结果，包含全部设置字段）：

```json
{"ok":true,"phase":"idle","since":0,"updatedAt":0,"detail":null,"speech":null,"sessions":0,
 "version":0,"settings":{"visible":true,"height":250,"right":24,"bottom":14,"blink":true,
 "float":true,"bubble":true,"poke":true,"narrate":true}}
```

无插件报错、无未处理拒绝、无任何非本机请求。

### 3.4 Uninstall

```bash
dsh plugin --profile storecheck-pet remove dsh-shanhai-pet
```

Observed output:

```text
dependencies:
- dsh-shanhai-pet link:E:/Workspace/ProjectWorkspace/harness-plugin/dsh-shanhai-pet
Done in 554ms using pnpm v11.21.0
```

Exit code `0`。profile `dependencies` 不再含插件，`bundles` 列表不变；
随后结束临时服务进程并删除临时 `DSH_HOME`。

## 4. 复现步骤 / Reproduction

```bash
# 1. Isolated home (Windows 原生路径；Git Bash 下用 cygpath -w 转换 mktemp 结果)
export DSH_HOME="<fresh temp dir>"

# 2. Web-template profile（会随启动；默认 3080 被占时加 --port）
dsh --profile storecheck-pet --from-default-profile web

# 3. Install the plugin (local checkout or GitHub ref)
dsh plugin --profile storecheck-pet add github:cn-zhangpeng/dsh-shanhai-pet

# 4. Start and open the printed URL
dsh --profile storecheck-pet --port 31999 --no-open

# 5. Verify the same-origin routes（token 用启动时打印的）
curl -sS "http://127.0.0.1:31999/api/shanhai-pet/state?token=<printed-token>"
curl -sS "http://127.0.0.1:31999/api/shanhai-pet/pet.json?token=<printed-token>"

# 6. Uninstall and clean up
dsh plugin --profile storecheck-pet remove dsh-shanhai-pet
rm -rf "$DSH_HOME"
```

## 5. 备注 / Notes

- 本文件是商店检查项的证据材料，**不是安全审计**，也不单独声明 `user-reviewed` 状态。
- 桌面端日常安装方式是 profile 内 `link:` 软链（开发模式），与商店分发无关。
- Client 半的浮层渲染（shell.overlay 槽位）需要浏览器会话验证；本文件用 curl 验证的是
  Host 半的全部只读路由与设置读写，Client 半由 `tests/smoke-client.mjs` 覆盖模块加载与
  台词渲染逻辑。
