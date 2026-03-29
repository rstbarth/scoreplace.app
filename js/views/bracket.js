// ─── Bracket / Standings View ───────────────────────────────────────────────

function renderBracket(container, tournamentId) {
  const tId = tournamentId || window._lastActiveTournamentId;
  const t = tId && window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;

  if (!t) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:3rem;"><h3>Torneio não encontrado</h3><a href="#dashboard" class="btn btn-primary" style="margin-top:1rem;display:inline-block;">Dashboard</a></div>`;
    return;
  }

  const isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);
  const canEnterResult = isOrg || t.resultEntry === 'players' || t.resultEntry === 'referee';
  const isLiga = t.format === 'Liga';
  const isSuico = t.format === 'Suíço Clássico';
  const isDupla = t.format === 'Dupla Eliminatória';

  const isGrupos = t.format === 'Fase de Grupos + Eliminatórias';
  const hasContent = (t.matches && t.matches.length) || (t.rounds && t.rounds.length) || (t.groups && t.groups.length);

  const headerHtml = `
    <div class="mb-4">
      <button class="btn btn-sm hover-lift" style="background:rgba(255,255,255,0.05);color:var(--text-bright);border:1px solid rgba(255,255,255,0.1);display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-weight:500;"
        onclick="window.history.length > 1 ? window.history.back() : window.location.hash='#tournaments/${t.id}'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>
    </div>
    <div class="d-flex justify-between align-center mb-4" style="flex-wrap:wrap;gap:1rem;">
      <div>
        <h2 style="margin:0;">${isLiga || isSuico ? 'Classificação — ' : isGrupos ? 'Fase de Grupos — ' : 'Chaves — '}${t.name}</h2>
        <div class="d-flex gap-2 mt-1">
          ${hasContent ? `<span class="badge badge-success" style="background:rgba(16,185,129,0.2);color:#34d399;">Sorteio Realizado</span>` : `<span class="badge badge-warning">Aguardando Sorteio</span>`}
          <span class="badge badge-info">${t.format || 'Eliminatórias'}</span>
          ${isGrupos && t.currentStage === 'groups' ? `<span class="badge badge-warning">Fase de Grupos</span>` : ''}
          ${isGrupos && t.currentStage === 'elimination' ? `<span class="badge badge-success" style="background:rgba(16,185,129,0.2);color:#34d399;">Fase Eliminatória</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${isOrg && !hasContent ? `<button class="btn btn-primary" onclick="window.generateDrawFunction('${t.id}')">🎲 Realizar Sorteio</button>` : ''}
        <a href="#participants/${t.id}" class="btn btn-secondary">👥 Inscritos</a>
        <a href="#rules/${t.id}" class="btn btn-secondary">📋 Regras</a>
      </div>
    </div>`;

  // ── Banner "Iniciar Torneio" (após sorteio, antes de iniciar) ──────────────
  const hasDrawContent = (t.matches && t.matches.length > 0) || (t.rounds && t.rounds.length > 0) || (t.groups && t.groups.length > 0);
  const startTournamentBanner = (isOrg && hasDrawContent && !t.tournamentStarted) ? `
    <div style="margin:1rem 0 1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
        <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Sorteio realizado. Inicie o torneio para habilitar a chamada de presença.</p>
        <button class="btn hover-lift" onclick="window._startTournament('${t.id}')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:800;font-size:1.1rem;padding:14px 40px;border-radius:12px;box-shadow:0 6px 20px rgba(16,185,129,0.4);letter-spacing:0.5px;">
            ▶ Iniciar Torneio
        </button>
    </div>` : '';

  // ── Liga / Suíço ───────────────────────────────────────────────────────────
  if (isLiga || isSuico) {
    container.innerHTML = headerHtml + startTournamentBanner + renderStandings(t, isOrg, canEnterResult);
    return;
  }

  // ── Fase de Grupos ─────────────────────────────────────────────────────────
  if (isGrupos && t.groups && t.groups.length > 0) {
    if (t.currentStage === 'groups') {
      container.innerHTML = headerHtml + startTournamentBanner + renderGroupStage(t, isOrg, canEnterResult);
      return;
    }
    // If stage is elimination, fall through to bracket rendering below
  }

  // ── Sem matches ────────────────────────────────────────────────────────────
  if ((!t.matches || t.matches.length === 0) && !hasContent) {
    container.innerHTML = headerHtml + `
      <div style="display:flex;justify-content:center;align-items:center;min-height:40vh;">
        <div class="text-center text-muted" style="background:rgba(255,255,255,0.02);padding:3rem;border-radius:24px;border:1px dashed rgba(255,255,255,0.1);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.5;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <h3 style="color:var(--text-bright);margin-bottom:.5rem;">Nenhuma chave gerada ainda</h3>
          <p style="max-width:400px;margin:0 auto 1.5rem;">As chaves aparecerão aqui após o organizador realizar o sorteio.</p>
          ${isOrg ? `<button class="btn hover-lift" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:600;padding:12px 24px;" onclick="window.generateDrawFunction('${t.id}')">🎲 Realizar Sorteio Agora</button>` : ''}
        </div>
      </div>`;
    return;
  }

  // ── Banner de jogos prontos (check-in ativo) ──────────────────────────────
  const readyBannerHtml = _renderReadyMatchesBanner(t);

  // ── Bracket ────────────────────────────────────────────────────────────────
  const standbyHtml = _renderStandbyPanel(t, isOrg);
  if (isDupla) {
    container.innerHTML = headerHtml + startTournamentBanner + readyBannerHtml + renderDoubleElimBracket(t, canEnterResult) + standbyHtml;
  } else {
    container.innerHTML = headerHtml + startTournamentBanner + readyBannerHtml + renderSingleElimBracket(t, canEnterResult) + standbyHtml;
  }

  // ── Scrollbar fixa no bottom da viewport ─────────────────────────────────
  _setupFixedScrollbar(container);
}

// ─── Banner de Jogos Prontos (ambos presentes) ──────────────────────────────
function _renderReadyMatchesBanner(t) {
  if (!t || !t.tournamentStarted || !t.checkedIn || !t.matches) return '';
  const ci = t.checkedIn;
  const hasAnyCheckin = Object.keys(ci).length > 0;
  if (!hasAnyCheckin) return '';

  // Find matches where both sides are fully checked in and not yet decided
  const readyMatches = [];
  const partialMatches = [];
  const waitingMatches = [];

  t.matches.forEach((m, idx) => {
    if (m.winner || m.isBye || !m.p1 || m.p1 === 'TBD' || !m.p2 || m.p2 === 'TBD') return;
    const p1s = _getCheckInStatus(t.id, m.p1);
    const p2s = _getCheckInStatus(t.id, m.p2);
    const friendlyNum = idx + 1;
    const entry = { match: m, friendlyNum, p1s, p2s };
    if (p1s === 'full' && p2s === 'full') {
      readyMatches.push(entry);
    } else if (p1s !== 'none' || p2s !== 'none') {
      partialMatches.push(entry);
    } else {
      waitingMatches.push(entry);
    }
  });

  if (readyMatches.length === 0 && partialMatches.length === 0) return '';

  // Helper: render one side (team/individual) as a row of dots + names (3 estados)
  const absentMap = t.absent || {};
  const renderSideRow = (name) => {
    if (!name || name === 'TBD' || name === 'BYE') return '';
    const members = name.includes(' / ') ? name.split(' / ').map(n => n.trim()).filter(n => n) : [name];
    const dots = members.map(n => {
      const present = !!ci[n];
      const isAbs = !!absentMap[n];
      const dotColor = present ? '#10b981' : isAbs ? '#ef4444' : '#64748b';
      const textColor = present ? '#4ade80' : isAbs ? '#f87171' : '#94a3b8';
      return `<span style="display:inline-flex;align-items:center;gap:3px;"><span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;display:inline-block;"></span><span style="font-size:0.78rem;color:${textColor};">${n}</span></span>`;
    }).join('<span style="font-size:0.65rem;color:rgba(255,255,255,0.15);margin:0 2px;">/</span>');
    return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${dots}</div>`;
  };

  const allMatches = [...readyMatches, ...partialMatches];

  const matchCards = allMatches.map(e => {
    const isReady = e.p1s === 'full' && e.p2s === 'full';
    const bg = isReady ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.08)';
    const border = isReady ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.2)';
    const labelColor = isReady ? '#4ade80' : '#fbbf24';
    return `
    <div style="padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:10px;display:flex;flex-direction:column;gap:4px;min-width:200px;flex:1;max-width:360px;">
      <div style="font-size:0.8rem;font-weight:800;color:${labelColor};letter-spacing:0.5px;">Jogo ${e.friendlyNum}</div>
      ${renderSideRow(e.match.p1)}
      <div style="font-size:0.6rem;font-weight:800;color:rgba(255,255,255,0.2);letter-spacing:2px;padding:0 2px;">VS</div>
      ${renderSideRow(e.match.p2)}
    </div>`;
  }).join('');

  return `
    <div style="margin-bottom:1.5rem;padding:16px 20px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);border-radius:14px;">
      ${readyMatches.length > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:1rem;">🟢</span>
          <span style="font-size:0.9rem;font-weight:700;color:#4ade80;">${readyMatches.length} jogo${readyMatches.length > 1 ? 's' : ''} pronto${readyMatches.length > 1 ? 's' : ''} para chamar</span>
        </div>` : ''}
      ${partialMatches.length > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;${readyMatches.length > 0 ? 'padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);' : ''}">
          <span style="font-size:1rem;">🟡</span>
          <span style="font-size:0.85rem;font-weight:600;color:#fbbf24;">${partialMatches.length} aguardando presença</span>
        </div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${matchCards}
      </div>
    </div>`;
}

