// tournaments-enrollment.js — Enrollment/deenrollment system (extracted from tournaments.js)

(function() {

window.enrollCurrentUser = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    const user = window.AppStore.currentUser;
    if (!user) {
        // Save pending enrollment and trigger login
        try { sessionStorage.setItem('_pendingEnrollTournamentId', String(tId)); } catch(e) {}
        window._pendingEnrollTournamentId = String(tId);
        window._pendingInviteHash = '#tournaments/' + tId;
        // Preserve ref (who invited) — from hash or sessionStorage
        try {
            var _hash = window.location.hash || '';
            var _rm = _hash.match(/[?&]ref=([^&]+)/);
            if (_rm) sessionStorage.setItem('_inviteRefUid', decodeURIComponent(_rm[1]));
        } catch(e) {}
        // Open login modal with all options (Google, Apple, Facebook, email/password)
        if (typeof openModal === 'function') {
            openModal('modal-login');
        }
        return;
    }
    if (t) {
        // Verifica se as inscrições estão realmente abertas
        if (t.status === 'finished') {
            showAlertDialog('Torneio Encerrado', 'Este torneio já foi encerrado.', null, { type: 'warning' });
            return;
        }
        const sorteioRealizado = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
        const ligaAberta = window._isLigaFormat(t) && t.ligaOpenEnrollment !== false && sorteioRealizado;
        const inscricoesAbertas = (t.status !== 'closed' && !sorteioRealizado) || ligaAberta;
        if (!inscricoesAbertas) {
            showAlertDialog('Inscrições Encerradas', 'As inscrições para este torneio estão encerradas.', null, { type: 'warning' });
            return;
        }
        if (t.enrollmentMode === 'time' && (t.teamSize || 2) > 1) {
            const mod = document.getElementById('team-enroll-modal-' + tId);
            if (mod) mod.style.display = 'flex';
            return;
        }

        // Check if tournament has categories — resolve before enrolling
        var hasCats = (t.combinedCategories && t.combinedCategories.length > 0) ||
                      (t.genderCategories && t.genderCategories.length > 0) ||
                      (t.skillCategories && t.skillCategories.length > 0);
        if (hasCats) {
            window._resolveEnrollmentCategory(tId, function(selectedCategories) {
                if (!selectedCategories) return; // user cancelled
                window._doEnrollCurrentUser(tId, selectedCategories);
            });
            return;
        }

        // No categories — enroll directly
        window._doEnrollCurrentUser(tId, null);
    }
};

// Internal: performs actual enrollment with optional category
window._doEnrollCurrentUser = function(tId, selectedCategories) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    const user = window.AppStore.currentUser;
    if (!t || !user) return;

    // Normalize selectedCategories: accept string, array, or null
    var catsArr = null;
    if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
        catsArr = selectedCategories;
    } else if (typeof selectedCategories === 'string' && selectedCategories) {
        catsArr = [selectedCategories];
    }

    // Use atomic Firestore transaction to prevent race conditions
    const participantObj = { name: user.displayName, email: user.email, displayName: user.displayName };
    if (user.gender) participantObj.gender = user.gender;
    if (catsArr) {
        participantObj.categories = catsArr;
        participantObj.category = catsArr[0]; // backward compat
        participantObj.categorySource = 'inscricao';
    }
    // Feature gate: limite de participantes no plano Free (organizador do torneio)
    if (window.AppStore.isOrganizer(t) && !window._canAddParticipant(t)) {
        window._showUpgradeModal('participants');
        return;
    }
    if (window.FirestoreDB && window.FirestoreDB.enrollParticipant) {
        window.FirestoreDB.enrollParticipant(tId, participantObj).then(function(result) {
            if (result.alreadyEnrolled) {
                if (typeof showNotification !== 'undefined') showNotification('Já Inscrito', 'Você já está inscrito neste torneio.', 'info');
                window._scrollToParticipant(tId, user.displayName);
                return;
            }
            // Update local state from transaction result
            t.participants = result.participants;
            if (result.autoCloseTriggered) {
                t.status = 'closed';
                if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', '"' + window._safeHtml(t.name) + '" atingiu ' + t.maxParticipants + ' inscritos e foi encerrado automaticamente.', 'success');
            }
            if (typeof showNotification !== 'undefined') showNotification('✅ Inscrito!', 'Você foi inscrito com sucesso no torneio "' + window._safeHtml(t.name) + '".', 'success');

            // Notify organizer about new enrollment
            if (t.organizerEmail && t.organizerEmail !== user.email && window.FirestoreDB && window.FirestoreDB.db) {
                window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                    if (!snap.empty) {
                        window._sendUserNotification(snap.docs[0].id, {
                            type: 'enrollment_new',
                            message: (user.displayName || 'Um participante') + ' se inscreveu no torneio "' + window._safeHtml(t.name) + '".',
                            tournamentId: String(t.id),
                            tournamentName: t.name || '',
                            level: 'all'
                        });
                    }
                }).catch(function(e) { console.warn('Notify organizer error:', e); });
            }

            // Notify the enrolled user (confirmation)
            if (user.uid || user.email) {
                window._sendUserNotification(user.uid || user.email, {
                    type: 'enrollment_confirmed',
                    message: 'Inscrição confirmada no torneio "' + window._safeHtml(t.name) + '"!',
                    tournamentId: String(t.id),
                    tournamentName: t.name || '',
                    level: 'fundamental'
                });
            }

            // Auto-amizade: via ref no link OU com o organizador do torneio
            try {
                var _refUid = null;
                var _h = window.location.hash || '';
                var _rm2 = _h.match(/[?&]ref=([^&]+)/);
                if (_rm2) _refUid = decodeURIComponent(_rm2[1]);
                if (!_refUid) _refUid = sessionStorage.getItem('_inviteRefUid');
                if (!_refUid && t.organizerEmail && window.FirestoreDB && window.FirestoreDB.db) {
                    window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                        if (!snap.empty) {
                            var orgUid = snap.docs[0].id;
                            if (typeof _autoFriendOnInvite === 'function') {
                                _autoFriendOnInvite(orgUid, window.AppStore.currentUser);
                            }
                        }
                    }).catch(function(e2) { console.warn('Auto-friend org lookup error:', e2); });
                } else if (_refUid && typeof _autoFriendOnInvite === 'function') {
                    _autoFriendOnInvite(_refUid, user);
                    try { sessionStorage.removeItem('_inviteRefUid'); } catch(e2) {}
                }
            } catch(e) { console.warn('Auto-friend error:', e); }

            // Navigate to tournament detail and scroll to the enrolled participant
            window._scrollToParticipant(tId, user.displayName);
        }).catch(function(err) {
            console.warn('Enroll transaction error:', err);
            if (typeof showNotification !== 'undefined') showNotification('Erro', 'Não foi possível completar a inscrição. Tente novamente.', 'error');
        });
    }
};

