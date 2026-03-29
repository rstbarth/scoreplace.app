function renderTournaments(container, tournamentId = null) {
    if (!window.AppStore) return;
    let visible = window.AppStore.getVisibleTournaments() || [];

    window._handleSortearClick = function (tId, isAberto) {
        window._lastActiveTournamentId = tId;
        if (isAberto) {
            showConfirmDialog(
                'Encerrar Inscrições',
                'As inscrições ainda estão abertas. Deseja encerrar as inscrições prematuramente para realizar o sorteio?',
                () => {
                    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
                    if (t) { t.status = 'closed'; window.AppStore.sync(); }
                    window.location.hash = `#pre-draw/${tId}`;
                },
                null,
                { type: 'warning', confirmText: 'Encerrar e Sortear', cancelText: 'Manter Aberto' }
            );
        } else {
            window.location.hash = `#pre-draw/${tId}`;
        }
    };

    if (!window.inviteModalSetupDone) {
        window.openInviteModal = function (id) {
            const mod = document.getElementById('invite-modal-' + id);
            if (mod) mod.style.display = 'flex';
        };
        window.closeInviteModal = function (id) {
            const mod = document.getElementById('invite-modal-' + id);
            if (mod) mod.style.display = 'none';
        };
        window.switchInviteTab = function (btn, tabName, id) {
            const modal = btn.closest('.invite-modal-container');
            modal.querySelectorAll('.invite-tab-btn').forEach(b => {
                b.style.borderBottom = '1px solid var(--border-color)';
                b.style.color = 'var(--text-muted)';
                b.style.fontWeight = '500';
            });
            btn.style.borderBottom = '2px solid var(--text-bright)';
            btn.style.color = 'var(--text-bright)';
            btn.style.fontWeight = '700';
            modal.querySelectorAll('.invite-tab-content').forEach(c => c.style.display = 'none');
            const content = modal.querySelector('#tab-' + tabName + '-' + id);
            if (content) content.style.display = 'block';
        };
        window.inviteModalSetupDone = true;
    }

    if (!window.addBotsFunctionSetup) {
        window.addBotsFunction = function (id) {
            const qtd = parseInt(prompt('🔧 TEST MODE\nQuantos bots deseja adicionar?', '8'), 10);
            if (isNaN(qtd) || qtd <= 0) return;

            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === id.toString());
            if (t) {
                if (!t.participants) t.participants = [];
                if (!Array.isArray(t.participants)) {
                    // Converte pra array se estava bugado como objeto
                    t.participants = Object.values(t.participants);
                }
                const currentCount = t.participants.length;
                for (let i = 1; i <= qtd; i++) {
                    const numStr = String(currentCount + i).padStart(2, '0');
                    t.participants.push('Bot ' + numStr);
                }
                if (typeof window.AppStore.sync === 'function') window.AppStore.sync();

                // Recarrega view mantendo contexto de roteamento ID
                const container = document.getElementById('view-container');
                if (container) {
                    const param = window.location.hash.split('/')[1] || null;
                    renderTournaments(container, param);
                }
            }
        };
        window.addBotsFunctionSetup = true;
    }

    if (!window.editModalSetupDone) {
        window.openEditModal = function (id) {
            if (typeof window.openEditTournamentModal === 'function') {
                window.openEditTournamentModal(id);
            }
        };
        window.editModalSetupDone = true;
    }

    if (!window.removeParticipantSetupDone) {
        window.removeParticipantFunction = function (tId, participantIndex) {
            showConfirmDialog(
                'Remover Participante',
                'Deseja realmente remover este participante?',
                () => {
                    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
                    if (t && t.participants) {
                        let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
                        arr.splice(participantIndex, 1);
                        t.participants = arr;

                        if (typeof window.AppStore.sync === 'function') window.AppStore.sync();

                        const container = document.getElementById('view-container');
                        if (container) {
                            renderTournaments(container, tId);
                        }
                    }
                },
                null,
                { type: 'danger', confirmText: 'Remover', cancelText: 'Cancelar' }
            );
        };
        window.removeParticipantSetupDone = true;
    }

    if (!window.splitParticipantSetupDone) {
        window.splitParticipantFunction = function (tId, participantIndex) {
            showConfirmDialog(
                'Desfazer Equipe',
                'Deseja desfazer esta equipe e retornar os jogadores como individuais?',
                () => {
                    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
                    if (t && t.participants) {
                        let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
                        const p = arr[participantIndex];
                        const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');

                        if (pStr.includes('/')) {
                            const parts = pStr.split('/').map(s => s.trim());
                            arr.splice(participantIndex, 1);
                            arr.splice(participantIndex, 0, ...parts);
                            t.participants = arr;

                            if (typeof window.AppStore.sync === 'function') window.AppStore.sync();

                            const container = document.getElementById('view-container');
                            if (container) {
                                renderTournaments(container, tId);
                            }
                        }
                    }
                },
                null,
                { type: 'warning', confirmText: 'Desfazer', cancelText: 'Manter Equipe' }
            );
        };
        window.splitParticipantSetupDone = true;
    }

    if (!window.enrollDeenrollSetupDone) {
        window.enrollCurrentUser = function (tId) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            const user = window.AppStore.currentUser;
            if (!user) {
                // Save pending enrollment and trigger login
                try { sessionStorage.setItem('_pendingEnrollTournamentId', String(tId)); } catch(e) {}
                window._pendingEnrollTournamentId = String(tId);
                window._pendingInviteHash = '#tournaments/' + tId;
                if (typeof handleGoogleLogin === 'function') {
                    handleGoogleLogin();
                } else if (typeof openModal === 'function') {
                    openModal('modal-login');
                }
                return;
            }
            if (t) {
                // Verifica se as inscrições estão realmente abertas
                const sorteioRealizado = t.status === 'active' && ((Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0));
                const ligaAberta = t.format === 'Liga' && t.ligaOpenEnrollment !== false && sorteioRealizado;
                const inscricoesAbertas = t.status !== 'closed' && !sorteioRealizado || ligaAberta;
                if (!inscricoesAbertas) {
                    showAlertDialog('Inscrições Encerradas', 'As inscrições para este torneio estão encerradas.', null, { type: 'warning' });
                    return;
                }
                if (t.enrollmentMode === 'time' && (t.teamSize || 2) > 1) {
                    const mod = document.getElementById('team-enroll-modal-' + tId);
                    if (mod) mod.style.display = 'flex';
                    return;
                }

                const arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
                const already = arr.some(p => {
                    const str = typeof p === 'string' ? p : (p.email || p.displayName);
                    return str && (str.includes(user.email) || str.includes(user.displayName));
                });
                if (!already) {
                    arr.push({ name: user.displayName, email: user.email, displayName: user.displayName });
                    t.participants = arr;
                    // Save directly to Firestore (sync only saves org's tournaments)
                    if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                        window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Enroll save error:', err); });
                    }
                    if (t.autoCloseOnFull && t.maxParticipants && arr.length >= parseInt(t.maxParticipants)) {
                        t.status = 'closed';
                        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                            window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Auto-close save error:', err); });
                        }
                        if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', `"${t.name}" atingiu ${t.maxParticipants} inscritos e foi encerrado automaticamente.`, 'success');
                    }
                    if (typeof showNotification !== 'undefined') showNotification('✅ Inscrito!', 'Você foi inscrito com sucesso no torneio "' + t.name + '".', 'success');
                    const container = document.getElementById('view-container');
                    if (container) { renderTournaments(container, window.location.hash.split('/')[1]); }
                }
            }
        };

        window.submitTeamEnroll = function (tId) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            const user = window.AppStore.currentUser;
            if (!t || !user) return;

            // Verifica se as inscrições estão realmente abertas
            const sorteioRealizado = t.status === 'active' && ((Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0));
            const ligaAberta = t.format === 'Liga' && t.ligaOpenEnrollment !== false && sorteioRealizado;
            const inscricoesAbertas = t.status !== 'closed' && !sorteioRealizado || ligaAberta;
            if (!inscricoesAbertas) {
                showAlertDialog('Inscrições Encerradas', 'As inscrições para este torneio estão encerradas.', null, { type: 'warning' });
                return;
            }

            const inputs = document.querySelectorAll('.team-member-name-' + tId);
            let allFilled = true;
            let teamNames = [user.displayName];

            inputs.forEach(input => {
                const val = input.value.trim();
                if (!val) allFilled = false;
                teamNames.push(val);
            });

            if (!allFilled) {
                showAlertDialog('Campos Obrigatórios', 'Por favor, preencha o nome de todos os integrantes do seu time.', null, { type: 'warning' });
                return;
            }

            const teamString = teamNames.join(' / ');
            let arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);

            arr.push({ name: teamString, email: user.email, displayName: teamString });
            t.participants = arr;
            // Registrar origem da equipe
            if (!t.teamOrigins) t.teamOrigins = {};
            t.teamOrigins[teamString] = 'inscrita';
            // Save directly to Firestore (sync only saves org's tournaments)
            if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Team enroll save error:', err); });
            }
            if (t.autoCloseOnFull && t.maxParticipants && arr.length >= parseInt(t.maxParticipants)) {
                t.status = 'closed';
                if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                    window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Auto-close save error:', err); });
                }
                if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', `"${t.name}" atingiu ${t.maxParticipants} inscritos e foi encerrado automaticamente.`, 'success');
            }
            const mod = document.getElementById('team-enroll-modal-' + tId);
            if (mod) mod.style.display = 'none';

            const container = document.getElementById('view-container');
            if (container) {
                renderTournaments(container, window.location.hash.split('/')[1]);
            }
        };

        window.deenrollCurrentUser = function (tId) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            const user = window.AppStore.currentUser;
            if (!user) return;
            if (t && t.participants) {
                showConfirmDialog(
                    'Cancelar Inscrição',
                    'Deseja realmente cancelar sua inscrição neste torneos?',
                    () => {
                        let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
                        arr = arr.filter(p => {
                            const str = typeof p === 'string' ? p : (p.email || p.displayName);
                            return !(str && (str.includes(user.email) || str.includes(user.displayName)));
                        });
                        t.participants = arr;
                        // Save directly to Firestore
                        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                            window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Deenroll save error:', err); });
                        }

                        const container = document.getElementById('view-container');
                        if (container) {
                            renderTournaments(container, window.location.hash.split('/')[1]);
                        }
                    },
                    null,
                    { type: 'warning', confirmText: 'Cancelar Inscrição', cancelText: 'Manter' }
                );
            }
        };

        window.addParticipantFunction = function (tId) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (!t) return;
            showInputDialog(
                'Adicionar Participante',
                'Digite o nome do novo participante:',
                (pName) => {
                    if (!pName || !pName.trim()) return;
                    let arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
                    arr.push({ name: pName.trim(), displayName: pName.trim() });
                    t.participants = arr;

                    if (typeof window.AppStore.sync === 'function') window.AppStore.sync();
                    if (t.autoCloseOnFull && t.maxParticipants && arr.length >= parseInt(t.maxParticipants)) {
                        t.status = 'closed'; window.AppStore.sync();
                        if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', `"${t.name}" atingiu ${t.maxParticipants} inscritos e foi encerrado automaticamente.`, 'success');
                    }
                    const container = document.getElementById('view-container');
                    if (container) renderTournaments(container, window.location.hash.split('/')[1]);
                },
                { placeholder: 'Nome do participante', okText: 'Adicionar' }
            );
        };

        window.addTeamFunction = function (tId) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (!t) return;
            const teamSize = t.teamSize || 2;
            const items = Array.from({ length: teamSize }, (_, i) => ({ placeholder: `Nome do integrante ${i + 1}` }));

            showMultiInputDialog(
                'Adicionar Time',
                items,
                (teamNames) => {
                    if (!teamNames || teamNames.some(n => !n.trim())) {
                        showAlertDialog('Inscrição Cancelada', 'Todos os campos devem ser preenchidos.', null, { type: 'info' });
                        return;
                    }
                    const teamString = teamNames.join(' / ');

                    let arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
                    arr.push({ name: teamString, displayName: teamString });
                    t.participants = arr;
                    // Registrar origem: organizer adicionou o time
                    if (!t.teamOrigins) t.teamOrigins = {};
                    t.teamOrigins[teamString] = 'formada';

                    if (typeof window.AppStore.sync === 'function') window.AppStore.sync();
                    if (t.autoCloseOnFull && t.maxParticipants && arr.length >= parseInt(t.maxParticipants)) {
                        t.status = 'closed'; window.AppStore.sync();
                        if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', `"${t.name}" atingiu ${t.maxParticipants} inscritos e foi encerrado automaticamente.`, 'success');
                    }
                    const container = document.getElementById('view-container');
                    if (container) renderTournaments(container, window.location.hash.split('/')[1]);
                },
                { itemLabel: 'Integrante' }
            );
        };

        window.deleteTournamentFunction = function (tId) {
            showConfirmDialog(
                'Apagar Torneio',
                'TEM CERTEZA absoluta que deseja apagar este torneio? Esta ação NÃO pode ser desfeita. O torneio será removido permanentemente para todos os usuários.',
                () => {
                    const idx = window.AppStore.tournaments.findIndex(tour => tour.id.toString() === tId.toString());
                    if (idx !== -1) {
                        // Marca como deletado para evitar que o listener traga de volta
                        if (!window.AppStore._deletedTournamentIds) window.AppStore._deletedTournamentIds = [];
                        window.AppStore._deletedTournamentIds.push(String(tId));
                        try { localStorage.setItem('scoreplace_deleted_ids', JSON.stringify(window.AppStore._deletedTournamentIds)); } catch(e) {}

                        // Remove da memória
                        window.AppStore.tournaments.splice(idx, 1);

                        // Deleta do Firestore (banco de dados)
                        if (window.FirestoreDB && window.FirestoreDB.db) {
                            window.FirestoreDB.deleteTournament(tId).then(function() {
                                console.log('Torneio ' + tId + ' deletado do Firestore');
                                // Após confirmação do Firestore, remove da lista de deletados (já foi removido de verdade)
                                var delIdx = window.AppStore._deletedTournamentIds.indexOf(String(tId));
                                if (delIdx !== -1) window.AppStore._deletedTournamentIds.splice(delIdx, 1);
                                try { localStorage.setItem('scoreplace_deleted_ids', JSON.stringify(window.AppStore._deletedTournamentIds)); } catch(e) {}
                            }).catch(function(err) {
                                console.error('Erro ao deletar torneio do Firestore:', err);
                            });
                        }

                        // Atualiza cache local para refletir a remoção
                        window.AppStore._saveToCache();

                        // Limpa cache antigo do boratime se existir
                        try { localStorage.removeItem('boratime_state'); } catch(e) {}

                        showNotification('Torneio Apagado', 'O torneio foi removido permanentemente.', 'success');
                        window.location.hash = '#dashboard';
                    }
                },
                null,
                { type: 'danger', confirmText: 'Apagar Permanentemente', cancelText: 'Manter Torneio' }
            );
        };

        // ─── VERIFICAÇÃO 1: TIMES INCOMPLETOS ───
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
                                    <span style="font-size:0.85rem; font-weight:600; color:#fca5a5;">${it.name}</span>
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
                                    ${li.name}
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

                        <h4 style="margin:1.5rem 0 1rem;color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Como deseja resolver?</h4>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <button class="res-option" onclick="window._handleIncompleteOption('${tId}', 'reopen')">
                                <span style="font-size:1.5rem;">↩️</span>
                                <div>
                                    <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Reabrir Inscrições</div>
                                    <div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Apenas para fechar os times faltantes.</div>
                                </div>
                            </button>

                            <button class="res-option" onclick="window._handleIncompleteOption('${tId}', 'lottery')">
                                <span style="font-size:1.5rem;">🎲</span>
                                <div>
                                    <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Sorteio de 'Bots'</div>
                                    <div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Preencher vagas com nomes fictícios ou convites.</div>
                                </div>
                            </button>

                            <button class="res-option" onclick="window._handleIncompleteOption('${tId}', 'standby')">
                                <span style="font-size:1.5rem;">⏱️</span>
                                <div>
                                    <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Mover para Lista de Espera</div>
                                    <div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Os que sobrarem ficam fora do torneio principal.</div>
                                </div>
                            </button>

                            <button class="res-option" onclick="window._handleIncompleteOption('${tId}', 'dissolve')">
                                <span style="font-size:1.5rem;">🧩</span>
                                <div>
                                    <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Ajuste Manual</div>
                                    <div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Remanejar jogadores entre times (Arrastar e Soltar).</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div style="padding:1rem 2rem 1.5rem;display:flex;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.05);">
                        <button onclick="document.getElementById('incomplete-teams-panel').remove();" style="background:transparent;color:#94a3b8;border:none;padding:10px 20px;font-weight:600;font-size:0.9rem;cursor:pointer;">Cancelar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
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
                        <button onclick="window._saveDissolveResolution('${tId}')" style="background:#2563eb;color:white;border:none;padding:12px 25px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 10px 20px rgba(37,99,235,0.3);">Salvar Alterações</button>
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
                        <div style="font-weight:700;color:white;margin-bottom:8px;font-size:0.9rem;">${it.name}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                            ${it.members.map(m => `<span style="background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:6px;font-size:0.8rem;color:#e2e8f0;">${m}</span>`).join('')}
                            <span style="border:1px dashed #94a3b8;padding:4px 10px;border-radius:6px;font-size:0.8rem;color:#94a3b8;">+ Vaga</span>
                        </div>
                    </div>
                `).join('');

                fullList.innerHTML = participants.map((p, idx) => {
                    const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
                    return `
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:10px 15px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:move;">
                            <span style="font-size:0.9rem;color:#e2e8f0;">${name}</span>
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
                        .p2-option { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:2.2rem 1.5rem 1.5rem; cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-align:left; color:#e2e8f0; display:flex; gap:16px; align-items:flex-start; position:relative; overflow:hidden; }
                        .p2-option:hover { background:rgba(255,255,255,0.07); border-color:rgba(251,191,36,0.4); transform:translateY(-2px); }
                        .p2-option::after { content:''; position:absolute; top:0; left:0; width:100%; height:100%; background:linear-gradient(45deg, transparent, rgba(251,191,36,0.05), transparent); transform:translateX(-100%); transition:0.5s; }
                        .p2-option:hover::after { transform:translateX(100%); }
                        .p2-option h4 { margin:0 0 4px; font-weight:800; font-size:1.05rem; color:#fff; }
                        .p2-option p { margin:0; font-size:0.8rem; color:#94a3b8; line-height:1.5; }
                        .p2-badge { position:absolute; top:10px; right:10px; background:rgba(34,197,94,0.15); color:#4ade80; padding:3px 10px; border-radius:8px; font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; pointer-events:none; }
                    </style>

                    <div style="padding:2.5rem;">
                        <h4 style="margin:0 0 1.5rem;color:#94a3b8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Selecione a Estratégia de Ajuste</h4>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            ${(function(){
                                // Recomendação: máxima igualdade para o maior nº de inscritos
                                // BYE: todos ficam, 'missing' com vantagem (avançam sem jogar)
                                // Play-in: todos ficam, 'excess*2' jogam partida extra
                                // Reabrir: todos ficam + mais entram, igualdade total ao atingir alvo
                                // Standby: remove 'excess' participantes
                                // Suíço: todos jogam igual, mas muda formato
                                const byeAffected = info.missing;
                                const playinAffected = info.excess * 2;
                                let rec = '';
                                if (info.missing <= 2) {
                                    // Faltam poucos — reabrir é simples e garante igualdade total
                                    rec = 'reopen';
                                } else if (byeAffected <= playinAffected) {
                                    // BYE afeta menos participantes com desigualdade
                                    rec = 'bye';
                                } else {
                                    // Play-in afeta menos participantes
                                    rec = 'playin';
                                }
                                const badge = '<div class="p2-badge">⭐ Recomendado</div>';
                                const recTip = {
                                    reopen: 'Igualdade total — todos competem nas mesmas condições.',
                                    bye: 'Mantém todos os inscritos. Menor nº de participantes com condição diferente (' + byeAffected + ' avançam direto).',
                                    playin: 'Mantém todos os inscritos. Menor nº de participantes com condição diferente (' + playinAffected + ' jogam partida extra).'
                                };
                                return `
                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'reopen')">
                                ${rec === 'reopen' ? badge : ''}
                                <span style="font-size:2rem;">↩️</span>
                                <div>
                                    <h4>Reabrir Inscrições</h4>
                                    <p>Aguardar mais ${info.missing} inscritos para chegar em ${info.hi}.</p>
                                    ${rec === 'reopen' ? '<p style="color:#4ade80;font-size:0.75rem;margin-top:6px;font-weight:600;">' + recTip.reopen + '</p>' : ''}
                                </div>
                            </button>

                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'bye')">
                                ${rec === 'bye' ? badge : ''}
                                <span style="font-size:2rem;">🥇</span>
                                <div>
                                    <h4>Aplicar BYE</h4>
                                    <p>${info.missing} times avançam direto. Chaveamento de ${info.hi}.</p>
                                    ${rec === 'bye' ? '<p style="color:#4ade80;font-size:0.75rem;margin-top:6px;font-weight:600;">' + recTip.bye + '</p>' : ''}
                                </div>
                            </button>

                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'playin')">
                                ${rec === 'playin' ? badge : ''}
                                <span style="font-size:2rem;">🔁</span>
                                <div>
                                    <h4>Play-in (Repescagem)</h4>
                                    <p>${info.excess * 2} times disputam ${info.excess} vaga(s). Chaveamento de ${info.lo}.</p>
                                    ${rec === 'playin' ? '<p style="color:#4ade80;font-size:0.75rem;margin-top:6px;font-weight:600;">' + recTip.playin + '</p>' : ''}
                                </div>
                            </button>

                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'standby')">
                                <span style="font-size:2rem;">⏱️</span>
                                <div>
                                    <h4>Lista de Espera</h4>
                                    <p>${info.count} inscritos. ${Math.floor(info.lo / (parseInt(t.teamSize) || 1))} ${(parseInt(t.teamSize) || 1) > 1 ? 'times jogam' : 'jogam'} em ${Math.floor(info.lo / (parseInt(t.teamSize) || 1)) / 2} partidas. ${info.count - info.lo} na lista de espera. Chaveamento de ${Math.floor(info.lo / (parseInt(t.teamSize) || 1))}.</p>
                                </div>
                            </button>

                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'swiss')" style="grid-column: span 2;">
                                <span style="font-size:2rem;">🏅</span>
                                <div>
                                    <h4>Formato Suíço / Classificatória</h4>
                                    <p>Garantia de mais jogos para todos antes de afunilar para os melhores ${info.lo}.</p>
                                </div>
                            </button>`;
                            })()}
                        </div>
                    </div>

                    <div style="padding:1.5rem 2.5rem 2rem;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.1);border-top:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:0.8rem;color:#64748b;">Ajuste manual disponível no rascunho de chaveamento.</div>
                        <button onclick="document.getElementById('p2-resolution-panel').remove();" style="background:transparent;color:#94a3b8;border:2px solid rgba(148,163,184,0.2);padding:10px 24px;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">Voltar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        };

        // (Check-in functions moved to participants.js)

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
                        <button onclick="window._confirmReopen('${tId}', ${info.hi});" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;padding:10px 28px;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 15px rgba(59,130,246,0.3);transition:all 0.2s;">Confirmar Reabertura</button>
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

        // ─── Painel Integrado de Encerramento ───
        window.toggleRegistrationStatus = function (tId) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (!t) return;

            if (t.status === 'closed') {
                delete t.status;
                window.AppStore.logAction(tId, 'Inscrições Reabertas');
                window.AppStore.sync();
                const container = document.getElementById('view-container');
                if (container) renderTournaments(container, window.location.hash.split('/')[1]);
                showNotification('Inscrições Reabertas', 'Novas inscrições podem ser feitas.', 'info');
                return;
            }

            // Verificar potência de 2 para formatos eliminatórios
            const isElim = t.format === 'Eliminatórias Simples' || t.format === 'Dupla Eliminatória';
            if (isElim) {
                const info = window.checkPowerOf2(t);
                const arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
                if (arr.length < 2) {
                    showAlertDialog('Inscritos Insuficientes', 'São necessários pelo menos 2 participantes para encerrar as inscrições.', null, { type: 'warning' });
                    return;
                }
                if (!info.isPowerOf2) {
                    // Mostrar painel de ajuste ANTES de fechar — o painel fecha as inscrições ao resolver
                    window.showPowerOf2Panel(tId);
                    return;
                }
            }

            t.status = 'closed';
            window.AppStore.logAction(tId, 'Inscrições Encerradas manualmente');
            window.AppStore.sync();
            const container = document.getElementById('view-container');
            if (container) renderTournaments(container, window.location.hash.split('/')[1]);
            showNotification('Inscrições Encerradas', 'O torneio foi fechado para novas inscrições.', 'success');
        };

        window._handleClosureOption = function (tId, option) {
            // This is largely handled by specialized panels now
            // But if called directly or for simple closure:
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (!t) return;

            if (option === 'just_close') {
                t.status = 'closed';
                window.AppStore.logAction(tId, 'Inscrições Encerradas manualmente');
                window.AppStore.sync();
                const container = document.getElementById('view-container');
                if (container) renderTournaments(container, window.location.hash.split('/')[1]);
                if (document.getElementById('closure-panel')) document.getElementById('closure-panel').remove();
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

                // R2 cards — winners R1 + classified from repechage
                let r2Html = '';
                let wIdx = 1;
                let repIdx = 1;
                for (let i = 0; i < matchesR2; i++) {
                    const renderSlot = (isRep) => {
                        if (!isRep) {
                            return { name: `Vencedor Jogo ${wIdx}`, color: 'rgba(16,185,129,0.4)' };
                        } else {
                            const n = `Classificado Rep. ${repIdx}`;
                            return { name: n, color: 'rgba(139,92,246,0.4)' };
                        }
                    };
                    // Distribute: first fill with R1 winners, then repechage classified
                    let s1isRep = wIdx > winnersR1;
                    let s1 = renderSlot(s1isRep);
                    if (s1isRep) repIdx++; else wIdx++;

                    let s2isRep = wIdx > winnersR1;
                    let s2 = renderSlot(s2isRep);
                    if (s2isRep) repIdx++; else wIdx++;

                    r2Html += `
                    <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);margin-bottom:10px;">
                        <div style="font-size:0.65rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.06);">R2 — Jogo ${i + 1}</div>
                        <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid ${s1.color};margin-bottom:4px;">
                            <span style="font-weight:600;font-size:0.85rem;color:${s1isRep ? '#a78bfa' : '#e2e8f0'};${s1isRep ? 'font-style:italic;' : ''}">${s1.name}</span>
                        </div>
                        <div style="text-align:center;font-size:0.6rem;color:#64748b;font-weight:800;letter-spacing:2px;padding:2px 0;">VS</div>
                        <div style="padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.25);border-left:3px solid ${s2.color};">
                            <span style="font-weight:600;font-size:0.85rem;color:${s2isRep ? '#a78bfa' : '#e2e8f0'};${s2isRep ? 'font-style:italic;' : ''}">${s2.name}</span>
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
                            <button onclick="window._confirmP2Resolution('${tId}', '${option}');" style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);color:white;border:none;padding:14px;border-radius:16px;font-weight:700;cursor:pointer;box-shadow:0 10px 20px rgba(79,70,229,0.3);transition:all 0.2s;">Confirmar</button>
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
                actionMsg = `Configurado com Play-ins para chave de ${info.lo}`;
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
                                    <div style="font-size:0.75rem;color:#94a3b8;">A potência de 2 foi atingida via: <b>${t.p2Resolution || 'Natural'}</b></div>
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
                                        <span>${log.message}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="display:flex;flex-direction:column;gap:10px;">
                            <button onclick="window.generateDrawFunction('${tId}')" style="background:linear-gradient(135deg,#16a34a,#22c55e);color:white;border:none;padding:15px;border-radius:16px;font-weight:800;font-size:1.1rem;cursor:pointer;box-shadow:0 10px 30px rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center;gap:10px;">
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

            // ── Verificação de potência de 2 para eliminatórias ──────────────
            const isElim = t.format === 'Eliminatórias Simples' || t.format === 'Dupla Eliminatória';
            if (isElim && !t.p2Resolution) {
                const arr = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
                if (arr.length < 2) {
                    showAlertDialog('Inscritos Insuficientes', 'São necessários pelo menos 2 participantes para realizar o sorteio.', null, { type: 'warning' });
                    return;
                }
                const info = window.checkPowerOf2(t);
                if (!info.isPowerOf2) {
                    window.showPowerOf2Panel(tId);
                    return;
                }
            }

            // ── Pergunta de divulgação do sorteio ─────────────────────────────
            if (!t.drawVisibility) {
                window._showDrawVisibilityDialog(tId);
                return;
            }

            // ── Liga / Suíço: generate first round standings ──────────────────
            if (t.format === 'Liga' || t.format === 'Suíço Clássico') {
                let participants = Array.isArray(t.participants) ? [...t.participants] : Object.values(t.participants || {});

                // Shuffle participants
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }

                // Initialize standings
                t.standings = participants.map(p => {
                    const name = typeof p === 'string' ? p : (p.displayName || p.name || '');
                    return { name, points: 0, wins: 0, losses: 0, pointsDiff: 0, played: 0 };
                });
                t.rounds = [];
                t.status = 'active';

                // Generate first round using Swiss pairing
                _generateNextRound(t);

                window.AppStore.logAction(tId, `Sorteio Realizado — ${t.format}: Rodada 1 gerada com ${t.rounds[0].matches.length} partida(s)`);
                window.AppStore.sync();

                if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();
                showNotification('Torneio Iniciado', `Rodada 1 gerada com ${t.rounds[0].matches.length} partida(s)!`, 'success');
                window.location.hash = `#bracket/${tId}`;
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
                    name: `Grupo ${String.fromCharCode(65 + i)}`,
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
                                label: `${g.name} • ${players[i]} vs ${players[j]}`
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
                window.AppStore.sync();

                if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();
                showNotification('Fase de Grupos Iniciada', `${numGroups} grupos gerados!`, 'success');
                window.location.hash = `#bracket/${tId}`;
                return;
            }

            let participants = Array.isArray(t.participants) ? [...t.participants] : Object.values(t.participants || {});

            // --- ETAPA 1: Formação de Times (quando teamSize > 1) ---
            const teamSize = parseInt(t.teamSize) || 1;
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

            // 1. Shuffling (if not specifically ordered)
            if (!t.p2OrderedList) {
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
            }

            // 2. Handle Swiss/Classificatória
            if (t.p2Resolution === 'swiss') {
                t.status = 'active';
                t.currentStage = 'swiss';
                // Trigger swiss round generation (to be implemented/integrated)
                showNotification('Sucesso', 'Fase Classificatória (Suíço) Iniciada!', 'success');
                window.AppStore.sync();
                window.location.hash = `#tournaments/${tId}`;
                return;
            }

            // 3. Handle Elimination (Simples/Dupla)
            let matches = [];
            const timestamp = Date.now();
            const isDupla = t.format === 'Dupla Eliminatória';

            if (t.p2Resolution === 'bye') {
                const info = window.checkPowerOf2(t);
                const target = info.hi;
                const numByes = target - participants.length;
                while (participants.length < target) {
                    participants.push('BYE (Avança Direto)');
                }
                // VIPs têm preferência de BYE: colocar VIPs em posição par (p1) antes de BYEs (p2)
                if (numByes > 0) {
                    const _vips = t.vips || {};
                    const _getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name || '');
                    // Posições dos BYEs
                    const byeIndices = [];
                    participants.forEach((p, i) => { if (_getName(p) === 'BYE (Avança Direto)') byeIndices.push(i); });
                    // Encontrar VIPs que NÃO estão já antes de um BYE
                    const vipIndices = [];
                    participants.forEach((p, i) => {
                        const nm = _getName(p);
                        if (nm !== 'BYE (Avança Direto)' && _vips[nm]) vipIndices.push(i);
                    });
                    // Trocar: para cada BYE em posição ímpar, colocar um VIP na posição par anterior
                    let vipIdx = 0;
                    for (let bi = 0; bi < byeIndices.length && vipIdx < vipIndices.length; bi++) {
                        const byePos = byeIndices[bi];
                        if (byePos % 2 === 1) { // BYE é p2
                            const pairPos = byePos - 1; // p1 do mesmo jogo
                            const currentP1 = _getName(participants[pairPos]);
                            if (!_vips[currentP1]) { // p1 não é VIP, trocar com um VIP
                                const vi = vipIndices[vipIdx];
                                if (vi !== pairPos) {
                                    [participants[pairPos], participants[vi]] = [participants[vi], participants[pairPos]];
                                    // Atualizar índices
                                    const swappedIdx = vipIndices.indexOf(pairPos);
                                    if (swappedIdx >= 0) vipIndices[swappedIdx] = vi;
                                }
                                vipIdx++;
                            }
                        }
                    }
                }
            }

            const getName = (p) => typeof p === 'string' ? p : (p.displayName || p.name);

            // Gerar partidas de 1ª Rodada (Upper Bracket R1)
            for (let i = 0; i < participants.length; i += 2) {
                const p1 = participants[i];
                const p2 = i + 1 < participants.length ? participants[i + 1] : 'BYE (Avança Direto)';
                const p1Name = getName(p1);
                const p2Name = getName(p2);
                const isBye = p2Name === 'BYE (Avança Direto)';

                matches.push({
                    id: `match-${timestamp}-${i}`,
                    round: 1,
                    bracket: isDupla ? 'upper' : undefined,
                    p1: p1Name,
                    p2: p2Name,
                    winner: isBye ? p1Name : null,
                    isBye: isBye
                });
            }

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
            window.AppStore.sync();

            if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();

            showNotification('Sucesso', 'Sorteio realizado com sucesso!', 'success');
            window._lastActiveTournamentId = tId;
            window.location.hash = `#bracket/${tId}`;
        };

        // Build nextMatchId links for single elim bracket
        // Gera TODAS as rodadas futuras (R2, R3, ..., Final) com participantes TBD
        window._buildNextMatchLinks = function (t) {
            if (!t.matches || !t.matches.length) return;
            const roundsMap = {};
            t.matches.forEach(m => {
                if (!roundsMap[m.round]) roundsMap[m.round] = [];
                roundsMap[m.round].push(m);
            });

            // Calcula quantas rodadas terão baseado na R1
            const r1Matches = (roundsMap[1] || []).length;
            const totalRounds = Math.ceil(Math.log2(r1Matches * 2));
            const timestamp = Date.now();

            // Gerar rodadas futuras (R2 até Final)
            for (let r = 2; r <= totalRounds; r++) {
                const prevRound = roundsMap[r - 1] || [];
                const expectedNext = Math.ceil(prevRound.length / 2);
                if (!roundsMap[r]) roundsMap[r] = [];

                while (roundsMap[r].length < expectedNext) {
                    const idx = roundsMap[r].length;
                    const nm = {
                        id: `match-r${r}-${idx}-${timestamp + r}`,
                        round: r,
                        p1: 'TBD', p2: 'TBD', winner: null
                    };
                    roundsMap[r].push(nm);
                    t.matches.push(nm);
                }

                // Linkar matches da rodada anterior → próxima rodada
                prevRound.forEach((m, idx) => {
                    const nextMatchIdx = Math.floor(idx / 2);
                    if (roundsMap[r][nextMatchIdx]) {
                        m.nextMatchId = roundsMap[r][nextMatchIdx].id;
                    }
                });
            }

            // Processar BYE matches da R1 — avançar automaticamente
            (roundsMap[1] || []).forEach(m => {
                if (m.isBye && m.winner && m.nextMatchId) {
                    const next = t.matches.find(nm => nm.id === m.nextMatchId);
                    if (next) {
                        if (!next.p1 || next.p1 === 'TBD') next.p1 = m.winner;
                        else if (!next.p2 || next.p2 === 'TBD') next.p2 = m.winner;
                    }
                }
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
                    const prevLowerCount = (lowerRounds[lowerRoundNum - 1] || []).length;
                    const mergeCount = Math.max(prevLowerCount, Math.ceil(upperLosersCount / 1));
                    // Actually, the merge count = previous lower round winners count
                    const actualMergeCount = prevLowerCount;

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

        window.enrollDeenrollSetupDone = true;
    }

    if (!window.dragDropTeamSetupDone) {
        window.handleDragStart = function (e, idx, tId) {
            e.dataTransfer.setData('text/plain', JSON.stringify({ idx, tId }));
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => e.target.style.opacity = '0.4', 0);
        };

        window.handleDragEnd = function (e) {
            e.target.style.opacity = '1';
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

                        if (typeof window.AppStore.sync === 'function') window.AppStore.sync();

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

        window.dragDropTeamSetupDone = true;
    }

    if (tournamentId) {
        visible = visible.filter(t => t.id && t.id.toString() === tournamentId.toString());
        // If tournament not found in visible list, try loading it directly from Firestore
        if (visible.length === 0 && window.FirestoreDB && window.FirestoreDB.db) {
            container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Carregando torneio...</div>';
            window.FirestoreDB.db.collection('tournaments').doc(String(tournamentId)).get().then(function(doc) {
                if (doc.exists) {
                    var t = doc.data();
                    // Add to AppStore if not there
                    var exists = window.AppStore.tournaments.some(function(x) { return String(x.id) === String(t.id); });
                    if (!exists) {
                        window.AppStore.tournaments.push(t);
                    }
                    // Track as invited
                    if (window.AppStore._invitedTournamentIds.indexOf(String(tournamentId)) === -1) {
                        window.AppStore._invitedTournamentIds.push(String(tournamentId));
                        try { sessionStorage.setItem('_invitedTournamentIds', JSON.stringify(window.AppStore._invitedTournamentIds)); } catch(e) {}
                    }
                    // Re-render
                    renderTournaments(container, tournamentId);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Torneio n\u00E3o encontrado.</div>';
                }
            }).catch(function(err) {
                console.warn('Error loading tournament:', err);
                if (!window.AppStore.currentUser) {
                    // Not logged in — show invite card with enroll button
                    container.innerHTML = '<div style="max-width:500px;width:100%;margin:2rem auto;text-align:center;padding:2rem;box-sizing:border-box;">' +
                        '<div style="font-size:3rem;margin-bottom:1rem;">\u{1F3C6}</div>' +
                        '<h2 style="color:var(--text-bright);margin-bottom:0.5rem;">Voc\u00EA foi convidado para um torneio!</h2>' +
                        '<p style="color:var(--text-muted);margin-bottom:1.5rem;">Fa\u00E7a login para ver os detalhes e se inscrever.</p>' +
                        '<button class="btn hover-lift" onclick="window.enrollCurrentUser(\'' + String(tournamentId) + '\')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:800;font-size:1.15rem;padding:16px 48px;border-radius:14px;box-shadow:0 6px 24px rgba(16,185,129,0.45);letter-spacing:0.5px;display:inline-flex;align-items:center;gap:10px;">' +
                        '\u2705 Inscrever-se</button></div>';
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Erro ao carregar torneio. Tente novamente.</div>';
                }
            });
            return;
        }
    }

    const cleanSportName = (sport) => sport ? sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
    const getSportIcon = (sport) => {
        if (!sport) return '🏅';
        const s = sport.toLowerCase();
        if (s.includes('futebol') || s.includes('society') || s.includes('futsal')) return '⚽';
        if (s.includes('vôlei') || s.includes('volei')) return '🏐';
        if (s.includes('basquete')) return '🏀';
        if (s.includes('tênis de mesa') || s.includes('ping')) return '🏓';
        if (s.includes('tênis') || s.includes('tennis') || s.includes('padel')) return '🎾';
        if (s.includes('xadrez')) return '♟️';
        if (s.includes('magic') || s.includes('tcg') || s.includes('card')) return '🃏';
        if (s.includes('esports') || s.includes('game')) return '🎮';
        if (s.includes('kart') || s.includes('corrida')) return '🏎️';
        if (s.includes('luta') || s.includes('boxe')) return '🥊';
        return '🏅';
    };

    const renderTournamentCard = (t, isOrg) => {
        const publicText = t.isPublic ? 'Público' : 'Privado';

        const formatDateBr = (dStr) => {
            if (!dStr) return '';
            try {
                const datePart = dStr.includes('T') ? dStr.split('T')[0] : dStr;
                const timePart = dStr.includes('T') ? dStr.split('T')[1] : '';
                const [y, m, d] = datePart.split('-');
                if (y && m && d) {
                    let result = d + '/' + m + '/' + y;
                    if (timePart) result += ' ' + timePart.substring(0, 5);
                    return result;
                }
            } catch (e) { }
            return dStr;
        };

        const start = formatDateBr(t.startDate);
        const end = formatDateBr(t.endDate);
        const dates = start ? (end ? `${start} A ${end}` : `${start}`) : 'A DEFINIR';
        const regLimit = formatDateBr(t.registrationLimit);
        const cats = (t.categories && t.categories.length) ? t.categories.join(', ') : 'Cat. Única';

        // Inscrições fecham após sorteio (status 'active'), exceto Liga com inscrições abertas na temporada
        const sorteioRealizado = t.status === 'active' && ((Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0));
        const ligaAberta = t.format === 'Liga' && t.ligaOpenEnrollment !== false && sorteioRealizado;
        const isAberto = t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date()) || ligaAberta;
        const statusText = isAberto ? 'Inscrições Abertas' : (sorteioRealizado ? 'Em Andamento' : 'Inscrições Encerradas');
        const statusBg = isAberto ? '#fbbf24' : (sorteioRealizado ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)');
        const statusColor = isAberto ? '#78350f' : (sorteioRealizado ? '#34d399' : '#fca5a5');
        const statusFontWeight = isAberto ? '700' : '600';

        let enrollmentText = 'Misto (Individual e Times)';
        if (t.enrollmentMode === 'individual') enrollmentText = 'Individual';
        else if (t.enrollmentMode === 'time') enrollmentText = 'Apenas Times';
        else if (t.enrollmentMode === 'misto') enrollmentText = 'Misto (Individual e Times)';

        const sortearOnClick = `event.stopPropagation(); window._handleSortearClick('${t.id}', ${isAberto})`;

        let isParticipating = false;
        if (t.participants && window.AppStore.currentUser) {
            const user = window.AppStore.currentUser;
            const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
            isParticipating = arr.some(p => {
                const str = typeof p === 'string' ? p : (p.email || p.displayName);
                return str && (str.includes(user.email) || str.includes(user.displayName));
            });
        }

        let bgGradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'; // Dark slate para explorador/não-participante
        if (isOrg) {
            bgGradient = 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)'; // Purple para Organizador
        } else if (isParticipating) {
            bgGradient = 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)'; // Teal para Participante
        }

        // Venue photo background — overlay gradient on top of photo
        let venuePhotoBg = '';
        if (t.venuePhotoUrl) {
            var overlayGradient = isOrg
                ? 'linear-gradient(135deg, rgba(67,56,202,0.85) 0%, rgba(99,102,241,0.8) 100%)'
                : isParticipating
                    ? 'linear-gradient(135deg, rgba(15,118,110,0.85) 0%, rgba(20,184,166,0.8) 100%)'
                    : 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.8) 100%)';
            venuePhotoBg = 'background-image: ' + overlayGradient + ', url(' + t.venuePhotoUrl + '); background-size: cover; background-position: center;';
        }

        let individualCount = 0;
        let teamCount = 0;
        if (t.participants) {
            const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
            arr.forEach(p => {
                const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
                if (pStr.includes('/')) {
                    teamCount++;
                    individualCount += pStr.split('/').filter(n => n.trim().length > 0).length;
                } else {
                    individualCount++;
                }
            });
        }
        const standbyCount = Array.isArray(t.standbyParticipants) ? t.standbyParticipants.length : 0;

        const expectedTeammates = Math.max(0, (t.teamSize || 2) - 1);
        const teamEnrollModalHtml = `
         <div id="team-enroll-modal-${t.id}" class="team-enroll-modal-container" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 10000; align-items: flex-start; justify-content: center; cursor: default; overflow-y: auto; padding: 2rem 0;" onclick="event.stopPropagation()">
            <div style="background: var(--bg-card); width: 90%; max-width: 450px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.4); margin: auto; animation: fadeIn 0.2s ease;">
               
               <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                  <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-bright);">👥 Inscrição de Equipe</h3>
                  <button style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;" onclick="event.stopPropagation(); document.getElementById('team-enroll-modal-${t.id}').style.display='none'">&times;</button>
               </div>
               
               <div style="padding: 1.5rem; color: var(--text-main); font-size: 0.9rem; text-align: left;">
                  <p style="margin-bottom: 1rem; color: var(--text-muted);">Este torneio exige times predefinidos de <strong>${t.teamSize || 2} participantes</strong>. Como capitão, por favor informe o nome dos seus parceiros de equipe antes de concluir a sua inscrição.</p>
                  
                  <form id="form-team-enroll-${t.id}" onsubmit="event.stopPropagation(); event.preventDefault(); window.submitTeamEnroll('${t.id}')">
                     <div style="margin-bottom: 1.2rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-muted);">1. Capitão (Você):</label>
                        <input type="text" value="${window.AppStore.currentUser ? window.AppStore.currentUser.displayName : ''}" disabled style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.3); color: var(--text-muted); opacity: 0.8;">
                     </div>
                     
                     <div id="team-members-inputs-${t.id}">
                        ${Array.from({ length: expectedTeammates }).map((_, i) => `
                           <div style="margin-bottom: 1rem;">
                              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-muted);">${i + 2}. Nome do Integrante:</label>
                              <input type="text" class="team-member-name-${t.id}" placeholder="Ex: Maria Souza" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main);" required>
                           </div>
                        `).join('')}
                     </div>

                     <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 1rem;">
                        <button type="button" class="btn hover-lift" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 10px 20px;" onclick="event.stopPropagation(); document.getElementById('team-enroll-modal-${t.id}').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn hover-lift" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 20px; font-weight: 600;">Confirmar Inscrição da Equipe</button>
                     </div>
                  </form>
               </div>
            </div>
         </div>
      `;

        // Ações Específicas da tela Explore
        let actionsHtml = '';
        if (tournamentId) {
            const inviteUrl = 'https://scoreplace.app/#tournaments/' + t.id;
            const inviteText = '🏆 Torneio: ' + t.name + '\nAcesse o link abaixo para se inscrever:\n' + inviteUrl;
            const inviteModalHtml = `
             <div id="invite-modal-${t.id}" class="invite-modal-container" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; cursor: default; overflow-y: auto; padding: 1rem;" onclick="event.stopPropagation()">
                <div style="background: var(--bg-card); width: 100%; max-width: 380px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.4); animation: fadeIn 0.2s ease; margin: auto;">

                   <!-- Header -->
                   <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                      <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-bright);">Convidar Jogadores</h3>
                      <button style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; line-height: 1;" onclick="event.stopPropagation(); closeInviteModal('${t.id}')">&times;</button>
                   </div>

                   <div style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">

                      <!-- 1. QR Code -->
                      <div style="text-align: center;">
                         <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 0.75rem;">QR Code</div>
                         <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block;">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=111111&data=${encodeURIComponent(inviteUrl)}" alt="QR Code" width="160" height="160" style="display: block;">
                         </div>
                         <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Escaneie com a câmera do celular</div>
                      </div>

                      <div style="height: 1px; background: var(--border-color);"></div>

                      <!-- 2. WhatsApp -->
                      <div>
                         <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 0.5rem;">WhatsApp</div>
                         <button class="btn hover-lift" style="width: 100%; background: #25D366; color: white; border: none; font-weight: 600; padding: 10px 16px; border-radius: 10px; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent('${inviteText.replace(/'/g, "\\'")}'), '_blank')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Enviar via WhatsApp
                         </button>
                      </div>

                      <div style="height: 1px; background: var(--border-color);"></div>

                      <!-- 3. Copiar Link -->
                      <div>
                         <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 0.5rem;">Link do Torneio</div>
                         <div style="display: flex; gap: 8px; align-items: stretch;">
                            <input type="text" readonly value="${inviteUrl}" id="invite-url-${t.id}" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main); font-size: 0.8rem; min-width: 0;" onclick="this.select()">
                            <button class="btn hover-lift" style="background: var(--primary-color); color: white; border: none; font-weight: 600; padding: 8px 14px; border-radius: 8px; font-size: 0.8rem; white-space: nowrap;" onclick="navigator.clipboard.writeText(document.getElementById('invite-url-${t.id}').value); showNotification('Copiado!', 'Link copiado.', 'success')">Copiar</button>
                         </div>
                         <div style="margin-top: 6px;">
                            <button style="background: none; border: none; color: var(--primary-color); font-size: 0.75rem; cursor: pointer; padding: 0; text-decoration: underline;" onclick="navigator.clipboard.writeText('${inviteText.replace(/'/g, "\\'")}'); showNotification('Copiado!', 'Convite completo copiado.', 'success')">Copiar convite completo com nome do torneio</button>
                         </div>
                      </div>

                      <div style="height: 1px; background: var(--border-color);"></div>

                      <!-- 4. Email -->
                      <div>
                         <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 0.5rem;">Enviar por E-mail</div>
                         <div style="display: flex; gap: 8px; align-items: stretch;">
                            <input type="email" placeholder="email@exemplo.com" id="invite-email-${t.id}" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main); font-size: 0.85rem; min-width: 0;">
                            <button class="btn hover-lift" style="background: rgba(99,102,241,0.9); color: white; border: none; font-weight: 600; padding: 8px 14px; border-radius: 8px; font-size: 0.8rem; white-space: nowrap;" onclick="var email = document.getElementById('invite-email-${t.id}').value; if(!email){showNotification('Atenção','Digite um e-mail.','warning');return;} window.open('mailto:' + email + '?subject=' + encodeURIComponent('Convite: ${t.name}') + '&body=' + encodeURIComponent('${inviteText.replace(/'/g, "\\'")}'), '_self'); showNotification('E-mail', 'Abrindo seu cliente de e-mail...', 'info');">Enviar</button>
                         </div>
                      </div>

                   </div>

                   <!-- Footer -->
                   <div style="padding: 0.75rem 1.5rem 1.25rem; text-align: center;">
                      <button style="background: none; border: none; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; padding: 6px 16px;" onclick="event.stopPropagation(); closeInviteModal('${t.id}')">Fechar</button>
                   </div>
                </div>
             </div>
          `;

            const editModalHtml = '';

            const enrollBtnHtml = (isParticipating && isAberto) ? `
             <button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; font-weight: 700; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);" onclick="event.stopPropagation(); window.deenrollCurrentUser('${t.id}')">🛑 Desinscrever-se</button>
          ` : (isAberto ? `
             <button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')">✅ Inscrever-se</button>
          ` : '');

            const hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
            const tournamentStarted = !!t.tournamentStarted;

            if (isOrg) {
                // Botão "Iniciar Torneio" — SÓ aparece após sorteio realizado, antes de iniciar
                const startTournamentBanner = (hasDraw && !tournamentStarted) ? `
                  <div style="margin-top:1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
                      <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Sorteio realizado. Inicie o torneio para habilitar a chamada de presença.</p>
                      <button class="btn hover-lift" onclick="event.stopPropagation(); window._startTournament('${t.id}')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:800;font-size:1.1rem;padding:14px 40px;border-radius:12px;box-shadow:0 6px 20px rgba(16,185,129,0.4);letter-spacing:0.5px;">
                          ▶ Iniciar Torneio
                      </button>
                  </div>` : '';

                const startedBadge = tournamentStarted ? `
                  <div style="margin-top:1rem;display:flex;align-items:center;gap:8px;justify-content:center;">
                      <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;animation:pulse 2s infinite;"></span>
                      <span style="font-size:0.85rem;font-weight:700;color:#4ade80;">Torneio em andamento</span>
                  </div>` : '';

                // Botões de +Participante e +Time baseados no modo de inscrição (antes do sorteio)
                const allowsIndividual = !t.enrollmentMode || t.enrollmentMode === 'individual' || t.enrollmentMode === 'misto';
                const allowsTeams = t.enrollmentMode === 'time' || t.enrollmentMode === 'misto';
                const addParticipantBtns = !hasDraw ? `
                     ${allowsIndividual ? `<button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; border: none; font-weight: 500;" onclick="event.stopPropagation(); window.addParticipantFunction('${t.id}')">👤 + Participante</button>` : ''}
                     ${allowsTeams ? `<button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; font-weight: 500;" onclick="event.stopPropagation(); window.addTeamFunction('${t.id}')">👥 + Time</button>` : ''}
                ` : '';

                // Encerrar/Reabrir Inscrições — visível para org antes do sorteio
                const toggleRegBtn = !hasDraw ? `<button class="btn btn-sm hover-lift" style="background: ${t.status === 'closed' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'}; color: white; border: none; font-weight: 500;" onclick="event.stopPropagation(); window.toggleRegistrationStatus('${t.id}')">${t.status === 'closed' ? '✅ Reabrir Inscrições' : '🛑 Encerrar Inscrições'}</button>` : '';

                // Sortear — aparece quando inscrições encerradas e sem sorteio feito
                const sortearBtn = (t.status === 'closed' && !hasDraw) ? `<button class="btn btn-sm hover-lift" style="background: #fbbf24; color: #78350f; border: none; font-weight: 700;" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">🎲 Sortear</button>` : '';

                // Sortear com inscrições abertas — usa _handleSortearClick que pergunta se quer encerrar
                const sortearAberto = (t.status !== 'closed' && !hasDraw) ? `<button class="btn btn-sm hover-lift" style="background: rgba(251,191,36,0.2); color: #fbbf24; border: 1px solid rgba(251,191,36,0.4); font-weight: 600;" onclick="${sortearOnClick}">🎲 Sortear</button>` : '';

                // --- Build actionsHtml based on tournament state ---
                if (hasDraw) {
                    // Sorteio já feito — mostrar Iniciar Torneio ou badge Em Andamento + Ver Chaves
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${startTournamentBanner}
                   ${startedBadge}
                   <div class="mt-4" style="display: flex; justify-content: space-between; flex-wrap: wrap; align-items: center; gap: 1rem;">
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                         <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.2); color: white; border: none; font-weight: 600;" onclick="window._lastActiveTournamentId='${t.id}';window.location.hash='#bracket/${t.id}'">🏆 Ver Chaves</button>
                      </div>
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: flex-end; margin-left: auto;">
                         <button class="btn btn-sm hover-lift" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px dashed #ef4444; font-weight: 700;" onclick="event.stopPropagation(); window.deleteTournamentFunction('${t.id}')">🗑️ Apagar Torneio</button>
                      </div>
                   </div>
                 `;
                } else {
                    // Antes do sorteio — mostrar botões de gestão de inscrições
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${teamEnrollModalHtml}
                   <div class="mt-4" style="display: flex; justify-content: space-between; flex-wrap: wrap; align-items: center; gap: 1rem;">
                      <!-- Esquerda: ações de inscrição -->
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                         ${t.status !== 'closed' ? `<button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); font-weight: 500;" onclick="event.stopPropagation(); openInviteModal('${t.id}')">📤 Convidar</button>` : ''}
                         ${enrollBtnHtml}
                         ${addParticipantBtns}
                      </div>

                      <!-- Direita: gestão do torneio -->
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: flex-end; margin-left: auto;">
                         ${toggleRegBtn}
                         ${sortearBtn}
                         ${sortearAberto}
                      </div>
                   </div>
                   <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                      <button class="btn btn-sm hover-lift" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px dashed #ef4444; font-weight: 700; font-size: 0.75rem;" onclick="event.stopPropagation(); window.deleteTournamentFunction('${t.id}')">🗑️ Apagar Torneio</button>
                   </div>
                 `;
                }
            } else if (!window.AppStore.currentUser) {
                // Non-logged-in user viewing public tournament — show only enroll CTA if open
                if (isAberto) {
                    actionsHtml = `
                   ${teamEnrollModalHtml}
                   <div style="margin-top:1.5rem;padding:24px;background:linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12));border:2px solid rgba(16,185,129,0.5);border-radius:16px;text-align:center;">
                      <h3 style="color:#4ade80;font-size:1.3rem;font-weight:800;margin-bottom:6px;">Participe deste torneio!</h3>
                      <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:16px;">Fa\u00E7a login para se inscrever. Voc\u00EA ser\u00E1 inscrito automaticamente.</p>
                      <button class="btn hover-lift" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:800;font-size:1.15rem;padding:16px 48px;border-radius:14px;box-shadow:0 6px 24px rgba(16,185,129,0.45);letter-spacing:0.5px;display:inline-flex;align-items:center;gap:10px;">
                         \u2705 Inscrever-se
                      </button>
                   </div>
                 `;
                } else {
                    // Inscriptions closed — just show status, no actions
                    actionsHtml = '';
                }
            } else {
                actionsHtml = `
               ${teamEnrollModalHtml}
               <div class="d-flex justify-between align-center mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.15);">
                  <div class="d-flex gap-2">
                     <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.3);" onclick="typeof openEnrollModal === 'function' && openEnrollModal()">Convites</button>
                     ${enrollBtnHtml}
                     <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.2); color: white; border: none; font-weight: 600;" onclick="window.location.hash='#rules/${t.id}'">Regras</button>
                  </div>
               </div>
             `;
            }
        } else {
            const enrollBtnHtml = (isParticipating && isAberto) ? `
             <button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; font-weight: 700; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);" onclick="event.stopPropagation(); window.deenrollCurrentUser('${t.id}')">🛑 Desinscrever-se</button>
          ` : (isAberto ? `
             <button class="btn btn-sm hover-lift" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')">✅ Inscrever-se</button>
          ` : '');

            actionsHtml = `
            ${teamEnrollModalHtml}
            <div class="d-flex justify-between align-center mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.15);">
               <div>
                  <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; font-weight: 600;" onclick="window._lastActiveTournamentId='${t.id}';window.location.hash='#bracket/${t.id}'">Ver Chaves</button>
               </div>
               <div class="d-flex gap-2">
                  <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.3);" onclick="typeof openEnrollModal === 'function' && openEnrollModal()">Convites</button>
                  ${enrollBtnHtml}
                  ${isOrg ? `<button class="btn btn-sm hover-lift" style="background: #fbbf24; color: #78350f; border: none; font-weight: 600;" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">Sorteio Mágico</button>` : `<button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.2); color: white; border: none; font-weight: 600;" onclick="window.location.hash='#rules/${t.id}'">Regras</button>`}
               </div>
            </div>
          `;
        }

        return `
        <div class="card mb-3" style="${venuePhotoBg ? venuePhotoBg : 'background: ' + bgGradient + ';'} color: white; border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: transform 0.2s; ${!tournamentId ? 'cursor: pointer;' : ''}" ${!tournamentId ? `onclick="window.location.hash='#tournaments/${t.id}'" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'"` : ''}>
          <div class="card-body p-4">
            
            <!-- Top Row: Icon/Modality | Status (same line on mobile) -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; flex-wrap: nowrap;">
               <div style="display: flex; align-items: center; gap: 6px; opacity: 0.65; flex-shrink: 0;">
                  <span style="font-size: 1.1rem;">${getSportIcon(t.sport)}</span>
                  <span>${cleanSportName(t.sport) || 'Esporte'}</span>
               </div>
               <div style="color: ${statusColor}; background: ${statusBg}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: ${statusFontWeight}; white-space: nowrap; flex-shrink: 0;">
                  ${statusText}
               </div>
            </div>
            ${tournamentId ? `<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
               <div style="opacity: 0.8;">Inscrição: ${enrollmentText}</div>
               ${isOrg && t.status !== 'closed' ? `<button class="btn btn-sm hover-lift" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px dashed #ef4444; font-weight: 600; padding: 2px 8px; font-size: 0.7rem; text-transform: none; letter-spacing: 0;" onclick="event.stopPropagation(); window.addBotsFunction('${t.id}')">🤖 Add Bot</button>` : ''}
            </div>` : ''}

            <!-- Middle Left: Nome -->
            <h4 style="margin: 1.8rem 0 0.5rem 0; font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; text-align: left;">
              ${t.name}
            </h4>
            ${isOrg && tournamentId && t.status !== 'closed' ? `<div style="margin-bottom: 1rem;"><button class="hover-lift" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 4px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="event.stopPropagation(); window.openEditModal('${t.id}');">✏️ Editar Torneio</button></div>` : ''}

            <!-- Below Name: Calendário + Data -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; opacity: 0.7;">
               <span style="font-size: 1.1rem;">🗓️</span>
               <span>${dates}</span>
            </div>
            ${t.venue ? `
            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; font-weight: 500; opacity: 0.65; margin-top: 6px;">
               <span style="font-size: 1rem; flex-shrink:0;">📍</span>
               <span style="display:flex; flex-direction:column; gap:1px;">
                 <span>${t.venue}${t.courtCount > 1 ? ' — ' + t.courtCount + ' quadras' : t.courtCount === 1 ? ' — 1 quadra' : ''}</span>
                 ${t.venueAddress ? '<span style="font-size:0.75rem; font-weight:400; opacity:0.7;">' + t.venueAddress + '</span>' : ''}
               </span>
               ${t.venueLat && t.venueLon ? '<a href="' + (t.venuePlaceId ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.venue) + '&query_place_id=' + t.venuePlaceId : 'https://www.google.com/maps/search/?api=1&query=' + t.venueLat + ',' + t.venueLon) + '" target="_blank" title="Ver no mapa" style="color:#818cf8; text-decoration:none; font-size:1rem; flex-shrink:0;">🗺️</a>' : ''}
            </div>` : ''}

            <!-- Linha separadora -->
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1.8rem 0;"></div>

            <!-- Bottom Section -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center; opacity: 0.75;">
               
               <!-- Stats Column -->
                <div style="display: inline-flex; flex-direction: column; gap: 8px; width: 100%;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px; width: fit-content;">
                           <span style="font-size: 1.1rem; margin-right: 4px;">👤</span>
                           <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${individualCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; opacity: 0.8;">Inscritos</span>
                        </div>
                        ${standbyCount > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: center; background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px; width: fit-content;">
                           <span style="font-size: 1.1rem; margin-right: 4px;">⏳</span>
                           <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; color: #fbbf24;">${standbyCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; color: #fbbf24; opacity: 0.9;">Lista de Espera</span>
                        </div>
                        ` : ''}
                    </div>
                    ${teamCount > 0 ? `
                    <div style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px; width: fit-content;">
                       <span style="font-size: 1.1rem; margin-right: 4px;">👥</span>
                       <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                       <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; opacity: 0.8;">Equipes</span>
                    </div>
                    ` : ''}
                </div>

               <!-- Formato, Regras e Categorias -->
               <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem;">
                  <div><strong>Formato:</strong> ${t.format}</div>
                  <div><strong>Acesso:</strong> ${publicText}</div>
                  <div><strong>Categorias:</strong> ${cats}</div>
               </div>
            </div>

            ${actionsHtml}

          </div>
        </div>
      `;
    };

    let gridHtml = '';
    if (visible.length === 0) {
        gridHtml = `<div class="card p-4 text-center" style="grid-column: 1/-1;"><p class="text-muted mt-3 mb-3">Nenhum torneio encontrado. Configure um novo torneio ou faça login para ver seus convites.</p></div>`;
    } else {
        gridHtml = visible.map(t => {
            const isOrg = typeof window.AppStore.isOrganizer === 'function' ? window.AppStore.isOrganizer(t) : false;
            return renderTournamentCard(t, isOrg);
        }).join('');
    }

    let headerHtml = `
    <div class="mb-4">
      <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.05); color: var(--text-bright); border: 1px solid rgba(255,255,255,0.1); display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px; font-weight: 500;" onclick="window.history.length > 1 ? window.history.back() : window.location.hash='#dashboard'">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
         Voltar
      </button>
    </div>
    <div class="d-flex justify-between align-center mb-4">
      <div>
        <h2>Torneios e Ligas</h2>
        <p class="text-muted">Gerencie ou inscreva-se nos torneios disponíveis.</p>
      </div>
    </div>
  `;

    let participantsHtml = '';
    if (tournamentId && visible.length === 1) {
        const t = visible[0];
        const isOrg = typeof window.AppStore.isOrganizer === 'function' ? window.AppStore.isOrganizer(t) : false;
        const parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];
        let individualCountParts = 0;
        parts.forEach(p => {
            const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
            if (pStr.includes('/')) {
                individualCountParts += pStr.split('/').filter(n => n.trim().length > 0).length;
            } else {
                individualCountParts++;
            }
        });

        if (parts.length > 0) {
            // Ordenar: Times formados primeiro, depois inscritos individuais
            parts.sort((a, b) => {
                const pNameA = typeof a === 'string' ? a : (a.displayName || a.name || a.email || '');
                const pNameB = typeof b === 'string' ? b : (b.displayName || b.name || b.email || '');
                const isTeamA = pNameA.includes('/');
                const isTeamB = pNameB.includes('/');
                if (isTeamA && !isTeamB) return -1;
                if (!isTeamA && isTeamB) return 1;
                return 0;
            });
            t.participants = parts;

            // Check-in state
            if (!t.checkedIn) t.checkedIn = {};
            const checkedIn = t.checkedIn;
            const hasMatches = (t.matches && t.matches.length > 0) || (t.rounds && t.rounds.length > 0) || (t.groups && t.groups.length > 0);
            const drawDone = hasMatches || t.status === 'started' || t.status === 'in_progress';

            // Check-in habilitado: sorteio feito E torneio iniciado (botão "Iniciar Torneio")
            const canCheckIn = drawDone && !!t.tournamentStarted;

            // Count check-in stats
            let totalIndividuals = 0;
            let checkedCount = 0;
            parts.forEach(p => {
                const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
                if (pName.includes('/')) {
                    pName.split('/').forEach(n => {
                        const nm = n.trim();
                        if (nm) { totalIndividuals++; if (checkedIn[nm]) checkedCount++; }
                    });
                } else {
                    if (pName) { totalIndividuals++; if (checkedIn[pName]) checkedCount++; }
                }
            });

            // Current filter state
            const currentFilter = window._checkInFilter || 'all';

            // ── Check-in mode: show each individual with checkbox ──
            let cardsStr = '';
            if (canCheckIn) {
                // Flatten all participants to individual names
                const allIndividuals = [];
                parts.forEach((p, idx) => {
                    const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || 'Participante ' + (idx + 1));
                    if (pName.includes('/')) {
                        // Find which team this person belongs to
                        pName.split('/').map(n => n.trim()).filter(n => n).forEach(n => {
                            allIndividuals.push({ name: n, teamName: pName, teamIdx: idx });
                        });
                    } else {
                        allIndividuals.push({ name: pName, teamName: null, teamIdx: idx });
                    }
                });

                // Sort: unchecked first, then checked
                allIndividuals.sort((a, b) => {
                    const ac = !!checkedIn[a.name], bc = !!checkedIn[b.name];
                    if (ac && !bc) return 1;
                    if (!ac && bc) return -1;
                    return 0;
                });

                const _vipMapCI = t.vips || {};
                cardsStr = allIndividuals.map((ind, i) => {
                    const mc = !!checkedIn[ind.name];

                    // Filter
                    if (currentFilter === 'present' && !mc) return '';
                    if (currentFilter === 'absent' && mc) return '';

                    const teamLabel = ind.teamName ? ind.teamName.replace(/\//g, ' / ') : '';
                    const isVipCI = !!_vipMapCI[ind.name] || (ind.teamName && !!_vipMapCI[ind.teamName]);
                    const vipTagCI = isVipCI ? ' <span style="background:linear-gradient(135deg,#eab308,#fbbf24);color:#1a1a2e;font-size:0.55rem;font-weight:900;padding:1px 5px;border-radius:3px;letter-spacing:0.5px;">⭐ VIP</span>' : '';

                    return `
                      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${mc ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)'};border:1px solid ${mc ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'};${isVipCI ? 'border-left:3px solid #fbbf24;' : ''}transition:all 0.2s;cursor:pointer;" onclick="window._toggleCheckIn('${t.id}', '${ind.name.replace(/'/g, "\\'")}')">
                          <input type="checkbox" ${mc ? 'checked' : ''} onclick="event.stopPropagation(); window._toggleCheckIn('${t.id}', '${ind.name.replace(/'/g, "\\'")}');" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer;flex-shrink:0;" />
                          <div style="flex:1;overflow:hidden;">
                              <div style="font-weight:600;font-size:0.92rem;color:${mc ? '#4ade80' : 'var(--text-bright)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${mc ? 'text-decoration:line-through;text-decoration-color:rgba(74,222,128,0.3);' : ''}">${ind.name}${vipTagCI}</div>
                              ${teamLabel ? `<div style="font-size:0.7rem;color:var(--text-muted);opacity:0.5;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${teamLabel}</div>` : ''}
                          </div>
                          <div style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:8px;${mc ? 'background:rgba(16,185,129,0.15);color:#4ade80;' : 'background:rgba(100,116,139,0.15);color:#94a3b8;'}">${mc ? 'Presente' : 'Ausente'}</div>
                      </div>`;
                }).join('');
            } else {
                // ── Normal mode: show teams/individuals with drag, split, delete, VIP ──
                const _vipMap = t.vips || {};
                cardsStr = parts.map((p, idx) => {
                    const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || 'Participante ' + (idx + 1));
                    const isTeam = pName.includes('/');
                    const isVip = !!_vipMap[pName];
                    const safeP = pName.replace(/'/g, "\\'");

                    let cardStyle = '';
                    if (isVip) {
                        cardStyle = 'background: linear-gradient(135deg, rgba(161,98,7,0.5) 0%, rgba(234,179,8,0.35) 100%); border: 2px solid rgba(251,191,36,0.7); box-shadow: 0 0 12px rgba(251,191,36,0.15);';
                    } else if (isTeam) {
                        cardStyle = 'background: linear-gradient(135deg, rgba(15, 118, 110, 0.6) 0%, rgba(20, 184, 166, 0.6) 100%); border: 1px solid rgba(20, 184, 166, 0.5);';
                    } else {
                        cardStyle = 'background: linear-gradient(135deg, rgba(67, 56, 202, 0.6) 0%, rgba(99, 102, 241, 0.6) 100%); border: 1px solid rgba(99, 102, 241, 0.5);';
                    }

                    let pNameHtml = '';
                    if (isTeam) {
                        const members = pName.split('/').map(n => n.trim()).filter(n => n);
                        pNameHtml = members.map((n, i) => {
                            const icon = i === 0 ? '👑 ' : '👤 ';
                            return `<div style="font-weight:${i === 0 ? '700' : '500'};font-size:${i === 0 ? '0.95rem' : '0.85rem'};color:${i === 0 ? 'var(--text-bright)' : 'var(--text-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;" title="${n}">${icon}${n}</div>`;
                        }).join('');
                    } else {
                        pNameHtml = `<div style="font-weight:600;font-size:0.95rem;color:var(--text-bright);text-overflow:ellipsis;white-space:nowrap;overflow:hidden;" title="${pName}">${pName}</div>`;
                    }

                    const vipBadge = isVip ? '<span style="background:linear-gradient(135deg,#eab308,#fbbf24);color:#1a1a2e;font-size:0.6rem;font-weight:900;padding:1px 6px;border-radius:4px;letter-spacing:0.5px;margin-left:4px;">⭐ VIP</span>' : '';
                    // Label de tipo: origem da equipe
                    const _teamOrigins = t.teamOrigins || {};
                    let _teamLabel = 'Inscrição Individual';
                    if (isTeam) {
                        const origin = _teamOrigins[pName];
                        if (origin === 'inscrita') _teamLabel = 'Equipe Inscrita';
                        else if (origin === 'sorteada') _teamLabel = 'Equipe Sorteada';
                        else if (origin === 'formada') _teamLabel = 'Equipe Formada';
                        else _teamLabel = 'Equipe Formada';
                    }
                    const typeText = _teamLabel + vipBadge;

                    let actionsHtml = '';
                    let dragProps = '';
                    if (isOrg && !drawDone) {
                        const vipBtn = `<button title="${isVip ? 'Remover VIP' : 'Marcar como VIP'}" style="background: ${isVip ? 'linear-gradient(135deg,rgba(234,179,8,0.35),rgba(251,191,36,0.25))' : 'rgba(234,179,8,0.08)'}; color: ${isVip ? '#fbbf24' : '#a3842a'}; border: 1px ${isVip ? 'solid' : 'dashed'} ${isVip ? 'rgba(251,191,36,0.6)' : 'rgba(234,179,8,0.3)'}; border-radius: 6px; cursor: pointer; padding: 2px 8px; font-size: 0.7rem; font-weight: 800; transition: transform 0.2s; letter-spacing: 0.5px;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window._toggleVip('${t.id}', '${safeP}');">⭐ VIP</button>`;
                        const delBtn = `<button title="Remover" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px dashed #ef4444;border-radius:6px;cursor:pointer;padding:2px 6px;font-size:0.75rem;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.removeParticipantFunction('${t.id}', ${idx});">🗑️</button>`;
                        let splitBtn = '';
                        if (pName.includes('/')) {
                            splitBtn = `<button title="Desfazer Equipe" style="background:rgba(14,165,233,0.1);color:#38bdf8;border:1px dashed #0ea5e9;border-radius:6px;cursor:pointer;padding:2px 6px;font-size:0.75rem;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.splitParticipantFunction('${t.id}', ${idx});">✂️</button>`;
                        }
                        actionsHtml = `<div style="display:flex;gap:4px;justify-content:flex-end;margin-top:6px;">${vipBtn}${splitBtn}${delBtn}</div>`;
                        dragProps = `draggable="true" ondragstart="window.handleDragStart(event, ${idx}, '${t.id}')" ondragend="window.handleDragEnd(event)" ondragover="window.handleDragOver(event)" ondragenter="window.handleDragEnter(event)" ondragleave="window.handleDragLeave(event)" ondrop="window.handleDropTeam(event, ${idx})"`;
                    }

                    const numCircle = `<div style="width:40px;height:40px;border-radius:50%;background:${isVip ? 'linear-gradient(135deg, #eab308, #fbbf24)' : 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))'};display:flex;align-items:center;justify-content:center;color:${isVip ? '#1a1a2e' : 'white'};font-weight:bold;font-size:1.1rem;flex-shrink:0;pointer-events:none;">${isVip ? '⭐' : idx + 1}</div>`;

                    return `
                      <div class="participant-card" ${dragProps} style="${cardStyle} border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:0;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s;${!drawDone && isOrg ? 'cursor:grab;' : ''}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                          <div style="display:flex;align-items:center;gap:12px;">
                              ${numCircle}
                              <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;">
                                  ${pNameHtml}
                                  <div style="font-size:0.7rem;color:var(--text-muted);opacity:0.6;margin-top:4px;">${typeText}</div>
                              </div>
                          </div>
                          ${actionsHtml}
                      </div>`;
                }).join('');
            }

            // Filter buttons + progress (only when check-in is active)
            const absentCount = totalIndividuals - checkedCount;
            const pctPresent = totalIndividuals > 0 ? Math.round(checkedCount / totalIndividuals * 100) : 0;
            const checkInControls = canCheckIn ? `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap;">
                    <button onclick="window._setCheckInFilter('${t.id}', 'all')" style="padding:6px 16px;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'all' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'all' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'all' ? '#a5b4fc' : 'var(--text-muted)'};">Todos (${totalIndividuals})</button>
                    <button onclick="window._setCheckInFilter('${t.id}', 'present')" style="padding:6px 16px;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'present' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'present' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'present' ? '#4ade80' : 'var(--text-muted)'};">Presentes (${checkedCount})</button>
                    <button onclick="window._setCheckInFilter('${t.id}', 'absent')" style="padding:6px 16px;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer;border:1px solid ${currentFilter === 'absent' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'};background:${currentFilter === 'absent' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'};color:${currentFilter === 'absent' ? '#f87171' : 'var(--text-muted)'};">Ausentes (${absentCount})</button>
                    <div style="flex:1;min-width:80px;background:rgba(255,255,255,0.06);border-radius:6px;height:8px;">
                        <div style="width:${pctPresent}%;height:100%;background:linear-gradient(90deg,#10b981,#4ade80);border-radius:6px;transition:width 0.3s;"></div>
                    </div>
                    <span style="font-size:0.8rem;color:#94a3b8;font-weight:700;">${pctPresent}%</span>
                    ${checkedCount > 0 ? `<button onclick="window._resetCheckIn('${t.id}')" style="background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);padding:4px 12px;border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;">Limpar</button>` : ''}
                </div>
            ` : '';

            const gridStyle = canCheckIn
                ? 'display:flex;flex-direction:column;gap:6px;'
                : 'display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:1rem;';

            participantsHtml = `
              <div class="mt-5 mb-4">
                 <h3 style="margin-bottom: 1.5rem; font-size: 1.3rem; color: var(--text-bright); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
                    👥 Inscritos Confirmados <span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 3px 10px; border-radius: 12px; font-weight: 600; margin-left: 5px; color: var(--text-muted);">${individualCountParts}</span>
                 </h3>
                 ${checkInControls}
                 <div style="${gridStyle}">
                    ${cardsStr}
                 </div>
              </div>
          `;
        }

        headerHtml = `
        <div class="mb-4">
          <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.05); color: var(--text-bright); border: 1px solid rgba(255,255,255,0.1); display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px; font-weight: 500;" onclick="window.history.length > 1 ? window.history.back() : window.location.hash='#dashboard'">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             Voltar
          </button>
        </div>
      `;
    }

    // Se o torneio já tem chaveamento, ocultar inscritos (terá botão na tela de chaves)
    const hasDrawn = tournamentId && visible.length > 0 && (
      (Array.isArray(visible[0].matches) && visible[0].matches.length > 0) ||
      (Array.isArray(visible[0].rounds) && visible[0].rounds.length > 0) ||
      (Array.isArray(visible[0].groups) && visible[0].groups.length > 0)
    );

    const html = `
    ${headerHtml}

    <div class="tournaments-grid" style="display: grid; grid-template-columns: ${tournamentId ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))'}; gap: 1.5rem;">
      ${gridHtml}
    </div>

    ${hasDrawn ? '' : participantsHtml}

    ${hasDrawn ? `
      <div class="mt-5">
         <h3 style="margin-bottom: 1.5rem; font-size: 1.3rem; color: var(--text-bright); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
            🎲 Chaveamento do Torneio
         </h3>
         <div id="inline-bracket-container"></div>
      </div>
    ` : ''}
  `;
    container.innerHTML = html;

    // Renderiza a chave de forma transparente associada a esse torneio
    if (hasDrawn && typeof renderBracket === 'function') {
        const inlineContainer = document.getElementById('inline-bracket-container');
        if (inlineContainer) {
            renderBracket(inlineContainer, tournamentId, true);
        }
    }
}
