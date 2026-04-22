import { useCallback, useRef, useState } from 'react'
import { api } from '../api'

const PAD = 260

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
  cols: { display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 28 },
  section: {
    background: '#1a1d27',
    borderRadius: 14,
    padding: '20px 24px',
    border: '1px solid #2e334d',
    minWidth: 300,
  },
  sectionTitle: { fontSize: 18, fontWeight: 800, marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: '#7a7f9a', lineHeight: 1.7, marginBottom: 14 },
  pad: {
    width: PAD,
    height: PAD,
    background: '#12141e',
    border: '2px solid #2e334d',
    borderRadius: 14,
    position: 'relative',
    cursor: 'crosshair',
    userSelect: 'none',
    touchAction: 'none',
  },
  axisLine: { position: 'absolute', background: '#2e334d' },
  axisLabel: { position: 'absolute', fontSize: 10, color: '#59607c', fontWeight: 700 },
  dot: (x, y) => ({
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#f0a500',
    border: '2px solid #fff',
    left: x * PAD - 8,
    top: (1 - y) * PAD - 8,
    pointerEvents: 'none',
    boxShadow: '0 0 10px rgba(240,165,0,.65)',
  }),
  numRow: { display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' },
  numItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 },
  numLabel: { fontSize: 12, color: '#7a7f9a' },
  numValue: { fontSize: 28, fontWeight: 900, color: '#f0a500' },
  stepperRow: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  stepBtn: {
    width: 38,
    height: 34,
    borderRadius: 8,
    background: '#22263a',
    border: '1px solid #2e334d',
    color: '#e8eaf0',
    fontSize: 14,
    fontWeight: 800,
  },
  feedback: { fontSize: 12, marginTop: 10, minHeight: 16 },
  focusInput: {
    width: 90,
    fontSize: 26,
    fontWeight: 900,
    textAlign: 'center',
    color: '#f0a500',
    background: '#22263a',
    border: '2px solid #2e334d',
    borderRadius: 10,
    padding: '6px 0',
  },
  note: { fontSize: 12, color: '#7a7f9a', lineHeight: 1.7, marginTop: 10 },
}

