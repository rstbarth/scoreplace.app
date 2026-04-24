window.SCOREPLACE_VERSION = '0.16.11-alpha';

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
                  document.querySelector('.tv-overlay') ||
                  document.getElementById('unified-resolution-panel') ||
                  document.getElementById('groups-config-panel') ||
                  document.getElementById('remainder-resolution-panel') ||
                  document.getElementById('removal-subchoice-panel');
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

  // If triggered from within a high-z overlay (e.g. casual at 100002, support at 100000),
  // raise dropdown above that overlay so the menu is actually visible.
  var highZParent = btn && btn.closest && btn.closest('#casual-match-overlay, #modal-support-pix, #qr-modal-overlay');
  dd.style.zIndex = highZParent ? '200000' : '';

  // Push back-header (Voltar) down so it appears below the dropdown.
  // Double rAF ensures the dropdown has painted before we measure its height.
  window._reflowChrome();
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { window._reflowChrome(); });
  });

  // Close on click outside — remove first to prevent accumulation on rapid open
  document.removeEventListener('click', window._hamburgerOutsideClick);
  setTimeout(function() {
    document.addEventListener('click', window._hamburgerOutsideClick);
  }, 10);
};

window._closeHamburger = function() {
  var dd = document.getElementById('hamburger-dropdown');
  if (dd) {
    dd.style.zIndex = ''; // reset any elevated z-index from overlay context
    dd.classList.remove('open');
    dd.innerHTML = '';
  }
  document.body.classList.remove('hamburger-open');
  var btn = document.querySelector('.hamburger-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', window._hamburgerOutsideClick);
  // Restore back-header to default position
  window._reflowChrome();
};

