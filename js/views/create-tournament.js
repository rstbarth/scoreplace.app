function setupCreateTournamentModal() {
  if (!document.getElementById('modal-create-tournament')) {
    const modalHtml = `
      <div class="modal-overlay" id="modal-create-tournament">
        <div class="modal" style="max-width: 800px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; max-height: 90vh; overflow-y: auto; overflow-x: hidden;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding: 1.25rem 1.5rem; position: sticky; top: 0; background: var(--bg-card); z-index: 10;">
            <h2 class="card-title" id="create-modal-title">Criar Novo Torneio</h2>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-secondary" onclick="document.getElementById('modal-create-tournament').classList.remove('active')">Cancelar</button>
              <button class="btn btn-primary" id="btn-save-tournament">Salvar Torneio</button>
            </div>
          </div>
          <div class="modal-body" style="padding: 1.5rem; color: var(--text-main); overflow-x: hidden; max-width: 100%; box-sizing: border-box;">
            <form id="form-create-tournament" onsubmit="event.preventDefault();" style="max-width: 100%; overflow-x: hidden;">
              <input type="hidden" id="edit-tournament-id">

              <!-- Nome e Modalidade -->
              <div class="d-flex gap-2 mb-3">
                <div class="form-group full-width">
                  <label class="form-label">Nome do Torneio</label>
                  <input type="text" class="form-control" id="tourn-name" placeholder="Ex: Copa de Inverno 2026" required>
                </div>
                <div class="form-group full-width">
                  <label class="form-label">Modalidade</label>
                  <select class="form-control" id="select-sport" onchange="window._onSportChange()">
                    <option>🎾 Beach Tennis</option>
                    <option>⚽ Futebol</option>
                    <option>🃏 Magic / TCG</option>
                    <option>🎾 Tênis</option>
                    <option>🏐 Vôlei</option>
                    <option>♟️ Xadrez</option>
                    <option>🏅 Outro</option>
                  </select>
                </div>
              </div>

              <!-- Formato -->
              <div class="form-group mb-3">
                <label class="form-label">Formato do Torneio</label>
                <select class="form-control" id="select-formato" onchange="window._onFormatoChange()">
                  <option value="elim_simples">Eliminatórias Simples — eliminação na primeira derrota</option>
                  <option value="elim_dupla">Dupla Eliminatória — eliminação na segunda derrota</option>
                  <option value="grupos_mata">Fase de Grupos + Eliminatórias — estilo Copa do Mundo</option>
                  <option value="suico">Suíço Clássico — pontos corridos com emparelhamentos por pontos</option>
                  <option value="liga">Liga — temporada com duração definida pelo organizador</option>
                </select>
              </div>

              <!-- Público/Privado -->
              <div class="form-group mb-2">
                <label class="form-label d-flex align-center" style="gap:10px; cursor:pointer;">
                  <input type="checkbox" id="tourn-public" checked style="width:18px; height:18px;">
                  <span style="font-weight:bold; color:var(--text-color);">Torneio Público</span>
                </label>
                <small class="text-muted" style="display:block; margin-left:28px;">Se desmarcado, apenas você e seus jogadores convidados poderão ver o torneio.</small>
              </div>

              <!-- Campos específicos: Fase de Grupos -->
              <div id="grupos-fields" style="display:none; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Configurações da Fase de Grupos</p>
                <div class="d-flex gap-2">
                  <div class="form-group full-width">
                    <label class="form-label">Número de Grupos</label>
                    <input type="number" class="form-control" id="grupos-count" min="2" max="16" value="4" placeholder="Ex: 4">
                    <small class="text-muted" style="display:block;margin-top:4px;">Os participantes serão distribuídos igualmente entre os grupos.</small>
                  </div>
                  <div class="form-group full-width">
                    <label class="form-label">Classificados por Grupo</label>
                    <input type="number" class="form-control" id="grupos-classified" min="1" max="4" value="2" placeholder="Ex: 2">
                    <small class="text-muted" style="display:block;margin-top:4px;">Quantos avançam de cada grupo para as eliminatórias.</small>
                  </div>
                </div>
              </div>

              <!-- Campos específicos: Suíço -->
              <div id="suico-fields" style="display:none; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #818cf8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Configurações do Suíço</p>
                <div class="d-flex gap-2">
                  <div class="form-group full-width">
                    <label class="form-label">Número de Rodadas</label>
                    <input type="number" class="form-control" id="suico-rounds" min="2" max="20" value="5" placeholder="Ex: 5">
                    <small class="text-muted" style="display:block;margin-top:4px;">Para ${32} jogadores, recomenda-se 5 rodadas (log₂ de participantes).</small>
                  </div>
                </div>
              </div>

              <!-- Campos específicos: Liga -->
              <div id="liga-fields" style="display:none; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #34d399; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Configurações da Liga</p>
                <div class="d-flex gap-2 mb-2">
                  <div class="form-group full-width">
                    <label class="form-label">Periodicidade das Rodadas</label>
                    <select class="form-control" id="liga-periodicity">
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="monthly">Mensal</option>
                      <option value="custom">Definida pelo organizador</option>
                    </select>
                  </div>
                  <div class="form-group full-width">
                    <label class="form-label">Pontuação de Novos Inscritos</label>
                    <select class="form-control" id="liga-new-player-score">
                      <option value="zero">Zero absoluto</option>
                      <option value="min">Mínima atual da tabela</option>
                      <option value="avg">Média atual da tabela</option>
                      <option value="organizer">Organizador decide na hora</option>
                    </select>
                  </div>
                </div>
                <div class="d-flex gap-2">
                  <div class="form-group full-width">
                    <label class="form-label">Regra de Inatividade</label>
                    <select class="form-control" id="liga-inactivity">
                      <option value="keep">Manter pontos</option>
                      <option value="decay">Decaimento fixo por rodada</option>
                      <option value="remove">Remover após X rodadas sem jogar</option>
                    </select>
                  </div>
                  <div class="form-group full-width" id="liga-inactivity-x-container" style="display:none;">
                    <label class="form-label">Rodadas sem jogar para remoção</label>
                    <input type="number" class="form-control" id="liga-inactivity-x" min="1" value="3">
                  </div>
                </div>
                <div class="form-group mt-2">
                  <label class="form-label d-flex align-center" style="gap:10px; cursor:pointer;">
                    <input type="checkbox" id="liga-open-enrollment" checked style="width:18px;height:18px;">
                    <span style="font-weight:bold; color:var(--text-color);">Inscrições abertas durante toda a temporada</span>
                  </label>
                </div>
              </div>

              <!-- Local e Quadras -->
              <div id="venue-photo-box" style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #34d399; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Local e Quadras</p>
                <div class="mb-2">
                  <div class="form-group" style="flex:1;">
                    <label class="form-label">Local do Evento</label>
                    <div style="position:relative;" id="venue-autocomplete-container">
                      <input type="text" class="form-control" id="tourn-venue" placeholder="Ex: Clube Esportivo Municipal, Arena Beach Park"
                        style="flex:1; width:100%;" autocomplete="off">
                      <div id="venue-suggestions" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:9999; background:#1e293b; border:1px solid rgba(255,255,255,0.15); border-radius:8px; margin-top:4px; max-height:220px; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.5);"></div>
                    </div>
                    <div id="venue-osm-info" style="display:none; margin-top:5px; font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:5px;"></div>
                    <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                      <button type="button" id="btn-access-public" onclick="window._toggleVenueAccess('public')"
                        style="padding:6px 14px; border-radius:8px; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-size:0.8rem; font-weight:500; cursor:pointer; transition:all 0.15s; white-space:nowrap; display:flex; align-items:center; gap:5px;">
                        🌐 Aberto ao público
                      </button>
                      <button type="button" id="btn-access-members" onclick="window._toggleVenueAccess('members')"
                        style="padding:6px 14px; border-radius:8px; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-size:0.8rem; font-weight:500; cursor:pointer; transition:all 0.15s; white-space:nowrap; display:flex; align-items:center; gap:5px;">
                        🏅 Apenas sócios
                      </button>
                      <button type="button" id="btn-access-invite" onclick="window._toggleVenueAccess('invite')"
                        style="padding:6px 14px; border-radius:8px; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-size:0.8rem; font-weight:500; cursor:pointer; transition:all 0.15s; white-space:nowrap; display:flex; align-items:center; gap:5px;">
                        ✉️ Com convite
                      </button>
                    </div>
                    <input type="hidden" id="tourn-venue-access" value="">
                    <input type="hidden" id="tourn-venue-lat" value="">
                    <input type="hidden" id="tourn-venue-lon" value="">
                    <input type="hidden" id="tourn-venue-address" value="">
                    <input type="hidden" id="tourn-venue-place-id" value="">
                    <input type="hidden" id="tourn-venue-photo-url" value="">
                  </div>
                </div>
                <div class="courts-row" style="display:flex; gap:10px; align-items:flex-start; margin-bottom:0.5rem;">
                  <div class="form-group courts-count-field" style="flex:0 0 100px;">
                    <label class="form-label">Quadras</label>
                    <input type="number" class="form-control" id="tourn-court-count" min="1" max="50" value="1" style="text-align:center;" oninput="window._onCourtCountChange()">
                  </div>
                  <div class="form-group" style="flex:1; min-width:0;">
                    <label class="form-label">Nomes das Quadras/Campos <small style="opacity:0.6;">(separados por vírgula)</small></label>
                    <input type="text" class="form-control" id="tourn-court-names" placeholder="Ex: Quadra Central, Quadra 1, Quadra 2" style="width:100%;" oninput="window._onCourtNamesInput()">
                    <small class="text-muted" style="display:block;margin-top:4px;" id="court-names-hint">Deixe em branco para numeração automática (Quadra 1, Quadra 2...).</small>
                  </div>
                </div>
              </div>

              <!-- Datas e Horários -->
              <div class="dates-row" style="display:flex; gap:10px; margin-bottom:0.75rem; align-items:stretch; flex-wrap:wrap;">
                <div id="reg-date-container" style="flex:1; min-width:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 10px;">
                  <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Encerramento Inscrições</div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="date" class="form-control" id="tourn-reg-date" style="padding:4px 6px; font-size:0.82rem; flex:1; min-width:0;" oninput="window._recalcDuration()">
                    <input type="time" class="form-control" id="tourn-reg-time" style="padding:4px 6px; font-size:0.82rem; width:80px; flex-shrink:0;" oninput="window._recalcDuration()">
                  </div>
                </div>
                <div style="flex:1; min-width:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 10px;">
                  <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Início do Torneio</div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="date" class="form-control" id="tourn-start-date" style="padding:4px 6px; font-size:0.82rem; flex:1; min-width:0;" required oninput="window._recalcDuration(); window._checkWeather()">
                    <input type="time" class="form-control" id="tourn-start-time" style="padding:4px 6px; font-size:0.82rem; width:80px; flex-shrink:0;" oninput="window._recalcDuration()">
                  </div>
                </div>
                <div style="flex:1; min-width:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 10px;">
                  <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Fim do Torneio</div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="date" class="form-control" id="tourn-end-date" style="padding:4px 6px; font-size:0.82rem; flex:1; min-width:0;" required oninput="window._recalcDuration()">
                    <input type="time" class="form-control" id="tourn-end-time" style="padding:4px 6px; font-size:0.82rem; width:80px; flex-shrink:0;" oninput="window._recalcDuration()">
                  </div>
                </div>
              </div>

              <!-- Weather Forecast -->
              <div id="weather-forecast" style="display:none; margin-bottom:0.75rem; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:10px; padding:10px 14px;">
                <div style="font-size:0.7rem; font-weight:600; color:#60a5fa; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Previsão do Tempo</div>
                <div id="weather-content"></div>
              </div>

              <!-- Estimativas de Tempo -->
              <div style="background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Estimativas de Tempo</p>
                <div class="d-flex gap-2 mb-2">
                  <div class="form-group full-width">
                    <label class="form-label">Chamada dos Jogadores</label>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <input type="number" class="form-control" id="tourn-call-time" min="0" max="60" value="5" style="flex:1;" oninput="window._recalcDuration()">
                      <span style="font-size:0.85rem;color:var(--text-muted);white-space:nowrap;">min</span>
                    </div>
                    <small class="text-muted" style="display:block;margin-top:4px;">Tempo para chamar e reunir os jogadores na quadra.</small>
                  </div>
                  <div class="form-group full-width">
                    <label class="form-label">Aquecimento</label>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <input type="number" class="form-control" id="tourn-warmup-time" min="0" max="60" value="5" style="flex:1;" oninput="window._recalcDuration()">
                      <span style="font-size:0.85rem;color:var(--text-muted);white-space:nowrap;">min</span>
                    </div>
                    <small class="text-muted" style="display:block;margin-top:4px;">Tempo de aquecimento antes do jogo.</small>
                  </div>
                  <div class="form-group full-width">
                    <label class="form-label">Duração Média do Jogo</label>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <input type="number" class="form-control" id="tourn-game-duration" min="5" max="300" value="30" style="flex:1;" oninput="window._recalcDuration()">
                      <span style="font-size:0.85rem;color:var(--text-muted);white-space:nowrap;">min</span>
                    </div>
                    <small class="text-muted" style="display:block;margin-top:4px;">Duração estimada de cada partida.</small>
                  </div>
                </div>

                <!-- Estimativa Calculada -->
                <div id="duration-estimate-box" style="display:none; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; padding: 0.75rem 1rem; margin-top: 0.5rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                      <span style="font-size:0.8rem; color:#f59e0b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Duração Estimada</span>
                      <div id="duration-estimate-text" style="font-size:1.1rem; font-weight:bold; color:var(--text-bright); margin-top:2px;">—</div>
                    </div>
                    <div id="duration-estimate-detail" style="font-size:0.8rem; color:var(--text-muted); text-align:right;">
                    </div>
                  </div>
                  <div id="duration-warning" style="display:none; margin-top:8px; padding:6px 10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:6px; font-size:0.8rem; color:#f87171;">
                  </div>
                  <div id="capacity-warning" style="display:none; margin-top:8px; padding:6px 10px; border-radius:6px; font-size:0.8rem;">
                  </div>
                  <div id="suggestions-panel" style="display:none; margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                  </div>
                </div>
              </div>

              <!-- Inscrição e Limite -->
              <div class="d-flex gap-2 mb-3">
                <div class="form-group full-width">
                  <label class="form-label">Máx. Participantes</label>
                  <input type="number" class="form-control" id="tourn-max-participants" min="2" placeholder="Sem limite" oninput="window._updateAutoCloseVisibility(); window._recalcDuration()">
                </div>
                <div class="form-group full-width">
                  <label class="form-label">Modo de Inscrição</label>
                  <select class="form-control" id="select-inscricao" onchange="window._onInscricaoChange()">
                    <option value="individual">Individual</option>
                    <option value="time">Apenas Times</option>
                    <option value="misto">Misto (Individual e Times)</option>
                  </select>
                </div>
              </div>

              <!-- Tamanho do Time (aparece quando modo != individual) -->
              <div id="team-size-container" style="display:none;" class="mb-3">
                <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:1rem;">
                  <p style="margin:0 0 0.5rem;font-size:0.8rem;color:#a78bfa;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Configuração de Times</p>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Jogadores por Time</label>
                    <input type="number" class="form-control" id="tourn-team-size" min="2" max="11" value="2" placeholder="Ex: 2 para duplas, 5 para quintetos">
                    <small class="text-muted" style="display:block;margin-top:4px;">2 = duplas, 3 = trios, 5 = quintetos, etc.</small>
                  </div>
                </div>
              </div>

              <!-- Auto-close (apenas eliminatórias) -->
              <div class="form-group mb-3" id="auto-close-container" style="display:none;">
                <label class="form-label d-flex align-center" style="gap:10px; cursor:pointer;">
                  <input type="checkbox" id="tourn-auto-close" style="width:18px;height:18px;">
                  <span style="font-weight:bold;color:var(--text-color);">⚡ Encerrar inscrições automaticamente ao atingir o limite</span>
                </label>
                <small class="text-muted" style="display:block;margin-left:28px;">Disponível apenas quando o máximo for uma potência de 2 (4, 8, 16, 32...) e o formato for Eliminatórias.</small>
              </div>

              <!-- Lançamento de Resultados -->
              <div class="form-group mb-3">
                <label class="form-label">Quem pode lançar resultados</label>
                <select class="form-control" id="select-result-entry">
                  <option value="organizer">Apenas o Organizador</option>
                  <option value="players">Pelos próprios jogadores (com aceitação do adversário)</option>
                  <option value="referee">Árbitro designado pelo organizador</option>
                </select>
              </div>

              <!-- Classificação -->
              <div id="elim-settings" style="display:none; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #f87171; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Classificação</p>
                <div class="form-group mb-2">
                  <label class="form-label d-flex align-center" style="gap:10px; cursor:pointer;">
                    <input type="checkbox" id="elim-third-place" checked style="width:18px;height:18px;">
                    <span style="font-weight:bold; color:var(--text-color);">Disputa de 3º e 4º lugar</span>
                  </label>
                </div>
                <div class="form-group">
                  <label class="form-label">Classificação final</label>
                  <select class="form-control" id="elim-ranking-type">
                    <option value="individual">Individual — cada participante recebe uma colocação específica</option>
                    <option value="blocks">Em blocos — eliminados na mesma fase compartilham a colocação</option>
                  </select>
                </div>
              </div>

              <!-- Critérios de Desempate -->
              <div id="tiebreaker-section" style="background: rgba(88,166,255,0.06); border: 1px solid rgba(88,166,255,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.5rem; font-size: 0.8rem; color: #58a6ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Critérios de Desempate (arraste para reordenar)</p>
                <small class="text-muted" style="display:block;margin-bottom:0.75rem;">Os critérios serão aplicados na ordem abaixo. Arraste para alterar a prioridade.</small>
                <ul id="tiebreaker-list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;">
                  <li draggable="true" data-tb="confronto_direto" ontouchstart="window._onTiebreakerTouchStart(event)" ontouchmove="window._onTiebreakerTouchMove(event)" ontouchend="window._onTiebreakerTouchEnd(event)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;cursor:grab;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-bright);user-select:none;"><span style="opacity:0.4;">⠿</span> Confronto Direto</li>
                  <li draggable="true" data-tb="saldo_pontos" ontouchstart="window._onTiebreakerTouchStart(event)" ontouchmove="window._onTiebreakerTouchMove(event)" ontouchend="window._onTiebreakerTouchEnd(event)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;cursor:grab;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-bright);user-select:none;"><span style="opacity:0.4;">⠿</span> Saldo de Pontos</li>
                  <li draggable="true" data-tb="vitorias" ontouchstart="window._onTiebreakerTouchStart(event)" ontouchmove="window._onTiebreakerTouchMove(event)" ontouchend="window._onTiebreakerTouchEnd(event)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;cursor:grab;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-bright);user-select:none;"><span style="opacity:0.4;">⠿</span> Número de Vitórias</li>
                  <li draggable="true" data-tb="buchholz" ontouchstart="window._onTiebreakerTouchStart(event)" ontouchmove="window._onTiebreakerTouchMove(event)" ontouchend="window._onTiebreakerTouchEnd(event)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;cursor:grab;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-bright);user-select:none;"><span style="opacity:0.4;">⠿</span> Força dos Adversários <small style="opacity:0.5; font-size:0.75rem;">(Buchholz)</small></li>
                  <li draggable="true" data-tb="sonneborn_berger" ontouchstart="window._onTiebreakerTouchStart(event)" ontouchmove="window._onTiebreakerTouchMove(event)" ontouchend="window._onTiebreakerTouchEnd(event)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;cursor:grab;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-bright);user-select:none;"><span style="opacity:0.4;">⠿</span> Qualidade das Vitórias <small style="opacity:0.5; font-size:0.75rem;">(Sonneborn-Berger)</small></li>
                  <li draggable="true" data-tb="sorteio" ontouchstart="window._onTiebreakerTouchStart(event)" ontouchmove="window._onTiebreakerTouchMove(event)" ontouchend="window._onTiebreakerTouchEnd(event)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;cursor:grab;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-bright);user-select:none;"><span style="opacity:0.4;">⠿</span> Sorteio</li>
                </ul>
              </div>

              <!-- Categorias -->
              <div class="form-group mb-3">
                <label class="form-label">Categorias (Opcional — separe por vírgula)</label>
                <input type="text" class="form-control" id="tourn-categories" placeholder="Ex: A, B, C, D, FUN">
                <small class="text-muted mt-1" style="display:block;">Deixe em branco para torneio Categoria Única. FUN = iniciantes.</small>
              </div>

            </form>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(createInteractiveElement(modalHtml));

    // Add Google Places Autocomplete styling for dark theme
    if (!document.getElementById('google-places-style')) {
      const style = document.createElement('style');
      style.id = 'google-places-style';
      style.textContent = `
        .pac-container {
          background-color: var(--bg-card) !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
          color: var(--text-main) !important;
        }
        .pac-item {
          padding: 10px 14px !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          cursor: pointer !important;
          transition: background 0.1s !important;
        }
        .pac-item:hover {
          background-color: rgba(255,255,255,0.06) !important;
        }
        .pac-item-selected {
          background-color: rgba(99,102,241,0.2) !important;
        }
        .pac-item-query {
          font-size: 0.85rem !important;
          font-weight: 600 !important;
          color: var(--text-bright) !important;
        }
        .pac-matched {
          font-weight: 700 !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Setup tiebreaker drag-and-drop
    const tbList = document.getElementById('tiebreaker-list');
    if (tbList) {
      let dragItem = null;
      tbList.addEventListener('dragstart', (e) => {
        dragItem = e.target.closest('li');
        if (dragItem) {
          dragItem.style.opacity = '0.4';
          e.dataTransfer.effectAllowed = 'move';
        }
      });
      tbList.addEventListener('dragend', (e) => {
        if (dragItem) dragItem.style.opacity = '1';
        dragItem = null;
        tbList.querySelectorAll('li').forEach(li => li.style.borderTop = '');
      });
      tbList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('li');
        if (target && target !== dragItem) {
          tbList.querySelectorAll('li').forEach(li => li.style.borderTop = '');
          target.style.borderTop = '2px solid #58a6ff';
        }
      });
      tbList.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('li');
        if (target && dragItem && target !== dragItem) {
          tbList.insertBefore(dragItem, target);
        }
        tbList.querySelectorAll('li').forEach(li => li.style.borderTop = '');
      });

      // Touch drag-and-drop for tiebreaker criteria
      let _touchDragEl = null;
      let _touchDragClone = null;

      window._onTiebreakerTouchStart = function(e) {
        const item = e.target.closest('[draggable]');
        if (!item) return;
        _touchDragEl = item;
        _touchDragClone = item.cloneNode(true);
        _touchDragClone.style.position = 'fixed';
        _touchDragClone.style.opacity = '0.7';
        _touchDragClone.style.pointerEvents = 'none';
        _touchDragClone.style.zIndex = '9999';
        _touchDragClone.style.width = item.offsetWidth + 'px';
        document.body.appendChild(_touchDragClone);
        const touch = e.touches[0];
        _touchDragClone.style.left = touch.clientX + 'px';
        _touchDragClone.style.top = touch.clientY + 'px';
        item.style.opacity = '0.3';
      };

      window._onTiebreakerTouchMove = function(e) {
        if (!_touchDragEl) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (_touchDragClone) {
          _touchDragClone.style.left = touch.clientX + 'px';
          _touchDragClone.style.top = (touch.clientY - 20) + 'px';
        }
      };

      window._onTiebreakerTouchEnd = function(e) {
        if (!_touchDragEl) return;
        if (_touchDragClone) _touchDragClone.remove();
        _touchDragEl.style.opacity = '1';

        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetItem = target ? target.closest('[draggable]') : null;

        if (targetItem && targetItem !== _touchDragEl) {
          const container = _touchDragEl.parentNode;
          const items = Array.from(container.querySelectorAll('[draggable]'));
          const fromIdx = items.indexOf(_touchDragEl);
          const toIdx = items.indexOf(targetItem);
          if (fromIdx < toIdx) {
            container.insertBefore(_touchDragEl, targetItem.nextSibling);
          } else {
            container.insertBefore(_touchDragEl, targetItem);
          }
        }

        _touchDragEl = null;
        _touchDragClone = null;
      };
    }
  }

  const _sportTeamDefaults = {
    'Beach Tennis': 2, 'Futebol': 5, 'Magic / TCG': 1, 'Tênis': 1,
    'Vôlei': 6, 'Xadrez': 1, 'Outro': 2
  };

  window._onSportChange = function () {
    const sportSelect = document.getElementById('select-sport');
    if (!sportSelect) return;

    // Set default team size for sport
    const teamSizeEl = document.getElementById('tourn-team-size');
    if (teamSizeEl) {
      const sportName = sportSelect.options[sportSelect.selectedIndex] ? sportSelect.options[sportSelect.selectedIndex].text.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
      const defaultSize = _sportTeamDefaults[sportName] || 2;
      teamSizeEl.value = defaultSize;
    }
  };

  window._onFormatoChange = function () {
    const fmt = document.getElementById('select-formato').value;
    const isElim = fmt === 'elim_simples' || fmt === 'elim_dupla';
    const isSuico = fmt === 'suico';
    const isLiga = fmt === 'liga';
    const isGrupos = fmt === 'grupos_mata';

    document.getElementById('suico-fields').style.display = isSuico ? 'block' : 'none';
    document.getElementById('liga-fields').style.display = isLiga ? 'block' : 'none';
    document.getElementById('elim-settings').style.display = (isElim || isGrupos) ? 'block' : 'none';
    document.getElementById('grupos-fields').style.display = isGrupos ? 'block' : 'none';

    window._updateAutoCloseVisibility();
    window._updateRegDateVisibility();
    window._onInscricaoChange();
    window._recalcDuration();
  };

  window._onInscricaoChange = function () {
    const mode = document.getElementById('select-inscricao').value;
    const container = document.getElementById('team-size-container');
    if (container) {
      container.style.display = (mode === 'individual') ? 'none' : 'block';
    }
  };

  window._updateRegDateVisibility = function () {
    const fmt = document.getElementById('select-formato').value;
    const regBox = document.getElementById('reg-date-container');
    if (!regBox) return;
    const isLiga = fmt === 'liga';
    const openEnroll = document.getElementById('liga-open-enrollment');
    regBox.style.display = (isLiga && openEnroll && openEnroll.checked) ? 'none' : '';
  };

  window._toggleVenueAccess = function (key) {
    const hiddenEl = document.getElementById('tourn-venue-access');
    if (!hiddenEl) return;
    const current = hiddenEl.value ? hiddenEl.value.split(',') : [];
    // 'public' and 'members' are mutually exclusive
    let next;
    if (key === 'public' || key === 'members') {
      const isActive = current.includes(key);
      // Remove both exclusive options, then toggle the clicked one
      next = current.filter(v => v !== 'public' && v !== 'members');
      if (!isActive) next.push(key);
    } else {
      // 'invite' is free toggle
      next = current.includes(key) ? current.filter(v => v !== key) : [...current, key];
    }
    hiddenEl.value = next.join(',');
    window._applyVenueAccessUI(next);
  };

  window._applyVenueAccessUI = function (values) {
    const baseStyle = 'padding:6px 14px; border-radius:8px; font-size:0.8rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; display:flex; align-items:center; gap:5px;';
    const on  = baseStyle + 'border:2px solid #6366f1; background:rgba(99,102,241,0.22); color:#c7d2fe; font-weight:700; box-shadow:0 0 0 1px rgba(99,102,241,0.3);';
    const off = baseStyle + 'border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-weight:500; box-shadow:none;';
    const pub = document.getElementById('btn-access-public');
    const mem = document.getElementById('btn-access-members');
    const inv = document.getElementById('btn-access-invite');
    if (pub) pub.style.cssText = values.includes('public')  ? on : off;
    if (mem) mem.style.cssText = values.includes('members') ? on : off;
    if (inv) inv.style.cssText = values.includes('invite')  ? on : off;
  };

  // --- Google Places venue search (programmatic — no Google UI elements injected) ---
  let _placesLibLoaded = false;
  let _placesInitialized = false;
  let _venueSearchTimer = null;
  const OPENWEATHER_API_KEY = '';  // Get free key from openweathermap.org

  window._initPlacesAutocomplete = function () {
    if (_placesInitialized) return;

    var input = document.getElementById('tourn-venue');
    var suggestionsDiv = document.getElementById('venue-suggestions');
    if (!input || !suggestionsDiv) return;

    _placesInitialized = true;

    // Load the Google Places library in the background (non-blocking)
    if (typeof google !== 'undefined' && google.maps && google.maps.importLibrary) {
      google.maps.importLibrary('places').then(function () {
        _placesLibLoaded = true;
        console.log('Google Places library loaded');
      }).catch(function (err) {
        console.warn('Google Places library load failed:', err.message);
      });
    } else {
      // Retry loading after 2s if Google Maps base not ready yet
      _placesInitialized = false;
      setTimeout(window._initPlacesAutocomplete, 2000);
      return;
    }

    // --- Debounced search on input ---
    input._lastSelectedVenue = input.value || '';
    input.addEventListener('input', function () {
      clearTimeout(_venueSearchTimer);
      var query = input.value.trim();

      // If user changed the venue text, clear old venue data and photo
      if (query !== input._lastSelectedVenue) {
        var latEl = document.getElementById('tourn-venue-lat');
        var lonEl = document.getElementById('tourn-venue-lon');
        var addrEl = document.getElementById('tourn-venue-address');
        var placeIdEl = document.getElementById('tourn-venue-place-id');
        var photoUrlEl = document.getElementById('tourn-venue-photo-url');
        if (latEl) latEl.value = '';
        if (lonEl) lonEl.value = '';
        if (addrEl) addrEl.value = '';
        if (placeIdEl) placeIdEl.value = '';
        if (photoUrlEl) photoUrlEl.value = '';
        window._applyVenuePhoto('');
        var infoEl = document.getElementById('venue-osm-info');
        if (infoEl) { infoEl.style.display = 'none'; infoEl.innerHTML = ''; }
      }

      if (query.length < 3) {
        suggestionsDiv.style.display = 'none';
        suggestionsDiv.innerHTML = '';
        return;
      }
      _venueSearchTimer = setTimeout(function () {
        window._searchVenue(query);
      }, 350);
    });

    // Close suggestions on blur (with delay for click to register)
    input.addEventListener('blur', function () {
      setTimeout(function () { suggestionsDiv.style.display = 'none'; }, 200);
    });

    // Reopen on focus if there's text
    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 3 && suggestionsDiv.children.length > 0) {
        suggestionsDiv.style.display = 'block';
      }
    });
  };

  // --- Search venue using Google Places AutocompleteSuggestion (New API) ---
  window._searchVenue = async function (query) {
    var suggestionsDiv = document.getElementById('venue-suggestions');
    if (!suggestionsDiv) return;

    // Wait for library
    if (!_placesLibLoaded) {
      suggestionsDiv.innerHTML = '<div style="padding:10px 14px; color:#94a3b8; font-size:0.8rem;">Carregando API do Google...</div>';
      suggestionsDiv.style.display = 'block';
      return;
    }

    try {
      var request = {
        input: query,
        includedRegionCodes: ['br'],
        includedPrimaryTypes: ['establishment', 'geocode'],
        language: 'pt-BR'
      };

      var result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      var suggestions = result.suggestions || [];

      if (suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<div style="padding:10px 14px; color:#94a3b8; font-size:0.8rem;">Nenhum resultado encontrado</div>';
        suggestionsDiv.style.display = 'block';
        return;
      }

      suggestionsDiv.innerHTML = '';
      suggestions.forEach(function (suggestion) {
        if (!suggestion.placePrediction) return;
        var pred = suggestion.placePrediction;
        var mainText = pred.mainText ? pred.mainText.text : '';
        var secondaryText = pred.secondaryText ? pred.secondaryText.text : '';

        var item = document.createElement('div');
        item.style.cssText = 'padding:10px 14px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.06); transition:background 0.15s;';
        item.innerHTML = '<div style="color:#e2e8f0; font-size:0.85rem; font-weight:500;">📍 ' +
          mainText + '</div>' +
          (secondaryText ? '<div style="color:#94a3b8; font-size:0.75rem; margin-top:2px;">' + secondaryText + '</div>' : '');

        item.addEventListener('mouseenter', function () { item.style.background = 'rgba(129,140,248,0.15)'; });
        item.addEventListener('mouseleave', function () { item.style.background = 'transparent'; });
        item.addEventListener('mousedown', function (e) {
          e.preventDefault(); // Prevent blur
          window._selectVenueSuggestion(pred);
        });

        suggestionsDiv.appendChild(item);
      });

      suggestionsDiv.style.display = 'block';
    } catch (err) {
      console.error('Venue search error:', err);
      suggestionsDiv.innerHTML = '<div style="padding:10px 14px; color:#f87171; font-size:0.8rem;">Erro na busca: ' + (err.message || 'API indisponível') + '</div>';
      suggestionsDiv.style.display = 'block';
    }
  };

  // --- Select a venue suggestion and fetch place details ---
  window._selectVenueSuggestion = async function (prediction) {
    var suggestionsDiv = document.getElementById('venue-suggestions');
    if (suggestionsDiv) { suggestionsDiv.style.display = 'none'; suggestionsDiv.innerHTML = ''; }

    try {
      var place = prediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'types', 'addressComponents', 'id', 'photos']
      });

      var input = document.getElementById('tourn-venue');
      var infoEl = document.getElementById('venue-osm-info');
      var latEl = document.getElementById('tourn-venue-lat');
      var lonEl = document.getElementById('tourn-venue-lon');

      // Extract city
      var city = '';
      if (place.addressComponents) {
        for (var i = 0; i < place.addressComponents.length; i++) {
          var comp = place.addressComponents[i];
          if (comp.types && (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality'))) {
            city = comp.longText || '';
            break;
          }
        }
      }

      var name = place.displayName || '';
      var displayName = name + (city ? ', ' + city : '');
      var fullAddress = place.formattedAddress || displayName;

      if (input) {
        input.value = displayName;
        // Update the tracked venue name so input listener doesn't clear it
        input._lastSelectedVenue = displayName;
      }
      if (latEl && place.location) latEl.value = place.location.lat();
      if (lonEl && place.location) lonEl.value = place.location.lng();
      var addrEl = document.getElementById('tourn-venue-address');
      if (addrEl) addrEl.value = fullAddress;
      var placeIdEl = document.getElementById('tourn-venue-place-id');
      if (placeIdEl) placeIdEl.value = place.id || '';

      // Extract venue photo from Google Places
      var venuePhotoUrl = '';
      var photoUrlEl = document.getElementById('tourn-venue-photo-url');
      if (place.photos && place.photos.length > 0) {
        try {
          venuePhotoUrl = place.photos[0].getURI({ maxWidth: 800, maxHeight: 400 });
        } catch (photoErr) {
          console.warn('Could not get photo URI:', photoErr);
        }
      }
      if (photoUrlEl) photoUrlEl.value = venuePhotoUrl;
      window._applyVenuePhoto(venuePhotoUrl);

      if (infoEl) {
        infoEl.style.display = 'flex';
        var encodedName = encodeURIComponent(name);
        var mapsUrl = place.id
          ? 'https://www.google.com/maps/search/?api=1&query=' + encodedName + '&query_place_id=' + place.id
          : 'https://www.google.com/maps/search/?api=1&query=' + place.location.lat() + ',' + place.location.lng();
        infoEl.innerHTML = '<span style="display:flex; flex-direction:column; gap:2px;">' +
          '<span style="font-weight:500; color:#e2e8f0;">📍 ' + name + '</span>' +
          '<span style="color:#94a3b8; font-size:0.7rem;">' + fullAddress + '</span>' +
          '</span>' +
          ' &nbsp;<a href="' + mapsUrl + '" target="_blank" title="Ver no mapa" style="color:#818cf8; text-decoration:none; font-size:1.1rem; line-height:1; flex-shrink:0;">🗺️</a>';
      }

      // Infer access from types
      var types = place.types || [];
      var suggested = [];
      if (types.includes('gym') || types.includes('stadium') || types.includes('sports_complex')) {
        suggested.push('members');
      } else {
        suggested.push('public');
      }
      var accessEl = document.getElementById('tourn-venue-access');
      if (accessEl) accessEl.value = suggested.join(',');
      window._applyVenueAccessUI(suggested);
      if (typeof showNotification === 'function') {
        var labels = { public: 'Aberto ao público', members: 'Apenas sócios', invite: 'Com convite' };
        showNotification('Local encontrado', 'Acesso sugerido: ' + suggested.map(function (s) { return labels[s] || s; }).join(' + '), 'success');
      }

      window._checkWeather();
    } catch (err) {
      console.error('Place details fetch error:', err);
      if (typeof showNotification === 'function') {
        showNotification('Erro', 'Não foi possível obter detalhes do local: ' + (err.message || ''), 'error');
      }
    }
  };

  // Apply venue photo as background on the Local e Quadras box
  window._applyVenuePhoto = function (photoUrl) {
    // Find the "Local e Quadras" section box by ID
    var box = document.getElementById('venue-photo-box');
    if (!box) return;

    if (photoUrl) {
      box.style.backgroundImage = 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 100%), url(' + photoUrl + ')';
      box.style.backgroundSize = 'cover';
      box.style.backgroundPosition = 'center';
      box.style.backgroundRepeat = 'no-repeat';
      box.style.borderColor = 'rgba(16,185,129,0.3)';
    } else {
      box.style.backgroundImage = '';
      box.style.backgroundSize = '';
      box.style.backgroundPosition = '';
      box.style.backgroundRepeat = '';
      box.style.borderColor = '';
    }
  };

  window._inferVenueAccess = function (types) {
    const suggested = [];
    if (types.includes('gym') || types.includes('stadium') || types.includes('sports_complex')) {
      suggested.push('members');
    } else if (types.includes('park') || types.includes('neighborhood')) {
      suggested.push('public');
    } else {
      suggested.push('public');
    }
    return suggested;
  };

  // --- Weather forecast ---
  let _checkWeatherTimer = null;

  window._checkWeather = function () {
    clearTimeout(_checkWeatherTimer);
    _checkWeatherTimer = setTimeout(() => {
      const lat = document.getElementById('tourn-venue-lat').value;
      const lon = document.getElementById('tourn-venue-lon').value;
      const startDate = document.getElementById('tourn-start-date').value;
      const weatherDiv = document.getElementById('weather-forecast');
      const weatherContent = document.getElementById('weather-content');

      if (!lat || !lon || !startDate || !weatherDiv || !weatherContent) {
        if (weatherDiv) weatherDiv.style.display = 'none';
        return;
      }

      // If no API key, hide weather
      if (!OPENWEATHER_API_KEY) {
        weatherDiv.style.display = 'none';
        return;
      }

      // Fetch weather data
      fetch('https://api.openweathermap.org/data/2.5/forecast?lat=' + lat + '&lon=' + lon +
        '&appid=' + OPENWEATHER_API_KEY + '&units=metric&lang=pt_br')
        .then(r => r.json())
        .then(data => {
          if (!data.list || !Array.isArray(data.list)) {
            weatherDiv.style.display = 'none';
            return;
          }

          // Parse start date
          const startTs = new Date(startDate).getTime();
          const now = new Date().getTime();

          // Check if date is within 5 days
          if (startTs - now > 5 * 24 * 60 * 60 * 1000) {
            weatherDiv.style.display = 'block';
            weatherContent.innerHTML = '<div style="font-size:0.8rem; color:#cbd5e1;">Previsão disponível apenas para os próximos 5 dias</div>';
            return;
          }

          // Find closest forecast entry
          let closest = null;
          let minDiff = Infinity;
          for (const entry of data.list) {
            const entryTs = entry.dt * 1000;
            const diff = Math.abs(entryTs - startTs);
            if (diff < minDiff) {
              minDiff = diff;
              closest = entry;
            }
          }

          if (!closest) {
            weatherDiv.style.display = 'none';
            return;
          }

          const weather = closest.main || {};
          const weatherInfo = (closest.weather && closest.weather[0]) || {};
          const temp = Math.round(weather.temp || 0);
          const tempMin = Math.round(weather.temp_min || 0);
          const tempMax = Math.round(weather.temp_max || 0);
          const humidity = weather.humidity || 0;
          const description = weatherInfo.description || '';
          const icon = weatherInfo.icon || '01d';

          const iconUrl = 'https://openweathermap.org/img/wn/' + icon + '@2x.png';
          const tempDisplay = tempMin + '°C - ' + tempMax + '°C';

          weatherDiv.style.display = 'block';
          weatherContent.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' +
            '<img src="' + iconUrl + '" alt="weather" style="width:40px; height:40px;">' +
            '<div style="flex:1;">' +
            '<div style="font-size:0.85rem; font-weight:600; color:#a5b4fc;">' + tempDisplay + '</div>' +
            '<div style="font-size:0.75rem; color:#cbd5e1; text-transform:capitalize; margin-top:2px;">' + description + '</div>' +
            '<div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">Umidade: ' + humidity + '%</div>' +
            '</div></div>';
        })
        .catch(() => {
          weatherDiv.style.display = 'none';
        });
    }, 500);
  };

  window._onLigaInactivityChange = function () {
    const val = document.getElementById('liga-inactivity').value;
    const xContainer = document.getElementById('liga-inactivity-x-container');
    if (xContainer) xContainer.style.display = val === 'remove' ? 'block' : 'none';
  };

  // Wire up inactivity change
  setTimeout(() => {
    const el = document.getElementById('liga-inactivity');
    if (el) el.addEventListener('change', window._onLigaInactivityChange);
    // Wire up liga open enrollment checkbox to hide/show registration date
    const openEnrollEl = document.getElementById('liga-open-enrollment');
    if (openEnrollEl) openEnrollEl.addEventListener('change', window._updateRegDateVisibility);
  }, 100);

  window._updateAutoCloseVisibility = function () {
    const fmt = document.getElementById('select-formato');
    const maxEl = document.getElementById('tourn-max-participants');
    const container = document.getElementById('auto-close-container');
    if (!fmt || !maxEl || !container) return;
    const isElim = fmt.value === 'elim_simples' || fmt.value === 'elim_dupla';
    const maxVal = parseInt(maxEl.value);
    const isPow2 = maxVal > 0 && (maxVal & (maxVal - 1)) === 0;
    container.style.display = (isElim && isPow2) ? 'block' : 'none';
  };

  // --- Court count change: auto-generate placeholder names ---
  window._onCourtCountChange = function () {
    const count = parseInt(document.getElementById('tourn-court-count').value) || 1;
    const namesEl = document.getElementById('tourn-court-names');
    if (!namesEl) return;
    const placeholder = [];
    for (let i = 1; i <= count; i++) placeholder.push('Quadra ' + i);
    namesEl.placeholder = placeholder.join(', ');
    window._recalcDuration();
  };

  // --- Court names input: sync count from named courts ---
  window._onCourtNamesInput = function () {
    const namesEl = document.getElementById('tourn-court-names');
    const countEl = document.getElementById('tourn-court-count');
    const hintEl = document.getElementById('court-names-hint');
    if (!namesEl || !countEl) return;
    const names = namesEl.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (names.length > 0) {
      countEl.value = names.length;
      if (hintEl) hintEl.textContent = names.length + ' quadra' + (names.length > 1 ? 's' : '') + ' definida' + (names.length > 1 ? 's' : '') + ': ' + names.join(', ');
    } else {
      if (hintEl) hintEl.textContent = 'Deixe em branco para numeração automática (Quadra 1, Quadra 2...).';
    }
    window._recalcDuration();
  };

  // --- Duration estimation calculator ---
  window._recalcDuration = function () {
    const box = document.getElementById('duration-estimate-box');
    if (!box) return;

    const callTime = parseInt(document.getElementById('tourn-call-time').value) || 0;
    const warmup = parseInt(document.getElementById('tourn-warmup-time').value) || 0;
    const gameDur = parseInt(document.getElementById('tourn-game-duration').value) || 0;
    const courts = parseInt(document.getElementById('tourn-court-count').value) || 1;
    const maxParts = parseInt(document.getElementById('tourn-max-participants').value) || 0;
    const fmt = document.getElementById('select-formato').value;
    const startDateStr = document.getElementById('tourn-start-date').value || '';
    const startTimeStr = document.getElementById('tourn-start-time').value || '';
    const endDateStr = document.getElementById('tourn-end-date').value || '';
    const endTimeStr = document.getElementById('tourn-end-time').value || '';
    const startStr = startTimeStr ? startDateStr + 'T' + startTimeStr : startDateStr;
    const endStr = endTimeStr ? endDateStr + 'T' + endTimeStr : endDateStr;

    const slotTime = callTime + warmup + gameDur; // total minutes per match slot

    if (slotTime <= 0) { box.style.display = 'none'; return; }

    const n = maxParts || 0;

    // Helper: calculate match count for a given format key + participant count
    const _calcMatchesFor = (fmtKey, pCount) => {
      if (pCount < 2) return 0;
      if (fmtKey === 'elim_simples') return pCount - 1;
      if (fmtKey === 'elim_dupla') return (pCount - 1) * 2 + 1;
      if (fmtKey === 'suico') {
        const sr = parseInt(document.getElementById('suico-rounds').value) || 5;
        return sr * Math.floor(pCount / 2);
      }
      if (fmtKey === 'liga') return pCount * (pCount - 1) / 2;
      if (fmtKey === 'grupos_mata') {
        const groups = parseInt(document.getElementById('grupos-count').value) || 4;
        const classified = parseInt(document.getElementById('grupos-classified').value) || 2;
        const pg = Math.ceil(pCount / groups);
        const gm = groups * (pg * (pg - 1) / 2);
        const km = groups * classified > 0 ? groups * classified - 1 : 0;
        return gm + km;
      }
      return 0;
    };
    const _calcMatches = (pCount) => _calcMatchesFor(fmt, pCount);

    // Helper: for elimination, calc play-in matches needed to reach power of 2
    const _isPow2 = (v) => v > 0 && (v & (v - 1)) === 0;
    const _nextPow2 = (v) => { let p = 1; while (p < v) p *= 2; return p; };
    const _prevPow2 = (v) => { let p = 1; while (p * 2 <= v) p *= 2; return p; };

    const _elimDetail = (pCount) => {
      // Returns { totalMatches, playInMatches, mainMatches, playInParticipants, nextP2 }
      if (pCount < 2) return { totalMatches: 0, playInMatches: 0, mainMatches: 0, playInParticipants: 0, nextP2: 0 };
      if (_isPow2(pCount)) return { totalMatches: pCount - 1, playInMatches: 0, mainMatches: pCount - 1, playInParticipants: 0, nextP2: pCount };
      const next = _nextPow2(pCount);
      const playInNeeded = pCount - next / 2; // how many play-in matches to reduce to next/2
      // Actually: with N participants, next power = nextPow2(N). Excess = N - next/2.
      // PlayIn matches = excess (those excess players play to reduce field to next/2)
      // But that means 2*excess players participate in play-in, and excess winners join the rest
      // Wait — standard approach: excess = N - prevPow2(N). PlayIn = excess matches. 2*excess players play, excess advance.
      const prev = _prevPow2(pCount);
      const excess = pCount - prev; // number of play-in matches
      return {
        totalMatches: pCount - 1, // always N-1 for single elim
        playInMatches: excess,
        mainMatches: prev - 1,
        playInParticipants: excess * 2,
        nextP2: prev
      };
    };

    // Helper: calc time for a participant count considering play-in rounds
    const _calcTimeFor = (fmtKey, pCount) => {
      const matches = _calcMatchesFor(fmtKey, pCount);
      const rnds = Math.ceil(matches / courts);
      return rnds * slotTime;
    };

    // Helper: for elimination, calc time considering play-in as extra round(s)
    const _calcElimTimeDetailed = (pCount) => {
      const detail = _elimDetail(pCount);
      if (detail.playInMatches === 0) {
        const rnds = Math.ceil(detail.mainMatches / courts);
        return { total: rnds * slotTime, playInRounds: 0, mainRounds: rnds };
      }
      const playInRnds = Math.ceil(detail.playInMatches / courts);
      const mainRnds = Math.ceil(detail.mainMatches / courts);
      return { total: (playInRnds + mainRnds) * slotTime, playInRounds: playInRnds, mainRounds: mainRnds };
    };

    // Calculate available time
    let availableMin = 0;
    let hasTimeWindow = false;
    if (startStr && endStr) {
      const startDt = new Date(startStr);
      const endDt = new Date(endStr);
      availableMin = (endDt - startDt) / 60000;
      if (availableMin > 0) hasTimeWindow = true;
    }

    const warnEl = document.getElementById('duration-warning');
    const capEl = document.getElementById('capacity-warning');
    const sugEl = document.getElementById('suggestions-panel');
    warnEl.style.display = 'none';
    capEl.style.display = 'none';
    sugEl.style.display = 'none';
    sugEl.innerHTML = '';

    // Helper: format minutes to Xh Ymin
    const _fmtMin = (m) => {
      const h = Math.floor(m / 60); const mm = Math.round(m % 60);
      if (h > 0 && mm > 0) return h + 'h ' + mm + 'min';
      if (h > 0) return h + 'h';
      return mm + 'min';
    };

    // Helper: powers of 2 up to val (>= 4)
    const _nearPow2 = (val) => {
      const results = [];
      let p = 4;
      while (p <= 1024) {
        if (p <= val) results.push(p);
        p *= 2;
      }
      return results.slice(-3);
    };

    // Helper: calc max feasible for a given format key
    const _calcMaxForFmt = (fmtKey, totalSlots) => {
      if (totalSlots <= 0) return 0;
      if (fmtKey === 'elim_simples') return totalSlots + 1;
      if (fmtKey === 'elim_dupla') return Math.floor((totalSlots + 1) / 2);
      if (fmtKey === 'liga') return Math.floor((1 + Math.sqrt(1 + 8 * totalSlots)) / 2);
      if (fmtKey === 'suico') {
        const sr = parseInt(document.getElementById('suico-rounds').value) || 5;
        return Math.floor(totalSlots / sr) * 2;
      }
      if (fmtKey === 'grupos_mata') {
        const groups = parseInt(document.getElementById('grupos-count').value) || 4;
        const classified = parseInt(document.getElementById('grupos-classified').value) || 2;
        for (let test = totalSlots + 1; test >= 2; test--) {
          const pg = Math.ceil(test / groups);
          const gm = groups * (pg * (pg - 1) / 2);
          const km = groups * classified - 1;
          if (gm + km <= totalSlots) return test;
        }
        return 2;
      }
      return 0;
    };
    const _calcMaxFeasible = (totalSlots) => _calcMaxForFmt(fmt, totalSlots);

    // Helper: describe a participant option with match count + p2 info
    const _descOption = (fmtKey, pCount) => {
      const matches = _calcMatchesFor(fmtKey, pCount);
      const time = _calcTimeFor(fmtKey, pCount);
      let desc = '<strong>' + pCount + '</strong> participantes → <strong>' + matches + ' jogos</strong> (~' + _fmtMin(time) + ')';
      if ((fmtKey === 'elim_simples' || fmtKey === 'elim_dupla') && !_isPow2(pCount) && pCount > 2) {
        const det = _elimDetail(pCount);
        desc += ' <span style="opacity:0.7;">[' + det.playInMatches + ' classificatória' + (det.playInMatches > 1 ? 's' : '') + ' + ' + det.mainMatches + ' chave principal]</span>';
      }
      return desc;
    };

    // Helper: for elimination, build power-of-2 options table within a slot budget
    const _buildP2Table = (maxSlots) => {
      const isElim = fmt === 'elim_simples' || fmt === 'elim_dupla';
      if (!isElim) return '';
      const pows = _nearPow2(_calcMaxFeasible(maxSlots));
      if (pows.length === 0) return '';
      let rows = pows.map(p => {
        const m = _calcMatchesFor(fmt, p);
        const t = _calcTimeFor(fmt, p);
        return '<div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.04);">' +
          '<span><strong>' + p + '</strong> participantes</span>' +
          '<span style="opacity:0.7;">' + m + ' jogos · ' + _fmtMin(t) + '</span></div>';
      }).join('');
      return '<div style="margin-top:4px; font-size:0.75rem;">' +
        '<div style="opacity:0.6; margin-bottom:2px;">Potências de 2 (sem classificatórias):</div>' + rows + '</div>';
    };

    // Helper: for non-p2, describe fastest resolution
    const _p2Resolution = (pCount) => {
      const isElim = fmt === 'elim_simples' || fmt === 'elim_dupla';
      if (!isElim || _isPow2(pCount) || pCount < 3) return '';
      const prev = _prevPow2(pCount);
      const next = _nextPow2(pCount);
      const excess = pCount - prev;
      const byes = next - pCount;

      // Option A: play-in to reduce to prev (excess matches)
      const playInTime = Math.ceil(excess / courts) * slotTime;
      // Option B: add BYEs to reach next (no extra matches, but bracket is next size)
      const matchesWithByes = (fmt === 'elim_simples') ? next - 1 : (next - 1) * 2 + 1;
      const matchesPlayIn = (fmt === 'elim_simples') ? pCount - 1 : (pCount - 1) * 2 + 1;
      const timeWithByes = Math.ceil(matchesWithByes / courts) * slotTime;
      const timePlayIn = _calcTimeFor(fmt, pCount);

      let html = '<div style="margin-top:6px; padding:6px 8px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.15); border-radius:6px; font-size:0.75rem;">';
      html += '<div style="font-weight:600; color:#fbbf24; margin-bottom:4px;">⚡ ' + pCount + ' não é potência de 2 — soluções:</div>';

      // Play-in
      html += '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);">' +
        '<span>Classificatórias: <strong>' + excess + '</strong> jogos extras (' + (excess * 2) + ' participantes jogam), chave principal de ' + prev + '</span>' +
        '<span style="opacity:0.7;">' + matchesPlayIn + ' jogos · ' + _fmtMin(timePlayIn) + '</span></div>';

      // BYEs
      html += '<div style="display:flex; justify-content:space-between; padding:3px 0;">' +
        '<span>BYEs: <strong>' + byes + '</strong> BYE' + (byes > 1 ? 's' : '') + ', chave de ' + next + ' (alguns avançam direto)</span>' +
        '<span style="opacity:0.7;">' + matchesWithByes + ' jogos · ' + _fmtMin(timeWithByes) + '</span></div>';

      // Recommendation
      if (timePlayIn <= timeWithByes) {
        html += '<div style="margin-top:4px; color:#34d399;">✅ <strong>Classificatórias é mais rápido</strong> — economiza ' + _fmtMin(timeWithByes - timePlayIn) + '</div>';
      } else {
        html += '<div style="margin-top:4px; color:#34d399;">✅ <strong>BYEs é mais rápido</strong> — economiza ' + _fmtMin(timePlayIn - timeWithByes) + '</div>';
      }
      html += '</div>';
      return html;
    };

    // Helper: build a suggestion card html
    const _sugCard = (icon, title, body, btnText, btnAction) => {
      return '<div style="padding:8px 10px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); border-radius:8px; font-size:0.8rem; color:var(--text-main);">' +
        '<div style="display:flex; align-items:flex-start; gap:8px;">' +
        '<span style="font-size:1rem; flex-shrink:0;">' + icon + '</span>' +
        '<div style="flex:1;">' +
        '<div style="font-weight:600; color:var(--text-bright); margin-bottom:2px;">' + title + '</div>' +
        '<div style="color:var(--text-muted); line-height:1.4;">' + body + '</div>' +
        (btnText ? '<button onclick="' + btnAction + '" style="margin-top:6px; padding:4px 12px; background:rgba(99,102,241,0.2); border:1px solid rgba(99,102,241,0.3); border-radius:6px; color:#818cf8; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.15s;">' + btnText + '</button>' : '') +
        '</div></div></div>';
    };

    // Case 1: No participant count but we have a time window → suggest max participants
    if (n < 2 && hasTimeWindow) {
      const maxSlots = Math.floor(availableMin / slotTime) * courts;
      const maxFeasible = _calcMaxFeasible(maxSlots);

      box.style.display = 'block';
      document.getElementById('duration-estimate-text').textContent = slotTime + ' min por partida';
      document.getElementById('duration-estimate-detail').innerHTML =
        courts + ' quadra' + (courts > 1 ? 's' : '') + ' | Tempo disponível: ' + _fmtMin(availableMin);

      if (maxFeasible > 1) {
        capEl.style.display = 'block';
        capEl.style.background = 'rgba(16,185,129,0.1)';
        capEl.style.borderColor = 'rgba(16,185,129,0.25)';
        capEl.style.color = '#34d399';
        const matchesMax = _calcMatchesFor(fmt, maxFeasible);
        let capHtml = '💡 Com <strong>' + _fmtMin(availableMin) + '</strong> e <strong>' + courts +
          ' quadra' + (courts > 1 ? 's' : '') + '</strong>: ' + _descOption(fmt, maxFeasible);
        capHtml += _buildP2Table(maxSlots);
        capEl.innerHTML = capHtml;
      }
      return;
    }

    // Case 2: No participant count and no time window → just show slot info
    if (n < 2) {
      box.style.display = 'block';
      document.getElementById('duration-estimate-text').textContent = slotTime + ' min por partida';
      document.getElementById('duration-estimate-detail').innerHTML = 'Chamada: ' + callTime + 'min + Aquecimento: ' + warmup + 'min + Jogo: ' + gameDur + 'min';
      return;
    }

    // Case 3: Have participant count → full calculation
    const numMatches = _calcMatches(n);
    const isElimFmt = fmt === 'elim_simples' || fmt === 'elim_dupla';
    let totalMinutes, roundCount;

    if (isElimFmt && !_isPow2(n)) {
      const det = _calcElimTimeDetailed(n);
      totalMinutes = det.total;
      roundCount = det.playInRounds + det.mainRounds;
    } else {
      roundCount = Math.ceil(numMatches / courts);
      totalMinutes = roundCount * slotTime;
    }

    let durationText = _fmtMin(totalMinutes);

    box.style.display = 'block';
    let mainEstimate = durationText + ' · ' + numMatches + ' jogos';
    if (isElimFmt && !_isPow2(n) && n > 2) {
      const det = _elimDetail(n);
      mainEstimate += ' <span style="font-size:0.85rem; opacity:0.7;">(' + det.playInMatches + ' classificatória' + (det.playInMatches > 1 ? 's' : '') + ' + ' + det.mainMatches + ' chave)</span>';
    }
    document.getElementById('duration-estimate-text').innerHTML = mainEstimate;
    document.getElementById('duration-estimate-detail').innerHTML =
      courts + ' quadra' + (courts > 1 ? 's' : '') + ' | ' +
      slotTime + 'min/partida | ' +
      roundCount + ' rodada' + (roundCount > 1 ? 's' : '') + ' sequenciais';

    if (hasTimeWindow) {
      const maxSlots = Math.floor(availableMin / slotTime) * courts;
      const maxFeasible = _calcMaxFeasible(maxSlots);
      const usage = availableMin > 0 ? totalMinutes / availableMin : 0;

      // ---- OVERFLOW: exceeds time ----
      if (totalMinutes > availableMin) {
        const overMin = totalMinutes - availableMin;
        warnEl.style.display = 'block';
        warnEl.innerHTML = '⚠️ O torneio pode exceder o horário de fim em <strong>' + _fmtMin(overMin) + '</strong>.';

        capEl.style.display = 'block';
        capEl.style.background = 'rgba(239,68,68,0.1)';
        capEl.style.borderColor = 'rgba(239,68,68,0.25)';
        capEl.style.color = '#f87171';
        let capHtml = 'Com <strong>' + _fmtMin(availableMin) + '</strong> e <strong>' + courts +
          ' quadra' + (courts > 1 ? 's' : '') + '</strong>, máximo: ' + _descOption(fmt, maxFeasible) + '.';
        capEl.innerHTML = capHtml;

        // P2 resolution info
        if (isElimFmt && !_isPow2(n) && n > 2) {
          capEl.innerHTML += _p2Resolution(n);
        }

        // Build smart suggestions
        const suggestions = [];

        // Suggestion 1: Limit enrollments — with p2 options for elimination
        if (isElimFmt) {
          const pows = _nearPow2(maxFeasible);
          let limBody = '';
          if (pows.length > 0) {
            limBody = pows.map(p => _descOption(fmt, p)).join('<br>');
            const bestPow = pows[pows.length - 1];
            suggestions.push(_sugCard('🔒', 'Limitar inscrições (potência de 2)',
              limBody,
              'Aplicar ' + bestPow + ' participantes',
              'document.getElementById(\\\'tourn-max-participants\\\').value=' + bestPow + '; window._recalcDuration()'));
          }
          // Also show non-p2 max as option
          if (!_isPow2(maxFeasible) && maxFeasible > 2) {
            suggestions.push(_sugCard('🔒', 'Limitar em ' + maxFeasible + ' (com classificatórias)',
              _descOption(fmt, maxFeasible) + _p2Resolution(maxFeasible),
              'Aplicar ' + maxFeasible,
              'document.getElementById(\\\'tourn-max-participants\\\').value=' + maxFeasible + '; window._recalcDuration()'));
          }
        } else {
          suggestions.push(_sugCard('🔒', 'Limitar inscrições em ' + maxFeasible,
            _descOption(fmt, maxFeasible),
            'Aplicar ' + maxFeasible,
            'document.getElementById(\\\'tourn-max-participants\\\').value=' + maxFeasible + '; window._recalcDuration()'));
        }

        // Suggestion 2: Extend time
        const extraNeeded = totalMinutes - availableMin;
        const newEndDt = new Date(new Date(endStr).getTime() + extraNeeded * 60000);
        const newEndH = String(newEndDt.getHours()).padStart(2, '0');
        const newEndM = String(newEndDt.getMinutes()).padStart(2, '0');
        const newEndDate = newEndDt.getFullYear() + '-' + String(newEndDt.getMonth() + 1).padStart(2, '0') + '-' + String(newEndDt.getDate()).padStart(2, '0');
        const endDateEl = document.getElementById('tourn-end-date').value || '';
        const sameDay = newEndDate === endDateEl;
        const extLabel = sameDay ? 'Encerrar às ' + newEndH + ':' + newEndM : 'Estender até ' + newEndDate.split('-').reverse().join('/') + ' ' + newEndH + ':' + newEndM;
        suggestions.push(_sugCard('⏰', 'Estender o horário de fim',
          'Adicionando <strong>' + _fmtMin(extraNeeded) + '</strong>: ' + _descOption(fmt, n) + ' cabem no tempo.' + (sameDay ? '' : ' O torneio passaria para mais de 1 dia.'),
          extLabel,
          'document.getElementById(\\\'tourn-end-date\\\').value=\\\'' + newEndDate + '\\\'; document.getElementById(\\\'tourn-end-time\\\').value=\\\'' + newEndH + ':' + newEndM + '\\\'; window._recalcDuration()'));

        // Suggestion 3: Add extra day
        const extraDayMin = availableMin + 480;
        const slotsExtraDay = Math.floor(extraDayMin / slotTime) * courts;
        const maxExtraDay = _calcMaxFeasible(slotsExtraDay);
        if (maxExtraDay > maxFeasible) {
          suggestions.push(_sugCard('📅', 'Adicionar +1 dia (+8h)',
            'Com dia extra: ' + _descOption(fmt, Math.min(n, maxExtraDay)) + (n <= maxExtraDay ? ' — suficiente.' : ' — máx. ' + _descOption(fmt, maxExtraDay) + '.'),
            'Adicionar dia',
            'var d=document.getElementById(\\\'tourn-end-date\\\'); var dt=new Date(d.value); dt.setDate(dt.getDate()+1); d.value=dt.toISOString().split(\\\'T\\\')[0]; window._recalcDuration()'));
        }

        // Suggestion 4: Change format
        const fmtOptions = [
          { key: 'elim_simples', label: 'Eliminatórias Simples', optVal: 'elim_simples' },
          { key: 'suico', label: 'Suíço Clássico', optVal: 'suico' }
        ];
        fmtOptions.forEach(opt => {
          if (opt.key === fmt) return;
          const maxForAlt = _calcMaxForFmt(opt.key, maxSlots);
          if (maxForAlt > maxFeasible && maxForAlt >= n) {
            suggestions.push(_sugCard('🔄', 'Trocar para ' + opt.label,
              _descOption(opt.key, n) + ' — cabe no tempo.',
              'Alterar formato',
              'document.getElementById(\\\'select-formato\\\').value=\\\'' + opt.optVal + '\\\'; window._onFormatoChange()'));
          }
        });

        if (suggestions.length > 0) {
          sugEl.style.display = 'flex';
          sugEl.innerHTML = '<div style="font-size:0.75rem; font-weight:600; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Sugestões do Sistema</div>' + suggestions.join('');
        }

      // ---- NEAR LIMIT: >75% usage ----
      } else if (usage > 0.75) {
        capEl.style.display = 'block';
        capEl.style.background = 'rgba(245,158,11,0.1)';
        capEl.style.borderColor = 'rgba(245,158,11,0.25)';
        capEl.style.color = '#fbbf24';
        const remaining = maxFeasible - n;
        let capHtml = '⏳ Usando <strong>' + Math.round(usage * 100) + '%</strong> do tempo. ' +
          'Cabem mais <strong>' + remaining + '</strong> (máx. ' + _descOption(fmt, maxFeasible) + ').';

        if (isElimFmt && !_isPow2(n) && n > 2) {
          capHtml += _p2Resolution(n);
        }
        capHtml += _buildP2Table(maxSlots);
        capEl.innerHTML = capHtml;

        // Light suggestions
        const suggestions = [];
        if (isElimFmt) {
          const pows = _nearPow2(maxFeasible);
          const bestPow = pows.length > 0 ? pows[pows.length - 1] : null;
          if (bestPow && bestPow >= n) {
            suggestions.push(_sugCard('🔒', 'Encerrar inscrições em ' + bestPow,
              _descOption(fmt, bestPow) + ' — sem classificatórias extras.',
              'Aplicar ' + bestPow,
              'document.getElementById(\\\'tourn-max-participants\\\').value=' + bestPow + '; window._recalcDuration()'));
          }
        } else {
          suggestions.push(_sugCard('🔒', 'Encerrar inscrições em ' + maxFeasible,
            _descOption(fmt, maxFeasible),
            'Aplicar ' + maxFeasible,
            'document.getElementById(\\\'tourn-max-participants\\\').value=' + maxFeasible + '; window._recalcDuration()'));
        }
        if (suggestions.length > 0) {
          sugEl.style.display = 'flex';
          sugEl.innerHTML = '<div style="font-size:0.75rem; font-weight:600; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Sugestões</div>' + suggestions.join('');
        }

      // ---- OK: within limits ----
      } else {
        capEl.style.display = 'block';
        capEl.style.background = 'rgba(16,185,129,0.1)';
        capEl.style.borderColor = 'rgba(16,185,129,0.25)';
        capEl.style.color = '#34d399';
        let okHtml = '✅ Máx: ' + _descOption(fmt, maxFeasible) + '. Você tem <strong>' + n + '</strong> — dentro do limite.';
        if (isElimFmt && !_isPow2(n) && n > 2) {
          okHtml += _p2Resolution(n);
        }
        capEl.innerHTML = okHtml;
      }
    } else if (isElimFmt && !_isPow2(n) && n > 2) {
      // No time window but show p2 resolution anyway
      capEl.style.display = 'block';
      capEl.style.background = 'rgba(245,158,11,0.08)';
      capEl.style.borderColor = 'rgba(245,158,11,0.2)';
      capEl.style.color = '#fbbf24';
      capEl.innerHTML = _p2Resolution(n);
    }
  };

  window.openEditTournamentModal = function (tId) {
    const t = window.AppStore.tournaments.find(tour => tour.id.toString() === tId.toString());
    if (!t) return;

    document.getElementById('create-modal-title').innerText = 'Editar Torneio';
    document.getElementById('edit-tournament-id').value = tId;
    document.getElementById('tourn-name').value = t.name || '';
    // Match sport option even if stored value lacks emoji prefix (legacy data)
    const sportSelect = document.getElementById('select-sport');
    const sportVal = t.sport || 'Beach Tennis';
    const sportOpt = Array.from(sportSelect.options).find(o => o.value === sportVal || o.value.includes(sportVal) || sportVal.includes(o.text.replace(/^[^\w]*/, '').trim()));
    sportSelect.value = sportOpt ? sportOpt.value : sportSelect.options[sportSelect.options.length - 1].value;

    let fmtValue = 'elim_simples';
    if (t.format === 'Liga') fmtValue = 'liga';
    else if (t.format === 'Suíço Clássico') fmtValue = 'suico';
    else if (t.format === 'Eliminatórias Simples') fmtValue = 'elim_simples';
    else if (t.format === 'Dupla Eliminatória') fmtValue = 'elim_dupla';
    else if (t.format === 'Fase de Grupos + Eliminatórias') fmtValue = 'grupos_mata';
    document.getElementById('select-formato').value = fmtValue;

    // Split stored datetime values (YYYY-MM-DD or YYYY-MM-DDTHH:MM) into date + time fields
    const _splitDT = (v) => {
      if (!v) return ['', ''];
      if (v.includes('T')) { const parts = v.split('T'); return [parts[0], parts[1].substring(0, 5)]; }
      return [v, ''];
    };
    const [regD, regT] = _splitDT(t.registrationLimit);
    const [startD, startT] = _splitDT(t.startDate);
    const [endD, endT] = _splitDT(t.endDate);
    document.getElementById('tourn-reg-date').value = regD;
    document.getElementById('tourn-reg-time').value = regT;
    document.getElementById('tourn-start-date').value = startD;
    document.getElementById('tourn-start-time').value = startT;
    document.getElementById('tourn-end-date').value = endD;
    document.getElementById('tourn-end-time').value = endT;
    document.getElementById('select-inscricao').value = t.enrollmentMode || 'individual';
    if (t.teamSize) document.getElementById('tourn-team-size').value = t.teamSize;
    window._onInscricaoChange();
    document.getElementById('tourn-max-participants').value = t.maxParticipants || '';
    document.getElementById('tourn-auto-close').checked = !!t.autoCloseOnFull;
    document.getElementById('tourn-categories').value = t.categories ? t.categories.join(', ') : '';
    document.getElementById('tourn-public').checked = t.isPublic !== false;
    document.getElementById('select-result-entry').value = t.resultEntry || 'organizer';

    // Venue / Courts / Time
    document.getElementById('tourn-venue').value = t.venue || '';
    document.getElementById('tourn-venue-lat').value = t.venueLat || '';
    document.getElementById('tourn-venue-lon').value = t.venueLon || '';
    document.getElementById('tourn-venue-address').value = t.venueAddress || '';
    document.getElementById('tourn-venue-place-id').value = t.venuePlaceId || '';
    document.getElementById('tourn-venue-photo-url').value = t.venuePhotoUrl || '';
    // Apply saved venue photo as background
    if (t.venuePhotoUrl) {
      setTimeout(function() { window._applyVenuePhoto(t.venuePhotoUrl); }, 50);
    }
    const venueAccessStored = t.venueAccess || '';
    document.getElementById('tourn-venue-access').value = venueAccessStored;
    window._applyVenueAccessUI(venueAccessStored ? venueAccessStored.split(',') : []);
    // Show venue info with address and map link
    const infoEl = document.getElementById('venue-osm-info');
    if (infoEl && t.venue && t.venueLat && t.venueLon) {
      const mapsUrl = t.venuePlaceId
        ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.venue) + '&query_place_id=' + t.venuePlaceId
        : 'https://www.google.com/maps/search/?api=1&query=' + t.venueLat + ',' + t.venueLon;
      var addrText = t.venueAddress || t.venue;
      infoEl.style.display = 'flex';
      infoEl.innerHTML = '<span style="display:flex; flex-direction:column; gap:2px;">' +
        '<span style="font-weight:500; color:#e2e8f0;">📍 ' + (t.venue || '') + '</span>' +
        '<span style="color:#94a3b8; font-size:0.7rem;">' + addrText + '</span>' +
        '</span>' +
        ' &nbsp;<a href="' + mapsUrl + '" target="_blank" title="Ver no mapa" style="color:#818cf8; text-decoration:none; font-size:1.1rem; line-height:1; flex-shrink:0;">🗺️</a>';
    } else if (infoEl) {
      infoEl.style.display = 'none';
      infoEl.innerHTML = '';
    }
    document.getElementById('tourn-court-count').value = t.courtCount || 1;
    document.getElementById('tourn-court-names').value = t.courtNames ? t.courtNames.join(', ') : '';
    document.getElementById('tourn-call-time').value = t.callTime != null ? t.callTime : 5;
    document.getElementById('tourn-warmup-time').value = t.warmupTime != null ? t.warmupTime : 5;
    document.getElementById('tourn-game-duration').value = t.gameDuration || 30;
    window._onCourtCountChange();

    // Suíço
    if (t.swissRounds) document.getElementById('suico-rounds').value = t.swissRounds;

    // Liga
    if (t.ligaPeriodicity) document.getElementById('liga-periodicity').value = t.ligaPeriodicity;
    if (t.ligaNewPlayerScore) document.getElementById('liga-new-player-score').value = t.ligaNewPlayerScore;
    if (t.ligaInactivity) document.getElementById('liga-inactivity').value = t.ligaInactivity;
    if (t.ligaInactivityX) document.getElementById('liga-inactivity-x').value = t.ligaInactivityX;
    document.getElementById('liga-open-enrollment').checked = t.ligaOpenEnrollment !== false;

    // Elim settings
    document.getElementById('elim-third-place').checked = t.elimThirdPlace !== false;
    document.getElementById('elim-ranking-type').value = t.elimRankingType || 'individual';

    // Grupos
    if (t.gruposCount) document.getElementById('grupos-count').value = t.gruposCount;
    if (t.gruposClassified) document.getElementById('grupos-classified').value = t.gruposClassified;

    // Restore tiebreaker order
    if (t.tiebreakers && t.tiebreakers.length > 0) {
      const tbList = document.getElementById('tiebreaker-list');
      if (tbList) {
        const items = Array.from(tbList.querySelectorAll('li'));
        t.tiebreakers.forEach(tb => {
          const item = items.find(li => li.dataset.tb === tb);
          if (item) tbList.appendChild(item);
        });
      }
    }

    window._onFormatoChange();
    window._onLigaInactivityChange();
    window._updateRegDateVisibility();
    window._recalcDuration();
    openModal('modal-create-tournament');
    setTimeout(() => window._initPlacesAutocomplete(), 100);
  };

  const btnCreate = document.getElementById('btn-create-tournament');
  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      document.getElementById('edit-tournament-id').value = '';
      document.getElementById('create-modal-title').innerText = 'Criar Novo Torneio';
      document.getElementById('form-create-tournament').reset();
      document.getElementById('tourn-public').checked = true;
      document.getElementById('liga-open-enrollment').checked = true;
      document.getElementById('elim-third-place').checked = true;
      document.getElementById('tourn-venue-access').value = '';
      document.getElementById('tourn-venue-lat').value = '';
      document.getElementById('tourn-venue-lon').value = '';
      document.getElementById('tourn-venue-address').value = '';
      document.getElementById('tourn-venue-place-id').value = '';
      document.getElementById('tourn-venue-photo-url').value = '';
      window._applyVenuePhoto('');
      const _infoEl = document.getElementById('venue-osm-info');
      if (_infoEl) { _infoEl.style.display = 'none'; _infoEl.innerHTML = ''; }
      window._applyVenueAccessUI([]);
      window._onFormatoChange();
      window._updateRegDateVisibility();
      openModal('modal-create-tournament');
      setTimeout(() => window._initPlacesAutocomplete(), 100);
    });
  }

  const btnSave = document.getElementById('btn-save-tournament');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      try {
        const editId = document.getElementById('edit-tournament-id').value;
        const name = document.getElementById('tourn-name').value.trim();
        if (!name) { showAlertDialog('Nome Obrigatório', 'Preencha o nome do torneio.', null, { type: 'warning' }); return; }

        const formatValue = document.getElementById('select-formato').value;
        const formatMap = {
          liga: 'Liga',
          suico: 'Suíço Clássico',
          elim_simples: 'Eliminatórias Simples',
          elim_dupla: 'Dupla Eliminatória',
          grupos_mata: 'Fase de Grupos + Eliminatórias'
        };
        const format = formatMap[formatValue] || 'Eliminatórias Simples';

        // Captura TODOS os valores do formulário antes de qualquer outra operação
        const sportRaw = document.getElementById('select-sport').value || '';
        const sportClean = sportRaw.replace(/^[^\w\u00C0-\u024F]+/u, '').trim();
        const startDateRaw = document.getElementById('tourn-start-date').value || '';
        const startTimeRaw = document.getElementById('tourn-start-time').value || '';
        const startDateVal = startTimeRaw ? startDateRaw + 'T' + startTimeRaw : startDateRaw;
        const endDateRaw = document.getElementById('tourn-end-date').value || '';
        const endTimeRaw = document.getElementById('tourn-end-time').value || '';
        const endDateVal = endTimeRaw ? endDateRaw + 'T' + endTimeRaw : endDateRaw;
        const regDateRaw = document.getElementById('tourn-reg-date').value || '';
        const regTimeRaw = document.getElementById('tourn-reg-time').value || '';
        const regDateVal = regTimeRaw ? regDateRaw + 'T' + regTimeRaw : regDateRaw;
        const enrollmentVal = document.getElementById('select-inscricao').value || 'individual';
        const teamSizeVal = parseInt(document.getElementById('tourn-team-size').value) || 1;
        const categoriesVal = document.getElementById('tourn-categories').value.split(',').map(c => c.trim()).filter(c => c);
        const maxPartsVal = parseInt(document.getElementById('tourn-max-participants').value) || null;
        const autoCloseVal = document.getElementById('tourn-auto-close').checked;
        const resultEntryVal = document.getElementById('select-result-entry').value || 'organizer';
        const isPublicVal = document.getElementById('tourn-public').checked;

        // Venue / Courts / Time
        const venueVal = document.getElementById('tourn-venue').value.trim();
        const venueAccessVal = document.getElementById('tourn-venue-access').value || '';
        const venueLatVal = document.getElementById('tourn-venue-lat').value || '';
        const venueLonVal = document.getElementById('tourn-venue-lon').value || '';
        const venueAddressVal = document.getElementById('tourn-venue-address').value || '';
        const venuePlaceIdVal = document.getElementById('tourn-venue-place-id').value || '';
        const venuePhotoUrlVal = document.getElementById('tourn-venue-photo-url').value || '';
        const courtCountVal = parseInt(document.getElementById('tourn-court-count').value) || 1;
        const courtNamesRaw = document.getElementById('tourn-court-names').value.trim();
        const courtNamesVal = courtNamesRaw ? courtNamesRaw.split(',').map(c => c.trim()).filter(c => c) : [];
        const callTimeVal = parseInt(document.getElementById('tourn-call-time').value) || 0;
        const warmupTimeVal = parseInt(document.getElementById('tourn-warmup-time').value) || 0;
        const gameDurationVal = parseInt(document.getElementById('tourn-game-duration').value) || 30;

        const tourData = {
          name,
          isPublic: isPublicVal,
          format,
          sport: sportClean,
          startDate: startDateVal,
          endDate: endDateVal,
          registrationLimit: regDateVal,
          enrollmentMode: enrollmentVal,
          teamSize: teamSizeVal,
          categories: categoriesVal,
          maxParticipants: maxPartsVal,
          autoCloseOnFull: autoCloseVal,
          resultEntry: resultEntryVal,
          venue: venueVal,
          venueAccess: venueAccessVal,
          venueLat: venueLatVal,
          venueLon: venueLonVal,
          venueAddress: venueAddressVal,
          venuePlaceId: venuePlaceIdVal,
          venuePhotoUrl: venuePhotoUrlVal,
          courtCount: courtCountVal,
          courtNames: courtNamesVal,
          callTime: callTimeVal,
          warmupTime: warmupTimeVal,
          gameDuration: gameDurationVal,
          organizerEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local'
        };

        // Suíço
        if (formatValue === 'suico') {
          tourData.swissRounds = parseInt(document.getElementById('suico-rounds').value) || 5;
        }

        // Liga
        if (formatValue === 'liga') {
          tourData.ligaPeriodicity = document.getElementById('liga-periodicity').value;
          tourData.ligaNewPlayerScore = document.getElementById('liga-new-player-score').value;
          tourData.ligaInactivity = document.getElementById('liga-inactivity').value;
          tourData.ligaInactivityX = parseInt(document.getElementById('liga-inactivity-x').value) || 3;
          tourData.ligaOpenEnrollment = document.getElementById('liga-open-enrollment').checked;
        }

        // Eliminatórias
        if (formatValue === 'elim_simples' || formatValue === 'elim_dupla' || formatValue === 'grupos_mata') {
          tourData.elimThirdPlace = document.getElementById('elim-third-place').checked;
          tourData.elimRankingType = document.getElementById('elim-ranking-type').value;
        }

        // Fase de Grupos
        if (formatValue === 'grupos_mata') {
          tourData.gruposCount = parseInt(document.getElementById('grupos-count').value) || 4;
          tourData.gruposClassified = parseInt(document.getElementById('grupos-classified').value) || 2;
        }

        // Tiebreakers (ordem configurada pelo organizador)
        const tbList = document.getElementById('tiebreaker-list');
        if (tbList) {
          tourData.tiebreakers = Array.from(tbList.querySelectorAll('li')).map(li => li.dataset.tb).filter(Boolean);
        }

        if (editId) {
          const idx = window.AppStore.tournaments.findIndex(tour => tour.id.toString() === editId.toString());
          if (idx !== -1) {
            const t = window.AppStore.tournaments[idx];
            // Aplica cada campo explicitamente
            Object.keys(tourData).forEach(k => { t[k] = tourData[k]; });
            window.AppStore.logAction(editId, `Regras atualizadas: formato ${format}, lançamento por ${resultEntryVal}`);
          }
          showNotification('Sucesso', 'Torneio atualizado!', 'success');
        } else {
          window.AppStore.addTournament(tourData);
          showNotification('Torneio Criado', `O torneio "${name}" foi salvo com sucesso.`, 'success');
        }

        // Persiste no localStorage
        window.AppStore.sync();

        if (typeof window.updateViewModeVisibility === 'function') window.updateViewModeVisibility();
        closeModal('modal-create-tournament');

        // Re-render: força atualização completa da view
        if (!editId) {
          const newId = window.AppStore.tournaments[window.AppStore.tournaments.length - 1].id;
          window.location.hash = `#tournaments/${newId}`;
        } else {
          // Chama o handler do router diretamente para re-renderizar sem poluir o histórico
          if (typeof window._routerHandler === 'function') {
            window._routerHandler();
          }
        }
      } catch (err) {
        console.error('Erro ao salvar torneio:', err);
        showNotification('Erro', 'Falha ao salvar: ' + err.message, 'error');
      }
    });
  }
}
