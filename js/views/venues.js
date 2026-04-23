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
  // Mesma lista de modalidades de create-tournament.js / venue-owner.js.
  var SPORTS = ['Beach Tennis', 'Pickleball', 'Tênis', 'Tênis de Mesa', 'Padel'];
  var PRICE_OPTIONS = [
    { val: '',    label: 'Qualquer' },
    { val: '$',   label: '$' },
    { val: '$$',  label: '$$' },
    { val: '$$$', label: '$$$' }
  ];

  function _safe(s) { return window._safeHtml ? window._safeHtml(s) : String(s || ''); }

  // Filtros persistem entre sessões — usuário não precisa reajustar cada vez.
  var FILTER_STORAGE_KEY = 'scoreplace_venues_filters';
  function _loadSavedFilters() {
    try {
      var raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) { return {}; }
  }
  function _saveFilters() {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        location: state.location,
        sport: state.sport,
        priceRange: state.priceRange,
        minCourts: state.minCourts,
        distanceKm: state.distanceKm,
        center: state.center,
        centerFromGps: !!state.centerFromGps
      }));
    } catch (e) {}
  }
  var _saved = _loadSavedFilters();

  var state = {
    location: _saved.location || '',
    sport: _saved.sport || '',
    priceRange: _saved.priceRange || '',
    minCourts: _saved.minCourts || 1,
    distanceKm: _saved.distanceKm || 10,
    center: (_saved.center && _saved.center.lat != null) ? _saved.center : null,
    centerFromGps: !!_saved.centerFromGps,
    loading: false,
    results: [],
    googleResults: [],
    showAllSP: false,
    mode: 'map',
    selectedPlace: null
  };

  // Google Maps state — persisted across re-renders so we don't re-init.
  var _map = null;
  var _markers = [];
  var _mapsLibs = null;
  var _selectedPlaceMarker = null;

  async function _ensureMap() {
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return;
    if (!_mapsLibs) {
      try {
        var Maps = await google.maps.importLibrary('maps');
        var Marker = await google.maps.importLibrary('marker');
        _mapsLibs = { Map: Maps.Map, AdvancedMarkerElement: Marker.AdvancedMarkerElement, PinElement: Marker.PinElement };
      } catch (e) { console.warn('Google Maps load failed:', e); return; }
    }
    var el = document.getElementById('venues-map');
    if (!el) return;
    if (!_map) {
      // Prefer the resolved city center; if we don't have one yet just
      // show Brazil — the async geocode will re-center once it resolves.
      var initialCenter = state.center || { lat: -15.78, lng: -47.93 };
      var initialZoom = state.center ? 12 : 4;
      _map = new _mapsLibs.Map(el, {
        center: initialCenter,
        zoom: initialZoom,
        mapId: 'scoreplace-venues-map',
        disableDefaultUI: false,
        clickableIcons: false,
        // 'cooperative' on mobile requires two-finger pan to move the map
        // (single-finger scroll the page). On desktop, requires Ctrl+scroll
        // to zoom. Prevents the user from getting "stuck" on the map while
        // trying to scroll the page vertically. Combined with the side
        // gutter below, vertical scrolling always has a safe touch zone.
        gestureHandling: 'cooperative'
      });
    } else {
      // Nudge the map to recompute size when it was display:none during init.
      google.maps.event.trigger(_map, 'resize');
    }
    _renderMarkers();
  }

  function _clearMarkers() {
    _markers.forEach(function(m) { if (m && m.map) m.map = null; });
    _markers = [];
  }

  // Circle that visualizes the current search radius around state.center.
  // Redrawn on every _renderMarkers so it tracks center + distanceKm.
  var _radiusCircle = null;
  var _centerMarker = null;
  function _pinSelectedPlace(lat, lng, name) {
    if (!_map || !_mapsLibs) return;
    if (_selectedPlaceMarker) { _selectedPlaceMarker.map = null; _selectedPlaceMarker = null; }
    var pos = { lat: Number(lat), lng: Number(lng) };
    var pin = new _mapsLibs.PinElement({
      background: '#6366f1', borderColor: '#3730a3', glyph: '📍', glyphColor: '#fff', scale: 1.4
    });
    _selectedPlaceMarker = new _mapsLibs.AdvancedMarkerElement({
      map: _map, position: pos, title: name || 'local selecionado', content: pin.element, zIndex: 1000
    });
    _map.setCenter(pos);
    _map.setZoom(15);
  }

  function _renderRadiusCircle() {
    if (!_map || !window.google || !window.google.maps) return;
    if (_radiusCircle) { _radiusCircle.setMap(null); _radiusCircle = null; }
    if (_centerMarker) { _centerMarker.map = null; _centerMarker = null; }
    if (!state.center) return;
    // Círculo do raio — visual do que a busca cobre.
    if (state.distanceKm) {
      _radiusCircle = new google.maps.Circle({
        strokeColor: '#6366f1',
        strokeOpacity: 0.55,
        strokeWeight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.08,
        map: _map,
        center: state.center,
        radius: state.distanceKm * 1000
      });
    }
    // Pin na posição do usuário — cor distinta (verde) dos pins de venue.
    if (_mapsLibs && _mapsLibs.AdvancedMarkerElement && _mapsLibs.PinElement) {
      var pin = new _mapsLibs.PinElement({
        background: '#10b981',
        borderColor: '#064e3b',
        glyph: '📍',
        glyphColor: '#fff',
        scale: 1.2
      });
      _centerMarker = new _mapsLibs.AdvancedMarkerElement({
        map: _map,
        position: state.center,
        title: 'Sua localização',
        content: pin.element,
        zIndex: 999 // por cima dos pins de venue
      });
    }
  }

  function _renderMarkers() {
    if (!_map || !_mapsLibs) return;
    _clearMarkers();
    _renderRadiusCircle();
    var bounds = new google.maps.LatLngBounds();
    var anyPoints = 0;

    // 1) Pins dos locais cadastrados na scoreplace (âmbar = free, índigo = pro).
    state.results.forEach(function(v) {
      if (v.lat == null || v.lon == null) return;
      var pos = { lat: Number(v.lat), lng: Number(v.lon) };
      var pin = new _mapsLibs.PinElement({
        background: v.plan === 'pro' ? '#6366f1' : '#f59e0b',
        borderColor: '#1e293b',
        glyph: '🏢',
        glyphColor: '#fff',
        scale: 1.1
      });
      var marker = new _mapsLibs.AdvancedMarkerElement({
        map: _map,
        position: pos,
        title: v.name || '',
        content: pin.element
      });
      marker.addListener('click', function() {
        if (typeof window._venuesOpenDetail === 'function') window._venuesOpenDetail(v._id);
      });
      _markers.push(marker);
      bounds.extend(pos);
      anyPoints += 1;
    });

    // 2) Pins de sugestões do Google Places — cinza translúcido pra diferenciar
    // visualmente dos locais cadastrados (que ganham cor cheia). Antes os
    // Google suggestions só apareciam na lista abaixo do mapa, o que deixava
    // a visão espacial vazia em áreas sem venues claimed. Click abre o local
    // no Google Maps em nova aba (não abre modal interna porque ainda não
    // existe na base da scoreplace — o dono pode reivindicar depois).
    var g = state.googleResults || [];
    g.forEach(function(p) {
      if (p.lat == null || p.lng == null) return;
      // Skip se já tem um venue cadastrado com o mesmo placeId — evita duplicar
      // o mesmo lugar com pin cheio + pin translúcido no mesmo ponto.
      var dupInClaimed = state.results.some(function(v) { return v.placeId && v.placeId === p.placeId; });
      if (dupInClaimed) return;
      var pos = { lat: Number(p.lat), lng: Number(p.lng) };
      var pin = new _mapsLibs.PinElement({
        background: '#64748b',       // slate-500 — discreto vs âmbar/índigo dos claimed
        borderColor: '#1e293b',
        glyph: '🔎',
        glyphColor: '#e2e8f0',
        scale: 0.9                    // menor que claimed pra reforçar hierarquia visual
      });
      var marker = new _mapsLibs.AdvancedMarkerElement({
        map: _map,
        position: pos,
        title: (p.name || '') + ' (sugestão Google)',
        content: pin.element
      });
      marker.addListener('click', function() {
        var url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name || '') +
          (p.placeId ? '&query_place_id=' + encodeURIComponent(p.placeId) : '');
        try { window.open(url, '_blank', 'noopener'); } catch(e) {}
      });
      _markers.push(marker);
      bounds.extend(pos);
      anyPoints += 1;
    });

    // Zoom/fit lógica: com center resolvido (GPS ou geocoder), mantemos o
    // usuário centrado e o raio visível em vez de pular pra bounds dos pins,
    // que faria o mapa dar zoom-out excessivo quando um pin está longe.
    // Só usamos fitBounds quando NÃO temos center (fallback) e existem pins.
    if (state.center) {
      // Center já foi setado em refresh() — aqui só garantimos zoom minimo
      // pra mostrar o raio inteiro: zoom 13 cobre ~10km, zoom 11 cobre ~40km.
      // Heurística simples: zoom = 14 - log2(distanceKm / 2) aproximado.
      var z = 13;
      if (state.distanceKm > 30) z = 10;
      else if (state.distanceKm > 15) z = 11;
      else if (state.distanceKm > 7) z = 12;
      if (_map.getZoom && _map.getZoom() < z - 1) _map.setZoom(z);
    } else if (anyPoints === 1) {
      _map.setCenter(bounds.getCenter());
      _map.setZoom(14);
    } else if (anyPoints > 1) {
      _map.fitBounds(bounds, 60);
    }
  }

  // Sport icon helper (local copy — venue-owner.js has another in its closure).
  function _sportIcon(sport) {
    var s = String(sport || '').toLowerCase();
    if (s.indexOf('beach') !== -1) return '🏖️';
    if (s.indexOf('pickleball') !== -1) return '🥒';
    if (s.indexOf('padel') !== -1) return '🏸';
    if (s.indexOf('mesa') !== -1) return '🏓';
    if (s.indexOf('squash') !== -1) return '🟡';
    if (s.indexOf('vôlei') !== -1 || s.indexOf('volei') !== -1) return '🏐';
    if (s.indexOf('futvôlei') !== -1 || s.indexOf('futvolei') !== -1) return '🏐';
    if (s.indexOf('futebol') !== -1) return '⚽';
    if (s.indexOf('basquete') !== -1) return '🏀';
    return '🎾';
  }

  function _sportSelectHtml() {
    var opts = [''].concat(SPORTS).map(function(s) {
      var label = s === '' ? 'Todas as modalidades' : (_sportIcon(s) + ' ' + s);
      var sel = state.sport === s ? ' selected' : '';
      return '<option value="' + _safe(s) + '"' + sel + '>' + _safe(label) + '</option>';
    }).join('');
    return '<select id="venues-sport-select" onchange="window._venuesSetSport(this.value)" style="' +
      'width:100%;padding:10px 40px 10px 14px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-color);' +
      'color:var(--text-bright);font-size:0.88rem;font-weight:600;cursor:pointer;outline:none;">' +
      opts + '</select>';
  }

  function render(container) {
    _map = null;
    _markers = [];
    _selectedPlaceMarker = null;
    state.selectedPlace = null;
    state.showAllSP = false;
    if (!state.location && !state.centerFromGps) {
      var cu = window.AppStore && window.AppStore.currentUser;
      var profileCity = cu && cu.city ? String(cu.city).trim() : '';
      if (profileCity) state.location = profileCity;
    }
    _tryAutoGeolocate();

    container.innerHTML =
      // ── Sport dropdown — full width, above map ──
      '<div style="padding:10px 16px;border-bottom:1px solid var(--border-color);">' +
        _sportSelectHtml() +
      '</div>' +
      // ── Map — padded + rounded to match the fields ──
      '<div style="padding:10px 16px 0;">' +
        '<div id="venues-map" style="width:100%;height:clamp(180px,30vh,280px);background:#0a0e1a;border-radius:12px;overflow:hidden;border:1px solid var(--border-color);display:block;"></div>' +
      '</div>' +
      // ── Search bar ──
      '<div style="padding:12px 16px 0;">' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<div style="flex:1;min-width:0;position:relative;">' +
            '<input type="text" id="venues-location" value="' + _safe(state.location) + '" placeholder="Buscar por nome, endereço ou bairro…" oninput="window._venuesOnLocation(this.value)" onfocus="this.select()" onclick="this.select()" onblur="setTimeout(function(){var b=document.getElementById(\'venues-suggestions\');if(b)b.style.display=\'none\';},200)" autocomplete="off" style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;outline:none;">' +
            '<div id="venues-suggestions" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:9999;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;max-height:260px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);"></div>' +
          '</div>' +
          '<button type="button" id="venues-geo-btn" onclick="window._venuesUseMyLocation(true)" title="Usar minha localização" style="flex-shrink:0;width:46px;height:46px;border-radius:12px;background:#6366f1;border:none;color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">📍</button>' +
        '</div>' +
      '</div>' +
      // ── Results (appear after GPS / search) ──
      '<div id="venues-results" style="padding:12px 16px 2rem;"></div>';

    _ensureMap();
    refresh();
  }

  window._venuesSetMode = function() {}; // no-op — kept for compat

  function _registerCtaHtml() {
    return '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
      '<span style="font-size:0.8rem;color:var(--text-muted);">Não encontrou seu local?</span>' +
      '<button class="btn btn-sm btn-primary hover-lift" onclick="window.location.hash=\'#my-venues\'" style="white-space:nowrap;">+ Cadastrar local</button>' +
    '</div>';
  }

  function _venueCard(v) {
    var sportsHtml = (Array.isArray(v.sports) ? v.sports : []).slice(0, 5).map(function(s) {
      return '<span style="font-size:0.65rem;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:2px 8px;border-radius:999px;">' + _safe(s) + '</span>';
    }).join('');
    var officialBadge = v.ownerUid
      ? '<span style="font-size:0.6rem;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#10b981;padding:1px 7px;border-radius:999px;font-weight:700;">✅ oficial</span>'
      : (v.createdByName ? '<span style="font-size:0.6rem;background:rgba(148,163,184,0.1);border:1px solid rgba(148,163,184,0.25);color:#94a3b8;padding:1px 7px;border-radius:999px;">comunidade</span>' : '');
    var distText = '';
    if (state.center && v.lat != null && v.lon != null) {
      var d = _haversineKm(state.center, { lat: Number(v.lat), lng: Number(v.lon) });
      distText = d < 1 ? Math.round(d * 1000) + 'm' : d.toFixed(1) + 'km';
    }
    return '<div onclick="window._venuesOpenDetail(\'' + _safe(v._id) + '\')" class="hover-lift" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">' +
          '<span style="font-weight:700;color:var(--text-bright);font-size:0.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏢 ' + _safe(v.name) + '</span>' +
          officialBadge +
        '</div>' +
        (v.address ? '<div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;">' + _safe(v.address) + '</div>' : '') +
        (sportsHtml ? '<div style="display:flex;flex-wrap:wrap;gap:3px;">' + sportsHtml + '</div>' : '') +
      '</div>' +
      (distText ? '<div style="flex-shrink:0;font-size:0.74rem;font-weight:600;color:var(--text-muted);text-align:right;min-width:36px;">' + _safe(distText) + '</div>' : '') +
    '</div>';
  }

  function _googleVenueCard(p) {
    var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name || '') + (p.placeId ? '&query_place_id=' + encodeURIComponent(p.placeId) : '');
    var distText = '';
    if (state.center && p.lat != null && p.lng != null) {
      var d = _haversineKm(state.center, { lat: Number(p.lat), lng: Number(p.lng) });
      distText = d < 1 ? Math.round(d * 1000) + 'm' : d.toFixed(1) + 'km';
    }
    return '<a href="' + _safe(mapsUrl) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;background:var(--bg-darker);border:1px solid var(--border-color);border-radius:12px;padding:12px 14px;text-decoration:none;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;color:var(--text-bright);font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">🗺️ ' + _safe(p.name) + '</div>' +
        (p.address ? '<div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(p.address) + '</div>' : '') +
      '</div>' +
      (distText ? '<div style="flex-shrink:0;font-size:0.74rem;font-weight:600;color:var(--text-muted);min-width:36px;text-align:right;">' + _safe(distText) + '</div>' : '') +
      '<span style="flex-shrink:0;font-size:0.64rem;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.25);color:#94a3b8;padding:2px 8px;border-radius:999px;">Google</span>' +
    '</a>';
  }

  function _selectedPlaceCard(p) {
    var ev = p.existingVenue;
    var borderColor = ev ? '#10b981' : '#6366f1';
    var safeName = _safe(p.name || '');
    var safeId = _safe(p.placeId || '');
    if (ev) {
      // Registered → compact one-liner, click opens venue detail with courts etc.
      return '<div onclick="window._venuesOpenDetail(\'' + safeId + '\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--bg-card);border:2px solid ' + borderColor + ';border-radius:12px;padding:10px 14px;margin-bottom:14px;">' +
        '<span style="font-weight:700;color:var(--text-bright);font-size:0.9rem;flex:1;min-width:0;word-break:break-word;">📍 ' + safeName + '</span>' +
        '<span style="flex-shrink:0;display:flex;align-items:center;gap:3px;font-size:0.78rem;font-weight:700;color:#10b981;white-space:nowrap;">✅ Score</span>' +
      '</div>';
    } else {
      var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name || '') +
        (p.placeId ? '&query_place_id=' + encodeURIComponent(p.placeId) : '');
      return '<a href="' + _safe(mapsUrl) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;background:var(--bg-card);border:2px solid ' + borderColor + ';border-radius:12px;padding:10px 14px;margin-bottom:14px;text-decoration:none;">' +
        '<span style="font-weight:700;color:var(--text-bright);font-size:0.9rem;flex:1;min-width:0;word-break:break-word;">📍 ' + safeName + '</span>' +
        '<span style="flex-shrink:0;font-size:0.72rem;color:#94a3b8;white-space:nowrap;">🗺️</span>' +
      '</a>';
    }
  }

  function renderResults() {
    var box = document.getElementById('venues-results');
    if (!box) return;
    var selHtml = state.selectedPlace ? _selectedPlaceCard(state.selectedPlace) : '';
    if (state.loading) {
      box.innerHTML = selHtml + '<div style="text-align:center;color:var(--text-muted);padding:1.5rem 0;font-size:0.88rem;">Buscando locais próximos…</div>';
      return;
    }
    var hasResults = state.results.length > 0 || (state.googleResults || []).length > 0;
    if (!state.center && !hasResults && !state.selectedPlace) {
      box.innerHTML =
        '<div style="text-align:center;padding:2rem 0;">' +
          '<div style="font-size:2.2rem;margin-bottom:8px;">📍</div>' +
          '<div style="font-weight:700;color:var(--text-bright);font-size:1rem;margin-bottom:6px;">Onde você está?</div>' +
          '<div style="color:var(--text-muted);font-size:0.84rem;max-width:280px;margin:0 auto;">Toque em 📍 para usar sua localização ou busque um endereço acima.</div>' +
        '</div>';
      return;
    }

    // Section 1: Scoreplace registered venues sorted by distance
    var spResults = state.results.slice();
    if (state.center) {
      spResults.sort(function(a, b) {
        var da = (a.lat != null && a.lon != null) ? _haversineKm(state.center, { lat: Number(a.lat), lng: Number(a.lon) }) : Infinity;
        var db = (b.lat != null && b.lon != null) ? _haversineKm(state.center, { lat: Number(b.lat), lng: Number(b.lon) }) : Infinity;
        return da - db;
      });
    }
    var SHOW_LIMIT = 5;
    var displaySP = state.showAllSP ? spResults : spResults.slice(0, SHOW_LIMIT);

    // Section 2: Google Places deduplicated and sorted by distance
    var gResults = (state.googleResults || []).filter(function(p) {
      return !state.results.some(function(v) { return v.placeId && v.placeId === p.placeId; });
    });
    if (state.center) {
      gResults.sort(function(a, b) {
        var da = (a.lat != null && a.lng != null) ? _haversineKm(state.center, { lat: Number(a.lat), lng: Number(a.lng) }) : Infinity;
        var db = (b.lat != null && b.lng != null) ? _haversineKm(state.center, { lat: Number(b.lat), lng: Number(b.lng) }) : Infinity;
        return da - db;
      });
    }

    var html = selHtml;

    if (spResults.length > 0) {
      html += '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.22);border-radius:14px;padding:10px 12px;margin-bottom:14px;">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🏢 Locais registrados no scoreplace</div>';
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';
      displaySP.forEach(function(v) { html += _venueCard(v); });
      html += '</div>';
      if (spResults.length > SHOW_LIMIT && !state.showAllSP) {
        html += '<button onclick="window._venuesShowAllSP()" style="margin-top:8px;background:none;border:none;color:#a5b4fc;font-size:0.82rem;cursor:pointer;padding:2px 0;">Mostrar mais (' + (spResults.length - SHOW_LIMIT) + ' locais) →</button>';
      }
      html += '</div>';
    }

    if (gResults.length > 0) {
      var gTop = spResults.length > 0 ? 'margin-top:14px;margin-bottom:8px;' : 'margin-bottom:8px;';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;' + gTop + '">📍 Sugestões do Google</div>';
      html += '<div style="display:flex;flex-direction:column;gap:8px;">';
      gResults.forEach(function(p) { html += _googleVenueCard(p); });
      html += '</div>';
    }

    if (spResults.length === 0 && gResults.length === 0) {
      html += '<div style="text-align:center;padding:1.5rem 0;color:var(--text-muted);font-size:0.85rem;">Nenhum local encontrado nessa região.</div>';
    }

    html += _registerCtaHtml();
    box.innerHTML = html;
  }

  window._venuesShowAllSP = function() { state.showAllSP = true; renderResults(); };

  // Stubs for old map-extras functions — new layout renders list inline below map.
  function _hydrateMapSummary() {}
  function _hydrateMapExtras() {}

  async function refresh() {
    state.loading = true;
    renderResults();
    // Reflete "Buscando…" no summary acima do mapa também, não só na lista.
    _hydrateMapSummary();
    // Resolve city → lat/lng so we can center the map AND apply the
    // distance filter. If the user hasn't typed a city, fall back to their
    // profile's preferred location or the Brazil default.
    var center = null;
    // GPS tem prioridade absoluta — não jogamos fora o lat/lng preciso
    // do dispositivo em troca do resultado aproximado do geocoder.
    if (state.centerFromGps && state.center) {
      center = state.center;
    } else if (state.location) {
      center = await _geocodeCity(state.location);
    }
    // Fallback preferredLocations removido: o usuário pediu explicitamente
    // que "quando clica na localização é pra usar o gps e não puxar dos
    // locais preferidos do perfil". Sem center válido → sem filtro de raio.
    state.center = center;
    _saveFilters();
    state.showAllSP = false;

    // 1) Our own claimed venues. Não filtramos mais pelo texto do campo
    // "Local" no doc — o raio (Haversine) cobre a proximidade, e texto livre
    // como "Av. Paulista 1000" nunca casaria com v.city gravado como "São
    // Paulo". Se o geocoder falhar e não resolver um centro, não filtramos
    // nada de localidade (mostra todos os venues). Campo `city` ainda é
    // aceito pelo VenueDB para compat mas passamos vazio aqui.
    try {
      var list = await window.VenueDB.listVenues({
        sport: state.sport,
        priceRange: state.priceRange,
        minCourts: state.minCourts
      });
      // Apply distance filter when we have a center — keeps results relevant.
      if (center && state.distanceKm > 0) {
        list = list.filter(function(v) {
          if (v.lat == null || v.lon == null) return true; // sem coords = mantém, aparece na lista
          var d = _haversineKm(center, { lat: Number(v.lat), lng: Number(v.lon) });
          return d <= state.distanceKm;
        });
      }
      state.results = list;
    } catch (e) {
      console.warn('listVenues failed:', e);
      state.results = [];
    }

    // 2) Google Places nearby — external suggestions. Only fires when we
    // have a real center so we don't waste the Places quota.
    if (center) {
      state.googleResults = await _loadGoogleNearby(center, state.distanceKm, state.sport);
    } else {
      state.googleResults = [];
    }

    state.loading = false;
    renderResults();
    _hydrateMapExtras();
    if (_map) {
      if (center) {
        _map.setCenter(center);
        // When coming from Brazil default + a now-known center, zoom in.
        if (_map.getZoom && _map.getZoom() <= 5) _map.setZoom(12);
      }
      _renderMarkers(); // desenha venues + círculo do raio
    }
  }

  // ── Places autocomplete for the search field ──────────────────────────────
  var _venuesPlacesReady = false;
  async function _ensureVenuesPlaces() {
    if (_venuesPlacesReady) return;
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return;
    try { await google.maps.importLibrary('places'); _venuesPlacesReady = true; } catch(e) {}
  }

  async function _doVenuesSearch(query) {
    var box = document.getElementById('venues-suggestions');
    if (!box) return;
    var q = String(query || '').trim();
    if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = '';
    var hasAny = false;
    var qLow = q.toLowerCase();

    // Section 1: registered scoreplace venues matching query by name/address
    var matchedSP = (state.results || []).filter(function(v) {
      return (v.name && v.name.toLowerCase().indexOf(qLow) !== -1) ||
             (v.address && v.address.toLowerCase().indexOf(qLow) !== -1);
    }).slice(0, 5);
    if (matchedSP.length > 0) {
      var spHdr = document.createElement('div');
      spHdr.style.cssText = 'padding:5px 14px 4px;font-size:0.66rem;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;';
      spHdr.textContent = '🏢 No scoreplace';
      box.appendChild(spHdr);
      matchedSP.forEach(function(v) {
        var item = document.createElement('div');
        item.style.cssText = 'padding:9px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);';
        item.innerHTML = '<div style="color:var(--text-bright);font-size:0.88rem;font-weight:600;">✅ ' + _safe(v.name) + '</div>' +
          (v.address ? '<div style="color:var(--text-muted);font-size:0.74rem;margin-top:1px;">' + _safe(v.address) + '</div>' : '');
        item.addEventListener('mouseenter', function() { item.style.background = 'rgba(16,185,129,0.1)'; });
        item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
        item.addEventListener('mousedown', function(ev) {
          ev.preventDefault();
          box.style.display = 'none';
          window._venuesOpenDetail(v._id);
        });
        box.appendChild(item);
      });
      hasAny = true;
    }

    // Section 2: Google Places autocomplete
    await _ensureVenuesPlaces();
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      if (hasAny) box.style.display = 'block';
      return;
    }
    var sugs = [];
    try {
      var result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ['br'],
        includedPrimaryTypes: ['establishment'],
        language: 'pt-BR'
      });
      sugs = (result.suggestions || []).filter(function(s) { return s.placePrediction; });
    } catch(e) {}
    if (sugs.length > 0) {
      if (hasAny) {
        var gHdr = document.createElement('div');
        gHdr.style.cssText = 'padding:5px 14px 4px;font-size:0.66rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;border-top:1px solid rgba(255,255,255,0.08);';
        gHdr.textContent = '📍 Google Places';
        box.appendChild(gHdr);
      }
      sugs.slice(0, 6).forEach(function(s) {
        var pred = s.placePrediction;
        var main = pred.mainText ? pred.mainText.text : '';
        var sec = pred.secondaryText ? pred.secondaryText.text : '';
        var item = document.createElement('div');
        item.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);';
        item.innerHTML = '<div style="color:var(--text-bright);font-size:0.88rem;font-weight:500;">📍 ' + _safe(main) + '</div>' +
          (sec ? '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px;">' + _safe(sec) + '</div>' : '');
        item.addEventListener('mouseenter', function() { item.style.background = 'rgba(99,102,241,0.12)'; });
        item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
        item.addEventListener('mousedown', function(ev) { ev.preventDefault(); _venuesSelectPlace(pred); });
        box.appendChild(item);
      });
      hasAny = true;
    }
    if (!hasAny) { box.style.display = 'none'; return; }
    box.style.display = 'block';
  }

  async function _venuesSelectPlace(pred) {
    var box = document.getElementById('venues-suggestions');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    var inp = document.getElementById('venues-location');
    try {
      var place = pred.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'id'] });
      var loc = place.location;
      var lat = loc ? loc.lat() : null;
      var lng = loc ? loc.lng() : null;
      var label = place.displayName || (pred.mainText && pred.mainText.text) || '';
      state.location = label;
      state.centerFromGps = false;
      if (inp) inp.value = label;
      if (lat != null && lng != null) {
        state.center = { lat: lat, lng: lng };
        _pinSelectedPlace(lat, lng, label);
      }
      // Check if this place is already registered in scoreplace
      var existingVenue = null;
      if (place.id && window.VenueDB) {
        try { existingVenue = await window.VenueDB.loadVenue(place.id); } catch(e) {}
      }
      state.selectedPlace = { name: label, address: place.formattedAddress || '', placeId: place.id || '', lat: lat, lng: lng, existingVenue: existingVenue };
    } catch(e) {
      var main = pred.mainText ? pred.mainText.text : '';
      state.location = main;
      state.selectedPlace = { name: main, address: '', placeId: '', existingVenue: null };
      if (inp) inp.value = main;
    }
    _saveFilters();
    renderResults(); // show detail card immediately (with existing venue status)
    refresh();       // search nearby in background
  }

  window._venuesOnLocation = function(v) {
    state.location = v;
    state.centerFromGps = false;
    _saveFilters();
    clearTimeout(window._venuesLocationDebounce);
    window._venuesLocationDebounce = setTimeout(function() { _doVenuesSearch(v); }, 200);
  };
  window._venuesSetSport = function(v) { state.sport = v; _saveFilters(); refresh(); };
  window._venuesSetPrice = function(v) { state.priceRange = v; _saveFilters(); refresh(); render(document.getElementById('view-container')); };
  window._venuesSetMinCourts = function(v) {
    state.minCourts = parseInt(v, 10) || 1;
    _saveFilters();
    clearTimeout(window._venuesCourtsDebounce);
    window._venuesCourtsDebounce = setTimeout(refresh, 250);
  };
  window._venuesSetDistance = function(v) {
    state.distanceKm = Math.max(1, Math.min(500, parseInt(v, 10) || 10));
    _saveFilters();
    clearTimeout(window._venuesDistDebounce);
    window._venuesDistDebounce = setTimeout(refresh, 250);
  };

  // Reverse geocode lat/lng into a legible "endereço, bairro, cidade".
  // Lazy-loads o Geocoder. Preferimos street_address → route → premise →
  // primeiro resultado, evitando retornar plus codes ou cell towers que o
  // Google às vezes devolve como results[0]. Retorna null se indisponível.
  async function _reverseGeocode(lat, lng) {
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return null;
    try {
      await google.maps.importLibrary('geocoding');
      var geocoder = new google.maps.Geocoder();
      return await new Promise(function(resolve) {
        geocoder.geocode({ location: { lat: lat, lng: lng }, language: 'pt-BR', region: 'br' }, function(results, status) {
          if (status !== 'OK' || !results || results.length === 0) { resolve(null); return; }
          var preferred = ['street_address', 'route', 'premise', 'neighborhood', 'sublocality', 'locality'];
          for (var i = 0; i < preferred.length; i++) {
            var t = preferred[i];
            for (var j = 0; j < results.length; j++) {
              if ((results[j].types || []).indexOf(t) !== -1) {
                resolve(results[j].formatted_address);
                return;
              }
            }
          }
          resolve(results[0].formatted_address);
        });
      });
    } catch (e) { return null; }
  }

  // Ask the browser for GPS and populate state.location + state.center from
  // the resolved address. Flag `userTriggered` distinguishes an explicit 📍
  // click (we tell the user if denied) from the silent auto-try on view load.
  window._venuesUseMyLocation = function(userTriggered) {
    if (!navigator.geolocation) {
      if (userTriggered && window.showNotification) window.showNotification('GPS indisponível neste dispositivo.', '', 'error');
      return;
    }
    var btn = document.getElementById('venues-geo-btn');
    if (btn && userTriggered) { btn.disabled = true; btn.textContent = '⏳'; }
    navigator.geolocation.getCurrentPosition(async function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      state.center = { lat: lat, lng: lng };
      // Flag que sinaliza "centro veio do GPS, não mexe" — o refresh() não
      // deve rodar o geocoder em cima do endereço e sobrescrever o lat/lng
      // preciso do dispositivo.
      state.centerFromGps = true;
      var address = await _reverseGeocode(lat, lng);
      state.location = address || 'Minha localização atual';
      _saveFilters();
      var inp = document.getElementById('venues-location');
      if (inp) inp.value = state.location;
      if (btn) { btn.disabled = false; btn.textContent = '📍'; }
      refresh();
    }, function(err) {
      if (btn) { btn.disabled = false; btn.textContent = '📍'; }
      if (userTriggered && window.showNotification) {
        window.showNotification('Não foi possível obter sua localização.', err && err.message ? err.message : 'Verifique a permissão no navegador.', 'info');
      }
    }, { timeout: 8000, maximumAge: 5 * 60 * 1000 });
  };

  // Auto-geolocate na primeira abertura da view. O usuário pediu que a
  // página abra como se o 📍 já tivesse sido clicado — em TODOS os devices.
  //   - Se permissão = granted: resolve silencioso.
  //   - Se permissão = prompt: browser mostra o diálogo nativo imediatamente.
  //   - Se permissão = denied: erro catch-ado em _venuesUseMyLocation(false),
  //     fallback na cidade do perfil/filtro salvo.
  // Idempotência: controlada pelo caller via `state.centerFromGps` (já fez
  // GPS nesta sessão → não re-pede). Sem sessionStorage flag — refresh da
  // página deve re-disparar o GPS automaticamente.
  function _tryAutoGeolocate() {
    // Dispara independente de mobile/desktop, independente de permissão
    // prévia. userTriggered=false mantém o UI silencioso se o user negar.
    window._venuesUseMyLocation(false);
  }

  // ── Geocoding: center the map on the typed city (or user's profile city).
  // Uses google.maps.Geocoder lazily. Cached so we don't repeat the same
  // lookup. Result also feeds the Haversine filter for the distance slider.
  var _geocodeCache = {};
  async function _geocodeCity(city) {
    if (!city) return null;
    var key = city.toLowerCase().trim();
    if (_geocodeCache[key]) return _geocodeCache[key];
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return null;
    try {
      await google.maps.importLibrary('geocoding');
      var geocoder = new google.maps.Geocoder();
      return await new Promise(function(resolve) {
        geocoder.geocode({ address: city + ', Brasil' }, function(results, status) {
          if (status === 'OK' && results && results[0] && results[0].geometry) {
            var loc = results[0].geometry.location;
            var coords = { lat: loc.lat(), lng: loc.lng() };
            _geocodeCache[key] = coords;
            resolve(coords);
          } else {
            resolve(null);
          }
        });
      });
    } catch (e) { return null; }
  }

  function _haversineKm(a, b) {
    if (!a || !b) return Infinity;
    var R = 6371;
    var toRad = function(d) { return d * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var s = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat)) *
            Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  // Places nearby: lightweight discovery of external venues (not yet claimed
  // in scoreplace) so the user sees what Google knows about the area. Free
  // tier allows ~17k queries/month — debounced + gated on a real center so
  // we don't burn quota. Returns up to 15 places.
  //
  // Default query strategy (vamos refinar depois):
  // - Sem modalidade: busca ampla com múltiplos termos esportivos
  //   ("quadra esportiva clube arena") pra cobrir beach tennis, tênis,
  //   padel, pickleball etc num único call — antes só "quadra" perdia
  //   clubes que o Google indexa como "arena" ou "clube".
  // - Com modalidade: usa a modalidade diretamente (Google indexa bem
  //   "beach tennis", "padel", etc em PT-BR).
  // - locationBias em vez de locationRestriction: vies SEM trava, então
  //   lugares muito relevantes fora do raio também aparecem. O filtro
  //   haversine client-side já cuida do raio exato via state.distanceKm
  //   — então o API só precisa achar candidatos. Isso mata o cenário
  //   "zero resultados" em áreas com poucos venues no raio estrito.
  async function _loadGoogleNearby(center, radiusKm, sport) {
    if (!center || !window.google || !window.google.maps || !window.google.maps.importLibrary) return [];
    try {
      var placesLib = await google.maps.importLibrary('places');
      if (!placesLib || !placesLib.Place || typeof placesLib.Place.searchByText !== 'function') return [];
      var defaultTerms = 'quadra esportiva clube arena tênis padel beach tennis pickleball';
      var queryParts = [sport ? sport : defaultTerms];
      if (state.location) queryParts.push(state.location);
      var query = queryParts.join(' ').trim();
      // Bias é mais permissivo que restriction — Google ainda prioriza
      // o raio escolhido mas não descarta candidatos relevantes próximos.
      // O haversine local filtra depois conforme state.distanceKm.
      var biasRadiusM = Math.min(50, Math.max(1, radiusKm)) * 1000;
      var req = {
        textQuery: query,
        fields: ['displayName', 'formattedAddress', 'location', 'id', 'types'],
        locationBias: {
          center: new google.maps.LatLng(center.lat, center.lng),
          radius: biasRadiusM
        },
        maxResultCount: 15,
        language: 'pt-BR',
        region: 'br'
      };
      var result = await placesLib.Place.searchByText(req);
      var out = (result && result.places) || [];
      return out.map(function(p) {
        var loc = p.location;
        return {
          placeId: p.id,
          name: p.displayName || '',
          address: p.formattedAddress || '',
          lat: loc ? loc.lat() : null,
          lng: loc ? loc.lng() : null,
          types: p.types || []
        };
      });
    } catch (e) {
      console.warn('Places nearby err:', e && e.message);
      return [];
    }
  }

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

  // List of tournaments at this venue — upcoming + past (last 6 months).
  // Pulled from AppStore cache; no extra fetch. Empty string when none.
  function _buildTournamentsHtml(venue) {
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    var here = tournaments.filter(function(t) {
      if (!t) return false;
      return window.VenueDB.venueKey(t.venuePlaceId, t.venue) === venue.placeId;
    });
    if (here.length === 0) return '';
    var now = Date.now();
    var sixMonthsAgo = now - 183 * 24 * 3600 * 1000;
    var upcoming = [];
    var past = [];
    here.forEach(function(t) {
      var start = t.startDate ? new Date(t.startDate).getTime() : 0;
      if (!start || isNaN(start)) return;
      if (start >= now) upcoming.push({ t: t, ts: start });
      else if (start >= sixMonthsAgo) past.push({ t: t, ts: start });
    });
    upcoming.sort(function(a, b) { return a.ts - b.ts; });
    past.sort(function(a, b) { return b.ts - a.ts; });
    if (upcoming.length === 0 && past.length === 0) return '';

    var row = function(entry) {
      var t = entry.t;
      var d = new Date(entry.ts);
      var when = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      var sport = t.sport ? String(t.sport).replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
      var parts = Array.isArray(t.participants) ? t.participants.length : 0;
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:0.82rem;cursor:pointer;" onclick="window.location.hash=\'#tournaments/' + _safe(t.id) + '\'">' +
        '<span style="min-width:72px;color:var(--text-muted);font-size:0.72rem;">' + when + '</span>' +
        '<span style="flex:1;color:var(--text-bright);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏆 ' + _safe(t.name || 'Torneio') + '</span>' +
        (sport ? '<span style="color:var(--text-muted);font-size:0.7rem;">' + _safe(sport) + '</span>' : '') +
        (parts ? '<span style="color:var(--text-muted);font-size:0.7rem;margin-left:4px;">· ' + parts + '</span>' : '') +
      '</div>';
    };

    var html = '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:10px;padding:12px;">' +
      '<div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;margin-bottom:8px;">🏆 Torneios neste local</div>';
    if (upcoming.length > 0) {
      html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 2px 0;">Próximos</div>';
      upcoming.slice(0, 4).forEach(function(e) { html += row(e); });
    }
    if (past.length > 0) {
      html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 2px 0;">Recentes</div>';
      past.slice(0, 4).forEach(function(e) { html += row(e); });
    }
    html += '</div>';
    return html;
  }

  // Owner-only analytics: counts of presences (last 7 days) + tournaments today.
  // All derived from client-side queries we already have — no Cloud Function.
  async function _buildOwnerStatsHtml(venue) {
    if (!window.PresenceDB) return '';
    var dayKey = window.PresenceDB.dayKey(new Date());
    var weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    var presencesToday = [];
    try { presencesToday = await window.PresenceDB.loadForVenueDay(venue.placeId, dayKey); } catch (e) {}
    // Lightweight count of presences this week by scanning 7 days backward.
    // For a modest number of venues this is cheap; when it grows we'll
    // denormalize via Cloud Function.
    var weekCount = 0;
    try {
      var days = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date(Date.now() - i * 24 * 3600 * 1000);
        days.push(window.PresenceDB.dayKey(d));
      }
      for (var j = 0; j < days.length; j++) {
        var list = await window.PresenceDB.loadForVenueDay(venue.placeId, days[j]);
        weekCount += list.length;
      }
    } catch (e) {}
    var tournaments = (window.AppStore && window.AppStore.tournaments) || [];
    var totalTournaments = tournaments.filter(function(t) {
      return t && window.VenueDB.venueKey(t.venuePlaceId, t.venue) === venue.placeId;
    }).length;
    var views = venue.viewCount || 0;
    return '<div style="background:linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.12));border:1px solid rgba(99,102,241,0.35);border-radius:10px;padding:12px;">' +
      '<div style="font-weight:700;color:var(--text-bright);font-size:0.85rem;margin-bottom:8px;">📊 Seu painel (dono)</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:800;color:#a5b4fc;">' + views + '</div><div style="font-size:0.68rem;color:var(--text-muted);">visualizações</div></div>' +
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:800;color:#fbbf24;">' + weekCount + '</div><div style="font-size:0.68rem;color:var(--text-muted);">check-ins (7 dias)</div></div>' +
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:800;color:#10b981;">' + totalTournaments + '</div><div style="font-size:0.68rem;color:var(--text-muted);">torneios no local</div></div>' +
      '</div>' +
    '</div>';
  }

  // Detail: compact modal with contact actions + quick links into the rest of the app.
  window._venuesOpenDetail = async function(placeId) {
    var v = await window.VenueDB.loadVenue(placeId);
    if (!v) {
      // Invalid deep link or deleted venue — surface a friendly message
      // instead of silently doing nothing.
      var prev = document.getElementById('venues-detail-overlay');
      if (prev) prev.remove();
      var overlay = document.createElement('div');
      overlay.id = 'venues-detail-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10010;display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.innerHTML =
        '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px;padding:24px;max-width:420px;width:100%;text-align:center;">' +
          '<div style="font-size:2rem;margin-bottom:8px;">🧭</div>' +
          '<div style="font-weight:800;color:var(--text-bright);font-size:1.05rem;margin-bottom:6px;">Local não encontrado</div>' +
          '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">Este link pode estar desatualizado, ou o dono liberou a reivindicação. Volte à busca para explorar outros locais.</div>' +
          '<button class="btn btn-primary" onclick="document.getElementById(\'venues-detail-overlay\').remove()">Entendi</button>' +
        '</div>';
      overlay.addEventListener('click', function(ev) { if (ev.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      return;
    }
    // Fire-and-forget viewCount bump. Skip when the owner is viewing their own
    // venue so owner curiosity doesn't inflate numbers. Also skip for anonymous
    // visitors — rules require auth, so writing would fail silently anyway.
    var cu = window.AppStore && window.AppStore.currentUser;
    if (cu && cu.uid && v.ownerUid !== cu.uid && typeof window.VenueDB.incrementViewCount === 'function') {
      window.VenueDB.incrementViewCount(placeId);
    }
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
      sports: Array.isArray(v.sports) ? v.sports : [],
      lat: v.lat, lon: v.lon
    });

    var overlay = document.createElement('div');
    overlay.id = 'venues-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10010;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    // Tags de proveniência: "✅ Informações oficiais" quando reivindicado;
    // "📝 Cadastrado por [nome]" quando é cadastro comunitário.
    var ownershipTag = v.ownerUid
      ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:600;color:#10b981;opacity:0.85;">✅ oficial</span>'
      : (v.createdByName
          ? '<span title="Cadastro comunitário — pode não refletir 100% a realidade até o proprietário reivindicar." style="display:inline-flex;flex-direction:column;font-size:0.65rem;color:#64748b;line-height:1.3;opacity:0.8;">🤝 comunidade<span>por ' + _safe(v.createdByName) + '</span></span>'
          : '');
    // Botão "Reivindicar como dono" quando ninguém reivindicou ainda e o
    // caller é um usuário autenticado diferente do caso trivial (ownerUid já é self).
    var claimBtn = (cu && cu.uid && !v.ownerUid)
      ? '<button class="btn btn-sm" onclick=\'window._venueOwnerEditExisting("' + _safe(v.placeId) + '"); document.getElementById("venues-detail-overlay").remove(); window.location.hash="#my-venues"\' style="background:#10b981;color:#fff;border:none;font-weight:700;">🏢 Reivindicar como dono</button>'
      : '';
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:18px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.5);">' +
        '<div style="position:sticky;top:0;background:var(--bg-card);padding:16px 18px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:10px;z-index:2;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:800;color:var(--text-bright);font-size:1.05rem;line-height:1.3;">🏢 ' + _safe(v.name) + '</div>' +
            (v.address ? '<div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">📍 ' + _safe(v.address) + '</div>' : '') +
          '</div>' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'venues-detail-overlay\').remove()" style="flex-shrink:0;">Fechar</button>' +
        '</div>' +
        '<div style="padding:16px 18px;">' +
          (ownershipTag || claimBtn ? '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px;">' + ownershipTag + claimBtn + '</div>' : '') +
          (sportsHtml ? '<div style="margin-bottom:10px;">' + sportsHtml + '</div>' : '') +
          // Badge de política de acesso — informa claramente se o local é
          // público/só sócios/sócios+convidados/privado. Usuários sabem de
          // cara se podem "ir jogar lá" ou se precisam de convite.
          ((function() {
            var ap = v.accessPolicy || 'public';
            var apCfg = {
              public:              { icon: '🌐', category: 'Acesso público',   label: 'Aberto ao público',              bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
              members:             { icon: '🔒', category: 'Acesso restrito',  label: 'Só sócios',                     bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
              members_plus_guests: { icon: '🏆', category: 'Acesso restrito',  label: 'Sócios + convidados de torneios', bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24' },
              private:             { icon: '🔒', category: 'Acesso restrito',  label: 'Privado',                       bg: 'rgba(239,68,68,0.12)',   color: '#f87171' }
            }[ap] || null;
            if (!apCfg) return '';
            return '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:' + apCfg.bg + ';color:' + apCfg.color + ';border:1px solid ' + apCfg.color + '40;font-size:0.72rem;font-weight:700;margin-bottom:10px;">' +
              apCfg.icon + ' <span>' + apCfg.category + '</span><span style="opacity:0.6;font-weight:400;font-size:0.68rem;">· ' + apCfg.label + '</span>' +
            '</div>';
          })()) +
          // Slot pras quadras detalhadas (subcollection courts). Populado
          // async após a modal abrir — não bloqueia a exibição inicial.
          '<div id="venue-courts-agg-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-details-slot" style="margin-bottom:12px;"></div>' +
          (v.hours ? '<div style="font-size:0.82rem;color:var(--text-bright);margin-bottom:10px;">⏰ ' + _safe(v.hours) + '</div>' : '') +
          (contactBits.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + contactBits.join('') + '</div>' : '') +
          '<div id="venue-owner-stats-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-movimento-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-tournaments-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-reviews-slot" style="margin-bottom:12px;"></div>' +
          // Check-in inline: o usuário clicando "Estou aqui" na modal fecha o
          // loop discovery→ação em um toque só, sem navegar até #presence.
          // Só aparece para usuários logados; anônimos veem os outros botões.
          (cu && cu.uid
            ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">' +
                '<button id="venue-quickcheckin-btn" class="btn btn-sm hover-lift" onclick=\'window._venuesQuickCheckIn("' + _safe(v.placeId) + '")\' style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;font-weight:700;padding:8px 14px;">📍 Estou aqui agora</button>' +
                '<button id="venue-quickplan-btn" class="btn btn-sm hover-lift" onclick=\'window._venuesQuickPlan("' + _safe(v.placeId) + '")\' style="background:#6366f1;color:#fff;border:none;font-weight:700;padding:8px 14px;">🗓️ Planejar ida</button>' +
              '</div>'
            : '') +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
            '<a href="' + _safe(mapsUrl) + '" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none;">🗺️ Ver no mapa</a>' +
            '<button class="btn btn-sm" onclick=\'try{sessionStorage.setItem("_presencePrefill", ' + JSON.stringify(prefillJson) + ')}catch(e){}window.location.hash="#presence"\' style="background:#f59e0b;color:#1a0f00;border:none;font-weight:700;">📍 Ver presenças</button>' +
            '<button class="btn btn-sm btn-primary" onclick=\'window._venuesStartTournamentHere(' + JSON.stringify(prefillJson) + ')\'>🏆 Criar torneio aqui</button>' +
            '<button class="btn btn-sm" onclick=\'window._venuesShare("' + _safe(v.placeId) + '")\' style="background:#25d366;color:#fff;border:none;font-weight:700;">📤 Compartilhar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(ev) { if (ev.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    // Async: courts agregados por modalidade — mostra "4 quadras de Beach
    // Tennis (compartilhadas) · 2 de Tênis (saibro) · ..." antes do resto
    // pra dar contexto imediato das opções. Read público via rules.
    var _sportIcon = function(s) {
      var icons = {
        'Beach Tennis': '🎾', 'Pickleball': '🏓', 'Tênis': '🎾', 'Tennis': '🎾',
        'Padel': '🏸', 'Tênis de Mesa': '🏓', 'Futebol': '⚽', 'Futsal': '⚽',
        'Basquete': '🏀', 'Vôlei': '🏐', 'Vôlei de Praia': '🏐',
        'Natação': '🏊', 'Handebol': '🤾', 'Squash': '🟡', 'Badminton': '🏸'
      };
      return icons[s] || '🏅';
    };
    if (window.VenueDB && typeof window.VenueDB.aggregateVenueCourts === 'function') {
      window.VenueDB.aggregateVenueCourts(v.placeId).then(function(agg) {
        var slot = document.getElementById('venue-courts-agg-slot');
        if (!slot || !agg || agg.sports.length === 0) return;
        var rows = agg.sports.map(function(sportName) {
          var info = agg.bySport[sportName];
          var surfaceList = Object.keys(info.surfaces || {});
          var surfaceTxt = surfaceList.length > 0 ? ' <span style="opacity:0.6;font-weight:400;">(' + _safe(surfaceList.join(', ')) + ')</span>' : '';
          var sharedTxt = info.shared
            ? '<span style="font-size:0.62rem;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;padding:1px 6px;border-radius:10px;margin-left:4px;">🔁 compartilhada</span>'
            : '';
          return '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text-bright);padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
            '<span style="font-size:1rem;flex-shrink:0;">' + _sportIcon(sportName) + '</span>' +
            '<b style="color:#a5b4fc;min-width:16px;text-align:right;">' + info.count + '</b>' +
            '<span>quadra' + (info.count === 1 ? '' : 's') + ' de <b>' + _safe(sportName) + '</b>' + surfaceTxt + '</span>' +
            sharedTxt +
          '</div>';
        }).join('');
        var contribLine = agg.contributors.length > 1
          ? '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;opacity:0.65;">Informações contribuídas por ' + agg.contributors.length + ' jogadores</div>'
          : '';
        slot.innerHTML =
          '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:12px;padding:12px 14px;">' +
            '<div style="font-weight:700;color:var(--text-bright);font-size:0.82rem;margin-bottom:8px;">🏟️ Quadras disponíveis</div>' +
            rows +
            contribLine +
          '</div>';
        // Detalhes / Preços box (logo após as quadras)
        var detailSlot = document.getElementById('venue-details-slot');
        if (detailSlot && (v.description || v.priceRange)) {
          var detailParts = '';
          if (v.priceRange) detailParts += '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:' + (v.description ? '8' : '0') + 'px;"><span style="flex-shrink:0;">💰</span><span style="font-size:0.82rem;color:var(--text-bright);font-weight:600;">' + _safe(v.priceRange) + '</span></div>';
          if (v.description) detailParts += '<div style="font-size:0.82rem;color:var(--text-muted);line-height:1.55;white-space:pre-wrap;">' + _safe(v.description) + '</div>';
          detailSlot.innerHTML =
            '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:12px;padding:12px 14px;">' +
              '<div style="font-weight:700;color:var(--text-bright);font-size:0.82rem;margin-bottom:8px;">📋 Detalhes</div>' +
              detailParts +
            '</div>';
        }
      }).catch(function(e) { console.warn('courts agg:', e); });
    } else if (v.description || v.priceRange) {
      // fallback quando courts DB não disponível — mostra o box de detalhes igualmente
      setTimeout(function() {
        var detailSlot = document.getElementById('venue-details-slot');
        if (!detailSlot) return;
        var detailParts = '';
        if (v.priceRange) detailParts += '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:' + (v.description ? '8' : '0') + 'px;"><span>💰</span><span style="font-size:0.82rem;color:var(--text-bright);font-weight:600;">' + _safe(v.priceRange) + '</span></div>';
        if (v.description) detailParts += '<div style="font-size:0.82rem;color:var(--text-muted);line-height:1.55;white-space:pre-wrap;">' + _safe(v.description) + '</div>';
        detailSlot.innerHTML =
          '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:12px;padding:12px 14px;">' +
            '<div style="font-weight:700;color:var(--text-bright);font-size:0.82rem;margin-bottom:8px;">📋 Detalhes</div>' +
            detailParts +
          '</div>';
      }, 0);
    }
    // Async: fetch presences + tournaments, inject into the slot so the
    // modal body stays snappy on open.
    _buildMovimentoHtml(v).then(function(html) {
      var slot = document.getElementById('venue-movimento-slot');
      if (slot && html) slot.innerHTML = html;
    });
    // Owner sees private analytics. Anyone else: slot stays empty.
    if (cu && cu.uid && v.ownerUid === cu.uid) {
      _buildOwnerStatsHtml(v).then(function(html) {
        var slot = document.getElementById('venue-owner-stats-slot');
        if (slot && html) slot.innerHTML = html;
      });
    }
    // Avaliações — estrelas + textos. Renderiza resumo + lista + botão
    // "Deixar avaliação".
    _hydrateReviews(v);
  };

  // Star widget com 5 posições. `value` determina quantas ficam cheias;
  // `interactive` faz cada estrela clicável para setar via window._venuesPickStars.
  function _starsHtml(value, size, interactive) {
    size = size || '1rem';
    var out = '';
    for (var i = 1; i <= 5; i++) {
      var filled = i <= value;
      var char = filled ? '★' : '☆';
      var color = filled ? '#fbbf24' : 'rgba(148,163,184,0.5)';
      if (interactive) {
        out += '<span onclick="window._venuesPickStars(' + i + ')" style="cursor:pointer;font-size:' + size + ';color:' + color + ';padding:0 2px;" data-star="' + i + '">' + char + '</span>';
      } else {
        out += '<span style="font-size:' + size + ';color:' + color + ';">' + char + '</span>';
      }
    }
    return out;
  }

  async function _hydrateReviews(venue) {
    var slot = document.getElementById('venue-reviews-slot');
    if (!slot || !window.VenueDB) return;
    var cu = window.AppStore && window.AppStore.currentUser;
    var reviews = [];
    try { reviews = await window.VenueDB.loadReviews(venue.placeId, 50); } catch (e) {}
    var count = reviews.length;
    var avg = 0;
    if (count > 0) {
      var sum = 0;
      for (var i = 0; i < count; i++) sum += (parseInt(reviews[i].rating, 10) || 0);
      avg = sum / count;
    }
    var header = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
      '<div style="font-weight:700;color:var(--text-bright);font-size:0.92rem;">⭐ Avaliações</div>' +
      (count > 0
        ? '<div style="display:inline-flex;align-items:center;gap:6px;">' +
            '<span style="font-weight:700;color:#fbbf24;font-size:0.95rem;">' + avg.toFixed(1) + '</span>' +
            _starsHtml(Math.round(avg), '0.9rem', false) +
            '<span style="color:var(--text-muted);font-size:0.78rem;">(' + count + (count === 1 ? ' avaliação' : ' avaliações') + ')</span>' +
          '</div>'
        : '<span style="color:var(--text-muted);font-size:0.8rem;">Seja o primeiro a avaliar.</span>') +
      (cu && cu.uid
        ? '<button class="btn btn-sm btn-primary hover-lift" style="margin-left:auto;font-size:0.78rem;padding:4px 10px;" onclick="window._venuesOpenReviewDialog(\'' + _safe(venue.placeId) + '\')">✍️ Deixar avaliação</button>'
        : '')
    + '</div>';

    var list = '';
    reviews.slice(0, 8).forEach(function(r) {
      var hasText = r.text && r.text.trim();
      var anon = r.anonymous && !hasText;
      var name = anon ? 'Anônimo' : (r.displayName || 'Usuário');
      var initials = name.trim().split(/\s+/).map(function(s){return s.charAt(0);}).join('').substring(0,2).toUpperCase();
      var avatar = (!anon && r.photoURL)
        ? '<img src="' + _safe(r.photoURL) + '" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
        : '<div style="width:32px;height:32px;border-radius:50%;background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.78rem;flex-shrink:0;">' + _safe(anon ? '?' : initials) + '</div>';
      var when = '';
      if (r.updatedAt) {
        try { when = new Date(r.updatedAt).toLocaleDateString((window._currentLang === 'en' ? 'en-US' : 'pt-BR'), { day: '2-digit', month: 'short' }); } catch (e) {}
      }
      var canDelete = cu && cu.uid === r.uid;
      var delBtn = canDelete
        ? '<button title="Apagar" onclick="window._venuesDeleteReview(\'' + _safe(venue.placeId) + '\',\'' + _safe(r._id) + '\')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;padding:0 4px;opacity:0.5;">✕</button>'
        : '';
      list += '<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--border-color);">' +
        avatar +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<span style="font-weight:600;color:var(--text-bright);font-size:0.85rem;">' + _safe(name) + '</span>' +
            _starsHtml(r.rating, '0.8rem', false) +
            (when ? '<span style="color:var(--text-muted);font-size:0.72rem;">· ' + _safe(when) + '</span>' : '') +
            delBtn +
          '</div>' +
          (hasText ? '<div style="font-size:0.82rem;color:var(--text-main);margin-top:4px;line-height:1.45;white-space:pre-wrap;">' + _safe(r.text) + '</div>' : '') +
        '</div>' +
      '</div>';
    });

    slot.innerHTML = '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:10px;padding:12px;">' + header + list + '</div>';
  }

  // Form flutuante: estrelas (obrigatório) + texto opcional. Se houver texto
  // o review é sempre identificado; se só estrelas, pode ser anônimo.
  window._venuesOpenReviewDialog = async function(placeId) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return;
    // Pre-load review existente deste usuário para permitir editar.
    var existing = null;
    try {
      var ex = await window.VenueDB.loadReviews(placeId, 100);
      for (var i = 0; i < ex.length; i++) if (ex[i].uid === cu.uid) { existing = ex[i]; break; }
    } catch (e) {}
    window._venuesReviewState = {
      placeId: placeId,
      rating: existing ? (existing.rating || 0) : 0,
      text: existing ? (existing.text || '') : '',
      anonymous: existing ? !!existing.anonymous : false
    };
    var prev = document.getElementById('venues-review-overlay');
    if (prev) prev.remove();
    var overlay = document.createElement('div');
    overlay.id = 'venues-review-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px;padding:18px;max-width:440px;width:100%;">' +
        '<h3 style="margin:0 0 10px 0;color:var(--text-bright);">✍️ Deixar avaliação</h3>' +
        '<div id="venues-review-stars" style="margin-bottom:10px;font-size:1.6rem;text-align:center;"></div>' +
        '<textarea id="venues-review-text" rows="3" placeholder="Escreva sua opinião (opcional). Com texto, seu nome aparece." style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);resize:vertical;font-family:inherit;font-size:0.9rem;margin-bottom:10px;">' + _safe(window._venuesReviewState.text) + '</textarea>' +
        '<label style="display:flex;align-items:center;gap:6px;margin-bottom:14px;font-size:0.78rem;color:var(--text-muted);cursor:pointer;">' +
          '<input type="checkbox" id="venues-review-anon"' + (window._venuesReviewState.anonymous ? ' checked' : '') + '>' +
          '<span>Avaliação anônima (só se estrelas, sem texto)</span>' +
        '</label>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'venues-review-overlay\').remove()">Cancelar</button>' +
          '<button class="btn btn-primary btn-sm" onclick="window._spinButton(this, \'Salvando...\'); window._venuesSubmitReview()">Publicar</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(ev) { if (ev.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    _renderReviewStars();
  };

  function _renderReviewStars() {
    var el = document.getElementById('venues-review-stars');
    if (!el) return;
    el.innerHTML = _starsHtml(window._venuesReviewState.rating || 0, '1.6rem', true);
  }

  window._venuesPickStars = function(n) {
    if (!window._venuesReviewState) return;
    window._venuesReviewState.rating = n;
    _renderReviewStars();
  };

  window._venuesSubmitReview = async function() {
    var st = window._venuesReviewState;
    if (!st) return;
    var rating = st.rating || 0;
    if (rating < 1 || rating > 5) {
      if (window.showNotification) window.showNotification('Escolha de 1 a 5 estrelas.', '', 'error');
      return;
    }
    var textEl = document.getElementById('venues-review-text');
    var anonEl = document.getElementById('venues-review-anon');
    var text = textEl ? textEl.value.trim() : '';
    var anonymous = !!(anonEl && anonEl.checked) && !text;
    try {
      await window.VenueDB.saveReview(st.placeId, rating, text, anonymous);
      var ov = document.getElementById('venues-review-overlay');
      if (ov) ov.remove();
      if (window.showNotification) window.showNotification('Avaliação publicada.', '', 'success');
      // Re-hidrata o bloco de reviews na modal de detalhe, se aberta.
      var venueDoc = await window.VenueDB.loadVenue(st.placeId);
      if (venueDoc) _hydrateReviews(venueDoc);
    } catch (e) {
      console.error(e);
      if (window.showNotification) window.showNotification('Erro ao publicar avaliação.', String(e.message || e), 'error');
    }
  };

  window._venuesDeleteReview = async function(placeId, reviewId) {
    if (!placeId || !reviewId) return;
    if (typeof window.showConfirmDialog !== 'function') return;
    window.showConfirmDialog('Apagar sua avaliação?', 'Esta ação não pode ser desfeita.', async function() {
      var ok = await window.VenueDB.deleteReview(placeId, reviewId);
      if (ok) {
        if (window.showNotification) window.showNotification('Avaliação apagada.', '', 'info');
        var v = await window.VenueDB.loadVenue(placeId);
        if (v) _hydrateReviews(v);
      }
    }, null, { confirmText: 'Apagar', cancelText: 'Cancelar', type: 'danger' });
  };

  // Bridge to tournament creation — stashes venue so create-tournament can read.
  window._venuesStartTournamentHere = function(prefillJson) {
    try { sessionStorage.setItem('_venuePrefill', prefillJson); } catch (e) {}
    var ov = document.getElementById('venues-detail-overlay');
    if (ov) ov.remove();
    if (typeof openModal === 'function') openModal('modal-quick-create');
  };

  // Share venue — tenta navigator.share (mobile native dialog: WhatsApp,
  // Instagram, SMS, etc); fallback pra clipboard com toast de confirmação.
  // Link é canônico do scoreplace (#venues/<placeId>) pra que destinatário
  // caia direto na modal da venue com movimento + contatos — viral growth.
  window._venuesShare = async function(placeId) {
    var v = await window.VenueDB.loadVenue(placeId);
    if (!v) return;
    var base = window.SCOREPLACE_URL || 'https://scoreplace.app';
    var url = base + '/#venues/' + encodeURIComponent(placeId);
    var title = '🏢 ' + (v.name || 'Local no scoreplace');
    var sportsLine = (Array.isArray(v.sports) && v.sports.length > 0)
      ? v.sports.slice(0, 3).join(' · ') + '\n'
      : '';
    var addrLine = v.address ? v.address + '\n' : '';
    var text = title + '\n' + sportsLine + addrLine + '\n👉 ' + url;
    // Web Share API — mobile nativo. Desktop (Chrome/Edge) também suporta
    // em alguns casos. Em browsers sem suporte, cai no clipboard.
    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text, url: url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user cancelou
        // Qualquer outro erro: cai no fallback
      }
    }
    // Fallback: copia pro clipboard + toast
    try {
      await navigator.clipboard.writeText(text);
      if (window.showNotification) window.showNotification('Link copiado!', 'Cole no WhatsApp ou em qualquer rede.', 'success');
    } catch (e) {
      // Último fallback: window.open mailto
      try { window.open('mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text)); } catch (_) {}
    }
  };

  // ── Quick check-in from the venue detail modal ───────────────────────────
  // Closes the discovery→action loop in a single tap: user opens modal, sees
  // venue info, taps "Estou aqui". Same payload shape as presence.js writes,
  // just assembled inline so we don't need to navigate to #presence first.
  // Picks sport intelligently: venue's primary sport → user's preferred
  // sport → falls back to showing a picker if multiple options exist.
  function _pickSportForVenue(v) {
    var cu = window.AppStore && window.AppStore.currentUser;
    var venueSports = Array.isArray(v.sports) ? v.sports.slice() : [];
    if (venueSports.length === 1) return { sports: venueSports };
    if (venueSports.length === 0) {
      // Sem modalidades declaradas — usa a preferência do usuário se houver.
      var pref = (cu && Array.isArray(cu.preferredSports) && cu.preferredSports.length > 0)
        ? [cu.preferredSports[0]]
        : [];
      return { sports: pref };
    }
    // 2+ modalidades no venue: intersecta com preferências pra reduzir picker.
    if (cu && Array.isArray(cu.preferredSports) && cu.preferredSports.length > 0) {
      var inter = venueSports.filter(function(s) { return cu.preferredSports.indexOf(s) !== -1; });
      if (inter.length === 1) return { sports: inter };
      if (inter.length > 1) return { needsPicker: true, options: inter };
    }
    return { needsPicker: true, options: venueSports };
  }

  // Picker overlay pra quando um venue oferece múltiplas modalidades e a
  // preferência do usuário não desempata. Botões simples retornando o sport
  // escolhido via callback.
  function _pickSportOverlay(options, cb) {
    var prev = document.getElementById('venue-sport-pick-overlay');
    if (prev) prev.remove();
    var overlay = document.createElement('div');
    overlay.id = 'venue-sport-pick-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px;';
    var btns = options.map(function(s) {
      return '<button class="btn btn-primary hover-lift" onclick=\'document.getElementById("venue-sport-pick-overlay").remove(); window._venueSportPickerCb && window._venueSportPickerCb("' + _safe(s) + '")\' style="margin:4px;">' + _safe(s) + '</button>';
    }).join('');
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:20px;max-width:420px;width:100%;text-align:center;">' +
        '<div style="font-weight:800;color:var(--text-bright);font-size:1rem;margin-bottom:6px;">Qual modalidade agora?</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:14px;">Você pode estar jogando mais de uma — escolha a principal.</div>' +
        '<div style="display:flex;flex-wrap:wrap;justify-content:center;">' + btns + '</div>' +
        '<button class="btn btn-secondary btn-sm" onclick=\'document.getElementById("venue-sport-pick-overlay").remove(); window._venueSportPickerCb && window._venueSportPickerCb(null)\' style="margin-top:10px;">Cancelar</button>' +
      '</div>';
    overlay.addEventListener('click', function(ev) {
      if (ev.target === overlay) { overlay.remove(); if (window._venueSportPickerCb) window._venueSportPickerCb(null); }
    });
    document.body.appendChild(overlay);
    window._venueSportPickerCb = cb;
  }

  async function _doQuickCheckIn(v, sports) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid || !window.PresenceDB) return;
    if (cu.presenceVisibility === 'off') {
      if (window.showNotification) window.showNotification('Presença desligada no seu perfil.', 'info');
      return;
    }
    var normSports = sports.map(window.PresenceDB.normalizeSport).filter(Boolean);
    if (normSports.length === 0) {
      if (window.showNotification) window.showNotification('Modalidade não identificada.', 'error');
      return;
    }
    var now = Date.now();
    var payload = {
      uid: cu.uid,
      email_lower: (cu.email || '').toLowerCase(),
      displayName: cu.displayName || '',
      photoURL: cu.photoURL || '',
      placeId: v.placeId,
      venueName: v.name || '',
      venueLat: v.lat || null,
      venueLon: v.lon || null,
      sports: normSports,
      type: 'checkin',
      startsAt: now,
      endsAt: now + window.PresenceDB.CHECKIN_WINDOW_MS,
      dayKey: window.PresenceDB.dayKey(new Date(now)),
      visibility: cu.presenceVisibility || 'friends',
      cancelled: false,
      createdAt: now
    };
    try {
      await window.PresenceDB.savePresence(payload);
      if (window.showNotification) {
        window.showNotification(
          'Presença registrada em ' + (v.name || 'local') + '!',
          'Seus amigos já podem ver.',
          'success'
        );
      }
      // Notifica amigos com "Fulano chegou em X pra jogar". Throttled pra
      // não spammar caso o usuário faça múltiplos check-ins no mesmo dia.
      _notifyFriendsOfQuickCheckin(v, payload);
      // Re-hidrata o bloco "Movimento no local" pra refletir a nova presença
      // sem o usuário precisar fechar e reabrir a modal.
      _buildMovimentoHtml(v).then(function(html) {
        var slot = document.getElementById('venue-movimento-slot');
        if (slot && html) slot.innerHTML = html;
      });
      // Desabilita o botão após sucesso pra evitar double-tap duplicata
      var btn = document.getElementById('venue-quickcheckin-btn');
      if (btn) {
        btn.textContent = '✅ Presença registrada';
        btn.style.opacity = '0.65';
        btn.style.cursor = 'default';
        btn.disabled = true;
      }
    } catch (e) {
      console.error('Quick check-in failed:', e);
      if (window.showNotification) window.showNotification('Erro ao registrar presença.', 'error');
    }
  }

  // Friend notification para o quick check-in inline na modal do venue.
  // Mesmo throttle + mesma semântica que presence.js — um único lugar na
  // UI geraria notificação duplicada se o usuário fizesse checkin via dois
  // caminhos, então a chave de throttle é compartilhada entre os dois.
  function _notifyFriendsOfQuickCheckin(v, payload) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) return;
    var friends = Array.isArray(cu.friends) ? cu.friends : [];
    if (friends.length === 0) return;
    if (typeof window._sendUserNotification !== 'function') return;
    if (cu.presenceVisibility === 'off') return;

    var throttleKey = 'scoreplace_checkin_notified_' + v.placeId + '_' +
                      (payload.sport || '') + '_' + payload.dayKey;
    try {
      if (localStorage.getItem(throttleKey)) return;
      localStorage.setItem(throttleKey, '1');
    } catch (e) {}

    var msg = (cu.displayName || 'Um amigo') + ' chegou em ' +
              (v.name || 'um local') + ' pra jogar ' +
              (payload.sport || 'agora') + '. Vem junto!';

    friends.forEach(function(friendUid) {
      if (!friendUid) return;
      window._sendUserNotification(friendUid, {
        type: 'presence_checkin',
        message: msg,
        level: 'all',
        venueName: v.name || '',
        placeId: v.placeId,
        sports: payload.sports,
        startsAt: payload.startsAt
      }).catch(function(e) { console.warn('Quick checkin notify failed:', e); });
    });
  }

  window._venuesQuickCheckIn = async function(placeId) {
    var v = await window.VenueDB.loadVenue(placeId);
    if (!v) return;
    var resolved = _pickSportForVenue(v);
    if (resolved.needsPicker) {
      _pickSportOverlay(resolved.options, function(picked) {
        if (!picked) return;
        _doQuickCheckIn(v, [picked]);
      });
    } else if (resolved.sports && resolved.sports.length > 0) {
      _doQuickCheckIn(v, resolved.sports);
    } else {
      // Sem modalidade nem no venue nem no perfil — manda pro fluxo completo
      // em #presence onde o picker está montado com todas as opções.
      try {
        sessionStorage.setItem('_presencePrefill', JSON.stringify({
          placeId: v.placeId, venueName: v.name, lat: v.lat, lon: v.lon
        }));
      } catch(e) {}
      window.location.hash = '#presence';
    }
  };

  // Planejar ida: redireciona pra #presence com prefill. Overlay de
  // schedule requer data/hora, então não cabe inline na venue modal.
  window._venuesQuickPlan = async function(placeId) {
    var v = await window.VenueDB.loadVenue(placeId);
    if (!v) return;
    try {
      sessionStorage.setItem('_presencePrefill', JSON.stringify({
        placeId: v.placeId,
        venueName: v.name,
        sports: Array.isArray(v.sports) ? v.sports : [],
        lat: v.lat, lon: v.lon,
        _openPlanDialog: true
      }));
    } catch(e) {}
    var ov = document.getElementById('venues-detail-overlay');
    if (ov) ov.remove();
    window.location.hash = '#presence';
  };

  // Public entry point. `deepLinkPlaceId` (optional, from #venues/<placeId>)
  // opens the detail modal right after the listing renders so shared links
  // land on the venue directly.
  window.renderVenues = function(container, deepLinkPlaceId) {
    // Re-hidrata filtros do localStorage a cada abertura da view — state é
    // singleton, mas o usuário pode ter mudado preferências em outra aba ou
    // voltado depois de um logout/login.
    var fresh = _loadSavedFilters();
    if (fresh.location) state.location = fresh.location;
    if (fresh.sport != null) state.sport = fresh.sport;
    if (fresh.priceRange != null) state.priceRange = fresh.priceRange;
    if (fresh.minCourts) state.minCourts = fresh.minCourts;
    if (fresh.distanceKm) state.distanceKm = fresh.distanceKm;
    render(container);
    if (deepLinkPlaceId && typeof window._venuesOpenDetail === 'function') {
      setTimeout(function() { window._venuesOpenDetail(deepLinkPlaceId); }, 150);
    }
  };
})();
