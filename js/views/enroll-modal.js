function setupEnrollModal() {
  if (!document.getElementById('modal-enroll')) {
    const modalHtml = `
      <div class="modal-overlay" id="modal-enroll">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h2 class="card-title">Convidar Participantes</h2>
            <button class="modal-close" onclick="closeModal('modal-enroll')">&times;</button>
          </div>
          <div class="modal-body">

            <p class="text-muted mb-3"><strong>Compartilhe o link</strong> para convidar jogadores ao torneio.</p>

            <div class="form-group d-flex" style="gap: 5px;">
               <input type="text" readonly class="form-control" value="" style="flex:1;" id="share-link-input">
               <button class="btn btn-secondary" onclick="
                  var inp = document.getElementById('share-link-input');
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inp.value).then(function() {
                      showNotification('Copiado', 'Link copiado para a área de transferência.', 'info');
                    }).catch(function() {
                      inp.select(); document.execCommand('copy');
                      showNotification('Copiado', 'Link copiado para a área de transferência.', 'info');
                    });
                  } else {
                    inp.select(); document.execCommand('copy');
                    showNotification('Copiado', 'Link copiado para a área de transferência.', 'info');
                  }
               ">Copiar</button>
            </div>

            <button class="btn full-width mt-3" style="background:#25D366; color:#fff;" onclick="
               var link = document.getElementById('share-link-input').value;
               var text = 'Participe do torneio! Inscreva-se aqui: ' + link;
               var url = window._whatsappShareUrl ? window._whatsappShareUrl(text) : 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
               window.open(url, '_blank');
            ">
               📱 Compartilhar via WhatsApp
            </button>

          </div>
        </div>
      </div>
    `;
    document.body.appendChild(createInteractiveElement(modalHtml));
  }
}

function openEnrollModal(tournamentId) {
  var inp = document.getElementById('share-link-input');
  if (inp && tournamentId) {
    inp.value = (window.SCOREPLACE_URL || 'https://scoreplace.app') + '/#tournaments/' + tournamentId;
  }
  openModal('modal-enroll');
}
