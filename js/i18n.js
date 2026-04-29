// ─── i18n: Internationalization infrastructure ─────────────────────────────
// Provides _t(key, params) for translated strings.
// Loaded BEFORE all view scripts so _t() is available everywhere.
//
// Lazy loading (v0.17.68): só o dict da lang ativa é carregado no boot,
// via injeção dinâmica em theme.js. _loadLang() abaixo carrega outros dicts
// sob demanda — chamado por _setLang() quando usuário troca idioma.
(function() {
  'use strict';

  // Current language — default 'pt'. Resolução de lang acontece em theme.js
  // (window._initialLang). Aqui usamos esse valor como fonte da verdade pra
  // não duplicar lógica (e pra que o dict carregado seja o que estamos usando).
  window._lang = window._initialLang || localStorage.getItem('scoreplace_lang') || 'pt';

  // Translation dictionaries keyed by language code
  // Populated por i18n-pt.js, i18n-en.js carregados sob demanda
  window._translations = window._translations || {};

  // Tracking de loads em voo pra evitar dupla injeção
  var _loadingPromises = {};
  var _LANG_CACHE_BUSTER = '0.17.70'; // bumpar quando dicts mudarem

  /**
   * Translate a key, with optional parameter interpolation.
   * @param {string} key - Dot-notation key (e.g. 'dashboard.title')
   * @param {Object} [params] - Interpolation values (e.g. {name: 'Ana'})
   * @returns {string} Translated string, or the key itself as fallback
   */
  window._t = function(key, params) {
    var dict = window._translations[window._lang];
    var str = (dict && dict[key]) || key;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function(k) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return str;
  };

  /**
   * Carrega dinamicamente o dict de uma lang se ainda não estiver carregado.
   * @param {string} lang - 'pt' ou 'en'
   * @returns {Promise<boolean>} true quando o dict estiver disponível, false em erro
   */
  window._loadLang = function(lang) {
    if (window._translations[lang]) return Promise.resolve(true);
    if (_loadingPromises[lang]) return _loadingPromises[lang];
    _loadingPromises[lang] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'js/i18n-' + lang + '.js?v=' + _LANG_CACHE_BUSTER;
      s.async = true;
      s.onload = function () {
        delete _loadingPromises[lang];
        resolve(!!window._translations[lang]);
      };
      s.onerror = function () {
        delete _loadingPromises[lang];
        if (typeof window._warn === 'function') {
          window._warn('[i18n] Falha ao carregar dict:', lang);
        } else {
          console.warn('[i18n] Falha ao carregar dict:', lang);
        }
        resolve(false);
      };
      document.head.appendChild(s);
    });
    return _loadingPromises[lang];
  };

  /**
   * Switch language and re-render current view. Carrega o dict sob demanda
   * se ainda não foi carregado (caso o usuário vá de pt → en pela primeira vez).
   * @param {string} lang - Language code ('pt', 'en')
   */
  window._setLang = function(lang) {
    if (!lang) return;
    var apply = function () {
      window._lang = lang;
      try { localStorage.setItem('scoreplace_lang', lang); } catch (e) {}
      document.documentElement.setAttribute('lang', lang === 'pt' ? 'pt-BR' : lang);
      if (typeof window.initRouter === 'function') {
        window.initRouter();
      }
    };
    if (window._translations[lang]) {
      apply();
    } else {
      window._loadLang(lang).then(function (ok) {
        if (ok) apply();
        else if (typeof window._warn === 'function') {
          window._warn('[i18n] Lang requested but failed to load:', lang);
        }
      });
    }
  };
})();
