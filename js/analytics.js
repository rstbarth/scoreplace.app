// scoreplace.app — Analytics (GA4 via Firebase Analytics)
// v1.0.59-beta
//
// Wrapper minimalista em torno de `firebase.analytics()`. O measurementId
// (G-PZ25D36JSV) já vinha no firebaseConfig em auth.js — só precisamos
// inicializar o SDK e logar eventos. Dashboard fica em
// https://console.firebase.google.com/project/scoreplace-app/analytics
//
// Princípios:
//
// 1. **Sem PII nos eventos.** Nada de email, phone, displayName, IP. Apenas
//    metadados úteis pra cohort analysis: format de torneio, sport, plan
//    (free/pro), success/failure. user_id é o uid pseudonimizado do Firebase
//    (não tem o email atrás dele).
//
// 2. **Failsafe.** Toda chamada faz try/catch — analytics nunca pode quebrar
//    o app. Se o SDK não inicializou (script bloqueado, ad-blocker, browser
//    sem cookies), os eventos são silenciosamente descartados.
//
// 3. **API enxuta.** `_track(name, params)` pra eventos custom; helpers
//    nomeados (`_trackSignup`, `_trackTournamentCreated`, etc.) pros
//    eventos canônicos do nosso modelo de negócio. Helpers ajudam a
//    não digitar errado o nome do evento (GA4 trata "tournament_created"
//    e "tournamentCreated" como eventos diferentes — bug clássico).
//
// 4. **Eventos canônicos** (snake_case, ≤40 chars, ≤25 params cada):
//    - signup, login (param: method)
//    - tournament_created (params: format, sport, drawMode)
//    - casual_match_started, casual_match_finished
//    - presence_checkin (param: source = manual|auto_gps)
//    - venue_searched (param: query_len, results_count)
//    - friend_added
//    - pro_upgrade_clicked, pix_support_clicked
//    - free_tier_limit_hit (param: limit_type)
//
// LGPD: GA4 do Firebase respeita o consent mode. Como não coletamos PII
// e o app já tem aceite de Termos+Privacy obrigatório (modal), estamos
// cobertos. Caso saia do alpha pra produção real, considerar habilitar
// consent banner explícito.

