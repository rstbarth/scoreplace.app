// scoreplace.app — Release notes (lazy-loaded)
// Loaded on demand when the user opens "Notas de versões" in help modal.
//
// Convenção de versão (a partir de 30 Abr 2026): MAJOR.MINOR.PATCH-channel.
// Em beta, PATCH incrementa a cada release (1.0.3-beta → 1.0.4-beta).
// Histórico completo da fase alpha → beta exportado pra
// docs/scoreplace_relatorio_alpha_to_beta.docx (registro local do dono).

window._RELEASE_NOTES_HTML = (function () {
  var html =
    '<div style="margin-bottom:1rem;border:2px solid #10b981;border-radius:12px;padding:14px 16px;background:rgba(16,185,129,0.08);">' +
      '<div style="font-weight:800; color:#10b981; font-size:1rem; margin-bottom:8px;">v1.0.3-beta <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">(30 de Abril, 2026)</span></div>' +
      '<p><b>Convenção de versão padronizada</b> — antes era <code>1.0.0-beta-N</code>, agora <code>1.0.N-beta</code> (semver clássico). PATCH incrementa a cada deploy. Trocas internas; nada visual ou funcional muda pro usuário.</p>' +
      '<p><b>Auditoria completa de hints + manual</b>: ~120 hints validados contra o app atual. Removidos refs obsoletos (Suíço como formato principal, "4 pilares" → "5 pilares" + Stats, Place unificado). Adicionados hints novos (página #invite, página #support, modal de aceite de Termos). Nova seção <b>"💚 Apoio e Suporte"</b> no manual com PIX, Plano Pro, reportar bugs, convidar amigos, Privacy+Termos.</p>' +
    '</div>' +
    '<div style="margin-bottom:1rem;border:2px solid #fbbf24;border-radius:12px;padding:14px 16px;background:rgba(251,191,36,0.08);">' +
      '<div style="font-weight:800; color:#fbbf24; font-size:1.1rem; margin-bottom:8px;">🚀 v1.0.0-beta <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">(29 de Abril, 2026)</span></div>' +
      '<p><b>BETA LANÇADO!</b> O scoreplace.app oficialmente saiu da fase de desenvolvimento exploratório e entrou em <b>beta soft</b>. <b>O que muda:</b> dados são reais, persistem, e qualquer mudança destrutiva exige comunicação prévia. <b>Reset de transição:</b> banco zerado pra começar limpo. <b>Critérios de saída atingidos:</b> Performance Lighthouse 64, Acessibilidade 96, 34 testes E2E, Sentry ativo, Backup Firestore diário, Quotas+alertas, Privacy+Termos publicados, 0 erros JS no smoke. Reportar bugs: scoreplace.app@gmail.com com screenshot. Bora jogar! 🎾🏆</p>' +
    '</div>';
  return html;
})();
