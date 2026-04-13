// Dynamically update stat-boxes after participant/waitlist changes
window._updateStatBoxes = function(t) {
    var row = document.getElementById('stat-boxes-row');
    if (!row || !t) return;

    // Recount individuals
    var parts = Array.isArray(t.participants) ? t.participants : [];
    var indivCount = 0;
    parts.forEach(function(p) {
        if (typeof p === 'object' && Array.isArray(p.participants)) {
            indivCount += p.participants.length;
        } else if (typeof p === 'string' && p.indexOf('/') !== -1) {
            indivCount += p.split('/').filter(function(n) { return n.trim().length > 0; }).length;
        } else {
            indivCount++;
        }
    });
    if (Array.isArray(t.waitlist)) indivCount += t.waitlist.length;

    // Update inscritos count
    var inscBox = row.querySelector('[data-stat="inscritos"] .stat-value');
    if (inscBox) inscBox.textContent = indivCount;

    // Waitlist count
    var wlCount = (Array.isArray(t.standbyParticipants) ? t.standbyParticipants.length : 0)
        + (Array.isArray(t.waitlist) ? t.waitlist.length : 0);

    var wlBox = row.querySelector('[data-stat="waitlist"]');
    if (wlCount > 0 && !wlBox) {
        // Insert waitlist stat-box
        var div = document.createElement('div');
        div.className = 'stat-box';
        div.setAttribute('data-stat', 'waitlist');
        div.style.cssText = 'background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3);';
        div.innerHTML =
            '<span style="font-size: 1.1rem; margin-right: 4px;">⏳</span>' +
            '<span class="stat-value" style="font-size: 1.4rem; font-weight: 800; line-height: 1; color: #fbbf24;">' + wlCount + '</span>' +
            '<span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; color: #fbbf24; opacity: 0.9;">Lista de Espera</span>';
        row.appendChild(div);
    } else if (wlCount > 0 && wlBox) {
        var wlVal = wlBox.querySelector('.stat-value');
        if (wlVal) wlVal.textContent = wlCount;
    } else if (wlCount === 0 && wlBox) {
        wlBox.remove();
    }
};

