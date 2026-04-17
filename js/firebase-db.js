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

  async saveTournament(tourData, options) {
    if (!this.db) return;
    var docId = String(tourData.id);
    var cleanData = this._cleanUndefined(tourData);
    // When skipParticipants is true, exclude participants array to prevent
    // overwriting enrollments made by other users via transactions.
    // This is critical: sync() and organizer edits should NOT touch participants.
    if (options && options.skipParticipants) {
      delete cleanData.participants;
    }
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
      // Block enrollment if tournament is closed, active (draw done), or finished
      // Liga with open enrollment is the only exception
      var _isLiga = data.format && (data.format === 'Liga' || data.format === 'Ranking' || data.format === 'liga' || data.format === 'ranking');
      var _ligaOpen = _isLiga && data.ligaOpenEnrollment;
      var _sorteioRealizado = (Array.isArray(data.matches) && data.matches.length > 0) ||
                              (Array.isArray(data.rounds) && data.rounds.length > 0) ||
                              (Array.isArray(data.groups) && data.groups.length > 0);
      // Also check registration deadline
      var _deadlinePassed = data.registrationLimit && new Date(data.registrationLimit) < new Date();
      var _inscricoesAbertas = (data.status !== 'closed' && data.status !== 'finished' && !_sorteioRealizado && !_deadlinePassed) || _ligaOpen;
      if (!_inscricoesAbertas) {
        // Auto-close if deadline just passed (persist the status change)
        if (_deadlinePassed && data.status !== 'closed') {
          transaction.update(docRef, { status: 'closed' });
        }
        return { alreadyEnrolled: false, enrollmentClosed: true, participants: participants };
      }

      var already = participants.some(function(p) {
        if (typeof p === 'string') {
          return (pEmail && p === pEmail) || (pName && p === pName);
        }
        var pE = p.email || '';
        var pD = p.displayName || '';
        var pN = p.name || '';
        var pU = p.uid || '';
        return (pEmail && (pE === pEmail)) ||
               (pName && (pD === pName || pN === pName)) ||
               (participantObj.uid && pU && pU === participantObj.uid);
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
      // Auto-close when maxParticipants is reached (always, no flag needed)
      if (data.maxParticipants && participants.length >= parseInt(data.maxParticipants)) {
        updateData.status = 'closed';
      }

      transaction.update(docRef, updateData);
      return { alreadyEnrolled: false, participants: participants, autoCloseTriggered: !!updateData.status };
    });
  },

  // Atomic deenrollment — prevents race conditions where deenroll overwrites
  // concurrent enrollments by other users
  async deenrollParticipant(tournamentId, userEmail, userDisplayName, userUid) {
    if (!this.db) throw new Error('Firestore not initialized');
    var docRef = this.db.collection('tournaments').doc(String(tournamentId));
    return this.db.runTransaction(async function(transaction) {
      var doc = await transaction.get(docRef);
      if (!doc.exists) throw new Error('Tournament not found');
      var data = doc.data();
      var participants = Array.isArray(data.participants) ? data.participants : (data.participants ? Object.values(data.participants) : []);

      var newParticipants = participants.filter(function(p) {
        if (typeof p === 'string') {
          if (p.indexOf(' / ') !== -1) return true; // keep teams
          return p !== userEmail && p !== userDisplayName;
        }
        if (userUid && p.uid && p.uid === userUid) return false;
        if (userEmail && p.email && p.email === userEmail) return false;
        if (userDisplayName && p.displayName && p.displayName === userDisplayName) return false;
        if (userDisplayName && p.name && p.name === userDisplayName) return false;
        return true;
      });

      if (newParticipants.length === participants.length) {
        return { notFound: true, participants: participants };
      }

      transaction.update(docRef, { participants: newParticipants });
      return { notFound: false, participants: newParticipants };
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
      // We check OUR (fromUid) received list to see if toUid already sent us a request
      var fromDoc = await this.db.collection('users').doc(fromUid).get();
      var fromDocData = fromDoc.exists ? fromDoc.data() : {};
      var receivedList = fromDocData.friendRequestsReceived || [];
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
  },

  // ---- Email Queue (Firebase Extension "Trigger Email from Firestore") ----

  async queueEmail(to, subject, html) {
    if (!this.db || !to) return;
    try {
      var toArr = Array.isArray(to) ? to : [to];
      await this.db.collection('mail').add({
        to: toArr,
        message: { subject: subject || 'scoreplace.app', html: html || '' },
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Erro ao enfileirar email:', e);
    }
  },

  // ---- WhatsApp Queue (for future Cloud Function integration) ----

  async queueWhatsApp(phones, message) {
    if (!this.db || !phones || !phones.length) return;
    try {
      await this.db.collection('whatsapp_queue').add({
        phones: phones,
        message: message || '',
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
    } catch (e) {
      console.warn('Erro ao enfileirar WhatsApp:', e);
    }
  },

  // ---- Templates ----

  async saveTemplate(uid, templateData) {
    if (!this.db || !uid) return null;
    try {
      var clean = this._cleanUndefined(templateData);
      var ref = await this.db.collection('users').doc(uid).collection('templates').add(clean);
      return ref.id;
    } catch (e) {
      console.error('Erro ao salvar template:', e);
      return null;
    }
  },

  async getTemplates(uid) {
    if (!this.db || !uid) return [];
    try {
      var snap = await this.db.collection('users').doc(uid).collection('templates').get();
      var templates = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        templates.push(data);
      });
      // Sort client-side (newest first) — avoids Firestore index requirement
      templates.sort(function(a, b) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      return templates;
    } catch (e) {
      console.error('Erro ao carregar templates:', e);
      return [];
    }
  },

  async deleteTemplate(uid, templateId) {
    if (!this.db || !uid || !templateId) return;
    try {
      await this.db.collection('users').doc(uid).collection('templates').doc(templateId).delete();
    } catch (e) {
      console.error('Erro ao excluir template:', e);
    }
  },

  // ---- Casual Matches ----

  async saveCasualMatch(matchData) {
    if (!this.db) return null;
    try {
      var clean = this._cleanUndefined(matchData);
      var ref = await this.db.collection('casualMatches').add(clean);
      return ref.id;
    } catch (e) {
      console.error('Erro ao salvar partida casual:', e);
      return null;
    }
  },

  async loadCasualMatch(roomCode) {
    if (!this.db || !roomCode) return null;
    try {
      var snap = await this.db.collection('casualMatches')
        .where('roomCode', '==', roomCode).limit(1).get();
      if (snap.empty) return null;
      var doc = snap.docs[0];
      var data = doc.data();
      data._docId = doc.id;
      return data;
    } catch (e) {
      console.error('Erro ao carregar partida casual:', e);
      return null;
    }
  },

  async updateCasualMatch(docId, updates) {
    if (!this.db || !docId) return;
    try {
      var clean = this._cleanUndefined(updates);
      await this.db.collection('casualMatches').doc(docId).update(clean);
    } catch (e) {
      console.error('Erro ao atualizar partida casual:', e);
    }
  },

  async claimCasualSlot(docId, slotIndex, uid, displayName) {
    if (!this.db || !docId) return false;
    try {
      var docRef = this.db.collection('casualMatches').doc(docId);
      var self = this;
      return this.db.runTransaction(async function(transaction) {
        var doc = await transaction.get(docRef);
        if (!doc.exists) return false;
        var data = doc.data();
        var players = Array.isArray(data.players) ? data.players.slice() : [];
        if (slotIndex < 0 || slotIndex >= players.length) return false;
        if (players[slotIndex].uid) return false; // Already claimed
        // Check user hasn't already claimed another slot
        var alreadyClaimed = players.some(function(p) { return p.uid === uid; });
        if (alreadyClaimed) return false;
        players[slotIndex] = Object.assign({}, players[slotIndex], { uid: uid, displayName: displayName });
        transaction.update(docRef, { players: players });
        return true;
      });
    } catch (e) {
      console.error('Erro ao reservar vaga casual:', e);
      return false;
    }
  },

  // Join a casual match — add user to participants list (idempotent)
  // Join a casual match — add user to participants list (idempotent)
  async joinCasualMatch(docId, uid, displayName, photoURL) {
    if (!this.db || !docId || !uid) return false;
    try {
      var docRef = this.db.collection('casualMatches').doc(docId);
      return this.db.runTransaction(async function(transaction) {
        var doc = await transaction.get(docRef);
        if (!doc.exists) return false;
        var data = doc.data();
        var participants = Array.isArray(data.participants) ? data.participants.slice() : [];
        var playerUids = Array.isArray(data.playerUids) ? data.playerUids.slice() : [];
        // Already joined?
        if (playerUids.indexOf(uid) !== -1) return true;
        participants.push({ uid: uid, displayName: displayName || '', photoURL: photoURL || '', joinedAt: new Date().toISOString() });
        playerUids.push(uid);
        transaction.update(docRef, { participants: participants, playerUids: playerUids });
        return true;
      });
    } catch (e) {
      console.error('Erro ao entrar na partida casual:', e);
      return false;
    }
  },

  // Leave a casual match — remove user from participants, playerUids and release any claimed slot
  async leaveCasualMatch(docId, uid) {
    if (!this.db || !docId || !uid) return false;
    try {
      var docRef = this.db.collection('casualMatches').doc(docId);
      return this.db.runTransaction(async function(transaction) {
        var doc = await transaction.get(docRef);
        if (!doc.exists) return false;
        var data = doc.data();
        var participants = Array.isArray(data.participants) ? data.participants.slice() : [];
        var playerUids = Array.isArray(data.playerUids) ? data.playerUids.slice() : [];
        var players = Array.isArray(data.players) ? data.players.slice() : [];
        participants = participants.filter(function(p) { return p.uid !== uid; });
        playerUids = playerUids.filter(function(u) { return u !== uid; });
        // Release any slot this user had claimed so another player can take it
        players = players.map(function(p) {
          if (p && p.uid === uid) {
            var copy = Object.assign({}, p);
            delete copy.uid;
            delete copy.displayName;
            delete copy.photoURL;
            return copy;
          }
          return p;
        });
        transaction.update(docRef, { participants: participants, playerUids: playerUids, players: players });
        return true;
      });
    } catch (e) {
      console.error('Erro ao sair da partida casual:', e);
      return false;
    }
  },

  async loadUserCasualMatches(uid) {
    if (!this.db || !uid) return [];
    try {
      var snap = await this.db.collection('casualMatches')
        .where('playerUids', 'array-contains', uid)
        .where('status', '==', 'finished')
        .get();
      var matches = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        data._docId = doc.id;
        matches.push(data);
      });
      matches.sort(function(a, b) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      return matches;
    } catch (e) {
      console.error('Erro ao carregar partidas casuais:', e);
      return [];
    }
  },

  // ── User match history (persistent per-user stats across casual + tournament) ──
  // Writes one copy of the match record into each registered player's profile
  // subcollection so the record survives deletion of the original tournament
  // or casual match document.
  async saveUserMatchRecords(record) {
    if (!this.db || !record || !Array.isArray(record.players)) return false;
    var self = this;
    var clean = self._cleanUndefined(record);
    var recordId = clean.matchId || ('m_' + Date.now() + '_' + Math.floor(Math.random() * 1e6));
    clean.matchId = recordId;
    var writers = [];
    for (var i = 0; i < clean.players.length; i++) {
      (function(p) {
        if (!p || !p.uid) return;
        writers.push((async function() {
          try {
            await self.db.collection('users').doc(p.uid)
              .collection('matchHistory').doc(recordId)
              .set(clean, { merge: true });
          } catch (e) { console.warn('saveUserMatchRecords for', p.uid, 'failed', e); }
        })());
      })(clean.players[i]);
    }
    try { await Promise.all(writers); return true; } catch (e) { return false; }
  },

  async loadUserMatchHistory(uid, options) {
    if (!this.db || !uid) return [];
    options = options || {};
    try {
      var q = this.db.collection('users').doc(uid).collection('matchHistory');
      if (options.matchType) q = q.where('matchType', '==', options.matchType);
      q = q.orderBy('finishedAt', 'desc');
      if (options.limit) q = q.limit(options.limit);
      var snap = await q.get();
      var out = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        out.push(d);
      });
      return out;
    } catch (e) {
      console.error('Erro ao carregar histórico de partidas:', e);
      return [];
    }
  }
};
