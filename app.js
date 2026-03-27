
(() => {
  const LOGO_SRC = 'volleytotal-logo.png';
  const state = {
    project: createEmptyProject(),
    videoFile: null,
    videoUrl: null,
    activeTab: 'operacion',
    selectedRallyId: null,
    pendingServeTime: null,
    pendingComment: '',
    overlayLocked: false,
    showCommentBox: false,
    undoStack: [],
    redoStack: [],
    playbackRates: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8],
    frameRate: 30,
    lastLoadedProjectName: '',
  };

  const app = document.getElementById('app');
  render();

  function createEmptyProject() {
    return {
      version: 2,
      meta: { competition: '', date: '', teamA: 'Equipo A', teamB: 'Equipo B' },
      rules: { bestOf: 5, setsToWin: 3, regularSetPoints: 25, finalSetPoints: 15, winByTwo: true, specialMode: false },
      initial: { firstServer: 'A', startSet: 1, startScoreA: 0, startScoreB: 0, startSetsA: 0, startSetsB: 0 },
      videoFingerprint: null,
      rallies: [],
      manualSetEnds: [],
      savedAt: null,
    };
  }

  function render() {
    const prevVideo = document.getElementById('video');
    const rememberedTime = prevVideo ? prevVideo.currentTime || 0 : 0;
    const rememberedPaused = prevVideo ? prevVideo.paused : true;
    const rememberedRate = prevVideo ? prevVideo.playbackRate : 1;
    const currentState = getCurrentState();
    const projectName = `${state.project.meta.teamA} vs ${state.project.meta.teamB}`;
    const lockLabel = state.overlayLocked ? 'Desbloquear overlay' : 'Bloquear overlay';
    app.innerHTML = `
      <div class="app-shell">
        <div class="topbar">
          <div class="brand">
            <img class="brand-logo" src="${LOGO_SRC}" alt="VolleyTotal" />
            <div class="brand-copy">
              <h1>VolleyTotal Score Tracker</h1>
              <div class="muted">Saque → comentario opcional → ganador del rally → marcador y turnos automáticos</div>
            </div>
          </div>
        </div>

        <div class="main">
          <div class="video-area">
            <div class="video-panel">
              <div class="video-header">
                <div class="muted">${escapeHtml(projectName)}</div>
                <div class="muted">Saca ahora: <strong>${currentState.server === 'A' ? escapeHtml(state.project.meta.teamA) : escapeHtml(state.project.meta.teamB)}</strong></div>
              </div>
              <div class="video-wrap" id="videoWrap">
                <video id="video" preload="metadata"></video>
                <div class="video-overlay">
                  <div class="overlay-top compact-top">
                    <div class="overlay-actions compact-actions">
                      <div class="overlay-chip">Set ${currentState.setNumber} · ${currentState.scoreA}-${currentState.scoreB}</div>
                      <div class="overlay-chip hide-sm">Sets ${currentState.setsA}-${currentState.setsB}</div>
                      <div class="overlay-chip hide-md">FPS ${state.frameRate}</div>
                    </div>
                    <div class="overlay-actions compact-actions">
                      <div class="overlay-chip status-chip ${state.pendingServeTime == null ? 'pending' : 'ready'}">${state.pendingServeTime == null ? 'Saque pendiente' : `Saque ${formatTime(state.pendingServeTime)}`}</div>
                    </div>
                  </div>
                  <div class="overlay-bottom compact-bottom">
                    ${state.showCommentBox ? `
                    <div class="overlay-comment-pop ${state.overlayLocked ? 'locked' : ''}">
                      <div class="overlay-comment-head">
                        <strong>Comentario</strong>
                        <button id="overlayCommentCloseBtn" class="icon ghost mini-icon" title="Ocultar comentario">✕</button>
                      </div>
                      <textarea id="pendingCommentInput" placeholder="Comentario opcional antes de asignar el ganador..." ${state.overlayLocked ? 'disabled' : ''}>${escapeHtml(state.pendingComment)}</textarea>
                      <div class="muted comment-status">${state.pendingServeTime == null ? 'Añade el comentario y marca después el saque.' : `Saque marcado en ${formatTime(state.pendingServeTime)}.`}</div>
                    </div>` : ''}
                    <div class="overlay-dock ${state.overlayLocked ? 'locked' : ''}">
                      <div class="overlay-dock-main">
                        <button id="overlayServeBtn" class="serve-btn compact-btn" title="Marcar instante del saque (S)" ${state.overlayLocked ? 'disabled' : ''}>🎯<span>Saque</span></button>
                        <button id="overlayWinnerABtn" class="success compact-btn compact-team" title="Punto para ${escapeAttr(state.project.meta.teamA)} (A)" ${state.overlayLocked ? 'disabled' : ''}>${escapeHtml(state.project.meta.teamA)}</button>
                        <button id="overlayWinnerBBtn" class="primary compact-btn compact-team" title="Punto para ${escapeAttr(state.project.meta.teamB)} (L)" ${state.overlayLocked ? 'disabled' : ''}>${escapeHtml(state.project.meta.teamB)}</button>
                      </div>
                      <div class="overlay-dock-side">
                        <button id="overlayCommentToggleBtn" class="icon ghost mini-icon" title="Mostrar u ocultar comentario" ${state.overlayLocked ? 'disabled' : ''}>💬</button>
                        <button id="overlayFixBtn" class="icon ghost mini-icon" title="Corregir último rally">↺</button>
                        <button id="overlayUndoBtn" class="icon ghost mini-icon" title="Deshacer">↶</button>
                        <button id="overlayRedoBtn" class="icon ghost mini-icon" title="Rehacer">↷</button>
                        <button id="overlayLockBtn" class="icon ghost mini-icon lock-btn ${state.overlayLocked ? 'locked' : ''}" title="${lockLabel}">${state.overlayLocked ? '🔒' : '🔓'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="scrub-bar">
                <div class="range-time" id="currentTimeLabel">00:00.000</div>
                <input id="seekRange" type="range" min="0" max="1000" value="0" />
                <div class="range-time" id="durationLabel">00:00.000</div>
              </div>
              <div class="controls-grid">
                <button id="playPauseBtn" class="icon ghost" title="Reproducir / Pausar">▶</button>
                <button id="back1sBtn" class="icon ghost" title="Retroceder 1 segundo">⟲1</button>
                <button id="fwd1sBtn" class="icon ghost" title="Avanzar 1 segundo">1⟳</button>
                <button id="back5sBtn" class="icon ghost" title="Retroceder 5 segundos">⟲5</button>
                <button id="fwd5sBtn" class="icon ghost" title="Avanzar 5 segundos">5⟳</button>
                <button id="backFrameBtn" class="icon ghost" title="Retroceder 1 fotograma">⟪</button>
                <button id="fwdFrameBtn" class="icon ghost" title="Avanzar 1 fotograma">⟫</button>
                <select id="rateSelect" title="Velocidad de reproducción">
                  ${state.playbackRates.map(r => `<option value="${r}" ${r===rememberedRate?'selected':''}>${String(r).replace('.', ',')}x</option>`).join('')}
                </select>
                <input id="fpsInput" type="number" min="1" step="1" value="${state.frameRate}" title="FPS para salto por fotogramas" />
                <button id="fullscreenBtn" class="ghost" title="Pantalla completa">Pantalla completa</button>
              </div>
            </div>
          </div>

          <div class="bottom-area">
            <div class="control-panel">
              <div class="tabs">
                <button class="tab-btn ${state.activeTab==='operacion'?'active':''}" data-tab="operacion">Operación</button>
                <button class="tab-btn ${state.activeTab==='gestion'?'active':''}" data-tab="gestion">Búsqueda / Edición / Archivos</button>
                <button class="tab-btn ${state.activeTab==='config'?'active':''}" data-tab="config">Configuración</button>
              </div>

              <div class="summary">
                <div class="card">
                  <div class="score-strip">
                    <div>
                      <div class="muted">Marcador</div>
                      <div class="score-big">${currentState.scoreA}-${currentState.scoreB}</div>
                    </div>
                    <div>
                      <div class="muted">Sets</div>
                      <div class="sets-big">${currentState.setsA}-${currentState.setsB}</div>
                    </div>
                    <div>
                      <div class="muted">Set actual</div>
                      <div class="sets-big">${currentState.setNumber}</div>
                    </div>
                  </div>
                  <div class="team-line"><span>${escapeHtml(state.project.meta.teamA)}</span><span>${escapeHtml(state.project.meta.teamB)}</span></div>
                </div>
                <div class="card">
                  <div class="muted">Vídeo cargado</div>
                  <div style="margin-top:6px; font-weight:700;">${state.videoFile ? escapeHtml(state.videoFile.name) : 'Ninguno'}</div>
                  <div class="muted" style="margin-top:6px;">${videoMetaLabel()}</div>
                </div>
                <div class="card">
                  <div class="muted">Próximo servicio esperado</div>
                  <div style="margin-top:6px; font-size:18px; font-weight:800;">${currentState.server === 'A' ? escapeHtml(state.project.meta.teamA) : escapeHtml(state.project.meta.teamB)}</div>
                  <div class="muted" style="margin-top:6px;">Deducido automáticamente a partir del ganador del rally.</div>
                </div>
              </div>

              <div id="tab-operacion" class="tab-panel ${state.activeTab==='operacion'?'':'hidden'}">
                <div class="content-grid">
                  <div class="stack">
                    <div class="card">
                      <div class="muted">Últimos rallies</div>
                      <div class="log-list" style="margin-top:10px;">${renderRecentRallies(8)}</div>
                    </div>
                  </div>
                  <div class="stack">
                    <div class="card">
                      <div class="muted">Atajos</div>
                      <div style="margin-top:10px; display:grid; gap:8px;">
                        <div><span class="kbd">Espacio</span> reproducir / pausar</div>
                        <div><span class="kbd">S</span> marcar saque</div>
                        <div><span class="kbd">A</span> punto para ${escapeHtml(state.project.meta.teamA)}</div>
                        <div><span class="kbd">L</span> punto para ${escapeHtml(state.project.meta.teamB)}</div>
                        <div><span class="kbd">← / →</span> ±1 s · <span class="kbd">Shift</span> + flechas = ±1 frame</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div id="tab-gestion" class="tab-panel ${state.activeTab==='gestion'?'':'hidden'}">
                <div class="content-grid">
                  <div class="stack">
                    <div class="card">
                      <div class="muted">Archivos</div>
                      <div class="log-actions" style="margin-top:10px;">
                        <button id="newProjectBtn">Nuevo</button>
                        <button id="saveJsonBtn" class="primary">Guardar JSON</button>
                        <button id="loadJsonBtn">Cargar JSON</button>
                        <button id="exportCsvBtn">Exportar CSV</button>
                        <button id="loadVideoBtn">Cargar vídeo</button>
                        <input id="videoFileInput" type="file" accept="video/*" class="hidden" />
                        <input id="jsonFileInput" type="file" accept="application/json,.json" class="hidden" />
                      </div>
                    </div>
                    <div class="card">
                      <div class="muted">Buscar marcador</div>
                      <div class="row-4" style="margin-top:10px;">
                        <div><label>Set</label><input id="searchSet" type="number" min="1" value="${currentState.setNumber}" /></div>
                        <div><label>Puntos ${escapeHtml(state.project.meta.teamA)}</label><input id="searchA" type="number" min="0" value="${currentState.scoreA}" /></div>
                        <div><label>Puntos ${escapeHtml(state.project.meta.teamB)}</label><input id="searchB" type="number" min="0" value="${currentState.scoreB}" /></div>
                        <div style="display:flex; align-items:end;"><button id="searchScoreBtn" class="primary">Buscar</button></div>
                      </div>
                      <div id="searchResults" class="match-list" style="margin-top:10px;"></div>
                    </div>
                    <div class="card">
                      <div class="muted">Historial completo</div>
                      <div class="log-list" style="margin-top:10px;">${renderAllRallies()}</div>
                    </div>
                  </div>
                  <div class="stack">
                    <div class="card">
                      <div class="muted">Edición del rally seleccionado</div>
                      ${renderEditor()}
                    </div>
                  </div>
                </div>
              </div>

              <div id="tab-config" class="tab-panel ${state.activeTab==='config'?'':'hidden'}">
                <div class="content-grid">
                  <div class="stack">
                    <div class="card">
                      <div class="muted">Metadatos</div>
                      <div class="row" style="margin-top:10px;">
                        <div><label>Competición</label><input id="competitionInput" value="${escapeAttr(state.project.meta.competition)}" /></div>
                        <div><label>Fecha</label><input id="dateInput" type="date" value="${escapeAttr(state.project.meta.date)}" /></div>
                      </div>
                      <div class="row" style="margin-top:10px;">
                        <div><label>Equipo A</label><input id="teamAInput" value="${escapeAttr(state.project.meta.teamA)}" /></div>
                        <div><label>Equipo B</label><input id="teamBInput" value="${escapeAttr(state.project.meta.teamB)}" /></div>
                      </div>
                    </div>
                    <div class="card">
                      <div class="muted">Reglas</div>
                      <div class="row-4" style="margin-top:10px;">
                        <div><label>Mejor de</label><input id="bestOfInput" type="number" min="1" step="2" value="${state.project.rules.bestOf}" /></div>
                        <div><label>Sets para ganar</label><input id="setsToWinInput" type="number" min="1" value="${state.project.rules.setsToWin}" /></div>
                        <div><label>Sets normales</label><input id="regularSetPointsInput" type="number" min="1" value="${state.project.rules.regularSetPoints}" /></div>
                        <div><label>Set final</label><input id="finalSetPointsInput" type="number" min="1" value="${state.project.rules.finalSetPoints}" /></div>
                      </div>
                      <div class="row" style="margin-top:10px;">
                        <div><label>Sacador inicial</label><select id="firstServerInput"><option value="A" ${state.project.initial.firstServer==='A'?'selected':''}>${escapeHtml(state.project.meta.teamA)}</option><option value="B" ${state.project.initial.firstServer==='B'?'selected':''}>${escapeHtml(state.project.meta.teamB)}</option></select></div>
                        <div><label>FPS por defecto</label><input id="fpsConfigInput" type="number" min="1" step="1" value="${state.frameRate}" /></div>
                      </div>
                      <div class="log-actions" style="margin-top:10px;"><button id="applyConfigBtn" class="primary">Aplicar configuración</button><button id="manualSetEndBtn" class="warn">Finalizar set manualmente</button></div>
                    </div>
                  </div>
                  <div class="stack">
                    <div class="card credit-box">
                      <div class="muted">Información</div>
                      <div style="margin-top:10px;" class="muted">El proyecto se guarda en JSON y puede volver a vincularse al vídeo validando nombre, tamaño y duración. La secuencia completa puede exportarse a CSV con comentarios incluidos.</div>
                      <div class="credit-box" style="margin-top:12px;">
                        <details>
                          <summary>Créditos</summary>
                          <div class="credit-copy">Aplicación creada por <strong>Aurelio Ureña Espa</strong>, <strong>Universidad de Granada</strong>.</div>
                        </details>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="footer">Proyecto local en navegador. El vídeo debe seleccionarse manualmente al reabrir un JSON.</div>
      </div>
    `;

    bindEvents();
    const video = document.getElementById('video');
    if (state.videoUrl && video && video.src !== state.videoUrl) {
      video.src = state.videoUrl;
      video.onloadedmetadata = () => {
        try { video.currentTime = Math.min(rememberedTime, Number.isFinite(video.duration) ? video.duration : rememberedTime); } catch {}
        video.playbackRate = rememberedRate;
        syncVideoUI();
        if (state.project.videoFingerprint) validateCurrentVideoAgainstProject();
        if (!rememberedPaused) video.play().catch(() => {});
      };
    }
    syncVideoUI();
  }

  function bindEvents() {
    const $ = (id) => document.getElementById(id);
    const video = $('video');

    const byId = ['loadVideoBtn','loadJsonBtn','saveJsonBtn','exportCsvBtn','newProjectBtn'];
    if ($('loadVideoBtn')) $('loadVideoBtn').onclick = () => $('videoFileInput').click();
    if ($('loadJsonBtn')) $('loadJsonBtn').onclick = () => $('jsonFileInput').click();
    if ($('saveJsonBtn')) $('saveJsonBtn').onclick = saveProjectJson;
    if ($('exportCsvBtn')) $('exportCsvBtn').onclick = exportCsv;
    if ($('newProjectBtn')) $('newProjectBtn').onclick = () => {
      if (!confirm('Se creará un proyecto nuevo. ¿Continuar?')) return;
      state.project = createEmptyProject();
      state.videoFile = null;
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      state.videoUrl = null;
      state.pendingServeTime = null;
      state.pendingComment = '';
      state.selectedRallyId = null;
      state.undoStack = [];
      state.redoStack = [];
      video.removeAttribute('src');
      render();
    };

    if ($('videoFileInput')) $('videoFileInput').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await loadVideoFile(file);
      e.target.value = '';
    };

    if ($('jsonFileInput')) $('jsonFileInput').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.rallies || !parsed.meta || !parsed.rules) {
        alert('JSON no válido.');
        return;
      }
      state.project = parsed;
      state.project.rallies = state.project.rallies.map(r => ({ note: '', ...r }));
      state.pendingServeTime = null;
      state.pendingComment = '';
      state.selectedRallyId = null;
      state.undoStack = [];
      state.redoStack = [];
      state.lastLoadedProjectName = file.name;
      render();
      e.target.value = '';
      alert('Proyecto cargado. Ahora selecciona manualmente el vídeo local correspondiente.');
    };

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => { state.activeTab = btn.dataset.tab; render(); };
    });

    $('playPauseBtn').onclick = () => togglePlay();
    $('back1sBtn').onclick = () => stepTime(-1);
    $('fwd1sBtn').onclick = () => stepTime(1);
    $('back5sBtn').onclick = () => stepTime(-5);
    $('fwd5sBtn').onclick = () => stepTime(5);
    $('backFrameBtn').onclick = () => stepFrame(-1);
    $('fwdFrameBtn').onclick = () => stepFrame(1);
    $('overlayServeBtn').onclick = markServe;
    $('overlayWinnerABtn').onclick = () => registerWinner('A');
    $('overlayWinnerBBtn').onclick = () => registerWinner('B');
    $('overlayFixBtn').onclick = fixLastRally;
    $('overlayUndoBtn').onclick = undo;
    $('overlayRedoBtn').onclick = redo;
    $('overlayLockBtn').onclick = toggleOverlayLock;
    $('fullscreenBtn').onclick = () => video.requestFullscreen?.();

    const commentInput = $('pendingCommentInput');
    if (commentInput) commentInput.oninput = (e) => { state.pendingComment = e.target.value; };
    if ($('overlayCommentToggleBtn')) $('overlayCommentToggleBtn').onclick = () => { state.showCommentBox = !state.showCommentBox; render(); };
    if ($('overlayCommentCloseBtn')) $('overlayCommentCloseBtn').onclick = () => { state.showCommentBox = false; render(); };

    $('rateSelect').onchange = (e) => { video.playbackRate = parseFloat(e.target.value); };
    $('fpsInput').onchange = (e) => {
      const v = parseInt(e.target.value, 10);
      if (v > 0) state.frameRate = v;
      render();
    };

    $('seekRange').oninput = (e) => {
      if (!Number.isFinite(video.duration)) return;
      video.currentTime = (parseFloat(e.target.value) / 1000) * video.duration;
    };

    video.onloadedmetadata = () => {
      syncVideoUI();
      if (state.project.videoFingerprint) validateCurrentVideoAgainstProject();
    };
    video.ontimeupdate = syncVideoUI;
    video.onseeked = syncVideoUI;
    video.onplay = syncVideoUI;
    video.onpause = syncVideoUI;

    bindSearchEvents();
    bindEditorEvents();
    bindConfigEvents();
    bindHistoryJumpEvents();

    document.onkeydown = (e) => {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); markServe(); }
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); registerWinner('A'); }
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); registerWinner('B'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? stepFrame(-1) : stepTime(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? stepFrame(1) : stepTime(1); }
    };
  }

  function bindSearchEvents() {
    const btn = document.getElementById('searchScoreBtn');
    if (!btn) return;
    btn.onclick = () => {
      const setN = parseInt(document.getElementById('searchSet').value, 10);
      const a = parseInt(document.getElementById('searchA').value, 10);
      const b = parseInt(document.getElementById('searchB').value, 10);
      const results = computeRallyStates().filter(x => x.setNumber === setN && x.scoreA === a && x.scoreB === b);
      const box = document.getElementById('searchResults');
      if (!results.length) {
        box.innerHTML = '<div class="empty">No hay coincidencias para ese marcador.</div>';
        return;
      }
      box.innerHTML = results.map(r => `
        <div class="match-item">
          <div><strong>Set ${r.setNumber} · ${r.scoreA}-${r.scoreB}</strong></div>
          <div class="muted">Rally ${r.index + 1} · saque ${formatTime(r.serveTime)}</div>
          ${r.note ? `<div class="muted" style="margin-top:6px;">Comentario: ${escapeHtml(r.note)}</div>` : ''}
          <div class="log-actions"><button class="jump-search-btn small" data-id="${r.id}">Ir al saque</button></div>
        </div>
      `).join('');
      box.querySelectorAll('.jump-search-btn').forEach(btn => btn.onclick = () => jumpToRally(btn.dataset.id));
    };
  }

  function bindEditorEvents() {
    const saveBtn = document.getElementById('saveEditBtn');
    if (saveBtn) saveBtn.onclick = saveEditedRally;
    const delBtn = document.getElementById('deleteEditBtn');
    if (delBtn) delBtn.onclick = deleteSelectedRally;
    const insBtn = document.getElementById('insertAfterEditBtn');
    if (insBtn) insBtn.onclick = insertAfterSelectedRally;
    document.querySelectorAll('.select-rally-btn').forEach(btn => btn.onclick = () => { state.selectedRallyId = btn.dataset.id; render(); });
  }

  function bindConfigEvents() {
    const btn = document.getElementById('applyConfigBtn');
    if (!btn) return;
    btn.onclick = () => {
      const next = structuredClone(state.project);
      next.meta.competition = document.getElementById('competitionInput').value.trim();
      next.meta.date = document.getElementById('dateInput').value;
      next.meta.teamA = document.getElementById('teamAInput').value.trim() || 'Equipo A';
      next.meta.teamB = document.getElementById('teamBInput').value.trim() || 'Equipo B';
      next.rules.bestOf = parseInt(document.getElementById('bestOfInput').value, 10) || 5;
      next.rules.setsToWin = parseInt(document.getElementById('setsToWinInput').value, 10) || Math.ceil(next.rules.bestOf / 2);
      next.rules.regularSetPoints = parseInt(document.getElementById('regularSetPointsInput').value, 10) || 25;
      next.rules.finalSetPoints = parseInt(document.getElementById('finalSetPointsInput').value, 10) || 15;
      next.initial.firstServer = document.getElementById('firstServerInput').value;
      const fps = parseInt(document.getElementById('fpsConfigInput').value, 10);
      if (fps > 0) state.frameRate = fps;
      pushUndo();
      state.project = next;
      render();
    };
    const manualBtn = document.getElementById('manualSetEndBtn');
    if (manualBtn) manualBtn.onclick = manualSetEnd;
  }

  function bindHistoryJumpEvents() {
    document.querySelectorAll('.jump-rally-btn').forEach(btn => btn.onclick = () => jumpToRally(btn.dataset.id));
  }

  async function loadVideoFile(file) {
    state.videoFile = file;
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = URL.createObjectURL(file);
    const video = document.getElementById('video');
    video.src = state.videoUrl;
    await waitForMetadata(video);
    state.project.videoFingerprint = {
      name: file.name,
      size: file.size,
      duration: round(video.duration, 3),
      type: file.type || '',
      capturedAt: new Date().toISOString(),
    };
    render();
  }

  function validateCurrentVideoAgainstProject() {
    const fp = state.project.videoFingerprint;
    const video = document.getElementById('video');
    if (!fp || !state.videoFile || !Number.isFinite(video.duration)) return;
    const sameName = fp.name === state.videoFile.name;
    const sameSize = fp.size === state.videoFile.size;
    const sameDuration = Math.abs(fp.duration - round(video.duration, 3)) < 0.05;
    if (!(sameName && sameSize && sameDuration)) {
      alert('Advertencia: el vídeo cargado no coincide con la huella del proyecto (nombre, tamaño o duración).');
    }
  }

  function toggleOverlayLock() {
    state.overlayLocked = !state.overlayLocked;
    render();
  }

  function markServe() {
    if (state.overlayLocked) return;
    const video = document.getElementById('video');
    if (!Number.isFinite(video.currentTime)) {
      alert('Carga un vídeo antes de registrar un saque.');
      return;
    }
    state.pendingServeTime = round(video.currentTime, 3);
    render();
  }

  function registerWinner(winner) {
    if (state.overlayLocked) return;
    if (state.pendingServeTime == null) {
      alert('Primero debes marcar el instante del saque.');
      return;
    }
    pushUndo();
    state.project.rallies.push({
      id: crypto.randomUUID(),
      serveTime: state.pendingServeTime,
      winner,
      note: state.pendingComment.trim(),
      createdAt: new Date().toISOString(),
    });
    state.pendingServeTime = null;
    state.pendingComment = '';
    state.selectedRallyId = state.project.rallies[state.project.rallies.length - 1].id;
    render();
  }

  function fixLastRally() {
    const last = state.project.rallies[state.project.rallies.length - 1];
    if (!last) { alert('No hay rallies para corregir.'); return; }
    state.selectedRallyId = last.id;
    state.activeTab = 'gestion';
    render();
  }

  function manualSetEnd() {
    const current = getCurrentState();
    const winner = prompt(`Finalizar set ${current.setNumber} manualmente. Ganador: A o B`, current.scoreA >= current.scoreB ? 'A' : 'B');
    if (!winner || !['A','B','a','b'].includes(winner)) return;
    pushUndo();
    state.project.manualSetEnds.push({
      rallyId: state.project.rallies[state.project.rallies.length - 1]?.id || null,
      setNumber: current.setNumber,
      winner: winner.toUpperCase(),
      scoreA: current.scoreA,
      scoreB: current.scoreB,
    });
    render();
  }

  function saveEditedRally() {
    const selected = getSelectedRally();
    if (!selected) return;
    const timeInput = document.getElementById('editServeTime');
    const winnerInput = document.getElementById('editWinner');
    const noteInput = document.getElementById('editNote');
    const newTime = parseFloat(timeInput.value);
    if (!Number.isFinite(newTime) || newTime < 0) { alert('Tiempo de saque no válido.'); return; }
    if (!confirm('Se recalcularán automáticamente los marcadores y turnos posteriores. ¿Continuar?')) return;
    pushUndo();
    selected.serveTime = round(newTime, 3);
    selected.winner = winnerInput.value;
    selected.note = noteInput.value;
    render();
  }

  function deleteSelectedRally() {
    const selected = getSelectedRally();
    if (!selected) return;
    if (!confirm('Se borrará el rally y se recalcularán automáticamente los marcadores y turnos posteriores. ¿Continuar?')) return;
    pushUndo();
    state.project.rallies = state.project.rallies.filter(r => r.id !== selected.id);
    state.selectedRallyId = null;
    render();
  }

  function insertAfterSelectedRally() {
    const selected = getSelectedRally();
    if (!selected) return;
    const serveTime = parseFloat(prompt('Tiempo de saque del nuevo rally (segundos):', String(selected.serveTime)));
    if (!Number.isFinite(serveTime) || serveTime < 0) return;
    const winner = prompt('Ganador del rally insertado: A o B', 'A');
    if (!winner || !['A','B','a','b'].includes(winner)) return;
    const note = prompt('Comentario del rally insertado (opcional):', '') || '';
    if (!confirm('Se insertará el rally y se recalcularán automáticamente los marcadores y turnos posteriores. ¿Continuar?')) return;
    pushUndo();
    const idx = state.project.rallies.findIndex(r => r.id === selected.id);
    state.project.rallies.splice(idx + 1, 0, {
      id: crypto.randomUUID(),
      serveTime: round(serveTime, 3),
      winner: winner.toUpperCase(),
      note,
      createdAt: new Date().toISOString(),
    });
    render();
  }

  function jumpToRally(id) {
    const rally = state.project.rallies.find(r => r.id === id);
    if (!rally) return;
    const video = document.getElementById('video');
    video.currentTime = rally.serveTime;
    state.selectedRallyId = id;
    render();
  }

  function togglePlay() {
    const video = document.getElementById('video');
    if (video.paused) video.play(); else video.pause();
  }
  function stepTime(delta) {
    const video = document.getElementById('video');
    video.currentTime = Math.max(0, (video.currentTime || 0) + delta);
  }
  function stepFrame(frames) { stepTime(frames / (state.frameRate || 30)); }

  function getCurrentState() {
    const list = computeRallyStates();
    if (!list.length) {
      return {
        setNumber: state.project.initial.startSet,
        scoreA: state.project.initial.startScoreA,
        scoreB: state.project.initial.startScoreB,
        setsA: state.project.initial.startSetsA,
        setsB: state.project.initial.startSetsB,
        server: state.project.initial.firstServer,
      };
    }
    const last = list[list.length - 1];
    return {
      setNumber: last.nextSetNumber,
      scoreA: last.nextScoreA,
      scoreB: last.nextScoreB,
      setsA: last.nextSetsA,
      setsB: last.nextSetsB,
      server: last.nextServer,
    };
  }

  function computeRallyStates() {
    let setNumber = state.project.initial.startSet || 1;
    let scoreA = state.project.initial.startScoreA || 0;
    let scoreB = state.project.initial.startScoreB || 0;
    let setsA = state.project.initial.startSetsA || 0;
    let setsB = state.project.initial.startSetsB || 0;
    let server = state.project.initial.firstServer || 'A';

    const out = [];
    for (let i = 0; i < state.project.rallies.length; i++) {
      const rally = state.project.rallies[i];
      if (rally.winner === 'A') scoreA += 1; else scoreB += 1;
      server = rally.winner;
      let nextSetNumber = setNumber;
      let nextScoreA = scoreA;
      let nextScoreB = scoreB;
      let nextSetsA = setsA;
      let nextSetsB = setsB;
      let setEnded = false;
      let endedByManual = false;

      const manual = state.project.manualSetEnds.find(x => x.rallyId === rally.id && x.setNumber === setNumber);
      if (manual) {
        setEnded = true;
        endedByManual = true;
      } else if (isSetWon(scoreA, scoreB, setNumber)) {
        setEnded = true;
      }

      if (setEnded) {
        if (scoreA > scoreB) nextSetsA += 1; else nextSetsB += 1;
        nextSetNumber += 1;
        nextScoreA = 0;
        nextScoreB = 0;
      }

      out.push({
        note: '',
        ...rally,
        index: i,
        setNumber,
        scoreA,
        scoreB,
        setsA,
        setsB,
        serverBefore: i === 0 ? (state.project.initial.firstServer || 'A') : out[i - 1].nextServer,
        nextSetNumber,
        nextScoreA,
        nextScoreB,
        nextSetsA,
        nextSetsB,
        nextServer: server,
        setEnded,
        endedByManual,
      });

      setNumber = nextSetNumber;
      scoreA = nextScoreA;
      scoreB = nextScoreB;
      setsA = nextSetsA;
      setsB = nextSetsB;
    }
    return out;
  }

  function isSetWon(scoreA, scoreB, setNumber) {
    const maxSets = state.project.rules.bestOf || 5;
    const isFinalSet = setNumber === maxSets;
    const target = isFinalSet ? state.project.rules.finalSetPoints : state.project.rules.regularSetPoints;
    const maxScore = Math.max(scoreA, scoreB);
    const minScore = Math.min(scoreA, scoreB);
    return maxScore >= target && (!state.project.rules.winByTwo || maxScore - minScore >= 2);
  }

  function renderRecentRallies(n) {
    const list = computeRallyStates().slice(-n).reverse();
    if (!list.length) return '<div class="empty">Todavía no hay rallies registrados.</div>';
    return list.map(r => renderRallyItem(r, true)).join('');
  }

  function renderAllRallies() {
    const list = computeRallyStates();
    if (!list.length) return '<div class="empty">Todavía no hay rallies registrados.</div>';
    return list.map(r => renderRallyItem(r, false)).join('');
  }

  function renderRallyItem(r, compact) {
    const selected = state.selectedRallyId === r.id ? 'active' : '';
    return `
      <div class="log-item ${selected}">
        <div class="log-top">
          <div><strong>Set ${r.setNumber} · ${r.scoreA}-${r.scoreB}</strong></div>
          <div class="muted">${formatTime(r.serveTime)}</div>
        </div>
        <div class="muted">Rally ${r.index + 1} · saca ${r.serverBefore === 'A' ? escapeHtml(state.project.meta.teamA) : escapeHtml(state.project.meta.teamB)} · punto para ${r.winner === 'A' ? escapeHtml(state.project.meta.teamA) : escapeHtml(state.project.meta.teamB)}${r.setEnded ? ' · fin de set' : ''}</div>
        ${r.note ? `<div style="margin-top:6px;">${escapeHtml(r.note)}</div>` : ''}
        ${compact ? '' : `<div class="log-actions"><button class="select-rally-btn small" data-id="${r.id}">Editar</button><button class="jump-rally-btn small" data-id="${r.id}">Ir al saque</button></div>`}
      </div>
    `;
  }

  function renderEditor() {
    const r = computeRallyStates().find(x => x.id === state.selectedRallyId);
    if (!r) return '<div class="empty">Selecciona un rally del historial para editarlo.</div>';
    return `
      <div class="stack" style="margin-top:10px;">
        <div><strong>Rally ${r.index + 1}</strong></div>
        <div class="row">
          <div><label>Tiempo del saque (s)</label><input id="editServeTime" type="number" step="0.001" min="0" value="${r.serveTime}" /></div>
          <div><label>Ganador</label><select id="editWinner"><option value="A" ${r.winner==='A'?'selected':''}>${escapeHtml(state.project.meta.teamA)}</option><option value="B" ${r.winner==='B'?'selected':''}>${escapeHtml(state.project.meta.teamB)}</option></select></div>
        </div>
        <div><label>Comentario</label><textarea id="editNote" rows="4">${escapeHtml(r.note || '')}</textarea></div>
        <div class="muted">Marcador registrado en este rally: set ${r.setNumber} · ${r.scoreA}-${r.scoreB}</div>
        <div class="log-actions">
          <button id="saveEditBtn" class="primary">Guardar cambios</button>
          <button id="insertAfterEditBtn">Insertar después</button>
          <button id="deleteEditBtn" class="danger">Borrar rally</button>
          <button class="jump-rally-btn" data-id="${r.id}">Ir al saque</button>
        </div>
      </div>
    `;
  }

  function saveProjectJson() {
    state.project.savedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(state.project, null, 2)], { type: 'application/json' });
    downloadBlob(blob, safeFileName(`${state.project.meta.teamA}_vs_${state.project.meta.teamB || 'partido'}.json`));
  }

  function exportCsv() {
    const rows = computeRallyStates();
    const headers = ['rally','set','score_a','score_b','sets_a','sets_b','serve_time','server_before','winner','comment','set_ended','manual_set_end','team_a','team_b'];
    const csv = [headers.join(',')].concat(rows.map(r => [
      r.index + 1,
      r.setNumber,
      r.scoreA,
      r.scoreB,
      r.setsA,
      r.setsB,
      r.serveTime,
      r.serverBefore,
      r.winner,
      csvEscape(r.note || ''),
      r.setEnded ? 1 : 0,
      r.endedByManual ? 1 : 0,
      csvEscape(state.project.meta.teamA),
      csvEscape(state.project.meta.teamB),
    ].join(','))).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), safeFileName(`${state.project.meta.teamA}_vs_${state.project.meta.teamB}_rallies.csv`));
  }

  function getSelectedRally() { return state.project.rallies.find(r => r.id === state.selectedRallyId); }

  function syncVideoUI() {
    const video = document.getElementById('video');
    const current = document.getElementById('currentTimeLabel');
    const duration = document.getElementById('durationLabel');
    const seek = document.getElementById('seekRange');
    const playBtn = document.getElementById('playPauseBtn');
    if (!video || !current || !duration || !seek) return;
    current.textContent = formatTime(video.currentTime || 0);
    duration.textContent = Number.isFinite(video.duration) ? formatTime(video.duration) : '00:00.000';
    if (playBtn) playBtn.textContent = video.paused ? '▶' : '⏸';
    if (Number.isFinite(video.duration) && video.duration > 0) {
      seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
    }
  }

  function pushUndo() {
    state.undoStack.push(JSON.stringify(state.project));
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
  }
  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify(state.project));
    state.project = JSON.parse(state.undoStack.pop());
    render();
  }
  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify(state.project));
    state.project = JSON.parse(state.redoStack.pop());
    render();
  }

  function formatTime(sec) {
    sec = Math.max(0, sec || 0);
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  }
  function round(n, d = 3) { return Number(n.toFixed(d)); }
  function safeFileName(s) { return s.replace(/[^a-z0-9_\-.]+/gi, '_'); }
  function csvEscape(v) { return `"${String(v).replaceAll('"', '""')}"`; }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeAttr(s) { return escapeHtml(s); }
  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function waitForMetadata(video) {
    return new Promise(resolve => {
      if (Number.isFinite(video.duration) && video.duration > 0) return resolve();
      video.onloadedmetadata = () => { syncVideoUI(); if (state.project.videoFingerprint) validateCurrentVideoAgainstProject(); resolve(); };
    });
  }
  function videoMetaLabel() {
    if (!state.videoFile || !state.project.videoFingerprint) return 'Sin vídeo o sin huella registrada.';
    return `${state.project.videoFingerprint.name} · ${Math.round(state.project.videoFingerprint.size / 1024 / 1024 * 10)/10} MB · ${state.project.videoFingerprint.duration}s`;
  }
})();
