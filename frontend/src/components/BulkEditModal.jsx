import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

const ALL_FIXTURES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1a1d27', borderRadius: 14, padding: '28px 32px',
    width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
    border: '1px solid #2e334d', display: 'flex', flexDirection: 'column', gap: 18,
  },
  title: { fontSize: 'var(--font-lg)', fontWeight: 800, color: '#e8eaf0', margin: 0 },
  warning: {
    background: '#2a200a', border: '1px solid rgba(240,165,0,.4)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 'var(--font-sm)', color: '#f0c060', lineHeight: 1.6,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 'var(--font-sm)', fontWeight: 700, color: '#7a7f9a', textTransform: 'uppercase', letterSpacing: '.04em' },
  fixtureChips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: (active) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', border: `1px solid ${active ? '#5599f0' : '#2e334d'}`,
    background: active ? '#1a2d50' : '#13151f', color: active ? '#7ab3f0' : '#5a5f7a',
    userSelect: 'none',
  }),
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  checkLabel: { fontSize: 'var(--font-sm)', fontWeight: 600, color: '#c8cae0' },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 10 },
  sliderLabel: { width: 44, fontSize: 12, color: '#7a7f9a', flexShrink: 0 },
  sliderValue: { width: 34, textAlign: 'right', fontSize: 12, color: '#e8eaf0', flexShrink: 0 },
  slider: { flex: 1, accentColor: '#5599f0' },
  footer: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cueNums: { fontSize: 'var(--font-sm)', color: '#7a7f9a' },
  saving: { fontSize: 12, color: '#f0a500', alignSelf: 'center' },
  errorText: { fontSize: 12, color: '#f26b6b' },
}

