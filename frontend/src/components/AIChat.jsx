import { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import GroupPanel from './GroupPanel'

const EXAMPLES = [
  '1번 조명 최대 밝기로 켜줘',
  '2번, 3번 조명 빨간색으로 설정해줘',
  '1번 조명 조도 80 색상 파란색 포커스 다 풀고',
  '지금보다 조명 조금 위쪽으로 향하게 해',
  '지금 장면 큐 1번으로 저장해줘',
  '전체 끄기',
]

const s = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '24px 40px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  bubble: (role) => ({
    maxWidth: role === 'user' ? '72%' : '88%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? '#f0a500'
      : role === 'error' ? '#2a0a0a'
      : role === 'system' ? '#13151f'
      : '#1a1d27',
    color: role === 'user' ? '#000'
      : role === 'error' ? '#f26b6b'
      : '#e8eaf0',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
    padding: '12px 16px',
    fontSize: 14,
    lineHeight: 1.65,
    border: role === 'error' ? '1px solid #3a0a0a'
      : role === 'system' ? '1px solid #2e334d'
      : 'none',
    whiteSpace: 'pre-wrap',
  }),
  actions: {
    marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  actionTag: {
    background: '#0d2a1a', border: '1px solid #1a4a2a',
    color: '#3ddc84', fontSize: 11, padding: '3px 8px',
    borderRadius: 6, fontFamily: 'monospace',
  },
  loading: {
    alignSelf: 'flex-start', color: '#7a7f9a', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
  },
  dot: (delay) => ({
    width: 6, height: 6, borderRadius: '50%', background: '#f0a500',
    animation: 'bounce 1s infinite',
    animationDelay: delay,
  }),
  examplesWrap: {
    padding: '0 40px 10px',
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  exLabel: { fontSize: 11, color: '#5a5f7a', marginBottom: 4, paddingLeft: 40 },
  exBtn: {
    padding: '5px 12px', borderRadius: 20,
    background: '#1a1d27', border: '1px solid #2e334d',
    color: '#7a7f9a', fontSize: 12, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'border-color .15s, color .15s',
  },
  inputRow: {
    padding: '10px 40px 14px',
    borderTop: '1px solid #2e334d',
    display: 'flex', gap: 10, alignItems: 'flex-end',
    background: '#13151f',
  },
  textarea: {
    flex: 1, background: '#1a1d27', border: '2px solid #2e334d',
    borderRadius: 12, color: '#e8eaf0', fontSize: 14,
    padding: '10px 14px', resize: 'none', lineHeight: 1.5,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s',
  },
  sendBtn: (disabled) => ({
    padding: '10px 22px', borderRadius: 10, border: 'none',
    background: disabled ? '#2e334d' : '#f0a500',
    color: disabled ? '#5a5f7a' : '#000',
    fontWeight: 800, fontSize: 14, cursor: disabled ? 'default' : 'pointer',
    flexShrink: 0, transition: 'background .15s',
  }),
}

const styleEl = document.createElement('style')
styleEl.textContent = `@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`
document.head.appendChild(styleEl)

let _msgId = 0
const mkId = () => ++_msgId

export default function AIChat({ connected }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([{
    id: mkId(), role: 'system',
    text: '안녕하세요! 조명 설정을 자유롭게 말씀해주세요.\n예시: "1번 조명 조도 100 빨간색으로 켜줘"',
  }])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading || !connected) return
    setInput('')
    setMessages(prev => [...prev, { id: mkId(), role: 'user', text }])
    setLoading(true)

    const r = await api.aiCommand(text)
    setLoading(false)

    if (r.ok === false) {
      setMessages(prev => [...prev, { id: mkId(), role: 'error', text: r.error || '오류가 발생했습니다.' }])
    } else {
      setMessages(prev => [...prev, {
        id: mkId(), role: 'ai',
        text: r.explanation || '완료됐습니다.',
        actions: r.actions || [],
      }])
    }
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const canSend = connected && !loading && input.trim().length > 0

  function insertGroup(groupName) {
    setInput(prev => prev ? `${prev} ${groupName}` : groupName)
    inputRef.current?.focus()
  }

  return (
    <div style={s.wrap}>
      <GroupPanel onInsert={insertGroup} />
      <div style={s.messages}>
        {messages.map(msg => (
          <div key={msg.id} style={s.bubble(msg.role)}>
            <div>{msg.text}</div>
            {msg.actions?.length > 0 && (
              <div style={s.actions}>
                {msg.actions.map((a, i) => <span key={i} style={s.actionTag}>{a}</span>)}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={s.loading}>
            <span style={s.dot('0s')} />
            <span style={s.dot('.2s')} />
            <span style={s.dot('.4s')} />
            <span>AI가 명령을 처리하고 있습니다…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={s.exLabel}>예시 명령어</div>
      <div style={s.examplesWrap}>
        {EXAMPLES.map(ex => (
          <button key={ex} style={s.exBtn}
            onClick={() => { setInput(ex); inputRef.current?.focus() }}
            disabled={!connected}>
            {ex}
          </button>
        ))}
      </div>

      <div style={s.inputRow}>
        <textarea
          ref={inputRef}
          style={s.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={connected ? '조명 명령을 입력하세요… (Enter로 전송, Shift+Enter 줄바꿈)' : 'grandMA2에 연결되어야 사용할 수 있습니다'}
          disabled={!connected || loading}
          rows={2}
        />
        <button style={s.sendBtn(!canSend)} onClick={send} disabled={!canSend}>
          전송
        </button>
      </div>
    </div>
  )
}
