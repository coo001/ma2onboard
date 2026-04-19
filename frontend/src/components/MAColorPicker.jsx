import { useEffect, useMemo, useRef, useState } from 'react'

const PREDEFINED_COLORS = [
  ['화이트', '#ffffff'],
  ['웜 화이트', '#ffe6b8'],
  ['쿨 화이트', '#d7edff'],
  ['레드', '#ff2d2d'],
  ['오렌지', '#ff7f11'],
  ['앰버', '#ffb100'],
  ['옐로우', '#ffe600'],
  ['라임', '#b7ff00'],
  ['그린', '#21d96b'],
  ['시안', '#00e0ff'],
  ['블루', '#246bff'],
  ['로열 블루', '#1837c8'],
  ['인디고', '#3d22b9'],
  ['퍼플', '#7d35ff'],
  ['마젠타', '#ff3cc7'],
  ['핑크', '#ff73b6'],
]

const styles = {
  shell: {
    border: '1px solid #4b4f63',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#10131b',
    boxShadow: '0 12px 30px rgba(0,0,0,.25)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#2f3346',
    borderBottom: '1px solid #4b4f63',
    fontSize: 12,
    color: '#d7daea',
    fontWeight: 700,
  },
  tabBar: {
    display: 'flex',
    gap: 6,
    padding: '10px 10px 0',
    background: '#171b27',
    flexWrap: 'wrap',
  },
  tab: (active) => ({
    padding: '8px 12px',
    borderRadius: '10px 10px 0 0',
    background: active ? '#10131b' : '#252a3b',
    border: '1px solid #4b4f63',
    borderBottomColor: active ? '#10131b' : '#4b4f63',
    color: active ? '#f2f4ff' : '#9fa6bf',
    fontSize: 12,
    fontWeight: 700,
  }),
  body: { padding: 16, background: '#10131b' },
  grid: { display: 'grid', gridTemplateColumns: '280px minmax(180px, 1fr)', gap: 18, alignItems: 'start' },
  padWrap: { display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' },
  hsbPad: {
    position: 'relative',
    width: 240,
    height: 180,
    borderRadius: 10,
    border: '1px solid #4b4f63',
    overflow: 'hidden',
    cursor: 'crosshair',
    background: 'red',
  },
  padOverlayWhite: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to right, #fff 0%, rgba(255,255,255,0) 100%)',
  },
  padOverlayBlack: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0) 100%)',
  },
  padDot: (x, y) => ({
    position: 'absolute',
    left: `calc(${x}% - 7px)`,
    top: `calc(${(1 - y) * 100}% - 7px)`,
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid #fff',
    boxShadow: '0 0 0 1px rgba(0,0,0,.45)',
    pointerEvents: 'none',
  }),
  hueWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  verticalSlider: {
    writingMode: 'vertical-lr',
    direction: 'rtl',
    width: 30,
    height: 180,
    accentColor: '#f0a500',
  },
  previewBox: (hex) => ({
    width: 108,
    minHeight: 180,
    borderRadius: 12,
    border: '1px solid #4b4f63',
    background: `linear-gradient(180deg, ${hex}, #0b0d12)`,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }),
  previewLabel: { fontSize: 11, color: '#cfd3e7' },
  previewValue: { fontSize: 12, fontWeight: 800, color: '#fff' },
  sidePanel: { display: 'grid', gap: 12 },
  meterRow: { display: 'grid', gridTemplateColumns: '60px 1fr 52px', gap: 10, alignItems: 'center' },
  meterLabel: { fontSize: 12, fontWeight: 800, color: '#cfd3e7' },
  meterInput: {
    textAlign: 'center',
    background: '#252a3b',
    border: '1px solid #4b4f63',
    color: '#fff',
    borderRadius: 8,
    padding: '6px 4px',
    fontWeight: 700,
  },
  slider: { width: '100%' },
  presetGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 10 },
  swatch: (hex, active) => ({
    borderRadius: 10,
    overflow: 'hidden',
    border: `2px solid ${active ? '#f0a500' : '#4b4f63'}`,
    background: '#161a25',
  }),
  swatchColor: (hex) => ({ height: 42, background: hex }),
  swatchLabel: { padding: '8px 8px 10px', fontSize: 11, color: '#d7daea', fontWeight: 700, textAlign: 'center' },
  footer: { marginTop: 14, fontSize: 12, color: '#8e95b0', lineHeight: 1.6 },
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function rgb100ToHex(r, g, b) {
  const toHex = (value) => Math.round((value / 100) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgb100(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [
    Math.round((r / 255) * 100),
    Math.round((g / 255) * 100),
    Math.round((b / 255) * 100),
  ]
}

function hsvToRgb100(h, s, v) {
  const sat = s / 100
  const val = v / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = val - c
  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (h < 60) [r1, g1, b1] = [c, x, 0]
  else if (h < 120) [r1, g1, b1] = [x, c, 0]
  else if (h < 180) [r1, g1, b1] = [0, c, x]
  else if (h < 240) [r1, g1, b1] = [0, x, c]
  else if (h < 300) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]

  return [
    Math.round((r1 + m) * 100),
    Math.round((g1 + m) * 100),
    Math.round((b1 + m) * 100),
  ]
}

function rgb100ToHsv(r, g, b) {
  const red = r / 100
  const green = g / 100
  const blue = b / 100
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2)
    else hue = 60 * (((red - green) / delta) + 4)
  }

  if (hue < 0) hue += 360
  const sat = max === 0 ? 0 : (delta / max) * 100
  const val = max * 100
  return [Math.round(hue), Math.round(sat), Math.round(val)]
}

