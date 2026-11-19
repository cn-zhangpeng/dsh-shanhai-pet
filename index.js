/**
 * 山海灵宠 · Host 半区
 *
 * 职责：把 DSH 的结构化会话事件投影成"灵宠相位"（不读任何对话文本），
 * 并通过 webServer 暴露同源只读接口 GET /api/shanhai-pet/state 给渲染层。
 * 进度播报：todo/write 与 turn/end 折成结构化台词（speech），文案由渲染层按语言渲染。
 *
 * 相位：idle 发呆 / listening 听你说 / thinking 琢磨中 / tool 干活中（按工具族细分）
 *       / review 写答复 / done 干完了 / failed 出错了 / waiting 等你点头
 *
 * 资产：assets/ranran/pet.json（帧清单）+ assets/ranran/frames/*.png（立绘帧），
 *       只读暴露给渲染层。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STATE_PATH = '/api/shanhai-pet/state'
const MANIFEST_PATH = '/api/shanhai-pet/pet.json'
const ASSETS_PREFIX = '/api/shanhai-pet/assets'
const REPORT_PATH = '/api/shanhai-pet/client-report'
const SETTINGS_PATH = '/api/shanhai-pet/settings'
const ASSET_ROOT = fileURLToPath(new URL('./assets/ranran/', import.meta.url))
// frames/<name>.png 逐帧图；anim/<name>.webp|gif 烘焙好的循环动画（浏览器原生播放）。
const ASSET_FILE = /^[a-z0-9_-]+\/[a-z0-9_-]+\.(png|webp|gif)$/i
const ASSET_TYPES = {
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}
const SETTLE_MS = 2600
const WAIT_SETTLE_MS = 12000
const TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 40
// 播报：同一条台词 2s 内不重复刷；步骤内容截 24 字，长任务名不挤爆气泡。
const SPEECH_GAP_MS = 2000
const SPEECH_TEXT_MAX = 24
// 陪伴计时：状态轮询间隔 ≤15s 才计入在场时长（浮层隐藏时客户端不轮询，自动暂停）；
// 累计满 30s 落盘一次，跨天清零（metAt 相遇时刻永久保留）。
const COMPANY_POLL_WINDOW = 15 * 1000
const COMPANY_PERSIST_EVERY = 30 * 1000
// 里程碑（相遇第 N 天）：当天的第一次问候变成特别台词并点灯庆祝。
const MILESTONES = [1, 7, 30, 100, 200, 365, 500, 1000]

/**
 * 工具族：先后顺序决定匹配优先级。
 * key 给渲染层做双语（同族不同动作可有不同 key，如 ink 族的改文件/翻记忆）。
 */
const FAMILIES = [
  { re: /^(edit|write|apply_patch|multi_edit|str_replace|replace)$/i, family: 'ink', key: 'grind', label: '改文件' },
  { re: /^(bash|pwsh|powershell|shell|exec|run_command)$/i, family: 'wind', key: 'wind', label: '跑命令' },
  { re: /^(read|grep|glob|ls|find|list_directory)$/i, family: 'sniff', key: 'sniff', label: '读代码' },
  { re: /^(web_search|web_fetch|fetch|browser|autoglm)/i, family: 'gaze', key: 'gaze', label: '查资料' },
  { re: /^(todo_write|todo_read|todo)$/i, family: 'chess', key: 'chess', label: '理清单' },
  { re: /^(subagent|subagent_fork|workflow|job_kill|job_output|job_list|send_message|list_agents|wait_agent)$/i, family: 'split', key: 'split', label: '派分身' },
  { re: /^(compress|decompress|search_context|acp_cache|acp_status)$/i, family: 'ink', key: 'recall', label: '翻记忆' },
  { re: /^(schedule_|skill|getnote)/i, family: 'gaze', key: 'watch', label: '看日程' },
  { re: /^(cordis_inspect|plugin_manager|plugin_market)/i, family: 'sniff', key: 'probe', label: '查插件' },
]

