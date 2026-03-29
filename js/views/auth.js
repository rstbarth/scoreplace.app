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
      // User is signed out — stop previous listener, load public tournaments
      if (window.AppStore) {
        window.AppStore.currentUser = null;
        if (window.AppStore.stopRealtimeListener) window.AppStore.stopRealtimeListener();
        // Start real-time listener for public tournaments only
        if (window.FirestoreDB && window.FirestoreDB.db) {
          window.AppStore._realtimeUnsubscribe = window.FirestoreDB.db.collection('tournaments')
            .where('isPublic', '==', true)
            .onSnapshot(function(snap) {
              var publicTournaments = [];
              snap.forEach(function(doc) { publicTournaments.push(doc.data()); });
              window.AppStore.tournaments = publicTournaments;
              window.AppStore._saveToCache();
              console.log('Public tournaments real-time:', publicTournaments.length);
              if (typeof initRouter === 'function') initRouter();
            }, function(err) {
              console.warn('Public tournaments listener error:', err);
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

  // Start real-time listener for tournaments (auto-updates on any change)
  if (window.AppStore.startRealtimeListener) {
    window.AppStore.startRealtimeListener();
  } else if (window.AppStore.loadFromFirestore) {
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
    btnLogin.style.flexWrap = 'nowrap';
    btnLogin.style.flexDirection = 'row';
    btnLogin.style.alignItems = 'center';

    var displayFirstName = user.displayName ? user.displayName.split(' ')[0] : 'Usuário';
    var photoUrl = user.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';

    btnLogin.innerHTML =
      '<div style="display:flex; align-items:center; justify-content:center; gap:8px;" title="Meu Perfil">' +
        '<img src="' + photoUrl + '" style="width:32px; height:32px; border-radius:50%; border: 2px solid var(--primary-color); object-fit:cover;">' +
        '<span class="user-name-label" style="font-weight:600; font-size:1rem;">' + displayFirstName + '</span>' +
      '</div>' +
      '<div title="Sair da Conta" class="logoff-btn" style="color: var(--danger-color); margin-left: 8px; display:flex; align-items:center; cursor:pointer; opacity: 0.8;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'">' +
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

    // Wait for tournaments to be loaded, then enroll
    var _enrollAttempts = 0;
    var _tryAutoEnroll = function() {
      _enrollAttempts++;
      var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(pendingEnrollId); });
      if (!t && _enrollAttempts < 20) {
        // Tournaments not loaded yet, retry
        setTimeout(_tryAutoEnroll, 300);
        return;
      }
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
    };
    setTimeout(_tryAutoEnroll, 300);
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

  // Stop real-time listener and clear AppStore state
  if (window.AppStore.stopRealtimeListener) window.AppStore.stopRealtimeListener();
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
          '<div style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 1.5rem;">' +
            '<div style="position: relative; cursor: pointer;" onclick="document.getElementById(\'avatar-picker\').style.display = document.getElementById(\'avatar-picker\').style.display === \'none\' ? \'grid\' : \'none\'" title="Clique para trocar o avatar">' +
              '<img id="profile-avatar" src="" style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid var(--primary-color); object-fit: cover; display: none;">' +
              '<div style="position: absolute; bottom: -2px; right: -2px; background: var(--primary-color); border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
              '</div>' +
            '</div>' +
            '<span style="font-size: 0.75rem; opacity: 0.6;">Toque para trocar</span>' +
            '<div id="avatar-picker" style="display: none; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 10px; background: var(--bg-darker); border-radius: 12px; border: 1px solid var(--border-color); max-width: 300px;">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Luna" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Mia" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Max" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Zoe" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Leo" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Nova" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Kai" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Rio" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
              '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Ace" style="width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border 0.2s;" onclick="window._selectAvatar(this.src)" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'transparent\'">' +
            '</div>' +
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
                '<option value="dark">🌙 Tema Escuro (Padrão)</option>' +
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

    window._selectAvatar = function(src) {
      document.getElementById('profile-avatar').src = src;
      document.getElementById('avatar-picker').style.display = 'none';
      if (window.AppStore.currentUser) {
        window.AppStore.currentUser.photoURL = src;
      }
    };

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

      // Update header UI with new name and photo
      var photoUrl = window.AppStore.currentUser.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var firstName = name ? name.split(' ')[0] : 'Usuário';
      var btnLogin = document.getElementById('btn-login');
      if (btnLogin) {
        // Find the avatar img and name span inside the button
        var avatarImg = btnLogin.querySelector('img');
        var nameSpan = btnLogin.querySelector('span[style*="font-weight"]');
        if (avatarImg) avatarImg.src = photoUrl;
        if (nameSpan) nameSpan.textContent = firstName;
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
