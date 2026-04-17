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
        showNotification(_t('sub.done'), _t('sub.doneMsg', {name: replacementName, absent: absentPlayer}), 'success');
        _rerenderBracket(tId);
      }, null,
      { type: 'warning', confirmText: _t('bui.subWoConfirm'), cancelText: _t('btn.cancel') }
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
        showAlertDialog(_t('bui.tooFewSubTitle'), _t('bui.tooFewSubMsg', { teamSize: teamSize, n: standby.length }), null, { type: 'warning' });
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
        showNotification(_t('sub.done'), _t('sub.doneMsg', {name: replacementName, absent: absentTeam}), 'success');
        _rerenderBracket(tId);
      }, null,
      { type: 'warning', confirmText: _t('btn.dqSub'), cancelText: _t('btn.cancel') }
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
    if (typeof showNotification === 'function') showNotification(_t('sub.noSubPresent'), _t('sub.noSubPresentMsg'), 'warning');
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
    if (typeof showNotification === 'function') showNotification(_t('sub.noWO'), _t('sub.noWOMsg'), 'info');
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

    showConfirmDialog(_t('bui.subWoTitle'),
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
        showNotification(_t('sub.done'), _t('sub.donePartnerMsg', {name: replacementName, absent: absentMemberName, partner: partnerName}), 'success');
        var container = document.getElementById('view-container');
        if (container && typeof renderParticipants === 'function') renderParticipants(container, tId);
      }, null, { type: 'warning', confirmText: _t('bui.subWoConfirm'), cancelText: _t('btn.cancel') });
  } else {
    // Individual player — replace entire entry
    showConfirmDialog(_t('bui.subWoTitle'),
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
        showNotification(_t('sub.done'), _t('sub.doneMsg', {name: replacementName, absent: absentMemberName}), 'success');
        var container = document.getElementById('view-container');
        if (container && typeof renderParticipants === 'function') renderParticipants(container, tId);
      }, null, { type: 'warning', confirmText: _t('bui.subWoConfirm'), cancelText: _t('btn.cancel') });
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
    { type: 'warning', confirmText: _t('btn.deleteReedit'), cancelText: _t('btn.cancel') }
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
          window.showAlertDialog(_t('bui.resultCopiedTitle'), _t('bui.resultCopiedMsg'));
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
    if (typeof showAlertDialog === 'function') showAlertDialog(_t('bui.tournNotFoundTitle'), _t('bui.tournNotFoundAlertMsg'), null, { type: 'warning' });
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
    showAlertDialog(_t('bui.h2hTitle', { name: playerName }), _t('bui.h2hEmpty'), null, { type: 'info' });
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

  showAlertDialog(_t('bui.h2hTitle', { name: playerName }), summary + tableHtml, null, { type: 'info' });
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

  showNotification(_t('bui.knockoutPhase'), _t('bui.knockoutPhaseMsg', {n: seeded.length}), 'success');
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
    showAlertDialog(_t('bui.tooFewAdvanceTitle'), _t('bui.tooFewAdvanceMsg'), null, { type: 'warning' });
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
  showNotification(_t('bui.knockoutPhase'), _t('bui.knockoutPhaseMsg', {n: seeded.length}), 'success');
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
  var p1Name = isCasual ? (opts.p1Name || '') : (m.p1 || '');
  var p2Name = isCasual ? (opts.p2Name || '') : (m.p2 || '');
  var casualTitle = isCasual ? (opts.title || (typeof _t === 'function' ? _t('casual.title') : 'Partida Casual')) : '';
  var _esc = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };

  // Remove existing overlay
  var existing = document.getElementById('live-scoring-overlay');
  if (existing) existing.remove();

  // ── Parse player names (doubles: "Ana/Bruno" → ["Ana","Bruno"]) ──
  var p1Players = p1Name.indexOf('/') > 0 ? p1Name.split('/').map(function(s){return s.trim();}).filter(Boolean) : (p1Name.trim() ? [p1Name.trim()] : []);
  var p2Players = p2Name.indexOf('/') > 0 ? p2Name.split('/').map(function(s){return s.trim();}).filter(Boolean) : (p2Name.trim() ? [p2Name.trim()] : []);
  var isDoubles = p1Players.length > 1 || p2Players.length > 1 || !!(opts && opts.isDoubles);
  // Default names when empty
  if (isDoubles) {
    if (p1Players.length === 0) p1Players = ['Jogador 1', 'Parceiro'];
    if (p1Players.length === 1) p1Players.push('Parceiro');
    if (p2Players.length === 0) p2Players = ['Adversário 1', 'Adversário 2'];
    if (p2Players.length === 1) p2Players.push('Adversário 2');
  } else {
    if (p1Players.length === 0) p1Players = ['Jogador 1'];
    if (p2Players.length === 0) p2Players = ['Adversário 1'];
  }

  // Player metadata map (name → { uid, photoURL }) for avatar display
  var _playerMeta = {};
  if (opts && Array.isArray(opts.players)) {
    for (var pmi = 0; pmi < opts.players.length; pmi++) {
      var pm = opts.players[pmi];
      if (pm.name) _playerMeta[pm.name] = { uid: pm.uid || null, photoURL: pm.photoURL || null };
    }
  }
  // Also add current user's info for self-matching
  (function() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (cu && cu.photoURL) {
      // Match by first name or displayName in any player name
      var allP = p1Players.concat(p2Players);
      for (var api = 0; api < allP.length; api++) {
        var pn = allP[api];
        if (cu.displayName && (pn === cu.displayName.split(' ')[0] || pn === cu.displayName)) {
          if (!_playerMeta[pn]) _playerMeta[pn] = {};
          if (!_playerMeta[pn].photoURL) _playerMeta[pn].photoURL = cu.photoURL;
          if (!_playerMeta[pn].uid) _playerMeta[pn].uid = cu.uid;
        }
      }
    }
  })();

  // Helper: build small avatar HTML for a player name (from metadata)
  function _liveAvatarHtml(name, size) {
    var sz = size || 28;
    var meta = _playerMeta[name];
    if (meta && meta.photoURL) {
      return '<img src="' + window._safeHtml(meta.photoURL) + '" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,0.15);" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
        '<div style="display:none;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);align-items:center;justify-content:center;font-size:' + (sz * 0.45) + 'px;color:white;font-weight:700;flex-shrink:0;">' + window._safeHtml((name || 'J')[0].toUpperCase()) + '</div>';
    }
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:' + (sz * 0.45) + 'px;color:white;font-weight:700;flex-shrink:0;">' + window._safeHtml((name || 'J')[0].toUpperCase()) + '</div>';
  }

  // Sport emoji for serve picker
  var _sportBall = '🎾'; // default
  (function() {
    var sn = isCasual ? (opts.sportName || '') : (t && t.sport ? t.sport : '');
    var lower = sn.toLowerCase();
    if (lower.indexOf('pickleball') !== -1) _sportBall = '🥒';
    else if (lower.indexOf('mesa') !== -1 || lower.indexOf('ping') !== -1) _sportBall = '🏓';
    else if (lower.indexOf('padel') !== -1 || lower.indexOf('badminton') !== -1) _sportBall = '🏸';
    else if (lower.indexOf('beach') !== -1 || lower.indexOf('tênis') !== -1 || lower.indexOf('tenis') !== -1) _sportBall = '🎾';
    else if (lower.indexOf('simples') !== -1 || lower.indexOf('simple') !== -1) _sportBall = '🏅';
  })();

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
    fixedSetGames: useSets && sc.fixedSet ? (sc.fixedSetGames || sc.gamesPerSet || 6) : 0,
    tieRule: sc.tieRule || null, // 'extend'|'tiebreak'|'ask'|null (null = standard 2-game lead)
    tieRulePending: false, // true when waiting for user choice at tie
    // Serve tracking — progressive: defined at each player's first serve
    serveOrder: [],      // [{team:1|2, name:'Ana'}, ...] rotation cycle (2 for singles, 4 for doubles)
    serveSkipped: false, // user chose to skip serve tracking
    servePending: false, // true when waiting for user to pick a server
    totalGamesPlayed: 0, // total games completed (for serve rotation)
    gameLog: [],         // [{winner:1|2, serverName, serverTeam}] per completed normal game
    pointLog: []         // [{team:1|2, endSet:bool}] every point scored, set boundaries marked
  };
  var serveSlots = isDoubles ? 4 : 2; // total rotation length
  var _courtLeft = 1; // Which team is on the left side of the court (1 or 2)
  var _matchStartTime = null; // Timestamp when first point is scored
  var _matchEndTime = null;   // Timestamp when match finishes

  // Initialize first set
  state.sets.push({ gamesP1: 0, gamesP2: 0, tiebreak: null });

  // If joining an active match, try to load initial liveState from Firestore immediately
  var _initDocId = isCasual && opts ? opts.casualDocId : null;
  if (_initDocId && window.FirestoreDB && window.FirestoreDB.db) {
    (function() {
      try {
        window.FirestoreDB.db.collection('casualMatches').doc(_initDocId).get().then(function(doc) {
          if (doc.exists && doc.data().liveState && doc.data().liveState._ts) {
            var remote = doc.data().liveState;
            // Apply remote state
            state.sets = remote.sets || state.sets;
            state.currentGameP1 = remote.currentGameP1 != null ? remote.currentGameP1 : 0;
            state.currentGameP2 = remote.currentGameP2 != null ? remote.currentGameP2 : 0;
            state.isTiebreak = !!remote.isTiebreak;
            state.isFinished = !!remote.isFinished;
            state.winner = remote.winner != null ? remote.winner : null;
            state.tieRulePending = !!remote.tieRulePending;
            state.totalGamesPlayed = remote.totalGamesPlayed || 0;
            state.tieRule = remote.tieRule || state.tieRule;
            if (Array.isArray(remote.serveOrder) && remote.serveOrder.length > 0) state.serveOrder = remote.serveOrder;
            state.serveSkipped = !!remote.serveSkipped;
            if (Array.isArray(remote.gameLog)) state.gameLog = remote.gameLog.slice();
            if (Array.isArray(remote.pointLog)) state.pointLog = remote.pointLog.slice();
            if (remote.courtLeft) _courtLeft = remote.courtLeft;
            if (remote.matchStartTime) _matchStartTime = remote.matchStartTime;
            if (remote.matchEndTime) _matchEndTime = remote.matchEndTime;
            if (Array.isArray(remote.p1Players)) {
              for (var i = 0; i < remote.p1Players.length && i < p1Players.length; i++) p1Players[i] = remote.p1Players[i];
            }
            if (Array.isArray(remote.p2Players)) {
              for (var j = 0; j < remote.p2Players.length && j < p2Players.length; j++) p2Players[j] = remote.p2Players[j];
            }
            _render();
          }
        });
      } catch(e) {}
    })();
  }

  // Check if this is the deciding set (super tiebreak)
  function _isDecidingSet() {
    var totalSets = state.setsToWin * 2 - 1;
    return state.superTiebreak && state.sets.length === totalSets;
  }

  // Get current set
  function _currentSet() {
    return state.sets[state.sets.length - 1];
  }

  // Count sets won (includeAll=true counts the current/last set too — used when set just finished)
  function _setsWon(player, includeAll) {
    var count = 0;
    var limit = includeAll ? state.sets.length : state.sets.length - 1;
    for (var i = 0; i < limit; i++) {
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

    // Numeric counting: each point IS a game — always return winner after 1 point
    if (p1 > p2) return 1;
    if (p2 > p1) return 2;
    return 0;
  }

  // Check if set is won
  function _checkSetWon() {
    var cs = _currentSet();
    var g = state.gamesPerSet;

    if (state.isFixedSet) return 0; // Handled in _checkGameWon
    if (_isDecidingSet()) return 0; // handled by tiebreak game

    // tieRule logic: at (g-1)-(g-1) and every subsequent tie, ask or apply rule
    // e.g. at 5-5 in a 6-game set, 2-game lead is impossible with 1 more game
    if (state.tieRule && cs.gamesP1 === cs.gamesP2 && cs.gamesP1 >= g - 1) {
      var rule = state.tieRule;
      if (rule === 'ask' && !state.tieRulePending) {
        // Pause and ask the user
        state.tieRulePending = true;
        _showTieRuleDialog();
        return -2; // Signal: paused, waiting for user choice
      }
      if (rule === 'extend') {
        // Prorrogar: play on with 2-game lead required
        // Don't enter tiebreak, just continue — standard 2-game lead check below
      }
      if (rule === 'tiebreak') {
        state.isTiebreak = true;
        state.currentGameP1 = 0;
        state.currentGameP2 = 0;
        return -1;
      }
      if (rule === 'supertiebreak') {
        state.isTiebreak = true;
        state.tiebreakPoints = state.superTiebreakPoints || 10;
        state.currentGameP1 = 0;
        state.currentGameP2 = 0;
        return -1;
      }
    }

    // tieRule 'extend': standard 2-game lead — whoever reaches 2 games ahead wins
    if (state.tieRule === 'extend') {
      if (cs.gamesP1 >= g && cs.gamesP1 - cs.gamesP2 >= 2) return 1;
      if (cs.gamesP2 >= g && cs.gamesP2 - cs.gamesP1 >= 2) return 2;
      return 0;
    }

    // Standard rules: first to 'g' games with 2-game lead, or tiebreak at g-g
    if (cs.gamesP1 >= g && cs.gamesP1 - cs.gamesP2 >= 2) return 1;
    if (cs.gamesP2 >= g && cs.gamesP2 - cs.gamesP1 >= 2) return 2;

    // Standard tiebreak trigger at g-g (when tieRule is not set)
    if (state.tiebreakEnabled && cs.gamesP1 === g && cs.gamesP2 === g) {
      state.isTiebreak = true;
      state.currentGameP1 = 0;
      state.currentGameP2 = 0;
      return -1;
    }

    return 0;
  }

  // Dialog shown when tieRule is 'ask' and games are tied
  function _showTieRuleDialog(viewerCanDecide) {
    var cs = _currentSet();
    var tiedAt = cs.gamesP1; // Both are equal
    var contentEl = document.getElementById('live-score-content');
    if (!contentEl) return;
    var bodyHtml;
    if (viewerCanDecide === false) {
      // Non-player viewers wait for one of the registered players in the match to decide
      bodyHtml =
        '<div style="display:flex;flex-direction:column;gap:10px;align-items:center;padding:4px 6px;">' +
          '<div style="font-size:1.8rem;">⏳</div>' +
          '<div style="font-size:0.9rem;font-weight:700;color:var(--text-bright);text-align:center;">Aguardando decisão dos jogadores</div>' +
          '<div style="font-size:0.72rem;color:var(--text-muted);text-align:center;line-height:1.4;">Somente jogadores cadastrados envolvidos na partida podem escolher entre prorrogar ou tie-break.</div>' +
        '</div>';
    } else {
      bodyHtml =
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<button onclick="window._liveResolveTie(\'extend\')" style="padding:14px;border-radius:12px;border:2px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.08);cursor:pointer;text-align:left;">' +
            '<div style="font-size:0.88rem;font-weight:700;color:#10b981;">Prorrogar</div>' +
            '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Continuar até vantagem de 2 games</div>' +
          '</button>' +
          '<button onclick="window._liveResolveTie(\'tiebreak\')" style="padding:14px;border-radius:12px;border:2px solid rgba(192,132,252,0.3);background:rgba(192,132,252,0.08);cursor:pointer;text-align:left;">' +
            '<div style="font-size:0.88rem;font-weight:700;color:#c084fc;">Tie-break (7 pts)</div>' +
            '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Tie-break a 7 pontos com margem de 2</div>' +
          '</button>' +
        '</div>';
    }
    contentEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:1rem;">' +
        '<div style="background:var(--bg-card,#1e293b);border-radius:16px;border:1px solid rgba(192,132,252,0.3);padding:1.5rem;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
          '<div style="text-align:center;margin-bottom:1rem;">' +
            '<div style="font-size:1.5rem;margin-bottom:4px;">⚖️</div>' +
            '<div style="font-size:1rem;font-weight:800;color:var(--text-bright);">Empate ' + tiedAt + ' × ' + tiedAt + '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Como desempatar?</div>' +
          '</div>' +
          bodyHtml +
        '</div>' +
      '</div>';
  }

  // Handler for tie rule dialog choice — restricted to registered players in the match
  window._liveResolveTie = function(rule) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (cu && cu.uid) {
      var names = p1Players.concat(p2Players);
      var ok = false;
      for (var i = 0; i < names.length; i++) {
        var mm = _playerMeta[names[i]];
        if (mm && mm.uid === cu.uid) { ok = true; break; }
      }
      if (!ok) { _render(); return; }
    } else {
      // Not logged in — can't make the decision
      _render();
      return;
    }
    state.tieRulePending = false;

    if (rule === 'extend') {
      // Prorrogar: play on with 2-game lead required
      // Keep tieRule as 'extend' so standard 2-game lead check applies
      state.tieRule = 'extend';
    } else if (rule === 'tiebreak') {
      state.tieRule = 'tiebreak';
      state.isTiebreak = true;
      state.currentGameP1 = 0;
      state.currentGameP2 = 0;
    }
    _render();
  };

  // Check if match is won (called from _finishSet, so include the just-finished set)
  function _checkMatchWon() {
    if (_setsWon(1, true) >= state.setsToWin) return 1;
    if (_setsWon(2, true) >= state.setsToWin) return 2;
    return 0;
  }

  // Add point to player
  function _addPoint(player) {
    if (state.isFinished) return;
    if (state.tieRulePending) return; // Waiting for tie resolution dialog
    if (_needsServePick()) return; // Waiting for serve selection

    // Track match start time on first point
    if (!_matchStartTime) _matchStartTime = Date.now();

    // Capture context BEFORE incrementing so pointLog reflects the state at which this point was contested
    var _p1Before = state.currentGameP1;
    var _p2Before = state.currentGameP2;
    var _wasTiebreak = !!state.isTiebreak;
    var _srvNow = (typeof _getCurrentServer === 'function') ? _getCurrentServer() : null;

    if (player === 1) state.currentGameP1++;
    else state.currentGameP2++;

    // Log every point scored with rich context for analytics, including the
    // timestamp so we can compute time-per-point analytics (avg/longest/fastest
    // interval, longest rally gap, etc.).
    state.pointLog.push({
      team: player,
      server: _srvNow ? _srvNow.name : null,
      serverTeam: _srvNow ? _srvNow.team : null,
      p1Before: _p1Before,
      p2Before: _p2Before,
      isTiebreak: _wasTiebreak,
      t: Date.now()
    });

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
        // Normal game won — log server and winner for stats
        var _srvIdx = state.serveOrder.length > 0 ? (state.totalGamesPlayed % state.serveOrder.length) : -1;
        var _srvEntry = _srvIdx >= 0 ? state.serveOrder[_srvIdx] : null;
        state.gameLog.push({
          winner: gameWinner,
          serverName: _srvEntry ? _srvEntry.name : null,
          serverTeam: _srvEntry ? _srvEntry.team : null
        });
        if (gameWinner === 1) cs.gamesP1++;
        else cs.gamesP2++;
        state.currentGameP1 = 0;
        state.currentGameP2 = 0;
        state.totalGamesPlayed++;

        // Check if set is won
        var setResult = _checkSetWon();
        if (setResult > 0) {
          _finishSet(setResult);
        }
        // setResult === -1 means we entered tiebreak, already handled
        // setResult === -2 means waiting for tie rule dialog (ask mode)
      }
    }

    _render();
  }

  function _finishSet(setWinner) {
    // Mark the last point as set-ending (for momentum graph set boundaries)
    if (state.pointLog.length > 0) state.pointLog[state.pointLog.length - 1].endSet = true;
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
      _matchEndTime = Date.now();
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
    showNotification(_t('bui.undo'), _t('bui.undoMsg'), 'info');
  }

  // Build a self-contained record of this finished match and persist it to each
  // registered player's matchHistory subcollection so the stats survive deletion
  // of the tournament / casual match. Used by both casual and tournament paths.
  function _buildAndPersistMatchRecord(extraContext) {
    if (typeof window.FirestoreDB === 'undefined' || !window.FirestoreDB.saveUserMatchRecords) return;
    var pts = state.pointLog || [];
    var gmL = state.gameLog || [];
    var team = { 1: { points:0, games:0, sets:0, holdServed:0, held:0, longestStreak:0, biggestLead:0,
                      servePtsPlayed:0, servePtsWon:0, receivePtsPlayed:0, receivePtsWon:0,
                      deucePtsPlayed:0, deucePtsWon:0, breaks:0 },
                 2: { points:0, games:0, sets:0, holdServed:0, held:0, longestStreak:0, biggestLead:0,
                      servePtsPlayed:0, servePtsWon:0, receivePtsPlayed:0, receivePtsWon:0,
                      deucePtsPlayed:0, deucePtsWon:0, breaks:0 } };
    var curStreak = { 1:0, 2:0 }, cum = 0;
    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i];
      team[pt.team].points++;
      if (pt.team === 1) { curStreak[1]++; curStreak[2]=0; cum++; }
      else { curStreak[2]++; curStreak[1]=0; cum--; }
      if (curStreak[pt.team] > team[pt.team].longestStreak) team[pt.team].longestStreak = curStreak[pt.team];
      if (cum > team[1].biggestLead) team[1].biggestLead = cum;
      if (-cum > team[2].biggestLead) team[2].biggestLead = -cum;
      if (pt.serverTeam === 1 || pt.serverTeam === 2) {
        var srvT = pt.serverTeam, recT = srvT === 1 ? 2 : 1;
        team[srvT].servePtsPlayed++; team[recT].receivePtsPlayed++;
        if (pt.team === srvT) team[srvT].servePtsWon++;
        else team[recT].receivePtsWon++;
        if (!pt.isTiebreak && pt.p1Before === 3 && pt.p2Before === 3) {
          team[1].deucePtsPlayed++; team[2].deucePtsPlayed++;
          team[pt.team].deucePtsWon++;
        }
      }
    }
    for (var g = 0; g < gmL.length; g++) {
      var ge = gmL[g];
      team[ge.winner].games++;
      if (ge.serverTeam && ge.winner !== ge.serverTeam) team[ge.winner].breaks++;
    }
    for (var s = 0; s < state.sets.length; s++) {
      var ss = state.sets[s];
      if (ss.gamesP1 > ss.gamesP2) team[1].sets++;
      else if (ss.gamesP2 > ss.gamesP1) team[2].sets++;
    }
    // Per-player stats
    var plrs = {};
    var allNames = p1Players.concat(p2Players);
    for (var pi = 0; pi < allNames.length; pi++) {
      plrs[allNames[pi]] = { name: allNames[pi], team: pi < p1Players.length ? 1 : 2,
        served:0, held:0, longestHoldStreak:0, _streak:0, servePtsPlayed:0, servePtsWon:0 };
    }
    for (var gg = 0; gg < gmL.length; gg++) {
      var en = gmL[gg];
      if (!en.serverName || !plrs[en.serverName]) continue;
      var sp = plrs[en.serverName];
      sp.served++;
      if (en.winner === en.serverTeam) {
        sp.held++; sp._streak++;
        if (sp._streak > sp.longestHoldStreak) sp.longestHoldStreak = sp._streak;
      } else sp._streak = 0;
    }
    for (var pj = 0; pj < pts.length; pj++) {
      var p2pt = pts[pj];
      if (!p2pt.server || !plrs[p2pt.server]) continue;
      plrs[p2pt.server].servePtsPlayed++;
      if (p2pt.team === p2pt.serverTeam) plrs[p2pt.server].servePtsWon++;
    }
    // Strip internal flags before persisting
    Object.keys(plrs).forEach(function(k) { delete plrs[k]._streak; });

    // Player list with uid/photo (for each registered participant)
    var recordPlayers = [];
    for (var k = 0; k < allNames.length; k++) {
      var nm = allNames[k];
      var meta = _playerMeta[nm] || {};
      recordPlayers.push({
        name: nm,
        team: k < p1Players.length ? 1 : 2,
        uid: meta.uid || null,
        photoURL: meta.photoURL || null
      });
    }

    // Build score summary string (e.g. "6-4 3-6 7-6")
    var scoreSummaryStr = '';
    if (useSets && !state.isFixedSet) {
      for (var si2 = 0; si2 < state.sets.length; si2++) {
        var _ss = state.sets[si2];
        scoreSummaryStr += _ss.gamesP1 + '-' + _ss.gamesP2;
        if (_ss.tiebreak) scoreSummaryStr += '(' + Math.min(_ss.tiebreak.p1, _ss.tiebreak.p2) + ')';
        if (si2 < state.sets.length - 1) scoreSummaryStr += ' ';
      }
    } else {
      var sP1 = state.isFixedSet && state.sets[0] ? state.sets[0].gamesP1 : state.currentGameP1;
      var sP2 = state.isFixedSet && state.sets[0] ? state.sets[0].gamesP2 : state.currentGameP2;
      scoreSummaryStr = sP1 + '-' + sP2;
    }

    var startT = _matchStartTime || null;
    var endT = _matchEndTime || Date.now();
    var ctx = extraContext || {};

    // Time-per-point analytics from pointLog timestamps
    var timeStatsRec = null;
    var ptsWithT = (state.pointLog || []).filter(function(p) { return !!p.t; });
    if (ptsWithT.length >= 2) {
      var recIntervals = [];
      var prevTs = startT;
      for (var rti = 0; rti < ptsWithT.length; rti++) {
        if (prevTs) recIntervals.push(ptsWithT[rti].t - prevTs);
        prevTs = ptsWithT[rti].t;
      }
      if (recIntervals.length > 0) {
        var sumI = 0, minI = Infinity, maxI = 0;
        for (var rk = 0; rk < recIntervals.length; rk++) {
          sumI += recIntervals[rk];
          if (recIntervals[rk] < minI) minI = recIntervals[rk];
          if (recIntervals[rk] > maxI) maxI = recIntervals[rk];
        }
        timeStatsRec = {
          avgPointMs: Math.round(sumI / recIntervals.length),
          longestPointMs: maxI,
          shortestPointMs: minI === Infinity ? null : minI,
          pointsWithTime: ptsWithT.length
        };
      }
    }

    var record = {
      matchId: ctx.matchId || ('m_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)),
      matchType: ctx.matchType || (isCasual ? 'casual' : 'tournament'),
      tournamentId: ctx.tournamentId || null,
      tournamentName: ctx.tournamentName || null,
      sport: ctx.sport || (opts && opts.sportName) || '',
      isDoubles: isDoubles,
      finishedAt: new Date(endT).toISOString(),
      startedAt: startT ? new Date(startT).toISOString() : null,
      durationMs: startT ? (endT - startT) : null,
      timeStats: timeStatsRec,
      players: recordPlayers,
      playerUids: recordPlayers.filter(function(p) { return !!p.uid; }).map(function(p) { return p.uid; }),
      winnerTeam: state.winner || 0,
      scoreSummary: scoreSummaryStr,
      sets: state.sets.map(function(_s) {
        var e = { gamesP1: _s.gamesP1, gamesP2: _s.gamesP2 };
        if (_s.tiebreak) e.tiebreak = _s.tiebreak;
        return e;
      }),
      stats: { team1: team[1], team2: team[2] },
      playerStats: plrs
    };
    try {
      var p = window.FirestoreDB.saveUserMatchRecords(record);
      if (p && typeof p.catch === 'function') p.catch(function(){});
    } catch(e) {}
  }

  // Save result to match
  function _saveResult() {
    if (isCasual) {
      // Casual mode: show result, save to Firestore, and close
      var winnerName = state.winner === 1 ? p1Name : (state.winner === 2 ? p2Name : 'Empate');
      var ov = document.getElementById('live-scoring-overlay');
      if (ov) ov.remove();
      // Build summary for casual
      var summary = '';
      var setsData = null;
      if (useSets) {
        setsData = [];
        for (var si = 0; si < state.sets.length; si++) {
          var ss = state.sets[si];
          summary += ss.gamesP1 + '-' + ss.gamesP2;
          if (ss.tiebreak) summary += '(' + ss.tiebreak.p1 + '-' + ss.tiebreak.p2 + ')';
          if (si < state.sets.length - 1) summary += '  ';
          var setEntry = { gamesP1: ss.gamesP1, gamesP2: ss.gamesP2 };
          if (ss.tiebreak) setEntry.tiebreak = { pointsP1: ss.tiebreak.p1, pointsP2: ss.tiebreak.p2 };
          setsData.push(setEntry);
        }
      } else {
        summary = state.currentGameP1 + ' × ' + state.currentGameP2;
      }
      showNotification(_t('bui.matchClosed'), (state.winner === 0 ? winnerName : _t('bui.matchWon', {winner: winnerName})) + ' — ' + summary, 'success');
      // Save to casual match history in localStorage
      try {
        var hist = JSON.parse(localStorage.getItem('scoreplace_casual_history') || '[]');
        hist.unshift({ p1: p1Name, p2: p2Name, winner: winnerName, summary: summary, date: new Date().toISOString(), sport: opts.sportName || '' });
        if (hist.length > 50) hist = hist.slice(0, 50);
        localStorage.setItem('scoreplace_casual_history', JSON.stringify(hist));
      } catch(e) {}
      // Save to Firestore if we have a doc ID
      var _casualDocId = opts && opts.casualDocId;
      if (_casualDocId && typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.db) {
        var resultData = {
          winner: state.winner, // 1, 2, or 0
          summary: summary,
          p1Score: useSets ? null : state.currentGameP1,
          p2Score: useSets ? null : state.currentGameP2
        };
        if (setsData) resultData.sets = setsData;
        // Collect all uids from players for indexed query
        var casualPlayers = (opts.players || []).slice();
        var playerUids = casualPlayers.filter(function(p) { return !!p.uid; }).map(function(p) { return p.uid; });
        window.FirestoreDB.updateCasualMatch(_casualDocId, {
          status: 'finished',
          finishedAt: new Date().toISOString(),
          result: resultData,
          playerUids: playerUids
        });
      }
      // Persist detailed stats in each registered player's account so they
      // survive even after the casual match doc is deleted/expired.
      _buildAndPersistMatchRecord({
        matchId: _casualDocId ? ('casual_' + _casualDocId) : null,
        matchType: 'casual',
        sport: opts && opts.sportName
      });
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

    // Persist detailed tournament match stats in each registered participant's
    // account so their per-user history outlives the tournament.
    _buildAndPersistMatchRecord({
      matchId: 'tourn_' + (t && t.id ? t.id : 'x') + '_' + (m && m.id ? m.id : 'x'),
      matchType: 'tournament',
      tournamentId: t && t.id ? t.id : null,
      tournamentName: t && t.name ? t.name : null,
      sport: t && t.sport ? t.sport : ''
    });

    // Close overlay
    var ov = document.getElementById('live-scoring-overlay');
    if (ov) ov.remove();

    showNotification(_t('bui.resultSaved'), m.winner === 'draw' ? _t('bui.draw') : _t('bui.matchWon', {winner: m.winner}), 'success');
    _rerenderBracket(tId, matchId);

    // Auto-advance etc.
    if (typeof window._advanceWinner === 'function') window._advanceWinner(t, m);
    if (typeof window._maybeFinishElimination === 'function') window._maybeFinishElimination(t);
  }

  // ── Serve tracking — progressive definition ──
  // The serve order is built game by game as each player serves for the first time.
  // Singles: 2 slots (game 1: pick, game 2: auto). Doubles: 4 slots (game 1: pick anyone,
  // game 2: other team pick player, game 3+4: auto remaining players).

  // Get which players are already in the serve order from a specific team
  function _serveOrderPlayersForTeam(team) {
    var names = [];
    for (var i = 0; i < state.serveOrder.length; i++) {
      if (state.serveOrder[i].team === team) names.push(state.serveOrder[i].name);
    }
    return names;
  }

  // Determine which team should serve at a given slot index (alternates)
  function _teamForSlot(slotIdx) {
    if (state.serveOrder.length === 0) return 0; // Not yet determined
    var firstTeam = state.serveOrder[0].team;
    return (slotIdx % 2 === 0) ? firstTeam : (firstTeam === 1 ? 2 : 1);
  }

  // Get eligible players for the next serve slot
  function _getEligibleServers() {
    var slot = state.serveOrder.length;
    if (slot === 0) {
      // First serve — any player from any team
      var all = [];
      for (var i = 0; i < p1Players.length; i++) all.push({ team: 1, name: p1Players[i] });
      for (var j = 0; j < p2Players.length; j++) all.push({ team: 2, name: p2Players[j] });
      return all;
    }
    // Subsequent slots: must be from the alternating team, and not yet in serveOrder
    var team = _teamForSlot(slot);
    var used = _serveOrderPlayersForTeam(team);
    var teamPlayers = team === 1 ? p1Players : p2Players;
    var eligible = [];
    for (var k = 0; k < teamPlayers.length; k++) {
      if (used.indexOf(teamPlayers[k]) === -1) eligible.push({ team: team, name: teamPlayers[k] });
    }
    return eligible;
  }

  // Serve picker overlay no longer used — serve is set inline via draggable ball
  function _needsServePick() {
    return false;
  }

  // Auto-fill serve slot if only 1 eligible player
  function _tryAutoFillServe() {
    if (state.serveSkipped) return;
    while (state.serveOrder.length < serveSlots) {
      var eligible = _getEligibleServers();
      if (eligible.length === 1) {
        state.serveOrder.push(eligible[0]);
      } else {
        break;
      }
    }
  }

  // Get current server based on completed serveOrder + totalGamesPlayed
  function _getCurrentServer() {
    if (state.serveSkipped || state.serveOrder.length === 0) return null;
    var idx;
    if (state.isTiebreak || _isDecidingSet()) {
      // In tiebreak: advance serve position every 2 points (first server serves 1, then 2 each)
      var totalPts = state.currentGameP1 + state.currentGameP2;
      var tbOffset = (totalPts === 0) ? 0 : Math.floor((totalPts + 1) / 2);
      idx = (state.totalGamesPlayed + tbOffset) % state.serveOrder.length;
    } else {
      idx = state.totalGamesPlayed % state.serveOrder.length;
    }
    return state.serveOrder[idx] || null;
  }

  // Proposed serve order — alternating teams: T1[0], T2[0], T1[1], T2[1]
  // Team slots are FIXED (even = firstTeam, odd = secondTeam).
  // Only which player within a team occupies the slot can be swapped.
  var _proposedOrder = [];
  var _firstServeTeam = 1; // Which team serves first (can be toggled)
  (function() {
    var maxLen = Math.max(p1Players.length, p2Players.length);
    for (var i = 0; i < maxLen; i++) {
      if (i < p1Players.length) _proposedOrder.push({ team: 1, name: p1Players[i], pIdx: i });
      if (i < p2Players.length) _proposedOrder.push({ team: 2, name: p2Players[i], pIdx: i });
    }
  })();

  // Rebuild proposed order: ensure strict T-T alternation from _firstServeTeam
  function _rebuildProposedOrder() {
    var tA = _firstServeTeam;
    var tB = tA === 1 ? 2 : 1;
    var playersA = _proposedOrder.filter(function(p) { return p.team === tA; });
    var playersB = _proposedOrder.filter(function(p) { return p.team === tB; });
    var newOrder = [];
    var maxLen = Math.max(playersA.length, playersB.length);
    for (var i = 0; i < maxLen; i++) {
      if (i < playersA.length) newOrder.push(playersA[i]);
      if (i < playersB.length) newOrder.push(playersB[i]);
    }
    _proposedOrder = newOrder;
  }

  // Apply a serve drag: player at fromIdx dragged to toIdx.
  // The dragged player lands at toIdx. Their team fills same-parity slots (0,2 or 1,3).
  // The other team fills opposite-parity slots. Alternation always enforced.
  function _applyServeDrag(fromIdx, toIdx) {
    if (_proposedOrder.length < 4) return;
    var dragged = _proposedOrder[fromIdx];
    var dragTeam = dragged.team;
    // Find teammate and opponents (preserving current order)
    var teammate = null;
    var opponents = [];
    for (var i = 0; i < _proposedOrder.length; i++) {
      if (i === fromIdx) continue;
      if (_proposedOrder[i].team === dragTeam) teammate = _proposedOrder[i];
      else opponents.push(_proposedOrder[i]);
    }
    if (!teammate || opponents.length < 2) return;
    // Target parity determines which slots this team occupies
    var parity = toIdx % 2; // 0 → even slots (0,2), 1 → odd slots (1,3)
    var teamSlots = parity === 0 ? [0, 2] : [1, 3];
    var otherSlots = parity === 0 ? [1, 3] : [0, 2];
    var newOrder = [null, null, null, null];
    // Dragged player at target, teammate at the other same-parity slot
    newOrder[toIdx] = dragged;
    newOrder[teamSlots[0] === toIdx ? teamSlots[1] : teamSlots[0]] = teammate;
    // Opponents fill opposite-parity slots (preserve their relative order)
    newOrder[otherSlots[0]] = opponents[0];
    newOrder[otherSlots[1]] = opponents[1];
    _proposedOrder = newOrder;
    _firstServeTeam = _proposedOrder[0].team;
    _showServePickerOverlay();
  }

  // ── Serve order picker ──
  // Simple vertical list of 4 cards in serve order. Drag to swap.
  // Rule: alternation T1-T2-T1-T2 always enforced after any drag.
  var _serveDragIdx = null;
  var _serveDragGhost = null;

  function _showServePickerOverlay() {
    var container = document.getElementById('live-score-content');
    if (!container) return;

    // Enforce alternation
    _rebuildProposedOrder();

    // Build 4 cards in serve order
    var cardsHtml = '';
    for (var i = 0; i < _proposedOrder.length; i++) {
      var p = _proposedOrder[i];
      var clr = p.team === 1 ? '#3b82f6' : '#ef4444';
      var bgClr = p.team === 1 ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)';
      var bdrClr = p.team === 1 ? 'rgba(59,130,246,0.30)' : 'rgba(239,68,68,0.30)';
      cardsHtml +=
        '<div class="serve-card" draggable="true" data-serve-idx="' + i + '" style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:12px;border:1px solid ' + bdrClr + ';background:' + bgClr + ';cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;transition:transform 0.15s,box-shadow 0.15s;">' +
          '<div style="color:var(--text-muted);font-size:0.85rem;flex-shrink:0;opacity:0.4;">☰</div>' +
          '<div style="width:24px;height:24px;border-radius:50%;background:' + clr + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;flex-shrink:0;">' + (i + 1) + '</div>' +
          _liveAvatarHtml(p.name, 32) +
          '<div style="flex:1;min-width:0;font-size:0.95rem;font-weight:700;color:' + clr + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(p.name) + '</div>' +
        '</div>';
    }

    container.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:1.5rem;gap:1.2rem;">' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--text-bright);">Ordem de Saque</div>' +
        '<div id="serve-order-list" style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:360px;">' + cardsHtml + '</div>' +
        '<div style="display:flex;gap:12px;">' +
          '<button onclick="window._liveConfirmServeOrder()" style="padding:14px 32px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:0.95rem;font-weight:700;box-shadow:0 2px 12px rgba(16,185,129,0.3);">Iniciar Partida</button>' +
          '<button onclick="window._liveSkipServe()" style="padding:14px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;background:rgba(255,255,255,0.05);color:var(--text-muted);font-size:0.85rem;font-weight:600;">Pular</button>' +
        '</div>' +
      '</div>';

    setTimeout(function() { _setupServeDragDrop(); }, 30);
  }

  function _setupServeDragDrop() {
    var cards = document.querySelectorAll('[data-serve-idx]');
    if (!cards.length) return;

    // Desktop drag
    cards.forEach(function(card) {
      card.addEventListener('dragstart', function(e) {
        _serveDragIdx = parseInt(card.getAttribute('data-serve-idx'));
        card.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function() {
        card.style.opacity = '1';
        _serveDragIdx = null;
        document.querySelectorAll('[data-serve-idx]').forEach(function(c) { c.style.transform = ''; });
      });
      card.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (_serveDragIdx === null) return;
        var tgt = parseInt(card.getAttribute('data-serve-idx'));
        if (tgt !== _serveDragIdx) card.style.transform = 'scale(1.04)';
      });
      card.addEventListener('dragleave', function() { card.style.transform = ''; });
      card.addEventListener('drop', function(e) {
        e.preventDefault();
        card.style.transform = '';
        if (_serveDragIdx === null) return;
        var tgt = parseInt(card.getAttribute('data-serve-idx'));
        if (tgt !== _serveDragIdx) {
          var src = _serveDragIdx;
          _serveDragIdx = null;
          _applyServeDrag(src, tgt);
        }
      });
    });

    // Touch drag (mobile)
    var _touchIdx = null;
    cards.forEach(function(card) {
      card.addEventListener('touchstart', function(e) {
        _touchIdx = parseInt(card.getAttribute('data-serve-idx'));
        card.style.opacity = '0.6';
      }, { passive: true });
      card.addEventListener('touchmove', function(e) {
        if (_touchIdx === null) return;
        e.preventDefault();
        if (!_serveDragGhost) {
          _serveDragGhost = card.cloneNode(true);
          _serveDragGhost.style.cssText = 'position:fixed;z-index:200000;opacity:0.85;pointer-events:none;width:' + card.offsetWidth + 'px;box-shadow:0 8px 30px rgba(0,0,0,0.5);border-radius:12px;';
          document.body.appendChild(_serveDragGhost);
        }
        var t = e.touches[0];
        _serveDragGhost.style.left = (t.clientX - 40) + 'px';
        _serveDragGhost.style.top = (t.clientY - 20) + 'px';
        document.querySelectorAll('[data-serve-idx]').forEach(function(c) { c.style.transform = ''; });
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var targ = el;
        while (targ) {
          if (targ.dataset && targ.dataset.serveIdx !== undefined) {
            var ti = parseInt(targ.dataset.serveIdx);
            if (ti !== _touchIdx) targ.style.transform = 'scale(1.04)';
            break;
          }
          targ = targ.parentElement;
        }
      }, { passive: false });
      card.addEventListener('touchend', function(e) {
        card.style.opacity = '1';
        if (_serveDragGhost) { _serveDragGhost.remove(); _serveDragGhost = null; }
        document.querySelectorAll('[data-serve-idx]').forEach(function(c) { c.style.transform = ''; });
        if (_touchIdx === null) return;
        var t = e.changedTouches[0];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var targ = el;
        while (targ) {
          if (targ.dataset && targ.dataset.serveIdx !== undefined) {
            var ti = parseInt(targ.dataset.serveIdx);
            if (ti !== _touchIdx) {
              var src = _touchIdx;
              _touchIdx = null;
              _applyServeDrag(src, ti);
              return;
            }
            break;
          }
          targ = targ.parentElement;
        }
        _touchIdx = null;
      });
    });
  }

  // Swap server within a team during the match (mid-game correction)
  window._liveSwapServerInTeam = function(team) {
    if (!state.serveOrder || state.serveOrder.length === 0) return;
    // HARD LOCK after 2 games
    if (state.totalGamesPlayed >= 2) return;
    // After game 1, only the 2nd-serving team may swap (team that started is locked)
    if (state.totalGamesPlayed === 1 && state.serveOrder.length > 1 && state.serveOrder[1].team !== team) return;
    var teamIdxs = [];
    for (var i = 0; i < state.serveOrder.length; i++) {
      if (state.serveOrder[i].team === team) teamIdxs.push(i);
    }
    if (teamIdxs.length < 2) return;
    // Swap the two entries for this team
    var tmp = state.serveOrder[teamIdxs[0]];
    state.serveOrder[teamIdxs[0]] = state.serveOrder[teamIdxs[1]];
    state.serveOrder[teamIdxs[1]] = tmp;
    _render();
  };

  // Edit name on a serve card
  window._liveEditServeCard = function(idx) {
    var p = _proposedOrder[idx];
    if (!p) return;
    showInputDialog(
      'Editar nome',
      'Nome do jogador:',
      p.name,
      function(newName) {
        newName = (newName || '').trim();
        if (!newName) return;
        // Transfer avatar metadata to new name
        var oldName = p.name;
        if (_playerMeta[oldName]) {
          _playerMeta[newName] = _playerMeta[oldName];
          if (oldName !== newName) delete _playerMeta[oldName];
        }
        // Update in proposed order
        p.name = newName;
        // Also update in the player arrays
        var players = p.team === 1 ? p1Players : p2Players;
        if (p.pIdx !== undefined && p.pIdx < players.length) players[p.pIdx] = newName;
        _showServePickerOverlay();
      }
    );
  };

  // Confirm the proposed order
  window._liveConfirmServeOrder = function() {
    state.serveOrder = _proposedOrder.map(function(p) { return { team: p.team, name: p.name }; });
    state.serveSkipped = false;
    state.servePending = false;
    _render();
  };

  // Skip serve tracking
  window._liveSkipServe = function() {
    state.serveSkipped = true;
    state.servePending = false;
    _render();
  };

  // Auto-confirm serve order from proposed order (no separate picker screen)
  if (state.serveOrder.length === 0 && !state.serveSkipped && _proposedOrder.length >= serveSlots) {
    state.serveOrder = _proposedOrder.map(function(p) { return { team: p.team, name: p.name }; });
  }

  // Set 1st server by dragging ball to a player name (inline, on the live scoring screen)
  // Before game 1: any player can be set as 1st server → auto-sets 3rd (teammate)
  // Before game 2: only the other team's players → sets 2nd server → auto-sets 4th
  // After game 2: locked
  window._liveSetServer = function(team, playerIdx) {
    // HARD LOCK: after 2 games, nobody's serve order can change — ever.
    if (state.totalGamesPlayed >= 2) { _render(); return; }
    var players = team === 1 ? p1Players : p2Players;
    var name = players[playerIdx];
    if (!name) return;

    if (state.totalGamesPlayed === 0) {
      // Setting 1st server: this player + teammate fills slots 0,2. Other team fills 1,3.
      var teammate = null;
      var teamAll = team === 1 ? p1Players : p2Players;
      for (var i = 0; i < teamAll.length; i++) {
        if (teamAll[i] !== name) { teammate = teamAll[i]; break; }
      }
      var otherTeam = team === 1 ? 2 : 1;
      var opponents = otherTeam === 1 ? p1Players.slice() : p2Players.slice();
      state.serveOrder = [
        { team: team, name: name },
        { team: otherTeam, name: opponents[0] || 'Oponente 1' },
        { team: team, name: teammate || 'Parceiro' },
        { team: otherTeam, name: opponents[1] || 'Oponente 2' }
      ];
    } else if (state.totalGamesPlayed === 1) {
      // Setting 2nd server: MUST be from the team that serves 2nd (serveOrder[1].team).
      // The team that started serving (serveOrder[0].team) is already locked.
      if (state.serveOrder.length < 4) { _render(); return; }
      if (state.serveOrder[1].team !== team) { _render(); return; }
      // This player should serve 2nd, their teammate serves 4th
      var otherPlayer = null;
      var teamP = team === 1 ? p1Players : p2Players;
      for (var j = 0; j < teamP.length; j++) {
        if (teamP[j] !== name) { otherPlayer = teamP[j]; break; }
      }
      state.serveOrder[1] = { team: team, name: name };
      state.serveOrder[3] = { team: team, name: otherPlayer || state.serveOrder[3].name };
    }
    _render();
  };

  // ── Render function ──
  function _render() {
    var container = document.getElementById('live-score-content');
    if (!container) return;

    // Determine whether the current viewer is a registered player in this match.
    // Used to gate match-control actions (tie-rule choice, tie-break button, restart) —
    // they must only be operable by registered users actually playing.
    var _curUser = window.AppStore && window.AppStore.currentUser;
    var _isViewerInMatch = false;
    if (_curUser && _curUser.uid) {
      var _mn = p1Players.concat(p2Players);
      for (var _mni = 0; _mni < _mn.length; _mni++) {
        var _mm = _playerMeta[_mn[_mni]];
        if (_mm && _mm.uid === _curUser.uid) { _isViewerInMatch = true; break; }
      }
    }

    // Check if we need a serve pick before continuing
    if (_needsServePick()) {
      _showServePickerOverlay();
      return;
    }

    // Show tie rule dialog if pending (must render AFTER the full UI, not via insertAdjacentHTML)
    if (state.tieRulePending) {
      _showTieRuleDialog(_isViewerInMatch);
      return;
    }

    // ── FINISHED STATE: render result summary instead of plates ──
    if (state.isFinished) {
      var winTeam = state.winner; // 1 or 2
      var winPlayers = winTeam === 1 ? p1Players : p2Players;
      var losePlayers = winTeam === 1 ? p2Players : p1Players;
      var winClr = winTeam === 1 ? '#3b82f6' : '#ef4444';
      var loseClr = winTeam === 1 ? '#ef4444' : '#3b82f6';

      // Build score summary
      var scoreSummary = '';
      if (useSets && !state.isFixedSet) {
        // Sets summary: "6-4  3-6  7-6(5)"
        var setsP1 = 0, setsP2 = 0, totalGP1 = 0, totalGP2 = 0;
        for (var si = 0; si < state.sets.length; si++) {
          var ss = state.sets[si];
          if (ss.gamesP1 > ss.gamesP2) setsP1++; else if (ss.gamesP2 > ss.gamesP1) setsP2++;
          totalGP1 += ss.gamesP1; totalGP2 += ss.gamesP2;
          var setClr = ss.gamesP1 > ss.gamesP2 ? '#60a5fa' : (ss.gamesP2 > ss.gamesP1 ? '#f87171' : 'var(--text-muted)');
          scoreSummary += '<span style="font-size:clamp(1.3rem,4vw,2rem);font-weight:900;color:' + setClr + ';font-variant-numeric:tabular-nums;">' + ss.gamesP1 + '-' + ss.gamesP2;
          if (ss.tiebreak) scoreSummary += '<sup style="font-size:0.55em;font-weight:600;">(' + Math.min(ss.tiebreak.p1, ss.tiebreak.p2) + ')</sup>';
          scoreSummary += '</span>';
          if (si < state.sets.length - 1) scoreSummary += '<span style="color:rgba(255,255,255,0.15);margin:0 clamp(4px,1vw,8px);">·</span>';
        }
      } else {
        // Simple or fixed set score
        var scP1 = state.isFixedSet ? state.sets[0].gamesP1 : state.currentGameP1;
        var scP2 = state.isFixedSet ? state.sets[0].gamesP2 : state.currentGameP2;
        scoreSummary = '<span style="font-size:clamp(1.8rem,6vw,3rem);font-weight:900;color:#60a5fa;font-variant-numeric:tabular-nums;">' + scP1 + '</span>' +
          '<span style="color:rgba(255,255,255,0.25);margin:0 8px;font-size:1.2rem;">×</span>' +
          '<span style="font-size:clamp(1.8rem,6vw,3rem);font-weight:900;color:#f87171;font-variant-numeric:tabular-nums;">' + scP2 + '</span>';
      }

      // Elapsed time
      var elapsedStr = '';
      if (_matchStartTime) {
        var endT = _matchEndTime || Date.now();
        var elapsedMs = endT - _matchStartTime;
        var mins = Math.floor(elapsedMs / 60000);
        var secs = Math.floor((elapsedMs % 60000) / 1000);
        if (mins >= 60) {
          var hrs = Math.floor(mins / 60);
          elapsedStr = hrs + 'h' + String(mins % 60).padStart(2, '0') + 'min';
        } else {
          elapsedStr = mins + 'min' + String(secs).padStart(2, '0') + 's';
        }
      }

      // Total points
      var totalPtsP1 = 0, totalPtsP2 = 0;
      for (var pi = 0; pi < state.sets.length; pi++) {
        var ps = state.sets[pi];
        totalPtsP1 += ps.gamesP1; totalPtsP2 += ps.gamesP2;
        if (ps.tiebreak) { totalPtsP1 += ps.tiebreak.p1; totalPtsP2 += ps.tiebreak.p2; }
      }
      var totalPts = totalPtsP1 + totalPtsP2;

      // Win percentage
      var winPct = totalPts > 0 ? Math.round((winTeam === 1 ? totalPtsP1 : totalPtsP2) / totalPts * 100) : 50;
      var losePct = 100 - winPct;

      // Compute team + per-player stats from gameLog + pointLog
      var _computeMatchStats = function() {
        var pts = state.pointLog || [], gmL = state.gameLog || [];
        var teamStats = {
          1: { points: 0, games: 0, sets: 0, holdServed: 0, held: 0, longestStreak: 0, biggestLead: 0,
               servePtsPlayed: 0, servePtsWon: 0, receivePtsPlayed: 0, receivePtsWon: 0,
               deucePtsPlayed: 0, deucePtsWon: 0, breaks: 0 },
          2: { points: 0, games: 0, sets: 0, holdServed: 0, held: 0, longestStreak: 0, biggestLead: 0,
               servePtsPlayed: 0, servePtsWon: 0, receivePtsPlayed: 0, receivePtsWon: 0,
               deucePtsPlayed: 0, deucePtsWon: 0, breaks: 0 }
        };
        var curStreak = { 1: 0, 2: 0 }, cum = 0;
        var deuceThresh = 3; // 40-40 in tennis counting (numeric points 3-3)
        for (var i = 0; i < pts.length; i++) {
          var pt = pts[i];
          teamStats[pt.team].points++;
          if (pt.team === 1) { curStreak[1]++; curStreak[2] = 0; cum++; }
          else { curStreak[2]++; curStreak[1] = 0; cum--; }
          if (curStreak[pt.team] > teamStats[pt.team].longestStreak) teamStats[pt.team].longestStreak = curStreak[pt.team];
          if (cum > teamStats[1].biggestLead) teamStats[1].biggestLead = cum;
          if (-cum > teamStats[2].biggestLead) teamStats[2].biggestLead = -cum;
          // Serve/receive stats only for points with server context
          if (pt.serverTeam === 1 || pt.serverTeam === 2) {
            var srvT = pt.serverTeam;
            var recT = srvT === 1 ? 2 : 1;
            teamStats[srvT].servePtsPlayed++;
            teamStats[recT].receivePtsPlayed++;
            if (pt.team === srvT) teamStats[srvT].servePtsWon++;
            else teamStats[recT].receivePtsWon++;
            // Deuce (killer point): p1Before === p2Before === 3 in a normal game (not tiebreak)
            if (!pt.isTiebreak && pt.p1Before === deuceThresh && pt.p2Before === deuceThresh) {
              teamStats[1].deucePtsPlayed++;
              teamStats[2].deucePtsPlayed++;
              teamStats[pt.team].deucePtsWon++;
            }
          }
        }
        for (var g = 0; g < gmL.length; g++) {
          var ge = gmL[g];
          teamStats[ge.winner].games++;
          if (ge.serverTeam && ge.winner !== ge.serverTeam) {
            // Receiving team won a game = break
            teamStats[ge.winner].breaks++;
          }
        }
        for (var s = 0; s < state.sets.length; s++) {
          var ss = state.sets[s];
          if (ss.gamesP1 > ss.gamesP2) teamStats[1].sets++;
          else if (ss.gamesP2 > ss.gamesP1) teamStats[2].sets++;
        }
        var playerStats = {};
        var allPlayers = p1Players.concat(p2Players);
        for (var pi = 0; pi < allPlayers.length; pi++) {
          playerStats[allPlayers[pi]] = {
            served: 0, held: 0, team: pi < p1Players.length ? 1 : 2,
            _streak: 0, longestHoldStreak: 0,
            servePtsPlayed: 0, servePtsWon: 0
          };
        }
        for (var gg = 0; gg < gmL.length; gg++) {
          var entry = gmL[gg];
          if (!entry.serverName || !playerStats[entry.serverName]) continue;
          var psp = playerStats[entry.serverName];
          psp.served++;
          if (entry.winner === entry.serverTeam) {
            psp.held++;
            psp._streak++;
            if (psp._streak > psp.longestHoldStreak) psp.longestHoldStreak = psp._streak;
          } else {
            psp._streak = 0;
          }
          teamStats[entry.serverTeam].holdServed++;
          if (entry.winner === entry.serverTeam) teamStats[entry.serverTeam].held++;
        }
        // Per-player point-level serve stats from pointLog
        for (var pj = 0; pj < pts.length; pj++) {
          var ppt = pts[pj];
          if (!ppt.server || !playerStats[ppt.server]) continue;
          playerStats[ppt.server].servePtsPlayed++;
          if (ppt.team === ppt.serverTeam) playerStats[ppt.server].servePtsWon++;
        }
        return { teamStats: teamStats, playerStats: playerStats };
      };

      var _matchStats = _computeMatchStats();
      var winT = _matchStats.teamStats[winTeam];
      var losT = _matchStats.teamStats[winTeam === 1 ? 2 : 1];
      var hasServeData = state.gameLog && state.gameLog.length > 0 && !state.serveSkipped;

      // Player detail modal — called from chip onclick. Uses closure over _computeMatchStats + helpers.
      window._showPlayerMatchStats = function(playerName) {
        var st = _computeMatchStats();
        var ps = st.playerStats[playerName];
        if (!ps) return;
        var accent = ps.team === 1 ? '#60a5fa' : '#f87171';
        var accentBg = ps.team === 1 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)';
        var holdPct = ps.served > 0 ? Math.round(ps.held / ps.served * 100) : 0;
        var teamMates = ps.team === 1 ? p1Players : p2Players;
        var teamLabel = teamMates.join(' / ');
        var isWinner = ps.team === winTeam;
        // Count points scored while this player was serving (derive from gameLog + pointLog)
        // Simplified: points team won per game × team while this player served
        var ptsServedOn = 0, ptsWonWhileServing = 0;
        // Walk through pointLog and reconstruct which game each point is in by tracking running game totals.
        // For simplicity: we don't have explicit mapping, skip detailed per-point serve attribution.

        var modal = document.createElement('div');
        modal.id = 'player-match-stats-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(4px);z-index:100020;display:flex;align-items:center;justify-content:center;padding:1rem;';
        var _boxStat = function(label, value, icon) {
          return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);">' +
            '<span style="font-size:1rem;">' + icon + '</span>' +
            '<span style="font-size:1.1rem;font-weight:900;color:' + accent + ';font-variant-numeric:tabular-nums;line-height:1;">' + value + '</span>' +
            '<span style="font-size:0.55rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;text-align:center;">' + label + '</span>' +
          '</div>';
        };
        modal.innerHTML =
          '<div style="background:#0f172a;border:1.5px solid ' + accent + ';border-radius:18px;max-width:380px;width:100%;padding:1.25rem;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">' +
            // Header
            '<div style="display:flex;align-items:center;gap:12px;">' + _liveAvatarHtml(playerName, 52) +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:1.15rem;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(playerName) + '</div>' +
                '<div style="font-size:0.7rem;color:' + accent + ';font-weight:700;display:flex;align-items:center;gap:6px;">' +
                  (isWinner ? '🏆 ' : '') + 'Time ' + ps.team + ' · ' + window._safeHtml(teamLabel) +
                '</div>' +
              '</div>' +
              '<button onclick="document.getElementById(\'player-match-stats-modal\').remove()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:var(--text-bright);border-radius:8px;padding:6px 10px;font-size:0.7rem;font-weight:700;cursor:pointer;">✕</button>' +
            '</div>' +
            // Serve stats grid
            (hasServeData ? (
              '<div style="display:flex;flex-direction:column;gap:6px;">' +
                '<div style="font-size:0.55rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;text-align:center;">🎾 Saque · Por Game</div>' +
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">' +
                  _boxStat('Games servidos', ps.served, '🎾') +
                  _boxStat('Games mantidos', ps.held, '🏆') +
                  _boxStat('Aproveit.', holdPct + '%', '📊') +
                  _boxStat('Maior sequência', ps.longestHoldStreak, '🔥') +
                '</div>' +
                (ps.servePtsPlayed > 0 ? (
                  '<div style="font-size:0.55rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;text-align:center;margin-top:4px;">🚀 Saque · Por Ponto</div>' +
                  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
                    _boxStat('Pts servidos', ps.servePtsPlayed, '🎯') +
                    _boxStat('Pts ganhos', ps.servePtsWon, '✅') +
                    _boxStat('% no saque', (ps.servePtsPlayed > 0 ? Math.round(ps.servePtsWon / ps.servePtsPlayed * 100) : 0) + '%', '📈') +
                  '</div>'
                ) : '') +
              '</div>'
            ) : '<div style="text-align:center;font-size:0.72rem;color:var(--text-muted);padding:10px;">Sem dados de saque (tracking desativado)</div>') +
            // Team context
            '<div style="padding:10px;border-radius:10px;background:' + accentBg + ';border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:4px;">' +
              '<div style="font-size:0.55rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Seu time na partida</div>' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:0.8rem;font-weight:800;color:#fff;">' +
                '<span>' + st.teamStats[ps.team].points + ' pts · ' + st.teamStats[ps.team].games + ' games · ' + st.teamStats[ps.team].sets + ' sets</span>' +
              '</div>' +
            '</div>' +
            '<button onclick="document.getElementById(\'player-match-stats-modal\').remove()" style="padding:12px;border-radius:10px;border:none;background:rgba(99,102,241,0.2);color:#818cf8;font-weight:700;cursor:pointer;font-size:0.9rem;">Fechar</button>' +
          '</div>';
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
      };

      // Clickable player chip builder
      var _playerChip = function(name, bigSize, accentClr) {
        var sz = bigSize ? 32 : 26;
        var fs = bigSize ? 'clamp(0.92rem,3vw,1.15rem)' : 'clamp(0.8rem,2.6vw,0.95rem)';
        var pad = bigSize ? '8px 12px' : '6px 10px';
        var escName = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return '<button type="button" onclick="window._showPlayerMatchStats(\'' + escName + '\')" title="Ver estatísticas detalhadas" style="display:flex;align-items:center;gap:8px;padding:' + pad + ';border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid ' + (bigSize ? accentClr + '66' : 'rgba(255,255,255,0.10)') + ';cursor:pointer;color:#fff;font-family:inherit;transition:background 0.15s,transform 0.1s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'" ontouchstart="this.style.transform=\'scale(0.97)\'" ontouchend="this.style.transform=\'\'">' +
          _liveAvatarHtml(name, sz) +
          '<span style="font-size:' + fs + ';font-weight:700;color:#fff;white-space:nowrap;">' + window._safeHtml(name) + '</span>' +
          '<span style="font-size:0.55rem;color:var(--text-muted);margin-left:2px;" aria-hidden="true">📊</span>' +
        '</button>';
      };

      var winChipsHtml = '';
      for (var wi = 0; wi < winPlayers.length; wi++) winChipsHtml += _playerChip(winPlayers[wi], true, winClr);
      var loseChipsHtml = '';
      for (var li = 0; li < losePlayers.length; li++) loseChipsHtml += _playerChip(losePlayers[li], false, loseClr);

      // Comparative stats bar builder
      var _compareBar = function(label, icon, winVal, losVal, fmt, maxCap) {
        fmt = fmt || function(v) { return v; };
        var maxV = maxCap || Math.max(winVal, losVal, 1);
        var winPctBar = Math.round(winVal / maxV * 100);
        var losPctBar = Math.round(losVal / maxV * 100);
        return (
          '<div style="display:flex;flex-direction:column;gap:4px;">' +
            '<div style="text-align:center;font-size:0.6rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;">' + icon + ' ' + label + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span style="flex:0 0 auto;min-width:36px;text-align:right;font-size:0.9rem;font-weight:900;color:' + winClr + ';font-variant-numeric:tabular-nums;">' + fmt(winVal) + '</span>' +
              '<div style="flex:1;height:9px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,0.05);display:flex;justify-content:flex-end;position:relative;">' +
                '<div style="width:' + winPctBar + '%;background:linear-gradient(90deg,' + winClr + '44,' + winClr + ');border-radius:5px 0 0 5px;transition:width 0.5s ease-out;"></div>' +
              '</div>' +
              '<div style="width:1px;height:14px;background:rgba(255,255,255,0.2);"></div>' +
              '<div style="flex:1;height:9px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,0.05);display:flex;">' +
                '<div style="width:' + losPctBar + '%;background:linear-gradient(90deg,' + loseClr + ',' + loseClr + '44);border-radius:0 5px 5px 0;transition:width 0.5s ease-out;"></div>' +
              '</div>' +
              '<span style="flex:0 0 auto;min-width:36px;font-size:0.9rem;font-weight:900;color:' + loseClr + ';font-variant-numeric:tabular-nums;">' + fmt(losVal) + '</span>' +
            '</div>' +
          '</div>'
        );
      };

      var winHoldPct = winT.holdServed > 0 ? Math.round(winT.held / winT.holdServed * 100) : 0;
      var losHoldPct = losT.holdServed > 0 ? Math.round(losT.held / losT.holdServed * 100) : 0;
      var winServePctPts = winT.servePtsPlayed > 0 ? Math.round(winT.servePtsWon / winT.servePtsPlayed * 100) : 0;
      var losServePctPts = losT.servePtsPlayed > 0 ? Math.round(losT.servePtsWon / losT.servePtsPlayed * 100) : 0;
      var winRecvPct = winT.receivePtsPlayed > 0 ? Math.round(winT.receivePtsWon / winT.receivePtsPlayed * 100) : 0;
      var losRecvPct = losT.receivePtsPlayed > 0 ? Math.round(losT.receivePtsWon / losT.receivePtsPlayed * 100) : 0;
      var hasPointServeData = (winT.servePtsPlayed + losT.servePtsPlayed) > 0;
      var hasDeuceData = (winT.deucePtsPlayed + losT.deucePtsPlayed) > 0;

      // Comparative stats section
      var comparativeSection =
        '<div style="width:100%;max-width:380px;padding:clamp(12px,2.2vh,18px);border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);display:flex;flex-direction:column;gap:clamp(8px,1.6vh,14px);">' +
          '<div style="text-align:center;font-size:0.6rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;">⚖ Comparação dos Times</div>' +
          (useSets && !state.isFixedSet ? _compareBar('Sets', '🏅', winT.sets, losT.sets) : '') +
          (state.totalGamesPlayed > 0 ? _compareBar('Games', '🎾', winT.games, losT.games) : '') +
          _compareBar('Pontos', '🎯', winT.points, losT.points) +
          (hasPointServeData ? _compareBar('% Pontos no Saque', '🚀', winServePctPts, losServePctPts, function(v) { return v + '%'; }, 100) : '') +
          (hasPointServeData ? _compareBar('% Pontos na Recepção', '🎯', winRecvPct, losRecvPct, function(v) { return v + '%'; }, 100) : '') +
          (hasServeData ? _compareBar('Games Mantidos (saque)', '📊', winHoldPct, losHoldPct, function(v) { return v + '%'; }, 100) : '') +
          (hasServeData ? _compareBar('Quebras de Saque', '💥', winT.breaks, losT.breaks) : '') +
          (hasDeuceData ? _compareBar('Killer Points (40-40)', '⚡', winT.deucePtsWon, losT.deucePtsWon) : '') +
          _compareBar('Maior Sequência', '🔥', winT.longestStreak, losT.longestStreak) +
          _compareBar('Maior Vantagem', '📈', winT.biggestLead, losT.biggestLead) +
        '</div>';

      // Winner section: crown + clickable chips + score
      var winnerSection =
        '<div style="width:100%;max-width:380px;padding:clamp(10px,2vh,16px) clamp(10px,2vw,16px);border-radius:14px;background:linear-gradient(180deg,rgba(' + (winTeam === 1 ? '59,130,246' : '239,68,68') + ',0.16),rgba(' + (winTeam === 1 ? '59,130,246' : '239,68,68') + ',0.04));border:1px solid rgba(' + (winTeam === 1 ? '59,130,246' : '239,68,68') + ',0.4);display:flex;flex-direction:column;align-items:center;gap:clamp(6px,1.2vh,10px);">' +
          '<div style="font-size:clamp(1.8rem,6vw,2.8rem);line-height:1;">🏆</div>' +
          '<div style="font-size:0.6rem;font-weight:800;color:' + winClr + ';text-transform:uppercase;letter-spacing:2px;">Vencedor</div>' +
          '<div style="display:flex;flex-direction:column;align-items:stretch;gap:6px;width:100%;max-width:280px;">' + winChipsHtml + '</div>' +
          '<div style="display:flex;align-items:center;justify-content:center;gap:0;margin:4px 0 2px;">' + scoreSummary + '</div>' +
          '<div style="font-size:0.55rem;color:var(--text-muted);text-align:center;">💡 toque nos jogadores para ver estatísticas</div>' +
        '</div>';

      // Loser section: names as clickable chips
      var loserSection =
        '<div style="width:100%;max-width:380px;padding:clamp(8px,1.8vh,14px) clamp(10px,2vw,16px);border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;align-items:center;gap:clamp(4px,1vh,8px);opacity:0.94;">' +
          '<div style="font-size:0.6rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;">Perdedor</div>' +
          '<div style="display:flex;flex-direction:column;align-items:stretch;gap:4px;width:100%;max-width:260px;">' + loseChipsHtml + '</div>' +
        '</div>';

      var durationRow = elapsedStr
        ? '<div style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.75rem;color:var(--text-muted);"><span>⏱</span><span style="font-weight:700;color:var(--text-bright);">' + elapsedStr + '</span><span>de jogo</span></div>'
        : '';

      // Time-per-point analytics from pointLog timestamps
      function _fmtSec(ms) {
        if (ms == null) return '—';
        var s = Math.max(0, Math.round(ms / 1000));
        if (s < 60) return s + 's';
        var m = Math.floor(s / 60), ss = s % 60;
        return m + 'm' + String(ss).padStart(2, '0') + 's';
      }
      var _timeStats = null;
      if (state.pointLog && state.pointLog.length >= 2) {
        var tsPts = state.pointLog;
        var intervals = [];
        var prevT = _matchStartTime || null;
        for (var tpi = 0; tpi < tsPts.length; tpi++) {
          var ti = tsPts[tpi].t;
          if (!ti) continue;
          if (prevT) intervals.push(ti - prevT);
          prevT = ti;
        }
        if (intervals.length > 0) {
          var sumMs = 0, minMs = Infinity, maxMs = 0;
          for (var ii = 0; ii < intervals.length; ii++) {
            sumMs += intervals[ii];
            if (intervals[ii] < minMs) minMs = intervals[ii];
            if (intervals[ii] > maxMs) maxMs = intervals[ii];
          }
          _timeStats = {
            totalMs: _matchStartTime && _matchEndTime ? (_matchEndTime - _matchStartTime) : null,
            avgMs: Math.round(sumMs / intervals.length),
            minMs: minMs === Infinity ? null : minMs,
            maxMs: maxMs || null,
            pointCount: tsPts.length
          };
        }
      }
      var timeStatsSection = '';
      if (_timeStats) {
        var _tsBox = function(label, value, color) {
          return '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">' +
            '<span style="font-size:0.95rem;font-weight:800;color:' + (color || '#fff') + ';font-variant-numeric:tabular-nums;">' + value + '</span>' +
            '<span style="font-size:0.55rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;text-align:center;">' + label + '</span>' +
          '</div>';
        };
        timeStatsSection =
          '<div style="width:100%;max-width:380px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:8px;">' +
            '<div style="text-align:center;font-size:0.6rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;">⏱ Tempo</div>' +
            '<div style="display:flex;align-items:stretch;gap:6px;">' +
              _tsBox('Duração', _timeStats.totalMs ? _fmtSec(_timeStats.totalMs) : '—', '#fff') +
              _tsBox('Tempo/pt', _fmtSec(_timeStats.avgMs), '#60a5fa') +
              _tsBox('Mais longo', _fmtSec(_timeStats.maxMs), '#fbbf24') +
              _tsBox('Mais curto', _fmtSec(_timeStats.minMs), '#22c55e') +
            '</div>' +
          '</div>';
      }

      // Momentum graph: two cumulative lines (P1 blue, P2 red) with progressive draw animation
      var momentumSection = '';
      if (state.pointLog && state.pointLog.length >= 2) {
        var pts = state.pointLog;
        var width = 320, height = 140, padX = 26, padY = 18, padB = 22;
        var innerW = width - padX * 2, innerH = height - padY - padB;
        var p1Cum = [], p2Cum = [], setEnds = [], p1 = 0, p2 = 0;
        for (var gi = 0; gi < pts.length; gi++) {
          if (pts[gi].team === 1) p1++; else p2++;
          p1Cum.push(p1); p2Cum.push(p2);
          if (pts[gi].endSet) setEnds.push(gi);
        }
        var maxY = Math.max(p1, p2, 1);
        var xOf = function(i) { return padX + (pts.length === 1 ? innerW / 2 : i / (pts.length - 1) * innerW); };
        var yOf = function(v) { return padY + innerH - (v / maxY) * innerH; };
        // Build polyline points
        var p1Pts = '', p2Pts = '';
        for (var j = 0; j < pts.length; j++) {
          p1Pts += xOf(j).toFixed(1) + ',' + yOf(p1Cum[j]).toFixed(1) + ' ';
          p2Pts += xOf(j).toFixed(1) + ',' + yOf(p2Cum[j]).toFixed(1) + ' ';
        }
        // Horizontal grid lines with Y-axis labels
        var grid = '';
        var gridStep = maxY <= 10 ? 2 : (maxY <= 30 ? 5 : 10);
        for (var gv = 0; gv <= maxY; gv += gridStep) {
          var gy = yOf(gv).toFixed(1);
          grid += '<line x1="' + padX + '" y1="' + gy + '" x2="' + (width - padX) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.05)" stroke-width="1" />';
          grid += '<text x="' + (padX - 5) + '" y="' + (parseFloat(gy) + 3) + '" fill="rgba(255,255,255,0.4)" font-size="8" text-anchor="end" font-family="monospace">' + gv + '</text>';
        }
        // Set boundaries (vertical dashed lines with S1/S2 labels at top)
        var setLines = '';
        for (var si2 = 0; si2 < setEnds.length; si2++) {
          var sx = xOf(setEnds[si2]).toFixed(1);
          setLines += '<line x1="' + sx + '" y1="' + padY + '" x2="' + sx + '" y2="' + (height - padB) + '" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="3,3" />';
          setLines += '<text x="' + sx + '" y="' + (padY - 5) + '" fill="rgba(255,255,255,0.55)" font-size="9" text-anchor="middle" font-family="monospace" font-weight="700">S' + (si2 + 1) + '</text>';
        }
        // Final score labels at end of each line
        var endX = xOf(pts.length - 1).toFixed(1);
        var p1EndY = yOf(p1).toFixed(1);
        var p2EndY = yOf(p2).toFixed(1);
        var p1Label = p1Players.length > 1 ? p1Players.join(' / ') : (p1Players[0] || 'Time 1');
        var p2Label = p2Players.length > 1 ? p2Players.join(' / ') : (p2Players[0] || 'Time 2');
        // Unique animation name — re-triggers the CSS animation every time the finish state renders
        var animId = 'mom-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);

        momentumSection =
          '<div style="width:100%;max-width:380px;padding:clamp(10px,2vh,14px) clamp(8px,1.5vw,12px);border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);display:flex;flex-direction:column;gap:8px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px;">' +
              '<div style="font-size:0.6rem;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:1.5px;">📈 Momentum da Partida</div>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<div style="font-size:0.58rem;color:var(--text-muted);font-weight:600;">' + pts.length + ' pts</div>' +
                '<button id="mom-replay-btn" style="padding:3px 8px;border-radius:6px;font-size:0.6rem;font-weight:700;border:1px solid rgba(251,191,36,0.35);cursor:pointer;background:rgba(251,191,36,0.1);color:#fbbf24;">↻ Replay</button>' +
              '</div>' +
            '</div>' +
            '<style>' +
              '@keyframes ' + animId + ' { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }' +
              '@keyframes ' + animId + '-pop { 0%,80%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }' +
              '.' + animId + '-line { stroke-dasharray: 100; stroke-dashoffset: 100; animation: ' + animId + ' 2.8s cubic-bezier(0.4,0,0.2,1) forwards; }' +
              '.' + animId + '-dot { transform-origin: center; transform-box: fill-box; animation: ' + animId + '-pop 3s ease-out forwards; }' +
            '</style>' +
            '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" style="max-width:' + width + 'px;display:block;margin:0 auto;overflow:visible;">' +
              grid +
              setLines +
              // Baseline (x-axis)
              '<line x1="' + padX + '" y1="' + (height - padB) + '" x2="' + (width - padX) + '" y2="' + (height - padB) + '" stroke="rgba(255,255,255,0.3)" stroke-width="1" />' +
              // P1 line (blue)
              '<polyline class="' + animId + '-line" points="' + p1Pts + '" pathLength="100" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 3px rgba(59,130,246,0.5));" />' +
              // P2 line (red)
              '<polyline class="' + animId + '-line" points="' + p2Pts + '" pathLength="100" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 3px rgba(239,68,68,0.5));" />' +
              // End markers (appear after animation finishes)
              '<circle class="' + animId + '-dot" cx="' + endX + '" cy="' + p1EndY + '" r="4.5" fill="#3b82f6" stroke="#fff" stroke-width="1.8" />' +
              '<circle class="' + animId + '-dot" cx="' + endX + '" cy="' + p2EndY + '" r="4.5" fill="#ef4444" stroke="#fff" stroke-width="1.8" />' +
              // Final score labels next to end markers
              '<text class="' + animId + '-dot" x="' + (parseFloat(endX) + 8) + '" y="' + (parseFloat(p1EndY) + 3) + '" fill="#60a5fa" font-size="10" font-weight="700" font-family="monospace">' + p1 + '</text>' +
              '<text class="' + animId + '-dot" x="' + (parseFloat(endX) + 8) + '" y="' + (parseFloat(p2EndY) + 3) + '" fill="#f87171" font-size="10" font-weight="700" font-family="monospace">' + p2 + '</text>' +
            '</svg>' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:14px;padding:0 4px;font-size:0.6rem;">' +
              '<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:3px;border-radius:2px;background:#3b82f6;"></span><span style="color:#60a5fa;font-weight:700;">' + window._safeHtml(p1Label) + '</span></span>' +
              '<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:3px;border-radius:2px;background:#ef4444;"></span><span style="color:#f87171;font-weight:700;">' + window._safeHtml(p2Label) + '</span></span>' +
            '</div>' +
          '</div>';
      }

      // Restart section: visible to all users on the match screen.
      // Compact button + proper toggle-switch side-by-side. Button uses a short
      // label so the "Re-sortear duplas" toggle fits elegantly on narrow phones.
      var restartSection = '';
      if (isDoubles) {
        restartSection =
          '<div style="display:flex;align-items:center;gap:8px;width:100%;">' +
            '<button onclick="window._liveScoreRestart()" title="Jogar novamente" style="flex:0 0 auto;padding:10px 12px;border-radius:12px;font-size:0.8rem;font-weight:700;border:2px solid rgba(99,102,241,0.3);cursor:pointer;background:rgba(99,102,241,0.1);color:#818cf8;white-space:nowrap;">🔄 Jogar</button>' +
            '<label style="flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;">' +
              '<span style="font-size:0.72rem;font-weight:600;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">Re-sortear duplas</span>' +
              '<span class="toggle-switch toggle-sm" style="flex-shrink:0;">' +
                '<input type="checkbox" id="chk-shuffle-teams" />' +
                '<span class="toggle-slider"></span>' +
              '</span>' +
            '</label>' +
          '</div>';
      } else {
        restartSection =
          '<button onclick="window._liveScoreRestart()" style="width:100%;padding:13px;border-radius:12px;font-size:0.95rem;font-weight:700;border:2px solid rgba(99,102,241,0.3);cursor:pointer;background:rgba(99,102,241,0.1);color:#818cf8;">🔄 Jogar Novamente</button>';
      }

      // Scrollable content area (flex:1) with buttons pinned at bottom (flex-shrink:0)
      // Momentum graph placed right below the winner so its draw animation is visible
      // at the top of the screen the moment the result view opens — the animation
      // would be wasted if it were below the fold.
      container.innerHTML =
        '<div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;width:100%;padding:clamp(8px,2vh,16px) clamp(12px,3vw,24px) 8px;gap:clamp(8px,1.5vh,14px);">' +
          // Winner section on top
          winnerSection +
          // Momentum graph (animation visible immediately on open)
          momentumSection +
          // Comparative team stats
          comparativeSection +
          // Loser section below
          loserSection +
          // Time analytics (duration + per-point)
          timeStatsSection +
          // Duration (redundant tiny line — hide if timeStatsSection already shown)
          (timeStatsSection ? '' : durationRow) +
        '</div>' +
        // Action buttons pinned at bottom — padding accounts for the device safe-area
        // (e.g. iOS home-indicator) so the buttons never get cropped by the browser chrome.
        '<div style="flex-shrink:0;padding:8px 1rem calc(12px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:8px;background:#0a0e1a;border-top:1px solid rgba(255,255,255,0.06);">' +
          '<button onclick="window._liveScoreSave()" style="width:100%;padding:15px;border-radius:14px;font-size:1.05rem;font-weight:800;border:none;cursor:pointer;' +
          'background:linear-gradient(135deg,#10b981,#059669);color:white;box-shadow:0 4px 20px rgba(16,185,129,0.4);">✅ Confirmar Resultado</button>' +
          restartSection +
        '</div>';
      // Wire up Replay button — re-renders the finish view to re-trigger the SVG draw animation
      setTimeout(function() {
        var replayBtn = document.getElementById('mom-replay-btn');
        if (replayBtn) {
          replayBtn.addEventListener('click', function() {
            _render();
          });
        }
      }, 0);
      _syncLiveState();
      return;
    }

    // Current game display — no "GAME" label, only special states
    var gameLabel = '';
    var p1Display, p2Display;
    if (!useSets || state.isFixedSet) {
      gameLabel = '';
      p1Display = String(state.currentGameP1);
      p2Display = String(state.currentGameP2);
    } else if (_isDecidingSet()) {
      gameLabel = 'SUPER TIE-BREAK';
      p1Display = String(state.currentGameP1);
      p2Display = String(state.currentGameP2);
    } else if (state.isTiebreak) {
      gameLabel = 'TIE-BREAK';
      p1Display = String(state.currentGameP1);
      p2Display = String(state.currentGameP2);
    } else {
      gameLabel = '';
      p1Display = _formatGamePoint(state.currentGameP1, state.currentGameP2, false);
      p2Display = _formatGamePoint(state.currentGameP2, state.currentGameP1, false);
    }

    // Games in current set
    var gamesP1Str = '', gamesP2Str = '';
    var showGamesBox = useSets && !state.isFixedSet && !state.isFinished;
    if (showGamesBox) {
      var cs = _currentSet();
      gamesP1Str = String(cs.gamesP1);
      gamesP2Str = String(cs.gamesP2);
    }

    // Sets display — suppressed (already shown in the games box below)
    var setsRow = '';

    // Serving info
    var serverInfo = _getCurrentServer();

    // Build stacked player names in team box (bracket-style)
    // Serve ball inside team box, left of the serving player's row, draggable to change server
    var _canDragServe = !state.isFinished && !state.serveSkipped && isDoubles && state.totalGamesPlayed < 2;
    var _buildNameStack = function(team) {
      var players = team === 1 ? p1Players : p2Players;
      var clr = team === 1 ? '#3b82f6' : '#ef4444';
      var bgClr = team === 1 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)';
      var bdrClr = team === 1 ? 'rgba(59,130,246,0.30)' : 'rgba(239,68,68,0.30)';
      var cards = '';
      for (var ni = 0; ni < players.length; ni++) {
        var pn = players[ni];
        var isServing = serverInfo && !state.isFinished && serverInfo.team === team && serverInfo.name === pn;
        var fullName = window._safeHtml(pn);
        var avatar = _liveAvatarHtml(pn, 26);

        // Serve ball: shown for the current server. Draggable when serve can still be changed.
        var servBall = '';
        if (isServing) {
          var dragAttr = _canDragServe ? ' draggable="true" data-serve-ball="true"' : '';
          var dragStyle = _canDragServe ? 'cursor:grab;' : 'cursor:default;';
          var ballTitle = _canDragServe ? 'Arraste para trocar sacador' : 'Ordem de saque travada (após 2 jogos)';
          // Dimmer glow + subtle 🔒 badge when locked
          var ballGlow = _canDragServe ? 'filter:drop-shadow(0 0 4px rgba(255,200,0,0.6));' : 'filter:drop-shadow(0 0 2px rgba(255,200,0,0.3));opacity:0.85;';
          var lockBadge = _canDragServe ? '' : '<span style="font-size:0.55rem;margin-left:-4px;opacity:0.85;" aria-hidden="true">🔒</span>';
          servBall = '<span' + dragAttr + ' title="' + ballTitle + '" style="font-size:0.85rem;flex-shrink:0;' + dragStyle + ballGlow + '">' + _sportBall + '</span>' + lockBadge;
        }

        // Drop target: each player row is a drop target for the serve ball
        var dropAttr = _canDragServe ? ' data-serve-drop="' + team + '-' + ni + '"' : '';

        // Individual player box
        cards += '<div' + dropAttr + ' onclick="window._liveEditName(' + team + ',' + ni + ')" style="cursor:pointer;display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);transition:transform 0.15s,background 0.15s;">' +
          servBall +
          avatar +
          '<span style="font-size:clamp(0.75rem,2.5vw,0.92rem);font-weight:' + (isServing ? '800' : '600') + ';color:' + (isServing ? clr : 'rgba(255,255,255,0.75)') + ';white-space:nowrap;">' + fullName + '</span>' +
        '</div>';
      }
      // Team box wrapping all players
      return '<div style="display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:8px 10px;border-radius:12px;background:' + bgClr + ';border:1px solid ' + bdrClr + ';">' + cards + '</div>';
    };

    // Arrow button builder — extra large for easy tapping
    var _upBtn = function(player) {
      var clr = player === 1 ? '#3b82f6' : '#ef4444';
      return '<button onclick="window._liveScorePoint(' + player + ')" style="width:100%;padding:0;border:none;cursor:pointer;background:' + clr + ';color:#fff;font-size:3.2rem;font-weight:900;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;min-height:clamp(80px,15vh,120px);box-shadow:0 2px 10px rgba(0,0,0,0.4);transition:transform 0.08s;" ontouchstart="this.style.transform=\'scale(0.96)\'" ontouchend="this.style.transform=\'\'">▲</button>';
    };
    var _downBtn = function(player) {
      return '<button onclick="window._liveScoreMinus(' + player + ')" style="width:100%;padding:0;border:none;cursor:pointer;background:rgba(255,255,255,0.08);color:var(--text-muted);font-size:1rem;font-weight:700;border-radius:0 0 14px 14px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;min-height:clamp(36px,5vh,50px);border-top:1px solid rgba(255,255,255,0.06);" ontouchstart="this.style.background=\'rgba(255,255,255,0.15)\'" ontouchend="this.style.background=\'\'">▼</button>';
    };

    // Finish button (isFinished handled above with early return)
    var finishBtn = '';
    if (!useSets) {
      finishBtn = '<div style="padding:0 1rem;flex-shrink:0;margin-top:auto;padding-bottom:1rem;"><button onclick="window._liveScoreFinish()" style="width:100%;padding:14px;border-radius:14px;font-size:0.95rem;font-weight:700;border:2px solid rgba(16,185,129,0.3);cursor:pointer;' +
        'background:rgba(16,185,129,0.1);color:#10b981;">Encerrar Partida</button></div>';
    }

    // ── FULLSCREEN LAYOUT ──
    // Portrait: names above plates, games below.
    // Landscape (wider than tall): names on outer sides, games between plates.
    // Detect via JS — CSS media queries won't work for inline styles.
    var isLandscape = window.innerWidth > window.innerHeight;

    // Game label color (only for special states)
    var labelClr = state.isFinished ? '#10b981' : '#c084fc';

    // Court sides state: which team is on left vs right (swappable)
    var leftTeam = _courtLeft; // 1 or 2
    var rightTeam = leftTeam === 1 ? 2 : 1;

    // Games center column — colors follow court sides (left team color left, right team color right)
    var _gamesLeftStr = leftTeam === 1 ? gamesP1Str : gamesP2Str;
    var _gamesRightStr = rightTeam === 1 ? gamesP1Str : gamesP2Str;
    var _gamesLeftClr = leftTeam === 1 ? '#60a5fa' : '#f87171';
    var _gamesRightClr = rightTeam === 1 ? '#60a5fa' : '#f87171';
    var gamesCenter = '';
    if (showGamesBox) {
      gamesCenter =
        '<div class="live-games-box" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:clamp(4px,1vh,10px) clamp(10px,2vw,20px);">' +
          '<span style="font-size:0.55rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Games</span>' +
          '<div style="display:flex;align-items:center;gap:clamp(6px,2vw,12px);">' +
            '<span style="font-size:clamp(1.6rem,5vw,2.5rem);font-weight:900;color:' + _gamesLeftClr + ';font-variant-numeric:tabular-nums;line-height:1;">' + _gamesLeftStr + '</span>' +
            '<span style="font-size:clamp(0.9rem,2vw,1.3rem);font-weight:300;color:rgba(255,255,255,0.25);">–</span>' +
            '<span style="font-size:clamp(1.6rem,5vw,2.5rem);font-weight:900;color:' + _gamesRightClr + ';font-variant-numeric:tabular-nums;line-height:1;">' + _gamesRightStr + '</span>' +
          '</div>' +
        '</div>';
    }

    // Score plate builder — extra large for visibility from afar
    var _buildPlate = function(player) {
      var clr = player === 1 ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.25)';
      var display = player === 1 ? p1Display : p2Display;
      return '<div style="width:100%;background:#fff;border-radius:18px;padding:clamp(22px,7vh,48px) 8px;box-shadow:0 6px 36px rgba(0,0,0,0.5),0 0 0 4px ' + clr + ';display:flex;align-items:center;justify-content:center;">' +
        '<span style="font-size:clamp(5.5rem,24vw,12rem);font-weight:900;color:#111;font-variant-numeric:tabular-nums;line-height:1;">' + display + '</span>' +
      '</div>';
    };

    // Buttons column builder
    var _buildBtns = function(player) {
      if (state.isFinished) return '';
      return '<div style="width:100%;display:flex;flex-direction:column;">' + _upBtn(player) + _downBtn(player) + '</div>';
    };

    // Column backgrounds with team color at 50% opacity
    var leftBg = leftTeam === 1 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)';
    var rightBg = rightTeam === 1 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)';
    var leftBdr = leftTeam === 1 ? 'rgba(59,130,246,0.20)' : 'rgba(239,68,68,0.20)';
    var rightBdr = rightTeam === 1 ? 'rgba(59,130,246,0.20)' : 'rgba(239,68,68,0.20)';

    // Swap hint (only shown when not finished)
    var swapHint = !state.isFinished ? '<div style="text-align:center;font-size:0.55rem;color:var(--text-muted);opacity:0.5;margin-top:4px;">← arraste para trocar lado →</div>' : '';

    if (isLandscape) {
      // ── LANDSCAPE: [Names+Btns Left] [Plate Left] [Games] [Plate Right] [Names+Btns Right] ──
      // Landscape-specific builders with smaller sizes to fit phone screen
      var _lsPlate = function(player) {
        var clr = player === 1 ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.25)';
        var display = player === 1 ? p1Display : p2Display;
        return '<div style="width:100%;background:#fff;border-radius:14px;padding:clamp(10px,4vh,28px) 4px;box-shadow:0 4px 24px rgba(0,0,0,0.5),0 0 0 3px ' + clr + ';display:flex;align-items:center;justify-content:center;">' +
          '<span style="font-size:clamp(3.5rem,14vw,7rem);font-weight:900;color:#111;font-variant-numeric:tabular-nums;line-height:1;">' + display + '</span>' +
        '</div>';
      };
      var _lsUpBtn = function(player) {
        var clr = player === 1 ? '#3b82f6' : '#ef4444';
        return '<button onclick="window._liveScorePoint(' + player + ')" style="width:100%;padding:0;border:none;cursor:pointer;background:' + clr + ';color:#fff;font-size:2rem;font-weight:900;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;min-height:clamp(44px,10vh,70px);box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform 0.08s;" ontouchstart="this.style.transform=\'scale(0.96)\'" ontouchend="this.style.transform=\'\'">▲</button>';
      };
      var _lsDownBtn = function(player) {
        return '<button onclick="window._liveScoreMinus(' + player + ')" style="width:100%;padding:0;border:none;cursor:pointer;background:rgba(255,255,255,0.08);color:var(--text-muted);font-size:0.8rem;font-weight:700;border-radius:0 0 10px 10px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;min-height:clamp(24px,4vh,36px);border-top:1px solid rgba(255,255,255,0.06);" ontouchstart="this.style.background=\'rgba(255,255,255,0.15)\'" ontouchend="this.style.background=\'\'">▼</button>';
      };
      var _lsBtns = function(player) {
        if (state.isFinished) return '';
        return '<div style="width:100%;display:flex;flex-direction:column;">' + _lsUpBtn(player) + _lsDownBtn(player) + '</div>';
      };
      // Landscape games box — smaller, colors follow court sides
      var lsGamesCenter = '';
      if (showGamesBox) {
        lsGamesCenter =
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:clamp(4px,1vh,8px) clamp(6px,1.5vw,14px);">' +
            '<span style="font-size:0.45rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Games</span>' +
            '<div style="display:flex;align-items:center;gap:clamp(4px,1vw,8px);">' +
              '<span style="font-size:clamp(1.1rem,3.5vw,1.8rem);font-weight:900;color:' + _gamesLeftClr + ';font-variant-numeric:tabular-nums;line-height:1;">' + _gamesLeftStr + '</span>' +
              '<span style="font-size:clamp(0.7rem,1.5vw,1rem);font-weight:300;color:rgba(255,255,255,0.25);">–</span>' +
              '<span style="font-size:clamp(1.1rem,3.5vw,1.8rem);font-weight:900;color:' + _gamesRightClr + ';font-variant-numeric:tabular-nums;line-height:1;">' + _gamesRightStr + '</span>' +
            '</div>' +
          '</div>';
      }

      container.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;width:100%;gap:0;padding:0;">' +
          // Sets row
          setsRow +
          // Special label (TIE-BREAK, winner)
          (gameLabel ? '<div style="text-align:center;font-size:clamp(0.6rem,1.5vw,0.75rem);font-weight:700;color:' + labelClr + ';text-transform:uppercase;letter-spacing:2px;margin-bottom:clamp(2px,0.5vh,6px);">' + gameLabel + '</div>' : '') +
          // Main row — 5 columns with constrained widths
          '<div style="display:flex;align-items:center;width:100%;gap:clamp(4px,0.8vw,8px);justify-content:center;padding:0 6px;">' +
            // Left column: names + buttons stacked
            '<div style="flex:0 1 auto;min-width:0;max-width:22vw;display:flex;flex-direction:column;align-items:stretch;gap:3px;">' +
              _buildNameStack(leftTeam) +
              _lsBtns(leftTeam) +
            '</div>' +
            // Left plate
            '<div style="flex:1;display:flex;align-items:center;justify-content:center;max-width:28vw;">' +
              _lsPlate(leftTeam) +
            '</div>' +
            // Games center
            (showGamesBox ? lsGamesCenter : '<div style="width:clamp(4px,1vw,10px);"></div>') +
            // Right plate
            '<div style="flex:1;display:flex;align-items:center;justify-content:center;max-width:28vw;">' +
              _lsPlate(rightTeam) +
            '</div>' +
            // Right column: names + buttons stacked
            '<div style="flex:0 1 auto;min-width:0;max-width:22vw;display:flex;flex-direction:column;align-items:stretch;gap:3px;">' +
              _buildNameStack(rightTeam) +
              _lsBtns(rightTeam) +
            '</div>' +
          '</div>' +
        '</div>';
    } else {
      // ── PORTRAIT: two columns with team-colored backgrounds, draggable to swap sides ──
      container.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;width:100%;gap:0;padding:clamp(4px,1vh,12px) 0 0 0;">' +
          // Sets row
          setsRow +
          // Special label (TIE-BREAK, winner)
          (gameLabel ? '<div style="text-align:center;font-size:clamp(0.65rem,2vw,0.8rem);font-weight:700;color:' + labelClr + ';text-transform:uppercase;letter-spacing:2px;margin-bottom:clamp(2px,0.5vh,6px);">' + gameLabel + '</div>' : '') +
          // Games box — above plates for guaranteed visibility
          (showGamesBox ? '<div style="flex-shrink:0;margin-bottom:clamp(4px,1vh,8px);">' + gamesCenter + '</div>' : '') +
          // Two-column score plates with team-colored backgrounds
          '<div id="live-court-container" style="display:flex;align-items:stretch;width:100%;gap:4px;justify-content:center;flex:1;min-height:0;">' +
            // Left column
            '<div class="court-side" data-court-side="left" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:clamp(3px,0.8vh,6px);padding:clamp(4px,1vh,10px) clamp(4px,1vw,8px);border-radius:14px;background:' + leftBg + ';border:1px solid ' + leftBdr + ';cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;transition:transform 0.15s,opacity 0.15s;">' +
              _buildNameStack(leftTeam) +
              _buildPlate(leftTeam) +
              _buildBtns(leftTeam) +
            '</div>' +
            // Right column
            '<div class="court-side" data-court-side="right" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:clamp(3px,0.8vh,6px);padding:clamp(4px,1vh,10px) clamp(4px,1vw,8px);border-radius:14px;background:' + rightBg + ';border:1px solid ' + rightBdr + ';cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;transition:transform 0.15s,opacity 0.15s;">' +
              _buildNameStack(rightTeam) +
              _buildPlate(rightTeam) +
              _buildBtns(rightTeam) +
            '</div>' +
          '</div>' +
          swapHint +
        '</div>';

      // Attach court-side drag-and-drop (swap sides)
      setTimeout(function() { _setupCourtSwapDrag(); }, 30);
    }

    // Attach serve ball drag-and-drop (change server inline)
    if (_canDragServe) {
      setTimeout(function() { _setupServeBallDrag(); }, 40);
    }

    // Append finish button at bottom
    if (finishBtn) {
      container.insertAdjacentHTML('beforeend', finishBtn);
    }

    // Show persistent tie-break button during Prorrogação (extend mode)
    // Only visible to registered users playing the match — others can't change the tie rule.
    if (state.tieRule === 'extend' && !state.isFinished && !state.isTiebreak && _isViewerInMatch) {
      var cs = _currentSet();
      var isReady = cs.gamesP1 === cs.gamesP2 && cs.gamesP1 >= state.gamesPerSet - 1;
      var tbLabel = isReady
        ? 'Ir para Tie-break (' + cs.gamesP1 + '×' + cs.gamesP2 + ')'
        : 'Tie-break';
      // More prominent when games are tied at or past deuce
      var tbStyle = isReady
        ? 'width:100%;padding:16px;border-radius:14px;font-size:1.05rem;font-weight:800;border:none;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;box-shadow:0 4px 20px rgba(139,92,246,0.45);transition:transform 0.1s;animation:tb-pulse 1.5s ease-in-out infinite;'
        : 'width:100%;padding:12px;border-radius:12px;font-size:0.85rem;font-weight:700;border:2px solid rgba(192,132,252,0.3);cursor:pointer;background:rgba(192,132,252,0.08);color:#c084fc;transition:background 0.2s;';
      container.insertAdjacentHTML('beforeend',
        '<style>@keyframes tb-pulse{0%,100%{box-shadow:0 4px 20px rgba(139,92,246,0.45)}50%{box-shadow:0 4px 30px rgba(139,92,246,0.7),0 0 40px rgba(139,92,246,0.25)}}</style>' +
        '<div style="padding:0 1rem 1rem;flex-shrink:0;">' +
          '<button onclick="window._liveResolveTie(\'tiebreak\')" style="' + tbStyle + '">' +
          '⚡ ' + tbLabel +
        '</button></div>'
      );
    }

    // Sync state to Firestore for real-time collaboration
    _syncLiveState();
  }

  // ── Court side swap drag-and-drop ──
  var _courtDragSide = null;
  var _courtDragGhost = null;

  function _setupCourtSwapDrag() {
    var sides = document.querySelectorAll('.court-side');
    if (sides.length < 2) return;

    sides.forEach(function(side) {
      // Desktop drag
      side.addEventListener('dragstart', function(e) {
        _courtDragSide = side.getAttribute('data-court-side');
        side.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      side.addEventListener('dragend', function() {
        side.style.opacity = '1';
        _courtDragSide = null;
        sides.forEach(function(s) { s.style.transform = ''; });
      });
      side.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (!_courtDragSide) return;
        var targetSide = side.getAttribute('data-court-side');
        if (targetSide !== _courtDragSide) side.style.transform = 'scale(1.02)';
      });
      side.addEventListener('dragleave', function() { side.style.transform = ''; });
      side.addEventListener('drop', function(e) {
        e.preventDefault();
        side.style.transform = '';
        if (!_courtDragSide) return;
        var targetSide = side.getAttribute('data-court-side');
        if (targetSide !== _courtDragSide) {
          _courtDragSide = null;
          _courtLeft = _courtLeft === 1 ? 2 : 1;
          _render();
        }
      });

      // Touch drag
      var _touchSide = null;
      side.addEventListener('touchstart', function(e) {
        _touchSide = side.getAttribute('data-court-side');
        side.style.opacity = '0.6';
      }, { passive: true });
      side.addEventListener('touchmove', function(e) {
        if (!_touchSide) return;
        e.preventDefault();
        if (!_courtDragGhost) {
          _courtDragGhost = document.createElement('div');
          _courtDragGhost.style.cssText = 'position:fixed;z-index:200000;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.4);pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:white;';
          _courtDragGhost.textContent = '⇄';
          document.body.appendChild(_courtDragGhost);
        }
        var t = e.touches[0];
        _courtDragGhost.style.left = (t.clientX - 30) + 'px';
        _courtDragGhost.style.top = (t.clientY - 30) + 'px';
      }, { passive: false });
      side.addEventListener('touchend', function(e) {
        side.style.opacity = '1';
        if (_courtDragGhost) { _courtDragGhost.remove(); _courtDragGhost = null; }
        if (!_touchSide) return;
        var t = e.changedTouches[0];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var target = el;
        while (target) {
          if (target.classList && target.classList.contains('court-side')) {
            if (target.getAttribute('data-court-side') !== _touchSide) {
              _touchSide = null;
              _courtLeft = _courtLeft === 1 ? 2 : 1;
              _render();
              return;
            }
            break;
          }
          target = target.parentElement;
        }
        _touchSide = null;
      });
    });
  }

  // ── Serve ball drag-and-drop (inline server change) ──
  var _serveBallDragging = false;
  var _serveBallGhost = null;

  function _setupServeBallDrag() {
    var ball = document.querySelector('[data-serve-ball]');
    if (!ball) return;
    var drops = document.querySelectorAll('[data-serve-drop]');

    // Desktop drag from ball
    ball.addEventListener('dragstart', function(e) {
      _serveBallDragging = true;
      e.dataTransfer.effectAllowed = 'move';
      // Highlight valid drop targets
      drops.forEach(function(d) {
        var parts = d.getAttribute('data-serve-drop').split('-');
        var dropTeam = parseInt(parts[0]);
        var canDrop = (state.totalGamesPlayed === 0) || (state.totalGamesPlayed === 1 && state.serveOrder.length > 1 && dropTeam === state.serveOrder[1].team);
        if (canDrop) d.style.background = 'rgba(255,200,0,0.15)';
      });
    });
    ball.addEventListener('dragend', function() {
      _serveBallDragging = false;
      drops.forEach(function(d) { d.style.background = ''; d.style.transform = ''; });
    });

    // Drop targets
    drops.forEach(function(drop) {
      drop.addEventListener('dragover', function(e) {
        if (!_serveBallDragging) return;
        e.preventDefault();
        drop.style.transform = 'scale(1.05)';
      });
      drop.addEventListener('dragleave', function() { drop.style.transform = ''; });
      drop.addEventListener('drop', function(e) {
        e.preventDefault();
        drop.style.transform = '';
        if (!_serveBallDragging) return;
        _serveBallDragging = false;
        var parts = drop.getAttribute('data-serve-drop').split('-');
        var dropTeam = parseInt(parts[0]);
        var dropIdx = parseInt(parts[1]);
        // HARD LOCK after 2 games
        if (state.totalGamesPlayed >= 2) return;
        // Validate: game 0 = any, game 1 = other team only (team that started is locked)
        if (state.totalGamesPlayed === 1 && state.serveOrder.length > 1 && dropTeam !== state.serveOrder[1].team) return;
        window._liveSetServer(dropTeam, dropIdx);
      });
    });

    // Touch drag from ball
    var _ballTouch = false;
    ball.addEventListener('touchstart', function(e) {
      _ballTouch = true;
      e.preventDefault();
    }, { passive: false });
    ball.addEventListener('touchmove', function(e) {
      if (!_ballTouch) return;
      e.preventDefault();
      if (!_serveBallGhost) {
        _serveBallGhost = document.createElement('div');
        _serveBallGhost.style.cssText = 'position:fixed;z-index:200000;font-size:1.5rem;pointer-events:none;filter:drop-shadow(0 0 8px rgba(255,200,0,0.8));';
        _serveBallGhost.textContent = _sportBall;
        document.body.appendChild(_serveBallGhost);
      }
      var t = e.touches[0];
      _serveBallGhost.style.left = (t.clientX - 15) + 'px';
      _serveBallGhost.style.top = (t.clientY - 15) + 'px';
      // Highlight drop target under finger
      drops.forEach(function(d) { d.style.transform = ''; d.style.background = ''; });
      var el = document.elementFromPoint(t.clientX, t.clientY);
      var target = el;
      while (target) {
        if (target.dataset && target.dataset.serveDrop !== undefined) {
          target.style.transform = 'scale(1.05)';
          target.style.background = 'rgba(255,200,0,0.15)';
          break;
        }
        target = target.parentElement;
      }
    }, { passive: false });
    ball.addEventListener('touchend', function(e) {
      if (_serveBallGhost) { _serveBallGhost.remove(); _serveBallGhost = null; }
      drops.forEach(function(d) { d.style.transform = ''; d.style.background = ''; });
      if (!_ballTouch) return;
      _ballTouch = false;
      var t = e.changedTouches[0];
      var el = document.elementFromPoint(t.clientX, t.clientY);
      var target = el;
      while (target) {
        if (target.dataset && target.dataset.serveDrop !== undefined) {
          var parts = target.dataset.serveDrop.split('-');
          var dropTeam = parseInt(parts[0]);
          var dropIdx = parseInt(parts[1]);
          // HARD LOCK after 2 games
          if (state.totalGamesPlayed >= 2) break;
          if (state.totalGamesPlayed === 1 && state.serveOrder.length > 1 && dropTeam !== state.serveOrder[1].team) break;
          window._liveSetServer(dropTeam, dropIdx);
          return;
        }
        target = target.parentElement;
      }
    });
  }

  // ── Edit player name inline ──
  window._liveEditName = function(team, playerIdx) {
    var players = team === 1 ? p1Players : p2Players;
    var current = players[playerIdx] || '';
    showInputDialog(
      'Editar nome',
      'Nome do jogador:',
      current,
      function(newName) {
        newName = (newName || '').trim();
        if (!newName) return;
        // Transfer avatar metadata to new name
        if (_playerMeta[current]) {
          _playerMeta[newName] = _playerMeta[current];
          if (current !== newName) delete _playerMeta[current];
        }
        players[playerIdx] = newName;
        // Also update serveOrder if this player is there
        for (var i = 0; i < state.serveOrder.length; i++) {
          if (state.serveOrder[i].team === team && state.serveOrder[i].name === current) {
            state.serveOrder[i].name = newName;
          }
        }
        _render();
      }
    );
  };

  // ── Firestore real-time sync for casual matches ──
  var _casualDocId = isCasual && opts ? opts.casualDocId : null;
  var _syncTimer = null;
  var _isRemoteUpdate = false; // true when receiving from Firestore
  var _unsubFirestore = null;

  // Serialize state for Firestore
  function _serializeState() {
    return {
      sets: JSON.parse(JSON.stringify(state.sets)),
      currentGameP1: state.currentGameP1,
      currentGameP2: state.currentGameP2,
      isTiebreak: state.isTiebreak,
      isFinished: state.isFinished,
      winner: state.winner,
      tieRulePending: state.tieRulePending,
      totalGamesPlayed: state.totalGamesPlayed,
      serveOrder: state.serveOrder.map(function(s) { return { team: s.team, name: s.name }; }),
      serveSkipped: state.serveSkipped,
      gameLog: Array.isArray(state.gameLog) ? state.gameLog.slice() : [],
      pointLog: Array.isArray(state.pointLog) ? state.pointLog.slice() : [],
      tieRule: state.tieRule,
      courtLeft: _courtLeft,
      p1Players: p1Players.slice(),
      p2Players: p2Players.slice(),
      matchStartTime: _matchStartTime,
      matchEndTime: state.isFinished ? (_matchEndTime || Date.now()) : null,
      _ts: Date.now() // timestamp for conflict resolution
    };
  }

  // Apply remote state from Firestore
  function _applyRemoteState(remote) {
    if (!remote || !remote._ts) return;
    state.sets = remote.sets || state.sets;
    state.currentGameP1 = remote.currentGameP1 != null ? remote.currentGameP1 : state.currentGameP1;
    state.currentGameP2 = remote.currentGameP2 != null ? remote.currentGameP2 : state.currentGameP2;
    state.isTiebreak = !!remote.isTiebreak;
    state.isFinished = !!remote.isFinished;
    state.winner = remote.winner != null ? remote.winner : state.winner;
    state.tieRulePending = !!remote.tieRulePending;
    state.totalGamesPlayed = remote.totalGamesPlayed || 0;
    state.tieRule = remote.tieRule || state.tieRule;
    if (Array.isArray(remote.serveOrder) && remote.serveOrder.length > 0) {
      state.serveOrder = remote.serveOrder;
    }
    state.serveSkipped = !!remote.serveSkipped;
    if (Array.isArray(remote.gameLog)) state.gameLog = remote.gameLog.slice();
    if (Array.isArray(remote.pointLog)) state.pointLog = remote.pointLog.slice();
    if (remote.courtLeft) _courtLeft = remote.courtLeft;
    if (remote.matchStartTime) _matchStartTime = remote.matchStartTime;
    if (remote.matchEndTime) _matchEndTime = remote.matchEndTime;
    // Update player names if changed remotely
    if (Array.isArray(remote.p1Players)) {
      for (var i = 0; i < remote.p1Players.length && i < p1Players.length; i++) p1Players[i] = remote.p1Players[i];
    }
    if (Array.isArray(remote.p2Players)) {
      for (var j = 0; j < remote.p2Players.length && j < p2Players.length; j++) p2Players[j] = remote.p2Players[j];
    }
  }

  // Sync local state to Firestore (debounced 300ms)
  function _syncLiveState() {
    if (!_casualDocId || !window.FirestoreDB || !window.FirestoreDB.db) return;
    if (_isRemoteUpdate) return; // Don't echo back remote updates
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function() {
      window.FirestoreDB.updateCasualMatch(_casualDocId, { liveState: _serializeState() });
    }, 300);
  }

  // Listen for Firestore changes (real-time)
  function _startFirestoreListener() {
    if (!_casualDocId || !window.FirestoreDB || !window.FirestoreDB.db) return;
    try {
      _unsubFirestore = window.FirestoreDB.db.collection('casualMatches').doc(_casualDocId)
        .onSnapshot(function(doc) {
          if (!doc.exists) return;
          var data = doc.data();
          if (!data.liveState || !data.liveState._ts) return;
          // Only apply if remote timestamp is newer than ours
          var localTs = _lastSyncTs || 0;
          if (data.liveState._ts > localTs) {
            _isRemoteUpdate = true;
            _applyRemoteState(data.liveState);
            _lastSyncTs = data.liveState._ts;
            _render();
            _isRemoteUpdate = false;
          }
        });
    } catch(e) {
      console.warn('[LiveScore] Firestore listener error:', e);
    }
  }
  var _lastSyncTs = 0;

  // Start listener if we have a casual doc
  if (_casualDocId) {
    _startFirestoreListener();
  }

  // ── Global handlers (attached to window for onclick access) ──
  window._liveScorePoint = function(player) { _addPoint(player); };
  window._liveScoreSave = _saveResult;
  window._liveScoreFinish = function() {
    // For simple scoring: finish and set winner
    if (state.currentGameP1 === state.currentGameP2 && state.currentGameP1 === 0) {
      showNotification(_t('bui.emptyScore'), _t('bui.emptyScoreMsg'), 'warning');
      return;
    }
    state.isFinished = true;
    if (state.currentGameP1 > state.currentGameP2) state.winner = 1;
    else if (state.currentGameP2 > state.currentGameP1) state.winner = 2;
    else state.winner = 0; // draw
    _render();
  };

  // Minus handler: subtract a point (correction)
  window._liveScoreMinus = function(player) {
    if (state.isFinished) return;
    if (state.tieRulePending) return;
    if (player === 1) {
      if (state.currentGameP1 > 0) state.currentGameP1--;
    } else {
      if (state.currentGameP2 > 0) state.currentGameP2--;
    }
    // For fixed set, sync back to the set object
    if (state.isFixedSet) {
      var cs = _currentSet();
      cs.gamesP1 = state.currentGameP1;
      cs.gamesP2 = state.currentGameP2;
    }
    _render();
  };

  // Reset handler: zero all points, restart from scratch — always available
  window._liveScoreReset = function() {
    showConfirmDialog(
      'Reiniciar contagem?',
      'Deseja reiniciar a contagem? Todos os pontos marcados serão zerados.',
      function() {
        state.sets = [{ gamesP1: 0, gamesP2: 0, tiebreak: null }];
        state.currentGameP1 = 0;
        state.currentGameP2 = 0;
        state.isTiebreak = false;
        state.isFinished = false;
        state.winner = null;
        state.tieRulePending = false;
        state.totalGamesPlayed = 0;
        state.serveOrder = [];
        state.serveSkipped = false;
        state.servePending = false;
        state.gameLog = [];
        state.pointLog = [];
        // Reset tieRule to original value from scoring config
        state.tieRule = sc.tieRule || null;
        _matchStartTime = null;
        _matchEndTime = null;
        _render();
      }
    );
  };

  // Restart handler: reset score and optionally re-shuffle teams
  window._liveScoreRestart = function() {
    var shuffleChk = document.getElementById('chk-shuffle-teams');
    var shouldShuffle = shuffleChk && shuffleChk.checked;
    showConfirmDialog(
      'Recomeçar partida?',
      shouldShuffle ? 'As duplas serão re-sorteadas e a contagem zerada.' : 'A contagem será zerada e uma nova partida começará.',
      function() {
        // Shuffle teams if requested
        if (shouldShuffle && isDoubles) {
          var allPlayers = p1Players.concat(p2Players);
          // Fisher-Yates shuffle
          for (var fi = allPlayers.length - 1; fi > 0; fi--) {
            var fj = Math.floor(Math.random() * (fi + 1));
            var tmp = allPlayers[fi]; allPlayers[fi] = allPlayers[fj]; allPlayers[fj] = tmp;
          }
          // Split into two teams
          var half = Math.ceil(allPlayers.length / 2);
          p1Players.length = 0; p2Players.length = 0;
          for (var si = 0; si < allPlayers.length; si++) {
            if (si < half) p1Players.push(allPlayers[si]);
            else p2Players.push(allPlayers[si]);
          }
        }
        // Reset state
        state.sets = [{ gamesP1: 0, gamesP2: 0, tiebreak: null }];
        state.currentGameP1 = 0;
        state.currentGameP2 = 0;
        state.isTiebreak = false;
        state.isFinished = false;
        state.winner = null;
        state.tieRulePending = false;
        state.totalGamesPlayed = 0;
        state.serveOrder = [];
        state.serveSkipped = false;
        state.servePending = false;
        state.gameLog = [];
        state.pointLog = [];
        state.tieRule = sc.tieRule || null;
        _matchStartTime = null;
        _matchEndTime = null;
        _courtLeft = 1;
        _render();
      }
    );
  };

  // ── Build overlay ──
  // Use dynamic viewport (100dvh) so mobile browsers' shrinking/expanding URL
  // bar never crops the pinned bottom action buttons.
  var overlay = document.createElement('div');
  overlay.id = 'live-scoring-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;background:#0a0e1a;z-index:100002;display:flex;flex-direction:column;overflow:hidden;touch-action:manipulation;';

  // Header — 3-column: [AO VIVO + info] [Sets display center] [Reset + Close]
  var headerBg = 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)';
  var matchLabel = isCasual ? (opts.sportName || 'Partida Casual') : (m.roundIndex !== undefined ? 'Rodada ' + (m.roundIndex + 1) : (m.round || ''));
  var headerHtml = '<div style="background:' + headerBg + ';padding:10px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;gap:4px;">' +
    // Left: AO VIVO + match info
    '<div style="display:flex;align-items:center;gap:6px;flex:0 0 auto;min-width:0;">' +
      '<span style="font-size:1rem;">📡</span>' +
      '<div style="min-width:0;">' +
        '<div style="font-size:0.78rem;font-weight:800;color:#f87171;">AO VIVO</div>' +
        '<div style="font-size:0.6rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(isCasual ? casualTitle : (t && t.name || matchLabel)) + '</div>' +
      '</div>' +
    '</div>' +
    // Spacer
    '<div style="flex:1;"></div>' +
    // Right: Reset + Close
    '<div style="display:flex;gap:6px;align-items:center;flex:0 0 auto;">' +
      '<button onclick="window._liveScoreReset()" style="background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;border-radius:8px;padding:6px 10px;font-size:0.7rem;font-weight:600;cursor:pointer;">↺ Resetar</button>' +
      '<button onclick="window._closeLiveScoring()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:6px 10px;font-size:0.7rem;font-weight:600;cursor:pointer;">✕ Fechar</button>' +
    '</div>' +
  '</div>';

  // Content area (no info bar — sets are in header now)
  overlay.innerHTML = headerHtml +
    '<div id="live-score-content" style="flex:1;overflow:hidden;padding:0.5rem 0.5rem;display:flex;flex-direction:column;justify-content:center;"></div>';

  document.body.appendChild(overlay);

  // Close handler — always confirms before leaving
  window._closeLiveScoring = function() {
    var _cleanup = function() {
      if (_unsubFirestore) { try { _unsubFirestore(); } catch(e) {} _unsubFirestore = null; }
      window.removeEventListener('resize', _onResize);
      var ov = document.getElementById('live-scoring-overlay');
      if (ov) ov.remove();
    };
    var _msg = isCasual
      ? 'Deseja abandonar a partida casual? Sua vaga ficará livre para outro jogador.'
      : 'Deseja fechar o placar ao vivo?';
    showConfirmDialog(
      'Abandonar partida?',
      _msg,
      function() {
        // Free the slot in the casual match so someone else can take it
        var cu = window.AppStore && window.AppStore.currentUser;
        if (isCasual && cu && cu.uid && _casualDocId && window.FirestoreDB && typeof window.FirestoreDB.leaveCasualMatch === 'function') {
          try {
            var leavePromise = window.FirestoreDB.leaveCasualMatch(_casualDocId, cu.uid);
            if (leavePromise && typeof leavePromise.catch === 'function') leavePromise.catch(function(){});
          } catch(e) {}
        }
        _cleanup();
        // Navigate the user back to the dashboard so they're not stuck
        // on the setup/join screen of a match they just abandoned.
        if (isCasual) {
          try { window.location.hash = '#dashboard'; } catch(e) {}
        }
      }
    );
  };

  // Re-render on orientation/resize change for landscape layout
  var _resizeTimer = null;
  var _onResize = function() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function() {
      if (document.getElementById('live-scoring-overlay')) _render();
    }, 150);
  };
  window.addEventListener('resize', _onResize);

  // Initial render
  _render();
};

