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
    '<div style="max-width: 700px; margin: 0 auto;">' +
      '<h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--text-bright);">Explorar Comunidade</h2>' +

      // Pending friend requests section
      '<div id="explore-pending" style="margin-bottom: 1.5rem;"></div>' +

      // Search bar
      '<div style="display: flex; gap: 10px; margin-bottom: 1.5rem;">' +
        '<input type="text" id="explore-search-input" class="form-control" placeholder="Buscar por nome, e-mail, cidade ou esporte..." style="flex: 1;">' +
        '<button class="btn btn-primary" id="explore-search-btn" style="white-space: nowrap; padding: 0 1.25rem;">Buscar</button>' +
      '</div>' +

      // Results
      '<div id="explore-results" style="display: flex; flex-direction: column; gap: 12px;"></div>' +

      // My friends section
      '<div id="explore-friends" style="margin-top: 2rem;"></div>' +
    '</div>';

  // Render pending friend requests
  _renderPendingRequests(myUid, myReceived);

  // Render my friends list
  _renderMyFriends(myUid, myFriends);

  // Search handler
  var searchInput = document.getElementById('explore-search-input');
  var searchBtn = document.getElementById('explore-search-btn');

  function doSearch() {
    var query = searchInput.value.trim();
    _performUserSearch(query, myUid, myFriends, mySent, myReceived);
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSearch();
  });

  // Auto-load all users on first render
  _performUserSearch('', myUid, myFriends, mySent, myReceived);
}

function _performUserSearch(query, myUid, myFriends, mySent, myReceived) {
  var resultsDiv = document.getElementById('explore-results');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Buscando...</div>';

  window.FirestoreDB.searchUsers(query).then(function(users) {
    // Filter out self
    users = users.filter(function(u) {
      var uid = u._docId || u.uid || u.email;
      return uid !== myUid;
    });

    if (users.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">' +
        (query ? 'Nenhum usuário encontrado para "' + query + '"' : 'Nenhum usuário disponível no momento') +
      '</div>';
      return;
    }

    var html = '';
    users.forEach(function(u) {
      var uid = u._docId || u.uid || u.email;
      var photo = u.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var name = u.displayName || 'Usuário';
      var isFriend = myFriends.indexOf(uid) !== -1;
      var isSent = mySent.indexOf(uid) !== -1;
      var isReceived = myReceived.indexOf(uid) !== -1;

      var infoChips = [];
      if (u.city) infoChips.push(u.city);
      if (u.preferredSports) infoChips.push(u.preferredSports);
      if (u.age) infoChips.push(u.age + ' anos');

      var actionBtn = '';
      if (isFriend) {
        actionBtn = '<span style="color: var(--success-color); font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Amigo(a)' +
        '</span>';
      } else if (isSent) {
        actionBtn = '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500;">Convite enviado</span>';
      } else if (isReceived) {
        actionBtn = '<div style="display: flex; gap: 6px;">' +
          '<button class="btn btn-sm" style="background: var(--success-color); color: #fff; border: none; font-size: 0.75rem; padding: 4px 12px;" onclick="event.stopPropagation(); _acceptFriend(\'' + uid + '\')">Aceitar</button>' +
          '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); font-size: 0.75rem; padding: 4px 12px;" onclick="event.stopPropagation(); _rejectFriend(\'' + uid + '\')">Recusar</button>' +
        '</div>';
      } else {
        actionBtn = '<button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, var(--primary-color) 0%, #1d4ed8 100%); color: #fff; border: none; font-size: 0.8rem; font-weight: 600; padding: 6px 16px;" onclick="event.stopPropagation(); _sendFriendRequest(\'' + uid + '\')">Adicionar</button>';
      }

      html += '<div class="card" style="padding: 1rem; display: flex; align-items: center; gap: 12px; flex-wrap: nowrap;">' +
        '<img src="' + photo + '" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--border-color);">' +
        '<div style="flex: 1; min-width: 0;">' +
          '<div style="font-weight: 600; color: var(--text-bright); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + name + '</div>' +
          (infoChips.length > 0 ? '<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">' + infoChips.join(' · ') + '</div>' : '') +
        '</div>' +
        '<div style="flex-shrink: 0;">' + actionBtn + '</div>' +
      '</div>';
    });

    resultsDiv.innerHTML = html;
  }).catch(function(err) {
    resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger-color);">Erro ao buscar: ' + (err.message || err) + '</div>';
  });
}

