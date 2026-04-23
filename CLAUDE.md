# scoreplace.app - Projeto de Contexto

## O que e o scoreplace.app

Plataforma web de gestao de torneios esportivos e board games. App SPA (Single Page Application) em **vanilla JS puro** â sem frameworks. Hospedado no **GitHub Pages** com dominio customizado `scoreplace.app`.

- **Versao atual:** `0.15.91-alpha` (definida em `window.SCOREPLACE_VERSION` no store.js)
- **URL principal:** https://scoreplace.app
- **GitHub repo:** `rstbarth/scoreplace.app`
- **Banco de dados:** Cloud Firestore (projeto Firebase: `scoreplace-app`)
- **Auth:** Firebase Auth com Google Sign-In (popup)
- **localStorage:** `boratime_state` (chave legada mantida por compatibilidade)
- **Email de suporte:** scoreplace.app@gmail.com

## ⚠️ Fase de Desenvolvimento — ALPHA

**O projeto está em fase ALPHA.** Regra importante para qualquer mudança de código:

- **Torneios, locais e quadras** no Firestore podem ser ignorados ou apagados sem problema. Não há produção real em cima deles.
- **Usuários** já existem (amigos chegados testando), mas também podem ser recriados sem dor.
- **NÃO escreva código defensivo de backward compatibility** ao mudar schemas/modelos. Não adicione campos duplicados, branches `if (legacy_shape) ...`, fallbacks pra shapes antigos. Simplesmente escreva o schema novo limpo.
- **NÃO implemente código de migração** automática entre versões. Se um cadastro antigo quebrar depois da mudança, o usuário apaga e refaz — é comportamento esperado.
- **NÃO preserve** campos no Firestore só "por segurança". Pode dropar livremente.
- **Exceção**: preservar compat só vale a pena se for trivial (1 linha) E genuinamente útil além de compat.

**Quando essa regra muda:** na migração para **beta**, quando usuários reais testarão por período longo. O Rodrigo avisa quando for a hora — até lá, priorize simplicidade sobre compat.

Isso **não** se aplica à estabilidade de código entre versões do app rodando no navegador dos usuários (cache-busters, service worker updates continuam importando — o app não pode crashar em runtime). Só se aplica a dados persistidos no Firestore.

## Historico do Projeto

O projeto comecou como "torneio_facil", passou por "Boratime", e foi renomeado definitivamente para **scoreplace.app**.

### Changelog

> **Nota:** entre v0.8.6 e v0.15.45 foram ~400 version bumps. O bloco abaixo consolida por tema. Para detalhe de uma versão específica, consulte `git log --oneline | grep vX.Y.Z`.

