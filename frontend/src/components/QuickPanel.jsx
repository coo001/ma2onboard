import { useState, useEffect, useRef, useCallback } from 'react'
import { api, updatePresetValues } from '../api'
import Slider from './Slider'
import { Save } from './Icon'

// ── Color utils ────────────────────────────────────────────────────
function hsvToRgb(h, s, v) {
  h /= 360; s /= 100; v /= 100
  const i = Math.floor(h * 6), f = h * 6 - i
  const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s)
  let r, g, b
  switch(i%6){ case 0:r=v;g=t;b=p;break; case 1:r=q;g=v;b=p;break; case 2:r=p;g=v;b=t;break; case 3:r=p;g=q;b=v;break; case 4:r=t;g=p;b=v;break; default:r=v;g=p;b=q }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)]
}
function rgbToHex(r,g,b) { return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase() }
function hsvToApi(h,s,v) { const[r,g,b]=hsvToRgb(h,s,v); return{r:Math.round(r/2.55),g:Math.round(g/2.55),b:Math.round(b/2.55)} }
function hexToHsv(hex) {
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn
  let h=0; if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=Math.round(h*60);if(h<0)h+=360}
  return{h,s:mx?Math.round((d/mx)*100):0,v:Math.round(mx*100)}
}

const PRESETS_HEX = ['#FFFFFF','#FFD166','#FF5E5B','#E63946','#FF6B9D','#B983FF','#5E60CE','#48BFE3','#64DFDF','#80ED99','#FAF3A0','#FF9F1C']

// ── Color Picker — compact HSV sliders ────────────────────────────
function ColorPicker({ color, onChange }) {
  const { h, s, v } = color
  const [r, g, b] = hsvToRgb(h, s, v)
  const hex = rgbToHex(r, g, b)
  return (
    <div className="cp-compact">
      <div className="cp-compact-swatch-row">
        <div className="cp-compact-swatch" style={{ background: hex }} />
        <span className="cp-compact-hex">{hex}</span>
        <div className="cp-compact-presets">
          {PRESETS_HEX.map(p => (
            <div key={p} className="cp-compact-dot" style={{ background: p }} onClick={() => onChange(hexToHsv(p))} />
          ))}
        </div>
      </div>
      {[
        { label: 'H', val: h, max: 360, gradient: `linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))`, set: (n) => onChange({ ...color, h: n }) },
        { label: 'S', val: s, max: 100, gradient: `linear-gradient(to right,hsl(${h},0%,50%),hsl(${h},100%,50%))`, set: (n) => onChange({ ...color, s: n }) },
        { label: 'V', val: v, max: 100, gradient: `linear-gradient(to right,#000,hsl(${h},100%,50%))`, set: (n) => onChange({ ...color, v: n }) },
      ].map(({ label, val, max, gradient, set }) => (
        <div key={label} className="cp-hsv-row">
          <span className="cp-hsv-label">{label}</span>
          <div className="cp-hsv-track" style={{ background: gradient }}
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId)
              const rect = e.currentTarget.getBoundingClientRect()
              set(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * max))
            }}
            onPointerMove={e => {
              if (e.buttons !== 1) return
              const rect = e.currentTarget.getBoundingClientRect()
              set(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * max))
            }}
          >
            <div className="cp-hsv-thumb" style={{ left: `${(val / max) * 100}%` }} />
          </div>
          <span className="cp-hsv-val">{val}</span>
        </div>
      ))}
    </div>
  )
}

// ── Preset Chip ────────────────────────────────────────────────────
function PresetChip({ preset, onApply, onUpdate, onDelete, getTip, getCueCount, colorSwatch }) {
  const cueCount = getCueCount ? getCueCount(preset.id) : 0
  return (
    <div
      className="preset-chip-v2"
      onClick={() => onApply(preset)}
      data-tip={getTip ? getTip(preset) : undefined}
    >
      {colorSwatch && preset.h !== undefined && (
        <span className="preset-swatch-v2" style={{ background: rgbToHex(...hsvToRgb(preset.h, preset.s, preset.v)) }} />
      )}
      <span className="preset-chip-name">{preset.name}</span>
      {cueCount > 0 && (
        <span className="preset-chip-cue-count">{cueCount}Q</span>
      )}
      <span className="preset-chip-actions">
        {onUpdate && (
          <span
            className="preset-chip-action-btn update"
            title="현재 값으로 업데이트"
            onClick={e => { e.stopPropagation(); onUpdate(preset) }}
          >↑</span>
        )}
        <span
          className="preset-chip-action-btn delete"
          onClick={e => { e.stopPropagation(); onDelete(preset.id) }}
          title="삭제"
        >×</span>
      </span>
    </div>
  )
}

