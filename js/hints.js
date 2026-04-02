// ── Visual Hints System (Dicas Visuais) ─────────────────────────────────────
// Provides contextual, progressive visual hints to guide users.
// Hints appear after inactivity (idle), glow the target element,
// and show a tooltip balloon with helpful text.
// User can disable via profile toggle. State persisted in localStorage.

(function() {
  'use strict';

  var IDLE_TIMEOUT = 8000;          // ms of inactivity before showing a hint
  var HINT_DISPLAY_TIME = 12000;    // ms a hint stays visible
  var HINT_COOLDOWN = 25000;        // ms between hints in same session
  var STRATEGIC_BOOST = 0.35;       // probability boost for strategic hints (Apoie/Pro)
  var LS_KEY = 'scoreplace_hints';
  var LS_DISABLED_KEY = 'scoreplace_hints_disabled';

  // ── State ──────────────────────────────────────────────────────────────────
  var _idleTimer = null;
  var _cooldownTimer = null;
  var _activeHint = null;
  var _onCooldown = false;
  var _initialized = false;
  var _seenHints = {};
  var _sessionShown = {};   // hints shown this session (id → count)

  // ── Hint Catalog ───────────────────────────────────────────────────────────
  // Each hint: { id, selector, text, context, priority (1-10), strategic, position }
  // context: 'global' | 'dashboard' | 'tournament-detail' | 'create-tournament' | 'bracket' | 'explore'
  // position: 'bottom' | 'top' | 'left' | 'right' (balloon position relative to element)
  var _hints = [
    // ── Global / Topbar ──
    { id: 'hamburger', selector: '.hamburger-btn', text: 'Toque aqui para abrir o menu e navegar pelo app!', context: 'global', priority: 9, position: 'bottom' },
    { id: 'profile', selector: '#btn-login', text: 'Acesse seu perfil, veja estatísticas e configure notificações.', context: 'global', priority: 7, position: 'bottom' },
    { id: 'theme', selector: '#theme-toggle-btn', text: 'Experimente trocar o tema! Temos Noturno, Claro, Pôr do Sol e Oceano.', context: 'global', priority: 4, position: 'bottom' },
    { id: 'help', selector: 'a[onclick*="modal-help"]', text: 'Dúvidas? Aqui tem o manual completo com todas as funcionalidades!', context: 'global', priority: 5, position: 'bottom' },
    { id: 'quick-search', selector: '.hamburger-btn', text: 'Dica: use Ctrl+K para buscar torneios e jogadores rapidamente!', context: 'global', priority: 3, position: 'bottom', requiresLogin: true },
    { id: 'notifications', selector: 'a[href="#notifications"]', text: 'Fique por dentro! Aqui você recebe avisos de torneios e convites.', context: 'global', priority: 5, position: 'bottom', requiresLogin: true },
    { id: 'explore-nav', selector: 'a[href="#explore"]', text: 'Descubra torneios públicos da comunidade e participe!', context: 'global', priority: 6, position: 'bottom' },

    // ── Strategic (Apoie / Pro) — appear more often, with compelling copy ──
    { id: 'apoie-topbar', selector: '#btn-support-pix', text: 'Gostou do scoreplace? Seu apoio via PIX mantém a plataforma gratuita e nos ajuda a crescer!', context: 'dashboard', priority: 8, strategic: true, position: 'bottom' },
    { id: 'pro-topbar', selector: '#btn-upgrade-pro', text: 'Desbloqueie torneios ilimitados, upload de logo e Modo TV sem marca! Apenas R$19,90/mês.', context: 'dashboard', priority: 8, strategic: true, position: 'bottom', requiresPlan: 'free' },
    { id: 'apoie-detail', selector: '#btn-support-pix', text: 'Cada contribuição faz diferença! Apoie via PIX e ajude a manter o scoreplace gratuito.', context: 'tournament-detail', priority: 6, strategic: true, position: 'bottom' },
    { id: 'pro-detail', selector: '#btn-upgrade-pro', text: 'Com o plano Pro você pode criar torneios ilimitados e personalizar com sua marca!', context: 'tournament-detail', priority: 6, strategic: true, position: 'bottom', requiresPlan: 'free' },

    // ── Dashboard ──
    { id: 'new-tournament', selector: '.btn-create-hero, #btn-create-tournament-in-box', text: 'Crie seu primeiro torneio! É rápido: escolha o esporte, defina o formato e convide os participantes.', context: 'dashboard', priority: 10, position: 'bottom' },
    { id: 'dashboard-filters', selector: '.hero-filters, [data-filter]', text: 'Use os filtros para ver só os torneios que organiza, participa ou favoritou.', context: 'dashboard', priority: 4, position: 'bottom', requiresLogin: true },
    { id: 'dashboard-compact', selector: '[onclick*="_setDashView"]', text: 'Prefere uma visualização mais compacta? Alterne entre cards e lista!', context: 'dashboard', priority: 3, position: 'top' },
    { id: 'dashboard-card-fav', selector: '[data-fav-id]', text: 'Clique na estrela para favoritar um torneio e encontrá-lo mais rápido!', context: 'dashboard', priority: 4, position: 'top' },

    // ── Tournament Detail ──
    { id: 'invite-friends', selector: '[onclick*="_shareTournament"], [onclick*="openEnrollModal"]', text: 'Convide amigos! Compartilhe o link por WhatsApp, QR Code ou copie o link.', context: 'tournament-detail', priority: 7, position: 'top' },
    { id: 'enroll-btn', selector: '[onclick*="enrollInTournament"]', text: 'Inscreva-se para participar! O organizador será notificado automaticamente.', context: 'tournament-detail', priority: 8, position: 'top' },
    { id: 'qr-code', selector: '[onclick*="_showQRCode"]', text: 'Gere um QR Code para projetar no local do evento. Participantes escaneiam e se inscrevem!', context: 'tournament-detail', priority: 4, position: 'top' },
    { id: 'tv-mode', selector: '[onclick*="_tvMode"]', text: 'Modo TV: projete o placar ao vivo em um telão no local do torneio!', context: 'bracket', priority: 5, position: 'top' },
    { id: 'org-communicate', selector: '[onclick*="_sendOrgCommunication"]', text: 'Envie mensagens para todos os inscritos — ideal para avisos de horário ou local.', context: 'tournament-detail', priority: 5, position: 'top' },
    { id: 'org-sortear', selector: '[onclick*="_handleSortearClick"], [onclick*="generateDrawFunction"]', text: 'Sorteie o chaveamento! Os participantes serão distribuídos automaticamente.', context: 'tournament-detail', priority: 9, position: 'top' },

    // ── Create Tournament ──
    { id: 'ct-sport', selector: '#select-sport', text: 'Escolha o esporte: cada modalidade tem padrões de pontuação e regras próprias.', context: 'create-tournament', priority: 8, position: 'bottom' },
    { id: 'ct-format', selector: '#select-formato', text: 'Eliminatória (mata-mata), Liga (todos contra todos), Suíço (pareamento por pontos), Grupos + Eliminatórias...', context: 'create-tournament', priority: 8, position: 'bottom' },
    { id: 'ct-venue', selector: '#tourn-venue', text: 'Informe o local! A busca mostra endereços reais e até previsão do tempo para o dia do evento.', context: 'create-tournament', priority: 6, position: 'bottom' },
    { id: 'ct-categories', selector: '#btn-cat-fem, [onclick*="toggleGenderCat"]', text: 'Ative categorias para separar chaveamentos por gênero e/ou nível de habilidade.', context: 'create-tournament', priority: 5, position: 'bottom' },
    { id: 'ct-gsm', selector: '#btn-gsm-config', text: 'Configure sets, games e tiebreaks! Ideal para tênis, beach tennis, padel e vôlei.', context: 'create-tournament', priority: 7, position: 'bottom' },
    { id: 'ct-logo', selector: '#logo-preview, [onclick*="generateLogo"]', text: 'Gere uma logo automática para o torneio! Você também pode fazer upload da sua.', context: 'create-tournament', priority: 4, position: 'top' },
    { id: 'ct-public', selector: '#tourn-public', text: 'Torneio público aparece na aba Explorar — ótimo para atrair novos participantes!', context: 'create-tournament', priority: 5, position: 'top' },
    { id: 'ct-dates', selector: '#tourn-start-date', text: 'Defina datas de início e inscrição. Os participantes verão contagem regressiva nos cards!', context: 'create-tournament', priority: 5, position: 'bottom' },

    // ── Bracket / Standings ──
    { id: 'bracket-zoom', selector: '.zoom-slider, [onclick*="zoomIn"]', text: 'Use o zoom para ver o chaveamento completo. Dica: arraste para navegar!', context: 'bracket', priority: 4, position: 'top' },
    { id: 'bracket-print', selector: '[onclick*="_printBracket"]', text: 'Imprima o chaveamento para colar na parede do evento!', context: 'bracket', priority: 3, position: 'top' },
    { id: 'bracket-export', selector: '[onclick*="_exportTournamentCSV"]', text: 'Exporte resultados em CSV para abrir no Excel ou Google Sheets.', context: 'bracket', priority: 3, position: 'top' },
    { id: 'standings-sort', selector: 'th[onclick*="_sortStandingsTable"]', text: 'Clique nos cabeçalhos da tabela para ordenar por qualquer coluna!', context: 'bracket', priority: 5, position: 'bottom' },
    { id: 'bracket-share', selector: '[onclick*="_shareMatchResult"]', text: 'Compartilhe o resultado de cada partida direto no WhatsApp!', context: 'bracket', priority: 4, position: 'top' },

    // ── Explore ──
    { id: 'explore-search', selector: '#explore-search, input[placeholder*="Buscar"]', text: 'Busque por nome, esporte, formato ou cidade para encontrar torneios perto de você!', context: 'explore', priority: 6, position: 'bottom' }
  ];

  // ── Utility ────────────────────────────────────────────────────────────────
  function _isDisabled() {
    try { return localStorage.getItem(LS_DISABLED_KEY) === '1'; } catch (e) { return false; }
  }

  function _loadSeen() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      _seenHints = raw ? JSON.parse(raw) : {};
    } catch (e) { _seenHints = {}; }
  }

  function _saveSeen() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(_seenHints)); } catch (e) {}
  }

  function _getCurrentContext() {
    var hash = window.location.hash || '#dashboard';
    if (hash.indexOf('#dashboard') === 0) return 'dashboard';
    if (hash.indexOf('#tournaments/') === 0 || hash.indexOf('#tournament/') === 0) return 'tournament-detail';
    if (hash.indexOf('#bracket/') === 0) return 'bracket';
    if (hash.indexOf('#explore') === 0) return 'explore';
    // Detect create-tournament modal open
    var ctModal = document.getElementById('modal-create-tournament');
    if (ctModal && ctModal.classList.contains('active')) return 'create-tournament';
    var qcModal = document.getElementById('modal-quick-create');
    if (qcModal && qcModal.classList.contains('active')) return 'create-tournament';
    return 'dashboard';
  }

  function _isLoggedIn() {
    return !!(window.AppStore && window.AppStore.currentUser && window.AppStore.currentUser.email);
  }

  function _getUserPlan() {
    if (!window.AppStore || !window.AppStore.currentUser) return 'free';
    return window.AppStore.currentUser.plan || 'free';
  }

  // ── Pick next hint ─────────────────────────────────────────────────────────
  function _pickHint() {
    var ctx = _getCurrentContext();
    var loggedIn = _isLoggedIn();
    var plan = _getUserPlan();

    // Filter eligible hints
    var eligible = _hints.filter(function(h) {
      // Must match context or be global
      if (h.context !== ctx && h.context !== 'global') return false;
      // Check login requirement
      if (h.requiresLogin && !loggedIn) return false;
      // Check plan requirement (e.g. Pro hint only for free users)
      if (h.requiresPlan && h.requiresPlan !== plan) return false;
      // Must have visible target element
      var el = document.querySelector(h.selector);
      if (!el || el.offsetParent === null) return false;
      // Check if element is in viewport (roughly)
      var rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight + 100) return false;
      // Don't show too many times in one session
      if ((_sessionShown[h.id] || 0) >= 2) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    // Score each hint: priority + freshness bonus + strategic boost + randomness
    var scored = eligible.map(function(h) {
      var seenCount = _seenHints[h.id] || 0;
      var sessionCount = _sessionShown[h.id] || 0;
      var freshness = seenCount === 0 ? 5 : Math.max(0, 3 - seenCount);
      var stratBoost = h.strategic ? 3 : 0;
      var sessionPenalty = sessionCount * 4;
      var score = h.priority + freshness + stratBoost - sessionPenalty + (Math.random() * 2);
      return { hint: h, score: score };
    });

    // Sort by score descending
    scored.sort(function(a, b) { return b.score - a.score; });

    // Strategic hints get boosted chance: if top pick is not strategic,
    // roll dice to maybe swap with best strategic hint
    if (!scored[0].hint.strategic) {
      var bestStrategic = scored.find(function(s) { return s.hint.strategic; });
      if (bestStrategic && Math.random() < STRATEGIC_BOOST) {
        return bestStrategic.hint;
      }
    }

    return scored[0].hint;
  }

  // ── Show hint ──────────────────────────────────────────────────────────────
  function _showHint(hint) {
    var el = document.querySelector(hint.selector);
    if (!el) return;

    _activeHint = hint;

    // Add glow class to target
    el.classList.add('hint-glow');
    el.setAttribute('data-hint-active', '1');

    // Create tooltip balloon
    var balloon = document.createElement('div');
    balloon.className = 'hint-balloon hint-balloon-' + (hint.position || 'bottom');
    balloon.setAttribute('data-hint-id', hint.id);
    balloon.innerHTML =
      '<div class="hint-balloon-content">' +
        '<span class="hint-balloon-icon">' + (hint.strategic ? '💡' : '👋') + '</span>' +
        '<span class="hint-balloon-text">' + hint.text + '</span>' +
      '</div>' +
      '<button class="hint-balloon-close" aria-label="Fechar dica">&times;</button>' +
      '<div class="hint-balloon-actions">' +
        '<button class="hint-balloon-got-it">Entendi</button>' +
        '<button class="hint-balloon-disable">Desativar dicas</button>' +
      '</div>';

    document.body.appendChild(balloon);

    // Position balloon relative to element
    _positionBalloon(balloon, el, hint.position || 'bottom');

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        balloon.classList.add('hint-balloon-visible');
      });
    });

    // Event listeners
    balloon.querySelector('.hint-balloon-close').addEventListener('click', function(e) {
      e.stopPropagation();
      _dismissHint();
    });
    balloon.querySelector('.hint-balloon-got-it').addEventListener('click', function(e) {
      e.stopPropagation();
      _dismissHint();
    });
    balloon.querySelector('.hint-balloon-disable').addEventListener('click', function(e) {
      e.stopPropagation();
      _disableHints();
    });

    // Clicking the target element also dismisses
    el.addEventListener('click', _onTargetClick);

    // Auto-dismiss after HINT_DISPLAY_TIME
    setTimeout(function() {
      if (_activeHint && _activeHint.id === hint.id) _dismissHint();
    }, HINT_DISPLAY_TIME);

    // Track
    _seenHints[hint.id] = (_seenHints[hint.id] || 0) + 1;
    _sessionShown[hint.id] = (_sessionShown[hint.id] || 0) + 1;
    _saveSeen();
  }

  function _positionBalloon(balloon, el, position) {
    var rect = el.getBoundingClientRect();
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;

    var styles = {};
    var margin = 12;

    switch (position) {
      case 'top':
        styles.left = rect.left + scrollX + rect.width / 2;
        styles.top = rect.top + scrollY - margin;
        balloon.style.transform = 'translate(-50%, -100%)';
        break;
      case 'left':
        styles.left = rect.left + scrollX - margin;
        styles.top = rect.top + scrollY + rect.height / 2;
        balloon.style.transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        styles.left = rect.right + scrollX + margin;
        styles.top = rect.top + scrollY + rect.height / 2;
        balloon.style.transform = 'translate(0, -50%)';
        break;
      default: // bottom
        styles.left = rect.left + scrollX + rect.width / 2;
        styles.top = rect.bottom + scrollY + margin;
        balloon.style.transform = 'translate(-50%, 0)';
        break;
    }

    balloon.style.position = 'absolute';
    balloon.style.left = styles.left + 'px';
    balloon.style.top = styles.top + 'px';
    balloon.style.zIndex = '100000';

    // Keep within viewport
    requestAnimationFrame(function() {
      var bRect = balloon.getBoundingClientRect();
      if (bRect.right > window.innerWidth - 12) {
        balloon.style.left = (window.innerWidth - bRect.width - 12 + scrollX) + 'px';
        balloon.style.transform = balloon.style.transform.replace('translate(-50%', 'translate(0');
      }
      if (bRect.left < 12) {
        balloon.style.left = (12 + scrollX) + 'px';
        balloon.style.transform = balloon.style.transform.replace('translate(-50%', 'translate(0');
      }
    });
  }

  function _onTargetClick() {
    _dismissHint();
  }

  // ── Dismiss ────────────────────────────────────────────────────────────────
  function _dismissHint() {
    if (!_activeHint) return;
    var hintId = _activeHint.id;

    // Remove glow
    var glowed = document.querySelectorAll('.hint-glow');
    glowed.forEach(function(el) {
      el.classList.remove('hint-glow');
      el.removeAttribute('data-hint-active');
      el.removeEventListener('click', _onTargetClick);
    });

    // Remove balloon
    var balloon = document.querySelector('.hint-balloon[data-hint-id="' + hintId + '"]');
    if (balloon) {
      balloon.classList.remove('hint-balloon-visible');
      balloon.classList.add('hint-balloon-hiding');
      setTimeout(function() { if (balloon.parentNode) balloon.parentNode.removeChild(balloon); }, 300);
    }

    _activeHint = null;

    // Start cooldown
    _onCooldown = true;
    clearTimeout(_cooldownTimer);
    _cooldownTimer = setTimeout(function() {
      _onCooldown = false;
    }, HINT_COOLDOWN);
  }

  // ── Disable ────────────────────────────────────────────────────────────────
  function _disableHints() {
    _dismissHint();
    try { localStorage.setItem(LS_DISABLED_KEY, '1'); } catch (e) {}
    _stopIdleWatch();
    if (typeof showNotification === 'function') {
      showNotification('Dicas Desativadas', 'Você pode reativar nas configurações do perfil.', 'info');
    }
  }

  // ── Enable ─────────────────────────────────────────────────────────────────
  function _enableHints() {
    try { localStorage.removeItem(LS_DISABLED_KEY); } catch (e) {}
    _startIdleWatch();
    if (typeof showNotification === 'function') {
      showNotification('Dicas Ativadas', 'Dicas visuais aparecerão após alguns segundos de inatividade.', 'info');
    }
  }

  // ── Idle Detection ─────────────────────────────────────────────────────────
  var _activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

  function _resetIdleTimer() {
    clearTimeout(_idleTimer);
    // If a hint is showing and user interacts, dismiss it
    if (_activeHint) {
      _dismissHint();
      return;
    }
    if (_isDisabled() || _onCooldown) return;
    _idleTimer = setTimeout(_onIdle, IDLE_TIMEOUT);
  }

  function _onIdle() {
    if (_isDisabled() || _activeHint || _onCooldown) return;
    // Don't show hints if a modal is open (except create-tournament which has its own hints)
    var anyModal = document.querySelector('.modal-overlay.active');
    if (anyModal) {
      var isCreateModal = anyModal.id === 'modal-create-tournament';
      if (!isCreateModal) return;
    }

    var hint = _pickHint();
    if (hint) _showHint(hint);
  }

  function _startIdleWatch() {
    _activityEvents.forEach(function(evt) {
      document.addEventListener(evt, _resetIdleTimer, { passive: true });
    });
    _resetIdleTimer();
  }

  function _stopIdleWatch() {
    clearTimeout(_idleTimer);
    _activityEvents.forEach(function(evt) {
      document.removeEventListener(evt, _resetIdleTimer);
    });
    _dismissHint();
  }

  // ── Initialization ─────────────────────────────────────────────────────────
  function _init() {
    if (_initialized) return;
    _initialized = true;
    _loadSeen();
    if (!_isDisabled()) {
      _startIdleWatch();
    }
  }

  // ── Reset seen hints (for testing or new user) ─────────────────────────────
  function _resetHints() {
    _seenHints = {};
    _sessionShown = {};
    _saveSeen();
    if (typeof showNotification === 'function') {
      showNotification('Dicas Resetadas', 'Todas as dicas serão exibidas novamente.', 'info');
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window._hintSystem = {
    init: _init,
    enable: _enableHints,
    disable: _disableHints,
    reset: _resetHints,
    isDisabled: _isDisabled,
    dismiss: _dismissHint
  };

  // Auto-init after DOM is ready + small delay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_init, 2000); });
  } else {
    setTimeout(_init, 2000);
  }

  // Re-evaluate on hash change (new view = new context = new hints)
  window.addEventListener('hashchange', function() {
    if (_activeHint) _dismissHint();
    _onCooldown = false;
    clearTimeout(_cooldownTimer);
    _resetIdleTimer();
  });

})();
