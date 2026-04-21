import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import MAColorPicker from './MAColorPicker'

// 0-255 RGB → 0-100 스케일 변환 (백엔드 API 규격)
function rgb255To100(r, g, b) {
  return {
    r: Math.round((r / 255) * 100),
    g: Math.round((g / 255) * 100),
    b: Math.round((b / 255) * 100),
  }
}

const s = {
  panel: {
    background: '#13151f',
    borderRight: '1px solid #2e334d',
    padding: '12px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: 1,
    minWidth: 0,
    height: '100%',
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    color: '#7a7f9a',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    minWidth: 60,
    flexShrink: 0,
  },
  fixtureChip: (active) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: `2px solid ${active ? '#f0a500' : '#2e334d'}`,
    background: active ? '#2a2000' : '#22263a',
    color: active ? '#f0a500' : '#7a7f9a',
    fontSize: 'var(--font-sm)',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
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
    fontSize: 'var(--font-md)',
    fontWeight: 800,
    color: '#f0a500',
    width: 72,
    textAlign: 'center',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    padding: '2px 6px',
    outline: 'none',
    MozAppearance: 'textfield',
    flexShrink: 0,
  },
  clearBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    background: 'rgba(242,107,107,.15)',
    border: '1px solid rgba(242,107,107,.4)',
    color: '#f26b6b',
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  toast: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#2a0a0a',
    border: '1px solid rgba(242,107,107,.5)',
    color: '#f26b6b',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    padding: '10px 20px',
    borderRadius: 10,
    zIndex: 9999,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  fixtureStatus: {
    fontSize: 'var(--font-sm)',
    color: '#a0a4bc',
    marginLeft: 6,
  },
  noFixture: {
    fontSize: 'var(--font-sm)',
    color: '#7a7f9a',
    fontStyle: 'italic',
  },
  cueInput: {
    width: 100,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #2e334d',
    background: '#1a1d27',
    color: '#e8eaf0',
    fontSize: 'var(--font-sm)',
    outline: 'none',
  },
  cueBtn: (disabled) => ({
    padding: '6px 16px',
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#2e334d' : '#f0a500',
    color: disabled ? '#5a5f7a' : '#000',
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    flexShrink: 0,
  }),
}

