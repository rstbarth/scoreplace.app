// ─── Unified Bracket Model ─────────────────────────────────────────────────
// Read-only adapter. Takes a tournament in any of the 3 storage shapes
// (t.matches, t.rounds, t.groups) and returns a single canonical shape
// representing "columns of the unified horizontal strip".
//
// Purpose: let renderers, generators and analytics read ONE shape instead of
// branching on t.format / t.currentStage. No data migration — legacy fields
// are preserved in meta.raw so callers can fall back when needed.
//
// Canonical shape:
// {
//   columns: [
//     {
//       id:        'swiss-r1' | 'elim-r2' | 'groups' | 'monarch-r1' | ...
//       phase:     'swiss-past' | 'swiss' | 'elim' | 'groups' | 'monarch' |
//                  'liga' | 'playin' | 'repechage' | 'thirdplace' | 'grandfinal'
//       label:     'Suíço R1' | 'Oitavas' | 'Grupos' | 'Final' | ...
//       round:     1,
//       status:    'done' | 'active' | 'pending',
//       historical: boolean,     // true = past round, renderer may compact
//       matches:   [m, m, ...],
//       subgroups: [{ name, players, matches }] | undefined,
//       category:  'fem-a' | null,
//       meta:      { raw: <original round/matches object> }
//     }
//   ],
//   format:   t.format,
//   stage:    t.currentStage,
//   context: {
//     categories:     string[],
//     hasDoubleElim:  boolean,
//     hasThirdPlace:  boolean,
//     hasPlayIn:      boolean,
//     hasRepechage:   boolean,
//     hasSwissRecap:  boolean,
//   }
// }
//
// NOTE: This MVP covers the 3 primary shapes (elim, swiss/liga, groups) and
// the monarch sub-case. Double-elim lower bracket is flagged in context but
// not yet split into its own columns here.

