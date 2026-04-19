import { useEffect, useRef } from 'react'

const styles = {
  panel: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    height: 190,
    background: '#0a0c14',
    borderTop: '2px solid #2e334d',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderBottom: '1px solid #1a1d27',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '.04em',
    color: '#7a7f9a',
  },
  dot: (connected) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: connected ? '#3ddc84' : '#f26b6b',
  }),
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 16px',
    fontFamily: "'Consolas', 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 1.6,
  },
  entry: (ok) => ({ color: ok ? '#e8eaf0' : '#f26b6b', marginBottom: 3 }),
  cmd: { color: '#f0a500', fontWeight: 700 },
  resp: { color: '#7a7f9a', marginLeft: 14 },
}

export default function CommandLog({ logs, connected }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.dot(connected)} />
        <span>콘솔 명령 로그</span>
        <span style={{ fontSize: 11, color: '#454b64' }}>이 아래에는 grandMA2로 실제 전송된 명령이 표시됩니다.</span>
        <span style={{ marginLeft: 'auto', color: connected ? '#3ddc84' : '#f26b6b' }}>
          {connected ? '연결됨' : '미연결'}
        </span>
      </div>

      <div style={styles.list}>
        {logs.length === 0 && (
          <div style={{ color: '#454b64' }}>버튼을 누르거나 값을 바꾸면 여기에 명령이 쌓입니다.</div>
        )}

        {logs.map((log, index) => (
          <div key={`${log.command}-${index}`} style={styles.entry(log.ok !== false)}>
            <span style={styles.cmd}>{'> '}{log.command}</span>
            {log.response && <span style={styles.resp}>{log.response}</span>}
            {log.error && <span style={{ color: '#f26b6b', marginLeft: 8 }}>[{log.error}]</span>}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
