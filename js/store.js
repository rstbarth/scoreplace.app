window.SCOREPLACE_VERSION = '0.12.60-alpha';

// ─── Auto-update: check if a newer version is deployed and force reload ────
// Runs on EVERY page load (1s delay). Fetches store.js bypassing all caches.
// If remote version differs, nukes SW caches, unregisters old SW, and reloads.
(function() {
  setTimeout(function() {
    fetch('/js/store.js?_t=' + Date.now(), { cache: 'no-store' }).then(function(r) {
      if (!r.ok) throw new Error('fetch failed');
      return r.text();
    }).then(function(txt) {
      var m = txt.match(/SCOREPLACE_VERSION\s*=\s*'([^']+)'/);
      if (m && m[1] && m[1] !== window.SCOREPLACE_VERSION) {
        console.log('[AutoUpdate] New version:', m[1], '(running:', window.SCOREPLACE_VERSION + '). Updating...');
        // 1. Nuke all SW caches
        var p1 = ('caches' in window) ? caches.keys().then(function(keys) {
          return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }) : Promise.resolve();
        // 2. Unregister all service workers
        var p2 = ('serviceWorker' in navigator) ? navigator.serviceWorker.getRegistrations().then(function(regs) {
          return Promise.all(regs.map(function(r) { return r.unregister(); }));
        }) : Promise.resolve();
        Promise.all([p1, p2]).then(function() {
          window.location.reload();
        });
      }
    }).catch(function() {});
  }, 1000);
})();

// ─── Live countdown ticker ─────────────────────────────────────────────────
// Updates all elements with data-countdown-target every second
window._formatCountdown = function(diff) {
  if (diff <= 0) return '0s';
  var d = Math.floor(diff / 86400000);
  var h = Math.floor((diff % 86400000) / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  var s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm ' + s + 's';
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
};
setInterval(function() {
  var now = Date.now();
  var els = document.querySelectorAll('[data-countdown-target]');
  els.forEach(function(el) {
    var target = parseInt(el.getAttribute('data-countdown-target'));
    if (isNaN(target)) return;
    var diff = target - now;
    el.textContent = diff > 0 ? window._formatCountdown(diff) : 'Agora!';
  });
  var els2 = document.querySelectorAll('[data-elapsed-since]');
  els2.forEach(function(el) {
    var since = parseInt(el.getAttribute('data-elapsed-since'));
    if (isNaN(since)) return;
    var diff = now - since;
    el.textContent = diff > 0 ? window._formatCountdown(diff) : '0s';
  });
}, 1000);

// ─── Soft refresh: re-render current view without disrupting UX ────────────
// Called by real-time Firestore listener when remote data changes.
// Preserves: scroll position, open modals, focus state, form inputs.
window._softRefreshView = function() {
  // 0. If bracket just re-rendered locally, skip to avoid double-render + scroll jump
  if (window._suppressSoftRefresh) return;

  // 1. If any modal is open or user is typing, defer — retry in 500ms
  var openModal = document.querySelector('.modal-overlay.active') ||
                  document.getElementById('qr-modal-overlay') ||
                  document.getElementById('player-stats-overlay') ||
                  document.querySelector('.tv-overlay');
  var active = document.activeElement;
  var isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
  if (openModal || isTyping) {
    clearTimeout(window._pendingSoftRefresh);
    window._pendingSoftRefresh = setTimeout(function() { window._softRefreshView(); }, 500);
    return;
  }

  // 2. Debounce: don't re-render more than once per 800ms
  var now = Date.now();
  if (window._lastSoftRefresh && (now - window._lastSoftRefresh) < 800) {
    clearTimeout(window._pendingSoftRefresh);
    window._pendingSoftRefresh = setTimeout(function() { window._softRefreshView(); }, 800);
    return;
  }
  window._lastSoftRefresh = now;

  // 3. Save scroll position
  var scrollY = window.scrollY || window.pageYOffset || 0;

  // 4. Set soft-refresh flag so router skips scroll-to-top and fade animation
  window._isSoftRefresh = true;

  // 5. Re-render current view via router
  if (typeof initRouter === 'function') initRouter();

  // 6. Restore scroll position after render
  requestAnimationFrame(function() {
    window.scrollTo({ top: scrollY, behavior: 'instant' });
    window._isSoftRefresh = false;
  });
};

// ─── Topbar progressive compaction ─────────────────────────────────────────
// Progressive hiding order (shrinking):
//   1. Abbreviate "Organizador" → "Org."
//   2. Hide user name
//   3. Hide "Notificações" label
//   4. Hide "Explorar" label
//   5. Hide "Início" label
//   6. Hamburger (if still doesn't fit)
// Reverse order when growing.
window._checkTopbarWrap = function() {
  var topbar = document.querySelector('.topbar');
  var menu = document.querySelector('.topbar-menu');
  if (!topbar || !menu) return;
  var logo = topbar.querySelector('.page-title');
  if (!logo) return;

  // Progressive hiding steps (classes on menu)
  var steps = ['hide-viewlabel', 'hide-username', 'hide-notif', 'hide-explorar', 'hide-inicio'];

  function _setViewModeLabel(abbreviated) {
    var vmBtn = document.getElementById('view-mode-selector');
    if (vmBtn && window.AppStore) {
      var isOrg = window.AppStore.viewMode === 'organizer';
      var icon = isOrg ? '👁️' : '👤';
      var label = isOrg ? (abbreviated ? 'Org.' : 'Organizador') : (abbreviated ? 'Part.' : 'Participante');
      vmBtn.innerHTML = icon + ' <span style="font-weight:600;">' + label + '</span>';
    }
  }

  // Skip if ≤767px — CSS handles hamburger via media query
  if (window.innerWidth <= 767) {
    for (var i = 0; i < steps.length; i++) menu.classList.remove(steps[i]);
    menu.classList.remove('topbar-compact');
    topbar.classList.remove('topbar-hamburger');
    _setViewModeLabel(true);
    return;
  }

  // Helper: force reflow then check if content exceeds topbar bounds
  function doesntFit() {
    void topbar.offsetHeight;
    var lastChild = menu.lastElementChild;
    if (!lastChild) return false;
    var topbarRight = topbar.getBoundingClientRect().right;
    var contentRight = lastChild.getBoundingClientRect().right;
    return contentRight > topbarRight + 2;
  }

  // Reset all states
  for (var j = 0; j < steps.length; j++) menu.classList.remove(steps[j]);
  menu.classList.remove('topbar-compact');
  topbar.classList.remove('topbar-hamburger');
  menu.classList.remove('open');
  _setViewModeLabel(false);

  // Progressive: try each step until it fits
  if (!doesntFit()) return;

  // Step 1: Abbreviate view mode label
  _setViewModeLabel(true);
  menu.classList.add('hide-viewlabel');
  if (!doesntFit()) return;

  // Step 2: Hide user name
  menu.classList.add('hide-username');
  if (!doesntFit()) return;

  // Step 3: Hide "Notificações" label
  menu.classList.add('hide-notif');
  if (!doesntFit()) return;

  // Step 4: Hide "Explorar" label
  menu.classList.add('hide-explorar');
  if (!doesntFit()) return;

  // Step 5: Hide "Início" label
  menu.classList.add('hide-inicio');
  if (!doesntFit()) return;

  // Step 6: Hamburger — nothing else to hide
  topbar.classList.add('topbar-hamburger');
};
(function() {
  var _wrapTimer;
  window.addEventListener('resize', function() {
    clearTimeout(_wrapTimer);
    _wrapTimer = setTimeout(window._checkTopbarWrap, 60);
    // Close hamburger dropdown on resize (layout may change)
    window._closeHamburger();
  });
  window.addEventListener('load', function() { setTimeout(window._checkTopbarWrap, 300); });
})();

// ═══════════════════════════════════════════════════════════════════════════
// HAMBURGER DROPDOWN — OUTSIDE topbar stacking context
// ═══════════════════════════════════════════════════════════════════════════
// ARCHITECTURE (DO NOT CHANGE):
//   #hamburger-dropdown is a SIBLING of <header class="topbar">, NOT a child.
//   It has its own stacking context: z-index 102 > back-header 101 > topbar 100.
//   When open, JS pushes .sticky-back-header (Voltar) down below the dropdown.
//   Both are visible and clickable simultaneously.
//
// RULES:
//   1. DO NOT move the dropdown inside the topbar — breaks Voltar.
//   2. DO NOT change z-index values — update style.css vars + tests first.
//   3. DO NOT use display:none on .sticky-back-header — user needs Voltar.
//   4. DO NOT raise topbar z-index above back-header — blocks Voltar clicks.
//   5. See tests.html "Z-Index Hierarchy" suite for automated guards.
// ═══════════════════════════════════════════════════════════════════════════
window._toggleHamburger = function(btn) {
  var dd = document.getElementById('hamburger-dropdown');
  if (!dd) return;
  var isOpen = dd.classList.contains('open');
  if (isOpen) {
    window._closeHamburger();
    return;
  }
  // Populate dropdown with cloned nav content from .topbar-menu
  var menu = document.querySelector('.topbar-menu');
  if (!menu) return;
  dd.innerHTML = '';
  // Clone each child group (nav, actions, profile)
  var children = menu.children;
  for (var i = 0; i < children.length; i++) {
    var clone = children[i].cloneNode(true);
    dd.appendChild(clone);
  }
  dd.classList.add('open');
  document.body.classList.add('hamburger-open');
  if (btn) btn.setAttribute('aria-expanded', 'true');

  // Push back-header (Voltar) down so it appears below the dropdown
  window._adjustBackHeaderForHamburger();

  // Close on click outside — remove first to prevent accumulation on rapid open
  document.removeEventListener('click', window._hamburgerOutsideClick);
  setTimeout(function() {
    document.addEventListener('click', window._hamburgerOutsideClick);
  }, 10);
};

window._closeHamburger = function() {
  var dd = document.getElementById('hamburger-dropdown');
  if (dd) {
    dd.classList.remove('open');
    dd.innerHTML = '';
  }
  document.body.classList.remove('hamburger-open');
  var btn = document.querySelector('.hamburger-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', window._hamburgerOutsideClick);
  // Restore back-header to default position
  window._adjustBackHeaderForHamburger();
};

// Push .sticky-back-header down when hamburger is open, restore when closed.
// The dropdown is position:relative in the document flow, so it takes space.
// But back-header is position:fixed, so we must manually adjust its top.
window._adjustBackHeaderForHamburger = function() {
  var backHeader = document.querySelector('.sticky-back-header');
  if (!backHeader) return;
  var dd = document.getElementById('hamburger-dropdown');
  if (dd && dd.classList.contains('open')) {
    // Use actual bottom of dropdown as reference (accounts for all padding/margins)
    var ddRect = dd.getBoundingClientRect();
    backHeader.style.top = Math.ceil(ddRect.bottom) + 'px';
  } else {
    backHeader.style.top = '60px';
  }
};

window._hamburgerOutsideClick = function(e) {
  var dd = document.getElementById('hamburger-dropdown');
  var btn = document.querySelector('.hamburger-btn');
  if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
    window._closeHamburger();
  }
};

