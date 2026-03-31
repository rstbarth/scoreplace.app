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
        '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Versão ' + (window.SCOREPLACE_VERSION || '0.2.3-alpha') + '</div>' +
        '<div style="font-size:0.8rem; color:var(--text-main); margin-top:8px; line-height:1.6;">Plataforma de gestão de torneios esportivos e board games.</div>' +
        '<div style="font-size:0.7rem; color:var(--text-muted); opacity:0.6; margin-top:4px;">Fase Alpha — funcionalidades em desenvolvimento.</div>' +
        '</div>' +
        '<div style="background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:10px; padding:12px 14px; margin-bottom:1rem;">' +
        '<div style="font-weight:700; font-size:0.85rem; color:#f59e0b; margin-bottom:6px;">⚠️ App em Desenvolvimento</div>' +
        '<p style="font-size:0.78rem; color:var(--text-main); line-height:1.6; margin:0;">Este aplicativo está em fase <b>Alpha</b> e pode apresentar bugs, erros e falhas inesperadas. Estamos trabalhando continuamente para melhorar a experiência. Sua paciência e feedback são fundamentais!</p>' +
        '</div>' +
        '<div style="text-align:center; margin-bottom:1rem;">' +
        '<button onclick="(function(){' +
        "var v=window.SCOREPLACE_VERSION||'?';" +
        "var ua=navigator.userAgent;" +
        "var user=(window.AppStore&&window.AppStore.currentUser)?window.AppStore.currentUser.displayName:'(não logado)';" +
        "var email=(window.AppStore&&window.AppStore.currentUser)?window.AppStore.currentUser.email:'';" +
        "var subject=encodeURIComponent('scoreplace.app v'+v+' — Feedback');" +
        "var body=encodeURIComponent(" +
        "'Olá equipe scoreplace!\\n\\n'" +
        "+'Descreva aqui o problema ou sugestão:\\n\\n\\n'" +
        "+'---\\n'" +
        "+'Versão: '+v+'\\n'" +
        "+'Usuário: '+user+'\\n'" +
        "+'Email: '+email+'\\n'" +
        "+'Dispositivo: '+ua+'\\n'" +
        "+'Data: '+new Date().toLocaleString('pt-BR')+'\\n'" +
        ");" +
        "window.open('mailto:rstbarth@gmail.com?subject='+subject+'&body='+body,'_blank');" +
        '})()" style="display:inline-flex; align-items:center; gap:8px; padding:10px 20px; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); color:#fff; border:none; border-radius:10px; font-size:0.85rem; font-weight:600; cursor:pointer; box-shadow:0 2px 8px rgba(99,102,241,0.3); transition:all 0.2s;" onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 12px rgba(99,102,241,0.4)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 2px 8px rgba(99,102,241,0.3)\'">' +
        '<span style="font-size:1.1rem;">📩</span> Reportar Problema ou Sugestão</button>' +
        '</div>' +
        '<p style="font-size:0.7rem; color:var(--text-muted); text-align:center; margin-bottom:0.5rem;">Ao clicar, será aberto seu app de e-mail com informações técnicas preenchidas automaticamente para nos ajudar a resolver mais rápido.</p>' +
        '<div style="font-size:0.7rem; color:var(--text-muted); margin-top:8px; text-align:center;">© 2026 scoreplace.app. Todos os direitos reservados.</div>'
    },
    {
      id: 'primeiros-passos',
      title: 'Primeiros Passos',
      icon: '🚀',
      content: '<p><b>Bem-vindo ao scoreplace.app!</b> Aqui vai um guia rápido para começar:</p>' +
        '<p><b>1. Faça login</b> — Clique no botão de login no canto superior direito. Você pode criar uma conta com e-mail e senha ou entrar com sua rede social preferida (Google, Facebook ou Apple). Seu perfil é criado automaticamente.</p>' +
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
        '<p><b>Liga</b> — Temporada contínua com classificação por pontos corridos. Duração configurável (indefinida, 3, 6, 12 meses ou personalizada). Inscrições podem permanecer abertas durante toda a temporada. Sorteios automáticos ou manuais com intervalo configurável. Regras de inatividade e pontuação de novos jogadores. Ideal para comunidades que jogam regularmente.</p>'
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
        '<p><b>Iniciar torneio</b> — Após o sorteio, o organizador clica em "Iniciar Torneio" para habilitar check-in e lançamento de resultados.</p>' +
        '<p><b>Enquete entre participantes</b> — Em eliminatórias, quando há times incompletos ou o número de inscritos não é potência de 2, o organizador pode abrir uma enquete para que os próprios participantes votem na solução preferida (BYE, repescagem, lista de espera, etc.). O prazo padrão é 48h com contagem regressiva ao vivo. A opção recomendada é calculada pelo equilíbrio de Nash (maximizando justiça, inclusão e praticidade). Antes de votar, o participante vê apenas as descrições das opções; após votar, o resultado parcial e seu voto são revelados. É possível mudar o voto até o encerramento.</p>'
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
      content: '<p><b>Dentro do torneio</b> — Clique em "Convidar" para abrir o painel de convites. Você tem 5 opções:</p>' +
        '<p><b>Amigos na plataforma</b> — Selecione amigos que já têm conta no scoreplace.app. Eles recebem uma notificação direta.</p>' +
        '<p><b>QR Code</b> — Um código QR exclusivo é gerado para o torneio. Basta apontar a câmera do celular para escanear e acessar a página de inscrição. Ideal para compartilhar presencialmente em eventos, quadras e academias.</p>' +
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
      id: 'categorias',
      title: 'Categorias',
      icon: '🏷️',
      content: '<p>O organizador pode definir categorias para qualquer formato de torneio, permitindo que participantes de diferentes perfis disputem separadamente:</p>' +
        '<p><b>Categorias de gênero</b> — Botões de alternância: Feminino (♀), Masculino (♂), Misto Aleatório (⚥) e Misto Obrigatório (⚤). Não são excludentes — o organizador pode ativar quantos quiser.</p>' +
        '<p><b>Categorias de habilidade</b> — Campo de texto livre onde o organizador digita as categorias separadas por vírgula (ex: A, B, C, D).</p>' +
        '<p><b>Categorias combinadas</b> — O sistema combina automaticamente gênero × habilidade. Exemplo: ativando Fem + Masc e digitando A, B gera: Fem A, Fem B, Masc A, Masc B.</p>' +
        '<p><b>Inscrição com categoria</b> — Ao se inscrever em um torneio com categorias, o participante escolhe a categoria desejada. Se o perfil já tiver gênero preenchido, as opções são filtradas automaticamente.</p>' +
        '<p><b>Sorteio e chaves por categoria</b> — O sorteio gera confrontos separados por categoria. Participantes só enfrentam adversários da mesma categoria.</p>' +
        '<p><b>Classificação por categoria</b> — A tabela de classificação mostra resultados separados por categoria em formatos Liga e Suíço.</p>' +
        '<p><b>Misto Obrigatório</b> — Times devem ter 50% homens e 50% mulheres.</p>' +
        '<p><b>Misto Aleatório</b> — Aceita homens e mulheres sem restrição de proporção. A composição é definida pelo sorteio.</p>' +
        '<p><b>Gerenciar categorias</b> — O botão "Categorias" permite ao organizador: ver quantos inscritos há em cada categoria (agrupados por gênero), mesclar categorias por arrastar e soltar (ex: Fem A + Fem B → Fem A/B), e atribuir categoria a participantes sem categoria. Clique em uma categoria para ver os inscritos. Categorias mescladas exibem um ícone de desmesclagem no canto superior direito, permitindo desfazer a mesclagem e reatribuir participantes às categorias originais.</p>' +
        '<p><b>Remover participante da categoria</b> — Na visualização detalhada de uma categoria, cada card de participante tem um botão para removê-lo daquela categoria. O participante fica "sem categoria" e pode ser reatribuído a qualquer outra.</p>' +
        '<p><b>Atribuição automática</b> — Quando o organizador cria categorias em um torneio que já tem inscritos, os participantes com gênero no perfil são atribuídos automaticamente. O badge "(perfil)" indica que a categoria veio do perfil do participante.</p>' +
        '<p><b>Notificação de categoria</b> — Participantes atribuídos a uma categoria recebem uma notificação ao acessar o torneio, com opção de questionar o organizador por e-mail.</p>' +
        '<p><b>Histórico</b> — Participantes que se inscreveram sem categoria e depois foram alocados mostram o indicador "(sem cat.)" ao lado da categoria, mantendo o histórico de que a inscrição ocorreu antes das categorias.</p>'
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
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.15-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Suas Próximas Partidas</b> — O dashboard agora exibe um widget com suas partidas pendentes em torneios ativos. Mostra o oponente, torneio e esporte — clique para ir direto à partida.</p>' +
        '<p><b>Modo Offline</b> — Banner informativo quando a conexão cai e confirmação quando reconecta. Complemento do PWA para melhor experiência offline.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.14-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Filtro de Torneios</b> — A lista de torneios agora possui barra de busca por nome, esporte ou formato, além de filtro por status (Inscrições Abertas, Em Andamento, Encerrados). Filtragem instantânea sem recarregar a página.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.13-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>PWA — Instale no celular!</b> — scoreplace.app agora pode ser instalado como app no seu dispositivo. Acesse pelo navegador e toque em "Adicionar à tela inicial". Carregamento mais rápido com cache inteligente (stale-while-revalidate).</p>' +
        '<p><b>Histórico de Torneios</b> — O perfil agora mostra a lista dos últimos torneios com posição final (🥇🥈🥉), formato e status. Clique para ir direto ao torneio.</p>' +
        '<p><b>Temporada Liga — Auto-encerramento</b> — Torneios Liga com duração de temporada definida agora são encerrados automaticamente quando o prazo expira. Standings finais são calculados e salvos. Aviso visual "⚠️ X dias restantes" quando faltam 7 dias ou menos.</p>' +
        '<p><b>Segurança</b> — Nomes de participantes são agora sanitizados contra XSS na lista de participantes. Utilitário global <code>_safeHtml()</code> disponível para uso em todo o app.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.11-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Meu Desempenho</b> — O perfil do jogador agora exibe estatísticas pessoais: torneios participados, partidas jogadas, vitórias, derrotas, empates, aproveitamento (%) e títulos conquistados. Os dados são calculados em tempo real a partir de todos os torneios no sistema.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.10-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Validação de datas</b> — Ao criar ou editar torneio, o sistema agora valida que a data de fim é posterior à de início e que o prazo de inscrição é anterior ao início.</p>' +
        '<p><b>Inscrição automática</b> — Se a inscrição automática após login falhar (conexão lenta), o usuário agora recebe um aviso para tentar manualmente.</p>' +
        '<p><b>Migração Liga/Ranking</b> — Ao salvar torneio no formato Liga, campos legados do formato Ranking são removidos automaticamente do banco de dados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Fase de Grupos — empates</b> — Empates agora são contabilizados corretamente na classificação dos grupos e no cross-seeding para a fase eliminatória (1 ponto por empate).</p>' +
        '<p><b>Dupla Eliminatória — limpeza</b> — Removido código morto na geração do lower bracket que poderia causar inconsistências.</p>' +
        '<p><b>Notificações seguras</b> — Mensagens de notificação agora são sanitizadas contra XSS. Convites de torneio exibem botão "Ver Torneio" direto na notificação.</p>' +
        '<p><b>Exclusão de torneio</b> — Feedback de erro melhorado quando a exclusão no servidor falha.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.8-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Botão Encerrar Torneio</b> — O organizador agora pode encerrar qualquer torneio manualmente a qualquer momento. Confirmação com aviso de partidas pendentes.</p>' +
        '<p><b>Pódio / Classificação Final</b> — Torneios encerrados exibem pódio visual com 🥇🥈🥉 na página de detalhes. Eliminatórias mostram campeão, vice e 3º lugar. Suíço/Liga mostram top 3 por pontos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.7-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Encerramento automático</b> — Torneios Eliminatórias e Dupla Eliminatória agora são marcados como "Encerrado" automaticamente quando todas as partidas (incluindo disputa de 3º lugar) são concluídas. Status "🏆 Encerrado" exibido no dashboard e nos detalhes do torneio.</p>' +
        '<p><b>Status padronizado</b> — Corrigida inconsistência onde torneios Suíço encerrados não eram reconhecidos como finalizados pelo dashboard e outras telas. Inscrições bloqueadas em torneios encerrados.</p>' +
        '<p><b>Dashboard corrigido</b> — Detecção de sorteio no dashboard agora usa verificação correta para arrays vazios, evitando falsos positivos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.6-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Liga unificada</b> — Os formatos Liga e Ranking foram unificados em um único formato "Liga" com todas as opções combinadas: duração de temporada (indefinida, 3, 6, 12 meses ou personalizada), inscrições abertas configuráveis, agendamento de sorteios automáticos, regras de inatividade e pontuação de novos jogadores. Torneios existentes no formato Ranking continuam funcionando normalmente.</p>' +
        '<p><b>Empate em Liga/Suíço</b> — Empates agora são permitidos em partidas de Liga e Suíço (1 ponto para cada). Classificação atualizada com coluna "E" (empates). Cálculo de Buchholz e Sonneborn-Berger corrigido para considerar empates.</p>' +
        '<p><b>Proteção contra re-sorteio</b> — Refazer o sorteio agora pede confirmação. Se já houver resultados registrados, avisa que serão perdidos.</p>' +
        '<p><b>Eliminatórias com categorias</b> — Torneios Eliminatórias agora geram chaveamento separado por categoria (Masc, Fem, Misto, etc.).</p>' +
        '<p><b>Validação pré-sorteio</b> — Participantes sem categoria são identificados com aviso antes do sorteio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.4-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Auto-inscrição com categorias</b> — Ao aceitar convite, o participante agora é inscrito automaticamente na categoria correta com base no gênero do perfil. Organizador recebe notificação da nova inscrição.</p>' +
        '<p><b>Cancelar inscrição seguro</b> — Corrigido bug onde nomes parciais podiam causar remoção do participante errado (ex: "Ana" removendo "Ana Paula"). Agora usa comparação exata.</p>' +
        '<p><b>Criar torneio — limpeza</b> — Removida referência a campo de periodicidade de Liga que não existia mais no HTML, eliminando erros silenciosos na criação e edição.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.3-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Detecção de mesclagem aprimorada</b> — O ícone de desmesclar agora aparece em qualquer categoria resultante de mesclagem: categorias com "/" no nome (ex: "Fem A/B"), prefixos puros quando há categorias de habilidade (ex: "Masc"), e categorias com histórico de mesclagem. Unmerge inferido para categorias sem mergeHistory.</p>' +
        '<p><b>Cache-buster por versão</b> — Todos os arquivos JS e CSS agora usam ?v=0.2.3-alpha em vez de numeração sequencial, facilitando o rastreamento de versão no cache do navegador.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.2-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Enquete entre participantes</b> — Nova opção nos painéis de resolução de times incompletos e ajuste de potência de 2. O organizador cria uma enquete com prazo (padrão 48h), e os inscritos votam na solução preferida. Contagem regressiva ao vivo, notificação automática, voto secreto antes de votar e resultados revelados após o voto. A opção recomendada é calculada pelo equilíbrio de Nash. Organizador aplica o resultado com um clique.</p>' +
        '<p><b>Desmesclar categorias</b> — Categorias mescladas agora mostram um ícone de desmesclagem. Ao clicar, desfaz a mesclagem e reatribui participantes às categorias originais usando histórico de mesclagem.</p>' +
        '<p><b>Remover participante da categoria</b> — No detalhe da categoria, cada card de jogador tem botão para removê-lo, deixando-o como "sem categoria" para reatribuição.</p>' +
        '<p><b>Simplificação Misto</b> — "Misto Aleatório" e "Misto Obrigatório" são exibidos como "Misto" em cards, badges e inscrição. Nome completo apenas nas regras, card do torneio e detalhes.</p>' +
        '<p><b>Multi-categoria</b> — Participantes podem se inscrever em categorias não-excludentes (ex: Masc A + Misto A). Categorias Fem/Masc são mutuamente exclusivas (radio); Misto é aditivo (checkbox).</p>' +
        '<p><b>Ordenação de mesclagem</b> — Ao mesclar categorias, os sufixos são ordenados por força (A antes de B). Se todas as habilidades forem mescladas, simplifica para apenas o prefixo (ex: "Masc" ao invés de "Masc A/B/C/D").</p>' +
        '<p><b>Handler de times incompletos</b> — Implementada a função _handleIncompleteOption que estava ausente, habilitando todas as opções do painel de resolução.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.1-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Gerenciador de Categorias redesenhado</b> — Categorias agora aparecem acima dos participantes sem categoria. Cards compactos (sem lista de nomes, apenas contagem). Categorias agrupadas por gênero na mesma linha (Fem, Masc, etc.). Clique em uma categoria para ver os inscritos em detalhe com avatar e e-mail.</p>' +
        '<p><b>Navegação no gerenciador</b> — Botão "Voltar" abaixo do título em ambas as telas (visão geral e detalhe da categoria). Botão × mantido no canto superior direito para fechar.</p>' +
        '<p><b>Drag-and-drop corrigido</b> — Arrastar e soltar participantes para categorias agora funciona de forma consistente para todos os participantes (não apenas o primeiro). Suporte a toque para dispositivos móveis.</p>' +
        '<p><b>Atribuição automática de categorias</b> — Quando o organizador cria ou edita categorias em um torneio com inscritos, participantes com gênero no perfil são atribuídos automaticamente à categoria correspondente. Badge "(perfil)" indica a origem da atribuição.</p>' +
        '<p><b>Indicadores de categoria nos participantes</b> — "(perfil)" para categorias atribuídas pelo perfil; "(sem cat.)" em vermelho para participantes sem categoria; "(sem cat.)" ao lado da categoria para quem foi alocado manualmente, preservando o histórico.</p>' +
        '<p><b>Notificação de atribuição de categoria</b> — Participantes recebem um alerta ao acessar o torneio informando sua categoria atribuída, com botão "Questionar Organizador" que abre e-mail pré-preenchido.</p>' +
        '<p><b>Gênero salvo na inscrição</b> — O gênero do perfil do participante é agora salvo no registro de inscrição, permitindo atribuição automática futura caso categorias sejam adicionadas depois.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Formato Ranking</b> — Novo formato de torneio com temporada contínua (3, 6, 12 meses ou personalizado). Inscrições permanecem abertas durante toda a temporada. O botão "Encerrar Inscrições" não aparece. Estimativa de tempo é ocultada dos detalhes.</p>' +
        '<p><b>Sorteios automáticos</b> — Formatos Ranking e Suíço agora suportam sorteios periódicos. O organizador define data/hora do primeiro sorteio e intervalo em dias para os próximos. Contagem regressiva (dias, horas, minutos) é exibida tanto na view de detalhes quanto na classificação. Modo manual disponível via toggle.</p>' +
        '<p><b>Sistema de Categorias</b> — Funcionalidade transversal a todos os formatos de torneio. O organizador define categorias de gênero (Feminino, Masculino, Misto Aleatório, Misto Obrigatório) via botões toggle e categorias de habilidade (A, B, C, D...) via campo de texto. O sistema gera automaticamente as categorias combinadas (ex: Fem A, Fem B, Masc A, Masc B) com preview em tempo real.</p>' +
        '<p><b>Inscrição com categoria</b> — Torneios com categorias pedem ao participante que escolha sua categoria no ato da inscrição. Se o perfil já tiver gênero, as opções são filtradas automaticamente. Modal de seleção com botões estilizados para múltiplas opções; confirmação automática quando há apenas uma opção elegível.</p>' +
        '<p><b>Sorteio e classificação por categoria</b> — O algoritmo de emparelhamento Suíço agora gera confrontos separados por categoria. Cada categoria tem sua própria tabela de classificação com pontuação, vitórias, derrotas, saldo e desempates independentes.</p>' +
        '<p><b>Gerenciador de Categorias</b> — Botão "Categorias" na view de detalhes permite ao organizador: visualizar cards de cada categoria com contagem de inscritos e lista de nomes; mesclar categorias por arrastar e soltar (Fem A + Fem B → Fem A/B) com confirmação e renomeação inteligente; atribuir categoria a participantes sem categoria arrastando-os para o card desejado. Categoria original preservada no registro.</p>' +
        '<p><b>Convite por QR Code</b> — Painel de convite agora inclui QR Code exclusivo do torneio, gerado automaticamente. Basta apontar a câmera do celular para escanear e acessar a inscrição. Ideal para compartilhar em eventos presenciais.</p>' +
        '<p><b>Dashboard</b> — Texto alterado de "Inscrições Abertas" para "Inscrições Disponíveis" na saudação do dashboard.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.1.6-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Logo de Torneio</b> — Geração automática de logo via Canvas com paletas temáticas por esporte. Botões para regerar, travar, baixar e upload de imagem própria.</p>' +
        '<p><b>Sistema de Notificações</b> — Notificações para inscrição/desinscrição, alterações, lembretes automáticos e torneios próximos ao CEP.</p>' +
        '<p><b>Central de Ajuda</b> — Manual completo com seções pesquisáveis.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.1.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Explorar e Comunidade</b> — Nova aba para encontrar jogadores, enviar pedidos de amizade, ver conhecidos de torneios anteriores e buscar por nome, cidade ou esporte.</p>' +
        '<p><b>Dashboard aprimorada</b> — Cards de resumo clicáveis, filtros por modalidade/local/formato com pills coloridas, cards de torneio com foto do local como fundo.</p>' +
        '<p><b>Notificações</b> — View dedicada para visualizar notificações recebidas.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.1.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Lançamento Alpha</b> — Primeira versão funcional com Firebase Auth (e-mail/senha, Google, Facebook, Apple), Cloud Firestore, 5 formatos de torneio, criação rápida, fluxo de convite por link/WhatsApp/e-mail, CSS responsivo completo, 5 temas visuais e busca de local via Google Places.</p>' +
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

// === Offline/Online indicator ===
(function() {
  var banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:10px 16px;text-align:center;font-size:0.85rem;font-weight:600;transition:transform 0.3s ease;';
  banner.innerHTML = '<span id="offline-banner-text"></span>';
  document.body.appendChild(banner);

  function showBanner(text, bg, color, autoHide) {
    var b = document.getElementById('offline-banner');
    var t = document.getElementById('offline-banner-text');
    if (!b || !t) return;
    t.textContent = text;
    b.style.background = bg;
    b.style.color = color;
    b.style.display = 'block';
    b.style.transform = 'translateY(0)';
    if (autoHide) {
      setTimeout(function() {
        b.style.transform = 'translateY(100%)';
        setTimeout(function() { b.style.display = 'none'; }, 350);
      }, 3000);
    }
  }

  window.addEventListener('offline', function() {
    showBanner('Sem conexão — modo offline', 'rgba(239,68,68,0.95)', '#fff', false);
  });
  window.addEventListener('online', function() {
    showBanner('Conexão restaurada', 'rgba(16,185,129,0.95)', '#fff', true);
  });

  // Show immediately if already offline
  if (!navigator.onLine) {
    showBanner('Sem conexão — modo offline', 'rgba(239,68,68,0.95)', '#fff', false);
  }
})();
