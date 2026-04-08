// ── Bracket UI Handlers ──
window._substituteFromStandby = function (tId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;

  const select = document.getElementById('standby-wo-select');
  if (!select || !select.value) {
    showAlertDialog('Selecione o Ausente', 'Escolha quem não compareceu para realizar a substituição.', null, { type: 'warning' });
    return;
  }

  const standby = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
  if (standby.length === 0) {
    showAlertDialog('Lista Vazia', 'Não há mais participantes na lista de espera.', null, { type: 'warning' });
    return;
  }

  const mode = (t.standbyMode === 'disqualify') ? 'teams' : (t.standbyMode || 'teams');
  const teamSize = parseInt(t.teamSize) || 1;
  const getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name || p.email || '?');

  if (mode === 'individual') {
    // Individual mode: replace one member inside a team
    const parts = select.value.split('|');
    const matchId = parts[0];
    const slot = parts[1];
    const memberIdx = parseInt(parts[2]);
    const absentPlayer = parts[3];

    const m = _findMatch(t, matchId);
    if (!m) return;

    const replacement = standby[0];
    const replacementName = getName(replacement);
    const teamName = m[slot];

    let confirmMsg = '';
    let newTeamName = teamName;
    if (teamName.includes(' / ') && memberIdx >= 0) {
      const members = teamName.split(' / ');
      members[memberIdx] = replacementName;
      newTeamName = members.join(' / ');
      confirmMsg = `<div><strong style="color:#ef4444;">Ausente:</strong> ${window._safeHtml(absentPlayer)} (do time "${window._safeHtml(teamName)}")</div>
        <div><strong style="color:#4ade80;">Substituto:</strong> ${window._safeHtml(replacementName)}</div>
        <div style="margin-top:6px;"><strong>Novo time:</strong> ${window._safeHtml(newTeamName)}</div>`;
    } else {
      newTeamName = replacementName;
      confirmMsg = `<div><strong style="color:#ef4444;">Ausente:</strong> ${window._safeHtml(absentPlayer)}</div>
        <div><strong style="color:#4ade80;">Substituto:</strong> ${window._safeHtml(replacementName)}</div>`;
    }

    showConfirmDialog('Confirmar Substituição Individual',
      `<div style="text-align:left;line-height:1.8;">${confirmMsg}
        <div style="margin-top:8px;font-size:0.85rem;color:#94a3b8;">O jogador ausente será substituído dentro do time.</div>
      </div>`,
      function () {
        const oldTeamName = m[slot];
        m[slot] = newTeamName;
        t.standbyParticipants = standby.slice(1);

        // Update participants array
        const partsArr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
        const idx = partsArr.findIndex(p => getName(p) === oldTeamName);
        if (idx !== -1) partsArr[idx] = newTeamName;
        t.participants = partsArr;

        // Update all match references
        (t.matches || []).forEach(match => {
          if (match.p1 === oldTeamName) match.p1 = newTeamName;
          if (match.p2 === oldTeamName) match.p2 = newTeamName;
          if (match.winner === oldTeamName) match.winner = newTeamName;
        });
        (t.rounds || []).forEach(r => (r.matches || []).forEach(match => {
          if (match.p1 === oldTeamName) match.p1 = newTeamName;
          if (match.p2 === oldTeamName) match.p2 = newTeamName;
          if (match.winner === oldTeamName) match.winner = newTeamName;
        }));

        window.AppStore.logAction(tId, `Substituição individual: ${absentPlayer} → ${replacementName} (time: ${newTeamName})`);
        window.AppStore.syncImmediate(tId);
        showNotification('Substituição Realizada', `${replacementName} entrou no lugar de ${absentPlayer}`, 'success');
        renderBracket(document.getElementById('view-container'), tId);
      }, null,
      { type: 'warning', confirmText: 'Confirmar Substituição', cancelText: 'Cancelar' }
    );

  } else {
    // Teams mode: disqualify incomplete team and replace with standby team
    const [matchId, slot] = select.value.split('|');
    const m = _findMatch(t, matchId);
    if (!m) return;

    const absentTeam = m[slot];

    // Build replacement team from standby list
    let replacementName = '';
    let consumeCount = 1;
    if (teamSize > 1 && !standby[0].toString().includes(' / ')) {
      // Need to form a team from individual standby players
      consumeCount = Math.min(teamSize, standby.length);
      if (consumeCount < teamSize) {
        showAlertDialog('Jogadores Insuficientes', `São necessários ${teamSize} jogadores para formar um time, mas só há ${standby.length} na lista de espera.`, null, { type: 'warning' });
        return;
      }
      replacementName = standby.slice(0, teamSize).map(p => getName(p)).join(' / ');
    } else {
      replacementName = getName(standby[0]);
      consumeCount = 1;
    }

    showConfirmDialog(
      'Desclassificar e Substituir Time',
      `<div style="text-align:left;line-height:1.8;">
        <div><strong style="color:#ef4444;">Desclassificado:</strong> ${window._safeHtml(absentTeam)}</div>
        <div><strong style="color:#4ade80;">Substituto:</strong> ${window._safeHtml(replacementName)}</div>
        <div style="margin-top:8px;font-size:0.85rem;color:#94a3b8;">O time incompleto será desclassificado e o substituto ocupará a vaga na mesma partida.</div>
      </div>`,
      function () {
        m[slot] = replacementName;
        t.standbyParticipants = standby.slice(consumeCount);

        const partsArr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
        const absentIdx = partsArr.findIndex(p => getName(p) === absentTeam);
        if (absentIdx !== -1) partsArr.splice(absentIdx, 1);
        partsArr.push(replacementName);
        t.participants = partsArr;

        (t.matches || []).forEach(match => {
          if (match.p1 === absentTeam) match.p1 = replacementName;
          if (match.p2 === absentTeam) match.p2 = replacementName;
          if (match.winner === absentTeam) match.winner = replacementName;
        });
        (t.rounds || []).forEach(r => (r.matches || []).forEach(match => {
          if (match.p1 === absentTeam) match.p1 = replacementName;
          if (match.p2 === absentTeam) match.p2 = replacementName;
          if (match.winner === absentTeam) match.winner = replacementName;
        }));

        window.AppStore.logAction(tId, `Desclassificação: ${absentTeam} → ${replacementName}`);
        window.AppStore.syncImmediate(tId);
        showNotification('Substituição Realizada', `${replacementName} entrou no lugar de ${absentTeam}`, 'success');
        renderBracket(document.getElementById('view-container'), tId);
      }, null,
      { type: 'warning', confirmText: 'Desclassificar e Substituir', cancelText: 'Cancelar' }
    );
  }
};

window._toggleBracketMode = function (tId) {
  window._bracketMirrorMode = !window._bracketMirrorMode;
  renderBracket(document.getElementById('view-container'), tId);
};

window._setBracketZoom = function (tId, delta) {
  const steps = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  let cur = steps.indexOf(window._bracketZoom);
  if (cur === -1) cur = steps.length - 1; // default to 1.0
  cur = Math.max(0, Math.min(steps.length - 1, cur + delta));
  window._bracketZoom = steps[cur];
  // Apply zoom without full re-render for smooth experience
  const content = document.querySelector('.bracket-scroll-content');
  if (content) {
    content.style.transform = `scale(${window._bracketZoom})`;
    content.style.transformOrigin = 'top left';
  }
  // Update zoom label
  const label = document.getElementById('bracket-zoom-label');
  if (label) label.textContent = Math.round(window._bracketZoom * 100) + '%';
  // Sync slider
  const slider = document.getElementById('bracket-zoom-slider');
  if (slider) slider.value = cur;
  // Recalculate fixed scrollbar width
  _recalcFixedScrollbar();
};

