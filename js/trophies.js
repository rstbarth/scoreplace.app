// scoreplace.app — Trophy Engine
// v1.0.0-beta
//
// Motor de troféus e milestones. Responsável por:
//   • _checkAndAwardTrophy(trophyId, uid, ctx)    — concede troféu (idempotente)
//   • _checkMilestoneAward(milestoneId, uid, ctx) — concede milestone de nível
//   • _checkTrophiesForEvent(event, ctx)           — dispara todas as checagens para um evento
//   • _bootstrapTrophiesForUser(uid)              — varredura inicial ao logar
//   • _loadUserTrophies(uid)                       — carrega troféus do Firestore
//   • _getUserStats(uid)                           — agrega estatísticas do usuário
//
// Todos os checks são não-bloqueantes (setTimeout 0 ou Promise chain)
// para nunca impactar a UX principal.
//
// Persistência:
//   users/{uid}/trophies/{trophyId}   → { awardedAt, tier, level? }
//   users/{uid}/milestones/{id}        → { level, awardedAt, bestTier }
//   _meta/trophyStats                  → { counts: { trophyId: N }, totalUsers: N }

(function() {
  'use strict';

  // ─── Cache local ──────────────────────────────────────────────────────────
  var _cache = {
    trophies: {},      // uid → { trophyId: { awardedAt, tier } }
    milestones: {},    // uid → { milestoneId: { level, bestTier } }
    stats: {},         // uid → userStats object
    trophyStats: null, // { counts, totalUsers, loadedAt }
    statsTimestamp: {} // uid → timestamp of last stats load
  };

  var TROPHY_STATS_TTL_MS = 3600000; // 1h
  var STATS_TTL_MS = 300000;         // 5min

  // Lock de awards em voo (evita double-write em clicks rápidos)
  var _pendingAwards = {};  // key: uid+'_'+trophyId → true

  // ─── Obter instância do Firestore ─────────────────────────────────────────
  function _db() {
    if (window.FirestoreDB && window.FirestoreDB.db) return window.FirestoreDB.db;
    return null;
  }

  // ─── Agregador de estatísticas do usuário ─────────────────────────────────
  // Constrói um objeto `stats` com todas as métricas necessárias para o engine.
  // Usa AppStore.currentUser (memória) + conta documentos no Firestore quando
  // necessário, mas SEMPRE de forma assíncrona e cacheable.

  window._getUserTrophyStats = function(uid) {
    if (!uid) return Promise.resolve({});

    var now = Date.now();
    var cached = _cache.stats[uid];
    var ts = _cache.statsTimestamp[uid] || 0;
    if (cached && (now - ts) < STATS_TTL_MS) return Promise.resolve(cached);

    var db = _db();
    if (!db) return Promise.resolve({});

    var cu = (window.AppStore && window.AppStore.currentUser) || {};
    var stats = {
      friendsCount: (cu.friends && cu.friends.length) || 0,
      invitesSent: cu.invitesSent || 0,
      friendNotifications: cu.friendNotifications || 0,
      activityDayStreak: cu.activityDayStreak || 0,
      checkInWeekStreak: cu.checkInWeekStreak || 0,
      casualActiveDaysThisMonth: cu.casualActiveDaysThisMonth || 0
    };

    // ── Partidas casuais: coleta host + guest em paralelo, dedup por docId,
    //    aplica anti-fraude (qualificação individual + limite diário). ────────
    var _casualMatchMap = {};  // docId → {data, role}
    var _casualHostDone = false, _casualGuestDone = false;

    function _processCasualMatchMap() {
      if (!_casualHostDone || !_casualGuestDone) return;
      // Converte mapa para array e filtra por qualificação anti-fraude
      var allMatches = Object.keys(_casualMatchMap).map(function(id) {
        return _casualMatchMap[id];
      });
      var qualified = allMatches.filter(function(item) {
        return typeof window._isCasualMatchQualified === 'function'
          ? window._isCasualMatchQualified(item.data)
          : item.data.status === 'finished';
      });
      // Aplica limite diário (max 5 partidas por dia-calendário)
      if (typeof window._applyDailyMatchLimit === 'function') {
        qualified = window._applyDailyMatchLimit(
          qualified.map(function(i) { return i.data; })
        ).map(function(d) { return { data: d, role: _casualMatchMap[d._docId] && _casualMatchMap[d._docId].role }; });
      }
      var played = qualified.length;
      var won = 0;
      var sportsSet = {};
      qualified.forEach(function(item) {
        var d = item.data;
        var myColor = item.role === 'host' ? d.hostColor : d.guestColor;
        if (d.winner && d.winner === myColor) won++;
        if (d.sport) sportsSet[d.sport] = true;
      });
      stats.casualMatchesPlayed = played;
      stats.casualMatchesWon    = won;
      stats.casualSportsPlayed  = Object.keys(sportsSet).length;
    }

    // Busca contadores de coleções Firestore em paralelo
    var promises = [
      // Partidas casuais — host
      db.collection('casualMatches')
        .where('hostUid', '==', uid)
        .where('status', '==', 'finished')
        .get()
        .then(function(snap) {
          snap.forEach(function(doc) {
            if (!_casualMatchMap[doc.id]) {
              var d = doc.data();
              d._docId = doc.id;
              _casualMatchMap[doc.id] = { data: d, role: 'host' };
            }
          });
          _casualHostDone = true;
          _processCasualMatchMap();
        })
        .catch(function() { _casualHostDone = true; _processCasualMatchMap(); }),

      // Partidas casuais — guest (dedup via _casualMatchMap)
      db.collection('casualMatches')
        .where('guestUid', '==', uid)
        .where('status', '==', 'finished')
        .get()
        .then(function(snap) {
          snap.forEach(function(doc) {
            if (!_casualMatchMap[doc.id]) {
              var d = doc.data();
              d._docId = doc.id;
              _casualMatchMap[doc.id] = { data: d, role: 'guest' };
            }
          });
          _casualGuestDone = true;
          _processCasualMatchMap();
        })
        .catch(function() { _casualGuestDone = true; _processCasualMatchMap(); }),

      // Torneios
      db.collection('tournaments')
        .where('memberEmails', 'array-contains', (cu.email || ''))
        .get()
        .then(function(snap) {
          var enrolled = 0, wins = 0, podiums = 0, ligaPart = 0, withTenPlus = 0;
          snap.forEach(function(doc) {
            var t = doc.data();
            enrolled++;
            if (typeof window._isLigaFormat === 'function' && window._isLigaFormat(t)) ligaPart++;
            // Vitória só conta em torneios com >= 4 participantes (anti-fraude)
            var qualifiedT = typeof window._isTournamentQualifiedForTrophy === 'function'
              ? window._isTournamentQualifiedForTrophy(t)
              : (t.status === 'finished');
            if (qualifiedT) {
              if (t.winner && (t.winner === (cu.displayName || '') || t.winner === cu.email)) wins++;
            }
            // Torneios com ≥10 inscritos que o user organizou
            if (t.organizerEmail === cu.email || t.organizerEmail === uid) {
              var count = (t.participants && t.participants.length) || 0;
              if (count >= 10) withTenPlus++;
            }
          });
          stats.tournamentsEnrolled    = enrolled;
          stats.tournamentWins         = wins;
          stats.tournamentPodiums      = podiums;
          stats.ligaParticipations     = ligaPart;
          stats.tournamentsWithTenPlus = withTenPlus;
          stats.tournamentMatchesWon   = 0;
        })
        .catch(function() {}),

      // Torneios criados
      db.collection('tournaments')
        .where('organizerEmail', '==', (cu.email || uid))
        .get()
        .then(function(snap) {
          stats.tournamentsCreated = snap.size;
        })
        .catch(function() {}),

      // Check-ins e locais únicos
      db.collection('presences')
        .where('uid', '==', uid)
        .where('type', 'in', ['checkin', 'plan'])
        .get()
        .then(function(snap) {
          var total = 0, venueSet = {};
          var plansCreated = 0;
          snap.forEach(function(doc) {
            var d = doc.data();
            if (d.type === 'checkin') {
              total++;
              if (d.placeId) venueSet[d.placeId] = true;
            }
            if (d.type === 'plan') plansCreated++;
          });
          stats.checkinsTotal = total;
          stats.uniqueVenuesVisited = Object.keys(venueSet).length;
          stats.plansCreated = plansCreated;
        })
        .catch(function() {})
    ];

    return Promise.all(promises).then(function() {
      _cache.stats[uid] = stats;
      _cache.statsTimestamp[uid] = Date.now();
      return stats;
    });
  };

  // ─── Carregar stats globais de troféus (_meta/trophyStats) ────────────────
  function _loadTrophyStats() {
    var now = Date.now();
    if (_cache.trophyStats && (now - _cache.trophyStats.loadedAt) < TROPHY_STATS_TTL_MS) {
      return Promise.resolve(_cache.trophyStats);
    }
    var db = _db();
    if (!db) return Promise.resolve({ counts: {}, totalUsers: 1 });

    return db.collection('_meta').doc('trophyStats').get()
      .then(function(doc) {
        var data = doc.exists ? doc.data() : { counts: {}, totalUsers: 1 };
        data.loadedAt = Date.now();
        if (!data.counts) data.counts = {};
        if (!data.totalUsers) data.totalUsers = 1;
        _cache.trophyStats = data;
        return data;
      })
      .catch(function() {
        return { counts: {}, totalUsers: 1, loadedAt: Date.now() };
      });
  }

  window._loadTrophyStats = _loadTrophyStats;

  // ─── Incrementar contador global de um troféu ────────────────────────────
  function _incrementTrophyStat(trophyId) {
    var db = _db();
    if (!db) return;
    try {
      db.collection('_meta').doc('trophyStats').set({
        counts: { [trophyId]: firebase.firestore.FieldValue.increment(1) },
        totalUsers: firebase.firestore.FieldValue.increment(0) // não muda, só garante existência
      }, { merge: true }).catch(function() {});
    } catch(e) {}
  }

  // ─── Carregar troféus do usuário ─────────────────────────────────────────
  window._loadUserTrophies = function(uid) {
    if (!uid) return Promise.resolve({ trophies: {}, milestones: {} });
    var db = _db();
    if (!db) return Promise.resolve({ trophies: {}, milestones: {} });

    return Promise.all([
      db.collection('users').doc(uid).collection('trophies').get()
        .then(function(snap) {
          var map = {};
          snap.forEach(function(doc) { map[doc.id] = doc.data(); });
          return map;
        })
        .catch(function() { return {}; }),
      db.collection('users').doc(uid).collection('milestones').get()
        .then(function(snap) {
          var map = {};
          snap.forEach(function(doc) { map[doc.id] = doc.data(); });
          return map;
        })
        .catch(function() { return {}; })
    ]).then(function(results) {
      _cache.trophies[uid] = results[0];
      _cache.milestones[uid] = results[1];
      return { trophies: results[0], milestones: results[1] };
    });
  };

  // ─── Conceder troféu (idempotente) ────────────────────────────────────────
  window._checkAndAwardTrophy = function(trophyId, uid, ctx) {
    if (!trophyId || !uid) return Promise.resolve(false);

    var trophy = window.TROPHY_CATALOG_BY_ID && window.TROPHY_CATALOG_BY_ID[trophyId];
    if (!trophy) return Promise.resolve(false);

    // Já tem em cache local?
    var userTrophies = _cache.trophies[uid] || {};
    if (userTrophies[trophyId]) return Promise.resolve(false); // já conquistado

    // Lock em voo
    var lockKey = uid + '_' + trophyId;
    if (_pendingAwards[lockKey]) return Promise.resolve(false);
    _pendingAwards[lockKey] = true;

    // Verificação da condição
    ctx = ctx || {};
    ctx.currentUser = (window.AppStore && window.AppStore.currentUser) || ctx.currentUser || {};
    ctx.stats = ctx.stats || (_cache.stats[uid] || {});
    ctx.userTrophies = ctx.userTrophies || (_cache.trophies[uid] || {});

    var conditionMet = false;
    try {
      conditionMet = trophy.check(ctx);
    } catch(e) {
      delete _pendingAwards[lockKey];
      return Promise.resolve(false);
    }

    if (!conditionMet) {
      delete _pendingAwards[lockKey];
      return Promise.resolve(false);
    }

    // Calcular tier dinâmico
    return _loadTrophyStats().then(function(tStats) {
      var tier = trophy.tier; // tier fixo
      if (!tier) {
        var count = (tStats.counts && tStats.counts[trophyId]) || 0;
        var total = tStats.totalUsers || 1;
        var pct = (count / total) * 100;
        tier = window._trophyTierFromPct ? window._trophyTierFromPct(pct) : 'bronze';
      }

      var db = _db();
      if (!db) {
        delete _pendingAwards[lockKey];
        return false;
      }

      var payload = { awardedAt: new Date().toISOString(), tier: tier };
      return db.collection('users').doc(uid)
        .collection('trophies').doc(trophyId)
        .set(payload)
        .then(function() {
          // Atualiza cache local
          if (!_cache.trophies[uid]) _cache.trophies[uid] = {};
          _cache.trophies[uid][trophyId] = payload;
          delete _pendingAwards[lockKey];

          // Incrementa contador global
          _incrementTrophyStat(trophyId);

          // Verifica troféu de categoria completa (após 300ms para cache estar fresco)
          if (trophy.category && trophyId.indexOf('cat_') !== 0) {
            var _catId = 'cat_' + trophy.category;
            if (window.TROPHY_CATALOG_BY_ID && window.TROPHY_CATALOG_BY_ID[_catId]) {
              (function(_cid) {
                setTimeout(function() {
                  window._checkAndAwardTrophy(_cid, uid, {
                    stats: ctx.stats,
                    currentUser: ctx.currentUser,
                    userTrophies: _cache.trophies[uid] || {}
                  }).catch(function() {});
                }, 300);
              })(_catId);
            }
          }

          // Exibe overlay de conquista
          _showTrophyUnlockOverlay(trophy, tier);

          console.log('[trophies] AWARDED', trophyId, 'tier:', tier);
          return true;
        })
        .catch(function(e) {
          delete _pendingAwards[lockKey];
          console.warn('[trophies] award failed', trophyId, e && e.message);
          return false;
        });
    });
  };

  // ─── Conceder milestone de nível ─────────────────────────────────────────
  window._checkMilestoneAward = function(milestoneId, uid, ctx) {
    if (!milestoneId || !uid) return;

    var milestone = window.MILESTONE_CATALOG_BY_ID && window.MILESTONE_CATALOG_BY_ID[milestoneId];
    if (!milestone) return;

    ctx = ctx || {};
    var stats = ctx.stats || (_cache.stats[uid] || {});
    var currentValue = stats[milestone.metric] || 0;
    if (!currentValue) return;

    var newLevel = window._milestoneCurrentLevel ? window._milestoneCurrentLevel(milestone, currentValue) : 0;
    if (newLevel <= 0) return;

    var userMilestones = _cache.milestones[uid] || {};
    var existing = userMilestones[milestoneId] || {};
    var prevLevel = existing.level || 0;

    if (newLevel <= prevLevel) return; // nenhum nível novo

    // Concede todos os níveis novos do prevLevel+1 até newLevel
    var db = _db();
    if (!db) return;

    for (var lvl = prevLevel + 1; lvl <= newLevel; lvl++) {
      (function(level) {
        var threshold = window._milestoneThresholdAt ? window._milestoneThresholdAt(milestone, level) : (milestone.startAt + milestone.step * (level - 1));
        var tier = window._milestoneTierFromLevel ? window._milestoneTierFromLevel(level) : 'bronze';
        var payload = {
          level: level,
          threshold: threshold,
          tier: tier,
          awardedAt: new Date().toISOString(),
          metric: milestone.metric,
          value: currentValue
        };

        db.collection('users').doc(uid)
          .collection('milestones').doc(milestoneId + '_' + level)
          .set(payload)
          .then(function() {
            if (!_cache.milestones[uid]) _cache.milestones[uid] = {};
            _cache.milestones[uid][milestoneId] = payload;

            // Exibe overlay apenas para ouro/platina ou para cada múltiplo de 5 níveis
            if (tier === 'ouro' || tier === 'platina' || level % 5 === 0) {
              var fakeTrophy = {
                title: milestone.titleFn ? milestone.titleFn(threshold) : ('Nível ' + level),
                desc: 'Marco: ' + (milestone.metric),
                icon: milestone.icon || '🏅',
                id: milestoneId,
                isMilestone: true,
                level: level
              };
              _showTrophyUnlockOverlay(fakeTrophy, tier);
            }
            console.log('[trophies] MILESTONE', milestoneId, 'level', level, 'tier', tier);
          })
          .catch(function() {});
      })(lvl);
    }

    // Atualiza "bestLevel" no doc raiz do milestone
    db.collection('users').doc(uid)
      .collection('milestones').doc(milestoneId)
      .set({ level: newLevel, awardedAt: new Date().toISOString() }, { merge: true })
      .catch(function() {});

    if (!_cache.milestones[uid]) _cache.milestones[uid] = {};
    _cache.milestones[uid][milestoneId] = _cache.milestones[uid][milestoneId] || {};
    _cache.milestones[uid][milestoneId].level = newLevel;
  };

  // ─── Dispatcher principal: chama todos os checks para um evento ──────────
  window._checkTrophiesForEvent = function(eventName, ctx) {
    if (!eventName) return;

    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return;
    var uid = cu.uid;

    ctx = ctx || {};
    ctx.currentUser = cu;

    // Não bloqueia a thread principal
    setTimeout(function() {
      // Carrega stats (usa cache ou busca)
      window._getUserTrophyStats(uid).then(function(stats) {
        ctx.stats = stats;

        // Checa troféus fixos disparados por este evento
        var trophiesToCheck = (window.TROPHY_CATALOG_BY_TRIGGER && window.TROPHY_CATALOG_BY_TRIGGER[eventName]) || [];
        trophiesToCheck.forEach(function(trophy) {
          window._checkAndAwardTrophy(trophy.id, uid, ctx);
        });

        // Checa milestones disparados por este evento
        var milestonesToCheck = (window.MILESTONE_CATALOG_BY_TRIGGER && window.MILESTONE_CATALOG_BY_TRIGGER[eventName]) || [];
        milestonesToCheck.forEach(function(milestone) {
          // Invalida cache de stats para refletir o novo valor
          _cache.statsTimestamp[uid] = 0;
          window._checkMilestoneAward(milestone.id, uid, ctx);
        });
      }).catch(function() {});
    }, 0);
  };

  // ─── Bootstrap: verifica todos os troféus ao logar ───────────────────────
  // Chave de localStorage para rastrear se este usuário já foi bootstrapped
  // com o sistema de troféus v1.5.0+. Impede re-varredura desnecessária
  // em cada reload de página.
  // v2: invalidates v1 flags so everyone gets re-bootstrapped once,
  // which now also writes _rankStats to their user doc for ranking.
  // v3: invalidates v2 flags so everyone gets re-bootstrapped once
  // to pick up category completion trophies (cat_*) added in v1.5.6.
  function _bootstrapKey(uid) { return 'scoreplace_trophy_boot_v3_' + uid; }
  function _markBootstrapped(uid) {
    try { localStorage.setItem(_bootstrapKey(uid), '1'); } catch(e) {}
  }
  function _wasBootstrapped(uid) {
    try { return localStorage.getItem(_bootstrapKey(uid)) === '1'; } catch(e) { return false; }
  }

  // Flag para suprimir overlays durante varredura retroativa (bootstrap silencioso).
  // Quando true, apenas toasts discretos são exibidos, nunca pop-ups ricos.
  var _isSilentBootstrap = false;

  window._bootstrapTrophiesForUser = function(uid, opts) {
    if (!uid) return;
    opts = opts || {};

    // Se já bootstrappou e não é força (ex: botão manual), pula.
    if (!opts.force && _wasBootstrapped(uid)) return;

    // Carrega troféus existentes do Firestore primeiro (evita re-award)
    window._loadUserTrophies(uid).then(function() {
      // Aguarda 3s para não competir com loaders iniciais da app
      setTimeout(function() {
        // Garante perfil carregado antes de checar troféus de perfil
        var profilePromise = (typeof window.loadUserProfile === 'function' && !(window.AppStore && window.AppStore.currentUser && window.AppStore.currentUser.displayName))
          ? window.loadUserProfile(uid)
          : Promise.resolve();

        profilePromise.then(function() {
          window._getUserTrophyStats(uid).then(function(stats) {
            var cu = (window.AppStore && window.AppStore.currentUser) || {};
            var ctx = { stats: stats, currentUser: cu };

            // Bootstrap silencioso: não mostrar overlay rico para cada troféu histórico
            // (poderia acumular 10+ pop-ups). Apenas toasts discretos para novos.
            _isSilentBootstrap = true;
            var newlyAwarded = 0;

            // Primeira passagem: troféus normais (sem cat_* de categoria completa)
            var awardsPromises = [];
            (window.TROPHY_CATALOG || []).forEach(function(trophy) {
              if (trophy.id.indexOf('cat_') === 0) return; // segunda passagem
              var userTrophies = _cache.trophies[uid] || {};
              if (!userTrophies[trophy.id]) {
                awardsPromises.push(
                  window._checkAndAwardTrophy(trophy.id, uid, ctx).then(function(awarded) {
                    if (awarded) newlyAwarded++;
                  }).catch(function() {})
                );
              }
            });

            // Varre todos os milestones
            (window.MILESTONE_CATALOG || []).forEach(function(milestone) {
              awardsPromises.push(
                window._checkMilestoneAward(milestone.id, uid, ctx).then(function(awarded) {
                  if (awarded) newlyAwarded++;
                }).catch(function() {})
              );
            });

            Promise.all(awardsPromises).then(function() {
              // Segunda passagem: troféus de categoria completa (cat_*)
              var _compPromises = [];
              (window.TROPHY_CATALOG || []).forEach(function(trophy) {
                if (trophy.id.indexOf('cat_') !== 0) return;
                var _uTr = _cache.trophies[uid] || {};
                if (!_uTr[trophy.id]) {
                  _compPromises.push(
                    window._checkAndAwardTrophy(trophy.id, uid, {
                      stats: ctx.stats,
                      currentUser: ctx.currentUser,
                      userTrophies: _cache.trophies[uid] || {}
                    }).then(function(awarded) { if (awarded) newlyAwarded++; }).catch(function() {})
                  );
                }
              });
              return Promise.all(_compPromises);
            }).then(function() {
              _isSilentBootstrap = false;
              _markBootstrapped(uid);

              // Persiste snapshot de ranking no doc do usuário para que
              // _loadFriendRanking possa comparar métricas entre amigos sem
              // precisar de subcoleções — campos diretos no doc de usuário.
              var _rdb = _db();
              if (_rdb) {
                var _rankSnap = {
                  casualMatchesPlayed: stats.casualMatchesPlayed || 0,
                  checkinsTotal:       stats.checkinsTotal       || 0,
                  tournamentsEnrolled: stats.tournamentsEnrolled  || 0,
                  tournamentWins:      stats.tournamentWins       || 0
                };
                _rdb.collection('users').doc(uid)
                  .update({ _rankStats: _rankSnap })
                  .catch(function() {});
              }

              // Se ganhou troféus retroativos, mostra resumo único em vez de N pop-ups
              if (newlyAwarded > 0) {
                if (typeof window.showNotification === 'function') {
                  window.showNotification(
                    '🏆 ' + newlyAwarded + ' conquista' + (newlyAwarded > 1 ? 's' : '') + ' desbloqueada' + (newlyAwarded > 1 ? 's' : '') + '!',
                    'Veja seus troféus em #trofeus',
                    'success'
                  );
                }
              }
            }).catch(function() {
              _isSilentBootstrap = false;
              _markBootstrapped(uid);
            });

          }).catch(function() { _isSilentBootstrap = false; });
        }).catch(function() { _isSilentBootstrap = false; });
      }, 3000);
    }).catch(function() {});
  };

  // ─── Auto-bootstrap para usuários com sessão persistida ──────────────────
  // Usuários que já estavam logados quando o sistema de troféus foi deployado
  // nunca passam por simulateLoginSuccess. Este listener detecta a sessão
  // persistida e dispara o bootstrap se ainda não foi feito.
  window._trophyCheckPersistentSession = function() {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) return;
    if (_wasBootstrapped(cu.uid)) return;
    // Pequeno delay para deixar o restante da app inicializar
    setTimeout(function() {
      window._bootstrapTrophiesForUser(cu.uid);
    }, 2000);
  };

  // ─── Overlay de conquista ────────────────────────────────────────────────
  function _showTrophyUnlockOverlay(trophy, tier) {
    if (!trophy) return;

    // Só mostra overlay rico para ouro e platina; bronze/prata viram toast
    var tierConfig = (window.TROPHY_TIER_COLORS || {})[tier] || {};
    var isRich = tier === 'ouro' || tier === 'platina';

    if (!isRich) {
      // Toast simples
      var label = trophy.isMilestone
        ? (trophy.icon + ' ' + trophy.title)
        : (trophy.icon + ' Troféu: ' + trophy.title);
      var tierLabel = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina' }[tier] || tier;
      if (typeof window.showNotification === 'function') {
        window.showNotification(label, tierLabel + ' desbloqueado!', 'success');
      }
      return;
    }

    // Overlay rico (ouro + platina)
    try {
      if (document.getElementById('trophy-unlock-overlay')) return; // uma de cada vez

      var tierLabel2 = tier === 'platina' ? '✨ Platina' : '🥇 Ouro';
      var overlay = document.createElement('div');
      overlay.id = 'trophy-unlock-overlay';
      overlay.className = 'trophy-unlock-overlay trophy-tier-' + tier;
      overlay.innerHTML =
        '<div class="trophy-unlock-card">' +
          '<div class="trophy-unlock-shimmer"></div>' +
          '<div class="trophy-unlock-icon">' + (trophy.icon || '🏆') + '</div>' +
          '<div class="trophy-unlock-badge">' + tierLabel2 + '</div>' +
          '<div class="trophy-unlock-title">' + _escTrophy(trophy.title) + '</div>' +
          (trophy.isMilestone
            ? '<div class="trophy-unlock-level">Nível ' + (trophy.level || '') + '</div>'
            : '') +
          '<div class="trophy-unlock-desc">' + _escTrophy(trophy.desc || '') + '</div>' +
          '<button class="btn btn-primary trophy-unlock-btn" onclick="document.getElementById(\'trophy-unlock-overlay\').remove();">Incrível! 🎉</button>' +
        '</div>';

      document.body.appendChild(overlay);

      // Auto-fecha em 6s se usuário não clicar
      setTimeout(function() {
        var el = document.getElementById('trophy-unlock-overlay');
        if (el) { el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.remove(); }, 400); }
      }, 6000);
    } catch(e) {}
  }

  function _escTrophy(str) {
    if (typeof window._safeHtml === 'function') return window._safeHtml(str);
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── API pública para hooks externos ─────────────────────────────────────

  // Chamado após partida casual terminar
  window._trophyOnCasualMatchFinished = function(matchData) {
    window._checkTrophiesForEvent('casual_match_finished', {
      matchResult: matchData || {}
    });
  };

  // Chamado após inscrição em torneio
  window._trophyOnTournamentEnrolled = function(tournament) {
    var ctx = {};
    if (tournament && typeof window._isLigaFormat === 'function') {
      ctx.isLiga = window._isLigaFormat(tournament);
    }
    window._checkTrophiesForEvent('tournament_enrolled', ctx);
  };

  // Chamado após torneio encerrado (com resultado)
  window._trophyOnTournamentFinished = function(tournament, placement) {
    window._checkTrophiesForEvent('tournament_finished', {
      tournamentData: tournament || {},
      placement: placement || 0
    });
  };

  // Chamado após criar torneio
  window._trophyOnTournamentCreated = function(tournament) {
    window._checkTrophiesForEvent('tournament_created', {
      tournamentData: tournament || {}
    });
  };

  // Chamado após resultado de partida de torneio
  window._trophyOnTournamentMatchResult = function(matchData) {
    window._checkTrophiesForEvent('tournament_match_result', {
      matchResult: matchData || {}
    });
  };

  // Chamado após check-in de presença
  window._trophyOnCheckin = function(presencePayload) {
    window._checkTrophiesForEvent('checkin', {
      presencePayload: presencePayload || {}
    });
  };

  // Chamado após criar plano de presença
  window._trophyOnPlanCreated = function(presencePayload) {
    window._checkTrophiesForEvent('plan_created', {
      presencePayload: presencePayload || {}
    });
  };

  // Chamado após adicionar amigo
  window._trophyOnFriendAdded = function() {
    window._checkTrophiesForEvent('friend_added', {});
  };

  // Chamado após salvar perfil
  window._trophyOnProfileSaved = function() {
    window._checkTrophiesForEvent('profile_saved', {});
  };

  // Chamado após login
  window._trophyOnLogin = function() {
    window._checkTrophiesForEvent('login', {});
  };

  // ─── XP + Level ───────────────────────────────────────────────────────────
  // XP por ação e tier de troféu/milestone

  window.TROPHY_XP_TABLE = {
    bronze:  10,
    prata:   25,
    ouro:    60,
    platina: 150
  };

  // Calcula XP total de um usuário somando trophies + milestones
  window._calcUserXP = function(uid) {
    var xp = 0;
    var trs = _cache.trophies[uid] || {};
    Object.values(trs).forEach(function(t) {
      xp += (window.TROPHY_XP_TABLE[t.tier] || 10);
    });
    var mils = _cache.milestones[uid] || {};
    Object.values(mils).forEach(function(m) {
      if (m.level) {
        xp += (window.TROPHY_XP_TABLE[m.tier] || 10) * m.level;
      }
    });
    return xp;
  };

  // Nível a partir de XP (aritmético: 100 XP por nível)
  window._xpToLevel = function(xp) {
    return Math.max(1, Math.floor(xp / 100) + 1);
  };

  // Label de rank por nível
  window._levelToRankLabel = function(level) {
    if (level <= 5)   return { label: 'Bronze', icon: '🥉', color: '#cd7f32' };
    if (level <= 10)  return { label: 'Prata',  icon: '🥈', color: '#a8a9ad' };
    if (level <= 20)  return { label: 'Ouro',   icon: '🥇', color: '#fbbf24' };
    if (level <= 35)  return { label: 'Platina', icon: '💎', color: '#67e8f9' };
    return               { label: 'Diamante', icon: '💠', color: '#a78bfa' };
  };

  // ─── Rankings ─────────────────────────────────────────────────────────────
  // Carrega o ranking de amigos para uma métrica específica
  window._loadFriendRanking = function(metric) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) return Promise.resolve([]);
    var friends = cu.friends || [];
    if (!friends.length) return Promise.resolve([]);

    var uids = friends.slice(0, 9); // max 9 amigos (Firestore 'in' limit 10)
    uids.push(cu.uid); // inclui o próprio usuário

    var db = _db();
    if (!db) return Promise.resolve([]);

    return db.collection('users')
      .where(firebase.firestore.FieldPath.documentId(), 'in', uids)
      .get()
      .then(function(snap) {
        var entries = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          var value = 0;
          if (metric === 'xp') {
            value = d.xpSnapshot || 0;
          } else {
            // Lê do snapshot de ranking (_rankStats) que é persistido no doc
            // pelo bootstrap e pelo backfill — campos como casualMatchesPlayed,
            // checkinsTotal, tournamentsEnrolled ficam acessíveis cross-user.
            var rs = d._rankStats || {};
            value = (rs[metric] !== undefined) ? rs[metric] : (d[metric] || 0);
          }
          entries.push({ uid: doc.id, name: d.displayName || 'Jogador', photo: d.photoURL, value: value });
        });
        entries.sort(function(a, b) { return b.value - a.value; });
        return entries;
      })
      .catch(function() { return []; });
  };

  console.log('[trophies] engine loaded');
})();
