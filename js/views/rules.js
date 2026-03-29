function renderRules(container, tournamentId) {
  const tId = tournamentId || window._lastActiveTournamentId;
  const t = tId && window.AppStore ? window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString()) : null;

  if (!t) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding: 3rem;">
        <h3 style="color: var(--text-bright);">Torneio não encontrado</h3>
        <p class="text-muted">Selecione um torneio para ver suas regras.</p>
        <a href="#dashboard" class="btn btn-primary" style="margin-top:1rem; display:inline-block;">Dashboard</a>
      </div>`;
    return;
  }

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      const datePart = d.includes('T') ? d.split('T')[0] : d;
      const timePart = d.includes('T') ? d.split('T')[1] : '';
      const [y, m, dd] = datePart.split('-');
      let result = dd + '/' + m + '/' + y;
      if (timePart) result += ' ' + timePart.substring(0, 5);
      return result;
    } catch (e) { return d; }
  };

  const resultEntryLabel = {
    organizer: 'Apenas o Organizador',
    players: 'Pelos próprios jogadores (com aceite do adversário)',
    referee: 'Árbitro designado pelo organizador'
  }[t.resultEntry || 'organizer'];

  const enrollmentLabel = {
    individual: 'Individual',
    time: 'Apenas Times',
    misto: 'Misto (Individual e Times)'
  }[t.enrollmentMode || 'individual'];

  const formatInfo = () => {
    const f = t.format || 'Eliminatórias Simples';
    let extra = '';
    if (f === 'Suíço Clássico') extra = `<span style="color:var(--text-muted);"> — ${t.swissRounds || 5} rodadas</span>`;
    if (f === 'Liga') {
      const per = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', custom: 'Definida pelo organizador' }[t.ligaPeriodicity] || '—';
      extra = `<span style="color:var(--text-muted);"> — Periodicidade: ${per}</span>`;
    }
    return f + extra;
  };

  const tiebreakersHtml = (t.tiebreakers && t.tiebreakers.length)
    ? t.tiebreakers.map((tb, i) => `<li style="padding:4px 0; color:var(--text-muted);">${i + 1}. ${tb}</li>`).join('')
    : `<li style="color:var(--text-muted);">Não configurados</li>`;

  const categoriesText = (t.categories && t.categories.length) ? t.categories.join(', ') : 'Categoria Única';

  const historyHtml = (t.history && t.history.length)
    ? [...t.history].reverse().slice(0, 20).map((log, i) => {
        const date = log.date ? new Date(log.date).toLocaleString('pt-BR') : '—';
        const isFirst = i === (Math.min(t.history.length, 20) - 1);
        return `
          <div style="display:flex;gap:12px;margin-bottom:1.25rem;position:relative;">
            <div style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:${isFirst ? 'var(--text-muted)' : 'var(--primary-color)'};margin-top:5px;"></div>
            <div>
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-bright);">${date}</div>
              <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">${log.message || log.action || '—'}</div>
            </div>
          </div>`;
      }).join('')
    : `<p style="color:var(--text-muted);font-size:0.85rem;">Nenhuma ação registrada ainda.</p>`;

  const isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);

  container.innerHTML = `
    <div class="mb-4">
      <button class="btn btn-sm hover-lift" style="background:rgba(255,255,255,0.05);color:var(--text-bright);border:1px solid rgba(255,255,255,0.1);display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-weight:500;"
        onclick="window.location.hash='#tournaments/${t.id}'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>
    </div>

    <div class="d-flex justify-between align-center mb-4" style="flex-wrap:wrap;gap:1rem;">
      <div>
        <h2 style="margin:0;">Regras e Transparência</h2>
        <p class="text-muted" style="margin:4px 0 0;">Todas as decisões do organizador, visíveis a todos os participantes.</p>
      </div>
      <span class="badge badge-info" style="font-size:0.85rem;padding:6px 14px;">${t.name}</span>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem;" class="rules-grid">

      <!-- Regras Atuais -->
      <div class="card">
        <h3 class="card-title mb-3">Parâmetros Atuais do Torneio</h3>

        <ul style="list-style:none;padding:0;margin:0;">
          ${[
            ['Formato', formatInfo()],
            ['Modalidade', (t.sport ? t.sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '') || '—'],
            ['Categorias', categoriesText],
            ['Modo de Inscrição', enrollmentLabel],
            ['Máx. Participantes', t.maxParticipants ? t.maxParticipants + ' participantes' : 'Sem limite'],
            ['Inscrições até', formatDate(t.registrationLimit)],
            ['Início', formatDate(t.startDate)],
            ['Fim', formatDate(t.endDate)],
            ['Visibilidade', t.isPublic ? 'Público' : 'Privado'],
            ['Lançamento de Resultado', resultEntryLabel],
          ].map(([label, value]) => `
            <li style="padding:0.85rem 0;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
              <span style="color:var(--text-muted);font-size:0.9rem;">${label}</span>
              <span style="font-weight:600;color:var(--text-bright);font-size:0.9rem;text-align:right;">${value}</span>
            </li>`).join('')}

          ${(t.format === 'Eliminatórias Simples' || t.format === 'Dupla Eliminatória') ? `
            <li style="padding:0.85rem 0;border-bottom:1px solid var(--border-color);">
              <div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:6px;">Disputa de 3º Lugar</div>
              <div style="font-weight:600;color:var(--text-bright);">${t.elimThirdPlace !== false ? 'Sim' : 'Não'}</div>
            </li>
            <li style="padding:0.85rem 0;border-bottom:1px solid var(--border-color);">
              <div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:6px;">Classificação Final</div>
              <div style="font-weight:600;color:var(--text-bright);">${t.elimRankingType === 'blocks' ? 'Em blocos por fase' : 'Individual (colocação específica)'}</div>
            </li>
            <li style="padding:0.85rem 0;">
              <div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:8px;">Critérios de Desempate (em ordem)</div>
              <ol style="padding-left:18px;margin:0;">${tiebreakersHtml}</ol>
            </li>` : ''}

          ${t.format === 'Liga' ? `
            <li style="padding:0.85rem 0;border-bottom:1px solid var(--border-color);">
              <span style="color:var(--text-muted);font-size:0.9rem;">Inscrições durante a temporada</span>
              <span style="font-weight:600;color:var(--text-bright);">${t.ligaOpenEnrollment !== false ? 'Abertas' : 'Fechadas após início'}</span>
            </li>
            <li style="padding:0.85rem 0;border-bottom:1px solid var(--border-color);">
              <span style="color:var(--text-muted);font-size:0.9rem;">Pontuação de novo inscrito</span>
              <span style="font-weight:600;color:var(--text-bright);">${
                { zero: 'Zero absoluto', min: 'Mínima da tabela', avg: 'Média da tabela', organizer: 'Definida pelo organizador' }[t.ligaNewPlayerScore || 'zero']
              }</span>
            </li>
            <li style="padding:0.85rem 0;">
              <span style="color:var(--text-muted);font-size:0.9rem;">Regra de inatividade</span>
              <span style="font-weight:600;color:var(--text-bright);">${
                { keep: 'Manter pontos', decay: 'Decaimento fixo por rodada', remove: `Remoção após ${t.ligaInactivityX || 3} rodadas sem jogar` }[t.ligaInactivity || 'keep']
              }</span>
            </li>` : ''}
        </ul>

        ${isOrg ? `
          <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border-color);">
            <button onclick="window.openEditTournamentModal('${t.id}')" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);color:#818cf8;padding:8px 18px;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;">
              ✏️ Editar Regras do Torneio
            </button>
          </div>` : ''}
      </div>

      <!-- Log de Transparência -->
      <div class="card">
        <h3 class="card-title mb-3">Log de Transparência</h3>
        <div style="border-left:2px solid var(--border-color);padding-left:1rem;margin-left:0.5rem;position:relative;max-height:500px;overflow-y:auto;">
          ${historyHtml}
        </div>
      </div>

    </div>

    <style>
      @media (max-width: 768px) {
        .rules-grid { grid-template-columns: 1fr !important; }
      }
    </style>
  `;
}
