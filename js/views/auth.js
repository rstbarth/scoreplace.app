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

// ─── Safari detection ───────────────────────────────────────────────────────
// Safari (desktop + iOS) has ITP that breaks popup-based OAuth when the auth
// domain is cross-origin (firebaseapp.com). We detect Safari + in-app webviews
// (iOS Chrome, Facebook/Instagram browser) and route those users through the
// redirect flow, which is ITP-friendly.
function _isSafariOrIOSWebView() {
  try {
    var ua = navigator.userAgent || '';
    var isChromium = /Chrome|Chromium|CriOS|EdgA|EdgiOS/.test(ua);
    var isSafariUA = /Safari/.test(ua) && !isChromium;
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isIOSWebView = isIOS && !/Safari/.test(ua);
    // iOS always — even Chrome on iOS uses WebKit and suffers the same ITP issues
    return isSafariUA || isIOS || isIOSWebView;
  } catch (e) { return false; }
}
window._isSafariOrIOSWebView = _isSafariOrIOSWebView;

// Initialize Firebase + Firestore
let authProvider = null;
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    authProvider = new firebase.auth.GoogleAuthProvider();
    // NOTE: Sensitive People API scopes (gender, birthday, addresses, phone)
    // require Google OAuth app verification. Without verification, Google shows
    // an "unverified app" warning that silently rejects the login flow for many
    // users. We use only default scopes (profile, email) — users can fill in
    // demographics manually in their profile.
  } else if (firebase.auth && firebase.auth.GoogleAuthProvider) {
    authProvider = new firebase.auth.GoogleAuthProvider();
  }
  // Force LOCAL persistence so auth survives page reloads in Safari/ITP contexts.
  // (LOCAL is already the default, but Safari sometimes downgrades silently —
  // setting it explicitly also surfaces storage-blocked errors early.)
  if (firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function(err) { console.warn('setPersistence error:', err); });
  }
  // Initialize Firestore
  if (window.FirestoreDB) {
    window.FirestoreDB.init();
  }
} catch (e) {
  console.warn("Firebase initialization error:", e);
}

// ─── Handle redirect result on page load ────────────────────────────────────
// When a user returns from Google's OAuth redirect (Safari/iOS flow), we need
// to capture the credential + access token here (onAuthStateChanged won't give
// us access to the OAuth credential). This also lets us finish pending account-
// link operations just like the popup flow does.
if (firebase && firebase.auth) {
  try {
    firebase.auth().getRedirectResult().then(function(result) {
      if (!result || !result.user) return;
      var user = result.user;
      try {
        if (typeof showNotification === 'function') {
          showNotification(_t('auth.loginDone'), _t('auth.welcomeName', {name: user.displayName || user.email}), 'success');
        }
      } catch(e) {}
      if (window.FirestoreDB && window.FirestoreDB.db && user.uid) {
        window.FirestoreDB.saveUserProfile(user.uid, { authProvider: 'google.com' }).catch(function() {});
      }
      try { _tryLinkPendingCredential(result); } catch(e) {}
      var credential = result.credential;
      if (credential && credential.accessToken) {
        try { _fetchGoogleDemographics(credential.accessToken, user.uid || user.email); } catch(e) {}
      }
    }).catch(function(error) {
      if (!error || !error.code) return;
      console.warn('getRedirectResult error:', error);
      if (error.code === 'auth/account-exists-with-different-credential') {
        _handleAccountLinking(error, 'Google');
      } else if (error.code !== 'auth/credential-already-in-use' && error.code !== 'auth/no-auth-event') {
        try { showNotification(_t('auth.googleError'), _t('auth.googleErrorMsg'), 'error'); } catch(e) {}
      }
    });
  } catch (e) { console.warn('getRedirectResult init error:', e); }
}

