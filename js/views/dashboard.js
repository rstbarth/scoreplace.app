// v0.16.93/94: handler de click no card de torneio na dashboard. Detecta
// se o click veio de dentro de um elemento que NÃO deve disparar navegação
// (ex: toggle Liga ativado/desativado, botão de inscrever, etc.) e ignora.
// Pedido do usuário: "quando clicarmos no togle ... não entre no detalhe
// do card" + "quando clicamos no togle ... mantenha tudo parado no lugar".
// Em vez de confiar em stopPropagation no toggle (que tem múltiplas camadas
// e às vezes falha em CSS toggle-switch), o handler do card próprio checa
// se event.target está dentro de um elemento "no-nav" via closest().
window._dashCardClick = function(event, tournamentId) {
  if (!event || !tournamentId) return;
  var target = event.target;
  // Se o click veio de dentro do toggle Liga, NÃO navega.
  if (target && target.closest && target.closest('[data-liga-toggle-tid]')) return;
  // Se o click veio de qualquer botão ou label/input dentro do card, NÃO navega.
  // Botões já têm stopPropagation no próprio onclick mas defesa em profundidade.
  if (target && target.closest && target.closest('button, input, label, select, textarea, a[href], [data-no-card-nav]')) return;
  window.location.hash = '#tournaments/' + tournamentId;
};

// ─── Organizer Analytics Section ────────────────────────────────────────────
window._buildAnalyticsSection = function _buildAnalyticsSection(organizados) {
  if (!window.AppStore || !window.AppStore.currentUser) return '';
  if (!organizados || organizados.length < 2) return '';
  if (window.AppStore.viewMode !== 'organizer') return '';

  var t = window._t || function(k) { return k; };
  var total = organizados.length;

  // Unique participants
  var participantSet = {};
  var totalParts = 0;
  organizados.forEach(function(tour) {
    var parts = tour.participants || [];
    parts.forEach(function(p) {
      var key = (typeof p === 'string') ? p : (p.email || p.displayName || p.uid || JSON.stringify(p));
      participantSet[key] = true;
    });
    totalParts += parts.length;
  });
  var uniqueCount = Object.keys(participantSet).length;
  var avgParts = total > 0 ? Math.round(totalParts / total) : 0;

  // By format
  var formatCounts = {};
  organizados.forEach(function(tour) {
    var f = tour.format || t('common.other');
    formatCounts[f] = (formatCounts[f] || 0) + 1;
  });

  // By sport
  var sportCounts = {};
  organizados.forEach(function(tour) {
    var s = tour.sport ? tour.sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : t('common.other');
    sportCounts[s] = (sportCounts[s] || 0) + 1;
  });

  // Best month
  var monthCounts = {};
  organizados.forEach(function(tour) {
    var d = tour.createdAt || tour.startDate;
    if (d) {
      var dt = new Date(d);
      if (!isNaN(dt.getTime())) {
        var mk = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        monthCounts[mk] = (monthCounts[mk] || 0) + 1;
      }
    }
  });
  var bestMonth = '';
  var bestMonthCount = 0;
  Object.keys(monthCounts).forEach(function(mk) {
    if (monthCounts[mk] > bestMonthCount) {
      bestMonthCount = monthCounts[mk];
      bestMonth = mk;
    }
  });
  var bestMonthLabel = bestMonth ? (function() {
    var parts = bestMonth.split('-');
    var months = t('dashboard.monthAbbrevs').split(',');
    return months[parseInt(parts[1], 10) - 1] + '/' + parts[0];
  })() : '-';

  // Bar chart helper
  function barChart(counts) {
    var max = 0;
    Object.keys(counts).forEach(function(k) { if (counts[k] > max) max = counts[k]; });
    if (max === 0) return '';
    var html = '';
    Object.keys(counts).sort(function(a,b) { return counts[b] - counts[a]; }).forEach(function(k) {
      var pct = Math.round((counts[k] / max) * 100);
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<span style="min-width:120px;font-size:0.78rem;color:var(--text-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + window._safeHtml(k) + '</span>' +
        '<div style="flex:1;height:18px;background:var(--bg-darker);border-radius:6px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:var(--primary-color);border-radius:6px;transition:width 0.3s;"></div>' +
        '</div>' +
        '<span style="min-width:24px;font-size:0.78rem;color:var(--text-bright);font-weight:600;">' + counts[k] + '</span>' +
      '</div>';
    });
    return html;
  }

  var isOpen = localStorage.getItem('scoreplace_analytics_open') === '1';

  return '<div style="margin-bottom:1rem;">' +
    '<details' + (isOpen ? ' open' : '') + ' ontoggle="localStorage.setItem(\'scoreplace_analytics_open\', this.open ? \'1\' : \'0\')">' +
    '<summary style="cursor:pointer;font-weight:700;font-size:1rem;color:var(--text-bright);padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;user-select:none;list-style:none;display:flex;align-items:center;gap:8px;">' +
      '<span style="transition:transform 0.2s;">📊</span> ' + t('analytics.title') +
    '</summary>' +
    '<div style="margin-top:8px;padding:16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;">' +
      // Stat cards row
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;">' +
        '<div class="stat-box"><div style="font-size:1.5rem;font-weight:800;color:var(--primary-color);">' + total + '</div><div style="font-size:0.78rem;color:var(--text-muted);">' + t('analytics.totalTournaments') + '</div></div>' +
        '<div class="stat-box"><div style="font-size:1.5rem;font-weight:800;color:var(--primary-color);">' + uniqueCount + '</div><div style="font-size:0.78rem;color:var(--text-muted);">' + t('analytics.uniqueParticipants') + '</div></div>' +
        '<div class="stat-box"><div style="font-size:1.5rem;font-weight:800;color:var(--primary-color);">' + avgParts + '</div><div style="font-size:0.78rem;color:var(--text-muted);">' + t('analytics.avgParticipants') + '</div></div>' +
        '<div class="stat-box"><div style="font-size:1.5rem;font-weight:800;color:var(--primary-color);">' + bestMonthLabel + '</div><div style="font-size:0.78rem;color:var(--text-muted);">' + t('analytics.bestMonth') + '</div></div>' +
      '</div>' +
      // Bar charts
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div><div style="font-size:0.82rem;font-weight:600;color:var(--text-bright);margin-bottom:8px;">' + t('analytics.byFormat') + '</div>' + barChart(formatCounts) + '</div>' +
        '<div><div style="font-size:0.82rem;font-weight:600;color:var(--text-bright);margin-bottom:8px;">' + t('analytics.bySport') + '</div>' + barChart(sportCounts) + '</div>' +
      '</div>' +
    '</div>' +
    '</details>' +
  '</div>';
};

// ─── Dashboard Enroll: direct enrollment + navigate to detail ───────────────
window._dashEnroll = function(tId) {
  // Look up tournament in both the scoped list AND the discovery feed.
  // Antes só olhava em AppStore.tournaments (scoped) — quando o usuário
  // clicava "Inscrever" num card de descoberta (torneio público que ele
  // ainda não entrou, disponível apenas em publicDiscovery), o find vinha
  // undefined e o handler caía no fallback enrollCurrentUser que TAMBÉM só
  // olha em tournaments — falha silenciosa total. Agora, se vier só do
  // discovery, hidratamos em AppStore.tournaments primeiro pra que as
  // funções downstream (enrollCurrentUser, _doEnrollCurrentUser) encontrem.
  var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
  if (!t && Array.isArray(window.AppStore.publicDiscovery)) {
    var fromDiscovery = window.AppStore.publicDiscovery.find(function(x) { return String(x.id) === String(tId); });
    if (fromDiscovery) {
      window.AppStore.tournaments.push(fromDiscovery);
      t = fromDiscovery;
    }
  }
  var user = window.AppStore.currentUser;
  if (!t || !user) { window.enrollCurrentUser(tId); return; }

  // Block enrollment if inscriptions are closed
  var _isLiga = t.format && (t.format === 'Liga' || t.format === 'Ranking' || t.format === 'liga' || t.format === 'ranking');
  var _ligaOpen = _isLiga && t.ligaOpenEnrollment;
  var _sorteio = (Array.isArray(t.matches) && t.matches.length > 0) ||
                 (Array.isArray(t.rounds) && t.rounds.length > 0) ||
                 (Array.isArray(t.groups) && t.groups.length > 0);
  var _aberto = (t.status !== 'closed' && t.status !== 'finished' && !_sorteio) || _ligaOpen;
  if (!_aberto) {
    if (typeof showAlertDialog === 'function') showAlertDialog(window._t('auth.enrollClosed'), window._t('auth.enrollClosedMsg'), null, { type: 'warning' });
    return;
  }

  // For team tournaments, skip the team modal — enroll as individual participant
  // (organizer enrolling from dashboard is always self-enrollment)
  var hasCats = (t.combinedCategories && t.combinedCategories.length > 0) ||
                (t.genderCategories && t.genderCategories.length > 0);
  if (hasCats) {
    window._resolveEnrollmentCategory(tId, function(cats) {
      if (!cats) return;
      window._doEnrollCurrentUser(tId, cats);
      window.location.hash = '#tournaments/' + tId;
    });
    return;
  }

  window._doEnrollCurrentUser(tId, null);
  window.location.hash = '#tournaments/' + tId;
};