**v0.15.x-alpha (Abril 2026) — Polimento final, 5 pilares, Apple Watch rollback**
- **Cabeçalho de inscritos: espaço elegante entre <i>Voltar</i> e os filtros** (v0.15.91): na tela de inscritos com check-in ativo, o `extraStyle: 'padding-bottom:0'` aplicado no `_renderBackHeader` deixava a linha de filtros (Todos/Presentes/Ausentes/Aguardando) colada no botão *Voltar*. Adicionado `margin-top:8px` no container dos filtros em `participants.js` — mesmo gap visual que o `flex-wrap` já aplicava entre linhas dos próprios filtros (quando viram para a linha do "Aguardando"), agora também entre eles e o botão de voltar. Preview-verified via injeção mock: gap de 8px confirmado (back-btn bottom=114, filtros top=122). Puro visual, zero efeito funcional.
- **W.O. unificado + botão "Preencher" removido do topo da lista de espera** (v0.15.90): usuário relatou que o primeiro registro de W.O. num torneio mostrava um diálogo diferente dos registros subsequentes (`absenceMsgIndNoStandby` com botão "Marcar Ausente" vs `absenceMsgIndStandby` com botão "Substituir Individual"). A lógica anterior em `_markAbsent` (`participants.js`) bifurcava por `hasStandby && isIndividualWO` — o que dava UX inconsistente. Unificado: qualquer W.O. individual agora passa pelo mesmo diálogo *"O próximo da lista de espera substituirá apenas {jogador}"* + botão *Substituir Individual*. O handler de confirmação tenta a substituição primeiro; se não houver substituto presente (standby vazio ou ninguém com check-in), cai em "marca ausente e aguarda substituto" com toast de aviso — mesmo comportamento da antiga branch `isIndividualWO && !hasStandby`, só que sem a pergunta inconsistente no diálogo. Em paralelo, removido o botão verde `🔄 Preencher` que aparecia no topo do painel de Lista de Espera (`_renderStandbyPanel` em `bracket.js`) — a operação de substituição vem toda pelo botão W.O. no card do jogador; o botão do topo duplicava função e confundia o fluxo. `_autoSubstituteWO` (em `bracket-ui.js`) mantém-se definido para compat com `tests-draw-resolution.html`. `hints.js` atualizado: removido hint `bracket-substitute-wo`, `checkin-wo` agora descreve o novo comportamento unificado.
- **Painel de resolução sobrevive a re-render em tempo real** (v0.15.89): causa-raiz do `Painel removido (async)` da v0.15.88 (a observabilidade entregou o diag exato). `showUnifiedResolutionPanel` seta `t.status='closed'` + `FirestoreDB.saveTournament(t)` antes de criar o overlay — o `onSnapshot` dispara async → `_softRefreshView` → `initRouter()` → `_dismissAllOverlays()`. Este último faz varredura genérica por `position:fixed` com `z-index > 101` cobrindo viewport (para limpar overlays órfãos em navegação) e engole os 4 painéis de resolução (não estão em safe-list). Fix em `_softRefreshView` (`store.js`): adiciona `#unified-resolution-panel`, `#groups-config-panel`, `#remainder-resolution-panel` e `#removal-subchoice-panel` à lista de modals que pausam o soft-refresh (antes só `.modal-overlay.active` / `#qr-modal-overlay` / `#player-stats-overlay` / `.tv-overlay`). Preview-verified com mock N=7 teamSize=2: sync+async ambos presentes após soft-refresh simulado. Regra para memória: **qualquer overlay novo em body que não use a classe `.modal-overlay.active` precisa ser adicionado ao detector de `_softRefreshView`** — senão o próprio save do overlay causa auto-kill via snapshot.
- **Locais registrados voltam em #venues + observabilidade com versão embutida** (v0.15.88): (1) Mesmo depois da v0.15.87 mover o filtro de esporte para client-side, venues cadastrados continuavam sumindo da seção entre "Minha localização atual" e "Sugestões do Google". Causa-raiz: `state.minCourts: 1` (default em venues.js) filtrava por `v.courtCount`, mas venues criados desde a v0.15.51 guardam quadras em `courts[]` (array embedded) e nunca populam `courtCount` — todos caíam fora. Fix em `VenueDB.listVenues`: aceita `courts[].length` como fallback; venues sem `courtCount` nem `courts[]` passam como wildcard (0 é coringa em vez de rejeição). Preview-verified: 2 venues de teste passam a aparecer. (2) Usuário continuava reportando toast "⚠️ Painel não abriu" apesar do fix de typo da v0.15.87. Preview não reproduz — hipótese: cache stale do SW. Em vez de adivinhar, a toast agora embute `v=SCOREPLACE_VERSION` e o handler distingue três falhas: `Erro ao abrir painel (sync)` (throw síncrono), `Painel não criado (sync)` (dispatch executou mas DOM ficou vazio), `Painel removido (async)` (painel apareceu mas foi removido em <120ms). Próximo report do usuário diz exatamente qual versão rodou e em qual ponto quebrou.
- **Três bugs encontrados pela observabilidade da v0.15.86** (v0.15.87): (1) typo no próprio fix v0.15.86 — o check de overlay usava `#remainder-panel` mas o ID real é `#remainder-resolution-panel`, fazendo o toast "Painel não abriu" disparar falso-positivo sempre que o painel de resto abria. (2) Notificação de `_presencePlan`/`_presenceCheckin` mostrava "undefined" no lugar do esporte: o payload tem `sports[]` (array), mas o texto lia `payload.sport` (singular, nunca existiu). Agora junta com "/" (`Beach Tennis/Tênis`) ou cai em "algo"/"agora" se vazio — mesma correção na throttle key do check-in. (3) Venues cadastrados sem quadras ainda registradas não apareciam em `#venues`: o filtro server-side `where('sports', 'array-contains', sport)` exclui docs com `sports[]` vazio (estado padrão logo após cadastrar antes de adicionar quadras). Movido o filtro de esporte para client-side em `VenueDB.listVenues` com regra wildcard — venues sem `sports[]` declarado passam como coringa; venues com `sports[]` precisam incluir o esporte filtrado. Trade-off: query do servidor volta a ser sem filtro (`limit 50`), aceitável em escala alpha.
- **Encerrar Inscrições: observabilidade em 3 camadas do painel de resolução** (v0.15.86): usuário reportou que em torneios Eliminatórias o botão *Encerrar Inscrições* não dispara o painel unificado de resolução (potência de 2, resto, times incompletos) mesmo após v0.15.79/v0.15.81 — mas o *Sortear* dispara corretamente. Simulações via `preview_eval` cobrindo Eliminatórias Simples/Dupla Elim/Rei-Rainha/sem acento × N=5,6,7,8 mostraram `_diagnoseAll` retornando `hasIssues:true` e `showUnifiedResolutionPanel` sendo chamada — ou seja, no código o caminho funciona. Em vez de adivinhar, transformei o *silent failure* em *loud failure*: em `window.toggleRegistrationStatus` (`tournaments-draw-prep.js`), três camadas de toast de fallback: (1) try/catch em `_diagnoseAll` → toast "⚠️ Falha no diagnóstico" com stack; (2) try/catch em `showUnifiedResolutionPanel` → toast "⚠️ Erro ao abrir painel" com stack; (3) `setTimeout(120ms)` checa se `#unified-resolution-panel` / `#groups-config-panel` / `#remainder-panel` existem no DOM — se não, toast "⚠️ Painel não abriu" com payload completo do diag (`fmt|teams|resto|pot2|ímpar|incomp`). Próximo clique do usuário em torneio real vai abrir o painel ou mostrar exatamente onde quebra — fim do chute.
- **Cadastrar local direto da descoberta** (v0.15.85): em `#venues`, quando o usuário seleciona uma sugestão do Google ainda não cadastrada, o card de detalhe mostra botão `+ Cadastrar` que stash `{placeId, name, address, lat, lon}` em `sessionStorage['scoreplace_pending_venue_registration']` e navega para `#my-venues`. Em `renderMyVenues`, pickup automático chama `_startRegistrationFromData(pending)` que resolve via `VenueDB.venueKey`, checa doc existente (race), e abre `_renderForm` pré-preenchido. Se outro usuário cadastrou o mesmo placeId no intervalo, cai em modo edição colaborativa automaticamente.
- **Presença: fim da duplicata visual — onSnapshot é única fonte de verdade** (v0.15.84): depois da v0.15.83 garantir 1 doc único no Firestore via in-flight registry, a duplicata *visual* continuava aparecendo no *Estou aqui agora* e *Planejar ida*. Causa-raiz em `presence.js`: o `onSnapshot` da coleção rebuilda `state.myActive`/`state.presences` do Firestore a cada mudança, mas `_presenceCheckIn`/`_presenceConfirmPlan` também faziam `state.myActive.push(payload)` + `state.presences.push(payload)` dentro do `.then()`. Quando o snapshot chegava ANTES do `.then` (race comum), o array ficava com 2 cópias. Removidos os pushes manuais em ambos os handlers — listener do Firestore é única fonte de verdade. Regra para memória: **nunca push manual em state que já é populado por `onSnapshot`** — sempre deixar o listener rebuildar.
- **In-flight registry em PresenceDB mata double-tap duplicado de vez** (v0.15.83): o dedup via query Firestore da v0.15.81 tem um race clássico — duas chamadas concorrentes ambas consultam ANTES de qualquer `add()` completar, ambas veem "não tem", ambas inserem. Implementado registry síncrono `PresenceDB._inflight` keyed por `uid|placeId|type|sports|win`: chamadas concorrentes com a mesma chave lógica reusam o mesmo Promise em vez de disparar outro `add()`. Verificado via preview mock: 2 chamadas simultâneas → 1 `add()`, ambas retornam o mesmo id. Protege todos os caminhos (presence.js, venues.js, presence-geo.js) sem depender do state do caller.
- **Percentuais nas estatísticas do usuário** (v0.15.82): cada número no Desempenho agora tem o percentual entre parênteses abaixo do valor absoluto. Em Derrotas/Vitórias, Sets, Games, Pontos, Tiebreaks o % é dentro da mesma fonte (torneio 🏆 ou casual ⚡) — pctLT = leftTourn / (leftTourn+rightTourn), pctLC = leftCasual / (leftCasual+rightCasual), etc. Linhas de média/mín/máx (Pontos TB Médios, TB Vencidos, TB Perdidos) passam `opts.noPct = true` porque o par não é aditivo. Implementado em `_diffBarRow` em `tournaments-analytics.js`.
- **Dedup server-side de presença + diagnóstico de Encerrar Inscrições** (v0.15.81): o guard síncrono da v0.15.80 só protegia os handlers em `presence.js`, mas check-ins também são criados por `venues.js` (modal do local) e `presence-geo.js` (auto GPS) — cada um podia gerar duplicatas antes do `state.myActive` hidratar. Movemos o dedup para dentro de `PresenceDB.savePresence`: antes do `add()`, consulta Firestore por presenças ativas do mesmo uid com placeId/type iguais, sports sobrepostos (e janela de tempo sobreposta no plan). Se encontra, retorna o id existente em vez de criar novo doc — protege double-tap, multi-tab, multi-codepath e race do cache. Também adicionado diagnóstico `console.log('[Encerrar Inscrições] diag', {...})` em `toggleRegistrationStatus` mostrando format, classificação isGrupos/isLigaOrSwiss, effectiveTeams, remainder, isOdd, isPowerOf2, hasIssues e hasRelevantIssues — pinpoint quando o painel não abre como esperado.
- **Presença sem duplicidade + #venues sempre pinado** (v0.15.80): `_presenceCheckIn` e `_presenceConfirmPlan` criavam dois docs idênticos num double-tap — dup-check lia `state.myActive` antes do push, que só acontecia no `.then()` do save. Flags síncronos `state._savingCheckin` / `state._savingPlan` bloqueiam a segunda chamada enquanto a primeira está em voo; plan também ganhou dup-check contra planos no mesmo local com sports/horário sobrepostos. Em `#venues`, flag `centerFromGps` persistida suprimia auto-GPS em entradas subsequentes — pin verde só voltava com click manual em 📍. Agora `render()` dispara `_tryAutoGeolocate()` em toda entrada a menos que o usuário tenha digitado endereço custom (não-vazio E ≠ "Minha localização atual").
- **Encerrar Inscrições dispara diagnóstico completo** (v0.15.79): o botão "Encerrar Inscrições" agora roda o painel unificado de resolução (potência de 2, ímpar, times incompletos, resto) em Eliminatórias/Dupla Elim/Rei-Rainha e qualquer string de formato legada. Antes só o Sortear checava; `format === 'Eliminatórias Simples'` deixava passar drifts de string. Agora classifica por exclusão (Liga/Suíço → só incompletos+resto; Grupos → painel próprio; tudo mais → check completo), espelhando `showUnifiedResolutionPanel`.
- **Menu empurra conteúdo também em overlays** (v0.15.78): em Novo Torneio/Partida Casual, regra CSS `margin-top: 0 !important` anulava o valor dinâmico que o `_reflowChrome` coloca quando o dropdown abre. Trocado `element.style.marginTop = …` por `setProperty(..., 'important')` — valor dinâmico vence o CSS, padrão 0 preservado com menu fechado.
- **Menu empurra conteúdo em toda página** (v0.15.77): hamburger aberto empurra conteúdo para baixo em TODAS as páginas, inclusive dashboard. Contagem de back-headers visíveis (`_reflowChrome`) ignora os que estão dentro de modais inativos (`.modal-overlay` sem `.active`) — antes eles permaneciam no DOM via `opacity:0 + pointer-events:none` e falsavam a condição.
- **Convidar e Apoie como páginas reais** (v0.15.72): convertidos de card flutuante para páginas navegáveis via hash routing (#invite, #support). `renderInvitePage` em tournaments-sharing.js e `renderSupportPage` em store.js. Router atualizado com novos casos. Dashboard buttons apontam para hashes. `_showAppInviteQR` e `_showSupportModal` viram wrappers de compat que só fazem `window.location.hash = '#invite'/'#support'`.
- **#my-venues mapa único** (v0.15.50): o mapa interno menor do formulário (`#venue-owner-map`) foi removido — só sobra o mapa do topo (`#venue-owner-main-map`). Quando um venue é selecionado, `_focusOwnerMapOn` faz zoom 16 (street-level) no ponto e adiciona um pin vermelho 📌 (`_selectedPinMarker`). Ao cancelar, o pin é limpo. Evita duplicação visual observada na v0.15.49.
- **#my-venues com mapa + busca unificada** (v0.15.49): mapa no topo mostra todos os venues cadastrados como pins (âmbar=free, índigo=Pro). Dropdown de busca tem duas seções — "🏢 Já cadastrados no scoreplace" (match por nome/city/address, badge ✓ oficial ou 🤝 comunitário) + "📍 Sugestões do Google — novo cadastro". Clique em cadastrado → abre edit; clique em Google → novo cadastro. Evita duplicatas. Helpers novos: `_ensureOwnerMap`, `_renderOwnerMarkers`, `_loadRegisteredVenues`, `_addSectionHeader`, `_addRegisteredItem`, `_addGoogleItem`. Container id novo: `venue-owner-main-map` (distinto do `venue-owner-map` que aparece dentro do form).
- **#my-venues mais enxuto** (v0.15.48): removido header "🏢 Cadastre locais" + parágrafo explicativo. Rota entrega direto no input de busca + formulário; menos scroll no mobile.
- **Fix crítico venue cadastro** (v0.15.47): desde a v0.15.43 o cadastro de locais estava quebrado silenciosamente — Firestore rejeitava o payload com "Nested arrays are not supported" porque `openingHours.grid` era persistido como array 2D. Corrigido achatando para array flat de 168 posições (`day * 24 + hour`); UI continua trabalhando com matriz 2D em memória, conversão acontece só na borda de persistência via `_flattenGrid`/`_expandGrid`. Regra importante pra memória futura: **Firestore não aceita arrays aninhados em nenhum nível**, mesmo dentro de objetos.
- **Nova tagline** (v0.15.46): "Organize seus torneios" / "Gestão de torneios esportivos" → **"Jogue em outro nível"** em todos os pontos de branding (`<title>`, meta description, `manifest.json`, email footer, modal Sobre, landing PT/EN). Reflete os 5 pilares em vez de reduzir o posicionamento a "só torneios".
- **Apple Watch** (v0.15.39-41): controle remoto de placar via Shortcuts chegou e foi **revertido** na v0.15.42. Integração nativa fica para depois; o código foi removido completamente.
- **Venue cadastro v2** (v0.15.43): formulário reformulado — grade 7×24 de disponibilidade por dia/hora, quadras multi-sport, esportes sincronizados automaticamente em `sports[]`.
- **Venue discovery** (v0.15.1–15.10, 15.26, 15.28): mapa interativo com GPS, Google Places como pins do mapa, summary bar com raio ajustável, modal inline "Estou aqui" + auto plan dialog, busca dinâmica em my-venues, link "🏢 Local" do torneio para o venue.
- **Casual match polish** (v0.15.0, 15.20-21, 15.24, 15.31): Iniciar/Fechar sem loop, CTA "⚡ Partida Casual" no welcome card, "Avisar amigos scoreplace" 1-click, share result button, active casual match pill no dashboard.
- **Dashboard/Welcome** (v0.15.5-8, 15.15, 15.18, 15.23, 15.25, 15.29, 15.35): contadores corrigidos, welcome card para fresh users, profile completion nudge (com fix de falso positivo), "🏟️ Meus locais" quick-checkin widget, "Sua presença ativa" pill com countdown ao vivo, badge "HOJE/Amanhã/Em Xd" nos cards.
- **Profile** (v0.15.19, 15.32-34): esportes como pills, data de nascimento dd/mm/aaaa + altura alinhada, soak up provider data (Google/Apple), fix profile nudge.
- **Quick search/discovery** (v0.15.10): inclui torneios de discovery + venues.
- **Hints** (v0.15.22): cobertura de todas as features novas (venues, presence, casual, widgets).
- **Landing page** (v0.15.30): features cobrindo os 5 pilares.
- **Manual** (v0.15.12): seções Presença, Locais, 4 pilares, busca rápida.
- **Notification catalog** (v0.15.11): tipos faltantes + presence CTA.
- **Integração tournament ↔ presence ↔ venue** (v0.15.13, 15.16-17): check-in notifica amigos (📡) com throttle, "Adicionar à agenda" (Google/Outlook/.ics) em torneio e presence plan.
- **Compat cleanup** (v0.15.44): remoção de código defensivo (branches `if (legacy_shape)`, fallbacks pra shapes antigos) — regra formal de fase alpha documentada no CLAUDE.md.
- **Live score fix** (v0.15.45): placar ao vivo dispara tie-break em 5-5 consistente com a regra do torneio.
- **Quadras sem fricção + pills** (v0.15.51): botão "Cadastrar quadras" salva o venue automaticamente se necessário, sem estado desabilitado. Checkboxes de modalidade viram pills coloridas. Corrigido erro "Missing or insufficient permissions" movendo courts[] de subcoleção para array embedded no doc do venue.
- **#venues redesenhado** (v0.15.52): layout limpo — pills de modalidade > mapa edge-to-edge > campo de busca + GPS > lista (aparece só após GPS ou digitação). Filtros antigos removidos. Pills atualizam mapa + lista sem re-render completo.

**v0.14.x-alpha (Abril 2026) — Escala, Venues, Presença, Liga polish**
- **Escala (Firestore cost/performance)** (v0.14.54-59): denormalização de `memberEmails[]` em torneios, leituras escopadas ao usuário (phase A), discovery público paginado (phase B), searchUsers com range queries (phase C), scheduled cleanup (phase D), visitor mode sem public listener (phase E).
- **Venues module completo** (v0.14.65-69, 14.81-90):
  - Reivindicação + CRUD do proprietário (PR B1) — `venue-owner.js`.
  - View pública de descoberta #venues (PR B2).
  - Detalhe integra presenças + torneios (PR B3).
  - Mapa interativo com markers (PR B4).
  - Monetização Pro (PR B5).
  - Filtros de distância/esporte persistidos, GPS + pin do usuário + círculo do raio, Places strict, avaliações (estrelas + texto), CTA comunitário, cadastro comunitário com tags oficiais/cadastrado-por, modalidades alinhadas, Google fill.
- **Presença/check-in** (v0.14.62-64, 14.78): check-in + "quem está no local" (PR A1), config de perfil — visibilidade + silenciar (PR A3), auto check-in via Geolocation (PR A4), multi-sport num doc + hora saída opcional.
- **Integração A+B (fechamento de loops)** (v0.14.70): prefill venue, notify friends, deep-link (PR C1).
- **Liga/Suíço formatação** (v0.14.12-14, 14.19, 14.47-50): seu jogo acima da classificação, demais jogos colapsados, Suíço com rodadas concluídas como colunas de scroll + toggle Ocultar/Mostrar LIFO, Jogo N contínuo entre Suíço/Elim, classificação separando user matches de outros, Liga Rei/Rainha com draw aleatório.
- **Liga unification** (v0.14.61): Suíço removido do picker — consolidado em Liga.
- **Rei/Rainha** (v0.14.49): matches antes dos standings, sem coroa, tiebreak estendido.
- **Check-in card** (v0.14.1-3): 2 linhas no desktop (Jogo inline com nome, times sobem uma linha), botão "Assumir" na Lista de Espera para substituir W.O.
- **Lista de Espera** (v0.14.8-9, 14.35): unificada, badge "PRÓXIMO" removido, W.O. como toggle único.
- **Voltar universal** (v0.14.15-16, 14.19, 14.29): botão unificado em 10 call sites, overlay sweep agressivo, sticky Mostrar pill, fix landing mid-page, centralizado no modal criar/editar.
- **Modal criar/editar** (v0.14.26-29, 14.46): Descartar + Salvar sempre visíveis no topo, cabeçalho em linha única, botão Salvar Template, campos de Estimativas de Tempo numa linha só, toggle placement, sort fix, auto-draw auto-refresh.
- **Bracket** (v0.14.25, 14.30-31, 14.33): tie-break 5-5 + box de estimativas compacto, fix "RODADA -1" em dupla eliminatória com repescagem, botão QR Code removido dos cards, colored bar em todos round headers + BYE tag só em match real BYE.
- **Drag-drop** (v0.14.36): auto-scroll viewport ao arrastar perto do topo/base.
- **Painel de Revisão Final pulado** (v0.14.40): sorteio direto após resolução.
- **Co-host** (v0.14.41): "invite sent" notif marcada como lida quando aceita/rejeita.
- **Casual match/Live score** (v0.14.94-95): botões courtside-friendly (passo 1 mobile), haptic feedback + manifest PWA com shortcuts.
- **iOS install docs** (v0.14.98-99): tutorial expandido — rolar + navegação privada, cobrir tab bar compacto do iOS 17+.
- **Explore** (v0.14.75): cards de amigos compactos + ✕ no canto.
- **Venues "Cidade"→"Local"** (v0.14.82): aceita endereço completo como centro.

**v0.11.x-alpha (Abril 2026) — i18n wiring massivo (PT/EN)**
- Sistema i18n criado (`js/i18n.js`, `js/i18n-pt.js`, `js/i18n-en.js`) — helper global `window._t(key, vars)`.
- Wiring de strings hardcoded em ~15 arquivos JS ao longo de v0.11.35-60:
  - `auth.js` (~80 notificações), `create-tournament.js`, `bracket-ui.js`, `bracket.js`, `bracket-logic.js`.
  - `tournaments.js` (tourn.*), `tournaments-draw-prep.js` (25 notifications), `tournaments-draw.js`, `tournaments-enrollment.js`, `tournaments-organizer.js`, `tournaments-categories.js`.
  - `dashboard.js`, `participants.js`, `pre-draw.js`.
  - Dialog functions: `showAlertDialog/Confirm/Input`, `showNotification` completo.
  - Descriptive UI labels, textContent/innerText DOM assignments, confirmText/cancelText.
  - Duration estimate, access labels, inline HTML strings.
  - `_p2Resolution` e suggestion card labels.
- Resultado: zero hardcoded PT strings em `showNotification`. Toggle de idioma funcional em toda a interface.
- `v0.11.62-alpha`: stats rewrite, casual polish, Wake Lock API, explore sort.

**v0.10.x / v0.12.x / v0.13.x (Abril 2026)** — versões intermediárias focadas em bracket polish, Liga, stats, Pro features, emails. Detalhe no `git log`.

**v0.9.x-alpha (Abril 2026) — Dicas do App, Liga, fixes**
- **v0.9.0**: Dicas do App no manual + sistema de hints (`js/hints.js`) — balões contextuais guiando novos usuários.
- **v0.9.1**: Liga com duplas aleatórias a cada rodada.
- **v0.9.2-7**: bracket fixes — campos de placar sempre visíveis, Confirmar/Editar fluxo correto, `_editResultInline` fix, scroll imóvel ao confirmar.
- **v0.9.8**: fix cache-buster desatualizado do bracket-ui.js.
- **v0.9.9**: fix convites de co-organização + banner pulsante, fix tag `</script>` faltando no dashboard.js.

---

**v0.8.6-alpha (Abril 2026)**
- Auditoria de segurança e correções críticas:
  - CRITICAL: `uid` do usuário agora salvo no objeto participante ao se inscrever (corrige notificações de co-organização que não chegavam ao destinatário).
  - CRITICAL: Campo `level` adicionado ao payload de `_notifyByEmail` em host-transfer.js.
  - HIGH: Escaping de backslash adicionado antes do escaping de aspas em onclick handlers (host-transfer.js, tournaments.js) — previne XSS via nomes com backslash.
  - MEDIUM: Nomes de jogadores em atributos `data-player-name` agora sanitizados com `_safeHtml()` (tournaments.js, bracket.js).
  - Toggle switch adotado em todo o app: checkboxes e pill-buttons substituídos por componente `.toggle-switch` consistente em perfil, criação de torneio, check-in, enquetes e sorteio.
  - Dead code removido: `_toggleBtnHtml()` e `_toggleProfileBtn()` em auth.js.

**v0.8.5-alpha (Abril 2026)**
- Sistema de Organização (compartilhar/transferir):
  - Novo botão "👑 Organização" nas ferramentas do organizador (visível apenas para o criador).
  - Participant picker overlay (`_openOrgPickerDialog`): lista participantes elegíveis para compartilhar ou transferir organização.
  - Mostra status de convite pendente para participantes já convidados.
  - Transferência agora atualiza `t.creatorEmail` além de `organizerEmail`, garantindo privilégios completos ao novo organizador.
  - Todas as strings hardcoded em host-transfer.js conectadas ao sistema i18n (`_tH()`).
- i18n: ~35 novas chaves `org.*` para host-transfer/co-host em pt e en (organização, compartilhar, transferir, convites, aceite/recusa, erros).
- i18n wiring completo: explore.js, notifications-view.js, rules.js, tournaments-enrollment.js, tournaments-organizer.js — todas as strings hardcoded em português conectadas ao `_t()`.

**v0.8.4-alpha (Abril 2026)**
- i18n wiring para explore, notifications, rules, enrollment, organizer views.

**v0.8.3-alpha (Abril 2026)**
- Formulario de criacao reestruturado: formato do torneio separado em dois grupos de botoes excludentes.
  - Grupo 1 "Formato" (azul): Eliminatorias, Dupla Eliminatoria, Grupos + Elim., Suico, Liga.
  - Grupo 2 "Modo de Sorteio" (verde): Sorteio, Rei/Rainha. Rei/Rainha auto-escondido quando Grupos + Elim. selecionado.
  - Modo de Sorteio sincroniza com toggle interno de formato de rodada da Liga.
- Modo de Inscricao visivel: botoes Individual, Apenas Times, Misto (roxo) com descricao dinamica. Antes o "Individual" estava oculto no select hidden.
- Novo campo `t.drawMode` ('sorteio' ou 'rei_rainha') salvo no Firestore para extensibilidade futura.
- Funcoes: `_selectDrawMode(btn)`, `_selectEnrollMode(btn)`.
- i18n: 17 novas chaves (create.drawMode, create.descElim*, create.enrollMode*, create.gameType, etc.) em pt e en.
- Correcao: template restore para enrollment mode usava seletor `#enrollment-mode` inexistente, corrigido para `#select-inscricao`.

**v0.8.2-alpha (Abril 2026)**
- i18n abrangente: ~120 strings hardcoded em portugues conectadas ao sistema `_t()` em 8 arquivos JS (dashboard.js, tournaments.js, bracket.js, bracket-ui.js, participants.js, main.js, create-tournament.js, landing.js).
- ~170 novas chaves de traducao adicionadas a i18n-pt.js e i18n-en.js cobrindo: status, inscricao, ferramentas do organizador, bracket, resultados, participantes, favoritos, enquetes, ajuda, eventos, notificacoes, emails.
- Chaves dedicadas para labels de evento (event.enrollClose, event.tournamentStart, event.tournamentEnd) em vez de extrair por regex.

**v0.8.1-alpha (Abril 2026)**
- Perfil: dropdown de idioma substituido por icones de bandeira clicaveis (🇧🇷 🇺🇸) com estado ativo visual (borda dourada, glow, escala).
- Perfil: botao "Sair" no header substituido por "Cancelar" (fecha modal sem alterar).
- i18n: todas as strings hardcoded do formato Rei/Rainha conectadas ao sistema `_t()` em bracket.js, bracket-logic.js, create-tournament.js e tournaments-draw.js.
- Deploy automatico: git inicializado na pasta local com push direto via `gh` CLI. `.gitignore` adicionado. Fluxo manual de upload removido.
- Cleanup: residual `js/index.html` removido do repositorio.
- Testes: versao atualizada para 0.8.1-alpha (111 testes).

**v0.8.0-alpha (Abril 2026)**
- Formato Rei/Rainha da Praia: novo formato de torneio com grupos de 4 jogadores e parceiros rotativos (AB vs CD, AC vs BD, AD vs BC). Pontuacao individual. Top classificados avancam automaticamente para eliminatoria ate coroar o Rei/Rainha.
  - `_computeMonarchStandings(group)`: standings individuais por grupo (vitorias > saldo de pontos > pontos a favor).
  - `_generateReiRainhaRoundForPlayers(t, category)`: gera rodada com grupos de 4, 3 matches por grupo, remainder players recebem pairing padrao ou BYE.
  - Auto-avanco para eliminatoria quando todos os jogos de grupo estao completos (idempotente, sem botao manual).
  - Config na criacao: classificados por grupo (1 ou 2), sempre avanca para eliminatoria.
  - Matches com `isMonarch: true`, `team1`/`team2` arrays, `p1`/`p2` como labels de dupla.
- Liga com rodadas Rei/Rainha: Liga pode adotar formato de rodada Rei/Rainha.
  - Toggle "Padrao / Rei/Rainha" na criacao de torneio Liga (`t.ligaRoundFormat`).
  - `_generateNextRound` despacha para `_generateReiRainhaRoundForPlayers` quando `ligaRoundFormat === 'rei_rainha'`.
  - `_computeStandings` contabiliza matches monarca (team1/team2) com 3pts vitoria, 1pt empate, incluindo saldo de pontos individual.
  - Renderizacao de grupos Rei/Rainha dentro da classificacao Liga com mini-tabelas e match cards.
  - Rodadas anteriores exibem prefixo "Rei/Rainha" para rodadas com `format: 'rei_rainha'`.
- UI do Bracket melhorada:
  - Botao "Compartilhar" removido do header dos match cards.
  - Botoes "Confirmar" e "Editar" compactos no header do card de partida.
  - Scroll preservado ao lancar resultado (sem pulo de tela).
  - Header sticky do bracket posicionado abaixo da topbar (`top: 60px`).
  - `overflow-x: hidden` movido de `.view-container` para `body` para compatibilidade com sticky.
- i18n: chaves de traducao para Rei/Rainha em pt e en (format, bracket, stage, monarch, liga, labels).
- Testes: 111 testes automatizados (antes 94). Novas suites: `_computeMonarchStandings`, `_computeStandings` com monarch matches, `_generateReiRainhaRoundForPlayers`, idempotencia de advance.

**v0.4.12-alpha (Abril 2026)**
- Painel Unificado de Resolucao Numerica: os 3 paineis de decisao (times incompletos, numero impar, potencia de 2) foram consolidados em um unico painel com diagnostico completo.
  - Gauge visual mostra potencia inferior/atual/superior com contagem de participantes.
  - Cores Nash continuas verde-vermelho com maior distincao visual.
  - Botao X para excluir opcoes temporariamente e recalcular Nash.
  - Novas opcoes: Repescagem e Exclusao em todos os cenarios.
- Simplificacao de Esportes: apenas modalidades derivadas do tenis: Beach Tennis, Pickleball, Tenis, Tenis de Mesa, Padel. Icones de esporte limpos em todo o app.
- Formato como Botoes: dropdown de formato substituido por botoes excludentes com descricao dinamica.

**v0.4.5-alpha (Abril 2026)**
- Sorteio de times corrigido: verificacao de potencia de 2 agora conta times (nao participantes individuais). Paineis de decisao exibem contagem correta de times quando teamSize > 1.
- Botao Convidar sem restricoes: botao "Convidar" visivel e funcional para organizadores e participantes em qualquer estado do torneio.
- Botoes de acao apos sorteio: grid de acoes (Regras, Inscritos, QR Code, Imprimir, Exportar CSV, Modo TV). Layout 2 colunas no mobile.
- Iniciar Torneio no bracket: re-renderiza o bracket corretamente apos clique.

**v0.4.4-alpha (Abril 2026)**
- Paineis de Decisao com Equilibrio de Nash: paineis de potencia de 2 e times incompletos agora exibem indicador visual de equilibrio de Nash em cada opcao de resolucao.
  - Cores por temperatura de Nash: verde (melhor equilibrio, >=80%) â amarelo (>=60%) â laranja (>=35%) â azul (menor equilibrio). Background, borda e glow variam proporcionalmente.
  - Badge "Nash X%" em cada botao mostra o score normalizado.
  - Painel de potencia de 2: layout 3x2 (Reabrir, BYE, Play-in, Lista de Espera, Suico, Enquete). Enquete ao lado do Formato Suico em vez de span 2 no rodape.
  - Painel de times incompletos: mesmo sistema de cores aplicado aos 5 botoes (Reabrir, Bots, Lista de Espera, Ajuste Manual, Enquete).
  - Legenda de cores no topo do grid de opcoes.
  - Score calculado com pesos: fairness 45%, inclusion 35%, effort 20%. Ajustes contextuais (ex: faltam <=2 inscritos aumenta score de Reabrir).
  - Badge "Recomendado" permanece na opcao com maior score (excluindo Enquete).

**v0.4.3-alpha (Abril 2026)**
- Auditoria Completa v2: revisao linha a linha de todos os 30 arquivos JS (~24.600 linhas). 68 issues identificadas e corrigidas (14 CRITICAL, 22 HIGH, 18 MEDIUM, 14 LOW).
- Seguranca (XSS): showNotification/showConfirmDialog/showAlertDialog/showInputDialog agora sanitizam titulo automaticamente via helper _safeText() interno em notifications.js. showNotification tambem sanitiza mensagem.
  - ~30 onclick/oninput handlers com IDs nao-escapados corrigidos em: bracket.js, bracket-ui.js, tournaments-draw-prep.js, tournaments-draw.js, tournaments-organizer.js, tournaments-categories.js, main.js, auth.js, pre-draw.js, create-tournament.js.
  - Dados da Google Places API (mainText, secondaryText, venue name/address) e OpenWeather API (description) sanitizados com _safeHtml() em create-tournament.js.
  - auth.js: displayName e photoUrl sanitizados na topbar.
  - Error messages de APIs sanitizadas antes de innerHTML.
- Bug fix: firebase-db.js:66 â substring matching (.includes) na verificacao de duplicata de inscricao substituido por comparacao exata (===) por email, displayName e uid.
- Bug fix: dashboard.js:113 â operador logico sem parenteses fazia torneios Liga encerrados mostrarem "Inscricoes Abertas". Corrigido com parenteses.
- Bug fix: auth.js:851-852 â race condition: flag _simulateLoginInProgress era limpa ANTES do setTimeout de auto-enroll. Reordenado.
- Bug fix: tournaments-categories.js â funcao window._groupEligibleCategories() estava ausente (perdida na refatoracao v0.4.2). Restaurada junto com _getCategoryGenderPrefix() e _nonExclusivePrefixes.
- Bug fix: participants.js:476 â variavel isVip usada antes da declaracao. Corrigido movendo logica de VIP para antes do uso.
- Bug fix: dashboard.js:412 â _isMe() usava .includes() para email (substring match). Corrigido para comparacao exata ===.
- Bug fix: tournaments.js:441 â isParticipating usava .includes() para email. Corrigido para comparacao exata por email/displayName/uid.
- Bug fix: dashboard.js:359 â displayName null causava crash em .split(). Adicionado null check.
- Bug fix: dashboard.js:179-182 â deteccao de times agora suporta formato objeto (p.participants array) alem do formato slash "name1/name2".
- Bug fix: create-tournament.js â booleanos GSM (tiebreakEnabled, superTiebreak, advantageRule) agora salvos explicitamente como string 'true'/'false' para consistencia.
- Bug fix: rules.js:58 â datas invalidas em historico de atividades agora tratadas graciosamente (isNaN check) em vez de exibir "Invalid Date".
- Memory leak fix: hints.js â event listeners nos botoes "Entendi"/"Desativar" agora usam {once:true}. Auto-dismiss timeout (clearTimeout) limpo ao descartar manualmente. Resize/scroll listeners removidos ao desativar hints, re-adicionados ao reativar.
- Memory leak fix: participants.js â onerror handler para avatar sempre presente (fallback para initials), nao apenas quando cache existe.
- Melhoria: notifications-view.js â seletor DOM fragil para dot de notificacao nao-lida substituido por classe CSS .notif-unread-dot.
- Melhoria: tournaments-categories.js â escaping completo (backslash + aspas) em nomes de categoria em onclick/data-cat handlers.
- Cleanup: store.js â fallback redundante em _themeOrder removido.

**v0.4.2-alpha (Abril 2026)**
- Refatoracao de tournaments.js: arquivo monolitico de 6.503 linhas dividido em 5 modulos focados.
  - tournaments.js (1.847 linhas): orquestrador principal, render de cards e detalhes do torneio.
  - tournaments-categories.js (1.710 linhas): sistema de categorias completo â gerenciador modal, merge/unmerge com drag-and-drop (desktop + touch), auto-assign por genero, notificacoes de categoria, _buildCategoryCountHtml, _buildTimeEstimation.
  - tournaments-enrollment.js (440 linhas): inscricao/desinscricao, adicionar participante/time, excluir torneio.
  - tournaments-draw-prep.js (2.144 linhas): preparacao de sorteio, enquetes (polls) com Nash, resolucao de times incompletos e potencia de 2.
  - tournaments-draw.js (878 linhas): geracao de chaves (single/double elim, grupos, suico), drag-and-drop de times, painel de revisao final.
  - Funcoes que usavam closure variable `container` atualizadas para usar `document.getElementById('view-container')`.
  - Novos modulos em IIFEs; funcoes publicas como `window.*`, helpers privados locais.
  - Ordem de carregamento no index.html: categories antes de tournaments.js, enrollment/draw-prep/draw depois.
- Auditoria de Seguranca Completa: ~25 vulnerabilidades XSS corrigidas em 8 arquivos JS. Todos os dados controlados por usuario (nomes de torneio, jogadores, times, categorias, formatos, locais) agora sanitizados com window._safeHtml() antes de injecao no DOM.
  - Arquivos corrigidos: bracket.js, bracket-ui.js, explore.js, pre-draw.js, notifications-view.js, auth.js, rules.js.
  - Padroes corrigidos: innerHTML com template literals, concatenacao de strings em onclick handlers, atributos title/value sem escape.
  - IDs em onclick handlers (uid, tournamentId, notifId) agora com escape de aspas e barras.
- Bug fix: firebase-db.js:175 usava `fromUid` ao inves de `toUid` ao verificar pedidos de amizade mutuos em `sendFriendRequest()` â buscava documento do remetente em vez do destinatario.
- Bug fix: dashboard.js:8 truthy check em `sorteioRealizado` â arrays vazios `[]` eram avaliados como truthy. Corrigido para usar `Array.isArray(x) && x.length > 0` (consistente com linha 111).
- Bug fix: dashboard.js:131 substring matching na deteccao de participante â `str.includes(user.email)` podia dar falso positivo (ex: "john@example.com" matchava "johnsmith@example.com"). Corrigido para comparacao exata por email, uid e displayName.
- Bug fix: bracket-ui.js:396 tiebreak com pontos iguais nao era tratado â quando tbP1 === tbP2 nenhum jogador recebia o game extra. Agora valida margem minima (tiebreakMargin) e pontuacao minima (tiebreakPoints) antes de atribuir vencedor do tiebreak.
- CSS: removidos blocos de temas mortos (high-contrast, alternative) de components.css. Adicionados overrides de hint-balloon-text e hint-balloon-got-it para temas sunset e ocean.

**v0.4.1-alpha (Abril 2026)**
- Sistema Game-Set-Match (GSM): sistema completo de pontuacao por sets/games/tiebreaks para torneios de raquete e similares.
  - Configuracao na criacao/edicao do torneio: secao "Sistema de Pontuacao" com botao "Configurar" abre modal GSM completo.
  - Tipos: "Simples" (placar numerico padrao) e "Game Set Match" (sets com games).
  - Opcoes configuraveis: sets para vencer (1-5), games por set, tipo de contagem (numerica 1-2-3 ou tenis 15-30-40), regra de vantagem (deuce/advantage), tiebreak (pontos e margem), super tiebreak (set decisivo com 10 pontos).
  - Padroes por esporte: Beach Tennis (1 set, 6 games), Tenis (2 sets), Padel (2 sets), Pickleball (1 set, 11 games), Tenis de Mesa (3 sets, 11 games), Volei (2 sets, 25 games). Objeto `window._sportScoringDefaults`.
  - Preferencias do usuario salvas por esporte em localStorage (`scoreplace_gsm_prefs`). Auto-aplicadas ao selecionar esporte.
  - Dados salvos no torneio: `t.scoring` com type, setsToWin, gamesPerSet, tiebreakEnabled, tiebreakPoints, tiebreakMargin, superTiebreak, superTiebreakPoints, countingType, advantageRule.
  - Bracket: botao "Lancar Sets" substitui inputs de placar simples quando torneio usa GSM. Overlay dedicado para entrada set a set com validacao em tempo real.
  - Dados da partida: `m.sets[]` com gamesP1, gamesP2, tiebreak {pointsP1, pointsP2}. Campos m.setsWonP1, m.setsWonP2.
  - Display: sets formatados como "6-4 3-6 7-6(5)" nos cards de partida e badge do vencedor.
  - Funcoes: `_openSetScoring(tId, matchId)`, `_checkSetComplete(tId, matchId, setIndex)`, `_saveSetResult(tId, matchId)`, `_openGSMConfig()`, `_gsmSetType()`, `_gsmSetCounting()`, `_gsmToggleTiebreak()`, `_gsmToggleSuperTb()`, `_gsmUpdateSummary()`, `_gsmSaveConfig()`.
  - Desempate GSM na classificacao (Liga/Suico): novos criterios automaticos quando torneio usa sets â saldo_sets, saldo_games, sets_vencidos, games_vencidos, tiebreaks_vencidos. Campos acumulados em _computeStandings: setsWon, setsLost, gamesWon, gamesLost, tiebreaksWon.
  - Tabela de classificacao: colunas extras "Â±S" (saldo de sets) e "Â±G" (saldo de games) quando torneio usa GSM. Colunas clicaveis para ordenacao.

**v0.4.0-alpha (Abril 2026)**
- Auditoria Completa e Correcao de Bugs: revisao linha a linha de todo o codebase (~34 bugs identificados e corrigidos em 3 ondas).
  - Bug fix: "Reabrir Inscricao" nao funcionava â usava `delete t.status` (undefined). Corrigido para `t.status = 'open'` com guard contra reabrir apos sorteio.
  - Bug fix: Race condition de inscricoes durante tela de decisao â inscricoes agora suspensas (`t._suspendedByPanel = true`) ao abrir painel de potencia de 2, restauradas no cancelamento.
  - Bug fix: Operador logico sem parenteses â `|| ligaAberta` sobrescrevia status closed/active. Corrigido com parenteses em todas as 3 ocorrencias.
  - Bug fix: `_handleSortearClick` faz await no Firestore save antes de navegar para pre-draw.
  - Bug fix: `_computeStandings` nao inicializava campo `draws: 0` no scoreMap.
  - Bug fix: `_maybeFinishElimination` retorna early durante fase de grupos (`t.currentStage === 'groups'`).
  - Bug fix: Modo TV valida existencia do torneio antes de renderizar.
  - Bug fix: XSS em notifications-view.js e explore.js â uid escapado em onclick handlers.
  - Bug fix: enroll-modal.js reescrito â removido botao "Quero Participar" nao-funcional, share link dinamico com ID do torneio, WhatsApp share funcional.
  - Bug fix: result-modal.js marcado como deprecated (dead code â resultados salvos via bracket-ui.js).
  - Bug fix: "Encerrar Torneio" oculto para formato Liga.
  - Bug fix: `sorteioRealizado` nao exigia mais `t.status === 'active'`.
- Novos Temas: 4 temas disponiveis â Noturno (dark), Claro (light), Por do Sol (sunset), Oceano (ocean).
  - Ciclo de temas via botao no header: dark â light â sunset â ocean.
  - CSS variables por tema em style.css para componentes: --btn-secondary-bg/text/hover, --btn-danger-ghost-text/bg, --info-pill-bg, --info-box-bg, --stat-box-bg, --card-org-border, --card-part-border.
  - Dashboard cards com gradientes adaptativos por tema. Tema claro com texto escuro e bordas sutis.
  - components.css refatorado para usar variaveis CSS em vez de cores hardcoded.
  - theme.js atualizado para reconhecer os 4 temas.
  - store.js: `_themeOrder`, `_themeIcons`, `_themeNames` para ciclo de temas.

**v0.3.18-alpha (Abril 2026)**
- DuraÃ§Ã£o Estimada do Torneio: quando endDate nÃ£o estÃ¡ preenchida, a pÃ¡gina de detalhes exibe box "â±ï¸ DuraÃ§Ã£o Estimada" com simulaÃ§Ãµes para 8, 16, 32 e 64 participantes. Se houver inscritos (2+), mostra tambÃ©m linha destacada com o nÃºmero real. CÃ¡lculo por formato: EliminatÃ³rias (por rodadas paralelas), Dupla EliminatÃ³ria (~2x simples), Grupos + EliminatÃ³rias (round-robin + mata-mata), SuÃ­Ã§o (rounds * pairings), Liga (total combinaÃ§Ãµes). Considera gameDuration, courtCount, callTime e warmupTime do torneio. Mostra nÃºmero de partidas e horÃ¡rio estimado de tÃ©rmino quando startDate inclui hora. Posicionado entre datas e local nos detalhes do torneio. FunÃ§Ã£o global window._buildTimeEstimation(t) em tournaments.js.

**v0.3.5-alpha (Abril 2026)**
- Consistencia Visual Total: Todos os botoes agora 100% solidos e coloridos (sem cinza). btn-outline, btn-ghost, btn-tool, btn-secondary convertidos de cinza para azul escuro (#1e3a5f). btn-danger-ghost mantido transparente (Add Bot + Apagar).
- Topbar: Botoes Apoie, Pro e Organizador padronizados como .btn solidos. Botao Visao simplificado: "Organizador"/"Participante" (sem "Visao:").
- Ferramentas do Organizador reordenadas: Ver Chaves, Editar, Comunicar, +Participantes, +Times, Add Bot, Exportar CSV, Clonar, Categorias, Encerrar Inscricoes, Sortear, Encerrar Torneio, Apagar.
- Info-pill/info-box/stat-box com opacidade aumentada (rgba 0.28 vs 0.15) para melhor legibilidade.

**v0.3.4-alpha (Abril 2026)**
- Novo sistema de classes CSS: .info-pill (badges de status com borda lateral colorida e fundo rgba, variantes: info-pill-green/red/amber/blue/purple), .info-box (agrupamento de detalhes como formato/acesso/categorias), .stat-box (caixas de estatisticas inscritos/equipes).
- Aplicacao consistente em tournaments.js (detalhes do torneio) e dashboard.js (cards): stat-box para inscritos/equipes, info-box para formato/acesso/categorias e barra de progresso, info-pill para countdowns (Comeca hoje, Inscricoes encerram em X dias, etc).

**v0.3.3-alpha (Abril 2026)**
- Padronizacao Visual de Botoes: Sistema unificado de classes CSS reutilizaveis em components.css. Mais de 200 botoes padronizados em 10+ arquivos JS (tournaments.js, bracket.js, dashboard.js, auth.js, main.js, participants.js, explore.js, pre-draw.js, notifications.js).
- Classes novas: btn-primary, btn-success, btn-warning, btn-danger, btn-purple, btn-indigo, btn-cyan, btn-whatsapp, btn-amber para cores solidas. btn-outline, btn-ghost, btn-danger-ghost para variantes transparentes. btn-tool, btn-tool-green, btn-tool-purple, btn-tool-indigo, btn-tool-amber para toolbar do organizador. btn-sm, btn-lg, btn-cta, btn-micro, btn-pill, btn-block para tamanhos.
- hover-lift implementado no CSS (translateY(-1px) + box-shadow no hover).
- Padrao: border-radius 10px, font-size 0.82rem, padding 8px 16px, font-weight 600 para todos os botoes.
- Excecoes: Add Bot e Apagar Torneio mantem transparencia (btn-danger-ghost).
- Fix de escopo: isAutoDrawFormat movido para fora do bloco if(isOrg). sortearOnClick duplicado removido.

**v0.3.1-alpha (Marco 2026)**
- Layout do card de torneio: Botao Convidar logo abaixo do nome (esquerda). Botoes de organizador (Add Bot, CSV, Clonar, Editar, Comunicar) movidos para rodape do card separados por titulo "Ferramentas do Organizador".
- Modo TV redesenhado: Hero com foto do local de fundo, nome grande, detalhes do torneio, relogio. Secao "Proximos Jogos" com cards dos confrontos pendentes e indicador de presenca. Secao "Aguardando Presenca" com contagem. Bracket/standings abaixo.
- CSV export: Cabecalho horizontal (Torneio, Formato, Esporte, Data, Local, Inscritos) em uma linha para melhor visualizacao em paisagem.

**v0.3.2-alpha (Marco 2026)**
- Countdown legibilidade: Textos "ComeÃ§a em X dias" e "InscriÃ§Ãµes encerram em X dias" nos cards do dashboard com fonte maior (0.85rem), fundo colorido pill-style e cores de alto contraste para fundos escuros.
- Ferramentas do Organizador consolidadas: Botoes Ver Chaves, Encerrar Torneio e Apagar Torneio movidos para a secao "Ferramentas do Organizador" no rodape do card de detalhes. Todos os botoes com backgrounds mais opacos, bordas mais visiveis, padding maior.
- Zoom slider no bracket: Barra deslizante (range input) entre botoes -/+ para controle fluido do zoom. Slider sincroniza com botoes e reset.
- Topbar estavel no desktop: flex-wrap nowrap + overflow hidden para eliminar jitter de altura ao redimensionar janela.

**v0.3.0-alpha (Marco 2026)**
- Auto-inscricao por convite: Pessoa clica no link de convite, faz login e ja fica inscrita automaticamente no torneio + amizade com quem convidou. Sem cliques extras.
- Nunca mais tela branca: Torneio excluido redireciona ao dashboard com aviso. Exclusao de conta redireciona ao dashboard. Safety net global de 5s contra tela em branco.
- Botao Inscrever-se/Desinscrever-se reposicionado logo abaixo do status de inscricoes, alinhado a direita.
- QR Code modal: Botao fechar maior e visivel (fundo branco, 40px). Overlay com padding mobile.
- Convidar Amigos: Botao sempre visivel no modal de convite, mesmo sem amigos (mostra mensagem orientativa).
- Topbar desktop: overflow visivel, min-height em vez de height fixa, flex-wrap para nao truncar botoes.
- Excluir conta simplificado: Sem popup de re-autenticacao. Exclui dados primeiro, depois tenta auth delete best-effort.
- Limpeza: ~30 console.logs removidos, URLs hardcoded substituidas por helpers globais.

**v0.2.42-alpha (Marco 2026)**
- Excluir conta: Opcao para usuario excluir permanentemente sua conta e todos os dados (perfil, notificacoes, inscricoes em torneios, torneios organizados). Disponivel no modal de perfil com dupla confirmacao (digitar "EXCLUIR"). Reautenticacao automatica se necessario. Conformidade LGPD.
- Botoes Apoie e Pro na dashboard: Adicionados ao hero box ao lado do "+Novo Torneio" para maior visibilidade. Botao Pro so aparece para usuarios Free.
- Cache-busters: Adicionados a todos os arquivos JS que estavam sem (notifications.js, ui.js, pre-draw.js, rules.js, result-modal.js, enroll-modal.js).
- Stripe secret key: Removida chave hardcoded do Cloud Functions. Agora usa defineSecret() do Firebase Functions v2 para STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.
- QR Code PIX centralizado no modal de apoio.

**v0.2.41-alpha (Marco 2026)**
- Monetizacao Fase 1: Modelo freemium implementado. Plano Free (ate 3 torneios ativos, 32 participantes, logo so gerada) e plano Pro (R$19,90/mes â ilimitado, upload logo, Modo TV sem marca). Sistema de planos no Firestore (campo plan/planExpiresAt no perfil). Feature gates em create-tournament.js e tournaments.js. Modal de upgrade Pro com beneficios e botao de checkout Stripe. Botao "Apoie" com PIX voluntario (QR code + copia-e-cola, chave CNPJ 51590996000173). Cloud Functions: createCheckoutSession, stripeWebhook (auto-ativa/desativa Pro), createDonationCheckout. Botoes Pro e Apoie na topbar.

**v0.2.40-alpha (Marco 2026)**
- Push Notifications (FCM) client-side: Firebase Messaging SDK adicionado (firebase-messaging-compat.js). Funcao window._initFCM() em notifications.js solicita permissao de notificacao no browser, obtem token FCM e salva no Firestore (campo fcmToken no perfil do usuario). Chamada automaticamente 3s apos login via simulateLoginSuccess. Service worker atualizado com importScripts do Firebase, onBackgroundMessage para exibir push em background, e notificationclick para abrir o app no torneio relevante. Token refresh automatico via onTokenRefresh. Mensagens foreground exibidas como toast via showNotification. Cloud Functions autoDraw e sendPushNotification ja deployados no Firebase completam o fluxo end-to-end.

**v0.2.39-alpha (Marco 2026)**
- Previsao do Tempo ativada: API key do OpenWeatherMap configurada em create-tournament.js. Ao criar/editar torneio com local (lat/lon) e data de inicio nos proximos 5 dias, exibe previsao automatica com icone, temperatura e descricao. Plano gratuito: 1000 chamadas/dia.

**v0.2.38-alpha (Marco 2026)**
- Paginacao no Dashboard: torneios carregam em lotes de 12 (PAGE_SIZE). Botao "Carregar mais (N restantes)" aparece quando ha mais de 12 torneios visiveis. Funciona com todos os filtros (Todos, Organizados, Participando, etc.) e com modo compacto. Paginacao reseta ao trocar filtro via window._dashPage. Variavel global window._dashPage controlada pelos filtros e botao.

**v0.2.37-alpha (Marco 2026)**
- Acessibilidade Basica (WCAG 2.1): link "Pular para o conteudo" no topo da pagina para navegacao por teclado. ARIA roles (application, main, banner, navigation, region, dialog) e aria-labels em todos os elementos interativos da topbar. aria-expanded no botao hamburger. Focus trap em modais â Tab circula dentro do modal aberto. Live region (aria-live="polite") para anunciar notificacoes e estados de modais a leitores de tela. Funcoes globais: window._trapFocus(el), window._releaseFocusTrap(el), window._announce(msg). Intercepta openModal/closeModal e showNotification para adicionar comportamento acessivel automaticamente.

**v0.2.36-alpha (Marco 2026)**
- Modo Compacto do Dashboard: toggle "Cards/Lista" no canto superior direito do dashboard. Modo cards (padrao) exibe cards com visual completo. Modo lista compacta mostra uma linha por torneio com: logo/icone, nome, esporte, formato, data, contagem de participantes, progresso (%), status e badge de organizador. Preferencia salva em localStorage (scoreplace_dashView). Funcao window._setDashView(view) e _buildCompactList(items) em dashboard.js.

**v0.2.35-alpha (Marco 2026)**
- Atalhos de Teclado Globais: navegacao rapida pelo teclado. D=Dashboard, E=Explorar Torneios, N=Novo Torneio, /=Busca Rapida, ?=Ajuda, ESC=Fechar modal. Atalhos desativados automaticamente quando um campo de texto esta focado ou quando modais estao abertos. Nova secao "â¨ï¸ Atalhos de Teclado" no modal de Ajuda com listagem visual dos atalhos. Funcao setupGlobalShortcuts() em main.js.

**v0.2.34-alpha (Marco 2026)**
- Historico de Atividades: secao "ð Historico de Atividades" na pagina de detalhes do torneio. Log visual cronologico com: criacao do torneio, inscricoes de jogadores, encerramento de inscricoes, sorteio realizado, inicio do torneio, resultados de partidas e encerramento. Collapsible via <details>, mostra ultimos 15 eventos com opcao de expandir anteriores. Construido dinamicamente dos dados existentes do torneio (nao requer collection extra no Firestore). Funcao window._buildActivityLog(tournamentId).

**v0.2.33-alpha (Marco 2026)**
- Estatisticas do Jogador: clicar no nome de qualquer jogador abre modal com estatisticas consolidadas em todos os torneios. Exibe: torneios disputados, vitorias, derrotas, empates, total de partidas, % de aproveitamento, titulos e podios. Lista de torneios disputados com links clicaveis. Nomes clicaveis no chaveamento (bracket.js), classificacao (standings) e lista de inscritos (participants.js). Funcao global window._showPlayerStats(playerName, currentTournamentId).

**v0.2.32-alpha (Marco 2026)**
- QR Code do Torneio: botao "ð± QR Code" na pagina de detalhes do torneio e no chaveamento. Abre modal com QR code gerado via API (api.qrserver.com) contendo o link do torneio. Modal com opcoes: copiar link, baixar imagem PNG e imprimir em pagina dedicada. Suporta tema claro/escuro (QR code adapta cores). Funcoes: window._showQRCode(tId), window._downloadQRCode(tId), window._printQRCode(). Ideal para projetar em eventos presenciais.

**v0.2.31-alpha (Marco 2026)**
- Busca Rapida Global (Ctrl+K): modal de busca acessivel via Ctrl+K / Cmd+K ou botao no header. Busca torneios por nome, esporte, formato e local, e jogadores em todos os torneios. Acoes rapidas padrao: Novo Torneio, Dashboard, Explorar, Notificacoes, Ajuda. Input com debounce de 150ms. ESC para fechar. Overlay escuro com animacao. Funcoes: window._openQuickSearch(), window._closeQuickSearch(), window._performQuickSearch(query), window._showQuickSearchDefaults().

**v0.2.30-alpha (Marco 2026)**
- Torneios Encerrados separados: no dashboard, quando filtro "Todos" esta ativo e ha torneios encerrados, estes sao agrupados em secao colapsavel "Torneios Encerrados (N)" via <details> abaixo dos torneios ativos. Novo filtro "Encerrados" no painel de filtros do hero box (aparece quando ha ao menos 1 encerrado).

**v0.2.29-alpha (Marco 2026)**
- Compartilhar Resultado: botao "ð¤ Compartilhar" em cada card de partida concluida no chaveamento. Usa navigator.share() no mobile com fallback para clipboard. Texto formatado com jogadores, placar, resultado e link do torneio. Funcao window._shareMatchResult(tId, matchId). Busca a partida em todas as estruturas (matches, rounds, groups, rodadas).

**v0.2.28-alpha (Marco 2026)**
- Tema Claro/Escuro: botao ð/âï¸ no header da topbar para alternar entre tema escuro e claro. Usa data-theme="light" no <html>. Preferencia salva em localStorage (scoreplace_theme). CSS ja tinha variaveis para light theme em style.css â agora ativado via toggle. Overrides CSS em style.css para cards, hero-box, badges e topbar no tema claro. Transicao suave de 300ms. Funcao window._toggleTheme() em store.js. Auto-apply do tema salvo no carregamento.

**v0.2.27-alpha (Marco 2026)**
- Countdown de Inicio: torneios com startDate futura mostram contagem regressiva nos cards do dashboard e na pagina de detalhes. "Comeca hoje!" (verde, 0 dias), "Comeca amanha!" (verde, 1 dia), "Comeca em X dias" (azul/roxo, ate 30 dias). Complementa o countdown de inscricoes existente.

**v0.2.26-alpha (Marco 2026)**
- Navegacao Suave: scroll automatico para o topo ao navegar entre views (window.scrollTo smooth) e animacao fade-in (opacity 0â1 em 250ms) no container da view. Implementado no router.js via requestAnimationFrame duplo para garantir transicao CSS.

**v0.2.25-alpha (Marco 2026)**
- Confrontos Diretos (Head-to-Head): secao expansivel "Confrontos Diretos" abaixo da classificacao em Liga/Suico. Matriz NxN mostrando retrospecto entre cada par de jogadores no formato V-E-D (Vitorias-Empates-Derrotas). Celulas coloridas: verde para vantagem, vermelho para desvantagem, cinza para empate. Nomes verticais nos cabecalhos de coluna. Suporta categorias (uma tabela por categoria). Tooltip com detalhes. Limitada a 2-20 jogadores por categoria.

**v0.2.24-alpha (Marco 2026)**
- Ordenacao de Colunas: cabecalhos da tabela de classificacao (Liga/Suico) sao clicaveis para ordenar por qualquer coluna. Setas indicadoras (â²/â¼/â) mostram direcao ativa. Suporta ordenacao numerica (pontos, vitorias, saldo, etc.) e textual (nome do participante). Funcao window._sortStandingsTable(thElement) manipula o DOM diretamente sem re-render. Funciona em todas as categorias.

**v0.2.23-alpha (Marco 2026)**
- Modo TV (Placar ao Vivo): botao "ðº Modo TV" na pagina do chaveamento/classificacao. Abre overlay fullscreen (Fullscreen API) otimizado para projetores/TVs no local do torneio. Fundo escuro (#0a0e1a), relogio em tempo real, barra de progresso, auto-refresh a cada 30s que re-renderiza o bracket e atualiza o conteudo. CSS inline para tabelas e bracket com tema escuro. Sair com ESC, botao Sair, ou saindo do fullscreen. Funcoes: window._tvMode(tId), window._exitTvMode().

**v0.2.22-alpha (Marco 2026)**
- Favoritar Torneios: estrela (â/â) nos cards do dashboard e na pagina de detalhes do torneio. Favoritos salvos em localStorage por usuario (chave scoreplace_favorites_email). Helpers globais: window._getFavorites(), window._isFavorite(tId), window._toggleFavorite(tId, event). Filtro "Favoritos" no dashboard aparece quando ha ao menos 1 favorito. Estrelas atualizam em tempo real sem re-render da pagina via querySelectorAll('[data-fav-id]').

**v0.2.21-alpha (Marco 2026)**
- Imprimir Chaveamento: botao "Imprimir" na pagina do bracket/classificacao. CSS @media print completo com fundo branco, tabelas com bordas visiveis, avatares ocultados, badges com borda, orientacao paisagem automatica (@page landscape). Classe .no-print para ocultar elementos na impressao. Funcao window._printBracket().

**v0.2.20-alpha (Marco 2026)**
- Testes Automatizados: arquivo tests.html com 21 testes unitarios cobrindo funcoes core. Framework de testes minimalista (describe/it/expect) sem dependencias externas. Testes cobrem: _safeHtml, _isLigaFormat, _getTournamentProgress, _computeStandings, _calcNextDrawDate, _shareTournament, _exportTournamentCSV, _cloneTournament, SCOREPLACE_VERSION. Pode ser rodado no browser (tests.html) ou via Node.js.
- _isLigaFormat global: definicao movida para o topo de tournaments.js (fora do escopo de renderTournaments) para que esteja disponivel imediatamente no carregamento do script. Usa padrao `window._isLigaFormat = window._isLigaFormat || function(){}` para nao sobrescrever se ja definido.

**v0.2.19-alpha (Marco 2026)**
- Confrontos do Jogador: clicar no nome de um jogador na tabela de classificacao (Liga/Suico) abre popup com historico completo de partidas â adversario, placar, resultado (V/E/D) e resumo. Funcao window._showPlayerHistory(tId, playerName). Usa showAlertDialog para exibir tabela formatada.
- Notificacao de Resultado: ao salvar resultado de partida via _saveResultInline, ambos os jogadores recebem notificacao automatica via _sendUserNotification (tipo 'result', level 'all'). Requer que participante tenha uid no objeto de participante.
- Ultima Atualizacao: torneios agora registram t.updatedAt (ISO string) a cada syncImmediate. Exibido na pagina de detalhes do torneio como "Atualizado em DD/MM/AAAA as HH:MM".

**v0.2.18-alpha (Marco 2026)**
- Rodadas Anteriores: na classificacao de Liga e Suico, secao expansivel "Rodadas Anteriores" mostra todas as rodadas passadas com resultados compactos de cada partida (jogador1 x jogador2, placar, vencedor). Usa elemento <details> para nao poluir a tela. Rodadas listadas da mais recente para a mais antiga.
- Estatisticas do Torneio: resumo visual com destaques automaticos a partir da 2a rodada. Mostra: jogador com mais vitorias (icone raio), maior sequencia de vitorias consecutivas (icone fogo, minimo 2), e total de partidas disputadas com contagem de empates. Dados calculados em tempo real a partir de _computeStandings e historico de rodadas.

**v0.2.17-alpha (Marco 2026)**
- Exportar Resultados CSV: botao "Exportar CSV" na pagina do torneio e no chaveamento. Gera arquivo CSV com classificacao (Liga/Suico: posicao, pontos, V/E/D, saldo, jogos) ou resultados das partidas (Eliminatorias: jogador 1, jogador 2, placar, vencedor, fase). BOM UTF-8 para compatibilidade com Excel. Funcao global window._exportTournamentCSV(tId).
- Clonar Torneio: botao "Clonar" na pagina de detalhes cria copia do torneio com mesmas configuracoes (formato, local, categorias, regras, modo de inscricao) mas sem participantes, resultados ou sorteio. Redireciona para o novo torneio apos criacao. Funcao global window._cloneTournament(tId).

**v0.2.16-alpha (Marco 2026)**
- Compartilhar Torneio: botao "Compartilhar" na pagina de detalhes, visivel para todos os usuarios (nao apenas organizador). Usa navigator.share() nativo no mobile com fallback para clipboard.
- Progresso do Torneio: barra de progresso visual mostrando % de partidas concluidas. Aparece nos cards do dashboard e na pagina de detalhes apos o sorteio. Helper global window._getTournamentProgress(t) conta partidas de todas as estruturas (matches, rounds, groups, rodadas, thirdPlaceMatch).
- Countdown de Inscricoes: aviso "Inscricoes encerram em X dias" nos cards e na pagina do torneio quando o prazo esta proximo (ate 14 dias). Cor urgente para prazos <= 2 dias (vermelho), <= 5 dias (amarelo).

**v0.2.15-alpha (Marco 2026)**
- Proximas Partidas: dashboard exibe widget "Suas Proximas Partidas" com partidas pendentes do usuario (sem resultado) em torneios ativos. Mostra oponente, torneio, esporte e link direto. Max 5 visiveis.
- Indicador offline/online: banner fixo no rodape quando perde conexao ("Sem conexao â modo offline") e feedback quando reconecta ("Conexao restaurada"). Complemento do PWA.
- Error logging melhorado: catch silencioso em store.js._loadFromCache agora faz console.warn para facilitar debug.

**v0.2.14-alpha (Marco 2026)**
- Filtro de torneios: barra de busca por nome/esporte/formato + dropdown de status (Todos, InscriÃ§Ãµes Abertas, Em Andamento, Encerrados) na lista de torneios. Aparece quando ha mais de 3 torneios. Filtragem instantanea por texto e status.

**v0.2.13-alpha (Marco 2026)**
- PWA: manifest.json, service worker (sw.js) com stale-while-revalidate para assets estaticos e network-only para Firebase/APIs. Icones SVG em icons/. Meta tags apple-mobile-web-app. Registro do SW em index.html.
- Historico de Torneios no perfil: lista dos ultimos 8 torneios com posicao final, formato, status e link direto. Funcao _populatePlayerStats expandida com calculo de posicao para Eliminatorias (final + 3o lugar) e Liga/Suico (standings).

**v0.2.12-alpha (Marco 2026)**
- Encerramento automatico de temporada Liga: quando ligaSeasonMonths expira (startDate + N meses), o torneio e automaticamente marcado como finished com standings finais. Detectado tanto no dashboard quanto nos detalhes do torneio. Exibe aviso visual "X dias restantes" quando faltam 7 dias ou menos.
- XSS fix participants.js: nomes de participantes agora sanitizados antes de injecao no HTML (previne ataques via nomes maliciosos).
- Utilitario global window._safeHtml() em store.js para escape de HTML reutilizavel.

**v0.2.11-alpha (Marco 2026)**
- Meu Desempenho: perfil do jogador agora exibe estatisticas pessoais â torneios participados, partidas jogadas, vitorias, derrotas, empates, aproveitamento (%) e titulos conquistados. Dados calculados em tempo real a partir de todos os torneios. Funcao _populatePlayerStats() em auth.js.

**v0.2.10-alpha (Marco 2026)**
- Validacao de datas: criar/editar torneio agora valida que data fim > data inicio e prazo inscricao < data inicio.
- Auto-enrollment feedback: se inscricao automatica apos login falhar por timeout, usuario recebe aviso para tentar manualmente.
- Migracao Liga/Ranking: ao salvar torneio Liga, campos legados ranking* sao limpos (setados null) no Firestore.

**v0.2.9-alpha (Marco 2026)**
- Fase de Grupos empates: cross-seeding e classificacao agora contabilizam empates corretamente (1pt cada) em vez de tratar winner='draw' como nome de jogador.
- Dupla Eliminatoria: removido dead code (mergeCount nao utilizado) na geracao do lower bracket.
- Notificacoes XSS fix: mensagens sanitizadas com escape de HTML. Botao "Ver Torneio" adicionado em notificacoes de convite de torneio.
- Delete tournament: notificacao de erro melhorada quando exclusao no Firestore falha.

**v0.2.8-alpha (Marco 2026)**
- Botao Encerrar Torneio: organizador pode encerrar qualquer torneio manualmente via botao na pagina de detalhes. Confirmacao com aviso de partidas pendentes. Seta status='finished'.
- Podio/classificacao final: torneios encerrados exibem podio visual com medalhas (ouro, prata, bronze). Eliminatorias mostram campeao, vice e 3o lugar. Suico/Liga mostram top 3 por pontos da tabela standings.
- _computeStandings exposta globalmente (window._computeStandings) para uso em finishTournament.

**v0.2.7-alpha (Marco 2026)**
- Encerramento automatico de torneio: Eliminatorias e Dupla Eliminatoria marcam status='finished' automaticamente quando todas as partidas sao concluidas (incluindo disputa de 3o lugar). Notificacao de campeao exibida.
- Status padronizado: 'finished' e o status unico para torneios encerrados em todo o app. Dashboard e tournaments.js reconhecem e exibem "Encerrado" com icone de trofeu.
- Dashboard truthy fix: sorteioRealizado no dashboard agora usa Array.isArray(x) && x.length > 0 em vez de truthy check direto.
- Inscricoes bloqueadas em torneios encerrados: tentativa de inscricao em torneio finished mostra alerta "Torneio Encerrado".
- Liga format no dashboard: usa _isLigaFormat() para consistencia com unificacao Liga/Ranking.

**v0.2.6-alpha (Marco 2026)**
- UNIFICACAO Liga/Ranking: formatos unificados em "Liga" unico. Campos de temporada, inatividade, pontuacao de novos jogadores agora todos sob liga-*. Torneios existentes com format='Ranking' continuam funcionando via helper _isLigaFormat().
- Empate em Liga/Suico: empates permitidos (1pt cada). Coluna "E" na classificacao. Buchholz e Sonneborn-Berger corrigidos para empates.
- Eliminatorias com categorias: chaveamento separado por categoria.
- Protecao contra re-sorteio: confirmacao obrigatoria.
- Validacao pre-sorteio: identifica participantes sem categoria.
- Botao Reportar Problema no manual.

**v0.2.5-alpha (Marco 2026)**
- Protecao contra re-sorteio: confirmacao obrigatoria antes de refazer sorteio. Aviso critico se ja houver resultados, aviso leve se so houver partidas sem resultado.
- Eliminatorias com categorias: chaveamento separado por categoria (Masc, Fem, Misto etc). Cada categoria tem bracket independente com BYEs e VIPs proprios.
- Validacao pre-sorteio: identifica participantes sem categoria atribuida e avisa organizador antes do sorteio.
- Edicao de torneio: removido dead code de btn-create-tournament (27 linhas). Comentario sobre rankingOpenEnrollment.
- Botao Reportar Problema no manual (Sobre) com mailto pre-preenchido.

**v0.2.4-alpha (Marco 2026)**
- Auto-inscricao com categorias: ao aceitar convite, participante e inscrito na categoria correta com base no genero do perfil. Organizador recebe notificacao.
- Cancelar inscricao seguro: corrigido bug de substring match que podia remover participante errado (ex: "Ana" removendo "Ana Paula"). Agora usa comparacao exata.
- Criar torneio â limpeza: removida referencia a campo liga-periodicity que nao existia mais no HTML, eliminando erros silenciosos.
- Typo fix: "neste torneos?" corrigido para "neste torneio?"

**v0.2.3-alpha (Marco 2026)**
- Deteccao de mesclagem aprimorada: icone de desmesclar aparece em qualquer categoria mesclada (por "/", prefixo puro, ou mergeHistory). Unmerge inferido via `_executeInferredUnmerge` para categorias sem historico.
- Cache-buster por versao: todos os arquivos JS/CSS em index.html usam `?v=0.2.3-alpha` em vez de numeracao sequencial.

**v0.2.2-alpha (Marco 2026)**
- Enquete entre participantes (Poll System):
  - Nova opcao nos paineis de times incompletos e potencia de 2
  - Organizador seleciona opcoes, define prazo (padrao 48h), e cria enquete
  - Recomendacao por equilibrio de Nash (ponderacao: justica 45%, inclusao 35%, praticidade 20%)
  - Votacao: antes de votar, participante ve apenas descricoes; apos voto, ve contagem e percentuais
  - Participante pode mudar voto ate o encerramento
  - Contagem regressiva ao vivo (h/m/s) com auto-encerramento
  - Notificacao automatica aos participantes ao acessar o torneio
  - Banner na pagina do torneio (ativo: votos/total + tempo + status; encerrado: resultado + botao aplicar)
  - Organizador aplica resultado com um clique, executando a acao vencedora
  - Dados: `t.polls[]`, `t.activePollId`, `t.pollNotifications[]`
  - Funcoes: `_showPollCreationDialog`, `_showPollVotingDialog`, `_castPollVote`, `_checkPollNotifications`, `_renderPollBanner`, `_renderClosedPollBanner`, `_applyPollResult`, `_computeNashRecommendation`
- Desmesclar categorias:
  - Icone de desmesclagem no canto superior direito de categorias mescladas
  - `mergeHistory[]` salvo em `_executeMerge` para suportar desfazimento
  - `_unmergeCategoryAction` + `_executeUnmerge`: restaura categorias originais e reatribui participantes
- Remover participante da categoria:
  - Botao X em cada card de jogador na view de detalhe da categoria
  - `_removeParticipantFromCategory` + `_executeRemoveFromCategory`: remove da categoria, marca como sem-categoria
- `_handleIncompleteOption` implementada (estava referenciada mas ausente)
- Simplificacao display Misto: `_displayCategoryName` aplicada em todos os contextos (cards, badges, enrollment, bracket)
- Multi-categoria: `p.categories[]` com exclusividade (Fem/Masc radio) e nao-exclusividade (Misto checkbox)
- Ordenacao de mesclagem por forca (A antes de B); simplificacao quando todas habilidades mescladas
- Botao Voltar padronizado (pill com SVG arrow, hover-lift)
- Prefixo "orig:" removido â exibe apenas "(Fem B)" em vez de "(orig: Fem B)"
- Cache-busters: todos os arquivos usam `?v=0.2.3-alpha` (convencao adotada a partir desta versao)

**v0.2.1-alpha (Marco 2026)**
- Gerenciador de Categorias redesenhado:
  - Categorias acima dos sem-categoria; cards compactos (apenas contagem, sem nomes)
  - Agrupamento por prefixo de genero na mesma linha (Fem, Masc, etc.)
  - Clique em categoria abre sub-view com cards dos inscritos (avatar, nome, email)
  - Botao "Voltar" em ambas as telas; X mantido para fechar
- Drag-and-drop corrigido: closure stale fixada re-lendo t/parts do AppStore a cada render
  - Mecanismo trocado de dataTransfer.getData para variavel compartilhada _dragData
  - Suporte a touch drag-and-drop para mobile
  - Persistencia via FirestoreDB.saveTournament direto (mais confiavel)
- Auto-atribuicao de categorias (`_autoAssignCategories`):
  - Quando organizador salva/atualiza categorias, participantes com genero no perfil sao atribuidos automaticamente
  - Apenas se exatamente uma categoria elegivel; marca `categorySource: 'perfil'`
- Genero salvo no participante ao se inscrever (`participantObj.gender`)
- Indicadores de fonte de categoria nos cards de participantes:
  - `(perfil)` para auto-atribuidos pelo perfil
  - `(sem cat.)` em vermelho para sem categoria
  - `(sem cat.)` ao lado da categoria para historico de atribuicao manual
- Sistema de notificacoes de categoria (`categoryNotifications`):
  - Notificacao ao participante ao acessar o torneio informando categoria atribuida
  - Botao "Questionar Organizador" abre mailto pre-preenchido
  - `_checkCategoryNotifications(t)` chamada ao renderizar detalhe do torneio
- Manual atualizado: secao Categorias expandida com auto-atribuicao, notificacoes e historico
- Notas de versao detalhadas para v0.2.1-alpha
- Cache-busters: store.js?v=9, tournaments.js?v=16, create-tournament.js?v=7, main.js?v=6

**v0.2.0-alpha (Marco 2026)**
- Formato Ranking: temporada continua (3/6/12 meses ou custom), inscricoes sempre abertas, sem botao "Encerrar Inscricoes"
  - Sorteios automaticos com periodicidade configuravel (data/hora do primeiro + intervalo em dias)
  - Contagem regressiva (dias/horas/min) na view de detalhes e no bracket/classificacao
  - Modo manual disponivel via toggle (organizador decide quando gerar rodadas)
  - Status badge mostra "Inscricoes Abertas (Permanente)" ou "Ranking Ativo"
- Agendamento de sorteios (Suico tambem): `drawFirstDate`, `drawFirstTime`, `drawIntervalDays`, `drawManual`
  - `_calcNextDrawDate(t)` calcula proximo sorteio baseado no primeiro + intervalo
- Sistema de Categorias (transversal a TODOS os formatos):
  - Categorias de genero: Feminino, Masculino, Misto Aleatorio, Misto Obrigatorio (toggle buttons)
  - Categorias de habilidade: campo texto livre (A, B, C, D...)
  - Cross-product automatico: genderCategories x skillCategories = combinedCategories
  - Preview em tempo real com pills coloridas
  - Funcoes: `_toggleGenderCat`, `_applyGenderCatUI`, `_updateCategoryPreview`, `_getTournamentCategories`
  - Dados salvos: `genderCategories[]`, `skillCategories[]`, `combinedCategories[]`
  - Inscricao com categoria: `_resolveEnrollmentCategory(tId, callback)` verifica perfil do usuario
    - Se genero do perfil filtra opcoes automaticamente; modal de selecao para multiplas opcoes
    - Participante armazena `category` no objeto participante
  - Sorteio por categoria: `_generateNextRoundForPlayers(t, category)` gera pairings separados
  - Classificacao por categoria: `_computeStandings(t, category)` filtra por categoria
  - Bracket renderiza tabelas separadas por categoria
  - Gerenciador de Categorias: `_openCategoryManager(tId)` modal para organizador
    - Cards por categoria com contagem de inscritos e lista de nomes
    - Merge por drag-and-drop: Fem A + Fem B â Fem A/B (nome inteligente com prefixo comum)
    - Atribuir participantes sem categoria arrastando para card de categoria
    - Categoria original preservada em `p.originalCategory`
    - Funcoes: `_confirmMergeCategories`, `_executeMerge`, `_assignParticipantCategory`
- Convite por QR Code: imagem gerada automaticamente via api.qrserver.com no painel de convite
- Dashboard: "Inscricoes Abertas" â "Inscricoes Disponiveis" na saudacao
- Detalhes do torneio: mostra temporada, data/hora do 1o sorteio e intervalo entre sorteios para Ranking/Suico
- Estimativas de tempo: container com ID `time-estimates-container` para esconder confiavelmente no Ranking
- Manual: nova secao "Categorias" + QR Code mencionado em "Convidar Amigos" + formato Ranking documentado
- Notas de versao: compiladas e detalhadas a partir de v0.2.0

**v0.1.6-alpha (Marco 2026)**
- Logo de torneio: geracao via Canvas API com paletas tematicas por esporte, gradientes, emoji watermark
  - Considera local do evento, modalidade e formato na geracao
  - Botoes: Gerar, Regerar, Lock/Unlock, Download, Upload, Clear
  - Upload redimensiona para max 400x400 JPEG 0.85
  - Logo salva no Firestore (`logoData`, `logoLocked`), carregada ao editar
  - Logo exibida nos cards do dashboard (56x56, rounded) sem interferir na foto do local (background)
- Sistema de notificacoes completo:
  - `_sendUserNotification(uid, notifData)`: envia para um usuario via todos canais habilitados
  - `_notifyTournamentParticipants(tournament, notifData, excludeEmail)`: envia para todos inscritos + organizador
  - Notificacoes de inscricao/desinscricao (para organizador e usuario)
  - Notificacao de alteracoes no torneio (detecta campos alterados, notifica inscritos)
  - `_checkTournamentReminders()`: lembretes 7d/2d/dia-do-torneio, deduplicacao via localStorage
  - `_checkNearbyTournaments()`: torneios no CEP de preferencia do usuario
  - Comunicacao do organizador: `_sendOrgCommunication()` com niveis de importancia (Fundamental/Importante/Geral)
  - Botao "Comunicar Inscritos" na view de detalhe do torneio (so organizador)
- Niveis de notificacao no perfil do usuario:
  - Campos: `notifyLevel` ('todas'/'importantes'/'fundamentais') e `preferredCeps` (CEPs separados por virgula)
  - Botoes filtro no perfil: "So Importantes" (amarelo) e "So Fundamentais" (vermelho), desativados por padrao
  - `_notifLevelAllowed(userLevel, notifLevel)`: filtra notificacoes conforme preferencia
- Manual de ajuda (Help):
  - Botao "?" no header substitui "Sobre"
  - Modal `modal-help` com 16 secoes accordion (Sobre, Primeiros Passos, Dashboard, Criar Torneio, Formatos, Inscricao, Sorteio, Check-in, Resultados, Convidar, Perfil, Notificacoes, Explorar, Organizadores, Local/Quadras, Desempate)
  - Campo de busca `#help-search-input` com filtragem em tempo real
  - Secao "Sobre" aberta por padrao com versao e copyright

**v0.1.5-alpha (Marco 2026)**
- Explore view com busca de torneios publicos
- Dashboard com cards de torneios e hero box
- Notifications view
- Enroll modal e result modal

**v0.1.0-alpha (Marco 2026)**
- Limpeza de codigo legado
- Firebase Auth real com Google Sign-In
- CSS responsivo completo
- Remocao da sidebar, layout centralizado
- Modal "Sobre" com informacoes de versao (substituido por Help em v0.1.6)
- Criacao rapida de torneio
- Auto-geracao de nome: "Torneio [modo] de [modalidade] de [usuario]"
- Renomeado de Boratime para scoreplace.app
- Cloud Firestore como banco de dados (substituiu localStorage)
- Fluxo de convite: link direto para detalhes do torneio sem exigir login
- Auto-inscricao apos login quando usuario vem de convite
- Fix: inscricoes de nao-organizadores agora persistem no Firestore (bypass do sync)
- Fix: Service Worker removido (causava cache stale)
- Botoes de organizador condicionais (+Participante/+Time/Encerrar/Sortear/Iniciar)
- Status badge (Inscricoes Abertas/Encerradas) na mesma linha da modalidade no mobile

## Arquitetura

```
scoreplace-app/
|-- index.html          # Entry point SPA (topbar com Inicio, Explorar, Notificacoes, ?, Login)
|-- css/
|   |-- style.css       # Variaveis de tema e estilos base
|   |-- components.css  # Componentes (botoes, modais, cards, forms)
|   |-- layout.css      # Layout principal
|   |-- bracket.css     # Estilos do chaveamento/bracket
|   |-- responsive.css  # Media queries (767px / 768-1199px / 1200px+)
|   `-- drag-drop.css   # Drag-and-drop (sorteio)
|-- js/
|   |-- theme.js              # Injecao de tema (antes do body para evitar flicker)
|   |-- store.js              # SCOREPLACE_VERSION + AppStore + Firestore sync + realtime listener + auto-update checker
|   |-- firebase-db.js        # CRUD Firestore (saveTournament, loadAllTournaments, etc.)
|   |-- notifications.js      # Sistema de notificacoes toast + FCM client
|   |-- notification-catalog.js # Catalogo central de tipos de notificacao (tournament, presence, casual, org, social, etc.)
|   |-- ui.js                 # Helpers de UI (modais, elementos interativos)
|   |-- router.js             # Roteador hash-based (#dashboard, #tournaments, #venues, #my-venues, #presence, #casual, etc.)
|   |-- main.js               # Inicializacao + modal Help (searchable accordion) + modal Criacao Rapida
|   |-- hints.js              # Sistema "Dicas do App" - baloes contextuais por area/contexto
|   |-- email-templates.js    # Templates de email (convites, resultados, lembretes)
|   |-- i18n.js               # Sistema i18n - window._t(key, vars), toggle PT/EN
|   |-- i18n-pt.js            # Strings PT-BR (centenas de chaves)
|   |-- i18n-en.js            # Strings EN
|   |-- venue-db.js           # CRUD Firestore para locais (venues) - save, claim, search, rate
|   |-- presence-db.js        # CRUD Firestore para presencas (check-in/check-out, quem esta no local)
|   |-- presence-geo.js       # Auto check-in via Geolocation, calculo de distancia, GPS centering
|   `-- views/
|       |-- landing.js              # Landing page publica (5 pilares - torneios, casual, presenca, locais, stats)
|       |-- auth.js                 # Firebase Auth REAL + perfil completo (idade, altura, esportes, niveis notif, CEPs)
|       |-- dashboard.js            # Tela inicial: welcome card, nudges, pills (presence/casual), cards de torneios
|       |-- tournaments-utils.js    # Funcoes utilitarias de torneios
|       |-- tournaments-sharing.js  # Compartilhamento, convites, QR Code, "Adicionar a agenda"
|       |-- tournaments-analytics.js# Estatisticas e analytics
|       |-- tournaments-organizer.js# Ferramentas do organizador
|       |-- tournaments-categories.js# Sistema de categorias: merge/unmerge, auto-assign, estimativa de duracao
|       |-- tournaments-enrollment.js# Inscricao/desinscricao, adicionar participante/time, excluir torneio
|       |-- tournaments-draw-prep.js# Preparacao de sorteio, enquetes (polls), resolucao times/potencia de 2
|       |-- tournaments-draw.js     # Geracao de chaves, drag-and-drop (painel final pulado desde v0.14.40)
|       |-- tournaments.js          # Orquestrador principal: render de cards, detalhes, comunicacao
|       |-- create-tournament.js    # Modal criacao/edicao + logo canvas generator + GSM config + Estimativas
|       |-- participants.js         # Gestao de participantes
|       |-- pre-draw.js             # Tela de pre-sorteio
|       |-- bracket-model.js        # Model do bracket (extraido de bracket.js) - estruturas de dados puras
|       |-- bracket-logic.js        # Computacao de standings, Swiss pairing, advance winner, auto-finish, 3rd place
|       |-- bracket.js              # Renderizacao bracket + classificacao + GSM display + Liga "Seu jogo" layout
|       |-- bracket-ui.js           # UI interativa: save result inline, set scoring overlay, TV mode, sort standings
|       |-- host-transfer.js        # Sistema de co-organizacao (compartilhar/transferir), participant picker
|       |-- rules.js                # Regras do torneio
|       |-- explore.js              # Explorar torneios publicos + cards de amigos compactos
|       |-- venues.js               # #venues - descoberta publica de locais (mapa interativo, GPS, filtros, avaliacoes)
|       |-- venue-owner.js          # #my-venues - gerenciamento para proprietarios (grade 7x24, quadras multi-sport)
|       |-- presence.js             # #presence - check-in/check-out, quem esta no local, plano de presenca
|       |-- notifications-view.js   # View de notificacoes
|       |-- result-modal.js         # Modal de resultado de partida
|       `-- enroll-modal.js         # Modal de inscricao (+ Partida Casual live scoring, momentum, Wake Lock)
```

### Os 5 Pilares do scoreplace.app
O produto gira em torno de **5 pilares** integrados (documentados na landing e no manual):
1. **Torneios** - SPA completa para eliminatorias, Liga/Suico, grupos, duplas.
2. **Partidas Casuais** - placar ao vivo sem criar torneio, QR/share, lobby, Wake Lock, momentum charts.
3. **Presenca** - check-in/out em locais, "quem esta aqui", plano de presenca, auto check-in via GPS, notificacao de amigos.
4. **Locais (Venues)** - mapa interativo de descoberta, filtros por distancia/esporte, avaliacoes, reivindicacao por proprietario, cadastro comunitario (grade 7x24 + quadras multi-sport), Pro monetization.
5. **Stats/Perfil** - estatisticas individuais e por torneio, historico, meu desempenho, amigos.

### Cache-busters atuais (index.html)
Arquivos modificados recentemente usam a versao atual (`?v=0.15.45-alpha`). Demais arquivos podem usar versoes anteriores - verificar ao fazer deploy e atualizar apenas os que foram modificados.

## Regras de Seguranca de Codigo

### OBRIGATORIO: Validacao Sintatica Apos Qualquer Edicao
**CRITICO:** Apos QUALQUER edicao de codigo (especialmente auditorias de seguranca, escaping de XSS, ou operacoes de busca-e-troca em massa), DEVE-SE validar que todo arquivo JS modificado faz parse sem erros de sintaxe. Executar antes de fazer deploy:

```bash
for f in $(find js/ -name '*.js' ! -name '*.backup'); do
  node --check "$f" 2>&1 || echo "SYNTAX ERROR in $f";
done
```

Se `node` nao estiver disponivel, no minimo inspecionar visualmente todo handler onclick/oninput modificado para garantir que template literals estao fechados corretamente.

### Padrao Perigoso Conhecido: Escaping em onclick com Multiplos Argumentos
Ao escapar IDs em onclick handlers dentro de template literals, **nunca** quebrar o template literal entre argumentos.

**ERRADO (quebra o arquivo inteiro):**
```js
onclick="func('${String(id).replace(/'/g, "\\'")}'${', \'arg2\''})"
```
O `'${'` fecha a string JS prematuramente â SyntaxError â arquivo inteiro nao carrega e TODAS as funcoes definidas nele deixam de existir silenciosamente.

**CORRETO:**
```js
onclick="func('${String(id).replace(/'/g, "\\'")}', 'arg2')"
```
Apenas valores dinamicos (variaveis) precisam de `${}`. Argumentos fixos (strings literais) vao diretamente no template.

### Incidente Historico (v0.4.3-alpha)
A auditoria XSS da v0.4.3 aplicou escaping em ~30 onclick handlers. Nos casos com dois parametros, o padrao de escaping quebrou a sintaxe do template literal em `tournaments-draw-prep.js` (linha 106) e `bracket.js` (linha 773). Ambos os arquivos falharam ao carregar por completo, desabilitando silenciosamente: toggleRegistrationStatus, checkPowerOf2, showPowerOf2Panel, zoom do bracket, toggle de visibilidade de rodada, e encerramento de rodada. Isso passou despercebido por multiplos deploys porque nao havia etapa de validacao sintatica. Corrigido na v0.4.3e.

## Padrao de Codigo

### Roteamento
Hash-based SPA routing em `router.js`. Rotas: `#dashboard`, `#tournaments`, `#pre-draw`, `#bracket`, `#participants`, `#rules`, `#explore`, `#notifications`. Cada view e uma funcao `render[ViewName](container)` exportada globalmente.

### Estado Global
`window.AppStore` em `store.js` com metodos:
- `sync()` â salva torneios do organizador no Firestore (ATENCAO: so salva torneios onde organizerEmail === currentUser.email)
- `toggleViewMode()` â alterna organizador/participante
- `isOrganizer(tournament)` â verifica se usuario logado e organizador
- `getVisibleTournaments()`, `getMyOrganized()`, `getMyParticipations()`
- `addTournament(data)`, `logAction(tournamentId, message)`
- `loadFromFirestore()`, `loadUserProfile(uid)`

**IMPORTANTE:** `sync()` so salva torneios do organizador. Inscricoes de nao-organizadores devem chamar `FirestoreDB.saveTournament(t)` diretamente.

### Autenticacao
Firebase Auth (compat mode) em `auth.js` com credenciais REAIS do projeto `scoreplace-app`:
- `handleGoogleLogin()` â popup Google real
- `simulateLoginSuccess(user)` â atualiza AppStore + UI do topbar (avatar + nome + icone logout)
- `handleLogout()` â Firebase signout + reset de UI
- `setupLoginModal()`, `setupProfileModal()` â criam modais no DOM
- Dominio autorizado no Firebase: `scoreplace.app`
- Auto-inscricao pos-login via `_pendingEnrollTournamentId` (sessionStorage)
- Perfil inclui: `notifyLevel` (todas/importantes/fundamentais), `preferredCeps` (string CSV)
- Botoes de filtro de notificacao: `_toggleNotifyFilter(level)`, `_applyNotifyFilterUI(level)`
- Apos login, dispara `_checkTournamentReminders()` e `_checkNearbyTournaments()` com delay de 3s

### Sistema de Notificacoes (tournaments.js)
Funcoes centralizadas no topo de `tournaments.js`:
- `_notifLevelAllowed(userLevel, notifLevel)` â verifica se notificacao deve ser enviada
- `_sendUserNotification(uid, notifData)` â envia para um usuario (Firestore subcollection `users/{uid}/notifications/`)
- `_notifyTournamentParticipants(tournament, notifData, excludeEmail)` â envia para todos inscritos
- `_checkTournamentReminders()` â lembretes 7d/2d/dia-do, deduplicacao via localStorage
- `_checkNearbyTournaments()` â torneios no CEP de preferencia (unica excecao: envia mesmo sem inscricao)
- Niveis de notificacao: 'fundamental', 'important', 'all'
- Comunicacao do organizador: `_sendOrgCommunication(tId)` com modal de texto + seletor de importancia
- Botao "Comunicar Inscritos" visivel so para organizador na view de detalhe

### Logo de Torneio (create-tournament.js)
- Canvas API com paletas por esporte (`_sportColorPalettes`), gradientes, emoji watermark
- Considera: venue, sport, format na geracao
- Botoes: Gerar (ð¨), Regerar (ð), Lock/Unlock (ð/ð), Download (â¬ï¸), Upload (ð), Clear (â)
- Upload: FileReader + canvas resize (max 400x400, JPEG quality 0.85)
- Dados salvos no Firestore: `logoData` (base64), `logoLocked` (boolean)
- Logo exibida no dashboard cards (56x56) e na view de detalhe

### Help Modal (main.js)
- `setupHelpModal()` substitui `setupAboutModal()`
- 16 secoes accordion com classe `.help-section.open` para animacao
- Campo de busca `#help-search-input` com `_filterHelpSections()` para filtragem em tempo real
- Secao "Sobre" aberta por padrao (versao, copyright)

### Fluxo de Convite (Invite Flow)
1. Usuario recebe link `https://scoreplace.app/#tournaments/{id}`
2. Router permite acesso SEM login â salva `_pendingInviteHash`
3. Pagina de detalhes do torneio exibe CTA "Inscrever-se" em destaque
4. Clique no botao dispara login Google
5. Apos login, auto-inscricao via `_pendingEnrollTournamentId` (sessionStorage)
6. Redireciona para pagina do torneio com usuario ja inscrito

### Fluxo de Criacao de Torneio
1. Usuario clica "+Novo Torneio" no dashboard
2. Abre `modal-quick-create` (modal intermediario em `main.js`) com:
   - Seletor de modalidade esportiva
   - "Criar Torneio" â cria com defaults + auto-nome + redireciona para pagina do torneio
   - "Detalhes Avancados" â abre `modal-create-tournament` (formulario completo em `create-tournament.js`)
   - "Cancelar" â fecha sem criar
3. Auto-nome: "Torneio [modo] de [modalidade] de [primeiro nome do usuario]"

### Deteccao de Alteracoes em Torneio (create-tournament.js)
Ao salvar edicao de torneio, compara campos antes/depois:
- Campos monitorados: name, startDate, endDate, venue, format, maxParticipants, enrollmentMode, registrationLimit
- Se houver alteracoes, notifica participantes via `_notifyTournamentParticipants` (level: 'important')

### CSS / Responsividade
- Mobile-first com breakpoints: `max-width: 767px`, `768px-1199px`, `min-width: 1200px`
- Touch targets: labels com minimo 44px, checkboxes 22px
- Modais viram bottom-sheets em mobile
- Datas empilham verticalmente em mobile (classe `dates-row`)
- Botao hero (`.btn-create-hero`) e absolute no desktop, static no mobile
- Variaveis CSS em `:root` para temas (dark padrao, light, high-contrast, catppuccin)

### Busca de Local (Venue)
- Google Places API (New) â `AutocompleteSuggestion.fetchAutocompleteSuggestions()` (programmatic, sem UI do Google)
- Custom UI: input `#tourn-venue` + dropdown `#venue-suggestions` em dark theme
- Restrito ao Brasil: `includedRegionCodes: ['br']`
- Dados salvos: venue, venueLat, venueLon, venueAddress, venuePlaceId, venueAccess
- API key: compartilhada com Firebase (Google Cloud Console projeto scoreplace-app)
- **NAO usar** `PlaceAutocompleteElement` â causa crash de tela branca

### Botoes do Organizador (Tournament Detail View)
- **Inscricoes abertas, sem sorteio**: Convidar, Inscrever-se, +Participante, +Time (if mode allows), Encerrar Inscricoes, Sortear, Comunicar Inscritos, Apagar
- **Inscricoes fechadas, sem sorteio**: Reabrir Inscricoes, Sortear, Comunicar Inscritos, Apagar
- **Apos sorteio (nao iniciado)**: Iniciar Torneio, Ver Chaves, Comunicar Inscritos, Apagar
- **Torneio em andamento**: Badge "Em andamento", Ver Chaves, Comunicar Inscritos, Apagar
- `hasDraw` deve usar `(Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0)`

## Versionamento

O projeto segue semver simplificado. Versao definida em `window.SCOREPLACE_VERSION` (store.js).
Visivel para o usuario no modal "Help" (secao Sobre, primeira accordion).

- **0.1.x-alpha** â Fase inicial. Firestore ativo, auth real, fluxo de convite
- **0.2.x-alpha** â Fase atual. Unificacao Liga/Ranking, encerramento automatico, podio, validacoes, seguranca
- **0.3.x-alpha** â Rankings, historico, PWA, push notifications
- **0.4.x-alpha** â Auditoria completa, novos temas, sistema GSM
- **1.0.0** â Release estavel

## Proximos Passos Conhecidos

As features iniciais (v0.1-v0.4 da lista antiga) estao todas **FEITAS**. O projeto hoje gira em torno dos **5 pilares** (Torneios, Casual, Presenca, Venues, Stats). A partir daqui, proximos passos sao mais curadoria + polish do que construcao nova.

### Curadoria/polish conhecidos
- **CLAUDE.md vivendo** - manter atualizado a cada bloco de versoes. Este documento estava em 0.8.6-alpha ate v0.15.45-alpha, lacuna de ~400 commits.
- **bracket.js tamanho** - ainda ~143KB, candidato a novo split futuro se crescer mais.
- **Backend/infra** - Firestore rules publicas, Cloud Functions (autoDraw, sendPushNotification, stripe), OpenWeather API, FCM VAPID - todos configurados. Extensao `firestore-send-email` instalada (pasta `extensions/`, gitignored).

### Ideias em aberto (sem prioridade definida)
- **Beta release** - migrar para `1.0.0` quando dados reais deixarem de ser descartaveis. Requer desabilitar regra "sem compat" do alpha.
- **Apple Watch revisitado** - tentado e rolled back na v0.15.39-42. Poderia voltar via app nativo (nao Shortcuts).
- **Venues Pro monetization** - implementado em v0.14.69 mas vale revisitar pricing/UX quando houver volume real.
- **Testes** - tests.html tem suite basica. Poderia crescer com casos de Liga, Rei/Rainha, presence, venues.
- **Performance** - first-paint ja esta bom via cache local. Monitorar em producao real.

### Quando iniciar uma nova feature
1. Consultar este CLAUDE.md para pegar contexto do pilar afetado.
2. Checar se ja existe em alguma versao recente (`git log --oneline | grep <tema>`).
3. Seguir o padrao vanilla JS + AppStore + views globais + i18n (`_t(chave)`).
4. Bumpar versao, atualizar cache-busters, release notes no manual (main.js) e este CLAUDE.md **na mesma leva**.

## Deploy

Deploy automatico via `git push` para o repositorio `rstbarth/scoreplace.app` (branch `main`). GitHub Pages serve o site em `scoreplace.app` com CNAME configurado.

### DNS
- A records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- CNAME www â rstbarth.github.io

### Pre-requisitos
- Git inicializado na pasta local com remote `origin` apontando para `https://github.com/rstbarth/scoreplace.app.git`
- `gh auth setup-git` executado para autenticacao via GitHub CLI
- `.gitignore` configurado (`.DS_Store`, `.claude/`, `*.backup`, `*.bak`, `outputs/`, `extensions/`, `functions/node_modules/`)

### Fluxo de deploy padrao
1. Validar sintaxe de todos os JS modificados: `for f in $(find js/ -name '*.js' ! -name '*.backup'); do node --check "$f" 2>&1 || echo "SYNTAX ERROR in $f"; done`
2. Atualizar cache-busters em `index.html` para arquivos modificados
3. `git add` dos arquivos alterados (evitar `git add .` — adicionar arquivos especificos)
4. `git commit` com mensagem descritiva
5. `git push origin main`
6. Verificar no site ao vivo que as alteracoes estao deployadas