// Listen for auth state changes to auto-login returning users
if (firebase && firebase.auth) {
  firebase.auth().onAuthStateChanged(async function(user) {
    console.log('[scoreplace-auth] onAuthStateChanged fired:', user ? { uid: user.uid, email: user.email } : 'null');
    window._authStateResolved = true;
    if (user) {
      // Skip if email registration is still updating displayName profile
      if (window._pendingProfileUpdate) {
        console.log('[scoreplace-auth] onAuthStateChanged skipped (pending profile update)');
        return;
      }
      // Cache login state for instant restore on next page load
      try {
        localStorage.setItem('scoreplace_authCache', JSON.stringify({
          uid: user.uid, email: user.email,
          displayName: user.displayName, photoURL: user.photoURL
        }));
      } catch(e) {}
      // User is signed in — load data from Firestore and update UI
      await simulateLoginSuccess({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    } else {
      console.log('[scoreplace-auth] onAuthStateChanged: signed out — clearing authCache, currentUser');
      // Clear cached login state
      try { localStorage.removeItem('scoreplace_authCache'); } catch(e) {}
      // User is signed out — stop previous listener, load public tournaments
      if (window.AppStore) {
        window.AppStore.currentUser = null;
        if (window.AppStore.stopRealtimeListener) window.AppStore.stopRealtimeListener();
        // Start real-time listener for public tournaments only
        if (window.FirestoreDB && window.FirestoreDB.db) {
          var _pubFirstSnap = true;
          window.AppStore._realtimeUnsubscribe = window.FirestoreDB.db.collection('tournaments')
            .where('isPublic', '==', true)
            .onSnapshot(function(snap) {
              var publicTournaments = [];
              snap.forEach(function(doc) { publicTournaments.push(doc.data()); });
              window.AppStore.tournaments = publicTournaments;
              window.AppStore._saveToCache();
              // First snapshot = initial load, subsequent = remote changes
              if (_pubFirstSnap) {
                _pubFirstSnap = false;
                if (typeof initRouter === 'function') initRouter();
              } else if (typeof window._softRefreshView === 'function') {
                window._softRefreshView();
              }
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
    showNotification(_t('auth.simLogin'), _t('auth.simLoginMsg'), 'info');
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
    showNotification(_t('auth.error'), _t('auth.firebaseError'), 'error');
    return;
  }

  showNotification(_t('auth.connecting'), _t('auth.connectingMsg'), 'info');

  // Safari/iOS: popup-based OAuth is unreliable due to ITP cookie blocking.
  // Use redirect instead — getRedirectResult() on page reload picks up the session.
  if (_isSafariOrIOSWebView()) {
    firebase.auth().signInWithRedirect(authProvider).catch(function(error) {
      console.error('Firebase auth redirect error:', error);
      if (!_handleAccountLinking(error, 'Google')) {
        showNotification(_t('auth.googleError'), _t('auth.googleErrorMsg'), 'error');
      }
    });
    return;
  }

  console.log('[scoreplace-auth] Google popup starting...');
  firebase.auth().signInWithPopup(authProvider)
    .then(function(result) {
      var user = result.user;
      console.log('[scoreplace-auth] Popup success:', { uid: user && user.uid, email: user && user.email });
      showNotification(_t('auth.loginDone'), _t('auth.welcomeName', {name: user.displayName}), 'success');

      // Save auth provider to Firestore
      if (window.FirestoreDB && window.FirestoreDB.db && user.uid) {
        window.FirestoreDB.saveUserProfile(user.uid, { authProvider: 'google.com' }).catch(function() {});
      }

      // Try linking pending credential from another provider
      _tryLinkPendingCredential(result);

      // Explicitly drive the login flow from the popup success callback
      // instead of relying solely on onAuthStateChanged. Chrome's 3rd-party
      // cookie deprecation + cross-origin auth domain (firebaseapp.com) can
      // cause onAuthStateChanged to not fire reliably. simulateLoginSuccess
      // has a _simulateLoginInProgress guard so this is safe if both fire.
      try {
        localStorage.setItem('scoreplace_authCache', JSON.stringify({
          uid: user.uid, email: user.email,
          displayName: user.displayName, photoURL: user.photoURL
        }));
      } catch(e) {}
      console.log('[scoreplace-auth] Calling simulateLoginSuccess directly from popup callback');
      simulateLoginSuccess({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    })
    .catch(function(error) {
      console.error('[scoreplace-auth] Firebase auth error:', error);
      // Popup blocked / failed — fall back to redirect flow so the user can still log in.
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment' || error.code === 'auth/web-storage-unsupported') {
        firebase.auth().signInWithRedirect(authProvider).catch(function(err2) {
          console.error('Redirect fallback error:', err2);
          showNotification(_t('auth.popupBlocked'), _t('auth.popupBlockedMsg'), 'error');
        });
        return;
      }
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User cancelled, no need for error
      } else if (_handleAccountLinking(error, 'Google')) {
        // handled
      } else {
        showNotification(_t('auth.googleError'), _t('auth.googleErrorMsg'), 'error');
      }
    });
}

// ─── Account linking helper ─────────────────────────────────────────────────
// When user tries to sign in with a provider but already has an account with
// the same email via a different provider, Firebase throws
// auth/account-exists-with-different-credential. This helper detects the
// existing provider and guides the user to link accounts.
function _handleAccountLinking(error, providerName) {
  if (error.code !== 'auth/account-exists-with-different-credential') return false;
  var email = error.customData ? error.customData.email : (error.email || '');
  var pendingCred = error.credential || null;
  if (!email) {
    showNotification(_t('auth.accountExists'), _t('auth.accountExistsMsg'), 'warning');
    return true;
  }

  // Fetch which providers are linked to this email
  firebase.auth().fetchSignInMethodsForEmail(email).then(function(methods) {
    if (!methods || methods.length === 0) {
      showNotification(_t('auth.error'), _t('auth.identifyError'), 'error');
      return;
    }
    var existingProvider = methods[0]; // e.g. 'google.com', 'password', 'emailLink', 'phone'
    var providerNames = {
      'google.com': 'Google',
      'password': _t('auth.providerPassword'),
      'emailLink': 'Link de E-mail',
      'phone': _t('auth.providerPhone')
    };
    var existingName = providerNames[existingProvider] || existingProvider;

    // Save pending credential so we can link after successful sign-in
    if (pendingCred) {
      window._pendingLinkCredential = pendingCred;
      window._pendingLinkEmail = email;
    }

    showNotification(
      _t('auth.accountAlreadyExists'),
      _t('auth.accountLinkMsg', {email: email, existing: existingName, newProvider: providerName}),
      'info'
    );
  }).catch(function(err) {
    console.warn('fetchSignInMethodsForEmail error:', err);
    showNotification(_t('auth.accountExists'), _t('auth.accountExistsMsg'), 'warning');
  });
  return true;
}

// After a successful sign-in, check if there's a pending credential to link
function _tryLinkPendingCredential(result) {
  if (!window._pendingLinkCredential) return;
  var user = result.user;
  if (!user) return;
  var cred = window._pendingLinkCredential;
  window._pendingLinkCredential = null;
  window._pendingLinkEmail = null;
  user.linkWithCredential(cred).then(function() {
    showNotification(_t('auth.accountLinked'), _t('auth.accountLinkedMsg'), 'success');
  }).catch(function(err) {
    console.warn('Account link error:', err);
    // Not critical — user is already logged in
  });
}

// ─── Email Link (Passwordless) Login ────────────────────────────────────────
function handleEmailLinkLogin() {
  var emailEl = document.getElementById('login-email-link');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email) {
    showNotification(_t('auth.enterEmail'), _t('auth.enterEmailMsg'), 'warning');
    if (emailEl) emailEl.focus();
    return;
  }

  var actionCodeSettings = {
    url: 'https://scoreplace.app/#dashboard',
    handleCodeInApp: true
  };

  showNotification(_t('auth.sending'), _t('auth.sendingLinkMsg', {email: email}), 'info');
  firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
    .then(function() {
      // Save the email locally so we can complete sign-in when user clicks the link
      window.localStorage.setItem('scoreplace_emailForSignIn', email);
      showNotification(_t('auth.linkSent'), _t('auth.linkSentMsg', {email: email}), 'success');
      var modal = document.getElementById('modal-login');
      if (modal) modal.classList.remove('active');
    })
    .catch(function(error) {
      console.error('Email link send error:', error);
      if (error.code === 'auth/invalid-email') {
        showNotification(_t('auth.invalidEmail'), _t('auth.invalidEmailMsg'), 'error');
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification(_t('auth.notAvailable'), _t('auth.emailLinkUnavailable'), 'warning');
      } else {
        showNotification(_t('auth.error'), error.message || _t('auth.loginErrorMsg'), 'error');
      }
    });
}

// Complete email link sign-in when user arrives via the link
function _completeEmailLinkSignIn() {
  if (!firebase.auth().isSignInWithEmailLink(window.location.href)) return;

  var email = window.localStorage.getItem('scoreplace_emailForSignIn');
  if (!email) {
    // User opened link on a different device — ask for email
    email = window.prompt('Por favor, confirme seu e-mail para completar o login:');
    if (!email) return;
  }

  firebase.auth().signInWithEmailLink(email, window.location.href)
    .then(function(result) {
      // Clear stored email
      window.localStorage.removeItem('scoreplace_emailForSignIn');
      var user = result.user;
      // Save auth provider to Firestore
      if (window.FirestoreDB && window.FirestoreDB.db && user.uid) {
        var profileData = { authProvider: 'emailLink', updatedAt: new Date().toISOString() };
        if (user.email) profileData.email = user.email;
        if (!user.displayName && email) profileData.displayName = email.split('@')[0];
        window.FirestoreDB.saveUserProfile(user.uid, profileData).catch(function() {});
      }
      showNotification(_t('auth.loginDone'), user.displayName ? _t('auth.welcomeName', {name: user.displayName}) : _t('auth.welcome'), 'success');
      // Clean the URL (remove sign-in link parameters)
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + '#dashboard');
      }
    })
    .catch(function(error) {
      console.error('Email link sign-in error:', error);
      window.localStorage.removeItem('scoreplace_emailForSignIn');
      if (error.code === 'auth/invalid-action-code') {
        showNotification(_t('auth.linkExpired'), _t('auth.linkExpiredMsg'), 'error');
      } else if (error.code === 'auth/invalid-email') {
        showNotification(_t('auth.emailMismatch'), _t('auth.emailMismatchMsg'), 'error');
      } else {
        showNotification(_t('auth.loginError'), error.message || _t('auth.loginErrorMsg'), 'error');
      }
    });
}

// Run email link check on page load
try { _completeEmailLinkSignIn(); } catch(e) { console.warn('Email link check error:', e); }

// ─── Phone/SMS Login ────────────────────────────────────────────────────────
window._phoneConfirmationResult = null;
window._phoneRecaptchaVerifier = null;
window._phoneRecaptchaWidgetId = null;

function handlePhoneLogin() {
  var phoneEl = document.getElementById('login-phone');
  var rawPhone = phoneEl ? phoneEl.value.trim() : '';
  if (!rawPhone) {
    showNotification(_t('auth.enterPhone'), _t('auth.enterPhoneMsg'), 'warning');
    if (phoneEl) phoneEl.focus();
    return;
  }

  // Format phone number: add +55 if no country code
  var phone = rawPhone.replace(/[\s\-\(\)]/g, '');
  if (!phone.startsWith('+')) {
    // Remove leading zero if present
    if (phone.startsWith('0')) phone = phone.substring(1);
    phone = '+55' + phone;
  }

  // Validate basic format
  if (phone.length < 12 || phone.length > 15) {
    showNotification(_t('auth.invalidPhone'), _t('auth.invalidPhoneMsg'), 'warning');
    return;
  }

  // Initialize reCAPTCHA if not already done
  var recaptchaContainer = document.getElementById('recaptcha-container');
  if (!recaptchaContainer) {
    showNotification(_t('auth.error'), _t('auth.recaptchaNotFound'), 'error');
    return;
  }

  // Show loading
  showNotification(_t('auth.verifying'), _t('auth.sendingSms', {phone: phone}), 'info');

  // Create invisible reCAPTCHA verifier
  if (!window._phoneRecaptchaVerifier) {
    window._phoneRecaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: function() {
        // reCAPTCHA solved — will proceed with phone sign-in
      },
      'expired-callback': function() {
        showNotification(_t('auth.recaptchaExpired'), _t('auth.tryAgain'), 'warning');
        _resetPhoneRecaptcha();
      }
    });
  }

  firebase.auth().signInWithPhoneNumber(phone, window._phoneRecaptchaVerifier)
    .then(function(confirmationResult) {
      window._phoneConfirmationResult = confirmationResult;
      // Show verification code input
      _showPhoneVerificationStep();
      showNotification(_t('auth.codeSent'), _t('auth.codeSentMsg', {phone: phone}), 'success');
    })
    .catch(function(error) {
      console.error('Phone sign-in error:', error);
      _resetPhoneRecaptcha();
      if (error.code === 'auth/invalid-phone-number') {
        showNotification(_t('auth.invalidPhone'), _t('auth.invalidPhoneNumber'), 'error');
      } else if (error.code === 'auth/too-many-requests') {
        showNotification(_t('auth.tooManyAttempts'), _t('auth.tooManySms'), 'warning');
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification(_t('auth.notAvailable'), _t('auth.phoneUnavailable'), 'warning');
      } else if (error.code === 'auth/captcha-check-failed') {
        showNotification(_t('auth.verifyFailed'), _t('auth.verifyFailedMsg'), 'error');
      } else {
        showNotification(_t('auth.error'), error.message || _t('auth.loginErrorMsg'), 'error');
      }
    });
}

function _showPhoneVerificationStep() {
  var phoneStep = document.getElementById('phone-step-number');
  var codeStep = document.getElementById('phone-step-code');
  if (phoneStep) phoneStep.style.display = 'none';
  if (codeStep) codeStep.style.display = 'block';
  var codeInput = document.getElementById('login-phone-code');
  if (codeInput) { codeInput.value = ''; codeInput.focus(); }
}

function handlePhoneVerifyCode() {
  var codeEl = document.getElementById('login-phone-code');
  var code = codeEl ? codeEl.value.trim() : '';
  if (!code || code.length < 6) {
    showNotification(_t('auth.invalidCode'), _t('auth.invalidCodeMsg'), 'warning');
    if (codeEl) codeEl.focus();
    return;
  }

  if (!window._phoneConfirmationResult) {
    showNotification(_t('auth.error'), _t('auth.sessionExpiredMsg'), 'error');
    _resetPhoneLoginUI();
    return;
  }

  showNotification(_t('auth.verifying'), _t('auth.confirmingCode'), 'info');
  window._phoneConfirmationResult.confirm(code)
    .then(function(result) {
      var user = result.user;
      // Save auth provider to Firestore
      if (window.FirestoreDB && window.FirestoreDB.db && user.uid) {
        var profileData = { authProvider: 'phone', updatedAt: new Date().toISOString() };
        if (user.phoneNumber) profileData.phone = user.phoneNumber;
        if (!user.displayName && user.phoneNumber) profileData.displayName = user.phoneNumber;
        window.FirestoreDB.saveUserProfile(user.uid, profileData).catch(function() {});
      }
      window._phoneConfirmationResult = null;
      _resetPhoneRecaptcha();
      showNotification(_t('auth.loginDone'), _t('auth.welcome'), 'success');
      var modal = document.getElementById('modal-login');
      if (modal) modal.classList.remove('active');
      _resetPhoneLoginUI();
    })
    .catch(function(error) {
      console.error('Phone verify error:', error);
      if (error.code === 'auth/invalid-verification-code') {
        showNotification(_t('auth.wrongCode'), _t('auth.wrongCodeMsg'), 'error');
      } else if (error.code === 'auth/code-expired') {
        showNotification(_t('auth.codeExpired'), _t('auth.codeExpiredMsg'), 'error');
        _resetPhoneLoginUI();
      } else {
        showNotification(_t('auth.error'), error.message || _t('auth.loginErrorMsg'), 'error');
      }
    });
}

function _resetPhoneRecaptcha() {
  if (window._phoneRecaptchaVerifier) {
    try { window._phoneRecaptchaVerifier.clear(); } catch(e) {}
    window._phoneRecaptchaVerifier = null;
  }
  var container = document.getElementById('recaptcha-container');
  if (container) container.innerHTML = '';
}

function _resetPhoneLoginUI() {
  var phoneStep = document.getElementById('phone-step-number');
  var codeStep = document.getElementById('phone-step-code');
  if (phoneStep) phoneStep.style.display = 'block';
  if (codeStep) codeStep.style.display = 'none';
  window._phoneConfirmationResult = null;
}

// ─── Email/Password Login ────────────────────────────────────────────────────
function handleEmailLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (!email || !password) {
    showNotification(_t('auth.requiredFields'), _t('auth.fillEmailPassword'), 'warning');
    return;
  }

  showNotification(_t('auth.signingIn'), _t('auth.signingInMsg'), 'info');
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(function(result) {
      var user = result.user;
      // Track auth provider
      if (window.FirestoreDB && window.FirestoreDB.db && user.uid) {
        window.FirestoreDB.saveUserProfile(user.uid, { authProvider: 'password', updatedAt: new Date().toISOString() }).catch(function() {});
      }
      _tryLinkPendingCredential(result);
      showNotification(_t('auth.loginDone'), user.displayName ? _t('auth.welcomeName', {name: user.displayName}) : _t('auth.welcome'), 'success');
      var modal = document.getElementById('modal-login');
      if (modal) modal.classList.remove('active');
    })
    .catch(function(error) {
      console.error('Email login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        showNotification(_t('auth.invalidCreds'), _t('auth.invalidCredsMsg'), 'error');
      } else if (error.code === 'auth/wrong-password') {
        showNotification(_t('auth.wrongPassword'), _t('auth.wrongPasswordMsg'), 'error');
      } else if (error.code === 'auth/too-many-requests') {
        showNotification(_t('auth.tooManyAttempts'), _t('auth.tooManyLogin'), 'warning');
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification(_t('auth.notAvailable'), _t('auth.emailPasswordUnavailable'), 'warning');
      } else {
        showNotification(_t('auth.loginError'), error.message || _t('auth.loginErrorMsg'), 'error');
      }
    });
}

// ─── Email/Password Registration ─────────────────────────────────────────────
function handleEmailRegister() {
  var name = document.getElementById('register-name').value.trim();
  var email = document.getElementById('register-email').value.trim();
  var password = document.getElementById('register-password').value;
  if (!name || !email || !password) {
    showNotification(_t('auth.requiredFields'), _t('auth.fillNameEmailPassword'), 'warning');
    return;
  }
  if (password.length < 6) {
    showNotification(_t('auth.weakPassword'), _t('auth.weakPasswordMsg'), 'warning');
    return;
  }

  showNotification(_t('auth.creatingAccount'), _t('auth.creatingAccountMsg'), 'info');
  // Flag to delay onAuthStateChanged until profile is updated with displayName
  window._pendingProfileUpdate = true;
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(function(result) {
      var user = result.user;
      // Update profile with display name FIRST, then let onAuthStateChanged handle login
      return user.updateProfile({ displayName: name }).then(function() {
        // Send email verification
        user.sendEmailVerification().then(function() {
          showNotification(_t('auth.verifyEmail'), _t('auth.verifyEmailMsg', {email: email}), 'info');
        }).catch(function(e) {
          console.warn('Email verification send error:', e);
        });
        showNotification(_t('auth.accountCreated'), _t('auth.accountCreatedMsg', {name: name}), 'success');
        var modal = document.getElementById('modal-login');
        if (modal) modal.classList.remove('active');
        // Save auth provider to Firestore
        if (window.FirestoreDB && window.FirestoreDB.db && user.uid) {
          window.FirestoreDB.saveUserProfile(user.uid, {
            authProvider: 'password',
            displayName: name,
            email: email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }).catch(function() {});
        }
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
      window._pendingProfileUpdate = false;
      console.error('Email register error:', error);
      if (error.code === 'auth/email-already-in-use') {
        showNotification(_t('auth.emailInUse'), _t('auth.emailInUseMsg'), 'error');
      } else if (error.code === 'auth/invalid-email') {
        showNotification(_t('auth.invalidEmail'), _t('auth.invalidEmailMsg'), 'error');
      } else if (error.code === 'auth/weak-password') {
        showNotification(_t('auth.weakPassword'), _t('auth.weakPasswordMsg'), 'warning');
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification(_t('auth.notAvailable'), _t('auth.registerUnavailable'), 'warning');
      } else {
        showNotification(_t('auth.registerError'), error.message || _t('auth.registerErrorMsg'), 'error');
      }
    });
}

// ─── Password Reset ──────────────────────────────────────────────────────────
function handlePasswordReset() {
  var emailEl = document.getElementById('login-email');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email) {
    showNotification(_t('auth.enterEmail'), _t('auth.enterEmailReset'), 'info');
    if (emailEl) emailEl.focus();
    return;
  }

  showNotification(_t('auth.sending'), _t('auth.sendingReset'), 'info');
  firebase.auth().sendPasswordResetEmail(email, {
    url: 'https://scoreplace.app/#dashboard',
    handleCodeInApp: false
  })
    .then(function() {
      showNotification(_t('auth.emailSent'), _t('auth.emailSentMsg', {email: email}), 'success');
    })
    .catch(function(error) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
        showNotification(_t('auth.emailNotFound'), _t('auth.emailNotFoundMsg'), 'error');
      } else if (error.code === 'auth/too-many-requests') {
        showNotification(_t('auth.tooManyAttempts'), _t('auth.tooManyReset'), 'warning');
      } else if (error.code === 'auth/operation-not-allowed') {
        showNotification(_t('auth.notAvailable'), _t('auth.resetUnavailable'), 'warning');
      } else {
        showNotification(_t('auth.error'), error.message || _t('auth.resetErrorMsg'), 'error');
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

// ─── Switch login tabs ──────────────────────────────────────────────────────
function switchLoginTab(tabId) {
  var tabs = ['social', 'email', 'emaillink', 'phone'];
  tabs.forEach(function(t) {
    var panel = document.getElementById('login-panel-' + t);
    var tab = document.getElementById('tab-' + t);
    if (panel) panel.style.display = (t === tabId) ? 'block' : 'none';
    if (tab) {
      tab.style.background = (t === tabId) ? 'var(--primary-color)' : 'var(--surface-color)';
      tab.style.color = (t === tabId) ? '#fff' : 'var(--text-muted)';
    }
  });
  // Reset phone UI when switching away
  if (tabId !== 'phone') _resetPhoneLoginUI();
}

// Toggle expandable login sections (accordion-style)
window._toggleLoginSection = function(sectionId) {
  var sections = ['emaillink', 'phone', 'email', 'google'];
  sections.forEach(function(s) {
    var panel = document.getElementById('login-panel-' + s);
    if (panel) {
      if (s === sectionId) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      } else {
        panel.style.display = 'none';
      }
    }
  });
  // Reset phone UI when collapsing
  if (sectionId !== 'phone') _resetPhoneLoginUI();
};

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
    message: _t('auth.friendAcceptedMsg', {name: currentUser.displayName || _t('auth.someone')}),
    createdAt: new Date().toISOString(),
    read: false
  });

  // Auto-friendship via invite
}

async function simulateLoginSuccess(user) {
  console.log('[scoreplace-auth] simulateLoginSuccess called for', user && user.email, 'inProgress:', !!window._simulateLoginInProgress);
  // Guard against double execution (e.g. onAuthStateChanged + explicit call)
  if (window._simulateLoginInProgress) {
    console.log('[scoreplace-auth] simulateLoginSuccess: skipping — already in progress');
    return;
  }
  window._simulateLoginInProgress = true;

  // Set AppStore.currentUser with the user object
  window.AppStore.currentUser = user;
  console.log('[scoreplace-auth] currentUser set, running early router refresh');

  // Close any open login modal + hamburger, and immediately refresh the route
  // so the landing page gives way to the dashboard BEFORE any async Firestore
  // call has a chance to throw and skip the initRouter at the end of the function.
  try {
    var _lm = document.getElementById('modal-login');
    if (_lm) _lm.classList.remove('active');
    if (typeof window._closeHamburger === 'function') window._closeHamburger();
    if (typeof initRouter === 'function' &&
        (window.location.hash === '' || window.location.hash === '#dashboard' || window.location.hash === '#')) {
      initRouter();
    }
  } catch (e) { console.warn('Early post-login refresh failed:', e); }

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

  // Auto-save basic profile data to Firestore if profile is missing fields
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
    // Detect auth provider from Firebase Auth user
    if (!existingProfile || !existingProfile.authProvider) {
      try {
        var fbUser = firebase.auth().currentUser;
        if (fbUser && fbUser.providerData && fbUser.providerData.length > 0) {
          basicData.authProvider = fbUser.providerData[0].providerId;
          needsSave = true;
        }
      } catch(e) {}
    }
    if (!existingProfile || !existingProfile.createdAt) {
      basicData.createdAt = new Date().toISOString();
      needsSave = true;
    }
    if (needsSave) {
      basicData.updatedAt = new Date().toISOString();
      window.FirestoreDB.saveUserProfile(uid, basicData).catch(function(err) {
        console.warn('Erro ao salvar dados básicos do perfil:', err);
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

  // Start real-time listener for user notifications
  if (window.AppStore.startNotificationsListener) {
    window.AppStore.startNotificationsListener();
  }
  // Start real-time listener for user profile (theme sync across devices)
  if (window.AppStore.startProfileListener) {
    window.AppStore.startProfileListener();
  }

  // Check tournament reminders and nearby tournaments (delayed to let data load)
  setTimeout(function() {
    // Auto-detect and fix stale participant names in tournaments
    // (handles cases where user changed name before propagation code existed)
    if (typeof window._autoFixStaleNames === 'function') {
      window._autoFixStaleNames().catch(function(e) { console.warn('Auto-fix stale names error:', e); });
    }

    // Load templates from Firestore (with localStorage migration)
    if (typeof window._loadTemplates === 'function') {
      window._loadTemplates().catch(function(e) { console.warn('Template load error:', e); });
    }
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

    var displayFirstName = user.displayName ? user.displayName.split(' ')[0] : _t('auth.defaultUser');
    var photoUrl = user.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
    var _sh = typeof window._safeHtml === 'function' ? window._safeHtml : function(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };

    // Use inline onclick so the handler survives cloneNode(true) into the hamburger dropdown
    btnLogin.setAttribute('onclick', 'window._onProfileBtnClick(event)');
    btnLogin.innerHTML =
      '<div style="display:flex; align-items:center; justify-content:center; gap:8px;" title="Meu Perfil">' +
        '<img src="' + _sh(photoUrl) + '" style="width:32px; height:32px; border-radius:50%; border: 2px solid var(--primary-color); object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
        '<div style="display:none;width:32px;height:32px;border-radius:50%;background:var(--primary-color);color:white;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;">👤</div>' +
        '<span class="user-name-label" style="font-weight:600; font-size:1rem;">' + _sh(displayFirstName) + '</span>' +
      '</div>' +
      '<div title="Sair da Conta" class="logoff-btn" style="color: var(--danger-color); margin-left: 8px; display:flex; align-items:center; cursor:pointer; opacity: 0.8;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
      '</div>';
  }

  // Expose profile-open + logout dispatch as a global so the inline onclick attribute
  // (cloned into the hamburger dropdown) keeps working. cloneNode(true) preserves
  // `onclick` attributes but NOT addEventListener listeners — hence inline wiring.
  window._onProfileBtnClick = function(e) {
    try {
      if (e && e.target && e.target.closest && e.target.closest('[title="Sair da Conta"]')) {
        e.stopPropagation();
        if (typeof window._closeHamburger === 'function') window._closeHamburger();
        handleLogout();
        return;
      }
      // Close hamburger before opening modal (avoids stacking focus trap issues)
      if (typeof window._closeHamburger === 'function') window._closeHamburger();
      window._openMyProfileModal();
    } catch (err) { console.warn('_onProfileBtnClick error', err); }
  };

  window._openMyProfileModal = function() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) { if (typeof openModal === 'function') openModal('modal-login'); return; }
    var photoUrl = cu.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
    var avatar = document.getElementById('profile-avatar');
    if (avatar) { avatar.src = photoUrl; avatar.style.display = 'block'; }
    var _setVal = function(id, val) { var el = document.getElementById(id); if (el) el.value = val == null ? '' : val; };
    _setVal('profile-edit-name', cu.displayName || _t('auth.defaultUser'));
    _setVal('profile-edit-gender', cu.gender || '');
    _setVal('profile-edit-birthdate', cu.birthDate || '');
    _setVal('profile-edit-city', cu.city || '');
    _setVal('profile-edit-sports', cu.preferredSports || '');
    _setVal('profile-edit-category', cu.defaultCategory || '');
    var phoneCountrySel = document.getElementById('profile-phone-country');
    var phoneInput = document.getElementById('profile-edit-phone');
    if (phoneCountrySel && cu.phoneCountry) phoneCountrySel.value = cu.phoneCountry;
    if (phoneInput && cu.phone) {
      var digits = (cu.phone || '').replace(/\D/g, '');
      phoneInput.setAttribute('data-digits', digits);
      if (typeof _formatPhoneDisplay === 'function') {
        phoneInput.value = _formatPhoneDisplay(digits, phoneCountrySel ? phoneCountrySel.value : '55');
      } else {
        phoneInput.value = digits;
      }
    }
    var _hintsEnabled = !(window._hintSystem && window._hintSystem.isDisabled());
    [
      { id: 'profile-accept-friends', val: cu.acceptFriendRequests !== false },
      { id: 'profile-notify-platform', val: cu.notifyPlatform !== false },
      { id: 'profile-notify-email', val: cu.notifyEmail !== false },
      { id: 'profile-hints-enabled', val: _hintsEnabled }
    ].forEach(function(t) { var el = document.getElementById(t.id); if (el) el.checked = t.val; });
    window._profileLocations = Array.isArray(cu.preferredLocations) ? cu.preferredLocations.slice() : [];
    var cepsEl = document.getElementById('profile-edit-ceps'); if (cepsEl) cepsEl.value = cu.preferredCeps || '';
    setTimeout(function() { if (typeof window._initProfileMap === 'function') window._initProfileMap(); }, 300);
    setTimeout(function() { if (typeof _setupProfileSearch === 'function') _setupProfileSearch(); }, 100);
    if (typeof window._applyNotifyFilterUI === 'function') window._applyNotifyFilterUI(cu.notifyLevel || 'todas');
    var curTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (typeof window._applyProfileThemeUI === 'function') window._applyProfileThemeUI(curTheme);
    if (typeof openModal === 'function') openModal('modal-profile');
  };

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

  // Recheck topbar wrap after profile button changed size
  if (typeof window._checkTopbarWrap === 'function') setTimeout(window._checkTopbarWrap, 100);

  // Set view mode to organizer
  window.AppStore.viewMode = 'organizer';
  var viewModeBtn = document.getElementById('view-mode-selector');
  if (viewModeBtn) viewModeBtn.innerHTML = '👁️ <span style="font-weight:600;">' + (window.innerWidth <= 767 ? _t('auth.orgShort') : _t('nav.organizer')) + '</span>';

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
        // Block auto-enrollment if enrollments are closed
        var _isLigaFmt = t.format && (t.format === 'Liga' || t.format === 'Ranking' || t.format === 'liga' || t.format === 'ranking');
        var _ligaOpenEnroll = _isLigaFmt && t.ligaOpenEnrollment;
        var _sorteioFeito = (Array.isArray(t.matches) && t.matches.length > 0) ||
                            (Array.isArray(t.rounds) && t.rounds.length > 0) ||
                            (Array.isArray(t.groups) && t.groups.length > 0);
        var _canEnroll = (t.status !== 'closed' && t.status !== 'finished' && !_sorteioFeito) || _ligaOpenEnroll;
        if (!_canEnroll) {
          // Enrollments closed — just navigate to tournament without enrolling
          if (typeof showNotification === 'function') {
            showNotification(_t('auth.enrollClosed'), _t('auth.enrollClosedMsg'), 'warning');
          }
          window.location.hash = '#tournaments/' + pendingEnrollId;
          if (typeof initRouter === 'function') initRouter();
          window._simulateLoginInProgress = false;
          return;
        }

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
          var genderLabels = { fem: _t('auth.genderFem'), masc: _t('auth.genderMasc'), misto_aleatorio: _t('auth.genderMistoAl'), misto_obrigatorio: _t('auth.genderMistoOb') };
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
            if (result.enrollmentClosed) {
              if (typeof showNotification === 'function') showNotification(_t('auth.enrollClosed'), _t('auth.enrollClosedMsg'), 'warning');
              window.location.hash = '#tournaments/' + pendingEnrollId;
              if (typeof initRouter === 'function') initRouter();
              return;
            }
            if (result.alreadyEnrolled) return;
            t.participants = result.participants;
            var catMsg = participantObj.categories ? ' na categoria ' + (typeof window._displayCategoryName === 'function' ? window._displayCategoryName(participantObj.categories[0]) : participantObj.categories[0]) : '';
            if (typeof showNotification !== 'undefined') {
              showNotification(_t('auth.enrolled'), _t('auth.enrolledMsg', {name: t.name, cat: catMsg}), 'success');
            }
            // Auto-amizade: apenas com quem convidou (ref no link)
            if (_inviteRefUid) {
              _autoFriendOnInvite(_inviteRefUid, window.AppStore.currentUser);
              try { sessionStorage.removeItem('_inviteRefUid'); } catch(e) {}
            }
            // Notify organizer about new enrollment
            if (t.organizerEmail && t.organizerEmail !== _u.email && typeof window._resolveOrganizerUid === 'function') {
              window._resolveOrganizerUid(t).then(function(orgUid) {
                if (orgUid && typeof window._sendUserNotification === 'function') {
                  window._sendUserNotification(orgUid, {
                    type: 'enrollment_new',
                    message: _t('auth.participantEnrolledMsg', {name: _u.displayName || _t('auth.someParticipant'), tournament: t.name}),
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
          showNotification(_t('auth.enrollPending'), _t('auth.enrollPendingMsg'), 'warning');
        }
      }
      // Clear flag after auto-enroll attempt completes (success or fallback)
      window._simulateLoginInProgress = false;
    };
    setTimeout(_tryAutoEnroll, 300);
    return;
  }

  // Auto-rejoin pending casual match room (user came in via #casual/XXX while logged out)
  var pendingCasualRoom = null;
  try { pendingCasualRoom = sessionStorage.getItem('_pendingCasualRoom'); } catch(e) {}
  if (pendingCasualRoom) {
    try { sessionStorage.removeItem('_pendingCasualRoom'); } catch(e) {}
    window.location.hash = '#casual/' + pendingCasualRoom;
    if (typeof initRouter === 'function') initRouter();
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
      '<div class="modal" style="max-width: 420px;">' +
        '<div class="modal-header">' +
          '<h2 class="card-title">Entrar no scoreplace.app</h2>' +
          '<button class="modal-close" onclick="document.getElementById(\'modal-login\').classList.remove(\'active\')">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +

          // --- 1. Link Mágico por E-mail ---
          '<div style="margin-bottom:4px;">' +
            '<div style="font-size:0.78rem;font-weight:600;color:var(--text-bright);margin-bottom:6px;">✉️ Link Magico por E-mail</div>' +
            '<form onsubmit="event.preventDefault(); handleEmailLinkLogin();">' +
              '<div style="display:flex;gap:6px;align-items:center;">' +
                '<input type="email" id="login-email-link" class="form-control" placeholder="ex: joao.silva@gmail.com" required style="flex:1;font-size:1rem;padding:12px 14px;">' +
                '<button type="submit" class="btn" style="font-size:0.72rem;white-space:nowrap;padding:6px 10px;background:transparent;border:1px solid var(--primary-color,#3b82f6);color:var(--primary-color,#3b82f6);font-weight:600;border-radius:8px;">Enviar</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
          '<div id="login-panel-emaillink" style="display:none;"></div>' +

          // --- Divider ---
          '<div style="display:flex;align-items:center;gap:12px;margin:12px 0;">' +
            '<div style="flex:1;height:1px;background:var(--border-color);"></div>' +
            '<span style="color:var(--text-muted);font-size:0.7rem;">ou</span>' +
            '<div style="flex:1;height:1px;background:var(--border-color);"></div>' +
          '</div>' +

          // --- 2. SMS para Celular ---
          '<div style="margin-bottom:4px;">' +
            '<div style="font-size:0.78rem;font-weight:600;color:var(--text-bright);margin-bottom:6px;">📱 SMS para Celular</div>' +
            '<div id="phone-step-number" style="display:block;">' +
              '<form onsubmit="event.preventDefault(); handlePhoneLogin();">' +
                '<div style="display:flex;gap:8px;align-items:center;">' +
                  '<span style="color:var(--text-muted);font-size:0.82rem;white-space:nowrap;">+55</span>' +
                  '<input type="tel" id="login-phone" class="form-control" placeholder="(11) 99999-8888" required style="flex:1;font-size:0.85rem;">' +
                  '<button type="submit" class="btn btn-success" style="font-size:0.8rem;white-space:nowrap;padding:8px 14px;">Enviar</button>' +
                '</div>' +
              '</form>' +
            '</div>' +
            '<div id="phone-step-code" style="display:none;">' +
              '<p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:6px;">Digite o codigo de 6 digitos recebido por SMS:</p>' +
              '<form onsubmit="event.preventDefault(); handlePhoneVerifyCode();">' +
                '<div style="display:flex;gap:8px;align-items:center;">' +
                  '<input type="text" id="login-phone-code" class="form-control" placeholder="123456" required maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" style="flex:1;text-align:center;font-size:1.1rem;letter-spacing:6px;font-weight:700;">' +
                  '<button type="submit" class="btn btn-success" style="font-size:0.8rem;white-space:nowrap;padding:8px 14px;">Verificar</button>' +
                '</div>' +
              '</form>' +
              '<div style="text-align:center;margin-top:6px;">' +
                '<a href="#" onclick="event.preventDefault();_resetPhoneLoginUI();handlePhoneLogin();" style="color:var(--text-muted);font-size:0.72rem;">Reenviar</a>' +
                '<span style="color:var(--text-muted);font-size:0.72rem;margin:0 6px;">|</span>' +
                '<a href="#" onclick="event.preventDefault();_resetPhoneLoginUI();" style="color:var(--text-muted);font-size:0.72rem;">Voltar</a>' +
              '</div>' +
            '</div>' +
            '<div id="recaptcha-container"></div>' +
          '</div>' +
          '<div id="login-panel-phone" style="display:none;"></div>' +

          // --- Divider ---
          '<div style="display:flex;align-items:center;gap:12px;margin:12px 0;">' +
            '<div style="flex:1;height:1px;background:var(--border-color);"></div>' +
            '<span style="color:var(--text-muted);font-size:0.7rem;">ou</span>' +
            '<div style="flex:1;height:1px;background:var(--border-color);"></div>' +
          '</div>' +

          // --- 3. E-mail e Senha ---
          '<div style="margin-bottom:4px;">' +
            '<div style="font-size:0.78rem;font-weight:600;color:var(--text-bright);margin-bottom:6px;">🔑 E-mail e Senha</div>' +
            '<div id="email-login-mode" style="display:block;">' +
              '<form id="form-login" onsubmit="event.preventDefault(); handleEmailLogin();">' +
                '<div style="margin-bottom:6px;">' +
                  '<input type="email" id="login-email" class="form-control" placeholder="seu@email.com" required style="font-size:0.85rem;">' +
                '</div>' +
                '<div style="margin-bottom:6px;">' +
                  '<input type="password" id="login-password" class="form-control" placeholder="Senha" required minlength="6" style="font-size:0.85rem;">' +
                '</div>' +
                '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;">' +
                  '<button type="submit" class="btn btn-secondary" style="font-size:0.8rem;white-space:nowrap;padding:8px 14px;">Entrar</button>' +
                '</div>' +
              '</form>' +
              '<div style="text-align:center;margin-top:6px;font-size:0.75rem;">' +
                '<a href="#" onclick="event.preventDefault();toggleEmailMode(\'register\')" style="color:var(--primary-color);font-weight:600;">Criar conta</a>' +
                '<span style="color:var(--text-muted);margin:0 8px;">|</span>' +
                '<a href="#" onclick="event.preventDefault();handlePasswordReset()" style="color:var(--text-muted);">Esqueci a senha</a>' +
              '</div>' +
            '</div>' +
            '<div id="email-register-mode" style="display:none;">' +
              '<form id="form-register" onsubmit="event.preventDefault(); handleEmailRegister();">' +
                '<div style="margin-bottom:6px;">' +
                  '<input type="text" id="register-name" class="form-control" placeholder="Seu nome" required style="font-size:0.85rem;">' +
                '</div>' +
                '<div style="margin-bottom:6px;">' +
                  '<input type="email" id="register-email" class="form-control" placeholder="seu@email.com" required style="font-size:0.85rem;">' +
                '</div>' +
                '<div style="margin-bottom:6px;">' +
                  '<input type="password" id="register-password" class="form-control" placeholder="Senha (min. 6)" required minlength="6" style="font-size:0.85rem;">' +
                '</div>' +
                '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;">' +
                  '<button type="submit" class="btn btn-primary" style="font-size:0.8rem;white-space:nowrap;padding:8px 14px;">Criar Conta</button>' +
                '</div>' +
              '</form>' +
              '<div style="text-align:center;margin-top:6px;">' +
                '<a href="#" onclick="event.preventDefault();toggleEmailMode(\'login\')" style="color:var(--primary-color);font-size:0.75rem;font-weight:600;">Ja tem conta? Entrar</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="login-panel-email" style="display:none;"></div>' +

          // --- Divider ---
          '<div style="display:flex;align-items:center;gap:12px;margin:12px 0;">' +
            '<div style="flex:1;height:1px;background:var(--border-color);"></div>' +
            '<span style="color:var(--text-muted);font-size:0.7rem;">ou</span>' +
            '<div style="flex:1;height:1px;background:var(--border-color);"></div>' +
          '</div>' +

          // --- 4. Google ---
          '<div style="margin-bottom:4px;">' +
            '<button type="button" class="btn hover-lift btn-block" onclick="handleGoogleLogin()" style="background:#fff;color:#333;border:1px solid #ddd;padding:12px 16px;font-size:0.88rem;font-weight:600;">' +
              '<svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:8px;"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.34 2.44 10.5l8.09-5.91z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' +
              _t('auth.signInGoogle') +
            '</button>' +
          '</div>' +
          '<div id="login-panel-google" style="display:none;"></div>' +

          // Hidden containers for backward compat
          '<div id="login-panel-social" style="display:none;"></div>' +
          '<div id="login-tabs" style="display:none;"></div>' +

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
    btnLogin.style = 'font-size: 0.82rem; padding: 0 16px; height: 38px;';
    // Inline onclick survives cloneNode(true) into the hamburger dropdown.
    btnLogin.setAttribute('onclick', "if(typeof window._closeHamburger==='function')window._closeHamburger(); if(typeof openModal==='function')openModal('modal-login');");
  }

  // Close profile modal if open
  var modalProfile = document.getElementById('modal-profile');
  if (modalProfile) modalProfile.classList.remove('active');

  // Update view mode visibility
  if (typeof window.updateViewModeVisibility === 'function') {
    window.updateViewModeVisibility();
  }

  // Show notification and reinitialize router
  showNotification(_t('auth.loggedOut'), _t('auth.loggedOutMsg'), 'info');
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
  if (btn) { btn.textContent = _t('auth.verifying'); btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

  try {
    // 1. Delete all user data first, then delete auth account
    if (btn) btn.textContent = _t('auth.deletingData');

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
      btnLogin.style = 'font-size: 0.82rem; padding: 0 16px; height: 38px;';
      btnLogin.setAttribute('onclick', "if(typeof window._closeHamburger==='function')window._closeHamburger(); if(typeof openModal==='function')openModal('modal-login');");
    }

    var proBtn = document.getElementById('btn-upgrade-pro');
    if (proBtn) proBtn.style.display = 'none';

    showNotification(_t('auth.accountDeleted'), _t('auth.accountDeletedMsg'), 'info');
    window.location.hash = '#dashboard';
    if (typeof initRouter === 'function') initRouter();

  } catch (err) {
    console.error('Erro ao excluir conta:', err);
    showNotification(_t('auth.error'), _t('auth.deleteErrorMsg'), 'error');
    if (btn) { btn.textContent = _t('auth.deleteAccountBtn'); btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }
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

// ─── Auto-detect & fix stale participant names ─────────────────────────────���
// Defined at module level so available immediately on script load (not inside setupProfileModal).
window._autoFixStaleNames = async function(forceTournamentId) {
  if (!window.AppStore || !Array.isArray(window.AppStore.tournaments)) return;
  if (!window.FirestoreDB || !window.FirestoreDB.db) return;
  if (window.AppStore.tournaments.length === 0) return;
  var now = Date.now();
  // Skip cooldown if forcing a specific tournament
  if (!forceTournamentId) {
    if (window._autoFixStaleNames._lastRun && (now - window._autoFixStaleNames._lastRun) < 30000) return;
  }
  window._autoFixStaleNames._lastRun = now;

  var tournamentsToScan = forceTournamentId
    ? window.AppStore.tournaments.filter(function(t) { return t.id === forceTournamentId; })
    : window.AppStore.tournaments;
  console.debug('[AutoFixNames] Scanning ' + tournamentsToScan.length + ' tournaments...');

  var uidMap = {};
  var emailMap = {};
  tournamentsToScan.forEach(function(t) {
    var parts = Array.isArray(t.participants) ? t.participants : [];
    parts.forEach(function(p) {
      if (typeof p === 'object' && p !== null) {
        var pName = p.displayName || p.name || '';
        if (!pName) return;
        var pUid = p.uid && p.uid.length > 0 ? p.uid : null;
        if (pUid && !uidMap[pUid]) {
          uidMap[pUid] = { storedName: pName, email: p.email || '' };
        }
        if (p.email && !emailMap[p.email]) {
          emailMap[p.email] = pName;
        }
      }
    });
    // Also scan match players (p1/p2) — they may reference stale names even when participant objects are updated
    var _scanMatch = function(m) {
      if (!m) return;
      // Extract individual names from team strings
      [m.p1, m.p2].forEach(function(pStr) {
        if (!pStr || typeof pStr !== 'string') return;
        var names = pStr.indexOf(' / ') !== -1 ? pStr.split(' / ').map(function(n) { return n.trim(); }) : [pStr];
        names.forEach(function(name) {
          if (!name || name === 'BYE' || name === 'TBD') return;
          // Check if this name exists as a participant object with different name
          parts.forEach(function(p2) {
            if (typeof p2 !== 'object' || p2 === null) return;
            var p2Name = p2.displayName || p2.name || '';
            if (!p2Name || p2Name === name) return;
            // Same uid or email but different display name → stale name in match
            if ((p2.uid && p2.uid.length > 0) || p2.email) {
              // Will be caught by the uid/email map comparison below
            }
          });
        });
      });
    };
    if (Array.isArray(t.matches)) t.matches.forEach(_scanMatch);
    if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) r.matches.forEach(_scanMatch); });
    if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
      if (!g) return;
      if (Array.isArray(g.matches)) g.matches.forEach(_scanMatch);
      if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr)) gr.forEach(_scanMatch); else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_scanMatch); });
    });
  });

  var uids = Object.keys(uidMap);
  var emails = Object.keys(emailMap);
  console.debug('[AutoFixNames] Found ' + uids.length + ' UIDs and ' + emails.length + ' emails to check');
  if (uids.length === 0 && emails.length === 0) return;

  var profileMap = {};
  var emailProfileMap = {};
  try {
    for (var i = 0; i < uids.length; i += 10) {
      var batch = uids.slice(i, i + 10);
      var snap = await window.FirestoreDB.db.collection('users')
        .where(firebase.firestore.FieldPath.documentId(), 'in', batch).get();
      snap.forEach(function(doc) {
        var data = doc.data();
        if (data.displayName) {
          profileMap[doc.id] = { displayName: data.displayName, email: data.email || '', previousDisplayNames: Array.isArray(data.previousDisplayNames) ? data.previousDisplayNames : [] };
          if (data.email) emailProfileMap[data.email] = { displayName: data.displayName, uid: doc.id, previousDisplayNames: Array.isArray(data.previousDisplayNames) ? data.previousDisplayNames : [] };
        }
      });
    }
    var emailsToFetch = emails.filter(function(e) { return !emailProfileMap[e]; });
    for (var j = 0; j < emailsToFetch.length; j += 10) {
      var emailBatch = emailsToFetch.slice(j, j + 10);
      var esnap = await window.FirestoreDB.db.collection('users')
        .where('email', 'in', emailBatch).get();
      esnap.forEach(function(doc) {
        var data = doc.data();
        if (data.displayName && data.email) {
          emailProfileMap[data.email] = { displayName: data.displayName, uid: doc.id, previousDisplayNames: Array.isArray(data.previousDisplayNames) ? data.previousDisplayNames : [] };
        }
      });
    }
  } catch(e) {
    console.warn('[AutoFixNames] Error fetching profiles:', e);
    return;
  }

  // Build reverse map: currentProfileName → { uid, email } for detecting stale names in matches
  var _currentNameToProfile = {};
  Object.keys(profileMap).forEach(function(uid) {
    var p = profileMap[uid];
    _currentNameToProfile[p.displayName] = { uid: uid, email: p.email };
  });
  Object.keys(emailProfileMap).forEach(function(email) {
    var p = emailProfileMap[email];
    if (!_currentNameToProfile[p.displayName]) _currentNameToProfile[p.displayName] = { uid: p.uid, email: email };
  });

  var fixes = [];
  var _addFix = function(oldN, newN, uid, email) {
    if (!oldN || !newN || oldN === newN) return;
    if (!fixes.some(function(f) { return f.oldName === oldN && f.newName === newN; })) {
      fixes.push({ oldName: oldN, newName: newN, uid: uid, email: email });
    }
  };

  uids.forEach(function(uid) {
    var stored = uidMap[uid].storedName;
    var profile = profileMap[uid];
    if (profile && stored && profile.displayName !== stored) {
      _addFix(stored, profile.displayName, uid, uidMap[uid].email || profile.email);
    }
  });
  emails.forEach(function(email) {
    var stored = emailMap[email];
    var profile = emailProfileMap[email];
    if (profile && stored && profile.displayName !== stored) {
      _addFix(stored, profile.displayName, profile.uid || null, email);
    }
  });

  // Also scan match p1/p2 and sorteioRealizado for stale names not caught above
  // (e.g., when participant object was already updated but match strings still have old name)
  tournamentsToScan.forEach(function(t) {
    var _knownCurrentNames = {};
    var parts = Array.isArray(t.participants) ? t.participants : [];
    parts.forEach(function(p) {
      if (typeof p === 'object' && p !== null) {
        var nm = p.displayName || p.name || '';
        if (nm) _knownCurrentNames[nm] = { uid: p.uid || null, email: p.email || null };
      }
    });
    var _checkStaleInStr = function(str) {
      if (!str || typeof str !== 'string') return;
      var names = str.indexOf(' / ') !== -1 ? str.split(' / ').map(function(n) { return n.trim(); }) : [str];
      names.forEach(function(name) {
        if (!name || name === 'BYE' || name === 'TBD' || _knownCurrentNames[name]) return;
        // This name is in a match but NOT a current participant name — check all profiles
        Object.keys(_currentNameToProfile).forEach(function(profileName) {
          if (profileName === name) return; // name IS current — no fix needed
          var prof = _currentNameToProfile[profileName];
          // Check if this stale name was previously used by this profile's uid/email
          if (prof.uid && uidMap[prof.uid] && uidMap[prof.uid].storedName === name) {
            _addFix(name, profileName, prof.uid, prof.email);
          } else if (prof.email && emailMap[prof.email] === name) {
            _addFix(name, profileName, prof.uid, prof.email);
          }
        });
      });
    };
    var _scanMatchStale = function(m) { if (!m) return; _checkStaleInStr(m.p1); _checkStaleInStr(m.p2); _checkStaleInStr(m.winner); };
    if (Array.isArray(t.matches)) t.matches.forEach(_scanMatchStale);
    if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) r.matches.forEach(_scanMatchStale); });
    if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
      if (!g) return;
      if (Array.isArray(g.matches)) g.matches.forEach(_scanMatchStale);
      if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr)) gr.forEach(_scanMatchStale); else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_scanMatchStale); });
      if (Array.isArray(g.players)) g.players.forEach(function(pl) { _checkStaleInStr(pl); });
    });
    if (Array.isArray(t.sorteioRealizado)) t.sorteioRealizado.forEach(function(item) {
      if (typeof item === 'string') _checkStaleInStr(item);
      else if (typeof item === 'object' && item) { _checkStaleInStr(item.name); _checkStaleInStr(item.displayName); }
    });
  });

  // Also check previousDisplayNames: scan ALL tournament strings for old names
  // This catches the case where participant object is already updated but team strings have old name
  var _prevNameMap = {}; // oldName → { newName, uid, email }
  Object.keys(profileMap).forEach(function(uid) {
    var p = profileMap[uid];
    if (p.previousDisplayNames && p.previousDisplayNames.length > 0) {
      p.previousDisplayNames.forEach(function(oldN) {
        _prevNameMap[oldN] = { newName: p.displayName, uid: uid, email: p.email };
      });
    }
  });
  Object.keys(emailProfileMap).forEach(function(email) {
    var p = emailProfileMap[email];
    if (p.previousDisplayNames && p.previousDisplayNames.length > 0) {
      p.previousDisplayNames.forEach(function(oldN) {
        if (!_prevNameMap[oldN]) _prevNameMap[oldN] = { newName: p.displayName, uid: p.uid, email: email };
      });
    }
  });

  if (Object.keys(_prevNameMap).length > 0) {
    console.debug('[AutoFixNames] Previous display names found:', Object.keys(_prevNameMap));
    // Scan ALL tournament data for these old names
    tournamentsToScan.forEach(function(t) {
      var parts = Array.isArray(t.participants) ? t.participants : [];
      var _allStrings = [];
      // Collect all string data to search
      parts.forEach(function(p) { if (typeof p === 'string') _allStrings.push(p); });
      var _collectFromMatch = function(m) {
        if (!m) return;
        if (m.p1) _allStrings.push(m.p1);
        if (m.p2) _allStrings.push(m.p2);
        if (m.winner) _allStrings.push(m.winner);
      };
      if (Array.isArray(t.matches)) t.matches.forEach(_collectFromMatch);
      if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) r.matches.forEach(_collectFromMatch); });
      if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
        if (!g) return;
        if (Array.isArray(g.matches)) g.matches.forEach(_collectFromMatch);
        if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr)) gr.forEach(_collectFromMatch); else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_collectFromMatch); });
        if (Array.isArray(g.players)) g.players.forEach(function(pl) { _allStrings.push(pl); });
      });
      if (Array.isArray(t.sorteioRealizado)) t.sorteioRealizado.forEach(function(item) {
        if (typeof item === 'string') _allStrings.push(item);
        else if (typeof item === 'object' && item) { if (item.name) _allStrings.push(item.name); if (item.displayName) _allStrings.push(item.displayName); }
      });

      // Check each string for old names
      _allStrings.forEach(function(str) {
        Object.keys(_prevNameMap).forEach(function(oldName) {
          if (str === oldName || (str.indexOf(oldName) !== -1 && str.indexOf(' / ') !== -1)) {
            var info = _prevNameMap[oldName];
            _addFix(oldName, info.newName, info.uid, info.email);
          }
        });
      });
    });
  }

  if (fixes.length > 0) {
    console.debug('[AutoFixNames] Fixing ' + fixes.length + ' stale name(s):', fixes.map(function(f) { return '"' + f.oldName + '" → "' + f.newName + '"'; }));
    fixes.forEach(function(f) {
      window._propagateNameChange(f.oldName, f.newName, f.uid, f.email);
    });
    setTimeout(function() { if (typeof window._softRefreshView === 'function') window._softRefreshView(); }, 500);
  } else {
    console.debug('[AutoFixNames] All names up to date');
  }
};

