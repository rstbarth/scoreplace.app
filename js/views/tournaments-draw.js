// tournaments-draw.js — Draw generation & bracket building (extracted from tournaments.js)
(function() {

window.showFinalReviewPanel = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    const existing = document.getElementById('final-review-panel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'final-review-panel';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.9);backdrop-filter:blur(15px);z-index:99999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:2rem 0;';

    overlay.innerHTML = `
        <div style="background:var(--bg-card,#1e293b);width:94%;max-width:600px;border-radius:24px;border:1px solid rgba(34,197,94,0.3);box-shadow:0 30px 100px rgba(0,0,0,0.8);overflow:hidden;animation: modalFadeIn 0.3s ease-out;">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#14532d 0%,#22c55e 100%);padding:1.5rem 2rem;">
                <div style="display:flex;align-items:center;gap:15px;">
                    <span style="font-size:2.5rem;">🎉</span>
                    <div>
                        <h3 style="margin:0;color:#f0fdf4;font-size:1.25rem;font-weight:800;">Tudo Pronto para o Sorteio!</h3>
                        <p style="margin:4px 0 0;color:#bbf7d0;font-size:0.9rem;">Todas as verificações foram concluídas e resolvidas.</p>
                    </div>
                </div>
            </div>

            <div style="padding:2rem;">
                <!-- Summary Checklist -->
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:12px;background:rgba(34,197,94,0.1);padding:12px 15px;border-radius:12px;border:1px solid rgba(34,197,94,0.2);">
                        <span style="color:#22c55e;font-size:1.2rem;">✅</span>
                        <div style="flex:1;">
                            <div style="font-weight:700;color:white;font-size:0.9rem;">Inscrições Encerradas</div>
                            <div style="font-size:0.75rem;color:#94a3b8;">Nenhum novo participante pode entrar.</div>
                        </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;background:rgba(34,197,94,0.1);padding:12px 15px;border-radius:12px;border:1px solid rgba(34,197,94,0.2);">
                        <span style="color:#22c55e;font-size:1.2rem;">✅</span>
                        <div style="flex:1;">
                            <div style="font-weight:700;color:white;font-size:0.9rem;">Times Consolidados</div>
                            <div style="font-size:0.75rem;color:#94a3b8;">Todos os times estão completos ou resolvidos.</div>
                        </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;background:rgba(34,197,94,0.1);padding:12px 15px;border-radius:12px;border:1px solid rgba(34,197,94,0.2);">
                        <span style="color:#22c55e;font-size:1.2rem;">✅</span>
                        <div style="flex:1;">
                            <div style="font-weight:700;color:white;font-size:0.9rem;">Estrutura do Chaveamento</div>
                            <div style="font-size:0.75rem;color:#94a3b8;">A potência de 2 foi atingida via: <b>${window._safeHtml(t.p2Resolution || 'Natural')}</b></div>
                        </div>
                    </div>
                </div>

                <!-- History / Log -->
                <div style="margin-bottom:2rem;">
                    <h4 style="margin:0 0 10px;color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;">Histórico de Resoluções:</h4>
                    <div style="background:rgba(0,0,0,0.2);border-radius:16px;padding:1rem;max-height:120px;overflow-y:auto;font-family:monospace;font-size:0.8rem;color:#cbd5e1;">
                        ${(t.history || []).slice().reverse().map(log => `
                            <div style="margin-bottom:6px;display:flex;gap:10px;">
                                <span style="color:#64748b;">[${new Date(log.date).toLocaleTimeString()}]</span>
                                <span>${window._safeHtml(log.message)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button onclick="window.generateDrawFunction('${String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" style="background:linear-gradient(135deg,#16a34a,#22c55e);color:white;border:none;padding:15px;border-radius:16px;font-weight:800;font-size:1.1rem;cursor:pointer;box-shadow:0 10px 30px rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center;gap:10px;">
                        <span>🎲</span> Rodar Sorteio Agora
                    </button>
                    <button onclick="document.getElementById('final-review-panel').remove();" style="background:rgba(255,255,255,0.05);color:#94a3b8;border:none;padding:12px;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer;">
                        Voltar e Revisar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};


window.generateDrawFunction = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    // ── Proteção contra re-sorteio acidental ────────────────────────
    var _hasExistingDraw = (Array.isArray(t.matches) && t.matches.length > 0) ||
        (Array.isArray(t.rounds) && t.rounds.length > 0) ||
        (Array.isArray(t.groups) && t.groups.length > 0);
    if (_hasExistingDraw) {
        // Check if any match has a result recorded
        var _hasResults = false;
        if (Array.isArray(t.matches)) {
            _hasResults = t.matches.some(function(m) { return m.winner || m.score1 || m.score2; });
        }
        if (!_hasResults && Array.isArray(t.rounds)) {
            _hasResults = t.rounds.some(function(r) {
                return (r.matches || []).some(function(m) { return m.winner || m.score1 || m.score2; });
            });
        }
        if (_hasResults) {
            showAlertDialog('Sorteio já realizado',
                'Este torneio já possui partidas com resultados registrados. Refazer o sorteio apagará todos os resultados. Esta ação não pode ser desfeita.',
                function() {
                    // User confirmed — allow redraw by clearing existing data
                    t.matches = [];
                    t.rounds = [];
                    t.groups = [];
                    t.standings = null;
                    window.generateDrawFunction(tId);
                },
                { type: 'danger', confirmText: 'Refazer Sorteio', cancelText: 'Cancelar' }
            );
            return;
        }
        // Draw exists but no results yet — warn but lighter
        showAlertDialog('Refazer Sorteio?',
            'O sorteio já foi realizado. Deseja refazer? As partidas atuais serão substituídas.',
            function() {
                t.matches = [];
                t.rounds = [];
                t.groups = [];
                t.standings = null;
                window.generateDrawFunction(tId);
            },
            { type: 'warning', confirmText: 'Refazer', cancelText: 'Manter Atual' }
        );
        return;
    }

    // Store active tournament ID for views that need it
    window._lastActiveTournamentId = tId;

    // ── Verificação de times incompletos (antes da potência de 2) ────
    const _teamSize = parseInt(t.teamSize) || 1;
    if (_teamSize > 1 && !t.incompleteTeamResolved) {
        const _parts = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
        let _individuals = 0;
        let _preFormedTeams = 0;
        _parts.forEach(p => {
            const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
            if (name.includes(' / ')) _preFormedTeams++;
            else _individuals++;
        });
        const _remainder = _individuals % _teamSize;
        if (_remainder > 0) {
            window._showIncompleteTeamDialog(tId, _remainder, _teamSize, _individuals, _preFormedTeams);
            return;
        }
    }

    // ── Verificação de número ímpar (formatos não-eliminatórios) ──────
    const isElim = t.format === 'Eliminatórias Simples' || t.format === 'Dupla Eliminatória';
    if (!isElim && !t.oddResolution && typeof window.checkOddEntries === 'function') {
        const oddInfo = window.checkOddEntries(t);
        if (oddInfo.isOdd) {
            window.showOddEntriesPanel(tId);
            return;
        }
    }

    // ── Verificação de potência de 2 para eliminatórias ──────────────
    if (isElim && !t.p2Resolution) {
        const info = window.checkPowerOf2(t);
        if (info.count < 2) {
            const _label = (info.teamSize > 1) ? 'times' : 'participantes';
            showAlertDialog('Inscritos Insuficientes', `São necessários pelo menos 2 ${_label} para realizar o sorteio.`, null, { type: 'warning' });
            return;
        }
        if (!info.isPowerOf2) {
            window.showPowerOf2Panel(tId);
            return;
        }
    }

    // ── Validação: participantes sem categoria (quando torneio tem categorias) ─
    var _tournHasCats = Array.isArray(t.combinedCategories) && t.combinedCategories.length > 0;
    if (_tournHasCats) {
        var _allParts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
        var _noCat = _allParts.filter(function(p) {
            if (typeof p !== 'object') return true;
            var cats = window._getParticipantCategories(p);
            return cats.length === 0;
        });
        if (_noCat.length > 0) {
            var _names = _noCat.map(function(p) {
                return typeof p === 'string' ? p : (p.displayName || p.name || '?');
            }).slice(0, 5).join(', ');
            var _extra = _noCat.length > 5 ? ' e mais ' + (_noCat.length - 5) + '...' : '';
            showAlertDialog('Participantes sem Categoria',
                _noCat.length + ' participante(s) ainda não têm categoria atribuída: ' + _names + _extra +
                '\n\nUse o Gerenciador de Categorias para atribuir antes do sorteio, ou prossiga (serão incluídos na primeira categoria).',
                function() {
                    // User chose to proceed anyway — continue draw
                    t._skipCatValidation = true;
                    window.generateDrawFunction(tId);
                },
                { type: 'warning', confirmText: 'Prosseguir', cancelText: 'Voltar' }
            );
            if (!t._skipCatValidation) return;
            delete t._skipCatValidation;
        }
    }

    // ── Pergunta de divulgação do sorteio ─────────────────────────────
    if (!t.drawVisibility) {
        window._showDrawVisibilityDialog(tId);
        return;
    }

    // ── Liga / Suíço / Ranking: generate first round standings ──────────────────
    if (window._isLigaFormat(t) || t.format === 'Suíço Clássico') {
        let participants = Array.isArray(t.participants) ? [...t.participants] : Object.values(t.participants || {});

        // Shuffle participants
        for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
        }

        // Initialize standings (with category if applicable)
        t.standings = participants.map(p => {
            const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
            var entry = { name, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
            if (typeof p === 'object') {
                var _pcs = window._getParticipantCategories(p);
                if (_pcs.length > 0) { entry.category = _pcs[0]; entry.categories = _pcs; }
            }
            return entry;
        });
        t.rounds = [];
        t.status = 'active';

        // Generate first round using Swiss pairing (respects categories automatically)
        _generateNextRound(t);

        window.AppStore.logAction(tId, `Sorteio Realizado — ${t.format}: Rodada 1 gerada com ${t.rounds[0].matches.length} partida(s)`);

        if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();
        showNotification('Torneio Iniciado', `Rodada 1 gerada com ${t.rounds[0].matches.length} partida(s)!`, 'success');
        // Save immediately to Firestore, then navigate
        window.AppStore.syncImmediate(tId).then(function() {
            window.location.hash = `#bracket/${tId}`;
        });
        return;
    }

    // ── Rei/Rainha da Praia ──────────────────────────────────────────
    if (t.format === 'Rei/Rainha da Praia') {
        let participants = Array.isArray(t.participants) ? [...t.participants] : Object.values(t.participants || {});
        const getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name || '');

        // Shuffle
        for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
        }

        if (participants.length < 4) {
            showAlertDialog(_t('monarch.minParticipantsTitle'), _t('monarch.minParticipants'), null, { type: 'warning' });
            return;
        }

        const numGroups = Math.floor(participants.length / 4);
        const remainder = participants.length % 4;
        const groups = [];
        const ts = Date.now();

        for (let g = 0; g < numGroups; g++) {
            const players = [getName(participants[g*4]), getName(participants[g*4+1]), getName(participants[g*4+2]), getName(participants[g*4+3])];
            const [A, B, C, D] = players;
            groups.push({
                name: _t('label.group') + ' ' + String.fromCharCode(65 + g),
                players: players,
                rounds: [{
                    round: 1, status: 'active',
                    matches: [
                        { id: 'monarch-g'+g+'-m0-'+ts, team1:[A,B], team2:[C,D], p1:A+' / '+B, p2:C+' / '+D, scoreP1:null, scoreP2:null, winner:null, group:g, matchIndex:0, isMonarch:true },
                        { id: 'monarch-g'+g+'-m1-'+ts, team1:[A,C], team2:[B,D], p1:A+' / '+C, p2:B+' / '+D, scoreP1:null, scoreP2:null, winner:null, group:g, matchIndex:1, isMonarch:true },
                        { id: 'monarch-g'+g+'-m2-'+ts, team1:[A,D], team2:[B,C], p1:A+' / '+D, p2:B+' / '+C, scoreP1:null, scoreP2:null, winner:null, group:g, matchIndex:2, isMonarch:true }
                    ]
                }],
                individualStandings: players.map(function(n) { return { name:n, wins:0, losses:0, pointsFor:0, pointsAgainst:0, played:0 }; })
            });
        }

        // Remainder players join last group (5-player group with more rotations) or show warning
        if (remainder > 0) {
            showNotification('Aviso', remainder + ' jogador(es) não formam grupo de 4. Recomendamos ajustar para múltiplos de 4.', 'warning');
        }

        t.groups = groups;
        t.currentStage = 'groups';
        t.status = 'active';
        window.AppStore.logAction(tId, _t('monarch.drawDone') + ' — ' + numGroups + ' grupos de 4');

        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t).then(function() {
                showNotification(_t('monarch.drawDone'), _t('monarch.groupsFormed', {count: numGroups}), 'success');
                window.location.hash = '#bracket/' + tId;
            });
        } else {
            window.FirestoreDB.saveTournament(t);
            showNotification(_t('monarch.drawDone'), _t('monarch.groupsFormed', {count: numGroups}), 'success');
            window.location.hash = '#bracket/' + tId;
        }
        return;
    }

    // ── Fase de Grupos + Eliminatórias ──────────────────────────────
    if (t.format === 'Fase de Grupos + Eliminatórias') {
        let participants = Array.isArray(t.participants) ? [...t.participants] : Object.values(t.participants || {});
        const getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name || '');

        // Shuffle
        for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [participants[i], participants[j]] = [participants[j], participants[i]];
        }

        const numGroups = t.gruposCount || 4;
        const classifiedPerGroup = t.gruposClassified || 2;

        // Distribute participants into groups (snake draft)
        const groups = Array.from({ length: numGroups }, (_, i) => ({
            name: `${_t('label.group')} ${String.fromCharCode(65 + i)}`,
            participants: [],
            standings: [],
            rounds: []
        }));

        participants.forEach((p, idx) => {
            groups[idx % numGroups].participants.push(getName(p));
        });

        // Generate round-robin matches within each group
        groups.forEach((g, gi) => {
            const players = g.participants;
            const n = players.length;
            // Round-robin: each pair plays once
            const matchesForGroup = [];
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    matchesForGroup.push({
                        id: `grp${gi}-m${i}v${j}-${Date.now()}`,
                        p1: players[i],
                        p2: players[j],
                        winner: null,
                        group: gi,
                        label: `${window._safeHtml(g.name)} • ${window._safeHtml(players[i])} vs ${window._safeHtml(players[j])}`
                    });
                }
            }
            // Split into rounds (n-1 rounds for even, n rounds for odd)
            const roundCount = n % 2 === 0 ? n - 1 : n;
            const matchesPerRound = Math.floor(n / 2);
            const assigned = new Set();
            for (let r = 0; r < roundCount; r++) {
                const roundMatches = [];
                matchesForGroup.forEach(m => {
                    if (assigned.has(m.id)) return;
                    if (roundMatches.length >= matchesPerRound) return;
                    const playersInRound = roundMatches.flatMap(rm => [rm.p1, rm.p2]);
                    if (playersInRound.includes(m.p1) || playersInRound.includes(m.p2)) return;
                    m.roundIndex = g.rounds.length + r;
                    roundMatches.push(m);
                    assigned.add(m.id);
                });
                if (roundMatches.length > 0) {
                    g.rounds.push({
                        round: r + 1,
                        status: r === 0 ? 'active' : 'pending',
                        matches: roundMatches
                    });
                }
            }
            // Any remaining unassigned matches go into extra rounds
            const remaining = matchesForGroup.filter(m => !assigned.has(m.id));
            if (remaining.length > 0) {
                g.rounds.push({
                    round: g.rounds.length + 1,
                    status: 'pending',
                    matches: remaining
                });
            }

            // Initialize standings
            g.standings = players.map(name => ({
                name, points: 0, wins: 0, losses: 0, draws: 0, pointsDiff: 0, played: 0
            }));
        });

        t.groups = groups;
        t.gruposClassified = classifiedPerGroup;
        t.currentStage = 'groups';
        t.status = 'active';

        window.AppStore.logAction(tId, `Sorteio Realizado — ${numGroups} grupos criados com rodízio interno`);

        if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();
        showNotification('Fase de Grupos Iniciada', `${numGroups} grupos gerados!`, 'success');
        window.AppStore.syncImmediate(tId).then(function() {
            window.location.hash = `#bracket/${tId}`;
        });
        return;
    }

    let participants = Array.isArray(t.participants) ? [...t.participants] : Object.values(t.participants || {});

    // --- ETAPA 1: Formação de Times (quando teamSize > 1) ---
    let teamSize = parseInt(t.teamSize) || 1;
    // Fallback: se modo de inscrição é time/misto mas teamSize ficou 1, forçar mínimo 2
    const enrMode = t.enrollmentMode || t.enrollment || 'individual';
    if ((enrMode === 'time' || enrMode === 'misto') && teamSize < 2) {
        teamSize = 2;
    }
    if (teamSize > 1) {
        let individuals = [];
        let preFormedTeams = [];

        participants.forEach(p => {
            const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
            if (name.includes(' / ')) {
                preFormedTeams.push(name);
            } else {
                individuals.push(name);
            }
        });

        // Embaralha individuais antes de agrupar em times
        for (let i = individuals.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [individuals[i], individuals[j]] = [individuals[j], individuals[i]];
        }

        let newTeams = [];
        while (individuals.length >= teamSize) {
            const group = individuals.splice(0, teamSize);
            newTeams.push(group.join(' / '));
        }

        // Registrar origem: equipes sorteadas
        if (!t.teamOrigins) t.teamOrigins = {};
        newTeams.forEach(tn => { t.teamOrigins[tn] = 'sorteada'; });

        // Resultado: times pré-formados + novos times sorteados + sobras
        participants = [...preFormedTeams, ...newTeams, ...individuals];

        // Salvar os times formados no torneio para referência
        t.participants = participants;

        if (newTeams.length > 0) {
            window.AppStore.logAction(tId, `Sorteio de times: ${newTeams.length} time(s) de ${teamSize} formado(s) aleatoriamente`);
        }
        if (individuals.length > 0) {
            window.AppStore.logAction(tId, `${individuals.length} jogador(es) sem time completo (sobra)`);
        }
    }

    // 1. Shuffling agora é feito por categoria dentro do loop de geração de matches

    // 2. Handle Swiss/Classificatória
    if (t.p2Resolution === 'swiss') {
        t.status = 'active';
        t.currentStage = 'swiss';
        showNotification('Sucesso', 'Fase Classificatória (Suíço) Iniciada!', 'success');
        window.AppStore.syncImmediate(tId).then(function() {
            window.location.hash = `#tournaments/${tId}`;
        });
        return;
    }

    // 3. Handle Elimination (Simples/Dupla)
    let matches = [];
    const timestamp = Date.now();
    const isDupla = t.format === 'Dupla Eliminatória';
    const getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name);

    // ── Agrupar por categoria (se houver) ───────────────────────────
    var _hasCats = Array.isArray(t.combinedCategories) && t.combinedCategories.length > 0;
    var _catGroups = {};
    if (_hasCats) {
        // Build map: category → [participants]
        t.combinedCategories.forEach(function(cat) { _catGroups[cat] = []; });
        participants.forEach(function(p) {
            var pCats = (typeof p === 'object') ? window._getParticipantCategories(p) : [];
            if (pCats.length > 0) {
                pCats.forEach(function(c) {
                    if (_catGroups[c]) _catGroups[c].push(p);
                });
            } else {
                // Participante sem categoria: incluir no primeiro grupo (fallback)
                var firstCat = t.combinedCategories[0];
                _catGroups[firstCat].push(p);
            }
        });
        // Remove categorias vazias
        t.combinedCategories.forEach(function(cat) {
            if (_catGroups[cat].length === 0) delete _catGroups[cat];
        });
    } else {
        _catGroups[''] = participants;
    }

    // ── Gerar chaveamento para cada categoria ───────────────────────
    var _matchCounter = 0;
    Object.keys(_catGroups).forEach(function(catName) {
        var catParticipants = _catGroups[catName];

        // Shuffle dentro da categoria
        if (!t.p2OrderedList) {
            for (var si = catParticipants.length - 1; si > 0; si--) {
                var sj = Math.floor(Math.random() * (si + 1));
                var tmp = catParticipants[si];
                catParticipants[si] = catParticipants[sj];
                catParticipants[sj] = tmp;
            }
        }

        // BYE handling por categoria
        if (t.p2Resolution === 'bye') {
            var catLen = catParticipants.length;
            var catTarget = 1;
            while (catTarget < catLen) catTarget *= 2;
            var catByes = catTarget - catLen;
            for (var bi = 0; bi < catByes; bi++) {
                catParticipants.push('BYE (Avança Direto)');
            }
            // VIP priority for BYEs
            if (catByes > 0) {
                var _vips = t.vips || {};
                var _gn = function(p) { return typeof p === 'string' ? p : (p.displayName || p.name || ''); };
                var byeIdx = [];
                catParticipants.forEach(function(p, i) { if (_gn(p) === 'BYE (Avança Direto)') byeIdx.push(i); });
                var vipIdx = [];
                catParticipants.forEach(function(p, i) {
                    var nm = _gn(p);
                    if (nm !== 'BYE (Avança Direto)' && _vips[nm]) vipIdx.push(i);
                });
                var vi = 0;
                for (var bii = 0; bii < byeIdx.length && vi < vipIdx.length; bii++) {
                    var byePos = byeIdx[bii];
                    if (byePos % 2 === 1) {
                        var pairPos = byePos - 1;
                        var curP1 = _gn(catParticipants[pairPos]);
                        if (!_vips[curP1]) {
                            var viPos = vipIdx[vi];
                            if (viPos !== pairPos) {
                                var swp = catParticipants[pairPos];
                                catParticipants[pairPos] = catParticipants[viPos];
                                catParticipants[viPos] = swp;
                            }
                            vi++;
                        }
                    }
                }
            }
        }

        // ── Play-in (Repescagem) handling with cross-seeding ──────────
        if (t.p2Resolution === 'playin') {
            var catLen = catParticipants.length;
            var catTarget = 1;
            while (catTarget < catLen) catTarget *= 2;
            // catTarget is the UPPER power of 2; we want the LOWER one
            var catLo = catTarget / 2;
            if (catLo < 1) catLo = 1;
            // If already a power of 2, skip play-in
            if (catLen > catLo && catLo >= 2) {
                var excess = catLen - catLo;
                // Play-in: last (excess * 2) participants play round 0
                var playinParticipants = catParticipants.splice(catLen - (excess * 2));
                // catParticipants now has (catLen - excess*2) = direct-seeded participants

                // Generate play-in matches (round 0)
                var playinMatchIds = [];
                for (var pi = 0; pi < playinParticipants.length; pi += 2) {
                    var pp1 = playinParticipants[pi];
                    var pp2 = pi + 1 < playinParticipants.length ? playinParticipants[pi + 1] : null;
                    if (!pp2) break;
                    var playinMatch = {
                        id: 'match-playin-' + timestamp + '-' + _matchCounter,
                        round: 0,
                        bracket: isDupla ? 'upper' : undefined,
                        p1: getName(pp1),
                        p2: getName(pp2),
                        winner: null,
                        isPlayin: true
                    };
                    if (catName) playinMatch.category = catName;
                    matches.push(playinMatch);
                    playinMatchIds.push(playinMatch.id);
                    _matchCounter++;
                }

                // Round 1 cross-seeding: pair play-in winners (TBD) vs direct-seeded
                // Build slot arrays
                var directSlots = catParticipants.map(function(p) { return getName(p); });
                var playinSlots = playinMatchIds.map(function(mId) { return { tbd: true, fromPlayinMatch: mId }; });

                // Cross-seed: alternate direct vs play-in winner
                var r1Pairs = [];
                var dIdx = 0, pIdx = 0;
                while (dIdx < directSlots.length && pIdx < playinSlots.length) {
                    r1Pairs.push({ p1: directSlots[dIdx], p2: playinSlots[pIdx] });
                    dIdx++;
                    pIdx++;
                }
                // Remaining direct vs direct
                while (dIdx + 1 < directSlots.length) {
                    r1Pairs.push({ p1: directSlots[dIdx], p2: directSlots[dIdx + 1] });
                    dIdx += 2;
                }
                // Remaining play-in vs play-in (unlikely but safe)
                while (pIdx + 1 < playinSlots.length) {
                    r1Pairs.push({ p1: playinSlots[pIdx], p2: playinSlots[pIdx + 1] });
                    pIdx += 2;
                }
                // If one direct left over, BYE
                if (dIdx < directSlots.length) {
                    r1Pairs.push({ p1: directSlots[dIdx], p2: null });
                    dIdx++;
                }

                // Generate R1 matches from pairs and link play-in matches
                for (var ri = 0; ri < r1Pairs.length; ri++) {
                    var pair = r1Pairs[ri];
                    var r1p1 = typeof pair.p1 === 'string' ? pair.p1 : 'TBD';
                    var r1p2 = pair.p2 === null ? 'BYE (Avança Direto)' : (typeof pair.p2 === 'string' ? pair.p2 : 'TBD');
                    var isBye1 = r1p2 === 'BYE (Avança Direto)';
                    var r1Match = {
                        id: 'match-' + timestamp + '-' + _matchCounter,
                        round: 1,
                        bracket: isDupla ? 'upper' : undefined,
                        p1: r1p1,
                        p2: r1p2,
                        winner: isBye1 ? r1p1 : null,
                        isBye: isBye1
                    };
                    if (catName) r1Match.category = catName;
                    matches.push(r1Match);
                    _matchCounter++;

                    // Link play-in matches → this R1 match via nextMatchId
                    if (typeof pair.p1 === 'object' && pair.p1.tbd) {
                        var piMatchP1 = matches.find(function(m) { return m.id === pair.p1.fromPlayinMatch; });
                        if (piMatchP1) {
                            piMatchP1.nextMatchId = r1Match.id;
                            piMatchP1.nextSlot = 'p1'; // winner fills p1 of R1 match
                        }
                    }
                    if (pair.p2 && typeof pair.p2 === 'object' && pair.p2.tbd) {
                        var piMatchP2 = matches.find(function(m) { return m.id === pair.p2.fromPlayinMatch; });
                        if (piMatchP2) {
                            piMatchP2.nextMatchId = r1Match.id;
                            piMatchP2.nextSlot = 'p2'; // winner fills p2 of R1 match
                        }
                    }
                }
                // Skip standard R1 generation — already handled above
                return; // continue to next category via forEach callback
            }
        }

        // Gerar partidas de 1ª Rodada (standard — no play-in)
        for (var mi = 0; mi < catParticipants.length; mi += 2) {
            var p1 = catParticipants[mi];
            var p2 = mi + 1 < catParticipants.length ? catParticipants[mi + 1] : 'BYE (Avança Direto)';
            var p1Name = getName(p1);
            var p2Name = getName(p2);
            var isBye = p2Name === 'BYE (Avança Direto)';
            var matchObj = {
                id: 'match-' + timestamp + '-' + _matchCounter,
                round: 1,
                bracket: isDupla ? 'upper' : undefined,
                p1: p1Name,
                p2: p2Name,
                winner: isBye ? p1Name : null,
                isBye: isBye
            };
            if (catName) matchObj.category = catName;
            matches.push(matchObj);
            _matchCounter++;
        }
    });

    t.matches = matches;
    t.status = 'active';
    t.currentStage = 'elimination';

    // 4. Handle Repescagem (Incomplete Teams Lottery)
    if (t.incompleteResolution === 'lottery_direct') {
        window.AppStore.logAction(tId, 'Repescagem aplicada: times completados via sorteio');
    }

    // Build bracket structure with advancement links
    if (isDupla) {
        window._buildDoubleElimBracket(t);
    } else {
        window._buildNextMatchLinks(t);
    }

    window.AppStore.logAction(tId, 'Sorteio Realizado e Chaveamento Gerado');

    if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();

    showNotification('Sucesso', 'Sorteio realizado com sucesso!', 'success');
    window._lastActiveTournamentId = tId;
    // Save immediately — critical: draw MUST persist to Firestore before navigating
    window.AppStore.syncImmediate(tId).then(function() {
        window.location.hash = `#bracket/${tId}`;
    });
};

