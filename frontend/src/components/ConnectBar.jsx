import { useState } from 'react'
import { Sun, Moon, Off } from './Icon'
import { api } from '../api'

export default function ConnectBar({
  connected, autoStatus, autoInfo, theme,
  onThemeChange, onRetry, onDisconnect,
}) {
  const connecting = autoStatus === 'connecting'
  const ok = connected && autoStatus === 'ok'
  const [blacked, setBlacked] = useState(false)

  async function handleBlackout() {
    if (!ok) return
    await api.intensityColor(0, null, null, [1,2,3,4,5,6,7,8,9,10])
    setBlacked(true)
  }

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">MA</div>
        <span>grandMA2 온보딩</span>
        <span className="brand-sub">조명 콘솔</span>
      </div>

      <div className="topbar-spacer" />

      {/* BLACKOUT — 단방향 암전, 복구는 슬라이더로 */}
      <button
        className="btn sm danger"
        onClick={handleBlackout}
        disabled={!ok}
        title="전체 암전 (복구는 슬라이더)"
        style={{
          background: blacked ? 'oklch(0.45 0.22 25)' : undefined,
          boxShadow: blacked ? '0 0 0 2px oklch(0.65 0.22 25 / 0.5)' : undefined,
          fontFamily: 'var(--font-mono)',
          fontWeight: 800,
          letterSpacing: '0.06em',
          fontSize: 11,
        }}
      >
        {blacked ? '● BLACKED' : 'BLACKOUT'}
      </button>

      <div className={`pill${ok ? ' live' : connecting ? '' : ' err'}`}>
        <span className="dot" />
        <span>
          {connecting ? '연결 중…' : ok ? autoInfo.host : '미연결'}
        </span>
      </div>

      {!connecting && (
        ok
          ? <button className="btn sm ghost" onClick={onDisconnect}>
              <Off size={12} /> 끊기
            </button>
          : <button className="btn sm primary" onClick={onRetry}>
              재연결
            </button>
      )}

      <div className="theme-toggle">
        <button className={theme === 'light' ? 'active' : ''} onClick={() => onThemeChange('light')} title="라이트">
          <Sun size={13} />
        </button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => onThemeChange('dark')} title="다크">
          <Moon size={13} />
        </button>
      </div>
    </div>
  )
}