export default function Step3Position({ data, onNext, onBack }) {
  const [pan, setPan] = useState(50)
  const [tilt, setTilt] = useState(50)
  const [focus, setFocus] = useState(50)
  const [focusInput, setFocusInput] = useState('50')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const dragging = useRef(false)
  const sendTimer = useRef(null)

  function setFb(message, ok) {
    setFeedback({ message, ok })
    setTimeout(() => setFeedback(null), 1800)
  }

  async function sendPosition(nextPan, nextTilt, nextFocus) {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(async () => {
      setSending(true)
      const result = await api.position(nextPan, nextTilt, nextFocus)
      setSending(false)
      setFb(result.ok === false ? result.error : '위치 정보가 적용되었습니다.', result.ok !== false)
    }, 80)
  }

  const updatePad = useCallback(
    (event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / PAD))
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / PAD))
      const nextPan = Math.round(x * 100)
      const nextTilt = Math.round((1 - y) * 100)
      setPan(nextPan)
      setTilt(nextTilt)
      sendPosition(nextPan, nextTilt, focus)
    },
    [focus],
  )

  function adjustPan(delta) {
    const value = Math.max(0, Math.min(100, pan + delta))
    setPan(value)
    sendPosition(value, tilt, focus)
  }

  function adjustTilt(delta) {
    const value = Math.max(0, Math.min(100, tilt + delta))
    setTilt(value)
    sendPosition(pan, value, focus)
  }

  function handleFocusBlur() {
    const value = Math.max(0, Math.min(100, parseInt(focusInput, 10) || 0))
    setFocus(value)
    setFocusInput(String(value))
    sendPosition(pan, tilt, value)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.stepBadge}>3 / 5 단계</div>
      <div style={styles.title}>방향과 초점을 조정하세요</div>
      <div style={styles.subtitle}>
        움직이는 조명이라면 여기서 방향을 맞춥니다. 고정 조명만 사용하는 경우에는 기본값 그대로 두고 넘어가도 됩니다.
      </div>

      <div style={styles.guide}>
        <div style={styles.guideTitle}>이 단계에서 하는 일</div>
        패드를 드래그하면 Pan과 Tilt가 같이 움직입니다. Focus가 있는 장비라면 숫자를 바꿔 선명도를 맞춰 보세요.
      </div>

      <div style={styles.topActions}>
        <button className="btn btn-secondary" onClick={onBack}>
          이전
        </button>
        <button className="btn btn-primary" onClick={() => onNext({ pan, tilt, focus })}>
          다음
        </button>
      </div>

      <div style={styles.context}>
        현재 선택된 조명: <span style={styles.contextStrong}>{data.fixtures?.join(', ')}번</span>
      </div>

      <div style={styles.cols}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Pan / Tilt 패드</div>
          <div style={styles.sectionDesc}>점을 움직여 조명의 방향을 맞춥니다. 세밀하게 맞출 때는 아래 버튼을 같이 쓰면 편합니다.</div>

          <div
            style={styles.pad}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              dragging.current = true
              updatePad(event)
            }}
            onPointerMove={(event) => dragging.current && updatePad(event)}
            onPointerUp={() => {
              dragging.current = false
            }}
          >
            <div style={{ ...styles.axisLine, top: '50%', left: 0, right: 0, height: 1 }} />
            <div style={{ ...styles.axisLine, left: '50%', top: 0, bottom: 0, width: 1 }} />
            <div style={{ ...styles.axisLabel, top: 6, left: '50%', transform: 'translateX(-50%)' }}>위</div>
            <div style={{ ...styles.axisLabel, bottom: 6, left: '50%', transform: 'translateX(-50%)' }}>아래</div>
            <div style={{ ...styles.axisLabel, left: 8, top: '50%', transform: 'translateY(-50%)' }}>좌</div>
            <div style={{ ...styles.axisLabel, right: 8, top: '50%', transform: 'translateY(-50%)' }}>우</div>
            <div style={styles.dot(pan / 100, tilt / 100)} />
          </div>

          <div style={styles.numRow}>
            <div style={styles.numItem}>
              <div style={styles.numLabel}>Pan</div>
              <div style={styles.numValue}>{pan}</div>
              <div style={styles.stepperRow}>
                {[-5, -1, 1, 5].map((delta) => (
                  <button key={delta} style={styles.stepBtn} onClick={() => adjustPan(delta)}>
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.numItem}>
              <div style={styles.numLabel}>Tilt</div>
              <div style={styles.numValue}>{tilt}</div>
              <div style={styles.stepperRow}>
                {[-5, -1, 1, 5].map((delta) => (
                  <button key={delta} style={styles.stepBtn} onClick={() => adjustTilt(delta)}>
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...styles.feedback, color: feedback?.ok ? '#3ddc84' : '#f26b6b' }}>
            {sending ? '전송 중...' : feedback?.message || ''}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Focus</div>
          <div style={styles.sectionDesc}>값이 낮을수록 부드럽고, 높을수록 선명합니다. Focus 기능이 없는 장비는 변화가 없을 수 있습니다.</div>

          <input
            style={styles.focusInput}
            type="number"
            min={0}
            max={100}
            value={focusInput}
            onChange={(event) => setFocusInput(event.target.value)}
            onBlur={handleFocusBlur}
            onKeyDown={(event) => event.key === 'Enter' && handleFocusBlur()}
          />

          <div style={styles.stepperRow}>
            {[-10, -1, 1, 10].map((delta) => (
              <button
                key={delta}
                style={styles.stepBtn}
                onClick={() => {
                  const value = Math.max(0, Math.min(100, focus + delta))
                  setFocus(value)
                  setFocusInput(String(value))
                  sendPosition(pan, tilt, value)
                }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>

          <div style={styles.note}>
            초점 변화가 잘 안 보이면 무대 벽이나 바닥에 조명을 비춰 두고 확인하면 쉽습니다.
          </div>
        </div>
      </div>
    </div>
  )
}