/** 工具名 → 族。 */
export function familyOf(name) {
  const raw = String(name || '')
  for (const entry of FAMILIES) {
    if (entry.re.test(raw)) return { family: entry.family, key: entry.key, label: entry.label }
  }
  return { family: 'tool', key: 'cast', label: '干活中' }
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

/* ---------- 外观设置：持久化在 $DSH_HOME/shanhai-pet/settings.json ---------- */

/**
 * 设置默认值。Client 半区各存一份同样的表，字段名必须一一对应；
 * 全部只影响渲染层，不改变相位投影。
 */
export const DEFAULT_SETTINGS = Object.freeze({
  visible: true, // 浮层总开关
  height: 250, // 立绘高度 px（宽度按原图比例换算）
  right: 24, // 距视口右边缘 px
  bottom: 14, // 距视口底部 px
  blink: true, // 待机时眨眼（时长烘在 anim/idle.webp 里）
  float: true, // 待机时呼吸浮动
  bubble: true, // 非 idle 相位的气泡
  poke: true, // 点击互动
  narrate: true, // 任务进度播报（todo 清单 + 收工/碰壁台词）
  greet: true, // 闲时温馨问候（打开时一次 + 闲置半小时一次）
})

/** 数值项取值范围，越界按边界夹取。 */
const NUMERIC_LIMITS = {
  height: [96, 640],
  right: [0, 4000],
  bottom: [0, 4000],
}

function clampNumber(value, fallback, [min, max]) {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

/** 把任意输入收敛成一份合法设置，缺失或坏值回落 base / 默认值。 */
export function normalizeSettings(input, base = DEFAULT_SETTINGS) {
  const src = input && typeof input === 'object' ? input : {}
  const seed = base && typeof base === 'object' ? base : DEFAULT_SETTINGS
  const bool = (key) => (typeof src[key] === 'boolean' ? src[key] : seed[key] !== false)
  const num = (key) => clampNumber(src[key], seed[key], NUMERIC_LIMITS[key])
  return {
    visible: bool('visible'),
    height: num('height'),
    right: num('right'),
    bottom: num('bottom'),
    blink: bool('blink'),
    float: bool('float'),
    bubble: bool('bubble'),
    poke: bool('poke'),
    narrate: bool('narrate'),
    greet: bool('greet'),
  }
}

/** DSH home：`$DSH_HOME` 优先（支持 `~`），缺省 `~/.dsh`，与同族插件一致。 */
export function resolveDshHome(env = process.env, home = homedir()) {
  const raw = env && typeof env.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  if (!raw) return path.join(home, '.dsh')
  if (raw === '~') return home
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(home, raw.slice(2))
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)
}

/** 设置文件路径。 */
export function settingsFile(env = process.env, home = homedir()) {
  return path.join(resolveDshHome(env, home), 'shanhai-pet', 'settings.json')
}

/** 当日陪伴时长文件路径。 */
export function companyFile(env = process.env, home = homedir()) {
  return path.join(resolveDshHome(env, home), 'shanhai-pet', 'company.json')
}

/** 容错读：文件缺失或损坏都回落默认值，绝不让坏 JSON 挡住浮层。 */
export async function readSettings(file = settingsFile()) {
  try {
    const text = await readFile(file, 'utf8')
    return normalizeSettings(JSON.parse(text))
  } catch {
    return Object.assign({}, DEFAULT_SETTINGS)
  }
}

/** 原子写：先写临时文件再 rename，避免留下半截 JSON。 */
export async function writeSettings(settings, file = settingsFile()) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await writeFile(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8')
  await rename(tmp, file)
}

/* ---------- 每日陪伴时长：浮层可见（轮询在线）的时间，跨天清零 ---------- */

/** 本地日期 YYYY-MM-DD。 */
function localDate(now) {
  const d = new Date(now)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 容错读：文件缺失或损坏都回落 null（当天首见重新起算）。 */
export async function readCompany(file = companyFile()) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    if (!data || typeof data !== 'object') return null
    return {
      date: typeof data.date === 'string' ? data.date : '',
      firstSeenAt: Number.isFinite(data.firstSeenAt) ? data.firstSeenAt : 0,
      accumulatedMs: Number.isFinite(data.accumulatedMs) ? data.accumulatedMs : 0,
      metAt: Number.isFinite(data.metAt) ? data.metAt : 0,
      lastPollAt: 0, // 重启后的第一次轮询不计间隔
    }
  } catch {
    return null
  }
}

/** 从某本地日期到 now 的完整天数差（UTC 化比较，免夏令时干扰）。 */
function daysSince(dateStr, now) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''))
  if (!match) return 0
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const d = new Date(now)
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((today - then) / 86400000))
}

/**
 * 每次状态轮询推进陪伴计时（纯函数）。客户端只在浮层可见时轮询，
 * 所以请求间隔 ≤ COMPANY_POLL_WINDOW 才计入在场时长；跨天清零今日累计，
 * 但 metAt（初次相遇时刻）永久保留，days = 相遇第 N 天（安装当天是第 1 天）。
 */