window._resetBracketZoom = function (tId) {
  window._bracketZoom = 1;
  const content = document.querySelector('.bracket-scroll-content');
  if (content) {
    content.style.transform = '';
    content.style.transformOrigin = '';
  }
  const label = document.getElementById('bracket-zoom-label');
  if (label) label.textContent = '100%';
  const slider = document.getElementById('bracket-zoom-slider');
  if (slider) slider.value = 7; // index of 1.0 in steps array
  _recalcFixedScrollbar();
};

function _recalcFixedScrollbar() {
  const wrapper = document.querySelector('.bracket-sticky-scroll-wrapper');
  const content = wrapper ? wrapper.querySelector('.bracket-scroll-content') : null;
  const bar = document.getElementById('bracket-fixed-scrollbar');
  if (!wrapper || !content) return;
  const scaledWidth = content.scrollWidth * window._bracketZoom;
  wrapper.style.height = (content.scrollHeight * window._bracketZoom) + 'px';
  if (bar) {
    const inner = bar.firstChild;
    if (inner) inner.style.width = scaledWidth + 'px';
  }
}

window._toggleRoundVisibility = function (tId, roundNum) {
  if (!window._hiddenRounds[tId]) window._hiddenRounds[tId] = new Set();
  const set = window._hiddenRounds[tId];
  if (set.has(roundNum)) {
    // "Mostrar" — unhide this round AND all rounds before it (restore everything up to this point)
    const toShow = [];
    set.forEach(r => { if (r <= roundNum) toShow.push(r); });
    toShow.forEach(r => set.delete(r));
  } else {
    // "Ocultar" — hide this round
    set.add(roundNum);
  }
  renderBracket(document.getElementById('view-container'), tId);
};

window._highlightWinner = function (matchId) {
  const s1El = document.getElementById(`s1-${matchId}`);
  const s2El = document.getElementById(`s2-${matchId}`);
  if (!s1El || !s2El) return;
  const s1 = parseInt(s1El.value);
  const s2 = parseInt(s2El.value);
  if (isNaN(s1) || isNaN(s2)) return;
  s1El.style.color = s1 > s2 ? '#4ade80' : s1 < s2 ? '#f87171' : 'var(--text-bright)';
  s2El.style.color = s2 > s1 ? '#4ade80' : s2 < s1 ? '#f87171' : 'var(--text-bright)';
};

// ─── Save result inline ───────────────────────────────────────────────────────
// ─── Set Scoring Overlay ─────────────────────────────────────────────────────
window._openSetScoring = function(tId, matchId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t || !t.scoring) return;
  const m = _findMatch(t, matchId);
  if (!m) return;

  const sc = t.scoring;
  const totalSets = sc.setsToWin * 2 - 1;
  const p1Name = m.p1 || 'Jogador 1';
  const p2Name = m.p2 || 'Jogador 2';
  const _esc = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };

  // Remove existing overlay
  const existing = document.getElementById('set-scoring-overlay');
  if (existing) existing.remove();

  let setsHtml = '';
  for (let i = 0; i < totalSets; i++) {
    const isDecidingSet = (i === totalSets - 1) && sc.superTiebreak;
    const label = isDecidingSet ? 'Super Tie-break' : 'Set ' + (i + 1);
    setsHtml += '<div class="set-row" data-set="' + i + '" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
      '<div style="width:100px;font-size:0.82rem;font-weight:600;color:var(--text-muted);">' + label + '</div>' +
      '<input type="number" id="set-p1-' + i + '" min="0" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:8px;" oninput="window._checkSetComplete(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\',' + i + ')">' +
      '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:800;">×</span>' +
      '<input type="number" id="set-p2-' + i + '" min="0" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:8px;" oninput="window._checkSetComplete(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\',' + i + ')">' +
      '<div id="tb-indicator-' + i + '" style="font-size:0.72rem;color:#c084fc;font-weight:600;min-width:60px;"></div>' +
    '</div>';
  }

  // Tiebreak input row (shown dynamically when needed)
  setsHtml += '<div id="tb-input-row" style="display:none;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
    '<div style="display:flex;align-items:center;gap:12px;">' +
      '<div style="width:100px;font-size:0.82rem;font-weight:600;color:#c084fc;">Tie-break</div>' +
      '<input type="number" id="tb-p1" min="0" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);color:var(--text-bright);border-radius:8px;padding:8px;">' +
      '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:800;">×</span>' +
      '<input type="number" id="tb-p2" min="0" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);color:var(--text-bright);border-radius:8px;padding:8px;">' +
    '</div>' +
    '<div id="tb-for-set" style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;padding-left:100px;"></div>' +
  '</div>';

  const overlay = document.createElement('div');
  overlay.id = 'set-scoring-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);z-index:100001;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';

  overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);width:94%;max-width:500px;border-radius:20px;border:1px solid rgba(168,85,247,0.25);box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;margin:auto 0;max-height:90vh;display:flex;flex-direction:column;">' +
    '<div style="background:linear-gradient(135deg,#6d28d9 0%,#a855f7 100%);padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
      '<div>' +
        '<h3 style="margin:0;color:#f5f3ff;font-size:1.05rem;font-weight:800;">🎾 Resultado por Sets</h3>' +
        '<p style="margin:2px 0 0;color:#e9d5ff;font-size:0.75rem;">' + sc.setsToWin + ' set' + (sc.setsToWin > 1 ? 's' : '') + ' · ' + sc.gamesPerSet + ' games/set</p>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button type="button" onclick="document.getElementById(\'set-scoring-overlay\').remove();" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#f5f3ff;border:1px solid rgba(255,255,255,0.25);">Cancelar</button>' +
        '<button type="button" id="btn-save-sets" onclick="window._saveSetResult(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\')" class="btn btn-sm" style="background:#fff;color:#6d28d9;font-weight:700;border:none;" disabled>Salvar</button>' +
      '</div>' +
    '</div>' +
    '<div style="padding:1rem 1.5rem;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">' +
      '<div style="display:flex;gap:12px;margin-bottom:1rem;padding:8px 0;font-weight:700;font-size:0.85rem;">' +
        '<div style="width:100px;"></div>' +
        '<div style="width:56px;text-align:center;color:var(--text-bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + window._safeHtml(p1Name) + '">' + window._safeHtml(p1Name.split(' ')[0]) + '</div>' +
        '<div style="width:14px;"></div>' +
        '<div style="width:56px;text-align:center;color:var(--text-bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + window._safeHtml(p2Name) + '">' + window._safeHtml(p2Name.split(' ')[0]) + '</div>' +
      '</div>' +
      setsHtml +
      '<div id="set-scoring-status" style="margin-top:12px;padding:8px 12px;border-radius:8px;font-size:0.82rem;font-weight:600;text-align:center;"></div>' +
    '</div>' +
  '</div>';

  document.body.appendChild(overlay);
};