function renderDashboard(container) {
  const visible = window.AppStore.getVisibleTournaments();

  // Filtros Básicos
  const torneiosCount = visible.length;
  const torneiosPublicos = visible.filter(t => t.isPublic).length;
  const inscricoesAbertas = visible.filter(t => {
    const sorteioRealizado = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
    const ligaAberta = (typeof window._isLigaFormat === 'function' ? window._isLigaFormat(t) : t.format === 'Liga') && t.ligaOpenEnrollment !== false && sorteioRealizado;
    return (t.status !== 'finished' && t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date())) || ligaAberta;
  }).length;


  // Filtros de Relacionamento (Dono / Participante)
  const organizados = window.AppStore.getMyOrganized();
  const participacoes = window.AppStore.getMyParticipations();
  const organizadosCount = organizados.length;
  const participacoesCount = participacoes.length;

  const sortByDate = (a, b) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const timeB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return timeA - timeB;
  };

  const participacoesSorted = [...participacoes].sort(sortByDate);
  const organizadosSorted = [...organizados].sort(sortByDate);

  // "Inscrições Abertas" = TODOS os torneios com inscrição aberta que o
  // usuário pode ver, união de:
  // (a) torneios próprios (organizados + participando) com enrollment aberto
  // (b) torneios públicos do discovery feed que o usuário ainda não entrou
  //
  // Antes mostrávamos só (b), e o usuário reportou "tem torneio com inscrição
  // aberta, público, mas esta dando 0" quando criava um torneio próprio
  // público — o count ficava zero porque o filtro só pegava do discovery
  // (que exclui torneios onde o usuário é member). A semântica do label
  // "Inscrições Abertas" não sugere "só os que você não entrou"; agora é
  // o que o usuário espera: total de torneios aceitando inscrição.
  const _isOpenEnrollment = (t) => {
    if (!t) return false;
    const _hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) ||
                     (Array.isArray(t.rounds) && t.rounds.length > 0) ||
                     (Array.isArray(t.groups) && t.groups.length > 0);
    const _ligaAberta = (typeof window._isLigaFormat === 'function'
                          ? window._isLigaFormat(t)
                          : t.format === 'Liga')
                        && t.ligaOpenEnrollment !== false
                        && _hasDraw;
    const _deadlinePassed = t.registrationLimit && new Date(t.registrationLimit) < new Date();
    return (t.status !== 'closed' && t.status !== 'finished' && !_hasDraw && !_deadlinePassed) || _ligaAberta;
  };

  const discovery = (window.AppStore && Array.isArray(window.AppStore.publicDiscovery))
    ? window.AppStore.publicDiscovery
    : [];

  // v0.16.57: helper que classifica um torneio em uma das 4 categorias do
  // discovery feed pra renderizar na ordem pedida pelo usuário:
  //   1. open       → inscrições abertas (topo)
  //   2. inProgress → já começou (sorteio realizado, !finished)
  //   3. closedNoStart → inscrições encerradas mas sem sorteio
  //   4. finished   → encerrados (sessão separada/colapsada)
  const _classifyDiscoveryTournament = (t) => {
    if (!t) return null;
    if (t.status === 'finished') return 'finished';
    const hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) ||
                    (Array.isArray(t.rounds) && t.rounds.length > 0) ||
                    (Array.isArray(t.groups) && t.groups.length > 0);
    if (hasDraw) return 'inProgress';
    const isLiga = t.format === 'Liga' || t.format === 'Ranking' || t.format === 'liga' || t.format === 'ranking';
    const ligaAcceptsEnroll = isLiga && t.ligaOpenEnrollment !== false && t.status !== 'closed';
    const deadlinePassed = t.registrationLimit && new Date(t.registrationLimit) < new Date();
    if ((t.status === 'closed' || deadlinePassed) && !ligaAcceptsEnroll) return 'closedNoStart';
    return 'open';
  };

  // (a) Torneios próprios do usuário com inscrição aberta — lista primeiro
  // porque são os mais relevantes (próprios).
  const myOpenTournaments = visible.filter(_isOpenEnrollment);
  // (b) Discovery: deduplica vs próprios e organiza nas 4 categorias.
  const myOpenIds = new Set(myOpenTournaments.map(t => String(t.id)));
  const seenInOwn = new Set([...organizados, ...participacoes].map(t => String(t.id)));
  const discoveryDedup = discovery.filter(t => !seenInOwn.has(String(t.id)) && !myOpenIds.has(String(t.id)));
  const discoveryByCategory = { open: [], inProgress: [], closedNoStart: [], finished: [] };
  discoveryDedup.forEach(t => {
    const cat = _classifyDiscoveryTournament(t);
    if (cat && discoveryByCategory[cat]) discoveryByCategory[cat].push(t);
  });
  // Ordena cada categoria por data
  Object.keys(discoveryByCategory).forEach(k => discoveryByCategory[k].sort(sortByDate));
  // Backwards-compat: discoveryOpen ainda alimenta `abertosParaVoce` que
  // outras partes do dashboard consomem.
  const discoveryOpen = discoveryByCategory.open;
  // União ordenada por data — próprios primeiro (já sortiráveis), depois
  // discovery. Mantida como única variável pra minimizar diff do resto
  // da dashboard que consome `abertosParaVoce`.
  const abertosParaVoce = [...myOpenTournaments, ...discoveryOpen].sort(sortByDate);

  const cleanSportName = (sport) => sport ? sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
  const getSportIcon = (sport) => {
    if (!sport) return '🏆';
    const s = sport.toLowerCase();
    if (s.includes('tênis de mesa') || s.includes('tenis de mesa') || s.includes('ping pong')) return '🏓';
    if (s.includes('padel')) return '🏸';
    if (s.includes('pickleball')) return window._PICKLEBALL_ICON || '🥒';
    // Futevôlei ANTES de vôlei-de-praia (contém "vôlei" como substring).
    if (s.includes('futvôlei') || s.includes('futvolei') || s.includes('futevôlei') || s.includes('futevolei')) return '⚽';
    // Só Vôlei de Praia é modalidade suportada — vôlei indoor (times de 6) fica de fora.
    if (s.includes('vôlei de praia') || s.includes('volei de praia')) return '🏐';
    // v0.17.9: Beach Tennis ANTES de tennis genérico — SVG bicolor.
    if (s.includes('beach')) return window._BEACH_TENNIS_ICON || '🟠';
    if (s.includes('tênis') || s.includes('tennis')) return '🎾';
    return '🏆';
  };

  const renderTournamentCard = (t, type) => {
    var _t = window._t || function(k) { return k; };
    const publicText = t.isPublic ? _t('tournament.public') : _t('tournament.private');

    const formatDateBr = (dStr) => {
      if (!dStr) return '';
      try {
        const datePart = dStr.includes('T') ? dStr.split('T')[0] : dStr;
        const timePart = dStr.includes('T') ? dStr.split('T')[1] : '';
        const [y, m, d] = datePart.split('-');
        if (y && m && d) {
          let result = d + '/' + m + '/' + y;
          if (timePart) result += ' ' + timePart.substring(0, 5);
          return result;
        }
      } catch (e) { }
      return dStr;
    };

    const start = formatDateBr(t.startDate);
    const end = formatDateBr(t.endDate);
    const dates = start ? (end ? `${start} ${_t('tourn.dateTo')} ${end}` : `${start}`) : _t('tourn.dateTbd');
    const regLimit = formatDateBr(t.registrationLimit);
    const cats = (t.categories && t.categories.length) ? t.categories.join(', ') : _t('tourn.singleCat');

    // Liga season auto-closure: se a temporada expirou, encerra automaticamente
    if ((typeof window._isLigaFormat === 'function' ? window._isLigaFormat(t) : t.format === 'Liga') && t.status !== 'finished') {
      const _seasonMonths = t.ligaSeasonMonths || t.rankingSeasonMonths;
      if (_seasonMonths && t.startDate) {
        const _seasonStart = new Date(t.startDate);
        if (!isNaN(_seasonStart.getTime())) {
          const _seasonEnd = new Date(_seasonStart);
          _seasonEnd.setMonth(_seasonEnd.getMonth() + parseInt(_seasonMonths));
          if (new Date() >= _seasonEnd) {
            t.status = 'finished';
            if (!t.standings || !t.standings.length) {
              if (typeof window._computeStandings === 'function') {
                var _cats = (t.combinedCategories && t.combinedCategories.length) ? t.combinedCategories : ['default'];
                for (var _ci = 0; _ci < _cats.length; _ci++) {
                  var _st = window._computeStandings(t, _cats[_ci]);
                  if (_st && _st.length) { t.standings = _st; break; }
                }
              }
            }
            if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
              window.FirestoreDB.saveTournament(t).catch(function() {});
            }
            // Notify participants of season end
            if (!t._seasonFinishNotified && typeof window._notifyTournamentParticipants === 'function') {
              t._seasonFinishNotified = true;
              var _tFnSeason = window._t || function(k) { return k; };
              window._notifyTournamentParticipants(t, {
                type: 'tournament_finished',
                message: _tFnSeason('notif.tournamentFinished').replace('{name}', t.name || 'Torneio'),
                tournamentName: t.name || '',
                level: 'important'
              });
            }
          }
        }
      }
    }

    // Inscrições fecham após sorteio (status 'active'), exceto Liga com inscrições abertas na temporada
    const isFinished = t.status === 'finished';
    const sorteioRealizado = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
    const ligaAberta = (typeof window._isLigaFormat === 'function' ? window._isLigaFormat(t) : t.format === 'Liga') && t.ligaOpenEnrollment !== false && sorteioRealizado;
    const isAberto = (!isFinished && t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date())) || ligaAberta;
    const statusText = isFinished ? _t('status.finished') : (isAberto ? _t('status.open') : (sorteioRealizado ? _t('status.active') : _t('status.closed')));
    const statusBg = isFinished ? 'rgba(251,191,36,0.15)' : (isAberto ? '#fbbf24' : (sorteioRealizado ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)'));
    const statusColor = isFinished ? '#fbbf24' : (isAberto ? '#78350f' : (sorteioRealizado ? '#34d399' : '#fca5a5'));
    const statusFontWeight = isAberto ? '700' : '600';

    let enrollmentText = _t('enroll.modeMixed');
    if (t.enrollmentMode === 'individual') enrollmentText = _t('enroll.modeIndividual');
    else if (t.enrollmentMode === 'time') enrollmentText = _t('enroll.modeTeam');
    else if (t.enrollmentMode === 'misto') enrollmentText = _t('enroll.modeMixed');

    const isOrg = window.AppStore.currentUser && t.organizerEmail === window.AppStore.currentUser.email;

    let isParticipating = false;
    if (t.participants && window.AppStore.currentUser) {
      const user = window.AppStore.currentUser;
      const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
      if (arr.length > 0) {
        isParticipating = arr.some(p => {
          if (typeof p === 'string') {
            if (p.indexOf(' / ') !== -1) return false;
            return p === user.email || p === user.displayName;
          }
          if (p.uid && user.uid && p.uid === user.uid) return true;
          if (p.email && p.email === user.email) return true;
          if (p.displayName && p.displayName === user.displayName) return true;
          return false;
        });
      }
    }

    // Card gradients adaptam ao tema via CSS variables
    var _theme = (document.documentElement.getAttribute('data-theme') || 'dark');
    var _isLight = (_theme === 'light');
    let bgGradient;
    if (_isLight) {
      bgGradient = 'linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)';
      if (isParticipating) bgGradient = 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)';
      else if (isOrg) bgGradient = 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)';
    } else if (_theme === 'sunset') {
      bgGradient = 'linear-gradient(135deg, #2d1f1b 0%, #1a1210 100%)';
      if (isParticipating) bgGradient = 'linear-gradient(135deg, #713f12 0%, #a16207 100%)';
      else if (isOrg) bgGradient = 'linear-gradient(135deg, #92400e 0%, #d97706 100%)';
    } else if (_theme === 'ocean') {
      bgGradient = 'linear-gradient(135deg, #1c3d5e 0%, #173352 100%)';
      if (isParticipating) bgGradient = 'linear-gradient(135deg, #155e75 0%, #0891b2 100%)';
      else if (isOrg) bgGradient = 'linear-gradient(135deg, #245478 0%, #0e7490 100%)';
    } else {
      bgGradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
      if (isParticipating) bgGradient = 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)';
      else if (isOrg) bgGradient = 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)';
    }

    // Card text color adapts to theme
    var _cardTextColor = _isLight ? '#1f2937' : 'white';

    // Venue photo background
    let venuePhotoBg = '';
    if (t.venuePhotoUrl) {
      var overlayGrad = isOrg
        ? 'linear-gradient(135deg, rgba(67,56,202,0.85) 0%, rgba(99,102,241,0.8) 100%)'
        : isParticipating
          ? 'linear-gradient(135deg, rgba(15,118,110,0.85) 0%, rgba(20,184,166,0.8) 100%)'
          : 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.8) 100%)';
      venuePhotoBg = 'background-image: ' + overlayGrad + ', url(' + t.venuePhotoUrl + '); background-size: cover; background-position: center;';
      _cardTextColor = 'white'; // Overlay sempre escuro, texto branco
    }

    let individualCount = 0;
    let teamCount = 0;
    // Count waitlisted participants to subtract from active count
    const _waitlistArr = Array.isArray(t.waitlist) ? t.waitlist : [];
    const _waitlistNames = new Set();
    _waitlistArr.forEach(function(w) {
      var wName = typeof w === 'string' ? w : (w.displayName || w.name || '');
      if (wName) _waitlistNames.add(wName);
    });
    const _standbyCount = _waitlistArr.length;

    if (t.participants) {
      const arr = typeof window._getCompetitors === 'function' ? window._getCompetitors(t) : (Array.isArray(t.participants) ? t.participants : Object.values(t.participants));
      arr.forEach(p => {
        // Skip waitlisted participants from the active count
        var _pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
        if (_waitlistNames.has(_pName)) return;

        if (typeof p === 'object' && p !== null && Array.isArray(p.participants)) {
          teamCount++;
          individualCount += p.participants.length;
        } else {
          const pStr = _pName;
          if (pStr.includes('/')) {
            teamCount++;
            individualCount += pStr.split('/').filter(n => n.trim().length > 0).length;
          } else {
            individualCount++;
          }
        }
      });
    }

    // Enroll/unenroll button: only when inscriptions are truly open
    // hasDraw = tournament already has matches/rounds/groups drawn
    const hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
    const canEnroll = isAberto && !isFinished && (!hasDraw || ligaAberta);
    let enrollBtnHtml = '';
    if (isParticipating && canEnroll) {
      enrollBtnHtml = `<button class="btn btn-sm btn-danger hover-lift" onclick="event.stopPropagation(); window._spinButton(this, '${_t('enroll.processing')}'); window.deenrollCurrentUser('${t.id}')">🛑 ${_t('enroll.unenrollBtn')}</button>`;
    } else if (!isParticipating && canEnroll) {
      enrollBtnHtml = `<button class="btn btn-sm btn-success hover-lift" onclick="event.stopPropagation(); window._spinButton(this, '${_t('enroll.processing')}'); window._dashEnroll('${t.id}')">✅ ${_t('enroll.enrollBtn')}</button>`;
    } else if (isParticipating && !canEnroll && !isFinished) {
      enrollBtnHtml = `<div style="font-size: 0.65rem; font-weight: 700; color: #fef08a; text-transform: uppercase; letter-spacing: 0.5px;">${_t('enroll.enrolled')} ✓</div>`;
    } else if (isFinished && (isParticipating || isOrg)) {
      enrollBtnHtml = `<div style="font-size: 0.65rem; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(251,191,36,0.12); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(251,191,36,0.25);">🏆 ${isOrg ? _t('dashboard.youOrganized') : _t('dashboard.youParticipated')}</div>`;
    }

    const _isFav = typeof window._isFavorite === 'function' && window._isFavorite(t.id);
    return `
        <div class="card mb-3" style="position: relative; overflow: hidden; ${venuePhotoBg ? venuePhotoBg : 'background: ' + bgGradient + ';'} color: ${_cardTextColor}; border: 1px solid ${_isLight ? 'rgba(0,0,0,0.08)' : 'transparent'}; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,${_isLight ? '0.06' : '0.1'}); cursor: pointer; transition: transform 0.2s;" onclick="window._dashCardClick(event, '${t.id}')" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'">
          ${isOrg ? `
             <div style="position: absolute; bottom: 6px; right: 8px; opacity: 0.9; pointer-events: none;" title="Organizador">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(251,191,36,0.95)"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>
             </div>
          ` : ''}
          <div class="card-body p-4" style="${isOrg ? 'padding-bottom: 38px;' : ''}">

            <!-- Top Row: Icon/Modality | Status (same line, consistent with detail page) -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; flex-wrap: nowrap;">
               <div style="display: flex; align-items: center; gap: 6px; opacity: 0.65; flex-shrink: 0;">
                  <span style="font-size: 1.1rem;">${getSportIcon(t.sport)}</span>
                  <span>${cleanSportName(t.sport) || _t('tournament.sport')}</span>
               </div>
               <div style="display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0;">
                  <div style="color: ${statusColor}; background: ${statusBg}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: ${statusFontWeight}; white-space: nowrap;">
                    ${statusText}
                  </div>
               </div>
            </div>
            ${enrollBtnHtml ? `<div style="display: flex; flex-direction: column; align-items: flex-end; margin-top: 6px; gap: 4px;">
               ${enrollBtnHtml}
            </div>` : ''}

            <!-- Middle Left: Nome + Logo + Favorito -->
            <div style="display: flex; align-items: center; gap: 14px; margin: 1.8rem 0 1.5rem 0;">
              ${t.logoData ? `<img src="${t.logoData}" alt="Logo" style="width: 56px; height: 56px; border-radius: 10px; object-fit: cover; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">` : ''}
              <h4 style="margin: 0; font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; text-align: left; flex: 1;">
                ${window._safeHtml(t.name)}
              </h4>
              <span data-fav-id="${t.id}" onclick="window._toggleFavorite('${t.id}', event)" title="${_isFav ? _t('fav.remove') : _t('fav.add')}" style="font-size:1.5rem;cursor:pointer;flex-shrink:0;color:${_isFav ? '#fbbf24' : 'rgba(255,255,255,0.4)'};transition:color 0.2s;line-height:1;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${_isFav ? '★' : '☆'}</span>
            </div>

            ${t.venueName ? `
            <!-- Local -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 500; opacity: 0.6; margin-top: -0.8rem;">
               <span style="font-size: 1rem;">📍</span>
               <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window._safeHtml(t.venueName)}</span>
            </div>
            ` : ''}

            <!-- Below Name: Calendário + Data + badge contextual (HOJE/AMANHÃ/Em Xd) -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; opacity: 0.8; flex-wrap: wrap;">
               <span style="font-size: 1.1rem;">🗓️</span>
               <span>${dates}</span>
               ${(() => {
                 // Badge de início — aparece em torneios ativos (nao encerrados)
                 // com startDate futura ou hoje. Reusa as i18n keys
                 // tournament.startsToday / startsTomorrow / startsIn que
                 // estavam órfãs desde alguma refatoração passada.
                 if (isFinished || !t.startDate) return '';
                 try {
                   var _s = new Date(t.startDate);
                   if (isNaN(_s.getTime())) return '';
                   // Compara só dia/mês/ano — ignora fuso pra "hoje" bater
                   // com a definição local do usuário.
                   var _today = new Date();
                   var _dayDiff = Math.round((new Date(_s.getFullYear(), _s.getMonth(), _s.getDate()) -
                                              new Date(_today.getFullYear(), _today.getMonth(), _today.getDate())) / 86400000);
                   if (_dayDiff < 0) return ''; // já começou, não mostra badge
                   if (_dayDiff > 14) return ''; // mais de 2 semanas — badge fica irrelevante
                   var _label, _bg, _color;
                   if (_dayDiff === 0) {
                     _label = _t('tournament.startsToday');
                     _bg = 'rgba(16,185,129,0.22)'; _color = '#10b981';
                   } else if (_dayDiff === 1) {
                     _label = _t('tournament.startsTomorrow');
                     _bg = 'rgba(251,191,36,0.22)'; _color = '#fbbf24';
                   } else {
                     _label = _t('tournament.startsIn').replace('{days}', _dayDiff);
                     _bg = 'rgba(99,102,241,0.2)'; _color = '#a5b4fc';
                   }
                   return '<span style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:10px;background:' + _bg + ';color:' + _color + ';border:1px solid ' + _color + '40;white-space:nowrap;">' + _label + '</span>';
                 } catch(e) { return ''; }
               })()}
            </div>

            ${(() => {
              if (isFinished) return '';
              var _now = Date.now();
              var _isLiga = window._isLigaFormat && window._isLigaFormat(t);

              // Liga: um único countdown excludente (início → próximo sorteio → fim da temporada)
              if (_isLiga) {
                var _ligaEv = null;
                // 1. Não começou → countdown para início
                if (t.startDate && !sorteioRealizado) {
                  var _sd = new Date(t.startDate).getTime();
                  if (!isNaN(_sd) && _sd > _now) _ligaEv = { ts: _sd, label: _t('tourn.ligaStart'), icon: '🏁', color: '#10b981' };
                }
                // 2. Começou + próximo sorteio → countdown para próximo sorteio
                if (!_ligaEv && !t.drawManual && t.drawFirstDate && typeof window._calcNextDrawDate === 'function') {
                  var _nd = window._calcNextDrawDate(t);
                  if (_nd) {
                    var _ndTs = _nd.getTime();
                    var _seTs = null;
                    var _sm = t.ligaSeasonMonths || t.rankingSeasonMonths;
                    if (_sm && t.startDate) {
                      var _ssd = new Date(t.startDate);
                      if (!isNaN(_ssd.getTime())) { var _se = new Date(_ssd); _se.setMonth(_se.getMonth() + parseInt(_sm)); _seTs = _se.getTime(); }
                    }
                    if (!isNaN(_ndTs) && _ndTs > _now && (!_seTs || _ndTs <= _seTs)) _ligaEv = { ts: _ndTs, label: _t('tourn.nextDraw'), icon: '🎲', color: '#fb923c' };
                  }
                }
                // 3. Sem próximo sorteio → countdown para fim da temporada
                if (!_ligaEv) {
                  var _sm2 = t.ligaSeasonMonths || t.rankingSeasonMonths;
                  if (_sm2 && t.startDate) {
                    var _ssd2 = new Date(t.startDate);
                    if (!isNaN(_ssd2.getTime())) { var _end = new Date(_ssd2); _end.setMonth(_end.getMonth() + parseInt(_sm2)); var _eTs = _end.getTime(); if (!isNaN(_eTs) && _eTs > _now) _ligaEv = { ts: _eTs, label: _t('tourn.seasonEnd'), icon: '🏁', color: '#8b5cf6' }; }
                  }
                }
                if (!_ligaEv) return '';
                var _ct = window._formatCountdown ? window._formatCountdown(_ligaEv.ts - _now) : '';
                var _cm = { '#10b981': '16,185,129', '#fb923c': '251,146,60', '#8b5cf6': '139,92,246' };
                var _rgb = _cm[_ligaEv.color] || '139,92,246';
                // v0.16.91: toggle Liga "Ativado/Desativado" alinhado à direita
                // logo acima do countdown — mesmo aspecto do card de detalhe.
                // Pedido do usuário: "o botao ativado deve aparecer de forma
                // consistente tambem no card da dashboard."
                var _ligaToggleDash = (typeof window._buildLigaActiveToggleHtml === 'function')
                  ? window._buildLigaActiveToggleHtml(t)
                  : '';
                // v0.16.92: stopPropagation no wrapper da row pra cobrir
                // cliques fora do toggle (área vazia à esquerda). Caso
                // contrário a row inteira é "área quente" do card click.
                var _toggleRowDash = _ligaToggleDash
                  ? '<div style="display:flex;justify-content:flex-end;margin-top:6px;" onclick="event.stopPropagation();">' + _ligaToggleDash + '</div>'
                  : '';
                return _toggleRowDash +
                  '<div style="margin-top:' + (_toggleRowDash ? '4px' : '10px') + ';display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(' + _rgb + ',0.1);border:1px solid rgba(' + _rgb + ',0.3);border-radius:12px;">' +
                  '<span style="font-size:1.3rem;">' + _ligaEv.icon + '</span>' +
                  '<span style="font-size:0.85rem;font-weight:700;color:' + _ligaEv.color + ';">' + _ligaEv.label + '</span>' +
                  '<span data-countdown-target="' + _ligaEv.ts + '" style="margin-left:auto;font-size:1.15rem;font-weight:900;color:' + _ligaEv.color + ';font-variant-numeric:tabular-nums;letter-spacing:0.5px;">' + _ct + '</span>' +
                '</div>';
              }

              // Não-Liga: countdown do evento mais próximo
              var _events = [];
              if (isAberto && t.registrationLimit) {
                var _rd = new Date(t.registrationLimit).getTime();
                if (!isNaN(_rd) && _rd > _now) _events.push({ ts: _rd, label: _t('event.enrollClose'), icon: '⏰', color: '#f59e0b' });
              }
              if (t.startDate) {
                var _sd2 = new Date(t.startDate).getTime();
                if (!isNaN(_sd2) && _sd2 > _now && !sorteioRealizado) _events.push({ ts: _sd2, label: _t('event.tournamentStart'), icon: '🏁', color: '#10b981' });
              }
              if (t.endDate) {
                var _ed = new Date(t.endDate).getTime();
                if (!isNaN(_ed) && _ed > _now) _events.push({ ts: _ed, label: _t('event.tournamentEnd'), icon: '🏆', color: '#8b5cf6' });
              }
              if (_events.length === 0) return '';
              _events.sort(function(a,b) { return a.ts - b.ts; });
              var _next = _events[0];
              var _countdownText = window._formatCountdown ? window._formatCountdown(_next.ts - _now) : '';
              var _rgb2 = _next.color === '#f59e0b' ? '245,158,11' : _next.color === '#10b981' ? '16,185,129' : '139,92,246';
              return '<div style="margin-top:10px;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(' + _rgb2 + ',0.1);border:1px solid rgba(' + _rgb2 + ',0.3);border-radius:12px;">' +
                '<span style="font-size:1.3rem;">' + _next.icon + '</span>' +
                '<span style="font-size:0.85rem;font-weight:700;color:' + _next.color + ';">' + _next.label + '</span>' +
                '<span data-countdown-target="' + _next.ts + '" style="margin-left:auto;font-size:1.15rem;font-weight:900;color:' + _next.color + ';font-variant-numeric:tabular-nums;letter-spacing:0.5px;">' + _countdownText + '</span>' +
              '</div>';
            })()}

            ${(() => {
              if (!sorteioRealizado || isFinished) return '';
              // Liga: não mostrar tempo decorrido (usa countdowns de próximo sorteio / fim de temporada)
              if (window._isLigaFormat && window._isLigaFormat(t)) return '';
              // Determine start time: startDate or first match/round creation
              var _startTs = 0;
              if (t.startDate) {
                _startTs = new Date(t.startDate).getTime();
              }
              if (!_startTs || isNaN(_startTs) || _startTs > Date.now()) return '';
              var _elapsedText = window._formatCountdown ? window._formatCountdown(Date.now() - _startTs) : '';
              return '<div style="margin-top:10px;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;">' +
                '<span style="font-size:1.3rem;">⏱️</span>' +
                '<span style="font-size:0.85rem;font-weight:700;color:#10b981;">' + _t('dashboard.inProgress') + '</span>' +
                '<span data-elapsed-since="' + _startTs + '" style="margin-left:auto;font-size:1.15rem;font-weight:900;color:#10b981;font-variant-numeric:tabular-nums;letter-spacing:0.5px;">' + _elapsedText + '</span>' +
              '</div>';
            })()}

            <!-- Linha separadora -->
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1.8rem 0;"></div>

            <!-- Bottom Section -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center; opacity: 0.75;">

               <!-- Stats Column -->
               <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                   <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap; align-items: flex-start;">
                       <div class="stat-box" style="flex-direction: column;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">👤</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${individualCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">${_t('dashboard.statEnrolled')}</span>
                       </div>
                       ${teamCount > 0 ? `
                       <div class="stat-box" style="flex-direction: column;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">👥</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">${_t('dashboard.statTeams')}</span>
                       </div>
                       ` : ''}
                       ${_standbyCount > 0 ? `
                       <div class="stat-box" style="flex-direction: column; border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08);">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">⏱️</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95; color: #fbbf24;">${_standbyCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8; color: #fbbf24;">${_t('dashboard.statWaiting')}</span>
                       </div>
                       ` : ''}
                   </div>
                   ${(typeof window._buildCategoryCountHtml === 'function') ? window._buildCategoryCountHtml(t) : ''}
               </div>

               <!-- Formato, Regras e Categorias -->
               <div class="info-box">
                  <div><strong>${_t('dashboard.labelFormat')}:</strong> ${t.format}</div>
                  <div><strong>${_t('dashboard.labelAccess')}:</strong> ${publicText}</div>
               </div>
            </div>

            ${(() => {
              var _html = '';
              // Progress bar for active tournaments
              if (typeof window._getTournamentProgress === 'function') {
                var _prog = window._getTournamentProgress(t);
                if (_prog.total > 0) {
                  var _barColor = _prog.pct === 100 ? '#10b981' : (_prog.pct > 50 ? '#3b82f6' : '#f59e0b');
                  _html += '<div class="info-box" style="margin-top: 10px; padding: 8px 12px;">';
                  _html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">';
                  _html += '<span style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7;">' + _t('dashboard.labelProgress') + '</span>';
                  _html += '<span style="font-size: 0.7rem; font-weight: 700;">' + _prog.pct + '%</span>';
                  _html += '</div>';
                  _html += '<div style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">';
                  _html += '<div style="width: ' + _prog.pct + '%; height: 100%; background: ' + _barColor + '; border-radius: 3px;"></div>';
                  _html += '</div></div>';
                }
              }
              // Active poll banner on card
              if (t.polls && t.polls.length > 0) {
                var _activePoll = null;
                for (var _pi = 0; _pi < t.polls.length; _pi++) {
                  var _pp = t.polls[_pi];
                  if (_pp.status === 'active' && Date.now() < _pp.deadline) { _activePoll = _pp; break; }
                }
                if (_activePoll) {
                  var _pRemaining = Math.max(0, _activePoll.deadline - Date.now());
                  var _pHrs = Math.floor(_pRemaining / 3600000);
                  var _pMins = Math.floor((_pRemaining % 3600000) / 60000);
                  var _pTimeStr = _pHrs > 0 ? _pHrs + 'h ' + _pMins + 'm' : _pMins + 'm';
                  var _pVotes = Object.keys(_activePoll.votes || {}).length;
                  var _pTotal = (t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)).length : 0);
                  var _pUser = window.AppStore.currentUser;
                  var _pUserEmail = (_pUser && _pUser.email) ? _pUser.email : '';
                  var _pHasVoted = !!(_activePoll.votes && _activePoll.votes[_pUserEmail]);
                  var _pStatusText = _pHasVoted ? '✅ ' + _t('poll.voted') : '⏳ ' + _t('poll.awaitingVote');
                  _html += '<div onclick="event.stopPropagation();window._showPollVotingDialog(\'' + t.id + '\',\'' + _activePoll.id + '\')" style="margin-top:10px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08));border:2px solid rgba(99,102,241,0.4);border-radius:20px;padding:1rem 1.25rem;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,0.1);">';
                  _html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">';
                  _html += '<div style="display:flex;align-items:center;gap:12px;">';
                  _html += '<div style="width:42px;height:42px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">🗳️</div>';
                  _html += '<div>';
                  _html += '<div style="font-weight:900;font-size:1.15rem;color:var(--text-bright);letter-spacing:0.02em;">ENQUETE</div>';
                  _html += '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:1px;">' + _pStatusText + ' · ' + _pVotes + '/' + _pTotal + ' ' + _t('dashboard.votes') + '</div>';
                  _html += '</div></div>';
                  _html += '<div style="text-align:center;background:rgba(0,0,0,0.2);padding:6px 14px;border-radius:10px;">';
                  _html += '<div style="font-size:1.4rem;font-weight:900;color:#a5b4fc;line-height:1;font-variant-numeric:tabular-nums;">' + _pTimeStr + '</div>';
                  _html += '<div style="font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">' + _t('dashboard.remaining') + '</div>';
                  _html += '</div></div>';
                  _html += '<div style="margin-top:8px;font-size:0.65rem;color:var(--text-muted);opacity:0.7;">' + _t('enroll.suspended') + '</div>';
                  _html += '</div>';
                }
              }
              return _html;
            })()}

          </div>
        </div>
      `;
  };

  // Grupo 1: torneios que o usuário organiza OU participa (sem duplicata), ordem cronológica
  const seenIds = new Set();
  const meus = [];
  [...organizadosSorted, ...participacoesSorted].forEach(t => {
    if (!seenIds.has(t.id)) {
      seenIds.add(t.id);
      meus.push(t);
    }
  });
  meus.sort(sortByDate);

  // Grupo 2: abertos para se inscrever (já excluem org e participante por definição)
  const abertos = abertosParaVoce; // já ordenado por sortByDate

  // Grupo 3: encerrados visíveis (públicos ou com participação) que não estão em meus
  const encerradosVisiveis = visible.filter(t => {
    if (t.status !== 'finished') return false;
    return !seenIds.has(t.id);
  }).sort(sortByDate);

  // Collect unique sports and locations for filter bar
  const allTournaments = [...meus, ...abertosParaVoce, ...encerradosVisiveis];
  const uniqueIds = new Set();
  const allUnique = [];
  allTournaments.forEach(t => { if (!uniqueIds.has(t.id)) { uniqueIds.add(t.id); allUnique.push(t); } });

  const sportsSet = new Set();
  const locationsSet = new Set();
  const formatsSet = new Set();
  allUnique.forEach(t => {
    if (t.sport) sportsSet.add(cleanSportName(t.sport));
    if (t.venueName) locationsSet.add(t.venueName);
    if (t.format) formatsSet.add(t.format);
  });

  const sportsArr = Array.from(sportsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const locationsArr = Array.from(locationsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const formatsArr = Array.from(formatsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  var _t = window._t || function(k) { return k; };
  const userName = (window.AppStore.currentUser && window.AppStore.currentUser.displayName) ? window.AppStore.currentUser.displayName.split(' ')[0] : _t('common.guest');
  const _userIsPro = typeof window._isPro === 'function' && window._isPro();
  const _proBadge = _userIsPro ? ' <span style="display:inline-flex;align-items:center;gap:3px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:0.55rem;font-weight:800;padding:2px 8px;border-radius:20px;vertical-align:middle;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(245,158,11,0.3);position:relative;top:-2px;">⭐ PRO</span>' : '';

  // Initialize filter state
  if (!window._dashFilter) window._dashFilter = 'todos';
  if (!window._dashSport) window._dashSport = '';
  if (!window._dashLocation) window._dashLocation = '';
  if (!window._dashFormat) window._dashFormat = '';

  // Filter function
  window._applyDashFilter = function(filter) {
    window._dashFilter = filter;
    window._dashPage = 1;
    var c = document.getElementById('view-container');
    if (c && typeof renderDashboard === 'function') renderDashboard(c);
  };
  window._applyDashSport = function(sport) {
    window._dashSport = (window._dashSport === sport) ? '' : sport;
    var c = document.getElementById('view-container');
    if (c && typeof renderDashboard === 'function') renderDashboard(c);
  };
  window._applyDashLocation = function(loc) {
    window._dashLocation = (window._dashLocation === loc) ? '' : loc;
    var c = document.getElementById('view-container');
    if (c && typeof renderDashboard === 'function') renderDashboard(c);
  };
  window._applyDashFormat = function(fmt) {
    window._dashFormat = (window._dashFormat === fmt) ? '' : fmt;
    var c = document.getElementById('view-container');
    if (c && typeof renderDashboard === 'function') renderDashboard(c);
  };
  window._setDashView = function(view) {
    window._dashView = view;
    try { localStorage.setItem('scoreplace_dashView', view); } catch(e) {}
    var c = document.getElementById('view-container');
    if (c && typeof renderDashboard === 'function') renderDashboard(c);
  };
  // v0.16.73: removidos handlers _dashForceFetchDiscovery e
  // _dashDiagnoseTournaments (v0.16.60-61) — eram acionados por botões do
  // diag inline removido junto. Discovery feed estável desde v0.16.62.
  // Restaurar pelo histórico do git se algum bug regredir.
  window._loadMoreDiscovery = function() {
    if (!window.AppStore || typeof window.AppStore.loadPublicDiscovery !== 'function') return;
    window.AppStore.loadPublicDiscovery({ append: true }).then(function() {
      var c = document.getElementById('view-container');
      if (c && typeof renderDashboard === 'function') renderDashboard(c);
    });
  };
  // Restore saved view preference
  if (!window._dashView) {
    try { window._dashView = localStorage.getItem('scoreplace_dashView') || 'cards'; } catch(e) { window._dashView = 'cards'; }
  }

  // Build upcoming matches widget for current user
  // Profile completion nudge: quando usuário tem torneios (não é fresh user
  // — esse já tem welcome card) mas faltam campos chave que destravariam
  // features. Ignorado se:
  //  - usuário nunca logou (sem cu)
  //  - já dismissou nesta sessão (sessionStorage)
  //  - allUnique vazio (fresh user já tem o welcome card — não empilha dois banners)
  //  - todos os campos importantes estão preenchidos
  // Só aparece por sessão — dismissar não some pra sempre, mas não incomoda
  // em cada navegação interna via hash.
  function _buildProfileNudgeHtml() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return '';
    if (allUnique.length === 0) return '';
    try {
      if (sessionStorage.getItem('scoreplace_profile_nudge_dismissed') === '1') return '';
    } catch (e) {}
    var missing = [];
    var hasCity = cu.city && String(cu.city).trim().length > 0;
    // v0.17.2: removido compat string-CSV pra preferredSports (auditoria
    // L3.1 — mesmo padrão de tournaments-organizer.js). auth.js sempre
    // grava como array; doc legado com string vira hasSports=false (nudge
    // reaparece, comportamento aceitável).
    var hasSports = Array.isArray(cu.preferredSports) && cu.preferredSports.length > 0;
    // Locais preferidos é OPCIONAL quando o usuário já tem city — city
    // sozinho já permite a maioria das features (torneios perto, sugestões
    // de parceiros). preferredLocations é um plus pra check-in rápido,
    // não um bloqueio. Só reclama quando user não tem nem city nem pins.
    var prefLocs = Array.isArray(cu.preferredLocations) ? cu.preferredLocations : [];
    var hasLocation = hasCity || prefLocs.length > 0;

    if (!hasCity && prefLocs.length === 0) missing.push('cidade');
    if (!hasSports) missing.push('modalidades preferidas');
    // Só pede "locais preferidos" quando já tem cidade mas nenhum pin
    // (refinamento, não requisito).  Fica de fora do nudge principal —
    // se city preenchido, a mensagem só pede sports (se faltar).
    if (missing.length === 0) return '';
    // Frase natural: "cidade, modalidades preferidas e locais preferidos"
    var missStr = missing.length === 1
      ? missing[0]
      : missing.length === 2
        ? missing[0] + ' e ' + missing[1]
        : missing.slice(0, -1).join(', ') + ' e ' + missing[missing.length - 1];
    var benefits = [];
    if (missing.indexOf('cidade') !== -1) benefits.push('notificar torneios na sua região');
    if (missing.indexOf('modalidades preferidas') !== -1) benefits.push('sugerir torneios e parceiros do seu esporte');
    var benefitsStr = benefits.slice(0, 2).join(' · '); // cap pra não ficar longo
    return '<div id="dash-profile-nudge" style="background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.04));border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:12px 14px;margin-bottom:1rem;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
        '<span style="font-size:1.4rem;flex-shrink:0;">👤</span>' +
        '<div style="flex:1;min-width:200px;">' +
          '<div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;">Complete seu perfil pra aproveitar melhor</div>' +
          '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Faltam: <b>' + missStr + '</b>. Isso permite ' + (benefitsStr || 'recursos adicionais do app') + '.</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0;">' +
          '<button class="btn btn-primary btn-sm hover-lift" onclick="if(typeof window._showProfileModal===\'function\')window._showProfileModal(); else if(typeof openModal===\'function\')openModal(\'modal-profile\');" style="white-space:nowrap;">Completar perfil</button>' +
          '<button class="btn btn-sm" onclick="window._dismissProfileNudge()" style="background:transparent;border:1px solid var(--border-color);color:var(--text-muted);font-size:0.78rem;" title="Descartar nesta sessão">✕</button>' +
        '</div>' +
      '</div>';
  }

  window._dismissProfileNudge = function() {
    try { sessionStorage.setItem('scoreplace_profile_nudge_dismissed', '1'); } catch (e) {}
    var el = document.getElementById('dash-profile-nudge');
    if (el) el.remove();
  };

  function _buildUpcomingMatchesHtml() {
    var cu = window.AppStore.currentUser;
    if (!cu || !cu.email) return '';

    var email = cu.email.toLowerCase();
    var dName = (cu.displayName || '').toLowerCase();
    var pending = [];

    function _isMe(label) {
      if (!label) return false;
      var l = label.toLowerCase();
      return l === email || (dName && l === dName) || (cu.uid && l === cu.uid);
    }

    participacoes.forEach(function(t) {
      if (t.status === 'finished') return;
      var _tFallback = window._t || function(k) { return k; };
      var tName = t.name || _tFallback('dashboard.tournamentName');
      var tId = t.id;

      // Collect pending matches (no winner yet, player is p1 or p2)
      var matchSources = (typeof window._collectAllMatches === 'function')
        ? window._collectAllMatches(t).slice()
        : [];
      if (matchSources.length === 0 && typeof window._collectAllMatches !== 'function') {
        // Defensive fallback: bracket-model.js not loaded.
        if (Array.isArray(t.matches)) matchSources = matchSources.concat(t.matches);
        if (t.thirdPlaceMatch) matchSources.push(t.thirdPlaceMatch);
        if (Array.isArray(t.rounds)) {
          t.rounds.forEach(function(r) {
            if (Array.isArray(r)) matchSources = matchSources.concat(r);
            else if (r && Array.isArray(r.matches)) matchSources = matchSources.concat(r.matches);
          });
        }
        if (Array.isArray(t.groups)) {
          t.groups.forEach(function(g) {
            if (g && Array.isArray(g.matches)) matchSources = matchSources.concat(g.matches);
            if (g && Array.isArray(g.rounds)) {
              g.rounds.forEach(function(gr) {
                if (Array.isArray(gr)) matchSources = matchSources.concat(gr);
              });
            }
          });
        }
        if (Array.isArray(t.rodadas)) {
          t.rodadas.forEach(function(r) {
            if (Array.isArray(r)) matchSources = matchSources.concat(r);
            else if (r && Array.isArray(r.matches)) matchSources = matchSources.concat(r.matches);
          });
        }
      }

      // v0.16.80: para Liga/Suíço, só consideramos matches da ÚLTIMA rodada
      // como "próximas partidas". Pedido do usuário: "na liga quando há um
      // novo sorteio, os jogos da rodada anterior que não tiverem resultado
      // registrado devem ser considerados encerrados. ... jogos que não
      // tiveram os resultaos lançados não podem constar como próximas
      // partidas do jogador." Antes, qualquer match sem winner aparecia
      // como pendente — incluindo rounds antigos abandonados (jogo nunca
      // foi disputado, novo sorteio veio sem resultado registrado). Agora
      // filtramos pela rodada mais alta encontrada (m.round máximo) entre
      // todos os matches do torneio. Outros formatos (Eliminatórias, Grupos)
      // mantêm comportamento atual — nesses todo match pendente é válido
      // até que seja resolvido.
      var isLigaFmt = (typeof window._isLigaFormat === 'function')
        ? window._isLigaFormat(t)
        : (t.format === 'Liga' || t.format === 'Ranking');
      var isSwissFmt = t.format === 'Suíço' || t.format === 'Suico';
      if (isLigaFmt || isSwissFmt) {
        var maxRound = -Infinity;
        matchSources.forEach(function(m) {
          if (m && typeof m.round === 'number' && m.round > maxRound) maxRound = m.round;
        });
        if (isFinite(maxRound)) {
          matchSources = matchSources.filter(function(m) {
            return m && m.round === maxRound;
          });
        }
      }

      // v0.16.74: extrai info rica de cada match — formato, fase, parceiro,
      // adversários, e (pra Rei/Rainha) os 4 do grupo. Antes só mostrava
      // "vs Adv" + nome do torneio. Pedido do usuário: "coloque o nome do
      // torneio que tem próximas partidas e coloque o parceiro e os
      // adversários e a fase da partida no torneio. se for rei/rainha
      // coloque isso e os sorteados junto."
      matchSources.forEach(function(m) {
        if (!m || m.winner) return; // Already has result
        if (m.p1 === 'TBD' || m.p2 === 'TBD' || m.p1 === 'BYE' || m.p2 === 'BYE') return;

        // Detecta se sou parte do match (singles, doubles slash-separated, ou monarch team).
        var isMonarchMatch = m.isMonarch && Array.isArray(m.team1) && Array.isArray(m.team2);
        var inTeam1 = false, inTeam2 = false;
        var team1Names = [], team2Names = [];
        if (isMonarchMatch) {
          team1Names = m.team1.slice();
          team2Names = m.team2.slice();
          inTeam1 = team1Names.some(_isMe);
          inTeam2 = team2Names.some(_isMe);
        } else {
          // Singles: m.p1/p2 são nomes; doubles: slash-separated.
          team1Names = String(m.p1 || '').split(/\s*\/\s*/).filter(Boolean);
          team2Names = String(m.p2 || '').split(/\s*\/\s*/).filter(Boolean);
          inTeam1 = team1Names.some(_isMe) || _isMe(m.p1);
          inTeam2 = team2Names.some(_isMe) || _isMe(m.p2);
        }
        if (!inTeam1 && !inTeam2) return;

        var myTeam = inTeam1 ? team1Names : team2Names;
        var oppTeam = inTeam1 ? team2Names : team1Names;
        // Parceiro = qualquer nome no meu time que não sou eu.
        var partner = null;
        for (var pi = 0; pi < myTeam.length; pi++) {
          if (!_isMe(myTeam[pi])) { partner = myTeam[pi]; break; }
        }

        // Format label
        var formatLabel = '';
        if (isMonarchMatch) formatLabel = 'Rei/Rainha';
        else if (t.format) formatLabel = t.format;
        // Liga com rodadas Rei/Rainha
        if (t.format === 'Liga' && t.ligaRoundFormat === 'rei_rainha' && isMonarchMatch) {
          formatLabel = 'Liga · Rei/Rainha';
        }

        // Phase label — Rei/Rainha tem m.label rico ("R1 Grupo A • Jogo 1"),
        // Liga/Suíço usa rodada, Eliminatórias deriva de m.round.
        var phaseLabel = '';
        if (m.label) {
          phaseLabel = String(m.label);
        } else if (m.roundLabel) {
          phaseLabel = String(m.roundLabel);
        } else if (m.round != null) {
          phaseLabel = 'Rodada ' + m.round;
        }

        pending.push({
          tournament: tName,
          tournamentId: tId,
          sport: t.sport || '',
          formatLabel: formatLabel,
          phaseLabel: phaseLabel,
          partner: partner,
          oppTeam: oppTeam,
          isMonarch: isMonarchMatch,
          // Pra Rei/Rainha, o "grupo" é os 4 nomes — usuário pediu pra
          // mostrar os sorteados juntos (rotação de duplas a cada jogo).
          monarchGroup: isMonarchMatch ? [].concat(team1Names, team2Names) : null
        });
      });
    });

    if (pending.length === 0) return '';

    // v0.16.75: agrupa partidas que dividem o mesmo torneio + grupo Rei/Rainha
    // (ou tournament + phase pra não-monarch). Pedido do usuário: "como sao 3
    // jogos do mesmo torneio, podemos colocar o torneio, modo rei/rainha, grupo
    // do sorteio uma unica vez e já colocar em boxes os confrontos em seguinda
    // alinhados numa unica linha." Antes cada match era um card próprio com
    // headers repetidos (3 cards iguais com "liga / Liga · Rei/Rainha · R2
    // Grupo H / 🎲 Grupo: A·B·C·D" idênticos, só mudando "Você + X vs Y + Z").
    // Agora um único card por (tournament + group/phase) com header + N linhas
    // compactas de confrontos.
    var grouped = [];
    var keyToIdx = {};
    pending.forEach(function(p) {
      var key;
      if (p.isMonarch && p.monarchGroup && p.monarchGroup.length > 0) {
        // Grupo Rei/Rainha = mesmo torneio + mesmo conjunto canônico de 4.
        key = p.tournamentId + '|monarch|' + p.monarchGroup.slice().sort().join(',');
      } else {
        // Não-monarch: agrupa por torneio + fase (mesma rodada de Liga/Suíço).
        key = p.tournamentId + '|single|' + (p.phaseLabel || '');
      }
      if (keyToIdx[key] == null) {
        keyToIdx[key] = grouped.length;
        // v0.16.82: guarda referência ao tournament real pra computar
        // standings ao renderizar (Liga/Suíço) sem precisar buscar de novo.
        var tRef = participacoes.find(function(tt) { return tt.id === p.tournamentId; });
        grouped.push({
          tournament: p.tournament, tournamentId: p.tournamentId, sport: p.sport,
          formatLabel: p.formatLabel, phaseLabel: p.phaseLabel,
          isMonarch: p.isMonarch, monarchGroup: p.monarchGroup,
          matches: [],
          tRef: tRef
        });
      }
      grouped[keyToIdx[key]].matches.push({
        partner: p.partner, oppTeam: p.oppTeam, phaseLabel: p.phaseLabel
      });
      // v0.16.76: pra Liga com sorteio automático, guarda referência ao
      // próximo draw scheduled — countdown vai pro header do card.
      if (!grouped[keyToIdx[key]].nextDrawAt) {
        var tFull = grouped[keyToIdx[key]].tRef;
        if (tFull && tFull.format === 'Liga' && !tFull.drawManual && tFull.drawFirstDate &&
            typeof window._calcNextDrawDate === 'function') {
          var nd = window._calcNextDrawDate(tFull);
          if (nd) grouped[keyToIdx[key]].nextDrawAt = nd.getTime();
        }
      }
    });

    var maxShowGroups = Math.min(grouped.length, 5);
    var html = '<div style="margin-bottom:1.25rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px 16px;">';
    var _t2 = window._t || function(k) { return k; };
    var _safe = window._safeHtml || function(s) { return String(s || ''); };
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:1.1rem;">⚔️</span><span style="font-size:0.9rem;font-weight:700;color:var(--text-bright);">' + _t2('dashboard.nextMatches') + '</span><span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto;">' + pending.length + '</span></div>';

    for (var gi = 0; gi < maxShowGroups; gi++) {
      var g = grouped[gi];
      var safeTourney = _safe(g.tournament);
      // Pra Rei/Rainha, descasca "• Jogo N" do phaseLabel pro header (deixa
      // só "R2 Grupo H"); pra não-monarch, mantém o phaseLabel inteiro.
      var headerPhase = g.phaseLabel;
      if (g.isMonarch && headerPhase) {
        headerPhase = headerPhase.replace(/\s*[•·]\s*Jogo\s*\d+.*/i, '');
      }
      var fmtPhase = [];
      if (g.formatLabel) fmtPhase.push(_safe(g.formatLabel));
      if (headerPhase) fmtPhase.push(_safe(headerPhase));
      var fmtPhaseLine = fmtPhase.length > 0
        ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fmtPhase.join(' · ') + '</div>'
        : '';
      // v0.16.76: dice line "🎲 Grupo: ..." removida — usuário pediu pra
      // limpar a duplicação ("já tem a informação abaixo" — os 4 nomes
      // aparecem nos confrontos Jogo 1/2/3 logo abaixo).
      var monarchLine = '';
      // v0.16.76/77: countdown pro próximo sorteio em Liga com auto-draw —
      // INCLUI segundos via tick global em store.js. Pedido do usuário: "a
      // contagem regressiva deve conter os segundos tambem". span tem
      // data-countdown-target=timestamp; setInterval(1s) em store.js
      // re-renderiza textContent via window._formatCountdown — formato
      // "3d 2h 15m 30s" / "18h 30m 15s" / "45m 22s" / "30s".
      var ligaCountdownLine = '';
      if (g.nextDrawAt) {
        var diffMs = g.nextDrawAt - Date.now();
        var urgent = diffMs > 0 && diffMs < 24 * 3600 * 1000;
        var color = urgent ? '#fbbf24' : '#a5b4fc';
        var bg = urgent ? 'rgba(251,191,36,0.12)' : 'rgba(99,102,241,0.12)';
        var border = urgent ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)';
        var initialText = (typeof window._formatCountdown === 'function' && diffMs > 0)
          ? window._formatCountdown(diffMs)
          : (diffMs <= 0 ? 'Agora!' : '...');
        // v0.16.90: toggle Liga "Ativado/Desativado" agora aparece numa
        // linha própria acima do countdown, alinhado à direita (mesmo
        // aspecto dos cards de torneio). Em widget compacto não há linha
        // "Atualizado em" pra encostar — toggle solo na borda direita.
        var _ligaToggleWidget = (g.tRef && typeof window._buildLigaActiveToggleHtml === 'function')
          ? window._buildLigaActiveToggleHtml(g.tRef)
          : '';
        // v0.16.92: stopPropagation na row do toggle (mesmo padrão da
        // dashboard card) — clique no toggle não dispara navegação pra
        // detalhe via card click handler.
        var _toggleRow = _ligaToggleWidget
          ? '<div style="display:flex;justify-content:flex-end;margin-top:6px;" onclick="event.stopPropagation();">' + _ligaToggleWidget + '</div>'
          : '';
        ligaCountdownLine = _toggleRow +
          '<div style="display:inline-flex;align-items:center;gap:6px;font-size:0.7rem;font-weight:600;color:' + color + ';background:' + bg + ';border:1px solid ' + border + ';border-radius:999px;padding:2px 10px;margin-top:6px;">⏱️ próximo sorteio em <span data-countdown-target="' + g.nextDrawAt + '">' + initialText + '</span></div>';
      }
      // Linhas de confronto — uma por match no grupo
      var matchLines = '';
      g.matches.forEach(function(m, mi) {
        var meLbl = m.partner ? 'Você + ' + _safe(m.partner) : 'Você';
        var oppLbl = (m.oppTeam || []).map(_safe).join(' + ');
        // Pra monarch, extrai "Jogo N" do phaseLabel da própria match (cada
        // match no grupo tem phaseLabel diferente: "R2 Grupo H • Jogo 1/2/3").
        var jogoBadge = '';
        if (g.isMonarch && m.phaseLabel) {
          var jm = m.phaseLabel.match(/Jogo\s*(\d+)/i);
          if (jm) jogoBadge = '<span style="display:inline-block;font-size:0.66rem;font-weight:700;color:#a5b4fc;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:6px;padding:1px 7px;margin-right:8px;flex-shrink:0;">Jogo ' + jm[1] + '</span>';
        }
        // Box compacto numa linha — Você+Partner vs Adv+Adv
        matchLines += '<div style="display:flex;align-items:center;font-size:0.78rem;padding:5px 0;' + (mi > 0 ? 'border-top:1px dashed rgba(255,255,255,0.06);' : '') + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          jogoBadge +
          '<span style="color:var(--text-color);overflow:hidden;text-overflow:ellipsis;">' +
            meLbl + ' <span style="opacity:0.5;font-weight:400;margin:0 4px;">vs</span> <span style="color:var(--text-muted);">' + oppLbl + '</span>' +
          '</span>' +
        '</div>';
      });
      // v0.16.84: classificação removida do widget — fica APENAS na tela de
      // detalhe do torneio. Pedido do usuário: "a classificação geral da liga
      // deve aparecer apenas no detalhe da liga e não na dashboard". Mantém
      // dashboard enxuta (foco em "o que vou jogar agora") e o detalhe é o
      // home da informação completa de standings.
      html += '<div onclick="window.location.hash=\'#tournaments/' + g.tournamentId + '\'" style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:8px;cursor:pointer;transition:background 0.15s;' + (gi > 0 ? 'border-top:1px solid var(--border-color);margin-top:6px;padding-top:14px;' : '') + '" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">';
      html += '<span style="font-size:1.1rem;line-height:1.2;flex-shrink:0;margin-top:1px;">' + getSportIcon(g.sport) + '</span>';
      html += '<div style="flex:1;min-width:0;overflow:hidden;">';
      html +=   '<div style="font-size:0.86rem;font-weight:700;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeTourney + '</div>';
      html +=   fmtPhaseLine;
      html +=   ligaCountdownLine;
      html +=   '<div style="margin-top:8px;display:flex;flex-direction:column;">' + matchLines + '</div>';
      html += '</div>';
      html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.5;margin-top:3px;"><path d="M9 18l6-6-6-6"/></svg>';
      html += '</div>';
    }
    if (grouped.length > maxShowGroups) {
      html += '<div style="text-align:center;font-size:0.7rem;color:var(--text-muted);padding:4px 0;">' + _t2('dashboard.andMore', {count: grouped.length - maxShowGroups}) + '</div>';
    }
    html += '</div>';
    return html;
  }

  const curFilter = window._dashFilter || 'todos';
  const curSport = window._dashSport || '';
  const curLocation = window._dashLocation || '';
  const curFormat = window._dashFormat || '';

  // Favorites count
  const favIds = typeof window._getFavorites === 'function' ? window._getFavorites() : [];
  const favoritosCount = allUnique.filter(t => favIds.indexOf(String(t.id)) !== -1).length;

  // Count finished tournaments
  const encerradosCount = allUnique.filter(t => t.status === 'finished').length;

  // Apply main filter
  let filtered = [];
  if (curFilter === 'organizados') filtered = [...organizadosSorted];
  else if (curFilter === 'participando') filtered = [...participacoesSorted];
  else if (curFilter === 'abertos') filtered = [...abertosParaVoce];
  else if (curFilter === 'favoritos') {
    const seen = new Set();
    [...organizadosSorted, ...participacoesSorted, ...abertosParaVoce].forEach(t => {
      if (!seen.has(t.id) && favIds.indexOf(String(t.id)) !== -1) { seen.add(t.id); filtered.push(t); }
    });
    filtered.sort(sortByDate);
  } else if (curFilter === 'encerrados') {
    const seen = new Set();
    [...organizadosSorted, ...participacoesSorted, ...abertosParaVoce, ...encerradosVisiveis].forEach(t => {
      if (!seen.has(t.id) && t.status === 'finished') { seen.add(t.id); filtered.push(t); }
    });
    filtered.sort(sortByDate);
  } else {
    const seen = new Set();
    [...organizadosSorted, ...participacoesSorted, ...abertosParaVoce, ...encerradosVisiveis].forEach(t => {
      if (!seen.has(t.id)) { seen.add(t.id); filtered.push(t); }
    });
    filtered.sort(sortByDate);
  }

  // Apply secondary filters
  if (curSport) filtered = filtered.filter(t => cleanSportName(t.sport) === curSport);
  if (curLocation) filtered = filtered.filter(t => t.venueName === curLocation);
  if (curFormat) filtered = filtered.filter(t => t.format === curFormat);

  // Pagination — show N items initially, with "load more" button
  const PAGE_SIZE = 12;
  const pageNum = window._dashPage || 1;
  const totalFiltered = filtered.length;

  // Separate active and finished when showing "Todos"
  let filteredHtml = '';
  if (curFilter === 'todos' && !curSport && !curLocation && !curFormat && encerradosCount > 0) {
    const activeList = filtered.filter(t => t.status !== 'finished');
    const finishedList = filtered.filter(t => t.status === 'finished');
    const visibleActive = activeList.slice(0, pageNum * PAGE_SIZE);
    filteredHtml = visibleActive.length > 0
      ? visibleActive.map(t => renderTournamentCard(t, '')).join('')
      : '<div style="text-align:center;padding:1rem;color:var(--text-muted);opacity:0.6;">' + _t('tournament.emptyState') + '</div>';
    if (activeList.length > visibleActive.length) {
      filteredHtml += '<div style="grid-column:1/-1;text-align:center;padding:1rem;"><button onclick="window._dashPage=(window._dashPage||1)+1;var c=document.getElementById(\'view-container\');if(c&&typeof renderDashboard===\'function\')renderDashboard(c);" class="btn hover-lift" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:10px 28px;font-weight:600;font-size:0.85rem;cursor:pointer;">' + _t('dashboard.loadMore', {count: activeList.length - visibleActive.length}) + '</button></div>';
    }
    if (finishedList.length > 0) {
      // Separate: user's finished tournaments first, then others
      var _cu = window.AppStore.currentUser;
      var myFinished = finishedList.filter(function(t) {
        if (!_cu) return false;
        if (t.organizerEmail === _cu.email) return true;
        var pArr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
        return pArr.some(function(p) {
          if (typeof p === 'string') return p === _cu.email || p === _cu.displayName;
          if (p.uid && _cu.uid && p.uid === _cu.uid) return true;
          if (p.email && p.email === _cu.email) return true;
          if (p.displayName && p.displayName === _cu.displayName) return true;
          return false;
        });
      });
      var otherFinished = finishedList.filter(function(t) { return myFinished.indexOf(t) === -1; });
      var finishedCards = '';
      if (myFinished.length > 0) {
        finishedCards += '<div style="font-size:0.78rem;font-weight:700;color:var(--text-bright);margin-bottom:8px;opacity:0.85;">🏆 ' + _t('dashboard.yourFinished', {count: myFinished.length}) + '</div>';
        finishedCards += '<div class="cards-grid" style="margin-bottom:1rem;">' + myFinished.map(t => renderTournamentCard(t, '')).join('') + '</div>';
      }
      if (otherFinished.length > 0) {
        if (myFinished.length > 0) finishedCards += '<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;opacity:0.7;">' + _t('dashboard.otherFinished', {count: otherFinished.length}) + '</div>';
        finishedCards += '<div class="cards-grid">' + otherFinished.map(t => renderTournamentCard(t, '')).join('') + '</div>';
      }
      filteredHtml += '<div style="grid-column:1/-1;margin-top:0.5rem;"><details><summary style="cursor:pointer;font-weight:700;font-size:0.9rem;color:var(--text-muted);padding:8px 0;user-select:none;">' + _t('dashboard.finishedSection', {count: finishedList.length}) + '</summary><div style="margin-top:0.75rem;">' + finishedCards + '</div></details></div>';
    }
  } else {
    // When viewing "encerrados" filter, sort user's tournaments first
    var _sortedFiltered = filtered;
    if (curFilter === 'encerrados' && window.AppStore.currentUser) {
      var _cu2 = window.AppStore.currentUser;
      var _isMine = function(t) {
        if (t.organizerEmail === _cu2.email) return true;
        var pArr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
        return pArr.some(function(p) {
          if (typeof p === 'string') return p === _cu2.email || p === _cu2.displayName;
          if (p.uid && _cu2.uid && p.uid === _cu2.uid) return true;
          if (p.email && p.email === _cu2.email) return true;
          if (p.displayName && p.displayName === _cu2.displayName) return true;
          return false;
        });
      };
      var _myEnc = filtered.filter(_isMine);
      var _otherEnc = filtered.filter(function(t) { return !_isMine(t); });
      _sortedFiltered = _myEnc.concat(_otherEnc);
    }
    const visibleItems = _sortedFiltered.slice(0, pageNum * PAGE_SIZE);
    // Empty state: dois níveis de experiência dependendo do contexto.
    // (a) Usuário novo sem nenhum torneio em lugar nenhum (allUnique zero),
    //     sem filtros aplicados → card welcome rico com CTAs; é o primeiro
    //     vislumbre da plataforma e merece algo mais que "Nenhum torneio
    //     encontrado". (b) Filtros ativos ou busca retornando nada → mensagem
    //     neutra (a antiga) porque o usuário sabe por que tá vazio.
    var _isFreshUser = allUnique.length === 0 && !curSport && !curLocation && !curFormat &&
                       (curFilter === 'todos' || !curFilter);
    if (visibleItems.length > 0) {
      filteredHtml = visibleItems.map(t => renderTournamentCard(t, '')).join('');
    } else if (_isFreshUser) {
      filteredHtml =
        '<div style="grid-column:1/-1;background:linear-gradient(135deg, rgba(99,102,241,0.1), rgba(59,130,246,0.08));border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:2rem 1.5rem;text-align:center;">' +
          '<div style="font-size:2.5rem;margin-bottom:8px;">🏆</div>' +
          '<div style="font-size:1.15rem;font-weight:800;color:var(--text-bright);margin-bottom:6px;">Seja bem-vindo ao scoreplace!</div>' +
          '<div style="font-size:0.88rem;color:var(--text-muted);max-width:520px;margin:0 auto 1.25rem auto;line-height:1.5;">Aqui você organiza torneios, joga partidas casuais com placar ao vivo, descobre quadras próximas e marca presença, e acompanha seus amigos. Comece por um dos caminhos abaixo:</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:600px;margin:0 auto;">' +
            '<button class="btn hover-lift" onclick="if(typeof window._openCasualMatch===\'function\')window._openCasualMatch()" style="background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#fff;border:none;font-weight:700;padding:10px 18px;font-size:0.85rem;border-radius:10px;">⚡ Partida Casual</button>' +
            '<button class="btn hover-lift" onclick="if(typeof openModal===\'function\')openModal(\'modal-quick-create\')" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;font-weight:700;padding:10px 18px;font-size:0.85rem;border-radius:10px;">🏆 Criar torneio</button>' +
            '<button class="btn hover-lift" title="Procure lugares para seus jogos e marque presença" onclick="window.location.hash=\'#place\'" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#1a0f00;border:none;font-weight:800;padding:10px 18px;font-size:0.85rem;border-radius:10px;">📍 Place</button>' +
            '<button class="btn hover-lift" onclick="window.location.hash=\'#explore\'" style="background:rgba(99,102,241,0.2);color:#a5b4fc;border:1px solid rgba(99,102,241,0.4);font-weight:700;padding:10px 18px;font-size:0.85rem;border-radius:10px;">👥 Encontrar amigos</button>' +
          '</div>' +
          '<div style="margin-top:1.25rem;font-size:0.78rem;color:var(--text-muted);">Dica: se já existe um torneio público na sua cidade, ele vai aparecer aqui automaticamente.</div>' +
        '</div>';
    } else {
      filteredHtml = '<div style="text-align:center;padding:2rem;color:var(--text-muted);opacity:0.6;">' + _t('tournament.emptyState') + '</div>';
    }
    if (_sortedFiltered.length > visibleItems.length) {
      filteredHtml += '<div style="grid-column:1/-1;text-align:center;padding:1rem;"><button onclick="window._dashPage=(window._dashPage||1)+1;var c=document.getElementById(\'view-container\');if(c&&typeof renderDashboard===\'function\')renderDashboard(c);" class="btn hover-lift" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:10px 28px;font-weight:600;font-size:0.85rem;cursor:pointer;">' + _t('dashboard.loadMore', {count: _sortedFiltered.length - visibleItems.length}) + '</button></div>';
    } else if (curFilter === 'abertos' && window.AppStore && window.AppStore._publicDiscoveryHasMore) {
      // When viewing the public discovery feed and the client has rendered
      // everything loaded, offer to fetch the next server page via cursor.
      filteredHtml += '<div style="grid-column:1/-1;text-align:center;padding:1rem;"><button onclick="window._loadMoreDiscovery()" class="btn hover-lift" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:10px 28px;font-weight:600;font-size:0.85rem;cursor:pointer;">🔍 ' + _t('dashboard.discoverMore') + '</button></div>';
    }
  }

  // Build filter pills for sports
  let sportsPills = sportsArr.map(s => {
    const active = curSport === s;
    return `<button onclick="window._applyDashSport('${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1px solid ${active ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'};color:${active ? '#a5b4fc' : 'var(--text-muted)'};font-size:0.75rem;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;transition:all 0.2s;"><span>${getSportIcon(s)}</span>${s}</button>`;
  }).join('');

  // Build filter pills for locations
  let locationPills = locationsArr.map(l => {
    const active = curLocation === l;
    return `<button onclick="window._applyDashLocation('${l.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1px solid ${active ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'};background:${active ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'};color:${active ? '#4ade80' : 'var(--text-muted)'};font-size:0.75rem;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;transition:all 0.2s;">📍${l}</button>`;
  }).join('');

  // Build filter pills for formats
  let formatPills = formatsArr.map(f => {
    const active = curFormat === f;
    return `<button onclick="window._applyDashFormat('${f.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1px solid ${active ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'};background:${active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)'};color:${active ? '#fbbf24' : 'var(--text-muted)'};font-size:0.75rem;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;transition:all 0.2s;">🏅${f}</button>`;
  }).join('');

  const hasSecondaryFilters = sportsArr.length > 0 || locationsArr.length > 0 || formatsArr.length > 0;
  const filterBarHtml = hasSecondaryFilters ? `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.2rem;align-items:center;">
      ${sportsPills}${locationPills}${formatPills}
      ${(curSport || curLocation || curFormat) ? `<button class="btn btn-micro btn-pill" onclick="window._dashSport='';window._dashLocation='';window._dashFormat='';window._applyDashFilter(window._dashFilter||'todos')" style="background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.3);">${_t('dashboard.clearFilters')}</button>` : ''}
    </div>
  ` : '';

  // Build compact list view
  const _buildCompactList = function(items) {
    if (!items || items.length === 0) return '<div style="text-align:center;padding:2rem;color:var(--text-muted);opacity:0.6;">' + _t('tournament.emptyState') + '</div>';
    return '<div class="compact-list-container" style="display:flex;flex-direction:column;gap:2px;">' + items.map(function(t) {
      var isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);
      var statusText = '', statusColor = '';
      var isFinished = t.status === 'finished' || t.status === 'closed';
      var hasDraw = (t.matches && t.matches.length) || (t.rounds && t.rounds.length) || (t.groups && t.groups.length);
      if (isFinished) { statusText = _t('status.finished'); statusColor = '#94a3b8'; }
      else if (hasDraw) { statusText = _t('status.active'); statusColor = '#4ade80'; }
      else { statusText = _t('status.open'); statusColor = '#60a5fa'; }
      var pCount = typeof window._getCompetitors === 'function' ? window._getCompetitors(t).length : (Array.isArray(t.participants) ? t.participants.length : 0);
      var prog = typeof window._getTournamentProgress === 'function' ? window._getTournamentProgress(t) : { pct: 0 };
      var dateStr = '';
      if (t.startDate) { try { dateStr = new Date(t.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); } catch(e) {} }
      var isFav = typeof window._isFavorite === 'function' && window._isFavorite(t.id);

      var _lt = (document.documentElement.getAttribute('data-theme') === 'light');
      var _rowBg = _lt ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)';
      var _rowBgH = _lt ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)';
      var _rowBd = _lt ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
      var statusBadgeBgRgb = statusColor === '#4ade80' ? '16,185,129' : statusColor === '#60a5fa' ? '96,165,250' : '148,163,184';
      return '<a href="#tournaments/' + t.id + '" class="compact-row" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:' + _rowBg + ';border:1px solid ' + _rowBd + ';text-decoration:none;color:inherit;transition:background 0.2s;" onmouseover="this.style.background=\'' + _rowBgH + '\'" onmouseout="this.style.background=\'' + _rowBg + '\'">' +
        (t.logoData ? '<img src="' + t.logoData + '" class="compact-logo" style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0;">' : '<div class="compact-logo" style="width:36px;height:36px;border-radius:8px;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">' + (getSportIcon(t.sport)) + '</div>') +
        '<div class="compact-info" style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;">' +
          '<div class="compact-name-block" style="flex:1;min-width:0;">' +
            '<div style="font-weight:600;font-size:0.88rem;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (isFav ? '★ ' : '') + window._safeHtml(t.name) + '</div>' +
            '<div class="compact-details" style="font-size:0.7rem;color:var(--text-muted);display:flex;gap:8px;margin-top:2px;flex-wrap:wrap;">' +
              '<span>' + (t.sport || '—') + '</span>' +
              '<span>' + (t.format || '—') + '</span>' +
              (dateStr ? '<span>' + dateStr + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="compact-badges" style="display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
            '<span style="font-size:0.7rem;color:var(--text-muted);">👥 ' + pCount + '</span>' +
            (hasDraw && !isFinished ? '<span style="font-size:0.7rem;color:' + (prog.pct === 100 ? '#10b981' : '#f59e0b') + ';">' + prog.pct + '%</span>' : '') +
            '<span style="font-size:0.68rem;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(' + statusBadgeBgRgb + ',0.15);color:' + statusColor + ';white-space:nowrap;">' + statusText + '</span>' +
            (isOrg ? '<span style="font-size:0.65rem;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,0.15);color:#fbbf24;">' + _t('auth.orgShort') + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</a>';
    }).join('') + '</div>';
  };

  // Main filter card styles
  const _fStyle = (key, emoji, count, label) => {
    const active = curFilter === key;
    return `<div style="background:${active ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'};backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:1.5rem 1rem;border-radius:16px;border:${active ? '2px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.08)'};cursor:pointer;transition:transform 0.2s,box-shadow 0.2s,border 0.2s;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;${active ? 'box-shadow:0 0 20px rgba(255,255,255,0.1);transform:translateY(-2px);' : ''}" onclick="window._applyDashFilter('${key}')" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='${active ? 'translateY(-2px)' : 'none'}';this.style.boxShadow='${active ? '0 0 20px rgba(255,255,255,0.1)' : 'none'}'">
      <div style="font-size:2rem;margin-bottom:0.25rem;">${emoji}</div>
      <span style="font-size:2.5rem;font-weight:700;line-height:1;">${count}</span>
      <h3 style="margin:0.5rem 0 0 0;font-size:1rem;font-weight:600;opacity:0.9;">${label}</h3>
    </div>`;
  };

  const html = `
    <!-- Header Hero Box -->
    <div class="mb-4 hero-box" style="
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        border-radius: 24px;
        padding: 2.5rem 2rem;
        color: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        filter: saturate(0.9) brightness(0.95);
        position: relative;
    ">

      <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 10px; text-align: left;">
        <h2 style="margin:0; font-size: 2.2rem; font-weight: 700; flex:1;">${_t('dashboard.welcome', {name: userName})}${_proBadge}</h2>
        ${window.AppStore.currentUser ? '<button onclick="if(typeof window._showPlayerStats===\'function\')window._showPlayerStats(\'' + window._safeHtml((window.AppStore.currentUser.displayName || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")) + '\')" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:12px;padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:5px;color:#fff;font-size:0.78rem;font-weight:600;white-space:nowrap;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'"><span style="font-size:1rem;">📊</span> ' + _t('dashboard.statistics') + '</button>' : ''}
      </div>
      <div style="text-align:center;margin-bottom:8px;font-size:0.75rem;color:rgba(255,255,255,1);font-weight:600;letter-spacing:0.5px;">v${window.SCOREPLACE_VERSION || ''}</div>

      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;width:100%;max-width:580px;">
          <button class="btn btn-cta hover-lift" id="btn-casual-match" style="background:linear-gradient(135deg,#38bdf8,#0ea5e9); color: #ffffff; flex:1;min-width:0; min-height: 64px; font-size: 0.9rem; font-weight: 700; border-radius: 14px; border: 1px solid rgba(255,255,255,0.35); letter-spacing: 0.02em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 6px;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''" onclick="if(typeof window._openCasualMatch==='function')window._openCasualMatch();">
            <span style="font-size:1.4rem;line-height:1;">⚡</span>
            <span>${_t('dashboard.casualMatch')}</span>
          </button>
          <button class="btn btn-cta hover-lift" id="btn-create-tournament-in-box" style="background: #1e40af; color: #ffffff; flex:1;min-width:0; min-height: 64px; font-size: 0.9rem; font-weight: 700; border-radius: 14px; border: 1px solid rgba(255,255,255,0.35); letter-spacing: 0.02em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 6px;" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='#1e40af'" onclick="if(typeof openModal==='function')openModal('modal-quick-create');">
            <span style="font-size:1.4rem;line-height:1;">🏆</span>
            <span>${_t('dashboard.newTournament')}</span>
          </button>
          <button class="btn btn-cta hover-lift" id="btn-place" title="Procure lugares para seus jogos e marque presença" style="background:linear-gradient(135deg,#f59e0b,#d97706); color: #1a0f00; flex:1;min-width:0; min-height: 64px; font-size: 0.9rem; font-weight: 800; border-radius: 14px; border: 1px solid rgba(255,255,255,0.35); letter-spacing: 0.02em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 6px;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''" onclick="window.location.hash='#place'">
            <span style="font-size:1.4rem;line-height:1;">📍</span>
            <span>Place</span>
          </button>
        </div>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button id="btn-invite-app" class="btn hover-lift" title="${_t('invite.appQrTitle')}" style="background: #7c3aed; color: #fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.82rem; padding: 0 16px; height: 38px; border-radius: 10px;" onclick="window.location.hash='#invite'">📱 ${_t('invite.inviteFriends')}</button>
          <button id="btn-upgrade-pro" class="btn hover-lift" title="${_t('common.pro')}" style="display: none; background: linear-gradient(135deg,#3b82f6,#6366f1); color: #fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.82rem; padding: 0 16px; height: 38px; border-radius: 10px;" onclick="window._showUpgradeModal()">🚀 ${_t('common.pro')}</button>
          <button id="btn-support-pix" class="btn hover-lift" title="${_t('common.support')}" style="background: #047857; color: #fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.82rem; padding: 0 16px; height: 38px; border-radius: 10px;" onclick="window.location.hash='#support'">💚 ${_t('common.support')}</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
        ${_fStyle('todos', '📋', allUnique.length, _t('dashboard.filterAll'))}
        ${_fStyle('organizados', '🏆', organizadosCount, _t('dashboard.filterOrganized'))}
        ${_fStyle('participando', '👤', participacoesCount, _t('dashboard.filterParticipating'))}
        ${_fStyle('abertos', '🗓️', abertosParaVoce.length, _t('dashboard.filterOpen'))}
        ${favoritosCount > 0 ? _fStyle('favoritos', '⭐', favoritosCount, _t('dashboard.filterFavorites')) : ''}
        ${encerradosCount > 0 ? _fStyle('encerrados', '🏆', encerradosCount, _t('dashboard.filterFinished')) : ''}
      </div>
    </div>

    <!-- Filter Bar (organizer analytics moved into hero 📊 Estatísticas modal in v0.14.32) -->
    ${filterBarHtml}

    <!-- Profile Completion Nudge (dismissible, smart — only when key fields missing) -->
    ${_buildProfileNudgeHtml()}

    <!-- Upcoming Matches -->
    ${_buildUpcomingMatchesHtml()}

    <!-- My Active Presence (loaded async — pill at top when user has a check-in/plan live) -->
    <div id="dashboard-myactive-widget" style="margin-bottom:1rem;"></div>

    <!-- Friends' Presences (loaded async) -->
    <div id="dashboard-presences-widget" style="margin-bottom:1.25rem;"></div>

    <!-- View Toggle + Tournament Cards -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:0.75rem;">
      <div style="display:inline-flex;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
        <button class="btn btn-pill btn-sm" onclick="window._setDashView('cards')" style="background:${(window._dashView||'cards')==='cards'?'rgba(99,102,241,0.25)':'rgba(255,255,255,0.04)'};color:${(window._dashView||'cards')==='cards'?'#a5b4fc':'var(--text-muted)'};border:none;" title="${_t('dashboard.cards')}">▦ ${_t('dashboard.cards')}</button>
        <button class="btn btn-pill btn-sm" onclick="window._setDashView('compact')" style="border-left:1px solid rgba(255,255,255,0.1);background:${window._dashView==='compact'?'rgba(99,102,241,0.25)':'rgba(255,255,255,0.04)'};color:${window._dashView==='compact'?'#a5b4fc':'var(--text-muted)'};border-radius:0;" title="${_t('dashboard.compact')}">☰ ${_t('dashboard.compact')}</button>
      </div>
    </div>
    <div class="dashboard-list" style="margin-bottom: 2rem;">
      ${(window._dashView === 'compact') ? '<div class="compact-list">' + _buildCompactList(filtered) + '</div>' : '<div class="cards-grid">' + filteredHtml + '</div>'}
    </div>
    ${(() => {
      // v0.16.60: diag SEMPRE visível, independente de filtro — usuário
      // reportou "nelson ainda nao ve torneio algum" mas o diag da v0.16.59
      // ficava escondido se tivesse filtro ativo. Agora o diag sempre
      // aparece; apenas as 3 seções extras (em andamento, fechadas-sem-início,
      // encerrados) ficam restritas ao filtro 'todos'.
      var _curFilter = window._dashFilter || 'todos';
      var _showExtraSections = (_curFilter === 'todos' && !curSport && !curLocation && !curFormat);
      var _cuPref = window.AppStore && window.AppStore.currentUser;
      var _prefSports = (_cuPref && Array.isArray(_cuPref.preferredSports))
        ? _cuPref.preferredSports.map(function(s) { return cleanSportName(s); }).filter(Boolean)
        : (typeof (_cuPref && _cuPref.preferredSports) === 'string' && _cuPref.preferredSports.trim()
            ? _cuPref.preferredSports.split(/[,;]/).map(function(s) { return cleanSportName(s); }).filter(Boolean)
            : []);
      var _filterByInterest = function(arr) {
        if (!_prefSports.length) return arr;
        return arr.filter(function(t) {
          if (!t.sport) return true; // torneio sem modalidade declarada não é filtrado
          var tsClean = cleanSportName(t.sport).toLowerCase();
          return _prefSports.some(function(p) { return p.toLowerCase() === tsClean; });
        });
      };
      var _inProgress = _filterByInterest(discoveryByCategory.inProgress);
      var _closedNoStart = _filterByInterest(discoveryByCategory.closedNoStart);
      var _finishedDiscovery = _filterByInterest(discoveryByCategory.finished);
      // v0.16.73: removido o bloco de diag inline da v0.16.59-61 (renderer
      // version, FirestoreDB.db disponível, contagens por categoria, botões
      // "Forçar re-fetch" / "Diagnose banco"). Discovery feed estável desde
      // v0.16.62 (fix do orderBy que excluía docs sem createdAt). Manter o
      // diag em produção poluía a UI sem propósito ativo. Pode ser
      // restaurado pelo histórico do git se algum bug regredir.
      if (!_showExtraSections) return '';
      if (_inProgress.length === 0 && _closedNoStart.length === 0 && _finishedDiscovery.length === 0) return '';
      var _interestNote = _prefSports.length
        ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.5rem;">Filtrado pelas suas modalidades favoritas: ' + _prefSports.map(function(s) { return window._safeHtml(s); }).join(', ') + '</div>'
        : '';
      var _section = function(title, items, color, collapsed) {
        if (!items || items.length === 0) return '';
        var _cards = '<div class="cards-grid">' + items.map(function(t) { return renderTournamentCard(t, ''); }).join('') + '</div>';
        if (collapsed) {
          return '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-weight:700;font-size:0.92rem;color:' + color + ';padding:8px 0;user-select:none;">' + title + ' (' + items.length + ')</summary><div style="margin-top:0.75rem;">' + _cards + '</div></details>';
        }
        return '<div style="margin-top:1.25rem;"><div style="font-weight:800;font-size:0.95rem;color:' + color + ';margin-bottom:0.5rem;border-left:3px solid ' + color + ';padding-left:10px;">' + title + ' <span style="font-weight:500;color:var(--text-muted);font-size:0.78rem;">(' + items.length + ')</span></div>' + _cards + '</div>';
      };
      return '<div style="margin-top:0.5rem;">' +
        _interestNote +
        _section('🎮 Em andamento (públicos)', _inProgress, '#10b981', false) +
        _section('🚪 Inscrições encerradas (aguardando início)', _closedNoStart, '#fb923c', false) +
        _section('🏁 Encerrados (públicos)', _finishedDiscovery, '#94a3b8', true) +
      '</div>';
    })()}
  `;
  container.innerHTML = html;

  // Show/hide Pro button based on plan (element is now inside hero box)
  var proBtn = document.getElementById('btn-upgrade-pro');
  if (proBtn) {
    var isPro = typeof window._isPro === 'function' && window._isPro();
    proBtn.style.display = isPro ? 'none' : 'inline-flex';
  }

  // ─── Friends' presences widget (async load) ───
  _hydrateMyActivePresenceWidget();
  _hydrateFriendsPresenceWidget();

  // v0.16.60: re-fetch do discovery feed sempre que renderiza dashboard.
  // Throttle de 15s (bem mais agressivo que v0.16.59 que era 30s) E ignora
  // throttle quando publicDiscovery está vazio (force fetch quando tem
  // motivo claro pra estar vazio — Nelson não vê NADA).
  if (window.AppStore && typeof window.AppStore.loadPublicDiscovery === 'function') {
    var _curLen = (window.AppStore.publicDiscovery || []).length;
    var _lastFetch = window.AppStore._publicDiscoveryLastFetch || 0;
    var _force = _curLen === 0; // sem dados = sempre re-fetch, sem throttle
    if (_force || Date.now() - _lastFetch > 15000) {
      window.AppStore._publicDiscoveryLastFetch = Date.now();
      console.log('[Discovery v0.16.60] re-fetch disparado', { curLen: _curLen, force: _force, msSinceLast: Date.now() - _lastFetch });
      window.AppStore.loadPublicDiscovery().then(function() {
        var newLen = (window.AppStore.publicDiscovery || []).length;
        console.log('[Discovery v0.16.60] re-fetch retornou', { newLen: newLen, oldLen: _curLen });
        // Re-render se ainda estamos no dashboard E o count mudou.
        if (window.location.hash === '' || window.location.hash === '#' || window.location.hash.indexOf('#dashboard') === 0) {
          if (newLen !== _curLen) {
            var c = document.getElementById('view-container');
            if (c && typeof renderDashboard === 'function') renderDashboard(c);
          }
        }
      }).catch(function(e) {
        console.error('[Discovery v0.16.60] re-fetch FAILED', e);
        window._lastDiscoveryError = String(e && e.message || e);
      });
    }
  }

  // v0.17.4: real-time listeners SUBSTITUEM o polling de 60s. Pedido do
  // usuário: "sempre que um amigo fizer alguma alteração nesse estado isso
  // deve imediatamente refletir para ele e para seus amigos. isso precisa
  // ocorrer independente do usuário ter que dar refresh na pagina."
  // onSnapshot do Firestore dispara em qualquer write — ms de latência,
  // não 60s. Cleanup quando dashboard sai do DOM.
  _setupPresenceListeners();
  // v0.17.4: também escuta profile-loaded pra cobrir a race onde o user
  // chega no dashboard antes do profile carregar (cu.friends undefined).
  // Quando profile chega, re-setup garante listeners com friends list correto.
  if (!window._dashProfileLoadedHandlerInstalled) {
    window._dashProfileLoadedHandlerInstalled = true;
    document.addEventListener('scoreplace:profile-loaded', function() {
      var box = document.getElementById('dashboard-presences-widget');
      if (!box) return;
      _setupPresenceListeners(true); // force re-setup with new friends list
      _hydrateFriendsPresenceWidget();
    });
  }

  // ─── Pending invite detection: auto-redirect to tournament with pending co-org or participation invite ───
  _checkPendingInvitesAndRedirect(visible);
}