// Build nextMatchId links for single elim bracket
// Gera TODAS as rodadas futuras (R2, R3, ..., Final) com participantes TBD
// Suporta categorias: cada categoria tem seu próprio chaveamento independente
window._buildNextMatchLinks = function (t) {
    if (!t.matches || !t.matches.length) return;

    // Agrupar matches R1 por categoria
    var _catSet = {};
    t.matches.filter(function(m) { return m.round === 1; }).forEach(function(m) {
        var cat = m.category || '';
        if (!_catSet[cat]) _catSet[cat] = true;
    });
    var _categories = Object.keys(_catSet);

    _categories.forEach(function(catName) {
        // Filtrar matches desta categoria
        var catMatches = t.matches.filter(function(m) {
            return (m.category || '') === catName;
        });

        var roundsMap = {};
        catMatches.forEach(function(m) {
            if (!roundsMap[m.round]) roundsMap[m.round] = [];
            roundsMap[m.round].push(m);
        });

        var r1Matches = (roundsMap[1] || []).length;
        if (r1Matches === 0) return;
        var totalRounds = Math.ceil(Math.log2(r1Matches * 2));
        var timestamp = Date.now();

        for (var r = 2; r <= totalRounds; r++) {
            var prevRound = roundsMap[r - 1] || [];
            var expectedNext = Math.ceil(prevRound.length / 2);
            if (!roundsMap[r]) roundsMap[r] = [];

            while (roundsMap[r].length < expectedNext) {
                var idx = roundsMap[r].length;
                var nm = {
                    id: 'match-r' + r + '-' + idx + '-' + (timestamp + r) + (catName ? '-' + catName.replace(/\s+/g, '_') : ''),
                    round: r,
                    p1: 'TBD', p2: 'TBD', winner: null
                };
                if (catName) nm.category = catName;
                roundsMap[r].push(nm);
                t.matches.push(nm);
            }

            prevRound.forEach(function(m, idx) {
                var nextMatchIdx = Math.floor(idx / 2);
                if (roundsMap[r][nextMatchIdx]) {
                    m.nextMatchId = roundsMap[r][nextMatchIdx].id;
                }
            });
        }

        // Processar BYE matches — avançar automaticamente
        (roundsMap[1] || []).forEach(function(m) {
            if (m.isBye && m.winner && m.nextMatchId) {
                var next = t.matches.find(function(nm) { return nm.id === m.nextMatchId; });
                if (next) {
                    if (!next.p1 || next.p1 === 'TBD') next.p1 = m.winner;
                    else if (!next.p2 || next.p2 === 'TBD') next.p2 = m.winner;
                }
            }
        });
    });
};