// ── Preset Bank ────────────────────────────────────────────────────
function PresetBank({ presets, onApply, onSave, onDelete, onUpdate, saveLabel = '저장', getTip, getCueCount, colorSwatch = false, disableSave = false }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  function handleSave() {
    const n = name.trim()
    if (!n) { setAdding(false); setName(''); return }
    onSave(n)
    setAdding(false)
    setName('')
  }

  return (
    <div className="preset-bank">
      {presets.map(p => (
        <PresetChip
          key={p.id}
          preset={p}
          onApply={onApply}
          onUpdate={onUpdate}
          onDelete={onDelete}
          getTip={getTip}
          getCueCount={getCueCount}
          colorSwatch={colorSwatch}
        />
      ))}
      {adding ? (
        <input
          ref={inputRef}
          className="preset-name-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="이름 입력…"
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setAdding(false); setName('') } }}
          onBlur={handleSave}
        />
      ) : (
        <button className="preset-add-btn" onClick={() => setAdding(true)} disabled={disableSave}
          title={disableSave ? '우클릭으로 채널을 먼저 선택하세요' : undefined}>
          + {saveLabel}
        </button>
      )}
    </div>
  )
}

// ── Section heading ────────────────────────────────────────────────
function SectionHead({ label, meta }) {
  return (
    <div className="qp-section-head">
      <span className="qp-section-label">{label}</span>
      {meta && <span className="qp-section-meta">{meta}</span>}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────
const CHANNEL_COUNT = 10

export default function QuickPanel({ onCueStored, onToast, cues = [], onPresetSelect, presetRefreshKey }) {
  const [active, setActive] = useState([])
  const [selected, setSelected] = useState([])
  const [channelIntensities, setChannelIntensities] = useState(() => Array(CHANNEL_COUNT).fill(0))
  const [intensity, setIntensity] = useState(80)
  const [color, setColor] = useState({ h: 210, s: 0, v: 100 })
  const [pan, setPan] = useState(50)
  const [tilt, setTilt] = useState(50)
  const [zoom, setZoom] = useState(50)
  const [effect, setEffect] = useState('none')
  const [strobeRate, setStrobeRate] = useState(4)
  const [cueSaveName, setCueSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMode, setSaveMode] = useState('all')
  const [saveAttrs, setSaveAttrs] = useState({ intensity: true, color: true, position: true, focus: true })
  const [posPresets, setPosPresets] = useState([])
  const [colPresets, setColPresets] = useState([])
  const [scenePresets, setScenePresets] = useState([])
  const [fixturePositions, setFixturePositions] = useState({})
  const [fixtureColors, setFixtureColors] = useState({})
  const [fixtureIntensities, setFixtureIntensities] = useState({})
  const [cueLabel, setCueLabel] = useState('')
  const colorDebounce = useRef(null)
  // 최신 fixture 상태를 ref로 유지 — toggleActive 클로저 stale 방지
  const fixturePositionsRef = useRef({})
  const fixtureColorsRef = useRef({})
  const fixtureIntensitiesRef = useRef({})

  const [selectedColorPresetId, setSelectedColorPresetId] = useState(null)
  const [selectedPositionPresetId, setSelectedPositionPresetId] = useState(null)

  // colorDebounce cleanup on unmount
  useEffect(() => {
    return () => { if (colorDebounce.current) clearTimeout(colorDebounce.current) }
  }, [])
  // refs를 최신 state와 동기화
  useEffect(() => { fixturePositionsRef.current = fixturePositions }, [fixturePositions])
  useEffect(() => { fixtureColorsRef.current = fixtureColors }, [fixtureColors])
  useEffect(() => { fixtureIntensitiesRef.current = fixtureIntensities }, [fixtureIntensities])

  // ── 프리셋 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    api.getPresets().then(r => {
      if (r.position) setPosPresets(r.position)
      if (r.color) setColPresets(r.color)
      if (r.scene) setScenePresets(r.scene)
    })
  }, [presetRefreshKey])

  useEffect(() => {
    onPresetSelect?.({ colorPresetId: selectedColorPresetId, positionPresetId: selectedPositionPresetId })
  }, [selectedColorPresetId, selectedPositionPresetId, onPresetSelect])

  // ── 채널 ────────────────────────────────────────────────────────
  function toggleActive(id) {
    let willAdd = false
    setActive(a => {
      if (a.includes(id)) return a.filter(x => x !== id)
      willAdd = true
      return [...a, id]
    })
    // setState가 sync하게 willAdd를 세팅한 후 다음 microtask에서 부수효과 실행
    Promise.resolve().then(() => {
      if (willAdd) {
        if (fixturePositionsRef.current[id]) { const { pan: p, tilt: t, zoom: z } = fixturePositionsRef.current[id]; setPan(p); setTilt(t); setZoom(z) }
        if (fixtureColorsRef.current[id]) setColor(fixtureColorsRef.current[id])
        if (fixtureIntensitiesRef.current[id] !== undefined) setIntensity(fixtureIntensitiesRef.current[id])
      }
    })
  }
  const toggleSelected = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id])
  const selectAll = () => setActive(Array.from({length:CHANNEL_COUNT},(_,i)=>i+1))
  const clearAll = () => { setActive([]); setSelected([]) }

  // ── API 호출 ─────────────────────────────────────────────────────
  async function applyIntensity(val) {
    if (!active.length) return
    await api.selectFixtures(active)
    await api.intensityColor(val, null, null, active)
    setChannelIntensities(prev => { const n=[...prev]; active.forEach(id=>{n[id-1]=val}); return n })
    setFixtureIntensities(prev => {
      const next = { ...prev }
      active.forEach(id => { next[id] = val })
      return next
    })
  }
  async function applyPosition(p=pan, t=tilt, z=zoom) {
    if (!active.length) return
    await api.selectFixtures(active)
    await api.position(p, t, z, active)
    setFixturePositions(prev => {
      const next = { ...prev }
      active.forEach(id => { next[id] = { pan: p, tilt: t, zoom: z } })
      return next
    })
  }
  async function applyColor(c) {
    if (!active.length) return
    if (colorDebounce.current) clearTimeout(colorDebounce.current)
    colorDebounce.current = setTimeout(async () => {
      await api.selectFixtures(active)
      await api.intensityColor(intensity, null, hsvToApi(c.h,c.s,c.v), active)
      setFixtureColors(prev => {
        const next = { ...prev }
        active.forEach(id => { next[id] = c })
        return next
      })
    }, 80)
  }
  function handlePanChange(v) { setPan(v); setSelectedPositionPresetId(null) }
  function handleTiltChange(v) { setTilt(v); setSelectedPositionPresetId(null) }
  function handleZoomChange(v) { setZoom(v); setSelectedPositionPresetId(null) }
  function handleColorChange(c) { setColor(c); setSelectedColorPresetId(null); applyColor(c) }
  async function applyEffect(mode, rate) {
    if (!active.length) return
    await api.selectFixtures(active)
    await api.effect(mode, mode==='strobe'?rate:null, null, null, null, null, null, active)
  }
  async function handleClear() {
    const r = await api.clear()
    setChannelIntensities(Array(CHANNEL_COUNT).fill(0))
    setFixtureIntensities({}); setActive([]); setSelected([])
    onToast?.(r.ok===false ? (r.error||'오류') : '전체 꺼짐')
  }
  async function handleStoreCue() {
    const nums = cueSaveName.split(/[\s,]+/).map(n=>n.trim()).filter(n=>/^\d+(\.\d+)?$/.test(n))
    if (!nums.length) { onToast?.('유효한 큐 번호를 입력하세요'); return }
    if (saveMode !== 'all' && !selected.length) { onToast?.('저장할 채널을 우클릭으로 선택하세요'); return }
    if (saveMode === 'selective' && !Object.values(saveAttrs).some(v => v)) {
      onToast?.('저장할 속성을 선택하세요'); return
    }
    setSaving(true)
    const failed = []
    for (const n of nums) {
      try {
        if (saveMode === 'all') {
          const r = await api.storeCue(n)
          if (!r || r.ok === false) { failed.push(n); continue }
        } else {
          await api.clear()
          await api.selectFixtures(selected)
          if (saveMode === 'selected') {
            await api.intensityColor(intensity, null, hsvToApi(color.h, color.s, color.v), selected)
            await api.position(pan, tilt, zoom, selected)
          } else {
            if (saveAttrs.intensity || saveAttrs.color) {
              await api.intensityColor(
                saveAttrs.intensity ? intensity : null,
                null,
                saveAttrs.color ? hsvToApi(color.h, color.s, color.v) : null,
                selected
              )
            }
            if (saveAttrs.position || saveAttrs.focus) {
              await api.position(
                saveAttrs.position ? pan : null,
                saveAttrs.position ? tilt : null,
                saveAttrs.focus ? zoom : null,
                selected
              )
            }
          }
          const r = await api.storeCue(n)
          if (!r || r.ok === false) { failed.push(n); continue }
        }
        const ar = await api.addCue(n, cueLabel.trim())
        if (ar && ar.ok === false && ar.status !== 409) failed.push(n)
      } catch (e) {
        failed.push(n)
      }
    }
    setSaving(false)
    if (failed.length) onToast?.(`큐 ${failed.join(', ')} 저장 실패`)
    else { onToast?.(`큐 ${nums.join(', ')} 저장 완료`); onCueStored?.(); setCueSaveName(''); setCueLabel('') }
  }

  // ── 포지션 프리셋 ─────────────────────────────────────────────────
  async function savePositionPreset(name) {
    const tracked = selected.filter(id => fixturePositions[id])
    let data
    if (tracked.length >= 1) {
      const groupMap = {}
      tracked.forEach(id => {
        const pos = fixturePositions[id]
        const key = `${pos.pan},${pos.tilt},${pos.zoom}`
        if (!groupMap[key]) groupMap[key] = { ...pos, fixtures: [] }
        groupMap[key].fixtures.push(id)
      })
      const groups = Object.values(groupMap)
      const first = groups[0]
      data = groups.length > 1
        ? { name, pan: first.pan, tilt: first.tilt, zoom: first.zoom, groups }
        : { name, pan: first.pan, tilt: first.tilt, zoom: first.zoom }
    } else {
      data = { name, pan, tilt, zoom }
    }
    const r = await api.savePositionPreset(data)
    if (r.ok && r.preset) setPosPresets(prev => [...prev, r.preset])
    onToast?.(`포지션 프리셋 "${name}" 저장됨`)
  }
  async function applyPositionPreset(p) {
    setSelectedPositionPresetId(p.id)
    if (p.groups?.length) {
      for (const g of p.groups) {
        await api.selectFixtures(g.fixtures)
        await api.position(g.pan, g.tilt, g.zoom, g.fixtures)
      }
      const activeGroup = p.groups.find(g => g.fixtures.some(f => active.includes(f)))
      if (activeGroup) { setPan(activeGroup.pan); setTilt(activeGroup.tilt); setZoom(activeGroup.zoom) }
      onToast?.(`"${p.name}" 적용됨 (${p.groups.length}개 그룹)`)
    } else {
      setPan(p.pan); setTilt(p.tilt); setZoom(p.zoom)
      await applyPosition(p.pan, p.tilt, p.zoom)
      onToast?.(`"${p.name}" 적용됨`)
    }
  }
  async function deletePositionPreset(id) {
    await api.deletePreset('position', id)
    setPosPresets(prev => prev.filter(p => p.id !== id))
    if (selectedPositionPresetId === id) setSelectedPositionPresetId(null)
  }

  // ── 색상 프리셋 ──────────────────────────────────────────────────
  async function saveColorPreset(name) {
    const r = await api.saveColorPreset(name, color.h, color.s, color.v)
    if (r.ok && r.preset) setColPresets(prev => [...prev, r.preset])
    onToast?.(`색상 프리셋 "${name}" 저장됨`)
  }
  async function applyColorPreset(p) {
    const c = { h: p.h, s: p.s, v: p.v }
    setColor(c)
    setSelectedColorPresetId(p.id)
    await applyColor(c)
    onToast?.(`"${p.name}" 적용됨`)
  }
  async function deleteColorPreset(id) {
    await api.deletePreset('color', id)
    setColPresets(prev => prev.filter(p => p.id !== id))
    if (selectedColorPresetId === id) setSelectedColorPresetId(null)
  }

  // ── 프리셋 현재 값으로 업데이트 ──────────────────────────────────
  async function updatePositionPreset(p) {
    try {
      const result = await updatePresetValues('position', p.id, { pan, tilt, zoom })
      setPosPresets(prev => prev.map(pp => pp.id === p.id ? { ...pp, pan, tilt, zoom } : pp))
      const count = result.updated_cues?.length ?? 0
      onToast?.(count > 0 ? `"${p.name}" 업데이트 — ${count}개 큐 반영` : `"${p.name}" 업데이트됨`)
    } catch (e) {
      onToast?.('프리셋 업데이트 실패')
    }
  }
  async function updateColorPreset(p) {
    try {
      const result = await updatePresetValues('color', p.id, { h: color.h, s: color.s, v: color.v })
      setColPresets(prev => prev.map(pp => pp.id === p.id ? { ...pp, h: color.h, s: color.s, v: color.v } : pp))
      const count = result.updated_cues?.length ?? 0
      onToast?.(count > 0 ? `"${p.name}" 업데이트 — ${count}개 큐 반영` : `"${p.name}" 업데이트됨`)
    } catch (e) {
      onToast?.('프리셋 업데이트 실패')
    }
  }

  // ── 씬 프리셋 ────────────────────────────────────────────────────
  async function saveScenePreset(name) {
    if (!selected.length) { onToast?.('저장할 채널을 우클릭으로 선택하세요'); return }
    const fixtures = selected.map(id => ({
      id,
      intensity: fixtureIntensities[id] ?? intensity,
      color: fixtureColors[id] ?? color,
      pan: fixturePositions[id]?.pan ?? pan,
      tilt: fixturePositions[id]?.tilt ?? tilt,
      zoom: fixturePositions[id]?.zoom ?? zoom,
    }))
    const r = await api.saveScenePreset({ name, fixtures })
    if (r.ok && r.preset) setScenePresets(prev => [...prev, r.preset])
    onToast?.(`씬 프리셋 "${name}" 저장됨`)
  }
  async function applyScenePreset(p) {
    // 동일한 (intensity, color, pan, tilt, zoom) 값끼리 그룹화해 배치 호출 수 감소
    const groups = {}
    p.fixtures.forEach(f => {
      const key = `${f.intensity}_${f.color?.h}_${f.color?.s}_${f.color?.v}_${f.pan}_${f.tilt}_${f.zoom}`
      if (!groups[key]) groups[key] = { ...f, ids: [] }
      groups[key].ids.push(f.id)
    })

    const failed = []
    await Promise.all(Object.values(groups).map(async g => {
      try {
        await api.selectFixtures(g.ids)
        await api.intensityColor(g.intensity ?? null, null, g.color ? hsvToApi(g.color.h, g.color.s, g.color.v) : null, g.ids)
        if (g.pan !== undefined) await api.position(g.pan, g.tilt, g.zoom, g.ids)
      } catch {
        g.ids.forEach(id => failed.push(id))
      }
    }))

    const okIds = new Set(p.fixtures.map(f => f.id).filter(id => !failed.includes(id)))
    const ok = p.fixtures.filter(f => okIds.has(f.id))
    if (ok.length) {
      setFixtureIntensities(prev => { const n = { ...prev }; ok.forEach(f => { if (f.intensity !== undefined) n[f.id] = f.intensity }); return n })
      setFixtureColors(prev => { const n = { ...prev }; ok.forEach(f => { if (f.color) n[f.id] = f.color }); return n })
      setFixturePositions(prev => { const n = { ...prev }; ok.forEach(f => { if (f.pan !== undefined) n[f.id] = { pan: f.pan, tilt: f.tilt, zoom: f.zoom } }); return n })
      setChannelIntensities(prev => { const n = [...prev]; ok.forEach(f => { if (f.intensity !== undefined) n[f.id - 1] = f.intensity }); return n })
    }
    if (failed.length) onToast?.(`"${p.name}" — ${failed.join(', ')}번 조명 적용 실패`)
    else onToast?.(`"${p.name}" 적용됨 (${p.fixtures.length}개 조명)`)
  }
  async function deleteScenePreset(id) {
    await api.deletePreset('scene', id)
    setScenePresets(prev => prev.filter(p => p.id !== id))
  }

  const currentColorHex = rgbToHex(...hsvToRgb(color.h, color.s, color.v))

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="qp-root">

      {/* ── Channel strip — always visible ── */}
      <div className="qp-channel-strip">
        <div className="qp-channel-strip-header">
          <div className="qp-channel-legend">
            <span className="qp-legend-item control">
              <span className="qp-legend-dot control" />
              좌클릭 — 제어
            </span>
            <span className="qp-legend-item save">
              <span className="qp-legend-dot save" />
              우클릭 — 저장
            </span>
          </div>
          <div className="qp-channel-state">
            {active.length > 0 && (
              <span className="qp-state-pill control">{active.length} 제어</span>
            )}
            {selected.length > 0 && (
              <span className="qp-state-pill save">{selected.length} 선택</span>
            )}
          </div>
        </div>

        <div className="qp-channels">
          {Array.from({ length: CHANNEL_COUNT }, (_, i) => i + 1).map(id => {
            const isActive = active.includes(id)
            const isSel = selected.includes(id)
            return (
              <div
                key={id}
                className={`qp-ch${isActive ? ' active' : ''}${isSel ? ' sel' : ''}`}
                style={{ '--val': channelIntensities[id - 1] / 100 }}
                onClick={() => toggleActive(id)}
                onContextMenu={e => { e.preventDefault(); toggleSelected(id) }}
              >
                <span className="qp-ch-num">{id}</span>
                <span className="qp-ch-val">{channelIntensities[id - 1] || ''}</span>
                <div className="qp-ch-bar" />
              </div>
            )
          })}
        </div>

        <div className="qp-channel-actions">
          <button className="btn sm ghost" onClick={selectAll}>전체</button>
          <button className="btn sm ghost" onClick={clearAll}>해제</button>
          <div className="grow" />
          <button className="btn sm danger" onClick={handleClear}>전체 끄기</button>
        </div>

        {active.length === 0 && (
          <div style={{ fontSize:11, color:'var(--text-dim)', textAlign:'center', padding:'6px 0', background:'var(--bg-elev-2)', borderRadius:'var(--radius-sm)', marginBottom:4 }}>
            채널을 클릭해서 선택하면 슬라이더가 활성화됩니다
          </div>
        )}
      </div>

      {/* ── Single scrollable body — all sections visible ── */}
      <div className="qp-body">

        {/* ══ 조명 제어 ════════════════════════════════════════════ */}
        <div className="qp-section-head-bar">
          <span className="qp-section-label">조명 제어</span>
          <span className="qp-section-meta">{intensity}%</span>
        </div>

        {/* 밝기 */}
        <div className="qp-block-compact">
          <Slider value={intensity} onChange={setIntensity} onCommit={() => applyIntensity(intensity)} hero disabled={active.length === 0} />
        </div>

        {/* 포지션 + 색상 — side by side */}
        <div className="qp-two-col">
          {/* 포지션 */}
          <div className="qp-col-block">
            <div className="qp-col-label">포지션</div>
            {[
              ['PAN', pan, handlePanChange],
              ['TILT', tilt, handleTiltChange],
              ['ZOOM', zoom, handleZoomChange],
            ].map(([label, value, set]) => (
              <Slider key={label} label={label} showLabel value={value} onChange={set} onCommit={applyPosition} disabled={active.length === 0} />
            ))}
          </div>
          {/* 색상 */}
          <div className="qp-col-block">
            <div className="qp-col-label">색상</div>
            <ColorPicker color={color} onChange={active.length === 0 ? () => {} : handleColorChange} />
          </div>
        </div>

        {/* 이펙트 */}
        <div className="qp-block-compact">
          <div className="qp-col-label">이펙트</div>
          <div className="segmented">
            {[['none', '없음'], ['strobe', '스트로브'], ['slot', 'Slot']].map(([k, label]) => (
              <button key={k} className={effect === k ? 'active' : ''} onClick={() => { setEffect(k); applyEffect(k, strobeRate) }}>
                {label}
              </button>
            ))}
          </div>
          {effect === 'strobe' && (
            <Slider label="RATE" showLabel value={strobeRate} min={1} max={20}
              onChange={setStrobeRate} onCommit={() => applyEffect('strobe', strobeRate)} />
          )}
        </div>

        {/* ══ 프리셋 ═══════════════════════════════════════════════ */}
        <div className="qp-section-head-bar">
          <span className="qp-section-label">프리셋</span>
          <span className="qp-section-meta">{colPresets.length + posPresets.length + scenePresets.length}개</span>
        </div>

        <div className="qp-preset-grid">
          {/* 색상 프리셋 */}
          <div className="qp-preset-col">
            <div className="qp-preset-col-head">
              <span>색상 ({colPresets.length})</span>
              <span className="qp-preset-col-swatch" style={{ background: currentColorHex }} />
            </div>
            <PresetBank
              presets={colPresets}
              onApply={applyColorPreset}
              onSave={saveColorPreset}
              onDelete={deleteColorPreset}
              onUpdate={updateColorPreset}
              saveLabel="저장"
              colorSwatch={true}
              getTip={p => `${rgbToHex(...hsvToRgb(p.h, p.s, p.v))}  H${p.h} S${p.s} V${p.v}`}
              getCueCount={id => cues.filter(c => c.colorPresetId === id).length}
            />
          </div>

          {/* 포지션 프리셋 */}
          <div className="qp-preset-col">
            <div className="qp-preset-col-head">
              <span>포지션 ({posPresets.length})</span>
              <span className="qp-preset-col-pos">{pan}/{tilt}</span>
            </div>
            <PresetBank
              presets={posPresets}
              onApply={applyPositionPreset}
              onSave={savePositionPreset}
              onDelete={deletePositionPreset}
              onUpdate={updatePositionPreset}
              saveLabel="저장"
              getTip={p => p.groups?.length
                ? `${p.groups.length}개 그룹`
                : `P${p.pan} T${p.tilt} Z${p.zoom}`}
              getCueCount={id => cues.filter(c => c.positionPresetId === id).length}
            />
          </div>

          {/* 씬 프리셋 */}
          <div className="qp-preset-col">
            <div className="qp-preset-col-head">
              <span>씬 ({scenePresets.length})</span>
              {selected.length > 0
                ? <span className="qp-preset-col-sel">{selected.length}ch 선택됨</span>
                : <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>우클릭으로 채널 선택</span>
              }
            </div>
            <PresetBank
              presets={scenePresets}
              onApply={applyScenePreset}
              onSave={saveScenePreset}
              onDelete={deleteScenePreset}
              saveLabel="저장"
              getTip={p => `조명 ${p.fixtures.map(f => f.id).join(', ')}번`}
              disableSave={selected.length === 0}
            />
          </div>
        </div>

        {/* ══ 큐 저장 ══════════════════════════════════════════════ */}
        <div className="qp-section-head-bar">
          <span className="qp-section-label">큐 저장</span>
        </div>

        <div className="qp-block-compact">
          {/* 저장 모드 — compact inline segmented */}
          <div className="qp-save-mode-inline">
            {[
              ['all', '전체'],
              ['selected', '선택 조명'],
              ['selective', '선택 속성'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`qp-save-mode-btn${saveMode === key ? ' active' : ''}`}
                onClick={() => setSaveMode(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 선택 조명 상태 */}
          {saveMode !== 'all' && (
            <div className={`qp-save-channel-status${selected.length ? ' has-sel' : ' no-sel'}`}>
              {selected.length > 0
                ? <><span className="qp-status-dot save" />채널 {selected.sort((a, b) => a - b).join(', ')}번</>
                : <><span className="qp-status-dot warn" />채널을 우클릭으로 선택하세요</>
              }
            </div>
          )}

          {/* 선택 속성 체크박스 */}
          {saveMode === 'selective' && (
            <div className="qp-save-attrs-checks">
              {[['intensity', '조도'], ['color', '색상'], ['position', '위치'], ['focus', '포커스']].map(([k, l]) => (
                <label key={k} className={`qp-save-attr-check${saveAttrs[k] ? ' checked' : ''}`}>
                  <input type="checkbox" checked={saveAttrs[k]}
                    onChange={e => setSaveAttrs(p => ({ ...p, [k]: e.target.checked }))} />
                  {l}
                </label>
              ))}
            </div>
          )}

          {/* 큐 번호 입력 + 저장 버튼 */}
          <div className="row">
            <input
              className="input"
              value={cueSaveName}
              onChange={e => setCueSaveName(e.target.value)}
              placeholder="큐 번호 (예: 1, 2, 3.5)"
              onKeyDown={e => e.key === 'Enter' && handleStoreCue()}
              style={{ flex: 1 }}
            />
            <button
              className="btn primary"
              onClick={handleStoreCue}
              disabled={!cueSaveName.trim() || saving}
              style={{ flexShrink: 0 }}
            >
              <Save size={13} /> {saving ? '…' : '저장'}
            </button>
          </div>
          <input
            className="input"
            value={cueLabel}
            onChange={e => setCueLabel(e.target.value)}
            placeholder="레이블 (선택, 예: 오프닝)"
            style={{ flex: 1, marginTop: 4 }}
          />
          {cueLabel && cueSaveName.includes(',') && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              여러 큐에 같은 레이블이 모두 적용됩니다
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