// Keep spacer in sync with .sticky-back-header actual height.
// The header is position:fixed so its siblings need an explicit margin-top.
// On narrow screens the header can wrap to 2+ rows, so a fixed 50px isn't enough.
window._syncBackHeaderSpacer = function() {
  var topbar = document.querySelector('.topbar');
  var topbarH = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 60;
  var headers = document.querySelectorAll('.sticky-back-header');
  headers.forEach(function(h) {
    // Anchor the fixed back-header directly below the topbar. The topbar
    // can wrap on narrow screens (e.g. 90+ px tall); leaving the header at
    // top:60px lets the topbar paint over the Voltar button — `position:sticky`
    // beats lower z-index when they overlap. Setting top dynamically keeps
    // them strictly vertical-stacked.
    h.style.top = topbarH + 'px';
    var next = h.nextElementSibling;
    if (!next) return;
    var rect = h.getBoundingClientRect();
    var px = Math.ceil(rect.height) + 8;
    next.style.marginTop = px + 'px';
  });
};

// Observe DOM for added/removed sticky headers and their size changes
(function() {
  if (window._backHeaderObserverInstalled) return;
  window._backHeaderObserverInstalled = true;

  var resizeObs = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(function() {
      window._syncBackHeaderSpacer();
    });
  }

  function observeExistingHeaders() {
    if (!resizeObs) return;
    document.querySelectorAll('.sticky-back-header').forEach(function(h) {
      try { resizeObs.observe(h); } catch(e) {}
    });
    // Also observe the topbar: when it wraps (narrow viewport, login state
    // change, filter pills added) its height changes and we need to push
    // the back-header down to avoid overlap.
    var topbar = document.querySelector('.topbar');
    if (topbar) { try { resizeObs.observe(topbar); } catch(e) {} }
  }

  function initDomObserver() {
    var vc = document.getElementById('view-container');
    if (!vc) { setTimeout(initDomObserver, 100); return; }
    var mo = new MutationObserver(function() {
      observeExistingHeaders();
      window._syncBackHeaderSpacer();
    });
    mo.observe(vc, { childList: true, subtree: true });
    observeExistingHeaders();
    window._syncBackHeaderSpacer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDomObserver);
  } else {
    initDomObserver();
  }

  window.addEventListener('resize', function() {
    window._syncBackHeaderSpacer();
  });
})();