(function () {
  'use strict';

  var LABELS = {
    final: 'Final',
    semi: 'Semifinais',
    quarter: 'Quartas de Final',
    r16: 'Oitavas de Final',
    playin: 'Play-in',
    repechage: 'Repescagem',
    thirdplace: '3º Lugar',
    grandfinal: 'Grande Final',
    grupos: 'Grupos',
    swissShort: 'Suíço R'
  };

  function _tr(key, fallback, params) {
    var _t = window._t;
    if (typeof _t === 'function') {
      var v = _t(key, params);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function _labelElimRound(roundNum, positiveRounds) {
    if (roundNum === 0) return _tr('bracket.playIn', LABELS.playin);
    if (roundNum < 0) return _tr('bracket.repechage', LABELS.repechage) +
      (Math.abs(roundNum) > 1 ? ' ' + Math.abs(roundNum) : '');
    var idx = positiveRounds.indexOf(roundNum);
    var fromEnd = positiveRounds.length - idx;
    if (fromEnd === 1) return _tr('bracket.final', LABELS.final);
    if (fromEnd === 2) return _tr('bracket.semiFinal', LABELS.semi);
    if (fromEnd === 3) return _tr('bracket.quarterFinal', LABELS.quarter);
    if (fromEnd === 4) return _tr('bracket.roundOf16', LABELS.r16);
    return _tr('bracket.round', 'Rodada ' + roundNum, { n: roundNum });
  }

  function _matchComplete(m) {
    return !!(m && (m.winner || m.isBye));
  }

  function _roundStatus(matches) {
    if (!matches || matches.length === 0) return 'pending';
    var anyWinner = matches.some(_matchComplete);
    var allDone = matches.every(_matchComplete);
    if (allDone) return 'done';
    if (anyWinner) return 'active';
    return 'pending';
  }

  // ── Swiss past rounds (used when Swiss was p2 resolution) ────────────────
  function _buildSwissPastColumns(t) {
    if (!Array.isArray(t.swissRoundsData) || t.swissRoundsData.length === 0) return [];
    return t.swissRoundsData.map(function (rd, ri) {
      var matches = (rd && rd.matches) ? rd.matches : [];
      return {
        id: 'swiss-past-r' + (ri + 1),
        phase: 'swiss-past',
        label: _tr('bracket.swissRoundShort', LABELS.swissShort + (ri + 1), { n: ri + 1 }),
        round: ri + 1,
        status: 'done',
        historical: true,
        matches: matches.slice(),
        subgroups: undefined,
        category: null,
        meta: { raw: rd }
      };
    });
  }

  // ── Swiss / Liga / Liga-rei-rainha from t.rounds[] ───────────────────────
  function _buildSwissColumns(t) {
    if (!Array.isArray(t.rounds) || t.rounds.length === 0) return [];
    return t.rounds.map(function (r, ri) {
      var matches = (r && r.matches) ? r.matches : [];
      var isMonarchRound = r && r.format === 'rei_rainha';
      var label;
      if (isMonarchRound) {
        label = _tr('bracket.round', 'Rodada ' + (ri + 1), { n: ri + 1 }) +
          ' • ' + _tr('bracket.monarchShort', 'Rei/Rainha');
      } else {
        label = _tr('bracket.round', 'Rodada ' + (ri + 1), { n: ri + 1 });
      }
      return {
        id: 'swiss-r' + (ri + 1),
        phase: isMonarchRound ? 'monarch' : 'swiss',
        label: label,
        round: ri + 1,
        status: (r.status === 'complete' ? 'done' : (r.status || _roundStatus(matches))),
        historical: (r.status === 'complete' || _roundStatus(matches) === 'done'),
        matches: matches.slice(),
        subgroups: isMonarchRound && Array.isArray(r.monarchGroups)
          ? r.monarchGroups.map(function (g) {
              return {
                name: g.name,
                players: (g.players || []).slice(),
                matches: (g.matches || []).slice()
              };
            })
          : undefined,
        category: null,
        meta: { raw: r }
      };
    });
  }

  // ── Single-elim columns from t.matches[] ─────────────────────────────────
  function _buildElimColumns(t) {
    var matches = Array.isArray(t.matches) ? t.matches : [];
    if (matches.length === 0) return [];

    // Group by round
    var byRound = {};
    matches.forEach(function (m) {
      var k = m.round;
      if (!byRound[k]) byRound[k] = [];
      byRound[k].push(m);
    });

    // Sort keys: repechage (negative) after 1 but before 2, play-in (0) first
    var keys = Object.keys(byRound).map(Number).sort(function (a, b) {
      var aKey = a < 0 ? 1.5 + (Math.abs(a) * 0.01) : a;
      var bKey = b < 0 ? 1.5 + (Math.abs(b) * 0.01) : b;
      return aKey - bKey;
    });

    var positiveRounds = keys.filter(function (r) { return r >= 1; });

    return keys.map(function (roundNum) {
      var rMatches = byRound[roundNum];
      var phase = roundNum === 0 ? 'playin'
                : roundNum < 0 ? 'repechage'
                : 'elim';
      return {
        id: 'elim-r' + roundNum,
        phase: phase,
        label: _labelElimRound(roundNum, positiveRounds),
        round: roundNum,
        status: _roundStatus(rMatches),
        historical: _roundStatus(rMatches) === 'done',
        matches: rMatches.slice(),
        subgroups: undefined,
        category: null,
        meta: { raw: { round: roundNum, matches: rMatches } }
      };
    });
  }

  // ── Group-stage column (one column, groups as subgroups) ─────────────────
  function _buildGroupsColumn(t) {
    if (!Array.isArray(t.groups) || t.groups.length === 0) return [];
    // Flatten each group's matches. Each group may have .matches or .rounds[].matches.
    var subgroups = t.groups.map(function (g, gi) {
      var gMatches = [];
      if (Array.isArray(g.matches) && g.matches.length > 0) {
        gMatches = g.matches.slice();
      } else if (Array.isArray(g.rounds)) {
        g.rounds.forEach(function (r) {
          if (Array.isArray(r.matches)) gMatches = gMatches.concat(r.matches);
        });
      }
      return {
        name: g.name || ('Grupo ' + String.fromCharCode(65 + gi)),
        players: (g.players || g.participants || []).slice(),
        matches: gMatches
      };
    });

    // Flattened matches for aggregate status
    var allMatches = subgroups.reduce(function (acc, sg) {
      return acc.concat(sg.matches || []);
    }, []);

    var isMonarchFormat = t.format === 'Rei/Rainha da Praia';
    return [{
      id: isMonarchFormat ? 'monarch-groups' : 'groups',
      phase: isMonarchFormat ? 'monarch' : 'groups',
      label: _tr('bracket.groups', LABELS.grupos),
      round: 1,
      status: _roundStatus(allMatches),
      historical: _roundStatus(allMatches) === 'done',
      matches: allMatches,
      subgroups: subgroups,
      category: null,
      meta: { raw: { groups: t.groups } }
    }];
  }

  // ── Third-place + grand final (special terminal cards) ──────────────────
  function _buildTerminalColumns(t) {
    var cols = [];
    if (t.thirdPlaceMatch && (t.thirdPlaceMatch.p1 || t.thirdPlaceMatch.p2)) {
      var m3 = t.thirdPlaceMatch;
      cols.push({
        id: 'thirdplace',
        phase: 'thirdplace',
        label: _tr('bracket.thirdPlace', LABELS.thirdplace),
        round: 0,
        status: _matchComplete(m3) ? 'done' : 'pending',
        historical: _matchComplete(m3),
        matches: [m3],
        subgroups: undefined,
        category: null,
        meta: { raw: m3 }
      });
    }
    if (t.grandFinal && (t.grandFinal.p1 || t.grandFinal.p2)) {
      var gf = t.grandFinal;
      cols.push({
        id: 'grandfinal',
        phase: 'grandfinal',
        label: _tr('bracket.grandFinal', LABELS.grandfinal),
        round: 0,
        status: _matchComplete(gf) ? 'done' : 'pending',
        historical: _matchComplete(gf),
        matches: [gf],
        subgroups: undefined,
        category: null,
        meta: { raw: gf }
      });
    }
    return cols;
  }

  // ── Main entry ────────────────────────────────────────────────────────────
  window._getUnifiedRounds = function _getUnifiedRounds(t) {
    if (!t || typeof t !== 'object') {
      return { columns: [], format: null, stage: null, context: {} };
    }

    var cols = [];

    // 1) Swiss past (p2 resolution recap) — only when we're in the elim phase
    //    and there's preserved swiss data.
    var hasSwissRecap = Array.isArray(t.swissRoundsData) && t.swissRoundsData.length > 0;
    if (hasSwissRecap && t.currentStage === 'elimination') {
      cols = cols.concat(_buildSwissPastColumns(t));
    }

    // 2) Primary phase
    var hasRounds = Array.isArray(t.rounds) && t.rounds.length > 0;
    var hasMatches = Array.isArray(t.matches) && t.matches.length > 0;
    var hasGroups = Array.isArray(t.groups) && t.groups.length > 0;

    // Groups phase comes before the elim strip when currentStage === 'groups'.
    if (hasGroups && (t.currentStage === 'groups' || t.format === 'Rei/Rainha da Praia')) {
      cols = cols.concat(_buildGroupsColumn(t));
    }

    // Swiss / Liga tournaments use t.rounds exclusively.
    if (hasRounds && !hasMatches) {
      cols = cols.concat(_buildSwissColumns(t));
    }

    // Elim tournaments use t.matches. Grupos+Elim after advance also falls here.
    if (hasMatches) {
      cols = cols.concat(_buildElimColumns(t));
    }

    // 3) Terminal (third-place + grand final)
    cols = cols.concat(_buildTerminalColumns(t));

    // ── Context flags ──
    var hasDoubleElim = hasMatches && t.matches.some(function (m) {
      return m.bracket === 'upper' || m.bracket === 'lower';
    });
    var hasThirdPlace = !!(t.thirdPlaceMatch && (t.thirdPlaceMatch.p1 || t.thirdPlaceMatch.p2));
    var hasPlayIn = hasMatches && t.matches.some(function (m) { return m.round === 0; });
    var hasRepechage = hasMatches && t.matches.some(function (m) { return m.round < 0; }) || !!t.hasRepechage;

    var cats = {};
    (hasMatches ? t.matches : []).forEach(function (m) { if (m.category) cats[m.category] = true; });
    (hasRounds ? t.rounds : []).forEach(function (r) {
      (r.matches || []).forEach(function (m) { if (m.category) cats[m.category] = true; });
    });

    return {
      columns: cols,
      format: t.format || null,
      stage: t.currentStage || null,
      context: {
        categories: Object.keys(cats),
        hasDoubleElim: hasDoubleElim,
        hasThirdPlace: hasThirdPlace,
        hasPlayIn: hasPlayIn,
        hasRepechage: hasRepechage,
        hasSwissRecap: hasSwissRecap
      }
    };
  };

  // ── Sanity checks (runs once in dev when ?debug=bracket-model is set) ────
  function _runSanityChecks() {
    try {
      var fixtures = [
        {
          name: 'empty tournament',
          t: {},
          expectColumns: 0
        },
        {
          name: 'single elim, 4 players, R1 done, R2 pending',
          t: {
            format: 'Eliminatórias',
            matches: [
              { id: 'm1', round: 1, p1: 'A', p2: 'B', winner: 'A' },
              { id: 'm2', round: 1, p1: 'C', p2: 'D', winner: 'C' },
              { id: 'm3', round: 2, p1: 'A', p2: 'C', winner: null }
            ]
          },
          expectColumns: 2,
          expectPhases: ['elim', 'elim'],
          expectStatuses: ['done', 'pending']
        },
        {
          name: 'swiss, 2 rounds',
          t: {
            format: 'Suíço',
            rounds: [
              { round: 1, status: 'complete', matches: [{ id: 'sm1', p1: 'A', p2: 'B', winner: 'A' }] },
              { round: 2, status: 'active', matches: [{ id: 'sm2', p1: 'A', p2: 'C', winner: null }] }
            ]
          },
          expectColumns: 2,
          expectPhases: ['swiss', 'swiss']
        },
        {
          name: 'groups phase',
          t: {
            format: 'Fase de Grupos + Eliminatórias',
            currentStage: 'groups',
            groups: [
              { name: 'Grupo A', players: ['A', 'B'], rounds: [{ round: 1, matches: [{ id: 'g1', p1: 'A', p2: 'B', winner: 'A' }] }] }
            ]
          },
          expectColumns: 1,
          expectPhases: ['groups'],
          expectSubgroups: 1
        },
        {
          name: 'swiss-as-p2 + elim',
          t: {
            format: 'Eliminatórias',
            currentStage: 'elimination',
            swissRoundsData: [
              { round: 1, matches: [{ p1: 'A', p2: 'B', winner: 'A' }] },
              { round: 2, matches: [{ p1: 'A', p2: 'C', winner: 'A' }] }
            ],
            matches: [
              { id: 'em1', round: 1, p1: 'A', p2: 'D', winner: null }
            ]
          },
          expectColumns: 3, // 2 swiss-past + 1 elim
          expectPhases: ['swiss-past', 'swiss-past', 'elim']
        }
      ];

      fixtures.forEach(function (fx) {
        var out = window._getUnifiedRounds(fx.t);
        var ok = true;
        var msgs = [];
        if (fx.expectColumns !== undefined && out.columns.length !== fx.expectColumns) {
          ok = false; msgs.push('columns=' + out.columns.length + ' expected=' + fx.expectColumns);
        }
        if (fx.expectPhases) {
          fx.expectPhases.forEach(function (p, i) {
            if (!out.columns[i] || out.columns[i].phase !== p) {
              ok = false; msgs.push('col[' + i + '].phase=' + (out.columns[i] && out.columns[i].phase) + ' expected=' + p);
            }
          });
        }
        if (fx.expectStatuses) {
          fx.expectStatuses.forEach(function (s, i) {
            if (!out.columns[i] || out.columns[i].status !== s) {
              ok = false; msgs.push('col[' + i + '].status=' + (out.columns[i] && out.columns[i].status) + ' expected=' + s);
            }
          });
        }
        if (fx.expectSubgroups !== undefined) {
          var sg = out.columns[0] && out.columns[0].subgroups ? out.columns[0].subgroups.length : 0;
          if (sg !== fx.expectSubgroups) {
            ok = false; msgs.push('subgroups=' + sg + ' expected=' + fx.expectSubgroups);
          }
        }
        if (ok) {
          console.log('%c[bracket-model ✓] ' + fx.name, 'color:#4ade80;');
        } else {
          console.warn('[bracket-model ✗] ' + fx.name, msgs.join(' | '), out);
        }
      });
    } catch (e) {
      console.error('[bracket-model] sanity check error:', e);
    }
  }

  // Expose for manual invocation: window._bracketModelSanityChecks()
  window._bracketModelSanityChecks = _runSanityChecks;

  // Auto-run when ?debug=bracket-model in URL
  if (typeof location !== 'undefined' && location.search &&
      location.search.indexOf('debug=bracket-model') !== -1) {
    setTimeout(_runSanityChecks, 500);
  }
})();
