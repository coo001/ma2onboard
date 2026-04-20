const BASE = '/api'

async function request(path, options = {}) {
  try {
    const response = await fetch(BASE + path, options)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
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
  intensityColor: (intensity, color_preset, color_rgb) =>
    post('/wizard/intensity-color', { intensity, color_preset, color_rgb }),
  position: (pan, tilt, focus) => post('/wizard/position', { pan, tilt, focus }),
  storeCue: (cue_number) => post('/wizard/store-cue', { cue_number }),
  clear: () => post('/wizard/clear', {}),
  clearFixtures: (fixture_numbers) => post('/wizard/clear-fixtures', { fixture_numbers }),
  rawCommand: (command) => post('/command', { command }),
  aiCommand: (text) => post('/ai-command', { text }),
  getGroups: () => get('/groups'),
  createGroup: (name, fixture_numbers) => post('/groups', { name, fixture_numbers }),
  deleteGroup: (name) => request(`/groups/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  fixtureStates: () => get('/fixture-states'),
  getCues: () => get('/cues'),
  addCue: (cue_number, label = '') => post('/cues', { cue_number, label }),
  deleteCue: (cue_number) => request(`/cues/${encodeURIComponent(cue_number)}`, { method: 'DELETE' }),
  executeCue: (cue_number) => post(`/cues/${encodeURIComponent(cue_number)}/execute`, {}),
}
