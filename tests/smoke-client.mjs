/**
 * Client 半区烟测：用 vm 模拟浏览器模块加载器，验证工厂返回与浮层注册。
 * 跑法：node tests/smoke-client.mjs
 */
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let loaded = null
const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
}
const window = { __ModuleLoader__: { load: (mod) => { loaded = mod } } }
const sandbox = {
  window,
  document: { visibilityState: 'visible', addEventListener() {} },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true, phase: 'idle' }) }),
  console,
  setTimeout,
  clearTimeout,
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

assert.equal(registrations.length, 1)
const [options, component] = registrations[0]
assert.equal(options.name, 'shell.overlay')
assert.equal(options.id, 'shanhai-pet')
assert.equal(options.order, 90)

const vnode = component({})
const rendered = typeof vnode.type === 'function' ? vnode.type(vnode.props) : vnode
assert.equal(rendered.type, 'div')
assert.ok(rendered.children.length >= 2, '包含样式与浮层主体')
console.log('SMOKE_CLIENT_OK')
