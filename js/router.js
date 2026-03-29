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

    // --- Track invited tournament IDs for visibility (memory + sessionStorage) ---
    if (view === 'tournaments' && param && window.AppStore) {
      if (window.AppStore._invitedTournamentIds.indexOf(param) === -1) {
        window.AppStore._invitedTournamentIds.push(param);
      }
      try {
        sessionStorage.setItem('_invitedTournamentIds', JSON.stringify(window.AppStore._invitedTournamentIds));
      } catch(e) {}
    }

    // --- For non-logged-in users visiting a tournament, save hash for post-login redirect ---
    const isLoggedIn = !!(window.AppStore && window.AppStore.currentUser);
    if (!isLoggedIn && view === 'tournaments' && param) {
      window._pendingInviteHash = hash;
      // Let them through to see tournament details with prominent enroll button
    }

    links.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('href') === hash) l.classList.add('active');
    });

    viewContainer.innerHTML = '';
    const fixedBar = document.getElementById('bracket-fixed-scrollbar');
    if (fixedBar) fixedBar.remove();

    switch (view) {
      case 'dashboard':
        renderDashboard(viewContainer);
        break;
      case 'tournaments':
        if (param) {
          renderTournaments(viewContainer, param);
        } else {
          window.location.replace('#dashboard');
        }
        break;
      case 'pre-draw':
        renderPreDraw(viewContainer, param);
        break;
      case 'bracket':
        renderBracket(viewContainer, param);
        break;
      case 'participants':
        renderParticipants(viewContainer, param);
        break;
      case 'rules':
        renderRules(viewContainer, param);
        break;
      case 'explore':
        renderExplore(viewContainer);
        break;
      case 'notifications':
        renderNotifications(viewContainer);
        break;
      default:
        viewContainer.innerHTML = '<div class="card"><div class="card-body"><h3>Em constru\u00E7\u00E3o</h3><p>A p\u00E1gina ' + view + ' estar\u00E1 dispon\u00EDvel em breve.</p></div></div>';
    }
  };

  if (window._routerHandler) {
    window.removeEventListener('hashchange', window._routerHandler);
  }
  window._routerHandler = handleRoute;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
