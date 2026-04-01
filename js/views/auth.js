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
      // Skip if email registration is still updating displayName profile
      if (window._pendingProfileUpdate) {
        // Skipping — pending profile update (email register)
        return;
      }
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
              // Public tournaments loaded
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

// ─── Apple Login ─────────────────────────────────────────────────────────────
function handleAppleLogin() {
  if (window.location.protocol === 'file:') {
    showNotification('Indisponível', 'Login com Apple não está disponível offline.', 'warning');
    return;
  }
  var appleProvider = new firebase.auth.OAuthProvider('apple.com');
  appleProvider.addScope('email');
  appleProvider.addScope('name');

  showNotification('Conectando...', 'Abrindo popup da Apple...', 'info');
  firebase.auth().signInWithPopup(appleProvider)
    .then(function(result) {
      var user = result.user;
      showNotification('Login Realizado', 'Bem-vindo(a)' + (user.displayName ? ', ' + user.displayName : '') + '!', 'success');
    })
    .catch(function(error) {
      console.error('Apple auth error:', error);
      if (error.code === 'auth/popup-blocked') {
        showNotification('Popup Bloqueado', 'Permita popups para este site.', 'error');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // cancelled
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification('Não Configurado', 'Login com Apple ainda não foi habilitado no Firebase Console.', 'warning');
      } else {
        showNotification('Erro', 'Não foi possível realizar o login com Apple.', 'error');
      }
    });
}

// ─── Facebook Login ──────────────────────────────────────────────────────────
function handleFacebookLogin() {
  if (window.location.protocol === 'file:') {
    showNotification('Indisponível', 'Login com Facebook não está disponível offline.', 'warning');
    return;
  }
  var fbProvider = new firebase.auth.FacebookAuthProvider();
  fbProvider.addScope('email');
  fbProvider.addScope('public_profile');

  showNotification('Conectando...', 'Abrindo popup do Facebook...', 'info');
  firebase.auth().signInWithPopup(fbProvider)
    .then(function(result) {
      var user = result.user;
      showNotification('Login Realizado', 'Bem-vindo(a)' + (user.displayName ? ', ' + user.displayName : '') + '!', 'success');
    })
    .catch(function(error) {
      console.error('Facebook auth error:', error);
      if (error.code === 'auth/popup-blocked') {
        showNotification('Popup Bloqueado', 'Permita popups para este site.', 'error');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // cancelled
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        showNotification('Conta Existente', 'Já existe uma conta com este e-mail. Tente entrar com Google ou e-mail.', 'warning');
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification('Não Configurado', 'Login com Facebook ainda não foi habilitado no Firebase Console.', 'warning');
      } else {
        showNotification('Erro', 'Não foi possível realizar o login com Facebook.', 'error');
      }
    });
}

// ─── Email/Password Login ────────────────────────────────────────────────────
function handleEmailLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (!email || !password) {
    showNotification('Campos Obrigatórios', 'Preencha e-mail e senha.', 'warning');
    return;
  }

  showNotification('Entrando...', 'Verificando credenciais...', 'info');
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(function(result) {
      var user = result.user;
      showNotification('Login Realizado', 'Bem-vindo(a)' + (user.displayName ? ', ' + user.displayName : '') + '!', 'success');
      var modal = document.getElementById('modal-login');
      if (modal) modal.classList.remove('active');
    })
    .catch(function(error) {
      console.error('Email login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        showNotification('Credenciais Inválidas', 'E-mail ou senha incorretos. Verifique ou crie uma conta nova.', 'error');
      } else if (error.code === 'auth/wrong-password') {
        showNotification('Senha Incorreta', 'A senha está incorreta. Tente novamente ou redefina sua senha.', 'error');
      } else if (error.code === 'auth/too-many-requests') {
        showNotification('Muitas Tentativas', 'Muitas tentativas de login. Aguarde alguns minutos.', 'warning');
      } else {
        showNotification('Erro no Login', error.message || 'Não foi possível entrar.', 'error');
      }
    });
}

// ─── Email/Password Registration ─────────────────────────────────────────────
function handleEmailRegister() {
  var name = document.getElementById('register-name').value.trim();
  var email = document.getElementById('register-email').value.trim();
  var password = document.getElementById('register-password').value;
  if (!name || !email || !password) {
    showNotification('Campos Obrigatórios', 'Preencha nome, e-mail e senha.', 'warning');
    return;
  }
  if (password.length < 6) {
    showNotification('Senha Fraca', 'A senha deve ter pelo menos 6 caracteres.', 'warning');
    return;
  }

  showNotification('Criando conta...', 'Registrando sua conta...', 'info');
  // Flag to delay onAuthStateChanged until profile is updated with displayName
  window._pendingProfileUpdate = true;
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(function(result) {
      var user = result.user;
      // Update profile with display name FIRST, then let onAuthStateChanged handle login
      return user.updateProfile({ displayName: name }).then(function() {
        showNotification('Conta Criada!', 'Bem-vindo(a), ' + name + '!', 'success');
        var modal = document.getElementById('modal-login');
        if (modal) modal.classList.remove('active');
        // Clear flag and trigger login flow via simulateLoginSuccess (onAuthStateChanged may have fired before updateProfile)
        window._pendingProfileUpdate = false;
        return simulateLoginSuccess({
          uid: user.uid,
          email: user.email,
          displayName: name,
          photoURL: user.photoURL
        });
      });
    })
    .catch(function(error) {
      console.error('Email register error:', error);
      if (error.code === 'auth/email-already-in-use') {
        showNotification('E-mail em Uso', 'Já existe uma conta com este e-mail. Tente fazer login.', 'error');
      } else if (error.code === 'auth/invalid-email') {
        showNotification('E-mail Inválido', 'O formato do e-mail está incorreto.', 'error');
      } else if (error.code === 'auth/weak-password') {
        showNotification('Senha Fraca', 'A senha deve ter pelo menos 6 caracteres.', 'warning');
      } else {
        showNotification('Erro no Registro', error.message || 'Não foi possível criar a conta.', 'error');
      }
    });
}

