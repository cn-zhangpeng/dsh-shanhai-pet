/**
 * Host 半区烟测：事件投影 → 相位 → HTTP 状态/接口。
 * 跑法：node tests/smoke-host.mjs
 */
import assert from 'node:assert/strict'
import { apply, createTracker, familyOf, hintOf } from '../index.js'

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
const route = find('/api/shanhai-pet/state')
assert.ok(route, '状态路由已注册')
assert.equal(route.kind, 'exact')

const ok = await route.resource(new Request('http://127.0.0.1/api/shanhai-pet/state'))
assert.equal(ok.status, 200)
assert.equal((await ok.json()).ok, true)

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

const wired = listeners.find(([name]) => name === 'session/event')
assert.ok(wired, 'session/event 已接上')
wired[1]({ id: 's9', header: {} }, { type: 'turn/start', data: { turn: 1 } })
const body = await (
  await route.resource(new Request('http://127.0.0.1/api/shanhai-pet/state'))
).json()
assert.equal(body.phase, 'listening')

tracker.dispose()
console.log('SMOKE_HOST_OK')
