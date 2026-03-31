# scoreplace.app - Projeto de Contexto

## O que e o scoreplace.app

Plataforma web de gestao de torneios esportivos e board games. App SPA (Single Page Application) em **vanilla JS puro** — sem frameworks. Hospedado no **GitHub Pages** com dominio customizado `scoreplace.app`.

- **Versao atual:** `0.2.16-alpha` (definida em `window.SCOREPLACE_VERSION` no store.js)
- **URL principal:** https://scoreplace.app
- **GitHub repo:** `rstbarth/scoreplace.app`
- **Banco de dados:** Cloud Firestore (projeto Firebase: `scoreplace-app`)
- **Auth:** Firebase Auth com Google Sign-In (popup)
- **localStorage:** `boratime_state` (chave legada mantida por compatibilidade)

## Historico do Projeto

O projeto comecou como "torneio_facil", passou por "Boratime", e foi renomeado definitivamente para **scoreplace.app**.

### Changelog

**v0.2.16-alpha (Marco 2026)**
- Compartilhar Torneio: botao "Compartilhar" na pagina de detalhes, visivel para todos os usuarios (nao apenas organizador). Usa navigator.share() nativo no mobile com fallback para clipboard.
- Progresso do Torneio: barra de progresso visual mostrando % de partidas concluidas. Aparece nos cards do dashboard e na pagina de detalhes apos o sorteio. Helper global window._getTournamentProgress(t) conta partidas de todas as estruturas (matches, rounds, groups, rodadas, thirdPlaceMatch).
- Countdown de Inscricoes: aviso "Inscricoes encerram em X dias" nos cards e na pagina do torneio quando o prazo esta proximo (ate 14 dias). Cor urgente para prazos <= 2 dias (vermelho), <= 5 dias (amarelo).

**v0.2.15-alpha (Marco 2026)**
- Proximas Partidas: dashboard exibe widget "Suas Proximas Partidas" com partidas pendentes do usuario (sem resultado) em torneios ativos. Mostra oponente, torneio, esporte e link direto. Max 5 visiveis.
- Indicador offline/online: banner fixo no rodape quando perde conexao ("Sem conexao — modo offline") e feedback quando reconecta ("Conexao restaurada"). Complemento do PWA.
- Error logging melhorado: catch silencioso em store.js._loadFromCache agora faz console.warn para facilitar debug.

**v0.2.14-alpha (Marco 2026)**
- Filtro de torneios: barra de busca por nome/esporte/formato + dropdown de status (Todos, Inscrições Abertas, Em Andamento, Encerrados) na lista de torneios. Aparece quando ha mais de 3 torneios. Filtragem instantanea por texto e status.

**v0.2.13-alpha (Marco 2026)**
- PWA: manifest.json, service worker (sw.js) com stale-while-revalidate para assets estaticos e network-only para Firebase/APIs. Icones SVG em icons/. Meta tags apple-mobile-web-app. Registro do SW em index.html.
- Historico de Torneios no perfil: lista dos ultimos 8 torneios com posicao final, formato, status e link direto. Funcao _populatePlayerStats expandida com calculo de posicao para Eliminatorias (final + 3o lugar) e Liga/Suico (standings).

**v0.2.12-alpha (Marco 2026)**
- Encerramento automatico de temporada Liga: quando ligaSeasonMonths expira (startDate + N meses), o torneio e automaticamente marcado como finished com standings finais. Detectado tanto no dashboard quanto nos detalhes do torneio. Exibe aviso visual "X dias restantes" quando faltam 7 dias ou menos.
- XSS fix participants.js: nomes de participantes agora sanitizados antes de injecao no HTML (previne ataques via nomes maliciosos).
- Utilitario global window._safeHtml() em store.js para escape de HTML reutilizavel.