window._checkSetComplete = function(tId, matchId, setIndex) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t || !t.scoring) return;
  const sc = t.scoring;
  const totalSets = sc.setsToWin * 2 - 1;
  const gps = sc.gamesPerSet;
  let p1Sets = 0, p2Sets = 0;
  let allValid = true;
  let needsTiebreak = -1;

  for (let i = 0; i < totalSets; i++) {
    const el1 = document.getElementById('set-p1-' + i);
    const el2 = document.getElementById('set-p2-' + i);
    if (!el1 || !el2) continue;
    const g1 = parseInt(el1.value);
    const g2 = parseInt(el2.value);
    const indicator = document.getElementById('tb-indicator-' + i);

    if (isNaN(g1) || isNaN(g2)) {
      if (p1Sets >= sc.setsToWin || p2Sets >= sc.setsToWin) {
        el1.style.opacity = '0.3';
        el2.style.opacity = '0.3';
        if (indicator) indicator.textContent = '';
      } else {
        allValid = false;
        el1.style.opacity = '1';
        el2.style.opacity = '1';
      }
      continue;
    }

    el1.style.opacity = '1';
    el2.style.opacity = '1';

    if (!isNaN(g1) && !isNaN(g2)) {
      if (g1 === gps && g2 === gps) {
        needsTiebreak = i;
        if (indicator) indicator.textContent = 'Tie-break!';
      } else {
        if (indicator) indicator.textContent = '';
      }

      if (g1 > g2) p1Sets++;
      else if (g2 > g1) p2Sets++;
    }
  }

  const tbRow = document.getElementById('tb-input-row');
  if (tbRow) {
    tbRow.style.display = needsTiebreak >= 0 ? 'block' : 'none';
    const tbLabel = document.getElementById('tb-for-set');
    if (tbLabel) tbLabel.textContent = 'Para o Set ' + (needsTiebreak + 1);
  }

  const statusEl = document.getElementById('set-scoring-status');
  const saveBtn = document.getElementById('btn-save-sets');
  const matchDecided = p1Sets >= sc.setsToWin || p2Sets >= sc.setsToWin;

  if (statusEl) {
    if (matchDecided) {
      statusEl.style.background = 'rgba(16,185,129,0.1)';
      statusEl.style.color = '#4ade80';
      statusEl.textContent = (p1Sets >= sc.setsToWin ? 'Jogador 1' : 'Jogador 2') + ' vence ' + p1Sets + '-' + p2Sets;
    } else {
      statusEl.style.background = 'rgba(245,158,11,0.1)';
      statusEl.style.color = '#f59e0b';
      statusEl.textContent = 'Em andamento: ' + p1Sets + '-' + p2Sets;
    }
  }

  if (saveBtn) saveBtn.disabled = !matchDecided;
};

window._saveSetResult = function(tId, matchId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t || !t.scoring) return;
  const m = _findMatch(t, matchId);
  if (!m) return;

  const sc = t.scoring;
  const totalSets = sc.setsToWin * 2 - 1;
  let sets = [];
  let p1Sets = 0, p2Sets = 0;

  for (let i = 0; i < totalSets; i++) {
    const el1 = document.getElementById('set-p1-' + i);
    const el2 = document.getElementById('set-p2-' + i);
    if (!el1 || !el2) continue;
    const g1 = parseInt(el1.value);
    const g2 = parseInt(el2.value);
    if (isNaN(g1) || isNaN(g2)) break;

    const setData = { gamesP1: g1, gamesP2: g2 };

    if (g1 === sc.gamesPerSet && g2 === sc.gamesPerSet) {
      const tbP1 = parseInt(document.getElementById('tb-p1')?.value) || 0;
      const tbP2 = parseInt(document.getElementById('tb-p2')?.value) || 0;
      setData.tiebreak = { pointsP1: tbP1, pointsP2: tbP2 };
      var tbMargin = (sc.tiebreakMargin || 2);
      var tbTarget = (sc.tiebreakPoints || 7);
      var tbComplete = (tbP1 >= tbTarget || tbP2 >= tbTarget) && Math.abs(tbP1 - tbP2) >= tbMargin;
      if (tbComplete && tbP1 > tbP2) { setData.gamesP1 = g1 + 1; }
      else if (tbComplete && tbP2 > tbP1) { setData.gamesP2 = g2 + 1; }
    }

    sets.push(setData);
    if (g1 > g2) p1Sets++;
    else if (g2 > g1) p2Sets++;

    if (p1Sets >= sc.setsToWin || p2Sets >= sc.setsToWin) break;
  }

  m.sets = sets;
  m.scoreP1 = p1Sets;
  m.scoreP2 = p2Sets;
  m.setsWonP1 = p1Sets;
  m.setsWonP2 = p2Sets;

  let totalGamesP1 = 0, totalGamesP2 = 0;
  sets.forEach(s => {
    totalGamesP1 += s.gamesP1;
    totalGamesP2 += s.gamesP2;
  });
  m.totalGamesP1 = totalGamesP1;
  m.totalGamesP2 = totalGamesP2;

  if (p1Sets > p2Sets) {
    m.winner = m.p1;
    m.draw = false;
  } else if (p2Sets > p1Sets) {
    m.winner = m.p2;
    m.draw = false;
  }

  const ov = document.getElementById('set-scoring-overlay');
  if (ov) ov.remove();

  const isGroupMatch = m.group !== undefined;
  const isRoundMatch = m.roundIndex !== undefined || (t.rounds && t.rounds.some(r => (r.matches || []).some(rm => rm.id === matchId)));

  if (!isGroupMatch && !isRoundMatch) {
    _advanceWinner(t, m);
    showNotification('Resultado Salvo', m.winner + ' vence ' + p1Sets + '-' + p2Sets + '!', 'success');
  } else if (isRoundMatch) {
    showNotification('Resultado Salvo', m.winner + ' vence ' + p1Sets + '-' + p2Sets + '!', 'success');
  } else {
    _checkGroupRoundComplete(t, m.group);
    showNotification('Resultado Salvo', m.winner + ' vence ' + p1Sets + '-' + p2Sets + '!', 'success');
  }

  if (!t.checkedIn) t.checkedIn = {};
  if (!t.absent) t.absent = {};
  [m.p1, m.p2].forEach(side => {
    if (!side || side === 'TBD' || side === 'BYE') return;
    if (side.includes(' / ')) {
      side.split(' / ').forEach(n => { const nm = n.trim(); if (nm) { t.checkedIn[nm] = t.checkedIn[nm] || Date.now(); delete t.absent[nm]; } });
    } else {
      t.checkedIn[side] = t.checkedIn[side] || Date.now();
      delete t.absent[side];
    }
  });
  if (!t.tournamentStarted) t.tournamentStarted = Date.now();

  const scoreText = sets.map(s => s.gamesP1 + '-' + s.gamesP2 + (s.tiebreak ? '(' + Math.min(s.tiebreak.pointsP1, s.tiebreak.pointsP2) + ')' : '')).join(' ');

  window.AppStore.logAction(tId, 'Resultado: ' + m.p1 + ' vs ' + m.p2 + ' — ' + scoreText + ' — Vencedor: ' + m.winner);
  window.AppStore.syncImmediate(tId);

  if (typeof window._sendUserNotification === 'function') {
    const _resultText = m.p1 + ' vs ' + m.p2 + ' — ' + scoreText + ' — Vencedor: ' + m.winner;
    const _notifData = {
      type: 'result',
      title: 'Resultado registrado',
      message: _resultText,
      tournamentId: tId,
      tournamentName: t.name,
      level: 'all',
      timestamp: Date.now()
    };
    const _parts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
    [m.p1, m.p2].forEach(playerName => {
      if (!playerName || playerName === 'TBD' || playerName === 'BYE') return;
      const _found = _parts.find(p => {
        const pName = typeof p === 'string' ? p : (p.displayName || p.name || '');
        return pName === playerName;
      });
      if (_found && typeof _found === 'object' && _found.uid) {
        window._sendUserNotification(_found.uid, _notifData);
      }
    });
  }

  renderBracket(document.getElementById('view-container'), tId);
};

