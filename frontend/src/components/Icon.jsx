const I = ({ path, size = 16, stroke = 1.75, style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round"
    style={style} className={className}>
    {path}
  </svg>
)

export const Sun = (p) => <I {...p} path={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>} />
export const Moon = (p) => <I {...p} path={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>} />
export const Chevron = (p) => <I {...p} path={<path d="M6 9l6 6 6-6"/>} />
export const Plus = (p) => <I {...p} path={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />
export const X = (p) => <I {...p} path={<><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>} />
export const Check = (p) => <I {...p} path={<path d="M20 6L9 17l-5-5"/>} />
export const Undo = (p) => <I {...p} path={<><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></>} />
export const Send = (p) => <I {...p} path={<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>} />
export const Panel = (p) => <I {...p} path={<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></>} />
export const Settings = (p) => <I {...p} path={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z"/></>} />
export const Off = (p) => <I {...p} path={<><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><path d="M12 2v10"/></>} />
export const Save = (p) => <I {...p} path={<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></>} />
export const Prev = (p) => <I {...p} path={<><path d="M19 20L9 12l10-8v16z"/><path d="M5 19V5"/></>} />
export const Next = (p) => <I {...p} path={<><path d="M5 4l10 8-10 8V4z"/><path d="M19 5v14"/></>} />
export const Sparkle = (p) => <I {...p} path={<path d="M12 3l1.5 5 5 1.5-5 1.5L12 16l-1.5-5-5-1.5 5-1.5L12 3z"/>} />
export const Strobe = (p) => <I {...p} path={<><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></>} />
export const Attach = (p) => <I {...p} path={<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>} />
