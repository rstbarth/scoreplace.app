window.SCOREPLACE_VERSION = '1.0.0';

// ========================================
// scoreplace.app — AppStore (Firestore Backend)
// ========================================
// All tournament data persists in Cloud Firestore.
// Only theme preference stays in localStorage.

window.AppStore = {
  currentUser: null,
  viewMode: 'organizer',
  tournaments: [],
  _invitedTournamentIds: [],  // Track tournament IDs from invite links
  _syncDebounce: null,
  _loading: false,

  // Sync: saves modified tournaments to Firestore (debounced)
  sync() {
    clearTimeout(this._syncDebounce);
    this._syncDebounce = setTimeout(function() {
      var store = window.AppStore;
      if (!window.FirestoreDB || !window.FirestoreDB.db || !store.currentUser) return;
      // Save all tournaments where this user is the organizer
      store.tournaments.forEach(function(t) {
        if (t.organizerEmail === store.currentUser.email) {
          window.FirestoreDB.saveTournament(t).catch(function(err) {
            console.warn('Sync error:', err);
          });
        }
      });
    }, 500);
  },

  // Load all tournaments from Firestore (called on login)
  async loadFromFirestore() {
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    this._loading = true;
    try {
      var tournaments = await window.FirestoreDB.loadAllTournaments();
      this.tournaments = tournaments;
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
      preferredSports: user.preferredSports || '',
      defaultCategory: user.defaultCategory || '',
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
      this.sync();
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
