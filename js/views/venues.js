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
        distanceKm: state.distanceKm
      }));
    } catch (e) {}
  }
  var _saved = _loadSavedFilters();

  var state = {
    location: _saved.location || '',  // endereço livre OU cidade — alimenta o Geocoder
    sport: _saved.sport || '',
    priceRange: _saved.priceRange || '',
    minCourts: _saved.minCourts || 1, // default 1
    distanceKm: _saved.distanceKm || 10, // raio em km ao redor de center
    center: null,                     // {lat, lng} — derivado do Geocoder
    loading: false,
    results: [],
    googleResults: [],                // Google Places nearby results
    googleLoaded: false,              // flag para exibir empty state correto
    mode: 'map'                       // 'list' | 'map' — map is default
  };

  // Google Maps state — persisted across re-renders so we don't re-init.
  var _map = null;
  var _markers = [];
  var _mapsLibs = null;

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

  function render(container) {
    // Reset map handle — a re-render recreates #venues-map so the Maps
    // instance we had is bound to a detached node.
    _map = null;
    _markers = [];
    // Seed city with the user's profile city on first entry so the feed
    // lands on "their" city by default. Only when state.location is still
    // empty (i.e. user hasn't typed/cleared it) to preserve intentional edits.
    // "Local" aceita cidade ou endereço completo ("Av. Paulista 1000, SP").
    if (!state.location) {
      var cu = window.AppStore && window.AppStore.currentUser;
      var profileCity = cu && cu.city ? String(cu.city).trim() : '';
      if (profileCity) state.location = profileCity;
    }
    // SEMPRE tenta GPS na abertura da view quando ainda não temos centro GPS
    // preciso — independente do state.location ter sido pré-preenchido por
    // filtros salvos ou pela cidade do perfil. O usuário pediu: ao abrir a
    // página em mobile, já carregar a posição real sem precisar clicar no
    // pin. Fire-and-forget; se permissão já é granted, fica silencioso.
    if (!state.centerFromGps) _tryAutoGeolocate();
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
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Local</label>' +
              '<div style="display:flex;gap:6px;">' +
                '<input type="text" id="venues-location" value="' + _safe(state.location) + '" placeholder="Endereço, bairro ou cidade" oninput="window._venuesOnLocation(this.value)" style="flex:1;min-width:0;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
                '<button type="button" id="venues-geo-btn" onclick="window._venuesUseMyLocation(true)" title="Usar minha localização" style="flex-shrink:0;padding:0 10px;border-radius:8px;background:#6366f1;border:none;color:#fff;font-size:1rem;cursor:pointer;">📍</button>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Modalidade</label>' +
              '<select id="venues-sport" onchange="window._venuesSetSport(this.value)" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
                sportOpts +
              '</select>' +
            '</div>' +
          '</div>' +
          // Mín. quadras + Distância: grid 2 colunas dedicado pra manter os
          // inputs sempre alinhados entre si, independente da largura da tela.
          // Antes ficavam na mesma linha da Faixa de preço e desalinhavam
          // quando o wrap decidia quebrar.
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Mín. quadras</label>' +
              '<input type="number" min="1" max="99" value="' + (state.minCourts || 1) + '" placeholder="1" oninput="window._venuesSetMinCourts(this.value)" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Distância (km)</label>' +
              '<input type="number" min="1" max="500" value="' + (state.distanceKm || 10) + '" placeholder="10" oninput="window._venuesSetDistance(this.value)" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
            '</div>' +
          '</div>' +
          // Faixa de preço fica em linha própria, full-width, para os 4 botões
          // respirarem e nunca comprimirem ao ponto de cortar rótulos.
          '<div>' +
            '<label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;">Faixa de preço</label>' +
            '<div style="display:flex;gap:4px;">' + priceBtns + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;margin-bottom:10px;" id="venues-view-toggle">' +
          '<button type="button" id="venues-tab-map" onclick="window._venuesSetMode(\'map\')" class="btn btn-sm" style="flex:1;font-size:0.8rem;padding:7px 12px;border-radius:10px;">🗺️ Mapa</button>' +
          '<button type="button" id="venues-tab-list" onclick="window._venuesSetMode(\'list\')" class="btn btn-sm" style="flex:1;font-size:0.8rem;padding:7px 12px;border-radius:10px;">▦ Lista</button>' +
        '</div>' +
        '<div id="venues-content" style="display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:2rem;">' +
          '<div id="venues-results"></div>' +
          // Gutter de 10px em cada lado do mapa: garante zona de toque segura
          // para scrollar a página verticalmente no mobile sem "entrar" no mapa.
          // Combined com gestureHandling:'cooperative' resolve o bug "preso no mapa".
          '<div id="venues-map-wrap" style="display:none;padding:0 10px;">' +
            // Summary bar: contagem de cadastrados vs sugestões Google no
            // raio atual. Dá contexto sem forçar o usuário a scrollar até a
            // seção "📍 Locais no Google" pra ver quantos existem.
            '<div id="venues-map-summary" style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:20px;"></div>' +
            '<div id="venues-map" style="width:100%;height:380px;border-radius:14px;overflow:hidden;border:1px solid var(--border-color);background:#0a0e1a;"></div>' +
            '<div id="venues-map-extras"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    _applyViewMode();
    // Map is now the default mode → kick off lazy init so the user sees the
    // map ready on first paint instead of an empty dark frame.
    if (state.mode === 'map') _ensureMap();
    refresh();
  }

  // List vs Map (mobile), side-by-side on wide screens when mode=split.
  // For simplicity we keep two exclusive modes: 'list' (default) and 'map'.
  window._venuesSetMode = function(mode) {
    state.mode = mode;
    _applyViewMode();
    if (mode === 'map') _ensureMap();
  };
  function _applyViewMode() {
    var mode = state.mode || 'list';
    var btnList = document.getElementById('venues-tab-list');
    var btnMap = document.getElementById('venues-tab-map');
    var resultsBox = document.getElementById('venues-results');
    var mapWrap = document.getElementById('venues-map-wrap');
    if (!resultsBox || !mapWrap || !btnList || !btnMap) return;
    var activeStyle = 'background:#6366f1;color:#fff;border:2px solid #6366f1;font-weight:700;';
    var idleStyle = 'background:transparent;color:var(--text-muted);border:1.5px solid var(--border-color);font-weight:500;';
    btnList.style.cssText = 'flex:1;font-size:0.8rem;padding:7px 12px;border-radius:10px;' + (mode === 'list' ? activeStyle : idleStyle);
    btnMap.style.cssText = 'flex:1;font-size:0.8rem;padding:7px 12px;border-radius:10px;' + (mode === 'map' ? activeStyle : idleStyle);
    resultsBox.style.display = (mode === 'list') ? 'block' : 'none';
    mapWrap.style.display = (mode === 'map') ? 'block' : 'none';
  }

  // "Cadastre seu local" block + Google suggestions list.
  // Both exist as standalone HTML blobs so we can stitch them together under
  // claimed results, the empty state, or even the map view.
  function _registerCtaHtml() {
    return '<div style="margin-top:14px;background:linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.12));border:1px solid rgba(99,102,241,0.4);border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
      '<div style="flex:1;min-width:180px;">' +
        '<div style="font-weight:700;color:var(--text-bright);font-size:0.9rem;">🏢 Cadastre ou edite locais</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Qualquer jogador pode cadastrar clubes, arenas ou quadras que frequenta — como na Wikipedia. O proprietário pode reivindicar depois para adicionar a tag <b>Informações oficiais</b> e bloquear edições de terceiros.</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm hover-lift" onclick="window.location.hash=\'#my-venues\'" style="white-space:nowrap;">Cadastrar local</button>' +
    '</div>';
  }
  function _googleSuggestionsHtml() {
    var g = state.googleResults || [];
    var filterLabel = _safe([
      state.sport || 'qualquer modalidade',
      state.minCourts >= 1 ? ('min. ' + state.minCourts + ' quadra' + (state.minCourts === 1 ? '' : 's')) : '',
      state.location || 'sem local',
      state.distanceKm ? ('raio ' + state.distanceKm + 'km') : '',
      state.priceRange || 'qualquer preço'
    ].filter(Boolean).join(' · '));
    var header = '<div style="margin-top:18px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="font-weight:700;color:var(--text-bright);font-size:0.9rem;">📍 Locais no Google</span>' +
        '<span style="font-size:0.72rem;color:var(--text-muted);">resultados externos</span>' +
      '</div>' +
      '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">Filtro aplicado: ' + filterLabel + '</div>';
    // Estados: ainda carregando / sem center / sem resultados / com resultados.
    if (state.loading) {
      return header + '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">Buscando no Google…</div></div>';
    }
    if (!state.center) {
      return header + '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">⚠️ Digite um endereço em "Local" ou use o botão GPS 📍 para ativar a busca no Google.</div></div>';
    }
    if (g.length === 0) {
      return header + '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">Nenhum resultado no Google para esta combinação. Tente aumentar o raio ou remover filtros.</div></div>';
    }
    var html = header + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;">';
    g.forEach(function(p) {
      var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name || '') +
        (p.placeId ? '&query_place_id=' + encodeURIComponent(p.placeId) : '');
      html += '<a href="' + _safe(mapsUrl) + '" target="_blank" rel="noopener" style="display:block;background:var(--bg-darker);border:1px solid var(--border-color);border-radius:12px;padding:10px 12px;text-decoration:none;">' +
        '<div style="font-weight:600;color:var(--text-bright);font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🗺️ ' + _safe(p.name) + '</div>' +
        (p.address ? '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(p.address) + '</div>' : '') +
      '</a>';
    });
    html += '</div></div>';
    return html;
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
          '<div style="font-size:0.95rem;font-weight:600;color:var(--text-bright);margin-bottom:4px;">Nenhum local cadastrado aqui ainda</div>' +
          '<div style="font-size:0.82rem;">Ajuste os filtros ou cadastre o seu. Veja abaixo sugestões do Google.</div>' +
        '</div>' +
        _registerCtaHtml() +
        _googleSuggestionsHtml();
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
      var isPro = v.plan === 'pro';
      var cardStyle = isPro
        ? 'background:linear-gradient(135deg, rgba(59,130,246,0.08) 0%, var(--bg-card) 60%);border:1px solid rgba(99,102,241,0.4);box-shadow:0 0 16px rgba(99,102,241,0.18);border-radius:14px;padding:14px;cursor:pointer;'
        : 'background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:14px;cursor:pointer;';
      html +=
        '<div class="hover-lift" style="' + cardStyle + '" onclick="window._venuesOpenDetail(\'' + _safe(v._id) + '\')">' +
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
    html += _registerCtaHtml() + _googleSuggestionsHtml();
    box.innerHTML = html;
  }

  // HTML dos cards dos venues da plataforma (extraído do renderResults p/
  // ser reusado abaixo do mapa também). Inclui título contextual se houver.
  function _platformVenuesHtml() {
    if (state.loading) return '<div style="text-align:center;color:var(--text-muted);padding:1.5rem;">Carregando locais…</div>';
    if (state.results.length === 0) return '';
    var html = '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">📋 ' + state.results.length + ' ' + (state.results.length === 1 ? 'local cadastrado' : 'locais cadastrados') + ' na plataforma</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">';
    state.results.forEach(function(v) {
      var sportsHtml = (Array.isArray(v.sports) ? v.sports : []).slice(0, 4).map(function(s) {
        return '<span style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-size:0.65rem;padding:1px 7px;border-radius:999px;margin-right:3px;">' + _safe(s) + '</span>';
      }).join('');
      var meta = [];
      if (v.courtCount) meta.push(v.courtCount + ' quadra' + (v.courtCount === 1 ? '' : 's'));
      if (v.priceRange) meta.push(v.priceRange);
      if (v.city) meta.push(v.city);
      var officialTag = v.ownerUid
        ? '<span title="Informações confirmadas pelo proprietário" style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#10b981;font-size:0.62rem;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px;">✅ OFICIAL</span>'
        : (v.createdByName
            ? '<span title="Cadastrado por um usuário — informações não confirmadas pelo proprietário" style="background:rgba(148,163,184,0.15);border:1px solid rgba(148,163,184,0.3);color:#94a3b8;font-size:0.62rem;font-weight:600;padding:1px 7px;border-radius:999px;margin-left:6px;">por ' + _safe(v.createdByName) + '</span>'
            : '');
      var proBadge = v.plan === 'pro' ? '<span style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:0.58rem;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px;">PRO</span>' : '';
      var isPro = v.plan === 'pro';
      var cardStyle = isPro
        ? 'background:linear-gradient(135deg, rgba(59,130,246,0.08) 0%, var(--bg-card) 60%);border:1px solid rgba(99,102,241,0.4);box-shadow:0 0 16px rgba(99,102,241,0.18);border-radius:12px;padding:12px;cursor:pointer;'
        : 'background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:12px;cursor:pointer;';
      html +=
        '<div class="hover-lift" style="' + cardStyle + '" onclick="window._venuesOpenDetail(\'' + _safe(v._id) + '\')">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">' +
            '<span style="font-size:1.1rem;">🏢</span>' +
            '<div style="font-weight:700;color:var(--text-bright);font-size:0.9rem;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(v.name) + proBadge + '</div>' +
          '</div>' +
          '<div style="margin-bottom:4px;">' + officialTag + '</div>' +
          (v.address ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ' + _safe(v.address) + '</div>' : '') +
          (sportsHtml ? '<div style="margin-bottom:4px;">' + sportsHtml + '</div>' : '') +
          (meta.length ? '<div style="font-size:0.72rem;color:var(--text-bright);font-weight:600;">' + _safe(meta.join(' · ')) + '</div>' : '') +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  // Summary acima do mapa: contagem rápida + botão "expandir raio"
  // quando a combinação filtros + raio não retorna nada, ajudando o usuário
  // a sair do beco sem saída sem precisar mexer manualmente nos inputs.
  function _hydrateMapSummary() {
    var bar = document.getElementById('venues-map-summary');
    if (!bar) return;
    if (state.loading) {
      bar.innerHTML = '<span>Buscando locais…</span>';
      return;
    }
    var claimed = state.results.length;
    var google = (state.googleResults || []).length;
    var total = claimed + google;
    var parts = [];
    if (claimed > 0) {
      parts.push('<span>🏢 <b style="color:var(--text-bright);">' + claimed + '</b> ' +
        (claimed === 1 ? 'cadastrado' : 'cadastrados') + '</span>');
    }
    if (google > 0) {
      parts.push('<span>🔎 <b style="color:var(--text-bright);">' + google + '</b> ' +
        (google === 1 ? 'sugestão' : 'sugestões') + ' Google</span>');
    }
    // Zero resultados + raio pequeno → oferece expandir com um clique.
    // Só dispara se o usuário tem center (senão geocode falhou) e o raio
    // atual tem espaço pra crescer antes do cap de 500km.
    if (total === 0 && state.center) {
      var nextRadius = Math.min(500, Math.max(20, (state.distanceKm || 10) * 3));
      if (nextRadius > (state.distanceKm || 10)) {
        parts.push(
          '<span style="color:var(--text-muted);">Sem resultados no raio de ' + (state.distanceKm || 10) + 'km.</span>' +
          '<button type="button" onclick="window._venuesExpandRadius(' + nextRadius + ')" ' +
          'style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;border-radius:8px;padding:4px 10px;font-size:0.78rem;font-weight:600;cursor:pointer;">' +
          '🔍 Expandir para ' + nextRadius + 'km</button>'
        );
      } else {
        parts.push('<span style="color:var(--text-muted);">Sem resultados. Tente remover filtros.</span>');
      }
    }
    bar.innerHTML = parts.join(' · ') || '<span style="color:var(--text-muted);">Ajustando filtros…</span>';
  }

  // Triplica o raio em um clique — helper do summary bar quando 0 resultados.
  window._venuesExpandRadius = function(newKm) {
    state.distanceKm = Math.max(1, Math.min(500, parseInt(newKm, 10) || 30));
    _saveFilters();
    // Re-render o formulário inteiro pra refletir o novo valor no input numérico.
    render(document.getElementById('view-container'));
  };

  // Extras abaixo do mapa: locais da plataforma (com as tags) → CTA cadastrar
  // → sugestões do Google com o mesmo raio/modalidade. Mantém narrativa
  // consistente entre lista e mapa.
  function _hydrateMapExtras() {
    _hydrateMapSummary();
    var slot = document.getElementById('venues-map-extras');
    if (!slot) return;
    var parts = [];
    var platform = _platformVenuesHtml();
    if (platform) parts.push('<div style="margin-top:16px;">' + platform + '</div>');
    parts.push(_registerCtaHtml());
    parts.push(_googleSuggestionsHtml());
    slot.innerHTML = parts.join('');
  }

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

  // Debounce user typing in city filter so we don't spam Firestore on each keystroke.
  window._venuesOnLocation = function(v) {
    state.location = v;
    // Usuário está digitando um endereço — solta o lock do GPS para o
    // geocoder recalcular o centro a partir do texto.
    state.centerFromGps = false;
    _saveFilters();
    clearTimeout(window._venuesLocationDebounce);
    window._venuesLocationDebounce = setTimeout(refresh, 350);
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

  // Auto-geolocate na primeira abertura da view. Comportamento:
  //   - Mobile (pointer coarse): sempre pede GPS, mesmo com permissão em
  //     "prompt" — justamente o caso que o usuário pediu ("assim que abrir
  //     a página"). Se o user negar, cai no fallback da cidade do perfil.
  //   - Desktop: só dispara GPS se a permissão JÁ está `granted`, para não
  //     poluir a primeira visita com um prompt intrusivo.
  //   - Em ambos os casos, só tenta uma vez por sessão (sessionStorage flag).
  function _isMobile() {
    try {
      return window.matchMedia && (
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(max-width: 768px)').matches
      );
    } catch (e) { return false; }
  }
  // Idempotência: controlada pelo caller via `state.centerFromGps` (já fez
  // GPS nesta sessão → não re-pede). Sem sessionStorage flag — aquele
  // persistia entre reloads e bloqueava o que o usuário explicitamente
  // quer: refresh da página → GPS automático.
  function _tryAutoGeolocate() {
    var isMob = _isMobile();
    if (isMob) {
      // Mobile: dispara direto. Se permissão = granted, resolve silencioso.
      // Se = prompt, browser mostra o diálogo nativo. Se = denied, erro
      // catch-ado silenciosamente em _venuesUseMyLocation(false).
      window._venuesUseMyLocation(false);
      return;
    }
    // Desktop: só dispara se permissão já é 'granted' — não invadimos a
    // primeira visita com um prompt intrusivo num device onde GPS é menos
    // útil.
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(function(res) {
        if (res && res.state === 'granted') window._venuesUseMyLocation(false);
      }).catch(function() {});
    }
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
      sport: (v.sports && v.sports[0]) || '',
      lat: v.lat, lon: v.lon
    });

    var overlay = document.createElement('div');
    overlay.id = 'venues-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10010;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    // Tags de proveniência: "✅ Informações oficiais" quando reivindicado;
    // "📝 Cadastrado por [nome]" quando é cadastro comunitário.
    var ownershipTag = v.ownerUid
      ? '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#10b981;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:999px;">✅ Informações oficiais</span>'
      : (v.createdByName
          ? '<span title="Este local foi cadastrado por um usuário da comunidade. Pode não refletir 100% a realidade até o proprietário reivindicar." style="display:inline-flex;align-items:center;gap:4px;background:rgba(148,163,184,0.15);border:1px solid rgba(148,163,184,0.3);color:#94a3b8;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:999px;">📝 Cadastrado por ' + _safe(v.createdByName) + '</span>'
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
            '<div style="font-weight:800;color:var(--text-bright);font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏢 ' + _safe(v.name) + '</div>' +
            (v.address ? '<div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ' + _safe(v.address) + '</div>' : '') +
          '</div>' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'venues-detail-overlay\').remove()" style="flex-shrink:0;">Fechar</button>' +
        '</div>' +
        '<div style="padding:16px 18px;">' +
          (ownershipTag || claimBtn ? '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px;">' + ownershipTag + claimBtn + '</div>' : '') +
          (sportsHtml ? '<div style="margin-bottom:10px;">' + sportsHtml + '</div>' : '') +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:0.85rem;color:var(--text-bright);margin-bottom:12px;">' +
            (v.courtCount ? '<div>🎾 ' + v.courtCount + ' quadra' + (v.courtCount === 1 ? '' : 's') + (v.courtType ? ' (' + _safe(v.courtType) + ')' : '') + '</div>' : '') +
            (v.priceRange ? '<div>💰 ' + _safe(v.priceRange) + '</div>' : '') +
            (v.city ? '<div>🏙️ ' + _safe(v.city) + '</div>' : '') +
          '</div>' +
          (v.hours ? '<div style="font-size:0.82rem;color:var(--text-bright);margin-bottom:10px;">⏰ ' + _safe(v.hours) + '</div>' : '') +
          (v.description ? '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5;">' + _safe(v.description) + '</div>' : '') +
          (contactBits.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + contactBits.join('') + '</div>' : '') +
          '<div id="venue-owner-stats-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-movimento-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-tournaments-slot" style="margin-bottom:12px;"></div>' +
          '<div id="venue-reviews-slot" style="margin-bottom:12px;"></div>' +
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
