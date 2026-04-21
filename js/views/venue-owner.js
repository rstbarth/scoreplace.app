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
  var SPORTS = ['Beach Tennis', 'Pickleball', 'Tênis', 'Tênis de Mesa', 'Padel', 'Futsal', 'Vôlei', 'Basquete'];

  function _safe(s) { return window._safeHtml ? window._safeHtml(s) : String(s || ''); }

  // Ensure Places library is loaded lazily — the profile modal opens before
  // the user necessarily needs it.
  async function ensurePlaces() {
    if (_placesLibReady) return;
    if (!window.google || !window.google.maps || !window.google.maps.importLibrary) return;
    try { await google.maps.importLibrary('places'); _placesLibReady = true; } catch (e) {}
  }

  // Inject the owner section if not already present.
  window._renderVenueOwnerSection = function(container) {
    if (!container) return;
    container.innerHTML =
      '<div style="margin-top:1rem;">' +
        '<label class="form-label" style="font-size:0.8rem;font-weight:600;display:flex;align-items:center;gap:6px;">🏢 Sou dono de um local para jogar</label>' +
        '<p style="font-size:0.7rem;color:var(--text-muted);margin:0 0 8px 0;">Reivindique um local que você administra para aparecer na busca de jogadores. Grátis, sem cartão.</p>' +
        '<div style="position:relative;margin-bottom:8px;">' +
          '<input type="text" id="venue-owner-search" class="form-control" placeholder="Buscar local no Google (clube, arena, quadra)" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:0.85rem;" oninput="window._venueOwnerSearch(this.value)">' +
          '<div id="venue-owner-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:9999;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;margin-top:4px;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);"></div>' +
        '</div>' +
        '<div id="venue-owner-form-wrap"></div>' +
        '<div id="venue-owner-list" style="margin-top:12px;"></div>' +
      '</div>';
    ensurePlaces();
    window._loadMyVenuesList();
  };

  // Places autocomplete — debounce on input.
  var _searchTimer = null;
  window._venueOwnerSearch = function(query) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function() { _doSearch(query); }, 220);
  };
  async function _doSearch(query) {
    var box = document.getElementById('venue-owner-suggestions');
    if (!box) return;
    var q = String(query || '').trim();
    if (q.length < 3) { box.style.display = 'none'; box.innerHTML = ''; return; }
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
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'id'] });
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
      // Clear the search input so it doesn't look stale next to the form.
      var search = document.getElementById('venue-owner-search');
      if (search) search.value = name;

      // If already claimed by someone else, VenueDB.loadVenue shows that.
      var existing = await window.VenueDB.loadVenue(window.VenueDB.venueKey(pid, name));
      var cu = window.AppStore && window.AppStore.currentUser;
      var mine = existing && cu && existing.ownerUid === cu.uid;
      var otherOwner = existing && existing.ownerUid && (!cu || existing.ownerUid !== cu.uid);
      if (otherOwner) {
        _renderForm(null, {
          warning: 'Este local já foi reivindicado por outro usuário. Se você é o verdadeiro dono, escreva para scoreplace.app@gmail.com.'
        });
        return;
      }
      _renderForm({
        placeId: window.VenueDB.venueKey(pid, name),
        name: name, address: addr, city: city, lat: lat, lon: lon
      }, { existing: mine ? existing : null });
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
    var ex = opts.existing || {};
    var sportsChecked = Array.isArray(ex.sports) ? ex.sports : [];
    var sportsHtml = SPORTS.map(function(s) {
      var checked = sportsChecked.indexOf(s) !== -1 ? 'checked' : '';
      return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;margin-right:10px;color:var(--text-bright);cursor:pointer;"><input type="checkbox" data-sport="' + _safe(s) + '" ' + checked + '> ' + _safe(s) + '</label>';
    }).join('');
    var titleLabel = opts.existing ? '✏️ Editar local' : '🏢 Reivindicar local';

    wrap.innerHTML =
      '<div style="background:var(--bg-darker);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-top:6px;">' +
        '<div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;margin-bottom:6px;">' + titleLabel + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-bright);margin-bottom:4px;">' + _safe(place.name) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">' + _safe(place.address || '') + '</div>' +
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
        '<label style="display:block;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">Descrição (opcional)' +
          '<textarea id="venue-owner-desc" rows="2" placeholder="Quadras iluminadas, estacionamento, vestiário..." style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);resize:vertical;">' + _safe(ex.description || '') + '</textarea>' +
        '</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">📞 Telefone' +
            '<input type="tel" id="venue-owner-phone" value="' + _safe((ex.contact && ex.contact.phone) || '') + '" placeholder="(11) 9xxxx-xxxx" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">💬 WhatsApp' +
            '<input type="tel" id="venue-owner-whatsapp" value="' + _safe((ex.contact && ex.contact.whatsapp) || '') + '" placeholder="(11) 9xxxx-xxxx" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">📷 Instagram' +
            '<input type="text" id="venue-owner-insta" value="' + _safe((ex.contact && ex.contact.instagram) || '') + '" placeholder="@seuperfil" style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
          '<label style="font-size:0.72rem;color:var(--text-muted);">✉️ E-mail' +
            '<input type="email" id="venue-owner-email" value="' + _safe((ex.contact && ex.contact.email) || '') + '" placeholder="contato@..." style="display:block;width:100%;margin-top:2px;padding:6px 8px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-bright);">' +
          '</label>' +
        '</div>' +
        '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="window._venueOwnerCancel()">Cancelar</button>' +
          '<button type="button" class="btn btn-primary btn-sm" onclick=\'window._venueOwnerSubmit(' + JSON.stringify(place).replace(/'/g, '&#39;') + ')\'>' + (opts.existing ? 'Salvar alterações' : '✅ Reivindicar local') + '</button>' +
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
    var payload = {
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      city: place.city || '',
      lat: place.lat,
      lon: place.lon,
      sports: sports,
      courtCount: parseInt(document.getElementById('venue-owner-court-count').value, 10) || null,
      priceRange: document.getElementById('venue-owner-price').value || null,
      hours: document.getElementById('venue-owner-hours').value.trim(),
      description: document.getElementById('venue-owner-desc').value.trim(),
      contact: {
        phone: document.getElementById('venue-owner-phone').value.trim(),
        whatsapp: document.getElementById('venue-owner-whatsapp').value.trim(),
        instagram: document.getElementById('venue-owner-insta').value.trim(),
        email: document.getElementById('venue-owner-email').value.trim()
      },
      ownerUid: cu.uid,
      ownerEmail: (cu.email || '').toLowerCase(),
      plan: isUserPro ? 'pro' : 'free'
    };
    try {
      await window.VenueDB.claimVenue(place.placeId, payload);
      if (window.showNotification) window.showNotification('Local reivindicado com sucesso!', 'Jogadores que buscam sua modalidade poderão encontrar você.', 'success');
      window._venueOwnerCancel();
      window._loadMyVenuesList();
    } catch (e) {
      if (String(e.message).indexOf('venue-já-reivindicado') !== -1) {
        if (window.showNotification) window.showNotification('Este local já foi reivindicado por outro usuário.', 'Escreva para scoreplace.app@gmail.com se você é o verdadeiro dono.', 'error');
      } else {
        console.error(e);
        if (window.showNotification) window.showNotification('Erro ao reivindicar local.', String(e.message || e), 'error');
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
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-darker);border:1px solid ' + (v.plan === 'pro' ? 'rgba(99,102,241,0.4)' : 'var(--border-color)') + ';border-radius:10px;margin-bottom:6px;' + (v.plan === 'pro' ? 'box-shadow:0 0 12px rgba(99,102,241,0.25);' : '') + '">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:600;color:var(--text-bright);font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(v.name) + proBadge + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _safe(meta) + _safe(viewStats) + '</div>' +
        '</div>' +
        upgradeBtn +
        '<button class="btn btn-sm btn-secondary" onclick="window._venueOwnerEditExisting(\'' + _safe(v.placeId) + '\')" style="font-size:0.7rem;padding:4px 8px;">Editar</button>' +
        '<button class="btn btn-sm" onclick="window._venueOwnerRelease(\'' + _safe(v.placeId) + '\')" style="background:transparent;color:var(--danger-color);border:1px solid var(--danger-color);font-size:0.7rem;padding:4px 8px;" title="Liberar (não é mais dono)">✕</button>' +
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
