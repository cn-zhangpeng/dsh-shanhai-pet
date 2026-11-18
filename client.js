/**
 * 山海灵宠 · Client 半区
 *
 * 在 shell.overlay（全帧浮层、可点击穿透层）里注册一张逐帧灵宠立绘，
 * 轮询 Host 的 /api/shanhai-pet/state，按相位播放 pet.json 里的帧轨道。
 * 不接触会话内容：只消费 Host 投影后的 phase / detail。
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
    const ASSET_BASE = '/api/shanhai-pet/assets/'
    const REPORT_URL = '/api/shanhai-pet/client-report'
    const POLL_MS = 900

    /* 诊断上报（模块工厂一加载就发一次，确认新代码是否真的进了页面）。 */
    function reportToHost(payload) {
      try {
        const body = encodeURIComponent(
          JSON.stringify(Object.assign({ t: Date.now(), version: 'frames-5' }, payload)),
        )
        fetch(REPORT_URL + '?d=' + body, { cache: 'no-store' }).catch(() => {})
      } catch (err) {
        /* ignore */
      }
    }
    reportToHost({ step: 'factory' })

    const zh = {
      overlay_label: '山海灵宠',
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
      '.shp-root{position:fixed;right:24px;bottom:14px;z-index:2147483000;pointer-events:none;',
      'user-select:none;-webkit-user-select:none;font-family:inherit}',
      '.shp-wrap{position:relative;display:flex;flex-direction:column;align-items:flex-end}',
      '.shp-pet{pointer-events:auto;cursor:pointer;transition:transform .25s ease;',
      'filter:drop-shadow(0 8px 14px rgba(0,0,0,.18))}',
      '.shp-pet:hover{transform:translateY(-2px)}',
      '.shp-img{height:250px;width:165px;display:block;transform-origin:50% 100%}',
      '.shp-idle .shp-img{animation:shp-float 5.2s ease-in-out infinite}',
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
    ].join('')

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

    /* 帧播放器：按轨道 durations 推进，播完回落 fallback 或停在末帧。 */
    function usePlayer(manifest, trackName) {
      const [frame, setFrame] = React.useState(null)
      React.useEffect(() => {
        if (!manifest || !trackName) return
        const frames2d = manifest.frames2d || {}
        const tracks = frames2d.tracks || {}
        let disposed = false
        let timer = 0

        function play(name) {
          const track = tracks[name]
          if (!track || !track.frames || !track.frames.length) return
          let index = 0
          const step = () => {
            if (disposed) return
            setFrame(track.frames[index])
            const dur = (track.durations && track.durations[index]) || 200
            timer = window.setTimeout(() => {
              if (disposed) return
              index += 1
              if (index >= track.frames.length) {
                if (track.loop) index = 0
                else if (track.fallback && tracks[track.fallback]) {
                  play(track.fallback)
                  return
                } else {
                  index = track.frames.length - 1
                  return
                }
              }
              step()
            }, dur)
          }
          step()
        }

        play(trackName)
        return () => {
          disposed = true
          window.clearTimeout(timer)
        }
      }, [manifest, trackName])
      return frame
    }

    function Overlay(props) {
      const t = props.t
      const [state, setState] = React.useState(null)
      const [manifest, setManifest] = React.useState(null)
      const [poke, setPoke] = React.useState(null)
      const [pokeTrack, setPokeTrack] = React.useState(null)
      const [debug, setDebug] = React.useState('')
      const pokeTimer = React.useRef(0)

      /* 诊断上报：宿主的资源路由只收 GET，所以用 query 上报。 */
      const report = React.useRef((payload) => reportToHost(payload)).current

      React.useEffect(() => {
        report({ step: 'mount' })
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

      /* 拉状态 */
      React.useEffect(() => {
        let alive = true
        const poll = () => {
          if (document.visibilityState !== 'visible') return
          fetch(STATE_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
              if (alive && json && typeof json === 'object') setState(json)
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

      /* 拉帧清单并预载全部帧 */
      React.useEffect(() => {
        let alive = true
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
            names.forEach((name) => {
              const img = new Image()
              img.onerror = () => {
                report({ step: 'img-error', src: img.src })
                setDebug('img failed: ' + name)
              }
              img.onload = () => report({ step: 'img-ok', name })
              img.src = ASSET_BASE + (frames2d.framesDir || 'frames/') + name + '.png'
            })
          })
          .catch((err) => {
            setDebug('manifest fetch failed')
            report({ step: 'manifest-fetch-error', message: String(err) })
          })
        return () => {
          alive = false
        }
      }, [])

      const phase = state && state.phase ? String(state.phase) : 'idle'
      const detail = state && state.detail ? state.detail : null
      const trackName = manifest ? pickTrack(manifest, phase, detail) : null
      const shownTrack = pokeTrack && manifest && manifest.frames2d && manifest.frames2d.tracks[pokeTrack]
        ? pokeTrack
        : trackName
      const frame = usePlayer(manifest, shownTrack)
      const phaseLabel = t('phase.' + phase)

      /* 只在"该有立绘却没有"时上报一次，定位是没渲染还是被挤出视口。 */
      const petRef = React.useRef(null)
      React.useEffect(() => {
        if (frame) return
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
      }, [frame, phase, report])

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

      const showBubble = Boolean(poke) || phase !== 'idle'
      const bubbleText = poke || (detail && detail.label) || phaseLabel
      const bubbleSub = debug || (!poke && detail && detail.hint ? detail.hint : '')
      const frameDir = manifest && manifest.frames2d ? manifest.frames2d.framesDir || 'frames/' : 'frames/'

      return h(
        'div',
        { className: 'shp-root shp-' + phase },
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
            { key: 'pet', ref: petRef, className: 'shp-pet', onClick: onPoke, title: t('overlay_label') },
            frame
              ? h('img', {
                  key: frame,
                  className: 'shp-img',
                  src: ASSET_BASE + frameDir + frame + '.png',
                  alt: '',
                  draggable: false,
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
    }

    module.exports = { inject: ['slots', 'locale'], apply }
    return module.exports
  },
})
