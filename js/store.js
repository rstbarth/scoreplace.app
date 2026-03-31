window.SCOREPLACE_VERSION = '0.2.42-alpha';

// ─── Plano Pro ──────────────────────────────────────────────────────────────
// Verifica se o usuário logado tem plano Pro ativo
window._isPro = function() {
  var user = window.AppStore && window.AppStore.currentUser;
  if (!user) return false;
  if (user.plan !== 'pro') return false;
  // Checa expiração
  if (user.planExpiresAt) {
    var exp = new Date(user.planExpiresAt);
    if (exp < new Date()) return false;
  }
  return true;
};

// Limites do plano Free
window.PLAN_LIMITS = {
  FREE_MAX_TOURNAMENTS: 3,
  FREE_MAX_PARTICIPANTS: 32
};

// Verifica se pode criar mais torneios (Free: 3 ativos)
window._canCreateTournament = function() {
  if (window._isPro()) return true;
  var user = window.AppStore && window.AppStore.currentUser;
  if (!user) return false;
  var active = window.AppStore.tournaments.filter(function(t) {
    return t.organizerEmail === user.email && t.status !== 'finished' && t.status !== 'cancelled';
  });
  return active.length < window.PLAN_LIMITS.FREE_MAX_TOURNAMENTS;
};

// Verifica se pode adicionar mais participantes (Free: 32 por torneio)
window._canAddParticipant = function(tournament) {
  if (window._isPro()) return true;
  var pList = Array.isArray(tournament.participants) ? tournament.participants : [];
  return pList.length < window.PLAN_LIMITS.FREE_MAX_PARTICIPANTS;
};

// Abre a página/modal de upgrade Pro
window._showUpgradeModal = function(reason) {
  var reasonText = '';
  if (reason === 'tournaments') reasonText = 'Você atingiu o limite de 3 torneios ativos no plano gratuito.';
  else if (reason === 'participants') reasonText = 'Você atingiu o limite de 32 participantes no plano gratuito.';
  else if (reason === 'logo') reasonText = 'Upload de logo personalizada é exclusivo do plano Pro.';
  else if (reason === 'tv') reasonText = 'Modo TV sem marca é exclusivo do plano Pro.';
  else reasonText = 'Desbloqueie todo o potencial do scoreplace.app.';

  var modal = document.getElementById('modal-upgrade');
  if (modal) { modal.style.display = 'flex'; return; }

  modal = document.createElement('div');
  modal.id = 'modal-upgrade';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:100000;';
  modal.innerHTML =
    '<div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:20px;max-width:460px;width:92%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:2rem;text-align:center;">' +
        '<div style="font-size:2.5rem;margin-bottom:0.5rem;">🚀</div>' +
        '<div style="font-size:1.4rem;font-weight:800;color:#fff;">scoreplace Pro</div>' +
        '<div style="font-size:0.9rem;color:rgba(255,255,255,0.8);margin-top:6px;">R$19,90/mês</div>' +
      '</div>' +
      '<div style="padding:1.5rem;">' +
        '<p style="color:var(--text-muted);font-size:0.9rem;text-align:center;margin-bottom:1.2rem;">' + reasonText + '</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1.5rem;">' +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.2rem;">♾️</span><span style="color:var(--text-color);font-size:0.9rem;">Torneios ilimitados</span></div>' +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.2rem;">👥</span><span style="color:var(--text-color);font-size:0.9rem;">Participantes ilimitados</span></div>' +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.2rem;">🎨</span><span style="color:var(--text-color);font-size:0.9rem;">Upload de logo personalizada</span></div>' +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.2rem;">📺</span><span style="color:var(--text-color);font-size:0.9rem;">Modo TV sem marca scoreplace</span></div>' +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:10px;">' +
            '<span style="font-size:1.2rem;">⚡</span><span style="color:var(--text-color);font-size:0.9rem;">Suporte prioritário</span></div>' +
        '</div>' +
        '<button onclick="window._startProCheckout()" style="width:100%;padding:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:10px;transition:transform 0.2s;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'none\'">Assinar Pro — R$19,90/mês</button>' +
        '<button onclick="document.getElementById(\'modal-upgrade\').remove()" style="width:100%;padding:10px;background:transparent;color:var(--text-muted);border:1px solid var(--border-color);border-radius:12px;font-size:0.85rem;cursor:pointer;">Agora não</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
};

// Inicia o checkout do Stripe para assinatura Pro
window._startProCheckout = async function() {
  var user = window.AppStore && window.AppStore.currentUser;
  if (!user || !user.uid) {
    if (typeof showNotification === 'function') showNotification('Login necessário', 'Faça login para assinar o Pro.', 'warning');
    return;
  }
  try {
    var btn = document.querySelector('#modal-upgrade button');
    if (btn) { btn.textContent = 'Processando...'; btn.disabled = true; }

    var resp = await fetch('https://southamerica-east1-scoreplace-app.cloudfunctions.net/createCheckoutSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        priceId: window._STRIPE_PRICE_ID || 'price_1TGzhZIhfnsIPruFsz4plxaX'
      })
    });
    var data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Erro ao criar sessão de pagamento');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    if (typeof showNotification === 'function') showNotification('Erro', 'Não foi possível iniciar o pagamento. Tente novamente.', 'error');
    var btn2 = document.querySelector('#modal-upgrade button');
    if (btn2) { btn2.textContent = 'Assinar Pro — R$19,90/mês'; btn2.disabled = false; }
  }
};

