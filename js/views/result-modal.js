// result-modal.js — DEPRECATED
// Resultados são lançados inline via _saveResultInline() em bracket-ui.js
// Este modal foi substituído pelo sistema inline e não é mais chamado.
// Mantido apenas para compatibilidade caso algum código legado referencie.

function setupResultModal() {
  // No-op: modal de resultado inline é usado em vez deste modal
}

function openResultModal(p1, p2) {
  // Redirecionar para o bracket onde o resultado inline pode ser lançado
  console.warn('openResultModal() está deprecated. Use o lançamento inline no chaveamento.');
}
