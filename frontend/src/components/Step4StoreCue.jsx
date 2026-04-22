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
    lineHeight: 1.7,
  },
  guideTitle: { color: '#3ddc84', fontWeight: 800, marginBottom: 6 },
  topActions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
  cols: { display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 },
  card: {
    flex: 1,
    minWidth: 280,
    background: '#1a1d27',
    border: '1px solid #2e334d',
    borderRadius: 14,
    padding: '20px 24px',
  },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 14 },
  fixtureGrid: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  fixtureBadge: (selected, clearMode) => ({
    width: 58,
    height: 58,
    borderRadius: 12,
    border: `2px solid ${selected ? '#f26b6b' : '#f0a500'}`,
    background: selected ? '#311111' : '#2a2000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: clearMode ? 'pointer' : 'default',
    gap: 2,
  }),
  fixtureNum: (selected) => ({ fontSize: 20, fontWeight: 900, color: selected ? '#f26b6b' : '#f0a500' }),
  fixtureLabel: { fontSize: 10, color: '#7a7f9a' },
  summaryRow: { display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', fontSize: 14 },
  summaryKey: { width: 110, color: '#7a7f9a' },
  summaryValue: { color: '#e8eaf0', fontWeight: 700 },
  colorDot: (hex) => ({
    display: 'inline-block',
    width: 14,
    height: 14,
    marginRight: 8,
    borderRadius: '50%',
    background: hex || '#fff',
    border: '1px solid #2e334d',
    verticalAlign: 'middle',
  }),
  actionSection: {
    background: '#1a1d27',
    border: '1px solid #2e334d',
    borderRadius: 14,
    padding: '20px 24px',
    marginBottom: 20,
  },
  actionTitle: { fontSize: 18, fontWeight: 800, marginBottom: 6 },
  actionDesc: { color: '#7a7f9a', fontSize: 13, lineHeight: 1.7, marginBottom: 14 },
  inputRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  cueInput: {
    width: 96,
    fontSize: 24,
    fontWeight: 900,
    textAlign: 'center',
    background: '#22263a',
    border: '2px solid #f0a500',
    color: '#f0a500',
    borderRadius: 10,
    padding: '6px 0',
  },
  success: {
    background: '#0d2a1a',
    border: '1px solid #3ddc84',
    borderRadius: 12,
    padding: '16px 18px',
    marginBottom: 20,
    color: '#7af0ac',
    lineHeight: 1.7,
    fontWeight: 700,
  },
  err: { color: '#f26b6b', fontSize: 13, marginTop: 12 },
  btnRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 },
  hint: { fontSize: 12, color: '#7a7f9a', lineHeight: 1.7 },
}

