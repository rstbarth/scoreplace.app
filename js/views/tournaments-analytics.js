// ── Analytics & Details Functions ──

// Resolve a photoURL for a player name by checking currentUser and friends,
// plus looking through any matchHistory player records that carry photoURL.
window._resolvePlayerPhoto = function(playerName, opts) {
    opts = opts || {};
    var n = String(playerName || '').toLowerCase().trim();
    if (!n) return null;
    var cu = window.AppStore && window.AppStore.currentUser;
    var _eq = function(a, b) { return String(a || '').toLowerCase().trim() === String(b || '').toLowerCase().trim(); };
    if (cu && (_eq(cu.displayName, playerName) || (cu.displayName && _eq(cu.displayName.split(' ')[0], playerName)))) {
        if (cu.photoURL) return cu.photoURL;
    }
    var friends = (window.AppStore && Array.isArray(window.AppStore.friends)) ? window.AppStore.friends : [];
    for (var i = 0; i < friends.length; i++) {
        if (_eq(friends[i].displayName, playerName) && friends[i].photoURL) return friends[i].photoURL;
    }
    if (Array.isArray(opts.records)) {
        for (var r = 0; r < opts.records.length; r++) {
            var ps = opts.records[r].players || [];
            for (var j = 0; j < ps.length; j++) {
                if (_eq(ps[j].name, playerName) && ps[j].photoURL) return ps[j].photoURL;
            }
        }
    }
    return null;
};

// Resolve a uid for a player name. Used to load persistent matchHistory.
window._resolvePlayerUid = function(playerName) {
    var n = String(playerName || '').toLowerCase().trim();
    if (!n) return null;
    var cu = window.AppStore && window.AppStore.currentUser;
    var _eq = function(a, b) { return String(a || '').toLowerCase().trim() === String(b || '').toLowerCase().trim(); };
    if (cu && cu.uid && (_eq(cu.displayName, playerName) || (cu.displayName && _eq(cu.displayName.split(' ')[0], playerName)))) return cu.uid;
    var friends = (window.AppStore && Array.isArray(window.AppStore.friends)) ? window.AppStore.friends : [];
    for (var i = 0; i < friends.length; i++) {
        if (_eq(friends[i].displayName, playerName) && friends[i].uid) return friends[i].uid;
    }
    // Fallback: search through tournament participants for a uid match
    var ts = (window.AppStore && Array.isArray(window.AppStore.tournaments)) ? window.AppStore.tournaments : [];
    for (var t = 0; t < ts.length; t++) {
        var ps = Array.isArray(ts[t].participants) ? ts[t].participants : [];
        for (var pi = 0; pi < ps.length; pi++) {
            var p = ps[pi];
            if (p && typeof p === 'object' && p.uid && _eq(p.displayName || p.name, playerName)) return p.uid;
        }
    }
    return null;
};

// Shared visual helpers — mirror the casual-match end-of-match cards (bracket-ui.js).
function _boxStat(label, value, icon, accent) {
    accent = accent || 'var(--text-bright,#fff)';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);">' +
      '<span style="font-size:1rem;">' + icon + '</span>' +
      '<span style="font-size:1.15rem;font-weight:900;color:' + accent + ';font-variant-numeric:tabular-nums;line-height:1;">' + value + '</span>' +
      '<span style="font-size:0.55rem;font-weight:700;color:var(--text-muted,#94a3b8);text-transform:uppercase;letter-spacing:0.5px;text-align:center;">' + label + '</span>' +
    '</div>';
}

function _sectionShell(id, title, icon, accent, badge) {
    return '<div id="' + id + '" style="margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid ' + accent + '44;display:flex;flex-direction:column;gap:8px;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:1rem;">' + icon + '</span>' +
        '<span style="font-size:0.85rem;font-weight:900;color:' + accent + ';text-transform:uppercase;letter-spacing:0.8px;">' + title + '</span>' +
        '<span style="margin-left:auto;font-size:0.62rem;color:var(--text-muted,#94a3b8);font-weight:700;">' + badge + '</span>' +
      '</div>';
}

