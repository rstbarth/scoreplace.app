// ─── i18n: Internationalization infrastructure ─────────────────────────────
// Provides _t(key, params) for translated strings.
// Loaded BEFORE all view scripts so _t() is available everywhere.
(function() {
  'use strict';

  // Current language — default 'pt', persisted in localStorage
  window._lang = localStorage.getItem('scoreplace_lang') || 'pt';

  // Translation dictionaries keyed by language code
  // Populated by i18n-pt.js, i18n-en.js, etc.
  window._translations = {};

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
   * Switch language and re-render current view.
   * @param {string} lang - Language code ('pt', 'en')
   */
  window._setLang = function(lang) {
    if (!window._translations[lang]) {
      console.warn('[i18n] No translations for:', lang);
      return;
    }
    window._lang = lang;
    localStorage.setItem('scoreplace_lang', lang);
    // Update html lang attribute
    document.documentElement.setAttribute('lang', lang === 'pt' ? 'pt-BR' : lang);
    // Re-render current view
    if (typeof window.initRouter === 'function') {
      window.initRouter();
    }
  };
})();
