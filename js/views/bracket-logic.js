// ── Bracket Logic & Computation ──
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
    if (name && !scoreMap[name]) scoreMap[name] = { name, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '' };
  });

  (t.rounds || []).forEach(round => {
    (round.matches || []).forEach(m => {
      // If filtering by category, only count matches in that category
      if (category && m.category !== category) return;
      if (!m.winner || m.isBye) return;

      // Handle draws — both players get 1 point each
      if (m.winner === 'draw' || m.draw) {
        if (!scoreMap[m.p1]) scoreMap[m.p1] = { name: m.p1, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '' };
        if (!scoreMap[m.p2]) scoreMap[m.p2] = { name: m.p2, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '' };
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
        return;
      }

      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      if (!scoreMap[m.winner]) scoreMap[m.winner] = { name: m.winner, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '' };
      if (!scoreMap[loser]) scoreMap[loser] = { name: loser, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0, category: category || '' };

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

  // Apply configured tiebreaker order
  const tiebreakers = t.tiebreakers || ['confronto_direto', 'saldo_pontos', 'vitorias', 'buchholz'];

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

// ─── Advance winner to next round ────────────────────────────────────────────
function _advanceWinner(t, completedMatch) {
  const winner = completedMatch.winner;
  const loser = winner === completedMatch.p1 ? completedMatch.p2 : completedMatch.p1;
  const isDupla = t.format === 'Dupla Eliminatória';

  if (completedMatch.nextMatchId) {
    const next = _findMatch(t, completedMatch.nextMatchId);
    if (next) {
      if (!next.p1 || next.p1 === 'TBD') next.p1 = winner;
      else if (!next.p2 || next.p2 === 'TBD') next.p2 = winner;
    }
  }

  if (isDupla && completedMatch.loserMatchId) {
    const loserMatch = _findMatch(t, completedMatch.loserMatchId);
    if (loserMatch) {
      if (!loserMatch.p1 || loserMatch.p1 === 'TBD') loserMatch.p1 = loser;
      else if (!loserMatch.p2 || loserMatch.p2 === 'TBD') loserMatch.p2 = loser;
    }
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

  // Auto-detect tournament completion for elimination formats
  _maybeFinishElimination(t);
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
  if (t.elimThirdPlace && t.thirdPlaceMatch && !t.thirdPlaceMatch.winner) return;

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
  if (!t.elimThirdPlace) return;

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
  renderBracket(document.getElementById('view-container'), tId);
}

// ─── Swiss pairing ────────────────────────────────────────────────────────────
function _generateNextRound(t) {
  var categories = (typeof window._sortCategoriesBySkillOrder === 'function')
    ? window._sortCategoriesBySkillOrder(t.combinedCategories || [], t.skillCategories)
    : (t.combinedCategories || []);
  if (categories.length === 0) {
    // No categories — original behavior
    _generateNextRoundForPlayers(t, null);
  } else {
    // Generate pairings per category
    categories.forEach(function(cat) {
      _generateNextRoundForPlayers(t, cat);
    });
  }
}

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
