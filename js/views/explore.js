// ========================================
// scoreplace.app — Explorar (Buscar Usuários + Amizades)
// ========================================

function renderExplore(container) {
  var cu = window.AppStore.currentUser;
  if (!cu) {
    container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;">' +
      '<p style="color: var(--text-muted); font-size: 1.1rem;">Faça login para explorar a comunidade scoreplace.app</p>' +
      '<button class="btn btn-primary" onclick="if(typeof openModal===\'function\')openModal(\'modal-login\');" style="margin-top: 1rem;">Entrar</button>' +
    '</div>';
    return;
  }

  var myUid = cu.uid || cu.email;
  var myFriends = cu.friends || [];
  var mySent = cu.friendRequestsSent || [];
  var myReceived = cu.friendRequestsReceived || [];

  container.innerHTML =
    '<div style="max-width: 800px; margin: 0 auto;">' +
      '<h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 1.25rem; color: var(--text-bright);">Explorar Comunidade</h2>' +

      // Pending friend requests
      '<div id="explore-pending"></div>' +

      // My friends section (rendered first, above search)
      '<div id="explore-friends"></div>' +

      // Conhecidos (same tournaments)
      '<div id="explore-conhecidos"></div>' +

      // Search bar
      '<div style="display: flex; gap: 10px; margin-bottom: 1.25rem;">' +
        '<input type="text" id="explore-search-input" class="form-control" placeholder="Buscar por nome, cidade ou esporte..." style="flex: 1; box-sizing: border-box;">' +
        '<button class="btn btn-primary" id="explore-search-btn" style="white-space: nowrap; padding: 0 1.25rem;">Buscar</button>' +
      '</div>' +

      // Non-friend, non-conhecido results
      '<div id="explore-results"></div>' +
    '</div>';

  // Render pending friend requests
  _renderPendingRequests(myUid, myReceived);

  // Render my friends (card grid, sorted by interaction)
  _renderMyFriends(myUid, myFriends);

  // Render conhecidos (shared tournaments, not friends)
  _renderConhecidos(myUid, myFriends, mySent, myReceived);

  // Search handler
  var searchInput = document.getElementById('explore-search-input');
  var searchBtn = document.getElementById('explore-search-btn');

  function doSearch() {
    _performUserSearch(searchInput.value.trim(), myUid, myFriends, mySent, myReceived);
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSearch();
  });

  // Auto-load non-friend users
  _performUserSearch('', myUid, myFriends, mySent, myReceived);
}

// ---- User card HTML builder ----
function _userCardHtml(u, uid, actionHtml, isFriend) {
  var photo = u.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
  var name = u.displayName || 'Usuário';
  var infoChips = [];
  if (u.city) infoChips.push(u.city);
  if (u.preferredSports) infoChips.push(u.preferredSports);
  if (u.age) infoChips.push(u.age + ' anos');

  var borderColor = isFriend ? 'var(--success-color)' : 'var(--border-color)';
  var bgTint = isFriend ? 'rgba(34, 197, 94, 0.06)' : 'transparent';

  return '<div class="card" style="padding: 0.75rem; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; background: ' + bgTint + '; border: 1px solid ' + borderColor + '; border-radius: 12px; min-width: 0;">' +
    '<img src="' + photo + '" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2.5px solid ' + borderColor + ';">' +
    '<div style="width: 100%; min-width: 0; overflow: hidden;">' +
      '<div style="font-weight: 600; color: var(--text-bright); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + name + '</div>' +
      (infoChips.length > 0 ? '<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + infoChips.join(' · ') + '</div>' : '') +
    '</div>' +
    '<div style="margin-top: auto; width: 100%;">' + actionHtml + '</div>' +
  '</div>';
}

// ---- Search non-friend users ----
function _performUserSearch(query, myUid, myFriends, mySent, myReceived) {
  var resultsDiv = document.getElementById('explore-results');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Buscando...</div>';

  window.FirestoreDB.searchUsers(query).then(function(users) {
    // Filter out self, friends, and conhecidos (shown in their own sections)
    var conhecidosEmails = window._conhecidosEmails || [];
    users = users.filter(function(u) {
      var uid = u._docId || u.uid || u.email;
      var email = u.email || '';
      return uid !== myUid && myFriends.indexOf(uid) === -1 && conhecidosEmails.indexOf(email) === -1 && conhecidosEmails.indexOf(uid) === -1;
    });

    if (users.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">' +
        (query ? 'Nenhum usuário encontrado para "' + query + '"' : 'Nenhum outro usuário disponível no momento') +
      '</div>';
      return;
    }

    var html = '<div style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Outros Usuários</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">';

    users.forEach(function(u) {
      var uid = u._docId || u.uid || u.email;
      var isSent = mySent.indexOf(uid) !== -1;
      var isReceived = myReceived.indexOf(uid) !== -1;

      var actionBtn = '';
      if (isSent) {
        actionBtn = '<span style="display: block; color: var(--text-muted); font-size: 0.7rem; font-weight: 500; padding: 4px 0;">Convite enviado</span>';
      } else if (isReceived) {
        actionBtn = '<div style="display: flex; gap: 4px; justify-content: center;">' +
          '<button class="btn btn-sm" style="background: var(--success-color); color: #fff; border: none; font-size: 0.7rem; padding: 4px 8px; border-radius: 6px;" onclick="event.stopPropagation(); _acceptFriend(\'' + uid + '\')">Aceitar</button>' +
          '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); font-size: 0.7rem; padding: 4px 8px; border-radius: 6px;" onclick="event.stopPropagation(); _rejectFriend(\'' + uid + '\')">Recusar</button>' +
        '</div>';
      } else {
        actionBtn = '<button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, var(--primary-color) 0%, #1d4ed8 100%); color: #fff; border: none; font-size: 0.75rem; font-weight: 600; padding: 5px 12px; border-radius: 8px; width: 100%;" onclick="event.stopPropagation(); _sendFriendRequest(\'' + uid + '\')">Convidar</button>';
      }

      html += _userCardHtml(u, uid, actionBtn, false);
    });

    html += '</div>';
    resultsDiv.innerHTML = html;
  }).catch(function(err) {
    resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger-color);">Erro ao buscar: ' + (err.message || err) + '</div>';
  });
}

