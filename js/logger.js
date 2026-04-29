// scoreplace.app — Centralized logger wrapper
//
// Define window._log / _warn / _error / _debug compatíveis com console.log.
// Em desenvolvimento (localhost), passa direto pro console (mesmo comportamento).
// Em produção (hostname=scoreplace.app), silencia _log e _debug por default,
// mantém _warn/_error visíveis no console, e envia breadcrumbs pra Sentry
// (quando DSN estiver plugada — ver js/sentry-init.js).
//
// USO (não-bloqueante — call-sites antigos com console.log direto continuam
// funcionando):
//
//   window._log('foo', objeto);          // dev: console.log; prod: silenciado
//   window._warn('algo suspeito', err);  // sempre console.warn + breadcrumb
//   window._error('falhou:', err);       // sempre console.error + breadcrumb
//   window._debug('verbose state');      // dev: console.debug; prod: silenciado
//
// FORÇAR DEBUG EM PROD:
//   localStorage.setItem('scoreplace_debug', '1');  // numa aba qualquer
//   location.reload();
//
// Esse flag também ativa logs do AppStore/router/etc se eles passarem a usar
// o wrapper.

(function () {
  // Detecta se estamos em produção
  var isProd = location.hostname === 'scoreplace.app';
  // Permite forçar debug em prod via localStorage
  var forceDebug = false;
  try {
    forceDebug = localStorage.getItem('scoreplace_debug') === '1';
  } catch (e) {}
  var quietDebug = isProd && !forceDebug;

  // Detecta o Sentry pra enviar breadcrumbs quando disponível
  function _sendBreadcrumb(level, args) {
    if (!window.Sentry || typeof window.Sentry.addBreadcrumb !== 'function') return;
    try {
      // Concatena os args num message (preserva info útil mesmo serializado)
      var msg = Array.prototype.map.call(args, function (a) {
        if (a == null) return String(a);
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a).slice(0, 200); } catch (e) { return String(a); }
      }).join(' ');
      window.Sentry.addBreadcrumb({
        category: 'app',
        level: level, // 'debug' | 'info' | 'warning' | 'error'
        message: msg.slice(0, 500),
        timestamp: Date.now() / 1000
      });
    } catch (e) {
      // Nunca quebra o fluxo do app se breadcrumb falhar
    }
  }

  // _log / _debug: silenciados em prod (sem flag debug)
  window._log = function () {
    if (!quietDebug) {
      // eslint-disable-next-line no-console
      console.log.apply(console, arguments);
    }
    _sendBreadcrumb('info', arguments);
  };

  window._debug = function () {
    if (!quietDebug) {
      // eslint-disable-next-line no-console
      console.debug.apply(console, arguments);
    }
    _sendBreadcrumb('debug', arguments);
  };

  // _warn / _error: sempre visíveis no console + breadcrumb
  window._warn = function () {
    // eslint-disable-next-line no-console
    console.warn.apply(console, arguments);
    _sendBreadcrumb('warning', arguments);
  };

  window._error = function () {
    // eslint-disable-next-line no-console
    console.error.apply(console, arguments);
    _sendBreadcrumb('error', arguments);
  };

  // Expor um snapshot do modo atual pra debug
  window._loggerMode = isProd ? (forceDebug ? 'prod-debug' : 'prod-quiet') : 'dev';
})();