// ─── Painel de Lista de Espera (Standby) ─────────────────────────────────────
function _renderStandbyPanel(t, isOrg) {
  const standby = Array.isArray(t.standbyParticipants) ? t.standbyParticipants : [];
  if (standby.length === 0) return '';

  const getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name || p.email || '?');
  const mode = (t.standbyMode === 'disqualify') ? 'teams' : (t.standbyMode || 'teams');
  const teamSize = parseInt(t.teamSize) || 1;

  // Mode description
  const modeDesc = {
    teams: 'Times formados na espera — time incompleto é desclassificado e substituído inteiro',
    individual: 'Jogadores avulsos — completam times com membros ausentes'
  };

  const listItems = standby.map((p, i) => {
    const name = getName(p);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border-left:4px solid ${i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.08)'};">
        <div style="width:28px;height:28px;border-radius:50%;background:${i === 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.08)'};display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;color:${i === 0 ? '#000' : '#94a3b8'};flex-shrink:0;">${i + 1}</div>
        <span style="font-weight:600;font-size:0.9rem;color:${i === 0 ? '#fbbf24' : '#94a3b8'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
        ${i === 0 ? '<span style="font-size:0.65rem;font-weight:800;color:#f59e0b;text-transform:uppercase;background:rgba(245,158,11,0.15);padding:2px 8px;border-radius:6px;white-space:nowrap;">Próximo</span>' : ''}
      </div>`;
  }).join('');

  // Build substitution UI based on mode
  let subsSection = '';
  if (isOrg && standby.length > 0) {
    if (mode === 'individual') {
      // Individual mode: dropdown lists individual players from all undecided R1 matches
      // Organizer picks the absent PLAYER, and the next standby individual fills that specific slot
      const r1Players = [];
      (t.matches || []).filter(m => m.round === 1 && !m.winner && !m.isBye).forEach(m => {
        // For team names like "A / B", list each member separately
        ['p1', 'p2'].forEach(slot => {
          const name = m[slot];
          if (!name || name === 'TBD' || name === 'BYE') return;
          if (name.includes(' / ')) {
            name.split(' / ').forEach((member, mi) => {
              r1Players.push({ display: member.trim(), teamName: name, matchId: m.id, slot, memberIdx: mi });
            });
          } else {
            r1Players.push({ display: name, teamName: name, matchId: m.id, slot, memberIdx: -1 });
          }
        });
      });

      if (r1Players.length > 0) {
        const options = r1Players.map(p =>
          `<option value="${p.matchId}|${p.slot}|${p.memberIdx}|${p.display}">${p.display}</option>`
        ).join('');

        subsSection = `
          <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid rgba(255,255,255,0.06);">
            <h4 style="margin:0 0 0.75rem;color:#f1f5f9;font-size:0.85rem;font-weight:700;">Substituir Jogador Ausente</h4>
            <p style="margin:0 0 1rem;font-size:0.78rem;color:#64748b;line-height:1.5;">Selecione o jogador que faltou. <strong style="color:#fbbf24;">${getName(standby[0])}</strong> ocupará a vaga dentro do time existente.</p>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <select id="standby-wo-select" style="flex:1;min-width:180px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:10px;padding:10px 12px;font-size:0.85rem;font-weight:600;">
                <option value="">Selecionar ausente...</option>
                ${options}
              </select>
              <button onclick="window._substituteFromStandby('${t.id}')"
                style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;border:none;padding:10px 20px;border-radius:10px;font-weight:800;font-size:0.85rem;cursor:pointer;white-space:nowrap;transition:all 0.2s;">
                Substituir
              </button>
            </div>
          </div>`;
      }
    } else {
      // Teams mode: dropdown lists full team names (p1/p2 in R1)
      // Incomplete team is disqualified and replaced by the next standby team
      const r1Teams = [];
      (t.matches || []).filter(m => m.round === 1 && !m.winner && !m.isBye).forEach(m => {
        if (m.p1 && m.p1 !== 'TBD' && m.p1 !== 'BYE') r1Teams.push({ name: m.p1, matchId: m.id, slot: 'p1' });
        if (m.p2 && m.p2 !== 'TBD' && m.p2 !== 'BYE') r1Teams.push({ name: m.p2, matchId: m.id, slot: 'p2' });
      });

      if (r1Teams.length > 0) {
        const options = r1Teams.map(p =>
          `<option value="${p.matchId}|${p.slot}">${p.name}</option>`
        ).join('');

        const nextTeam = teamSize > 1
          ? `Os próximos ${teamSize} jogadores da fila formarão o time substituto.`
          : `<strong style="color:#fbbf24;">${getName(standby[0])}</strong> assumirá a vaga.`;

        subsSection = `
          <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid rgba(255,255,255,0.06);">
            <h4 style="margin:0 0 0.75rem;color:#f1f5f9;font-size:0.85rem;font-weight:700;">Desclassificar Time Incompleto</h4>
            <p style="margin:0 0 1rem;font-size:0.78rem;color:#64748b;line-height:1.5;">Selecione o time incompleto. ${nextTeam}</p>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <select id="standby-wo-select" style="flex:1;min-width:180px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:10px;padding:10px 12px;font-size:0.85rem;font-weight:600;">
                <option value="">Selecionar time incompleto...</option>
                ${options}
              </select>
              <button onclick="window._substituteFromStandby('${t.id}')"
                style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;border:none;padding:10px 20px;border-radius:10px;font-weight:800;font-size:0.85rem;cursor:pointer;white-space:nowrap;transition:all 0.2s;">
                Desclassificar e Substituir
              </button>
            </div>
          </div>`;
      }
    }
  }

  return `
    <div style="margin-top:2rem;background:var(--bg-card);border:1px solid rgba(245,158,11,0.2);border-radius:16px;padding:1.5rem;max-width:520px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:0.5rem;">
        <span style="font-size:1.3rem;">📋</span>
        <h3 style="margin:0;color:#f1f5f9;font-size:1.05rem;font-weight:700;">Lista de Espera</h3>
        <span style="font-size:0.75rem;background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 10px;border-radius:10px;font-weight:700;">${standby.length}</span>
      </div>
      ${teamSize > 1 ? `<div style="font-size:0.72rem;color:#64748b;margin-bottom:1rem;padding:6px 10px;background:rgba(255,255,255,0.02);border-radius:8px;border-left:3px solid rgba(245,158,11,0.3);">${modeDesc[mode]}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;">
        ${listItems}
      </div>
      ${subsSection}
    </div>`;
}

// ─── Substituição de jogador/time da Lista de Espera ─────────────────────────
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
      confirmMsg = `<div><strong style="color:#ef4444;">Ausente:</strong> ${absentPlayer} (do time "${teamName}")</div>
        <div><strong style="color:#4ade80;">Substituto:</strong> ${replacementName}</div>
        <div style="margin-top:6px;"><strong>Novo time:</strong> ${newTeamName}</div>`;
    } else {
      newTeamName = replacementName;
      confirmMsg = `<div><strong style="color:#ef4444;">Ausente:</strong> ${absentPlayer}</div>
        <div><strong style="color:#4ade80;">Substituto:</strong> ${replacementName}</div>`;
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
        window.AppStore.sync();
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
        <div><strong style="color:#ef4444;">Desclassificado:</strong> ${absentTeam}</div>
        <div><strong style="color:#4ade80;">Substituto:</strong> ${replacementName}</div>
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
        window.AppStore.sync();
        showNotification('Substituição Realizada', `${replacementName} entrou no lugar de ${absentTeam}`, 'success');
        renderBracket(document.getElementById('view-container'), tId);
      }, null,
      { type: 'warning', confirmText: 'Desclassificar e Substituir', cancelText: 'Cancelar' }
    );
  }
};

function _setupFixedScrollbar(container) {
  // Limpar scrollbar anterior
  const old = document.getElementById('bracket-fixed-scrollbar');
  if (old) old.remove();

  setTimeout(() => {
    const wrapper = container.querySelector('.bracket-sticky-scroll-wrapper');
    if (!wrapper) return;

    const content = wrapper.querySelector('.bracket-scroll-content');
    if (!content) return;

    // Account for zoom: scaled content width
    const zoom = window._bracketZoom || 1;
    const contentWidth = content.scrollWidth * zoom;
    const wrapperWidth = wrapper.clientWidth;

    // Adjust wrapper height to match scaled content
    if (zoom !== 1) {
      wrapper.style.height = (content.scrollHeight * zoom + 16) + 'px';
    }

    // Se o conteúdo cabe na tela, scroll nativo já é suficiente
    if (contentWidth <= wrapperWidth) return;

    // Criar scrollbar fixa adicional no bottom da viewport
    const fixedBar = document.createElement('div');
    fixedBar.id = 'bracket-fixed-scrollbar';
    fixedBar.className = 'bracket-fixed-scrollbar';

    const inner = document.createElement('div');
    inner.style.width = contentWidth + 'px';
    inner.style.height = '1px';
    fixedBar.appendChild(inner);
    document.body.appendChild(fixedBar);

    // NÃO esconder a scrollbar nativa — manter ambas funcionando

    // Sincronizar scroll: barra fixa → wrapper
    let syncing = false;
    fixedBar.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      wrapper.scrollLeft = fixedBar.scrollLeft;
      syncing = false;
    });

    // Sincronizar scroll: wrapper → barra fixa
    wrapper.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      fixedBar.scrollLeft = wrapper.scrollLeft;
      syncing = false;
    });

    // Remover ao sair da view
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.bracket-sticky-scroll-wrapper')) {
        const bar = document.getElementById('bracket-fixed-scrollbar');
        if (bar) bar.remove();
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
  }, 100);
}

