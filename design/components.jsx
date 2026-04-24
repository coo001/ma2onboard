/* global React, Icon */
const { useState, useRef, useEffect, useCallback, useMemo } = React;

// ============ Slider ============
function Slider({ value, onChange, min = 0, max = 100, label, showLabel, hero }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;

  const handlePos = useCallback((clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    let p = (clientX - r.left) / r.width;
    p = Math.max(0, Math.min(1, p));
    onChange(Math.round(min + p * (max - min)));
  }, [min, max, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => handlePos(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, handlePos]);

  return (
    <div className={`slider ${hero ? 'hero' : ''}`}>
      <div className="slider-row">
        {showLabel && <div className="slider-label">{label}</div>}
        <div
          ref={trackRef}
          className={`slider-track ${dragging ? 'dragging' : ''}`}
          onPointerDown={(e) => { setDragging(true); handlePos(e.clientX); }}
        >
          <div className="slider-fill" style={{ width: `${pct}%` }} />
          <div className="slider-thumb" style={{ left: `${pct}%` }} />
        </div>
        <div className="slider-value">{value}</div>
      </div>
    </div>
  );
}

// ============ Section (collapsible) ============
function Section({ title, meta, defaultOpen = true, compact, children, actions }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`section ${open ? '' : 'collapsed'} ${compact ? 'compact' : ''}`}>
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <Icon.Chevron className="section-chevron" size={14} />
        <span className="section-title">{title}</span>
        {meta && <span className="section-meta">{meta}</span>}
        {actions && <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: meta ? 8 : 'auto' }}>{actions}</div>}
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

// ============ Channel Grid ============
function ChannelGrid({ channels, selected, onToggle, onSelectAll, onClearAll, compact }) {
  return (
    <>
      <div className={`channels ${compact ? 'compact' : ''}`}>
        {channels.map(ch => (
          <div
            key={ch.id}
            className={`ch-btn ${selected.includes(ch.id) ? 'active' : ''}`}
            onClick={() => onToggle(ch.id)}
            style={{ '--val': ch.intensity / 100 }}
          >
            <span className="ch-btn-num">{ch.id}</span>
            {!compact && <span className="ch-btn-val">{ch.intensity}</span>}
            <div className="ch-bar" />
          </div>
        ))}
      </div>
      <div className="channel-actions">
        <button className="btn sm ghost" onClick={onSelectAll}>전체 선택</button>
        <button className="btn sm ghost" onClick={onClearAll}>선택 해제</button>
        <div className="grow" />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {selected.length}/{channels.length} 선택됨
        </span>
      </div>
    </>
  );
}

// ============ Color Picker ============
function hsvToRgb(h, s, v) {
  h /= 360; s /= 100; v /= 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const PRESETS = ['#FFFFFF', '#FFD166', '#FF5E5B', '#E63946', '#FF6B9D', '#B983FF', '#5E60CE', '#48BFE3', '#64DFDF', '#80ED99', '#FAF3A0', '#FF9F1C'];

function ColorPicker({ color, onChange }) {
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const [dragSV, setDragSV] = useState(false);
  const [dragHue, setDragHue] = useState(false);
  const { h, s, v } = color;

  const setSV = (clientX, clientY) => {
    const r = svRef.current.getBoundingClientRect();
    const sx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const sy = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    onChange({ ...color, s: Math.round(sx * 100), v: Math.round((1 - sy) * 100) });
  };
  const setHue = (clientX) => {
    const r = hueRef.current.getBoundingClientRect();
    const hx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange({ ...color, h: Math.round(hx * 360) });
  };

  useEffect(() => {
    if (!dragSV && !dragHue) return;
    const move = (e) => dragSV ? setSV(e.clientX, e.clientY) : setHue(e.clientX);
    const up = () => { setDragSV(false); setDragHue(false); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const [r, g, b] = hsvToRgb(h, s, v);
  const hex = rgbToHex(r, g, b);

  return (
    <div className="cp-wrap">
      <div
        ref={svRef}
        className="cp-hsv"
        onPointerDown={(e) => { setDragSV(true); setSV(e.clientX, e.clientY); }}
        style={{
          background:
            `linear-gradient(to top, oklch(0 0 0), transparent),
             linear-gradient(to right, oklch(1 0 0), transparent),
             oklch(0.7 0.22 ${h})`
        }}
      >
        <div className="cp-puck" style={{ left: `${s}%`, top: `${100 - v}%` }} />
      </div>
      <div
        ref={hueRef}
        className="cp-hue"
        onPointerDown={(e) => { setDragHue(true); setHue(e.clientX); }}
      >
        <div className="cp-hue-puck" style={{ left: `${(h / 360) * 100}%`, background: `hsl(${h}, 100%, 50%)` }} />
      </div>
      <div className="cp-readout">
        <div className="cp-swatch" style={{ background: hex }} />
        <div className="cp-values">
          <div><span className="k">HEX</span><span className="v">{hex}</span></div>
          <div><span className="k">RGB</span><span className="v">{r} {g} {b}</span></div>
        </div>
      </div>
      <div className="cp-presets">
        {PRESETS.map(p => (
          <div
            key={p}
            className="cp-preset"
            style={{ background: p }}
            onClick={() => {
              // rough hex→hsv
              const r = parseInt(p.slice(1,3),16)/255, g=parseInt(p.slice(3,5),16)/255, bl=parseInt(p.slice(5,7),16)/255;
              const mx=Math.max(r,g,bl), mn=Math.min(r,g,bl), d=mx-mn;
              let hh=0;
              if (d) {
                if (mx===r) hh = ((g-bl)/d) % 6;
                else if (mx===g) hh = (bl-r)/d + 2;
                else hh = (r-g)/d + 4;
                hh = Math.round(hh * 60);
                if (hh < 0) hh += 360;
              }
              const ss = mx ? Math.round((d/mx)*100) : 0;
              const vv = Math.round(mx*100);
              onChange({ h: hh, s: ss, v: vv });
            }}
          />
        ))}
      </div>
    </div>
  );
}

window.Slider = Slider;
window.Section = Section;
window.ChannelGrid = ChannelGrid;
window.ColorPicker = ColorPicker;
window.hsvToRgb = hsvToRgb;
window.rgbToHex = rgbToHex;
