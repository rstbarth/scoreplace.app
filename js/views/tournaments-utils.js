// Normalize format: 'Ranking' → 'Liga' (unificado em v0.2.6)
// Defined at top level so it's available immediately on script load
window._isLigaFormat = window._isLigaFormat || function(t) {
    return t && (t.format === 'Liga' || t.format === 'Ranking');
};

// ── Deduplicação de participantes por uid/email ──────────────────────────────
// Remove duplicatas causadas por troca de nome no perfil.
// Mantém a entrada mais recente (última no array = nome atualizado).
// Retorna número de duplicatas removidas.
window._deduplicateParticipants = function(t) {
    if (!t || !Array.isArray(t.participants)) return 0;
    var seen = {};
    var deduped = [];
    var removedCount = 0;

    // Pass 1: collect all names that are part of teams (strings with " / ")
    var teamMembers = {};
    t.participants.forEach(function(p) {
        var name = typeof p === 'string' ? p : (p ? (p.displayName || p.name || '') : '');
        if (name.indexOf(' / ') !== -1) {
            name.split(' / ').forEach(function(n) {
                var nm = n.trim().toLowerCase();
                if (nm) teamMembers[nm] = name; // track which team they belong to
            });
        }
    });

    // Pass 2: deduplicate by uid/email AND by name-in-team
    t.participants.forEach(function(p) {
        if (!p) return;
        if (typeof p === 'string') {
            // Check if this individual name is already part of a team entry
            if (p.indexOf(' / ') === -1 && teamMembers[p.trim().toLowerCase()]) {
                removedCount++;
                return; // skip — already represented inside a team
            }
            deduped.push(p);
            return;
        }
        if (typeof p !== 'object') return;
        var pName = (p.displayName || p.name || '').trim();

        // Check if this individual is already inside a team string
        if (pName && pName.indexOf(' / ') === -1 && teamMembers[pName.toLowerCase()]) {
            removedCount++;
            return; // skip — already represented inside a team
        }

        // Deduplicate by uid/email
        var key = p.uid ? ('uid:' + p.uid) : (p.email ? ('email:' + p.email) : null);
        if (key && seen[key]) {
            removedCount++;
            var prevIdx = deduped.indexOf(seen[key]);
            if (prevIdx !== -1) deduped[prevIdx] = p;
            seen[key] = p;
        } else {
            if (key) seen[key] = p;
            deduped.push(p);
        }
    });

    if (removedCount > 0) {
        t.participants = deduped;
        console.log('[Dedup] Removed ' + removedCount + ' duplicate participant(s) from tournament ' + (t.name || t.id));
    }
    return removedCount;
};

