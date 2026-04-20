import { useState } from 'react'
import { api } from '../api'

const STAGE_COLORS = [
  { name: '화이트',   rgb: [100, 100, 100] },
  { name: '웜화이트', rgb: [100, 78, 38] },
  { name: '쿨화이트', rgb: [85, 95, 100] },
  { name: '레드',     rgb: [100, 0, 0] },
  { name: '오렌지',   rgb: [100, 38, 0] },
  { name: '앰버',     rgb: [100, 55, 0] },
  { name: '옐로우',   rgb: [100, 100, 0] },
  { name: '라임',     rgb: [40, 100, 0] },
  { name: '그린',     rgb: [0, 100, 0] },
  { name: '시안',     rgb: [0, 100, 100] },
  { name: '블루',     rgb: [0, 0, 100] },
  { name: '로열블루', rgb: [0, 20, 100] },
  { name: '퍼플',     rgb: [60, 0, 100] },
  { name: '마젠타',   rgb: [100, 0, 100] },
]

const INTENSITY_PRESETS = [0, 25, 50, 75, 100]

function rgb100ToHex(r, g, b) {
  const toHex = (v) => Math.round((v / 100) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function isSameRgb(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

const styles = {
  wrap: { padding: '32px 40px' },
  stepBadge: {
    display: 'inline-block',
    background: '#f0a500',
    color: '#000',
    fontWeight: 800,
    fontSize: 12,
    padding: '2px 10px',
    borderRadius: 20,
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 900, marginBottom: 8 },
  subtitle: { color: '#a0a4bc', marginBottom: 24, lineHeight: 1.7 },
  guide: {
    background: '#142019',
    border: '1px solid #294133',
    borderRadius: 12,
    padding: '16px 18px',
    marginBottom: 16,
    color: '#b4d9c0',
    lineHeight: 1.7,
  },
  guideTitle: { color: '#3ddc84', fontWeight: 800, marginBottom: 6 },
  topActions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
  context: { fontSize: 14, color: '#a0a4bc', marginBottom: 24 },
  contextStrong: { color: '#f0a500', fontWeight: 800 },
  section: {
    marginBottom: 28,
    background: '#1a1d27',
    borderRadius: 14,
    padding: '20px 24px',
    border: '1px solid #2e334d',
  },
  sectionTitle: { fontSize: 18, fontWeight: 800, marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: '#7a7f9a', lineHeight: 1.7, marginBottom: 16 },
  intensityRow: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  numInput: {
    width: 88,
    fontSize: 30,
    fontWeight: 900,
    textAlign: 'center',
    color: '#f0a500',
    background: '#22263a',
    border: '2px solid #f0a500',
    borderRadius: 10,
    padding: '6px 0',
  },
  pct: { fontSize: 20, color: '#7a7f9a' },
  presetRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  presetBtn: (active) => ({
    padding: '7px 14px',
    borderRadius: 8,
    border: `1px solid ${active ? '#f0a500' : '#2e334d'}`,
    background: active ? '#2a2000' : '#22263a',
    color: active ? '#f0a500' : '#d9dbe7',
    fontWeight: 700,
  }),
  feedback: { fontSize: 12 },
  toggleRow: { marginBottom: 14 },
  colorGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorBtn: (hex, active) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    padding: '10px 12px',
    borderRadius: 10,
    border: `2px solid ${active ? '#f0a500' : '#2e334d'}`,
    background: active ? '#2a2000' : '#22263a',
    cursor: 'pointer',
    minWidth: 68,
    boxShadow: active ? '0 0 0 2px rgba(240,165,0,.2)' : 'none',
  }),
  colorSwatch: (hex) => ({
    width: 28,
    height: 28,
    borderRadius: 6,
    background: hex,
    border: '1px solid rgba(255,255,255,.12)',
  }),
  colorName: (active) => ({
    fontSize: 11,
    fontWeight: 700,
    color: active ? '#f0a500' : '#a0a4bc',
    whiteSpace: 'nowrap',
  }),
  selectedColor: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    fontSize: 13,
    color: '#a0a4bc',
  },
  note: { fontSize: 12, color: '#7a7f9a', lineHeight: 1.7, marginTop: 12 },
}

