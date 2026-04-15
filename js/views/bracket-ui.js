// ── Bracket UI Handlers ──
var _t = window._t || function(k) { return k; };

// Helper: re-render bracket preserving scroll position (zero jump)
// Uses anchor-based approach: saves the viewport-relative offset of a reference
// element, re-renders, then scrolls so the same element is at the same offset.
function _rerenderBracket(tId, anchorMatchId) {
  // 1. Find anchor element — prefer the specific match card, fallback to any visible card
  var anchorEl = null;
  var anchorOffsetY = 0;
  if (anchorMatchId) {
    anchorEl = document.getElementById('card-' + anchorMatchId);
  }
  if (!anchorEl) {
    // Find first match card visible in viewport
    var allCards = document.querySelectorAll('[id^="card-"]');
    for (var ci = 0; ci < allCards.length; ci++) {
      var rect = allCards[ci].getBoundingClientRect();
      if (rect.top >= -100 && rect.top <= window.innerHeight) {
        anchorEl = allCards[ci];
        break;
      }
    }
  }
  var anchorId = anchorEl ? anchorEl.id : null;
  if (anchorEl) {
    anchorOffsetY = anchorEl.getBoundingClientRect().top;
  }

  // 2. Save horizontal scrolls
  var _sx = window.scrollX || window.pageXOffset || 0;
  var _sy = window.scrollY || window.pageYOffset || 0;
  var bracketWrapper = document.querySelector('.bracket-sticky-scroll-wrapper');
  var _bsx = bracketWrapper ? bracketWrapper.scrollLeft : 0;

  // 3. Suppress Firestore soft-refresh
  window._suppressSoftRefresh = true;
  clearTimeout(window._pendingSoftRefresh);

  var container = document.getElementById('view-container');

  // 4. Lock container height to prevent flash
  var prevHeight = container ? container.offsetHeight : 0;
  if (container && prevHeight > 0) {
    container.style.minHeight = prevHeight + 'px';
  }

  // 5. Re-render
  renderBracket(container, tId);

  // 6. Restore scroll anchored to the reference element
  function _restore() {
    var newAnchor = anchorId ? document.getElementById(anchorId) : null;
    if (newAnchor) {
      var newRect = newAnchor.getBoundingClientRect();
      var delta = newRect.top - anchorOffsetY;
      window.scrollBy(0, delta);
    } else {
      window.scrollTo(_sx, _sy);
    }
    var newWrapper = document.querySelector('.bracket-sticky-scroll-wrapper');
    if (newWrapper) newWrapper.scrollLeft = _bsx;
  }

  _restore();
  requestAnimationFrame(function() {
    _restore();
    requestAnimationFrame(function() {
      _restore();
      if (container) container.style.minHeight = '';
      setTimeout(function() { window._suppressSoftRefresh = false; }, 3000);
    });
  });
}
window._rerenderBracket = _rerenderBracket;
window._substituteFromStandby = function (tId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;

  const select = document.getElementById('standby-wo-select');
  if (!select || !select.value) {
    showAlertDialog(_t('result.selectAbsent'), '', null, { type: 'warning' });
    return;
  }

  const standby = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
  if (standby.length === 0) {
    showAlertDialog(_t('result.emptyList'), '', null, { type: 'warning' });
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

    showConfirmDialog(_t('result.confirmSub'),
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
        _rerenderBracket(tId);
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
        _rerenderBracket(tId);
      }, null,
      { type: 'warning', confirmText: 'Desclassificar e Substituir', cancelText: 'Cancelar' }
    );
  }
};

// Auto-substitute: find first W.O. player in bracket and replace with first present standby
window._autoSubstituteWO = function(tId) {
  var t = window.AppStore.tournaments.find(function(tour) { return tour.id.toString() === tId.toString(); });
  if (!t) return;

  var ab = t.absent || {};
  var ci = t.checkedIn || {};
  var getName = function(p) { return typeof p === 'string' ? p : (p.displayName || p.name || p.email || '?'); };

  // Merge standby sources (waitlist + standbyParticipants, deduplicated)
  var _wl = Array.isArray(t.waitlist) ? t.waitlist : [];
  var _sp = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
  var _spNames = new Set(_sp.map(function(p) { return getName(p); }));
  var standby = _sp.slice();
  _wl.forEach(function(w) { var wn = getName(w); if (wn && !_spNames.has(wn)) standby.push(w); });

  // Find first present standby player
  var nextPresent = standby.find(function(p) { return !!ci[getName(p)]; });
  if (!nextPresent) {
    if (typeof showNotification === 'function') showNotification('Sem substituto', 'Nenhum jogador da lista de espera está marcado como presente.', 'warning');
    return;
  }
  var replacementName = getName(nextPresent);

  // Collect ALL undecided matches from every structure
  var allMatches = [];
  if (Array.isArray(t.matches)) t.matches.forEach(function(m) { allMatches.push(m); });
  if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (Array.isArray(r.matches)) r.matches.forEach(function(m) { allMatches.push(m); }); });
  if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
    if (Array.isArray(g.matches)) g.matches.forEach(function(m) { allMatches.push(m); });
    if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr.matches)) gr.matches.forEach(function(m) { allMatches.push(m); }); });
  });

  // Find first W.O. match (player marked absent in undecided match)
  var woMatch = null, woSlot = null, absentMemberName = null;
  for (var i = 0; i < allMatches.length; i++) {
    var m = allMatches[i];
    if (m.winner || m.isBye) continue;
    for (var si = 0; si < 2; si++) {
      var slot = si === 0 ? 'p1' : 'p2';
      var name = m[slot];
      if (!name || name === 'TBD' || name === 'BYE') continue;
      var members = name.includes(' / ') ? name.split(' / ').map(function(n) { return n.trim(); }) : [name];
      var found = members.find(function(n) { return !!ab[n]; });
      if (found) { woMatch = m; woSlot = slot; absentMemberName = found; break; }
    }
    if (woMatch) break;
  }

  if (!woMatch) {
    if (typeof showNotification === 'function') showNotification('Sem W.O.', 'Nenhum jogador com W.O. encontrado no chaveamento.', 'info');
    return;
  }

  var oldEntry = woMatch[woSlot];
  var isTeam = oldEntry.includes(' / ');
  var woScope = t.woScope || 'individual';

  if (isTeam && woScope === 'individual') {
    // W.O. is individual — replace only the absent member, partner stays
    var newMembers = oldEntry.split(' / ').map(function(n) { return n.trim() === absentMemberName ? replacementName : n.trim(); });
    var newTeamName = newMembers.join(' / ');
    var partnerName = oldEntry.split(' / ').map(function(n) { return n.trim(); }).find(function(n) { return n !== absentMemberName; }) || '';

    showConfirmDialog('Substituir W.O.',
      '<div style="text-align:left;line-height:1.8;">' +
        '<div><strong style="color:#ef4444;">W.O.:</strong> ' + window._safeHtml(absentMemberName) + '</div>' +
        '<div><strong style="color:#60a5fa;">Parceiro:</strong> ' + window._safeHtml(partnerName) + ' <span style="color:#9ca3af;">(permanece)</span></div>' +
        '<div><strong style="color:#4ade80;">Substituto:</strong> ' + window._safeHtml(replacementName) + '</div>' +
        '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;"><strong>Novo time:</strong> ' + window._safeHtml(newTeamName) + '</div>' +
      '</div>',
      function() {
        // Update this match slot
        woMatch[woSlot] = newTeamName;
        // Update ALL match refs across all structures
        allMatches.forEach(function(match) {
          if (match.p1 === oldEntry) match.p1 = newTeamName;
          if (match.p2 === oldEntry) match.p2 = newTeamName;
          // Also update team1/team2 arrays (Rei/Rainha format)
          if (Array.isArray(match.team1)) {
            var ti = match.team1.indexOf(absentMemberName);
            if (ti !== -1) match.team1[ti] = replacementName;
          }
          if (Array.isArray(match.team2)) {
            var ti2 = match.team2.indexOf(absentMemberName);
            if (ti2 !== -1) match.team2[ti2] = replacementName;
          }
        });
        // Update participants list — replace old team entry with new team name
        var partsArr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
        var pi = partsArr.findIndex(function(p) { return getName(p) === oldEntry; });
        if (pi !== -1) {
          if (typeof partsArr[pi] === 'string') { partsArr[pi] = newTeamName; }
          else { partsArr[pi].displayName = newTeamName; partsArr[pi].name = newTeamName; }
        }
        t.participants = partsArr;
        // Remove replacement from standby
        t.standbyParticipants = standby.filter(function(p) { return getName(p) !== replacementName; });
        t.waitlist = _wl.filter(function(w) { return getName(w) !== replacementName; });
        // Clear W.O. from absent, mark replacement as checked in
        delete ab[absentMemberName];
        t.absent = ab;
        ci[replacementName] = true;
        t.checkedIn = ci;

        window.AppStore.logAction(tId, 'Substituição W.O.: ' + absentMemberName + ' → ' + replacementName + ' (parceiro: ' + partnerName + ')');
        window.AppStore.syncImmediate(tId);
        showNotification('Substituição Realizada', replacementName + ' entrou no lugar de ' + absentMemberName + '. ' + partnerName + ' permanece no time.', 'success');
        var container = document.getElementById('view-container');
        if (container && typeof renderParticipants === 'function') renderParticipants(container, tId);
      }, null, { type: 'warning', confirmText: 'Confirmar Substituição', cancelText: 'Cancelar' });
  } else {
    // Individual player — replace entire entry
    showConfirmDialog('Substituir W.O.',
      '<div style="text-align:left;line-height:1.8;">' +
        '<div><strong style="color:#ef4444;">W.O.:</strong> ' + window._safeHtml(absentMemberName) + '</div>' +
        '<div><strong style="color:#4ade80;">Substituto:</strong> ' + window._safeHtml(replacementName) + '</div>' +
      '</div>',
      function() {
        woMatch[woSlot] = replacementName;
        // Update ALL match refs
        allMatches.forEach(function(match) {
          if (match.p1 === oldEntry) match.p1 = replacementName;
          if (match.p2 === oldEntry) match.p2 = replacementName;
        });
        // Update participants
        var partsArr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
        var pi = partsArr.findIndex(function(p) { return getName(p) === oldEntry; });
        if (pi !== -1) partsArr.splice(pi, 1);
        partsArr.push(typeof nextPresent === 'string' ? replacementName : nextPresent);
        t.participants = partsArr;
        // Remove from standby
        t.standbyParticipants = standby.filter(function(p) { return getName(p) !== replacementName; });
        t.waitlist = _wl.filter(function(w) { return getName(w) !== replacementName; });
        // Clear W.O., mark replacement present
        delete ab[absentMemberName];
        t.absent = ab;
        ci[replacementName] = true;
        t.checkedIn = ci;

        window.AppStore.logAction(tId, 'Substituição W.O.: ' + absentMemberName + ' → ' + replacementName);
        window.AppStore.syncImmediate(tId);
        showNotification('Substituição Realizada', replacementName + ' entrou no lugar de ' + absentMemberName, 'success');
        var container = document.getElementById('view-container');
        if (container && typeof renderParticipants === 'function') renderParticipants(container, tId);
      }, null, { type: 'warning', confirmText: 'Confirmar Substituição', cancelText: 'Cancelar' });
  }
};

