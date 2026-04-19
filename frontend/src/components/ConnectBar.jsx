const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 24px',
    background: '#1a1d27',
    borderBottom: '1px solid #2e334d',
  },
  title: { fontWeight: 900, fontSize: 18, color: '#f0a500' },
  subtitle: { fontSize: 12, color: '#7a7f9a', marginTop: 2 },
  spacer: { flex: 1 },
  state: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
  },
  dot: (connected) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: connected ? '#3ddc84' : '#f26b6b',
  }),
  info: { fontSize: 12, color: '#a0a4bc' },
}

export default function ConnectBar({ connected, onDisconnect, autoInfo }) {
  return (
    <div style={styles.bar}>
      <div>
        <div style={styles.title}>grandMA2 온보딩</div>
        <div style={styles.subtitle}>신입생이 첫 큐를 직접 만들어보는 연습 화면</div>
      </div>

      <div style={styles.spacer} />

      <div style={styles.state}>
        <span style={styles.dot(connected)} />
        <span style={{ color: connected ? '#3ddc84' : '#f26b6b' }}>
          {connected ? '콘솔 연결됨' : '콘솔 미연결'}
        </span>
      </div>

      <span style={styles.info}>
        {autoInfo?.host}:{autoInfo?.port} / {autoInfo?.user}
      </span>

      {connected && (
        <button className="btn btn-secondary btn-sm" onClick={onDisconnect}>
          연결 끊기
        </button>
      )}
    </div>
  )
}
