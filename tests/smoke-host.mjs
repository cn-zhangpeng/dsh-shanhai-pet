/**
 * Host 半区烟测：事件投影 → 相位 → HTTP 状态/接口 → 设置读写。
 * 跑法：node tests/smoke-host.mjs
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/* 设置会真的落盘：先把 DSH_HOME 指到临时目录，测完删掉。 */
const home = await mkdtemp(path.join(tmpdir(), 'shanhai-pet-'))
process.env.DSH_HOME = home

const {
  apply,
  createTracker,
  familyOf,
  hintOf,
  normalizeSettings,
  resolveDshHome,
  settingsFile,
  writeSettings,
  readSettings,
  readCompany,
  tickCompany,
  listSkins,
  skinsRoot,
  DEFAULT_SETTINGS,
} = await import('../index.js')

/* ---- 设置值收敛 ---- */
assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS })
const clamped = normalizeSettings({ height: 9999, right: -5, blinkMs: 3000, blink: 'yes', poke: false })
assert.equal(clamped.height, 640, '高度上限 640')
assert.equal(clamped.right, 0, '负偏移夹到 0')
assert.equal('blinkMs' in clamped, false, '闭眼时长已随原生动画移除')
assert.equal(clamped.blink, true, '非布尔字段保留默认值')
assert.equal(clamped.poke, false, '布尔字段照单接收')
assert.equal(DEFAULT_SETTINGS.narrate, true, '进度播报默认开')
assert.equal(normalizeSettings({ narrate: false }).narrate, false, '播报开关可关')
assert.equal(normalizeSettings({ narrate: 'yes' }).narrate, true, '坏类型回落默认开')
assert.equal(DEFAULT_SETTINGS.greet, true, '闲时问候默认开')
assert.equal(normalizeSettings({ greet: false }).greet, false, '问候开关可关')
assert.equal(DEFAULT_SETTINGS.idleAct, true, '待机小动作默认开')
assert.equal(normalizeSettings({ idleAct: false }).idleAct, false, '待机小动作可关')
assert.equal(normalizeSettings({ idleAct: 'yes' }).idleAct, true, '坏类型回落默认开')
assert.equal(normalizeSettings({ height: 320 }, { ...DEFAULT_SETTINGS, visible: false }).height, 320)

/* ---- DSH home 解析 ---- */
assert.equal(resolveDshHome({}, 'C:\\Users\\x'), path.join('C:\\Users\\x', '.dsh'))
assert.equal(resolveDshHome({ DSH_HOME: '~/custom' }, 'C:\\Users\\x'), path.join('C:\\Users\\x', 'custom'))
assert.equal(resolveDshHome({ DSH_HOME: 'D:\\dsh-home' }, 'C:\\Users\\x'), 'D:\\dsh-home')
assert.ok(settingsFile().startsWith(home), '设置文件落在 DSH_HOME 下')

/* ---- 事件投影 ---- */
const tracker = createTracker()
const session = { id: 'session-1', header: {} }
const emit = (type, data) => tracker.onEvent(session, { type, data })
const phase = () => tracker.snapshot().phase
const chunk = (type, text = 'x') => ({
  agent: { id: 'session-1' },
  frame: { type: 'chunk', attemptId: 'a1', revision: 0, index: 0, time: Date.now(), chunk: { type, index: 0, text } },
})

emit('turn/start', { turn: 1 })
assert.equal(phase(), 'listening', 'turn/start -> listening')

emit('step/start', { turn: 1, step: 1 })
assert.equal(phase(), 'thinking', 'step/start -> thinking')

tracker.onStream(chunk('reasoning-delta'))
assert.equal(phase(), 'thinking', 'reasoning-delta -> thinking')

emit('tool/call', {
  turn: 1,
  step: 1,
  callId: 'c1',
  name: 'edit',
  arguments: JSON.stringify({ file_path: 'src/a.js' }),
})
assert.equal(phase(), 'tool', 'tool/call -> tool')
assert.equal(tracker.snapshot().detail.label, '改文件')
assert.equal(tracker.snapshot().detail.key, 'grind', '工具族带双语 key')
assert.equal(tracker.snapshot().detail.hint, 'src/a.js')

tracker.onStream(chunk('text-delta'))
assert.equal(phase(), 'tool', 'text-delta 不打断工具执行')