export default function Step4StoreCue({ data, onBack, onReset }) {
  const [cueNum, setCueNum] = useState('1')
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [stored, setStored] = useState(false)
  const [clearMode, setClearMode] = useState(false)
  const [selectedToClear, setSelectedToClear] = useState(new Set())

  async function handleStoreCue() {
    if (!cueNum.trim()) {
      setError('큐 번호를 입력해 주세요.')
      return
    }

    setLoading('store')
    setError('')
    const result = await api.storeCue(cueNum.trim())
    setLoading('')

    if (result.ok === false) {
      setError(result.error || '큐 저장에 실패했습니다.')
      return
    }

    setStored(true)
  }

  async function handleClearAll() {
    setLoading('clearAll')
    setError('')
    const result = await api.clear()
    setLoading('')

    if (result.ok === false) {
      setError(result.error || '전체 초기화에 실패했습니다.')
      return
    }

    onReset()
  }

  async function handleClearSelected() {
    if (selectedToClear.size === 0) {
      setError('초기화할 조명을 선택해 주세요.')
      return
    }

    setLoading('clearSel')
    setError('')
    const fixtures = Array.from(selectedToClear).sort((a, b) => a - b)
    const result = await api.clearFixtures(fixtures)
    setLoading('')

    if (result.ok === false) {
      setError(result.error || '선택한 조명 초기화에 실패했습니다.')
      return
    }

    setClearMode(false)
    setSelectedToClear(new Set())
  }

  function toggleClear(number) {
    setSelectedToClear((prev) => {
      const next = new Set(prev)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  const colorHex = data.colorHex || '#ffffff'

  return (
    <div style={styles.wrap}>
      <div style={styles.stepBadge}>5 / 5 단계</div>
      <div style={styles.title}>지금 상태를 저장하고 정리하세요</div>
      <div style={styles.subtitle}>
        grandMA2 쪽 programmer도 함께 정리되도록 전체 초기화와 선택 초기화 동작을 분리했습니다.
      </div>

      <div style={styles.guide}>
        <div style={styles.guideTitle}>이 단계에서 하는 일</div>
        지금까지 만든 상태를 Cue로 저장하거나, 특정 조명만 programmer에서 빼거나, 전체 programmer를 ClearAll 할 수 있습니다.
      </div>

      <div style={styles.topActions}>
        <button className="btn btn-secondary" onClick={onBack}>
          이전
        </button>
      </div>

      <div style={styles.cols}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>현재 선택된 조명</div>
          <div style={styles.fixtureGrid}>
            {data.fixtures?.map((number) => {
              const selected = clearMode && selectedToClear.has(number)
              return (
                <div
                  key={number}
                  style={styles.fixtureBadge(selected, clearMode)}
                  onClick={() => clearMode && toggleClear(number)}
                >
                  <span style={styles.fixtureNum(selected)}>{number}</span>
                  <span style={styles.fixtureLabel}>{clearMode ? '클릭=제거' : 'Fixture'}</span>
                </div>
              )
            })}
          </div>

          {clearMode && (
            <div style={styles.hint}>
              선택된 조명: {Array.from(selectedToClear).sort((a, b) => a - b).join(', ') || '없음'}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>설정 요약</div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>밝기</span>
            <span style={styles.summaryValue}>{data.intensity}%</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>색</span>
            <span style={styles.summaryValue}>
              {data.colorRgb ? (
                <>
                  <span style={styles.colorDot(colorHex)} />
                  {colorHex.toUpperCase()}
                </>
              ) : (
                '설정 안 함'
              )}
            </span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>Pan</span>
            <span style={styles.summaryValue}>{data.pan}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>Tilt</span>
            <span style={styles.summaryValue}>{data.tilt}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>Focus</span>
            <span style={styles.summaryValue}>{data.focus}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>이펙트</span>
            <span style={styles.summaryValue}>
              {data.effect?.mode === 'strobe' && `Strobe ${data.effect.strobe}`}
              {data.effect?.mode === 'slot' && (
                  `Effect ${data.effect.slot} @ ${data.effect.value}` +
                  (data.effect.tempo != null ? ` · Tempo ${data.effect.tempo}` : '') +
                  (data.effect.high  != null ? ` · High ${data.effect.high}`  : '') +
                  (data.effect.low   != null ? ` · Low ${data.effect.low}`    : '')
              )}
              {(!data.effect || data.effect.mode === 'none') && '없음'}
            </span>
          </div>
        </div>
      </div>

      {!stored ? (
        <div style={styles.actionSection}>
          <div style={styles.actionTitle}>Cue 저장</div>
          <div style={styles.actionDesc}>
            현재 programmer 상태를 원하는 cue 번호로 저장합니다.
          </div>
          <div style={styles.inputRow}>
            <span style={{ color: '#7a7f9a' }}>큐 번호</span>
            <input
              style={styles.cueInput}
              type="text"
              value={cueNum}
              onChange={(event) => setCueNum(event.target.value)}
              placeholder="1"
            />
            <button className="btn btn-primary" onClick={handleStoreCue} disabled={loading === 'store'}>
              {loading === 'store' ? '저장 중...' : `Cue ${cueNum || '1'} 저장`}
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.success}>
          Cue {cueNum} 저장이 완료되었습니다. 필요하면 다른 번호로 한 번 더 저장할 수 있습니다.
          <div style={styles.btnRow}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStored(false)}>
              다른 번호로 다시 저장
            </button>
          </div>
        </div>
      )}

      <div style={styles.actionSection}>
        <div style={styles.actionTitle}>초기화</div>
        <div style={styles.actionDesc}>
          전체 초기화는 `ClearAll`, 특정 조명 초기화는 `Off Fixture ...` 후 `ClearSelection` 흐름으로 동작합니다.
        </div>

        {!clearMode ? (
          <div style={styles.btnRow}>
            <button className="btn btn-secondary" onClick={() => setClearMode(true)}>
              특정 조명만 초기화
            </button>
            <button className="btn btn-danger" onClick={handleClearAll} disabled={loading === 'clearAll'}>
              {loading === 'clearAll' ? '초기화 중...' : '전체 ClearAll'}
            </button>
          </div>
        ) : (
          <div style={styles.btnRow}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setClearMode(false)
                setSelectedToClear(new Set())
              }}
            >
              선택 취소
            </button>
            <button className="btn btn-danger" onClick={handleClearSelected} disabled={loading === 'clearSel'}>
              {loading === 'clearSel' ? '처리 중...' : `${selectedToClear.size}개 조명 초기화`}
            </button>
          </div>
        )}

        {error && <div style={styles.err}>{error}</div>}
      </div>
    </div>
  )
}