export default function BulkEditModal({ cueNumbers, onClose, onSaved, colorPresetId = null, positionPresetId = null }) {
  const [selectedFixtures, setSelectedFixtures] = useState(new Set(ALL_FIXTURES))
  const [editColor, setEditColor] = useState(false)
  const [editPosition, setEditPosition] = useState(false)
  const [color, setColor] = useState({ r: 100, g: 100, b: 100 })
  const [position, setPosition] = useState({ pan: 50, tilt: 50, focus: 50 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const debounceColorRef = useRef(null)
  const debouncePositionRef = useRef(null)
  const fixtureList = Array.from(selectedFixtures)

  // On mount: take snapshot with ALL_FIXTURES fixed so restore is not affected by fixture selection changes
  useEffect(() => {
    if (cueNumbers.length > 0) {
      api.previewSnapshot(cueNumbers, ALL_FIXTURES).catch(() => {})
    }
    return () => {
      // Cleanup: clear any pending debounce timers
      if (debounceColorRef.current) clearTimeout(debounceColorRef.current)
      if (debouncePositionRef.current) clearTimeout(debouncePositionRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFixture(num) {
    setSelectedFixtures(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  function handleColorChange(field, val) {
    const next = { ...color, [field]: Number(val) }
    setColor(next)
    if (!editColor) return
    if (debounceColorRef.current) clearTimeout(debounceColorRef.current)
    debounceColorRef.current = setTimeout(() => {
      const fixtures = Array.from(selectedFixtures)
      if (fixtures.length > 0) api.previewColor(fixtures, next).catch(() => {})
    }, 100)
  }

  function handlePositionChange(field, val) {
    const next = { ...position, [field]: Number(val) }
    setPosition(next)
    if (!editPosition) return
    if (debouncePositionRef.current) clearTimeout(debouncePositionRef.current)
    debouncePositionRef.current = setTimeout(() => {
      const fixtures = Array.from(selectedFixtures)
      if (fixtures.length > 0) {
        api.previewPosition(fixtures, next.pan, next.tilt, next.focus).catch(() => {})
      }
    }, 100)
  }

  // When editColor is toggled on, send current values immediately.
  // When toggled off, cancel any pending debounce to prevent stale preview requests.
  function handleEditColorToggle() {
    const next = !editColor
    if (!next && debounceColorRef.current) {
      clearTimeout(debounceColorRef.current)
      debounceColorRef.current = null
    }
    setEditColor(next)
    if (next) {
      const fixtures = Array.from(selectedFixtures)
      if (fixtures.length > 0) api.previewColor(fixtures, color).catch(() => {})
    }
  }

  // When editPosition is toggled on, send current values immediately.
  // When toggled off, cancel any pending debounce to prevent stale preview requests.
  function handleEditPositionToggle() {
    const next = !editPosition
    if (!next && debouncePositionRef.current) {
      clearTimeout(debouncePositionRef.current)
      debouncePositionRef.current = null
    }
    setEditPosition(next)
    if (next) {
      const fixtures = Array.from(selectedFixtures)
      if (fixtures.length > 0) {
        api.previewPosition(fixtures, position.pan, position.tilt, position.focus).catch(() => {})
      }
    }
  }

  async function handleSave() {
    if (!editColor && !editPosition) {
      setError('색상 또는 포지션 중 하나를 선택해주세요.')
      return
    }
    const fixtures = Array.from(selectedFixtures)
    if (fixtures.length === 0) {
      setError('대상 조명을 하나 이상 선택해주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const r = await api.bulkEditCues(
        cueNumbers,
        fixtures,
        editColor ? color : null,
        editPosition ? position : null,
        editColor ? colorPresetId : null,
        editPosition ? positionPresetId : null,
      )
      if (r.ok === false && !r.updated?.length) {
        setError(r.error || '저장 실패')
      } else {
        if (r.failed?.length > 0) {
          const failedCues = r.failed.map(f => `큐 ${f.cue}`).join(', ')
          setError(`${r.updated.length + r.failed.length}개 중 ${r.failed.length}개 실패: ${failedCues}`)
        }
        await api.previewRelease()
        onSaved()
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    await api.previewRestore().catch(() => {})
    onClose()
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) handleCancel() }}>
      <div style={s.modal}>
        <h2 style={s.title}>일괄 편집</h2>
        <div style={s.cueNums}>
          대상 큐: {cueNumbers.map(n => `Cue ${n}`).join(', ')}
        </div>

        <div style={s.warning}>
          편집을 시작하면 grandMA2 프로그래머에 값이 전송됩니다. 취소 시 이전 값으로 복원됩니다.
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>대상 조명</div>
          <div style={s.fixtureChips}>
            {ALL_FIXTURES.map(n => (
              <div key={n} style={s.chip(selectedFixtures.has(n))} onClick={() => toggleFixture(n)}>
                {n}
              </div>
            ))}
          </div>
        </div>

        <div style={s.section}>
          <label style={s.checkRow}>
            <input type="checkbox" checked={editColor} onChange={handleEditColorToggle} />
            <span style={s.checkLabel}>색상 편집</span>
          </label>
          {editColor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
              {[['R', 'r'], ['G', 'g'], ['B', 'b']].map(([label, key]) => (
                <div key={key} style={s.sliderRow}>
                  <span style={s.sliderLabel}>{label}</span>
                  <input
                    type="range" min={0} max={100} value={color[key]}
                    style={s.slider}
                    onChange={e => handleColorChange(key, e.target.value)}
                  />
                  <span style={s.sliderValue}>{color[key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.section}>
          <label style={s.checkRow}>
            <input type="checkbox" checked={editPosition} onChange={handleEditPositionToggle} />
            <span style={s.checkLabel}>포지션 편집</span>
          </label>
          {editPosition && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
              {[['Pan', 'pan'], ['Tilt', 'tilt'], ['Focus', 'focus']].map(([label, key]) => (
                <div key={key} style={s.sliderRow}>
                  <span style={s.sliderLabel}>{label}</span>
                  <input
                    type="range" min={0} max={100} value={position[key]}
                    style={s.slider}
                    onChange={e => handlePositionChange(key, e.target.value)}
                  />
                  <span style={s.sliderValue}>{position[key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div style={s.errorText}>{error}</div>}

        <div style={s.footer}>
          {saving && <span style={s.saving}>저장 중...</span>}
          <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>저장</button>
        </div>
      </div>
    </div>
  )
}
