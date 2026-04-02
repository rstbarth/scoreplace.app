// tournaments-draw-prep.js — Draw preparation, polls & resolution (extracted from tournaments.js)

(function() {

window.checkIncompleteTeams = function (t) {
    const teamSize = t.teamSize || 1;
    const participants = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);

    const incomplete = [];
    const individuals = [];

    participants.forEach((p, idx) => {
        const pName = typeof p === 'string' ? p : (p.displayName || p.name || '');
        if (pName.includes('/')) {
            const members = pName.split('/').map(m => m.trim()).filter(m => m.length > 0);
            if (members.length < teamSize) {
                incomplete.push({ index: idx, name: pName, members: members, missing: teamSize - members.length });
            }
        } else {
            individuals.push({ index: idx, name: pName });
        }
    });

    const leftoverCount = individuals.length % teamSize;
    const fullTeamsFromIndividuals = Math.floor(individuals.length / teamSize);
    const totalFormedTeams = (participants.length - individuals.length) + fullTeamsFromIndividuals;

    return {
        incompleteTeams: incomplete,
        leftoverIndividuals: individuals.slice(-leftoverCount), // Os últimos 'n' são os que sobrarem
        totalFormedTeams: totalFormedTeams,
        hasIssues: incomplete.length > 0 || leftoverCount > 0
    };
};

window.showIncompleteTeamsPanel = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;
    const res = window.checkIncompleteTeams(t);
    if (!res.hasIssues) {
        window.showPowerOf2Panel(tId);
        return;
    }

    const teamSize = t.teamSize || 1;
    const p2Info = window.checkPowerOf2(t);
    const canShowBye = p2Info.isPowerOf2;

    const existing = document.getElementById('incomplete-teams-panel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'incomplete-teams-panel';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:2rem 0;';

    let issuesHtml = '';
    if (res.incompleteTeams.length > 0) {
        issuesHtml += `
            <div style="margin-bottom:1rem;">
                <h5 style="margin:0 0 8px; color:#f87171; font-size:0.8rem; text-transform:uppercase;">Times Incompletos (${res.incompleteTeams.length})</h5>
                <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:0.5rem; max-height:120px; overflow-y:auto;">
                    ${res.incompleteTeams.map(it => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <span style="font-size:0.85rem; font-weight:600; color:#fca5a5;">${window._safeHtml(it.name)}</span>
                            <span style="font-size:0.75rem; color:#94a3b8;">Faltam ${it.missing}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (res.leftoverIndividuals.length > 0) {
        issuesHtml += `
            <div>
                <h5 style="margin:0 0 8px; color:#fbbf24; font-size:0.8rem; text-transform:uppercase;">Jogadores Avulsos (${res.leftoverIndividuals.length})</h5>
                <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:0.5rem; max-height:120px; overflow-y:auto;">
                     ${res.leftoverIndividuals.map(li => `
                        <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:#fde68a; font-size:0.85rem; font-weight:600;">
                            ${window._safeHtml(li.name)}
                        </div>
                     `).join('')}
                </div>
                <p style="margin:8px 0 0; color:#fbbf24; font-size:0.7rem; opacity:0.8;">Estes jogadores não formam um time completo de ${teamSize}.</p>
            </div>
        `;
    }

    overlay.innerHTML = `
        <div style="background:var(--bg-card,#1e293b);width:94%;max-width:700px;border-radius:24px;border:1px solid rgba(239,68,68,0.3);box-shadow:0 30px 100px rgba(0,0,0,0.7);overflow:hidden;animation: modalFadeIn 0.3s ease-out;">
            <div style="background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);padding:1.5rem 2rem;">
                <div style="display:flex;align-items:center;gap:15px;">
                    <span style="font-size:2.5rem;">⚠️</span>
                    <div>
                        <h3 style="margin:0;color:#fef2f2;font-size:1.25rem;font-weight:800;">Pendências de Jogadores/Times</h3>
                        <p style="margin:4px 0 0;color:#f87171;font-size:0.9rem;">Existem participantes que não preenchem times completos de ${teamSize}.</p>
                    </div>
                </div>
            </div>

            <div style="padding:1.5rem 2rem;">
                ${issuesHtml}

                <h4 style="margin:1.5rem 0 0.5rem;color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Como deseja resolver?</h4>
                <p style="margin:0 0 1rem;font-size:0.7rem;color:#64748b;line-height:1.5;">Cores indicam afinidade com o equilíbrio de Nash: <span style="color:#4ade80;">■</span> melhor → <span style="color:#60a5fa;">■</span> menor</p>

                ${(function(){
                    // Nash scoring for incomplete teams options
                    var wF = 0.45, wI = 0.35, wE = 0.20;
                    var payoffs = {
                        reopen:   { f: 10, i: 10, e: 3 },
                        lottery:  { f: 4,  i: 8,  e: 8 },
                        standby:  { f: 6,  i: 4,  e: 9 },
                        dissolve: { f: 7,  i: 7,  e: 4 },
                        poll:     { f: 10, i: 10, e: 2 }
                    };
                    var scores = {};
                    var maxS = 0, minS = 10;
                    Object.keys(payoffs).forEach(function(k) {
                        var p = payoffs[k];
                        scores[k] = p.f * wF + p.i * wI + p.e * wE;
                        if (scores[k] > maxS) maxS = scores[k];
                        if (scores[k] < minS) minS = scores[k];
                    });
                    var rng = maxS - minS || 1;
                    var norm = {};
                    Object.keys(scores).forEach(function(k) { norm[k] = (scores[k] - minS) / rng; });
                    function nC(n) {
                        if (n >= 0.8) return { bg: 'rgba(34,197,94,0.12)', bd: 'rgba(34,197,94,0.45)', gw: '0 0 20px rgba(34,197,94,0.15)', pc: '#4ade80', pb: 'rgba(34,197,94,0.15)' };
                        if (n >= 0.6) return { bg: 'rgba(250,204,21,0.10)', bd: 'rgba(250,204,21,0.40)', gw: '0 0 15px rgba(250,204,21,0.10)', pc: '#facc15', pb: 'rgba(250,204,21,0.15)' };
                        if (n >= 0.35) return { bg: 'rgba(251,146,60,0.08)', bd: 'rgba(251,146,60,0.30)', gw: '0 0 10px rgba(251,146,60,0.08)', pc: '#fb923c', pb: 'rgba(251,146,60,0.12)' };
                        return { bg: 'rgba(96,165,250,0.06)', bd: 'rgba(96,165,250,0.20)', gw: 'none', pc: '#60a5fa', pb: 'rgba(96,165,250,0.10)' };
                    }
                    function sty(key) { var c = nC(norm[key]); return 'background:' + c.bg + ';border:1px solid ' + c.bd + ';box-shadow:' + c.gw + ';border-radius:16px;padding:14px 14px 2rem;cursor:pointer;display:flex;gap:12px;align-items:flex-start;transition:all 0.3s;color:#e2e8f0;'; }
                    function pill(key) { var c = nC(norm[key]); var pct = Math.round(norm[key] * 100); return '<span style="position:absolute;bottom:8px;right:10px;padding:3px 10px;border-radius:8px;font-size:0.62rem;font-weight:800;background:' + c.pb + ';color:' + c.pc + ';pointer-events:none;">Nash ' + pct + '%</span>'; }
                    var bestK = '', bestV = -1;
                    Object.keys(scores).forEach(function(k) { if (k !== 'poll' && scores[k] > bestV) { bestV = scores[k]; bestK = k; } });
                    var bdg = '<span style="position:absolute;top:8px;right:8px;background:rgba(34,197,94,0.15);color:#4ade80;padding:2px 8px;border-radius:6px;font-size:0.58rem;font-weight:800;text-transform:uppercase;">⭐ Recomendado</span>';
                    var sid = String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

                    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +

                    '<button style="position:relative;' + sty('reopen') + '" onmouseover="this.style.filter=\'brightness(1.15)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.filter=\'\';this.style.transform=\'\'" onclick="window._handleIncompleteOption(\'' + sid + '\', \'reopen\')">' +
                        (bestK === 'reopen' ? bdg : '') +
                        '<span style="font-size:1.5rem;">↩️</span>' +
                        '<div>' +
                        '<div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Reabrir Inscrições</div>' +
                        '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Apenas para fechar os times faltantes.</div>' +
                        '</div>' +
                        pill('reopen') +
                    '</button>' +

                    '<button style="position:relative;' + sty('lottery') + '" onmouseover="this.style.filter=\'brightness(1.15)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.filter=\'\';this.style.transform=\'\'" onclick="window._handleIncompleteOption(\'' + sid + '\', \'lottery\')">' +
                        (bestK === 'lottery' ? bdg : '') +
                        '<span style="font-size:1.5rem;">🎲</span>' +
                        '<div>' +
                        '<div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Sorteio de \'Bots\'</div>' +
                        '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Preencher vagas com nomes fictícios ou convites.</div>' +
                        '</div>' +
                        pill('lottery') +
                    '</button>' +

                    '<button style="position:relative;' + sty('standby') + '" onmouseover="this.style.filter=\'brightness(1.15)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.filter=\'\';this.style.transform=\'\'" onclick="window._handleIncompleteOption(\'' + sid + '\', \'standby\')">' +
                        (bestK === 'standby' ? bdg : '') +
                        '<span style="font-size:1.5rem;">⏱️</span>' +
                        '<div>' +
                        '<div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Lista de Espera</div>' +
                        '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Os que sobrarem ficam fora do torneio principal.</div>' +
                        '</div>' +
                        pill('standby') +
                    '</button>' +

                    '<button style="position:relative;' + sty('dissolve') + '" onmouseover="this.style.filter=\'brightness(1.15)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.filter=\'\';this.style.transform=\'\'" onclick="window._handleIncompleteOption(\'' + sid + '\', \'dissolve\')">' +
                        (bestK === 'dissolve' ? bdg : '') +
                        '<span style="font-size:1.5rem;">🧩</span>' +
                        '<div>' +
                        '<div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Ajuste Manual</div>' +
                        '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Remanejar jogadores entre times (Arrastar e Soltar).</div>' +
                        '</div>' +
                        pill('dissolve') +
                    '</button>' +

                    '<button style="position:relative;' + sty('poll') + 'grid-column:span 2;" onmouseover="this.style.filter=\'brightness(1.15)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.filter=\'\';this.style.transform=\'\'" onclick="window._handleIncompleteOption(\'' + sid + '\', \'poll\')">' +
                        '<span style="font-size:1.5rem;">🗳️</span>' +
                        '<div>' +
                        '<div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Enquete entre Participantes</div>' +
                        '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Os inscritos votam na solução que preferem. Defina um prazo e acompanhe a contagem regressiva.</div>' +
                        '</div>' +
                        pill('poll') +
                    '</button>' +

                    '</div>';
                })()}
            </div>

            <div style="padding:1rem 2rem 1.5rem;display:flex;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.05);">
                <button onclick="document.getElementById('incomplete-teams-panel').remove();" style="background:transparent;color:#94a3b8;border:none;padding:10px 20px;font-weight:600;font-size:0.9rem;cursor:pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};


// Handler for incomplete teams resolution options
window._handleIncompleteOption = function (tId, option) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    if (option === 'reopen') {
        t.status = 'active';
        t.enrollmentStatus = 'open';
        window.AppStore.logAction(tId, 'Inscrições reabertas para completar times');
        window.AppStore.sync();
        var el = document.getElementById('incomplete-teams-panel');
        if (el) el.remove();
        if (typeof showNotification === 'function') showNotification('Inscrições Reabertas', 'Aguardando novos inscritos para completar os times.', 'success');
        window.location.hash = '#tournaments/' + tId;
    } else if (option === 'lottery') {
        window.showLotteryIncompletePanel(tId);
    } else if (option === 'standby') {
        t.incompleteResolution = 'standby';
        window.AppStore.logAction(tId, 'Jogadores sem time movidos para lista de espera');
        window.AppStore.sync();
        var el2 = document.getElementById('incomplete-teams-panel');
        if (el2) el2.remove();
        window.showPowerOf2Panel(tId);
    } else if (option === 'dissolve') {
        window.showDissolveTeamsPanel(tId);
    } else if (option === 'poll') {
        document.getElementById('incomplete-teams-panel').remove();
        // Collect poll options from incomplete teams context (exclude 'poll' itself)
        var pollOptions = [
            { key: 'reopen', icon: '↩️', title: 'Reabrir Inscrições', desc: 'Aguardar novos jogadores para fechar os times faltantes.' },
            { key: 'lottery', icon: '🎲', title: 'Sorteio de Bots', desc: 'Preencher vagas com nomes fictícios ou convites aleatórios.' },
            { key: 'standby', icon: '⏱️', title: 'Lista de Espera', desc: 'Os que sobrarem ficam fora do torneio principal, podendo substituir ausentes.' },
            { key: 'dissolve', icon: '🧩', title: 'Ajuste Manual', desc: 'Organizador redistribui jogadores entre times manualmente.' }
        ];
        window._showPollCreationDialog(tId, 'incomplete', pollOptions);
    }
};

window.showLotteryIncompletePanel = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    showConfirmDialog(
        'Tipo de Repescagem',
        'Escolha como a repescagem deve ser feita para completar os times:',
        () => {
            // Direta
            window.AppStore.logAction(tId, 'Repescagem Direta por Sorteio selecionada');
            t.incompleteResolution = 'lottery_direct';
            window.AppStore.sync();
            document.getElementById('incomplete-teams-panel').remove();
            window.showPowerOf2Panel(tId);
        },
        () => {
            // Mini-repescagem
            window.AppStore.logAction(tId, 'Mini-Repescagem selecionada');
            t.incompleteResolution = 'lottery_mini';
            window.AppStore.sync();
            document.getElementById('incomplete-teams-panel').remove();
            window.showPowerOf2Panel(tId);
        },
        {
            type: 'info',
            confirmText: 'Sorteio Direto',
            cancelText: 'Mini-Repescagem (Play-off)',
            message: '<b>Sorteio Direto:</b> Completa as vagas aleatoriamente.<br><b>Mini-Repescagem:</b> Jogadores disputam as vagas em partidas rápidas.'
        }
    );
};

window.showDissolveTeamsPanel = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    const incomplete = window.checkIncompleteTeams(t);
    const teamSize = t.teamSize || 1;

    // Interface de Drag & Drop
    const existing = document.getElementById('dissolve-panel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dissolve-panel';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.9);backdrop-filter:blur(15px);z-index:99999;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--bg-card,#1e293b);width:96%;max-width:900px;height:85vh;border-radius:24px;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
            <div style="padding:1.5rem 2rem;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3 style="margin:0;color:white;">Realocação Manual</h3>
                    <p style="margin:4px 0 0;color:#94a3b8;font-size:0.85rem;">Arraste jogadores para completar ou dissolver times.</p>
                </div>
                <button onclick="document.getElementById('dissolve-panel').remove()" style="background:rgba(255,255,255,0.05);border:none;color:white;padding:8px 15px;border-radius:10px;cursor:pointer;">Fechar</button>
            </div>

            <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:2rem;overflow:hidden;">
                <!-- Coluna 1: Times Incompletos -->
                <div style="display:flex;flex-direction:column;gap:15px;overflow-y:auto;padding-right:10px;">
                    <h4 style="margin:0;font-size:0.8rem;color:#f87171;text-transform:uppercase;letter-spacing:1px;">Times Incompletos</h4>
                    <div id="incomplete-list-dnd" style="display:flex;flex-direction:column;gap:12px;"></div>
                </div>

                <!-- Coluna 2: Todos os Participantes / Pool -->
                <div style="display:flex;flex-direction:column;gap:15px;overflow-y:auto;padding-right:10px;">
                    <h4 style="margin:0;font-size:0.8rem;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;">Todos os Participantes</h4>
                    <div id="full-list-dnd" style="display:flex;flex-direction:column;gap:8px;"></div>
                </div>
            </div>

            <div style="padding:1.5rem 2rem;background:rgba(255,255,255,0.03);border-top:1px solid rgba(255,255,255,0.05);display:flex;justify-content:flex-end;gap:15px;">
                <button onclick="window._saveDissolveResolution('${String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" style="background:#2563eb;color:white;border:none;padding:12px 25px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 10px 20px rgba(37,99,235,0.3);">Salvar Alterações</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Lógica de Renderização e DnD simplificada para o protótipo
    // Em uma implementação real, usaríamos a API de Drag and Drop
    const renderLists = () => {
        const incList = document.getElementById('incomplete-list-dnd');
        const fullList = document.getElementById('full-list-dnd');

        const participants = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});

        incList.innerHTML = incomplete.map(it => `
            <div style="background:rgba(239,68,68,0.05);border:1px dashed rgba(239,68,68,0.3);border-radius:12px;padding:1rem;">
                <div style="font-weight:700;color:white;margin-bottom:8px;font-size:0.9rem;">${window._safeHtml(it.name)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    ${it.members.map(m => `<span style="background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:6px;font-size:0.8rem;color:#e2e8f0;">${window._safeHtml(m)}</span>`).join('')}
                    <span style="border:1px dashed #94a3b8;padding:4px 10px;border-radius:6px;font-size:0.8rem;color:#94a3b8;">+ Vaga</span>
                </div>
            </div>
        `).join('');

        fullList.innerHTML = participants.map((p, idx) => {
            const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
            return `
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:10px 15px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:move;">
                    <span style="font-size:0.9rem;color:#e2e8f0;">${window._safeHtml(name)}</span>
                    <span style="color:#94a3b8;font-size:0.75rem;">ID: ${idx}</span>
                </div>
            `;
        }).join('');
    };

    renderLists();
};