// v0.17.4: real-time listeners. Mantém listener vivo enquanto o dashboard
// está no DOM. Cada snapshot do Firestore (write de qualquer pessoa que
// afeta minha visão — eu mesmo ou amigos) re-hidrata o widget. Substitui
// o setInterval de 60s — agora propagação é em ms.
function _setupPresenceListeners(forceReset) {
  var cu = window.AppStore && window.AppStore.currentUser;
  if (!cu || !cu.uid || !window.PresenceDB) return;
  if (cu.presenceMuteUntil && Number(cu.presenceMuteUntil) > Date.now()) return;

  // Já tem listener ativo pro mesmo uid + friends? Skip (idempotente).
  // Quando forceReset=true (ex: profile-loaded com friends novos), tira
  // os listeners antigos antes.
  var friends = Array.isArray(cu.friends)
    ? cu.friends.filter(function(u) { return u && u !== cu.uid && u.indexOf('@') === -1; })
    : [];
  var sig = cu.uid + '|' + friends.slice().sort().join(',');
  if (window._dashListenerSig === sig && !forceReset) return;
  if (window._dashListenerCleanup) {
    try { window._dashListenerCleanup(); } catch (e) {}
    window._dashListenerCleanup = null;
  }

  var ownUnsub = window.PresenceDB.listenMyActive(cu.uid, function(list) {
    var box = document.getElementById('dashboard-presences-widget');
    if (!box) {
      // Dashboard saiu — cleanup automático
      _teardownPresenceListeners();
      return;
    }
    if (!window._dashPresenceCache) window._dashPresenceCache = { own: [], friends: [], ts: 0 };
    window._dashPresenceCache.own = list;
    window._dashPresenceCache.ts = Date.now();
    _hydrateFriendsPresenceWidget();
  });

  var friendsUnsub = function() {};
  if (friends.length > 0) {
    friendsUnsub = window.PresenceDB.listenForFriends(friends, function(list) {
      var box = document.getElementById('dashboard-presences-widget');
      if (!box) { _teardownPresenceListeners(); return; }
      // filtra eu mesmo (defesa contra auto-amizade)
      var filtered = list.filter(function(p) { return p && p.uid !== cu.uid && p.placeId; });
      if (!window._dashPresenceCache) window._dashPresenceCache = { own: [], friends: [], ts: 0 };
      window._dashPresenceCache.friends = filtered;
      window._dashPresenceCache.ts = Date.now();
      _hydrateFriendsPresenceWidget();
    });
  }

  window._dashListenerSig = sig;
  window._dashListenerCleanup = function() {
    try { ownUnsub(); } catch (e) {}
    try { friendsUnsub(); } catch (e) {}
  };
}

