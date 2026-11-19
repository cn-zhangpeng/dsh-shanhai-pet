/**
 * 山海灵宠 · Host 半区
 *
 * 职责：把 DSH 的结构化会话事件投影成"灵宠相位"（不读任何对话文本），
 * 并通过 webServer 暴露同源只读接口 GET /api/shanhai-pet/state 给渲染层。
 *
 * 相位：idle 坐忘 / listening 竖耳 / thinking 看云 / tool 行法（按工具族细分）
 *       / review 展卷 / done 点灯 / failed 抱尾 / waiting 歪头
 *
 * 资产：assets/ranran/pet.json（帧清单）+ assets/ranran/frames/*.png（立绘帧），
 *       只读暴露给渲染层。
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STATE_PATH = '/api/shanhai-pet/state'
const MANIFEST_PATH = '/api/shanhai-pet/pet.json'
const ASSETS_PREFIX = '/api/shanhai-pet/assets'
const REPORT_PATH = '/api/shanhai-pet/client-report'
const ASSET_ROOT = fileURLToPath(new URL('./assets/ranran/', import.meta.url))
const FRAME_FILE = /^[a-z0-9_-]+\/[a-z0-9_-]+\.png$/i
const SETTLE_MS = 2600
const WAIT_SETTLE_MS = 12000
const TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 40

/** 工具族：先后顺序决定匹配优先级。 */
const FAMILIES = [
  { re: /^(edit|write|apply_patch|multi_edit|str_replace|replace)$/i, family: 'ink', label: '磨墨' },
  { re: /^(bash|pwsh|powershell|shell|exec|run_command)$/i, family: 'wind', label: '御风' },
  { re: /^(read|grep|glob|ls|find|list_directory)$/i, family: 'sniff', label: '嗅风' },
  { re: /^(web_search|web_fetch|fetch|browser|autoglm)/i, family: 'gaze', label: '望山' },
  { re: /^(todo_write|todo_read|todo)$/i, family: 'chess', label: '摆棋' },
  { re: /^(subagent|subagent_fork|workflow|job_kill|job_output|job_list|send_message|list_agents|wait_agent)$/i, family: 'split', label: '分身' },
  { re: /^(compress|decompress|search_context|acp_cache|acp_status)$/i, family: 'ink', label: '拾忆' },
  { re: /^(schedule_|skill|getnote)/i, family: 'gaze', label: '观时' },
  { re: /^(cordis_inspect|plugin_manager|plugin_market)/i, family: 'sniff', label: '探脉' },
]

/** 工具名 → 族。 */
export function familyOf(name) {
  const raw = String(name || '')
  for (const entry of FAMILIES) {
    if (entry.re.test(raw)) return { family: entry.family, label: entry.label }
  }
  return { family: 'tool', label: '行法' }
}

/** 从工具参数里取一句可读提示（只取白名单字段，不整段解析文本内容）。 */
export function hintOf(name, args) {
  let parsed = null
  if (typeof args === 'string' && args.trim()) {
    try {
      parsed = JSON.parse(args)
    } catch {
      parsed = null
    }
  } else if (args && typeof args === 'object') {
    parsed = args
  }
  const pick = (key) => (parsed && typeof parsed[key] === 'string' ? parsed[key] : '')
  const raw =
    pick('file_path') ||
    pick('path') ||
    pick('pattern') ||
    pick('query') ||
    pick('url') ||
    pick('command') ||
    (typeof args === 'string' ? args : '')
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 42)
}

/**
 * 独立的状态投射器（不依赖 ctx，便于单元测试）。
 * 事件与流帧都只读取结构化字段：type / reason.kind / tool 名 / 参数。
 */