emit('tool/result', { turn: 1, step: 1, message: { toolCallId: 'c1' } })
assert.equal(phase(), 'thinking', 'tool/result -> thinking')

tracker.onStream(chunk('text-delta'))
assert.equal(phase(), 'review', 'text-delta -> review')

emit('turn/end', { turn: 1, reason: { kind: 'completed' } })
assert.equal(phase(), 'done', 'completed -> done')

await new Promise((resolve) => setTimeout(resolve, 2800))
assert.equal(phase(), 'idle', 'done 2.6s 后回落 idle')

emit('turn/start', { turn: 2 })
emit('tool/call', {
  turn: 2,
  step: 1,
  callId: 'c2',
  name: 'pwsh',
  arguments: JSON.stringify({ command: 'pnpm test' }),
})
emit('tool/result', {
  turn: 2,
  step: 1,
  message: { toolCallId: 'c2' },
  error: { name: 'ToolError', code: 'ERR' },
})
assert.equal(phase(), 'failed', '工具出错 -> failed')

emit('turn/end', { turn: 3, reason: { kind: 'blocked' } })
assert.equal(phase(), 'waiting', 'blocked -> waiting')

const sub = { id: 'sub-1', header: { origin: 'subagent' } }
tracker.onEvent(sub, { type: 'turn/start', data: { turn: 1 } })
assert.equal(phase(), 'waiting', '子代理会话不驱动灵宠')

/* 子代理的流帧同样不能驱动灵宠：mnemon 复盘这类分身会在主任务结束后继续吐字，
   而它们的 turn/end 被 onEvent 过滤，一旦被 mark 成"琢磨中"就没人收尾。 */
const subChunk = (type) => ({
  agent: { id: 'sub-1', session: { id: 'sub-1', header: { origin: 'subagent' } } },
  frame: {
    type: 'chunk',
    attemptId: 'a1',
    revision: 0,
    index: 0,
    time: Date.now(),
    chunk: { type, index: 0, text: 'x' },
  },
})
const sessionsBefore = tracker.snapshot().sessions
tracker.onStream(subChunk('reasoning-delta'))
assert.equal(phase(), 'waiting', '子代理流帧不抢占灵宠')
assert.equal(tracker.snapshot().sessions, sessionsBefore, '子代理流帧不建会话')

/* 静默兜底：会吐字的相位长时间没有更新 → 判会话已结束，回落 idle。 */
emit('turn/start', { turn: 8 })
assert.equal(phase(), 'listening')
tracker.sessions.get('session-1').updatedAt = Date.now() - 6 * 60 * 1000
assert.equal(tracker.snapshot().phase, 'idle', '思考相位静默超时 → 回落 idle')
assert.equal(tracker.sessions.get('session-1').phase, 'idle')

/* tool 相位不做静默兜底：十几分钟的长命令是正常的。 */
emit('tool/call', { turn: 8, step: 1, callId: 'c9', name: 'pwsh', arguments: '{}' })
tracker.sessions.get('session-1').updatedAt = Date.now() - 20 * 60 * 1000
assert.equal(tracker.snapshot().phase, 'tool', 'tool 相位不受静默兜底影响')
emit('turn/end', { turn: 8, reason: { kind: 'completed' } })
assert.equal(phase(), 'done', '收尾后正常写 done')

assert.equal(familyOf('web_search').family, 'gaze')
assert.equal(familyOf('todo_write').family, 'chess')
assert.equal(familyOf('todo_write').key, 'chess', 'familyOf 带双语 key')
assert.equal(familyOf('compress').key, 'recall', '同族不同动作 key 不同')
assert.equal(hintOf('edit', JSON.stringify({ path: 'a/b.txt' })), 'a/b.txt')

/* ---- 进度播报投影：todo/write / turn/end → 结构化台词 ---- */
const speech = () => tracker.snapshot().speech

emit('todo/write', {
  todos: [
    { content: '读代码', status: 'completed' },
    { content: '写测试', status: 'in_progress' },
    { content: '跑烟测', status: 'pending' },
  ],
})
assert.equal(speech().kind, 'todo', 'todo/write 出台词')
assert.equal(speech().state, 'step', '有 in_progress → step')
assert.equal(speech().n, 2, '步骤序号按清单位置')
assert.equal(speech().content, '写测试', '当前步内容')
assert.equal(speech().done, 1, '已完成计数')
assert.equal(speech().total, 3, '清单总数')
assert.ok(speech().at > 0, '台词带时间戳')