function _teardownPresenceListeners() {
  if (window._dashListenerCleanup) {
    try { window._dashListenerCleanup(); } catch (e) {}
    window._dashListenerCleanup = null;
    window._dashListenerSig = null;
  }
}
window._teardownPresenceListeners = _teardownPresenceListeners;

// Load the user's OWN active presences (check-in ativo ou plan no futuro)
// e renderiza um pill status no topo da dashboard. Antes, o usuário fazia
// "Estou aqui" e ao voltar pra dashboard não tinha feedback visual do
// próprio check-in — agora aparece "📍 Você está em [Local] · expira em Xh"
// com botão "Cancelar". Pra plans mostra "🗓️ Você planejou em [Local]
// às HH:mm". Silent quando não há presença ativa (não polui a UI).
function _hydrateMyActivePresenceWidget() {
  var box = document.getElementById('dashboard-myactive-widget');
  if (!box || !window.AppStore) return;
  var cu = window.AppStore.currentUser;
  if (!cu || !cu.uid) return;
  var _safe = window._safeHtml || function(s) { return String(s || ''); };

  // v0.16.78: UNIFICAÇÃO. Antes este widget mostrava pills separados pra
  // check-in/plano + empty CTA — duplicando info que o widget Movimento já
  // mostra (chip "Você" no venue card + ✕ inline). Resultado: usuário via
  // "Sua presença" pill vazia EM CIMA de "Movimento nos seus locais"
  // também vazio = duas seções de presença mostrando a mesma coisa.
  // Agora este widget mostra APENAS a sala casual em andamento (conceito
  // separado, não mostrado em nenhum outro lugar). Toda presença
  // (plano/checkin) consolidada no widget Movimento com seu CTA único.
  if (cu.activeCasualRoom) {
    var safeRoom = String(cu.activeCasualRoom).replace(/\\/g, '\\\\').replace(/\'/g, "\\'");
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(135deg,rgba(56,189,248,0.15),rgba(14,165,233,0.06));border:1px solid rgba(56,189,248,0.35);border-radius:12px;flex-wrap:wrap;">' +
        '<span style="font-size:1.2rem;flex-shrink:0;">⚡</span>' +
        '<div style="flex:1;min-width:150px;">' +
          '<div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;">Partida casual em andamento</div>' +
          '<div style="font-size:0.72rem;color:var(--text-muted);">Sala <b style="color:#38bdf8;font-family:monospace;letter-spacing:1px;">' + _safe(cu.activeCasualRoom) + '</b> · continue de onde parou</div>' +
        '</div>' +
        '<button onclick="window.location.hash=\'#casual/' + safeRoom + '\'" style="background:linear-gradient(135deg,#38bdf8,#0ea5e9);border:none;color:#fff;border-radius:8px;padding:6px 14px;font-size:0.78rem;font-weight:700;cursor:pointer;">⚡ Voltar</button>' +
      '</div>';
  } else {
    box.innerHTML = '';
  }
}

// Handler pro botão Cancelar do status de presença. Marca localmente pra
// evitar double-call e delega pro PresenceDB.cancelPresence. Re-renderiza
// o widget após sucesso.
window._dashCancelPresence = function(docId) {
  if (!docId || !window.PresenceDB) return;
  if (!confirm('Cancelar sua presença?')) return;
  window.PresenceDB.cancelPresence(docId).then(function() {
    if (typeof showNotification === 'function') showNotification('Presença cancelada.', '', 'info');
    _hydrateMyActivePresenceWidget();
  }).catch(function(e) {
    console.warn('Cancel presence failed:', e);
    if (typeof showNotification === 'function') showNotification('Erro ao cancelar.', '', 'error');
  });
};

// Load friends' active or upcoming presences and render a compact widget.
// Clicking a row pre-fills the presence view with the same venue+sport.
function _hydrateFriendsPresenceWidget() {
  var box = document.getElementById('dashboard-presences-widget');
  if (!box || !window.PresenceDB || !window.AppStore) return;
  var cu = window.AppStore.currentUser;
  if (!cu || !cu.uid) return;
  // Muted = don't fetch anyone's presences, consistent with Perfil → Presença.
  var muteUntil = Number(cu.presenceMuteUntil || 0);
  if (muteUntil > Date.now()) return;
  // Filtra o próprio uid do array de amigos como defesa contra auto-amizade
  // (dado corrompido via migração ou bug). Sem isso, o usuário veria a
  // própria presença APARECER TANTO no widget "Sua presença ativa" quanto
  // no widget "Amigos no local" — duplicidade confusa.
  // v0.16.43: também filtra entries com '@' (emails antigos não migrados pra
  // uid). Antes da v0.x.x todo amigo era salvo por email; uma migração roda
  // em login (auth.js:999) mas só atualiza o doc do *outro* lado quando o
  // OUTRO usuário faz login. Se o amigo nunca relogou, o array do usuário
  // atual ainda tem email — e `where('uid', 'in', emails)` no loadForFriends
  // nunca casa, fazendo o widget render "Nenhum amigo registrou presença".
  var friendsRaw = Array.isArray(cu.friends) ? cu.friends.filter(function(u) { return u && u !== cu.uid; }) : [];
  var friendsLikeUid = friendsRaw.filter(function(u) { return typeof u === 'string' && u.indexOf('@') === -1; });
  var friendsLikeEmail = friendsRaw.filter(function(u) { return typeof u === 'string' && u.indexOf('@') !== -1; });
  console.log('[FriendsWidget v0.16.43]', {
    uid: cu.uid,
    friendsRawCount: friendsRaw.length,
    friendsRaw: friendsRaw,
    friendsLikeUidCount: friendsLikeUid.length,
    friendsLikeEmailCount: friendsLikeEmail.length,
    friendsLikeEmail: friendsLikeEmail
  });
  var friends = friendsLikeUid;

  // v0.16.43: tenta resolver emails antigos → uid via query Firestore.
  // Faz best-effort: pra cada email no array friends, busca em users where
  // email_lower == email; se acha, adiciona o uid em `friends` E também
  // grava a migração no perfil do usuário (arrayUnion uid + arrayRemove email)
  // pra não precisar refazer a query toda vez.
  if (friendsLikeEmail.length > 0 && window.FirestoreDB && window.FirestoreDB.db) {
    var resolvePromises = friendsLikeEmail.map(function(em) {
      var emLower = String(em).toLowerCase();
      return window.FirestoreDB.db.collection('users').where('email_lower', '==', emLower).limit(1).get()
        .then(function(snap) {
          if (snap.empty) {
            // Fallback: alguns docs antigos usam 'email' em vez de 'email_lower'
            return window.FirestoreDB.db.collection('users').where('email', '==', em).limit(1).get();
          }
          return snap;
        })
        .then(function(snap) {
          if (snap.empty) {
            console.warn('[FriendsWidget] email não resolvido pra uid:', em);
            return null;
          }
          var doc = snap.docs[0];
          var resolvedUid = doc.id;
          console.log('[FriendsWidget] email resolvido:', em, '→', resolvedUid);
          // Persiste a migração no doc do usuário atual
          try {
            var FV = firebase.firestore.FieldValue;
            window.FirestoreDB.db.collection('users').doc(cu.uid).update({
              friends: FV.arrayUnion(resolvedUid)
            }).then(function() {
              return window.FirestoreDB.db.collection('users').doc(cu.uid).update({
                friends: FV.arrayRemove(em)
              });
            }).catch(function(e) { console.warn('[FriendsWidget] migrate persist falhou:', e); });
          } catch (e) {}
          return resolvedUid;
        })
        .catch(function(e) { console.warn('[FriendsWidget] resolve query falhou pra', em, e); return null; });
    });
    Promise.all(resolvePromises).then(function(resolved) {
      var added = resolved.filter(function(u) { return u && friends.indexOf(u) === -1; });
      if (added.length > 0) {
        console.log('[FriendsWidget] re-querying com uids resolvidos:', added);
        // Atualiza cache local também
        if (Array.isArray(cu.friends)) {
          added.forEach(function(u) { if (cu.friends.indexOf(u) === -1) cu.friends.push(u); });
        }
        // Re-dispara a hidratação com a lista completa — o caminho normal
        // abaixo já vai pegar (friends agora tem os uids resolvidos).
        setTimeout(_hydrateFriendsPresenceWidget, 100);
      }
    });
  }
  // v0.16.73: removido o diag block (DIAG_VERSION/SELF_PROBE_SLOT/_diagLine/
  // _diagBlock/_runSelfProbe) introduzido nas v0.16.43-64. Cumpriu a missão
  // (debug iterativo de email→uid migration, query empty, self-presence
  // rendering, dedup de venues) e a feature estabilizou. Diag em produção
  // poluía a UI sem propósito ativo. Caminhos de empty state agora são
  // limpos — só copy + CTA. Restaurar pelo histórico do git se regredir.

  // v0.16.77: SEMPRE carrega o próprio plano do user, INDEPENDENTE de ter
  // amigos ou de eles ainda estarem em formato email. Bug crítico anterior
  // (até v0.16.76): early-return em friendsRaw=0 OU friends=0 escondia o
  // plano do user. Nelson sem amigos cadastrados que planejava Paineiras
  // não via NADA na seção Movimento. Agora o fetch único cobre os 3 cenários
  // (friendsRaw=0, friends=email, friends ok) e renderiza o card do venue
  // do user em qualquer caso onde ele tem plano.
  // v0.16.77: fetch UNIFICADO compartilhado entre os dois widgets de
  // presença (Sua presença + Movimento). Antes cada um chamava loadMyActive
  // separadamente — duas idas ao Firestore, sem garantia de consistência
  // entre eles. Agora window._dashPresenceCache guarda o resultado e ambos
  // re-usam. Refresh invalida o cache.
  var fetchOwn = (window.PresenceDB && typeof window.PresenceDB.loadMyActive === 'function')
    ? window.PresenceDB.loadMyActive(cu.uid).catch(function() { return []; })
    : Promise.resolve([]);
  var fetchFriends = (friends.length > 0 && window.PresenceDB && typeof window.PresenceDB.loadForFriends === 'function')
    ? window.PresenceDB.loadForFriends(friends).catch(function() { return []; })
    : Promise.resolve([]);
  Promise.all([fetchFriends, fetchOwn]).then(function(results) {
    var friendsList = (results[0] || []).filter(function(p) { return p && p.uid !== cu.uid && p.placeId; });
    var ownList = (results[1] || []).filter(function(p) { return p && p.placeId; });
    // Cache compartilhado pra outros consumidores (myactive widget) re-usarem.
    window._dashPresenceCache = { own: ownList, friends: friendsList, ts: Date.now() };
    var list = friendsList.concat(ownList);
    if (list.length === 0) {
      // Empty state diferenciado: sem amigos vs sem movimento.
      var hasFriends = friendsRaw.length > 0;
      var msgTitle = hasFriends
        ? 'Nenhum movimento nos seus locais hoje'
        : '👥 Veja seus amigos jogando';
      var msgSub = hasFriends
        ? 'Quando você ou um amigo marcar "Estou aqui" ou planejar ida, aparece aqui.'
        : 'Adicione amigos na Explorar pra acompanhar presenças nos locais que vocês frequentam.';
      var ctaText = hasFriends ? 'Minha presença →' : 'Encontrar amigos →';
      var ctaHref = hasFriends ? '#place' : '#explore';
      var bg = hasFriends ? 'var(--bg-card)' : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.08))';
      var border = hasFriends ? 'var(--border-color)' : 'rgba(99,102,241,0.25)';
      box.innerHTML =
        '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:14px;padding:12px 14px;">' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
            (hasFriends ? '<span style="font-size:1.1rem;opacity:0.65;">👥</span>' : '') +
            '<div style="flex:1;min-width:200px;">' +
              '<div style="font-size:' + (hasFriends ? '0.82rem' : '0.92rem') + ';color:var(--text-bright);font-weight:' + (hasFriends ? '600' : '700') + ';">' + msgTitle + '</div>' +
              '<div style="font-size:' + (hasFriends ? '0.72rem' : '0.78rem') + ';color:var(--text-muted);margin-top:2px;">' + msgSub + '</div>' +
            '</div>' +
            '<a href="' + ctaHref + '" style="font-size:0.78rem;color:var(--primary-color);text-decoration:none;font-weight:600;white-space:nowrap;">' + ctaText + '</a>' +
          '</div>' +
        '</div>';
      return;
    }

    // v0.16.48: ao invés de cards flat por amigo (com bug "·undefined" porque
    // p.sport não existe — schema tem sports[] array), renderiza UM CARD POR
    // VENUE com o trio "Agora no local" + "Próximas horas" + gráfico horário,
    // mesmo padrão usado no #place. Reusa os helpers de venues.js via
    // window._venuesHydrateAllPreferredMovement (que itera todos os
    // [data-pref-pid] no DOM e hidrata os 3 slots de cada um).
    // v0.16.63: dedup por NOME canônico do venue, não placeId. Usuário
    // reportou widget mostrando "Clube Paineiras do Morumby" duas vezes
    // (uma com placeId Google, outra com synthetic `pref_lat_lng` cadastrado
    // por amigo nos preferidos). Antes a chave era `p.placeId` direta —
    // 2 placeIds diferentes pro mesmo venue físico = 2 cards. Agora canon
    // key é `venueName.trim().toLowerCase()` (sem acentos, sem espaços
    // extras) com fallback pra placeId quando nome ausente. Pra `realPid`
    // do hidratador, prefere placeId que NÃO começa com `pref_` (synthetic
    // de preferidos) — Google placeId é mais estável e tem dados completos
    // no `loadVenue`.
    var venuesByPid = {};
    var _canonName = function(name) {
      return String(name || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    };
    var _isSyntheticPid = function(pid) {
      return typeof pid === 'string' && pid.indexOf('pref_') === 0;
    };
    list.forEach(function(p) {
      var canon = _canonName(p.venueName) || p.placeId || '';
      if (!canon) return;
      if (!venuesByPid[canon]) {
        venuesByPid[canon] = {
          placeId: p.placeId,
          venueName: p.venueName || 'Local',
          venueLat: p.venueLat,
          venueLon: p.venueLon
        };
      } else {
        // Já tem bucket. Se este doc tem placeId Google (não-synthetic) e
        // o bucket atual tem synthetic, troca pra usar o real.
        var existing = venuesByPid[canon];
        if (_isSyntheticPid(existing.placeId) && !_isSyntheticPid(p.placeId) && p.placeId) {
          existing.placeId = p.placeId;
        }
      }
    });
    var venueList = Object.keys(venuesByPid).map(function(k) { return venuesByPid[k]; });

    var _safe = window._safeHtml || function(s) { return String(s || ''); };
    var sanitizePid = function(pid) { return 'dash_' + String(pid || '').replace(/[^a-zA-Z0-9]/g, '_'); };

    var html =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>' +
          '<span style="font-weight:700;color:var(--text-bright);font-size:0.95rem;">Movimento nos seus locais</span>' +
          '<a href="#place" style="margin-left:auto;font-size:0.78rem;color:var(--primary-color);text-decoration:none;font-weight:600;">Ver tudo →</a>' +
        '</div>';

    // v0.16.78: banner prominente listando os planos/checkins do PRÓPRIO user
    // ANTES dos venue cards. Pedido do usuário: "aqui deveria aparecer que
    // nelson estara no paineiras tal horas (para o proprio nelson)". Antes,
    // o plano só aparecia como chip discreto em "Próximas horas" do venue
    // card — fácil de não ver. Agora aparece como linha destacada verde
    // (check-in) ou índigo (plano) com horário, esporte, e botão Cancelar
    // logo no topo da seção.
    var nowMs = Date.now();
    var ownActive = ownList.filter(function(p) { return p && !p.cancelled; });
    var ownCheckins = ownActive.filter(function(p) { return p.type === 'checkin' && p.startsAt <= nowMs && p.endsAt > nowMs; });
    var ownPlans = ownActive.filter(function(p) { return p.type === 'planned' && p.startsAt > nowMs; });
    ownPlans.sort(function(a, b) { return a.startsAt - b.startsAt; });
    if (ownCheckins.length > 0 || ownPlans.length > 0) {
      var myRows = '';
      ownCheckins.forEach(function(p) {
        var pVenue = _safe(p.venueName || 'Local');
        var pSports = Array.isArray(p.sports) && p.sports.length ? p.sports.join('/') : '';
        var docId = String(p._id || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
        var endsAt = Number(p.endsAt) || 0;
        myRows +=
          '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.06));border:1px solid rgba(16,185,129,0.4);border-radius:10px;">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;flex-shrink:0;"></span>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:700;color:var(--text-bright);font-size:0.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 Você está em <span style="color:#10b981;">' + pVenue + '</span>' + (pSports ? ' <span style="font-weight:500;color:var(--text-muted);">· ' + _safe(pSports) + '</span>' : '') + '</div>' +
              '<div style="font-size:0.7rem;color:var(--text-muted);">expira em <b data-countdown-target="' + endsAt + '">…</b></div>' +
            '</div>' +
            '<button onclick="window._dashCancelPresence(\'' + docId + '\')" style="background:transparent;color:#ef4444;border:none;padding:0;margin:0;font-weight:900;font-size:1.05rem;line-height:1;cursor:pointer;flex-shrink:0;" title="Sair do local">✕</button>' +
          '</div>';
      });
      ownPlans.slice(0, 3).forEach(function(p) {
        var pVenue = _safe(p.venueName || 'Local');
        var pSports = Array.isArray(p.sports) && p.sports.length ? p.sports.join('/') : '';
        var docId = String(p._id || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
        var d = new Date(p.startsAt);
        var hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        var dayLabel = (d.toDateString() === new Date().toDateString())
          ? 'hoje'
          : (d.toDateString() === new Date(nowMs + 86400000).toDateString() ? 'amanhã' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
        myRows +=
          '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.35);border-radius:10px;">' +
            '<span style="font-size:1rem;flex-shrink:0;">🗓️</span>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:700;color:var(--text-bright);font-size:0.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Você estará em <span style="color:#a5b4fc;">' + pVenue + '</span>' + (pSports ? ' <span style="font-weight:500;color:var(--text-muted);">· ' + _safe(pSports) + '</span>' : '') + '</div>' +
              '<div style="font-size:0.7rem;color:var(--text-muted);">' + _safe(dayLabel) + ' às <b>' + _safe(hhmm) + '</b></div>' +
            '</div>' +
            '<button onclick="window._dashCancelPresence(\'' + docId + '\')" style="background:transparent;color:#ef4444;border:none;padding:0;margin:0;font-weight:900;font-size:1.05rem;line-height:1;cursor:pointer;flex-shrink:0;" title="Cancelar plano">✕</button>' +
          '</div>';
      });
      html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">' + myRows + '</div>';
    }

    venueList.forEach(function(v, idx) {
      var safePid = sanitizePid(v.placeId);
      var realPid = _safe(v.placeId);
      var name = _safe(v.venueName);
      var separator = idx > 0 ? 'margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color);' : '';
      // data-pref-pid + data-pref-placeid + data-pref-venuename = mesma assinatura
      // dos cards de #place. Quando _venuesHydrateAllPreferredMovement() roda,
      // ele encontra estes cards no DOM e hidrata os slots automaticamente.
      html +=
        '<div data-pref-pid="' + safePid + '" data-pref-placeid="' + realPid + '" data-pref-venuename="' + name + '" style="' + separator + '">' +
          '<div onclick="window.location.hash=\'#venues/' + realPid + '\'" style="cursor:pointer;font-weight:700;color:var(--text-bright);font-size:0.92rem;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' +
            '📍 ' + name +
          '</div>' +
          '<div id="pref-chart-' + safePid + '" style="margin-bottom:8px;"></div>' +
          '<div id="pref-now-' + safePid + '" style="margin-bottom:8px;"></div>' +
          '<div id="pref-upcoming-' + safePid + '"></div>' +
        '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
    // v0.16.48: dispara o ciclo de hidratação dos venues (chart + now +
    // upcoming) que vive em venues.js. Ele itera todos os [data-pref-pid]
    // no DOM — incluindo os que acabamos de inserir aqui no dashboard — e
    // popula os slots pref-chart-*, pref-now-*, pref-upcoming-*. Single
    // source of truth: nenhuma duplicação de lógica entre #place e #dashboard.
    if (typeof window._venuesHydrateAllPreferredMovement === 'function') {
      // Pequeno delay pra garantir que o DOM está pronto pra querySelectorAll.
      setTimeout(window._venuesHydrateAllPreferredMovement, 50);
    }
  }).catch(function(e) {
    console.warn('Erro ao carregar presenças de amigos:', e);
  });
}

// Check all tournaments for pending co-org invites or pending transfers targeting current user
function _checkPendingInvitesAndRedirect(allTournaments) {
  var cu = window.AppStore.currentUser;
  if (!cu || !cu.email) return;
  // Only auto-redirect once per session to avoid loop
  if (window._pendingInviteRedirected) return;

  var email = cu.email;
  var uid = cu.uid || '';

  for (var i = 0; i < allTournaments.length; i++) {
    var t = allTournaments[i];

    // Check co-host pending invite
    if (Array.isArray(t.coHosts)) {
      var pendingCohost = t.coHosts.find(function(ch) {
        return ch.status === 'pending' && (ch.email === email || (uid && ch.uid === uid));
      });
      if (pendingCohost) {
        window._pendingInviteRedirected = true;
        window._pendingInviteType = 'cohost';
        window._pendingInviteTournamentId = String(t.id);
        window.location.hash = '#tournaments/' + t.id;
        return;
      }
    }

    // Check pending transfer
    if (t.pendingTransfer && (t.pendingTransfer.targetEmail === email || (uid && t.pendingTransfer.targetUid === uid))) {
      window._pendingInviteRedirected = true;
      window._pendingInviteType = 'transfer';
      window._pendingInviteTournamentId = String(t.id);
      window.location.hash = '#tournaments/' + t.id;
      return;
    }
  }
}