// ─── UNIFIED BACK HEADER ────────────────────────────────────────────────────
// Canonical emitter for the fixed "Voltar" bar that sits under the topbar.
// ALL views route through this helper — there is exactly one place that
// renders a Voltar button and exactly one click path that handles it.
//
// Architecture:
//   - The button carries `data-back-nav` + `data-back-href` attributes.
//   - A single delegated listener on <body> (installed in _installBackNavDelegate
//     below) handles every Voltar click in the app. This is more robust than
//     inline onclick strings which are fragile to escaping bugs and easy to
//     lose silently when the button is re-parented by CSS tricks.
//   - On click: _dismissAllOverlays() runs, then window.location.hash is set.
//     A programmatic callback override is supported via registry instead of
//     inline JS.
//
// opts:
//   href           — hash to navigate to (default '#dashboard')
//   label          — button text (default 'Voltar')
//   middleHtml     — optional HTML between the button and the right slot
//                    (auto-adds a flex:1 spacer if omitted)
//   rightHtml      — optional HTML after the middle slot
//   belowHtml      — optional second row inside the sticky wrapper
//   extraStyle     — optional inline style on the outer wrapper
//   onClickOverride— optional JS string (legacy) OR function. If a function is
//                    passed, it's registered and invoked by the delegate.
window._backNavCallbacks = window._backNavCallbacks || {};
window._renderBackHeader = function(opts) {
  opts = opts || {};
  var _label = (opts.label == null) ? 'Voltar' : String(opts.label);
  var _href = opts.href || '#dashboard';
  var _safeHrefAttr = String(_href).replace(/"/g, '&quot;');
  var _extraStyle = opts.extraStyle ? (' style="' + opts.extraStyle + '"') : '';
  var _svg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
  var _middle = (opts.middleHtml == null || opts.middleHtml === '')
    ? '<div style="flex:1;"></div>'
    : opts.middleHtml;
  var _right = opts.rightHtml || '';
  var _below = opts.belowHtml || '';
  var _hamSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  var _hamBtn = '<button class="back-hdr-ham" type="button" aria-label="Abrir menu" onclick="typeof window._toggleHamburger===\'function\'&&window._toggleHamburger(this);" style="width:36px;height:36px;border:none;background:transparent;color:var(--text-color);cursor:pointer;border-radius:50%;align-items:center;justify-content:center;flex-shrink:0;">' + _hamSvg + '</button>';

  // Override support: inline JS (legacy string) OR function (registered).
  var _overrideAttr = '';
  if (opts.onClickOverride) {
    if (typeof opts.onClickOverride === 'function') {
      var _cbId = 'back_cb_' + Math.random().toString(36).slice(2, 10);
      window._backNavCallbacks[_cbId] = opts.onClickOverride;
      _overrideAttr = ' data-back-cb="' + _cbId + '"';
    } else {
      // Legacy inline-JS override (kept for backward compat).
      _overrideAttr = ' data-back-inline="' + String(opts.onClickOverride).replace(/"/g, '&quot;') + '"';
    }
  }

  return (
    '<div class="sticky-back-header"' + _extraStyle + '>' +
      '<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;">' +
        '<button class="btn btn-outline btn-sm hover-lift" type="button" ' +
                'data-back-nav="1" data-back-href="' + _safeHrefAttr + '"' + _overrideAttr + ' ' +
                'aria-label="' + _label + '" ' +
                'style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;flex-shrink:0;">' +
          _svg + ' ' + _label +
        '</button>' +
        _middle +
        _right +
        _hamBtn +
      '</div>' +
      _below +
    '</div>'
  );
};

// Single delegated click handler for every Voltar button in the app.
// Installed once at load; survives view re-renders because it lives on <body>.
window._installBackNavDelegate = function() {
  if (window._backNavDelegateInstalled) return;
  window._backNavDelegateInstalled = true;
  var _onBackNav = function(e) {
    // Walk up from target to find [data-back-nav] (button may wrap SVG/text)
    var el = e.target;
    while (el && el !== document.body) {
      if (el.nodeType === 1 && el.getAttribute && el.getAttribute('data-back-nav') === '1') break;
      el = el.parentNode;
    }
    if (!el || el === document.body) return;
    e.preventDefault();
    e.stopPropagation();

    // Dismiss overlays first so no stale full-screen modal masks the target view.
    try { if (typeof window._dismissAllOverlays === 'function') window._dismissAllOverlays(); } catch(err) {}

    // Override path: callback function registered in _backNavCallbacks.
    var cbId = el.getAttribute('data-back-cb');
    if (cbId && typeof window._backNavCallbacks[cbId] === 'function') {
      try { window._backNavCallbacks[cbId](e); } catch(err) { console.warn('[scoreplace-back] cb error', err); }
      return;
    }
    // Override path: legacy inline JS string (Function exec).
    var inline = el.getAttribute('data-back-inline');
    if (inline) {
      try { (new Function(inline))(); } catch(err) { console.warn('[scoreplace-back] inline error', err); }
      return;
    }
    // Default path: navigate to the hash. If we're already there (edge case
    // where caller passed href === current hash), force a re-render by briefly
    // toggling the hash, so the user still gets the expected back behavior.
    var href = el.getAttribute('data-back-href') || '#dashboard';
    if (window.location.hash === href) {
      window.location.hash = '#dashboard';
      if (href !== '#dashboard') {
        setTimeout(function() { window.location.hash = href; }, 0);
      }
    } else {
      window.location.hash = href;
    }
  };
  // Capture-phase so we beat view-local listeners (no one else should also
  // handle a click on a [data-back-nav] element).
  document.body.addEventListener('click', _onBackNav, true);
};
// Install as soon as body exists.
if (document.body) {
  window._installBackNavDelegate();
} else {
  document.addEventListener('DOMContentLoaded', function() { window._installBackNavDelegate(); });
}

// ─── DISMISS ALL OVERLAYS ───────────────────────────────────────────────────
// .sticky-back-header lives at z-index 101, but the app creates 40+ ad-hoc
// overlays at z 9999–999999 (TV mode, set scoring, draw prep, categories,
// host transfer, re-auth, etc). If ANY of them survives a hashchange, it
// masks the Voltar button invisibly. This function rips them ALL down,
// not just a named list: any position:fixed direct child of <body> whose
// computed z-index > 101 and whose bounding box covers most of the viewport
// is treated as a leftover overlay. Safe-list elements (topbar, hamburger,
// back-header, toast notifications, offline banner) are preserved.
// Called by the router on every hashchange and by Voltar's default onclick.
window._dismissAllOverlays = function(opts) {
  opts = opts || {};
  var keep = opts.keep || [];

  // 1. Named overlays (fast path — always remove unless kept).
  var overlayIds = [
    'tv-mode-overlay',
    'set-scoring-overlay',
    'qr-modal-overlay',
    'player-stats-overlay',
    'scan-qr-overlay',
    'scan-qr-room-overlay'
  ];
  overlayIds.forEach(function(id) {
    if (keep.indexOf(id) !== -1) return;
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  // 2. Generic sweep — any fixed-position body child above z 101 that looks
  //    like a full-screen overlay.
  try {
    var kids = document.body ? Array.prototype.slice.call(document.body.children) : [];
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    kids.forEach(function(el) {
      if (!el || !el.parentNode) return;
      if (keep.indexOf(el.id) !== -1) return;
      // Safe-list: elements that must NEVER be swept.
      if (el.classList && (
        el.classList.contains('modal-overlay') ||
        el.classList.contains('topbar') ||
        el.classList.contains('sticky-back-header') ||
        el.classList.contains('hamburger-dropdown') ||
        el.classList.contains('notification-banner') ||
        el.classList.contains('notification-toast') ||
        el.classList.contains('toast-notification') ||
        el.classList.contains('offline-banner')
      )) return;
      if (el.id === 'hamburger-dropdown' || el.id === 'view-container' ||
          el.id === 'skip-link' || el.id === 'aria-live-region' ||
          /^notification/i.test(el.id || '') || /^toast/i.test(el.id || '')) return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
      var cs;
      try { cs = window.getComputedStyle(el); } catch(e) { return; }
      if (!cs) return;
      if (cs.position !== 'fixed') return;
      var z = parseInt(cs.zIndex, 10);
      if (!z || z <= 101) return;
      // Heuristic: treat as full-screen overlay only if it covers >50% of the viewport.
      // Small toasts, floating pills, and dropdowns are left alone.
      var r;
      try { r = el.getBoundingClientRect(); } catch(e) { return; }
      if (!r || r.width < vw * 0.5 || r.height < vh * 0.5) return;
      el.parentNode.removeChild(el);
    });
  } catch(e) {}

  // 3. TV mode locks body scroll + enters fullscreen — undo both.
  try { document.body.style.overflow = ''; } catch(e) {}
  try { document.documentElement.style.overflow = ''; } catch(e) {}
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(function(){});
    }
  } catch(e) {}

  // 4. Standard modal-overlay deactivation.
  try {
    var modals = document.querySelectorAll('.modal-overlay.active');
    for (var i = 0; i < modals.length; i++) {
      if (keep.indexOf(modals[i].id) === -1) modals[i].classList.remove('active');
    }
  } catch(e) {}
};

// ─── UNIFIED CHROME LAYOUT ───────────────────────────────────────────────────
// Single source of truth for the position of topbar + hamburger dropdown +
// back header. Everything else used to compute its own position from stale
// state (dropdown was position:relative and got scrolled off when the user
// scrolled before opening it; back-header tracked that off-screen dropdown).
// Now both the dropdown and the back-header are position:fixed and anchored
// to the measured topbar height, so they stay pinned regardless of scroll.
//
// Layout (top-down): topbar → (if open) dropdown → back-header → content.
window._reflowChrome = function() {
  var topbar = document.querySelector('.topbar');
  var topbarH = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 60;
  var dd = document.getElementById('hamburger-dropdown');
  var ddOpen = dd && dd.classList.contains('open');
  var ddH = 0;

  var backHeaders = document.querySelectorAll('.sticky-back-header');

  // A back-header only "counts" if it is actually visible to the user:
  // either position:fixed on a regular page, or static inside an *active*
  // .modal-overlay. Inactive modals are kept in the DOM (opacity:0 +
  // pointer-events:none, NOT display:none), so their back-headers would
  // otherwise inflate the count and stop the dropdown from pushing content.
  var visibleBackHeaders = [];
  var staticBH = null;
  backHeaders.forEach(function(bh) {
    var overlayAncestor = bh.closest && bh.closest('.modal-overlay');
    if (overlayAncestor && !overlayAncestor.classList.contains('active')) return;
    var _r = bh.getBoundingClientRect();
    if (_r.width === 0 && _r.height === 0) return; // display:none — skip
    visibleBackHeaders.push(bh);
    if (window.getComputedStyle(bh).position !== 'fixed') {
      // For overlays, the dropdown must snap to the back-header's actual
      // bottom edge in the viewport rather than topbarH.
      staticBH = bh;
    }
  });
  var hasBackHeader = visibleBackHeaders.length > 0;

  if (dd) {
    if (staticBH) {
      // Overlay context: snap dropdown immediately below the back-header
      var _bhRect = staticBH.getBoundingClientRect();
      dd.style.top = Math.ceil(_bhRect.bottom) + 'px';
    } else {
      // Regular page: pin dropdown under topbar
      dd.style.top = topbarH + 'px';
    }
    if (ddOpen) ddH = Math.ceil(dd.getBoundingClientRect().height);
  }

  var bhOffset = topbarH + ddH;
  backHeaders.forEach(function(bh) {
    var isFixed = window.getComputedStyle(bh).position === 'fixed';
    if (isFixed) {
      bh.style.top = bhOffset + 'px';
      var next = bh.nextElementSibling;
      if (next) {
        var bhH = Math.ceil(bh.getBoundingClientRect().height);
        // Use !important because overlay CSS uses `margin-top: 0 !important`
        // to suppress the default 50px spacer — our dynamic value has to win.
        next.style.setProperty('margin-top', (ddH + bhH + 8) + 'px', 'important');
      }
    } else {
      var next = bh.nextElementSibling;
      if (next) {
        var mt = ddH > 0 ? (ddH + 8) + 'px' : '0';
        next.style.setProperty('margin-top', mt, 'important');
      }
    }
  });
  var vc = document.getElementById('view-container');
  if (vc) {
    if (!hasBackHeader) {
      vc.style.paddingTop = ddH > 0 ? (ddH + 'px') : '';
    } else if (vc.style.paddingTop) {
      vc.style.paddingTop = '';
    }
  }
};
// Legacy aliases — external callers may reference the old names.
window._adjustBackHeaderForHamburger = window._reflowChrome;

window._hamburgerOutsideClick = function(e) {
  var dd = document.getElementById('hamburger-dropdown');
  var btn = document.querySelector('.hamburger-btn');
  if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
    window._closeHamburger();
  }
};

// Legacy alias — every caller now routes through _reflowChrome.
window._syncBackHeaderSpacer = window._reflowChrome;

// Observe DOM for added/removed sticky headers and their size changes.
// All triggers funnel into _reflowChrome so chrome positioning has exactly
// one source of truth.
(function() {
  if (window._backHeaderObserverInstalled) return;
  window._backHeaderObserverInstalled = true;

  var resizeObs = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(function() {
      window._reflowChrome();
    });
  }

  function observeExistingHeaders() {
    if (!resizeObs) return;
    document.querySelectorAll('.sticky-back-header').forEach(function(h) {
      try { resizeObs.observe(h); } catch(e) {}
    });
    // Also observe the topbar and hamburger dropdown: when their height
    // changes (topbar wraps on narrow viewport, dropdown opens/closes or
    // its content changes) we need to reflow everything below.
    var topbar = document.querySelector('.topbar');
    if (topbar) { try { resizeObs.observe(topbar); } catch(e) {} }
    var dd = document.getElementById('hamburger-dropdown');
    if (dd) { try { resizeObs.observe(dd); } catch(e) {} }
  }

  function initDomObserver() {
    var vc = document.getElementById('view-container');
    if (!vc) { setTimeout(initDomObserver, 100); return; }
    var mo = new MutationObserver(function() {
      observeExistingHeaders();
      window._reflowChrome();
    });
    mo.observe(vc, { childList: true, subtree: true });
    observeExistingHeaders();
    window._reflowChrome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDomObserver);
  } else {
    initDomObserver();
  }

  window.addEventListener('resize', function() {
    window._reflowChrome();
  });
  // Scroll: both dropdown and back-header are position:fixed so they don't
  // move with scroll, but measured heights can change (e.g. dropdown opens
  // mid-scroll and we need to update the back-header offset immediately).
  window.addEventListener('scroll', function() {
    window._reflowChrome();
  }, { passive: true });
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

// Página de apoio voluntário via PIX — renderiza no view-container como página normal
window.renderSupportPage = function(container) {
  var pixKey = '51590996000173';
  var hdr = window._renderBackHeader({
    href: '#dashboard',
    label: 'Voltar',
    middleHtml: '<span style="font-size:0.88rem;font-weight:700;color:var(--text-bright);">💚 Apoie o scoreplace.app</span>'
  });
  container.innerHTML = hdr +
    '<div style="padding:1rem;text-align:center;max-width:400px;margin:0 auto;">' +
      '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:0.8rem;line-height:1.5;">Contribuição voluntária — qualquer valor. Sua contribuição mantém o scoreplace.app no ar e financia novas funcionalidades!</p>' +
      '<div style="background:var(--bg-dark);border:1px solid var(--border-color);border-radius:12px;padding:0.8rem;margin-bottom:0.8rem;display:flex;flex-direction:column;align-items:center;">' +
        '<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent('00020126580014br.gov.bcb.pix0136' + pixKey + '5204000053039865802BR5925SCOREPLACE6009SAO PAULO62070503***6304') + '" alt="QR Code PIX" style="width:160px;height:160px;border-radius:8px;background:#fff;padding:6px;margin-bottom:0.6rem;" />' +
        '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">Chave PIX (CNPJ):</div>' +
        '<div style="display:flex;align-items:center;gap:6px;justify-content:center;flex-wrap:wrap;">' +
          '<code id="pix-key-text" style="background:rgba(255,255,255,0.08);padding:6px 10px;border-radius:8px;font-size:0.85rem;color:var(--text-color);letter-spacing:0.3px;">' + pixKey + '</code>' +
          '<button onclick="navigator.clipboard.writeText(\'' + pixKey + '\').then(function(){var b=event.target;b.textContent=\'Copiado!\';setTimeout(function(){b.textContent=\'Copiar\'},2000)})" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap;">Copiar</button>' +
        '</div>' +
      '</div>' +
      '<p style="color:var(--text-muted);font-size:0.72rem;margin-bottom:0.8rem;">Escaneie o QR code ou copie a chave PIX no app do seu banco.</p>' +
    '</div>';
  if (typeof window._reflowChrome === 'function') window._reflowChrome();
};

// Compat: botões antigos que chamam _showSupportModal redirecionam para a página
window._showSupportModal = function() { window.location.hash = '#support'; };

// Global HTML escape utility (XSS protection)
window._safeHtml = function(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// Replace button content with a spinner to indicate command received (enroll/unenroll etc).
// Caller passes `this` from the onclick. Normally the view re-renders and the button is replaced;
// a safety timeout restores the original content in case the flow is aborted (confirm cancel, etc).
window._spinButton = function(btn, label) {
  if (!btn || btn.getAttribute('data-spinning') === '1') return;
  var original = btn.innerHTML;
  btn.setAttribute('data-spinning', '1');
  btn.disabled = true;
  var txt = label || '';
  btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>' + (txt ? window._safeHtml(txt) : '');
  setTimeout(function() {
    if (btn && btn.getAttribute('data-spinning') === '1' && document.body.contains(btn)) {
      btn.innerHTML = original;
      btn.disabled = false;
      btn.removeAttribute('data-spinning');
    }
  }, 8000);
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
  // Public discovery feed — public open tournaments the user isn't in yet.
  // Populated on demand via loadPublicDiscovery(). Independent of
  // `tournaments` (which is scoped to the user's own).
  publicDiscovery: [],
  _publicDiscoveryCursor: null,
  _publicDiscoveryHasMore: false,
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
  //
  // Scoped to the user's own tournaments via the denormalized `memberEmails[]`
  // field (creator + organizer + active co-hosts + participants). Without a
  // scope, every snapshot downloaded every tournament in the database on
  // every change anywhere — doesn't scale past a handful of users.
  startRealtimeListener(email) {
    if (this._realtimeUnsubscribe) return; // Already listening
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;

    var store = this;
    var isFirstSnapshot = true;
    var coll = window.FirestoreDB.db.collection('tournaments');
    var norm = email ? String(email).trim().toLowerCase() : '';
    var query = norm ? coll.where('memberEmails', 'array-contains', norm) : coll;
    this._realtimeUnsubscribe = query
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
    // Remember the last synced casual room so we only hijack navigation when
    // the value CHANGES — without this, every profile save (e.g. the user
    // editing Locais, nome, tema) re-fires the redirect and yanks them into
    // an old casual match they thought they'd left.
    var lastCasualRoom = null;
    this._profileUnsubscribe = window.FirestoreDB.db
      .collection('users').doc(cu.uid)
      .onSnapshot(function(doc) {
        // First snapshot: aproveitamos para RESUMIR uma partida ao vivo
        // em andamento. Cenário real: o celular cai da mão durante o
        // placar ao vivo, a aba fecha, o user volta — espera cair
        // direto na partida, não na dashboard. Se o perfil tem um
        // activeCasualRoom e o hash atual não aponta para essa sala,
        // navega. Se o user já está em #casual/... (deep link direto
        // ou reload na própria página), deixamos quieto.
        if (isFirst) {
          isFirst = false;
          if (doc.exists) {
            var firstRoom = doc.data().activeCasualRoom || null;
            lastCasualRoom = firstRoom;
            if (firstRoom) {
              var hash = window.location.hash || '';
              var expected = '#casual/' + firstRoom;
              var alreadyInMatch = hash === expected ||
                                   hash.indexOf('#casual/' + firstRoom) === 0;
              // ALSO check for the DOM overlays — without this, clicking
              // "Iniciar" (which removes #casual-match-overlay and opens
              // #live-scoring-overlay) triggers a redirect back to the
              // setup overlay mid-transition, and clicking "Fechar"
              // reopens the match because the profile clear is async
              // and this branch fires before activeCasualRoom=null lands.
              var hasOverlay = !!document.getElementById('casual-match-overlay') ||
                               !!document.getElementById('live-scoring-overlay');
              if (!alreadyInMatch && !hasOverlay) {
                window.location.hash = expected;
              }
            }
          }
          return;
        }
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
        // BUT only when the value transitioned (not on every unrelated save).
        var newRoom = data.activeCasualRoom || null;
        if (newRoom && newRoom !== lastCasualRoom) {
          var currentHash = window.location.hash || '';
          var alreadyOnCasual = currentHash.indexOf('#casual/') === 0 ||
                                document.getElementById('casual-match-overlay') ||
                                document.getElementById('live-scoring-overlay');
          // Suppression: if the user just closed a match (_casualSetupClose
          // or finished live-scoring), Firestore may still deliver a stale
          // snapshot with the old room value due to optimistic writes or
          // out-of-order delivery. Within 6s of a deliberate close, ignore
          // any "room is set" snapshots — the null snapshot is the truth.
          var suppressedUntil = window._suppressCasualResumeUntil || 0;
          var isSuppressed = Date.now() < suppressedUntil;
          if (!alreadyOnCasual && !isSuppressed) {
            window.location.hash = '#casual/' + newRoom;
          }
        }
        lastCasualRoom = newRoom;

        // Sync friend-relationship arrays so the sender's Explore view
        // reflects Accept/Reject/Remove decisions the other party made
        // WITHOUT requiring a page reload. Previously the explore cards
        // (including the "Convite enviado" pending card) stayed stale
        // indefinitely because AppStore.currentUser was never refreshed.
        if (store.currentUser) {
          var friendArraysChanged = false;
          ['friends', 'friendRequestsSent', 'friendRequestsReceived'].forEach(function(key) {
            var incoming = Array.isArray(data[key]) ? data[key] : [];
            var existing = Array.isArray(store.currentUser[key]) ? store.currentUser[key] : [];
            // Compare as sorted-joined strings — cheap and deterministic for
            // simple arrays of uids. Different length OR different members
            // counts as changed.
            var a = existing.slice().sort().join(',');
            var b = incoming.slice().sort().join(',');
            if (a !== b) {
              store.currentUser[key] = incoming.slice();
              friendArraysChanged = true;
            }
          });
          if (friendArraysChanged) {
            // If the Explorar view is open, re-render it so pending cards
            // disappear, new friends move up into "Meus Amigos", etc.
            if (window.location.hash === '#explore') {
              var vc = document.getElementById('view-container');
              if (vc && typeof renderExplore === 'function') renderExplore(vc);
            }
          }
        }
      }, function(err) {
        console.warn('Profile listener error:', err);
      });
  },

  // Load the public discovery feed (public + open tournaments the user
  // isn't in). Paginated via cursor. Pass { append: true } to fetch the next
  // page; otherwise replaces the current list (pull-to-refresh style).
  async loadPublicDiscovery(opts) {
    if (!window.FirestoreDB || typeof window.FirestoreDB.loadPublicOpenTournaments !== 'function') return;
    opts = opts || {};
    var cursor = opts.append ? this._publicDiscoveryCursor : null;
    var myEmail = this.currentUser && this.currentUser.email
      ? String(this.currentUser.email).toLowerCase()
      : '';
    try {
      var res = await window.FirestoreDB.loadPublicOpenTournaments({
        limit: opts.limit || 20,
        cursor: cursor
      });
      // Drop tournaments the user already has a relationship with — they
      // already see those via the scoped listener. Uses the denormalized
      // memberEmails[] so no extra reads.
      var filtered = (res.tournaments || []).filter(function(t) {
        if (!myEmail) return true;
        if (!Array.isArray(t.memberEmails)) return true;
        return t.memberEmails.indexOf(myEmail) === -1;
      });
      this.publicDiscovery = opts.append
        ? this.publicDiscovery.concat(filtered)
        : filtered;
      this._publicDiscoveryCursor = res.nextCursor;
      this._publicDiscoveryHasMore = !!res.hasMore;
    } catch (e) {
      console.warn('Erro ao carregar descoberta pública:', e);
    }
  },

  // Load tournaments from Firestore (one-time, fallback for listener failure).
  // Scoped to the current user's own tournaments via `memberEmails[]`.
  async loadFromFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    this._loading = true;
    try {
      var email = this.currentUser && this.currentUser.email;
      var tournaments = email
        ? await window.FirestoreDB.loadMyTournaments(email)
        : await window.FirestoreDB.loadAllTournaments();
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
      // v0.16.8: expõe snapshot do que Firestore devolveu pra debug visual.
      // Se o usuário reportar "gender sumiu", dá pra checar se foi (a) o save
      // que não persistiu (_lastProfileSave mostra), (b) o load que pegou
      // valor errado (_lastProfileLoad mostra), ou (c) o populate que
      // falhou (comparar com formulário). Diagnóstico em 3 pontos.
      try {
        window._lastProfileLoad = {
          uid: uid,
          version: window.SCOREPLACE_VERSION,
          at: new Date().toISOString(),
          hasProfile: !!profile,
          gender: profile ? profile.gender : undefined,
          city: profile ? profile.city : undefined,
          phone: profile ? profile.phone : undefined,
          birthDate: profile ? profile.birthDate : undefined,
          fields: profile ? Object.keys(profile).sort() : []
        };
        console.log('[Profile Load]', uid, 'gender:', window._lastProfileLoad.gender, 'city:', window._lastProfileLoad.city);
      } catch (_e) {}
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
        // Presence settings — previously set on currentUser via profile save but
        // never actually persisted to Firestore (save payload omitted them).
        // v0.16.5 adds save+load for these so the user's visibility/mute/auto
        // check-in choices survive app restarts.
        if (profile.presenceVisibility) this.currentUser.presenceVisibility = profile.presenceVisibility;
        if (profile.presenceMuteDays !== undefined) this.currentUser.presenceMuteDays = profile.presenceMuteDays;
        if (profile.presenceMuteUntil !== undefined) this.currentUser.presenceMuteUntil = profile.presenceMuteUntil;
        if (profile.presenceAutoCheckin !== undefined) this.currentUser.presenceAutoCheckin = profile.presenceAutoCheckin;
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
  //
  // v0.16.5 fix for silent data loss: the previous version wrote the full
  // profile object with `|| ''` / `|| []` fallbacks, which meant any field
  // not yet loaded into currentUser (race between login and loadUserProfile)
  // got persisted as empty string / empty array and WIPED the existing
  // Firestore value. Symptom reported: "mudo o perfil, salvo, fecho o app,
  // reabro e as informações somem". Now we:
  //   1. Add the presence settings to the save payload (they were never
  //      persisted before — set on currentUser but never written).
  //   2. Strip undefined fields so a race-hydrated currentUser can't clobber
  //      existing Firestore data.
  //   3. Drop friends / friendRequests* from this payload — those are owned
  //      by the dedicated FirestoreDB.sendFriendRequest /
  //      acceptFriendRequest / removeFriend flows which use arrayUnion /
  //      arrayRemove. Writing them here on every profile save was another
  //      clobber path when currentUser wasn't fully hydrated.
  async saveUserProfileToFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db || !this.currentUser) return;
    var user = this.currentUser;
    var uid = user.uid || user.email;
    var payload = {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      gender: user.gender,
      birthDate: user.birthDate,
      age: user.age,
      city: user.city,
      state: user.state,
      country: user.country,
      locale: user.locale,
      phone: user.phone,
      phoneCountry: user.phoneCountry,
      preferredSports: user.preferredSports,
      defaultCategory: user.defaultCategory,
      acceptFriendRequests: user.acceptFriendRequests,
      notifyPlatform: user.notifyPlatform,
      notifyEmail: user.notifyEmail,
      notifyWhatsApp: user.notifyWhatsApp,
      notifyLevel: user.notifyLevel,
      preferredCeps: user.preferredCeps,
      preferredLocations: user.preferredLocations,
      presenceVisibility: user.presenceVisibility,
      presenceMuteDays: user.presenceMuteDays,
      presenceMuteUntil: user.presenceMuteUntil,
      presenceAutoCheckin: user.presenceAutoCheckin,
      updatedAt: new Date().toISOString()
    };
    // Strip undefined so merge-save preserves existing Firestore values
    // for fields that were never hydrated into currentUser.
    Object.keys(payload).forEach(function(k) {
      if (payload[k] === undefined) delete payload[k];
    });
    // v0.16.6 defense-in-depth: Firestore set({merge:true}) preserves fields
    // apenas quando são `undefined` — strings vazias "" e arrays vazios []
    // ainda sobrescrevem o valor existente. Esse era exatamente o buraco
    // que fazia o perfil sumir: race condition pintava currentUser com ""
    // antes do loadUserProfile merge, save persistia "", Firestore passava
    // a ter "" definitivo. Agora também removemos "" e [] dos campos
    // opcionais. Booleans, phoneCountry (default "55") e notifyLevel
    // (default "todas") continuam sendo escritos sempre.
    var _optionalTextFields = ['gender', 'birthDate', 'city', 'state', 'country',
                               'phone', 'defaultCategory', 'preferredCeps'];
    var _optionalArrayFields = ['preferredSports', 'preferredLocations'];
    _optionalTextFields.forEach(function(k) {
      if (payload[k] === '') delete payload[k];
    });
    _optionalArrayFields.forEach(function(k) {
      if (Array.isArray(payload[k]) && payload[k].length === 0) delete payload[k];
    });
    var _persistedKeys = Object.keys(payload).sort();
    console.log('[Profile Save]', uid, 'fields persisted:', _persistedKeys.join(','));
    // v0.16.7: evidência em tela. Expõe o último save pra UI consumir.
    // v0.16.8: agora compara VALORES no round-trip (não só presença da chave).
    // v0.16.7 checava apenas `_roundtrip[k] === undefined`, o que passava mesmo
    // quando Firestore rejeitava silenciosamente a gravação — o doc antigo
    // retornava com o VALOR VELHO da chave, que não é undefined, logo o check
    // passava e o toast mostrava ✅. Agora comparamos stringify do valor
    // enviado com o valor realmente gravado — se diferente, vai pra
    // `roundtripMismatch` e o toast mostra exatamente qual campo regrediu.
    window._lastProfileSave = {
      uid: uid,
      version: window.SCOREPLACE_VERSION,
      at: new Date().toISOString(),
      fields: _persistedKeys,
      payload: payload
    };
    try {
      await window.FirestoreDB.saveUserProfile(uid, payload);
      window._lastProfileSave.ok = true;
      // Verificação round-trip: lê de volta e confirma que os VALORES chegaram.
      try {
        var _roundtrip = await window.FirestoreDB.loadUserProfile(uid);
        var _missing = [];
        var _mismatch = [];
        _persistedKeys.forEach(function(k) {
          if (k === 'updatedAt') return; // timestamp muda sempre — ignorar
          if (!_roundtrip || _roundtrip[k] === undefined) {
            _missing.push(k);
            return;
          }
          // Compara valor enviado com valor gravado. JSON.stringify é
          // bom o suficiente pra primitivos, arrays e objetos simples.
          var _sent = JSON.stringify(payload[k]);
          var _got = JSON.stringify(_roundtrip[k]);
          if (_sent !== _got) {
            _mismatch.push({ field: k, sent: payload[k], got: _roundtrip[k] });
          }
        });
        window._lastProfileSave.roundtripMissing = _missing;
        window._lastProfileSave.roundtripMismatch = _mismatch;
        if (_missing.length > 0) console.warn('[Profile Save] roundtrip missing:', _missing);
        if (_mismatch.length > 0) console.warn('[Profile Save] roundtrip mismatch:', _mismatch);
      } catch (_e) {
        window._lastProfileSave.roundtripError = (_e && _e.message) || String(_e);
      }
    } catch (e) {
      window._lastProfileSave.ok = false;
      window._lastProfileSave.error = (e && e.message) || String(e);
      throw e;
    }
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
      // Default status='open' pra que torneios novos apareçam no feed
      // público de discovery. A query `loadPublicOpenTournaments` filtra
      // por `where('status', '==', 'open')` — sem este default, o campo
      // ficava undefined em novos torneios criados pelo fluxo avançado
      // e o count "Abertos para você" na dashboard vinha zerado. Fica
      // aqui como defensive default; se o caller passar status explícito
      // (ex: draft), o Object.assign preserva via spread logic abaixo.
      status: 'open',
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

// ─── Enrollment lookup: matches user against a participant (incl. team members) ─
// A participant can be:
//  • string "Name"                           → match vs user.displayName/email
//  • string "Name1 / Name2"                  → team — match any member
//  • object { uid, email, displayName, ... } → top-level fields
//  • object { ..., participants: [ m1, m2 ] }→ team — recurse into each member
//  • object whose displayName/name contains " / " → treat label as team string
window._userMatchesParticipant = function(user, p) {
  if (!user || !p) return false;
  var ue = (user.email || '').toLowerCase();
  var un = user.displayName || '';
  var uu = user.uid || '';
  function matchMember(m) {
    if (!m) return false;
    if (typeof m === 'string') {
      var s = m.trim();
      return (ue && s.toLowerCase() === ue) || (un && s === un);
    }
    if (uu && m.uid && m.uid === uu) return true;
    if (ue && m.email && m.email.toLowerCase() === ue) return true;
    if (un && m.displayName && m.displayName === un) return true;
    if (un && m.name && m.name === un) return true;
    return false;
  }
  if (typeof p === 'string') {
    var parts = p.split(' / ').map(function(s) { return s.trim(); }).filter(Boolean);
    return parts.some(matchMember);
  }
  if (matchMember(p)) return true;
  if (Array.isArray(p.participants) && p.participants.some(matchMember)) return true;
  var label = p.displayName || p.name || '';
  if (label && label.indexOf(' / ') !== -1) {
    return label.split(' / ').map(function(s) { return s.trim(); }).filter(Boolean).some(matchMember);
  }
  return false;
};

window._isUserEnrolledInTournament = function(user, tournament) {
  if (!user || !tournament) return false;
  var arr = Array.isArray(tournament.participants) ? tournament.participants : (tournament.participants ? Object.values(tournament.participants) : []);
  return arr.some(function(p) { return window._userMatchesParticipant(user, p); });
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

// ─── Auto-scroll during drag (HTML5 + touch) ───────────────────────────────
// Scrolls the nearest scrollable container (or window) when the pointer
// approaches the top/bottom viewport edge during a drag. HTML5 drags are
// handled automatically via document-level dragover. Custom touch-drag code
// should call window._dragAutoScrollOnTouchMove(event) from its touchmove
// handler and window._dragAutoScrollStop() from its touchend handler.
(function(){
  var EDGE = 80;       // px from viewport edge where auto-scroll kicks in
  var MAX_SPEED = 18;  // px per animation frame at the very edge
  var IDLE_MS = 150;   // stop auto-scroll if no pointer event within this window
  var rafId = null;
  var lastY = -1;
  var lastEvt = 0;
  var container = null;

  function isScrollable(el) {
    if (!el || el === document.documentElement || el === document.body) return false;
    var cs = getComputedStyle(el);
    var oy = cs.overflowY;
    return (oy === 'auto' || oy === 'scroll') && el.scrollHeight - el.clientHeight > 1;
  }
  function findScrollable(startEl) {
    var el = startEl;
    while (el && el !== document.body) {
      if (isScrollable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function tick() {
    if (Date.now() - lastEvt > IDLE_MS || lastY < 0) {
      rafId = null; container = null; return;
    }
    var vh = window.innerHeight;
    var delta = 0;
    if (lastY < EDGE) delta = -Math.ceil(MAX_SPEED * (EDGE - lastY) / EDGE);
    else if (lastY > vh - EDGE) delta = Math.ceil(MAX_SPEED * (lastY - (vh - EDGE)) / EDGE);
    if (delta !== 0) {
      if (container) container.scrollTop += delta;
      else window.scrollBy(0, delta);
    }
    rafId = requestAnimationFrame(tick);
  }
  function schedule(x, y) {
    lastY = y;
    lastEvt = Date.now();
    if (!container) {
      var el = document.elementFromPoint(x, y);
      container = findScrollable(el);
    }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function stop() {
    lastY = -1;
    container = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  document.addEventListener('dragover', function(e){ schedule(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('dragend', stop, { passive: true });
  document.addEventListener('drop', stop, { passive: true });

  window._dragAutoScrollOnTouchMove = function(e) {
    var t = e && e.touches && e.touches[0];
    if (t) schedule(t.clientX, t.clientY);
  };
  window._dragAutoScrollStop = stop;
})();
