function setupEnrollModal() {
  if (!document.getElementById('modal-enroll')) {
    const modalHtml = `
      <div class="modal-overlay" id="modal-enroll">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h2 class="card-title">Gestão de Inscrições</h2>
            <button class="modal-close" onclick="closeModal('modal-enroll')">&times;</button>
          </div>
          <div class="modal-body">
            
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
               <button class="btn btn-primary" style="flex:1;" onclick="
                  showNotification('Inscrição Solicitada', 'Seu pedido foi enviado ao organizador e está pendente.', 'success');
                  closeModal('modal-enroll');
               ">
                  Quero Participar
               </button>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">

            <p class="text-muted mb-3"><strong>Organização:</strong> Convide jogadores enviando o link público do torneio.</p>
            
            <div class="form-group d-flex" style="gap: 5px;">
               <input type="text" readonly class="form-control" value="https://scoreplace.app/#tournaments/" style="flex:1;" id="share-link-input">
               <button class="btn btn-secondary" onclick="
                  const i = document.getElementById('share-link-input');
                  i.select();
                  document.execCommand('copy');
                  showNotification('Copiado', 'Link de inscrição copiado para a área de transferência.', 'info');
               ">Copiar</button>
            </div>

            <button class="btn full-width mt-3" style="background:#25D366; color:#fff;" onclick="
               showNotification('Redirecionando...', 'Abrindo WhatsApp Business API para envio de mensagens.', 'success');
            ">
               Compartilhar via WhatsApp
            </button>

          </div>
        </div>
      </div>
    `;
    document.body.appendChild(createInteractiveElement(modalHtml));
  }
}

function openEnrollModal() {
  openModal('modal-enroll');
}