// ---- Pending friend requests ----
function _renderPendingRequests(myUid, receivedIds) {
  var div = document.getElementById('explore-pending');
  if (!div || !receivedIds || receivedIds.length === 0) { if (div) div.innerHTML = ''; return; }

  var promises = receivedIds.map(function(uid) {
    return window.FirestoreDB.loadUserProfile(uid).then(function(profile) {
      if (profile) profile._docId = uid;
      return profile;
    });
  });

  Promise.all(promises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) { div.innerHTML = ''; return; }

    var html = '<div style="margin-bottom: 1.25rem;">' +
      '<div style="font-weight: 600; font-size: 0.9rem; color: #f59e0b; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Convites Pendentes</div>';

    profiles.forEach(function(u) {
      var uid = u._docId;
      var photo = u.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var name = u.displayName || 'Usuário';

      html += '<div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; border-left: 3px solid #f59e0b;">' +
        '<img src="' + photo + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">' +
        '<div style="flex: 1; min-width: 0;">' +
          '<span style="font-weight: 600; color: var(--text-bright); font-size: 0.9rem;">' + name + '</span>' +
          '<div style="font-size: 0.75rem; color: var(--text-muted);">quer ser seu amigo(a)</div>' +
        '</div>' +
        '<div style="display: flex; gap: 6px; flex-shrink: 0;">' +
          '<button class="btn btn-sm" style="background: var(--success-color); color: #fff; border: none; padding: 5px 14px; font-weight: 600; border-radius: 8px; font-size: 0.75rem;" onclick="_acceptFriend(\'' + uid + '\')">Aceitar</button>' +
          '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); padding: 5px 14px; border-radius: 8px; font-size: 0.75rem;" onclick="_rejectFriend(\'' + uid + '\')">Recusar</button>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    div.innerHTML = html;
  });
}

// ---- My friends (card grid, sorted by interaction) ----
function _renderMyFriends(myUid, friendIds) {
  var div = document.getElementById('explore-friends');
  if (!div || !friendIds || friendIds.length === 0) {
    if (div) div.innerHTML = '';
    return;
  }

  div.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Carregando amigos...</div>';

  var promises = friendIds.map(function(uid) {
    return window.FirestoreDB.loadUserProfile(uid).then(function(profile) {
      if (profile) profile._docId = uid;
      return profile;
    });
  });

  Promise.all(promises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) { div.innerHTML = ''; return; }

    // Sort by interaction: users with more shared tournaments first,
    // then by most recently updated profile
    var myTournaments = window.AppStore.tournaments || [];
    profiles.forEach(function(p) {
      var uid = p._docId;
      var sharedCount = 0;
      myTournaments.forEach(function(t) {
        var parts = Array.isArray(t.participants) ? t.participants : [];
        var hasMe = parts.some(function(pp) {
          var e = typeof pp === 'string' ? pp : (pp.email || '');
          return e === (window.AppStore.currentUser.email || '');
        });
        var hasFriend = parts.some(function(pp) {
          var e = typeof pp === 'string' ? pp : (pp.email || '');
          return e === (p.email || uid);
        });
        if (hasMe && hasFriend) sharedCount++;
      });
      p._sharedTournaments = sharedCount;
    });

    profiles.sort(function(a, b) {
      if (b._sharedTournaments !== a._sharedTournaments) return b._sharedTournaments - a._sharedTournaments;
      // Fallback: alphabetical
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    var html = '<div style="margin-bottom: 1.5rem;">' +
      '<div style="font-weight: 600; font-size: 0.9rem; color: var(--success-color); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Meus Amigos (' + profiles.length + ')</div>' +
      '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">';

    profiles.forEach(function(u) {
      var uid = u._docId;
      var unfriendBtn = '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); font-size: 0.7rem; padding: 4px 10px; border-radius: 6px; width: 100%; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.7\'" onclick="event.stopPropagation(); _removeFriend(\'' + uid + '\')">Desfazer amizade</button>';
      html += _userCardHtml(u, uid, unfriendBtn, true);
    });

    html += '</div></div>';
    div.innerHTML = html;
  });
}

