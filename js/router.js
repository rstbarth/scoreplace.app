function initRouter() {
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

    // --- For non-logged-in users visiting a tournament, auto-enroll after login ---
    const isLoggedIn = !!(window.AppStore && window.AppStore.currentUser);
    if (!isLoggedIn && view === 'tournaments' && cleanParam) {
      window._pendingInviteHash = hash;
      // Auto-save pending enrollment so login → auto-enroll → tournament details
      window._pendingEnrollTournamentId = cleanParam;
      try { sessionStorage.setItem('_pendingEnrollTournamentId', cleanParam); } catch(e) {}
      // Open login modal after brief delay (let page render first)
      setTimeout(function() {
        if (typeof openModal === 'function') openModal('modal-login');
      }, 600);
    }

    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === hash) l.classList.add('active');
    });

    viewContainer.innerHTML = '';
    const fixedBar = document.getElementById('bracket-fixed-scrollbar');
    if (fixedBar) fixedBar.remove();

    // On soft refresh (remote data update), skip scroll reset and fade animation
    // to preserve user's current position and avoid visual disruption
    if (!window._isSoftRefresh) {
      // Scroll to top on navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Fade-in animation
      viewContainer.style.opacity = '0';
      viewContainer.style.transition = 'opacity 0.25s ease-in';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          viewContainer.style.opacity = '1';
        });
      });
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