window._saveDissolveResolution = function (tId) {
    // Em um sistema real, aqui consolidaríamos as mudanças no state do torneio
    window.AppStore.logAction(tId, 'Times dissolvidos/realocados manualmente');
    showNotification('Sucesso', 'Alterações salvas com sucesso.', 'success');
    document.getElementById('dissolve-panel').remove();
    if (document.getElementById('incomplete-teams-panel')) document.getElementById('incomplete-teams-panel').remove();
    window.showPowerOf2Panel(tId);
};

// ─── DIVULGAÇÃO DO SORTEIO ───
window._showDrawVisibilityDialog = function (tId) {
    let existing = document.getElementById('draw-visibility-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'draw-visibility-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100000;';

    overlay.innerHTML = `
      <div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:16px;max-width:440px;width:92%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="background:rgba(59,130,246,0.1);border-bottom:1px solid var(--border-color);padding:1.25rem;display:flex;align-items:center;gap:12px;">
          <span style="font-size:2rem;">📢</span>
          <div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--text-color);">Divulgação do Sorteio</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Quem poderá ver o resultado do chaveamento?</div>
          </div>
        </div>
        <div style="padding:1.25rem;display:flex;flex-direction:column;gap:8px;">
          <button class="dvd-opt" data-val="public" style="width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.1);color:#4ade80;text-align:left;display:flex;align-items:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.2)'" onmouseout="this.style.background='rgba(16,185,129,0.1)'">
            <span style="font-size:1.2rem;">🌐</span>
            <div>
              <div>Divulgação Imediata a Todos</div>
              <div style="font-weight:400;font-size:0.75rem;opacity:0.8;margin-top:2px;">Qualquer pessoa poderá ver o chaveamento assim que o sorteio for realizado.</div>
            </div>
          </button>
          <button class="dvd-opt" data-val="participants" style="width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;text-align:left;display:flex;align-items:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='rgba(251,191,36,0.2)'" onmouseout="this.style.background='rgba(251,191,36,0.1)'">
            <span style="font-size:1.2rem;">👥</span>
            <div>
              <div>Organizador e Participantes</div>
              <div style="font-weight:400;font-size:0.75rem;opacity:0.8;margin-top:2px;">Apenas o organizador e os participantes inscritos poderão ver o chaveamento.</div>
            </div>
          </button>
          <button class="dvd-opt" data-val="organizer" style="width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;text-align:left;display:flex;align-items:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.2)'" onmouseout="this.style.background='rgba(99,102,241,0.1)'">
            <span style="font-size:1.2rem;">🔒</span>
            <div>
              <div>Apenas o Organizador</div>
              <div style="font-weight:400;font-size:0.75rem;opacity:0.8;margin-top:2px;">O chaveamento ficará visível apenas para o organizador até que ele decida liberar.</div>
            </div>
          </button>
          <button id="dvd-cancel" style="width:100%;padding:10px 16px;border-radius:10px;font-weight:600;font-size:0.8rem;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-muted);text-align:center;margin-top:4px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            Cancelar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };

    overlay.querySelector('#dvd-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelectorAll('.dvd-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (t) {
                t.drawVisibility = val;
                const labels = { public: 'Divulgação imediata a todos', participants: 'Organizador e participantes', organizer: 'Apenas o organizador' };
                window.AppStore.logAction(tId, `Visibilidade do sorteio: ${labels[val]}`);
                window.AppStore.sync();
            }
            close();
            // Continuar com o sorteio
            setTimeout(() => window.generateDrawFunction(tId), 250);
        });
    });
};

// ─── VERIFICAÇÃO 1.5: TIMES INCOMPLETOS ───
window._showIncompleteTeamDialog = function (tId, remainder, teamSize, totalIndividuals, preFormedTeams) {
    let existing = document.getElementById('incomplete-team-dialog');
    if (existing) existing.remove();

    const totalTeamsPossible = Math.floor(totalIndividuals / teamSize);
    const overlay = document.createElement('div');
    overlay.id = 'incomplete-team-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100000;';

    overlay.innerHTML = `
      <div style="background:var(--surface-color);border:1px solid var(--border-color);border-radius:16px;max-width:480px;width:92%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="background:rgba(245,158,11,0.1);border-bottom:1px solid var(--border-color);padding:1.25rem;display:flex;align-items:center;gap:12px;">
          <span style="font-size:2rem;">⚠️</span>
          <div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--text-color);">Times Incompletos</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Ajuste necessário antes do sorteio</div>
          </div>
        </div>
        <div style="padding:1.25rem;color:var(--text-muted);font-size:0.9rem;line-height:1.7;">
          <p>O torneio exige times de <strong style="color:var(--text-bright);">${teamSize} jogadores</strong>.</p>
          <div style="display:flex;gap:12px;margin:12px 0;flex-wrap:wrap;">
            <div style="flex:1;min-width:100px;background:rgba(0,0,0,0.15);padding:10px;border-radius:10px;text-align:center;">
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-bright);">${totalIndividuals}</div>
              <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;opacity:0.7;">Individuais</div>
            </div>
            ${preFormedTeams > 0 ? `
            <div style="flex:1;min-width:100px;background:rgba(0,0,0,0.15);padding:10px;border-radius:10px;text-align:center;">
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-bright);">${preFormedTeams}</div>
              <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;opacity:0.7;">Times Formados</div>
            </div>` : ''}
            <div style="flex:1;min-width:100px;background:rgba(0,0,0,0.15);padding:10px;border-radius:10px;text-align:center;">
              <div style="font-size:1.3rem;font-weight:800;color:var(--text-bright);">${totalTeamsPossible}</div>
              <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;opacity:0.7;">Times Possíveis</div>
            </div>
            <div style="flex:1;min-width:100px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:10px;border-radius:10px;text-align:center;">
              <div style="font-size:1.3rem;font-weight:800;color:#fbbf24;">${remainder}</div>
              <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;color:#fbbf24;opacity:0.9;">Sem Time</div>
            </div>
          </div>
          <p style="font-size:0.85rem;"><strong style="color:#fbbf24;">${remainder} participante${remainder > 1 ? 's' : ''}</strong> não conseguirá${remainder > 1 ? 'ão' : ''} formar um time completo. O que fazer com ${remainder > 1 ? 'eles' : 'ele'}?</p>
          <p style="font-size:0.75rem;opacity:0.6;font-style:italic;">Os nomes não são revelados para não influenciar a decisão.</p>
        </div>
        <div style="padding:0 1.25rem 1.25rem;display:flex;flex-direction:column;gap:8px;">
          <button id="itd-standby" style="width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;text-align:left;display:flex;align-items:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='rgba(251,191,36,0.2)'" onmouseout="this.style.background='rgba(251,191,36,0.1)'">
            <span style="font-size:1.2rem;">⏳</span>
            <div>
              <div>Lista de Espera</div>
              <div style="font-weight:400;font-size:0.75rem;opacity:0.8;margin-top:2px;">Os participantes sem time vão para a lista de espera e podem substituir ausentes.</div>
            </div>
          </button>
          <button id="itd-playin" style="width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;text-align:left;display:flex;align-items:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.2)'" onmouseout="this.style.background='rgba(99,102,241,0.1)'">
            <span style="font-size:1.2rem;">🔄</span>
            <div>
              <div>Repescagem</div>
              <div style="font-weight:400;font-size:0.75rem;opacity:0.8;margin-top:2px;">Os participantes sem time disputam vagas em jogos eliminatórios antes do torneio principal.</div>
            </div>
          </button>
          <button id="itd-remove" style="width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#f87171;text-align:left;display:flex;align-items:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">
            <span style="font-size:1.2rem;">❌</span>
            <div>
              <div>Exclusão</div>
              <div style="font-weight:400;font-size:0.75rem;opacity:0.8;margin-top:2px;">Os participantes sem time são removidos do torneio.</div>
            </div>
          </button>
          <button id="itd-cancel" style="width:100%;padding:10px 16px;border-radius:10px;font-weight:600;font-size:0.8rem;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-muted);text-align:center;margin-top:4px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            Cancelar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };

    overlay.querySelector('#itd-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#itd-standby').addEventListener('click', () => {
        window._resolveIncompleteTeams(tId, 'standby');
        close();
    });
    overlay.querySelector('#itd-playin').addEventListener('click', () => {
        window._resolveIncompleteTeams(tId, 'playin');
        close();
    });
    overlay.querySelector('#itd-remove').addEventListener('click', () => {
        window._resolveIncompleteTeams(tId, 'remove');
        close();
    });
};

window._resolveIncompleteTeams = function (tId, option) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;
    const teamSize = parseInt(t.teamSize) || 1;
    const vips = t.vips || {};
    const parts = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);

    // Separar individuais (VIPs protegidos) e times pré-formados
    let individuals = [];
    let vipIndividuals = [];
    let preFormed = [];
    parts.forEach(p => {
        const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
        if (name.includes(' / ')) {
            preFormed.push(p);
        } else if (vips[name]) {
            vipIndividuals.push(p); // VIPs nunca vão para overflow
        } else {
            individuals.push(p);
        }
    });

    // Embaralhar apenas não-VIPs ANTES de separar sobras
    for (let i = individuals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [individuals[i], individuals[j]] = [individuals[j], individuals[i]];
    }

    // Sobras saem apenas dos não-VIPs
    const totalNonTeam = vipIndividuals.length + individuals.length;
    const remainder = totalNonTeam % teamSize;
    const overflow = remainder > 0 ? individuals.splice(individuals.length - remainder, remainder) : [];
    // Reunir VIPs + não-VIPs restantes
    individuals = [...vipIndividuals, ...individuals];

    // Reconstruir participants sem as sobras
    t.participants = [...preFormed, ...individuals];

    if (option === 'standby') {
        if (!Array.isArray(t.standbyParticipants)) t.standbyParticipants = [];
        overflow.forEach(p => t.standbyParticipants.push(p));
        const count = overflow.length;
        window.AppStore.logAction(tId, `${count} participante(s) sem time movido(s) para lista de espera (sorteio aleatório)`);
        if (typeof showNotification === 'function') showNotification('Lista de Espera', `${count} participante(s) sem time foram movidos para a lista de espera.`, 'info');
    } else if (option === 'playin') {
        if (!Array.isArray(t.playinParticipants)) t.playinParticipants = [];
        overflow.forEach(p => t.playinParticipants.push(p));
        const count = overflow.length;
        window.AppStore.logAction(tId, `${count} participante(s) sem time movido(s) para repescagem (sorteio aleatório)`);
        if (typeof showNotification === 'function') showNotification('Repescagem', `${count} participante(s) sem time disputarão vagas em repescagem.`, 'info');
    } else if (option === 'remove') {
        const count = overflow.length;
        window.AppStore.logAction(tId, `${count} participante(s) sem time removido(s) do torneio (sorteio aleatório)`);
        if (typeof showNotification === 'function') showNotification('Participantes Removidos', `${count} participante(s) sem time foram removidos.`, 'warning');
    }

    t.incompleteTeamResolved = true;
    window.AppStore.sync();

    // Continuar com o sorteio
    window.generateDrawFunction(tId);
};

// ─── VERIFICAÇÃO 2: POTÊNCIA DE 2 ───
window.checkPowerOf2 = function (t) {
    const arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
    const n = arr.length;
    if (n === 0) return { count: 0, isPowerOf2: false, lo: 0, hi: 2, missing: 2, excess: 0 };

    const isPowerOf2 = n > 0 && (n & (n - 1)) === 0;
    let prev = 1;
    while (prev * 2 <= n) prev *= 2;
    const lo = prev;
    const hi = prev * 2;

    return {
        count: n,
        isPowerOf2,
        lo: lo,
        hi: hi,
        missing: hi - n,
        excess: n - lo
    };
};