// ---- Conhecidos (shared tournaments, not friends) ----
function _renderConhecidos(myUid, myFriends, mySent, myReceived) {
  var div = document.getElementById('explore-conhecidos');
  if (!div) return;

  var myEmail = (window.AppStore.currentUser && window.AppStore.currentUser.email) || '';
  var tournaments = window.AppStore.tournaments || [];

  // Find all users who share tournaments with me
  var conhecidosMap = {}; // uid -> { email, sharedCount, tournamentNames }

  tournaments.forEach(function(t) {
    var parts = Array.isArray(t.participants) ? t.participants : [];
    // Check if I'm in this tournament
    var imIn = parts.some(function(p) {
      var e = typeof p === 'string' ? p : (p.email || '');
      return e === myEmail;
    });
    if (!imIn) return;

    // Find other participants
    parts.forEach(function(p) {
      var email = typeof p === 'string' ? p : (p.email || '');
      var name = typeof p === 'string' ? p : (p.displayName || p.name || '');
      if (!email || email === myEmail) return;

      if (!conhecidosMap[email]) {
        conhecidosMap[email] = { email: email, displayName: name, sharedCount: 0, tournamentNames: [] };
      }
      conhecidosMap[email].sharedCount++;
      if (t.name && conhecidosMap[email].tournamentNames.length < 3) {
        conhecidosMap[email].tournamentNames.push(t.name);
      }
    });
  });

  // Remove friends and self from conhecidos
  var conhecidos = Object.values(conhecidosMap).filter(function(c) {
    return myFriends.indexOf(c.email) === -1;
  });

  // Store conhecidos emails for search filtering
  window._conhecidosEmails = conhecidos.map(function(c) { return c.email; });

  // Sort by shared tournament count (most interaction first)
  conhecidos.sort(function(a, b) { return b.sharedCount - a.sharedCount; });

  if (conhecidos.length === 0) {
    div.innerHTML = '';
    return;
  }

  // Try to load full profiles for richer display
  var profilePromises = conhecidos.map(function(c) {
    return window.FirestoreDB.db.collection('users')
      .where('email', '==', c.email)
      .limit(1)
      .get()
      .then(function(snap) {
        if (!snap.empty) {
          var data = snap.docs[0].data();
          data._docId = snap.docs[0].id;
          data._sharedCount = c.sharedCount;
          data._tournamentNames = c.tournamentNames;
          return data;
        }
        // Fallback: user not registered yet, use participant data
        return { _docId: c.email, displayName: c.displayName, email: c.email, _sharedCount: c.sharedCount, _tournamentNames: c.tournamentNames };
      })
      .catch(function() {
        return { _docId: c.email, displayName: c.displayName, email: c.email, _sharedCount: c.sharedCount, _tournamentNames: c.tournamentNames };
      });
  });

  Promise.all(profilePromises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) { div.innerHTML = ''; return; }

    // Re-sort after profile loading
    profiles.sort(function(a, b) { return (b._sharedCount || 0) - (a._sharedCount || 0); });

    var html = '<div style="margin-bottom: 1.5rem;">' +
      '<div style="font-weight: 600; font-size: 0.9rem; color: #f59e0b; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Conhecidos (' + profiles.length + ')</div>' +
      '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">';

    profiles.forEach(function(u) {
      var uid = u._docId || u.email;
      var isSent = mySent.indexOf(uid) !== -1;
      var isReceived = myReceived.indexOf(uid) !== -1;

      // Info line: shared tournaments
      var sharedText = (u._sharedCount || 0) + ' torneio' + ((u._sharedCount || 0) !== 1 ? 's' : '') + ' em comum';
      u._extraInfo = sharedText;

      var actionBtn = '';
      if (isSent) {
        actionBtn = '<span style="display: block; color: var(--text-muted); font-size: 0.7rem; font-weight: 500; padding: 4px 0;">Convite enviado</span>';
      } else if (isReceived) {
        actionBtn = '<div style="display: flex; gap: 4px; justify-content: center;">' +
          '<button class="btn btn-sm" style="background: var(--success-color); color: #fff; border: none; font-size: 0.7rem; padding: 4px 8px; border-radius: 6px;" onclick="event.stopPropagation(); _acceptFriend(\'' + uid + '\')">Aceitar</button>' +
          '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); font-size: 0.7rem; padding: 4px 8px; border-radius: 6px;" onclick="event.stopPropagation(); _rejectFriend(\'' + uid + '\')">Recusar</button>' +
        '</div>';
      } else {
        // Check if user accepts friend requests
        var canInvite = u.acceptFriendRequests !== false;
        if (canInvite) {
          actionBtn = '<button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; border: none; font-size: 0.75rem; font-weight: 600; padding: 5px 12px; border-radius: 8px; width: 100%;" onclick="event.stopPropagation(); _sendFriendRequest(\'' + uid + '\')">Convidar</button>';
        } else {
          actionBtn = '';
        }
      }

      // Custom card for conhecidos (amber/yellow tint)
      var photo = u.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var name = u.displayName || 'Usuário';

      html += '<div class="card" style="padding: 0.75rem; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; min-width: 0;">' +
        '<img src="' + photo + '" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2.5px solid rgba(245, 158, 11, 0.4);">' +
        '<div style="width: 100%; min-width: 0; overflow: hidden;">' +
          '<div style="font-weight: 600; color: var(--text-bright); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + name + '</div>' +
          '<div style="font-size: 0.65rem; color: #f59e0b; margin-top: 2px;">' + sharedText + '</div>' +
        '</div>' +
        (actionBtn ? '<div style="margin-top: auto; width: 100%;">' + actionBtn + '</div>' : '') +
      '</div>';
    });

    html += '</div></div>';
    div.innerHTML = html;
  });
}

