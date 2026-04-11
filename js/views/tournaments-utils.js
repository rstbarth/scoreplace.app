// Normalize format: 'Ranking' → 'Liga' (unificado em v0.2.6)
// Defined at top level so it's available immediately on script load
window._isLigaFormat = window._isLigaFormat || function(t) {
    return t && (t.format === 'Liga' || t.format === 'Ranking');
};

// ── Merge Drag-and-Drop: mesclar dois participantes (organizer, após sorteio) ─
// Dragging participant A onto participant B → replaces A's name with B's name
// in all match/draw data, then removes the duplicate participant entry.
window._mergeDragData = null;

window._mergeDragStart = function(e, name, tId) {
    window._mergeDragData = { name: name, tId: tId };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', name); } catch(ex) {}
    var card = e.target.closest('.participant-card') || e.target.closest('[draggable]');
    if (card) {
        card.style.opacity = '0.4';
        card.style.boxShadow = '0 0 15px rgba(251,191,36,0.4)';
    }
};

window._mergeDragEnd = function(e) {
    window._mergeDragData = null;
    var card = e.target.closest('.participant-card') || e.target.closest('[draggable]');
    if (card) {
        card.style.opacity = '1';
        card.style.boxShadow = '';
    }
    // Reset all cards
    document.querySelectorAll('.participant-card, [draggable="true"]').forEach(function(el) {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.opacity = '1';
    });
};

window._mergeDragEnter = function(e) {
    e.preventDefault();
    var card = e.target.closest('.participant-card') || e.target.closest('[draggable]');
    if (card) {
        card.style.outline = '2px dashed #fbbf24';
        card.style.outlineOffset = '-2px';
    }
};

window._mergeDragLeave = function(e) {
    var card = e.target.closest('.participant-card') || e.target.closest('[draggable]');
    if (card) {
        card.style.outline = '';
        card.style.outlineOffset = '';
    }
};

