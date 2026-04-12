
// ─── Bracket / Standings View ───────────────────────────────────────────────

// "Só meus jogos" toggle — hides non-user match cards
window._showOnlyMyMatches = false;
window._toggleMyMatches = function(checked) {
  window._showOnlyMyMatches = !!checked;
  _applyMyMatchesFilter();
};
function _applyMyMatchesFilter() {
  var cards = document.querySelectorAll('[data-my-match]');
  if (!cards.length) return;
  cards.forEach(function(card) {
    if (window._showOnlyMyMatches && card.getAttribute('data-my-match') === '0') {
      card.style.display = 'none';
    } else {
      card.style.display = '';
    }
  });
}

function renderBracket(container, tournamentId, isInline) {
  var _t = window._t || function(k) { return k; };
  const tId = tournamentId || window._lastActiveTournamentId;
  const t = tId && window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;

  if (!t) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:3rem;"><h3>${_t('bracket.notFound')}</h3><a href="#dashboard" class="btn btn-primary" style="margin-top:1rem;display:inline-block;">Dashboard</a></div>`;
    return;
  }
  // Store for crown helper access in sub-functions
  window._currentBracketTournament = t;

  // Pre-load player photos from Firestore, then update bracket images
  _preloadPlayerPhotos(t).then(function() {
    // After photos loaded, update all bracket avatar images with real photos
    var bracketImgs = container.querySelectorAll('img[data-player-name]');
    bracketImgs.forEach(function(img) {
      var name = img.getAttribute('data-player-name');
      var realPhoto = window._playerPhotoCache[(name || '').toLowerCase()];
      if (realPhoto && realPhoto.indexOf('dicebear.com') === -1 && img.src.indexOf('dicebear.com') !== -1) {
        var seed = encodeURIComponent(name);
        var fallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + seed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
        img.onerror = function() { this.onerror = null; this.src = fallback; };
        img.src = realPhoto;
      }
    });
  }).catch(function() {});

  const isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);
  const canEnterResult = isOrg || t.resultEntry === 'players' || t.resultEntry === 'referee';
  const isLiga = window._isLigaFormat ? window._isLigaFormat(t) : (t.format === 'Liga' || t.format === 'Ranking');
  const isSuico = t.format === 'Suíço Clássico';
  const isDupla = t.format === 'Dupla Eliminatória';

  const isGrupos = t.format === 'Fase de Grupos + Eliminatórias';
  const hasContent = (t.matches && t.matches.length) || (t.rounds && t.rounds.length) || (t.groups && t.groups.length);

  const _tIdSafe = String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  // Action buttons — ordered: Regras, Inscritos, QR Code, Imprimir, Exportar CSV, Modo TV
  // On mobile: 2-column grid; on desktop: flex wrap
  const actionBtnsHtml = `
    <div class="bracket-action-btns" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <a href="#rules/${t.id}" class="btn btn-secondary btn-sm hover-lift" style="text-align:center;text-decoration:none;">📋 Regras</a>
      <a href="#participants/${t.id}" class="btn btn-secondary btn-sm hover-lift" style="text-align:center;text-decoration:none;">👥 Inscritos</a>
      <button class="btn btn-secondary btn-sm hover-lift no-print" onclick="window._showQRCode('${_tIdSafe}')">📱 QR Code</button>
      ${hasContent ? `<button class="btn btn-secondary btn-sm hover-lift no-print" onclick="window._printBracket()">🖨️ Imprimir</button>` : '<span></span>'}
      ${hasContent ? `<button class="btn btn-secondary btn-sm hover-lift" onclick="window._exportTournamentCSV('${_tIdSafe}')">📊 CSV</button>` : '<span></span>'}
      ${hasContent ? `<button class="btn btn-secondary btn-sm hover-lift no-print" onclick="window._tvMode('${_tIdSafe}')">📺 Modo TV</button>` : '<span></span>'}
      ${isOrg && !hasContent ? `<button class="btn btn-primary btn-sm hover-lift" style="grid-column:span 2;" onclick="window.generateDrawFunction('${_tIdSafe}')">🎲 Realizar Sorteio</button>` : ''}
    </div>
    <style>
      @media (min-width: 768px) {
        .bracket-action-btns { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; }
      }
    </style>`;

  const headerHtml = isInline ? `
    <div class="mb-3">${actionBtnsHtml}</div>` : `
    <div class="sticky-back-header">
      <button class="btn btn-outline hover-lift btn-sm" onclick="window.location.hash='#tournaments/${_tIdSafe}'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>
    </div>
    <div class="d-flex justify-between align-center mb-4" style="flex-wrap:wrap;gap:1rem;">
      <div>
        <h2 style="margin:0;">${isLiga || isSuico ? _t('bracket.title.standings') + ' — ' : isGrupos ? _t('bracket.title.groups') + ' — ' : t.format === 'Rei/Rainha da Praia' ? '👑 ' + _t('bracket.title.monarch') + ' — ' : _t('bracket.title.bracket') + ' — '}${window._safeHtml(t.name)}</h2>
        <div class="d-flex gap-2 mt-1">
          ${hasContent ? `<span class="badge badge-success" style="background:rgba(16,185,129,0.2);color:#34d399;">${_t('bracket.drawDone')}</span>` : `<span class="badge badge-warning">${_t('bracket.waitingDraw')}</span>`}
          <span class="badge badge-info">${t.format || 'Eliminatórias'}</span>
          ${isGrupos && t.currentStage === 'groups' ? `<span class="badge badge-warning">${_t('stage.groups')}</span>` : ''}
          ${isGrupos && t.currentStage === 'elimination' ? `<span class="badge badge-success" style="background:rgba(16,185,129,0.2);color:#34d399;">${_t('stage.elimination')}</span>` : ''}
        </div>
      </div>
      <div>${actionBtnsHtml}</div>
    </div>`;

  // ── Banner "Iniciar Torneio" e Progress Bar (skip quando inline — já existem no card acima) ──
  const hasDrawContent = (t.matches && t.matches.length > 0) || (t.rounds && t.rounds.length > 0) || (t.groups && t.groups.length > 0);
  const startTournamentBanner = (!isInline && isOrg && hasDrawContent && !t.tournamentStarted) ? `
    <div style="margin:1rem 0 1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
        <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Sorteio realizado. Inicie o torneio para habilitar a chamada de presença.</p>
        <button class="btn btn-success btn-cta hover-lift" onclick="window._startTournament('${_tIdSafe}')">
            ▶ Iniciar Torneio
        </button>
    </div>` : '';

  let progressBarHtml = '';
  if (!isInline && hasContent && typeof window._getTournamentProgress === 'function') {
    const _prog = window._getTournamentProgress(t);
    if (_prog.total > 0) {
      const _barColor = _prog.pct === 100 ? '#10b981' : (_prog.pct > 50 ? '#3b82f6' : '#f59e0b');
      progressBarHtml = '<div style="margin: 0 0 1.5rem; padding: 12px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
        '<span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Progresso do Torneio</span>' +
        '<span style="font-size: 0.8rem; font-weight: 700; color: var(--text-bright);">' + _prog.completed + '/' + _prog.total + ' partidas (' + _prog.pct + '%)</span>' +
        '</div>' +
        '<div style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">' +
        '<div style="width: ' + _prog.pct + '%; height: 100%; background: ' + _barColor + '; border-radius: 4px; transition: width 0.5s ease;"></div>' +
        '</div>' +
        (_prog.pct === 100 && t.status !== 'finished' ? '<div style="margin-top: 6px; font-size: 0.75rem; color: #10b981; font-weight: 600;">✅ ' + _t('bracket.allMatchesDone') + '</div>' : '') +
        '</div>';
    }
  }

  // ── "Só meus jogos" toggle ──────────────────────────────────────────────────
  // Reset on each render so toggle always starts OFF
  window._showOnlyMyMatches = false;
  const _cu = window.AppStore && window.AppStore.currentUser;
  const _myMatchesToggle = _cu && hasContent ? `
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:12px;" class="no-print">
      <span style="font-size:0.78rem;font-weight:600;color:var(--text-muted);">Só meus jogos</span>
      <label class="toggle-switch toggle-sm" style="--toggle-on-bg:#f59e0b;--toggle-on-glow:rgba(245,158,11,0.3);--toggle-on-border:#f59e0b;">
        <input type="checkbox" id="my-matches-toggle" onchange="window._toggleMyMatches(this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>` : '';

  // ── Liga / Suíço (Liga inclui antigo Ranking) ──────────────────────────────
  if (isLiga || isSuico) {
    container.innerHTML = headerHtml + startTournamentBanner + progressBarHtml + _myMatchesToggle + renderStandings(t, isOrg, canEnterResult);
    _applyMyMatchesFilter();
    return;
  }

  // ── Fase de Grupos ─────────────────────────────────────────────────────────
  if (isGrupos && t.groups && t.groups.length > 0) {
    if (t.currentStage === 'groups') {
      container.innerHTML = headerHtml + startTournamentBanner + progressBarHtml + _myMatchesToggle + renderGroupStage(t, isOrg, canEnterResult);
      _applyMyMatchesFilter();
      return;
    }
    // If stage is elimination, fall through to bracket rendering below
  }

  // ── Rei/Rainha da Praia ───────────────────────────────────────────────────
  var isMonarch = t.format === 'Rei/Rainha da Praia';
  if (isMonarch && t.groups && t.groups.length > 0) {
    if (t.currentStage === 'groups') {
      container.innerHTML = headerHtml + startTournamentBanner + progressBarHtml + _myMatchesToggle + _renderMonarchStage(t, isOrg, canEnterResult);
      _applyMyMatchesFilter();
      return;
    }
  }

  // ── Sem matches ────────────────────────────────────────────────────────────
  if ((!t.matches || t.matches.length === 0) && !hasContent) {
    container.innerHTML = headerHtml + `
      <div style="display:flex;justify-content:center;align-items:center;min-height:40vh;">
        <div class="text-center text-muted" style="background:rgba(255,255,255,0.02);padding:3rem;border-radius:24px;border:1px dashed rgba(255,255,255,0.1);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.5;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <h3 style="color:var(--text-bright);margin-bottom:.5rem;">Nenhuma chave gerada ainda</h3>
          <p style="max-width:400px;margin:0 auto 1.5rem;">As chaves aparecerão aqui após o organizador realizar o sorteio.</p>
          ${isOrg ? `<button class="btn btn-success hover-lift" onclick="window.generateDrawFunction('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'">🎲 Realizar Sorteio Agora</button>` : ''}
        </div>
      </div>`;
    return;
  }

  // ── Banner de jogos prontos (check-in ativo) ──────────────────────────────
  const readyBannerHtml = _renderReadyMatchesBanner(t);

  // ── Bracket ────────────────────────────────────────────────────────────────
  const standbyHtml = _renderStandbyPanel(t, isOrg);
  try {
    if (isDupla) {
      container.innerHTML = headerHtml + startTournamentBanner + progressBarHtml + _myMatchesToggle + readyBannerHtml + renderDoubleElimBracket(t, canEnterResult) + standbyHtml;
    } else {
      container.innerHTML = headerHtml + startTournamentBanner + progressBarHtml + _myMatchesToggle + readyBannerHtml + renderSingleElimBracket(t, canEnterResult) + standbyHtml;
    }
  } catch (bracketErr) {
    console.error('[Bracket] Render error:', bracketErr);
    container.innerHTML = headerHtml + '<div style="padding:2rem;text-align:center;color:#f87171;"><p>Erro ao renderizar chaveamento.</p><pre style="font-size:0.7rem;text-align:left;max-width:600px;margin:1rem auto;overflow:auto;background:rgba(0,0,0,0.3);padding:1rem;border-radius:8px;">' + window._safeHtml(String(bracketErr.stack || bracketErr)) + '</pre></div>';
  }
  _applyMyMatchesFilter();

  // ── Scrollbar fixa no bottom da viewport (só na view dedicada #bracket) ──
  if ((window.location.hash || '').startsWith('#bracket')) {
    _setupFixedScrollbar(container);
  }
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
          `<option value="${window._safeHtml(p.matchId+'|'+p.slot+'|'+p.memberIdx+'|'+p.display)}">${window._safeHtml(p.display)}</option>`
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
              <button class="btn btn-warning" onclick="window._substituteFromStandby('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'">
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
          `<option value="${p.matchId}|${p.slot}">${window._safeHtml(p.name)}</option>`
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
              <button class="btn btn-warning" onclick="window._substituteFromStandby('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'">
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
  // Repechage tournaments already have all rounds built — skip
  if (t.hasRepechage) return;
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

  // Skip repechage rounds (negative) — only process main bracket rounds
  const rounds = Object.keys(roundsMap).map(Number).filter(r => r >= 1).sort((a, b) => a - b);
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
  if (!t.thirdPlaceMatch) {
    const finalRound = allRoundNums[allRoundNums.length - 1];
    t.thirdPlaceMatch = {
      id: `match-3rd-${Date.now()}`,
      round: finalRound || 1,
      label: _t('bracket.thirdPlaceLabel'),
      p1: 'TBD', p2: 'TBD', winner: null
    };
  }

  // Sempre recalcular participantes do 3º lugar baseado nas semifinais
  if (t.thirdPlaceMatch && !t.thirdPlaceMatch.winner) {
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
  if (typeof window.AppStore !== 'undefined' && typeof window.AppStore.syncImmediate === 'function') {
    window.AppStore.syncImmediate(t.id);
  }
}