export function createTracker() {
  const sessions = new Map()
  const timers = new Set()
  let lastId = null
  let version = 0

  function prune() {
    const now = Date.now()
    for (const [id, st] of sessions) {
      if (st.updatedAt && now - st.updatedAt > TTL_MS) {
        clearTimer(st)
        sessions.delete(id)
        if (lastId === id) lastId = null
      }
    }
    if (sessions.size > MAX_SESSIONS) {
      const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)
      for (const st of oldest.slice(0, sessions.size - MAX_SESSIONS)) {
        clearTimer(st)
        sessions.delete(st.id)
        if (lastId === st.id) lastId = null
      }
    }
  }

  function clearTimer(st) {
    if (st.timer) {
      clearTimeout(st.timer)
      timers.delete(st.timer)
      st.timer = null
    }
  }

  function get(id) {
    let st = sessions.get(id)
    if (!st) {
      st = { id, phase: 'idle', detail: null, since: 0, updatedAt: 0, activeTools: new Set(), timer: null }
      sessions.set(id, st)
    }
    return st
  }

  function mark(st, phase, detail, { keepTimer = false } = {}) {
    const sameLabel = (st.detail && st.detail.label) === (detail && detail.label)
    if (st.phase === phase && sameLabel) {
      st.detail = detail || null
      st.updatedAt = Date.now()
      version += 1
      return
    }
    if (!keepTimer) clearTimer(st)
    st.phase = phase
    st.detail = detail || null
    st.since = Date.now()
    st.updatedAt = st.since
    lastId = st.id
    version += 1
  }

  function settle(st, phase, ms) {
    clearTimer(st)
    const timer = setTimeout(() => {
      timers.delete(timer)
      st.timer = null
      if (st.phase === phase) mark(st, 'idle', null)
    }, ms)
    timers.add(timer)
    st.timer = timer
  }

  function onEvent(session, event) {
    if (!session || !event) return
    if (session.header && session.header.origin === 'subagent') return
    const id = String(session.id)
    const st = get(id)
    prune()
    const data = event.data || {}
    switch (event.type) {
      case 'turn/start':
        mark(st, 'listening', { label: '竖耳' })
        break
      case 'step/start':
        if (st.phase !== 'tool') mark(st, 'thinking', { label: '看云' })
        break
      case 'tool/call': {
        st.activeTools.add(String(data.callId))
        const fam = familyOf(data.name)
        mark(st, 'tool', {
          family: fam.family,
          label: fam.label,
          tool: data.name,
          hint: hintOf(data.name, data.arguments),
        })
        break
      }
      case 'tool/result': {
        const callId = data.message && data.message.toolCallId ? String(data.message.toolCallId) : ''
        if (callId) st.activeTools.delete(callId)
        if (data.error) {
          mark(st, 'failed', { label: '碰壁', tool: pickToolName(st) })
          settle(st, 'failed', SETTLE_MS)
        } else if (st.activeTools.size === 0) {
          mark(st, 'thinking', { label: '看云' })
        }
        break
      }
      case 'turn/end': {
        st.activeTools.clear()
        const kind = data.reason && data.reason.kind
        if (kind === 'completed') {
          mark(st, 'done', { label: '点灯' })
          settle(st, 'done', SETTLE_MS)
        } else if (kind === 'error' || kind === 'max-tokens' || kind === 'interrupted') {
          mark(st, 'failed', { label: '抱尾' })
          settle(st, 'failed', SETTLE_MS)
        } else if (kind === 'blocked') {
          mark(st, 'waiting', { label: '歪头' })
          settle(st, 'waiting', WAIT_SETTLE_MS)
        } else {
          mark(st, 'idle', null)
        }
        break
      }
      default:
        break
    }
  }

  function pickToolName(st) {
    return st.detail && st.detail.tool ? st.detail.tool : ''
  }

  function onStream(payload) {
    const agent = payload && payload.agent
    const frame = payload && payload.frame
    if (!agent || !frame || frame.type !== 'chunk' || !frame.chunk) return
    const st = get(String(agent.id))
    if (st.phase === 'tool') return
    if (frame.chunk.type === 'reasoning-delta') mark(st, 'thinking', { label: '看云' })
    else if (frame.chunk.type === 'text-delta') mark(st, 'review', { label: '展卷' })
    prune()
  }

  function snapshot() {
    prune()
    const st = lastId ? sessions.get(lastId) : null
    return {
      ok: true,
      phase: (st && st.phase) || 'idle',
      since: (st && st.since) || 0,
      updatedAt: (st && st.updatedAt) || 0,
      detail: st ? st.detail : null,
      sessions: sessions.size,
      version,
    }
  }

  function dispose() {
    for (const t of timers) clearTimeout(t)
    timers.clear()
    sessions.clear()
    lastId = null
  }

  return { sessions, onEvent, onStream, snapshot, dispose }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow: 'GET, HEAD' },
  })
}

function notFound() {
  return new Response('Not Found', { status: 404 })
}

/** 声明依赖：等 webServer 服务启动后再 apply，路由才能注册上。 */
export const name = 'dsh-shanhai-pet'
export const inject = ['webServer']

export function apply(ctx) {
  const tracker = createTracker()
  const clientReports = []

  const web = ctx.get('webServer')
  if (web) {
    ctx.effect(() =>
      web.register({
        kind: 'exact',
        path: STATE_PATH,
        resource: async (request) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            return methodNotAllowed()
          }
          return json(tracker.snapshot())
        },
      }),
    )

    ctx.effect(() =>
      web.register({
        kind: 'exact',
        path: MANIFEST_PATH,
        resource: async (request) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            return methodNotAllowed()
          }
          try {
            const text = await readFile(path.join(ASSET_ROOT, 'pet.json'), 'utf8')
            return new Response(text, {
              headers: {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-cache',
              },
            })
          } catch {
            return json({ ok: false, error: 'pet.json missing' }, 404)
          }
        },
      }),
    )

    ctx.effect(() =>
      web.register({
        kind: 'prefix',
        path: ASSETS_PREFIX,
        resource: async (request) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            return methodNotAllowed()
          }
          let rel = ''
          try {
            rel = decodeURIComponent(new URL(request.url).pathname.slice(ASSETS_PREFIX.length))
          } catch {
            return notFound()
          }
          rel = rel.replace(/^\/+/, '')
          if (!FRAME_FILE.test(rel)) return notFound()
          try {
            const buf = await readFile(path.join(ASSET_ROOT, rel))
            return new Response(buf, {
              headers: {
                'content-type': 'image/png',
                'cache-control': 'no-cache',
              },
            })
          } catch {
            return notFound()
          }
        },
      }),
    )

    ctx.effect(() =>
      web.register({
        kind: 'exact',
        path: REPORT_PATH,
        resource: async (request) => {
          if (request.method === 'GET' || request.method === 'HEAD') {
            try {
              const raw = new URL(request.url).searchParams.get('d')
              if (raw) {
                const entry = JSON.parse(raw)
                clientReports.push(entry)
                if (clientReports.length > 30) clientReports.splice(0, clientReports.length - 30)
                return json({ ok: true })
              }
            } catch {
              clientReports.push({ ok: false, error: 'bad report' })
            }
            return json({ ok: true, reports: clientReports.slice() })
          }
          return methodNotAllowed()
        },
      }),
    )
  } else {
    console.warn('[shanhai-pet] webServer 服务不可用，渲染层将收不到状态')
  }

  ctx.effect(() => {
    const offEvent = ctx.on('session/event', (session, event) => tracker.onEvent(session, event))
    const offStream = ctx.on('agent/assistant-stream', (payload) => tracker.onStream(payload))
    return () => {
      offEvent()
      offStream()
    }
  })

  ctx.effect(() => () => tracker.dispose())
}

export default { name, inject, apply }
