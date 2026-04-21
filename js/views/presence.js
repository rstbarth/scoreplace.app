// ========================================
// scoreplace.app — Presença (Quem está no local)
// ========================================
// Public view: pick a venue + sport → see who's playing now and who plans to
// play through the day. Friends appear as avatars; non-friends show as an
// aggregated count ("+N"). Tournament events at the same venue/sport/day
// also populate the timeline.
//
// Route: #presence
//   Optional query (via sessionStorage _presencePrefill) to land on a specific
//   venue/sport when arriving from a dashboard widget or from a tournament
//   page.
// ========================================

(function() {
  var START_HOUR = 6;
  var END_HOUR = 23;

  // Sport → emoji map (shared with the rest of the app — mirrors dashboard.js
  // getSportIcon). Keeps icons in the chips consistent everywhere.
  function _sportIcon(sport) {
    if (!sport) return '';
    var s = String(sport).toLowerCase();
    if (s.indexOf('tênis de mesa') !== -1 || s.indexOf('tenis de mesa') !== -1 || s.indexOf('ping pong') !== -1) return '🏓';
    if (s.indexOf('padel') !== -1) return '🏸';
    if (s.indexOf('pickleball') !== -1) return '🥒';
    if (s.indexOf('tênis') !== -1 || s.indexOf('tennis') !== -1 || s.indexOf('beach') !== -1) return '🎾';
    if (s.indexOf('futsal') !== -1 || s.indexOf('futebol') !== -1) return '⚽';
    if (s.indexOf('vôlei') !== -1 || s.indexOf('volei') !== -1) return '🏐';
    if (s.indexOf('basquete') !== -1) return '🏀';
    return '🏆';
  }

  // Concatenate dedup'd icons for a list of sports.
  function _sportsIcons(sports) {
    if (!sports || !sports.length) return '';
    var seen = {};
    var out = '';
    sports.forEach(function(s) {
      var icon = _sportIcon(s);
      if (icon && !seen[icon]) { seen[icon] = true; out += icon; }
    });
    return out;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _safe(s) {
    return (window._safeHtml ? window._safeHtml(s) : String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;'));
  }

  function _initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function _hourOf(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    return d.getHours();
  }

  function _fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  // Build a deduplicated list of venues the user has a relationship with:
  // profile-saved preferred locations first, then tournament venues.
  // Returns [{placeId, name, lat, lon}].
  function _venuesFromTournaments() {
    var list = [];
    var seen = {};
    var push = function(pid, name, lat, lon) {
      var key = window.PresenceDB.venueKey(pid || '', name || '');
      if (!key || seen[key]) return;
      seen[key] = true;
      list.push({ placeId: key, name: name || pid || '', lat: lat || null, lon: lon || null });
    };
    var cu = window.AppStore && window.AppStore.currentUser;
    // Profile map picker stores locations as { lat, lng, label } — no placeId
    // and the human-readable text lives in `label`, not `name`. Map both
    // possible shapes so entries saved by the old and new code both work.
    // Strip the address tail so the dropdown shows only the venue name.
    (cu && Array.isArray(cu.preferredLocations) ? cu.preferredLocations : [])
      .forEach(function(p) {
        if (!p) return;
        var cleaned = _cleanVenueName(p.name || p.label || '');
        push(p.placeId, cleaned || p.label, p.lat, (p.lng != null ? p.lng : p.lon));
      });
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    tournaments.forEach(function(t) {
      if (!t) return;
      if (!t.venuePlaceId && !t.venue) return;
      push(t.venuePlaceId, t.venue, t.venueLat, t.venueLon);
    });
    return list;
  }

  // Sports derived from user tournament history + sensible defaults.
  function _sportOptions() {
    var defaults = ['Beach Tennis', 'Pickleball', 'Tênis', 'Tênis de Mesa', 'Padel'];
    var seen = {};
    defaults.forEach(function(s) { seen[s] = true; });
    var out = defaults.slice();
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    tournaments.forEach(function(t) {
      var s = window.PresenceDB.normalizeSport(t && t.sport);
      if (s && !seen[s]) { seen[s] = true; out.push(s); }
    });
    return out;
  }

  // Geocoder labels come as "Name — Address". Strip the address so our UI
  // shows just the venue name (user asked for this explicitly).
  function _cleanVenueName(label) {
    if (!label) return '';
    // Split on any em-dash/en-dash/hyphen surrounded by spaces.
    var idx = String(label).search(/\s[—–-]\s/);
    return idx > 0 ? String(label).slice(0, idx).trim() : String(label).trim();
  }

  function _defaultVenue() {
    // Profile preference takes priority — user explicitly saved these.
    var cu = window.AppStore && window.AppStore.currentUser;
    var prefLocs = (cu && Array.isArray(cu.preferredLocations)) ? cu.preferredLocations : [];
    if (prefLocs.length > 0) {
      var p = prefLocs[0];
      var humanName = _cleanVenueName(p.name || p.label || '');
      return {
        placeId: window.PresenceDB.venueKey(p.placeId || '', humanName || p.label || ''),
        name: humanName || p.placeId || '',
        lat: p.lat || null,
        lon: (p.lng != null ? p.lng : p.lon) || null
      };
    }
    var venues = _venuesFromTournaments();
    if (venues.length > 0) return venues[0];
    return null;
  }

  function _defaultSport() {
    var cu = window.AppStore && window.AppStore.currentUser;
    var pref = cu && cu.preferredSports;
    if (pref) {
      var first = String(pref).split(/[,;]/)[0];
      var norm = window.PresenceDB.normalizeSport(first);
      if (norm) return norm;
    }
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    for (var i = 0; i < tournaments.length; i++) {
      var s = window.PresenceDB.normalizeSport(tournaments[i] && tournaments[i].sport);
      if (s) return s;
    }
    return 'Beach Tennis';
  }

  // All sports the user marked as preferred in profile, normalized. Used to
  // seed the multi-select pills so someone who plays Padel + Beach Tennis at
  // the same clube sees both in one view.
  function _defaultSports() {
    var cu = window.AppStore && window.AppStore.currentUser;
    var out = [];
    var seen = {};
    var push = function(s) {
      var norm = window.PresenceDB.normalizeSport(s);
      if (norm && !seen[norm]) { seen[norm] = true; out.push(norm); }
    };
    if (cu && cu.preferredSports) {
      String(cu.preferredSports).split(/[,;]/).forEach(push);
    }
    if (out.length === 0) {
      var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
      tournaments.forEach(function(t) { if (t) push(t.sport); });
    }
    if (out.length === 0) out = ['Beach Tennis'];
    return out;
  }

  // Read prefill set by dashboard/tournaments page, if any.
  function _readPrefill() {
    try {
      var raw = sessionStorage.getItem('_presencePrefill');
      if (!raw) return null;
      sessionStorage.removeItem('_presencePrefill');
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  // ── State ─────────────────────────────────────────────────────────────────

  var state = {
    venue: null,      // {placeId, name, lat, lon}
    sport: '',        // Primary sport — used for writes (check-in, plan)
    sports: [],       // Multi-filter — the set of modalities to merge in display
    dayKey: '',
    presences: [],    // from PresenceDB (filtered visibility)
    tournaments: [],  // same venue+sport+day, treated as scheduled "presences"
    myActive: [],     // my own active presences
    friendsUids: {},  // { uid: true }
    loading: true
  };

  // ── Rendering ─────────────────────────────────────────────────────────────

  function render(container) {
    var back = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({ href: '#dashboard', label: 'Voltar' })
      : '';

    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) {
      container.innerHTML = back +
        '<div class="card" style="max-width:600px;margin:2rem auto;padding:2rem;text-align:center;">' +
          '<h2 style="margin:0 0 1rem 0;">Presença no local</h2>' +
          '<p style="color:var(--text-muted);margin-bottom:1rem;">Faça login para ver quem está no local e registrar sua presença.</p>' +
          '<button class="btn btn-primary" onclick="if(typeof openModal===\'function\')openModal(\'modal-login\')">Entrar</button>' +
        '</div>';
      return;
    }

    // Build friends set
    state.friendsUids = {};
    var friends = (cu.friends || []);
    friends.forEach(function(u) { state.friendsUids[u] = true; });

    container.innerHTML = back +
      '<div style="max-width:820px;margin:0 auto;padding:0 4px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap;">' +
          '<h2 style="margin:0;font-size:1.45rem;font-weight:800;color:var(--text-bright);flex:1;">📍 Presença no local</h2>' +
        '</div>' +
        '<div id="presence-picker" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;margin-bottom:14px;"></div>' +
        '<div id="presence-myactive" style="margin-bottom:14px;"></div>' +
        '<div id="presence-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;"></div>' +
        '<div id="presence-chart" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;margin-bottom:14px;overflow:hidden;"></div>' +
        '<div id="presence-now" style="margin-bottom:14px;"></div>' +
        '<div id="presence-upcoming" style="margin-bottom:1.5rem;"></div>' +
      '</div>';

    renderPicker();
    renderActions();
    refreshData();
  }

  function renderPicker() {
    var picker = document.getElementById('presence-picker');
    if (!picker) return;
    var venues = _venuesFromTournaments();
    var sports = _sportOptions();

    var venueOpts = '';
    venues.forEach(function(v) {
      var sel = (state.venue && state.venue.placeId === v.placeId) ? ' selected' : '';
      venueOpts += '<option value="' + _safe(v.placeId) + '"' + sel + '>' + _safe(v.name) + '</option>';
    });
    if (venues.length === 0) {
      venueOpts = '<option value="">— nenhum local conhecido —</option>';
    }
    venueOpts += '<option value="__custom__">✏️ Digitar outro local…</option>';
    // When the dropdown is empty (no preferredLocations AND no tournament
    // venues) we surface a CTA pointing straight to the profile so the user
    // can add places — without it the "— nenhum —" option feels like a dead end.
    var emptyHint = (venues.length === 0)
      ? '<div style="margin-top:8px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:10px 12px;font-size:0.78rem;color:var(--text-bright);">' +
          '<span style="margin-right:4px;">💡</span>Adicione seus locais de jogo em <b>Perfil → Locais de preferência</b> e eles aparecerão aqui automaticamente. ' +
          '<a href="#" onclick="event.preventDefault(); if(typeof window._showProfileModal===\'function\')window._showProfileModal(); else if(typeof openModal===\'function\')openModal(\'modal-profile\');" style="color:#a5b4fc;font-weight:700;text-decoration:underline;">Abrir perfil</a>' +
        '</div>'
      : '';

    var sportsActive = state.sports || [];
    var sportsPills = sports.map(function(s) {
      var active = sportsActive.indexOf(s) !== -1;
      var style = 'padding:6px 12px;border-radius:999px;font-size:0.75rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;font-weight:' + (active ? '700' : '500') + ';' +
        'border:' + (active ? '2px solid #fbbf24' : '1.5px solid var(--border-color)') + ';' +
        'background:' + (active ? 'rgba(251,191,36,0.18)' : 'transparent') + ';' +
        'color:' + (active ? '#fbbf24' : 'var(--text-muted)') + ';';
      return '<button type="button" onclick="window._presenceToggleSport(\'' + _safe(s) + '\')" style="' + style + '">' + _safe(s) + '</button>';
    }).join('');

    var today = new Date();
    var dateLabel = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();

    picker.innerHTML =
      '<div>' +
        '<label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Local</label>' +
        '<select id="presence-venue-select" onchange="window._presenceOnVenueChange(this.value)" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
          venueOpts +
        '</select>' +
        '<input id="presence-venue-custom" type="text" placeholder="Nome do local" style="display:none;width:100%;padding:8px 10px;margin-top:6px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;" oninput="window._presenceOnCustomVenue(this.value)">' +
        emptyHint +
      '</div>' +
      '<div style="margin-top:10px;">' +
        '<label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;font-weight:600;">Modalidades <span style="font-weight:400;">(selecione uma ou mais)</span></label>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + sportsPills + '</div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">Hoje, ' + _safe(dateLabel) + ' · avatares = amigos · números = outros usuários</div>';
  }

  function renderActions() {
    var box = document.getElementById('presence-actions');
    if (!box) return;
    var hasVenue = !!(state.venue && state.venue.placeId);
    var hasSport = !!state.sport;
    var disabled = (!hasVenue || !hasSport) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '';
    box.innerHTML =
      '<button class="btn btn-success hover-lift" ' + disabled + ' onclick="window._spinButton(this, \'Registrando...\'); window._presenceCheckIn()" style="flex:1;min-width:140px;padding:10px 14px;font-weight:700;">📍 Estou aqui agora</button>' +
      '<button class="btn btn-indigo hover-lift" ' + disabled + ' onclick="window._presencePlanDialog()" style="flex:1;min-width:140px;padding:10px 14px;font-weight:700;">🗓️ Planejar ida</button>';
  }

  function renderMyActive() {
    var box = document.getElementById('presence-myactive');
    if (!box) return;
    var here = state.myActive.filter(function(p) {
      return p.placeId === (state.venue && state.venue.placeId) &&
             window.PresenceDB.normalizeSport(p.sport) === window.PresenceDB.normalizeSport(state.sport);
    });
    if (here.length === 0) { box.innerHTML = ''; return; }
    var html = '<div style="display:flex;flex-direction:column;gap:8px;">';
    here.forEach(function(p) {
      var label;
      if (p.type === 'checkin') {
        var leftMs = p.endsAt - Date.now();
        var leftMin = Math.max(0, Math.round(leftMs / 60000));
        label = '✅ Você está aqui · expira em ' + leftMin + ' min';
      } else {
        label = '🗓️ Você planejou estar aqui ' + _fmtTime(p.startsAt) + '–' + _fmtTime(p.endsAt);
      }
      html += '<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;">' +
        '<span style="flex:1;color:var(--text-bright);font-size:0.88rem;">' + _safe(label) + '</span>' +
        '<button class="btn btn-sm" onclick="window._presenceCancel(\'' + _safe(p._id) + '\')" style="background:transparent;color:var(--danger-color);border:1px solid var(--danger-color);padding:4px 10px;font-size:0.75rem;">Cancelar</button>' +
      '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }

  // Classify a presence as "friend" / "me" / "other" given the current user.
  function _classify(p) {
    var cu = window.AppStore && window.AppStore.currentUser;
    var myUid = cu && (cu.uid || '');
    if (myUid && p.uid === myUid) return 'me';
    if (p.uid && state.friendsUids[p.uid]) return 'friend';
    return 'other';
  }

  // Convert a tournament row into "virtual presences" for counting purposes:
  // one entry per distinct participant anchored at the tournament start time.
  // We only show these in the chart buckets as aggregated counts (the
  // "Agora"/"Upcoming" lists still use real presences for friend avatars).
  function _tournamentOccupancy(t, dayKeyStr) {
    var out = [];
    if (!t || !t.startDate) return out;
    var start = new Date(t.startDate);
    if (isNaN(start.getTime())) return out;
    if (window.PresenceDB.dayKey(start) !== dayKeyStr) return out;
    var endMs = start.getTime() + (3 * 60 * 60 * 1000); // default 3h block
    if (t.endDate) {
      var end = new Date(t.endDate);
      if (!isNaN(end.getTime()) && end.getTime() > start.getTime()) endMs = end.getTime();
    }
    var parts = Array.isArray(t.participants) ? t.participants : [];
    var count = Math.max(parts.length, 1);
    for (var i = 0; i < count; i++) {
      var p = parts[i] || {};
      out.push({
        _virtual: true,
        _tournamentId: t.id,
        _tournamentName: t.name || 'Torneio',
        uid: p.uid || null,
        email_lower: (p.email || '').toLowerCase(),
        displayName: p.displayName || p.name || '',
        photoURL: p.photoURL || '',
        startsAt: start.getTime(),
        endsAt: endMs,
        visibility: 'public',
        type: 'tournament'
      });
    }
    return out;
  }

  function renderChart() {
    var box = document.getElementById('presence-chart');
    if (!box) return;

    // Buckets by hour — friends count + others count
    var buckets = {};
    for (var h = START_HOUR; h <= END_HOUR; h++) buckets[h] = { friends: 0, me: 0, others: 0 };

    var allPresences = state.presences.slice();
    // Add tournament-derived occupancy
    state.tournaments.forEach(function(t) {
      _tournamentOccupancy(t, state.dayKey).forEach(function(p) { allPresences.push(p); });
    });

    allPresences.forEach(function(p) {
      var startH = Math.max(START_HOUR, Math.min(END_HOUR, _hourOf(p.startsAt)));
      var endH = Math.max(START_HOUR, Math.min(END_HOUR, _hourOf(p.endsAt)));
      if (startH == null || endH == null) return;
      var klass = _classify(p);
      for (var h = startH; h <= endH; h++) {
        if (!buckets[h]) continue;
        if (klass === 'me') buckets[h].me += 1;
        else if (klass === 'friend') buckets[h].friends += 1;
        else buckets[h].others += 1;
      }
    });

    var maxPerBucket = 1;
    Object.keys(buckets).forEach(function(h) {
      var total = buckets[h].friends + buckets[h].me + buckets[h].others;
      if (total > maxPerBucket) maxPerBucket = total;
    });

    var bars = '';
    for (var h = START_HOUR; h <= END_HOUR; h++) {
      var b = buckets[h];
      var total = b.friends + b.me + b.others;
      var totalPct = total > 0 ? Math.round((total / maxPerBucket) * 100) : 0;
      var friendsPct = total > 0 ? Math.round((b.friends + b.me) / total * 100) : 0;
      var isNow = (new Date()).getHours() === h;
      var labelColor = isNow ? 'var(--primary-color)' : 'var(--text-muted)';
      bars += '<div title="' + h + 'h: ' + (b.friends + b.me) + ' amigo(s) · ' + b.others + ' outro(s)" style="flex:0 0 28px;display:flex;flex-direction:column;align-items:center;gap:2px;">' +
        '<div style="height:90px;width:20px;display:flex;flex-direction:column-reverse;border-radius:4px;background:rgba(150,150,150,0.08);overflow:hidden;position:relative;">' +
          (total > 0
            ? '<div style="height:' + totalPct + '%;width:100%;display:flex;flex-direction:column-reverse;">' +
                '<div style="flex:' + (100 - friendsPct) + ';background:#6b7280;"></div>' +
                '<div style="flex:' + friendsPct + ';background:#fbbf24;"></div>' +
              '</div>'
            : '') +
        '</div>' +
        '<span style="font-size:0.65rem;color:' + labelColor + ';font-weight:' + (isNow ? 700 : 500) + ';">' + h + '</span>' +
      '</div>';
    }

    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<span style="font-weight:700;color:var(--text-bright);font-size:0.95rem;">Movimento hoje</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;color:var(--text-muted);"><span style="width:10px;height:10px;background:#fbbf24;border-radius:2px;"></span> amigos</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;color:var(--text-muted);"><span style="width:10px;height:10px;background:#6b7280;border-radius:2px;"></span> outros</span>' +
      '</div>' +
      '<div style="display:flex;gap:2px;overflow-x:auto;padding-bottom:4px;justify-content:space-between;">' + bars + '</div>';
  }

  function renderNow() {
    var box = document.getElementById('presence-now');
    if (!box) return;
    var now = Date.now();
    var active = state.presences.filter(function(p) {
      return p.startsAt <= now && p.endsAt > now && p.type === 'checkin';
    });
    // Also fold active tournament occupancies
    state.tournaments.forEach(function(t) {
      _tournamentOccupancy(t, state.dayKey).forEach(function(p) {
        if (p.startsAt <= now && p.endsAt > now) active.push(p);
      });
    });

    if (active.length === 0) {
      box.innerHTML =
        '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:20px;text-align:center;color:var(--text-muted);">' +
          '<div style="font-size:1.8rem;margin-bottom:6px;">🏖️</div>' +
          '<div style="font-size:0.92rem;">Ninguém registrou presença agora.</div>' +
          '<div style="font-size:0.78rem;margin-top:4px;">Se você estiver no local, registre para avisar seus amigos.</div>' +
        '</div>';
      return;
    }

    var friendsHtml = [];
    var seenFriends = {};
    var otherCount = 0;
    active.forEach(function(p) {
      var klass = _classify(p);
      if (klass === 'me' || klass === 'friend') {
        var key = p.uid || (p.displayName + '|' + p.startsAt);
        if (seenFriends[key]) return;
        seenFriends[key] = true;
        var name = p.displayName || 'Amigo';
        var subtitle;
        if (p.type === 'tournament') subtitle = '🏆 ' + (p._tournamentName || 'torneio');
        else {
          var mins = Math.max(0, Math.round((Date.now() - p.startsAt) / 60000));
          subtitle = 'há ' + mins + ' min';
        }
        var avatar = p.photoURL
          ? '<img src="' + _safe(p.photoURL) + '" alt="" style="width:44px;height:44px;min-width:44px;flex-shrink:0;border-radius:50%;object-fit:cover;border:2px solid ' + (klass === 'me' ? '#10b981' : '#fbbf24') + ';">'
          : '<div style="width:44px;height:44px;min-width:44px;flex-shrink:0;border-radius:50%;background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;border:2px solid ' + (klass === 'me' ? '#10b981' : '#fbbf24') + ';">' + _safe(_initials(name)) + '</div>';
        // Prefix sports icons so friends see which modalities this person is
        // available to play right now. Same _sportsIcons helper used in
        // Próximas horas — keeps the two sections visually consistent.
        var nowSports = Array.isArray(p.sports) && p.sports.length ? p.sports : (p.sport ? [p.sport] : []);
        var nowIcons = _sportsIcons(nowSports);
        var iconsHtml = nowIcons
          ? '<span title="' + _safe(nowSports.join(', ')) + '" style="font-size:1rem;line-height:1;flex-shrink:0;">' + nowIcons + '</span>'
          : '';
        friendsHtml.push(
          '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-darker);border-radius:10px;">' +
            iconsHtml +
            avatar +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:600;font-size:0.88rem;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(name) + (klass === 'me' ? ' (você)' : '') + '</div>' +
              '<div style="font-size:0.72rem;color:var(--text-muted);">' + _safe(subtitle) + '</div>' +
            '</div>' +
          '</div>'
        );
      } else if (p.visibility === 'public' || p.type === 'tournament') {
        otherCount += 1;
      }
    });

    var othersPill = otherCount > 0
      ? '<div style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(107,114,128,0.15);border:1px solid rgba(107,114,128,0.3);border-radius:999px;color:var(--text-bright);font-weight:600;font-size:0.85rem;">👥 +' + otherCount + ' outro' + (otherCount === 1 ? '' : 's') + '</div>'
      : '';

    var friendsGrid = friendsHtml.length > 0
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:10px;">' + friendsHtml.join('') + '</div>'
      : '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Nenhum amigo registrado agora.</div>';

    box.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;">' +
        '<div style="font-weight:700;color:var(--text-bright);margin-bottom:10px;font-size:0.95rem;display:flex;align-items:center;gap:6px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>' +
          'Agora no local' +
        '</div>' +
        friendsGrid +
        othersPill +
      '</div>';
  }

  function renderUpcoming() {
    var box = document.getElementById('presence-upcoming');
    if (!box) return;
    var now = Date.now();
    var rows = [];

    // Planned presences that haven't started yet
    state.presences.forEach(function(p) {
      if (p.type === 'planned' && p.startsAt > now) rows.push(p);
    });
    // Tournament occupancies starting later today
    state.tournaments.forEach(function(t) {
      _tournamentOccupancy(t, state.dayKey).forEach(function(p) {
        if (p.startsAt > now) rows.push(p);
      });
    });

    if (rows.length === 0) { box.innerHTML = ''; return; }

    // Group by hour bucket
    var groups = {};
    rows.forEach(function(p) {
      var h = _hourOf(p.startsAt);
      if (!groups[h]) groups[h] = [];
      groups[h].push(p);
    });
    var hours = Object.keys(groups).map(Number).sort(function(a,b) { return a - b; });

    var html =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;">' +
        '<div style="font-weight:700;color:var(--text-bright);margin-bottom:10px;font-size:0.95rem;">🗓️ Próximas horas</div>';

    hours.forEach(function(h) {
      var list = groups[h];
      var friendsSet = {};
      var friendChips = [];
      var otherCount = 0;
      var tournamentBadge = '';
      list.forEach(function(p) {
        if (p.type === 'tournament' && !tournamentBadge) {
          tournamentBadge = '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;background:rgba(251,191,36,0.18);border:1px solid rgba(251,191,36,0.35);color:#fbbf24;padding:2px 8px;border-radius:999px;cursor:pointer;" onclick="window.location.hash=\'#tournaments/' + _safe(p._tournamentId) + '\'">🏆 ' + _safe(p._tournamentName) + '</span>';
        }
        var klass = _classify(p);
        if (klass === 'me' || klass === 'friend') {
          var key = p.uid || p.displayName;
          if (friendsSet[key]) return;
          friendsSet[key] = true;
          var name = klass === 'me' ? 'Você' : (p.displayName || 'Amigo');
          var borderColor = klass === 'me' ? '#10b981' : '#fbbf24';
          // flex-shrink:0 keeps the circle perfectly round inside the flex
          // container — without it, tight rows squish the image horizontally.
          var avatar = p.photoURL
            ? '<img src="' + _safe(p.photoURL) + '" alt="" style="width:28px;height:28px;min-width:28px;flex-shrink:0;border-radius:50%;object-fit:cover;border:2px solid ' + borderColor + ';">'
            : '<div style="width:28px;height:28px;min-width:28px;flex-shrink:0;border-radius:50%;background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.72rem;border:2px solid ' + borderColor + ';">' + _safe(_initials(name)) + '</div>';
          // Chip: [sport icons] avatar [name]. Icons come before the avatar so
          // friends know at a glance which modalities this person will play.
          var chipSports = Array.isArray(p.sports) && p.sports.length ? p.sports : (p.sport ? [p.sport] : []);
          var iconStr = _sportsIcons(chipSports);
          friendChips.push(
            '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:999px;padding:3px 10px 3px 6px;max-width:100%;min-width:0;">' +
              (iconStr ? '<span title="' + _safe(chipSports.join(', ')) + '" style="font-size:0.9rem;line-height:1;flex-shrink:0;">' + iconStr + '</span>' : '') +
              avatar +
              '<span style="font-size:0.78rem;color:var(--text-bright);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(name) + '</span>' +
            '</div>'
          );
        } else if (p.visibility === 'public' || p.type === 'tournament') {
          otherCount += 1;
        }
      });
      html +=
        '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border-color);">' +
          '<div style="min-width:40px;font-weight:700;color:var(--text-bright);font-size:0.9rem;flex-shrink:0;">' + h + 'h</div>' +
          '<div style="flex:1;display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-width:0;">' +
            friendChips.join('') +
            (otherCount > 0 ? '<span style="background:rgba(107,114,128,0.18);border:1px solid rgba(107,114,128,0.3);color:var(--text-bright);font-size:0.75rem;font-weight:600;padding:2px 10px;border-radius:999px;">+' + otherCount + '</span>' : '') +
            tournamentBadge +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  // Tear down any previous Firestore listener — called before attaching a
  // new one and when the user navigates away.
  function _teardownListener() {
    try {
      if (typeof window._presenceUnsubscribe === 'function') {
        window._presenceUnsubscribe();
      }
    } catch (e) {}
    window._presenceUnsubscribe = null;
  }

  // Attach a real-time listener for the venue/day — one snapshot whenever
  // any presence there is created/updated/cancelled. Filters by sport and
  // visibility client-side. Without this, friends' check-ins only showed up
  // after the user reloaded.
  function _attachListener() {
    _teardownListener();
    var db = window.FirestoreDB && window.FirestoreDB.db;
    if (!db || !state.venue || !state.venue.placeId || !state.dayKey) return;
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return;
    var myUid = cu.uid;
    try {
      window._presenceUnsubscribe = db.collection('presences')
        .where('placeId', '==', state.venue.placeId)
        .where('dayKey', '==', state.dayKey)
        .onSnapshot(function(snap) {
          var list = [];
          snap.forEach(function(doc) {
            var d = doc.data();
            if (!d || d.cancelled) return;
            d._id = doc.id;
            list.push(d);
          });
          // Apply sport filter (match any of state.sports) and visibility.
          var sel = (state.sports || []).map(window.PresenceDB.normalizeSport);
          var selSet = {}; sel.forEach(function(s) { selSet[s] = true; });
          var filtered = list.filter(function(p) {
            var docSports = Array.isArray(p.sports) && p.sports.length ? p.sports : (p.sport ? [p.sport] : []);
            var sportMatch = sel.length === 0 || docSports.some(function(s) { return selSet[window.PresenceDB.normalizeSport(s)]; });
            if (!sportMatch) return false;
            if (!p.uid) return p.visibility === 'public';
            if (p.uid === myUid) return true;
            if (state.friendsUids[p.uid]) return true;
            return p.visibility === 'public';
          });
          state.presences = filtered;
          renderChart();
          renderNow();
          renderUpcoming();
        }, function(err) {
          console.warn('Presence listener error:', err && err.message);
        });
    } catch (e) {
      console.warn('Failed to attach presence listener:', e);
    }
  }

  function refreshData() {
    var cu = window.AppStore && window.AppStore.currentUser;
    // When muted, we don't fetch or display anyone's presences — consistent
    // with "não informar e não receber" semantics of the profile toggle.
    if (_muted(cu)) {
      state.presences = [];
      state.tournaments = [];
      state.myActive = [];
      renderChart();
      renderMyActive();
      var now = document.getElementById('presence-now');
      if (now) now.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:16px;text-align:center;color:var(--text-muted);font-size:0.88rem;">🔕 Presença silenciada no seu perfil. Desative para ver e registrar presenças.</div>';
      var up = document.getElementById('presence-upcoming');
      if (up) up.innerHTML = '';
      return;
    }
    var hasSports = Array.isArray(state.sports) && state.sports.length > 0;
    if (!state.venue || !state.venue.placeId || !hasSports) {
      // Can't query without both — just render empty chart
      _teardownListener();
      state.presences = [];
      state.tournaments = [];
      state.myActive = [];
      renderChart();
      renderNow();
      renderUpcoming();
      renderMyActive();
      return;
    }
    // Subscribe to real-time updates so friends' new presences appear
    // without the user having to reload.
    _attachListener();
    state.loading = true;
    state.dayKey = window.PresenceDB.dayKey(new Date());
    var cu = window.AppStore && window.AppStore.currentUser;
    var myUid = cu && cu.uid;

    // Presences — one call per sport, merge results. Small N (1–8 modalities);
    // Firestore costs scale linearly with selected sports, which is fine.
    var selSports = state.sports.map(window.PresenceDB.normalizeSport);
    Promise.all(selSports.map(function(s) {
      return window.PresenceDB.loadForVenueSportDay(state.venue.placeId, s, state.dayKey);
    })).then(function(pages) {
      var merged = [];
      var seen = {};
      pages.forEach(function(list) {
        list.forEach(function(p) {
          if (!p || !p._id || seen[p._id]) return;
          seen[p._id] = true;
          merged.push(p);
        });
      });
      // Visibility filter: drop "friends"-scoped presences from non-friends.
      state.presences = merged.filter(function(p) {
        if (!p.uid) return p.visibility === 'public';
        if (p.uid === myUid) return true;
        if (state.friendsUids[p.uid]) return true;
        return p.visibility === 'public';
      });
      renderChart();
      renderNow();
      renderUpcoming();
    });

    // Tournaments at same venue + ANY of the selected sports + day.
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    var selSportSet = {}; selSports.forEach(function(s) { selSportSet[s] = true; });
    state.tournaments = tournaments.filter(function(t) {
      if (!t) return false;
      var tKey = window.PresenceDB.venueKey(t.venuePlaceId, t.venue);
      if (tKey !== state.venue.placeId) return false;
      if (!selSportSet[window.PresenceDB.normalizeSport(t.sport)]) return false;
      if (!t.startDate) return false;
      return window.PresenceDB.dayKey(new Date(t.startDate)) === state.dayKey;
    });
    renderChart();
    renderUpcoming();

    // My active presences (for banner + cancel action)
    if (myUid) {
      window.PresenceDB.loadMyActive(myUid).then(function(list) {
        state.myActive = list;
        renderMyActive();
      });
    }
  }

  // ── Event handlers (exposed globally) ─────────────────────────────────────

  window._presenceOnVenueChange = function(value) {
    var custom = document.getElementById('presence-venue-custom');
    if (value === '__custom__') {
      if (custom) { custom.style.display = 'block'; custom.focus(); }
      state.venue = { placeId: '', name: '', lat: null, lon: null };
      renderActions();
      refreshData();
      return;
    }
    if (custom) custom.style.display = 'none';
    var venues = _venuesFromTournaments();
    var match = venues.filter(function(v) { return v.placeId === value; })[0];
    state.venue = match || null;
    renderActions();
    refreshData();
  };

  window._presenceOnCustomVenue = function(value) {
    var name = String(value || '').trim();
    if (!name) { state.venue = null; renderActions(); return; }
    state.venue = {
      placeId: window.PresenceDB.venueKey('', name),
      name: name, lat: null, lon: null
    };
    renderActions();
    // Debounce the data refresh so we don't query on every keystroke
    clearTimeout(window._presenceCustomDebounce);
    window._presenceCustomDebounce = setTimeout(refreshData, 400);
  };

  window._presenceOnSportChange = function(value) {
    state.sport = value || '';
    state.sports = value ? [value] : [];
    renderActions();
    refreshData();
  };

  // Multi-select: toggle a sport pill. When all pills get turned off we fall
  // back to the first preferred sport so queries have something to go on.
  window._presenceToggleSport = function(sport) {
    if (!sport) return;
    if (!Array.isArray(state.sports)) state.sports = state.sport ? [state.sport] : [];
    var idx = state.sports.indexOf(sport);
    if (idx === -1) state.sports.push(sport);
    else state.sports.splice(idx, 1);
    if (state.sports.length === 0) {
      // Guard: at least one must stay selected, otherwise writes have no target.
      state.sports = [sport];
    }
    state.sport = state.sports[0];
    renderPicker();
    renderActions();
    refreshData();
  };

  // Is the current user under an active mute?
  function _muted(cu) {
    if (!cu) return false;
    var until = Number(cu.presenceMuteUntil || 0);
    return until > Date.now();
  }

  window._presenceCheckIn = function() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid || !state.venue) return;
    if (cu.presenceVisibility === 'off') {
      if (window.showNotification) window.showNotification('Presença desligada no seu perfil. Ative em Amigos ou Todos para registrar.', 'info');
      return;
    }
    if (_muted(cu)) {
      if (window.showNotification) window.showNotification('Presença silenciada. Desative em Perfil → Presença para registrar.', 'info');
      return;
    }
    // All selected sports are stored on the same presence doc — the user is
    // "at this venue and available to play any of these modalities". No more
    // "pick one" prompt; a single doc represents the whole session.
    var sports = (Array.isArray(state.sports) && state.sports.length > 0) ? state.sports : (state.sport ? [state.sport] : []);
    if (sports.length === 0) return;
    state.sport = sports[0];
    // Prevent duplicate check-in at same venue+sport
    var dup = state.myActive.filter(function(p) {
      return p.type === 'checkin' && p.placeId === state.venue.placeId &&
             window.PresenceDB.normalizeSport(p.sport) === window.PresenceDB.normalizeSport(state.sport);
    })[0];
    if (dup) {
      if (window.showNotification) window.showNotification('Você já está registrado neste local.', 'info');
      return;
    }
    var now = Date.now();
    var normSports = sports.map(window.PresenceDB.normalizeSport).filter(Boolean);
    var payload = {
      uid: cu.uid,
      email_lower: (cu.email || '').toLowerCase(),
      displayName: cu.displayName || '',
      photoURL: cu.photoURL || '',
      placeId: state.venue.placeId,
      venueName: state.venue.name || '',
      venueLat: state.venue.lat || null,
      venueLon: state.venue.lon || null,
      // `sport` stays for backward compat (old readers); `sports[]` is the
      // canonical multi-sport field queryable via array-contains.
      sport: normSports[0] || '',
      sports: normSports,
      type: 'checkin',
      startsAt: now,
      endsAt: now + window.PresenceDB.CHECKIN_WINDOW_MS,
      dayKey: window.PresenceDB.dayKey(new Date(now)),
      visibility: ((window.AppStore.currentUser && window.AppStore.currentUser.presenceVisibility) || 'friends'),
      cancelled: false,
      createdAt: now
    };
    window.PresenceDB.savePresence(payload).then(function(id) {
      if (window.showNotification) window.showNotification('Presença registrada! Seus amigos já podem ver.', 'success');
      payload._id = id;
      state.myActive.push(payload);
      state.presences.push(payload);
      renderMyActive();
      renderChart();
      renderNow();
    }).catch(function(e) {
      console.error(e);
      if (window.showNotification) window.showNotification('Erro ao registrar presença.', 'error');
    });
  };

  // Picker overlay used when the user has multiple sports active and we
  // need to resolve which one to write. Renders a lightweight row of
  // buttons; clicking one calls the continuation.
  function _pickSportThen(action, sports, cb) {
    var prev = document.getElementById('presence-sport-pick-overlay');
    if (prev) prev.remove();
    var overlay = document.createElement('div');
    overlay.id = 'presence-sport-pick-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    var btns = sports.map(function(s) {
      return '<button class="btn btn-primary" onclick="document.getElementById(\'presence-sport-pick-overlay\').remove(); window._presencePickedSport=\'' + _safe(s) + '\'; (window._presencePickedCb&&window._presencePickedCb(\'' + _safe(s) + '\'))" style="margin:4px;">' + _safe(s) + '</button>';
    }).join('');
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:18px;max-width:360px;width:100%;">' +
        '<h3 style="margin:0 0 10px 0;color:var(--text-bright);font-size:1rem;">Qual modalidade agora?</h3>' +
        '<p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 10px 0;">Você selecionou várias. Escolha a que vai jogar para ' + (action === 'plan' ? 'planejar' : 'registrar') + ' presença.</p>' +
        '<div style="display:flex;flex-wrap:wrap;">' + btns + '</div>' +
        '<div style="text-align:right;margin-top:8px;">' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'presence-sport-pick-overlay\').remove();">Cancelar</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(ev) { if (ev.target === overlay) overlay.remove(); });
    window._presencePickedCb = cb;
    document.body.appendChild(overlay);
  }

  window._presencePlanDialog = function() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid || !state.venue) return;
    var sports = (Array.isArray(state.sports) && state.sports.length > 0) ? state.sports : (state.sport ? [state.sport] : []);
    if (sports.length === 0) return;
    state.sport = sports[0];
    var now = new Date();
    var defStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    var fmt = function(d) {
      return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    };
    var sportsLabel = sports.join(' · ');

    // Remove any prior overlay
    var prev = document.getElementById('presence-plan-overlay');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'presence-plan-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px;padding:20px;max-width:420px;width:100%;">' +
        '<h3 style="margin:0 0 12px 0;color:var(--text-bright);">🗓️ Planejar ida</h3>' +
        '<p style="margin:0 0 12px 0;color:var(--text-muted);font-size:0.85rem;">' + _safe(state.venue.name || state.venue.placeId) + ' · ' + _safe(sportsLabel) + ' · hoje</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">' +
          '<label style="font-size:0.78rem;color:var(--text-muted);display:block;">Das<input id="plan-start" type="time" value="' + fmt(defStart) + '" style="display:block;width:100%;margin-top:4px;padding:8px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);"></label>' +
          '<label style="font-size:0.78rem;color:var(--text-muted);display:block;">Até <span style="font-weight:400;">(opcional)</span><input id="plan-end" type="time" placeholder="—" style="display:block;width:100%;margin-top:4px;padding:8px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);"></label>' +
        '</div>' +
        '<p style="font-size:0.7rem;color:var(--text-muted);margin:0 0 12px 0;">Deixe "Até" em branco se não quiser fixar hora de saída.</p>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button class="btn btn-outline" onclick="document.getElementById(\'presence-plan-overlay\').remove()">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="window._spinButton(this, \'Salvando...\'); window._presenceConfirmPlan()">Confirmar</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(ev) {
      if (ev.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  };

  window._presenceConfirmPlan = function() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid || !state.venue) return;
    var sports = (Array.isArray(state.sports) && state.sports.length > 0) ? state.sports : (state.sport ? [state.sport] : []);
    if (sports.length === 0) return;
    if (cu.presenceVisibility === 'off') {
      if (window.showNotification) window.showNotification('Presença desligada no seu perfil.', 'info');
      return;
    }
    if (_muted(cu)) {
      if (window.showNotification) window.showNotification('Presença silenciada. Desative em Perfil → Presença para planejar.', 'info');
      return;
    }
    var startStr = (document.getElementById('plan-start') || {}).value;
    var endStr = (document.getElementById('plan-end') || {}).value;
    if (!startStr) return;
    var now = new Date();
    var build = function(hm) {
      var parts = hm.split(':').map(Number);
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0] || 0, parts[1] || 0, 0, 0);
      return d.getTime();
    };
    var startsAt = build(startStr);
    var endsAt;
    var openEnded = false;
    if (endStr) {
      endsAt = build(endStr);
      if (endsAt <= startsAt) {
        if (window.showNotification) window.showNotification('Horário final deve ser maior que o inicial.', 'error');
        return;
      }
    } else {
      // Open-ended plan: cap at 12h after start so the doc still satisfies
      // endsAt-based queries and isn't indefinite. UI shows "a partir de HH:mm".
      openEnded = true;
      endsAt = startsAt + 12 * 60 * 60 * 1000;
    }
    var normSports = sports.map(window.PresenceDB.normalizeSport).filter(Boolean);
    var payload = {
      uid: cu.uid,
      email_lower: (cu.email || '').toLowerCase(),
      displayName: cu.displayName || '',
      photoURL: cu.photoURL || '',
      placeId: state.venue.placeId,
      venueName: state.venue.name || '',
      venueLat: state.venue.lat || null,
      venueLon: state.venue.lon || null,
      sport: normSports[0] || '',
      sports: normSports,
      type: 'planned',
      startsAt: startsAt,
      endsAt: endsAt,
      openEnded: openEnded,
      dayKey: window.PresenceDB.dayKey(new Date(startsAt)),
      visibility: ((window.AppStore.currentUser && window.AppStore.currentUser.presenceVisibility) || 'friends'),
      cancelled: false,
      createdAt: Date.now()
    };
    window.PresenceDB.savePresence(payload).then(function(id) {
      if (window.showNotification) window.showNotification('Planejamento registrado! Amigos podem se programar.', 'success');
      var ov = document.getElementById('presence-plan-overlay');
      if (ov) ov.remove();
      payload._id = id;
      state.myActive.push(payload);
      state.presences.push(payload);
      renderMyActive();
      renderChart();
      renderUpcoming();
      // Notify friends so they can plan to join. Only when the user's
      // visibility allows friends to see the presence (default/friends or
      // public); 'off' already short-circuits presence creation upstream.
      _notifyFriendsOfPlan(payload);
    }).catch(function(e) {
      console.error(e);
      if (window.showNotification) window.showNotification('Erro ao planejar ida.', 'error');
    });
  };

  // Send a low-priority notification to each friend when a planned presence
  // is created. Respects each friend's notifyLevel via _sendUserNotification.
  function _notifyFriendsOfPlan(payload) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) return;
    var friends = Array.isArray(cu.friends) ? cu.friends : [];
    if (friends.length === 0) return;
    if (typeof window._sendUserNotification !== 'function') return;

    var d = new Date(payload.startsAt);
    var hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var msg = (cu.displayName || 'Um amigo') + ' vai jogar ' + payload.sport +
      ' em ' + (payload.venueName || 'um local') + ' às ' + hhmm + ' hoje. Quer ir junto?';

    friends.forEach(function(friendUid) {
      if (!friendUid) return;
      window._sendUserNotification(friendUid, {
        type: 'presence_plan',
        message: msg,
        level: 'all',
        venueName: payload.venueName || '',
        placeId: payload.placeId,
        sport: payload.sport,
        startsAt: payload.startsAt
      }).catch(function(e) { console.warn('Presence plan notify failed:', e); });
    });
  }

  window._presenceCancel = function(docId) {
    if (!docId) return;
    window.PresenceDB.cancelPresence(docId).then(function(ok) {
      if (!ok) return;
      state.myActive = state.myActive.filter(function(p) { return p._id !== docId; });
      state.presences = state.presences.filter(function(p) { return p._id !== docId; });
      renderMyActive();
      renderChart();
      renderNow();
      renderUpcoming();
      if (window.showNotification) window.showNotification('Presença cancelada.', 'info');
    });
  };

  // Entry point
  window.renderPresence = function(container) {
    // Any listener from a previous visit must go — otherwise it keeps
    // pushing snapshots into stale state/DOM.
    _teardownListener();
    // Initialize state from prefill or defaults
    var pre = _readPrefill();
    if (pre && pre.placeId) {
      state.venue = { placeId: pre.placeId, name: pre.venueName || pre.placeId, lat: pre.lat || null, lon: pre.lon || null };
    } else {
      state.venue = _defaultVenue();
    }
    if (pre && pre.sport) {
      state.sport = pre.sport;
      state.sports = [pre.sport];
    } else {
      state.sports = _defaultSports();
      state.sport = state.sports[0];
    }
    state.dayKey = window.PresenceDB.dayKey(new Date());
    render(container);
  };
})();