// ─── Build Double Elimination Bracket ───────────────────────────────
window._buildDoubleElimBracket = function (t) {
    if (!t.matches || !t.matches.length) return;
    const ts = Date.now();

    // --- UPPER BRACKET: build rounds like single elim ---
    const upperR1 = t.matches.filter(m => m.round === 1);
    const totalUpperRounds = Math.ceil(Math.log2(upperR1.length * 2));

    // Create upper bracket shell rounds
    const upperRounds = { 1: upperR1 };
    for (let r = 2; r <= totalUpperRounds; r++) {
        const prevCount = (upperRounds[r - 1] || []).length;
        const nextCount = Math.ceil(prevCount / 2);
        upperRounds[r] = [];
        for (let i = 0; i < nextCount; i++) {
            const m = {
                id: `upper-r${r}-${i}-${ts}`,
                round: r,
                bracket: 'upper',
                label: `Upper R${r} • P${i + 1}`,
                p1: 'TBD', p2: 'TBD', winner: null
            };
            upperRounds[r].push(m);
            t.matches.push(m);
        }
    }

    // Link upper bracket: winner → next upper, loser → lower
    for (let r = 1; r < totalUpperRounds; r++) {
        const cur = upperRounds[r];
        const nxt = upperRounds[r + 1];
        cur.forEach((m, idx) => {
            const nextIdx = Math.floor(idx / 2);
            if (nxt[nextIdx]) m.nextMatchId = nxt[nextIdx].id;
        });
    }

    // --- LOWER BRACKET ---
    // Lower bracket has (totalUpperRounds - 1) * 2 - 1 rounds
    // Structure: alternating "drop-down" rounds (receive upper losers) and "battle" rounds
    const lowerRounds = {};
    let lowerRoundNum = 1;

    // For each upper round (1 to totalUpperRounds-1), losers drop to lower
    for (let ur = 1; ur < totalUpperRounds; ur++) {
        const upperLosersCount = upperRounds[ur].length;

        if (ur === 1) {
            // Lower R1: upper R1 losers play each other
            const matchCount = Math.ceil(upperLosersCount / 2);
            lowerRounds[lowerRoundNum] = [];
            for (let i = 0; i < matchCount; i++) {
                const m = {
                    id: `lower-r${lowerRoundNum}-${i}-${ts}`,
                    round: lowerRoundNum,
                    bracket: 'lower',
                    label: `Lower R${lowerRoundNum} • P${i + 1}`,
                    p1: 'TBD', p2: 'TBD', winner: null
                };
                lowerRounds[lowerRoundNum].push(m);
                t.matches.push(m);
            }

            // Link upper R1 losers → lower R1
            upperRounds[1].forEach((um, idx) => {
                const lowerIdx = Math.floor(idx / 2);
                if (lowerRounds[lowerRoundNum][lowerIdx]) {
                    um.loserMatchId = lowerRounds[lowerRoundNum][lowerIdx].id;
                }
            });

            lowerRoundNum++;
        } else {
            // "Merge" round: lower winners vs upper losers dropping down
            const actualMergeCount = (lowerRounds[lowerRoundNum - 1] || []).length;

            lowerRounds[lowerRoundNum] = [];
            for (let i = 0; i < actualMergeCount; i++) {
                const m = {
                    id: `lower-r${lowerRoundNum}-${i}-${ts}`,
                    round: lowerRoundNum,
                    bracket: 'lower',
                    label: `Lower R${lowerRoundNum} • P${i + 1}`,
                    p1: 'TBD', p2: 'TBD', winner: null
                };
                lowerRounds[lowerRoundNum].push(m);
                t.matches.push(m);
            }

            // Link previous lower round winners → this round
            (lowerRounds[lowerRoundNum - 1] || []).forEach((lm, idx) => {
                if (lowerRounds[lowerRoundNum][idx]) {
                    lm.nextMatchId = lowerRounds[lowerRoundNum][idx].id;
                }
            });

            // Link upper round losers → this merge round
            upperRounds[ur].forEach((um, idx) => {
                if (lowerRounds[lowerRoundNum][idx]) {
                    um.loserMatchId = lowerRounds[lowerRoundNum][idx].id;
                }
            });

            lowerRoundNum++;

            // "Battle" round: lower bracket internal (winners play each other)
            if (actualMergeCount > 1) {
                const battleCount = Math.ceil(actualMergeCount / 2);
                lowerRounds[lowerRoundNum] = [];
                for (let i = 0; i < battleCount; i++) {
                    const m = {
                        id: `lower-r${lowerRoundNum}-${i}-${ts}`,
                        round: lowerRoundNum,
                        bracket: 'lower',
                        label: `Lower R${lowerRoundNum} • P${i + 1}`,
                        p1: 'TBD', p2: 'TBD', winner: null
                    };
                    lowerRounds[lowerRoundNum].push(m);
                    t.matches.push(m);
                }

                // Link merge round winners → battle round
                (lowerRounds[lowerRoundNum - 1] || []).forEach((lm, idx) => {
                    const nextIdx = Math.floor(idx / 2);
                    if (lowerRounds[lowerRoundNum][nextIdx]) {
                        lm.nextMatchId = lowerRounds[lowerRoundNum][nextIdx].id;
                    }
                });

                lowerRoundNum++;
            }
        }
    }

    // --- GRAND FINAL ---
    const grandFinal = {
        id: `grand-final-${ts}`,
        round: totalUpperRounds + 1,
        bracket: 'grand',
        label: 'Grande Final',
        p1: 'TBD', p2: 'TBD', winner: null
    };
    t.matches.push(grandFinal);

    // Link upper bracket final winner → grand final
    const upperFinal = upperRounds[totalUpperRounds];
    if (upperFinal && upperFinal[0]) {
        upperFinal[0].nextMatchId = grandFinal.id;
    }

    // Link lower bracket final winner → grand final
    const lastLowerRound = lowerRounds[lowerRoundNum - 1];
    if (lastLowerRound && lastLowerRound[0]) {
        lastLowerRound[0].nextMatchId = grandFinal.id;
    }

    // Auto-advance BYE winners in upper bracket
    t.matches.filter(m => m.isBye && m.winner && m.bracket === 'upper').forEach(m => {
        if (m.nextMatchId) {
            const next = t.matches.find(n => n.id === m.nextMatchId);
            if (next) {
                if (!next.p1 || next.p1 === 'TBD') next.p1 = m.winner;
                else if (!next.p2 || next.p2 === 'TBD') next.p2 = m.winner;
            }
        }
    });
};