// ─── Constantes globais ─────────────────────────────────────────────────────
window.SCOREPLACE_URL = 'https://scoreplace.app';
window._avatarUrl = function(name, size) {
    var seed = encodeURIComponent(name || '?');
    var s = size || 40;
    return 'https://api.dicebear.com/9.x/initials/svg?seed=' + seed + '&backgroundColor=6366f1&textColor=ffffff&fontSize=42&size=' + s;
};
window._qrCodeUrl = function(data, size, darkMode) {
    var s = size || 280;
    var bg = darkMode !== false ? '1a1e2e' : 'ffffff';
    var fg = darkMode !== false ? 'ffffff' : '1a1e2e';
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + s + 'x' + s + '&data=' + encodeURIComponent(data) + '&bgcolor=' + bg + '&color=' + fg + '&margin=10';
};
window._tournamentUrl = function(tournamentId) {
    return window.SCOREPLACE_URL + '/#tournaments/' + tournamentId;
};
window._whatsappShareUrl = function(text) {
    return 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
};

// ─── Beta Testers (acesso Pro completo) ─────────────────────────────────────
// Emails nesta lista recebem Pro automaticamente sem precisar de Stripe/Firestore
window.BETA_TESTERS = [
  'rstbarth@gmail.com'
];

// ─── Plano Pro ──────────────────────────────────────────────────────────────
// Verifica se o usuário logado tem plano Pro ativo
window._isPro = function() {
  var user = window.AppStore && window.AppStore.currentUser;
  if (!user) return false;
  // Beta testers sempre têm Pro
  if (user.email && window.BETA_TESTERS.indexOf(user.email.toLowerCase()) !== -1) return true;
  if (user.plan !== 'pro') return false;
  // Checa expiração
  if (user.planExpiresAt) {
    var exp = new Date(user.planExpiresAt);
    if (exp < new Date()) return false;
  }
  return true;
};

// Limites do plano Free
window.PLAN_LIMITS = {
  FREE_MAX_TOURNAMENTS: 3,
  FREE_MAX_PARTICIPANTS: 32
};

// Verifica se pode criar mais torneios (Free: 3 ativos)
window._canCreateTournament = function() {
  if (window._isPro()) return true;
  var user = window.AppStore && window.AppStore.currentUser;
  if (!user) return false;
  var active = window.AppStore.tournaments.filter(function(t) {
    return t.organizerEmail === user.email && t.status !== 'finished' && t.status !== 'cancelled';
  });
  return active.length < window.PLAN_LIMITS.FREE_MAX_TOURNAMENTS;
};

// Verifica se pode adicionar mais participantes (Free: 32 por torneio)
window._canAddParticipant = function(tournament) {
  if (window._isPro()) return true;
  var pList = Array.isArray(tournament.participants) ? tournament.participants : [];
  return pList.length < window.PLAN_LIMITS.FREE_MAX_PARTICIPANTS;
};

// Abre a página/modal de upgrade Pro
window._showUpgradeModal = function(reason) {
  var reasonText = '';
  if (reason === 'tournaments') reasonText = 'Você atingiu o limite de 3 torneios ativos no plano gratuito.';
  else if (reason === 'participants') reasonText = 'Você atingiu o limite de 32 participantes no plano gratuito.';
  else if (reason === 'logo') reasonText = 'Upload de logo personalizada é exclusivo do plano Pro.';
  else if (reason === 'tv') reasonText = 'Modo TV sem marca é exclusivo do plano Pro.';
  else reasonText = 'Desbloqueie todo o potencial do scoreplace.app.';

  var modal = document.getElementById('modal-upgrade');
  if (modal) { modal.style.display = 'flex'; return; }

  modal = document.createElement('div');
  modal.id = 'modal-upgrade';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:100000;';
  modal.innerHTML =
    '<div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:20px;max-width:380px;width:92%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:1.2rem;text-align:center;flex-shrink:0;">' +
        '<div style="font-size:2rem;margin-bottom:0.3rem;">🚀</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:#fff;">scoreplace Pro</div>' +
        '<div style="font-size:0.82rem;color:rgba(255,255,255,0.8);margin-top:4px;">R$19,90/mês</div>' +
      '</div>' +
      '<div style="padding:1.2rem;overflow-y:auto;flex:1;">' +
        '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;margin-bottom:1rem;">' + reasonText + '</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.2rem;">' +
          '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.1rem;">♾️</span><span style="color:var(--text-color);font-size:0.85rem;">Torneios ilimitados</span></div>' +
          '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.1rem;">👥</span><span style="color:var(--text-color);font-size:0.85rem;">Participantes ilimitados</span></div>' +
          '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.1rem;">🎨</span><span style="color:var(--text-color);font-size:0.85rem;">Upload de logo personalizada</span></div>' +
          '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.1rem;">📺</span><span style="color:var(--text-color);font-size:0.85rem;">Modo TV sem marca scoreplace</span></div>' +
          '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.1rem;">⚡</span><span style="color:var(--text-color);font-size:0.85rem;">Suporte prioritário</span></div>' +
        '</div>' +
        '<button onclick="window._startProCheckout()" style="width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;margin-bottom:8px;transition:transform 0.2s;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'none\'">Assinar Pro — R$19,90/mês</button>' +
        '<button onclick="document.getElementById(\'modal-upgrade\').remove()" style="width:100%;padding:8px;background:transparent;color:var(--text-muted);border:1px solid var(--border-color);border-radius:12px;font-size:0.82rem;cursor:pointer;">Agora não</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
};