window.submitTeamEnroll = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    const user = window.AppStore.currentUser;
    if (!t || !user) return;

    // Verifica se as inscrições estão realmente abertas
    if (t.status === 'finished') {
        showAlertDialog('Torneio Encerrado', 'Este torneio já foi encerrado.', null, { type: 'warning' });
        return;
    }
    const sorteioRealizado = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
    const ligaAberta = window._isLigaFormat(t) && t.ligaOpenEnrollment !== false && sorteioRealizado;
    const inscricoesAbertas = (t.status !== 'closed' && !sorteioRealizado) || ligaAberta;
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
    const participantObj = { name: teamString, email: user.email, displayName: teamString };
    // Registrar origem da equipe via extraUpdates
    var _teamOrigins = t.teamOrigins || {};
    _teamOrigins[teamString] = 'inscrita';

    const mod = document.getElementById('team-enroll-modal-' + tId);
    if (mod) mod.style.display = 'none';

    // Use atomic Firestore transaction to prevent race conditions
    if (window.FirestoreDB && window.FirestoreDB.enrollParticipant) {
        window.FirestoreDB.enrollParticipant(tId, participantObj, { teamOrigins: _teamOrigins }).then(function(result) {
            if (result.alreadyEnrolled) {
                if (typeof showNotification !== 'undefined') showNotification('Já Inscrito', 'Você já está inscrito neste torneio.', 'info');
                window._scrollToParticipant(tId, user.displayName);
                return;
            }
            t.participants = result.participants;
            t.teamOrigins = _teamOrigins;
            if (result.autoCloseTriggered) {
                t.status = 'closed';
                if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', '"' + window._safeHtml(t.name) + '" atingiu ' + t.maxParticipants + ' inscritos e foi encerrado automaticamente.', 'success');
            }
            if (typeof showNotification !== 'undefined') showNotification('✅ Inscrito!', 'Equipe inscrita com sucesso no torneio "' + window._safeHtml(t.name) + '".', 'success');

            // Notify organizer about new team enrollment
            if (t.organizerEmail && t.organizerEmail !== user.email && window.FirestoreDB && window.FirestoreDB.db) {
                window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                    if (!snap.empty) {
                        window._sendUserNotification(snap.docs[0].id, {
                            type: 'enrollment_new',
                            message: 'Equipe "' + window._safeHtml(teamString) + '" se inscreveu no torneio "' + window._safeHtml(t.name) + '".',
                            tournamentId: String(t.id),
                            tournamentName: t.name || '',
                            level: 'all'
                        });
                    }
                }).catch(function(e) { console.warn('Notify organizer error:', e); });
            }

            // Notify the enrolled user (confirmation)
            if (user.uid || user.email) {
                window._sendUserNotification(user.uid || user.email, {
                    type: 'enrollment_confirmed',
                    message: 'Sua equipe foi inscrita no torneio "' + window._safeHtml(t.name) + '"!',
                    tournamentId: String(t.id),
                    tournamentName: t.name || '',
                    level: 'fundamental'
                });
            }

            // Auto-amizade: com quem convidou (ref) ou com o organizador
            try {
                var _refUid3 = null;
                var _h3 = window.location.hash || '';
                var _rm3 = _h3.match(/[?&]ref=([^&]+)/);
                if (_rm3) _refUid3 = decodeURIComponent(_rm3[1]);
                if (!_refUid3) _refUid3 = sessionStorage.getItem('_inviteRefUid');
                if (!_refUid3 && t.organizerEmail && window.FirestoreDB && window.FirestoreDB.db) {
                    window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                        if (!snap.empty) {
                            if (typeof _autoFriendOnInvite === 'function') {
                                _autoFriendOnInvite(snap.docs[0].id, window.AppStore.currentUser);
                            }
                        }
                    }).catch(function(e2) { console.warn('Auto-friend org lookup error:', e2); });
                } else if (_refUid3 && typeof _autoFriendOnInvite === 'function') {
                    _autoFriendOnInvite(_refUid3, user);
                    try { sessionStorage.removeItem('_inviteRefUid'); } catch(e2) {}
                }
            } catch(e) { console.warn('Auto-friend error:', e); }

            // Navigate to tournament detail and scroll to the enrolled team
            window._scrollToParticipant(tId, teamString);
        }).catch(function(err) {
            console.warn('Team enroll transaction error:', err);
            if (typeof showNotification !== 'undefined') showNotification('Erro', 'Não foi possível completar a inscrição. Tente novamente.', 'error');
        });
    }
};