// ─── Auto-reparação: gera rodadas futuras para torneios antigos ──────────────
function _ensureFutureRounds(t) {
  if (!t.matches || !t.matches.length) return;
  const isDupla = t.format === 'Dupla Eliminatória';

  // Filtrar apenas matches do bracket principal (upper ou sem bracket)
  const mainMatches = isDupla
    ? t.matches.filter(m => m.bracket === 'upper')
    : t.matches.filter(m => !m.bracket || (m.bracket !== 'lower' && m.bracket !== 'grand'));

  const roundsMap = {};
  mainMatches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });

  const rounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);
  if (rounds.length === 0) return;

  const r1Count = (roundsMap[rounds[0]] || []).length;
  if (r1Count <= 1) return; // Final ou apenas 1 jogo — nada a gerar

  const expectedTotalRounds = Math.ceil(Math.log2(r1Count * 2));

  // Se já tem todas as rodadas, não precisa reparar
  if (rounds.length >= expectedTotalRounds) return;

  // Gerar rodadas faltantes
  const timestamp = Date.now();
  let currentRoundsMap = { ...roundsMap };

  // Precisa saber o último round number existente
  for (let ri = 0; ri < rounds.length; ri++) {
    currentRoundsMap[rounds[ri]] = roundsMap[rounds[ri]];
  }

  // Gerar a partir da última rodada existente
  const allRoundNums = [];
  for (let r = 1; r <= expectedTotalRounds; r++) allRoundNums.push(r);

  for (let i = 0; i < allRoundNums.length; i++) {
    const r = allRoundNums[i];
    if (i === 0) continue; // R1 já existe
    const prevR = allRoundNums[i - 1];
    const prevRound = currentRoundsMap[prevR] || [];
    const expectedNext = Math.ceil(prevRound.length / 2);

    if (!currentRoundsMap[r]) currentRoundsMap[r] = [];

    while (currentRoundsMap[r].length < expectedNext) {
      const idx = currentRoundsMap[r].length;
      const nm = {
        id: `match-r${r}-${idx}-${timestamp + r}`,
        round: r,
        bracket: isDupla ? 'upper' : undefined,
        p1: 'TBD', p2: 'TBD', winner: null
      };
      currentRoundsMap[r].push(nm);
      t.matches.push(nm);
    }

    // Linkar matches da rodada anterior → próxima
    prevRound.forEach((m, idx) => {
      if (!m.nextMatchId) {
        const nextIdx = Math.floor(idx / 2);
        if (currentRoundsMap[r][nextIdx]) {
          m.nextMatchId = currentRoundsMap[r][nextIdx].id;
        }
      }
    });
  }

  // Propagar vencedores já existentes para rodadas futuras
  for (let i = 0; i < allRoundNums.length; i++) {
    const r = allRoundNums[i];
    (currentRoundsMap[r] || []).forEach(m => {
      if (m.winner && m.nextMatchId) {
        const next = t.matches.find(nm => nm.id === m.nextMatchId);
        if (next) {
          if (!next.p1 || next.p1 === 'TBD') next.p1 = m.winner;
          else if (!next.p2 || next.p2 === 'TBD') next.p2 = m.winner;
        }
      }
    });
  }

  // Inicializar thirdPlaceMatch se configurado e ainda não existe
  if (t.elimThirdPlace && !t.thirdPlaceMatch) {
    const finalRound = allRoundNums[allRoundNums.length - 1];
    t.thirdPlaceMatch = {
      id: `match-3rd-${Date.now()}`,
      round: finalRound || 1,
      label: '3º Lugar',
      p1: 'TBD', p2: 'TBD', winner: null
    };
  }

  // Sempre recalcular participantes do 3º lugar baseado nas semifinais
  if (t.elimThirdPlace && t.thirdPlaceMatch && !t.thirdPlaceMatch.winner) {
    const semiRound = allRoundNums.length >= 2 ? allRoundNums[allRoundNums.length - 2] : null;
    if (semiRound && currentRoundsMap[semiRound]) {
      const losers = currentRoundsMap[semiRound]
        .filter(m => m.winner && m.winner !== 'draw' && !m.isBye)
        .map(m => m.winner === m.p1 ? m.p2 : m.p1)
        .filter(name => name && name !== 'TBD' && name !== 'BYE');
      t.thirdPlaceMatch.p1 = losers.length >= 1 ? losers[0] : 'TBD';
      t.thirdPlaceMatch.p2 = losers.length >= 2 ? losers[1] : 'TBD';
    }
  }

  // Salvar a reparação
  if (typeof window.AppStore !== 'undefined' && typeof window.AppStore.sync === 'function') {
    window.AppStore.sync();
  }
}

// ─── Hidden rounds state, bracket view mode & zoom ──────────────────────────
if (!window._hiddenRounds) window._hiddenRounds = {};
if (window._bracketMirrorMode === undefined) window._bracketMirrorMode = false;
if (window._bracketZoom === undefined) window._bracketZoom = 1;

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