window._toggleBracketMode = function (tId) {
  window._bracketMirrorMode = !window._bracketMirrorMode;
  _rerenderBracket(tId);
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
  _rerenderBracket(tId);
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
  const isFixedSet = sc.fixedSet === true;
  const p1Name = m.p1 || 'Jogador 1';
  const p2Name = m.p2 || 'Jogador 2';
  const _esc = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };

  // Remove existing overlay
  const existing = document.getElementById('set-scoring-overlay');
  if (existing) existing.remove();

  let setsHtml = '';

  if (isFixedSet) {
    // Fixed Set mode: single input for games won by each player
    const fsGames = sc.fixedSetGames || sc.gamesPerSet || 6;
    setsHtml += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:12px;margin-bottom:12px;">' +
      '<div style="font-size:0.78rem;color:#f59e0b;font-weight:600;margin-bottom:4px;">⚡ Set Fixo de ' + fsGames + ' games</div>' +
      '<div style="font-size:0.72rem;color:var(--text-muted);">Informe quantos games cada jogador venceu (total = ' + fsGames + ').</div>' +
    '</div>';
    setsHtml += '<div class="set-row" data-set="0" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
      '<div style="width:100px;font-size:0.82rem;font-weight:600;color:var(--text-muted);">Games</div>' +
      '<input type="number" id="set-p1-0" min="0" max="' + fsGames + '" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:8px;" oninput="window._checkSetComplete(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\',0)">' +
      '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:800;">×</span>' +
      '<input type="number" id="set-p2-0" min="0" max="' + fsGames + '" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:8px;" oninput="window._checkSetComplete(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\',0)">' +
      '<div id="tb-indicator-0" style="font-size:0.72rem;color:#c084fc;font-weight:600;min-width:60px;"></div>' +
    '</div>';
    // Tiebreak row for fixed set tie
    setsHtml += '<div id="tb-input-row" style="display:none;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div style="width:100px;font-size:0.82rem;font-weight:600;color:#c084fc;">Tie-break</div>' +
        '<input type="number" id="tb-p1" min="0" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);color:var(--text-bright);border-radius:8px;padding:8px;" oninput="window._checkSetComplete(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\',0)">' +
        '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:800;">×</span>' +
        '<input type="number" id="tb-p2" min="0" placeholder="0" style="width:56px;text-align:center;font-size:1.1rem;font-weight:700;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);color:var(--text-bright);border-radius:8px;padding:8px;" oninput="window._checkSetComplete(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\',0)">' +
      '</div>' +
      '<div id="tb-for-set" style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;padding-left:100px;">Empate — desempate por tie-break</div>' +
    '</div>';
  } else {
    // Standard set-by-set scoring
    const totalSets = sc.setsToWin * 2 - 1;
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
  }

  const headerSubtitle = isFixedSet
    ? '⚡ Set Fixo de ' + (sc.fixedSetGames || sc.gamesPerSet) + ' games'
    : sc.setsToWin + ' set' + (sc.setsToWin > 1 ? 's' : '') + ' · ' + sc.gamesPerSet + ' games/set';

  const overlay = document.createElement('div');
  overlay.id = 'set-scoring-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);z-index:100001;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';

  overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);width:94%;max-width:500px;border-radius:20px;border:1px solid rgba(168,85,247,0.25);box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;margin:auto 0;max-height:90vh;display:flex;flex-direction:column;">' +
    '<div style="background:linear-gradient(135deg,' + (isFixedSet ? '#b45309 0%,#f59e0b' : '#6d28d9 0%,#a855f7') + ' 100%);padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
      '<div>' +
        '<h3 style="margin:0;color:#f5f3ff;font-size:1.05rem;font-weight:800;">' + (isFixedSet ? '⚡ Set Fixo' : '🎾 Resultado por Sets') + '</h3>' +
        '<p style="margin:2px 0 0;color:#fef3c7;font-size:0.75rem;">' + headerSubtitle + '</p>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button type="button" onclick="document.getElementById(\'set-scoring-overlay\').remove();" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#f5f3ff;border:1px solid rgba(255,255,255,0.25);">Cancelar</button>' +
        '<button type="button" id="btn-save-sets" onclick="window._saveSetResult(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\')" class="btn btn-sm" style="background:#fff;color:' + (isFixedSet ? '#b45309' : '#6d28d9') + ';font-weight:700;border:none;" disabled>Salvar</button>' +
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
  const isFixedSet = sc.fixedSet === true;

  if (isFixedSet) {
    // Fixed Set mode: check if games add up to total, determine winner by majority
    const fsGames = sc.fixedSetGames || sc.gamesPerSet || 6;
    const el1 = document.getElementById('set-p1-0');
    const el2 = document.getElementById('set-p2-0');
    if (!el1 || !el2) return;
    const g1 = parseInt(el1.value);
    const g2 = parseInt(el2.value);
    const indicator = document.getElementById('tb-indicator-0');
    const tbRow = document.getElementById('tb-input-row');
    const statusEl = document.getElementById('set-scoring-status');
    const saveBtn = document.getElementById('btn-save-sets');

    if (isNaN(g1) || isNaN(g2)) {
      if (indicator) indicator.textContent = '';
      if (tbRow) tbRow.style.display = 'none';
      if (statusEl) { statusEl.style.background = 'rgba(245,158,11,0.1)'; statusEl.style.color = '#f59e0b'; statusEl.textContent = 'Informe os games de cada jogador'; }
      if (saveBtn) saveBtn.disabled = true;
      return;
    }

    const total = g1 + g2;
    const half = Math.floor(fsGames / 2);
    const isTie = g1 === g2 && g1 === half && fsGames % 2 === 0;

    // Validate: total must equal fsGames
    if (total !== fsGames) {
      if (indicator) indicator.innerHTML = '<span style="color:#ef4444;">Total ≠ ' + fsGames + '</span>';
      if (tbRow) tbRow.style.display = 'none';
      if (statusEl) { statusEl.style.background = 'rgba(239,68,68,0.1)'; statusEl.style.color = '#ef4444'; statusEl.textContent = 'Total de games deve ser ' + fsGames + ' (atual: ' + total + ')'; }
      if (saveBtn) saveBtn.disabled = true;
      return;
    }

    if (isTie) {
      // Tied — need tiebreak
      if (indicator) indicator.textContent = 'Empate!';
      if (tbRow) tbRow.style.display = 'block';
      // Check if tiebreak is filled
      const tbP1 = parseInt(document.getElementById('tb-p1')?.value);
      const tbP2 = parseInt(document.getElementById('tb-p2')?.value);
      const tbTarget = sc.tiebreakPoints || 7;
      const tbMargin = sc.tiebreakMargin || 2;
      if (!isNaN(tbP1) && !isNaN(tbP2)) {
        const tbComplete = (tbP1 >= tbTarget || tbP2 >= tbTarget) && Math.abs(tbP1 - tbP2) >= tbMargin;
        if (tbComplete) {
          const tbWinner = tbP1 > tbP2 ? 'Jogador 1' : 'Jogador 2';
          if (statusEl) { statusEl.style.background = 'rgba(16,185,129,0.1)'; statusEl.style.color = '#4ade80'; statusEl.textContent = tbWinner + ' vence ' + g1 + '-' + g2 + ' TB(' + tbP1 + '-' + tbP2 + ')'; }
          if (saveBtn) saveBtn.disabled = false;
        } else {
          if (statusEl) { statusEl.style.background = 'rgba(245,158,11,0.1)'; statusEl.style.color = '#f59e0b'; statusEl.textContent = 'Empate ' + g1 + '-' + g2 + ' — complete o tie-break (' + tbTarget + ' pts, dif. ' + tbMargin + ')'; }
          if (saveBtn) saveBtn.disabled = true;
        }
      } else {
        if (statusEl) { statusEl.style.background = 'rgba(245,158,11,0.1)'; statusEl.style.color = '#f59e0b'; statusEl.textContent = 'Empate ' + g1 + '-' + g2 + ' — preencha o tie-break'; }
        if (saveBtn) saveBtn.disabled = true;
      }
    } else {
      // Clear winner
      if (indicator) indicator.textContent = '';
      if (tbRow) tbRow.style.display = 'none';
      const winner = g1 > g2 ? 'Jogador 1' : 'Jogador 2';
      if (statusEl) { statusEl.style.background = 'rgba(16,185,129,0.1)'; statusEl.style.color = '#4ade80'; statusEl.textContent = winner + ' vence ' + g1 + '-' + g2; }
      if (saveBtn) saveBtn.disabled = false;
    }
    return;
  }

  // Standard set-by-set mode
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
  const isFixedSet = sc.fixedSet === true;
  let sets = [];
  let p1Sets = 0, p2Sets = 0;

  if (isFixedSet) {
    // Fixed Set mode: single set with games won by each player
    const el1 = document.getElementById('set-p1-0');
    const el2 = document.getElementById('set-p2-0');
    if (!el1 || !el2) return;
    const g1 = parseInt(el1.value) || 0;
    const g2 = parseInt(el2.value) || 0;
    const setData = { gamesP1: g1, gamesP2: g2, fixedSet: true };

    if (g1 === g2) {
      // Tie — add tiebreak data
      const tbP1 = parseInt(document.getElementById('tb-p1')?.value) || 0;
      const tbP2 = parseInt(document.getElementById('tb-p2')?.value) || 0;
      setData.tiebreak = { pointsP1: tbP1, pointsP2: tbP2 };
      // Tiebreak winner gets the set
      if (tbP1 > tbP2) { setData.gamesP1 = g1 + 1; p1Sets = 1; }
      else if (tbP2 > tbP1) { setData.gamesP2 = g2 + 1; p2Sets = 1; }
    } else if (g1 > g2) {
      p1Sets = 1;
    } else {
      p2Sets = 1;
    }
    sets.push(setData);
  } else {
    // Standard set-by-set mode
    const totalSets = sc.setsToWin * 2 - 1;
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
      if (setData.gamesP1 > setData.gamesP2) p1Sets++;
      else if (setData.gamesP2 > setData.gamesP1) p2Sets++;

      if (p1Sets >= sc.setsToWin || p2Sets >= sc.setsToWin) break;
    }
  }

  m.sets = sets;
  m.setsWonP1 = p1Sets;
  m.setsWonP2 = p2Sets;
  if (isFixedSet) {
    m.fixedSet = true;
    // For fixed set, scoreP1/P2 show actual games (e.g. 4-2), not sets won
    var _fs0 = sets[0];
    m.scoreP1 = _fs0 ? _fs0.gamesP1 : p1Sets;
    m.scoreP2 = _fs0 ? _fs0.gamesP2 : p2Sets;
  } else {
    m.scoreP1 = p1Sets;
    m.scoreP2 = p2Sets;
  }

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
    showNotification(_t('result.saved'), m.winner + ' vence ' + p1Sets + '-' + p2Sets + '!', 'success');
  } else if (isRoundMatch) {
    showNotification(_t('result.saved'), m.winner + ' vence ' + p1Sets + '-' + p2Sets + '!', 'success');
  } else {
    _checkGroupRoundComplete(t, m.group);
    showNotification(_t('result.saved'), m.winner + ' vence ' + p1Sets + '-' + p2Sets + '!', 'success');
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
      level: 'fundamental',
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

  _rerenderBracket(tId, matchId);
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
    showAlertDialog(_t('result.invalidScore'), _t('result.fillScore'), null, { type: 'warning' });
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
    showAlertDialog(_t('result.drawNotAllowed'), '', null, { type: 'warning' });
    return;
  }

  // GSM scoring compatibility: store inline scores as sets data when tournament uses GSM
  const useSets = t.scoring && t.scoring.type === 'sets';
  const isFixedSet = useSets && t.scoring.fixedSet;

  if (useSets) {
    // Store as a single set for GSM compatibility
    var setData = { gamesP1: s1, gamesP2: s2 };
    if (isFixedSet) setData.fixedSet = true;
    m.sets = [setData];
    m.setsWonP1 = s1 > s2 ? 1 : (s2 > s1 ? 0 : 0);
    m.setsWonP2 = s2 > s1 ? 1 : (s1 > s2 ? 0 : 0);
    if (isFixedSet) {
      m.fixedSet = true;
      m.scoreP1 = s1;
      m.scoreP2 = s2;
    } else {
      // For standard sets, the inline score IS the sets won count
      m.scoreP1 = s1;
      m.scoreP2 = s2;
    }
    m.totalGamesP1 = s1;
    m.totalGamesP2 = s2;
  } else {
    m.scoreP1 = s1;
    m.scoreP2 = s2;
  }

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
    showNotification(_t('result.saved'), `${m.winner} avança!`, 'success');
  } else if (isRoundMatch) {
    // Liga/Suíço/Ranking — atualizar standings
    showNotification(_t('result.saved'), `${m.draw ? 'Empate!' : m.winner + ' venceu!'}`, 'success');
  } else {
    // Check if current group round is complete, activate next
    _checkGroupRoundComplete(t, m.group);
    showNotification(_t('result.saved'), `${m.draw ? 'Empate!' : m.winner + ' venceu!'}`, 'success');
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
      level: 'fundamental',
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

  _rerenderBracket(tId, matchId);
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
      // Undo loser advancement in double elimination (lower bracket)
      if (m.loserMatchId) {
        const lm = _findMatch(t, m.loserMatchId);
        if (lm && !lm.winner) {
          const oldLoser = m.winner === m.p1 ? m.p2 : m.p1;
          if (lm.p1 === oldLoser) lm.p1 = 'TBD';
          if (lm.p2 === oldLoser) lm.p2 = 'TBD';
        }
      }
      // Clear progressive classification entries
      if (t.classification) {
        var oldLoser2 = m.winner === m.p1 ? m.p2 : m.p1;
        delete t.classification[m.winner];
        delete t.classification[oldLoser2];
      }

      const prevWinner = m.winner;
      m.winner = null;
      m.scoreP1 = undefined;
      m.scoreP2 = undefined;
      m.draw = undefined;
      // Clear GSM data
      m.sets = undefined;
      m.setsWonP1 = undefined;
      m.setsWonP2 = undefined;
      m.totalGamesP1 = undefined;
      m.totalGamesP2 = undefined;

      window.AppStore.logAction(tId, `Resultado editado: partida ${m.label || matchId} reaberta`);
      window.AppStore.syncImmediate(tId);
      _rerenderBracket(tId);
    },
    null,
    { type: 'warning', confirmText: 'Apagar e Reeditar', cancelText: 'Cancelar' }
  );
};

