// ========================================
// scoreplace.app — Firebase Auth + Firestore Init
// ========================================
// Project: scoreplace-app (Firebase Console)

const firebaseConfig = {
  apiKey: "AIzaSyB7AyOojV_Pm50Kr7bovVY4jVTTNbKOK0A",
  authDomain: "scoreplace-app.firebaseapp.com",
  projectId: "scoreplace-app",
  storageBucket: "scoreplace-app.firebasestorage.app",
  messagingSenderId: "382268772878",
  appId: "1:382268772878:web:7c164933f3beacba4be25f",
  measurementId: "G-PZ25D36JSV"
};

// Initialize Firebase + Firestore
let authProvider = null;
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    authProvider = new firebase.auth.GoogleAuthProvider();
  }
  // Initialize Firestore
  if (window.FirestoreDB) {
    window.FirestoreDB.init();
  }
} catch (e) {
  console.warn("Firebase initialization error:", e);
}

// Listen for auth state changes to auto-login returning users
if (firebase && firebase.auth) {
  firebase.auth().onAuthStateChanged(async function(user) {
    if (user) {
      // User is signed in — load data from Firestore and update UI
      await simulateLoginSuccess({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    } else {
      // User is signed out — clear user but load public tournaments
      if (window.AppStore) {
        window.AppStore.currentUser = null;
        // Load public tournaments so non-logged-in users can browse them
        if (window.FirestoreDB && window.FirestoreDB.db) {
          window.FirestoreDB.db.collection('tournaments').where('isPublic', '==', true).get().then(function(snap) {
            var publicTournaments = [];
            snap.forEach(function(doc) { publicTournaments.push(doc.data()); });
            window.AppStore.tournaments = publicTournaments;
            console.log('Public tournaments loaded:', publicTournaments.length);
            if (typeof initRouter === 'function') initRouter();
          }).catch(function(err) {
            console.warn('Error loading public tournaments:', err);
            window.AppStore.tournaments = [];
          });
        } else {
          window.AppStore.tournaments = [];
        }
      }
    }
  });
}

function handleGoogleLogin() {
  var isLocalFile = window.location.protocol === 'file:';

  if (isLocalFile) {
    // Offline/Local development mode - simulate login
    showNotification('Autenticação Simulada', 'Login com Google simulado localmente.', 'info');
    simulateLoginSuccess({
      uid: 'local_user',
      displayName: 'Organizador Teste',
      email: 'organizador@scoreplace.app',
      photoURL: 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix'
    });
    return;
  }

  // Real Firebase authentication
  if (!authProvider) {
    showNotification('Erro', 'Firebase não foi inicializado corretamente.', 'error');
    return;
  }

  showNotification('Conectando...', 'Abrindo popup do Google...', 'info');
  firebase.auth().signInWithPopup(authProvider)
    .then(function(result) {
      var user = result.user;
      showNotification('Login Realizado', 'Bem-vindo(a), ' + user.displayName + '!', 'success');
      // onAuthStateChanged will handle the rest
    })
    .catch(function(error) {
      console.error('Firebase auth error:', error);
      if (error.code === 'auth/popup-blocked') {
        showNotification('Popup Bloqueado', 'Permita popups para este site nas configurações do navegador.', 'error');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User cancelled, no need for error
      } else {
        showNotification('Erro no Auth', 'Não foi possível realizar o login com Google.', 'error');
      }
    });
}

async function simulateLoginSuccess(user) {
  // Set AppStore.currentUser with the user object
  window.AppStore.currentUser = user;

  // Load user profile from Firestore (merge extra fields like gender, sports)
  var uid = user.uid || user.email;
  if (window.AppStore.loadUserProfile) {
    await window.AppStore.loadUserProfile(uid);
  }

  // Load tournaments from Firestore
  if (window.AppStore.loadFromFirestore) {
    await window.AppStore.loadFromFirestore();
  }

  // Update the topbar button with user avatar and name
  var btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.className = 'd-flex align-center';
    btnLogin.style.background = 'transparent';
    btnLogin.style.border = 'none';
    btnLogin.style.padding = '0';
    btnLogin.style.color = 'var(--text-main)';
    btnLogin.style.cursor = 'pointer';

    var displayFirstName = user.displayName ? user.displayName.split(' ')[0] : 'Usuário';
    var photoUrl = user.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';

    btnLogin.innerHTML =
      '<div style="display:flex; align-items:center; justify-content:center; gap:8px;" title="Meu Perfil">' +
        '<img src="' + photoUrl + '" style="width:32px; height:32px; border-radius:50%; border: 2px solid var(--primary-color); object-fit:cover;">' +
        '<span style="font-weight:600; font-size:1rem;">' + displayFirstName + '</span>' +
      '</div>' +
      '<div title="Sair da Conta" style="color: var(--danger-color); margin-left: 12px; display:flex; align-items:center; cursor:pointer; opacity: 0.8;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
      '</div>';

    // Clone and replace to clear old event listeners
    var newBtn = btnLogin.cloneNode(true);
    btnLogin.parentNode.replaceChild(newBtn, btnLogin);

    // Add click handler for profile modal
    newBtn.addEventListener('click', function(e) {
      if (e.target.closest('[title="Sair da Conta"]')) {
        e.stopPropagation();
        handleLogout();
      } else {
        document.getElementById('profile-avatar').src = photoUrl;
        document.getElementById('profile-avatar').style.display = 'block';

        var cu = window.AppStore.currentUser;
        document.getElementById('profile-edit-name').value = cu.displayName || 'Usuário';
        document.getElementById('profile-edit-gender').value = cu.gender || '';
        document.getElementById('profile-edit-sports').value = cu.preferredSports || '';
        document.getElementById('profile-edit-category').value = cu.defaultCategory || '';

        if (typeof openModal === 'function') openModal('modal-profile');
      }
    });
  }

  // Set view mode to organizer
  window.AppStore.viewMode = 'organizer';
  var viewModeBtn = document.getElementById('view-mode-selector');
  if (viewModeBtn) viewModeBtn.innerHTML = '👁️ Visão: Organizador';

  // Update visibility of view mode selector
  if (typeof window.updateViewModeVisibility === 'function') {
    window.updateViewModeVisibility();
  }

  // Close login modal
  var modal = document.getElementById('modal-login');
  if (modal) modal.classList.remove('active');

  // Auto-enroll if there was a pending enrollment
  var pendingEnrollId = window._pendingEnrollTournamentId || null;
  try {
    if (!pendingEnrollId) pendingEnrollId = sessionStorage.getItem('_pendingEnrollTournamentId');
  } catch(e) {}

  if (pendingEnrollId) {
    window._pendingEnrollTournamentId = null;
    try { sessionStorage.removeItem('_pendingEnrollTournamentId'); } catch(e) {}

    // Wait a tick for tournaments to be loaded, then enroll
    setTimeout(function() {
      var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(pendingEnrollId); });
      if (t && window.AppStore.currentUser) {
        var arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
        var already = arr.some(function(p) {
          var str = typeof p === 'string' ? p : (p.email || p.displayName);
          return str && (str.includes(window.AppStore.currentUser.email) || str.includes(window.AppStore.currentUser.displayName));
        });
        if (!already) {
          arr.push({ name: window.AppStore.currentUser.displayName, email: window.AppStore.currentUser.email, displayName: window.AppStore.currentUser.displayName });
          t.participants = arr;
          // Save directly to Firestore (sync only saves organizer's tournaments)
          if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Auto-enroll save error:', err); });
          }
          if (typeof showNotification !== 'undefined') {
            showNotification('Inscrito!', 'Voc\u00EA foi inscrito automaticamente no torneio "' + t.name + '".', 'success');
          }
        }
      }
      // Navigate to tournament page
      window.location.hash = '#tournaments/' + pendingEnrollId;
      if (typeof initRouter === 'function') initRouter();
    }, 300);
    return;
  }

  // Redirect to pending invite tournament if there was one
  if (window._pendingInviteHash) {
    var dest = window._pendingInviteHash;
    window._pendingInviteHash = null;
    window.location.hash = dest;
  }

  // Initialize router to load appropriate views
  if (typeof initRouter === 'function') initRouter();
}

