// scoreplace.app — Trophies View
// v1.0.0-beta
//
// Página de Troféus e Conquistas acessível via #trofeus.
// Mostra:
//   • XP total + nível + barra de progresso
//   • Estatísticas de resumo (troféus ganhos, milestones, rank)
//   • Ranking de amigos (métrica selecionável)
//   • Grid de troféus fixos (conquistados e não-conquistados)
//   • Lista de milestones com progresso visual (barra aritmética)
//
// Padrão: window.renderTrophiesPage(container) + _renderBackHeader + router #trofeus

(function() {
  'use strict';

  function _s(str) {
    if (typeof window._safeHtml === 'function') return window._safeHtml(str);
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Helpers visuais ──────────────────────────────────────────────────────

  function _tierBadge(tier) {
    var map = { bronze: '🥉 Bronze', prata: '🥈 Prata', ouro: '🥇 Ouro', platina: '✨ Platina' };
    return map[tier] || tier || '';
  }

  function _tierStyle(tier) {
    var c = (window.TROPHY_TIER_COLORS || {})[tier];
    if (!c) return '';
    return 'background:' + c.bg + ';border:1px solid ' + c.border + ';box-shadow:0 0 8px ' + c.glow + ';';
  }

  function _tierTextStyle(tier) {
    var c = (window.TROPHY_TIER_COLORS || {})[tier];
    if (!c) return '';
    return 'color:' + c.text + ';font-weight:700;';
  }

  // ─── Renderiza card de troféu individual ─────────────────────────────────
  function _trophyCard(trophy, awarded, tier) {
    var locked = !awarded;
    var style = locked ? '' : _tierStyle(tier);
    var nameStyle = locked ? 'color:var(--text-muted);' : _tierTextStyle(tier);
    var lockIcon = locked ? '🔒 ' : '';
    var iconOpacity = locked ? 'opacity:0.35;' : '';
    var badgeHtml = (!locked && tier)
      ? '<div class="trophy-tier-badge" style="' + _tierTextStyle(tier) + 'font-size:0.7rem;margin-top:2px;">' + _tierBadge(tier) + '</div>'
      : '';
    var awardedHtml = (awarded && awarded.awardedAt)
      ? '<div class="trophy-awarded-date">Conquistado em ' + new Date(awarded.awardedAt).toLocaleDateString('pt-BR') + '</div>'
      : '';

    return '<div class="trophy-card ' + (locked ? 'trophy-locked' : 'trophy-earned') + '" ' +
           'style="' + style + '" ' +
           'title="' + _s(trophy.desc) + '">' +
      '<div class="trophy-card-icon" style="' + iconOpacity + '">' + (trophy.icon || '🏅') + '</div>' +
      '<div class="trophy-card-name" style="' + nameStyle + '">' + lockIcon + _s(trophy.title) + '</div>' +
      badgeHtml +
      '<div class="trophy-card-desc">' + _s(trophy.desc) + '</div>' +
      awardedHtml +
    '</div>';
  }

  // ─── Renderiza barra de progresso de milestone ───────────────────────────
  function _milestoneBar(milestone, currentValue, currentLevel) {
    currentValue = currentValue || 0;
    currentLevel = currentLevel || 0;

    var nextLevel = currentLevel + 1;
    var nextThreshold = window._milestoneThresholdAt
      ? window._milestoneThresholdAt(milestone, nextLevel)
      : (milestone.startAt + milestone.step * (nextLevel - 1));
    var prevThreshold = currentLevel > 0 && window._milestoneThresholdAt
      ? window._milestoneThresholdAt(milestone, currentLevel)
      : 0;

    var pct = 0;
    if (nextThreshold > prevThreshold) {
      pct = Math.min(100, Math.round(((currentValue - prevThreshold) / (nextThreshold - prevThreshold)) * 100));
    }
    if (currentValue >= nextThreshold) pct = 100;

    var tier = currentLevel > 0 && window._milestoneTierFromLevel
      ? window._milestoneTierFromLevel(currentLevel)
      : null;
    var nextTier = window._milestoneTierFromLevel ? window._milestoneTierFromLevel(nextLevel) : 'bronze';
    var tierC = (window.TROPHY_TIER_COLORS || {})[tier || 'bronze'] || {};
    var barColor = tierC.text || 'var(--primary-color)';
    var levelLabel = currentLevel > 0
      ? ('Nível ' + currentLevel + (tier ? ' · ' + _tierBadge(tier) : ''))
      : 'Ainda não iniciado';

    return '<div class="milestone-row">' +
      '<div class="milestone-header">' +
        '<span class="milestone-icon">' + (milestone.icon || '🏅') + '</span>' +
        '<span class="milestone-title">' + _s(milestone.titleFn ? milestone.titleFn(currentValue) : milestone.id) + '</span>' +
        '<span class="milestone-level">' + levelLabel + '</span>' +
      '</div>' +
      '<div class="milestone-progress">' +
        '<div class="milestone-bar-bg">' +
          '<div class="milestone-bar-fill" style="width:' + pct + '%;background:' + barColor + ';"></div>' +
        '</div>' +
        '<div class="milestone-progress-text">' +
          currentValue + ' / ' + nextThreshold +
          ' <span class="milestone-next-tier">→ ' + _tierBadge(nextTier) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ─── Renderiza ranking de amigos ─────────────────────────────────────────
  function _renderFriendRanking(containerId, entries, uid) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!entries || !entries.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 0;">Adicione amigos para ver o ranking!</p>';
      return;
    }

    var html = '<ol class="trophy-ranking-list">';
    entries.forEach(function(e, i) {
      var isMe = e.uid === uid;
      var medals = ['🥇', '🥈', '🥉'];
      var medal = medals[i] || (i + 1) + '.';
      var meStyle = isMe ? 'background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);' : '';
      html += '<li class="trophy-ranking-item" style="' + meStyle + '">' +
        '<span class="trophy-ranking-pos">' + medal + '</span>' +
        '<span class="trophy-ranking-name">' + _s(e.name) + (isMe ? ' <span style="color:var(--primary-color);">(você)</span>' : '') + '</span>' +
        '<span class="trophy-ranking-value">' + e.value + '</span>' +
      '</li>';
    });
    html += '</ol>';
    el.innerHTML = html;
  }

  // ─── Página principal ─────────────────────────────────────────────────────
  window.renderTrophiesPage = function(container) {
    if (!container) return;

    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) {
      container.innerHTML = window._renderBackHeader({ label: 'Voltar', href: '#dashboard',
        middleHtml: '<h2 style="font-size:1rem;font-weight:700;flex:1;text-align:center;margin:0;">🏅 Troféus</h2>'
      }) + '<div style="padding:24px;text-align:center;color:var(--text-muted);">Faça login para ver seus troféus.</div>';
      return;
    }

    var uid = cu.uid;

    var hdr = window._renderBackHeader({
      label: 'Voltar',
      href: '#dashboard',
      middleHtml: '<h2 style="font-size:1rem;font-weight:700;flex:1;text-align:center;margin:0;">🏅 Troféus & Conquistas</h2>'
    });

    // Esqueleto enquanto carrega
    container.innerHTML = hdr +
      '<div id="trophies-page-body" style="padding:16px;max-width:760px;margin:0 auto;">' +
        '<div style="text-align:center;padding:48px 0;color:var(--text-muted);">Carregando conquistas...</div>' +
      '</div>';

    // Carrega dados em paralelo
    Promise.all([
      (window._loadUserTrophies ? window._loadUserTrophies(uid) : Promise.resolve({ trophies: {}, milestones: {} })),
      (window._getUserTrophyStats ? window._getUserTrophyStats(uid) : Promise.resolve({}))
    ]).then(function(results) {
      var userTrophies = results[0].trophies || {};
      var userMilestones = results[0].milestones || {};
      var stats = results[1] || {};

      // XP e nível
      var xp = window._calcUserXP ? window._calcUserXP(uid) : 0;
      var level = window._xpToLevel ? window._xpToLevel(xp) : 1;
      var rankInfo = window._levelToRankLabel ? window._levelToRankLabel(level) : { label: 'Bronze', icon: '🥉', color: '#cd7f32' };
      var xpInLevel = xp % 100;
      var earnedCount = Object.keys(userTrophies).length;
      var totalCount = (window.TROPHY_CATALOG || []).length;

      // ── SEÇÃO: XP + nível ──────────────────────────────────────────────
      var xpHtml =
        '<div class="trophy-xp-card">' +
          '<div class="trophy-xp-rank">' +
            '<span style="font-size:2rem;">' + rankInfo.icon + '</span>' +
            '<div>' +
              '<div style="font-size:1.1rem;font-weight:800;color:' + rankInfo.color + ';">' + rankInfo.label + ' · Nível ' + level + '</div>' +
              '<div style="font-size:0.82rem;color:var(--text-muted);">' + xp + ' XP total</div>' +
            '</div>' +
          '</div>' +
          '<div class="trophy-xp-bar-wrap">' +
            '<div class="trophy-xp-bar"><div class="trophy-xp-fill" style="width:' + xpInLevel + '%"></div></div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">' + xpInLevel + '/100 XP para nível ' + (level+1) + '</div>' +
          '</div>' +
          '<div class="trophy-xp-stats">' +
            '<div class="trophy-xp-stat"><span class="trophy-xp-stat-val">' + earnedCount + '</span><span class="trophy-xp-stat-lbl">Troféus</span></div>' +
            '<div class="trophy-xp-stat"><span class="trophy-xp-stat-val">' + (totalCount - earnedCount) + '</span><span class="trophy-xp-stat-lbl">Faltando</span></div>' +
            '<div class="trophy-xp-stat"><span class="trophy-xp-stat-val">' + Math.round((earnedCount/Math.max(1,totalCount))*100) + '%</span><span class="trophy-xp-stat-lbl">Completado</span></div>' +
          '</div>' +
        '</div>';

      // ── SEÇÃO: Ranking de amigos ───────────────────────────────────────
      // Botão admin (só visível para rstbarth@gmail.com) para popular _rankStats
      var isAdmin = cu && cu.email === 'rstbarth@gmail.com';
      var adminSyncBtn = isAdmin
        ? '<button id="trophy-ranking-sync-btn" onclick="window._trophyRankingSync()" ' +
          'style="margin-top:10px;font-size:0.75rem;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:4px 0;text-decoration:underline;">' +
          '🔄 Sincronizar dados de ranking</button>'
        : '';

      var rankingHtml =
        '<div class="trophy-section">' +
          '<h3 class="trophy-section-title">👥 Ranking de Amigos</h3>' +
          '<div class="trophy-ranking-tabs">' +
            '<button class="btn btn-sm btn-outline ranking-tab-btn active" onclick="window._switchRankingTab(\'casualMatchesPlayed\')">Partidas</button>' +
            '<button class="btn btn-sm btn-outline ranking-tab-btn" onclick="window._switchRankingTab(\'checkinsTotal\')">Check-ins</button>' +
            '<button class="btn btn-sm btn-outline ranking-tab-btn" onclick="window._switchRankingTab(\'tournamentsEnrolled\')">Torneios</button>' +
          '</div>' +
          '<div id="trophy-ranking-container"><p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Carregando ranking...</p></div>' +
          adminSyncBtn +
        '</div>';

      // ── SEÇÃO: Troféus por categoria ───────────────────────────────────
      var categories = [
        { key: 'perfil',   label: '👤 Perfil' },
        { key: 'casual',   label: '⚡ Partidas Casuais' },
        { key: 'torneio',  label: '🏆 Torneios' },
        { key: 'presenca', label: '📍 Presença' },
        { key: 'social',   label: '👥 Social' },
        { key: 'especial', label: '🌟 Especiais' }
      ];

      var trophiesHtml = '<div class="trophy-section"><h3 class="trophy-section-title">🏅 Troféus</h3>';
      categories.forEach(function(cat) {
        var catTrophies = (window.TROPHY_CATALOG_BY_CATEGORY || {})[cat.key] || [];
        if (!catTrophies.length) return;
        trophiesHtml += '<div class="trophy-category">' +
          '<h4 class="trophy-category-title">' + cat.label + '</h4>' +
          '<div class="trophy-grid">';
        catTrophies.forEach(function(trophy) {
          var awarded = userTrophies[trophy.id];
          // Troféus hidden e não conquistados: não mostrar
          if (trophy.hidden && !awarded) return;
          var tier = awarded ? awarded.tier : null;
          trophiesHtml += _trophyCard(trophy, awarded, tier);
        });
        trophiesHtml += '</div></div>';
      });
      trophiesHtml += '</div>';

      // ── SEÇÃO: Milestones ──────────────────────────────────────────────
      var milestonesHtml = '<div class="trophy-section"><h3 class="trophy-section-title">📈 Marcos de Progresso</h3>' +
        '<p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 12px;">Progressão aritmética — cada passo tem o mesmo esforço.</p>';

      (window.MILESTONE_CATALOG || []).forEach(function(milestone) {
        var currentValue = stats[milestone.metric] || 0;
        var currentLevel = window._milestoneCurrentLevel
          ? window._milestoneCurrentLevel(milestone, currentValue)
          : 0;
        milestonesHtml += _milestoneBar(milestone, currentValue, currentLevel);
      });
      milestonesHtml += '</div>';

      // ── Monta página ───────────────────────────────────────────────────
      var body = document.getElementById('trophies-page-body');
      if (!body) return;
      body.innerHTML = xpHtml + rankingHtml + trophiesHtml + milestonesHtml;

      // Carrega ranking inicial (partidas casuais)
      window._currentRankingMetric = 'casualMatchesPlayed';
      _loadAndRenderRanking('casualMatchesPlayed', uid);
    }).catch(function(e) {
      var body = document.getElementById('trophies-page-body');
      if (body) body.innerHTML = '<p style="color:var(--text-muted);padding:24px;">Erro ao carregar conquistas.</p>';
    });
  };

  // ─── Troca de aba no ranking ──────────────────────────────────────────────
  window._switchRankingTab = function(metric) {
    window._currentRankingMetric = metric;
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu) return;

    // Atualiza visual das tabs
    document.querySelectorAll('.ranking-tab-btn').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf(metric) !== -1) {
        btn.classList.add('active');
      }
    });

    _loadAndRenderRanking(metric, cu.uid);
  };

  function _loadAndRenderRanking(metric, uid) {
    var container = document.getElementById('trophy-ranking-container');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Carregando...</p>';

    if (window._loadFriendRanking) {
      window._loadFriendRanking(metric).then(function(entries) {
        _renderFriendRanking('trophy-ranking-container', entries, uid);
      }).catch(function() {
        if (container) container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Sem dados de ranking.</p>';
      });
    }
  }

  // Expose helper para abrir diretamente da dashboard
  window._openTrophiesPage = function() {
    window.location.hash = '#trofeus';
  };

  // ─── Admin: sincroniza _rankStats para todos os usuários ─────────────────
  window._trophyRankingSync = function() {
    var btn = document.getElementById('trophy-ranking-sync-btn');
    if (btn) { btn.textContent = '⏳ Sincronizando...'; btn.disabled = true; }

    var fn = window.firebase && window.firebase.functions
      ? window.firebase.functions().httpsCallable('backfillAllUserTrophies')
      : null;

    if (!fn) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('Erro', 'Firebase Functions não disponível.', 'error');
      }
      if (btn) { btn.textContent = '🔄 Sincronizar dados de ranking'; btn.disabled = false; }
      return;
    }

    fn({}).then(function(result) {
      var d = result.data || {};
      if (typeof window.showNotification === 'function') {
        window.showNotification(
          '✅ Ranking sincronizado',
          'Processados: ' + (d.processed || '?') + ' usuários.',
          'success'
        );
      }
      // Recarrega o ranking atual
      var cu = window.AppStore && window.AppStore.currentUser;
      if (cu && window._currentRankingMetric) {
        _loadAndRenderRanking(window._currentRankingMetric, cu.uid);
      }
      if (btn) { btn.textContent = '✅ Sincronizado'; btn.disabled = true; }
    }).catch(function(e) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('Erro ao sincronizar', e.message || 'Tente novamente.', 'error');
      }
      if (btn) { btn.textContent = '🔄 Sincronizar dados de ranking'; btn.disabled = false; }
    });
  };

  console.log('[trophies-view] loaded');
})();