// ---- Global action functions ----

window._sendFriendRequest = function(toUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  if (!cu.friendRequestsSent) cu.friendRequestsSent = [];
  cu.friendRequestsSent.push(toUid);

  window.FirestoreDB.sendFriendRequest(myUid, toUid, {
    displayName: cu.displayName,
    photoURL: cu.photoURL,
    email: cu.email
  }).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification('Convite Enviado', 'Seu convite de amizade foi enviado!', 'success');
    }
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

window._acceptFriend = function(friendUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  if (!cu.friends) cu.friends = [];
  cu.friends.push(friendUid);
  cu.friendRequestsReceived = (cu.friendRequestsReceived || []).filter(function(id) { return id !== friendUid; });

  window.FirestoreDB.acceptFriendRequest(myUid, friendUid).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification('Amizade Aceita', 'Vocês agora são amigos!', 'success');
    }
    if (typeof _updateNotificationBadge === 'function') _updateNotificationBadge();
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

window._rejectFriend = function(friendUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  cu.friendRequestsReceived = (cu.friendRequestsReceived || []).filter(function(id) { return id !== friendUid; });

  window.FirestoreDB.rejectFriendRequest(myUid, friendUid).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification('Convite Recusado', 'O convite de amizade foi recusado.', 'info');
    }
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

window._removeFriend = function(friendUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  // Confirm before removing
  if (typeof showAlertDialog === 'function') {
    showAlertDialog('Desfazer Amizade', 'Tem certeza que deseja desfazer esta amizade?', function() {
      // Update local state
      cu.friends = (cu.friends || []).filter(function(id) { return id !== friendUid; });

      window.FirestoreDB.removeFriend(myUid, friendUid).then(function() {
        if (typeof showNotification !== 'undefined') {
          showNotification('Amizade Desfeita', 'A amizade foi removida.', 'info');
        }
        var container = document.getElementById('view-container');
        if (container) renderExplore(container);
      });
    }, { type: 'warning', confirmText: 'Sim, desfazer', cancelText: 'Cancelar' });
  } else {
    // Fallback without dialog
    cu.friends = (cu.friends || []).filter(function(id) { return id !== friendUid; });
    window.FirestoreDB.removeFriend(myUid, friendUid).then(function() {
      var container = document.getElementById('view-container');
      if (container) renderExplore(container);
    });
  }
};
