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

  // v1.3.8-beta: faixa etária é MUTUAMENTE EXCLUSIVA — bucket único.
  // 52 anos com [40+, 50+, 60+, 70+] retorna ['50+'] (não 40+ também).
  // Algoritmo: ordena por threshold descendente, pega o primeiro que cabe.
  // Mantém retorno array (length 0 ou 1) pra preservar callsites existentes.
  function _ageBuckets(age, ageCats) {
    if (age == null || !ageCats || ageCats.length === 0) return [];
    var thresholds = ageCats.map(function (cat) {
      var m = cat.match(/^(\d+)\+$/);
      return m ? { cat: cat, val: parseInt(m[1]) } : null;
    }).filter(Boolean);
    thresholds.sort(function (a, b) { return b.val - a.val; }); // desc
    for (var i = 0; i < thresholds.length; i++) {
      if (age >= thresholds[i].val) return [thresholds[i].cat];
    }
    return [];
  }

  // v1.3.8-beta: aceita TANTO chaves curtas (fem/masc/misto_*) usadas em
  // t.genderCategories quanto strings completas (feminino/masculino/outro)
  // que o perfil salva via <select id="profile-edit-gender">. Antes só
  // conhecia as curtas — masculino caía em null e gerava "Sem gênero 1".
  function _genderLabel(g) {
    if (!g) return null;
    var key = String(g).toLowerCase().trim();
    var map = {
      fem: 'Fem',
      feminino: 'Fem',
      f: 'Fem',
      masc: 'Masc',
      masculino: 'Masc',
      m: 'Masc',
      misto: 'Misto',
      misto_aleatorio: 'Misto',
      misto_obrigatorio: 'Misto',
      // 'outro' / 'other' fica null — gênero não-binário não tem cat hoje
    };
    return map[key] || null;
  }

  // Decompõe "Fem A Duplas" em { gender:'Fem', skill:'A', gameType:'Duplas' }
  // Aceita também "Misto A", "Masc 40+", "A", etc.
  //
  // v1.3.8-beta: fallback pra defaults quando t.skillCategories ou
  // t.ageCategories estão vazios (modo derivado). Antes 'D' não era
  // reconhecido como skill quando torneio não tinha config — count caía
  // em zero. Defaults: skills=['A','B','C','D','FUN'], ages=[40+/50+/60+/70+].
  var _DEFAULT_SKILLS = ['A', 'B', 'C', 'D', 'FUN'];
  var _DEFAULT_AGES = ['40+', '50+', '60+', '70+'];

  function _decomposeCat(cat, t) {
    if (!cat) return {};
    var skillCatsRaw = (t && t.skillCategories && t.skillCategories.length > 0) ? t.skillCategories : _DEFAULT_SKILLS;
    var ageCatsRaw = (t && t.ageCategories && t.ageCategories.length > 0) ? t.ageCategories : _DEFAULT_AGES;
    var skillCats = skillCatsRaw.slice().sort(function (a, b) { return b.length - a.length; });
    var ageCats = ageCatsRaw.slice();
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
  //
  // v1.3.1-beta: profile (users/{uid}) é a fonte de verdade preferida pra
  // gênero/nome/foto — só cai no participantObj quando o uid não resolve ou
  // o profile fetch falhou. Antes o snapshot do enrollment vencia, o que
  // dava report stale quando usuário atualizava perfil depois.
  // BirthDate só vive no profile mesmo (não é capturado no participantObj),
  // então é sempre fresh.
  //
  // v1.3.2-beta: agora também lê profile.defaultCategory como skill derivado
  // quando o organizador não atribuiu manualmente via 🏷️ Categorias. Antes
  // só funcionava se o org tinha rodado a atribuição. Agora cai do auto:
  // perfil.defaultCategory='D' + profile.gender='masc' = inscrito conta como
  // 'Masc D' nas estatísticas.

  function _buildRows(t, parts, profileMap) {
    var ageCats = (t.ageCategories || []).slice();
    var skillCats = (t.skillCategories || []).slice();

    return parts.map(function (p) {
      var uid = p && p.uid ? p.uid : null;
      var profile = uid ? profileMap[uid] : null;
      // Profile vence — mantém report fresh quando user atualiza perfil
      // depois de se inscrever. Cai pra participantObj se profile não existe.
      var gender = (profile && profile.gender) || (p && p.gender) || null;
      var name = (profile && profile.displayName)
        || p.displayName || p.name
        || (typeof p === 'string' ? p : '(sem nome)');
      var email = (profile && profile.email) || p.email || null;
      var birthDate = profile && profile.birthDate ? profile.birthDate : null;
      var age = _computeAge(birthDate);
      var ageBks = _ageBuckets(age, ageCats);

      // Categorias atribuídas pelo organizador (manual via 🏷️ Categorias)
      var assigned = Array.isArray(p.categories) && p.categories.length > 0
        ? p.categories.slice()
        : (p.category ? [p.category] : []);

      // Quais skills estão presentes nas atribuições manuais
      var assignedSkills = [];
      assigned.forEach(function (c) {
        var d = _decomposeCat(c, t);
        if (d.skill && assignedSkills.indexOf(d.skill) === -1) assignedSkills.push(d.skill);
      });

      // v1.3.2-beta: skill derivado do perfil — cai aqui se o org não
      // atribuiu manualmente.
      // v1.3.6-beta: prioriza profile.skillBySport[t.sport] (habilidade
      // específica daquela modalidade). Fallback pra defaultCategory legacy.
      var profileSkill = null;
      if (profile && profile.skillBySport && typeof profile.skillBySport === 'object') {
        var tSport = t && t.sport ? String(t.sport).trim() : null;
        if (tSport && profile.skillBySport[tSport]) {
          profileSkill = String(profile.skillBySport[tSport]).trim();
        }
      }
      if (!profileSkill && profile && profile.defaultCategory) {
        profileSkill = String(profile.defaultCategory).trim();
      }

      // Skill efetivo: usa atribuição do org se houver, senão cai pro perfil
      var effectiveSkills = assignedSkills.length > 0
        ? assignedSkills
        : (profileSkill ? [profileSkill] : []);

      // v1.3.20-beta: missing[] reporta SEMPRE qualquer campo de perfil que
      // está vazio — não só os que o org configurou em t.ageCategories /
      // t.skillCategories. Antes, se o org não tinha categoria de idade
      // explicitamente, ninguém aparecia "faltando data de nascimento" mesmo
      // que 6 inscritos não tivessem nascimento cadastrado. Mesma coisa
      // habilidade. O report é "perfis incompletos" — relativo ao perfil em
      // si, não relativo à config atual do torneio.
      //
      // Para inscritos sem uid (org adicionou manualmente sem vincular conta),
      // não vale enumerar "gênero / idade / habilidade" um por um — todos
      // estão indisponíveis por construção. Mostra mensagem única clara,
      // direcionando o org pra ação correta.
      var missing = [];
      var hasUid = !!uid;
      if (!hasUid) {
        missing.push('adicionado manualmente — sem perfil vinculado');
      } else {
        if (!gender) missing.push('gênero');
        if (effectiveSkills.length === 0) missing.push('habilidade');
        if (age == null) missing.push('data de nascimento');
      }

      return {
        name: name,
        email: email,
        uid: uid,
        gender: gender,
        age: age,
        ageBuckets: ageBks,
        assigned: assigned,
        assignedSkills: assignedSkills,
        profileSkill: profileSkill,        // skill auto-declarado no perfil
        effectiveSkills: effectiveSkills,  // skill efetivo (assigned > profile)
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
    // v1.3.2-beta: pills sempre baseadas nos dados reais dos perfis, não
    // só nas categorias configuradas. Mostra todas as habilidades/idades
    // que realmente aparecem nos inscritos. Default ageBuckets = [40+, 50+,
    // 60+, 70+] quando t.ageCategories vazio (pra mostrar idade dos perfis
    // mesmo sem cat configurada).
    var totalEnrolled = rows.length;
    var byGender = { Fem: 0, Masc: 0, Misto: 0, sem: 0 };
    var bySkill = {};
    var byAge = {};
    var DEFAULT_AGE_CATS = ['40+', '50+', '60+', '70+'];
    var ageCats = (t.ageCategories && t.ageCategories.length > 0) ? t.ageCategories : DEFAULT_AGE_CATS;

    rows.forEach(function (r) {
      // Gender from profile (or fallback)
      var gLabel = _genderLabel(r.gender) || 'sem';
      if (byGender[gLabel] != null) byGender[gLabel]++; else byGender.sem++;

      // Skill: use effectiveSkills (assigned > profile.defaultCategory)
      if (r.effectiveSkills && r.effectiveSkills.length > 0) {
        r.effectiveSkills.forEach(function (s) {
          bySkill[s] = (bySkill[s] || 0) + 1;
        });
      } else {
        bySkill.sem = (bySkill.sem || 0) + 1;
      }

      // Age: bucket against default ageCats if t doesn't have any
      var bks = (r.age != null) ? _ageBuckets(r.age, ageCats) : [];
      if (bks.length > 0) {
        bks.forEach(function (a) {
          byAge[a] = (byAge[a] || 0) + 1;
        });
      } else {
        byAge.sem = (byAge.sem || 0) + 1;
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

    // Skill row — sempre mostra os skills que aparecem nos perfis
    var skillKeys = Object.keys(bySkill).filter(function (k) { return k !== 'sem' && bySkill[k] > 0; });
    // Ordena: priorizar t.skillCategories[] order, depois alfabético
    var skillOrder = (t.skillCategories || []).slice();
    skillKeys.sort(function (a, b) {
      var ai = skillOrder.indexOf(a), bi = skillOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    if (skillKeys.length > 0 || bySkill.sem > 0) {
      html += '<div style="margin-bottom:8px;"><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Por habilidade</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      skillKeys.forEach(function (s) {
        if (bySkill[s] > 0) html += _statPill(s, bySkill[s], '99,102,241');
      });
      if (bySkill.sem > 0) html += _statPill('? Sem habilidade', bySkill.sem, '148,163,184');
      html += '</div></div>';
    }

    // Age row — sempre mostra as idades que aparecem nos perfis
    var ageKeys = Object.keys(byAge).filter(function (k) { return k !== 'sem' && byAge[k] > 0; });
    // Ordena: pelo valor numérico (40+, 50+, ...)
    ageKeys.sort(function (a, b) {
      var na = parseInt(a) || 0, nb = parseInt(b) || 0;
      return na - nb;
    });
    if (ageKeys.length > 0 || byAge.sem > 0) {
      html += '<div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Por idade</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      ageKeys.forEach(function (a) {
        if (byAge[a] > 0) html += _statPill(a, byAge[a], '245,158,11');
      });
      if (byAge.sem > 0) html += _statPill('? Sem data nasc.', byAge.sem, '148,163,184');
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function _renderCategoryTable(rows, t) {
    // v1.3.2-beta: derivar categorias dos inscritos quando o organizador
    // não configurou. Lógica: se t tem combinedCategories + ageCategories,
    // usa. Senão, deriva do que aparece nos perfis (gender × skill,
    // gender × age).
    var combined = (t.combinedCategories || []).slice();
    var ageCats = (t.ageCategories || []).slice();
    var genders = (t.genderCategories || []).slice();
    var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto', misto_obrigatorio: 'Misto' };
    var hasOrgConfig = combined.length > 0 || ageCats.length > 0 || genders.length > 0;

    // Quando NÃO há configuração, derivar das presenças reais
    var derivedSource = false;
    if (!hasOrgConfig) {
      derivedSource = true;
      // Coletar gêneros únicos vistos nos perfis
      var seenGenders = {};
      var seenSkills = {};
      var seenAges = {};
      var DEFAULT_AGE_BUCKETS = ['40+', '50+', '60+', '70+'];
      rows.forEach(function (r) {
        var gLabel = _genderLabel(r.gender);
        if (gLabel) seenGenders[gLabel] = 1;
        (r.effectiveSkills || []).forEach(function (s) { seenSkills[s] = 1; });
        if (r.age != null) {
          _ageBuckets(r.age, DEFAULT_AGE_BUCKETS).forEach(function (a) { seenAges[a] = 1; });
        }
      });
      // Sintetizar combined cats (gender × skill) e age cats
      var gKeys = Object.keys(seenGenders);
      var sKeys = Object.keys(seenSkills);
      var aKeys = Object.keys(seenAges).sort(function (a, b) { return (parseInt(a) || 0) - (parseInt(b) || 0); });

      if (gKeys.length > 0 && sKeys.length > 0) {
        gKeys.forEach(function (g) {
          sKeys.forEach(function (s) { combined.push(g + ' ' + s); });
        });
      } else if (gKeys.length > 0) {
        combined = gKeys.slice();
      } else if (sKeys.length > 0) {
        combined = sKeys.slice();
      }
      ageCats = aKeys;
      // Genders pra cross com age
      genders = gKeys.slice(); // já em formato display ('Fem', 'Masc', 'Misto')
    }

    // Age × gender
    var ageCombined = [];
    if (ageCats.length > 0) {
      if (genders.length > 0) {
        // Use unique gender labels (Misto Aleat./Obrig. → Misto)
        var seen = {};
        genders.forEach(function (g) {
          var lbl = genderLabels[g] || g; // se já tá em display label, mantém
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
        // Age-based cat: count rows whose age fits d.age bucket AND gender matches d.gender (if any).
        // Use bucket against DEFAULT cats too (so derived ageCats work even when t.ageCategories empty).
        var DEFAULT_AGE = ['40+', '50+', '60+', '70+'];
        var ageCheckCats = (t.ageCategories && t.ageCategories.length > 0) ? t.ageCategories : DEFAULT_AGE;
        return rows.filter(function (r) {
          var bks = (r.age != null) ? _ageBuckets(r.age, ageCheckCats) : [];
          if (bks.indexOf(d.age) === -1) return false;
          if (d.gender) {
            var rGen = _genderLabel(r.gender) || '';
            if (rGen !== d.gender) return false;
          }
          return true;
        }).length;
      }
      // Skill-based cat: count rows whose effectiveSkills (assigned > profile.defaultCategory)
      // include d.skill AND gender matches d.gender (if any).
      // Fallback: legacy match against r.assigned[] (for cats without skill component).
      if (d.skill) {
        return rows.filter(function (r) {
          if ((r.effectiveSkills || []).indexOf(d.skill) === -1) return false;
          if (d.gender) {
            var rGen2 = _genderLabel(r.gender) || '';
            if (rGen2 !== d.gender) return false;
          }
          return true;
        }).length;
      }
      // Legacy / gender-only cat: count by display match in assigned[] OR by gender alone
      var displayCat = dn(cat);
      return rows.filter(function (r) {
        var assignedDisplay = r.assigned.map(dn);
        if (assignedDisplay.indexOf(displayCat) !== -1) return true;
        // Also match if cat is just a gender label and r.gender resolves to it
        var rGen3 = _genderLabel(r.gender) || '';
        return displayCat === rGen3;
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
        '<p style="font-size:0.85rem;color:var(--text-muted);margin:0;">Sem categorias configuradas e sem dados suficientes nos perfis dos inscritos pra derivar categorias automaticamente.</p>' +
        '</div>';
    }

    var html = '<div style="background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.18); border-radius:12px; padding:14px 16px; margin-bottom:14px;">';
    html += '<p style="margin:0 0 4px;font-size:0.74rem;color:#818cf8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📋 Distribuição por Categoria' + (derivedSource ? ' <span style="color:var(--text-muted);font-weight:500;text-transform:none;letter-spacing:0;font-size:0.66rem;">(sugeridas pelos perfis)</span>' : '') + '</p>';
    var subtxt = derivedSource
      ? 'Categorias derivadas automaticamente dos perfis dos inscritos (gênero × habilidade do perfil + idade computada da data de nascimento). Configure manualmente em ✏️ Editar → Categorias do Torneio se quiser fixar quais valem.'
      : 'Cada linha = 1 categoria. Sugestão de formato e tempo são orientativos (defaults: 30min/partida, ' + Math.max(parseInt(t.courtCount) || 1, 1) + ' quadra' + ((Math.max(parseInt(t.courtCount) || 1, 1) > 1) ? 's' : '') + '). Inscritos podem aparecer em mais de uma categoria.';
    html += '<p style="font-size:0.7rem;color:var(--text-muted);margin:0 0 10px;">' + subtxt + '</p>';

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
    if (rows.length === 0) {
      return '<div style="background:rgba(148,163,184,0.06); border:1px solid rgba(148,163,184,0.20); border-radius:12px; padding:14px 16px;">' +
        '<p style="margin:0;font-size:0.78rem;color:var(--text-muted);">📭 Sem inscritos ainda. As estatísticas acima vão aparecer assim que alguém se inscrever ou for adicionado pelo organizador.</p>' +
        '</div>';
    }
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
    // v1.3.20-beta: dois caminhos distintos pra resolver — explicar separados
    var hasNoUid = incompleteRows.some(function (r) { return !r.hasUid; });
    var hasUidGapsOnly = incompleteRows.some(function (r) { return r.hasUid; });
    html += '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:10px;display:flex;flex-direction:column;gap:6px;">';
    if (hasUidGapsOnly) {
      html += '<p style="margin:0;font-style:italic;">💡 <b>Inscritos com perfil:</b> peça que completem em scoreplace.app/#dashboard → 👤 perfil (gênero, data de nascimento e habilidade por modalidade).</p>';
    }
    if (hasNoUid) {
      html += '<p style="margin:0;font-style:italic;">📝 <b>Inscritos adicionados manualmente:</b> não têm perfil vinculado, então gênero/idade/habilidade ficam indisponíveis. Pra categorizá-los, atribua manualmente em "🏷️ Categorias", ou peça que se inscrevam direto pelo link de convite (criando perfil scoreplace).</p>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  // v1.3.9-beta: Análise de Inscritos é page-route (#analise/<tId>) — não
  // mais modal-overlay full-screen. Topbar fica visível (logo + nav +
  // hamburger). Padrão centralizado igual a #profile, #support, #privacy.
  // Compat: _openEnrollmentReport agora navega pra hash. _closeEnrollmentReport
  // navega pro #dashboard (preservando call-sites que esperam fechamento).

  function _closeReport() {
    if (window.location.hash.indexOf('#analise/') === 0) {
      window.location.hash = '#dashboard';
    }
  }
  window._closeEnrollmentReport = _closeReport;

  function _renderDiagnostic(t, rows, profileMap, parts) {
    // v1.3.2-beta: bloco diagnóstico pro organizador entender por que algum
    // inscrito não tá sendo categorizado. Mostra dados crus do torneio +
    // dados crus por inscrito (uid, profile fetched, gender resolvido,
    // age, effectiveSkills, missing). Só visível quando expandido.
    var html = '<details style="background:rgba(148,163,184,0.04);border:1px solid rgba(148,163,184,0.15);border-radius:10px;padding:8px 12px;margin-top:14px;font-size:0.72rem;color:var(--text-muted);">';
    html += '<summary style="cursor:pointer;font-weight:600;user-select:none;">🔧 Diagnóstico (dados crus do torneio + perfis)</summary>';
    html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
    html += '<div><b>Torneio.id:</b> <code>' + _esc(t.id) + '</code></div>';
    html += '<div><b>genderCategories:</b> <code>' + _esc(JSON.stringify(t.genderCategories || [])) + '</code></div>';
    html += '<div><b>skillCategories:</b> <code>' + _esc(JSON.stringify(t.skillCategories || [])) + '</code></div>';
    html += '<div><b>ageCategories:</b> <code>' + _esc(JSON.stringify(t.ageCategories || [])) + '</code></div>';
    html += '<div><b>combinedCategories:</b> <code>' + _esc(JSON.stringify(t.combinedCategories || [])) + '</code></div>';
    var profileKeys = profileMap ? Object.keys(profileMap) : [];
    html += '<div><b>Profiles fetched:</b> ' + profileKeys.length + ' / ' + parts.filter(function (p) { return p && p.uid; }).length + ' uids</div>';
    html += '<hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:6px 0;">';
    html += '<div style="font-weight:600;color:var(--text-bright);">Por inscrito:</div>';
    rows.forEach(function (r, i) {
      html += '<div style="padding:6px 8px;background:rgba(0,0,0,0.15);border-radius:6px;font-family:monospace;font-size:0.68rem;line-height:1.4;">';
      html += '<div><b>#' + (i + 1) + ' ' + _esc(r.name) + '</b></div>';
      html += '<div>uid: <code>' + _esc(r.uid || '(sem uid)') + '</code></div>';
      var p = parts[i];
      // v1.3.20-beta: mostra email + displayName + selfEnrolled — assim o
      // org distingue inscrição manual (sem email/uid) de auto-enroll que
      // perdeu o uid por algum motivo (raro).
      html += '<div>participantObj: name=<code>' + _esc((p && (p.displayName || p.name)) || '—') + '</code> email=<code>' + _esc((p && p.email) || '—') + '</code> selfEnrolled=<code>' + _esc((p && p.selfEnrolled) ? 'true' : 'false') + '</code></div>';
      html += '<div>participantObj: gender=<code>' + _esc((p && p.gender) || '—') + '</code> categories=<code>' + _esc(JSON.stringify((p && p.categories) || [])) + '</code></div>';
      var prof = r.uid ? profileMap[r.uid] : null;
      if (prof) {
        var skillMapStr = (prof.skillBySport && typeof prof.skillBySport === 'object')
          ? JSON.stringify(prof.skillBySport)
          : '—';
        html += '<div>profile: gender=<code>' + _esc(prof.gender || '—') + '</code> birthDate=<code>' + _esc(prof.birthDate || '—') + '</code> defaultCategory=<code>' + _esc(prof.defaultCategory || '—') + '</code></div>';
        html += '<div>profile.skillBySport: <code>' + _esc(skillMapStr) + '</code></div>';
        // v1.3.22-beta: timestamps + terms — distingue perfil alpha-leftover
        // (createdAt antes de 2026-04-29 OU acceptedTerms !== true) de
        // novato beta. Beta começou em 2026-04-29 com reset; users foram
        // preservados, então perfis alpha que nunca atualizaram pra fields
        // novos (gender/birthDate/skillBySport) ficam stale em torneios beta.
        var betaCutoff = '2026-04-29';
        var createdAt = prof.createdAt || '';
        var isPreBeta = createdAt && createdAt < betaCutoff;
        var noTerms = prof.acceptedTerms !== true;
        var stragglerFlag = '';
        if (isPreBeta && noTerms) {
          stragglerFlag = ' <span style="color:#fbbf24;font-weight:600;">🕰️ alpha-leftover (pre-beta + sem aceite)</span>';
        } else if (isPreBeta) {
          stragglerFlag = ' <span style="color:#fbbf24;font-weight:600;">🕰️ pré-beta (perfil pode estar stale)</span>';
        } else if (noTerms) {
          stragglerFlag = ' <span style="color:#fbbf24;font-weight:600;">⚠️ sem aceite de termos</span>';
        }
        html += '<div>profile.meta: createdAt=<code>' + _esc(createdAt || '—') + '</code> acceptedTerms=<code>' + _esc(prof.acceptedTerms === true ? 'true' : 'false') + '</code> acceptedTermsAt=<code>' + _esc(prof.acceptedTermsAt || '—') + '</code>' + stragglerFlag + '</div>';
      } else {
        html += '<div style="color:#f87171;">profile: NÃO carregado (uid não bate, doc não existe, ou rules block)</div>';
      }
      html += '<div>resolvido: gender=<code>' + _esc(r.gender || '—') + '</code> age=<code>' + _esc(r.age != null ? r.age : '—') + '</code> effectiveSkills=<code>' + _esc(JSON.stringify(r.effectiveSkills || [])) + '</code></div>';
      html += '<div>missing: <code>' + _esc(JSON.stringify(r.missing)) + '</code></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</details>';
    return html;
  }

  // v1.3.9-beta: render no view-container — page-route #analise/<tId>.
  // Topbar fica visível, _renderBackHeader cuida do cabeçalho com hamburger
  // funcional. Padrão centralizado (vide CLAUDE.md "REGRA CRITICA v1.3.5").
  function _renderPage(container, t, rows, profileMap, parts) {
    if (!container) return;
    var hdr = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({
        href: '#tournaments/' + t.id,
        label: 'Voltar',
        middleHtml: '<span style="font-size:0.88rem;font-weight:700;color:var(--text-bright);">📊 Análise de Inscritos</span>',
      })
      : '';

    var tName = _esc(t.name || 'Torneio');
    var subtitle = '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px;">' + tName + '</div>';

    container.innerHTML = hdr +
      '<div style="max-width:760px;margin:0 auto;padding:1rem;">' +
      subtitle +
      _renderOverview(rows, t) +
      _renderCategoryTable(rows, t) +
      _renderIncomplete(rows) +
      _renderDiagnostic(t, rows, profileMap || {}, parts || []) +
      '</div>';

    if (typeof window._reflowChrome === 'function') window._reflowChrome();
  }

  function _renderLoading(container, t) {
    if (!container) return;
    var hdr = (typeof window._renderBackHeader === 'function')
      ? window._renderBackHeader({
        href: '#tournaments/' + (t && t.id ? t.id : ''),
        label: 'Voltar',
        middleHtml: '<span style="font-size:0.88rem;font-weight:700;color:var(--text-bright);">📊 Análise de Inscritos</span>',
      })
      : '';
    container.innerHTML = hdr +
      '<div style="max-width:760px;margin:0 auto;padding:1rem;">' +
      '<div style="text-align:center;padding:48px 12px;color:var(--text-muted);font-size:0.85rem;">⏳ Carregando perfis dos inscritos…</div>' +
      '</div>';
    if (typeof window._reflowChrome === 'function') window._reflowChrome();
  }

  // ─── Public renderer ─ chamado pelo router ──────────────────────────
  // Padrão centralizado: igual a renderProfilePage / renderSupportPage etc.
  window.renderEnrollmentReportPage = function (container, tId) {
    var t = window.AppStore && window.AppStore.tournaments
      ? window.AppStore.tournaments.find(function (x) { return x.id === tId; })
      : null;
    if (!t) {
      if (typeof showNotification === 'function') showNotification('Erro', 'Torneio não encontrado.', 'error');
      window.location.replace('#dashboard');
      return;
    }
    var parts = Array.isArray(t.participants) ? t.participants : [];

    // Verifica se user é organizador — relatório é restrito.
    if (!window.AppStore || !window.AppStore.isOrganizer || !window.AppStore.isOrganizer(t)) {
      window.location.replace('#tournaments/' + tId);
      return;
    }

    _renderLoading(container, t);

    var uids = parts.filter(function (p) { return p && p.uid; }).map(function (p) { return p.uid; });
    _fetchProfiles(uids).then(function (profileMap) {
      // Re-checa se ainda na rota — user pode ter navegado fora durante o fetch
      if (window.location.hash !== '#analise/' + tId) return;
      var rows = _buildRows(t, parts, profileMap);
      console.log('[EnrollmentReport v1.3.9] profiles fetched:', Object.keys(profileMap).length, 'rows:', rows);
      _renderPage(container, t, rows, profileMap, parts);
    }).catch(function (err) {
      console.error('[EnrollmentReport] erro:', err);
      if (window.location.hash !== '#analise/' + tId) return;
      var rows = _buildRows(t, parts, {});
      _renderPage(container, t, rows, {}, parts);
    });
  };

  // Compat: preserva _openEnrollmentReport pra todos os call-sites antigos —
  // navega pra hash #analise/<tId> que dispara renderEnrollmentReportPage.
  window._openEnrollmentReport = function (tId) {
    if (!tId) return;
    window.location.hash = '#analise/' + tId;
  };

})();