emit('todo/write', { todos: [{ content: '踩点', status: 'pending' }, { content: '布阵', status: 'pending' }] })
assert.equal(speech().state, 'plan', '全未开始 → plan')

emit('todo/write', { todos: [{ content: '踩点', status: 'completed' }, { content: '布阵', status: 'completed' }] })
assert.equal(speech().state, 'alldone', '全完成 → alldone')

const alldoneAt = speech().at
emit('todo/write', { todos: [{ content: '踩点', status: 'completed' }, { content: '布阵', status: 'completed' }] })
assert.equal(speech().at, alldoneAt, '同内容台词 2s 内不重复')

emit('turn/start', { turn: 4 })
emit('turn/end', { turn: 4, reason: { kind: 'completed' } })
assert.equal(speech().kind, 'done', '无清单收工 → done 台词')
assert.equal(speech().total, undefined, '无清单不带进度计数')

emit('turn/start', { turn: 5 })
emit('todo/write', { todos: [{ content: '磨剑', status: 'in_progress' }] })
emit('tool/call', { turn: 5, step: 1, callId: 'c5', name: 'bash', arguments: '{}' })
emit('tool/result', { turn: 5, step: 1, message: { toolCallId: 'c5' }, error: { name: 'E', code: 'X' } })
assert.equal(speech().kind, 'todo', '单次工具出错不抢台词（气泡走出错了 label，只有整轮失败才播报）')

emit('turn/end', { turn: 6, reason: { kind: 'blocked' } })
assert.equal(speech().kind, 'waiting', '等待审批 → waiting 台词')

emit('turn/start', { turn: 7 })
emit('todo/write', { todos: [{ content: '扫地', status: 'pending' }] })
emit('turn/end', { turn: 7, reason: { kind: 'completed' } })
assert.equal(speech().kind, 'done', '收工带清单进度')
assert.equal(speech().done, 0, '清单 0/1 完成')
assert.equal(speech().total, 1, '清单总数 1')

/* ---- 每日陪伴计时（tickCompany 纯函数）---- */
const t0 = new Date(2026, 10, 20, 9, 0, 0).getTime()
const fresh = tickCompany(null, t0)
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(fresh.date), 'date 是本地 YYYY-MM-DD')
assert.equal(fresh.accumulatedMs, 0, '首见不计时长')
assert.equal(fresh.firstSeenAt, t0, '首见时刻即今日陪伴起点')
assert.equal(fresh.metAt, t0, '初见时刻即相遇时刻')
assert.equal(fresh.days, 1, '安装当天是相遇第 1 天')
assert.equal(fresh.milestone, 1, '第 1 天本身是里程碑')
assert.equal(tickCompany(fresh, t0 + 1000).accumulatedMs, 1000, '窗口内累计 1s')
const gapped = tickCompany(tickCompany(fresh, t0 + 1000), t0 + 61000)
assert.equal(gapped.accumulatedMs, 1000, '间隔超 15s 不累计（浮层隐藏/刚打开）')
assert.equal(tickCompany(gapped, t0 + 61500).accumulatedMs, 1500, '恢复轮询后继续累计')
const weekLater = tickCompany(fresh, new Date(2026, 10, 26, 9, 0, 0).getTime())
assert.equal(weekLater.metAt, t0, '相遇时刻永久保留')
assert.equal(weekLater.days, 7, '跨 6 天后是相遇第 7 天')
assert.equal(weekLater.milestone, 7, '第 7 天是里程碑')
assert.equal(weekLater.accumulatedMs, 0, '跨天今日清零')
const day8 = tickCompany(weekLater, new Date(2026, 10, 27, 9, 0, 0).getTime())
assert.equal(day8.days, 8, '第 8 天')
assert.equal(day8.milestone, 0, '非里程碑日为 0')
const day100 = tickCompany(fresh, new Date(2027, 1, 27, 9, 0, 0).getTime())
assert.equal(day100.days, 100, '第 100 天')
assert.equal(day100.milestone, 100, '第 100 天是里程碑')

