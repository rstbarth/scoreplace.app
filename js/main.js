// Retiramos o DOMContentLoaded event para evitar condição de corrida com ES Modules (type="module")
// já que o script está no final do <body> e o DOM já estará parseado.

// === Modal Ajuda / Manual ===
(function setupHelpModal() {
  if (document.getElementById('modal-help')) return;

  var helpSections = [
    {
      id: 'about',
      title: 'Sobre o scoreplace.app',
      icon: '🏆',
      content: '<div style="text-align:center; margin-bottom:1rem;">' +
        '<div style="font-size:2.2rem; margin-bottom:0.3rem;">🏆</div>' +
        '<div style="font-size:1.3rem; font-weight:800; color:var(--text-bright);">scoreplace.app</div>' +
        '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Versão ' + (window.SCOREPLACE_VERSION || '0.1.6-alpha') + '</div>' +
        '<div style="font-size:0.8rem; color:var(--text-main); margin-top:8px; line-height:1.6;">Plataforma de gestão de torneios esportivos e board games.</div>' +
        '<div style="font-size:0.7rem; color:var(--text-muted); opacity:0.6; margin-top:4px;">Fase Alpha — funcionalidades em desenvolvimento.</div>' +
        '<div style="font-size:0.7rem; color:var(--text-muted); margin-top:8px;">© 2026 scoreplace.app. Todos os direitos reservados.</div>' +
      '</div>'
    },
    {
      id: 'primeiros-passos',
      title: 'Primeiros Passos',
      icon: '🚀',
      content: '<p><b>Bem-vindo ao scoreplace.app!</b> Aqui vai um guia rápido para começar:</p>' +
        '<p><b>1. Faça login</b> — Clique no botão de login no canto superior direito e entre com sua conta Google. Seu perfil é criado automaticamente.</p>' +
        '<p><b>2. Complete seu perfil</b> — Clique no seu avatar (canto superior direito) para abrir o perfil. Preencha seu nome, cidade, esportes preferidos e telefone para receber notificações por WhatsApp.</p>' +
        '<p><b>3. Crie ou participe de um torneio</b> — Na dashboard, clique em "+ Novo Torneio" para criar, ou navegue pelos torneios públicos e clique em "Inscrever-se".</p>' +
        '<p><b>4. Convide amigos</b> — Dentro de um torneio, use o botão "Convidar" para enviar convites por WhatsApp, e-mail ou link direto.</p>'
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: '📊',
      content: '<p>A <b>Dashboard</b> é sua página principal. Ela mostra um resumo dos seus torneios e permite filtrar de várias formas:</p>' +
        '<p><b>Cards de resumo</b> — No topo você vê cards clicáveis: "Meus Torneios" (que você organiza), "Participando" (que você está inscrito) e "Inscrições Abertas". Clique neles para filtrar os cards abaixo.</p>' +
        '<p><b>Filtros por modalidade, local e formato</b> — Logo abaixo dos cards de resumo, aparecem pills coloridas para filtrar por esporte (roxo), local (verde) e formato (amarelo). Clique em "✕ Limpar filtros" para voltar a ver tudo.</p>' +
        '<p><b>Cards de torneio</b> — Cada torneio aparece como um card com nome, esporte, data, número de inscritos e status. Se o torneio tem uma foto do local, ela aparece como fundo do card. Se tem logo, ele aparece ao lado do nome. Clique no card para ver os detalhes.</p>'
    },
    {
      id: 'criar-torneio',
      title: 'Criar um Torneio',
      icon: '➕',
      content: '<p>Existem duas formas de criar um torneio:</p>' +
        '<p><b>Criação rápida</b> — Clique em "+ Novo Torneio" na dashboard, escolha o esporte e clique em "Criar Torneio". Um torneio de eliminatórias simples é criado instantaneamente com nome automático.</p>' +
        '<p><b>Detalhes avançados</b> — Na criação rápida, clique em "Detalhes Avançados" para abrir o formulário completo onde você pode configurar:</p>' +
        '<p>Nome, esporte, formato (5 opções), datas de início/fim, prazo de inscrição, local (com busca automática no mapa), número de quadras, público ou privado, modo de inscrição (individual ou times), máximo de participantes, logo do torneio e muito mais.</p>' +
        '<p><b>Logo do torneio</b> — Você pode gerar um logo automático (baseado no nome, esporte, formato e local) ou fazer upload de uma imagem. Use o cadeado para travar o logo e evitar que ele mude ao editar o torneio. Você também pode baixar o logo gerado.</p>'
    },
    {
      id: 'formatos',
      title: 'Formatos de Torneio',
      icon: '🎯',
      content: '<p>O scoreplace.app suporta <b>5 formatos</b> de torneio:</p>' +
        '<p><b>Eliminatórias Simples</b> — Perdeu, está fora. Ideal para torneios rápidos. Opcional: disputa de 3º lugar.</p>' +
        '<p><b>Dupla Eliminatória</b> — Cada participante precisa perder 2 vezes para ser eliminado. Tem chave de vencedores e de perdedores.</p>' +
        '<p><b>Fase de Grupos + Eliminatórias</b> — Estilo Copa do Mundo. Os participantes são divididos em grupos, jogam entre si, e os melhores de cada grupo avançam para as eliminatórias.</p>' +
        '<p><b>Suíço Clássico</b> — Todos jogam todas as rodadas. Os emparelhamentos são feitos por pontuação. Ótimo para xadrez e jogos de mesa. Número de rodadas configurável.</p>' +
        '<p><b>Liga</b> — Temporada longa com rodadas periódicas (semanal, quinzenal, mensal). Permite inscrição aberta durante a temporada. Regras configuráveis para novos jogadores e inatividade.</p>'
    },
    {
      id: 'inscricao',
      title: 'Inscrição em Torneios',
      icon: '✍️',
      content: '<p><b>Para se inscrever</b> — Abra o torneio e clique no botão "Inscrever-se". Se o torneio for por times, você precisará preencher os nomes dos integrantes da equipe.</p>' +
        '<p><b>Confirmação</b> — Após a inscrição, você será redirecionado para a página do torneio e verá seu nome destacado entre os inscritos.</p>' +
        '<p><b>Cancelar inscrição</b> — Clique em "Cancelar Inscrição" na página do torneio. Uma confirmação será pedida antes de remover.</p>' +
        '<p><b>Convites</b> — Se alguém te convidar para um torneio, você receberá um link. Ao clicar, basta fazer login (se necessário) e confirmar a inscrição.</p>' +
        '<p><b>Inscrição automática fechada</b> — Alguns torneios fecham inscrições automaticamente ao atingir o número máximo de participantes.</p>'
    },
    {
      id: 'sorteio',
      title: 'Sorteio e Chaves',
      icon: '🎲',
      content: '<p><b>Antes do sorteio</b> — O organizador pode abrir a "Janela Pré-Sorteio" para organizar os participantes por categoria, mover entre grupos e definir a ordem de cabeças de chave.</p>' +
        '<p><b>Realizar o sorteio</b> — O organizador clica em "Sortear" para gerar as chaves oficiais. Em eliminatórias, os confrontos são definidos aleatoriamente. Em grupos, os participantes são distribuídos nos grupos.</p>' +
        '<p><b>Visualizar chaves</b> — Após o sorteio, a aba "Chaves" mostra a estrutura do torneio: árvore de eliminatórias, tabela de grupos, classificação da liga, etc.</p>' +
        '<p><b>Iniciar torneio</b> — Após o sorteio, o organizador clica em "Iniciar Torneio" para habilitar check-in e lançamento de resultados.</p>'
    },
    {
      id: 'checkin',
      title: 'Check-in e Presença',
      icon: '✅',
      content: '<p><b>Check-in</b> — Depois que o torneio é iniciado, o organizador pode fazer a chamada de presença na aba "Inscritos". Cada participante pode ser marcado como Presente, Ausente ou Pendente.</p>' +
        '<p><b>Indicadores nas chaves</b> — Nas chaves, cada jogador tem um ponto colorido: verde (presente), vermelho (ausente), cinza (pendente). A partida aparece verde quando ambos estão presentes.</p>' +
        '<p><b>Ausência e W.O.</b> — Se um jogador é declarado ausente, o organizador pode dar W.O. (vitória automática ao adversário) ou substituir por um reserva (standby).</p>' +
        '<p><b>Lista de espera</b> — Participantes na lista de espera podem ser chamados para substituir ausentes.</p>'
    },
    {
      id: 'resultados',
      title: 'Resultados e Placar',
      icon: '📝',
      content: '<p><b>Lançar resultado</b> — O organizador (ou os próprios jogadores, dependendo da configuração) pode clicar na partida para informar o placar.</p>' +
        '<p><b>Configurações de lançamento</b> — No formulário de criação, você define quem pode lançar resultados: apenas o organizador, pelos próprios jogadores (com aceite do adversário), ou por árbitro designado.</p>' +
        '<p><b>Progressão automática</b> — Em eliminatórias, o vencedor avança automaticamente para a próxima fase. Na liga e suíço, a classificação é atualizada em tempo real.</p>'
    },
    {
      id: 'convidar',
      title: 'Convidar Amigos',
      icon: '👥',
      content: '<p><b>Dentro do torneio</b> — Clique em "Convidar" para abrir o painel de convites. Você tem 3 opções:</p>' +
        '<p><b>Amigos na plataforma</b> — Selecione amigos que já têm conta no scoreplace.app. Eles recebem uma notificação direta.</p>' +
        '<p><b>WhatsApp</b> — Um link de convite é gerado e aberto no WhatsApp para você compartilhar com quem quiser.</p>' +
        '<p><b>E-mail</b> — Um e-mail de convite é preparado com o link do torneio para enviar aos seus contatos.</p>' +
        '<p><b>Copiar link</b> — Copie o link de convite para colar em qualquer lugar (grupos, redes sociais, etc).</p>'
    },
    {
      id: 'perfil',
      title: 'Seu Perfil',
      icon: '👤',
      content: '<p><b>Acessar</b> — Clique no seu avatar/nome no canto superior direito para abrir o perfil.</p>' +
        '<p><b>Informações pessoais</b> — Nome, gênero, data de nascimento, cidade, esportes preferidos (separados por vírgula) e categoria padrão.</p>' +
        '<p><b>WhatsApp</b> — Preencha seu número com código do país para receber notificações por WhatsApp.</p>' +
        '<p><b>CEP de preferência</b> — Informe um ou mais CEPs (separados por vírgula) para ser notificado quando houver torneios perto de você.</p>' +
        '<p><b>Social</b> — Ative "Aceitar convites" para permitir que outros usuários te encontrem e enviem convites de amizade.</p>' +
        '<p><b>Filtros de comunicação</b> — Por padrão, você recebe todas as notificações. Ative "Só Importantes" (amarelo) para receber apenas as importantes e fundamentais, ou "Só Fundamentais" (vermelho) para receber o mínimo essencial.</p>' +
        '<p><b>Canais</b> — Ative/desative recebimento por Plataforma, E-mail e WhatsApp.</p>' +
        '<p><b>Tema</b> — Escolha entre Escuro, Claro, Alto Contraste, Alternativo ou Automático (segue o sistema).</p>'
    },
    {
      id: 'notificacoes',
      title: 'Notificações',
      icon: '🔔',
      content: '<p>O scoreplace.app te mantém informado sobre tudo que acontece nos torneios em que você está inscrito:</p>' +
        '<p><b>Inscrição confirmada</b> — Ao se inscrever em um torneio, você recebe confirmação.</p>' +
        '<p><b>Alterações no torneio</b> — Se o organizador mudar data, local, formato ou outras configurações, você é notificado.</p>' +
        '<p><b>Comunicados do organizador</b> — O organizador pode enviar mensagens diretas para todos os inscritos, com nível de importância.</p>' +
        '<p><b>Lembretes</b> — Você recebe lembretes automáticos 7 dias, 2 dias e no dia do torneio.</p>' +
        '<p><b>Torneios próximos</b> — Se você preencheu CEPs no perfil, é notificado quando abrem inscrições para torneios perto de você.</p>' +
        '<p><b>Convites de amizade</b> — Receba e responda convites de amizade diretamente nas notificações.</p>' +
        '<p><b>Níveis</b> — Fundamentais (inscrição, dia do torneio), Importantes (alterações, 2 dias antes), Gerais (7 dias antes, torneios próximos, comunicados). Você escolhe no perfil o que receber.</p>'
    },
    {
      id: 'explorar',
      title: 'Explorar e Comunidade',
      icon: '🌐',
      content: '<p><b>Aba Explorar</b> — Encontre outros jogadores e faça amizades na comunidade.</p>' +
        '<p><b>Pedidos de amizade</b> — No topo aparecem pedidos pendentes para aceitar ou recusar.</p>' +
        '<p><b>Seus amigos</b> — Lista de amigos com avatar, cidade, esportes e idade. Você pode remover amigos.</p>' +
        '<p><b>Conhecidos</b> — Jogadores de torneios que você participou mas que ainda não são amigos. Ótimo para expandir sua rede.</p>' +
        '<p><b>Buscar</b> — Use a barra de busca para encontrar jogadores por nome, cidade ou esporte. Envie convites de amizade diretamente.</p>'
    },
    {
      id: 'organizador',
      title: 'Dicas para Organizadores',
      icon: '🛠️',
      content: '<p><b>Visão de Organizador</b> — Use o botão "Visão: Organizador / Participante" no cabeçalho para alternar entre as perspectivas. Na visão de organizador, você vê todos os controles de gerenciamento.</p>' +
        '<p><b>Comunicar inscritos</b> — Na página do torneio, use o botão "Comunicar Inscritos" para enviar mensagens para todos os participantes. Escolha o nível de importância para respeitar as preferências de cada usuário.</p>' +
        '<p><b>Adicionar participantes</b> — Você pode adicionar participantes manualmente (nomes) ou bots para testes.</p>' +
        '<p><b>Regras e histórico</b> — A aba "Regras" mostra todas as configurações do torneio de forma transparente, além do log de ações (quem fez o quê e quando).</p>' +
        '<p><b>Logo</b> — Gere um logo automático para dar identidade visual ao seu torneio. Ele aparece nos cards da dashboard e na página de detalhe.</p>'
    },
    {
      id: 'local',
      title: 'Local e Quadras',
      icon: '📍',
      content: '<p><b>Busca de local</b> — Ao criar um torneio, digite o nome do local e o sistema busca automaticamente no mapa com endereço completo e foto.</p>' +
        '<p><b>Acesso</b> — Defina o tipo de acesso: aberto ao público, apenas sócios, ou com convite.</p>' +
        '<p><b>Quadras</b> — Configure o número de quadras/campos disponíveis (1 a 50) e dê nomes personalizados a cada uma.</p>' +
        '<p><b>Estimativa de duração</b> — O sistema calcula automaticamente a duração estimada do torneio baseado no número de participantes, quadras, tempo de aquecimento e duração média das partidas.</p>' +
        '<p><b>Foto do local</b> — Se disponível, a foto do local aparece como fundo nos cards do torneio.</p>'
    },
    {
      id: 'desempate',
      title: 'Critérios de Desempate',
      icon: '⚖️',
      content: '<p>Em caso de empate na classificação, o scoreplace.app usa critérios configuráveis pelo organizador:</p>' +
        '<p><b>Confronto Direto</b> — Quem ganhou no confronto entre os empatados.</p>' +
        '<p><b>Saldo de Pontos</b> — Diferença entre pontos feitos e sofridos.</p>' +
        '<p><b>Número de Vitórias</b> — Quem tem mais vitórias totais.</p>' +
        '<p><b>Buchholz</b> — Força dos adversários enfrentados (usado muito no xadrez).</p>' +
        '<p><b>Sonneborn-Berger</b> — Qualidade das vitórias (pontos dos adversários derrotados).</p>' +
        '<p><b>Sorteio</b> — Desempate aleatório como último recurso.</p>' +
        '<p>O organizador pode arrastar para reordenar a prioridade dos critérios na criação do torneio.</p>'
    },
    {
      id: 'notas-versoes',
      title: 'Notas das Versões',
      icon: '📋',
      content: '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.1.6-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Logo de Torneio</b> — Geração automática de logo via Canvas com paletas temáticas por esporte. Considera nome, local, modalidade e formato. Botões para regerar, travar, baixar e fazer upload de imagem própria. Logo aparece nos cards da dashboard e na página do torneio.</p>' +
        '<p><b>Sistema de Notificações</b> — Notificações para inscrição/desinscrição, alterações no torneio pelo organizador, lembretes automáticos (7 dias, 2 dias e no dia do torneio), e torneios abertos próximos ao seu CEP de preferência.</p>' +
        '<p><b>Comunicação do Organizador</b> — Novo botão "Comunicar Inscritos" permite ao organizador enviar mensagens para todos os participantes, escolhendo o nível de importância (Fundamental, Importante ou Geral).</p>' +
        '<p><b>Filtros de Notificação</b> — No perfil, botões "Só Importantes" e "Só Fundamentais" permitem filtrar quais comunicações você deseja receber. Por padrão, todas estão ativas.</p>' +
        '<p><b>CEP de Preferência</b> — Novo campo no perfil para informar seus CEPs preferidos e ser notificado sobre torneios próximos.</p>' +
        '<p><b>Central de Ajuda</b> — Botão "?" no cabeçalho substitui o antigo "Sobre". Manual completo com 17 seções pesquisáveis, incluindo esta de notas de versão.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.1.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Explorar e Comunidade</b> — Nova aba para encontrar jogadores, enviar pedidos de amizade, ver conhecidos de torneios anteriores e buscar por nome, cidade ou esporte.</p>' +
        '<p><b>Dashboard aprimorada</b> — Cards de resumo clicáveis, filtros por modalidade/local/formato com pills coloridas, cards de torneio com foto do local como fundo.</p>' +
        '<p><b>Notificações</b> — View dedicada para visualizar notificações recebidas.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.1.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Lançamento Alpha</b> — Primeira versão funcional com Firebase Auth (Google Sign-In), Cloud Firestore, 5 formatos de torneio, criação rápida, fluxo de convite por link/WhatsApp/e-mail, CSS responsivo completo, 5 temas visuais e busca de local via Google Places.</p>' +
        '</div>' +
        '<p style="font-size:0.7rem; color:var(--text-muted); opacity:0.7; text-align:center; margin-top:1rem;">scoreplace.app está em fase Alpha. Novas funcionalidades são adicionadas frequentemente!</p>'
    }
  ];

  // Build sections HTML
  var sectionsHtml = '';
  for (var i = 0; i < helpSections.length; i++) {
    var s = helpSections[i];
    sectionsHtml += '<div class="help-section" data-help-id="' + s.id + '" data-search="' + (s.title + ' ' + s.content).replace(/<[^>]+>/g, '').toLowerCase() + '" style="margin-bottom: 1rem;">' +
      '<div onclick="this.parentElement.classList.toggle(\'open\')" style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.12); border-radius:10px; cursor:pointer; transition:all 0.2s; user-select:none;" onmouseover="this.style.background=\'rgba(99,102,241,0.12)\'" onmouseout="this.style.background=\'rgba(99,102,241,0.06)\'">' +
        '<span style="font-size:1.2rem; flex-shrink:0;">' + s.icon + '</span>' +
        '<span style="font-size:0.85rem; font-weight:600; color:var(--text-bright); flex:1;">' + s.title + '</span>' +
        '<span class="help-chevron" style="font-size:0.7rem; color:var(--text-muted); transition:transform 0.2s;">&#9660;</span>' +
      '</div>' +
      '<div class="help-body" style="display:none; padding:12px 14px 8px; font-size:0.8rem; color:var(--text-main); line-height:1.7;">' + s.content + '</div>' +
    '</div>';
  }

  var html = '<div class="modal-overlay" id="modal-help">' +
    '<div class="modal" style="max-width:560px; padding:0; max-height:85vh; display:flex; flex-direction:column;">' +
      '<div style="padding:1.5rem 1.5rem 1rem; flex-shrink:0;">' +
        '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">' +
          '<h2 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text-bright);">Central de Ajuda</h2>' +
          '<button onclick="if(typeof closeModal===\'function\')closeModal(\'modal-help\');" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.3rem; padding:4px 8px; line-height:1;">✕</button>' +
        '</div>' +
        '<input type="text" id="help-search-input" placeholder="Buscar no manual..." style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid var(--border-color); background:var(--bg-darker); color:var(--text-color); font-size:0.85rem; outline:none;" oninput="window._filterHelpSections(this.value)">' +
      '</div>' +
      '<div id="help-sections-container" style="padding:0 1.5rem 1.5rem; overflow-y:auto; flex:1;">' +
        sectionsHtml +
        '<div id="help-no-results" style="display:none; text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:0.85rem;">Nenhum resultado encontrado. Tente outras palavras.</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', html);

  // Add CSS for open/close animation
  var style = document.createElement('style');
  style.textContent = '.help-section.open .help-body { display: block !important; } .help-section.open .help-chevron { transform: rotate(180deg); } .help-section .help-body p { margin: 0 0 8px; } .help-section .help-body p:last-child { margin-bottom: 0; }';
  document.head.appendChild(style);

  // Auto-open "Sobre" section by default
  var aboutSection = document.querySelector('.help-section[data-help-id="about"]');
  if (aboutSection) aboutSection.classList.add('open');

  // Search/filter function
  window._filterHelpSections = function(query) {
    var q = (query || '').toLowerCase().trim();
    var sections = document.querySelectorAll('#help-sections-container .help-section');
    var noResults = document.getElementById('help-no-results');
    var visibleCount = 0;

    sections.forEach(function(sec) {
      var searchData = sec.getAttribute('data-search') || '';
      if (!q || searchData.indexOf(q) !== -1) {
        sec.style.display = '';
        visibleCount++;
        // Auto-open matching sections when searching, close non-matching
        if (q) {
          sec.classList.add('open');
        }
      } else {
        sec.style.display = 'none';
        sec.classList.remove('open');
      }
    });

    // If search is empty, close all except "about"
    if (!q) {
      sections.forEach(function(sec) {
        if (sec.getAttribute('data-help-id') !== 'about') sec.classList.remove('open');
        else sec.classList.add('open');
      });
    }

    if (noResults) noResults.style.display = visibleCount === 0 ? '' : 'none';
  };
})();

