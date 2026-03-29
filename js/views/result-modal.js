function setupResultModal() {
  if (!document.getElementById('modal-result')) {
    const modalHtml = `
      <div class="modal-overlay" id="modal-result">
        <div class="modal" style="max-width: 450px;">
          <div class="modal-header">
            <h2 class="card-title">Lançar Resultado</h2>
            <button class="modal-close" onclick="closeModal('modal-result')">&times;</button>
          </div>
          <div class="modal-body">
            <p class="text-muted mb-4 text-center">Informe o placar final da partida.</p>
            
            <div class="d-flex justify-between align-center mb-4" style="gap: 1rem;">
               <div class="text-center" style="flex:1;">
                 <h3 class="mb-2" id="player1-name">Jogador 1</h3>
                 <input type="number" class="form-control text-center" style="font-size:1.5rem; font-weight:bold;" value="0" min="0" id="player1-score">
               </div>
               <div class="text-muted" style="font-size:1.5rem; font-weight:bold;">X</div>
               <div class="text-center" style="flex:1;">
                 <h3 class="mb-2" id="player2-name">Jogador 2</h3>
                 <input type="number" class="form-control text-center" style="font-size:1.5rem; font-weight:bold;" value="0" min="0" id="player2-score">
               </div>
            </div>

            <div class="form-group mb-4">
                <label class="form-label">Ocorreu W.O.?</label>
                <select class="form-control">
                   <option>Não</option>
                   <option>Sim, vitória do Jogador 1</option>
                   <option>Sim, vitória do Jogador 2</option>
                   <option>Duplo W.O.</option>
                </select>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('modal-result')">Cancelar</button>
            <button class="btn btn-primary" onclick="showNotification('Resultado Registrado', 'O placar foi salvo com sucesso.', 'success'); closeModal('modal-result');">Confirmar Placar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(createInteractiveElement(modalHtml));
  }
}

function openResultModal(p1, p2) {
   document.getElementById('player1-name').textContent = p1;
   document.getElementById('player2-name').textContent = p2;
   openModal('modal-result');
}
