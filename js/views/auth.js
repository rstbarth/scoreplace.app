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
    authProvider.addScope('https://www.googleapis.com/auth/user.gender.read');
    authProvider.addScope('https://www.googleapis.com/auth/user.birthday.read');
    authProvider.addScope('https://www.googleapis.com/auth/user.addresses.read');
    authProvider.addScope('https://www.googleapis.com/auth/user.phonenumbers.read');
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

      // Tenta buscar o gênero do Google via People API
      var credential = result.credential;
      if (credential && credential.accessToken) {
        _fetchGoogleDemographics(credential.accessToken, user.uid || user.email);
      }
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

// Busca dados demográficos do Google via People API e salva no Firestore
function _fetchGoogleDemographics(accessToken, uid) {
  fetch('https://people.googleapis.com/v1/people/me?personFields=genders,birthdays,ageRanges,locales,addresses,phoneNumbers', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (!window.AppStore.currentUser) return;
    var profileUpdates = {};

    // Gênero
    if (data.genders && data.genders.length > 0) {
      var googleGender = data.genders[0].value;
      var genderMap = { 'male': 'masculino', 'female': 'feminino', 'unspecified': '' };
      var genderPt = genderMap[googleGender] || '';
      if (genderPt && !window.AppStore.currentUser.gender) {
        window.AppStore.currentUser.gender = genderPt;
        profileUpdates.gender = genderPt;
        console.log('Gênero do Google detectado:', genderPt);
      }
    }

    // Data de nascimento e idade
    if (data.birthdays && data.birthdays.length > 0) {
      var bd = data.birthdays[0].date;
      if (bd && bd.year && bd.month && bd.day) {
        var birthDateStr = bd.year + '-' + String(bd.month).padStart(2, '0') + '-' + String(bd.day).padStart(2, '0');
        if (!window.AppStore.currentUser.birthDate) {
          window.AppStore.currentUser.birthDate = birthDateStr;
          profileUpdates.birthDate = birthDateStr;
          // Calcula idade
          var today = new Date();
          var birthDate = new Date(bd.year, bd.month - 1, bd.day);
          var age = today.getFullYear() - birthDate.getFullYear();
          var monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
          window.AppStore.currentUser.age = age;
          profileUpdates.age = age;
          console.log('Idade do Google detectada:', age);
        }
      }
    }

    // Localidade/idioma
    if (data.locales && data.locales.length > 0) {
      var locale = data.locales[0].value;
      if (locale && !window.AppStore.currentUser.locale) {
        window.AppStore.currentUser.locale = locale;
        profileUpdates.locale = locale;
      }
    }

    // Endereço/cidade
    if (data.addresses && data.addresses.length > 0) {
      var addr = data.addresses[0];
      if (addr.city && !window.AppStore.currentUser.city) {
        window.AppStore.currentUser.city = addr.city;
        profileUpdates.city = addr.city;
      }
      if (addr.region && !window.AppStore.currentUser.state) {
        window.AppStore.currentUser.state = addr.region;
        profileUpdates.state = addr.region;
      }
      if (addr.country && !window.AppStore.currentUser.country) {
        window.AppStore.currentUser.country = addr.country;
        profileUpdates.country = addr.country;
      }
    }

    // Telefone
    if (data.phoneNumbers && data.phoneNumbers.length > 0) {
      var rawPhone = data.phoneNumbers[0].canonicalForm || data.phoneNumbers[0].value || '';
      var digits = rawPhone.replace(/\D/g, '');
      if (digits && !window.AppStore.currentUser.phone) {
        // Detecta código do país
        var countryCode = '55'; // default Brasil
        if (digits.length > 11 && digits.startsWith('55')) {
          countryCode = '55';
          digits = digits.substring(2);
        } else if (digits.length > 10 && digits.startsWith('1')) {
          countryCode = '1';
          digits = digits.substring(1);
        } else if (rawPhone.startsWith('+')) {
          // Tenta extrair código do país do número original
          var intlDigits = rawPhone.replace(/\D/g, '');
          if (intlDigits.length > 11) {
            countryCode = intlDigits.substring(0, intlDigits.length - 11);
            digits = intlDigits.substring(countryCode.length);
          }
        }
        window.AppStore.currentUser.phone = digits;
        window.AppStore.currentUser.phoneCountry = countryCode;
        profileUpdates.phone = digits;
        profileUpdates.phoneCountry = countryCode;
        console.log('Telefone do Google detectado:', countryCode, digits);
      }
    }

    // Salva no Firestore se houve atualizações
    if (Object.keys(profileUpdates).length > 0 && window.FirestoreDB && window.FirestoreDB.db && uid) {
      window.FirestoreDB.saveUserProfile(uid, profileUpdates).catch(function(err) {
        console.warn('Erro ao salvar dados demográficos:', err);
      });
    }
  })
  .catch(function(err) {
    console.log('People API (demográficos) não disponível:', err.message || err);
  });
}

