// Retiramos o DOMContentLoaded event para evitar condição de corrida com ES Modules (type="module")
// já que o script está no final do <body> e o DOM já estará parseado.

// === Modal Sobre ===
(function setupAboutModal() {
  if (document.getElementById('modal-about')) return;
  const html = `
    <div class="modal-overlay" id="modal-about">
      <div class="modal" style="max-width:420px; text-align:center; padding:2rem;">
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">🏆</div>
        <h2 style="margin:0 0 0.25rem; font-size:1.5rem; font-weight:800; color:var(--text-bright);">scoreplace.app</h2>
        <p style="margin:0 0 1rem; font-size:0.85rem; color:var(--text-muted);">Versão ${window.SCOREPLACE_VERSION || '1.0.0'}</p>
        <p style="font-size:0.85rem; color:var(--text-main); line-height:1.6; margin:0 0 1rem;">
          Plataforma de gestão de torneios esportivos e board games.<br>
          <span style="opacity:0.6;">Fase Alpha — funcionalidades em desenvolvimento.</span>
        </p>
        <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 1.5rem;">© 2026 scoreplace.app. Todos os direitos reservados.</p>
        <button class="btn btn-secondary" onclick="if(typeof closeModal==='function')closeModal('modal-about');" style="padding:0.5rem 2rem;">Fechar</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
})();

// === Modal Criação Rápida ===
(function setupQuickCreateModal() {
  if (document.getElementById('modal-quick-create')) return;
  const html = `
    <div class="modal-overlay" id="modal-quick-create">
      <div class="modal" style="max-width:420px; padding:2rem;">
        <h2 style="margin:0 0 1.25rem; font-size:1.3rem; font-weight:700; color:var(--text-bright); text-align:center;">Novo Torneio</h2>
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label">Modalidade Esportiva</label>
          <select class="form-control" id="quick-create-sport">
            <option>🎾 Beach Tennis</option>
            <option>⚽ Futebol</option>
            <option>🃏 Magic / TCG</option>
            <option>🎾 Tênis</option>
            <option>🏐 Vôlei</option>
            <option>♟️ Xadrez</option>
            <option>🏅 Outro</option>
          </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary" id="btn-quick-create" style="width:100%; padding:0.7rem; font-weight:600; font-size:1rem;">
            🏆 Criar Torneio
          </button>
          <button class="btn btn-secondary" id="btn-quick-advanced" style="width:100%; padding:0.6rem;">
            ⚙️ Detalhes Avançados
          </button>
          <button class="btn btn-secondary" onclick="if(typeof closeModal==='function')closeModal('modal-quick-create');" style="width:100%; padding:0.6rem;">
            Cancelar
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // Criar Torneio (rápido com auto-nome)
  document.getElementById('btn-quick-create').addEventListener('click', function () {
    const sportRaw = document.getElementById('quick-create-sport').value || '';
    const sportClean = sportRaw.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() || 'Esportes';
    const userName = (window.AppStore.currentUser && window.AppStore.currentUser.displayName)
      ? window.AppStore.currentUser.displayName.split(' ')[0] : 'Organizador';
    const autoName = 'Torneio Eliminatórias de ' + sportClean + ' de ' + userName;

    const tourData = {
      id: 'tour_' + Date.now(),
      name: autoName,
      sport: sportRaw,
      format: 'Eliminatórias Simples',
      isPublic: true,
      enrollment: 'individual',
      status: 'open',
      createdAt: new Date().toISOString(),
      organizerId: window.AppStore.currentUser ? window.AppStore.currentUser.uid : 'local',
      organizerName: window.AppStore.currentUser ? window.AppStore.currentUser.displayName : 'Organizador',
      organizerEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local',
      participants: [],
      matches: [],
      tiebreakers: ['confronto_direto', 'saldo_pontos', 'vitorias', 'buchholz', 'sonneborn_berger', 'sorteio']
    };

    window.AppStore.addTournament(tourData);
    if (typeof closeModal === 'function') closeModal('modal-quick-create');
    window.location.hash = '#tournaments/' + tourData.id;
    if (typeof showNotification === 'function') {
      showNotification('Torneio Criado!', autoName, 'success');
    }
  });

  // Detalhes Avançados — abre formulário completo com sport pré-selecionado
  document.getElementById('btn-quick-advanced').addEventListener('click', function () {
    const sportVal = document.getElementById('quick-create-sport').value;
    if (typeof closeModal === 'function') closeModal('modal-quick-create');

    // Reset formulário completo
    const form = document.getElementById('form-create-tournament');
    if (form) form.reset();
    const editId = document.getElementById('edit-tournament-id');
    if (editId) editId.value = '';
    const title = document.getElementById('create-modal-title');
    if (title) title.innerText = 'Criar Novo Torneio';
    const pub = document.getElementById('tourn-public');
    if (pub) pub.checked = true;
    const liga = document.getElementById('liga-open-enrollment');
    if (liga) liga.checked = true;
    const tp = document.getElementById('elim-third-place');
    if (tp) tp.checked = true;

    // Pré-selecionar sport
    const sportSelect = document.getElementById('select-sport');
    if (sportSelect) {
      const opt = Array.from(sportSelect.options).find(o => o.value === sportVal || o.text === sportVal);
      if (opt) sportSelect.value = opt.value;
      if (typeof window._onSportChange === 'function') window._onSportChange();
    }

    if (typeof window._onFormatoChange === 'function') window._onFormatoChange();
    if (typeof openModal === 'function') openModal('modal-create-tournament');
    if (typeof window._initPlacesAutocomplete === 'function') {
      setTimeout(() => window._initPlacesAutocomplete(), 100);
    }
  });
})();

// Inicializa estrutura base da UI (Modais, Menus)
setupUI();

setupCreateTournamentModal();
setupLoginModal();
setupProfileModal();
setupResultModal();
setupEnrollModal();

// Inicia Lógica de Temas (Select Element)
initThemeSystem();

// Inicia o Roteador SPA
// Firebase onAuthStateChanged will handle auto-login and data loading from Firestore
initRouter();

console.log("scoreplace.app Inicializado com Sucesso");