export function tickCompany(company, now) {
  const date = localDate(now)
  const metAt = company && company.metAt > 0 ? Math.min(company.metAt, now) : now
  const metDate = localDate(metAt)
  const days = daysSince(metDate, now) + 1
  let carried
  if (!company || company.date !== date) {
    carried = { firstSeenAt: now, accumulatedMs: 0 }
  } else {
    const delta = company.lastPollAt ? now - company.lastPollAt : 0
    carried = {
      accumulatedMs:
        delta > 0 && delta <= COMPANY_POLL_WINDOW ? company.accumulatedMs + delta : company.accumulatedMs,
    }
  }
  return Object.assign({}, company, carried, {
    date,
    metAt,
    metDate,
    days,
    milestone: MILESTONES.includes(days) ? days : 0,
    lastPollAt: now,
  })
}

/**
 * 独立的状态投射器（不依赖 ctx，便于单元测试）。
 * 事件与流帧都只读取结构化字段：type / reason.kind / tool 名 / 参数 / todo 清单。
 * 台词只发结构化数据（kind/state/计数），文案由渲染层按语言渲染。
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
      st = {
        id,
        phase: 'idle',
        detail: null,
        since: 0,
        updatedAt: 0,
        activeTools: new Set(),
        timer: null,
        todos: null,
        speech: null,
        speechKey: '',
        speechAt: 0,
      }
      sessions.set(id, st)
    }
    return st
  }

  /**
   * 记一句台词。同内容 2s 内不重复；跨过间隔的重复台词刷新 at，
   * 让渲染层的"保持窗口"重新计时。
   */
  function say(st, speech) {
    const key = [speech.kind, speech.state, speech.content, speech.done, speech.total].join('|')
    const now = Date.now()
    if (key === st.speechKey && now - st.speechAt < SPEECH_GAP_MS) return
    st.speechKey = key
    st.speechAt = now
    st.speech = Object.assign({}, speech, { at: now })
    st.updatedAt = now
    version += 1
  }

  /** todo 清单 → 台词数据：in_progress 是当前步，completed 计已完成。 */
  function speechOfTodos(todos) {
    const list = (Array.isArray(todos) ? todos : []).filter(
      (t) => t && typeof t.content === 'string' && t.content.trim(),
    )
    if (!list.length) return null
    const total = list.length
    const done = list.filter((t) => t.status === 'completed').length
    const index = list.findIndex((t) => t.status === 'in_progress')
    if (index >= 0) {
      return {
        kind: 'todo',
        state: 'step',
        n: index + 1,
        content: list[index].content.replace(/\s+/g, ' ').trim().slice(0, SPEECH_TEXT_MAX),
        done,
        total,
      }
    }
    if (done >= total) return { kind: 'todo', state: 'alldone', done, total }
    return { kind: 'todo', state: 'plan', done, total }
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
        // todo 投影按轮清空，与核心 sessionProjections 的语义一致
        st.todos = null
        mark(st, 'listening', { label: '听你说' })
        break
      case 'todo/write': {
        st.todos = Array.isArray(data.todos) ? data.todos : []
        const speech = speechOfTodos(st.todos)
        if (speech) say(st, speech)
        break
      }
      case 'step/start':
        if (st.phase !== 'tool') mark(st, 'thinking', { label: '琢磨中' })
        break
      case 'tool/call': {
        st.activeTools.add(String(data.callId))
        const fam = familyOf(data.name)
        mark(st, 'tool', {
          family: fam.family,
          key: fam.key,
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
          mark(st, 'failed', { label: '出错了', tool: pickToolName(st) })
          settle(st, 'failed', SETTLE_MS)
        } else if (st.activeTools.size === 0) {
          mark(st, 'thinking', { label: '琢磨中' })
        }
        break
      }
      case 'turn/end': {
        st.activeTools.clear()
        const kind = data.reason && data.reason.kind
        if (kind === 'completed') {
          mark(st, 'done', { label: '干完了' })
          // 收工台词带上清单进度：有清单报"几/几"，没有就只说做完了
          const todos = Array.isArray(st.todos) ? st.todos : []
          const done = todos.filter((t) => t && t.status === 'completed').length
          say(st, todos.length ? { kind: 'done', done, total: todos.length } : { kind: 'done' })
          settle(st, 'done', SETTLE_MS)
        } else if (kind === 'error' || kind === 'max-tokens' || kind === 'interrupted') {
          mark(st, 'failed', { label: '出错了' })
          say(st, { kind: 'failed' })
          settle(st, 'failed', SETTLE_MS)
        } else if (kind === 'blocked') {
          mark(st, 'waiting', { label: '等你点头' })
          say(st, { kind: 'waiting' })
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
    if (frame.chunk.type === 'reasoning-delta') mark(st, 'thinking', { label: '琢磨中' })
    else if (frame.chunk.type === 'text-delta') mark(st, 'review', { label: '写答复' })
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
      speech: (st && st.speech) || null,
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

function methodNotAllowed(allow = 'GET, HEAD') {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { allow },
  })
}

function notFound() {
  return new Response('Not Found', { status: 404 })
}

/** handler 路由用：写一段 JSON 响应。 */
function sendJson(res, body, head, status = 200) {
  const text = JSON.stringify(body)
  const payload = head ? '' : text
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** handler 路由用：读完整个请求体（设置 patch 很小，64KB 足够）。 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** 声明依赖：等 webServer 服务启动后再 apply，路由才能注册上。 */
export const name = 'dsh-shanhai-pet'
export const inject = ['webServer']

export function apply(ctx) {
  const tracker = createTracker()
  const clientReports = []
  let settings = Object.assign({}, DEFAULT_SETTINGS)
  let settingsWrites = Promise.resolve()
  readSettings()
    .then((loaded) => {
      settings = loaded
    })
    .catch(() => {})

  /* 当日陪伴：启动读盘，之后每次状态轮询推进并按需落盘。 */
  let companyPromise = readCompany()
  let persisted = { date: '', accumulatedMs: 0 }
  let companySave = Promise.resolve()

  function companyView(comp) {
    return {
      date: comp.date,
      firstSeenAt: comp.firstSeenAt,
      minutes: Math.floor(comp.accumulatedMs / 60000),
      days: comp.days || 1,
      milestone: comp.milestone || 0,
    }
  }

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
          const comp = tickCompany(await companyPromise, Date.now())
          companyPromise = Promise.resolve(comp)
          if (
            persisted.date !== comp.date ||
            comp.accumulatedMs - persisted.accumulatedMs >= COMPANY_PERSIST_EVERY
          ) {
            persisted = { date: comp.date, accumulatedMs: comp.accumulatedMs }
            companySave = companySave
              .then(() =>
                writeSettings(
                  {
                    date: comp.date,
                    firstSeenAt: comp.firstSeenAt,
                    accumulatedMs: comp.accumulatedMs,
                    metAt: comp.metAt,
                  },
                  companyFile(),
                ),
              )
              .catch(() => {})
          }
          return json(Object.assign(tracker.snapshot(), { settings, company: companyView(comp) }))
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
          if (!ASSET_FILE.test(rel)) return notFound()
          const ext = rel.slice(rel.lastIndexOf('.') + 1).toLowerCase()
          try {
            const buf = await readFile(path.join(ASSET_ROOT, rel))
            return new Response(buf, {
              headers: {
                'content-type': ASSET_TYPES[ext] || 'application/octet-stream',
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

    ctx.effect(() =>
      web.register({
        kind: 'exact',
        path: SETTINGS_PATH,
        /* 资源路由只放行 GET/HEAD，写设置得用原生的 handler 路由。 */
        handler: async (req, res) => {
          const method = String(req.method || 'GET').toUpperCase()
          if (method === 'GET' || method === 'HEAD') {
            sendJson(res, { ok: true, settings }, method === 'HEAD')
            return
          }
          if (method !== 'POST') {
            res.writeHead(405, { allow: 'GET, HEAD, POST' })
            res.end('Method Not Allowed')
            return
          }
          let body = null
          try {
            body = JSON.parse(await readBody(req))
          } catch {
            sendJson(res, { ok: false, error: 'invalid json' }, false, 400)
            return
          }
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            sendJson(res, { ok: false, error: 'invalid body' }, false, 400)
            return
          }
          const next = normalizeSettings(body, settings)
          /* 串行落盘：连续拖动滑块时后写覆盖前写，不会交错。 */
          settingsWrites = settingsWrites.then(() => writeSettings(next))
          let failed = null
          await settingsWrites.catch((err) => {
            failed = err
          })
          settingsWrites = Promise.resolve()
          if (failed) {
            sendJson(res, { ok: false, error: 'write failed: ' + String(failed && failed.message) }, false, 500)
            return
          }
          settings = next
          sendJson(res, { ok: true, settings }, false)
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
