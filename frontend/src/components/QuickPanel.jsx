import { useState, useEffect, useRef, useCallback } from 'react'
import { api, updatePresetValues } from '../api'
import Section from './Section'
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

// ── Color Picker ───────────────────────────────────────────────────
function ColorPicker({ color, onChange }) {
  const svRef = useRef(null), hueRef = useRef(null)
  const [dragSV, setDragSV] = useState(false), [dragHue, setDragHue] = useState(false)
  const { h, s, v } = color
  const setSV = useCallback((cx,cy) => {
    const r=svRef.current.getBoundingClientRect()
    onChange({...color,s:Math.round(Math.max(0,Math.min(1,(cx-r.left)/r.width))*100),v:Math.round((1-Math.max(0,Math.min(1,(cy-r.top)/r.height)))*100)})
  },[color,onChange])
  const setHue = useCallback((cx) => {
    const r=hueRef.current.getBoundingClientRect()
    onChange({...color,h:Math.round(Math.max(0,Math.min(1,(cx-r.left)/r.width))*360)})
  },[color,onChange])
  useEffect(() => {
    if(!dragSV&&!dragHue) return
    const move=(e)=>dragSV?setSV(e.clientX,e.clientY):setHue(e.clientX)
    const up=()=>{setDragSV(false);setDragHue(false)}
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
  })
  const [r,g,b]=hsvToRgb(h,s,v); const hex=rgbToHex(r,g,b)
  return (
    <div className="cp-wrap">
      <div ref={svRef} className="cp-hsv"
        style={{background:`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),oklch(0.7 0.22 ${h})`}}
        onPointerDown={e=>{setDragSV(true);setSV(e.clientX,e.clientY)}}>
        <div className="cp-puck" style={{left:`${s}%`,top:`${100-v}%`}}/>
      </div>
      <div ref={hueRef} className="cp-hue" onPointerDown={e=>{setDragHue(true);setHue(e.clientX)}}>
        <div className="cp-hue-puck" style={{left:`${(h/360)*100}%`,background:`hsl(${h},100%,50%)`}}/>
      </div>
      <div className="cp-readout">
        <div className="cp-swatch" style={{background:hex}}/>
        <div className="cp-values">
          <div><span className="k">HEX</span><span className="v">{hex}</span></div>
          <div><span className="k">RGB</span><span className="v">{r} {g} {b}</span></div>
        </div>
      </div>
      <div className="cp-presets">
        {PRESETS_HEX.map(p=>(
          <div key={p} className="cp-preset" style={{background:p}} onClick={()=>onChange(hexToHsv(p))}/>
        ))}
      </div>
    </div>
  )
}

