import { useState, useRef, useEffect, useCallback } from 'react'

export default function Slider({ value, onChange, onCommit, min = 0, max = 100, label, showLabel, hero }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const pct = ((value - min) / (max - min)) * 100

  const handlePos = useCallback((clientX) => {
    const r = trackRef.current.getBoundingClientRect()
    let p = (clientX - r.left) / r.width
    p = Math.max(0, Math.min(1, p))
    onChange(Math.round(min + p * (max - min)))
  }, [min, max, onChange])

  useEffect(() => {
    if (!dragging) return
    const move = (e) => handlePos(e.clientX)
    const up = () => { setDragging(false); onCommit?.() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, handlePos, onCommit])

  return (
    <div className={`slider${hero ? ' hero' : ''}`}>
      <div className="slider-row">
        {showLabel && <div className="slider-label">{label}</div>}
        <div
          ref={trackRef}
          className={`slider-track${dragging ? ' dragging' : ''}`}
          onPointerDown={(e) => { setDragging(true); handlePos(e.clientX) }}
        >
          <div className="slider-fill" style={{ width: `${pct}%` }} />
          <div className="slider-thumb" style={{ left: `${pct}%` }} />
        </div>
        <div className="slider-value">{value}</div>
      </div>
    </div>
  )
}
