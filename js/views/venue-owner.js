// ========================================
// scoreplace.app — Venue Owner (Claim + Edit)
// ========================================
// Section injected at the bottom of the profile modal so proprietors can
// claim venues they own and keep their details up to date. Uses the same
// Google Places autocomplete as the tournament create flow.
//
// Flow:
//   1. User types in the search box → Places suggestions drop down.
//   2. Selecting a suggestion fetches full place details and opens the
//      inline claim form pre-filled with name/address/lat/lon/city.
//   3. User fills optional fields (sports, courts, hours, prices, contacts)
//      and clicks "Reivindicar".
//   4. VenueDB.claimVenue runs a transaction: if the venue is already
//      claimed by somebody else we surface an error and suggest contacting
//      support; otherwise the doc is created/updated with ownerUid.
//   5. The list of "Meus locais" below refreshes.

(function() {
  var _placesLibReady = false;

  // Modalidades suportadas — racket-family + wider list (squash, futvôlei etc.)
  // Mantemos uma lista curta pro cadastro rápido; courts multi-sport permitem
  // indicar que uma quadra atende várias modalidades compartilhadas.
  var SPORTS = ['Beach Tennis', 'Pickleball', 'Tênis', 'Tênis de Mesa', 'Padel', 'Squash', 'Vôlei de Praia', 'Futvôlei', 'Futebol Society', 'Basquete'];

  function _safe(s) { return window._safeHtml ? window._safeHtml(s) : String(s || ''); }

  // ─── Hours grid helpers (7 days × 24 hours) ───────────────────────────────
  // Internal day order: 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sáb, 6=Dom.
  // Google Places API uses 0=Sun; we map via (googleDay + 6) % 7.
  var DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function _emptyHoursGrid() {
    var g = [];
    for (var d = 0; d < 7; d++) {
      var row = [];
      for (var h = 0; h < 24; h++) row.push(0);
      g.push(row);
    }
    return g;
  }

  // Convert Google Places `regularOpeningHours.periods[]` into our 7×24
  // boolean grid. A period open→close spans whole hours; if close crosses
  // midnight (common for late-night venues), we wrap to the next day.
  // Tolerant to missing fields — returns an empty grid when input is absent.
  function _googleHoursToGrid(place) {
    var grid = _emptyHoursGrid();
    if (!place || !place.regularOpeningHours || !Array.isArray(place.regularOpeningHours.periods)) return grid;
    var periods = place.regularOpeningHours.periods;
    periods.forEach(function(p) {
      if (!p.open) return;
      var startDay = (p.open.day + 6) % 7;
      var startHour = p.open.hour || 0;
      var endDay, endHour;
      if (p.close) {
        endDay = (p.close.day + 6) % 7;
        endHour = p.close.hour || 0;
        if (p.close.minute && p.close.minute > 0) endHour += 1; // pad partial hour
      } else {
        // open with no close = 24h from start
        endDay = startDay;
        endHour = 24;
      }
      // Walk hour by hour from (startDay,startHour) to (endDay,endHour).
      // Cap at 7*24 iterations to guard against malformed input.
      var d = startDay, h = startHour, steps = 0;
      while (steps < 7 * 24) {
        if (d === endDay && h >= endHour) break;
        grid[d][h] = 1;
        h += 1;
        if (h >= 24) { h = 0; d = (d + 1) % 7; }
        steps += 1;
      }
    });
    return grid;
  }

  function _buildHoursGridHtml(grid) {
    grid = grid || _emptyHoursGrid();
    // Hour header row: 0, 2, 4, ..., 22 shown (every 2h to fit mobile width).
    var hourHdr = '';
    for (var h = 0; h < 24; h++) {
      hourHdr += '<div style="flex:1;min-width:0;text-align:center;font-size:0.55rem;color:var(--text-muted);">' + (h % 2 === 0 ? h : '') + '</div>';
    }
    var rows = '';
    for (var d = 0; d < 7; d++) {
      var cells = '';
      for (var hh = 0; hh < 24; hh++) {
        var open = grid[d] && grid[d][hh] ? 1 : 0;
        var bg = open ? 'background:#10b981;' : 'background:#7f1d1d;';
        cells += '<div class="hg-cell" data-day="' + d + '" data-hour="' + hh + '" data-open="' + open + '" style="flex:1;min-width:0;height:22px;' + bg + 'border-right:1px solid rgba(0,0,0,0.35);"></div>';
      }
      rows += '<div style="display:flex;align-items:stretch;gap:0;border-bottom:1px solid rgba(0,0,0,0.25);">' +
                '<div style="width:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:700;color:var(--text-muted);background:var(--bg-darker);">' + DAY_LABELS[d] + '</div>' +
                '<div style="flex:1;display:flex;">' + cells + '</div>' +
              '</div>';
    }
    return '<div id="venue-owner-hours-grid" style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden;user-select:none;touch-action:none;">' +
             '<div style="display:flex;background:var(--bg-darker);padding:4px 0;">' +
               '<div style="width:30px;flex-shrink:0;"></div>' +
               '<div style="flex:1;display:flex;">' + hourHdr + '</div>' +
             '</div>' +
             rows +
           '</div>' +
           '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;">' +
             '🟢 aberto · 🟥 fechado · <b>arraste o dedo</b> pra pintar várias células' +
           '</div>';
  }

  // Attach pointer handlers to the hours grid so the user can drag-paint
  // across cells. First tap sets the paint mode (invert current cell);
  // every cell the pointer enters while down gets painted the same color.
  function _setupHoursGridListeners() {
    var grid = document.getElementById('venue-owner-hours-grid');
    if (!grid) return;
    var painting = false;
    var paintTo = 1;

    function paintCell(el) {
      if (!el || !el.classList || !el.classList.contains('hg-cell')) return;
      el.setAttribute('data-open', String(paintTo));
      el.style.background = paintTo ? '#10b981' : '#7f1d1d';
    }

    grid.addEventListener('pointerdown', function(ev) {
      var target = ev.target;
      if (!target.classList || !target.classList.contains('hg-cell')) return;
      ev.preventDefault();
      painting = true;
      paintTo = target.getAttribute('data-open') === '1' ? 0 : 1;
      paintCell(target);
      try { grid.setPointerCapture(ev.pointerId); } catch (e) {}
    });

    grid.addEventListener('pointermove', function(ev) {
      if (!painting) return;
      ev.preventDefault();
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      paintCell(el);
    });

    function stop() { painting = false; }
    grid.addEventListener('pointerup', stop);
    grid.addEventListener('pointercancel', stop);
    grid.addEventListener('pointerleave', stop);
  }

  function _readHoursGrid() {
    var grid = _emptyHoursGrid();
    document.querySelectorAll('#venue-owner-hours-grid .hg-cell').forEach(function(cell) {
      var d = parseInt(cell.getAttribute('data-day'), 10);
      var h = parseInt(cell.getAttribute('data-hour'), 10);
      if (isNaN(d) || isNaN(h)) return;
      grid[d][h] = cell.getAttribute('data-open') === '1' ? 1 : 0;
    });
    return grid;
  }

  // Any cell set? Used to decide whether to bother persisting the grid field.
  function _gridAny(grid) {
    if (!Array.isArray(grid)) return false;
    for (var d = 0; d < grid.length; d++) {
      if (!Array.isArray(grid[d])) continue;
      for (var h = 0; h < grid[d].length; h++) if (grid[d][h]) return true;
    }
    return false;
  }

  // ─── Small read-only interactive Google Map below the venue name ──────────
  // Single-marker, centered at (lat, lon), zoom ~16. Loads maps+marker
  // libraries on demand (the places library is already loaded by ensurePlaces,
  // but Map/AdvancedMarker need explicit importLibrary calls).
  async function _initVenueMap(lat, lon) {
    var el = document.getElementById('venue-owner-map');
    if (!el || lat == null || lon == null) return;
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return;
    try {
      var Maps = await google.maps.importLibrary('maps');
      var Marker = await google.maps.importLibrary('marker');
      var map = new Maps.Map(el, {
        center: { lat: lat, lng: lon },
        zoom: 16,
        disableDefaultUI: true,
        gestureHandling: 'cooperative',
        clickableIcons: false,
        mapId: 'SCOREPLACE_VENUE_OWNER_MAP'
      });
      if (Marker && Marker.AdvancedMarkerElement) {
        new Marker.AdvancedMarkerElement({
          map: map,
          position: { lat: lat, lng: lon }
        });
      }
    } catch (e) {
      // Fallback: show the address instead of a broken map iframe.
      console.warn('venue-owner map init failed:', e && e.message);
      el.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-size:0.78rem;text-align:center;">📍 mapa indisponível</div>';
    }
  }

  // Ensure Places library is loaded lazily — the profile modal opens before
  // the user necessarily needs it.
  async function ensurePlaces() {
    if (_placesLibReady) return;
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return;
    try { await google.maps.importLibrary('places'); _placesLibReady = true; } catch (e) {}
  }

  // Inner block — search input, form wrap, and "meus locais" list.
  // Used by both the (legacy) profile modal section and the dedicated view.
  function _ownerInnerHtml() {
    return '<div style="position:relative;margin-bottom:8px;">' +
        '<input type="text" id="venue-owner-search" class="form-control" placeholder="Buscar local no Google (clube, arena, quadra)" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:0.9rem;" oninput="window._venueOwnerSearch(this.value)">' +
        '<div id="venue-owner-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:9999;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;margin-top:4px;max-height:240px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);"></div>' +
      '</div>' +
      '<div id="venue-owner-form-wrap"></div>' +
      '<div id="venue-owner-list" style="margin-top:14px;"></div>';
  }

  // Legacy entry used when the section was inlined inside the profile modal.
  // Kept for compat; new surface is the #my-venues full-page view below.
  window._renderVenueOwnerSection = function(container) {
    if (!container) return;
    container.innerHTML =
      '<div style="margin-top:1rem;">' +
        '<label class="form-label" style="font-size:0.8rem;font-weight:600;display:flex;align-items:center;gap:6px;">🏢 Cadastre locais</label>' +
        '<p style="font-size:0.7rem;color:var(--text-muted);margin:0 0 8px 0;">Gerenciamento completo agora fica em <a href="#my-venues" onclick="document.getElementById(\'modal-profile\').classList.remove(\'active\')" style="color:#a5b4fc;font-weight:600;">Meus locais</a>.</p>' +
        _ownerInnerHtml() +
      '</div>';
    ensurePlaces();
    window._loadMyVenuesList();
  };

  // Dedicated, full-page venue management view. Conceptually separate from
  // the user profile — this is where a proprietor (not a player) works.
  window.renderMyVenues = function(container) {
    if (!container) return;
    var back = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({ href: '#venues', label: 'Voltar' })
      : '';
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) {
      container.innerHTML = back +
        '<div class="card" style="max-width:600px;margin:2rem auto;padding:2rem;text-align:center;">' +
          '<h2 style="margin:0 0 1rem 0;">Meus locais</h2>' +
          '<p style="color:var(--text-muted);margin-bottom:1rem;">Faça login para cadastrar ou gerenciar locais que você administra.</p>' +
          '<button class="btn btn-primary" onclick="if(typeof openModal===\'function\')openModal(\'modal-login\')">Entrar</button>' +
        '</div>';
      return;
    }
    container.innerHTML = back +
      '<div style="max-width:820px;margin:0 auto;padding:0 4px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">' +
          '<h2 style="margin:0;font-size:1.45rem;font-weight:800;color:var(--text-bright);flex:1;">🏢 Cadastre locais</h2>' +
        '</div>' +
        '<p style="color:var(--text-muted);font-size:0.88rem;margin:0 0 1rem 0;">' +
          'Cadastre clubes, arenas ou quadras — seu ou de qualquer lugar aberto ao público que você conhece. Locais cadastrados aparecem na busca pública de jogadores. Se você é o <b>proprietário</b>, marque a opção no formulário para adicionar a tag <b>✅ Informações oficiais</b>.' +
        '</p>' +
        '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:16px;">' +
          _ownerInnerHtml() +
        '</div>' +
      '</div>';
    ensurePlaces();
    window._loadMyVenuesList();
  };

  // Places autocomplete — busca dinâmica (v0.15.28): 2 char mínimo + 150ms
  // debounce pra match com a busca do profile (v0.15.19). Resposta quase
  // imediata conforme o usuário digita "Ar" → já começa a mostrar "Arena X".
  var _searchTimer = null;
  window._venueOwnerSearch = function(query) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function() { _doSearch(query); }, 150);
  };
  async function _doSearch(query) {
    var box = document.getElementById('venue-owner-suggestions');
    if (!box) return;
    var q = String(query || '').trim();
    if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    await ensurePlaces();
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      box.innerHTML = '<div style="padding:10px;color:#f87171;font-size:0.8rem;">Google Places indisponível.</div>';
      box.style.display = 'block';
      return;
    }
    try {
      var result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ['br'],
        includedPrimaryTypes: ['establishment'],
        language: 'pt-BR'
      });
      var suggestions = result.suggestions || [];
      if (suggestions.length === 0) {
        box.innerHTML = '<div style="padding:10px;color:#94a3b8;font-size:0.8rem;">Nada encontrado.</div>';
        box.style.display = 'block';
        return;
      }
      box.innerHTML = '';
      suggestions.forEach(function(s) {
        if (!s.placePrediction) return;
        var pred = s.placePrediction;
        var main = pred.mainText ? pred.mainText.text : '';
        var sec = pred.secondaryText ? pred.secondaryText.text : '';
        var item = document.createElement('div');
        item.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);';
        item.innerHTML = '<div style="color:#e2e8f0;font-size:0.85rem;font-weight:500;">📍 ' + _safe(main) + '</div>' +
          (sec ? '<div style="color:#94a3b8;font-size:0.75rem;margin-top:2px;">' + _safe(sec) + '</div>' : '');
        item.addEventListener('mouseenter', function() { item.style.background = 'rgba(129,140,248,0.15)'; });
        item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
        item.addEventListener('mousedown', function(ev) { ev.preventDefault(); _selectPlace(pred); });
        box.appendChild(item);
      });
      box.style.display = 'block';
    } catch (err) {
      console.error('Venue owner search error:', err);
      box.innerHTML = '<div style="padding:10px;color:#f87171;font-size:0.8rem;">Erro: ' + _safe(err.message || 'indisponível') + '</div>';
      box.style.display = 'block';
    }
  }

  async function _selectPlace(prediction) {
    var box = document.getElementById('venue-owner-suggestions');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    try {
      var place = prediction.toPlace();
      // Campos expandidos — pré-preenche telefone, website, horário,
      // faixa de preço do Google Places quando disponíveis. Reduz atrito
      // para o usuário cadastrando; o dono pode editar depois.
      await place.fetchFields({ fields: [
        'displayName', 'formattedAddress', 'location', 'addressComponents', 'id',
        'nationalPhoneNumber', 'websiteURI', 'regularOpeningHours', 'priceLevel'
      ] });
      var city = '';
      if (place.addressComponents) {
        for (var i = 0; i < place.addressComponents.length; i++) {
          var comp = place.addressComponents[i];
          if ((comp.types || []).indexOf('administrative_area_level_2') !== -1) { city = comp.longText || comp.shortText; break; }
          if ((comp.types || []).indexOf('locality') !== -1) { city = comp.longText || comp.shortText; break; }
        }
      }
      var name = place.displayName || '';
      var addr = place.formattedAddress || '';
      var lat = place.location ? place.location.lat() : null;
      var lon = place.location ? place.location.lng() : null;
      var pid = place.id || '';
      // Campos extras do Google para pré-preenchimento.
      var googlePhone = place.nationalPhoneNumber || '';
      var googleWebsite = place.websiteURI || '';
      var googleHoursGrid = _googleHoursToGrid(place);

      // Clear the search input so it doesn't look stale next to the form.
      var search = document.getElementById('venue-owner-search');
      if (search) search.value = name;

      // Dedup por placeId — se venue já existe, abre em modo EDIÇÃO
      // (colaborativo enquanto sem dono, oficial quando é meu).
      var existing = await window.VenueDB.loadVenue(window.VenueDB.venueKey(pid, name));
      var cu = window.AppStore && window.AppStore.currentUser;
      var otherOwner = existing && existing.ownerUid && (!cu || existing.ownerUid !== cu.uid);
      if (otherOwner) {
        _renderForm(null, {
          warning: 'Este local já foi reivindicado por outro usuário. Se você é o verdadeiro dono, escreva para scoreplace.app@gmail.com.'
        });
        return;
      }
      var alreadyCommunity = existing && !existing.ownerUid && existing.createdByName;
      // Pre-fill packet for the form. When editing an existing doc we only
      // use Google values as fallback for blank fields; fresh cadastro
      // adopts Google wholesale.
      var hasAnyGoogle = !!(googlePhone || googleWebsite || (googleHoursGrid && _gridAny(googleHoursGrid)));
      var prefillData = {
        contact: { phone: googlePhone, website: googleWebsite },
        website: googleWebsite,
        openingHours: googleHoursGrid && _gridAny(googleHoursGrid) ? { grid: googleHoursGrid } : null
      };
      _renderForm({
        placeId: window.VenueDB.venueKey(pid, name),
        name: name, address: addr, city: city, lat: lat, lon: lon
      }, {
        existing: existing || null,
        googlePrefill: !existing && hasAnyGoogle,
        googlePrefillData: prefillData,
        collaborativeBanner: !!alreadyCommunity,
        creatorName: alreadyCommunity ? existing.createdByName : ''
      });
    } catch (err) {
      console.error('Place details error:', err);
    }
  }

  function _renderForm(place, opts) {
    var wrap = document.getElementById('venue-owner-form-wrap');
    if (!wrap) return;
    opts = opts || {};
    if (opts.warning) {
      wrap.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;color:#fca5a5;font-size:0.82rem;">⚠️ ' + _safe(opts.warning) + '</div>';
      return;
    }
    if (!place) { wrap.innerHTML = ''; return; }

    // Merge prefill: existing venue doc > Google auto-fill > empty.
    var ex = opts.existing || {};
    if (opts.googlePrefillData && !opts.existing) {
      // On a fresh cadastro the only source of truth is Google — adopt its
      // defaults wholesale.
      ex = opts.googlePrefillData;
    } else if (opts.googlePrefillData && opts.existing) {
      // Editing an existing doc: only adopt Google defaults for blank fields.
      if (opts.googlePrefillData.contact) {
        if (!ex.contact) ex.contact = {};
        ['phone', 'website'].forEach(function(k) {
          if (!ex.contact[k] && opts.googlePrefillData.contact[k]) ex.contact[k] = opts.googlePrefillData.contact[k];
        });
      }
      if (!ex.openingHours && opts.googlePrefillData.openingHours) ex.openingHours = opts.googlePrefillData.openingHours;
    }

    var cu = window.AppStore && window.AppStore.currentUser;
    var imOwner = cu && opts.existing && opts.existing.ownerUid === cu.uid;
    var titleLabel;
    if (imOwner) titleLabel = '✏️ Editar meu local';
    else if (opts.existing) titleLabel = '✏️ Editar local cadastrado por ' + _safe(opts.creatorName || 'outro usuário');
    else titleLabel = '💾 Cadastrar local novo';

    var collabBanner = (opts.collaborativeBanner && !imOwner)
      ? '<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:0.76rem;color:var(--text-main);">🤝 Local já cadastrado por <b>' + _safe(opts.creatorName || '') + '</b>. Você pode completar/corrigir colaborativamente até o proprietário assumir.</div>'
      : '';
    var googleBanner = (opts.googlePrefill && !opts.existing)
      ? '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:0.76rem;color:var(--text-main);">📍 Preenchido automaticamente do Google (horário, telefone, site). Ajuste o que quiser antes de salvar.</div>'
      : '';

    // Opening hours stored sob ex.openingHours.grid (array 7×24 de booleans).
    var hoursGrid = (ex.openingHours && Array.isArray(ex.openingHours.grid))
      ? ex.openingHours.grid
      : _emptyHoursGrid();

    // Claim button state
    var imClaimed = imOwner;
    var hasOtherOwner = ex.ownerUid && !imOwner;
    var canClaim = !hasOtherOwner;
    var claimBtnHtml = canClaim
      ? '<button type="button" id="venue-owner-claim-btn" onclick="window._venueOwnerToggleClaim()" data-claimed="' + (imClaimed ? '1' : '0') + '" style="flex:1;padding:12px;border-radius:10px;font-weight:700;font-size:0.88rem;cursor:pointer;border:1px solid ' + (imClaimed ? 'rgba(16,185,129,0.5)' : 'rgba(251,191,36,0.4)') + ';background:' + (imClaimed ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.1)') + ';color:' + (imClaimed ? '#10b981' : '#fbbf24') + ';">' + (imClaimed ? '✅ Reivindicado por você' : '🏢 Reivindicar como proprietário') + '</button>'
      : '<button type="button" disabled style="flex:1;padding:12px;border-radius:10px;font-weight:700;font-size:0.88rem;border:1px solid var(--border-color);background:var(--bg-darker);color:var(--text-muted);cursor:not-allowed;" title="Já reivindicado por outro usuário">🔒 Já reivindicado</button>';

    // Courts button — only active after the venue has been persisted (has placeId).
    var courtsBtnHtml = opts.existing
      ? '<button type="button" onclick=\'window._venueCourtAddDialog("' + _safe(place.placeId).replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + '")\' style="flex:1;padding:12px;border-radius:10px;font-weight:700;font-size:0.88rem;cursor:pointer;border:1px solid rgba(99,102,241,0.5);background:rgba(99,102,241,0.15);color:#a5b4fc;">🎾 Cadastrar quadras / campos</button>'
      : '<button type="button" disabled title="Salve o local primeiro" style="flex:1;padding:12px;border-radius:10px;font-weight:700;font-size:0.88rem;border:1px solid var(--border-color);background:var(--bg-darker);color:var(--text-muted);cursor:not-allowed;">🎾 Cadastrar quadras (salve primeiro)</button>';

    wrap.innerHTML =
      '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:12px;padding:14px;margin-top:6px;">' +
        '<div style="font-weight:700;color:var(--text-bright);font-size:0.92rem;margin-bottom:8px;">' + titleLabel + '</div>' +
        collabBanner +
        googleBanner +

        // ── Nome + endereço + mapa ──
        '<div style="margin-bottom:12px;">' +
          '<div style="font-weight:700;color:var(--text-bright);font-size:1rem;margin-bottom:2px;">' + _safe(place.name) + '</div>' +
          '<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:8px;">' + _safe(place.address || '') + '</div>' +
          '<div id="venue-owner-map" style="width:100%;height:180px;border-radius:10px;background:#0a0e1a;border:1px solid var(--border-color);overflow:hidden;"></div>' +
        '</div>' +

        // ── Política de acesso ──
        '<label style="display:block;font-size:0.76rem;font-weight:600;color:var(--text-muted);margin-bottom:12px;">🔐 Política de acesso' +
          '<select id="venue-owner-access" style="display:block;width:100%;margin-top:4px;padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
            '<option value="public"' + ((ex.accessPolicy || 'public') === 'public' ? ' selected' : '') + '>🌐 Público — aberto a qualquer pessoa</option>' +
            '<option value="members"' + (ex.accessPolicy === 'members' ? ' selected' : '') + '>👥 Só sócios</option>' +
            '<option value="members_plus_guests"' + (ex.accessPolicy === 'members_plus_guests' ? ' selected' : '') + '>👥+🏆 Sócios e convidados de torneios</option>' +
            '<option value="private"' + (ex.accessPolicy === 'private' ? ' selected' : '') + '>🔒 Privado</option>' +
          '</select>' +
        '</label>' +

        // ── Horário de funcionamento (7×24 grid) ──
        '<div style="margin-bottom:14px;">' +
          '<div style="font-size:0.76rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">🕐 Horário de funcionamento</div>' +
          _buildHoursGridHtml(hoursGrid) +
        '</div>' +

        // ── Contatos ──
        '<div style="font-size:0.76rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">📞 Contatos</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
          '<input type="tel" id="venue-owner-phone" value="' + _safe((ex.contact && ex.contact.phone) || '') + '" placeholder="📞 Telefone" style="padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
          '<input type="tel" id="venue-owner-whatsapp" value="' + _safe((ex.contact && ex.contact.whatsapp) || '') + '" placeholder="💬 WhatsApp" style="padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
          '<input type="text" id="venue-owner-insta" value="' + _safe((ex.contact && ex.contact.instagram) || '') + '" placeholder="📷 Instagram" style="padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
          '<input type="text" id="venue-owner-facebook" value="' + _safe((ex.contact && ex.contact.facebook) || '') + '" placeholder="📘 Facebook" style="padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
          '<input type="url" id="venue-owner-website" value="' + _safe((ex.contact && ex.contact.website) || '') + '" placeholder="🌐 Site" style="padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
          '<input type="email" id="venue-owner-email" value="' + _safe((ex.contact && ex.contact.email) || '') + '" placeholder="✉️ E-mail" style="padding:10px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.88rem;">' +
        '</div>' +

        // ── Botões de ação principal ──
        '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
          claimBtnHtml +
          courtsBtnHtml +
        '</div>' +

        // ── Salvar / Cancelar ──
        '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="window._venueOwnerCancel()">Cancelar</button>' +
          '<button type="button" class="btn btn-primary btn-sm" onclick=\'window._spinButton(this, "Salvando..."); window._venueOwnerSubmit(' + JSON.stringify(place).replace(/'/g, '&#39;') + ')\'>' + (opts.existing ? '💾 Salvar alterações' : '💾 Cadastrar local') + '</button>' +
        '</div>' +
      '</div>';

    // Setup hours grid painting + map after DOM is ready.
    setTimeout(function() {
      _setupHoursGridListeners();
      _initVenueMap(place.lat, place.lon);
    }, 30);
  }

  // Toggle claim state button. Stored as a data-attr on the button — read at
  // submit time. Kept as a button (not checkbox) per the updated UX spec.
  window._venueOwnerToggleClaim = function() {
    var btn = document.getElementById('venue-owner-claim-btn');
    if (!btn) return;
    var claimed = btn.getAttribute('data-claimed') === '1';
    var next = claimed ? '0' : '1';
    btn.setAttribute('data-claimed', next);
    if (next === '1') {
      btn.textContent = '✅ Reivindicado por você';
      btn.style.background = 'rgba(16,185,129,0.15)';
      btn.style.border = '1px solid rgba(16,185,129,0.5)';
      btn.style.color = '#10b981';
    } else {
      btn.textContent = '🏢 Reivindicar como proprietário';
      btn.style.background = 'rgba(251,191,36,0.1)';
      btn.style.border = '1px solid rgba(251,191,36,0.4)';
      btn.style.color = '#fbbf24';
    }
  };

  function _sportIconFor(sport) {
    var s = String(sport || '').toLowerCase();
    if (s.indexOf('beach') !== -1) return '🏖️';
    if (s.indexOf('pickleball') !== -1) return '🥒';
    if (s.indexOf('mesa') !== -1 || s.indexOf('ping') !== -1) return '🏓';
    if (s.indexOf('padel') !== -1) return '🏸';
    if (s.indexOf('squash') !== -1) return '🎯';
    if (s.indexOf('tênis') !== -1 || s.indexOf('tenis') !== -1) return '🎾';
    if (s.indexOf('futvôlei') !== -1 || s.indexOf('futvolei') !== -1 || s.indexOf('futevôlei') !== -1 || s.indexOf('futevolei') !== -1) return '⚽';
    if (s.indexOf('vôlei') !== -1 || s.indexOf('volei') !== -1) return '🏐';
    if (s.indexOf('basquete') !== -1 || s.indexOf('basket') !== -1) return '🏀';
    if (s.indexOf('futebol') !== -1 || s.indexOf('soccer') !== -1) return '⚽';
    return '🎾';
  }

  // ─── Courts screen (new UX spec v0.15.43) ─────────────────────────────────
  // Full-screen overlay with venue name at top, "+" button to expand an
  // inline form (quantity + multi-sport checkboxes), and the list of
  // already-registered court entries below. Multi-sport entries represent
  // shared courts (e.g. one court where both Beach Tennis and Futvôlei can
  // be played).
  //
  // Entry points:
  //   • _venueCourtAddDialog(venueKey)        — open the screen (for this venue)
  //   • _venueCourtEditDialog(venueKey, id)   — open screen with edit form
  //                                              pre-expanded for that entry
  var _courtsDialogState = { venueKey: null, editingId: null };

  window._venueCourtAddDialog = function(venueKey) {
    _openCourtsScreen(venueKey, null);
  };
  window._venueCourtEditDialog = async function(venueKey, courtId) {
    _openCourtsScreen(venueKey, courtId);
  };

  async function _openCourtsScreen(venueKey, editingId) {
    _courtsDialogState.venueKey = venueKey;
    _courtsDialogState.editingId = editingId;
    var venue = await window.VenueDB.loadVenue(venueKey).catch(function() { return null; });
    var venueName = (venue && venue.name) || 'Local';
    var existing = null;
    if (editingId) {
      var all = await window.VenueDB.listVenueCourts(venueKey).catch(function() { return []; });
      existing = all.find(function(c) { return c._id === editingId; }) || null;
    }

    // Nuke any prior overlay before rendering so consecutive opens don't
    // stack half-torn-down DOM nodes.
    var prior = document.getElementById('court-dialog-overlay');
    if (prior) prior.remove();

    var overlay = document.createElement('div');
    overlay.id = 'court-dialog-overlay';
    // Full-screen z-index above every other app overlay including the venue
    // owner form (which is inline, no overlay).
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(8,12,24,0.96);z-index:10020;overflow-y:auto;padding:14px;';

    var safeKey = _safe(venueKey).replace(/\\/g, '\\\\').replace(/\'/g, "\\'");
    overlay.innerHTML =
      '<div style="max-width:720px;margin:0 auto;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
          '<button type="button" onclick="document.getElementById(\'court-dialog-overlay\').remove()" style="background:rgba(255,255,255,0.08);border:1px solid var(--border-color);color:var(--text-bright);border-radius:10px;padding:8px 14px;font-size:0.86rem;font-weight:600;cursor:pointer;">← Voltar</button>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:0.72rem;color:var(--text-muted);">Quadras de</div>' +
            '<div style="font-weight:800;color:var(--text-bright);font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(venueName) + '</div>' +
          '</div>' +
        '</div>' +

        // ── + (add) button + inline form placeholder ──
        '<div style="margin-bottom:12px;">' +
          '<button type="button" onclick="window._courtsToggleForm(null)" id="courts-add-btn" style="width:100%;padding:14px;border-radius:12px;background:rgba(99,102,241,0.15);border:2px dashed rgba(99,102,241,0.5);color:#a5b4fc;font-size:1rem;font-weight:700;cursor:pointer;">' +
            '➕ Adicionar quadras' +
          '</button>' +
          '<div id="courts-form-slot" style="margin-top:8px;"></div>' +
        '</div>' +

        // ── List of existing courts ──
        '<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:6px;">Quadras cadastradas neste local</div>' +
        '<div id="courts-list-slot" data-venue-key="' + safeKey + '">' +
          '<div style="font-size:0.8rem;color:var(--text-muted);padding:12px;">Carregando...</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Load the list.
    _refreshCourtsScreenList(venueKey);

    // If we entered in edit mode, auto-open the form with the existing values.
    if (existing) {
      setTimeout(function() { window._courtsToggleForm(existing); }, 30);
    }
  }

  // Render the inline add/edit form (inside the courts screen) on demand.
  // Pass `existing` (court object) to pre-fill for edit; null for a new entry.
  window._courtsToggleForm = function(existing) {
    var slot = document.getElementById('courts-form-slot');
    if (!slot) return;
    // Toggle off if clicking the + button again with no edit target.
    if (slot.childElementCount > 0 && !existing) {
      slot.innerHTML = '';
      return;
    }
    var currentSports = Array.isArray(existing && existing.sports) ? existing.sports : [];

    var sportCheckboxes = SPORTS.map(function(s) {
      var checked = currentSports.indexOf(s) !== -1 ? 'checked' : '';
      return '<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-darker);border:1px solid var(--border-color);border-radius:8px;font-size:0.82rem;color:var(--text-bright);cursor:pointer;">' +
        '<input type="checkbox" class="court-form-sport" value="' + _safe(s) + '" ' + checked + '>' +
        _safe(s) +
      '</label>';
    }).join('');

    slot.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:14px;">' +
        '<div style="font-weight:700;color:var(--text-bright);margin-bottom:10px;">' + (existing ? '✏️ Editar entrada' : '➕ Nova entrada de quadras') + '</div>' +
        '<label style="display:block;font-size:0.76rem;color:var(--text-muted);margin-bottom:10px;">Número de quadras' +
          '<input type="number" id="court-form-count" min="1" max="999" value="' + _safe(existing ? existing.count : '1') + '" style="display:block;width:100%;margin-top:4px;padding:10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:1rem;">' +
        '</label>' +
        '<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:6px;">Modalidades permitidas (marque todas que se aplicam para uso compartilhado)</div>' +
        '<div id="court-form-sports" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;margin-bottom:14px;">' +
          sportCheckboxes +
        '</div>' +
        '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'courts-form-slot\').innerHTML=\'\'">Cancelar</button>' +
          '<button class="btn btn-primary btn-sm" onclick=\'window._courtsFormSave(' + (existing ? '"' + _safe(existing._id).replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + '"' : 'null') + ')\'>💾 ' + (existing ? 'Salvar alterações' : 'Adicionar') + '</button>' +
        '</div>' +
      '</div>';
  };

  window._courtsFormSave = async function(courtId) {
    var venueKey = _courtsDialogState.venueKey;
    if (!venueKey) return;
    var count = parseInt((document.getElementById('court-form-count') || {}).value, 10) || 1;
    var sports = [];
    document.querySelectorAll('#court-form-sports input.court-form-sport:checked').forEach(function(cb) {
      sports.push(cb.value);
    });
    if (sports.length === 0) {
      if (window.showNotification) window.showNotification('Marque ao menos uma modalidade', '', 'warning');
      return;
    }
    try {
      if (courtId) {
        await window.VenueDB.updateVenueCourt(venueKey, courtId, { count: count, sports: sports });
      } else {
        await window.VenueDB.addVenueCourt(venueKey, { count: count, sports: sports });
      }
      // Collapse the form, refresh the list.
      var slot = document.getElementById('courts-form-slot');
      if (slot) slot.innerHTML = '';
      _courtsDialogState.editingId = null;
      _refreshCourtsScreenList(venueKey);
      if (window.showNotification) window.showNotification(courtId ? 'Entrada atualizada!' : 'Quadras adicionadas!', '', 'success');
    } catch (e) {
      console.error('courts form save:', e);
      if (window.showNotification) window.showNotification('Erro ao salvar: ' + (e && e.message || ''), '', 'error');
    }
  };

  async function _refreshCourtsScreenList(venueKey) {
    var box = document.getElementById('courts-list-slot');
    if (!box || !window.VenueDB) return;
    try {
      var courts = await window.VenueDB.listVenueCourts(venueKey);
      var venue = await window.VenueDB.loadVenue(venueKey).catch(function() { return null; });
      if (!courts || courts.length === 0) {
        box.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted);padding:14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;text-align:center;">Nenhuma quadra cadastrada ainda. Toque no ➕ acima pra adicionar.</div>';
        return;
      }
      var cu = window.AppStore && window.AppStore.currentUser;
      var myUid = cu && cu.uid;
      var hasOwner = !!(venue && venue.ownerUid);
      var imOwner = hasOwner && venue.ownerUid === myUid;

      var safeKey = _safe(venueKey).replace(/\\/g, '\\\\').replace(/\'/g, "\\'");
      var html = '<div style="display:flex;flex-direction:column;gap:6px;">';
      courts.forEach(function(c) {
        var canEdit = hasOwner ? imOwner : (c.contributorUid === myUid);
        var sportList = Array.isArray(c.sports) ? c.sports : [];
        var sportsText = sportList.map(function(s) { return _sportIconFor(s) + ' ' + _safe(s); }).join(' + ');
        var sharedTag = sportList.length > 1 ? '<span style="font-size:0.64rem;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;padding:2px 6px;border-radius:999px;margin-left:6px;">compartilhada</span>' : '';
        var safeId = _safe(c._id).replace(/\\/g, '\\\\').replace(/\'/g, "\\'");
        html += '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;color:var(--text-bright);font-size:0.9rem;">' + (c.count || 1) + ' quadra' + ((c.count || 1) === 1 ? '' : 's') + '</div>' +
            '<div style="font-size:0.8rem;color:var(--text-main);margin-top:2px;">' + sportsText + sharedTag + '</div>' +
            (c.contributorName ? '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">por ' + _safe(c.contributorName) + '</div>' : '') +
          '</div>' +
          (canEdit
            ? '<div style="display:flex;gap:4px;flex-shrink:0;">' +
                '<button class="btn btn-sm" onclick="window._courtsToggleForm(' + JSON.stringify(c).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + ')" style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:4px 10px;font-size:0.72rem;">Editar</button>' +
                '<button class="btn btn-sm" onclick="window._venueCourtDelete(\'' + safeKey + '\',\'' + safeId + '\')" style="background:transparent;border:1px solid var(--danger-color);color:var(--danger-color);padding:4px 10px;font-size:0.72rem;">✕</button>' +
              '</div>'
            : '') +
        '</div>';
      });
      html += '</div>';
      box.innerHTML = html;
    } catch (e) {
      console.warn('courts screen refresh:', e);
      box.innerHTML = '<div style="font-size:0.8rem;color:var(--danger-color);padding:10px;">Erro ao carregar quadras.</div>';
    }
  }

  window._venueCourtDelete = async function(venueKey, courtId) {
    if (!confirm('Apagar esta entrada de quadra?')) return;
    try {
      await window.VenueDB.deleteVenueCourt(venueKey, courtId);
      if (document.getElementById('courts-list-slot')) {
        _refreshCourtsScreenList(venueKey);
      }
      if (window.showNotification) window.showNotification('Entrada removida.', '', 'info');
    } catch (e) {
      if (window.showNotification) window.showNotification('Erro ao apagar.', '', 'error');
    }
  };

  window._venueOwnerCancel = function() {
    var wrap = document.getElementById('venue-owner-form-wrap');
    if (wrap) wrap.innerHTML = '';
    var search = document.getElementById('venue-owner-search');
    if (search) search.value = '';
  };

  window._venueOwnerSubmit = async function(place) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return;
    // Pro inheritance: venues owned by a Pro user rank higher in discovery.
    var isUserPro = (typeof window._isPro === 'function' && window._isPro()) ||
                    (cu.plan === 'pro' && (!cu.planExpiresAt || new Date(cu.planExpiresAt) > new Date()));
    var claimBtn = document.getElementById('venue-owner-claim-btn');
    var claimAsOwner = !!(claimBtn && claimBtn.getAttribute('data-claimed') === '1');
    var accessPolicyEl = document.getElementById('venue-owner-access');
    var hoursGrid = _readHoursGrid();

    var payload = {
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      city: place.city || '',
      lat: place.lat,
      lon: place.lon,
      accessPolicy: (accessPolicyEl && accessPolicyEl.value) || 'public',
      // New shape: store the 7×24 grid. Keep in a nested object so it's easy
      // to add future fields (timezone, seasonal overrides) without churning
      // the top level.
      openingHours: _gridAny(hoursGrid) ? { grid: hoursGrid } : null,
      contact: {
        phone: (document.getElementById('venue-owner-phone') || {}).value.trim() || '',
        whatsapp: (document.getElementById('venue-owner-whatsapp') || {}).value.trim() || '',
        instagram: (document.getElementById('venue-owner-insta') || {}).value.trim() || '',
        facebook: (document.getElementById('venue-owner-facebook') || {}).value.trim() || '',
        website: (document.getElementById('venue-owner-website') || {}).value.trim() || '',
        email: (document.getElementById('venue-owner-email') || {}).value.trim() || ''
      },
      plan: (claimAsOwner && isUserPro) ? 'pro' : 'free',
      claimAsOwner: claimAsOwner
    };
    try {
      await window.VenueDB.saveVenue(place.placeId, payload);
      if (window.showNotification) {
        var msg = claimAsOwner
          ? 'Jogadores que buscam sua modalidade poderão encontrar você.'
          : 'Obrigado por contribuir! Se você é o proprietário, marque a opção de proprietário na próxima edição.';
        var title = claimAsOwner ? 'Local reivindicado ✅' : 'Local cadastrado 🙌';
        window.showNotification(title, msg, 'success');
      }
      window._venueOwnerCancel();
      window._loadMyVenuesList();
    } catch (e) {
      if (String(e.message).indexOf('venue-já-reivindicado') !== -1) {
        if (window.showNotification) window.showNotification('Este local já tem um proprietário formal.', 'Escreva para scoreplace.app@gmail.com se você é o verdadeiro dono.', 'error');
      } else {
        console.error(e);
        if (window.showNotification) window.showNotification('Erro ao salvar local.', String(e.message || e), 'error');
      }
    }
  };

  window._loadMyVenuesList = async function() {
    var box = document.getElementById('venue-owner-list');
    if (!box || !window.VenueDB) return;
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) { box.innerHTML = ''; return; }
    var list = await window.VenueDB.loadMyVenues(cu.uid);
    if (list.length === 0) { box.innerHTML = ''; return; }
    var html = '<div style="font-size:0.78rem;color:var(--text-muted);margin:8px 0 4px 0;">Meus locais reivindicados</div>';
    list.forEach(function(v) {
      var sportsText = (v.sports && v.sports.length) ? v.sports.join(', ') : 'sem modalidades';
      var courts = v.courtCount ? (v.courtCount + ' quadra' + (v.courtCount === 1 ? '' : 's')) : '';
      var price = v.priceRange || '';
      var meta = [sportsText, courts, price].filter(Boolean).join(' · ');
      var proBadge = v.plan === 'pro'
        ? '<span style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:0.6rem;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px;">PRO</span>'
        : '';
      var upgradeBtn = v.plan !== 'pro'
        ? '<button class="btn btn-sm" onclick="window._venueOwnerUpgrade(\'' + _safe(v.placeId) + '\')" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;font-size:0.7rem;padding:4px 10px;font-weight:700;" title="Destacar este local">🚀 Pro</button>'
        : '';
      var viewStats = v.viewCount
        ? ' · ' + v.viewCount + ' visualiza' + (v.viewCount === 1 ? 'ção' : 'ções')
        : '';
      // Escape apenas uma vez — deserialize pra URL seguro + onclick seguro.
      var safePid = _safe(v.placeId);
      var urlSafePid = encodeURIComponent(v.placeId);
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-darker);border:1px solid ' + (v.plan === 'pro' ? 'rgba(99,102,241,0.4)' : 'var(--border-color)') + ';border-radius:10px;margin-bottom:6px;flex-wrap:wrap;' + (v.plan === 'pro' ? 'box-shadow:0 0 12px rgba(99,102,241,0.25);' : '') + '">' +
        '<div style="flex:1;min-width:150px;">' +
          '<div style="font-weight:600;color:var(--text-bright);font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(v.name) + proBadge + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(meta) + _safe(viewStats) + '</div>' +
        '</div>' +
        // Novo: "Ver" abre a modal pública. Útil pro dono conferir como os
        // usuários veem o venue antes de compartilhar o link.
        '<button class="btn btn-sm" onclick="window.location.hash=\'#venues/' + urlSafePid + '\'" style="background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.35);color:#38bdf8;font-size:0.7rem;padding:4px 8px;font-weight:600;" title="Ver como os usuários veem">👁️ Ver</button>' +
        upgradeBtn +
        '<button class="btn btn-sm btn-secondary" onclick="window._venueOwnerEditExisting(\'' + safePid + '\')" style="font-size:0.7rem;padding:4px 8px;">Editar</button>' +
        '<button class="btn btn-sm" onclick="window._venueOwnerRelease(\'' + safePid + '\')" style="background:transparent;color:var(--danger-color);border:1px solid var(--danger-color);font-size:0.7rem;padding:4px 8px;" title="Liberar (não é mais dono)">✕</button>' +
      '</div>';
    });
    box.innerHTML = html;
  };

  window._venueOwnerEditExisting = async function(placeId) {
    var v = await window.VenueDB.loadVenue(placeId);
    if (!v) return;
    _renderForm({
      placeId: v.placeId, name: v.name, address: v.address, city: v.city, lat: v.lat, lon: v.lon
    }, { existing: v });
    var form = document.getElementById('venue-owner-form-wrap');
    if (form) form.scrollIntoView({ block: 'center' });
  };

  // Pro upgrade — v0.14.69 interim: queues an interest email and shows the
  // owner what Pro unlocks. A full Stripe checkout for venue-level Pro needs
  // a matching Cloud Function + Stripe Price ID, which lives outside the
  // client and is deferred until the first interested proprietor surfaces.
  window._venueOwnerUpgrade = function(placeId) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || typeof window.showConfirmDialog !== 'function') return;
    var msg = '<b>Plano Pro do local (R$49/mês)</b><br><br>' +
      '• Destaque no topo da busca em <code>#venues</code><br>' +
      '• Badge PRO visível + marker com cor diferenciada no mapa<br>' +
      '• Painel de analytics (visualizações, presenças, torneios)<br>' +
      '• Fotos ilimitadas (em breve)<br>' +
      '• Prioridade em filtros de cidade/modalidade<br><br>' +
      'Checkout Stripe chega em breve. Clique "Tenho interesse" para nos avisar — entramos em contato para ativar manualmente neste alpha.';
    window.showConfirmDialog(
      '🚀 Promover local para Pro',
      msg,
      async function() {
        if (window.FirestoreDB && typeof window.FirestoreDB.queueEmail === 'function') {
          await window.FirestoreDB.queueEmail(
            'scoreplace.app@gmail.com',
            'Interesse em Pro para venue — ' + (cu.displayName || cu.email),
            '<p>Proprietário: ' + (cu.displayName || '') + ' (' + (cu.email || '') + ')</p>' +
            '<p>Venue placeId: ' + placeId + '</p>' +
            '<p>Versão: ' + (window.SCOREPLACE_VERSION || '?') + '</p>'
          );
        }
        if (window.showNotification) window.showNotification('Interesse registrado!', 'Entraremos em contato em até 24h pelo e-mail do seu perfil.', 'success');
      },
      null,
      { confirmText: 'Tenho interesse', cancelText: 'Fechar', type: 'info' }
    );
  };

  window._venueOwnerRelease = function(placeId) {
    if (typeof window.showConfirmDialog !== 'function') return;
    window.showConfirmDialog(
      'Liberar este local?',
      'O local continuará existindo, mas você não será mais o dono. Outro usuário poderá reivindicar.',
      function() {
        window.VenueDB.releaseVenue(placeId).then(function(ok) {
          if (ok) {
            if (window.showNotification) window.showNotification('Local liberado.', '', 'info');
            window._loadMyVenuesList();
          }
        });
      }, null, { confirmText: 'Liberar', cancelText: 'Cancelar', type: 'warning' }
    );
  };
})();