function _renderPendingRequests(myUid, receivedIds) {
  var div = document.getElementById('explore-pending');
  if (!div || !receivedIds || receivedIds.length === 0) return;

  // Load each pending user's profile
  var promises = receivedIds.map(function(uid) {
    return window.FirestoreDB.loadUserProfile(uid).then(function(profile) {
      if (profile) profile._docId = uid;
      return profile;
    });
  });

  Promise.all(promises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) return;

    var html = '<div style="margin-bottom: 0.75rem; font-weight: 600; font-size: 0.95rem; color: var(--text-bright);">Convites de Amizade Pendentes</div>';
    profiles.forEach(function(u) {
      var uid = u._docId;
      var photo = u.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var name = u.displayName || 'Usuário';

      html += '<div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; border-left: 3px solid var(--primary-color);">' +
        '<img src="' + photo + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">' +
        '<div style="flex: 1; min-width: 0;">' +
          '<span style="font-weight: 600; color: var(--text-bright);">' + name + '</span>' +
          '<span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 6px;">quer ser seu amigo(a)</span>' +
        '</div>' +
        '<div style="display: flex; gap: 6px; flex-shrink: 0;">' +
          '<button class="btn btn-sm" style="background: var(--success-color); color: #fff; border: none; padding: 4px 14px; font-weight: 600;" onclick="_acceptFriend(\'' + uid + '\')">Aceitar</button>' +
          '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); padding: 4px 14px;" onclick="_rejectFriend(\'' + uid + '\')">Recusar</button>' +
        '</div>' +
      '</div>';
    });

    div.innerHTML = html;
  });
}

function _renderMyFriends(myUid, friendIds) {
  var div = document.getElementById('explore-friends');
  if (!div || !friendIds || friendIds.length === 0) {
    if (div) div.innerHTML = '';
    return;
  }

  var promises = friendIds.map(function(uid) {
    return window.FirestoreDB.loadUserProfile(uid).then(function(profile) {
      if (profile) profile._docId = uid;
      return profile;
    });
  });

  Promise.all(promises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) return;

    var html = '<div style="font-weight: 600; font-size: 0.95rem; color: var(--text-bright); margin-bottom: 0.75rem;">Meus Amigos (' + profiles.length + ')</div>';
    profiles.forEach(function(u) {
      var photo = u.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var name = u.displayName || 'Usuário';
      var infoChips = [];
      if (u.city) infoChips.push(u.city);
      if (u.preferredSports) infoChips.push(u.preferredSports);

      html += '<div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">' +
        '<img src="' + photo + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--success-color);">' +
        '<div style="flex: 1; min-width: 0;">' +
          '<div style="font-weight: 600; color: var(--text-bright); font-size: 0.9rem;">' + name + '</div>' +
          (infoChips.length > 0 ? '<div style="font-size: 0.75rem; color: var(--text-muted);">' + infoChips.join(' · ') + '</div>' : '') +
        '</div>' +
        '<span style="color: var(--success-color); font-size: 0.75rem; font-weight: 600; flex-shrink: 0;">Amigo(a)</span>' +
      '</div>';
    });

    div.innerHTML = html;
  });
}

// Global action functions
window._sendFriendRequest = function(toUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  // Update local state immediately
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
    // Re-render explore page
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

window._acceptFriend = function(friendUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  // Update local state
  if (!cu.friends) cu.friends = [];
  cu.friends.push(friendUid);
  cu.friendRequestsReceived = (cu.friendRequestsReceived || []).filter(function(id) { return id !== friendUid; });

  window.FirestoreDB.acceptFriendRequest(myUid, friendUid).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification('Amizade Aceita', 'Vocês agora são amigos!', 'success');
    }
    // Update notification badge
    if (typeof _updateNotificationBadge === 'function') _updateNotificationBadge();
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

window._rejectFriend = function(friendUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  // Update local state
  cu.friendRequestsReceived = (cu.friendRequestsReceived || []).filter(function(id) { return id !== friendUid; });

  window.FirestoreDB.rejectFriendRequest(myUid, friendUid).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification('Convite Recusado', 'O convite de amizade foi recusado.', 'info');
    }
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};
