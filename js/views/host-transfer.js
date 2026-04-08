// ─── Host Transfer / Co-Host System ─────────────────────────────────────────
(function() {
  'use strict';

  // Crown SVG reusable
  var CROWN_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(251,191,36,0.9)"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>';
  window._CROWN_SVG = CROWN_SVG;

  // ─── Open host transfer dialog ────────────────────────────────────────────
  window._openHostTransferDialog = function(participant, tId) {
    var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    if (!t) return;
    var pName = typeof participant === 'string' ? participant : (participant.displayName || participant.name || participant.email || '');
    var pEmail = typeof participant === 'object' ? (participant.email || '') : '';
    var pUid = typeof participant === 'object' ? (participant.uid || '') : '';

    var existing = document.getElementById('host-transfer-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'host-transfer-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;';

    var _selectedType = 'cohost';

    overlay.innerHTML = '<div style="background:var(--bg-card);width:94%;max-width:380px;border-radius:16px;border:1px solid rgba(251,191,36,0.3);box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;">' +
      // Sticky header with buttons
      '<div style="padding:0.75rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);background:linear-gradient(135deg,#78350f,#b45309);">' +
        '<button type="button" onclick="document.getElementById(\'host-transfer-overlay\').remove()" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fef3c7;border:1px solid rgba(255,255,255,0.25);">Cancelar</button>' +
        '<span style="font-weight:700;color:#fef3c7;font-size:0.9rem;">' + CROWN_SVG + ' Organizacao</span>' +
        '<button type="button" id="btn-confirm-host-transfer" class="btn btn-sm" style="background:#fbbf24;color:#78350f;font-weight:700;border:none;">Confirmar</button>' +
      '</div>' +
      // Body
      '<div style="padding:1rem 1.25rem;">' +
        '<div style="text-align:center;margin-bottom:1rem;">' +
          '<div style="font-size:1.5rem;margin-bottom:4px;">👑</div>' +
          '<div style="font-weight:700;color:var(--text-bright);font-size:0.95rem;">' + window._safeHtml(pName) + '</div>' +
          '<div style="font-size:0.75rem;color:var(--text-muted);">' + window._safeHtml(t.name) + '</div>' +
        '</div>' +
        // Options
        '<div style="display:flex;flex-direction:column;gap:8px;" id="host-transfer-options">' +
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:rgba(251,191,36,0.08);border:2px solid rgba(251,191,36,0.3);border-radius:12px;cursor:pointer;" id="opt-cohost">' +
            '<input type="radio" name="host-type" value="cohost" checked style="margin-top:2px;accent-color:#fbbf24;">' +
            '<div><div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;">Compartilhar</div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Adiciona como co-organizador com todos os poderes. Voce continua sendo o organizador principal.</div></div>' +
          '</label>' +
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:rgba(255,255,255,0.03);border:2px solid var(--border-color);border-radius:12px;cursor:pointer;" id="opt-transfer">' +
            '<input type="radio" name="host-type" value="transfer" style="margin-top:2px;accent-color:#fbbf24;">' +
            '<div><div style="font-weight:700;color:var(--text-bright);font-size:0.88rem;">Transferir</div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Passa a organizacao completa. Voce se torna co-organizador.</div></div>' +
          '</label>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);

    // Radio selection visual
    var radios = overlay.querySelectorAll('input[name="host-type"]');
    radios.forEach(function(r) {
      r.addEventListener('change', function() {
        document.getElementById('opt-cohost').style.borderColor = 'var(--border-color)';
        document.getElementById('opt-cohost').style.background = 'rgba(255,255,255,0.03)';
        document.getElementById('opt-transfer').style.borderColor = 'var(--border-color)';
        document.getElementById('opt-transfer').style.background = 'rgba(255,255,255,0.03)';
        var sel = document.getElementById('opt-' + r.value);
        if (sel) { sel.style.borderColor = 'rgba(251,191,36,0.3)'; sel.style.background = 'rgba(251,191,36,0.08)'; }
      });
    });

    // Confirm handler
    document.getElementById('btn-confirm-host-transfer').addEventListener('click', function() {
      var checked = overlay.querySelector('input[name="host-type"]:checked');
      var type = checked ? checked.value : 'cohost';
      overlay.remove();
      if (type === 'transfer') {
        window._initiateHostTransfer(tId, { email: pEmail, uid: pUid, displayName: pName });
      } else {
        window._initiateCoHostInvite(tId, { email: pEmail, uid: pUid, displayName: pName });
      }
    });
  };

  // ─── Initiate host transfer ───────────────────────────────────────────────
  window._initiateHostTransfer = function(tId, target) {
    var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    var user = window.AppStore.currentUser;
    if (!t || !user) return;

    t.pendingTransfer = {
      targetEmail: target.email, targetUid: target.uid, targetName: target.displayName,
      fromEmail: user.email, fromUid: user.uid, createdAt: new Date().toISOString()
    };
    window.FirestoreDB.saveTournament(t);

    // Notify target
    _notifyByEmail(target.uid || target.email, {
      type: 'host_transfer_invite', tournamentId: String(t.id), tournamentName: t.name,
      fromName: user.displayName, fromUid: user.uid,
      message: (user.displayName || 'O organizador') + ' quer transferir a organizacao do torneio "' + t.name + '" para voce.',
      level: 'fundamental'
    });
    // Notify self
    _notifyByEmail(user.uid, {
      type: 'host_transfer_sent', tournamentId: String(t.id), tournamentName: t.name,
      targetName: target.displayName,
      message: 'Convite de transferencia enviado para ' + (target.displayName || target.email) + '.',
      level: 'all', inviteType: 'transfer'
    });
    if (typeof showNotification === 'function') showNotification('Convite Enviado', 'Aguardando resposta de ' + (target.displayName || target.email), 'info');
  };

  // ─── Initiate co-host invite ──────────────────────────────────────────────
  window._initiateCoHostInvite = function(tId, target) {
    var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    var user = window.AppStore.currentUser;
    if (!t || !user) return;

    if (!Array.isArray(t.coHosts)) t.coHosts = [];
    // Check if already invited/active
    var existing = t.coHosts.find(function(ch) { return ch.email === target.email; });
    if (existing) {
      if (typeof showNotification === 'function') showNotification('Ja convidado', (target.displayName || target.email) + ' ja e organizador ou tem convite pendente.', 'warning');
      return;
    }

    t.coHosts.push({
      email: target.email, displayName: target.displayName, uid: target.uid,
      status: 'pending', type: 'cohost', invitedAt: new Date().toISOString()
    });
    window.FirestoreDB.saveTournament(t);

    _notifyByEmail(target.uid || target.email, {
      type: 'cohost_invite', tournamentId: String(t.id), tournamentName: t.name,
      fromName: user.displayName, fromUid: user.uid,
      message: (user.displayName || 'O organizador') + ' convidou voce para ser co-organizador do torneio "' + t.name + '".',
      level: 'fundamental'
    });
    _notifyByEmail(user.uid, {
      type: 'cohost_invite_sent', tournamentId: String(t.id), tournamentName: t.name,
      targetName: target.displayName,
      message: 'Convite de co-organizacao enviado para ' + (target.displayName || target.email) + '.',
      level: 'all', inviteType: 'cohost'
    });
    if (typeof showNotification === 'function') showNotification('Convite Enviado', 'Aguardando resposta de ' + (target.displayName || target.email), 'info');
  };

  // ─── Accept host invite ───────────────────────────────────────────────────
  window._acceptHostInvite = function(tId, inviteType) {
    var user = window.AppStore.currentUser;
    if (!user) return;
    // Fresh read from Firestore
    window.FirestoreDB.db.collection('tournaments').doc(String(tId)).get().then(function(doc) {
      if (!doc.exists) return;
      var t = doc.data();
      t.id = doc.id;

      if (inviteType === 'transfer' && t.pendingTransfer) {
        // Move old organizer to co-hosts
        if (!Array.isArray(t.coHosts)) t.coHosts = [];
        t.coHosts.push({
          email: t.organizerEmail, displayName: t.organizerName, uid: t.pendingTransfer.fromUid || '',
          status: 'active', type: 'cohost', invitedAt: new Date().toISOString()
        });
        // Set new organizer
        var oldOrgUid = t.pendingTransfer.fromUid;
        t.organizerEmail = user.email;
        t.organizerName = user.displayName;
        t.pendingTransfer = null;
        window.FirestoreDB.saveTournament(t);
        // Notify old organizer
        _notifyByEmail(oldOrgUid, {
          type: 'host_invite_accepted', tournamentId: String(t.id), tournamentName: t.name,
          message: (user.displayName || 'O usuario') + ' aceitou a transferencia do torneio "' + t.name + '".',
          level: 'fundamental'
        });
        // Update local state
        var local = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
        if (local) { Object.assign(local, t); }
      } else if (inviteType === 'cohost') {
        if (!Array.isArray(t.coHosts)) t.coHosts = [];
        var entry = t.coHosts.find(function(ch) { return ch.email === user.email && ch.status === 'pending'; });
        if (entry) {
          entry.status = 'active';
          window.FirestoreDB.saveTournament(t);
          // Notify organizer
          _notifyByEmail(t.organizerEmail, {
            type: 'host_invite_accepted', tournamentId: String(t.id), tournamentName: t.name,
            message: (user.displayName || 'O usuario') + ' aceitou ser co-organizador do torneio "' + t.name + '".',
            level: 'all'
          });
          var local = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
          if (local) { Object.assign(local, t); }
        }
      }
      if (typeof showNotification === 'function') showNotification('Aceito!', 'Voce agora e ' + (inviteType === 'transfer' ? 'organizador' : 'co-organizador') + '.', 'success');
    }).catch(function(e) { console.warn('Accept host invite error:', e); if (typeof showNotification === 'function') showNotification('Erro', 'Não foi possível processar. Tente novamente.', 'error'); });
  };

  // ─── Reject host invite ───────────────────────────────────────────────────
  window._rejectHostInvite = function(tId, inviteType) {
    var user = window.AppStore.currentUser;
    if (!user) return;
    window.FirestoreDB.db.collection('tournaments').doc(String(tId)).get().then(function(doc) {
      if (!doc.exists) return;
      var t = doc.data();
      t.id = doc.id;

      if (inviteType === 'transfer' && t.pendingTransfer) {
        var fromUid = t.pendingTransfer.fromUid;
        t.pendingTransfer = null;
        window.FirestoreDB.saveTournament(t);
        _notifyByEmail(fromUid, {
          type: 'host_invite_rejected', tournamentId: String(t.id), tournamentName: t.name,
          message: (user.displayName || 'O usuario') + ' recusou a transferencia do torneio "' + t.name + '".',
          level: 'important'
        });
      } else if (inviteType === 'cohost') {
        if (Array.isArray(t.coHosts)) {
          t.coHosts = t.coHosts.filter(function(ch) { return !(ch.email === user.email && ch.status === 'pending'); });
          window.FirestoreDB.saveTournament(t);
          _notifyByEmail(t.organizerEmail, {
            type: 'host_invite_rejected', tournamentId: String(t.id), tournamentName: t.name,
            message: (user.displayName || 'O usuario') + ' recusou ser co-organizador do torneio "' + t.name + '".',
            level: 'important'
          });
        }
      }
      if (typeof showNotification === 'function') showNotification('Recusado', 'Convite recusado.', 'info');
    }).catch(function(e) { console.warn('Reject host invite error:', e); if (typeof showNotification === 'function') showNotification('Erro', 'Não foi possível processar. Tente novamente.', 'error'); });
  };

  // ─── Cancel host invite (by organizer) ────────────────────────────────────
  window._cancelHostInvite = function(tId, inviteType) {
    var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    if (!t) return;
    if (inviteType === 'transfer' && t.pendingTransfer) {
      t.pendingTransfer = null;
    } else if (inviteType === 'cohost' && Array.isArray(t.coHosts)) {
      t.coHosts = t.coHosts.filter(function(ch) { return ch.status !== 'pending'; });
    }
    window.FirestoreDB.saveTournament(t);
    if (typeof showNotification === 'function') showNotification('Cancelado', 'Convite cancelado.', 'info');
  };

  // ─── Remove co-host (creator only) ───────────────────────────────────────
  window._removeCoHost = function(tId, coHostEmail) {
    var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    if (!t || !window.AppStore.isCreator(t)) return;
    if (!Array.isArray(t.coHosts)) return;
    var removed = t.coHosts.find(function(ch) { return ch.email === coHostEmail; });
    t.coHosts = t.coHosts.filter(function(ch) { return ch.email !== coHostEmail; });
    window.FirestoreDB.saveTournament(t);
    if (removed && typeof window._sendUserNotification === 'function') {
      _notifyByEmail(removed.uid || coHostEmail, {
        type: 'cohost_removed', tournamentId: String(t.id), tournamentName: t.name,
        message: 'Voce foi removido como co-organizador do torneio "' + t.name + '".',
        level: 'important'
      });
    }
    if (typeof showNotification === 'function') showNotification('Removido', (removed ? removed.displayName : coHostEmail) + ' removido da organizacao.', 'info');
    var container = document.getElementById('view-container');
    if (container && typeof renderTournaments === 'function') renderTournaments(container, String(tId));
  };

  // ─── Crown drop handler ───────────────────────────────────────────────────
  window._handleCrownDrop = function(event, tId) {
    event.preventDefault();
    var dragData = window._participantDragData;
    if (!dragData) return;
    window._openHostTransferDialog(dragData, tId);
  };

  // ─── Helper: send notification by uid or email lookup ─────────────────────
  function _notifyByEmail(uidOrEmail, data) {
    if (!uidOrEmail) return;
    data.createdAt = new Date().toISOString();
    data.read = false;
    // If it looks like a UID (no @), send directly
    if (uidOrEmail.indexOf('@') === -1) {
      if (typeof window._sendUserNotification === 'function') {
        window._sendUserNotification(uidOrEmail, data);
      } else if (window.FirestoreDB && window.FirestoreDB.addNotification) {
        window.FirestoreDB.addNotification(uidOrEmail, data);
      }
      return;
    }
    // Lookup by email
    if (window.FirestoreDB && window.FirestoreDB.db) {
      window.FirestoreDB.db.collection('users').where('email', '==', uidOrEmail).limit(1).get().then(function(snap) {
        if (!snap.empty) {
          var uid = snap.docs[0].id;
          if (typeof window._sendUserNotification === 'function') {
            window._sendUserNotification(uid, data);
          } else {
            window.FirestoreDB.addNotification(uid, data);
          }
        }
      }).catch(function(e) { console.warn('Notify lookup error:', e); });
    }
  }
})();
