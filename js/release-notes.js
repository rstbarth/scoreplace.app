// scoreplace.app — Release notes (lazy-loaded)
// Loaded on demand when the user opens "Notas de versões" in help modal.
//
// v1.0.0-beta (29 Abr 2026): zerado em conjunto com o reset Firestore.
// Histórico completo da fase alpha → beta foi exportado pra
// docs/scoreplace_relatorio_alpha_to_beta.docx (registro local do dono).
// A partir daqui as notas crescem fresh com mudanças pós-beta.

window._RELEASE_NOTES_HTML = (function () {
  var html =
    '<div style="margin-bottom:1rem;border:2px solid #10b981;border-radius:12px;padding:14px 16px;background:rgba(16,185,129,0.08);">' +
      '<div style="font-weight:800; color:#10b981; font-size:1.1rem; margin-bottom:8px;">🚀 v1.0.0-beta <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">(29 de Abril, 2026)</span></div>' +
      '<p><b>BETA LANÇADO!</b> O scoreplace.app oficialmente sai da fase de desenvolvimento exploratório e entra em <b>beta soft</b>. <b>O que muda:</b> dados são reais, persistem, e qualquer mudança destrutiva exige comunicação prévia. <b>Reset de transição:</b> banco zerado pra começar limpo. <b>Critérios de saída atingidos:</b> Performance Lighthouse 64, Acessibilidade 96, 34 testes E2E, Sentry ativo, Backup Firestore diário, Quotas+alertas, Privacy+Termos publicados, 0 erros JS no smoke. Reportar bugs: scoreplace.app@gmail.com com screenshot. Bora jogar! 🎾🏆</p>' +
    '</div>';
  return html;
})();