function setupLoginModal() {
  if (!document.getElementById('modal-login')) {
    var modalHtml = '<div class="modal-overlay" id="modal-login">' +
      '<div class="modal" style="max-width: 400px;">' +
        '<div class="modal-header">' +
          '<h2 class="card-title">Acessar scoreplace.app</h2>' +
          '<button class="modal-close" onclick="document.getElementById(\'modal-login\').classList.remove(\'active\')">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p class="text-muted mb-4">Acesse sua conta para organizar ou participar de campeonatos.</p>' +
          '<div style="margin-bottom: 1.5rem;">' +
            '<button type="button" class="btn btn-primary full-width" onclick="handleGoogleLogin()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12s4.5 10 10 10 10-4.5 10-10z"></path></svg>' +
              'Entrar com Google' +
            '</button>' +
          '</div>' +
          '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1.5rem;">' +
            '<div style="flex: 1; height: 1px; background: var(--border-color);"></div>' +
            '<span style="color: var(--text-muted); font-size: 0.875rem;">ou</span>' +
            '<div style="flex: 1; height: 1px; background: var(--border-color);"></div>' +
          '</div>' +
          '<form id="form-login" onsubmit="event.preventDefault(); showAlertDialog(\'Em Breve\', \'Login por e-mail será implementado em breve.\', function() { }, { type: \'info\' })">' +
            '<div class="form-group">' +
              '<label class="form-label">E-mail</label>' +
              '<input type="email" class="form-control" placeholder="seu@email.com" required>' +
            '</div>' +
            '<div class="form-group mb-4">' +
              '<label class="form-label">Senha</label>' +
              '<input type="password" class="form-control" placeholder="••••••••" required>' +
            '</div>' +
            '<button type="submit" class="btn btn-secondary full-width" style="opacity: 0.6; cursor: not-allowed;">Entrar com E-mail (Em Breve)</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(createInteractiveElement(modalHtml));
  }

  var btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', function() {
      openModal('modal-login');
    });
  }
}

