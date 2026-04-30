function initRouter() {
  // Disable browser scroll restoration — we manage scroll ourselves. Without
  // this, bfcache + hashchange combinations let the browser repopulate scrollY
  // AFTER our jump-to-top runs, leaving Voltar looking broken.
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch(e) {}

  const links = document.querySelectorAll('.nav-link');
  const viewContainer = document.getElementById('view-container');

  // Restore invited IDs from sessionStorage (survives page reloads)
  try {
    var saved = sessionStorage.getItem('_invitedTournamentIds');
    if (saved && window.AppStore) {
      var ids = JSON.parse(saved);
      ids.forEach(function(id) {
        if (window.AppStore._invitedTournamentIds.indexOf(id) === -1) {
          window.AppStore._invitedTournamentIds.push(id);
        }
      });
    }
  } catch(e) {}

  // Detecta prerender estático no DOM (gerado por tools/prerender-landing.js).
  // Se presente E primeira rota for landing-eligible (logged-out, dashboard),
  // pulamos o re-render pra evitar flicker prerendered → blank → re-render.
  // Marcado como "consumido" após a primeira rota — qualquer navegação
  // subsequente segue o flow normal (innerHTML limpo + render).
  var _hasPrerender = false;
  try {
    var vcInit = document.getElementById('view-container');
    _hasPrerender = !!(vcInit && vcInit.innerHTML.indexOf('prerender:start') !== -1);
  } catch (e) {}
  var _firstRoute = true;

  const handleRoute = () => {
    const hash = window.location.hash || '#dashboard';
    const hashPath = hash.substring(1);
    const parts = hashPath.split('/');
    const view = parts[0];
    const param = parts[1] || null;

    // --- Preserve ?ref= invite referrer in sessionStorage ---
    var _refMatch = hash.match(/[?&]ref=([^&]+)/);
    if (_refMatch) {
      try { sessionStorage.setItem('_inviteRefUid', decodeURIComponent(_refMatch[1])); } catch(e) {}
    }
    // Clean param from query string if present
    var cleanParam = param ? param.split('?')[0] : null;

    // --- Track invited tournament IDs for visibility (memory + sessionStorage) ---
    if (view === 'tournaments' && cleanParam && window.AppStore) {
      if (window.AppStore._invitedTournamentIds.indexOf(cleanParam) === -1) {
        window.AppStore._invitedTournamentIds.push(cleanParam);
      }
      try {
        sessionStorage.setItem('_invitedTournamentIds', JSON.stringify(window.AppStore._invitedTournamentIds));
      } catch(e) {}
    }

    // --- Visitors can view tournaments without login — enrollment triggers login on demand ---

    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === hash) l.classList.add('active');
    });

    // Prerender preservation: se primeira rota E HTML estático presente E
    // landing-eligible (logged-out, dashboard), NÃO limpa o innerHTML.
    // Detectado abaixo no landing gate; aqui só pula o clear.
    var _isLoggedInForPrerenderCheck = !!(window.AppStore && window.AppStore.currentUser);
    var _hasAuthCacheForPrerenderCheck = false;
    try { _hasAuthCacheForPrerenderCheck = !!localStorage.getItem('scoreplace_authCache'); } catch(e) {}
    var _shouldPreservePrerender = _firstRoute && _hasPrerender &&
      !_isLoggedInForPrerenderCheck && !_hasAuthCacheForPrerenderCheck &&
      (view === '' || view === 'dashboard');

    if (!_shouldPreservePrerender) {
      viewContainer.innerHTML = '';
    }
    const fixedBar = document.getElementById('bracket-fixed-scrollbar');
    if (fixedBar) fixedBar.remove();

    // Close hamburger dropdown on every navigation
    if (typeof window._closeHamburger === 'function') window._closeHamburger();

    // Dismiss any overlay that could survive navigation and mask the new view
    // (including Voltar) — TV mode, set-scoring, QR, player-stats and any
    // standard .modal-overlay.active are all handled by one helper.
    if (typeof window._dismissAllOverlays === 'function') {
      window._dismissAllOverlays();
    }

    // On soft refresh (remote data update), skip scroll reset and fade animation
    // to preserve user's current position and avoid visual disruption.
    // Também pulamos a animação se preservando prerender — caso contrário o
    // opacity:0 inicial faria o prerender "piscar" antes da animação de fade,
    // empurrando o LCP da paint estática (~200ms) pra fim da animação (~700ms+).
    if (!window._isSoftRefresh && !_shouldPreservePrerender) {
      // Jump to top (instant, not smooth — smooth gets cancelled by late layout
      // shifts from the new view's render, leaving the user parked mid-page
      // and making Voltar look broken). Repeat across rAF + setTimeouts so the
      // jump survives any scroll-into-view calls inside the view render.
      var _jumpTop = function() {
        try { window.scrollTo(0, 0); } catch(e) {}
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      };
      _jumpTop();
      requestAnimationFrame(_jumpTop);
      setTimeout(_jumpTop, 50);
      setTimeout(_jumpTop, 150);
      setTimeout(_jumpTop, 350);

      // Fade-in animation
      viewContainer.style.opacity = '0';
      viewContainer.style.transition = 'opacity 0.25s ease-in';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          viewContainer.style.opacity = '1';
        });
      });
    }

    // Landing page gate: non-logged users on dashboard see landing page
    // Skip landing if Firebase Auth hasn't resolved yet but we have a cached session
    var _isLoggedInNow = !!(window.AppStore && window.AppStore.currentUser);
    var _hasAuthCacheNow = false;
    try { _hasAuthCacheNow = !!localStorage.getItem('scoreplace_authCache'); } catch(e) {}
    console.log('[scoreplace-router] route', hash, 'loggedIn:', _isLoggedInNow, 'authCache:', _hasAuthCacheNow);
    if (!_isLoggedInNow && !_hasAuthCacheNow && (view === '' || view === 'dashboard') && typeof renderLanding === 'function') {
      // Prerender: se primeira rota E HTML estático já está visível, NÃO
      // limpa nem re-renderiza — evita flicker. Próxima navegação volta
      // ao flow normal.
      if (_firstRoute && _hasPrerender) {
        console.log('[scoreplace-router] → preserving prerendered LANDING (skip re-render)');
        _firstRoute = false;
        return;
      }
      console.log('[scoreplace-router] → rendering LANDING (not logged in, no cache)');
      renderLanding(viewContainer);
      _firstRoute = false;
      return;
    }
    _firstRoute = false;
    // If auth hasn't resolved yet but we have cache, show a loading state briefly.
    // v0.17.94: ⏳ estática trocada por 🎾 girando (proposta do usuário —
    // marca esportiva do app). Animação CSS injetada inline pra não
    // depender de CSS externo carregar.
    if (!_isLoggedInNow && _hasAuthCacheNow && (view === '' || view === 'dashboard')) {
      viewContainer.innerHTML =
        '<style id="loading-spin-keyframes">' +
          '@keyframes scoreplace-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' +
          '@keyframes scoreplace-pulse { 0%,100% { filter: drop-shadow(0 0 0 transparent); } 50% { filter: drop-shadow(0 0 12px rgba(212, 244, 60, 0.6)); } }' +
        '</style>' +
        '<div style="display:flex;justify-content:center;align-items:center;min-height:60vh;">' +
          '<div style="text-align:center;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;display:inline-block;animation:scoreplace-spin 1.2s linear infinite, scoreplace-pulse 1.6s ease-in-out infinite;">🎾</div>' +
            '<p style="color:var(--text-muted);font-size:0.9rem;">Carregando...</p>' +
          '</div>' +
        '</div>';
      return;
    }

    switch (view) {
      case '':
      case 'dashboard':
        renderDashboard(viewContainer);
        break;
      case 'tournament':
      case 'tournaments':
        if (cleanParam) {
          renderTournaments(viewContainer, cleanParam);
        } else {
          window.location.replace('#dashboard');
        }
        break;
      case 'pre-draw':
        renderPreDraw(viewContainer, cleanParam);
        break;
      case 'bracket':
        renderBracket(viewContainer, cleanParam);
        break;
      case 'participants':
        renderParticipants(viewContainer, cleanParam);
        break;
      case 'rules':
        renderRules(viewContainer, cleanParam);
        break;
      case 'explore':
        renderExplore(viewContainer);
        break;
      case 'notifications':
        renderNotifications(viewContainer);
        break;
      case 'casual':
        if (cleanParam && typeof window._renderCasualJoin === 'function') {
          window._renderCasualJoin(viewContainer, cleanParam);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'presence':
        if (typeof window.renderPresence === 'function') {
          window.renderPresence(viewContainer);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'venues':
      case 'place':
        // `#place` é o alias oficial do botão "Place" do dashboard (v0.16.3+).
        // `#venues` continua funcionando para deep-links antigos.
        if (typeof window.renderVenues === 'function') {
          window.renderVenues(viewContainer, cleanParam);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'my-venues':
        if (typeof window.renderMyVenues === 'function') {
          window.renderMyVenues(viewContainer);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'support':
        if (typeof window.renderSupportPage === 'function') {
          window.renderSupportPage(viewContainer);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'invite':
        if (typeof window.renderInvitePage === 'function') {
          window.renderInvitePage(viewContainer);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'privacy':
        if (typeof window.renderPrivacy === 'function') {
          window.renderPrivacy(viewContainer);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      case 'terms':
        if (typeof window.renderTerms === 'function') {
          window.renderTerms(viewContainer);
        } else {
          window.location.replace('#dashboard');
          return;
        }
        break;
      default:
        // Rota desconhecida — redireciona para dashboard
        window.location.replace('#dashboard');
        return;
    }
  };

  if (window._routerHandler) {
    window.removeEventListener('hashchange', window._routerHandler);
  }
  window._routerHandler = handleRoute;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Safety net: never leave a blank screen — if view-container is empty after 5s, go to dashboard
  setTimeout(function() {
    var vc = document.getElementById('view-container');
    if (vc && vc.innerHTML.trim() === '' && window.location.hash !== '#dashboard') {
      window.location.hash = '#dashboard';
    }
  }, 5000);
}