// Inicia o checkout do Stripe para assinatura Pro
window._startProCheckout = async function() {
  var user = window.AppStore && window.AppStore.currentUser;
  if (!user || !user.uid) {
    if (typeof showNotification === 'function') showNotification(window._t('store.loginRequired'), window._t('store.loginRequiredMsg'), 'warning');
    return;
  }
  try {
    var btn = document.querySelector('#modal-upgrade button');
    if (btn) { btn.textContent = window._t('store.processing'); btn.disabled = true; }

    var resp = await fetch('https://southamerica-east1-scoreplace-app.cloudfunctions.net/createCheckoutSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        priceId: window._STRIPE_PRICE_ID || 'price_1TGzhZIhfnsIPruFsz4plxaX'
      })
    });
    var data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Erro ao criar sessão de pagamento');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    if (typeof showNotification === 'function') showNotification(window._t('auth.error'), window._t('store.paymentError'), 'error');
    var btn2 = document.querySelector('#modal-upgrade button');
    if (btn2) { btn2.textContent = window._t('store.subscribePro'); btn2.disabled = false; }
  }
};

// Mostra modal de apoio voluntário via PIX
window._showSupportModal = function() {
  var existing = document.getElementById('modal-support-pix');
  if (existing) { existing.style.display = 'flex'; return; }

  var pixKey = '51590996000173';
  var modal = document.createElement('div');
  modal.id = 'modal-support-pix';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:100000;';
  modal.innerHTML =
    '<div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:20px;max-width:360px;width:92%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="background:linear-gradient(135deg,#10b981,#059669);padding:1rem;text-align:center;flex-shrink:0;">' +
        '<div style="font-size:1.8rem;margin-bottom:0.2rem;">💚</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:#fff;">Apoie o scoreplace.app</div>' +
        '<div style="font-size:0.75rem;color:rgba(255,255,255,0.8);margin-top:2px;">Contribuição voluntária — qualquer valor</div>' +
      '</div>' +
      '<div style="padding:1rem;text-align:center;overflow-y:auto;flex:1;">' +
        '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:0.8rem;line-height:1.5;">Sua contribuição mantém o scoreplace.app no ar e financia novas funcionalidades!</p>' +
        '<div style="background:var(--bg-dark);border:1px solid var(--border-color);border-radius:12px;padding:0.8rem;margin-bottom:0.8rem;display:flex;flex-direction:column;align-items:center;">' +
          '<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent('00020126580014br.gov.bcb.pix0136' + pixKey + '5204000053039865802BR5925SCOREPLACE6009SAO PAULO62070503***6304') + '" alt="QR Code PIX" style="width:160px;height:160px;border-radius:8px;background:#fff;padding:6px;margin-bottom:0.6rem;" />' +
          '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">Chave PIX (CNPJ):</div>' +
          '<div style="display:flex;align-items:center;gap:6px;justify-content:center;flex-wrap:wrap;">' +
            '<code id="pix-key-text" style="background:rgba(255,255,255,0.08);padding:6px 10px;border-radius:8px;font-size:0.85rem;color:var(--text-color);letter-spacing:0.3px;">' + pixKey + '</code>' +
            '<button onclick="navigator.clipboard.writeText(\'' + pixKey + '\').then(function(){var b=event.target;b.textContent=\'Copiado!\';setTimeout(function(){b.textContent=\'Copiar\'},2000)})" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap;">Copiar</button>' +
          '</div>' +
        '</div>' +
        '<p style="color:var(--text-muted);font-size:0.72rem;margin-bottom:0.8rem;">Escaneie o QR code ou copie a chave PIX no app do seu banco.</p>' +
        '<button onclick="document.getElementById(\'modal-support-pix\').remove()" style="width:100%;padding:8px;background:transparent;color:var(--text-muted);border:1px solid var(--border-color);border-radius:12px;font-size:0.82rem;cursor:pointer;">Fechar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
};

// Global HTML escape utility (XSS protection)
window._safeHtml = function(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// Auto-close tournaments whose registration deadline has passed
// Runs once on app load — checks all tournaments and closes expired ones
window._autoCloseExpiredEnrollments = function() {
  if (!window.AppStore || !window.AppStore.tournaments) return;
  var now = new Date();
  window.AppStore.tournaments.forEach(function(t) {
    if (!t.registrationLimit) return;
    if (t.status === 'closed' || t.status === 'finished') return;
    // Skip if draw already done
    var hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) ||
                  (Array.isArray(t.rounds) && t.rounds.length > 0) ||
                  (Array.isArray(t.groups) && t.groups.length > 0);
    if (hasDraw) return;
    // Skip Liga with open enrollment
    var isLiga = t.format && (t.format === 'Liga' || t.format === 'Ranking');
    if (isLiga && t.ligaOpenEnrollment) return;
    // Check if deadline passed
    if (new Date(t.registrationLimit) < now) {
      t.status = 'closed';
      // Only the organizer should persist this to avoid permission issues
      var cu = window.AppStore.currentUser;
      if (cu && (t.organizerEmail === cu.email || (Array.isArray(t.coHosts) && t.coHosts.some(function(ch) { return ch.email === cu.email && ch.status === 'active'; })))) {
        if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
          window.FirestoreDB.saveTournament({ id: t.id, status: 'closed' }).catch(function() {});
        }
      }
    }
  });
};

// ─── Temas: dark → light → sunset → ocean ──────────────────────────────────
window._themeOrder = ['dark', 'light', 'sunset', 'ocean'];
window._themeIcons = { dark: '🌙', light: '☀️', sunset: '🌅', ocean: '🌊' };
window._themeNames = { dark: 'Noturno', light: 'Claro', sunset: 'Pôr do Sol', ocean: 'Oceano' };

window._toggleTheme = function() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'dark';
  var order = window._themeOrder;
  var idx = order.indexOf(current);
  var next = order[(idx + 1) % order.length];
  html.setAttribute('data-theme', next);
  try { localStorage.setItem('scoreplace_theme', next); } catch (e) {}
  window._applyThemeIcon(next);
  // Sync theme to Firestore so other devices pick it up
  try {
    var cu = window.AppStore && window.AppStore.currentUser;
    var uid = cu && (cu.uid || cu.email);
    if (uid && window.FirestoreDB && window.FirestoreDB.saveUserProfile) {
      window.FirestoreDB.saveUserProfile(uid, { theme: next }).catch(function() {});
    }
  } catch (e) {}
};

