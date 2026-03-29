// ─── Participants View ────────────────────────────────────────────────────────

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
  if (t.checkedIn[playerName]) {
    // Desmarcar presença → volta ao estado "sem confirmação"
    delete t.checkedIn[playerName];
  } else {
    // Marcar presente → limpa ausência se existia
    t.checkedIn[playerName] = Date.now();
    delete t.absent[playerName];
  }
  window.AppStore.sync();
  _reRenderParticipants();
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
  window.AppStore.sync();
  _reRenderParticipants();
};

window._resetCheckIn = function (tId) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  t.checkedIn = {};
  t.absent = {};
  window.AppStore.sync();
  _reRenderParticipants();
  if (typeof showNotification === 'function') showNotification('Chamada Reiniciada', 'Todos os check-ins e ausências foram removidos.', 'info');
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
  if (typeof showNotification === 'function') showNotification('Torneio Iniciado!', 'A presença dos participantes já pode ser registrada.', 'success');
  _reRenderParticipants();
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
  window.AppStore.sync();
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

  // Encontrar o match onde este time joga
  let matchEntry = null;
  let matchIdx = -1;
  let matchSide = null; // 'p1' or 'p2'
  if (t.matches) {
    t.matches.forEach((m, mi) => {
      if (m.winner) return; // já decidido
      if (m.p1 === teamName) { matchEntry = m; matchIdx = mi; matchSide = 'p1'; }
      else if (m.p2 === teamName) { matchEntry = m; matchIdx = mi; matchSide = 'p2'; }
    });
  }

  const standby = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
  const hasStandby = standby.length > 0;
  const friendlyNum = matchIdx >= 0 ? matchIdx + 1 : '?';
  const opponentSide = matchSide === 'p1' ? 'p2' : 'p1';
  const opponent = matchEntry ? matchEntry[opponentSide] : null;

  let confirmTitle, confirmMsg, confirmBtn;

  if (hasStandby) {
    confirmTitle = 'Declarar Ausência';
    confirmMsg = `Declarar ${playerName} (${teamName}) como ausente no Jogo ${friendlyNum}?\n\nHá jogadores na lista de espera. O próximo da fila será promovido para substituir.`;
    confirmBtn = 'Substituir da Lista de Espera';
  } else {
    confirmTitle = 'Declarar Ausência — W.O.';
    confirmMsg = `Declarar ${playerName} (${teamName}) como ausente no Jogo ${friendlyNum}?\n\nNão há lista de espera. ${opponent || 'O adversário'} vencerá por W.O. e avançará.`;
    confirmBtn = 'Confirmar W.O.';
  }

  showConfirmDialog(confirmTitle, confirmMsg, function () {
    // Marcar o jogador como ausente confirmado
    if (!t.checkedIn) t.checkedIn = {};
    if (!t.absent) t.absent = {};
    delete t.checkedIn[playerName];
    t.absent[playerName] = Date.now();

    if (hasStandby && matchEntry) {
      // Promover próximo da lista de espera QUE ESTEJA PRESENTE
      if (!t.checkedIn) t.checkedIn = {};
      let nextStandby = null;
      let nextStandbyIdx = -1;
      for (let si = 0; si < standby.length; si++) {
        const sName = typeof standby[si] === 'string' ? standby[si] : (standby[si].displayName || standby[si].name || standby[si].email || '');
        // Check if any member of this standby entry is present
        const sMembers = sName.includes('/') ? sName.split('/').map(n => n.trim()).filter(n => n) : [sName];
        const allPresent = sMembers.every(m => !!t.checkedIn[m]);
        if (allPresent) { nextStandby = standby[si]; nextStandbyIdx = si; break; }
      }
      if (!nextStandby) {
        if (typeof showNotification === 'function') showNotification('Sem substituto presente', 'Nenhum jogador da lista de espera está marcado como presente. Marque a presença de um jogador da lista de espera primeiro.', 'warning');
        return;
      }
      const nextName = typeof nextStandby === 'string' ? nextStandby : (nextStandby.displayName || nextStandby.name || nextStandby.email || '');

      // Substituir o time ausente no match
      matchEntry[matchSide] = nextName;

      // Atualizar participants array
      const pIdx = partsArr.findIndex(p => {
        const pn = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
        return pn === teamName;
      });
      if (pIdx >= 0) partsArr[pIdx] = nextName;
      t.participants = partsArr;

      // Remover da lista de espera (pelo índice encontrado)
      t.standbyParticipants = [...standby.slice(0, nextStandbyIdx), ...standby.slice(nextStandbyIdx + 1)];

      window.AppStore.logAction(tId, `Ausência: ${playerName} (${teamName}) substituído por ${nextName} da lista de espera — Jogo ${friendlyNum}`);
      window.AppStore.sync();
      if (typeof showNotification === 'function') showNotification('Substituição Realizada', `${nextName} entrou no lugar de ${teamName} no Jogo ${friendlyNum}.`, 'success');
      _reRenderParticipants();

    } else if (matchEntry) {
      // W.O. — adversário vence
      matchEntry.scoreP1 = matchSide === 'p1' ? 0 : 'W.O.';
      matchEntry.scoreP2 = matchSide === 'p2' ? 0 : 'W.O.';
      matchEntry.winner = matchEntry[opponentSide];
      matchEntry.wo = true;

      // Avançar vencedor
      if (typeof _advanceWinner === 'function') {
        _advanceWinner(t, matchEntry);
      } else if (matchEntry.nextMatchId) {
        // fallback: advance manually
        const next = (t.matches || []).find(nm => nm.id === matchEntry.nextMatchId);
        if (next) {
          if (!next.p1 || next.p1 === 'TBD') next.p1 = matchEntry.winner;
          else if (!next.p2 || next.p2 === 'TBD') next.p2 = matchEntry.winner;
        }
      }

      window.AppStore.logAction(tId, `W.O.: ${teamName} ausente — ${matchEntry.winner} vence Jogo ${friendlyNum} por W.O.`);
      window.AppStore.sync();
      if (typeof showNotification === 'function') showNotification('W.O. Aplicado', `${matchEntry.winner} vence o Jogo ${friendlyNum} por W.O.`, 'warning');
      _reRenderParticipants();

    }
  }, null, { type: 'warning', confirmText: confirmBtn, cancelText: 'Esperar mais' });
};

