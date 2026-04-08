// ── Analytics & Details Functions ──
// Show Player Stats Modal — consolidated stats across all tournaments
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
        if (typeof window._computeStandings === 'function' && (window._isLigaFormat(t) || t.format === 'Suíço Clássico')) {
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

    modal.innerHTML = '' +
      '<button onclick="document.getElementById(\'player-stats-overlay\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--text-muted,#94a3b8);font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>' +
      '<div style="text-align:center;margin-bottom:1.5rem;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:#1a1e2e;margin-bottom:0.5rem;">' + (playerName.charAt(0) || '?').toUpperCase() + '</div>' +
        '<h3 style="margin:0;font-size:1.3rem;color:var(--text-bright,#fff);">' + safeN + '</h3>' +
        '<p style="margin:4px 0 0;font-size:0.8rem;color:var(--text-muted,#94a3b8);">' + sportsStr + '</p>' +
      '</div>' +
      // Stats grid
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1.5rem;">' +
        '<div style="text-align:center;padding:12px 8px;background:rgba(59,130,246,0.1);border-radius:12px;border:1px solid rgba(59,130,246,0.2);">' +
          '<div style="font-size:1.5rem;font-weight:800;color:#60a5fa;">' + stats.tournamentsPlayed + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Torneios</div>' +
        '</div>' +
        '<div style="text-align:center;padding:12px 8px;background:rgba(16,185,129,0.1);border-radius:12px;border:1px solid rgba(16,185,129,0.2);">' +
          '<div style="font-size:1.5rem;font-weight:800;color:#4ade80;">' + stats.totalWins + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Vitórias</div>' +
        '</div>' +
        '<div style="text-align:center;padding:12px 8px;background:rgba(239,68,68,0.1);border-radius:12px;border:1px solid rgba(239,68,68,0.2);">' +
          '<div style="font-size:1.5rem;font-weight:800;color:#f87171;">' + stats.totalLosses + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Derrotas</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:1.5rem;">' +
        '<div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.05);border-radius:10px;">' +
          '<div style="font-size:1.2rem;font-weight:700;color:var(--text-bright,#fff);">' + stats.totalDraws + '</div>' +
          '<div style="font-size:0.65rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Empates</div>' +
        '</div>' +
        '<div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.05);border-radius:10px;">' +
          '<div style="font-size:1.2rem;font-weight:700;color:var(--text-bright,#fff);">' + stats.totalMatches + '</div>' +
          '<div style="font-size:0.65rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Partidas</div>' +
        '</div>' +
        '<div style="text-align:center;padding:10px 6px;background:rgba(' + (winRate >= 60 ? '16,185,129' : winRate >= 40 ? '251,191,36' : '239,68,68') + ',0.1);border-radius:10px;">' +
          '<div style="font-size:1.2rem;font-weight:700;color:' + (winRate >= 60 ? '#4ade80' : winRate >= 40 ? '#fbbf24' : '#f87171') + ';">' + winRate + '%</div>' +
          '<div style="font-size:0.65rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Aproveit.</div>' +
        '</div>' +
        '<div style="text-align:center;padding:10px 6px;background:rgba(251,191,36,0.1);border-radius:10px;">' +
          '<div style="font-size:1.2rem;font-weight:700;color:#fbbf24;">' + stats.titles + ' 🏆</div>' +
          '<div style="font-size:0.65rem;color:var(--text-muted,#94a3b8);margin-top:2px;">Títulos</div>' +
        '</div>' +
      '</div>' +
      // Tournament list
      (stats.tournamentsPlayed > 0 ? '<details style="margin-bottom:0.5rem;">' +
        '<summary style="cursor:pointer;font-size:0.85rem;font-weight:600;color:var(--text-bright,#fff);padding:8px 0;">📋 Torneios Disputados (' + stats.tournamentsPlayed + ')</summary>' +
        '<div style="margin-top:8px;">' + tourListHtml + '</div>' +
      '</details>' : '<p style="text-align:center;color:var(--text-muted,#94a3b8);font-size:0.85rem;">Nenhum torneio encontrado.</p>');

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

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
