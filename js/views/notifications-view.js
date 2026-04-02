// ========================================
// scoreplace.app — Notificações (View + Badge)
// ========================================

function renderNotifications(container) {
  var cu = window.AppStore.currentUser;
  if (!cu) {
    container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;">' +
      '<p style="color: var(--text-muted); font-size: 1.1rem;">Faça login para ver suas notificações</p>' +
      '<button class="btn btn-primary" onclick="if(typeof openModal===\'function\')openModal(\'modal-login\');" style="margin-top: 1rem;">Entrar</button>' +
    '</div>';
    return;
  }

  var uid = cu.uid || cu.email;

  container.innerHTML =
    '<div style="max-width: 700px; margin: 0 auto;">' +
      '<button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash=\'#dashboard\'" style="margin-bottom: 1rem; display: inline-flex; align-items: center; gap: 6px;">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>' +
        'Voltar' +
      '</button>' +
      '<h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--text-bright);">Notificações</h2>' +
      '<div id="notif-list" style="display: flex; flex-direction: column; gap: 10px;">' +
        '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Carregando...</div>' +
      '</div>' +
    '</div>';

  window.FirestoreDB.getNotifications(uid, 50).then(function(notifs) {
    var listDiv = document.getElementById('notif-list');
    if (!listDiv) return;

    if (notifs.length === 0) {
      listDiv.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 1rem;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
        '<p>Nenhuma notificação no momento</p>' +
      '</div>';
      return;
    }

    var html = '';
    notifs.forEach(function(n) {
      var isUnread = !n.read;
      var icon = '🔔';
      var accentColor = 'var(--primary-color)';

      if (n.type === 'friend_request') {
        icon = '👋';
        accentColor = '#f59e0b';
      } else if (n.type === 'friend_accepted') {
        icon = '🤝';
        accentColor = 'var(--success-color)';
      } else if (n.type === 'tournament_invite') {
        icon = '🏆';
        accentColor = 'var(--primary-color)';
      }

      var timeAgo = _timeAgo(n.createdAt);
      var unreadDot = isUnread ? '<div class="notif-unread-dot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary-color); flex-shrink: 0;"></div>' : '';

      var actionHtml = '';
      var safeFromUid = (n.fromUid || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
      var safeNotifId = (n._id || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
      var safeTournamentId = (n.tournamentId || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
      if (n.type === 'friend_request' && isUnread) {
        actionHtml = '<div style="display: flex; gap: 6px; margin-top: 8px;">' +
          '<button class="btn btn-sm" style="background: var(--success-color); color: #fff; border: none; padding: 4px 14px; font-size: 0.75rem; font-weight: 600;" onclick="event.stopPropagation(); _acceptFriend(\'' + safeFromUid + '\'); _markNotifRead(\'' + safeNotifId + '\')">Aceitar</button>' +
          '<button class="btn btn-sm" style="background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); padding: 4px 14px; font-size: 0.75rem;" onclick="event.stopPropagation(); _rejectFriend(\'' + safeFromUid + '\'); _markNotifRead(\'' + safeNotifId + '\')">Recusar</button>' +
        '</div>';
      } else if (n.type === 'tournament_invite' && n.tournamentId) {
        actionHtml = '<div style="display: flex; gap: 6px; margin-top: 8px;">' +
          '<button class="btn btn-sm" style="background: var(--primary-color); color: #fff; border: none; padding: 4px 14px; font-size: 0.75rem; font-weight: 600;" onclick="event.stopPropagation(); window.location.hash=\'#tournament/' + safeTournamentId + '\'; _markNotifRead(\'' + safeNotifId + '\')">Ver Torneio</button>' +
        '</div>';
      }

      // Escape HTML in message to prevent XSS
      var safeMessage = (n.message || 'Notificação').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

      var safeNotifIdOnclick = (n._id || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
      html += '<div class="card" style="padding: 1rem; display: flex; align-items: flex-start; gap: 12px; cursor: pointer; ' +
        (isUnread ? 'border-left: 3px solid ' + accentColor + '; background: rgba(37, 99, 235, 0.05);' : 'opacity: 0.7;') + '" ' +
        (isUnread ? 'onclick="_markNotifRead(\'' + safeNotifIdOnclick + '\', this)"' : '') + '>' +
        '<div style="font-size: 1.5rem; flex-shrink: 0; line-height: 1;">' + icon + '</div>' +
        '<div style="flex: 1; min-width: 0;">' +
          '<div style="font-size: 0.9rem; color: var(--text-bright); font-weight: ' + (isUnread ? '600' : '400') + ';">' + safeMessage + '</div>' +
          '<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">' + timeAgo + '</div>' +
          actionHtml +
        '</div>' +
        unreadDot +
      '</div>';
    });

    listDiv.innerHTML = html;

    // Mark all as read after viewing
    notifs.forEach(function(n) {
      if (!n.read) {
        window.FirestoreDB.markNotificationRead(uid, n._id);
      }
    });
    // Update badge after a delay
    setTimeout(function() { _updateNotificationBadge(); }, 1000);
  });
}

// Helper: relative time
function _timeAgo(dateStr) {
  if (!dateStr) return '';
  var now = new Date();
  var date = new Date(dateStr);
  var diffMs = now - date;
  var diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return diffMin + ' min atrás';
  var diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + 'h atrás';
  var diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ontem';
  if (diffD < 30) return diffD + ' dias atrás';
  return date.toLocaleDateString('pt-BR');
}

// Mark a single notification as read + update UI
window._markNotifRead = function(notifId, el) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var uid = cu.uid || cu.email;
  window.FirestoreDB.markNotificationRead(uid, notifId);
  if (el) {
    el.style.borderLeft = 'none';
    el.style.background = 'transparent';
    el.style.opacity = '0.7';
    var dot = el.querySelector('.notif-unread-dot');
    if (dot) dot.style.display = 'none';
  }
};

// Update the notification badge count in the header + show banner
window._updateNotificationBadge = function() {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var uid = cu.uid || cu.email;
  window.FirestoreDB.getUnreadNotificationCount(uid).then(function(count) {
    // Update the small badge on the bell icon
    var badge = document.getElementById('notif-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Show/hide prominent notification banner below header
    var banner = document.getElementById('notif-banner');
    if (!banner && count > 0) {
      // Create banner element below header
      banner = document.createElement('div');
      banner.id = 'notif-banner';
      banner.style.cssText = 'background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:8px 16px;text-align:center;font-size:0.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(239,68,68,0.3);z-index:99;';
      banner.onclick = function() { window.location.hash = '#notifications'; };
      var header = document.querySelector('header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(banner, header.nextSibling);
      }
    }
    if (banner) {
      if (count > 0) {
        var plural = count === 1 ? 'nova notificação' : 'novas notificações';
        banner.innerHTML = '<span style="font-size:1rem;">🔔</span> Você tem ' + count + ' ' + plural + ' — toque para ver';
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }
  });
};
