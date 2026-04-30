// scoreplace.app — Release notes (lazy-loaded)
// Loaded on demand when the user opens "Notas de versões" in help modal.
//
// Convenção de versão (a partir de 30 Abr 2026): MAJOR.MINOR.PATCH-channel.
// Em beta, PATCH incrementa a cada release (1.0.3-beta → 1.0.4-beta).
// Histórico completo da fase alpha → beta exportado pra
// docs/scoreplace_relatorio_alpha_to_beta.docx (registro local do dono).

window._RELEASE_NOTES_HTML = (function () {
  var html =
    '<div style="margin-bottom:1rem;border:2px solid #06b6d4;border-radius:12px;padding:14px 16px;background:rgba(6,182,212,0.08);">' +
      '<div style="font-weight:800; color:#06b6d4; font-size:1rem; margin-bottom:8px;">v1.0.6-beta <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">(30 de Abril, 2026)</span></div>' +
      '<p><b>Excluir conta volta pra landing page.</b> Antes ficava preso no loader 🎾 "Carregando..." indefinidamente — o router via <code>currentUser=null</code> mas <code>localStorage.scoreplace_authCache</code> continuava presente, caindo no branch que espera auth resolver (que nunca vai resolver, porque a conta foi excluída). Fix: limpar cache de auth + IndexedDB do Firebase logo depois do delete success, antes do <code>initRouter()</code>. Router agora vê <code>loggedIn=false + hasCache=false</code> → renderiza a landing.</p>' +
    '</div>' +
    '<div style="margin-bottom:1rem;border:2px solid #ef4444;border-radius:12px;padding:14px 16px;background:rgba(239,68,68,0.08);">' +
      '<div style="font-weight:800; color:#ef4444; font-size:1rem; margin-bottom:8px;">🔒 v1.0.5-beta <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">(30 de Abril, 2026)</span></div>' +
      '<p><b>Correção de privacidade — telefone, data de nascimento, sexo e endereço dos usuários não vazam mais por busca de amigos.</b> A função <code>searchUsers</code> em #explore retornava o documento inteiro do perfil de cada usuário (incluindo phone, birthDate, gender, preferredCeps, preferredLocations) — qualquer um podia abrir DevTools e dumpar dados pessoais via console. Agora a busca retorna só campos públicos: nome, e-mail, foto, modalidades, timestamps. Fix client-side imediato; fix definitivo nas Firestore Security Rules vai num round dedicado com testes.</p>' +
      '<p><b>"Esportes Preferidos" agora se chama "Modalidades"</b> no perfil. Mais curto e alinhado com a nomenclatura usada no resto do app.</p>' +
      '<p><b>Pills de Modalidades, Presença e Aparência (temas) parecem corretamente desativadas por padrão.</b> Antes nasciam com o estilo default do <code>.btn</code> (texto branco, sem bg explícito) que parecia "todos selecionados" até o JS rodar e sobrescrever. Agora cada pill já nasce com inline style "desativado" (transparente, texto muted, borda discreta) — o JS só ativa o que foi escolhido.</p>' +
      '<p><b>Toggles de notificação iniciam com os 3 ativos.</b> Antes "todas" começava ON e "importantes/fundamentais" OFF, criando um flash visual antes da cascata corrigir pra "tudo ativo". Agora os 3 já nascem ON, alinhados com o default canônico (<code>todas</code> = receber tudo).</p>' +
      '<p><b>Sobre puxar Sexo/Nascimento/Cidade do Google:</b> tecnicamente possível mas exige scopes restritos (<code>user.gender.read</code>, <code>user.birthday.read</code>, <code>user.phonenumbers.read</code>) que precisam de Google App Verification (4-6 semanas, exige privacy policy revisada e demo video). Fica deferido — campos seguem manuais.</p>' +
    '</div>' +
    '<div style="margin-bottom:1rem;border:2px solid #34d399;border-radius:12px;padding:14px 16px;background:rgba(52,211,153,0.08);">' +
      '<div style="font-weight:800; color:#34d399; font-size:1rem; margin-bottom:8px;">v1.0.4-beta <span style="color:var(--text-muted); font-weight:400; font-size:0.78rem;">(30 de Abril, 2026)</span></div>' +
      '<p><b>Sentry observability — round 1 de cleanup.</b> Auditoria das 7 issues unresolved abriu 6 fixes consolidados num commit: (1) skip de init em ambiente não-produção (mata 13 events do Karma E2E poluindo Sentry); (2) <code>release</code> lazy via <code>beforeSend</code> (corrige <code>scoreplace@unknown</code> em eventos disparados antes do <code>store.js</code> defer carregar); (3) <code>.catch()</code> em <code>reg.update()</code> do Service Worker (mata <code>TypeError: Script sw.js load failed</code> em iOS Safari com rede móvel ruim); (4) probe <code>_captureMessage(\'login modal force-closed\')</code> removido (era diagnóstico da v0.17.83-91, cumpriu papel, agora só polui — 36 events em 2d sem sinal); (5) <code>ignoreErrors</code> ganha 4 patterns: <code>Script .* load failed</code>, <code>popup has been closed</code>, <code>popup_closed_by_user</code>, <code>Test event from beta-readiness</code>.</p>' +
      '<p><b>Hamburger não pisca mais na 1ª vez.</b> Bug reproduzido via Chrome MCP: usuário abria menu logo após page load, Firestore listener disparava <code>onSnapshot</code> nos primeiros 0.5-2s, <code>_softRefreshView()</code> chamava <code>initRouter()</code>, e <code>router.js:84</code> fechava o menu unconditionally em todo handleRoute. Stack trace pegou em flagrante. Fix: <code>_closeHamburger</code> só dispara em navegação real (<code>!window._isSoftRefresh</code>); soft refresh re-renderiza a mesma view e não justifica fechar menu aberto.</p>' +
      '<p><b>Botões "🤖 Add Bot" e "🗑️ Apagar" removidos do detalhe do torneio.</b> Eram úteis em alpha pra testar fluxos de chaveamento e descartar dados de teste. Em beta, bots inflavam dados reais sem motivo e delete destrutivo num clique era arriscado demais. Funções <code>addBotsFunction</code> e <code>deleteTournamentFunction</code> permanecem definidas (zero impacto no usuário) — só perderam o ponto de entrada na UI.</p>' +
    '</div>' +
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