window._applyThemeIcon = function(theme) {
  // The hamburger dropdown clones topbar nodes, producing a second element
  // with id="theme-toggle-btn". getElementById returns only the first, so we
  // use querySelectorAll to update every live copy.
  var btns = document.querySelectorAll('#theme-toggle-btn');
  if (!btns || !btns.length) return;
  var icon = window._themeIcons[theme] || '🌙';
  var name = window._themeNames[theme] || theme;
  for (var i = 0; i < btns.length; i++) {
    btns[i].textContent = icon;
    btns[i].title = 'Tema: ' + name + ' (clique para trocar)';
  }
};

// Apply saved theme on load
(function() {
  try {
    var saved = localStorage.getItem('scoreplace_theme');
    var valid = window._themeOrder;
    if (saved && valid.indexOf(saved) !== -1) {
      document.documentElement.setAttribute('data-theme', saved);
      var _applyIcon = function() { window._applyThemeIcon(saved); };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _applyIcon);
      } else {
        _applyIcon();
      }
    }
  } catch (e) {}
})();

// ─── Favoritos (localStorage) ────────────────────────────────────────────────
window._getFavorites = function() {
  try {
    var key = 'scoreplace_favorites';
    var cu = window.AppStore && window.AppStore.currentUser;
    if (cu && cu.email) key += '_' + cu.email;
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};

window._isFavorite = function(tId) {
  var favs = window._getFavorites();
  return favs.indexOf(String(tId)) !== -1;
};

window._toggleFavorite = function(tId, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  var key = 'scoreplace_favorites';
  var cu = window.AppStore && window.AppStore.currentUser;
  if (cu && cu.email) key += '_' + cu.email;
  var favs = window._getFavorites();
  var id = String(tId);
  var idx = favs.indexOf(id);
  if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
  try { localStorage.setItem(key, JSON.stringify(favs)); } catch (e) {}
  // Update star icons on the page
  var stars = document.querySelectorAll('[data-fav-id="' + id + '"]');
  stars.forEach(function(el) {
    el.textContent = (idx === -1) ? '★' : '☆';
    el.title = (idx === -1) ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    el.style.color = (idx === -1) ? '#fbbf24' : 'rgba(255,255,255,0.4)';
  });
};

// ========================================
// scoreplace.app — AppStore (Firestore Backend)
// ========================================
// All tournament data persists in Cloud Firestore.
// Local cache in localStorage for instant first-paint.
// Real-time listener (onSnapshot) keeps data fresh without refresh.

window.AppStore = {
  currentUser: null,
  viewMode: 'organizer',
  tournaments: [],
  _invitedTournamentIds: [],  // Track tournament IDs from invite links
  _deletedTournamentIds: (function() { try { var d = localStorage.getItem('scoreplace_deleted_ids'); return d ? JSON.parse(d) : []; } catch(e) { return []; } })(),
  _syncDebounce: null,
  _loading: false,
  _realtimeUnsubscribe: null,  // Real-time listener unsubscribe function
  _cacheKey: 'scoreplace_tournaments_cache',

  // --- Local Cache ---
  _saveToCache() {
    try {
      var data = { ts: Date.now(), tournaments: this.tournaments };
      localStorage.setItem(this._cacheKey, JSON.stringify(data));
    } catch(e) { /* quota exceeded or private browsing */ }
  },

  _loadFromCache() {
    try {
      var raw = localStorage.getItem(this._cacheKey);
      if (!raw) return false;
      var data = JSON.parse(raw);
      // Cache valid for 24h
      if (data && data.tournaments && (Date.now() - data.ts) < 86400000) {
        var deletedIds = this._deletedTournamentIds || [];
        if (deletedIds.length > 0) {
          this.tournaments = data.tournaments.filter(function(t) {
            return deletedIds.indexOf(String(t.id)) === -1;
          });
        } else {
          this.tournaments = data.tournaments;
        }
        // Loaded from local cache
        return true;
      }
    } catch(e) { console.warn('[AppStore] Erro ao carregar cache local:', e.message); }
    return false;
  },

  // Sync: saves ALL organizer tournaments to Firestore IMMEDIATELY
  // No more debounce — every mutation must persist to prevent data loss across devices
  // IMPORTANT: skipParticipants prevents overwriting enrollments from other users
  sync() {
    var store = this;
    if (!window.FirestoreDB || !window.FirestoreDB.db || !store.currentUser) return;
    store.tournaments.forEach(function(t) {
      if (t.organizerEmail === store.currentUser.email ||
          (Array.isArray(t.coHosts) && t.coHosts.some(function(ch) { return ch.email === store.currentUser.email && ch.status === 'active'; }))) {
        window.FirestoreDB.saveTournament(t, { skipParticipants: true }).catch(function(err) {
          console.warn('Sync error:', err);
        });
      }
    });
    store._saveToCache();
  },

  // SyncImmediate: saves a specific tournament to Firestore RIGHT NOW (no debounce)
  // Use for critical operations: draw, match results, status changes, enrollments
  async syncImmediate(tournamentId) {
    if (!window.FirestoreDB || !window.FirestoreDB.db) {
      console.error('syncImmediate: Firestore not available');
      return false;
    }
    var t = this.tournaments.find(function(tour) {
      return String(tour.id) === String(tournamentId);
    });
    if (!t) {
      console.error('syncImmediate: Tournament not found:', tournamentId);
      return false;
    }
    try {
      t.updatedAt = new Date().toISOString();
      await window.FirestoreDB.saveTournament(t);
      this._saveToCache();
      // Tournament saved to Firestore
      return true;
    } catch (err) {
      console.error('syncImmediate: FAILED to save tournament ' + tournamentId, err);
      if (typeof showNotification === 'function') {
        showNotification(window._t('store.saveError'), window._t('store.saveErrorMsg'), 'error');
      }
      return false;
    }
  },

  // Start real-time listener — auto-updates tournaments on any Firestore change
  startRealtimeListener() {
    if (this._realtimeUnsubscribe) return; // Already listening
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;

    var store = this;
    var isFirstSnapshot = true;
    this._realtimeUnsubscribe = window.FirestoreDB.db.collection('tournaments')
      .onSnapshot(function(snap) {
        var tournaments = [];
        var deletedIds = store._deletedTournamentIds || [];
        snap.forEach(function(doc) {
          var data = doc.data();
          // Filter out recently deleted tournaments to prevent ghost re-appearance
          if (deletedIds.indexOf(String(data.id)) === -1) {
            tournaments.push(data);
          }
        });
        store.tournaments = tournaments;
        store._saveToCache();
        store._loading = false;

        // First snapshot = initial load → full render needed
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          if (typeof initRouter === 'function') initRouter();
          // Auto-fix stale names after tournaments are loaded (no currentUser check needed)
          if (typeof window._autoFixStaleNames === 'function') {
            window._autoFixStaleNames().catch(function(e) { console.warn('Auto-fix stale names error:', e); });
          }
          // Auto-close tournaments whose registration deadline has passed
          window._autoCloseExpiredEnrollments();
          return;
        }

        // Subsequent snapshots = remote changes → soft refresh (preserve UX)
        window._softRefreshView();
      }, function(err) {
        console.warn('Real-time listener error:', err);
        // Fallback to one-time load
        store.loadFromFirestore();
      });
  },

  stopRealtimeListener() {
    if (this._realtimeUnsubscribe) {
      this._realtimeUnsubscribe();
      this._realtimeUnsubscribe = null;
    }
    if (this._notifUnsubscribe) {
      this._notifUnsubscribe();
      this._notifUnsubscribe = null;
    }
    if (this._profileUnsubscribe) {
      this._profileUnsubscribe();
      this._profileUnsubscribe = null;
    }
  },

  // Real-time listener for user notifications — fires on new/updated notifications
  startNotificationsListener() {
    if (this._notifUnsubscribe) return; // Already listening
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    var cu = this.currentUser;
    if (!cu || !cu.uid) return;

    var isFirst = true;
    this._notifUnsubscribe = window.FirestoreDB.db
      .collection('users').doc(cu.uid).collection('notifications')
      .orderBy('createdAt', 'desc').limit(20)
      .onSnapshot(function(snap) {
        // Skip the initial snapshot (already loaded via polling)
        if (isFirst) { isFirst = false; return; }

        // New notification arrived — update badge immediately
        if (typeof window._updateNotificationBadge === 'function') {
          window._updateNotificationBadge();
        }

        // Show toast for each new notification
        snap.docChanges().forEach(function(change) {
          if (change.type === 'added') {
            var d = change.doc.data();
            if (d && !d.read && d.message && typeof showNotification === 'function') {
              showNotification('🔔 ' + (d.type === 'cohost_invite' ? window._t('store.cohostInviteTitle') : window._t('store.notifTitle')), d.message, 'info');
            }
          }
        });

        // If user is on notifications page, refresh it
        if (window.location.hash === '#notifications') {
          var vc = document.getElementById('view-container');
          if (vc && typeof renderNotifications === 'function') renderNotifications(vc);
        }
      }, function(err) {
        console.warn('Notifications listener error:', err);
      });
  },

  // Real-time listener for user profile — syncs theme and prefs across devices
  startProfileListener() {
    if (this._profileUnsubscribe) return; // Already listening
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    var cu = this.currentUser;
    if (!cu || !cu.uid) return;

    var store = this;
    var isFirst = true;
    this._profileUnsubscribe = window.FirestoreDB.db
      .collection('users').doc(cu.uid)
      .onSnapshot(function(doc) {
        // Skip the initial snapshot (profile already loaded)
        if (isFirst) { isFirst = false; return; }
        if (!doc.exists) return;
        var data = doc.data();
        // Sync theme in real-time across all logged-in devices
        if (data.theme && window._themeOrder.indexOf(data.theme) !== -1) {
          var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          if (data.theme !== currentTheme) {
            document.documentElement.setAttribute('data-theme', data.theme);
            try { localStorage.setItem('scoreplace_theme', data.theme); } catch (e) {}
            window._applyThemeIcon(data.theme);
            if (store.currentUser) store.currentUser.theme = data.theme;
          }
        }
        // Sync active casual room — navigate other devices to the same match
        if (data.activeCasualRoom) {
          var currentHash = window.location.hash || '';
          var alreadyOnCasual = currentHash.indexOf('#casual/') === 0 || document.getElementById('casual-match-overlay') || document.getElementById('live-scoring-overlay');
          if (!alreadyOnCasual) {
            window.location.hash = '#casual/' + data.activeCasualRoom;
          }
        }
      }, function(err) {
        console.warn('Profile listener error:', err);
      });
  },

  // Load all tournaments from Firestore (one-time, fallback)
  async loadFromFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    this._loading = true;
    try {
      var tournaments = await window.FirestoreDB.loadAllTournaments();
      var deletedIds = this._deletedTournamentIds || [];
      if (deletedIds.length > 0) {
        tournaments = tournaments.filter(function(t) {
          return deletedIds.indexOf(String(t.id)) === -1;
        });
      }
      this.tournaments = tournaments;
      this._saveToCache();
      // Tournaments loaded from Firestore
    } catch (e) {
      console.error('Erro ao carregar torneios:', e);
      this.tournaments = [];
    }
    this._loading = false;
  },

  // Load user profile from Firestore
  async loadUserProfile(uid) {
    if (!window.FirestoreDB || !window.FirestoreDB.db || !uid) return null;
    try {
      var profile = await window.FirestoreDB.loadUserProfile(uid);
      if (profile && this.currentUser) {
        // Merge saved profile data into currentUser
        if (profile.gender) this.currentUser.gender = profile.gender;
        if (profile.preferredSports) this.currentUser.preferredSports = profile.preferredSports;
        if (profile.defaultCategory) this.currentUser.defaultCategory = profile.defaultCategory;
        if (profile.displayName) this.currentUser.displayName = profile.displayName;
        if (profile.birthDate) this.currentUser.birthDate = profile.birthDate;
        if (profile.age) this.currentUser.age = profile.age;
        if (profile.city) this.currentUser.city = profile.city;
        if (profile.state) this.currentUser.state = profile.state;
        if (profile.country) this.currentUser.country = profile.country;
        if (profile.locale) this.currentUser.locale = profile.locale;
        if (profile.phone) this.currentUser.phone = profile.phone;
        if (profile.phoneCountry) this.currentUser.phoneCountry = profile.phoneCountry;
        if (profile.photoURL) this.currentUser.photoURL = profile.photoURL;
        // Boolean prefs — use !== undefined to allow false values
        if (profile.acceptFriendRequests !== undefined) this.currentUser.acceptFriendRequests = profile.acceptFriendRequests;
        if (profile.notifyPlatform !== undefined) this.currentUser.notifyPlatform = profile.notifyPlatform;
        if (profile.notifyEmail !== undefined) this.currentUser.notifyEmail = profile.notifyEmail;
        if (profile.notifyWhatsApp !== undefined) this.currentUser.notifyWhatsApp = profile.notifyWhatsApp;
        if (profile.notifyLevel) this.currentUser.notifyLevel = profile.notifyLevel;
        if (profile.preferredCeps !== undefined) this.currentUser.preferredCeps = profile.preferredCeps;
        if (Array.isArray(profile.preferredLocations)) this.currentUser.preferredLocations = profile.preferredLocations;
        if (Array.isArray(profile.friends)) this.currentUser.friends = profile.friends;
        if (Array.isArray(profile.friendRequestsSent)) this.currentUser.friendRequestsSent = profile.friendRequestsSent;
        if (Array.isArray(profile.friendRequestsReceived)) this.currentUser.friendRequestsReceived = profile.friendRequestsReceived;
        // Theme sync across devices
        if (profile.theme && window._themeOrder.indexOf(profile.theme) !== -1) {
          this.currentUser.theme = profile.theme;
          // Apply remote theme if different from local
          var localTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          if (profile.theme !== localTheme) {
            document.documentElement.setAttribute('data-theme', profile.theme);
            try { localStorage.setItem('scoreplace_theme', profile.theme); } catch (e) {}
            window._applyThemeIcon(profile.theme);
          }
        }
        // Plan fields
        if (profile.plan) this.currentUser.plan = profile.plan;
        if (profile.planExpiresAt) this.currentUser.planExpiresAt = profile.planExpiresAt;
        if (profile.stripeCustomerId) this.currentUser.stripeCustomerId = profile.stripeCustomerId;
        if (profile.stripeSubscriptionId) this.currentUser.stripeSubscriptionId = profile.stripeSubscriptionId;
      }
      return profile;
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
      return null;
    }
  },

  // Save user profile to Firestore
  async saveUserProfileToFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db || !this.currentUser) return;
    var user = this.currentUser;
    var uid = user.uid || user.email;
    await window.FirestoreDB.saveUserProfile(uid, {
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      gender: user.gender || '',
      birthDate: user.birthDate || '',
      age: user.age || '',
      city: user.city || '',
      state: user.state || '',
      country: user.country || '',
      locale: user.locale || '',
      phone: user.phone || '',
      phoneCountry: user.phoneCountry || '55',
      preferredSports: user.preferredSports || '',
      defaultCategory: user.defaultCategory || '',
      acceptFriendRequests: user.acceptFriendRequests !== false,
      notifyPlatform: user.notifyPlatform !== false,
      notifyEmail: user.notifyEmail !== false,
      notifyWhatsApp: user.notifyWhatsApp !== false,
      notifyLevel: user.notifyLevel || 'todas',
      preferredCeps: user.preferredCeps || '',
      preferredLocations: user.preferredLocations || [],
      friends: user.friends || [],
      friendRequestsSent: user.friendRequestsSent || [],
      friendRequestsReceived: user.friendRequestsReceived || [],
      updatedAt: new Date().toISOString()
    });
  },

  toggleViewMode() {
    this.viewMode = this.viewMode === 'organizer' ? 'participant' : 'organizer';
    var btn = document.getElementById('view-mode-selector');
    if (btn) {
      var _mob = window.innerWidth <= 767;
      btn.innerHTML = this.viewMode === 'organizer'
        ? '👁️ <span style="font-weight:600;">' + (_mob ? 'Org.' : 'Organizador') + '</span>'
        : '👤 <span style="font-weight:600;">' + (_mob ? 'Part.' : 'Participante') + '</span>';
    }
    if (typeof initRouter === 'function') initRouter();
  },

  isOrganizer(tournament) {
    if (this.viewMode === 'participant') return false;
    if (!this.currentUser) return false;
    var email = this.currentUser.email;
    if (tournament.organizerEmail === email) return true;
    if (Array.isArray(tournament.coHosts)) {
      return tournament.coHosts.some(function(ch) { return ch.email === email && ch.status === 'active'; });
    }
    return false;
  },

  isCreator(tournament) {
    if (!this.currentUser) return false;
    var creator = tournament.creatorEmail || tournament.organizerEmail;
    return creator === this.currentUser.email;
  },

  getVisibleTournaments() {
    var invitedIds = this._invitedTournamentIds || [];
    return this.tournaments.filter(function(t) {
      if (t.isPublic) return true;
      // Tournament accessed via invite link is always visible
      if (invitedIds.indexOf(String(t.id)) !== -1) return true;
      if (!window.AppStore.currentUser) return false;
      var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
      var isPart = pList.some(function(p) {
        var str = typeof p === 'string' ? p : (p.email || p.displayName || p.name);
        return str && str === window.AppStore.currentUser.email;
      });
      return t.organizerEmail === window.AppStore.currentUser.email || isPart;
    });
  },

  getMyOrganized() {
    if (!this.currentUser || this.viewMode === 'participant') return [];
    var email = this.currentUser.email;
    return this.tournaments.filter(function(t) { return t.organizerEmail === email; });
  },

  getMyParticipations() {
    if (!this.currentUser) return [];
    var email = this.currentUser.email;
    return this.tournaments.filter(function(t) {
      var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
      return pList.some(function(p) {
        var str = typeof p === 'string' ? p : (p.email || p.displayName || p.name);
        return str && str === email;
      });
    });
  },

  addTournament(data) {
    var id = data.id || ('tour_' + Date.now());
    var tourData = Object.assign({
      id: id,
      createdAt: new Date().toISOString(),
      participants: [],
      standbyParticipants: [],
      history: [{
        date: new Date().toISOString(),
        message: 'Torneio Criado'
      }]
    }, data);
    // Ensure id is set
    tourData.id = id;
    this.tournaments.push(tourData);
    // Save to Firestore immediately
    if (window.FirestoreDB && window.FirestoreDB.db) {
      window.FirestoreDB.saveTournament(tourData).catch(function(err) {
        console.error('Erro ao salvar novo torneio:', err);
      });
    }
    return id;
  },

  logAction(tournamentId, message) {
    var t = this.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (t) {
      if (!t.history) t.history = [];
      t.history.push({
        date: new Date().toISOString(),
        message: message
      });
      // Note: does NOT call sync() here — the caller is responsible for saving.
      // This avoids double Firestore writes since every logAction is followed by a sync().
    }
  },

  hasOrganizedTournaments() {
    if (!this.currentUser) return false;
    var email = this.currentUser.email;
    return this.tournaments.some(function(t) { return t.organizerEmail === email; });
  }
};