window.showPowerOf2Panel = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    // Suspender inscrições enquanto a decisão está sendo tomada
    if (t.status !== 'closed') {
        t.status = 'closed';
        t._suspendedByPanel = true;
        window.AppStore.sync();
    }

    const info = window.checkPowerOf2(t);
    if (info.isPowerOf2) {
        window.showFinalReviewPanel(tId);
        return;
    }

    const existing = document.getElementById('p2-resolution-panel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'p2-resolution-panel';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 0;';

    overlay.innerHTML = `
        <div style="background:var(--bg-card,#1e293b);width:94%;max-width:750px;border-radius:32px;margin:auto 0;border:1px solid rgba(251,191,36,0.2);box-shadow:0 40px 120px rgba(0,0,0,0.8);overflow:hidden;animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#78350f 0%,#b45309 100%);padding:2rem 2.5rem;">
                <div style="display:flex;align-items:center;gap:20px;margin-bottom:2rem;">
                    <div style="width:64px;height:64px;background:rgba(255,255,255,0.1);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;backdrop-filter:blur(5px);">⚙️</div>
                    <div>
                        <h3 style="margin:0;color:#fef3c7;font-size:1.5rem;font-weight:900;letter-spacing:-0.02em;">Ajuste de Chaveamento</h3>
                        <p style="margin:4px 0 0;color:#fde68a;font-size:0.95rem;opacity:0.9;">O chaveamento exige uma potência de 2 para ser exato.</p>
                    </div>
                </div>
                
                <!-- NEW GRAPHICAL GAUGE -->
                <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1.5rem;background:rgba(0,0,0,0.3);padding:2rem;border-radius:24px;border:1px solid rgba(255,255,255,0.05);">
                    <!-- Left: Lower P2 -->
                    <div style="text-align:right;">
                        <div style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700;">Potência Inferior</div>
                        <div style="display:flex;flex-direction:column;align-items:flex-end;">
                            <span style="font-size:2rem;font-weight:900;color:#4ade80;line-height:1;">${info.lo}</span>
                            <span style="font-size:0.8rem;color:#86efac;margin-top:4px;">Sobram <b>${info.excess}</b></span>
                        </div>
                    </div>

                    <!-- Center: Current Total -->
                    <div style="position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center, rgba(251,191,36,0.15) 0%, transparent 70%);">
                        <div style="position:absolute;width:100%;height:100%;border:2px dashed rgba(251,191,36,0.3);border-radius:50%;animation: rotate 20s linear infinite;"></div>
                        <div style="text-align:center;position:relative;z-index:2;">
                            <div style="font-size:3rem;font-weight:950;color:#fff;line-height:1;text-shadow:0 0 20px rgba(255,255,255,0.3);">${info.count}</div>
                            <div style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;font-weight:800;margin-top:2px;line-height:1.3;">Total de<br>Inscritos</div>
                        </div>
                    </div>

                    <!-- Right: Upper P2 -->
                    <div style="text-align:left;">
                        <div style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700;">Potência Superior</div>
                        <div style="display:flex;flex-direction:column;align-items:flex-start;">
                            <span style="font-size:2rem;font-weight:900;color:#60a5fa;line-height:1;">${info.hi}</span>
                            <span style="font-size:0.8rem;color:#93c5fd;margin-top:4px;">Faltam <b>${info.missing}</b></span>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .p2-option { border-radius:18px; padding:2.2rem 1.5rem 2.2rem; cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-align:left; color:#e2e8f0; display:flex; gap:16px; align-items:flex-start; position:relative; overflow:hidden; }
                .p2-option:hover { transform:translateY(-2px); filter:brightness(1.15); }
                .p2-option::after { content:''; position:absolute; top:0; left:0; width:100%; height:100%; background:linear-gradient(45deg, transparent, rgba(255,255,255,0.06), transparent); transform:translateX(-100%); transition:0.5s; }
                .p2-option:hover::after { transform:translateX(100%); }
                .p2-option h4 { margin:0 0 4px; font-weight:800; font-size:1.05rem; color:#fff; }
                .p2-option p { margin:0; font-size:0.8rem; color:#94a3b8; line-height:1.5; }
                .p2-badge { position:absolute; top:10px; right:10px; background:rgba(34,197,94,0.15); color:#4ade80; padding:3px 10px; border-radius:8px; font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; pointer-events:none; }
                .nash-corner { position:absolute; bottom:10px; right:12px; padding:3px 10px; border-radius:8px; font-size:0.65rem; font-weight:800; letter-spacing:0.3px; pointer-events:none; }
            </style>

            <div style="padding:2.5rem;">
                <h4 style="margin:0 0 0.5rem;color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Selecione a Estratégia de Ajuste</h4>
                <p style="margin:0 0 1.5rem;font-size:0.7rem;color:#64748b;line-height:1.5;">Cores indicam afinidade com o equilíbrio de Nash: <span style="color:#4ade80;">■</span> melhor equilíbrio → <span style="color:#60a5fa;">■</span> menor equilíbrio</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    ${(function(){
                        // Nash scoring per option — fairness 45%, inclusion 35%, effort 20%
                        var wF = 0.45, wI = 0.35, wE = 0.20;
                        var payoffs = {
                            reopen:  { f: 10, i: 10, e: 3 },
                            bye:     { f: 6,  i: 10, e: 9 },
                            playin:  { f: 8,  i: 10, e: 6 },
                            standby: { f: 6,  i: 4,  e: 9 },
                            swiss:   { f: 9,  i: 10, e: 5 },
                            poll:    { f: 10, i: 10, e: 2 }
                        };
                        // Context adjustments
                        if (info.missing <= 2) {
                            payoffs.reopen = { f: 10, i: 10, e: 8 };
                        }
                        if (info.missing <= info.excess * 2) {
                            payoffs.bye.e = 10;
                        }
                        // Compute scores
                        var scores = {};
                        var maxScore = 0, minScore = 10;
                        Object.keys(payoffs).forEach(function(k) {
                            var p = payoffs[k];
                            scores[k] = p.f * wF + p.i * wI + p.e * wE;
                            if (scores[k] > maxScore) maxScore = scores[k];
                            if (scores[k] < minScore) minScore = scores[k];
                        });
                        // Normalize 0-1 (1 = best Nash)
                        var range = maxScore - minScore || 1;
                        var norm = {};
                        Object.keys(scores).forEach(function(k) {
                            norm[k] = (scores[k] - minScore) / range;
                        });
                        // Color function: 1.0 = warm green, 0.0 = cool blue-gray
                        function nashColor(n) {
                            if (n >= 0.8) return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.45)', glow: '0 0 20px rgba(34,197,94,0.15)', pill: '#4ade80', pillBg: 'rgba(34,197,94,0.15)' };
                            if (n >= 0.6) return { bg: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.40)', glow: '0 0 15px rgba(250,204,21,0.10)', pill: '#facc15', pillBg: 'rgba(250,204,21,0.15)' };
                            if (n >= 0.35) return { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.30)', glow: '0 0 10px rgba(251,146,60,0.08)', pill: '#fb923c', pillBg: 'rgba(251,146,60,0.12)' };
                            return { bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.20)', glow: 'none', pill: '#60a5fa', pillBg: 'rgba(96,165,250,0.10)' };
                        }
                        function nashStyle(key) {
                            var c = nashColor(norm[key]);
                            return 'background:' + c.bg + ';border:1px solid ' + c.border + ';box-shadow:' + c.glow + ';';
                        }
                        function nashPill(key) {
                            var c = nashColor(norm[key]);
                            var pct = Math.round(norm[key] * 100);
                            return '<span class="nash-corner" style="background:' + c.pillBg + ';color:' + c.pill + ';">Nash ' + pct + '%</span>';
                        }
                        // Find best for badge
                        var bestKey = '';
                        var bestVal = -1;
                        Object.keys(scores).forEach(function(k) { if (k !== 'poll' && scores[k] > bestVal) { bestVal = scores[k]; bestKey = k; } });
                        var badge = '<div class="p2-badge">⭐ Recomendado</div>';
                        var tIdSafe = String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

                        return '<button class="p2-option shadow-xl" style="' + nashStyle('reopen') + '" onclick="window._handleP2Option(\'' + tIdSafe + '\', \'reopen\')">' +
                            (bestKey === 'reopen' ? badge : '') +
                            '<span style="font-size:2rem;">↩️</span>' +
                            '<div>' +
                            '<h4>Reabrir Inscrições</h4>' +
                            '<p>Aguardar mais ' + info.missing + ' inscritos para chegar em ' + info.hi + '.</p>' +
                            '</div>' +
                            nashPill('reopen') +
                        '</button>' +

                        '<button class="p2-option shadow-xl" style="' + nashStyle('bye') + '" onclick="window._handleP2Option(\'' + tIdSafe + '\', \'bye\')">' +
                            (bestKey === 'bye' ? badge : '') +
                            '<span style="font-size:2rem;">🥇</span>' +
                            '<div>' +
                            '<h4>Aplicar BYE</h4>' +
                            '<p>' + info.missing + ' participantes avançam direto para a 2ª rodada. Chaveamento de ' + info.hi + '.</p>' +
                            '</div>' +
                            nashPill('bye') +
                        '</button>' +

                        '<button class="p2-option shadow-xl" style="' + nashStyle('playin') + '" onclick="window._handleP2Option(\'' + tIdSafe + '\', \'playin\')">' +
                            (bestKey === 'playin' ? badge : '') +
                            '<span style="font-size:2rem;">🔁</span>' +
                            '<div>' +
                            '<h4>Play-in (Repescagem)</h4>' +
                            '<p>' + (info.excess * 2) + ' participantes disputam ' + info.excess + ' vaga(s) na repescagem. Na rodada seguinte, vencedores da repescagem enfrentam quem avançou direto.</p>' +
                            '</div>' +
                            nashPill('playin') +
                        '</button>' +

                        '<button class="p2-option shadow-xl" style="' + nashStyle('standby') + '" onclick="window._handleP2Option(\'' + tIdSafe + '\', \'standby\')">' +
                            '<span style="font-size:2rem;">⏱️</span>' +
                            '<div>' +
                            '<h4>Lista de Espera</h4>' +
                            '<p>' + info.count + ' inscritos. ' + Math.floor(info.lo / (parseInt(t.teamSize) || 1)) + ' ' + ((parseInt(t.teamSize) || 1) > 1 ? 'times jogam' : 'jogam') + ' em ' + (Math.floor(info.lo / (parseInt(t.teamSize) || 1)) / 2) + ' partidas. ' + (info.count - info.lo) + ' na lista de espera.</p>' +
                            '</div>' +
                            nashPill('standby') +
                        '</button>' +

                        '<button class="p2-option shadow-xl" style="' + nashStyle('swiss') + '" onclick="window._handleP2Option(\'' + tIdSafe + '\', \'swiss\')">' +
                            '<span style="font-size:2rem;">🏅</span>' +
                            '<div>' +
                            '<h4>Formato Suíço / Classificatória</h4>' +
                            '<p>Garantia de mais jogos para todos antes de afunilar para os melhores ' + info.lo + '.</p>' +
                            '</div>' +
                            nashPill('swiss') +
                        '</button>' +

                        '<button class="p2-option shadow-xl" style="' + nashStyle('poll') + '" onclick="window._handleP2Option(\'' + tIdSafe + '\', \'poll\')">' +
                            '<span style="font-size:2rem;">🗳️</span>' +
                            '<div>' +
                            '<h4>Enquete entre Participantes</h4>' +
                            '<p>Os inscritos votam na solução que preferem. Defina um prazo e acompanhe a contagem regressiva.</p>' +
                            '</div>' +
                            nashPill('poll') +
                        '</button>';
                    })()}
                </div>
            </div>

            <div style="padding:1.5rem 2.5rem 2rem;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.1);border-top:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.8rem;color:#64748b;">Ajuste manual disponível no rascunho de chaveamento.</div>
                <button onclick="window._cancelPowerOf2Panel('${String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" style="background:transparent;color:#94a3b8;border:2px solid rgba(148,163,184,0.2);padding:10px 24px;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">Voltar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

// Cancelar painel de decisão e restaurar inscrições se suspensas
window._cancelPowerOf2Panel = function (tId) {
    const panel = document.getElementById('p2-resolution-panel');
    if (panel) panel.remove();
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (t && t._suspendedByPanel) {
        t.status = 'open';
        delete t._suspendedByPanel;
        window.AppStore.sync();
        const container = document.getElementById('view-container');
        if (container) renderTournaments(container, window.location.hash.split('/')[1]);
        showNotification('Inscrições Restauradas', 'As inscrições foram reabertas.', 'info');
    }
};

// (Check-in functions moved to participants.js)

// ═══════════════════════════════════════════════════════════
// ═══  ENQUETE ENTRE PARTICIPANTES (POLL SYSTEM)  ═════════
// ═══════════════════════════════════════════════════════════

// ── Nash Equilibrium Recommendation ──
// In a symmetric coordination game where all participants pick from the same options,
// the Nash equilibrium is the strategy that maximizes collective payoff.
// We model payoffs: each option has (fairness, inclusion, effort).
// Fairness = how equally all participants are treated.
// Inclusion = how many participants stay in the tournament.
// Effort = inverse of extra games/logistics needed.
// Nash equilibrium in pure strategies: the option where no individual gains by deviating,
// i.e., the option that is best-response for each player when all others pick it too.
// In practice this means the option with the highest weighted sum of payoff criteria.
window._computeNashRecommendation = function(pollOptions, context, info) {
    // Payoff matrix: rate each option 0-10 on (fairness, inclusion, effort)
    var payoffs = {
        // Incomplete teams context
        'reopen':   { fairness: 10, inclusion: 10, effort: 3 },  // fair but slow
        'lottery':  { fairness: 4,  inclusion: 8,  effort: 8 },  // bots reduce fairness
        'standby':  { fairness: 6,  inclusion: 4,  effort: 9 },  // excludes some
        'dissolve': { fairness: 7,  inclusion: 7,  effort: 4 },  // manual work
        // P2 context
        'bye':      { fairness: 6,  inclusion: 10, effort: 9 },  // some get free pass
        'playin':   { fairness: 8,  inclusion: 10, effort: 6 },  // extra games but fair
        'swiss':    { fairness: 9,  inclusion: 10, effort: 5 }   // fair, more games
    };

    // Context-specific adjustments
    if (info) {
        // If only 1-2 missing for P2, reopen is easiest
        if (info.missing && info.missing <= 2) {
            payoffs['reopen'] = { fairness: 10, inclusion: 10, effort: 8 };
        }
        // If BYE affects fewer than play-in
        if (info.missing && info.excess) {
            if (info.missing <= info.excess * 2) {
                payoffs['bye'] = payoffs['bye'] || {};
                payoffs['bye'].effort = 10;
            }
        }
    }

    // Weights: participants care most about fairness and inclusion
    var wFairness = 0.45, wInclusion = 0.35, wEffort = 0.20;

    var bestKey = '';
    var bestScore = -1;
    pollOptions.forEach(function(opt) {
        var p = payoffs[opt.key];
        if (!p) return;
        var score = p.fairness * wFairness + p.inclusion * wInclusion + p.effort * wEffort;
        if (score > bestScore) {
            bestScore = score;
            bestKey = opt.key;
        }
    });

    return bestKey;
};

// ── Poll Creation Dialog ──
// Organizer chooses which options to include and sets a deadline
window._showPollCreationDialog = function(tId, context, pollOptions) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t) return;

    var info = (context === 'p2') ? window.checkPowerOf2(t) : null;
    var nashRec = window._computeNashRecommendation(pollOptions, context, info);

    var existing = document.getElementById('poll-creation-dialog');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'poll-creation-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';

    var optionsHtml = pollOptions.map(function(opt) {
        var isNash = (opt.key === nashRec);
        var nashBadge = isNash ? '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:0.6rem;font-weight:800;background:rgba(16,185,129,0.15);color:#4ade80;border:1px solid rgba(16,185,129,0.3);margin-left:6px;vertical-align:middle;">⚖️ Nash</span>' : '';
        return '<label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.03)\'">' +
            '<input type="checkbox" checked value="' + opt.key + '" style="margin-top:3px;width:18px;height:18px;accent-color:#6366f1;cursor:pointer;">' +
            '<div style="flex:1;">' +
            '<div style="font-weight:700;font-size:0.9rem;color:var(--text-bright);">' + opt.icon + ' ' + opt.title + nashBadge + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">' + opt.desc + '</div>' +
            '</div>' +
            '</label>';
    }).join('');

    overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);width:95%;max-width:600px;border-radius:24px;border:1px solid rgba(99,102,241,0.3);box-shadow:0 30px 100px rgba(0,0,0,0.7);margin:auto;animation:fadeIn 0.2s ease;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#312e81 0%,#6366f1 100%);padding:1.5rem 2rem;">' +
        '<div style="display:flex;align-items:center;gap:15px;">' +
        '<span style="font-size:2.5rem;">🗳️</span>' +
        '<div>' +
        '<h3 style="margin:0;color:#e0e7ff;font-size:1.25rem;font-weight:800;">Criar Enquete</h3>' +
        '<p style="margin:4px 0 0;color:#a5b4fc;font-size:0.85rem;">Os participantes votarão na solução que preferem.</p>' +
        '</div>' +
        '</div>' +
        '</div>' +

        '<div style="padding:1.5rem 2rem;">' +
        '<div style="margin-bottom:1.25rem;">' +
        '<label style="font-size:0.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Opções da Enquete</label>' +
        '<p style="font-size:0.7rem;color:var(--text-muted);margin:4px 0 10px;">Desmarque opções que não deseja incluir. A opção com badge ⚖️ Nash é a recomendada pelo equilíbrio de Nash.</p>' +
        '<div id="poll-options-list" style="display:flex;flex-direction:column;gap:8px;">' + optionsHtml + '</div>' +
        '</div>' +

        '<div style="margin-bottom:1.25rem;">' +
        '<label style="font-size:0.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Prazo para Votação</label>' +
        '<div style="display:flex;gap:12px;margin-top:8px;">' +
        '<div style="flex:1;">' +
        '<label style="font-size:0.7rem;color:var(--text-muted);">Horas</label>' +
        '<input type="number" id="poll-deadline-hours" value="48" min="1" max="168" style="width:100%;padding:10px;border-radius:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:var(--text-bright);font-size:1rem;font-weight:700;text-align:center;">' +
        '</div>' +
        '<div style="display:flex;align-items:flex-end;padding-bottom:10px;color:var(--text-muted);font-size:0.85rem;">horas</div>' +
        '</div>' +
        '</div>' +

        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:12px;margin-bottom:1rem;">' +
        '<div style="font-size:0.75rem;font-weight:700;color:#4ade80;margin-bottom:4px;">⚖️ Equilíbrio de Nash</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);line-height:1.5;">A opção recomendada maximiza o equilíbrio entre <strong style="color:var(--text-bright);">justiça</strong> (todos em condições iguais), <strong style="color:var(--text-bright);">inclusão</strong> (ninguém excluído) e <strong style="color:var(--text-bright);">praticidade</strong> (menos logística extra). Nenhum participante ganharia individualmente ao desviar desta escolha se todos a adotassem.</div>' +
        '</div>' +
        '</div>' +

        '<div style="padding:1rem 2rem 1.5rem;display:flex;justify-content:flex-end;gap:12px;border-top:1px solid rgba(255,255,255,0.05);">' +
        '<button id="poll-cancel-btn" style="background:transparent;color:#94a3b8;border:2px solid rgba(148,163,184,0.2);padding:10px 20px;border-radius:12px;font-weight:600;font-size:0.85rem;cursor:pointer;">Cancelar</button>' +
        '<button id="poll-create-btn" style="background:linear-gradient(135deg,#6366f1,#818cf8);color:white;border:none;padding:10px 24px;border-radius:12px;font-weight:700;font-size:0.85rem;cursor:pointer;box-shadow:0 8px 20px rgba(99,102,241,0.3);">Criar Enquete</button>' +
        '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    document.getElementById('poll-cancel-btn').addEventListener('click', function() {
        overlay.remove();
    });

    document.getElementById('poll-create-btn').addEventListener('click', function() {
        var checkboxes = document.querySelectorAll('#poll-options-list input[type="checkbox"]');
        var selectedOptions = [];
        checkboxes.forEach(function(cb) {
            if (cb.checked) selectedOptions.push(cb.value);
        });
        if (selectedOptions.length < 2) {
            if (typeof showNotification === 'function') showNotification('Erro', 'Selecione pelo menos 2 opções para a enquete.', 'error');
            return;
        }
        var hours = parseInt(document.getElementById('poll-deadline-hours').value) || 48;
        if (hours < 1) hours = 1;
        if (hours > 168) hours = 168;

        // Create poll on tournament
        var pollData = {
            id: 'poll_' + Date.now(),
            context: context,
            status: 'active',
            options: [],
            votes: {},       // email → optionKey
            deadline: Date.now() + (hours * 3600000),
            createdAt: Date.now(),
            nashRecommendation: nashRec
        };

        // Build options from the full list, filtered by selection
        pollOptions.forEach(function(opt) {
            if (selectedOptions.indexOf(opt.key) !== -1) {
                pollData.options.push({
                    key: opt.key,
                    icon: opt.icon,
                    title: opt.title,
                    desc: opt.desc,
                    isNash: (opt.key === nashRec)
                });
            }
        });

        if (!t.polls) t.polls = [];
        t.polls.push(pollData);
        t.activePollId = pollData.id;

        // Suspend enrollments while poll is active
        if (t.status === 'open' || !t.status) {
            t._pollSuspended = true;
            t.status = 'closed';
        }

        // Add in-app notification markers for all participants
        var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];
        if (!t.pollNotifications) t.pollNotifications = [];
        parts.forEach(function(p) {
            if (typeof p !== 'object') return;
            var pEmail = p.email || '';
            if (!pEmail) return;
            t.pollNotifications.push({
                targetEmail: pEmail,
                pollId: pollData.id,
                timestamp: Date.now(),
                read: false
            });
        });

        window.AppStore.logAction(tId, 'Enquete criada: ' + selectedOptions.length + ' opções, prazo de ' + hours + 'h');

        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        } else {
            window.AppStore.sync();
        }

        // Send Firestore push notification to all participants
        if (typeof window._notifyTournamentParticipants === 'function') {
            window._notifyTournamentParticipants(t, {
                type: 'poll',
                level: 'important',
                title: '🗳️ Enquete aberta: ' + window._safeHtml(t.name),
                message: 'O organizador criou uma enquete para decidir o formato do torneio. Vote agora! Prazo: ' + hours + ' horas.',
                tournamentId: tId,
                pollId: pollData.id
            }, t.organizerEmail);
        }

        overlay.remove();
        if (typeof showNotification === 'function') {
            showNotification('Enquete Criada', 'Os participantes foram notificados para votar. Inscrições suspensas até o encerramento. Prazo: ' + hours + ' horas.', 'success');
        }

        // Re-render tournament detail
        window.location.hash = '#tournaments/' + tId;
    });
};

// ── Poll Voting UI (shown to participants) ──
window._showPollVotingDialog = function(tId, pollId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t || !t.polls) return;

    var poll = null;
    for (var i = 0; i < t.polls.length; i++) {
        if (t.polls[i].id === pollId) { poll = t.polls[i]; break; }
    }
    if (!poll) return;

    var user = window.AppStore.currentUser;
    var userEmail = (user && user.email) ? user.email : '';
    var userVote = poll.votes[userEmail] || null;
    var hasVoted = !!userVote;

    // Calculate time remaining
    var now = Date.now();
    var remaining = Math.max(0, poll.deadline - now);
    var isPollClosed = (remaining <= 0 || poll.status === 'closed');

    // Count votes per option
    var voteCounts = {};
    var totalVotes = 0;
    poll.options.forEach(function(opt) { voteCounts[opt.key] = 0; });
    Object.keys(poll.votes).forEach(function(email) {
        var k = poll.votes[email];
        if (voteCounts[k] !== undefined) voteCounts[k]++;
        totalVotes++;
    });

    var existing = document.getElementById('poll-voting-dialog');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'poll-voting-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';

    // Countdown string
    var countdownStr = '';
    if (isPollClosed) {
        countdownStr = '<span style="color:#f87171;font-weight:700;">Encerrada</span>';
    } else {
        var hrs = Math.floor(remaining / 3600000);
        var mins = Math.floor((remaining % 3600000) / 60000);
        var secs = Math.floor((remaining % 60000) / 1000);
        countdownStr = '<span style="color:#fbbf24;font-weight:700;" id="poll-countdown">' + hrs + 'h ' + mins + 'm ' + secs + 's</span>';
    }

    // Build options HTML
    var optionsHtml = poll.options.map(function(opt) {
        var isMyVote = (userVote === opt.key);
        var nashBadge = opt.isNash ? '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.6rem;font-weight:800;background:rgba(16,185,129,0.15);color:#4ade80;border:1px solid rgba(16,185,129,0.3);margin-left:6px;">⚖️ Recomendado</span>' : '';

        // Before voting: just show options and descriptions (no counts)
        // After voting or closed: show counts and own vote
        var voteInfo = '';
        if (hasVoted || isPollClosed) {
            var count = voteCounts[opt.key] || 0;
            var pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            voteInfo = '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">' +
                '<div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">' +
                '<div style="height:100%;background:' + (isMyVote ? '#6366f1' : 'rgba(255,255,255,0.2)') + ';border-radius:3px;width:' + pct + '%;transition:width 0.5s;"></div>' +
                '</div>' +
                '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;min-width:50px;text-align:right;">' + count + ' (' + pct + '%)</span>' +
                '</div>';
        }

        var myVoteBadge = isMyVote ? '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.6rem;font-weight:800;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);margin-left:6px;">Seu voto</span>' : '';

        var borderColor = isMyVote ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)';
        var bgColor = isMyVote ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)';

        var safeOptionKey = opt.key.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        var clickHandler = isPollClosed ? '' : ' onclick="window._castPollVote(\'' + tId + '\',\'' + pollId + '\',\'' + safeOptionKey + '\')"';
        var cursor = isPollClosed ? 'default' : 'pointer';

        return '<div class="poll-vote-option" style="padding:14px;border-radius:14px;background:' + bgColor + ';border:1.5px solid ' + borderColor + ';cursor:' + cursor + ';transition:all 0.2s;"' + clickHandler + '>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:1.3rem;">' + opt.icon + '</span>' +
            '<div style="flex:1;">' +
            '<div style="font-weight:700;font-size:0.9rem;color:var(--text-bright);">' + window._safeHtml(opt.title) + nashBadge + myVoteBadge + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">' + window._safeHtml(opt.desc) + '</div>' +
            '</div>' +
            '</div>' +
            voteInfo +
            '</div>';
    }).join('');

    var contextLabel = (poll.context === 'p2') ? 'Ajuste de Chaveamento' : 'Times Incompletos';

    overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);width:95%;max-width:560px;border-radius:24px;border:1px solid rgba(99,102,241,0.2);box-shadow:0 30px 80px rgba(0,0,0,0.6);margin:auto;animation:fadeIn 0.2s ease;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#312e81 0%,#6366f1 100%);padding:1.5rem 2rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:2rem;">🗳️</span>' +
        '<div>' +
        '<h3 style="margin:0;color:#e0e7ff;font-size:1.15rem;font-weight:800;">Enquete: ' + contextLabel + '</h3>' +
        '<p style="margin:4px 0 0;color:#a5b4fc;font-size:0.8rem;">Vote na solução que preferir' + (isPollClosed ? ' (encerrada)' : '') + '</p>' +
        '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
        '<div style="font-size:0.65rem;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.5px;">Tempo restante</div>' +
        '<div style="font-size:1rem;margin-top:2px;">' + countdownStr + '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +

        '<div style="padding:1.5rem 2rem;">' +
        ((!hasVoted && !isPollClosed) ? '<p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 1rem;">Clique em uma opção para votar. Você poderá mudar seu voto até o encerramento.</p>' : '') +
        '<div id="poll-vote-options" style="display:flex;flex-direction:column;gap:10px;">' + optionsHtml + '</div>' +
        (hasVoted ? '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:1rem;text-align:center;font-style:italic;">Você pode mudar seu voto clicando em outra opção' + (isPollClosed ? '' : ' até o encerramento') + '.</p>' : '') +
        '</div>' +

        '<div style="padding:1rem 2rem 1.5rem;display:flex;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.05);">' +
        '<button onclick="document.getElementById(\'poll-voting-dialog\').remove();" style="background:transparent;color:#94a3b8;border:2px solid rgba(148,163,184,0.2);padding:10px 20px;border-radius:12px;font-weight:600;font-size:0.85rem;cursor:pointer;">Fechar</button>' +
        '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    // Start countdown timer
    if (!isPollClosed) {
        var countdownEl = document.getElementById('poll-countdown');
        if (countdownEl) {
            var _pollTimer = setInterval(function() {
                var rem = Math.max(0, poll.deadline - Date.now());
                if (rem <= 0) {
                    countdownEl.textContent = 'Encerrada';
                    countdownEl.style.color = '#f87171';
                    clearInterval(_pollTimer);
                    // Auto-close poll
                    poll.status = 'closed';
                    if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                        window.FirestoreDB.saveTournament(t);
                    }
                    return;
                }
                var h = Math.floor(rem / 3600000);
                var m = Math.floor((rem % 3600000) / 60000);
                var s = Math.floor((rem % 60000) / 1000);
                countdownEl.textContent = h + 'h ' + m + 'm ' + s + 's';
            }, 1000);

            // Clear timer when dialog is removed
            var _observer = new MutationObserver(function(mutations) {
                if (!document.getElementById('poll-voting-dialog')) {
                    clearInterval(_pollTimer);
                    _observer.disconnect();
                }
            });
            _observer.observe(document.body, { childList: true });
        }
    }
};

// ── Cast a vote ──
window._castPollVote = function(tId, pollId, optionKey) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t || !t.polls) return;

    var poll = null;
    for (var i = 0; i < t.polls.length; i++) {
        if (t.polls[i].id === pollId) { poll = t.polls[i]; break; }
    }
    if (!poll || poll.status === 'closed') return;
    if (Date.now() > poll.deadline) {
        poll.status = 'closed';
        if (typeof showNotification === 'function') showNotification('Enquete Encerrada', 'O prazo para votação já expirou.', 'info');
        return;
    }

    var user = window.AppStore.currentUser;
    var userEmail = (user && user.email) ? user.email : '';
    if (!userEmail) {
        if (typeof showNotification === 'function') showNotification('Erro', 'Faça login para votar.', 'error');
        return;
    }

    // Only participants (or organizer) can vote
    var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];
    var isParticipant = parts.some(function(p) {
        if (typeof p === 'string') return p === userEmail || p === (user.displayName || '');
        return (p.email && p.email === userEmail) || (p.uid && user.uid && p.uid === user.uid) || (p.displayName && p.displayName === (user.displayName || ''));
    });
    var isOrganizer = (userEmail === t.organizerEmail);
    if (!isParticipant && !isOrganizer) {
        if (typeof showNotification === 'function') showNotification('Não Permitido', 'Apenas participantes inscritos podem votar na enquete.', 'warning');
        return;
    }

    var previousVote = poll.votes[userEmail] || null;
    poll.votes[userEmail] = optionKey;

    // Persist
    if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
        window.FirestoreDB.saveTournament(t);
    } else {
        window.AppStore.sync();
    }

    var optTitle = '';
    poll.options.forEach(function(o) { if (o.key === optionKey) optTitle = o.title; });

    if (typeof showNotification === 'function') {
        if (previousVote && previousVote !== optionKey) {
            showNotification('Voto Alterado', 'Seu voto foi atualizado para: ' + optTitle, 'success');
        } else {
            showNotification('Voto Registrado', 'Você votou em: ' + optTitle, 'success');
        }
    }

    // Re-render the voting dialog to show updated counts
    window._showPollVotingDialog(tId, pollId);
};

// ── Check for active polls and show notification to participant ──
window._checkPollNotifications = function(t) {
    if (!t || !t.pollNotifications || !t.polls) return;
    var user = window.AppStore.currentUser;
    if (!user || !user.email) return;

    var unreadNotifs = [];
    t.pollNotifications.forEach(function(n) {
        if (n.targetEmail === user.email && !n.read) {
            unreadNotifs.push(n);
        }
    });

    if (unreadNotifs.length === 0) return;

    // Find the active poll
    var activePoll = null;
    for (var i = 0; i < t.polls.length; i++) {
        if (t.polls[i].status === 'active' && Date.now() < t.polls[i].deadline) {
            activePoll = t.polls[i]; break;
        }
    }
    if (!activePoll) return;

    // Mark notifications as read
    unreadNotifs.forEach(function(n) { n.read = true; });

    // Calculate time remaining
    var remaining = Math.max(0, activePoll.deadline - Date.now());
    var hrs = Math.floor(remaining / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);
    var timeStr = hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + ' minutos';

    var contextLabel = (activePoll.context === 'p2') ? 'ajuste de chaveamento' : 'times incompletos';

    showAlertDialog(
        '🗳️ Enquete Aberta',
        'O organizador abriu uma enquete sobre <strong>' + contextLabel + '</strong> neste torneio.<br><br>' +
        'Tempo restante: <strong>' + timeStr + '</strong><br><br>' +
        'Vote na solução que preferir!',
        function() {
            window._showPollVotingDialog(String(t.id), activePoll.id);
        },
        { type: 'info', confirmText: 'Votar Agora', cancelText: 'Depois', showCancel: true }
    );

    // Persist read status
    if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
        window.FirestoreDB.saveTournament(t);
    }
};

// ── Show active poll banner in tournament detail ──
window._renderPollBanner = function(t) {
    if (!t || !t.polls) return '';
    var activePoll = null;
    for (var i = 0; i < t.polls.length; i++) {
        var p = t.polls[i];
        if (p.status === 'active') {
            if (Date.now() >= p.deadline) {
                p.status = 'closed';
                t.activePollId = null;
                if (typeof window._restorePollSuspendedEnrollments === 'function') {
                    window._restorePollSuspendedEnrollments(t);
                }
            } else {
                activePoll = p; break;
            }
        }
    }

    if (!activePoll) {
        // Check for recently closed polls (within last 24h) that need resolution
        var recentClosed = null;
        for (var j = 0; j < t.polls.length; j++) {
            if (t.polls[j].status === 'closed' && !t.polls[j].resolved && (Date.now() - t.polls[j].deadline < 86400000)) {
                recentClosed = t.polls[j]; break;
            }
        }
        if (recentClosed) {
            return window._renderClosedPollBanner(t, recentClosed);
        }
        return '';
    }

    var remaining = Math.max(0, activePoll.deadline - Date.now());
    var hrs = Math.floor(remaining / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);
    var timeStr = hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + 'm';

    var totalVotes = Object.keys(activePoll.votes).length;
    var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];
    var totalParticipants = parts.length;

    var user = window.AppStore.currentUser;
    var userEmail = (user && user.email) ? user.email : '';
    var hasVoted = !!activePoll.votes[userEmail];
    var isOrganizer = (user && user.email === t.organizerEmail);

    var btnText = hasVoted ? 'Ver / Alterar Voto' : 'Votar Agora';
    var statusText = hasVoted ? '✅ Você já votou' : '⏳ Aguardando seu voto';

    var closeBtn = isOrganizer
        ? '<button onclick="event.stopPropagation();window._closePollEarly(\'' + t.id + '\',\'' + activePoll.id + '\')" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:8px 14px;border-radius:10px;font-weight:700;font-size:0.78rem;cursor:pointer;white-space:nowrap;">Encerrar Agora</button>'
        : '';

    return '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08));border:2px solid rgba(99,102,241,0.4);border-radius:20px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;box-shadow:0 4px 20px rgba(99,102,241,0.1);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
        '<div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">🗳️</div>' +
        '<div>' +
        '<div style="font-weight:900;font-size:1.25rem;color:var(--text-bright);letter-spacing:0.02em;">ENQUETE</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">' + statusText + ' · ' + totalVotes + '/' + totalParticipants + ' votos</div>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="text-align:center;background:rgba(0,0,0,0.2);padding:8px 16px;border-radius:12px;">' +
        '<div style="font-size:1.6rem;font-weight:900;color:#a5b4fc;line-height:1;font-variant-numeric:tabular-nums;">' + timeStr + '</div>' +
        '<div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">restante</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
        '<button onclick="event.stopPropagation();window._showPollVotingDialog(\'' + t.id + '\',\'' + activePoll.id + '\')" style="background:linear-gradient(135deg,#6366f1,#818cf8);color:white;border:none;padding:10px 22px;border-radius:12px;font-weight:700;font-size:0.85rem;cursor:pointer;white-space:nowrap;flex:1;min-width:140px;">' + btnText + '</button>' +
        closeBtn +
        '</div>' +
        '<div style="margin-top:8px;font-size:0.68rem;color:var(--text-muted);opacity:0.7;">Inscrições suspensas durante a enquete.</div>' +
        '</div>';
};

// ── Closed poll banner — organizer can apply the result ──
window._renderClosedPollBanner = function(t, poll) {
    // Find winner
    var voteCounts = {};
    var totalVotes = 0;
    poll.options.forEach(function(opt) { voteCounts[opt.key] = 0; });
    Object.keys(poll.votes).forEach(function(email) {
        var k = poll.votes[email];
        if (voteCounts[k] !== undefined) voteCounts[k]++;
        totalVotes++;
    });

    var winnerKey = '';
    var winnerCount = 0;
    var winnerTitle = '';
    poll.options.forEach(function(opt) {
        if ((voteCounts[opt.key] || 0) > winnerCount) {
            winnerCount = voteCounts[opt.key];
            winnerKey = opt.key;
            winnerTitle = opt.title;
        }
    });

    var pct = totalVotes > 0 ? Math.round((winnerCount / totalVotes) * 100) : 0;
    var user = window.AppStore.currentUser;
    var isOrganizer = (user && user.email === t.organizerEmail);

    var applyBtn = isOrganizer
        ? '<button onclick="window._applyPollResult(\'' + t.id + '\',\'' + poll.id + '\')" style="background:linear-gradient(135deg,#10b981,#34d399);color:white;border:none;padding:8px 18px;border-radius:10px;font-weight:700;font-size:0.8rem;cursor:pointer;white-space:nowrap;">Aplicar Resultado</button>'
        : '';
    var reopenBtn = isOrganizer
        ? '<button onclick="window._reopenPoll(\'' + t.id + '\',\'' + poll.id + '\')" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);padding:8px 14px;border-radius:10px;font-weight:700;font-size:0.78rem;cursor:pointer;white-space:nowrap;">Reabrir Enquete</button>'
        : '';
    var viewBtn = '<button onclick="window._showPollVotingDialog(\'' + t.id + '\',\'' + poll.id + '\')" style="background:rgba(255,255,255,0.05);color:var(--text-bright);border:1px solid rgba(255,255,255,0.1);padding:8px 14px;border-radius:10px;font-weight:600;font-size:0.8rem;cursor:pointer;white-space:nowrap;">Ver Detalhes</button>';

    return '<div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));border:2px solid rgba(16,185,129,0.35);border-radius:20px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;box-shadow:0 4px 20px rgba(16,185,129,0.08);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
        '<div style="width:48px;height:48px;background:linear-gradient(135deg,#10b981,#34d399);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">✅</div>' +
        '<div>' +
        '<div style="font-weight:900;font-size:1.25rem;color:var(--text-bright);letter-spacing:0.02em;">ENQUETE ENCERRADA</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Resultado: <strong style="color:#4ade80;">' + winnerTitle + '</strong> (' + pct + '% · ' + winnerCount + '/' + totalVotes + ' votos)</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' + viewBtn + applyBtn + reopenBtn + '</div>' +
        '</div>';
};

// ── Close poll early (organizer) ──
window._closePollEarly = function(tId, pollId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t || !t.polls) return;
    var poll = null;
    for (var i = 0; i < t.polls.length; i++) {
        if (t.polls[i].id === pollId) { poll = t.polls[i]; break; }
    }
    if (!poll || poll.status !== 'active') return;

    if (typeof showConfirmDialog === 'function') {
        showConfirmDialog(
            'Encerrar enquete agora?',
            'A votação será encerrada imediatamente. Você poderá aplicar o resultado e prosseguir com o sorteio.',
            function() {
                poll.status = 'closed';
                poll.deadline = Date.now();
                t.activePollId = null;

                // Restore enrollments if suspended by poll
                if (t._pollSuspended) {
                    t.status = 'open';
                    delete t._pollSuspended;
                }

                window.AppStore.logAction(tId, 'Enquete encerrada antecipadamente pelo organizador');
                if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                    window.FirestoreDB.saveTournament(t);
                } else {
                    window.AppStore.sync();
                }
                if (typeof showNotification === 'function') {
                    showNotification('Enquete Encerrada', 'Votação encerrada. Aplique o resultado para prosseguir.', 'info');
                }
                window.location.hash = '#tournaments/' + tId;
            }
        );
    }
};

// ── Restore enrollments helper (called when poll auto-closes) ──
window._restorePollSuspendedEnrollments = function(t) {
    if (t && t._pollSuspended) {
        t.status = 'open';
        delete t._pollSuspended;
    }
};

// ── Reopen a closed poll (organizer can reconfigure deadline) ──
window._reopenPoll = function(tId, pollId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t || !t.polls) return;
    var poll = null;
    for (var i = 0; i < t.polls.length; i++) {
        if (t.polls[i].id === pollId) { poll = t.polls[i]; break; }
    }
    if (!poll) return;

    if (typeof showInputDialog === 'function') {
        showInputDialog('Reabrir Enquete', 'Novo prazo em horas:', '48', function(val) {
            var hours = parseInt(val) || 48;
            if (hours < 1) hours = 1;
            if (hours > 168) hours = 168;

            poll.status = 'active';
            poll.deadline = Date.now() + (hours * 3600000);
            poll.resolved = false;
            poll.resolvedOption = null;
            poll.resolvedAt = null;
            t.activePollId = poll.id;

            // Suspend enrollments again
            if (t.status === 'open' || !t.status) {
                t._pollSuspended = true;
                t.status = 'closed';
            }

            window.AppStore.logAction(tId, 'Enquete reaberta pelo organizador: prazo de ' + hours + 'h');
            if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                window.FirestoreDB.saveTournament(t);
            } else {
                window.AppStore.sync();
            }

            // Notify participants about reopened poll
            if (typeof window._notifyTournamentParticipants === 'function') {
                window._notifyTournamentParticipants(t, {
                    type: 'poll',
                    level: 'important',
                    title: '🗳️ Enquete reaberta: ' + window._safeHtml(t.name),
                    message: 'A enquete foi reaberta pelo organizador. Vote novamente! Novo prazo: ' + hours + ' horas.',
                    tournamentId: tId,
                    pollId: poll.id
                }, t.organizerEmail);
            }

            if (typeof showNotification === 'function') {
                showNotification('Enquete Reaberta', 'Participantes notificados. Novo prazo: ' + hours + ' horas.', 'success');
            }
            window.location.hash = '#tournaments/' + tId;
        });
    }
};

// ── Apply poll result — trigger the winning option's action ──
window._applyPollResult = function(tId, pollId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t || !t.polls) return;

    var poll = null;
    for (var i = 0; i < t.polls.length; i++) {
        if (t.polls[i].id === pollId) { poll = t.polls[i]; break; }
    }
    if (!poll) return;

    // Restore enrollments if suspended by poll
    if (t._pollSuspended) {
        t.status = 'open';
        delete t._pollSuspended;
    }

    // Find winner
    var voteCounts = {};
    poll.options.forEach(function(opt) { voteCounts[opt.key] = 0; });
    Object.keys(poll.votes).forEach(function(email) {
        var k = poll.votes[email];
        if (voteCounts[k] !== undefined) voteCounts[k]++;
    });

    var winnerKey = '';
    var winnerCount = 0;
    poll.options.forEach(function(opt) {
        if ((voteCounts[opt.key] || 0) > winnerCount) {
            winnerCount = voteCounts[opt.key];
            winnerKey = opt.key;
        }
    });

    if (!winnerKey) return;

    poll.resolved = true;
    poll.resolvedOption = winnerKey;
    poll.resolvedAt = Date.now();
    t.activePollId = null;

    window.AppStore.logAction(tId, 'Resultado da enquete aplicado: ' + winnerKey);

    if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
        window.FirestoreDB.saveTournament(t);
    } else {
        window.AppStore.sync();
    }

    // Trigger the winning option's action
    if (poll.context === 'incomplete') {
        window._handleIncompleteOption(tId, winnerKey);
    } else if (poll.context === 'p2') {
        window._handleP2Option(tId, winnerKey);
    }
};

window._handleP2Option = function (tId, option) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    const info = window.checkPowerOf2(t);

    if (option === 'bye' || option === 'playin' || option === 'standby' || option === 'swiss') {
        window.showResolutionSimulationPanel(tId, option);
        return;
    }

    if (option === 'reopen') {
        // Show dedicated reopen panel — hide p2 panel but keep it in DOM to return to
        const p2Panel = document.getElementById('p2-resolution-panel');
        if (p2Panel) p2Panel.style.display = 'none';
        window._showReopenPanel(tId, info);
        return;
    }

    if (option === 'poll') {
        const p2Panel = document.getElementById('p2-resolution-panel');
        if (p2Panel) p2Panel.remove();
        // Collect poll options from P2 context
        var pollOptions = [
            { key: 'reopen', icon: '↩️', title: 'Reabrir Inscrições', desc: 'Aguardar mais ' + info.missing + ' inscritos para chegar a ' + info.hi + '. Igualdade total.' },
            { key: 'bye', icon: '🥇', title: 'Aplicar BYE', desc: info.missing + ' participantes avançam direto para a 2ª rodada. Chaveamento de ' + info.hi + '.' },
            { key: 'playin', icon: '🔁', title: 'Play-in (Repescagem)', desc: (info.excess * 2) + ' participantes disputam ' + info.excess + ' vaga(s). Vencedores enfrentam quem avançou direto.' },
            { key: 'standby', icon: '⏱️', title: 'Lista de Espera', desc: info.excess + ' participantes vão para lista de espera. Chaveamento de ' + info.lo + '.' },
            { key: 'swiss', icon: '🏅', title: 'Formato Suíço', desc: 'Mais jogos para todos antes de afunilar para os melhores ' + info.lo + '.' }
        ];
        window._showPollCreationDialog(tId, 'p2', pollOptions);
        return;
    }
};

// ─── Painel de Reabertura de Inscrições ───
window._showReopenPanel = function (tId, info) {
    const overlay = document.createElement('div');
    overlay.id = 'reopen-panel';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding:2rem;overflow-y:auto;';
    overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:20px;width:100%;max-width:480px;box-shadow:0 25px 60px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);margin:auto 0;">
            <div style="padding:2rem 2.5rem 1.5rem;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem;">
                    <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🔓</div>
                    <div>
                        <h3 style="margin:0;color:#f1f5f9;font-size:1.2rem;font-weight:700;">Reabrir Inscrições</h3>
                        <p style="margin:2px 0 0;color:#64748b;font-size:0.85rem;">Aguardando novos participantes</p>
                    </div>
                </div>

                <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <span style="color:#94a3b8;font-size:0.85rem;">Inscritos atuais</span>
                        <span style="color:#f1f5f9;font-weight:700;font-size:1.1rem;">${info.count}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <span style="color:#94a3b8;font-size:0.85rem;">Próxima potência de 2</span>
                        <span style="color:#3b82f6;font-weight:700;font-size:1.1rem;">${info.hi}</span>
                    </div>
                    <div style="border-top:1px solid rgba(59,130,246,0.15);padding-top:0.75rem;display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#94a3b8;font-size:0.85rem;">Faltam para completar</span>
                        <span style="color:#fbbf24;font-weight:800;font-size:1.3rem;">${info.missing}</span>
                    </div>
                </div>

                <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:1rem;" id="reopen-autoclose-label">
                    <input type="checkbox" id="reopen-autoclose-cb" checked style="width:20px;height:20px;margin-top:2px;accent-color:#3b82f6;cursor:pointer;flex-shrink:0;" />
                    <div>
                        <div style="color:#e2e8f0;font-weight:600;font-size:0.95rem;">Encerrar automaticamente ao atingir ${info.hi} inscritos</div>
                        <div style="color:#64748b;font-size:0.8rem;margin-top:4px;">As inscrições serão fechadas automaticamente quando o número de participantes alcançar ${info.hi}.</div>
                    </div>
                </label>
            </div>

            <div style="padding:1.25rem 2.5rem 1.75rem;display:flex;gap:12px;justify-content:flex-end;background:rgba(0,0,0,0.1);border-top:1px solid rgba(255,255,255,0.05);border-radius:0 0 20px 20px;">
                <button onclick="document.getElementById('reopen-panel').remove(); var p2=document.getElementById('p2-resolution-panel'); if(p2) p2.style.display='flex';" style="background:transparent;color:#94a3b8;border:2px solid rgba(148,163,184,0.2);padding:10px 24px;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">Voltar</button>
                <button onclick="window._confirmReopen('${String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${info.hi})" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;padding:10px 28px;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 15px rgba(59,130,246,0.3);transition:all 0.2s;">Confirmar Reabertura</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window._confirmReopen = function (tId, target) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    const autoClose = document.getElementById('reopen-autoclose-cb');
    const checked = autoClose ? autoClose.checked : false;

    t.status = 'open';
    t.maxParticipants = target;
    t.autoCloseOnFull = checked;

    const actionMsg = checked
        ? `Inscrições Reabertas para atingir ${target} participantes (encerramento automático ativado)`
        : `Inscrições Reabertas para atingir ${target} participantes`;

    window.AppStore.logAction(tId, actionMsg);
    window.AppStore.sync();

    if (document.getElementById('reopen-panel')) document.getElementById('reopen-panel').remove();
    if (document.getElementById('p2-resolution-panel')) document.getElementById('p2-resolution-panel').remove();

    const container = document.getElementById('view-container');
    if (container) renderTournaments(container, window.location.hash.split('/')[1]);
    showNotification('Torneio Reaberto', checked ? `Inscrições abertas até ${target} participantes (encerramento automático).` : 'Aguardando novas inscrições.', 'info');
};

// ─── Encerrar Torneio (manual) ───
window.finishTournament = function(tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;
    if (t.status === 'finished') {
        showNotification('Já encerrado', 'Este torneio já está encerrado.', 'info');
        return;
    }
    const hasResults = (Array.isArray(t.matches) && t.matches.some(function(m) { return !!m.winner; })) ||
        (Array.isArray(t.rounds) && t.rounds.some(function(r) { return (r.matches || []).some(function(m) { return !!m.winner; }); })) ||
        (Array.isArray(t.groups) && t.groups.some(function(g) { return (g.rounds || []).some(function(r) { return (r.matches || []).some(function(m) { return !!m.winner; }); }); }));
    const pendingMatches = (Array.isArray(t.matches) && t.matches.filter(function(m) { return !m.isBye && m.p1 && m.p1 !== 'TBD' && m.p2 && m.p2 !== 'TBD' && !m.winner; }).length) || 0;
    let msg = 'Deseja encerrar este torneio? Esta ação marca o torneio como finalizado.';
    if (pendingMatches > 0) {
        msg = 'Ainda há ' + pendingMatches + ' partida(s) sem resultado. Deseja encerrar o torneio mesmo assim? Os resultados pendentes ficarão sem registro.';
    }
    showConfirmDialog(
        '🏁 Encerrar Torneio',
        msg,
        function() {
            t.status = 'finished';
            // Compute final standings for Swiss/Liga
            if (Array.isArray(t.rounds) && t.rounds.length > 0 && typeof window._computeStandings === 'function') {
                t.standings = window._computeStandings(t);
            }
            window.AppStore.logAction(tId, 'Torneio encerrado manualmente');
            window.AppStore.sync();
            const container = document.getElementById('view-container');
            if (container) renderTournaments(container, tId);
            showNotification('🏆 Torneio Encerrado', '"' + t.name + '" foi encerrado com sucesso.', 'success');
        },
        null,
        { type: 'warning', confirmText: 'Encerrar Torneio', cancelText: 'Cancelar' }
    );
};

// ─── Painel Integrado de Encerramento ───
window.toggleRegistrationStatus = function (tId) {
    console.log('[toggleRegistrationStatus] called with tId:', tId);
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t) { console.warn('toggleRegistrationStatus: tournament not found', tId); return; }
    console.log('[toggleRegistrationStatus] tournament found, status:', t.status);

    // Helper: save tournament with fallback
    var _saveTournament = function(callback) {
        if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
            console.log('[toggleRegistrationStatus] saving via FirestoreDB...');
            window.FirestoreDB.saveTournament(t).then(function() {
                console.log('[toggleRegistrationStatus] save OK');
                if (callback) callback();
            }).catch(function(err) {
                console.error('[toggleRegistrationStatus] save error:', err);
                // Fallback: try AppStore.sync
                try { window.AppStore.sync(); } catch(e) { console.error('sync fallback error:', e); }
                if (callback) callback();
                if (typeof showNotification === 'function') showNotification('Aviso', 'Salvo localmente. Pode demorar a sincronizar.', 'warning');
            });
        } else {
            console.log('[toggleRegistrationStatus] no FirestoreDB, using AppStore.sync');
            try { window.AppStore.sync(); } catch(e) { console.error('sync error:', e); }
            if (callback) callback();
        }
    };

    var _refreshView = function() {
        var container = document.getElementById('view-container');
        if (container && typeof renderTournaments === 'function') {
            renderTournaments(container, String(tId));
        }
    };

    if (t.status === 'closed') {
        // Impedir reabertura se já houve sorteio
        var hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
        if (hasDraw) {
            if (typeof showAlertDialog === 'function') showAlertDialog('Não Permitido', 'Não é possível reabrir inscrições após o sorteio ter sido realizado.', null, { type: 'warning' });
            return;
        }
        if (typeof showConfirmDialog !== 'function') { console.error('showConfirmDialog not available'); return; }
        showConfirmDialog('Reabrir Inscrições', 'Deseja reabrir as inscrições do torneio "' + window._safeHtml(t.name || '') + '"?' + (t.activePollId ? ' A enquete ativa será encerrada.' : ''), function() {
            t.status = 'open';
            delete t._pollSuspended;
            // Auto-close active poll when reopening inscriptions
            if (t.activePollId && t.polls) {
                for (var _pi = 0; _pi < t.polls.length; _pi++) {
                    if (t.polls[_pi].id === t.activePollId && t.polls[_pi].status === 'active') {
                        t.polls[_pi].status = 'closed';
                        t.polls[_pi].deadline = Date.now();
                        window.AppStore.logAction(tId, 'Enquete encerrada automaticamente ao reabrir inscrições');
                        break;
                    }
                }
                t.activePollId = null;
            }
            window.AppStore.logAction(tId, 'Inscrições Reabertas');
            _saveTournament(function() {
                _refreshView();
                if (typeof showNotification === 'function') showNotification('Inscrições Reabertas', 'Novas inscrições podem ser feitas.', 'info');
            });
        });
        return;
    }

    // Verificar potência de 2 para formatos eliminatórios
    var isElim = t.format === 'Eliminatórias Simples' || t.format === 'Dupla Eliminatória';
    if (isElim) {
        var arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
        if (arr.length < 2) {
            if (typeof showAlertDialog === 'function') showAlertDialog('Inscritos Insuficientes', 'São necessários pelo menos 2 participantes para encerrar as inscrições.', null, { type: 'warning' });
            return;
        }
        if (typeof window.checkPowerOf2 === 'function') {
            var info = window.checkPowerOf2(t);
            if (!info.isPowerOf2) {
                window.showPowerOf2Panel(tId);
                return;
            }
        }
    }

    // Confirmar antes de encerrar
    if (typeof showConfirmDialog !== 'function') { console.error('showConfirmDialog not available'); return; }
    showConfirmDialog('Encerrar Inscrições', 'Deseja encerrar as inscrições do torneio "' + window._safeHtml(t.name || '') + '"? Novos participantes não poderão se inscrever.', function() {
        console.log('[toggleRegistrationStatus] user confirmed close');
        t.status = 'closed';
        window.AppStore.logAction(tId, 'Inscrições Encerradas manualmente');
        _saveTournament(function() {
            _refreshView();
            if (typeof showNotification === 'function') showNotification('Inscrições Encerradas', 'O torneio foi fechado para novas inscrições.', 'success');
        });
    });
};

window._handleClosureOption = function (tId, option) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
    if (!t) return;

    if (option === 'just_close') {
        t.status = 'closed';
        window.AppStore.logAction(tId, 'Inscrições Encerradas manualmente');
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t).then(function() {
                var container = document.getElementById('view-container');
                if (container) renderTournaments(container, String(tId));
                if (document.getElementById('closure-panel')) document.getElementById('closure-panel').remove();
            }).catch(function(err) { console.error('_handleClosureOption error:', err); });
        }
    }
};
// ─── Anonymous Simulation Previews ───
window.showResolutionSimulationPanel = function (tId, option) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;
    const info = window.checkPowerOf2(t);

    const existing = document.getElementById('simulation-panel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'simulation-panel';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);z-index:999999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 0;';

    let simulationHtml = '';
    if (option === 'bye') {
        const totalSpots = info.hi;
        const byes = info.missing;
        const activeTeams = info.count;
        const matchesCount = (info.count - byes) / 2;

        simulationHtml = `
            <div style="text-align:center;margin-bottom:2rem;">
                <span style="font-size:3rem;display:block;margin-bottom:1rem;">🥇</span>
                <h3 style="color:white;font-size:1.5rem;font-weight:900;margin:0;">Simulação de BYE (Avanço Direto)</h3>
                <p style="color:#94a3b8;margin:8px 0 0;">Chave de ${totalSpots} vagas configurada.</p>
            </div>
            
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:1.5rem;margin-bottom:2rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;text-align:center;">
                    <div style="background:rgba(34,197,94,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(34,197,94,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#4ade80;">${byes}</div>
                        <div style="font-size:0.7rem;color:#86efac;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">Avançam com BYE</div>
                    </div>
                    <div style="background:rgba(96,165,250,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(96,165,250,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#60a5fa;">${matchesCount}</div>
                        <div style="font-size:0.7rem;color:#93c5fd;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">Partidas da 1ª Rodada</div>
                    </div>
                </div>
            </div>

            <div style="max-height:300px;overflow-y:auto;padding-right:10px;mask-image:linear-gradient(to bottom, black 80%, transparent 100%);">
                <h4 style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Esqueleto de Confrontos (R1)</h4>
                ${Array.from({ length: byes }).map((_, i) => `
                    <div style="background:rgba(255,255,255,0.02);padding:12px 15px;border-radius:12px;margin-bottom:8px;border-left:4px solid #4ade80;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;font-weight:700;color:#e2e8f0;">Participante ${i + 1}</span>
                        <span style="font-size:0.65rem;font-weight:800;color:#4ade80;text-transform:uppercase;background:rgba(34,197,94,0.2);padding:2px 8px;border-radius:6px;">Avança direto</span>
                    </div>
                `).join('')}
                ${Array.from({ length: matchesCount }).map((_, i) => `
                    <div style="background:rgba(255,255,255,0.02);padding:12px 15px;border-radius:12px;margin-bottom:8px;border-left:4px solid #60a5fa;">
                        <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:0.75rem;margin-bottom:4px;">
                            <span>Partida #${i + 1}</span>
                            <span>Confronto</span>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:4px;">
                            <span style="font-size:0.85rem;font-weight:700;color:#e2e8f0;">Participante ${byes + (i * 2) + 1}</span>
                            <span style="font-size:0.85rem;font-weight:700;color:#e2e8f0;">Participante ${byes + (i * 2) + 2}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (option === 'playin') {
        const teamSize = parseInt(t.teamSize) || 1;
        const totalTeams = Math.floor(info.count / teamSize);
        const tLabel = (num) => teamSize > 1 ? `Time ${num}` : `Participante ${num}`;

        // New repechage model:
        // R1: all teams play → winners advance directly
        // Repechage: losers face each other → top Y classified advance to fill bracket to P2
        const matchesR1 = Math.floor(totalTeams / 2);
        const winnersR1 = matchesR1;
        const losersR1 = matchesR1;
        // R2 target = next power of 2 >= winnersR1
        let r2Target = 1;
        while (r2Target < winnersR1) r2Target *= 2;
        const spotsFromRepechage = r2Target - winnersR1;
        const repechageMatches = Math.floor(losersR1 / 2);
        const repechageWinners = repechageMatches;
        // How many need to qualify via tiebreaker (beyond repechage winners)
        const tiebreakSpots = Math.max(0, spotsFromRepechage - repechageWinners);
        const matchesR2 = r2Target / 2;

        // Match card builder
        const matchCard = (header, headerColor, borderColor, num, t1, t2, t1Color, t2Color) => `
            <div style="background:rgba(15,23,42,0.8);border:1px solid ${borderColor};border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);margin-bottom:10px;">
                <div style="font-size:0.65rem;font-weight:700;color:${headerColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">${header} ${num}</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid ${t1Color};margin-bottom:4px;">
                    <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${t1}</span>
                </div>
                <div style="text-align:center;font-size:0.6rem;color:#64748b;font-weight:800;letter-spacing:2px;padding:2px 0;">VS</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid ${t2Color};">
                    <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${t2}</span>
                </div>
            </div>`;

        // R1 cards — all teams play
        let r1Html = '';
        for (let i = 0; i < matchesR1; i++) {
            r1Html += matchCard('Jogo', '#38bdf8', 'rgba(255,255,255,0.08)',
                i + 1, tLabel((i * 2) + 1), tLabel((i * 2) + 2),
                'rgba(16,185,129,0.4)', 'rgba(239,68,68,0.4)');
        }

        // Repechage cards — losers face each other (purple accent)
        let repHtml = '';
        for (let i = 0; i < repechageMatches; i++) {
            repHtml += matchCard('Repescagem', '#a78bfa', 'rgba(139,92,246,0.25)',
                i + 1, `Derrotado Jogo ${(i * 2) + 1}`, `Derrotado Jogo ${(i * 2) + 2}`,
                'rgba(139,92,246,0.4)', 'rgba(139,92,246,0.4)');
        }

        // R2 cards — CROSS-SEEDING: pair R1 winners vs repechage classified
        // For fairness, each R2 match should pit a direct qualifier (R1 winner)
        // against a repechage qualifier whenever possible.
        let r2Html = '';
        let r2Slots = []; // build slot pairs first
        let r1Pool = [];  // R1 winners
        let repPool = []; // repechage classified
        for (let i = 1; i <= winnersR1; i++) {
            r1Pool.push({ name: `Vencedor Jogo ${i}`, color: 'rgba(16,185,129,0.4)', isRep: false });
        }
        for (let i = 1; i <= spotsFromRepechage; i++) {
            repPool.push({ name: `Classificado Rep. ${i}`, color: 'rgba(139,92,246,0.4)', isRep: true });
        }
        // Cross-seed: pair one from each pool as much as possible
        while (r1Pool.length > 0 && repPool.length > 0) {
            r2Slots.push([r1Pool.shift(), repPool.shift()]);
        }
        // Remaining same-pool pairs (if pools are uneven)
        let remaining = r1Pool.concat(repPool);
        while (remaining.length >= 2) {
            r2Slots.push([remaining.shift(), remaining.shift()]);
        }
        for (let i = 0; i < r2Slots.length; i++) {
            let s1 = r2Slots[i][0];
            let s2 = r2Slots[i][1];
            let crossBadge = (s1.isRep !== s2.isRep) ? '<span style="position:absolute;top:6px;right:8px;font-size:0.55rem;font-weight:800;color:#fbbf24;background:rgba(245,158,11,0.12);padding:1px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">Cross-seed</span>' : '';
            r2Html += `
            <div style="position:relative;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);margin-bottom:10px;">
                ${crossBadge}
                <div style="font-size:0.65rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">R2 — Jogo ${i + 1}</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid ${s1.color};margin-bottom:4px;">
                    <span style="font-weight:600;font-size:0.85rem;color:${s1.isRep ? '#a78bfa' : '#e2e8f0'};${s1.isRep ? 'font-style:italic;' : ''}">${s1.name}</span>
                </div>
                <div style="text-align:center;font-size:0.6rem;color:#64748b;font-weight:800;letter-spacing:2px;padding:2px 0;">VS</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid ${s2.color};">
                    <span style="font-weight:600;font-size:0.85rem;color:${s2.isRep ? '#a78bfa' : '#e2e8f0'};${s2.isRep ? 'font-style:italic;' : ''}">${s2.name}</span>
                </div>
            </div>`;
        }

        // Tiebreaker note
        const tiebreakNote = tiebreakSpots > 0
            ? `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:12px;margin-top:1rem;">
                <div style="font-size:0.78rem;color:#fbbf24;font-weight:700;margin-bottom:4px;">Critério de Desempate</div>
                <div style="font-size:0.75rem;color:#94a3b8;line-height:1.5;">${repechageWinners} vencedores da repescagem avançam direto. Mais ${tiebreakSpots} classificado(s) entre os derrotados da repescagem avança(m) por critério de desempate (saldo de pontos, sets, etc).</div>
               </div>`
            : `<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;margin-top:1rem;">
                <div style="font-size:0.75rem;color:#86efac;line-height:1.5;">Todos os ${spotsFromRepechage} vencedores da repescagem avançam para a R2.</div>
               </div>`;

        simulationHtml = `
            <div style="text-align:center;margin-bottom:2rem;">
                <span style="font-size:3rem;display:block;margin-bottom:1rem;">🔁</span>
                <h3 style="color:white;font-size:1.5rem;font-weight:900;margin:0;">Simulação de Repescagem</h3>
                <p style="color:#94a3b8;margin:8px 0 0;">Todos jogam a R1. Derrotados disputam repescagem para completar a R2 em ${r2Target}.</p>
            </div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:1.5rem;margin-bottom:2rem;">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
                    <div style="background:rgba(34,197,94,0.1);padding:0.8rem 0.5rem;border-radius:16px;border:1px solid rgba(34,197,94,0.2);">
                        <div style="font-size:1.4rem;font-weight:900;color:#4ade80;">${totalTeams}</div>
                        <div style="font-size:0.62rem;color:#86efac;text-transform:uppercase;font-weight:800;letter-spacing:0.5px;margin-top:4px;">${teamSize > 1 ? 'Times' : 'Participantes'}</div>
                    </div>
                    <div style="background:rgba(96,165,250,0.1);padding:0.8rem 0.5rem;border-radius:16px;border:1px solid rgba(96,165,250,0.2);">
                        <div style="font-size:1.4rem;font-weight:900;color:#60a5fa;">${matchesR1}</div>
                        <div style="font-size:0.62rem;color:#93c5fd;text-transform:uppercase;font-weight:800;letter-spacing:0.5px;margin-top:4px;">Jogos R1</div>
                    </div>
                    <div style="background:rgba(139,92,246,0.1);padding:0.8rem 0.5rem;border-radius:16px;border:1px solid rgba(139,92,246,0.2);">
                        <div style="font-size:1.4rem;font-weight:900;color:#8b5cf6;">${repechageMatches}</div>
                        <div style="font-size:0.62rem;color:#a78bfa;text-transform:uppercase;font-weight:800;letter-spacing:0.5px;margin-top:4px;">Repescagem</div>
                    </div>
                    <div style="background:rgba(245,158,11,0.1);padding:0.8rem 0.5rem;border-radius:16px;border:1px solid rgba(245,158,11,0.2);">
                        <div style="font-size:1.4rem;font-weight:900;color:#f59e0b;">${spotsFromRepechage}</div>
                        <div style="font-size:0.62rem;color:#fbbf24;text-transform:uppercase;font-weight:800;letter-spacing:0.5px;margin-top:4px;">Vagas Rep.</div>
                    </div>
                </div>
            </div>

            <div style="max-height:500px;overflow-y:auto;padding-right:10px;padding-bottom:1rem;">
                <h4 style="color:#38bdf8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Rodada 1 — Todos Jogam (${matchesR1} ${matchesR1 === 1 ? 'partida' : 'partidas'})</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${r1Html}
                </div>

                <div style="text-align:center;margin:1.5rem 0;padding:10px;background:rgba(255,255,255,0.02);border-radius:12px;">
                    <div style="font-size:0.7rem;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${winnersR1} Vencedores → avançam direto para R2</div>
                    <div style="font-size:0.7rem;color:#ef4444;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${losersR1} Derrotados → disputam Repescagem</div>
                </div>

                <h4 style="color:#a78bfa;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Repescagem — ${repechageMatches} ${repechageMatches === 1 ? 'partida' : 'partidas'}, ${spotsFromRepechage} ${spotsFromRepechage === 1 ? 'vaga' : 'vagas'}</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${repHtml}
                </div>
                ${tiebreakNote}

                <h4 style="color:#38bdf8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:1.5rem 0 1rem;">Rodada 2 — Chave de ${r2Target} (${matchesR2} ${matchesR2 === 1 ? 'partida' : 'partidas'})</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${r2Html}
                </div>
            </div>
        `;
    } else if (option === 'standby') {
        const teamSize = parseInt(t.teamSize) || 1;
        const keptPlayers = info.lo;
        const movedPlayers = info.excess;
        const teamsKept = Math.floor(keptPlayers / teamSize);
        const teamsMoved = Math.floor(movedPlayers / teamSize);
        const matchesR1 = teamsKept / 2;

        // Standby mode options — always show (2 options)
        const standbyModeOptions = `
            <div style="margin-bottom:1.5rem;">
                <h4 style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Modo de Substituição da Lista de Espera</h4>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <label id="standby-opt-teams" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:rgba(245,158,11,0.08);border:2px solid rgba(245,158,11,0.4);border-radius:12px;padding:12px;transition:all 0.2s;" onclick="document.getElementById('standby-mode-teams').checked=true;window._updateStandbySimViz('teams')">
                        <input type="radio" name="standby-mode" id="standby-mode-teams" value="teams" checked style="margin-top:3px;accent-color:#f59e0b;flex-shrink:0;" />
                        <div>
                            <div style="color:#e2e8f0;font-weight:700;font-size:0.9rem;">Formar times com jogadores da espera</div>
                            <div style="color:#64748b;font-size:0.78rem;margin-top:3px;line-height:1.4;">Os ${movedPlayers} jogadores em espera formam ${teamsMoved} ${teamSize > 1 ? 'times' : 'entradas'} por sorteio. ${teamSize > 1 ? 'Se um time da chave estiver incompleto, é desclassificado e o próximo time da espera ocupa o lugar — mesmo quem compareceu fica de fora.' : 'Se um jogador faltar, o próximo da espera assume.'}</div>
                        </div>
                    </label>
                    <label id="standby-opt-individual" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;transition:all 0.2s;" onclick="document.getElementById('standby-mode-individual').checked=true;window._updateStandbySimViz('individual')">
                        <input type="radio" name="standby-mode" id="standby-mode-individual" value="individual" style="margin-top:3px;accent-color:#f59e0b;flex-shrink:0;" />
                        <div>
                            <div style="color:#e2e8f0;font-weight:700;font-size:0.9rem;">Jogadores avulsos completam times</div>
                            <div style="color:#64748b;font-size:0.78rem;margin-top:3px;line-height:1.4;">Os jogadores ficam individualmente na fila. ${teamSize > 1 ? 'Se um membro de um time faltar, o próximo da fila entra no lugar — quem compareceu continua jogando.' : 'Se um jogador faltar, o próximo da fila assume a vaga.'}</div>
                        </div>
                    </label>
                </div>
            </div>
        `;

        // Build match card with optional yellow accent for standby entries
        const matchCardTeams = (num, t1, t2) => `
            <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);margin-bottom:10px;">
                <div style="font-size:0.65rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">Jogo ${num}</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid rgba(16,185,129,0.4);margin-bottom:4px;">
                    <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${t1}</span>
                </div>
                <div style="text-align:center;font-size:0.6rem;color:#64748b;font-weight:800;letter-spacing:2px;padding:2px 0;">VS</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid rgba(239,68,68,0.4);">
                    <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${t2}</span>
                </div>
            </div>`;

        // Store params for dynamic viz update
        window._standbySimParams = { teamsKept, teamsMoved, matchesR1, teamSize, movedPlayers, keptPlayers };

        // Function to build viz HTML based on mode
        window._buildStandbyVizHtml = function(mode) {
            const p = window._standbySimParams;
            const tl = (num) => p.teamSize > 1 ? 'Time ' + num : 'Jogador ' + num;

            if (mode === 'teams') {
                // TEAMS MODE: show match cards + standby as formed teams with yellow accent
                let matchesHtml = '';
                for (let i = 0; i < p.matchesR1; i++) {
                    matchesHtml += matchCardTeams(i + 1, tl((i * 2) + 1), tl((i * 2) + 2));
                }

                let standbyTeamsHtml = '';
                for (let i = 0; i < p.teamsMoved; i++) {
                    const teamNum = p.teamsKept + i + 1;
                    const members = p.teamSize > 1
                        ? Array.from({length: p.teamSize}, (_, mi) => 'Jogador ' + (p.keptPlayers + (i * p.teamSize) + mi + 1)).join(', ')
                        : '';
                    standbyTeamsHtml += '<div style="background:rgba(15,23,42,0.8);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);margin-bottom:10px;">' +
                        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:' + (members ? '6px' : '0') + ';">' +
                            '<span style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900;color:#000;flex-shrink:0;">' + (i + 1) + '</span>' +
                            '<span style="font-weight:700;font-size:0.88rem;color:#fbbf24;">' + tl(teamNum) + '</span>' +
                            '<span style="margin-left:auto;font-size:0.6rem;font-weight:800;color:#f59e0b;text-transform:uppercase;background:rgba(245,158,11,0.15);padding:2px 8px;border-radius:6px;">Espera</span>' +
                        '</div>' +
                        (members ? '<div style="font-size:0.72rem;color:#94a3b8;padding-left:34px;line-height:1.5;">' + members + '</div>' : '') +
                    '</div>';
                }

                return '<h4 style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Chaveamento R1</h4>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + matchesHtml + '</div>' +
                    '<h4 style="color:#f59e0b;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:1.5rem 0 1rem;">Lista de Espera — ' + p.teamsMoved + (p.teamSize > 1 ? ' times (' + p.movedPlayers + ' jogadores)' : ' jogadores') + '</h4>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + standbyTeamsHtml + '</div>';

            } else {
                // INDIVIDUAL MODE: same match cards but standby shown as individual players with yellow accent
                let matchesHtml = '';
                for (let i = 0; i < p.matchesR1; i++) {
                    matchesHtml += matchCardTeams(i + 1, tl((i * 2) + 1), tl((i * 2) + 2));
                }

                let standbyIndivHtml = '';
                for (let i = 0; i < p.movedPlayers; i++) {
                    const playerNum = p.keptPlayers + i + 1;
                    standbyIndivHtml += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:8px 14px;display:flex;align-items:center;gap:8px;">' +
                        '<span style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900;color:#000;flex-shrink:0;">' + (i + 1) + '</span>' +
                        '<span style="font-size:0.82rem;font-weight:700;color:#fbbf24;">Jogador ' + playerNum + '</span>' +
                    '</div>';
                }

                return '<h4 style="color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Chaveamento R1</h4>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + matchesHtml + '</div>' +
                    '<h4 style="color:#f59e0b;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:1.5rem 0 1rem;">Lista de Espera — ' + p.movedPlayers + ' jogadores avulsos</h4>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + standbyIndivHtml + '</div>';
            }
        };

        // Dynamic update function for when radio buttons change
        window._updateStandbySimViz = function(mode) {
            const p = window._standbySimParams;
            const vizContainer = document.getElementById('standby-sim-viz');
            if (vizContainer) {
                vizContainer.innerHTML = window._buildStandbyVizHtml(mode);
            }
            // Update stat card and subtitle based on mode
            const statCount = document.getElementById('standby-stat-count');
            const statLabel = document.getElementById('standby-stat-label');
            const subtitle = document.getElementById('standby-subtitle-count');
            if (mode === 'individual') {
                if (statCount) statCount.textContent = p.movedPlayers;
                if (statLabel) statLabel.textContent = 'Jogadores em Espera';
                if (subtitle) subtitle.textContent = p.movedPlayers + ' jogadores';
            } else {
                if (statCount) statCount.textContent = p.teamsMoved;
                if (statLabel) statLabel.textContent = (p.teamSize > 1 ? 'Times' : 'Jogadores') + ' em Espera';
                if (subtitle) subtitle.textContent = p.teamsMoved + (p.teamSize > 1 ? ' times' : ' jogadores');
            }
            // Update option card styling
            const teamsOpt = document.getElementById('standby-opt-teams');
            const indivOpt = document.getElementById('standby-opt-individual');
            if (teamsOpt) {
                teamsOpt.style.background = mode === 'teams' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)';
                teamsOpt.style.borderColor = mode === 'teams' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)';
            }
            if (indivOpt) {
                indivOpt.style.background = mode === 'individual' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)';
                indivOpt.style.borderColor = mode === 'individual' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)';
            }
        };

        simulationHtml = `
            <div style="text-align:center;margin-bottom:2rem;">
                <span style="font-size:3rem;display:block;margin-bottom:1rem;">⏳</span>
                <h3 style="color:white;font-size:1.5rem;font-weight:900;margin:0;">Simulação de Lista de Espera</h3>
                <p style="color:#94a3b8;margin:8px 0 0;">Chave de ${teamsKept} ${teamSize > 1 ? 'times' : 'jogadores'}${teamSize > 1 ? ' (' + keptPlayers + ' jogadores)' : ''}. <span id="standby-subtitle-count">${teamsMoved} ${teamSize > 1 ? 'times' : 'jogadores'}</span> em espera.</p>
            </div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:1.5rem;margin-bottom:2rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center;">
                    <div style="background:rgba(34,197,94,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(34,197,94,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#4ade80;">${teamsKept}</div>
                        <div style="font-size:0.7rem;color:#86efac;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">${teamSize > 1 ? 'Times' : 'Jogadores'} na Chave</div>
                    </div>
                    <div style="background:rgba(96,165,250,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(96,165,250,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#60a5fa;">${matchesR1}</div>
                        <div style="font-size:0.7rem;color:#93c5fd;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">Partidas R1</div>
                    </div>
                    <div style="background:rgba(245,158,11,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(245,158,11,0.2);">
                        <div id="standby-stat-count" style="font-size:1.5rem;font-weight:900;color:#f59e0b;">${teamsMoved}</div>
                        <div id="standby-stat-label" style="font-size:0.7rem;color:#fbbf24;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">${teamSize > 1 ? 'Times' : 'Jogadores'} em Espera</div>
                    </div>
                </div>
            </div>

            <div id="standby-sim-viz" style="max-height:500px;overflow-y:auto;padding-right:10px;padding-bottom:1rem;">
                ${window._buildStandbyVizHtml ? window._buildStandbyVizHtml('teams') : ''}
            </div>

            ${standbyModeOptions}
        `;
    } else if (option === 'swiss') {
        const teamSize = parseInt(t.teamSize) || 1;
        const totalTeams = Math.floor(info.count / teamSize);
        const targetTeams = Math.floor(info.lo / teamSize);
        const swissRounds = Math.ceil(Math.log2(totalTeams));
        const matchesPerRound = Math.floor(totalTeams / 2);
        const tLabel = (num) => teamSize > 1 ? `Time ${num}` : `Participante ${num}`;

        // Match card for swiss rounds (purple accent)
        const swissCard = (roundNum, matchNum, t1, t2) => `
            <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                <div style="font-size:0.65rem;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(139,92,246,0.1);">R${roundNum} — Jogo ${matchNum}</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid rgba(139,92,246,0.4);margin-bottom:4px;">
                    <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${t1}</span>
                </div>
                <div style="text-align:center;font-size:0.6rem;color:#64748b;font-weight:800;letter-spacing:2px;padding:2px 0;">VS</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid rgba(139,92,246,0.4);">
                    <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${t2}</span>
                </div>
            </div>`;

        // Match card for elimination (standard green/red)
        const elimCard = (num, t1, t2) => `
            <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                <div style="font-size:0.65rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">Jogo ${num}</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid rgba(16,185,129,0.4);margin-bottom:4px;">
                    <span style="font-weight:600;font-size:0.85rem;color:#4ade80;">${t1}</span>
                </div>
                <div style="text-align:center;font-size:0.6rem;color:#64748b;font-weight:800;letter-spacing:2px;padding:2px 0;">VS</div>
                <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid rgba(239,68,68,0.4);">
                    <span style="font-weight:600;font-size:0.85rem;color:#ef4444;">${t2}</span>
                </div>
            </div>`;

        // Build swiss round sections with match cards
        let swissRoundsHtml = '';
        for (let r = 0; r < swissRounds; r++) {
            // Show up to 4 match cards per round (to keep it manageable)
            const showMax = Math.min(matchesPerRound, 4);
            let cardsHtml = '';
            for (let m = 0; m < showMax; m++) {
                if (r === 0) {
                    // R1: sequential pairing
                    cardsHtml += swissCard(r + 1, m + 1, tLabel((m * 2) + 1), tLabel((m * 2) + 2));
                } else {
                    // R2+: by ranking
                    cardsHtml += swissCard(r + 1, m + 1, `${m + 1}º colocado`, `${matchesPerRound + m + 1}º colocado`);
                }
            }
            const moreCount = matchesPerRound - showMax;

            swissRoundsHtml += `
                <div style="margin-bottom:1.5rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:0.75rem;">
                        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;color:white;flex-shrink:0;">${r + 1}</span>
                        <span style="font-weight:700;font-size:0.85rem;color:#e2e8f0;">Rodada ${r + 1}</span>
                        <span style="margin-left:auto;font-size:0.68rem;color:#64748b;">${matchesPerRound} partidas</span>
                        <span style="font-size:0.65rem;color:#a78bfa;background:rgba(139,92,246,0.1);padding:2px 8px;border-radius:6px;font-weight:700;">${r === 0 ? 'Sorteio' : 'Por pontuação'}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        ${cardsHtml}
                    </div>
                    ${moreCount > 0 ? '<div style="text-align:center;color:#64748b;font-size:0.72rem;margin-top:6px;font-style:italic;">+ mais ' + moreCount + ' partidas nesta rodada</div>' : ''}
                </div>`;
        }

        // Build elimination bracket match cards
        const elimMatches = targetTeams / 2;
        const showElimMax = Math.min(elimMatches, 4);
        let elimHtml = '';
        for (let i = 0; i < showElimMax; i++) {
            elimHtml += elimCard(i + 1, `#${(i * 2) + 1} classificado`, `#${(i * 2) + 2} classificado`);
        }
        const moreElim = elimMatches - showElimMax;

        simulationHtml = `
            <div style="text-align:center;margin-bottom:2rem;">
                <span style="font-size:3rem;display:block;margin-bottom:1rem;">🏅</span>
                <h3 style="color:white;font-size:1.5rem;font-weight:900;margin:0;">Simulação de Formato Suíço</h3>
                <p style="color:#94a3b8;margin:8px 0 0;">Todos jogam ${swissRounds} rodadas. Os ${targetTeams} melhores avançam para a eliminatória.</p>
            </div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:1.5rem;margin-bottom:2rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center;">
                    <div style="background:rgba(34,197,94,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(34,197,94,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#4ade80;">${totalTeams}</div>
                        <div style="font-size:0.7rem;color:#86efac;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">${teamSize > 1 ? 'Times' : 'Participantes'}</div>
                    </div>
                    <div style="background:rgba(139,92,246,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(139,92,246,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#8b5cf6;">${swissRounds}</div>
                        <div style="font-size:0.7rem;color:#a78bfa;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">Rodadas Suíço</div>
                    </div>
                    <div style="background:rgba(96,165,250,0.1);padding:1rem;border-radius:16px;border:1px solid rgba(96,165,250,0.2);">
                        <div style="font-size:1.5rem;font-weight:900;color:#60a5fa;">${targetTeams}</div>
                        <div style="font-size:0.7rem;color:#93c5fd;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-top:4px;">Classificados</div>
                    </div>
                </div>
            </div>

            <div style="max-height:500px;overflow-y:auto;padding-right:10px;padding-bottom:1rem;">
                <h4 style="color:#a78bfa;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:0 0 1rem;">Fase Classificatória — ${swissRounds} Rodadas</h4>
                ${swissRoundsHtml}

                <div style="text-align:center;margin:0.75rem 0;padding:12px;background:rgba(34,197,94,0.05);border:1px dashed rgba(34,197,94,0.2);border-radius:12px;">
                    <div style="font-size:0.72rem;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Classificação Final</div>
                    <div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">Top ${targetTeams} avançam para chave eliminatória</div>
                </div>

                <h4 style="color:#38bdf8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:1rem 0 1rem;">Fase Eliminatória — Chave de ${targetTeams}</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${elimHtml}
                </div>
                ${moreElim > 0 ? '<div style="text-align:center;color:#64748b;font-size:0.72rem;margin-top:6px;font-style:italic;">+ mais ' + moreElim + ' partidas na R1 eliminatória</div>' : ''}
            </div>
        `;
    }

    overlay.innerHTML = `
        <div style="background:#0f172a;width:94%;max-width:600px;border-radius:32px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 50px 150px rgba(0,0,0,0.9);overflow:hidden;animation: modalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);margin:auto 0;">
            <div style="padding:2.5rem;">
                ${simulationHtml}

                <div style="margin-top:1.5rem;display:grid;grid-template-columns:1fr 1.5fr;gap:12px;">
                    <button onclick="document.getElementById('simulation-panel').remove();" style="background:rgba(255,255,255,0.05);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);padding:14px;border-radius:16px;font-weight:700;cursor:pointer;transition:all 0.2s;">Voltar</button>
                    <button onclick="window._confirmP2Resolution('${String(tId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${String(option || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);color:white;border:none;padding:14px;border-radius:16px;font-weight:700;cursor:pointer;box-shadow:0 10px 20px rgba(79,70,229,0.3);transition:all 0.2s;">Confirmar</button>
                </div>
                <p style="margin-top:1rem;text-align:center;color:#64748b;font-size:0.7rem;font-style:italic;">Nota: Esta é uma simulação ilustrativa. Os times são embaralhados no sorteio.</p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window._confirmP2Resolution = function (tId, option) {
    // Apply the actual resolution logic here
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;
    const info = window.checkPowerOf2(t);

    let actionMsg = "";
    if (option === 'bye') {
        t.p2Resolution = 'bye';
        t.p2TargetCount = info.hi;
        actionMsg = `Configurado com BYEs para chave de ${info.hi}`;
    } else if (option === 'playin') {
        t.p2Resolution = 'playin';
        t.p2TargetCount = info.lo;
        t.p2CrossSeed = true; // R2: pair R1 winners vs repechage winners for fairness
        actionMsg = `Configurado com Play-ins (cross-seed) para chave de ${info.lo}`;
    } else if (option === 'standby') {
        t.p2Resolution = 'standby';
        t.p2TargetCount = info.lo;
        const p = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
        const _vips = t.vips || {};
        // Separar VIPs (protegidos) dos demais
        const vipEntries = [];
        const nonVipEntries = [];
        p.forEach(entry => {
            const nm = typeof entry === 'string' ? entry : (entry.displayName || entry.name || '');
            // VIP se o nome ou qualquer membro do time é VIP
            const members = nm.includes('/') ? nm.split('/').map(n => n.trim()) : [nm];
            const isVip = members.some(m => !!_vips[m]) || !!_vips[nm];
            if (isVip) vipEntries.push(entry);
            else nonVipEntries.push(entry);
        });
        // VIPs ficam sempre; excesso sai dos não-VIPs
        const slotsForNonVip = info.lo - vipEntries.length;
        const kept = nonVipEntries.slice(0, Math.max(0, slotsForNonVip));
        const standbyOverflow = nonVipEntries.slice(Math.max(0, slotsForNonVip));
        t.standbyParticipants = standbyOverflow;
        t.participants = [...vipEntries, ...kept];
        // Save standby substitution mode
        const modeRadio = document.querySelector('input[name="standby-mode"]:checked');
        t.standbyMode = modeRadio ? modeRadio.value : 'teams';
        const modeLabels = { teams: 'Times formados na espera', individual: 'Jogadores avulsos completam times' };
        actionMsg = `Movidos ${info.excess} participantes para Lista de Espera (${modeLabels[t.standbyMode] || t.standbyMode})`;
    } else if (option === 'swiss') {
        t.p2Resolution = 'swiss';
        t.classifyFormat = 'swiss';
        actionMsg = 'Iniciado com Fase Classificatória (Suíço)';
    }

    t.status = 'closed';
    window.AppStore.logAction(tId, actionMsg);
    window.AppStore.sync();

    if (document.getElementById('simulation-panel')) document.getElementById('simulation-panel').remove();
    if (document.getElementById('p2-resolution-panel')) document.getElementById('p2-resolution-panel').remove();

    window.showFinalReviewPanel(tId);
};


})();
