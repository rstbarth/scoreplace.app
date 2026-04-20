// ── Bracket Logic & Computation ──
var _t = window._t || function(k) { return k; };

// ── Monarch (Rei/Rainha) individual standings per group ──
window._computeMonarchStandings = function(group) {
  var stats = {};
  (group.players || []).forEach(function(name) {
    stats[name] = { name: name, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, played: 0 };
  });

  var matches = (group.rounds && group.rounds[0]) ? group.rounds[0].matches : (group.matches || []);
  matches.forEach(function(m) {
    if (!m.winner || !m.team1 || !m.team2) return;
    var s1 = parseInt(m.scoreP1) || 0;
    var s2 = parseInt(m.scoreP2) || 0;
    var team1Won = m.winner === m.p1;

    m.team1.forEach(function(name) {
      if (!stats[name]) return;
      stats[name].played++;
      stats[name].pointsFor += s1;
      stats[name].pointsAgainst += s2;
      if (team1Won) stats[name].wins++; else stats[name].losses++;
    });
    m.team2.forEach(function(name) {
      if (!stats[name]) return;
      stats[name].played++;
      stats[name].pointsFor += s2;
      stats[name].pointsAgainst += s1;
      if (!team1Won) stats[name].wins++; else stats[name].losses++;
    });
  });

  return Object.values(stats).sort(function(a, b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    var aDiff = a.pointsFor - a.pointsAgainst;
    var bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.pointsFor - a.pointsFor;
  });
};

function _checkGroupRoundComplete(t, groupIndex) {
  if (!t.groups || !t.groups[groupIndex]) return;
  const g = t.groups[groupIndex];
  const activeRound = (g.rounds || []).find(r => r.status === 'active');
  if (!activeRound) return;
  const allDone = (activeRound.matches || []).every(m => m.winner);
  if (allDone) {
    activeRound.status = 'complete';
    // Activate next pending round
    const nextRound = (g.rounds || []).find(r => r.status === 'pending');
    if (nextRound) nextRound.status = 'active';
  }
}

window._computeStandings = _computeStandings; // expose globally for finishTournament
function _computeStandings(t, category) {
  const scoreMap = {};

  const allP = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  allP.forEach(p => {
    const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
    // If filtering by category, only include participants in that category (supports multi-cat)
    if (category) {
      if (typeof p === 'object' && window._participantInCategory) {
        if (!window._participantInCategory(p, category)) return;
      } else {
        var pCat = typeof p === 'object' ? (p.category || '') : '';
        if (pCat !== category) return;
      }
    }
    if (name && !scoreMap[name]) scoreMap[name] = { name, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '', setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, tiebreaksWon: 0 };
  });

  (t.rounds || []).forEach(round => {
    (round.matches || []).forEach(m => {
      // If filtering by category, only count matches in that category
      if (category && m.category !== category) return;

      // Helper to ensure dynamic entry has GSM fields
      function _ensureEntry(name) {
        if (!scoreMap[name]) scoreMap[name] = { name: name, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '', setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, tiebreaksWon: 0 };
      }

      // Accumulate GSM (sets/games/tiebreaks) stats from match
      function _accumulateGSM(m) {
        if (!Array.isArray(m.sets) || m.sets.length === 0) return;
        var sw1 = 0, sw2 = 0, gw1 = 0, gw2 = 0, tb1 = 0, tb2 = 0;
        m.sets.forEach(function(s) {
          var g1 = parseInt(s.gamesP1) || 0;
          var g2 = parseInt(s.gamesP2) || 0;
          gw1 += g1; gw2 += g2;
          if (g1 > g2) sw1++; else if (g2 > g1) sw2++;
          if (s.tiebreak) {
            var tp1 = parseInt(s.tiebreak.pointsP1) || 0;
            var tp2 = parseInt(s.tiebreak.pointsP2) || 0;
            if (tp1 > tp2) tb1++; else if (tp2 > tp1) tb2++;
          }
        });
        if (scoreMap[m.p1]) { scoreMap[m.p1].setsWon += sw1; scoreMap[m.p1].setsLost += sw2; scoreMap[m.p1].gamesWon += gw1; scoreMap[m.p1].gamesLost += gw2; scoreMap[m.p1].tiebreaksWon += tb1; }
        if (scoreMap[m.p2]) { scoreMap[m.p2].setsWon += sw2; scoreMap[m.p2].setsLost += sw1; scoreMap[m.p2].gamesWon += gw2; scoreMap[m.p2].gamesLost += gw1; scoreMap[m.p2].tiebreaksWon += tb2; }
      }

      // Sit-out: player receives average points compensation (Liga)
      if (m.isSitOut && m.p1 && m.sitOutPoints !== undefined) {
        _ensureEntry(m.p1);
        scoreMap[m.p1].points += (m.sitOutPoints || 0);
        return;
      }
      // Skip BYE and unresolved matches
      if (!m.winner || m.isBye) return;

      // Rei/Rainha (monarch) matches in Liga: individual stats from team matches
      if (m.isMonarch && m.team1 && m.team2) {
        var ms1 = parseInt(m.scoreP1) || 0;
        var ms2 = parseInt(m.scoreP2) || 0;
        var isDraw = m.winner === 'draw' || m.draw;
        var team1Won = !isDraw && m.winner === m.p1;
        var team2Won = !isDraw && m.winner === m.p2;
        m.team1.forEach(function(name) {
          _ensureEntry(name);
          scoreMap[name].played++;
          scoreMap[name].pointsDiff += (ms1 - ms2);
          if (isDraw) { scoreMap[name].draws = (scoreMap[name].draws || 0) + 1; scoreMap[name].points += 1; }
          else if (team1Won) { scoreMap[name].wins++; scoreMap[name].points += 3; }
          else { scoreMap[name].losses++; }
        });
        m.team2.forEach(function(name) {
          _ensureEntry(name);
          scoreMap[name].played++;
          scoreMap[name].pointsDiff += (ms2 - ms1);
          if (isDraw) { scoreMap[name].draws = (scoreMap[name].draws || 0) + 1; scoreMap[name].points += 1; }
          else if (team2Won) { scoreMap[name].wins++; scoreMap[name].points += 3; }
          else { scoreMap[name].losses++; }
        });
        return;
      }

      // Handle draws — both players get 1 point each
      if (m.winner === 'draw' || m.draw) {
        _ensureEntry(m.p1); _ensureEntry(m.p2);
        scoreMap[m.p1].draws = (scoreMap[m.p1].draws || 0) + 1;
        scoreMap[m.p2].draws = (scoreMap[m.p2].draws || 0) + 1;
        scoreMap[m.p1].points += 1;
        scoreMap[m.p2].points += 1;
        scoreMap[m.p1].played++;
        scoreMap[m.p2].played++;
        var ds1 = parseInt(m.scoreP1) || 0;
        var ds2 = parseInt(m.scoreP2) || 0;
        scoreMap[m.p1].pointsDiff += (ds1 - ds2);
        scoreMap[m.p2].pointsDiff += (ds2 - ds1);
        _accumulateGSM(m);
        return;
      }

      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      _ensureEntry(m.winner); _ensureEntry(loser);

      scoreMap[m.winner].wins++;
      scoreMap[m.winner].points += 3;
      scoreMap[m.winner].played++;
      scoreMap[loser].losses++;
      scoreMap[loser].played++;

      const s1 = parseInt(m.scoreP1) || 0;
      const s2 = parseInt(m.scoreP2) || 0;
      if (m.winner === m.p1) {
        scoreMap[m.p1].pointsDiff += (s1 - s2);
        scoreMap[m.p2].pointsDiff += (s2 - s1);
      } else {
        scoreMap[m.p2].pointsDiff += (s2 - s1);
        scoreMap[m.p1].pointsDiff += (s1 - s2);
      }
      _accumulateGSM(m);
    });
  });

  const standings = Object.values(scoreMap);

  // Build Buchholz scores (sum of opponents' points)
  var allRoundMatches = (t.rounds || []).flatMap(r => r.matches || []);
  if (category) allRoundMatches = allRoundMatches.filter(m => m.category === category);
  standings.forEach(s => {
    s.buchholz = 0;
    allRoundMatches.forEach(m => {
      if (m.isBye || !m.winner) return;
      if (m.winner === 'draw' || m.draw) {
        // Empate: ambos jogaram contra o outro — contar pontos do oponente
        if (m.p1 === s.name && scoreMap[m.p2]) s.buchholz += scoreMap[m.p2].points;
        if (m.p2 === s.name && scoreMap[m.p1]) s.buchholz += scoreMap[m.p1].points;
        return;
      }
      if (m.p1 === s.name && scoreMap[m.p2]) s.buchholz += scoreMap[m.p2].points;
      if (m.p2 === s.name && scoreMap[m.p1]) s.buchholz += scoreMap[m.p1].points;
    });
    // Sonneborn-Berger: sum of points of opponents you beat + half points of opponents you drew
    s.sonnebornBerger = 0;
    allRoundMatches.forEach(m => {
      if (m.isBye || !m.winner) return;
      if (m.winner === 'draw' || m.draw) {
        // Empate: metade dos pontos do oponente
        var opp = m.p1 === s.name ? m.p2 : (m.p2 === s.name ? m.p1 : null);
        if (opp && scoreMap[opp]) s.sonnebornBerger += scoreMap[opp].points * 0.5;
        return;
      }
      if (m.winner === s.name) {
        const opp = m.p1 === s.name ? m.p2 : m.p1;
        if (scoreMap[opp]) s.sonnebornBerger += scoreMap[opp].points;
      }
    });
  });

  // Compute gamesDiff for each player
  standings.forEach(function(s) { s.gamesDiff = (s.gamesWon || 0) - (s.gamesLost || 0); s.setsDiff = (s.setsWon || 0) - (s.setsLost || 0); });

  // Apply configured tiebreaker order — auto-add GSM criteria when tournament uses sets
  var defaultTb = ['confronto_direto', 'saldo_pontos', 'vitorias', 'buchholz'];
  if (t.scoring && t.scoring.type === 'sets') {
    defaultTb = ['confronto_direto', 'saldo_sets', 'saldo_games', 'sets_vencidos', 'games_vencidos', 'tiebreaks_vencidos', 'vitorias', 'buchholz'];
  }
  const tiebreakers = t.tiebreakers || defaultTb;

  // Build head-to-head map for confronto_direto
  const h2h = {};
  allRoundMatches.forEach(m => {
    if (!m.winner || m.isBye) return;
    const isDraw = m.winner === 'draw' || m.draw;
    if (isDraw) {
      const key = `${m.p1}|||${m.p2}|||d`;
      h2h[key] = (h2h[key] || 0) + 1;
      const keyReverse = `${m.p2}|||${m.p1}|||d`;
      h2h[keyReverse] = (h2h[keyReverse] || 0) + 1;
    } else {
      const key = `${m.winner}|||${m.winner === m.p1 ? m.p2 : m.p1}`;
      h2h[key] = (h2h[key] || 0) + 1;
    }
  });

  standings.sort((a, b) => {
    // Primary: always sort by points first
    if (b.points !== a.points) return b.points - a.points;

    // Then apply configured tiebreakers
    for (const tb of tiebreakers) {
      let diff = 0;
      switch (tb) {
        case 'confronto_direto':
          const aBeatsB = h2h[`${a.name}|||${b.name}`] || 0;
          const bBeatsA = h2h[`${b.name}|||${a.name}`] || 0;
          const aDrawsB = h2h[`${a.name}|||${b.name}|||d`] || 0;
          diff = bBeatsA - aBeatsB; // negative means a wins
          if (diff !== 0) return diff < 0 ? -1 : 1;
          // If direct wins are equal, consider draws in the comparison
          if (aDrawsB > 0) break; // draws are neutral for sorting
          break;
        case 'saldo_pontos':
          diff = b.pointsDiff - a.pointsDiff;
          if (diff !== 0) return diff;
          break;
        case 'vitorias':
          diff = b.wins - a.wins;
          if (diff !== 0) return diff;
          break;
        case 'buchholz':
          diff = (b.buchholz || 0) - (a.buchholz || 0);
          if (diff !== 0) return diff;
          break;
        case 'sonneborn_berger':
          diff = (b.sonnebornBerger || 0) - (a.sonnebornBerger || 0);
          if (diff !== 0) return diff;
          break;
        case 'sets_vencidos':
          diff = (b.setsWon || 0) - (a.setsWon || 0);
          if (diff !== 0) return diff;
          break;
        case 'saldo_sets':
          diff = ((b.setsWon || 0) - (b.setsLost || 0)) - ((a.setsWon || 0) - (a.setsLost || 0));
          if (diff !== 0) return diff;
          break;
        case 'saldo_games':
          diff = ((b.gamesWon || 0) - (b.gamesLost || 0)) - ((a.gamesWon || 0) - (a.gamesLost || 0));
          if (diff !== 0) return diff;
          break;
        case 'games_vencidos':
          diff = (b.gamesWon || 0) - (a.gamesWon || 0);
          if (diff !== 0) return diff;
          break;
        case 'tiebreaks_vencidos':
          diff = (b.tiebreaksWon || 0) - (a.tiebreaksWon || 0);
          if (diff !== 0) return diff;
          break;
        case 'sorteio':
          return Math.random() - 0.5;
      }
    }
    return 0;
  });

  return standings;
}

