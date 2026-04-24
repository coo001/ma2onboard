import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'
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
function PresetBank({ presets, onApply, onSave, onDelete, saveLabel = '저장', getTip }) {
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
        <div key={p.id} className="preset-chip" onClick={() => onApply(p)}
          data-tip={getTip ? getTip(p) : undefined}>
          {p.h !== undefined && (
            <span className="preset-swatch" style={{ background: rgbToHex(...hsvToRgb(p.h, p.s, p.v)) }} />
          )}
          {p.name}
          <span className="preset-del" onClick={e => { e.stopPropagation(); onDelete(p.id) }}>×</span>
        </div>
      ))}
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
        <button className="preset-add-btn" onClick={() => setAdding(true)}>+ {saveLabel}</button>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────
const CHANNEL_COUNT = 10

export default function QuickPanel({ onCueStored, onToast }) {
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
  const [posPresets, setPosPresets] = useState([])
  const [colPresets, setColPresets] = useState([])
  const colorDebounce = useRef(null)

  // ── 프리셋 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    api.getPresets().then(r => {
      if (r.position) setPosPresets(r.position)
      if (r.color) setColPresets(r.color)
    })
  }, [])

  // ── 채널 ────────────────────────────────────────────────────────
  const toggleChannel = (id) => setSelected(sel => sel.includes(id) ? sel.filter(x=>x!==id) : [...sel,id])
  const selectAll = () => setSelected(Array.from({length:CHANNEL_COUNT},(_,i)=>i+1))
  const clearAll = () => setSelected([])

  // ── API 호출 ─────────────────────────────────────────────────────
  async function applyIntensity(val) {
    if (!selected.length) return
    await api.selectFixtures(selected)
    await api.intensityColor(val, null, null, selected)
    setChannelIntensities(prev => { const n=[...prev]; selected.forEach(id=>{n[id-1]=val}); return n })
  }
  async function applyPosition(p=pan, t=tilt, z=zoom) {
    if (!selected.length) return
    await api.selectFixtures(selected)
    await api.position(p, t, z, selected)
  }
  async function applyColor(c) {
    if (!selected.length) return
    if (colorDebounce.current) clearTimeout(colorDebounce.current)
    colorDebounce.current = setTimeout(async () => {
      await api.selectFixtures(selected)
      await api.intensityColor(intensity, null, hsvToApi(c.h,c.s,c.v), selected)
    }, 80)
  }
  async function applyEffect(mode, rate) {
    if (!selected.length) return
    await api.selectFixtures(selected)
    await api.effect(mode, mode==='strobe'?rate:null, null, null, null, null, null, selected)
  }
  async function handleClear() {
    const r = await api.clear()
    setChannelIntensities(Array(CHANNEL_COUNT).fill(0)); setSelected([])
    onToast?.(r.ok===false ? (r.error||'오류') : '전체 꺼짐')
  }
  async function handleStoreCue() {
    const nums = cueSaveName.split(/[\s,]+/).map(n=>n.trim()).filter(n=>/^\d+(\.\d+)?$/.test(n))
    if (!nums.length) { onToast?.('유효한 큐 번호를 입력하세요'); return }
    setSaving(true)
    const failed = []
    for (const n of nums) {
      const r = await api.storeCue(n)
      if (!r||r.ok===false) { failed.push(n); continue }
      const ar = await api.addCue(n)
      if (ar&&ar.ok===false&&ar.status!==409) failed.push(n)
    }
    setSaving(false)
    if (failed.length) onToast?.(`큐 ${failed.join(', ')} 저장 실패`)
    else { onToast?.(`큐 ${nums.join(', ')} 저장 완료`); onCueStored?.(); setCueSaveName('') }
  }

  // ── 포지션 프리셋 ─────────────────────────────────────────────────
  async function savePositionPreset(name) {
    const r = await api.savePositionPreset(name, pan, tilt, zoom)
    if (r.ok && r.preset) setPosPresets(prev => [...prev, r.preset])
    onToast?.(`포지션 프리셋 "${name}" 저장됨`)
  }
  async function applyPositionPreset(p) {
    setPan(p.pan); setTilt(p.tilt); setZoom(p.zoom)
    await applyPosition(p.pan, p.tilt, p.zoom)
    onToast?.(`"${p.name}" 적용됨`)
  }
  async function deletePositionPreset(id) {
    await api.deletePreset('position', id)
    setPosPresets(prev => prev.filter(p => p.id !== id))
  }

  // ── 색상 프리셋 ──────────────────────────────────────────────────
  async function saveColorPreset(name) {
    const r = await api.saveColorPreset(name, color.h, color.s, color.v)
    if (r.ok && r.preset) setColPresets(prev => [...prev, r.preset])
    onToast?.(`색상 프리셋 "${name}" 저장됨`)
  }
  async function applyColorPreset(p) {
    const c = { h: p.h, s: p.s, v: p.v }
    setColor(c); await applyColor(c)
    onToast?.(`"${p.name}" 적용됨`)
  }
  async function deleteColorPreset(id) {
    await api.deletePreset('color', id)
    setColPresets(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="col" style={{ overflowY: 'auto' }}>

      {/* 채널 */}
      <Section title="채널" meta={`${selected.length} / ${CHANNEL_COUNT} 선택됨`}>
        <div className="channels">
          {Array.from({length:CHANNEL_COUNT},(_,i)=>i+1).map(id => (
            <div key={id} className={`ch-btn${selected.includes(id)?' active':''}`}
              style={{'--val': channelIntensities[id-1]/100}} onClick={()=>toggleChannel(id)}>
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
            {[['PAN',pan,setPan],['TILT',tilt,setTilt],['ZOOM',zoom,setZoom]].map(([label,value,set])=>(
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
              saveLabel="저장"
              getTip={p => `PAN ${p.pan} · TILT ${p.tilt} · ZOOM ${p.zoom}`}
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
            <ColorPicker color={color} onChange={c=>{setColor(c);applyColor(c)}}/>
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
              saveLabel="저장"
              getTip={p => `${rgbToHex(...hsvToRgb(p.h, p.s, p.v))}  H${p.h} S${p.s} V${p.v}`}
            />
            {colPresets.length === 0 && (
              <div style={{fontSize:10,color:'var(--text-dim)',lineHeight:1.5}}>
                색상 설정 후<br/>"저장"으로 추가
              </div>
            )}
          </div>
        </div>
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

      {/* 큐 저장 */}
      <Section title="큐 저장">
        <div className="row">
          <input className="input" value={cueSaveName} onChange={e=>setCueSaveName(e.target.value)}
            placeholder="1, 2, 3" onKeyDown={e=>e.key==='Enter'&&handleStoreCue()} style={{flex:1}}/>
          <button className="btn primary" onClick={handleStoreCue}
            disabled={!cueSaveName.trim()||saving} style={{flexShrink:0}}>
            <Save size={13}/> {saving?'저장 중…':'저장'}
          </button>
        </div>
        <div style={{fontSize:11,color:'var(--text-dim)'}}>쉼표로 구분해 여러 큐를 한 번에 저장</div>
      </Section>

    </div>
  )
}