export default function Step2IntensityColor({ data, onNext, onBack }) {
  const [intensity, setIntensity] = useState(80)
  const [intensityInput, setIntensityInput] = useState('80')
  const [rgb, setRgb] = useState([100, 100, 100])
  const [useColor, setUseColor] = useState(true)
  const [sending, setSending] = useState({ intensity: false, color: false })
  const [feedback, setFeedback] = useState({ intensity: null, color: null })

  function setFb(key, message, ok) {
    setFeedback((prev) => ({ ...prev, [key]: { message, ok } }))
    setTimeout(() => {
      setFeedback((prev) => ({ ...prev, [key]: null }))
    }, 1800)
  }

  async function sendIntensity(value) {
    setSending((prev) => ({ ...prev, intensity: true }))
    const result = await api.intensityColor(value, null, null)
    setSending((prev) => ({ ...prev, intensity: false }))
    setFb('intensity', result.ok === false ? result.error : '콘솔에 적용되었습니다.', result.ok !== false)
  }

  async function sendColor(nextRgb) {
    if (!useColor) return
    setRgb(nextRgb)
    setSending((prev) => ({ ...prev, color: true }))
    const result = await api.intensityColor(intensity, null, { r: nextRgb[0], g: nextRgb[1], b: nextRgb[2] })
    setSending((prev) => ({ ...prev, color: false }))
    setFb('color', result.ok === false ? result.error : '색이 적용되었습니다.', result.ok !== false)
  }

  function handleIntensityBlur() {
    const value = Math.max(0, Math.min(100, parseInt(intensityInput, 10) || 0))
    setIntensity(value)
    setIntensityInput(String(value))
    sendIntensity(value)
  }

  function handlePresetIntensity(value) {
    setIntensity(value)
    setIntensityInput(String(value))
    sendIntensity(value)
  }

  function handleNext() {
    onNext({
      intensity,
      colorHex: useColor ? rgb100ToHex(...rgb) : null,
      colorRgb: useColor ? rgb : null,
    })
  }

  const activeColor = STAGE_COLORS.find((c) => isSameRgb(c.rgb, rgb))

  return (
    <div style={styles.wrap}>
      <div style={styles.stepBadge}>2 / 4 단계</div>
      <div style={styles.title}>밝기와 색을 잡아보세요</div>
      <div style={styles.subtitle}>
        밝기는 프리셋으로, 색은 무대 조명에서 자주 쓰는 색 버튼으로 빠르게 맞출 수 있습니다.
      </div>

      <div style={styles.guide}>
        <div style={styles.guideTitle}>이 단계에서 하는 일</div>
        먼저 밝기를 정하고, RGB 조명이라면 색도 함께 맞춥니다. 색 변화가 없는 장비라면 밝기만 정한 뒤 다음 단계로 넘어가면 됩니다.
      </div>

      <div style={styles.topActions}>
        <button className="btn btn-secondary" onClick={onBack}>이전</button>
        <button className="btn btn-primary" onClick={handleNext}>다음</button>
      </div>

      <div style={styles.context}>
        현재 선택된 조명: <span style={styles.contextStrong}>{data.fixtures?.join(', ')}번</span>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>밝기</div>
        <div style={styles.sectionDesc}>
          0은 꺼짐, 100은 최대 밝기입니다. 숫자를 직접 입력하거나 프리셋 버튼으로 빠르게 맞출 수 있습니다.
        </div>

        <div style={styles.intensityRow}>
          <input
            style={styles.numInput}
            type="number"
            min={0}
            max={100}
            value={intensityInput}
            onChange={(e) => setIntensityInput(e.target.value)}
            onBlur={handleIntensityBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleIntensityBlur()}
          />
          <span style={styles.pct}>%</span>
          {sending.intensity && <span style={{ color: '#7a7f9a', fontSize: 13 }}>전송 중...</span>}
          {feedback.intensity && (
            <span style={{ ...styles.feedback, color: feedback.intensity.ok ? '#3ddc84' : '#f26b6b' }}>
              {feedback.intensity.message}
            </span>
          )}
        </div>

        <div style={styles.presetRow}>
          {INTENSITY_PRESETS.map((value) => (
            <button key={value} style={styles.presetBtn(intensity === value)} onClick={() => handlePresetIntensity(value)}>
              {value}%{value === 0 ? ' (꺼짐)' : value === 100 ? ' (최대)' : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>색</div>
        <div style={styles.sectionDesc}>
          무대 조명에서 자주 쓰는 색을 버튼으로 빠르게 선택하세요.
        </div>

        <div style={styles.toggleRow}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
            색 설정 사용
          </label>
        </div>

        {useColor && (
          <>
            <div style={styles.colorGrid}>
              {STAGE_COLORS.map((color) => {
                const hex = rgb100ToHex(...color.rgb)
                const active = isSameRgb(color.rgb, rgb)
                return (
                  <button
                    key={color.name}
                    style={styles.colorBtn(hex, active)}
                    onClick={() => sendColor(color.rgb)}
                    disabled={sending.color}
                  >
                    <div style={styles.colorSwatch(hex)} />
                    <span style={styles.colorName(active)}>{color.name}</span>
                  </button>
                )
              })}
            </div>

            <div style={styles.selectedColor}>
              {activeColor ? (
                <>
                  <div style={{ ...styles.colorSwatch(rgb100ToHex(...rgb)), width: 18, height: 18 }} />
                  <span>선택된 색: <strong style={{ color: '#f0a500' }}>{activeColor.name}</strong></span>
                </>
              ) : (
                <span style={{ color: '#7a7f9a' }}>색을 선택하세요</span>
              )}
              {sending.color && <span style={{ color: '#7a7f9a', fontSize: 12 }}>전송 중...</span>}
              {feedback.color && (
                <span style={{ fontSize: 12, color: feedback.color.ok ? '#3ddc84' : '#f26b6b' }}>
                  {feedback.color.message}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