// Auto-amizade quando alguém aceita convite de torneio (com ?ref=UID no link)
function _autoFriendOnInvite(inviterUid, currentUser) {
  if (!inviterUid || !currentUser || !window.FirestoreDB || !window.FirestoreDB.db) return;
  var myUid = currentUser.uid || currentUser.email;
  if (inviterUid === myUid) return; // Não se auto-adicionar

  // Verifica se já são amigos
  var myFriends = currentUser.friends || [];
  if (myFriends.indexOf(inviterUid) !== -1) return;

  // Torna amigos mutuamente (sem necessidade de aceite — veio via convite)
  window.FirestoreDB.db.collection('users').doc(myUid).set({
    friends: firebase.firestore.FieldValue.arrayUnion(inviterUid)
  }, { merge: true });
  window.FirestoreDB.db.collection('users').doc(inviterUid).set({
    friends: firebase.firestore.FieldValue.arrayUnion(myUid)
  }, { merge: true });

  // Remove convites pendentes entre eles se houver
  window.FirestoreDB.db.collection('users').doc(myUid).set({
    friendRequestsReceived: firebase.firestore.FieldValue.arrayRemove(inviterUid),
    friendRequestsSent: firebase.firestore.FieldValue.arrayRemove(inviterUid)
  }, { merge: true });
  window.FirestoreDB.db.collection('users').doc(inviterUid).set({
    friendRequestsReceived: firebase.firestore.FieldValue.arrayRemove(myUid),
    friendRequestsSent: firebase.firestore.FieldValue.arrayRemove(myUid)
  }, { merge: true });

  // Atualiza estado local
  if (!currentUser.friends) currentUser.friends = [];
  currentUser.friends.push(inviterUid);

  // Notifica quem convidou
  window.FirestoreDB.addNotification(inviterUid, {
    type: 'friend_accepted',
    fromUid: myUid,
    fromName: currentUser.displayName || '',
    fromPhoto: currentUser.photoURL || '',
    fromEmail: currentUser.email || '',
    message: (currentUser.displayName || 'Alguém') + ' aceitou seu convite e agora é seu amigo(a)!',
    createdAt: new Date().toISOString(),
    read: false
  });

  console.log('Auto-amizade via convite entre', myUid, 'e', inviterUid);
}