// ─── Get champion (only from actual final with real participants) ──────────────
function _getChampion(t, activeRounds) {
  if (!activeRounds || activeRounds.length === 0) return null;

  const allMatches = t.matches || [];
  const roundsMap = {};
  allMatches.forEach(m => { if (!roundsMap[m.round]) roundsMap[m.round] = []; roundsMap[m.round].push(m); });

  // Champion only exists when ALL active rounds are complete (every non-BYE match has a winner)
  const allDone = activeRounds.every(r =>
    (roundsMap[r] || []).every(m => m.winner || m.isBye)
  );
  if (!allDone) return null;

  const lastRound = activeRounds[activeRounds.length - 1];
  const finalMatches = (roundsMap[lastRound] || []).filter(m => !m.isBye && m.p1 !== 'TBD');
  if (finalMatches.length === 0) return null;

  // All final matches must have a winner (handles double elim grand final too)
  const final = finalMatches.find(m => m.winner);
  return final ? final.winner : null;
}

// ─── Find match anywhere ──────────────────────────────────────────────────────
function _findMatch(t, matchId) {
  // Use canonical collector: covers all 7 storage shapes
  // (t.matches, t.thirdPlaceMatch, t.rounds[].matches, t.groups[].matches,
  //  t.groups[].rounds[] array form, t.rodadas[].matches, t.rodadas[] array form).
  // Previously missed t.groups[].matches (flat group matches, not in sub-rounds)
  // and t.rodadas entirely — causing silent failures in advance-winner and
  // result-save for those shapes.
  if (typeof window._collectAllMatches === 'function') {
    const all = window._collectAllMatches(t);
    for (let i = 0; i < all.length; i++) {
      if (all[i] && all[i].id === matchId) return all[i];
    }
    return null;
  }
  // Defensive fallback: bracket-model.js not loaded.
  if (t.thirdPlaceMatch && t.thirdPlaceMatch.id === matchId) return t.thirdPlaceMatch;
  let m = (t.matches || []).find(m => m.id === matchId);
  if (m) return m;
  for (const round of (t.rounds || [])) {
    m = (round.matches || []).find(m => m.id === matchId);
    if (m) return m;
  }
  for (const group of (t.groups || [])) {
    if (Array.isArray(group.matches)) {
      m = group.matches.find(m => m.id === matchId);
      if (m) return m;
    }
    for (const round of (group.rounds || [])) {
      if (Array.isArray(round)) {
        m = round.find(m => m.id === matchId);
      } else {
        m = (round.matches || []).find(m => m.id === matchId);
      }
      if (m) return m;
    }
  }
  return null;
}

// ─── Auto-resolve BYE match when a real player is placed ─────────────────────
function _autoResolveBye(t, match) {
  if (!match || match.winner) return; // already resolved
  var byeLabel = _t('bui.byeLabel');
  var p1Real = match.p1 && match.p1 !== 'TBD' && match.p1 !== byeLabel;
  var p2Real = match.p2 && match.p2 !== 'TBD' && match.p2 !== byeLabel;
  var p1Bye = match.p1 === byeLabel;
  var p2Bye = match.p2 === byeLabel;
  // One real player + one BYE → auto-resolve
  if (p1Real && p2Bye) {
    match.winner = match.p1;
    match.isBye = true;
    _advanceWinner(t, match);
  } else if (p2Real && p1Bye) {
    match.winner = match.p2;
    match.isBye = true;
    _advanceWinner(t, match);
  }
}

// ─── Advance winner to next round ────────────────────────��───────────────────
function _advanceWinner(t, completedMatch) {
  const winner = completedMatch.winner;
  const loser = winner === completedMatch.p1 ? completedMatch.p2 : completedMatch.p1;
  const isDupla = t.format === 'Dupla Eliminatória';

  if (completedMatch.nextMatchId) {
    const next = _findMatch(t, completedMatch.nextMatchId);
    if (next) {
      // Play-in matches specify which slot to fill via nextSlot
      if (completedMatch.nextSlot === 'p1') {
        next.p1 = winner;
      } else if (completedMatch.nextSlot === 'p2') {
        next.p2 = winner;
      } else {
        // Standard advancement: fill first available TBD slot
        if (!next.p1 || next.p1 === 'TBD') next.p1 = winner;
        else if (!next.p2 || next.p2 === 'TBD') next.p2 = winner;
      }
      // Auto-resolve BYE matches: if one slot is filled and the other is BYE
      _autoResolveBye(t, next);
    }
  }

  // Dupla Eliminatória: loser goes to lower bracket
  if (completedMatch.loserMatchId && isDupla) {
    const loserMatch = _findMatch(t, completedMatch.loserMatchId);
    if (loserMatch) {
      if (completedMatch.loserSlot === 'p1') loserMatch.p1 = loser;
      else if (completedMatch.loserSlot === 'p2') loserMatch.p2 = loser;
      else {
        if (!loserMatch.p1 || loserMatch.p1 === 'TBD') loserMatch.p1 = loser;
        else if (!loserMatch.p2 || loserMatch.p2 === 'TBD') loserMatch.p2 = loser;
      }
      _autoResolveBye(t, loserMatch);
    }
  }

  // Repechage: when R1 match completes, check if ALL R1 done → assign losers
  if (completedMatch.isRepechageR1 && t.repechageConfig) {
    _assignRepechageLosers(t);
  }
  // Repechage: when repechage match completes, check if ALL done → advance best loser
  if (completedMatch.isRepechage && t.repechageConfig && t.repechageConfig.bestLoserCount > 0) {
    _advanceBestLoser(t);
  }

  // Swiss/Liga: check if round is fully complete
  if (completedMatch.roundIndex !== undefined) {
    const round = (t.rounds || [])[completedMatch.roundIndex];
    if (round && (round.matches || []).every(m => m.winner)) {
      round.status = 'complete';
      t.standings = _computeStandings(t);
    }
  }

  _maybeGenerate3rdPlace(t);

  // Progressive classification: assign final positions to eliminated players
  _updateProgressiveClassification(t);

  // Auto-detect tournament completion for elimination formats
  _maybeFinishElimination(t);
}

