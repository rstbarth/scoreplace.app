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
    var months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
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
  var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
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
    if (typeof showAlertDialog === 'function') showAlertDialog('Inscrições Encerradas', 'As inscrições deste torneio já foram encerradas.', null, { type: 'warning' });
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

  const abertosParaVoce = visible.filter(t => {
    const isOrg = organizados.some(org => org.id === t.id);
    const isPart = participacoes.some(pt => pt.id === t.id);
    if (isOrg || isPart) return false;
    const _hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
    const _ligaAberta = (typeof window._isLigaFormat === 'function' ? window._isLigaFormat(t) : t.format === 'Liga') && t.ligaOpenEnrollment !== false && _hasDraw;
    const isAberto = (t.status !== 'closed' && t.status !== 'finished' && !_hasDraw && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date())) || _ligaAberta;
    return isAberto;
  }).sort(sortByDate);

  const cleanSportName = (sport) => sport ? sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
  const getSportIcon = (sport) => {
    if (!sport) return '🏆';
    const s = sport.toLowerCase();
    if (s.includes('tênis de mesa') || s.includes('tenis de mesa') || s.includes('ping pong')) return '🏓';
    if (s.includes('padel')) return '🏸';
    if (s.includes('pickleball')) return '🥒';
    if (s.includes('tênis') || s.includes('tennis') || s.includes('beach')) return '🎾';
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
      enrollBtnHtml = `<button class="btn btn-sm btn-danger hover-lift" onclick="event.stopPropagation(); window.deenrollCurrentUser('${t.id}')">🛑 ${_t('enroll.unenrollBtn')}</button>`;
    } else if (!isParticipating && canEnroll) {
      enrollBtnHtml = `<button class="btn btn-sm btn-success hover-lift" onclick="event.stopPropagation(); window._dashEnroll('${t.id}')">✅ ${_t('enroll.enrollBtn')}</button>`;
    } else if (isParticipating && !canEnroll && !isFinished) {
      enrollBtnHtml = `<div style="font-size: 0.65rem; font-weight: 700; color: #fef08a; text-transform: uppercase; letter-spacing: 0.5px;">${_t('enroll.enrolled')} ✓</div>`;
    } else if (isFinished && (isParticipating || isOrg)) {
      enrollBtnHtml = `<div style="font-size: 0.65rem; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(251,191,36,0.12); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(251,191,36,0.25);">🏆 ${isOrg ? _t('dashboard.youOrganized') : _t('dashboard.youParticipated')}</div>`;
    }

    const _isFav = typeof window._isFavorite === 'function' && window._isFavorite(t.id);
    return `
        <div class="card mb-3" style="position: relative; overflow: hidden; ${venuePhotoBg ? venuePhotoBg : 'background: ' + bgGradient + ';'} color: ${_cardTextColor}; border: 1px solid ${_isLight ? 'rgba(0,0,0,0.08)' : 'transparent'}; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,${_isLight ? '0.06' : '0.1'}); cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='#tournaments/${t.id}'" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'">
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

            <!-- Below Name: Calendário + Data -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; opacity: 0.7;">
               <span style="font-size: 1.1rem;">🗓️</span>
               <span>${dates}</span>
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
                  if (!isNaN(_sd) && _sd > _now) _ligaEv = { ts: _sd, label: 'Início da Liga', icon: '🏁', color: '#10b981' };
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
                    if (!isNaN(_ndTs) && _ndTs > _now && (!_seTs || _ndTs <= _seTs)) _ligaEv = { ts: _ndTs, label: 'Próximo sorteio', icon: '🎲', color: '#fb923c' };
                  }
                }
                // 3. Sem próximo sorteio → countdown para fim da temporada
                if (!_ligaEv) {
                  var _sm2 = t.ligaSeasonMonths || t.rankingSeasonMonths;
                  if (_sm2 && t.startDate) {
                    var _ssd2 = new Date(t.startDate);
                    if (!isNaN(_ssd2.getTime())) { var _end = new Date(_ssd2); _end.setMonth(_end.getMonth() + parseInt(_sm2)); var _eTs = _end.getTime(); if (!isNaN(_eTs) && _eTs > _now) _ligaEv = { ts: _eTs, label: 'Fim da temporada', icon: '🏁', color: '#8b5cf6' }; }
                  }
                }
                if (!_ligaEv) return '';
                var _ct = window._formatCountdown ? window._formatCountdown(_ligaEv.ts - _now) : '';
                var _cm = { '#10b981': '16,185,129', '#fb923c': '251,146,60', '#8b5cf6': '139,92,246' };
                var _rgb = _cm[_ligaEv.color] || '139,92,246';
                return '<div style="margin-top:10px;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(' + _rgb + ',0.1);border:1px solid rgba(' + _rgb + ',0.3);border-radius:12px;">' +
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
                '<span style="font-size:0.85rem;font-weight:700;color:#10b981;">Em andamento</span>' +
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
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">Inscritos</span>
                       </div>
                       ${teamCount > 0 ? `
                       <div class="stat-box" style="flex-direction: column;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">👥</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">Equipes</span>
                       </div>
                       ` : ''}
                       ${_standbyCount > 0 ? `
                       <div class="stat-box" style="flex-direction: column; border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.08);">
                          <div style="display: flex; align-items: center; gap: 4px;">
                             <span style="font-size: 1.1rem;">⏱️</span>
                             <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95; color: #fbbf24;">${_standbyCount}</span>
                          </div>
                          <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8; color: #fbbf24;">Espera</span>
                       </div>
                       ` : ''}
                   </div>
                   ${(typeof window._buildCategoryCountHtml === 'function') ? window._buildCategoryCountHtml(t) : ''}
               </div>

               <!-- Formato, Regras e Categorias -->
               <div class="info-box">
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
                  _html += '<div class="info-box" style="margin-top: 10px; padding: 8px 12px;">';
                  _html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">';
                  _html += '<span style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7;">Progresso</span>';
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
                  _html += '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:1px;">' + _pStatusText + ' · ' + _pVotes + '/' + _pTotal + ' votos</div>';
                  _html += '</div></div>';
                  _html += '<div style="text-align:center;background:rgba(0,0,0,0.2);padding:6px 14px;border-radius:10px;">';
                  _html += '<div style="font-size:1.4rem;font-weight:900;color:#a5b4fc;line-height:1;font-variant-numeric:tabular-nums;">' + _pTimeStr + '</div>';
                  _html += '<div style="font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">restante</div>';
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
  // Restore saved view preference
  if (!window._dashView) {
    try { window._dashView = localStorage.getItem('scoreplace_dashView') || 'cards'; } catch(e) { window._dashView = 'cards'; }
  }

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
      return l === email || (dName && l === dName) || (cu.uid && l === cu.uid);
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
    var _t2 = window._t || function(k) { return k; };
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:1.1rem;">⚔️</span><span style="font-size:0.9rem;font-weight:700;color:var(--text-bright);">' + _t2('dashboard.nextMatches') + '</span><span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto;">' + pending.length + '</span></div>';

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
      filteredHtml += '<div style="grid-column:1/-1;margin-top:0.5rem;"><details open><summary style="cursor:pointer;font-weight:700;font-size:0.9rem;color:var(--text-muted);padding:8px 0;user-select:none;">' + _t('dashboard.finishedSection', {count: finishedList.length}) + '</summary><div style="margin-top:0.75rem;">' + finishedCards + '</div></details></div>';
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
    filteredHtml = visibleItems.length > 0
      ? visibleItems.map(t => renderTournamentCard(t, '')).join('')
      : '<div style="text-align:center;padding:2rem;color:var(--text-muted);opacity:0.6;">' + _t('tournament.emptyState') + '</div>';
    if (_sortedFiltered.length > visibleItems.length) {
      filteredHtml += '<div style="grid-column:1/-1;text-align:center;padding:1rem;"><button onclick="window._dashPage=(window._dashPage||1)+1;var c=document.getElementById(\'view-container\');if(c&&typeof renderDashboard===\'function\')renderDashboard(c);" class="btn hover-lift" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:10px 28px;font-weight:600;font-size:0.85rem;cursor:pointer;">' + _t('dashboard.loadMore', {count: _sortedFiltered.length - visibleItems.length}) + '</button></div>';
    }
  }

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
      ${(curSport || curLocation || curFormat) ? `<button class="btn btn-micro btn-pill" onclick="window._dashSport='';window._dashLocation='';window._dashFormat='';window._applyDashFilter(window._dashFilter||'todos')" style="background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.3);">✕ Limpar filtros</button>` : ''}
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
            (isOrg ? '<span style="font-size:0.65rem;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,0.15);color:#fbbf24;">Org</span>' : '') +
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

      <div style="margin-bottom: 1rem; display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
        <h2 style="margin:0; font-size: 2.2rem; font-weight: 700;">${_t('dashboard.welcome', {name: userName})}</h2>
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;width:100%;max-width:600px;">
          <button class="btn btn-cta hover-lift" id="btn-create-tournament-in-box" style="background: #1e40af; color: #ffffff; flex:1;min-width:min(55vw,240px); min-height: 78px; font-size: 1.35rem; font-weight: 700; border-radius: 14px; border: 1px solid rgba(255,255,255,0.35); letter-spacing: 0.02em;" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='#1e40af'" onclick="if(typeof openModal==='function')openModal('modal-quick-create');">
            ${_t('dashboard.newTournament')}
          </button>
          <button class="btn btn-cta hover-lift" id="btn-casual-match" style="background:linear-gradient(135deg,#38bdf8,#0ea5e9); color: #ffffff; flex:0 0 auto;min-width:min(25vw,110px); min-height: 78px; font-size: 0.88rem; font-weight: 700; border-radius: 14px; border: 1px solid rgba(255,255,255,0.35); letter-spacing: 0.02em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''" onclick="if(typeof window._openCasualMatch==='function')window._openCasualMatch();">
            <span style="font-size:1.5rem;">📡</span>
            <span>Partida Casual</span>
          </button>
          <button class="btn btn-cta hover-lift" id="btn-scan-qr" style="background:linear-gradient(135deg,#a855f7,#7c3aed); color: #ffffff; flex:0 0 auto;min-width:min(25vw,110px); min-height: 78px; font-size: 0.88rem; font-weight: 700; border-radius: 14px; border: 1px solid rgba(255,255,255,0.35); letter-spacing: 0.02em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''" onclick="if(typeof window._openScanQR==='function')window._openScanQR();">
            <span style="font-size:1.5rem;">📷</span>
            <span>Escanear QR</span>
          </button>
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="btn-support-pix" class="btn hover-lift" title="${_t('common.support')}" style="background: #047857; color: #fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.82rem; padding: 0 16px; height: 38px; border-radius: 10px;" onclick="window._showSupportModal()">💚 ${_t('common.support')}</button>
          <button id="btn-upgrade-pro" class="btn hover-lift" title="${_t('common.pro')}" style="display: none; background: linear-gradient(135deg,#3b82f6,#6366f1); color: #fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.82rem; padding: 0 16px; height: 38px; border-radius: 10px;" onclick="window._showUpgradeModal()">🚀 ${_t('common.pro')}</button>
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

    <!-- Organizer Analytics -->
    ${_buildAnalyticsSection(organizados)}

    <!-- Filter Bar -->
    ${filterBarHtml}

    <!-- Upcoming Matches -->
    ${_buildUpcomingMatchesHtml()}

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
  `;
  container.innerHTML = html;

  // Show/hide Pro button based on plan (element is now inside hero box)
  var proBtn = document.getElementById('btn-upgrade-pro');
  if (proBtn) {
    var isPro = typeof window._isPro === 'function' && window._isPro();
    proBtn.style.display = isPro ? 'none' : 'inline-flex';
  }

  // ─── Pending invite detection: auto-redirect to tournament with pending co-org or participation invite ───
  _checkPendingInvitesAndRedirect(visible);
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
