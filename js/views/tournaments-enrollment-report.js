// scoreplace.app — v1.3.0-beta: Análise de Inscritos
// Modal pro organizador entender como os inscritos se distribuem nas
// categorias configuradas (gênero × habilidade × idade), receber sugestão
// de formato + tempo estimado por categoria, e ver quem tá com perfil
// incompleto pra justificar onde encaixar.
//
// Disponível pelo botão "📊 Análise" nas Ferramentas do Organizador,
// só renderiza quando há ≥ 1 inscrito.
//
// Limitação: birthDate vive só em users/{uid}, não no participantObj.
// Pra computar idade, fazemos N=#participantes leituras do Firestore na
// abertura do modal (em paralelo via Promise.all). Custo bounded — só
// dispara quando organizador abre o modal manualmente.

(function () {
  'use strict';

  // ─── Helpers de cálculo ──────────────────────────────────────────────

  function _computeAge(birthDateStr) {
    if (!birthDateStr) return null;
    var d = new Date(birthDateStr);
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 && age < 150 ? age : null;
  }

  // Retorna todas as faixas etárias (40+, 50+, ...) que o participante atende.
  function _ageBuckets(age, ageCats) {
    if (age == null || !ageCats || ageCats.length === 0) return [];
    var out = [];
    ageCats.forEach(function (cat) {
      var m = cat.match(/^(\d+)\+$/);
      if (m && age >= parseInt(m[1])) out.push(cat);
    });
    return out;
  }

  function _genderLabel(g) {
    return ({
      fem: 'Fem',
      masc: 'Masc',
      misto_aleatorio: 'Misto',
      misto_obrigatorio: 'Misto',
    })[g] || null;
  }

  // Decompõe "Fem A Duplas" em { gender:'Fem', skill:'A', gameType:'Duplas' }
  // Aceita também "Misto A", "Masc 40+", "A", etc.
  function _decomposeCat(cat, t) {
    if (!cat) return {};
    var skillCats = (t.skillCategories || []).slice().sort(function (a, b) { return b.length - a.length; });
    var ageCats = (t.ageCategories || []).slice();
    var gameTypes = ['Duplas', 'Simples'];
    var GENDER_PREFIXES = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.', 'Misto'];

    var rest = String(cat).trim();
    var out = { gender: null, skill: null, age: null, gameType: null };

    // Gender prefix
    for (var i = 0; i < GENDER_PREFIXES.length; i++) {
      var p = GENDER_PREFIXES[i];
      if (rest.indexOf(p + ' ') === 0 || rest === p) {
        out.gender = p.indexOf('Misto') === 0 ? 'Misto' : p;
        rest = rest.slice(p.length).trim();
        break;
      }
    }

    // GameType suffix
    for (var j = 0; j < gameTypes.length; j++) {
      var gt = gameTypes[j];
      if (rest.endsWith(' ' + gt) || rest === gt) {
        out.gameType = gt;
        rest = rest.slice(0, rest.length - gt.length).trim();
        break;
      }
    }

    // Skill match (longest first)
    for (var k = 0; k < skillCats.length; k++) {
      if (rest === skillCats[k]) { out.skill = skillCats[k]; rest = ''; break; }
    }
    // Age match
    if (!out.skill) {
      for (var a = 0; a < ageCats.length; a++) {
        if (rest === ageCats[a]) { out.age = ageCats[a]; rest = ''; break; }
      }
    }

    return out;
  }

  // ─── Sugestão de formato + tempo ─────────────────────────────────────

  // Calc # de partidas baseado no formato canônico mais provável pra N pessoas.
  // Não tenta replicar todo o _buildTimeEstimation (que considera gameDuration,
  // courtCount, callTime, warmupTime); usa defaults razoáveis (30min/partida,
  // 1 quadra) pra dar um número orientativo.
  function _suggestForCount(n, t) {
    var gameDur = parseInt(t && t.gameDuration) || 30;
    var courts = Math.max(parseInt(t && t.courtCount) || 1, 1);

    if (n < 2) return { format: '— insuficiente', desc: 'Precisa de pelo menos 2 inscritos.', matches: 0, durationMin: 0, color: '#64748b' };
    if (n === 2) return { format: 'Final única', desc: '1 partida (BO3).', matches: 1, durationMin: gameDur, color: '#a855f7' };

    if (n >= 3 && n <= 4) {
      var mLg = (n * (n - 1)) / 2;
      var slotsLg = Math.ceil(mLg / courts);
      return { format: 'Liga (round-robin)', desc: mLg + ' partidas.', matches: mLg, durationMin: slotsLg * gameDur, color: '#10b981' };
    }

    // 5+: prefere eliminatórias
    var nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    var rounds = Math.ceil(Math.log2(Math.max(n, 2)));
    var totalMin = 0;
    for (var r = 0; r < rounds; r++) {
      var matchesInRound = Math.ceil(n / Math.pow(2, r + 1));
      totalMin += Math.ceil(matchesInRound / courts) * gameDur;
    }

    if (n >= 5 && n <= 7) {
      return { format: 'Eliminatórias com BYEs', desc: 'Bracket de ' + nextPow2 + '. ' + (n - 1) + ' partidas. Considere Liga curta como alternativa.', matches: n - 1, durationMin: totalMin, color: '#f59e0b' };
    }

    if (n === 8) {
      return { format: 'Eliminatórias Simples', desc: 'Bracket de 8 cheio. 7 partidas.', matches: 7, durationMin: totalMin, color: '#3b82f6' };
    }

    if (n >= 9 && n <= 15) {
      return { format: 'Eliminatórias com BYEs ou Grupos+Elim', desc: 'Bracket de ' + nextPow2 + '. ' + (n - 1) + ' partidas (BYEs no R1).', matches: n - 1, durationMin: totalMin, color: '#3b82f6' };
    }

    if (n === 16) {
      return { format: 'Eliminatórias Simples', desc: 'Bracket de 16 cheio. 15 partidas.', matches: 15, durationMin: totalMin, color: '#3b82f6' };
    }

    return { format: 'Eliminatórias Simples ou Grupos+Elim', desc: 'Bracket de ' + nextPow2 + '. ' + (n - 1) + ' partidas (com BYEs).', matches: n - 1, durationMin: totalMin, color: '#3b82f6' };
  }

  function _fmtDuration(min) {
    if (!min || min <= 0) return '—';
    var h = Math.floor(min / 60);
    var m = Math.round(min % 60);
    if (h === 0) return m + 'min';
    if (m === 0) return h + 'h';
    return h + 'h' + (m < 10 ? '0' : '') + m;
  }

  // ─── Profile fetch ───────────────────────────────────────────────────

  function _fetchProfiles(uids) {
    if (!uids || uids.length === 0) return Promise.resolve({});
    if (!window.firebase || !firebase.firestore) return Promise.resolve({});
    var db = firebase.firestore();
    var out = {};
    var uniq = {};
    uids.forEach(function (u) { if (u) uniq[u] = 1; });
    var keys = Object.keys(uniq);
    var promises = keys.map(function (uid) {
      return db.collection('users').doc(uid).get()
        .then(function (doc) { if (doc.exists) out[uid] = doc.data(); })
        .catch(function () { /* swallow per-user error */ });
    });
    return Promise.all(promises).then(function () { return out; });
  }

  // ─── Build per-participant rows ──────────────────────────────────────

  function _buildRows(t, parts, profileMap) {
    var ageCats = (t.ageCategories || []).slice();
    var skillCats = (t.skillCategories || []).slice();

    return parts.map(function (p) {
      var uid = p && p.uid ? p.uid : null;
      var profile = uid ? profileMap[uid] : null;
      var gender = (p && p.gender) || (profile && profile.gender) || null;
      var birthDate = profile && profile.birthDate ? profile.birthDate : null;
      var age = _computeAge(birthDate);
      var ageBks = _ageBuckets(age, ageCats);

      // Categorias atribuídas (skill+gender combos) via inscrição
      var assigned = Array.isArray(p.categories) && p.categories.length > 0
        ? p.categories.slice()
        : (p.category ? [p.category] : []);

      // Quais skills estão presentes nas atribuições
      var assignedSkills = [];
      assigned.forEach(function (c) {
        var d = _decomposeCat(c, t);
        if (d.skill && assignedSkills.indexOf(d.skill) === -1) assignedSkills.push(d.skill);
      });

      var missing = [];
      if (!gender) missing.push('gênero');
      if (skillCats.length > 0 && assignedSkills.length === 0) missing.push('categoria de habilidade');
      if (ageCats.length > 0 && age == null) missing.push('data de nascimento');
      var hasUid = !!uid;
      if (!hasUid) missing.push('sem perfil scoreplace');

      return {
        name: p.displayName || p.name || (typeof p === 'string' ? p : '(sem nome)'),
        email: p.email || null,
        uid: uid,
        gender: gender,
        age: age,
        ageBuckets: ageBks,
        assigned: assigned,
        assignedSkills: assignedSkills,
        missing: missing,
        hasUid: hasUid,
      };
    });
  }

  // ─── Render helpers ──────────────────────────────────────────────────

  function _esc(s) {
    return (typeof window._safeHtml === 'function')
      ? window._safeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function _statPill(label, value, color) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;background:rgba(' + color + ',0.12);border:1px solid rgba(' + color + ',0.25);color:rgb(' + color + ');font-weight:600;font-size:0.78rem;">' + _esc(label) + ' <strong>' + value + '</strong></span>';
  }

  function _renderOverview(rows, t) {
    // Counts
    var totalEnrolled = rows.length;
    var byGender = { Fem: 0, Masc: 0, Misto: 0, sem: 0 };
    var bySkill = {};
    (t.skillCategories || []).forEach(function (s) { bySkill[s] = 0; });
    bySkill.sem = 0;
    var byAge = {};
    (t.ageCategories || []).forEach(function (a) { byAge[a] = 0; });
    byAge.sem = 0;
    var hasAge = (t.ageCategories || []).length > 0;
    var hasSkill = (t.skillCategories || []).length > 0;

    rows.forEach(function (r) {
      var gLabel = _genderLabel(r.gender) || 'sem';
      if (byGender[gLabel] != null) byGender[gLabel]++; else byGender.sem++;

      if (hasSkill) {
        if (r.assignedSkills.length > 0) {
          r.assignedSkills.forEach(function (s) {
            if (bySkill[s] != null) bySkill[s]++;
          });
        } else {
          bySkill.sem++;
        }
      }

      if (hasAge) {
        if (r.ageBuckets.length > 0) {
          r.ageBuckets.forEach(function (a) {
            if (byAge[a] != null) byAge[a]++;
          });
        } else {
          byAge.sem++;
        }
      }
    });

    var html = '<div style="background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.18); border-radius:12px; padding:14px 16px; margin-bottom:14px;">';
    html += '<p style="margin:0 0 10px;font-size:0.74rem;color:#a855f7;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📊 Visão Geral</p>';
    html += '<div style="font-size:0.95rem;color:var(--text-bright);font-weight:700;margin-bottom:8px;">' + totalEnrolled + ' inscrito' + (totalEnrolled === 1 ? '' : 's') + '</div>';

    // Gender row
    html += '<div style="margin-bottom:8px;"><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Por gênero</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    if (byGender.Fem > 0) html += _statPill('♀ Fem', byGender.Fem, '236,72,153');
    if (byGender.Masc > 0) html += _statPill('♂ Masc', byGender.Masc, '59,130,246');
    if (byGender.Misto > 0) html += _statPill('⚥ Misto', byGender.Misto, '168,85,247');
    if (byGender.sem > 0) html += _statPill('? Sem gênero', byGender.sem, '148,163,184');
    html += '</div></div>';

    // Skill row (if applicable)
    if (hasSkill) {
      html += '<div style="margin-bottom:8px;"><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Por habilidade</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      (t.skillCategories || []).forEach(function (s) {
        if (bySkill[s] > 0) html += _statPill(s, bySkill[s], '99,102,241');
      });
      if (bySkill.sem > 0) html += _statPill('? Sem categoria', bySkill.sem, '148,163,184');
      html += '</div></div>';
    }

    // Age row (if applicable)
    if (hasAge) {
      html += '<div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Por idade</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      (t.ageCategories || []).forEach(function (a) {
        if (byAge[a] > 0) html += _statPill(a, byAge[a], '245,158,11');
      });
      if (byAge.sem > 0) html += _statPill('? Sem data nasc.', byAge.sem, '148,163,184');
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function _renderCategoryTable(rows, t) {
    // Build category list: combinedCategories + age-cross-gender
    var combined = (t.combinedCategories || []).slice();
    var ageCats = (t.ageCategories || []).slice();
    var genders = (t.genderCategories || []).slice();
    var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto', misto_obrigatorio: 'Misto' };

    // Age × gender
    var ageCombined = [];
    if (ageCats.length > 0) {
      if (genders.length > 0) {
        // Use unique gender labels (Misto Aleat./Obrig. → Misto)
        var seen = {};
        genders.forEach(function (g) {
          var lbl = genderLabels[g] || g;
          if (!seen[lbl]) { seen[lbl] = 1; }
        });
        Object.keys(seen).forEach(function (lbl) {
          ageCats.forEach(function (a) { ageCombined.push(lbl + ' ' + a); });
        });
      } else {
        ageCombined = ageCats.slice();
      }
    }

    // Display name simplification (Misto Aleat./Obrig. → Misto)
    var dn = (typeof window._displayCategoryName === 'function') ? window._displayCategoryName : function (c) { return c; };

    // Count for each cat
    function countFor(cat) {
      var d = _decomposeCat(cat, t);
      if (d.age) {
        // Age-based cat: count rows whose ageBuckets includes d.age AND gender matches d.gender (if any)
        return rows.filter(function (r) {
          if (r.ageBuckets.indexOf(d.age) === -1) return false;
          if (d.gender) {
            var rGen = _genderLabel(r.gender) || '';
            if (rGen !== d.gender) return false;
          }
          return true;
        }).length;
      }
      // Skill-based cat: count rows whose assigned[] includes this exact cat (after dn collapse)
      var displayCat = dn(cat);
      return rows.filter(function (r) {
        var assignedDisplay = r.assigned.map(dn);
        return assignedDisplay.indexOf(displayCat) !== -1;
      }).length;
    }

    // Bucket by gender for visual grouping (same pattern as _updateCategoryPreview)
    var GENDER_ORDER = ['Fem', 'Masc', 'Misto', '_other'];
    var buckets = { Fem: [], Masc: [], Misto: [], _other: [] };

    function getBucket(displayName) {
      for (var i = 0; i < 3; i++) {
        var p = GENDER_ORDER[i];
        if (displayName === p || displayName.indexOf(p + ' ') === 0) return p;
      }
      return '_other';
    }

    var allCats = combined.concat(ageCombined);
    // Dedup
    var seenCat = {};
    var uniqueCats = [];
    allCats.forEach(function (c) {
      var k = dn(c);
      if (!seenCat[k]) { seenCat[k] = 1; uniqueCats.push(c); }
    });

    uniqueCats.forEach(function (c) {
      var displayC = dn(c);
      buckets[getBucket(displayC)].push({ cat: c, displayCat: displayC, count: countFor(c) });
    });

    if (uniqueCats.length === 0) {
      return '<div style="background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.18); border-radius:12px; padding:14px 16px; margin-bottom:14px;">' +
        '<p style="margin:0 0 8px;font-size:0.74rem;color:#818cf8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📋 Distribuição por Categoria</p>' +
        '<p style="font-size:0.85rem;color:var(--text-muted);margin:0;">Sem categorias configuradas neste torneio.</p>' +
        '</div>';
    }

    var html = '<div style="background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.18); border-radius:12px; padding:14px 16px; margin-bottom:14px;">';
    html += '<p style="margin:0 0 4px;font-size:0.74rem;color:#818cf8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📋 Distribuição por Categoria</p>';
    html += '<p style="font-size:0.7rem;color:var(--text-muted);margin:0 0 10px;">Cada linha = 1 categoria. Sugestão de formato e tempo são orientativos (defaults: 30min/partida, ' + Math.max(parseInt(t.courtCount) || 1, 1) + ' quadra' + ((Math.max(parseInt(t.courtCount) || 1, 1) > 1) ? 's' : '') + '). Inscritos podem aparecer em mais de uma categoria.</p>';

    // Render bucket-by-bucket
    GENDER_ORDER.forEach(function (b) {
      var items = buckets[b];
      if (items.length === 0) return;
      // Header
      var bLabel = (b === '_other') ? 'Sem gênero' : b;
      html += '<div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">' + _esc(bLabel) + '</div>';
      // Items
      items.forEach(function (it) {
        var sugg = _suggestForCount(it.count, t);
        var bgColor = sugg.color || '#64748b';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-top:4px;flex-wrap:wrap;">';
        // Cat name + count
        html += '<div style="display:flex;align-items:center;gap:8px;min-width:140px;flex:0 0 auto;">';
        html += '<span style="padding:3px 10px;background:rgba(' + (b === 'Misto' ? '168,85,247' : (b === 'Fem' ? '236,72,153' : (b === 'Masc' ? '59,130,246' : '148,163,184'))) + ',0.15);border:1px solid rgba(' + (b === 'Misto' ? '168,85,247' : (b === 'Fem' ? '236,72,153' : (b === 'Masc' ? '59,130,246' : '148,163,184'))) + ',0.30);border-radius:6px;font-size:0.78rem;color:var(--text-bright);font-weight:600;">' + _esc(it.displayCat) + '</span>';
        html += '<span style="font-size:0.92rem;font-weight:700;color:var(--text-bright);">' + it.count + '</span>';
        html += '<span style="font-size:0.7rem;color:var(--text-muted);">inscrito' + (it.count === 1 ? '' : 's') + '</span>';
        html += '</div>';
        // Format suggestion
        html += '<div style="flex:1;min-width:180px;font-size:0.78rem;color:' + bgColor + ';font-weight:600;">' + _esc(sugg.format) + '</div>';
        // Duration
        html += '<div style="font-size:0.78rem;color:var(--text-bright);font-weight:700;flex:0 0 auto;">' + (sugg.matches > 0 ? '⏱ ' + _fmtDuration(sugg.durationMin) : '—') + '</div>';
        html += '</div>';
        if (sugg.desc) {
          html += '<div style="font-size:0.7rem;color:var(--text-muted);margin:2px 0 0 12px;font-style:italic;">' + _esc(sugg.desc) + '</div>';
        }
      });
    });

    html += '</div>';
    return html;
  }

  function _renderIncomplete(rows) {
    var incompleteRows = rows.filter(function (r) { return r.missing.length > 0; });
    if (incompleteRows.length === 0) {
      return '<div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.20); border-radius:12px; padding:14px 16px;">' +
        '<p style="margin:0;font-size:0.78rem;color:#10b981;font-weight:600;">✅ Todos os ' + rows.length + ' inscrito' + (rows.length === 1 ? '' : 's') + ' tem perfil completo o suficiente pra serem categorizados.</p>' +
        '</div>';
    }

    var html = '<div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.18); border-radius:12px; padding:14px 16px;">';
    html += '<p style="margin:0 0 8px;font-size:0.74rem;color:#f87171;font-weight:700;text-transform:uppercase;letter-spacing:1px;">⚠️ Perfis Incompletos (' + incompleteRows.length + ')</p>';
    html += '<p style="font-size:0.7rem;color:var(--text-muted);margin:0 0 10px;">Esses inscritos não puderam ser encaixados em alguma das categorias por falta de informação no perfil.</p>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    incompleteRows.forEach(function (r) {
      html += '<div style="padding:7px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
      html += '<span style="font-weight:600;color:var(--text-bright);font-size:0.82rem;flex:0 0 auto;">' + _esc(r.name) + '</span>';
      html += '<span style="font-size:0.72rem;color:var(--text-muted);flex:1;min-width:150px;">falta: ' + r.missing.map(_esc).join(', ') + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '<p style="font-size:0.68rem;color:var(--text-muted);margin:10px 0 0;font-style:italic;">💡 Pra recolher esses dados, o organizador pode pedir aos inscritos que completem o perfil em scoreplace.app/#dashboard → 👤 perfil. Inscritos sem conta scoreplace só ficam categorizados quando alguém atribui manualmente em "🏷️ Categorias".</p>';
    html += '</div>';
    return html;
  }

  function _showLoading(t) {
    var existing = document.getElementById('enrollment-report-modal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'enrollment-report-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-dark);z-index:10020;overflow-y:auto;';
    var hdr = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({
        label: 'Voltar',
        middleHtml: '<div style="flex:1;text-align:center;font-weight:700;color:var(--text-bright);font-size:0.9rem;">📊 Análise de Inscritos</div>',
        onClickOverride: function () { overlay.remove(); },
      })
      : '';
    overlay.innerHTML = hdr +
      '<div style="max-width:760px;margin:0 auto;padding:1rem;">' +
      '<div style="text-align:center;padding:48px 12px;color:var(--text-muted);font-size:0.85rem;">⏳ Carregando perfis dos inscritos…</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('enrollment-report-open');
  }

  function _showReport(t, rows) {
    var overlay = document.getElementById('enrollment-report-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'enrollment-report-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-dark);z-index:10020;overflow-y:auto;';
      document.body.appendChild(overlay);
      document.body.classList.add('enrollment-report-open');
    }
    var hdr = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({
        label: 'Voltar',
        middleHtml: '<div style="flex:1;text-align:center;font-weight:700;color:var(--text-bright);font-size:0.9rem;">📊 Análise de Inscritos</div>',
        onClickOverride: function () { overlay.remove(); document.body.classList.remove('enrollment-report-open'); },
      })
      : '';

    var tName = _esc(t.name || 'Torneio');
    var subtitle = '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px;">' + tName + '</div>';

    overlay.innerHTML = hdr +
      '<div style="max-width:760px;margin:0 auto;padding:1rem;">' +
      subtitle +
      _renderOverview(rows, t) +
      _renderCategoryTable(rows, t) +
      _renderIncomplete(rows) +
      '</div>';
  }

  // ─── Public entry point ──────────────────────────────────────────────

  window._openEnrollmentReport = function (tId) {
    var t = window.AppStore && window.AppStore.tournaments
      ? window.AppStore.tournaments.find(function (x) { return x.id === tId; })
      : null;
    if (!t) {
      if (typeof showNotification === 'function') showNotification('Erro', 'Torneio não encontrado.', 'error');
      return;
    }
    var parts = Array.isArray(t.participants) ? t.participants : [];
    if (parts.length === 0) {
      if (typeof showNotification === 'function') showNotification('Sem inscritos', 'Nenhum inscrito ainda — adicione participantes ou aguarde inscrições.', 'info');
      return;
    }

    _showLoading(t);

    var uids = parts.filter(function (p) { return p && p.uid; }).map(function (p) { return p.uid; });
    _fetchProfiles(uids).then(function (profileMap) {
      var rows = _buildRows(t, parts, profileMap);
      _showReport(t, rows);
    }).catch(function (err) {
      console.error('[EnrollmentReport] erro:', err);
      // Fallback: render with empty profileMap (only gender from participantObj)
      var rows = _buildRows(t, parts, {});
      _showReport(t, rows);
    });
  };

})();
