// ── Visual Hints System (Dicas Visuais) v2 ──────────────────────────────────
// Contextual, progressive visual hints. Only shows for elements truly visible
// on screen. Balloon arrow points precisely at the target element.

(function() {
  'use strict';

  var IDLE_TIMEOUT = 6000;          // ms of inactivity before showing a hint
  var HINT_DISPLAY_TIME = 10000;    // ms a hint stays visible
  var HINT_COOLDOWN = 5000;         // ms between consecutive hints
  var STRATEGIC_BOOST = 0.30;       // probability boost for strategic hints
  var LS_KEY = 'scoreplace_hints';
  var LS_DISABLED_KEY = 'scoreplace_hints_disabled';

  // ── State ──────────────────────────────────────────────────────────────────
  var _idleTimer = null;
  var _cooldownTimer = null;
  var _autoDismissTimer = null;
  var _activeHint = null;
  var _activeEl = null;
  var _onCooldown = false;
  var _initialized = false;
  var _seenHints = {};
  var _sessionShown = {};
  var _lastHintId = null;    // avoid repeating same hint back-to-back

  // ── Hint Catalog ───────────────────────────────────────────────────────────
  var _hints = [
    // ── Global / Topbar (only when element is visible in topbar) ──
    { id: 'login-cta', selector: '#btn-login', text: 'Faça login para criar e gerenciar torneios! Use suas redes sociais se preferir.', context: 'global', priority: 10, position: 'bottom', requiresLogout: true },
    { id: 'hamburger', selector: '.hamburger-btn', text: 'Toque aqui para abrir o menu e navegar pelo app!', context: 'global', priority: 9, position: 'bottom' },
    { id: 'profile', selector: '#btn-login', text: 'Acesse seu perfil, veja estatísticas e configure notificações.', context: 'global', priority: 7, position: 'bottom' },
    { id: 'theme', selector: '#theme-toggle-btn', text: 'Experimente trocar o tema! Temos Noturno, Claro, Pôr do Sol e Oceano.', context: 'global', priority: 4, position: 'bottom' },
    { id: 'help', selector: 'a[onclick*="modal-help"]', text: 'Dúvidas? Aqui tem o manual completo com todas as funcionalidades!', context: 'global', priority: 5, position: 'bottom' },
    { id: 'quick-search', selector: '.hamburger-btn', text: 'Dica: use Ctrl+K para buscar torneios e jogadores rapidamente!', context: 'global', priority: 3, position: 'bottom', requiresLogin: true },
    { id: 'notifications', selector: 'a[href="#notifications"]', text: 'Fique por dentro! Aqui você recebe avisos de torneios e convites.', context: 'global', priority: 5, position: 'bottom', requiresLogin: true },
    { id: 'explore-nav', selector: 'a[href="#explore"]', text: 'Descubra torneios públicos da comunidade e participe!', context: 'global', priority: 6, position: 'bottom' },

    // ── Strategic (Apoie / Pro) — only when button is on screen ──
    { id: 'apoie-dash', selector: '#btn-support-pix', text: 'Gostou do scoreplace? Seu apoio via PIX mantém a plataforma gratuita e nos ajuda a crescer!', context: 'dashboard', priority: 8, strategic: true, position: 'bottom' },
    { id: 'pro-dash', selector: '#btn-upgrade-pro', text: 'Desbloqueie torneios ilimitados, upload de logo e Modo TV sem marca! Apenas R$19,90/mês.', context: 'dashboard', priority: 8, strategic: true, position: 'bottom', requiresPlan: 'free' },
    { id: 'apoie-detail', selector: '#btn-support-pix', text: 'Cada contribuição faz diferença! Apoie via PIX e ajude a manter o scoreplace gratuito.', context: 'tournament-detail', priority: 6, strategic: true, position: 'bottom' },
    { id: 'pro-detail', selector: '#btn-upgrade-pro', text: 'Com o plano Pro você pode criar torneios ilimitados e personalizar com sua marca!', context: 'tournament-detail', priority: 6, strategic: true, position: 'bottom', requiresPlan: 'free' },

    // ── Dashboard: Hero Box ──
    { id: 'new-tournament', selector: '#btn-create-tournament-in-box', text: 'Crie seu próprio torneio! Escolha o esporte, defina o formato e convide os participantes — leva menos de 1 minuto.', context: 'dashboard', priority: 10, position: 'bottom' },
    { id: 'hero-filter-todos', selector: '[onclick*="_applyDashFilter(\'todos\')"]', text: 'Veja todos os torneios de uma vez — organizados por você e os que participa.', context: 'dashboard', priority: 4, position: 'top', requiresLogin: true },
    { id: 'hero-filter-organizados', selector: '[onclick*="_applyDashFilter(\'organizados\')"]', text: 'Filtre só os torneios que você organiza. Ideal para gerenciar vários eventos.', context: 'dashboard', priority: 5, position: 'top', requiresLogin: true },
    { id: 'hero-filter-participando', selector: '[onclick*="_applyDashFilter(\'participando\')"]', text: 'Veja apenas os torneios em que você está inscrito como participante.', context: 'dashboard', priority: 5, position: 'top', requiresLogin: true },
    { id: 'hero-filter-abertos', selector: '[onclick*="_applyDashFilter(\'abertos\')"]', text: 'Torneios com inscrições abertas para você! Inscreva-se e comece a competir.', context: 'dashboard', priority: 6, position: 'top', requiresLogin: true },
    { id: 'hero-filter-favoritos', selector: '[onclick*="_applyDashFilter(\'favoritos\')"]', text: 'Seus torneios favoritados ficam aqui. Clique na estrela em qualquer card para favoritar!', context: 'dashboard', priority: 4, position: 'top', requiresLogin: true },
    { id: 'hero-filter-encerrados', selector: '[onclick*="_applyDashFilter(\'encerrados\')"]', text: 'Reveja torneios encerrados: classificação final, podium e histórico de partidas.', context: 'dashboard', priority: 3, position: 'top', requiresLogin: true },
    // ── Dashboard: Geral ──
    { id: 'dashboard-filters', selector: '[data-filter]', text: 'Use os filtros para ver só os torneios que organiza, participa ou favoritou.', context: 'dashboard', priority: 4, position: 'bottom', requiresLogin: true },
    { id: 'dashboard-compact', selector: '[onclick*="_setDashView"]', text: 'Prefere uma visualização mais compacta? Alterne entre cards e lista!', context: 'dashboard', priority: 3, position: 'top' },
    { id: 'dashboard-card-fav', selector: '[data-fav-id]', text: 'Clique na estrela para favoritar um torneio e encontrá-lo mais rápido!', context: 'dashboard', priority: 4, position: 'top' },

    // ── Tournament Detail ──
    { id: 'invite-friends', selector: '[onclick*="_shareTournament"]', text: 'Convide amigos! Compartilhe o link por WhatsApp, QR Code ou copie o link.', context: 'tournament-detail', priority: 7, position: 'top' },
    { id: 'enroll-btn', selector: '[onclick*="enrollInTournament"]', text: 'Inscreva-se para participar! O organizador será notificado automaticamente.', context: 'tournament-detail', priority: 8, position: 'top' },
    { id: 'qr-code', selector: '[onclick*="_showQRCode"]', text: 'Gere um QR Code para projetar no local do evento. Participantes escaneiam e se inscrevem!', context: 'tournament-detail', priority: 4, position: 'top' },
    { id: 'tv-mode', selector: '[onclick*="_tvMode"]', text: 'Modo TV: projete o placar ao vivo em um telão no local do torneio!', context: 'bracket', priority: 5, position: 'top' },
    { id: 'org-communicate', selector: '[onclick*="_sendOrgCommunication"]', text: 'Envie mensagens para todos os inscritos — ideal para avisos de horário ou local.', context: 'tournament-detail', priority: 5, position: 'top' },
    { id: 'org-sortear', selector: '[onclick*="_handleSortearClick"]', text: 'Sorteie o chaveamento! Os participantes serão distribuídos automaticamente.', context: 'tournament-detail', priority: 9, position: 'top' },
    { id: 'org-edit-new', selector: '[onclick*="openEditModal"]', text: 'Edite os detalhes do seu torneio clicando aqui — local, datas, formato e mais!', context: 'tournament-detail', priority: 10, position: 'top' },

    // ── Create Tournament ──
    { id: 'ct-sport', selector: '#select-sport', text: 'Escolha o esporte: cada modalidade tem padrões de pontuação e regras próprias.', context: 'create-tournament', priority: 8, position: 'bottom' },
    { id: 'ct-format', selector: '#select-formato', text: 'Eliminatória Simples, Dupla Eliminatória, Liga (todos contra todos), Suíço (pareamento por pontos), Grupos + Eliminatória...', context: 'create-tournament', priority: 8, position: 'bottom' },
    { id: 'ct-venue', selector: '#tourn-venue', text: 'Informe o local! A busca mostra endereços reais e até previsão do tempo para o dia do evento.', context: 'create-tournament', priority: 6, position: 'bottom' },
    { id: 'ct-categories', selector: '#btn-cat-fem', text: 'Ative categorias para separar chaveamentos por gênero e/ou nível de habilidade.', context: 'create-tournament', priority: 5, position: 'bottom' },
    { id: 'ct-gsm', selector: '#btn-gsm-config', text: 'Configure sets, games e tiebreaks! Ideal para tênis, beach tennis, padel e vôlei.', context: 'create-tournament', priority: 7, position: 'bottom' },
    { id: 'ct-logo', selector: '#logo-preview', text: 'Gere uma logo automática para o torneio! Você também pode fazer upload da sua.', context: 'create-tournament', priority: 4, position: 'top' },
    { id: 'ct-public', selector: '#tourn-public', text: 'Torneio público aparece na aba Explorar — ótimo para atrair novos participantes!', context: 'create-tournament', priority: 5, position: 'top' },
    { id: 'ct-dates', selector: '#tourn-start-date', text: 'Defina datas de início e inscrição. Os participantes verão contagem regressiva nos cards!', context: 'create-tournament', priority: 5, position: 'bottom' },

    // ── Overlay: Invite Modal ──
    { id: 'inv-friends', selector: '[id^="invite-friends-btn"]', text: 'Envie convites para todos os seus amigos da plataforma com um clique!', context: 'invite-modal', priority: 8, position: 'bottom' },
    { id: 'inv-whatsapp', selector: '.btn-whatsapp', text: 'Compartilhe o convite direto no WhatsApp — ideal para grupos!', context: 'invite-modal', priority: 7, position: 'bottom' },
    { id: 'inv-link', selector: '.btn-primary', text: 'Copie o link e cole onde quiser: Instagram, Telegram, SMS...', context: 'invite-modal', priority: 7, position: 'bottom' },
    { id: 'inv-qr', selector: 'img[alt="QR Code"]', text: 'Projete ou mostre este QR Code no evento. Os jogadores escaneiam e se inscrevem na hora!', context: 'invite-modal', priority: 6, position: 'top' },
    { id: 'inv-email', selector: '[id^="invite-email"]', text: 'Digite o e-mail de quem quer convidar e envie diretamente.', context: 'invite-modal', priority: 5, position: 'top' },

    // ── Overlay: Power of 2 Panel ──
    { id: 'p2-nash', selector: '.p2-option', text: 'As cores indicam o equilíbrio de Nash: verde é a opção mais equilibrada, azul a menos. O percentual mostra o score.', context: 'p2-panel', priority: 9, position: 'top' },
    { id: 'p2-reopen', selector: '[onclick*="handleP2Option"][onclick*="reopen"]', text: 'Reabre as inscrições para completar a potência de 2 com novos participantes.', context: 'p2-panel', priority: 7, position: 'top' },
    { id: 'p2-bye', selector: '[onclick*="handleP2Option"][onclick*="bye"]', text: 'BYE: alguns participantes avançam direto para a 2ª rodada sem jogar.', context: 'p2-panel', priority: 7, position: 'top' },
    { id: 'p2-playin', selector: '[onclick*="handleP2Option"][onclick*="playin"]', text: 'Play-in: os excedentes disputam vagas numa rodada extra antes do chaveamento principal.', context: 'p2-panel', priority: 6, position: 'top' },
    { id: 'p2-swiss', selector: '[onclick*="handleP2Option"][onclick*="swiss"]', text: 'Formato Suíço: todos jogam várias rodadas antes de afunilar para os melhores classificados.', context: 'p2-panel', priority: 6, position: 'top' },
    { id: 'p2-poll', selector: '[onclick*="handleP2Option"][onclick*="poll"]', text: 'Enquete: deixe os participantes votarem na solução que preferem!', context: 'p2-panel', priority: 5, position: 'top' },

    // ── Overlay: Incomplete Teams Panel ──
    { id: 'it-nash', selector: '[onclick*="handleIncompleteOption"]', text: 'Cada opção tem um score de Nash indicando a solução mais equilibrada entre justiça, inclusão e praticidade.', context: 'incomplete-panel', priority: 9, position: 'top' },
    { id: 'it-reopen', selector: '[onclick*="handleIncompleteOption"][onclick*="reopen"]', text: 'Reabre inscrições para que novos jogadores completem os times.', context: 'incomplete-panel', priority: 7, position: 'top' },
    { id: 'it-lottery', selector: '[onclick*="handleIncompleteOption"][onclick*="lottery"]', text: 'Bots: preenche as vagas faltantes com nomes fictícios para completar times.', context: 'incomplete-panel', priority: 6, position: 'top' },
    { id: 'it-dissolve', selector: '[onclick*="handleIncompleteOption"][onclick*="dissolve"]', text: 'Ajuste Manual: reorganize jogadores entre times arrastando e soltando.', context: 'incomplete-panel', priority: 6, position: 'top' },

    // ── Overlay: Poll Creation ──
    { id: 'poll-create-deadline', selector: '#poll-deadline', text: 'Defina até quando os participantes podem votar. Após o prazo a enquete encerra automaticamente.', context: 'poll-creation', priority: 8, position: 'bottom' },
    { id: 'poll-create-options', selector: '[data-poll-option]', text: 'Marque as opções que deseja incluir na enquete. O badge Nash indica a mais equilibrada.', context: 'poll-creation', priority: 7, position: 'top' },

    // ── Overlay: Poll Voting ──
    { id: 'poll-vote', selector: '[onclick*="castPollVote"]', text: 'Escolha a opção que prefere. Você pode mudar seu voto até o encerramento da enquete.', context: 'poll-voting', priority: 9, position: 'top' },

    // ── Overlay: GSM Config ──
    { id: 'gsm-sets', selector: '#gsm-sets-to-win', text: 'Quantos sets para vencer a partida. Ex: tênis profissional usa 3, amador usa 1 ou 2.', context: 'gsm-config', priority: 8, position: 'bottom' },
    { id: 'gsm-games', selector: '#gsm-games-per-set', text: 'Games por set. Padrão 6 para tênis, 11 para tênis de mesa, 25 para vôlei.', context: 'gsm-config', priority: 7, position: 'bottom' },
    { id: 'gsm-tiebreak', selector: '#gsm-tiebreak-toggle', text: 'Ative o tiebreak para sets empatados. Comum em todos os esportes de raquete.', context: 'gsm-config', priority: 6, position: 'bottom' },
    { id: 'gsm-super-tb', selector: '#gsm-super-tb-toggle', text: 'Super tiebreak: o set decisivo é jogado em formato curto (10 pontos). Popular no beach tennis e duplas.', context: 'gsm-config', priority: 5, position: 'bottom' },

    // ── Overlay: Set Scoring ──
    { id: 'set-scoring-input', selector: '.set-score-row', text: 'Insira o placar de cada set. O sistema calcula automaticamente quem venceu a partida.', context: 'set-scoring', priority: 9, position: 'top' },

    // ── Bracket / Standings ──
    { id: 'bracket-zoom', selector: '.zoom-slider', text: 'Use o zoom para ver o chaveamento completo. Dica: arraste para navegar!', context: 'bracket', priority: 4, position: 'top' },
    { id: 'bracket-print', selector: '[onclick*="_printBracket"]', text: 'Imprima o chaveamento para colar na parede do evento!', context: 'bracket', priority: 3, position: 'top' },
    { id: 'bracket-export', selector: '[onclick*="_exportTournamentCSV"]', text: 'Exporte resultados em CSV para abrir no Excel ou Google Sheets.', context: 'bracket', priority: 3, position: 'top' },
    { id: 'standings-sort', selector: 'th[onclick*="_sortStandingsTable"]', text: 'Clique nos cabeçalhos da tabela para ordenar por qualquer coluna!', context: 'bracket', priority: 5, position: 'bottom' },
    { id: 'bracket-share', selector: '[onclick*="_shareMatchResult"]', text: 'Compartilhe o resultado de cada partida direto no WhatsApp!', context: 'bracket', priority: 4, position: 'top' },

    // ── Explore ──
    { id: 'explore-search', selector: '#explore-search', text: 'Busque por nome, esporte, formato ou cidade para encontrar torneios perto de você!', context: 'explore', priority: 6, position: 'bottom' },

    // ── Meta: teach user about hints ──
    { id: 'hints-meta', selector: '#btn-login', text: 'Essas dicas aparecem quando você fica parado. Para desativá-las, clique "Desativar dicas" aqui embaixo — ou reative no seu Perfil quando quiser.', context: 'global', priority: 2, position: 'bottom' }
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
    // Overlay contexts take priority — if a blocking overlay is open, use its context
    var _inviteOpen = document.querySelector('.invite-modal-container[style*="display: flex"], .invite-modal-container[style*="display:flex"]');
    if (_inviteOpen) return 'invite-modal';
    if (document.getElementById('unified-resolution-panel')) return 'p2-panel';
    if (document.getElementById('p2-resolution-panel')) return 'p2-panel';
    if (document.getElementById('incomplete-teams-panel')) return 'incomplete-panel';
    if (document.getElementById('poll-creation-dialog')) return 'poll-creation';
    if (document.getElementById('poll-voting-dialog')) return 'poll-voting';
    if (document.getElementById('gsm-config-overlay')) return 'gsm-config';
    if (document.getElementById('set-scoring-overlay')) return 'set-scoring';
    if (document.getElementById('dissolve-panel')) return 'dissolve-panel';
    if (document.getElementById('draw-visibility-dialog')) return 'draw-visibility';
    var ctModal = document.getElementById('modal-create-tournament');
    if (ctModal && ctModal.classList.contains('active')) return 'create-tournament';
    var qcModal = document.getElementById('modal-quick-create');
    if (qcModal && qcModal.classList.contains('active')) return 'create-tournament';

    var hash = window.location.hash || '#dashboard';
    if (hash.indexOf('#dashboard') === 0) return 'dashboard';
    if (hash.indexOf('#tournaments/') === 0 || hash.indexOf('#tournament/') === 0) return 'tournament-detail';
    if (hash.indexOf('#bracket/') === 0) return 'bracket';
    if (hash.indexOf('#explore') === 0) return 'explore';
    return 'dashboard';
  }

  function _isLoggedIn() {
    return !!(window.AppStore && window.AppStore.currentUser && window.AppStore.currentUser.email);
  }

  function _getUserPlan() {
    if (!window.AppStore || !window.AppStore.currentUser) return 'free';
    return window.AppStore.currentUser.plan || 'free';
  }

  // ── Known blocking overlay IDs ──────────────────────────────────────────────
  // These are full-screen fixed overlays (z-index 99999+) that cover the entire
  // viewport. When any of them is present, hints should only target elements
  // INSIDE the overlay, never elements on the background page.
  var _blockingOverlayIds = [
    'p2-resolution-panel',
    'incomplete-teams-panel',
    'dissolve-panel',
    'draw-visibility-dialog',
    'incomplete-team-dialog',
    'poll-creation-dialog',
    'poll-voting-dialog',
    'gsm-config-overlay',
    'set-scoring-overlay',
    'category-manager-overlay'
  ];

  // Returns the topmost blocking overlay element, or null if none is open.
  function _getBlockingOverlay() {
    for (var i = 0; i < _blockingOverlayIds.length; i++) {
      var el = document.getElementById(_blockingOverlayIds[i]);
      if (el) return el;
    }
    // Also check for any active modal-overlay (modals like create-tournament, help, profile)
    var modal = document.querySelector('.modal-overlay.active');
    if (modal) return modal;
    return null;
  }

  // ── Strict visibility check ────────────────────────────────────────────────
  // Element must: exist, have real dimensions, not be display:none,
  // not be inside a hidden parent, and be within the visible viewport.
  // If a blocking overlay is open, the element must be INSIDE it.
  function _isElementVisible(el) {
    if (!el) return false;
    // offsetParent is null for display:none or fixed elements
    // For fixed elements (topbar), check getComputedStyle
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    var rect = el.getBoundingClientRect();
    // Must have real dimensions
    if (rect.width === 0 && rect.height === 0) return false;

    // Must be within viewport (with small margin)
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (rect.bottom < -10 || rect.top > vh + 10) return false;
    if (rect.right < -10 || rect.left > vw + 10) return false;

    // BLOCKING OVERLAY CHECK: if an overlay is open, element must be inside it
    var blockingOverlay = _getBlockingOverlay();
    if (blockingOverlay) {
      if (!blockingOverlay.contains(el)) return false;
    }

    // Check that no ancestor is hidden (walk up max 10 levels)
    var parent = el.parentElement;
    var depth = 0;
    while (parent && depth < 10) {
      var ps = window.getComputedStyle(parent);
      if (ps.display === 'none' || ps.visibility === 'hidden') return false;
      // Check overflow:hidden + scroll position hiding the child
      if (ps.overflow === 'hidden' || ps.overflowY === 'hidden' || ps.overflowX === 'hidden') {
        var pRect = parent.getBoundingClientRect();
        // If element is completely outside parent's visible area
        if (rect.bottom < pRect.top || rect.top > pRect.bottom ||
            rect.right < pRect.left || rect.left > pRect.right) return false;
      }
      parent = parent.parentElement;
      depth++;
    }

    return true;
  }

  // ── Find first visible element matching selector ───────────────────────────
  function _findVisibleEl(selector) {
    // selector can have commas — try each part separately too
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      if (_isElementVisible(els[i])) return els[i];
    }
    return null;
  }

  // ── Pick next hint ─────────────────────────────────────────────────────────
  function _pickHint() {
    var ctx = _getCurrentContext();
    var loggedIn = _isLoggedIn();
    var plan = _getUserPlan();

    // Overlay contexts block global hints — only show hints for the overlay itself
    var _overlayContexts = ['p2-panel', 'incomplete-panel', 'poll-creation', 'poll-voting', 'gsm-config', 'set-scoring', 'dissolve-panel', 'draw-visibility', 'create-tournament', 'invite-modal'];
    var _isOverlay = _overlayContexts.indexOf(ctx) !== -1;

    var eligible = _hints.filter(function(h) {
      // In overlay context: only show hints matching that overlay, never global
      if (_isOverlay) { if (h.context !== ctx) return false; }
      // In page context: match context or global
      else if (h.context !== ctx && h.context !== 'global') return false;
      // Don't repeat the hint we just showed
      if (h.id === _lastHintId) return false;
      // Check login requirement
      if (h.requiresLogin && !loggedIn) return false;
      // Check logout requirement (hints only for non-logged users)
      if (h.requiresLogout && loggedIn) return false;
      // Check plan requirement
      if (h.requiresPlan && h.requiresPlan !== plan) return false;
      // STRICT: Must have a truly visible target element on screen
      var el = _findVisibleEl(h.selector);
      if (!el) return false;
      // Session limit: max 2 times per session
      if ((_sessionShown[h.id] || 0) >= 2) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    // Score: priority + freshness + strategic boost - session penalty + random jitter
    var scored = eligible.map(function(h) {
      var seenCount = _seenHints[h.id] || 0;
      var sessionCount = _sessionShown[h.id] || 0;
      var freshness = seenCount === 0 ? 5 : Math.max(0, 3 - seenCount);
      var stratBoost = h.strategic ? 3 : 0;
      var sessionPenalty = sessionCount * 5;
      var score = h.priority + freshness + stratBoost - sessionPenalty + (Math.random() * 3);
      return { hint: h, score: score };
    });

    scored.sort(function(a, b) { return b.score - a.score; });

    // Strategic boost roll
    if (!scored[0].hint.strategic) {
      var bestStrat = scored.find(function(s) { return s.hint.strategic; });
      if (bestStrat && Math.random() < STRATEGIC_BOOST) {
        return bestStrat.hint;
      }
    }

    return scored[0].hint;
  }

  // ── Show hint ──────────────────────────────────────────────────────────────
  function _showHint(hint) {
    var el = _findVisibleEl(hint.selector);
    if (!el) return;

    _activeHint = hint;
    _activeEl = el;
    _lastHintId = hint.id;

    // Add glow to target
    el.classList.add('hint-glow');

    // Create balloon
    var balloon = document.createElement('div');
    balloon.className = 'hint-balloon';
    balloon.setAttribute('data-hint-id', hint.id);
    balloon.innerHTML =
      '<div class="hint-balloon-arrow"></div>' +
      '<div class="hint-balloon-body">' +
        '<div class="hint-balloon-content">' +
          '<span class="hint-balloon-icon">' + (hint.strategic ? '💡' : '👋') + '</span>' +
          '<span class="hint-balloon-text">' + hint.text + '</span>' +
        '</div>' +
        '<div class="hint-balloon-actions">' +
          '<button class="hint-balloon-got-it">Entendi</button>' +
          '<button class="hint-balloon-disable">Desativar dicas</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(balloon);

    // Position balloon + arrow to point at element center
    _positionBalloon(balloon, el, hint.position || 'bottom');

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        balloon.classList.add('hint-balloon-visible');
      });
    });

    // Listeners
    balloon.querySelector('.hint-balloon-got-it').addEventListener('click', function(e) {
      e.stopPropagation();
      _dismissHint(true);
    }, { once: true });
    balloon.querySelector('.hint-balloon-disable').addEventListener('click', function(e) {
      e.stopPropagation();
      _disableHints();
    }, { once: true });

    // Click target = dismiss
    el.addEventListener('click', _onTargetClick, { once: true });

    // Auto-dismiss and queue next
    _autoDismissTimer = setTimeout(function() {
      if (_activeHint && _activeHint.id === hint.id) _dismissHint(true);
    }, HINT_DISPLAY_TIME);

    // Track
    _seenHints[hint.id] = (_seenHints[hint.id] || 0) + 1;
    _sessionShown[hint.id] = (_sessionShown[hint.id] || 0) + 1;
    _saveSeen();
  }

  // ── Position balloon relative to element ───────────────────────────────────
  function _positionBalloon(balloon, el, preferredPos) {
    var rect = el.getBoundingClientRect();
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var vh = window.innerHeight;
    var vw = window.innerWidth;

    // Decide actual position based on available space
    var pos = preferredPos;
    var spaceBelow = vh - rect.bottom;
    var spaceAbove = rect.top;
    var balloonHeight = 140; // estimated

    if (pos === 'bottom' && spaceBelow < balloonHeight && spaceAbove > balloonHeight) pos = 'top';
    if (pos === 'top' && spaceAbove < balloonHeight && spaceBelow > balloonHeight) pos = 'bottom';

    // Element center in page coordinates
    var elCenterX = rect.left + scrollX + rect.width / 2;
    var elCenterY = rect.top + scrollY + rect.height / 2;
    var arrowEl = balloon.querySelector('.hint-balloon-arrow');
    var margin = 10;

    balloon.style.position = 'absolute';
    balloon.style.zIndex = '100000';
    balloon.setAttribute('data-pos', pos);

    // Reset styles that may conflict between positions
    balloon.style.top = '';
    balloon.style.bottom = '';
    balloon.style.left = '';
    balloon.style.transform = '';

    if (pos === 'bottom') {
      balloon.style.top = (rect.bottom + scrollY + margin) + 'px';
      balloon.style.left = elCenterX + 'px';
      balloon.style.transform = 'translateX(-50%)';
      // Arrow at top of balloon, pointing up
      arrowEl.style.cssText = 'position:absolute;top:-6px;left:50%;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;';
    } else if (pos === 'top') {
      // Use top + translateY(-100%) so position works in page coords (survives scroll/resize)
      balloon.style.top = (rect.top + scrollY - margin) + 'px';
      balloon.style.left = elCenterX + 'px';
      balloon.style.transform = 'translate(-50%, -100%)';
      // Arrow at bottom of balloon, pointing down
      arrowEl.style.cssText = 'position:absolute;bottom:-6px;left:50%;transform:translateX(-50%) rotate(225deg);width:12px;height:12px;';
    } else if (pos === 'left') {
      balloon.style.top = elCenterY + 'px';
      balloon.style.left = (rect.left + scrollX - margin) + 'px';
      balloon.style.transform = 'translate(-100%, -50%)';
      arrowEl.style.cssText = 'position:absolute;right:-6px;top:50%;transform:translateY(-50%) rotate(135deg);width:12px;height:12px;';
    } else { // right
      balloon.style.top = elCenterY + 'px';
      balloon.style.left = (rect.right + scrollX + margin) + 'px';
      balloon.style.transform = 'translateY(-50%)';
      arrowEl.style.cssText = 'position:absolute;left:-6px;top:50%;transform:translateY(-50%) rotate(-45deg);width:12px;height:12px;';
    }

    // Apply arrow theme colors
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    var arrowBg = theme === 'light' ? '#ffffff' : theme === 'sunset' ? '#292018' : theme === 'ocean' ? '#1c3d5e' : '#1e293b';
    var arrowBorder = theme === 'light' ? 'rgba(37,99,235,0.35)' : theme === 'sunset' ? 'rgba(245,158,11,0.4)' : theme === 'ocean' ? 'rgba(34,211,238,0.4)' : 'rgba(251,191,36,0.4)';
    arrowEl.style.background = arrowBg;
    arrowEl.style.borderLeft = '1.5px solid ' + arrowBorder;
    arrowEl.style.borderTop = '1.5px solid ' + arrowBorder;

    // Clamp horizontally within viewport
    // Use translateY component based on position (top uses -100%, others don't)
    var translateY = pos === 'top' ? ', -100%' : '';
    requestAnimationFrame(function() {
      var bRect = balloon.getBoundingClientRect();
      if (bRect.right > vw - 8) {
        var overflow = bRect.right - vw + 16;
        balloon.style.transform = 'translate(calc(-50% - ' + overflow + 'px)' + translateY + ')';
        // Shift arrow to still point at element
        if (pos === 'bottom' || pos === 'top') {
          var arrowLeft = (rect.left + rect.width / 2) - bRect.left + overflow;
          arrowEl.style.left = Math.max(16, Math.min(bRect.width - 16, arrowLeft)) + 'px';
        }
      }
      if (bRect.left < 8) {
        var shift = 8 - bRect.left;
        balloon.style.transform = 'translate(calc(-50% + ' + shift + 'px)' + translateY + ')';
        if (pos === 'bottom' || pos === 'top') {
          var arrowLeft2 = (rect.left + rect.width / 2) - (bRect.left + shift);
          arrowEl.style.left = Math.max(16, Math.min(bRect.width - 16, arrowLeft2)) + 'px';
        }
      }
    });
  }

  // ── Reposition balloon on resize/scroll ─────────────────────────────────────
  var _repositionRAF = null;
  function _repositionActiveBalloon() {
    if (_repositionRAF) return; // throttle via rAF
    _repositionRAF = requestAnimationFrame(function() {
      _repositionRAF = null;
      if (!_activeHint || !_activeEl) return;
      var balloon = document.querySelector('.hint-balloon[data-hint-id="' + _activeHint.id + '"]');
      if (!balloon) return;
      // If the target element is no longer visible, dismiss
      if (!_isElementVisible(_activeEl)) {
        _dismissHint(true);
        return;
      }
      var pos = balloon.getAttribute('data-pos') || _activeHint.position || 'bottom';
      _positionBalloon(balloon, _activeEl, pos);
    });
  }

  window.addEventListener('resize', _repositionActiveBalloon, { passive: true });
  window.addEventListener('scroll', function() {
    if (!_activeHint || !_activeEl) return;
    // If target scrolled out of viewport, dismiss immediately
    if (!_isElementVisible(_activeEl)) {
      _dismissHint(true);
    } else {
      _repositionActiveBalloon();
    }
  }, { passive: true });

  // Dismiss hint on page navigation (hash change)
  window.addEventListener('hashchange', function() {
    if (_activeHint) _dismissHint(true);
  });

  function _onTargetClick() {
    _dismissHint(true);
  }

  // ── Dismiss ────────────────────────────────────────────────────────────────
  function _dismissHint(scheduleNext) {
    if (!_activeHint) return;
    var hintId = _activeHint.id;

    // Clear auto-dismiss timer
    clearTimeout(_autoDismissTimer);
    _autoDismissTimer = null;

    // Remove glow
    if (_activeEl) {
      _activeEl.classList.remove('hint-glow');
      _activeEl.removeEventListener('click', _onTargetClick);
    }

    // Animate out balloon
    var balloon = document.querySelector('.hint-balloon[data-hint-id="' + hintId + '"]');
    if (balloon) {
      balloon.classList.remove('hint-balloon-visible');
      balloon.style.opacity = '0';
      balloon.style.transition = 'opacity 0.25s ease';
      setTimeout(function() { if (balloon.parentNode) balloon.parentNode.removeChild(balloon); }, 300);
    }

    _activeHint = null;
    _activeEl = null;

    // Cooldown then restart idle timer for next hint
    _onCooldown = true;
    clearTimeout(_cooldownTimer);
    _cooldownTimer = setTimeout(function() {
      _onCooldown = false;
      // If scheduleNext, restart idle detection so more hints can appear
      if (scheduleNext && !_isDisabled()) {
        _resetIdleTimer();
      }
    }, HINT_COOLDOWN);
  }

  // ── Disable / Enable ──────────────────────────────────────────────────────
  function _disableHints() {
    _dismissHint(false);
    try { localStorage.setItem(LS_DISABLED_KEY, '1'); } catch (e) {}
    _stopIdleWatch();
    window.removeEventListener('resize', _repositionActiveBalloon);
    window.removeEventListener('scroll', _repositionActiveBalloon);
    if (typeof showNotification === 'function') {
      showNotification('Dicas Desativadas', 'Você pode reativar nas configurações do perfil.', 'info');
    }
  }

  function _enableHints() {
    try { localStorage.removeItem(LS_DISABLED_KEY); } catch (e) {}
    window.addEventListener('resize', _repositionActiveBalloon, { passive: true });
    window.addEventListener('scroll', _repositionActiveBalloon, { passive: true });
    _startIdleWatch();
    if (typeof showNotification === 'function') {
      showNotification('Dicas Ativadas', 'Dicas visuais aparecerão após alguns segundos de inatividade.', 'info');
    }
  }

  // ── Idle Detection ─────────────────────────────────────────────────────────
  // Any user interaction (scroll, click, typing) dismisses the current hint
  // and resets the idle timer.
  var _activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll', 'input'];

  function _resetIdleTimer() {
    clearTimeout(_idleTimer);
    // If a hint is showing and user interacts, dismiss it
    if (_activeHint) {
      _dismissHint(true);
      return;
    }
    if (_isDisabled() || _onCooldown) return;
    _idleTimer = setTimeout(_onIdle, IDLE_TIMEOUT);
  }

  function _onIdle() {
    if (_isDisabled() || _activeHint || _onCooldown) return;
    // Blocking overlay / modal detection is now handled inside _isElementVisible().
    // If an overlay is open, only hints targeting elements INSIDE that overlay
    // will pass the visibility check — background hints are automatically suppressed.

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
    _dismissHint(false);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function _init() {
    if (_initialized) return;
    _initialized = true;
    _loadSeen();
    // If hints were disabled but no hints were ever seen, re-enable (first-time UX)
    if (_isDisabled() && Object.keys(_seenHints).length === 0) {
      try { localStorage.removeItem(LS_DISABLED_KEY); } catch(e) {}
    }
    if (!_isDisabled()) {
      _startIdleWatch();
      console.log('[hints] system active, idle timeout=' + IDLE_TIMEOUT + 'ms');
    }
  }

  function _resetHints() {
    _seenHints = {};
    _sessionShown = {};
    _lastHintId = null;
    _saveSeen();
    if (typeof showNotification === 'function') {
      showNotification('Dicas Resetadas', 'Todas as dicas serão exibidas novamente.', 'info');
    }
  }

  // ── Force show a specific hint by id (used for post-creation scroll) ────────
  function _forceShowHint(hintId) {
    if (_isDisabled()) return;
    if (_activeHint) _dismissHint(false);
    var hint = _hints.find(function(h) { return h.id === hintId; });
    if (!hint) return;
    var el = _findVisibleEl(hint.selector);
    if (!el) return;
    _showHint(hint);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window._forceShowHint = _forceShowHint;
  window._hintSystem = {
    init: _init,
    enable: _enableHints,
    disable: _disableHints,
    reset: _resetHints,
    isDisabled: _isDisabled,
    dismiss: function() { _dismissHint(false); },
    forceShow: _forceShowHint
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_init, 2000); });
  } else {
    setTimeout(_init, 2000);
  }

  // Re-evaluate on hash change
  window.addEventListener('hashchange', function() {
    if (_activeHint) _dismissHint(false);
    _onCooldown = false;
    _lastHintId = null;
    clearTimeout(_cooldownTimer);
    _resetIdleTimer();
  });

})();
