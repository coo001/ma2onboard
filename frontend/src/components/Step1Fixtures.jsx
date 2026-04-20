import { useState, useEffect } from 'react'
import { api } from '../api'

const STORAGE_KEY = 'gma2_presets'

function loadPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function savePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // 시크릿 모드 등 localStorage 비활성 환경 무시
  }
}

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
  presetSection: {
    background: '#1a1d27',
    border: '1px solid #2e334d',
    borderRadius: 12,
    padding: '14px 18px',
    marginBottom: 18,
  },
  presetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: 700,
    color: '#a0a4bc',
  },
  presetList: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  presetItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#22263a',
    border: '1px solid #2e334d',
    borderRadius: 8,
    overflow: 'hidden',
  },
  presetLoad: {
    padding: '5px 10px',
    background: 'transparent',
    color: '#e8eaf0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  },
  presetDel: {
    padding: '5px 8px',
    background: 'transparent',
    color: '#7a7f9a',
    fontSize: 12,
    cursor: 'pointer',
    border: 'none',
    borderLeft: '1px solid #2e334d',
  },
  saveRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 },
  nameInput: {
    flex: 1,
    maxWidth: 180,
    fontSize: 13,
    padding: '5px 10px',
    background: '#22263a',
    border: '1px solid #2e334d',
    borderRadius: 8,
    color: '#e8eaf0',
  },
}

export default function Step1Fixtures({ onNext }) {
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [presets, setPresets] = useState(loadPresets)
  const [savingName, setSavingName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  useEffect(() => {
    savePresets(presets)
  }, [presets])

  function toggle(number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  function handleSavePreset() {
    const name = savingName.trim()
    if (!name || selected.size === 0) return
    const fixtures = Array.from(selected).sort((a, b) => a - b)
    setPresets((prev) => [...prev.slice(-7), { name, fixtures }])
    setSavingName('')
    setShowSaveInput(false)
  }

  function handleLoadPreset(preset) {
    setSelected(new Set(preset.fixtures))
  }

  function handleDeletePreset(index) {
    setPresets((prev) => prev.filter((_, i) => i !== index))
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

      <div style={styles.presetSection}>
        <div style={styles.presetHeader}>
          저장된 프리셋
          {selected.size > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowSaveInput((v) => !v)}
            >
              + 현재 조합 저장
            </button>
          )}
        </div>

        {showSaveInput && (
          <div style={styles.saveRow}>
            <input
              style={styles.nameInput}
              type="text"
              placeholder="프리셋 이름 (예: 메인 조명)"
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleSavePreset} disabled={!savingName.trim()}>
              저장
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowSaveInput(false); setSavingName('') }}>
              취소
            </button>
          </div>
        )}

        {presets.length === 0 ? (
          <div style={{ fontSize: 13, color: '#7a7f9a' }}>저장된 프리셋이 없습니다. 조명 조합을 선택 후 저장해보세요.</div>
        ) : (
          <div style={styles.presetList}>
            {presets.map((preset, index) => (
              <div key={index} style={styles.presetItem}>
                <button style={styles.presetLoad} onClick={() => handleLoadPreset(preset)} title={`${preset.fixtures.join(', ')}번`}>
                  {preset.name}
                  <span style={{ color: '#7a7f9a', fontWeight: 400, marginLeft: 4 }}>({preset.fixtures.join(',')})</span>
                </button>
                <button style={styles.presetDel} onClick={() => handleDeletePreset(index)} title="삭제">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={styles.err}>{error}</div>}
    </div>
  )
}