window._saveResultInline = function (tId, matchId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  const m = _findMatch(t, matchId);
  if (!m) return;

  const s1El = document.getElementById(`s1-${matchId}`);
  const s2El = document.getElementById(`s2-${matchId}`);

  const s1 = s1El ? parseInt(s1El.value) : NaN;
  const s2 = s2El ? parseInt(s2El.value) : NaN;

  if (isNaN(s1) || isNaN(s2)) {
    showAlertDialog('Placar Inválido', 'Preencha o placar dos dois times antes de confirmar.', null, { type: 'warning' });
    return;
  }
  const isGroupMatch = m.group !== undefined;
  // Empate é permitido em: Grupos, Liga, Suíço, Ranking (rodadas)
  // Empate NÃO é permitido em: Eliminatórias (simples e dupla)
  const isRoundMatch = m.roundIndex !== undefined || (t.rounds && t.rounds.some(function(r) {
    return (r.matches || []).some(function(rm) { return rm.id === matchId; });
  }));
  const allowDraw = isGroupMatch || isRoundMatch;

  if (s1 === s2 && !allowDraw) {
    showAlertDialog('Empate não permitido', 'O torneio eliminatório não aceita empate. Corrija o placar.', null, { type: 'warning' });
    return;
  }

  m.scoreP1 = s1;
  m.scoreP2 = s2;

  if (s1 === s2 && allowDraw) {
    // Empate — ambos ganham 1 ponto (tratado na standings)
    m.winner = 'draw';
    m.draw = true;
  } else {
    m.winner = s1 > s2 ? m.p1 : m.p2;
    m.draw = false;
  }

  if (!isGroupMatch && !isRoundMatch) {
    // Eliminatórias — vencedor avança
    _advanceWinner(t, m);
    showNotification('Resultado Salvo', `${m.winner} avança!`, 'success');
  } else if (isRoundMatch) {
    // Liga/Suíço/Ranking — atualizar standings
    showNotification('Resultado Salvo', `${m.draw ? 'Empate!' : m.winner + ' venceu!'}`, 'success');
  } else {
    // Check if current group round is complete, activate next
    _checkGroupRoundComplete(t, m.group);
    showNotification('Resultado Salvo', `${m.draw ? 'Empate!' : m.winner + ' venceu!'}`, 'success');
  }

  // Auto check-in: marcar presença de todos os participantes deste jogo (e limpar ausência se existia)
  if (!t.checkedIn) t.checkedIn = {};
  if (!t.absent) t.absent = {};
  [m.p1, m.p2].forEach(side => {
    if (!side || side === 'TBD' || side === 'BYE') return;
    if (side.includes(' / ')) {
      side.split(' / ').forEach(n => { const nm = n.trim(); if (nm) { t.checkedIn[nm] = t.checkedIn[nm] || Date.now(); delete t.absent[nm]; } });
    } else {
      t.checkedIn[side] = t.checkedIn[side] || Date.now();
      delete t.absent[side];
    }
  });
  if (!t.tournamentStarted) t.tournamentStarted = Date.now();

  window.AppStore.logAction(tId, `Resultado: ${m.p1} ${s1} × ${s2} ${m.p2}${m.draw ? ' — Empate' : ' — Vencedor: ' + m.winner}`);
  window.AppStore.syncImmediate(tId);

  // Notify match participants about the result
  if (typeof window._sendUserNotification === 'function') {
    var _resultText = m.draw
      ? (m.p1 + ' ' + s1 + ' × ' + s2 + ' ' + m.p2 + ' — Empate')
      : (m.p1 + ' ' + s1 + ' × ' + s2 + ' ' + m.p2 + ' — Vencedor: ' + m.winner);
    var _notifData = {
      type: 'result',
      title: 'Resultado registrado',
      message: _resultText,
      tournamentId: tId,
      tournamentName: t.name,
      level: 'all',
      timestamp: Date.now()
    };
    // Find UIDs for both players and send notifications
    var _parts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
    [m.p1, m.p2].forEach(function(playerName) {
      if (!playerName || playerName === 'TBD' || playerName === 'BYE') return;
      var _found = _parts.find(function(p) {
        var pName = typeof p === 'string' ? p : (p.displayName || p.name || '');
        return pName === playerName;
      });
      if (_found && typeof _found === 'object' && _found.uid) {
        window._sendUserNotification(_found.uid, _notifData);
      }
    });
  }

  // Remember next match to scroll to after re-render
  var _scrollToMatchId = m.nextMatchId || null;

  renderBracket(document.getElementById('view-container'), tId);

  // Auto-scroll to next match where the winner advances
  if (_scrollToMatchId) {
    setTimeout(function() {
      var nextEl = document.getElementById('match-card-' + _scrollToMatchId) || document.querySelector('[data-match-id="' + _scrollToMatchId + '"]');
      if (nextEl) {
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        nextEl.style.transition = 'box-shadow 0.3s';
        nextEl.style.boxShadow = '0 0 20px rgba(59,130,246,0.5)';
        setTimeout(function() { nextEl.style.boxShadow = ''; }, 2000);
      }
    }, 300);
  }
};

window._editResult = function (tId, matchId) {
  showConfirmDialog(
    'Editar Resultado',
    'Apagar o resultado atual e permitir novo lançamento? O avanço do vencedor anterior será revertido.',
    () => {
      const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
      if (!t) return;
      const m = _findMatch(t, matchId);
      if (!m) return;

      // Undo winner advancement: clear p1/p2 from next match where this winner was placed
      if (m.nextMatchId) {
        const next = _findMatch(t, m.nextMatchId);
        if (next && !next.winner) {
          if (next.p1 === m.winner) next.p1 = 'TBD';
          if (next.p2 === m.winner) next.p2 = 'TBD';
        }
      }

      const prevWinner = m.winner;
      m.winner = null;
      m.scoreP1 = undefined;
      m.scoreP2 = undefined;

      window.AppStore.logAction(tId, `Resultado editado: partida ${m.label || matchId} reaberta`);
      window.AppStore.syncImmediate(tId);
      renderBracket(document.getElementById('view-container'), tId);
    },
    null,
    { type: 'warning', confirmText: 'Apagar e Reeditar', cancelText: 'Cancelar' }
  );
};

// ─── Share match result ──────────────────────────────────────────────────────
window._shareMatchResult = function(tId, matchId) {
  var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
  if (!t) return;
  var m = null;
  // Find match in all structures
  var sources = [];
  if (Array.isArray(t.matches)) sources = sources.concat(t.matches);
  if (t.thirdPlaceMatch) sources.push(t.thirdPlaceMatch);
  if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) sources = sources.concat(r.matches); });
  if (Array.isArray(t.groups)) t.groups.forEach(function(g) { if (g && Array.isArray(g.matches)) sources = sources.concat(g.matches); if (g && Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr)) sources = sources.concat(gr); }); });
  if (Array.isArray(t.rodadas)) t.rodadas.forEach(function(r) { if (r && Array.isArray(r.matches)) sources = sources.concat(r.matches); else if (Array.isArray(r)) sources = sources.concat(r); });
  m = sources.find(function(mx) { return mx && String(mx.id) === String(matchId); });
  if (!m || !m.winner) return;

  var isDraw = m.winner === 'draw' || m.draw;
  var score = (m.scoreP1 !== undefined && m.scoreP1 !== null) ? (m.scoreP1 + ' x ' + m.scoreP2) : '';
  var resultText = isDraw ? 'Empate' : ('🏆 ' + m.winner);
  var text = '⚔️ ' + (m.p1 || '?') + ' vs ' + (m.p2 || '?');
  if (score) text += ' (' + score + ')';
  text += '\n' + resultText;
  text += '\n📋 ' + (t.name || 'Torneio');
  if (t.sport) text += ' — ' + t.sport;
  text += '\n\n🔗 ' + window._tournamentUrl(tId);

  if (navigator.share) {
    navigator.share({ title: 'Resultado — ' + t.name, text: text, url: window._tournamentUrl(tId) }).catch(function() {});
  } else {
    // Clipboard fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        if (typeof window.showAlertDialog === 'function') {
          window.showAlertDialog('📋 Resultado copiado!', 'Cole no WhatsApp, Instagram ou onde quiser.');
        }
      }).catch(function() {});
    }
  }
};