// ─── Repechage helper: rank players using tournament tiebreaker criteria ─────
// Builds a rich stats object per player from all their matches, then sorts using
// the same criteria as _updateProgressiveClassification + configured t.tiebreakers.
function _rankByTiebreakers(t, playerNames) {
  var allMatches = t.matches || [];
  var players = playerNames.map(function(name) {
    var totalScored = 0, totalConceded = 0, matchesWon = 0, matchesPlayed = 0;
    var setsWon = 0, setsLost = 0, gamesWon = 0, gamesLost = 0, tiebreaksWon = 0;
    var lastScoreDiff = 0, lastPointsScored = 0;

    allMatches.forEach(function(m) {
      if (!m.winner || m.isBye) return;
      if (m.p1 !== name && m.p2 !== name) return;
      var isP1 = m.p1 === name;
      var scored = parseInt(isP1 ? m.scoreP1 : m.scoreP2) || 0;
      var conceded = parseInt(isP1 ? m.scoreP2 : m.scoreP1) || 0;
      totalScored += scored;
      totalConceded += conceded;
      matchesPlayed++;
      if (m.winner === name) matchesWon++;

      // Track last match (most recent = the loss that eliminated them)
      lastPointsScored = scored;
      lastScoreDiff = scored - conceded; // higher = closer game = better

      // GSM stats
      if (m.sets && Array.isArray(m.sets)) {
        m.sets.forEach(function(s) {
          var pg = isP1 ? (s.gamesP1 || 0) : (s.gamesP2 || 0);
          var og = isP1 ? (s.gamesP2 || 0) : (s.gamesP1 || 0);
          gamesWon += pg; gamesLost += og;
          if (pg > og) setsWon++; else if (og > pg) setsLost++;
          if (s.tiebreak) {
            var tp = isP1 ? (s.tiebreak.pointsP1 || 0) : (s.tiebreak.pointsP2 || 0);
            var to = isP1 ? (s.tiebreak.pointsP2 || 0) : (s.tiebreak.pointsP1 || 0);
            if (tp > to) tiebreaksWon++;
          }
        });
      }
    });

    return {
      name: name,
      wins: matchesWon,
      played: matchesPlayed,
      scored: totalScored,
      conceded: totalConceded,
      diff: totalScored - totalConceded,
      lastScoreDiff: lastScoreDiff,
      lastPointsScored: lastPointsScored,
      setsWon: setsWon,
      setsLost: setsLost,
      setsDiff: setsWon - setsLost,
      gamesWon: gamesWon,
      gamesLost: gamesLost,
      gamesDiff: gamesWon - gamesLost,
      tiebreaksWon: tiebreaksWon
    };
  });

  // Build head-to-head map
  var h2h = {};
  allMatches.forEach(function(m) {
    if (!m.winner || m.isBye) return;
    var key = m.p1 + '|' + m.p2;
    if (!h2h[key]) h2h[key] = { w1: 0, w2: 0 };
    if (m.winner === m.p1) h2h[key].w1++;
    else if (m.winner === m.p2) h2h[key].w2++;
  });

  // Get configured tiebreakers or default for elimination
  var defaultTb = ['saldo_pontos', 'vitorias'];
  if (t.scoring && t.scoring.type === 'gsm') {
    defaultTb = ['saldo_sets', 'saldo_games', 'sets_vencidos', 'games_vencidos', 'vitorias'];
  }
  var tiebreakers = t.tiebreakers || defaultTb;

  players.sort(function(a, b) {
    // Primary: last match score diff (closer game = better = higher diff)
    if (a.lastScoreDiff !== b.lastScoreDiff) return b.lastScoreDiff - a.lastScoreDiff;
    // Then: configured tiebreakers
    for (var ti = 0; ti < tiebreakers.length; ti++) {
      var tb = tiebreakers[ti];
      var diff = 0;
      switch (tb) {
        case 'confronto_direto':
          var k1 = a.name + '|' + b.name;
          var k2 = b.name + '|' + a.name;
          var h1 = h2h[k1] || { w1: 0, w2: 0 };
          var h2 = h2h[k2] || { w1: 0, w2: 0 };
          var aWins = h1.w1 + h2.w2;
          var bWins = h1.w2 + h2.w1;
          diff = bWins - aWins; // more h2h wins = better
          break;
        case 'saldo_pontos':
          diff = b.diff - a.diff;
          break;
        case 'vitorias':
          diff = b.wins - a.wins;
          break;
        case 'buchholz':
          // Skip for elimination — not applicable with few matches
          break;
        case 'sonneborn_berger':
          break;
        case 'saldo_sets':
          diff = b.setsDiff - a.setsDiff;
          break;
        case 'saldo_games':
          diff = b.gamesDiff - a.gamesDiff;
          break;
        case 'sets_vencidos':
          diff = b.setsWon - a.setsWon;
          break;
        case 'games_vencidos':
          diff = b.gamesWon - a.gamesWon;
          break;
        case 'tiebreaks_vencidos':
          diff = b.tiebreaksWon - a.tiebreaksWon;
          break;
        case 'sorteio':
          diff = Math.random() - 0.5;
          break;
      }
      if (diff !== 0) return diff;
    }
    // Ultimate: more points scored, then alphabetical
    if (a.scored !== b.scored) return b.scored - a.scored;
    return a.name.localeCompare(b.name);
  });

  return players;
}

// ─── Repechage: assign R1 losers to repechage matches by full tiebreaker criteria ─
// Called after each R1 result. Only acts when ALL R1 matches are complete.
// Ranks losers using tournament tiebreaker criteria (score diff, sets, games, h2h, etc).
// Top N losers fill repechage matches; rest are eliminated.
function _assignRepechageLosers(t) {
  var cfg = t.repechageConfig;
  if (!cfg || cfg._losersAssigned) return;

  // Check if ALL R1 repechage matches are complete
  var r1Matches = cfg.r1MatchIds.map(function(id) { return _findMatch(t, id); }).filter(Boolean);
  var allDone = r1Matches.length === cfg.r1MatchIds.length && r1Matches.every(function(m) { return m.winner; });
  if (!allDone) return;

  // Collect loser names
  var loserNames = [];
  r1Matches.forEach(function(m) {
    var loser = m.winner === m.p1 ? m.p2 : m.p1;
    if (loser && loser !== 'TBD' && loser !== 'BYE') loserNames.push(loser);
  });

  // Rank using full tiebreaker criteria
  var rankedLosers = _rankByTiebreakers(t, loserNames);

  // Top repParticipants go to repechage, rest eliminated
  var repLosers = rankedLosers.slice(0, cfg.repParticipants);
  var repMatches = cfg.repMatchIds.map(function(id) { return _findMatch(t, id); }).filter(Boolean);
  var slotIdx = 0;
  for (var i = 0; i < repLosers.length; i++) {
    var targetMatch = repMatches[Math.floor(slotIdx / 2)];
    if (targetMatch) {
      if (slotIdx % 2 === 0) targetMatch.p1 = repLosers[i].name;
      else targetMatch.p2 = repLosers[i].name;
    }
    slotIdx++;
  }

  // Store ranking for best-loser evaluation later
  cfg._rankedLosers = rankedLosers;
  cfg._losersAssigned = true;
}

