// scoreplace.app — Sentry observability bootstrap (boilerplate inativo até plugar DSN)
//
// COMO ATIVAR:
// 1. Crie um projeto em https://sentry.io e copie o DSN público (https://...@o000.ingest.sentry.io/000).
// 2. No `index.html`, ANTES da tag <script src="js/sentry-init.js">, adicione:
//      <script>window.SENTRY_DSN = "https://SEU_DSN_AQUI";</script>
//    (Não commitar DSN em PR's pra ambientes de teste — usar localStorage abaixo.)
//
// COMO ATIVAR EM DEV (sem commitar DSN):
//   localStorage.setItem('scoreplace_sentry_dsn', 'https://SEU_DSN');  // numa aba qualquer
//
// SEM DSN: o módulo é silencioso. Nenhuma rede, nenhum console.log. Apenas
// expõe `window._captureException` e `window._captureMessage` como no-ops
// pra que callers possam chamar sem checar disponibilidade.
//
// Buffer pré-init: errors que acontecem ANTES do Sentry SDK carregar são
// guardados num array e drenados quando o SDK terminar de carregar.

(function () {
  // ── 1. Resolver DSN (window > localStorage > nada) ─────────────────────────
  var DSN = (typeof window.SENTRY_DSN === 'string' && window.SENTRY_DSN) || '';
  if (!DSN) {
    try { DSN = localStorage.getItem('scoreplace_sentry_dsn') || ''; } catch (e) {}
  }

  // ── 2. Helpers no-op (sempre exportados, mesmo sem DSN) ────────────────────
  // Buffer de events que acontecem antes do SDK carregar
  var _preInitBuffer = [];
  var _sdkReady = false;

  window._captureException = function (err, ctx) {
    if (!DSN) return;
    if (_sdkReady && window.Sentry) {
      window.Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
    } else {
      _preInitBuffer.push({ kind: 'exception', err: err, ctx: ctx });
    }
  };

  window._captureMessage = function (msg, level) {
    if (!DSN) return;
    if (_sdkReady && window.Sentry) {
      window.Sentry.captureMessage(msg, level || 'info');
    } else {
      _preInitBuffer.push({ kind: 'message', msg: msg, level: level });
    }
  };

  // Sem DSN — sai limpo. Os no-ops acima já estão ativos.
  if (!DSN) return;

  // ── 3. Capturar erros DO MOMENTO ZERO até o SDK carregar ───────────────────
  // window.onerror handler temporário que enche o buffer. Quando o SDK
  // termina de carregar e drena o buffer, o handler nativo do Sentry assume.
  var _origOnError = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    _preInitBuffer.push({ kind: 'onerror', msg: msg, src: src, line: line, col: col, err: err });
    if (typeof _origOnError === 'function') return _origOnError.apply(this, arguments);
    return false;
  };

  var _origOnRejection = window.onunhandledrejection;
  window.onunhandledrejection = function (event) {
    _preInitBuffer.push({ kind: 'rejection', reason: event && event.reason });
    if (typeof _origOnRejection === 'function') return _origOnRejection.apply(this, arguments);
  };

  // ── 4. Carregar o SDK CDN async ────────────────────────────────────────────
  // Sentry browser bundle (compatível com vanilla JS, sem ES Modules)
  // v0.17.81: hash SRI corrigido (computado via openssl dgst -sha384 do
  // arquivo CDN). O hash anterior era inventado e bloqueava silenciosamente
  // o load do SDK no browser, deixando observability inativa apesar da DSN
  // estar configurada. Validar hash sempre que bumpar a versão do SDK.
  var SDK_URL = 'https://browser.sentry-cdn.com/8.45.0/bundle.tracing.min.js';
  var SDK_INTEGRITY = 'sha384-2v8OMaiLyo5IQ6yjyGhZ8db0RBrxRo/GmWZE2FR+b1H7WCLNM8rUbYEX7G2g7n7+';

  var s = document.createElement('script');
  s.src = SDK_URL;
  s.integrity = SDK_INTEGRITY;
  s.crossOrigin = 'anonymous';
  s.async = true;
  s.onload = function () {
    if (!window.Sentry) return;
    try {
      window.Sentry.init({
        dsn: DSN,
        release: 'scoreplace@' + (window.SCOREPLACE_VERSION || 'unknown'),
        environment: (location.hostname === 'scoreplace.app' ? 'production' : 'preview'),
        // Beta-readiness: 100% errors mas baixa amostragem de transações (custo).
        sampleRate: 1.0,
        tracesSampleRate: 0.05,
        // Reduzir noise — ignorar erros conhecidos do ecosistema Firebase / extensions
        ignoreErrors: [
          /Non-Error promise rejection captured/i,
          /ResizeObserver loop limit exceeded/i,
          /ResizeObserver loop completed/i,
          /Network request failed/i,            // Firestore offline transitório
          /Failed to fetch/i,                   // browser extensions, ad blockers
          /chrome-extension:\/\//i,
          /moz-extension:\/\//i
        ],
        beforeSend: function (event) {
          // Tag útil pra agrupar issues por área do app
          var hash = (location.hash || '').replace('#', '').split('/')[0] || 'dashboard';
          event.tags = event.tags || {};
          event.tags.route = hash;
          // Anonimização: jamais enviar email/displayName ao Sentry
          if (event.user) {
            delete event.user.email;
            delete event.user.username;
          }
          return event;
        }
      });

      // Drenar buffer pré-init
      _sdkReady = true;
      while (_preInitBuffer.length > 0) {
        var ev = _preInitBuffer.shift();
        try {
          if (ev.kind === 'exception') {
            window.Sentry.captureException(ev.err, ev.ctx ? { extra: ev.ctx } : undefined);
          } else if (ev.kind === 'message') {
            window.Sentry.captureMessage(ev.msg, ev.level || 'info');
          } else if (ev.kind === 'onerror') {
            window.Sentry.captureException(ev.err || new Error(String(ev.msg)), {
              extra: { src: ev.src, line: ev.line, col: ev.col }
            });
          } else if (ev.kind === 'rejection') {
            window.Sentry.captureException(ev.reason || new Error('Unhandled promise rejection'));
          }
        } catch (drainErr) {
          // never break the page — silent fail
        }
      }
    } catch (initErr) {
      console.warn('[Sentry] init failed:', initErr);
    }
  };
  s.onerror = function () {
    // SDK falhou em carregar — buffer fica órfão (e libera GC ao próximo refresh)
    console.warn('[Sentry] CDN load failed; observability disabled this session');
  };
  document.head.appendChild(s);
})();