// ─── Edit result inline (DOM swap: static scores → inputs, Edit → Confirm) ──
window._editResultInline = function(tId, matchId) {
  var card = document.getElementById('card-' + matchId);
  if (!card) return;
  var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
  if (!t) return;
  var m = window._findMatch ? window._findMatch(t, matchId) : null;
  if (!m) return;

  var _esc = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };
  var inputStyle = 'width:52px;text-align:center;font-size:0.95rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(245,158,11,0.4);color:var(--text-bright);border-radius:6px;padding:4px 6px;';

  // Replace score containers by their explicit IDs
  var p1ScoreDiv = document.getElementById('score-p1-' + matchId);
  if (p1ScoreDiv) {
    p1ScoreDiv.innerHTML = '<input type="number" id="s1-' + matchId + '" min="0" placeholder="0"' +
      (m.scoreP1 != null ? ' value="' + m.scoreP1 + '"' : '') +
      ' style="' + inputStyle + '" oninput="window._highlightWinner(\'' + _esc(matchId) + '\')">';
  }
  var p2ScoreDiv = document.getElementById('score-p2-' + matchId);
  if (p2ScoreDiv) {
    p2ScoreDiv.innerHTML = '<input type="number" id="s2-' + matchId + '" min="0" placeholder="0"' +
      (m.scoreP2 != null ? ' value="' + m.scoreP2 + '"' : '') +
      ' style="' + inputStyle + '" oninput="window._highlightWinner(\'' + _esc(matchId) + '\')">';
  }

  // Swap Edit button → Confirm button in the header
  var headerDiv = card.querySelector('div:first-child > div:last-child');
  if (headerDiv) {
    headerDiv.innerHTML = '<button id="confirm-' + matchId + '" onclick="window._saveResultInline(\'' + _esc(tId) + '\',\'' + _esc(matchId) + '\')"' +
      ' style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#4ade80;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;transition:all 0.2s;"' +
      ' onmouseover="this.style.background=\'rgba(16,185,129,0.3)\'" onmouseout="this.style.background=\'rgba(16,185,129,0.15)\'">✓ ' +
      (typeof _t === 'function' ? _t('bracket.confirm') : 'Confirmar') + '</button>';
  }

  // Hide winner badge and sets display
  var allDivs = card.children;
  for (var i = 0; i < allDivs.length; i++) {
    var st = allDivs[i].getAttribute('style') || '';
    if (st.indexOf('margin-top:6px') !== -1 && (st.indexOf('#4ade80') !== -1 || st.indexOf('monospace') !== -1)) {
      allDivs[i].style.display = 'none';
    }
  }

  // Focus first input
  var s1 = document.getElementById('s1-' + matchId);
  if (s1) { s1.focus(); s1.select(); }
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
  var partCount = typeof window._getCompetitors === 'function' ? window._getCompetitors(t).length : (Array.isArray(t.participants) ? t.participants.length : 0);
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
  window._tvModeClockInterval = setInterval(updateClock, 1000);

  // Auto-refresh every 30s
  window._tvModeInterval = setInterval(function() {
    var ov = document.getElementById('tv-mode-overlay');
    if (!ov) { clearInterval(window._tvModeInterval); clearInterval(window._tvModeClockInterval); return; }
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
  if (window._tvModeClockInterval) { clearInterval(window._tvModeClockInterval); window._tvModeClockInterval = null; }
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
  _rerenderBracket(tId);
};

// ─── Advance Monarch to Elimination ──────────────────────────────────────────
window._advanceMonarchToElimination = function(tId) {
  var t = window.AppStore.tournaments.find(function(tour) { return tour.id.toString() === tId.toString(); });
  if (!t || !t.groups) return;
  // Liga uses Rei/Rainha as round format only — no elimination phase
  if (typeof window._isLigaFormat === 'function' && window._isLigaFormat(t)) return;
  // Idempotent: don't re-advance if already in elimination
  if (t.currentStage === 'elimination' || (t.matches && t.matches.length > 0)) return;

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
  showNotification('Fase Eliminatória', seeded.length + ' classificados avançaram para as eliminatórias!', 'success');
  _rerenderBracket(tId);
};

// ─── Live Scoring Overlay (full-screen, point-by-point) ─────────────────────
// Opens when player clicks "📡 Ao Vivo" on their own match card.
// Supports both simple scoring and GSM (Game-Set-Match) with tennis rules.
// Also supports casual mode: _openLiveScoring(null, null, { scoring, p1Name, p2Name, title })

window._openLiveScoring = function(tId, matchId, opts) {
  var isCasual = !!(opts && opts.casual);
  var t = null, m = null;
  if (!isCasual) {
    t = window.AppStore.tournaments.find(function(tour) { return tour.id.toString() === tId.toString(); });
    if (!t) return;
    m = _findMatch(t, matchId);
    if (!m) return;
  }

  var sc = isCasual ? (opts.scoring || {}) : (t.scoring || {});
  var useSets = sc.type === 'sets';
  var p1Name = isCasual ? (opts.p1Name || 'Jogador 1') : (m.p1 || 'Jogador 1');
  var p2Name = isCasual ? (opts.p2Name || 'Jogador 2') : (m.p2 || 'Jogador 2');
  var casualTitle = isCasual ? (opts.title || 'Partida Casual') : '';
  var _esc = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };

  // Remove existing overlay
  var existing = document.getElementById('live-scoring-overlay');
  if (existing) existing.remove();

  // ── State ──
  var state = {
    sets: [], // Array of { gamesP1, gamesP2, tiebreak: { p1, p2 } | null }
    currentGameP1: 0,  // Points in current game
    currentGameP2: 0,
    isTiebreak: false,  // Currently in tiebreak within a set
    isFinished: false,
    winner: null,
    // GSM config
    setsToWin: useSets ? (sc.setsToWin || 1) : 1,
    gamesPerSet: useSets ? (sc.gamesPerSet || 6) : 1,
    tiebreakEnabled: useSets ? (sc.tiebreakEnabled !== false) : false,
    tiebreakPoints: useSets ? (sc.tiebreakPoints || 7) : 7,
    tiebreakMargin: useSets ? (sc.tiebreakMargin || 2) : 2,
    superTiebreak: useSets ? (sc.superTiebreak === true) : false,
    superTiebreakPoints: useSets ? (sc.superTiebreakPoints || 10) : 10,
    countingType: useSets ? (sc.countingType || 'numeric') : 'numeric',
    advantageRule: useSets ? (sc.advantageRule === true) : false,
    isFixedSet: useSets && sc.fixedSet === true,
    fixedSetGames: useSets && sc.fixedSet ? (sc.fixedSetGames || sc.gamesPerSet || 6) : 0
  };

  // Initialize first set
  state.sets.push({ gamesP1: 0, gamesP2: 0, tiebreak: null });

  // Check if this is the deciding set (super tiebreak)
  function _isDecidingSet() {
    var totalSets = state.setsToWin * 2 - 1;
    return state.superTiebreak && state.sets.length === totalSets;
  }

  // Get current set
  function _currentSet() {
    return state.sets[state.sets.length - 1];
  }

  // Count sets won
  function _setsWon(player) {
    var count = 0;
    for (var i = 0; i < state.sets.length - 1; i++) { // Exclude current set
      var s = state.sets[i];
      if (player === 1 && s.gamesP1 > s.gamesP2) count++;
      if (player === 2 && s.gamesP2 > s.gamesP1) count++;
    }
    return count;
  }

  // Format game points for display
  function _formatGamePoint(pts, oppPts, isTb) {
    if (isTb) return String(pts);
    if (state.countingType === 'tennis' && !state.isFixedSet) {
      // Tennis counting: 0, 15, 30, 40, AD
      if (pts >= 3 && oppPts >= 3) {
        if (state.advantageRule) {
          if (pts === oppPts) return '40';
          if (pts > oppPts) return 'AD';
          return '40';
        }
        return '40'; // No advantage: sudden death at deuce
      }
      var map = [0, 15, 30, 40];
      return String(pts < 4 ? map[pts] : 40);
    }
    return String(pts);
  }

  // Check if game is won
  function _checkGameWon() {
    var p1 = state.currentGameP1;
    var p2 = state.currentGameP2;

    if (state.isTiebreak || _isDecidingSet()) {
      // Tiebreak rules
      var tbPts = _isDecidingSet() ? state.superTiebreakPoints : state.tiebreakPoints;
      var margin = state.tiebreakMargin || 2;
      if (p1 >= tbPts && p1 - p2 >= margin) return 1;
      if (p2 >= tbPts && p2 - p1 >= margin) return 2;
      return 0;
    }

    if (state.isFixedSet) {
      // Fixed set: just count points, no game concept within
      var total = state.fixedSetGames;
      if (p1 + p2 >= total) {
        return p1 > p2 ? 1 : (p2 > p1 ? 2 : 0);
      }
      return 0;
    }

    if (state.countingType === 'tennis') {
      // Tennis game rules: need 4 points and lead by 2 (or no advantage)
      if (p1 >= 4 && p2 >= 4) {
        if (!state.advantageRule) {
          // Sudden death at deuce: whoever scored last wins
          return p1 > p2 ? 1 : 2;
        }
        if (p1 - p2 >= 2) return 1;
        if (p2 - p1 >= 2) return 2;
        return 0;
      }
      if (p1 >= 4 && p1 - p2 >= 2) return 1;
      if (p2 >= 4 && p2 - p1 >= 2) return 2;
      return 0;
    }

    // Numeric: first to gamesPerSet... no, that's set level. For simple numeric games,
    // each "point" IS a game directly
    return 0;
  }

  // Check if set is won
  function _checkSetWon() {
    var cs = _currentSet();
    var g = state.gamesPerSet;

    if (state.isFixedSet) {
      // Fixed set: game IS the set
      return 0; // Handled in _checkGameWon
    }

    if (_isDecidingSet()) {
      // Super tiebreak set: won via tiebreak points
      return 0; // handled by tiebreak game
    }

    // Standard set: first to 'g' games with 2-game lead, or tiebreak at g-g
    if (cs.gamesP1 >= g && cs.gamesP1 - cs.gamesP2 >= 2) return 1;
    if (cs.gamesP2 >= g && cs.gamesP2 - cs.gamesP1 >= 2) return 2;

    // Tiebreak trigger: at g-g
    if (state.tiebreakEnabled && cs.gamesP1 === g && cs.gamesP2 === g) {
      state.isTiebreak = true;
      state.currentGameP1 = 0;
      state.currentGameP2 = 0;
      return -1; // Signal: entering tiebreak
    }

    return 0;
  }

  // Check if match is won
  function _checkMatchWon() {
    if (_setsWon(1) >= state.setsToWin) return 1;
    if (_setsWon(2) >= state.setsToWin) return 2;
    return 0;
  }

  // Add point to player
  function _addPoint(player) {
    if (state.isFinished) return;

    if (player === 1) state.currentGameP1++;
    else state.currentGameP2++;

    if (!useSets || state.isFixedSet) {
      // Simple scoring or fixed set: each tap is 1 point
      if (state.isFixedSet) {
        var cs = _currentSet();
        if (player === 1) cs.gamesP1 = state.currentGameP1;
        else cs.gamesP2 = state.currentGameP2;
        // Check if fixed set is done
        if (state.currentGameP1 + state.currentGameP2 >= state.fixedSetGames) {
          if (state.currentGameP1 === state.currentGameP2 && state.tiebreakEnabled) {
            // Tie in fixed set → go to tiebreak
            state.isTiebreak = true;
            state.currentGameP1 = 0;
            state.currentGameP2 = 0;
          } else {
            var winner = state.currentGameP1 > state.currentGameP2 ? 1 : 2;
            _finishSet(winner);
          }
        }
      } else if (!useSets) {
        // Simple mode: just track score
        _render();
        return;
      }
      _render();
      return;
    }

    // GSM: check if game is won
    var gameWinner = _checkGameWon();
    if (gameWinner > 0) {
      // Game won — add to set games
      var cs = _currentSet();
      if (state.isTiebreak) {
        // Tiebreak won → set is won by this player
        cs.tiebreak = { p1: state.currentGameP1, p2: state.currentGameP2 };
        if (gameWinner === 1) cs.gamesP1++;
        else cs.gamesP2++;
        state.isTiebreak = false;
        _finishSet(gameWinner);
      } else if (_isDecidingSet()) {
        // Super tiebreak won
        cs.tiebreak = { p1: state.currentGameP1, p2: state.currentGameP2 };
        if (gameWinner === 1) cs.gamesP1++;
        else cs.gamesP2++;
        _finishSet(gameWinner);
      } else {
        // Normal game won
        if (gameWinner === 1) cs.gamesP1++;
        else cs.gamesP2++;
        state.currentGameP1 = 0;
        state.currentGameP2 = 0;

        // Check if set is won
        var setResult = _checkSetWon();
        if (setResult > 0) {
          _finishSet(setResult);
        }
        // setResult === -1 means we entered tiebreak, already handled
      }
    }

    _render();
  }

  function _finishSet(setWinner) {
    state.currentGameP1 = 0;
    state.currentGameP2 = 0;
    state.isTiebreak = false;

    // Check match winner
    var matchWinner = _checkMatchWon();
    if (matchWinner > 0 || (!useSets && state.isFixedSet)) {
      // For fixed set: check directly
      if (state.isFixedSet) matchWinner = setWinner;
      state.isFinished = true;
      state.winner = matchWinner;
    } else {
      // Start new set
      state.sets.push({ gamesP1: 0, gamesP2: 0, tiebreak: null });
    }
  }

  // Undo last point
  function _undoPoint() {
    // Simple undo: remove last point. For complex GSM state, we use a history approach.
    // For now, decrement the higher score or last-incremented
    if (state.isFinished) return;
    // Cannot undo if both are 0 in current game
    if (state.currentGameP1 === 0 && state.currentGameP2 === 0) {
      // Try to undo a set (go back to previous set's last game)
      // This is complex — for MVP, just ignore
      return;
    }
    // We need to track history for proper undo. For MVP, just warn.
    showNotification('Desfazer', 'Use o botão — para corrigir o placar manualmente.', 'info');
  }

  // Save result to match
  function _saveResult() {
    if (isCasual) {
      // Casual mode: just show result and close
      var winnerName = state.winner === 1 ? p1Name : (state.winner === 2 ? p2Name : 'Empate');
      var ov = document.getElementById('live-scoring-overlay');
      if (ov) ov.remove();
      // Build summary for casual
      var summary = '';
      if (useSets) {
        for (var si = 0; si < state.sets.length; si++) {
          var ss = state.sets[si];
          summary += ss.gamesP1 + '-' + ss.gamesP2;
          if (ss.tiebreak) summary += '(' + ss.tiebreak.p1 + '-' + ss.tiebreak.p2 + ')';
          if (si < state.sets.length - 1) summary += '  ';
        }
      } else {
        summary = state.currentGameP1 + ' × ' + state.currentGameP2;
      }
      showNotification('Partida encerrada', winnerName + (state.winner === 0 ? '' : ' venceu!') + ' — ' + summary, 'success');
      // Save to casual match history in localStorage
      try {
        var hist = JSON.parse(localStorage.getItem('scoreplace_casual_history') || '[]');
        hist.unshift({ p1: p1Name, p2: p2Name, winner: winnerName, summary: summary, date: new Date().toISOString(), sport: opts.sportName || '' });
        if (hist.length > 50) hist = hist.slice(0, 50);
        localStorage.setItem('scoreplace_casual_history', JSON.stringify(hist));
      } catch(e) {}
      return;
    }

    if (useSets) {
      // Save as GSM sets data
      m.sets = state.sets.map(function(s) {
        var setData = { gamesP1: s.gamesP1, gamesP2: s.gamesP2 };
        if (s.tiebreak) setData.tiebreak = { pointsP1: s.tiebreak.p1, pointsP2: s.tiebreak.p2 };
        if (state.isFixedSet) setData.fixedSet = true;
        return setData;
      });
      var totalSetsP1 = 0, totalSetsP2 = 0, totalGamesP1 = 0, totalGamesP2 = 0;
      for (var i = 0; i < state.sets.length; i++) {
        var s = state.sets[i];
        if (s.gamesP1 > s.gamesP2) totalSetsP1++;
        else if (s.gamesP2 > s.gamesP1) totalSetsP2++;
        totalGamesP1 += s.gamesP1;
        totalGamesP2 += s.gamesP2;
      }
      m.setsWonP1 = totalSetsP1;
      m.setsWonP2 = totalSetsP2;
      m.scoreP1 = totalSetsP1;
      m.scoreP2 = totalSetsP2;
      m.totalGamesP1 = totalGamesP1;
      m.totalGamesP2 = totalGamesP2;
      if (state.isFixedSet) {
        m.fixedSet = true;
        m.scoreP1 = totalGamesP1;
        m.scoreP2 = totalGamesP2;
      }
    } else {
      // Simple scoring
      m.scoreP1 = state.currentGameP1;
      m.scoreP2 = state.currentGameP2;
    }

    if (state.winner === 1) m.winner = m.p1;
    else if (state.winner === 2) m.winner = m.p2;
    else if (state.currentGameP1 === state.currentGameP2) {
      m.winner = 'draw';
      m.draw = true;
    } else {
      m.winner = state.currentGameP1 > state.currentGameP2 ? m.p1 : m.p2;
    }
    m.liveScored = true;

    // Save & sync
    window.AppStore.syncImmediate(tId);
    if (typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.saveTournament) {
      window.FirestoreDB.saveTournament(t);
    }

    // Close overlay
    var ov = document.getElementById('live-scoring-overlay');
    if (ov) ov.remove();

    showNotification('Resultado salvo', m.winner === 'draw' ? 'Empate!' : (m.winner + ' venceu!'), 'success');
    _rerenderBracket(tId, matchId);

    // Auto-advance etc.
    if (typeof window._advanceWinner === 'function') window._advanceWinner(t, m);
    if (typeof window._maybeFinishElimination === 'function') window._maybeFinishElimination(t);
  }

  // ── Render function ──
  function _render() {
    var container = document.getElementById('live-score-content');
    if (!container) return;

    // Sets display
    var setsDisplay = '';
    if (useSets && !state.isFixedSet) {
      for (var i = 0; i < state.sets.length; i++) {
        var s = state.sets[i];
        var isCurrent = (i === state.sets.length - 1) && !state.isFinished;
        var bg = isCurrent ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)';
        var border = isCurrent ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)';
        var tbStr = s.tiebreak ? '<span style="font-size:0.6rem;color:#c084fc;vertical-align:super;">(' + s.tiebreak.p1 + '-' + s.tiebreak.p2 + ')</span>' : '';
        setsDisplay += '<div style="display:inline-flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:8px;background:' + bg + ';border:1px solid ' + border + ';min-width:44px;">' +
          '<div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:2px;">' + (i + 1) + '</div>' +
          '<div style="font-size:1rem;font-weight:700;color:var(--text-bright);">' + s.gamesP1 + '-' + s.gamesP2 + tbStr + '</div>' +
        '</div>';
      }
    }

    // Current game display
    var gameLabel = '';
    var p1Display, p2Display;
    if (state.isFinished) {
      gameLabel = state.winner === 1 ? p1Name + ' venceu!' : p2Name + ' venceu!';
      p1Display = '✓';
      p2Display = '✓';
    } else if (!useSets || state.isFixedSet) {
      // Simple or fixed set: show raw points
      gameLabel = state.isFixedSet ? 'Set Fixo' : 'Placar';
      p1Display = String(state.currentGameP1);
      p2Display = String(state.currentGameP2);
    } else if (_isDecidingSet()) {
      gameLabel = 'Super Tie-break';
      p1Display = String(state.currentGameP1);
      p2Display = String(state.currentGameP2);
    } else if (state.isTiebreak) {
      gameLabel = 'Tie-break';
      p1Display = String(state.currentGameP1);
      p2Display = String(state.currentGameP2);
    } else {
      gameLabel = 'Game';
      p1Display = _formatGamePoint(state.currentGameP1, state.currentGameP2, false);
      p2Display = _formatGamePoint(state.currentGameP2, state.currentGameP1, false);
    }

    // Serving indicator (for tiebreak: alternates every 2 points after first)
    var servingHtml = '';
    if (state.isTiebreak || _isDecidingSet()) {
      var totalPts = state.currentGameP1 + state.currentGameP2;
      // First point: server, then alternate every 2
      var serving = (totalPts === 0) ? 1 : (Math.floor((totalPts - 1) / 2) % 2 === 0 ? 2 : 1);
      servingHtml = '<div style="text-align:center;font-size:0.72rem;color:#fbbf24;margin-bottom:4px;">🏓 Saque: ' + (serving === 1 ? window._safeHtml(p1Name.split(' ')[0]) : window._safeHtml(p2Name.split(' ')[0])) + '</div>';
    }

    // Finish button
    var finishBtn = '';
    if (state.isFinished) {
      finishBtn = '<button onclick="window._liveScoreSave()" style="width:100%;padding:16px;border-radius:14px;font-size:1.1rem;font-weight:800;border:none;cursor:pointer;' +
        'background:linear-gradient(135deg,#10b981,#059669);color:white;margin-top:1rem;box-shadow:0 4px 20px rgba(16,185,129,0.4);">✅ Confirmar Resultado</button>';
    } else if (!useSets) {
      // Simple mode: allow finishing any time with a confirm button
      finishBtn = '<button onclick="window._liveScoreFinish()" style="width:100%;padding:14px;border-radius:14px;font-size:0.95rem;font-weight:700;border:2px solid rgba(16,185,129,0.3);cursor:pointer;' +
        'background:rgba(16,185,129,0.1);color:#10b981;margin-top:1rem;">Encerrar Partida</button>';
    }

    container.innerHTML =
      // Sets row
      (setsDisplay ? '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:1.5rem;">' + setsDisplay + '</div>' : '') +

      // Game label
      servingHtml +
      '<div style="text-align:center;font-size:0.78rem;font-weight:600;color:' + (state.isFinished ? '#10b981' : state.isTiebreak || _isDecidingSet() ? '#c084fc' : '#60a5fa') + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem;">' + gameLabel + '</div>' +

      // Player rows with scores and buttons
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        // Player 1
        '<div style="display:flex;align-items:center;gap:12px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:14px;padding:12px 16px;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:1rem;font-weight:700;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(p1Name) + '</div>' +
            (useSets && !state.isFixedSet && !state.isFinished ? '<div style="font-size:0.72rem;color:var(--text-muted);">Sets: ' + _setsWon(1) + '</div>' : '') +
          '</div>' +
          '<div style="font-size:2.5rem;font-weight:900;color:#60a5fa;min-width:60px;text-align:center;font-variant-numeric:tabular-nums;">' + p1Display + '</div>' +
          (state.isFinished ? '' : '<button onclick="window._liveScorePoint(1)" style="width:64px;height:64px;border-radius:50%;font-size:2rem;font-weight:900;border:none;cursor:pointer;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;box-shadow:0 4px 16px rgba(59,130,246,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;" ontouchstart="this.style.transform=\'scale(0.92)\'" ontouchend="this.style.transform=\'scale(1)\'">+</button>') +
        '</div>' +
        // Player 2
        '<div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:14px;padding:12px 16px;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:1rem;font-weight:700;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(p2Name) + '</div>' +
            (useSets && !state.isFixedSet && !state.isFinished ? '<div style="font-size:0.72rem;color:var(--text-muted);">Sets: ' + _setsWon(2) + '</div>' : '') +
          '</div>' +
          '<div style="font-size:2.5rem;font-weight:900;color:#f87171;min-width:60px;text-align:center;font-variant-numeric:tabular-nums;">' + p2Display + '</div>' +
          (state.isFinished ? '' : '<button onclick="window._liveScorePoint(2)" style="width:64px;height:64px;border-radius:50%;font-size:2rem;font-weight:900;border:none;cursor:pointer;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;box-shadow:0 4px 16px rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;" ontouchstart="this.style.transform=\'scale(0.92)\'" ontouchend="this.style.transform=\'scale(1)\'">+</button>') +
        '</div>' +
      '</div>' +

      finishBtn;
  }

  // ── Global handlers (attached to window for onclick access) ──
  window._liveScorePoint = function(player) { _addPoint(player); };
  window._liveScoreSave = _saveResult;
  window._liveScoreFinish = function() {
    // For simple scoring: finish and set winner
    if (state.currentGameP1 === state.currentGameP2 && state.currentGameP1 === 0) {
      showNotification('Placar vazio', 'Marque pelo menos um ponto antes de encerrar.', 'warning');
      return;
    }
    state.isFinished = true;
    if (state.currentGameP1 > state.currentGameP2) state.winner = 1;
    else if (state.currentGameP2 > state.currentGameP1) state.winner = 2;
    else state.winner = 0; // draw
    _render();
  };

  // ── Build overlay ──
  var overlay = document.createElement('div');
  overlay.id = 'live-scoring-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0e1a;z-index:100002;display:flex;flex-direction:column;overflow:hidden;';

  // Header
  var headerBg = 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)';
  var headerHtml = '<div style="background:' + headerBg + ';padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
      '<span style="font-size:1.2rem;">📡</span>' +
      '<div>' +
        '<div style="font-size:0.9rem;font-weight:800;color:#f87171;">AO VIVO</div>' +
        '<div style="font-size:0.68rem;color:var(--text-muted);">' + window._safeHtml(isCasual ? casualTitle : (t && t.name || 'Torneio')) + '</div>' +
      '</div>' +
    '</div>' +
    '<button onclick="window._closeLiveScoring()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:10px;padding:8px 16px;font-size:0.82rem;font-weight:600;cursor:pointer;">✕ Fechar</button>' +
  '</div>';

  // Match info bar
  var matchLabel = isCasual ? (opts.sportName || 'Partida Casual') : (m.roundIndex !== undefined ? 'Rodada ' + (m.roundIndex + 1) : (m.round || ''));
  var scoringSummary = '';
  if (useSets) {
    scoringSummary = sc.setsToWin + ' set' + (sc.setsToWin > 1 ? 's' : '') + ' · ' + sc.gamesPerSet + ' games' + (sc.tiebreakEnabled ? ' · TB ' + sc.tiebreakPoints : '') + (sc.superTiebreak ? ' · Super TB' : '');
    if (sc.fixedSet) scoringSummary = 'Set Fixo ' + (sc.fixedSetGames || sc.gamesPerSet) + ' games';
  }
  var infoHtml = '<div style="text-align:center;padding:8px 16px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;">' +
    '<span style="font-size:0.72rem;color:var(--text-muted);">' + window._safeHtml(matchLabel) + '</span>' +
    (scoringSummary ? '<div style="font-size:0.65rem;color:var(--text-muted);opacity:0.7;margin-top:2px;">' + window._safeHtml(scoringSummary) + '</div>' : '') +
  '</div>';

  // Content area
  overlay.innerHTML = headerHtml + infoHtml +
    '<div id="live-score-content" style="flex:1;overflow-y:auto;padding:1.5rem 1rem;display:flex;flex-direction:column;justify-content:center;-webkit-overflow-scrolling:touch;"></div>';

  document.body.appendChild(overlay);

  // Close handler
  window._closeLiveScoring = function() {
    if (!state.isFinished && (state.currentGameP1 > 0 || state.currentGameP2 > 0 || state.sets.length > 1)) {
      showConfirmDialog(
        'Sair do placar ao vivo?',
        'O progresso será perdido.',
        function() {
          var ov = document.getElementById('live-scoring-overlay');
          if (ov) ov.remove();
        }
      );
    } else {
      var ov = document.getElementById('live-scoring-overlay');
      if (ov) ov.remove();
    }
  };

  // Initial render
  _render();
};