/* 陪伴文件读写往返：metAt 落盘并解析回来 */
const companyRoundtrip = path.join(home, 'company-roundtrip.json')
await writeSettings(
  { date: '2026-11-20', firstSeenAt: t0, accumulatedMs: 60000, metAt: t0 - 86400000 * 3 },
  companyRoundtrip,
)
const loadedCompany = await readCompany(companyRoundtrip)
assert.equal(loadedCompany.metAt, t0 - 86400000 * 3, 'readCompany 解析相遇时刻')
assert.equal(loadedCompany.lastPollAt, 0, '读盘后首查不计间隔')
assert.equal((await readCompany(path.join(home, 'missing-company.json'))) === null, true, '缺失文件回落 null')

// 假 ctx 走一遍 apply：路由注册、事件监听、405 处理、资产服务。
const routes = []
const listeners = []
const fakeCtx = {
  get: (key) =>
    key === 'webServer'
      ? {
          register: (r) => {
            routes.push(r)
            return () => {}
          },
        }
      : undefined,
  on: (name, fn) => {
    listeners.push([name, fn])
    return () => {}
  },
  effect: (fn) => {
    const off = fn()
    return typeof off === 'function' ? off : () => {}
  },
}
apply(fakeCtx)

const find = (path) => routes.find((r) => r.path === path)

/* 资源路由直接测；handler 路由（设置）用一对假 req/res 驱动。 */
function fakeReq(method, url, bodyText) {
  const listeners = {}
  const req = {
    method,
    url,
    on(event, fn) {
      ;(listeners[event] || (listeners[event] = [])).push(fn)
      return req
    },
    destroy() {},
  }
  queueMicrotask(() => {
    if (bodyText) (listeners.data || []).forEach((fn) => fn(Buffer.from(bodyText)))
    ;(listeners.end || []).forEach((fn) => fn())
  })
  return req
}

async function callRoute(route, request) {
  if (typeof route.resource === 'function') return route.resource(request)
  const bodyText = request.body ? await request.text() : ''
  const chunks = []
  const res = {
    statusCode: 0,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status
      Object.assign(this.headers, headers || {})
    },
    end(payload) {
      if (payload) chunks.push(Buffer.from(payload))
    },
  }
  await route.handler(fakeReq(request.method, request.url, bodyText), res)
  return new Response(Buffer.concat(chunks).toString('utf8'), {
    status: res.statusCode,
    headers: res.headers,
  })
}

const route = find('/api/shanhai-pet/state')
assert.ok(route, '状态路由已注册')
assert.equal(route.kind, 'exact')

const ok = await route.resource(new Request('http://127.0.0.1/api/shanhai-pet/state'))
assert.equal(ok.status, 200)
const okBody = await ok.json()
assert.equal(okBody.ok, true)
assert.equal(okBody.settings.visible, true, '状态响应里带设置')
assert.equal(okBody.settings.greet, true, '状态响应带问候开关')
assert.ok(okBody.company && okBody.company.firstSeenAt > 0, 'state 带 company（首见时刻）')
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(okBody.company.date), 'company.date 是本地日期')
assert.equal(typeof okBody.company.minutes, 'number', 'company.minutes 就位')
assert.equal(okBody.company.days, 1, '新环境相遇第 1 天')
assert.equal(okBody.company.milestone, 1, '第 1 天是里程碑')

await new Promise((resolve) => setTimeout(resolve, 1100))
const companyRes = await route.resource(new Request('http://127.0.0.1/api/shanhai-pet/state'))
const companyBody = await companyRes.json()
assert.equal(
  companyBody.company.firstSeenAt,
  okBody.company.firstSeenAt,
  '同一天的陪伴起点不变',
)

const bad = await route.resource(
  new Request('http://127.0.0.1/api/shanhai-pet/state', { method: 'POST' }),
)
assert.equal(bad.status, 405)

// 帧清单
const manifestRoute = find('/api/shanhai-pet/pet.json')
assert.ok(manifestRoute, '清单路由已注册')
const manifestRes = await manifestRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/pet.json'))
assert.equal(manifestRes.status, 200)
const manifest = await manifestRes.json()
assert.equal(manifest.id, 'ranran')
assert.ok(manifest.frames2d && manifest.frames2d.tracks.idle, '清单含帧轨道')
assert.ok(manifest.frames2d.tracks.idle.frames.includes('breathopen'))

