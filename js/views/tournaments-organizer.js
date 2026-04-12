// ── Organizer Actions & Notifications ──
// Clone tournament — creates a new tournament based on an existing one
window._cloneTournament = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t || !window.AppStore.currentUser) return;

    var newT = {
        name: t.name + ' (cópia)',
        sport: t.sport,
        format: t.format,
        isPublic: t.isPublic,
        enrollmentMode: t.enrollmentMode || 'misto',
        maxParticipants: t.maxParticipants || '',
        venue: t.venue || '',
        venueLat: t.venueLat || '',
        venueLon: t.venueLon || '',
        venueAddress: t.venueAddress || '',
        venuePlaceId: t.venuePlaceId || '',
        venueAccess: t.venueAccess || '',
        courtCount: t.courtCount || '',
        courtNames: t.courtNames || '',
        logoData: t.logoData || '',
        logoLocked: t.logoLocked || false,
        teamSize: t.teamSize || 2,
        tiebreakers: t.tiebreakers || [],
        genderCategories: t.genderCategories || [],
        skillCategories: t.skillCategories || [],
        combinedCategories: t.combinedCategories || [],
        resultEntry: t.resultEntry || 'organizer',
        organizerEmail: window.AppStore.currentUser.email,
        organizerName: window.AppStore.currentUser.displayName,
        participants: [],
        status: 'open',
        createdAt: new Date().toISOString()
    };

    // Liga-specific fields
    if (window._isLigaFormat && window._isLigaFormat(t)) {
        newT.ligaSeasonMonths = t.ligaSeasonMonths || t.rankingSeasonMonths || '';
        newT.ligaOpenEnrollment = t.ligaOpenEnrollment !== false;
        newT.ligaInactivityWeeks = t.ligaInactivityWeeks || '';
        newT.ligaNewPlayerPoints = t.ligaNewPlayerPoints || '';
    }
    // Suíço-specific
    if (t.format === 'Suíço Clássico') {
        newT.swissRounds = t.swissRounds || '';
    }
    // Draw scheduling
    if (t.drawIntervalDays) {
        newT.drawIntervalDays = t.drawIntervalDays;
        newT.drawManual = t.drawManual || false;
    }

    window.AppStore.addTournament(newT);
    var _t = window._t || function(k) { return k; };
    if (typeof showNotification === 'function') showNotification(_t('org.clonedTitle'), '"' + newT.name + '" ' + _t('org.clonedMsg'), 'success');
    // Navigate to the new tournament
    setTimeout(function() {
        var newest = window.AppStore.tournaments.find(function(tour) { return tour.name === newT.name && tour.organizerEmail === newT.organizerEmail; });
        if (newest) {
            window.location.hash = '#tournaments/' + newest.id;
        } else {
            window.location.hash = '#dashboard';
        }
    }, 500);
};


/**
 * Send notification to a specific user (by uid) via all their enabled channels.
 * @param {string} uid - target user UID
 * @param {object} notifData - { type, message, tournamentId, tournamentName, level ('fundamental'|'important'|'all') }
 */
window._sendUserNotification = async function(uid, notifData) {
    if (!window.FirestoreDB || !window.FirestoreDB.db || !uid) return;
    try {
        var profile = await window.FirestoreDB.loadUserProfile(uid);
        if (!profile) return;
        var userLevel = profile.notifyLevel || 'todas';
        var notifLevel = notifData.level || 'all';
        if (!window._notifLevelAllowed(userLevel, notifLevel)) return;

        var cu = window.AppStore.currentUser || {};
        // Platform notification
        if (profile.notifyPlatform !== false) {
            var _notifPayload = {
                type: notifData.type || 'info',
                fromUid: cu.uid || cu.email || '',
                fromName: cu.displayName || '',
                fromPhoto: cu.photoURL || '',
                tournamentId: notifData.tournamentId || '',
                tournamentName: notifData.tournamentName || '',
                message: notifData.message || '',
                createdAt: new Date().toISOString(),
                read: false
            };
            if (notifData.inviteType) _notifPayload.inviteType = notifData.inviteType;
            await window.FirestoreDB.addNotification(uid, _notifPayload);
        }
        // Email — collect for batch (returned)
        var email = (profile.notifyEmail !== false && profile.email) ? profile.email : null;
        // WhatsApp — collect phone
        var phone = null;
        if (profile.notifyWhatsApp !== false && profile.phone) {
            var cc = profile.phoneCountry || '55';
            var digits = (profile.phone || '').replace(/\D/g, '');
            if (digits) phone = cc + digits;
        }
        return { email: email, phone: phone };
    } catch(e) {
        console.warn('_sendUserNotification error:', e);
        return null;
    }
};