// ── Preset Bank ────────────────────────────────────────────────────
function PresetBank({ presets, onApply, onSave, onDelete, onUpdate, saveLabel = '저장', getTip, getCueCount, disableSave = false }) {
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
      {presets.map(p => {
        const cueCount = getCueCount ? getCueCount(p.id) : 0
        return (
          <div key={p.id} className="preset-chip" onClick={() => onApply(p)}
            data-tip={getTip ? getTip(p) : undefined}>
            {p.h !== undefined && (
              <span className="preset-swatch" style={{ background: rgbToHex(...hsvToRgb(p.h, p.s, p.v)) }} />
            )}
            {p.name}
            {cueCount > 0 && (
              <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 2, fontWeight: 700 }}>
                {cueCount}Q
              </span>
            )}
            <span className="preset-del" title="현재 값으로 업데이트"
              onClick={e => { e.stopPropagation(); onUpdate?.(p) }}
              style={{ opacity: 0.7, fontSize: 11 }}>↑</span>
            <span className="preset-del" onClick={e => { e.stopPropagation(); onDelete(p.id) }}>×</span>
          </div>
        )
      })}
      {adding ? (
        <>
          <input
            ref={inputRef}
            className="preset-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="이름 입력…"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setAdding(false); setName('') } }}
            onBlur={handleSave}
          />
        </>
      ) : (
        <button className="preset-add-btn" onClick={() => setAdding(true)}
          disabled={disableSave}
          title={disableSave ? '우클릭으로 채널을 먼저 선택하세요' : undefined}>
          + {saveLabel}
        </button>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────
const CHANNEL_COUNT = 10

export default function QuickPanel({ onCueStored, onToast, cues = [], onPresetSelect, presetRefreshKey }) {
  // active = 좌클릭 (실시간 제어), selected = 우클릭 (저장용)
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
  const [cueLabel, setCueLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMode, setSaveMode] = useState('all') // 'all' | 'selected' | 'selective'
  const [saveAttrs, setSaveAttrs] = useState({ intensity: true, color: true, position: true, focus: true })
  const [posPresets, setPosPresets] = useState([])
  const [colPresets, setColPresets] = useState([])
  const [scenePresets, setScenePresets] = useState([])
  const colorDebounce = useRef(null)

  // 조명별 상태 추적
  const [fixturePositions, setFixturePositions] = useState({})
  const [fixtureColors, setFixtureColors] = useState({})
  const [fixtureIntensities, setFixtureIntensities] = useState({})
  const fixturePositionsRef = useRef({})
  const fixtureColorsRef = useRef({})
  const fixtureIntensitiesRef = useRef({})

  // 현재 선택된 프리셋 ID 추적 (큐 저장 시 presetId 함께 전송)
  const [selectedColorPresetId, setSelectedColorPresetId] = useState(null)
  const [selectedPositionPresetId, setSelectedPositionPresetId] = useState(null)

  // ── ref 동기화 ────────────────────────────────────────────────────
  useEffect(() => { fixturePositionsRef.current = fixturePositions }, [fixturePositions])
  useEffect(() => { fixtureColorsRef.current = fixtureColors }, [fixtureColors])
  useEffect(() => { fixtureIntensitiesRef.current = fixtureIntensities }, [fixtureIntensities])

  // colorDebounce cleanup
  useEffect(() => {
    return () => { if (colorDebounce.current) clearTimeout(colorDebounce.current) }
  }, [])

  // ── 프리셋 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    api.getPresets().then(r => {
      if (r.position) setPosPresets(r.position)
      if (r.color) setColPresets(r.color)
      if (r.scene) setScenePresets(r.scene)
    })
  }, [presetRefreshKey])

  // 선택된 presetId가 바뀌면 부모에 알림
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
    Promise.resolve().then(() => {
      if (willAdd) {
        if (fixturePositionsRef.current[id]) {
          const { pan: p, tilt: t, zoom: z } = fixturePositionsRef.current[id]
          setPan(p); setTilt(t); setZoom(z)
        }
        if (fixtureColorsRef.current[id]) setColor(fixtureColorsRef.current[id])
        if (fixtureIntensitiesRef.current[id] !== undefined) setIntensity(fixtureIntensitiesRef.current[id])
      }
    })
  }
  const toggleSelected = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

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
  // 슬라이더 직접 조작 시 presetId 초기화
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
    setActive([])
    setFixtureIntensities({})
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
    const label = cueLabel.trim()
    const failed = []
    for (const n of nums) {
      try {
        if (saveMode === 'all') {
          const r = await api.storeCue(n)
          if (!r || r.ok === false) { failed.push(n); continue }
        } else {
          // 프로그래머 초기화 후 선택 조명/속성만 설정
          await api.clear()
          await api.selectFixtures(selected)
          if (saveMode === 'selected') {
            await api.intensityColor(intensity, null, hsvToApi(color.h, color.s, color.v), selected)
            await api.position(pan, tilt, zoom, selected)
          } else {
            // selective: 체크된 속성만
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
        const ar = await api.addCue(n, label)
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
    const groups = {}
    p.fixtures.forEach(f => {
      const key = `${f.intensity}_${f.color?.h}_${f.color?.s}_${f.color?.v}_${f.pan}_${f.tilt}_${f.zoom}`
      if (!groups[key]) groups[key] = { ...f, ids: [] }
      groups[key].ids.push(f.id)
    })
    const failed = []
    for (const g of Object.values(groups)) {
      try {
        await api.selectFixtures(g.ids)
        await api.intensityColor(g.intensity ?? null, null, g.color ? hsvToApi(g.color.h, g.color.s, g.color.v) : null, g.ids)
        if (g.pan !== undefined) await api.position(g.pan, g.tilt, g.zoom, g.ids)
      } catch { g.ids.forEach(id => failed.push(id)) }
    }
    if (failed.length) onToast?.(`"${p.name}" — ${failed.join(', ')}번 조명 적용 실패`)
    else onToast?.(`"${p.name}" 적용됨 (${p.fixtures.length}개 조명)`)
  }
  async function deleteScenePreset(id) {
    await api.deletePreset('scene', id)
    setScenePresets(prev => prev.filter(p => p.id !== id))
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

  return (
    <div className="col" style={{ overflowY: 'auto' }}>

      {/* 채널 */}
      <Section title="채널" meta={`제어 ${active.length} · 저장 ${selected.length}`}>
        <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:4}}>
          좌클릭 = 제어 <span style={{color:'var(--accent)'}}>●</span> &nbsp; 우클릭 = 저장선택 <span style={{color:'oklch(0.78 0.14 220)'}}>●</span>
        </div>
        <div className="channels">
          {Array.from({length:CHANNEL_COUNT},(_,i)=>i+1).map(id => (
            <div key={id}
              className={`ch-btn${active.includes(id)?' active':''}${selected.includes(id)?' sel':''}`}
              style={{'--val': channelIntensities[id-1]/100}}
              onClick={() => toggleActive(id)}
              onContextMenu={e => { e.preventDefault(); toggleSelected(id) }}>
              <span className="ch-btn-num">{id}</span>
              <span className="ch-btn-val">{channelIntensities[id-1]}</span>
              <div className="ch-bar"/>
            </div>
          ))}
        </div>
        <div className="channel-actions">
          <button className="btn sm ghost" onClick={selectAll}>전체 선택</button>
          <button className="btn sm ghost" onClick={clearAll}>선택 해제</button>
          <div className="grow"/>
          <button className="btn sm danger" onClick={handleClear}>전체 끄기</button>
        </div>
      </Section>

      {/* 밝기 */}
      <Section title="밝기" meta={`${intensity}%`}>
        <Slider value={intensity} onChange={setIntensity} onCommit={()=>applyIntensity(intensity)} hero />
      </Section>

      {/* 포지션 + 포지션 프리셋 */}
      <Section title="움직임 / 포커스">
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ flex: 6, minWidth: 0 }}>
            {[['PAN',pan,handlePanChange],['TILT',tilt,handleTiltChange],['ZOOM',zoom,handleZoomChange]].map(([label,value,set])=>(
              <Slider key={label} label={label} showLabel value={value} onChange={set} onCommit={applyPosition}/>
            ))}
          </div>
          <div style={{
            flex: 4, minWidth: 0,
            borderLeft: '1px solid var(--border-soft)',
            paddingLeft: 14, marginLeft: 14,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
              포지션 프리셋
            </div>
            <PresetBank
              presets={posPresets}
              onApply={applyPositionPreset}
              onSave={savePositionPreset}
              onDelete={deletePositionPreset}
              onUpdate={updatePositionPreset}
              saveLabel="저장"
              getTip={p => `PAN ${p.pan} · TILT ${p.tilt} · ZOOM ${p.zoom}`}
              getCueCount={id => cues.filter(c => c.positionPresetId === id).length}
            />
            {posPresets.length === 0 && (
              <div style={{fontSize:10,color:'var(--text-dim)',lineHeight:1.5}}>
                값 맞추고<br/>"저장"으로 추가
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 색상 + 색상 프리셋 */}
      <Section title="색상" meta={rgbToHex(...hsvToRgb(color.h,color.s,color.v))}>
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ flex: 6, minWidth: 0 }}>
            <ColorPicker color={color} onChange={handleColorChange}/>
          </div>
          <div style={{
            flex: 4, minWidth: 0,
            borderLeft: '1px solid var(--border-soft)',
            paddingLeft: 14, marginLeft: 14,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
              색상 프리셋
            </div>
            <PresetBank
              presets={colPresets}
              onApply={applyColorPreset}
              onSave={saveColorPreset}
              onDelete={deleteColorPreset}
              onUpdate={updateColorPreset}
              saveLabel="저장"
              getTip={p => `${rgbToHex(...hsvToRgb(p.h, p.s, p.v))}  H${p.h} S${p.s} V${p.v}`}
              getCueCount={id => cues.filter(c => c.colorPresetId === id).length}
            />
            {colPresets.length === 0 && (
              <div style={{fontSize:10,color:'var(--text-dim)',lineHeight:1.5}}>
                색상 설정 후<br/>"저장"으로 추가
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 씬 프리셋 */}
      <Section title="씬 프리셋" meta={`${scenePresets.length}개`}>
        <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:6}}>
          우클릭으로 조명기 선택 후 저장 — 밝기·색상·포지션 모두 기록
        </div>
        <PresetBank
          presets={scenePresets}
          onApply={applyScenePreset}
          onSave={saveScenePreset}
          onDelete={deleteScenePreset}
          saveLabel="씬 저장"
          getTip={p => `조명 ${p.fixtures?.map(f=>f.id).join(', ')}번`}
          disableSave={selected.length === 0}
        />
      </Section>

      {/* 큐 저장 */}
      <Section title="큐 저장">
        {/* 저장 모드 선택 */}
        <div className="segmented" style={{ marginBottom: 8 }}>
          {[['all','전체'],['selected','선택 조명'],['selective','선택 속성']].map(([k,l]) => (
            <button key={k} className={saveMode===k?'active':''} onClick={() => setSaveMode(k)}>{l}</button>
          ))}
        </div>

        {/* 선택 조명 경고 */}
        {saveMode !== 'all' && selected.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--status-danger)', marginBottom: 6 }}>
            위 채널 그리드에서 조명을 우클릭으로 선택하세요
          </div>
        )}

        {/* 선택 속성 체크박스 */}
        {saveMode === 'selective' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            {[['intensity','조도'],['color','색상'],['position','위치(P/T)'],['focus','포커스']].map(([k,l]) => (
              <label key={k} style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={saveAttrs[k]}
                  onChange={e => setSaveAttrs(p => ({ ...p, [k]: e.target.checked }))} />
                {l}
              </label>
            ))}
          </div>
        )}

        <div className="row">
          <input className="input" value={cueSaveName} onChange={e=>setCueSaveName(e.target.value)}
            placeholder="1, 2, 3" onKeyDown={e=>e.key==='Enter'&&handleStoreCue()} style={{flex:1}}/>
          <button className="btn primary" onClick={handleStoreCue}
            disabled={!cueSaveName.trim()||saving} style={{flexShrink:0}}>
            <Save size={13}/> {saving?'저장 중…':'저장'}
          </button>
        </div>
        <input className="input" value={cueLabel} onChange={e=>setCueLabel(e.target.value)}
          placeholder="레이블 (선택, 예: 오프닝)" style={{flex:1, marginTop:4}}/>
        {cueLabel && cueSaveName.includes(',') && (
          <div style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>
            여러 큐에 같은 레이블이 모두 적용됩니다
          </div>
        )}
        <div style={{fontSize:11,color:'var(--text-dim)'}}>쉼표로 구분해 여러 큐를 한 번에 저장</div>
      </Section>

      {/* 이펙트 */}
      <Section title="이펙트">
        <div className="segmented">
          {[['none','없음'],['strobe','스트로브'],['slot','Effect Slot']].map(([k,label])=>(
            <button key={k} className={effect===k?'active':''} onClick={()=>{setEffect(k);applyEffect(k,strobeRate)}}>
              {label}
            </button>
          ))}
        </div>
        {effect==='strobe'&&(
          <Slider label="RATE" showLabel value={strobeRate} min={1} max={20}
            onChange={setStrobeRate} onCommit={()=>applyEffect('strobe',strobeRate)}/>
        )}
      </Section>

    </div>
  )
}
