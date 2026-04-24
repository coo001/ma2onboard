import { useState } from 'react'
import { Chevron } from './Icon'

export default function Section({ title, meta, defaultOpen = true, compact, children, actions }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`section${open ? '' : ' collapsed'}${compact ? ' compact' : ''}`}>
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <Chevron className="section-chevron" size={14} />
        <span className="section-title">{title}</span>
        {meta && <span className="section-meta">{meta}</span>}
        {actions && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: meta ? 8 : 'auto' }}>
            {actions}
          </div>
        )}
      </div>
      <div className="section-body">{children}</div>
    </div>
  )
}