// ─── Single Elimination ───────────────────────────────────────────────────────
function renderSingleElimBracket(t, canEnterResult) {
  // ── Auto-reparação: gera rodadas futuras se não existirem ──
  _ensureFutureRounds(t);

  const allMatches = t.matches || [];

  const roundsMap = {};
  allMatches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });

  // Mostrar TODAS as rodadas (incluindo futuras com TBD)
  const activeRounds = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => a - b);

  if (activeRounds.length === 0) {
    return `<p class="text-muted">Nenhuma rodada ativa.</p>`;
  }

  // Compute expected total rounds from round-1 match count
  const round1Matches = roundsMap[activeRounds[0]] ? roundsMap[activeRounds[0]].length : 1;
  const expectedTotalRounds = round1Matches > 1
    ? Math.ceil(Math.log2(round1Matches * 2))
    : 1;

  // Label by position from the end
  const getRoundLabel = (roundNum, roundIndex) => {
    const fromEnd = expectedTotalRounds - roundIndex;
    if (fromEnd === 1) return 'Final';
    if (fromEnd === 2) return 'Semifinal';
    if (fromEnd === 3) return 'Quartas de Final';
    if (fromEnd === 4) return 'Oitavas de Final';
    return `Rodada ${roundNum}`;
  };

  // Determine which rounds are complete (all matches have a winner)
  const isRoundComplete = (roundNum) => {
    const matches = roundsMap[roundNum] || [];
    return matches.length > 0 && matches.every(m => m.winner || m.isBye);
  };

  // Hidden rounds for this tournament
  const hiddenSet = (window._hiddenRounds[t.id]) || new Set();

  // Find the highest hidden round number (for "mostrar" button)
  let maxHiddenRound = -1;
  hiddenSet.forEach(r => { if (r > maxHiddenRound) maxHiddenRound = r; });

  let globalMatchNum = 0;

  // 3rd place match
  const thirdPlaceMatch = t.thirdPlaceMatch || (t.elimThirdPlace ? { id: 'match-3rd-placeholder', p1: 'TBD', p2: 'TBD', winner: null } : null);
  const hasThirdPlace = !!t.elimThirdPlace && activeRounds.length >= 2;

  const semiRoundIdx = activeRounds.length >= 2 ? activeRounds.length - 2 : -1;
  const matchesBeforeFinal = semiRoundIdx >= 0
    ? activeRounds.slice(0, semiRoundIdx + 1).reduce((sum, r) => sum + (roundsMap[r] || []).length, 0)
    : 0;
  const thirdPlaceMatchNum = hasThirdPlace ? matchesBeforeFinal + 1 : 0;

  // Determine visible rounds (not hidden)
  const visibleRounds = activeRounds.filter(r => !hiddenSet.has(r));
  const hiddenCount = activeRounds.length - visibleRounds.length;

  // Check if mirror layout is structurally possible:
  // Need: semis (2 matches) + final visible, at least 3 total rounds
  const semiGlobalIdx = activeRounds.length - 2;
  const finalGlobalIdx = activeRounds.length - 1;
  const mirrorPossible = visibleRounds.length >= 2
    && activeRounds.length >= 3
    && semiGlobalIdx >= 0
    && visibleRounds.includes(activeRounds[semiGlobalIdx])
    && visibleRounds.includes(activeRounds[finalGlobalIdx])
    && (roundsMap[activeRounds[semiGlobalIdx]] || []).length === 2;

  // Mirror mode: user toggles it on, but it must also be structurally possible
  const canMirror = window._bracketMirrorMode && mirrorPossible;

  // Build round columns
  const roundColumns = [];

  // "Mostrar" button for hidden rounds
  const showBtnHtml = hiddenCount > 0 ? `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:48px;gap:8px;align-self:stretch;">
      <button onclick="window._toggleRoundVisibility('${t.id}', ${maxHiddenRound})"
        style="writing-mode:vertical-lr;text-orientation:mixed;background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.15);color:var(--text-muted);border-radius:8px;padding:12px 8px;font-size:0.7rem;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:1px;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='var(--text-bright)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='var(--text-muted)'"
        title="Mostrar rodadas ocultas (${hiddenCount})">
        ◀ Mostrar (${hiddenCount})
      </button>
    </div>` : '';

  if (canMirror) {
    // ── World Cup mirror layout ──
    // Split ALL visible rounds (except final) in half:
    //   Left side: first half of each round's matches (left→right: earliest → semi)
    //   Center: Final + 3rd place
    //   Right side: second half of each round's matches (left→right: semi → earliest)
    const finalRoundNum = activeRounds[finalGlobalIdx];
    const finalLabel = getRoundLabel(finalRoundNum, finalGlobalIdx);

    // Visible rounds before the final, in order
    const preRounds = visibleRounds.filter(r => r !== finalRoundNum);

    // Helper: build a column for a subset of matches from a round
    const buildRoundCol = (roundNum, matches, suffix, showHide) => {
      const idx = activeRounds.indexOf(roundNum);
      const label = getRoundLabel(roundNum, idx);
      const complete = isRoundComplete(roundNum);
      const hideBtn = (showHide && complete) ? `<button onclick="window._toggleRoundVisibility('${t.id}', ${roundNum})" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);border-radius:6px;padding:2px 8px;font-size:0.65rem;cursor:pointer;transition:all 0.2s;white-space:nowrap;" onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'">Ocultar</button>` : '';
      const matchesHtml = matches.map(m => {
        globalMatchNum++;
        return renderMatchCard(m, canEnterResult, t.id, globalMatchNum);
      }).join('');
      return `
        <div class="bracket-round-column" style="display:flex;flex-direction:column;gap:1rem;min-width:280px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <h4 style="color:var(--text-bright);font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:0;border-left:3px solid var(--primary-color);padding-left:8px;flex:1;">${label}${suffix ? ' ' + suffix : ''}</h4>
            ${hideBtn}
          </div>
          <div style="margin-top:0.5rem;">${matchesHtml}</div>
        </div>`;
    };

    // ── LEFT SIDE: first half of each pre-round (earliest → semi) ──
    const leftColumns = [];
    preRounds.forEach(roundNum => {
      const matches = roundsMap[roundNum] || [];
      const half = Math.ceil(matches.length / 2);
      const leftMatches = matches.slice(0, half);
      const isSemi = (activeRounds.indexOf(roundNum) === semiGlobalIdx);
      leftColumns.push(buildRoundCol(roundNum, leftMatches, isSemi ? 'A' : '', !isSemi));
    });

    // ── RIGHT SIDE: second half of each pre-round (semi → earliest, reversed) ──
    const rightColumns = [];
    preRounds.forEach(roundNum => {
      const matches = roundsMap[roundNum] || [];
      const half = Math.ceil(matches.length / 2);
      const rightMatches = matches.slice(half);
      if (rightMatches.length === 0) return;
      const isSemi = (activeRounds.indexOf(roundNum) === semiGlobalIdx);
      rightColumns.push(buildRoundCol(roundNum, rightMatches, isSemi ? 'B' : '', !isSemi));
    });
    rightColumns.reverse(); // mirror order: semi first, then quartas, etc.

    // ── CENTER: Final + 3rd place ──
    const finalMatches = roundsMap[finalRoundNum] || [];
    const finalMatchHtml = finalMatches.map(m => {
      globalMatchNum++;
      return renderMatchCard(m, canEnterResult, t.id, hasThirdPlace ? thirdPlaceMatchNum + 1 : globalMatchNum);
    }).join('');

    const thirdPlaceCol = hasThirdPlace ? `
      <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px dashed rgba(255,255,255,0.1);">
        <div style="font-size:0.7rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Disputa de 3º Lugar</div>
        ${renderMatchCard(Object.assign({}, thirdPlaceMatch, { label: null }), canEnterResult, t.id, thirdPlaceMatchNum)}
      </div>` : '';

    const centerCol = `
      <div class="bracket-round-column" style="display:flex;flex-direction:column;gap:1rem;min-width:280px;justify-content:center;">
        <h4 style="color:var(--text-bright);font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:.5rem;border-left:3px solid #fbbf24;padding-left:8px;">🏆 ${finalLabel}</h4>
        ${finalMatchHtml}
        ${thirdPlaceCol}
      </div>`;

    // Assemble: left → center → right
    leftColumns.forEach(col => roundColumns.push(col));
    roundColumns.push(centerCol);
    rightColumns.forEach(col => roundColumns.push(col));

  } else {
    // ── Normal left-to-right layout ──
    activeRounds.forEach((roundNum, idx) => {
      if (hiddenSet.has(roundNum)) return; // Skip hidden rounds

      const label = getRoundLabel(roundNum, idx);
      const isFinalRound = (expectedTotalRounds - idx) === 1;
      const complete = isRoundComplete(roundNum);

      // "Ocultar" button — only for completed rounds that are not the final
      const hideBtn = (complete && !isFinalRound) ? `<button onclick="window._toggleRoundVisibility('${t.id}', ${roundNum})" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);border-radius:6px;padding:2px 8px;font-size:0.65rem;cursor:pointer;transition:all 0.2s;white-space:nowrap;" onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'">Ocultar</button>` : '';

      const matchesHtml = roundsMap[roundNum].map(m => {
        if (isFinalRound && hasThirdPlace) {
          globalMatchNum++;
          return renderMatchCard(m, canEnterResult, t.id, thirdPlaceMatchNum + 1);
        }
        globalMatchNum++;
        return renderMatchCard(m, canEnterResult, t.id, globalMatchNum);
      }).join('');

      const thirdPlaceCol = (isFinalRound && hasThirdPlace) ? `
        <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px dashed rgba(255,255,255,0.1);">
          <div style="font-size:0.7rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Disputa de 3º Lugar</div>
          ${renderMatchCard(Object.assign({}, thirdPlaceMatch, { label: null }), canEnterResult, t.id, thirdPlaceMatchNum)}
        </div>` : '';

      roundColumns.push(`
        <div class="bracket-round-column" style="display:flex;flex-direction:column;gap:1rem;min-width:280px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <h4 style="color:var(--text-bright);font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:0;border-left:3px solid var(--primary-color);padding-left:8px;flex:1;">${label}</h4>
            ${hideBtn}
          </div>
          <div style="margin-top:0.5rem;">
            ${matchesHtml}
            ${thirdPlaceCol}
          </div>
        </div>`);
    });
  }

  const roundsHtml = (showBtnHtml ? showBtnHtml : '') + roundColumns.join('');

  // Champion
  const champion = _getChampion(t, activeRounds);
  const championHtml = champion ? `
    <div style="text-align:center;margin-bottom:1.5rem;padding:1rem;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:12px;">
      <div style="font-size:1.5rem;">🏆</div>
      <div style="font-weight:800;color:#fbbf24;font-size:1.1rem;">${champion}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">Campeão</div>
    </div>` : '';

  // Toggle button: Linear ↔ Espelhado
  const modeLabel = canMirror ? 'Linear' : 'Espelhado';
  const modeIcon = canMirror ? '➡️' : '🏆';
  const toggleBtnHtml = mirrorPossible ? `
      <button onclick="window._toggleBracketMode('${t.id}')"
        style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:var(--text-muted);border-radius:20px;padding:5px 14px;font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='var(--text-bright)';this.style.borderColor='rgba(255,255,255,0.25)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='var(--text-muted)';this.style.borderColor='rgba(255,255,255,0.12)'"
        title="Alternar entre visualização linear e espelhada (Copa do Mundo)">
        ${modeIcon} ${modeLabel}
      </button>` : '';

  // Zoom controls
  const zoomPct = Math.round(window._bracketZoom * 100);
  const toolbarHtml = `
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:0.75rem;gap:8px;flex-wrap:wrap;">
      ${toggleBtnHtml}
      <div style="display:inline-flex;align-items:center;gap:2px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:2px 4px;">
        <button onclick="window._setBracketZoom('${t.id}', -1)"
          style="background:transparent;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:3px 8px;line-height:1;border-radius:50%;"
          onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'"
          title="Zoom out">−</button>
        <span id="bracket-zoom-label" style="font-size:0.7rem;font-weight:600;color:var(--text-muted);min-width:36px;text-align:center;cursor:pointer;user-select:none;"
          onclick="window._resetBracketZoom('${t.id}')" title="Resetar zoom">${zoomPct}%</span>
        <button onclick="window._setBracketZoom('${t.id}', 1)"
          style="background:transparent;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:3px 8px;line-height:1;border-radius:50%;"
          onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'"
          title="Zoom in">+</button>
      </div>
    </div>`;

  // Both modes use min-width:max-content + scrollable wrapper (no clipping)
  const zoomTransform = window._bracketZoom !== 1 ? `transform:scale(${window._bracketZoom});transform-origin:top left;` : '';

  return `
    ${championHtml}
    ${toolbarHtml}
    <div class="bracket-sticky-scroll-wrapper" style="overflow-x:scroll!important;overflow-y:visible;display:block;width:100%;max-width:100%;">
      <div class="bracket-scroll-content" style="display:inline-flex;gap:32px;align-items:flex-start;padding:1rem 0;min-width:max-content;${zoomTransform}">
        ${roundsHtml}
        <div style="min-width:200px;flex-shrink:0;">&nbsp;</div>
      </div>
    </div>`;
}

