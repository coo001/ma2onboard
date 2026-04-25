import { useState, useEffect, useRef, useCallback } from 'react'
import ConnectBar from './components/ConnectBar'
import AIChat from './components/AIChat'
import QuickPanel from './components/QuickPanel'
import CuePanel from './components/CuePanel'
import BulkEditModal from './components/BulkEditModal'
import { api } from './api'

const AUTO = { host: '127.0.0.1', port: 30000, user: 'administrator', password: 'admin' }

export default function App() {
  const [theme, setTheme] = useState('dark')
  const [connected, setConnected] = useState(false)
  const [autoStatus, setAutoStatus] = useState('connecting')
  const [autoError, setAutoError] = useState('')
  const [cueRefreshKey, setCueRefreshKey] = useState(0)
  const [presetRefreshKey, setPresetRefreshKey] = useState(0)
  const [bulkEditCueNumbers, setBulkEditCueNumbers] = useState(null)
  const [cues, setCues] = useState([])
  const [activePresetIds, setActivePresetIds] = useState({ colorPresetId: null, positionPresetId: null })
  const handlePresetSelect = useCallback((ids) => {
    setActivePresetIds(ids)
  }, [])
  const [aiOpen, setAiOpen] = useState(true)
  const [toast, setToast] = useState(null)
  const wsRef = useRef(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 1600)
  }

  useEffect(() => {
    async function autoConnect() {
      setAutoStatus('connecting')
      const r = await api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password)
      if (r.ok) {
        setConnected(true); setAutoStatus('ok')
        api.syncCues().catch(() => {}).then(() => setCueRefreshKey(k => k + 1))
      } else {
        setConnected(false); setAutoStatus('error'); setAutoError(r.error || '연결 실패')
      }
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
            api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password).then(r => {
              if (r.ok) {
                setConnected(true); setAutoStatus('ok')
                api.syncCues().catch(() => {}).then(() => setCueRefreshKey(k => k + 1))
              }
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
    setAutoStatus('connecting'); setAutoError('')
    const r = await api.connect(AUTO.host, AUTO.port, AUTO.user, AUTO.password)
    if (r.ok) {
      setConnected(true); setAutoStatus('ok')
      api.syncCues().catch(() => {}).then(() => setCueRefreshKey(k => k + 1))
    } else {
      setAutoStatus('error'); setAutoError(r.error || '연결 실패')
    }
  }

  function handleDisconnect() { setConnected(false); setAutoStatus('error') }

  return (
    <div className="console" data-theme={theme}>
      <ConnectBar
        connected={connected}
        autoStatus={autoStatus}
        autoInfo={AUTO}
        theme={theme}
        onThemeChange={setTheme}
        onRetry={handleRetry}
        onDisconnect={handleDisconnect}
        onToast={showToast}
      />

      {!connected ? (
        <div className="overlay-wrap">
          <div className="overlay-card">
            {autoStatus === 'connecting' ? (
              <>
                <div className="overlay-spinner" />
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
                  grandMA2 연결 중
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {AUTO.host}:{AUTO.port}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: 'var(--status-danger)', letterSpacing: '-0.02em' }}>
                  grandMA2 onPC 미연결
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
                  {autoError.includes('연결 실패') || autoError.includes('TCP') || autoError.includes('타임아웃') || autoError.includes('refused')
                    ? <>grandMA2 onPC를 먼저 실행하세요.<br />실행 후 아래 버튼으로 재연결합니다.</>
                    : <>
                        연결 오류:{' '}
                        <span style={{ color: 'var(--status-danger)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {autoError.split(/[\n|]/)[0].trim().slice(0, 100)}
                        </span>
                      </>
                  }
                </div>
                <button className="btn primary" onClick={handleRetry} style={{ height: 38, padding: '0 28px' }}>
                  다시 연결
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={`workspace${aiOpen ? '' : ' ai-collapsed'}`}>
          <QuickPanel
            onCueStored={() => setCueRefreshKey(k => k + 1)}
            onToast={showToast}
            cues={cues}
            onPresetSelect={handlePresetSelect}
            presetRefreshKey={presetRefreshKey}
          />
          <CuePanel
            refreshKey={cueRefreshKey}
            onBulkEdit={setBulkEditCueNumbers}
            onToast={showToast}
            onCuesLoaded={setCues}
          />
          <AIChat
            connected={connected}
            aiOpen={aiOpen}
            onToggle={() => setAiOpen(o => !o)}
            onCueImported={() => setCueRefreshKey(k => k + 1)}
            onPresetsCreated={() => setPresetRefreshKey(k => k + 1)}
          />
        </div>
      )}

      {bulkEditCueNumbers && (
        <BulkEditModal
          cueNumbers={bulkEditCueNumbers}
          onClose={() => setBulkEditCueNumbers(null)}
          onSaved={() => { setBulkEditCueNumbers(null); setCueRefreshKey(k => k + 1) }}
          colorPresetId={activePresetIds.colorPresetId}
          positionPresetId={activePresetIds.positionPresetId}
        />
      )}

      {toast && <div className="toast-wrap">{toast}</div>}
    </div>
  )
}