// ─── Repechage: advance best losers to R2 after all repechage matches done ───
// When all repechage matches are complete and bestLoserCount > 0,
// re-rank ALL repechage losers using full tiebreaker criteria (not just R1 stats)
// and advance the best to their R2 slots.
function _advanceBestLoser(t) {
  var cfg = t.repechageConfig;
  if (!cfg || !cfg._losersAssigned || cfg._bestLoserAdvanced) return;
  if (cfg.bestLoserCount <= 0) return;

  // Check if ALL repechage matches are complete
  var repMatches = cfg.repMatchIds.map(function(id) { return _findMatch(t, id); }).filter(Boolean);
  var allDone = repMatches.length === cfg.repMatchIds.length && repMatches.every(function(m) { return m.winner; });
  if (!allDone) return;

  // Collect repechage losers
  var repLoserNames = [];
  repMatches.forEach(function(m) {
    var loser = m.winner === m.p1 ? m.p2 : m.p1;
    if (loser && loser !== 'TBD' && loser !== 'BYE') repLoserNames.push(loser);
  });

  // Rank using full tiebreaker criteria (considers all matches: R1 + repechage)
  var rankedRepLosers = _rankByTiebreakers(t, repLoserNames);

  // Advance top bestLoserCount to their R2 slots
  var bestLosersToAdvance = rankedRepLosers.slice(0, cfg.bestLoserCount);
  var blIdx = 0;
  var allM = t.matches || [];
  for (var i = 0; i < allM.length && blIdx < bestLosersToAdvance.length; i++) {
    var m = allM[i];
    if (m.awaitsBestLoser) {
      var slot = m.awaitsBestLoser; // 'p1' or 'p2'
      m[slot] = bestLosersToAdvance[blIdx].name;
      delete m.awaitsBestLoser;
      blIdx++;
      _autoResolveBye(t, m);
    }
  }

  cfg._bestLoserAdvanced = true;
}

// ─── Progressive classification for elimination formats ─────────────────────
// Assigns unique finalPosition to eliminated players using tiebreaker criteria.
// Players eliminated in the same round are ranked individually by:
//   1. Score in the losing match (closer score = higher rank)
//   2. Scores from previous rounds (accumulated)
//   3. Alphabetical as ultimate tiebreaker
function _updateProgressiveClassification(t) {
  if (!t.matches || t.matches.length === 0) return;
  var fmt = t.format || '';
  if (fmt.indexOf('Elim') === -1 && fmt.indexOf('Fase') === -1) return;

  // Always recompute from scratch — incremental updates cause position
  // collisions because already-classified losers are skipped, making every
  // new loser in a round land at posStart+0 instead of a unique offset.
  t.classification = {};

  var allMatches = t.matches;
  var roundNums = {};
  allMatches.forEach(function(m) {
    if (m.round !== undefined && m.bracket !== 'lower' && m.bracket !== 'grand') {
      roundNums[m.round] = true;
    }
  });
  var rounds = Object.keys(roundNums).map(Number).sort(function(a,b) { return a - b; });
  var totalRounds = rounds.length;
  if (totalRounds < 1) return;

  // Helper: get loser's score and winner's score from a match
  function _getLoserStats(m) {
    var loser = m.winner === m.p1 ? m.p2 : m.p1;
    var loserScore = m.winner === m.p1 ? (parseInt(m.scoreP2) || 0) : (parseInt(m.scoreP1) || 0);
    var winnerScore = m.winner === m.p1 ? (parseInt(m.scoreP1) || 0) : (parseInt(m.scoreP2) || 0);
    // For GSM: use sets won as primary, then games diff
    var setsWon = 0, setsDiff = 0, gamesDiff = 0;
    if (m.sets && Array.isArray(m.sets)) {
      var lIdx = m.winner === m.p1 ? 1 : 0; // loser index (0=p1, 1=p2)
      m.sets.forEach(function(s) {
        var lg = lIdx === 0 ? (s.gamesP1 || 0) : (s.gamesP2 || 0);
        var wg = lIdx === 0 ? (s.gamesP2 || 0) : (s.gamesP1 || 0);
        if (lg > wg) setsWon++;
        gamesDiff += (lg - wg);
      });
      setsDiff = (m.winner === m.p1 ? (m.setsWonP2 || 0) - (m.setsWonP1 || 0) : (m.setsWonP1 || 0) - (m.setsWonP2 || 0));
    }
    return {
      loser: loser,
      loserScore: loserScore,
      winnerScore: winnerScore,
      scoreDiff: loserScore - winnerScore, // higher (closer to 0) = better fight
      setsWon: setsWon,
      setsDiff: setsDiff,
      gamesDiff: gamesDiff
    };
  }

  // Helper: accumulated scores for a player across all their matches
  function _getPlayerHistory(playerName) {
    var totalScored = 0, totalConceded = 0, matchesWon = 0;
    allMatches.forEach(function(m) {
      if (!m.winner || m.isBye) return;
      if (m.p1 !== playerName && m.p2 !== playerName) return;
      var isP1 = m.p1 === playerName;
      var scored = parseInt(isP1 ? m.scoreP1 : m.scoreP2) || 0;
      var conceded = parseInt(isP1 ? m.scoreP2 : m.scoreP1) || 0;
      totalScored += scored;
      totalConceded += conceded;
      if (m.winner === playerName) matchesWon++;
    });
    return { scored: totalScored, conceded: totalConceded, diff: totalScored - totalConceded, wins: matchesWon };
  }

  // Collect losers per round-group (same position block).
  // Process rounds from FINAL → R1 so definitive positions (1, 2, and 3/4 from
  // the 3rd place match) are recorded first. Players who made it further are
  // then skipped when we reach their earlier-round entry — this is critical
  // because stale/edited match data can list the same player as a loser in
  // multiple rounds. Without reverse order + skip, the earlier-round positionGroup
  // overwrites the canonical final position (e.g. final loser landing at pos 9
  // instead of pos 2 when they also appear in a stale R1 match).
  var positionGroups = []; // [{posStart, losers: [{name, stats, history}]}]
  var placed = {}; // name -> true: already assigned a definitive position

  // Record 3rd place match winner/loser up-front so semi/earlier rounds skip them.
  if (t.thirdPlaceMatch && t.thirdPlaceMatch.winner) {
    placed[t.thirdPlaceMatch.winner] = true;
    var _tp_loser = t.thirdPlaceMatch.winner === t.thirdPlaceMatch.p1 ? t.thirdPlaceMatch.p2 : t.thirdPlaceMatch.p1;
    if (_tp_loser && _tp_loser !== 'TBD') placed[_tp_loser] = true;
  }

  var reverseOrder = rounds.slice().reverse(); // [final, semi, qf, ..., r1]
  reverseOrder.forEach(function(roundNum) {
    var originalIdx = rounds.indexOf(roundNum);
    var roundFromEnd = totalRounds - 1 - originalIdx;
    var matchesInRound = allMatches.filter(function(m) {
      return m.round === roundNum && m.bracket !== 'lower' && m.bracket !== 'grand';
    });

    if (roundFromEnd === 0) {
      // Final: definitive 1st and 2nd
      matchesInRound.forEach(function(m) {
        if (!m.winner || m.winner === 'draw' || m.isBye) return;
        var loser = m.winner === m.p1 ? m.p2 : m.p1;
        if (!loser || loser === 'TBD' || loser === 'BYE') return;
        t.classification[m.winner] = 1;
        t.classification[loser] = 2;
        placed[m.winner] = true;
        placed[loser] = true;
      });
    } else if (roundFromEnd === 1) {
      // Semi: if 3rd place match exists, positions 3 & 4 are handled below.
      // If not, rank semi-losers individually as 3rd/4th using tiebreakers.
      if (!t.thirdPlaceMatch || !t.thirdPlaceMatch.winner) {
        var semiLosers = [];
        matchesInRound.forEach(function(m) {
          if (!m.winner || m.winner === 'draw' || m.isBye) return;
          var stats = _getLoserStats(m);
          if (!stats.loser || stats.loser === 'TBD' || stats.loser === 'BYE') return;
          if (placed[stats.loser]) return;
          var history = _getPlayerHistory(stats.loser);
          semiLosers.push({ name: stats.loser, stats: stats, history: history });
        });
        if (semiLosers.length > 0) {
          positionGroups.push({ posStart: 3, losers: semiLosers });
          semiLosers.forEach(function(e) { placed[e.name] = true; });
        }
      }
    } else {
      // Collect all losers in this round for tiebreaking
      var posStart = Math.pow(2, roundFromEnd) + 1;
      var losers = [];
      matchesInRound.forEach(function(m) {
        if (!m.winner || m.winner === 'draw' || m.isBye) return;
        var stats = _getLoserStats(m);
        if (!stats.loser || stats.loser === 'TBD' || stats.loser === 'BYE') return;
        if (placed[stats.loser]) return;
        var history = _getPlayerHistory(stats.loser);
        losers.push({ name: stats.loser, stats: stats, history: history });
      });

      if (losers.length > 0) {
        positionGroups.push({ posStart: posStart, losers: losers });
        losers.forEach(function(e) { placed[e.name] = true; });
      }
    }
  });

  // Sort losers within each group and assign unique positions
  positionGroups.forEach(function(group) {
    group.losers.sort(function(a, b) {
      // 1. Higher loser score = closer match = better rank
      if (a.stats.scoreDiff !== b.stats.scoreDiff) return b.stats.scoreDiff - a.stats.scoreDiff;
      // 2. More sets won (GSM)
      if (a.stats.setsWon !== b.stats.setsWon) return b.stats.setsWon - a.stats.setsWon;
      // 3. Better game diff (GSM)
      if (a.stats.gamesDiff !== b.stats.gamesDiff) return b.stats.gamesDiff - a.stats.gamesDiff;
      // 4. More total points scored across tournament
      if (a.history.scored !== b.history.scored) return b.history.scored - a.history.scored;
      // 5. Better point differential across tournament
      if (a.history.diff !== b.history.diff) return b.history.diff - a.history.diff;
      // 6. More matches won across tournament
      if (a.history.wins !== b.history.wins) return b.history.wins - a.history.wins;
      // 7. Alphabetical
      return a.name.localeCompare(b.name);
    });

    group.losers.forEach(function(entry, idx) {
      t.classification[entry.name] = group.posStart + idx;
    });
  });

  // Handle 3rd place match result (applied LAST so it wins over any
  // contradictory entry a pathological dataset could produce).
  if (t.thirdPlaceMatch && t.thirdPlaceMatch.winner) {
    t.classification[t.thirdPlaceMatch.winner] = 3;
    var tp_loser = t.thirdPlaceMatch.winner === t.thirdPlaceMatch.p1 ? t.thirdPlaceMatch.p2 : t.thirdPlaceMatch.p1;
    if (tp_loser && tp_loser !== 'TBD') t.classification[tp_loser] = 4;
  }
}