// ─── Double Elimination ───────────────────────────────────────────────────────
function renderDoubleElimBracket(t, canEnterResult) {
  // Auto-reparação para dupla eliminatória também
  _ensureFutureRounds(t);

  // Mostrar TODOS os jogos (incluindo futuros com TBD)
  const upperMatches = (t.matches || []).filter(m => m.bracket === 'upper' || (!m.bracket && m.bracket !== 'lower' && m.bracket !== 'grand'));
  const lowerMatches = (t.matches || []).filter(m => m.bracket === 'lower');
  const grandFinal = (t.matches || []).filter(m => m.bracket === 'grand');

  let deGlobalNum = 0;
  const renderSection = (matches, title, color) => {
    if (!matches.length) return '';
    const rMap = {};
    matches.forEach(m => { if (!rMap[m.round]) rMap[m.round] = []; rMap[m.round].push(m); });
    const sorted = Object.keys(rMap).sort((a, b) => Number(a) - Number(b));
    const cols = sorted.map(r => `
      <div style="display:flex;flex-direction:column;gap:1rem;min-width:280px;">
        <h5 style="color:${color};font-size:0.7rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:.5rem;">Rodada ${r}</h5>
        ${rMap[r].map(m => { deGlobalNum++; return renderMatchCard(m, canEnterResult, t.id, deGlobalNum); }).join('')}
      </div>`).join('');
    return `
      <div style="margin-bottom:2rem;">
        <h4 style="color:var(--text-bright);font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;border-left:3px solid ${color};padding-left:10px;margin-bottom:1rem;">${title}</h4>
        <div class="bracket-scroll-container" style="display:flex;gap:32px;overflow-x:auto;padding-bottom:8px;"><div style="display:flex;gap:32px;min-width:max-content;">${cols}<div style="min-width:200px;flex-shrink:0;">&nbsp;</div></div></div>
      </div>`;
  };

  return `
    <div>
      ${renderSection(upperMatches, 'Chaveamento Superior', '#10b981')}
      ${renderSection(lowerMatches, 'Chaveamento Inferior', '#f59e0b')}
      ${grandFinal.length ? `
        <div style="margin-top:1rem;padding-top:1.5rem;border-top:1px solid var(--border-color);">
          <h4 style="color:#fbbf24;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:1rem;">🏆 Grande Final</h4>
          <div style="max-width:280px;">${grandFinal.map(m => { deGlobalNum++; return renderMatchCard(m, canEnterResult, t.id, deGlobalNum); }).join('')}</div>
        </div>` : ''}
    </div>`;
}

// ─── Match Card — inline score entry ─────────────────────────────────────────
function _getCheckInStatus(tId, teamName) {
  // Returns: 'full' (all members present), 'partial' (some), 'none'
  const t = window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;
  if (!t || !t.checkedIn || !teamName || teamName === 'TBD' || teamName === 'BYE') return 'none';
  const ci = t.checkedIn;
  if (teamName.includes(' / ')) {
    const members = teamName.split(' / ').map(n => n.trim()).filter(n => n);
    const checked = members.filter(n => !!ci[n]).length;
    if (checked === members.length) return 'full';
    if (checked > 0) return 'partial';
    return 'none';
  }
  return ci[teamName] ? 'full' : 'none';
}

function renderMatchCard(m, canEnterResult, tId, matchNum) {
  if (!m) return '';

  const isDecided = !!m.winner;
  const isByeMatch = m.isBye || m.p2 === 'BYE';
  const hasTBD = !m.p1 || m.p1 === 'TBD' || !m.p2 || m.p2 === 'TBD';

  // Check-in status for match readiness
  const p1ci = _getCheckInStatus(tId, m.p1);
  const p2ci = _getCheckInStatus(tId, m.p2);
  const hasAnyCheckIn = (p1ci !== 'none' || p2ci !== 'none');
  // Match ready = both sides fully checked in, not decided yet, not BYE, not TBD
  const matchReady = !isDecided && !isByeMatch && !hasTBD && p1ci === 'full' && p2ci === 'full';
  const matchPartial = !isDecided && !isByeMatch && !hasTBD && hasAnyCheckIn && !matchReady;

  const p1IsWinner = isDecided && m.winner === m.p1;
  const p2IsWinner = isDecided && m.winner === m.p2;

  const rowStyle = (isWinner, side) => {
    const base = 'padding:8px 10px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;';
    if (isWinner) return base + 'background:rgba(16,185,129,0.18);border-left:3px solid #10b981;';
    if (isDecided) return base + 'background:rgba(0,0,0,0.2);border-left:3px solid rgba(255,255,255,0.08);opacity:0.55;';
    return base + (side === 'p1'
      ? 'background:rgba(0,0,0,0.25);border-left:3px solid rgba(16,185,129,0.4);'
      : 'background:rgba(0,0,0,0.25);border-left:3px solid rgba(239,68,68,0.4);');
  };

  const scoreDisplay = (score, isWinner) =>
    score !== undefined && score !== null && score !== ''
      ? `<span style="font-weight:800;font-size:1rem;min-width:24px;text-align:center;color:${isWinner ? '#4ade80' : 'var(--text-muted)'};">${score}</span>`
      : '';

  // Inline score inputs (only when match is active, both players known, and result can be entered)
  const showInputs = !isDecided && !isByeMatch && !hasTBD && canEnterResult;

  // Check-in dot indicator
  const ciDot = (status) => {
    if (!hasAnyCheckIn && !matchReady) return '';
    const color = status === 'full' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#64748b';
    const title = status === 'full' ? 'Presente' : status === 'partial' ? 'Parcial' : 'Ausente';
    return `<span title="${title}" style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin-right:4px;display:inline-block;"></span>`;
  };

  const p1Row = `
    <div style="${rowStyle(p1IsWinner, 'p1')}">
      ${ciDot(p1ci)}<span style="font-weight:600;font-size:0.88rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${(!m.p1 || m.p1 === 'TBD') ? 'opacity:0.4;font-style:italic;' : ''}">${(!m.p1 || m.p1 === 'TBD') ? 'A definir' : m.p1}</span>
      ${showInputs
        ? `<input type="number" id="s1-${m.id}" min="0" placeholder="0"
            style="width:52px;text-align:center;font-size:0.95rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:6px;padding:4px 6px;flex-shrink:0;"
            oninput="window._highlightWinner('${m.id}')">`
        : scoreDisplay(m.scoreP1, p1IsWinner)
      }
    </div>`;

  const p2Row = `
    <div style="${rowStyle(p2IsWinner, 'p2')}">
      ${ciDot(p2ci)}<span style="font-weight:600;font-size:0.88rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${(!m.p2 || m.p2 === 'TBD') ? 'opacity:0.4;font-style:italic;' : ''}">${(!m.p2 || m.p2 === 'TBD') ? 'A definir' : m.p2}</span>
      ${showInputs
        ? `<input type="number" id="s2-${m.id}" min="0" placeholder="0"
            style="width:52px;text-align:center;font-size:0.95rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:6px;padding:4px 6px;flex-shrink:0;"
            oninput="window._highlightWinner('${m.id}')">`
        : scoreDisplay(m.scoreP2, p2IsWinner)
      }
    </div>`;

  const vsRow = `<div style="text-align:center;font-size:0.65rem;color:var(--text-muted);font-weight:800;letter-spacing:2px;padding:3px 0;">VS</div>`;

  const winnerBadge = isDecided && !isByeMatch
    ? `<div style="text-align:center;font-size:0.75rem;color:#4ade80;font-weight:700;margin-top:6px;padding:4px;background:rgba(16,185,129,0.1);border-radius:6px;">🏆 ${m.winner}</div>`
    : isByeMatch
    ? `<div style="text-align:center;font-size:0.72rem;color:#4ade80;font-weight:700;margin-top:6px;">BYE — Avança Direto</div>`
    : '';

  const confirmBtn = showInputs ? `
    <button id="confirm-${m.id}" onclick="window._saveResultInline('${tId}','${m.id}')"
      style="width:100%;margin-top:8px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#4ade80;border-radius:8px;padding:7px;font-size:0.8rem;font-weight:700;cursor:pointer;transition:all 0.2s;"
      onmouseover="this.style.background='rgba(16,185,129,0.3)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">
      ✓ Confirmar Resultado
    </button>` : '';

  const editBtn = isDecided && !isByeMatch && canEnterResult
    ? `<button onclick="window._editResult('${tId}','${m.id}')"
        style="background:transparent;border:none;color:var(--text-muted);font-size:0.72rem;cursor:pointer;padding:2px 4px;line-height:1;"
        onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'"
        title="Editar resultado">✏️ Editar</button>` : '';

  const matchLabel = m.label || (matchNum ? `Jogo ${matchNum}` : 'Partida');

  // Card border color based on check-in readiness
  let cardBorder = isDecided ? 'rgba(16,185,129,0.2)' : hasTBD ? 'rgba(255,255,255,0.05)' : 'var(--border-color)';
  let readyBadge = '';
  if (!isDecided && !isByeMatch && !hasTBD) {
    if (matchReady) {
      cardBorder = 'rgba(16,185,129,0.5)';
      readyBadge = `<span style="font-size:0.6rem;font-weight:800;color:#10b981;background:rgba(16,185,129,0.15);padding:2px 6px;border-radius:4px;text-transform:uppercase;">Pronto</span>`;
    } else if (matchPartial) {
      cardBorder = 'rgba(245,158,11,0.4)';
      readyBadge = `<span style="font-size:0.6rem;font-weight:800;color:#f59e0b;background:rgba(245,158,11,0.12);padding:2px 6px;border-radius:4px;text-transform:uppercase;">Parcial</span>`;
    }
  }

  return `
    <div id="card-${m.id}" style="background:var(--bg-card);border:1px solid ${cardBorder};border-radius:12px;padding:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);${hasTBD ? 'opacity:0.6;' : ''}${matchReady ? 'box-shadow:0 0 16px rgba(16,185,129,0.15),0 4px 12px rgba(0,0,0,0.15);' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:5px;">
        <span style="font-size:0.7rem;font-weight:700;color:#38bdf8;text-transform:uppercase;">${matchLabel}</span>
        <div style="display:flex;align-items:center;gap:4px;">${readyBadge}${editBtn}</div>
      </div>
      ${p1Row}
      ${vsRow}
      ${p2Row}
      ${winnerBadge}
      ${confirmBtn}
    </div>`;
}

