import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { Plus, Prev, Next, Check, X } from './Icon'

export default function CuePanel({ refreshKey, onBulkEdit, onToast }) {
  const [cues, setCues] = useState([])
  const [currentCue, setCurrentCue] = useState(null)
  const [fadeTimes, setFadeTimes] = useState({})
  const [sending, setSending] = useState(false)
  const [selectedCues, setSelectedCues] = useState(new Set())
  const [labelDraft, setLabelDraft] = useState(null)
  const [tab, setTab] = useState('sequence')
  const labelRef = useRef(null)

  async function loadCues() {
    const r = await api.getCues()
    if (r.cues) setCues(r.cues)
  }

  useEffect(() => { loadCues() }, [])
  useEffect(() => { if (refreshKey) loadCues() }, [refreshKey])
  useEffect(() => { if (labelDraft) labelRef.current?.focus() }, [labelDraft?.num])

  function toast(msg) { onToast?.(msg) }

  async function handleExecute(num) {
    if (sending) return
    try {
      setSending(true)
      const fade = parseFloat(fadeTimes[num] ?? 0) || 0
      const r = await api.executeCue(num, fade)
      if (r.ok === false) toast(r.error || '실행 실패')
      else setCurrentCue(num)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(num) {
    const r = await api.deleteCue(num)
    if (r.ok === false) { toast(r.error || '삭제 실패'); return }
    if (currentCue === num) setCurrentCue(null)
    loadCues()
  }

  function toggleSelect(num) {
    setSelectedCues(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  async function commitLabel() {
    if (!labelDraft) return
    const draft = labelDraft
    setLabelDraft(null)
    const r = await api.renameCue(draft.num, draft.value)
    if (r.ok === false) toast(r.error || '이름 변경 실패')
    else loadCues()
  }

  function handlePrev() {
    if (sending || !cues.length) return
    const idx = currentCue != null ? cues.findIndex(c => c.number === currentCue) : -1
    handleExecute(cues[idx <= 0 ? cues.length - 1 : idx - 1].number)
  }
  function handleNext() {
    if (sending || !cues.length) return
    const idx = currentCue != null ? cues.findIndex(c => c.number === currentCue) : -1
    handleExecute(cues[idx >= cues.length - 1 ? 0 : idx + 1].number)
  }

  const playing = currentCue

  return (
    <div className="col">
      {/* Header */}
      <div className="cue-header">
        <h3>큐 시퀀스</h3>
        <span className="cue-count">{cues.length}</span>
        <div className="grow" />
        {selectedCues.size > 0 && (
          <>
            <button className="btn sm primary"
              onClick={() => onBulkEdit?.(Array.from(selectedCues))}>
              {selectedCues.size}개 편집
            </button>
            <button className="btn sm ghost" onClick={() => setSelectedCues(new Set())}>
              <X size={12} />
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="cue-tabs">
        {[['sequence','시퀀스'],['run','실행 로그']].map(([id, label]) => (
          <button key={id} className={`cue-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* Cue list */}
      <div className="cue-list">
        {cues.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            저장된 큐가 없습니다
          </div>
        )}
        {cues.map(cue => {
          const active = currentCue === cue.number
          const editing = labelDraft?.num === cue.number
          return (
            <div key={cue.number} className={`cue-row${active ? ' playing' : ''}`}>
              {/* Checkbox */}
              <div
                className={`cue-check${selectedCues.has(cue.number) ? ' checked' : ''}`}
                onClick={() => toggleSelect(cue.number)}
              >
                {selectedCues.has(cue.number) && <Check size={10} stroke={3} />}
              </div>

              {/* Number + label */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                <div className="cue-num">#{cue.number}</div>
                {editing ? (
                  <input
                    ref={labelRef}
                    className="cue-label-edit"
                    value={labelDraft.value}
                    placeholder="이름 입력…"
                    onChange={e => setLabelDraft(d => ({ ...d, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setLabelDraft(null) }}
                    onBlur={commitLabel}
                  />
                ) : (
                  <div
                    style={{ fontSize: 10, color: cue.label ? 'var(--text-muted)' : 'var(--text-dim)', cursor: 'pointer', fontStyle: cue.label ? 'normal' : 'italic' }}
                    onDoubleClick={() => setLabelDraft({ num: cue.number, value: cue.label || '' })}
                    title="더블클릭으로 이름 편집"
                  >
                    {cue.label || '이름 없음'}
                  </div>
                )}
              </div>

              {/* Fade */}
              <input
                className="cue-delay"
                type="number" min="0" step="0.1"
                value={fadeTimes[cue.number] ?? 0}
                onChange={e => setFadeTimes(p => ({ ...p, [cue.number]: e.target.value }))}
                title="페이드 (초)"
              />
              <span className="cue-delay-unit">s</span>

              {/* GO */}
              <button className="btn sm go" onClick={() => handleExecute(cue.number)} disabled={sending}>
                GO
              </button>

              {/* Delete */}
              <button className="btn sm icon-only ghost" onClick={() => handleDelete(cue.number)}
                style={{ color: 'var(--text-dim)' }} title="삭제">
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="cue-footer">
        <div className="live-indicator">
          {playing ? (
            <><span style={{ width:6, height:6, borderRadius:99, background:'var(--status-live)', display:'inline-block' }} /> 재생 중 #{playing}</>
          ) : '대기 중'}
        </div>
        <button className="btn sm ghost" onClick={handlePrev} disabled={!cues.length || sending}>
          <Prev size={12} /> 이전
        </button>
        <button className="btn sm primary" onClick={handleNext} disabled={!cues.length || sending}>
          다음 <Next size={12} />
        </button>
      </div>
    </div>
  )
}
