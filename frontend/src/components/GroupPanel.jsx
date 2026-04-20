import { useState, useEffect } from 'react'
import { api } from '../api'

const s = {
  panel: {
    borderBottom: '1px solid #2e334d',
    padding: '12px 40px',
    background: '#13151f',
  },
  header: {
    fontSize: 11, color: '#5a5f7a', marginBottom: 8,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  groups: {
    display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8,
  },
  groupBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', borderRadius: 20,
    background: '#1a1d27', border: '1px solid #f0a500',
    color: '#f0a500', fontSize: 12, cursor: 'pointer',
  },
  deleteBtn: {
    background: 'none', border: 'none', color: '#7a7f9a',
    cursor: 'pointer', fontSize: 13, padding: '0 2px',
    lineHeight: 1,
  },
  form: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
  },
  input: {
    background: '#1a1d27', border: '1px solid #2e334d',
    borderRadius: 8, color: '#e8eaf0', fontSize: 12,
    padding: '5px 10px', outline: 'none', width: 130,
  },
  addBtn: (disabled) => ({
    padding: '5px 14px', borderRadius: 8, border: 'none',
    background: disabled ? '#2e334d' : '#f0a500',
    color: disabled ? '#5a5f7a' : '#000',
    fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  }),
  error: { color: '#f26b6b', fontSize: 11, marginTop: 4 },
}

export default function GroupPanel({ onInsert }) {
  const [groups, setGroups] = useState([])
  const [name, setName] = useState('')
  const [fixtures, setFixtures] = useState('')
  const [err, setErr] = useState('')

  async function loadGroups() {
    const r = await api.getGroups()
    if (r.groups) setGroups(r.groups)
  }

  useEffect(() => { loadGroups() }, [])

  async function save() {
    setErr('')
    const nums = fixtures.split(/[\s,]+/).map(Number).filter(n => Number.isInteger(n) && n > 0)
    if (!name.trim()) return setErr('그룹 이름을 입력하세요.')
    if (nums.length === 0) return setErr('fixture 번호를 입력하세요. 예: 1, 2, 3')
    const r = await api.createGroup(name.trim(), nums)
    if (r.ok === false) return setErr(r.error || '저장 실패')
    setName('')
    setFixtures('')
    loadGroups()
  }

  async function remove(groupName) {
    await api.deleteGroup(groupName)
    loadGroups()
  }

  return (
    <div style={s.panel}>
      <div style={s.header}>그룹 관리</div>
      {groups.length > 0 && (
        <div style={s.groups}>
          {groups.map(g => (
            <span key={g.name} style={s.groupBtn}>
              <span onClick={() => onInsert(g.name)} title={`fixture: ${g.fixture_numbers.join(', ')}`}>
                {g.name}
              </span>
              <button style={s.deleteBtn} onClick={() => remove(g.name)} title="삭제">×</button>
            </span>
          ))}
        </div>
      )}
      <div style={s.form}>
        <input
          style={s.input}
          placeholder="그룹 이름 (예: 무대 왼쪽)"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          style={s.input}
          placeholder="fixture 번호 (예: 1, 2, 3)"
          value={fixtures}
          onChange={e => setFixtures(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <button style={s.addBtn(!name.trim() || !fixtures.trim())} onClick={save}>
          저장
        </button>
      </div>
      {err && <div style={s.error}>{err}</div>}
    </div>
  )
}
