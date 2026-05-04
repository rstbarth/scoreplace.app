// ========================================
// scoreplace.app — Explorar (Buscar Usuários + Amizades)
// ========================================

function renderExplore(container) {
  var _t = window._t || function(k) { return k; };
  var cu = window.AppStore.currentUser;
  if (!cu) {
    container.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;">' +
      '<p style="color: var(--text-muted); font-size: 1.1rem;">' + _t('explore.loginRequired') + '</p>' +
      '<button class="btn btn-primary" onclick="if(typeof openModal===\'function\')openModal(\'modal-login\');" style="margin-top: 1rem;">' + _t('explore.login') + '</button>' +
    '</div>';
    return;
  }

  var myUid = cu.uid || cu.email;
  var myFriends = cu.friends || [];
  var mySent = cu.friendRequestsSent || [];
  var myReceived = cu.friendRequestsReceived || [];

  container.innerHTML =
    window._renderBackHeader({ href: '#dashboard' }) +
    '<div style="max-width: 800px; margin: 0 auto;">' +
      '<h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 1.25rem; color: var(--text-bright);">' + _t('explore.title') + '</h2>' +

      // Received friend requests (need my response)
      '<div id="explore-pending"></div>' +

      // My friends section
      '<div id="explore-friends"></div>' +

      // Sent friend requests (waiting on them)
      '<div id="explore-sent"></div>' +

      // Search bar
      '<div style="display: flex; gap: 8px; margin-bottom: 1.25rem; align-items: center;">' +
        '<input type="text" id="explore-search-input" class="form-control" placeholder="' + _t('explore.searchPlaceholder') + '" style="flex: 1; box-sizing: border-box;">' +
        '<button class="btn btn-outline btn-sm" id="explore-search-btn" style="padding: 8px 14px; white-space: nowrap;">🔍 ' + _t('explore.search') + '</button>' +
      '</div>' +

      // Unified non-friend, non-invited results
      '<div id="explore-results"></div>' +
    '</div>';

  // Render received friend requests, my friends, and sent requests
  _renderPendingRequests(myUid, myReceived);
  _renderMyFriends(myUid, myFriends);
  _renderSentRequests(myUid, mySent);

  // Search handler — live filter as user types (debounced)
  var searchInput = document.getElementById('explore-search-input');
  var searchBtn = document.getElementById('explore-search-btn');
  var _searchTimer = null;

  function doSearch() {
    _performUserSearch(searchInput.value.trim(), myUid, myFriends, mySent, myReceived);
  }

  function scheduleSearch(delayMs) {
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(doSearch, typeof delayMs === 'number' ? delayMs : 250);
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('input', function() { scheduleSearch(250); });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      if (_searchTimer) clearTimeout(_searchTimer);
      doSearch();
    }
  });

  // Auto-load non-friend users
  _performUserSearch('', myUid, myFriends, mySent, myReceived);
}

// ---- Helper: check if a participant entry matches a given user (by email OR displayName) ----
function _participantMatchesUser(p, email, displayName) {
  if (typeof p === 'string') {
    // Post-draw: participant is a team string like "Rodrigo Barth / Eduardo Mange"
    if (email && p === email) return true;
    if (displayName && p.toLowerCase().indexOf(displayName.toLowerCase()) !== -1) return true;
    return false;
  }
  // Object with email/displayName/name fields
  var pEmail = p.email || '';
  var pName = p.displayName || p.name || '';
  if (email && pEmail === email) return true;
  if (displayName && pName && pName.toLowerCase().indexOf(displayName.toLowerCase()) !== -1) return true;
  // Also check if the whole string representation contains the displayName (for team names stored in name)
  if (displayName && pEmail && pEmail.toLowerCase().indexOf(displayName.toLowerCase()) !== -1) return true;
  return false;
}

// ---- User card HTML builder ----
function _isRealPhoto(url) {
  return url && url.indexOf('dicebear.com') === -1 && url.indexOf('placeholder') === -1;
}

