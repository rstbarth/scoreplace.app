// ─── Participants View ────────────────────────────────────────────────────────
var _t = window._t || function(k) { return k; };

// ── Funções globais de check-in (disponíveis para qualquer view) ──
function _reRenderParticipants() {
  const hash = window.location.hash;
  const container = document.getElementById('view-container');
  if (!container) return;
  if (hash.startsWith('#participants/')) {
    const id = hash.split('/')[1];
    renderParticipants(container, id);
  } else if (hash.startsWith('#tournaments/')) {
    const id = hash.split('/')[1];
    if (typeof renderTournaments === 'function') renderTournaments(container, id);
  }
}

window._toggleCheckIn = function (tId, playerName) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  if (!t.checkedIn) t.checkedIn = {};
  if (!t.absent) t.absent = {};
  const wasCheckedIn = !!t.checkedIn[playerName];
  if (wasCheckedIn) {
    // Desmarcar presença → volta ao estado "sem confirmação"
    delete t.checkedIn[playerName];
  } else {
    // Marcar presente → limpa ausência se existia
    t.checkedIn[playerName] = Date.now();
    delete t.absent[playerName];
  }
  window.FirestoreDB.saveTournament(t);
  _reRenderParticipants();

  // Auto-substitute: se acabamos de marcar um jogador da lista de espera como Presente
  // e há um ausente pendente em um jogo ativo (W.O. declarado antes do substituto estar
  // presente), dispara o fluxo de substituição que já mostra confirmação explicativa.
  if (!wasCheckedIn) {
    const standby = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
    const waitlist = Array.isArray(t.waitlist) ? t.waitlist : [];
    const _nm = p => typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
    const inStandby = standby.some(p => _nm(p) === playerName) || waitlist.some(p => _nm(p) === playerName);
    if (inStandby && t.absent && Object.keys(t.absent).length > 0) {
      const allMatches = (typeof window._collectAllMatches === 'function')
        ? window._collectAllMatches(t) : (Array.isArray(t.matches) ? t.matches : []);
      const hasPendingWO = allMatches.some(m => {
        if (!m || m.winner || m.isBye) return false;
        return ['p1', 'p2'].some(slot => {
          const entry = m[slot];
          if (!entry || entry === 'TBD' || entry === 'BYE') return false;
          const members = entry.includes(' / ') ? entry.split(' / ').map(n => n.trim()) : [entry];
          return members.some(n => t.absent[n]);
        });
      });
      if (hasPendingWO && typeof window._autoSubstituteWO === 'function') {
        setTimeout(function() { window._autoSubstituteWO(tId, playerName); }, 120);
      }
    }
  }
};

window._markAbsent = function (tId, playerName) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  if (!t.absent) t.absent = {};
  if (!t.checkedIn) t.checkedIn = {};
  if (t.absent[playerName]) {
    // Desmarcar ausência → volta ao estado "sem confirmação"
    delete t.absent[playerName];
  } else {
    // Marcar ausente → limpa presença se existia
    t.absent[playerName] = Date.now();
    delete t.checkedIn[playerName];
  }
  window.FirestoreDB.saveTournament(t);
  _reRenderParticipants();
};

window._resetCheckIn = function (tId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  t.checkedIn = {};
  t.absent = {};
  window.FirestoreDB.saveTournament(t);
  _reRenderParticipants();
  if (typeof showNotification === 'function') showNotification(_t('participants.resetCheckin'), _t('participants.resetCheckinMsg'), 'info');
};

// ── Inline name editing for organizers ──
window._editParticipantName = function(tId, oldName) {
  var span = event.target;
  if (span.getAttribute('contenteditable') === 'true') return; // already editing
  span.setAttribute('contenteditable', 'true');
  span.style.background = 'rgba(255,255,255,0.1)';
  span.style.borderRadius = '4px';
  span.style.padding = '1px 4px';
  span.style.outline = '1px solid rgba(99,102,241,0.5)';
  span.style.minWidth = '60px';
  span.focus();
  // Select all text
  var range = document.createRange();
  range.selectNodeContents(span);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  var _save = function() {
    span.setAttribute('contenteditable', 'false');
    span.style.background = '';
    span.style.padding = '';
    span.style.outline = '';
    var newName = span.textContent.trim();
    if (!newName || newName === oldName) {
      span.textContent = oldName; // revert
      return;
    }
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t) return;
    // Update in participants array
    var parts = Array.isArray(t.participants) ? t.participants : [];
    parts.forEach(function(p, idx) {
      if (typeof p === 'string') {
        if (p === oldName) parts[idx] = newName;
        else if (p.indexOf(' / ') !== -1) {
          var updated = p.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (updated !== p) parts[idx] = updated;
        }
      } else if (p && typeof p === 'object') {
        if (p.displayName === oldName) p.displayName = newName;
        if (p.name === oldName) p.name = newName;
      }
    });
    // Update in matches, rounds, groups
    var _updateMatch = function(m) {
      if (!m) return;
      if (m.p1 === oldName) m.p1 = newName;
      if (m.p2 === oldName) m.p2 = newName;
      if (m.winner === oldName) m.winner = newName;
      // Team names with " / "
      ['p1', 'p2', 'winner'].forEach(function(field) {
        if (m[field] && m[field].indexOf(oldName) !== -1 && m[field].indexOf(' / ') !== -1) {
          var upd = m[field].split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (upd !== m[field]) m[field] = upd;
        }
      });
      if (Array.isArray(m.team1)) { var i1 = m.team1.indexOf(oldName); if (i1 !== -1) m.team1[i1] = newName; }
      if (Array.isArray(m.team2)) { var i2 = m.team2.indexOf(oldName); if (i2 !== -1) m.team2[i2] = newName; }
    };
    // Update every match across all shapes (by-reference, mutations persist).
    if (typeof window._collectAllMatches === 'function') {
      window._collectAllMatches(t).forEach(_updateMatch);
    } else {
      // Defensive fallback: bracket-model.js not loaded.
      if (Array.isArray(t.matches)) t.matches.forEach(_updateMatch);
      if (t.thirdPlaceMatch) _updateMatch(t.thirdPlaceMatch);
      if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) r.matches.forEach(_updateMatch); });
      if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
        if (!g) return;
        if (Array.isArray(g.matches)) g.matches.forEach(_updateMatch);
        if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr)) gr.forEach(_updateMatch); else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_updateMatch); });
      });
      if (Array.isArray(t.rodadas)) t.rodadas.forEach(function(r) { if (Array.isArray(r)) r.forEach(_updateMatch); else if (r && Array.isArray(r.matches)) r.matches.forEach(_updateMatch); });
    }
    // g.players is a roster field (not a match), handled separately.
    if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
      if (g && Array.isArray(g.players)) {
        var pi = g.players.indexOf(oldName);
        if (pi !== -1) g.players[pi] = newName;
      }
    });
    // Update checkedIn, absent, vips, standings, classification, sorteioRealizado
    ['checkedIn', 'absent', 'vips'].forEach(function(field) {
      if (!t[field]) return;
      if (t[field][oldName] !== undefined) { t[field][newName] = t[field][oldName]; delete t[field][oldName]; }
      Object.keys(t[field]).forEach(function(k) {
        if (k.indexOf(oldName) !== -1 && k.indexOf(' / ') !== -1) {
          var newKey = k.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (newKey !== k) { t[field][newKey] = t[field][k]; delete t[field][k]; }
        }
      });
    });
    if (t.classification && t.classification[oldName] !== undefined) { t.classification[newName] = t.classification[oldName]; delete t.classification[oldName]; }
    if (Array.isArray(t.standings)) t.standings.forEach(function(s) { if (s.name === oldName) s.name = newName; if (s.player === oldName) s.player = newName; });
    if (Array.isArray(t.sorteioRealizado)) t.sorteioRealizado.forEach(function(item, idx2) {
      if (typeof item === 'string') {
        if (item === oldName) t.sorteioRealizado[idx2] = newName;
        else if (item.indexOf(oldName) !== -1 && item.indexOf(' / ') !== -1) {
          var newSR = item.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (newSR !== item) t.sorteioRealizado[idx2] = newSR;
        }
      } else if (typeof item === 'object' && item) { if (item.name === oldName) item.name = newName; if (item.displayName === oldName) item.displayName = newName; }
    });

    window.FirestoreDB.saveTournament(t);
    window.AppStore.logAction(tId, 'Nome editado: "' + oldName + '" → "' + newName + '"');
    if (typeof showNotification === 'function') showNotification(_t('participants.nameUpdated'), _t('participants.nameUpdatedMsg', { old: oldName, 'new': newName }), 'success');
    _reRenderParticipants();
  };

  span.addEventListener('blur', _save, { once: true });
  span.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      span.blur();
    }
    if (e.key === 'Escape') {
      span.textContent = oldName;
      span.blur();
    }
  });
};

