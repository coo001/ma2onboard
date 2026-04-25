const BASE = '/api'

async function request(path, options = {}) {
  try {
    const response = await fetch(BASE + path, options)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error || `서버 요청에 실패했습니다. (${response.status})`, ...data }
    }
    return data
  } catch (error) {
    return { ok: false, error: '백엔드 서버에 연결하지 못했습니다. FastAPI 서버가 켜져 있는지 확인해 주세요.', detail: String(error) }
  }
}

function post(path, body) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function get(path) { return request(path) }
function ok() { return Promise.resolve({ ok: true }) }
function mockId() { return Math.random().toString(36).slice(2, 10) }

// ── Mock API (데모 모드) ───────────────────────────────────────────
const _mockCues = [
  { number: '1', label: '오프닝', fade: 2.0, colorPresetId: null, positionPresetId: null },
  { number: '2', label: '메인 조명', fade: 1.0, colorPresetId: null, positionPresetId: null },
  { number: '3', label: '엔딩', fade: 3.0, colorPresetId: null, positionPresetId: null },
]
const _mockPresets = { position: [], color: [], scene: [] }

const mockApi = {
  connect: () => ok(),
  disconnect: () => ok(),
  status: () => Promise.resolve({ connected: true }),
  colorPresets: () => Promise.resolve({ presets: [] }),
  selectFixtures: () => ok(),
  intensityColor: () => ok(),
  position: () => ok(),
  effect: () => ok(),
  storeCue: () => ok(),
  clear: () => ok(),
  clearFixtures: () => ok(),
  rawCommand: () => ok(),
  aiCommand: (text) => Promise.resolve({
    ok: true,
    explanation: `[데모 모드] "${text}" — 실제 MA2 없이 동작을 시뮬레이션합니다. 실제 명령은 전송되지 않습니다.`,
    actions: [],
  }),
  fixtureStates: () => Promise.resolve({}),
  getCues: () => Promise.resolve({ cues: [..._mockCues] }),
  addCue: (number, label = '') => {
    const existing = _mockCues.findIndex(c => c.number === String(number))
    if (existing === -1) _mockCues.push({ number: String(number), label, fade: 0, colorPresetId: null, positionPresetId: null })
    return ok()
  },
  deleteCue: (number) => {
    const i = _mockCues.findIndex(c => c.number === String(number))
    if (i !== -1) _mockCues.splice(i, 1)
    return ok()
  },
  executeCue: () => ok(),
  syncCues: () => ok(),
  setQ: () => ok(),
  importCuesExcel: () => Promise.resolve({ ok: false, error: '데모 모드에서는 파일 업로드를 지원하지 않습니다.' }),
  importTemplateUrl: () => '#',
  completeCueChat: () => Promise.resolve({ ok: false, error: '데모 모드에서는 엑셀 대화를 지원하지 않습니다.' }),
  applyCueSession: () => Promise.resolve({ ok: false, error: '데모 모드' }),
  renameCue: (number, label) => {
    const cue = _mockCues.find(c => c.number === String(number))
    if (cue) cue.label = label
    return ok()
  },
  bulkEditCues: () => Promise.resolve({ ok: true, results: [] }),
  previewSnapshot: () => ok(),
  previewColor: () => ok(),
  previewPosition: () => ok(),
  previewRestore: () => ok(),
  previewRelease: () => ok(),
  reconcileCues: () => ok(),
  getPresets: () => Promise.resolve({
    position: [..._mockPresets.position],
    color: [..._mockPresets.color],
    scene: [..._mockPresets.scene],
  }),
  savePositionPreset: (data) => {
    const preset = { id: mockId(), name: data.name, pan: data.pan ?? 50, tilt: data.tilt ?? 50, zoom: data.zoom ?? 50, ...(data.groups ? { groups: data.groups } : {}) }
    _mockPresets.position.push(preset)
    return Promise.resolve({ ok: true, preset })
  },
  saveColorPreset: (name, h, s, v) => {
    const preset = { id: mockId(), name, h, s, v }
    _mockPresets.color.push(preset)
    return Promise.resolve({ ok: true, preset })
  },
  saveScenePreset: (data) => {
    const preset = { id: mockId(), name: data.name, fixtures: data.fixtures }
    _mockPresets.scene.push(preset)
    return Promise.resolve({ ok: true, preset })
  },
  deletePreset: (kind, id) => {
    _mockPresets[kind] = (_mockPresets[kind] || []).filter(p => p.id !== id)
    return ok()
  },
  bulkCreatePresets: () => Promise.resolve({ ok: true, created: { color: [], position: [] } }),
}

