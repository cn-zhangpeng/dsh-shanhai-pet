/**
 * Client 半区烟测：用 vm 模拟浏览器模块加载器，验证工厂返回、
 * 浮层注册（shell.overlay）与设置页注册（settings.section）。
 * 跑法：node tests/smoke-client.mjs
 */
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let loaded = null
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
}
const window = { __ModuleLoader__: { load: (mod) => { loaded = mod } } }
const sandbox = {
  window,
  document: { visibilityState: 'visible', addEventListener() {} },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true, phase: 'idle' }) }),
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

assert.ok(loaded, 'ModuleLoader 收到插件')
assert.equal(loaded.id, 'dsh-shanhai-pet')
const exported = loaded.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})
assert.equal(Array.from(exported.inject).join(','), 'slots,locale')

const registrations = []
const ctx = {
  effect: (fn) => {
    const off = fn()
    return typeof off === 'function' ? off : () => {}
  },
  locale: {
    register: () => () => {},
    bind: () => (key) => key,
  },
  slots: {
    inject: (name, callback) => callback(),
    register: (options, component) => {
      registrations.push([options, component])
      return () => {}
    },
  },
}
exported.apply(ctx)

assert.equal(registrations.length, 2, '浮层与设置页各注册一次')

/* 浮层 */
const overlay = registrations.find(([options]) => options.name === 'shell.overlay')
assert.ok(overlay, 'shell.overlay 已注册')
assert.equal(overlay[0].id, 'shanhai-pet')
assert.equal(overlay[0].order, 90)

const vnode = overlay[1]({})
const rendered = typeof vnode.type === 'function' ? vnode.type(vnode.props) : vnode
assert.equal(rendered.type, 'div')
assert.ok(rendered.children.length >= 2, '包含样式与浮层主体')

/* 设置页 */
const settingsSection = registrations.find(([options]) => options.name === 'settings.section')
assert.ok(settingsSection, 'settings.section 已注册')
assert.equal(settingsSection[0].id, 'shanhai-pet')
assert.ok(typeof settingsSection[0].order === 'number', '设置页有排序位')
assert.equal(typeof settingsSection[0].label, 'function')

const pageVnode = settingsSection[1]({})
const page = typeof pageVnode.type === 'function' ? pageVnode.type(pageVnode.props) : pageVnode
assert.equal(page.type, 'div')
assert.equal(page.props.className, 'shp-s', '设置页根节点使用 .shp-s')
assert.ok(page.children.some((child) => child && child.type === 'h2'), '设置页有标题')

/* 设置页里应能切开关：找到按钮型 switch 的渲染分支 */
const card = page.children.find((child) => child && child.props && child.props.className === 'shp-s-group')
assert.ok(card, '设置页有分组卡片')
const rows = card.children[1].children
assert.ok(rows.length >= 4, '外观分组至少有 4 行')
const firstRow = rows[0]
assert.equal(firstRow.type.name, 'Row')
assert.ok(firstRow.children.length >= 1, '行内带控件')

/* 动画文件命名约定：anim/<轨道名，冒号换成连字符>.webp */
assert.equal(typeof exported.animUrlFor, 'function', '导出 animUrlFor 供测试')
const animManifest = {
  frames2d: {
    tracks: {
      idle: { frames: ['breathopen', 'breath'] },
      closed: { frames: ['breathopen'] },
      'tool:ink': { frames: ['grindink', 'grindink2'] },
    },
  },
}
assert.equal(exported.animUrlFor(animManifest, 'idle', true), '/api/shanhai-pet/assets/anim/idle.webp')
assert.equal(exported.animUrlFor(animManifest, 'idle', false), null, '关掉眨眼就停在睁眼帧')
assert.equal(exported.animUrlFor(animManifest, 'closed', true), null, '单帧轨道没有动画')
assert.equal(exported.animUrlFor(animManifest, 'tool:ink', true), '/api/shanhai-pet/assets/anim/tool-ink.webp')
assert.equal(exported.animUrlFor(animManifest, 'nope', true), null, '未知轨道不拼路径')

/* 候选链：webp 优先，gif 兜底 */
const candidates = exported.animUrlsFor(animManifest, 'idle', true)
assert.equal(candidates.length, 2, 'webp + gif 两个候选')
assert.equal(candidates[1], '/api/shanhai-pet/assets/anim/idle.gif')
assert.deepEqual(Array.from(exported.animUrlsFor(animManifest, 'closed', true)), [], '单帧轨道没有候选')

console.log('SMOKE_CLIENT_OK')
