// Retiramos o DOMContentLoaded event para evitar condição de corrida com ES Modules (type="module")
// já que o script está no final do <body> e o DOM já estará parseado.

// === Modal Ajuda / Manual ===
(function setupHelpModal() {
  if (document.getElementById('modal-help')) return;

  var _t = window._t || function(k) { return k; };
  var helpSections = [
    {
      id: 'about',
      title: _t('help.about'),
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
        '<button class="btn btn-indigo hover-lift" onclick="(function(){' +
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
        "window.open('mailto:scoreplace.app@gmail.com?subject='+subject+'&body='+body,'_blank');" +
        '})()">' +
        '<span style="font-size:1.1rem;">📩</span> Reportar Problema ou Sugestão</button>' +
        '</div>' +
        '<p style="font-size:0.7rem; color:var(--text-muted); text-align:center; margin-bottom:0.5rem;">Ao clicar, será aberto seu app de e-mail com informações técnicas preenchidas automaticamente para nos ajudar a resolver mais rápido.</p>' +
        '<div style="font-size:0.7rem; color:var(--text-muted); margin-top:8px; text-align:center;">© 2026 scoreplace.app. Todos os direitos reservados.</div>'
    },
    {
      id: 'primeiros-passos',
      title: _t('help.firstSteps'),
      icon: '🚀',
      content: '<p><b>Bem-vindo ao scoreplace.app!</b> Siga os passos abaixo para começar:</p>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Passo 1: Fazer Login</div>' +
          '<p>Clique no botão <b>"Entrar"</b> no canto superior direito da tela.</p>' +
          '<p style="font-weight:600;color:#34d399;margin-top:8px;">Forma mais rápida: Google</p>' +
          '<ol style="padding-left:20px;margin:6px 0;">' +
            '<li>Clique no botão <b>"Entrar com Google"</b> (botão branco grande no topo)</li>' +
            '<li>Uma janela do Google vai abrir. <b>Escolha sua conta</b> Google (ou digite seu e-mail Google)</li>' +
            '<li>O Google pode perguntar: <b>"Continuar para scoreplace.app?"</b> — clique em <b>"Continuar"</b></li>' +
            '<li>Se pedir permissões, clique em <b>"Permitir"</b> — usamos apenas para identificar você</li>' +
            '<li>Pronto! Você já está logado. Seu nome e foto aparecem no canto superior direito</li>' +
          '</ol>' +
          '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">Outras opções: Link Mágico (recebe um link por e-mail, sem senha), SMS (código no celular), ou E-mail e Senha tradicional.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Passo 2: Completar o Perfil</div>' +
          '<ol style="padding-left:20px;margin:6px 0;">' +
            '<li>Clique no seu <b>avatar</b> (foto ou iniciais) no canto superior direito</li>' +
            '<li>Preencha: <b>nome</b>, <b>gênero</b>, <b>cidade</b>, <b>esportes preferidos</b></li>' +
            '<li>Adicione seu <b>telefone</b> para receber notificações por WhatsApp</li>' +
            '<li>Marque seus <b>locais de preferência</b> no mapa para ser notificado de torneios próximos</li>' +
            '<li>Clique em <b>"Salvar"</b></li>' +
          '</ol>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Passo 3: Criar ou Participar de um Torneio</div>' +
          '<ol style="padding-left:20px;margin:6px 0;">' +
            '<li><b>Criar:</b> Na dashboard, clique em <b>"+ Novo Torneio"</b>, escolha o esporte e clique em "Criar Torneio"</li>' +
            '<li><b>Participar:</b> Navegue pelos torneios públicos em <b>"Explorar"</b> e clique em <b>"Inscrever-se"</b></li>' +
            '<li><b>Convite:</b> Se recebeu um link de convite, clique nele, faça login e você será inscrito automaticamente</li>' +
          '</ol>' +
        '</div>' +
        '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Passo 4: Convidar Amigos</div>' +
          '<ol style="padding-left:20px;margin:6px 0;">' +
            '<li>Dentro de um torneio, clique em <b>"Convidar"</b></li>' +
            '<li>Compartilhe via <b>WhatsApp</b>, <b>e-mail</b>, <b>QR Code</b> ou <b>link direto</b></li>' +
            '<li>Quem clicar no link e fizer login será inscrito automaticamente</li>' +
          '</ol>' +
        '</div>'
    },
    {
      id: 'dashboard',
      title: _t('help.dashboard'),
      icon: '📊',
      content: '<p>A <b>Dashboard</b> é sua página principal. Ela mostra um resumo dos seus torneios e permite filtrar de várias formas:</p>' +
        '<p><b>Cards de resumo</b> — No topo você vê cards clicáveis: "Meus Torneios" (que você organiza), "Participando" (que você está inscrito) e "Inscrições Abertas". Clique neles para filtrar os cards abaixo.</p>' +
        '<p><b>Filtros por modalidade, local e formato</b> — Logo abaixo dos cards de resumo, aparecem pills coloridas para filtrar por esporte (roxo), local (verde) e formato (amarelo). Clique em "✕ Limpar filtros" para voltar a ver tudo.</p>' +
        '<p><b>Cards de torneio</b> — Cada torneio aparece como um card com nome, esporte, data, número de inscritos e status. Se o torneio tem uma foto do local, ela aparece como fundo do card. Se tem logo, ele aparece ao lado do nome. Clique no card para ver os detalhes.</p>'
    },
    {
      id: 'criar-torneio',
      title: _t('help.createTournament'),
      icon: '➕',
      content: '<p>Existem duas formas de criar um torneio:</p>' +
        '<p><b>Criação rápida</b> — Clique em "+ Novo Torneio" na dashboard, escolha o esporte e clique em "Criar Torneio". Um torneio de eliminatórias simples é criado instantaneamente com nome automático.</p>' +
        '<p><b>Detalhes avançados</b> — Na criação rápida, clique em "Detalhes Avançados" para abrir o formulário completo onde você pode configurar:</p>' +
        '<p>Nome, esporte, formato (5 opções), datas de início/fim, prazo de inscrição, local (com busca automática no mapa), número de quadras, público ou privado, modo de inscrição (individual ou times), máximo de participantes, logo do torneio e muito mais.</p>' +
        '<p><b>Logo do torneio</b> — Você pode gerar um logo automático (baseado no nome, esporte, formato e local) ou fazer upload de uma imagem. Use o cadeado para travar o logo e evitar que ele mude ao editar o torneio. Você também pode baixar o logo gerado.</p>'
    },
    {
      id: 'formatos',
      title: _t('help.formats'),
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
      title: _t('help.enrollment'),
      icon: '✍️',
      content: '<p><b>Para se inscrever</b> — Abra o torneio e clique no botão "Inscrever-se". Se o torneio for por times, você precisará preencher os nomes dos integrantes da equipe.</p>' +
        '<p><b>Confirmação</b> — Após a inscrição, você será redirecionado para a página do torneio e verá seu nome destacado entre os inscritos.</p>' +
        '<p><b>Cancelar inscrição</b> — Clique em "Cancelar Inscrição" na página do torneio. Uma confirmação será pedida antes de remover.</p>' +
        '<p><b>Convites</b> — Se alguém te convidar para um torneio, você receberá um link. Ao clicar, basta fazer login (se necessário) e confirmar a inscrição.</p>' +
        '<p><b>Inscrição automática fechada</b> — Alguns torneios fecham inscrições automaticamente ao atingir o número máximo de participantes.</p>'
    },
    {
      id: 'sorteio',
      title: _t('help.draw'),
      icon: '🎲',
      content: '<p><b>Antes do sorteio</b> — O organizador pode abrir a "Janela Pré-Sorteio" para organizar os participantes por categoria, mover entre grupos e definir a ordem de cabeças de chave.</p>' +
        '<p><b>Realizar o sorteio</b> — O organizador clica em "Sortear" para gerar as chaves oficiais. Em eliminatórias, os confrontos são definidos aleatoriamente. Em grupos, os participantes são distribuídos nos grupos.</p>' +
        '<p><b>Visualizar chaves</b> — Após o sorteio, a aba "Chaves" mostra a estrutura do torneio: árvore de eliminatórias, tabela de grupos, classificação da liga, etc.</p>' +
        '<p><b>Iniciar torneio</b> — Após o sorteio, o organizador clica em "Iniciar Torneio" para habilitar check-in e lançamento de resultados.</p>' +
        '<p><b>Enquete entre participantes</b> — Em eliminatórias, quando há times incompletos ou o número de inscritos não é potência de 2, o organizador pode abrir uma enquete para que os próprios participantes votem na solução preferida (BYE, repescagem, lista de espera, etc.). O prazo padrão é 48h com contagem regressiva ao vivo. A opção recomendada é calculada pelo equilíbrio de Nash (maximizando justiça, inclusão e praticidade). Antes de votar, o participante vê apenas as descrições das opções; após votar, o resultado parcial e seu voto são revelados. É possível mudar o voto até o encerramento.</p>'
    },
    {
      id: 'checkin',
      title: _t('help.checkin'),
      icon: '✅',
      content: '<p><b>Check-in</b> — Depois que o torneio é iniciado, o organizador pode fazer a chamada de presença na aba "Inscritos". Cada participante pode ser marcado como Presente, Ausente ou Pendente.</p>' +
        '<p><b>Indicadores nas chaves</b> — Nas chaves, cada jogador tem um ponto colorido: verde (presente), vermelho (ausente), cinza (pendente). A partida aparece verde quando ambos estão presentes.</p>' +
        '<p><b>Ausência e W.O.</b> — Se um jogador é declarado ausente, o organizador pode dar W.O. (vitória automática ao adversário) ou substituir por um reserva (standby).</p>' +
        '<p><b>Lista de espera</b> — Participantes na lista de espera podem ser chamados para substituir ausentes.</p>'
    },
    {
      id: 'resultados',
      title: _t('help.results'),
      icon: '📝',
      content: '<p><b>Lançar resultado</b> — O organizador (ou os próprios jogadores, dependendo da configuração) pode clicar na partida para informar o placar.</p>' +
        '<p><b>Configurações de lançamento</b> — No formulário de criação, você define quem pode lançar resultados: apenas o organizador, pelos próprios jogadores (com aceite do adversário), ou por árbitro designado.</p>' +
        '<p><b>Progressão automática</b> — Em eliminatórias, o vencedor avança automaticamente para a próxima fase. Na liga e suíço, a classificação é atualizada em tempo real.</p>'
    },
    {
      id: 'convidar',
      title: _t('help.invite'),
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
      title: _t('help.profile'),
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
      title: _t('help.notifications'),
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
      title: _t('help.explore'),
      icon: '🌐',
      content: '<p><b>Aba Explorar</b> — Encontre outros jogadores e faça amizades na comunidade.</p>' +
        '<p><b>Pedidos de amizade</b> — No topo aparecem pedidos pendentes para aceitar ou recusar.</p>' +
        '<p><b>Seus amigos</b> — Lista de amigos com avatar, cidade, esportes e idade. Você pode remover amigos.</p>' +
        '<p><b>Conhecidos</b> — Jogadores de torneios que você participou mas que ainda não são amigos. Ótimo para expandir sua rede.</p>' +
        '<p><b>Buscar</b> — Use a barra de busca para encontrar jogadores por nome, cidade ou esporte. Envie convites de amizade diretamente.</p>'
    },
    {
      id: 'organizador',
      title: _t('help.organizers'),
      icon: '🛠️',
      content: '<p><b>Visão de Organizador</b> — Use o botão "Organizador / Participante" no cabeçalho para alternar entre as perspectivas. Na visão de organizador, você vê todos os controles de gerenciamento.</p>' +
        '<p><b>Comunicar inscritos</b> — Na página do torneio, use o botão "Comunicar Inscritos" para enviar mensagens para todos os participantes. Escolha o nível de importância para respeitar as preferências de cada usuário.</p>' +
        '<p><b>Adicionar participantes</b> — Você pode adicionar participantes manualmente (nomes) ou bots para testes.</p>' +
        '<p><b>Regras e histórico</b> — A aba "Regras" mostra todas as configurações do torneio de forma transparente, além do log de ações (quem fez o quê e quando).</p>' +
        '<p><b>Logo</b> — Gere um logo automático para dar identidade visual ao seu torneio. Ele aparece nos cards da dashboard e na página de detalhe.</p>'
    },
    {
      id: 'categorias',
      title: _t('help.categories'),
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
      title: _t('help.venue'),
      icon: '📍',
      content: '<p><b>Busca de local</b> — Ao criar um torneio, digite o nome do local e o sistema busca automaticamente no mapa com endereço completo e foto.</p>' +
        '<p><b>Acesso</b> — Defina o tipo de acesso: aberto ao público, apenas sócios, ou com convite.</p>' +
        '<p><b>Quadras</b> — Configure o número de quadras/campos disponíveis (1 a 50) e dê nomes personalizados a cada uma.</p>' +
        '<p><b>Estimativa de duração</b> — O sistema calcula automaticamente a duração estimada do torneio baseado no número de participantes, quadras, tempo de aquecimento e duração média das partidas.</p>' +
        '<p><b>Foto do local</b> — Se disponível, a foto do local aparece como fundo nos cards do torneio.</p>'
    },
    {
      id: 'desempate',
      title: _t('help.tiebreak'),
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
      id: 'atalhos-teclado',
      title: _t('help.shortcuts'),
      icon: '⌨️',
      content: '<div style="display:grid;grid-template-columns:80px 1fr;gap:8px 16px;font-size:0.85rem;">' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">Ctrl+K</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Abrir busca rápida global</span>' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">/</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Abrir busca rápida</span>' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">D</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Ir para Dashboard</span>' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">E</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Explorar torneios</span>' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">N</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Criar novo torneio</span>' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">?</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Abrir/fechar esta ajuda</span>' +
        '<kbd style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:6px;text-align:center;font-family:monospace;color:var(--text-bright);font-size:0.8rem;">ESC</kbd><span style="color:var(--text-main);display:flex;align-items:center;">Fechar modal atual</span>' +
        '</div>' +
        '<p style="font-size:0.78rem;color:var(--text-muted);margin-top:12px;">Os atalhos funcionam quando nenhum campo de texto está focado.</p>'
    },
    {
      id: 'notas-versoes',
      title: _t('help.changelog'),
      icon: '📋',
      content: '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.29-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Coroa do organizador</b> — Ícone de coroa (👑) agora aparece corretamente ao lado direito do nome do organizador nos cards de participantes, em vez de abaixo do avatar. Funciona tanto para participantes individuais quanto para membros de equipes.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.28-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login reordenado</b> — Opções de login ordenadas da mais fácil para a mais complexa: Link Mágico (recomendado), SMS, E-mail/Senha, e Google por último. Seção Google inclui passo a passo inline.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.27-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login redesenhado</b> — Tela de login sem abas: todas as opções visíveis. Manual com guia detalhado em 4 passos coloridos e índice clicável.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.25-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Mapa no Local do Torneio</b> — Ao criar ou editar torneio, o campo de local agora exibe mapa interativo com pin ao selecionar o local. Botão de geolocalização (📍) permite usar sua posição atual. Mesmo padrão visual do mapa de preferências do perfil.</p>' +
        '<p><b>Comunicações do Perfil</b> — Novo toggle "Todas" (verde) nas preferências de comunicação. Ativar "Todas" liga automaticamente Importantes e Fundamentais. Desativar "Fundamentais" exibe aviso de que nenhuma comunicação será recebida, com confirmação obrigatória.</p>' +
        '<p><b>GSM Set Fixo</b> — O toggle de tie-break agora permanece visível quando Set Fixo está ativo, permitindo ao organizador escolher se empates vão para tie-break ou se partidas podem terminar empatadas (útil em Liga e Suíço).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.21-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auto-amizade com quem convidou</b> — Links de compartilhamento agora incluem referência de quem convidou (?ref=UID). A auto-amizade é criada apenas com quem compartilhou o link, não mais com o organizador.</p>' +
        '<p><b>Correção de nomes desatualizados</b> — Quando um usuário altera o nome no perfil, a mudança agora se propaga automaticamente para todos os torneios em que participa, sem necessidade de novo login. Funciona para todos os usuários e em todas as páginas do app.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.17-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Atualizações em tempo real</b> — Debounce de atualização reduzido para respostas mais rápidas. Retry automático quando modal ou input está aberto. Service Worker agora usa network-first para assets do app (sempre busca versão mais recente).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.16-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n PT-BR</b> — Acentuação corrigida em todo o app. Mapa de local do torneio nos detalhes. Toggle de acesso ao local (público/restrito). Correção de scroll ao salvar resultado. Correção de nomes desatualizados em inscrições.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.14-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Set Fixo</b> — Novo modo de pontuação "Set Fixo" no GSM: disputa de N games fixos onde ganha quem vencer mais.</p>' +
        '<p><b>Login por email e telefone</b> — Abas de login: Email Link (passwordless) e Telefone (SMS). Removidos Apple e Facebook. Google Sign-In mantido.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Notificações em tempo real</b> — Listener Firestore onSnapshot para notificações instantâneas. Classificação de eliminatórias corrigida (posições únicas por jogador). Botão de organização movido para o card de detalhes. Busca de local no perfil corrigida.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.7-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Correções diversas</b> — Seção de organizador restaurada nos detalhes do torneio. Exclusão de torneio corrigida (conflito de variável com i18n). Organizadores não-competidores excluídos da contagem de participantes. Espaçamento entre cards de partida no bracket.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.6-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria de segurança e correções</b> — uid do participante agora salvo na inscrição (corrige notificações de co-organização). Escaping de backslash em onclick handlers. Escape de nomes em atributos data-player-name. Toggle switch adotado em todo o app. Dead code removido.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Organização (compartilhar/transferir)</b> — Novo botão "👑 Organização" nas ferramentas do organizador. Picker de participantes para compartilhar (co-organizador) ou transferir organização. Transferência agora concede privilégios completos de criador. Notificações de convite com aceite/recusa.</p>' +
        '<p><b>i18n completo</b> — Todas as strings hardcoded restantes em explore, notifications, rules, enrollment e organizer conectadas ao sistema _t(). ~35 novas chaves para host-transfer.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.7.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Foto do Organizador</b> — Foto/ícone de perfil do organizador agora aparece à esquerda do nome em todos os cards de organizador: seção ORGANIZAÇÃO, cabeçalho de detalhes do torneio e cards do dashboard. Fotos de organizadores e co-organizadores são pré-carregadas junto com as dos participantes.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.5.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Landing Page</b> — Página de apresentação para visitantes não logados com hero, features, "como funciona" e call-to-action. Funciona nos 4 temas.</p>' +
        '<p><b>Internacionalização (i18n)</b> — Sistema de tradução _t(key) com suporte a Português e Inglês. Seletor de idioma no perfil. Infraestrutura pronta para tradução gradual.</p>' +
        '<p><b>Templates de Torneio</b> — Salve configurações de torneio como template reutilizável. Botão "Salvar como Template" no detalhe do torneio. "Usar Template" na criação rápida. Limite de 10 no plano Free.</p>' +
        '<p><b>Analytics do Organizador</b> — Painel colapsável "Minhas Estatísticas" no dashboard: total de torneios, participantes únicos, média por torneio, gráficos por formato/esporte, mês mais ativo.</p>' +
        '<p><b>Templates de Email</b> — Templates HTML prontos para notificações por email (inscrição, resultado, lembrete, atualização). Preparação client-side para Cloud Function futura.</p>' +
        '<p><b>Cleanup</b> — Identificado e removido js/tournaments.js raiz (6.264 linhas de dead code). ~20 novos testes automatizados (total ~97).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.12-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Painel Unificado de Resolução Numérica</b> — Os 3 painéis de decisão (times incompletos, número ímpar, potência de 2) foram consolidados em um único painel com diagnóstico completo. Gauge visual mostra potência inferior/atual/superior com contagem de participantes. Cores Nash contínuas verde→vermelho com maior distinção visual. Botão ✕ para excluir opções temporariamente e recalcular Nash. Novas opções: Repescagem e Exclusão em todos os cenários.</p>' +
        '<p><b>Simplificação de Esportes</b> — Apenas modalidades derivadas do tênis: Beach Tennis, Pickleball, Tênis, Tênis de Mesa, Padel. Ícones de esporte limpos em todo o app.</p>' +
        '<p><b>Formato como Botões</b> — Dropdown de formato substituído por botões excludentes com descrição dinâmica.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Sorteio de times corrigido</b> — A verificação de potência de 2 agora conta times (não participantes individuais). Painéis de decisão exibem contagem correta de times quando teamSize > 1.</p>' +
        '<p><b>Botão Convidar sem restrições</b> — Botão "Convidar" visível e funcional para organizadores e participantes em qualquer estado do torneio.</p>' +
        '<p><b>Botões de ação após sorteio</b> — Grid de ações: Regras, Inscritos, QR Code, Imprimir, Exportar CSV, Modo TV. Layout 2 colunas no mobile.</p>' +
        '<p><b>Iniciar Torneio no bracket</b> — Re-renderiza o bracket corretamente após clique.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.4-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Painéis de Decisão com Nash</b> — Painéis de potência de 2 e times incompletos agora exibem indicador visual de equilíbrio de Nash em cada opção. Cores por temperatura: verde (melhor equilíbrio) → amarelo → laranja → azul (menor equilíbrio). Badge "Nash X%" em cada botão. Layout 3x2 com Enquete ao lado do Formato Suíço.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.3-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria Completa v2</b> — ~68 issues identificadas e corrigidas em 30 arquivos (~24.600 linhas auditadas). 14 CRITICAL, 22 HIGH, 18 MEDIUM, 14 LOW.</p>' +
        '<p><b>Segurança (XSS)</b> — showNotification/showConfirmDialog/showAlertDialog/showInputDialog agora sanitizam título automaticamente. ~30 onclick/oninput handlers com IDs não-escapados corrigidos em bracket.js, bracket-ui.js, tournaments-draw-prep.js, tournaments-draw.js, tournaments-organizer.js, tournaments-categories.js, main.js, auth.js, pre-draw.js, create-tournament.js. Dados da Google Places API e OpenWeather API sanitizados.</p>' +
        '<p><b>Bugs Corrigidos</b> — firebase-db.js: substring matching (.includes) na verificação de duplicata de inscrição → comparação exata. dashboard.js: operador lógico sem parênteses fazia torneios Liga encerrados mostrarem "Inscrições Abertas". auth.js: race condition — flag de login limpa antes do auto-enroll executar. tournaments-categories.js: função _groupEligibleCategories estava ausente (perdida na refatoração v0.4.2). participants.js: variável isVip usada antes da declaração. tournaments.js: substring matching na detecção de participante → comparação exata. dashboard.js: displayName null causava crash.</p>' +
        '<p><b>Memory Leaks</b> — hints.js: event listeners nos botões de balloon agora usam {once:true}. Auto-dismiss timeout limpo ao descartar manualmente. Resize/scroll listeners removidos ao desativar hints.</p>' +
        '<p><b>Melhorias</b> — notifications-view.js: seletor DOM frágil substituído por classe CSS. rules.js: datas inválidas tratadas graciosamente. create-tournament.js: booleanos GSM salvos consistentemente como string. dashboard.js: detecção de times suporta formato objeto. store.js: fallback redundante removido.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.2-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria de Segurança</b> — ~25 vulnerabilidades XSS corrigidas em 8 arquivos (bracket.js, bracket-ui.js, explore.js, pre-draw.js, notifications-view.js, auth.js, rules.js). Todos os dados de usuário sanitizados com _safeHtml().</p>' +
        '<p><b>Bug Fixes</b> — firebase-db.js usava fromUid ao invés de toUid ao verificar pedidos de amizade mútuos (corrigido). dashboard.js truthy check em sorteioRealizado — arrays vazios não são mais tratados como sorteio realizado. dashboard.js substring matching na detecção de participante — agora usa comparação exata (email/uid/displayName). bracket-ui.js tiebreak com pontos iguais — agora valida margem e pontuação mínima.</p>' +
        '<p><b>CSS</b> — Removidos temas mortos (high-contrast, alternative). Overrides de hint corrigidos para sunset/ocean.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.1-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Sistema Game-Set-Match (GSM)</b> — Sistema completo de pontuação por sets, games e tiebreaks para torneios de raquete e similares. Configuração na criação/edição do torneio com padrões por esporte (Beach Tennis, Tênis, Padel, Pickleball, Tênis de Mesa, Vôlei). Contagem numérica ou estilo tênis (15-30-40). Regra de vantagem, tiebreak e super tiebreak configuráveis. Preferências do usuário salvas por esporte. No bracket, botão "Lançar Sets" abre overlay dedicado com validação em tempo real. Resultados exibidos como "6-4 3-6 7-6(5)". Novos critérios de desempate automáticos: saldo de sets (±S), saldo de games (±G), tiebreaks vencidos. Colunas extras na tabela de classificação.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.4.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria Completa + Novos Temas</b> — Revisão linha a linha de todo o codebase com ~34 bugs corrigidos. Correções críticas: "Reabrir Inscrição" restaurado, race condition de inscrições durante decisão de potência de 2, operador lógico sem parênteses, XSS em notificações e explorar, enroll-modal reescrito. 4 temas disponíveis: Noturno, Claro, Pôr do Sol e Oceano. CSS refatorado para variáveis por tema. Dashboard cards com gradientes adaptativos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.3.18-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Duração Estimada do Torneio</b> — Quando a data/hora de término não está preenchida, a página de detalhes exibe simulação de duração para 8, 16, 32 e 64 participantes. Se houver inscritos, mostra também a estimativa com o número real. Cálculo considera formato (Eliminatórias, Dupla Elim., Grupos + Elim., Suíço, Liga), duração da partida, número de quadras e tempos de chamada/aquecimento. Mostra número de partidas e horário estimado de término quando há hora de início definida.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.3.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Consistência Visual Total</b> — Todos os botões sólidos e coloridos (sem cinza). Botões topbar (Apoie, Pro, Organizador) padronizados. Ferramentas do Organizador reordenadas: Editar, Comunicar, +Participantes, +Times, Add Bot, CSV, Clonar, Categorias, Encerrar Inscrições, Sortear, Encerrar Torneio, Apagar. Botão Visão simplificado para "Organizador"/"Participante". Info-pill, info-box e stat-box com opacidade otimizada.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.3.3-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Padronização Visual de Botões</b> — Sistema unificado de botões com classes CSS reutilizáveis (btn-primary, btn-success, btn-warning, btn-danger, btn-tool, etc). Todos os botões agora têm border-radius, font-size, padding e peso de fonte consistentes. Cores sólidas em todo o app (exceto Add Bot e Apagar que mantêm transparência). Efeito hover-lift implementado no CSS. Mais de 200 botões padronizados em 10+ arquivos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.42-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Excluir Conta</b> — Opção para o usuário excluir permanentemente sua conta e todos os dados associados (perfil, notificações, inscrições, torneios organizados). Disponível no modal de perfil com dupla confirmação (digitação de "EXCLUIR"). Conformidade LGPD.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.41-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Plano Pro + Apoio Voluntário</b> — Modelo freemium: plano gratuito (3 torneios, 32 participantes) e plano Pro (R$19,90/mês — ilimitado, upload de logo, Modo TV sem marca). Pagamento automatizado via Stripe (cartão de crédito). Botão "Apoie" para contribuição voluntária via PIX (qualquer valor). Botões Pro e Apoie na barra de navegação.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.40-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Push Notifications</b> — Notificações push via Firebase Cloud Messaging. Ao fazer login, o app solicita permissão e registra o token FCM no seu perfil. Notificações de novos rounds, inscrições e resultados chegam mesmo com o app fechado. Auto-draw para Liga/Ranking via Cloud Functions (rodadas geradas automaticamente a cada hora).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.39-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Previsão do Tempo</b> — Ao criar/editar torneio, se o local e data de início estiverem definidos (até 5 dias no futuro), a previsão do tempo é exibida automaticamente. Integração com OpenWeatherMap (temperatura, descrição, ícone).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.38-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Paginação no Dashboard</b> — Torneios carregam em lotes de 12. Botão "Carregar mais (N restantes)" aparece quando há mais de 12 torneios. Melhora performance para quem gerencia muitos torneios. Paginação reseta ao trocar de filtro.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.37-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Acessibilidade</b> — Link "Pular para o conteúdo" para navegação por teclado. ARIA roles e labels na topbar, navegação e conteúdo principal. aria-expanded no menu hamburger. Focus trap em modais (Tab circula dentro do modal). Live region para leitores de tela (notificações anunciadas). Melhoria geral de acessibilidade WCAG 2.1.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.36-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Modo Compacto do Dashboard</b> — Toggle "Cards/Lista" no dashboard para alternar entre visualização em cards (padrão) e lista compacta. Modo lista mostra nome, esporte, formato, data, participantes, progresso e status em uma linha por torneio. Ideal para quem gerencia muitos torneios. Preferência salva em localStorage.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.35-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Atalhos de Teclado Globais</b> — Navegação rápida: D (Dashboard), E (Explorar), N (Novo Torneio), / (Busca), ? (Ajuda), ESC (Fechar modal). Atalhos desativados automaticamente quando digitando em campos de texto. Nova seção "⌨️ Atalhos de Teclado" no modal de Ajuda.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.34-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Histórico de Atividades</b> — Seção "📜 Histórico de Atividades" na página de detalhes do torneio. Log visual cronológico com: criação, inscrições, sorteio, início, resultados de partidas e encerramento. Colapsável, mostra últimos 15 eventos com opção de expandir anteriores. Construído dinamicamente dos dados existentes sem necessidade de banco extra.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.33-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Estatísticas do Jogador</b> — Clique no nome de qualquer jogador para ver suas estatísticas consolidadas. Modal com: torneios disputados, vitórias, derrotas, empates, partidas totais, % de aproveitamento, títulos. Lista de torneios disputados com links. Disponível no chaveamento, classificação e lista de inscritos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.32-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>QR Code do Torneio</b> — Botão "📱 QR Code" na página do torneio e no chaveamento. Modal com QR code para compartilhar link. Ideal para projetar em eventos presenciais. Opções: copiar link, baixar PNG e imprimir. Suporta tema claro/escuro.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.31-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Busca Rápida (Ctrl+K)</b> — Pressione Ctrl+K (ou Cmd+K no Mac) para abrir busca global. Encontre torneios por nome, esporte, formato ou local. Busque jogadores inscritos. Ações rápidas: Novo Torneio, Dashboard, Explorar, Notificações, Ajuda. Busca com debounce de 150ms.</p>' +
        '<p><b>Torneios Encerrados</b> — Separados em seção colapsável no dashboard.</p>' +
        '<p><b>Compartilhar Resultado</b> — Botão "📤" em partidas concluídas para WhatsApp/clipboard.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.28-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Tema Claro/Escuro</b> — Botão 🌙/☀️ no header para alternar entre tema escuro e claro. Preferência salva em localStorage. Transição suave de 300ms. CSS com overrides específicos para o tema claro.</p>' +
        '<p><b>Countdown de Início</b> — Torneios com data futura mostram "Começa hoje/amanhã/em X dias" nos cards e detalhes.</p>' +
        '<p><b>Navegação Suave</b> — Scroll-to-top + fade-in ao navegar entre views.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.25-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Confrontos Diretos</b> — Matriz head-to-head abaixo da classificação (Liga/Suíço) mostrando o retrospecto entre cada par de jogadores. Formato V-E-D com cores indicativas: verde para vantagem, vermelho para desvantagem. Seção expansível, suporta categorias. Ideal para análise de desempate.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.24-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Ordenação de Colunas</b> — Clique nos cabeçalhos da tabela de classificação (Liga/Suíço) para ordenar por qualquer coluna: posição, nome, pontos, vitórias, empates, derrotas, saldo ou jogos. Setas indicam a direção da ordenação. Funciona em todas as categorias.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.23-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Modo TV</b> — Botão "📺 Modo TV" na página do chaveamento abre exibição fullscreen otimizada para projetores e TVs no local do torneio. Mostra classificação/bracket em tela cheia com fundo escuro, relógio em tempo real e auto-refresh a cada 30 segundos. Saia com ESC ou botão Sair.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.22-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Favoritar Torneios</b> — Clique na estrela (☆/★) ao lado do nome do torneio nos cards do dashboard ou na página de detalhes para marcar como favorito. Favoritos são salvos localmente por usuário e aparecem como filtro dedicado no dashboard quando há ao menos 1 favorito.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.21-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Imprimir Chaveamento</b> — Botão "Imprimir" na página do chaveamento/classificação. Layout otimizado para impressão com fundo branco, tabelas com bordas, avatares ocultados e orientação paisagem automática. Ideal para exibir brackets em locais de torneio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.20-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Testes Automatizados</b> — 21 testes unitários cobrindo funções core: classificação, progresso de partidas, formatos de torneio, sanitização HTML e mais. Página de testes acessível em /tests.html.</p>' +
        '<p><b>_isLigaFormat global</b> — Helper de formato Liga/Ranking agora disponível globalmente desde o carregamento do script (antes dependia da renderização da view).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.19-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Confrontos do Jogador</b> — Clique no nome de qualquer jogador na classificação para ver seu histórico completo de partidas: adversários, placares, resultados e resumo de V/E/D.</p>' +
        '<p><b>Notificação de Resultado</b> — Participantes agora recebem notificação automática quando o resultado de sua partida é registrado.</p>' +
        '<p><b>Última Atualização</b> — A página de detalhes do torneio mostra quando foi a última modificação (resultado, inscrição, etc).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.18-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Rodadas Anteriores</b> — Na classificação de Liga e Suíço, agora é possível expandir e ver todas as rodadas anteriores com os resultados de cada partida. Seção colapsada por padrão para não poluir a tela.</p>' +
        '<p><b>Estatísticas do Torneio</b> — Resumo com destaques: jogador com mais vitórias, maior sequência de vitórias consecutivas e total de partidas disputadas. Aparece automaticamente a partir da 2ª rodada.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.17-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Exportar Resultados (CSV)</b> — Botão "Exportar CSV" na página do torneio e no chaveamento. Baixa um arquivo CSV com classificação (Liga/Suíço) ou resultados das partidas (Eliminatórias). Compatível com Excel.</p>' +
        '<p><b>Clonar Torneio</b> — Botão "Clonar" na página do torneio cria uma cópia com mesmas configurações (formato, local, categorias, regras) mas sem participantes nem resultados. Ideal para torneios recorrentes.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.2.16-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Março 2026)</span></div>' +
        '<p><b>Compartilhar Torneio</b> — Botão "Compartilhar" na página de detalhes, visível para todos. Usa compartilhamento nativo no mobile ou copia o link.</p>' +
        '<p><b>Progresso do Torneio</b> — Barra visual mostrando % de partidas concluídas nos cards e na página de detalhes.</p>' +
        '<p><b>Countdown de Inscrições</b> — Aviso "Inscrições encerram em X dias" quando o prazo está próximo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
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

  // Build TOC (index) HTML
  var tocHtml = '<div id="help-toc" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.2rem;padding:10px 12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.08);border-radius:10px;">';
  for (var ti = 0; ti < helpSections.length; ti++) {
    var ts = helpSections[ti];
    tocHtml += '<a onclick="window._helpScrollTo(\'' + ts.id + '\')" style="font-size:0.72rem;color:var(--text-muted);cursor:pointer;padding:3px 8px;border-radius:6px;background:rgba(99,102,241,0.08);transition:all 0.15s;text-decoration:none;white-space:nowrap;" onmouseover="this.style.background=\'rgba(99,102,241,0.2)\';this.style.color=\'var(--text-bright)\'" onmouseout="this.style.background=\'rgba(99,102,241,0.08)\';this.style.color=\'var(--text-muted)\'">' + ts.icon + ' ' + ts.title + '</a>';
  }
  tocHtml += '</div>';

  // Build sections HTML
  var sectionsHtml = tocHtml;
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
          '<button class="btn btn-ghost" onclick="if(typeof closeModal===\'function\')closeModal(\'modal-help\');" style="font-size:1.3rem; padding:4px 8px; line-height:1;">✕</button>' +
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

  // Scroll to section and open it
  window._helpScrollTo = function(sectionId) {
    var sec = document.querySelector('.help-section[data-help-id="' + sectionId + '"]');
    if (!sec) return;
    sec.classList.add('open');
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
})();

// === Modal Criação Rápida ===
(function setupQuickCreateModal() {
  if (document.getElementById('modal-quick-create')) return;
  const html = `
    <div class="modal-overlay" id="modal-quick-create">
      <div class="modal" style="max-width:420px; padding:2rem;">
        <h2 style="margin:0 0 1.25rem; font-size:1.3rem; font-weight:700; color:var(--text-bright); text-align:center;">${(window._t || function(k){return k;})('quickCreate.title')}</h2>
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label">${(window._t || function(k){return k;})('quickCreate.sportLabel')}</label>
          <div id="qc-sport-buttons" style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="qc-sport-btn qc-sport-active" data-sport="🎾 Beach Tennis" onclick="window._qcSelectSport(this)" style="padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;border:2px solid #fbbf24;background:rgba(251,191,36,0.15);color:#fbbf24;font-weight:600;">🎾 Beach Tennis</button>
            <button type="button" class="qc-sport-btn" data-sport="🥒 Pickleball" onclick="window._qcSelectSport(this)" style="padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🥒 Pickleball</button>
            <button type="button" class="qc-sport-btn" data-sport="🎾 Tênis" onclick="window._qcSelectSport(this)" style="padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🎾 Tênis</button>
            <button type="button" class="qc-sport-btn" data-sport="🏓 Tênis de Mesa" onclick="window._qcSelectSport(this)" style="padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🏓 Tênis de Mesa</button>
            <button type="button" class="qc-sport-btn" data-sport="🏸 Padel" onclick="window._qcSelectSport(this)" style="padding:8px 14px;border-radius:10px;font-size:0.85rem;cursor:pointer;transition:all 0.15s;border:2px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:var(--text-main);font-weight:500;">🏸 Padel</button>
          </div>
          <select class="form-control" id="quick-create-sport" style="display:none;">
            <option>🎾 Beach Tennis</option>
            <option>🥒 Pickleball</option>
            <option>🎾 Tênis</option>
            <option>🏓 Tênis de Mesa</option>
            <option>🏸 Padel</option>
          </select>
        </div>
        <div id="qc-template-area" style="margin-bottom:10px;display:none;"></div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary btn-block" id="btn-quick-create">
            🏆 ${(window._t || function(k){return k;})('quickCreate.create')}
          </button>
          <button class="btn btn-tool-amber btn-block" id="btn-quick-template" style="display:none;">
            💾 Usar Template
          </button>
          <button class="btn btn-secondary btn-block" id="btn-quick-advanced">
            ⚙️ ${(window._t || function(k){return k;})('quickCreate.advanced')}
          </button>
          <button class="btn btn-secondary btn-block" onclick="if(typeof closeModal==='function')closeModal('modal-quick-create');">
            ${(window._t || function(k){return k;})('btn.cancel')}
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // Quick Create sport button selection
  window._qcSelectSport = function(btn) {
    var btns = document.querySelectorAll('#qc-sport-buttons .qc-sport-btn');
    btns.forEach(function(b) {
      b.classList.remove('qc-sport-active');
      b.style.border = '2px solid rgba(255,255,255,0.18)';
      b.style.background = 'rgba(255,255,255,0.06)';
      b.style.color = 'var(--text-main)';
    });
    btn.classList.add('qc-sport-active');
    btn.style.border = '2px solid #fbbf24';
    btn.style.background = 'rgba(251,191,36,0.15)';
    btn.style.color = '#fbbf24';
    // Sync hidden select
    var sel = document.getElementById('quick-create-sport');
    if (sel) {
      var val = btn.getAttribute('data-sport');
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].text === val) { sel.selectedIndex = i; break; }
      }
    }
  };

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

    // Determine team size from sport defaults
    const _qcSportTeamDefaults = {
      'Beach Tennis': 2, 'Pickleball': 2, 'Tênis': 1, 'Tênis de Mesa': 1, 'Padel': 2
    };
    const qcTeamSize = _qcSportTeamDefaults[sportClean] || 2;

    const tourData = {
      id: 'tour_' + Date.now(),
      name: autoName,
      sport: sportRaw,
      format: 'Eliminatórias Simples',
      isPublic: true,
      enrollmentMode: qcTeamSize > 1 ? 'time' : 'individual',
      teamSize: qcTeamSize,
      gameTypes: qcTeamSize > 1 ? 'duplas' : 'simples',
      thirdPlace: true,
      elimThirdPlace: true,
      status: 'open',
      createdAt: new Date().toISOString(),
      organizerId: window.AppStore.currentUser ? window.AppStore.currentUser.uid : 'local',
      organizerName: window.AppStore.currentUser ? window.AppStore.currentUser.displayName : 'Organizador',
      organizerEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local',
      creatorEmail: window.AppStore.currentUser ? window.AppStore.currentUser.email : 'visitante@local',
      creatorUid: window.AppStore.currentUser ? window.AppStore.currentUser.uid : '',
      coHosts: [],
      participants: [],
      matches: [],
      tiebreakers: ['confronto_direto', 'saldo_pontos', 'vitorias', 'buchholz', 'sonneborn_berger', 'sorteio'],
      scoring: (window._sportScoringDefaults && window._sportScoringDefaults[sportClean])
        ? Object.assign({}, window._sportScoringDefaults[sportClean])
        : { type: 'simple', setsToWin: 1, gamesPerSet: 1, tiebreakEnabled: false, tiebreakPoints: 7, tiebreakMargin: 2, superTiebreak: false, superTiebreakPoints: 10, countingType: 'numeric', advantageRule: false }
    };

    window.AppStore.addTournament(tourData);
    if (typeof closeModal === 'function') closeModal('modal-quick-create');
    // Flag to auto-scroll to Edit button and show hint on tournament detail page
    try { sessionStorage.setItem('scoreplace_scroll_to_edit', '1'); } catch (e) {}
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
    // elimThirdPlace is always true — no toggle needed

    // Pré-selecionar sport
    const sportSelect = document.getElementById('select-sport');
    if (sportSelect) {
      const opt = Array.from(sportSelect.options).find(o => o.value === sportVal || o.text === sportVal);
      if (opt) sportSelect.value = opt.value;
      if (typeof window._onSportChange === 'function') window._onSportChange();
    }

    if (typeof window._onFormatoChange === 'function') window._onFormatoChange();
    if (typeof openModal === 'function') openModal('modal-create-tournament');
    // Ensure GSM summary renders after modal is visible
    setTimeout(function() {
      if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
      if (typeof window._initPlacesAutocomplete === 'function') window._initPlacesAutocomplete();
    }, 100);
  });

  // ─── Template Integration ────────────────────────────────────────────────
  // Show "Usar Template" button when templates exist
  var _origOpen = window._origOpenQC || null;
  // Hook into modal-quick-create open to refresh template button visibility
  var _qcObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.target.id === 'modal-quick-create' && m.target.style.display !== 'none') {
        var templates = typeof window._getTemplates === 'function' ? window._getTemplates() : [];
        var btn = document.getElementById('btn-quick-template');
        var area = document.getElementById('qc-template-area');
        if (btn) btn.style.display = templates.length > 0 ? 'block' : 'none';
        if (area) area.style.display = 'none';
      }
    });
  });
  var qcModal = document.getElementById('modal-quick-create');
  if (qcModal) _qcObserver.observe(qcModal, { attributes: true, attributeFilter: ['style'] });

  // "Usar Template" button handler
  document.getElementById('btn-quick-template').addEventListener('click', function() {
    var area = document.getElementById('qc-template-area');
    if (!area) return;
    var templates = typeof window._getTemplates === 'function' ? window._getTemplates() : [];
    var _t = window._t || function(k) { return k; };
    if (templates.length === 0) {
      area.style.display = 'block';
      area.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;">' + _t('template.empty') + '</p>';
      return;
    }
    var html = '<div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">';
    templates.forEach(function(tpl, i) {
      var sportIcon = tpl.sport ? tpl.sport.split(' ')[0] : '🏆';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;cursor:pointer;" ' +
        'onclick="window._qcApplyTemplate(' + i + ')">' +
        '<span style="font-size:1.2rem;">' + sportIcon + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:600;font-size:0.85rem;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + window._safeHtml(tpl.name) + '</div>' +
          '<div style="font-size:0.75rem;color:var(--text-muted);">' + window._safeHtml(tpl.format || '') + '</div>' +
        '</div>' +
        '<button class="btn btn-micro btn-danger-ghost" onclick="event.stopPropagation();window._qcDeleteTemplate(' + i + ')" title="Apagar">✕</button>' +
      '</div>';
    });
    html += '</div>';
    area.style.display = 'block';
    area.innerHTML = html;
  });

  window._qcApplyTemplate = function(index) {
    var tpl = typeof window._applyTemplate === 'function' ? window._applyTemplate(index) : null;
    if (!tpl) return;
    if (typeof closeModal === 'function') closeModal('modal-quick-create');
    // Open advanced form and pre-fill
    var form = document.getElementById('form-create-tournament');
    if (form) form.reset();
    var editId = document.getElementById('edit-tournament-id');
    if (editId) editId.value = '';
    var title = document.getElementById('create-modal-title');
    if (title) title.innerText = 'Novo Torneio (Template)';
    var pub = document.getElementById('tourn-public');
    if (pub) pub.checked = true;

    // Pre-fill from template
    if (typeof window._prefillFromTemplate === 'function') {
      window._prefillFromTemplate(tpl);
    }
    if (typeof openModal === 'function') openModal('modal-create-tournament');
    setTimeout(function() {
      if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
      if (typeof window._initPlacesAutocomplete === 'function') window._initPlacesAutocomplete();
    }, 100);
  };

  window._qcDeleteTemplate = function(index) {
    if (typeof window._deleteTemplate === 'function') window._deleteTemplate(index);
    var _t = window._t || function(k) { return k; };
    if (typeof showNotification === 'function') showNotification(_t('template.deleted'), '', 'info');
    // Refresh the list
    document.getElementById('btn-quick-template').click();
  };
})();

// Inicializa estrutura base da UI (Modais, Menus)
setupUI();

setupCreateTournamentModal();
setupLoginModal();
setupProfileModal();
setupResultModal();
setupEnrollModal();

// Tema aplicado automaticamente via IIFE em store.js (initThemeSystem removido — função não existia)

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

// === Quick Search (Ctrl+K / Cmd+K) ===
(function() {
  // Create search overlay
  var overlay = document.createElement('div');
  overlay.id = 'quick-search-overlay';
  overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);z-index:99998;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
  overlay.onclick = function(e) { if (e.target === overlay) window._closeQuickSearch(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:15%;left:50%;transform:translateX(-50%);width:90%;max-width:540px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.5);z-index:99999;overflow:hidden;';

  modal.innerHTML =
    '<div style="padding:16px 20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:10px;">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
    '<input type="text" id="quick-search-input" placeholder="Buscar torneios, jogadores..." style="flex:1;background:transparent;border:none;color:var(--text-bright);font-size:1.05rem;outline:none;" autocomplete="off">' +
    '<kbd style="font-size:0.65rem;color:var(--text-muted);background:rgba(255,255,255,0.06);padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);">ESC</kbd>' +
    '</div>' +
    '<div id="quick-search-results" style="max-height:360px;overflow-y:auto;padding:8px;"></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  window._openQuickSearch = function() {
    overlay.style.display = 'block';
    var input = document.getElementById('quick-search-input');
    if (input) { input.value = ''; input.focus(); }
    _showQuickSearchDefaults();
  };

  window._closeQuickSearch = function() {
    overlay.style.display = 'none';
  };

  function _showQuickSearchDefaults() {
    var resultsDiv = document.getElementById('quick-search-results');
    if (!resultsDiv) return;
    var html = '<div style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Ações rápidas</div>';
    var actions = [
      { icon: '➕', label: 'Novo Torneio', action: "if(typeof openModal==='function')openModal('modal-quick-create');window._closeQuickSearch();" },
      { icon: '🏠', label: 'Dashboard', action: "window.location.hash='#dashboard';window._closeQuickSearch();" },
      { icon: '🔍', label: 'Explorar Comunidade', action: "window.location.hash='#explore';window._closeQuickSearch();" },
      { icon: '🔔', label: 'Notificações', action: "window.location.hash='#notifications';window._closeQuickSearch();" },
      { icon: '❓', label: 'Ajuda / Manual', action: "if(typeof openModal==='function')openModal('modal-help');window._closeQuickSearch();" }
    ];
    actions.forEach(function(a) {
      html += '<div onclick="' + a.action + '" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseout="this.style.background=\'transparent\'">' +
        '<span style="font-size:1.1rem;">' + a.icon + '</span>' +
        '<span style="font-size:0.9rem;color:var(--text-bright);">' + a.label + '</span>' +
        '</div>';
    });
    resultsDiv.innerHTML = html;
  }

  function _performQuickSearch(query) {
    var resultsDiv = document.getElementById('quick-search-results');
    if (!resultsDiv) return;
    if (!query || query.length < 2) { _showQuickSearchDefaults(); return; }

    var q = query.toLowerCase();
    var tournaments = (window.AppStore && window.AppStore.tournaments) ? window.AppStore.tournaments : [];
    var html = '';

    // Search tournaments
    var matchedTournaments = tournaments.filter(function(t) {
      return (t.name && t.name.toLowerCase().indexOf(q) !== -1) ||
             (t.sport && t.sport.toLowerCase().indexOf(q) !== -1) ||
             (t.venueName && t.venueName.toLowerCase().indexOf(q) !== -1) ||
             (t.format && t.format.toLowerCase().indexOf(q) !== -1);
    }).slice(0, 6);

    if (matchedTournaments.length > 0) {
      html += '<div style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Torneios</div>';
      matchedTournaments.forEach(function(t) {
        var status = t.status === 'finished' ? '🏆 Encerrado' : (t.status === 'active' ? '▶ Ativo' : '📋 Aberto');
        var _sh = window._safeHtml || function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');};
        var _safeId = String(t.id || '').replace(/'/g, "\\'").replace(/\\/g, "\\\\");
        html += '<div onclick="window.location.hash=\'#tournaments/' + _safeId + '\';window._closeQuickSearch();" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<span style="font-size:1.1rem;">🏅</span>' +
          '<div style="flex:1;overflow:hidden;">' +
          '<div style="font-size:0.88rem;font-weight:600;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _sh(t.name) + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);">' + _sh(t.format || '') + ' — ' + _sh(t.sport || '') + '</div>' +
          '</div>' +
          '<span style="font-size:0.65rem;color:var(--text-muted);">' + status + '</span>' +
          '</div>';
      });
    }

    // Search players across tournaments
    var playerSet = {};
    tournaments.forEach(function(t) {
      if (!t.participants) return;
      var arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
      arr.forEach(function(p) {
        var name = typeof p === 'string' ? p : (p.displayName || p.name || '');
        if (name && name.toLowerCase().indexOf(q) !== -1 && !name.includes('BYE')) {
          if (!playerSet[name]) playerSet[name] = [];
          playerSet[name].push(t.name);
        }
      });
    });

    var playerNames = Object.keys(playerSet).slice(0, 5);
    if (playerNames.length > 0) {
      html += '<div style="padding:8px 12px;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Jogadores</div>';
      playerNames.forEach(function(name) {
        var tourneys = playerSet[name].slice(0, 2).join(', ');
        html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;cursor:default;">' +
          '<span style="font-size:1.1rem;">👤</span>' +
          '<div style="flex:1;overflow:hidden;">' +
          '<div style="font-size:0.88rem;font-weight:600;color:var(--text-bright);">' + (window._safeHtml ? window._safeHtml(name) : name) + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);">' + tourneys + '</div>' +
          '</div></div>';
      });
    }

    if (!html) {
      html = '<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">Nenhum resultado para "' + (window._safeHtml ? window._safeHtml(query) : query) + '"</div>';
    }
    resultsDiv.innerHTML = html;
  }

  // Input handler with debounce
  var _searchTimeout = null;
  document.getElementById('quick-search-input').addEventListener('input', function() {
    var val = this.value.trim();
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(function() { _performQuickSearch(val); }, 150);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Ctrl+K or Cmd+K to open
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (overlay.style.display === 'none') window._openQuickSearch();
      else window._closeQuickSearch();
    }
    // ESC to close
    if (e.key === 'Escape' && overlay.style.display !== 'none') {
      window._closeQuickSearch();
    }
  });
})();

// === Global Keyboard Shortcuts ===
(function setupGlobalShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Skip if typing in an input, textarea, select, or contentEditable
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    // Skip if any modifier key is held (except for specific combos)
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Skip if a modal is open
    if (document.getElementById('qr-modal-overlay') || document.getElementById('player-stats-overlay')) return;
    var quickSearchOverlay = document.getElementById('quick-search-overlay');
    if (quickSearchOverlay && quickSearchOverlay.style.display !== 'none') return;

    switch (e.key.toLowerCase()) {
      case 'd':
        e.preventDefault();
        window.location.hash = '#dashboard';
        break;
      case 'e':
        e.preventDefault();
        window.location.hash = '#tournaments';
        break;
      case 'n':
        e.preventDefault();
        if (typeof window.quickCreate === 'function') window.quickCreate();
        else window.location.hash = '#create';
        break;
      case '?':
        e.preventDefault();
        var helpModal = document.getElementById('modal-help');
        if (helpModal) {
          helpModal.style.display = helpModal.style.display === 'none' ? 'flex' : 'none';
        }
        break;
      case '/':
        // Focus quick search
        e.preventDefault();
        if (typeof window._openQuickSearch === 'function') window._openQuickSearch();
        break;
    }
  });

  // Show keyboard shortcuts hint in help modal
  window._keyboardShortcutsHtml = '<div style="margin-top:1rem;padding:12px;background:rgba(255,255,255,0.05);border-radius:10px;">' +
    '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">⌨️ Atalhos de Teclado</div>' +
    '<div style="display:grid;grid-template-columns:60px 1fr;gap:4px 12px;font-size:0.78rem;">' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">Ctrl+K</kbd><span style="color:var(--text-muted);">Busca rápida</span>' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">/</kbd><span style="color:var(--text-muted);">Busca rápida</span>' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">D</kbd><span style="color:var(--text-muted);">Dashboard</span>' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">E</kbd><span style="color:var(--text-muted);">Explorar torneios</span>' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">N</kbd><span style="color:var(--text-muted);">Novo torneio</span>' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">?</kbd><span style="color:var(--text-muted);">Ajuda</span>' +
    '<kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;text-align:center;font-family:monospace;color:var(--text-bright);">ESC</kbd><span style="color:var(--text-muted);">Fechar modal</span>' +
    '</div></div>';
})();

// === Accessibility Helpers ===
(function setupA11y() {
  // Focus trap for modals — keeps Tab focus within the modal
  window._trapFocus = function(modalEl) {
    if (!modalEl) return;
    var focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    first.focus();
    modalEl._focusTrapHandler = function(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    modalEl.addEventListener('keydown', modalEl._focusTrapHandler);
  };
  window._releaseFocusTrap = function(modalEl) {
    if (modalEl && modalEl._focusTrapHandler) {
      modalEl.removeEventListener('keydown', modalEl._focusTrapHandler);
      delete modalEl._focusTrapHandler;
    }
  };

  // Announce to screen readers via live region
  var liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
  liveRegion.id = 'a11y-announcer';
  document.body.appendChild(liveRegion);

  window._announce = function(message) {
    var el = document.getElementById('a11y-announcer');
    if (el) { el.textContent = ''; setTimeout(function() { el.textContent = message; }, 50); }
  };

  // Enhance existing openModal/closeModal with ARIA + focus trap
  var _origOpenModal = window.openModal;
  if (typeof _origOpenModal === 'function') {
    window.openModal = function(id) {
      _origOpenModal(id);
      var modal = document.getElementById(id);
      if (modal) {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        window._trapFocus(modal);
        window._announce('Modal aberto');
      }
    };
  }
  var _origCloseModal = window.closeModal;
  if (typeof _origCloseModal === 'function') {
    window.closeModal = function(id) {
      var modal = document.getElementById(id);
      if (modal) window._releaseFocusTrap(modal);
      _origCloseModal(id);
      window._announce('Modal fechado');
    };
  }

  // Add ARIA labels to notification toasts
  var _origNotif = window.showNotification;
  if (typeof _origNotif === 'function') {
    window.showNotification = function(title, msg, type) {
      _origNotif(title, msg, type);
      window._announce(title + ': ' + msg);
    };
  }
})();
