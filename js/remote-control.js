// ─────────────────────────────────────────────────────────────────────────────
// scoreplace.app — Apple Watch / Shortcuts Remote Control (v0.15.39)
//
// Goal: let the organizer tap a button on an Apple Watch (via Apple Shortcuts)
// to increment/finalize a match score without touching the phone. This file is
// purely client-side: it creates a short-lived session doc in Firestore that
// authorizes the HTTP endpoint deployed as the `remoteScore` Cloud Function.
//
// Security model:
//   • Only the logged-in owner can create a session (Firestore rule checks
//     request.auth.uid == request.resource.data.uid AND the email stored in
//     the session matches the caller's email).
//   • The token is a 48-hex-char random string AND the Firestore doc ID — so
//     guessing the document name is equivalent to forging a credential. The
//     rule blocks listing, so nobody can enumerate live sessions.
//   • The Cloud Function re-validates the token's stored email against the
//     tournament's adminEmails[] before writing. Losing the phone = revoke
//     via _endRemoteControlSession() (deletes the doc).
//   • Expiry: 24h from creation. After that the function rejects with 401.
//
// LocalStorage persists the token client-side so the organizer doesn't have to
// regenerate the Shortcut config every page load.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  var LS_KEY = 'scoreplace_remote_session';
  var FN_ENDPOINT = 'https://us-central1-scoreplace-app.cloudfunctions.net/remoteScore';

  function _safeHtml(s) {
    return window._safeHtml ? window._safeHtml(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _genToken() {
    // 48 hex chars = 192 bits of entropy — overkill for a 24h session but cheap.
    var arr = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  function _loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // Expired? Drop it so we don't confuse the UI.
      if (obj && obj.expiresAt && new Date(obj.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem(LS_KEY);
        return null;
      }
      return obj;
    } catch (e) { return null; }
  }

  function _saveLocal(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function _clearLocal() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  // ── Create a fresh session. Polymorphic: pass `{tournamentId}` for a
  // tournament session or `{casualMatchId}` for a casual match session.
  // The Firestore rule enforces the uid/email binding; the Cloud Function
  // then re-validates the caller's authorization (tournament admin or
  // casual match creator) on each remoteScore call.
  async function createSession(target) {
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) throw new Error('Faça login primeiro');
    if (!target || (!target.tournamentId && !target.casualMatchId)) {
      throw new Error('Alvo inválido (tournamentId ou casualMatchId obrigatório)');
    }
    var token = _genToken();
    var now = new Date();
    var expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    var payload = {
      token: token,
      uid: cu.uid,
      email: (cu.email || '').toLowerCase(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt
    };
    if (target.tournamentId) {
      payload.tournamentId = String(target.tournamentId);
      payload.currentMatchId = null;
    } else {
      payload.casualMatchId = String(target.casualMatchId);
      // Casual sessions are always bound to one match — no pick step needed.
    }
    await firebase.firestore().collection('remoteSessions').doc(token).set(payload);
    var local = {
      token: token,
      tournamentId: payload.tournamentId || null,
      casualMatchId: payload.casualMatchId || null,
      expiresAt: expiresAt
    };
    _saveLocal(local);
    return local;
  }

  // ── Update which match the watch buttons will target. Written directly from
  // the client because rules restrict updates to the session owner.
  async function setActiveMatch(matchId) {
    var local = _loadLocal();
    if (!local) throw new Error('Nenhuma sessão ativa');
    await firebase.firestore().collection('remoteSessions').doc(local.token).update({
      currentMatchId: String(matchId || ''),
      updatedAt: new Date().toISOString()
    });
    local.currentMatchId = String(matchId || '');
    _saveLocal(local);
    return local;
  }

  async function endSession() {
    var local = _loadLocal();
    if (!local) return;
    try {
      await firebase.firestore().collection('remoteSessions').doc(local.token).delete();
    } catch (e) { /* best effort — token expires on its own anyway */ }
    _clearLocal();
  }

  function _fmtExpires(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    var now = Date.now();
    var ms = d.getTime() - now;
    if (ms < 0) return 'expirado';
    var hrs = Math.floor(ms / 3600000);
    var mins = Math.floor((ms % 3600000) / 60000);
    if (hrs >= 1) return hrs + 'h ' + mins + 'min';
    return mins + ' minutos';
  }

  // ── Modal: generate/view session + show Shortcut setup instructions.
  window._openRemoteControl = async function(tId) {
    var t = window.AppStore && window.AppStore.tournaments.find(function(x){ return String(x.id) === String(tId); });
    if (!t) { if (window.showNotification) window.showNotification('Torneio não encontrado', '', 'error'); return; }
    // Admin gate — server-side rule also enforces, but we fail fast with a UX msg.
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.email) { if (window.showNotification) window.showNotification('Faça login primeiro', '', 'error'); return; }
    var isAdmin = Array.isArray(t.adminEmails) && t.adminEmails.indexOf(String(cu.email).toLowerCase()) !== -1;
    if (!isAdmin) { if (window.showNotification) window.showNotification('Somente organizadores podem usar o controle remoto', '', 'error'); return; }

    var local = _loadLocal();
    // Session exists but is for a DIFFERENT target → offer to switch. We treat
    // tournament sessions and casual sessions as separate namespaces; any
    // mismatch (different tournamentId, or a casual session while opening a
    // tournament) prompts the user to trade up.
    if (local && String(local.tournamentId || '') !== String(tId)) {
      if (!confirm('Já existe uma sessão ativa para outro alvo. Encerrar e criar nova?')) return;
      await endSession();
      local = null;
    }

    _renderModal({ kind: 'tournament', target: t }, local);
  };

  // ── Casual match variant. Bound to a specific casualMatches/{docId} doc —
  // there's no "pick match" step because a casual session IS the match.
  // Caller passes the casual doc ID and an optional display title.
  window._openRemoteControlCasual = async function(casualDocId, opts) {
    opts = opts || {};
    var cu = window.AppStore && window.AppStore.currentUser;
    if (!cu || !cu.uid) { if (window.showNotification) window.showNotification('Faça login primeiro', '', 'error'); return; }
    if (!casualDocId) { if (window.showNotification) window.showNotification('Partida casual inválida', '', 'error'); return; }

    var local = _loadLocal();
    if (local && String(local.casualMatchId || '') !== String(casualDocId)) {
      if (!confirm('Já existe uma sessão ativa para outro alvo. Encerrar e criar nova?')) return;
      await endSession();
      local = null;
    }

    _renderModal({ kind: 'casual', target: { id: casualDocId, name: opts.title || 'Partida Casual' } }, local);
  };

  // ctx: { kind: 'tournament' | 'casual', target: tournamentObject | { id, name } }
  function _renderModal(ctx, local) {
    // Tear down any existing modal first.
    var existing = document.getElementById('modal-remote-control');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'modal-remote-control';
    // z-index 100010 must stay ABOVE the casual live-scoring-overlay (100002);
    // otherwise the modal opens invisibly underneath the score screen and
    // the button appears dead. Any generic app modal is ≤ 10000, so this is
    // safe for normal stacking too.
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100010;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    // Stash the current context so button handlers can re-render without
    // requiring every global function to take ctx as a param.
    window._remoteControlCurrentCtx = ctx;

    var body = local ? _renderActiveBody(ctx, local) : _renderEmptyBody(ctx);

    overlay.innerHTML =
      '<div style="background:var(--bg-card);border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border-color);">' +
        '<div style="padding:18px 20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:1.3rem;">⌚</span>' +
          '<h3 style="margin:0;flex:1;font-size:1.15rem;color:var(--text-bright);">Controle pelo Apple Watch</h3>' +
          '<button onclick="document.getElementById(\'modal-remote-control\').remove()" style="background:transparent;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;line-height:1;">×</button>' +
        '</div>' +
        '<div style="padding:18px 20px;">' + body + '</div>' +
      '</div>';

    document.body.appendChild(overlay);
  }

  function _renderEmptyBody(ctx) {
    var isCasual = ctx.kind === 'casual';
    var subject = isCasual ? 'esta partida casual' : 'este torneio';
    var scorer = isCasual
      ? 'marca pontos no placar ao vivo — incluindo sets, deuce e tiebreak, pelo próprio motor de pontuação do app'
      : 'marca ponto, desfaz ou finaliza a partida ativa';
    return '' +
      '<p style="margin:0 0 14px 0;color:var(--text-muted);font-size:0.9rem;line-height:1.5;">' +
        'Gere um <b>código de controle remoto</b> para ' + subject + '. Com ele você ' +
        'configura um Atalho no iPhone que toca no Apple Watch — um toque ' + scorer + ', sem sacar o celular.' +
      '</p>' +
      '<div style="background:var(--bg-darker);border-radius:10px;padding:12px;margin-bottom:14px;font-size:0.82rem;color:var(--text-muted);line-height:1.5;">' +
        '<b style="color:var(--text-bright);">Validade:</b> 24 horas (renovável a qualquer momento).<br>' +
        '<b style="color:var(--text-bright);">Segurança:</b> o código é pessoal; não compartilhe. Você pode encerrar a sessão a qualquer momento.' +
        (isCasual ? '<br><b style="color:var(--text-bright);">Importante:</b> mantenha a tela de placar ao vivo aberta no celular enquanto usa o Watch — é o celular que aplica as pontuações.' : '') +
      '</div>' +
      '<button class="btn btn-primary" onclick="window._remoteControlGenerate()" style="width:100%;padding:12px;font-weight:700;">🔑 Gerar código de controle</button>';
  }

  function _renderActiveBody(ctx, local) {
    var isCasual = ctx.kind === 'casual';
    var t = ctx.target;

    // Tournament-only: match picker. Casual sessions are bound to one match
    // (the casual doc itself) so we skip the dropdown entirely.
    var matchPickerHtml = '';
    if (!isCasual) {
      var currentMatchId = local.currentMatchId || '';
      var activeMatchHtml = '<em style="color:var(--text-muted);">nenhuma partida ativa — escolha abaixo</em>';
      if (currentMatchId) {
        var m = _findMatchInTournament(t, currentMatchId);
        if (m) activeMatchHtml = _safeHtml((m.p1 || '?') + ' × ' + (m.p2 || '?'));
      }
      var matchOpts = _buildMatchOptions(t, currentMatchId);
      matchPickerHtml =
        '<div style="margin-bottom:14px;">' +
          '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Partida controlada pelo watch</label>' +
          '<div style="padding:10px;background:var(--bg-darker);border-radius:8px;margin-bottom:8px;font-size:0.88rem;color:var(--text-bright);">' + activeMatchHtml + '</div>' +
          '<select id="remote-active-match" onchange="window._remoteControlSetActive(this.value)" style="width:100%;padding:10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-size:0.9rem;">' +
            '<option value="">— selecione uma partida —</option>' +
            matchOpts +
          '</select>' +
        '</div>';
    }

    var casualBanner = '';
    if (isCasual) {
      casualBanner =
        '<div style="margin-bottom:14px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:10px;padding:10px 12px;font-size:0.82rem;color:var(--text-bright);line-height:1.5;">' +
          '⚠️ <b>Mantenha o placar ao vivo aberto no celular</b> enquanto usa o Watch. O celular é quem aplica os pontos no motor de pontuação (sets, deuce, tiebreak). Sem o placar aberto, os comandos ficam enfileirados e aplicam quando você reabrir.' +
        '</div>';
    }

    return '' +
      // Active session card
      '<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:14px;color:#fff;margin-bottom:14px;">' +
        '<div style="font-size:0.75rem;opacity:0.9;margin-bottom:4px;">SESSÃO ATIVA — ' + (isCasual ? 'PARTIDA CASUAL' : 'TORNEIO') + '</div>' +
        '<div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;">' + _safeHtml(t.name || '') + '</div>' +
        '<div style="font-size:0.78rem;opacity:0.85;">Expira em ' + _fmtExpires(local.expiresAt) + '</div>' +
      '</div>' +

      casualBanner +
      matchPickerHtml +

      // Token + endpoint (copyable)
      '<div style="margin-bottom:14px;">' +
        '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Código (token)</label>' +
        '<div style="display:flex;gap:6px;">' +
          '<input type="text" readonly value="' + _safeHtml(local.token) + '" id="remote-token-input" onclick="this.select()" style="flex:1;min-width:0;padding:10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-family:monospace;font-size:0.72rem;">' +
          '<button onclick="window._remoteControlCopyToken()" class="btn btn-secondary btn-sm" style="flex-shrink:0;">📋</button>' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:14px;">' +
        '<label style="display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Endpoint (URL)</label>' +
        '<div style="display:flex;gap:6px;">' +
          '<input type="text" readonly value="' + FN_ENDPOINT + '" id="remote-endpoint-input" onclick="this.select()" style="flex:1;min-width:0;padding:10px;border-radius:8px;background:var(--bg-darker);border:1px solid var(--border-color);color:var(--text-bright);font-family:monospace;font-size:0.72rem;">' +
          '<button onclick="window._remoteControlCopyEndpoint()" class="btn btn-secondary btn-sm" style="flex-shrink:0;">📋</button>' +
        '</div>' +
      '</div>' +

      // QR code for quick-read on iPhone when setting up the Shortcut
      '<details style="margin-bottom:14px;background:var(--bg-darker);border-radius:10px;padding:10px 12px;">' +
        '<summary style="cursor:pointer;font-weight:600;color:var(--text-bright);font-size:0.88rem;">📲 QR code do token (abrir no iPhone)</summary>' +
        '<div style="margin-top:10px;text-align:center;">' +
          '<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(local.token) + '" alt="QR code do token" style="background:#fff;padding:8px;border-radius:8px;">' +
          '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">Aponte a câmera do iPhone para copiar o token.</div>' +
        '</div>' +
      '</details>' +

      // Setup instructions
      '<details style="margin-bottom:14px;background:var(--bg-darker);border-radius:10px;padding:10px 12px;">' +
        '<summary style="cursor:pointer;font-weight:600;color:var(--text-bright);font-size:0.88rem;">📖 Como configurar o Atalho (Apple Shortcut)</summary>' +
        _buildShortcutInstructions(local.token, isCasual) +
      '</details>' +

      // Actions
      '<div style="display:flex;gap:8px;">' +
        '<button class="btn btn-danger" onclick="window._remoteControlEnd()" style="flex:1;">🛑 Encerrar sessão</button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'modal-remote-control\').remove()" style="flex:1;">Fechar</button>' +
      '</div>';
  }

  function _buildShortcutInstructions(token, isCasual) {
    // Curl-equivalent body for copy-paste into the Shortcut "Dictionary" step.
    var bodyExample = '{"token":"' + token + '","action":"' + (isCasual ? 'point_team1' : 'inc_p1') + '"}';
    var actionsList = isCasual ? (
        '<li><code>point_team1</code> — marca +1 ponto para o time 1 (esquerda). Motor do app cuida de deuce, tiebreak, fim de set, fim de partida.</li>' +
        '<li><code>point_team2</code> — marca +1 ponto para o time 2 (direita)</li>' +
        '<li><code>finish</code> — encerra a partida imediatamente (útil se precisar abortar)</li>' +
        '<li><code>status</code> — só consulta o placar atual (não modifica)</li>'
      ) : (
        '<li><code>inc_p1</code> — +1 ponto para o jogador 1 (esquerda)</li>' +
        '<li><code>inc_p2</code> — +1 ponto para o jogador 2 (direita)</li>' +
        '<li><code>dec_p1</code> / <code>dec_p2</code> — desfazer (−1 ponto)</li>' +
        '<li><code>set_score</code> — definir placar exato (envie <code>p1</code> e <code>p2</code> no JSON)</li>' +
        '<li><code>finalize</code> — confirmar vencedor com base no placar atual</li>' +
        '<li><code>status</code> — só consultar o placar atual (não modifica)</li>'
      );
    return '' +
      '<div style="margin-top:10px;font-size:0.85rem;color:var(--text-bright);line-height:1.6;">' +
        '<p style="margin:0 0 8px 0;">No <b>iPhone</b>, abra o app <b>Atalhos</b> e crie um novo atalho:</p>' +
        '<ol style="margin:0 0 10px 18px;padding:0;">' +
          '<li>Adicionar ação → <b>Obter conteúdo do URL</b> (Get Contents of URL).</li>' +
          '<li>URL: <code style="font-size:0.78rem;">' + FN_ENDPOINT + '</code></li>' +
          '<li>Método: <b>POST</b>.</li>' +
          '<li>Cabeçalho: <code style="font-size:0.78rem;">Content-Type: application/json</code></li>' +
          '<li>Corpo da solicitação: <b>JSON</b> com:<br>' +
            '<code style="display:block;margin-top:4px;padding:8px;background:var(--bg-card);border-radius:6px;font-size:0.72rem;word-break:break-all;">' + _safeHtml(bodyExample) + '</code>' +
          '</li>' +
          '<li>Troque a <code>action</code> pela desejada (lista abaixo) e crie um atalho por ação.</li>' +
          '<li>No iPhone: Ajustes → Atalhos → ative <b>Permitir Scripts Não Confiáveis</b> se necessário.</li>' +
          '<li>Adicione cada atalho ao Apple Watch (aba "Atalhos" no app Watch ou via Siri).</li>' +
        '</ol>' +
        '<p style="margin:10px 0 6px 0;"><b>Ações disponíveis</b> (campo <code>action</code>):</p>' +
        '<ul style="margin:0 0 0 18px;padding:0;font-size:0.82rem;">' +
          actionsList +
        '</ul>' +
        '<p style="margin:10px 0 0 0;font-size:0.78rem;color:var(--text-muted);"><b>Dica:</b> no Atalho, use "Falar texto" com o resultado retornado (campo <code>spoken</code>) para o Watch anunciar o placar por voz.</p>' +
      '</div>';
  }

  function _findMatchInTournament(t, matchId) {
    var id = String(matchId);
    function pick(arr) { return (arr || []).find(function(m){ return String(m.id) === id; }); }
    var m = pick(t.matches);
    if (m) return m;
    if (Array.isArray(t.rounds)) for (var i = 0; i < t.rounds.length; i++) { m = pick(t.rounds[i].matches); if (m) return m; }
    if (Array.isArray(t.groups)) for (var j = 0; j < t.groups.length; j++) { m = pick(t.groups[j].matches); if (m) return m; }
    if (Array.isArray(t.rodadas)) for (var k = 0; k < t.rodadas.length; k++) { m = pick(t.rodadas[k].matches); if (m) return m; }
    if (t.thirdPlaceMatch && String(t.thirdPlaceMatch.id) === id) return t.thirdPlaceMatch;
    return null;
  }

  function _buildMatchOptions(t, currentMatchId) {
    // Flatten every match across structures; label with stage so the organizer
    // can pick the right one easily. Skip matches without both players.
    var out = [];
    function add(m, stage) {
      if (!m || !m.id || !m.p1 || !m.p2) return;
      var label = '[' + stage + '] ' + (m.p1 || '?') + ' × ' + (m.p2 || '?');
      var selected = String(m.id) === String(currentMatchId) ? ' selected' : '';
      out.push('<option value="' + _safeHtml(m.id) + '"' + selected + '>' + _safeHtml(label) + '</option>');
    }
    (t.matches || []).forEach(function(m){ add(m, 'Elim'); });
    (t.rounds || []).forEach(function(r, i){ (r.matches || []).forEach(function(m){ add(m, 'R' + (i+1)); }); });
    (t.groups || []).forEach(function(g){ (g.matches || []).forEach(function(m){ add(m, g.name || 'Grupo'); }); });
    (t.rodadas || []).forEach(function(r, i){ (r.matches || []).forEach(function(m){ add(m, 'Rod' + (i+1)); }); });
    if (t.thirdPlaceMatch) add(t.thirdPlaceMatch, '3º lugar');
    return out.join('');
  }

  // ─── Button handlers exposed on window ───────────────────────────────────
  window._remoteControlGenerate = async function() {
    var ctx = window._remoteControlCurrentCtx;
    if (!ctx || !ctx.target) {
      if (window.showNotification) window.showNotification('Contexto de sessão perdido', 'Reabra o modal.', 'error');
      return;
    }
    try {
      var target = ctx.kind === 'casual'
        ? { casualMatchId: ctx.target.id }
        : { tournamentId: ctx.target.id };
      var local = await createSession(target);
      _renderModal(ctx, local);
      if (window.showNotification) window.showNotification('Código gerado', 'Válido por 24h. Configure no Atalho do iPhone.', 'success');
    } catch (e) {
      console.error('[remoteControl] create failed', e);
      if (window.showNotification) window.showNotification('Falha ao gerar código', e.message || 'Erro desconhecido', 'error');
    }
  };

  window._remoteControlSetActive = async function(matchId) {
    if (!matchId) return;
    try {
      await setActiveMatch(matchId);
      if (window.showNotification) window.showNotification('Partida ativa definida', 'O Apple Watch agora controla esta partida.', 'success');
      // Re-render to refresh the "currently active" block.
      var local = _loadLocal();
      var ctx = window._remoteControlCurrentCtx;
      if (ctx) _renderModal(ctx, local);
    } catch (e) {
      console.error('[remoteControl] setActive failed', e);
      if (window.showNotification) window.showNotification('Falha ao definir partida', e.message || '', 'error');
    }
  };

  window._remoteControlCopyToken = function() {
    var inp = document.getElementById('remote-token-input');
    if (!inp) return;
    inp.select();
    try {
      navigator.clipboard.writeText(inp.value).then(function(){
        if (window.showNotification) window.showNotification('Token copiado', '', 'success');
      });
    } catch (e) { document.execCommand('copy'); }
  };

  window._remoteControlCopyEndpoint = function() {
    var inp = document.getElementById('remote-endpoint-input');
    if (!inp) return;
    inp.select();
    try {
      navigator.clipboard.writeText(inp.value).then(function(){
        if (window.showNotification) window.showNotification('URL copiada', '', 'success');
      });
    } catch (e) { document.execCommand('copy'); }
  };

  window._remoteControlEnd = async function() {
    if (!confirm('Encerrar sessão de controle remoto? O Apple Watch não poderá mais marcar placar até você gerar um novo código.')) return;
    try {
      await endSession();
      var modal = document.getElementById('modal-remote-control');
      if (modal) modal.remove();
      if (window.showNotification) window.showNotification('Sessão encerrada', '', 'info');
    } catch (e) {
      console.error('[remoteControl] end failed', e);
    }
  };

  // Public helpers for other modules that want to check session state.
  window._remoteControlGetLocal = _loadLocal;
})();