// ─── Casual Match Setup Screen ──────────────────────────────────────────────
// Opens from dashboard "Partida Casual" button. Shows sport picker, player
// names, scoring config summary + gear icon, then launches live scoring.

window._openCasualMatch = function() {
  // Remove existing
  var existing = document.getElementById('casual-match-overlay');
  if (existing) existing.remove();

  // Detect user's preferred sport
  var cu = window.AppStore && window.AppStore.currentUser;
  var userSport = '';
  if (cu && cu.preferredSports) {
    // Take first sport from comma-separated list
    userSport = cu.preferredSports.split(',')[0].trim();
  }

  // Available sports (same as create-tournament)
  var sports = [
    { key: 'Beach Tennis', icon: '🎾', label: 'Beach Tennis' },
    { key: 'Pickleball', icon: '🥒', label: 'Pickleball' },
    { key: 'Tênis', icon: '🎾', label: 'Tênis' },
    { key: 'Tênis de Mesa', icon: '🏓', label: 'Tênis de Mesa' },
    { key: 'Padel', icon: '🏸', label: 'Padel' },
    { key: '_simple', icon: '🏅', label: 'Placar Simples' }
  ];

  // Resolve initial sport (match user pref to available options)
  var initialSport = '_simple';
  for (var si = 0; si < sports.length; si++) {
    if (userSport && userSport.toLowerCase().indexOf(sports[si].key.toLowerCase()) !== -1) {
      initialSport = sports[si].key;
      break;
    }
    if (userSport && sports[si].key.toLowerCase().indexOf(userSport.toLowerCase().replace(/[^\w\u00C0-\u024F]/gu, '')) !== -1) {
      initialSport = sports[si].key;
      break;
    }
  }

  // State
  var selectedSport = initialSport;
  var p1Name = (cu && cu.displayName) ? cu.displayName.split(' ')[0] : '';
  var p2Name = '';

  function _getConfig() {
    if (selectedSport === '_simple') return { type: 'simple' };
    // Check user's saved GSM prefs first
    try {
      var prefs = JSON.parse(localStorage.getItem('scoreplace_gsm_prefs') || '{}');
      if (prefs[selectedSport]) return prefs[selectedSport];
    } catch(e) {}
    // Fallback to sport defaults
    var defaults = window._sportScoringDefaults || {};
    return defaults[selectedSport] || defaults['_default'] || { type: 'simple' };
  }

  function _configSummary() {
    var cfg = _getConfig();
    if (cfg.type === 'simple' || !cfg.type || cfg.type !== 'sets') return 'Placar livre (sem sets/games)';
    var parts = [];
    parts.push(cfg.setsToWin + ' set' + (cfg.setsToWin > 1 ? 's' : '') + ' para vencer');
    parts.push(cfg.gamesPerSet + ' games/set');
    if (cfg.tiebreakEnabled) parts.push('TB ' + (cfg.tiebreakPoints || 7) + ' pts');
    if (cfg.superTiebreak) parts.push('Super TB ' + (cfg.superTiebreakPoints || 10) + ' pts');
    if (cfg.countingType === 'tennis') parts.push('Contagem tênis (15-30-40)');
    if (cfg.advantageRule) parts.push('Vantagem (AD)');
    if (cfg.fixedSet) parts.push('Set fixo ' + (cfg.fixedSetGames || cfg.gamesPerSet) + ' games');
    return parts.join(' · ');
  }

  function _renderSetup() {
    var content = document.getElementById('casual-setup-content');
    if (!content) return;

    // Sport buttons
    var sportBtns = '';
    for (var i = 0; i < sports.length; i++) {
      var sp = sports[i];
      var isActive = sp.key === selectedSport;
      sportBtns += '<button onclick="window._casualSelectSport(\'' + sp.key.replace(/'/g, "\\'") + '\')" style="' +
        'padding:8px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;' +
        'border:2px solid ' + (isActive ? '#fbbf24' : 'rgba(255,255,255,0.12)') + ';' +
        'background:' + (isActive ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)') + ';' +
        'color:' + (isActive ? '#fbbf24' : 'var(--text-muted)') + ';font-weight:' + (isActive ? '700' : '500') + ';' +
        '">' + sp.icon + ' ' + sp.label + '</button>';
    }

    content.innerHTML =
      // Sport picker
      '<div style="margin-bottom:1.5rem;">' +
        '<label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:block;">Modalidade</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + sportBtns + '</div>' +
      '</div>' +

      // Config summary + gear
      '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:12px 16px;margin-bottom:1.5rem;display:flex;align-items:center;gap:12px;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.72rem;font-weight:600;color:#818cf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Configuração do Jogo</div>' +
          '<div style="font-size:0.78rem;color:var(--text-bright);" id="casual-config-summary">' + window._safeHtml(_configSummary()) + '</div>' +
        '</div>' +
        '<button onclick="window._casualOpenConfig()" style="width:42px;height:42px;border-radius:50%;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#818cf8;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Configurar">⚙️</button>' +
      '</div>' +

      // Player names
      '<div style="margin-bottom:1.5rem;">' +
        '<label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:block;">Jogadores</label>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.2);color:#60a5fa;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;flex-shrink:0;">1</div>' +
            '<input type="text" id="casual-p1-name" value="' + window._safeHtml(p1Name) + '" placeholder="Nome do jogador 1" style="flex:1;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-bright);font-size:0.95rem;font-weight:600;outline:none;" onfocus="this.style.borderColor=\'rgba(59,130,246,0.4)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.12)\'">' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:28px;height:28px;border-radius:50%;background:rgba(239,68,68,0.2);color:#f87171;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;flex-shrink:0;">2</div>' +
            '<input type="text" id="casual-p2-name" value="' + window._safeHtml(p2Name) + '" placeholder="Nome do jogador 2" style="flex:1;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-bright);font-size:0.95rem;font-weight:600;outline:none;" onfocus="this.style.borderColor=\'rgba(239,68,68,0.4)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.12)\'">' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Start button
      '<button onclick="window._casualStart()" style="width:100%;padding:18px;border-radius:14px;font-size:1.15rem;font-weight:800;border:none;cursor:pointer;background:linear-gradient(135deg,#dc2626,#ef4444);color:white;box-shadow:0 4px 20px rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent;" ontouchstart="this.style.transform=\'scale(0.97)\'" ontouchend="this.style.transform=\'scale(1)\'">' +
        '<span style="font-size:1.5rem;">📡</span> Iniciar Partida' +
      '</button>';
  }

  // Sport selection handler
  window._casualSelectSport = function(key) {
    selectedSport = key;
    _renderSetup();
  };

  // Config gear handler — opens inline config editor
  window._casualOpenConfig = function() {
    var cfg = _getConfig();
    var content = document.getElementById('casual-setup-content');
    if (!content) return;

    var isSimple = !cfg.type || cfg.type === 'simple' || cfg.type !== 'sets';

    content.innerHTML =
      '<div style="margin-bottom:1rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
          '<div style="font-size:0.9rem;font-weight:700;color:var(--text-bright);">⚙️ Configuração</div>' +
          '<button onclick="window._casualCloseConfig()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:6px 14px;font-size:0.78rem;font-weight:600;cursor:pointer;">← Voltar</button>' +
        '</div>' +

        // Scoring type
        '<div style="margin-bottom:1rem;">' +
          '<label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:block;">Tipo de Placar</label>' +
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="window._casualSetType(\'simple\')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;border:2px solid ' + (isSimple ? '#10b981' : 'rgba(255,255,255,0.12)') + ';background:' + (isSimple ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)') + ';color:' + (isSimple ? '#10b981' : 'var(--text-muted)') + ';">Simples</button>' +
            '<button onclick="window._casualSetType(\'sets\')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;border:2px solid ' + (!isSimple ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (!isSimple ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)') + ';color:' + (!isSimple ? '#818cf8' : 'var(--text-muted)') + ';">Game Set Match</button>' +
          '</div>' +
        '</div>' +

        // GSM options (visible only when type=sets)
        (isSimple ? '' :
        '<div style="display:flex;flex-direction:column;gap:12px;">' +
          // Sets to win
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Sets para vencer</span>' +
            '<div style="display:flex;gap:4px;">' +
              [1,2,3].map(function(n) {
                var active = (cfg.setsToWin || 1) === n;
                return '<button onclick="window._casualSetCfg(\'setsToWin\',' + n + ')" style="width:36px;height:36px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;border:1px solid ' + (active ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (active ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (active ? '#818cf8' : 'var(--text-muted)') + ';">' + n + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          // Games per set
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Games/set</span>' +
            '<div style="display:flex;gap:4px;">' +
              [4,6,8,11].map(function(n) {
                var active = (cfg.gamesPerSet || 6) === n;
                return '<button onclick="window._casualSetCfg(\'gamesPerSet\',' + n + ')" style="width:36px;height:36px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;border:1px solid ' + (active ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (active ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (active ? '#818cf8' : 'var(--text-muted)') + ';">' + n + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          // Tiebreak
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Tiebreak</span>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#818cf8;"><input type="checkbox" id="casual-cfg-tb" ' + (cfg.tiebreakEnabled ? 'checked' : '') + ' onchange="window._casualSetCfg(\'tiebreakEnabled\',this.checked)"><span class="toggle-slider"></span></label>' +
          '</div>' +
          // Super Tiebreak
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Super Tiebreak (set decisivo)</span>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#818cf8;"><input type="checkbox" id="casual-cfg-stb" ' + (cfg.superTiebreak ? 'checked' : '') + ' onchange="window._casualSetCfg(\'superTiebreak\',this.checked)"><span class="toggle-slider"></span></label>' +
          '</div>' +
          // Counting type
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Contagem</span>' +
            '<div style="display:flex;gap:4px;">' +
              '<button onclick="window._casualSetCfg(\'countingType\',\'tennis\')" style="padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;border:1px solid ' + (cfg.countingType === 'tennis' ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (cfg.countingType === 'tennis' ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (cfg.countingType === 'tennis' ? '#818cf8' : 'var(--text-muted)') + ';">15-30-40</button>' +
              '<button onclick="window._casualSetCfg(\'countingType\',\'numeric\')" style="padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;border:1px solid ' + (cfg.countingType !== 'tennis' ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (cfg.countingType !== 'tennis' ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (cfg.countingType !== 'tennis' ? '#818cf8' : 'var(--text-muted)') + ';">1-2-3</button>' +
            '</div>' +
          '</div>' +
          // Advantage rule
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Regra de vantagem (AD)</span>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#818cf8;"><input type="checkbox" id="casual-cfg-adv" ' + (cfg.advantageRule ? 'checked' : '') + ' onchange="window._casualSetCfg(\'advantageRule\',this.checked)"><span class="toggle-slider"></span></label>' +
          '</div>' +
        '</div>'
        ) +
      '</div>';
  };

  // Temp config object for editing
  var _tempCfg = null;

  window._casualSetType = function(type) {
    if (type === 'simple') {
      _tempCfg = { type: 'simple' };
    } else {
      var base = _getConfig();
      if (base.type !== 'sets') {
        // Switch to defaults for selected sport
        var defaults = window._sportScoringDefaults || {};
        base = defaults[selectedSport] || defaults['Beach Tennis'] || { type: 'sets', setsToWin: 1, gamesPerSet: 6, tiebreakEnabled: true, tiebreakPoints: 7, tiebreakMargin: 2, superTiebreak: false, superTiebreakPoints: 10, countingType: 'tennis', advantageRule: false };
      }
      _tempCfg = Object.assign({}, base, { type: 'sets' });
    }
    _saveTempCfg();
    window._casualOpenConfig();
  };

  window._casualSetCfg = function(key, value) {
    if (!_tempCfg) _tempCfg = Object.assign({}, _getConfig());
    _tempCfg[key] = value;
    _saveTempCfg();
    window._casualOpenConfig();
  };

  function _saveTempCfg() {
    if (!_tempCfg) return;
    try {
      var prefs = JSON.parse(localStorage.getItem('scoreplace_gsm_prefs') || '{}');
      var saveKey = selectedSport === '_simple' ? '_casual' : selectedSport;
      prefs[saveKey] = _tempCfg;
      localStorage.setItem('scoreplace_gsm_prefs', JSON.stringify(prefs));
    } catch(e) {}
  }

  window._casualCloseConfig = function() {
    _tempCfg = null;
    _renderSetup();
  };

  // Start the match
  window._casualStart = function() {
    var n1 = (document.getElementById('casual-p1-name') || {}).value || 'Jogador 1';
    var n2 = (document.getElementById('casual-p2-name') || {}).value || 'Jogador 2';
    n1 = n1.trim() || 'Jogador 1';
    n2 = n2.trim() || 'Jogador 2';

    var cfg = _getConfig();

    // Close setup overlay
    var ov = document.getElementById('casual-match-overlay');
    if (ov) ov.remove();

    // Open live scoring in casual mode
    window._openLiveScoring(null, null, {
      casual: true,
      scoring: cfg,
      p1Name: n1,
      p2Name: n2,
      title: 'Partida Casual',
      sportName: selectedSport === '_simple' ? 'Placar Simples' : selectedSport
    });
  };

  // Build overlay
  var overlay = document.createElement('div');
  overlay.id = 'casual-match-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0e1a;z-index:100002;display:flex;flex-direction:column;overflow:hidden;';

  overlay.innerHTML =
    // Header
    '<div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:1.3rem;">📡</span>' +
        '<div>' +
          '<div style="font-size:0.95rem;font-weight:800;color:#f87171;">Partida Casual</div>' +
          '<div style="font-size:0.68rem;color:var(--text-muted);">Sem torneio — placar ao vivo</div>' +
        '</div>' +
      '</div>' +
      '<button onclick="var ov=document.getElementById(\'casual-match-overlay\');if(ov)ov.remove();" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:10px;padding:8px 16px;font-size:0.82rem;font-weight:600;cursor:pointer;">✕ Fechar</button>' +
    '</div>' +
    // Content
    '<div id="casual-setup-content" style="flex:1;overflow-y:auto;padding:1.5rem 1rem;-webkit-overflow-scrolling:touch;"></div>';

  document.body.appendChild(overlay);
  _renderSetup();

  // Auto-focus player 2 name after render
  setTimeout(function() {
    var p2El = document.getElementById('casual-p2-name');
    if (p2El && !p2El.value) p2El.focus();
  }, 300);
};

// _closeRound is in bracket-logic.js
