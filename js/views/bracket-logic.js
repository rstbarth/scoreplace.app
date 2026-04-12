// ── Bracket Logic & Computation ──

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
      if (!m.winner || m.isBye) return;

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
  // Check 3rd place match first
  if (t.thirdPlaceMatch && t.thirdPlaceMatch.id === matchId) return t.thirdPlaceMatch;
  let m = (t.matches || []).find(m => m.id === matchId);
  if (m) return m;
  for (const round of (t.rounds || [])) {
    m = (round.matches || []).find(m => m.id === matchId);
    if (m) return m;
  }
  // Search in groups (Fase de Grupos)
  for (const group of (t.groups || [])) {
    for (const round of (group.rounds || [])) {
      m = (round.matches || []).find(m => m.id === matchId);
      if (m) return m;
    }
  }
  return null;
}

// ─── Auto-resolve BYE match when a real player is placed ─────────────────────
function _autoResolveBye(t, match) {
  if (!match || match.winner) return; // already resolved
  var byeLabel = 'BYE (Avança Direto)';
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

// ─── Repechage: assign R1 losers to repechage matches by R1 performance ─────
// Called after each R1 result. Only acts when ALL R1 matches are complete.
// Ranks losers by: 1) score difference (ascending = closer game better),
// 2) points scored (descending), 3) alphabetical.
// Top N losers fill repechage matches; rest are eliminated.
function _assignRepechageLosers(t) {
  var cfg = t.repechageConfig;
  if (!cfg || cfg._losersAssigned) return;
  var allMatches = t.matches || [];

  // Check if ALL R1 repechage matches are complete
  var r1Matches = cfg.r1MatchIds.map(function(id) { return _findMatch(t, id); }).filter(Boolean);
  var allDone = r1Matches.length === cfg.r1MatchIds.length && r1Matches.every(function(m) { return m.winner; });
  if (!allDone) return;

  // Collect losers with their R1 performance
  var losers = [];
  r1Matches.forEach(function(m) {
    var loser = m.winner === m.p1 ? m.p2 : m.p1;
    var loserScore = m.winner === m.p1 ? (parseInt(m.scoreP2) || parseInt(m.score2) || 0) : (parseInt(m.scoreP1) || parseInt(m.score1) || 0);
    var winnerScore = m.winner === m.p1 ? (parseInt(m.scoreP1) || parseInt(m.score1) || 0) : (parseInt(m.scoreP2) || parseInt(m.score2) || 0);
    var diff = winnerScore - loserScore; // lower = closer game = better
    losers.push({ name: loser, scoreDiff: diff, pointsScored: loserScore, fromMatchId: m.id });
  });

  // Sort: best losers first (smallest diff, then most points, then alpha)
  losers.sort(function(a, b) {
    if (a.scoreDiff !== b.scoreDiff) return a.scoreDiff - b.scoreDiff;
    if (a.pointsScored !== b.pointsScored) return b.pointsScored - a.pointsScored;
    return a.name.localeCompare(b.name);
  });

  // Top repParticipants go to repechage, rest eliminated
  var repLosers = losers.slice(0, cfg.repParticipants);
  // Assign to repechage match slots
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

  // Store loser ranking for best-loser evaluation later
  cfg._rankedLosers = losers;
  cfg._losersAssigned = true;
}

// ─── Repechage: advance best loser to R2 after all repechage matches done ───
// When all repechage matches are complete and bestLoserCount > 0,
// compare repechage losers by their original R1 performance and advance the best.
function _advanceBestLoser(t) {
  var cfg = t.repechageConfig;
  if (!cfg || !cfg._losersAssigned || cfg._bestLoserAdvanced) return;
  if (cfg.bestLoserCount <= 0) return;

  // Check if ALL repechage matches are complete
  var repMatches = cfg.repMatchIds.map(function(id) { return _findMatch(t, id); }).filter(Boolean);
  var allDone = repMatches.length === cfg.repMatchIds.length && repMatches.every(function(m) { return m.winner; });
  if (!allDone) return;

  // Collect repechage losers
  var repLosers = [];
  repMatches.forEach(function(m) {
    var loser = m.winner === m.p1 ? m.p2 : m.p1;
    // Find their R1 ranking
    var ranked = (cfg._rankedLosers || []).find(function(r) { return r.name === loser; });
    repLosers.push({
      name: loser,
      scoreDiff: ranked ? ranked.scoreDiff : 999,
      pointsScored: ranked ? ranked.pointsScored : 0
    });
  });

  // Sort: best repechage losers first (by R1 performance)
  repLosers.sort(function(a, b) {
    if (a.scoreDiff !== b.scoreDiff) return a.scoreDiff - b.scoreDiff;
    if (a.pointsScored !== b.pointsScored) return b.pointsScored - a.pointsScored;
    return a.name.localeCompare(b.name);
  });

  // Advance top bestLoserCount to their R2 slots
  var bestLosersToAdvance = repLosers.slice(0, cfg.bestLoserCount);
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

  // Collect losers per round-group (same position block)
  var positionGroups = []; // [{posStart, losers: [{name, stats, history}]}]

  rounds.forEach(function(roundNum, idx) {
    var roundFromEnd = totalRounds - 1 - idx;
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
          var history = _getPlayerHistory(stats.loser);
          semiLosers.push({ name: stats.loser, stats: stats, history: history });
        });
        if (semiLosers.length > 0) {
          positionGroups.push({ posStart: 3, losers: semiLosers });
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
        var history = _getPlayerHistory(stats.loser);
        losers.push({ name: stats.loser, stats: stats, history: history });
      });

      if (losers.length > 0) {
        positionGroups.push({ posStart: posStart, losers: losers });
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

  // Handle 3rd place match result
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
  if (typeof showNotification === 'function') {
    var champion = null;
    var roundNums = allMatches.map(function(m) { return m.round || 0; });
    var lastRound = Math.max.apply(null, roundNums);
    var finalMatches = allMatches.filter(function(m) { return m.round === lastRound && !m.isBye; });
    if (finalMatches.length > 0 && finalMatches[0].winner) {
      champion = finalMatches[0].winner;
    }
    showNotification('🏆 Torneio Encerrado!', champion ? champion + ' é o campeão!' : 'Todas as partidas foram concluídas.', 'success');
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
    t.thirdPlaceMatch = {
      id: `match-3rd-${Date.now()}`,
      round: finalRoundNum,
      label: '3º Lugar',
      p1: 'TBD', p2: 'TBD', winner: null
    };
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

  const unfinished = (round.matches || []).filter(m => !m.winner && !m.isBye);
  if (unfinished.length > 0) {
    showConfirmDialog(
      'Rodada Incompleta',
      `Há ${unfinished.length} partida(s) sem resultado. Encerrar mesmo assim?`,
      () => _doCloseRound(t, tId, roundIdx),
      null,
      { type: 'warning', confirmText: 'Encerrar mesmo assim', cancelText: 'Voltar' }
    );
    return;
  }
  _doCloseRound(t, tId, roundIdx);
};

function _doCloseRound(t, tId, roundIdx) {
  t.rounds[roundIdx].status = 'complete';
  t.standings = _computeStandings(t);

  const isSuico = t.format === 'Suíço Clássico';
  const maxRounds = t.swissRounds || 99;

  if (isSuico && t.rounds.length >= maxRounds) {
    t.status = 'finished';
    showNotification('Torneio Encerrado', `${maxRounds} rodadas concluídas!`, 'success');
  } else {
    _generateNextRound(t);
    showNotification('Nova Rodada', `Rodada ${t.rounds.length} gerada!`, 'success');
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
window._generateReiRainhaRoundForPlayers = function _generateReiRainhaRoundForPlayers(t, category) {
  var standings = _computeStandings(t, category);
  var players = standings.map(function(s) { return s.name; });
  if (players.length < 4) {
    // Not enough for Rei/Rainha groups, fallback to standard pairing
    _generateNextRoundForPlayers(t, category);
    return;
  }

  var roundNum = (t.rounds || []).length + 1;
  var ts = Date.now();
  var catSuffix = category ? '-' + category.replace(/\s+/g, '_') : '';
  var catLabel = category && window._displayCategoryName ? ' (' + window._displayCategoryName(category) + ')' : (category ? ' (' + category + ')' : '');
  var matchCounter = 0;

  // Divide players into groups of 4 (by standings order — similar level)
  var numGroups = Math.floor(players.length / 4);
  var remainder = players.length % 4;
  var groups = [];

  for (var gi = 0; gi < numGroups; gi++) {
    var gPlayers = players.slice(gi * 4, gi * 4 + 4);
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

  // Remainder players (< 4) get standard pairings
  var remainderMatches = [];
  if (remainder >= 2) {
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
        // Odd remainder — BYE
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
  } else if (remainder === 1) {
    var byeObj2 = {
      id: 'bye-rr-r' + roundNum + catSuffix + '-' + ts,
      round: roundNum, roundIndex: (t.rounds || []).length,
      p1: players[players.length - 1], p2: 'BYE', winner: players[players.length - 1], isBye: true,
      label: 'R' + roundNum + ' • BYE' + catLabel
    };
    if (category) byeObj2.category = category;
    remainderMatches.push(byeObj2);
  }

  // Collect all matches for the round
  var allMatches = [];
  groups.forEach(function(g) { allMatches = allMatches.concat(g.matches); });
  allMatches = allMatches.concat(remainderMatches);

  if (!t.rounds) t.rounds = [];
  if (t.rounds.length < roundNum) {
    t.rounds.push({
      round: roundNum, status: 'active', format: 'rei_rainha',
      matches: allMatches, monarchGroups: groups
    });
  } else {
    // Append matches for this category to existing round
    t.rounds[roundNum - 1].matches = t.rounds[roundNum - 1].matches.concat(allMatches);
    if (!t.rounds[roundNum - 1].monarchGroups) t.rounds[roundNum - 1].monarchGroups = [];
    t.rounds[roundNum - 1].monarchGroups = t.rounds[roundNum - 1].monarchGroups.concat(groups);
    t.rounds[roundNum - 1].format = 'rei_rainha';
  }
};

function _generateNextRoundForPlayers(t, category) {
  const standings = _computeStandings(t, category);
  const roundNum = (t.rounds || []).length + 1;
  const roundIdx = (t.rounds || []).length;
  const timestamp = Date.now();
  const catSuffix = category ? '-' + category.replace(/\s+/g, '_') : '';

  const played = new Set();
  (t.rounds || []).forEach(r => {
    (r.matches || []).forEach(m => {
      if (category && m.category !== category) return;
      if (m.p1 && m.p2 && m.p2 !== 'BYE') {
        played.add(`${m.p1}|||${m.p2}`);
        played.add(`${m.p2}|||${m.p1}`);
      }
    });
  });

  const players = standings.map(s => s.name);
  const matched = new Set();
  const newMatches = [];

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
          label: `R${roundNum} • Partida ${newMatches.length + 1}` + (category ? ` (${window._displayCategoryName ? window._displayCategoryName(category) : category})` : '')
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
            label: `R${roundNum} • Partida ${newMatches.length + 1}` + (category ? ` (${window._displayCategoryName ? window._displayCategoryName(category) : category})` : '')
          };
          if (category) matchObj2.category = category;
          newMatches.push(matchObj2);
          matched.add(players[i]); matched.add(players[j]);
          break;
        }
      }
    }
  }

  // BYE for odd player
  players.filter(p => !matched.has(p)).forEach(p => {
    var byeObj = {
      id: `bye-r${roundNum}${catSuffix}-${timestamp}`,
      round: roundNum, roundIndex: roundIdx,
      p1: p, p2: 'BYE', winner: p, isBye: true,
      label: `R${roundNum} • BYE` + (category ? ` (${window._displayCategoryName ? window._displayCategoryName(category) : category})` : '')
    };
    if (category) byeObj.category = category;
    newMatches.push(byeObj);
  });

  if (!t.rounds) t.rounds = [];
  // If first category in a new round, push new round; otherwise append to existing round
  if (t.rounds.length < roundNum) {
    t.rounds.push({ round: roundNum, status: 'active', matches: newMatches });
  } else {
    // Append matches for this category to existing round
    t.rounds[roundNum - 1].matches = t.rounds[roundNum - 1].matches.concat(newMatches);
  }
}