async function simulateLoginSuccess(user) {
  // Set AppStore.currentUser with the user object
  window.AppStore.currentUser = user;

  // Load user profile from Firestore (merge extra fields like gender, sports)
  var uid = user.uid || user.email;
  var existingProfile = null;
  if (window.AppStore.loadUserProfile) {
    existingProfile = await window.AppStore.loadUserProfile(uid);
  }

  // Migrate legacy doc: if user has a doc keyed by email, merge it into the UID doc
  if (window.FirestoreDB && window.FirestoreDB.db && uid && user.email && uid !== user.email) {
    try {
      var legacyDoc = await window.FirestoreDB.db.collection('users').doc(user.email).get();
      if (legacyDoc.exists) {
        var legacyData = legacyDoc.data();
        // Merge legacy data into UID doc (friends, requests, etc.)
        var mergeData = {};
        if (legacyData.friends && legacyData.friends.length > 0) mergeData.friends = firebase.firestore.FieldValue.arrayUnion.apply(null, legacyData.friends);
        if (legacyData.friendRequestsReceived && legacyData.friendRequestsReceived.length > 0) mergeData.friendRequestsReceived = firebase.firestore.FieldValue.arrayUnion.apply(null, legacyData.friendRequestsReceived);
        if (legacyData.friendRequestsSent && legacyData.friendRequestsSent.length > 0) mergeData.friendRequestsSent = firebase.firestore.FieldValue.arrayUnion.apply(null, legacyData.friendRequestsSent);
        // Copy profile fields if not already set
        if (legacyData.displayName && (!existingProfile || !existingProfile.displayName)) mergeData.displayName = legacyData.displayName;
        if (legacyData.photoURL && (!existingProfile || !existingProfile.photoURL)) mergeData.photoURL = legacyData.photoURL;
        if (Object.keys(mergeData).length > 0) {
          mergeData.email = user.email;
          await window.FirestoreDB.db.collection('users').doc(uid).set(mergeData, { merge: true });
        }
        // Update all other users who reference the old email ID in their friends/requests
        var allUsers = await window.FirestoreDB.db.collection('users').get();
        var batch = window.FirestoreDB.db.batch();
        var batchCount = 0;
        allUsers.forEach(function(doc) {
          if (doc.id === user.email || doc.id === uid) return;
          var d = doc.data();
          var ref = window.FirestoreDB.db.collection('users').doc(doc.id);
          var updates = {};
          if (d.friends && d.friends.indexOf(user.email) !== -1) {
            updates.friends = firebase.firestore.FieldValue.arrayUnion(uid);
            batch.update(ref, { friends: firebase.firestore.FieldValue.arrayRemove(user.email) });
            batchCount++;
          }
          if (d.friendRequestsSent && d.friendRequestsSent.indexOf(user.email) !== -1) {
            updates.friendRequestsSent = firebase.firestore.FieldValue.arrayUnion(uid);
            batch.update(ref, { friendRequestsSent: firebase.firestore.FieldValue.arrayRemove(user.email) });
            batchCount++;
          }
          if (d.friendRequestsReceived && d.friendRequestsReceived.indexOf(user.email) !== -1) {
            updates.friendRequestsReceived = firebase.firestore.FieldValue.arrayUnion(uid);
            batch.update(ref, { friendRequestsReceived: firebase.firestore.FieldValue.arrayRemove(user.email) });
            batchCount++;
          }
          if (Object.keys(updates).length > 0) {
            batch.update(ref, updates);
            batchCount++;
          }
        });
        if (batchCount > 0) await batch.commit();
        // Delete the legacy doc
        await window.FirestoreDB.db.collection('users').doc(user.email).delete();
        console.log('Migrated legacy user doc from', user.email, 'to', uid);
        // Reload profile after migration
        if (window.AppStore.loadUserProfile) {
          existingProfile = await window.AppStore.loadUserProfile(uid);
        }
      }
    } catch (e) {
      console.warn('Legacy doc migration error:', e);
    }
  }

  // Auto-save basic Google data to Firestore if profile is missing or has no displayName
  if (window.FirestoreDB && window.FirestoreDB.db && uid) {
    var needsSave = false;
    var basicData = {};
    if (!existingProfile || !existingProfile.displayName) {
      if (user.displayName) { basicData.displayName = user.displayName; needsSave = true; }
    }
    if (!existingProfile || !existingProfile.email) {
      if (user.email) { basicData.email = user.email; needsSave = true; }
    }
    if (!existingProfile || !existingProfile.photoURL) {
      if (user.photoURL) { basicData.photoURL = user.photoURL; needsSave = true; }
    }
    if (needsSave) {
      basicData.updatedAt = new Date().toISOString();
      window.FirestoreDB.saveUserProfile(uid, basicData).catch(function(err) {
        console.warn('Erro ao salvar dados básicos do Google:', err);
      });
    }
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
        document.getElementById('profile-edit-birthdate').value = cu.birthDate || '';
        document.getElementById('profile-edit-city').value = cu.city || '';
        document.getElementById('profile-edit-sports').value = cu.preferredSports || '';
        document.getElementById('profile-edit-category').value = cu.defaultCategory || '';

        // Phone: set country + formatted display
        var phoneCountrySel = document.getElementById('profile-phone-country');
        var phoneInput = document.getElementById('profile-edit-phone');
        if (phoneCountrySel && cu.phoneCountry) phoneCountrySel.value = cu.phoneCountry;
        if (phoneInput && cu.phone) {
          var digits = (cu.phone || '').replace(/\D/g, '');
          phoneInput.setAttribute('data-digits', digits);
          phoneInput.value = _formatPhoneDisplay(digits, phoneCountrySel ? phoneCountrySel.value : '55');
        }

        // Toggle buttons: set state
        var toggles = [
          { id: 'profile-accept-friends', val: cu.acceptFriendRequests !== false },
          { id: 'profile-notify-platform', val: cu.notifyPlatform !== false },
          { id: 'profile-notify-email', val: cu.notifyEmail !== false },
          { id: 'profile-notify-whatsapp', val: cu.notifyWhatsApp !== false }
        ];
        toggles.forEach(function(t) {
          var btn = document.getElementById(t.id);
          if (btn) {
            btn.setAttribute('data-on', t.val ? '1' : '0');
            var onStyle = { background: 'var(--primary-color)', color: '#fff', borderColor: 'var(--primary-color)' };
            var offStyle = { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border-color)' };
            Object.assign(btn.style, t.val ? onStyle : offStyle);
            var dot = btn.querySelector('span');
            if (dot) {
              dot.style.background = t.val ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';
              dot.textContent = t.val ? '\u2713' : '';
            }
          }
        });

        if (typeof openModal === 'function') openModal('modal-profile');
      }
    });
  }

  // Update notification badge
  if (typeof _updateNotificationBadge === 'function') {
    _updateNotificationBadge();
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

  // Extrair ?ref= do hash (quem convidou)
  var _inviteRefUid = null;
  try {
    var _hashFull = window.location.hash || '';
    var _refMatch = _hashFull.match(/[?&]ref=([^&]+)/);
    if (_refMatch) _inviteRefUid = decodeURIComponent(_refMatch[1]);
    // Também checar sessionStorage (salvo pelo router)
    if (!_inviteRefUid) _inviteRefUid = sessionStorage.getItem('_inviteRefUid');
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

          // Auto-amizade: com quem convidou (ref) ou com o organizador como fallback
          if (_inviteRefUid) {
            _autoFriendOnInvite(_inviteRefUid, window.AppStore.currentUser);
            try { sessionStorage.removeItem('_inviteRefUid'); } catch(e) {}
          } else if (t.organizerEmail && window.FirestoreDB && window.FirestoreDB.db) {
            // Sem ref — fazer amizade com o organizador do torneio
            window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
              if (!snap.empty) {
                _autoFriendOnInvite(snap.docs[0].id, window.AppStore.currentUser);
              }
            }).catch(function(e) { console.warn('Auto-friend org lookup error:', e); });
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

// === Helpers para máscara de telefone ===
var _phoneCountries = [
  { code: '55', flag: '\uD83C\uDDE7\uD83C\uDDF7', name: 'Brasil', mask: '(##) #####-####' },
  { code: '1', flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'EUA', mask: '(###) ###-####' },
  { code: '351', flag: '\uD83C\uDDF5\uD83C\uDDF9', name: 'Portugal', mask: '### ### ###' },
  { code: '54', flag: '\uD83C\uDDE6\uD83C\uDDF7', name: 'Argentina', mask: '## ####-####' },
  { code: '598', flag: '\uD83C\uDDFA\uD83C\uDDFE', name: 'Uruguai', mask: '## ### ###' },
  { code: '595', flag: '\uD83C\uDDF5\uD83C\uDDFE', name: 'Paraguai', mask: '### ### ###' },
  { code: '56', flag: '\uD83C\uDDE8\uD83C\uDDF1', name: 'Chile', mask: '# #### ####' },
  { code: '57', flag: '\uD83C\uDDE8\uD83C\uDDF4', name: 'Colômbia', mask: '### ### ####' },
  { code: '34', flag: '\uD83C\uDDEA\uD83C\uDDF8', name: 'Espanha', mask: '### ## ## ##' },
  { code: '44', flag: '\uD83C\uDDEC\uD83C\uDDE7', name: 'UK', mask: '#### ### ####' }
];

function _formatPhoneDisplay(digits, countryCode) {
  var country = _phoneCountries.find(function(c) { return c.code === countryCode; });
  if (!country || !digits) return digits || '';
  var mask = country.mask;
  var result = '';
  var di = 0;
  for (var i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === '#') {
      result += digits[di];
      di++;
    } else {
      result += mask[i];
    }
  }
  return result;
}

