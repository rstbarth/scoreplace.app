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

// v0.17.70: REVERTIDA a injeção dinâmica do dict i18n da v0.17.68. A teoria
// (script-inserted async=false executa antes dos parser-defers) NÃO funcionou
// na prática — em alguns casos o dict carregava DEPOIS de IIFEs como
// setupCreateTournamentModal, que constroem HTML com _t() ao boot. Resultado:
// keys cruas tipo 'create.nameLabel' baked no HTML do modal, persistindo até
// o próximo reload. O modal Novo Torneio ficou inutilizável (screenshot do
// usuário em 2026-04-29).
// Os dicts i18n-pt.js e i18n-en.js voltaram pra index.html como parser-defers,
// garantindo ordering correto. Custo: ~107KB raw / ~30KB gzipped a mais no
// boot pra usuários PT (que era o ganho da v0.17.68). Trade-off aceito —
// ordering correto > economia de bytes que Lighthouse não estava capturando.
