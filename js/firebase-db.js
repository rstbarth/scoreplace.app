// ========================================
// scoreplace.app — Firestore Database Module
// ========================================
// Provides CRUD operations for Cloud Firestore.
// Collections: tournaments, users
// Requires firebase-app-compat + firebase-firestore-compat loaded first.

window.FirestoreDB = {
  db: null,

  init() {
    try {
      this.db = firebase.firestore();
      console.log('Firestore inicializado com sucesso');
    } catch (e) {
      console.error('Erro ao inicializar Firestore:', e);
    }
  },

  // ---- Tournaments ----

  async saveTournament(tourData) {
    if (!this.db) return;
    try {
      var docId = String(tourData.id);
      await this.db.collection('tournaments').doc(docId).set(tourData, { merge: true });
    } catch (e) {
      console.error('Erro ao salvar torneio:', e);
    }
  },

  async deleteTournament(tournamentId) {
    if (!this.db) return;
    try {
      await this.db.collection('tournaments').doc(String(tournamentId)).delete();
    } catch (e) {
      console.error('Erro ao deletar torneio:', e);
    }
  },

  async loadAllTournaments() {
    if (!this.db) return [];
    try {
      var snap = await this.db.collection('tournaments').get();
      var tournaments = [];
      snap.forEach(function(doc) {
        tournaments.push(doc.data());
      });
      console.log('Torneios carregados do Firestore:', tournaments.length);
      return tournaments;
    } catch (e) {
      console.error('Erro ao carregar torneios:', e);
      return [];
    }
  },

  // ---- User Profiles ----

  async saveUserProfile(uid, profileData) {
    if (!this.db || !uid) return;
    try {
      await this.db.collection('users').doc(uid).set(profileData, { merge: true });
    } catch (e) {
      console.error('Erro ao salvar perfil:', e);
    }
  },

  async loadUserProfile(uid) {
    if (!this.db || !uid) return null;
    try {
      var doc = await this.db.collection('users').doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
      return null;
    }
  }
};