/**
 * Notify all enrolled participants of a tournament.
 * @param {object} tournament - tournament object
 * @param {object} notifData - { type, message, level }
 * @param {string} [excludeEmail] - email to exclude (e.g. the person who triggered the event)
 */
window._notifyTournamentParticipants = async function(tournament, notifData, excludeEmail) {
    if (!window.FirestoreDB || !window.FirestoreDB.db) return;
    var t = tournament;
    var parts = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
    var emails = [];
    parts.forEach(function(p) {
        var e = typeof p === 'string' ? '' : (p.email || '');
        if (e && e !== excludeEmail) emails.push(e);
    });
    // Also notify organizer (always involved in their tournament) if not excluded and not already in the list
    if (t.organizerEmail && t.organizerEmail !== excludeEmail && emails.indexOf(t.organizerEmail) === -1) {
        emails.push(t.organizerEmail);
    }
    // Deduplicate
    emails = emails.filter(function(e, i) { return emails.indexOf(e) === i; });

    var nd = Object.assign({}, notifData, { tournamentId: String(t.id), tournamentName: t.name || '' });
    var allEmails = [];
    var allPhones = [];

    for (var i = 0; i < emails.length; i++) {
        try {
            // Look up uid by email
            var snap = await window.FirestoreDB.db.collection('users').where('email', '==', emails[i]).limit(1).get();
            if (!snap.empty) {
                var uid = snap.docs[0].id;
                var result = await window._sendUserNotification(uid, nd);
                if (result && result.email) allEmails.push(result.email);
                if (result && result.phone) allPhones.push(result.phone);
            }
        } catch(e) { console.warn('Notify participant error:', e); }
    }
    return { emails: allEmails, phones: allPhones };
};

/**
 * Check and send countdown reminders for tournaments (7d, 2d, day-of).
 * Should be called on app load / periodically.
 */
window._checkTournamentReminders = async function() {
    if (!window.AppStore || !window.AppStore.currentUser || !window.FirestoreDB) return;
    var cu = window.AppStore.currentUser;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tournaments = window.AppStore.tournaments || [];

    for (var i = 0; i < tournaments.length; i++) {
        var t = tournaments[i];
        if (!t.startDate || t.status === 'finished') continue;
        // Check if user is enrolled
        var parts = Array.isArray(t.participants) ? t.participants : [];
        var enrolled = parts.some(function(p) {
            var str = typeof p === 'string' ? p : (p.email || p.displayName || '');
            var pEmail = typeof p === 'object' ? (p.email || '') : str;
            var pUid = typeof p === 'object' ? (p.uid || '') : '';
            var pName = typeof p === 'object' ? (p.displayName || p.name || '') : str;
            return (cu.email && pEmail === cu.email) || (cu.uid && pUid === cu.uid) || (cu.displayName && pName === cu.displayName);
        });
        if (!enrolled) continue;

        var startStr = t.startDate.split('T')[0];
        var startDate = new Date(startStr + 'T00:00:00');
        var diffDays = Math.round((startDate - today) / (1000 * 60 * 60 * 24));

        var reminderKey = null;
        var reminderMsg = null;
        var reminderLevel = 'all';
        if (diffDays === 7) {
            reminderKey = 'reminder_7d_' + t.id;
            reminderMsg = 'Faltam 7 dias para o torneio "' + t.name + '"! Prepare-se!';
            reminderLevel = 'all';
        } else if (diffDays === 2) {
            reminderKey = 'reminder_2d_' + t.id;
            reminderMsg = 'Faltam 2 dias para o torneio "' + t.name + '"!';
            reminderLevel = 'important';
        } else if (diffDays === 0) {
            reminderKey = 'reminder_0d_' + t.id;
            reminderMsg = 'Hoje é o dia do torneio "' + t.name + '"! Boa sorte!';
            reminderLevel = 'fundamental';
        }

        if (reminderKey && reminderMsg) {
            // Avoid duplicate: check localStorage
            var sentKey = '_notifSent_' + reminderKey + '_' + (cu.uid || cu.email);
            try {
                if (localStorage.getItem(sentKey)) continue;
            } catch(e) {}

            var uid = cu.uid || cu.email;
            await window._sendUserNotification(uid, {
                type: 'tournament_reminder',
                message: reminderMsg,
                tournamentId: String(t.id),
                tournamentName: t.name || '',
                level: reminderLevel
            });
            try { localStorage.setItem(sentKey, '1'); } catch(e) {}
        }
    }
};

