function renderDashboard(container) {
  const visible = window.AppStore.getVisibleTournaments();

  // Filtros Básicos
  const torneiosCount = visible.length;
  const torneiosPublicos = visible.filter(t => t.isPublic).length;
  const inscricoesAbertas = visible.filter(t => {
    const sorteioRealizado = t.status === 'active' && (t.matches || t.rounds || t.groups);
    const ligaAberta = t.format === 'Liga' && t.ligaOpenEnrollment !== false && sorteioRealizado;
    return (t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date())) || ligaAberta;
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

  const abertosParaVoce = visible.filter(t => {
    const isOrg = organizados.some(org => org.id === t.id);
    const isPart = participacoes.some(pt => pt.id === t.id);
    if (isOrg || isPart) return false;
    const isAberto = t.status !== 'closed' && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date());
    return isAberto;
  }).sort(sortByDate);

  const cleanSportName = (sport) => sport ? sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
  const getSportIcon = (sport) => {
    if (!sport) return '🏅';
    const s = sport.toLowerCase();
    if (s.includes('futebol') || s.includes('society') || s.includes('futsal')) return '⚽';
    if (s.includes('vôlei') || s.includes('volei')) return '🏐';
    if (s.includes('basquete')) return '🏀';
    if (s.includes('tênis de mesa') || s.includes('tenis de mesa') || s.includes('ping pong')) return '🏓';
    if (s.includes('padel')) return '🏸';
    if (s.includes('pickleball')) return '🥒';
    if (s.includes('tênis') || s.includes('tennis')) return '🎾';
    if (s.includes('xadrez')) return '♟️';
    if (s.includes('dominó') || s.includes('domino')) return '🎴';
    if (s.includes('truco')) return '🃏';
    if (s.includes('magic') || s.includes('tcg') || s.includes('card')) return '🃏';
    if (s.includes('esports') || s.includes('game')) return '🎮';
    if (s.includes('kart') || s.includes('corrida')) return '🏎️';
    if (s.includes('luta') || s.includes('boxe')) return '🥊';
    return '🏅';
  };

  const renderTournamentCard = (t, type) => {
    const publicText = t.isPublic ? 'Público' : 'Privado';

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
    const dates = start ? (end ? `${start} A ${end}` : `${start}`) : 'A DEFINIR';
    const regLimit = formatDateBr(t.registrationLimit);
    const cats = (t.categories && t.categories.length) ? t.categories.join(', ') : 'Cat. Única';

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
          }
        }
      }
    }

    // Inscrições fecham após sorteio (status 'active'), exceto Liga com inscrições abertas na temporada
    const isFinished = t.status === 'finished';
    const sorteioRealizado = t.status === 'active' && ((Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0));
    const ligaAberta = (typeof window._isLigaFormat === 'function' ? window._isLigaFormat(t) : t.format === 'Liga') && t.ligaOpenEnrollment !== false && sorteioRealizado;
    const isAberto = !isFinished && t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date()) || ligaAberta;
    const statusText = isFinished ? 'Encerrado' : (isAberto ? 'Inscrições Abertas' : (sorteioRealizado ? 'Em Andamento' : 'Inscrições Encerradas'));
    const statusBg = isFinished ? 'rgba(251,191,36,0.15)' : (isAberto ? '#fbbf24' : (sorteioRealizado ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)'));
    const statusColor = isFinished ? '#fbbf24' : (isAberto ? '#78350f' : (sorteioRealizado ? '#34d399' : '#fca5a5'));
    const statusFontWeight = isAberto ? '700' : '600';

    let enrollmentText = 'Misto (Individual e Times)';
    if (t.enrollmentMode === 'individual') enrollmentText = 'Individual';
    else if (t.enrollmentMode === 'time') enrollmentText = 'Apenas Times';
    else if (t.enrollmentMode === 'misto') enrollmentText = 'Misto (Individual e Times)';

    const isOrg = window.AppStore.currentUser && t.organizerEmail === window.AppStore.currentUser.email;

    let isParticipating = false;
    if (t.participants && window.AppStore.currentUser) {
      const user = window.AppStore.currentUser;
      const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
      isParticipating = arr.some(p => {
        const str = typeof p === 'string' ? p : (p.email || p.displayName);
        return str && (str.includes(user.email) || str.includes(user.displayName));
      });
    }

    let bgGradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
    if (isParticipating) bgGradient = 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)';
    else if (isOrg) bgGradient = 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)';

    // Venue photo background
    let venuePhotoBg = '';
    if (t.venuePhotoUrl) {
      var overlayGrad = isOrg
        ? 'linear-gradient(135deg, rgba(67,56,202,0.85) 0%, rgba(99,102,241,0.8) 100%)'
        : isParticipating
          ? 'linear-gradient(135deg, rgba(15,118,110,0.85) 0%, rgba(20,184,166,0.8) 100%)'
          : 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.8) 100%)';
      venuePhotoBg = 'background-image: ' + overlayGrad + ', url(' + t.venuePhotoUrl + '); background-size: cover; background-position: center;';
    }

    let individualCount = 0;
    let teamCount = 0;
    if (t.participants) {
      const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
      arr.forEach(p => {
        const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
        if (pStr.includes('/')) {
          teamCount++;
          individualCount += pStr.split('/').filter(n => n.trim().length > 0).length;
        } else {
          individualCount++;
        }
      });
    }

    let participandoBadge = '';
    if (isParticipating) {
      participandoBadge = `<div style="font-size: 0.65rem; font-weight: 700; color: #fef08a; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; margin-top: 4px;">Inscrito ✓</div>`;
    }

    const _isFav = typeof window._isFavorite === 'function' && window._isFavorite(t.id);
    return `
        <div class="card mb-3" style="position: relative; overflow: hidden; ${venuePhotoBg ? venuePhotoBg : 'background: ' + bgGradient + ';'} color: white; border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='#tournaments/${t.id}'" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'">
          ${(isParticipating && isOrg) ? `
             <div style="position: absolute; bottom: 0; right: 0; width: 36px; height: 36px; overflow: hidden; display: flex; align-items: flex-end; justify-content: flex-end;" title="Você é o Organizador e também está Inscrito">
               <svg viewBox="0 0 36 36" width="36" height="36" style="display: block;">
                 <path d="M0 36 L36 0 L36 36 Z" fill="rgba(251, 191, 36, 0.95)" />
               </svg>
             </div>
          ` : ''}
          <div class="card-body p-4">
            
            <!-- Top Row: Icon/Modality | Status (same line, consistent with detail page) -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; flex-wrap: nowrap;">
               <div style="display: flex; align-items: center; gap: 6px; opacity: 0.65; flex-shrink: 0;">
                  <span style="font-size: 1.1rem;">${getSportIcon(t.sport)}</span>
                  <span>${cleanSportName(t.sport) || 'Esporte'}</span>
               </div>
               <div style="display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0;">
                  <div style="color: ${statusColor}; background: ${statusBg}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: ${statusFontWeight}; white-space: nowrap;">
                    ${statusText}
                  </div>
                  ${participandoBadge}
               </div>
            </div>

            <!-- Middle Left: Nome + Logo + Favorito -->
            <div style="display: flex; align-items: center; gap: 14px; margin: 1.8rem 0 1.5rem 0;">
              ${t.logoData ? `<img src="${t.logoData}" alt="Logo" style="width: 56px; height: 56px; border-radius: 10px; object-fit: cover; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">` : ''}
              <h4 style="margin: 0; font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; text-align: left; flex: 1;">
                ${t.name}
              </h4>
              <span data-fav-id="${t.id}" onclick="window._toggleFavorite('${t.id}', event)" title="${_isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" style="font-size:1.5rem;cursor:pointer;flex-shrink:0;color:${_isFav ? '#fbbf24' : 'rgba(255,255,255,0.4)'};transition:color 0.2s;line-height:1;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${_isFav ? '★' : '☆'}</span>
            </div>

            <!-- Below Name: Calendário + Data -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; opacity: 0.7;">
               <span style="font-size: 1.1rem;">🗓️</span>
               <span>${dates}</span>
            </div>

            <!-- Linha separadora -->
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1.8rem 0;"></div>

            <!-- Bottom Section -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center; opacity: 0.75;">
               
               <!-- Stats Column -->
               <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                   <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap; align-items: flex-start;">
                       <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">👤</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${individualCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">Inscritos</span>
                       </div>
                       ${(teamCount > 0 && t.enrollmentMode !== 'individual') ? `
                       <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">👥</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">Equipes</span>
                       </div>
                       ` : ''}
                   </div>
                   ${(typeof window._buildCategoryCountHtml === 'function') ? window._buildCategoryCountHtml(t) : ''}
               </div>

               <!-- Formato, Regras e Categorias -->
               <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem;">
                  <div><strong>Formato:</strong> ${t.format}</div>
                  <div><strong>Acesso:</strong> ${publicText}</div>
               </div>
            </div>

            ${(() => {
              var _html = '';
              // Progress bar for active tournaments
              if (typeof window._getTournamentProgress === 'function') {
                var _prog = window._getTournamentProgress(t);
                if (_prog.total > 0) {
                  var _barColor = _prog.pct === 100 ? '#10b981' : (_prog.pct > 50 ? '#3b82f6' : '#f59e0b');
                  _html += '<div style="margin-top: 10px; padding: 8px 12px; background: rgba(0,0,0,0.12); border-radius: 10px;">';
                  _html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">';
                  _html += '<span style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7;">Progresso</span>';
                  _html += '<span style="font-size: 0.7rem; font-weight: 700;">' + _prog.pct + '%</span>';
                  _html += '</div>';
                  _html += '<div style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">';
                  _html += '<div style="width: ' + _prog.pct + '%; height: 100%; background: ' + _barColor + '; border-radius: 3px;"></div>';
                  _html += '</div></div>';
                }
              }
              // Registration deadline countdown
              if (isAberto && t.registrationLimit && !isFinished) {
                var _regDate = new Date(t.registrationLimit);
                if (!isNaN(_regDate.getTime())) {
                  var _daysLeft = Math.ceil((_regDate - new Date()) / 86400000);
                  if (_daysLeft > 0 && _daysLeft <= 14) {
                    var _urgColor = _daysLeft <= 2 ? '#ef4444' : (_daysLeft <= 5 ? '#f59e0b' : '#a5b4fc');
                    _html += '<div style="margin-top: 6px; font-size: 0.7rem; font-weight: 600; color: ' + _urgColor + '; display: flex; align-items: center; gap: 4px;">';
                    _html += '<span>⏰</span> Inscrições encerram em ' + _daysLeft + ' dia' + (_daysLeft > 1 ? 's' : '');
                    _html += '</div>';
                  }
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

  // Collect unique sports and locations for filter bar
  const allTournaments = [...meus, ...abertosParaVoce];
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

  const userName = window.AppStore.currentUser ? window.AppStore.currentUser.displayName.split(' ')[0] : 'Visitante';

  // Initialize filter state
  if (!window._dashFilter) window._dashFilter = 'todos';
  if (!window._dashSport) window._dashSport = '';
  if (!window._dashLocation) window._dashLocation = '';
  if (!window._dashFormat) window._dashFormat = '';

  // Filter function
  window._applyDashFilter = function(filter) {
    window._dashFilter = filter;
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

  // Build upcoming matches widget for current user
  function _buildUpcomingMatchesHtml() {
    var cu = window.AppStore.currentUser;
    if (!cu || !cu.email) return '';

    var email = cu.email.toLowerCase();
    var dName = (cu.displayName || '').toLowerCase();
    var pending = [];

    function _isMe(label) {
      if (!label) return false;
      var l = label.toLowerCase();
      return l.includes(email) || (dName && l === dName);
    }

    participacoes.forEach(function(t) {
      if (t.status === 'finished') return;
      var tName = t.name || 'Torneio';
      var tId = t.id;

      // Collect pending matches (no winner yet, player is p1 or p2)
      var matchSources = [];
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

      matchSources.forEach(function(m) {
        if (!m || m.winner) return; // Already has result
        if (m.p1 === 'TBD' || m.p2 === 'TBD' || m.p1 === 'BYE' || m.p2 === 'BYE') return;
        var imP1 = _isMe(m.p1);
        var imP2 = _isMe(m.p2);
        if (!imP1 && !imP2) return;

        var opponent = imP1 ? (m.p2 || '?') : (m.p1 || '?');
        pending.push({
          tournament: tName,
          tournamentId: tId,
          opponent: opponent,
          round: m.round || m.roundLabel || '',
          sport: t.sport || ''
        });
      });
    });

    if (pending.length === 0) return '';

    var maxShow = Math.min(pending.length, 5);
    var html = '<div style="margin-bottom:1.25rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px 16px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:1.1rem;">⚔️</span><span style="font-size:0.9rem;font-weight:700;color:var(--text-bright);">Suas Próximas Partidas</span><span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto;">' + pending.length + ' pendente' + (pending.length > 1 ? 's' : '') + '</span></div>';

    for (var i = 0; i < maxShow; i++) {
      var p = pending[i];
      var safeOpp = window._safeHtml ? window._safeHtml(p.opponent) : p.opponent;
      var safeTourney = window._safeHtml ? window._safeHtml(p.tournament) : p.tournament;
      html += '<div onclick="window.location.hash=\'#tournaments/' + p.tournamentId + '\'" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">';
      html += '<span style="font-size:1.1rem;">' + getSportIcon(p.sport) + '</span>';
      html += '<div style="flex:1;overflow:hidden;"><div style="font-size:0.82rem;font-weight:600;color:var(--text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">vs ' + safeOpp + '</div>';
      html += '<div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeTourney + (p.round ? ' — ' + p.round : '') + '</div></div>';
      html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.5;"><path d="M9 18l6-6-6-6"/></svg>';
      html += '</div>';
    }
    if (pending.length > maxShow) {
      html += '<div style="text-align:center;font-size:0.7rem;color:var(--text-muted);padding:4px 0;">e mais ' + (pending.length - maxShow) + '...</div>';
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
  } else {
    const seen = new Set();
    [...organizadosSorted, ...participacoesSorted, ...abertosParaVoce].forEach(t => {
      if (!seen.has(t.id)) { seen.add(t.id); filtered.push(t); }
    });
    filtered.sort(sortByDate);
  }

  // Apply secondary filters
  if (curSport) filtered = filtered.filter(t => cleanSportName(t.sport) === curSport);
  if (curLocation) filtered = filtered.filter(t => t.venueName === curLocation);
  if (curFormat) filtered = filtered.filter(t => t.format === curFormat);

  const filteredHtml = filtered.length > 0
    ? filtered.map(t => renderTournamentCard(t, '')).join('')
    : '<div style="text-align:center;padding:2rem;color:var(--text-muted);opacity:0.6;">Nenhum torneio encontrado para este filtro.</div>';

  // Build filter pills for sports
  let sportsPills = sportsArr.map(s => {
    const active = curSport === s;
    return `<button onclick="window._applyDashSport('${s.replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1px solid ${active ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'};color:${active ? '#a5b4fc' : 'var(--text-muted)'};font-size:0.75rem;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;transition:all 0.2s;"><span>${getSportIcon(s)}</span>${s}</button>`;
  }).join('');

  // Build filter pills for locations
  let locationPills = locationsArr.map(l => {
    const active = curLocation === l;
    return `<button onclick="window._applyDashLocation('${l.replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1px solid ${active ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'};background:${active ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'};color:${active ? '#4ade80' : 'var(--text-muted)'};font-size:0.75rem;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;transition:all 0.2s;">📍${l}</button>`;
  }).join('');

  // Build filter pills for formats
  let formatPills = formatsArr.map(f => {
    const active = curFormat === f;
    return `<button onclick="window._applyDashFormat('${f.replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;border:1px solid ${active ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'};background:${active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)'};color:${active ? '#fbbf24' : 'var(--text-muted)'};font-size:0.75rem;font-weight:${active ? '700' : '500'};cursor:pointer;white-space:nowrap;transition:all 0.2s;">🏅${f}</button>`;
  }).join('');

  const hasSecondaryFilters = sportsArr.length > 0 || locationsArr.length > 0 || formatsArr.length > 0;
  const filterBarHtml = hasSecondaryFilters ? `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.2rem;align-items:center;">
      ${sportsPills}${locationPills}${formatPills}
      ${(curSport || curLocation || curFormat) ? `<button onclick="window._dashSport='';window._dashLocation='';window._dashFormat='';window._applyDashFilter(window._dashFilter||'todos')" style="padding:6px 12px;border-radius:20px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#f87171;font-size:0.7rem;font-weight:600;cursor:pointer;white-space:nowrap;">✕ Limpar filtros</button>` : ''}
    </div>
  ` : '';

  // Main filter card styles
  const _fStyle = (key, emoji, count, label) => {
    const active = curFilter === key;
    return `<div style="background:${active ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'};backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:1.5rem 1rem;border-radius:16px;border:${active ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.05)'};cursor:pointer;transition:transform 0.2s,box-shadow 0.2s,border 0.2s;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;${active ? 'box-shadow:0 0 20px rgba(255,255,255,0.1);transform:translateY(-2px);' : ''}" onclick="window._applyDashFilter('${key}')" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='${active ? 'translateY(-2px)' : 'none'}';this.style.boxShadow='${active ? '0 0 20px rgba(255,255,255,0.1)' : 'none'}'">
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

      <div style="margin-bottom: 1rem; display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
        <h2 style="margin:0; font-size: 2.2rem; font-weight: 700;">Olá, ${userName}</h2>
        <p style="margin: 0.5rem 0 0 0; opacity: 0.85; font-size: 1.1rem;">Gerencie seus torneios e partidas esportivas</p>
      </div>

      <div style="text-align: center; margin-bottom: 1.5rem;">
        <button class="btn hover-lift" id="btn-create-tournament-in-box" style="background: #1e40af; color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); padding: 0.85rem 2.2rem; cursor: pointer; font-weight: 600; font-size: 1.15rem; transition: all 0.2s ease; letter-spacing: 0.02em;" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='#1e40af'" onclick="if(typeof openModal==='function')openModal('modal-quick-create');">
          + Novo Torneio
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
        ${_fStyle('todos', '📋', allUnique.length, 'Todos')}
        ${_fStyle('organizados', '🏆', organizadosCount, 'Meus Torneios')}
        ${_fStyle('participando', '👤', participacoesCount, 'Participando')}
        ${_fStyle('abertos', '🗓️', abertosParaVoce.length, 'Inscrições Disponíveis')}
        ${favoritosCount > 0 ? _fStyle('favoritos', '⭐', favoritosCount, 'Favoritos') : ''}
      </div>
    </div>

    <!-- Filter Bar -->
    ${filterBarHtml}

    <!-- Upcoming Matches -->
    ${_buildUpcomingMatchesHtml()}

    <!-- Tournament Cards -->
    <div class="dashboard-list" style="margin-bottom: 2rem;">
      <div class="cards-grid">
        ${filteredHtml}
      </div>
    </div>
  `;
  container.innerHTML = html;
}
