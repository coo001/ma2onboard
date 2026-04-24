// Inline stroke icons (Lucide-style, hand-tuned).
const I = ({ path, size = 16, stroke = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const Icon = {
  Sun: (p) => <I {...p} path={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>} />,
  Moon: (p) => <I {...p} path={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>} />,
  Chevron: (p) => <I {...p} path={<path d="M6 9l6 6 6-6"/>} />,
  Play: (p) => <I {...p} path={<path d="M6 4l14 8-14 8V4z"/>} />,
  Plus: (p) => <I {...p} path={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />,
  X: (p) => <I {...p} path={<><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>} />,
  Check: (p) => <I {...p} path={<path d="M20 6L9 17l-5-5"/>} />,
  Undo: (p) => <I {...p} path={<><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></>} />,
  Send: (p) => <I {...p} path={<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>} />,
  Panel: (p) => <I {...p} path={<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></>} />,
  Settings: (p) => <I {...p} path={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />,
  Wifi: (p) => <I {...p} path={<><path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="0.5"/></>} />,
  Sparkle: (p) => <I {...p} path={<path d="M12 3l1.5 5 5 1.5-5 1.5L12 16l-1.5-5-5-1.5 5-1.5L12 3zM18 14l.75 2.5L21 17l-2.25.5L18 20l-.75-2.5L15 17l2.25-.5L18 14z"/>} />,
  Lightning: (p) => <I {...p} path={<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>} />,
  Strobe: (p) => <I {...p} path={<><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></>} />,
  Off: (p) => <I {...p} path={<><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><path d="M12 2v10"/></>} />,
  Save: (p) => <I {...p} path={<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></>} />,
  Prev: (p) => <I {...p} path={<><path d="M19 20L9 12l10-8v16zM5 19V5"/></>} />,
  Next: (p) => <I {...p} path={<><path d="M5 4l10 8-10 8V4zM19 5v14"/></>} />,
  Target: (p) => <I {...p} path={<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>} />,
  Mic: (p) => <I {...p} path={<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/></>} />,
};

window.Icon = Icon;
