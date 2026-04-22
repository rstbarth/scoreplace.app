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

  // Common sports offered — checkbox list with the same canonical names
  // the rest of the app uses.
  // Modalidades suportadas — alinhadas com create-tournament.js. Não
  // incluímos Futsal/Vôlei/Basquete ainda (features subjacentes só
  // cobrem modalidades de raquete por enquanto).
  var SPORTS = ['Beach Tennis', 'Pickleball', 'Tênis', 'Tênis de Mesa', 'Padel'];

  function _safe(s) { return window._safeHtml ? window._safeHtml(s) : String(s || ''); }

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
      var googleHours = '';
      if (place.regularOpeningHours && Array.isArray(place.regularOpeningHours.weekdayDescriptions)) {
        googleHours = place.regularOpeningHours.weekdayDescriptions.join(' · ');
      }
      // Mapeia priceLevel do Google (FREE/INEXPENSIVE/MODERATE/EXPENSIVE/VERY_EXPENSIVE)
      // → nossa escala $/$$/$$$.
      var googlePriceRange = '';
      var pl = place.priceLevel;
      if (pl === 'PRICE_LEVEL_INEXPENSIVE' || pl === 'INEXPENSIVE' || pl === 1) googlePriceRange = '$';
      else if (pl === 'PRICE_LEVEL_MODERATE' || pl === 'MODERATE' || pl === 2) googlePriceRange = '$$';
      else if (pl === 'PRICE_LEVEL_EXPENSIVE' || pl === 'EXPENSIVE' || pl === 3 || pl === 'PRICE_LEVEL_VERY_EXPENSIVE' || pl === 4) googlePriceRange = '$$$';
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
      // Banner quando estamos editando registro existente (de terceiro).
      var alreadyCommunity = existing && !existing.ownerUid && existing.createdByName;
      // Sugestões do Google usadas apenas como DEFAULT quando o venue
      // ainda não tem o campo preenchido. Não sobrescreve dados manuais.
      var ex = existing ? Object.assign({}, existing) : {};
      if (!ex.contact) ex.contact = {};
      if (!ex.contact.phone && googlePhone) ex.contact.phone = googlePhone;
      if (!ex.website && googleWebsite) ex.website = googleWebsite;
      if (!ex.hours && googleHours) ex.hours = googleHours;
      if (!ex.priceRange && googlePriceRange) ex.priceRange = googlePriceRange;
      _renderForm({
        placeId: window.VenueDB.venueKey(pid, name),
        name: name, address: addr, city: city, lat: lat, lon: lon
      }, {
        existing: existing ? ex : null,
        googlePrefill: (existing ? false : (!!(googlePhone || googleWebsite || googleHours || googlePriceRange))),
        googlePrefillData: existing ? null : {
          contact: { phone: googlePhone },
          website: googleWebsite,
          hours: googleHours,
          priceRange: googlePriceRange
        },
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
    // Quando é venue NOVO e o Google forneceu campos, usamos como default.
    var ex = opts.existing || (opts.googlePrefillData || {});
    if (opts.googlePrefillData && !opts.existing) {
      // merge contact subdocument
      if (opts.googlePrefillData.contact && !ex.contact) ex.contact = opts.googlePrefillData.contact;
    }
    var sportsChecked = Array.isArray(ex.sports) ? ex.sports : [];
    var sportsHtml = SPORTS.map(function(s) {
      var checked = sportsChecked.indexOf(s) !== -1 ? 'checked' : '';
      return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;margin-right:10px;color:var(--text-bright);cursor:pointer;"><input type="checkbox" data-sport="' + _safe(s) + '" ' + checked + '> ' + _safe(s) + '</label>';
    }).join('');
    var cu = window.AppStore && window.AppStore.currentUser;
    var imOwner = cu && opts.existing && opts.existing.ownerUid === cu.uid;
    var titleLabel;
    if (imOwner) titleLabel = '✏️ Editar meu local';
    else if (opts.existing) titleLabel = '✏️ Editar local cadastrado por ' + _safe(opts.creatorName || 'outro usuário');
    else titleLabel = '💾 Cadastrar local novo';

    var collabBanner = (opts.collaborativeBanner && !imOwner)
      ? '<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:0.76rem;color:var(--text-main);">🤝 Este local já foi cadastrado por <b>' + _safe(opts.creatorName || '') + '</b>. Você pode completar ou corrigir as informações colaborativamente até o proprietário assumir.</div>'
      : '';
    var googleBanner = (opts.googlePrefill && !opts.existing)
      ? '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:0.76rem;color:var(--text-main);">📍 Informações pré-preenchidas do Google (horário, preço, telefone). Edite o que for necessário antes de salvar.</div>'
      : '';

    wrap.innerHTML =
      '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-top:6px;">' +
        '<div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;margin-bottom:6px;">' + titleLabel + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-bright);margin-bottom:4px;">' + _safe(place.name) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">' + _safe(place.address || '') + '</div>' +
        collabBanner +
        googleBanner +
        '<div style="margin-bottom:10px;">' +
          '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">Modalidades oferecidas</div>' +
          '<div id="venue-owner-sports" style="display:flex;flex-wrap:wrap;gap:4px 8px;">' + sportsHtml + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">Nº de quadras' +
            '<input type="number" id="venue-owner-court-count" min="0" max="99" value="' + _safe(ex.courtCount || '') + '" placeholder="Ex: 4" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">Faixa de preço' +
            '<select id="venue-owner-price" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
              '<option value="">—</option>' +
              '<option value="$"' + (ex.priceRange === '$' ? ' selected' : '') + '>$ (até R$40/h)</option>' +
              '<option value="$$"' + (ex.priceRange === '$$' ? ' selected' : '') + '>$$ (R$40–80/h)</option>' +
              '<option value="$$$"' + (ex.priceRange === '$$$' ? ' selected' : '') + '>$$$ (R$80+/h)</option>' +
            '</select>' +
          '</label>' +
        '</div>' +
        '<label style="display:block;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">Horário (texto livre)' +
          '<input type="text" id="venue-owner-hours" value="' + _safe(ex.hours || '') + '" placeholder="Ex: Seg-Sex 7h-23h, Sáb-Dom 8h-22h" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
        '</label>' +
        '<label style="display:block;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">💰 Valores para aluguel' +
          '<textarea id="venue-owner-pricelist" rows="3" placeholder="Ex: Beach Tennis R$80/h · Padel R$120/h · Locação quadra toda R$300" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);resize:vertical;font-family:inherit;">' + _safe(ex.priceList || '') + '</textarea>' +
        '</label>' +
        '<label style="display:block;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">📝 Texto promocional' +
          '<textarea id="venue-owner-desc" rows="4" placeholder="Descreva seu local. Ex: Clube fundado em 1985 com 6 quadras de saibro cobertas, iluminação profissional, estacionamento gratuito, vestiário completo com chuveiros quentes. Aulas com professores certificados, aluguel de raquetes, sede social, bar..." style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);resize:vertical;font-family:inherit;">' + _safe(ex.description || '') + '</textarea>' +
        '</label>' +
        '<label style="display:block;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">📷 Fotos do local (URLs, uma por linha — Instagram, imgur, Drive público)' +
          '<textarea id="venue-owner-photos" rows="2" placeholder="https://instagram.com/p/xxxxx&#10;https://i.imgur.com/yyyyy.jpg" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);resize:vertical;font-family:inherit;font-size:0.78rem;">' + _safe(Array.isArray(ex.photos) ? ex.photos.join('\n') : (ex.photos || '')) + '</textarea>' +
        '</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">📞 Telefone' +
            '<input type="tel" id="venue-owner-phone" value="' + _safe((ex.contact && ex.contact.phone) || '') + '" placeholder="(11) 9xxxx-xxxx" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">💬 WhatsApp' +
            '<input type="tel" id="venue-owner-whatsapp" value="' + _safe((ex.contact && ex.contact.whatsapp) || '') + '" placeholder="(11) 9xxxx-xxxx" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">📷 Instagram' +
            '<input type="text" id="venue-owner-insta" value="' + _safe((ex.contact && ex.contact.instagram) || '') + '" placeholder="@seuperfil" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">📘 Facebook' +
            '<input type="text" id="venue-owner-facebook" value="' + _safe((ex.contact && ex.contact.facebook) || '') + '" placeholder="facebook.com/seuperfil" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
        '</div>' +
        '<label style="display:block;font-size:0.72rem;color:var(--text-muted);margin-bottom:12px;">✉️ E-mail de contato' +
          '<input type="email" id="venue-owner-email" value="' + _safe((ex.contact && ex.contact.email) || '') + '" placeholder="contato@..." style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
        '</label>' +
        // Checkbox de reivindicação — só aparece quando ainda não há dono
        // OU quando o dono atual sou eu. Se alguém já reivindicou, o form
        // nem é aberto (bloqueado upstream em _selectPlace).
        (function() {
          var cu = window.AppStore && window.AppStore.currentUser;
          var imOwner = cu && ex.ownerUid === cu.uid;
          var orphan = !ex.ownerUid;
          if (!imOwner && !orphan) return '';
          var checked = imOwner ? 'checked' : '';
          var label = imOwner
            ? 'Você reivindicou este local como proprietário'
            : 'Sou o proprietário deste local';
          return '<label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);border-radius:10px;margin-bottom:12px;cursor:pointer;font-size:0.82rem;color:var(--text-bright);">' +
            '<input type="checkbox" id="venue-owner-claim" ' + checked + '>' +
            '<span>🏢 ' + label + ' <span style="color:var(--text-muted);font-weight:400;">— adiciona a tag "Informações oficiais" no local</span></span>' +
          '</label>';
        })() +
        '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="window._venueOwnerCancel()">Cancelar</button>' +
          '<button type="button" class="btn btn-primary btn-sm" onclick=\'window._spinButton(this, "Salvando..."); window._venueOwnerSubmit(' + JSON.stringify(place).replace(/'/g, '&#39;') + ')\'>' + (opts.existing ? '💾 Salvar alterações' : '💾 Cadastrar local') + '</button>' +
        '</div>' +
      '</div>';
  }

  window._venueOwnerCancel = function() {
    var wrap = document.getElementById('venue-owner-form-wrap');
    if (wrap) wrap.innerHTML = '';
    var search = document.getElementById('venue-owner-search');
    if (search) search.value = '';
  };

  window._venueOwnerSubmit = async function(place) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return;
    var sports = [];
    document.querySelectorAll('#venue-owner-sports input[type=checkbox]').forEach(function(cb) {
      if (cb.checked) sports.push(cb.getAttribute('data-sport'));
    });
    // User's personal Pro plan is inherited as the venue's plan on claim/edit.
    // Lets a Pro user's venues rank in the "Pro first" sort without a separate
    // venue-level subscription (B5b will add that as a direct upgrade path).
    var isUserPro = (typeof window._isPro === 'function' && window._isPro()) ||
                    (cu.plan === 'pro' && (!cu.planExpiresAt || new Date(cu.planExpiresAt) > new Date()));
    // Fotos: textarea com URLs, uma por linha. Normaliza para array.
    var photosRaw = (document.getElementById('venue-owner-photos') || {}).value || '';
    var photos = photosRaw.split(/\r?\n/).map(function(s) { return s.trim(); }).filter(Boolean).slice(0, 10);
    var priceList = (document.getElementById('venue-owner-pricelist') || {}).value.trim();
    var facebook = (document.getElementById('venue-owner-facebook') || {}).value.trim();
    var claimBox = document.getElementById('venue-owner-claim');
    var claimAsOwner = !!(claimBox && claimBox.checked);
    var payload = {
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      city: place.city || '',
      lat: place.lat,
      lon: place.lon,
      sports: sports,
      photos: photos,
      priceList: priceList,
      courtCount: parseInt(document.getElementById('venue-owner-court-count').value, 10) || null,
      priceRange: document.getElementById('venue-owner-price').value || null,
      hours: document.getElementById('venue-owner-hours').value.trim(),
      description: document.getElementById('venue-owner-desc').value.trim(),
      contact: {
        phone: document.getElementById('venue-owner-phone').value.trim(),
        whatsapp: document.getElementById('venue-owner-whatsapp').value.trim(),
        instagram: document.getElementById('venue-owner-insta').value.trim(),
        facebook: facebook,
        email: document.getElementById('venue-owner-email').value.trim()
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