function renderParticipants(container, tournamentId) {
  const tId = tournamentId;
  const t = tId && window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;

  if (!t) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:3rem;"><h3>Torneio não encontrado</h3><a href="#dashboard" class="btn btn-primary" style="margin-top:1rem;display:inline-block;">Dashboard</a></div>`;
    return;
  }

  const isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);
  const parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

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
    const nameToMatch = {};
    const nameToMatchDecided = {};
    const nameToOpponent = {};
    if (t.matches) {
      t.matches.forEach((m, mi) => {
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
    }

    const allIndividuals = [];
    parts.forEach((p, idx) => {
      const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || 'Participante ' + (idx + 1));
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

    // Sort: alphabetical
    allIndividuals.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    cardsStr = allIndividuals.map((ind) => {
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
      let vsLine = '';
      if (ind.opponent && !isStandbyPure) {
        const oppMembers = ind.opponent.includes('/') ? ind.opponent.split('/').map(n => n.trim()).filter(n => n) : [ind.opponent];
        const oppDots = oppMembers.map(n => dotHtml(n)).join('<span style="color:rgba(255,255,255,0.15);margin:0 2px;">/</span>');
        vsLine = `<span style="font-size:0.65rem;font-weight:800;color:rgba(255,255,255,0.2);margin:0 3px;">vs</span>${oppDots}`;
      }

      const matchLabel = (!isStandbyPure && ind.matchNum) ? `Jogo ${ind.matchNum}` : '';
      const standbyLabel = ind.isStandby ? '<span style="font-weight:700;color:#fbbf24;opacity:0.8;margin-right:4px;">Lista de Espera</span>' : '';
      const infoLine = (teamLine || vsLine || matchLabel || standbyLabel) ? `<div style="font-size:0.7rem;color:var(--text-muted);opacity:0.7;margin-top:2px;display:flex;align-items:center;flex-wrap:wrap;gap:2px;">${standbyLabel}${matchLabel ? `<span style="font-weight:700;color:var(--text-muted);opacity:0.6;margin-right:4px;">${matchLabel}</span>` : ''}${teamLine}${vsLine}</div>` : '';

      // W.O. check
      const woMatch = ind.matchNum && t.matches ? t.matches[ind.matchNum - 1] : null;
      const isWO = woMatch && woMatch.wo && woMatch.winner && woMatch.winner !== (ind.teamName || ind.name);

      const isStandby = !!ind.isStandby;

      // Action buttons — 3 estados: presente (toggle), ausente (confirma ausência), sem confirmação (default)
      const canAct = isStandby ? true : (!ind.matchDecided && !isWO);

      // Presente: sempre clicável (toggle on/off)
      const presentBtn = canAct
        ? `<button onclick="event.stopPropagation(); window._toggleCheckIn('${tId}', '${safeName}')" style="padding:4px 12px;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;border:1px solid ${mc ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.2)'};background:${mc ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.08)'};color:#4ade80;${mc ? 'opacity:1;' : 'opacity:0.6;'}">Presente</button>`
        : '';

      // Ausente: standby/sem jogo → marca ausência confirmada (toggle); regular com jogo → declara ausência com W.O./substituição
      const isStandbyOrNoMatch = isStandby || !ind.matchNum;
      const absentAction = isStandbyOrNoMatch
        ? `window._markAbsent('${tId}', '${safeName}')`
        : `window._declareAbsent('${tId}', '${safeName}')`;
      const absentBtn = canAct && isOrg
        ? `<button onclick="event.stopPropagation(); ${absentAction}" style="padding:4px 12px;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;border:1px solid ${isAbsent ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'};background:${isAbsent ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.08)'};color:#f87171;${isAbsent ? 'opacity:1;' : 'opacity:0.6;'}">Ausente</button>`
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

      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${cardBg};border:1px solid ${cardBorder};${isVipPlayer ? 'border-left:3px solid #fbbf24;' : ''}transition:all 0.2s;">
            <div style="flex:1;overflow:hidden;">
                <div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:600;font-size:0.92rem;color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isWO ? 'text-decoration:line-through;text-decoration-color:rgba(248,113,113,0.4);' : ''}">${ind.name}</span>${vipTag}${isStandby ? presenceDot : ''}</div>
                ${infoLine}
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                ${woBadge}
                ${presentBtn}
                ${absentBtn}
            </div>
        </div>`;
    }).join('');

  } else {
    // ── Normal mode: team cards with drag/split/delete ──
    gridStyle = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:1rem;';

    cardsStr = parts.map((p, idx) => {
      const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || 'Participante ' + (idx + 1));
      const isTeam = pName.includes('/');

      let cardStyle = '';
      if (isVip) {
        cardStyle = 'background: linear-gradient(135deg, rgba(161,98,7,0.5) 0%, rgba(234,179,8,0.35) 100%); border: 2px solid rgba(251,191,36,0.7); box-shadow: 0 0 12px rgba(251,191,36,0.15);';
      } else if (isTeam) {
        cardStyle = 'background: linear-gradient(135deg, rgba(15, 118, 110, 0.6) 0%, rgba(20, 184, 166, 0.6) 100%); border: 1px solid rgba(20, 184, 166, 0.5);';
      } else {
        cardStyle = 'background: linear-gradient(135deg, rgba(67, 56, 202, 0.6) 0%, rgba(99, 102, 241, 0.6) 100%); border: 1px solid rgba(99, 102, 241, 0.5);';
      }

      let pNameHtml = '';
      if (isTeam) {
        pNameHtml = pName.split('/').map((n, i) => `<div style="font-weight: ${i === 0 ? '700' : '500'}; font-size: ${i === 0 ? '0.95rem' : '0.85rem'}; color: ${i === 0 ? 'var(--text-bright)' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;" title="${n.trim()}">${i === 0 ? '👑 ' : '👤 '}${n.trim()}</div>`).join('');
      } else {
        pNameHtml = `<div style="font-weight: 600; font-size: 0.95rem; color: var(--text-bright); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="${pName}">${pName}</div>`;
      }

      const vips = t.vips || {};
      const safeP = pName.replace(/'/g, "\\'");
      const isVip = !!vips[pName];
      const vipBadge = isVip ? '<span style="background:linear-gradient(135deg,#eab308,#fbbf24);color:#1a1a2e;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:4px;letter-spacing:0.5px;margin-left:4px;">⭐ VIP</span>' : '';

      // Label de tipo: origem da equipe
      const teamOrigins = t.teamOrigins || {};
      let teamLabel = 'Inscrição Individual';
      if (isTeam) {
          const origin = teamOrigins[pName];
          if (origin === 'inscrita') teamLabel = 'Equipe Inscrita';
          else if (origin === 'sorteada') teamLabel = 'Equipe Sorteada';
          else if (origin === 'formada') teamLabel = 'Equipe Formada';
          else teamLabel = 'Equipe Formada';
      }
      const typeText = teamLabel + vipBadge;

      let actionsDiv = '';
      let dragProps = '';
      if (isOrg && !drawDone) {
        const vipBtn = `<button title="${isVip ? 'Remover VIP' : 'Marcar como VIP'}" style="background: ${isVip ? 'linear-gradient(135deg,rgba(234,179,8,0.35),rgba(251,191,36,0.25))' : 'rgba(234,179,8,0.08)'}; color: ${isVip ? '#fbbf24' : '#a3842a'}; border: 1px ${isVip ? 'solid' : 'dashed'} ${isVip ? 'rgba(251,191,36,0.6)' : 'rgba(234,179,8,0.3)'}; border-radius: 6px; cursor: pointer; padding: 2px 8px; font-size: 0.75rem; font-weight: 800; transition: transform 0.2s; letter-spacing: 0.5px;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window._toggleVip('${t.id}', '${safeP}');">⭐ VIP</button>`;
        const delBtn = `<button title="Remover" style="background: rgba(239,68,68,0.1); color: #ef4444; border: 1px dashed #ef4444; border-radius: 6px; cursor: pointer; padding: 2px 6px; font-size: 0.8rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.removeParticipantFunction('${t.id}', ${idx});">🗑️</button>`;
        let splitBtn = '';
        if (pName.includes('/')) {
          splitBtn = `<button title="Desfazer Equipe" style="background: rgba(14,165,233,0.1); color: #38bdf8; border: 1px dashed #0ea5e9; border-radius: 6px; cursor: pointer; padding: 2px 6px; font-size: 0.8rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.splitParticipantFunction('${t.id}', ${idx});">✂️</button>`;
        }
        actionsDiv = `<div style="display:flex;gap:4px;justify-content:flex-end;margin-top:6px;">${vipBtn}${splitBtn}${delBtn}</div>`;
        dragProps = `draggable="true" ondragstart="window.handleDragStart(event, ${idx}, '${t.id}')" ondragend="window.handleDragEnd(event)" ondragover="window.handleDragOver(event)" ondragenter="window.handleDragEnter(event)" ondragleave="window.handleDragLeave(event)" ondrop="window.handleDropTeam(event, ${idx})"`;
      }

      return `
        <div class="participant-card" ${dragProps} style="${cardStyle} border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:0;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s;${!drawDone && isOrg ? 'cursor:grab;' : ''}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, var(--primary-color), var(--secondary-color));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.1rem;flex-shrink:0;pointer-events:none;">${idx + 1}</div>
                <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;">
                    ${pNameHtml}
                    <div style="font-size:0.7rem;color:var(--text-muted);opacity:0.6;margin-top:4px;">${typeText}</div>
                </div>
            </div>
            ${actionsDiv}
        </div>`;
    }).join('');
  }

  // ── Filter controls (only when check-in active) ──
  const pendingCount = totalIndividuals - checkedCount - absentConfirmedCount;
  const pctPresent = totalIndividuals > 0 ? Math.round(checkedCount / totalIndividuals * 100) : 0;

  const checkInControls = canCheckIn ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;flex-wrap:wrap;">
        <button onclick="window._setCheckInFilter('${tId}', 'all')" style="padding:6px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'all' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'all' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'all' ? '#a5b4fc' : 'var(--text-muted)'};">Todos (${totalIndividuals})</button>
        <button onclick="window._setCheckInFilter('${tId}', 'present')" style="padding:6px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'present' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'present' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'present' ? '#4ade80' : 'var(--text-muted)'};">Presentes (${checkedCount})</button>
        <button onclick="window._setCheckInFilter('${tId}', 'absent')" style="padding:6px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'absent' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'absent' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'absent' ? '#f87171' : 'var(--text-muted)'};">Ausentes (${absentConfirmedCount})</button>
        <button onclick="window._setCheckInFilter('${tId}', 'pending')" style="padding:6px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'pending' ? 'rgba(148,163,184,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'pending' ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'pending' ? '#cbd5e1' : 'var(--text-muted)'};">Aguardando (${pendingCount})</button>
        <div style="flex:1;min-width:80px;background:rgba(255,255,255,0.06);border-radius:6px;height:8px;">
            <div style="width:${pctPresent}%;height:100%;background:linear-gradient(90deg,#10b981,#4ade80);border-radius:6px;transition:width 0.3s;"></div>
        </div>
        <span style="font-size:0.8rem;color:#94a3b8;font-weight:700;">${pctPresent}%</span>
        ${(checkedCount > 0 || absentConfirmedCount > 0) ? `<button onclick="window._resetCheckIn('${tId}')" style="background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);padding:4px 12px;border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;">Limpar</button>` : ''}
    </div>
  ` : '';

  // ── "Iniciar Torneio" banner (after draw, before start) ──
  const startBanner = (isOrg && drawDone && !t.tournamentStarted) ? `
    <div style="margin-bottom:1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
        <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Sorteio realizado. Inicie o torneio para habilitar a chamada de presença.</p>
        <button class="btn hover-lift" onclick="window._startTournament('${tId}')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:800;font-size:1.1rem;padding:14px 40px;border-radius:12px;box-shadow:0 6px 20px rgba(16,185,129,0.4);letter-spacing:0.5px;">
            ▶ Iniciar Torneio
        </button>
    </div>` : '';

  // ── Started badge ──
  const startedBadge = t.tournamentStarted ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;">
        <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;"></span>
        <span style="font-size:0.85rem;font-weight:700;color:#4ade80;">Torneio em andamento — marque a presença abaixo</span>
    </div>` : '';

  container.innerHTML = `
    <div class="mb-4">
      <button class="btn btn-sm hover-lift" style="background:rgba(255,255,255,0.05);color:var(--text-bright);border:1px solid rgba(255,255,255,0.1);display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-weight:500;"
        onclick="window.history.length > 1 ? window.history.back() : window.location.hash='#bracket/${t.id}'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>
    </div>
    <div class="mb-4">
      <h2 style="margin:0;">Inscritos — ${t.name}</h2>
      <div class="d-flex gap-2 mt-1">
        <span class="badge badge-info">${t.format || 'Eliminatórias'}</span>
        <span class="badge" style="background:rgba(255,255,255,0.1);color:var(--text-muted);">${individualCount} participante${individualCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
    ${startBanner}
    ${startedBadge}
    ${checkInControls}
    ${parts.length > 0 ? `
      <div style="${gridStyle}">
        ${cardsStr}
      </div>
    ` : `
      <div style="text-align:center;padding:3rem;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);border-radius:16px;">
        <p class="text-muted">Nenhum inscrito ainda.</p>
      </div>
    `}
  `;
}