/**
 * Check for new tournaments near user's preferred CEPs.
 * Called on app load when new tournaments exist.
 */
// Haversine distance in km between two lat/lng points
function _haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

window._checkNearbyTournaments = async function() {
    if (!window.AppStore || !window.AppStore.currentUser || !window.FirestoreDB) return;
    var cu = window.AppStore.currentUser;

    // Location-based matching (primary) + legacy CEP matching (fallback)
    var userLocs = Array.isArray(cu.preferredLocations) ? cu.preferredLocations : [];
    var userCeps = (cu.preferredCeps || '').split(',').map(function(c) { return c.trim().replace(/\D/g, ''); }).filter(function(c) { return c.length >= 5; });
    if (userLocs.length === 0 && userCeps.length === 0) return;

    var NEARBY_RADIUS_KM = 15; // notify if tournament is within 15km
    var tournaments = window.AppStore.tournaments || [];
    var uid = cu.uid || cu.email;

    for (var i = 0; i < tournaments.length; i++) {
        var t = tournaments[i];
        if (t.status === 'finished' || t.status === 'closed') continue;
        if (!t.venueAddress && !t.venue && !t.venueLat) continue;
        // Check if already notified
        var nKey = '_notifNearby_' + t.id + '_' + uid;
        try { if (localStorage.getItem(nKey)) continue; } catch(e) {}

        var matched = false;

        // 1) Distance-based matching (preferred)
        if (t.venueLat && t.venueLon && userLocs.length > 0) {
            var tLat = parseFloat(t.venueLat);
            var tLng = parseFloat(t.venueLon);
            if (!isNaN(tLat) && !isNaN(tLng)) {
                matched = userLocs.some(function(loc) {
                    return _haversineKm(loc.lat, loc.lng, tLat, tLng) <= NEARBY_RADIUS_KM;
                });
            }
        }

        // 2) Legacy CEP text matching (fallback)
        if (!matched && userCeps.length > 0 && (t.venueAddress || t.venue)) {
            var venueText = ((t.venueAddress || '') + ' ' + (t.venue || '')).replace(/\D/g, ' ');
            matched = userCeps.some(function(cep) { return venueText.indexOf(cep) !== -1; });
        }

        // Also check if tournament sport matches user preferred sports
        var userSports = (cu.preferredSports || '').toLowerCase();
        var sportMatch = !userSports || (t.sport && userSports.indexOf(t.sport.toLowerCase()) !== -1);

        if (matched || sportMatch) {
            // Check if user is already enrolled
            var parts = Array.isArray(t.participants) ? t.participants : [];
            var enrolled = parts.some(function(p) {
                var str = typeof p === 'string' ? p : (p.email || '');
                var pEmail = typeof p === 'object' ? (p.email || '') : str;
                var pUid = typeof p === 'object' ? (p.uid || '') : '';
                var pName = typeof p === 'object' ? (p.displayName || p.name || '') : str;
                return (cu.email && pEmail === cu.email) || (cu.uid && pUid === cu.uid) || (cu.displayName && pName === cu.displayName);
            });
            if (enrolled) continue;

            await window._sendUserNotification(uid, {
                type: 'tournament_nearby',
                message: 'Novo torneio perto de você: "' + t.name + '"' + (t.venue ? ' em ' + t.venue : '') + '. Inscrições abertas!',
                tournamentId: String(t.id),
                tournamentName: t.name || '',
                level: 'all'
            });
            try { localStorage.setItem(nKey, '1'); } catch(e) {}
        }
    }
};

