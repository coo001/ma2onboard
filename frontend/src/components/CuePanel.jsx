import { useState, useEffect } from 'react'
import { api } from '../api'

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
  title: {
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    color: '#7a7f9a',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
  },
  cueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  cueRow: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 8,
    background: active ? '#2a2000' : '#1a1d27',
    border: `1px solid ${active ? '#f0a500' : '#2e334d'}`,
  }),
  cueNum: (active) => ({
    fontSize: 'var(--font-md)',
    fontWeight: 800,
    color: active ? '#f0a500' : '#e8eaf0',
    flex: 1,
  }),
  goBtn: (sending) => ({
    padding: '6px 16px',
    borderRadius: 6,
    border: 'none',
    background: sending ? '#2e334d' : '#f0a500',
    color: sending ? '#5a5f7a' : '#000',
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    cursor: sending ? 'default' : 'pointer',
    flexShrink: 0,
  }),
  deleteBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid rgba(242,107,107,.4)',
    background: 'rgba(242,107,107,.1)',
    color: '#f26b6b',
    fontSize: 'var(--font-sm)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  navRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  navBtn: (disabled) => ({
    flex: 1,
    padding: '8px',
    borderRadius: 8,
    border: '1px solid #2e334d',
    background: disabled ? '#13151f' : '#22263a',
    color: disabled ? '#3a3f55' : '#e8eaf0',
    fontSize: 'var(--font-sm)',
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
  }),
  empty: {
    fontSize: 'var(--font-sm)',
    color: '#7a7f9a',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px 0',
  },
  colHeader: {
    fontSize: '0.7em',
    fontWeight: 700,
    color: '#4a4f6a',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    textAlign: 'center',
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
}

export default function CuePanel({ refreshKey }) {
  const [cues, setCues] = useState([])
  const [currentCue, setCurrentCue] = useState(null)
  const [fadeTimes, setFadeTimes] = useState({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function loadCues() {
    const r = await api.getCues()
    if (r.cues) setCues(r.cues)
  }

  useEffect(() => { loadCues() }, [])
  useEffect(() => { if (refreshKey) loadCues() }, [refreshKey])

  function showError(msg) {
    setError(msg)
    setTimeout(() => setError(null), 2000)
  }

  async function handleExecute(num) {
    try {
      setSending(true)
      const fade = parseFloat(fadeTimes[num] ?? 0) || 0
      const r = await api.executeCue(num, fade)
      if (r.ok === false) showError(r.error || '실행 실패')
      else setCurrentCue(num)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(num) {
    const r = await api.deleteCue(num)
    if (r.ok === false) { showError(r.error || '삭제 실패'); return }
    if (currentCue === num) setCurrentCue(null)
    loadCues()
  }

  function handlePrev() {
    if (sending) return
    if (!cues.length) return
    const idx = currentCue != null ? cues.findIndex(c => c.number === currentCue) : -1
    const prevIdx = idx <= 0 ? cues.length - 1 : idx - 1
    handleExecute(cues[prevIdx].number)
  }

  function handleNext() {
    if (sending) return
    if (!cues.length) return
    const idx = currentCue != null ? cues.findIndex(c => c.number === currentCue) : -1
    const nextIdx = idx >= cues.length - 1 ? 0 : idx + 1
    handleExecute(cues[nextIdx].number)
  }

  return (
    <div style={s.panel}>
      {error && <div style={s.toast}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
        <span style={s.title}>큐 시퀀스</span>
        <div style={{ flex: 1 }} />
        <span style={{ ...s.colHeader, width: 52 }}>페이드</span>
        <span style={{ ...s.colHeader, width: 52 }}>실행</span>
        <span style={{ ...s.colHeader, width: 36 }}>제거</span>
      </div>

      <div style={s.cueList}>
        {cues.length === 0 && <div style={s.empty}>큐가 없습니다.</div>}
        {cues.map(cue => (
          <div key={cue.number} style={s.cueRow(currentCue === cue.number)}>
            <span style={s.cueNum(currentCue === cue.number)}>
              Cue {cue.number}
              {cue.label && <span style={{ color: '#7a7f9a', fontSize: '0.8em', marginLeft: 6 }}>{cue.label}</span>}
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={fadeTimes[cue.number] ?? 0}
              onChange={e => setFadeTimes(prev => ({ ...prev, [cue.number]: e.target.value }))}
              style={{ width: 52, padding: '4px 6px', borderRadius: 6, border: '1px solid #2e334d', background: '#13151f', color: '#e8eaf0', fontSize: 'var(--font-sm)', textAlign: 'center', flexShrink: 0 }}
              title="페이드 시간 (초)"
            />
            <button style={s.goBtn(sending)} onClick={() => handleExecute(cue.number)} disabled={sending}>GO</button>
            <button style={s.deleteBtn} onClick={() => handleDelete(cue.number)}>✕</button>
          </div>
        ))}
      </div>

      <div style={s.navRow}>
        <button style={s.navBtn(!cues.length || sending)} onClick={handlePrev} disabled={!cues.length || sending}>◀ 이전</button>
        <button style={s.navBtn(!cues.length || sending)} onClick={handleNext} disabled={!cues.length || sending}>다음 ▶</button>
      </div>

    </div>
  )
}