**v0.2.11-alpha (Marco 2026)**
- Meu Desempenho: perfil do jogador agora exibe estatisticas pessoais — torneios participados, partidas jogadas, vitorias, derrotas, empates, aproveitamento (%) e titulos conquistados. Dados calculados em tempo real a partir de todos os torneios. Funcao _populatePlayerStats() em auth.js.

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
- Criar torneio — limpeza: removida referencia a campo liga-periodicity que nao existia mais no HTML, eliminando erros silenciosos.
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
- Prefixo "orig:" removido — exibe apenas "(Fem B)" em vez de "(orig: Fem B)"
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
    - Merge por drag-and-drop: Fem A + Fem B → Fem A/B (nome inteligente com prefixo comum)
    - Atribuir participantes sem categoria arrastando para card de categoria
    - Categoria original preservada em `p.originalCategory`
    - Funcoes: `_confirmMergeCategories`, `_executeMerge`, `_assignParticipantCategory`
- Convite por QR Code: imagem gerada automaticamente via api.qrserver.com no painel de convite
- Dashboard: "Inscricoes Abertas" → "Inscricoes Disponiveis" na saudacao
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
├── index.html          # Entry point SPA (topbar com Inicio, Explorar, Notificacoes, ?, Login)
├── css/
│   ├── style.css       # Variaveis de tema e estilos base
│   ├── components.css  # Componentes (botoes, modais, cards, forms)
│   ├── layout.css      # Layout principal
│   ├── bracket.css     # Estilos do chaveamento/bracket
│   ├── responsive.css  # Media queries (767px / 768-1199px / 1200px+)
│   └── drag-drop.css   # Drag-and-drop (sorteio)
├── js/
│   ├── theme.js        # Injecao de tema (antes do body para evitar flicker)
│   ├── store.js        # SCOREPLACE_VERSION + Estado global (AppStore) + Firestore sync
│   │                   #   Inclui notifyLevel e preferredCeps no perfil do usuario
│   ├── firebase-db.js  # CRUD Firestore (saveTournament, loadAllTournaments, etc.)
│   ├── notifications.js# Sistema de notificacoes toast
│   ├── ui.js           # Helpers de UI (modais, elementos interativos)
│   ├── router.js       # Roteador hash-based (#dashboard, #tournaments, etc.)
│   ├── main.js         # Inicializacao + modal Help (searchable accordion) + modal Criacao Rapida
│   └── views/
│       ├── auth.js             # Firebase Auth REAL + perfil com CEPs de preferencia + filtros de notificacao
│       ├── dashboard.js        # Tela inicial com hero box + cards com logo de torneio
│       ├── tournaments.js      # Lista/detalhe + sistema de notificacoes + comunicacao do organizador
│       ├── create-tournament.js# Modal de criacao/edicao + logo canvas generator + deteccao de alteracoes
│       ├── participants.js     # Gestao de participantes
│       ├── pre-draw.js         # Tela de pre-sorteio
│       ├── bracket.js          # Chaveamento/bracket (~94KB)
│       ├── rules.js            # Regras do torneio
│       ├── explore.js          # Explorar torneios publicos da comunidade
│       ├── notifications-view.js # View de notificacoes
│       ├── result-modal.js     # Modal de resultado de partida
│       └── enroll-modal.js     # Modal de inscricao
```

### Cache-busters atuais (index.html)
- store.js?v=8
- firebase-db.js?v=8
- dashboard.js?v=7
- tournaments.js?v=15
- create-tournament.js?v=6
- auth.js?v=10
- explore.js?v=8
- responsive.css?v=3
- layout.css?v=2
- router.js?v=8
- main.js?v=5
- bracket.js?v=6
- participants.js?v=3

## Padrao de Codigo

### Roteamento
Hash-based SPA routing em `router.js`. Rotas: `#dashboard`, `#tournaments`, `#pre-draw`, `#bracket`, `#participants`, `#rules`, `#explore`, `#notifications`. Cada view e uma funcao `render[ViewName](container)` exportada globalmente.

### Estado Global
`window.AppStore` em `store.js` com metodos:
- `sync()` — salva torneios do organizador no Firestore (ATENCAO: so salva torneios onde organizerEmail === currentUser.email)
- `toggleViewMode()` — alterna organizador/participante
- `isOrganizer(tournament)` — verifica se usuario logado e organizador
- `getVisibleTournaments()`, `getMyOrganized()`, `getMyParticipations()`
- `addTournament(data)`, `logAction(tournamentId, message)`
- `loadFromFirestore()`, `loadUserProfile(uid)`