// Show Player Stats Modal — consolidated stats across all tournaments + persistent
// matchHistory (casual + tournament) so records survive deletion of the source.
window._showPlayerStats = function(playerName, currentTournamentId) {
    if (!playerName) return;
    var safeN = window._safeHtml(playerName);
    var tournaments = window.AppStore.tournaments || [];
    var stats = {
        tournamentsPlayed: 0,
        tournamentNames: [],
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalMatches: 0,
        titles: 0,      // 1st place finishes
        podiums: 0,      // top 3 finishes
        sports: {},
        formats: {}
    };

    // Helper: check if a player name matches (case-insensitive, partial)
    var _nameMatch = function(a, b) {
        if (!a || !b) return false;
        return a.toLowerCase().trim() === b.toLowerCase().trim();
    };

    // Helper: extract all matches from a tournament
    var _getAllMatches = function(t) {
        var all = [];
        if (Array.isArray(t.matches)) all = all.concat(t.matches);
        if (Array.isArray(t.rounds)) {
            t.rounds.forEach(function(r) {
                if (Array.isArray(r.matches)) all = all.concat(r.matches);
            });
        }
        if (Array.isArray(t.groups)) {
            t.groups.forEach(function(g) {
                if (Array.isArray(g.matches)) all = all.concat(g.matches);
            });
        }
        if (Array.isArray(t.rodadas)) {
            t.rodadas.forEach(function(rd) {
                if (Array.isArray(rd.matches)) all = all.concat(rd.matches);
                if (Array.isArray(rd.jogos)) all = all.concat(rd.jogos);
            });
        }
        if (t.thirdPlaceMatch) all.push(t.thirdPlaceMatch);
        return all;
    };

    tournaments.forEach(function(t) {
        // Check if player is a participant
        var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
        var isParticipant = pList.some(function(p) {
            var name = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
            return _nameMatch(name, playerName);
        });
        if (!isParticipant) return;

        stats.tournamentsPlayed++;
        stats.tournamentNames.push({ name: t.name, id: t.id, sport: t.sport || '', format: t.format || '' });

        // Track sports and formats
        if (t.sport) stats.sports[t.sport] = (stats.sports[t.sport] || 0) + 1;
        if (t.format) stats.formats[t.format] = (stats.formats[t.format] || 0) + 1;

        // Check standings for position (Liga/Suíço)
        if (typeof window._computeStandings === 'function' && (window._isLigaFormat(t) || t.format === 'Suíço Clássico' || t.classifyFormat === 'swiss')) {
            var computed = window._computeStandings(t);
            for (var si = 0; si < computed.length; si++) {
                if (_nameMatch(computed[si].name, playerName)) {
                    stats.totalWins += computed[si].wins || 0;
                    stats.totalLosses += computed[si].losses || 0;
                    stats.totalDraws += computed[si].draws || 0;
                    stats.totalMatches += computed[si].played || 0;
                    if (si === 0 && (t.status === 'finished' || t.status === 'closed')) stats.titles++;
                    if (si < 3 && (t.status === 'finished' || t.status === 'closed')) stats.podiums++;
                    break;
                }
            }
        } else {
            // Elimination format — count from matches
            var matches = _getAllMatches(t);
            matches.forEach(function(m) {
                var p1 = m.p1 || m.player1 || '';
                var p2 = m.p2 || m.player2 || '';
                var winner = m.winner || '';
                var isP1 = _nameMatch(p1, playerName);
                var isP2 = _nameMatch(p2, playerName);
                if (!isP1 && !isP2) return;
                if (!winner && m.score1 === undefined) return; // unplayed
                stats.totalMatches++;
                if (_nameMatch(winner, playerName)) {
                    stats.totalWins++;
                } else if (winner && !_nameMatch(winner, playerName)) {
                    stats.totalLosses++;
                } else if (m.score1 !== undefined && m.score1 === m.score2) {
                    stats.totalDraws++;
                }
            });
            // Check if champion (last match winner in single elimination)
            if ((t.status === 'finished' || t.status === 'closed') && Array.isArray(t.matches) && t.matches.length > 0) {
                var finalMatch = t.matches[t.matches.length - 1];
                if (finalMatch && _nameMatch(finalMatch.winner, playerName)) {
                    stats.titles++;
                    stats.podiums++;
                } else if (finalMatch && ((_nameMatch(finalMatch.p1, playerName) || _nameMatch(finalMatch.p2, playerName)))) {
                    stats.podiums++; // runner-up
                }
            }
        }
    });

    // Calculate win rate
    var winRate = stats.totalMatches > 0 ? Math.round((stats.totalWins / stats.totalMatches) * 100) : 0;
    var sportsStr = Object.keys(stats.sports).map(function(s) { return s + ' (' + stats.sports[s] + ')'; }).join(', ') || 'N/A';

    // Remove previous modal
    var prev = document.getElementById('player-stats-overlay');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'player-stats-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--card-bg,#1e2235);border-radius:20px;padding:2rem;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;max-height:85vh;overflow-y:auto;';

    // Build tournament list HTML
    var tourListHtml = stats.tournamentNames.map(function(tn) {
        return '<a href="#tournaments/' + tn.id + '" onclick="document.getElementById(\'player-stats-overlay\').remove()" style="display:block;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.05);margin-bottom:4px;text-decoration:none;color:var(--text-bright,#fff);font-size:0.8rem;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">' +
          '<span style="font-weight:600;">' + window._safeHtml(tn.name) + '</span>' +
          '<span style="color:var(--text-muted,#94a3b8);margin-left:8px;font-size:0.7rem;">' + window._safeHtml(tn.sport) + ' • ' + window._safeHtml(tn.format) + '</span>' +
        '</a>';
    }).join('');

    // Resolve photo + uid (for persistent match history lookup)
    var resolvedPhoto = window._resolvePlayerPhoto(playerName);
    var resolvedUid = window._resolvePlayerUid(playerName);
    var _initialChar = (playerName.charAt(0) || '?').toUpperCase();
    var avatarHtml = resolvedPhoto
      ? '<img src="' + window._safeHtml(resolvedPhoto) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--primary-color,#3b82f6);margin-bottom:0.5rem;display:inline-block;" onerror="this.outerHTML=\'<div style=\\\'width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:#1a1e2e;margin-bottom:0.5rem;\\\'>' + _initialChar + '</div>\'">'
      : '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:#1a1e2e;margin-bottom:0.5rem;">' + _initialChar + '</div>';

    modal.innerHTML = '' +
      '<button onclick="document.getElementById(\'player-stats-overlay\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--text-muted,#94a3b8);font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>' +
      '<div style="text-align:center;margin-bottom:1rem;">' +
        avatarHtml +
        '<h3 style="margin:0;font-size:1.3rem;color:var(--text-bright,#fff);">' + safeN + '</h3>' +
      '</div>' +
      // Main body: persistent matchHistory stats (primary) or legacy fallback
      '<div id="player-stats-persistent">' +
        (resolvedUid
          ? '<div style="padding:24px;text-align:center;font-size:0.8rem;color:var(--text-muted,#94a3b8);">⏳ Carregando estatísticas…</div>'
          : _buildLegacyStatsHtml(stats, sportsStr, winRate, tourListHtml)) +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Helpers to build legacy AppStore-based stats (fallback when uid unknown or matchHistory empty)
    function _buildLegacyStatsHtml(s, sp, wr, tList) {
        // Read localStorage casual history — only meaningful when viewing current user's stats
        var cStats = { matches:0, wins:0, losses:0, draws:0 };
        try {
            var cu = window.AppStore && window.AppStore.currentUser;
            var isCurrentUser = cu && cu.displayName && String(cu.displayName).toLowerCase().trim() === String(playerName).toLowerCase().trim();
            if (isCurrentUser) {
                var casualHist = JSON.parse(localStorage.getItem('scoreplace_casual_history') || '[]');
                cStats.matches = casualHist.length;
                var dn = (cu.displayName || '').toLowerCase();
                for (var ci = 0; ci < casualHist.length; ci++) {
                    var ch = casualHist[ci];
                    if (ch.winner === 'Empate') cStats.draws++;
                    else if (ch.winner && String(ch.winner).toLowerCase() === dn) cStats.wins++;
                    else if (ch.winner) cStats.losses++;
                }
            }
        } catch(e) {}

        var html = '<p style="text-align:center;font-size:0.7rem;color:var(--text-muted,#94a3b8);margin:0 0 8px;">' + window._safeHtml(sp) + '</p>';

        // Empty state
        if (!cStats.matches && !s.tournamentsPlayed) {
            html += '<div style="text-align:center;padding:16px 10px;color:var(--text-muted,#94a3b8);font-size:0.85rem;line-height:1.5;">' +
              '🎯 Nenhuma partida registrada ainda.<br>' +
              '<span style="font-size:0.72rem;">Jogue uma partida casual ou participe de um torneio para ver suas estatísticas.</span>' +
            '</div>';
            return html;
        }

        // Casual section (localStorage, current user only)
        if (cStats.matches > 0) {
            var cRate = cStats.matches > 0 ? Math.round(cStats.wins / cStats.matches * 100) : 0;
            var cClr = cRate >= 60 ? '#22c55e' : (cRate >= 40 ? '#fbbf24' : '#ef4444');
            var cBadge = cStats.matches + ' ' + (cStats.matches > 1 ? 'partidas' : 'partida');
            html += _sectionShell('legacy-stats-casual', 'Partidas Casuais', '📡', '#38bdf8', cBadge) +
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
                    _boxStat('Vitórias', cStats.wins, '✅', '#22c55e') +
                    _boxStat('Derrotas' + (cStats.draws ? '/E' : ''), cStats.losses + (cStats.draws ? '/' + cStats.draws : ''), '❌', '#ef4444') +
                    _boxStat('Aproveit.', cRate + '%', '📊', cClr) +
                '</div>' +
            '</div>';
        }

        // Tournaments section
        if (s.tournamentsPlayed > 0) {
            var tRate = wr;
            var tClr = tRate >= 60 ? '#22c55e' : (tRate >= 40 ? '#fbbf24' : '#ef4444');
            var tBadge = s.tournamentsPlayed + ' ' + (s.tournamentsPlayed > 1 ? 'torneios' : 'torneio');
            html += _sectionShell('legacy-stats-tournament', 'Torneios', '🏆', '#fbbf24', tBadge);
            if (s.totalMatches > 0) {
                html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
                    _boxStat('Vitórias', s.totalWins, '✅', '#22c55e') +
                    _boxStat('Derrotas' + (s.totalDraws ? '/E' : ''), s.totalLosses + (s.totalDraws ? '/' + s.totalDraws : ''), '❌', '#ef4444') +
                    _boxStat('Aproveit.', tRate + '%', '📊', tClr) +
                '</div>';
            }
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">' +
                _boxStat('Títulos', s.titles, '👑', '#fbbf24') +
                _boxStat('Partidas', s.totalMatches, '🎯', '#a855f7') +
            '</div>' +
            '</div>';

            html += '<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:0.78rem;font-weight:600;color:var(--text-bright,#fff);padding:6px 0;">📋 Torneios Disputados (' + s.tournamentsPlayed + ')</summary><div style="margin-top:6px;">' + tList + '</div></details>';
        }

        return html;
    }

    // Load persistent per-user matchHistory — primary data source, survives deletion
    if (resolvedUid && window.FirestoreDB && typeof window.FirestoreDB.loadUserMatchHistory === 'function') {
        var slot = modal.querySelector('#player-stats-persistent');
        window.FirestoreDB.loadUserMatchHistory(resolvedUid).then(function(records) {
            if (!slot) return;
            if (!records || !records.length) {
                // Fall back to AppStore legacy stats if matchHistory empty
                slot.innerHTML = _buildLegacyStatsHtml(stats, sportsStr, winRate, tourListHtml);
                return;
            }
            slot.innerHTML = window._renderPersistentMatchStats(records, resolvedUid);
        }).catch(function(e) {
            console.warn('[player-stats] loadUserMatchHistory failed', e);
            if (slot) slot.innerHTML = _buildLegacyStatsHtml(stats, sportsStr, winRate, tourListHtml);
        });
    }

    // ESC to close
    var _escH = function(e) {
        if (e.key === 'Escape') {
            var el = document.getElementById('player-stats-overlay');
            if (el) el.remove();
            document.removeEventListener('keydown', _escH);
        }
    };
    document.addEventListener('keydown', _escH);
};