// 立绘资产
const assetRoute = find('/api/shanhai-pet/assets')
assert.ok(assetRoute && assetRoute.kind === 'prefix', '资产路由已注册')
const png = await assetRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/assets/frames/breathopen.png'))
assert.equal(png.status, 200)
assert.equal(png.headers.get('content-type'), 'image/png')
const bytes = await png.arrayBuffer()
assert.equal(bytes.byteLength > 1000, true)

const traversal = await assetRoute.resource(
  new Request('http://127.0.0.1/api/shanhai-pet/assets/../../index.js'),
)
assert.equal(traversal.status, 404, '路径逃逸被拒绝')

// 烘焙动画：webp 放行并按扩展名给 content-type
const webp = await assetRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/assets/anim/idle.webp'))
assert.equal(webp.status, 200, 'anim/idle.webp 可读')
assert.equal(webp.headers.get('content-type'), 'image/webp')
assert.equal((await webp.arrayBuffer()).byteLength > 1000, true, 'webp 非空')
const gif = await assetRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/assets/anim/nope.gif'))
assert.equal(gif.status, 404, '缺文件仍是 404')
const txt = await assetRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/assets/anim/idle.txt'))
assert.equal(txt.status, 404, '不认识的扩展名拒绝')

// 设置读写（handler 路由：资源路由只放行 GET/HEAD，写要用原生 handler）
const settingsRoute = find('/api/shanhai-pet/settings')
assert.ok(settingsRoute, '设置路由已注册')
assert.equal(typeof settingsRoute.handler, 'function', '设置路由是 handler 路由')
const initial = await (
  await callRoute(settingsRoute, new Request('http://127.0.0.1/api/shanhai-pet/settings'))
).json()
assert.equal(initial.ok, true)
assert.equal(initial.settings.height, 250)

const headRes = await callRoute(
  settingsRoute,
  new Request('http://127.0.0.1/api/shanhai-pet/settings', { method: 'HEAD' }),
)
assert.equal(headRes.status, 200, 'HEAD 可用')
assert.equal(await headRes.text(), '', 'HEAD 无响应体')

const saved = await (
  await callRoute(
    settingsRoute,
    new Request('http://127.0.0.1/api/shanhai-pet/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ height: 320, blink: false, bottom: 60 }),
    }),
  )
).json()
assert.equal(saved.settings.height, 320)
assert.equal(saved.settings.blink, false, '布尔覆盖生效')
assert.equal(saved.settings.bottom, 60)
assert.equal(saved.settings.visible, true, '未提交的字段保持不变')

const onDisk = JSON.parse(await readFile(settingsFile(), 'utf8'))
assert.equal(onDisk.height, 320, '设置已原子落盘')
assert.equal(onDisk.blink, false)

const reread = await readSettings()
assert.deepEqual(reread, saved.settings, '读回与写入一致')

const rejected = await callRoute(
  settingsRoute,
  new Request('http://127.0.0.1/api/shanhai-pet/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{oops',
  }),
)
assert.equal(rejected.status, 400, '坏 JSON 被拒')

const emptyBody = await callRoute(
  settingsRoute,
  new Request('http://127.0.0.1/api/shanhai-pet/settings', { method: 'POST' }),
)
assert.equal(emptyBody.status, 400, '空 body 被拒')

const wrongMethod = await callRoute(
  settingsRoute,
  new Request('http://127.0.0.1/api/shanhai-pet/settings', { method: 'DELETE' }),
)
assert.equal(wrongMethod.status, 405)
assert.match(wrongMethod.headers.get('allow'), /POST/)

// 损坏的设置文件回落默认值
await writeSettings(normalizeSettings({ height: 200 }))
const corruptFile = settingsFile()
const fs = await import('node:fs/promises')
await fs.writeFile(corruptFile, 'not json', 'utf8')
assert.equal((await readSettings()).height, 250, '坏文件回落默认值')

/* ---- 自定义皮肤：扫描 / 上传 / 切换 / 解析优先 ---- */
const skinsRoute = find('/api/shanhai-pet/skins')
assert.ok(skinsRoute && typeof skinsRoute.handler === 'function', '皮肤路由已注册')

const skinsList0 = await (
  await callRoute(skinsRoute, new Request('http://127.0.0.1/api/shanhai-pet/skins'))
).json()
assert.deepEqual(skinsList0.skins.map((s) => s.name), ['ranran'], '初始只有内置皮肤')
assert.equal(skinsList0.active, '', '默认无自定义皮肤')