// Mostra modal de apoio voluntário via PIX
window._showSupportModal = function() {
  var existing = document.getElementById('modal-support-pix');
  if (existing) { existing.style.display = 'flex'; return; }

  var pixKey = '51590996000173';
  var modal = document.createElement('div');
  modal.id = 'modal-support-pix';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:100000;';
  modal.innerHTML =
    '<div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:20px;max-width:400px;width:92%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="background:linear-gradient(135deg,#10b981,#059669);padding:1.5rem;text-align:center;">' +
        '<div style="font-size:2.2rem;margin-bottom:0.3rem;">💚</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:#fff;">Apoie o scoreplace.app</div>' +
        '<div style="font-size:0.8rem;color:rgba(255,255,255,0.8);margin-top:4px;">Contribuição voluntária — qualquer valor</div>' +
      '</div>' +
      '<div style="padding:1.5rem;text-align:center;">' +
        '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;line-height:1.6;">Sua contribuição ajuda a manter o scoreplace.app no ar e financiar novas funcionalidades. Qualquer valor faz diferença!</p>' +
        '<div style="background:var(--bg-dark);border:1px solid var(--border-color);border-radius:12px;padding:1rem;margin-bottom:1rem;">' +
          '<div style="margin-bottom:0.8rem;">' +
            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent('00020126580014br.gov.bcb.pix0136' + pixKey + '5204000053039865802BR5925SCOREPLACE6009SAO PAULO62070503***6304') + '" alt="QR Code PIX" style="width:180px;height:180px;border-radius:8px;background:#fff;padding:8px;" />' +
          '</div>' +
          '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Chave PIX (CNPJ):</div>' +
          '<div style="display:flex;align-items:center;gap:8px;justify-content:center;">' +
            '<code id="pix-key-text" style="background:rgba(255,255,255,0.08);padding:8px 14px;border-radius:8px;font-size:0.95rem;color:var(--text-color);letter-spacing:0.5px;">' + pixKey + '</code>' +
            '<button onclick="navigator.clipboard.writeText(\'' + pixKey + '\').then(function(){var b=event.target;b.textContent=\'Copiado!\';setTimeout(function(){b.textContent=\'Copiar\'},2000)})" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;white-space:nowrap;">Copiar</button>' +
          '</div>' +
        '</div>' +
        '<p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:1rem;">Escaneie o QR code ou copie a chave PIX e cole no app do seu banco. Escolha o valor que quiser.</p>' +
        '<button onclick="document.getElementById(\'modal-support-pix\').remove()" style="width:100%;padding:10px;background:transparent;color:var(--text-muted);border:1px solid var(--border-color);border-radius:12px;font-size:0.85rem;cursor:pointer;">Fechar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
};

// Global HTML escape utility (XSS protection)
window._safeHtml = function(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// ─── Tema claro/escuro ───────────────────────────────────────────────────────
window._toggleTheme = function() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  try { localStorage.setItem('scoreplace_theme', next); } catch (e) {}
  // Update toggle button icon
  var btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = next === 'dark' ? '🌙' : '☀️';
};

// Apply saved theme on load
(function() {
  try {
    var saved = localStorage.getItem('scoreplace_theme');
    if (saved && (saved === 'light' || saved === 'dark')) {
      document.documentElement.setAttribute('data-theme', saved);
      // Update icon after DOM ready
      var _applyIcon = function() {
        var btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _applyIcon);
      } else {
        _applyIcon();
      }
    }
  } catch (e) {}
})();

// ─── Favoritos (localStorage) ────────────────────────────────────────────────
window._getFavorites = function() {
  try {
    var key = 'scoreplace_favorites';
    var cu = window.AppStore && window.AppStore.currentUser;
    if (cu && cu.email) key += '_' + cu.email;
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};

window._isFavorite = function(tId) {
  var favs = window._getFavorites();
  return favs.indexOf(String(tId)) !== -1;
};

window._toggleFavorite = function(tId, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  var key = 'scoreplace_favorites';
  var cu = window.AppStore && window.AppStore.currentUser;
  if (cu && cu.email) key += '_' + cu.email;
  var favs = window._getFavorites();
  var id = String(tId);
  var idx = favs.indexOf(id);
  if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
  try { localStorage.setItem(key, JSON.stringify(favs)); } catch (e) {}
  // Update star icons on the page
  var stars = document.querySelectorAll('[data-fav-id="' + id + '"]');
  stars.forEach(function(el) {
    el.textContent = (idx === -1) ? '★' : '☆';
    el.title = (idx === -1) ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    el.style.color = (idx === -1) ? '#fbbf24' : 'rgba(255,255,255,0.4)';
  });
};

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
    } catch(e) { console.warn('[AppStore] Erro ao carregar cache local:', e.message); }
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
      t.updatedAt = new Date().toISOString();
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
        // Plan fields
        if (profile.plan) this.currentUser.plan = profile.plan;
        if (profile.planExpiresAt) this.currentUser.planExpiresAt = profile.planExpiresAt;
        if (profile.stripeCustomerId) this.currentUser.stripeCustomerId = profile.stripeCustomerId;
        if (profile.stripeSubscriptionId) this.currentUser.stripeSubscriptionId = profile.stripeSubscriptionId;
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
