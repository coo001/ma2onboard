import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { Plus, Prev, Next, Check, X, Undo } from './Icon'

export default function CuePanel({ refreshKey, onBulkEdit, onToast, onCuesLoaded }) {
  const [cues, setCues] = useState([])
  const [currentCue, setCurrentCue] = useState(null)
  const [fadeTimes, setFadeTimes] = useState({})
  const [sending, setSending] = useState(false)
  const [selectedCues, setSelectedCues] = useState(new Set())
  const [labelDraft, setLabelDraft] = useState(null)
  const [tab, setTab] = useState('sequence')
  const [reconciling, setReconciling] = useState(false)
  const labelRef = useRef(null)

  async function loadCues() {
    const r = await api.getCues()
    if (r.cues) {
      setCues(r.cues)
      onCuesLoaded?.(r.cues)
    }
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

  async function handleReconcile() {
    setReconciling(true)
    const r = await api.reconcileCues()
    setReconciling(false)
    if (r.ok === false) {
      toast(r.error || 'MA2 동기화 실패')
      return
    }
    loadCues()
    const msg = `MA2 동기화 완료 — 총 ${r.total}개 (추가 ${r.added} / 제거 ${r.removed})`
    toast(msg)
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
    <div className="col cp-mini">
      {/* Header */}
      <div className="cp-mini-header">
        <span className="cp-mini-title">CUE</span>
        <span className="cue-count">{cues.length}</span>
        <div className="grow" />
        <button
          className="btn sm ghost cp-mini-sync"
          onClick={handleReconcile}
          disabled={reconciling}
          title="MA2 동기화"
        >
          <Undo size={12} />
        </button>
      </div>

      {/* Cue list */}
      <div className="cue-list cp-mini-list">
        {cues.length === 0 && (
          <div className="cp-mini-empty">큐 없음</div>
        )}
        {cues.map(cue => {
          const isPlaying = currentCue === cue.number
          const editing = labelDraft?.num === cue.number
          return (
            <div key={cue.number} className={`cp-mini-row${isPlaying ? ' playing' : ''}`}>
              {/* Number */}
              <span className="cp-mini-num">#{cue.number}</span>

              {/* Label */}
              <div className="cp-mini-label-wrap">
                {editing ? (
                  <input
                    ref={labelRef}
                    className="cue-label-edit cp-mini-edit"
                    value={labelDraft.value}
                    placeholder="이름…"
                    onChange={e => setLabelDraft(d => ({ ...d, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setLabelDraft(null) }}
                    onBlur={commitLabel}
                  />
                ) : (
                  <span
                    className={`cp-mini-label${cue.label ? '' : ' dim'}`}
                    onDoubleClick={() => setLabelDraft({ num: cue.number, value: cue.label || '' })}
                    title="더블클릭으로 이름 편집"
                  >
                    {cue.label || '—'}
                  </span>
                )}
              </div>

              {/* GO */}
              <button
                className="btn sm go cp-mini-go"
                onClick={() => handleExecute(cue.number)}
                disabled={sending}
              >
                GO
              </button>

              {/* Delete */}
              <button
                className="btn sm icon-only ghost cp-mini-del"
                onClick={() => handleDelete(cue.number)}
                title="삭제"
              >
                <X size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer — prev/next only */}
      <div className="cp-mini-footer">
        <div className="cp-mini-live">
          {playing
            ? <><span className="cp-mini-live-dot" />#{playing}</>
            : <span style={{ color: 'var(--text-dim)' }}>대기</span>
          }
        </div>
        <button className="btn sm ghost" onClick={handlePrev} disabled={!cues.length || sending}>
          <Prev size={11} />
        </button>
        <button className="btn sm primary" onClick={handleNext} disabled={!cues.length || sending}>
          <Next size={11} />
        </button>
      </div>
    </div>
  )
}