// ─── Propagate displayName change across all tournaments ─────────────────
window._propagateNameChange = function _propagateNameChange(oldName, newName, targetUid, targetEmail) {
  if (!oldName || !newName || oldName === newName) return;
  if (!window.AppStore || !Array.isArray(window.AppStore.tournaments)) return;
  console.debug('[PropageName] "' + oldName + '" → "' + newName + '" (uid=' + (targetUid || 'none') + ', email=' + (targetEmail || 'none') + ')');

  var user = window.AppStore.currentUser;
  var matchUid = targetUid || (user ? user.uid : null);
  var matchEmail = targetEmail || (user ? user.email : null);
  var modifiedTournaments = [];

  window.AppStore.tournaments.forEach(function(t) {
    var changed = false;
    var parts = Array.isArray(t.participants) ? t.participants : [];
    parts.forEach(function(p, idx) {
      if (typeof p === 'string') {
        if (p === oldName) { parts[idx] = newName; changed = true; }
        // Handle team strings: "OldName / Partner" → "NewName / Partner"
        else if (p.indexOf(oldName) !== -1 && p.indexOf(' / ') !== -1) {
          var newTeam = p.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (newTeam !== p) { parts[idx] = newTeam; changed = true; }
        }
        return;
      }
      if (typeof p === 'object' && p !== null) {
        var isUser = (matchUid && p.uid === matchUid) || (matchEmail && p.email === matchEmail) || p.displayName === oldName || p.name === oldName;
        if (isUser) {
          if (p.displayName === oldName) { p.displayName = newName; changed = true; }
          if (p.name === oldName) { p.name = newName; changed = true; }
          if (matchUid && !p.uid) { p.uid = matchUid; changed = true; }
          if (matchEmail && !p.email) { p.email = matchEmail; changed = true; }
        }
      }
    });

    function _updateMatch(m) {
      if (!m) return;
      if (m.p1 === oldName) { m.p1 = newName; changed = true; }
      if (m.p2 === oldName) { m.p2 = newName; changed = true; }
      if (m.winner === oldName) { m.winner = newName; changed = true; }
      if (Array.isArray(m.team1)) { var i1 = m.team1.indexOf(oldName); if (i1 !== -1) { m.team1[i1] = newName; changed = true; } }
      if (Array.isArray(m.team2)) { var i2 = m.team2.indexOf(oldName); if (i2 !== -1) { m.team2[i2] = newName; changed = true; } }
      if (m.p1 && m.p1.indexOf(oldName) !== -1 && m.p1.indexOf(' / ') !== -1) {
        var newP1 = m.p1.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
        if (newP1 !== m.p1) { m.p1 = newP1; changed = true; }
      }
      if (m.p2 && m.p2.indexOf(oldName) !== -1 && m.p2.indexOf(' / ') !== -1) {
        var newP2 = m.p2.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
        if (newP2 !== m.p2) { m.p2 = newP2; changed = true; }
      }
      if (m.winner && m.winner.indexOf(oldName) !== -1 && m.winner.indexOf(' / ') !== -1) {
        var newW = m.winner.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
        if (newW !== m.winner) { m.winner = newW; changed = true; }
      }
    }

    if (Array.isArray(t.matches)) t.matches.forEach(_updateMatch);
    _updateMatch(t.thirdPlaceMatch);
    if (Array.isArray(t.rounds)) { t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) r.matches.forEach(_updateMatch); }); }
    if (Array.isArray(t.groups)) {
      t.groups.forEach(function(g) {
        if (!g) return;
        if (Array.isArray(g.matches)) g.matches.forEach(_updateMatch);
        if (Array.isArray(g.rounds)) { g.rounds.forEach(function(gr) { if (Array.isArray(gr)) gr.forEach(_updateMatch); else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_updateMatch); }); }
        if (Array.isArray(g.players)) { var pi = g.players.indexOf(oldName); if (pi !== -1) { g.players[pi] = newName; changed = true; } }
      });
    }
    if (Array.isArray(t.rodadas)) { t.rodadas.forEach(function(r) { if (Array.isArray(r)) r.forEach(_updateMatch); else if (r && Array.isArray(r.matches)) r.matches.forEach(_updateMatch); }); }
    if (t.classification && t.classification[oldName] !== undefined) { t.classification[newName] = t.classification[oldName]; delete t.classification[oldName]; changed = true; }
    ['checkedIn', 'absent', 'vips'].forEach(function(field) {
      if (!t[field]) return;
      if (t[field][oldName] !== undefined) { t[field][newName] = t[field][oldName]; delete t[field][oldName]; changed = true; }
      // Also handle team string keys: "OldName / Partner" → "NewName / Partner"
      Object.keys(t[field]).forEach(function(k) {
        if (k.indexOf(oldName) !== -1 && k.indexOf(' / ') !== -1) {
          var newKey = k.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (newKey !== k) { t[field][newKey] = t[field][k]; delete t[field][k]; changed = true; }
        }
      });
    });
    if (Array.isArray(t.standings)) { t.standings.forEach(function(s) { if (s.name === oldName) { s.name = newName; changed = true; } if (s.player === oldName) { s.player = newName; changed = true; } }); }
    if (Array.isArray(t.sorteioRealizado)) { t.sorteioRealizado.forEach(function(item, idx) {
      if (typeof item === 'string') {
        if (item === oldName) { t.sorteioRealizado[idx] = newName; changed = true; }
        else if (item.indexOf(oldName) !== -1 && item.indexOf(' / ') !== -1) {
          var newSR = item.split(' / ').map(function(n) { return n.trim() === oldName ? newName : n.trim(); }).join(' / ');
          if (newSR !== item) { t.sorteioRealizado[idx] = newSR; changed = true; }
        }
      } else if (typeof item === 'object' && item !== null) {
        if (item.name === oldName) { item.name = newName; changed = true; }
        if (item.displayName === oldName) { item.displayName = newName; changed = true; }
      }
    }); }
    if (t.organizerName === oldName) { t.organizerName = newName; changed = true; }
    if (changed) modifiedTournaments.push(t);
  });

  if (modifiedTournaments.length > 0 && window.FirestoreDB && window.FirestoreDB.saveTournament) {
    console.debug('[PropageName] Saving ' + modifiedTournaments.length + ' tournament(s) to Firestore');
    var savePromises = modifiedTournaments.map(function(t) {
      t.updatedAt = new Date().toISOString();
      return window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('[PropageName] Save error for ' + t.id + ':', err); });
    });
    Promise.all(savePromises).then(function() {
      console.debug('[PropageName] All saves complete, refreshing UI');
      if (typeof window._softRefreshView === 'function') window._softRefreshView();
    });
    if (typeof showNotification !== 'undefined') {
      showNotification(_t('auth.nameUpdated'), _t('auth.nameUpdatedMsg', {old: oldName, new: newName, n: modifiedTournaments.length}), 'info');
    }
  } else {
    console.debug('[PropageName] No tournaments needed updating');
  }
};