// ─── Auto-finish elimination tournament ──────────────────────────────────────
function _maybeFinishElimination(t) {
  if (t.status === 'finished') return;
  if (t.currentStage === 'groups') return;
  if (t.format !== 'Eliminatória Simples' && t.format !== 'Dupla Eliminatória' && t.format !== 'Fase de Grupos') return;

  const allMatches = t.matches || [];
  if (allMatches.length === 0) return;

  // Check if all non-BYE matches have a winner
  const pendingMatches = allMatches.filter(function(m) {
    return !m.isBye && m.p1 && m.p1 !== 'TBD' && m.p2 && m.p2 !== 'TBD' && !m.winner;
  });
  if (pendingMatches.length > 0) return;

  // Check if there are still TBD matches (bracket not fully populated)
  const tbdMatches = allMatches.filter(function(m) {
    return !m.isBye && (!m.p1 || m.p1 === 'TBD' || !m.p2 || m.p2 === 'TBD');
  });
  if (tbdMatches.length > 0) return;

  // Check 3rd place match if enabled
  if (t.thirdPlaceMatch && !t.thirdPlaceMatch.winner) return;

  // Check group stage completion (Fase de Grupos)
  if (Array.isArray(t.groups) && t.groups.length > 0) {
    var groupsPending = t.groups.some(function(g) {
      return (g.rounds || []).some(function(r) {
        return (r.matches || []).some(function(m) {
          return !m.winner && !m.isBye;
        });
      });
    });
    if (groupsPending) return;
  }

  // All matches done — mark as finished
  t.status = 'finished';
  var _finChampion = null;
  if (typeof showNotification === 'function') {
    var roundNums = allMatches.map(function(m) { return m.round || 0; });
    var lastRound = Math.max.apply(null, roundNums);
    var finalMatches = allMatches.filter(function(m) { return m.round === lastRound && !m.isBye; });
    if (finalMatches.length > 0 && finalMatches[0].winner) {
      _finChampion = finalMatches[0].winner;
    }
    showNotification(_t('bui.tournamentFinished'), _finChampion ? _t('bui.tournamentFinishedChamp', { name: _finChampion }) : _t('bui.tournamentFinishedMsg'), 'success');
  }
  // Notify all participants about tournament finish (idempotent guard)
  if (!t._finishNotified && typeof window._notifyTournamentParticipants === 'function') {
    t._finishNotified = true;
    var _finMsg = _t('notif.tournamentFinished').replace('{name}', t.name || 'Torneio');
    if (_finChampion) _finMsg += ' ' + _finChampion + ' ' + _t('notif.isChampion');
    window._notifyTournamentParticipants(t, {
      type: 'tournament_finished',
      message: _finMsg,
      level: 'important'
    });
  }
}

// ─── 3rd place ────────────────────────────────────────────────────────────────
// Garante que o thirdPlaceMatch existe com TBD e preenche progressivamente
// com os perdedores das semifinais conforme os resultados são lançados
function _maybeGenerate3rdPlace(t) {
  // 3rd place match is always generated for elimination formats

  const allMatches = t.matches || [];

  // Identificar a rodada da semifinal (penúltima rodada do bracket)
  const allRounds = {};
  allMatches.filter(m => m.bracket !== 'lower' && m.bracket !== 'grand').forEach(m => {
    if (!allRounds[m.round]) allRounds[m.round] = [];
    allRounds[m.round].push(m);
  });
  const roundNums = Object.keys(allRounds).map(Number).sort((a, b) => a - b);
  if (roundNums.length < 2) return;

  const finalRoundNum = roundNums[roundNums.length - 1];
  const semiRoundNum = roundNums[roundNums.length - 2];
  const semis = allRounds[semiRoundNum] || [];

  // Inicializar thirdPlaceMatch se não existir
  if (!t.thirdPlaceMatch) {
    window._appendCanonicalColumn(t, {
      phase: 'thirdplace',
      matches: [{
        id: `match-3rd-${Date.now()}`,
        round: finalRoundNum,
        label: _t('bui.thirdPlaceMatch'),
        p1: 'TBD', p2: 'TBD', winner: null
      }]
    });
  }

  // Se já tem resultado confirmado no 3º lugar, não mexer
  if (t.thirdPlaceMatch.winner) return;

  // Sempre recalcular os participantes baseado no estado atual das semifinais
  // (corrige dados legados e acompanha edições de resultado)
  const losers = semis
    .filter(m => m.winner && m.winner !== 'draw' && !m.isBye)
    .map(m => m.winner === m.p1 ? m.p2 : m.p1)
    .filter(name => name && name !== 'TBD' && name !== 'BYE');

  t.thirdPlaceMatch.p1 = losers.length >= 1 ? losers[0] : 'TBD';
  t.thirdPlaceMatch.p2 = losers.length >= 2 ? losers[1] : 'TBD';
}

// ─── Close round + generate next ─────────────────────────────────────────────
window._closeRound = function (tId, roundIdx) {
  const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
  if (!t) return;
  const round = (t.rounds || [])[roundIdx];
  if (!round) return;

  const unfinished = (round.matches || []).filter(m => !m.winner && !m.isBye && !m.isSitOut);
  if (unfinished.length > 0) {
    showConfirmDialog(
      _t('bui.incompleteRound'),
      _t('bui.incompleteRoundMsg', {n: unfinished.length}),
      () => _doCloseRound(t, tId, roundIdx),
      null,
      { type: 'warning', confirmText: _t('btn.finishAnyway'), cancelText: _t('btn.back') }
    );
    return;
  }
  _doCloseRound(t, tId, roundIdx);
};

function _doCloseRound(t, tId, roundIdx) {
  // Guard: only close the most recent round. A stale call (from a duplicate
  // auto-close path, e.g. _saveResultInline + render-time safety net both
  // dispatching for the same round) would otherwise advance the next-round
  // generation or even trigger a premature Swiss→elim transition.
  if (roundIdx !== (t.rounds || []).length - 1) return;
  if (t.rounds[roundIdx] && t.rounds[roundIdx].status === 'complete') return;

  t.rounds[roundIdx].status = 'complete';
  t.standings = _computeStandings(t);

  const isSuico = t.format === 'Suíço Clássico' || t.classifyFormat === 'swiss' || t.currentStage === 'swiss';
  const maxRounds = t.swissRounds || 99;
  const isSwissClassification = t.p2Resolution === 'swiss' && t.currentStage === 'swiss';

  if (isSuico && t.rounds.length >= maxRounds) {
    // Swiss-as-classification: transition to elimination phase
    if (isSwissClassification && t.p2TargetCount) {
      var _finalStandings = _computeStandings(t);
      var _targetCount = t.p2TargetCount;
      var _advancedNames = _finalStandings.slice(0, _targetCount).map(function(s) { return s.name; });

      // Store Swiss results for reference
      t.swissStandings = _finalStandings;
      t.swissRoundsData = t.rounds.slice();

      // Clear Swiss state, transition to elimination
      t.currentStage = 'elimination';
      delete t.classifyFormat;
      t.rounds = [];

      // Update participants to only include advanced players (preserve objects)
      var _allParts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
      var _advancedParts = [];
      _advancedNames.forEach(function(name) {
        var found = _allParts.find(function(p) {
          var pName = typeof p === 'string' ? p : (p.displayName || p.name || '');
          return pName === name;
        });
        if (found) _advancedParts.push(found);
      });
      // Save eliminated players for reference
      t.swissEliminated = _allParts.filter(function(p) {
        var pName = typeof p === 'string' ? p : (p.displayName || p.name || '');
        return _advancedNames.indexOf(pName) === -1;
      });
      t.participants = _advancedParts;

      // Generate elimination bracket with the advanced players
      if (typeof window.generateDrawFunction === 'function') {
        // Temporarily disable p2Resolution to avoid re-entering Swiss
        var _savedP2 = t.p2Resolution;
        t.p2Resolution = 'bye'; // now power-of-2 is guaranteed
        window.AppStore.syncImmediate(tId).then(function() {
          window.generateDrawFunction(tId);
        });
      }

      showNotification(_t('bui.swissFinished'), _t('bui.swissFinishedMsg', { n: _targetCount, format: t.format || 'Eliminatórias' }), 'success');
      if (typeof window._notifyTournamentParticipants === 'function') {
        window._notifyTournamentParticipants(t, {
          type: 'swiss_to_elimination',
          message: _t('bui.swissFinishedNotif', {n: _targetCount, format: t.format || 'Eliminatórias'}),
          level: 'important'
        });
      }
      return;
    }

    // Pure Swiss: just finish
    t.status = 'finished';
    showNotification(_t('bui.swissFinishedRounds'), _t('bui.swissFinishedRoundsMsg', { n: maxRounds }), 'success');
    // Notify all participants about Swiss tournament finish
    if (!t._finishNotified && typeof window._notifyTournamentParticipants === 'function') {
      t._finishNotified = true;
      window._notifyTournamentParticipants(t, {
        type: 'tournament_finished',
        message: _t('notif.tournamentFinished').replace('{name}', t.name || 'Torneio'),
        level: 'important'
      });
    }
  } else {
    _generateNextRound(t);
    var _newRound = t.rounds[t.rounds.length - 1];
    var _newMatchCount = (_newRound && _newRound.matches || []).filter(function(m) { return !m.isSitOut; }).length;
    showNotification(_t('bui.newRound'), _t('bui.newRoundMsg', { n: t.rounds.length, count: _newMatchCount }), 'success');

    // Notify all participants about the new round
    if (typeof window._notifyTournamentParticipants === 'function') {
      window._notifyTournamentParticipants(t, {
        type: 'new_round',
        level: 'important',
        title: _t('bui.newRoundTitle', {n: t.rounds.length, name: t.name || 'Torneio'}),
        message: _t('bui.newRoundNotifMsg', {n: _newMatchCount}),
        tournamentId: tId
      });
    }
  }

  window.AppStore.logAction(tId, `Rodada ${roundIdx + 1} encerrada`);
  window.AppStore.syncImmediate(tId);
  if (typeof window._rerenderBracket === 'function') {
    window._rerenderBracket(tId);
  } else {
    renderBracket(document.getElementById('view-container'), tId);
  }
}

