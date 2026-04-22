import { useState, useEffect, useRef } from 'react'
import ConnectBar from './components/ConnectBar'
import AIChat from './components/AIChat'
import QuickPanel from './components/QuickPanel'
import CuePanel from './components/CuePanel'
import Step1Fixtures from './components/Step1Fixtures'
import Step2IntensityColor from './components/Step2IntensityColor'
import Step3Position from './components/Step3Position'
import Step3Effect from './components/Step3Effect'
import Step4StoreCue from './components/Step4StoreCue'
import ImportCuePanel from './components/ImportCuePanel'
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
  const [wizardMode, setWizardMode] = useState(false)
  const [importMode, setImportMode] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState({})
  const wsRef = useRef(null)

  function wizardAdvance(partial) {
    setWizardData(prev => ({ ...prev, ...partial }))
    setWizardStep(s => s + 1)
  }
  function wizardBack() { setWizardStep(s => Math.max(1, s - 1)) }
  function wizardReset() { setWizardStep(1); setWizardData({}); setWizardMode(false) }

  useEffect(() => {
    async function autoConnect() {
      setAutoStatus('connecting')
      const r = await api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password)
      if (r.ok) { setConnected(true); setAutoStatus('ok'); api.syncCues().catch(() => {}).then(() => setCueRefreshKey(k => k + 1)) }
      else { setConnected(false); setAutoStatus('error'); setAutoError(r.error || '연결 실패') }
    }
    autoConnect()
  }, [])

  useEffect(() => {
    function connectWS() {
      let cancelled = false
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
              if (r.ok) { setConnected(true); setAutoStatus('ok'); api.syncCues().catch(() => {}).then(() => setCueRefreshKey(k => k + 1)) }
            })
          }
        }
      }
      ws.onclose = () => { if (!cancelled) setTimeout(connectWS, 2000) }
      return () => { cancelled = true; ws.close() }
    }
    const cleanup = connectWS()
    return cleanup
  }, [])

  async function handleRetry() {
    setAutoStatus('connecting')
    setAutoError('')
    const r = await api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password)
    if (r.ok) {
      setConnected(true); setAutoStatus('ok')
      api.syncCues().catch(() => {}).then(() => setCueRefreshKey(k => k + 1))
    }
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
        ) : importMode ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '8px 16px', background: '#1a1d27', borderBottom: '1px solid #2e334d', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#7a7f9a' }}>엑셀 가져오기</span>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setImportMode(false)}>
                빠른 조작으로 돌아가기
              </button>
            </div>
            <ImportCuePanel
              onClose={() => setImportMode(false)}
              onImported={() => { setCueRefreshKey(k => k + 1); setImportMode(false) }}
            />
          </div>
        ) : wizardMode ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '8px 16px', background: '#1a1d27', borderBottom: '1px solid #2e334d', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#7a7f9a' }}>마법사 모드</span>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={wizardReset}>
                빠른 조작으로 돌아가기
              </button>
            </div>
            {wizardStep === 1 && <Step1Fixtures onNext={wizardAdvance} />}
            {wizardStep === 2 && <Step2IntensityColor data={wizardData} onNext={wizardAdvance} onBack={wizardBack} />}
            {wizardStep === 3 && <Step3Position data={wizardData} onNext={wizardAdvance} onBack={wizardBack} />}
            {wizardStep === 4 && <Step3Effect data={wizardData} onNext={wizardAdvance} onBack={wizardBack} />}
            {wizardStep === 5 && <Step4StoreCue data={wizardData} onBack={wizardBack} onReset={wizardReset} />}
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0 }}>
              <QuickPanel fixtures={selectedFixtures} onFixturesChange={setSelectedFixtures} onCueStored={() => setCueRefreshKey(k => k + 1)} />
              <button
                className="btn btn-secondary"
                style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '3px 10px', opacity: 0.7 }}
                onClick={() => { setWizardMode(true); setWizardStep(1); setWizardData({}) }}
              >
                마법사 모드
              </button>
              <button
                className="btn btn-secondary"
                style={{ position: 'absolute', top: 8, right: 96, fontSize: 11, padding: '3px 10px', opacity: 0.7 }}
                onClick={() => setImportMode(true)}
              >
                엑셀 가져오기
              </button>
            </div>
            <CuePanel refreshKey={cueRefreshKey} />
            <AIChat connected={connected} />
          </>
        )}
      </div>

    </div>
  )
}