/**
 * Organizer sends a communication to all enrolled participants.
 * Prompts for message text and importance level.
 */
window._sendOrgCommunication = function(tId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t) return;

    // Build a custom modal for the communication
    var modalId = 'modal-org-comm-' + tId;
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var html = '<div id="' + modalId + '" class="modal-overlay active" style="z-index: 10000;">' +
      '<div class="modal" style="max-width: 480px; width: 95%;">' +
        '<div class="modal-header" style="padding: 1.5rem 1.5rem 0;">' +
          '<h2 class="card-title" style="margin: 0; font-size: 1rem;">📢 ' + (window._t||function(k){return k;})('org.commTitle') + '</h2>' +
          '<button class="modal-close" onclick="document.getElementById(\'' + modalId + '\').remove();">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 1.5rem;">' +
          '<p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 1rem;">' + (window._t||function(k){return k;})('org.commDesc', { name: window._safeHtml(t.name || '') }) + '</p>' +
          '<div class="form-group" style="margin-bottom: 1rem;">' +
            '<label class="form-label" style="font-size: 0.8rem; font-weight: 600;">' + (window._t||function(k){return k;})('org.commMessage') + '</label>' +
            '<textarea id="org-comm-text-' + tId + '" class="form-control" rows="4" placeholder="' + (window._t||function(k){return k;})('org.commPlaceholder') + '" style="width: 100%; box-sizing: border-box; resize: vertical;"></textarea>' +
          '</div>' +
          '<div class="form-group" style="margin-bottom: 1rem;">' +
            '<label class="form-label" style="font-size: 0.8rem; font-weight: 600;">' + (window._t||function(k){return k;})('org.commLevel') + '</label>' +
            '<p style="font-size: 0.65rem; color: var(--text-muted); margin: 0 0 8px;">' + (window._t||function(k){return k;})('org.commLevelDesc') + '</p>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">' +
              '<button type="button" class="btn org-comm-level-btn" data-level="fundamental" onclick="window._selectCommLevel(this, \'' + tId + '\')" style="padding: 8px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #f87171; cursor: pointer; text-align: center;">🔴 ' + (window._t||function(k){return k;})('org.levelFundamental') + '</button>' +
              '<button type="button" class="btn org-comm-level-btn" data-level="important" onclick="window._selectCommLevel(this, \'' + tId + '\')" style="padding: 8px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; border: 2px solid rgba(251,191,36,0.7); background: rgba(251,191,36,0.25); color: #fbbf24; cursor: pointer; text-align: center; box-shadow: 0 0 8px rgba(251,191,36,0.2);">🟡 ' + (window._t||function(k){return k;})('org.levelImportant') + '</button>' +
              '<button type="button" class="btn org-comm-level-btn" data-level="all" onclick="window._selectCommLevel(this, \'' + tId + '\')" style="padding: 8px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); color: #10b981; cursor: pointer; text-align: center;">🟢 ' + (window._t||function(k){return k;})('org.levelGeneral') + '</button>' +
            '</div>' +
            '<input type="hidden" id="org-comm-level-' + tId + '" value="important">' +
          '</div>' +
          '<div style="display: flex; gap: 8px;">' +
            '<button type="button" class="btn btn-primary" style="flex: 1;" onclick="window._confirmSendComm(\'' + tId + '\')">' + (window._t||function(k){return k;})('org.sendComm') + '</button>' +
            '<button type="button" class="btn btn-outline" style="flex: 0.6;" onclick="document.getElementById(\'' + modalId + '\').remove();">' + (window._t||function(k){return k;})('org.cancel') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
};