**IMPORTANTE:** `sync()` so salva torneios do organizador. Inscricoes de nao-organizadores devem chamar `FirestoreDB.saveTournament(t)` diretamente.

### Autenticacao
Firebase Auth (compat mode) em `auth.js` com credenciais REAIS do projeto `scoreplace-app`:
- `handleGoogleLogin()` — popup Google real
- `simulateLoginSuccess(user)` — atualiza AppStore + UI do topbar (avatar + nome + icone logout)
- `handleLogout()` — Firebase signout + reset de UI
- `setupLoginModal()`, `setupProfileModal()` — criam modais no DOM
- Dominio autorizado no Firebase: `scoreplace.app`
- Auto-inscricao pos-login via `_pendingEnrollTournamentId` (sessionStorage)
- Perfil inclui: `notifyLevel` (todas/importantes/fundamentais), `preferredCeps` (string CSV)
- Botoes de filtro de notificacao: `_toggleNotifyFilter(level)`, `_applyNotifyFilterUI(level)`
- Apos login, dispara `_checkTournamentReminders()` e `_checkNearbyTournaments()` com delay de 3s

### Sistema de Notificacoes (tournaments.js)
Funcoes centralizadas no topo de `tournaments.js`:
- `_notifLevelAllowed(userLevel, notifLevel)` — verifica se notificacao deve ser enviada
- `_sendUserNotification(uid, notifData)` — envia para um usuario (Firestore subcollection `users/{uid}/notifications/`)
- `_notifyTournamentParticipants(tournament, notifData, excludeEmail)` — envia para todos inscritos
- `_checkTournamentReminders()` — lembretes 7d/2d/dia-do, deduplicacao via localStorage
- `_checkNearbyTournaments()` — torneios no CEP de preferencia (unica excecao: envia mesmo sem inscricao)
- Niveis de notificacao: 'fundamental', 'important', 'all'
- Comunicacao do organizador: `_sendOrgCommunication(tId)` com modal de texto + seletor de importancia
- Botao "Comunicar Inscritos" visivel so para organizador na view de detalhe

### Logo de Torneio (create-tournament.js)
- Canvas API com paletas por esporte (`_sportColorPalettes`), gradientes, emoji watermark
- Considera: venue, sport, format na geracao
- Botoes: Gerar (🎨), Regerar (🔄), Lock/Unlock (🔒/🔓), Download (⬇️), Upload (📁), Clear (✕)
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
2. Router permite acesso SEM login — salva `_pendingInviteHash`
3. Pagina de detalhes do torneio exibe CTA "Inscrever-se" em destaque
4. Clique no botao dispara login Google
5. Apos login, auto-inscricao via `_pendingEnrollTournamentId` (sessionStorage)
6. Redireciona para pagina do torneio com usuario ja inscrito

### Fluxo de Criacao de Torneio
1. Usuario clica "+Novo Torneio" no dashboard
2. Abre `modal-quick-create` (modal intermediario em `main.js`) com:
   - Seletor de modalidade esportiva
   - "Criar Torneio" — cria com defaults + auto-nome + redireciona para pagina do torneio
   - "Detalhes Avancados" — abre `modal-create-tournament` (formulario completo em `create-tournament.js`)
   - "Cancelar" — fecha sem criar
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
- Google Places API (New) — `AutocompleteSuggestion.fetchAutocompleteSuggestions()` (programmatic, sem UI do Google)
- Custom UI: input `#tourn-venue` + dropdown `#venue-suggestions` em dark theme
- Restrito ao Brasil: `includedRegionCodes: ['br']`
- Dados salvos: venue, venueLat, venueLon, venueAddress, venuePlaceId, venueAccess
- API key: compartilhada com Firebase (Google Cloud Console projeto scoreplace-app)
- **NAO usar** `PlaceAutocompleteElement` — causa crash de tela branca