// Build Activity Log for a tournament (derived from tournament data, no extra DB)
window._buildActivityLog = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t) return;
    var container = document.getElementById('activity-log-section');
    if (!container) return;

    var events = [];

    // 1. Tournament created
    if (t.createdAt) {
        events.push({ date: t.createdAt, icon: '🏁', text: 'Torneio criado', color: '#60a5fa' });
    }

    // 2. Participants enrolled (use enrolledAt if available, or createdAt)
    var pList = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
    pList.forEach(function(p) {
        var name = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '?');
        var pDate = (typeof p === 'object' && p.enrolledAt) ? p.enrolledAt : null;
        if (name && name !== 'BYE') {
            events.push({ date: pDate || t.createdAt, icon: '👤', text: '<b>' + window._safeHtml(name) + '</b> se inscreveu', color: '#4ade80' });
        }
    });

    // 3. Registration closed
    if (t.status === 'closed' || t.status === 'active' || t.status === 'finished') {
        if (t.registrationClosedAt) {
            events.push({ date: t.registrationClosedAt, icon: '🔒', text: 'Inscrições encerradas', color: '#f59e0b' });
        }
    }

    // 4. Draw done
    var hasDrawContent = (t.matches && t.matches.length > 0) || (t.rounds && t.rounds.length > 0) || (t.groups && t.groups.length > 0);
    if (hasDrawContent) {
        var drawDate = t.drawDate || t.tournamentStartedAt || null;
        events.push({ date: drawDate, icon: '🎲', text: 'Sorteio realizado', color: '#a78bfa' });
    }

    // 5. Tournament started
    if (t.tournamentStarted || t.tournamentStartedAt) {
        events.push({ date: t.tournamentStartedAt || null, icon: '▶️', text: 'Torneio iniciado', color: '#10b981' });
    }

    // 6. Match results
    var allMatches = [];
    if (Array.isArray(t.matches)) {
        t.matches.forEach(function(m, idx) { allMatches.push({ m: m, label: m.round ? 'Rodada ' + m.round : 'Partida ' + (idx+1) }); });
    }
    if (Array.isArray(t.rounds)) {
        t.rounds.forEach(function(r, ri) {
            (r.matches || []).forEach(function(m) { allMatches.push({ m: m, label: 'Rodada ' + (ri+1) }); });
        });
    }
    if (Array.isArray(t.groups)) {
        t.groups.forEach(function(g, gi) {
            (g.matches || []).forEach(function(m) { allMatches.push({ m: m, label: 'Grupo ' + (gi+1) }); });
        });
    }
    if (Array.isArray(t.rodadas)) {
        t.rodadas.forEach(function(rd, ri) {
            var ms = rd.matches || rd.jogos || [];
            ms.forEach(function(m) { allMatches.push({ m: m, label: 'Rodada ' + (ri+1) }); });
        });
    }
    if (t.thirdPlaceMatch && t.thirdPlaceMatch.winner) {
        allMatches.push({ m: t.thirdPlaceMatch, label: 'Disputa 3º lugar' });
    }

    allMatches.forEach(function(item) {
        var m = item.m;
        if (!m.winner && (m.score1 === undefined || m.score1 === null)) return;
        var p1 = m.p1 || m.player1 || '?';
        var p2 = m.p2 || m.player2 || '?';
        if (p1 === 'BYE' || p2 === 'BYE' || p1 === 'TBD' || p2 === 'TBD') return;
        var score = '';
        if (m.scoreP1 !== undefined && m.scoreP1 !== null) score = m.scoreP1 + ' × ' + (m.scoreP2 || 0);
        else if (m.score1 !== undefined && m.score1 !== null) score = m.score1 + ' × ' + (m.score2 || 0);
        var winner = m.winner || '';
        var txt = '<b>' + window._safeHtml(p1) + '</b> vs <b>' + window._safeHtml(p2) + '</b>';
        if (score) txt += ' — ' + score;
        if (winner) txt += ' → <span style="color:#4ade80;">' + window._safeHtml(winner) + '</span>';
        txt += ' <span style="opacity:0.5;">(' + item.label + ')</span>';
        events.push({ date: m.updatedAt || m.resultAt || null, icon: '⚔️', text: txt, color: '#94a3b8' });
    });

    // 7. Tournament finished
    if (t.status === 'finished' || t.status === 'closed') {
        var finDate = t.finishedAt || t.closedAt || null;
        if (hasDrawContent) {
            events.push({ date: finDate, icon: '🏆', text: 'Torneio encerrado', color: '#fbbf24' });
        }
    }

    // Sort by date (known dates first, then unknown)
    events.sort(function(a, b) {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
    });

    if (events.length === 0) return;

    // Limit display to latest 20 by default, expandable
    var maxShow = 15;
    var hasMore = events.length > maxShow;
    var displayEvents = hasMore ? events.slice(events.length - maxShow) : events;

    var timelineHtml = displayEvents.map(function(ev) {
        var dateStr = '';
        if (ev.date) {
            try {
                var d = new Date(ev.date);
                dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                var timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                if (timeStr !== '00:00') dateStr += ' ' + timeStr;
            } catch(e) {}
        }
        return '<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
            '<div style="font-size:1.1rem;flex-shrink:0;width:28px;text-align:center;">' + ev.icon + '</div>' +
            '<div style="flex:1;font-size:0.82rem;color:var(--text-bright,#fff);line-height:1.4;">' + ev.text + '</div>' +
            (dateStr ? '<div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);white-space:nowrap;flex-shrink:0;">' + dateStr + '</div>' : '') +
          '</div>';
    }).join('');

    var allEventsHtml = '';
    if (hasMore) {
        allEventsHtml = events.slice(0, events.length - maxShow).map(function(ev) {
            var dateStr = '';
            if (ev.date) {
                try { var d = new Date(ev.date); dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); } catch(e) {}
            }
            return '<div style="display:flex;gap:12px;align-items:flex-start;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
                '<div style="font-size:1rem;flex-shrink:0;width:28px;text-align:center;">' + ev.icon + '</div>' +
                '<div style="flex:1;font-size:0.78rem;color:var(--text-muted,#94a3b8);line-height:1.4;">' + ev.text + '</div>' +
                (dateStr ? '<div style="font-size:0.65rem;color:var(--text-muted,#64748b);white-space:nowrap;flex-shrink:0;">' + dateStr + '</div>' : '') +
              '</div>';
        }).join('');
    }

    container.innerHTML = '<div class="mt-5">' +
      '<details>' +
        '<summary style="cursor:pointer;font-size:1.1rem;font-weight:700;color:var(--text-bright,#fff);padding:12px 0;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-color,rgba(255,255,255,0.1));">' +
          '📜 Histórico de Atividades <span style="font-size:0.75rem;font-weight:400;color:var(--text-muted,#94a3b8);">(' + events.length + ' eventos)</span>' +
        '</summary>' +
        '<div style="padding:8px 0;">' +
          (hasMore ? '<details style="margin-bottom:8px;"><summary style="cursor:pointer;font-size:0.75rem;color:var(--text-muted,#64748b);padding:4px 0;">Ver ' + (events.length - maxShow) + ' eventos anteriores...</summary><div>' + allEventsHtml + '</div></details>' : '') +
          timelineHtml +
        '</div>' +
      '</details>' +
    '</div>';
};