function _setupPhoneMask(inputEl, countryCode) {
  inputEl.addEventListener('input', function() {
    var raw = this.value.replace(/\D/g, '');
    this.setAttribute('data-digits', raw);
    this.value = _formatPhoneDisplay(raw, countryCode || '55');
  });
  inputEl.addEventListener('keydown', function(e) {
    // Allow backspace to work naturally on formatted input
    if (e.key === 'Backspace' && this.selectionStart === this.selectionEnd) {
      var pos = this.selectionStart;
      if (pos > 0 && /\D/.test(this.value[pos - 1])) {
        // Skip over separator chars
        e.preventDefault();
        var raw = (this.getAttribute('data-digits') || '').slice(0, -1);
        this.setAttribute('data-digits', raw);
        var cc = document.getElementById('profile-phone-country');
        this.value = _formatPhoneDisplay(raw, cc ? cc.value : '55');
      }
    }
  });
}

// Toggle button helper — replaces checkboxes with friendly pill toggles
// Optional customColor (hex) for on-state, optional icon (emoji/symbol)
function _toggleBtnHtml(id, label, checked, customColor, icon) {
  var onBg = customColor || 'var(--primary-color)';
  var onBorder = customColor || 'var(--primary-color)';
  var onStyle = 'background: ' + onBg + '; color: #fff; border-color: ' + onBorder + ';';
  var offStyle = 'background: transparent; color: var(--text-muted); border-color: var(--border-color);';
  var iconHtml = icon ? '<span style="font-size: 0.95rem; flex-shrink: 0;">' + icon + '</span>' : '';
  return '<button type="button" id="' + id + '" data-on="' + (checked ? '1' : '0') + '" ' +
    'data-color="' + (customColor || '') + '" ' +
    'style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 6px; border-radius: 10px; border: 1.5px solid; font-size: 0.78rem; font-weight: 500; cursor: pointer; transition: all 0.2s; width: 100%; text-align: center; box-sizing: border-box; ' +
    (checked ? onStyle : offStyle) + '" ' +
    'onclick="_toggleProfileBtn(this)">' +
    iconHtml +
    '<span>' + label + '</span>' +
  '</button>';
}

