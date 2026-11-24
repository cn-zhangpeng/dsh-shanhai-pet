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
const window = {
  __ModuleLoader__: { load: (mod) => { loaded = mod } },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  addEventListener() {},
  removeEventListener() {},
}
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
/* 捕获注册的 zh 字典，让 t() 真正出文案（原来只回 key，测不了台词渲染）。 */
let zhDict = null
const ctx = {
  effect: (fn) => {
    const off = fn()
    return typeof off === 'function' ? off : () => {}
  },
  locale: {
    register: (ns, dict) => {
      zhDict = (dict && dict.zh) || null
      return () => {}
    },
    bind: () => (key) => (zhDict && zhDict[key] !== undefined ? zhDict[key] : key),
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
const t = (key) => (zhDict && zhDict[key] !== undefined ? zhDict[key] : key)

assert.equal(registrations.length, 3, '浮层 / 设置页 / 导航图标各注册一次')

/* 设置导航图标：内联 SVG，按注册 id 匹配 */
const iconEntry = registrations.find(([options]) => options.name === 'settings.section.icon')
assert.ok(iconEntry, 'settings.section.icon 已注册')
assert.equal(iconEntry[0].id, 'shanhai-pet', '图标归属 shanhai-pet')
const iconVnode = typeof iconEntry[1] === 'function' ? iconEntry[1]({ size: 16 }) : null
assert.ok(iconVnode && iconVnode.type === 'svg', '图标渲染为内联 SVG')
assert.ok(zhDict && zhDict['speech.step'], 'locale 注册带台词模板')

/* 浮层 */
const overlay = registrations.find(([options]) => options.name === 'shell.overlay')
assert.ok(overlay, 'shell.overlay 已注册')
assert.equal(overlay[0].id, 'shanhai-pet')
assert.equal(overlay[0].order, 90)

const vnode = overlay[1]({})
const rendered = typeof vnode.type === 'function' ? vnode.type(vnode.props) : vnode
assert.equal(rendered.type, 'div')
assert.ok(rendered.children.length >= 2, '包含样式与浮层主体')

/* 小屏自适应：设置值只是上限，按视口收缩；只有头像区可点，其余穿透 */
assert.equal(typeof exported.fitPetSize, 'function', '导出 fitPetSize 供测试')
const ratio = 344 / 520
const desktop = exported.fitPetSize(250, ratio, { w: 1920, h: 1080 })
assert.equal(desktop.height, 250, '桌面保持用户设置高度')
assert.equal(desktop.width, Math.round(250 * ratio), '宽度按原图比例')
const phone = exported.fitPetSize(250, ratio, { w: 390, h: 844 })
assert.ok(phone.height < 250, '手机屏自动缩小')
assert.ok(phone.height <= Math.round((390 * 0.3) / ratio), '不超过视口宽度的 30%')
assert.ok(phone.height >= 96, '不缩到不可见')
assert.equal(phone.width, Math.round(phone.height * ratio), '缩小后仍按比例')
const landscape = exported.fitPetSize(250, ratio, { w: 844, h: 390 })
assert.ok(landscape.height <= Math.round(390 * 0.38), '横屏按高度封顶')
assert.equal(exported.fitPetSize(5000, ratio, { w: 1280, h: 800 }).height, Math.round(800 * 0.38), '超大设置也按视口收缩')
assert.equal(exported.fitPetSize(96, ratio, { w: 0, h: 0 }).height, 96, '未知视口保留设置值')

const css = rendered.children[0].props.dangerouslySetInnerHTML.__html
assert.ok(css.includes('.shp-hit{'), '存在头像点击区样式')
assert.ok(/\.shp-pet\{[^}]*pointer-events:none/.test(css), '立绘本体不拦截指针')
assert.ok(/\.shp-hit\{[^}]*pointer-events:auto/.test(css), '只有点击区接收指针')
const wrapVnode = rendered.children[1]
const petVnode = wrapVnode.children.find((child) => child && child.props && child.props.className === 'shp-pet')
assert.ok(petVnode, '渲染立绘节点')
assert.equal(petVnode.props.style.height, desktop.height + 'px', '立绘高度取自适应结果')
assert.equal(petVnode.props.style.width, desktop.width + 'px', '立绘宽度取自适应结果')
const hitVnode = petVnode.children.find((child) => child && child.props && child.props.className === 'shp-hit')
assert.ok(hitVnode, '立绘内带点击热区')
assert.equal(typeof hitVnode.props.onClick, 'function', '热区承载点击互动')
assert.equal(typeof hitVnode.props.onPointerDown, 'function', '热区支持拖动起手')
assert.equal(typeof hitVnode.props.onPointerMove, 'function', '热区支持拖动移动')
assert.equal(typeof hitVnode.props.onPointerUp, 'function', '热区支持拖动收尾')
assert.equal(typeof hitVnode.props.onContextMenu, 'function', '热区支持右键菜单')

/* 拖动落点：按「距右/距底」反向移动并夹在视口内 */
assert.equal(typeof exported.dragPosition, 'function', '导出 dragPosition 供测试')
const size = { width: 117, height: 177 }
const moved = exported.dragPosition(24, 14, -100, -50, size, { w: 390, h: 844 })
assert.deepEqual({ right: moved.right, bottom: moved.bottom }, { right: 124, bottom: 64 }, '向左上拖动增加右/底距')
const clamped = exported.dragPosition(10, 10, 500, 500, size, { w: 390, h: 844 })
assert.equal(clamped.right, 0, '拖出左边界夹到 0')
assert.equal(clamped.bottom, 0, '拖出下边界夹到 0')
const bounded = exported.dragPosition(10, 10, -900, -900, size, { w: 390, h: 844 })
assert.equal(bounded.right, 390 - 117, '拖出右边界夹到视口减立绘宽')
assert.equal(bounded.bottom, 844 - 177, '拖出上边界夹到视口减立绘高')
const unknownVp = exported.dragPosition(24, 14, -10, -10, size, { w: 0, h: 0 })
assert.deepEqual({ right: unknownVp.right, bottom: unknownVp.bottom }, { right: 34, bottom: 24 }, '视口未知时只做 0–4000 夹取')

/* 待机小动作：只挑帧清单里真实存在的轨道 */
assert.equal(exported.pickIdleAct(null), null, '没有帧清单不播')
assert.equal(exported.pickIdleAct({ frames2d: { tracks: { idle: {} } } }), null, '没有小动作轨道不播')
const actPool = new Set(exported.IDLE_ACTS)
for (let i = 0; i < 20; i++) {
  const act = exported.pickIdleAct({ frames2d: { tracks: { actWave: {}, actWalk: {} } } })
  assert.ok(act === 'actWave' || act === 'actWalk', '只从可用轨道里挑')
  assert.ok(actPool.has(act), '挑出的轨道在 IDLE_ACTS 白名单内')
}

/* 菜单 / 拖动 / 降低动效的样式都在 */
assert.ok(css.includes('.shp-menu{'), '存在右键菜单样式')
assert.ok(/\.shp-hit\{[^}]*touch-action:none/.test(css), '拖动时不触发页面滚动')
assert.ok(css.includes('.shp-dragging'), '拖动中样式存在')
assert.ok(css.includes('prefers-reduced-motion'), '尊重系统减少动态效果')

/* 拖动收尾：位移超过阈值后把新位置写回设置（POST /settings） */
const calls = []
sandbox.fetch = async (url, init) => {
  calls.push({ url: String(url), body: init && init.body ? String(init.body) : '' })
  return { ok: true, json: async () => ({ settings: {} }) }
}
const captureTarget = { setPointerCapture() {}, releasePointerCapture() {} }
hitVnode.props.onPointerDown({ button: 0, clientX: 200, clientY: 200, pointerId: 7, currentTarget: captureTarget })
hitVnode.props.onPointerMove({ clientX: 180, clientY: 170, pointerId: 7 })
hitVnode.props.onPointerUp({ clientX: 180, clientY: 170, pointerId: 7, currentTarget: captureTarget })
await new Promise((resolve) => setTimeout(resolve, 0))
const saved = calls.filter((call) => call.url.includes('/settings')).pop()
assert.ok(saved, '拖动结束后保存位置')
const patch = JSON.parse(saved.body)
assert.equal(patch.right, 44, '右距随拖动增加 20px')
assert.equal(patch.bottom, 44, '底距随拖动增加 30px')

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

/* 分组：外观 / 动作 / 互动 / 素材 四组 */
const groups = page.children.filter((child) => child && child.props && child.props.className === 'shp-s-group')
assert.equal(groups.length, 4, '外观/动作/互动/素材四组')
const lookRows = groups[0].children[1].children
assert.equal(lookRows[0].props.label, t('settings_company'), '外观组首行是今日陪伴')
const motionRows = groups[1].children[1].children
const actRow = motionRows.find((row) => row && row.props && row.props.label === t('settings_act'))
assert.ok(actRow, '动作组有待机小动作开关')
const actToggle = actRow.children.find((child) => child && child.type && child.type.name === 'Toggle')
assert.ok(actToggle && actToggle.props.checked === true, '待机小动作默认开')
const metaRows = groups[2].children[1].children
const narrateRow = metaRows.find((row) => row && row.props && row.props.label === t('settings_narrate'))
assert.ok(narrateRow, '互动组有进度播报开关')
const greetRow = metaRows.find((row) => row && row.props && row.props.label === t('settings_greet'))
assert.ok(greetRow, '互动组有闲时问候开关')
const assetRows = groups[3].children[1].children
assert.ok(assetRows.some((row) => row && row.props && row.props.label === t('settings_skin_upload')), '素材组有上传入口')
const narrateToggle = narrateRow.children.find((child) => child && child.type && child.type.name === 'Toggle')
assert.ok(narrateToggle, '进度播报行带 Toggle')
assert.equal(narrateToggle.props.checked, true, '进度播报默认开')

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

/* 进度播报台词：Host 发结构化数据，这里按 zh 字典渲染 */
assert.equal(
  exported.speechText(t, { kind: 'todo', state: 'step', n: 2, content: '写测试', done: 1, total: 3 }),
  '第 2 步：写测试',
  'step 台词带序号与内容',
)
assert.equal(exported.speechText(t, { kind: 'todo', state: 'plan', total: 3 }), '领了 3 件事，开工啦')
assert.equal(exported.speechText(t, { kind: 'todo', state: 'alldone', total: 3 }), '清单清空啦，一共 3 步')
assert.equal(exported.speechText(t, { kind: 'done' }), '这轮做完啦')
assert.equal(exported.speechText(t, { kind: 'failed' }), '哎呀，这轮碰壁了')
assert.equal(exported.speechText(t, { kind: 'waiting' }), '在等你点头呢')
assert.equal(exported.speechText(t, null), null, '空台词返回 null')
assert.equal(exported.speechText(t, { kind: 'nope' }), null, '未知 kind 返回 null')

assert.equal(exported.speechSub(t, { kind: 'todo', done: 1, total: 3 }), '已完成 1/3', 'step 副文案带进度')
assert.equal(exported.speechSub(t, { kind: 'done', done: 2, total: 5 }), '已完成 2/5')
assert.equal(exported.speechSub(t, { kind: 'failed' }), '', '失败台词没有副文案')
assert.equal(exported.speechSub(t, { kind: 'todo', state: 'step' }), '', '没有 total 不出副文案')

assert.equal(exported.toolLabel(t, { key: 'grind', label: '改文件' }), '改文件', '按 key 出双语 label')
assert.equal(exported.toolLabel(t, { label: '改文件' }), '改文件', '没有 key 回落 Host label')
assert.equal(exported.toolLabel(t, null), '', 'detail 为空返回空串')

/* 闲时问候：时段分桶 + 相识天数格式化 */
assert.equal(exported.greetingText(t, 7), '早上好呀', '清晨桶')
assert.equal(exported.greetingText(t, 12), '中午好', '中午桶')
assert.equal(exported.greetingText(t, 15), '下午好', '下午桶')
assert.equal(exported.greetingText(t, 20), '晚上好', '晚上桶')
assert.equal(exported.greetingText(t, 2), '夜深了，早点休息', '深夜桶')
const metAt = new Date(2026, 10, 20, 14, 30).getTime()
assert.equal(
  exported.greetingCompany(t, { firstSeenAt: metAt, minutes: 0, days: 5 }),
  '相遇第 5 天 · 今天 14:30 刚刚见面',
)
assert.equal(
  exported.greetingCompany(t, { firstSeenAt: metAt, minutes: 83, days: 100 }),
  '相遇第 100 天 · 今天已陪 1 小时 23 分钟',
)
assert.equal(
  exported.greetingCompany(t, { firstSeenAt: metAt, minutes: 45, days: 3 }),
  '相遇第 3 天 · 今天已陪 45 分钟',
)
assert.equal(exported.greetingCompany(t, null), '', '无 company 数据返回空串')
assert.equal(exported.greetingMilestone(t, 1), '初次见面，我是冉冉，请多关照！', '首日是初见台词')
assert.equal(exported.greetingMilestone(t, 100), '今天是我们相遇的第 100 天，谢谢你的陪伴！')

console.log('SMOKE_CLIENT_OK')
