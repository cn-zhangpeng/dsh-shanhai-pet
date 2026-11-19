/**
 * Host 半区烟测：事件投影 → 相位 → HTTP 状态/接口 → 设置读写。
 * 跑法：node tests/smoke-host.mjs
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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
assert.equal(tracker.snapshot().detail.label, '磨墨')
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

assert.equal(familyOf('web_search').family, 'gaze')
assert.equal(familyOf('todo_write').family, 'chess')
assert.equal(hintOf('edit', JSON.stringify({ path: 'a/b.txt' })), 'a/b.txt')

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