### Botoes do Organizador (Tournament Detail View)
- **Inscricoes abertas, sem sorteio**: Convidar, Inscrever-se, +Participante, +Time (if mode allows), Encerrar Inscricoes, Sortear, Comunicar Inscritos, Apagar
- **Inscricoes fechadas, sem sorteio**: Reabrir Inscricoes, Sortear, Comunicar Inscritos, Apagar
- **Apos sorteio (nao iniciado)**: Iniciar Torneio, Ver Chaves, Comunicar Inscritos, Apagar
- **Torneio em andamento**: Badge "Em andamento", Ver Chaves, Comunicar Inscritos, Apagar
- `hasDraw` deve usar `(Array.isArray(t.matches) && t.matches.length > 0) || (Array.isArray(t.rounds) && t.rounds.length > 0) || (Array.isArray(t.groups) && t.groups.length > 0)`

## Versionamento

O projeto segue semver simplificado. Versao definida em `window.SCOREPLACE_VERSION` (store.js).
Visivel para o usuario no modal "Help" (secao Sobre, primeira accordion).

- **0.1.x-alpha** — Fase inicial. Firestore ativo, auth real, fluxo de convite
- **0.2.x-alpha** — Fase atual. Unificacao Liga/Ranking, encerramento automatico, podio, validacoes, seguranca
- **0.3.x-alpha** — Rankings, historico, PWA, push notifications
- **1.0.0** — Release estavel

## Proximos Passos Conhecidos

### Fase 2 — Infraestrutura e Qualidade
1. **Firestore rules:** Mudar para `allow read: if true` na colecao tournaments (permitir leitura publica). Requer acesso ao Firebase Console.
2. **Refatoracao categorias:** Unificar sistema dual de categorias (legacy `#tourn-categories` vs novo gender+skill). Requer cuidado com dados existentes.
3. **Otimizacao:** tournaments.js (~210KB) e bracket.js (~100KB) sao muito grandes — modularizar em arquivos menores.
4. **Testes:** Nenhum teste automatizado existe ainda.

### Fase 3 — Features Novas
5. ~~**Historico de jogador:**~~ **FEITO em v0.2.11** — Perfil com estatisticas (vitorias, derrotas, empates, aproveitamento, titulos) calculadas em tempo real.
6. **Auto-draw Cloud Function:** Backend (Firebase Cloud Functions) para executar sorteios automaticos. Atualmente so frontend (countdown) sem trigger real.
7. ~~**Encerramento de temporada Liga:**~~ **FEITO em v0.2.12** — Auto-closure quando ligaSeasonMonths expira, com aviso visual de dias restantes.
8. **Notificacoes push:** Firebase Cloud Messaging para push notifications reais.
9. ~~**PWA:**~~ **FEITO em v0.2.13** — Service worker com stale-while-revalidate, manifest.json, icones SVG, meta tags iOS.
10. **Previsao do tempo:** OpenWeatherMap integrado mas sem API key ativa (campo OPENWEATHER_API_KEY vazio em create-tournament.js).

## Deploy

O deploy e feito via upload de arquivos no repositorio `rstbarth/scoreplace.app` no branch principal. GitHub Pages serve o site em `scoreplace.app` com CNAME configurado.

### DNS
- A records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- CNAME www → rstbarth.github.io

### Fluxo de deploy padrao (PASSO A PASSO OBRIGATORIO)
1. Separar arquivos alterados por pasta de destino no GitHub (ex: `passo1/` para `js/views/`, `passo2/` para `js/`)
2. Limpar outputs antes de criar novos arquivos
3. Para cada passo:
   a. Abrir pagina de upload do GitHub no subpath correto (ex: `/upload/main/js/views`)
   b. Mostrar APENAS os arquivos daquele passo na pasta de outputs
   c. Aguardar usuario arrastar, soltar e commitar
   d. Limpar pasta do passo antes de prosseguir
4. Apos todos os uploads, verificar no site ao vivo que as alteracoes estao deployadas
5. Verificar se nao ha arquivos deslocados (usuario pode ter feito upload na pasta errada)

**NUNCA** misturar arquivos de pastas diferentes no mesmo passo.
**NUNCA** tentar push via git CLI, GitHub API, ou upload programatico.