window._startTournament = function (tId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  t.tournamentStarted = Date.now();
  // Se não houver data de início, preencher com a data atual
  if (!t.startDate) {
    const now = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    t.startDate = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  }
  // Status passa a ser em andamento
  t.status = 'in_progress';
  window.AppStore.sync();
  if (typeof showNotification === 'function') showNotification(_t('participants.tournamentStarted'), _t('participants.tournamentStartedMsg'), 'success');
  // Re-render current view
  const hash = window.location.hash;
  const container = document.getElementById('view-container');
  if (container && hash.startsWith('#bracket/')) {
    if (typeof renderBracket === 'function') renderBracket(container, tId);
  } else {
    _reRenderParticipants();
  }
};

window._setCheckInFilter = function (tId, filter) {
  window._checkInFilter = filter;
  _reRenderParticipants();
};

window._toggleVip = function (tId, participantName) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  if (!t.vips) t.vips = {};
  if (t.vips[participantName]) {
    delete t.vips[participantName];
  } else {
    t.vips[participantName] = Date.now();
  }
  window.FirestoreDB.saveTournament(t);
  _reRenderParticipants();
};

// ── Declarar ausência de participante ──
window._declareAbsent = function (tId, playerName) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;

  // Encontrar o time/entry e o match deste participante
  const partsArr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  let teamName = null;
  partsArr.forEach(p => {
    const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
    if (pName.includes('/')) {
      const members = pName.split('/').map(n => n.trim()).filter(n => n);
      if (members.includes(playerName)) teamName = pName;
    } else if (pName === playerName) {
      teamName = pName;
    }
  });

  if (!teamName) return;

  // Encontrar o match onde este time joga — scan todas as shapes via helper canônico.
  // Para elim, a ordem do helper começa com t.matches, preservando o índice amigável.
  // Para Liga/Suíço/Grupos, o índice flat ao menos localiza a partida (antes: silent miss).
  let matchEntry = null;
  let matchIdx = -1;
  let matchSide = null; // 'p1' or 'p2'
  const _allForWO = (typeof window._collectAllMatches === 'function')
    ? window._collectAllMatches(t)
    : (Array.isArray(t.matches) ? t.matches.slice() : []);
  const _normTeam = (s) => (s || '').replace(/\s*\/\s*/g, '/').trim();
  const _teamNameNorm = _normTeam(teamName);
  _allForWO.forEach((m, mi) => {
    if (!m || m.winner) return; // já decidido
    if (matchEntry) return; // já encontrado
    if (_normTeam(m.p1) === _teamNameNorm) { matchEntry = m; matchIdx = mi; matchSide = 'p1'; }
    else if (_normTeam(m.p2) === _teamNameNorm) { matchEntry = m; matchIdx = mi; matchSide = 'p2'; }
  });

  const standby = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
  const hasStandby = standby.length > 0;
  const friendlyNum = matchIdx >= 0 ? matchIdx + 1 : '?';
  const opponentSide = matchSide === 'p1' ? 'p2' : 'p1';
  const opponent = matchEntry ? matchEntry[opponentSide] : null;

  const woScope = t.woScope || 'individual';
  const isTeamEntry = teamName.includes('/') || teamName.includes(' / ');
  const isIndividualWO = woScope === 'individual' && isTeamEntry;

  let confirmTitle, confirmMsg, confirmBtn;

  if (isIndividualWO) {
    confirmTitle = _t('participants.declareAbsence');
    confirmMsg = _t('participants.absenceMsgIndStandby', {player: playerName, num: friendlyNum});
    confirmBtn = _t('participants.btnSubstInd');
  } else if (hasStandby) {
    confirmTitle = _t('participants.declareAbsence');
    confirmMsg = _t('participants.absenceMsgTeamStandby', {player: playerName, team: teamName, num: friendlyNum});
    confirmBtn = _t('participants.btnSubstStandby');
  } else {
    confirmTitle = _t('participants.declareAbsenceWO');
    confirmMsg = _t('participants.absenceMsgWO', {player: playerName, team: teamName, num: friendlyNum, opponent: opponent || _t('common.opponent')});
    confirmBtn = _t('participants.btnConfirmWO');
  }

  showConfirmDialog(confirmTitle, confirmMsg, function () {
    // Marcar o jogador como ausente confirmado
    if (!t.checkedIn) t.checkedIn = {};
    if (!t.absent) t.absent = {};
    delete t.checkedIn[playerName];
    t.absent[playerName] = Date.now();

    if (isIndividualWO && matchEntry) {
      // Individual W.O. in teams — try to replace only the absent member, partner stays
      if (!t.checkedIn) t.checkedIn = {};
      let nextStandby = null;
      let nextStandbyIdx = -1;
      for (let si = 0; si < standby.length; si++) {
        const sName = typeof standby[si] === 'string' ? standby[si] : (standby[si].displayName || standby[si].name || standby[si].email || '');
        if (t.checkedIn[sName]) { nextStandby = standby[si]; nextStandbyIdx = si; break; }
      }
      if (!nextStandby) {
        // Sem substituto presente — apenas marca ausente e aguarda organizador
        window.AppStore.logAction(tId, `Ausência marcada: ${playerName} (${teamName}) — Jogo ${friendlyNum}. Aguardando substituto.`);
        window.AppStore.sync();
        if (typeof showNotification === 'function') showNotification(_t('sub.absent'), _t('sub.absentMsg', { name: playerName }), 'warning');
        _reRenderParticipants();
        return;
      }
      const nextName = typeof nextStandby === 'string' ? nextStandby : (nextStandby.displayName || nextStandby.name || nextStandby.email || '');
      // Build new team name replacing only the absent member
      const sep = teamName.includes(' / ') ? ' / ' : '/';
      const members = teamName.split(sep).map(n => n.trim());
      const newMembers = members.map(n => n === playerName ? nextName : n);
      const newTeamName = newMembers.join(' / ');
      const partnerName = members.find(n => n !== playerName) || '';

      // Update match
      matchEntry[matchSide] = newTeamName;
      // Update all match refs
      (t.matches || []).forEach(function(m) {
        if (m.p1 === teamName) m.p1 = newTeamName;
        if (m.p2 === teamName) m.p2 = newTeamName;
      });
      // Update participants
      const pIdx = partsArr.findIndex(p => {
        const pn = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
        return pn === teamName;
      });
      if (pIdx >= 0) {
        if (typeof partsArr[pIdx] === 'string') partsArr[pIdx] = newTeamName;
        else { partsArr[pIdx].displayName = newTeamName; partsArr[pIdx].name = newTeamName; }
      }
      t.participants = partsArr;
      t.standbyParticipants = [...standby.slice(0, nextStandbyIdx), ...standby.slice(nextStandbyIdx + 1)];
      t.checkedIn[nextName] = true;

      window.AppStore.logAction(tId, `Substituição individual: ${playerName} → ${nextName} (parceiro: ${partnerName}) — Jogo ${friendlyNum}`);
      window.AppStore.sync();
      if (typeof showNotification === 'function') showNotification(_t('sub.done'), _t('sub.donePartnerMsg', { name: nextName, absent: playerName, partner: partnerName }), 'success');
      _reRenderParticipants();

    } else if (hasStandby && matchEntry) {
      // Team W.O. scope — promote next standby to replace entire team
      if (!t.checkedIn) t.checkedIn = {};
      let nextStandby = null;
      let nextStandbyIdx = -1;
      for (let si = 0; si < standby.length; si++) {
        const sName = typeof standby[si] === 'string' ? standby[si] : (standby[si].displayName || standby[si].name || standby[si].email || '');
        const sMembers = sName.includes('/') ? sName.split('/').map(n => n.trim()).filter(n => n) : [sName];
        const allPresent = sMembers.every(m => !!t.checkedIn[m]);
        if (allPresent) { nextStandby = standby[si]; nextStandbyIdx = si; break; }
      }
      if (!nextStandby) {
        if (typeof showNotification === 'function') showNotification(_t('sub.noSubPresent'), _t('sub.noSubPresentMsgLong'), 'warning');
        return;
      }
      const nextName = typeof nextStandby === 'string' ? nextStandby : (nextStandby.displayName || nextStandby.name || nextStandby.email || '');

      matchEntry[matchSide] = nextName;
      const pIdx = partsArr.findIndex(p => {
        const pn = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
        return pn === teamName;
      });
      if (pIdx >= 0) partsArr[pIdx] = nextName;
      t.participants = partsArr;
      t.standbyParticipants = [...standby.slice(0, nextStandbyIdx), ...standby.slice(nextStandbyIdx + 1)];

      window.AppStore.logAction(tId, `Ausência: ${playerName} (${teamName}) substituído por ${nextName} da lista de espera — Jogo ${friendlyNum}`);
      window.AppStore.sync();
      if (typeof showNotification === 'function') showNotification(_t('sub.done'), _t('sub.doneTeamMsg', { name: nextName, absent: teamName, n: friendlyNum }), 'success');
      _reRenderParticipants();

    } else if (matchEntry) {
      // W.O. — adversário vence (no standby, team scope)
      matchEntry.scoreP1 = matchSide === 'p1' ? 0 : 'W.O.';
      matchEntry.scoreP2 = matchSide === 'p2' ? 0 : 'W.O.';
      matchEntry.winner = matchEntry[opponentSide];
      matchEntry.wo = true;

      if (typeof _advanceWinner === 'function') {
        _advanceWinner(t, matchEntry);
      } else if (matchEntry.nextMatchId) {
        const next = (t.matches || []).find(nm => nm.id === matchEntry.nextMatchId);
        if (next) {
          if (!next.p1 || next.p1 === 'TBD') next.p1 = matchEntry.winner;
          else if (!next.p2 || next.p2 === 'TBD') next.p2 = matchEntry.winner;
        }
      }

      window.AppStore.logAction(tId, `W.O.: ${teamName} ausente — ${matchEntry.winner} vence Jogo ${friendlyNum} por W.O.`);
      window.AppStore.sync();
      if (typeof showNotification === 'function') showNotification(_t('sub.wo'), _t('sub.woMsg', { winner: matchEntry.winner, n: friendlyNum }), 'warning');
      _reRenderParticipants();

    } else {
      // Nenhum jogo pendente encontrado — apenas marca ausente e sincroniza
      window.AppStore.logAction(tId, `Ausência: ${playerName} — sem jogo pendente`);
      window.AppStore.sync();
      if (typeof showNotification === 'function') showNotification(_t('sub.absent'), _t('sub.absentMsg', { name: playerName }), 'warning');
      _reRenderParticipants();
    }
  }, null, { type: 'warning', confirmText: confirmBtn, cancelText: _t('btn.waitMore') });
};