// ─── Password Reset ──────────────────────────────────────────────────────────
function handlePasswordReset() {
  var emailEl = document.getElementById('login-email');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email) {
    showNotification('Informe o E-mail', 'Digite seu e-mail no campo acima e clique em "Esqueci a senha" novamente.', 'info');
    if (emailEl) emailEl.focus();
    return;
  }

  firebase.auth().sendPasswordResetEmail(email)
    .then(function() {
      showNotification('E-mail Enviado', 'Verifique sua caixa de entrada para redefinir a senha.', 'success');
    })
    .catch(function(error) {
      if (error.code === 'auth/user-not-found') {
        showNotification('E-mail Não Encontrado', 'Não existe conta com este e-mail.', 'error');
      } else {
        showNotification('Erro', error.message || 'Não foi possível enviar o e-mail de redefinição.', 'error');
      }
    });
}

// ─── Toggle between login and register mode ──────────────────────────────────
function toggleEmailMode(mode) {
  var loginDiv = document.getElementById('email-login-mode');
  var registerDiv = document.getElementById('email-register-mode');
  if (mode === 'register') {
    if (loginDiv) loginDiv.style.display = 'none';
    if (registerDiv) registerDiv.style.display = 'block';
  } else {
    if (loginDiv) loginDiv.style.display = 'block';
    if (registerDiv) registerDiv.style.display = 'none';
  }
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
        // Google gender detected
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
          // Google age detected
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
        // Google phone detected
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
    // People API (demographics) not available
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

  // Atualiza estado local (com dedup)
  if (!currentUser.friends) currentUser.friends = [];
  if (currentUser.friends.indexOf(inviterUid) === -1) {
    currentUser.friends.push(inviterUid);
  }

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

  // Auto-friendship via invite
}