// ── Fix orphaned match names ─────────────────────────────────────────────────
// Detects names in match data (p1/p2/teams/groups/sorteio) that don't match
// any current participant. Pairs them with participants that exist in the
// participant list but NOT in any match data. This fixes the scenario where
// a user changed their display name and the participant object was updated
// but the match/draw strings were not.
// Returns number of fixes applied.
window._fixOrphanedMatchNames = function(t) {
    if (!t) return 0;
    var parts = Array.isArray(t.participants) ? t.participants : [];
    if (parts.length === 0) return 0;

    // 1. Collect all current participant names (individual, not teams)
    var participantNames = {};
    parts.forEach(function(p) {
        var name = typeof p === 'string' ? p : (p ? (p.displayName || p.name || '') : '');
        if (!name) return;
        if (name.indexOf(' / ') !== -1) {
            name.split(' / ').forEach(function(n) { var nm = n.trim(); if (nm) participantNames[nm] = true; });
        } else {
            participantNames[name] = true;
        }
    });

    // 2. Collect all unique names from match data
    var matchNames = {};
    var _extractNames = function(str) {
        if (!str || typeof str !== 'string') return;
        if (str === 'BYE' || str === 'TBD' || str === 'draw') return;
        if (str.indexOf(' / ') !== -1) {
            str.split(' / ').forEach(function(n) { var nm = n.trim(); if (nm && nm !== 'BYE' && nm !== 'TBD') matchNames[nm] = true; });
        } else {
            matchNames[str] = true;
        }
    };
    var _scanMatch = function(m) {
        if (!m) return;
        _extractNames(m.p1); _extractNames(m.p2); _extractNames(m.winner);
        if (Array.isArray(m.team1)) m.team1.forEach(function(n) { if (n) matchNames[n] = true; });
        if (Array.isArray(m.team2)) m.team2.forEach(function(n) { if (n) matchNames[n] = true; });
    };
    if (Array.isArray(t.matches)) t.matches.forEach(_scanMatch);
    if (t.thirdPlaceMatch) _scanMatch(t.thirdPlaceMatch);
    if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) {
        if (r && Array.isArray(r.matches)) r.matches.forEach(_scanMatch);
    });
    if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
        if (!g) return;
        if (Array.isArray(g.matches)) g.matches.forEach(_scanMatch);
        if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) {
            if (Array.isArray(gr)) gr.forEach(_scanMatch);
            else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_scanMatch);
        });
        if (Array.isArray(g.players)) g.players.forEach(function(pl) { if (pl) matchNames[pl] = true; });
    });
    if (Array.isArray(t.rodadas)) t.rodadas.forEach(function(r) {
        if (Array.isArray(r)) r.forEach(_scanMatch);
        else if (r && Array.isArray(r.matches)) r.matches.forEach(_scanMatch);
    });
    if (Array.isArray(t.sorteioRealizado)) t.sorteioRealizado.forEach(function(item) {
        if (typeof item === 'string') _extractNames(item);
        else if (typeof item === 'object' && item) { _extractNames(item.name); _extractNames(item.displayName); }
    });

    // 3. Find orphans (in matches but NOT in participants) and unmatched (in participants but NOT in matches)
    var orphans = [];
    var unmatched = [];
    Object.keys(matchNames).forEach(function(name) {
        if (!participantNames[name]) orphans.push(name);
    });
    Object.keys(participantNames).forEach(function(name) {
        if (!matchNames[name]) unmatched.push(name);
    });

    if (orphans.length === 0 || unmatched.length === 0) return 0;
    console.log('[FixOrphans] Orphan match names:', orphans, 'Unmatched participants:', unmatched);

    // 4. Try to pair orphans with unmatched participants
    var fixes = [];

    // Strategy A: if exactly 1 orphan and 1 unmatched, they're the same person
    if (orphans.length === 1 && unmatched.length === 1) {
        fixes.push({ oldName: orphans[0], newName: unmatched[0] });
    } else {
        // Strategy B: for each orphan, try to match by uid/email from participant objects
        // Build uid→name and email→name from current participants
        var uidToName = {};
        var emailToName = {};
        parts.forEach(function(p) {
            if (typeof p !== 'object' || !p) return;
            var nm = p.displayName || p.name || '';
            if (!nm) return;
            if (p.uid) uidToName[p.uid] = nm;
            if (p.email) emailToName[p.email] = nm;
        });

        // Check sorteioRealizado objects — they might have uid/email linking old name to participant
        if (Array.isArray(t.sorteioRealizado)) {
            t.sorteioRealizado.forEach(function(item) {
                if (typeof item !== 'object' || !item) return;
                var sName = item.displayName || item.name || '';
                if (!sName || participantNames[sName]) return; // not an orphan
                // This is an orphan with uid/email — match to current participant
                var currentName = (item.uid && uidToName[item.uid]) || (item.email && emailToName[item.email]);
                if (currentName && currentName !== sName) {
                    if (!fixes.some(function(f) { return f.oldName === sName; })) {
                        fixes.push({ oldName: sName, newName: currentName });
                    }
                }
            });
        }

        // For remaining orphans without uid match, try matching by count
        // If we still have exactly 1 unmatched orphan and 1 unmatched participant after Strategy B, pair them
        var fixedOrphans = {};
        fixes.forEach(function(f) { fixedOrphans[f.oldName] = true; });
        var remainingOrphans = orphans.filter(function(o) { return !fixedOrphans[o]; });
        var fixedNewNames = {};
        fixes.forEach(function(f) { fixedNewNames[f.newName] = true; });
        var remainingUnmatched = unmatched.filter(function(u) { return !fixedNewNames[u]; });
        if (remainingOrphans.length === 1 && remainingUnmatched.length === 1) {
            fixes.push({ oldName: remainingOrphans[0], newName: remainingUnmatched[0] });
        }
    }

    if (fixes.length === 0) return 0;

    // 5. Apply fixes using _propagateNameChange
    console.log('[FixOrphans] Applying ' + fixes.length + ' fix(es):', fixes.map(function(f) { return '"' + f.oldName + '" → "' + f.newName + '"'; }));
    var fixCount = 0;
    fixes.forEach(function(f) {
        if (typeof window._propagateNameChange === 'function') {
            // Find uid/email for the new name from participant objects
            var uid = null, email = null;
            parts.forEach(function(p) {
                if (typeof p !== 'object' || !p) return;
                var nm = p.displayName || p.name || '';
                if (nm === f.newName) { uid = p.uid || null; email = p.email || null; }
            });
            window._propagateNameChange(f.oldName, f.newName, uid, email);
            fixCount++;
        }
    });

    if (fixCount > 0 && typeof showNotification === 'function') {
        showNotification('Nomes Corrigidos', fixes.map(function(f) { return '"' + f.oldName + '" → "' + f.newName + '"'; }).join(', '), 'info');
    }
    return fixCount;
};

