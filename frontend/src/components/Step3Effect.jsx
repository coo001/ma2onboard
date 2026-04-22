import { useRef, useState } from 'react'
import { api } from '../api'

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
  numItem: { display: 'flex', flexDirection: 'column', gap: 6 },
  numLabel: { fontSize: 12, color: '#7a7f9a' },
  divider: { borderTop: '1px solid #2e334d', margin: '16px 0' },
  paramRow: { display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 },
  paramBlock: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 },
  paramLabel: { fontSize: 12, color: '#7a7f9a', marginBottom: 2 },
  paramValue: { fontSize: 22, fontWeight: 900, color: '#c4a0ff' },
}

export default function Step3Effect({ data, onNext, onBack }) {
  const [mode, setMode] = useState('none')
  const [strobe, setStrobe] = useState(0)
  const [slot, setSlot] = useState(1)
  const [slotValue, setSlotValue] = useState(50)
  const [tempo, setTempo] = useState(50)
  const [high, setHigh] = useState(100)
  const [low, setLow] = useState(0)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const sendTimer = useRef(null)

  function setFb(message, ok) {
    setFeedback({ message, ok })
    setTimeout(() => setFeedback(null), 1800)
  }

  async function sendEffect(nextMode, nextStrobe, nextSlot, nextSlotValue, nextTempo, nextHigh, nextLow) {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(async () => {
      setSending(true)
      try {
        const result = await api.effect(
          nextMode,
          nextMode === 'strobe' ? nextStrobe : null,
          nextMode === 'slot' ? nextSlot : null,
          nextMode === 'slot' ? nextSlotValue : null,
          nextMode === 'slot' ? nextTempo : null,
          nextMode === 'slot' ? nextHigh : null,
          nextMode === 'slot' ? nextLow : null,
        )
        setFb(result.ok === false ? result.error : '이펙트가 적용되었습니다.', result.ok !== false)
      } catch (e) {
        setFb(e.message || '전송 오류', false)
      } finally {
        setSending(false)
      }
    }, 150)
  }

  function changeMode(next) {
    setMode(next)
    sendEffect(next, strobe, slot, slotValue, tempo, high, low)
  }

  function changeStrobe(v) {
    const clamped = Math.max(0, Math.min(100, v))
    setStrobe(clamped)
    if (mode === 'strobe') sendEffect('strobe', clamped, slot, slotValue, tempo, high, low)
  }

  function changeSlot(v) {
    const clamped = Math.max(1, Math.min(99, v))
    setSlot(clamped)
    if (mode === 'slot') sendEffect('slot', strobe, clamped, slotValue, tempo, high, low)
  }

  function changeSlotValue(v) {
    const clamped = Math.max(0, Math.min(100, v))
    setSlotValue(clamped)
    if (mode === 'slot') sendEffect('slot', strobe, slot, clamped, tempo, high, low)
  }

  function changeTempo(v) {
    const clamped = Math.max(0, Math.min(100, v))
    setTempo(clamped)
    if (mode === 'slot') sendEffect('slot', strobe, slot, slotValue, clamped, high, low)
  }

  function changeHigh(v) {
    const clamped = Math.max(0, Math.min(100, v))
    setHigh(clamped)
    if (mode === 'slot') sendEffect('slot', strobe, slot, slotValue, tempo, clamped, low)
  }

  function changeLow(v) {
    const clamped = Math.max(0, Math.min(100, v))
    setLow(clamped)
    if (mode === 'slot') sendEffect('slot', strobe, slot, slotValue, tempo, high, clamped)
  }

  function handleNext() {
    const effect =
      mode === 'strobe' ? { mode: 'strobe', strobe } :
      mode === 'slot' ? { mode: 'slot', slot, value: slotValue, tempo, high, low } :
      { mode: 'none' }
    onNext({ effect })
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.stepBadge}>4 / 5 단계</div>
      <div style={styles.title}>이펙트를 설정하세요</div>
      <div style={styles.subtitle}>
        고정 장면이면 &ldquo;없음&rdquo;, 번쩍임은 &ldquo;스트로브&rdquo;, 미리 만든 효과는 &ldquo;Effect Slot&rdquo;을 선택합니다.
      </div>

      <div style={styles.guide}>
        <div style={styles.guideTitle}>이 단계에서 하는 일</div>
        이펙트를 켜거나 속도·슬롯 번호를 고릅니다. 다음 단계에서 큐로 저장하면 이펙트까지 함께 저장됩니다.
      </div>

      <div style={styles.topActions}>
        <button className="btn btn-secondary" onClick={onBack}>이전</button>
        <button className="btn btn-primary" onClick={handleNext}>다음</button>
      </div>

      <div style={styles.context}>
        현재 선택된 조명: <span style={styles.contextStrong}>{data.fixtures?.join(', ')}번</span>
      </div>

      <div style={styles.cols}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>모드</div>
          <div style={styles.sectionDesc}>이펙트 유형을 선택하세요. 전환 즉시 grandMA2에 반영됩니다.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'none', label: '없음' },
              { key: 'strobe', label: '스트로브' },
              { key: 'slot', label: 'Effect Slot' },
            ].map(opt => (
              <button
                key={opt.key}
                className={mode === opt.key ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => changeMode(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'strobe' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Strobe 속도</div>
            <div style={styles.sectionDesc}>
              0은 꺼짐, 100은 가장 빠름. 값은 fixture profile에 따라 달라집니다.
            </div>
            <input
              type="range" min={0} max={100} value={strobe}
              onChange={e => changeStrobe(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f0a500' }}
            />
            <div style={styles.numValue}>{strobe}</div>
            <div style={styles.stepperRow}>
              {[-10, -1, 1, 10].map(d => (
                <button key={d} style={styles.stepBtn} onClick={() => changeStrobe(strobe + d)}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'slot' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Effect Slot</div>
            <div style={styles.sectionDesc}>
              Effect 풀에 미리 저장된 슬롯 번호(1~99)와 강도(0~100)를 지정합니다.
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={styles.numItem}>
                <div style={styles.numLabel}>Slot (1-99)</div>
                <input
                  type="number" min={1} max={99} value={slot}
                  onChange={e => changeSlot(Number(e.target.value))}
                  style={styles.focusInput}
                />
              </div>
              <div style={styles.numItem}>
                <div style={styles.numLabel}>세기 (0-100)</div>
                <input
                  type="number" min={0} max={100} value={slotValue}
                  onChange={e => changeSlotValue(Number(e.target.value))}
                  style={styles.focusInput}
                />
              </div>
            </div>

            <div style={styles.divider} />

            {/* Tempo */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4a0ff' }}>Tempo (EffRate)</div>
                <div style={{ ...styles.numValue, fontSize: 22, color: '#c4a0ff' }}>{tempo}</div>
              </div>
              <input
                type="range" min={0} max={100} value={tempo}
                onChange={e => changeTempo(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#c4a0ff' }}
              />
              <div style={styles.stepperRow}>
                {[-10, -1, 1, 10].map(d => (
                  <button key={d} style={{ ...styles.stepBtn, borderColor: '#4a3a6d' }} onClick={() => changeTempo(tempo + d)}>
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>

            {/* High */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3ddc84' }}>High (EffHigh)</div>
                <div style={{ ...styles.numValue, fontSize: 22, color: '#3ddc84' }}>{high}</div>
              </div>
              <input
                type="range" min={0} max={100} value={high}
                onChange={e => changeHigh(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3ddc84' }}
              />
              <div style={styles.stepperRow}>
                {[-10, -1, 1, 10].map(d => (
                  <button key={d} style={{ ...styles.stepBtn, borderColor: '#1a4a33' }} onClick={() => changeHigh(high + d)}>
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Low */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#6ab0f5' }}>Low (EffLow)</div>
                <div style={{ ...styles.numValue, fontSize: 22, color: '#6ab0f5' }}>{low}</div>
              </div>
              <input
                type="range" min={0} max={100} value={low}
                onChange={e => changeLow(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#6ab0f5' }}
              />
              <div style={styles.stepperRow}>
                {[-10, -1, 1, 10].map(d => (
                  <button key={d} style={{ ...styles.stepBtn, borderColor: '#1a3050' }} onClick={() => changeLow(low + d)}>
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-sm" onClick={() => sendEffect('slot', strobe, slot, slotValue, tempo, high, low)}>
              적용
            </button>
          </div>
        )}
      </div>

      <div style={{ ...styles.feedback, color: feedback?.ok ? '#3ddc84' : '#f26b6b' }}>
        {sending ? '전송 중...' : feedback?.message || ''}
      </div>
    </div>
  )
}