// ─── Tournament Templates (Firestore + localStorage fallback) ─────────────
window._templateCache = null;

window._getTemplates = function() {
  return window._templateCache || [];
};

window._loadTemplates = async function() {
  var u = window.AppStore && window.AppStore.currentUser;
  if (!u || !u.uid) { window._templateCache = []; return []; }
  try {
    var templates = await window.FirestoreDB.getTemplates(u.uid);
    window._templateCache = templates;
    // Migrate localStorage templates to Firestore (one-time)
    var lsKey = 'scoreplace_templates_' + u.email;
    var lsRaw = localStorage.getItem(lsKey);
    if (lsRaw) {
      try {
        var lsTemplates = JSON.parse(lsRaw);
        if (Array.isArray(lsTemplates) && lsTemplates.length > 0) {
          for (var i = 0; i < lsTemplates.length; i++) {
            if (!lsTemplates[i].createdAt) lsTemplates[i].createdAt = new Date().toISOString();
            await window.FirestoreDB.saveTemplate(u.uid, lsTemplates[i]);
          }
          localStorage.removeItem(lsKey);
          templates = await window.FirestoreDB.getTemplates(u.uid);
          window._templateCache = templates;
        }
      } catch(e) { localStorage.removeItem(lsKey); }
    }
    return templates;
  } catch(e) {
    console.warn('[Templates] Firestore load failed, using localStorage:', e);
    // Fallback to localStorage
    var lsKey2 = 'scoreplace_templates_' + (u.email || '');
    try {
      var raw = localStorage.getItem(lsKey2);
      window._templateCache = raw ? JSON.parse(raw) : [];
    } catch(e2) { window._templateCache = []; }
    return window._templateCache;
  }
};