// ─── Hidden rounds state, bracket view mode & zoom ──────────────────────────
if (!window._hiddenRounds) window._hiddenRounds = {};
if (window._bracketMirrorMode === undefined) window._bracketMirrorMode = false;
if (window._bracketZoom === undefined) window._bracketZoom = 1;


function renderSingleElimBracket(t, canEnterResult) {
  // ── Auto-reparação: gera rodadas futuras se não existirem ──
  _ensureFutureRounds(t);

  // ── Always recompute progressive classification from current match data ──
  if (typeof _updateProgressiveClassification === 'function') {
    _updateProgressiveClassification(t);
  }

  const allMatches = t.matches || [];

  const roundsMap = {};
  allMatches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });

  // Mostrar TODAS as rodadas (incluindo futuras com TBD)
  // Sort: positive rounds ascending, negative (repechage) placed after round 1
  const activeRounds = Object.keys(roundsMap)
    .map(Number)
    .sort(function(a, b) {
      // Repechage (negative) rounds go after round 1 but before round 2
      var aKey = a < 0 ? 1.5 + (Math.abs(a) * 0.01) : a;
      var bKey = b < 0 ? 1.5 + (Math.abs(b) * 0.01) : b;
      return aKey - bKey;
    });

  if (activeRounds.length === 0) {
    return `<p class="text-muted">Nenhuma rodada ativa.</p>`;
  }

  // Compute expected total rounds from positive rounds only (skip play-in and repechage)
  const positiveRounds = activeRounds.filter(r => r >= 1);
  const firstMainRound = positiveRounds[0] || activeRounds[0];
  // For repechage tournaments, use R2 match count to determine total main rounds
  const hasRepechage = activeRounds.some(r => r < 0);
  const r2Matches = roundsMap[2] ? roundsMap[2].length : 0;
  const round1Matches = roundsMap[firstMainRound] ? roundsMap[firstMainRound].length : 1;
  const baseForCalc = hasRepechage && r2Matches > 0 ? r2Matches : round1Matches;
  const mainRoundCount = baseForCalc > 1
    ? Math.ceil(Math.log2(baseForCalc * 2))
    : 1;

  // Label by position from the end
  const getRoundLabel = (roundNum, roundIndex) => {
    if (roundNum === 0) return 'Play-in';
    if (roundNum < 0) return 'Repescagem' + (Math.abs(roundNum) > 1 ? ' ' + Math.abs(roundNum) : '');
    // For repechage tournaments, count from the last positive round
    var posIdx = positiveRounds.indexOf(roundNum);
    var fromEnd = positiveRounds.length - posIdx;
    if (fromEnd === 1) return _t('bracket.final');
    if (fromEnd === 2) return _t('bracket.semiFinal');
    if (fromEnd === 3) return _t('bracket.quarterFinal');
    return _t('bracket.round', {n: roundNum});
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
  const thirdPlaceMatch = t.thirdPlaceMatch || { id: 'match-3rd-placeholder', p1: 'TBD', p2: 'TBD', winner: null };
  const hasThirdPlace = activeRounds.length >= 2;

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
      <button onclick="window._toggleRoundVisibility('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${maxHiddenRound})"
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
      const hideBtn = (showHide && complete) ? `<button class="btn btn-micro btn-outline" onclick="window._toggleRoundVisibility('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${roundNum})">Ocultar</button>` : '';
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
          <div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:1.5rem;">${matchesHtml}</div>
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
      <div style="margin-top:1.5rem;">
        <h4 style="color:var(--text-bright);font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:.5rem;border-left:3px solid #f59e0b;padding-left:8px;">🥉 3º LUGAR</h4>
        ${renderMatchCard(thirdPlaceMatch, canEnterResult, t.id, thirdPlaceMatchNum)}
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
      const isFinalRound = (mainRoundCount - positiveRounds.indexOf(roundNum)) === 1;
      const complete = isRoundComplete(roundNum);

      // "Ocultar" button — only for completed rounds that are not the final
      const hideBtn = (complete && !isFinalRound) ? `<button class="btn btn-micro btn-outline" onclick="window._toggleRoundVisibility('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${roundNum})">Ocultar</button>` : '';

      const matchesHtml = roundsMap[roundNum].map(m => {
        if (isFinalRound && hasThirdPlace) {
          globalMatchNum++;
          return renderMatchCard(m, canEnterResult, t.id, thirdPlaceMatchNum + 1);
        }
        globalMatchNum++;
        return renderMatchCard(m, canEnterResult, t.id, globalMatchNum);
      }).join('');

      const thirdPlaceCol = (isFinalRound && hasThirdPlace) ? `
        <div style="margin-top:1.5rem;">
          <h4 style="color:var(--text-bright);font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:.5rem;border-left:3px solid #f59e0b;padding-left:8px;">🥉 3º LUGAR</h4>
          ${renderMatchCard(thirdPlaceMatch, canEnterResult, t.id, thirdPlaceMatchNum)}
        </div>` : '';

      roundColumns.push(`
        <div class="bracket-round-column" style="display:flex;flex-direction:column;gap:1rem;min-width:280px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <h4 style="color:var(--text-bright);font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:0;border-left:3px solid var(--primary-color);padding-left:8px;flex:1;">${label}</h4>
            ${hideBtn}
          </div>
          <div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:1.5rem;">
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
      <div style="font-weight:800;color:#fbbf24;font-size:1.1rem;display:flex;align-items:center;justify-content:center;gap:4px;">${typeof window._nameWithCrown === 'function' ? window._nameWithCrown(champion, t) : window._safeHtml(champion)}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">Campeão</div>
    </div>` : '';

  // Progressive classification
  let classifHtml = '';
  if (t.classification && Object.keys(t.classification).length > 0) {
    const medals = {1:'🥇',2:'🥈',3:'🥉',4:'4º'};
    const entries = Object.entries(t.classification).sort((a,b) => a[1] - b[1]);
    const rows = entries.map(function(e) {
      var pos = e[1];
      var name = e[0];
      var badge = medals[pos] || pos + 'º';
      var color = pos === 1 ? '#fbbf24' : pos === 2 ? '#94a3b8' : pos === 3 ? '#cd7f32' : 'var(--text-muted)';
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;"><span style="min-width:28px;text-align:center;font-size:0.9rem;">' + badge + '</span><span style="font-weight:600;color:' + color + ';font-size:0.85rem;display:inline-flex;align-items:center;gap:2px;">' + (typeof window._nameWithCrown === 'function' ? window._nameWithCrown(name, t) : window._safeHtml(name)) + '</span></div>';
    }).join('');
    classifHtml = '<details style="margin-bottom:1rem;" ' + (t.status === 'finished' ? 'open' : '') + '><summary style="cursor:pointer;font-weight:700;font-size:0.8rem;color:var(--text-bright);padding:8px 12px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;user-select:none;">🏅 Classificação (' + entries.length + ' posições definidas)</summary><div style="margin-top:6px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:8px 0;">' + rows + '</div></details>';
  }

  // Toggle button: Linear ↔ Espelhado
  const modeLabel = canMirror ? 'Linear' : 'Espelhado';
  const modeIcon = canMirror ? '➡️' : '🏆';
  const toggleBtnHtml = mirrorPossible ? `
      <button onclick="window._toggleBracketMode('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"
        style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:var(--text-muted);border-radius:20px;padding:5px 14px;font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='var(--text-bright)';this.style.borderColor='rgba(255,255,255,0.25)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='var(--text-muted)';this.style.borderColor='rgba(255,255,255,0.12)'"
        title="Alternar entre visualização linear e espelhada (Copa do Mundo)">
        ${modeIcon} ${modeLabel}
      </button>` : '';

  // Zoom controls with slider
  const zoomPct = Math.round(window._bracketZoom * 100);
  const zoomSteps = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const zoomIdx = zoomSteps.indexOf(window._bracketZoom) >= 0 ? zoomSteps.indexOf(window._bracketZoom) : zoomSteps.length - 1;
  const toolbarHtml = `
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:0.75rem;gap:10px;flex-wrap:wrap;">
      ${toggleBtnHtml}
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:4px 10px;">
        <button onclick="window._setBracketZoom('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', -1)"
          style="background:transparent;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:3px 6px;line-height:1;border-radius:50%;"
          onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'"
          title="Zoom out">−</button>
        <input type="range" id="bracket-zoom-slider" min="0" max="${zoomSteps.length - 1}" value="${zoomIdx}" step="1"
          style="width:80px;height:4px;accent-color:#818cf8;cursor:pointer;vertical-align:middle;"
          oninput="var steps=[0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0];window._bracketZoom=steps[this.value];var lbl=document.getElementById('bracket-zoom-label');if(lbl)lbl.textContent=Math.round(steps[this.value]*100)+'%';var el=document.querySelector('.bracket-scroll-content');if(el){el.style.transform=steps[this.value]===1?'':'scale('+steps[this.value]+')';el.style.transformOrigin='top left';}" />
        <span id="bracket-zoom-label" style="font-size:0.7rem;font-weight:600;color:var(--text-muted);min-width:36px;text-align:center;cursor:pointer;user-select:none;"
          onclick="window._resetBracketZoom('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Resetar zoom">${zoomPct}%</span>
        <button onclick="window._setBracketZoom('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', 1)"
          style="background:transparent;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:3px 6px;line-height:1;border-radius:50%;"
          onmouseover="this.style.color='var(--text-bright)'" onmouseout="this.style.color='var(--text-muted)'"
          title="Zoom in">+</button>
      </div>
    </div>`;

  // Both modes use min-width:max-content + scrollable wrapper (no clipping)
  const zoomTransform = window._bracketZoom !== 1 ? `transform:scale(${window._bracketZoom});transform-origin:top left;` : '';

  return `
    ${championHtml}
    ${classifHtml}
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
          <h4 style="color:#fbbf24;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:1rem;">🏆 ${_t('bracket.grandFinal')}</h4>
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

// ─── Player photo cache (loaded from Firestore) ─────────────────────────────
// Maps displayName (lowercase) -> photoURL
window._playerPhotoCache = window._playerPhotoCache || {};

// Pre-load participant photos from Firestore for a tournament
async function _preloadPlayerPhotos(tournament) {
  if (!window.FirestoreDB || !window.FirestoreDB.db || !tournament) return;
  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  const names = new Set();

  participants.forEach(function(p) {
    if (typeof p === 'string') {
      p.split(' / ').forEach(function(n) { n = n.trim(); if (n && n !== 'TBD' && n !== 'BYE') names.add(n); });
    } else {
      var name = p.displayName || p.name || '';
      if (name) names.add(name);
      // If has email and photoURL already, cache it
      if (name && p.photoURL && p.photoURL.indexOf('dicebear.com') === -1) window._playerPhotoCache[name.toLowerCase()] = p.photoURL;
    }
  });

  // Also add organizer name so their photo is cached for org cards
  if (tournament.organizerName) names.add(tournament.organizerName);
  if (Array.isArray(tournament.coHosts)) {
    tournament.coHosts.forEach(function(ch) {
      if (ch.status === 'active' && ch.displayName) names.add(ch.displayName);
    });
  }

  // Query Firestore for each unique name to get their photoURL
  var promises = [];
  names.forEach(function(name) {
    if (window._playerPhotoCache[name.toLowerCase()]) return; // already cached
    promises.push(
      window.FirestoreDB.db.collection('users')
        .where('displayName', '==', name)
        .limit(1)
        .get()
        .then(function(snap) {
          if (!snap.empty) {
            var data = snap.docs[0].data();
            if (data.photoURL && data.photoURL.indexOf('dicebear.com') === -1) {
              window._playerPhotoCache[name.toLowerCase()] = data.photoURL;
            }
          }
        })
        .catch(function() {})
    );
  });

  // Also try matching by email for participants that have email
  participants.forEach(function(p) {
    if (typeof p !== 'object' || !p.email) return;
    var name = p.displayName || p.name || '';
    if (!name || window._playerPhotoCache[name.toLowerCase()]) return;
    promises.push(
      window.FirestoreDB.db.collection('users')
        .where('email', '==', p.email)
        .limit(1)
        .get()
        .then(function(snap) {
          if (!snap.empty) {
            var data = snap.docs[0].data();
            if (data.photoURL && data.photoURL.indexOf('dicebear.com') === -1 && name) {
              window._playerPhotoCache[name.toLowerCase()] = data.photoURL;
            }
          }
        })
        .catch(function() {})
    );
  });

  await Promise.all(promises);
}

// ─── Player avatars helper for bracket cards ────────────────────────────────
function _teamAvatarHtml(teamName) {
  if (!teamName || teamName === 'TBD') {
    return `<span style="font-weight:600;font-size:0.85rem;opacity:0.4;font-style:italic;">A definir</span>`;
  }
  if (teamName === 'BYE') {
    return `<span style="font-weight:600;font-size:0.85rem;opacity:0.5;">BYE</span>`;
  }
  const members = teamName.split(' / ').map(n => n.trim()).filter(n => n);
  if (members.length === 0) return `<span style="opacity:0.4;">—</span>`;

  let html = members.length > 1 ? '<div style="display:flex;flex-direction:column;gap:2px;overflow:hidden;">' : '';
  members.forEach(function(name) {
    const seed = encodeURIComponent(name);
    // Check photo cache for real user photo
    const rawCached = window._playerPhotoCache[name.toLowerCase()] || '';
    const cachedPhoto = (rawCached && rawCached.indexOf('dicebear.com') === -1) ? rawCached : '';
    const initialsUrl = 'https://api.dicebear.com/9.x/initials/svg?seed=' + seed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
    const photoSrc = cachedPhoto || initialsUrl;
    const onerror = cachedPhoto ? `onerror="this.onerror=null;this.src='${initialsUrl}'"` : '';
    const size = members.length > 1 ? '20px' : '24px';
    const fontSize = members.length > 1 ? '0.78rem' : '0.85rem';
    html += `<div style="display:flex;align-items:center;gap:5px;overflow:hidden;">` +
      `<img src="${photoSrc}" ${onerror} data-player-name="${window._safeHtml(name)}" style="width:${size};height:${size};border-radius:50%;flex-shrink:0;object-fit:cover;">` +
      `<span style="font-weight:600;font-size:${fontSize};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:2px;" onclick="event.stopPropagation();if(typeof window._showPlayerStats==='function')window._showPlayerStats('${name.replace(/'/g, "\\'")}')" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" title="Ver estatísticas de ${window._safeHtml(name)}">${typeof window._nameWithCrown === 'function' && window._currentBracketTournament ? window._nameWithCrown(name, window._currentBracketTournament) : window._safeHtml(name)}</span>` +
    `</div>`;
  });
  if (members.length > 1) html += '</div>';
  return html;
}

function renderMatchCard(m, canEnterResult, tId, matchNum) {
  if (!m) return '';

  const t = window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;
  const useSets = t && t.scoring && t.scoring.type === 'sets';
  const useFixedSet = useSets && t.scoring.fixedSet;

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

  // Format set scores for display
  const formatSetScores = (match, playerNum) => {
    if (!match.sets || !Array.isArray(match.sets) || match.sets.length === 0) {
      const score = playerNum === 1 ? match.scoreP1 : match.scoreP2;
      return score != null ? String(score) : '';
    }
    // Fixed set: show the single set game count as the main score
    if (match.fixedSet || useFixedSet) {
      var s0 = match.sets[0];
      if (!s0) return '';
      return String(playerNum === 1 ? s0.gamesP1 : s0.gamesP2);
    }
    return match.sets.map(s => {
      const g = playerNum === 1 ? s.gamesP1 : s.gamesP2;
      const tb = s.tiebreak;
      if (tb) {
        const won = playerNum === 1 ? (s.gamesP1 > s.gamesP2) : (s.gamesP2 > s.gamesP1);
        return g + (!won && tb ? '(' + (playerNum === 1 ? tb.pointsP1 : tb.pointsP2) + ')' : '');
      }
      return String(g);
    }).join(' ');
  };

  // Inline score inputs (only when match is active, both players known, and result can be entered)
  const showInputs = !isDecided && !isByeMatch && !hasTBD && canEnterResult;

  // Check-in dot indicator
  const ciDot = (status) => {
    if (!hasAnyCheckIn && !matchReady) return '';
    const color = status === 'full' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#64748b';
    const title = status === 'full' ? 'Presente' : status === 'partial' ? 'Parcial' : 'Ausente';
    return `<span title="${title}" style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin-right:4px;display:inline-block;"></span>`;
  };

  const _esc = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); };
  const p1Row = `
    <div style="${rowStyle(p1IsWinner, 'p1')}">
      ${ciDot(p1ci)}<div style="flex:1;overflow:hidden;min-width:0;">${_teamAvatarHtml(m.p1)}</div>
      ${showInputs
        ? `<input type="number" id="s1-${m.id}" min="0" placeholder="0"
            style="width:52px;text-align:center;font-size:0.95rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:6px;padding:4px 6px;flex-shrink:0;"
            oninput="window._highlightWinner('${_esc(m.id)}')">`
        : scoreDisplay(useSets && isDecided ? formatSetScores(m, 1) : m.scoreP1, p1IsWinner)
      }
    </div>`;

  const p2Row = `
    <div style="${rowStyle(p2IsWinner, 'p2')}">
      ${ciDot(p2ci)}<div style="flex:1;overflow:hidden;min-width:0;">${_teamAvatarHtml(m.p2)}</div>
      ${showInputs
        ? `<input type="number" id="s2-${m.id}" min="0" placeholder="0"
            style="width:52px;text-align:center;font-size:0.95rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text-bright);border-radius:6px;padding:4px 6px;flex-shrink:0;"
            oninput="window._highlightWinner('${_esc(m.id)}')">`
        : scoreDisplay(useSets && isDecided ? formatSetScores(m, 2) : m.scoreP2, p2IsWinner)
      }
    </div>`;

  const vsRow = `<div style="text-align:center;font-size:0.65rem;color:var(--text-muted);font-weight:800;letter-spacing:2px;padding:3px 0;">VS</div>`;

  // Format set scores for winner badge
  const _isFixedSetMatch = m.fixedSet || useFixedSet;
  const setsDisplay = isDecided && useSets && m.sets && m.sets.length > 0
    ? _isFixedSetMatch
      ? (() => {
          var _s0 = m.sets[0];
          var _tbText = _s0 && _s0.tiebreak ? ' TB(' + _s0.tiebreak.pointsP1 + '-' + _s0.tiebreak.pointsP2 + ')' : '';
          return `<div style="text-align:center;font-size:0.82rem;color:var(--text-main);font-weight:600;margin-top:4px;font-family:monospace;">
            ⚡ ${_s0.gamesP1}-${_s0.gamesP2}${_tbText}
          </div>`;
        })()
      : `<div style="text-align:center;font-size:0.82rem;color:var(--text-main);font-weight:600;margin-top:4px;font-family:monospace;">
          ${m.sets.map(s => s.gamesP1 + '-' + s.gamesP2 + (s.tiebreak ? '(' + Math.min(s.tiebreak.pointsP1, s.tiebreak.pointsP2) + ')' : '')).join('  ')}
        </div>`
    : '';

  const winnerBadge = isDecided && !isByeMatch
    ? `<div style="text-align:center;font-size:0.75rem;color:#4ade80;font-weight:700;margin-top:6px;padding:4px;background:rgba(16,185,129,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px;">🏆 ${typeof window._nameWithCrown === 'function' && window._currentBracketTournament ? window._nameWithCrown(m.winner, window._currentBracketTournament) : window._safeHtml(m.winner)}</div>${setsDisplay}`
    : isByeMatch
    ? `<div style="text-align:center;font-size:0.72rem;color:#4ade80;font-weight:700;margin-top:6px;">BYE — Avança Direto</div>`
    : '';


  const headerConfirmBtn = showInputs
    ? `<button id="confirm-${m.id}" onclick="window._saveResultInline('${_esc(tId)}','${_esc(m.id)}')"
        style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#4ade80;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;transition:all 0.2s;"
        onmouseover="this.style.background='rgba(16,185,129,0.3)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">✓ ${_t('bracket.confirm')}</button>`
    : '';

  const headerEditBtn = isDecided && !isByeMatch && canEnterResult
    ? `<button onclick="window._editResult('${_esc(tId)}','${_esc(m.id)}')"
          style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#fbbf24;border-radius:6px;padding:3px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:3px;"
          onmouseover="this.style.background='rgba(245,158,11,0.2)'" onmouseout="this.style.background='rgba(245,158,11,0.1)'"
          title="${_t('bracket.editResult')}">✏️ ${_t('bracket.editResult')}</button>`
    : '';

  const matchLabel = m.label || (matchNum ? `Jogo ${matchNum}` : 'Partida');

  // Detect if current user participates in this match
  const _cu = window.AppStore && window.AppStore.currentUser;
  const _cuName = _cu ? (_cu.displayName || '') : '';
  const _cuEmail = _cu ? (_cu.email || '') : '';
  const _isMyMatch = !!(_cu && !isByeMatch && (function() {
    var sides = [m.p1 || '', m.p2 || ''];
    for (var si = 0; si < sides.length; si++) {
      var s = sides[si];
      if (!s || s === 'TBD' || s === 'BYE') continue;
      if (_cuName && (s === _cuName || s.indexOf(_cuName) !== -1)) return true;
      if (_cuEmail && s === _cuEmail) return true;
      if (s.indexOf('/') !== -1) {
        var members = s.split('/').map(function(n) { return n.trim(); });
        for (var mi = 0; mi < members.length; mi++) {
          if (_cuName && members[mi] === _cuName) return true;
          if (_cuEmail && members[mi] === _cuEmail) return true;
        }
      }
    }
    return false;
  })());

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

  // Golden highlight for user's own matches
  if (_isMyMatch && !matchReady && !matchPartial) {
    cardBorder = 'rgba(251,191,36,0.5)';
  }
  const _myStyle = _isMyMatch ? 'background:rgba(251,191,36,0.04);box-shadow:0 0 12px rgba(251,191,36,0.08),0 4px 12px rgba(0,0,0,0.15);' : '';

  return `
    <div id="card-${m.id}" data-my-match="${_isMyMatch ? '1' : '0'}" style="background:var(--bg-card);border:1px solid ${cardBorder};border-radius:12px;padding:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);${hasTBD ? 'opacity:0.6;' : ''}${matchReady ? 'box-shadow:0 0 16px rgba(16,185,129,0.15),0 4px 12px rgba(0,0,0,0.15);' : ''}${_myStyle}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:5px;">
        <span style="font-size:0.7rem;font-weight:700;color:#38bdf8;text-transform:uppercase;">${window._safeHtml(matchLabel)}</span>
        <div style="display:flex;align-items:center;gap:4px;">${readyBadge}${headerConfirmBtn}${headerEditBtn}</div>
      </div>
      ${p1Row}
      ${vsRow}
      ${p2Row}
      ${winnerBadge}
    </div>`;
}