// Renders the persistent matchHistory block for a given uid's records.
// Splits casual vs tournament, aggregates serve/receive/killer/breaks/streaks,
// and produces head-to-head + partnership tables. Records are written per-player
// to users/{uid}/matchHistory so they survive tournament/casual deletion.
window._renderPersistentMatchStats = function(records, uid) {
    var _safe = window._safeHtml || function(s) { return String(s == null ? '' : s); };
    var casual = [], tournament = [];
    for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.matchType === 'casual') casual.push(r);
        else if (r.matchType === 'tournament') tournament.push(r);
    }

    function _aggregate(recs) {
        var agg = { matches:0, wins:0, losses:0, draws:0,
            points:0, games:0, sets:0, breaks:0, killerPoints:0,
            servePts:0, servePtsWon:0, receivePts:0, receivePtsWon:0,
            holdsServed:0, holdsWon:0, longestStreak:0, biggestLead:0,
            totalDurationMs: 0, durationMatches: 0, avgPointMsSum: 0, avgPointMatches: 0 };
        for (var i = 0; i < recs.length; i++) {
            var r = recs[i];
            var mySlot = (r.players || []).find(function(p) { return p.uid === uid; });
            if (!mySlot) continue;
            var myTeam = mySlot.team;
            agg.matches++;
            var w = r.winnerTeam;
            if (w === 0) agg.draws++;
            else if (w === myTeam) agg.wins++;
            else agg.losses++;
            var mine = r.stats && (myTeam === 1 ? r.stats.team1 : r.stats.team2);
            if (mine) {
                agg.points += mine.points || 0;
                agg.games += mine.games || 0;
                agg.sets += mine.sets || 0;
                agg.breaks += mine.breaks || 0;
                agg.killerPoints += mine.deucePtsWon || 0;
                agg.servePts += mine.servePtsPlayed || 0;
                agg.servePtsWon += mine.servePtsWon || 0;
                agg.receivePts += mine.receivePtsPlayed || 0;
                agg.receivePtsWon += mine.receivePtsWon || 0;
                agg.holdsServed += mine.holdServed || 0;
                agg.holdsWon += mine.held || 0;
                if ((mine.longestStreak || 0) > agg.longestStreak) agg.longestStreak = mine.longestStreak;
                if ((mine.biggestLead || 0) > agg.biggestLead) agg.biggestLead = mine.biggestLead;
            }
            if (typeof r.durationMs === 'number' && r.durationMs > 0) {
                agg.totalDurationMs += r.durationMs; agg.durationMatches++;
            }
            if (r.timeStats && typeof r.timeStats.avgPointMs === 'number') {
                agg.avgPointMsSum += r.timeStats.avgPointMs; agg.avgPointMatches++;
            }
        }
        return agg;
    }

    function _computeH2hAndPartners(recs) {
        var h2h = {}, partners = {};
        for (var i = 0; i < recs.length; i++) {
            var r = recs[i];
            var ps = r.players || [];
            var me = ps.find(function(p) { return p.uid === uid; });
            if (!me) continue;
            var myTeam = me.team, w = r.winnerTeam;
            var didWin = w === myTeam, didDraw = w === 0;
            for (var j = 0; j < ps.length; j++) {
                var pj = ps[j];
                if (pj === me || pj.name === me.name) continue;
                var key = pj.uid || ('name:' + (pj.name || ''));
                var map = pj.team === myTeam ? partners : h2h;
                if (!map[key]) map[key] = { name: pj.name, uid: pj.uid || null, photoURL: pj.photoURL || null, played:0, wins:0, losses:0, draws:0 };
                map[key].played++;
                if (didDraw) map[key].draws++;
                else if (didWin) map[key].wins++;
                else map[key].losses++;
            }
        }
        return { h2h: h2h, partners: partners };
    }

    function _fmtDuration(ms) {
        if (!ms || ms <= 0) return '—';
        var mins = Math.round(ms / 60000);
        if (mins < 60) return mins + 'm';
        var h = Math.floor(mins / 60), m = mins % 60;
        return h + 'h' + (m > 0 ? (' ' + m + 'm') : '');
    }
    function _fmtPointTime(ms) {
        if (!ms || ms <= 0) return '—';
        var s = Math.round(ms / 1000);
        if (s < 60) return s + 's';
        return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    }

    function _sectionHtml(id, title, icon, recs, accent) {
        if (!recs.length) return '';
        var a = _aggregate(recs);
        var winRate = a.matches > 0 ? Math.round(a.wins / a.matches * 100) : 0;
        var rateClr = winRate >= 60 ? '#22c55e' : (winRate >= 40 ? '#fbbf24' : '#ef4444');
        var srvPct = a.servePts > 0 ? Math.round(a.servePtsWon / a.servePts * 100) : 0;
        var recvPct = a.receivePts > 0 ? Math.round(a.receivePtsWon / a.receivePts * 100) : 0;
        var avgDur = a.durationMatches > 0 ? a.totalDurationMs / a.durationMatches : 0;
        var avgPt = a.avgPointMatches > 0 ? a.avgPointMsSum / a.avgPointMatches : 0;
        var badge = a.matches + ' partida' + (a.matches > 1 ? 's' : '');

        return _sectionShell(id, title, icon, accent, badge) +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
                _boxStat('Vitórias', a.wins, '✅', '#22c55e') +
                _boxStat('Derrotas' + (a.draws ? '/E' : ''), a.losses + (a.draws ? '/' + a.draws : ''), '❌', '#ef4444') +
                _boxStat('Aproveit.', winRate + '%', '📊', rateClr) +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
                _boxStat('Sets', a.sets, '🏅', '#fbbf24') +
                _boxStat('Games', a.games, '🎾', '#60a5fa') +
                _boxStat('Pontos', a.points, '🎯', '#a855f7') +
            '</div>' +
            (a.servePts > 0 ? (
                '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">' +
                    _boxStat('Saque', srvPct + '%', '🚀', '#60a5fa') +
                    _boxStat('Recep.', recvPct + '%', '🛡', '#f87171') +
                    _boxStat('Killer', a.killerPoints, '⚡', '#fbbf24') +
                    _boxStat('Quebras', a.breaks, '💥', '#a855f7') +
                '</div>'
            ) : '') +
            (a.longestStreak > 0 || a.biggestLead > 0 ? (
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">' +
                    _boxStat('Maior Seq.', a.longestStreak, '🔥', '#fb923c') +
                    _boxStat('Maior Vant.', a.biggestLead, '📈', '#22c55e') +
                '</div>'
            ) : '') +
            ((avgDur > 0 || avgPt > 0) ? (
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">' +
                    _boxStat('Duração média', _fmtDuration(avgDur), '⏱', '#38bdf8') +
                    _boxStat('Tempo/ponto', _fmtPointTime(avgPt), '⏲', '#a78bfa') +
                '</div>'
            ) : '') +
        '</div>';
    }

    function _tableHtml(title, map) {
        var arr = Object.keys(map).map(function(k) { return map[k]; });
        if (!arr.length) return '';
        arr.sort(function(a, b) { return b.played - a.played; });
        var top = arr.slice(0, 5);
        var h = '<div style="margin-top:10px;">' +
            '<div style="font-size:0.72rem;font-weight:700;color:var(--text-muted,#94a3b8);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">' + title + '</div>';
        for (var i = 0; i < top.length; i++) {
            var e = top[i];
            var wr = e.played > 0 ? Math.round(e.wins / e.played * 100) : 0;
            var av = e.photoURL
                ? '<img src="' + _safe(e.photoURL) + '" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
                : '<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:#fff;font-weight:700;flex-shrink:0;">' + _safe(((e.name || '?')[0] || '?').toUpperCase()) + '</div>';
            h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:3px;">' +
                av +
                '<span style="flex:1;min-width:0;font-size:0.78rem;color:var(--text-color,#e5e7eb);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _safe(e.name || 'Jogador') + '</span>' +
                '<span style="font-size:0.68rem;color:#22c55e;font-weight:700;">' + e.wins + 'V</span>' +
                '<span style="font-size:0.68rem;color:#ef4444;font-weight:700;">' + e.losses + 'D</span>' +
                (e.draws ? '<span style="font-size:0.68rem;color:var(--text-muted,#94a3b8);font-weight:700;">' + e.draws + 'E</span>' : '') +
                '<span style="font-size:0.7rem;color:' + (wr >= 50 ? '#22c55e' : '#ef4444') + ';font-weight:800;min-width:36px;text-align:right;">' + wr + '%</span>' +
            '</div>';
        }
        h += '</div>';
        return h;
    }

    var casualAgg = _computeH2hAndPartners(casual);
    var tournAgg = _computeH2hAndPartners(tournament);

    return '<div style="border-top:1px solid var(--border-color,rgba(255,255,255,0.1));padding-top:10px;">' +
        '<div style="font-size:0.82rem;font-weight:700;color:var(--text-bright,#fff);margin-bottom:4px;">📊 Estatísticas Detalhadas</div>' +
        '<div style="font-size:0.65rem;color:var(--text-muted,#94a3b8);margin-bottom:6px;">Dados persistentes — preservados mesmo se o torneio ou partida casual for apagado.</div>' +
        _sectionHtml('persist-stats-casual', 'Partidas Casuais', '📡', casual, '#38bdf8') +
        _sectionHtml('persist-stats-tournament', 'Torneios', '🏆', tournament, '#fbbf24') +
        (Object.keys(casualAgg.h2h).length + Object.keys(tournAgg.h2h).length + Object.keys(casualAgg.partners).length + Object.keys(tournAgg.partners).length > 0
            ? '<div style="margin-top:14px;">' +
                _tableHtml('⚔ Confrontos diretos (casuais)', casualAgg.h2h) +
                _tableHtml('⚔ Confrontos diretos (torneios)', tournAgg.h2h) +
                _tableHtml('🤝 Parcerias (casuais)', casualAgg.partners) +
                _tableHtml('🤝 Parcerias (torneios)', tournAgg.partners) +
              '</div>'
            : '') +
    '</div>';
};