function setupProfileModal() {
  var _t = window._t || function(k) { return k; };
  if (!document.getElementById('modal-profile')) {
    // Country select options
    var countryOpts = _phoneCountries.map(function(c) {
      return '<option value="' + c.code + '">' + c.flag + ' +' + c.code + '</option>';
    }).join('');

    var modalHtml = '<div class="modal-overlay" id="modal-profile">' +
      '<div class="modal" style="max-width: 520px; max-height: 90vh; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; width: calc(100% - 2rem);">' +
        '<div class="modal-header" style="position: sticky; top: 0; z-index: 2; background: var(--bg-card); padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center;">' +
          '<h2 class="card-title" style="margin:0;font-size:1.1rem;">' + _t('profile.myProfile') + '</h2>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById(\'modal-profile\').classList.remove(\'active\')">' + _t('btn.cancel') + '</button>' +
            '<button type="button" class="btn btn-primary btn-sm" onclick="if(typeof saveUserProfile===\'function\')saveUserProfile()">' + _t('btn.save') + '</button>' +
          '</div>' +
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
              '<label class="form-label" style="font-size: 0.75rem; margin-bottom: 2px;">' + _t('profile.labelName') + '</label>' +
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
                '<label class="form-label" style="font-size: 0.75rem;">' + _t('profile.labelSex') + '</label>' +
                '<select id="profile-edit-gender" class="form-control" style="width: 100%; box-sizing: border-box;">' +
                  '<option value="">' + _t('profile.sexNotInform') + '</option>' +
                  '<option value="masculino">' + _t('profile.sexMasc') + '</option>' +
                  '<option value="feminino">' + _t('profile.sexFem') + '</option>' +
                  '<option value="outro">' + _t('profile.sexOther') + '</option>' +
                '</select>' +
              '</div>' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">' + _t('profile.labelBirth') + '</label>' +
                '<input type="date" id="profile-edit-birthdate" class="form-control" style="width: 100%; box-sizing: border-box;">' +
              '</div>' +
            '</div>' +
            // Row: Cidade + Categoria (2 colunas)
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">' + _t('profile.labelCity') + '</label>' +
                '<input type="text" id="profile-edit-city" class="form-control" style="width: 100%; box-sizing: border-box;" placeholder="Ex: São Paulo">' +
              '</div>' +
              '<div class="form-group" style="margin: 0;">' +
                '<label class="form-label" style="font-size: 0.75rem;">' + _t('profile.labelCategory') + '</label>' +
                '<input type="text" id="profile-edit-category" class="form-control" style="width: 100%; box-sizing: border-box;" placeholder="Ex: C, Iniciante">' +
              '</div>' +
            '</div>' +
            // Esportes Preferidos (linha inteira)
            '<div class="form-group" style="margin-bottom: 10px;">' +
              '<label class="form-label" style="font-size: 0.75rem;">' + _t('profile.labelSports') + '</label>' +
              '<input type="text" id="profile-edit-sports" class="form-control" style="width: 100%; box-sizing: border-box;" placeholder="Ex: Tênis, Padel, Beach Tennis">' +
              '<span style="font-size: 0.65rem; color: var(--text-muted); opacity: 0.6; margin-top: 2px; display: block;">' + _t('profile.sportsSeparator') + '</span>' +
            '</div>' +
            // Telefone: País + Número
            '<div class="form-group" style="margin-bottom: 10px;">' +
              '<label class="form-label" style="font-size: 0.75rem;">' + _t('profile.labelWhatsApp') + '</label>' +
              '<div style="display: flex; gap: 6px;">' +
                '<select id="profile-phone-country" class="form-control" style="width: 120px; flex-shrink: 0; box-sizing: border-box; font-size: 0.85rem;" onchange="var inp=document.getElementById(\'profile-edit-phone\'); var d=inp.getAttribute(\'data-digits\')||\'\'; inp.value=_formatPhoneDisplay(d,this.value);">' +
                  countryOpts +
                '</select>' +
                '<input type="tel" id="profile-edit-phone" class="form-control" style="flex: 1; min-width: 0; box-sizing: border-box;" placeholder="(11) 99723-7733" data-digits="">' +
              '</div>' +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            // Social toggle + notification filters
            '<div style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.8rem;">' + _t('profile.socialCommsTitle') + '</label>' +
              '<p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 8px 0;">' + _t('profile.socialCommsDesc') + '</p>' +
              (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-accept-friends', label: _t('profile.acceptFriends'), icon: '🤝', checked: true, color: '#3b82f6' }) : '') +
              '<div style="margin-top:6px;">' +
                '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">' + _t('profile.receiveComms') + '</div>' +
                (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-filter-todas', label: _t('profile.notifAll'), icon: '🟢', checked: true, color: '#22c55e', onchange: 'window._onNotifyToggle(\'todas\')' }) : '') +
                (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-filter-importantes', label: _t('profile.notifImportant'), icon: '🟡', checked: false, color: '#f59e0b', onchange: 'window._onNotifyToggle(\'importantes\')' }) : '') +
                (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-filter-fundamentais', label: _t('profile.notifFundamental'), icon: '🔴', checked: false, color: '#ef4444', onchange: 'window._onNotifyToggle(\'fundamentais\')' }) : '') +
              '</div>' +
              // Notification channel toggles (between comm filters and locations)
              '<div style="margin-top:10px;">' +
                '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">' + _t('profile.notifChannels') + '</div>' +
                (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-notify-platform', label: _t('profile.notifPlatform'), icon: '🔔', checked: true }) : '') +
                (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-notify-email', label: _t('profile.notifEmail'), icon: '✉️', checked: true, color: '#3b82f6' }) : '') +
              '</div>' +
            '</div>' +
            // Locais de preferência (mapa)
            '<div class="form-group" style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="font-size: 0.8rem; font-weight: 600;">' + _t('profile.labelLocations') + '</label>' +
              '<p style="font-size: 0.7rem; color: var(--text-muted); margin: 0 0 8px 0;">' + _t('profile.locationsDesc') + '</p>' +
              '<div style="position:relative;display:flex;gap:6px;margin-bottom:8px;">' +
                '<input type="text" id="profile-location-search" class="form-control" placeholder="' + _t('profile.searchLocation') + '" style="flex:1;box-sizing:border-box;font-size:0.8rem;" autocomplete="off">' +
                '<button type="button" id="profile-locate-btn" onclick="window._profileLocateMe()" class="btn btn-sm" style="background:var(--primary-color);color:#fff;border:none;white-space:nowrap;font-size:0.75rem;padding:6px 10px;" title="Usar minha localização">📍</button>' +
                '<div id="profile-location-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:9999;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.5);max-height:240px;overflow-y:auto;margin-top:4px;"></div>' +
              '</div>' +
              '<div id="profile-map-container" style="width:100%;height:200px;border-radius:10px;overflow:hidden;border:1px solid var(--border-color);margin-bottom:8px;background:#1a1a2e;"></div>' +
              '<div id="profile-locations-list" style="display:flex;flex-direction:column;gap:4px;"></div>' +
              '<input type="hidden" id="profile-edit-ceps" value="">' +
            '</div>' +
            '<div style="height: 1px; background: var(--border-color); margin: 1rem 0;"></div>' +
            // Theme — exclusive buttons
            '<div class="form-group" style="margin-bottom: 1rem;">' +
              '<label class="form-label" style="font-size: 0.8rem; font-weight: 600;">' + _t('profile.labelAppearance') + '</label>' +
              '<div id="theme-btn-group" style="display:flex;gap:6px;flex-wrap:nowrap;">' +
                '<button type="button" data-theme-val="dark" onclick="window._setProfileTheme(\'dark\')" class="btn btn-sm" style="flex:1;font-size:0.72rem;padding:7px 4px;border-radius:10px;transition:all 0.2s;white-space:nowrap;">' + _t('profile.themeNight') + '</button>' +
                '<button type="button" data-theme-val="light" onclick="window._setProfileTheme(\'light\')" class="btn btn-sm" style="flex:1;font-size:0.72rem;padding:7px 4px;border-radius:10px;transition:all 0.2s;white-space:nowrap;">' + _t('profile.themeLight') + '</button>' +
                '<button type="button" data-theme-val="sunset" onclick="window._setProfileTheme(\'sunset\')" class="btn btn-sm" style="flex:1;font-size:0.72rem;padding:7px 4px;border-radius:10px;transition:all 0.2s;white-space:nowrap;">' + _t('profile.themeSunset') + '</button>' +
                '<button type="button" data-theme-val="ocean" onclick="window._setProfileTheme(\'ocean\')" class="btn btn-sm" style="flex:1;font-size:0.72rem;padding:7px 4px;border-radius:10px;transition:all 0.2s;white-space:nowrap;">' + _t('profile.themeOcean') + '</button>' +
              '</div>' +
            '</div>' +
            // Visual Hints toggle
            '<div style="margin-bottom: 1rem;">' +
              (window._toggleSwitch ? window._toggleSwitch({ id: 'profile-hints-enabled', label: _t('profile.visualHints'), icon: '💡', checked: true, color: '#fbbf24', desc: _t('profile.hintsDesc') }) : '') +
            '</div>' +
            // Language selector — flag buttons
            '<div style="margin-bottom: 1rem;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                '<label class="form-label" style="font-size: 0.8rem; font-weight: 600; margin: 0; flex-shrink: 0;">' + _t('profile.language') + '</label>' +
                '<div style="display:flex;gap:6px;flex-shrink:0;" id="profile-lang-flags">' +
                  '<button type="button" onclick="if(typeof window._setLang===\'function\'){window._setLang(\'pt\');document.querySelectorAll(\'#profile-lang-flags button\').forEach(function(b){b.style.opacity=\'0.4\';b.style.transform=\'scale(1)\';b.style.boxShadow=\'none\'});this.style.opacity=\'1\';this.style.transform=\'scale(1.15)\';this.style.boxShadow=\'0 0 8px rgba(251,191,36,0.4)\'}" style="font-size:1.4rem;background:none;border:2px solid ' + (window._lang === 'pt' ? '#fbbf24' : 'transparent') + ';border-radius:8px;padding:3px 6px;cursor:pointer;opacity:' + (window._lang === 'pt' ? '1' : '0.4') + ';transform:scale(' + (window._lang === 'pt' ? '1.15' : '1') + ');transition:all 0.2s;' + (window._lang === 'pt' ? 'box-shadow:0 0 8px rgba(251,191,36,0.4)' : '') + '" title="Português">🇧🇷</button>' +
                  '<button type="button" onclick="if(typeof window._setLang===\'function\'){window._setLang(\'en\');document.querySelectorAll(\'#profile-lang-flags button\').forEach(function(b){b.style.opacity=\'0.4\';b.style.transform=\'scale(1)\';b.style.boxShadow=\'none\'});this.style.opacity=\'1\';this.style.transform=\'scale(1.15)\';this.style.boxShadow=\'0 0 8px rgba(251,191,36,0.4)\'}" style="font-size:1.4rem;background:none;border:2px solid ' + (window._lang === 'en' ? '#fbbf24' : 'transparent') + ';border-radius:8px;padding:3px 6px;cursor:pointer;opacity:' + (window._lang === 'en' ? '1' : '0.4') + ';transform:scale(' + (window._lang === 'en' ? '1.15' : '1') + ');transition:all 0.2s;' + (window._lang === 'en' ? 'box-shadow:0 0 8px rgba(251,191,36,0.4)' : '') + '" title="English">🇺🇸</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            // Buttons
            /* Salvar/Sair buttons moved to sticky header */ '' +
            '<div style="text-align: center; padding: 0.5rem 0 0.5rem;">' +
              '<button type="button" class="btn btn-ghost btn-micro" onclick="window._confirmDeleteAccount()" style="text-decoration:underline;">' + _t('profile.deleteAccountPerm') + '</button>' +
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

    // Notification filter toggles: todas (green), importantes (yellow), fundamentais (red)
    // todas ON = receive everything; importantes ON = important + fundamental; fundamentais ON = fundamental only
    // Cascade: todas ON → imp+fund ON; todas OFF keeps imp/fund as-is; fund OFF → confirm warning
    window._applyNotifyFilterUI = function(level) {
      var todasEl = document.getElementById('profile-filter-todas');
      var impEl = document.getElementById('profile-filter-importantes');
      var funEl = document.getElementById('profile-filter-fundamentais');
      if (todasEl) todasEl.checked = (level === 'todas');
      if (impEl) impEl.checked = (level === 'todas' || level === 'importantes');
      if (funEl) funEl.checked = true; // fundamentais always on by default
      if (level === 'none') {
        if (todasEl) todasEl.checked = false;
        if (impEl) impEl.checked = false;
        if (funEl) funEl.checked = false;
      }
    };

    window._onNotifyToggle = function(which) {
      var todasEl = document.getElementById('profile-filter-todas');
      var impEl = document.getElementById('profile-filter-importantes');
      var funEl = document.getElementById('profile-filter-fundamentais');
      if (!todasEl || !impEl || !funEl) return;

      if (which === 'todas') {
        if (todasEl.checked) {
          // Turning ON todas → auto-enable importantes + fundamentais
          impEl.checked = true;
          funEl.checked = true;
        }
        // Turning OFF todas just means user doesn't want "all" — imp/fund stay as-is
      } else if (which === 'importantes') {
        if (impEl.checked) {
          // Turning ON importantes → also turn on fundamentais (it's a subset)
          funEl.checked = true;
        }
        // Turning OFF importantes → also turn off todas
        if (!impEl.checked) todasEl.checked = false;
      } else if (which === 'fundamentais') {
        if (!funEl.checked) {
          // Warn before disabling fundamentais
          if (typeof showConfirmDialog === 'function') {
            showConfirmDialog(
              _t('auth.disableFundTitle'),
              _t('auth.disableFundMsg'),
              function() {
                // Confirmed: disable all
                funEl.checked = false;
                impEl.checked = false;
                todasEl.checked = false;
              },
              function() {
                // Cancelled: revert
                funEl.checked = true;
              }
            );
            // Revert immediately (dialog is async) — confirmed callback will re-set
            funEl.checked = true;
            return;
          }
        }
        // Turning OFF fundamentais → also off importantes and todas
        if (!funEl.checked) {
          impEl.checked = false;
          todasEl.checked = false;
        }
      }
    };

    // ─── Profile Theme Buttons ──────────────────────────────────────────────
    var _themeColors = { dark: '#6366f1', light: '#f59e0b', sunset: '#ef4444', ocean: '#0ea5e9' };

    window._setProfileTheme = function(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('scoreplace_theme', theme); } catch(e) {}
      if (typeof window._applyThemeIcon === 'function') window._applyThemeIcon(theme);
      window._applyProfileThemeUI(theme);
    };

    window._applyProfileThemeUI = function(theme) {
      var group = document.getElementById('theme-btn-group');
      if (!group) return;
      var btns = group.querySelectorAll('button[data-theme-val]');
      btns.forEach(function(btn) {
        var val = btn.getAttribute('data-theme-val');
        var isActive = (val === theme);
        var color = _themeColors[val] || '#6366f1';
        btn.style.background = isActive ? color : 'transparent';
        btn.style.color = isActive ? '#fff' : 'var(--text-muted)';
        btn.style.border = isActive ? ('2px solid ' + color) : '1.5px solid var(--border-color)';
        btn.style.boxShadow = isActive ? ('0 0 10px ' + color + '40') : 'none';
        btn.style.fontWeight = isActive ? '700' : '500';
      });
    };

    // ─── Profile Map: location picker ────────────────────────────────────────
    window._profileLocations = window._profileLocations || [];
    var _profileMap = null;
    var _profileMarkers = [];
    var _profilePlacesLib = null;

    window._initProfileMap = async function() {
      var container = document.getElementById('profile-map-container');
      if (!container || !window.google || !window.google.maps) return;
      try {
        var { Map } = await google.maps.importLibrary('maps');
        var { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
        _profilePlacesLib = await google.maps.importLibrary('places');

        // Default center: São Paulo or first saved location
        var locs = window._profileLocations || [];
        var center = locs.length > 0
          ? { lat: locs[0].lat, lng: locs[0].lng }
          : { lat: -23.55, lng: -46.63 };
        var zoom = locs.length > 0 ? 12 : 10;

        _profileMap = new Map(container, {
          center: center,
          zoom: zoom,
          mapId: 'scoreplace-profile-map',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          colorScheme: 'DARK'
        });

        // Click on map to add pin
        _profileMap.addListener('click', function(e) {
          if (!e.latLng) return;
          var lat = e.latLng.lat();
          var lng = e.latLng.lng();
          // Reverse geocode to get label
          _reverseGeocode(lat, lng, function(label) {
            _addProfileLocation({ lat: lat, lng: lng, label: label || (lat.toFixed(4) + ', ' + lng.toFixed(4)) });
          });
        });

        // Render existing pins
        _renderProfileMarkers();
        _renderProfileLocationsList();

        // Setup search
        _setupProfileSearch();
      } catch (e) {
        console.warn('[profile-map] init error:', e);
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.75rem;">' + _t('auth.mapUnavailable') + '</div>';
      }
    };

    function _reverseGeocode(lat, lng, callback) {
      if (!window.google || !window.google.maps) { callback(null); return; }
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: lat, lng: lng } }, function(results, status) {
        if (status === 'OK' && results && results[0]) {
          // Try to get a short label: neighborhood, sublocality, or formatted
          var comps = results[0].address_components || [];
          var neighborhood = '', city = '', short = '';
          comps.forEach(function(c) {
            if (c.types.indexOf('sublocality_level_1') !== -1 || c.types.indexOf('neighborhood') !== -1) neighborhood = c.long_name;
            if (c.types.indexOf('administrative_area_level_2') !== -1 || c.types.indexOf('locality') !== -1) city = c.long_name;
            if (c.types.indexOf('postal_code') !== -1) short = c.long_name;
          });
          var label = neighborhood ? (neighborhood + (city ? ', ' + city : '')) : (results[0].formatted_address || '');
          if (label.length > 60) label = label.substring(0, 57) + '...';
          callback(label);
        } else {
          callback(null);
        }
      });
    }

    function _addProfileLocation(loc) {
      if (!loc || !loc.lat || !loc.lng) return;
      // Max 5 locations
      var locs = window._profileLocations || [];
      if (locs.length >= 5) {
        if (typeof showNotification === 'function') showNotification(_t('auth.venueLimit'), _t('auth.venueLimitMsg'), 'warning');
        return;
      }
      // Avoid duplicates (within ~200m)
      var isDup = locs.some(function(l) {
        return Math.abs(l.lat - loc.lat) < 0.002 && Math.abs(l.lng - loc.lng) < 0.002;
      });
      if (isDup) {
        if (typeof showNotification === 'function') showNotification(_t('auth.venueDuplicate'), _t('auth.venueDuplicateMsg'), 'info');
        return;
      }
      locs.push({ lat: loc.lat, lng: loc.lng, label: loc.label || '' });
      window._profileLocations = locs;
      _renderProfileMarkers();
      _renderProfileLocationsList();
      _syncCepsFromLocations();
    }

    window._removeProfileLocation = function(idx) {
      var locs = window._profileLocations || [];
      if (idx >= 0 && idx < locs.length) {
        locs.splice(idx, 1);
        window._profileLocations = locs;
        _renderProfileMarkers();
        _renderProfileLocationsList();
        _syncCepsFromLocations();
      }
    };

    function _renderProfileMarkers() {
      // Clear existing markers
      _profileMarkers.forEach(function(m) { m.map = null; });
      _profileMarkers = [];
      if (!_profileMap) return;

      var locs = window._profileLocations || [];
      var bounds = new google.maps.LatLngBounds();

      locs.forEach(function(loc, idx) {
        var pin = document.createElement('div');
        pin.style.cssText = 'width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;cursor:pointer;';
        pin.textContent = String(idx + 1);

        var marker = new google.maps.marker.AdvancedMarkerElement({
          map: _profileMap,
          position: { lat: loc.lat, lng: loc.lng },
          content: pin,
          title: loc.label || ''
        });
        _profileMarkers.push(marker);
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      });

      if (locs.length > 1) {
        _profileMap.fitBounds(bounds, { top: 20, right: 20, bottom: 20, left: 20 });
      } else if (locs.length === 1) {
        _profileMap.setCenter({ lat: locs[0].lat, lng: locs[0].lng });
        _profileMap.setZoom(13);
      }
    }

    function _renderProfileLocationsList() {
      var listEl = document.getElementById('profile-locations-list');
      if (!listEl) return;
      var locs = window._profileLocations || [];
      if (locs.length === 0) {
        listEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center;padding:6px;">' + _t('auth.noLocationAdded') + '</div>';
        return;
      }
      listEl.innerHTML = locs.map(function(loc, idx) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:8px;">' +
          '<span style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:0.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (idx + 1) + '</span>' +
          '<span style="flex:1;font-size:0.72rem;color:var(--text-bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + window._safeHtml(loc.label) + '">' + window._safeHtml(loc.label) + '</span>' +
          '<button type="button" onclick="window._removeProfileLocation(' + idx + ')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:2px 4px;line-height:1;" title="Remover">&times;</button>' +
        '</div>';
      }).join('');
    }

    function _syncCepsFromLocations() {
      // Keep hidden CEP field updated for backward compat
      // (not critical — distance matching is the primary method now)
      var cepsEl = document.getElementById('profile-edit-ceps');
      if (cepsEl) {
        var labels = (window._profileLocations || []).map(function(l) { return l.label || ''; });
        cepsEl.value = labels.join(', ');
      }
    }

    var _profileSearchSetup = false;
    function _setupProfileSearch() {
      var input = document.getElementById('profile-location-search');
      var sugBox = document.getElementById('profile-location-suggestions');
      if (!input || !sugBox || _profileSearchSetup) return;
      _profileSearchSetup = true;

      // Proactively load Places library
      if (typeof google !== 'undefined' && google.maps && google.maps.importLibrary) {
        google.maps.importLibrary('places').then(function() {
          _profilePlacesLib = true;
        }).catch(function() {});
      }

      var _debounce = null;
      input.addEventListener('input', function() {
        clearTimeout(_debounce);
        var query = input.value.trim();
        if (query.length < 3) { sugBox.style.display = 'none'; return; }
        _debounce = setTimeout(function() { _searchProfileLocation(query); }, 300);
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { sugBox.style.display = 'none'; }
      });

      // Close on blur (with delay so mousedown click registers first)
      input.addEventListener('blur', function() {
        setTimeout(function() { sugBox.style.display = 'none'; }, 200);
      });

      // Reopen on focus if there are results
      input.addEventListener('focus', function() {
        if (input.value.trim().length >= 3 && sugBox.children.length > 0) {
          sugBox.style.display = 'block';
        }
      });
    }

    async function _searchProfileLocation(query) {
      var sugBox = document.getElementById('profile-location-suggestions');
      if (!sugBox) return;
      // Lazy-load places lib if not yet available
      if (!_profilePlacesLib && window.google && window.google.maps) {
        try { await google.maps.importLibrary('places'); _profilePlacesLib = true; } catch(e) {}
      }
      if (!_profilePlacesLib) {
        sugBox.innerHTML = '<div style="padding:10px 14px;color:#94a3b8;font-size:0.8rem;">Carregando API do Google...</div>';
        sugBox.style.display = 'block';
        return;
      }

      try {
        var request = {
          input: query,
          includedRegionCodes: ['br'],
          includedPrimaryTypes: ['establishment', 'geocode'],
          language: 'pt-BR'
        };
        var result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        var suggestions = result.suggestions || [];
        if (suggestions.length === 0) {
          sugBox.innerHTML = '<div style="padding:10px 14px;color:#94a3b8;font-size:0.8rem;">Nenhum resultado encontrado</div>';
          sugBox.style.display = 'block';
          return;
        }

        sugBox.innerHTML = '';
        suggestions.slice(0, 5).forEach(function(s, i) {
          var pred = s.placePrediction;
          if (!pred) return;
          var main = pred.mainText ? pred.mainText.text : '';
          var secondary = pred.secondaryText ? pred.secondaryText.text : '';

          var item = document.createElement('div');
          item.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.15s;';
          item.innerHTML = '<div style="color:var(--text-bright);font-size:0.85rem;font-weight:500;">📍 ' + window._safeHtml(main) + '</div>' +
            (secondary ? '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px;">' + window._safeHtml(secondary) + '</div>' : '');

          item.addEventListener('mouseenter', function() { item.style.background = 'rgba(129,140,248,0.15)'; });
          item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
          item.addEventListener('mousedown', function(e) {
            e.preventDefault(); // Prevent blur from hiding suggestions
            _selectProfileSuggestion(pred);
            sugBox.style.display = 'none';
          });

          sugBox.appendChild(item);
        });

        sugBox.style.display = 'block';
      } catch (e) {
        console.warn('[profile-map] search error:', e);
        sugBox.innerHTML = '<div style="padding:10px 14px;color:#f87171;font-size:0.8rem;">' + _t('auth.locationSearchError', {msg: window._safeHtml(e.message || 'API indisponível')}) + '</div>';
        sugBox.style.display = 'block';
      }
    }

    async function _selectProfileSuggestion(prediction) {
      try {
        var place = prediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
        var lat = place.location.lat();
        var lng = place.location.lng();
        var label = (place.displayName || '') + (place.formattedAddress ? ' — ' + place.formattedAddress : '');
        if (label.length > 60) label = label.substring(0, 57) + '...';
        _addProfileLocation({ lat: lat, lng: lng, label: label });
        // Clear search
        var input = document.getElementById('profile-location-search');
        if (input) input.value = '';
        // Pan map
        if (_profileMap) {
          _profileMap.panTo({ lat: lat, lng: lng });
          _profileMap.setZoom(14);
        }
      } catch (e) {
        console.warn('[profile-map] select error:', e);
      }
    }

    window._profileLocateMe = function() {
      if (!navigator.geolocation) {
        if (typeof showNotification === 'function') showNotification(_t('auth.geoError'), _t('auth.geoNotSupported'), 'warning');
        return;
      }
      var btn = document.getElementById('profile-locate-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          if (btn) { btn.disabled = false; btn.textContent = '📍'; }
          _reverseGeocode(lat, lng, function(label) {
            _addProfileLocation({ lat: lat, lng: lng, label: label || _t('auth.myLocation') });
            if (_profileMap) {
              _profileMap.panTo({ lat: lat, lng: lng });
              _profileMap.setZoom(14);
            }
          });
        },
        function(err) {
          if (btn) { btn.disabled = false; btn.textContent = '📍'; }
          if (typeof showNotification === 'function') showNotification(_t('auth.geoError'), _t('auth.geoFailed'), 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    // ─── End Profile Map ──────────────────────────────────────────────────────

    window._selectAvatar = function(src) {
      document.getElementById('profile-avatar').src = src;
      document.getElementById('avatar-picker').style.display = 'none';
      if (window.AppStore.currentUser) {
        window.AppStore.currentUser.photoURL = src;
      }
    };

    window.saveUserProfile = async function() {
      if (!window.AppStore.currentUser) return;
      var _oldDisplayName = window.AppStore.currentUser.displayName || '';
      var name = document.getElementById('profile-edit-name').value.trim();
      var gender = document.getElementById('profile-edit-gender').value;
      var birthDate = document.getElementById('profile-edit-birthdate').value;
      var city = document.getElementById('profile-edit-city').value.trim();
      // Phone: grab raw digits only
      var phoneDigits = (document.getElementById('profile-edit-phone').getAttribute('data-digits') || '').replace(/\D/g, '');
      var phoneCountry = document.getElementById('profile-phone-country').value || '55';
      var sports = document.getElementById('profile-edit-sports').value.trim();
      var category = document.getElementById('profile-edit-category').value.trim();
      // Toggle switches: read checked state
      var acceptFriends = document.getElementById('profile-accept-friends') ? document.getElementById('profile-accept-friends').checked : true;
      var notifyPlatform = document.getElementById('profile-notify-platform') ? document.getElementById('profile-notify-platform').checked : true;
      var notifyEmail = document.getElementById('profile-notify-email') ? document.getElementById('profile-notify-email').checked : true;
      var _todasChecked = document.getElementById('profile-filter-todas') ? document.getElementById('profile-filter-todas').checked : true;
      var _impChecked = document.getElementById('profile-filter-importantes') ? document.getElementById('profile-filter-importantes').checked : false;
      var _funChecked = document.getElementById('profile-filter-fundamentais') ? document.getElementById('profile-filter-fundamentais').checked : false;
      var notifyLevel = _todasChecked ? 'todas' : (_impChecked ? 'importantes' : (_funChecked ? 'fundamentais' : 'none'));
      var preferredCeps = document.getElementById('profile-edit-ceps').value.trim();
      var preferredLocations = Array.isArray(window._profileLocations) ? window._profileLocations : [];
      // Visual hints toggle
      var hintsEnabled = document.getElementById('profile-hints-enabled') ? document.getElementById('profile-hints-enabled').checked : true;
      if (window._hintSystem) {
        if (hintsEnabled) window._hintSystem.enable();
        else window._hintSystem.disable();
      }

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
      window.AppStore.currentUser.notifyLevel = notifyLevel;
      window.AppStore.currentUser.preferredCeps = preferredCeps;
      window.AppStore.currentUser.preferredLocations = preferredLocations;

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

      // Propagate name change to all tournaments if displayName changed
      if (name && _oldDisplayName && name !== _oldDisplayName) {
        // Save previousDisplayName to Firestore for future auto-fix of orphaned names
        try {
          var user = window.AppStore.currentUser;
          if (user && user.uid && window.FirestoreDB && window.FirestoreDB.db) {
            var _prevNames = Array.isArray(user.previousDisplayNames) ? user.previousDisplayNames.slice() : [];
            if (_prevNames.indexOf(_oldDisplayName) === -1) _prevNames.push(_oldDisplayName);
            // Keep last 5
            if (_prevNames.length > 5) _prevNames = _prevNames.slice(_prevNames.length - 5);
            window.FirestoreDB.db.collection('users').doc(user.uid).update({
              previousDisplayNames: _prevNames
            }).catch(function(e) { console.warn('[Profile] Failed to save previousDisplayNames:', e); });
            window.AppStore.currentUser.previousDisplayNames = _prevNames;
          }
        } catch(e) { console.warn('[Profile] previousDisplayNames error:', e); }

        _propagateNameChange(_oldDisplayName, name);
        // Update auth cache with new name
        try {
          var _ac = JSON.parse(localStorage.getItem('scoreplace_authCache') || '{}');
          _ac.displayName = name;
          localStorage.setItem('scoreplace_authCache', JSON.stringify(_ac));
        } catch(e) {}
      }

      // Update header UI with new name and photo
      var photoUrl = window.AppStore.currentUser.photoURL || 'https://api.dicebear.com/7.x/notionists/svg?seed=Generico';
      var firstName = name ? name.split(' ')[0] : _t('auth.defaultUser');
      var btnLogin = document.getElementById('btn-login');
      if (btnLogin) {
        var avatarImg = btnLogin.querySelector('img');
        var nameSpan = btnLogin.querySelector('span[style*="font-weight"]');
        if (avatarImg) avatarImg.src = photoUrl;
        if (nameSpan) nameSpan.textContent = firstName;
      }

      document.getElementById('modal-profile').classList.remove('active');
      if (typeof showNotification !== 'undefined') showNotification(_t('auth.profileUpdated'), _t('auth.profileUpdatedMsg'), 'success');

      // Trigger a re-render if we're on the dashboard
      var container = document.getElementById('view-container');
      if (container && window.location.hash.includes('dashboard') && typeof renderDashboard === 'function') {
        renderDashboard(container);
      }
    };
  }
}