async function simulateLoginSuccess(user) {
  // Guard against double execution (e.g. onAuthStateChanged + explicit call)
  if (window._simulateLoginInProgress) {
    // simulateLoginSuccess: skipping — already in progress
    return;
  }
  window._simulateLoginInProgress = true;

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
        // Migrated legacy user doc
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

  // Stop old (public-only) listener before starting full listener for logged-in user
  if (window.AppStore.stopRealtimeListener) {
    window.AppStore.stopRealtimeListener();
  }

  // Start real-time listener for ALL tournaments (auto-updates on any change)
  if (window.AppStore.startRealtimeListener) {
    window.AppStore.startRealtimeListener();
  } else if (window.AppStore.loadFromFirestore) {
    await window.AppStore.loadFromFirestore();
  }

  // Check tournament reminders and nearby tournaments (delayed to let data load)
  setTimeout(function() {
    if (typeof window._checkTournamentReminders === 'function') {
      window._checkTournamentReminders().catch(function(e) { console.warn('Reminder check error:', e); });
    }
    if (typeof window._checkNearbyTournaments === 'function') {
      window._checkNearbyTournaments().catch(function(e) { console.warn('Nearby check error:', e); });
    }
    // Initialize FCM push notifications (requests permission + saves token)
    if (typeof window._initFCM === 'function') {
      window._initFCM().catch(function(e) { console.warn('FCM init error:', e); });
    }
  }, 3000);

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

        // CEPs de preferência
        var cepsEl = document.getElementById('profile-edit-ceps');
        if (cepsEl) cepsEl.value = cu.preferredCeps || '';

        // Notify level filter
        var notifyLevelVal = cu.notifyLevel || 'todas';
        var nlHidden = document.getElementById('profile-notify-level');
        if (nlHidden) nlHidden.value = notifyLevelVal;
        if (typeof window._applyNotifyFilterUI === 'function') window._applyNotifyFilterUI(notifyLevelVal);

        if (typeof openModal === 'function') openModal('modal-profile');

        // Populate player stats after modal opens
        setTimeout(function() { _populatePlayerStats(); }, 50);
      }
    });
  }

  // Update notification badge (immediate + periodic refresh every 30s)
  if (typeof _updateNotificationBadge === 'function') {
    _updateNotificationBadge();
    if (!window._notifBadgeInterval) {
      window._notifBadgeInterval = setInterval(function() {
        if (window.AppStore.currentUser && typeof _updateNotificationBadge === 'function') {
          _updateNotificationBadge();
        }
      }, 30000);
    }
  }

  // Set view mode to organizer
  window.AppStore.viewMode = 'organizer';
  var viewModeBtn = document.getElementById('view-mode-selector');
  if (viewModeBtn) viewModeBtn.innerHTML = '👁️ <span style="font-weight:600;">Organizador</span>';

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
        var _u = window.AppStore.currentUser;
        var participantObj = { name: _u.displayName, email: _u.email, displayName: _u.displayName };

        // Include gender if available (needed for category auto-assignment)
        if (_u.gender) participantObj.gender = _u.gender;

        // Auto-assign categories if tournament has them and user has gender
        var hasCats = (t.combinedCategories && t.combinedCategories.length > 0) ||
                      (t.genderCategories && t.genderCategories.length > 0) ||
                      (t.skillCategories && t.skillCategories.length > 0);
        if (hasCats && _u.gender && typeof window._userGenderToCatCodes === 'function') {
          var genderCodes = window._userGenderToCatCodes(_u.gender);
          var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto Aleat.', misto_obrigatorio: 'Misto Obrig.' };
          var combined = t.combinedCategories || [];
          var genderCats = t.genderCategories || [];
          var skillCats = t.skillCategories || [];
          var eligible = [];
          if (combined.length > 0) {
            combined.forEach(function(c) {
              var matchesGender = genderCodes.some(function(gc) {
                return c.toLowerCase().startsWith((genderLabels[gc] || gc).toLowerCase());
              });
              if (matchesGender) eligible.push(c);
            });
          } else if (genderCats.length > 0 && skillCats.length === 0) {
            genderCats.forEach(function(gc) {
              if (genderCodes.indexOf(gc) !== -1) eligible.push(genderLabels[gc] || gc);
            });
          } else if (skillCats.length > 0 && genderCats.length === 0) {
            eligible = skillCats.slice();
          }
          if (eligible.length > 0 && typeof window._groupEligibleCategories === 'function') {
            var groups = window._groupEligibleCategories(eligible);
            var autoCategories = [];
            if (groups.exclusive.length === 1) autoCategories.push(groups.exclusive[0]);
            autoCategories = autoCategories.concat(groups.nonExclusive);
            if (autoCategories.length > 0) {
              participantObj.categories = autoCategories;
              participantObj.category = autoCategories[0];
              participantObj.categorySource = 'perfil';
            }
          }
        }

        // Use atomic Firestore transaction to prevent race conditions
        if (window.FirestoreDB && window.FirestoreDB.enrollParticipant) {
          window.FirestoreDB.enrollParticipant(pendingEnrollId, participantObj).then(function(result) {
            if (result.alreadyEnrolled) return;
            t.participants = result.participants;
            var catMsg = participantObj.categories ? ' na categoria ' + (typeof window._displayCategoryName === 'function' ? window._displayCategoryName(participantObj.categories[0]) : participantObj.categories[0]) : '';
            if (typeof showNotification !== 'undefined') {
              showNotification('Inscrito!', 'Voc\u00EA foi inscrito automaticamente no torneio "' + t.name + '"' + catMsg + '.', 'success');
            }
            // Auto-amizade: com quem convidou (ref) ou com o organizador como fallback
            if (_inviteRefUid) {
              _autoFriendOnInvite(_inviteRefUid, window.AppStore.currentUser);
              try { sessionStorage.removeItem('_inviteRefUid'); } catch(e) {}
            } else if (t.organizerEmail && window.FirestoreDB && window.FirestoreDB.db) {
              window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                if (!snap.empty) {
                  _autoFriendOnInvite(snap.docs[0].id, window.AppStore.currentUser);
                }
              }).catch(function(e) { console.warn('Auto-friend org lookup error:', e); });
            }
            // Notify organizer about new enrollment
            if (t.organizerEmail && t.organizerEmail !== _u.email && window.FirestoreDB && window.FirestoreDB.db) {
              window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                if (!snap.empty && typeof window._sendUserNotification === 'function') {
                  window._sendUserNotification(snap.docs[0].id, {
                    type: 'enrollment_new',
                    message: (_u.displayName || 'Um participante') + ' se inscreveu no torneio "' + t.name + '".',
                    tournamentId: String(t.id),
                    tournamentName: t.name || '',
                    level: 'all'
                  });
                }
              }).catch(function(e) { console.warn('Notify organizer error:', e); });
            }
            // Navigate to tournament details after enrollment
            window.location.hash = '#tournaments/' + pendingEnrollId;
            if (typeof initRouter === 'function') initRouter();
          }).catch(function(err) {
            console.warn('Auto-enroll transaction error:', err);
          });
        } else {
          // Fallback: navigate to tournament page
          window.location.hash = '#tournaments/' + pendingEnrollId;
          if (typeof initRouter === 'function') initRouter();
        }
      } else {
        // Tournament not found after retries — navigate and warn user
        window.location.hash = '#tournaments/' + pendingEnrollId;
        if (typeof initRouter === 'function') initRouter();
        if (_enrollAttempts >= 20 && typeof showNotification === 'function') {
          showNotification('Inscrição Pendente', 'Não foi possível completar a inscrição automática. Tente se inscrever manualmente na página do torneio.', 'warning');
        }
      }
    };
    setTimeout(_tryAutoEnroll, 300);
    window._simulateLoginInProgress = false;
    return;
  }

  // Redirect to pending invite tournament if there was one
  if (window._pendingInviteHash) {
    var dest = window._pendingInviteHash;
    window._pendingInviteHash = null;
    window.location.hash = dest;
  }

  // Show/hide Pro upgrade button based on plan
  var proBtn = document.getElementById('btn-upgrade-pro');
  if (proBtn) {
    proBtn.style.display = window._isPro() ? 'none' : 'flex';
  }

  // Initialize router to load appropriate views
  if (typeof initRouter === 'function') initRouter();
  window._simulateLoginInProgress = false;
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

          // --- Social login buttons ---
          '<div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.5rem;">' +

            // Google
            '<button type="button" class="btn hover-lift btn-block" onclick="handleGoogleLogin()" style="background:#fff;color:#333;border:1px solid #ddd;">' +
              '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.34 2.44 10.5l8.09-5.91z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' +
              'Entrar com Google' +
            '</button>' +

            // Apple
            '<button type="button" class="btn hover-lift btn-block" onclick="handleAppleLogin()" style="background:#000;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>' +
              'Entrar com Apple' +
            '</button>' +

            // Facebook
            '<button type="button" class="btn btn-block hover-lift" onclick="handleFacebookLogin()" style="background:#1877F2;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' +
              'Entrar com Facebook' +
            '</button>' +

          '</div>' +

          '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1.5rem;">' +
            '<div style="flex: 1; height: 1px; background: var(--border-color);"></div>' +
            '<span style="color: var(--text-muted); font-size: 0.875rem;">ou</span>' +
            '<div style="flex: 1; height: 1px; background: var(--border-color);"></div>' +
          '</div>' +

          // --- Email/password form ---
          '<div id="email-login-mode" style="display:block;">' +
            '<form id="form-login" onsubmit="event.preventDefault(); handleEmailLogin();">' +
              '<div class="form-group">' +
                '<label class="form-label">E-mail</label>' +
                '<input type="email" id="login-email" class="form-control" placeholder="seu@email.com" required>' +
              '</div>' +
              '<div class="form-group mb-4">' +
                '<label class="form-label">Senha</label>' +
                '<input type="password" id="login-password" class="form-control" placeholder="••••••••" required minlength="6">' +
              '</div>' +
              '<button type="submit" class="btn btn-secondary btn-block">Entrar com E-mail</button>' +
            '</form>' +
            '<div style="text-align:center;margin-top:12px;">' +
              '<span style="color:var(--text-muted);font-size:0.8rem;">Não tem conta? </span>' +
              '<a href="#" onclick="event.preventDefault();toggleEmailMode(\'register\')" style="color:var(--primary-color);font-size:0.8rem;font-weight:600;">Criar conta</a>' +
              '<span style="color:var(--text-muted);font-size:0.8rem;margin-left:12px;">|</span>' +
              '<a href="#" onclick="event.preventDefault();handlePasswordReset()" style="color:var(--text-muted);font-size:0.8rem;margin-left:12px;">Esqueci a senha</a>' +
            '</div>' +
          '</div>' +

          // --- Register mode (hidden by default) ---
          '<div id="email-register-mode" style="display:none;">' +
            '<form id="form-register" onsubmit="event.preventDefault(); handleEmailRegister();">' +
              '<div class="form-group">' +
                '<label class="form-label">Nome</label>' +
                '<input type="text" id="register-name" class="form-control" placeholder="Seu nome" required>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label">E-mail</label>' +
                '<input type="email" id="register-email" class="form-control" placeholder="seu@email.com" required>' +
              '</div>' +
              '<div class="form-group mb-4">' +
                '<label class="form-label">Senha (mínimo 6 caracteres)</label>' +
                '<input type="password" id="register-password" class="form-control" placeholder="••••••••" required minlength="6">' +
              '</div>' +
              '<button type="submit" class="btn btn-primary btn-block">Criar Conta</button>' +
            '</form>' +
            '<div style="text-align:center;margin-top:12px;">' +
              '<span style="color:var(--text-muted);font-size:0.8rem;">Já tem conta? </span>' +
              '<a href="#" onclick="event.preventDefault();toggleEmailMode(\'login\')" style="color:var(--primary-color);font-size:0.8rem;font-weight:600;">Entrar</a>' +
            '</div>' +
          '</div>' +

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

