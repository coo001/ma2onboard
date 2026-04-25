const BASE = '/api'

async function request(path, options = {}) {
  try {
    const response = await fetch(BASE + path, options)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.error || `서버 요청에 실패했습니다. (${response.status})`,
        ...data,
      }
    }

    return data
  } catch (error) {
    return {
      ok: false,
      error: '백엔드 서버에 연결하지 못했습니다. FastAPI 서버가 켜져 있는지 확인해 주세요.',
      detail: String(error),
    }
  }
}

function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function get(path) {
  return request(path)
}

export const api = {
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
    fd.append('file', file)
    fd.append('dry_run', String(dry_run))
    fd.append('on_error', on_error)
    try {
      const res = await fetch(BASE + '/cues/import-excel', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.detail || data.error || `요청 실패 (${res.status})`, ...data }
      return data
    } catch (e) {
      return { ok: false, error: '업로드 실패', detail: String(e) }
    }
  },
  importTemplateUrl: () => BASE + '/cues/import-template',
  completeCueChat: (sessionId, message) => post(`/cues/complete/${sessionId}`, { message }),
  applyCueSession: (sessionId, onError = 'skip') => post(`/cues/complete/${sessionId}/apply`, { on_error: onError }),
  renameCue: (cue_number, label) =>
    request(`/cues/${encodeURIComponent(cue_number)}/label`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    }),
  bulkEditCues: (cue_numbers, fixture_numbers, color, position, colorPresetId = null, positionPresetId = null) =>
    post('/cues/bulk-edit', { cue_numbers, fixture_numbers, color, position, colorPresetId, positionPresetId }),
  previewSnapshot: (cue_numbers, fixture_numbers) =>
    post('/preview/snapshot', { cue_numbers, fixture_numbers }),
  previewColor: (fixture_numbers, color) =>
    post('/preview/color', { fixture_numbers, color }),
  previewPosition: (fixture_numbers, pan, tilt, focus) =>
    post('/preview/position', { fixture_numbers, pan, tilt, focus }),
  previewRestore: () => post('/preview/restore', {}),
  previewRelease: () => post('/preview/release', {}),
  reconcileCues: () => post('/cues/reconcile', {}),
  getPresets: () => get('/presets'),
  savePositionPreset: (name, pan, tilt, zoom) => post('/presets/position', { name, pan, tilt, zoom }),
  saveColorPreset: (name, h, s, v) => post('/presets/color', { name, h, s, v }),
  deletePreset: (kind, id) => request(`/presets/${kind}/${id}`, { method: 'DELETE' }),
  bulkCreatePresets: (presets) => post('/presets/bulk', presets),
}

// 프리셋 값 업데이트 (큐 자동 업데이트 포함)
export async function updatePresetValues(kind, presetId, values) {
  const res = await fetch(`/api/presets/${kind}/${presetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
  if (!res.ok) throw new Error('프리셋 업데이트 실패')
  return res.json()
}