// ── Real API ──────────────────────────────────────────────────────
const realApi = {
  connect: (host, port, user, password) => post('/connect', { host, port, user, password }),
  disconnect: () => post('/disconnect', {}),
  status: () => get('/status'),
  colorPresets: () => get('/color-presets'),
  selectFixtures: (fixture_numbers) => post('/wizard/select-fixtures', { fixture_numbers }),
  intensityColor: (intensity, color_preset, color_rgb, fixture_numbers) =>
    post('/wizard/intensity-color', { intensity, color_preset, color_rgb, fixture_numbers }),
  position: (pan, tilt, focus, fixture_numbers) => post('/wizard/position', { pan, tilt, focus, fixture_numbers }),
  effect: (mode, strobe, slot, value, tempo, high, low, fixture_numbers) =>
    post('/wizard/effect', { mode, strobe, slot, value, tempo, high, low, fixture_numbers }),
  storeCue: (cue_number) => post('/wizard/store-cue', { cue_number }),
  clear: () => post('/wizard/clear', {}),
  clearFixtures: (fixture_numbers) => post('/wizard/clear-fixtures', { fixture_numbers }),
  rawCommand: (command) => post('/command', { command }),
  aiCommand: (text) => post('/ai-command', { text }),
  fixtureStates: () => get('/fixture-states'),
  getCues: () => get('/cues'),
  addCue: (cue_number, label = '') => post('/cues', { cue_number, label }),
  deleteCue: (cue_number) => request(`/cues/${encodeURIComponent(cue_number)}`, { method: 'DELETE' }),
  executeCue: (cue_number, fade = 0) => post(`/cues/${encodeURIComponent(cue_number)}/execute`, { fade }),
  syncCues: () => post('/cues/sync', {}),
  setQ: (q) => post('/wizard/q', { q }),
  importCuesExcel: async (file, dry_run = true, on_error = 'skip') => {
    const fd = new FormData()
    fd.append('file', file); fd.append('dry_run', String(dry_run)); fd.append('on_error', on_error)
    try {
      const res = await fetch(BASE + '/cues/import-excel', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.detail || data.error || `요청 실패 (${res.status})`, ...data }
      return data
    } catch (e) { return { ok: false, error: '업로드 실패', detail: String(e) } }
  },
  importTemplateUrl: () => BASE + '/cues/import-template',
  completeCueChat: (sessionId, message) => post(`/cues/complete/${sessionId}`, { message }),
  applyCueSession: (sessionId, onError = 'skip') => post(`/cues/complete/${sessionId}/apply`, { on_error: onError }),
  renameCue: (cue_number, label) =>
    request(`/cues/${encodeURIComponent(cue_number)}/label`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
    }),
  bulkEditCues: (cue_numbers, fixture_numbers, color, position, colorPresetId = null, positionPresetId = null) =>
    post('/cues/bulk-edit', { cue_numbers, fixture_numbers, color, position, colorPresetId, positionPresetId }),
  previewSnapshot: (cue_numbers, fixture_numbers) => post('/preview/snapshot', { cue_numbers, fixture_numbers }),
  previewColor: (fixture_numbers, color) => post('/preview/color', { fixture_numbers, color }),
  previewPosition: (fixture_numbers, pan, tilt, focus) => post('/preview/position', { fixture_numbers, pan, tilt, focus }),
  previewRestore: () => post('/preview/restore', {}),
  previewRelease: () => post('/preview/release', {}),
  reconcileCues: () => post('/cues/reconcile', {}),
  getPresets: () => get('/presets'),
  savePositionPreset: (data) => post('/presets/position', data),
  saveColorPreset: (name, h, s, v) => post('/presets/color', { name, h, s, v }),
  saveScenePreset: (data) => post('/presets/scene', data),
  deletePreset: (kind, id) => request(`/presets/${kind}/${id}`, { method: 'DELETE' }),
  bulkCreatePresets: (presets) => post('/presets/bulk', presets),
}

// ── Mock mode toggle ──────────────────────────────────────────────
let _mockMode = false
export function setMockMode(v) { _mockMode = v }
export function isMockMode() { return _mockMode }

export const api = new Proxy({}, {
  get(_, key) { return _mockMode ? mockApi[key] : realApi[key] },
})

// ── 프리셋 값 업데이트 (큐 자동 업데이트 포함) ───────────────────
export async function updatePresetValues(kind, presetId, values) {
  if (_mockMode) {
    const list = _mockPresets[kind] || []
    const p = list.find(x => x.id === presetId)
    if (p) Object.assign(p, values)
    return { ok: true, updated_cues: [] }
  }
  const res = await fetch(`/api/presets/${kind}/${presetId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
  })
  if (!res.ok) throw new Error('프리셋 업데이트 실패')
  return res.json()
}