// === Excluir conta ===
window._confirmDeleteAccount = function() {
  var user = window.AppStore.currentUser;
  if (!user) return;

  // First confirmation
  var overlay = document.createElement('div');
  overlay.id = 'modal-delete-account';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:100001;';
  overlay.innerHTML =
    '<div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:16px;max-width:400px;width:92%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:1.2rem;text-align:center;">' +
        '<div style="font-size:2rem;margin-bottom:0.2rem;">⚠️</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:#fff;">Excluir conta</div>' +
      '</div>' +
      '<div style="padding:1.5rem;text-align:center;">' +
        '<p style="color:var(--text-color);font-size:0.9rem;margin-bottom:0.8rem;line-height:1.6;font-weight:600;">Tem certeza que deseja excluir sua conta?</p>' +
        '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:1.2rem;line-height:1.5;">Esta ação é <strong style="color:#ef4444;">irreversível</strong>. Todos os seus dados serão apagados permanentemente:</p>' +
        '<ul style="text-align:left;color:var(--text-muted);font-size:0.8rem;margin-bottom:1.2rem;padding-left:1.2rem;line-height:1.8;">' +
          '<li>Seu perfil e preferências</li>' +
          '<li>Suas notificações</li>' +
          '<li>Suas inscrições em torneios</li>' +
          '<li>Torneios que você organizou</li>' +
        '</ul>' +
        '<p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:1rem;">Digite <strong style="color:#ef4444;">EXCLUIR</strong> para confirmar:</p>' +
        '<input type="text" id="delete-account-confirm-input" placeholder="Digite EXCLUIR" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-dark);color:var(--text-color);font-size:0.9rem;text-align:center;margin-bottom:1rem;box-sizing:border-box;" />' +
        '<div style="display:flex;gap:10px;">' +
          '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'modal-delete-account\').remove()" style="flex:1;">Cancelar</button>' +
          '<button class="btn btn-danger btn-sm" id="btn-confirm-delete-account" onclick="window._executeDeleteAccount()" style="flex:1;opacity:0.4;pointer-events:none;">Excluir Conta</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  // Enable button only when user types EXCLUIR
  var input = document.getElementById('delete-account-confirm-input');
  var btn = document.getElementById('btn-confirm-delete-account');
  if (input && btn) {
    input.addEventListener('input', function() {
      var match = input.value.trim().toUpperCase() === 'EXCLUIR';
      btn.style.opacity = match ? '1' : '0.4';
      btn.style.pointerEvents = match ? 'auto' : 'none';
    });
    input.focus();
  }
};