// ─── Highlight winner based on score while typing ─────────────────────────────
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

  if (s1 === s2 && !isGroupMatch) {
    showAlertDialog('Empate não permitido', 'O torneio eliminatório não aceita empate. Corrija o placar.', null, { type: 'warning' });
    return;
  }

  m.scoreP1 = s1;
  m.scoreP2 = s2;

  if (s1 === s2) {
    // Empate em fase de grupos — ambos ganham 1 ponto (tratado na standings)
    m.winner = 'draw';
    m.draw = true;
  } else {
    m.winner = s1 > s2 ? m.p1 : m.p2;
    m.draw = false;
  }

  if (!isGroupMatch) {
    _advanceWinner(t, m);
    showNotification('Resultado Salvo', `${m.winner} avança!`, 'success');
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
  window.AppStore.sync();
  renderBracket(document.getElementById('view-container'), tId);
};

function _checkGroupRoundComplete(t, groupIndex) {
  if (!t.groups || !t.groups[groupIndex]) return;
  const g = t.groups[groupIndex];
  const activeRound = (g.rounds || []).find(r => r.status === 'active');
  if (!activeRound) return;
  const allDone = (activeRound.matches || []).every(m => m.winner);
  if (allDone) {
    activeRound.status = 'complete';
    // Activate next pending round
    const nextRound = (g.rounds || []).find(r => r.status === 'pending');
    if (nextRound) nextRound.status = 'active';
  }
}

// ─── Edit result (clear winner and re-open) ───────────────────────────────────
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
      window.AppStore.sync();
      renderBracket(document.getElementById('view-container'), tId);
    },
    null,
    { type: 'warning', confirmText: 'Apagar e Reeditar', cancelText: 'Cancelar' }
  );
};