// ─── Swiss pairing ────────────────────────────────────────────────────────────
function _generateNextRound(t) {
  // Choose round generation strategy based on ligaRoundFormat
  var useReiRainha = t.ligaRoundFormat === 'rei_rainha';
  var genFn = useReiRainha ? _generateReiRainhaRoundForPlayers : _generateNextRoundForPlayers;

  var categories = (typeof window._sortCategoriesBySkillOrder === 'function')
    ? window._sortCategoriesBySkillOrder(t.combinedCategories || [], t.skillCategories)
    : (t.combinedCategories || []);
  if (categories.length === 0) {
    genFn(t, null);
  } else {
    categories.forEach(function(cat) {
      genFn(t, cat);
    });
  }
}

// ─── Rei/Rainha round generation for Liga ────────────────────────────────────

// Helper: get active players for Liga (filters out ligaActive === false)
function _getActiveLigaPlayers(t) {
  var allP = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  var activeNames = {};
  allP.forEach(function(p) {
    if (typeof p === 'object' && p.ligaActive === false) return; // explicitly inactive
    var name = typeof p === 'string' ? p : (p.displayName || p.name || '');
    if (name) activeNames[name] = true;
  });
  return activeNames;
}

// Helper: get inactive players for this round (ligaActive === false)
function _getInactiveLigaPlayers(t) {
  var allP = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  var names = [];
  allP.forEach(function(p) {
    if (typeof p === 'object' && p.ligaActive === false) {
      var name = p.displayName || p.name || '';
      if (name) names.push(name);
    }
  });
  return names;
}

// Helper: choose which players sit out this round based on fairness (least sit-outs first)
function _chooseSitOutPlayers(t, players, numToSitOut, category) {
  if (numToSitOut <= 0) return { playing: players, sitOut: [] };
  // Build sit-out count per player from history
  var history = t.sitOutHistory || {};
  var catKey = category || '__all__';
  var catHistory = history[catKey] || {};
  // Sort players by sit-out count ascending, then by standing position (worse players sit out first)
  var indexed = players.map(function(name, idx) {
    return { name: name, sitOuts: catHistory[name] || 0, rank: idx };
  });
  // Players with fewest sit-outs go first (play); ties broken by rank (worse rank sits out)
  indexed.sort(function(a, b) {
    if (a.sitOuts !== b.sitOuts) return b.sitOuts - a.sitOuts; // most sit-outs = should play now
    return b.rank - a.rank; // worse rank = more likely to sit out
  });
  var sitOut = indexed.slice(0, numToSitOut).map(function(x) { return x.name; });
  var playing = players.filter(function(p) { return sitOut.indexOf(p) === -1; });
  return { playing: playing, sitOut: sitOut };
}

// Helper: record sit-out in tournament history
function _recordSitOut(t, sitOutPlayers, category) {
  if (!sitOutPlayers || sitOutPlayers.length === 0) return;
  if (!t.sitOutHistory) t.sitOutHistory = {};
  var catKey = category || '__all__';
  if (!t.sitOutHistory[catKey]) t.sitOutHistory[catKey] = {};
  sitOutPlayers.forEach(function(name) {
    t.sitOutHistory[catKey][name] = (t.sitOutHistory[catKey][name] || 0) + 1;
  });
}

// Helper: compute average points per round for a player (for sit-out compensation)
function _computeAvgPointsPerRound(t, playerName, category) {
  var totalPoints = 0;
  var roundsPlayed = 0;
  (t.rounds || []).forEach(function(round) {
    var playedThisRound = false;
    (round.matches || []).forEach(function(m) {
      if (category && m.category !== category) return;
      if (m.isSitOut) return; // don't count sit-out compensation rounds
      if (m.isMonarch && m.team1 && m.team2) {
        if (m.team1.indexOf(playerName) !== -1 || m.team2.indexOf(playerName) !== -1) {
          if (m.winner) {
            playedThisRound = true;
            var isDraw = m.winner === 'draw' || m.draw;
            var team1Won = !isDraw && m.winner === m.p1;
            var team2Won = !isDraw && m.winner === m.p2;
            var inTeam1 = m.team1.indexOf(playerName) !== -1;
            if (isDraw) totalPoints += 1;
            else if ((inTeam1 && team1Won) || (!inTeam1 && team2Won)) totalPoints += 3;
          }
        }
      } else if (!m.isBye && m.winner) {
        if (m.p1 === playerName || m.p2 === playerName) {
          playedThisRound = true;
          if (m.winner === 'draw' || m.draw) totalPoints += 1;
          else if (m.winner === playerName) totalPoints += 3;
        }
      }
    });
    if (playedThisRound) roundsPlayed++;
  });
  return roundsPlayed > 0 ? Math.round(totalPoints / roundsPlayed) : 1;
}

