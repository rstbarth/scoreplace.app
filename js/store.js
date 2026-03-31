window.SCOREPLACE_VERSION = '0.2.9-alpha';

// ========================================
// scoreplace.app — AppStore (Firestore Backend)
// ========================================
// All tournament data persists in Cloud Firestore.
// Local cache in localStorage for instant first-paint.
// Real-time listener (onSnapshot) keeps data fresh without refresh.

window.AppStore = {
  currentUser: null,
  viewMode: 'organizer',
  tournaments: [],
  _invitedTournamentIds: [],  // Track tournament IDs from invite links
  _deletedTournamentIds: (function() { try { var d = localStorage.getItem('scoreplace_deleted_ids'); return d ? JSON.parse(d) : []; } catch(e) { return []; } })(),
  _syncDebounce: null,
  _loading: false,
  _realtimeUnsubscribe: null,  // Real-time listener unsubscribe function
  _cacheKey: 'scoreplace_tournaments_cache',

  // --- Local Cache ---
  _saveToCache() {
    try {
      var data = { ts: Date.now(), tournaments: this.tournaments };
      localStorage.setItem(this._cacheKey, JSON.stringify(data));
    } catch(e) { /* quota exceeded or private browsing */ }
  },

  _loadFromCache() {
    try {
      var raw = localStorage.getItem(this._cacheKey);
      if (!raw) return false;
      var data = JSON.parse(raw);
      // Cache valid for 24h
      if (data && data.tournaments && (Date.now() - data.ts) < 86400000) {
        var deletedIds = this._deletedTournamentIds || [];
        if (deletedIds.length > 0) {
          this.tournaments = data.tournaments.filter(function(t) {
            return deletedIds.indexOf(String(t.id)) === -1;
          });
        } else {
          this.tournaments = data.tournaments;
        }
        console.log('AppStore: ' + this.tournaments.length + ' torneios do cache local');
        return true;
      }
    } catch(e) {}
    return false;
  },

  // Sync: saves ALL organizer tournaments to Firestore IMMEDIATELY
  // No more debounce — every mutation must persist to prevent data loss across devices
  sync() {
    var store = this;
    if (!window.FirestoreDB || !window.FirestoreDB.db || !store.currentUser) return;
    store.tournaments.forEach(function(t) {
      if (t.organizerEmail === store.currentUser.email) {
        window.FirestoreDB.saveTournament(t).catch(function(err) {
          console.warn('Sync error:', err);
        });
      }
    });
    store._saveToCache();
  },

  // SyncImmediate: saves a specific tournament to Firestore RIGHT NOW (no debounce)
  // Use for critical operations: draw, match results, status changes, enrollments
  async syncImmediate(tournamentId) {
    if (!window.FirestoreDB || !window.FirestoreDB.db) {
      console.error('syncImmediate: Firestore not available');
      return false;
    }
    var t = this.tournaments.find(function(tour) {
      return String(tour.id) === String(tournamentId);
    });
    if (!t) {
      console.error('syncImmediate: Tournament not found:', tournamentId);
      return false;
    }
    try {
      await window.FirestoreDB.saveTournament(t);
      this._saveToCache();
      console.log('syncImmediate: Tournament ' + tournamentId + ' saved to Firestore');
      return true;
    } catch (err) {
      console.error('syncImmediate: FAILED to save tournament ' + tournamentId, err);
      if (typeof showNotification === 'function') {
        showNotification('Erro ao Salvar', 'Não foi possível salvar no servidor. Tente novamente.', 'error');
      }
      return false;
    }
  },

  // Start real-time listener — auto-updates tournaments on any Firestore change
  startRealtimeListener() {
    if (this._realtimeUnsubscribe) return; // Already listening
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;

    var store = this;
    this._realtimeUnsubscribe = window.FirestoreDB.db.collection('tournaments')
      .onSnapshot(function(snap) {
        var tournaments = [];
        var deletedIds = store._deletedTournamentIds || [];
        snap.forEach(function(doc) {
          var data = doc.data();
          // Filter out recently deleted tournaments to prevent ghost re-appearance
          if (deletedIds.indexOf(String(data.id)) === -1) {
            tournaments.push(data);
          }
        });
        store.tournaments = tournaments;
        store._saveToCache();
        store._loading = false;
        console.log('AppStore real-time: ' + tournaments.length + ' torneios atualizados (filtrados ' + deletedIds.length + ' deletados)');
        // Re-render current view
        if (typeof initRouter === 'function') initRouter();
      }, function(err) {
        console.warn('Real-time listener error:', err);
        // Fallback to one-time load
        store.loadFromFirestore();
      });
  },

  stopRealtimeListener() {
    if (this._realtimeUnsubscribe) {
      this._realtimeUnsubscribe();
      this._realtimeUnsubscribe = null;
    }
  },

  // Load all tournaments from Firestore (one-time, fallback)
  async loadFromFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    this._loading = true;
    try {
      var tournaments = await window.FirestoreDB.loadAllTournaments();
      var deletedIds = this._deletedTournamentIds || [];
      if (deletedIds.length > 0) {
        tournaments = tournaments.filter(function(t) {
          return deletedIds.indexOf(String(t.id)) === -1;
        });
      }
      this.tournaments = tournaments;
      this._saveToCache();
      console.log('AppStore: ' + tournaments.length + ' torneios carregados');
    } catch (e) {
      console.error('Erro ao carregar torneios:', e);
      this.tournaments = [];
    }
    this._loading = false;
  },

  // Load user profile from Firestore
  async loadUserProfile(uid) {
    if (!window.FirestoreDB || !window.FirestoreDB.db || !uid) return null;
    try {
      var profile = await window.FirestoreDB.loadUserProfile(uid);
      if (profile && this.currentUser) {
        // Merge saved profile data into currentUser
        if (profile.gender) this.currentUser.gender = profile.gender;
        if (profile.preferredSports) this.currentUser.preferredSports = profile.preferredSports;
        if (profile.defaultCategory) this.currentUser.defaultCategory = profile.defaultCategory;
        if (profile.displayName) this.currentUser.displayName = profile.displayName;
        if (profile.birthDate) this.currentUser.birthDate = profile.birthDate;
        if (profile.age) this.currentUser.age = profile.age;
        if (profile.city) this.currentUser.city = profile.city;
        if (profile.state) this.currentUser.state = profile.state;
        if (profile.country) this.currentUser.country = profile.country;
        if (profile.locale) this.currentUser.locale = profile.locale;
        if (profile.phone) this.currentUser.phone = profile.phone;
        if (profile.phoneCountry) this.currentUser.phoneCountry = profile.phoneCountry;
        if (profile.photoURL) this.currentUser.photoURL = profile.photoURL;
        // Boolean prefs — use !== undefined to allow false values
        if (profile.acceptFriendRequests !== undefined) this.currentUser.acceptFriendRequests = profile.acceptFriendRequests;
        if (profile.notifyPlatform !== undefined) this.currentUser.notifyPlatform = profile.notifyPlatform;
        if (profile.notifyEmail !== undefined) this.currentUser.notifyEmail = profile.notifyEmail;
        if (profile.notifyWhatsApp !== undefined) this.currentUser.notifyWhatsApp = profile.notifyWhatsApp;
        if (profile.notifyLevel) this.currentUser.notifyLevel = profile.notifyLevel;
        if (profile.preferredCeps !== undefined) this.currentUser.preferredCeps = profile.preferredCeps;
        if (Array.isArray(profile.friends)) this.currentUser.friends = profile.friends;
        if (Array.isArray(profile.friendRequestsSent)) this.currentUser.friendRequestsSent = profile.friendRequestsSent;
        if (Array.isArray(profile.friendRequestsReceived)) this.currentUser.friendRequestsReceived = profile.friendRequestsReceived;
      }
      return profile;
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
      return null;
    }
  },

  // Save user profile to Firestore
  async saveUserProfileToFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db || !this.currentUser) return;
    var user = this.currentUser;
    var uid = user.uid || user.email;
    await window.FirestoreDB.saveUserProfile(uid, {
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      gender: user.gender || '',
      birthDate: user.birthDate || '',
      age: user.age || '',
      city: user.city || '',
      state: user.state || '',
      country: user.country || '',
      locale: user.locale || '',
      phone: user.phone || '',
      phoneCountry: user.phoneCountry || '55',
      preferredSports: user.preferredSports || '',
      defaultCategory: user.defaultCategory || '',
      acceptFriendRequests: user.acceptFriendRequests !== false,
      notifyPlatform: user.notifyPlatform !== false,
      notifyEmail: user.notifyEmail !== false,
      notifyWhatsApp: user.notifyWhatsApp !== false,
      notifyLevel: user.notifyLevel || 'todas',
      preferredCeps: user.preferredCeps || '',
      friends: user.friends || [],
      friendRequestsSent: user.friendRequestsSent || [],
      friendRequestsReceived: user.friendRequestsReceived || [],
      updatedAt: new Date().toISOString()
    });
  },

  toggleViewMode() {
    this.viewMode = this.viewMode === 'organizer' ? 'participant' : 'organizer';
    var btn = document.getElementById('view-mode-selector');
    if (btn) {
      btn.innerHTML = this.viewMode === 'organizer' ? '👁️ Visão: Organizador' : '👤 Visão: Participante';
    }
    if (typeof initRouter === 'function') initRouter();
  },

  isOrganizer(tournament) {
    if (this.viewMode === 'participant') return false;
    return this.currentUser && tournament.organizerEmail === this.currentUser.email;
  },

  getVisibleTournaments() {
    var invitedIds = this._invitedTournamentIds || [];
    return this.tournaments.filter(function(t) {
      if (t.isPublic) return true;
      // Tournament accessed via invite link is always visible
      if (invitedIds.indexOf(String(t.id)) !== -1) return true;
      if (!window.AppStore.currentUser) return false;
      var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
      var isPart = pList.some(function(p) {
        var str = typeof p === 'string' ? p : (p.email || p.displayName || p.name);
        return str && str.includes(window.AppStore.currentUser.email);
      });
      return t.organizerEmail === window.AppStore.currentUser.email || isPart;
    });
  },

  getMyOrganized() {
    if (!this.currentUser || this.viewMode === 'participant') return [];
    var email = this.currentUser.email;
    return this.tournaments.filter(function(t) { return t.organizerEmail === email; });
  },

  getMyParticipations() {
    if (!this.currentUser) return [];
    var email = this.currentUser.email;
    return this.tournaments.filter(function(t) {
      var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
      return pList.some(function(p) {
        var str = typeof p === 'string' ? p : (p.email || p.displayName || p.name);
        return str && str.includes(email);
      });
    });
  },

  addTournament(data) {
    var id = data.id || ('tour_' + Date.now());
    var tourData = Object.assign({
      id: id,
      createdAt: new Date().toISOString(),
      participants: [],
      standbyParticipants: [],
      history: [{
        date: new Date().toISOString(),
        message: 'Torneio Criado'
      }]
    }, data);
    // Ensure id is set
    tourData.id = id;
    this.tournaments.push(tourData);
    // Save to Firestore immediately
    if (window.FirestoreDB && window.FirestoreDB.db) {
      window.FirestoreDB.saveTournament(tourData).catch(function(err) {
        console.error('Erro ao salvar novo torneio:', err);
      });
    }
    return id;
  },

  logAction(tournamentId, message) {
    var t = this.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (t) {
      if (!t.history) t.history = [];
      t.history.push({
        date: new Date().toISOString(),
        message: message
      });
      // Note: does NOT call sync() here — the caller is responsible for saving.
      // This avoids double Firestore writes since every logAction is followed by a sync().
    }
  },

  hasOrganizedTournaments() {
    if (!this.currentUser) return false;
    var email = this.currentUser.email;
    return this.tournaments.some(function(t) { return t.organizerEmail === email; });
  }
};

// Global Helper para controle do botão ViewMode na Topbar
window.updateViewModeVisibility = function() {
  var viewModeContainer = document.getElementById('view-mode-container');
  if (!viewModeContainer) return;

  if (window.AppStore.currentUser && window.AppStore.hasOrganizedTournaments()) {
    viewModeContainer.style.setProperty('display', 'flex', 'important');
  } else {
    viewModeContainer.style.setProperty('display', 'none', 'important');
  }
};
