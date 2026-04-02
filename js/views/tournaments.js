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
                    if (t) {
                        t.status = 'closed';
                        // Salvar no Firestore e só navegar após confirmação
                        if (window.FirestoreDB && typeof window.FirestoreDB.saveTournament === 'function') {
                            window.FirestoreDB.saveTournament(t).then(function() {
                                window.location.hash = '#pre-draw/' + tId;
                            }).catch(function() {
                                window.AppStore.sync();
                                window.location.hash = '#pre-draw/' + tId;
                            });
                        } else {
                            window.AppStore.sync();
                            window.location.hash = '#pre-draw/' + tId;
                        }
                    }
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
                        return str && profile.email && str.indexOf(profile.email) !== -1;
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
                            message: (cu.displayName || 'Um amigo') + ' convidou você para o torneio "' + (t.name || '') + '"!',
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

    // ─── Invite fallback card — shown when tournament can't be loaded yet ─────
    window._renderInviteFallbackCard = function(container, tId) {
        var isLoggedIn = !!(window.AppStore && window.AppStore.currentUser);
        if (isLoggedIn) {
            // Logged-in user, tournament not loaded yet — show loading with retry
            container.innerHTML = '<div style="max-width:500px;width:100%;margin:2rem auto;text-align:center;padding:2rem;box-sizing:border-box;">' +
                '<div style="font-size:3rem;margin-bottom:1rem;">\u{1F3C6}</div>' +
                '<h2 style="color:var(--text-bright);margin-bottom:0.5rem;">Carregando torneio...</h2>' +
                '<p style="color:var(--text-muted);margin-bottom:1.5rem;">Aguarde enquanto carregamos os dados do torneio.</p>' +
                '<button class="btn hover-lift" onclick="window.location.hash=\'#dashboard\'" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);font-weight:600;font-size:0.9rem;padding:10px 24px;border-radius:10px;">Voltar ao Início</button></div>';
        } else {
            // Not logged in — login opens automatically, show friendly message
            container.innerHTML = '<div style="max-width:500px;width:100%;margin:2rem auto;text-align:center;padding:2rem;box-sizing:border-box;">' +
                '<div style="font-size:3rem;margin-bottom:1rem;">\u{1F3C6}</div>' +
                '<h2 style="color:var(--text-bright);margin-bottom:0.5rem;">Voc\u00EA foi convidado para um torneio!</h2>' +
                '<p style="color:var(--text-muted);margin-bottom:1.5rem;">Fa\u00E7a login para ser inscrito automaticamente.</p>' +
                '<button class="btn hover-lift" onclick="if(typeof openModal===\'function\')openModal(\'modal-login\')" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;font-weight:800;font-size:1.15rem;padding:16px 48px;border-radius:14px;box-shadow:0 6px 24px rgba(16,185,129,0.45);letter-spacing:0.5px;display:inline-flex;align-items:center;gap:10px;">' +
                '\u{1F511} Fazer Login</button></div>';
        }
    };

    // ========== Category enrollment helpers ==========
    // Maps user gender to tournament gender category codes
    window._userGenderToCatCodes = function(userGender) {
        if (!userGender) return [];
        var g = userGender.toLowerCase().trim();
        var codes = [];
        if (g === 'feminino' || g === 'female' || g === 'fem' || g === 'f') {
            codes.push('fem', 'misto_aleatorio', 'misto_obrigatorio');
        } else if (g === 'masculino' || g === 'male' || g === 'masc' || g === 'm') {
            codes.push('masc', 'misto_aleatorio', 'misto_obrigatorio');
        } else {
            // Non-binary or other — eligible for misto categories
            codes.push('misto_aleatorio', 'misto_obrigatorio');
        }
        return codes;
    };

    // Normalize format: 'Ranking' → 'Liga' (unificado em v0.2.6)
    window._isLigaFormat = function(t) {
      return t && (t.format === 'Liga' || t.format === 'Ranking');
    };

    // Get participant categories as array (backward compat: string → [string])
    window._getParticipantCategories = function(p) {
        if (!p || typeof p !== 'object') return [];
        if (Array.isArray(p.categories) && p.categories.length > 0) return p.categories;
        if (p.category) return [p.category];
        return [];
    };

    // Check if participant belongs to a specific category
    window._participantInCategory = function(p, cat) {
        return window._getParticipantCategories(p).indexOf(cat) !== -1;
    };

    // Set participant categories (writes both .categories array and .category for compat)
    window._setParticipantCategories = function(p, cats) {
        if (!p || typeof p !== 'object') return;
        p.categories = Array.isArray(cats) ? cats : [cats];
        p.category = p.categories[0] || '';
    };

    // Add a category to a participant (for non-exclusive enrollment)
    window._addParticipantCategory = function(p, cat) {
        var current = window._getParticipantCategories(p);
        if (current.indexOf(cat) === -1) current.push(cat);
        window._setParticipantCategories(p, current);
    };

    // Display name for categories: simplifies "Misto Aleat." and "Misto Obrig." to just "Misto"
    // Full name only appears in rules, tournament card, and detail info.
    window._displayCategoryName = function(cat) {
        if (!cat) return '';
        // "Misto Aleat. A" → "Misto A", "Misto Obrig. B" → "Misto B", "Misto Aleat." → "Misto"
        return cat.replace(/^Misto Aleat\.\s*/i, 'Misto ').replace(/^Misto Obrig\.\s*/i, 'Misto ').trim();
    };

    // Sort categories respecting the skill order defined by the organizer.
    // E.g., if skillCategories = ['A','B','C','D'], then:
    //   "Fem A" < "Fem B" < "Fem C/D" < "Masc A" < "Masc A/B" < "Masc C"
    // Merged categories like "A/B" sort by their earliest component.
    // Gender prefix order: Fem, Masc, Misto Aleat., Misto Obrig.
    window._sortCategoriesBySkillOrder = function(categories, skillCats) {
        if (!categories || categories.length <= 1) return categories;
        if (!skillCats || skillCats.length === 0) return categories;

        var genderOrder = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.'];
        var skillOrder = {};
        skillCats.forEach(function(sc, i) { skillOrder[sc.trim()] = i; });

        function getCatSortKey(cat) {
            // Determine gender prefix index
            var genderIdx = genderOrder.length; // default: after all known prefixes
            var suffix = cat;
            for (var g = 0; g < genderOrder.length; g++) {
                if (cat.toLowerCase().startsWith(genderOrder[g].toLowerCase())) {
                    genderIdx = g;
                    suffix = cat.substring(genderOrder[g].length).trim();
                    break;
                }
            }
            // Determine skill index from the suffix (possibly merged like "A/B")
            // Use the earliest (lowest-index) component
            var skillIdx = 9999;
            if (suffix === '') {
                // Bare prefix (all skills merged) — sort at position 0 within this gender
                skillIdx = -1;
            } else {
                var parts = suffix.split('/');
                parts.forEach(function(s) {
                    var trimmed = s.trim();
                    if (skillOrder.hasOwnProperty(trimmed) && skillOrder[trimmed] < skillIdx) {
                        skillIdx = skillOrder[trimmed];
                    }
                });
            }
            return { gender: genderIdx, skill: skillIdx };
        }

        return categories.slice().sort(function(a, b) {
            var ka = getCatSortKey(a);
            var kb = getCatSortKey(b);
            if (ka.gender !== kb.gender) return ka.gender - kb.gender;
            return ka.skill - kb.skill;
        });
    };

    // Build HTML for category count boxes grouped by gender prefix.
    // Shows small boxes next to the total inscritos box: "Fem A (3) | Fem B (5) | Masc A (2) ..."
    // Each gender prefix gets its own row. Uses _displayCategoryName for Misto simplification.
    window._buildCategoryCountHtml = function(t) {
        var cats = t.combinedCategories;
        if (!cats || cats.length === 0) return '';
        var sorted = window._sortCategoriesBySkillOrder(cats, t.skillCategories);
        var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

        // Count per category
        var counts = {};
        sorted.forEach(function(c) { counts[c] = 0; });
        parts.forEach(function(p) {
            if (typeof p !== 'object' && typeof p !== 'string') return;
            var pCats = window._getParticipantCategories(p);
            pCats.forEach(function(pc) {
                if (counts.hasOwnProperty(pc)) counts[pc]++;
            });
        });

        // Group by gender prefix for row layout
        var genderPrefixes = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.'];
        var rows = []; // { displayPrefix, cats: [{name, display, count}] }
        var used = {};
        genderPrefixes.forEach(function(gp) {
            var rowCats = [];
            sorted.forEach(function(c) {
                if (used[c]) return;
                if (c.toLowerCase().startsWith(gp.toLowerCase())) {
                    rowCats.push({ name: c, display: window._displayCategoryName(c), count: counts[c] || 0 });
                    used[c] = true;
                }
            });
            if (rowCats.length > 0) {
                var displayPrefix = gp.replace(/\s*Aleat\./, '').replace(/\s*Obrig\./, '');
                // Merge Misto rows if both exist
                var existingMisto = null;
                for (var r = 0; r < rows.length; r++) {
                    if (rows[r].displayPrefix === 'Misto') { existingMisto = rows[r]; break; }
                }
                if (displayPrefix === 'Misto' && existingMisto) {
                    existingMisto.cats = existingMisto.cats.concat(rowCats);
                } else {
                    rows.push({ displayPrefix: displayPrefix, cats: rowCats });
                }
            }
        });
        // Any ungrouped
        sorted.forEach(function(c) {
            if (!used[c]) {
                rows.push({ displayPrefix: '', cats: [{ name: c, display: c, count: counts[c] || 0 }] });
                used[c] = true;
            }
        });

        if (rows.length === 0) return '';

        var html = '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">';
        rows.forEach(function(row) {
            html += '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">';
            row.cats.forEach(function(cat) {
                html += '<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);padding:3px 8px;border-radius:10px;">' +
                    '<span style="font-size:0.65rem;font-weight:600;color:#818cf8;">' + cat.display + '</span>' +
                    '<span style="font-size:0.75rem;font-weight:800;color:var(--text-bright,#e2e8f0);">' + cat.count + '</span>' +
                    '</div>';
            });
            html += '</div>';
        });
        html += '</div>';
        return html;
    };

    // ── Estimativa de Duração do Torneio ──────────────────────────────────────
    // Mostra quando endDate não está preenchido. Simula para potências de 2 e inscritos reais.
    window._buildTimeEstimation = function(t) {
      // Só mostra se NÃO tem data/hora de fim
      if (t.endDate) return '';

      var format = t.format || 'Eliminatórias';
      var gameDur = parseInt(t.gameDuration) || 30; // minutos por partida
      var callTime = parseInt(t.callTime) || 0;
      var warmupTime = parseInt(t.warmupTime) || 0;
      var courts = Math.max(parseInt(t.courtCount) || 1, 1);
      var slotTime = gameDur + callTime + warmupTime; // tempo total por slot (partida + chamada + aquecimento)
      var intervalBetween = 5; // intervalo entre slots no mesmo court (min)
      var timePerSlot = slotTime + intervalBetween;

      // Número de partidas por formato
      function calcMatches(n, fmt) {
        if (fmt === 'Eliminatórias' || fmt === 'Eliminatórias Simples') {
          return n - 1; // single elim (sem 3o lugar)
        } else if (fmt === 'Dupla Elim.' || fmt === 'Dupla Eliminatória') {
          // Upper bracket: n-1, Lower bracket: ~n-1, Grand final: 1-2
          return Math.ceil(n * 2 - 1);
        } else if (fmt === 'Grupos + Elim.' || fmt === 'Fase de Grupos + Eliminatórias') {
          // Grupos (round robin dentro dos grupos) + mata-mata dos classificados
          var groupSize = 4;
          var numGroups = Math.max(Math.ceil(n / groupSize), 1);
          var perGroup = Math.ceil(n / numGroups);
          var groupMatches = numGroups * (perGroup * (perGroup - 1) / 2);
          var qualified = numGroups * 2; // top 2 de cada grupo
          var elimMatches = Math.max(qualified - 1, 0);
          return Math.round(groupMatches + elimMatches);
        } else if (fmt === 'Suíço' || fmt === 'Suíço Clássico') {
          var rounds = Math.ceil(Math.log2(Math.max(n, 2)));
          return rounds * Math.floor(n / 2);
        } else if (fmt === 'Liga' || fmt === 'Ranking' || window._isLigaFormat && window._isLigaFormat(t)) {
          return n * (n - 1) / 2;
        }
        return n - 1; // fallback
      }

      // Estimar duração em minutos considerando quadras paralelas
      function estimateDuration(n, fmt) {
        if (n < 2) return 0;
        var totalMatches = calcMatches(n, fmt);

        // Para eliminatórias, calcular por rodadas (mais realista)
        if (fmt === 'Eliminatórias' || fmt === 'Eliminatórias Simples') {
          var rounds = Math.ceil(Math.log2(n));
          var totalMin = 0;
          for (var r = 0; r < rounds; r++) {
            var matchesInRound = Math.ceil(n / Math.pow(2, r + 1));
            var slotsNeeded = Math.ceil(matchesInRound / courts);
            totalMin += slotsNeeded * timePerSlot;
          }
          return totalMin;
        }

        if (fmt === 'Dupla Elim.' || fmt === 'Dupla Eliminatória') {
          // Aproximação: ~2x da simples
          var roundsDE = Math.ceil(Math.log2(n)) * 2 + 1;
          var avgPerRound = Math.ceil(totalMatches / roundsDE);
          var totalMinDE = 0;
          for (var rd = 0; rd < roundsDE; rd++) {
            totalMinDE += Math.ceil(avgPerRound / courts) * timePerSlot;
          }
          return totalMinDE;
        }

        if (fmt === 'Grupos + Elim.' || fmt === 'Fase de Grupos + Eliminatórias') {
          var gSize = 4;
          var nGroups = Math.max(Math.ceil(n / gSize), 1);
          var pGroup = Math.ceil(n / nGroups);
          // Fase de grupos: rodadas round-robin dentro do grupo
          var groupRounds = pGroup - 1;
          var matchesPerGroupRound = Math.floor(pGroup / 2) * nGroups;
          var groupMin = 0;
          for (var gr = 0; gr < groupRounds; gr++) {
            groupMin += Math.ceil(matchesPerGroupRound / courts) * timePerSlot;
          }
          // Fase eliminatória
          var qual = nGroups * 2;
          var elimRounds = Math.ceil(Math.log2(Math.max(qual, 2)));
          var elimMin = 0;
          for (var er = 0; er < elimRounds; er++) {
            var mInR = Math.ceil(qual / Math.pow(2, er + 1));
            elimMin += Math.ceil(mInR / courts) * timePerSlot;
          }
          return groupMin + elimMin + 15; // +15 intervalo entre fases
        }

        if (fmt === 'Suíço' || fmt === 'Suíço Clássico') {
          var swissRounds = Math.ceil(Math.log2(Math.max(n, 2)));
          var matchesPerRound = Math.floor(n / 2);
          var totalMinS = 0;
          for (var sr = 0; sr < swissRounds; sr++) {
            totalMinS += Math.ceil(matchesPerRound / courts) * timePerSlot;
          }
          return totalMinS;
        }

        // Liga/fallback: todas as partidas sequenciais com quadras paralelas
        var slots = Math.ceil(totalMatches / courts);
        return slots * timePerSlot;
      }

      // Formatar duração em horas e minutos
      function fmtDur(min) {
        if (min <= 0) return '—';
        var h = Math.floor(min / 60);
        var m = Math.round(min % 60);
        if (h === 0) return m + 'min';
        if (m === 0) return h + 'h';
        return h + 'h' + (m < 10 ? '0' : '') + m;
      }

      // Formatar hora de término estimada
      function fmtEndTime(startDateStr, durationMin) {
        if (!startDateStr) return '';
        try {
          var d = new Date(startDateStr);
          if (isNaN(d.getTime())) return '';
          // Só mostra se tem hora definida (contém 'T')
          if (!startDateStr.includes('T')) return '';
          d.setMinutes(d.getMinutes() + durationMin);
          return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
      }

      // Potências de 2 para simulação
      var powersOf2 = [8, 16, 32, 64];

      // Inscritos reais
      var parts = Array.isArray(t.participants) ? t.participants : (t.participants ? Object.values(t.participants) : []);
      var realCount = parts.length;

      // Verificar se formato é Liga com muitos jogadores (seria longo demais)
      var isLiga = window._isLigaFormat && window._isLigaFormat(t);
      if (isLiga && realCount > 20) {
        // Liga com muitos jogadores: muitas rodadas, estimativa perde sentido prático
        // Só mostra nota informativa
      }

      // Construir linhas de simulação
      var rows = [];

      // Linha com inscritos reais (se houver 2+)
      if (realCount >= 2) {
        var durReal = estimateDuration(realCount, format);
        var endTimeReal = fmtEndTime(t.startDate, durReal);
        rows.push({
          label: realCount + ' inscritos',
          duration: fmtDur(durReal),
          endTime: endTimeReal,
          matches: calcMatches(realCount, format),
          highlight: true
        });
      }

      // Linhas para potências de 2
      powersOf2.forEach(function(n) {
        if (n === realCount) return; // já mostrado acima
        var dur = estimateDuration(n, format);
        var endTime = fmtEndTime(t.startDate, dur);
        rows.push({
          label: n + ' participantes',
          duration: fmtDur(dur),
          endTime: endTime,
          matches: calcMatches(n, format),
          highlight: false
        });
      });

      if (rows.length === 0) return '';

      // Montar HTML
      var courtsLabel = courts > 1 ? courts + ' quadras' : '1 quadra';
      var html = '<div style="margin-top: 8px; padding: 10px 14px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 12px;">';
      html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">';
      html += '<span style="font-size:1.1rem;">⏱️</span>';
      html += '<span style="font-size:0.8rem; font-weight:700; color:#a5b4fc; text-transform:uppercase; letter-spacing:0.5px;">Duração Estimada</span>';
      html += '<span style="font-size:0.65rem; color:var(--text-muted); opacity:0.7;">(' + gameDur + 'min/partida · ' + courtsLabel + ')</span>';
      html += '</div>';

      html += '<div style="display:flex; flex-direction:column; gap:4px;">';
      rows.forEach(function(r) {
        var bg = r.highlight ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)';
        var border = r.highlight ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.05)';
        var labelColor = r.highlight ? '#60a5fa' : 'var(--text-muted)';
        var durColor = r.highlight ? '#e2e8f0' : 'rgba(255,255,255,0.7)';
        html += '<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:' + bg + '; border:' + border + '; border-radius:8px; flex-wrap:wrap;">';
        html += '<span style="font-size:0.78rem; font-weight:600; color:' + labelColor + '; min-width:110px;">' + r.label + '</span>';
        html += '<span style="font-size:0.78rem; color:var(--text-muted); opacity:0.6;">' + r.matches + ' partidas</span>';
        html += '<span style="font-size:0.85rem; font-weight:700; color:' + durColor + '; margin-left:auto;">' + r.duration + '</span>';
        if (r.endTime) {
          html += '<span style="font-size:0.72rem; color:#a5b4fc; opacity:0.8;">término ~' + r.endTime + '</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
      return html;
    };

    // Exclusivity rules: Fem and Masc are mutually exclusive.
    // Misto (Aleatório/Obrigatório) is non-exclusive with Fem and Masc.
    // A participant can be in Masc A AND Misto Aleat. A, but NOT in Fem A AND Masc A.
    window._exclusiveGenderPrefixes = ['Fem', 'Masc']; // These cannot coexist
    window._nonExclusivePrefixes = ['Misto Aleat.', 'Misto Obrig.']; // These can combine with any

    window._getCategoryGenderPrefix = function(cat) {
        var prefixes = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.'];
        for (var i = 0; i < prefixes.length; i++) {
            if (cat.toLowerCase().startsWith(prefixes[i].toLowerCase())) return prefixes[i];
        }
        return '';
    };

    // Check if two categories are exclusive (can't both be selected)
    window._areCategoriesExclusive = function(catA, catB) {
        var prefA = window._getCategoryGenderPrefix(catA);
        var prefB = window._getCategoryGenderPrefix(catB);
        // Both must be in the exclusive group and different
        var excl = window._exclusiveGenderPrefixes;
        return prefA !== prefB && excl.indexOf(prefA) !== -1 && excl.indexOf(prefB) !== -1;
    };

    // Given eligible categories, group into exclusive (pick one) and non-exclusive (can add)
    window._groupEligibleCategories = function(eligibleCats) {
        var exclusive = [];
        var nonExclusive = [];
        var nonExclPrefixes = window._nonExclusivePrefixes;
        eligibleCats.forEach(function(cat) {
            var prefix = window._getCategoryGenderPrefix(cat);
            var isNonExcl = nonExclPrefixes.some(function(np) {
                return prefix.toLowerCase() === np.toLowerCase();
            });
            if (isNonExcl) {
                nonExclusive.push(cat);
            } else {
                exclusive.push(cat);
            }
        });
        return { exclusive: exclusive, nonExclusive: nonExclusive };
    };

    // Resolves enrollment categories for a tournament.
    // callback receives an array of selected categories, or null if no categories.
    // Exclusive categories (Fem/Masc) — user picks one.
    // Non-exclusive (Misto) — user can also add these alongside the exclusive pick.
    window._resolveEnrollmentCategory = function(tId, callback) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t) { callback(null); return; }

        var combined = t.combinedCategories || [];
        var genderCats = t.genderCategories || [];
        var skillCats = t.skillCategories || [];
        if (combined.length === 0 && genderCats.length === 0 && skillCats.length === 0) {
            callback(null); return;
        }

        var user = window.AppStore.currentUser;
        var userGender = user ? user.gender : '';
        var eligibleGenderCodes = window._userGenderToCatCodes(userGender);
        var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto Aleat.', misto_obrigatorio: 'Misto Obrig.' };

        // Build list of eligible combined categories
        var eligible = [];
        if (combined.length > 0) {
            if (userGender && genderCats.length > 0) {
                combined.forEach(function(c) {
                    var matchesGender = eligibleGenderCodes.some(function(gc) {
                        return c.toLowerCase().startsWith((genderLabels[gc] || gc).toLowerCase());
                    });
                    if (matchesGender) eligible.push(c);
                });
            } else if (genderCats.length === 0) {
                eligible = combined.slice();
            } else {
                eligible = combined.slice();
            }
        } else if (genderCats.length > 0 && skillCats.length === 0) {
            if (userGender) {
                genderCats.forEach(function(gc) {
                    if (eligibleGenderCodes.indexOf(gc) !== -1) eligible.push(genderLabels[gc] || gc);
                });
            } else {
                genderCats.forEach(function(gc) { eligible.push(genderLabels[gc] || gc); });
            }
        } else if (skillCats.length > 0 && genderCats.length === 0) {
            eligible = skillCats.slice();
        }

        if (eligible.length === 0) { callback(null); return; }

        // Sort eligible categories by skill order
        eligible = window._sortCategoriesBySkillOrder(eligible, skillCats);

        // Group into exclusive (Fem/Masc — pick one) and non-exclusive (Misto — can add)
        var groups = window._groupEligibleCategories(eligible);

        // If exactly one exclusive and zero non-exclusive → auto-select
        if (groups.exclusive.length <= 1 && groups.nonExclusive.length === 0) {
            var single = groups.exclusive[0] || null;
            if (single) {
                showAlertDialog('Confirmar Categoria', 'Você será inscrito na categoria: <strong>' + window._displayCategoryName(single) + '</strong>. Confirmar?', function() {
                    callback([single]);
                }, { type: 'info', confirmText: 'Confirmar', cancelText: 'Cancelar', showCancel: true });
            } else {
                callback(null);
            }
            return;
        }

        // If zero exclusive and one non-exclusive → auto-select
        if (groups.exclusive.length === 0 && groups.nonExclusive.length === 1) {
            showAlertDialog('Confirmar Categoria', 'Você será inscrito na categoria: <strong>' + window._displayCategoryName(groups.nonExclusive[0]) + '</strong>. Confirmar?', function() {
                callback([groups.nonExclusive[0]]);
            }, { type: 'info', confirmText: 'Confirmar', cancelText: 'Cancelar', showCancel: true });
            return;
        }

        // Multiple options → show selection modal with exclusive (radio) + non-exclusive (checkboxes)
        var modalId = 'cat-enroll-modal-' + tId;
        var existing = document.getElementById(modalId);
        if (existing) existing.remove();

        // Build exclusive section (radio buttons — pick one)
        var exclHtml = '';
        if (groups.exclusive.length > 0) {
            exclHtml = '<div style="margin-bottom:12px;">' +
                '<div style="font-weight:600;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Categoria principal (escolha uma):</div>' +
                groups.exclusive.map(function(cat, i) {
                    var catSafe = cat.replace(/"/g, '&quot;');
                    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);margin-bottom:6px;cursor:pointer;" onclick="this.querySelector(\'input\').checked=true;">' +
                        '<input type="radio" name="cat-excl" value="' + catSafe + '" ' + (i === 0 ? 'checked' : '') + ' style="accent-color:#818cf8;width:18px;height:18px;cursor:pointer;">' +
                        '<span style="font-weight:600;font-size:0.9rem;color:var(--text-bright);">' + window._displayCategoryName(cat) + '</span></label>';
                }).join('') +
                '</div>';
        }

        // Build non-exclusive section (checkboxes — can select multiple)
        var nonExclHtml = '';
        if (groups.nonExclusive.length > 0) {
            nonExclHtml = '<div style="margin-bottom:12px;">' +
                '<div style="font-weight:600;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Categorias adicionais (opcional):</div>' +
                '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Você pode participar destas categorias junto com a principal.</div>' +
                groups.nonExclusive.map(function(cat) {
                    var catSafe = cat.replace(/"/g, '&quot;');
                    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);margin-bottom:6px;cursor:pointer;" onclick="var cb=this.querySelector(\'input\');if(event.target!==cb)cb.checked=!cb.checked;">' +
                        '<input type="checkbox" name="cat-nonexcl" value="' + catSafe + '" style="accent-color:#10b981;width:18px;height:18px;cursor:pointer;">' +
                        '<span style="font-weight:600;font-size:0.9rem;color:var(--text-bright);">' + window._displayCategoryName(cat) + '</span></label>';
                }).join('') +
                '</div>';
        }

        // If no exclusive but multiple non-exclusive → all are checkboxes
        if (groups.exclusive.length === 0 && groups.nonExclusive.length > 1) {
            nonExclHtml = '<div style="margin-bottom:12px;">' +
                '<div style="font-weight:600;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Selecione suas categorias:</div>' +
                groups.nonExclusive.map(function(cat) {
                    var catSafe = cat.replace(/"/g, '&quot;');
                    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);margin-bottom:6px;cursor:pointer;" onclick="var cb=this.querySelector(\'input\');if(event.target!==cb)cb.checked=!cb.checked;">' +
                        '<input type="checkbox" name="cat-nonexcl" value="' + catSafe + '" style="accent-color:#10b981;width:18px;height:18px;cursor:pointer;">' +
                        '<span style="font-weight:600;font-size:0.9rem;color:var(--text-bright);">' + window._displayCategoryName(cat) + '</span></label>';
                }).join('') +
                '</div>';
        }

        var confirmBtnId = 'cat-enroll-confirm-' + tId;
        var modalHtml = '<div id="' + modalId + '" style="display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:10000;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 0;" onclick="event.stopPropagation();">' +
            '<div style="background:var(--bg-card);width:90%;max-width:420px;border-radius:16px;border:1px solid var(--border-color);box-shadow:0 20px 40px rgba(0,0,0,0.4);margin:auto;animation:fadeIn 0.2s ease;">' +
            '<div style="padding:1.5rem;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="margin:0;font-size:1.2rem;color:var(--text-bright);">🏷️ Escolha suas Categorias</h3>' +
            '<button style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;" onclick="event.stopPropagation();document.getElementById(\'' + modalId + '\').remove();">&times;</button>' +
            '</div>' +
            '<div style="padding:1.5rem;color:var(--text-main);font-size:0.9rem;">' +
            exclHtml + nonExclHtml +
            '<button id="' + confirmBtnId + '" class="btn hover-lift" style="width:100%;background:linear-gradient(135deg,#6366f1,#818cf8);color:white;border:none;padding:12px;border-radius:12px;font-weight:700;font-size:0.95rem;cursor:pointer;margin-top:8px;">Confirmar Inscrição</button>' +
            '</div></div></div>';

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Attach confirm handler
        setTimeout(function() {
            var btn = document.getElementById(confirmBtnId);
            if (!btn) return;
            btn.addEventListener('click', function() {
                var selected = [];
                // Get exclusive selection (radio)
                var exclRadio = document.querySelector('#' + modalId + ' input[name="cat-excl"]:checked');
                if (exclRadio) selected.push(exclRadio.value);
                // Get non-exclusive selections (checkboxes)
                var nonExclChecks = document.querySelectorAll('#' + modalId + ' input[name="cat-nonexcl"]:checked');
                nonExclChecks.forEach(function(cb) { selected.push(cb.value); });

                if (selected.length === 0) {
                    if (typeof showNotification === 'function') showNotification('Atenção', 'Selecione ao menos uma categoria.', 'warning');
                    return;
                }
                document.getElementById(modalId).remove();
                callback(selected);
            });
        }, 50);
    };

    // ========== Category Manager (Organizer) ==========
    window._openCategoryManager = function(tId) {
        var modalId = 'cat-manager-modal';
        var existing = document.getElementById(modalId);
        if (existing) existing.remove();

        // ---- Main view: category overview ----
        var _renderModal = function() {
            // Always re-read fresh data from AppStore (fixes stale closure after sync)
            var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
            if (!t) return;
            var categories = window._sortCategoriesBySkillOrder((t.combinedCategories || []).slice(), t.skillCategories);
            var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

            // Count participants per category & find uncategorized
            // A participant can belong to multiple categories (non-exclusive)
            var catCounts = {};
            categories.forEach(function(c) { catCounts[c] = 0; });
            var uncategorized = [];
            parts.forEach(function(p, idx) {
                var pName = typeof p === 'string' ? p : (p.displayName || p.name || '');
                var pCats = window._getParticipantCategories(p);
                var hasValidCat = false;
                pCats.forEach(function(pc) {
                    if (categories.indexOf(pc) !== -1) {
                        catCounts[pc] = (catCounts[pc] || 0) + 1;
                        hasValidCat = true;
                    }
                });
                if (!hasValidCat) {
                    uncategorized.push({ name: pName, idx: idx });
                }
            });

            // Group categories by gender prefix for row layout
            var genderPrefixes = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.'];
            var catRows = []; // Array of { prefix, cats: [cat names] }
            var usedCats = {};
            genderPrefixes.forEach(function(prefix) {
                var rowCats = categories.filter(function(c) {
                    return c.toLowerCase().startsWith(prefix.toLowerCase());
                });
                if (rowCats.length > 0) {
                    catRows.push({ prefix: prefix, cats: rowCats });
                    rowCats.forEach(function(c) { usedCats[c] = true; });
                }
            });
            // Any categories that don't match a gender prefix go in their own row
            var otherCats = categories.filter(function(c) { return !usedCats[c]; });
            if (otherCats.length > 0) {
                catRows.push({ prefix: '', cats: otherCats });
            }

            // Determine which categories are merged:
            // 1. Has mergeHistory entry
            // 2. Name contains "/" (e.g., "Fem A/B")
            // 3. Name is a bare gender prefix when skill categories exist (e.g., "Masc" when skillCats has A,B,C,D)
            var mergedCatSet = {};
            (t.mergeHistory || []).forEach(function(mh) {
                mergedCatSet[mh.mergedName] = true;
            });
            var _skillCats = t.skillCategories || [];
            var _genderPrefixList = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.'];
            categories.forEach(function(cat) {
                if (mergedCatSet[cat]) return; // already marked
                // Contains "/" → result of a merge
                if (cat.indexOf('/') !== -1) {
                    mergedCatSet[cat] = true;
                    return;
                }
                // Bare prefix when skill categories exist → all skills were merged
                if (_skillCats.length > 0) {
                    var isBarePrefix = _genderPrefixList.some(function(gp) {
                        return cat === gp;
                    });
                    if (isBarePrefix) {
                        mergedCatSet[cat] = true;
                    }
                }
            });

            // Build category rows HTML — compact cards, clickable to see detail
            var catRowsHtml = catRows.map(function(row) {
                var cardsHtml = row.cats.map(function(cat) {
                    var count = catCounts[cat] || 0;
                    var catEsc = cat.replace(/"/g, '&quot;').replace(/'/g, "\\'");
                    var catDisplay = window._displayCategoryName(cat);
                    var isMerged = !!mergedCatSet[cat];
                    // Unmerge icon — small split icon in top-right corner, only for merged categories
                    var unmergeIcon = isMerged
                        ? '<div class="cat-unmerge-btn" data-unmerge-cat="' + cat.replace(/"/g, '&quot;') + '" title="Desmesclar" style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;z-index:2;" onmouseenter="this.style.background=\'rgba(239,68,68,0.35)\'" onmouseleave="this.style.background=\'rgba(239,68,68,0.15)\'">' +
                          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"><path d="M16 3h5v5M8 3H3v5M16 21h5v-5M8 21H3v-5"/></svg>' +
                          '</div>'
                        : '';
                    return '<div class="cat-mgr-card" draggable="true" data-cat="' + cat.replace(/"/g, '&quot;') + '" ' +
                        'style="position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 14px;border-radius:12px;background:rgba(99,102,241,0.08);border:2px solid rgba(99,102,241,0.2);cursor:pointer;transition:all 0.2s;min-width:80px;">' +
                        unmergeIcon +
                        '<div style="font-weight:700;font-size:0.8rem;color:#818cf8;white-space:nowrap;">' + catDisplay + '</div>' +
                        '<div style="font-size:1.4rem;font-weight:900;color:var(--text-bright);line-height:1.2;">' + count + '</div>' +
                        '<div style="font-size:0.65rem;color:var(--text-muted);">inscrito' + (count !== 1 ? 's' : '') + '</div>' +
                        '</div>';
                }).join('');
                return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' + cardsHtml + '</div>';
            }).join('');

            // Uncategorized participants HTML — below categories
            var uncatHtml = '';
            if (uncategorized.length > 0) {
                var uncatCards = uncategorized.map(function(u) {
                    return '<div class="cat-mgr-participant" draggable="true" data-pidx="' + u.idx + '" ' +
                        'style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);cursor:grab;font-size:0.85rem;font-weight:500;color:#fca5a5;touch-action:none;">' +
                        '<span style="font-size:0.7rem;">👤</span> ' + (u.name || 'Sem nome') +
                        '</div>';
                }).join('');
                uncatHtml = '<div style="margin-top:1rem;padding:1rem;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:12px;">' +
                    '<div style="font-weight:700;color:#fca5a5;font-size:0.85rem;margin-bottom:8px;">⚠️ Sem Categoria (' + uncategorized.length + ')</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;">Arraste para uma categoria acima para atribuir.</div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + uncatCards + '</div>' +
                    '</div>';
            }

            var modalHtml = '<div id="' + modalId + '" style="display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);z-index:10001;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;" onclick="event.stopPropagation();">' +
                '<div style="background:var(--bg-card);width:95%;max-width:600px;border-radius:18px;border:1px solid var(--border-color);box-shadow:0 24px 48px rgba(0,0,0,0.5);margin:auto;animation:fadeIn 0.2s ease;">' +
                '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">' +
                '<h3 style="margin:0;font-size:1.15rem;color:var(--text-bright);">🏷️ Gerenciar Categorias</h3>' +
                '<button style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;line-height:1;" onclick="document.getElementById(\'' + modalId + '\').remove();">&times;</button>' +
                '</div>' +
                '<div style="padding:10px 1.5rem 0;">' +
                '<button class="btn btn-sm hover-lift" style="background:rgba(255,255,255,0.05);color:var(--text-bright);border:1px solid rgba(255,255,255,0.1);display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-weight:500;font-size:0.8rem;cursor:pointer;" onclick="document.getElementById(\'' + modalId + '\').remove();"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Voltar</button>' +
                '</div>' +
                '<div style="padding:0 1.5rem 1.5rem;">' +
                '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem;">Arraste uma categoria sobre outra para mesclar. Arraste participantes sem categoria para atribuí-los.</div>' +
                '<div id="cat-mgr-cards">' + catRowsHtml + '</div>' +
                uncatHtml +
                '</div>' +
                '</div></div>';

            var el = document.getElementById(modalId);
            if (el) el.remove();
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            _attachCatManagerDragDrop(tId);

            // Attach click handlers for category detail view
            var catCardEls = document.querySelectorAll('.cat-mgr-card');
            catCardEls.forEach(function(cardEl) {
                cardEl.addEventListener('click', function(e) {
                    // Don't open detail if clicking unmerge button
                    if (e.target.closest && e.target.closest('.cat-unmerge-btn')) return;
                    // Only open detail if not a drag operation
                    if (cardEl._wasDragged) { cardEl._wasDragged = false; return; }
                    var catName = cardEl.getAttribute('data-cat');
                    _renderCategoryDetail(catName);
                });
            });

            // Attach click handlers for unmerge buttons
            var unmergeBtns = document.querySelectorAll('.cat-unmerge-btn');
            unmergeBtns.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var catName = btn.getAttribute('data-unmerge-cat');
                    _unmergeCategoryAction(tId, catName);
                });
            });
        };

        // ---- Detail view: participants in a specific category ----
        var _renderCategoryDetail = function(catName) {
            var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
            if (!t) return;
            var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

            // Filter participants in this category (supports multi-category) — track their index in parts[]
            var catParticipants = [];
            parts.forEach(function(p, idx) {
                if (typeof p !== 'object') return;
                if (window._participantInCategory(p, catName)) {
                    catParticipants.push({ p: p, idx: idx });
                }
            });

            // Build participant cards with source badges and remove button
            var pCardsHtml = catParticipants.length > 0
                ? catParticipants.map(function(item) {
                    var p = item.p;
                    var pIdx = item.idx;
                    var name = p.displayName || p.name || 'Sem nome';
                    var email = p.email || '';
                    var initial = name.charAt(0).toUpperCase();
                    var origCat = p.originalCategory ? ' <span style="font-size:0.7rem;color:var(--text-muted);opacity:0.7;">(' + p.originalCategory + ')</span>' : '';
                    // Source badge
                    var srcBadge = '';
                    if (p.categorySource === 'perfil') {
                        srcBadge = '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.6rem;font-weight:600;background:rgba(34,197,94,0.12);color:#4ade80;border:1px solid rgba(34,197,94,0.25);margin-left:4px;">(perfil)</span>';
                    } else if (p.wasUncategorized) {
                        srcBadge = '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.6rem;font-weight:600;background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);margin-left:4px;">(sem cat.)</span>';
                    }
                    // Remove button
                    var removeBtn = '<button class="cat-remove-participant-btn" data-pidx="' + pIdx + '" data-cat="' + catName.replace(/"/g, '&quot;') + '" title="Remover da categoria" ' +
                        'style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" ' +
                        'onmouseenter="this.style.background=\'rgba(239,68,68,0.3)\'" onmouseleave="this.style.background=\'rgba(239,68,68,0.1)\'">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
                        '</button>';
                    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);">' +
                        '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.9rem;flex-shrink:0;">' + initial + '</div>' +
                        '<div style="flex:1;min-width:0;">' +
                        '<div style="font-weight:600;font-size:0.9rem;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + srcBadge + origCat + '</div>' +
                        (email ? '<div style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + email + '</div>' : '') +
                        '</div>' +
                        removeBtn +
                        '</div>';
                }).join('')
                : '<div style="text-align:center;padding:2rem 1rem;color:var(--text-muted);font-size:0.9rem;font-style:italic;">Nenhum inscrito nesta categoria.</div>';

            var detailHtml = '<div id="' + modalId + '" style="display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);z-index:10001;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;" onclick="event.stopPropagation();">' +
                '<div style="background:var(--bg-card);width:95%;max-width:600px;border-radius:18px;border:1px solid var(--border-color);box-shadow:0 24px 48px rgba(0,0,0,0.5);margin:auto;animation:fadeIn 0.2s ease;">' +
                '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">' +
                '<h3 style="margin:0;font-size:1.15rem;color:var(--text-bright);">🏷️ ' + window._displayCategoryName(catName) + '</h3>' +
                '<button style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;line-height:1;" onclick="document.getElementById(\'' + modalId + '\').remove();">&times;</button>' +
                '</div>' +
                '<div style="padding:10px 1.5rem 0;">' +
                '<button class="btn btn-outline btn-sm hover-lift" style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-size:0.8rem;" onclick="window._catManagerRender();"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Voltar</button>' +
                '</div>' +
                '<div style="padding:0 1.5rem 1.5rem;">' +
                '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">' + catParticipants.length + ' inscrito' + (catParticipants.length !== 1 ? 's' : '') + '</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;">' + pCardsHtml + '</div>' +
                '</div>' +
                '</div></div>';

            var el = document.getElementById(modalId);
            if (el) el.remove();
            document.body.insertAdjacentHTML('beforeend', detailHtml);

            // Attach click handlers for remove-from-category buttons
            var removeBtns = document.querySelectorAll('.cat-remove-participant-btn');
            removeBtns.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var pIdx = parseInt(btn.getAttribute('data-pidx'), 10);
                    var cat = btn.getAttribute('data-cat');
                    _removeParticipantFromCategory(tId, pIdx, cat);
                });
            });
        };

        _renderModal();

        // Save reference for re-render
        window._catManagerRender = _renderModal;
        window._catManagerTid = tId;
    };

    // Attach drag-and-drop events for category manager (desktop + mobile touch)
    function _attachCatManagerDragDrop(tId) {
        var _dragData = null; // Shared drag state for both desktop and touch

        // Category card drag (for merging)
        var catCards = document.querySelectorAll('.cat-mgr-card');
        catCards.forEach(function(card) {
            card.addEventListener('dragstart', function(e) {
                card._wasDragged = true;
                _dragData = { type: 'cat', cat: card.getAttribute('data-cat') };
                e.dataTransfer.setData('text/plain', 'cat');
                e.dataTransfer.effectAllowed = 'move';
                card.style.opacity = '0.5';
            });
            card.addEventListener('dragend', function() {
                card.style.opacity = '1';
                _dragData = null;
                catCards.forEach(function(c) { c.style.border = '2px solid rgba(99,102,241,0.2)'; });
            });
            card.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.style.border = '2px solid #fbbf24';
            });
            card.addEventListener('dragleave', function() {
                card.style.border = '2px solid rgba(99,102,241,0.2)';
            });
            card.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                card.style.border = '2px solid rgba(99,102,241,0.2)';
                var targetCat = card.getAttribute('data-cat');

                if (_dragData && _dragData.type === 'cat' && _dragData.cat !== targetCat) {
                    _confirmMergeCategories(tId, _dragData.cat, targetCat);
                } else if (_dragData && _dragData.type === 'participant') {
                    _assignParticipantCategory(tId, _dragData.pidx, targetCat);
                }
                _dragData = null;
            });
        });

        // Participant drag (for assigning to category)
        var pCards = document.querySelectorAll('.cat-mgr-participant');
        pCards.forEach(function(pc) {
            pc.addEventListener('dragstart', function(e) {
                _dragData = { type: 'participant', pidx: parseInt(pc.getAttribute('data-pidx')) };
                e.dataTransfer.setData('text/plain', 'participant');
                e.dataTransfer.effectAllowed = 'move';
                pc.style.opacity = '0.5';
            });
            pc.addEventListener('dragend', function() {
                pc.style.opacity = '1';
                _dragData = null;
            });
        });

        // Touch drag-and-drop support for mobile
        var _touchDragEl = null;
        var _touchClone = null;

        function _getTouchTarget(x, y) {
            if (_touchClone) _touchClone.style.display = 'none';
            var el = document.elementFromPoint(x, y);
            if (_touchClone) _touchClone.style.display = '';
            // Walk up to find .cat-mgr-card
            while (el && !el.classList.contains('cat-mgr-card')) {
                el = el.parentElement;
            }
            return el;
        }

        function _onTouchStart(e) {
            var target = e.target.closest('.cat-mgr-participant, .cat-mgr-card');
            if (!target) return;
            _touchDragEl = target;
            if (target.classList.contains('cat-mgr-participant')) {
                _dragData = { type: 'participant', pidx: parseInt(target.getAttribute('data-pidx')) };
            } else {
                _dragData = { type: 'cat', cat: target.getAttribute('data-cat') };
            }
            // Create visual clone
            var rect = target.getBoundingClientRect();
            _touchClone = target.cloneNode(true);
            _touchClone.style.position = 'fixed';
            _touchClone.style.left = rect.left + 'px';
            _touchClone.style.top = rect.top + 'px';
            _touchClone.style.width = rect.width + 'px';
            _touchClone.style.opacity = '0.8';
            _touchClone.style.zIndex = '99999';
            _touchClone.style.pointerEvents = 'none';
            document.body.appendChild(_touchClone);
            target.style.opacity = '0.3';
        }

        function _onTouchMove(e) {
            if (!_touchClone) return;
            e.preventDefault();
            var touch = e.touches[0];
            _touchClone.style.left = (touch.clientX - _touchClone.offsetWidth / 2) + 'px';
            _touchClone.style.top = (touch.clientY - _touchClone.offsetHeight / 2) + 'px';
            // Highlight drop target
            var targetEl = _getTouchTarget(touch.clientX, touch.clientY);
            catCards.forEach(function(c) { c.style.border = '2px solid rgba(99,102,241,0.2)'; });
            if (targetEl && targetEl !== _touchDragEl) {
                targetEl.style.border = '2px solid #fbbf24';
            }
        }

        function _onTouchEnd(e) {
            if (!_touchClone) return;
            var touch = e.changedTouches[0];
            var targetEl = _getTouchTarget(touch.clientX, touch.clientY);
            if (_touchClone.parentElement) _touchClone.remove();
            if (_touchDragEl) _touchDragEl.style.opacity = '1';
            catCards.forEach(function(c) { c.style.border = '2px solid rgba(99,102,241,0.2)'; });

            if (targetEl && _dragData) {
                var targetCat = targetEl.getAttribute('data-cat');
                if (_dragData.type === 'cat' && _dragData.cat !== targetCat) {
                    _confirmMergeCategories(tId, _dragData.cat, targetCat);
                } else if (_dragData.type === 'participant') {
                    _assignParticipantCategory(tId, _dragData.pidx, targetCat);
                }
            }

            _touchDragEl = null;
            _touchClone = null;
            _dragData = null;
        }

        var modalContent = document.getElementById('cat-manager-modal');
        if (modalContent) {
            modalContent.addEventListener('touchstart', _onTouchStart, { passive: true });
            modalContent.addEventListener('touchmove', _onTouchMove, { passive: false });
            modalContent.addEventListener('touchend', _onTouchEnd, { passive: true });
        }
    }

    // Confirm and execute category merge
    // Sort skill suffixes by strength (alphabetical = strongest first: A > B > C > D ...)
    function _sortSkillParts(parts) {
        return parts.slice().sort(function(a, b) {
            // Compare alphabetically — A < B < C means A is stronger
            return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
        });
    }

    function _confirmMergeCategories(tId, sourceCat, targetCat) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        var skillCats = (t && t.skillCategories) ? t.skillCategories : [];

        // Build merged name with skill suffixes sorted by strength (A before B before C...)
        // "Fem C" + "Fem A" → "Fem A/C" (not "Fem C/A")
        // "Fem B/C" + "Fem D" → "Fem B/C/D"
        // If ALL skill categories are merged → simplify to just the prefix ("Masc A/B/C/D" → "Masc")
        // Gender prefixes can be multi-word: "Misto Aleat.", "Misto Obrig."
        var _gPrefixes = ['Misto Aleat.', 'Misto Obrig.', 'Fem', 'Masc'];
        function _extractGenderPrefix(cat) {
            for (var i = 0; i < _gPrefixes.length; i++) {
                if (cat.startsWith(_gPrefixes[i])) {
                    var suffix = cat.substring(_gPrefixes[i].length).trim();
                    return { prefix: _gPrefixes[i], suffix: suffix };
                }
            }
            // Fallback: first word
            var sp = cat.indexOf(' ');
            if (sp !== -1) return { prefix: cat.substring(0, sp), suffix: cat.substring(sp + 1) };
            return { prefix: cat, suffix: '' };
        }
        var sInfo = _extractGenderPrefix(sourceCat);
        var tInfo = _extractGenderPrefix(targetCat);
        var mergedName = '';
        if (sInfo.prefix === tInfo.prefix) {
            // Common prefix — collect all skill suffixes, deduplicate and sort by strength
            var prefix = sInfo.prefix;
            var sSuffixes = sInfo.suffix.split('/').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
            var tSuffixes = tInfo.suffix.split('/').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
            var allSuffixes = {};
            sSuffixes.concat(tSuffixes).forEach(function(s) { if (s) allSuffixes[s] = true; });
            var sorted = _sortSkillParts(Object.keys(allSuffixes));

            // Check if all skill categories are now merged — simplify to just prefix
            if (skillCats.length > 0 && sorted.length >= skillCats.length) {
                var allPresent = skillCats.every(function(sc) { return allSuffixes[sc.trim()]; });
                if (allPresent) {
                    mergedName = prefix;
                } else {
                    mergedName = prefix + ' ' + sorted.join('/');
                }
            } else {
                mergedName = prefix + ' ' + sorted.join('/');
            }
        } else {
            // No common prefix — sort the two full names
            var both = [sourceCat, targetCat].sort(function(a, b) {
                return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
            });
            mergedName = both.join('/');
        }

        var _dn = window._displayCategoryName || function(c) { return c; };
        showAlertDialog(
            'Mesclar Categorias',
            'Deseja mesclar <strong>' + _dn(sourceCat) + '</strong> com <strong>' + _dn(targetCat) + '</strong>?<br><br>' +
            'A nova categoria será: <strong>' + _dn(mergedName) + '</strong><br><br>' +
            'Todos os participantes de ambas as categorias serão movidos para a nova categoria.',
            function() {
                _executeMerge(tId, sourceCat, targetCat, mergedName);
            },
            { type: 'warning', confirmText: 'Mesclar', cancelText: 'Cancelar', showCancel: true }
        );
    }

    // Execute the actual merge
    function _executeMerge(tId, sourceCat, targetCat, mergedName) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t) return;

        var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

        // FIRST: Record pre-merge mapping BEFORE moving participants
        // This is critical for unmerge — we need to know who was in sourceCat vs targetCat
        var premergeMap = {};
        parts.forEach(function(p) {
            if (typeof p !== 'object') return;
            var email = p.email || p.displayName || p.name || '';
            if (!email) return;
            if (window._participantInCategory(p, sourceCat)) {
                premergeMap[email] = sourceCat;
            } else if (window._participantInCategory(p, targetCat)) {
                premergeMap[email] = targetCat;
            }
        });

        // THEN: Update all participants in source or target category to new merged category
        parts.forEach(function(p) {
            if (typeof p !== 'object') return;
            var pCats = window._getParticipantCategories(p);
            var changed = false;
            var newCats = pCats.map(function(c) {
                if (c === sourceCat || c === targetCat) {
                    if (!p.originalCategory) p.originalCategory = c;
                    changed = true;
                    return mergedName;
                }
                return c;
            });
            // Deduplicate (both source and target might be present)
            var unique = [];
            newCats.forEach(function(c) { if (unique.indexOf(c) === -1) unique.push(c); });
            if (changed) {
                window._setParticipantCategories(p, unique);
            }
        });

        // Update combinedCategories: remove source and target, add merged
        var cats = t.combinedCategories || [];
        var newCats = cats.filter(function(c) { return c !== sourceCat && c !== targetCat; });
        newCats.push(mergedName);
        t.combinedCategories = newCats;

        // Also update rounds/matches category references
        (t.rounds || []).forEach(function(r) {
            (r.matches || []).forEach(function(m) {
                if (m.category === sourceCat || m.category === targetCat) {
                    m.category = mergedName;
                }
            });
        });

        // Also update standings category references
        (t.standings || []).forEach(function(s) {
            if (s.category === sourceCat || s.category === targetCat) {
                s.category = mergedName;
            }
        });

        // Save merge history for undo support — uses premergeMap captured BEFORE moving
        if (!t.mergeHistory) t.mergeHistory = [];
        var mergeRecord = {
            mergedName: mergedName,
            sourceCat: sourceCat,
            targetCat: targetCat,
            timestamp: Date.now(),
            participants: premergeMap // email → category before this merge (sourceCat or targetCat)
        };
        t.mergeHistory.push(mergeRecord);

        // Log action
        window.AppStore.logAction(tId, 'Categorias mescladas: ' + sourceCat + ' + ' + targetCat + ' → ' + mergedName);

        // Persist — use FirestoreDB.saveTournament directly for reliability
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        } else {
            window.AppStore.sync();
        }

        if (typeof showNotification === 'function') {
            showNotification('Categorias Mescladas', sourceCat + ' + ' + targetCat + ' → ' + mergedName, 'success');
        }

        // Re-render the modal after a small delay to ensure data is settled
        setTimeout(function() {
            if (window._catManagerRender) window._catManagerRender();
        }, 100);
    }

    // ========== Remove a participant from a specific category (set as uncategorized) ==========
    function _removeParticipantFromCategory(tId, pIdx, category) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t || !t.participants) return;

        var parts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
        if (pIdx < 0 || pIdx >= parts.length) return;

        var p = parts[pIdx];
        if (typeof p !== 'object') return;
        var pName = p.displayName || p.name || 'Sem nome';

        showAlertDialog(
            'Remover da Categoria',
            'Deseja remover <strong>' + pName + '</strong> da categoria <strong>' + window._displayCategoryName(category) + '</strong>?<br><br>' +
            'O participante ficará sem categoria e poderá ser reatribuído.',
            function() {
                _executeRemoveFromCategory(tId, pIdx, category);
            },
            { type: 'warning', confirmText: 'Remover', cancelText: 'Cancelar', showCancel: true }
        );
    }

    function _executeRemoveFromCategory(tId, pIdx, category) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t || !t.participants) return;

        var parts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
        if (pIdx < 0 || pIdx >= parts.length) return;

        var p = parts[pIdx];
        if (typeof p !== 'object') return;
        var pName = p.displayName || p.name || 'Sem nome';

        // Remove the specific category from the participant
        var pCats = window._getParticipantCategories(p);
        var newCats = pCats.filter(function(c) { return c !== category; });
        window._setParticipantCategories(p, newCats);

        // Mark as uncategorized if no categories left
        if (newCats.length === 0) {
            p.wasUncategorized = true;
            p.categorySource = '';
        }

        // Ensure the array is written back
        if (!Array.isArray(t.participants)) {
            t.participants = parts;
        }

        // Log action
        window.AppStore.logAction(tId, 'Participante removido da categoria: ' + pName + ' ← ' + category);

        // Persist
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        } else {
            window.AppStore.sync();
        }

        if (typeof showNotification === 'function') {
            showNotification('Participante Removido', pName + ' removido de ' + window._displayCategoryName(category), 'success');
        }

        // Re-render the category detail view (refreshed data)
        setTimeout(function() {
            if (window._catManagerRender) {
                // Go back to main view since the detail might be stale
                window._catManagerRender();
            }
        }, 100);
    }

    // ========== Unmerge a previously merged category ==========
    function _unmergeCategoryAction(tId, catName) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t) return;

        // Find the most recent merge that produced this category in mergeHistory
        var mergeIdx = -1;
        if (t.mergeHistory && t.mergeHistory.length > 0) {
            for (var i = t.mergeHistory.length - 1; i >= 0; i--) {
                if (t.mergeHistory[i].mergedName === catName) { mergeIdx = i; break; }
            }
        }

        if (mergeIdx !== -1) {
            // Has mergeHistory — use it
            var record = t.mergeHistory[mergeIdx];
            var _dn2 = window._displayCategoryName || function(c) { return c; };
            showAlertDialog(
                'Desmesclar Categoria',
                'Deseja desfazer a mesclagem de <strong>' + _dn2(catName) + '</strong>?<br><br>' +
                'As categorias originais serão restauradas: <strong>' + _dn2(record.sourceCat) + '</strong> e <strong>' + _dn2(record.targetCat) + '</strong><br><br>' +
                'Os participantes serão reatribuídos às suas categorias originais. Participantes sem histórico ficarão sem categoria.',
                function() {
                    _executeUnmerge(tId, mergeIdx);
                },
                { type: 'warning', confirmText: 'Desmesclar', cancelText: 'Cancelar', showCancel: true }
            );
            return;
        }

        // No mergeHistory — infer original categories from the name
        var skillCats = t.skillCategories || [];
        var inferredCats = [];

        if (catName.indexOf('/') !== -1) {
            // "Fem A/B" → split into "Fem A" and "Fem B"
            var spaceIdx = catName.indexOf(' ');
            if (spaceIdx !== -1) {
                var prefix = catName.substring(0, spaceIdx);
                var suffixPart = catName.substring(spaceIdx + 1);
                var suffixes = suffixPart.split('/').map(function(s) { return s.trim(); });
                suffixes.forEach(function(s) { if (s) inferredCats.push(prefix + ' ' + s); });
            } else {
                // No space — full names joined by /
                inferredCats = catName.split('/').map(function(s) { return s.trim(); });
            }
        } else if (skillCats.length > 0) {
            // Bare prefix like "Masc" → expand to "Masc A", "Masc B", etc.
            var genderPrefixes = ['Fem', 'Masc', 'Misto Aleat.', 'Misto Obrig.'];
            var isBare = genderPrefixes.indexOf(catName) !== -1;
            if (isBare) {
                skillCats.forEach(function(sc) { inferredCats.push(catName + ' ' + sc.trim()); });
            }
        }

        if (inferredCats.length < 2) {
            if (typeof showNotification === 'function') {
                showNotification('Erro', 'Não foi possível determinar as categorias originais para desmesclar.', 'error');
            }
            return;
        }

        var _dn3 = window._displayCategoryName || function(c) { return c; };
        showAlertDialog(
            'Desmesclar Categoria',
            'Deseja desfazer a mesclagem de <strong>' + _dn3(catName) + '</strong>?<br><br>' +
            'As categorias originais serão restauradas: <strong>' + inferredCats.map(function(ic) { return _dn3(ic); }).join('</strong>, <strong>') + '</strong><br><br>' +
            'Os participantes serão reatribuídos às suas categorias originais.',
            function() {
                _executeInferredUnmerge(tId, catName, inferredCats);
            },
            { type: 'warning', confirmText: 'Desmesclar', cancelText: 'Cancelar', showCancel: true }
        );
    }

    function _executeUnmerge(tId, mergeIdx) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t || !t.mergeHistory || !t.mergeHistory[mergeIdx]) return;

        var record = t.mergeHistory[mergeIdx];
        var mergedName = record.mergedName;
        var sourceCat = record.sourceCat;
        var targetCat = record.targetCat;
        var participantMap = record.participants || {};

        var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

        // Reassign participants back to their original categories
        // Priority: 1) mergeRecord.participants (pre-merge map), 2) p.originalCategory, 3) uncategorized
        parts.forEach(function(p) {
            if (typeof p !== 'object') return;
            var pCats = window._getParticipantCategories(p);
            var idx = pCats.indexOf(mergedName);
            if (idx === -1) return;

            var pKey = p.email || p.displayName || p.name || '';
            // participantMap has the exact pre-merge category (sourceCat or targetCat)
            var fromMap = participantMap[pKey] || '';
            var fromOrig = p.originalCategory || '';

            // Determine restore target: prefer mergeRecord map, fallback to originalCategory
            var restoreTo = '';
            if (fromMap && (fromMap === sourceCat || fromMap === targetCat)) {
                restoreTo = fromMap;
            } else if (fromOrig && (fromOrig === sourceCat || fromOrig === targetCat)) {
                restoreTo = fromOrig;
            }

            if (restoreTo) {
                // Restore to the pre-merge category
                pCats[idx] = restoreTo;
                window._setParticipantCategories(p, pCats);
                // Clear originalCategory if it matches (participant is back to their original)
                if (p.originalCategory === restoreTo) {
                    delete p.originalCategory;
                }
            } else {
                // No original info — set as uncategorized (remove merged cat)
                pCats.splice(idx, 1);
                if (pCats.length === 0) {
                    window._setParticipantCategories(p, []);
                    p.wasUncategorized = true;
                } else {
                    window._setParticipantCategories(p, pCats);
                }
            }
        });

        // Restore combinedCategories: remove merged, add back source and target
        var cats = t.combinedCategories || [];
        var newCats = cats.filter(function(c) { return c !== mergedName; });
        if (newCats.indexOf(sourceCat) === -1) newCats.push(sourceCat);
        if (newCats.indexOf(targetCat) === -1) newCats.push(targetCat);
        t.combinedCategories = newCats;

        // Revert rounds/matches category references
        (t.rounds || []).forEach(function(r) {
            (r.matches || []).forEach(function(m) {
                if (m.category === mergedName) {
                    // Can't know which original — leave as merged for safety
                    // (matches shouldn't exist before a draw anyway)
                }
            });
        });

        // Remove this merge record from history
        t.mergeHistory.splice(mergeIdx, 1);

        // Log action
        window.AppStore.logAction(tId, 'Mesclagem desfeita: ' + mergedName + ' → ' + sourceCat + ' + ' + targetCat);

        // Persist
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        } else {
            window.AppStore.sync();
        }

        if (typeof showNotification === 'function') {
            showNotification('Mesclagem Desfeita', mergedName + ' → ' + sourceCat + ' + ' + targetCat, 'success');
        }

        // Re-render
        setTimeout(function() {
            if (window._catManagerRender) window._catManagerRender();
        }, 100);
    }

    // Unmerge without mergeHistory — infer from name pattern
    function _executeInferredUnmerge(tId, mergedName, inferredCats) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t) return;

        var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];

        // Restore participants to their original categories using p.originalCategory
        parts.forEach(function(p) {
            if (typeof p !== 'object') return;
            var pCats = window._getParticipantCategories(p);
            var idx = pCats.indexOf(mergedName);
            if (idx === -1) return;

            // p.originalCategory (shown in parentheses) tells us where the participant came from
            var origCat = p.originalCategory || '';
            if (origCat && inferredCats.indexOf(origCat) !== -1) {
                // Restore to the original category shown in parentheses
                pCats[idx] = origCat;
                window._setParticipantCategories(p, pCats);
                delete p.originalCategory;
            } else {
                // No matching original — set as uncategorized for manual reassignment
                pCats.splice(idx, 1);
                if (pCats.length === 0) {
                    window._setParticipantCategories(p, []);
                    p.wasUncategorized = true;
                } else {
                    window._setParticipantCategories(p, pCats);
                }
            }
        });

        // Restore combinedCategories: remove merged, add back inferred originals
        var cats = t.combinedCategories || [];
        var newCats = cats.filter(function(c) { return c !== mergedName; });
        inferredCats.forEach(function(ic) {
            if (newCats.indexOf(ic) === -1) newCats.push(ic);
        });
        t.combinedCategories = newCats;

        // Remove any mergeHistory entries for this merged name (cleanup)
        if (t.mergeHistory) {
            t.mergeHistory = t.mergeHistory.filter(function(mh) { return mh.mergedName !== mergedName; });
        }

        // Log action
        window.AppStore.logAction(tId, 'Mesclagem desfeita: ' + mergedName + ' → ' + inferredCats.join(' + '));

        // Persist
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        } else {
            window.AppStore.sync();
        }

        if (typeof showNotification === 'function') {
            showNotification('Mesclagem Desfeita', mergedName + ' → ' + inferredCats.join(' + '), 'success');
        }

        // Re-render
        setTimeout(function() {
            if (window._catManagerRender) window._catManagerRender();
        }, 100);
    }

    // Assign an uncategorized participant to a category (manual by organizer)
    function _assignParticipantCategory(tId, pIdx, category) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t || !t.participants) return;

        // Work directly on the tournament's participants array
        var parts = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
        if (pIdx < 0 || pIdx >= parts.length) return;

        var p = parts[pIdx];
        var pName = typeof p === 'string' ? p : (p.displayName || p.name || '');

        // Convert string participant to object if needed
        if (typeof p === 'string') {
            parts[pIdx] = { name: p, displayName: p, categories: [category], category: category, categorySource: 'organizador', wasUncategorized: true };
            p = parts[pIdx];
        } else {
            window._addParticipantCategory(p, category);
            p.categorySource = 'organizador';
            p.wasUncategorized = true;
        }

        // Ensure the array is written back (in case Object.values created a copy)
        if (!Array.isArray(t.participants)) {
            t.participants = parts;
        }

        // Add notification for the participant
        _addCategoryNotification(t, parts[pIdx], category);

        // Persist — use FirestoreDB.saveTournament directly for reliability
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        } else {
            window.AppStore.sync();
        }

        if (typeof showNotification === 'function') {
            showNotification('Categoria Atribuída', pName + ' → ' + window._displayCategoryName(category), 'success');
        }

        // Re-render the modal after a small delay to ensure data is settled
        setTimeout(function() {
            if (window._catManagerRender) window._catManagerRender();
        }, 100);
    }

    // ========== Auto-assign categories based on participant profile gender ==========
    window._autoAssignCategories = function(tId) {
        var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tId); });
        if (!t) return 0;

        var categories = t.combinedCategories || [];
        var genderCats = t.genderCategories || [];
        if (categories.length === 0 && genderCats.length === 0) return 0;

        var parts = t.participants ? (Array.isArray(t.participants) ? t.participants : Object.values(t.participants)) : [];
        if (parts.length === 0) return 0;

        var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto Aleat.', misto_obrigatorio: 'Misto Obrig.' };
        var assigned = 0;

        parts.forEach(function(p, idx) {
            if (typeof p !== 'object') return;
            // Skip if already has a category
            // Skip if already has a valid category
            var existingCats = window._getParticipantCategories(p);
            var hasValidCat = existingCats.some(function(c) { return categories.indexOf(c) !== -1; });
            if (hasValidCat) return;

            // Get participant's gender (stored on enrollment or from profile)
            var pGender = p.gender || '';
            if (!pGender) return; // No gender info, can't auto-assign

            // Determine eligible gender codes
            var eligibleGenderCodes = window._userGenderToCatCodes(pGender);
            if (eligibleGenderCodes.length === 0) return;

            // Find eligible combined categories
            var eligible = [];
            if (categories.length > 0) {
                categories.forEach(function(c) {
                    var matchesGender = eligibleGenderCodes.some(function(gc) {
                        return c.toLowerCase().startsWith((genderLabels[gc] || gc).toLowerCase());
                    });
                    if (matchesGender) eligible.push(c);
                });
            } else if (genderCats.length > 0) {
                genderCats.forEach(function(gc) {
                    if (eligibleGenderCodes.indexOf(gc) !== -1) {
                        eligible.push(genderLabels[gc] || gc);
                    }
                });
            }

            // Auto-assign: exclusive categories (pick the one matching), non-exclusive (add all)
            var groups = window._groupEligibleCategories(eligible);
            var autoAssigned = [];
            // For exclusive, only auto-assign if exactly one match
            if (groups.exclusive.length === 1) autoAssigned.push(groups.exclusive[0]);
            // For non-exclusive, auto-assign all
            autoAssigned = autoAssigned.concat(groups.nonExclusive);

            if (autoAssigned.length > 0) {
                window._setParticipantCategories(p, autoAssigned);
                p.categorySource = 'perfil';
                p.wasUncategorized = true;
                autoAssigned.forEach(function(cat) {
                    _addCategoryNotification(t, p, cat);
                });
                assigned++;
            }
        });

        if (assigned > 0) {
            // Ensure the array is written back
            if (!Array.isArray(t.participants)) {
                t.participants = parts;
            }
            // Persist
            if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
                window.FirestoreDB.saveTournament(t);
            } else {
                window.AppStore.sync();
            }
        }

        return assigned;
    };

    // ========== Category assignment notification ==========
    function _addCategoryNotification(t, participant, category) {
        if (!t || !participant) return;
        var pEmail = participant.email || '';
        if (!pEmail) return;

        // Initialize notifications array if needed
        if (!t.categoryNotifications) t.categoryNotifications = [];

        t.categoryNotifications.push({
            targetEmail: pEmail,
            targetName: participant.displayName || participant.name || '',
            category: category,
            source: participant.categorySource || 'organizador',
            timestamp: Date.now(),
            read: false
        });
    }

    // Check and show category notifications for current user
    window._checkCategoryNotifications = function(t) {
        if (!t || !t.categoryNotifications || t.categoryNotifications.length === 0) return;
        var user = window.AppStore.currentUser;
        if (!user || !user.email) return;

        var userNotifs = t.categoryNotifications.filter(function(n) {
            return n.targetEmail === user.email && !n.read;
        });

        if (userNotifs.length === 0) return;

        userNotifs.forEach(function(n) {
            n.read = true; // Mark as read

            var sourceLabel = n.source === 'perfil' ? 'com base no seu perfil' : 'pelo organizador';
            var orgEmail = t.organizerEmail || '';
            var orgName = t.organizerName || t.organizerEmail || 'organizador';

            var questionBtnId = 'cat-question-btn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

            showAlertDialog(
                'Categoria Atribuída',
                'Você foi atribuído à categoria <strong>' + window._displayCategoryName(n.category) + '</strong> ' + sourceLabel + ' no torneio <strong>' + (t.name || '') + '</strong>.' +
                '<br><br><button id="' + questionBtnId + '" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;padding:8px 16px;border-radius:10px;font-weight:600;font-size:0.85rem;cursor:pointer;">💬 Questionar Organizador</button>',
                function() {
                    // Dialog dismissed
                },
                { type: 'info', confirmText: 'OK' }
            );

            // Attach question button handler after dialog renders
            setTimeout(function() {
                var btn = document.getElementById(questionBtnId);
                if (btn) {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var subject = encodeURIComponent('Questionamento sobre categoria - ' + (t.name || ''));
                        var body = encodeURIComponent('Olá ' + orgName + ',\n\nFui atribuído à categoria "' + n.category + '" no torneio "' + (t.name || '') + '" e gostaria de questionar essa atribuição.\n\nMotivo: \n\nAtenciosamente,\n' + (user.displayName || ''));
                        window.open('mailto:' + orgEmail + '?subject=' + subject + '&body=' + body, '_blank');
                    });
                }
            }, 300);
        });

        // Persist the read status
        if (window.FirestoreDB && window.FirestoreDB.saveTournament) {
            window.FirestoreDB.saveTournament(t);
        }
    };

    if (!window.enrollDeenrollSetupDone) {
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
                            if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', '"' + t.name + '" atingiu ' + t.maxParticipants + ' inscritos e foi encerrado automaticamente.', 'success');
                        }
                        if (typeof showNotification !== 'undefined') showNotification('✅ Inscrito!', 'Você foi inscrito com sucesso no torneio "' + t.name + '".', 'success');

                        // Notify organizer about new enrollment
                        if (t.organizerEmail && t.organizerEmail !== user.email && window.FirestoreDB && window.FirestoreDB.db) {
                            window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                                if (!snap.empty) {
                                    window._sendUserNotification(snap.docs[0].id, {
                                        type: 'enrollment_new',
                                        message: (user.displayName || 'Um participante') + ' se inscreveu no torneio "' + t.name + '".',
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
                                message: 'Inscrição confirmada no torneio "' + t.name + '"!',
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
                        if (typeof showNotification !== 'undefined') showNotification('⚡ Inscrições Encerradas!', '"' + t.name + '" atingiu ' + t.maxParticipants + ' inscritos e foi encerrado automaticamente.', 'success');
                    }
                    if (typeof showNotification !== 'undefined') showNotification('✅ Inscrito!', 'Equipe inscrita com sucesso no torneio "' + t.name + '".', 'success');

                    // Notify organizer about new team enrollment
                    if (t.organizerEmail && t.organizerEmail !== user.email && window.FirestoreDB && window.FirestoreDB.db) {
                        window.FirestoreDB.db.collection('users').where('email', '==', t.organizerEmail).limit(1).get().then(function(snap) {
                            if (!snap.empty) {
                                window._sendUserNotification(snap.docs[0].id, {
                                    type: 'enrollment_new',
                                    message: 'Equipe "' + teamString + '" se inscreveu no torneio "' + t.name + '".',
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
                            message: 'Sua equipe foi inscrita no torneio "' + t.name + '"!',
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
                                        message: (user.displayName || 'Um participante') + ' cancelou a inscrição no torneio "' + t.name + '".',
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
                                message: 'Sua inscrição no torneio "' + t.name + '" foi cancelada.',
                                tournamentId: String(t.id),
                                tournamentName: t.name || '',
                                level: 'fundamental'
                            });
                        }

                        if (typeof showNotification !== 'undefined') showNotification('Inscrição Cancelada', 'Sua inscrição foi removida do torneio "' + t.name + '".', 'info');

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

                            <button class="res-option" style="grid-column:span 2;" onclick="window._handleIncompleteOption('${tId}', 'poll')">
                                <span style="font-size:1.5rem;">🗳️</span>
                                <div>
                                    <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">Enquete entre Participantes</div>
                                    <div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">Os inscritos votam na solução que preferem. Defina um prazo e acompanhe a contagem regressiva.</div>
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


        // Handler for incomplete teams resolution options
        window._handleIncompleteOption = function (tId, option) {
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (!t) return;

            if (option === 'reopen') {
                t.status = 'active';
                t.enrollmentStatus = 'open';
                window.AppStore.logAction(tId, 'Inscrições reabertas para completar times');
                window.AppStore.sync();
                document.getElementById('incomplete-teams-panel').remove();
                if (typeof showNotification === 'function') showNotification('Inscrições Reabertas', 'Aguardando novos inscritos para completar os times.', 'success');
                window.location.hash = '#tournaments/' + tId;
            } else if (option === 'lottery') {
                window.showLotteryIncompletePanel(tId);
            } else if (option === 'standby') {
                t.incompleteResolution = 'standby';
                window.AppStore.logAction(tId, 'Jogadores sem time movidos para lista de espera');
                window.AppStore.sync();
                document.getElementById('incomplete-teams-panel').remove();
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

                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'swiss')">
                                <span style="font-size:2rem;">🏅</span>
                                <div>
                                    <h4>Formato Suíço / Classificatória</h4>
                                    <p>Garantia de mais jogos para todos antes de afunilar para os melhores ${info.lo}.</p>
                                </div>
                            </button>

                            <button class="p2-option shadow-xl" onclick="window._handleP2Option('${tId}', 'poll')" style="grid-column: span 2;">
                                <span style="font-size:2rem;">🗳️</span>
                                <div>
                                    <h4>Enquete entre Participantes</h4>
                                    <p>Os inscritos votam na solução que preferem. Defina um prazo e acompanhe a contagem regressiva.</p>
                                </div>
                            </button>`;
                            })()}
                        </div>
                    </div>

                    <div style="padding:1.5rem 2.5rem 2rem;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.1);border-top:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:0.8rem;color:#64748b;">Ajuste manual disponível no rascunho de chaveamento.</div>
                        <button onclick="window._cancelPowerOf2Panel('${tId}');" style="background:transparent;color:#94a3b8;border:2px solid rgba(148,163,184,0.2);padding:10px 24px;border-radius:12px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">Voltar</button>
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

                // Add notification for all participants
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

                overlay.remove();
                if (typeof showNotification === 'function') {
                    showNotification('Enquete Criada', 'Os participantes serão notificados para votar. Prazo: ' + hours + ' horas.', 'success');
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

                var clickHandler = isPollClosed ? '' : ' onclick="window._castPollVote(\'' + tId + '\',\'' + pollId + '\',\'' + opt.key + '\')"';
                var cursor = isPollClosed ? 'default' : 'pointer';

                return '<div class="poll-vote-option" style="padding:14px;border-radius:14px;background:' + bgColor + ';border:1.5px solid ' + borderColor + ';cursor:' + cursor + ';transition:all 0.2s;"' + clickHandler + '>' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<span style="font-size:1.3rem;">' + opt.icon + '</span>' +
                    '<div style="flex:1;">' +
                    '<div style="font-weight:700;font-size:0.9rem;color:var(--text-bright);">' + opt.title + nashBadge + myVoteBadge + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">' + opt.desc + '</div>' +
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

            return '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(99,102,241,0.05));border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:1rem 1.25rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="font-size:1.5rem;">🗳️</span>' +
                '<div>' +
                '<div style="font-weight:700;font-size:0.9rem;color:var(--text-bright);">Enquete em andamento</div>' +
                '<div style="font-size:0.75rem;color:var(--text-muted);">' + totalVotes + '/' + totalParticipants + ' votos · Encerra em ' + timeStr + ' · ' + statusText + '</div>' +
                '</div>' +
                '</div>' +
                '<button onclick="window._showPollVotingDialog(\'' + t.id + '\',\'' + activePoll.id + '\')" style="background:linear-gradient(135deg,#6366f1,#818cf8);color:white;border:none;padding:8px 18px;border-radius:10px;font-weight:700;font-size:0.8rem;cursor:pointer;white-space:nowrap;">' + btnText + '</button>' +
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
            var viewBtn = '<button onclick="window._showPollVotingDialog(\'' + t.id + '\',\'' + poll.id + '\')" style="background:rgba(255,255,255,0.05);color:var(--text-bright);border:1px solid rgba(255,255,255,0.1);padding:8px 14px;border-radius:10px;font-weight:600;font-size:0.8rem;cursor:pointer;white-space:nowrap;">Ver Detalhes</button>';

            return '<div style="background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.25);border-radius:16px;padding:1rem 1.25rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="font-size:1.5rem;">✅</span>' +
                '<div>' +
                '<div style="font-weight:700;font-size:0.9rem;color:var(--text-bright);">Enquete encerrada</div>' +
                '<div style="font-size:0.75rem;color:var(--text-muted);">Resultado: <strong style="color:#4ade80;">' + winnerTitle + '</strong> (' + pct + '% · ' + winnerCount + '/' + totalVotes + ' votos)</div>' +
                '</div>' +
                '</div>' +
                '<div style="display:flex;gap:8px;">' + viewBtn + applyBtn + '</div>' +
                '</div>';
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
                    { key: 'bye', icon: '🥇', title: 'Aplicar BYE', desc: info.missing + ' times avançam direto na primeira rodada. Chaveamento de ' + info.hi + '.' },
                    { key: 'playin', icon: '🔁', title: 'Play-in (Repescagem)', desc: (info.excess * 2) + ' times disputam ' + info.excess + ' vaga(s). Chaveamento de ' + info.lo + '.' },
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
            const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
            if (!t) return;

            if (t.status === 'closed') {
                // Impedir reabertura se já houve sorteio
                const hasDraw = (Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0);
                if (hasDraw) {
                    showAlertDialog('Não Permitido', 'Não é possível reabrir inscrições após o sorteio ter sido realizado.', null, { type: 'warning' });
                    return;
                }
                t.status = 'open';
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

                if (document.getElementById('final-review-panel')) document.getElementById('final-review-panel').remove();
                showNotification('Fase de Grupos Iniciada', `${numGroups} grupos gerados!`, 'success');
                window.AppStore.syncImmediate(tId).then(function() {
                    window.location.hash = `#bracket/${tId}`;
                });
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

                // Gerar partidas de 1ª Rodada
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
                    // Tournament deleted or doesn't exist — go to dashboard
                    if (typeof showNotification === 'function') {
                        showNotification('Torneio não encontrado', 'Este torneio foi excluído ou não existe mais.', 'warning');
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
        if (!sport) return '🏅';
        const s = sport.toLowerCase();
        if (s.includes('futebol') || s.includes('society') || s.includes('futsal')) return '⚽';
        if (s.includes('vôlei') || s.includes('volei')) return '🏐';
        if (s.includes('basquete')) return '🏀';
        if (s.includes('tênis de mesa') || s.includes('tenis de mesa') || s.includes('ping pong')) return '🏓';
        if (s.includes('padel')) return '🏸';
        if (s.includes('pickleball')) return '🥒';
        if (s.includes('tênis') || s.includes('tennis')) return '🎾';
        if (s.includes('xadrez')) return '♟️';
        if (s.includes('dominó') || s.includes('domino')) return '🎴';
        if (s.includes('truco')) return '🃏';
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
        const statusText = isFinished ? '🏆 Encerrado' : (ligaAberta ? 'Liga Ativa — Inscrições Abertas' : (isAberto ? 'Inscrições Abertas' : (sorteioRealizado ? 'Em Andamento' : 'Inscrições Encerradas')));
        const statusBg = isFinished ? 'rgba(251,191,36,0.15)' : (isAberto || ligaAberta ? '#fbbf24' : (sorteioRealizado ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)'));
        const statusColor = isFinished ? '#fbbf24' : (isAberto || ligaAberta ? '#78350f' : (sorteioRealizado ? '#34d399' : '#fca5a5'));
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
                        <button type="button" class="btn btn-outline hover-lift" onclick="event.stopPropagation(); document.getElementById('team-enroll-modal-${t.id}').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-success hover-lift">Confirmar Inscrição da Equipe</button>
                     </div>
                  </form>
               </div>
            </div>
         </div>
      `;

        // Botão inscrever/desinscrever — disponível em todos os contextos (detalhe e listagem)
        const enrollBtnHtml = (isParticipating && isAberto) ? `
             <button class="btn btn-sm btn-danger hover-lift" onclick="event.stopPropagation(); window.deenrollCurrentUser('${t.id}')">🛑 Desinscrever-se</button>
          ` : (isAberto ? `
             <button class="btn btn-sm btn-success hover-lift" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')">✅ Inscrever-se</button>
          ` : '');

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
        const toggleRegBtn = (!hasDraw && !isLigaOpenEnroll && isOrg) ? `<button class="btn ${t.status === 'closed' ? 'btn-success' : 'btn-danger'} hover-lift" onclick="event.stopPropagation(); window.toggleRegistrationStatus('${t.id}')">${t.status === 'closed' ? '✅ Reabrir Inscrições' : '🛑 Encerrar Inscrições'}</button>` : '';

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
            const inviteModalHtml = `
             <div id="invite-modal-${t.id}" class="invite-modal-container" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9999; align-items: flex-start; justify-content: center; cursor: default; overflow-y: auto; padding: 1.5rem 1rem; box-sizing: border-box;" onclick="event.stopPropagation()">
                <div style="background: var(--bg-card); width: calc(100% - 2rem); max-width: 380px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.4); animation: fadeIn 0.2s ease; margin: 0 auto; box-sizing: border-box; overflow: hidden;">

                   <!-- Header -->
                   <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                      <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-bright);">Convidar Jogadores</h3>
                      <button style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; line-height: 1;" onclick="event.stopPropagation(); closeInviteModal('${t.id}')">&times;</button>
                   </div>

                   <div style="padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; box-sizing: border-box; overflow: hidden;">

                      <!-- 0. Convidar Amigos -->
                      <div>
                         <button class="btn btn-success btn-block hover-lift" id="invite-friends-btn-${t.id}" style="font-size:0.95rem; padding:12px 16px;" onclick="event.stopPropagation(); window._inviteFriendsToTournament('${t.id}', '${inviteTextSafe}')">
                            👥 Convidar Amigos${(window.AppStore.currentUser && window.AppStore.currentUser.friends && window.AppStore.currentUser.friends.length > 0) ? ' (' + window.AppStore.currentUser.friends.length + ')' : ''}
                         </button>
                         <div id="invite-friends-status-${t.id}" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.4rem; text-align: center;"></div>
                      </div>
                      <div style="height: 1px; background: var(--border-color);"></div>

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
                         <button class="btn btn-whatsapp btn-block hover-lift" onclick="window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent('${inviteTextSafe}'), '_blank')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Enviar via WhatsApp
                         </button>
                      </div>

                      <div style="height: 1px; background: var(--border-color);"></div>

                      <!-- 3. Copiar Link -->
                      <div>
                         <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 0.5rem;">Link do Torneio</div>
                         <div style="display: flex; gap: 8px; align-items: stretch;">
                            <input type="text" readonly value="${inviteUrl}" id="invite-url-${t.id}" style="flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main); font-size: 0.75rem; min-width: 0; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;" onclick="this.select()">
                            <button class="btn btn-primary btn-sm hover-lift" onclick="navigator.clipboard.writeText(document.getElementById('invite-url-${t.id}').value); showNotification('Copiado!', 'Link copiado.', 'success')">Copiar</button>
                         </div>
                         <div style="margin-top: 6px;">
                            <button style="background: none; border: none; color: var(--primary-color); font-size: 0.75rem; cursor: pointer; padding: 0; text-decoration: underline;" onclick="navigator.clipboard.writeText('${inviteTextSafe}'); showNotification('Copiado!', 'Convite completo copiado.', 'success')">Copiar convite completo com nome do torneio</button>
                         </div>
                      </div>

                      <div style="height: 1px; background: var(--border-color);"></div>

                      <!-- 4. Email -->
                      <div>
                         <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 0.5rem;">Enviar por E-mail</div>
                         <div style="display: flex; gap: 8px; align-items: stretch;">
                            <input type="email" placeholder="email@exemplo.com" id="invite-email-${t.id}" style="flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main); font-size: 0.8rem; min-width: 0; box-sizing: border-box;">
                            <button class="btn btn-indigo btn-sm hover-lift" onclick="var email = document.getElementById('invite-email-${t.id}').value; if(!email){showNotification('Atenção','Digite um e-mail.','warning');return;} window.open('mailto:' + email + '?subject=' + encodeURIComponent('Convite: ${t.name}') + '&body=' + encodeURIComponent('${inviteTextSafe}'), '_self'); showNotification('E-mail', 'Abrindo seu cliente de e-mail...', 'info');">Enviar</button>
                         </div>
                      </div>

                   </div>

                   <!-- Footer -->
                   <div style="padding: 0.75rem 1.25rem 1rem; text-align: center;">
                      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); closeInviteModal('${t.id}')">Fechar</button>
                   </div>
                </div>
             </div>
          `;

            const editModalHtml = '';

            const tournamentStarted = !!t.tournamentStarted;

            if (isOrg) {
                // Botão "Iniciar Torneio" — SÓ aparece após sorteio realizado, antes de iniciar
                const startTournamentBanner = (hasDraw && !tournamentStarted) ? `
                  <div style="margin-top:1.5rem;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1));border:2px solid rgba(16,185,129,0.4);border-radius:16px;text-align:center;">
                      <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Sorteio realizado. Inicie o torneio para habilitar a chamada de presença.</p>
                      <button class="btn btn-success btn-cta hover-lift" onclick="event.stopPropagation(); window._startTournament('${t.id}')">
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
                                        <div style="font-weight:700;color:#94a3b8;font-size:0.95rem;">${_2nd}</div>
                                        <div style="font-size:0.7rem;color:var(--text-muted);">2º Lugar</div>
                                    </div>
                                    <div style="text-align:center;order:0;">
                                        <div style="font-size:2.5rem;">🥇</div>
                                        <div style="font-weight:800;color:#fbbf24;font-size:1.2rem;">${_1st}</div>
                                        <div style="font-size:0.75rem;color:#fbbf24;font-weight:600;">Campeão</div>
                                    </div>
                                    ${_3rd ? `<div style="text-align:center;order:2;">
                                        <div style="font-size:1.5rem;">🥉</div>
                                        <div style="font-weight:700;color:#cd7f32;font-size:0.9rem;">${_3rd}</div>
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
                                        '<div style="font-weight:' + (i === 0 ? '800' : '700') + ';color:' + _colors[i] + ';font-size:' + _sizes[i] + ';">' + (s.name || s.player) + '</div>' +
                                        '<div style="font-size:0.7rem;color:var(--text-muted);">' + s.points + ' pts</div>' +
                                    '</div>';
                                }).join('')}
                            </div>
                        </div>`;
                    }
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${podiumHtml}
                 `;
                } else if (hasDraw) {
                    // Sorteio já feito — mostrar Iniciar Torneio ou badge Em Andamento
                    actionsHtml = `
                   ${inviteModalHtml}
                   ${isLigaFormat ? '' : startTournamentBanner}
                   ${isLigaFormat ? '' : startedBadge}
                   ${autoDrawCountdownHtml ? `<div style="margin-top:1rem;text-align:center;">${autoDrawCountdownHtml}</div>` : ''}
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
                // Non-logged-in user viewing public tournament — show only enroll CTA if open
                if (isAberto) {
                    actionsHtml = `
                   ${teamEnrollModalHtml}
                   <div style="margin-top:1.5rem;padding:24px;background:linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12));border:2px solid rgba(16,185,129,0.5);border-radius:16px;text-align:center;">
                      <h3 style="color:#4ade80;font-size:1.3rem;font-weight:800;margin-bottom:6px;">Participe deste torneio!</h3>
                      <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:16px;">Fa\u00E7a login para se inscrever. Voc\u00EA ser\u00E1 inscrito automaticamente.</p>
                      <button class="btn btn-success btn-cta hover-lift" onclick="event.stopPropagation(); window.enrollCurrentUser('${t.id}')">
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
                     <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.3);" onclick="typeof openEnrollModal === 'function' && openEnrollModal('${t.id}')">Convites</button>
                     <button class="btn btn-sm hover-lift" style="background: rgba(255,255,255,0.2); color: white; border: none; font-weight: 600;" onclick="window.location.hash='#rules/${t.id}'">Regras</button>
                  </div>
               </div>
             `;
            }
        } else {
            actionsHtml = `
            ${teamEnrollModalHtml}
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
            ${enrollBtnHtml ? `<div style="display: flex; flex-direction: column; align-items: flex-end; margin-top: 6px; gap: 4px;">
               ${enrollBtnHtml}
               ${tournamentId ? `<div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6;">Inscrição: ${enrollmentText}</div>` : ''}
            </div>` : (tournamentId ? `<div style="display: flex; justify-content: flex-end; margin-top: 6px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6;">Inscrição: ${enrollmentText}</div>` : '')}

            <!-- Middle Left: Nome + Logo + Favorito -->
            <div style="display: flex; align-items: center; gap: 14px; margin: 1.8rem 0 0.5rem 0;">
              ${t.logoData ? `<img src="${t.logoData}" alt="Logo" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">` : ''}
              <h4 style="margin: 0; font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; text-align: left; flex: 1;">
                ${t.name}
              </h4>
              ${tournamentId ? `<span data-fav-id="${t.id}" onclick="event.stopPropagation(); window._toggleFavorite('${t.id}', event)" title="${(typeof window._isFavorite === 'function' && window._isFavorite(t.id)) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" style="font-size:1.8rem;cursor:pointer;flex-shrink:0;color:${(typeof window._isFavorite === 'function' && window._isFavorite(t.id)) ? '#fbbf24' : 'rgba(255,255,255,0.4)'};transition:color 0.2s;line-height:1;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${(typeof window._isFavorite === 'function' && window._isFavorite(t.id)) ? '★' : '☆'}</span>` : ''}
            </div>
            ${tournamentId ? `<div style="margin-bottom: 1rem; display: flex; gap: 8px; flex-wrap: wrap;">
              ${isAberto ? `<button class="btn btn-warning btn-sm hover-lift" onclick="event.stopPropagation(); openInviteModal('${t.id}')">📤 Convidar</button>` : ''}
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
                 <span>${t.venue}${t.courtCount > 1 ? ' — ' + t.courtCount + ' quadras' : t.courtCount === 1 ? ' — 1 quadra' : ''}</span>
                 ${t.venueAddress ? '<span style="font-size:0.75rem; font-weight:400; opacity:0.7;">' + t.venueAddress + '</span>' : ''}
               </span>
               ${t.venueLat && t.venueLon ? '<a href="' + (t.venuePlaceId ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.venue) + '&query_place_id=' + t.venuePlaceId : 'https://www.google.com/maps/search/?api=1&query=' + t.venueLat + ',' + t.venueLon) + '" target="_blank" title="Ver no mapa" style="color:#818cf8; text-decoration:none; font-size:1rem; flex-shrink:0;">🗺️</a>' : ''}
            </div>` : ''}

            <!-- Linha separadora -->
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1.8rem 0;"></div>

            <!-- Bottom Section -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center;">

               <!-- Stats Column -->
                <div style="display: inline-flex; flex-direction: column; gap: 8px; width: 100%;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start;">
                        <div class="stat-box">
                           <span style="font-size: 1.1rem; margin-right: 4px;">👤</span>
                           <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${individualCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; opacity: 0.8;">Inscritos</span>
                        </div>
                        ${teamCount > 0 ? `
                        <div class="stat-box">
                           <span style="font-size: 1.1rem; margin-right: 4px;">👥</span>
                           <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; opacity: 0.8;">Equipes</span>
                        </div>
                        ` : ''}
                        ${standbyCount > 0 ? `
                        <div class="stat-box" style="background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3);">
                           <span style="font-size: 1.1rem; margin-right: 4px;">⏳</span>
                           <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; color: #fbbf24;">${standbyCount}</span>
                           <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; color: #fbbf24; opacity: 0.9;">Lista de Espera</span>
                        </div>
                        ` : ''}
                    </div>
                    ${(typeof window._buildCategoryCountHtml === 'function') ? window._buildCategoryCountHtml(t) : ''}
                </div>

               <!-- Formato, Regras e Categorias -->
               <div class="info-box">
                  <div><strong>Formato:</strong> ${t.format}</div>
                  <div><strong>Acesso:</strong> ${publicText}</div>
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
              // Registration deadline countdown
              if (isAberto && t.registrationLimit && !isFinished) {
                var _regDate = new Date(t.registrationLimit);
                if (!isNaN(_regDate.getTime())) {
                  var _daysLeft = Math.ceil((_regDate - new Date()) / 86400000);
                  if (_daysLeft > 0 && _daysLeft <= 14) {
                    var _urgPillClass = _daysLeft <= 2 ? 'info-pill-red' : (_daysLeft <= 5 ? 'info-pill-amber' : 'info-pill-purple');
                    var _urgColor = _daysLeft <= 2 ? '#ef4444' : (_daysLeft <= 5 ? '#f59e0b' : '#818cf8');
                    _html += '<div class="info-pill ' + _urgPillClass + '" style="margin-top: 8px;">';
                    _html += '<span style="font-size: 1rem;">⏰</span>';
                    _html += '<span style="color: ' + _urgColor + ';">Inscrições encerram em ' + _daysLeft + ' dia' + (_daysLeft > 1 ? 's' : '') + '</span>';
                    _html += '</div>';
                  }
                }
              }
              // Start date countdown
              if (!isFinished && !sorteioRealizado && t.startDate) {
                var _startDate2 = new Date(t.startDate);
                if (!isNaN(_startDate2.getTime())) {
                  var _startDays2 = Math.ceil((_startDate2 - new Date()) / 86400000);
                  if (_startDays2 === 0) {
                    _html += '<div class="info-pill info-pill-green" style="margin-top: 8px;">';
                    _html += '<span style="font-size: 1rem;">🏁</span>';
                    _html += '<span style="color: #10b981; font-weight: 700;">Começa hoje!</span>';
                    _html += '</div>';
                  } else if (_startDays2 > 0 && _startDays2 <= 30) {
                    var _startPillClass = _startDays2 <= 1 ? 'info-pill-green' : (_startDays2 <= 3 ? 'info-pill-blue' : 'info-pill-purple');
                    var _startColor2 = _startDays2 <= 1 ? '#10b981' : (_startDays2 <= 3 ? '#3b82f6' : '#818cf8');
                    _html += '<div class="info-pill ' + _startPillClass + '" style="margin-top: 8px;">';
                    _html += '<span style="font-size: 1rem;">' + (_startDays2 <= 1 ? '🏁' : '📅') + '</span>';
                    _html += '<span style="color: ' + _startColor2 + ';">' + (_startDays2 <= 1 ? 'Começa amanhã!' : 'Começa em ' + _startDays2 + ' dia' + (_startDays2 > 1 ? 's' : '')) + '</span>';
                    _html += '</div>';
                  }
                }
              }
              return _html;
            })()}

            ${actionsHtml}

            ${(tournamentId && isOrg) ? `
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.12);">
              <div style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.35); margin-bottom: 10px;">Ferramentas do Organizador</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${hasDraw ? `<button class="btn btn-primary hover-lift" onclick="window._lastActiveTournamentId='${t.id}';window.location.hash='#bracket/${t.id}'">🏆 Ver Chaves</button>` : ''}
                ${t.status !== 'closed' ? `<button class="btn btn-indigo hover-lift" onclick="event.stopPropagation(); window.openEditModal('${t.id}')">✏️ Editar</button>` : ''}
                ${t.status !== 'closed' ? `<button class="btn btn-purple hover-lift" onclick="event.stopPropagation(); window._sendOrgCommunication('${t.id}')">📢 Comunicar</button>` : ''}
                ${addParticipantBtns}
                ${t.status !== 'closed' ? `<button class="btn btn-danger-ghost hover-lift" onclick="event.stopPropagation(); window.addBotsFunction('${t.id}')">🤖 Add Bot</button>` : ''}
                ${hasDraw ? `<button class="btn btn-tool-green hover-lift" onclick="event.stopPropagation(); window._exportTournamentCSV('${t.id}')">📊 Exportar CSV</button>` : ''}
                ${window.AppStore.currentUser ? `<button class="btn btn-tool-purple hover-lift" onclick="event.stopPropagation(); window._cloneTournament('${t.id}')">📑 Clonar</button>` : ''}
                ${categoriasBtn}
                ${toggleRegBtn}
                ${sortearBtn}
                ${sortearAberto}
                ${(!isFinished && hasDraw && !window._isLigaFormat(t)) ? `<button class="btn btn-tool-amber hover-lift" onclick="event.stopPropagation(); window.finishTournament('${t.id}')">🏁 Encerrar Torneio</button>` : ''}
                <button class="btn btn-danger-ghost hover-lift" onclick="event.stopPropagation(); window.deleteTournamentFunction('${t.id}')">🗑️ Apagar</button>
              </div>
            </div>` : ''}

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
      <button class="btn btn-outline btn-sm hover-lift" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px;" onclick="window.location.hash='#dashboard'">
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

                    const _ciSeed = encodeURIComponent(ind.name);
                    const _ciAvatar = (window._playerPhotoCache && window._playerPhotoCache[ind.name.toLowerCase()] && window._playerPhotoCache[ind.name.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[ind.name.toLowerCase()] : 'https://api.dicebear.com/9.x/initials/svg?seed=' + _ciSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                    const _ciFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _ciSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';

                    return `
                      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${mc ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)'};border:1px solid ${mc ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'};${isVipCI ? 'border-left:3px solid #fbbf24;' : ''}transition:all 0.2s;cursor:pointer;" onclick="window._toggleCheckIn('${t.id}', '${ind.name.replace(/'/g, "\\'")}')">
                          <input type="checkbox" ${mc ? 'checked' : ''} onclick="event.stopPropagation(); window._toggleCheckIn('${t.id}', '${ind.name.replace(/'/g, "\\'")}');" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer;flex-shrink:0;" />
                          <img src="${_ciAvatar}" onerror="this.onerror=null;this.src='${_ciFallback}'" data-player-name="${ind.name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${mc ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'};" />
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
                            const _mSeed = encodeURIComponent(n);
                            const _mPhoto = (window._playerPhotoCache && window._playerPhotoCache[n.toLowerCase()] && window._playerPhotoCache[n.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[n.toLowerCase()] : 'https://api.dicebear.com/9.x/initials/svg?seed=' + _mSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                            const _mFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _mSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                            return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;overflow:hidden;"><img src="${_mPhoto}" onerror="this.onerror=null;this.src='${_mFallback}'" data-player-name="${n}" style="width:${i === 0 ? '24px' : '20px'};height:${i === 0 ? '24px' : '20px'};border-radius:50%;object-fit:cover;flex-shrink:0;"><span style="font-weight:${i === 0 ? '700' : '500'};font-size:${i === 0 ? '0.95rem' : '0.85rem'};color:${i === 0 ? 'var(--text-bright)' : 'var(--text-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${n}">${n}</span></div>`;
                        }).join('');
                    } else {
                        const _pSeed = encodeURIComponent(pName);
                        const _pPhoto = (window._playerPhotoCache && window._playerPhotoCache[pName.toLowerCase()] && window._playerPhotoCache[pName.toLowerCase()].indexOf('dicebear.com') === -1) ? window._playerPhotoCache[pName.toLowerCase()] : 'https://api.dicebear.com/9.x/initials/svg?seed=' + _pSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                        const _pFallback = 'https://api.dicebear.com/9.x/initials/svg?seed=' + _pSeed + '&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf';
                        pNameHtml = `<div style="display:flex;align-items:center;gap:8px;overflow:hidden;"><img src="${_pPhoto}" onerror="this.onerror=null;this.src='${_pFallback}'" data-player-name="${pName}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;"><span style="font-weight:600;font-size:0.95rem;color:var(--text-bright);text-overflow:ellipsis;white-space:nowrap;overflow:hidden;" title="${pName}">${pName}</span></div>`;
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

                    const bgNum = isVip ? '⭐' : idx + 1;

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
                      <div class="participant-card" data-participant-name="${pName.replace(/"/g, '&quot;')}" ${dragProps} style="${cardStyle} border-radius:12px;padding:10px 12px;position:relative;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);transition:all 0.2s;${!drawDone && isOrg ? 'cursor:grab;' : ''}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
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
          <button class="btn btn-outline btn-sm hover-lift" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px;" onclick="window.location.hash='#dashboard'">
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

    // Check category notifications for current user on this tournament
    if (tournamentId) {
        var _nt = window.AppStore.tournaments.find(function(x) { return String(x.id) === String(tournamentId); });
        if (_nt && window._checkCategoryNotifications) {
            window._checkCategoryNotifications(_nt);
        }
        // Check poll notifications
        if (_nt && window._checkPollNotifications) {
            window._checkPollNotifications(_nt);
        }
    }

    // Renderiza a chave de forma transparente associada a esse torneio
    if (hasDrawn && typeof renderBracket === 'function') {
        const inlineContainer = document.getElementById('inline-bracket-container');
        if (inlineContainer) {
            renderBracket(inlineContainer, tournamentId, true);
        }
    }

    // Build activity log
    if (tournamentId && typeof window._buildActivityLog === 'function') {
        window._buildActivityLog(tournamentId);
    }
}