window._saveTemplate = async function(template) {
  var u = window.AppStore && window.AppStore.currentUser;
  if (!u || !u.uid) return 'error';
  // Ensure cache is loaded
  if (window._templateCache === null) await window._loadTemplates();
  var templates = window._getTemplates();
  var isPro = u && u.plan === 'pro';
  if (!isPro && templates.length >= 10) return 'limit';
  template.createdAt = new Date().toISOString();
  try {
    var id = await window.FirestoreDB.saveTemplate(u.uid, template);
    if (id) {
      template._id = id;
      window._templateCache = window._templateCache || [];
      window._templateCache.unshift(template);
      return 'ok';
    }
    return 'error';
  } catch(e) {
    console.warn('[Templates] Firestore save failed, using localStorage:', e);
    // Fallback: save to localStorage
    template._id = 'tpl_' + Date.now();
    window._templateCache = window._templateCache || [];
    window._templateCache.unshift(template);
    var lsKey = 'scoreplace_templates_' + (u.email || '');
    try { localStorage.setItem(lsKey, JSON.stringify(window._templateCache)); } catch(e2) {}
    return 'ok';
  }
};

window._deleteTemplate = async function(templateId) {
  var u = window.AppStore && window.AppStore.currentUser;
  if (!u || !u.uid || !templateId) return;
  try { await window.FirestoreDB.deleteTemplate(u.uid, templateId); } catch(e) {}
  window._templateCache = (window._templateCache || []).filter(function(t) { return t._id !== templateId; });
};