// ========== Drag-and-drop handlers ==========
window.handleDragStart = function (e, idx, tId) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ idx, tId }));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.style.opacity = '0.4', 0);
    // Store participant data for potential use
    var t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    if (t && Array.isArray(t.participants) && t.participants[idx]) {
      window._participantDragData = t.participants[idx];
      window._participantDragTId = tId;
    }
    // Show crown drop target while dragging
    var crownBtn = document.getElementById('crown-org-btn');
    if (crownBtn) crownBtn.style.display = 'flex';
};

window.handleDragEnd = function (e) {
    e.target.style.opacity = '1';
    window._participantDragData = null;
    // Hide crown drop target
    var crownBtn = document.getElementById('crown-org-btn');
    if (crownBtn) crownBtn.style.display = 'none';
    // Restore original styles on all cards that might have been highlighted
    document.querySelectorAll('.participant-card').forEach(c => {
        if (c.dataset.originalBg) {
            c.style.background = c.dataset.originalBg;
            c.style.border = c.dataset.originalBorder;
            delete c.dataset.originalBg;
            delete c.dataset.originalBorder;
        }
    });
};

window.handleDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleDragEnter = function (e) {
    e.preventDefault();
    const card = e.currentTarget;
    if (!card.dataset.originalBg) {
        card.dataset.originalBg = card.style.background;
        card.dataset.originalBorder = card.style.border;
    }
    card.style.border = '2px dashed var(--primary-color)';
    card.style.background = 'rgba(255,255,255,0.05)';
};