window._getTournamentProgress = function(t) {
    if (!t) return { total: 0, completed: 0, pct: 0 };
    var allMatches = [];
    // Collect matches from all structures
    if (Array.isArray(t.matches)) allMatches = allMatches.concat(t.matches);
    if (Array.isArray(t.rounds)) {
        t.rounds.forEach(function(r) {
            if (Array.isArray(r.matches)) allMatches = allMatches.concat(r.matches);
        });
    }
    if (Array.isArray(t.groups)) {
        t.groups.forEach(function(g) {
            if (Array.isArray(g.matches)) allMatches = allMatches.concat(g.matches);
        });
    }
    if (Array.isArray(t.rodadas)) {
        t.rodadas.forEach(function(rd) {
            if (Array.isArray(rd.matches)) allMatches = allMatches.concat(rd.matches);
            if (Array.isArray(rd.jogos)) allMatches = allMatches.concat(rd.jogos);
        });
    }
    if (t.thirdPlaceMatch) allMatches.push(t.thirdPlaceMatch);
    // Filter out BYE matches
    var realMatches = allMatches.filter(function(m) {
        var p1 = m.p1 || m.player1 || '';
        var p2 = m.p2 || m.player2 || '';
        return p1 && p2 && p1 !== 'BYE' && p2 !== 'BYE' && p1 !== 'TBD' && p2 !== 'TBD';
    });
    var completed = realMatches.filter(function(m) {
        return m.winner || m.result || (m.score1 !== undefined && m.score2 !== undefined && (m.score1 !== null && m.score2 !== null));
    });
    var total = realMatches.length;
    var pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    return { total: total, completed: completed.length, pct: pct };
};
// Calculate next automatic draw date for Ranking/Suíço tournaments
window._calcNextDrawDate = function(t) {
    if (!t || !t.drawFirstDate) return null;
    var firstDrawStr = t.drawFirstDate + 'T' + (t.drawFirstTime || '19:00');
    var firstDraw = new Date(firstDrawStr);
    if (isNaN(firstDraw.getTime())) return null;
    var intervalMs = (t.drawIntervalDays || 7) * 86400000;
    var now = new Date();
    // If first draw is in the future, that's the next one
    if (firstDraw > now) return firstDraw;
    // Calculate how many intervals have passed
    var elapsed = now.getTime() - firstDraw.getTime();
    var intervals = Math.floor(elapsed / intervalMs);
    var next = new Date(firstDraw.getTime() + (intervals + 1) * intervalMs);
    return next;
};

// Navigate to tournament detail and scroll to highlight the enrolled participant
window._scrollToParticipant = function(tId, participantName) {
    window.location.hash = '#tournaments/' + tId;
    // Wait for render, then scroll to the participant card
    var _attempts = 0;
    var _tryScroll = function() {
        _attempts++;
        var cards = document.querySelectorAll('.participant-card[data-participant-name]');
        var target = null;
        cards.forEach(function(c) {
            var n = c.getAttribute('data-participant-name') || '';
            if (n.toLowerCase().indexOf(participantName.toLowerCase()) !== -1 ||
                participantName.toLowerCase().indexOf(n.toLowerCase()) !== -1) {
                target = c;
            }
        });
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight animation
            target.style.transition = 'box-shadow 0.3s, transform 0.3s';
            target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.6), 0 0 20px rgba(16,185,129,0.3)';
            target.style.transform = 'scale(1.03)';
            setTimeout(function() {
                target.style.boxShadow = '';
                target.style.transform = '';
            }, 2500);
        } else if (_attempts < 15) {
            setTimeout(_tryScroll, 200);
        }
    };
    setTimeout(_tryScroll, 300);
};
// ── Centralized Notification System ──
// Notification levels: 'fundamental' (always sent), 'important', 'all'
// User pref notifyLevel: 'todas' (receives all), 'importantes' (fundamental+important), 'fundamentais' (only fundamental)
window._notifLevelAllowed = function(userLevel, notifLevel) {
    if (!userLevel || userLevel === 'todas') return true;
    if (userLevel === 'none') return false;
    if (userLevel === 'importantes') return notifLevel === 'fundamental' || notifLevel === 'important';
    if (userLevel === 'fundamentais') return notifLevel === 'fundamental';
    return true;
};

// ── Tournament Venue Map (detail page) ──
window._initTournamentVenueMap = async function(el) {
    if (!el || !window.google || !window.google.maps) {
        if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.75rem;">Mapa indisponível</div>';
        return;
    }
    var lat = parseFloat(el.getAttribute('data-lat'));
    var lng = parseFloat(el.getAttribute('data-lng'));
    var venueName = el.getAttribute('data-venue') || '';
    if (isNaN(lat) || isNaN(lng)) return;

    try {
        var { Map } = await google.maps.importLibrary('maps');
        var { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

        var map = new Map(el, {
            center: { lat: lat, lng: lng },
            zoom: 15,
            mapId: 'scoreplace-venue-map',
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
            clickableIcons: false,
            colorScheme: 'DARK'
        });

        var pin = document.createElement('div');
        pin.style.cssText = 'width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;';
        pin.textContent = '📍';

        new AdvancedMarkerElement({
            map: map,
            position: { lat: lat, lng: lng },
            content: pin,
            title: venueName
        });
    } catch (e) {
        console.warn('[venue-map] init error:', e);
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.75rem;">Mapa indisponível</div>';
    }
};
