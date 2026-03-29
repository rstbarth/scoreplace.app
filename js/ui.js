function setupUI() {
  // Configuração global de Modais, Botões, etc.
  
  // Delegação de eventos para fechar modais no X
  document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-close')) {
      const modalOverlay = e.target.closest('.modal-overlay');
      if (modalOverlay) {
        modalOverlay.classList.remove('active');
      }
    }
    
    // Fecha ao clicar fora (no overlay escuro)
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });

  console.log("UI Handlers Setup Completo");
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    // Scroll para o topo do conteúdo do modal
    const inner = modal.querySelector('.modal') || modal.querySelector('[style*="overflow"]');
    if (inner) inner.scrollTop = 0;
    modal.scrollTop = 0;
  } else {
    console.warn(`Modal ${modalId} não encontrado.`);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function createInteractiveElement(htmlString) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}