window._selectCommLevel = function(btn, tId) {
    var level = btn.getAttribute('data-level');
    document.getElementById('org-comm-level-' + tId).value = level;
    var btns = btn.parentElement.querySelectorAll('.org-comm-level-btn');
    var colors = { fundamental: 'rgba(239,68,68,', important: 'rgba(251,191,36,', all: 'rgba(16,185,129,' };
    btns.forEach(function(b) {
        var l = b.getAttribute('data-level');
        var c = colors[l];
        if (l === level) {
            b.style.background = c + '0.25)';
            b.style.border = '2px solid ' + c + '0.7)';
            b.style.boxShadow = '0 0 8px ' + c + '0.2)';
        } else {
            b.style.background = c + '0.08)';
            b.style.border = '1px solid ' + c + '0.3)';
            b.style.boxShadow = 'none';
        }
    });
};

window._confirmSendComm = async function(tId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t) return;
    var textEl = document.getElementById('org-comm-text-' + tId);
    var levelEl = document.getElementById('org-comm-level-' + tId);
    var message = textEl ? textEl.value.trim() : '';
    var level = levelEl ? levelEl.value : 'important';
    if (!message) {
        var _t = window._t || function(k) { return k; };
        if (typeof showAlertDialog !== 'undefined') showAlertDialog(_t('org.msgRequired'), _t('org.msgRequiredDesc'), null, { type: 'warning' });
        return;
    }

    var cu = window.AppStore.currentUser;
    var fullMsg = '📢 Comunicado do organizador — "' + t.name + '": ' + message;

    var result = await window._notifyTournamentParticipants(t, {
        type: 'organizer_communication',
        message: fullMsg,
        level: level
    }, cu ? cu.email : null);

    var modalEl = document.getElementById('modal-org-comm-' + tId);
    if (modalEl) modalEl.remove();

    var count = result ? result.emails.length + result.phones.length : 0;
    if (typeof showNotification !== 'undefined') showNotification((window._t||function(k){return k;})('org.commSentTitle'), (window._t||function(k){return k;})('org.commSentMsg'), 'success');

    // Open email/WhatsApp if collected
    if (result && result.emails.length > 0) {
        var emailSubject = encodeURIComponent('📢 ' + t.name + ' — Comunicado do Organizador');
        var emailBody = encodeURIComponent(message + '\n\n---\nTorneio: ' + t.name + '\n' + window._tournamentUrl(t.id));
        window.open('mailto:?bcc=' + result.emails.join(',') + '&subject=' + emailSubject + '&body=' + emailBody, '_self');
    }
    if (result && result.phones.length > 0) {
        var waMsg = '📢 ' + t.name + '\n' + message + '\n\n' + window._tournamentUrl(t.id);
        window.open(window._whatsappShareUrl(waMsg), '_blank');
    }
};

// ─── Save as Template ─────────────────────────────────────────────────────
window._saveAsTemplate = function(tId) {
  var t = (window.AppStore.tournaments || []).find(function(x) { return x.id === tId; });
  if (!t) return;
  var _t = window._t || function(k) { return k; };
  if (typeof showInputDialog === 'function') {
    showInputDialog(_t('template.namePrompt'), t.name, function(templateName) {
      if (!templateName || !templateName.trim()) return;
      var template = {
        name: templateName.trim(),
        sport: t.sport || '',
        format: t.format || '',
        scoring: t.scoring || null,
        genderCategories: t.genderCategories || [],
        skillCategories: t.skillCategories || [],
        combinedCategories: t.combinedCategories || [],
        enrollmentMode: t.enrollmentMode || 'open',
        maxParticipants: t.maxParticipants || '',
        courtCount: t.courtCount || '',
        gameDuration: t.gameDuration || '',
        venue: t.venue || '',
        venueLat: t.venueLat || null,
        venueLon: t.venueLon || null,
        venueAddress: t.venueAddress || '',
        teamSize: t.teamSize || 1
      };
      window._saveTemplate(template).then(function(ok) {
        if (ok) {
          showNotification(_t('template.saved'), '', 'success');
        } else {
          showNotification(_t('template.limitFree'), '', 'warning');
        }
      })
    });
  }
};
