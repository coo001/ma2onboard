import { useState } from 'react'
import { api } from '../api'
import MAColorPicker from './MAColorPicker'

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
  note: { fontSize: 12, color: '#7a7f9a', lineHeight: 1.7, marginTop: 12 },
}

const INTENSITY_PRESETS = [0, 25, 50, 75, 100]

function rgb100ToHex(r, g, b) {
  const toHex = (value) => Math.round((value / 100) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
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
    const result = await api.intensityColor(intensity, null, {
      r: nextRgb[0],
      g: nextRgb[1],
      b: nextRgb[2],
    })
    setSending((prev) => ({ ...prev, color: false }))
    setFb('color', result.ok === false ? result.error : '색 정보가 적용되었습니다.', result.ok !== false)
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

  return (
    <div style={styles.wrap}>
      <div style={styles.stepBadge}>2 / 4 단계</div>
      <div style={styles.title}>밝기와 색을 잡아보세요</div>
      <div style={styles.subtitle}>
        밝기는 빠르게 프리셋으로, 색은 grandMA2 느낌의 picker로 맞추도록 구성했습니다.
      </div>

      <div style={styles.guide}>
        <div style={styles.guideTitle}>이 단계에서 하는 일</div>
        먼저 밝기를 정하고, RGB 조명이라면 색도 함께 맞춥니다. 색 변화가 없는 장비라면 밝기만 정한 뒤 다음 단계로 넘어가면 됩니다.
      </div>

      <div style={styles.topActions}>
        <button className="btn btn-secondary" onClick={onBack}>
          이전
        </button>
        <button className="btn btn-primary" onClick={handleNext}>
          다음
        </button>
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
            onChange={(event) => setIntensityInput(event.target.value)}
            onBlur={handleIntensityBlur}
            onKeyDown={(event) => event.key === 'Enter' && handleIntensityBlur()}
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
          official grandMA2 Color Picker 문서의 구성을 참고해 HSB, Raw Faders, Predefined Colors 중심으로 맞춘 picker입니다.
        </div>

        <div style={styles.toggleRow}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={useColor} onChange={(event) => setUseColor(event.target.checked)} />
            색 설정 사용
          </label>
        </div>

        {useColor && <MAColorPicker rgb={rgb} onChange={sendColor} disabled={sending.color} />}

        {feedback.color && (
          <div style={{ ...styles.note, color: feedback.color.ok ? '#3ddc84' : '#f26b6b' }}>
            {feedback.color.message}
          </div>
        )}

        <div style={styles.note}>
          참고: 공식 grandMA2 Color Picker는 HSB, Swatch Book, Raw Faders, Predefined Colors, Faders 뷰를 제공합니다.
        </div>
      </div>
    </div>
  )
}
