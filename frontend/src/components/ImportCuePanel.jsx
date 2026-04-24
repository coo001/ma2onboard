import { useState, useRef, useEffect } from 'react'
import { api } from '../api'

const s = {
  wrap: { padding: '32px 40px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 900 },
  guide: {
    background: '#142019', border: '1px solid #294133', borderRadius: 12,
    padding: '16px 18px', marginBottom: 20, color: '#b4d9c0', lineHeight: 1.8,
  },
  guideTitle: { color: '#3ddc84', fontWeight: 800, marginBottom: 6 },
  section: {
    background: '#1a1d27', border: '1px solid #2e334d', borderRadius: 14,
    padding: '20px 24px', marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 800, marginBottom: 12 },
  dropzone: (dragOver) => ({
    border: `2px dashed ${dragOver ? '#f0a500' : '#3a3f5c'}`,
    borderRadius: 12, padding: '32px 24px', textAlign: 'center',
    cursor: 'pointer', transition: 'border-color 0.2s',
    background: dragOver ? '#2a2000' : '#12141e',
  }),
  dropText: { color: '#7a7f9a', fontSize: 14, marginTop: 8 },
  fileName: { color: '#f0a500', fontWeight: 700, marginTop: 8 },
  optionRow: { display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 },
  label: { color: '#a0a4bc', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  select: {
    background: '#22263a', border: '1px solid #3a3f5c', color: '#e8eaf0',
    borderRadius: 8, padding: '4px 10px', fontSize: 13,
  },
  btnRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 },
  summaryBar: (ok) => ({
    background: ok ? '#0d2a1a' : '#2a1010',
    border: `1px solid ${ok ? '#3ddc84' : '#f26b6b'}`,
    borderRadius: 12, padding: '14px 18px', marginBottom: 16,
    color: ok ? '#7af0ac' : '#f26b6b', fontWeight: 700, fontSize: 14,
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: '#22263a', padding: '8px 10px', textAlign: 'left', color: '#7a7f9a', fontWeight: 700, borderBottom: '1px solid #2e334d' },
  td: { padding: '7px 10px', borderBottom: '1px solid #1e2130', color: '#e8eaf0', verticalAlign: 'top' },
  tdErr: { padding: '7px 10px', borderBottom: '1px solid #1e2130', color: '#f26b6b', verticalAlign: 'top' },
  badgeOk: { background: '#0d2a1a', color: '#3ddc84', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11 },
  badgeFail: { background: '#2a1010', color: '#f26b6b', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11 },
  cmdToggle: { color: '#7a7f9a', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', marginTop: 2 },
  cmdList: { color: '#5a8f7a', fontSize: 11, fontFamily: 'monospace', marginTop: 4, lineHeight: 1.6 },
  err: { color: '#f26b6b', fontSize: 13, marginTop: 8 },
  chatWrap: {
    background: '#111520', border: '1px solid #3ddc8455', borderRadius: 14,
    padding: '20px 24px', marginBottom: 16,
  },
  chatTitle: { fontSize: 15, fontWeight: 800, color: '#3ddc84', marginBottom: 4 },
  chatSub: { fontSize: 12, color: '#7a7f9a', marginBottom: 14 },
  chatLog: {
    maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14,
  },
  chatBubble: (role) => ({
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? '#1e3a2a' : '#1e2035',
    border: `1px solid ${role === 'user' ? '#3ddc8440' : '#3a3f5c'}`,
    borderRadius: 10, padding: '8px 14px', maxWidth: '80%',
    color: role === 'user' ? '#a0f0c0' : '#c8cce0', fontSize: 13, lineHeight: 1.6,
  }),
  chatInputRow: { display: 'flex', gap: 8 },
  chatInput: {
    flex: 1, background: '#1a1d27', border: '1px solid #3a3f5c', borderRadius: 8,
    color: '#e8eaf0', padding: '8px 12px', fontSize: 13, outline: 'none',
  },
  resolvedBanner: {
    background: '#0d2a1a', border: '1px solid #3ddc84', borderRadius: 10,
    padding: '12px 16px', color: '#3ddc84', fontWeight: 700, fontSize: 13, marginBottom: 12,
  },
}

export default function ImportCuePanel({ onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [onError, setOnError] = useState('skip')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [expandedRows, setExpandedRows] = useState(new Set())

  const [chatSession, setChatSession] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatResolved, setChatResolved] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  const fileInputRef = useRef(null)
  const chatLogRef = useRef(null)

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
    }
  }, [chatMessages])

  function handleFile(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      alert('.xlsx 파일만 지원합니다.')
      return
    }
    setFile(f)
    setResponse(null)
    setExpandedRows(new Set())
    setChatSession(null)
    setChatMessages([])
    setChatResolved(false)
  }

  function toggleExpand(idx) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function handlePreview() {
    if (!file) return
    setLoading(true)
    const r = await api.importCuesExcel(file, true, onError)
    setLoading(false)
    if (r.session_id) {
      setChatSession({ sessionId: r.session_id, issuesCount: r.issues_count })
      setChatMessages(r.question ? [{ role: 'assistant', text: r.question }] : [])
      setChatResolved(false)
      setResponse(null)
    } else {
      setResponse(r)
    }
  }

  async function handleExecute() {
    if (!file || !response) return
    setLoading(true)
    const r = await api.importCuesExcel(file, false, onError)
    setLoading(false)
    if (r.session_id) {
      setChatSession({ sessionId: r.session_id, issuesCount: r.issues_count })
      setChatMessages(r.question ? [{ role: 'assistant', text: r.question }] : [])
      setChatResolved(false)
      setResponse(null)
    } else {
      setResponse(r)
      if (r.ok || (r.results && r.results.some(x => x.ok))) onImported()
    }
  }

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading || !chatSession) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)
    const r = await api.completeCueChat(chatSession.sessionId, msg)
    setChatLoading(false)
    if (r.ok === false) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: `오류: ${r.error || '처리 실패'}` }])
      return
    }
    if (r.next_question) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: r.next_question }])
    }
    if (r.all_resolved) {
      setChatResolved(true)
    }
  }

  async function handleApplySession() {
    if (!chatSession) return
    setLoading(true)
    const r = await api.applyCueSession(chatSession.sessionId, onError)
    setLoading(false)
    setChatSession(null)
    setChatMessages([])
    setChatResolved(false)
    setResponse(r)
    if (r.ok || (r.results && r.results.some(x => x.ok))) onImported()
  }

  const canExecute = !loading && file && response && response.dry_run === true && (!response.errors || response.errors.length === 0)

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.title}>엑셀 큐시트 가져오기</div>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>
          닫기
        </button>
      </div>

      <div style={s.guide}>
        <div style={s.guideTitle}>사용 방법</div>
        어떤 포맷의 큐시트든 자동으로 인식합니다<br />
        .xlsx 파일을 업로드하면 AI가 구조를 분석해 grandMA2 큐로 저장합니다.<br />
        템플릿 포맷(cue·fixtures 컬럼)은 즉시 파싱되고, 그 외 포맷은 AI가 자동 분석합니다.<br />
        <a
          href={api.importTemplateUrl()}
          download="cues_template.xlsx"
          style={{ color: '#3ddc84', fontWeight: 700 }}
        >
          템플릿 다운로드
        </a>
      </div>

      {/* 파일 업로드 */}
      <div style={s.section}>
        <div style={s.sectionTitle}>파일 선택</div>
        <div
          style={s.dropzone(dragOver)}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div style={{ fontSize: 32 }}>📂</div>
          <div style={s.dropText}>클릭하거나 파일을 여기에 드래그하세요</div>
          {file && <div style={s.fileName}>{file.name}</div>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* 옵션 */}
      {!chatSession && (
        <div style={s.section}>
          <div style={s.sectionTitle}>옵션</div>
          <div style={s.optionRow}>
            <label style={s.label}>
              오류 처리:
              <select style={s.select} value={onError} onChange={e => setOnError(e.target.value)}>
                <option value="skip">오류 행 건너뛰기</option>
                <option value="abort">첫 오류에서 중단</option>
              </select>
            </label>
          </div>
          <div style={s.btnRow}>
            <button
              className="btn btn-secondary"
              onClick={handlePreview}
              disabled={loading || !file}
            >
              {loading ? '처리 중... (AI 분석 중일 수 있습니다)' : '검증 (미리보기)'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExecute}
              disabled={!canExecute}
              title={!response ? '먼저 검증을 실행하세요' : response.errors?.length > 0 ? '오류를 수정 후 실행하세요' : ''}
            >
              실제 저장
            </button>
          </div>
          {!response && <div style={{ color: '#7a7f9a', fontSize: 12, marginTop: 8 }}>먼저 검증을 실행해 결과를 확인하세요.</div>}
        </div>
      )}

      {/* AI 대화 보완 */}
      {chatSession && (
        <div style={s.chatWrap}>
          <div style={s.chatTitle}>AI 큐시트 보완</div>
          <div style={s.chatSub}>누락된 정보 {chatSession.issuesCount}건을 대화로 채웁니다.</div>

          <div style={s.chatLog} ref={chatLogRef}>
            {chatMessages.map((m, i) => (
              <div key={i} style={s.chatBubble(m.role)}>{m.text}</div>
            ))}
            {chatLoading && (
              <div style={{ ...s.chatBubble('assistant'), color: '#5a5f7a' }}>입력 중...</div>
            )}
          </div>

          {chatResolved ? (
            <>
              <div style={s.resolvedBanner}>모든 누락 정보가 채워졌습니다. 큐를 저장하시겠습니까?</div>
              <div style={s.btnRow}>
                <button
                  className="btn btn-primary"
                  onClick={handleApplySession}
                  disabled={loading}
                >
                  {loading ? '저장 중...' : 'MA2에 저장'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setChatSession(null); setChatMessages([]); setChatResolved(false) }}
                >
                  취소
                </button>
              </div>
            </>
          ) : (
            <div style={s.chatInputRow}>
              <input
                style={s.chatInput}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                placeholder="답변을 입력하세요..."
                disabled={chatLoading}
              />
              <button
                className="btn btn-primary"
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                전송
              </button>
            </div>
          )}
        </div>
      )}

      {/* 결과 */}
      {response && (
        <>
          <div style={s.summaryBar(response.ok)}>
            {response.dry_run ? '미리보기 결과' : '저장 결과'} —
            전체 {response.total_rows}행 중 유효 {response.valid_rows}행
            {response.errors?.length > 0 && ` / 오류 ${response.errors.length}행`}
            {!response.dry_run && ` / 성공 ${response.results?.filter(r => r.ok).length ?? 0}건`}
            {response.parser === 'ai' && (
              <span style={{ fontSize: '11px', color: '#888', marginLeft: 8 }}>[AI 파싱]</span>
            )}
          </div>

          {/* 검증 오류 */}
          {response.errors?.length > 0 && (
            <div style={s.section}>
              <div style={{ ...s.sectionTitle, color: '#f26b6b' }}>검증 오류 ({response.errors.length}건)</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>행</th>
                    <th style={s.th}>컬럼</th>
                    <th style={s.th}>오류 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {response.errors.map((e, i) => (
                    <tr key={i}>
                      <td style={s.tdErr}>{e.row_index}</td>
                      <td style={s.tdErr}>{e.column}</td>
                      <td style={s.tdErr}>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 행별 결과 */}
          {response.results?.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>행별 결과</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>행</th>
                    <th style={s.th}>큐번호</th>
                    <th style={s.th}>이름</th>
                    <th style={s.th}>상태</th>
                    <th style={s.th}>명령어</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.map((r, i) => (
                    <tr key={i}>
                      <td style={s.td}>{r.row_index}</td>
                      <td style={s.td}>{r.cue}</td>
                      <td style={s.td}>{r.label}</td>
                      <td style={s.td}>
                        {r.ok
                          ? <span style={s.badgeOk}>✓ 성공</span>
                          : <span style={s.badgeFail}>✗ {r.error || '실패'}</span>
                        }
                      </td>
                      <td style={s.td}>
                        <span style={s.cmdToggle} onClick={() => toggleExpand(i)}>
                          {expandedRows.has(i) ? '접기' : `명령어 ${r.commands?.length ?? 0}개`}
                        </span>
                        {expandedRows.has(i) && (
                          <div style={s.cmdList}>
                            {r.commands?.map((c, ci) => <div key={ci}>{c}</div>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