export default function QuickPanel({ fixtures, onFixturesChange, onCueStored }) {
  const [brightness, setBrightness] = useState(80)
  const [qValue, setQValue] = useState(0)
  const [pan, setPan] = useState(50)
  const [tilt, setTilt] = useState(50)
  const [focus, setFocus] = useState(50)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [pickerColor, setPickerColor] = useState({ r: 255, g: 255, b: 255 })
  const [cueNum, setCueNum] = useState('')
  const colorDebounceRef = useRef(null)
  const prevFixturesRef = useRef([])

  useEffect(() => {
    const prev = prevFixturesRef.current
    const added = fixtures.filter(f => !prev.includes(f))
    prevFixturesRef.current = fixtures
    if (added.length === 0) return
    const target = added[added.length - 1]
    api.fixtureStates().then(data => {
      const state = data.states?.[String(target)]
      if (!state) return
      setBrightness(state.intensity)
      setPan(state.pan ?? 50)
      setTilt(state.tilt ?? 50)
      setFocus(state.focus ?? 50)
      setPickerColor({
        r: Math.round(((state.color?.r ?? 0) / 100) * 255),
        g: Math.round(((state.color?.g ?? 0) / 100) * 255),
        b: Math.round(((state.color?.b ?? 0) / 100) * 255),
      })
    })
  }, [fixtures])

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
    if (result.ok === false) setFb(result.error, false)
  }

  function onColorChange(r, g, b) {
    setPickerColor({ r, g, b })
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current)
    colorDebounceRef.current = setTimeout(async () => {
      const rgb100 = rgb255To100(r, g, b)
      await applyToFixtures(() => api.intensityColor(brightness, null, rgb100))
    }, 80)
  }

  async function handleBrightnessCommit() {
    await applyToFixtures(() => api.intensityColor(brightness, null, null))
  }

  async function handlePositionCommit() {
    await applyToFixtures(() => api.position(pan, tilt, focus))
  }

  async function handleStoreCue() {
    if (!cueNum.trim() || sending) return
    const nums = cueNum.split(/[\s,]+/).map(n => n.trim()).filter(n => /^\d+(\.\d+)?$/.test(n))
    if (nums.length === 0) { setFb('유효한 큐 번호를 입력하세요.', false); return }
    setSending(true)
    const failed = []
    for (const n of nums) {
      const result = await api.storeCue(n)
      if (!result || result.ok === false) failed.push(n)
      else api.addCue(n)
    }
    setSending(false)
    if (failed.length > 0) {
      setFb(`큐 ${failed.join(', ')} 저장 실패`, false)
    } else {
      setFb(`큐 ${nums.join(', ')} 저장 완료.`, true)
      onCueStored?.()
      setCueNum('')
    }
  }

  async function handleClearAll() {
    setSending(true)
    const result = await api.clear()
    setSending(false)
    setFb(result.ok === false ? result.error : '전체 꺼짐.', result.ok !== false)
  }

  return (
    <div style={s.panel}>
      {feedback && <div style={s.toast}>{feedback.message}</div>}
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
          <input
            type="number"
            min={0}
            max={100}
            value={brightness}
            style={s.sliderVal}
            onChange={(e) => {
              const v = Math.min(100, Math.max(0, Number(e.target.value)))
              setBrightness(v)
            }}
            onBlur={handleBrightnessCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleBrightnessCommit()}
          />
        </div>
      </div>

      {/* Pan */}
      <div style={s.row}>
        <span style={s.label}>Pan</span>
        <div style={s.sliderWrap}>
          <input type="range" min={0} max={100} value={pan} style={s.slider}
            onChange={(e) => setPan(Number(e.target.value))}
            onMouseUp={handlePositionCommit} onTouchEnd={handlePositionCommit} />
          <input type="number" min={0} max={100} value={pan} style={s.sliderVal}
            onChange={(e) => setPan(Math.min(100, Math.max(0, Number(e.target.value))))}
            onBlur={handlePositionCommit}
            onKeyDown={(e) => e.key === 'Enter' && handlePositionCommit()} />
        </div>
      </div>

      {/* Tilt */}
      <div style={s.row}>
        <span style={s.label}>Tilt</span>
        <div style={s.sliderWrap}>
          <input type="range" min={0} max={100} value={tilt} style={s.slider}
            onChange={(e) => setTilt(Number(e.target.value))}
            onMouseUp={handlePositionCommit} onTouchEnd={handlePositionCommit} />
          <input type="number" min={0} max={100} value={tilt} style={s.sliderVal}
            onChange={(e) => setTilt(Math.min(100, Math.max(0, Number(e.target.value))))}
            onBlur={handlePositionCommit}
            onKeyDown={(e) => e.key === 'Enter' && handlePositionCommit()} />
        </div>
      </div>

      {/* Zoom */}
      <div style={s.row}>
        <span style={s.label}>Zoom</span>
        <div style={s.sliderWrap}>
          <input type="range" min={0} max={100} value={focus} style={s.slider}
            onChange={(e) => setFocus(Number(e.target.value))}
            onMouseUp={handlePositionCommit} onTouchEnd={handlePositionCommit} />
          <input type="number" min={0} max={100} value={focus} style={s.sliderVal}
            onChange={(e) => setFocus(Math.min(100, Math.max(0, Number(e.target.value))))}
            onBlur={handlePositionCommit}
            onKeyDown={(e) => e.key === 'Enter' && handlePositionCommit()} />
        </div>
      </div>

      {/* 색상 */}
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: '#7a7f9a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          색상
        </div>
        <MAColorPicker
          color={pickerColor}
          bright={brightness}
          q={qValue}
          onChange={onColorChange}
          onQChange={(v) => { setQValue(v); applyToFixtures(() => api.setQ(v)) }}
        />
      </div>

      {/* 큐 저장 */}
      <div style={s.row}>
        <span style={s.label}>큐</span>
        <input
          style={s.cueInput}
          type="text"
          placeholder="1, 2, 3"
          value={cueNum}
          onChange={e => setCueNum(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStoreCue()}
        />
        <button
          style={s.cueBtn(!cueNum.trim() || sending)}
          onClick={handleStoreCue}
          disabled={!cueNum.trim() || sending}
        >
          큐 저장
        </button>
      </div>
    </div>
  )
}