window._generateReiRainhaRoundForPlayers = function _generateReiRainhaRoundForPlayers(t, category) {
  var standings = _computeStandings(t, category);
  var allPlayers = standings.map(function(s) { return s.name; });
  var isLiga = window._isLigaFormat && window._isLigaFormat(t);

  // Liga: filter out inactive players and record them as sit-out
  var players = allPlayers;
  var inactiveSitOuts = [];
  if (isLiga) {
    var activeNames = _getActiveLigaPlayers(t);
    players = allPlayers.filter(function(name) { return activeNames[name]; });
    inactiveSitOuts = allPlayers.filter(function(name) { return !activeNames[name]; });
  }

  if (players.length < 2) {
    console.warn('[bracket-logic] Not enough active players for Rei/Rainha round:', players.length);
    return;
  }
  if (players.length < 4) {
    // Not enough for Rei/Rainha groups, fallback to standard pairing
    _generateNextRoundForPlayers(t, category);
    return;
  }

  var roundNum = (t.rounds || []).length + 1;
  var ts = Date.now();
  var catSuffix = category ? '-' + category.replace(/\s+/g, '_') : '';
  var catLabel = category && window._displayCategoryName ? ' (' + window._displayCategoryName(category) + ')' : (category ? ' (' + category + ')' : '');

  // Liga: determine sit-outs fairly instead of BYE/extra matches
  var remainder = players.length % 4;
  var playingPlayers = players;
  var sitOutPlayers = [];

  if (remainder > 0 && isLiga) {
    var result = _chooseSitOutPlayers(t, players, remainder, category);
    playingPlayers = result.playing;
    sitOutPlayers = result.sitOut;
    _recordSitOut(t, sitOutPlayers, category);
  }

  // Divide playing players into groups of 4 (by standings order — similar level)
  var numGroups = Math.floor(playingPlayers.length / 4);
  var groups = [];

  for (var gi = 0; gi < numGroups; gi++) {
    var gPlayers = playingPlayers.slice(gi * 4, gi * 4 + 4);
    var A = gPlayers[0], B = gPlayers[1], C = gPlayers[2], D = gPlayers[3];
    var groupName = 'R' + roundNum + ' ' + (typeof _t === 'function' ? _t('label.group') : 'Grupo') + ' ' + String.fromCharCode(65 + gi);

    // 3 matches with rotating partners: AB vs CD, AC vs BD, AD vs BC
    var pairings = [
      { t1: [A, B], t2: [C, D] },
      { t1: [A, C], t2: [B, D] },
      { t1: [A, D], t2: [B, C] }
    ];

    var matches = pairings.map(function(pair, mi) {
      var mObj = {
        id: 'match-rr-r' + roundNum + '-g' + gi + '-' + mi + catSuffix + '-' + ts,
        round: roundNum, roundIndex: (t.rounds || []).length,
        p1: pair.t1.join(' / '), p2: pair.t2.join(' / '),
        team1: pair.t1, team2: pair.t2,
        winner: null, scoreP1: null, scoreP2: null,
        isMonarch: true, monarchGroup: gi,
        label: groupName + ' • Jogo ' + (mi + 1) + catLabel
      };
      if (category) mObj.category = category;
      return mObj;
    });

    groups.push({ name: groupName, players: gPlayers, matches: matches });
  }

  // Sit-out matches for Liga: remainder + inactive players receive average points compensation
  var sitOutMatches = [];
  if (isLiga) {
    var allSitOuts = sitOutPlayers.concat(inactiveSitOuts);
    // Record sit-outs (both remainder and inactive)
    _recordSitOut(t, inactiveSitOuts, category);
    allSitOuts.forEach(function(name, si) {
      var isInactive = inactiveSitOuts.indexOf(name) !== -1;
      var avgPts = isInactive ? 0 : _computeAvgPointsPerRound(t, name, category);
      var soObj = {
        id: 'sitout-rr-r' + roundNum + '-' + si + catSuffix + '-' + ts,
        round: roundNum, roundIndex: (t.rounds || []).length,
        p1: name, p2: 'FOLGA', winner: name,
        isSitOut: true, sitOutPoints: avgPts,
        sitOutReason: isInactive ? 'inactive' : 'remainder',
        label: 'R' + roundNum + ' • Folga' + (isInactive ? ' (inativo)' : '') + catLabel
      };
      if (category) soObj.category = category;
      sitOutMatches.push(soObj);
    });
  }

  // Non-Liga remainder: old behavior (standard pairings / BYE)
  var remainderMatches = [];
  if (!isLiga && remainder > 0) {
    var remRemainder = players.length % 4;
    if (remRemainder >= 2) {
      var remPlayers = players.slice(numGroups * 4);
      for (var ri = 0; ri < remPlayers.length; ri += 2) {
        if (ri + 1 < remPlayers.length) {
          var rObj = {
            id: 'match-rr-r' + roundNum + '-rem-' + ri + catSuffix + '-' + ts,
            round: roundNum, roundIndex: (t.rounds || []).length,
            p1: remPlayers[ri], p2: remPlayers[ri + 1],
            winner: null, label: 'R' + roundNum + ' • Extra' + catLabel
          };
          if (category) rObj.category = category;
          remainderMatches.push(rObj);
        } else {
          var byeObj = {
            id: 'bye-rr-r' + roundNum + catSuffix + '-' + ts,
            round: roundNum, roundIndex: (t.rounds || []).length,
            p1: remPlayers[ri], p2: 'BYE', winner: remPlayers[ri], isBye: true,
            label: 'R' + roundNum + ' • BYE' + catLabel
          };
          if (category) byeObj.category = category;
          remainderMatches.push(byeObj);
        }
      }
    } else if (remRemainder === 1) {
      var byeObj2 = {
        id: 'bye-rr-r' + roundNum + catSuffix + '-' + ts,
        round: roundNum, roundIndex: (t.rounds || []).length,
        p1: players[players.length - 1], p2: 'BYE', winner: players[players.length - 1], isBye: true,
        label: 'R' + roundNum + ' • BYE' + catLabel
      };
      if (category) byeObj2.category = category;
      remainderMatches.push(byeObj2);
    }
  }

  // Collect all matches for the round
  var allMatches = [];
  groups.forEach(function(g) { allMatches = allMatches.concat(g.matches); });
  allMatches = allMatches.concat(remainderMatches);
  allMatches = allMatches.concat(sitOutMatches);

  window._appendCanonicalColumn(t, {
    phase: 'monarch', round: roundNum, status: 'active',
    format: 'rei_rainha', matches: allMatches, monarchGroups: groups
  });
};

function _generateNextRoundForPlayers(t, category) {
  const standings = _computeStandings(t, category);
  const _isLigaFmtHere = window._isLigaFormat && window._isLigaFormat(t);
  const roundNum = (t.rounds || []).length + 1;
  const roundIdx = (t.rounds || []).length;
  const timestamp = Date.now();
  const catSuffix = category ? '-' + category.replace(/\s+/g, '_') : '';
  const catLabel = category && window._displayCategoryName ? ' (' + window._displayCategoryName(category) + ')' : (category ? ' (' + category + ')' : '');

  // Liga: filter inactive players, create sit-outs for them
  var inactiveSitOutsSwiss = [];
  var activeNamesSwiss = null;
  if (_isLigaFmtHere) {
    activeNamesSwiss = _getActiveLigaPlayers(t);
    inactiveSitOutsSwiss = _getInactiveLigaPlayers(t);
    _recordSitOut(t, inactiveSitOutsSwiss, category);
  }

  var allPlayersSwiss = standings.map(s => s.name);
  // Liga: filter out inactive players
  const players = (_isLigaFmtHere && activeNamesSwiss)
    ? allPlayersSwiss.filter(function(n) { return activeNamesSwiss[n]; })
    : allPlayersSwiss;
  if (players.length < 2) {
    console.warn('[bracket-logic] Not enough active players for round generation:', players.length);
    return;
  }

  // ─── Liga: form random doubles and match them (dupla vs dupla) ───────────
  if (_isLigaFmtHere) {
    // Shuffle players randomly for fair partner assignment
    var shuffled = players.slice();
    for (var si = shuffled.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = tmp;
    }

    // Handle sit-outs: need multiple of 4 for doubles matches
    var remainder = shuffled.length % 4;
    var playingPlayers = shuffled;
    var sitOutPlayers = [];
    if (remainder > 0) {
      var result = _chooseSitOutPlayers(t, shuffled, remainder, category);
      playingPlayers = result.playing;
      sitOutPlayers = result.sitOut;
      _recordSitOut(t, sitOutPlayers, category);
    }

    // Re-shuffle playing players to randomize partner assignment
    for (var ri = playingPlayers.length - 1; ri > 0; ri--) {
      var rj = Math.floor(Math.random() * (ri + 1));
      var rtmp = playingPlayers[ri]; playingPlayers[ri] = playingPlayers[rj]; playingPlayers[rj] = rtmp;
    }

    // Form doubles: take consecutive pairs of 4 → team1 = [0,1] vs team2 = [2,3]
    var newMatches = [];
    for (var mi = 0; mi < playingPlayers.length; mi += 4) {
      var A = playingPlayers[mi], B = playingPlayers[mi + 1];
      var C = playingPlayers[mi + 2], D = playingPlayers[mi + 3];
      var matchObj = {
        id: 'match-r' + roundNum + '-' + newMatches.length + catSuffix + '-' + timestamp,
        round: roundNum, roundIndex: roundIdx,
        p1: A + ' / ' + B, p2: C + ' / ' + D,
        team1: [A, B], team2: [C, D],
        winner: null, scoreP1: null, scoreP2: null,
        isMonarch: true,
        label: 'R' + roundNum + ' • Partida ' + (newMatches.length + 1) + catLabel
      };
      if (category) matchObj.category = category;
      newMatches.push(matchObj);
    }

    // Sit-out matches: remainder + inactive players receive average points
    var allSitOuts = sitOutPlayers.concat(inactiveSitOutsSwiss);
    _recordSitOut(t, inactiveSitOutsSwiss, category);
    allSitOuts.forEach(function(name, idx) {
      var isInactive = inactiveSitOutsSwiss.indexOf(name) !== -1;
      var avgPts = isInactive ? 0 : _computeAvgPointsPerRound(t, name, category);
      var soObj = {
        id: 'sitout-r' + roundNum + '-' + idx + catSuffix + '-' + timestamp,
        round: roundNum, roundIndex: roundIdx,
        p1: name, p2: 'FOLGA', winner: name,
        isSitOut: true, sitOutPoints: avgPts,
        sitOutReason: isInactive ? 'inactive' : 'remainder',
        label: 'R' + roundNum + ' • Folga' + (isInactive ? ' (inativo)' : '') + catLabel
      };
      if (category) soObj.category = category;
      newMatches.push(soObj);
    });

    window._appendCanonicalColumn(t, {
      phase: 'liga', round: roundNum, status: 'active', matches: newMatches
    });
    return;
  }

  // ─── Non-Liga: Swiss pairing (1v1) ──────────────────────────────────────
  var played = new Set();
  (t.rounds || []).forEach(r => {
    (r.matches || []).forEach(m => {
      if (category && m.category !== category) return;
      if (m.p1 && m.p2 && m.p2 !== 'BYE' && m.p2 !== 'FOLGA') {
        played.add(`${m.p1}|||${m.p2}`);
        played.add(`${m.p2}|||${m.p1}`);
      }
    });
  });

  var matched = new Set();
  var newMatches = [];

  // Pair players with similar score, avoiding repeats when possible
  for (let i = 0; i < players.length; i++) {
    if (matched.has(players[i])) continue;
    let paired = false;
    for (let j = i + 1; j < players.length; j++) {
      if (matched.has(players[j])) continue;
      if (!played.has(`${players[i]}|||${players[j]}`)) {
        var matchObj = {
          id: `match-r${roundNum}-${newMatches.length}${catSuffix}-${timestamp}`,
          round: roundNum, roundIndex: roundIdx,
          p1: players[i], p2: players[j],
          winner: null,
          label: `R${roundNum} • Partida ${newMatches.length + 1}` + catLabel
        };
        if (category) matchObj.category = category;
        newMatches.push(matchObj);
        matched.add(players[i]); matched.add(players[j]);
        paired = true; break;
      }
    }
    if (!paired) {
      // Allow repeat
      for (let j = i + 1; j < players.length; j++) {
        if (!matched.has(players[j])) {
          var matchObj2 = {
            id: `match-r${roundNum}-${newMatches.length}${catSuffix}-${timestamp}`,
            round: roundNum, roundIndex: roundIdx,
            p1: players[i], p2: players[j],
            winner: null,
            label: `R${roundNum} • Partida ${newMatches.length + 1}` + catLabel
          };
          if (category) matchObj2.category = category;
          newMatches.push(matchObj2);
          matched.add(players[i]); matched.add(players[j]);
          break;
        }
      }
    }
  }

  // Remainder: BYE for non-Liga
  players.filter(p => !matched.has(p)).forEach(p => {
    var byeObj = {
      id: `bye-r${roundNum}${catSuffix}-${timestamp}`,
      round: roundNum, roundIndex: roundIdx,
      p1: p, p2: 'BYE', winner: p, isBye: true,
      label: `R${roundNum} • BYE` + catLabel
    };
    if (category) byeObj.category = category;
    newMatches.push(byeObj);
  });

  window._appendCanonicalColumn(t, {
    phase: 'swiss', round: roundNum, status: 'active', matches: newMatches
  });
}