// Compact card for the "Meus Amigos" section only. Drops the extra action
// button area in favor of a tiny ✕ at top-right for unfriending; shows just
// photo + name + city (when different from mine) + preferred sport — no age.
// Falls back to the larger _userCardHtml for other sections.
function _friendCompactCardHtml(u, uid) {
  var cu = window.AppStore.currentUser || {};
  var name = u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário');
  var avatarSeed = encodeURIComponent(name || uid || 'User');
  var initialsUrl = 'https://api.dicebear.com/9.x/initials/svg?seed=' + avatarSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
  var photo = _isRealPhoto(u.photoURL) ? u.photoURL : initialsUrl;
  var fallbackPhoto = initialsUrl;

  // City: only show if present AND different from mine (case/accent-insensitive).
  var subtitleChips = [];
  var myCity = (cu.city || '').toString().trim().toLowerCase();
  var theirCity = (u.city || '').toString().trim();
  if (theirCity && theirCity.toLowerCase() !== myCity) subtitleChips.push(theirCity);
  // Sport: first preferred sport (normalized, no emoji).
  if (u.preferredSports) {
    var firstSport = String(u.preferredSports).split(/[,;]/)[0].trim();
    var clean = window.PresenceDB && typeof window.PresenceDB.normalizeSport === 'function'
      ? window.PresenceDB.normalizeSport(firstSport)
      : firstSport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim();
    if (clean) subtitleChips.push(clean);
  }
  var subtitle = subtitleChips.join(' · ');

  var safeUid = (uid || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  return '<div class="card hover-lift" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(34,197,94,0.06);border:1px solid var(--success-color);border-radius:10px;min-width:0;">' +
    '<img src="' + photo + '" onerror="this.onerror=null;this.src=\'' + fallbackPhoto + '\'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid var(--success-color);flex-shrink:0;">' +
    '<div style="flex:1;min-width:0;">' +
      '<div style="font-weight:700;color:var(--text-bright);font-size:0.82rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(name) + '</div>' +
      (subtitle ? '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(subtitle) + '</div>' : '') +
    '</div>' +
    '<button type="button" title="Desfazer amizade" onclick="event.stopPropagation(); _removeFriend(\'' + safeUid + '\')" ' +
      'onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.5\'" ' +
      'style="border:none;background:transparent;color:var(--text-muted);font-size:0.88rem;cursor:pointer;line-height:1;padding:2px 4px;opacity:0.5;flex-shrink:0;">✕</button>' +
  '</div>';
}

function _userCardHtml(u, uid, actionHtml, isFriend) {
  var name = u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário');
  var avatarSeed = encodeURIComponent(name || uid || 'User');
  var initialsUrl = 'https://api.dicebear.com/9.x/initials/svg?seed=' + avatarSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
  var photo = _isRealPhoto(u.photoURL) ? u.photoURL : initialsUrl;
  var fallbackPhoto = initialsUrl;
  var infoChips = [];
  if (u.city) infoChips.push(u.city);
  // preferredSports: aceita array (forma moderna) ou string CSV (legacy).
  if (u.preferredSports) {
    var _sportsStr = Array.isArray(u.preferredSports)
      ? u.preferredSports.join(', ')
      : String(u.preferredSports);
    if (_sportsStr) infoChips.push(_sportsStr);
  }
  // age deliberately omitted — never show.

  var borderColor = isFriend ? 'var(--success-color)' : 'var(--border-color)';
  var bgTint = isFriend ? 'rgba(34, 197, 94, 0.06)' : 'transparent';

  return '<div class="card" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:' + bgTint + ';border:1px solid ' + borderColor + ';border-radius:10px;min-width:0;">' +
    '<img src="' + photo + '" onerror="this.onerror=null;this.src=\'' + fallbackPhoto + '\'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid ' + borderColor + ';flex-shrink:0;">' +
    '<div style="flex:1;min-width:0;">' +
      '<div style="font-weight:700;color:var(--text-bright);font-size:0.82rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(name) + '</div>' +
      (infoChips.length > 0 ? '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + infoChips.join(' · ') + '</div>' : '') +
    '</div>' +
    '<div style="flex-shrink:0;">' + actionHtml + '</div>' +
  '</div>';
}

// ---- Sort helpers for OUTROS USUÁRIOS ----
function _sortOtrosArray(arr, mode) {
  if (mode === 'alpha-asc') {
    arr.sort(function(a, b) {
      return ((a.displayName || a.email || '')).localeCompare((b.displayName || b.email || ''), 'pt-BR', { sensitivity: 'base' });
    });
  } else if (mode === 'alpha-desc') {
    arr.sort(function(a, b) {
      return ((b.displayName || b.email || '')).localeCompare((a.displayName || a.email || ''), 'pt-BR', { sensitivity: 'base' });
    });
  } else if (mode === 'date-asc') {
    arr.sort(function(a, b) {
      return (a._latestTs || 0) - (b._latestTs || 0);
    });
  } else {
    // 'date-desc' — most recent encounter / profile activity first
    arr.sort(function(a, b) {
      return (b._latestTs || 0) - (a._latestTs || 0);
    });
  }
}

window._toggleOtrosSort = function(dimension) {
  var current = window._otrosSortMode || 'date-desc';
  var parts = current.split('-');
  var currentDim = parts[0];
  var currentDir = parts[1] || 'desc';
  var newMode;
  if (currentDim === dimension) {
    newMode = dimension + '-' + (currentDir === 'asc' ? 'desc' : 'asc');
  } else {
    newMode = dimension + '-' + (dimension === 'date' ? 'desc' : 'asc');
  }
  window._otrosSortMode = newMode;
  var users = window._otrosUsers;
  var resultsDiv = document.getElementById('explore-results');
  if (!users || !resultsDiv) return;
  _sortOtrosArray(users, newMode);
  _renderOtrosCards(resultsDiv, users);
};

function _computeSharedInfo(user, myEmail, myName) {
  var email = user.email || '';
  var name = user.displayName || '';
  var tournaments = window.AppStore.tournaments || [];
  var latest = 0;
  var count = 0;
  for (var i = 0; i < tournaments.length; i++) {
    var t = tournaments[i];
    var parts = Array.isArray(t.participants) ? t.participants : [];
    var hasMe = t.organizerEmail === myEmail || parts.some(function(p) {
      return _participantMatchesUser(p, myEmail, myName);
    });
    if (!hasMe) continue;
    var hasUser = parts.some(function(p) {
      return _participantMatchesUser(p, email, name);
    });
    if (!hasUser) continue;
    count++;
    var rawDate = t.startDate || t.createdAt || t.updatedAt;
    if (rawDate) {
      var parsed = new Date(rawDate).getTime();
      if (!isNaN(parsed) && parsed > latest) latest = parsed;
    }
  }
  return { count: count, latest: latest };
}

// ---- Search non-friend users ----
// Drop users the caller already has a relationship with so they don't appear
// twice (they're already in the friends / received / sent sections above).
function _dedupeAgainstRelationships(users, myUid, myFriends, mySent, myReceived) {
  var friendEmails = window._friendEmails || [];
  var friendNames = window._friendNames || [];
  return (users || []).filter(function(u) {
    var uid = u._docId || u.uid || u.email;
    var email = u.email || '';
    var name = u.displayName || '';
    if (uid === myUid) return false;
    if (myFriends.indexOf(uid) !== -1) return false;
    if (email && myFriends.indexOf(email) !== -1) return false;
    if (email && friendEmails.indexOf(email) !== -1) return false;
    if (name && friendNames.indexOf(name) !== -1) return false;
    if (mySent.indexOf(uid) !== -1) return false;
    if (email && mySent.indexOf(email) !== -1) return false;
    if (myReceived.indexOf(uid) !== -1) return false;
    if (email && myReceived.indexOf(email) !== -1) return false;
    return true;
  });
}

// Shared renderer for the "recently active" empty-state path. Enriches
// timestamps + shared-tournament info the same way the search path does so
// sort and card rendering work identically. Appends an "Ampliar busca" button
// at the bottom when showing the recent-users default so the user can widen
// the time window without retyping.
function _renderSearchResults(resultsDiv, users, query, recentDays) {
  var _t = window._t || function(k) { return k; };
  if (users.length === 0) {
    var emptyMsg = recentDays
      ? 'Nenhum usuário nos últimos ' + recentDays + ' dias.'
      : _t('explore.noUsers');
    resultsDiv.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">' + emptyMsg + '</div>' +
      _renderExpandButton(recentDays);
    return;
  }
  var cu = window.AppStore.currentUser || {};
  var _myEmail = cu.email || '';
  var _myName = cu.displayName || '';
  users.forEach(function(u) {
    var shareInfo = _computeSharedInfo(u, _myEmail, _myName);
    u._sharedCount = shareInfo.count;
    if (shareInfo.latest > 0) {
      u._latestTs = shareInfo.latest;
      u._hasShared = true;
    } else {
      var ts = 0;
      var raw = u.updatedAt || u.createdAt || u.lastSeenAt;
      if (raw) { var parsed = new Date(raw).getTime(); if (!isNaN(parsed)) ts = parsed; }
      u._latestTs = ts;
      u._hasShared = false;
    }
  });
  var sortMode = window._otrosSortMode || 'date-desc';
  _sortOtrosArray(users, sortMode);
  window._otrosUsers = users;
  _renderOtrosCards(resultsDiv, users);
  if (recentDays) {
    // Append the expand CTA below the rendered grid so it's easy to find.
    var btnHtml = _renderExpandButton(recentDays);
    if (btnHtml) resultsDiv.insertAdjacentHTML('beforeend', btnHtml);
  }
}

// Button that widens the recent-users window (7 → 30 → 90 → ∞). Hides once
// we already fetched without a cutoff (nothing more to expand to).
function _renderExpandButton(currentDays) {
  if (!currentDays) return '';
  var next = currentDays < 30 ? 30 : (currentDays < 90 ? 90 : 365);
  var label = currentDays < 30 ? 'Ampliar para 30 dias'
    : currentDays < 90 ? 'Ampliar para 90 dias'
    : 'Ampliar para o ano todo';
  return '<div style="text-align:center;margin-top:1rem;">' +
    '<button class="btn btn-outline btn-sm hover-lift" onclick="window._exploreExpandRecent(' + next + ')" style="font-size:0.82rem;padding:8px 18px;">🔎 ' + label + '</button>' +
  '</div>';
}

window._exploreExpandRecent = function(days) {
  window._exploreRecentDays = days;
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;
  var input = document.getElementById('explore-search-input');
  var q = input ? input.value.trim() : '';
  _performUserSearch(q, myUid, cu.friends || [], cu.friendRequestsSent || [], cu.friendRequestsReceived || []);
};

function _performUserSearch(query, myUid, myFriends, mySent, myReceived) {
  var resultsDiv = document.getElementById('explore-results');
  if (!resultsDiv) return;
  var _t = window._t || function(k) { return k; };
  resultsDiv.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">' + _t('explore.searching') + '</div>';

  // Empty search box — lean on "recently active users" so the page never feels
  // like a dead-end. User can expand the window via the button rendered below.
  var q = String(query || '').trim();
  if (!q) {
    var days = window._exploreRecentDays || 7;
    window.FirestoreDB.listRecentUsers(days, 30).then(function(users) {
      users = _dedupeAgainstRelationships(users, myUid, myFriends, mySent, myReceived);
      _renderSearchResults(resultsDiv, users, '', days);
    }).catch(function(err) {
      resultsDiv.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--danger-color);">' + _t('explore.searchError') + ': ' + window._safeHtml(err.message || err.toString()) + '</div>';
    });
    return;
  }

  window.FirestoreDB.searchUsers(query).then(function(users) {
    users = _dedupeAgainstRelationships(users, myUid, myFriends, mySent, myReceived);

    if (users.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">' +
        _t('explore.noResultsFor') + ' "' + window._safeHtml(query) + '"' +
      '</div>';
      return;
    }

    // Compute timestamps + shared tournament count: latest shared tournament (preferred) or profile updatedAt/createdAt
    var cu = window.AppStore.currentUser || {};
    var _myEmail = cu.email || '';
    var _myName = cu.displayName || '';
    users.forEach(function(u) {
      var shareInfo = _computeSharedInfo(u, _myEmail, _myName);
      u._sharedCount = shareInfo.count;
      if (shareInfo.latest > 0) {
        u._latestTs = shareInfo.latest;
        u._hasShared = true;
      } else {
        var ts = 0;
        var raw = u.updatedAt || u.createdAt || u.lastSeenAt;
        if (raw) {
          var parsed = new Date(raw).getTime();
          if (!isNaN(parsed)) ts = parsed;
        }
        u._latestTs = ts;
        u._hasShared = false;
      }
    });

    var sortMode = window._otrosSortMode || 'date-desc';
    _sortOtrosArray(users, sortMode);
    window._otrosUsers = users;
    _renderOtrosCards(resultsDiv, users);
  }).catch(function(err) {
    resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger-color);">' + _t('explore.searchError') + ': ' + window._safeHtml(err.message || err.toString()) + '</div>';
  });
}

function _renderOtrosCards(resultsDiv, users) {
  var _t = window._t || function(k) { return k; };
  var cu = window.AppStore.currentUser || {};
  var mySent = cu.friendRequestsSent || [];
  var myReceived = cu.friendRequestsReceived || [];
  var sortMode = window._otrosSortMode || 'date-desc';
  var _sortParts = sortMode.split('-');
  var _sortDim = _sortParts[0];
  var _sortDir = _sortParts[1] || 'desc';

  var sortDateLabel = _t('explore.sortDate');
  if (sortDateLabel === 'explore.sortDate') sortDateLabel = 'Data';
  var sortAlphaLabel = _t('explore.sortAlpha');
  if (sortAlphaLabel === 'explore.sortAlpha') sortAlphaLabel = 'A–Z';

  function sortToggleBtn(dimension, label) {
    var active = _sortDim === dimension;
    var arrow = active ? (_sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅';
    var style = 'padding:5px 11px;border-radius:14px;font-size:0.72rem;font-weight:600;border:1px solid ' +
      (active ? 'var(--primary-color, #6366f1)' : 'rgba(148,163,184,0.3)') + ';background:' +
      (active ? 'rgba(99,102,241,0.2)' : 'transparent') + ';color:' +
      (active ? 'var(--text-bright, #e2e8f0)' : 'var(--text-muted)') + ';cursor:pointer;display:inline-flex;align-items:center;gap:2px;';
    return '<button onclick="window._toggleOtrosSort(\'' + dimension + '\')" style="' + style + '" title="' + label + '">' + label + arrow + '</button>';
  }

  var html = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom: 0.75rem;">' +
    '<div style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">' + _t('explore.otherUsers') + ' (' + users.length + ')</div>' +
    '<div style="display:flex;gap:6px;">' +
      sortToggleBtn('date', '📅 ' + sortDateLabel) +
      sortToggleBtn('alpha', sortAlphaLabel) +
    '</div>' +
  '</div>';

  // Action-button builder reused by both grouping paths
  function _actionBtnFor(u) {
    var uid = u._docId || u.uid || u.email;
    var isSent = mySent.indexOf(uid) !== -1;
    var isReceived = myReceived.indexOf(uid) !== -1;
    var safeUid = (uid || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
    var useWarning = u._hasShared;
    var btnClass = useWarning ? 'btn btn-warning btn-sm hover-lift' : 'btn btn-primary btn-sm hover-lift';
    if (isSent) {
      return '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window._spinButton(this, \'Cancelando...\'); _cancelFriendRequest(\'' + safeUid + '\')" title="' + _t('explore.cancelInviteTitle') + '">✉️ ✕</button>';
    } else if (isReceived) {
      return '<div style="display: flex; gap: 4px; justify-content: center;">' +
        '<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); window._spinButton(this, \'Aceitando...\'); _acceptFriend(\'' + safeUid + '\')">' + _t('explore.accept') + '</button>' +
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); window._spinButton(this, \'Rejeitando...\'); _rejectFriend(\'' + safeUid + '\')">' + _t('explore.reject') + '</button>' +
      '</div>';
    }
    return '<button class="' + btnClass + '" onclick="event.stopPropagation(); window._spinButton(this, \'Enviando...\'); _sendFriendRequest(\'' + safeUid + '\')">' + _t('explore.invite') + '</button>';
  }

  var _lang = (window._lang === 'en' ? 'en-US' : 'pt-BR');
  var _noDateLabel = _t('explore.noEncounterDate');
  if (_noDateLabel === 'explore.noEncounterDate') {
    _noDateLabel = (window._lang === 'en' ? 'No encounter date' : 'Sem encontros registrados');
  }

  function _dayKey(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _dayLabel(ts) {
    var d = new Date(ts);
    try {
      return d.toLocaleDateString(_lang, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) { return d.toISOString().slice(0,10); }
  }

  function _renderGroupHeader(label) {
    return '<div style="margin-top:14px;margin-bottom:8px;padding:6px 2px;font-size:0.78rem;font-weight:700;color:var(--text-bright);text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid var(--border-color);">' +
      '📅 ' + window._safeHtml(label) +
    '</div>';
  }
  function _renderCardGrid(groupUsers) {
    var inner = '<div style="display:flex;flex-direction:column;gap:6px;">';
    groupUsers.forEach(function(u) {
      var uid = u._docId || u.uid || u.email;
      inner += _userCardWithEncounterHtml(u, uid, _actionBtnFor(u));
    });
    inner += '</div>';
    return inner;
  }

  if (_sortDim === 'date') {
    // Group by day of latest encounter / profile activity. Order groups by the
    // chosen direction (desc = newest first, asc = oldest first). Users with no
    // timestamp collect in a trailing "sem data" group.
    var buckets = {};
    var bucketOrder = [];
    var noDate = [];
    users.forEach(function(u) {
      if (!u._latestTs) { noDate.push(u); return; }
      var k = _dayKey(u._latestTs);
      if (!k) { noDate.push(u); return; }
      if (!buckets[k]) {
        buckets[k] = { key: k, ts: u._latestTs, label: _dayLabel(u._latestTs), users: [] };
        bucketOrder.push(k);
      }
      buckets[k].users.push(u);
    });
    // Ensure each bucket tracks its max ts (for sort) — keep first seen ts as representative
    bucketOrder.sort(function(a, b) { return buckets[a].key < buckets[b].key ? -1 : (buckets[a].key > buckets[b].key ? 1 : 0); });
    if (_sortDir === 'desc') bucketOrder.reverse();

    bucketOrder.forEach(function(k) {
      var g = buckets[k];
      html += _renderGroupHeader(g.label);
      html += _renderCardGrid(g.users);
    });
    if (noDate.length > 0) {
      html += _renderGroupHeader(_noDateLabel);
      html += _renderCardGrid(noDate);
    }
  } else {
    // Alpha mode — no grouping, just one grid
    html += _renderCardGrid(users);
  }

  resultsDiv.innerHTML = html;
}

// Renders a user card that shows shared-tournament count + latest encounter date when applicable
function _userCardWithEncounterHtml(u, uid, actionHtml) {
  var _t = window._t || function(k){return k;};
  var name = u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário');
  var avatarSeed = encodeURIComponent(name || uid || 'User');
  var initialsUrl = 'https://api.dicebear.com/9.x/initials/svg?seed=' + avatarSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
  var photo = _isRealPhoto(u.photoURL) ? u.photoURL : initialsUrl;
  var fallbackPhoto = initialsUrl;

  var hasShared = !!u._hasShared;
  var borderColor = hasShared ? 'rgba(245,158,11,0.45)' : 'var(--border-color)';
  var bgTint = hasShared ? 'rgba(245, 158, 11, 0.06)' : 'transparent';
  var avatarBorder = hasShared ? 'rgba(245,158,11,0.45)' : 'var(--border-color)';

  var sharedLine = '';
  if (hasShared) {
    var sharedLabel = _t('explore.sharedTournaments');
    if (sharedLabel === 'explore.sharedTournaments') sharedLabel = 'torneio(s) em comum';
    sharedLine = '<div style="font-size: 0.65rem; color: #f59e0b; margin-top: 2px;">' + (u._sharedCount || 0) + ' ' + sharedLabel + '</div>';
  }

  // Date is shown as a group header above a batch of cards (see _renderOtrosCards),
  // so we don't repeat it on each individual card.
  return '<div class="card" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:' + bgTint + ';border:1px solid ' + borderColor + ';border-radius:10px;min-width:0;">' +
    '<img src="' + photo + '" onerror="this.onerror=null;this.src=\'' + fallbackPhoto + '\'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid ' + avatarBorder + ';flex-shrink:0;">' +
    '<div style="flex:1;min-width:0;">' +
      '<div style="font-weight:700;color:var(--text-bright);font-size:0.82rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(name) + '</div>' +
      sharedLine +
    '</div>' +
    '<div style="flex-shrink:0;">' + actionHtml + '</div>' +
  '</div>';
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

    var _tR = window._t || function(k){return k;};
    var receivedLabel = _tR('explore.receivedInvites');
    if (receivedLabel === 'explore.receivedInvites') receivedLabel = 'Convites Recebidos';
    var html = '<div style="margin-bottom: 1.25rem;">' +
      '<div style="font-weight: 600; font-size: 0.9rem; color: #f59e0b; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">' + receivedLabel + ' (' + profiles.length + ')</div>';

    profiles.forEach(function(u) {
      var uid = u._docId;
      var name = u.displayName || 'Usuário';
      var initialsUrlP = 'https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(name || uid || 'User') + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
      var photo = _isRealPhoto(u.photoURL) ? u.photoURL : initialsUrlP;
      var fallbackPhoto2 = initialsUrlP;

      var safeUidPending = (uid || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
      html += '<div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; border-left: 3px solid #f59e0b;">' +
        '<img src="' + photo + '" onerror="this.onerror=null;this.src=\'' + fallbackPhoto2 + '\'" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">' +
        '<div style="flex: 1; min-width: 0;">' +
          '<span style="font-weight: 600; color: var(--text-bright); font-size: 0.9rem;">' + window._safeHtml(name) + '</span>' +
          '<div style="font-size: 0.75rem; color: var(--text-muted);">' + (window._t || function(k){return k;})('explore.wantsToBeFriend') + '</div>' +
        '</div>' +
        '<div style="display: flex; gap: 6px; flex-shrink: 0;">' +
          '<button class="btn btn-success btn-sm" onclick="window._spinButton(this, \'Aceitando...\'); _acceptFriend(\'' + safeUidPending + '\')">' + (window._t || function(k){return k;})('explore.accept') + '</button>' +
          '<button class="btn btn-danger btn-sm" onclick="window._spinButton(this, \'Rejeitando...\'); _rejectFriend(\'' + safeUidPending + '\')">' + (window._t || function(k){return k;})('explore.reject') + '</button>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    div.innerHTML = html;
  });
}

// ---- Sent friend requests (outgoing, awaiting their response) ----
function _renderSentRequests(myUid, sentIds) {
  var div = document.getElementById('explore-sent');
  if (!div || !sentIds || sentIds.length === 0) { if (div) div.innerHTML = ''; return; }
  var _t = window._t || function(k){return k;};

  var promises = sentIds.map(function(uid) {
    return window.FirestoreDB.loadUserProfile(uid).then(function(profile) {
      if (profile) profile._docId = uid;
      return profile;
    }).catch(function() { return null; });
  });

  Promise.all(promises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) { div.innerHTML = ''; return; }

    // v1.0.15-beta: dedup por email. Bug reportado: convidei amigo, aparece
    // duplicado em "Convites Pendentes". Causa: destinatário tem 2 user docs
    // no Firestore — um keyed por email (legacy, pré-uid migration) e um
    // keyed por uid (atual). friendRequestsSent fica com ambos os ids; cada
    // um carrega um profile separado mas com mesmo email. Render mostra 2
    // cards.
    //
    // Fix: agrupa por email-lower. Pra cada email, escolhe o doc cujo
    // _docId NÃO parece email (preferindo o uid real). cancelBtn cancela
    // TODOS os uids do grupo de uma vez.
    var byEmail = {};
    profiles.forEach(function(p) {
      var email = (p.email || '').toLowerCase();
      if (!email) {
        // sem email — usa o _docId como chave única (não dedup)
        byEmail['_no_email_' + p._docId] = { profile: p, uids: [p._docId] };
        return;
      }
      if (!byEmail[email]) {
        byEmail[email] = { profile: p, uids: [p._docId] };
      } else {
        byEmail[email].uids.push(p._docId);
        // Prefere doc cujo _docId NÃO parece email (uid real é mais robusto)
        var existingLooksLikeEmail = (byEmail[email].profile._docId || '').indexOf('@') !== -1;
        var newLooksLikeEmail = (p._docId || '').indexOf('@') !== -1;
        if (existingLooksLikeEmail && !newLooksLikeEmail) {
          byEmail[email].profile = p;
        }
      }
    });
    var dedupedGroups = Object.keys(byEmail).map(function(k) { return byEmail[k]; });

    var titleLabel = _t('explore.sentPending');
    if (titleLabel === 'explore.sentPending') titleLabel = 'Convites Pendentes';

    var html = '<div style="margin-bottom: 1.5rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:12px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:0.75rem;">' +
        '<span style="font-size:1rem;">✉️</span>' +
        '<div style="font-weight:700;font-size:0.88rem;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;">' + titleLabel + ' (' + dedupedGroups.length + ')</div>' +
      '</div>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;">Aguardando resposta. Clique em ✕ no card para cancelar.</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;">';

    dedupedGroups.forEach(function(group) {
      var u = group.profile;
      var uid = u._docId;
      var safeUid = (uid || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
      // Cancel passa todos os uids do grupo (legacy + atual) pra cancelar
      // ambos de uma vez. Evita user clicar ✕ e ainda aparecer outro card.
      var allUidsArg = group.uids.map(function(u){ return "'" + u.replace(/'/g, "\\'").replace(/\\/g, "\\\\") + "'"; }).join(',');
      var cancelBtn = '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window._spinButton(this, \'Cancelando...\'); _cancelFriendRequestMulti([' + allUidsArg + '])" title="' + _t('explore.cancelInviteTitle') + '">✉️ ✕</button>';
      html += _userCardHtml(u, uid, cancelBtn, false);
    });

    html += '</div></div>';
    div.innerHTML = html;
  });
}

// ---- My friends (card grid, sorted by interaction) ----
function _renderMyFriends(myUid, friendIds) {
  var div = document.getElementById('explore-friends');
  if (!div || !friendIds || friendIds.length === 0) {
    if (div) div.innerHTML = '';
    window._friendEmails = [];
    window._friendNames = [];
    return Promise.resolve();
  }

  div.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">' + (window._t || function(k){return k;})('explore.loadingFriends') + '</div>';

  var promises = friendIds.map(function(uid) {
    return window.FirestoreDB.loadUserProfile(uid).then(function(profile) {
      if (profile) profile._docId = uid;
      return profile;
    });
  });

  return Promise.all(promises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });

    // Store friend emails and names for dedup in conhecidos/search
    window._friendEmails = [];
    window._friendNames = [];
    profiles.forEach(function(p) {
      if (p.email) window._friendEmails.push(p.email);
      if (p.displayName) window._friendNames.push(p.displayName);
    });

    if (profiles.length === 0) { div.innerHTML = ''; return; }

    // Sort by interaction: users with more shared tournaments first,
    // then by most recently updated profile
    var myTournaments = window.AppStore.tournaments || [];
    var _myEmail = (window.AppStore.currentUser && window.AppStore.currentUser.email) || '';
    var _myName = (window.AppStore.currentUser && window.AppStore.currentUser.displayName) || '';
    profiles.forEach(function(p) {
      var uid = p._docId;
      var sharedCount = 0;
      myTournaments.forEach(function(t) {
        var parts = Array.isArray(t.participants) ? t.participants : [];
        var hasMe = t.organizerEmail === _myEmail || parts.some(function(pp) {
          return _participantMatchesUser(pp, _myEmail, _myName);
        });
        var hasFriend = parts.some(function(pp) {
          return _participantMatchesUser(pp, p.email || '', p.displayName || '');
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
      '<div style="font-weight: 600; font-size: 0.9rem; color: var(--success-color); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">' + (window._t || function(k){return k;})('explore.myFriends') + ' (' + profiles.length + ')</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;">';

    profiles.forEach(function(u) {
      var uid = u._docId;
      html += _friendCompactCardHtml(u, uid);
    });

    html += '</div></div>';
    div.innerHTML = html;
  });
}

// ---- Conhecidos (shared tournaments, not friends) ----
function _renderConhecidos(myUid, myFriends, mySent, myReceived) {
  var div = document.getElementById('explore-conhecidos');
  if (!div) return;

  var cu = window.AppStore.currentUser;
  var myEmail = (cu && cu.email) || '';
  var myDisplayName = (cu && cu.displayName) || '';
  var tournaments = window.AppStore.tournaments || [];

  // Find all users who share tournaments with me
  var conhecidosMap = {}; // key -> { email, displayName, sharedCount, tournamentNames }

  tournaments.forEach(function(t) {
    var parts = Array.isArray(t.participants) ? t.participants : [];
    // Check if I'm in this tournament (by email OR displayName for post-draw team strings)
    var imIn = t.organizerEmail === myEmail || parts.some(function(p) {
      return _participantMatchesUser(p, myEmail, myDisplayName);
    });
    if (!imIn) return;

    // Find other participants — split team strings like "Player A / Player B" into individuals
    parts.forEach(function(p) {
      var individuals = [];
      if (typeof p === 'string') {
        // Could be a team string "Player A / Player B" or a single name/email
        var parts2 = p.split(' / ');
        parts2.forEach(function(name) {
          name = name.trim();
          if (name) individuals.push({ email: '', displayName: name });
        });
      } else {
        individuals.push({ email: p.email || '', displayName: p.displayName || p.name || '' });
      }

      individuals.forEach(function(ind) {
        var email = ind.email;
        var name = ind.displayName;
        // Skip myself
        if (email && email === myEmail) return;
        if (!email && name && myDisplayName && name.toLowerCase() === myDisplayName.toLowerCase()) return;
        // Need at least email or name to identify the person
        var key = email || name;
        if (!key) return;

        if (!conhecidosMap[key]) {
          conhecidosMap[key] = { email: email, displayName: name, sharedCount: 0, tournamentNames: [], latestTs: 0 };
        }
        conhecidosMap[key].sharedCount++;
        if (t.name && conhecidosMap[key].tournamentNames.length < 3) {
          conhecidosMap[key].tournamentNames.push(t.name);
        }
        var ts = 0;
        var rawDate = t.startDate || t.createdAt || t.updatedAt;
        if (rawDate) {
          var parsed = new Date(rawDate).getTime();
          if (!isNaN(parsed)) ts = parsed;
        }
        if (ts > conhecidosMap[key].latestTs) conhecidosMap[key].latestTs = ts;
      });
    });
  });

  // Build a set of friend identifiers (uid + email + displayName) for dedup
  var friendKeys = myFriends.slice(); // UIDs
  // Also store friends' emails/names loaded from _renderMyFriends
  if (window._friendEmails) {
    window._friendEmails.forEach(function(k) { if (k && friendKeys.indexOf(k) === -1) friendKeys.push(k); });
  }
  if (window._friendNames) {
    window._friendNames.forEach(function(k) { if (k && friendKeys.indexOf(k) === -1) friendKeys.push(k); });
  }

  // Remove friends, bots and self from conhecidos
  var conhecidos = Object.values(conhecidosMap).filter(function(c) {
    var key = c.email || c.displayName;
    // Filter out bots (names like "Bot 01", "Bot 02", etc.)
    var name = (c.displayName || '').trim();
    if (/^Bot\s+\d/i.test(name)) return false;
    // Filter out friends
    if (friendKeys.indexOf(c.email) !== -1) return false;
    if (friendKeys.indexOf(c.displayName) !== -1) return false;
    if (friendKeys.indexOf(key) !== -1) return false;
    return true;
  });

  // Store conhecidos keys for search filtering (email + displayName)
  window._conhecidosEmails = [];
  conhecidos.forEach(function(c) {
    if (c.email) window._conhecidosEmails.push(c.email);
    if (c.displayName) window._conhecidosEmails.push(c.displayName);
  });

  // Default sort: reverse chronological (most recent shared tournament first)
  var sortMode = window._conhecidosSortMode || 'recent';
  _sortConhecidosArray(conhecidos, sortMode);

  if (conhecidos.length === 0) {
    div.innerHTML = '';
    return;
  }

  // Try to load full profiles for richer display
  var profilePromises = conhecidos.map(function(c) {
    var fallback = { _docId: c.email || c.displayName, displayName: c.displayName, email: c.email, _sharedCount: c.sharedCount, _tournamentNames: c.tournamentNames };
    if (!window.FirestoreDB || !window.FirestoreDB.db) return Promise.resolve(fallback);
    // If we have an email, query by email; otherwise try displayName
    var queryField = c.email ? 'email' : 'displayName';
    var queryValue = c.email || c.displayName;
    if (!queryValue) return Promise.resolve(fallback);
    return window.FirestoreDB.db.collection('users')
      .where(queryField, '==', queryValue)
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
        return fallback;
      })
      .catch(function() {
        return fallback;
      });
  });

  Promise.all(profilePromises).then(function(profiles) {
    profiles = profiles.filter(function(p) { return p; });
    if (profiles.length === 0) { div.innerHTML = ''; return; }

    // Propagate latestTs from conhecidos data to loaded profiles
    profiles.forEach(function(p, i) {
      if (conhecidos[i]) p._latestTs = conhecidos[i].latestTs || 0;
    });

    // Cache for re-sort without refetch
    window._conhecidosProfiles = profiles;
    _renderConhecidosCards(div, profiles);
  });
}

function _sortConhecidosArray(arr, mode) {
  // Backward-compat legacy modes
  if (mode === 'alpha') mode = 'alpha-asc';
  else if (mode === 'oldest') mode = 'date-asc';
  else if (mode === 'recent') mode = 'date-desc';

  if (mode === 'alpha-asc') {
    arr.sort(function(a, b) {
      return (a.displayName || '').localeCompare(b.displayName || '', 'pt-BR', { sensitivity: 'base' });
    });
  } else if (mode === 'alpha-desc') {
    arr.sort(function(a, b) {
      return (b.displayName || '').localeCompare(a.displayName || '', 'pt-BR', { sensitivity: 'base' });
    });
  } else if (mode === 'date-asc') {
    arr.sort(function(a, b) {
      return (a.latestTs || a._latestTs || 0) - (b.latestTs || b._latestTs || 0);
    });
  } else {
    // 'date-desc' — reverse chronological by latest shared tournament
    arr.sort(function(a, b) {
      var tb = b.latestTs || b._latestTs || 0;
      var ta = a.latestTs || a._latestTs || 0;
      if (tb !== ta) return tb - ta;
      return (b.sharedCount || b._sharedCount || 0) - (a.sharedCount || a._sharedCount || 0);
    });
  }
}

window._toggleConhecidosSort = function(dimension) {
  var current = window._conhecidosSortMode || 'date-desc';
  // Normalize legacy modes
  if (current === 'alpha') current = 'alpha-asc';
  else if (current === 'oldest') current = 'date-asc';
  else if (current === 'recent') current = 'date-desc';

  var parts = current.split('-');
  var currentDim = parts[0];
  var currentDir = parts[1] || 'desc';

  var newMode;
  if (currentDim === dimension) {
    // Toggle direction
    newMode = dimension + '-' + (currentDir === 'asc' ? 'desc' : 'asc');
  } else {
    // Switch dimension with its natural default direction
    newMode = dimension + '-' + (dimension === 'date' ? 'desc' : 'asc');
  }
  window._conhecidosSortMode = newMode;
  var div = document.getElementById('explore-conhecidos');
  var profiles = window._conhecidosProfiles;
  if (!div || !profiles) return;
  _sortConhecidosArray(profiles, newMode);
  _renderConhecidosCards(div, profiles);
};

// Keep legacy entry point for any external callers
window._setConhecidosSort = function(mode) {
  window._conhecidosSortMode = mode;
  var div = document.getElementById('explore-conhecidos');
  var profiles = window._conhecidosProfiles;
  if (!div || !profiles) return;
  _sortConhecidosArray(profiles, mode);
  _renderConhecidosCards(div, profiles);
};

function _renderConhecidosCards(div, profiles) {
  var mySent = (window.AppStore.currentUser && window.AppStore.currentUser.friendRequestsSent) || [];
  var myReceived = (window.AppStore.currentUser && window.AppStore.currentUser.friendRequestsReceived) || [];
  var sortMode = window._conhecidosSortMode || 'date-desc';
  // Normalize legacy modes
  if (sortMode === 'alpha') sortMode = 'alpha-asc';
  else if (sortMode === 'oldest') sortMode = 'date-asc';
  else if (sortMode === 'recent') sortMode = 'date-desc';

  var _sortParts = sortMode.split('-');
  var _sortDim = _sortParts[0];
  var _sortDir = _sortParts[1] || 'desc';

  var _tLocal = window._t || function(k){return k;};
  var sortDateLabel = _tLocal('explore.sortDate');
  if (sortDateLabel === 'explore.sortDate') sortDateLabel = 'Data';
  var sortAlphaLabel = _tLocal('explore.sortAlpha');
  if (sortAlphaLabel === 'explore.sortAlpha') sortAlphaLabel = 'A–Z';

  function sortToggleBtn(dimension, label) {
    var active = _sortDim === dimension;
    var arrow = '';
    if (active) {
      arrow = _sortDir === 'asc' ? ' ↑' : ' ↓';
    } else {
      arrow = ' ⇅';
    }
    var style = 'padding:5px 11px;border-radius:14px;font-size:0.72rem;font-weight:600;border:1px solid ' +
      (active ? '#f59e0b' : 'rgba(245,158,11,0.3)') + ';background:' +
      (active ? 'rgba(245,158,11,0.25)' : 'transparent') + ';color:' +
      (active ? '#fbbf24' : 'var(--text-muted)') + ';cursor:pointer;display:inline-flex;align-items:center;gap:2px;';
    return '<button onclick="window._toggleConhecidosSort(\'' + dimension + '\')" style="' + style + '" title="' + label + '">' + label + arrow + '</button>';
  }

  var acquaintancesLabel = _tLocal('explore.acquaintances');
  if (acquaintancesLabel === 'explore.acquaintances') acquaintancesLabel = 'Conhecidos';

  var html = '<div style="margin-bottom: 1.5rem;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:0.75rem;">' +
      '<div style="font-weight: 600; font-size: 0.9rem; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px;">' + acquaintancesLabel + ' (' + profiles.length + ')</div>' +
      '<div style="display:flex;gap:6px;">' +
        sortToggleBtn('date', '📅 ' + sortDateLabel) +
        sortToggleBtn('alpha', sortAlphaLabel) +
      '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">';

  profiles.forEach(function(u) {
    var uid = u._docId || u.email;
    var isSent = mySent.indexOf(uid) !== -1;
    var isReceived = myReceived.indexOf(uid) !== -1;

    // Info line: shared tournaments
    var sharedText = (u._sharedCount || 0) + ' ' + _tLocal('explore.sharedTournaments');
    u._extraInfo = sharedText;

    var safeUidConhecido = (uid || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
    var actionBtn = '';
    if (isSent) {
      actionBtn = '<button class="btn btn-ghost btn-sm" style="width: 100%;" onclick="event.stopPropagation(); window._spinButton(this, \'Cancelando...\'); _cancelFriendRequest(\'' + safeUidConhecido + '\')" title="' + _tLocal('explore.cancelInviteTitle') + '">✉️ ' + _tLocal('explore.inviteSent') + ' ✕</button>';
    } else if (isReceived) {
      actionBtn = '<div style="display: flex; gap: 4px; justify-content: center;">' +
        '<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); window._spinButton(this, \'Aceitando...\'); _acceptFriend(\'' + safeUidConhecido + '\')">' + _tLocal('explore.accept') + '</button>' +
        '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); window._spinButton(this, \'Rejeitando...\'); _rejectFriend(\'' + safeUidConhecido + '\')">' + _tLocal('explore.reject') + '</button>' +
      '</div>';
    } else {
      // Check if user accepts friend requests
      var canInvite = u.acceptFriendRequests !== false;
      if (canInvite) {
        actionBtn = '<button class="btn btn-warning btn-sm hover-lift" style="width: 100%;" onclick="event.stopPropagation(); window._spinButton(this, \'Enviando...\'); _sendFriendRequest(\'' + safeUidConhecido + '\')">' + _tLocal('explore.invite') + '</button>';
      } else {
        actionBtn = '';
      }
    }

    // Custom card for conhecidos (amber/yellow tint)
    var name = u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário');
    var avatarSeed = encodeURIComponent(name || uid || 'User');
    var initialsUrlC = 'https://api.dicebear.com/9.x/initials/svg?seed=' + avatarSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
    var photo = _isRealPhoto(u.photoURL) ? u.photoURL : initialsUrlC;
    var fallbackPhotoC = initialsUrlC;

    var latestTs = u._latestTs || 0;
    var dateLabel = '';
    if (latestTs > 0) {
      var d = new Date(latestTs);
      if (!isNaN(d.getTime())) {
        try {
          dateLabel = d.toLocaleDateString((window._lang === 'en' ? 'en-US' : 'pt-BR'), { day: '2-digit', month: 'short', year: 'numeric' });
        } catch(e) { dateLabel = d.toISOString().slice(0, 10); }
      }
    }

    html += '<div class="card" style="padding: 0.75rem; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; min-width: 0;">' +
      '<img src="' + photo + '" onerror="this.onerror=null;this.src=\'' + fallbackPhotoC + '\'" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2.5px solid rgba(245, 158, 11, 0.4);">' +
      '<div style="width: 100%; min-width: 0; overflow: hidden;">' +
        '<div style="font-weight: 600; color: var(--text-bright); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + window._safeHtml(name) + '</div>' +
        '<div style="font-size: 0.65rem; color: #f59e0b; margin-top: 2px;">' + sharedText + '</div>' +
        (dateLabel ? '<div style="font-size: 0.62rem; color: var(--text-muted); margin-top: 2px;">' + dateLabel + '</div>' : '') +
      '</div>' +
      (actionBtn ? '<div style="margin-top: auto; width: 100%;">' + actionBtn + '</div>' : '') +
    '</div>';
  });

  html += '</div></div>';
  div.innerHTML = html;
}

// ---- Global action functions ----

window._cancelFriendRequest = function(toUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  // Update local state
  cu.friendRequestsSent = (cu.friendRequestsSent || []).filter(function(id) { return id !== toUid; });

  window.FirestoreDB.cancelFriendRequest(myUid, toUid).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification((window._t||function(k){return k;})('explore.notifInviteCancelled'), (window._t||function(k){return k;})('explore.notifInviteCancelledMsg'), 'info');
    }
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

// v1.0.15-beta: cancela múltiplos uids do mesmo grupo (legacy email-keyed +
// atual uid-keyed pra mesma pessoa). Chama cancelFriendRequest pra cada
// uid em paralelo. Atualiza estado local removendo todos. Notif única.
window._cancelFriendRequestMulti = function(toUids) {
  var cu = window.AppStore.currentUser;
  if (!cu || !Array.isArray(toUids) || toUids.length === 0) return;
  var myUid = cu.uid || cu.email;

  // Update local state — remove all uids in the group
  cu.friendRequestsSent = (cu.friendRequestsSent || []).filter(function(id) {
    return toUids.indexOf(id) === -1;
  });

  // Cancel all in parallel — Firestore arrayRemove é idempotente, sem risco
  var promises = toUids.map(function(toUid) {
    return window.FirestoreDB.cancelFriendRequest(myUid, toUid).catch(function(e) {
      console.warn('[cancelFriendRequest] failed for', toUid, e);
    });
  });

  Promise.all(promises).then(function() {
    if (typeof showNotification !== 'undefined') {
      showNotification((window._t||function(k){return k;})('explore.notifInviteCancelled'), (window._t||function(k){return k;})('explore.notifInviteCancelledMsg'), 'info');
    }
    var container = document.getElementById('view-container');
    if (container) renderExplore(container);
  });
};

window._sendFriendRequest = function(toUid) {
  var cu = window.AppStore.currentUser;
  if (!cu) return;
  var myUid = cu.uid || cu.email;

  window.FirestoreDB.sendFriendRequest(myUid, toUid, {
    displayName: cu.displayName,
    photoURL: cu.photoURL,
    email: cu.email
  }).then(function(result) {
    if (result === 'auto-accepted') {
      // Mutual request auto-accepted — update local state
      if (!cu.friends) cu.friends = [];
      if (cu.friends.indexOf(toUid) === -1) cu.friends.push(toUid);
      cu.friendRequestsSent = (cu.friendRequestsSent || []).filter(function(id) { return id !== toUid; });
      cu.friendRequestsReceived = (cu.friendRequestsReceived || []).filter(function(id) { return id !== toUid; });
      if (typeof showNotification !== 'undefined') {
        showNotification((window._t||function(k){return k;})('explore.notifFriendshipFormed'), (window._t||function(k){return k;})('explore.notifFriendshipFormedMsg'), 'success');
      }
    } else {
      // Normal request sent
      if (!cu.friendRequestsSent) cu.friendRequestsSent = [];
      // v1.0.15-beta: dedup defensivo — antes push direto, possibilitando
      // double-tap rápido criar entrada duplicada no array local. Firestore
      // já é idempotente via arrayUnion, mas o estado local pode divergir.
      if (cu.friendRequestsSent.indexOf(toUid) === -1) {
        cu.friendRequestsSent.push(toUid);
      }
      if (typeof showNotification !== 'undefined') {
        showNotification((window._t||function(k){return k;})('explore.notifInviteSent'), (window._t||function(k){return k;})('explore.notifInviteSentMsg'), 'success');
      }
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
  // Prevent duplicate: only add if not already in friends list
  if (cu.friends.indexOf(friendUid) === -1) {
    cu.friends.push(friendUid);
  }
  cu.friendRequestsReceived = (cu.friendRequestsReceived || []).filter(function(id) { return id !== friendUid; });

  window.FirestoreDB.acceptFriendRequest(myUid, friendUid).then(function() {
    // v1.0.59-beta: GA4 — friend_added (só conta na aceitação, não no envio)
    try {
      if (typeof window._trackFriendAdded === 'function') window._trackFriendAdded();
    } catch (_e) {}
    if (typeof showNotification !== 'undefined') {
      showNotification((window._t||function(k){return k;})('explore.notifFriendAccepted'), (window._t||function(k){return k;})('explore.notifFriendAcceptedMsg'), 'success');
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
      showNotification((window._t||function(k){return k;})('explore.notifInviteRejected'), (window._t||function(k){return k;})('explore.notifInviteRejectedMsg'), 'info');
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
    showAlertDialog((window._t||function(k){return k;})('explore.unfriendTitle'), (window._t||function(k){return k;})('explore.unfriendConfirm'), function() {
      // Update local state
      cu.friends = (cu.friends || []).filter(function(id) { return id !== friendUid; });

      window.FirestoreDB.removeFriend(myUid, friendUid).then(function() {
        if (typeof showNotification !== 'undefined') {
          showNotification((window._t||function(k){return k;})('explore.notifUnfriended'), (window._t||function(k){return k;})('explore.notifUnfriendedMsg'), 'info');
        }
        var container = document.getElementById('view-container');
        if (container) renderExplore(container);
      });
    }, { type: 'warning', confirmText: (window._t||function(k){return k;})('explore.unfriendYes'), cancelText: (window._t||function(k){return k;})('explore.cancel') });
  } else {
    // Fallback without dialog
    cu.friends = (cu.friends || []).filter(function(id) { return id !== friendUid; });
    window.FirestoreDB.removeFriend(myUid, friendUid).then(function() {
      var container = document.getElementById('view-container');
      if (container) renderExplore(container);
    });
  }
};