// ─── Group Stage (Fase de Grupos + Eliminatórias) ───────────────────────────
function renderGroupStage(t, isOrg, canEnterResult) {
  const groups = t.groups || [];
  if (!groups.length) return '<p class="text-muted">Nenhum grupo gerado.</p>';

  // Check if all group matches are complete
  const allGroupsDone = groups.every(g =>
    (g.rounds || []).every(r =>
      (r.matches || []).every(m => m.winner)
    )
  );

  const advanceBtn = (isOrg && allGroupsDone) ? `
    <div style="text-align:center;margin:2rem 0;">
      <button class="btn hover-lift" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;font-weight:700;padding:14px 28px;font-size:1rem;border-radius:16px;box-shadow:0 10px 20px rgba(245,158,11,0.3);"
        onclick="window._advanceToElimination('${t.id}')">
        🏆 Avançar para Fase Eliminatória
      </button>
    </div>` : '';

  let groupGlobalMatchNum = 0;
  const groupsHtml = groups.map((g, gi) => {
    // Compute group standings
    const scoreMap = {};
    g.participants.forEach(name => {
      scoreMap[name] = { name, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0 };
    });
    (g.rounds || []).forEach(r => {
      (r.matches || []).forEach(m => {
        if (!m.winner) return;
        const s1 = parseInt(m.scoreP1) || 0;
        const s2 = parseInt(m.scoreP2) || 0;
        if (!scoreMap[m.p1]) scoreMap[m.p1] = { name: m.p1, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0 };
        if (!scoreMap[m.p2]) scoreMap[m.p2] = { name: m.p2, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0 };
        scoreMap[m.p1].played++; scoreMap[m.p2].played++;
        scoreMap[m.p1].pointsDiff += (s1 - s2);
        scoreMap[m.p2].pointsDiff += (s2 - s1);
        if (m.draw) {
          scoreMap[m.p1].draws++; scoreMap[m.p1].points += 1;
          scoreMap[m.p2].draws++; scoreMap[m.p2].points += 1;
        } else {
          const loser = m.winner === m.p1 ? m.p2 : m.p1;
          scoreMap[m.winner].wins++; scoreMap[m.winner].points += 3;
          scoreMap[loser].losses++;
        }
      });
    });
    const sorted = Object.values(scoreMap).sort((a, b) => b.points - a.points || b.wins - a.wins || b.pointsDiff - a.pointsDiff);
    const classified = t.gruposClassified || 2;

    const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
    const rows = sorted.map((s, i) => `
      <tr style="border-bottom:1px solid var(--border-color);${i < classified ? 'background:rgba(34,197,94,0.08);' : ''}">
        <td style="padding:8px 12px;font-weight:700;color:${i < classified ? '#4ade80' : 'var(--text-muted)'};">${medal(i)}</td>
        <td style="padding:8px 12px;font-weight:600;color:var(--text-bright);">${s.name} ${i < classified ? '<span style="font-size:0.65rem;color:#4ade80;font-weight:800;">CLASSIF.</span>' : ''}</td>
        <td style="padding:8px 12px;font-weight:800;color:var(--primary-color);text-align:center;">${s.points}</td>
        <td style="padding:8px 12px;text-align:center;color:#4ade80;">${s.wins}</td>
        <td style="padding:8px 12px;text-align:center;color:#f87171;">${s.losses}</td>
        <td style="padding:8px 12px;text-align:center;color:${s.pointsDiff >= 0 ? '#4ade80' : '#f87171'};">${s.pointsDiff >= 0 ? '+' : ''}${s.pointsDiff}</td>
      </tr>`).join('');

    // Mostrar TODAS as rodadas do grupo (completas, ativa e pendentes)
    const allRoundsHtml = (g.rounds || []).map((r, ri) => {
      const roundLabel = r.status === 'complete' ? `Rodada ${ri + 1} — Encerrada ✓` : r.status === 'active' ? `Rodada ${ri + 1} — Em andamento` : `Rodada ${ri + 1} — Pendente`;
      const roundLabelColor = r.status === 'complete' ? '#4ade80' : r.status === 'active' ? '#fbbf24' : 'var(--text-muted)';
      const matchesInRound = (r.matches || []).map(m => {
        groupGlobalMatchNum++;
        return `<div style="min-width:250px;max-width:300px;flex:1;">${renderMatchCard(m, canEnterResult && r.status === 'active' && !m.winner, t.id, groupGlobalMatchNum)}</div>`;
      }).join('');
      return `
        <div style="margin-bottom:0.75rem;">
          <h5 style="font-size:0.7rem;color:${roundLabelColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">${roundLabel}</h5>
          <div style="display:flex;flex-wrap:wrap;gap:12px;">${matchesInRound}</div>
        </div>`;
    }).join('');
    const matchesHtml = allRoundsHtml;

    const groupColor = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'][gi % 8];

    return `
      <div class="card" style="border-left:4px solid ${groupColor};">
        <h3 style="margin:0 0 1rem;color:${groupColor};font-size:1rem;font-weight:800;">${g.name}</h3>
        <div style="overflow-x:auto;margin-bottom:1rem;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-color);">
                <th style="padding:6px 12px;text-align:left;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">#</th>
                <th style="padding:6px 12px;text-align:left;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Participante</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:var(--primary-color);text-transform:uppercase;">Pts</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:#4ade80;text-transform:uppercase;">V</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:#f87171;text-transform:uppercase;">D</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Saldo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${matchesHtml ? `
          <div style="border-top:1px solid var(--border-color);padding-top:1rem;">
            <h4 style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem;">Jogos</h4>
            ${matchesHtml}
          </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:1.5rem;">
      ${groupsHtml}
    </div>
    ${advanceBtn}`;
}

// ─── Save group match result ────────────────────────────────────────────────
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
      scoreMap[name] = { name, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
    });
    (g.rounds || []).forEach(r => {
      (r.matches || []).forEach(m => {
        if (!m.winner) return;
        const loser = m.winner === m.p1 ? m.p2 : m.p1;
        if (!scoreMap[m.winner]) scoreMap[m.winner] = { name: m.winner, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
        if (!scoreMap[loser]) scoreMap[loser] = { name: loser, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
        scoreMap[m.winner].wins++; scoreMap[m.winner].points += 3; scoreMap[m.winner].played++;
        scoreMap[loser].losses++; scoreMap[loser].played++;
        const s1 = parseInt(m.scoreP1) || 0; const s2 = parseInt(m.scoreP2) || 0;
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
      scoreMap[name] = { name, points: 0, wins: 0, pointsDiff: 0 };
    });
    (g.rounds || []).forEach(r => {
      (r.matches || []).forEach(m => {
        if (!m.winner) return;
        if (!scoreMap[m.winner]) scoreMap[m.winner] = { name: m.winner, points: 0, wins: 0, pointsDiff: 0 };
        scoreMap[m.winner].wins++; scoreMap[m.winner].points += 3;
        const s1 = parseInt(m.scoreP1) || 0; const s2 = parseInt(m.scoreP2) || 0;
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
  window.AppStore.sync();

  showNotification('Fase Eliminatória', `${seeded.length} classificados avançaram para as eliminatórias!`, 'success');
  renderBracket(document.getElementById('view-container'), tId);
};

// ─── Standings (Liga / Suíço) ─────────────────────────────────────────────────
function renderStandings(t, isOrg, canEnterResult) {
  const rounds = t.rounds || [];
  const currentRound = rounds.length;

  if (!currentRound) {
    return `
      <div style="text-align:center;padding:3rem;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);border-radius:24px;">
        <h3 style="color:var(--text-bright);">Nenhuma rodada gerada ainda</h3>
        <p class="text-muted">O organizador deve realizar o sorteio para iniciar a primeira rodada.</p>
        ${isOrg ? `<button class="btn btn-primary" style="margin-top:1rem;" onclick="window.generateDrawFunction('${t.id}')">🎲 Iniciar Primeira Rodada</button>` : ''}
      </div>`;
  }

  const computed = _computeStandings(t);

  const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
  const posColor = i => i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)';

  const rows = computed.map((s, i) => `
    <tr style="border-bottom:1px solid var(--border-color);${i < 3 ? 'background:rgba(251,191,36,0.03)' : ''}">
      <td style="padding:11px 14px;font-weight:800;color:${posColor(i)};">${medal(i)}</td>
      <td style="padding:11px 14px;font-weight:600;color:var(--text-bright);">${s.name}</td>
      <td style="padding:11px 14px;font-weight:800;color:var(--primary-color);text-align:center;">${s.points}</td>
      <td style="padding:11px 14px;text-align:center;color:#4ade80;">${s.wins}</td>
      <td style="padding:11px 14px;text-align:center;color:#f87171;">${s.losses}</td>
      <td style="padding:11px 14px;text-align:center;color:${s.pointsDiff >= 0 ? '#4ade80' : '#f87171'};">${s.pointsDiff >= 0 ? '+' : ''}${s.pointsDiff}</td>
      <td style="padding:11px 14px;text-align:center;color:var(--text-muted);">${s.played}</td>
    </tr>`).join('');

  const currentRoundData = rounds[currentRound - 1];
  const allComplete = (currentRoundData.matches || []).every(m => m.winner);
  const isSuico = t.format === 'Suíço Clássico';
  const maxRounds = t.swissRounds || 99;
  const isFinished = isSuico && currentRound >= maxRounds && allComplete;

  const currentRoundHtml = `
    <div class="card" style="margin-top:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem;">
        <h3 class="card-title" style="margin:0;">Rodada ${currentRound}${isSuico ? ` / ${maxRounds}` : ''} ${currentRoundData.status === 'complete' ? '— Encerrada ✓' : '— Em andamento'}</h3>
        ${isOrg && !isFinished && allComplete ? `
          <button onclick="window._closeRound('${t.id}', ${currentRound - 1})"
            style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#4ade80;border-radius:8px;padding:8px 18px;font-weight:600;cursor:pointer;font-size:0.85rem;">
            ✓ Encerrar Rodada e Gerar Próxima
          </button>` : ''}
        ${isFinished ? `<span style="color:#fbbf24;font-weight:700;">🏆 Torneio Encerrado!</span>` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;">
        ${(() => { const prevMatches = rounds.slice(0, currentRound - 1).reduce((sum, r) => sum + (r.matches || []).length, 0); return (currentRoundData.matches || []).map((m, idx) => `<div style="min-width:260px;max-width:320px;flex:1;">${renderMatchCard(m, canEnterResult && currentRoundData.status !== 'complete', t.id, prevMatches + idx + 1)}</div>`).join(''); })()}
      </div>
    </div>`;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 class="card-title" style="margin:0;">Classificação — Rodada ${currentRound}${isSuico ? ` / ${maxRounds}` : ''}</h3>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color);">
              <th style="padding:9px 14px;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">#</th>
              <th style="padding:9px 14px;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Participante</th>
              <th style="padding:9px 14px;text-align:center;font-size:0.7rem;color:var(--primary-color);text-transform:uppercase;letter-spacing:1px;">Pts</th>
              <th style="padding:9px 14px;text-align:center;font-size:0.7rem;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">V</th>
              <th style="padding:9px 14px;text-align:center;font-size:0.7rem;color:#f87171;text-transform:uppercase;letter-spacing:1px;">D</th>
              <th style="padding:9px 14px;text-align:center;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Saldo</th>
              <th style="padding:9px 14px;text-align:center;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">J</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    ${currentRoundHtml}`;
}

// ─── Compute standings ────────────────────────────────────────────────────────
function _computeStandings(t) {
  const scoreMap = {};

  const allP = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  allP.forEach(p => {
    const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
    if (name && !scoreMap[name]) scoreMap[name] = { name, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
  });

  (t.rounds || []).forEach(round => {
    (round.matches || []).forEach(m => {
      if (!m.winner || m.isBye) return;
      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      if (!scoreMap[m.winner]) scoreMap[m.winner] = { name: m.winner, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
      if (!scoreMap[loser]) scoreMap[loser] = { name: loser, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };

      scoreMap[m.winner].wins++;
      scoreMap[m.winner].points += 3;
      scoreMap[m.winner].played++;
      scoreMap[loser].losses++;
      scoreMap[loser].played++;

      const s1 = parseInt(m.scoreP1) || 0;
      const s2 = parseInt(m.scoreP2) || 0;
      if (m.winner === m.p1) {
        scoreMap[m.p1].pointsDiff += (s1 - s2);
        scoreMap[m.p2].pointsDiff += (s2 - s1);
      } else {
        scoreMap[m.p2].pointsDiff += (s2 - s1);
        scoreMap[m.p1].pointsDiff += (s1 - s2);
      }
    });
  });

  const standings = Object.values(scoreMap);

  // Build Buchholz scores (sum of opponents' points)
  const allRoundMatches = (t.rounds || []).flatMap(r => r.matches || []);
  standings.forEach(s => {
    s.buchholz = 0;
    allRoundMatches.forEach(m => {
      if (m.isBye || !m.winner) return;
      if (m.p1 === s.name && scoreMap[m.p2]) s.buchholz += scoreMap[m.p2].points;
      if (m.p2 === s.name && scoreMap[m.p1]) s.buchholz += scoreMap[m.p1].points;
    });
    // Sonneborn-Berger: sum of points of opponents you beat + half points of opponents you drew
    s.sonnebornBerger = 0;
    allRoundMatches.forEach(m => {
      if (m.isBye || !m.winner) return;
      if (m.winner === s.name) {
        const opp = m.p1 === s.name ? m.p2 : m.p1;
        if (scoreMap[opp]) s.sonnebornBerger += scoreMap[opp].points;
      }
    });
  });

  // Apply configured tiebreaker order
  const tiebreakers = t.tiebreakers || ['confronto_direto', 'saldo_pontos', 'vitorias', 'buchholz'];

  // Build head-to-head map for confronto_direto
  const h2h = {};
  allRoundMatches.forEach(m => {
    if (!m.winner || m.isBye) return;
    const key = `${m.winner}|||${m.winner === m.p1 ? m.p2 : m.p1}`;
    h2h[key] = (h2h[key] || 0) + 1;
  });

  standings.sort((a, b) => {
    // Primary: always sort by points first
    if (b.points !== a.points) return b.points - a.points;

    // Then apply configured tiebreakers
    for (const tb of tiebreakers) {
      let diff = 0;
      switch (tb) {
        case 'confronto_direto':
          const aBeatsB = h2h[`${a.name}|||${b.name}`] || 0;
          const bBeatsA = h2h[`${b.name}|||${a.name}`] || 0;
          diff = bBeatsA - aBeatsB; // negative means a wins
          if (diff !== 0) return diff < 0 ? -1 : 1;
          break;
        case 'saldo_pontos':
          diff = b.pointsDiff - a.pointsDiff;
          if (diff !== 0) return diff;
          break;
        case 'vitorias':
          diff = b.wins - a.wins;
          if (diff !== 0) return diff;
          break;
        case 'buchholz':
          diff = (b.buchholz || 0) - (a.buchholz || 0);
          if (diff !== 0) return diff;
          break;
        case 'sonneborn_berger':
          diff = (b.sonnebornBerger || 0) - (a.sonnebornBerger || 0);
          if (diff !== 0) return diff;
          break;
        case 'sorteio':
          return Math.random() - 0.5;
      }
    }
    return 0;
  });

  return standings;
}

// ─── Get champion (only from actual final with real participants) ──────────────
function _getChampion(t, activeRounds) {
  if (!activeRounds || activeRounds.length === 0) return null;

  const allMatches = t.matches || [];
  const roundsMap = {};
  allMatches.forEach(m => { if (!roundsMap[m.round]) roundsMap[m.round] = []; roundsMap[m.round].push(m); });

  // Champion only exists when ALL active rounds are complete (every non-BYE match has a winner)
  const allDone = activeRounds.every(r =>
    (roundsMap[r] || []).every(m => m.winner || m.isBye)
  );
  if (!allDone) return null;

  const lastRound = activeRounds[activeRounds.length - 1];
  const finalMatches = (roundsMap[lastRound] || []).filter(m => !m.isBye && m.p1 !== 'TBD');
  if (finalMatches.length === 0) return null;

  // All final matches must have a winner (handles double elim grand final too)
  const final = finalMatches.find(m => m.winner);
  return final ? final.winner : null;
}

// ─── Find match anywhere ──────────────────────────────────────────────────────
function _findMatch(t, matchId) {
  // Check 3rd place match first
  if (t.thirdPlaceMatch && t.thirdPlaceMatch.id === matchId) return t.thirdPlaceMatch;
  let m = (t.matches || []).find(m => m.id === matchId);
  if (m) return m;
  for (const round of (t.rounds || [])) {
    m = (round.matches || []).find(m => m.id === matchId);
    if (m) return m;
  }
  // Search in groups (Fase de Grupos)
  for (const group of (t.groups || [])) {
    for (const round of (group.rounds || [])) {
      m = (round.matches || []).find(m => m.id === matchId);
      if (m) return m;
    }
  }
  return null;
}

// ─── Advance winner to next round ────────────────────────────────────────────
function _advanceWinner(t, completedMatch) {
  const winner = completedMatch.winner;
  const loser = winner === completedMatch.p1 ? completedMatch.p2 : completedMatch.p1;
  const isDupla = t.format === 'Dupla Eliminatória';

  if (completedMatch.nextMatchId) {
    const next = _findMatch(t, completedMatch.nextMatchId);
    if (next) {
      if (!next.p1 || next.p1 === 'TBD') next.p1 = winner;
      else if (!next.p2 || next.p2 === 'TBD') next.p2 = winner;
    }
  }

  if (isDupla && completedMatch.loserMatchId) {
    const loserMatch = _findMatch(t, completedMatch.loserMatchId);
    if (loserMatch) {
      if (!loserMatch.p1 || loserMatch.p1 === 'TBD') loserMatch.p1 = loser;
      else if (!loserMatch.p2 || loserMatch.p2 === 'TBD') loserMatch.p2 = loser;
    }
  }

  // Swiss/Liga: check if round is fully complete
  if (completedMatch.roundIndex !== undefined) {
    const round = (t.rounds || [])[completedMatch.roundIndex];
    if (round && (round.matches || []).every(m => m.winner)) {
      round.status = 'complete';
      t.standings = _computeStandings(t);
    }
  }

  _maybeGenerate3rdPlace(t);
}

// ─── 3rd place ────────────────────────────────────────────────────────────────
// Garante que o thirdPlaceMatch existe com TBD e preenche progressivamente
// com os perdedores das semifinais conforme os resultados são lançados
function _maybeGenerate3rdPlace(t) {
  if (!t.elimThirdPlace) return;

  const allMatches = t.matches || [];

  // Identificar a rodada da semifinal (penúltima rodada do bracket)
  const allRounds = {};
  allMatches.filter(m => m.bracket !== 'lower' && m.bracket !== 'grand').forEach(m => {
    if (!allRounds[m.round]) allRounds[m.round] = [];
    allRounds[m.round].push(m);
  });
  const roundNums = Object.keys(allRounds).map(Number).sort((a, b) => a - b);
  if (roundNums.length < 2) return;

  const finalRoundNum = roundNums[roundNums.length - 1];
  const semiRoundNum = roundNums[roundNums.length - 2];
  const semis = allRounds[semiRoundNum] || [];

  // Inicializar thirdPlaceMatch se não existir
  if (!t.thirdPlaceMatch) {
    t.thirdPlaceMatch = {
      id: `match-3rd-${Date.now()}`,
      round: finalRoundNum,
      label: '3º Lugar',
      p1: 'TBD', p2: 'TBD', winner: null
    };
  }

  // Se já tem resultado confirmado no 3º lugar, não mexer
  if (t.thirdPlaceMatch.winner) return;

  // Sempre recalcular os participantes baseado no estado atual das semifinais
  // (corrige dados legados e acompanha edições de resultado)
  const losers = semis
    .filter(m => m.winner && m.winner !== 'draw' && !m.isBye)
    .map(m => m.winner === m.p1 ? m.p2 : m.p1)
    .filter(name => name && name !== 'TBD' && name !== 'BYE');

  t.thirdPlaceMatch.p1 = losers.length >= 1 ? losers[0] : 'TBD';
  t.thirdPlaceMatch.p2 = losers.length >= 2 ? losers[1] : 'TBD';
}

// ─── Close round + generate next ─────────────────────────────────────────────
window._closeRound = function (tId, roundIdx) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  const round = (t.rounds || [])[roundIdx];
  if (!round) return;

  const unfinished = (round.matches || []).filter(m => !m.winner && !m.isBye);
  if (unfinished.length > 0) {
    showConfirmDialog(
      'Rodada Incompleta',
      `Há ${unfinished.length} partida(s) sem resultado. Encerrar mesmo assim?`,
      () => _doCloseRound(t, tId, roundIdx),
      null,
      { type: 'warning', confirmText: 'Encerrar mesmo assim', cancelText: 'Voltar' }
    );
    return;
  }
  _doCloseRound(t, tId, roundIdx);
};

function _doCloseRound(t, tId, roundIdx) {
  t.rounds[roundIdx].status = 'complete';
  t.standings = _computeStandings(t);

  const isSuico = t.format === 'Suíço Clássico';
  const maxRounds = t.swissRounds || 99;

  if (isSuico && t.rounds.length >= maxRounds) {
    t.status = 'finished';
    showNotification('Torneio Encerrado', `${maxRounds} rodadas concluídas!`, 'success');
  } else {
    _generateNextRound(t);
    showNotification('Nova Rodada', `Rodada ${t.rounds.length} gerada!`, 'success');
  }

  window.AppStore.logAction(tId, `Rodada ${roundIdx + 1} encerrada`);
  window.AppStore.sync();
  renderBracket(document.getElementById('view-container'), tId);
}

// ─── Swiss pairing ────────────────────────────────────────────────────────────
function _generateNextRound(t) {
  const standings = _computeStandings(t);
  const roundNum = (t.rounds || []).length + 1;
  const roundIdx = (t.rounds || []).length;
  const timestamp = Date.now();

  const played = new Set();
  (t.rounds || []).forEach(r => {
    (r.matches || []).forEach(m => {
      if (m.p1 && m.p2 && m.p2 !== 'BYE') {
        played.add(`${m.p1}|||${m.p2}`);
        played.add(`${m.p2}|||${m.p1}`);
      }
    });
  });

  const players = standings.map(s => s.name);
  const matched = new Set();
  const newMatches = [];

  // Pair players with similar score, avoiding repeats when possible
  for (let i = 0; i < players.length; i++) {
    if (matched.has(players[i])) continue;
    let paired = false;
    for (let j = i + 1; j < players.length; j++) {
      if (matched.has(players[j])) continue;
      if (!played.has(`${players[i]}|||${players[j]}`)) {
        newMatches.push({
          id: `match-r${roundNum}-${newMatches.length}-${timestamp}`,
          round: roundNum, roundIndex: roundIdx,
          p1: players[i], p2: players[j],
          winner: null,
          label: `R${roundNum} • Partida ${newMatches.length + 1}`
        });
        matched.add(players[i]); matched.add(players[j]);
        paired = true; break;
      }
    }
    if (!paired) {
      // Allow repeat
      for (let j = i + 1; j < players.length; j++) {
        if (!matched.has(players[j])) {
          newMatches.push({
            id: `match-r${roundNum}-${newMatches.length}-${timestamp}`,
            round: roundNum, roundIndex: roundIdx,
            p1: players[i], p2: players[j],
            winner: null,
            label: `R${roundNum} • Partida ${newMatches.length + 1}`
          });
          matched.add(players[i]); matched.add(players[j]);
          break;
        }
      }
    }
  }

  // BYE for odd player
  players.filter(p => !matched.has(p)).forEach(p => {
    newMatches.push({
      id: `bye-r${roundNum}-${timestamp}`,
      round: roundNum, roundIndex: roundIdx,
      p1: p, p2: 'BYE', winner: p, isBye: true,
      label: `R${roundNum} • BYE`
    });
  });

  if (!t.rounds) t.rounds = [];
  t.rounds.push({ round: roundNum, status: 'active', matches: newMatches });
}
