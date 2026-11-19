/**
 * 离线预览：把设置页组件渲染成静态 HTML，用浏览器截一张图看看排版。
 * 跑法：node tests/preview-settings.mjs → 输出 tests/out/settings-preview.html
 *
 * 只是本地视觉自检，不参与运行时；主题 token 用近似的深色值兜底。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = path.dirname(fileURLToPath(import.meta.url))
const code = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')

/* ---- 迷你 React：单次渲染，hooks 只取初值 ---- */
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  Fragment: 'fragment',
}

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const ATTR = { className: 'class', htmlFor: 'for', readOnly: 'readonly', tabIndex: 'tabindex' }
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link'])

function render(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return escape(node)
  if (Array.isArray(node)) return node.map(render).join('')
  if (typeof node.type === 'function') return render(node.type(Object.assign({}, node.props, { children: node.children })))
  if (node.type === 'fragment') return node.children.map(render).join('')

  const tag = String(node.type)
  const props = node.props || {}
  if (props.dangerouslySetInnerHTML) {
    return `<${tag}>${props.dangerouslySetInnerHTML.__html}</${tag}>`
  }
  const attrs = []
  for (const [rawKey, value] of Object.entries(props)) {
    if (rawKey === 'children' || value === undefined || value === null || value === false) continue
    if (typeof value === 'function' || rawKey === 'dangerouslySetInnerHTML') continue
    const key = ATTR[rawKey] || rawKey
    if (rawKey === 'style' && typeof value === 'object') {
      const css = Object.entries(value)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
        .join(';')
      attrs.push(`style="${escape(css)}"`)
      continue
    }
    if (value === true) {
      attrs.push(key)
      continue
    }
    attrs.push(`${key}="${escape(value)}"`)
  }
  const open = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`
  if (VOID.has(tag)) return open
  return `${open}${node.children.map(render).join('')}</${tag}>`
}

/* ---- 在 vm 里加载插件模块 ---- */
let loaded = null
let dicts = null
const sandbox = {
  window: { __ModuleLoader__: { load: (mod) => { loaded = mod } } },
  document: { visibilityState: 'visible', addEventListener() {} },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
  Image: class {
    constructor() {
      this.src = ''
    }
    decode() {
      return Promise.resolve()
    }
  },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
}
vm.createContext(sandbox)
vm.runInContext(code, sandbox)

const exported = loaded.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})

const registrations = []
const ctx = {
  effect: (fn) => {
    const off = fn()
    return typeof off === 'function' ? off : () => {}
  },
  locale: {
    register: (_ns, table) => {
      dicts = table
      return () => {}
    },
    bind: () => (key) => (dicts && dicts.zh && dicts.zh[key]) || key,
  },
  slots: {
    inject: (_name, callback) => callback(),
    register: (options, component) => {
      registrations.push([options, component])
      return () => {}
    },
  },
}
exported.apply(ctx)

const settings = registrations.find(([options]) => options.name === 'settings.section')
const page = render(settings[1]({}))

const tokens = `
  --dsw-alias-bg-base: #131316;
  --dsw-alias-bg-layer-1: #1b1b20;
  --dsw-alias-bg-layer-2: #24242b;
  --dsw-alias-bg-overlay: rgba(10, 10, 12, 0.86);
  --dsw-alias-border-l1: #2b2b33;
  --dsw-alias-border-l2: #3a3a44;
  --dsw-alias-brand-primary: #5b78f6;
  --dsw-alias-label-primary: #ededf0;
  --dsw-alias-label-secondary: #a3a3ae;
  --dsw-alias-state-error-primary: #ff6b6b;
  --dsw-alias-state-success-primary: #3ecf8e;
  --dsw-alias-state-warn-primary: #f5b942;
  --dsw-alias-state-idle-primary: #6b6b78;
`

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>山海灵宠 · 设置页预览</title>
<style>
  :root { ${tokens} }
  html, body { margin: 0; padding: 0; background: var(--dsw-alias-bg-base); }
  body {
    font-family: 'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif;
    color: var(--dsw-alias-label-primary);
    padding: 28px 32px 40px;
  }
  .preview-shell { max-width: 720px; }
  .preview-tab { font-size: 13px; color: var(--dsw-alias-label-secondary); margin-bottom: 16px; }
</style>
</head>
<body>
  <div class="preview-shell">
    <div class="preview-tab">设置 · 山海灵宠</div>
    ${page}
  </div>
</body>
</html>`

const out = path.join(here, 'out')
fs.mkdirSync(out, { recursive: true })
const file = path.join(out, 'settings-preview.html')
fs.writeFileSync(file, html, 'utf8')
console.log('PREVIEW_OK ' + file)
