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
  const [saveName, setSaveName] = useState('')
  const [saveLabel, setSaveLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const labelRef = useRef(null)

  async function loadCues() {
    const r = await api.getCues()
    if (r.cues) {
      setCues(r.cues)
      onCuesLoaded?.(r.cues)
      setSelectedCues(prev => new Set([...prev].filter(n => r.cues.some(c => c.number === n))))
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
      const raw = parseFloat(fadeTimes[num] ?? 0)
      const fade = Number.isFinite(raw) && raw >= 0 && raw <= 30 ? raw : 0
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

  async function handleSaveCue() {
    const nums = saveName.split(/[\s,]+/).map(n => n.trim()).filter(n => /^\d+(\.\d+)?$/.test(n))
    if (!nums.length) { toast('유효한 큐 번호를 입력하세요'); return }
    setSaving(true)
    for (const n of nums) {
      try {
        await api.storeCue(n)
        await api.addCue(n, nums.length === 1 ? saveLabel.trim() : '')
      } catch { toast(`큐 ${n} 저장 실패`) }
    }
    setSaving(false)
    setSaveName(''); setSaveLabel('')
    loadCues()
    toast(`큐 ${nums.join(', ')} 저장됨`)
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

  useEffect(() => {
    function onKey(e) {
      if (e.code !== 'Space') return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      handleNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cues, currentCue, sending])

  const playing = currentCue
  const currentCueIdx = currentCue != null ? cues.findIndex(c => c.number === currentCue) : -1
  const nextCue = currentCueIdx >= 0 && currentCueIdx < cues.length - 1 ? cues[currentCueIdx + 1] : null

  return (
    <div className="col cp-mini">
      {/* Header */}
      <div className="cp-mini-header">
        <span className="cp-mini-title">CUE</span>
        <span className="cue-count">{cues.length}</span>
        <div className="grow" />
        {selectedCues.size > 0 && (
          <button
            className="btn sm primary"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onBulkEdit?.([...selectedCues])}
            title="선택된 큐 일괄 편집"
          >
            선택 편집 ({selectedCues.size})
          </button>
        )}
        <button
          className="btn sm ghost cp-mini-sync"
          onClick={handleReconcile}
          disabled={reconciling}
          title="MA2 동기화"
        >
          <Undo size={12} />
        </button>
      </div>

      {/* 큐 저장 바 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 8px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--bg-elev)',
      }}>
        <input
          className="input" value={saveName}
          onChange={e => setSaveName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveCue()}
          placeholder="큐 번호 (예: 1, 2)" style={{ flex: '0 0 100px', fontSize: 11, height: 26 }}
        />
        <input
          className="input" value={saveLabel}
          onChange={e => setSaveLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveCue()}
          placeholder="레이블 (선택)" style={{ flex: 1, fontSize: 11, height: 26 }}
        />
        <button className="btn sm primary" onClick={handleSaveCue}
          disabled={!saveName.trim() || saving} style={{ flexShrink: 0, height: 26, padding: '0 10px', fontSize: 11 }}>
          {saving ? '…' : '저장'}
        </button>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elev)', flexShrink: 0,
        fontSize: 9, fontWeight: 700, color: 'var(--text-dim)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ width: 13, flexShrink: 0 }} />
        <span style={{ width: 30, flexShrink: 0 }}>No.</span>
        <span style={{ flex: 1 }}>레이블</span>
        <span style={{ width: 34, flexShrink: 0, textAlign: 'center' }}>페이드</span>
        <span style={{ width: 20, flexShrink: 0 }} />
        <span style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>실행</span>
      </div>

      {/* Cue list */}
      <div className="cue-list cp-mini-list">
        {cues.length === 0 && (
          <div className="cp-mini-empty">큐 없음</div>
        )}
        {cues.map(cue => {
          const isPlaying = currentCue === cue.number
          const editing = labelDraft?.num === cue.number
          const isChecked = selectedCues.has(cue.number)
          return (
            <div key={cue.number} className={`cp-mini-row${isPlaying ? ' playing' : ''}`}>
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSelect(cue.number)}
                style={{ width: 13, height: 13, flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }}
                title="선택"
              />

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

              {/* Fade input */}
              <input
                type="number"
                className="cue-delay"
                value={fadeTimes[cue.number] ?? 0}
                min={0}
                max={30}
                step={0.5}
                onChange={e => setFadeTimes(prev => ({ ...prev, [cue.number]: e.target.value }))}
                title="페이드 시간(초)"
              />
              <span className="cue-delay-unit">s</span>

              {/* Delete */}
              <button
                className="btn sm icon-only ghost cp-mini-del"
                onClick={() => handleDelete(cue.number)}
                title="삭제"
              >
                <X size={10} />
              </button>

              {/* GO — 항상 맨 오른쪽 */}
              <button
                className="cp-mini-go"
                onClick={() => handleExecute(cue.number)}
                disabled={sending}
              >
                GO
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="cp-mini-footer">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div className="cp-mini-live">
            {playing
              ? <><span className="cp-mini-live-dot" />#{playing}</>
              : <span style={{ color: 'var(--text-dim)' }}>대기</span>
            }
          </div>
          {nextCue && (
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              NEXT {nextCue.number}{nextCue.label ? ` ${nextCue.label}` : ''}
            </span>
          )}
        </div>
        <button className="cp-mini-prev-btn" onClick={handlePrev} disabled={!cues.length || sending} title="이전 큐">
          <Prev size={13} />
        </button>
        <button className="cp-mini-next-btn" onClick={handleNext} disabled={!cues.length || sending} title="다음 큐 실행 (Space)">
          <Next size={15} />
        </button>
      </div>
    </div>
  )
}