// ─── Scan QR Code / Enter Room Code ─────────────────────────────────────────
// Opens from dashboard "Escanear QR" button. Camera-based scanner with
// manual code input fallback.

window._openScanQR = function() {
  var existing = document.getElementById('scan-qr-overlay');
  if (existing) existing.remove();

  var ov = document.createElement('div');
  ov.id = 'scan-qr-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0e1a;z-index:100003;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;box-sizing:border-box;';

  var _scanStream = null;
  var _scanInterval = null;
  var _scanFound = false;

  function _cleanupScanner() {
    if (_scanInterval) { clearInterval(_scanInterval); _scanInterval = null; }
    if (_scanStream) { _scanStream.getTracks().forEach(function(t) { t.stop(); }); _scanStream = null; }
  }

  function _closeOverlay() {
    _cleanupScanner();
    var o = document.getElementById('scan-qr-overlay');
    if (o) o.remove();
  }

  function _navigateToRoom(code) {
    if (_scanFound) return;
    _scanFound = true;
    _cleanupScanner();
    var o = document.getElementById('scan-qr-overlay');
    if (o) o.remove();
    window.location.hash = '#casual/' + code.toUpperCase();
  }

  // Try extracting room code from URL or raw code
  function _extractRoomCode(text) {
    text = (text || '').trim();
    var urlMatch = text.match(/#casual\/([A-Za-z0-9]{4,8})/);
    if (urlMatch) return urlMatch[1].toUpperCase();
    var plain = text.replace(/[^A-Za-z0-9]/g, '');
    if (plain.length >= 4 && plain.length <= 8) return plain.toUpperCase();
    return null;
  }

  // Build UI
  ov.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;max-width:420px;width:100%;">' +
      '<div style="font-size:1.4rem;font-weight:800;color:#a855f7;margin-bottom:4px;">📷 Escanear QR Code</div>' +
      '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:clamp(1rem,3vh,1.5rem);">Aponte a câmera para o QR code ou digite o código da sala</div>' +

      // Camera viewfinder
      '<div id="scan-qr-camera-box" style="position:relative;width:min(80vw,300px);aspect-ratio:1;margin-bottom:clamp(0.8rem,2vh,1.2rem);border-radius:16px;overflow:hidden;background:#111;border:2px solid rgba(168,85,247,0.3);">' +
        '<video id="scan-qr-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none;"></video>' +
        '<canvas id="scan-qr-canvas" style="display:none;"></canvas>' +
        '<div id="scan-qr-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;">' +
          '<div style="font-size:2.5rem;">📷</div>' +
          '<div style="font-size:0.78rem;color:var(--text-muted);">Iniciando câmera...</div>' +
        '</div>' +
        '<div style="position:absolute;top:12px;left:12px;width:24px;height:24px;border-top:3px solid #a855f7;border-left:3px solid #a855f7;border-radius:4px 0 0 0;"></div>' +
        '<div style="position:absolute;top:12px;right:12px;width:24px;height:24px;border-top:3px solid #a855f7;border-right:3px solid #a855f7;border-radius:0 4px 0 0;"></div>' +
        '<div style="position:absolute;bottom:12px;left:12px;width:24px;height:24px;border-bottom:3px solid #a855f7;border-left:3px solid #a855f7;border-radius:0 0 0 4px;"></div>' +
        '<div style="position:absolute;bottom:12px;right:12px;width:24px;height:24px;border-bottom:3px solid #a855f7;border-right:3px solid #a855f7;border-radius:0 0 4px 0;"></div>' +
      '</div>' +

      // Divider
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:clamp(0.6rem,2vh,1rem);width:min(80vw,300px);">' +
        '<div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div>' +
        '<span style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">OU DIGITE O CÓDIGO</span>' +
        '<div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div>' +
      '</div>' +

      // Manual code input
      '<div style="display:flex;gap:8px;width:min(80vw,300px);margin-bottom:clamp(0.8rem,2vh,1.2rem);">' +
        '<input type="text" id="scan-qr-code-input" placeholder="Ex: ABC123" maxlength="8" style="flex:1;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.06);border:2px solid rgba(168,85,247,0.25);color:var(--text-bright);font-size:1.2rem;font-weight:800;letter-spacing:4px;text-align:center;text-transform:uppercase;outline:none;font-family:monospace;" onfocus="this.style.borderColor=\'rgba(168,85,247,0.6)\'" onblur="this.style.borderColor=\'rgba(168,85,247,0.25)\'" />' +
        '<button id="scan-qr-go-btn" style="padding:14px 20px;border-radius:12px;background:linear-gradient(135deg,#a855f7,#7c3aed);border:none;color:white;font-size:1rem;font-weight:700;cursor:pointer;flex-shrink:0;">Entrar</button>' +
      '</div>' +

      // Back button
      '<button id="scan-qr-close-btn" style="padding:12px 28px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);font-size:0.88rem;font-weight:600;cursor:pointer;">← Voltar</button>' +
    '</div>';

  document.body.appendChild(ov);

  // Wire up close
  document.getElementById('scan-qr-close-btn').onclick = _closeOverlay;

  // Wire up manual entry
  var goBtn = document.getElementById('scan-qr-go-btn');
  var codeInput = document.getElementById('scan-qr-code-input');
  function _tryManualCode() {
    var code = _extractRoomCode(codeInput.value);
    if (code) {
      _navigateToRoom(code);
    } else {
      codeInput.style.borderColor = '#ef4444';
      setTimeout(function() { codeInput.style.borderColor = 'rgba(168,85,247,0.25)'; }, 1000);
    }
  }
  goBtn.onclick = _tryManualCode;
  codeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') _tryManualCode();
  });

  // Start camera scanner — uses jsQR library (works on all browsers)
  // or BarcodeDetector as primary, with jsQR fallback
  var video = document.getElementById('scan-qr-video');
  var canvas = document.getElementById('scan-qr-canvas');
  var placeholder = document.getElementById('scan-qr-placeholder');
  var hasBarcodeAPI = typeof window.BarcodeDetector !== 'undefined';

  function _startScanning(decodeMethod) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function(stream) {
      _scanStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      placeholder.style.display = 'none';

      var ctx = canvas.getContext('2d');
      _scanInterval = setInterval(function() {
        if (_scanFound || !video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        decodeMethod(canvas, ctx);
      }, 300);
    }).catch(function(err) {
      console.warn('Camera access denied:', err);
      placeholder.innerHTML =
        '<div style="font-size:2rem;">🚫</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);padding:0 1rem;">Câmera não disponível.<br>Digite o código da sala abaixo.</div>';
    });
  }

  function _onDetected(rawValue) {
    if (_scanFound) return;
    var code = _extractRoomCode(rawValue);
    if (code) {
      if (typeof showNotification === 'function') showNotification(_t('bui.qrDetected'), _t('bui.qrDetectedMsg', {code: code}), 'success');
      _navigateToRoom(code);
    }
  }

  if (hasBarcodeAPI) {
    // Use native BarcodeDetector (Chrome Android, etc.)
    var detector = new BarcodeDetector({ formats: ['qr_code'] });
    _startScanning(function(cvs) {
      detector.detect(cvs).then(function(barcodes) {
        if (barcodes && barcodes.length > 0) _onDetected(barcodes[0].rawValue);
      }).catch(function() {});
    });
  } else if (window.jsQR) {
    // jsQR already loaded
    _startScanning(function(cvs, ctx) {
      var imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      var qr = window.jsQR(imageData.data, cvs.width, cvs.height, { inversionAttempts: 'dontInvert' });
      if (qr && qr.data) _onDetected(qr.data);
    });
  } else {
    // Load jsQR from CDN then start
    placeholder.innerHTML =
      '<div style="font-size:2.5rem;">📷</div>' +
      '<div style="font-size:0.78rem;color:var(--text-muted);">Carregando scanner...</div>';
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = function() {
      _startScanning(function(cvs, ctx) {
        var imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
        var qr = window.jsQR(imageData.data, cvs.width, cvs.height, { inversionAttempts: 'dontInvert' });
        if (qr && qr.data) _onDetected(qr.data);
      });
    };
    script.onerror = function() {
      // jsQR failed to load and no BarcodeDetector — manual only
      placeholder.innerHTML =
        '<div style="font-size:2rem;">⌨️</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);padding:0 1rem;">Scanner indisponível.<br>Digite o código da sala abaixo.</div>';
    };
    document.head.appendChild(script);
  }
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
    userSport = cu.preferredSports.split(',')[0].trim();
  }

  // Available sports
  var sports = [
    { key: 'Beach Tennis', icon: '🎾', label: 'Beach Tennis', defaultDoubles: true },
    { key: 'Pickleball', icon: '🥒', label: 'Pickleball', defaultDoubles: false },
    { key: 'Tênis', icon: '🎾', label: 'Tênis', defaultDoubles: false },
    { key: 'Tênis de Mesa', icon: '🏓', label: 'Tênis de Mesa', defaultDoubles: false },
    { key: 'Padel', icon: '🏸', label: 'Padel', defaultDoubles: true },
    { key: '_simple', icon: '🏅', label: 'Placar Simples', defaultDoubles: false }
  ];

  // Resolve initial sport
  var initialSport = '_simple';
  for (var si = 0; si < sports.length; si++) {
    if (userSport && userSport.toLowerCase().indexOf(sports[si].key.toLowerCase()) !== -1) {
      initialSport = sports[si].key; break;
    }
    if (userSport && sports[si].key.toLowerCase().indexOf(userSport.toLowerCase().replace(/[^\w\u00C0-\u024F]/gu, '')) !== -1) {
      initialSport = sports[si].key; break;
    }
  }

  // State — default to doubles ON, sortear ON, misto OFF
  var selectedSport = initialSport;
  var spMatch = sports.find(function(s) { return s.key === initialSport; });
  var isDoubles = spMatch ? spMatch.defaultDoubles : true;
  var autoShuffle = false;
  var isMisto = false;
  var p1Name = (cu && cu.displayName) ? cu.displayName : '';
  var _lobbyParticipants = cu ? [{ uid: cu.uid, displayName: cu.displayName || '', photoURL: cu.photoURL || '', joinedAt: new Date().toISOString() }] : [];
  var _setupRefreshInterval = null;
  // Team assignments for drag-and-drop (keyed by card index 0-3): { idx: 1 or 2 }
  // When empty, no teams formed yet. When set, idx→1 = Team 1 (blue), idx→2 = Team 2 (red).
  var _teamAssignments = {};

  // Casual default config per sport (overrides _sportScoringDefaults for casual)
  var _casualDefaults = {
    'Beach Tennis':  { type:'sets', setsToWin:1, gamesPerSet:6, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'tennis', advantageRule:false, tieRule:'ask' },
    'Pickleball':    { type:'sets', setsToWin:1, gamesPerSet:11, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'numeric', advantageRule:false, tieRule:'extend' },
    'Tênis':         { type:'sets', setsToWin:2, gamesPerSet:6, tiebreakEnabled:true, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:true, superTiebreakPoints:10, countingType:'tennis', advantageRule:true, tieRule:'tiebreak' },
    'Tênis de Mesa': { type:'sets', setsToWin:3, gamesPerSet:11, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'numeric', advantageRule:false, tieRule:'extend' },
    'Padel':         { type:'sets', setsToWin:2, gamesPerSet:6, tiebreakEnabled:true, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:true, superTiebreakPoints:10, countingType:'tennis', advantageRule:false, tieRule:'tiebreak' }
  };

  function _getConfig() {
    if (selectedSport === '_simple') return { type: 'simple' };
    try {
      var prefs = JSON.parse(localStorage.getItem('scoreplace_casual_prefs') || '{}');
      if (prefs[selectedSport]) return prefs[selectedSport];
    } catch(e) {}
    return _casualDefaults[selectedSport] || { type:'sets', setsToWin:1, gamesPerSet:6, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'tennis', advantageRule:false, tieRule:'ask' };
  }

  var _tieRuleLabels = { 'ask': 'Perguntar no jogo', 'extend': 'Prorrogar (vantagem de 2)', 'tiebreak': 'Tie-break 7pts', 'supertiebreak': 'Super tie-break 10pts' };

  function _configSummary() {
    var cfg = _getConfig();
    if (!cfg.type || cfg.type !== 'sets') return 'Placar livre (sem sets/games)';
    var parts = [];
    parts.push(cfg.setsToWin + ' set' + (cfg.setsToWin > 1 ? 's' : ''));
    parts.push(cfg.gamesPerSet + ' games');
    if (cfg.countingType === 'tennis') parts.push('15-30-40');
    else parts.push('1-2-3');
    if (cfg.advantageRule) parts.push('AD');
    var tr = cfg.tieRule || 'ask';
    parts.push('Empate: ' + (_tieRuleLabels[tr] || tr));
    return parts.join(' · ');
  }

  // Build avatar HTML for a participant (photo or initial fallback)
  function _avatarHtml(pp, size) {
    var sz = size || 32;
    if (pp.photoURL) {
      return '<img src="' + window._safeHtml(pp.photoURL) + '" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,0.15);" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
        '<div style="display:none;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);align-items:center;justify-content:center;font-size:' + (sz * 0.45) + 'px;color:white;font-weight:700;flex-shrink:0;">' + window._safeHtml((pp.displayName || 'J')[0].toUpperCase()) + '</div>';
    }
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:' + (sz * 0.45) + 'px;color:white;font-weight:700;flex-shrink:0;">' + window._safeHtml((pp.displayName || 'J')[0].toUpperCase()) + '</div>';
  }

  // Build lobby HTML showing participants who joined
  function _buildLobbyHtml() {
    var totalNeeded = isDoubles ? 4 : 2;
    var count = _lobbyParticipants.length;
    var myUid = cu ? cu.uid : null;
    if (count <= 1) return ''; // Only the creator — nothing to show yet

    var h = '<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:12px;padding:10px 12px;">' +
      '<div style="font-size:0.72rem;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;animation:casualPulse 1.5s ease-in-out infinite;"></span>' +
        _t('casual.inRoom', {count: count, total: totalNeeded}) +
      '</div>' +
      '<style>@keyframes casualPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}</style>';
    for (var i = 0; i < _lobbyParticipants.length; i++) {
      var pp = _lobbyParticipants[i];
      var isMe = myUid && pp.uid === myUid;
      var isHost = pp.uid === (cu ? cu.uid : '');
      h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;margin-bottom:3px;' +
        'background:' + (isMe ? 'rgba(34,197,94,0.06)' : 'transparent') + ';">' +
        _avatarHtml(pp, 28) +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--text-bright);flex:1;">' + window._safeHtml(pp.displayName || _t('casual.playerFallback')) +
          (isHost ? ' <span style="font-size:0.65rem;color:#fbbf24;">👑</span>' : '') +
          (isMe ? ' <span style="font-size:0.62rem;color:#22c55e;">(' + _t('casual.you') + ')</span>' : '') +
        '</div>' +
        '<span style="font-size:0.75rem;">✅</span>' +
      '</div>';
    }
    h += '</div>';
    return h;
  }

  // Update only the lobby section without re-rendering the whole setup (preserves input values)
  function _updateLobbySection() {
    var section = document.getElementById('casual-lobby-section');
    if (section) section.innerHTML = _buildLobbyHtml();
    // Also fill empty player inputs with lobby participant names
    _fillInputsFromLobby();
  }

  // Fill player name inputs with lobby participants' displayNames
  function _fillInputsFromLobby() {
    if (_lobbyParticipants.length <= 1) return;
    var names = _lobbyParticipants.map(function(p) { return p.displayName || ''; }).filter(function(n) { return !!n; });
    if (isDoubles) {
      var inputs = [
        document.getElementById('casual-p1a-name'),
        document.getElementById('casual-p1b-name'),
        document.getElementById('casual-p2a-name'),
        document.getElementById('casual-p2b-name')
      ];
      for (var i = 0; i < inputs.length && i < names.length; i++) {
        if (inputs[i] && (!inputs[i].value || inputs[i].value === inputs[i].placeholder)) {
          inputs[i].value = names[i];
        }
      }
    } else {
      var inp1 = document.getElementById('casual-p1-name');
      var inp2 = document.getElementById('casual-p2-name');
      if (inp1 && names[0] && (!inp1.value || inp1.value === inp1.placeholder)) inp1.value = names[0];
      if (inp2 && names[1] && (!inp2.value || inp2.value === inp2.placeholder)) inp2.value = names[1];
    }
  }

  function _renderSetup() {
    var content = document.getElementById('casual-setup-content');
    if (!content) return;

    // Sport label for config summary
    var sportIcon = '';
    var sportLabel = selectedSport;
    for (var si = 0; si < sports.length; si++) {
      if (sports[si].key === selectedSport) { sportIcon = sports[si].icon; sportLabel = sports[si].label; break; }
    }

    // Toggles: Sortear + Misto (only for doubles)
    var togglesHtml = '';
    if (isDoubles) {
      togglesHtml =
        '<div style="margin-bottom:0.8rem;display:flex;flex-direction:column;gap:6px;">' +
          // Sortear toggle
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:12px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.12);">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="font-size:1rem;">🔀</span>' +
              '<div>' +
                '<span style="font-size:0.85rem;font-weight:700;color:var(--text-bright);">' + _t('casual.shuffleTeams') + '</span>' +
                '<div style="font-size:0.65rem;color:var(--text-muted);">' + _t('casual.shuffleSubtitle') + '</div>' +
              '</div>' +
            '</div>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#fbbf24;"><input type="checkbox" ' + (autoShuffle ? 'checked' : '') + ' onchange="window._casualSetShuffle(this.checked)"><span class="toggle-slider"></span></label>' +
          '</div>' +
          // Misto toggle
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:12px;background:rgba(192,132,252,0.05);border:1px solid rgba(192,132,252,0.12);">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="font-size:1rem;">⚤</span>' +
              '<div>' +
                '<span style="font-size:0.85rem;font-weight:700;color:var(--text-bright);">' + _t('casual.mixed') + '</span>' +
                '<div style="font-size:0.65rem;color:var(--text-muted);">' + _t('casual.mixedSubtitle') + '</div>' +
              '</div>' +
            '</div>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#c084fc;"><input type="checkbox" ' + (isMisto ? 'checked' : '') + ' onchange="window._casualSetMisto(this.checked)"><span class="toggle-slider"></span></label>' +
          '</div>' +
        '</div>';
    }

    // Player names — same 4-card grid for both Sortear ON and OFF
    var playersHtml = '';
    if (isDoubles) {
      // Build avatar helper for input cards
      function _inputAvatar(idx) {
        // idx 0 = current user, others = lobby participants if available
        var pp = null;
        if (idx === 0 && cu) pp = { displayName: cu.displayName, photoURL: cu.photoURL };
        else if (idx < _lobbyParticipants.length) pp = _lobbyParticipants[idx];
        if (!pp || (!pp.photoURL && !pp.displayName)) return '';
        if (pp.photoURL) {
          return '<img src="' + window._safeHtml(pp.photoURL) + '" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.15);" onerror="this.style.display=\'none\'">';
        }
        return '<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:700;flex-shrink:0;">' + window._safeHtml((pp.displayName || 'J')[0].toUpperCase()) + '</div>';
      }

      // Check if teams are formed (Sortear OFF drag-and-drop)
      var _teamsFormed = !autoShuffle && _teamAssignments[0] !== undefined && _teamAssignments[1] !== undefined && _teamAssignments[2] !== undefined && _teamAssignments[3] !== undefined;

      var _inputStyle = 'flex:1;padding:0;border:none;background:transparent;font-size:0.82rem;font-weight:600;outline:none;min-width:0;width:0;';

      // Setup screen: neutral cards, or team-colored when teams formed via drag-and-drop
      var inputIds = ['casual-p1a-name', 'casual-p1b-name', 'casual-p2a-name', 'casual-p2b-name'];
      var inputPlaceholders = [p1Name || 'Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4'];
      var inputValues = [p1Name, '', '', ''];

      // Preserve input values across re-renders (drag-and-drop triggers _renderSetup)
      for (var _ii = 0; _ii < inputIds.length; _ii++) {
        var _el = document.getElementById(inputIds[_ii]);
        if (_el) inputValues[_ii] = _el.value;
      }

      function _buildSetupCard(ci) {
        var avatar = _inputAvatar(ci);
        var team = _teamAssignments[ci]; // 1, 2, or undefined
        var bg, bdr, textClr;
        if (_teamsFormed && team === 1) {
          bg = 'rgba(59,130,246,0.10)'; bdr = 'rgba(59,130,246,0.35)'; textClr = '#60a5fa';
        } else if (_teamsFormed && team === 2) {
          bg = 'rgba(239,68,68,0.10)'; bdr = 'rgba(239,68,68,0.35)'; textClr = '#f87171';
        } else {
          bg = 'rgba(255,255,255,0.04)'; bdr = 'rgba(255,255,255,0.12)'; textClr = 'var(--text-bright)';
        }
        var isDraggable = !autoShuffle;
        var dragStyle = isDraggable ? 'cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;' : '';
        return '<div data-casual-idx="' + ci + '"' + (isDraggable ? ' draggable="true"' : '') + ' style="display:flex;align-items:center;gap:6px;padding:8px 8px;border-radius:12px;background:' + bg + ';border:1px solid ' + bdr + ';box-sizing:border-box;min-width:0;overflow:hidden;transition:transform 0.15s,border-color 0.2s,background 0.2s;' + dragStyle + '">' +
          avatar +
          '<input type="text" id="' + inputIds[ci] + '" value="' + window._safeHtml(inputValues[ci]) + '" placeholder="' + inputPlaceholders[ci] + '" oninput="window._syncCasualSetupFromInput && window._syncCasualSetupFromInput()" style="' + _inputStyle + 'color:' + textClr + ';">' +
        '</div>';
      }

      var cardsHtml;
      if (_teamsFormed) {
        // Teams formed: T1 stacked left, T2 stacked right
        var _t1Idxs = [], _t2Idxs = [];
        for (var _gi = 0; _gi < 4; _gi++) {
          if (_teamAssignments[_gi] === 1) _t1Idxs.push(_gi);
          else _t2Idxs.push(_gi);
        }
        cardsHtml =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            _buildSetupCard(_t1Idxs[0]) + _buildSetupCard(_t2Idxs[0]) +
            _buildSetupCard(_t1Idxs[1]) + _buildSetupCard(_t2Idxs[1]) +
          '</div>';
      } else {
        cardsHtml =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            _buildSetupCard(0) + _buildSetupCard(1) + _buildSetupCard(2) + _buildSetupCard(3) +
          '</div>';
      }

      var subtitle;
      if (autoShuffle) {
        subtitle = '<div style="font-size:0.65rem;color:var(--text-muted);margin-top:6px;text-align:center;">' + _t('casual.shuffleOnStart') + '</div>';
      } else if (_teamsFormed) {
        subtitle = '<div style="font-size:0.65rem;margin-top:6px;text-align:center;">' +
          '<span onclick="window._casualResetTeams()" style="color:var(--text-muted);cursor:pointer;text-decoration:underline;">' + _t('casual.undo') + '</span>' +
          '</div>';
      } else {
        subtitle = '<div style="font-size:0.65rem;color:var(--text-muted);margin-top:6px;text-align:center;">' + _t('casual.dragToForm') + '</div>';
      }

      playersHtml =
        '<div style="margin-bottom:0.8rem;">' +
          '<label style="font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:block;">' + _t('casual.participants') + '</label>' +
          '<div id="casual-team-cards">' +
            cardsHtml +
          '</div>' +
          subtitle +
        '</div>';
    } else {
      // Singles — show current user avatar next to their input
      var _cuAvatarSingles = '';
      if (cu && cu.photoURL) {
        _cuAvatarSingles = '<img src="' + window._safeHtml(cu.photoURL) + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;position:absolute;left:10px;top:50%;transform:translateY(-50%);border:1.5px solid rgba(59,130,246,0.3);" onerror="this.style.display=\'none\'">';
      } else if (cu && cu.displayName) {
        _cuAvatarSingles = '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:700;position:absolute;left:10px;top:50%;transform:translateY(-50%);">' + window._safeHtml((cu.displayName || 'J')[0].toUpperCase()) + '</div>';
      }
      var _hasSinglesAvatar = !!(cu && (cu.photoURL || cu.displayName));
      playersHtml =
        '<div style="margin-bottom:1.2rem;">' +
          '<label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:block;">' + _t('casual.players') + '</label>' +
          '<div style="display:flex;gap:10px;">' +
            '<div style="flex:1;position:relative;">' + _cuAvatarSingles +
              '<input type="text" id="casual-p1-name" value="' + window._safeHtml(p1Name) + '" placeholder="Jogador 1" style="width:100%;padding:10px 14px;' + (_hasSinglesAvatar ? 'padding-left:44px;' : '') + 'border-radius:10px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);color:var(--text-bright);font-size:0.95rem;font-weight:600;outline:none;box-sizing:border-box;">' +
            '</div>' +
            '<input type="text" id="casual-p2-name" placeholder="Jogador 2" style="flex:1;padding:10px 14px;border-radius:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);color:var(--text-bright);font-size:0.95rem;font-weight:600;outline:none;">' +
          '</div>' +
        '</div>';
    }

    var casualUrl = (window.SCOREPLACE_URL || 'https://scoreplace.app') + '/#casual/' + _sessionRoomCode;

    content.innerHTML =
      // Config summary: sport + mode + scoring in one compact row
      '<div onclick="window._casualOpenConfig()" style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:8px 12px;margin-bottom:0.8rem;display:flex;align-items:center;gap:10px;cursor:pointer;">' +
        '<div style="font-size:1.3rem;flex-shrink:0;">' + sportIcon + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.85rem;font-weight:700;color:var(--text-bright);">' + window._safeHtml(sportLabel) + ' · ' + (isDoubles ? _t('casual.doubles') : _t('casual.single')) + '</div>' +
          '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + window._safeHtml(_configSummary()) + '</div>' +
        '</div>' +
        '<div style="color:#818cf8;font-size:1.1rem;flex-shrink:0;">⚙️</div>' +
      '</div>' +

      // Toggles: Sortear, Misto (doubles only)
      togglesHtml +

      // Players
      playersHtml +

      // Lobby: participants who joined via QR/code
      '<div id="casual-lobby-section" style="margin-bottom:0.6rem;">' + _buildLobbyHtml() + '</div>' +

      // Inline QR code + room code + Convidar + Join room — all in one box
      '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:14px;padding:10px;margin-bottom:0.6rem;display:flex;gap:12px;">' +
        '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(casualUrl) + '&bgcolor=1a1e2e&color=ffffff&margin=4" alt="QR" style="width:88px;height:88px;border-radius:10px;flex-shrink:0;align-self:center;" />' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;justify-content:center;">' +
          // Room code + Convidar row
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:0.6rem;font-weight:600;color:#a855f7;text-transform:uppercase;letter-spacing:1px;">' + _t('casual.yourRoom') + '</div>' +
              '<div style="font-size:1.25rem;font-weight:900;letter-spacing:5px;color:#fbbf24;font-family:monospace;">' + window._safeHtml(_sessionRoomCode) + '</div>' +
            '</div>' +
            '<button onclick="window._casualInvite()" style="padding:6px 12px;border-radius:8px;font-size:0.7rem;font-weight:700;border:1px solid rgba(56,189,248,0.3);cursor:pointer;background:rgba(56,189,248,0.12);color:#38bdf8;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;">📲 ' + _t('casual.invite') + '</button>' +
          '</div>' +
          // Join room input row — input left, button right-aligned, same height (44px matches mobile button min-height)
          '<div style="display:flex;gap:4px;align-items:stretch;min-height:44px;">' +
            '<input type="text" id="casual-join-code" placeholder="' + _t('casual.joinRoomPlaceholder') + '" maxlength="6" style="flex:1;min-width:0;min-height:44px;padding:0 8px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-bright);font-size:0.8rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;outline:none;font-family:monospace;text-align:center;box-sizing:border-box;" />' +
            '<button onclick="window._casualJoinRoom()" style="padding:0 12px;border-radius:8px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#a855f7;font-size:0.72rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">' + _t('casual.join') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Start button
      '<button onclick="window._casualStart()" style="width:100%;padding:14px;border-radius:14px;font-size:1.1rem;font-weight:800;border:none;cursor:pointer;background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:white;box-shadow:0 4px 20px rgba(56,189,248,0.4);display:flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent;" ontouchstart="this.style.transform=\'scale(0.97)\'" ontouchend="this.style.transform=\'scale(1)\'">' +
        '<span style="font-size:1.3rem;">📡</span> ' + _t('casual.startMatch') +
      '</button>';

    // Attach drag-and-drop for team building (Sortear OFF + Doubles)
    if (isDoubles && !autoShuffle) {
      setTimeout(function() { _setupDragDrop(); }, 30);
    }
  }

  // Drag-and-drop to form teams: drag player A onto player B → they become Team 1
  // Remaining two automatically become Team 2. Current user always ends in Team 1.
  var _teamDragIdx = null;
  var _teamDragGhost = null;

  function _setupDragDrop() {
    var cards = document.querySelectorAll('[data-casual-idx]');
    if (!cards.length) return;

    // Helper: form team from two card indices
    function _formTeam(idx1, idx2) {
      if (idx1 === idx2) return;
      // Ensure current user (card 0) is always on Team 1
      // If user card is in the pair → that pair is Team 1
      // If user card is NOT in the pair → the pair is Team 2, user's pair is Team 1
      var userInPair = (idx1 === 0 || idx2 === 0);
      _teamAssignments = {};
      if (userInPair) {
        _teamAssignments[idx1] = 1;
        _teamAssignments[idx2] = 1;
        for (var i = 0; i < 4; i++) {
          if (i !== idx1 && i !== idx2) _teamAssignments[i] = 2;
        }
      } else {
        // Dragged pair does NOT include user → they become Team 2, user's side = Team 1
        _teamAssignments[idx1] = 2;
        _teamAssignments[idx2] = 2;
        for (var j = 0; j < 4; j++) {
          if (j !== idx1 && j !== idx2) _teamAssignments[j] = 1;
        }
      }
      _renderSetup();
      // Broadcast team formation to other players in the lobby
      _syncCasualSetupDebounced();
    }

    // Desktop drag events
    cards.forEach(function(card) {
      card.addEventListener('dragstart', function(e) {
        _teamDragIdx = parseInt(card.getAttribute('data-casual-idx'));
        card.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function() {
        card.style.opacity = '1';
        _teamDragIdx = null;
        document.querySelectorAll('[data-casual-idx]').forEach(function(c) { c.style.transform = ''; });
      });
      card.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (_teamDragIdx === null) return;
        var targetIdx = parseInt(card.getAttribute('data-casual-idx'));
        if (targetIdx !== _teamDragIdx) card.style.transform = 'scale(1.05)';
      });
      card.addEventListener('dragleave', function() { card.style.transform = ''; });
      card.addEventListener('drop', function(e) {
        e.preventDefault();
        card.style.transform = '';
        if (_teamDragIdx === null) return;
        var targetIdx = parseInt(card.getAttribute('data-casual-idx'));
        if (targetIdx === _teamDragIdx) return;
        var srcIdx = _teamDragIdx;
        _teamDragIdx = null;
        _formTeam(srcIdx, targetIdx);
      });
    });

    // Touch drag support (mobile)
    var _touchIdx = null;
    cards.forEach(function(card) {
      card.addEventListener('touchstart', function(e) {
        _touchIdx = parseInt(card.getAttribute('data-casual-idx'));
        card.style.opacity = '0.6';
      }, { passive: true });
      card.addEventListener('touchmove', function(e) {
        if (_touchIdx === null) return;
        e.preventDefault();
        if (!_teamDragGhost) {
          _teamDragGhost = card.cloneNode(true);
          _teamDragGhost.style.cssText = 'position:fixed;z-index:200000;opacity:0.85;pointer-events:none;width:' + card.offsetWidth + 'px;box-shadow:0 8px 30px rgba(0,0,0,0.5);border-radius:12px;';
          document.body.appendChild(_teamDragGhost);
        }
        var t = e.touches[0];
        _teamDragGhost.style.left = (t.clientX - 40) + 'px';
        _teamDragGhost.style.top = (t.clientY - 20) + 'px';
        // Highlight card under finger
        document.querySelectorAll('[data-casual-idx]').forEach(function(c) { c.style.transform = ''; });
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var target = el;
        while (target) {
          if (target.dataset && target.dataset.casualIdx !== undefined) {
            if (parseInt(target.dataset.casualIdx) !== _touchIdx) target.style.transform = 'scale(1.05)';
            break;
          }
          target = target.parentElement;
        }
      }, { passive: false });
      card.addEventListener('touchend', function(e) {
        card.style.opacity = '1';
        if (_teamDragGhost) { _teamDragGhost.remove(); _teamDragGhost = null; }
        document.querySelectorAll('[data-casual-idx]').forEach(function(c) { c.style.transform = ''; });
        if (_touchIdx === null) return;
        var t = e.changedTouches[0];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var target = el;
        while (target) {
          if (target.dataset && target.dataset.casualIdx !== undefined) {
            var targetIdx = parseInt(target.dataset.casualIdx);
            if (targetIdx !== _touchIdx) {
              var srcIdx = _touchIdx;
              _touchIdx = null;
              _formTeam(srcIdx, targetIdx);
              return;
            }
            break;
          }
          target = target.parentElement;
        }
        _touchIdx = null;
      });
    });
  }

  // Reset team assignments
  window._casualResetTeams = function() {
    _teamAssignments = {};
    _renderSetup();
    _syncCasualSetupDebounced();
  };

  // Track if config screen is open
  var _configOpen = false;

  // Sport selection handler — also resets doubles default
  window._casualSelectSport = function(key) {
    selectedSport = key;
    var sp = sports.find(function(s) { return s.key === key; });
    if (sp) isDoubles = sp.defaultDoubles;
    if (_configOpen) window._casualOpenConfig();
    else _renderSetup();
  };

  // Doubles toggle
  window._casualSetDoubles = function(val) {
    isDoubles = val;
    if (_configOpen) window._casualOpenConfig();
    else _renderSetup();
    _syncCasualSetupDebounced();
  };

  // Shuffle toggle
  window._casualSetShuffle = function(val) {
    autoShuffle = val;
    _renderSetup();
    _syncCasualSetupDebounced();
  };

  // Misto toggle
  window._casualSetMisto = function(val) {
    isMisto = val;
  };

  // Join a friend's room by code
  window._casualJoinRoom = function() {
    var inp = document.getElementById('casual-join-code');
    if (!inp) return;
    var code = (inp.value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (code.length >= 4) {
      var ov = document.getElementById('casual-match-overlay');
      if (ov) ov.remove();
      window.location.hash = '#casual/' + code;
    } else {
      inp.style.borderColor = '#ef4444';
      setTimeout(function() { inp.style.borderColor = 'rgba(255,255,255,0.12)'; }, 1000);
    }
  };

  // Config gear handler — opens inline config editor
  window._casualOpenConfig = function() {
    _configOpen = true;
    var cfg = _getConfig();
    var content = document.getElementById('casual-setup-content');
    if (!content) return;

    var isSimple = !cfg.type || cfg.type !== 'sets';
    var tr = cfg.tieRule || 'ask';

    // Sport buttons for config screen
    var cfgSportBtns = '';
    for (var csi = 0; csi < sports.length; csi++) {
      var csp = sports[csi];
      var csActive = csp.key === selectedSport;
      cfgSportBtns += '<button onclick="window._casualSelectSport(\'' + csp.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\')" style="' +
        'padding:8px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;' +
        'border:2px solid ' + (csActive ? '#fbbf24' : 'rgba(255,255,255,0.12)') + ';' +
        'background:' + (csActive ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)') + ';' +
        'color:' + (csActive ? '#fbbf24' : 'var(--text-muted)') + ';font-weight:' + (csActive ? '700' : '500') + ';' +
        '">' + csp.icon + ' ' + csp.label + '</button>';
    }

    content.innerHTML =
      '<div style="margin-bottom:1rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
          '<div style="font-size:0.9rem;font-weight:700;color:var(--text-bright);">⚙️ ' + _t('casual.config') + '</div>' +
          '<button onclick="window._casualCloseConfig()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:8px;padding:6px 14px;font-size:0.78rem;font-weight:600;cursor:pointer;">← ' + _t('casual.back') + '</button>' +
        '</div>' +

        // Sport picker
        '<div style="margin-bottom:1rem;">' +
          '<label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:block;">' + _t('casual.sport') + '</label>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + cfgSportBtns + '</div>' +
        '</div>' +

        // Dupla toggle
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.12);margin-bottom:1rem;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:1rem;">' + (isDoubles ? '👥' : '👤') + '</span>' +
            '<span style="font-size:0.85rem;font-weight:700;color:var(--text-bright);">' + (isDoubles ? _t('casual.doubles') : _t('casual.single')) + '</span>' +
          '</div>' +
          '<label class="toggle-switch" style="--toggle-on-bg:#38bdf8;"><input type="checkbox" ' + (isDoubles ? 'checked' : '') + ' onchange="window._casualSetDoubles(this.checked)"><span class="toggle-slider"></span></label>' +
        '</div>' +

        // Scoring type
        '<div style="margin-bottom:1rem;">' +
          '<label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:block;">' + _t('casual.scoreType') + '</label>' +
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="window._casualSetType(\'simple\')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;border:2px solid ' + (isSimple ? '#10b981' : 'rgba(255,255,255,0.12)') + ';background:' + (isSimple ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)') + ';color:' + (isSimple ? '#10b981' : 'var(--text-muted)') + ';">' + _t('casual.simple') + '</button>' +
            '<button onclick="window._casualSetType(\'sets\')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;border:2px solid ' + (!isSimple ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (!isSimple ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)') + ';color:' + (!isSimple ? '#818cf8' : 'var(--text-muted)') + ';">Game Set Match</button>' +
          '</div>' +
        '</div>' +

        // GSM options
        (isSimple ? '' :
        '<div style="display:flex;flex-direction:column;gap:12px;">' +
          // Sets to win
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">' + _t('casual.setsToWin') + '</span>' +
            '<div style="display:flex;gap:4px;">' +
              [1,2,3].map(function(n) {
                var active = (cfg.setsToWin || 1) === n;
                return '<button onclick="window._casualSetCfg(\'setsToWin\',' + n + ')" style="width:36px;height:36px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;border:1px solid ' + (active ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (active ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (active ? '#818cf8' : 'var(--text-muted)') + ';">' + n + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          // Games per set
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">' + _t('casual.gamesPerSet') + '</span>' +
            '<div style="display:flex;gap:4px;">' +
              [4,6,8,11].map(function(n) {
                var active = (cfg.gamesPerSet || 6) === n;
                return '<button onclick="window._casualSetCfg(\'gamesPerSet\',' + n + ')" style="width:36px;height:36px;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;border:1px solid ' + (active ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (active ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (active ? '#818cf8' : 'var(--text-muted)') + ';">' + n + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          // Counting type
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">' + _t('casual.counting') + '</span>' +
            '<div style="display:flex;gap:4px;">' +
              '<button onclick="window._casualSetCfg(\'countingType\',\'tennis\')" style="padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;border:1px solid ' + (cfg.countingType === 'tennis' ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (cfg.countingType === 'tennis' ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (cfg.countingType === 'tennis' ? '#818cf8' : 'var(--text-muted)') + ';">15-30-40</button>' +
              '<button onclick="window._casualSetCfg(\'countingType\',\'numeric\')" style="padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;border:1px solid ' + (cfg.countingType !== 'tennis' ? '#818cf8' : 'rgba(255,255,255,0.12)') + ';background:' + (cfg.countingType !== 'tennis' ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)') + ';color:' + (cfg.countingType !== 'tennis' ? '#818cf8' : 'var(--text-muted)') + ';">1-2-3</button>' +
            '</div>' +
          '</div>' +
          // Tie-break toggle (default ON)
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">Tie-break</span>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#818cf8;"><input type="checkbox" ' + (cfg.tieRule === 'tiebreak' || cfg.tiebreakEnabled ? 'checked' : '') + ' onchange="window._casualSetCfg(\'tieRule\',this.checked?\'tiebreak\':\'ask\');window._casualSetCfg(\'tiebreakEnabled\',this.checked)"><span class="toggle-slider"></span></label>' +
          '</div>' +
          // 2-point advantage toggle
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.82rem;color:var(--text-bright);">' + _t('casual.advantage') + '</span>' +
            '<label class="toggle-switch" style="--toggle-on-bg:#818cf8;"><input type="checkbox" ' + (cfg.advantageRule ? 'checked' : '') + ' onchange="window._casualSetCfg(\'advantageRule\',this.checked)"><span class="toggle-slider"></span></label>' +
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
        base = _casualDefaults[selectedSport] || _casualDefaults['Beach Tennis'];
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
      var prefs = JSON.parse(localStorage.getItem('scoreplace_casual_prefs') || '{}');
      prefs[selectedSport === '_simple' ? '_casual' : selectedSport] = _tempCfg;
      localStorage.setItem('scoreplace_casual_prefs', JSON.stringify(prefs));
    } catch(e) {}
  }

  window._casualCloseConfig = function() {
    _configOpen = false;
    _tempCfg = null;
    _renderSetup();
  };

  // Generate a 6-char alphanumeric room code
  function _generateRoomCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  // Build players array from form inputs
  function _buildPlayers() {
    var players = [];
    var cu = window.AppStore && window.AppStore.currentUser;
    if (isDoubles) {
      var a1 = ((document.getElementById('casual-p1a-name') || {}).value || '').trim();
      var b1 = ((document.getElementById('casual-p1b-name') || {}).value || '').trim();
      var a2 = ((document.getElementById('casual-p2a-name') || {}).value || '').trim();
      var b2 = ((document.getElementById('casual-p2b-name') || {}).value || '').trim();
      // Try to match input names with lobby participants to get their uid+photoURL
      var _findLobbyMatch = function(name) {
        if (!name) return { uid: null, photoURL: null };
        for (var li = 0; li < _lobbyParticipants.length; li++) {
          var lp = _lobbyParticipants[li];
          if (lp.displayName && (lp.displayName.split(' ')[0] === name || lp.displayName === name)) return { uid: lp.uid || null, photoURL: lp.photoURL || null };
        }
        return { uid: null, photoURL: null };
      };
      var _findLobbyPhoto = function(name) { return _findLobbyMatch(name).photoURL; };
      // Current user match: check first name or full displayName
      var _cuFirstName = (cu && cu.displayName) ? cu.displayName.split(' ')[0] : '';
      var _isCuName = function(name) { return cu && name && (name === _cuFirstName || name === cu.displayName); };
      // Team assignment: use drag-and-drop assignments if available, else default (0,1=T1, 2,3=T2)
      var names = [a1 || 'Jogador 1', b1 || 'Jogador 2', a2 || 'Jogador 3', b2 || 'Jogador 4'];
      var hasTeamDnD = _teamAssignments[0] !== undefined;
      for (var pi = 0; pi < 4; pi++) {
        var nm = names[pi];
        var tm = hasTeamDnD ? _teamAssignments[pi] : (pi < 2 ? 1 : 2);
        players.push({ slot: pi, name: nm, team: tm, uid: _isCuName(nm) ? cu.uid : _findLobbyMatch(nm).uid, photoURL: _isCuName(nm) ? cu.photoURL || null : _findLobbyPhoto(nm) });
      }
    } else {
      var n1 = ((document.getElementById('casual-p1-name') || {}).value || '').trim() || 'Jogador 1';
      var n2 = ((document.getElementById('casual-p2-name') || {}).value || '').trim() || 'Jogador 2';
      var _findLobbyMatch2 = function(name) {
        if (!name) return { uid: null, photoURL: null };
        for (var li = 0; li < _lobbyParticipants.length; li++) {
          var lp = _lobbyParticipants[li];
          if (lp.displayName && (lp.displayName.split(' ')[0] === name || lp.displayName === name)) return { uid: lp.uid || null, photoURL: lp.photoURL || null };
        }
        return { uid: null, photoURL: null };
      };
      players.push({ slot: 0, name: n1, team: 1, uid: (cu && cu.uid) ? cu.uid : null, photoURL: cu ? cu.photoURL || null : null });
      var _n2Match = _findLobbyMatch2(n2);
      players.push({ slot: 1, name: n2, team: 2, uid: _n2Match.uid, photoURL: _n2Match.photoURL });
    }
    return players;
  }

  // Room code state for this session (persists across invite/start)
  // Generate immediately so QR can be shown on setup screen
  var _sessionRoomCode = _generateRoomCode();
  var _sessionDocId = null;

  // Broadcast setup state (players + teams + scoring) to Firestore so invited
  // users watching the lobby see team formations in real time. Debounced so
  // rapid edits (typing names, drag-and-drop) don't spam writes.
  var _syncCasualSetupT = null;
  function _syncCasualSetupDebounced() {
    if (!_sessionDocId || typeof window.FirestoreDB === 'undefined' || !window.FirestoreDB.updateCasualMatch) return;
    clearTimeout(_syncCasualSetupT);
    _syncCasualSetupT = setTimeout(function() {
      try {
        window.FirestoreDB.updateCasualMatch(_sessionDocId, {
          players: _buildPlayers(),
          scoring: _getConfig(),
          isDoubles: isDoubles
        });
      } catch(e) {}
    }, 500);
  }
  // Exposed for oninput handlers on name fields
  window._syncCasualSetupFromInput = _syncCasualSetupDebounced;

  // Invite players via QR code (from setup screen, BEFORE starting)
  window._casualInvite = async function() {
    var players = _buildPlayers();
    var cfg = _getConfig();
    var cu = window.AppStore && window.AppStore.currentUser;
    var sportLabel = selectedSport === '_simple' ? 'Placar Simples' : selectedSport;

    var roomCode = _sessionRoomCode;

    // Save to Firestore if not saved yet
    if (!_sessionDocId && typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.db && cu && cu.uid) {
      try {
        _sessionDocId = await window.FirestoreDB.saveCasualMatch({
          createdBy: cu.uid,
          createdByName: cu.displayName || '',
          createdAt: new Date().toISOString(),
          sport: sportLabel,
          scoring: cfg,
          isDoubles: isDoubles,
          players: players,
          participants: [{ uid: cu.uid, displayName: cu.displayName || '', photoURL: cu.photoURL || '', joinedAt: new Date().toISOString() }],
          playerUids: players.filter(function(p) { return !!p.uid; }).map(function(p) { return p.uid; }),
          roomCode: roomCode,
          status: 'waiting',
          result: null
        });
      } catch (e) { console.warn('Casual invite save failed:', e); }
    } else if (_sessionDocId) {
      // Update existing with current players/config
      try {
        window.FirestoreDB.updateCasualMatch(_sessionDocId, { players: players, scoring: cfg, isDoubles: isDoubles });
      } catch(e) {}
    }

    var casualUrl = (window.SCOREPLACE_URL || 'https://scoreplace.app') + '/#casual/' + roomCode;
    var qrSize = 300;
    var qrImgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=' + qrSize + 'x' + qrSize + '&data=' + encodeURIComponent(casualUrl) + '&bgcolor=1a1e2e&color=ffffff&margin=10';

    var qrOv = document.createElement('div');
    qrOv.id = 'casual-qr-overlay';
    qrOv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0e1a;z-index:100003;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;';

    qrOv.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:400px;">' +
        '<div style="font-size:1.3rem;font-weight:800;color:#38bdf8;margin-bottom:3px;">📲 ' + _t('casual.invitePlayers') + '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:clamp(0.8rem,3vh,1.5rem);">' + _t('casual.inviteInstructions') + '</div>' +
        // QR code — centered
        '<img src="' + window._safeHtml(qrImgUrl) + '" alt="QR Code" style="width:min(70vw,280px);height:min(70vw,280px);border-radius:14px;margin-bottom:clamp(0.6rem,2vh,1rem);" />' +
        // Room code
        '<div style="font-size:clamp(1.8rem,7vw,2.5rem);font-weight:900;letter-spacing:8px;color:#fbbf24;font-family:monospace;margin-bottom:4px;">' + window._safeHtml(roomCode) + '</div>' +
        '<div style="font-size:0.65rem;color:var(--text-muted);word-break:break-all;margin-bottom:clamp(0.6rem,2vh,1rem);">' + window._safeHtml(casualUrl) + '</div>' +
        // Share buttons
        '<div style="display:flex;gap:8px;margin-bottom:clamp(0.6rem,2vh,1rem);width:100%;max-width:320px;">' +
          '<button onclick="navigator.clipboard.writeText(\'' + casualUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\');if(typeof showNotification===\'function\')showNotification(_t(\'casual.linkCopied\'),\'\',\'success\');" style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);font-size:0.82rem;font-weight:600;cursor:pointer;">📋 ' + _t('casual.copyLink') + '</button>' +
          '<a href="https://wa.me/?text=' + encodeURIComponent(_t('casual.whatsappMsg', {sport: sportLabel, code: roomCode, url: casualUrl})) + '" target="_blank" rel="noopener" style="flex:1;padding:12px;border-radius:10px;background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.3);color:#25d366;font-size:0.82rem;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;">💬 WhatsApp</a>' +
        '</div>' +
        // Back button
        '<button onclick="var ov=document.getElementById(\'casual-qr-overlay\');if(ov)ov.remove();" style="padding:12px 28px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);font-size:0.88rem;font-weight:600;cursor:pointer;">← ' + _t('casual.back') + '</button>' +
      '</div>';

    document.body.appendChild(qrOv);
  };

  // Shuffle players across teams (random draw)
  window._casualShuffle = function() {
    var inputs = [
      document.getElementById('casual-p1a-name'),
      document.getElementById('casual-p1b-name'),
      document.getElementById('casual-p2a-name'),
      document.getElementById('casual-p2b-name')
    ];
    // Collect current names
    var names = inputs.map(function(el) { return el ? (el.value || '').trim() : ''; });
    // Filter out empty, fill with defaults
    var defaults = ['Jogador 1', 'Parceiro', 'Adversário 1', 'Adversário 2'];
    for (var i = 0; i < 4; i++) { if (!names[i]) names[i] = defaults[i]; }
    // Fisher-Yates shuffle
    for (var j = names.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = names[j]; names[j] = names[k]; names[k] = tmp;
    }
    // Apply back to inputs
    for (var m = 0; m < 4; m++) { if (inputs[m]) inputs[m].value = names[m]; }
    if (typeof showNotification === 'function') showNotification(_t('casual.teamShuffled'), names[0] + ' + ' + names[1] + '  vs  ' + names[2] + ' + ' + names[3], 'success');
  };

  // Start the match (directly opens live scoring)
  window._casualStart = async function() {
    // Stop lobby refresh
    if (_setupRefreshInterval) { clearInterval(_setupRefreshInterval); _setupRefreshInterval = null; }
    var players = _buildPlayers();

    // Enrich player names from lobby participants (people who joined via QR/code)
    if (_sessionDocId && typeof window.FirestoreDB !== 'undefined') {
      try {
        var freshMatch = await window.FirestoreDB.loadCasualMatch(_sessionRoomCode);
        if (freshMatch && Array.isArray(freshMatch.participants)) {
          var lobbyNames = freshMatch.participants.map(function(p) { return p.displayName || ''; }).filter(function(n) { return !!n; });
          // Fill empty player slots with lobby participant names
          var usedLobby = 0;
          for (var pi = 0; pi < players.length; pi++) {
            var defaultNames = ['Jogador 1', 'Parceiro', 'Adversário 1', 'Adversário 2'];
            var isDefault = !players[pi].name || defaultNames.indexOf(players[pi].name) !== -1;
            if (isDefault && usedLobby < lobbyNames.length) {
              players[pi].name = lobbyNames[usedLobby];
              if (freshMatch.participants[usedLobby]) {
                players[pi].uid = freshMatch.participants[usedLobby].uid || null;
                players[pi].photoURL = freshMatch.participants[usedLobby].photoURL || null;
              }
              usedLobby++;
            } else if (!isDefault) {
              // Already has a custom name — try to match with a lobby participant
              // Still enrich photoURL if available
              if (freshMatch.participants[usedLobby]) {
                if (!players[pi].photoURL) players[pi].photoURL = freshMatch.participants[usedLobby].photoURL || null;
                if (!players[pi].uid) players[pi].uid = freshMatch.participants[usedLobby].uid || null;
              }
              usedLobby++;
            }
          }
        }
      } catch(e) {}
    }

    // Sortear ON: randomly assign 4 players into 2 teams. User always stays on Team 1.
    // Unnamed players get labeled based on which team they land on.
    // Sortear OFF: teams are fixed from setup (slots 0,1=T1, slots 2,3=T2) — no shuffle.
    if (isDoubles && autoShuffle && players.length === 4) {
      // Fisher-Yates shuffle
      for (var j = players.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var tmp = players[j]; players[j] = players[k]; players[k] = tmp;
      }
      // Assign teams by position
      players[0].team = 1; players[1].team = 1;
      players[2].team = 2; players[3].team = 2;
      // Ensure current user is in Team 1
      var cuUid = cu && cu.uid;
      if (cuUid) {
        for (var si = 2; si < 4; si++) {
          if (players[si].uid === cuUid) {
            var swp = players[0]; players[0] = players[si]; players[si] = swp;
            players[0].team = 1; players[si].team = 2;
            break;
          }
        }
      }
      // Name unnamed players based on their team role
      var defaultNames = ['Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4'];
      for (var ni = 0; ni < 4; ni++) {
        if (!players[ni].name || defaultNames.indexOf(players[ni].name) !== -1) {
          if (players[ni].team === 1) players[ni].name = 'Parceiro';
          else players[ni].name = ni === 2 ? 'Adversário 1' : 'Adversário 2';
        }
      }
    }

    // Sortear OFF: teams fixed from setup (0,1=T1, 2,3=T2). Rename unnamed to role names.
    if (isDoubles && !autoShuffle && players.length === 4) {
      var defNames = ['Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4'];
      for (var ri = 0; ri < 4; ri++) {
        if (!players[ri].name || defNames.indexOf(players[ri].name) !== -1) {
          if (players[ri].team === 1) players[ri].name = 'Parceiro';
          else players[ri].name = ri === 2 ? 'Adversário 1' : 'Adversário 2';
        }
      }
    }

    var n1, n2;
    if (isDoubles) {
      var t1 = players.filter(function(p) { return p.team === 1; });
      var t2 = players.filter(function(p) { return p.team === 2; });
      n1 = t1.map(function(p) { return p.name; }).join(' / ');
      n2 = t2.map(function(p) { return p.name; }).join(' / ');
    } else {
      n1 = players[0].name;
      n2 = players[1].name;
    }

    var cfg = _getConfig();
    var cu = window.AppStore && window.AppStore.currentUser;
    var sportLabel = selectedSport === '_simple' ? 'Placar Simples' : selectedSport;

    // If not yet saved to Firestore, save now
    if (!_sessionDocId && typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.db && cu && cu.uid) {
      try {
        _sessionDocId = await window.FirestoreDB.saveCasualMatch({
          createdBy: cu.uid,
          createdByName: cu.displayName || '',
          createdAt: new Date().toISOString(),
          sport: sportLabel,
          scoring: cfg,
          isDoubles: isDoubles,
          players: players,
          playerUids: players.filter(function(p) { return !!p.uid; }).map(function(p) { return p.uid; }),
          roomCode: _sessionRoomCode,
          status: 'active',
          result: null
        });
      } catch (e) { console.warn('Casual start save failed:', e); }
    } else if (_sessionDocId) {
      // Update existing match to active with current players
      try {
        window.FirestoreDB.updateCasualMatch(_sessionDocId, { status: 'active', players: players, scoring: cfg, isDoubles: isDoubles });
      } catch(e) {}
    }

    // Close setup overlay
    var ov = document.getElementById('casual-match-overlay');
    if (ov) ov.remove();
    var qrOv = document.getElementById('casual-qr-overlay');
    if (qrOv) qrOv.remove();

    // Open live scoring
    window._openLiveScoring(null, null, {
      casual: true,
      scoring: cfg,
      p1Name: n1,
      p2Name: n2,
      title: _t('casual.title'),
      sportName: sportLabel,
      isDoubles: isDoubles,
      casualDocId: _sessionDocId,
      roomCode: _sessionRoomCode,
      players: players
    });
  };

  // Build overlay
  var overlay = document.createElement('div');
  overlay.id = 'casual-match-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0e1a;z-index:100002;display:flex;flex-direction:column;overflow:hidden;touch-action:manipulation;';

  overlay.innerHTML =
    '<div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        (cu && cu.photoURL ?
          '<img src="' + window._safeHtml(cu.photoURL) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(56,189,248,0.4);" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
          '<div style="display:none;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);align-items:center;justify-content:center;font-size:16px;color:white;font-weight:700;">' + window._safeHtml((cu.displayName || 'J')[0].toUpperCase()) + '</div>'
        : cu ?
          '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:16px;color:white;font-weight:700;">' + window._safeHtml((cu.displayName || 'J')[0].toUpperCase()) + '</div>'
        : '<span style="font-size:1.3rem;">📡</span>') +
        '<div>' +
          '<div style="font-size:0.95rem;font-weight:800;color:#38bdf8;">' + _t('casual.title') + '</div>' +
          '<div style="font-size:0.68rem;color:var(--text-muted);">' + (cu && cu.displayName ? window._safeHtml(cu.displayName) : _t('casual.subtitle')) + '</div>' +
        '</div>' +
      '</div>' +
      '<button onclick="var ov=document.getElementById(\'casual-match-overlay\');if(ov)ov.remove();" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:10px;padding:8px 16px;font-size:0.82rem;font-weight:600;cursor:pointer;">✕ ' + _t('casual.close') + '</button>' +
    '</div>' +
    '<div id="casual-setup-content" style="flex:1;overflow-y:auto;padding:1rem 0.8rem;-webkit-overflow-scrolling:touch;"></div>';

  document.body.appendChild(overlay);
  // Prevent body scroll and pinch-zoom while casual overlay is open
  document.body.style.overflow = 'hidden';
  var _metaVp = document.querySelector('meta[name="viewport"]');
  var _origVpContent = _metaVp ? _metaVp.getAttribute('content') : '';
  if (_metaVp) _metaVp.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no');
  // Restore on close
  var _ovObs = new MutationObserver(function(muts) {
    if (!document.getElementById('casual-match-overlay') && !document.getElementById('live-scoring-overlay')) {
      document.body.style.overflow = '';
      if (_metaVp && _origVpContent) _metaVp.setAttribute('content', _origVpContent);
      _ovObs.disconnect();
      // Clear active casual room from profile
      try {
        var _cu = window.AppStore && window.AppStore.currentUser;
        var _uid = _cu && (_cu.uid || _cu.email);
        if (_uid && window.FirestoreDB && window.FirestoreDB.saveUserProfile) {
          window.FirestoreDB.saveUserProfile(_uid, { activeCasualRoom: null }).catch(function() {});
        }
      } catch (e) {}
    }
  });
  _ovObs.observe(document.body, { childList: true });

  _renderSetup();

  // Auto-save to Firestore immediately so QR code works before clicking anything
  if (!_sessionDocId && typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.db && cu && cu.uid) {
    var sportLabel = selectedSport === '_simple' ? 'Placar Simples' : selectedSport;
    window.FirestoreDB.saveCasualMatch({
      createdBy: cu.uid,
      createdByName: cu.displayName || '',
      createdAt: new Date().toISOString(),
      sport: sportLabel,
      scoring: _getConfig(),
      isDoubles: isDoubles,
      players: [],
      participants: [{ uid: cu.uid, displayName: cu.displayName || '', photoURL: cu.photoURL || '', joinedAt: new Date().toISOString() }],
      playerUids: [cu.uid],
      roomCode: _sessionRoomCode,
      status: 'waiting',
      result: null
    }).then(function(docId) {
      if (docId) { _sessionDocId = docId; console.debug('[Casual] Saved to Firestore, docId:', docId, 'roomCode:', _sessionRoomCode); }
      else console.warn('[Casual] saveCasualMatch returned null — check Firestore rules for casualMatches collection');
    }).catch(function(e) { console.error('[Casual] Auto-save failed:', e); });
    // Save active room to user profile so other devices can join
    window.FirestoreDB.saveUserProfile(cu.uid, { activeCasualRoom: _sessionRoomCode }).catch(function() {});
  }

  // Start polling for new participants joining the room
  function _startSetupRefresh() {
    if (_setupRefreshInterval) return;
    _setupRefreshInterval = setInterval(function() {
      if (!_sessionDocId || !_sessionRoomCode) return;
      if (!document.getElementById('casual-match-overlay')) {
        // Overlay closed — stop polling
        clearInterval(_setupRefreshInterval); _setupRefreshInterval = null; return;
      }
      window.FirestoreDB.loadCasualMatch(_sessionRoomCode).then(function(fresh) {
        if (!fresh) return;
        var newParts = Array.isArray(fresh.participants) ? fresh.participants : [];
        if (newParts.length !== _lobbyParticipants.length) {
          _lobbyParticipants = newParts;
          _updateLobbySection();
          if (newParts.length > 1) {
            var latest = newParts[newParts.length - 1];
            if (latest && latest.uid !== (cu ? cu.uid : '')) {
              if (typeof showNotification === 'function') showNotification(_t('casual.newPlayer'), _t('casual.playerJoinedRoom', {name: latest.displayName || _t('casual.someone')}), 'success');
            }
          }
        }
      }).catch(function() {});
    }, 3000);
  }

  // Start refresh after save
  setTimeout(function() { _startSetupRefresh(); }, 2000);

  // Cleanup on overlay close
  var origClose = overlay.querySelector('button');
  if (origClose) {
    var origOnclick = origClose.getAttribute('onclick') || '';
    origClose.setAttribute('onclick', 'if(window._casualSetupCleanup)window._casualSetupCleanup();' + origOnclick);
  }
  window._casualSetupCleanup = function() {
    if (_setupRefreshInterval) { clearInterval(_setupRefreshInterval); _setupRefreshInterval = null; }
  };

  setTimeout(function() {
    var el = isDoubles ? document.getElementById('casual-p2a-name') : document.getElementById('casual-p2-name');
    if (el && !el.value) el.focus();
  }, 300);
};

// ─── Casual Match Join Screen (route: #casual/{roomCode}) ─────────────────────
window._renderCasualJoin = function(container, roomCode) {
  if (!container) return;
  var _safe = window._safeHtml || function(s) { return s; };

  container.innerHTML =
    '<div style="display:flex;justify-content:center;align-items:center;min-height:60vh;">' +
      '<div style="text-align:center;">' +
        '<div style="font-size:2rem;margin-bottom:1rem;">⏳</div>' +
        '<p style="color:var(--text-muted);font-size:0.9rem;">' + _t('casual.loading') + '</p>' +
      '</div>' +
    '</div>';

  if (typeof window.FirestoreDB === 'undefined' || !window.FirestoreDB.db) {
    container.innerHTML =
      '<div style="text-align:center;padding:3rem 1rem;">' +
        '<div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>' +
        '<div style="font-size:1.1rem;font-weight:700;color:var(--text-bright);margin-bottom:0.5rem;">' + _t('casual.offline') + '</div>' +
        '<p style="color:var(--text-muted);font-size:0.85rem;">' + _t('casual.offlineMsg') + '</p>' +
        '<button class="btn btn-primary" onclick="window.location.hash=\'#dashboard\';" style="margin-top:1rem;">' + _t('casual.goToDashboard') + '</button>' +
      '</div>';
    return;
  }

  window.FirestoreDB.loadCasualMatch(roomCode).then(function(match) {
    if (!match) {
      container.innerHTML =
        '<div style="text-align:center;padding:3rem 1rem;">' +
          '<div style="font-size:2.5rem;margin-bottom:1rem;">❌</div>' +
          '<div style="font-size:1.1rem;font-weight:700;color:var(--text-bright);margin-bottom:0.5rem;">' + _t('casual.notFound') + '</div>' +
          '<p style="color:var(--text-muted);font-size:0.85rem;">' + _t('casual.notFoundMsg', {code: _safe(roomCode)}) + '</p>' +
          '<button class="btn btn-primary" onclick="window.location.hash=\'#dashboard\';" style="margin-top:1rem;">' + _t('casual.goToDashboard') + '</button>' +
        '</div>';
      return;
    }

    var players = Array.isArray(match.players) ? match.players : [];
    var sportName = match.sport || _t('casual.title');
    var creatorName = match.createdByName || _t('casual.someone');
    var docId = match._docId;
    var cu = window.AppStore && window.AppStore.currentUser;

    if (match.status === 'finished') {
      // Show result
      var result = match.result || {};
      var winnerTeam = result.winner;
      var winnerLabel = '';
      if (winnerTeam === 1) {
        winnerLabel = players.filter(function(p) { return p.team === 1; }).map(function(p) { return p.name; }).join(' / ');
      } else if (winnerTeam === 2) {
        winnerLabel = players.filter(function(p) { return p.team === 2; }).map(function(p) { return p.name; }).join(' / ');
      } else {
        winnerLabel = _t('casual.draw');
      }
      container.innerHTML =
        '<div style="text-align:center;padding:2rem 1rem;max-width:500px;margin:0 auto;">' +
          '<div style="font-size:2.5rem;margin-bottom:0.5rem;">🏆</div>' +
          '<div style="font-size:1.2rem;font-weight:800;color:#fbbf24;margin-bottom:0.3rem;">' + _t('casual.closed') + '</div>' +
          '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.5rem;">' + _safe(sportName) + '</div>' +
          '<div style="background:var(--bg-darker);border-radius:14px;padding:1.2rem;margin-bottom:1rem;">' +
            '<div style="display:flex;justify-content:center;align-items:center;gap:1rem;margin-bottom:0.8rem;">' +
              '<div style="text-align:center;flex:1;">' +
                '<div style="font-size:0.95rem;font-weight:700;color:' + (winnerTeam === 1 ? '#22c55e' : 'var(--text-bright)') + ';">' + _safe(players.filter(function(p){return p.team===1;}).map(function(p){return p.name;}).join(' / ')) + '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-muted);">' + _t('casual.team', {n: '1'}) + '</div>' +
              '</div>' +
              '<div style="font-size:1.5rem;font-weight:900;color:var(--text-muted);">vs</div>' +
              '<div style="text-align:center;flex:1;">' +
                '<div style="font-size:0.95rem;font-weight:700;color:' + (winnerTeam === 2 ? '#22c55e' : 'var(--text-bright)') + ';">' + _safe(players.filter(function(p){return p.team===2;}).map(function(p){return p.name;}).join(' / ')) + '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-muted);">' + _t('casual.team', {n: '2'}) + '</div>' +
              '</div>' +
            '</div>' +
            '<div style="font-size:1.3rem;font-weight:800;color:#38bdf8;letter-spacing:1px;">' + _safe(result.summary || '') + '</div>' +
            (winnerTeam !== 0 ? '<div style="font-size:0.82rem;color:#22c55e;margin-top:0.4rem;font-weight:600;">🏆 ' + _safe(winnerLabel) + '</div>' : '') +
          '</div>' +
          '<button class="btn btn-primary" onclick="window.location.hash=\'#dashboard\';" style="margin-top:0.5rem;">' + _t('casual.goToDashboard') + '</button>' +
        '</div>';
      return;
    }

    if (match.status === 'active') {
      // Open the live scoring overlay in real-time mode so all players can see and interact
      var p1Names = players.filter(function(p) { return p.team === 1; }).map(function(p) { return p.name; });
      var p2Names = players.filter(function(p) { return p.team === 2; }).map(function(p) { return p.name; });
      var p1Str = p1Names.join(' / ');
      var p2Str = p2Names.join(' / ');
      var sc = match.scoring || {};
      window._openLiveScoring(null, null, {
        casual: true,
        scoring: sc,
        p1Name: p1Str,
        p2Name: p2Str,
        title: sportName,
        sportName: sportName,
        isDoubles: match.isDoubles || false,
        casualDocId: docId,
        roomCode: roomCode,
        players: players
      });
      // Show a brief toast so user knows they joined
      if (typeof showNotification === 'function') {
        showNotification(_t('casual.liveTitle'), _t('casual.liveConnectedMsg', {name: _safe(creatorName)}), 'success');
      }
      return;
    }

    // Status: waiting — auto-join + lobby
    var participants = Array.isArray(match.participants) ? match.participants : [];
    var isLoggedIn = !!(cu && cu.uid);
    var _lobbyInterval = null;

    function _renderLobby() {
      var myUid = isLoggedIn ? cu.uid : null;
      var alreadyJoined = myUid && participants.some(function(p) { return p.uid === myUid; });
      var isCreator = myUid && match.createdBy === myUid;
      var totalNeeded = match.isDoubles ? 4 : 2;

      var html =
        '<div style="text-align:center;padding:1.5rem 1rem;max-width:500px;margin:0 auto;">' +
          '<div style="font-size:2.5rem;margin-bottom:0.5rem;">📡</div>' +
          '<div style="font-size:1.3rem;font-weight:800;color:#38bdf8;margin-bottom:0.2rem;">' + _t('casual.title') + '</div>' +
          '<div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.3rem;">' + _safe(sportName) + (match.isDoubles ? ' · ' + _t('casual.doubles') : ' · ' + _t('casual.single')) + '</div>' +
          '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:1.5rem;">' + _t('casual.createdBy', {name: _safe(creatorName)}) + '</div>';

      // Participants list
      html += '<div style="margin-bottom:1.5rem;">' +
        '<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">' + _t('casual.playersInRoom', {count: participants.length, total: totalNeeded}) + '</div>';

      for (var i = 0; i < participants.length; i++) {
        var pp = participants[i];
        var isMe = myUid && pp.uid === myUid;
        var isHost = pp.uid === match.createdBy;
        var avatarH = pp.photoURL ?
          '<img src="' + _safe(pp.photoURL) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,0.15);" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
          '<div style="display:none;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);align-items:center;justify-content:center;font-size:0.85rem;color:white;font-weight:700;flex-shrink:0;">' + _safe((pp.displayName || 'J')[0].toUpperCase()) + '</div>' :
          '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:0.85rem;color:white;font-weight:700;flex-shrink:0;">' + _safe((pp.displayName || 'J')[0].toUpperCase()) + '</div>';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;margin-bottom:6px;' +
          'background:' + (isMe ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)') + ';' +
          'border:1px solid ' + (isMe ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)') + ';">' +
          avatarH +
          '<div style="flex:1;text-align:left;">' +
            '<div style="font-size:0.88rem;font-weight:700;color:var(--text-bright);">' + _safe(pp.displayName || _t('casual.playerFallback')) +
              (isMe ? ' <span style="color:#22c55e;font-size:0.68rem;">(' + _t('casual.you') + ')</span>' : '') +
              (isHost ? ' <span style="color:#fbbf24;font-size:0.68rem;">👑</span>' : '') +
            '</div>' +
          '</div>' +
          (isMe && !isHost ? '<button onclick="window._casualLeaveMatch()" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171;border-radius:8px;padding:4px 10px;font-size:0.7rem;font-weight:600;cursor:pointer;white-space:nowrap;">' + _t('casual.leave') + '</button>' : '<div style="font-size:1rem;">✅</div>') +
        '</div>';
      }

      // Empty slots
      for (var j = participants.length; j < totalNeeded; j++) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;margin-bottom:6px;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:0.85rem;color:var(--text-muted);flex-shrink:0;">?</div>' +
          '<div style="flex:1;text-align:left;">' +
            '<div style="font-size:0.82rem;color:var(--text-muted);">' + _t('casual.waitingPlayer') + '</div>' +
          '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);">⏳</div>' +
        '</div>';
      }
      html += '</div>';

      // Live team preview — show the teams the organizer is assembling (visible to invited players too)
      var matchPlayers = Array.isArray(match.players) ? match.players : [];
      var hasNamedPlayer = matchPlayers.some(function(mp) {
        if (!mp || !mp.name) return false;
        var defaults = ['Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4', 'Parceiro', 'Adversário 1', 'Adversário 2'];
        return defaults.indexOf(mp.name) === -1;
      });
      if (match.isDoubles && matchPlayers.length === 4 && hasNamedPlayer) {
        var t1 = matchPlayers.filter(function(mp) { return mp.team === 1; });
        var t2 = matchPlayers.filter(function(mp) { return mp.team === 2; });
        var _teamCard = function(team, clr, bg, bdr) {
          var chips = team.map(function(mp) {
            var avH;
            if (mp.photoURL) {
              avH = '<img src="' + _safe(mp.photoURL) + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid ' + clr + ';" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                '<div style="display:none;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);align-items:center;justify-content:center;font-size:0.7rem;color:white;font-weight:700;flex-shrink:0;">' + _safe((mp.name || 'J')[0].toUpperCase()) + '</div>';
            } else {
              avH = '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:white;font-weight:700;flex-shrink:0;">' + _safe((mp.name || 'J')[0].toUpperCase()) + '</div>';
            }
            return '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,0.04);">' + avH +
              '<span style="font-size:0.8rem;font-weight:700;color:' + clr + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(mp.name || '—') + '</span></div>';
          }).join('');
          return '<div style="flex:1;min-width:0;padding:10px;border-radius:12px;background:' + bg + ';border:1px solid ' + bdr + ';display:flex;flex-direction:column;gap:5px;">' +
            '<div style="font-size:0.55rem;font-weight:800;color:' + clr + ';text-transform:uppercase;letter-spacing:1px;text-align:center;">' + _t('casual.team', {n: team === t1 ? '1' : '2'}) + '</div>' +
            chips +
          '</div>';
        };
        html += '<div style="margin-bottom:1.2rem;">' +
          '<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">' + _t('casual.teamsFormed') + '</div>' +
          '<div style="display:flex;gap:8px;align-items:stretch;">' +
            _teamCard(t1, '#60a5fa', 'rgba(59,130,246,0.08)', 'rgba(59,130,246,0.25)') +
            '<div style="display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:var(--text-muted);">VS</div>' +
            _teamCard(t2, '#f87171', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.25)') +
          '</div>' +
        '</div>';
      }

      // Status messages
      if (!isLoggedIn) {
        html += '<div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:1rem;margin-bottom:1rem;">' +
          '<div style="font-size:0.85rem;color:#fbbf24;font-weight:600;margin-bottom:0.3rem;">' + _t('casual.loginToJoin') + '</div>' +
          '<div style="font-size:0.78rem;color:var(--text-muted);">' + _t('casual.loginToJoinMsg') + '</div>' +
          '<button class="btn btn-primary" onclick="if(typeof handleGoogleLogin===\'function\')handleGoogleLogin();" style="margin-top:0.6rem;">' + _t('casual.loginBtn') + '</button>' +
        '</div>';
      } else if (alreadyJoined) {
        html += '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:14px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;">' +
          '<div style="font-size:1.3rem;">✅</div>' +
          '<div>' +
            '<div style="font-size:0.85rem;color:#22c55e;font-weight:700;">' + _t('casual.youreIn') + '</div>' +
            '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + _t('casual.waitOrganizerStart') + (participants.length < totalNeeded ? ' (' + _t(totalNeeded - participants.length > 1 ? 'casual.slotsLeft' : 'casual.slotLeft', {n: totalNeeded - participants.length}) + ')' : '') + '</div>' +
          '</div>' +
        '</div>';
      }

      // Animated waiting indicator
      html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;margin-bottom:1rem;">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;animation:casualPulse 1.5s ease-in-out infinite;"></div>' +
        '<div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;animation:casualPulse 1.5s ease-in-out 0.3s infinite;"></div>' +
        '<div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;animation:casualPulse 1.5s ease-in-out 0.6s infinite;"></div>' +
        '<span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">' + _t('casual.autoUpdate') + '</span>' +
      '</div>' +
      '<style>@keyframes casualPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}</style>';

      // "Voltar ao Dashboard" now also releases the slot so the user isn't
      // silently kept in the match after navigating away.
      html += '<button class="btn btn-outline" onclick="window._casualLeaveMatch && window._casualLeaveMatch();" style="margin-top:0.5rem;">← ' + _t('casual.backDashboard') + '</button>';
      html += '</div>';

      container.innerHTML = html;
    }

    // Auto-join: add logged-in user to match participants
    async function _autoJoin() {
      if (_hasLeft) return;
      if (!isLoggedIn || !docId) return;
      var alreadyIn = participants.some(function(p) { return p.uid === cu.uid; });
      if (alreadyIn) return;
      var ok = await window.FirestoreDB.joinCasualMatch(docId, cu.uid, cu.displayName || '', cu.photoURL || '');
      if (_hasLeft) return; // User left while the request was in flight
      if (ok) {
        participants.push({ uid: cu.uid, displayName: cu.displayName || '', photoURL: cu.photoURL || '', joinedAt: new Date().toISOString() });
        _renderLobby();
        if (typeof showNotification === 'function') showNotification(_t('casual.joinedMatch'), _t('casual.waitOrganizer'), 'success');
      }
    }

    // Periodic refresh to see new players and detect match start
    function _startLobbyRefresh() {
      _lobbyInterval = setInterval(async function() {
        if (_hasLeft) return;
        try {
          var fresh = await window.FirestoreDB.loadCasualMatch(roomCode);
          if (!fresh) return;
          // Match started? Switch to live scoring
          if (fresh.status === 'active') {
            _casualLobbyCleanup();
            var pp = Array.isArray(fresh.players) ? fresh.players : [];
            var p1n = pp.filter(function(p) { return p.team === 1; }).map(function(p) { return p.name; }).join(' / ');
            var p2n = pp.filter(function(p) { return p.team === 2; }).map(function(p) { return p.name; }).join(' / ');
            window._openLiveScoring(null, null, {
              casual: true, scoring: fresh.scoring || {}, p1Name: p1n, p2Name: p2n,
              title: fresh.sport || _t('casual.title'), sportName: fresh.sport || '',
              isDoubles: fresh.isDoubles || false, casualDocId: fresh._docId,
              roomCode: roomCode, players: pp
            });
            if (typeof showNotification === 'function') showNotification(_t('casual.matchStarted'), '', 'success');
            return;
          }
          // Update participants and keep match snapshot in sync so the lobby
          // re-renders with latest team assignments set by the organizer.
          participants = Array.isArray(fresh.participants) ? fresh.participants : [];
          match = fresh;
          _renderLobby();
        } catch(e) {}
      }, 3000);
    }

    // Flag so an in-flight _autoJoin doesn't re-add the user right after they leave
    var _hasLeft = false;

    // Leave match handler — releases the slot, stops refresh, and navigates to dashboard
    // regardless of how the leave request resolves (user must never stay stuck).
    window._casualLeaveMatch = function() {
      if (_hasLeft) return;
      _hasLeft = true;
      _casualLobbyCleanup();
      var userUid = cu && cu.uid;
      // Fire-and-forget leave so the user isn't blocked by a slow Firestore round-trip
      if (userUid && docId && window.FirestoreDB && typeof window.FirestoreDB.leaveCasualMatch === 'function') {
        try {
          var p = window.FirestoreDB.leaveCasualMatch(docId, userUid);
          if (p && typeof p.catch === 'function') p.catch(function(){});
        } catch(e) {}
      }
      if (typeof showNotification === 'function') showNotification(_t('casual.leftMatch'), '', 'info');
      // Navigate immediately so the user isn't stuck on the lobby
      try { window.location.hash = '#dashboard'; } catch(e) {}
    };

    // Cleanup on leave
    function _casualLobbyCleanup() {
      if (_lobbyInterval) { clearInterval(_lobbyInterval); _lobbyInterval = null; }
    }
    window._casualLobbyCleanup = _casualLobbyCleanup;

    _renderLobby();
    _autoJoin();
    _startLobbyRefresh();
  }).catch(function(err) {
    console.error('Error loading casual match:', err);
    container.innerHTML =
      '<div style="text-align:center;padding:3rem 1rem;">' +
        '<div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>' +
        '<div style="font-size:1.1rem;font-weight:700;color:var(--text-bright);margin-bottom:0.5rem;">' + _t('casual.loadError') + '</div>' +
        '<p style="color:var(--text-muted);font-size:0.85rem;">' + _t('casual.loadErrorMsg') + '</p>' +
        '<button class="btn btn-primary" onclick="window.location.hash=\'#dashboard\';" style="margin-top:1rem;">' + _t('casual.goToDashboard') + '</button>' +
      '</div>';
  });
};

// _closeRound is in bracket-logic.js