export default function MAColorPicker({ rgb, onChange, disabled }) {
  const [page, setPage] = useState('HSB')
  const [hsv, setHsv] = useState(() => {
    const [r, g, b] = rgb
    return rgb100ToHsv(r, g, b)
  })
  const padRef = useRef(null)

  useEffect(() => {
    const [r, g, b] = rgb
    setHsv(rgb100ToHsv(r, g, b))
  }, [rgb[0], rgb[1], rgb[2]])

  const hex = useMemo(() => rgb100ToHex(...rgb), [rgb])
  const pages = ['HSB', 'Raw 채널', '색상 프리셋']

  function emitRgb(nextRgb) {
    onChange(nextRgb.map((value) => clamp(value)))
  }

  function applyHsv(nextHsv) {
    const safeHsv = [clamp(nextHsv[0], 0, 359), clamp(nextHsv[1]), clamp(nextHsv[2])]
    setHsv(safeHsv)
    emitRgb(hsvToRgb100(...safeHsv))
  }

  function updatePad(clientX, clientY) {
    const rect = padRef.current?.getBoundingClientRect()
    if (!rect) return
    const sat = clamp(Math.round(((clientX - rect.left) / rect.width) * 100))
    const val = clamp(Math.round((1 - (clientY - rect.top) / rect.height) * 100))
    applyHsv([hsv[0], sat, val])
  }

  return (
    <div style={styles.shell}>
      <div style={styles.topBar}>
        <span>색상 선택</span>
        <span>{page}</span>
      </div>

      <div style={styles.tabBar}>
        {pages.map((name) => (
          <button key={name} type="button" style={styles.tab(page === name)} onClick={() => setPage(name)} disabled={disabled}>
            {name}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        {page === 'HSB' && (
          <div style={styles.grid}>
            <div style={styles.padWrap}>
              <div
                ref={padRef}
                style={{ ...styles.hsbPad, background: `hsl(${hsv[0]}deg 100% 50%)`, opacity: disabled ? 0.5 : 1 }}
                onPointerDown={(event) => {
                  if (disabled) return
                  event.currentTarget.setPointerCapture(event.pointerId)
                  updatePad(event.clientX, event.clientY)
                }}
                onPointerMove={(event) => {
                  if (disabled || event.buttons !== 1) return
                  updatePad(event.clientX, event.clientY)
                }}
              >
                <div style={styles.padOverlayWhite} />
                <div style={styles.padOverlayBlack} />
                <div style={styles.padDot(hsv[1], hsv[2] / 100)} />
              </div>

              <div style={styles.hueWrap}>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={hsv[0]}
                  onChange={(event) => applyHsv([Number(event.target.value), hsv[1], hsv[2]])}
                  style={styles.verticalSlider}
                  disabled={disabled}
                />
              </div>

              <div style={styles.previewBox(hex)}>
                <div>
                  <div style={styles.previewLabel}>미리보기</div>
                  <div style={styles.previewValue}>{hex.toUpperCase()}</div>
                </div>
                <div>
                  <div style={styles.previewLabel}>HSB</div>
                  <div style={styles.previewValue}>{hsv[0]} / {hsv[1]} / {hsv[2]}</div>
                </div>
              </div>
            </div>

            <div style={styles.sidePanel}>
              {[
                ['Red', 0, '#ff5a5a'],
                ['Green', 1, '#5aff89'],
                ['Blue', 2, '#62a4ff'],
              ].map(([label, index, color]) => (
                <div key={label} style={styles.meterRow}>
                  <div style={{ ...styles.meterLabel, color }}>{label}</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={rgb[index]}
                    onChange={(event) => {
                      const next = [...rgb]
                      next[index] = Number(event.target.value)
                      emitRgb(next)
                    }}
                    style={styles.slider}
                    disabled={disabled}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rgb[index]}
                    onChange={(event) => {
                      const next = [...rgb]
                      next[index] = clamp(Number(event.target.value))
                      emitRgb(next)
                    }}
                    style={styles.meterInput}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'Raw 채널' && (
          <div style={styles.sidePanel}>
            {[
              ['ColorRGB1', 0, '#ff5a5a'],
              ['ColorRGB2', 1, '#5aff89'],
              ['ColorRGB3', 2, '#62a4ff'],
            ].map(([label, index, color]) => (
              <div key={label} style={styles.meterRow}>
                <div style={{ ...styles.meterLabel, color }}>{label}</div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={rgb[index]}
                  onChange={(event) => {
                    const next = [...rgb]
                    next[index] = Number(event.target.value)
                    emitRgb(next)
                  }}
                  style={styles.slider}
                  disabled={disabled}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rgb[index]}
                  onChange={(event) => {
                    const next = [...rgb]
                    next[index] = clamp(Number(event.target.value))
                    emitRgb(next)
                  }}
                  style={styles.meterInput}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        )}

        {page === '색상 프리셋' && (
          <div style={styles.presetGrid}>
            {PREDEFINED_COLORS.map(([label, presetHex]) => {
              const active = presetHex.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={label}
                  type="button"
                  style={styles.swatch(presetHex, active)}
                  onClick={() => emitRgb(hexToRgb100(presetHex))}
                  disabled={disabled}
                >
                  <div style={styles.swatchColor(presetHex)} />
                  <div style={styles.swatchLabel}>{label}</div>
                </button>
              )
            })}
          </div>
        )}

        <div style={styles.footer}>
          grandMA2 공식 Color Picker 문서의 구성에 맞춰 HSB, Raw Faders, Predefined Colors 중심으로 맞춘 웹 버전입니다.
        </div>
      </div>
    </div>
  )
}
