// Temas disponíveis: dark, light, sunset, ocean
var _validThemes = ['dark', 'light', 'sunset', 'ocean'];

function applyTheme(themeValue) {
  var activeTheme = themeValue;
  if (themeValue === 'auto') {
    var isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    activeTheme = isDarkMode ? 'dark' : 'light';
  }
  if (_validThemes.indexOf(activeTheme) === -1) activeTheme = 'dark';
  document.documentElement.setAttribute('data-theme', activeTheme);
}

// Chamar imediatamente para evitar FOUC
(function checkInitialTheme() {
  var pref = null;
  try { pref = localStorage.getItem('scoreplace_theme'); } catch(e) {}
  if (pref && _validThemes.indexOf(pref) !== -1) {
    document.documentElement.setAttribute('data-theme', pref);
  } else {
    var mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
  }
})();

// ─── i18n bootstrap: carrega APENAS o dict da lang ativa ──────────────────────
// Antes: index.html carregava ambos i18n-pt.js + i18n-en.js (~220KB total).
// Agora: theme.js (sync no <head>) detecta a lang preferida e injeta o script
// da lang correspondente com async=false (entra na fila de execução ordenada).
// Outras langs ficam disponíveis sob demanda via window._loadLang() em i18n.js.
//
// Por que aqui em theme.js: precisa ser o PRIMEIRO sync script no <head> pra
// que o browser comece o download dos dicts em paralelo com o resto. Inserir
// async=false faz o script entrar na lista "execute in order ASAP", garantindo
// ordem de execução antes dos parser-inserted defer scripts que consomem _t().
//
// Cache buster usa SCOREPLACE_VERSION quando disponível; fallback usa hardcoded
// que precisa ser bumpado a cada mudança nos dicts.
(function injectInitialI18n() {
  var SUPPORTED = { pt: 1, en: 1 };
  var DEFAULT = 'pt';
  var lang = DEFAULT;
  try {
    var stored = localStorage.getItem('scoreplace_lang');
    if (stored && SUPPORTED[stored]) {
      lang = stored;
    } else {
      var nav = ((navigator.language || navigator.userLanguage || '') + '').slice(0, 2).toLowerCase();
      if (SUPPORTED[nav]) lang = nav;
    }
  } catch (e) {}
  // Expõe a lang detectada pra que i18n.js valide (em vez de re-detectar).
  window._initialLang = lang;
  // Cache buster: precisa bater com o que index.html usa pros outros scripts.
  // Ao bumpar a versão dos dicts, atualizar AQUI também (não tem como ler do
  // index.html sync). Default seguro: usar versão atual do app.
  var v = '0.17.68';
  var s = document.createElement('script');
  s.src = 'js/i18n-' + lang + '.js?v=' + v;
  // async=false faz script-inserted scripts entrarem na fila ordenada,
  // alongside parser-inserted defer scripts. Garante execução antes de quem
  // consome _t().
  s.async = false;
  s.onerror = function () {
    // Fallback: tentar PT se EN falhar (e vice-versa). Sempre retorna algo
    // pra que _t() não devolva keys cruas.
    if (lang !== DEFAULT) {
      var fb = document.createElement('script');
      fb.src = 'js/i18n-' + DEFAULT + '.js?v=' + v;
      fb.async = false;
      document.head.appendChild(fb);
    }
  };
  document.head.appendChild(s);
})();
