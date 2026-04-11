// ── Game Set Match Scoring Defaults by Sport ──
window._sportScoringDefaults = {
  'Beach Tennis':  { type:'sets', setsToWin:1, gamesPerSet:6, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'tennis', advantageRule:false },
  'Pickleball':    { type:'sets', setsToWin:1, gamesPerSet:11, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'numeric', advantageRule:false },
  'Tênis':         { type:'sets', setsToWin:2, gamesPerSet:6, tiebreakEnabled:true, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:true, superTiebreakPoints:10, countingType:'tennis', advantageRule:true },
  'Tênis de Mesa': { type:'sets', setsToWin:3, gamesPerSet:11, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'numeric', advantageRule:false },
  'Padel':         { type:'sets', setsToWin:2, gamesPerSet:6, tiebreakEnabled:true, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:true, superTiebreakPoints:10, countingType:'tennis', advantageRule:false },
  '_default':      { type:'simple', setsToWin:1, gamesPerSet:1, tiebreakEnabled:false, tiebreakPoints:7, tiebreakMargin:2, superTiebreak:false, superTiebreakPoints:10, countingType:'numeric', advantageRule:false }
};

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
                  <!-- Hidden select for backward compatibility -->
                  <select class="form-control" id="select-sport" onchange="window._onSportChange()" style="display:none;">
                    <option>🎾 Beach Tennis</option>
                    <option>🥒 Pickleball</option>
                    <option>🎾 Tênis</option>
                    <option>🏓 Tênis de Mesa</option>
                    <option>🏸 Padel</option>
                  </select>
                  <div id="sport-buttons" style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button type="button" class="sport-btn sport-btn-active" data-sport="🎾 Beach Tennis" onclick="window._selectSport(this)" style="padding:6px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #fbbf24;background:rgba(251,191,36,0.15);color:#fbbf24;font-weight:600;">🎾 Beach Tennis</button>
                    <button type="button" class="sport-btn" data-sport="🥒 Pickleball" onclick="window._selectSport(this)" style="padding:6px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🥒 Pickleball</button>
                    <button type="button" class="sport-btn" data-sport="🎾 Tênis" onclick="window._selectSport(this)" style="padding:6px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🎾 Tênis</button>
                    <button type="button" class="sport-btn" data-sport="🏓 Tênis de Mesa" onclick="window._selectSport(this)" style="padding:6px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🏓 Tênis de Mesa</button>
                    <button type="button" class="sport-btn" data-sport="🏸 Padel" onclick="window._selectSport(this)" style="padding:6px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🏸 Padel</button>
                  </div>
                </div>
              </div>

              <!-- Logo do Torneio -->
              <div id="logo-section" style="background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #a5b4fc; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Logo do Torneio</p>
                <div style="display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                  <div id="logo-preview" style="width: 80px; height: 80px; border-radius: 16px; border: 2px dashed rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; background: rgba(0,0,0,0.2);">
                    <span style="font-size: 0.7rem; color: var(--text-muted); text-align: center; padding: 4px;">Sem logo</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 180px;">
                    <button type="button" onclick="window._generateTournamentLogo()" style="padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(99,102,241,0.3); background: rgba(99,102,241,0.15); color: #a5b4fc; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; justify-content: center;" onmouseover="this.style.background='rgba(99,102,241,0.25)'" onmouseout="this.style.background='rgba(99,102,241,0.15)'">
                      🎨 Gerar Logo
                    </button>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" onclick="window._generateTournamentLogo()" title="Regerar logo" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(99,102,241,0.2); background: rgba(99,102,241,0.08); color: #a5b4fc; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.18)'" onmouseout="this.style.background='rgba(99,102,241,0.08)'">
                        🔄
                      </button>
                      <button type="button" id="btn-logo-lock" onclick="window._toggleLogoLock()" title="Travar logo (não regera ao salvar)" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        🔓
                      </button>
                      <button type="button" onclick="window._downloadTournamentLogo()" title="Baixar logo" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        ⬇️
                      </button>
                      <button type="button" onclick="document.getElementById('logo-file-input').click()" title="Upload de arquivo" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        📁
                      </button>
                      <button type="button" onclick="window._clearTournamentLogo()" title="Remover logo" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(239,68,68,0.2); background: rgba(239,68,68,0.08); color: #f87171; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.15)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">
                        ✕
                      </button>
                    </div>
                    <input type="hidden" id="tourn-logo-locked" value="">
                    <input type="file" id="logo-file-input" accept="image/*" style="display:none;" onchange="window._handleLogoUpload(event)">
                    <input type="hidden" id="tourn-logo-data" value="">
                  </div>
                </div>
              </div>

              <!-- Público/Privado -->
              <div class="form-group mb-2">
                <label class="form-label" style="margin-bottom:6px;">Visibilidade</label>
                <input type="hidden" id="tourn-public" value="true">
                <div style="display:flex;gap:6px;">
                  <button type="button" id="btn-vis-public" class="btn btn-sm" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.15s;border:2px solid #3b82f6;background:rgba(59,130,246,0.15);color:#60a5fa;" onclick="window._setVisibility('public')">🌐 Público</button>
                  <button type="button" id="btn-vis-private" class="btn btn-sm" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);" onclick="window._setVisibility('private')">🔒 Privado</button>
                </div>
                <small id="vis-desc" class="text-muted" style="display:block;margin-top:6px;">Visível para todos na aba Explorar. Qualquer pessoa pode se inscrever.</small>
              </div>

              <!-- Formato -->
              <div class="form-group mb-3">
                <label class="form-label">${_t('tournament.format')}</label>
                <!-- Hidden select for backward compatibility -->
                <select class="form-control" id="select-formato" onchange="window._onFormatoChange()" style="display:none;">
                  <option value="elim_simples">Eliminatórias Simples</option>
                  <option value="elim_dupla">Dupla Eliminatória</option>
                  <option value="grupos_mata">Fase de Grupos + Eliminatórias</option>
                  <option value="suico">Suíço Clássico</option>
                  <option value="liga">Liga</option>
                </select>
                <div id="formato-buttons" style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button type="button" class="formato-btn formato-btn-active" data-value="elim_simples" onclick="window._selectFormato(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #3b82f6;background:rgba(59,130,246,0.15);color:#60a5fa;font-weight:600;">${_t('format.single')}</button>
                  <button type="button" class="formato-btn" data-value="elim_dupla" onclick="window._selectFormato(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;">${_t('format.double')}</button>
                  <button type="button" class="formato-btn" data-value="grupos_mata" onclick="window._selectFormato(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;">${_t('format.groupsShort')}</button>
                  <button type="button" class="formato-btn" data-value="suico" onclick="window._selectFormato(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;">${_t('format.swiss')}</button>
                  <button type="button" class="formato-btn" data-value="liga" onclick="window._selectFormato(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;">${_t('format.league')}</button>
                </div>
                <small class="text-muted" style="display:block;margin-top:4px;" id="formato-desc">${_t('format.single')} — ${_t('create.descElimSimples')}</small>
              </div>

              <!-- Modo de Sorteio -->
              <div class="form-group mb-3" id="draw-mode-container">
                <label class="form-label">${_t('create.drawMode')}</label>
                <input type="hidden" id="draw-mode" value="sorteio">
                <div id="draw-mode-buttons" style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button type="button" class="draw-mode-btn draw-mode-active" data-value="sorteio" onclick="window._selectDrawMode(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #34d399;background:rgba(16,185,129,0.15);color:#34d399;font-weight:600;">🎲 ${_t('create.drawModeSorteio')}</button>
                  <button type="button" class="draw-mode-btn" data-value="rei_rainha" id="btn-draw-mode-monarch" onclick="window._selectDrawMode(this)" style="padding:7px 13px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;">👑 ${_t('format.monarchShort')}</button>
                </div>
                <small class="text-muted" style="display:block;margin-top:4px;" id="draw-mode-desc">${_t('create.drawModeSorteioDesc')}</small>
              </div>

              <!-- Rei/Rainha da Praia (logo abaixo do formato, visível só quando rei_rainha selecionado) -->
              <div id="rei-rainha-fields" style="display:none; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #fbbf24; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">👑 ${_t('format.monarch')}</p>
                <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem;">${_t('format.monarchDesc')}</div>
                <div style="margin-bottom:0.75rem;">
                  <label class="form-label" style="font-size:0.75rem;margin-bottom:6px;">${_t('label.classifiedPerGroup')}</label>
                  <div style="display:flex;gap:8px;" id="monarch-classified-buttons">
                    <button type="button" class="monarch-cls-btn monarch-cls-active" data-value="1" onclick="window._selectMonarchClassified(this)" style="flex:1;padding:8px 12px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;border:2px solid #fbbf24;background:rgba(251,191,36,0.15);color:#fbbf24;font-weight:600;text-align:center;">${_t('monarch.classified1')}</button>
                    <button type="button" class="monarch-cls-btn" data-value="2" onclick="window._selectMonarchClassified(this)" style="flex:1;padding:8px 12px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;text-align:center;">2 (Rei + Vice)</button>
                  </div>
                  <input type="hidden" id="monarch-classified" value="1">
                </div>
                <div style="font-size:0.75rem;color:#4ade80;font-weight:600;margin-top:4px;">✓ ${_t('monarch.advanceHelp')}</div>
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

              <!-- Campos específicos: Liga (unificado com antigo Ranking) -->
              <div id="liga-fields" style="display:none; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #34d399; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Configurações da Liga</p>
                <div class="d-flex gap-2 mb-2">
                  <div class="form-group full-width">
                    <label class="form-label">Duração da Temporada</label>
                    <select class="form-control" id="liga-season-duration" onchange="window._onLigaSeasonChange()">
                      <option value="indefinida">Indefinida (sem prazo)</option>
                      <option value="3">3 meses</option>
                      <option value="6">6 meses</option>
                      <option value="12">12 meses (1 ano)</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                  <div class="form-group full-width" id="liga-custom-duration-container" style="display:none;">
                    <label class="form-label">Meses de duração</label>
                    <input type="number" class="form-control" id="liga-custom-months" min="1" max="36" value="6" placeholder="Ex: 9">
                  </div>
                </div>
                <div class="d-flex gap-2 mb-2">
                  <div class="form-group full-width">
                    <label class="form-label">Pontuação de Novos Inscritos</label>
                    <select class="form-control" id="liga-new-player-score">
                      <option value="zero">Zero absoluto</option>
                      <option value="min">Mínima atual da tabela</option>
                      <option value="avg">Média atual da tabela</option>
                      <option value="organizer">Organizador decide na hora</option>
                    </select>
                  </div>
                  <div class="form-group full-width">
                    <label class="form-label">Regra de Inatividade</label>
                    <select class="form-control" id="liga-inactivity">
                      <option value="keep">Manter pontos</option>
                      <option value="decay">Decaimento fixo por rodada</option>
                      <option value="remove">Remover após X rodadas sem jogar</option>
                    </select>
                  </div>
                </div>
                <div class="form-group" id="liga-inactivity-x-container" style="display:none;">
                  <label class="form-label">Rodadas sem jogar para remoção</label>
                  <input type="number" class="form-control" id="liga-inactivity-x" min="1" value="3">
                </div>
                <div class="form-group mt-2">
                  <div class="toggle-row">
                    <div class="toggle-row-label"><span style="font-weight:bold; color:var(--text-color);">Inscrições abertas durante toda a temporada</span></div>
                    <label class="toggle-switch"><input type="checkbox" id="liga-open-enrollment" checked><span class="toggle-slider"></span></label>
                  </div>
                </div>
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(16,185,129,0.15);">
                  <p style="margin: 0 0 0.5rem; font-size: 0.75rem; color: #34d399; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Formato de Rodada</p>
                  <div style="display:flex;gap:8px;margin-bottom:0.75rem;" id="liga-round-format-buttons">
                    <button type="button" class="liga-rf-btn liga-rf-active" data-value="standard" onclick="window._selectLigaRoundFormat(this)" style="flex:1;padding:8px 12px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;border:2px solid #34d399;background:rgba(16,185,129,0.15);color:#34d399;font-weight:600;text-align:center;">${_t('liga.formatStandard')}</button>
                    <button type="button" class="liga-rf-btn" data-value="rei_rainha" onclick="window._selectLigaRoundFormat(this)" style="flex:1;padding:8px 12px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;text-align:center;">👑 ${_t('liga.formatMonarch')}</button>
                  </div>
                  <input type="hidden" id="liga-round-format" value="standard">
                  <div id="liga-rf-desc" style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;">Pareamento suíço: jogadores com pontuação similar se enfrentam.</div>
                </div>
                <div id="liga-draw-schedule" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(16,185,129,0.15);">
                  <p style="margin: 0 0 0.5rem; font-size: 0.75rem; color: #34d399; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Agendamento de Sorteios</p>
                  <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.5rem;">
                    <div class="form-group" style="margin:0;flex:0 0 auto;">
                      <label class="form-label" style="font-size:0.7rem;margin-bottom:2px;">Data</label>
                      <input type="date" class="form-control" id="liga-first-draw-date" style="width:130px;padding:6px 8px;font-size:0.85rem;">
                    </div>
                    <div class="form-group" style="margin:0;flex:0 0 auto;">
                      <label class="form-label" style="font-size:0.7rem;margin-bottom:2px;">Hora</label>
                      <input type="time" class="form-control" id="liga-first-draw-time" value="19:00" style="width:80px;padding:6px 8px;font-size:0.85rem;">
                    </div>
                    <div class="form-group" style="margin:0;flex:0 0 auto;">
                      <label class="form-label" style="font-size:0.7rem;margin-bottom:2px;">Repetir a cada</label>
                      <div style="display:flex;align-items:center;gap:4px;">
                        <input type="number" class="form-control" id="liga-draw-interval" min="1" max="90" value="7" style="width:55px;padding:6px 8px;font-size:0.85rem;text-align:center;">
                        <span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">dias</span>
                      </div>
                    </div>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <div class="toggle-row">
                      <div class="toggle-row-label"><div><span style="font-weight:bold; color:var(--text-color);">Sorteio manual</span><div class="toggle-desc">Quando ativado, o sorteio não ocorre automaticamente.</div></div></div>
                      <label class="toggle-switch"><input type="checkbox" id="liga-manual-draw"><span class="toggle-slider"></span></label>
                    </div>
                  </div>
                </div>
              </div>
              <!-- ranking-fields removido em v0.2.6: unificado com liga-fields -->

              <!-- Campos periocidade de sorteio: Suíço -->
              <div id="suico-draw-schedule-fields" style="display:none; background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.5rem; font-size: 0.8rem; color: #818cf8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Agendamento de Sorteios (Suíço)</p>
                <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.5rem;">
                  <div class="form-group" style="margin:0;flex:0 0 auto;">
                    <label class="form-label" style="font-size:0.7rem;margin-bottom:2px;">Data</label>
                    <input type="date" class="form-control" id="suico-first-draw-date" style="width:130px;padding:6px 8px;font-size:0.85rem;">
                  </div>
                  <div class="form-group" style="margin:0;flex:0 0 auto;">
                    <label class="form-label" style="font-size:0.7rem;margin-bottom:2px;">Hora</label>
                    <input type="time" class="form-control" id="suico-first-draw-time" value="19:00" style="width:80px;padding:6px 8px;font-size:0.85rem;">
                  </div>
                  <div class="form-group" style="margin:0;flex:0 0 auto;">
                    <label class="form-label" style="font-size:0.7rem;margin-bottom:2px;">Repetir a cada</label>
                    <div style="display:flex;align-items:center;gap:4px;">
                      <input type="number" class="form-control" id="suico-draw-interval" min="1" max="90" value="7" style="width:55px;padding:6px 8px;font-size:0.85rem;text-align:center;">
                      <span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">dias</span>
                    </div>
                  </div>
                </div>
                <div class="form-group" style="margin:0;">
                  <div class="toggle-row">
                    <div class="toggle-row-label"><div><span style="font-weight:bold; color:var(--text-color);">Sorteio manual</span><div class="toggle-desc">Quando ativado, o organizador decide quando gerar cada rodada.</div></div></div>
                    <label class="toggle-switch"><input type="checkbox" id="suico-manual-draw"><span class="toggle-slider"></span></label>
                  </div>
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
                    <input type="time" class="form-control" id="tourn-reg-time" style="padding:4px 6px; font-size:0.82rem; width:100px; flex-shrink:0;" oninput="window._recalcDuration()">
                  </div>
                </div>
                <div style="flex:1; min-width:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 10px;">
                  <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Início do Torneio</div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="date" class="form-control" id="tourn-start-date" style="padding:4px 6px; font-size:0.82rem; flex:1; min-width:0;" required oninput="window._recalcDuration(); window._checkWeather()">
                    <input type="time" class="form-control" id="tourn-start-time" style="padding:4px 6px; font-size:0.82rem; width:100px; flex-shrink:0;" oninput="window._recalcDuration()">
                  </div>
                </div>
                <div style="flex:1; min-width:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 10px;">
                  <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Fim do Torneio</div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="date" class="form-control" id="tourn-end-date" style="padding:4px 6px; font-size:0.82rem; flex:1; min-width:0;" required oninput="window._recalcDuration()">
                    <input type="time" class="form-control" id="tourn-end-time" style="padding:4px 6px; font-size:0.82rem; width:100px; flex-shrink:0;" oninput="window._recalcDuration()">
                  </div>
                </div>
              </div>

              <!-- Weather Forecast -->
              <div id="weather-forecast" style="display:none; margin-bottom:0.75rem; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:10px; padding:10px 14px;">
                <div style="font-size:0.7rem; font-weight:600; color:#60a5fa; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Previsão do Tempo</div>
                <div id="weather-content"></div>
              </div>

              <!-- Estimativas de Tempo -->
              <div id="time-estimates-container" style="background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
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

              <!-- Game Set Match Config -->
              <div id="gsm-section" style="background: rgba(168,85,247,0.06); border: 1px solid rgba(168,85,247,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div style="flex:1;">
                    <p style="margin: 0; font-size: 0.8rem; color: #c084fc; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🎾 Sistema de Pontuação</p>
                    <div id="gsm-summary" style="font-size:0.82rem;color:var(--text-main);margin-top:6px;line-height:1.5;"></div>
                  </div>
                  <button type="button" id="btn-gsm-config" onclick="window._openGSMConfig()" class="btn btn-purple btn-sm" style="margin-left:12px;white-space:nowrap;">Alterar</button>
                </div>
                <!-- Hidden fields to store config -->
                <input type="hidden" id="gsm-type" value="simple">
                <input type="hidden" id="gsm-setsToWin" value="1">
                <input type="hidden" id="gsm-gamesPerSet" value="6">
                <input type="hidden" id="gsm-tiebreakEnabled" value="true">
                <input type="hidden" id="gsm-tiebreakPoints" value="7">
                <input type="hidden" id="gsm-tiebreakMargin" value="2">
                <input type="hidden" id="gsm-superTiebreak" value="false">
                <input type="hidden" id="gsm-superTiebreakPoints" value="10">
                <input type="hidden" id="gsm-countingType" value="numeric">
                <input type="hidden" id="gsm-advantageRule" value="false">
                <input type="hidden" id="gsm-fixedSet" value="false">
                <input type="hidden" id="gsm-fixedSetGames" value="6">
              </div>

              <!-- Inscrição e Limite -->
              <div class="d-flex gap-2 mb-3">
                <div class="form-group full-width">
                  <label class="form-label">Máx. Participantes</label>
                  <input type="number" class="form-control" id="tourn-max-participants" min="2" placeholder="Sem limite" oninput="window._updateAutoCloseVisibility(); window._recalcDuration()">
                </div>
                <div class="form-group full-width">
                  <label class="form-label">${_t('create.gameType')}</label>
                  <div id="game-type-buttons" style="display:flex;gap:8px;">
                    <button type="button" id="btn-tipo-simples" class="game-type-btn" onclick="window._toggleGameType('simples')" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;text-align:center;">${_t('create.gameSimples')}</button>
                    <button type="button" id="btn-tipo-duplas" class="game-type-btn game-type-active" onclick="window._toggleGameType('duplas')" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #3b82f6;background:rgba(59,130,246,0.15);color:#60a5fa;font-weight:600;text-align:center;">${_t('create.gameDuplas')}</button>
                  </div>
                  <small class="text-muted" style="display:block;margin-top:4px;">${_t('create.gameTypeHint')}</small>
                  <input type="hidden" id="tourn-team-size" value="2">
                  <input type="hidden" id="tourn-game-types" value="duplas">
                </div>
              </div>

              <!-- Modo de Inscrição -->
              <div class="form-group mb-3">
                <label class="form-label">${_t('create.enrollMode')}</label>
                <select class="form-control" id="select-inscricao" style="display:none;">
                  <option value="individual">Individual</option>
                  <option value="time">Apenas Times</option>
                  <option value="misto">Misto (Individual e Times)</option>
                </select>
                <div id="enroll-mode-buttons" style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button type="button" class="enroll-mode-btn enroll-mode-active" data-value="individual" onclick="window._selectEnrollMode(this)" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #a78bfa;background:rgba(167,139,250,0.15);color:#a78bfa;font-weight:600;text-align:center;">${_t('enroll.modeIndividual')}</button>
                  <button type="button" class="enroll-mode-btn" data-value="time" onclick="window._selectEnrollMode(this)" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;text-align:center;">${_t('enroll.modeTeam')}</button>
                  <button type="button" class="enroll-mode-btn" data-value="misto" onclick="window._selectEnrollMode(this)" style="flex:1;padding:8px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:600;text-align:center;">${_t('enroll.modeMixed')}</button>
                </div>
                <small class="text-muted" style="display:block;margin-top:4px;" id="enroll-mode-desc">${_t('create.enrollModeIndividualDesc')}</small>
              </div>

              <!-- Auto-close (apenas eliminatórias) -->
              <div class="form-group mb-3" id="auto-close-container" style="display:none;">
                <div class="toggle-row">
                  <div class="toggle-row-label"><span class="toggle-icon">⚡</span><div><span style="font-weight:bold;color:var(--text-color);">Encerrar inscrições ao atingir o limite</span><div class="toggle-desc">Disponível quando o máximo for potência de 2 e formato Eliminatórias.</div></div></div>
                  <label class="toggle-switch"><input type="checkbox" id="tourn-auto-close"><span class="toggle-slider"></span></label>
                </div>
              </div>

              <!-- Categorias do Torneio -->
              <div style="background: rgba(168,85,247,0.06); border: 1px solid rgba(168,85,247,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #a855f7; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Categorias</p>
                <div style="margin-bottom:0.75rem;">
                  <label class="form-label" style="margin-bottom:6px;">Categorias por Sexo</label>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;" id="gender-cat-buttons">
                    <button type="button" id="btn-cat-fem" onclick="window._toggleGenderCat('fem')" style="padding:6px 14px; border-radius:8px; font-size:0.8rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-weight:500;">♀ Feminino</button>
                    <button type="button" id="btn-cat-masc" onclick="window._toggleGenderCat('masc')" style="padding:6px 14px; border-radius:8px; font-size:0.8rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-weight:500;">♂ Masculino</button>
                    <button type="button" id="btn-cat-misto-ale" onclick="window._toggleGenderCat('misto_aleatorio')" style="padding:6px 14px; border-radius:8px; font-size:0.8rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-weight:500;">⚥ Misto Aleatório</button>
                    <button type="button" id="btn-cat-misto-obr" onclick="window._toggleGenderCat('misto_obrigatorio')" style="padding:6px 14px; border-radius:8px; font-size:0.8rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); font-weight:500;">⚤ Misto Obrigatório</button>
                  </div>
                  <input type="hidden" id="tourn-gender-categories" value="">
                  <small class="text-muted" style="display:block;margin-top:6px;">Fem = só mulheres. Masc = só homens. Misto Obrigatório = times 50/50. Misto Aleatório = sem restrição de proporção.</small>
                </div>
                <div>
                  <label class="form-label" style="margin-bottom:6px;">Categorias por Habilidade</label>
                  <input type="text" class="form-control" id="tourn-skill-categories" placeholder="Ex: A, B, C, D" oninput="window._updateCategoryPreview()">
                  <small class="text-muted" style="display:block;margin-top:4px;">Separe por vírgula. Deixe em branco para categoria única.</small>
                </div>
                <div id="category-preview" style="display:none; margin-top:0.75rem; padding:8px 12px; background:rgba(168,85,247,0.08); border:1px solid rgba(168,85,247,0.2); border-radius:8px;">
                  <div style="font-size:0.7rem; color:#a855f7; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Categorias do Torneio</div>
                  <div id="category-preview-list" style="display:flex; flex-wrap:wrap; gap:4px; font-size:0.8rem;"></div>
                </div>
              </div>

              <!-- Lançamento de Resultados -->
              <div style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #60a5fa; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📋 Lançamento de Resultados</p>
                <div style="display:flex; gap:8px; flex-wrap:wrap;" id="result-entry-buttons">
                  <button type="button" class="result-entry-btn result-entry-active" data-value="organizer" onclick="window._selectResultEntry(this)" style="flex:1;min-width:120px;padding:8px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #3b82f6;background:rgba(59,130,246,0.15);color:#60a5fa;font-weight:600;text-align:center;">Organizador</button>
                  <button type="button" class="result-entry-btn" data-value="players" onclick="window._selectResultEntry(this)" style="flex:1;min-width:120px;padding:8px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;text-align:center;">Jogadores</button>
                  <button type="button" class="result-entry-btn" data-value="referee" onclick="window._selectResultEntry(this)" style="flex:1;min-width:120px;padding:8px 12px;border-radius:10px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;text-align:center;">Árbitro</button>
                </div>
                <div id="result-entry-desc" style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">Apenas o organizador (e co-organizadores) podem lançar resultados das partidas.</div>
                <input type="hidden" id="select-result-entry" value="organizer">
              </div>

              <!-- Classificação -->
              <div id="elim-settings" style="display:none; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: #f87171; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Classificação Final</p>
                <input type="hidden" id="elim-third-place" value="true">
                <div class="form-group">
                  <div id="ranking-type-buttons" style="display:flex;gap:8px;">
                    <button type="button" class="ranking-type-btn ranking-type-active" data-value="individual" onclick="window._selectRankingType('individual')" style="flex:1;padding:10px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;border:2px solid #f87171;background:rgba(248,113,113,0.12);color:#fca5a5;font-weight:600;text-align:center;">Personalizado</button>
                    <button type="button" class="ranking-type-btn" data-value="blocks" onclick="window._selectRankingType('blocks')" style="flex:1;padding:10px 14px;border-radius:10px;font-size:0.82rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;text-align:center;">Em Blocos</button>
                  </div>
                  <small class="text-muted" style="display:block;margin-top:6px;">Personalizado: cada participante recebe colocação específica. Em blocos: eliminados na mesma fase compartilham a colocação.</small>
                  <select class="form-control" id="elim-ranking-type" style="display:none;">
                    <option value="individual">Personalizado</option>
                    <option value="blocks">Em blocos</option>
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
    'Beach Tennis': 2, 'Pickleball': 2, 'Tênis': 1, 'Tênis de Mesa': 1, 'Padel': 2
  };

  // ── Sport Button Selection ──
  window._selectSport = function(btn) {
    // Deselect all sport buttons
    var btns = document.querySelectorAll('#sport-buttons .sport-btn');
    btns.forEach(function(b) {
      b.classList.remove('sport-btn-active');
      b.style.border = '2px solid rgba(255,255,255,0.18)';
      b.style.background = 'rgba(255,255,255,0.06)';
      b.style.color = 'var(--text-main)';
    });
    // Select clicked
    btn.classList.add('sport-btn-active');
    btn.style.border = '2px solid #fbbf24';
    btn.style.background = 'rgba(251,191,36,0.15)';
    btn.style.color = '#fbbf24';
    // Sync hidden select
    var sel = document.getElementById('select-sport');
    if (sel) {
      var val = btn.getAttribute('data-sport');
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].text === val || sel.options[i].value === val) { sel.selectedIndex = i; break; }
      }
    }
    window._onSportChange();
  };

  // ── Game Type (Simples/Duplas) Toggle ──
  window._toggleGameType = function(type) {
    var btnS = document.getElementById('btn-tipo-simples');
    var btnD = document.getElementById('btn-tipo-duplas');
    if (!btnS || !btnD) return;

    // Toggle the clicked button
    if (type === 'simples') {
      var isActive = btnS.classList.contains('game-type-active');
      if (isActive) {
        // Can't deselect if it's the only one selected
        if (!btnD.classList.contains('game-type-active')) return;
        btnS.classList.remove('game-type-active');
        btnS.style.border = '2px solid rgba(255,255,255,0.18)';
        btnS.style.background = 'rgba(255,255,255,0.06)';
        btnS.style.color = 'var(--text-main)';
      } else {
        btnS.classList.add('game-type-active');
        btnS.style.border = '2px solid #3b82f6';
        btnS.style.background = 'rgba(59,130,246,0.15)';
        btnS.style.color = '#60a5fa';
      }
    } else {
      var isActiveD = btnD.classList.contains('game-type-active');
      if (isActiveD) {
        if (!btnS.classList.contains('game-type-active')) return;
        btnD.classList.remove('game-type-active');
        btnD.style.border = '2px solid rgba(255,255,255,0.18)';
        btnD.style.background = 'rgba(255,255,255,0.06)';
        btnD.style.color = 'var(--text-main)';
      } else {
        btnD.classList.add('game-type-active');
        btnD.style.border = '2px solid #3b82f6';
        btnD.style.background = 'rgba(59,130,246,0.15)';
        btnD.style.color = '#60a5fa';
      }
    }

    // Update hidden fields
    var simplesOn = btnS.classList.contains('game-type-active');
    var duplasOn = btnD.classList.contains('game-type-active');
    var gameTypesField = document.getElementById('tourn-game-types');
    var teamSizeField = document.getElementById('tourn-team-size');
    var inscricaoField = document.getElementById('select-inscricao');

    var enrollVal;
    if (simplesOn && duplasOn) {
      if (gameTypesField) gameTypesField.value = 'simples,duplas';
      if (teamSizeField) teamSizeField.value = '2';
      enrollVal = 'misto';
    } else if (duplasOn) {
      if (gameTypesField) gameTypesField.value = 'duplas';
      if (teamSizeField) teamSizeField.value = '2';
      enrollVal = 'time';
    } else {
      if (gameTypesField) gameTypesField.value = 'simples';
      if (teamSizeField) teamSizeField.value = '1';
      enrollVal = 'individual';
    }
    if (inscricaoField) inscricaoField.value = enrollVal;
    // Sync enrollment mode buttons
    var emBtn = document.querySelector('#enroll-mode-buttons .enroll-mode-btn[data-value="' + enrollVal + '"]');
    if (emBtn) window._selectEnrollMode(emBtn);

    // Update category preview to reflect game type change
    if (typeof window._updateCategoryPreview === 'function') window._updateCategoryPreview();
  };

  // ── Formato Button Selection ──
  var _formatoDescs = {
    'elim_simples': _t('create.descElimSimples'),
    'elim_dupla': _t('create.descElimDupla'),
    'grupos_mata': _t('create.descGrupos'),
    'suico': _t('create.descSuico'),
    'liga': _t('create.descLiga')
  };
  var _drawModeDescs = {
    'sorteio': _t('create.drawModeSorteioDesc'),
    'rei_rainha': _t('create.drawModeMonarchDesc')
  };
  var _enrollModeDescs = {
    'individual': _t('create.enrollModeIndividualDesc'),
    'time': _t('create.enrollModeTimeDesc'),
    'misto': _t('create.enrollModeMistoDesc')
  };
  window._selectFormato = function(btn) {
    var value = btn.getAttribute('data-value');
    var btns = document.querySelectorAll('#formato-buttons .formato-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === value) {
        b.classList.add('formato-btn-active');
        b.style.border = '2px solid #3b82f6';
        b.style.background = 'rgba(59,130,246,0.15)';
        b.style.color = '#60a5fa';
        b.style.fontWeight = '600';
      } else {
        b.classList.remove('formato-btn-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
        b.style.fontWeight = '600';
      }
    });
    // Sync hidden select
    var sel = document.getElementById('select-formato');
    if (sel) { sel.value = value; }
    // Update description
    var descEl = document.getElementById('formato-desc');
    if (descEl) descEl.textContent = _formatoDescs[value] || '';
    window._onFormatoChange();
  };

  // ── Draw Mode Selection (Sorteio / Rei/Rainha) ──
  window._selectDrawMode = function(btn) {
    var value = btn.getAttribute('data-value');
    var btns = document.querySelectorAll('#draw-mode-buttons .draw-mode-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === value) {
        b.classList.add('draw-mode-active');
        b.style.border = '2px solid #34d399';
        b.style.background = 'rgba(16,185,129,0.15)';
        b.style.color = '#34d399';
        b.style.fontWeight = '600';
      } else {
        b.classList.remove('draw-mode-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
        b.style.fontWeight = '600';
      }
    });
    var hidden = document.getElementById('draw-mode');
    if (hidden) hidden.value = value;
    var descEl = document.getElementById('draw-mode-desc');
    if (descEl) descEl.textContent = _drawModeDescs[value] || '';
    // Show/hide Rei/Rainha config and update dependent fields
    var rrFields = document.getElementById('rei-rainha-fields');
    if (rrFields) rrFields.style.display = value === 'rei_rainha' ? 'block' : 'none';
    // Re-trigger format change to sync Liga round format toggle etc.
    window._onFormatoChange();
  };

  // ── Enrollment Mode Selection ──
  window._selectEnrollMode = function(btn) {
    var value = btn.getAttribute('data-value');
    var btns = document.querySelectorAll('#enroll-mode-buttons .enroll-mode-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === value) {
        b.classList.add('enroll-mode-active');
        b.style.border = '2px solid #a78bfa';
        b.style.background = 'rgba(167,139,250,0.15)';
        b.style.color = '#a78bfa';
        b.style.fontWeight = '600';
      } else {
        b.classList.remove('enroll-mode-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
        b.style.fontWeight = '600';
      }
    });
    // Sync hidden select
    var sel = document.getElementById('select-inscricao');
    if (sel) sel.value = value;
    var descEl = document.getElementById('enroll-mode-desc');
    if (descEl) descEl.textContent = _enrollModeDescs[value] || '';
  };

  // ── Result Entry Selection ──
  var _resultEntryDescs = {
    'organizer': 'Apenas o organizador (e co-organizadores) podem lançar resultados das partidas.',
    'players': 'Os próprios jogadores lançam os resultados. O adversário precisa confirmar o placar.',
    'referee': 'Um árbitro designado pelo organizador lança os resultados das partidas.'
  };
  window._selectResultEntry = function(btn) {
    var value = btn.getAttribute('data-value');
    var btns = document.querySelectorAll('#result-entry-buttons .result-entry-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === value) {
        b.classList.add('result-entry-active');
        b.style.border = '2px solid #3b82f6';
        b.style.background = 'rgba(59,130,246,0.15)';
        b.style.color = '#60a5fa';
        b.style.fontWeight = '600';
      } else {
        b.classList.remove('result-entry-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
        b.style.fontWeight = '500';
      }
    });
    var hidden = document.getElementById('select-result-entry');
    if (hidden) hidden.value = value;
    var descEl = document.getElementById('result-entry-desc');
    if (descEl) descEl.textContent = _resultEntryDescs[value] || '';
  };

  // ── Monarch Classified Selection ──
  window._selectMonarchClassified = function(btn) {
    var value = btn.getAttribute('data-value');
    var btns = document.querySelectorAll('#monarch-classified-buttons .monarch-cls-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === value) {
        b.classList.add('monarch-cls-active');
        b.style.border = '2px solid #fbbf24';
        b.style.background = 'rgba(251,191,36,0.15)';
        b.style.color = '#fbbf24';
        b.style.fontWeight = '600';
      } else {
        b.classList.remove('monarch-cls-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
        b.style.fontWeight = '500';
      }
    });
    var hidden = document.getElementById('monarch-classified');
    if (hidden) hidden.value = value;
  };

  // ── Ranking Type Selection ──
  window._selectRankingType = function(value) {
    var btns = document.querySelectorAll('#ranking-type-buttons .ranking-type-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === value) {
        b.classList.add('ranking-type-active');
        b.style.border = '2px solid #f87171';
        b.style.background = 'rgba(248,113,113,0.12)';
        b.style.color = '#fca5a5';
      } else {
        b.classList.remove('ranking-type-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
      }
    });
    var sel = document.getElementById('elim-ranking-type');
    if (sel) sel.value = value;
  };

  // ── Logo Generator ──
  window._logoLocked = false;

  window._toggleLogoLock = function() {
    window._logoLocked = !window._logoLocked;
    var btn = document.getElementById('btn-logo-lock');
    var hiddenLock = document.getElementById('tourn-logo-locked');
    if (btn) {
      btn.textContent = window._logoLocked ? '🔒' : '🔓';
      btn.style.border = window._logoLocked ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.1)';
      btn.style.background = window._logoLocked ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)';
      btn.style.color = window._logoLocked ? '#fbbf24' : 'var(--text-muted)';
    }
    if (hiddenLock) hiddenLock.value = window._logoLocked ? '1' : '';
  };

  window._downloadTournamentLogo = function() {
    var hidden = document.getElementById('tourn-logo-data');
    var dataUrl = hidden ? hidden.value : '';
    if (!dataUrl) {
      if (typeof showNotification !== 'undefined') showNotification('Sem logo', 'Gere ou faça upload de um logo primeiro.', 'warning');
      return;
    }
    var nameEl = document.getElementById('tourn-name');
    var fileName = (nameEl && nameEl.value.trim()) ? nameEl.value.trim().replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_') + '_logo' : 'torneio_logo';
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  window._generateTournamentLogo = function() {
    var nameEl = document.getElementById('tourn-name');
    var sportEl = document.getElementById('select-sport');
    var formatEl = document.getElementById('select-formato');
    var venueEl = document.getElementById('tourn-venue');
    var name = nameEl ? nameEl.value.trim() : '';
    if (!name) name = 'Torneio';
    var sport = sportEl ? sportEl.options[sportEl.selectedIndex].text : '';
    var formatValue = formatEl ? formatEl.value : 'elim_simples';
    var venue = venueEl ? venueEl.value.trim() : '';

    // Get sport emoji
    var sportEmoji = '🏆';
    var emojiMap = {'🎾':'🎾','⚽':'⚽','🏐':'🏐','♟':'♟️','🃏':'🃏','🎮':'🎮','🏸':'🏸','🥒':'🥒','🏓':'🏓','🎴':'🎴'};
    Object.keys(emojiMap).forEach(function(k) { if (sport.includes(k)) sportEmoji = emojiMap[k]; });

    // Clean sport name (remove emoji prefix)
    var sportName = sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim();

    // Format label
    var formatMap = {
      liga: 'Liga', suico: 'Suíço', elim_simples: 'Eliminatórias',
      elim_dupla: 'Dupla Elim.', grupos_mata: 'Grupos + Elim.'
    };
    var formatLabel = formatMap[formatValue] || '';

    // Build initials (up to 3 chars from first letters of words)
    var words = name.split(/\s+/).filter(function(w) { return w.length > 0 && w[0] === w[0].toUpperCase(); });
    if (words.length === 0) words = name.split(/\s+/);
    var initials = words.slice(0, 3).map(function(w) { return w[0].toUpperCase(); }).join('');
    if (!initials) initials = name.substring(0, 2).toUpperCase();

    // Sport-themed color palettes (more variety)
    var sportPalettes = {
      'Beach Tennis':  [['#f59e0b', '#d97706'], ['#f97316', '#ea580c'], ['#eab308', '#ca8a04']],
      'Pickleball':    [['#15803d', '#86efac'], ['#166534', '#6ee7b7'], ['#047857', '#a7f3d0']],
      'Tênis':         [['#0369a1', '#38bdf8'], ['#0284c7', '#7dd3fc'], ['#1e40af', '#60a5fa']],
      'Tênis de Mesa': [['#b91c1c', '#ef4444'], ['#dc2626', '#f87171'], ['#991b1b', '#fca5a5']],
      'Padel':         [['#4338ca', '#6366f1'], ['#4f46e5', '#818cf8'], ['#3730a3', '#a5b4fc']],
    };
    var palettes = sportPalettes[sportName] || [
      ['#4338ca', '#6366f1'], ['#0f766e', '#14b8a6'], ['#b91c1c', '#ef4444'],
      ['#c2410c', '#f97316'], ['#15803d', '#22c55e'], ['#7c3aed', '#a78bfa'],
      ['#0369a1', '#38bdf8'], ['#be185d', '#ec4899'], ['#854d0e', '#eab308'],
      ['#1e40af', '#60a5fa']
    ];
    var pal = palettes[Math.floor(Math.random() * palettes.length)];

    // Create canvas
    var canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    var ctx = canvas.getContext('2d');

    // Background gradient (diagonal)
    var grad = ctx.createLinearGradient(0, 0, 400, 400);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.fillStyle = grad;
    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(40, 0); ctx.lineTo(360, 0); ctx.quadraticCurveTo(400, 0, 400, 40);
    ctx.lineTo(400, 360); ctx.quadraticCurveTo(400, 400, 360, 400);
    ctx.lineTo(40, 400); ctx.quadraticCurveTo(0, 400, 0, 360);
    ctx.lineTo(0, 40); ctx.quadraticCurveTo(0, 0, 40, 0);
    ctx.closePath();
    ctx.fill();

    // Subtle pattern (diagonal lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (var i = -400; i < 800; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 400, 400); ctx.stroke();
    }

    // Sport emoji (large, semi-transparent, top-right)
    ctx.font = '120px serif';
    ctx.globalAlpha = 0.12;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(sportEmoji, 310, 100);
    ctx.globalAlpha = 1;

    // Second sport emoji bottom-left (smaller, more subtle)
    ctx.font = '80px serif';
    ctx.globalAlpha = 0.06;
    ctx.fillText(sportEmoji, 80, 340);
    ctx.globalAlpha = 1;

    // Initials (large centered text)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + (initials.length > 2 ? '110' : '130') + 'px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText(initials, 200, 155);
    ctx.shadowColor = 'transparent';

    // Tournament name (below initials)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    var nameFontSize = name.length > 25 ? 20 : name.length > 15 ? 24 : 28;
    ctx.font = '700 ' + nameFontSize + 'px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var maxWidth = 340;
    var words2 = name.split(' ');
    var lines = [];
    var line = '';
    words2.forEach(function(w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else { line = test; }
    });
    if (line) lines.push(line);
    var lineH = nameFontSize + 6;
    var nameBlockY = 265 - ((lines.length - 1) * lineH) / 2;
    lines.forEach(function(l, i) { ctx.fillText(l, 200, nameBlockY + i * lineH); });

    // Info line: sport + format (subtle pill below name)
    var infoText = sportName;
    if (formatLabel) infoText += ' • ' + formatLabel;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, sans-serif';
    var infoY = nameBlockY + lines.length * lineH + 10;
    ctx.fillText(infoText, 200, infoY);

    // Venue (if available, small at bottom)
    if (venue) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '400 14px -apple-system, BlinkMacSystemFont, sans-serif';
      var venueDisplay = venue.length > 35 ? venue.substring(0, 33) + '…' : venue;
      ctx.fillText('📍 ' + venueDisplay, 200, infoY + 22);
    }

    // "scoreplace.app" watermark
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('scoreplace.app', 200, 388);

    // Convert to data URL and apply (JPEG for smaller size in Firestore)
    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    window._applyTournamentLogo(dataUrl);
  };

  window._handleLogoUpload = function(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      if (typeof showNotification !== 'undefined') showNotification('Arquivo muito grande', 'O logo deve ter no máximo 5MB.', 'warning');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      // Resize to max 400x400 and compress as JPEG to keep Firestore doc size safe
      var img = new Image();
      img.onload = function() {
        var maxSize = 400;
        var w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl = c.toDataURL('image/jpeg', 0.85);
        window._applyTournamentLogo(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  window._applyTournamentLogo = function(dataUrl) {
    var preview = document.getElementById('logo-preview');
    var hidden = document.getElementById('tourn-logo-data');
    if (preview) {
      preview.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">';
    }
    if (hidden) hidden.value = dataUrl;
  };

  window._clearTournamentLogo = function() {
    var preview = document.getElementById('logo-preview');
    var hidden = document.getElementById('tourn-logo-data');
    if (preview) preview.innerHTML = '<span style="font-size:0.7rem;color:var(--text-muted);text-align:center;padding:4px;">Sem logo</span>';
    if (hidden) hidden.value = '';
    // Reset lock
    window._logoLocked = false;
    var btn = document.getElementById('btn-logo-lock');
    if (btn) { btn.textContent = '🔓'; btn.style.border = '1px solid rgba(255,255,255,0.1)'; btn.style.background = 'rgba(255,255,255,0.05)'; btn.style.color = 'var(--text-muted)'; }
    var hiddenLock = document.getElementById('tourn-logo-locked');
    if (hiddenLock) hiddenLock.value = '';
  };

  // ── Visibility toggle ──
  window._setVisibility = function(vis) {
    var btnPub = document.getElementById('btn-vis-public');
    var btnPri = document.getElementById('btn-vis-private');
    var hidden = document.getElementById('tourn-public');
    var desc = document.getElementById('vis-desc');
    if (!btnPub || !btnPri) return;
    if (vis === 'public') {
      btnPub.style.border = '2px solid #3b82f6'; btnPub.style.background = 'rgba(59,130,246,0.15)'; btnPub.style.color = '#60a5fa';
      btnPri.style.border = '2px solid rgba(255,255,255,0.18)'; btnPri.style.background = 'rgba(255,255,255,0.06)'; btnPri.style.color = 'var(--text-main)';
      if (hidden) hidden.value = 'true';
      if (desc) desc.textContent = 'Visível para todos na aba Explorar. Qualquer pessoa pode se inscrever.';
    } else {
      btnPri.style.border = '2px solid #3b82f6'; btnPri.style.background = 'rgba(59,130,246,0.15)'; btnPri.style.color = '#60a5fa';
      btnPub.style.border = '2px solid rgba(255,255,255,0.18)'; btnPub.style.background = 'rgba(255,255,255,0.06)'; btnPub.style.color = 'var(--text-main)';
      if (hidden) hidden.value = 'false';
      if (desc) desc.textContent = 'Apenas você e jogadores convidados poderão ver o torneio.';
    }
  };

  window._onSportChange = function () {
    const sportSelect = document.getElementById('select-sport');
    if (!sportSelect) return;

    const sportName = sportSelect.options[sportSelect.selectedIndex] ? sportSelect.options[sportSelect.selectedIndex].text.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
    const defaultSize = _sportTeamDefaults[sportName] || 2;

    // Set default team size for sport
    const teamSizeEl = document.getElementById('tourn-team-size');
    if (teamSizeEl) {
      teamSizeEl.value = defaultSize;
    }

    // Set default game type based on sport
    var btnS = document.getElementById('btn-tipo-simples');
    var btnD = document.getElementById('btn-tipo-duplas');
    if (btnS && btnD) {
      if (defaultSize === 1) {
        // Solo sport: default Simples on, Duplas off
        btnS.classList.add('game-type-active');
        btnS.style.border = '2px solid #3b82f6';
        btnS.style.background = 'rgba(59,130,246,0.15)';
        btnS.style.color = '#60a5fa';
        btnD.classList.remove('game-type-active');
        btnD.style.border = '2px solid rgba(255,255,255,0.18)';
        btnD.style.background = 'rgba(255,255,255,0.06)';
        btnD.style.color = 'var(--text-main)';
      } else {
        // Doubles sport: default Duplas on, Simples off
        btnD.classList.add('game-type-active');
        btnD.style.border = '2px solid #3b82f6';
        btnD.style.background = 'rgba(59,130,246,0.15)';
        btnD.style.color = '#60a5fa';
        btnS.classList.remove('game-type-active');
        btnS.style.border = '2px solid rgba(255,255,255,0.18)';
        btnS.style.background = 'rgba(255,255,255,0.06)';
        btnS.style.color = 'var(--text-main)';
      }
      // Update hidden fields
      window._toggleGameType(defaultSize === 1 ? 'simples' : 'duplas');
    }
  };

  window._onFormatoChange = function () {
    const fmt = document.getElementById('select-formato').value;
    const isElim = fmt === 'elim_simples' || fmt === 'elim_dupla';
    const isSuico = fmt === 'suico';
    const isLiga = fmt === 'liga';
    const isGrupos = fmt === 'grupos_mata';
    const drawMode = document.getElementById('draw-mode').value;
    const isMonarch = drawMode === 'rei_rainha';

    document.getElementById('suico-fields').style.display = isSuico ? 'block' : 'none';
    document.getElementById('liga-fields').style.display = isLiga ? 'block' : 'none';
    document.getElementById('suico-draw-schedule-fields').style.display = isSuico ? 'block' : 'none';
    document.getElementById('elim-settings').style.display = (isElim || isGrupos) ? 'block' : 'none';
    document.getElementById('grupos-fields').style.display = isGrupos ? 'block' : 'none';
    document.getElementById('rei-rainha-fields').style.display = isMonarch ? 'block' : 'none';

    // Grupos + Elim. incompatível com Rei/Rainha: esconder botão e forçar Sorteio
    var monarchDrawBtn = document.getElementById('btn-draw-mode-monarch');
    if (monarchDrawBtn) {
      if (isGrupos) {
        monarchDrawBtn.style.display = 'none';
        // Auto-select Sorteio if Rei/Rainha was active
        if (drawMode === 'rei_rainha') {
          var sorteioBtn = document.querySelector('#draw-mode-buttons .draw-mode-btn[data-value="sorteio"]');
          if (sorteioBtn) window._selectDrawMode(sorteioBtn);
        }
      } else {
        monarchDrawBtn.style.display = '';
      }
    }

    // Sync Liga internal round format toggle with global draw mode
    if (isLiga) {
      var ligaRfVal = isMonarch ? 'rei_rainha' : 'standard';
      var ligaRfHidden = document.getElementById('liga-round-format');
      if (ligaRfHidden) ligaRfHidden.value = ligaRfVal;
      var ligaRfBtn = document.querySelector('#liga-round-format-buttons .liga-rf-btn[data-value="' + ligaRfVal + '"]');
      if (ligaRfBtn) window._selectLigaRoundFormat(ligaRfBtn);
    }

    // Esconder estimativas de tempo para Liga e Suíço (não fazem sentido)
    var estimContainer = document.getElementById('time-estimates-container');
    if (estimContainer) estimContainer.style.display = (isLiga || isSuico) ? 'none' : '';

    window._updateAutoCloseVisibility();
    window._updateRegDateVisibility();
    window._onInscricaoChange();
    window._recalcDuration();
  };

  // _onRankingManualChange mantida como alias para backward compat
  window._onRankingManualChange = function () {};

  // Liga round format toggle (Padrão / Rei/Rainha)
  window._selectLigaRoundFormat = function(btn) {
    var val = btn.getAttribute('data-value');
    document.getElementById('liga-round-format').value = val;
    var btns = document.querySelectorAll('#liga-round-format-buttons .liga-rf-btn');
    btns.forEach(function(b) {
      if (b.getAttribute('data-value') === val) {
        b.classList.add('liga-rf-active');
        b.style.border = '2px solid #34d399'; b.style.background = 'rgba(16,185,129,0.15)'; b.style.color = '#34d399';
      } else {
        b.classList.remove('liga-rf-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)'; b.style.background = 'rgba(255,255,255,0.06)'; b.style.color = 'var(--text-main)';
      }
    });
    var desc = document.getElementById('liga-rf-desc');
    if (desc) desc.textContent = val === 'rei_rainha'
      ? 'Grupos de 4 com parceiros rotativos (AB vs CD, AC vs BD, AD vs BC). Pontuação individual acumulada.'
      : 'Pareamento suíço: jogadores com pontuação similar se enfrentam.';
  };

  // Toggle liga season custom duration
  window._onLigaSeasonChange = function () {
    var sel = document.getElementById('liga-season-duration');
    var c = document.getElementById('liga-custom-duration-container');
    if (sel && c) c.style.display = sel.value === 'custom' ? '' : 'none';
  };

  (function() {
    var sel = document.getElementById('liga-season-duration');
    if (sel) sel.addEventListener('change', window._onLigaSeasonChange);
    var inact = document.getElementById('liga-inactivity');
    if (inact) {
      inact.addEventListener('change', function() {
        var c = document.getElementById('liga-inactivity-x-container');
        if (c) c.style.display = inact.value === 'remove' ? '' : 'none';
      });
    }
  })();

  // ─── Category management ──────────────────────────────────────────────────
  window._toggleGenderCat = function(cat) {
    var hidden = document.getElementById('tourn-gender-categories');
    var current = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
    var idx = current.indexOf(cat);
    if (idx !== -1) {
      current.splice(idx, 1);
    } else {
      current.push(cat);
    }
    hidden.value = current.join(',');
    window._applyGenderCatUI(current);
    window._updateCategoryPreview();
  };

  window._applyGenderCatUI = function(values) {
    if (!values) {
      var h = document.getElementById('tourn-gender-categories');
      values = h && h.value ? h.value.split(',').filter(Boolean) : [];
    }
    var map = { fem: 'btn-cat-fem', masc: 'btn-cat-masc', misto_aleatorio: 'btn-cat-misto-ale', misto_obrigatorio: 'btn-cat-misto-obr' };
    var onStyle = 'padding:6px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid #a855f7;background:rgba(168,85,247,0.22);color:#d8b4fe;font-weight:700;box-shadow:0 0 0 1px rgba(168,85,247,0.3);';
    var offStyle = 'padding:6px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;transition:all 0.15s;white-space:nowrap;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;';
    Object.keys(map).forEach(function(k) {
      var btn = document.getElementById(map[k]);
      if (btn) btn.style.cssText = values.indexOf(k) !== -1 ? onStyle : offStyle;
    });
  };

  window._updateCategoryPreview = function() {
    var genderVals = (document.getElementById('tourn-gender-categories').value || '').split(',').filter(Boolean);
    var skillText = (document.getElementById('tourn-skill-categories').value || '').trim();
    var skillCats = skillText ? skillText.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    // Game type dimension
    var gameTypesVal = (document.getElementById('tourn-game-types') || {}).value || '';
    var gameTypes = [];
    if (gameTypesVal === 'simples,duplas') { gameTypes = ['Simples', 'Duplas']; }
    else if (gameTypesVal === 'simples') { gameTypes = ['Simples']; }
    else if (gameTypesVal === 'duplas') { gameTypes = ['Duplas']; }

    var preview = document.getElementById('category-preview');
    var list = document.getElementById('category-preview-list');
    if (!preview || !list) return;

    var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto Aleat.', misto_obrigatorio: 'Misto Obrig.' };
    var baseCats = [];

    if (genderVals.length > 0 && skillCats.length > 0) {
      genderVals.forEach(function(g) {
        skillCats.forEach(function(s) {
          baseCats.push((genderLabels[g] || g) + ' ' + s);
        });
      });
    } else if (genderVals.length > 0) {
      genderVals.forEach(function(g) { baseCats.push(genderLabels[g] || g); });
    } else if (skillCats.length > 0) {
      skillCats.forEach(function(s) { baseCats.push(s); });
    }

    // Cross with game types only if both types selected AND there are gender/skill categories
    var combined = [];
    if (gameTypes.length === 2 && baseCats.length > 0) {
      baseCats.forEach(function(c) {
        gameTypes.forEach(function(gt) { combined.push(c + ' ' + gt); });
      });
    } else {
      combined = baseCats;
    }

    if (combined.length === 0) {
      preview.style.display = 'none';
      return;
    }

    var _dnPreview = (typeof window._displayCategoryName === 'function') ? window._displayCategoryName : function(c) { return c; };
    list.innerHTML = combined.map(function(c) {
      return '<span style="padding:3px 10px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.25);border-radius:6px;color:#d8b4fe;font-weight:600;">' + _dnPreview(c) + '</span>';
    }).join('');
    preview.style.display = '';
  };

  window._getTournamentCategories = function() {
    var genderVals = (document.getElementById('tourn-gender-categories').value || '').split(',').filter(Boolean);
    var skillText = (document.getElementById('tourn-skill-categories').value || '').trim();
    var skillCats = skillText ? skillText.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var genderLabels = { fem: 'Fem', masc: 'Masc', misto_aleatorio: 'Misto Aleat.', misto_obrigatorio: 'Misto Obrig.' };

    // Game type dimension
    var gameTypesVal = (document.getElementById('tourn-game-types') || {}).value || '';
    var gameTypes = [];
    if (gameTypesVal === 'simples,duplas') { gameTypes = ['Simples', 'Duplas']; }

    var baseCats = [];
    if (genderVals.length > 0 && skillCats.length > 0) {
      genderVals.forEach(function(g) {
        skillCats.forEach(function(s) { baseCats.push((genderLabels[g] || g) + ' ' + s); });
      });
    } else if (genderVals.length > 0) {
      genderVals.forEach(function(g) { baseCats.push(genderLabels[g] || g); });
    } else if (skillCats.length > 0) {
      baseCats = skillCats.slice();
    }

    // Cross with game types only if both types selected AND there are categories
    var combined = [];
    if (gameTypes.length === 2 && baseCats.length > 0) {
      baseCats.forEach(function(c) {
        gameTypes.forEach(function(gt) { combined.push(c + ' ' + gt); });
      });
    } else {
      combined = baseCats;
    }

    return { genderCategories: genderVals, skillCategories: skillCats, combinedCategories: combined };
  };

  window._onInscricaoChange = function () {
    // Team size is always visible — enrollment mode does not affect it
  };

  window._updateRegDateVisibility = function () {
    const fmt = document.getElementById('select-formato').value;
    const regBox = document.getElementById('reg-date-container');
    if (!regBox) return;
    const isLiga = fmt === 'liga';
    const openEnroll = document.getElementById('liga-open-enrollment');
    // Liga com inscrições abertas esconde prazo de inscrição
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
  const OPENWEATHER_API_KEY = ['8fc3ddd6','9fcd76f8','0ba767c3','0ebd8b9d'].join('');

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
        // Google Places library loaded
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
          window._safeHtml(mainText) + '</div>' +
          (secondaryText ? '<div style="color:#94a3b8; font-size:0.75rem; margin-top:2px;">' + window._safeHtml(secondaryText) + '</div>' : '');

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
      suggestionsDiv.innerHTML = '<div style="padding:10px 14px; color:#f87171; font-size:0.8rem;">Erro na busca: ' + window._safeHtml(err.message || 'API indisponível') + '</div>';
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
          '<span style="font-weight:500; color:#e2e8f0;">📍 ' + window._safeHtml(name) + '</span>' +
          '<span style="color:#94a3b8; font-size:0.7rem;">' + window._safeHtml(fullAddress) + '</span>' +
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

  window._onLigaManualDrawChange = function () {
    var manual = document.getElementById('liga-manual-draw');
    var dateField = document.getElementById('liga-first-draw-date');
    var timeField = document.getElementById('liga-first-draw-time');
    var intervalField = document.getElementById('liga-draw-interval');
    if (!manual) return;
    var disabled = manual.checked;
    if (dateField) dateField.disabled = disabled;
    if (timeField) timeField.disabled = disabled;
    if (intervalField) intervalField.disabled = disabled;
  };

  // Wire up inactivity change
  setTimeout(() => {
    const el = document.getElementById('liga-inactivity');
    if (el) el.addEventListener('change', window._onLigaInactivityChange);
    // Wire up liga open enrollment checkbox to hide/show registration date
    const openEnrollEl = document.getElementById('liga-open-enrollment');
    if (openEnrollEl) openEnrollEl.addEventListener('change', window._updateRegDateVisibility);
    // Wire up liga manual draw checkbox
    const ligaManualEl = document.getElementById('liga-manual-draw');
    if (ligaManualEl) ligaManualEl.addEventListener('change', window._onLigaManualDrawChange);
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
      let desc = '<strong>' + pCount + '</strong> inscritos → <strong>' + matches + ' jogos</strong> (~' + _fmtMin(time) + ')';
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
          '<span><strong>' + p + '</strong> inscritos</span>' +
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
        '<span>Classificatórias: <strong>' + excess + '</strong> jogos extras (' + (excess * 2) + ' inscritos jogam), chave principal de ' + prev + '</span>' +
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
              'Aplicar ' + bestPow + ' inscritos',
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

    // Determine format value and draw mode from stored data
    let fmtValue = 'elim_simples';
    var drawModeVal = t.drawMode || 'sorteio';
    if (t.format === 'Liga') fmtValue = 'liga';
    else if (t.format === 'Suíço Clássico') fmtValue = 'suico';
    else if (t.format === 'Ranking') fmtValue = 'liga'; // Ranking unificado com Liga
    else if (t.format === 'Eliminatórias Simples') fmtValue = 'elim_simples';
    else if (t.format === 'Dupla Eliminatória') fmtValue = 'elim_dupla';
    else if (t.format === 'Fase de Grupos + Eliminatórias') fmtValue = 'grupos_mata';
    else if (t.format === 'Rei/Rainha da Praia') {
      fmtValue = 'elim_simples'; // Rei/Rainha defaults to single elimination knockout
      drawModeVal = 'rei_rainha';
    }
    // Liga with ligaRoundFormat rei_rainha
    if (fmtValue === 'liga' && t.ligaRoundFormat === 'rei_rainha') {
      drawModeVal = 'rei_rainha';
    }
    document.getElementById('select-formato').value = fmtValue;
    document.getElementById('draw-mode').value = drawModeVal;
    // Monarch config
    if (drawModeVal === 'rei_rainha') {
      var _mcEl = document.getElementById('monarch-classified');
      if (_mcEl) _mcEl.value = String(t.monarchClassified || 1);
      var _mcBtn = document.querySelector('#monarch-classified-buttons .monarch-cls-btn[data-value="' + (t.monarchClassified || 1) + '"]');
      if (_mcBtn) window._selectMonarchClassified(_mcBtn);
    }
    // Sync draw mode buttons
    var dmBtns = document.querySelectorAll('#draw-mode-buttons .draw-mode-btn');
    dmBtns.forEach(function(b) {
      if (b.getAttribute('data-value') === drawModeVal) {
        b.classList.add('draw-mode-active');
        b.style.border = '2px solid #34d399'; b.style.background = 'rgba(16,185,129,0.15)'; b.style.color = '#34d399'; b.style.fontWeight = '600';
      } else {
        b.classList.remove('draw-mode-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)'; b.style.background = 'rgba(255,255,255,0.06)'; b.style.color = 'var(--text-main)'; b.style.fontWeight = '600';
      }
    });
    var dmDescEl = document.getElementById('draw-mode-desc');
    if (dmDescEl && typeof _drawModeDescs !== 'undefined') dmDescEl.textContent = _drawModeDescs[drawModeVal] || '';
    // Sync formato buttons with loaded value
    var fmtBtns = document.querySelectorAll('#formato-buttons .formato-btn');
    fmtBtns.forEach(function(b) {
      if (b.getAttribute('data-value') === fmtValue) {
        b.classList.add('formato-btn-active');
        b.style.border = '2px solid #3b82f6';
        b.style.background = 'rgba(59,130,246,0.15)';
        b.style.color = '#60a5fa';
        b.style.fontWeight = '600';
      } else {
        b.classList.remove('formato-btn-active');
        b.style.border = '2px solid rgba(255,255,255,0.18)';
        b.style.background = 'rgba(255,255,255,0.06)';
        b.style.color = 'var(--text-main)';
        b.style.fontWeight = '500';
      }
    });
    var fmtDescEl = document.getElementById('formato-desc');
    if (fmtDescEl && typeof _formatoDescs !== 'undefined') fmtDescEl.textContent = _formatoDescs[fmtValue] || '';

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
    var _enrollMode = t.enrollmentMode || 'individual';
    document.getElementById('select-inscricao').value = _enrollMode;
    // Sync enrollment mode buttons
    var _emBtn = document.querySelector('#enroll-mode-buttons .enroll-mode-btn[data-value="' + _enrollMode + '"]');
    if (_emBtn) window._selectEnrollMode(_emBtn);
    if (t.teamSize) document.getElementById('tourn-team-size').value = t.teamSize;

    // Restore game types (Simples/Duplas)
    var _gt = t.gameTypes || '';
    var _btnS = document.getElementById('btn-tipo-simples');
    var _btnD = document.getElementById('btn-tipo-duplas');
    if (_btnS && _btnD) {
      var hasSim = _gt.indexOf('simples') !== -1;
      var hasDup = _gt.indexOf('duplas') !== -1;
      // Fallback from legacy teamSize
      if (!hasSim && !hasDup) {
        hasDup = parseInt(t.teamSize) >= 2;
        hasSim = parseInt(t.teamSize) <= 1;
      }
      if (hasSim) { _btnS.classList.add('game-type-active'); _btnS.style.border='2px solid #3b82f6'; _btnS.style.background='rgba(59,130,246,0.15)'; _btnS.style.color='#60a5fa'; }
      else { _btnS.classList.remove('game-type-active'); _btnS.style.border='2px solid rgba(255,255,255,0.18)'; _btnS.style.background='rgba(255,255,255,0.06)'; _btnS.style.color='var(--text-main)'; }
      if (hasDup) { _btnD.classList.add('game-type-active'); _btnD.style.border='2px solid #3b82f6'; _btnD.style.background='rgba(59,130,246,0.15)'; _btnD.style.color='#60a5fa'; }
      else { _btnD.classList.remove('game-type-active'); _btnD.style.border='2px solid rgba(255,255,255,0.18)'; _btnD.style.background='rgba(255,255,255,0.06)'; _btnD.style.color='var(--text-main)'; }
      var gtField = document.getElementById('tourn-game-types');
      if (gtField) gtField.value = _gt || (hasSim && hasDup ? 'simples,duplas' : hasDup ? 'duplas' : 'simples');
    }

    // Restore sport button
    var _sportBtns = document.querySelectorAll('#sport-buttons .sport-btn');
    _sportBtns.forEach(function(sb) {
      var sportText = sb.getAttribute('data-sport') || '';
      var sportCleanBtn = sportText.replace(/^[^\w\u00C0-\u024F]+/u, '').trim();
      if (sportCleanBtn === (t.sport || '').replace(/^[^\w\u00C0-\u024F]+/u, '').trim()) {
        sb.classList.add('sport-btn-active'); sb.style.border='2px solid #fbbf24'; sb.style.background='rgba(251,191,36,0.15)'; sb.style.color='#fbbf24';
      } else {
        sb.classList.remove('sport-btn-active'); sb.style.border='2px solid rgba(255,255,255,0.18)'; sb.style.background='rgba(255,255,255,0.06)'; sb.style.color='var(--text-main)';
      }
    });

    // Restore ranking type button
    var _rkType = t.rankingType || 'individual';
    var _rkBtns = document.querySelectorAll('#ranking-type-buttons .ranking-type-btn');
    _rkBtns.forEach(function(rb) {
      if (rb.getAttribute('data-value') === _rkType) {
        rb.classList.add('ranking-type-active'); rb.style.border='2px solid #f87171'; rb.style.background='rgba(248,113,113,0.12)'; rb.style.color='#fca5a5';
      } else {
        rb.classList.remove('ranking-type-active'); rb.style.border='2px solid rgba(255,255,255,0.18)'; rb.style.background='rgba(255,255,255,0.06)'; rb.style.color='var(--text-main)';
      }
    });
    document.getElementById('tourn-max-participants').value = t.maxParticipants || '';
    document.getElementById('tourn-auto-close').checked = !!t.autoCloseOnFull;
    window._setVisibility(t.isPublic !== false ? 'public' : 'private');
    document.getElementById('select-result-entry').value = t.resultEntry || 'organizer';
    var _reBtn = document.querySelector('#result-entry-buttons .result-entry-btn[data-value="' + (t.resultEntry || 'organizer') + '"]');
    if (_reBtn) window._selectResultEntry(_reBtn);

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
    // Restore logo
    document.getElementById('tourn-logo-data').value = t.logoData || '';
    if (t.logoData) {
      window._applyTournamentLogo(t.logoData);
    } else {
      window._clearTournamentLogo();
    }
    // Restore lock state
    window._logoLocked = !!t.logoLocked;
    document.getElementById('tourn-logo-locked').value = t.logoLocked ? '1' : '';
    var lockBtn = document.getElementById('btn-logo-lock');
    if (lockBtn) {
      lockBtn.textContent = window._logoLocked ? '🔒' : '🔓';
      lockBtn.style.border = window._logoLocked ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.1)';
      lockBtn.style.background = window._logoLocked ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)';
      lockBtn.style.color = window._logoLocked ? '#fbbf24' : 'var(--text-muted)';
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

    // GSM scoring config
    if (t.scoring) {
      document.getElementById('gsm-type').value = t.scoring.type || 'simple';
      document.getElementById('gsm-setsToWin').value = t.scoring.setsToWin || 1;
      document.getElementById('gsm-gamesPerSet').value = t.scoring.gamesPerSet || 6;
      document.getElementById('gsm-tiebreakEnabled').value = t.scoring.tiebreakEnabled || false;
      document.getElementById('gsm-tiebreakPoints').value = t.scoring.tiebreakPoints || 7;
      document.getElementById('gsm-tiebreakMargin').value = t.scoring.tiebreakMargin || 2;
      document.getElementById('gsm-superTiebreak').value = t.scoring.superTiebreak || false;
      document.getElementById('gsm-superTiebreakPoints').value = t.scoring.superTiebreakPoints || 10;
      document.getElementById('gsm-countingType').value = t.scoring.countingType || 'numeric';
      document.getElementById('gsm-advantageRule').value = t.scoring.advantageRule || false;
      document.getElementById('gsm-fixedSet').value = t.scoring.fixedSet || false;
      document.getElementById('gsm-fixedSetGames').value = t.scoring.fixedSetGames || 6;
      // Update detailed summary display
      if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
    }

    // Suíço
    if (t.swissRounds) document.getElementById('suico-rounds').value = t.swissRounds;
    // Suíço draw schedule
    if (t.drawFirstDate) document.getElementById('suico-first-draw-date').value = t.drawFirstDate;
    if (t.drawFirstTime) document.getElementById('suico-first-draw-time').value = t.drawFirstTime;
    if (t.drawIntervalDays) document.getElementById('suico-draw-interval').value = t.drawIntervalDays;
    if (t.drawManual) document.getElementById('suico-manual-draw').checked = t.drawManual;

    // Liga (unificado — carrega dados de Liga e antigo Ranking)
    // Backward compat: migrar campos ranking* → liga* se necessário
    var _nps = t.ligaNewPlayerScore || t.rankingNewPlayerScore;
    var _inact = t.ligaInactivity || t.rankingInactivity;
    var _inactX = t.ligaInactivityX || t.rankingInactivityX;
    var _season = t.ligaSeasonMonths || t.rankingSeasonMonths;
    var _openEnroll = (t.ligaOpenEnrollment !== undefined) ? t.ligaOpenEnrollment : (t.rankingOpenEnrollment !== undefined ? t.rankingOpenEnrollment : true);

    if (_nps) document.getElementById('liga-new-player-score').value = _nps;
    if (_inact) document.getElementById('liga-inactivity').value = _inact;
    if (_inactX) document.getElementById('liga-inactivity-x').value = _inactX;
    document.getElementById('liga-open-enrollment').checked = _openEnroll !== false;

    // Temporada
    if (_season) {
      var lsd = document.getElementById('liga-season-duration');
      if (['3','6','12'].indexOf(String(_season)) !== -1) {
        lsd.value = String(_season);
      } else {
        lsd.value = 'custom';
        document.getElementById('liga-custom-months').value = _season;
        document.getElementById('liga-custom-duration-container').style.display = '';
      }
    }

    // Agendamento (shared field drawFirstDate, drawFirstTime, drawIntervalDays, drawManual)
    if (t.format === 'Liga' && t.drawFirstDate) document.getElementById('liga-first-draw-date').value = t.drawFirstDate;
    if (t.format === 'Liga' && t.drawFirstTime) document.getElementById('liga-first-draw-time').value = t.drawFirstTime;
    if (t.format === 'Liga' && t.drawIntervalDays) document.getElementById('liga-draw-interval').value = t.drawIntervalDays;
    if (t.format === 'Liga') document.getElementById('liga-manual-draw').checked = !!t.drawManual;
    // Liga round format
    if (t.ligaRoundFormat && t.ligaRoundFormat !== 'standard') {
      var _rfEl = document.getElementById('liga-round-format');
      if (_rfEl) _rfEl.value = t.ligaRoundFormat;
      var _rfBtn = document.querySelector('#liga-round-format-buttons .liga-rf-btn[data-value="' + t.ligaRoundFormat + '"]');
      if (_rfBtn) window._selectLigaRoundFormat(_rfBtn);
    }

    // Elim settings
    // elimThirdPlace is always true — no toggle needed
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

    // Categorias (gênero + habilidade)
    if (t.genderCategories && t.genderCategories.length > 0) {
      document.getElementById('tourn-gender-categories').value = t.genderCategories.join(',');
      window._applyGenderCatUI(t.genderCategories);
    }
    if (t.skillCategories && t.skillCategories.length > 0) {
      document.getElementById('tourn-skill-categories').value = t.skillCategories.join(', ');
    }
    window._updateCategoryPreview();

    window._onFormatoChange();
    window._onLigaInactivityChange();
    window._updateRegDateVisibility();
    window._recalcDuration();
    openModal('modal-create-tournament');
    setTimeout(function() {
      if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
      if (typeof window._initPlacesAutocomplete === 'function') window._initPlacesAutocomplete();
    }, 100);
  };

  // NOTE: btn-create-tournament não existe no HTML.
  // A criação é feita via btn-create-tournament-in-box (dashboard.js) → modal-quick-create → main.js.
  // Bloco de dead code removido em v0.2.4-alpha.

  const btnSave = document.getElementById('btn-save-tournament');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      try {
        const editId = document.getElementById('edit-tournament-id').value;
        const name = document.getElementById('tourn-name').value.trim();
        if (!name) { showAlertDialog('Nome Obrigatório', 'Preencha o nome do torneio.', null, { type: 'warning' }); return; }

        // Impede nome duplicado (ignora o próprio torneio em edição)
        const nomeDuplicado = window.AppStore.tournaments.some(function(t) {
          if (editId && String(t.id) === String(editId)) return false;
          return t.name && t.name.trim().toLowerCase() === name.toLowerCase();
        });
        if (nomeDuplicado) { showAlertDialog('Nome Duplicado', 'Já existe um torneio com este nome. Escolha outro nome.', null, { type: 'warning' }); return; }

        const formatValue = document.getElementById('select-formato').value;
        const drawModeValue = document.getElementById('draw-mode').value;
        const formatMap = {
          liga: 'Liga',
          suico: 'Suíço Clássico',
          elim_simples: 'Eliminatórias Simples',
          elim_dupla: 'Dupla Eliminatória',
          grupos_mata: 'Fase de Grupos + Eliminatórias'
        };
        // When draw mode is Rei/Rainha and format is NOT Liga, save as standalone Rei/Rainha format
        var format;
        if (drawModeValue === 'rei_rainha' && formatValue !== 'liga') {
          format = 'Rei/Rainha da Praia';
        } else {
          format = formatMap[formatValue] || 'Eliminatórias Simples';
        }

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
        const maxPartsVal = parseInt(document.getElementById('tourn-max-participants').value) || null;
        const autoCloseVal = document.getElementById('tourn-auto-close').checked;
        const resultEntryVal = document.getElementById('select-result-entry').value || 'organizer';
        const isPublicVal = document.getElementById('tourn-public').value === 'true';

        // Venue / Courts / Time
        const venueVal = document.getElementById('tourn-venue').value.trim();
        const venueAccessVal = document.getElementById('tourn-venue-access').value || '';
        const venueLatVal = document.getElementById('tourn-venue-lat').value || '';
        const venueLonVal = document.getElementById('tourn-venue-lon').value || '';
        const venueAddressVal = document.getElementById('tourn-venue-address').value || '';
        const venuePlaceIdVal = document.getElementById('tourn-venue-place-id').value || '';
        const venuePhotoUrlVal = document.getElementById('tourn-venue-photo-url').value || '';
        const logoDataVal = document.getElementById('tourn-logo-data').value || '';
        const logoLockedVal = document.getElementById('tourn-logo-locked').value === '1';
        const courtCountVal = parseInt(document.getElementById('tourn-court-count').value) || 1;
        const courtNamesRaw = document.getElementById('tourn-court-names').value.trim();
        const courtNamesVal = courtNamesRaw ? courtNamesRaw.split(',').map(c => c.trim()).filter(c => c) : [];
        const callTimeVal = parseInt(document.getElementById('tourn-call-time').value) || 0;
        const warmupTimeVal = parseInt(document.getElementById('tourn-warmup-time').value) || 0;
        const gameDurationVal = parseInt(document.getElementById('tourn-game-duration').value) || 30;

        // Validação de datas
        if (startDateRaw && endDateRaw) {
          const _startD = new Date(startDateVal);
          const _endD = new Date(endDateVal);
          if (_endD <= _startD) {
            showAlertDialog('Datas Inválidas', 'A data/hora de fim deve ser posterior à data/hora de início.', null, { type: 'warning' });
            return;
          }
        }
        if (regDateRaw && startDateRaw) {
          const _regD = new Date(regDateVal);
          const _startD2 = new Date(startDateVal);
          if (_regD >= _startD2) {
            showAlertDialog('Prazo de Inscrição Inválido', 'O prazo de inscrição deve ser anterior ao início do torneio.', null, { type: 'warning' });
            return;
          }
        }

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
          gameTypes: (document.getElementById('tourn-game-types') || {}).value || 'duplas',
          thirdPlace: true,
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
          logoData: logoDataVal,
          logoLocked: logoLockedVal,
          courtCount: courtCountVal,
          courtNames: courtNamesVal,
          callTime: callTimeVal,
          warmupTime: warmupTimeVal,
          gameDuration: gameDurationVal,
          scoring: {
            type: document.getElementById('gsm-type').value || 'simple',
            setsToWin: parseInt(document.getElementById('gsm-setsToWin').value) || 1,
            gamesPerSet: parseInt(document.getElementById('gsm-gamesPerSet').value) || 6,
            tiebreakEnabled: document.getElementById('gsm-tiebreakEnabled').value === 'true',
            tiebreakPoints: parseInt(document.getElementById('gsm-tiebreakPoints').value) || 7,
            tiebreakMargin: parseInt(document.getElementById('gsm-tiebreakMargin').value) || 2,
            superTiebreak: document.getElementById('gsm-superTiebreak').value === 'true',
            superTiebreakPoints: parseInt(document.getElementById('gsm-superTiebreakPoints').value) || 10,
            countingType: document.getElementById('gsm-countingType').value || 'numeric',
            advantageRule: document.getElementById('gsm-advantageRule').value === 'true',
            fixedSet: document.getElementById('gsm-fixedSet').value === 'true',
            fixedSetGames: parseInt(document.getElementById('gsm-fixedSetGames').value) || 6
          },
          organizerEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local',
          creatorEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local',
          creatorUid: window.AppStore.currentUser ? window.AppStore.currentUser.uid : '',
          coHosts: []
        };

        // Suíço
        if (formatValue === 'suico') {
          tourData.swissRounds = parseInt(document.getElementById('suico-rounds').value) || 5;
          tourData.drawFirstDate = document.getElementById('suico-first-draw-date').value || '';
          tourData.drawFirstTime = document.getElementById('suico-first-draw-time').value || '19:00';
          tourData.drawIntervalDays = parseInt(document.getElementById('suico-draw-interval').value) || 7;
          tourData.drawManual = document.getElementById('suico-manual-draw').checked;
        }

        // Liga (unificado — inclui antigo Ranking)
        if (formatValue === 'liga') {
          // Temporada
          var ligaSeasonSel = document.getElementById('liga-season-duration').value;
          if (ligaSeasonSel !== 'indefinida') {
            tourData.ligaSeasonMonths = ligaSeasonSel === 'custom'
              ? (parseInt(document.getElementById('liga-custom-months').value) || 6)
              : parseInt(ligaSeasonSel);
          }
          // Configurações
          tourData.ligaNewPlayerScore = document.getElementById('liga-new-player-score').value;
          tourData.ligaInactivity = document.getElementById('liga-inactivity').value;
          tourData.ligaInactivityX = parseInt(document.getElementById('liga-inactivity-x').value) || 3;
          tourData.ligaOpenEnrollment = document.getElementById('liga-open-enrollment').checked;
          // Agendamento
          tourData.drawFirstDate = document.getElementById('liga-first-draw-date').value || '';
          tourData.drawFirstTime = document.getElementById('liga-first-draw-time').value || '19:00';
          tourData.drawIntervalDays = parseInt(document.getElementById('liga-draw-interval').value) || 7;
          tourData.drawManual = document.getElementById('liga-manual-draw').checked;
          tourData.ligaRoundFormat = document.getElementById('liga-round-format').value || 'standard';
          // Limpeza de campos legados do formato Ranking (migrados para liga-*)
          tourData.rankingNewPlayerScore = null;
          tourData.rankingInactivity = null;
          tourData.rankingInactivityX = null;
          tourData.rankingSeasonMonths = null;
          tourData.rankingOpenEnrollment = null;
        }

        // Eliminatórias
        if (formatValue === 'elim_simples' || formatValue === 'elim_dupla' || formatValue === 'grupos_mata') {
          tourData.elimThirdPlace = true;
          tourData.elimRankingType = document.getElementById('elim-ranking-type').value;
        }

        // Fase de Grupos
        if (formatValue === 'grupos_mata') {
          tourData.gruposCount = parseInt(document.getElementById('grupos-count').value) || 4;
          tourData.gruposClassified = parseInt(document.getElementById('grupos-classified').value) || 2;
        }

        if (drawModeValue === 'rei_rainha') {
          tourData.monarchClassified = parseInt(document.getElementById('monarch-classified').value) || 1;
          tourData.monarchAdvanceToElim = true; // always advance to elimination
          tourData.drawMode = 'rei_rainha';
          // For Liga, set ligaRoundFormat instead of changing the format
          if (formatValue === 'liga') {
            tourData.ligaRoundFormat = 'rei_rainha';
          }
        } else {
          tourData.drawMode = 'sorteio';
        }

        // Tiebreakers (ordem configurada pelo organizador)
        const tbList = document.getElementById('tiebreaker-list');
        if (tbList) {
          tourData.tiebreakers = Array.from(tbList.querySelectorAll('li')).map(li => li.dataset.tb).filter(Boolean);
        }

        // Categorias (gênero + habilidade) — todos os formatos
        var catData = window._getTournamentCategories ? window._getTournamentCategories() : {};
        tourData.genderCategories = catData.genderCategories || [];
        tourData.skillCategories = catData.skillCategories || [];
        tourData.combinedCategories = catData.combinedCategories || [];

        if (editId) {
          const idx = window.AppStore.tournaments.findIndex(tour => tour.id.toString() === editId.toString());
          if (idx !== -1) {
            const t = window.AppStore.tournaments[idx];
            // Detect meaningful changes to notify participants
            var _changes = [];
            var _checkFields = {
              name: 'Nome', startDate: 'Data de início', endDate: 'Data de término',
              venue: 'Local', format: 'Formato', maxParticipants: 'Máx. participantes',
              enrollmentMode: 'Modo de inscrição', registrationLimit: 'Prazo de inscrição'
            };
            Object.keys(_checkFields).forEach(function(k) {
              if (tourData[k] !== undefined && String(tourData[k] || '') !== String(t[k] || '')) {
                _changes.push(_checkFields[k]);
              }
            });
            // Aplica cada campo explicitamente
            Object.keys(tourData).forEach(k => { t[k] = tourData[k]; });
            window.AppStore.logAction(editId, `Regras atualizadas: formato ${format}, lançamento por ${resultEntryVal}`);

            // Notify enrolled participants about changes
            if (_changes.length > 0 && window._notifyTournamentParticipants) {
              var changeMsg = 'O torneio "' + name + '" foi atualizado: ' + _changes.join(', ') + '.';
              window._notifyTournamentParticipants(t, {
                type: 'tournament_updated',
                message: changeMsg,
                level: 'important'
              }, t.organizerEmail);
            }
          }
          showNotification('Sucesso', 'Torneio atualizado!', 'success');
        } else {
          // Feature gate: limite de torneios no plano Free
          if (!window._canCreateTournament()) {
            window._showUpgradeModal('tournaments');
            return;
          }
          window.AppStore.addTournament(tourData);
          showNotification('Torneio Criado', `O torneio "${name}" foi salvo com sucesso.`, 'success');
        }

        // Persiste no localStorage
        window.AppStore.sync();

        // Auto-assign categories to uncategorized participants based on profile gender
        var _autoAssignTid = editId || (window.AppStore.tournaments.length > 0 ? window.AppStore.tournaments[window.AppStore.tournaments.length - 1].id : null);
        if (_autoAssignTid && window._autoAssignCategories) {
          var _autoCount = window._autoAssignCategories(_autoAssignTid);
          if (_autoCount > 0) {
            showNotification('Categorias Auto-atribuídas', _autoCount + ' participante' + (_autoCount > 1 ? 's foram atribuídos' : ' foi atribuído') + ' a categorias com base no perfil.', 'info');
          }
        }

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

// ── GSM Config Modal and Functions ──
window._openGSMConfig = function() {
  // Read current values from hidden fields
  var type = document.getElementById('gsm-type').value;
  var setsToWin = document.getElementById('gsm-setsToWin').value;
  var gamesPerSet = document.getElementById('gsm-gamesPerSet').value;
  var tbEnabled = document.getElementById('gsm-tiebreakEnabled').value === 'true';
  var tbPoints = document.getElementById('gsm-tiebreakPoints').value;
  var tbMargin = document.getElementById('gsm-tiebreakMargin').value;
  var stb = document.getElementById('gsm-superTiebreak').value === 'true';
  var stbPoints = document.getElementById('gsm-superTiebreakPoints').value;
  var counting = document.getElementById('gsm-countingType').value;
  var advantage = document.getElementById('gsm-advantageRule').value === 'true';
  var fixedSet = document.getElementById('gsm-fixedSet').value === 'true';
  var fixedSetGames = document.getElementById('gsm-fixedSetGames').value || '6';

  var existing = document.getElementById('gsm-config-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'gsm-config-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:100000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;';

  overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);width:94%;max-width:600px;border-radius:20px;border:1px solid rgba(168,85,247,0.25);box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;margin:auto 0;max-height:90vh;display:flex;flex-direction:column;">' +
    '<div style="background:linear-gradient(135deg,#6d28d9 0%,#a855f7 100%);padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
      '<div>' +
        '<h3 style="margin:0;color:#f5f3ff;font-size:1.1rem;font-weight:800;">🎾 Sistema de Pontuação</h3>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button type="button" onclick="document.getElementById(\'gsm-config-overlay\').remove();" class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#f5f3ff;border:1px solid rgba(255,255,255,0.25);">Cancelar</button>' +
        '<button type="button" onclick="window._gsmSaveConfig();" class="btn btn-sm" style="background:#fff;color:#6d28d9;font-weight:700;border:none;">Aplicar</button>' +
      '</div>' +
    '</div>' +
    '<div style="padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1.2rem;overflow-y:auto;overflow-x:hidden;flex:1;-webkit-overflow-scrolling:touch;">' +

      // Counting type — first, because it changes labels below
      '<div>' +
        '<label style="font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Contagem de pontos</label>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" onclick="window._gsmSetCounting(\'tennis\')" id="gsm-btn-tennis" class="btn btn-sm" style="flex:1;font-size:0.78rem;' + (counting === 'tennis' ? 'background:#a855f7;color:#fff;' : 'background:rgba(255,255,255,0.08);color:var(--text-main,#e2e8f0);') + '">Tênis (15, 30, 40)</button>' +
          '<button type="button" onclick="window._gsmSetCounting(\'numeric\')" id="gsm-btn-numeric" class="btn btn-sm" style="flex:1;font-size:0.78rem;' + (counting === 'numeric' ? 'background:#a855f7;color:#fff;' : 'background:rgba(255,255,255,0.08);color:var(--text-main,#e2e8f0);') + '">Numérico/Tempo</button>' +
        '</div>' +
      '</div>' +

      // Set Fixo toggle
      '<div id="gsm-fixed-set-section" style="display:' + (counting === 'tennis' ? 'block' : 'none') + ';background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:1rem;">' +
        '<div class="toggle-row" style="padding:4px 0;margin-bottom:6px;">' +
          '<div class="toggle-row-label">' +
            '<span style="font-size:0.85rem;font-weight:700;">⚡ Set Fixo</span>' +
            '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Disputa de N games fixos. Ganha quem vencer mais. Empate vai pro tie-break.</div>' +
          '</div>' +
          '<label class="toggle-switch toggle-sm"><input type="checkbox" id="gsm-cfg-fixedSet" ' + (fixedSet ? 'checked' : '') + ' onchange="window._gsmToggleFixedSet()"><span class="toggle-slider"></span></label>' +
        '</div>' +
        '<div id="gsm-fixed-set-details" style="display:' + (fixedSet ? 'flex' : 'none') + ';gap:12px;align-items:center;padding-left:8px;">' +
          '<div style="min-width:120px;">' +
            '<label style="font-size:0.72rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:3px;">Total de games</label>' +
            '<input type="number" id="gsm-cfg-fixedSetGames" class="form-control" min="2" max="20" value="' + fixedSetGames + '" style="font-size:0.85rem;width:80px;" oninput="window._gsmUpdateSummary()">' +
          '</div>' +
          '<div style="font-size:0.75rem;color:#f59e0b;line-height:1.4;flex:1;">' +
            'Ex: Set Fixo de 6 → resultados possíveis: 6-0, 5-1, 4-2. Se 3-3, tie-break.' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Sets/points config — always visible
      '<div id="gsm-sets-config" style="display:flex;flex-direction:column;gap:1rem;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.12);border-radius:12px;padding:1rem;">' +

        '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:120px;">' +
            '<label id="gsm-label-sets" style="font-size:0.75rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px;">' + (counting === 'numeric' ? 'Pontos para vencer' : 'Sets para vencer') + '</label>' +
            '<select id="gsm-cfg-setsToWin" class="form-control" style="font-size:0.85rem;" onchange="window._gsmUpdateSummary()">' +
              '<option value="1"' + (setsToWin==='1'?' selected':'') + '>1</option>' +
              '<option value="2"' + (setsToWin==='2'?' selected':'') + '>2</option>' +
              '<option value="3"' + (setsToWin==='3'?' selected':'') + '>3</option>' +
            '</select>' +
          '</div>' +
          '<div style="flex:1;min-width:120px;">' +
            '<label id="gsm-label-games" style="font-size:0.75rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px;">' + (counting === 'numeric' ? 'Tempos (minutos)' : 'Games por set') + '</label>' +
            '<input type="number" id="gsm-cfg-gamesPerSet" class="form-control" min="1" max="99" value="' + gamesPerSet + '" style="font-size:0.85rem;" oninput="window._gsmUpdateSummary()">' +
          '</div>' +
        '</div>' +

        // Advantage rule (only for tennis counting)
        '<div id="gsm-advantage-row" class="toggle-row" style="display:' + (counting === 'tennis' ? 'flex' : 'none') + ';padding:6px 0;">' +
          '<div class="toggle-row-label"><span style="font-size:0.82rem;">Regra de vantagem (Deuce/Advantage no 40-40)</span></div>' +
          '<label class="toggle-switch toggle-sm"><input type="checkbox" id="gsm-cfg-advantage" ' + (advantage ? 'checked' : '') + ' onchange="window._gsmUpdateSummary()"><span class="toggle-slider"></span></label>' +
        '</div>' +

        // Tiebreak
        '<div style="border-top:1px solid var(--border-color);padding-top:1rem;">' +
          '<div class="toggle-row" style="padding:6px 0;margin-bottom:8px;">' +
            '<div class="toggle-row-label"><span style="font-size:0.82rem;font-weight:600;">Tie-break quando empatar no set</span></div>' +
            '<label class="toggle-switch toggle-sm"><input type="checkbox" id="gsm-cfg-tiebreak" ' + (tbEnabled ? 'checked' : '') + ' onchange="window._gsmToggleTiebreak()"><span class="toggle-slider"></span></label>' +
          '</div>' +
          '<div id="gsm-tb-details" style="display:' + (tbEnabled ? 'flex' : 'none') + ';gap:12px;flex-wrap:wrap;padding-left:26px;">' +
            '<div style="min-width:100px;">' +
              '<label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:3px;">Pontos</label>' +
              '<input type="number" id="gsm-cfg-tbPoints" class="form-control" min="5" max="15" value="' + tbPoints + '" style="font-size:0.82rem;width:70px;" oninput="window._gsmUpdateSummary()">' +
            '</div>' +
            '<div style="min-width:100px;">' +
              '<label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:3px;">Diferença mín.</label>' +
              '<input type="number" id="gsm-cfg-tbMargin" class="form-control" min="1" max="5" value="' + tbMargin + '" style="font-size:0.82rem;width:70px;" oninput="window._gsmUpdateSummary()">' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Super tiebreak
        '<div id="gsm-super-tb-section" style="display:' + (parseInt(setsToWin) > 1 ? 'block' : 'none') + ';">' +
          '<div class="toggle-row" style="padding:6px 0;margin-bottom:8px;">' +
            '<div class="toggle-row-label"><span style="font-size:0.82rem;font-weight:600;">Super tie-break no set decisivo</span></div>' +
            '<label class="toggle-switch toggle-sm"><input type="checkbox" id="gsm-cfg-superTb" ' + (stb ? 'checked' : '') + ' onchange="window._gsmToggleSuperTb()"><span class="toggle-slider"></span></label>' +
          '</div>' +
          '<div id="gsm-stb-details" style="display:' + (stb ? 'flex' : 'none') + ';gap:12px;padding-left:26px;">' +
            '<div>' +
              '<label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:3px;">Pontos</label>' +
              '<input type="number" id="gsm-cfg-stbPoints" class="form-control" min="7" max="21" value="' + stbPoints + '" style="font-size:0.82rem;width:70px;" oninput="window._gsmUpdateSummary()">' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>' +

      // Summary box
      '<div id="gsm-summary-box" style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:10px;padding:12px 16px;">' +
        '<p style="margin:0;font-size:0.78rem;color:#c084fc;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Resumo</p>' +
        '<div id="gsm-summary-text" style="font-size:0.85rem;color:var(--text-main);line-height:1.5;"></div>' +
      '</div>' +

    '</div>' +

    /* buttons moved to sticky header */ '' +
  '</div>';

  document.body.appendChild(overlay);
  window._gsmUpdateSummary();
};

// Legacy: _gsmSetType always sets 'sets' now (simple/advanced toggle removed)
window._gsmSetType = function(type) {
  document.getElementById('gsm-type').value = 'sets';
  document.getElementById('gsm-sets-config').style.display = 'flex';
  window._gsmUpdateSummary();
};

window._gsmSetCounting = function(ct) {
  var unselBg = 'rgba(255,255,255,0.08)';
  var unselColor = 'var(--text-main, #e2e8f0)';
  document.getElementById('gsm-btn-numeric').style.background = ct === 'numeric' ? '#a855f7' : unselBg;
  document.getElementById('gsm-btn-numeric').style.color = ct === 'numeric' ? '#fff' : unselColor;
  document.getElementById('gsm-btn-tennis').style.background = ct === 'tennis' ? '#a855f7' : unselBg;
  document.getElementById('gsm-btn-tennis').style.color = ct === 'tennis' ? '#fff' : unselColor;
  var advRow = document.getElementById('gsm-advantage-row');
  if (advRow) advRow.style.display = ct === 'tennis' ? 'flex' : 'none';
  // Update labels based on counting type
  var labelSets = document.getElementById('gsm-label-sets');
  var labelGames = document.getElementById('gsm-label-games');
  if (labelSets) labelSets.textContent = ct === 'numeric' ? 'Pontos para vencer' : 'Sets para vencer';
  if (labelGames) labelGames.textContent = ct === 'numeric' ? 'Tempos (minutos)' : 'Games por set';
  // Hide/show tiebreak and super-tiebreak for numeric mode
  var tbSection = document.getElementById('gsm-cfg-tiebreak');
  if (tbSection) tbSection.closest('div[style*="border-top"]').style.display = ct === 'tennis' ? 'block' : 'none';
  var stbSection = document.getElementById('gsm-super-tb-section');
  if (stbSection) stbSection.style.display = ct === 'tennis' && parseInt(document.getElementById('gsm-cfg-setsToWin').value) > 1 ? 'block' : 'none';
  // Hide fixed set for numeric mode
  var fsSection = document.getElementById('gsm-fixed-set-section');
  if (fsSection) fsSection.style.display = ct === 'tennis' ? 'block' : 'none';
  // Uncheck fixed set when switching to numeric
  if (ct === 'numeric') {
    var fsEl = document.getElementById('gsm-cfg-fixedSet');
    if (fsEl && fsEl.checked) { fsEl.checked = false; window._gsmToggleFixedSet(); }
  }
  document.getElementById('gsm-countingType').value = ct;
  // Always type=sets since we removed simple/advanced toggle
  document.getElementById('gsm-type').value = 'sets';
  window._gsmUpdateSummary();
};

window._gsmToggleFixedSet = function() {
  var checked = document.getElementById('gsm-cfg-fixedSet').checked;
  document.getElementById('gsm-fixed-set-details').style.display = checked ? 'flex' : 'none';
  // When fixed set is ON, force setsToWin=1, hide sets config, enable tiebreak auto
  var setsConfig = document.getElementById('gsm-sets-config');
  if (setsConfig) setsConfig.style.display = checked ? 'none' : 'flex';
  if (checked) {
    var setsEl = document.getElementById('gsm-cfg-setsToWin');
    if (setsEl) setsEl.value = '1';
    // Auto-enable tiebreak for fixed set (needed for ties)
    var tbEl = document.getElementById('gsm-cfg-tiebreak');
    if (tbEl) { tbEl.checked = true; window._gsmToggleTiebreak(); }
  }
  window._gsmUpdateSummary();
};

window._gsmToggleTiebreak = function() {
  var checked = document.getElementById('gsm-cfg-tiebreak').checked;
  document.getElementById('gsm-tb-details').style.display = checked ? 'flex' : 'none';
  window._gsmUpdateSummary();
};

window._gsmToggleSuperTb = function() {
  var checked = document.getElementById('gsm-cfg-superTb').checked;
  document.getElementById('gsm-stb-details').style.display = checked ? 'flex' : 'none';
  window._gsmUpdateSummary();
};

window._gsmUpdateSummary = function() {
  var type = document.getElementById('gsm-type').value;
  var el = document.getElementById('gsm-summary-text');
  if (!el) return;

  if (type === 'simple') {
    el.innerHTML = '<strong>Placar simples</strong> — cada partida decidida por placar direto (gols, pontos, etc.)';
    return;
  }

  var sets = parseInt(document.getElementById('gsm-cfg-setsToWin').value) || 1;
  var games = parseInt(document.getElementById('gsm-cfg-gamesPerSet').value) || 6;
  var tbOn = document.getElementById('gsm-cfg-tiebreak').checked;
  var tbPts = parseInt(document.getElementById('gsm-cfg-tbPoints').value) || 7;
  var tbMargin = parseInt(document.getElementById('gsm-cfg-tbMargin').value) || 2;
  var stbOn = document.getElementById('gsm-cfg-superTb') ? document.getElementById('gsm-cfg-superTb').checked : false;
  var stbPts = parseInt(document.getElementById('gsm-cfg-stbPoints').value) || 10;
  var counting = document.getElementById('gsm-countingType').value;
  var advOn = document.getElementById('gsm-cfg-advantage') ? document.getElementById('gsm-cfg-advantage').checked : false;

  // Show/hide super tiebreak section based on sets
  var stbSection = document.getElementById('gsm-super-tb-section');
  if (stbSection) stbSection.style.display = sets > 1 ? 'block' : 'none';

  // Check for fixed set mode
  var fsOn = document.getElementById('gsm-cfg-fixedSet') ? document.getElementById('gsm-cfg-fixedSet').checked : false;
  var fsGames = parseInt(document.getElementById('gsm-cfg-fixedSetGames') ? document.getElementById('gsm-cfg-fixedSetGames').value : 0) || 6;

  var lines = [];
  if (fsOn && counting === 'tennis') {
    var half = Math.floor(fsGames / 2);
    var isEven = fsGames % 2 === 0;
    lines.push('<strong>⚡ Set Fixo de ' + fsGames + ' games</strong>');
    lines.push('Disputa de ' + fsGames + ' games fixos. Ganha quem vencer mais.');
    if (isEven) {
      lines.push('Empate ' + half + '-' + half + ': tie-break de ' + tbPts + ' pontos (diferença mín. ' + tbMargin + ').');
    }
    lines.push('Resultados possíveis: ' + fsGames + '-0, ' + (fsGames - 1) + '-1, ' + (fsGames - 2) + '-2' + (isEven ? ', ..., ' + half + '-' + half + ' (TB)' : '') + '.');
  } else if (counting === 'numeric') {
    lines.push('<strong>' + sets + ' pontos</strong> para vencer');
    lines.push(games + ' tempos de ' + games + ' minutos (contagem numérica)');
  } else {
    lines.push('<strong>' + sets + ' set' + (sets > 1 ? 's' : '') + '</strong> de ' + games + ' games');
    lines.push('Contagem: 15-30-40' + (advOn ? ' + vantagem' : ''));
    if (tbOn) {
      var _tbDraw = tbPts - tbMargin;
      lines.push('Tie-break de ' + tbPts + ' pontos (' + _tbDraw + ' a ' + _tbDraw + ', prorroga até o vencedor ter ' + tbMargin + ' pontos de vantagem).');
    }
    if (stbOn && sets > 1) {
      var _stbDraw = stbPts - 2;
      lines.push('Super tie-break de ' + stbPts + ' pontos (' + _stbDraw + ' a ' + _stbDraw + ', prorroga até o vencedor ter 2 pontos de vantagem).');
    }
  }

  // Show/hide super tiebreak section based on sets and counting type
  var stbSection = document.getElementById('gsm-super-tb-section');
  if (stbSection) stbSection.style.display = counting === 'tennis' && sets > 1 && !fsOn ? 'block' : 'none';

  // Show/hide fixed set section
  var fsSection = document.getElementById('gsm-fixed-set-section');
  if (fsSection) fsSection.style.display = counting === 'tennis' ? 'block' : 'none';

  // Hide sets config when fixed set is on
  var setsConfig = document.getElementById('gsm-sets-config');
  if (setsConfig) setsConfig.style.display = fsOn ? 'none' : 'flex';

  el.innerHTML = lines.join('<br>');
};

window._gsmSaveConfig = function() {
  // Always save as type 'sets' (simple/advanced toggle removed)
  document.getElementById('gsm-type').value = 'sets';

  {
    var sets = document.getElementById('gsm-cfg-setsToWin').value;
    var games = document.getElementById('gsm-cfg-gamesPerSet').value;
    var tbOn = document.getElementById('gsm-cfg-tiebreak').checked;
    var tbPts = document.getElementById('gsm-cfg-tbPoints').value;
    var tbMargin = document.getElementById('gsm-cfg-tbMargin').value;
    var stbOn = document.getElementById('gsm-cfg-superTb') ? document.getElementById('gsm-cfg-superTb').checked : false;
    var stbPts = document.getElementById('gsm-cfg-stbPoints') ? document.getElementById('gsm-cfg-stbPoints').value : '10';
    var counting = document.getElementById('gsm-countingType').value;
    var advantage = document.getElementById('gsm-cfg-advantage') ? document.getElementById('gsm-cfg-advantage').checked : false;

    document.getElementById('gsm-setsToWin').value = sets;
    document.getElementById('gsm-gamesPerSet').value = games;
    document.getElementById('gsm-tiebreakEnabled').value = tbOn ? 'true' : 'false';
    document.getElementById('gsm-tiebreakPoints').value = tbPts;
    document.getElementById('gsm-tiebreakMargin').value = tbMargin;
    document.getElementById('gsm-superTiebreak').value = stbOn ? 'true' : 'false';
    document.getElementById('gsm-superTiebreakPoints').value = stbPts;
    document.getElementById('gsm-countingType').value = counting;
    document.getElementById('gsm-advantageRule').value = advantage ? 'true' : 'false';

    var fixedSetOn = document.getElementById('gsm-cfg-fixedSet') ? document.getElementById('gsm-cfg-fixedSet').checked : false;
    var fixedSetGamesVal = document.getElementById('gsm-cfg-fixedSetGames') ? document.getElementById('gsm-cfg-fixedSetGames').value : '6';
    document.getElementById('gsm-fixedSet').value = fixedSetOn ? 'true' : 'false';
    document.getElementById('gsm-fixedSetGames').value = fixedSetGamesVal;
    // When fixed set is on, force setsToWin=1 and auto-set gamesPerSet to match
    if (fixedSetOn) {
      document.getElementById('gsm-setsToWin').value = '1';
      document.getElementById('gsm-gamesPerSet').value = fixedSetGamesVal;
    }
  }

  // Update detailed summary in main form
  if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();

  // Save to user preferences for this sport
  var sportEl = document.getElementById('select-sport');
  if (sportEl && window.AppStore && window.AppStore.currentUser) {
    var sport = sportEl.options[sportEl.selectedIndex] ? sportEl.options[sportEl.selectedIndex].text.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
    try {
      var prefs = JSON.parse(localStorage.getItem('scoreplace_gsm_prefs') || '{}');
      prefs[sport] = {
        type: document.getElementById('gsm-type') ? document.getElementById('gsm-type').value : 'sets',
        setsToWin: document.getElementById('gsm-setsToWin').value,
        gamesPerSet: document.getElementById('gsm-gamesPerSet').value,
        tiebreakEnabled: document.getElementById('gsm-tiebreakEnabled').value,
        tiebreakPoints: document.getElementById('gsm-tiebreakPoints').value,
        tiebreakMargin: document.getElementById('gsm-tiebreakMargin').value,
        superTiebreak: document.getElementById('gsm-superTiebreak').value,
        superTiebreakPoints: document.getElementById('gsm-superTiebreakPoints').value,
        countingType: document.getElementById('gsm-countingType').value,
        advantageRule: document.getElementById('gsm-advantageRule').value,
        fixedSet: document.getElementById('gsm-fixedSet').value,
        fixedSetGames: document.getElementById('gsm-fixedSetGames').value
      };
      localStorage.setItem('scoreplace_gsm_prefs', JSON.stringify(prefs));
    } catch(e) {}
  }

  // Close overlay
  var ov = document.getElementById('gsm-config-overlay');
  if (ov) ov.remove();
  if (typeof showNotification !== 'undefined') {
    showNotification('Pontuação Configurada', 'Sistema de pontuação atualizado.', 'success');
  }
};

// Update GSM summary from hidden fields (no overlay needed)
window._updateGSMSummaryFromHidden = function() {
  var summaryEl = document.getElementById('gsm-summary');
  if (!summaryEl) return;
  var s = parseInt(document.getElementById('gsm-setsToWin').value) || 1;
  var g = parseInt(document.getElementById('gsm-gamesPerSet').value) || 6;
  var tbOn = document.getElementById('gsm-tiebreakEnabled').value === 'true';
  var tbPts = document.getElementById('gsm-tiebreakPoints').value || '7';
  var stbOn = document.getElementById('gsm-superTiebreak').value === 'true';
  var stbPts = document.getElementById('gsm-superTiebreakPoints').value || '10';
  var counting = document.getElementById('gsm-countingType').value;
  var advOn = document.getElementById('gsm-advantageRule').value === 'true';
  var tbMargin = parseInt(document.getElementById('gsm-tiebreakMargin').value) || 2;

  var fsOn = document.getElementById('gsm-fixedSet').value === 'true';
  var fsGames = parseInt(document.getElementById('gsm-fixedSetGames').value) || 6;

  var lines = [];
  if (fsOn && counting !== 'numeric') {
    var half = Math.floor(fsGames / 2);
    var isEven = fsGames % 2 === 0;
    lines.push('<strong>⚡ Set Fixo de ' + fsGames + ' games</strong>');
    lines.push('Ganha quem vencer mais.' + (isEven ? ' Empate ' + half + '-' + half + ': tie-break.' : ''));
  } else if (counting === 'numeric') {
    lines.push('<strong>' + s + ' pontos</strong> para vencer');
    lines.push(g + ' tempos de ' + g + ' minutos (contagem numérica)');
  } else {
    lines.push('<strong>' + s + ' set' + (s > 1 ? 's' : '') + '</strong> de ' + g + ' games');
    lines.push('Contagem: 15-30-40' + (advOn ? ' + vantagem' : ''));
    if (tbOn) {
      var tbDraw = parseInt(tbPts) - tbMargin;
      lines.push('Tie-break de ' + tbPts + ' pontos (' + tbDraw + ' a ' + tbDraw + '), prorroga até o vencedor ter ' + tbMargin + ' pontos de vantagem.');
    }
    if (stbOn && s > 1) {
      var _stbDraw = parseInt(stbPts) - 2;
      lines.push('Super tie-break de ' + stbPts + ' pontos (' + _stbDraw + ' a ' + _stbDraw + ', prorroga até o vencedor ter 2 pontos de vantagem).');
    }
  }
  summaryEl.innerHTML = lines.join('<br>');
};

// Auto-apply sport defaults when sport changes
window._onSportChange = window._onSportChange || function() {};
var _origOnSportChange = window._onSportChange;
window._onSportChange = function() {
  if (typeof _origOnSportChange === 'function') _origOnSportChange();
  var sportEl = document.getElementById('select-sport');
  if (!sportEl) return;
  var sport = sportEl.options[sportEl.selectedIndex] ? sportEl.options[sportEl.selectedIndex].text.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';

  // Check user preferences first, then sport defaults
  var config = null;
  try {
    var prefs = JSON.parse(localStorage.getItem('scoreplace_gsm_prefs') || '{}');
    if (prefs[sport]) config = prefs[sport];
  } catch(e) {}

  if (!config) {
    config = window._sportScoringDefaults[sport] || window._sportScoringDefaults['_default'];
  }

  // Apply to hidden fields (always use strings for .value)
  document.getElementById('gsm-type').value = config.type || 'simple';
  document.getElementById('gsm-setsToWin').value = String(config.setsToWin || 1);
  document.getElementById('gsm-gamesPerSet').value = String(config.gamesPerSet || 6);
  document.getElementById('gsm-tiebreakEnabled').value = config.tiebreakEnabled ? 'true' : 'false';
  document.getElementById('gsm-tiebreakPoints').value = String(config.tiebreakPoints || 7);
  document.getElementById('gsm-tiebreakMargin').value = String(config.tiebreakMargin || 2);
  document.getElementById('gsm-superTiebreak').value = config.superTiebreak ? 'true' : 'false';
  document.getElementById('gsm-superTiebreakPoints').value = String(config.superTiebreakPoints || 10);
  document.getElementById('gsm-countingType').value = config.countingType || 'numeric';
  document.getElementById('gsm-advantageRule').value = config.advantageRule ? 'true' : 'false';

  // Update detailed summary
  if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
};

// ─── Pre-fill form from a saved template ──────────────────────────────────
window._prefillFromTemplate = function(tpl) {
  if (!tpl) return;

  // Sport
  var sportSel = document.getElementById('select-sport');
  if (sportSel && tpl.sport) {
    var opt = Array.from(sportSel.options).find(function(o) { return o.value === tpl.sport || o.text === tpl.sport; });
    if (opt) sportSel.value = opt.value;
    if (typeof window._onSportChange === 'function') window._onSportChange();
  }

  // Format — click the matching format button
  if (tpl.format) {
    var fmtBtns = document.querySelectorAll('.formato-btn');
    fmtBtns.forEach(function(btn) {
      if (btn.getAttribute('data-format') === tpl.format) btn.click();
    });
  }

  // Enrollment mode
  var enrollSel = document.getElementById('select-inscricao');
  if (enrollSel && tpl.enrollmentMode) {
    enrollSel.value = tpl.enrollmentMode;
    var _tplEmBtn = document.querySelector('#enroll-mode-buttons .enroll-mode-btn[data-value="' + tpl.enrollmentMode + '"]');
    if (_tplEmBtn) window._selectEnrollMode(_tplEmBtn);
  }

  // Max participants
  var maxP = document.getElementById('tourn-max-participants');
  if (maxP && tpl.maxParticipants) maxP.value = tpl.maxParticipants;

  // Courts
  var courts = document.getElementById('tourn-court-count');
  if (courts && tpl.courtCount) courts.value = tpl.courtCount;

  // Game duration
  var dur = document.getElementById('tourn-game-duration');
  if (dur && tpl.gameDuration) dur.value = tpl.gameDuration;

  // Team size
  var ts = document.getElementById('tourn-team-size');
  if (ts && tpl.teamSize && tpl.teamSize > 1) ts.value = tpl.teamSize;

  // Venue
  var venueInput = document.getElementById('tourn-venue');
  if (venueInput && tpl.venue) venueInput.value = tpl.venue;

  // Scoring (GSM)
  if (tpl.scoring && tpl.scoring.type === 'gsm' && typeof window._gsmApplyConfig === 'function') {
    window._gsmApplyConfig(tpl.scoring);
  }

  // Categories (store in hidden data for save function to pick up)
  if (tpl.genderCategories && tpl.genderCategories.length > 0) {
    window._templateCategories = {
      gender: tpl.genderCategories,
      skill: tpl.skillCategories || [],
      combined: tpl.combinedCategories || []
    };
  }
};