// ─── Liga auto-draw poller ──────────────────────────────────────────────────
// Runs periodically on the organizer's browser. For every Liga tournament
// where drawManual is off and drawFirstDate/Time are set, fires the scheduled
// draw when its time has arrived. First draw seeds standings + round 1;
// subsequent draws generate the next round. Stops once t.endDate has passed.
window._checkLigaAutoDraws = async function() {
  var store = window.AppStore;
  if (!store || !Array.isArray(store.tournaments) || !store.currentUser) return;

  var now = new Date();
  var tournaments = store.tournaments.slice();

  for (var i = 0; i < tournaments.length; i++) {
    var t = tournaments[i];
    if (!t) continue;

    // Only Liga tournaments
    if (!(window._isLigaFormat && window._isLigaFormat(t))) continue;

    // Only the organizer (or an active co-host) fires the draw — avoids
    // multiple participant browsers racing on the same tournament.
    if (typeof store.isOrganizer === 'function') {
      var origMode = store.viewMode;
      store.viewMode = 'organizer';
      var isOrg = store.isOrganizer(t);
      store.viewMode = origMode;
      if (!isOrg) continue;
    } else {
      if (!store.currentUser || t.organizerEmail !== store.currentUser.email) continue;
    }

    // Must be auto-scheduled with a first date
    if (t.drawManual) continue;
    if (!t.drawFirstDate) continue;

    // Skip finished
    if (t.status === 'finished') continue;

    // Stop if end date has passed
    if (t.endDate) {
      var endD = new Date(t.endDate + 'T23:59:59');
      if (!isNaN(endD.getTime()) && endD < now) continue;
    }

    var firstDrawStr = t.drawFirstDate + 'T' + (t.drawFirstTime || '19:00');
    var firstDraw = new Date(firstDrawStr);
    if (isNaN(firstDraw.getTime())) continue;

    // Not yet time for the first draw
    if (firstDraw > now) continue;

    // Compute the most recent scheduled draw that is ≤ now
    var intervalDays = parseInt(t.drawIntervalDays) || 7;
    if (intervalDays < 1) intervalDays = 1;
    var intervalMs = intervalDays * 86400000;
    var elapsed = now.getTime() - firstDraw.getTime();
    var intervals = Math.floor(elapsed / intervalMs);
    var mostRecentScheduled = new Date(firstDraw.getTime() + intervals * intervalMs);

    // Skip if we already fired for this scheduled time
    var lastFired = t.lastAutoDrawAt ? new Date(t.lastAutoDrawAt) : null;
    if (lastFired && !isNaN(lastFired.getTime()) && lastFired >= mostRecentScheduled) continue;

    try {
      await _fireLigaAutoDraw(t, mostRecentScheduled);
    } catch (e) {
      console.warn('[auto-draw] failed for tournament ' + t.id, e);
    }
  }
};

async function _fireLigaAutoDraw(t, scheduledTime) {
  var hasExistingDraw = (Array.isArray(t.rounds) && t.rounds.length > 0);
  var allParts = Array.isArray(t.participants) ? t.participants.slice() : Object.values(t.participants || {});

  // Need at least 2 active participants to draw
  var activeParts = allParts.filter(function(p) {
    if (typeof p !== 'object' || !p) return true;
    return p.ligaActive !== false;
  });
  if (activeParts.length < 2) {
    console.log('[auto-draw] Skipping tournament ' + t.id + ': fewer than 2 active participants');
    return;
  }

  if (!hasExistingDraw) {
    // First draw: shuffle participants, seed standings with ALL participants
    // (inactive still appear in standings — they just sit out until reactivated)
    for (var si = allParts.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = allParts[si]; allParts[si] = allParts[sj]; allParts[sj] = tmp;
    }

    t.standings = allParts.map(function(p) {
      var name = typeof p === 'string' ? p : (p.displayName || p.name || '');
      var entry = { name: name, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
      if (typeof p === 'object' && p && typeof window._getParticipantCategories === 'function') {
        var pcs = window._getParticipantCategories(p);
        if (pcs && pcs.length > 0) { entry.category = pcs[0]; entry.categories = pcs; }
      }
      return entry;
    });
    t.rounds = [];
    t.status = 'active';
    t.drawVisibility = t.drawVisibility || 'public';

    _generateNextRound(t);

    var firstRound = t.rounds[t.rounds.length - 1];
    var firstMatchCount = (firstRound && firstRound.matches || []).filter(function(m) { return !m.isSitOut; }).length;

    window.AppStore.logAction(t.id, 'Sorteio automático realizado — Rodada 1 gerada com ' + firstMatchCount + ' partida(s)');

    if (typeof window._notifyTournamentParticipants === 'function') {
      var _tFn1 = window._t || function(k, v) { return v && v.name ? v.name : k; };
      window._notifyTournamentParticipants(t, {
        type: 'draw',
        level: 'important',
        title: _tFn1('tdraw.round1NotifTitle', { name: t.name || 'Torneio' }) || ((t.name || 'Torneio') + ' — Rodada 1'),
        message: _tFn1('tdraw.round1NotifMsg', { count: firstMatchCount }) || ('Sorteio automático: ' + firstMatchCount + ' partida(s) geradas.'),
        tournamentId: t.id
      });
    }
  } else {
    // Subsequent draw — generate next round from current standings.
    // _generateNextRound handles active-player filtering and sit-outs internally.
    _generateNextRound(t);

    var newRound = t.rounds[t.rounds.length - 1];
    var newMatchCount = (newRound && newRound.matches || []).filter(function(m) { return !m.isSitOut; }).length;

    window.AppStore.logAction(t.id, 'Rodada ' + t.rounds.length + ' gerada automaticamente com ' + newMatchCount + ' partida(s)');

    if (typeof window._notifyTournamentParticipants === 'function') {
      var _tFn2 = window._t || function(k, v) { return v && v.n ? v.n : k; };
      window._notifyTournamentParticipants(t, {
        type: 'new_round',
        level: 'important',
        title: _tFn2('bui.newRoundTitle', { n: t.rounds.length, name: t.name || 'Torneio' }) || ((t.name || 'Torneio') + ' — Rodada ' + t.rounds.length),
        message: _tFn2('bui.newRoundNotifMsg', { n: newMatchCount }) || ('Nova rodada gerada automaticamente com ' + newMatchCount + ' partida(s).'),
        tournamentId: t.id
      });
    }
  }

  t.lastAutoDrawAt = scheduledTime.toISOString();
  t.updatedAt = new Date().toISOString();

  try {
    await window.AppStore.syncImmediate(t.id);
  } catch (e) {
    console.warn('[auto-draw] syncImmediate failed for tournament ' + t.id, e);
  }

  // If the user is currently viewing this tournament, refresh the view
  if (typeof window._rerenderBracket === 'function' && String(window._lastActiveTournamentId) === String(t.id)) {
    try { window._rerenderBracket(t.id); } catch (e) { /* ignore */ }
  }
}
