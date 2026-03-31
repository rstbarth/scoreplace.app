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
      // Firestore inicializado com sucesso
    } catch (e) {
      console.error('Erro ao inicializar Firestore:', e);
    }
  },

  // ---- Utilities ----

  // Recursively strip undefined values from objects/arrays (Firestore rejects undefined)
  _cleanUndefined(obj) {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
      return obj.map(function(item) { return window.FirestoreDB._cleanUndefined(item); });
    }
    if (typeof obj === 'object' && obj.constructor === Object) {
      var cleaned = {};
      Object.keys(obj).forEach(function(key) {
        if (obj[key] !== undefined) {
          cleaned[key] = window.FirestoreDB._cleanUndefined(obj[key]);
        }
      });
      return cleaned;
    }
    return obj;
  },

  // ---- Tournaments ----

  async saveTournament(tourData) {
    if (!this.db) return;
    var docId = String(tourData.id);
    var cleanData = this._cleanUndefined(tourData);
    await this.db.collection('tournaments').doc(docId).set(cleanData, { merge: true });
  },

  // Atomic enrollment — uses Firestore transaction to prevent race conditions
  // where concurrent enrollments overwrite each other's participants array
  async enrollParticipant(tournamentId, participantObj, extraUpdates) {
    if (!this.db) throw new Error('Firestore not initialized');
    var docRef = this.db.collection('tournaments').doc(String(tournamentId));
    var self = this;
    return this.db.runTransaction(async function(transaction) {
      var doc = await transaction.get(docRef);
      if (!doc.exists) throw new Error('Tournament not found');
      var data = doc.data();
      var participants = Array.isArray(data.participants) ? data.participants : (data.participants ? Object.values(data.participants) : []);

      // Check if already enrolled (by email or displayName)
      var pEmail = participantObj.email || '';
      var pName = participantObj.displayName || participantObj.name || '';
      var already = participants.some(function(p) {
        var str = typeof p === 'string' ? p : (p.email || p.displayName || '');
        return str && (str.includes(pEmail) || str.includes(pName));
      });
      if (already) return { alreadyEnrolled: true, participants: participants };

      participants.push(self._cleanUndefined(participantObj));

      var updateData = { participants: participants };
      if (extraUpdates) {
        Object.keys(extraUpdates).forEach(function(k) {
          updateData[k] = self._cleanUndefined(extraUpdates[k]);
        });
      }

      // Auto-close check
      if (data.autoCloseOnFull && data.maxParticipants && participants.length >= parseInt(data.maxParticipants)) {
        updateData.status = 'closed';
      }

      transaction.update(docRef, updateData);
      return { alreadyEnrolled: false, participants: participants, autoCloseTriggered: !!updateData.status };
    });
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
      // Torneios carregados do Firestore
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
  },

  // ---- Explore: list users who accept friend requests ----

  async searchUsers(queryText) {
    if (!this.db) return [];
    try {
      // Load ALL users, filter client-side (acceptFriendRequests may be undefined = default true)
      var snap = await this.db.collection('users').get();
      var users = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        data._docId = doc.id;
        // Only include users who accept friend requests (default true if field missing)
        if (data.acceptFriendRequests !== false) {
          users.push(data);
        }
      });
      // Client-side filter by name/email/city
      if (queryText && queryText.trim()) {
        var q = queryText.trim().toLowerCase();
        users = users.filter(function(u) {
          return (u.displayName && u.displayName.toLowerCase().indexOf(q) !== -1) ||
                 (u.email && u.email.toLowerCase().indexOf(q) !== -1) ||
                 (u.city && u.city.toLowerCase().indexOf(q) !== -1) ||
                 (u.preferredSports && u.preferredSports.toLowerCase().indexOf(q) !== -1);
        });
      }
      return users;
    } catch (e) {
      console.error('Erro ao buscar usuários:', e);
      return [];
    }
  },

  // ---- Friend Requests ----

  async sendFriendRequest(fromUid, toUid, fromData) {
    if (!this.db || !fromUid || !toUid) return;
    try {
      // Check if the other person already sent us a request — if so, auto-accept (mutual)
      var toDoc = await this.db.collection('users').doc(fromUid).get();
      var toData = toDoc.exists ? toDoc.data() : {};
      var receivedList = toData.friendRequestsReceived || [];
      if (receivedList.indexOf(toUid) !== -1) {
        // Mutual request! Auto-accept both directions
        await this.acceptFriendRequest(fromUid, toUid);
        // Notify both
        await this.addNotification(toUid, {
          type: 'friend_accepted',
          fromUid: fromUid,
          fromName: fromData.displayName || '',
          fromPhoto: fromData.photoURL || '',
          fromEmail: fromData.email || '',
          message: (fromData.displayName || 'Alguém') + ' aceitou seu convite e agora é seu amigo(a)!',
          createdAt: new Date().toISOString(),
          read: false
        });
        // Mutual friend request: auto-accepted
        return 'auto-accepted';
      }
      // Normal flow: send request
      // Add to sender's friendRequestsSent
      await this.db.collection('users').doc(fromUid).set({
        friendRequestsSent: firebase.firestore.FieldValue.arrayUnion(toUid)
      }, { merge: true });
      // Add to receiver's friendRequestsReceived
      await this.db.collection('users').doc(toUid).set({
        friendRequestsReceived: firebase.firestore.FieldValue.arrayUnion(fromUid)
      }, { merge: true });
      // Create notification for receiver
      await this.addNotification(toUid, {
        type: 'friend_request',
        fromUid: fromUid,
        fromName: fromData.displayName || '',
        fromPhoto: fromData.photoURL || '',
        fromEmail: fromData.email || '',
        message: (fromData.displayName || 'Alguém') + ' quer ser seu amigo(a)!',
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (e) {
      console.error('Erro ao enviar convite de amizade:', e);
    }
  },

  async acceptFriendRequest(myUid, friendUid) {
    if (!this.db || !myUid || !friendUid) return;
    try {
      // Add each other to friends arrays
      await this.db.collection('users').doc(myUid).set({
        friends: firebase.firestore.FieldValue.arrayUnion(friendUid),
        friendRequestsReceived: firebase.firestore.FieldValue.arrayRemove(friendUid)
      }, { merge: true });
      await this.db.collection('users').doc(friendUid).set({
        friends: firebase.firestore.FieldValue.arrayUnion(myUid),
        friendRequestsSent: firebase.firestore.FieldValue.arrayRemove(myUid)
      }, { merge: true });
    } catch (e) {
      console.error('Erro ao aceitar amizade:', e);
    }
  },

  async removeFriend(myUid, friendUid) {
    if (!this.db || !myUid || !friendUid) return;
    try {
      await this.db.collection('users').doc(myUid).set({
        friends: firebase.firestore.FieldValue.arrayRemove(friendUid)
      }, { merge: true });
      await this.db.collection('users').doc(friendUid).set({
        friends: firebase.firestore.FieldValue.arrayRemove(myUid)
      }, { merge: true });
    } catch (e) {
      console.error('Erro ao remover amizade:', e);
    }
  },

  async cancelFriendRequest(fromUid, toUid) {
    if (!this.db || !fromUid || !toUid) return;
    try {
      await this.db.collection('users').doc(fromUid).set({
        friendRequestsSent: firebase.firestore.FieldValue.arrayRemove(toUid)
      }, { merge: true });
      await this.db.collection('users').doc(toUid).set({
        friendRequestsReceived: firebase.firestore.FieldValue.arrayRemove(fromUid)
      }, { merge: true });
    } catch (e) {
      console.error('Erro ao cancelar convite de amizade:', e);
    }
  },

  async rejectFriendRequest(myUid, friendUid) {
    if (!this.db || !myUid || !friendUid) return;
    try {
      await this.db.collection('users').doc(myUid).set({
        friendRequestsReceived: firebase.firestore.FieldValue.arrayRemove(friendUid)
      }, { merge: true });
      await this.db.collection('users').doc(friendUid).set({
        friendRequestsSent: firebase.firestore.FieldValue.arrayRemove(myUid)
      }, { merge: true });
    } catch (e) {
      console.error('Erro ao rejeitar amizade:', e);
    }
  },

  // ---- Notifications ----

  async addNotification(uid, notifData) {
    if (!this.db || !uid) return;
    try {
      await this.db.collection('users').doc(uid).collection('notifications').add(notifData);
    } catch (e) {
      console.error('Erro ao criar notificação:', e);
    }
  },

  async getNotifications(uid, limit) {
    if (!this.db || !uid) return [];
    try {
      var query = this.db.collection('users').doc(uid).collection('notifications')
        .orderBy('createdAt', 'desc');
      if (limit) query = query.limit(limit);
      var snap = await query.get();
      var notifs = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        notifs.push(data);
      });
      return notifs;
    } catch (e) {
      console.error('Erro ao carregar notificações:', e);
      return [];
    }
  },

  async markNotificationRead(uid, notifId) {
    if (!this.db || !uid || !notifId) return;
    try {
      await this.db.collection('users').doc(uid).collection('notifications').doc(notifId).update({ read: true });
    } catch (e) {
      console.error('Erro ao marcar notificação como lida:', e);
    }
  },

  async getUnreadNotificationCount(uid) {
    if (!this.db || !uid) return 0;
    try {
      var snap = await this.db.collection('users').doc(uid).collection('notifications')
        .where('read', '==', false).get();
      return snap.size;
    } catch (e) {
      return 0;
    }
  }
};