// ─── Highlight winner based on score while typing ─────────────────────────────

// ── Rei/Rainha da Praia Rendering ────────────────────────────────────────────
function _renderMonarchStage(t, isOrg, canEnterResult) {
  var html = '';
  var allGroupsDone = true;

  (t.groups || []).forEach(function(g, gi) {
    var standings = typeof window._computeMonarchStandings === 'function' ? window._computeMonarchStandings(g) : [];
    var matches = (g.rounds && g.rounds[0]) ? g.rounds[0].matches : [];
    var groupDone = matches.length > 0 && matches.every(function(m) { return !!m.winner; });
    if (!groupDone) allGroupsDone = false;

    // Standings table
    var medal = function(i) { return i === 0 ? '👑' : (i + 1) + 'º'; };
    var classified = t.monarchClassified || 1;
    var standingsRows = standings.map(function(s, i) {
      var diff = s.pointsFor - s.pointsAgainst;
      var bg = i < classified ? 'rgba(251,191,36,0.08)' : '';
      var clr = i < classified ? '#fbbf24' : 'var(--text-muted)';
      return '<tr style="border-bottom:1px solid var(--border-color);' + (bg ? 'background:' + bg + ';' : '') + '">' +
        '<td style="padding:6px 10px;font-weight:700;color:' + clr + ';text-align:center;">' + medal(i) + '</td>' +
        '<td style="padding:6px 10px;font-weight:600;color:var(--text-bright);">' + (typeof window._nameWithCrown === 'function' && window._currentBracketTournament ? window._nameWithCrown(s.name, window._currentBracketTournament) : window._safeHtml(s.name)) + (i < classified ? ' <span style="font-size:0.6rem;color:#fbbf24;font-weight:800;">CLASSIF.</span>' : '') + '</td>' +
        '<td style="padding:6px 10px;text-align:center;color:#4ade80;font-weight:700;">' + s.wins + '</td>' +
        '<td style="padding:6px 10px;text-align:center;color:#f87171;">' + s.losses + '</td>' +
        '<td style="padding:6px 10px;text-align:center;color:var(--text-bright);">' + s.pointsFor + '</td>' +
        '<td style="padding:6px 10px;text-align:center;color:var(--text-muted);">' + s.pointsAgainst + '</td>' +
        '<td style="padding:6px 10px;text-align:center;color:' + (diff >= 0 ? '#4ade80' : '#f87171') + ';">' + (diff >= 0 ? '+' : '') + diff + '</td>' +
      '</tr>';
    }).join('');

    var standingsTable = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-bottom:1rem;">' +
      '<thead><tr style="border-bottom:2px solid var(--border-color);">' +
      '<th style="padding:6px 10px;text-align:center;color:var(--text-muted);font-size:0.7rem;">#</th>' +
      '<th style="padding:6px 10px;color:var(--text-muted);font-size:0.7rem;">Jogador</th>' +
      '<th style="padding:6px 10px;text-align:center;color:var(--text-muted);font-size:0.7rem;">V</th>' +
      '<th style="padding:6px 10px;text-align:center;color:var(--text-muted);font-size:0.7rem;">D</th>' +
      '<th style="padding:6px 10px;text-align:center;color:var(--text-muted);font-size:0.7rem;">PF</th>' +
      '<th style="padding:6px 10px;text-align:center;color:var(--text-muted);font-size:0.7rem;">PC</th>' +
      '<th style="padding:6px 10px;text-align:center;color:var(--text-muted);font-size:0.7rem;">Saldo</th>' +
      '</tr></thead><tbody>' + standingsRows + '</tbody></table>';

    // Match cards
    var matchCards = matches.map(function(m, mi) {
      return renderMatchCard(m, canEnterResult, t.id, (gi * 3) + mi + 1);
    }).join('');

    var statusBadge = groupDone ? '<span style="font-size:0.65rem;padding:2px 8px;border-radius:6px;background:rgba(16,185,129,0.15);color:#4ade80;font-weight:700;">' + _t('bracket.complete') + '</span>' : '<span style="font-size:0.65rem;padding:2px 8px;border-radius:6px;background:rgba(251,191,36,0.15);color:#fbbf24;font-weight:700;">' + _t('bracket.ongoing') + '</span>';

    html += '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-left:4px solid ' + (groupDone ? '#4ade80' : '#fbbf24') + ';border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;">' +
        '<h3 style="margin:0;font-size:1.1rem;color:var(--text-bright);flex:1;">' + window._safeHtml(g.name) + '</h3>' +
        statusBadge +
      '</div>' +
      '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;">Jogadores: ' + (g.players || []).map(function(n) { return window._safeHtml(n); }).join(', ') + '</div>' +
      standingsTable +
      '<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px;">Partidas com rodízio de parceiros</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' + matchCards + '</div>' +
    '</div>';
  });

  // Auto-advance to elimination when all groups are done
  if (allGroupsDone) {
    html += '<div style="text-align:center;margin-top:1.5rem;padding:1rem;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:12px;">' +
      '<div style="font-size:1.2rem;font-weight:700;color:#fbbf24;">👑 ' + _t('monarch.groupsComplete') + '</div>' +
      '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">' + _t('monarch.advancingQualified') + '</div>' +
    '</div>';
    // Trigger auto-advance after render
    setTimeout(function() {
      if (typeof window._advanceMonarchToElimination === 'function') {
        window._advanceMonarchToElimination(String(t.id));
      }
    }, 600);
  }

  return html;
}

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
      <button class="btn btn-warning btn-lg hover-lift" onclick="window._advanceToElimination('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'">
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
        if (m.draw || m.winner === 'draw') {
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
        <td style="padding:8px 12px;font-weight:600;color:var(--text-bright);">${typeof window._nameWithCrown === 'function' ? window._nameWithCrown(s.name, t) : window._safeHtml(s.name)} ${i < classified ? '<span style="font-size:0.65rem;color:#4ade80;font-weight:800;">CLASSIF.</span>' : ''}</td>
        <td style="padding:8px 12px;font-weight:800;color:var(--primary-color);text-align:center;">${s.points}</td>
        <td style="padding:8px 12px;text-align:center;color:#4ade80;">${s.wins}</td>
        <td style="padding:8px 12px;text-align:center;color:#94a3b8;">${s.draws || 0}</td>
        <td style="padding:8px 12px;text-align:center;color:#f87171;">${s.losses}</td>
        <td style="padding:8px 12px;text-align:center;color:${s.pointsDiff >= 0 ? '#4ade80' : '#f87171'};">${s.pointsDiff >= 0 ? '+' : ''}${s.pointsDiff}</td>
      </tr>`).join('');

    // Mostrar TODAS as rodadas do grupo (completas, ativa e pendentes)
    const allRoundsHtml = (g.rounds || []).map((r, ri) => {
      const roundLabel = _t('bracket.round', {n: ri + 1}) + (r.status === 'complete' ? ' — ' + _t('bracket.complete') + ' ✓' : r.status === 'active' ? ' — ' + _t('bracket.ongoing') : '');
      const roundLabelColor = r.status === 'complete' ? '#4ade80' : r.status === 'active' ? '#fbbf24' : 'var(--text-muted)';
      const matchesInRound = (r.matches || []).map(m => {
        groupGlobalMatchNum++;
        return `<div style="min-width:250px;max-width:300px;flex:1;">${renderMatchCard(m, canEnterResult && r.status === 'active', t.id, groupGlobalMatchNum)}</div>`;
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
        <h3 style="margin:0 0 1rem;color:${groupColor};font-size:1rem;font-weight:800;">${window._safeHtml(g.name)}</h3>
        <div style="overflow-x:auto;margin-bottom:1rem;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-color);">
                <th style="padding:6px 12px;text-align:left;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">#</th>
                <th style="padding:6px 12px;text-align:left;font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;">Participante</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:var(--primary-color);text-transform:uppercase;">Pts</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:#4ade80;text-transform:uppercase;">V</th>
                <th style="padding:6px 12px;text-align:center;font-size:0.65rem;color:#94a3b8;text-transform:uppercase;">E</th>
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

function renderStandings(t, isOrg, canEnterResult) {
  const rounds = t.rounds || [];
  const currentRound = rounds.length;

  if (!currentRound) {
    return `
      <div style="text-align:center;padding:3rem;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);border-radius:24px;">
        <h3 style="color:var(--text-bright);">Nenhuma rodada gerada ainda</h3>
        <p class="text-muted">O organizador deve realizar o sorteio para iniciar a primeira rodada.</p>
        ${isOrg ? `<button class="btn btn-primary" style="margin-top:1rem;" onclick="window.generateDrawFunction('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'">🎲 Iniciar Primeira Rodada</button>` : ''}
      </div>`;
  }

  const categories = (typeof window._sortCategoriesBySkillOrder === 'function')
    ? window._sortCategoriesBySkillOrder(t.combinedCategories || [], t.skillCategories)
    : (t.combinedCategories || []);
  const hasCats = categories.length > 0;

  const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
  const posColor = i => i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)';

  const _useSetsStandings = t.scoring && t.scoring.type === 'sets';
  const _buildStandingsRows = function(computed) {
    return computed.map((s, i) => {
      var _setsDiff = (s.setsWon || 0) - (s.setsLost || 0);
      var _gamesDiff = (s.gamesWon || 0) - (s.gamesLost || 0);
      return `
    <tr style="border-bottom:1px solid var(--border-color);${i < 3 ? 'background:rgba(251,191,36,0.03)' : ''}">
      <td style="padding:11px 14px;font-weight:800;color:${posColor(i)};">${medal(i)}</td>
      <td style="padding:11px 14px;font-weight:600;color:var(--text-bright);display:flex;align-items:center;gap:6px;"><span style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;display:inline-flex;align-items:center;gap:2px;" onclick="window._showPlayerHistory('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}','${s.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Ver confrontos">${typeof window._nameWithCrown === 'function' ? window._nameWithCrown(s.name, t) : window._safeHtml(s.name)}</span><span style="cursor:pointer;font-size:0.7rem;opacity:0.5;transition:opacity 0.2s;" onclick="event.stopPropagation();if(typeof window._showPlayerStats==='function')window._showPlayerStats('${s.name.replace(/'/g, "\\'")}')" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'" title="Estatísticas globais">📊</span></td>
      <td style="padding:11px 14px;font-weight:800;color:var(--primary-color);text-align:center;">${s.points}</td>
      <td style="padding:11px 14px;text-align:center;color:#4ade80;">${s.wins}</td>
      <td style="padding:11px 14px;text-align:center;color:#94a3b8;">${s.draws || 0}</td>
      <td style="padding:11px 14px;text-align:center;color:#f87171;">${s.losses}</td>
      <td style="padding:11px 14px;text-align:center;color:${s.pointsDiff >= 0 ? '#4ade80' : '#f87171'};">${s.pointsDiff >= 0 ? '+' : ''}${s.pointsDiff}</td>` +
      (_useSetsStandings ? `
      <td style="padding:11px 14px;text-align:center;color:${_setsDiff >= 0 ? '#06b6d4' : '#f87171'};">${_setsDiff >= 0 ? '+' : ''}${_setsDiff}</td>
      <td style="padding:11px 14px;text-align:center;color:${_gamesDiff >= 0 ? '#8b5cf6' : '#f87171'};">${_gamesDiff >= 0 ? '+' : ''}${_gamesDiff}</td>` : '') + `
      <td style="padding:11px 14px;text-align:center;color:var(--text-muted);">${s.played}</td>
    </tr>`;
    }).join('');
  };

  // If tournament has categories, compute per-category; otherwise single table
  var standingsSections = [];
  if (hasCats) {
    categories.forEach(function(cat) {
      var catComputed = _computeStandings(t, cat);
      if (catComputed.length === 0) return; // skip empty categories
      standingsSections.push({ label: cat, rows: _buildStandingsRows(catComputed) });
    });
  }
  if (standingsSections.length === 0) {
    // Fallback: single standings table (no categories or all empty)
    standingsSections.push({ label: null, rows: _buildStandingsRows(_computeStandings(t)) });
  }

  const currentRoundData = rounds[currentRound - 1];
  const allComplete = (currentRoundData.matches || []).every(m => m.winner);
  const isSuico = t.format === 'Suíço Clássico';
  const isLigaFmt = window._isLigaFormat ? window._isLigaFormat(t) : (t.format === 'Liga' || t.format === 'Ranking');
  const maxRounds = t.swissRounds || 99;
  const isFinished = isSuico && currentRound >= maxRounds && allComplete;

  // Liga/Ranking: show auto-draw countdown if applicable
  let rankingCountdownHtml = '';
  if (isLigaFmt && !t.drawManual && t.drawFirstDate && typeof window._calcNextDrawDate === 'function') {
    const _nextDraw = window._calcNextDrawDate(t);
    if (_nextDraw) {
      const _now = new Date();
      const _diff = _nextDraw.getTime() - _now.getTime();
      if (_diff > 0) {
        const _d = Math.floor(_diff / 86400000);
        const _h = Math.floor((_diff % 86400000) / 3600000);
        const _m = Math.floor((_diff % 3600000) / 60000);
        const _parts = [];
        if (_d > 0) _parts.push(_d + 'd');
        if (_h > 0) _parts.push(_h + 'h');
        _parts.push(_m + 'min');
        rankingCountdownHtml = `<div style="text-align:center;margin-bottom:1rem;padding:10px 16px;background:rgba(251,146,60,0.1);border:1px solid rgba(251,146,60,0.25);border-radius:10px;font-size:0.85rem;">
          <span style="color:#fb923c;font-weight:700;">⏱️ Próximo sorteio automático em <b>${_parts.join(' ')}</b></span>
        </div>`;
      }
    }
  }

  const _isReiRainhaRound = currentRoundData.format === 'rei_rainha' && Array.isArray(currentRoundData.monarchGroups) && currentRoundData.monarchGroups.length > 0;

  const currentRoundHtml = `
    <div class="card" style="margin-top:1.5rem;">
      ${rankingCountdownHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem;">
        <h3 class="card-title" style="margin:0;">${_isReiRainhaRound ? '👑 ' : ''}${_t('bracket.round', {n: currentRound})}${isSuico ? ` / ${maxRounds}` : ''} ${currentRoundData.status === 'complete' ? '— ' + _t('bracket.complete') + ' ✓' : '— ' + _t('bracket.ongoing')}</h3>
        ${isOrg && !isFinished && allComplete ? `
          <button onclick="window._closeRound('${String(t.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${currentRound - 1})"
            style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#4ade80;border-radius:8px;padding:8px 18px;font-weight:600;cursor:pointer;font-size:0.85rem;">
            ✓ Encerrar Rodada e Gerar Próxima
          </button>` : ''}
        ${isFinished ? `<span style="color:#fbbf24;font-weight:700;">🏆 Torneio Encerrado!</span>` : ''}
      </div>
      ${_isReiRainhaRound ? (() => {
        return currentRoundData.monarchGroups.map(function(g) {
          var gStandings = typeof window._computeMonarchStandings === 'function' ? window._computeMonarchStandings(g) : [];
          var gDone = g.matches.length > 0 && g.matches.every(function(m) { return !!m.winner; });
          var gRows = gStandings.map(function(s, si) {
            var diff = s.pointsFor - s.pointsAgainst;
            return '<tr style="border-bottom:1px solid var(--border-color);">' +
              '<td style="padding:5px 8px;font-weight:700;color:' + (si === 0 ? '#fbbf24' : 'var(--text-muted)') + ';text-align:center;">' + (si === 0 ? '👑' : (si+1)+'º') + '</td>' +
              '<td style="padding:5px 8px;font-weight:600;color:var(--text-bright);">' + window._safeHtml(s.name) + '</td>' +
              '<td style="padding:5px 8px;text-align:center;color:#4ade80;font-weight:700;">' + s.wins + '</td>' +
              '<td style="padding:5px 8px;text-align:center;color:#f87171;">' + s.losses + '</td>' +
              '<td style="padding:5px 8px;text-align:center;color:' + (diff >= 0 ? '#4ade80' : '#f87171') + ';">' + (diff>=0?'+':'') + diff + '</td>' +
            '</tr>';
          }).join('');
          var gTable = '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:0.75rem;">' +
            '<thead><tr style="border-bottom:2px solid var(--border-color);">' +
            '<th style="padding:5px 8px;text-align:center;color:var(--text-muted);font-size:0.65rem;">#</th>' +
            '<th style="padding:5px 8px;color:var(--text-muted);font-size:0.65rem;">Jogador</th>' +
            '<th style="padding:5px 8px;text-align:center;color:var(--text-muted);font-size:0.65rem;">V</th>' +
            '<th style="padding:5px 8px;text-align:center;color:var(--text-muted);font-size:0.65rem;">D</th>' +
            '<th style="padding:5px 8px;text-align:center;color:var(--text-muted);font-size:0.65rem;">Saldo</th>' +
            '</tr></thead><tbody>' + gRows + '</tbody></table>';
          var gCards = g.matches.map(function(m, mi) {
            return '<div style="min-width:240px;max-width:320px;flex:1;">' + renderMatchCard(m, canEnterResult && currentRoundData.status !== 'complete', t.id, mi + 1) + '</div>';
          }).join('');
          var statusBadge = gDone ? '<span style="font-size:0.6rem;padding:2px 6px;border-radius:5px;background:rgba(16,185,129,0.15);color:#4ade80;font-weight:700;">✓</span>' : '<span style="font-size:0.6rem;padding:2px 6px;border-radius:5px;background:rgba(251,191,36,0.15);color:#fbbf24;font-weight:700;">' + _t('bracket.ongoing') + '</span>';
          return '<div style="background:rgba(251,191,36,0.03);border:1px solid rgba(251,191,36,0.15);border-left:3px solid ' + (gDone?'#4ade80':'#fbbf24') + ';border-radius:10px;padding:1rem;margin-bottom:1rem;">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:0.75rem;"><strong style="font-size:0.9rem;color:var(--text-bright);">' + window._safeHtml(g.name) + '</strong>' + statusBadge + '</div>' +
            '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.5rem;">Jogadores: ' + g.players.map(function(n){return window._safeHtml(n);}).join(', ') + '</div>' +
            gTable +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + gCards + '</div>' +
          '</div>';
        }).join('');
      })() : `<div style="display:flex;flex-wrap:wrap;gap:16px;">
        ${(() => { const prevMatches = rounds.slice(0, currentRound - 1).reduce((sum, r) => sum + (r.matches || []).length, 0); return (currentRoundData.matches || []).map((m, idx) => `<div style="min-width:260px;max-width:320px;flex:1;">${renderMatchCard(m, canEnterResult && currentRoundData.status !== 'complete', t.id, prevMatches + idx + 1)}</div>`).join(''); })()}
      </div>`}
    </div>`;

  const _thStyle = 'padding:9px 14px;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;cursor:pointer;user-select:none;white-space:nowrap;transition:color 0.15s;';
  var _gsmColIdx = 8; // next col after J when GSM is active
  const _gsmHeaders = _useSetsStandings ? `
              <th style="${_thStyle}text-align:center;color:#06b6d4;" data-sort-col="7" data-sort-type="num" onclick="window._sortStandingsTable(this)">±S <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              <th style="${_thStyle}text-align:center;color:#8b5cf6;" data-sort-col="8" data-sort-type="num" onclick="window._sortStandingsTable(this)">±G <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>` : '';
  var _jColIdx = _useSetsStandings ? 9 : 7;
  const _tableHeader = `<thead>
            <tr style="border-bottom:2px solid var(--border-color);">
              <th style="${_thStyle}text-align:left;color:var(--text-muted);" data-sort-col="0" data-sort-type="num" onclick="window._sortStandingsTable(this)"># <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">▼</span></th>
              <th style="${_thStyle}text-align:left;color:var(--text-muted);" data-sort-col="1" data-sort-type="text" onclick="window._sortStandingsTable(this)">Participante <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              <th style="${_thStyle}text-align:center;color:var(--primary-color);" data-sort-col="2" data-sort-type="num" onclick="window._sortStandingsTable(this)">Pts <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              <th style="${_thStyle}text-align:center;color:#4ade80;" data-sort-col="3" data-sort-type="num" onclick="window._sortStandingsTable(this)">V <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              <th style="${_thStyle}text-align:center;color:#94a3b8;" data-sort-col="4" data-sort-type="num" onclick="window._sortStandingsTable(this)">E <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              <th style="${_thStyle}text-align:center;color:#f87171;" data-sort-col="5" data-sort-type="num" onclick="window._sortStandingsTable(this)">D <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              <th style="${_thStyle}text-align:center;color:var(--text-muted);" data-sort-col="6" data-sort-type="num" onclick="window._sortStandingsTable(this)">Saldo <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
              ${_gsmHeaders}
              <th style="${_thStyle}text-align:center;color:var(--text-muted);" data-sort-col="${_jColIdx}" data-sort-type="num" onclick="window._sortStandingsTable(this)">J <span class="sort-arrow" style="font-size:0.6rem;opacity:0.4;">⇅</span></th>
            </tr>
          </thead>`;

  const standingsTablesHtml = standingsSections.map(function(sec) {
    var displayLabel = sec.label && window._displayCategoryName ? window._displayCategoryName(sec.label) : sec.label;
    var title = displayLabel
      ? `Classificação — ${displayLabel} — Rodada ${currentRound}${isSuico ? ' / ' + maxRounds : ''}`
      : `Classificação — Rodada ${currentRound}${isSuico ? ' / ' + maxRounds : ''}`;
    return `<div class="card" style="margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 class="card-title" style="margin:0;">${title}</h3>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          ${_tableHeader}
          <tbody>${sec.rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  // ── Previous rounds (collapsed, expandable) ──────────────────────────────
  let previousRoundsHtml = '';
  if (currentRound > 1) {
    let prevRoundsInner = '';
    for (var ri = currentRound - 2; ri >= 0; ri--) {
      var rd = rounds[ri];
      if (!rd || !rd.matches || rd.matches.length === 0) continue;
      var prevMatchOffset = rounds.slice(0, ri).reduce(function(sum, r) { return sum + (r.matches || []).length; }, 0);
      var rdComplete = (rd.matches || []).every(function(m) { return m.winner; });
      var rdIsRR = rd.format === 'rei_rainha';
      prevRoundsInner += '<div style="margin-bottom: 12px;">' +
        '<div style="font-weight: 700; font-size: 0.85rem; color: var(--text-bright); margin-bottom: 8px;">' + (rdIsRR ? '👑 ' : '') + _t('bracket.round', {n: ri + 1}) + (rdComplete ? ' — ' + _t('bracket.complete') + ' ✓' : '') + '</div>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
      rd.matches.forEach(function(m, mi) {
        if (!m.p1 && !m.p2) return;
        var w = m.winner;
        var isDraw = w === 'draw' || m.draw;
        var p1Style = w === m.p1 ? 'color:#4ade80;font-weight:700;' : (isDraw ? 'color:#94a3b8;' : 'color:var(--text-muted);opacity:0.7;');
        var p2Style = w === m.p2 ? 'color:#4ade80;font-weight:700;' : (isDraw ? 'color:#94a3b8;' : 'color:var(--text-muted);opacity:0.7;');
        var score = (m.scoreP1 !== undefined && m.scoreP1 !== null) ? (m.scoreP1 + ' x ' + m.scoreP2) : (w ? (isDraw ? 'Empate' : '') : 'Pendente');
        prevRoundsInner += '<div style="min-width: 200px; flex: 1; max-width: 280px; background: rgba(0,0,0,0.15); border-radius: 8px; padding: 8px 12px; font-size: 0.8rem;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<span style="' + p1Style + '">' + (m.p1 || 'TBD') + '</span>' +
          '<span style="font-size: 0.7rem; color: var(--text-muted); margin: 0 6px;">' + score + '</span>' +
          '<span style="' + p2Style + '">' + (m.p2 || 'TBD') + '</span>' +
          '</div></div>';
      });
      prevRoundsInner += '</div></div>';
    }
    if (prevRoundsInner) {
      previousRoundsHtml = '<div class="card" style="margin-top: 1rem;">' +
        '<details>' +
        '<summary style="cursor: pointer; font-weight: 700; font-size: 1rem; color: var(--text-bright); padding: 4px 0; user-select: none;">📜 ' + _t('bracket.previousRounds') + ' (' + (currentRound - 1) + ')</summary>' +
        '<div style="margin-top: 12px;">' + prevRoundsInner + '</div>' +
        '</details></div>';
    }
  }

  // ── Tournament statistics summary ─────────────────────────────────────────
  let statsHtml = '';
  if (currentRound >= 2) {
    // Compute from all standings sections
    var allPlayers = [];
    standingsSections.forEach(function(sec) {
      var catLabel = sec.label;
      var computed = typeof window._computeStandings === 'function'
        ? window._computeStandings(t, catLabel || undefined)
        : [];
      computed.forEach(function(s) { allPlayers.push(s); });
    });
    if (allPlayers.length > 0) {
      // Sort by different metrics
      var byWins = allPlayers.slice().sort(function(a, b) { return b.wins - a.wins || b.points - a.points; });
      var byStreak = []; // find current win streaks
      allPlayers.forEach(function(p) {
        var streak = 0;
        // Count consecutive wins from most recent matches
        for (var ri2 = rounds.length - 1; ri2 >= 0; ri2--) {
          var foundMatch = false;
          (rounds[ri2].matches || []).forEach(function(m) {
            if (foundMatch) return;
            if (m.p1 === p.name || m.p2 === p.name) {
              foundMatch = true;
              if (m.winner === p.name) { streak++; }
              else { streak = -1; } // break
            }
          });
          if (streak === -1) { streak = 0; break; }
          if (!foundMatch) break;
        }
        if (streak >= 2) byStreak.push({ name: p.name, streak: streak });
      });
      byStreak.sort(function(a, b) { return b.streak - a.streak; });

      var statItems = [];
      if (byWins[0] && byWins[0].wins > 0) {
        statItems.push('<div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(251,191,36,0.08); border-radius: 10px; border-left: 3px solid #fbbf24;">' +
          '<span style="font-size: 1.1rem;">⚡</span>' +
          '<div><div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Mais vitórias</div>' +
          '<div style="font-weight: 700; color: var(--text-bright);">' + byWins[0].name + ' <span style="color: #4ade80;">(' + byWins[0].wins + 'V)</span></div></div></div>');
      }
      if (byStreak[0] && byStreak[0].streak >= 2) {
        statItems.push('<div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(16,185,129,0.08); border-radius: 10px; border-left: 3px solid #10b981;">' +
          '<span style="font-size: 1.1rem;">🔥</span>' +
          '<div><div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Sequência de vitórias</div>' +
          '<div style="font-weight: 700; color: var(--text-bright);">' + byStreak[0].name + ' <span style="color: #10b981;">(' + byStreak[0].streak + ' seguidas)</span></div></div></div>');
      }
      var totalMatches = rounds.reduce(function(sum, r) { return sum + (r.matches || []).filter(function(m) { return m.winner && !m.isBye; }).length; }, 0);
      var totalDraws = rounds.reduce(function(sum, r) { return sum + (r.matches || []).filter(function(m) { return m.winner === 'draw' || m.draw; }).length; }, 0);
      if (totalMatches > 0) {
        statItems.push('<div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(99,102,241,0.08); border-radius: 10px; border-left: 3px solid #6366f1;">' +
          '<span style="font-size: 1.1rem;">📈</span>' +
          '<div><div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Partidas disputadas</div>' +
          '<div style="font-weight: 700; color: var(--text-bright);">' + totalMatches + ' partidas' + (totalDraws > 0 ? ' <span style="color: #94a3b8;">(' + totalDraws + ' empate' + (totalDraws > 1 ? 's' : '') + ')</span>' : '') + '</div></div></div>');
      }

      if (statItems.length > 0) {
        statsHtml = '<div class="card" style="margin-top: 1rem;">' +
          '<h3 class="card-title" style="margin: 0 0 12px 0; font-size: 0.95rem;">📊 Estatísticas do Torneio</h3>' +
          '<div style="display: flex; flex-wrap: wrap; gap: 10px;">' + statItems.join('') + '</div></div>';
      }
    }
  }

  // ── Head-to-head matrix ───────────────────────────────────────────────────
  let h2hHtml = '';
  if (currentRound >= 1) {
    standingsSections.forEach(function(sec) {
      var catLabel = sec.label;
      var computed = typeof window._computeStandings === 'function'
        ? window._computeStandings(t, catLabel || undefined)
        : [];
      if (computed.length < 2 || computed.length > 20) return; // skip if too few or too many players

      var names = computed.map(function(s) { return s.name; });
      // Build result map: h2h[playerA][playerB] = { wins, draws, losses, results[] }
      var h2h = {};
      names.forEach(function(n) { h2h[n] = {}; names.forEach(function(m) { h2h[n][m] = { w: 0, d: 0, l: 0 }; }); });

      (t.rounds || []).forEach(function(rd) {
        (rd.matches || []).forEach(function(m) {
          if (!m.winner || !m.p1 || !m.p2) return;
          if (m.p1 === 'BYE' || m.p2 === 'BYE' || m.p1 === 'TBD' || m.p2 === 'TBD') return;
          // Only count players in this category's standings
          if (!h2h[m.p1] || !h2h[m.p1][m.p2]) return;
          var isDraw = m.winner === 'draw' || m.draw;
          if (isDraw) {
            h2h[m.p1][m.p2].d++;
            h2h[m.p2][m.p1].d++;
          } else if (m.winner === m.p1) {
            h2h[m.p1][m.p2].w++;
            h2h[m.p2][m.p1].l++;
          } else if (m.winner === m.p2) {
            h2h[m.p2][m.p1].w++;
            h2h[m.p1][m.p2].l++;
          }
        });
      });

      // Build table
      var displayLabel = catLabel && window._displayCategoryName ? window._displayCategoryName(catLabel) : catLabel;
      var title = displayLabel ? 'Confrontos Diretos — ' + displayLabel : 'Confrontos Diretos';

      var thCells = '<th style="padding:6px 4px;font-size:0.6rem;color:var(--text-muted);text-align:center;min-width:28px;"></th>';
      names.forEach(function(n, i) {
        var shortName = n.length > 8 ? n.substring(0, 7) + '…' : n;
        thCells += '<th style="padding:6px 4px;font-size:0.6rem;color:var(--text-muted);text-align:center;min-width:28px;writing-mode:vertical-lr;transform:rotate(180deg);height:60px;" title="' + (window._safeHtml ? window._safeHtml(n) : n) + '">' + (window._safeHtml ? window._safeHtml(shortName) : shortName) + '</th>';
      });

      var rows = '';
      names.forEach(function(rowName, ri) {
        var shortRow = rowName.length > 12 ? rowName.substring(0, 11) + '…' : rowName;
        rows += '<tr>';
        rows += '<td style="padding:6px 8px;font-size:0.75rem;font-weight:600;color:var(--text-bright);white-space:nowrap;border-right:1px solid var(--border-color);" title="' + (window._safeHtml ? window._safeHtml(rowName) : rowName) + '">' + (window._safeHtml ? window._safeHtml(shortRow) : shortRow) + '</td>';
        names.forEach(function(colName, ci) {
          if (ri === ci) {
            rows += '<td style="padding:4px;text-align:center;background:rgba(255,255,255,0.03);font-size:0.7rem;color:var(--text-muted);">—</td>';
          } else {
            var rec = h2h[rowName][colName];
            var total = rec.w + rec.d + rec.l;
            if (total === 0) {
              rows += '<td style="padding:4px;text-align:center;font-size:0.7rem;color:var(--text-muted);opacity:0.3;">·</td>';
            } else {
              var bg = rec.w > rec.l ? 'rgba(16,185,129,0.15)' : (rec.l > rec.w ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)');
              var color = rec.w > rec.l ? '#4ade80' : (rec.l > rec.w ? '#f87171' : '#94a3b8');
              var label = rec.w + 'V';
              if (rec.d > 0) label += ' ' + rec.d + 'E';
              label += ' ' + rec.l + 'D';
              rows += '<td style="padding:4px;text-align:center;font-size:0.65rem;font-weight:600;background:' + bg + ';color:' + color + ';" title="' + (window._safeHtml ? window._safeHtml(rowName) : rowName) + ' vs ' + (window._safeHtml ? window._safeHtml(colName) : colName) + ': ' + label + '">' + rec.w + '-' + rec.d + '-' + rec.l + '</td>';
            }
          }
        });
        rows += '</tr>';
      });

      h2hHtml += '<div class="card" style="margin-top: 1rem;">' +
        '<details>' +
        '<summary style="cursor:pointer;font-weight:700;font-size:1rem;color:var(--text-bright);padding:4px 0;user-select:none;">⚔️ ' + title + '</summary>' +
        '<div style="margin-top:12px;overflow-x:auto;">' +
        '<table style="border-collapse:collapse;width:auto;min-width:100%;">' +
        '<thead><tr style="border-bottom:1px solid var(--border-color);">' + thCells + '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '<div style="margin-top:8px;font-size:0.65rem;color:var(--text-muted);">Formato: V-E-D (Vitórias-Empates-Derrotas). <span style="color:#4ade80;">Verde</span> = vantagem, <span style="color:#f87171;">vermelho</span> = desvantagem.</div>' +
        '</div></details></div>';
    });
  }

  return standingsTablesHtml + currentRoundHtml + statsHtml + h2hHtml + previousRoundsHtml;
}

// ─── Compute standings ────────────────────────────────────────────────────────
