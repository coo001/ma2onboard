import { useState } from 'react'
import { api } from '../api'

const styles = {
  wrap: { padding: '32px 40px' },
  stepBadge: {
    display: 'inline-block',
    background: '#f0a500',
    color: '#000',
    fontWeight: 800,
    fontSize: 12,
    padding: '2px 10px',
    borderRadius: 20,
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 900, marginBottom: 8 },
  subtitle: { color: '#a0a4bc', marginBottom: 24, lineHeight: 1.7 },
  guide: {
    background: '#142019',
    border: '1px solid #294133',
    borderRadius: 12,
    padding: '16px 18px',
    marginBottom: 16,
    color: '#b4d9c0',
    lineHeight: 1.8,
  },
  guideTitle: { color: '#3ddc84', fontWeight: 800, marginBottom: 6 },
  topActions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  grid: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 },
  card: (selected) => ({
    width: 84,
    height: 84,
    borderRadius: 14,
    border: `2px solid ${selected ? '#f0a500' : '#2e334d'}`,
    background: selected ? '#2a2000' : '#1a1d27',
    color: selected ? '#f0a500' : '#e8eaf0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    boxShadow: selected ? '0 0 0 2px rgba(240,165,0,.2)' : 'none',
  }),
  cardNum: { fontSize: 24, fontWeight: 900 },
  cardLabel: { fontSize: 11, color: '#7a7f9a', marginTop: 3 },
  selected: { fontSize: 15, marginBottom: 14, color: '#a0a4bc' },
  selectedNums: { color: '#f0a500', fontWeight: 800 },
  err: { color: '#f26b6b', fontSize: 13, marginBottom: 12 },
}

export default function Step1Fixtures({ onNext }) {
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggle(number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  async function handleNext() {
    if (selected.size === 0) {
      setError('최소 1개의 조명을 선택해 주세요.')
      return
    }

    setLoading(true)
    setError('')

    const fixtures = Array.from(selected).sort((a, b) => a - b)
    const result = await api.selectFixtures(fixtures)

    setLoading(false)

    if (result.ok === false) {
      setError(result.error || '조명 선택 명령 전송에 실패했습니다.')
      return
    }

    onNext({ fixtures })
  }

  const sorted = Array.from(selected).sort((a, b) => a - b)

  return (
    <div style={styles.wrap}>
      <div style={styles.stepBadge}>1 / 4 단계</div>
      <div style={styles.title}>어떤 조명을 선택할지 먼저 고르세요</div>
      <div style={styles.subtitle}>
        실제 콘솔에서는 먼저 Fixture를 선택한 뒤 밝기와 색을 만집니다. 여기서 고른 조명만 다음 단계의 명령을 받습니다.
      </div>

      <div style={styles.guide}>
        <div style={styles.guideTitle}>이 단계에서 하는 일</div>
        무대에서 사용할 조명 번호를 클릭해서 고릅니다. 여러 개를 한 번에 골라도 됩니다.
        <br />
        시작 전에 grandMA2 onPC에서 아래 설정을 반드시 확인하세요.
        <br />
        <code>Setup -&gt; Global Setting -&gt; Telnet -&gt; Login Enabled</code>
      </div>

      <div style={styles.topActions}>
        <button className="btn btn-primary" onClick={handleNext} disabled={loading || selected.size === 0}>
          {loading ? '콘솔에 보내는 중...' : '다음'}
        </button>
      </div>

      <div style={styles.row}>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))}>
          1~10 전체 선택
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
          선택 비우기
        </button>
      </div>

      <div style={styles.grid}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
          <div key={number} style={styles.card(selected.has(number))} onClick={() => toggle(number)}>
            <div style={styles.cardNum}>{number}</div>
            <div style={styles.cardLabel}>Fixture</div>
          </div>
        ))}
      </div>

      <div style={styles.selected}>
        선택한 조명:{' '}
        {sorted.length > 0 ? (
          <span style={styles.selectedNums}>
            {sorted.join(', ')}번 ({sorted.length}대)
          </span>
        ) : (
          '아직 없음'
        )}
      </div>

      {error && <div style={styles.err}>{error}</div>}
    </div>
  )
}
