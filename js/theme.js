function initThemeSystem() {
  const themeSelector = document.getElementById('theme-selector');
  
  // 1. Load Preference
  const savedTheme = localStorage.getItem('scoreplace_theme_pref') || 'auto';
  if(themeSelector) {
     themeSelector.value = savedTheme;
  }
  
  applyTheme(savedTheme);

  // Listener do System Scheme (dispara quando a config do SO muda)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
     if(localStorage.getItem('scoreplace_theme_pref') === 'auto' || !localStorage.getItem('scoreplace_theme_pref')) {
        applyTheme('auto');
     }
  });

  // Listener manual do dropdown
  if(themeSelector) {
     themeSelector.addEventListener('change', (e) => {
         const newTheme = e.target.value;
         localStorage.setItem('scoreplace_theme_pref', newTheme);
         applyTheme(newTheme);
         // Aqui adicionaremos lógica para salvar no Perfil do Firebase Logado posteriormente
     });
  }
}

function applyTheme(themeValue) {
  let activeTheme = themeValue;
  
  if (themeValue === 'auto') {
     const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
     activeTheme = isDarkMode ? 'dark' : 'light';
  }

  // Aplica o dataset no document root
  document.documentElement.setAttribute('data-theme', activeTheme);
}

// Chamar imediatamente para evitar FOUC
(function checkInitialTheme() {
   const pref = localStorage.getItem('scoreplace_theme_pref');
   if(pref) { 
      let t = pref;
      if (t === 'auto') { t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
      document.documentElement.setAttribute('data-theme', t);
   } else {
      const mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', mode);
   }
})();