// ─── Print bracket ───────────────────────────────────────────────────────────
window._printBracket = function() {
  window.print();
};

// ─── Sort standings table by clicking column headers ─────────────────────────
window._sortStandingsTable = function(thElement) {
  var table = thElement.closest('table');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  if (!tbody) return;
  var colIdx = parseInt(thElement.getAttribute('data-sort-col'));
  var sortType = thElement.getAttribute('data-sort-type') || 'num';
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  // Determine sort direction
  var currentDir = thElement.getAttribute('data-sort-dir') || 'none';
  var newDir = (currentDir === 'desc') ? 'asc' : 'desc';
  // Default: first click on # is asc, first click on text cols is asc, first click on numeric cols is desc
  if (currentDir === 'none') {
    newDir = (colIdx === 0 || sortType === 'text') ? 'asc' : 'desc';
  }

  // Reset all arrows in this table header
  var allThs = table.querySelectorAll('th[data-sort-col]');
  allThs.forEach(function(th) {
    th.setAttribute('data-sort-dir', 'none');
    var arrow = th.querySelector('.sort-arrow');
    if (arrow) { arrow.textContent = '⇅'; arrow.style.opacity = '0.4'; }
  });

  // Set active arrow
  thElement.setAttribute('data-sort-dir', newDir);
  var activeArrow = thElement.querySelector('.sort-arrow');
  if (activeArrow) {
    activeArrow.textContent = newDir === 'desc' ? '▼' : '▲';
    activeArrow.style.opacity = '1';
  }

  // Sort rows
  rows.sort(function(a, b) {
    var cellA = a.querySelectorAll('td')[colIdx];
    var cellB = b.querySelectorAll('td')[colIdx];
    if (!cellA || !cellB) return 0;
    var valA = cellA.textContent.trim();
    var valB = cellB.textContent.trim();

    if (sortType === 'text') {
      var cmp = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
      return newDir === 'asc' ? cmp : -cmp;
    } else {
      // Parse numeric: handle medals (🥇=1, 🥈=2, 🥉=3), +/- signs
      var numA = parseFloat(valA.replace(/[^\d\-\.]/g, '')) || 0;
      var numB = parseFloat(valB.replace(/[^\d\-\.]/g, '')) || 0;
      // Special handling for medal emojis in position column
      if (colIdx === 0) {
        if (valA.includes('🥇')) numA = 1;
        else if (valA.includes('🥈')) numA = 2;
        else if (valA.includes('🥉')) numA = 3;
        else numA = parseInt(valA.replace(/[^\d]/g, '')) || 999;
        if (valB.includes('🥇')) numB = 1;
        else if (valB.includes('🥈')) numB = 2;
        else if (valB.includes('🥉')) numB = 3;
        else numB = parseInt(valB.replace(/[^\d]/g, '')) || 999;
      }
      return newDir === 'asc' ? (numA - numB) : (numB - numA);
    }
  });

  // Re-insert sorted rows
  rows.forEach(function(row) { tbody.appendChild(row); });
};


window._tvModeInterval = null;

// Build "Próximos Jogos" section for TV mode
window._tvBuildNextMatches = function(t) {
  var allMatches = [];
  if (Array.isArray(t.matches)) {
    t.matches.forEach(function(m) { if (m.p1 && m.p2 && !m.winner && !m.isBye) allMatches.push(m); });
  }
  if (Array.isArray(t.rounds)) {
    t.rounds.forEach(function(r, ri) {
      (r.matches || []).forEach(function(m) {
        if (m.p1 && m.p2 && !m.winner) { m._roundLabel = 'Rodada ' + (ri + 1); allMatches.push(m); }
      });
    });
  }
  if (Array.isArray(t.groups)) {
    t.groups.forEach(function(g, gi) {
      (g.matches || []).forEach(function(m) {
        if (m.p1 && m.p2 && !m.winner) { m._roundLabel = 'Grupo ' + (g.name || (gi + 1)); allMatches.push(m); }
      });
    });
  }
  var upcoming = allMatches.slice(0, 6);
  if (upcoming.length === 0) return '';
  var html = '<div style="margin-bottom:1.5rem;">';
  html += '<div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:12px;">Próximos Jogos</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">';
  upcoming.forEach(function(m) {
    var courtInfo = m.court ? '<div style="font-size:0.7rem;color:#818cf8;margin-top:4px;">📍 ' + window._safeHtml(m.court) + '</div>' : '';
    var roundInfo = m._roundLabel ? '<div style="font-size:0.65rem;color:rgba(255,255,255,0.3);margin-top:2px;">' + window._safeHtml(m._roundLabel) + '</div>' : '';
    var presenceP1 = m.presenceP1 ? '✅' : '⏳';
    var presenceP2 = m.presenceP2 ? '✅' : '⏳';
    html += '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px 16px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="flex:1;text-align:center;">';
    html += '<div style="font-size:1rem;font-weight:700;color:white;">' + presenceP1 + ' ' + window._safeHtml(m.p1 || 'TBD') + '</div>';
    html += '</div>';
    html += '<div style="font-size:0.9rem;font-weight:800;color:rgba(255,255,255,0.25);margin:0 12px;">VS</div>';
    html += '<div style="flex:1;text-align:center;">';
    html += '<div style="font-size:1rem;font-weight:700;color:white;">' + window._safeHtml(m.p2 || 'TBD') + ' ' + presenceP2 + '</div>';
    html += '</div>';
    html += '</div>';
    html += courtInfo + roundInfo;
    html += '</div>';
  });
  html += '</div></div>';
  return html;
};

// Build attendance/presence summary for TV mode
window._tvBuildAttendance = function(t) {
  var allMatches = [];
  if (Array.isArray(t.matches)) allMatches = allMatches.concat(t.matches);
  if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { allMatches = allMatches.concat(r.matches || []); });
  if (Array.isArray(t.groups)) t.groups.forEach(function(g) { allMatches = allMatches.concat(g.matches || []); });
  var pending = allMatches.filter(function(m) { return m.p1 && m.p2 && !m.winner && !m.isBye; });
  if (pending.length === 0) return '';
  var waitingPresence = pending.filter(function(m) { return !m.presenceP1 || !m.presenceP2; });
  if (waitingPresence.length === 0) return '';
  var html = '<div style="margin-bottom:1.5rem;padding:14px 18px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:12px;">';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<span style="font-size:1.5rem;">⏳</span>';
  html += '<div>';
  html += '<div style="font-size:0.95rem;font-weight:700;color:#fbbf24;">Aguardando Presença</div>';
  html += '<div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:2px;">' + waitingPresence.length + ' partida' + (waitingPresence.length > 1 ? 's' : '') + ' aguardando confirmação de presença</div>';
  html += '</div></div></div>';
  return html;
};