function renderParticipants(container, tournamentId) {
  const tId = tournamentId;
  const t = tId && window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;

  var _t = window._t || function(k) { return k; };
  if (!t) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:3rem;"><h3>${_t('participants.notFound')}</h3><a href="#dashboard" class="btn btn-primary" style="margin-top:1rem;display:inline-block;">Dashboard</a></div>`;
    return;
  }

  // Pre-load player photos from Firestore (async update after render)
  if (typeof _preloadPlayerPhotos === 'function') {
    _preloadPlayerPhotos(t).then(function() {
      var pImgs = container.querySelectorAll('img[data-player-name]');
      pImgs.forEach(function(img) {
        var nm = img.getAttribute('data-player-name');
        var real = window._playerPhotoCache && window._playerPhotoCache[(nm || '').toLowerCase()];
        if (real && real.indexOf('dicebear.com') === -1 && img.src.indexOf('dicebear.com') !== -1) {
          var fb = 'https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(nm) + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
          img.onerror = function() { this.onerror = null; this.src = fb; };
          img.src = real;
        }
      });
    }).catch(function() {});
  }

  const isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);
  const parts = typeof window._getCompetitors === 'function' ? window._getCompetitors(t) : (t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : []);

  let individualCount = 0;
  parts.forEach(p => {
    const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
    if (pStr.includes('/')) {
      individualCount += pStr.split('/').filter(n => n.trim().length > 0).length;
    } else {
      individualCount++;
    }
  });

  // Ordenar: Times primeiro, depois individuais
  parts.sort((a, b) => {
    const nameA = typeof a === 'string' ? a : (a.displayName || a.name || a.email || '');
    const nameB = typeof b === 'string' ? b : (b.displayName || b.name || b.email || '');
    const isTeamA = nameA.includes('/');
    const isTeamB = nameB.includes('/');
    if (isTeamA && !isTeamB) return -1;
    if (!isTeamA && isTeamB) return 1;
    return 0;
  });
  t.participants = parts;

  // ── Check-in logic ──
  const hasMatches = (t.matches && t.matches.length > 0) || (t.rounds && t.rounds.length > 0) || (t.groups && t.groups.length > 0);
  const drawDone = hasMatches || t.status === 'started' || t.status === 'in_progress';
  const canCheckIn = drawDone && !!t.tournamentStarted;

  if (!t.checkedIn) t.checkedIn = {};
  if (!t.absent) t.absent = {};
  const checkedIn = t.checkedIn;
  const absent = t.absent;

  // Standby participants
  const standbyParts = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];

  // Count stats (includes standby): 3 states — presente, ausente, sem confirmação
  let totalIndividuals = 0;
  let checkedCount = 0;
  let absentConfirmedCount = 0;
  const countIndividuals = (arr) => {
    arr.forEach(p => {
      const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
      if (pName.includes('/')) {
        pName.split('/').forEach(n => {
          const nm = n.trim();
          if (nm) { totalIndividuals++; if (checkedIn[nm]) checkedCount++; else if (absent[nm]) absentConfirmedCount++; }
        });
      } else {
        if (pName) { totalIndividuals++; if (checkedIn[pName]) checkedCount++; else if (absent[pName]) absentConfirmedCount++; }
      }
    });
  };
  countIndividuals(parts);
  if (canCheckIn) countIndividuals(standbyParts);

  const currentFilter = window._checkInFilter || 'all';

  // ── Build cards ──
  let cardsStr = '';
  let gridStyle = '';

  if (canCheckIn) {
    // ── Check-in mode: individual list with checkboxes ──
    gridStyle = 'display:flex;flex-direction:column;gap:6px;';

    // Build map: participant/team name → { friendly match number, decided, opponent }
    // Use canonical collector so Liga/Suíço/Grupos also populate the map
    // (antes: silently empty para formatos não-elim).
    const nameToMatch = {};
    const nameToMatchDecided = {};
    const nameToOpponent = {};
    const _allForCheckin = (typeof window._collectAllMatches === 'function')
      ? window._collectAllMatches(t)
      : (Array.isArray(t.matches) ? t.matches.slice() : []);
    _allForCheckin.forEach((m, mi) => {
      if (!m) return;
      const num = mi + 1;
      if (m.p1 && m.p1 !== 'TBD' && m.p1 !== 'BYE') {
        nameToMatch[m.p1] = num;
        nameToMatchDecided[m.p1] = !!m.winner;
        nameToOpponent[m.p1] = (m.p2 && m.p2 !== 'TBD' && m.p2 !== 'BYE') ? m.p2 : null;
      }
      if (m.p2 && m.p2 !== 'TBD' && m.p2 !== 'BYE') {
        nameToMatch[m.p2] = num;
        nameToMatchDecided[m.p2] = !!m.winner;
        nameToOpponent[m.p2] = (m.p1 && m.p1 !== 'TBD' && m.p1 !== 'BYE') ? m.p1 : null;
      }
    });

    const allIndividuals = [];
    parts.forEach((p, idx) => {
      const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || _t('participants.participant', {n: idx + 1}));
      if (pName.includes('/')) {
        const matchNum = nameToMatch[pName] || null;
        const matchDecided = !!nameToMatchDecided[pName];
        const opponent = nameToOpponent[pName] || null;
        pName.split('/').map(n => n.trim()).filter(n => n).forEach(n => {
          allIndividuals.push({ name: n, teamName: pName, teamIdx: idx, matchNum, matchDecided, opponent });
        });
      } else {
        const matchNum = nameToMatch[pName] || null;
        const matchDecided = !!nameToMatchDecided[pName];
        const opponent = nameToOpponent[pName] || null;
        allIndividuals.push({ name: pName, teamName: null, teamIdx: idx, matchNum, matchDecided, opponent });
      }
    });

    // Add standby participants
    standbyParts.forEach((p, idx) => {
      const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || 'Espera ' + (idx + 1));
      if (pName.includes('/')) {
        pName.split('/').map(n => n.trim()).filter(n => n).forEach(n => {
          allIndividuals.push({ name: n, teamName: pName, teamIdx: -1, matchNum: null, matchDecided: false, opponent: null, isStandby: true });
        });
      } else {
        allIndividuals.push({ name: pName, teamName: null, teamIdx: -1, matchNum: null, matchDecided: false, opponent: null, isStandby: true });
      }
    });

    // ── Deduplicate by name: if same person appears as individual AND in a team, keep team version ──
    const _seenNames = {};
    const _dedupedIndividuals = [];
    allIndividuals.forEach(ind => {
      const key = ind.name.toLowerCase().trim();
      if (_seenNames[key]) {
        // Duplicate — keep the one with more info (team > solo, matchNum > null)
        const prev = _seenNames[key];
        if (!prev.teamName && ind.teamName) {
          // Replace: new one has team info
          const prevIdx = _dedupedIndividuals.indexOf(prev);
          if (prevIdx !== -1) _dedupedIndividuals[prevIdx] = ind;
          _seenNames[key] = ind;
        } else if (!prev.matchNum && ind.matchNum) {
          const prevIdx = _dedupedIndividuals.indexOf(prev);
          if (prevIdx !== -1) _dedupedIndividuals[prevIdx] = ind;
          _seenNames[key] = ind;
        }
        // else keep previous (already has team/match info)
      } else {
        _seenNames[key] = ind;
        _dedupedIndividuals.push(ind);
      }
    });

    // Sort: alphabetical
    _dedupedIndividuals.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    cardsStr = _dedupedIndividuals.map((ind) => {
      const mc = !!checkedIn[ind.name];
      const isAbsent = !!absent[ind.name];
      const isPending = !mc && !isAbsent;
      if (currentFilter === 'present' && !mc) return '';
      if (currentFilter === 'absent' && !isAbsent) return '';
      if (currentFilter === 'pending' && !isPending) return '';

      const safeName = ind.name.replace(/'/g, "\\'");

      // Build sub-info with presence dots (3 states: green=presente, red=ausente, gray=aguardando)
      const dotHtml = (name) => {
        const p = !!checkedIn[name];
        const a = !!absent[name];
        const dotColor = p ? '#10b981' : a ? '#ef4444' : '#64748b';
        const textColor = p ? '#4ade80' : a ? '#f87171' : '#94a3b8';
        return `<span style="display:inline-flex;align-items:center;gap:2px;"><span style="width:6px;height:6px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;"></span><span style="font-size:0.7rem;color:${textColor};">${name}</span></span>`;
      };

      // Standby puro (ainda não substituiu ninguém) = sem parceiro/jogo/adversário
      const isStandbyPure = !!ind.isStandby && !ind.matchNum;

      // Team members line (with dots) — ocultar para standby puro
      let teamLine = '';
      if (ind.teamName && !isStandbyPure) {
        const members = ind.teamName.split('/').map(n => n.trim()).filter(n => n);
        teamLine = members.map(n => dotHtml(n)).join('<span style="color:rgba(255,255,255,0.15);margin:0 2px;">/</span>');
      }

      // Opponent line (with dots) — ocultar para standby puro
      let opponentLine = '';
      if (ind.opponent && !isStandbyPure) {
        const oppMembers = ind.opponent.includes('/') ? ind.opponent.split('/').map(n => n.trim()).filter(n => n) : [ind.opponent];
        opponentLine = oppMembers.map(n => dotHtml(n)).join('<span style="color:rgba(255,255,255,0.15);margin:0 2px;">/</span>');
      }

      const matchLabel = (!isStandbyPure && ind.matchNum) ? `Jogo ${ind.matchNum}` : '';
      const standbyLabel = ind.isStandby ? '<span style="font-weight:700;color:#fbbf24;opacity:0.8;">Lista de Espera</span>' : '';

      // Matchup cells (used in the card-level grid, where the player name sits
      // on the same row as team 1 / "vs"). Team 2 lives inside teamsCell on its
      // own row, so the card becomes 2 lines total (name+team1+vs / team2).
      const jogoCell = matchLabel
        ? `<span style="font-weight:700;color:var(--text-muted);opacity:0.6;font-size:0.72rem;white-space:nowrap;align-self:center;">${matchLabel}</span>`
        : '';
      const vsCell = (teamLine && opponentLine)
        ? `<span style="font-size:0.62rem;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:1px;text-transform:uppercase;font-style:italic;align-self:start;padding-top:1px;">vs</span>`
        : '';
      let teamsCell = '';
      if (teamLine && opponentLine) {
        teamsCell = `<div style="display:flex;flex-direction:column;gap:2px;line-height:1.3;font-size:0.72rem;color:var(--text-muted);opacity:0.95;min-width:0;"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">${teamLine}</div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">${opponentLine}</div></div>`;
      } else if (teamLine) {
        teamsCell = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;line-height:1.3;font-size:0.72rem;color:var(--text-muted);opacity:0.95;min-width:0;">${teamLine}</div>`;
      } else if (opponentLine) {
        teamsCell = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;line-height:1.3;font-size:0.72rem;color:var(--text-muted);opacity:0.95;min-width:0;">${opponentLine}</div>`;
      }
      const standbyHeader = (ind.isStandby && !matchLabel && standbyLabel)
        ? `<div style="font-size:0.7rem;margin-top:2px;">${standbyLabel}</div>`
        : '';
      const hasMatchup = !!(jogoCell || teamsCell || vsCell);

      // W.O. check
      const woMatch = ind.matchNum && t.matches ? t.matches[ind.matchNum - 1] : null;
      const isWO = woMatch && woMatch.wo && woMatch.winner && woMatch.winner !== (ind.teamName || ind.name);

      const isStandby = !!ind.isStandby;

      // Action buttons — toggle Presente + botão W.O.
      const canAct = isStandby ? true : (!ind.matchDecided && !isWO);

      // Toggle "Presente" — sempre renderizado para todo participante,
      // independente de o jogo já ter resultado ou W.O. (check-in é independente do resultado)
      const presentToggle = `<label class="toggle-switch toggle-sm" style="--toggle-on-bg:#10b981;--toggle-on-glow:rgba(16,185,129,0.3);--toggle-on-border:#10b981;flex-shrink:0;" onclick="event.stopPropagation();"><input type="checkbox" ${mc ? 'checked' : ''} onclick="event.stopPropagation(); window._toggleCheckIn('${tId}', '${safeName}');"><span class="toggle-slider"></span></label><span style="font-size:0.68rem;font-weight:700;color:${mc ? '#4ade80' : '#64748b'};white-space:nowrap;">${mc ? 'Presente' : 'Ausente'}</span>`;

      // W.O. button — marca W.O. / reverte W.O.
      // Standby players use simple toggle; active participants always go through the
      // dialog (_declareAbsent uses _collectAllMatches which is more robust than ind.matchNum).
      const woAction = isAbsent
        ? `window._markAbsent('${tId}', '${safeName}')`
        : (isStandby
          ? `window._markAbsent('${tId}', '${safeName}')`
          : `window._declareAbsent('${tId}', '${safeName}')`);
      const woLabel = isAbsent ? 'Reverter' : 'W.O.';
      // Sempre renderizado para o organizador, independente de o jogo já ter sido decidido ou estar em W.O.
      const woBtn = isOrg
        ? `<button class="btn btn-micro" onclick="event.stopPropagation(); ${woAction}" style="border:1px solid ${isAbsent ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.2)'};background:${isAbsent ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.08)'};color:${isAbsent ? '#60a5fa' : '#f87171'};font-weight:800;font-size:0.7rem;${isAbsent ? 'opacity:1;' : 'opacity:0.6;'}">${woLabel}</button>`
        : '';
      const woBadge = isWO ? `<div style="font-size:0.7rem;font-weight:800;padding:4px 12px;border-radius:8px;background:rgba(239,68,68,0.15);color:#f87171;flex-shrink:0;border:1px solid rgba(239,68,68,0.3);">W.O.</div>` : '';

      // Colors: 3 estados + standby amarelo
      const presenceDotColor = mc ? '#10b981' : isAbsent ? '#ef4444' : '#64748b';
      const presenceDot = `<span style="width:8px;height:8px;border-radius:50%;background:${presenceDotColor};display:inline-block;flex-shrink:0;"></span>`;
      const nameColor = isStandby ? '#fbbf24' : (mc ? '#4ade80' : isAbsent ? '#f87171' : isWO ? '#f87171' : 'var(--text-bright)');
      const cardBg = isStandby
        ? (mc ? 'rgba(251,191,36,0.12)' : isAbsent ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.06)')
        : (mc ? 'rgba(16,185,129,0.12)' : isAbsent ? 'rgba(239,68,68,0.08)' : isWO ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)');
      const cardBorder = isStandby
        ? (mc ? 'rgba(251,191,36,0.3)' : isAbsent ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.15)')
        : (mc ? 'rgba(16,185,129,0.3)' : isAbsent ? 'rgba(239,68,68,0.3)' : isWO ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)');

      // VIP check (by individual name or team name)
      const vipMap = t.vips || {};
      const isVipPlayer = !!vipMap[ind.name] || (ind.teamName && !!vipMap[ind.teamName]);
      const vipTag = isVipPlayer ? '<span style="background:linear-gradient(135deg,#eab308,#fbbf24);color:#1a1a2e;font-size:0.55rem;font-weight:900;padding:1px 5px;border-radius:3px;letter-spacing:0.5px;flex-shrink:0;">⭐ VIP</span>' : '';

      const _safeName = (ind.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      const _pSeed = encodeURIComponent(ind.name);
      const _pCached = (window._playerPhotoCache && window._playerPhotoCache[ind.name.toLowerCase()] && window._playerPhotoCache[ind.name.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[ind.name.toLowerCase()] : '';
      const _pInitials = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _pSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
      const _pAvatar = _pCached || _pInitials;
      const _pAvatarErr = `onerror="this.onerror=null;this.src='${_pInitials}'"` ;

      // "Jogo N" color reflects match-level attendance: green when all players present, amber when partial, muted when none.
      let _jogoColor = 'var(--text-muted)';
      let _jogoOpacity = '0.55';
      let _jogoWeight = '700';
      if (matchLabel && ind.matchNum && !isStandbyPure) {
        const _mm = [];
        if (ind.teamName) ind.teamName.split(/\s*\/\s*/).forEach(n => { if (n && n.trim()) _mm.push(n.trim()); });
        else if (ind.name) _mm.push(ind.name);
        if (ind.opponent) ind.opponent.split(/\s*\/\s*/).forEach(n => { if (n && n.trim()) _mm.push(n.trim()); });
        const _uniq = Array.from(new Set(_mm));
        if (_uniq.length > 0) {
          const _presentCount = _uniq.filter(n => !!checkedIn[n]).length;
          if (_presentCount === _uniq.length) { _jogoColor = '#4ade80'; _jogoOpacity = '0.95'; _jogoWeight = '800'; }
          else if (_presentCount > 0) { _jogoColor = '#fbbf24'; _jogoOpacity = '0.95'; _jogoWeight = '800'; }
        }
      }
      const jogoInline = matchLabel
        ? `<span style="font-weight:${_jogoWeight};color:${_jogoColor};opacity:${_jogoOpacity};font-size:0.72rem;white-space:nowrap;margin-left:6px;">${matchLabel}</span>`
        : '';
      const nameCell = `<div style="display:flex;align-items:baseline;gap:6px;min-width:0;"><span style="font-weight:600;font-size:0.92rem;color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isWO ? 'text-decoration:line-through;text-decoration-color:rgba(248,113,113,0.4);' : ''}${isOrg ? 'cursor:text;' : ''}" ${isOrg ? `onclick="event.stopPropagation();window._editParticipantName('${tId}','${safeName}')" title="Clique para editar"` : ''}>${_safeName}</span>${vipTag}${isStandby ? presenceDot : ''}${jogoInline}</div>`;
      // Inline layout: name+Jogo anchored to top-left, teams stack to the right, "vs" at top-right.
      // Mobile (< 768px) falls back to name on top, matchup block below.
      const _isNarrow = typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 768;
      let infoBlock;
      if (hasMatchup && !_isNarrow) {
        infoBlock = `<div style="display:grid;grid-template-columns:auto 1fr auto;column-gap:10px;align-items:start;min-width:0;">${nameCell}${teamsCell || '<span></span>'}${vsCell || '<span></span>'}</div>`;
      } else if (hasMatchup) {
        const matchupRow = `<div style="display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:start;margin-top:3px;">${teamsCell || '<span></span>'}${vsCell || '<span></span>'}</div>`;
        infoBlock = nameCell + matchupRow;
      } else {
        infoBlock = nameCell;
      }
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${cardBg};border:1px solid ${cardBorder};${isVipPlayer ? 'border-left:3px solid #fbbf24;' : ''}transition:all 0.2s;">
            <img src="${_pAvatar}" ${_pAvatarErr} data-player-name="${_safeName}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${mc ? 'rgba(16,185,129,0.4)' : isAbsent ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'};" />
            <div style="flex:1;overflow:hidden;">
                ${standbyHeader}
                ${infoBlock}
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                ${woBadge}
                ${presentToggle}
                ${woBtn}
            </div>
        </div>`;
    }).join('');

  } else {
    // ── Normal mode: team cards with drag/split/delete ──
    gridStyle = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:1rem;';

    cardsStr = parts.map((p, idx) => {
      const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || _t('participants.participant', {n: idx + 1}));
      const isTeam = pName.includes('/');

      const vipsMap = t.vips || {};
      const isVipEarly = !!vipsMap[pName];
      let cardStyle = '';
      if (isVipEarly) {
        cardStyle = 'background: linear-gradient(135deg, rgba(161,98,7,0.5) 0%, rgba(234,179,8,0.35) 100%); border: 2px solid rgba(251,191,36,0.7); box-shadow: 0 0 12px rgba(251,191,36,0.15);';
      } else if (isTeam) {
        cardStyle = 'background: linear-gradient(135deg, rgba(15, 118, 110, 0.6) 0%, rgba(20, 184, 166, 0.6) 100%); border: 1px solid rgba(20, 184, 166, 0.5);';
      } else {
        cardStyle = 'background: linear-gradient(135deg, rgba(67, 56, 202, 0.6) 0%, rgba(99, 102, 241, 0.6) 100%); border: 1px solid rgba(99, 102, 241, 0.5);';
      }

      let pNameHtml = '';
      if (isTeam) {
        pNameHtml = pName.split('/').map((n, i) => {
          const _nm = n.trim();
          const _nmSafe = _nm.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const _mSeed = encodeURIComponent(_nm);
          const _mCached = (window._playerPhotoCache && window._playerPhotoCache[_nm.toLowerCase()] && window._playerPhotoCache[_nm.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[_nm.toLowerCase()] : '';
          const _mInitials = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _mSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
          const _mPhoto = _mCached || _mInitials;
          const _mErr = `onerror="this.onerror=null;this.src='${_mInitials}'"`;
          const _nmH = window._safeHtml(_nm);
          const _editAttr = isOrg ? `onclick="event.stopPropagation();window._editParticipantName('${t.id}','${_nmSafe}')" title="Clique para editar" style="font-weight:700;font-size:0.95rem;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:text;"` : `style="font-weight:700;font-size:0.95rem;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;" onclick="event.stopPropagation();if(typeof window._showPlayerStats==='function')window._showPlayerStats('${_nmSafe}')" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" title="${_nmH}"`;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;overflow:hidden;"><img src="${_mPhoto}" ${_mErr} data-player-name="${_nmH}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;"><span ${_editAttr}>${_nmH}</span></div>`;
        }).join('');
      } else {
        const _pSafe = pName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const _pSeedN = encodeURIComponent(pName);
        const _pCachedN = (window._playerPhotoCache && window._playerPhotoCache[pName.toLowerCase()] && window._playerPhotoCache[pName.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[pName.toLowerCase()] : '';
        const _pInitialsN = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _pSeedN + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
        const _pPhotoN = _pCachedN || _pInitialsN;
        const _pErrN = `onerror="this.onerror=null;this.src='${_pInitialsN}'"`;
        const _pNameH = window._safeHtml(pName);
        const _editAttrN = isOrg ? `onclick="event.stopPropagation();window._editParticipantName('${t.id}','${_pSafe}')" title="Clique para editar" style="font-weight:600;font-size:0.95rem;color:var(--text-bright);text-overflow:ellipsis;white-space:nowrap;overflow:hidden;cursor:text;"` : `style="font-weight:600;font-size:0.95rem;color:var(--text-bright);text-overflow:ellipsis;white-space:nowrap;overflow:hidden;cursor:pointer;" onclick="event.stopPropagation();if(typeof window._showPlayerStats==='function')window._showPlayerStats('${_pSafe}')" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" title="${_pNameH}"`;
        pNameHtml = `<div style="display:flex;align-items:center;gap:8px;overflow:hidden;"><img src="${_pPhotoN}" ${_pErrN} data-player-name="${_pNameH}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;"><span ${_editAttrN}>${_pNameH}</span></div>`;
      }

      const vips = t.vips || {};
      const safeP = pName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const isVip = !!vips[pName];
      const vipBadge = isVip ? '<span style="background:linear-gradient(135deg,#eab308,#fbbf24);color:#1a1a2e;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:4px;letter-spacing:0.5px;margin-left:4px;">⭐ VIP</span>' : '';

      // Label de tipo: origem da equipe
      const teamOrigins = t.teamOrigins || {};
      let teamLabel = _t('participants.teamIndividual');
      if (isTeam) {
          const origin = teamOrigins[pName];
          if (origin === 'inscrita') teamLabel = _t('tourn.teamEnrolled');
          else if (origin === 'sorteada') teamLabel = _t('tourn.teamDrawn');
          else if (origin === 'formada') teamLabel = _t('tourn.teamFormed');
          else teamLabel = _t('tourn.teamFormed');
      }
      const typeText = teamLabel + vipBadge;

      let actionsDiv = '';
      let dragProps = '';
      if (isOrg && !drawDone) {
        const vipBtn = `<button class="btn btn-micro" title="${isVip ? _t('tourn.removeVip') : _t('tourn.markVip')}" style="background: ${isVip ? 'linear-gradient(135deg,rgba(234,179,8,0.35),rgba(251,191,36,0.25))' : 'rgba(234,179,8,0.08)'}; color: ${isVip ? '#fbbf24' : '#a3842a'}; border: 1px ${isVip ? 'solid' : 'dashed'} ${isVip ? 'rgba(251,191,36,0.6)' : 'rgba(234,179,8,0.3)'}; letter-spacing: 0.5px;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window._toggleVip('${t.id}', '${safeP}');">⭐ VIP</button>`;
        const delBtn = `<button class="btn btn-micro" title="${_t('btn.remove')}" style="background: rgba(239,68,68,0.1); color: #ef4444; border: 1px dashed #ef4444;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.removeParticipantFunction('${t.id}', ${idx});">🗑️</button>`;
        let splitBtn = '';
        if (pName.includes('/')) {
          splitBtn = `<button class="btn btn-micro" title="${_t('participants.splitTeam')}" style="background: rgba(14,165,233,0.1); color: #38bdf8; border: 1px dashed #0ea5e9;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.splitParticipantFunction('${t.id}', ${idx});">✂️</button>`;
        }
        actionsDiv = `<div style="display:flex;gap:4px;justify-content:flex-end;margin-top:6px;">${vipBtn}${splitBtn}${delBtn}</div>`;
        dragProps = `draggable="true" ondragstart="window.handleDragStart(event, ${idx}, '${t.id}')" ondragend="window.handleDragEnd(event)" ondragover="window.handleDragOver(event)" ondragenter="window.handleDragEnter(event)" ondragleave="window.handleDragLeave(event)" ondrop="window.handleDropTeam(event, ${idx})"`;
      }

      const bgNum = isVip ? '⭐' : idx + 1;
      return `
        <div class="participant-card" ${dragProps} style="${cardStyle} border-radius:12px;padding:12px;position:relative;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s;${!drawDone && isOrg ? 'cursor:grab;' : ''}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:${String(bgNum).length > 2 ? '2.8rem' : '3.5rem'};font-weight:900;color:rgba(255,255,255,0.08);line-height:1;pointer-events:none;user-select:none;">${bgNum}</div>
            <div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:0;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;">
                        ${pNameHtml}
                        <div style="font-size:0.7rem;color:var(--text-muted);opacity:0.6;margin-top:4px;">${typeText}</div>
                    </div>
                </div>
                ${actionsDiv}
            </div>
        </div>`;
    }).join('');
  }

  // ── Filter controls (only when check-in active) ──
  const pendingCount = totalIndividuals - checkedCount - absentConfirmedCount;
  const pctPresent = totalIndividuals > 0 ? Math.round(checkedCount / totalIndividuals * 100) : 0;

  const checkInControls = canCheckIn ? `
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;margin-bottom:4px;flex-wrap:wrap;">
        <button class="btn btn-pill btn-sm" onclick="window._setCheckInFilter('${tId}', 'all')" style="border:1px solid ${currentFilter === 'all' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'all' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'all' ? '#a5b4fc' : 'var(--text-muted)'};">Todos (${totalIndividuals})</button>
        <button class="btn btn-pill btn-sm" onclick="window._setCheckInFilter('${tId}', 'present')" style="border:1px solid ${currentFilter === 'present' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'present' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'present' ? '#4ade80' : 'var(--text-muted)'};">Presentes (${checkedCount})</button>
        <button class="btn btn-pill btn-sm" onclick="window._setCheckInFilter('${tId}', 'absent')" style="border:1px solid ${currentFilter === 'absent' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'absent' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'absent' ? '#f87171' : 'var(--text-muted)'};">Ausentes (${absentConfirmedCount})</button>
        <button class="btn btn-pill btn-sm" onclick="window._setCheckInFilter('${tId}', 'pending')" style="border:1px solid ${currentFilter === 'pending' ? 'rgba(148,163,184,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'pending' ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'pending' ? '#cbd5e1' : 'var(--text-muted)'};">Aguardando (${pendingCount})</button>
        <div style="flex:1;min-width:80px;background:rgba(255,255,255,0.06);border-radius:6px;height:8px;">
            <div style="width:${pctPresent}%;height:100%;background:linear-gradient(90deg,#10b981,#4ade80);border-radius:6px;transition:width 0.3s;"></div>
        </div>
        <span style="font-size:0.8rem;color:#94a3b8;font-weight:700;">${pctPresent}%</span>
    </div>
  ` : '';

  // ── "Iniciar Torneio" banner (after draw, before start) ──
  const startBanner = (isOrg && drawDone && !t.tournamentStarted) ? `
    <div style="margin-bottom:1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
        <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">${_t('participants.drawDoneMsg')}</p>
        <button class="btn btn-success btn-cta hover-lift" onclick="window._startTournament('${tId}')">
            ▶ ${_t('participants.startTournament')}
        </button>
    </div>` : '';

  // ── Started badge ──
  const startedBadge = t.tournamentStarted ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;">
        <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;"></span>
        <span style="font-size:0.85rem;font-weight:700;color:#4ade80;">${_t('participants.inProgressBadge')}</span>
    </div>` : '';

  // Ready matches banner (check-in: jogos prontos para chamar)
  const readyBannerHtml = (typeof window._renderReadyMatchesBanner === 'function') ? window._renderReadyMatchesBanner(t) : '';

  // Standby / waitlist panel
  const standbyPanelHtml = (typeof window._renderStandbyPanel === 'function') ? window._renderStandbyPanel(t, isOrg) : '';

  container.innerHTML = `
    ${(typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({
          href: '#tournaments/' + t.id,
          extraStyle: 'padding-bottom:0;',
          middleHtml: '<div style="flex:1;min-width:0;overflow:hidden;">' +
            '<h2 style="margin:0;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              _t('participants.title') + ' — ' + window._safeHtml(t.name) +
            '</h2>' +
          '</div>',
          rightHtml: '<div style="display:flex;gap:4px;flex-shrink:0;">' +
            '<span class="badge badge-info" style="font-size:0.65rem;">' + (t.format || _t('participants.defaultFormat')) + '</span>' +
            '<span class="badge" style="background:rgba(255,255,255,0.1);color:var(--text-muted);font-size:0.65rem;">' + individualCount + '</span>' +
          '</div>',
          belowHtml: checkInControls
        })
      : ''}
    ${startBanner}
    ${startedBadge}
    ${readyBannerHtml}
    ${parts.length > 0 ? `
      <div style="${gridStyle}">
        ${cardsStr}
      </div>
    ` : `
      <div style="text-align:center;padding:3rem;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);border-radius:16px;">
        <p class="text-muted">Nenhum inscrito ainda.</p>
      </div>
    `}
    ${standbyPanelHtml}
  `;
}
