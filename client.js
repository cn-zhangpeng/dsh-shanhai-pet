/**
 * 山海灵宠 · Client 半区
 *
 * 在 shell.overlay（全帧浮层、可点击穿透层）里注册一张逐帧灵宠立绘，
 * 轮询 Host 的 /api/shanhai-pet/state，按相位播放 pet.json 里的帧轨道。
 * 不接触会话内容：只消费 Host 投影后的 phase / detail。
 *
 * 另外在 settings.section 注册「山海灵宠」设置页：大小、位置、眨眼、
 * 浮动、气泡、点击互动，改动即时生效并写回 Host 的 settings.json。
 */
window.__ModuleLoader__.load({
  id: 'dsh-shanhai-pet',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement

    const NS = 'shanhai'
    const STATE_URL = '/api/shanhai-pet/state'
    const MANIFEST_URL = '/api/shanhai-pet/pet.json'
    const SETTINGS_URL = '/api/shanhai-pet/settings'
    const ASSET_BASE = '/api/shanhai-pet/assets/'
    const REPORT_URL = '/api/shanhai-pet/client-report'
    const POLL_MS = 900

    /* 诊断上报（模块工厂一加载就发一次，确认新代码是否真的进了页面）。 */
    function reportToHost(payload) {
      try {
        const body = encodeURIComponent(
          JSON.stringify(Object.assign({ t: Date.now(), version: 'anim-1' }, payload)),
        )
        fetch(REPORT_URL + '?d=' + body, { cache: 'no-store' }).catch(() => {})
      } catch (err) {
        /* ignore */
      }
    }
    reportToHost({ step: 'factory' })

    const zh = {
      overlay_label: '山海灵宠',
      settings_title: '山海灵宠',
      settings_desc: '她不读你的对话，只跟着会话状态换姿势。下面的设置在保存后立刻生效。',
      settings_group_look: '外观',
      settings_group_motion: '动作',
      settings_group_meta: '互动',
      settings_visible: '显示灵宠',
      settings_visible_hint: '关掉后整个浮层隐藏，随时可以在这里再打开。',
      settings_height: '立绘高度',
      settings_height_hint: '像素；宽度按原图比例自动换算。',
      settings_right: '距右边缘',
      settings_right_hint: '像素；同时决定气泡的贴边位置。',
      settings_bottom: '距底部',
      settings_bottom_hint: '像素；从窗口底边往上量。',
      settings_blink: '眨眼',
      settings_blink_hint: '坐忘时偶尔闭一下眼（原生动画播放，不闪）；关掉就一直是睁眼帧。',
      settings_float: '呼吸浮动',
      settings_float_hint: '坐忘时轻微上下起伏。',
      settings_bubble: '状态气泡',
      settings_bubble_hint: '非坐忘时在头顶显示当前相位。',
      settings_poke: '点击互动',
      settings_poke_hint: '点她一下会换姿势并说一句话。',
      settings_reset: '恢复默认',
      settings_ready: '设置会即时生效并自动保存',
      settings_saving: '保存中…',
      settings_saved: '已保存',
      settings_error: '保存失败：',
      'phase.idle': '坐忘',
      'phase.listening': '竖耳',
      'phase.thinking': '看云',
      'phase.tool': '行法',
      'phase.review': '展卷',
      'phase.done': '点灯',
      'phase.failed': '抱尾',
      'phase.waiting': '歪头',
      poke1: '她眨了眨眼。',
      poke2: '她在听山风。',
      poke3: '她把尾巴蜷了蜷。',
      poke4: '她望向你，又望回屏幕。',
    }

    const en = {
      overlay_label: 'Shanhai Spirit Pet',
      settings_title: 'Shanhai Spirit Pet',
      settings_desc:
        'She never reads your conversation, only the session state. Changes below apply once saved.',
      settings_group_look: 'Appearance',
      settings_group_motion: 'Motion',
      settings_group_meta: 'Interaction',
      settings_visible: 'Show the pet',
      settings_visible_hint: 'Turn off to hide the overlay entirely.',
      settings_height: 'Sprite height',
      settings_height_hint: 'Pixels; the width follows the source aspect ratio.',
      settings_right: 'Right inset',
      settings_right_hint: 'Pixels from the right edge of the window.',
      settings_bottom: 'Bottom inset',
      settings_bottom_hint: 'Pixels measured up from the bottom edge of the window.',
      settings_blink: 'Blinking',
      settings_blink_hint: 'She closes her eyes now and then. Plays as a native animation, no flicker.',
      settings_float: 'Breathing motion',
      settings_float_hint: 'A slow up-and-down drift while idle.',
      settings_bubble: 'Status bubble',
      settings_bubble_hint: 'Show the current phase above her while busy.',
      settings_poke: 'Click to interact',
      settings_poke_hint: 'Clicking her swaps the pose and says a line.',
      settings_reset: 'Restore defaults',
      settings_ready: 'Changes apply instantly and save automatically',
      settings_saving: 'Saving…',
      settings_saved: 'Saved',
      settings_error: 'Save failed: ',
      'phase.idle': 'Sitting still',
      'phase.listening': 'Ears up',
      'phase.thinking': 'Watching clouds',
      'phase.tool': 'Casting',
      'phase.review': 'Unrolling scroll',
      'phase.done': 'Lighting the lantern',
      'phase.failed': 'Hugging tail',
      'phase.waiting': 'Head tilt',
      poke1: 'She blinks at you.',
      poke2: 'She is listening to the mountain wind.',
      poke3: 'She curls her tail.',
      poke4: 'She looks at you, then back at the screen.',
    }

    const CSS = [
      /* ---- 浮层 ---- */
      '.shp-root{position:fixed;right:24px;bottom:14px;z-index:2147483000;pointer-events:none;',
      'user-select:none;-webkit-user-select:none;font-family:inherit}',
      '.shp-wrap{position:relative;display:flex;flex-direction:column;align-items:flex-end}',
      '.shp-pet{pointer-events:auto;cursor:pointer;transition:transform .25s ease;',
      'filter:drop-shadow(0 8px 14px rgba(0,0,0,.18))}',
      '.shp-pet:hover{transform:translateY(-2px)}',
      '.shp-root.shp-static .shp-pet{cursor:default}',
      '.shp-root.shp-static .shp-pet:hover{transform:none}',
      '.shp-img{height:250px;width:165px;display:block;transform-origin:50% 100%}',
      '.shp-root.shp-float.shp-idle .shp-img{animation:shp-float 5.2s ease-in-out infinite}',
      '.shp-bubble{position:absolute;right:12px;bottom:calc(100% + 4px);max-width:200px;background:#fffdf6;',
      'border:1.5px solid #5d5449;border-radius:10px 10px 2px 10px;padding:6px 10px;color:#4a4038;',
      'font-size:12px;line-height:1.35;box-shadow:0 4px 14px rgba(0,0,0,.12);pointer-events:none;',
      'animation:shp-in .25s ease}',
      '.shp-bubble:after{content:"";position:absolute;right:14px;bottom:-6px;width:10px;height:10px;',
      'background:#fffdf6;border-right:1.5px solid #5d5449;border-bottom:1.5px solid #5d5449;',
      'transform:rotate(45deg)}',
      '.shp-bubble-t{font-weight:600}',
      '.shp-bubble-s{margin-top:2px;color:#8a7f74;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}',
      '@keyframes shp-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
      '@keyframes shp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
      '.shp-failed .shp-img{filter:grayscale(.35) brightness(.92) drop-shadow(0 8px 14px rgba(0,0,0,.18))}',
      '.shp-waiting .shp-img{animation:shp-tilt 2.6s ease-in-out infinite}',
      '.shp-fallback{font-size:11px;line-height:1.4;color:#a8917c;max-width:180px;word-break:break-all}',
      '@keyframes shp-tilt{0%,100%{transform:rotate(0)}50%{transform:rotate(-2deg)}}',
      /* ---- 设置页 ---- */
      '.shp-s{display:flex;flex-direction:column;gap:14px;padding:2px 2px 28px;font-family:inherit;',
      'color:var(--dsw-alias-label-primary)}',
      '.shp-s-title{margin:0;font-size:15px;font-weight:600}',
      '.shp-s-desc{margin:0;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary)}',
      '.shp-s-group{display:flex;flex-direction:column;gap:6px}',
      '.shp-s-group-t{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.shp-s-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;',
      'background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.shp-s-row{display:flex;align-items:center;gap:14px;padding:10px 14px;',
      'border-top:1px solid var(--dsw-alias-border-l1)}',
      '.shp-s-row:first-child{border-top:0}',
      '.shp-s-main{flex:1;min-width:0}',
      '.shp-s-label{font-size:13px;line-height:1.5}',
      '.shp-s-hint{margin-top:2px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.shp-s-sw{position:relative;flex:none;width:38px;height:22px;padding:0;border-radius:999px;',
      'border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;',
      'transition:background-color .15s ease,border-color .15s ease}',
      '.shp-s-sw:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.shp-s-sw[aria-checked="true"]{background:var(--dsw-alias-brand-primary);',
      'border-color:var(--dsw-alias-brand-primary)}',
      '.shp-s-sw > span{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;',
      'background:#fff;transition:transform .15s ease}',
      '.shp-s-sw[aria-checked="true"] > span{transform:translateX(16px)}',
      '.shp-s-slider{display:flex;flex:0 1 320px;min-width:180px;align-items:center;gap:10px}',
      '.shp-s-range{flex:1;min-width:120px;width:auto;accent-color:var(--dsw-alias-brand-primary);',
      'cursor:pointer}',
      '.shp-s-val{min-width:56px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;',
      'color:var(--dsw-alias-label-secondary)}',
      '.shp-s-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;',
      'color:var(--dsw-alias-label-secondary)}',
      '.shp-s-foot.shp-s-err{color:var(--dsw-alias-state-error-primary)}',
      '.shp-s-btn{margin-left:auto;padding:5px 12px;border-radius:8px;font-family:inherit;font-size:12px;',
      'cursor:pointer;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);',
      'border:1px solid var(--dsw-alias-border-l2)}',
      '.shp-s-btn:hover{background:var(--dsw-alias-bg-layer-1)}',
    ].join('')

    /* ---------- 设置：本地 store + Host 持久化 ---------- */

    /** 与 Host 的 DEFAULT_SETTINGS 字段一一对应。 */
    const DEFAULT_SETTINGS = {
      visible: true,
      height: 250,
      right: 24,
      bottom: 14,
      blink: true,
      float: true,
      bubble: true,
      poke: true,
    }

    const LIMITS = {
      height: [96, 640],
      right: [0, 4000],
      bottom: [0, 4000],
    }

    function clampValue(value, fallback, key) {
      const range = LIMITS[key]
      const num = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(num)) return fallback
      return Math.min(range[1], Math.max(range[0], Math.round(num)))
    }

    function normalizeSettings(input, base) {
      const src = input && typeof input === 'object' ? input : {}
      const seed = base || DEFAULT_SETTINGS
      const bool = (key) => (typeof src[key] === 'boolean' ? src[key] : seed[key])
      return {
        visible: bool('visible'),
        height: clampValue(src.height, seed.height, 'height'),
        right: clampValue(src.right, seed.right, 'right'),
        bottom: clampValue(src.bottom, seed.bottom, 'bottom'),
        blink: bool('blink'),
        float: bool('float'),
        bubble: bool('bubble'),
        poke: bool('poke'),
      }
    }

    /** 模块级单向 store：设置页写入，浮层与页面一起订阅。 */
    const settingsStore = { value: DEFAULT_SETTINGS, listeners: new Set() }

    /* 404 过的动画地址（webp 缺失回落到 gif 时用），模块级存活到页面刷新。 */
    const brokenAnims = new Set()

    function sameSettings(a, b) {
      if (!a || !b) return false
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (a[key] !== b[key]) return false
      }
      return true
    }

    function publishSettings(next) {
      const normalized = normalizeSettings(next, DEFAULT_SETTINGS)
      if (sameSettings(settingsStore.value, normalized)) return
      settingsStore.value = normalized
      settingsStore.listeners.forEach((listener) => {
        try {
          listener(normalized)
        } catch (err) {
          /* 单个订阅者出错不影响其它订阅者 */
        }
      })
    }

    function subscribeSettings(listener) {
      settingsStore.listeners.add(listener)
      return () => settingsStore.listeners.delete(listener)
    }

    function useSettings() {
      const [value, setValue] = React.useState(settingsStore.value)
      React.useEffect(() => {
        setValue(settingsStore.value)
        return subscribeSettings(setValue)
      }, [])
      return value
    }

    function fetchSettings() {
      return fetch(SETTINGS_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data && data.settings ? data.settings : null))
        .catch(() => null)
    }

    function saveSettings(patch) {
      const next = Object.assign({}, settingsStore.value, patch)
      publishSettings(next) /* 先乐观应用，滑块拖动时不卡顿 */
      return fetch(SETTINGS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(patch),
      })
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status)
          return res.json()
        })
        .then((data) => {
          if (data && data.settings) publishSettings(data.settings)
          return { ok: true }
        })
        .catch((err) => ({ ok: false, error: String((err && err.message) || err) }))
    }

    /* 相位 + 工具族 → 轨道名；工具族轨道（tool:ink 等）优先。 */
    function pickTrack(manifest, phase, detail) {
      const frames2d = manifest.frames2d || {}
      const phases = frames2d.phases || {}
      const tracks = frames2d.tracks || {}
      const family = detail && detail.family ? 'tool:' + detail.family : ''
      if (family && tracks[family]) return family
      for (const key of [phase, 'idle']) {
        if (key && phases[key] && tracks[phases[key]]) return phases[key]
      }
      return Object.keys(tracks)[0] || 'idle'
    }

    /**
     * 多帧轨道 → 烘焙好的循环动画候选（webp 优先，gif 兜底）。
     * 交给浏览器原生播放：没有 JS 换帧，也就没有换帧时的空白帧。
     * 一张图播不出动作：单帧轨道和"关掉眨眼"的 idle 都返回空数组。
     */
    function animUrlsFor(manifest, trackName, blink) {
      if (!manifest || !trackName) return []
      if (trackName === 'idle' && !blink) return []
      const frames2d = manifest.frames2d || {}
      const track = (frames2d.tracks || {})[trackName]
      if (!track || !Array.isArray(track.frames) || track.frames.length < 2) return []
      const dir = frames2d.animDir || 'anim/'
      const stem = ASSET_BASE + dir + trackName.replace(/:/g, '-')
      return [stem + '.webp', stem + '.gif']
    }

    /** 首选动画地址（webp）；没有可播的轨道返回 null。 */
    function animUrlFor(manifest, trackName, blink) {
      return animUrlsFor(manifest, trackName, blink)[0] || null
    }

    /**
     * 帧播放器：动画接管时（still）只钉住首帧当兜底，不跑定时器；
     * 否则按轨道 durations 推进，播完回落 fallback 或停在末帧。
     * idle 轨永远只取首帧 —— 眨眼已经烘进 webp 动画里了。
     */
    function usePlayer(manifest, trackName, still) {
      const [frame, setFrame] = React.useState(null)
      React.useEffect(() => {
        if (!manifest || !trackName) return
        const frames2d = manifest.frames2d || {}
        const tracks = frames2d.tracks || {}
        const base = tracks[trackName]
        if (!base || !Array.isArray(base.frames) || base.frames.length === 0) return
        if (still || trackName === 'idle') {
          setFrame(base.frames[0])
          return
        }
        let disposed = false
        let timer = 0

        function run(frames, durations, looped, next) {
          if (!frames || frames.length === 0) return
          let index = 0
          const step = () => {
            if (disposed) return
            setFrame(frames[index])
            const dur = durations[index] || 200
            timer = window.setTimeout(() => {
              if (disposed) return
              index += 1
              if (index >= frames.length) {
                if (looped) {
                  index = 0
                } else if (next && tracks[next]) {
                  const fallbackTrack = tracks[next]
                  run(fallbackTrack.frames, fallbackTrack.durations || [], Boolean(fallbackTrack.loop), fallbackTrack.fallback)
                  return
                } else {
                  index = frames.length - 1
                  return
                }
              }
              step()
            }, dur)
          }
          step()
        }

        run(base.frames.slice(), (base.durations || []).slice(), Boolean(base.loop), base.fallback)

        return () => {
          disposed = true
          window.clearTimeout(timer)
        }
      }, [manifest, trackName, still])
      return frame
    }

    /* ---------- 设置页控件 ---------- */

    function Toggle(props) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label || undefined,
          className: 'shp-s-sw',
          onClick: () => props.onChange(!props.checked),
        },
        h('span', null),
      )
    }

    function Slider(props) {
      return h(
        'div',
        { className: 'shp-s-slider' },
        h('input', {
          type: 'range',
          className: 'shp-s-range',
          min: props.min,
          max: props.max,
          step: props.step || 1,
          value: props.value,
          'aria-label': props.label || undefined,
          onChange: (event) => props.onChange(Number(event.target.value)),
        }),
        h('span', { className: 'shp-s-val' }, props.value + (props.unit || '')),
      )
    }

    function Row(props) {
      return h(
        'div',
        { className: 'shp-s-row' },
        h(
          'div',
          { className: 'shp-s-main' },
          h('div', { className: 'shp-s-label' }, props.label),
          props.hint ? h('div', { className: 'shp-s-hint' }, props.hint) : null,
        ),
        props.children,
      )
    }

    function PetSettings(props) {
      const t = props.t
      const settings = useSettings()
      const [status, setStatus] = React.useState('idle')
      const [error, setError] = React.useState('')
      const pending = React.useRef(null)
      const debounce = React.useRef(0)
      const idleTimer = React.useRef(0)
      const alive = React.useRef(true)

      React.useEffect(() => {
        let mounted = true
        fetchSettings().then((loaded) => {
          if (mounted && loaded) publishSettings(loaded)
        })
        return () => {
          mounted = false
          alive.current = false
          window.clearTimeout(debounce.current)
          window.clearTimeout(idleTimer.current)
          /* 关页面时把还没落盘的改动补一次，避免拖动后立刻关掉就丢了 */
          if (pending.current) {
            const tail = pending.current
            pending.current = null
            saveSettings(tail)
          }
        }
      }, [])

      const commit = (patch) => {
        publishSettings(Object.assign({}, settingsStore.value, patch))
        pending.current = Object.assign({}, pending.current || {}, patch)
        setStatus('saving')
        setError('')
        window.clearTimeout(debounce.current)
        debounce.current = window.setTimeout(() => {
          const body = pending.current
          pending.current = null
          if (!body) return
          saveSettings(body).then((result) => {
            if (!alive.current) return
            if (result.ok) {
              setStatus('saved')
              window.clearTimeout(idleTimer.current)
              idleTimer.current = window.setTimeout(() => {
                if (alive.current) setStatus('idle')
              }, 1600)
            } else {
              setStatus('error')
              setError(result.error || '')
            }
          })
        }, 260)
      }

      const statusText =
        status === 'saving' ? t('settings_saving') : status === 'saved' ? t('settings_saved') : t('settings_ready')

      return h(
        'div',
        { className: 'shp-s' },
        h('style', { key: 'css', dangerouslySetInnerHTML: { __html: CSS } }),
        h('h2', { className: 'shp-s-title' }, t('settings_title')),
        h('p', { className: 'shp-s-desc' }, t('settings_desc')),
        h(
          'div',
          { className: 'shp-s-group' },
          h('div', { className: 'shp-s-group-t' }, t('settings_group_look')),
          h(
            'div',
            { className: 'shp-s-card' },
            h(
              Row,
              { label: t('settings_visible'), hint: t('settings_visible_hint') },
              h(Toggle, {
                checked: settings.visible,
                label: t('settings_visible'),
                onChange: (value) => commit({ visible: value }),
              }),
            ),
            h(
              Row,
              { label: t('settings_height'), hint: t('settings_height_hint') },
              h(Slider, {
                min: LIMITS.height[0],
                max: LIMITS.height[1],
                step: 2,
                value: settings.height,
                unit: 'px',
                label: t('settings_height'),
                onChange: (value) => commit({ height: value }),
              }),
            ),
            h(
              Row,
              { label: t('settings_right'), hint: t('settings_right_hint') },
              h(Slider, {
                min: LIMITS.right[0],
                max: 400,
                step: 2,
                value: settings.right,
                unit: 'px',
                label: t('settings_right'),
                onChange: (value) => commit({ right: value }),
              }),
            ),
            h(
              Row,
              { label: t('settings_bottom'), hint: t('settings_bottom_hint') },
              h(Slider, {
                min: LIMITS.bottom[0],
                max: 400,
                step: 2,
                value: settings.bottom,
                unit: 'px',
                label: t('settings_bottom'),
                onChange: (value) => commit({ bottom: value }),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'shp-s-group' },
          h('div', { className: 'shp-s-group-t' }, t('settings_group_motion')),
          h(
            'div',
            { className: 'shp-s-card' },
            h(
              Row,
              { label: t('settings_blink'), hint: t('settings_blink_hint') },
              h(Toggle, {
                checked: settings.blink,
                label: t('settings_blink'),
                onChange: (value) => commit({ blink: value }),
              }),
            ),
            h(
              Row,
              { label: t('settings_float'), hint: t('settings_float_hint') },
              h(Toggle, {
                checked: settings.float,
                label: t('settings_float'),
                onChange: (value) => commit({ float: value }),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'shp-s-group' },
          h('div', { className: 'shp-s-group-t' }, t('settings_group_meta')),
          h(
            'div',
            { className: 'shp-s-card' },
            h(
              Row,
              { label: t('settings_bubble'), hint: t('settings_bubble_hint') },
              h(Toggle, {
                checked: settings.bubble,
                label: t('settings_bubble'),
                onChange: (value) => commit({ bubble: value }),
              }),
            ),
            h(
              Row,
              { label: t('settings_poke'), hint: t('settings_poke_hint') },
              h(Toggle, {
                checked: settings.poke,
                label: t('settings_poke'),
                onChange: (value) => commit({ poke: value }),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'shp-s-foot' + (status === 'error' ? ' shp-s-err' : '') },
          h('span', null, status === 'error' ? t('settings_error') + error : statusText),
          h(
            'button',
            {
              type: 'button',
              className: 'shp-s-btn',
              onClick: () => commit(Object.assign({}, DEFAULT_SETTINGS)),
            },
            t('settings_reset'),
          ),
        ),
      )
    }

    function Overlay(props) {
      const t = props.t
      const settings = useSettings()
      const [state, setState] = React.useState(null)
      const [manifest, setManifest] = React.useState(null)
      const [poke, setPoke] = React.useState(null)
      const [pokeTrack, setPokeTrack] = React.useState(null)
      const [debug, setDebug] = React.useState('')
      const [, bumpAnim] = React.useState(0)
      const pokeTimer = React.useRef(0)

      /* 诊断上报：宿主的资源路由只收 GET，所以用 query 上报。 */
      const report = React.useRef((payload) => reportToHost(payload)).current

      React.useEffect(() => {
        report({ step: 'mount' })
        fetchSettings().then((loaded) => {
          if (loaded) publishSettings(loaded)
        })
        const onError = (event) => {
          report({ step: 'error', message: String(event && event.message ? event.message : event) })
        }
        const onRej = (event) => {
          report({ step: 'rejection', message: String(event && event.reason ? event.reason : event) })
        }
        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onRej)
        return () => {
          window.removeEventListener('error', onError)
          window.removeEventListener('unhandledrejection', onRej)
        }
      }, [report])

      /* 拉状态（顺带同步设置，多窗口改设置能跟着变） */
      React.useEffect(() => {
        let alive = true
        const poll = () => {
          if (document.visibilityState !== 'visible') return
          fetch(STATE_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
              if (!alive || !json || typeof json !== 'object') return
              setState(json)
              if (json.settings) publishSettings(json.settings)
            })
            .catch(() => {})
        }
        poll()
        const timer = window.setInterval(poll, POLL_MS)
        const onVisibility = () => {
          if (document.visibilityState === 'visible') poll()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          alive = false
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisibility)
          window.clearTimeout(pokeTimer.current)
        }
      }, [])

      /* 拉帧清单并预载全部帧；启动时 Host 路由可能晚于页面就绪，失败后重试 */
      React.useEffect(() => {
        let alive = true
        let timer = 0
        let tries = 0

        const load = () => {
          if (!alive) return
          tries += 1
          fetch(MANIFEST_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
            .then((res) => {
              report({ step: 'manifest-http', status: res.status, ok: res.ok })
              if (!res.ok) {
                setDebug('manifest http ' + res.status)
                return null
              }
              return res.json().catch((err) => {
                report({ step: 'manifest-json-error', message: String(err) })
                setDebug('manifest json error')
                return null
              })
            })
            .then((data) => {
              if (!alive) return
              if (!data || !data.frames2d) {
                setDebug('manifest has no frames2d')
                report({ step: 'manifest-shape', keys: data ? Object.keys(data) : null })
                if (tries < 20) timer = window.setTimeout(load, 1000)
                return
              }
              setManifest(data)
              setDebug('')
              report({
                step: 'manifest-ok',
                tracks: Object.keys(data.frames2d.tracks || {}).length,
                framesDir: data.frames2d.framesDir || 'frames/',
              })
              const frames2d = data.frames2d
              const names = new Set()
              Object.keys(frames2d.tracks || {}).forEach((name) => {
                const track = frames2d.tracks[name]
                ;(track.frames || []).forEach((frame) => names.add(frame))
              })
              /* 预载 + 解码：换帧时不再出现空帧闪烁 */
              names.forEach((name) => {
                const img = new Image()
                img.onerror = () => {
                  report({ step: 'img-error', src: img.src })
                  setDebug('img failed: ' + name)
                }
                img.onload = () => {
                  report({ step: 'img-ok', name })
                  if (typeof img.decode === 'function') img.decode().catch(() => {})
                }
                img.src = ASSET_BASE + (frames2d.framesDir || 'frames/') + name + '.png'
              })
              /* 多帧轨道顺带预热动画文件；缺失时静默（渲染会回落到静态首帧）。 */
              Object.keys(frames2d.tracks || {}).forEach((name) => {
                const track = frames2d.tracks[name]
                if (!track || !Array.isArray(track.frames) || track.frames.length < 2) return
                const src = ASSET_BASE + 'anim/' + name.replace(/:/g, '-') + '.webp'
                const img = new Image()
                img.onerror = () => report({ step: 'anim-missing', src })
                img.src = src
              })
            })
            .catch((err) => {
              setDebug('manifest fetch failed')
              report({ step: 'manifest-fetch-error', message: String(err) })
              if (tries < 20) timer = window.setTimeout(load, 1000)
            })
        }

        load()
        return () => {
          alive = false
          window.clearTimeout(timer)
        }
      }, [])

      const phase = state && state.phase ? String(state.phase) : 'idle'
      const detail = state && state.detail ? state.detail : null
      const trackName = manifest ? pickTrack(manifest, phase, detail) : null
      const shownTrack =
        pokeTrack && manifest && manifest.frames2d && manifest.frames2d.tracks[pokeTrack] ? pokeTrack : trackName
      /* 播放失败过的动画地址记在这里，避免每次重渲染都去撞同一个 404。 */
      const animUrl =
        animUrlsFor(manifest, shownTrack, settings.blink).filter((url) => !brokenAnims.has(url))[0] || null
      const frame = usePlayer(manifest, shownTrack, Boolean(animUrl))
      const phaseLabel = t('phase.' + phase)

      /* 只在"该有立绘却没有"时上报一次，定位是没渲染还是被挤出视口。 */
      const petRef = React.useRef(null)
      React.useEffect(() => {
        if (frame || animUrl || !manifest) return
        const el = petRef.current
        if (!el) return
        const img = el.querySelector('img')
        const r = el.getBoundingClientRect()
        const cx = r.x + r.width / 2
        const cy = r.y + r.height / 2
        const hit = document.elementFromPoint(cx, cy)
        report({
          step: 'render-empty',
          phase,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          img: img
            ? { src: img.src, nw: img.naturalWidth, nh: img.naturalHeight, complete: img.complete }
            : null,
          hit: hit ? (hit === img ? 'img' : hit.tagName + '.' + String(hit.className || '').slice(0, 40)) : null,
          vw: window.innerWidth,
          vh: window.innerHeight,
          dpr: window.devicePixelRatio,
        })
      }, [manifest, frame, phase, report])

      const pokeLines = [t('poke1'), t('poke2'), t('poke3'), t('poke4')]
      const onPoke = () => {
        const idx = Math.floor(Math.random() * pokeLines.length)
        setPoke(pokeLines[idx])
        setPokeTrack('poke' + (idx + 1))
        window.clearTimeout(pokeTimer.current)
        pokeTimer.current = window.setTimeout(() => {
          setPoke(null)
          setPokeTrack(null)
        }, 3600)
      }

      const showBubble = settings.bubble && (Boolean(poke) || phase !== 'idle')
      const bubbleText = poke || (detail && detail.label) || phaseLabel
      const bubbleSub = debug || (!poke && detail && detail.hint ? detail.hint : '')
      const frames2d = (manifest && manifest.frames2d) || {}
      const frameDir = frames2d.framesDir || 'frames/'
      const aspect =
        frames2d.height > 0 ? (frames2d.width || 344) / frames2d.height : 344 / 520

      if (!settings.visible) return null

      return h(
        'div',
        {
          className:
            'shp-root shp-' + phase + (settings.float ? ' shp-float' : '') + (settings.poke ? '' : ' shp-static'),
          style: { right: settings.right + 'px', bottom: settings.bottom + 'px' },
        },
        h('style', { key: 'css', dangerouslySetInnerHTML: { __html: CSS } }),
        h(
          'div',
          { className: 'shp-wrap' },
          showBubble
            ? h(
                'div',
                { key: 'bubble', className: 'shp-bubble' },
                h('div', { className: 'shp-bubble-t' }, bubbleText),
                bubbleSub ? h('div', { className: 'shp-bubble-s' }, bubbleSub) : null,
              )
            : null,
          h(
            'div',
            {
              key: 'pet',
              ref: petRef,
              className: 'shp-pet',
              onClick: settings.poke ? onPoke : undefined,
              title: t('overlay_label'),
            },
            animUrl
              ? h('img', {
                  key: 'anim',
                  className: 'shp-img',
                  src: animUrl,
                  alt: '',
                  draggable: false,
                  decoding: 'sync',
                  onLoad: () => report({ step: 'anim-ok', src: animUrl }),
                  onError: () => {
                    report({ step: 'anim-error', src: animUrl })
                    brokenAnims.add(animUrl)
                    bumpAnim((n) => n + 1)
                  },
                  style: { height: settings.height + 'px', width: Math.round(settings.height * aspect) + 'px' },
                })
              : frame
                ? h('img', {
                    key: 'frame',
                    className: 'shp-img',
                    src: ASSET_BASE + frameDir + frame + '.png',
                    alt: '',
                    draggable: false,
                    decoding: 'sync',
                    style: { height: settings.height + 'px', width: Math.round(settings.height * aspect) + 'px' },
                  })
                : debug
                  ? h('div', { className: 'shp-fallback' }, debug)
                  : null,
          ),
        ),
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }))
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'shanhai-pet',
            order: 90,
            label: () => t('overlay_label'),
          },
          (slotProps) => h(Overlay, Object.assign({}, slotProps, { t })),
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'shanhai-pet',
            order: 45,
            label: () => t('settings_title'),
          },
          () => h(PetSettings, { t }),
        ),
      )
    }

    module.exports = { inject: ['slots', 'locale'], apply, animUrlFor, animUrlsFor }
    return module.exports
  },
})