window._tvMode = function(tId) {
  var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
  if (!t) {
    if (typeof showAlertDialog === 'function') showAlertDialog('Torneio Não Encontrado', 'O torneio foi removido ou não está acessível.', null, { type: 'warning' });
    return;
  }
  var safeName = window._safeHtml ? window._safeHtml(t.name) : t.name;

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'tv-mode-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0e1a;z-index:99999;overflow:auto;display:flex;flex-direction:column;';

  // Hero section with venue photo background
  var heroBg = t.venuePhotoUrl
    ? 'background-image:linear-gradient(to bottom,rgba(10,14,26,0.3),rgba(10,14,26,0.95)),url(' + t.venuePhotoUrl + ');background-size:cover;background-position:center;'
    : 'background:linear-gradient(135deg,#1e293b 0%,#0f172a 50%,#1e1b4b 100%);';
  var hero = '<div style="' + heroBg + 'padding:30px 40px;flex-shrink:0;position:relative;">';
  // Exit button (top right)
  hero += '<button onclick="window._exitTvMode()" style="position:absolute;top:16px;right:20px;background:rgba(239,68,68,0.25);color:#f87171;border:1px solid rgba(239,68,68,0.4);padding:10px 20px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:700;z-index:1;">✕ Sair do Modo TV</button>';
  // Clock (top right, below exit)
  hero += '<div style="position:absolute;top:60px;right:20px;text-align:right;">';
  hero += '<div id="tv-mode-clock" style="color:rgba(255,255,255,0.7);font-size:1.4rem;font-weight:700;font-variant-numeric:tabular-nums;"></div>';
  hero += '<div id="tv-mode-refresh-indicator" style="color:rgba(255,255,255,0.3);font-size:0.7rem;margin-top:2px;">Auto-refresh: 30s</div>';
  hero += '</div>';
  // Tournament info
  hero += '<div style="display:flex;align-items:center;gap:20px;">';
  if (t.logoData) hero += '<img src="' + t.logoData + '" style="width:72px;height:72px;border-radius:14px;object-fit:cover;box-shadow:0 4px 20px rgba(0,0,0,0.4);">';
  hero += '<div>';
  hero += '<h1 style="margin:0;color:white;font-size:2.2rem;font-weight:900;text-shadow:0 2px 10px rgba(0,0,0,0.5);">' + safeName + '</h1>';
  hero += '<div style="color:rgba(255,255,255,0.6);font-size:1rem;margin-top:4px;display:flex;gap:16px;flex-wrap:wrap;">';
  hero += '<span>' + window._safeHtml(t.format || '') + '</span>';
  hero += '<span>•</span><span>' + window._safeHtml(t.sport || '') + '</span>';
  if (t.venue) hero += '<span>•</span><span>📍 ' + window._safeHtml(t.venue) + '</span>';
  var partCount = Array.isArray(t.participants) ? t.participants.length : 0;
  hero += '<span>•</span><span>👤 ' + partCount + ' inscritos</span>';
  hero += '</div></div></div>';

  // Progress bar inside hero
  var progHtml = '';
  if (typeof window._getTournamentProgress === 'function') {
    var prog = window._getTournamentProgress(t);
    if (prog.total > 0) {
      var barCol = prog.pct === 100 ? '#10b981' : (prog.pct > 50 ? '#3b82f6' : '#f59e0b');
      progHtml = '<div style="margin-top:20px;">';
      progHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      progHtml += '<span style="font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:rgba(255,255,255,0.4);">Progresso do Torneio</span>';
      progHtml += '<span style="font-size:1rem;font-weight:800;color:white;">' + prog.completed + '/' + prog.total + ' partidas (' + prog.pct + '%)</span>';
      progHtml += '</div>';
      progHtml += '<div style="width:100%;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">';
      progHtml += '<div style="width:' + prog.pct + '%;height:100%;background:' + barCol + ';border-radius:4px;transition:width 0.5s;"></div>';
      progHtml += '</div></div>';
    }
  }
  hero += progHtml + '</div>';

  // Next matches + Attendance
  var nextMatchesHtml = window._tvBuildNextMatches(t);
  var attendanceHtml = window._tvBuildAttendance(t);

  // Content: grab existing bracket/standings content
  var viewContainer = document.getElementById('view-container');
  var contentHtml = '';
  if (viewContainer) {
    var cards = viewContainer.querySelectorAll('.bracket-container, table, .card');
    var tempDiv = document.createElement('div');
    cards.forEach(function(el) {
      var clone = el.cloneNode(true);
      var btns = clone.querySelectorAll('button, .btn, a.btn');
      btns.forEach(function(b) { b.remove(); });
      var forms = clone.querySelectorAll('select, input');
      forms.forEach(function(f) { f.remove(); });
      tempDiv.appendChild(clone);
    });
    contentHtml = tempDiv.innerHTML;
  }

  var tvStyles = '<style>' +
    '#tv-mode-overlay table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }' +
    '#tv-mode-overlay table th { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); padding: 10px 14px; font-size: 0.85rem; font-weight: 700; text-align: left; border-bottom: 2px solid rgba(255,255,255,0.15); }' +
    '#tv-mode-overlay table td { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); font-size: 0.95rem; }' +
    '#tv-mode-overlay table tr:hover td { background: rgba(255,255,255,0.03); }' +
    '#tv-mode-overlay .bracket-container { overflow: visible; }' +
    '#tv-mode-overlay .bracket-match { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); }' +
    '#tv-mode-overlay .match-player { color: rgba(255,255,255,0.8); border-bottom-color: rgba(255,255,255,0.08); }' +
    '#tv-mode-overlay .match-player.winner { color: #4ade80; background: rgba(16,185,129,0.1); }' +
    '#tv-mode-overlay .match-score { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: white; }' +
    '#tv-mode-overlay .bracket-round-title { color: rgba(255,255,255,0.5); }' +
    '#tv-mode-overlay details { color: rgba(255,255,255,0.7); }' +
    '#tv-mode-overlay h3, #tv-mode-overlay h4 { color: white; }' +
    '#tv-mode-overlay .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: white; }' +
    '</style>';

  overlay.innerHTML = hero +
    '<div id="tv-mode-content" style="flex:1;overflow:auto;padding:24px 40px;color:white;">' +
    tvStyles + attendanceHtml + nextMatchesHtml + contentHtml +
    '</div>';

  document.body.appendChild(overlay);

  // Try fullscreen
  if (overlay.requestFullscreen) overlay.requestFullscreen().catch(function() {});
  else if (overlay.webkitRequestFullscreen) overlay.webkitRequestFullscreen();

  // Clock update
  function updateClock() {
    var clockEl = document.getElementById('tv-mode-clock');
    if (clockEl) {
      var now = new Date();
      clockEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  updateClock();
  var clockInterval = setInterval(updateClock, 1000);

  // Auto-refresh every 30s
  window._tvModeInterval = setInterval(function() {
    var ov = document.getElementById('tv-mode-overlay');
    if (!ov) { clearInterval(window._tvModeInterval); clearInterval(clockInterval); return; }
    // Reload tournament data
    var tNow = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!tNow) return;
    var vc = document.getElementById('view-container');
    if (vc && typeof renderBracket === 'function') {
      renderBracket(vc, tId);
      setTimeout(function() {
        var contentDiv = document.getElementById('tv-mode-content');
        if (!contentDiv || !vc) return;
        var newCards = vc.querySelectorAll('.bracket-container, table, .card');
        var tmp = document.createElement('div');
        newCards.forEach(function(el) {
          var cl = el.cloneNode(true);
          var bs = cl.querySelectorAll('button, .btn, a.btn, select, input');
          bs.forEach(function(b) { b.remove(); });
          tmp.appendChild(cl);
        });
        var styleTag = contentDiv.querySelector('style');
        var newAttendance = window._tvBuildAttendance(tNow);
        var newNextMatches = window._tvBuildNextMatches(tNow);
        contentDiv.innerHTML = (styleTag ? styleTag.outerHTML : '') + newAttendance + newNextMatches + tmp.innerHTML;

        var ind = document.getElementById('tv-mode-refresh-indicator');
        if (ind) {
          ind.textContent = '🔄 Atualizado';
          ind.style.color = '#4ade80';
          setTimeout(function() { if (ind) { ind.textContent = 'Auto-refresh: 30s'; ind.style.color = 'rgba(255,255,255,0.3)'; } }, 2000);
        }
      }, 500);
    }
  }, 30000);

  // ESC to exit
  window._tvModeEscHandler = function(e) {
    if (e.key === 'Escape') window._exitTvMode();
  };
  document.addEventListener('keydown', window._tvModeEscHandler);

  // Exit on fullscreen change
  window._tvModeFullscreenHandler = function() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      var ov = document.getElementById('tv-mode-overlay');
      if (ov) window._exitTvMode();
    }
  };
  document.addEventListener('fullscreenchange', window._tvModeFullscreenHandler);
  document.addEventListener('webkitfullscreenchange', window._tvModeFullscreenHandler);
};

