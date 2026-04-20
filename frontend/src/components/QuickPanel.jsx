import { useState, useEffect } from 'react'
import { api } from '../api'

function rgb100ToHex(r, g, b) {
  const toHex = (v) => Math.round((v / 100) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const s = {
  panel: {
    background: '#13151f',
    borderBottom: '1px solid #2e334d',
    padding: '12px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#7a7f9a',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    minWidth: 60,
    flexShrink: 0,
  },
  fixtureChip: (active) => ({
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: `2px solid ${active ? '#f0a500' : '#2e334d'}`,
    background: active ? '#2a2000' : '#22263a',
    color: active ? '#f0a500' : '#7a7f9a',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  colorBtn: (hex, active) => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: hex,
    border: `3px solid ${active ? '#f0a500' : 'transparent'}`,
    outline: active ? '2px solid rgba(240,165,0,.4)' : '1px solid rgba(255,255,255,.1)',
    outlineOffset: 1,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform .1s',
  }),
  colorLabel: {
    fontSize: 10,
    color: '#7a7f9a',
    marginTop: 2,
    textAlign: 'center',
  },
  colorItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  sliderWrap: {
    flex: 1,
    minWidth: 120,
    maxWidth: 260,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: '#f0a500',
    cursor: 'pointer',
  },
  sliderVal: {
    fontSize: 13,
    fontWeight: 800,
    color: '#f0a500',
    minWidth: 34,
    textAlign: 'right',
  },
  clearBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    background: 'rgba(242,107,107,.15)',
    border: '1px solid rgba(242,107,107,.4)',
    color: '#f26b6b',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  toast: (ok) => ({
    fontSize: 12,
    color: ok ? '#3ddc84' : '#f26b6b',
    fontWeight: 600,
    marginLeft: 4,
  }),
  fixtureStatus: {
    fontSize: 12,
    color: '#a0a4bc',
    marginLeft: 6,
  },
  noFixture: {
    fontSize: 12,
    color: '#7a7f9a',
    fontStyle: 'italic',
  },
}

export default function QuickPanel({ fixtures, onFixturesChange }) {
  const [colorPresets, setColorPresets] = useState([])
  const [brightness, setBrightness] = useState(80)
  const [activeColor, setActiveColor] = useState(null)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    api.colorPresets().then((data) => {
      if (data.presets) setColorPresets(data.presets)
    })
  }, [])

  function setFb(message, ok) {
    setFeedback({ message, ok })
    setTimeout(() => setFeedback(null), 1800)
  }

  function toggleFixture(num) {
    const next = fixtures.includes(num)
      ? fixtures.filter((f) => f !== num)
      : [...fixtures, num].sort((a, b) => a - b)
    onFixturesChange(next)
  }

  async function applyToFixtures(fn) {
    if (fixtures.length === 0) {
      setFb('조명을 먼저 선택하세요.', false)
      return
    }
    setSending(true)
    await api.selectFixtures(fixtures)
    const result = await fn()
    setSending(false)
    setFb(result.ok === false ? result.error : '적용되었습니다.', result.ok !== false)
  }

  async function handleColorPreset(preset) {
    setActiveColor(preset.name)
    await applyToFixtures(() => api.intensityColor(brightness, preset.name, null))
  }

  async function handleBrightnessCommit() {
    setActiveColor(null)
    await applyToFixtures(() => api.intensityColor(brightness, null, null))
  }

  async function handleClearAll() {
    setSending(true)
    const result = await api.clear()
    setSending(false)
    setActiveColor(null)
    setFb(result.ok === false ? result.error : '전체 꺼짐.', result.ok !== false)
  }

  return (
    <div style={s.panel}>
      {/* 조명 선택 + 전체 끄기 */}
      <div style={s.row}>
        <span style={s.label}>조명</span>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
          <div
            key={num}
            style={s.fixtureChip(fixtures.includes(num))}
            onClick={() => toggleFixture(num)}
          >
            {num}
          </div>
        ))}
        {fixtures.length > 0 ? (
          <span style={s.fixtureStatus}>
            {fixtures.join(', ')}번 선택됨
          </span>
        ) : (
          <span style={s.noFixture}>선택 없음</span>
        )}
        <div style={{ flex: 1 }} />
        <button style={s.clearBtn} onClick={handleClearAll} disabled={sending}>
          전체 끄기
        </button>
        {feedback && (
          <span style={s.toast(feedback.ok)}>{feedback.message}</span>
        )}
      </div>

      {/* 밝기 슬라이더 */}
      <div style={s.row}>
        <span style={s.label}>밝기</span>
        <div style={s.sliderWrap}>
          <input
            type="range"
            min={0}
            max={100}
            value={brightness}
            style={s.slider}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onMouseUp={handleBrightnessCommit}
            onTouchEnd={handleBrightnessCommit}
          />
          <span style={s.sliderVal}>{brightness}%</span>
        </div>
      </div>

      {/* 색상 프리셋 */}
      <div style={s.row}>
        <span style={s.label}>색상</span>
        {colorPresets.length === 0 && (
          <span style={s.noFixture}>로딩 중...</span>
        )}
        {colorPresets.map((preset) => {
          const hex = rgb100ToHex(preset.rgb.r, preset.rgb.g, preset.rgb.b)
          const active = activeColor === preset.name
          return (
            <div key={preset.name} style={s.colorItem}>
              <button
                style={s.colorBtn(hex, active)}
                onClick={() => handleColorPreset(preset)}
                disabled={sending}
                title={preset.name}
              />
              <span style={s.colorLabel}>{preset.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
