import { useState, useEffect, useRef } from 'react'
import ConnectBar from './components/ConnectBar'
import AIChat from './components/AIChat'
import QuickPanel from './components/QuickPanel'
import CuePanel from './components/CuePanel'
import { api } from './api'

const AUTO = { host: '127.0.0.1', port: 30000, user: 'administrator', password: 'admin' }

const s = {
  layout: { display: 'flex', flexDirection: 'column', height: '100vh' },
  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' },
  overlay: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', flex: 1 },
  overlayCard: {
    background: '#1a1d27', borderRadius: 16, padding: '40px 48px',
    textAlign: 'center', maxWidth: 420,
  },
  spinner: {
    width: 40, height: 40, border: '4px solid #2e334d',
    borderTop: '4px solid #f0a500', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
  },
}

const styleEl = document.createElement('style')
styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
document.head.appendChild(styleEl)

export default function App() {
  const [connected, setConnected] = useState(false)
  const [autoStatus, setAutoStatus] = useState('connecting')
  const [autoError, setAutoError] = useState('')

  const [selectedFixtures, setSelectedFixtures] = useState([])
  const [cueRefreshKey, setCueRefreshKey] = useState(0)
  const wsRef = useRef(null)

  useEffect(() => {
    async function autoConnect() {
      setAutoStatus('connecting')
      const r = await api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password)
      if (r.ok) { setConnected(true); setAutoStatus('ok') }
      else { setConnected(false); setAutoStatus('error'); setAutoError(r.error || '연결 실패') }
    }
    autoConnect()
  }, [])

  useEffect(() => {
    function connectWS() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/ws/log`)
      wsRef.current = ws
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'connection') setConnected(msg.connected)
        else if (msg.type === 'bridge_status') {
          if (!msg.active) setConnected(false)
          else {
            // bridge 연결되면 자동 재연결
            api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password).then(r => {
              if (r.ok) { setConnected(true); setAutoStatus('ok') }
            })
          }
        }
      }
      ws.onclose = () => setTimeout(connectWS, 2000)
    }
    connectWS()
    return () => wsRef.current?.close()
  }, [])

  async function handleRetry() {
    setAutoStatus('connecting')
    setAutoError('')
    const r = await api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password)
    if (r.ok) { setConnected(true); setAutoStatus('ok') }
    else { setAutoStatus('error'); setAutoError(r.error || '연결 실패') }
  }

  function handleDisconnect() { setConnected(false); setAutoStatus('error') }

  let overlayContent = null
  if (autoStatus === 'connecting') {
    overlayContent = (
      <>
        <div style={s.spinner} />
        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 8 }}>grandMA2 연결 중…</div>
        <div style={{ color: '#7a7f9a', fontSize: 'var(--font-sm)' }}>127.0.0.1:30000 에 접속하고 있습니다</div>
      </>
    )
  } else if (autoStatus === 'error') {
    const isOffline = autoError.includes('연결 실패') || autoError.includes('TCP') || autoError.includes('타임아웃')
    overlayContent = (
      <>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, marginBottom: 10, color: '#f26b6b' }}>
          grandMA2 onPC가 꺼져 있어요
        </div>
        <div style={{ color: '#a0a4bc', fontSize: 'var(--font-sm)', lineHeight: 1.9, marginBottom: 24 }}>
          {isOffline ? (
            <>grandMA2 onPC 프로그램을 먼저 실행해주세요.<br />실행 후 아래 버튼을 누르면 자동으로 연결됩니다.</>
          ) : (
            <>연결 오류: <span style={{ color: '#f26b6b' }}>{autoError}</span><br />grandMA2 onPC가 실행 중인지 확인해주세요.</>
          )}
        </div>
        <button className="btn btn-primary" onClick={handleRetry} style={{ fontSize: 'var(--font-md)', padding: '12px 32px' }}>
          다시 연결 시도
        </button>
      </>
    )
  }

  return (
    <div style={s.layout}>
      <ConnectBar connected={connected} onDisconnect={handleDisconnect} onRetry={handleRetry} autoInfo={AUTO} autoStatus={autoStatus} />

      <div style={s.main}>
        {!connected ? (
          <div style={s.overlay}>
            <div style={s.overlayCard}>{overlayContent}</div>
          </div>
        ) : (
          <>
            <QuickPanel fixtures={selectedFixtures} onFixturesChange={setSelectedFixtures} onCueStored={() => setCueRefreshKey(k => k + 1)} />
            <CuePanel refreshKey={cueRefreshKey} />
            <AIChat connected={connected} />
          </>
        )}
      </div>

    </div>
  )
}
