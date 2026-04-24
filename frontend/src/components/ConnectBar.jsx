import { Sun, Moon, Off } from './Icon'

export default function ConnectBar({
  connected, autoStatus, autoInfo, theme,
  onThemeChange, onRetry, onDisconnect,
}) {
  const connecting = autoStatus === 'connecting'
  const ok = connected && autoStatus === 'ok'

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">MA</div>
        <span>grandMA2 온보딩</span>
        <span className="brand-sub">조명 콘솔</span>
      </div>

      <div className="topbar-spacer" />

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