(function () {
  'use strict';

  var _analytics = null;
  var _initAttempted = false;

  /**
   * Inicializa o SDK. Idempotente — pode chamar múltiplas vezes (ex: a cada
   * onAuthStateChanged) sem problema. Falha silenciosa se firebase não tiver
   * carregado ou analytics não estiver disponível (ad-blocker etc).
   */
  function _initAnalytics() {
    if (_initAttempted && _analytics) return _analytics;
    _initAttempted = true;
    try {
      if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
        return null;
      }
      if (typeof firebase.analytics !== 'function') {
        // SDK script não carregou (ad-blocker, network failure)
        return null;
      }
      _analytics = firebase.analytics();
      console.log('[scoreplace-analytics] initialized');
      return _analytics;
    } catch (e) {
      console.warn('[scoreplace-analytics] init failed:', e && e.message);
      return null;
    }
  }

  /**
   * Loga um evento custom. Sanitiza params (remove undefined/null, converte
   * todos os valores pra string|number|boolean — GA4 não aceita objetos).
   * NUNCA inclua PII (email, phone, displayName) em params.
   */
  function _track(eventName, params) {
    try {
      var a = _analytics || _initAnalytics();
      if (!a) return;
      var clean = {};
      if (params && typeof params === 'object') {
        Object.keys(params).forEach(function (k) {
          var v = params[k];
          if (v === undefined || v === null) return;
          if (typeof v === 'object') {
            try { clean[k] = JSON.stringify(v).slice(0, 100); } catch (_) {}
            return;
          }
          // GA4 limit: param values ≤100 chars
          clean[k] = typeof v === 'string' ? v.slice(0, 100) : v;
        });
      }
      a.logEvent(eventName, clean);
    } catch (e) {
      // Silent — analytics nunca quebra o app
    }
  }

  /**
   * Define user_id (uid pseudonimizado do Firebase) pra cohort/retention.
   * Chamar logo após simulateLoginSuccess. Sem email/phone — só uid.
   * Também seta user_properties com plan, locale e tier — GA4 permite
   * filtrar relatórios por essas dimensões.
   */
  function _identify(uid, props) {
    try {
      var a = _analytics || _initAnalytics();
      if (!a) return;
      if (uid) a.setUserId(String(uid));
      if (props && typeof props === 'object') {
        var clean = {};
        Object.keys(props).forEach(function (k) {
          var v = props[k];
          if (v === undefined || v === null) return;
          if (typeof v === 'object') return; // GA4 user_properties só aceita primitivos
          clean[k] = typeof v === 'string' ? v.slice(0, 36) : v;
        });
        if (Object.keys(clean).length > 0) a.setUserProperties(clean);
      }
    } catch (_) {}
  }

  // ─── Helpers de eventos canônicos ────────────────────────────────────────

  function _trackSignup(method) {
    _track('signup', { method: method || 'unknown' });
  }

  function _trackLogin(method) {
    _track('login', { method: method || 'unknown' });
  }

  function _trackTournamentCreated(t) {
    _track('tournament_created', {
      format: t && t.format,
      sport: t && t.sport,
      draw_mode: t && t.drawMode,
      enrollment_mode: t && t.enrollmentMode,
      is_public: t ? !!t.isPublic : false
    });
  }

  function _trackCasualMatchStarted(opts) {
    _track('casual_match_started', {
      sport: opts && opts.sport,
      team_size: opts && opts.teamSize
    });
  }

  function _trackCasualMatchFinished(opts) {
    _track('casual_match_finished', {
      sport: opts && opts.sport,
      duration_min: opts && opts.durationMin
    });
  }

  function _trackPresenceCheckin(source, sportsCount) {
    _track('presence_checkin', {
      source: source || 'manual',
      sports_count: sportsCount || 1
    });
  }

  function _trackVenueSearched(query, resultsCount) {
    _track('venue_searched', {
      query_len: query ? String(query).length : 0,
      results_count: resultsCount || 0
    });
  }

  function _trackFriendAdded() {
    _track('friend_added', {});
  }

  function _trackProUpgradeClicked(source) {
    _track('pro_upgrade_clicked', { source: source || 'unknown' });
  }

  function _trackPixSupportClicked() {
    _track('pix_support_clicked', {});
  }

  function _trackFreeTierLimitHit(limitType) {
    _track('free_tier_limit_hit', { limit_type: limitType || 'unknown' });
  }

  // Page views são auto-trackeadas pelo GA4. Mas SPA com hash routing às
  // vezes precisa de hint manual. Ver router.js — chama _trackPageView no
  // handleRoute após render, com o nome da view (não o hash crú, que pode
  // ter parâmetros sensíveis tipo ?ref=uid).
  function _trackPageView(viewName) {
    _track('page_view', {
      page_title: viewName || 'unknown',
      page_location: window.location.origin + '/#' + (viewName || '')
    });
  }

  // ─── Exposição global ────────────────────────────────────────────────────
  window._initAnalytics = _initAnalytics;
  window._track = _track;
  window._identify = _identify;
  window._trackSignup = _trackSignup;
  window._trackLogin = _trackLogin;
  window._trackTournamentCreated = _trackTournamentCreated;
  window._trackCasualMatchStarted = _trackCasualMatchStarted;
  window._trackCasualMatchFinished = _trackCasualMatchFinished;
  window._trackPresenceCheckin = _trackPresenceCheckin;
  window._trackVenueSearched = _trackVenueSearched;
  window._trackFriendAdded = _trackFriendAdded;
  window._trackProUpgradeClicked = _trackProUpgradeClicked;
  window._trackPixSupportClicked = _trackPixSupportClicked;
  window._trackFreeTierLimitHit = _trackFreeTierLimitHit;
  window._trackPageView = _trackPageView;
})();
