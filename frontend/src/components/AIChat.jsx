import { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import { Send, Panel, Attach } from './Icon'

const EXAMPLES = [
  '1번 조명 파란색 밝게 켜줘',
  '2번, 3번 조명 빨간색으로',
  '1,3,5번 스트로브 효과',
  '현재 상태 큐 1번에 저장',
  '전체 끄기',
]

let _id = 0
const mkId = () => ++_id

export default function AIChat({ connected, aiOpen, onToggle, onCueImported }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([{
    id: mkId(), role: 'assistant',
    text: '안녕하세요! 조명 명령을 입력하거나 📎 버튼으로 엑셀 큐시트를 올려주세요.',
  }])
  const [loading, setLoading] = useState(false)
  const [excelSession, setExcelSession] = useState(null)
  const [excelFile, setExcelFile] = useState(null)
  const [excelResolved, setExcelResolved] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function addMsg(role, text, extra = {}) {
    setMessages(prev => [...prev, { id: mkId(), role, text, ...extra }])
  }

  function cancelExcel() {
    setExcelSession(null); setExcelFile(null); setExcelResolved(false)
    addMsg('system-msg', '엑셀 가져오기를 취소했습니다.')
  }

  async function handleApply() {
    if (!excelSession) return
    setLoading(true)
    const r = excelSession.sessionId
      ? await api.applyCueSession(excelSession.sessionId, 'skip')
      : await api.importCuesExcel(excelFile, false, 'skip')
    setLoading(false)
    const count = r.results?.filter(x => x.ok).length ?? '?'
    if (r.ok !== false) {
      addMsg('system-msg', `✓ ${count}개 큐가 저장됐습니다.`)
      onCueImported?.()
    } else {
      addMsg('error-msg', r.error || '저장 실패')
    }
    setExcelSession(null); setExcelFile(null); setExcelResolved(false)
  }

  async function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) { addMsg('error-msg', '.xlsx 파일만 지원합니다.'); return }
    setExcelFile(file); setExcelSession(null); setExcelResolved(false)
    addMsg('user', `📎 ${file.name}`)
    addMsg('system-msg', '파일을 분석하고 있습니다…')
    setLoading(true)
    const r = await api.importCuesExcel(file, true, 'skip')
    setLoading(false)
    if (r.ok === false) { addMsg('error-msg', r.error || '파일 분석 실패'); return }
    if (r.session_id) {
      setExcelSession({ sessionId: r.session_id, filename: file.name })
      addMsg('assistant', r.question || `분석 완료. 누락 정보 ${r.issues_count || 0}건을 대화로 채웁니다.`)
    } else {
      setExcelSession({ sessionId: null, filename: file.name })
      setExcelResolved(true)
      addMsg('confirm-msg', `📊 ${file.name}: ${r.valid_rows || 0}개 큐 분석 완료. 저장할까요?`)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || !connected) return
    setInput('')
    addMsg('user', text)
    setLoading(true)

    if (excelSession?.sessionId && !excelResolved) {
      const r = await api.completeCueChat(excelSession.sessionId, text)
      setLoading(false)
      if (r.ok === false) addMsg('error-msg', r.error || '처리 실패')
      else {
        if (r.next_question) addMsg('assistant', r.next_question)
        if (r.all_resolved) {
          setExcelResolved(true)
          addMsg('confirm-msg', `모든 정보가 채워졌습니다. ${excelSession.filename}의 큐를 저장할까요?`)
        }
      }
    } else {
      const r = await api.aiCommand(text)
      setLoading(false)
      if (r.ok === false) addMsg('error-msg', r.error || '처리 실패')
      else {
        addMsg('assistant', r.explanation || '완료됐습니다.', { actions: r.actions || [] })
      }
    }
    inputRef.current?.focus()
  }

  if (!aiOpen) {
    return (
      <div className="col">
        <div className="ai-panel collapsed">
          <button className="icon-btn" onClick={onToggle} title="AI 어시스턴트 열기">
            <Panel size={16} />
          </button>
          <div className="ai-collapsed-rail">
            <div style={{ fontSize: 10, color: 'var(--text-dim)', writingMode: 'vertical-rl', letterSpacing: '0.1em', marginTop: 8 }}>
              AI
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="col"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
      style={{ position: 'relative' }}
    >
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'oklch(0.72 0.16 220 / 0.06)',
          border: '2px dashed var(--status-live)', borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ color: 'var(--status-live)', fontSize: 15, fontWeight: 600 }}>
            📊 엑셀 파일을 여기에 놓으세요
          </span>
        </div>
      )}

      <div className="ai-panel">
        {/* Header */}
        <div className="ai-header">
          <div className="ai-title">
            <div className="ai-avatar">AI</div>
            <span>어시스턴트</span>
          </div>
          {excelSession && !excelResolved && (
            <span style={{ fontSize: 11, color: 'var(--status-live)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
              엑셀 대화 중
            </span>
          )}
          <div className="grow" />
          <button className="icon-btn" onClick={onToggle} title="접기">
            <Panel size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-msg ${msg.role}`}>
              <div>{msg.text}</div>
              {msg.actions?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {msg.actions.map((a, i) => (
                    <span key={i} style={{
                      background: 'var(--status-active-soft)', border: '1px solid oklch(0.72 0.15 145 / 0.3)',
                      color: 'var(--status-active)', fontSize: 11, padding: '2px 7px',
                      borderRadius: 4, fontFamily: 'var(--font-mono)',
                    }}>{a}</span>
                  ))}
                </div>
              )}
              {msg.role === 'confirm-msg' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  <button className="btn sm primary" onClick={handleApply} disabled={loading}>
                    {loading ? '저장 중…' : '저장하기'}
                  </button>
                  <button className="btn sm ghost" onClick={cancelExcel}>취소</button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '6px 0', color: 'var(--text-dim)', fontSize: 13 }}>
              {[0, 0.18, 0.36].map((d, i) => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block',
                  animation: `bounce 1s ${d}s infinite`,
                }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Example chips */}
        {!excelSession && (
          <div className="ai-chips">
            {EXAMPLES.map(ex => (
              <button key={ex} className="ai-chip"
                onClick={() => { setInput(ex); inputRef.current?.focus() }}
                disabled={!connected}>
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Excel session cancel bar */}
        {excelSession && !excelResolved && (
          <div className="ai-session-bar">
            <span>📊 {excelSession.filename}</span>
            <div className="grow" />
            <button className="btn sm ghost" onClick={cancelExcel}>취소</button>
          </div>
        )}

        {/* Input */}
        <div className="ai-input-wrap">
          <button className="ai-attach" title="엑셀 큐시트 업로드"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || loading}>
            <Attach size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />

          <textarea
            ref={inputRef}
            className="ai-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={
              !connected ? 'grandMA2에 연결되어야 합니다' :
              excelSession && !excelResolved ? '누락 정보를 입력하세요…' :
              '명령 또는 질문을 입력하세요… (Enter 전송)'
            }
            disabled={!connected || loading}
            rows={2}
          />
          <button className="ai-send" onClick={send}
            disabled={!connected || loading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