// === Modal Criação Rápida ===
(function setupQuickCreateModal() {
  if (document.getElementById('modal-quick-create')) return;
  const html = `
    <div class="modal-overlay" id="modal-quick-create">
      <div class="modal" style="max-width:420px; padding:2rem;">
        <h2 style="margin:0 0 1.25rem; font-size:1.3rem; font-weight:700; color:var(--text-bright); text-align:center;">Novo Torneio</h2>
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label">Modalidade Esportiva</label>
          <select class="form-control" id="quick-create-sport">
            <option>🎾 Beach Tennis</option>
            <option>⚽ Futebol</option>
            <option>🃏 Magic / TCG</option>
            <option>🎾 Tênis</option>
            <option>🏐 Vôlei</option>
            <option>♟️ Xadrez</option>
            <option>🎴 Dominó</option>
            <option>🏸 Padel</option>
            <option>🥒 Pickleball</option>
            <option>🏓 Tênis de Mesa</option>
            <option>🃏 Truco</option>
            <option>🏅 Outro</option>
          </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary" id="btn-quick-create" style="width:100%; padding:0.7rem; font-weight:600; font-size:1rem;">
            🏆 Criar Torneio
          </button>
          <button class="btn btn-secondary" id="btn-quick-advanced" style="width:100%; padding:0.6rem;">
            ⚙️ Detalhes Avançados
          </button>
          <button class="btn btn-secondary" onclick="if(typeof closeModal==='function')closeModal('modal-quick-create');" style="width:100%; padding:0.6rem;">
            Cancelar
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // Criar Torneio (rápido com auto-nome)
  document.getElementById('btn-quick-create').addEventListener('click', function () {
    const sportRaw = document.getElementById('quick-create-sport').value || '';
    const sportClean = sportRaw.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() || 'Esportes';
    const userName = (window.AppStore.currentUser && window.AppStore.currentUser.displayName)
      ? window.AppStore.currentUser.displayName.split(' ')[0] : 'Organizador';
    let autoName = 'Torneio Eliminatórias de ' + sportClean + ' de ' + userName;

    // Impede nome duplicado — adiciona sufixo numérico se necessário
    let suffix = 1;
    while (window.AppStore.tournaments.some(function(t) { return t.name && t.name.trim().toLowerCase() === autoName.toLowerCase(); })) {
      suffix++;
      autoName = 'Torneio Eliminatórias de ' + sportClean + ' de ' + userName + ' (' + suffix + ')';
    }

    const tourData = {
      id: 'tour_' + Date.now(),
      name: autoName,
      sport: sportRaw,
      format: 'Eliminatórias Simples',
      isPublic: true,
      enrollment: 'individual',
      status: 'open',
      createdAt: new Date().toISOString(),
      organizerId: window.AppStore.currentUser ? window.AppStore.currentUser.uid : 'local',
      organizerName: window.AppStore.currentUser ? window.AppStore.currentUser.displayName : 'Organizador',
      organizerEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local',
      participants: [],
      matches: [],
      tiebreakers: ['confronto_direto', 'saldo_pontos', 'vitorias', 'buchholz', 'sonneborn_berger', 'sorteio']
    };

    window.AppStore.addTournament(tourData);
    if (typeof closeModal === 'function') closeModal('modal-quick-create');
    window.location.hash = '#tournaments/' + tourData.id;
    if (typeof showNotification === 'function') {
      showNotification('Torneio Criado!', autoName, 'success');
    }
  });

  // Detalhes Avançados — abre formulário completo com sport pré-selecionado
  document.getElementById('btn-quick-advanced').addEventListener('click', function () {
    const sportVal = document.getElementById('quick-create-sport').value;
    if (typeof closeModal === 'function') closeModal('modal-quick-create');

    // Reset formulário completo
    const form = document.getElementById('form-create-tournament');
    if (form) form.reset();
    const editId = document.getElementById('edit-tournament-id');
    if (editId) editId.value = '';
    const title = document.getElementById('create-modal-title');
    if (title) title.innerText = 'Criar Novo Torneio';
    const pub = document.getElementById('tourn-public');
    if (pub) pub.checked = true;
    const liga = document.getElementById('liga-open-enrollment');
    if (liga) liga.checked = true;
    const tp = document.getElementById('elim-third-place');
    if (tp) tp.checked = true;

    // Pré-selecionar sport
    const sportSelect = document.getElementById('select-sport');
    if (sportSelect) {
      const opt = Array.from(sportSelect.options).find(o => o.value === sportVal || o.text === sportVal);
      if (opt) sportSelect.value = opt.value;
      if (typeof window._onSportChange === 'function') window._onSportChange();
    }

    if (typeof window._onFormatoChange === 'function') window._onFormatoChange();
    if (typeof openModal === 'function') openModal('modal-create-tournament');
    if (typeof window._initPlacesAutocomplete === 'function') {
      setTimeout(() => window._initPlacesAutocomplete(), 100);
    }
  });
})();

// Inicializa estrutura base da UI (Modais, Menus)
setupUI();

setupCreateTournamentModal();
setupLoginModal();
setupProfileModal();
setupResultModal();
setupEnrollModal();

// Inicia Lógica de Temas (Select Element)
initThemeSystem();

// Load cached tournaments for instant first-paint (before Firebase auth resolves)
if (window.AppStore && window.AppStore._loadFromCache) {
  window.AppStore._loadFromCache();
}

// Inicia o Roteador SPA
// Firebase onAuthStateChanged will handle auto-login and real-time data from Firestore
initRouter();

console.log("scoreplace.app v" + (window.SCOREPLACE_VERSION || '?') + " Inicializado com Sucesso");