window._mergeDrop = function(e, targetName, tId) {
    e.preventDefault();
    e.stopPropagation();
    var card = e.target.closest('.participant-card') || e.target.closest('[draggable]');
    if (card) { card.style.outline = ''; card.style.outlineOffset = ''; }

    if (!window._mergeDragData) return;
    var sourceName = window._mergeDragData.name;
    window._mergeDragData = null;

    // Unescape names
    sourceName = sourceName.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    targetName = targetName.replace(/\\'/g, "'").replace(/\\\\/g, "\\");

    if (sourceName === targetName) return;
    if (!tId) return;

    var t = null;
    if (window.AppStore && Array.isArray(window.AppStore.tournaments)) {
        t = window.AppStore.tournaments.find(function(x) { return x.id === tId; });
    }
    if (!t) return;

    // Determine which name is "in the draw" (exists in matches) vs the "phantom" (only in participants)
    var _nameInDraw = function(nm) {
        var found = false;
        var _check = function(m) {
            if (!m) return;
            if (m.p1 && m.p1.indexOf(nm) !== -1) found = true;
            if (m.p2 && m.p2.indexOf(nm) !== -1) found = true;
            if (m.winner && m.winner.indexOf(nm) !== -1) found = true;
        };
        if (Array.isArray(t.matches)) t.matches.forEach(_check);
        if (Array.isArray(t.rounds)) t.rounds.forEach(function(r) { if (r && Array.isArray(r.matches)) r.matches.forEach(_check); });
        if (Array.isArray(t.groups)) t.groups.forEach(function(g) {
            if (!g) return;
            if (Array.isArray(g.matches)) g.matches.forEach(_check);
            if (Array.isArray(g.rounds)) g.rounds.forEach(function(gr) { if (Array.isArray(gr)) gr.forEach(_check); else if (gr && Array.isArray(gr.matches)) gr.matches.forEach(_check); });
        });
        return found;
    };

    var sourceInDraw = _nameInDraw(sourceName);
    var targetInDraw = _nameInDraw(targetName);

    // The name in the draw is the "old" name, the other is the "new" name
    // If both are in draw, the drop target is the one to keep
    var oldName, newName;
    if (sourceInDraw && !targetInDraw) {
        oldName = sourceName; newName = targetName;
    } else if (!sourceInDraw && targetInDraw) {
        oldName = targetName; newName = sourceName;
    } else {
        // Both or neither in draw — the DROP TARGET name is kept (dragged is replaced)
        oldName = sourceName; newName = targetName;
    }

    var msg = 'Mesclar participantes?\n\n"' + oldName + '" será substituído por "' + newName + '" em todas as partidas, times e classificações.\n\nEsta ação não pode ser desfeita.';

    if (typeof showConfirmDialog === 'function') {
        showConfirmDialog('🔗 Mesclar Participantes', msg, function() {
            // Execute merge
            if (typeof window._propagateNameChange === 'function') {
                window._propagateNameChange(oldName, newName);
            }
            // Remove the phantom duplicate from participants
            var parts = Array.isArray(t.participants) ? t.participants : [];
            // After propagation, both entries now have newName — remove the standalone duplicate
            // Keep the one that's in a team string, remove the standalone object
            var _removeIdx = -1;
            for (var i = parts.length - 1; i >= 0; i--) {
                var pi = parts[i];
                if (typeof pi === 'object' && pi) {
                    var nm = pi.displayName || pi.name || '';
                    if (nm === newName) {
                        // Check if this name also exists in a team string
                        var inTeam = parts.some(function(p2) {
                            return typeof p2 === 'string' && p2.indexOf(newName) !== -1 && p2.indexOf(' / ') !== -1;
                        });
                        if (inTeam) { _removeIdx = i; break; }
                    }
                }
            }
            if (_removeIdx !== -1) {
                parts.splice(_removeIdx, 1);
                console.log('[MergeDrop] Removed duplicate object at index ' + _removeIdx);
            }

            // Save and refresh
            t.updatedAt = new Date().toISOString();
            if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
                window.FirestoreDB.saveTournament(t).catch(function(e) { console.warn('[MergeDrop] Save error:', e); });
            }
            window.AppStore.logAction(tId, 'Participantes mesclados: "' + oldName + '" → "' + newName + '"');
            if (typeof showNotification === 'function') {
                showNotification('Participantes Mesclados', '"' + oldName + '" → "' + newName + '"', 'success');
            }
            // Re-render
            setTimeout(function() {
                if (typeof window._softRefreshView === 'function') window._softRefreshView();
                else if (typeof renderTournaments === 'function') {
                    var c = document.getElementById('view-container');
                    if (c) renderTournaments(c, tId);
                }
            }, 300);
        });
    }
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
// Detects phantom participant objects (name not in any team string or match)
// and pairs them with team string members that have no corresponding object.
// Example: Object "Ciça Mange" + String "C M / Michelle" → "C M" is old name of "Ciça Mange"
// Returns number of fixes applied.
window._fixOrphanedMatchNames = function(t) {
    if (!t) return 0;
    var parts = Array.isArray(t.participants) ? t.participants : [];
    if (parts.length === 0) return 0;

    // 1. Separate participant OBJECT names from team STRING member names
    var objectNames = {};  // names from participant objects
    var stringMemberNames = {};  // individual names extracted from team strings
    var objectByEmail = {}; // email → object name

    parts.forEach(function(p) {
        if (typeof p === 'string') {
            if (p.indexOf(' / ') !== -1) {
                p.split(' / ').forEach(function(n) { var nm = n.trim(); if (nm) stringMemberNames[nm] = true; });
            } else {
                stringMemberNames[p] = true;
            }
        } else if (typeof p === 'object' && p) {
            var nm = p.displayName || p.name || '';
            if (nm) {
                objectNames[nm] = true;
                if (p.email) objectByEmail[p.email] = nm;
            }
        }
    });

    // 2. Find phantom objects: object names NOT in any team string
    var phantoms = []; // participant objects whose names don't appear in team strings or matches
    var allStringNames = Object.keys(stringMemberNames);

    Object.keys(objectNames).forEach(function(objName) {
        if (!stringMemberNames[objName]) {
            phantoms.push(objName);
        }
    });

    if (phantoms.length === 0) return 0;

    // 3. Find unaccounted team members: team string names that have no participant object
    var unaccounted = [];
    allStringNames.forEach(function(strName) {
        if (!objectNames[strName]) {
            unaccounted.push(strName);
        }
    });

    if (unaccounted.length === 0) return 0;
    console.log('[FixOrphans] Phantom objects (not in draw):', phantoms, 'Unaccounted team members:', unaccounted);

    // 4. Try to pair phantoms with unaccounted names
    var fixes = [];

    // Strategy A: if exactly 1 phantom and 1 unaccounted → same person
    if (phantoms.length === 1 && unaccounted.length === 1) {
        fixes.push({ oldName: unaccounted[0], newName: phantoms[0] });
    } else {
        // Strategy B: initials matching — "C M" could be initials of "Ciça Mange"
        var _usedPhantoms = {};
        var _usedUnaccounted = {};
        phantoms.forEach(function(phantom) {
            if (_usedPhantoms[phantom]) return;
            var phantomParts = phantom.split(/\s+/).filter(function(w) { return w.length > 0; });
            if (phantomParts.length < 2) return; // need at least 2 words to match initials

            unaccounted.forEach(function(uName) {
                if (_usedUnaccounted[uName] || _usedPhantoms[phantom]) return;
                // Check if uName could be initials of phantom
                var uParts = uName.split(/\s+/).filter(function(w) { return w.length > 0; });
                if (uParts.length !== phantomParts.length) return; // must have same number of parts
                var allMatch = true;
                for (var i = 0; i < uParts.length; i++) {
                    // Each part of uName should be 1-2 chars and match the first char of phantom part (case-insensitive, accent-insensitive)
                    var uPart = uParts[i].replace(/[.]/g, '');
                    if (uPart.length > 3) { allMatch = false; break; } // not an initial
                    var pFirstChar = phantomParts[i].charAt(0).toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    var uFirstChar = uPart.charAt(0).toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (pFirstChar !== uFirstChar) { allMatch = false; break; }
                }
                if (allMatch) {
                    console.log('[FixOrphans] Initials match: "' + uName + '" → "' + phantom + '"');
                    fixes.push({ oldName: uName, newName: phantom });
                    _usedPhantoms[phantom] = true;
                    _usedUnaccounted[uName] = true;
                }
            });
        });
    }

    if (fixes.length === 0) {
        // Strategy C: show organizer notification for manual fix
        if (typeof window.AppStore !== 'undefined' && window.AppStore.currentUser) {
            var isOrg = typeof window.AppStore.isOrganizer === 'function' && window.AppStore.isOrganizer(t);
            if (isOrg && phantoms.length > 0 && unaccounted.length > 0) {
                // Show a banner/notification the organizer can act on
                phantoms.forEach(function(phantom) {
                    var msg = '"' + phantom + '" está inscrito(a) mas não aparece nas partidas.';
                    if (unaccounted.length <= 3) {
                        msg += ' Pode ser: ' + unaccounted.map(function(u) { return '"' + u + '"'; }).join(', ') + '.';
                        msg += ' Use a edição inline (clique no nome) para corrigir.';
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('⚠️ Participante sem partida', msg, 'warning', 10000);
                    }
                });
            }
        }
        return 0;
    }

    // 5. Apply fixes using _propagateNameChange
    console.log('[FixOrphans] Applying ' + fixes.length + ' fix(es):', fixes.map(function(f) { return '"' + f.oldName + '" → "' + f.newName + '"'; }));
    var fixCount = 0;
    fixes.forEach(function(f) {
        if (typeof window._propagateNameChange === 'function') {
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

    // Also remove the duplicate object participant (the phantom) after propagation
    // because the team string now has the correct name
    if (fixCount > 0) {
        fixes.forEach(function(f) {
            // Remove the object participant — their name is now in the team string
            for (var i = parts.length - 1; i >= 0; i--) {
                var p = parts[i];
                if (typeof p === 'object' && p) {
                    var nm = p.displayName || p.name || '';
                    if (nm === f.newName) {
                        // Check if their name now exists in a team string (after propagation)
                        var inTeam = parts.some(function(p2) {
                            return typeof p2 === 'string' && p2.indexOf(f.newName) !== -1 && p2.indexOf(' / ') !== -1;
                        });
                        if (inTeam) {
                            parts.splice(i, 1);
                            console.log('[FixOrphans] Removed duplicate object "' + nm + '" (now in team string)');
                        }
                    }
                }
            }
        });

        if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
            t.updatedAt = new Date().toISOString();
            window.FirestoreDB.saveTournament(t).catch(function(e) { console.warn('[FixOrphans] Save error:', e); });
        }
        if (typeof showNotification === 'function') {
            showNotification('Nomes Corrigidos', fixes.map(function(f) { return '"' + f.oldName + '" → "' + f.newName + '"'; }).join(', '), 'info');
        }
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
