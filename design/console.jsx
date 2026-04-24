/* global React, Icon, Slider, Section, ChannelGrid, ColorPicker, hsvToRgb, rgbToHex */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function makeChannels(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    intensity: 0,
    pan: 50, tilt: 50, zoom: 50,
    hue: 200, sat: 0, val: 100,
  }));
}

const EXAMPLE_PROMPTS = [
  '1번 조명 파란색 밝게 켜줘',
  '2번 조명을 앰버색으로 플래시',
  '1,3,5번 조명 스트로브 효과',
  '현재 상태 큐 1번에 저장',
  '전체 끄기',
];

const INITIAL_MESSAGES = [
  { role: 'assistant', text: '안녕하세요! 조명 제어를 도와드릴게요. 자연어로 명령하거나, 오른쪽 패널에서 직접 조작할 수 있어요.' },
];

function LightingConsole({ theme = 'dark', density = 'comfortable', onThemeChange }) {
  const compact = density === 'compact';
  const channelCount = compact ? 10 : 10;

  const [channels, setChannels] = useState(() => makeChannels(channelCount));
  const [selected, setSelected] = useState([1]);
  const [color, setColor] = useState({ h: 210, s: 80, v: 95 });
  const [effect, setEffect] = useState('none'); // 'none' | 'strobe' | 'slot'
  const [strobeRate, setStrobeRate] = useState(4);
  const [cues, setCues] = useState([
    { id: 1, num: '1', delay: 0, label: '인트로 블루', enabled: true },
    { id: 2, num: '3', delay: 2, label: '버스 앰버', enabled: false },
    { id: 3, num: '220', delay: 0.5, label: '클라이맥스', enabled: false },
  ]);
  const [playingCue, setPlayingCue] = useState(null);
  const [cueTab, setCueTab] = useState('sequence');
  const [cueSaveName, setCueSaveName] = useState('1, 2, 3');
  const [aiOpen, setAiOpen] = useState(true);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [masterIntensity, setMasterIntensity] = useState(80);
  const [pan, setPan] = useState(50);
  const [tilt, setTilt] = useState(50);
  const [zoom, setZoom] = useState(50);
  const [blackoutArmed, setBlackoutArmed] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [strobeFlash, setStrobeFlash] = useState(false);

  // ===== selection =====
  const toggleChannel = (id) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };
  const selectAll = () => setSelected(channels.map(c => c.id));
  const clearAll = () => setSelected([]);

  // ===== apply current color/intensity to selected =====
  useEffect(() => {
    setChannels(chs => chs.map(c => selected.includes(c.id)
      ? { ...c, intensity: blackout ? 0 : masterIntensity, hue: color.h, sat: color.s, val: color.v, pan, tilt, zoom }
      : c
    ));
  }, [masterIntensity, color, pan, tilt, zoom, blackout]); // eslint-disable-line

  // ===== strobe tick =====
  useEffect(() => {
    if (effect !== 'strobe') { setStrobeFlash(false); return; }
    const id = setInterval(() => setStrobeFlash(f => !f), 1000 / (strobeRate * 2));
    return () => clearInterval(id);
  }, [effect, strobeRate]);

  // ===== toast =====
  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  // ===== undo =====
  const pushHistory = () => setHistory(h => [...h.slice(-19), { channels, selected, color, masterIntensity, pan, tilt, zoom, effect }]);
  const undo = () => {
    if (!history.length) { flash('되돌릴 작업이 없어요'); return; }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setChannels(prev.channels); setSelected(prev.selected);
    setColor(prev.color); setMasterIntensity(prev.masterIntensity);
    setPan(prev.pan); setTilt(prev.tilt); setZoom(prev.zoom); setEffect(prev.effect);
    flash('되돌렸어요');
  };

  // ===== blackout =====
  const toggleBlackout = () => {
    if (!blackout) pushHistory();
    setBlackout(b => !b);
    setBlackoutArmed(false);
    flash(blackout ? '블랙아웃 해제' : '블랙아웃 ON');
  };

  // ===== cues =====
  const addCue = () => {
    const nextNum = String((Math.max(0, ...cues.map(c => parseInt(c.num) || 0)) + 1));
    setCues(cs => [...cs, { id: Date.now(), num: nextNum, delay: 0, label: `큐 ${nextNum}`, enabled: false }]);
    flash(`큐 ${nextNum} 추가됨`);
  };
  const removeCue = (id) => setCues(cs => cs.filter(c => c.id !== id));
  const toggleCueCheck = (id) => setCues(cs => cs.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  const updateCue = (id, patch) => setCues(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const playCue = (id) => {
    setPlayingCue(id);
    const cue = cues.find(c => c.id === id);
    flash(`큐 ${cue.num} 실행`);
    setTimeout(() => setPlayingCue(p => p === id ? null : p), 1800);
  };

  // ===== AI =====
  const sendMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    // naive simulation
    setTimeout(() => {
      let reply = '명령을 처리했어요.';
      const t = text.toLowerCase();
      if (t.includes('파란') || t.includes('블루')) { setColor({ h: 220, s: 85, v: 95 }); reply = '파란색으로 설정했어요.'; }
      else if (t.includes('빨간') || t.includes('레드')) { setColor({ h: 0, s: 90, v: 95 }); reply = '빨간색으로 설정했어요.'; }
      else if (t.includes('앰버') || t.includes('노란')) { setColor({ h: 45, s: 80, v: 100 }); reply = '앰버색으로 설정했어요.'; }
      else if (t.includes('스트로브')) { setEffect('strobe'); reply = '스트로브 효과를 켰어요.'; }
      else if (t.includes('전체 끄')) { setBlackout(true); reply = '전체 조명을 껐어요.'; }
      else if (t.includes('저장')) { reply = '현재 상태를 큐에 저장했어요.'; addCue(); }
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    }, 450);
  };

  // ===== keyboard shortcuts =====
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key >= '1' && e.key <= '9') {
        const id = parseInt(e.key);
        toggleChannel(id);
      } else if (e.key === '0') {
        toggleChannel(10);
      } else if (e.key === 'b' || e.key === 'B') {
        toggleBlackout();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); undo();
      } else if (e.key === 'Escape') {
        clearAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ===== stage preview =====
  const activeChannels = channels.filter(c => selected.includes(c.id) && c.intensity > 0);
  const stageBrightness = blackout ? 0 : (strobeFlash && effect === 'strobe' ? 0 : 1);

  return (
    <div className="console" data-theme={theme}>
      {/* Top bar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <span>Lumen</span>
          <span className="brand-sub">조명 콘솔</span>
        </div>
        <div className="topbar-spacer" />

        <button className="btn sm ghost" onClick={undo} title="되돌리기 (⌘Z)">
          <Icon.Undo size={14} />
          되돌리기
        </button>
        <button
          className={`btn sm blackout ${blackoutArmed ? 'armed' : ''} ${blackout ? 'armed' : ''}`}
          onClick={toggleBlackout}
          onMouseEnter={() => setBlackoutArmed(true)}
          onMouseLeave={() => setBlackoutArmed(false)}
          title="블랙아웃 (B)"
        >
          <Icon.Off size={14} />
          {blackout ? '블랙아웃 ON' : '블랙아웃'}
        </button>

        <div className="pill live">
          <span className="dot" />
          <span>연결됨 · 172.5.0.1</span>
        </div>

        <div className="theme-toggle">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => onThemeChange?.('light')} title="라이트">
            <Icon.Sun size={14} />
          </button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => onThemeChange?.('dark')} title="다크">
            <Icon.Moon size={14} />
          </button>
        </div>

        <button className="icon-btn" title="설정"><Icon.Settings size={16} /></button>
      </div>

      {/* Workspace */}
      <div className={`workspace ${aiOpen ? '' : 'ai-collapsed'}`}>

        {/* === Left: controls === */}
        <div className="col">
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <Section
              title="채널"
              meta={`${selected.length} / ${channels.length} 선택됨`}
              compact={compact}
            >
              <ChannelGrid
                channels={channels}
                selected={selected}
                onToggle={toggleChannel}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                compact={compact}
              />
              <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>단축키</span>
                <span className="kbd">1</span><span className="kbd">2</span><span className="kbd">...</span>
                <span>채널 토글</span>
                <span className="kbd">Esc</span><span>해제</span>
              </div>
            </Section>

            <Section title="밝기" meta={`${masterIntensity}%`} compact={compact}>
              <Slider value={masterIntensity} onChange={setMasterIntensity} hero />
            </Section>

            <Section title="움직임 / 포커스" compact={compact}>
              <Slider value={pan} onChange={setPan} label="PAN" showLabel />
              <Slider value={tilt} onChange={setTilt} label="TILT" showLabel />
              <Slider value={zoom} onChange={setZoom} label="ZOOM" showLabel />
            </Section>

            <Section title="색상" meta={rgbToHex(...hsvToRgb(color.h, color.s, color.v))} compact={compact}>
              <ColorPicker color={color} onChange={setColor} />
            </Section>

            <Section title="이펙트" compact={compact}>
              <div className="segmented">
                <button className={effect === 'none' ? 'active' : ''} onClick={() => setEffect('none')}>
                  없음
                </button>
                <button className={effect === 'strobe' ? 'active' : ''} onClick={() => setEffect('strobe')}>
                  <Icon.Strobe size={12} /> 스트로브
                </button>
                <button className={effect === 'slot' ? 'active' : ''} onClick={() => setEffect('slot')}>
                  <Icon.Sparkle size={12} /> Effect Slot
                </button>
              </div>
              {effect === 'strobe' && (
                <div style={{ marginTop: 8 }}>
                  <Slider value={strobeRate} onChange={setStrobeRate} min={1} max={20} label="RATE" showLabel />
                </div>
              )}
            </Section>

            <Section title="큐 저장" compact={compact}>
              <div className="row">
                <input
                  className="input"
                  value={cueSaveName}
                  onChange={(e) => setCueSaveName(e.target.value)}
                  placeholder="1, 2, 3"
                  style={{ flex: 1 }}
                />
                <button className="btn primary" onClick={() => { addCue(); }}>
                  <Icon.Save size={13} /> 큐 저장
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                쉼표로 여러 번호를 구분해 한 번에 저장할 수 있어요
              </div>
            </Section>
          </div>
        </div>

        {/* === Middle: cues === */}
        <div className="col">
          <div className="cue-header">
            <h3>큐 시퀀스</h3>
            <span className="cue-count">{cues.length}</span>
            <div className="grow" />
            <button className="btn sm icon-only ghost" onClick={addCue} title="큐 추가">
              <Icon.Plus size={14} />
            </button>
          </div>
          <div className="cue-tabs">
            {[
              ['sequence', '시퀀스'],
              ['test', '테스트'],
              ['run', '실행'],
              ['trash', '삭제됨'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`cue-tab ${cueTab === id ? 'active' : ''}`}
                onClick={() => setCueTab(id)}
              >{label}</button>
            ))}
          </div>

          <div className="cue-list">
            {cues.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                저장된 큐가 없습니다
              </div>
            )}
            {cues.map(cue => (
              <div key={cue.id} className={`cue-row ${playingCue === cue.id ? 'playing' : ''}`}>
                <div
                  className={`cue-check ${cue.enabled ? 'checked' : ''}`}
                  onClick={() => toggleCueCheck(cue.id)}
                >
                  {cue.enabled && <Icon.Check size={11} stroke={3} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 56 }}>
                  <div className="cue-num">#{cue.num}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{cue.label}</div>
                </div>
                <div className="grow" />
                <input
                  className="cue-delay"
                  type="number"
                  value={cue.delay}
                  step="0.1"
                  onChange={(e) => updateCue(cue.id, { delay: parseFloat(e.target.value) || 0 })}
                />
                <span className="cue-delay-unit">s</span>
                <button className="btn sm go" onClick={() => playCue(cue.id)}>
                  GO
                </button>
                <button
                  className="btn sm icon-only ghost"
                  onClick={() => removeCue(cue.id)}
                  title="삭제"
                  style={{ color: 'var(--text-dim)' }}
                >
                  <Icon.X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="cue-footer">
            <div className="live-indicator">
              {playingCue ? (
                <><span className="dot" style={{width:6,height:6,borderRadius:99,background:'var(--status-live)'}} /> 재생 중</>
              ) : '대기 중'}
            </div>
            <button className="btn sm ghost"><Icon.Prev size={13} /> 이전</button>
            <button className="btn sm primary">다음 <Icon.Next size={13} /></button>
          </div>
        </div>

        {/* === Right: AI panel === */}
        <div className="col">
          {aiOpen ? (
            <div className="ai-panel">
              <div className="ai-header">
                <div className="ai-title">
                  <div className="ai-avatar">AI</div>
                  <span>어시스턴트</span>
                </div>
                <div className="grow" />
                <button className="icon-btn" onClick={() => setAiOpen(false)} title="접기">
                  <Icon.Panel size={14} />
                </button>
              </div>

              <div className="ai-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>
                ))}
              </div>

              <div className="ai-chips">
                {EXAMPLE_PROMPTS.slice(0, 3).map(p => (
                  <button key={p} className="ai-chip" onClick={() => sendMessage(p)}>{p}</button>
                ))}
              </div>

              <div className="ai-input-wrap">
                <textarea
                  className="ai-input"
                  placeholder="명령 또는 질문을 입력하세요..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  rows={2}
                />
                <button
                  className="ai-send"
                  disabled={!input.trim()}
                  onClick={() => sendMessage(input)}
                >
                  <Icon.Send size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="ai-panel collapsed">
              <button className="icon-btn" onClick={() => setAiOpen(true)} title="AI 어시스턴트 열기">
                <Icon.Panel size={16} />
              </button>
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-dim)', writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>
                AI 어시스턴트
              </div>
            </div>
          )}
        </div>

      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

window.LightingConsole = LightingConsole;