window.handleDragLeave = function (e) {
    const card = e.currentTarget;
    if (card.dataset.originalBg) {
        card.style.background = card.dataset.originalBg;
        card.style.border = card.dataset.originalBorder;
    }
};

window.handleDropTeam = function (e, targetIdx) {
    e.preventDefault();
    const card = e.currentTarget;

    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const sourceIdx = data.idx;
        const tId = data.tId;

        if (sourceIdx === targetIdx) return;

        const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
        if (!t) return;

        if (t.enrollmentMode === 'individual') {
            showAlertDialog('Modo Individual', 'A regra deste torneo está configurada como Modo Individual. Formar times ou duplas manualmente viola os parâmetros estabelecidos para este torneo.', null, { type: 'warning' });
            return;
        }

        showConfirmDialog(
            'Agrupar Participantes',
            'Deseja agrupar esses dois inscritos em um único time/dupla para o sorteio?',
            () => {
                let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);

                const p1 = arr[sourceIdx];
                const p2 = arr[targetIdx];

                const name1 = typeof p1 === 'string' ? p1 : (p1.displayName || p1.name || p1.email);
                const name2 = typeof p2 === 'string' ? p2 : (p2.displayName || p2.name || p2.email);

                const newName = name1 + ' / ' + name2;

                const maxIdx = Math.max(sourceIdx, targetIdx);
                const minIdx = Math.min(sourceIdx, targetIdx);

                arr.splice(maxIdx, 1);
                arr.splice(minIdx, 1);

                arr.splice(minIdx, 0, newName);
                t.participants = arr;
                // Registrar origem: equipe formada pelo organizador (drag & drop)
                if (!t.teamOrigins) t.teamOrigins = {};
                t.teamOrigins[newName] = 'formada';

                window.FirestoreDB.saveTournament(t);

                const container = document.getElementById('view-container');
                if (container) {
                    renderTournaments(container, tId);
                }
            },
            null,
            { type: 'info', confirmText: 'Agrupar', cancelText: 'Manter Separados' }
        );

    } catch (err) { console.error(err); }
};


})();