function renderTournaments(container, tournamentId = null) {
    if (!window.AppStore) return;
    // Clear one-time check flags for OTHER tournaments (keep current)
    if (tournamentId) {
        var _curKey = '_tournChecks_' + tournamentId;
        Object.keys(window).forEach(function(k) {
            if (k.indexOf('_tournChecks_') === 0 && k !== _curKey) delete window[k];
        });
    }
    var _t = window._t || function(k) { return k; };
    let visible = window.AppStore.getVisibleTournaments() || [];

    window._handleSortearClick = function (tId, isAberto) {
        window._lastActiveTournamentId = tId;
        var _startDraw = function() {
            if (typeof window.showUnifiedResolutionPanel === 'function') {
                window.showUnifiedResolutionPanel(tId);
            } else if (typeof window.showFinalReviewPanel === 'function') {
                window.showFinalReviewPanel(tId);
            }
        };
        if (isAberto) {
            showConfirmDialog(
                _t('org.closeRegConfirmTitle'),
                _t('org.closeRegConfirmMsg'),
                () => {
                    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
                    if (t) {
                        t.status = 'closed';
                        if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
                            window.FirestoreDB.saveTournament(t).then(function() {
                                _startDraw();
                            }).catch(function() {
                                window.AppStore.sync();
                                _startDraw();
                            });
                        } else {
                            window.AppStore.sync();
                            _startDraw();
                        }
                    }
                },
                null,
                { type: 'warning', confirmText: 'Encerrar e Sortear', cancelText: 'Manter Aberto' }
            );
        } else {
            _startDraw();
        }
    };

    if (!window.inviteModalSetupDone) {
        window.openInviteModal = function (id) {
            const mod = document.getElementById('invite-modal-' + id);
            if (mod) {
                mod.style.display = 'flex';
                // Force scroll to top of modal overlay and inner content
                requestAnimationFrame(function() {
                    mod.scrollTop = 0;
                    var children = mod.children;
                    for (var i = 0; i < children.length; i++) children[i].scrollTop = 0;
                });
            }
        };
        window.closeInviteModal = function (id) {
            const mod = document.getElementById('invite-modal-' + id);
            if (mod) mod.style.display = 'none';
        };

        // Convidar todos os amigos para o torneio (via notificação na plataforma)
        window._inviteFriendsToTournament = async function(tournamentId, inviteTextSafe) {
            var cu = window.AppStore.currentUser;
            if (!cu) return;
            if (!cu.friends || cu.friends.length === 0) {
                if (typeof showNotification === 'function') {
                    showNotification('Sem amigos ainda', 'Você ainda não tem amigos na plataforma. Convide usando QR Code, WhatsApp ou link abaixo.', 'info');
                }
                return;
            }
            var myUid = cu.uid || cu.email;
            var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
            if (!t) return;

            var btn = document.getElementById('invite-friends-btn-' + tournamentId);
            var statusDiv = document.getElementById('invite-friends-status-' + tournamentId);
            if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Enviando...'; }

            var inviteUrl = window._tournamentUrl(t.id) + '?ref=' + encodeURIComponent(myUid);
            var sent = 0;
            var whatsappNumbers = [];
            var emailRecipients = [];

            for (var i = 0; i < cu.friends.length; i++) {
                var friendUid = cu.friends[i];
                try {
                    var profile = await window.FirestoreDB.loadUserProfile(friendUid);
                    if (!profile) continue;

                    // Check if already enrolled
                    var parts = Array.isArray(t.participants) ? t.participants : [];
                    var alreadyIn = parts.some(function(p) {
                        var str = typeof p === 'string' ? p : (p.email || p.displayName || '');
                        return str && profile.email && str === profile.email;
                    });
                    if (alreadyIn) continue;

                    // Send platform notification (always)
                    if (profile.notifyPlatform !== false) {
                        await window.FirestoreDB.addNotification(friendUid, {
                            type: 'tournament_invite',
                            fromUid: myUid,
                            fromName: cu.displayName || '',
                            fromPhoto: cu.photoURL || '',
                            tournamentId: String(t.id),
                            tournamentName: t.name || '',
                            message: (cu.displayName || 'Um amigo') + ' convidou você para o torneio "' + window._safeHtml(t.name || '') + '"!',
                            inviteUrl: inviteUrl,
                            createdAt: new Date().toISOString(),
                            read: false
                        });
                        sent++;
                    }

                    // Collect WhatsApp numbers for bulk share
                    if (profile.notifyWhatsApp !== false && profile.phone) {
                        var countryCode = profile.phoneCountry || '55';
                        var phoneDigits = (profile.phone || '').replace(/\D/g, '');
                        if (phoneDigits) whatsappNumbers.push(countryCode + phoneDigits);
                    }

                    // Collect emails for notification
                    if (profile.notifyEmail !== false && profile.email) {
                        emailRecipients.push(profile.email);
                    }
                } catch(e) {
                    console.warn('Error inviting friend', friendUid, e);
                }
            }

            // Update UI
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '👥 Convites Enviados!'; }
            var statusParts = [];
            if (sent > 0) statusParts.push(sent + ' convite' + (sent !== 1 ? 's' : '') + ' na plataforma');
            if (emailRecipients.length > 0) statusParts.push(emailRecipients.length + ' por e-mail');
            if (whatsappNumbers.length > 0) statusParts.push(whatsappNumbers.length + ' por WhatsApp');
            var statusMsg = statusParts.length > 0 ? statusParts.join(', ') + '.' : 'Nenhum convite enviado.';
            if (statusDiv) statusDiv.textContent = statusMsg;
            if (typeof showNotification !== 'undefined') {
                showNotification('Convites Enviados!', statusMsg, 'success');
            }

            // Open email with all recipients (bcc for privacy)
            if (emailRecipients.length > 0) {
                var emailSubject = encodeURIComponent('🏆 Convite para torneio: ' + t.name);
                var emailBody = encodeURIComponent('Olá!\n\nVocê foi convidado para o torneio "' + t.name + '" no scoreplace.app.\n\nAcesse o link abaixo para se inscrever:\n' + inviteUrl + '\n\nBoas partidas! 🎾');
                window.open('mailto:?bcc=' + emailRecipients.join(',') + '&subject=' + emailSubject + '&body=' + emailBody, '_self');
            }

            // Open WhatsApp with invite message
            if (whatsappNumbers.length > 0) {
                var inviteMsg = '🏆 Torneio: ' + t.name + '\nAcesse o link abaixo para se inscrever:\n' + inviteUrl;
                window.open(window._whatsappShareUrl(inviteMsg), '_blank');
            }
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
                    t.participants = Object.values(t.participants);
                }
                const currentCount = t.participants.length;
                for (let i = 1; i <= qtd; i++) {
                    const numStr = String(currentCount + i).padStart(2, '0');
                    t.participants.push({
                        name: 'Bot ' + numStr,
                        displayName: 'Bot ' + numStr,
                        email: 'bot' + numStr + '@scoreplace.app',
                        uid: 'bot_' + numStr + '_' + Date.now(),
                        isBot: true
                    });
                }
                // Save directly to Firestore (sync() skips participants)
                if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
                    window.FirestoreDB.saveTournament(t).then(function() {
                        showNotification('Bots adicionados', qtd + ' bots adicionados ao torneio.', 'success');
                    }).catch(function(err) {
                        console.error('Erro ao salvar bots:', err);
                        showNotification('Erro', 'Falha ao salvar bots no servidor.', 'error');
                    });
                }

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
        window.removeParticipantFunction = function (tId, participantName) {
            showConfirmDialog(
                'Remover Participante',
                'Deseja realmente remover este participante?',
                () => {
                    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
                    if (t && t.participants) {
                        let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
                        var idx = arr.findIndex(function(p) {
                            var name = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
                            return name === participantName;
                        });
                        if (idx === -1) return;
                        arr.splice(idx, 1);
                        t.participants = arr;

                        if (typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.saveTournament) {
                            window.FirestoreDB.saveTournament(t);
                        } else if (typeof window.AppStore.sync === 'function') {
                            window.AppStore.sync();
                        }

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
        window.splitParticipantFunction = function (tId, participantName) {
            showConfirmDialog(
                'Desfazer Equipe',
                'Deseja desfazer esta equipe e retornar os jogadores como individuais?',
                () => {
                    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
                    if (t && t.participants) {
                        let arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
                        var idx = arr.findIndex(function(p) {
                            var name = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
                            return name === participantName;
                        });
                        if (idx === -1) return;
                        const p = arr[idx];
                        const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');

                        if (pStr.includes('/')) {
                            const parts = pStr.split('/').map(s => s.trim());
                            arr.splice(idx, 1);
                            arr.splice(idx, 0, ...parts);
                            t.participants = arr;

                            if (typeof window.FirestoreDB !== 'undefined' && window.FirestoreDB.saveTournament) {
                                window.FirestoreDB.saveTournament(t);
                            } else if (typeof window.AppStore.sync === 'function') {
                                window.AppStore.sync();
                            }

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

    // ─── Invite fallback card — shown when tournament can't be loaded yet ─────
    window._renderInviteFallbackCard = function(container, tId) {
        // Show loading message for all users (logged in or visitor)
        container.innerHTML = '<div style="max-width:500px;width:100%;margin:2rem auto;text-align:center;padding:2rem;box-sizing:border-box;">' +
            '<div style="font-size:3rem;margin-bottom:1rem;">\u{1F3C6}</div>' +
            '<h2 style="color:var(--text-bright);margin-bottom:0.5rem;">Carregando torneio...</h2>' +
            '<p style="color:var(--text-muted);margin-bottom:1.5rem;">Aguarde enquanto carregamos os dados do torneio.</p>' +
            '<button class="btn hover-lift" onclick="window.location.hash=\'#dashboard\'" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);font-weight:600;font-size:0.9rem;padding:10px 24px;border-radius:10px;">Voltar ao In\u00EDcio</button></div>';
    };

    // ========== Categories: moved to tournaments-categories.js ==========

    if (!window.enrollDeenrollSetupDone) {
        // ========== Enrollment: moved to tournaments-enrollment.js ==========
        // All functions below are now defined in tournaments-enrollment.js
        // They are loaded via a separate <script> tag in index.html

        window.enrollDeenrollSetupDone = true;
    }

    // [v0.4.3] Removed ~435 lines of dead code (old enrollment/delete functions
    // moved to tournaments-enrollment.js in v0.4.2). See git history if needed.

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
                    // Tournament deleted or doesn't exist — go to dashboard
                    if (typeof showNotification === 'function') {
                        showNotification(_t('tournament.notFound'), '', 'warning');
                    }
                    window.location.hash = '#dashboard';
                }
            }).catch(function(err) {
                console.warn('Error loading tournament:', err);
                // Firestore read failed (permissions or network) — show invite card
                window._renderInviteFallbackCard(container, tournamentId);
            });
            return;
        }
    }

    // Fallback card for non-logged users or when Firestore can't load the tournament
    // Shows tournament name if available, and a single "Inscrever-se" button that handles everything
    if (tournamentId && visible.length === 0) {
        window._renderInviteFallbackCard(container, tournamentId);
        return;
    }

    const cleanSportName = (sport) => sport ? sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
    const getSportIcon = (sport) => {
        if (!sport) return '🏆';
        const s = sport.toLowerCase();
        if (s.includes('tênis de mesa') || s.includes('tenis de mesa') || s.includes('ping pong')) return '🏓';
        if (s.includes('padel')) return '🏸';
        if (s.includes('pickleball')) return '🥒';
        if (s.includes('tênis') || s.includes('tennis') || s.includes('beach')) return '🎾';
        return '🏆';
    };

    const renderTournamentCard = (t, isOrg) => {
        const publicText = t.isPublic ? _t('tournament.public') : _t('tournament.private');

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
        const cats = (t.combinedCategories && t.combinedCategories.length) ? window._sortCategoriesBySkillOrder(t.combinedCategories, t.skillCategories).join(', ') : ((t.categories && t.categories.length) ? t.categories.join(', ') : 'Cat. Única');

        // Liga season auto-closure: se a temporada expirou, encerra automaticamente
        if (window._isLigaFormat(t) && t.status !== 'finished') {
          const _seasonMonths = t.ligaSeasonMonths || t.rankingSeasonMonths;
          if (_seasonMonths && t.startDate) {
            const _seasonStart = new Date(t.startDate);
            if (!isNaN(_seasonStart.getTime())) {
              const _seasonEnd = new Date(_seasonStart);
              _seasonEnd.setMonth(_seasonEnd.getMonth() + parseInt(_seasonMonths));
              if (new Date() >= _seasonEnd) {
                // Temporada expirou — marcar como finished
                t.status = 'finished';
                // Computar standings finais se necessário
                if (!t.standings || !t.standings.length) {
                  if (typeof window._computeStandings === 'function') {
                    var _cats = (t.combinedCategories && t.combinedCategories.length) ? t.combinedCategories : ['default'];
                    for (var _ci = 0; _ci < _cats.length; _ci++) {
                      var _st = window._computeStandings(t, _cats[_ci]);
                      if (_st && _st.length) { t.standings = _st; break; }
                    }
                  }
                }
                // Salvar no Firestore
                if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
                  window.FirestoreDB.saveTournament(t).catch(function() {});
                }
              }
            }
          }
        }

        // Inscrições fecham após sorteio (status 'active'), exceto Liga/Ranking com inscrições abertas na temporada
        const isFinished = t.status === 'finished';
        const sorteioRealizado = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
        const ligaAberta = window._isLigaFormat(t) && t.ligaOpenEnrollment !== false && sorteioRealizado;
        const isAberto = (!isFinished && t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date())) || ligaAberta;

        // Auto-close: if deadline passed but status hasn't been updated yet, close it now
        if (!isAberto && !isFinished && !sorteioRealizado && t.status !== 'closed' && t.registrationLimit && new Date(t.registrationLimit) < new Date()) {
          t.status = 'closed';
          if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
            window.FirestoreDB.saveTournament({ id: t.id, status: 'closed' }).catch(function() {});
          }
        }

        const statusText = isFinished ? '🏆 ' + _t('status.finished') : (ligaAberta ? _t('tournament.leagueOpenEnroll') : (isAberto ? _t('status.open') : (sorteioRealizado ? _t('status.active') : _t('status.closed'))));
        const statusBg = isFinished ? 'rgba(251,191,36,0.15)' : (isAberto || ligaAberta ? '#fbbf24' : (sorteioRealizado ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)'));
        const statusColor = isFinished ? '#fbbf24' : (isAberto || ligaAberta ? '#78350f' : (sorteioRealizado ? '#34d399' : '#fca5a5'));
        const statusFontWeight = isAberto ? '700' : '600';

        let enrollmentText = _t('enroll.modeMixed');
        if (t.enrollmentMode === 'individual') enrollmentText = _t('enroll.modeIndividual');
        else if (t.enrollmentMode === 'time') enrollmentText = _t('enroll.modeTeam');
        else if (t.enrollmentMode === 'misto') enrollmentText = _t('enroll.modeMixed');

        const sortearOnClick = `event.stopPropagation(); window._handleSortearClick('${t.id}', ${isAberto})`;

        let isParticipating = false;
        if (t.participants && window.AppStore.currentUser) {
            const user = window.AppStore.currentUser;
            const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
            if (arr.length > 0) {
                isParticipating = arr.some(p => {
                    if (typeof p === 'string') {
                        // Exact match only — skip team strings (contain " / ")
                        if (p.indexOf(' / ') !== -1) return false;
                        return p === user.email || p === user.displayName;
                    }
                    // For objects: prioritize uid match, then exact email, then exact displayName
                    if (p.uid && user.uid && p.uid === user.uid) return true;
                    if (p.email && p.email === user.email) return true;
                    if (p.displayName && p.displayName === user.displayName) return true;
                    return false;
                });
            }
        }

        // Card gradients adaptam ao tema — consistentes com dashboard.js
        var _theme = (document.documentElement.getAttribute('data-theme') || 'dark');
        var _isLight = (_theme === 'light');
        let bgGradient;
        if (_isLight) {
            bgGradient = 'linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)';
            if (isParticipating) bgGradient = 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)';
            else if (isOrg) bgGradient = 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)';
        } else if (_theme === 'sunset') {
            bgGradient = 'linear-gradient(135deg, #2d1f1b 0%, #1a1210 100%)';
            if (isParticipating) bgGradient = 'linear-gradient(135deg, #713f12 0%, #a16207 100%)';
            else if (isOrg) bgGradient = 'linear-gradient(135deg, #92400e 0%, #d97706 100%)';
        } else if (_theme === 'ocean') {
            bgGradient = 'linear-gradient(135deg, #1c3d5e 0%, #173352 100%)';
            if (isParticipating) bgGradient = 'linear-gradient(135deg, #155e75 0%, #0891b2 100%)';
            else if (isOrg) bgGradient = 'linear-gradient(135deg, #245478 0%, #0e7490 100%)';
        } else {
            bgGradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
            if (isParticipating) bgGradient = 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)';
            else if (isOrg) bgGradient = 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)';
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
            const arr = typeof window._getCompetitors === 'function' ? window._getCompetitors(t) : (Array.isArray(t.participants) ? t.participants : Object.values(t.participants));
            arr.forEach(p => {
                if (typeof p === 'object' && p !== null && Array.isArray(p.participants)) {
                    teamCount++;
                    individualCount += p.participants.length;
                } else {
                    const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
                    if (pStr.includes('/')) {
                        teamCount++;
                        individualCount += pStr.split('/').filter(n => n.trim().length > 0).length;
                    } else {
                        individualCount++;
                    }
                }
            });
        }
        // Include waitlist in total individual count
        if (Array.isArray(t.waitlist)) {
            individualCount += t.waitlist.length;
        }
        const standbyCount = (Array.isArray(t.standbyParticipants) ? t.standbyParticipants.length : 0)
            + (Array.isArray(t.waitlist) ? t.waitlist.length : 0);

        const expectedTeammates = Math.max(0, (t.teamSize || 2) - 1);
        const teamEnrollModalHtml = `
         <div id="team-enroll-modal-${t.id}" class="team-enroll-modal-container" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 10000; align-items: flex-start; justify-content: center; cursor: default; overflow-y: auto; padding: 2rem 0;" onclick="event.stopPropagation()">
            <div style="background: var(--bg-card); width: 90%; max-width: 450px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.4); margin: auto; animation: fadeIn 0.2s ease;">
               
               <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                  <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-bright);">👥 ${_t('enroll.team')}</h3>
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
                        <button type="button" class="btn btn-outline hover-lift" onclick="event.stopPropagation(); document.getElementById('team-enroll-modal-${t.id}').style.display='none'">${_t('btn.cancel')}</button>
                        <button type="submit" class="btn btn-success hover-lift">${_t('enroll.teamConfirm')}</button>
                     </div>
                  </form>
               </div>
            </div>
         </div>
      `;

        // Botão inscrever/desinscrever — disponível em todos os contextos (detalhe e listagem)
        const enrollBtnHtml = (isParticipating && isAberto) ? `
             <button class="btn btn-sm btn-danger hover-lift" onclick="event.stopPropagation(); window.deenrollCurrentUser('${t.id}')">🛑 ${_t('enroll.unenrollBtn')}</button>
          ` : (isAberto ? `
             <button class="btn btn-sm btn-success hover-lift" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')">✅ ${_t('enroll.enrollBtn')}</button>
          ` : (isParticipating ? `
             <div style="font-size: 0.65rem; font-weight: 700; color: #fef08a; text-transform: uppercase; letter-spacing: 0.5px;">${_t('enroll.enrolled')} ✓</div>
          ` : ''));

        // Liga active toggle: participants can opt out of upcoming rounds
        let ligaActiveToggleHtml = '';
        if (isParticipating && window._isLigaFormat(t) && t.status === 'active') {
          const _myPart = (() => {
            const user = window.AppStore.currentUser;
            if (!user || !t.participants) return null;
            const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
            return arr.find(p => {
              if (typeof p !== 'object') return false;
              if (p.uid && user.uid && p.uid === user.uid) return true;
              if (p.email && p.email === user.email) return true;
              return false;
            });
          })();
          const _ligaIsActive = _myPart ? (_myPart.ligaActive !== false) : true;
          ligaActiveToggleHtml = `
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:6px 10px;background:${_ligaIsActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${_ligaIsActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'};border-radius:8px;">
              <label class="toggle-switch" style="flex-shrink:0;">
                <input type="checkbox" ${_ligaIsActive ? 'checked' : ''} onchange="window._toggleLigaActive('${String(t.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', this.checked)">
                <span class="toggle-slider"></span>
              </label>
              <span style="font-size:0.75rem;font-weight:600;color:${_ligaIsActive ? '#34d399' : '#f87171'};">${_ligaIsActive ? '🟢 Participando dos sorteios' : '🔴 Fora dos próximos sorteios'}</span>
            </div>
          `;
        }

        // Ações Específicas da tela Explore
        let actionsHtml = '';
        const hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);

        // --- Variáveis de botões do organizador (escopo global do card para evitar ReferenceError) ---
        const allowsIndividual = !t.enrollmentMode || t.enrollmentMode === 'individual' || t.enrollmentMode === 'misto';
        const allowsTeams = t.enrollmentMode === 'time' || t.enrollmentMode === 'misto';
        const addParticipantBtns = (!hasDraw && isOrg) ? `
             ${allowsIndividual ? `<button class="btn btn-cyan hover-lift" onclick="event.stopPropagation(); window.addParticipantFunction('${t.id}')">👤 + Participante</button>` : ''}
             ${allowsTeams ? `<button class="btn btn-purple hover-lift" onclick="event.stopPropagation(); window.addTeamFunction('${t.id}')">👥 + Time</button>` : ''}
        ` : '';

        const _hasTournCats = (t.combinedCategories && t.combinedCategories.length > 0) || (t.genderCategories && t.genderCategories.length > 0) || (t.skillCategories && t.skillCategories.length > 0);
        const categoriasBtn = (_hasTournCats && isOrg) ? `<button class="btn btn-indigo hover-lift" onclick="event.stopPropagation(); window._openCategoryManager('${t.id}')">🏷️ Categorias</button>` : '';

        const isSuicoFormat = t.format === 'Suíço Clássico';
        const isLigaFormat = window._isLigaFormat(t);
        const isLigaOpenEnroll = isLigaFormat && t.ligaOpenEnrollment !== false;
        const toggleRegBtn = (!hasDraw && !isLigaOpenEnroll && isOrg) ? `<button class="btn ${t.status === 'closed' ? 'btn-success' : 'btn-danger'} hover-lift" onclick="event.stopPropagation(); window.toggleRegistrationStatus('${t.id}')">${t.status === 'closed' ? '✅ ' + _t('org.reopenRegistration') : '🛑 ' + _t('org.closeRegistration')}</button>` : '';

        const isAutoDrawFormat = isSuicoFormat || (isLigaFormat && !t.drawManual && t.drawFirstDate);
        let sortearBtn = '';
        let sortearAberto = '';
        if (isOrg) {
            if (isLigaFormat && !t.drawManual && t.drawFirstDate) {
                if (t.drawManual && !hasDraw) {
                    sortearAberto = `<button class="btn btn-warning hover-lift" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">🎲 Sortear Rodada</button>`;
                } else if (t.drawManual && hasDraw) {
                    sortearBtn = `<button class="btn btn-warning hover-lift" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">🎲 Próxima Rodada</button>`;
                }
            } else if (isLigaFormat && t.drawManual) {
                sortearBtn = (t.status === 'closed' && !hasDraw) ? `<button class="btn btn-warning hover-lift" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">🎲 Sortear</button>` : '';
                sortearAberto = (t.status !== 'closed' && !hasDraw) ? `<button class="btn btn-warning hover-lift" onclick="${sortearOnClick}">🎲 Sortear</button>` : '';
                if (hasDraw) {
                    sortearBtn = `<button class="btn btn-warning hover-lift" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">🎲 Próxima Rodada</button>`;
                }
            } else {
                sortearBtn = (t.status === 'closed' && !hasDraw) ? `<button class="btn btn-warning hover-lift" onclick="event.stopPropagation(); window.generateDrawFunction('${t.id}')">🎲 Sortear</button>` : '';
                sortearAberto = (t.status !== 'closed' && !hasDraw) ? `<button class="btn btn-warning hover-lift" onclick="${sortearOnClick}">🎲 Sortear</button>` : '';
            }
        }

        if (tournamentId) {
            const _inviterUid = (window.AppStore.currentUser && (window.AppStore.currentUser.uid || window.AppStore.currentUser.email)) || '';
            const inviteUrl = window._tournamentUrl(t.id) + (_inviterUid ? '?ref=' + encodeURIComponent(_inviterUid) : '');
            const inviteText = '🏆 Torneio: ' + t.name + '\nAcesse o link abaixo para se inscrever:\n' + inviteUrl;
            // Safe version for embedding in onclick attributes (escape quotes and newlines)
            const inviteTextSafe = inviteText.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
            const _friendCount = (window.AppStore.currentUser && window.AppStore.currentUser.friends && window.AppStore.currentUser.friends.length > 0) ? ' (' + window.AppStore.currentUser.friends.length + ')' : '';
            const inviteModalHtml = `
             <div id="invite-modal-${t.id}" class="invite-modal-container" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9999; cursor: default; box-sizing: border-box;" onclick="event.stopPropagation()">
                <div style="position:absolute;top:1rem;left:50%;transform:translateX(-50%);background: var(--bg-card); width: calc(100% - 2rem); max-width: 340px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.4); animation: fadeIn 0.2s ease; box-sizing: border-box; overflow: hidden;">

                   <div style="padding: 0.6rem 0.85rem; display: flex; flex-direction: column; gap: 0.6rem; box-sizing: border-box;">

                      <!-- Title -->
                      <div style="text-align:center;font-size:0.95rem;font-weight:700;color:var(--text-bright);">Convidar para o Torneio</div>

                      <!-- 3 buttons row -->
                      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                         <button class="btn btn-success btn-sm hover-lift" id="invite-friends-btn-${t.id}" style="flex-direction:column;gap:1px;padding:8px 4px;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" onclick="event.stopPropagation(); window._inviteFriendsToTournament('${t.id}', '${inviteTextSafe}')">
                            <span style="font-size:1.1rem;">👥</span>Amigos${_friendCount}
                         </button>
                         <button class="btn btn-whatsapp btn-sm hover-lift" style="flex-direction:column;gap:1px;padding:8px 4px;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" onclick="window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent('${inviteTextSafe}'), '_blank')">
                            <span style="font-size:1.1rem;">💬</span>WhatsApp
                         </button>
                         <button class="btn btn-primary btn-sm hover-lift" style="flex-direction:column;gap:1px;padding:8px 4px;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" onclick="navigator.clipboard.writeText('${inviteUrl}'); showNotification('Copiado!', 'Link copiado.', 'success')">
                            <span style="font-size:1.1rem;">🔗</span>Copiar Link
                         </button>
                      </div>
                      <div id="invite-friends-status-${t.id}" style="font-size: 0.68rem; color: var(--text-muted); text-align: center; min-height:0;"></div>

                      <!-- QR Code centered -->
                      <div style="text-align: center;">
                         <div style="background: white; padding: 6px; border-radius: 10px; display: inline-block;">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=111111&data=${encodeURIComponent(inviteUrl)}" alt="QR Code" width="120" height="120" style="display: block;">
                         </div>
                         <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 3px;">Escaneie para se inscrever</div>
                      </div>

                      <!-- Email -->
                      <div style="font-size:0.65rem;font-weight:600;color:var(--text-muted);letter-spacing:0.3px;">Convide por e-mail</div>
                      <div style="display: flex; gap: 6px; align-items: stretch; margin-top:-3px;">
                         <input type="email" placeholder="email@exemplo.com" id="invite-email-${t.id}" style="flex: 1; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main); font-size: 0.75rem; min-width: 0; box-sizing: border-box;">
                         <button class="btn btn-indigo btn-sm hover-lift" style="font-size:0.75rem;" onclick="var email = document.getElementById('invite-email-${t.id}').value; if(!email){showNotification('Atenção','Digite um e-mail.','warning');return;} window.open('mailto:' + email + '?subject=' + encodeURIComponent('Convite: ${window._safeHtml(t.name)}') + '&body=' + encodeURIComponent('${inviteTextSafe}'), '_self'); showNotification('E-mail', 'Abrindo seu cliente de e-mail...', 'info');">E-mail</button>
                      </div>

                      <!-- Close -->
                      <button class="btn btn-ghost btn-sm" style="width:100%;" onclick="event.stopPropagation(); closeInviteModal('${t.id}')">Fechar</button>

                   </div>
                </div>
             </div>
          `;

            const editModalHtml = '';

            const tournamentStarted = !!t.tournamentStarted;

            if (isOrg) {
                // Botão "Iniciar Torneio" — SÓ aparece após sorteio realizado, antes de iniciar
                // Ao clicar: inicia o torneio E navega para o chaveamento
                const startTournamentBanner = (hasDraw && !tournamentStarted) ? `
                  <div style="margin-top:1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
                      <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Sorteio realizado. Inicie o torneio para habilitar a chamada de presença.</p>
                      <button class="btn btn-success btn-cta hover-lift" onclick="event.stopPropagation(); window._startTournament('${t.id}'); window.location.hash='#bracket/${t.id}';">
                          ▶ Iniciar Torneio
                      </button>
                  </div>` : '';

                const startedBadge = tournamentStarted ? `
                  <div style="margin-top:1rem;display:flex;align-items:center;gap:8px;justify-content:center;">
                      <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;animation:pulse 2s infinite;"></span>
                      <span style="font-size:0.85rem;font-weight:700;color:#4ade80;">Torneio em andamento</span>
                  </div>` : '';

                // Contagem regressiva de sorteio automático (Ranking / Suíço com auto-draw)
                let autoDrawCountdownHtml = '';
                if (isAutoDrawFormat && !t.drawManual && t.drawFirstDate) {
                    const _nextDraw = window._calcNextDrawDate(t);
                    if (_nextDraw) {
                        const _now = new Date();
                        const _diff = _nextDraw.getTime() - _now.getTime();
                        if (_diff > 0) {
                            const _d = Math.floor(_diff / 86400000);
                            const _h = Math.floor((_diff % 86400000) / 3600000);
                            const _m = Math.floor((_diff % 3600000) / 60000);
                            const _parts = [];
                            if (_d > 0) _parts.push(_d + 'd');
                            if (_h > 0) _parts.push(_h + 'h');
                            _parts.push(_m + 'min');
                            autoDrawCountdownHtml = `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.3);border-radius:10px;font-size:0.8rem;">
                                <span style="color:#fb923c;font-weight:700;">⏱️ Próximo sorteio em</span>
                                <span style="color:#fb923c;font-weight:800;">${_parts.join(' ')}</span>
                            </div>`;
                        } else {
                            autoDrawCountdownHtml = `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;font-size:0.8rem;">
                                <span style="color:#34d399;font-weight:700;">⏱️ Sorteio pendente</span>
                                <span style="color:var(--text-muted);">Rodada pronta para ser gerada</span>
                            </div>`;
                        }
                    }
                }

                // --- Build actionsHtml based on tournament state ---
                if (isFinished) {
                    // Torneio encerrado — mostrar pódio + Ver Chaves
                    let podiumHtml = '';
                    const _allM = t.matches || [];
                    if (_allM.length > 0) {
                        // Elimination: get champion from final match
                        const _roundNums = _allM.map(function(m) { return m.round || 0; });
                        const _lastR = Math.max.apply(null, _roundNums);
                        const _finalM = _allM.filter(function(m) { return m.round === _lastR && !m.isBye && m.winner; });
                        if (_finalM.length > 0) {
                            const _1st = _finalM[0].winner;
                            const _2nd = _finalM[0].winner === _finalM[0].p1 ? _finalM[0].p2 : _finalM[0].p1;
                            const _3rd = (t.thirdPlaceMatch && t.thirdPlaceMatch.winner) ? t.thirdPlaceMatch.winner : null;
                            podiumHtml = `<div style="text-align:center;margin:1.5rem 0;padding:1.5rem;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:16px;">
                                <div style="font-size:1.5rem;margin-bottom:0.5rem;">🏆 Torneio Encerrado</div>
                                <div style="display:flex;justify-content:center;align-items:flex-end;gap:1.5rem;margin-top:1rem;flex-wrap:wrap;">
                                    <div style="text-align:center;order:1;">
                                        <div style="font-size:1.8rem;">🥈</div>
                                        <div style="font-weight:700;color:#94a3b8;font-size:0.95rem;">${window._safeHtml(_2nd)}</div>
                                        <div style="font-size:0.7rem;color:var(--text-muted);">2º Lugar</div>
                                    </div>
                                    <div style="text-align:center;order:0;">
                                        <div style="font-size:2.5rem;">🥇</div>
                                        <div style="font-weight:800;color:#fbbf24;font-size:1.2rem;">${window._safeHtml(_1st)}</div>
                                        <div style="font-size:0.75rem;color:#fbbf24;font-weight:600;">Campeão</div>
                                    </div>
                                    ${_3rd ? `<div style="text-align:center;order:2;">
                                        <div style="font-size:1.5rem;">🥉</div>
                                        <div style="font-weight:700;color:#cd7f32;font-size:0.9rem;">${window._safeHtml(_3rd)}</div>
                                        <div style="font-size:0.7rem;color:var(--text-muted);">3º Lugar</div>
                                    </div>` : ''}
                                </div>
                            </div>`;
                        }
                    }
                    // Suíço/Liga: show standings-based podium
                    if (!podiumHtml && Array.isArray(t.rounds) && t.rounds.length > 0 && t.standings && t.standings.length > 0) {
                        const _top = t.standings.slice(0, 3);
                        const _medals = ['🥇', '🥈', '🥉'];
                        const _colors = ['#fbbf24', '#94a3b8', '#cd7f32'];
                        const _sizes = ['1.2rem', '0.95rem', '0.9rem'];
                        podiumHtml = `<div style="text-align:center;margin:1.5rem 0;padding:1.5rem;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:16px;">
                            <div style="font-size:1.5rem;margin-bottom:0.5rem;">🏆 Torneio Encerrado</div>
                            <div style="display:flex;justify-content:center;align-items:flex-end;gap:1.5rem;margin-top:1rem;flex-wrap:wrap;">
                                ${_top.map(function(s, i) {
                                    var order = i === 0 ? 1 : (i === 1 ? 0 : 2);
                                    return '<div style="text-align:center;order:' + order + ';">' +
                                        '<div style="font-size:' + (i === 0 ? '2.5rem' : '1.5rem') + ';">' + _medals[i] + '</div>' +
                                        '<div style="font-weight:' + (i === 0 ? '800' : '700') + ';color:' + _colors[i] + ';font-size:' + _sizes[i] + ';">' + window._safeHtml(s.name || s.player) + '</div>' +
                                        '<div style="font-size:0.7rem;color:var(--text-muted);">' + s.points + ' pts</div>' +
                                    '</div>';
                                }).join('')}
                            </div>
                        </div>`;
                    }
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${podiumHtml}
                   <div class="tournament-action-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:1rem;">
                     <button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash='#rules/${t.id}'">📋 Regras</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash='#participants/${t.id}'">👥 Inscritos</button>
                     <button class="btn btn-outline btn-sm hover-lift" style="color:#fbbf24;" onclick="event.stopPropagation(); window._showQRCode('${t.id}')">📱 QR Code</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._printBracket()">🖨️ Imprimir</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._exportTournamentCSV('${t.id}')">📊 Exportar CSV</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._tvMode('${t.id}')">📺 Modo TV</button>
                   </div>
                 `;
                } else if (hasDraw) {
                    // Sorteio já feito — mostrar Iniciar Torneio ou badge Em Andamento
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${isLigaFormat ? '' : startTournamentBanner}
                   ${isLigaFormat ? '' : startedBadge}
                   ${autoDrawCountdownHtml ? `<div style="margin-top:1rem;text-align:center;">${autoDrawCountdownHtml}</div>` : ''}
                   <div class="tournament-action-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:1rem;">
                     <button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash='#rules/${t.id}'">📋 Regras</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash='#participants/${t.id}'">👥 Inscritos</button>
                     <button class="btn btn-outline btn-sm hover-lift" style="color:#fbbf24;" onclick="event.stopPropagation(); window._showQRCode('${t.id}')">📱 QR Code</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._printBracket()">🖨️ Imprimir</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._exportTournamentCSV('${t.id}')">📊 Exportar CSV</button>
                     <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._tvMode('${t.id}')">📺 Modo TV</button>
                   </div>
                 `;
                } else {
                    // Antes do sorteio
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${teamEnrollModalHtml}
                   ${autoDrawCountdownHtml ? `<div style="margin-top:1rem;text-align:center;">${autoDrawCountdownHtml}</div>` : ''}
                 `;
                }
            } else if (!window.AppStore.currentUser) {
                // Non-logged-in visitor viewing tournament
                if (isAberto) {
                    // Enrollments open — show enroll CTA (login triggered on click)
                    actionsHtml = `
                   ${teamEnrollModalHtml}
                   <div id="visitor-enroll-cta" style="margin-top:1.5rem;padding:24px;background:linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12));border:2px solid rgba(16,185,129,0.5);border-radius:16px;text-align:center;">
                      <h3 style="color:#4ade80;font-size:1.3rem;font-weight:800;margin-bottom:6px;">Participe deste torneio!</h3>
                      <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:16px;">Clique abaixo para se inscrever.</p>
                      <button class="btn btn-success btn-cta hover-lift" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')">
                         \u2705 Inscrever-se
                      </button>
                   </div>
                 `;
                } else if (isFinished) {
                    // Tournament finished
                    actionsHtml = `
                   <div id="visitor-closed-cta" style="margin-top:1.5rem;padding:24px;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(185,28,28,0.08));border:2px solid rgba(239,68,68,0.35);border-radius:16px;text-align:center;">
                      <h3 style="color:#f87171;font-size:1.15rem;font-weight:700;margin-bottom:6px;">Torneio Encerrado</h3>
                      <p style="color:#94a3b8;font-size:0.88rem;margin-bottom:16px;">Este torneio j\u00E1 foi finalizado. Que tal criar o seu pr\u00F3prio?</p>
                      <button class="btn btn-primary btn-cta hover-lift" onclick="event.stopPropagation(); window.location.hash='#dashboard'">
                         \u{1F3C6} Criar Meu Torneio
                      </button>
                   </div>
                 `;
                } else {
                    // Enrollments closed but tournament still running
                    actionsHtml = `
                   <div id="visitor-closed-cta" style="margin-top:1.5rem;padding:24px;background:linear-gradient(135deg,rgba(251,191,36,0.12),rgba(217,119,6,0.08));border:2px solid rgba(251,191,36,0.35);border-radius:16px;text-align:center;">
                      <h3 style="color:#fbbf24;font-size:1.15rem;font-weight:700;margin-bottom:6px;">Inscri\u00E7\u00F5es Encerradas</h3>
                      <p style="color:#94a3b8;font-size:0.88rem;margin-bottom:16px;">Infelizmente as inscri\u00E7\u00F5es deste torneio j\u00E1 foram encerradas. Que tal criar o seu pr\u00F3prio?</p>
                      <button class="btn btn-primary btn-cta hover-lift" onclick="event.stopPropagation(); window.location.hash='#dashboard'">
                         \u{1F3C6} Criar Meu Torneio
                      </button>
                   </div>
                 `;
                }
            } else {
                actionsHtml = `
               ${inviteModalHtml}
               ${teamEnrollModalHtml}
               ${hasDraw ? `
               <div class="tournament-action-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:1rem;">
                 <button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash='#rules/${t.id}'">📋 Regras</button>
                 <button class="btn btn-outline btn-sm hover-lift" onclick="window.location.hash='#participants/${t.id}'">👥 Inscritos</button>
                 <button class="btn btn-outline btn-sm hover-lift" style="color:#fbbf24;" onclick="event.stopPropagation(); window._showQRCode('${t.id}')">📱 QR Code</button>
                 <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._printBracket()">🖨️ Imprimir</button>
                 <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._exportTournamentCSV('${t.id}')">📊 Exportar CSV</button>
                 <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._tvMode('${t.id}')">📺 Modo TV</button>
               </div>` : `
               <div class="d-flex justify-between align-center mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.15);">
                  <div class="d-flex gap-2">
                     <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.2); color: white; border: none; font-weight: 600;" onclick="window.location.hash='#rules/${t.id}'">Regras</button>
                  </div>
               </div>`}
             `;
            }
        } else {
            actionsHtml = `
            ${teamEnrollModalHtml}
          `;
        }

        var _cardTextColor = (_isLight && !venuePhotoBg) ? '#1f2937' : 'white';

        return `
        <div class="card mb-3" style="position:relative;${venuePhotoBg ? venuePhotoBg : 'background: ' + bgGradient + ';'} color: ${_cardTextColor}; border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: transform 0.2s; ${!tournamentId ? 'cursor: pointer;' : ''}" ${!tournamentId ? `onclick="window.location.hash='#tournaments/${t.id}'" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'"` : ''}>
          <div class="card-body p-4" style="${isOrg ? 'padding-bottom: 38px;' : ''}">

            <!-- Top Row: Icon/Modality | Status (same line on mobile) -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; flex-wrap: wrap; gap: 4px;">
               <div style="display: flex; align-items: center; gap: 6px; opacity: 0.65; min-width: 0;">
                  <span style="font-size: 1.1rem;">${getSportIcon(t.sport)}</span>
                  <span>${cleanSportName(t.sport) || 'Esporte'}</span>
               </div>
               <div style="color: ${statusColor}; background: ${statusBg}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: ${statusFontWeight}; white-space: nowrap;">
                  ${statusText}
               </div>
            </div>
            ${enrollBtnHtml ? `<div style="display: flex; flex-direction: column; align-items: flex-end; margin-top: 6px; gap: 4px;">
               ${enrollBtnHtml}
               ${tournamentId ? `<div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6;">Inscrição: ${enrollmentText}</div>` : ''}
               ${ligaActiveToggleHtml}
            </div>` : (tournamentId ? `<div style="display: flex; justify-content: flex-end; margin-top: 6px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6;">Inscrição: ${enrollmentText}</div>` : '')}

            <!-- Middle Left: Nome + Logo + Favorito -->
            <div style="display: flex; align-items: center; gap: 14px; margin: 1.8rem 0 0.5rem 0;">
              ${t.logoData ? `<img src="${t.logoData}" alt="Logo" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">` : ''}
              <h4 style="margin: 0; font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; text-align: left; flex: 1; min-width: 0; overflow-wrap: break-word;">
                ${window._safeHtml(t.name)}
              </h4>
              ${tournamentId ? `<span data-fav-id="${t.id}" onclick="event.stopPropagation(); window._toggleFavorite('${t.id}', event)" title="${(typeof window._isFavorite === 'function' && window._isFavorite(t.id)) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" style="font-size:1.8rem;cursor:pointer;flex-shrink:0;color:${(typeof window._isFavorite === 'function' && window._isFavorite(t.id)) ? '#fbbf24' : 'rgba(255,255,255,0.4)'};transition:color 0.2s;line-height:1;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${(typeof window._isFavorite === 'function' && window._isFavorite(t.id)) ? '★' : '☆'}</span>` : ''}
            </div>
            ${tournamentId ? `<div style="margin-bottom: 1rem; display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-warning btn-sm hover-lift" onclick="event.stopPropagation(); openInviteModal('${t.id}')">📤 Convidar</button>
              <button class="btn btn-outline btn-sm hover-lift" onclick="event.stopPropagation(); window._shareTournament('${t.id}');">📋 Compartilhar</button>
              <button class="btn btn-outline btn-sm hover-lift" style="color: #fbbf24;" onclick="event.stopPropagation(); window._showQRCode('${t.id}');">📱 QR Code</button>
            </div>` : ''}

            <!-- Below Name: Calendário + Data -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; opacity: 0.7;">
               <span style="font-size: 1.1rem;">🗓️</span>
               <span>${dates}</span>
            </div>
            ${tournamentId && t.updatedAt ? `<div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 400; opacity: 0.5; margin-top: 4px;">
               <span>🔄</span>
               <span>Atualizado em ${(() => { try { var d = new Date(t.updatedAt); return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}); } catch(e) { return t.updatedAt; } })()}</span>
            </div>` : ''}
            ${(typeof window._buildTimeEstimation === 'function') ? window._buildTimeEstimation(t) : ''}
            ${t.venue ? `
            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; font-weight: 500; opacity: 0.65; margin-top: 6px;">
               <span style="font-size: 1rem; flex-shrink:0;">📍</span>
               <span style="display:flex; flex-direction:column; gap:1px;">
                 <span>${window._safeHtml(t.venue)}${t.courtCount > 1 ? ' — ' + t.courtCount + ' quadras' : t.courtCount === 1 ? ' — 1 quadra' : ''}</span>
                 ${t.venueAddress ? '<span style="font-size:0.75rem; font-weight:400; opacity:0.7;">' + window._safeHtml(t.venueAddress) + '</span>' : ''}
               </span>
               ${t.venueLat && t.venueLon ? '<a href="' + (t.venuePlaceId ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.venue) + '&query_place_id=' + t.venuePlaceId : 'https://www.google.com/maps/search/?api=1&query=' + t.venueLat + ',' + t.venueLon) + '" target="_blank" title="Ver no mapa" style="color:#818cf8; text-decoration:none; font-size:1rem; flex-shrink:0;">🗺️</a>' : ''}
            </div>
            ${tournamentId && t.venueLat && t.venueLon ? '<div id="tournament-venue-map" data-lat="' + t.venueLat + '" data-lng="' + t.venueLon + '" data-venue="' + window._safeHtml(t.venue || '') + '" style="width:100%;height:180px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);margin-top:8px;background:#1a1a2e;"></div>' : ''}` : ''}

            ${(() => {
              if (isFinished) return '';
              var _now = Date.now();
              var _events = [];
              if (isAberto && t.registrationLimit) {
                var _rd = new Date(t.registrationLimit).getTime();
                if (!isNaN(_rd) && _rd > _now) _events.push({ ts: _rd, label: _t('event.enrollClose'), icon: '⏰', color: '#f59e0b' });
              }
              if (t.startDate) {
                var _sd = new Date(t.startDate).getTime();
                if (!isNaN(_sd) && _sd > _now && !sorteioRealizado) _events.push({ ts: _sd, label: _t('event.tournamentStart'), icon: '🏁', color: '#10b981' });
              }
              if (t.endDate) {
                var _ed = new Date(t.endDate).getTime();
                if (!isNaN(_ed) && _ed > _now) _events.push({ ts: _ed, label: _t('event.tournamentEnd'), icon: '🏆', color: '#8b5cf6' });
              }
              if (_events.length === 0) return '';
              _events.sort(function(a,b) { return a.ts - b.ts; });
              var _next = _events[0];
              var _countdownText = window._formatCountdown ? window._formatCountdown(_next.ts - _now) : '';
              var _rgb = _next.color === '#f59e0b' ? '245,158,11' : _next.color === '#10b981' ? '16,185,129' : '139,92,246';
              return '<div style="margin-top:10px;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(' + _rgb + ',0.1);border:1px solid rgba(' + _rgb + ',0.3);border-radius:12px;">' +
                '<span style="font-size:1.3rem;">' + _next.icon + '</span>' +
                '<span style="font-size:0.85rem;font-weight:700;color:' + _next.color + ';">' + _next.label + '</span>' +
                '<span data-countdown-target="' + _next.ts + '" style="margin-left:auto;font-size:1.15rem;font-weight:900;color:' + _next.color + ';font-variant-numeric:tabular-nums;letter-spacing:0.5px;">' + _countdownText + '</span>' +
              '</div>';
            })()}

            <!-- Linha separadora -->
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1.8rem 0;"></div>

            <!-- Bottom Section -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center;">

               <!-- Stats Column -->
                <div style="display: inline-flex; flex-direction: column; gap: 8px; width: 100%;">
                    <div id="stat-boxes-row" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start;">
                        <div class="stat-box" data-stat="inscritos">
                           <span style="font-size: 1.1rem; margin-right: 4px;">👤</span>
                           <span class="stat-value" style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${individualCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; opacity: 0.8;">Inscritos</span>
                        </div>
                        ${teamCount > 0 ? `
                        <div class="stat-box" data-stat="equipes">
                           <span style="font-size: 1.1rem; margin-right: 4px;">👥</span>
                           <span class="stat-value" style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; opacity: 0.8;">Equipes</span>
                        </div>
                        ` : ''}
                        ${standbyCount > 0 ? `
                        <div class="stat-box" data-stat="waitlist" style="background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3);">
                           <span style="font-size: 1.1rem; margin-right: 4px;">⏳</span>
                           <span class="stat-value" style="font-size: 1.4rem; font-weight: 800; line-height: 1; color: #fbbf24;">${standbyCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; color: #fbbf24; opacity: 0.9;">Lista de Espera</span>
                        </div>
                        ` : ''}
                    </div>
                    ${(typeof window._buildCategoryCountHtml === 'function') ? window._buildCategoryCountHtml(t) : ''}
                </div>

               <!-- Formato, Regras e Categorias -->
               <div class="info-box" style="font-size:0.75rem;padding:6px 10px;line-height:1.5;gap:2px;border-radius:8px;">
                  <div><strong>Formato:</strong> ${t.format} · <strong>Inscrição:</strong> ${enrollmentText} · <strong>Acesso:</strong> ${publicText}</div>
                  ${(t.ligaSeasonMonths || t.rankingSeasonMonths) ? (() => {
                    const _sm = t.ligaSeasonMonths || t.rankingSeasonMonths;
                    let _seasonInfo = `<div><strong>Temporada:</strong> ${_sm} meses`;
                    if (t.startDate) {
                      const _sd = new Date(t.startDate);
                      if (!isNaN(_sd.getTime())) {
                        const _ed = new Date(_sd); _ed.setMonth(_ed.getMonth() + parseInt(_sm));
                        const _daysLeft = Math.ceil((_ed - new Date()) / 86400000);
                        _seasonInfo += ` (encerra ${_ed.toLocaleDateString('pt-BR')})`;
                        if (_daysLeft > 0 && _daysLeft <= 7) {
                          _seasonInfo += ` <span style="color:#f59e0b;font-weight:700;">⚠️ ${_daysLeft}d restante${_daysLeft > 1 ? 's' : ''}</span>`;
                        }
                      }
                    }
                    return _seasonInfo + '</div>';
                  })() : ''}
                  ${(t.drawFirstDate) ? `<div><strong>1º Sorteio:</strong> ${(() => { try { var _dd = t.drawFirstDate.split('-'); return _dd[2] + '/' + _dd[1] + '/' + _dd[0]; } catch(e) { return t.drawFirstDate; } })()} às ${t.drawFirstTime || '19:00'}</div>` : ''}
                  ${(t.drawIntervalDays) ? `<div><strong>Intervalo:</strong> ${t.drawManual ? 'Manual' : 'A cada ' + t.drawIntervalDays + ' dia' + (t.drawIntervalDays > 1 ? 's' : '') + ' (automático)'}</div>` : ''}
                  ${(!t.combinedCategories || t.combinedCategories.length === 0) ? `<div><strong>Categorias:</strong> ${cats}</div>` : ''}
               </div>
            </div>

            ${(() => {
              if (!tournamentId) return '';
              var _prog = window._getTournamentProgress(t);
              var _html = '';
              // Progress bar — only show after draw
              if (_prog.total > 0) {
                var _barColor = _prog.pct === 100 ? '#10b981' : (_prog.pct > 50 ? '#3b82f6' : '#f59e0b');
                _html += '<div class="info-box" style="margin-top: 1rem;">';
                _html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">';
                _html += '<span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">Progresso do Torneio</span>';
                _html += '<span style="font-size: 0.8rem; font-weight: 700;">' + _prog.completed + '/' + _prog.total + ' partidas (' + _prog.pct + '%)</span>';
                _html += '</div>';
                _html += '<div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">';
                _html += '<div style="width: ' + _prog.pct + '%; height: 100%; background: ' + _barColor + '; border-radius: 4px; transition: width 0.5s ease;"></div>';
                _html += '</div>';
                if (_prog.pct === 100 && !isFinished) {
                  _html += '<div style="margin-top: 6px; font-size: 0.75rem; color: #10b981; font-weight: 600;">✅ Todas as partidas concluídas!</div>';
                }
                _html += '</div>';
              }
              return _html;
            })()}

            ${actionsHtml}

            ${(tournamentId && isOrg) ? `
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.12);">
              <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.35); margin-bottom: 10px;">${_t('org.tools')}</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${hasDraw ? `<button class="btn btn-primary hover-lift" onclick="window._lastActiveTournamentId='${t.id}';window.location.hash='#bracket/${t.id}'">🏆 ${_t('btn.viewBracket')}</button>` : ''}
                ${t.status !== 'closed' ? `<button class="btn btn-indigo hover-lift" onclick="event.stopPropagation(); window.openEditModal('${t.id}')">✏️ ${_t('btn.edit')}</button>` : ''}
                ${t.status !== 'closed' ? `<button class="btn btn-purple hover-lift" onclick="event.stopPropagation(); window._sendOrgCommunication('${t.id}')">📢 ${_t('org.communicate')}</button>` : ''}
                ${addParticipantBtns}
                ${t.status !== 'closed' ? `<button class="btn btn-danger-ghost hover-lift" onclick="event.stopPropagation(); window.addBotsFunction('${t.id}')">🤖 ${_t('org.addBot')}</button>` : ''}
                ${hasDraw ? `<button class="btn btn-tool-green hover-lift" onclick="event.stopPropagation(); window._exportTournamentCSV('${t.id}')">📊 ${_t('btn.export')}</button>` : ''}
                ${isOrg ? `<button class="btn btn-tool-amber hover-lift" onclick="event.stopPropagation(); window._saveAsTemplate('${t.id}')">💾 ${window._t ? window._t('btn.saveTemplate') : 'Salvar como Template'}</button>` : ''}
                ${categoriasBtn}
                ${toggleRegBtn}
                ${sortearBtn}
                ${sortearAberto}
                ${(!isFinished && hasDraw && !window._isLigaFormat(t)) ? `<button class="btn btn-tool-amber hover-lift" onclick="event.stopPropagation(); window.finishTournament('${t.id}')">🏁 ${_t('org.finishTournament')}</button>` : ''}
                ${window.AppStore.isCreator(t) ? `<button class="btn btn-danger-ghost hover-lift" onclick="event.stopPropagation(); window.deleteTournamentFunction('${t.id}')">🗑️ ${_t('btn.delete')}</button>` : ''}
              </div>
            </div>` : ''}

          </div>
          ${isOrg ? `<div style="position:absolute;bottom:6px;right:8px;opacity:0.9;pointer-events:none;" title="Organizador">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(251,191,36,0.95)"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>
          </div>` : ''}
          ${(tournamentId && window.AppStore.isCreator(t)) ? `<div id="crown-org-btn" style="position:absolute;bottom:6px;right:8px;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);box-shadow:0 4px 20px rgba(251,191,36,0.4),0 0 15px rgba(251,191,36,0.3);z-index:100;cursor:pointer;display:none;align-items:center;justify-content:center;transition:transform 0.2s,box-shadow 0.3s;animation:crownGlow 2s ease-in-out infinite;"
            ondragover="event.preventDefault();event.dataTransfer.dropEffect='move';this.style.transform='scale(1.15)';"
            ondragleave="this.style.transform='scale(1)';"
            ondrop="this.style.transform='scale(1)';window._handleCrownDrop(event,'${t.id}')"
            onclick="window._openOrgPickerDialog('${t.id}')" title="${_t('org.organization')}">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#78350f"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>
          </div>
          <style>@keyframes crownGlow{0%,100%{box-shadow:0 4px 20px rgba(251,191,36,0.4),0 0 15px rgba(251,191,36,0.3)}50%{box-shadow:0 4px 25px rgba(251,191,36,0.6),0 0 30px rgba(251,191,36,0.5)}}</style>` : ''}
        </div>
      `;
    };

    let gridHtml = '';
    if (visible.length === 0) {
        gridHtml = `<div class="card p-4 text-center" style="grid-column: 1/-1;"><p class="text-muted mt-3 mb-3">${_t('tournament.noTournamentsMsg')}</p></div>`;
    } else {
        gridHtml = visible.map(t => {
            const isOrg = typeof window.AppStore.isOrganizer === 'function' ? window.AppStore.isOrganizer(t) : false;
            return renderTournamentCard(t, isOrg);
        }).join('');
    }

    let headerHtml = `
    <div class="sticky-back-header">
      <button class="btn btn-outline btn-sm hover-lift" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px;" onclick="event.stopPropagation(); window.location.hash='#dashboard';">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
         Voltar
      </button>
    </div>
    <div class="d-flex justify-between align-center mb-4">
      <div>
        <h2>${_t('tournament.title')}</h2>
        <p class="text-muted">Gerencie ou inscreva-se nos torneios disponíveis.</p>
      </div>
    </div>
  `;

    let participantsHtml = '';
    var _organizersHtml = '';

    // ── One-time checks per tournament view (run once, not on every re-render from sort/scroll) ──
    var _checksKey = tournamentId ? ('_tournChecks_' + tournamentId) : null;
    var _checksRan = _checksKey && window[_checksKey];
    if (tournamentId && visible.length === 1 && !_checksRan) {
        if (_checksKey) window[_checksKey] = true;

        // Fix orphaned match names
        if (typeof window._fixOrphanedMatchNames === 'function') {
            var _orphanFixes = window._fixOrphanedMatchNames(visible[0]);
            if (_orphanFixes > 0) {
                setTimeout(function() { if (typeof window._softRefreshView === 'function') window._softRefreshView(); }, 600);
                return;
            }
        }

        // Auto-fix stale names (async Firestore check)
        if (typeof window._autoFixStaleNames === 'function') {
            window._autoFixStaleNames(visible[0].id).catch(function(e) { console.warn('Auto-fix stale names error:', e); });
        }

        // Deduplicação de participantes
        if (typeof window._deduplicateParticipants === 'function') {
            var _ddCount = window._deduplicateParticipants(visible[0]);
            if (_ddCount > 0 && window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
                window.FirestoreDB.saveTournament(visible[0]).catch(function() {});
            }
        }
    }

    // Build organizers section — always shown in detail view regardless of participants
    if (tournamentId && visible.length === 1) {
      (function() {
        var _t = visible[0];
        var _crownSvg = window._CROWN_SVG || '<svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(251,191,36,0.9)"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>';
        var _isCreatorNow = window.AppStore.isCreator(_t);
        var _competitors = typeof window._getCompetitors === 'function' ? window._getCompetitors(_t) : (_t.participants ? (Array.isArray(_t.participants) ? _t.participants : Object.values(_t.participants)) : []);
        var _enrolledEmails = {};
        _competitors.forEach(function(p) { var e = typeof p === 'object' ? (p.email || '') : ''; if (e) _enrolledEmails[e] = true; });

        var _orgCards = '';
        // Helper: build organizer card with avatar + crown next to name
        function _buildOrgCard(name, role, bgStyle, canRemove, removeEmail) {
          var _oSeed = encodeURIComponent(name);
          var _oFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _oSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
          var _oPhoto = (window._playerPhotoCache && window._playerPhotoCache[(name || '').toLowerCase()] && window._playerPhotoCache[(name || '').toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[(name || '').toLowerCase()] : _oFallback;
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;' + bgStyle + 'border-radius:10px;min-width:160px;">' +
            '<img src="' + _oPhoto + '" onerror="this.onerror=null;this.src=\'' + _oFallback + '\'" data-player-name="' + window._safeHtml(name) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(99,102,241,0.3);" />' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="display:flex;align-items:center;gap:4px;font-weight:700;font-size:0.82rem;color:var(--text-bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + window._safeHtml(name) + ' ' + _crownSvg + '</div>' +
              '<div style="font-size:0.65rem;color:var(--text-muted);">' + role + '</div>' +
            '</div>' +
            (canRemove ? '<button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:2px;line-height:1;" title="Remover co-organizador" onclick="event.stopPropagation();window._removeCoHost(\'' + window._safeHtml(String(_t.id)) + '\',\'' + window._safeHtml(removeEmail) + '\')">✕</button>' : '') +
          '</div>';
        }
        var _orgBgPrimary = 'background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1));border:1px solid rgba(99,102,241,0.3);';
        var _orgBgCohost = 'background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);';

        // Resolve organizer display name (prefer name, fallback to finding it from participants or current user)
        var _orgDisplayName = _t.organizerName;
        if (!_orgDisplayName && _t.organizerEmail) {
          // Try to find name from participants list
          var _partsArr = Array.isArray(_t.participants) ? _t.participants : (_t.participants ? Object.values(_t.participants) : []);
          for (var _oi = 0; _oi < _partsArr.length; _oi++) {
            var _op = _partsArr[_oi];
            if (typeof _op === 'object' && _op && (_op.email === _t.organizerEmail || _op.uid === _t.creatorUid)) {
              _orgDisplayName = _op.displayName || _op.name || '';
              break;
            }
          }
          // Try current user if they are the organizer
          if (!_orgDisplayName && window.AppStore.currentUser && window.AppStore.currentUser.email === _t.organizerEmail) {
            _orgDisplayName = window.AppStore.currentUser.displayName || '';
          }
        }
        if (!_orgDisplayName) _orgDisplayName = _t.organizerEmail;

        // Backfill organizerName if we found it and it was missing
        if (_orgDisplayName && _orgDisplayName !== _t.organizerEmail && !_t.organizerName) {
          _t.organizerName = _orgDisplayName;
        }

        // Primary organizer — only in org section if NOT enrolled
        if (!_enrolledEmails[_t.organizerEmail]) {
          _orgCards += _buildOrgCard(_orgDisplayName, 'Organizador', _orgBgPrimary, false, '');
        }
        if (Array.isArray(_t.coHosts)) {
          _t.coHosts.forEach(function(ch) {
            if (ch.status !== 'active') return;
            if (_enrolledEmails[ch.email]) return;
            _orgCards += _buildOrgCard(ch.displayName || ch.email, 'Co-organizador', _orgBgCohost, _isCreatorNow, ch.email);
          });
        }
        if (_orgCards || _competitors.length === 0) {
          if (!_orgCards && _competitors.length === 0) {
            _orgCards = _buildOrgCard(_orgDisplayName, 'Organizador', _orgBgPrimary, false, '');
          }
          _organizersHtml = '<div style="margin-top:1.25rem;margin-bottom:0.5rem;">' +
            '<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px;">ORGANIZAÇÃO</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + _orgCards + '</div></div>';
        }
      })();
    }

    if (tournamentId && visible.length === 1) {
        const t = visible[0];
        const isOrg = typeof window.AppStore.isOrganizer === 'function' ? window.AppStore.isOrganizer(t) : false;
        const parts = typeof window._getCompetitors === 'function' ? window._getCompetitors(t) : (t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : []);

        // Pre-load player photos for avatar display (async, updates DOM after load)
        if (typeof _preloadPlayerPhotos === 'function') {
            _preloadPlayerPhotos(t).then(function() {
                // Update all participant avatar images with real photos from cache
                var pImgs = container.querySelectorAll('img[data-player-name]');
                pImgs.forEach(function(img) {
                    var nm = img.getAttribute('data-player-name');
                    var real = window._playerPhotoCache && window._playerPhotoCache[(nm || '').toLowerCase()];
                    if (real && real.indexOf('dicebear.com') === -1 && img.src.indexOf('dicebear.com') !== -1) {
                        var fb = 'https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(nm) + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                        img.onerror = function() { this.onerror = null; this.src = fb; };
                        img.src = real;
                    }
                });
            }).catch(function() {});
        }
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
            // Sort preference: alpha_asc/alpha_desc = alphabetical, chrono/chrono_desc = enrollment order
            var _enrollSort = window._enrollSortMode || 'chrono';
            if (_enrollSort === 'alpha_asc' || _enrollSort === 'alpha_desc') {
                var _alphaDir = (_enrollSort === 'alpha_desc') ? -1 : 1;
                parts.sort(function(a, b) {
                    var nA = (typeof a === 'string' ? a : (a.displayName || a.name || '')).toLowerCase();
                    var nB = (typeof b === 'string' ? b : (b.displayName || b.name || '')).toLowerCase();
                    return _alphaDir * nA.localeCompare(nB, 'pt-BR', { sensitivity: 'base' });
                });
            } else if (_enrollSort === 'chrono_desc') {
                parts.reverse();
            }
            // (chrono = original array order = enrollment order, no sort needed)

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

            // Build organizer emails set (shared by check-in and normal modes)
            var _orgEmailsShared = {};
            _orgEmailsShared[t.organizerEmail] = true;
            if (Array.isArray(t.coHosts)) t.coHosts.forEach(function(ch) { if (ch.status === 'active') _orgEmailsShared[ch.email] = true; });

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

                // Sort: apply user preference, then unchecked first
                allIndividuals.sort((a, b) => {
                    const ac = !!checkedIn[a.name], bc = !!checkedIn[b.name];
                    if (ac !== bc) return ac ? 1 : -1; // unchecked first
                    if (_enrollSort === 'alpha_asc') return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
                    if (_enrollSort === 'alpha_desc') return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' });
                    if (_enrollSort === 'chrono_desc') return b.teamIdx - a.teamIdx;
                    return 0; // chrono = original order
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

                    const _ciSeed = encodeURIComponent(ind.name);
                    const _ciAvatar = (window._playerPhotoCache && window._playerPhotoCache[ind.name.toLowerCase()] && window._playerPhotoCache[ind.name.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[ind.name.toLowerCase()] : 'https://api.dicebear.com/9.x/initials/svg?seed=' + _ciSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                    const _ciFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _ciSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';

                    const _ciSafeName = ind.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                    const _ciSafeNameHtml = window._safeHtml(_ciSafeName);
                    const _ciIsOrg = typeof window._isOrgName === 'function' && window._isOrgName(ind.name, t);
                    const _ciCrownInline = _ciIsOrg ? ' <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(251,191,36,0.9)" style="flex-shrink:0;vertical-align:middle;margin-left:2px;"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>' : '';
                    var _ciMergeDrag = isOrg ? 'draggable="true" ondragstart="window._mergeDragStart(event, \'' + _ciSafeName + '\', \'' + t.id + '\')" ondragend="window._mergeDragEnd(event)" ondragover="event.preventDefault();event.dataTransfer.dropEffect=\'move\';" ondragenter="window._mergeDragEnter(event)" ondragleave="window._mergeDragLeave(event)" ondrop="event.stopPropagation();window._mergeDrop(event, \'' + _ciSafeName + '\', \'' + t.id + '\')"' : '';
                    return `
                      <div data-merge-name="${window._safeHtml(ind.name)}" ${_ciMergeDrag} style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${mc ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)'};border:1px solid ${mc ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'};${isVipCI ? 'border-left:3px solid #fbbf24;' : ''}transition:all 0.2s;cursor:pointer;" onclick="window._toggleCheckIn('${t.id}', '${_ciSafeName}')">
                          <label class="toggle-switch toggle-sm" style="--toggle-on-bg:#10b981;--toggle-on-glow:rgba(16,185,129,0.3);--toggle-on-border:#10b981;" onclick="event.stopPropagation();"><input type="checkbox" ${mc ? 'checked' : ''} onclick="event.stopPropagation(); window._toggleCheckIn('${t.id}', '${_ciSafeName}');"><span class="toggle-slider"></span></label>
                          <img src="${_ciAvatar}" onerror="this.onerror=null;this.src='${_ciFallback}'" data-player-name="${window._safeHtml(ind.name)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${mc ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'};" />
                          <div style="flex:1;overflow:hidden;">
                              <div style="font-weight:600;font-size:0.92rem;color:${mc ? '#4ade80' : 'var(--text-bright)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${mc ? 'text-decoration:line-through;text-decoration-color:rgba(74,222,128,0.3);' : ''}">${window._safeHtml(ind.name)}${_ciCrownInline}${vipTagCI}</div>
                              ${teamLabel ? `<div style="font-size:0.7rem;color:var(--text-muted);opacity:0.5;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${window._safeHtml(teamLabel)}</div>` : ''}
                          </div>
                          <div style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:8px;${mc ? 'background:rgba(16,185,129,0.15);color:#4ade80;' : 'background:rgba(239,68,68,0.12);color:#f87171;'}">${mc ? 'Presente' : 'Ausente'}</div>
                      </div>`;
                }).join('');
            } else {
                // ── Normal mode: show teams/individuals with drag, split, delete, VIP ──
                const _vipMap = t.vips || {};
                // Use shared organizer emails set
                var _orgEmails = _orgEmailsShared;

                // Sort: respect user sort preference, with organizers first as secondary
                var _sortedParts = parts.slice().sort(function(a, b) {
                  var aEmail = (typeof a === 'object' ? (a.email || '') : '');
                  var bEmail = (typeof b === 'object' ? (b.email || '') : '');
                  var aIsOrg = _orgEmails[aEmail] ? 0 : 1;
                  var bIsOrg = _orgEmails[bEmail] ? 0 : 1;
                  if (aIsOrg !== bIsOrg) return aIsOrg - bIsOrg; // organizers first
                  if (_enrollSort === 'alpha_asc' || _enrollSort === 'alpha_desc') {
                    var nA = (typeof a === 'string' ? a : (a.displayName || a.name || '')).toLowerCase();
                    var nB = (typeof b === 'string' ? b : (b.displayName || b.name || '')).toLowerCase();
                    return (_enrollSort === 'alpha_desc' ? -1 : 1) * nA.localeCompare(nB, 'pt-BR', { sensitivity: 'base' });
                  }
                  if (_enrollSort === 'chrono_desc') {
                    return parts.indexOf(b) - parts.indexOf(a);
                  }
                  return 0; // chrono = original order
                });

                cardsStr = _sortedParts.map((p, sortedIdx) => {
                    // Use original index in parts array for drag operations
                    var idx = parts.indexOf(p);
                    if (idx === -1) idx = sortedIdx;
                    const pName = typeof p === 'string' ? p : (p.displayName || p.name || p.email || 'Participante ' + (sortedIdx + 1));
                    const isTeam = pName.includes('/');
                    const isVip = !!_vipMap[pName];
                    const safeP = pName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

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
                            const _mSeed = encodeURIComponent(n);
                            const _mPhoto = (window._playerPhotoCache && window._playerPhotoCache[n.toLowerCase()] && window._playerPhotoCache[n.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[n.toLowerCase()] : 'https://api.dicebear.com/9.x/initials/svg?seed=' + _mSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                            const _mFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _mSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                            const _mIsOrg = typeof window._isOrgName === 'function' && window._isOrgName(n, t);
                            const _mCrown = _mIsOrg ? ' <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(251,191,36,0.9)" style="flex-shrink:0;margin-left:2px;"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>' : '';
                            return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;overflow:hidden;"><img src="${_mPhoto}" onerror="this.onerror=null;this.src='${_mFallback}'" data-player-name="${window._safeHtml(n)}" style="width:${i === 0 ? '24px' : '20px'};height:${i === 0 ? '24px' : '20px'};border-radius:50%;object-fit:cover;flex-shrink:0;"><span style="font-weight:${i === 0 ? '700' : '500'};font-size:${i === 0 ? '0.95rem' : '0.85rem'};color:${i === 0 ? 'var(--text-bright)' : 'var(--text-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${window._safeHtml(n)}">${window._safeHtml(n)}</span>${_mCrown}</div>`;
                        }).join('');
                    } else {
                        const _pSeed = encodeURIComponent(pName);
                        const _pPhoto = (window._playerPhotoCache && window._playerPhotoCache[pName.toLowerCase()] && window._playerPhotoCache[pName.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[pName.toLowerCase()] : 'https://api.dicebear.com/9.x/initials/svg?seed=' + _pSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                        const _pFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _pSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                        // Crown detection (moved before building HTML so it can be inline)
                        var _pEmail = typeof p === 'object' ? (p.email || '') : '';
                        var _isOrgParticipant = !!_orgEmails[_pEmail];
                        var _crownInline = _isOrgParticipant ? ' <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(251,191,36,0.9)" style="flex-shrink:0;margin-left:2px;"><path d="M2 20h20v2H2zM4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/></svg>' : '';
                        pNameHtml = `<div style="display:flex;align-items:center;gap:8px;overflow:hidden;"><img src="${_pPhoto}" onerror="this.onerror=null;this.src='${_pFallback}'" data-player-name="${window._safeHtml(pName)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;"><span style="font-weight:600;font-size:0.95rem;color:var(--text-bright);text-overflow:ellipsis;white-space:nowrap;overflow:hidden;" title="${window._safeHtml(pName)}">${window._safeHtml(pName)}</span>${_crownInline}</div>`;
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
                    // Category badges — displayed below name as a separate row
                    const _pCats = window._getParticipantCategories(p);
                    const _pCatSource = typeof p === 'object' ? (p.categorySource || '') : '';
                    const _pWasUncat = typeof p === 'object' ? (p.wasUncategorized || false) : false;
                    let catBadgeRow = '';
                    const _hasCatsForBadge = (t.combinedCategories && t.combinedCategories.length > 0) || (t.genderCategories && t.genderCategories.length > 0);
                    if (_hasCatsForBadge) {
                        if (_pCats.length > 0) {
                            var srcLabel = _pCatSource === 'perfil' ? ' <span style="font-size:0.55rem;color:var(--text-muted);opacity:0.7;">(perfil)</span>'
                                : (_pWasUncat ? ' <span style="font-size:0.55rem;color:var(--text-muted);opacity:0.7;">(sem cat.)</span>' : '');
                            catBadgeRow = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:center;">' +
                                window._sortCategoriesBySkillOrder(_pCats, t.skillCategories).map(function(c) {
                                    return '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:600;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.25);">' + (window._displayCategoryName ? window._displayCategoryName(c) : c) + '</span>';
                                }).join('') + srcLabel + '</div>';
                        } else {
                            catBadgeRow = '<div style="margin-top:4px;"><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:600;background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);">(sem cat.)</span></div>';
                        }
                    }
                    // Enrollment type label — shown at bottom-left
                    const typeLabel = _teamLabel + vipBadge;

                    let actionsHtml = '';
                    let dragProps = '';
                    // Merge drag-and-drop: available for organizers AFTER draw (to fix duplicate names)
                    if (isOrg && drawDone) {
                        dragProps = `draggable="true" ondragstart="window._mergeDragStart(event, '${safeP}', '${t.id}')" ondragend="window._mergeDragEnd(event)" ondragover="event.preventDefault();event.dataTransfer.dropEffect='move';" ondragenter="window._mergeDragEnter(event)" ondragleave="window._mergeDragLeave(event)" ondrop="window._mergeDrop(event, '${safeP}', '${t.id}')"`;
                    }
                    if (isOrg && !drawDone) {
                        const vipBtn = `<button title="${isVip ? 'Remover VIP' : 'Marcar como VIP'}" style="background: ${isVip ? 'linear-gradient(135deg,rgba(234,179,8,0.35),rgba(251,191,36,0.25))' : 'rgba(234,179,8,0.08)'}; color: ${isVip ? '#fbbf24' : '#a3842a'}; border: 1px ${isVip ? 'solid' : 'dashed'} ${isVip ? 'rgba(251,191,36,0.6)' : 'rgba(234,179,8,0.3)'}; border-radius: 6px; cursor: pointer; padding: 2px 8px; font-size: 0.7rem; font-weight: 800; transition: transform 0.2s; letter-spacing: 0.5px;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window._toggleVip('${t.id}', '${safeP}');">⭐ VIP</button>`;
                        const delBtn = `<button title="Remover" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px dashed #ef4444;border-radius:6px;cursor:pointer;padding:2px 6px;font-size:0.75rem;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.removeParticipantFunction('${t.id}', '${safeP}');">🗑️</button>`;
                        let splitBtn = '';
                        if (pName.includes('/')) {
                            splitBtn = `<button title="Desfazer Equipe" style="background:rgba(14,165,233,0.1);color:#38bdf8;border:1px dashed #0ea5e9;border-radius:6px;cursor:pointer;padding:2px 6px;font-size:0.75rem;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); window.splitParticipantFunction('${t.id}', '${safeP}');">✂️</button>`;
                        }
                        actionsHtml = `<div style="display:flex;gap:4px;justify-content:flex-end;margin-top:6px;">${vipBtn}${splitBtn}${delBtn}</div>`;
                        dragProps = `draggable="true" ondragstart="window.handleDragStart(event, ${idx}, '${t.id}')" ondragend="window.handleDragEnd(event)" ondragover="window.handleDragOver(event)" ondragenter="window.handleDragEnter(event)" ondragleave="window.handleDragLeave(event)" ondrop="window.handleDropTeam(event, ${idx})"`;
                    }

                    const bgNum = isVip ? '⭐' : sortedIdx + 1;

                    // Bottom row: type label on left, action buttons on right (same line)
                    var bottomRow = '';
                    if (typeLabel || actionsHtml) {
                        var actionsInline = actionsHtml.replace('margin-top:6px;', 'margin-top:0;');
                        bottomRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;">' +
                            '<div style="font-size:0.65rem;color:var(--text-muted);opacity:0.5;">' + typeLabel + '</div>' +
                            actionsInline +
                            '</div>';
                    }

                    return `
                      <div class="participant-card" data-participant-name="${pName.replace(/"/g, '&quot;')}" data-merge-name="${pName.replace(/"/g, '&quot;')}" ${dragProps} style="${cardStyle} border-radius:12px;padding:10px 12px;position:relative;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s;${isOrg ? 'cursor:grab;' : ''}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                          <div style="position:absolute;right:8px;top:6px;font-size:${String(bgNum).length > 2 ? '1.6rem' : '2rem'};font-weight:900;color:rgba(255,255,255,0.08);line-height:1;pointer-events:none;user-select:none;">${bgNum}</div>
                          <div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:0;">
                              <div style="display:flex;align-items:center;gap:12px;">
                                  <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;">
                                      ${pNameHtml}
                                      ${catBadgeRow}
                                  </div>
                              </div>
                              ${bottomRow}
                          </div>
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

            var _sortAlphaAsc = _enrollSort === 'alpha_asc';
            var _sortAlphaDesc = _enrollSort === 'alpha_desc';
            var _sortAlphaActive = _sortAlphaAsc || _sortAlphaDesc;
            var _sortChronoAsc = _enrollSort === 'chrono' || (!_enrollSort);
            var _sortChronoDesc = _enrollSort === 'chrono_desc';
            var _sortChronoActive = _sortChronoAsc || _sortChronoDesc;
            var _alphaLabel = _sortAlphaDesc ? 'Z-A ↑' : 'A-Z ↓';
            var _alphaNextMode = _sortAlphaAsc ? 'alpha_desc' : 'alpha_asc';
            var _chronoLabel = _sortChronoDesc ? '🕐 ↑' : '🕐 ↓';
            var _chronoNextMode = _sortChronoAsc ? 'chrono_desc' : 'chrono';
            var _sortBtns = `<div style="display:inline-flex;gap:2px;margin-left:auto;">
              <button onclick="var _sy=window.scrollY;window._enrollSortMode='${_alphaNextMode}';if(typeof renderTournaments==='function'){var c=document.getElementById('view-container');if(c)renderTournaments(c,'${t.id}');}setTimeout(function(){window.scrollTo(0,_sy);},50);" title="${_sortAlphaDesc ? 'Ordenar Z-A' : 'Ordenar A-Z'}" style="padding:3px 10px;border-radius:8px 0 0 8px;font-size:0.72rem;font-weight:700;cursor:pointer;border:1px solid ${_sortAlphaActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${_sortAlphaActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'};color:${_sortAlphaActive ? '#a5b4fc' : 'var(--text-muted)'};transition:all 0.2s;">${_alphaLabel}</button>
              <button onclick="var _sy=window.scrollY;window._enrollSortMode='${_chronoNextMode}';if(typeof renderTournaments==='function'){var c=document.getElementById('view-container');if(c)renderTournaments(c,'${t.id}');}setTimeout(function(){window.scrollTo(0,_sy);},50);" title="${_sortChronoDesc ? 'Últimos inscritos primeiro' : 'Primeiros inscritos primeiro'}" style="padding:3px 10px;border-radius:0 8px 8px 0;font-size:0.72rem;font-weight:700;cursor:pointer;border:1px solid ${_sortChronoActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};background:${_sortChronoActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'};color:${_sortChronoActive ? '#a5b4fc' : 'var(--text-muted)'};transition:all 0.2s;">${_chronoLabel}</button>
            </div>`;

            participantsHtml = `
              <div class="mt-5 mb-4">
                 <h3 style="margin-bottom: 1.5rem; font-size: 1.3rem; color: var(--text-bright); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 8px; flex-wrap:wrap;">
                    👥 Inscritos Confirmados <span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 3px 10px; border-radius: 12px; font-weight: 600; margin-left: 5px; color: var(--text-muted);">${individualCountParts}</span>
                    ${_sortBtns}
                 </h3>
                 ${checkInControls}
                 ${isOrg && drawDone ? '<div style="font-size:0.72rem;color:var(--text-muted);opacity:0.6;margin-bottom:8px;font-style:italic;">💡 Segure e arraste um nome sobre outro para mesclar participantes duplicados</div>' : ''}
                 <div data-merge-container="${t.id}" style="${gridStyle}">
                    ${cardsStr}
                 </div>
              </div>
          `;
        }

        // Check if tournament has bracket content for "Só meus jogos" toggle
        const _hasDrawContent = visible.length > 0 && (
          (Array.isArray(visible[0].matches) && visible[0].matches.length > 0) ||
          (Array.isArray(visible[0].rounds) && visible[0].rounds.length > 0) ||
          (Array.isArray(visible[0].groups) && visible[0].groups.length > 0)
        );
        const _cuUser = window.AppStore && window.AppStore.currentUser;
        const _myToggleHtml = _cuUser && _hasDrawContent ? `
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;" class="no-print">
            <span style="font-size:0.72rem;font-weight:600;color:var(--text-muted);white-space:nowrap;">Só meus jogos</span>
            <label class="toggle-switch toggle-sm" style="--toggle-on-bg:#f59e0b;--toggle-on-glow:rgba(245,158,11,0.3);--toggle-on-border:#f59e0b;">
              <input type="checkbox" id="my-matches-toggle" onchange="window._toggleMyMatches(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>` : '';

        // Group nav buttons for Fase de Grupos
        const _grpTour = visible[0];
        const _isGruposFmt = _grpTour && (_grpTour.format === 'Fase de Grupos + Eliminatórias');
        const _hasGrpNav = _isGruposFmt && _grpTour.groups && _grpTour.groups.length > 0 && _grpTour.currentStage !== 'elimination';
        const _grpColors = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];
        const _grpNavHtml = _hasGrpNav ? '<div style="display:flex;gap:5px;flex-wrap:nowrap;align-items:center;">' +
          _grpTour.groups.map(function(g, i) {
            var c = _grpColors[i % _grpColors.length];
            var letter = String.fromCharCode(65 + i);
            return '<button onclick="var el=document.getElementById(\'group-section-' + i + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'start\'});}" style="min-width:28px;height:28px;padding:0 8px;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;border:1.5px solid ' + c + ';background:' + c + '20;color:' + c + ';transition:all 0.15s;white-space:nowrap;line-height:1;" onmouseover="this.style.background=\'' + c + '40\'" onmouseout="this.style.background=\'' + c + '20\'">' + letter + '</button>';
          }).join('') + '</div>' : '';

        headerHtml = `
        <div class="sticky-back-header" style="padding-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;">
            <button class="btn btn-outline btn-sm hover-lift" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px;flex-shrink:0;" onclick="event.stopPropagation(); window.location.hash='#dashboard';">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
               Voltar
            </button>
            ${_grpNavHtml ? '<div style="flex:1;min-width:0;overflow-x:auto;">' + _grpNavHtml + '</div>' : '<div style="flex:1;"></div>'}
            ${_myToggleHtml}
          </div>
        </div>
      `;
    }

    // Se o torneio já tem chaveamento, ocultar inscritos (terá botão na tela de chaves)
    const hasDrawn = tournamentId && visible.length > 0 && (
      (Array.isArray(visible[0].matches) && visible[0].matches.length > 0) ||
      (Array.isArray(visible[0].rounds) && visible[0].rounds.length > 0) ||
      (Array.isArray(visible[0].groups) && visible[0].groups.length > 0)
    );

    // Poll banner for tournament detail view
    var pollBannerHtml = '';
    if (tournamentId && visible.length > 0 && window._renderPollBanner) {
        pollBannerHtml = window._renderPollBanner(visible[0]);
    }

    // Search/filter bar (only on list view, not detail)
    var filterBarHtml = '';
    if (!tournamentId && visible.length > 3) {
      filterBarHtml = `
        <div style="display:flex;gap:8px;margin-bottom:1.25rem;align-items:center;flex-wrap:wrap;">
          <input type="text" id="tourn-filter-input" class="form-control" placeholder="Filtrar por nome, esporte ou formato..." style="flex:1;min-width:180px;box-sizing:border-box;padding:8px 12px;font-size:0.85rem;">
          <select id="tourn-filter-status" class="form-control" style="width:auto;padding:8px 10px;font-size:0.85rem;background:var(--bg-darker);border:1px solid var(--border-color);cursor:pointer;">
            <option value="">Todos</option>
            <option value="open">Inscrições Abertas</option>
            <option value="active">Em Andamento</option>
            <option value="finished">Encerrados</option>
          </select>
        </div>
      `;
    }

    const html = `
    ${headerHtml}
    ${filterBarHtml}
    ${pollBannerHtml}

    <div class="tournaments-grid" id="tourn-grid-container" style="display: grid; grid-template-columns: ${tournamentId ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))'}; gap: 1.5rem;">
      ${gridHtml}
    </div>

    ${tournamentId ? _organizersHtml : ''}

    ${hasDrawn ? '' : participantsHtml}

    ${hasDrawn ? `
      <div class="mt-5">
         <h3 style="margin-bottom: 1.5rem; font-size: 1.3rem; color: var(--text-bright); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
            🎲 Chaveamento do Torneio
         </h3>
         <div id="inline-bracket-container"></div>
      </div>
    ` : ''}

    ${tournamentId ? `<div id="activity-log-section"></div>` : ''}
  `;
    container.innerHTML = html;

    // Setup filter bar handlers
    var _filterInput = document.getElementById('tourn-filter-input');
    var _filterStatus = document.getElementById('tourn-filter-status');
    if (_filterInput || _filterStatus) {
      var _allCards = document.querySelectorAll('#tourn-grid-container > div');
      var _applyFilter = function() {
        var q = (_filterInput ? _filterInput.value : '').toLowerCase().trim();
        var statusFilter = _filterStatus ? _filterStatus.value : '';
        _allCards.forEach(function(card) {
          var text = (card.textContent || '').toLowerCase();
          var matchesText = !q || text.indexOf(q) !== -1;
          var matchesStatus = true;
          if (statusFilter) {
            var hasInscAbertas = text.indexOf('inscrições abertas') !== -1 || text.indexOf('liga ativa') !== -1;
            var hasEmAndamento = text.indexOf('em andamento') !== -1;
            var hasEncerrado = text.indexOf('encerrado') !== -1;
            if (statusFilter === 'open') matchesStatus = hasInscAbertas;
            else if (statusFilter === 'active') matchesStatus = hasEmAndamento;
            else if (statusFilter === 'finished') matchesStatus = hasEncerrado;
          }
          card.style.display = (matchesText && matchesStatus) ? '' : 'none';
        });
      };
      if (_filterInput) {
        _filterInput.addEventListener('input', _applyFilter);
      }
      if (_filterStatus) {
        _filterStatus.addEventListener('change', _applyFilter);
      }
    }

    // Check category/poll notifications (only once per tournament view, not on re-render)
    if (tournamentId && !_checksRan) {
        var _nt = window.AppStore.tournaments.find(function(x) { return String(x.id) === String(tournamentId); });
        if (_nt && window._checkCategoryNotifications) {
            window._checkCategoryNotifications(_nt);
        }
        if (_nt && window._checkPollNotifications) {
            window._checkPollNotifications(_nt);
        }
    }

    // Init merge touch drag for mobile (after DOM is ready)
    if (tournamentId && typeof window._initMergeTouchDrag === 'function') {
        window._initMergeTouchDrag(tournamentId);
    }

    // Renderiza a chave de forma transparente associada a esse torneio
    if (hasDrawn && typeof renderBracket === 'function') {
        const inlineContainer = document.getElementById('inline-bracket-container');
        if (inlineContainer) {
            try {
                renderBracket(inlineContainer, tournamentId, true);
            } catch (inlineErr) {
                console.error('[InlineBracket] Error:', inlineErr);
                inlineContainer.innerHTML = '<div style="padding:1rem;color:#f87171;font-size:0.85rem;">Erro ao renderizar chaveamento: ' + window._safeHtml(String(inlineErr)) + '</div>';
            }
        }
    }

    // Build activity log
    if (tournamentId && typeof window._buildActivityLog === 'function') {
        window._buildActivityLog(tournamentId);
    }

    // Init venue map if lat/lng available
    if (tournamentId) {
        var _mapEl = document.getElementById('tournament-venue-map');
        if (_mapEl) {
            window._initTournamentVenueMap(_mapEl);
        }
    }

    // Auto-scroll to Edit button after Quick Create (item 5)
    if (tournamentId) {
      try {
        var _scrollFlag = sessionStorage.getItem('scoreplace_scroll_to_edit');
        if (_scrollFlag === '1') {
          sessionStorage.removeItem('scoreplace_scroll_to_edit');
          setTimeout(function() {
            var editBtn = container.querySelector('[onclick*="openEditModal"]');
            if (editBtn) {
              editBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Force show the org-edit-new hint after scroll completes
              setTimeout(function() {
                if (typeof window._forceShowHint === 'function') {
                  window._forceShowHint('org-edit-new');
                }
              }, 600);
            }
          }, 300);
        }
      } catch (e) {}
    }

    // --- Invited visitor: scroll to enrollment CTA and show hint ---
    if (tournamentId && !window.AppStore.currentUser) {
      var _isInvite = false;
      try {
        var _h = window.location.hash || '';
        _isInvite = _h.indexOf('ref=') !== -1 || !!sessionStorage.getItem('_inviteRefUid');
      } catch(e) {}
      // Scroll to CTA for any visitor viewing a tournament detail (invited or direct link)
      setTimeout(function() {
        var ctaEl = document.getElementById('visitor-enroll-cta') || document.getElementById('visitor-closed-cta');
        if (ctaEl) {
          ctaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Pulse animation to draw attention
          ctaEl.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
          setTimeout(function() {
            ctaEl.style.transform = 'scale(1.03)';
            ctaEl.style.boxShadow = '0 0 20px rgba(16,185,129,0.4)';
            setTimeout(function() {
              ctaEl.style.transform = '';
              ctaEl.style.boxShadow = '';
            }, 600);
          }, 400);
        }
      }, 500);
    }
}