window._exitTvMode = function() {
  if (window._tvModeInterval) { clearInterval(window._tvModeInterval); window._tvModeInterval = null; }
  var overlay = document.getElementById('tv-mode-overlay');
  if (overlay) overlay.remove();
  if (document.fullscreenElement) document.exitFullscreen().catch(function() {});
  else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  if (window._tvModeEscHandler) { document.removeEventListener('keydown', window._tvModeEscHandler); window._tvModeEscHandler = null; }
  if (window._tvModeFullscreenHandler) {
    document.removeEventListener('fullscreenchange', window._tvModeFullscreenHandler);
    document.removeEventListener('webkitfullscreenchange', window._tvModeFullscreenHandler);
    window._tvModeFullscreenHandler = null;
  }
};

// ─── Player match history popup ──────────────────────────────────────────────
window._showPlayerHistory = function(tId, playerName) {
  var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
  if (!t) return;
  var rounds = t.rounds || [];
  var matches = [];
  rounds.forEach(function(r, ri) {
    (r.matches || []).forEach(function(m) {
      if (m.p1 === playerName || m.p2 === playerName) {
        matches.push({ round: ri + 1, m: m });
      }
    });
  });
  // Also check t.matches (elimination) and t.groups
  if (Array.isArray(t.matches)) {
    t.matches.forEach(function(m) {
      if (m.p1 === playerName || m.p2 === playerName) {
        matches.push({ round: null, m: m });
      }
    });
  }
  if (Array.isArray(t.groups)) {
    t.groups.forEach(function(g, gi) {
      (g.matches || []).forEach(function(m) {
        if (m.p1 === playerName || m.p2 === playerName) {
          matches.push({ round: null, m: m, group: gi + 1 });
        }
      });
    });
  }

  if (matches.length === 0) {
    showAlertDialog('Confrontos — ' + playerName, 'Nenhuma partida encontrada.', null, { type: 'info' });
    return;
  }

  var wins = 0, losses = 0, draws = 0;
  var rows = matches.map(function(item) {
    var m = item.m;
    var opponent = m.p1 === playerName ? m.p2 : m.p1;
    var isDraw = m.winner === 'draw' || m.draw;
    var isWin = m.winner === playerName;
    var isLoss = m.winner && !isDraw && !isWin;
    if (isWin) wins++;
    else if (isDraw) draws++;
    else if (isLoss) losses++;
    var scoreStr = (m.scoreP1 !== undefined && m.scoreP1 !== null)
      ? (m.p1 === playerName ? m.scoreP1 + ' × ' + m.scoreP2 : m.scoreP2 + ' × ' + m.scoreP1)
      : (m.winner ? '' : '—');
    var resultIcon = isDraw ? '🤝' : (isWin ? '✅' : (isLoss ? '❌' : '⏳'));
    var roundLabel = item.round ? 'Rodada ' + item.round : (item.group ? 'Grupo ' + item.group : (m.label || ''));
    return '<tr style="border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<td style="padding:8px 10px;font-size:0.8rem;color:var(--text-muted);">' + roundLabel + '</td>' +
      '<td style="padding:8px 10px;font-size:0.8rem;font-weight:600;color:var(--text-bright);">' + (opponent || 'BYE') + '</td>' +
      '<td style="padding:8px 10px;font-size:0.8rem;text-align:center;">' + scoreStr + '</td>' +
      '<td style="padding:8px 10px;font-size:0.85rem;text-align:center;">' + resultIcon + '</td>' +
      '</tr>';
  }).join('');

  var summary = '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<span style="font-weight:700;color:#4ade80;">' + wins + 'V</span>' +
    '<span style="font-weight:700;color:#94a3b8;">' + draws + 'E</span>' +
    '<span style="font-weight:700;color:#f87171;">' + losses + 'D</span>' +
    '<span style="color:var(--text-muted);">' + matches.length + ' partidas</span>' +
    '</div>';

  var tableHtml = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr style="border-bottom:2px solid var(--border-color);">' +
    '<th style="padding:6px 10px;text-align:left;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Fase</th>' +
    '<th style="padding:6px 10px;text-align:left;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Adversário</th>' +
    '<th style="padding:6px 10px;text-align:center;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Placar</th>' +
    '<th style="padding:6px 10px;text-align:center;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Resultado</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';

  showAlertDialog('Confrontos — ' + playerName, summary + tableHtml, null, { type: 'info' });
};

window._saveGroupResult = window._saveResultInline; // Reuse existing inline save