window._executeDeleteAccount = async function() {
  var user = window.AppStore.currentUser;
  var firebaseUser = firebase.auth().currentUser;
  if (!user || !firebaseUser) return;

  var uid = user.uid || firebaseUser.uid;
  var email = user.email || firebaseUser.email;
  var db = window.FirestoreDB.db;

  // Show loading state
  var btn = document.getElementById('btn-confirm-delete-account');
  if (btn) { btn.textContent = 'Verificando...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

  try {
    // 1. Delete all user data first, then delete auth account
    if (btn) btn.textContent = 'Excluindo dados...';

    // 2a. Delete user notifications subcollection
    try {
      var notifsSnap = await db.collection('users').doc(uid).collection('notifications').get();
      var batch = db.batch();
      var count = 0;
      notifsSnap.forEach(function(doc) {
        batch.delete(doc.ref);
        count++;
        if (count >= 450) {
          batch.commit();
          batch = db.batch();
          count = 0;
        }
      });
      if (count > 0) await batch.commit();
    } catch (e) { console.warn('Erro ao excluir notificações:', e); }

    // 2b. Remove user from tournament participants
    try {
      var tournsSnap = await db.collection('tournaments').get();
      var tBatch = db.batch();
      var tCount = 0;
      tournsSnap.forEach(function(doc) {
        var data = doc.data();
        var participants = data.participants || [];
        var filtered = participants.filter(function(p) {
          return p.email !== email && p.uid !== uid;
        });
        if (filtered.length !== participants.length) {
          tBatch.update(doc.ref, { participants: filtered });
          tCount++;
        }
        if (tCount >= 450) {
          tBatch.commit();
          tBatch = db.batch();
          tCount = 0;
        }
      });
      if (tCount > 0) await tBatch.commit();
    } catch (e) { console.warn('Erro ao remover inscrições:', e); }

    // 2c. Delete tournaments organized by this user
    try {
      var myTournsSnap = await db.collection('tournaments').where('organizerEmail', '==', email).get();
      var dBatch = db.batch();
      var dCount = 0;
      myTournsSnap.forEach(function(doc) {
        dBatch.delete(doc.ref);
        dCount++;
      });
      if (dCount > 0) await dBatch.commit();
    } catch (e) { console.warn('Erro ao excluir torneios:', e); }

    // 2d. Delete user profile document
    try {
      await db.collection('users').doc(uid).delete();
    } catch (e) { console.warn('Erro ao excluir perfil:', e); }

    // 3. Delete Firebase Auth account — best effort, no re-auth popup
    try {
      await firebaseUser.delete();
    } catch (e) {
      // If requires-recent-login, just sign out — all data is already gone
      // Firebase will clean up orphaned auth accounts
      console.warn('Auth delete:', e.code || e.message);
      try { await firebase.auth().signOut(); } catch (so) {}
    }

    // 4. Clean up local state
    if (window.AppStore.stopRealtimeListener) window.AppStore.stopRealtimeListener();
    window.AppStore.currentUser = null;
    window.AppStore.tournaments = [];
    window.AppStore.viewMode = 'participant';
    try { localStorage.removeItem('boratime_state'); } catch (e) {}
    try { localStorage.removeItem('scoreplace_fcm_dismissed'); } catch (e) {}

    // 5. Close modals and update UI
    var modal = document.getElementById('modal-delete-account');
    if (modal) modal.remove();
    var profileModal = document.getElementById('modal-profile');
    if (profileModal) profileModal.classList.remove('active');

    var btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.innerHTML = 'Login';
      btnLogin.className = 'btn btn-outline';
      btnLogin.style = 'padding: 0.5rem 1rem;';
      var newBtn = btnLogin.cloneNode(true);
      btnLogin.parentNode.replaceChild(newBtn, btnLogin);
      newBtn.addEventListener('click', function() { openModal('modal-login'); });
    }

    var proBtn = document.getElementById('btn-upgrade-pro');
    if (proBtn) proBtn.style.display = 'none';

    showNotification('Conta excluída', 'Sua conta e todos os seus dados foram removidos permanentemente.', 'info');
    window.location.hash = '#dashboard';
    if (typeof initRouter === 'function') initRouter();

  } catch (err) {
    console.error('Erro ao excluir conta:', err);
    showNotification('Erro', 'Ocorreu um erro ao excluir sua conta. Tente novamente.', 'error');
    if (btn) { btn.textContent = 'Excluir Conta'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }
  }
};

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
function _toggleBtnHtml(id, label, checked, customColor, icon, autoWidth) {
  var onBg = customColor || 'var(--primary-color)';
  var onBorder = customColor || 'var(--primary-color)';
  var onStyle = 'background: ' + onBg + '; color: #fff; border-color: ' + onBorder + ';';
  var offStyle = 'background: transparent; color: var(--text-muted); border-color: var(--border-color);';
  var iconHtml = icon ? '<span style="font-size: 0.95rem; flex-shrink: 0;">' + icon + '</span>' : '';
  var widthStyle = autoWidth ? 'width: auto; padding: 8px 20px;' : 'width: 100%; padding: 8px 6px;';
  return '<button type="button" id="' + id + '" data-on="' + (checked ? '1' : '0') + '" ' +
    'data-color="' + (customColor || '') + '" ' +
    'style="display: flex; align-items: center; justify-content: center; gap: 6px; ' + widthStyle + ' border-radius: 10px; border: 1.5px solid; font-size: 0.78rem; font-weight: 500; cursor: pointer; transition: all 0.2s; text-align: center; box-sizing: border-box; ' +
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

// === Player Stats Calculator ===
function _populatePlayerStats() {
  var el = document.getElementById('profile-stats-content');
  if (!el) return;

  var cu = window.AppStore.currentUser;
  if (!cu || !cu.email) {
    el.innerHTML = '<span style="color:var(--text-muted);">Faça login para ver suas estatísticas.</span>';
    return;
  }

  var email = cu.email.toLowerCase();
  var displayName = (cu.displayName || '').toLowerCase();
  var tournaments = window.AppStore.tournaments || [];

  var stats = {
    tournamentsParticipated: 0,
    tournamentsOrganized: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    titles: 0,       // 1st place finishes
    history: []      // [{name, id, format, status, position}]
  };

  // Helper: check if a participant string/object matches the current user
  function _isMe(p) {
    if (!p) return false;
    var str = typeof p === 'string' ? p : (p.email || p.displayName || p.name || '');
    str = str.toLowerCase();
    return str.includes(email) || (displayName && str === displayName);
  }

  // Helper: check if a player label in a match belongs to current user
  function _isMyLabel(label) {
    if (!label) return false;
    var l = label.toLowerCase();
    return l.includes(email) || (displayName && l === displayName);
  }

  // Iterate all tournaments
  for (var ti = 0; ti < tournaments.length; ti++) {
    var t = tournaments[ti];

    // Check if organized
    if (t.organizerEmail && t.organizerEmail.toLowerCase() === email) {
      stats.tournamentsOrganized++;
    }

    // Check if participant
    var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
    var isParticipant = pList.some(function(p) { return _isMe(p); });
    if (!isParticipant) continue;

    stats.tournamentsParticipated++;

    // Collect all matches from various structures
    var allMatches = [];

    // Direct matches array (Eliminatórias single/double)
    if (Array.isArray(t.matches)) {
      allMatches = allMatches.concat(t.matches);
    }
    // Third place match
    if (t.thirdPlaceMatch) {
      allMatches.push(t.thirdPlaceMatch);
    }
    // Rounds (Suíço)
    if (Array.isArray(t.rounds)) {
      for (var ri = 0; ri < t.rounds.length; ri++) {
        if (Array.isArray(t.rounds[ri])) {
          allMatches = allMatches.concat(t.rounds[ri]);
        } else if (t.rounds[ri] && Array.isArray(t.rounds[ri].matches)) {
          allMatches = allMatches.concat(t.rounds[ri].matches);
        }
      }
    }
    // Groups (group stage)
    if (Array.isArray(t.groups)) {
      for (var gi = 0; gi < t.groups.length; gi++) {
        var group = t.groups[gi];
        if (group && Array.isArray(group.matches)) {
          allMatches = allMatches.concat(group.matches);
        }
        if (group && Array.isArray(group.rounds)) {
          for (var gri = 0; gri < group.rounds.length; gri++) {
            if (Array.isArray(group.rounds[gri])) {
              allMatches = allMatches.concat(group.rounds[gri]);
            }
          }
        }
      }
    }
    // Liga rodadas
    if (Array.isArray(t.rodadas)) {
      for (var li = 0; li < t.rodadas.length; li++) {
        if (Array.isArray(t.rodadas[li])) {
          allMatches = allMatches.concat(t.rodadas[li]);
        } else if (t.rodadas[li] && Array.isArray(t.rodadas[li].matches)) {
          allMatches = allMatches.concat(t.rodadas[li].matches);
        }
      }
    }

    // Count wins/losses/draws from matches
    for (var mi = 0; mi < allMatches.length; mi++) {
      var m = allMatches[mi];
      if (!m || !m.winner) continue;  // No result yet

      var imP1 = _isMyLabel(m.p1);
      var imP2 = _isMyLabel(m.p2);
      if (!imP1 && !imP2) continue;

      stats.matchesPlayed++;

      if (m.winner === 'draw' || m.draw) {
        stats.draws++;
      } else if (_isMyLabel(m.winner)) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }

    // Check for titles and position
    var _myPosition = null;
    if (t.status === 'finished') {
      // Eliminatórias: check if won the final
      if (Array.isArray(t.matches) && t.matches.length > 0) {
        var finalMatch = t.matches[t.matches.length - 1];
        if (finalMatch && finalMatch.winner && _isMyLabel(finalMatch.winner)) {
          stats.titles++;
          _myPosition = 1;
        } else if (finalMatch && finalMatch.winner) {
          // Lost the final = 2nd place
          if (_isMyLabel(finalMatch.p1) || _isMyLabel(finalMatch.p2)) _myPosition = 2;
        }
        // Check 3rd place match
        if (!_myPosition && t.thirdPlaceMatch && t.thirdPlaceMatch.winner) {
          if (_isMyLabel(t.thirdPlaceMatch.winner)) _myPosition = 3;
        }
      }
      // Liga/Suíço: check standings
      if (Array.isArray(t.standings) && t.standings.length > 0) {
        for (var si = 0; si < t.standings.length; si++) {
          var _sp = t.standings[si];
          if (_sp && _isMyLabel(_sp.name || _sp.player || _sp.displayName)) {
            _myPosition = si + 1;
            if (si === 0) stats.titles++;
            break;
          }
        }
      }
    }

    // Build history entry
    stats.history.push({
      name: t.name || 'Sem nome',
      id: t.id,
      format: t.format || '?',
      status: t.status || 'open',
      position: _myPosition,
      date: t.startDate || t.createdAt || ''
    });
  }

  // Render stats
  if (stats.tournamentsParticipated === 0) {
    el.innerHTML = '<span style="color:var(--text-muted);">Você ainda não participou de nenhum torneio.</span>';
    return;
  }

  var winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;

  var html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">';

  // Row 1: Tournaments, Matches, Win Rate
  html += '<div style="background: var(--bg-darker); border-radius: 8px; padding: 10px 6px;">' +
    '<div style="font-size: 1.3rem; font-weight: 700; color: var(--primary-color);">' + stats.tournamentsParticipated + '</div>' +
    '<div style="font-size: 0.7rem; color: var(--text-muted);">Torneios</div>' +
  '</div>';

  html += '<div style="background: var(--bg-darker); border-radius: 8px; padding: 10px 6px;">' +
    '<div style="font-size: 1.3rem; font-weight: 700; color: var(--text-color);">' + stats.matchesPlayed + '</div>' +
    '<div style="font-size: 0.7rem; color: var(--text-muted);">Partidas</div>' +
  '</div>';

  html += '<div style="background: var(--bg-darker); border-radius: 8px; padding: 10px 6px;">' +
    '<div style="font-size: 1.3rem; font-weight: 700; color: ' + (winRate >= 50 ? '#22c55e' : '#ef4444') + ';">' + winRate + '%</div>' +
    '<div style="font-size: 0.7rem; color: var(--text-muted);">Aproveitamento</div>' +
  '</div>';

  // Row 2: Wins, Losses/Draws, Titles
  html += '<div style="background: var(--bg-darker); border-radius: 8px; padding: 10px 6px;">' +
    '<div style="font-size: 1.3rem; font-weight: 700; color: #22c55e;">' + stats.wins + '</div>' +
    '<div style="font-size: 0.7rem; color: var(--text-muted);">Vitórias</div>' +
  '</div>';

  html += '<div style="background: var(--bg-darker); border-radius: 8px; padding: 10px 6px;">' +
    '<div style="font-size: 1.3rem; font-weight: 700; color: #ef4444;">' + stats.losses + (stats.draws > 0 ? '<span style="color:var(--text-muted);font-size:0.85rem;">/' + stats.draws + 'E</span>' : '') + '</div>' +
    '<div style="font-size: 0.7rem; color: var(--text-muted);">Derrotas' + (stats.draws > 0 ? '/Empates' : '') + '</div>' +
  '</div>';

  html += '<div style="background: var(--bg-darker); border-radius: 8px; padding: 10px 6px;">' +
    '<div style="font-size: 1.3rem; font-weight: 700; color: #fbbf24;">🏆 ' + stats.titles + '</div>' +
    '<div style="font-size: 0.7rem; color: var(--text-muted);">Títulos</div>' +
  '</div>';

  html += '</div>';

  // Organized count if > 0
  if (stats.tournamentsOrganized > 0) {
    html += '<div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-muted); text-align: center;">' +
      '📋 Você organizou ' + stats.tournamentsOrganized + ' torneio' + (stats.tournamentsOrganized > 1 ? 's' : '') +
    '</div>';
  }

  // Tournament history list (most recent first, max 8)
  if (stats.history.length > 0) {
    stats.history.sort(function(a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
    var maxShow = Math.min(stats.history.length, 8);
    html += '<div style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">';
    html += '<div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Histórico de Torneios</div>';
    for (var hi = 0; hi < maxShow; hi++) {
      var h = stats.history[hi];
      var posIcon = '';
      if (h.position === 1) posIcon = '🥇';
      else if (h.position === 2) posIcon = '🥈';
      else if (h.position === 3) posIcon = '🥉';
      else if (h.position) posIcon = h.position + 'º';

      var statusIcon = h.status === 'finished' ? '✅' : (h.status === 'active' ? '▶️' : '⏳');
      var safeName = window._safeHtml ? window._safeHtml(h.name) : h.name;

      html += '<div onclick="window.location.hash=\'#tournament/' + h.id + '\'; document.getElementById(\'modal-profile\').classList.remove(\'active\');" ' +
        'style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.78rem;transition:background 0.15s;" ' +
        'onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">' +
        '<span style="flex-shrink:0;width:22px;text-align:center;">' + statusIcon + '</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-color);">' + safeName + '</span>' +
        '<span style="flex-shrink:0;font-size:0.7rem;color:var(--text-muted);">' + h.format + '</span>' +
        (posIcon ? '<span style="flex-shrink:0;min-width:24px;text-align:right;">' + posIcon + '</span>' : '') +
      '</div>';
    }
    if (stats.history.length > maxShow) {
      html += '<div style="text-align:center;font-size:0.7rem;color:var(--text-muted);padding:4px;">e mais ' + (stats.history.length - maxShow) + ' torneio' + ((stats.history.length - maxShow) > 1 ? 's' : '') + '...</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

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
              '<span style="font-size: 0.65rem; color: var(--text-muted); opacity: 0.6; margin-top: 2px; display: block;">Separe os esportes por vírgula</span>' +
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
            // Social toggle + notification filters (same row)
            '<div style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.8rem;">Social &amp; Comunicações</label>' +
              '<p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 8px 0;">Permitir convites de amizade e filtrar as comunicações que você recebe dos torneios em que está inscrito.</p>' +
              '<div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; align-items: center;">' +
                _toggleBtnHtml('profile-accept-friends', 'Aceitar convites', true, null, null, true) +
                '<button type="button" class="btn btn-micro" id="profile-filter-importantes" onclick="window._toggleNotifyFilter(\'importantes\')" style="background: transparent; color: rgba(251,191,36,0.5); border: 1px solid rgba(251,191,36,0.25);" title="Ativo: recebe só importantes e fundamentais. Desativado: recebe todas.">🟡 Só Importantes</button>' +
                '<button type="button" class="btn btn-micro" id="profile-filter-fundamentais" onclick="window._toggleNotifyFilter(\'fundamentais\')" style="background: transparent; color: rgba(239,68,68,0.5); border: 1px solid rgba(239,68,68,0.25);" title="Ativo: recebe só fundamentais. Desativado: recebe todas.">🔴 Só Fundamentais</button>' +
              '</div>' +
              '<input type="hidden" id="profile-notify-level" value="todas">' +
            '</div>' +
            // CEPs de preferência
            '<div class="form-group" style="margin-bottom: 1rem;">' +
              '<label class="form-label" for="profile-edit-ceps" style="font-size: 0.8rem; font-weight: 600;">CEP(s) de preferência para jogar</label>' +
              '<input type="text" id="profile-edit-ceps" class="form-control" placeholder="01310-100, 04538-132" style="width: 100%; box-sizing: border-box;">' +
              '<span style="font-size: 0.65rem; color: var(--text-muted); font-style: italic;">Separe os CEPs por vírgula. Você será notificado de torneios próximos.</span>' +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            // Notification toggles
            '<div style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.8rem;">Canais de Notificação</label>' +
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
            // Player Stats Section
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            '<div id="profile-stats-section">' +
              '<label class="form-label" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.8rem;">Meu Desempenho</label>' +
              '<div id="profile-stats-content" style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:1rem 0;">Calculando...</div>' +
            '</div>' +
            // Buttons
            '<div style="display: flex; gap: 10px; margin-top: 1rem;">' +
              '<button type="submit" class="btn btn-primary" style="flex: 1;">Salvar</button>' +
              '<button type="button" class="btn btn-danger" onclick="handleLogout()" style="flex: 1;">Sair</button>' +
            '</div>' +
            '<div style="text-align: center; padding: 0.5rem 0 0.5rem;">' +
              '<button type="button" class="btn btn-ghost btn-micro" onclick="window._confirmDeleteAccount()" style="text-decoration:underline;">Excluir minha conta permanentemente</button>' +
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

    // Notification filter toggle — only two buttons, both off = "todas"
    // Clicking one activates it and deactivates the other. Clicking an active one deactivates it (back to "todas").
    window._toggleNotifyFilter = function(level) {
      var hidden = document.getElementById('profile-notify-level');
      var current = hidden ? hidden.value : 'todas';
      var newLevel = (current === level) ? 'todas' : level;
      if (hidden) hidden.value = newLevel;
      window._applyNotifyFilterUI(newLevel);
    };

    window._applyNotifyFilterUI = function(level) {
      var btnImp = document.getElementById('profile-filter-importantes');
      var btnFun = document.getElementById('profile-filter-fundamentais');
      // Reset both to inactive (dim)
      if (btnImp) {
        var isImp = (level === 'importantes');
        btnImp.style.background = isImp ? 'rgba(251,191,36,0.2)' : 'transparent';
        btnImp.style.border = isImp ? '2px solid rgba(251,191,36,0.7)' : '1px solid rgba(251,191,36,0.25)';
        btnImp.style.color = isImp ? '#fbbf24' : 'rgba(251,191,36,0.5)';
        btnImp.style.boxShadow = isImp ? '0 0 8px rgba(251,191,36,0.15)' : 'none';
      }
      if (btnFun) {
        var isFun = (level === 'fundamentais');
        btnFun.style.background = isFun ? 'rgba(239,68,68,0.2)' : 'transparent';
        btnFun.style.border = isFun ? '2px solid rgba(239,68,68,0.7)' : '1px solid rgba(239,68,68,0.25)';
        btnFun.style.color = isFun ? '#f87171' : 'rgba(239,68,68,0.5)';
        btnFun.style.boxShadow = isFun ? '0 0 8px rgba(239,68,68,0.15)' : 'none';
      }
    };

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
      var notifyLevel = document.getElementById('profile-notify-level').value || 'todas';
      var preferredCeps = document.getElementById('profile-edit-ceps').value.trim();

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
      window.AppStore.currentUser.notifyLevel = notifyLevel;
      window.AppStore.currentUser.preferredCeps = preferredCeps;

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
