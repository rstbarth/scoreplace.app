// ========================================
// scoreplace.app — Descobrir Locais (Venues)
// ========================================
// Public discovery view: find places to play. Works without login so
// travellers landing on the domain can browse before signing up.
//
// Route: #venues (with optional detail via #venues/<placeId>, handled
// here via inline modal rather than sub-route so the back button behaves
// intuitively in the SPA).

(function() {
  var SPORTS = ['Beach Tennis', 'Pickleball', 'Tênis', 'Tênis de Mesa', 'Padel', 'Futsal', 'Vôlei', 'Basquete'];
  var PRICE_OPTIONS = [
    { val: '',    label: 'Qualquer' },
    { val: '$',   label: '$' },
    { val: '$$',  label: '$$' },
    { val: '$$$', label: '$$$' }
  ];

  function _safe(s) { return window._safeHtml ? window._safeHtml(s) : String(s || ''); }

  var state = {
    city: '',
    sport: '',
    priceRange: '',
    minCourts: 0,
    loading: false,
    results: []
  };

  function render(container) {
    var back = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({ href: '#dashboard', label: 'Voltar' })
      : '';
    var sportOpts = '<option value="">Todas modalidades</option>' + SPORTS.map(function(s) {
      return '<option value="' + _safe(s) + '"' + (state.sport === s ? ' selected' : '') + '>' + _safe(s) + '</option>';
    }).join('');
    var priceBtns = PRICE_OPTIONS.map(function(p) {
      var active = (state.priceRange === p.val);
      return '<button type="button" onclick="window._venuesSetPrice(\'' + p.val + '\')" class="btn btn-sm" style="flex:1;min-width:54px;font-size:0.75rem;padding:7px 6px;border-radius:8px;background:' + (active ? '#6366f1' : 'transparent') + ';color:' + (active ? '#fff' : 'var(--text-muted)') + ';border:' + (active ? '2px solid #6366f1' : '1.5px solid var(--border-color)') + ';font-weight:' + (active ? '700' : '500') + ';">' + _safe(p.label) + '</button>';
    }).join('');

    container.innerHTML = back +
      '<div style="max-width:960px;margin:0 auto;padding:0 4px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap;">' +
          '<h2 style="margin:0;font-size:1.45rem;font-weight:800;color:var(--text-bright);flex:1;">🏢 Descobrir locais</h2>' +
        '</div>' +
        '<p style="margin:0 0 14px 0;color:var(--text-muted);font-size:0.88rem;">Encontre clubes, arenas e quadras abertas ao público — ideal quando você está viajando ou descobrindo a cidade.</p>' +
        '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;margin-bottom:14px;">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Cidade</label>' +
              '<input type="text" id="venues-city" value="' + _safe(state.city) + '" placeholder="Ex: São Paulo, Floripa…" oninput="window._venuesOnCity(this.value)" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Modalidade</label>' +
              '<select id="venues-sport" onchange="window._venuesSetSport(this.value)" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
                sportOpts +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Faixa de preço</label>' +
              '<div style="display:flex;gap:4px;">' + priceBtns + '</div>' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Mín. quadras</label>' +
              '<input type="number" min="0" max="99" value="' + (state.minCourts || '') + '" placeholder="0" oninput="window._venuesSetMinCourts(this.value)" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="venues-results" style="margin-bottom:2rem;"></div>' +
      '</div>';
    refresh();
  }

  function renderResults() {
    var box = document.getElementById('venues-results');
    if (!box) return;
    if (state.loading) {
      box.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">Carregando locais…</div>';
      return;
    }
    if (state.results.length === 0) {
      box.innerHTML =
        '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:2rem;text-align:center;color:var(--text-muted);">' +
          '<div style="font-size:2rem;margin-bottom:8px;">🗺️</div>' +
          '<div style="font-size:0.95rem;font-weight:600;color:var(--text-bright);margin-bottom:4px;">Nenhum local encontrado</div>' +
          '<div style="font-size:0.82rem;">Ajuste os filtros ou convide o dono do seu local a se cadastrar. Ele pode reivindicar em Perfil → "Sou dono de um local".</div>' +
        '</div>';
      return;
    }
    var html = '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">' + state.results.length + ' ' + (state.results.length === 1 ? 'local' : 'locais') + ' encontrado' + (state.results.length === 1 ? '' : 's') + '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">';
    state.results.forEach(function(v) {
      var sportsHtml = (Array.isArray(v.sports) ? v.sports : []).slice(0, 4).map(function(s) {
        return '<span style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-size:0.68rem;padding:2px 8px;border-radius:999px;margin-right:4px;margin-bottom:2px;">' + _safe(s) + '</span>';
      }).join('');
      var meta = [];
      if (v.courtCount) meta.push(v.courtCount + ' quadra' + (v.courtCount === 1 ? '' : 's'));
      if (v.priceRange) meta.push(v.priceRange);
      if (v.city) meta.push(v.city);
      var verified = v.verified ? '<span title="Verificado" style="color:#10b981;font-size:0.82rem;margin-left:4px;">✓</span>' : '';
      var proBadge = v.plan === 'pro' ? '<span style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:0.6rem;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px;">PRO</span>' : '';
      html +=
        '<div class="hover-lift" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;cursor:pointer;" onclick="window._venuesOpenDetail(\'' + _safe(v._id) + '\')">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
            '<span style="font-size:1.2rem;">🏢</span>' +
            '<div style="font-weight:700;color:var(--text-bright);font-size:0.95rem;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(v.name) + verified + proBadge + '</div>' +
          '</div>' +
          (v.address ? '<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ' + _safe(v.address) + '</div>' : '') +
          (sportsHtml ? '<div style="margin-bottom:6px;">' + sportsHtml + '</div>' : '') +
          (meta.length ? '<div style="font-size:0.75rem;color:var(--text-bright);font-weight:600;">' + _safe(meta.join(' · ')) + '</div>' : '') +
        '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }

  function refresh() {
    state.loading = true;
    renderResults();
    window.VenueDB.listVenues({
      city: state.city,
      sport: state.sport,
      priceRange: state.priceRange,
      minCourts: state.minCourts
    }).then(function(list) {
      state.results = list;
      state.loading = false;
      renderResults();
    }).catch(function(e) {
      state.loading = false;
      state.results = [];
      renderResults();
      console.warn('listVenues failed:', e);
    });
  }

  // Debounce user typing in city filter so we don't spam Firestore on each keystroke.
  window._venuesOnCity = function(v) {
    state.city = v;
    clearTimeout(window._venuesCityDebounce);
    window._venuesCityDebounce = setTimeout(refresh, 350);
  };
  window._venuesSetSport = function(v) { state.sport = v; refresh(); };
  window._venuesSetPrice = function(v) { state.priceRange = v; refresh(); render(document.getElementById('view-container')); };
  window._venuesSetMinCourts = function(v) {
    state.minCourts = parseInt(v, 10) || 0;
    clearTimeout(window._venuesCourtsDebounce);
    window._venuesCourtsDebounce = setTimeout(refresh, 250);
  };

  // Build a compact timeline slice for the venue detail modal: friends'
  // avatars who are here now + "+N outros", plus a one-line summary for
  // next hours. Uses the same classification rules as the presence view.
  async function _buildMovimentoHtml(venue) {
    if (!window.PresenceDB) return '';
    var dayKey = window.PresenceDB.dayKey(new Date());
    var presences = [];
    try { presences = await window.PresenceDB.loadForVenueDay(venue.placeId, dayKey); } catch (e) {}
    // Tournaments happening today at this venue (all sports) — from AppStore cache.
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    var tHere = tournaments.filter(function(t) {
      if (!t || !t.startDate) return false;
      if (window.VenueDB.venueKey(t.venuePlaceId, t.venue) !== venue.placeId) return false;
      var d = new Date(t.startDate);
      return !isNaN(d.getTime()) && window.PresenceDB.dayKey(d) === dayKey;
    });

    if (presences.length === 0 && tHere.length === 0) {
      return '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:10px;padding:12px;font-size:0.82rem;color:var(--text-muted);text-align:center;">Ninguém registrou presença ou torneio hoje neste local.</div>';
    }

    var cu = window.AppStore && window.AppStore.currentUser;
    var myUid = cu && cu.uid;
    var friendsUids = {};
    (cu && cu.friends ? cu.friends : []).forEach(function(u) { friendsUids[u] = true; });

    var now = Date.now();
    var activeNow = presences.filter(function(p) { return p.type === 'checkin' && p.startsAt <= now && p.endsAt > now; });
    var planned = presences.filter(function(p) { return p.type === 'planned' && p.startsAt > now; });

    // Split active into friends (with avatar) and others (counted)
    var friendAvatars = [];
    var seen = {};
    var otherNow = 0;
    activeNow.forEach(function(p) {
      var mine = (p.uid === myUid);
      var fr = p.uid && friendsUids[p.uid];
      if (mine || fr) {
        var k = p.uid || p.displayName;
        if (seen[k]) return;
        seen[k] = true;
        var name = p.displayName || 'Amigo';
        var initials = name.trim().split(/\s+/).map(function(s){return s.charAt(0);}).join('').substring(0,2).toUpperCase();
        var border = mine ? '#10b981' : '#fbbf24';
        var avatar = p.photoURL
          ? '<img title="' + _safe(name) + '" src="' + _safe(p.photoURL) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid ' + border + ';margin-left:-6px;">'
          : '<div title="' + _safe(name) + '" style="width:32px;height:32px;border-radius:50%;background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;border:2px solid ' + border + ';margin-left:-6px;">' + _safe(initials) + '</div>';
        friendAvatars.push(avatar);
      } else if (p.visibility === 'public') {
        otherNow += 1;
      }
    });

    // Also fold tournaments into the "now" count for UX consistency.
    tHere.forEach(function(t) {
      var start = new Date(t.startDate);
      var end = t.endDate ? new Date(t.endDate) : new Date(start.getTime() + 3 * 3600 * 1000);
      if (start.getTime() <= now && end.getTime() > now) {
        otherNow += Math.max(1, (Array.isArray(t.participants) ? t.participants.length : 1));
      }
    });

    var html = '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:10px;padding:12px;">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-weight:700;color:var(--text-bright);font-size:0.85rem;">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>' +
      'Agora no local' +
    '</div>';
    if (friendAvatars.length === 0 && otherNow === 0) {
      html += '<div style="font-size:0.78rem;color:var(--text-muted);">Ninguém registrou presença agora.</div>';
    } else {
      html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
      if (friendAvatars.length > 0) html += '<div style="display:flex;margin-left:6px;">' + friendAvatars.join('') + '</div>';
      if (otherNow > 0) html += '<span style="background:rgba(107,114,128,0.2);border:1px solid rgba(107,114,128,0.3);color:var(--text-bright);font-size:0.72rem;font-weight:600;padding:2px 10px;border-radius:999px;">👥 +' + otherNow + '</span>';
      html += '</div>';
    }

    // Upcoming today: group by hour bucket
    if (planned.length > 0 || tHere.some(function(t){ return new Date(t.startDate).getTime() > now; })) {
      html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);font-weight:700;color:var(--text-bright);font-size:0.82rem;margin-bottom:6px;">🗓️ Mais tarde hoje</div>';
      var allUpcoming = [];
      planned.forEach(function(p) { allUpcoming.push({ ts: p.startsAt, kind: 'presence', item: p }); });
      tHere.forEach(function(t) {
        var ts = new Date(t.startDate).getTime();
        if (ts > now) allUpcoming.push({ ts: ts, kind: 'tournament', item: t });
      });
      allUpcoming.sort(function(a, b) { return a.ts - b.ts; });
      allUpcoming.slice(0, 5).forEach(function(row) {
        var d = new Date(row.ts);
        var hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        if (row.kind === 'tournament') {
          html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-bright);margin-bottom:4px;">' +
            '<span style="min-width:44px;font-weight:600;">' + hhmm + '</span>' +
            '<span style="background:rgba(251,191,36,0.18);border:1px solid rgba(251,191,36,0.35);color:#fbbf24;padding:2px 8px;border-radius:999px;font-size:0.7rem;cursor:pointer;" onclick="window.location.hash=\'#tournaments/' + _safe(row.item.id) + '\'">🏆 ' + _safe(row.item.name || 'Torneio') + '</span>' +
          '</div>';
        } else {
          var p = row.item;
          var who = (p.uid === myUid) ? 'Você' : (friendsUids[p.uid] ? (p.displayName || 'Amigo') : null);
          if (who) {
            html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-bright);margin-bottom:4px;">' +
              '<span style="min-width:44px;font-weight:600;">' + hhmm + '</span>' +
              '<span>' + _safe(who) + (p.sport ? ' · ' + _safe(p.sport) : '') + '</span>' +
            '</div>';
          }
        }
      });
    }

    html += '</div>';
    return html;
  }

  // Detail: compact modal with contact actions + quick links into the rest of the app.
  window._venuesOpenDetail = async function(placeId) {
    var v = await window.VenueDB.loadVenue(placeId);
    if (!v) return;
    var prev = document.getElementById('venues-detail-overlay');
    if (prev) prev.remove();
    var sportsHtml = (Array.isArray(v.sports) ? v.sports : []).map(function(s) {
      return '<span style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-size:0.72rem;padding:3px 10px;border-radius:999px;margin-right:4px;">' + _safe(s) + '</span>';
    }).join('');
    var contactBits = [];
    var c = v.contact || {};
    if (c.phone) contactBits.push('<a href="tel:' + _safe(c.phone.replace(/\D/g,'')) + '" style="display:inline-flex;align-items:center;gap:6px;background:#3b82f6;color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:0.82rem;font-weight:600;">📞 Ligar</a>');
    if (c.whatsapp) {
      var wa = c.whatsapp.replace(/\D/g,'');
      if (wa && !wa.startsWith('55')) wa = '55' + wa;
      contactBits.push('<a href="https://wa.me/' + _safe(wa) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#25d366;color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:0.82rem;font-weight:600;">💬 WhatsApp</a>');
    }
    if (c.instagram) {
      var ig = String(c.instagram).replace(/^@/, '');
      contactBits.push('<a href="https://instagram.com/' + _safe(ig) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045);color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:0.82rem;font-weight:600;">📷 Instagram</a>');
    }
    if (c.email) contactBits.push('<a href="mailto:' + _safe(c.email) + '" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);padding:8px 14px;border-radius:10px;text-decoration:none;font-size:0.82rem;font-weight:600;">✉️ E-mail</a>');

    var mapsUrl = v.lat && v.lon
      ? 'https://www.google.com/maps/search/?api=1&query=' + v.lat + ',' + v.lon + (v.placeId && v.placeId.indexOf('custom:') !== 0 ? '&query_place_id=' + encodeURIComponent(v.placeId) : '')
      : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.name || ''));

    // Prefill data for cross-feature jumps into presence/create-tournament.
    var prefillJson = JSON.stringify({
      placeId: v.placeId,
      venueName: v.name,
      sport: (v.sports && v.sports[0]) || '',
      lat: v.lat, lon: v.lon
    });

    var overlay = document.createElement('div');
    overlay.id = 'venues-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10010;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:18px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.5);">' +
        '<div style="position:sticky;top:0;background:var(--bg-card);padding:16px 18px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:10px;z-index:2;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:800;color:var(--text-bright);font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏢 ' + _safe(v.name) + (v.verified ? ' <span title="Verificado" style="color:#10b981;">✓</span>' : '') + '</div>' +
            (v.address ? '<div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ' + _safe(v.address) + '</div>' : '') +
          '</div>' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'venues-detail-overlay\').remove()" style="flex-shrink:0;">Fechar</button>' +
        '</div>' +
        '<div style="padding:16px 18px;">' +
          (sportsHtml ? '<div style="margin-bottom:10px;">' + sportsHtml + '</div>' : '') +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:0.85rem;color:var(--text-bright);margin-bottom:12px;">' +
            (v.courtCount ? '<div>🎾 ' + v.courtCount + ' quadra' + (v.courtCount === 1 ? '' : 's') + (v.courtType ? ' (' + _safe(v.courtType) + ')' : '') + '</div>' : '') +
            (v.priceRange ? '<div>💰 ' + _safe(v.priceRange) + '</div>' : '') +
            (v.city ? '<div>🏙️ ' + _safe(v.city) + '</div>' : '') +
          '</div>' +
          (v.hours ? '<div style="font-size:0.82rem;color:var(--text-bright);margin-bottom:10px;">⏰ ' + _safe(v.hours) + '</div>' : '') +
          (v.description ? '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5;">' + _safe(v.description) + '</div>' : '') +
          (contactBits.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + contactBits.join('') + '</div>' : '') +
          '<div id="venue-movimento-slot" style="margin-bottom:12px;"></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
            '<a href="' + _safe(mapsUrl) + '" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none;">🗺️ Ver no mapa</a>' +
            '<button class="btn btn-sm" onclick=\'try{sessionStorage.setItem("_presencePrefill", ' + JSON.stringify(prefillJson) + ')}catch(e){}window.location.hash="#presence"\' style="background:#f59e0b;color:#1a0f00;border:none;font-weight:700;">📍 Ver presenças</button>' +
            '<button class="btn btn-sm btn-primary" onclick=\'window._venuesStartTournamentHere(' + JSON.stringify(prefillJson) + ')\'>🏆 Criar torneio aqui</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(ev) { if (ev.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    // Async: fetch presences + tournaments, inject into the slot so the
    // modal body stays snappy on open.
    _buildMovimentoHtml(v).then(function(html) {
      var slot = document.getElementById('venue-movimento-slot');
      if (slot && html) slot.innerHTML = html;
    });
  };

  // Bridge to tournament creation — stashes venue so create-tournament can read.
  window._venuesStartTournamentHere = function(prefillJson) {
    try { sessionStorage.setItem('_venuePrefill', prefillJson); } catch (e) {}
    var ov = document.getElementById('venues-detail-overlay');
    if (ov) ov.remove();
    if (typeof openModal === 'function') openModal('modal-quick-create');
  };

  window.renderVenues = render;
})();