window.deenrollCurrentUser = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    const user = window.AppStore.currentUser;
    if (!user) return;
    if (t && t.participants) {
        showConfirmDialog(
            'Cancelar Inscrição',
            'Deseja realmente cancelar sua inscrição neste torneio?',
            () => {
                let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
                arr = arr.filter(p => {
                    if (typeof p === 'string') {
                        return p !== user.email && p !== user.displayName;
                    }
                    var pEmail = p.email || '';
                    var pName = p.displayName || p.name || '';
                    return !(pEmail === user.email || (pName && pName === user.displayName));
                });
                t.participants = arr;
                // Save directly to Firestore
                if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                    window.FirestoreDB.saveTournament(t).catch(function(err) { console.warn('Deenroll save error:', err); });
                }

                // Notify organizer about unenrollment
                if (t.organizerEmail && t.organizerEmail !== user.email && window.FirestoreDB && window.FirestoreDB.db) {
                    window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                        if (!snap.empty) {
                            window._sendUserNotification(snap.docs[0].id, {
                                type: 'enrollment_cancelled',
                                message: (user.displayName || 'Um participante') + ' cancelou a inscrição no torneio "' + window._safeHtml(t.name) + '".',
                                tournamentId: String(t.id),
                                tournamentName: t.name || '',
                                level: 'important'
                            });
                        }
                    }).catch(function(e) { console.warn('Notify organizer unenroll error:', e); });
                }

                // Notify the user (confirmation of unenrollment)
                if (user.uid || user.email) {
                    window._sendUserNotification(user.uid || user.email, {
                        type: 'enrollment_cancelled_confirm',
                        message: 'Sua inscrição no torneio "' + window._safeHtml(t.name) + '" foi cancelada.',
                        tournamentId: String(t.id),
                        tournamentName: t.name || '',
                        level: 'fundamental'
                    });
                }

                if (typeof showNotification !== 'undefined') showNotification('Inscrição Cancelada', 'Sua inscrição foi removida do torneio "' + window._safeHtml(t.name) + '".', 'info');

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
                if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', `"${window._safeHtml(t.name)}" atingiu ${t.maxParticipants} inscritos e foi encerrado automaticamente.`, 'success');
            }
            const container = document.getElementById('view-container');
            if (container && typeof renderTournaments === 'function') renderTournaments(container, window.location.hash.split('/')[1]);
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
                if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', `"${window._safeHtml(t.name)}" atingiu ${t.maxParticipants} inscritos e foi encerrado automaticamente.`, 'success');
            }
            const container = document.getElementById('view-container');
            if (container && typeof renderTournaments === 'function') renderTournaments(container, window.location.hash.split('/')[1]);
        },
        { itemLabel: 'Integrante' }
    );
};

window.deleteTournamentFunction = function (tId) {
    // Only the original creator can delete
    var _t = (window.AppStore.tournaments || []).find(function(x) { return String(x.id) === String(tId); });
    if (_t && !window.AppStore.isCreator(_t)) {
      showAlertDialog('Sem Permissao', 'Apenas o criador original pode apagar o torneio.', null, { type: 'warning' });
      return;
    }
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
                        // Tournament deleted from Firestore
                        // Após confirmação do Firestore, remove da lista de deletados (já foi removido de verdade)
                        var delIdx = window.AppStore._deletedTournamentIds.indexOf(String(tId));
                        if (delIdx !== -1) window.AppStore._deletedTournamentIds.splice(delIdx, 1);
                        try { localStorage.setItem('scoreplace_deleted_ids', JSON.stringify(window.AppStore._deletedTournamentIds)); } catch(e) {}
                    }).catch(function(err) {
                        console.error('Erro ao deletar torneio do Firestore:', err);
                        showNotification('Erro ao Apagar', 'Não foi possível apagar do servidor. Tente novamente mais tarde.', 'error');
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

})();