const skinJson = Buffer.from(
  JSON.stringify({ displayName: '测试皮肤', frames2d: { tracks: { idle: { frames: ['a'] } } } }),
).toString('base64')
const framePng = Buffer.from('fake-png-bytes').toString('base64')
const postSkin = (body) =>
  callRoute(
    skinsRoute,
    new Request('http://127.0.0.1/api/shanhai-pet/skins', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

const up1 = await (await postSkin({ op: 'upload', name: 'myskin', path: 'pet.json', data: skinJson })).json()
assert.equal(up1.ok, true, '上传 pet.json 成功')
const up2 = await (
  await postSkin({ op: 'upload', name: 'myskin', path: 'frames/a.png', data: framePng })
).json()
assert.equal(up2.ok, true, '上传帧图成功')

const badName = await postSkin({ op: 'upload', name: '../evil', path: 'pet.json', data: framePng })
assert.equal(badName.status, 400, '非法皮肤名被拒')
const badPath = await postSkin({ op: 'upload', name: 'myskin', path: '../../settings.json', data: framePng })
assert.equal(badPath.status, 400, '路径逃逸被拒')
const badRel = await postSkin({ op: 'upload', name: 'myskin', path: 'frames/../../x.png', data: framePng })
assert.equal(badRel.status, 400, '白名单外路径被拒')
const oversize = await postSkin({
  op: 'upload',
  name: 'myskin',
  path: 'frames/big.png',
  data: 'A'.repeat(12 * 1024 * 1024),
})
assert.equal(oversize.status, 413, '超限文件 413')

const scanned = await listSkins(skinsRoot())
assert.ok(scanned.some((s) => s.name === 'myskin' && s.title === '测试皮肤'), '上传后扫描到皮肤')
const badSkinDir = path.join(skinsRoot(), 'bad-skin')
await mkdir(badSkinDir, { recursive: true })
await writeFile(path.join(badSkinDir, 'pet.json'), 'not-json', 'utf8')
const scannedAfter = await listSkins(skinsRoot())
assert.ok(!scannedAfter.some((s) => s.name === 'bad-skin'), '坏皮肤目录不进列表')

const selectMissing = await postSkin({ op: 'select', name: 'nope' })
assert.equal(selectMissing.status, 400, '选择不存在的皮肤被拒')
const selected = await (await postSkin({ op: 'select', name: 'myskin' })).json()
assert.equal(selected.settings.activeSkin, 'myskin', '切换皮肤写入设置')

const skinManifest = await (
  await manifestRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/pet.json'))
).json()
assert.equal(skinManifest.displayName, '测试皮肤', 'manifest 优先用皮肤清单')
const skinPng = await assetRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/assets/frames/a.png'))
assert.equal(skinPng.status, 200)
assert.equal(await skinPng.text(), 'fake-png-bytes', '帧图来自皮肤目录')
const fallbackPng = await assetRoute.resource(
  new Request('http://127.0.0.1/api/shanhai-pet/assets/frames/breathopen.png'),
)
assert.equal(fallbackPng.status, 200, '皮肤缺的帧回落内置')
assert.equal((await fallbackPng.arrayBuffer()).byteLength > 1000, true, '回落帧非空')

const backToBuiltin = await (await postSkin({ op: 'select', name: '' })).json()
assert.equal(backToBuiltin.settings.activeSkin, '', '空串切回内置')
const selectBuiltin = await (await postSkin({ op: 'select', name: 'ranran' })).json()
assert.equal(selectBuiltin.settings.activeSkin, '', '点内置冉冉的启用也能切回内置')
const builtinManifest = await (
  await manifestRoute.resource(new Request('http://127.0.0.1/api/shanhai-pet/pet.json'))
).json()
assert.equal(builtinManifest.id, 'ranran', '回落内置清单')

const wired = listeners.find(([name]) => name === 'session/event')
assert.ok(wired, 'session/event 已接上')
wired[1]({ id: 's9', header: {} }, { type: 'turn/start', data: { turn: 1 } })
const body = await (
  await route.resource(new Request('http://127.0.0.1/api/shanhai-pet/state'))
).json()
assert.equal(body.phase, 'listening')

tracker.dispose()
await rm(home, { recursive: true, force: true })
console.log('SMOKE_HOST_OK')