window._applyTemplate = function(index) {
  var templates = window._getTemplates();
  return (index >= 0 && index < templates.length) ? templates[index] : null;
};

// ─── Crown helper: adds crown SVG next to organizer names ──────────────────
window._CROWN_MINI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(251,191,36,0.85)" style="flex-shrink:0;vertical-align:middle;margin-left:2px;"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>';

window._isOrgName = function(name, tournament) {
  if (!name || !tournament) return false;
  var orgName = tournament.organizerName || '';
  var orgEmail = tournament.organizerEmail || '';
  if (name === orgName || name === orgEmail) return true;
  if (Array.isArray(tournament.coHosts)) {
    return tournament.coHosts.some(function(ch) {
      return ch.status === 'active' && (ch.displayName === name || ch.email === name);
    });
  }
  return false;
};

window._nameWithCrown = function(name, tournament) {
  var safe = window._safeHtml(name);
  if (window._isOrgName(name, tournament)) {
    return safe + ' ' + window._CROWN_MINI;
  }
  return safe;
};

// ─── Competitors helper: filter out non-competing organizers from participants ─
// Returns an array of participants excluding the organizer/co-hosts who didn't
// explicitly enroll (selfEnrolled flag). Works for both old and new tournaments.
window._getCompetitors = function(t) {
  if (!t || !t.participants) return [];
  var parts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
  var orgEmail = (t.organizerEmail || '').toLowerCase();
  var orgName = (t.organizerName || '').toLowerCase();
  var coHostEmails = {};
  if (Array.isArray(t.coHosts)) {
    t.coHosts.forEach(function(ch) { if (ch.email) coHostEmails[ch.email.toLowerCase()] = true; });
  }
  return parts.filter(function(p) {
    if (p && p.selfEnrolled) return true; // explicitly enrolled — always keep
    var email = '', name = '';
    if (typeof p === 'string') {
      name = p.toLowerCase();
    } else if (p) {
      email = (p.email || '').toLowerCase();
      name = (p.displayName || p.name || '').toLowerCase();
    }
    // Exclude organizer who didn't self-enroll
    if (orgEmail && email && email === orgEmail) return false;
    if (!email && orgName && name && name === orgName) return false;
    // Exclude co-hosts who didn't self-enroll
    if (email && coHostEmails[email]) return false;
    return true;
  });
};

// Global Helper para controle do botão ViewMode na Topbar
window.updateViewModeVisibility = function() {
  var viewModeContainer = document.getElementById('view-mode-container');
  if (!viewModeContainer) return;

  if (window.AppStore.currentUser && window.AppStore.hasOrganizedTournaments()) {
    viewModeContainer.style.setProperty('display', 'flex', 'important');
  } else {
    viewModeContainer.style.setProperty('display', 'none', 'important');
  }
};
