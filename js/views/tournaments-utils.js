// Normalize format: 'Ranking' → 'Liga' (unificado em v0.2.6)
// Defined at top level so it's available immediately on script load
window._isLigaFormat = window._isLigaFormat || function(t) {
    return t && (t.format === 'Liga' || t.format === 'Ranking');
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