window._toggleProfileBtn = function(btn) {
  var isOn = btn.getAttribute('data-on') === '1';
  var customColor = btn.getAttribute('data-color') || '';
  var onBg = customColor || 'var(--primary-color)';
  var onBorder = customColor || 'var(--primary-color)';
  var onStyle = { background: onBg, color: '#fff', borderColor: onBorder };
  var offStyle = { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border-color)' };
  if (isOn) {
    btn.setAttribute('data-on', '0');
    Object.assign(btn.style, offStyle);
  } else {
    btn.setAttribute('data-on', '1');
    Object.assign(btn.style, onStyle);
  }
};

function setupProfileModal() {
  if (!document.getElementById('modal-profile')) {
    // Country select options
    var countryOpts = _phoneCountries.map(function(c) {
      return '<option value="' + c.code + '">' + c.flag + ' +' + c.code + '</option>';
    }).join('');

    var modalHtml = '<div class="modal-overlay" id="modal-profile">' +
      '<div class="modal" style="max-width: 520px; max-height: 90vh; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; width: calc(100% - 2rem);">' +
        '<div class="modal-header" style="position: sticky; top: 0; z-index: 2; background: var(--bg-card); padding-bottom: 0.5rem;">' +
          '<h2 class="card-title">Meu Perfil</h2>' +
          '<button class="modal-close" onclick="document.getElementById(\'modal-profile\').classList.remove(\'active\')">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 1rem 1.25rem; overflow-x: hidden;">' +
          // Avatar row
          '<div style="display: flex; align-items: center; gap: 14px; margin-bottom: 1.25rem;">' +
            '<div style="position: relative; cursor: pointer; flex-shrink: 0;" onclick="document.getElementById(\'avatar-picker\').style.display = document.getElementById(\'avatar-picker\').style.display === \'none\' ? \'grid\' : \'none\'" title="Trocar avatar">' +
              '<img id="profile-avatar" src="" style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid var(--primary-color); object-fit: cover; display: none;">' +
              '<div style="position: absolute; bottom: -2px; right: -2px; background: var(--primary-color); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">' +
                '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
              '</div>' +
            '</div>' +
            '<div style="flex: 1; min-width: 0;">' +
              '<label class="form-label" style="font-size: 0.75rem; margin-bottom: 2px;">Nome</label>' +
              '<input type="text" id="profile-edit-name" class="form-control" style="width: 100%; box-sizing: border-box;" required>' +
            '</div>' +
          '</div>' +
          '<div id="avatar-picker" style="display: none; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 10px; background: var(--bg-darker); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 1rem; max-width: 100%; box-sizing: border-box;">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Luna" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Mia" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Max" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Zoe" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Leo" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Nova" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Kai" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Rio" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
            '<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Ace" style="width:40px;height:40px;border-radius:50%;cursor:pointer;border:2px solid transparent;" onclick="window._selectAvatar(this.src)">' +
          '</div>' +
          '<form id="form-edit-profile" onsubmit="event.preventDefault(); saveUserProfile()" style="overflow: hidden;">' +
            // Row: Sexo + Nascimento (2 colunas)
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">Sexo</label>' +
                '<select id="profile-edit-gender" class="form-control" style="width: 100%; box-sizing: border-box;">' +
                  '<option value="">Não informar</option>' +
                  '<option value="masculino">Masculino</option>' +
                  '<option value="feminino">Feminino</option>' +
                  '<option value="outro">Outro</option>' +
                '</select>' +
              '</div>' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">Nascimento</label>' +
                '<input type="date" id="profile-edit-birthdate" class="form-control" style="width: 100%; box-sizing: border-box;">' +
              '</div>' +
            '</div>' +
            // Row: Cidade + Categoria (2 colunas)
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">Cidade</label>' +
                '<input type="text" id="profile-edit-city" class="form-control" style="width: 100%; box-sizing: border-box;" placeholder="Ex: São Paulo">' +
              '</div>' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">Categoria</label>' +
                '<input type="text" id="profile-edit-category" class="form-control" style="width: 100%; box-sizing: border-box;" placeholder="Ex: C, Iniciante">' +
              '</div>' +
            '</div>' +
            // Esportes Preferidos (linha inteira)
            '<div class="form-group" style="margin-bottom: 10px;">' +
              '<label class="form-label" style="font-size: 0.75rem;">Esportes Preferidos</label>' +
              '<input type="text" id="profile-edit-sports" class="form-control" style="width: 100%; box-sizing: border-box;" placeholder="Ex: Tênis, Padel, Beach Tennis">' +
            '</div>' +
            // Telefone: País + Número
            '<div class="form-group" style="margin-bottom: 10px;">' +
              '<label class="form-label" style="font-size: 0.75rem;">WhatsApp</label>' +
              '<div style="display: flex; gap: 6px;">' +
                '<select id="profile-phone-country" class="form-control" style="width: 120px; flex-shrink: 0; box-sizing: border-box; font-size: 0.85rem;" onchange="var inp=document.getElementById(\'profile-edit-phone\'); var d=inp.getAttribute(\'data-digits\')||\'\'; inp.value=_formatPhoneDisplay(d,this.value);">' +
                  countryOpts +
                '</select>' +
                '<input type="tel" id="profile-edit-phone" class="form-control" style="flex: 1; min-width: 0; box-sizing: border-box;" placeholder="(11) 99723-7733" data-digits="">' +
              '</div>' +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            // Social toggle
            '<div style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.8rem;">Social</label>' +
              _toggleBtnHtml('profile-accept-friends', 'Aceitar convites de amizade', true) +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            // Notification toggles
            '<div style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.8rem;">Notificações</label>' +
              '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">' +
                _toggleBtnHtml('profile-notify-platform', 'Plataforma', true, null, '\uD83D\uDD14') +
                _toggleBtnHtml('profile-notify-email', 'E-mail', true, '#e67e22', '\u2709\uFE0F') +
                _toggleBtnHtml('profile-notify-whatsapp', 'WhatsApp', true, '#25D366', '\uD83D\uDCAC') +
              '</div>' +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            // Theme
            '<div class="form-group" style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="font-size: 0.8rem; font-weight: 600;">Aparência</label>' +
              '<select id="theme-selector" class="form-control" style="width: 100%; box-sizing: border-box; padding: 0.6rem; cursor: pointer; background: var(--bg-darker); border: 1px solid var(--border-color);">' +
                '<option value="auto">Tema Auto (Sistema)</option>' +
                '<option value="dark">Tema Escuro (Padrão)</option>' +
                '<option value="light">Modo Claro (Light)</option>' +
                '<option value="high-contrast">Alto Contraste</option>' +
                '<option value="alternative">Alternativo (Catppuccin)</option>' +
              '</select>' +
            '</div>' +
            // Buttons
            '<div style="display: flex; gap: 10px; margin-top: 1rem; padding-bottom: 0.5rem;">' +
              '<button type="submit" class="btn btn-primary" style="flex: 1;">Salvar</button>' +
              '<button type="button" class="btn btn-outline" onclick="handleLogout()" style="border-color: var(--danger-color); color: var(--danger-color); background: transparent; flex: 1;">Sair</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(createInteractiveElement(modalHtml));

    // Setup phone mask
    var phoneInput = document.getElementById('profile-edit-phone');
    var countrySelect = document.getElementById('profile-phone-country');
    if (phoneInput) {
      _setupPhoneMask(phoneInput, '55');
      if (countrySelect) {
        countrySelect.addEventListener('change', function() {
          var digits = phoneInput.getAttribute('data-digits') || '';
          phoneInput.value = _formatPhoneDisplay(digits, this.value);
        });
      }
    }

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
      var birthDate = document.getElementById('profile-edit-birthdate').value;
      var city = document.getElementById('profile-edit-city').value.trim();
      // Phone: grab raw digits only
      var phoneDigits = (document.getElementById('profile-edit-phone').getAttribute('data-digits') || '').replace(/\D/g, '');
      var phoneCountry = document.getElementById('profile-phone-country').value || '55';
      var sports = document.getElementById('profile-edit-sports').value.trim();
      var category = document.getElementById('profile-edit-category').value.trim();
      // Toggle buttons: read data-on attribute
      var acceptFriends = document.getElementById('profile-accept-friends').getAttribute('data-on') === '1';
      var notifyPlatform = document.getElementById('profile-notify-platform').getAttribute('data-on') === '1';
      var notifyEmail = document.getElementById('profile-notify-email').getAttribute('data-on') === '1';
      var notifyWhatsApp = document.getElementById('profile-notify-whatsapp').getAttribute('data-on') === '1';

      if (name) {
        window.AppStore.currentUser.displayName = name;
        window.AppStore.currentUser.name = name;
      }
      window.AppStore.currentUser.gender = gender;
      window.AppStore.currentUser.birthDate = birthDate;
      window.AppStore.currentUser.city = city;
      window.AppStore.currentUser.phone = phoneDigits;
      window.AppStore.currentUser.phoneCountry = phoneCountry;
      window.AppStore.currentUser.preferredSports = sports;
      window.AppStore.currentUser.defaultCategory = category;
      window.AppStore.currentUser.acceptFriendRequests = acceptFriends;
      window.AppStore.currentUser.notifyPlatform = notifyPlatform;
      window.AppStore.currentUser.notifyEmail = notifyEmail;
      window.AppStore.currentUser.notifyWhatsApp = notifyWhatsApp;

      // Calcula idade se tem data de nascimento
      if (birthDate) {
        var parts = birthDate.split('-');
        var bd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        var today = new Date();
        var age = today.getFullYear() - bd.getFullYear();
        var m = today.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
        window.AppStore.currentUser.age = age;
      }

      // Save profile to Firestore
      if (window.AppStore.saveUserProfileToFirestore) {
        await window.AppStore.saveUserProfileToFirestore();
      }

      // Update header UI with new name and photo
      var photoUrl = window.AppStore.currentUser.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var firstName = name ? name.split(' ')[0] : 'Usuário';
      var btnLogin = document.getElementById('btn-login');
      if (btnLogin) {
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