// ─── Advance from Groups to Elimination ─────────────────────────────────────
window._advanceToElimination = function (tId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t || !t.groups) return;

  const classified = t.gruposClassified || 2;
  const qualifiedPlayers = [];

  t.groups.forEach(g => {
    const scoreMap = {};
    g.participants.forEach(name => {
      scoreMap[name] = { name, points: 0, wins: 0, draws: 0, losses: 0, pointsDiff: 0, played: 0 };
    });
    (g.rounds || []).forEach(r => {
      (r.matches || []).forEach(m => {
        if (!m.winner && !m.draw) return;
        const s1 = parseInt(m.scoreP1) || 0; const s2 = parseInt(m.scoreP2) || 0;
        // Handle draws
        if (m.winner === 'draw' || m.draw) {
          if (!scoreMap[m.p1]) scoreMap[m.p1] = { name: m.p1, points: 0, wins: 0, draws: 0, losses: 0, pointsDiff: 0, played: 0 };
          if (!scoreMap[m.p2]) scoreMap[m.p2] = { name: m.p2, points: 0, wins: 0, draws: 0, losses: 0, pointsDiff: 0, played: 0 };
          scoreMap[m.p1].draws++; scoreMap[m.p1].points += 1; scoreMap[m.p1].played++;
          scoreMap[m.p2].draws++; scoreMap[m.p2].points += 1; scoreMap[m.p2].played++;
          scoreMap[m.p1].pointsDiff += (s1 - s2); scoreMap[m.p2].pointsDiff += (s2 - s1);
          return;
        }
        const loser = m.winner === m.p1 ? m.p2 : m.p1;
        if (!scoreMap[m.winner]) scoreMap[m.winner] = { name: m.winner, points: 0, wins: 0, draws: 0, losses: 0, pointsDiff: 0, played: 0 };
        if (!scoreMap[loser]) scoreMap[loser] = { name: loser, points: 0, wins: 0, draws: 0, losses: 0, pointsDiff: 0, played: 0 };
        scoreMap[m.winner].wins++; scoreMap[m.winner].points += 3; scoreMap[m.winner].played++;
        scoreMap[loser].losses++; scoreMap[loser].played++;
        if (m.winner === m.p1) { scoreMap[m.p1].pointsDiff += (s1 - s2); scoreMap[m.p2].pointsDiff += (s2 - s1); }
        else { scoreMap[m.p2].pointsDiff += (s2 - s1); scoreMap[m.p1].pointsDiff += (s1 - s2); }
      });
    });
    const sorted = Object.values(scoreMap).sort((a, b) => b.points - a.points || b.wins - a.wins || b.pointsDiff - a.pointsDiff);
    qualifiedPlayers.push(...sorted.slice(0, classified).map(s => s.name));
  });

  // Shuffle qualified slightly (cross-seed: 1st of group A vs 2nd of group B etc)
  // Simple cross-seeding: group winners in one half, runners-up in other half
  const groupWinners = [];
  const groupRunnersUp = [];
  t.groups.forEach(g => {
    const scoreMap = {};
    g.participants.forEach(name => {
      scoreMap[name] = { name, points: 0, wins: 0, draws: 0, pointsDiff: 0 };
    });
    (g.rounds || []).forEach(r => {
      (r.matches || []).forEach(m => {
        if (!m.winner && !m.draw) return;
        const s1 = parseInt(m.scoreP1) || 0; const s2 = parseInt(m.scoreP2) || 0;
        if (m.winner === 'draw' || m.draw) {
          if (!scoreMap[m.p1]) scoreMap[m.p1] = { name: m.p1, points: 0, wins: 0, draws: 0, pointsDiff: 0 };
          if (!scoreMap[m.p2]) scoreMap[m.p2] = { name: m.p2, points: 0, wins: 0, draws: 0, pointsDiff: 0 };
          scoreMap[m.p1].draws++; scoreMap[m.p1].points += 1;
          scoreMap[m.p2].draws++; scoreMap[m.p2].points += 1;
          scoreMap[m.p1].pointsDiff += (s1 - s2); scoreMap[m.p2].pointsDiff += (s2 - s1);
          return;
        }
        if (!scoreMap[m.winner]) scoreMap[m.winner] = { name: m.winner, points: 0, wins: 0, draws: 0, pointsDiff: 0 };
        scoreMap[m.winner].wins++; scoreMap[m.winner].points += 3;
        if (m.winner === m.p1) scoreMap[m.p1].pointsDiff += (s1 - s2);
        else scoreMap[m.p2].pointsDiff += (s2 - s1);
      });
    });
    const sorted = Object.values(scoreMap).sort((a, b) => b.points - a.points || b.wins - a.wins || b.pointsDiff - a.pointsDiff);
    if (sorted[0]) groupWinners.push(sorted[0].name);
    if (sorted[1]) groupRunnersUp.push(sorted[1].name);
    // Additional classified beyond 2
    for (let i = 2; i < classified && i < sorted.length; i++) {
      groupRunnersUp.push(sorted[i].name);
    }
  });

  // Cross-seed: 1st of group A vs runner-up from opposite group
  const seeded = [];
  const numGroups = t.groups.length;
  for (let i = 0; i < groupWinners.length; i++) {
    seeded.push(groupWinners[i]);
    const oppositeIdx = (numGroups - 1 - i) % groupRunnersUp.length;
    if (groupRunnersUp[oppositeIdx]) {
      seeded.push(groupRunnersUp[oppositeIdx]);
    }
  }
  // Add any remaining runners-up
  groupRunnersUp.forEach(r => { if (!seeded.includes(r)) seeded.push(r); });

  // Generate elimination bracket
  const ts = Date.now();
  const matches = [];
  for (let i = 0; i < seeded.length; i += 2) {
    const p1 = seeded[i];
    const p2 = i + 1 < seeded.length ? seeded[i + 1] : 'BYE (Avança Direto)';
    const isBye = p2 === 'BYE (Avança Direto)';
    matches.push({
      id: `elim-${ts}-${i}`,
      round: 1,
      p1, p2,
      winner: isBye ? p1 : null,
      isBye
    });
  }

  t.matches = matches;
  t.currentStage = 'elimination';
  window._buildNextMatchLinks(t);

  window.AppStore.logAction(tId, `Fase Eliminatória iniciada com ${seeded.length} classificados`);
  window.AppStore.syncImmediate(tId);

  showNotification('Fase Eliminatória', `${seeded.length} classificados avançaram para as eliminatórias!`, 'success');
  renderBracket(document.getElementById('view-container'), tId);
};

// ─── Advance Monarch to Elimination ──────────────────────────────────────────
window._advanceMonarchToElimination = function(tId) {
  var t = window.AppStore.tournaments.find(function(tour) { return tour.id.toString() === tId.toString(); });
  if (!t || !t.groups) return;

  var classified = t.monarchClassified || 1;
  var qualifiedPlayers = [];

  t.groups.forEach(function(g) {
    var standings = window._computeMonarchStandings(g);
    for (var i = 0; i < Math.min(classified, standings.length); i++) {
      qualifiedPlayers.push(standings[i].name);
    }
  });

  if (qualifiedPlayers.length < 2) {
    showAlertDialog('Insuficiente', 'Precisa de pelo menos 2 classificados para a eliminatoria.', null, { type: 'warning' });
    return;
  }

  // Cross-seed: alternate from different groups
  var seeded = [];
  var maxPerGroup = classified;
  for (var rank = 0; rank < maxPerGroup; rank++) {
    t.groups.forEach(function(g) {
      var standings = window._computeMonarchStandings(g);
      if (standings[rank]) seeded.push(standings[rank].name);
    });
  }

  // Generate elimination bracket
  t.currentStage = 'elimination';
  t.matches = [];
  var ts = Date.now();
  var matchCounter = 0;

  // Pad to power of 2 with BYEs
  var n = seeded.length;
  var pow = 1;
  while (pow < n) pow *= 2;

  var r1 = [];
  for (var i = 0; i < pow / 2; i++) {
    var p1 = seeded[i] || 'BYE';
    var p2 = seeded[pow - 1 - i] || 'BYE';
    var isBye = p1 === 'BYE' || p2 === 'BYE';
    var m = {
      id: 'match-' + ts + '-' + (matchCounter++),
      round: 1, p1: p1, p2: p2,
      winner: isBye ? (p1 === 'BYE' ? p2 : p1) : null,
      isBye: isBye
    };
    r1.push(m);
    t.matches.push(m);
  }

  // Build next rounds
  if (typeof window._buildNextMatchLinks === 'function') {
    window._buildNextMatchLinks(t, r1, ts, matchCounter);
  }

  t.elimThirdPlace = true;
  window.AppStore.syncImmediate(tId);
  showNotification('Fase Eliminatoria', seeded.length + ' classificados avancaram para as eliminatorias!', 'success');
  renderBracket(document.getElementById('view-container'), tId);
};

// _closeRound is in bracket-logic.js
