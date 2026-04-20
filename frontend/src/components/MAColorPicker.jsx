import { useEffect, useRef, useState } from 'react'

// ─── 색상 변환 함수 ────────────────────────────────────────────────────────
function hsvToRgb(h, s, v) {
  // h: 0-360, s: 0-100, v: 0-100 → { r, g, b } 0-255
  const sat = s / 100
  const val = v / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = val - c
  let r1 = 0, g1 = 0, b1 = 0

  if (h < 60)       [r1, g1, b1] = [c, x, 0]
  else if (h < 120) [r1, g1, b1] = [x, c, 0]
  else if (h < 180) [r1, g1, b1] = [0, c, x]
  else if (h < 240) [r1, g1, b1] = [0, x, c]
  else if (h < 300) [r1, g1, b1] = [x, 0, c]
  else              [r1, g1, b1] = [c, 0, x]

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

function rgbToHsv(r, g, b) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let h = 0

  if (delta !== 0) {
    if (max === red)        h = 60 * (((green - blue) / delta) % 6)
    else if (max === green) h = 60 * ((blue - red) / delta + 2)
    else                    h = 60 * ((red - green) / delta + 4)
  }
  if (h < 0) h += 360

  const s = max === 0 ? 0 : (delta / max) * 100
  const v = max * 100

  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
  }
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function MAColorPicker({ color, bright, q, onChange, onQChange }) {
  const initHsv = color ? rgbToHsv(color.r, color.g, color.b) : { h: 0, s: 100, v: 100 }

  const [hue, setHue] = useState(initHsv.h)
  const [sat, setSat] = useState(initHsv.s)

  const pickerRef = useRef(null)
  const qRef = useRef(null)
  const draggingRef = useRef(null) // 'picker' | 'q' | null

  // color prop 변경 시 내부 상태 동기화 (드래그 중 제외)
  useEffect(() => {
    if (draggingRef.current) return
    if (!color) return
    const hsv = rgbToHsv(color.r, color.g, color.b)
    setHue(hsv.h)
    setSat(hsv.s)
  }, [color?.r, color?.g, color?.b])

  function emitColor(h, s) {
    const rgb = hsvToRgb(h, s, bright ?? 100)
    onChange(rgb.r, rgb.g, rgb.b)
  }

  // ── 2D Hue+Sat picker ──
  function updatePicker(clientX, clientY) {
    const rect = pickerRef.current?.getBoundingClientRect()
    if (!rect) return
    const newHue = clamp(Math.round(((clientX - rect.left) / rect.width) * 360), 0, 360)
    const newSat = clamp(Math.round((1 - (clientY - rect.top) / rect.height) * 100))
    setHue(newHue)
    setSat(newSat)
    emitColor(newHue, newSat)
  }

  function onPickerPointerDown(e) {
    e.preventDefault()
    draggingRef.current = 'picker'
    pickerRef.current?.setPointerCapture(e.pointerId)
    updatePicker(e.clientX, e.clientY)
  }

  function onPickerPointerMove(e) {
    if (draggingRef.current !== 'picker') return
    updatePicker(e.clientX, e.clientY)
  }

  function onPickerPointerUp() { draggingRef.current = null }

  // ── Q 슬라이더 ──
  function updateQ(clientX) {
    const rect = qRef.current?.getBoundingClientRect()
    if (!rect) return
    const v = clamp(Math.round(((clientX - rect.left) / rect.width) * 100))
    onQChange?.(v)
  }

  function onQPointerDown(e) {
    e.preventDefault()
    draggingRef.current = 'q'
    qRef.current?.setPointerCapture(e.pointerId)
    updateQ(e.clientX)
  }

  function onQPointerMove(e) {
    if (draggingRef.current !== 'q') return
    updateQ(e.clientX)
  }

  function onQPointerUp() { draggingRef.current = null }

  // ── 현재 색상 (sat=100, val=100 기준의 순수 hue 색) ──
  const hueColor = `hsl(${hue}, 100%, 50%)`
  // Q 슬라이더: 어두운 배경 → 황금색
  const qGradient = 'linear-gradient(to right, #1a1d27, #f0a500)'

  // 2D picker 배경: hue 가로 스펙트럼 + 위로 갈수록 채도 높음
  const pickerBg = [
    'linear-gradient(to top, rgba(255,255,255,1), transparent)',
    'linear-gradient(to right, hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%), hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%), hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%), hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%), hsl(360,100%,50%))',
  ].join(', ')

  const qVal = q ?? 0

  const st = {
    wrapper: {
      background: '#1e1e1e',
      border: '1px solid #444',
      borderRadius: 10,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      userSelect: 'none',
    },
    pickerArea: {
      position: 'relative',
      width: '100%',
      height: 160,
      borderRadius: 6,
      border: '1px solid #444',
      background: pickerBg,
      cursor: 'crosshair',
      overflow: 'visible',
    },
    pickerHandle: {
      position: 'absolute',
      left: `${(hue / 360) * 100}%`,
      top: `${(1 - sat / 100) * 100}%`,
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '2px solid #fff',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      background: hueColor,
    },
    sliderRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    sliderLabel: {
      fontSize: '0.75rem',
      fontWeight: 700,
      color: '#7a7f9a',
      textTransform: 'uppercase',
      width: 40,
      flexShrink: 0,
    },
    sliderTrack: (gradient) => ({
      position: 'relative',
      flex: 1,
      height: 14,
      borderRadius: 7,
      background: gradient,
      border: '1px solid #444',
      cursor: 'pointer',
    }),
    sliderThumb: (pct, thumbColor) => ({
      position: 'absolute',
      top: '50%',
      left: `${pct}%`,
      transform: 'translate(-50%, -50%)',
      width: 18,
      height: 18,
      borderRadius: '50%',
      border: '2px solid #fff',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
      background: thumbColor,
      pointerEvents: 'none',
    }),
    sliderVal: {
      fontSize: '0.8rem',
      fontWeight: 800,
      color: '#f0a500',
      width: 32,
      textAlign: 'right',
      flexShrink: 0,
    },
  }

  return (
    <div style={st.wrapper}>
      {/* 2D Hue + Sat picker */}
      <div
        ref={pickerRef}
        style={st.pickerArea}
        onPointerDown={onPickerPointerDown}
        onPointerMove={onPickerPointerMove}
        onPointerUp={onPickerPointerUp}
        onPointerCancel={onPickerPointerUp}
      >
        <div style={st.pickerHandle} />
      </div>

      {/* Q 슬라이더 */}
      <div style={st.sliderRow}>
        <span style={st.sliderLabel}>Q</span>
        <div
          ref={qRef}
          style={st.sliderTrack(qGradient)}
          onPointerDown={onQPointerDown}
          onPointerMove={onQPointerMove}
          onPointerUp={onQPointerUp}
          onPointerCancel={onQPointerUp}
        >
          <div style={st.sliderThumb(qVal, `hsl(38, 100%, ${20 + qVal * 0.5}%)`)} />
        </div>
        <span style={st.sliderVal}>{qVal}</span>
      </div>
    </div>
  )
}
