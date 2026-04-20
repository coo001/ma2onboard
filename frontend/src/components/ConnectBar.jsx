const styles = {
  bar: (connected, connecting) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 24px',
    background: connecting ? '#1a1a10' : connected ? '#1a1d27' : '#1f1214',
    borderBottom: `2px solid ${connecting ? '#a08020' : connected ? '#2e334d' : '#6b1a1a'}`,
    transition: 'background .3s ease, border-color .3s ease',
  }),
  title: { fontWeight: 900, fontSize: 18, color: '#f0a500' },
  subtitle: { fontSize: 12, color: '#7a7f9a', marginTop: 2 },
  spacer: { flex: 1 },
  statusBadge: (connected, connecting) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px',
    borderRadius: 20,
    background: connecting ? 'rgba(240,165,0,.12)' : connected ? 'rgba(61,220,132,.1)' : 'rgba(242,107,107,.12)',
    border: `1px solid ${connecting ? 'rgba(240,165,0,.3)' : connected ? 'rgba(61,220,132,.3)' : 'rgba(242,107,107,.3)'}`,
    fontSize: 13,
    fontWeight: 700,
  }),
  dot: (connected, connecting) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: connecting ? '#f0a500' : connected ? '#3ddc84' : '#f26b6b',
    animation: connecting ? 'pulse 1.2s ease-in-out infinite' : 'none',
  }),
  statusText: (connected, connecting) => ({
    color: connecting ? '#f0a500' : connected ? '#3ddc84' : '#f26b6b',
  }),
  info: { fontSize: 12, color: '#a0a4bc' },
}

export default function ConnectBar({ connected, onDisconnect, onRetry, autoInfo, autoStatus }) {
  const connecting = autoStatus === 'connecting'

  return (
    <div style={styles.bar(connected, connecting)}>
      <div>
        <div style={styles.title}>grandMA2 온보딩</div>
        <div style={styles.subtitle}>신입생이 첫 큐를 직접 만들어보는 연습 화면</div>
      </div>

      <div style={styles.spacer} />

      <div style={styles.statusBadge(connected, connecting)}>
        <span style={styles.dot(connected, connecting)} className={connecting ? 'dot-pulse' : ''} />
        <span style={styles.statusText(connected, connecting)}>
          {connecting ? '연결 중...' : connected ? '콘솔 연결됨' : '콘솔 미연결'}
        </span>
      </div>

      <span style={styles.info}>
        {autoInfo?.host}:{autoInfo?.port} / {autoInfo?.user}
      </span>

      {connected ? (
        <button className="btn btn-secondary btn-sm" onClick={onDisconnect}>
          연결 끊기
        </button>
      ) : !connecting && (
        <button className="btn btn-primary btn-sm" onClick={onRetry}>
          재연결
        </button>
      )}
    </div>
  )
}