function handleLogout() {
  // Sign out from Firebase
  if (firebase && firebase.auth) {
    firebase.auth().signOut().catch(function(error) {
      console.error('Firebase sign out error:', error);
    });
  }

  // Clear AppStore state
  window.AppStore.currentUser = null;
  window.AppStore.tournaments = [];
  window.AppStore.viewMode = 'participant';

  // Update topbar button to show Login button
  var btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.innerHTML = 'Login';
    btnLogin.className = 'btn btn-outline';
    btnLogin.style = 'padding: 0.5rem 1rem;';
    var newBtn = btnLogin.cloneNode(true);
    btnLogin.parentNode.replaceChild(newBtn, btnLogin);
    newBtn.addEventListener('click', function() { openModal('modal-login'); });
  }

  // Close profile modal if open
  var modalProfile = document.getElementById('modal-profile');
  if (modalProfile) modalProfile.classList.remove('active');

  // Update view mode visibility
  if (typeof window.updateViewModeVisibility === 'function') {
    window.updateViewModeVisibility();
  }

  // Show notification and reinitialize router
  showNotification('Sessão Encerrada', 'Você saiu da sua conta', 'info');
  if (typeof initRouter === 'function') initRouter();
}

function setupProfileModal() {
  if (!document.getElementById('modal-profile')) {
    var modalHtml = '<div class="modal-overlay" id="modal-profile">' +
      '<div class="modal" style="max-width: 400px; max-height: 90vh; overflow-y: auto;">' +
        '<div class="modal-header">' +
          '<h2 class="card-title">Opções do Perfil</h2>' +
          '<button class="modal-close" onclick="document.getElementById(\'modal-profile\').classList.remove(\'active\')">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 1.5rem;">' +
          '<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 1.5rem; justify-content: center;">' +
            '<img id="profile-avatar" src="" style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid var(--primary-color); object-fit: cover; display: none;">' +
          '</div>' +
          '<form id="form-edit-profile" onsubmit="event.preventDefault(); saveUserProfile()">' +
            '<div class="form-group mb-3">' +
              '<label class="form-label">Nome de Usuário</label>' +
              '<input type="text" id="profile-edit-name" class="form-control full-width" required>' +
            '</div>' +
            '<div class="form-group mb-3">' +
              '<label class="form-label">Sexo</label>' +
              '<select id="profile-edit-gender" class="form-control full-width">' +
                '<option value="">Não informar</option>' +
                '<option value="M">Masculino</option>' +
                '<option value="F">Feminino</option>' +
                '<option value="Outro">Outro</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group mb-3">' +
              '<label class="form-label">Esportes Preferidos (Opcional)</label>' +
              '<input type="text" id="profile-edit-sports" class="form-control full-width" placeholder="Ex: Tênis, Padel">' +
            '</div>' +
            '<div class="form-group mb-3">' +
              '<label class="form-label">Categoria Padrão (Opcional)</label>' +
              '<input type="text" id="profile-edit-category" class="form-control full-width" placeholder="Ex: C, Iniciante">' +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1.5rem 0;"></div>' +
            '<div class="form-group text-left" style="margin-bottom: 1.5rem;">' +
              '<label class="form-label" style="display: block; text-align: left; font-weight: 600; margin-bottom: 0.75rem;">Aparência da Plataforma</label>' +
              '<select id="theme-selector" class="form-control full-width" style="padding: 0.75rem; cursor: pointer; background: var(--bg-darker); border: 1px solid var(--border-color);" title="Alterar Tema">' +
                '<option value="auto">💻 Tema Auto (Sistema)</option>' +
                '<option value="dark">🌙 Tema Antigravity (Padrão)</option>' +
                '<option value="light">☀️ Modo Claro (Light)</option>' +
                '<option value="high-contrast">👁️ Alto Contraste</option>' +
                '<option value="alternative">🎨 Alternativo (Catppuccin)</option>' +
              '</select>' +
            '</div>' +
            '<div style="display: flex; gap: 10px; margin-top: 1.5rem;">' +
              '<button type="submit" class="btn btn-primary" style="flex: 1;">Salvar Perfil</button>' +
              '<button type="button" class="btn btn-outline" onclick="handleLogout()" style="border-color: var(--danger-color); color: var(--danger-color); background: transparent; flex: 1;">Sair da Conta</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(createInteractiveElement(modalHtml));

    window.saveUserProfile = async function() {
      if (!window.AppStore.currentUser) return;
      var name = document.getElementById('profile-edit-name').value.trim();
      var gender = document.getElementById('profile-edit-gender').value;
      var sports = document.getElementById('profile-edit-sports').value.trim();
      var category = document.getElementById('profile-edit-category').value.trim();

      if (name) {
        window.AppStore.currentUser.displayName = name;
        window.AppStore.currentUser.name = name;
      }
      window.AppStore.currentUser.gender = gender;
      window.AppStore.currentUser.preferredSports = sports;
      window.AppStore.currentUser.defaultCategory = category;

      // Save profile to Firestore
      if (window.AppStore.saveUserProfileToFirestore) {
        await window.AppStore.saveUserProfileToFirestore();
      }

      // Update header UI
      var btnLogin = document.getElementById('btn-login');
      if (btnLogin && name) {
        btnLogin.innerHTML =
          '<div style="display: flex; align-items: center; gap: 8px;">' +
            '<div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">' +
              name.charAt(0).toUpperCase() +
            '</div>' +
            '<span>' + name + '</span>' +
          '</div>';
      }

      document.getElementById('modal-profile').classList.remove('active');
      if (typeof showNotification !== 'undefined') showNotification('Perfil Atualizado', 'Suas informações foram salvas com sucesso.', 'success');

      // Trigger a re-render if we're on the dashboard
      var container = document.getElementById('view-container');
      if (container && window.location.hash.includes('dashboard') && typeof renderDashboard === 'function') {
        renderDashboard(container);
      }
    };
  }
}
