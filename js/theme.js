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
