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
      content: '<p>A <b>Dashboard</b> é sua página principal com todos os seus torneios.</p>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Hero Box e Filtros Principais</div>' +
          '<p><b>Cards de resumo</b> — No topo: "Meus Torneios", "Participando" e "Inscrições Abertas". Clique para filtrar.</p>' +
          '<p><b>Filtros no topo</b> — Todos, Organizados, Participando, Abertos, Favoritos, Encerrados. O ativo fica destacado.</p>' +
          '<p><b>Filtros por modalidade, local e formato</b> — Pills coloridas (roxo=esporte, verde=local, amarelo=formato). Use "✕ Limpar filtros" para resetar.</p>' +
          '<p><b>Visualização</b> — Alterne entre Cards (visual completo) e Lista (uma linha por torneio) com os botões no canto.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Cards de Torneio</div>' +
          '<p>Cada card mostra: nome, esporte, formato, inscritos, barra de progresso, countdown e status.</p>' +
          '<p><b>Estrela ⭐</b> — Clique para favoritar. Torneios favoritos aparecem no filtro "Favoritos".</p>' +
          '<p><b>Foto do local</b> — Aparece como fundo do card quando disponível.</p>' +
          '<p><b>Logo</b> — Miniatura ao lado do nome (56×56px).</p>' +
          '<p><b>Próximas partidas</b> — No topo, um widget mostra suas partidas pendentes com link direto.</p>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Paginação e Contagens</div>' +
          '<p>Torneios são carregados em lotes de 12. Clique em "Carregar mais" para ver os próximos.</p>' +
          '<p>Torneios encerrados ficam agrupados em seção colapsável no final.</p>' +
        '</div>'
    },
    {
      id: 'criar-torneio',
      title: _t('help.createTournament'),
      icon: '➕',
      content: '<p>Duas formas de criar um torneio:</p>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Criação Rápida</div>' +
          '<p>Clique em "+ Novo Torneio" → escolha o esporte → "Criar Torneio". Pronto! Nome automático, formato Eliminatórias, inscrição individual.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Formulário Completo</div>' +
          '<p>Na criação rápida, clique em "Detalhes Avançados" ou use "Editar" em um torneio existente.</p>' +
          '<p><b>Esporte</b> — Beach Tennis, Tênis, Padel, Pickleball, Tênis de Mesa. Cada um tem padrões de pontuação próprios.</p>' +
          '<p><b>Formato</b> — Eliminatórias, Dupla Eliminatória, Grupos + Elim., Suíço, Liga. Cada formato tem configurações específicas.</p>' +
          '<p><b>Modo de Sorteio</b> — Sorteio (aleatório) ou Rei/Rainha da Praia (grupos de 4 com parceiros rotativos).</p>' +
          '<p><b>Modo de Inscrição</b> — Individual, Apenas Times ou Misto (aceita ambos).</p>' +
          '<p><b>Tipo de Jogo</b> — Simples (1v1) ou Duplas (2v2). Ambos ligados = chaves paralelas.</p>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Campos do Formulário</div>' +
          '<p><b>Local</b> — Busca automática no Google Maps com foto e previsão do tempo.</p>' +
          '<p><b>Quadras</b> — Número de quadras (1-50) e nomes personalizados. Afeta a duração estimada.</p>' +
          '<p><b>Datas</b> — Início, fim e prazo de inscrição. Contagem regressiva automática nos cards.</p>' +
          '<p><b>Máximo de participantes</b> — Limite opcional. Pode auto-encerrar inscrições ao atingir.</p>' +
          '<p><b>Público/Privado</b> — Público aparece na aba Explorar. Endereço pode ser público ou restrito.</p>' +
          '<p><b>Categorias</b> — Gênero (Fem/Masc/Misto) × Habilidade (A/B/C). Gera chaveamentos separados.</p>' +
          '<p><b>Pontuação (GSM)</b> — Configure sets, games, tiebreaks e super tiebreak por esporte.</p>' +
          '<p><b>Logo</b> — Geração automática por Canvas ou upload. Cadeado trava contra auto-regeneração.</p>' +
          '<p><b>W.O.</b> — Individual (só o ausente perde) ou Time Inteiro (time eliminado).</p>' +
          '<p><b>Inscrições tardias</b> — Fechado, Lista de Espera ou Expansão (aceita e ajusta chave).</p>' +
          '<p><b>Desempate</b> — Arraste para reordenar critérios: confronto direto, saldo, Buchholz, etc.</p>' +
          '<p><b>Templates</b> — Salve configurações como template. Carregue em torneios futuros.</p>' +
        '</div>'
    },
    {
      id: 'formatos',
      title: _t('help.formats'),
      icon: '🎯',
      content: '<p>O scoreplace.app suporta <b>5 formatos</b> de torneio + modo Rei/Rainha:</p>' +
        '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<p style="margin:0;"><b>🏆 Eliminatórias Simples</b> — Perdeu, está fora. Opcional: disputa de 3º lugar, repescagem (melhores perdedores da R1 disputam vagas extra). Quando inscritos não são potência de 2, painel inteligente sugere: BYE, Play-in, Suíço, reabrir ou enquete.</p>' +
        '</div>' +
        '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<p style="margin:0;"><b>🔄 Dupla Eliminatória</b> — Precisa perder 2x para sair. Chave de vencedores (Winners) e perdedores (Losers). Grande final entre o campeão de cada chave.</p>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<p style="margin:0;"><b>⚽ Fase de Grupos + Eliminatórias</b> — Estilo Copa do Mundo. Participantes divididos em grupos, todos jogam entre si. Os N melhores de cada grupo avançam para mata-mata. Configurável: número de grupos e classificados por grupo.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<p style="margin:0;"><b>♟️ Suíço</b> — Todos jogam todas as rodadas. Emparelhamentos por pontuação (adversários de nível similar). Ótimo para muitos participantes em poucas rodadas. Rodadas configuráveis. Classificação com Buchholz e Sonneborn-Berger.</p>' +
        '</div>' +
        '<div style="background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<p style="margin:0;"><b>📊 Liga</b> — Temporada contínua com classificação por pontos. Duração configurável. Inscrições sempre abertas (opcional). Sorteios automáticos ou manuais. Cada jogador tem um toggle "Ativo" no seu card: desativado = folga com 0 pontos; quem fica de fora por número ímpar recebe a média dos seus pontos. Rodadas podem usar formato Rei/Rainha. Ideal para comunidades regulares.</p>' +
        '</div>' +
        '<div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:10px;padding:12px;">' +
          '<p style="margin:0;"><b>👑 Rei/Rainha da Praia</b> — Modo de sorteio especial: grupos de 4 jogadores com parceiros rotativos (AB vs CD, AC vs BD, AD vs BC). Pontuação individual. Top 1 ou 2 de cada grupo avançam para eliminatória até coroar o Rei/Rainha. Pode ser usado na Liga também.</p>' +
        '</div>'
    },
    {
      id: 'inscricao',
      title: _t('help.enrollment'),
      icon: '✍️',
      content: '<p><b>Inscrever-se</b> — Abra o torneio e clique em "Inscrever-se". Em torneios com categorias, escolha sua categoria. Em torneios por times, preencha os nomes da equipe.</p>' +
        '<p><b>Por convite</b> — Clique no link recebido, faça login e será inscrito automaticamente (+ amizade com quem convidou).</p>' +
        '<p><b>Cancelar inscrição</b> — Botão "Cancelar Inscrição" na página do torneio. Confirmação obrigatória.</p>' +
        '<p><b>Encerramento automático</b> — Inscrições encerram ao atingir o limite ou na data/hora de prazo.</p>' +
        '<p><b>Inscrições tardias</b> — Dependendo da configuração: Fechado (bloqueado), Lista de Espera (suplente) ou Expansão (aceita e ajusta chave).</p>' +
        '<p><b>Lista de espera</b> — Suplentes podem substituir ausentes no check-in. Contagem separada no card.</p>' +
        '<p><b>Modos</b> — Individual (cada um por si), Times (duplas/equipes inscritas juntas) ou Misto (aceita ambos).</p>'
    },
    {
      id: 'sorteio',
      title: _t('help.draw'),
      icon: '🎲',
      content: '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Antes do Sorteio</div>' +
          '<p>O organizador encerra inscrições (manual ou automático) e clica em "Sortear".</p>' +
          '<p><b>Painel de resolução</b> — Se os inscritos não são potência de 2 (eliminatórias), painel inteligente com Nash sugere: BYE, Play-in, Repescagem, Suíço, Reabrir, Lista de Espera ou Enquete.</p>' +
          '<p><b>Times incompletos</b> — Se há sobra de jogadores que não formam time completo: Reabrir, Bots, Lista de Espera ou Ajuste Manual.</p>' +
          '<p><b>Cabeças de chave (VIP)</b> — Marque jogadores como VIP na lista de inscritos para prioridade no seeding.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">O Sorteio</div>' +
          '<p><b>Eliminatórias</b> — Confrontos aleatórios respeitando VIPs. BYEs distribuídos intercalados.</p>' +
          '<p><b>Grupos</b> — Painel mostra todas as distribuições possíveis (grupos iguais e mistos). Classificados por grupo configurável.</p>' +
          '<p><b>Liga/Suíço</b> — Gera rodada por pontuação. Sorteios podem ser automáticos (agendados) ou manuais.</p>' +
          '<p><b>Rei/Rainha</b> — Grupos de 4 com rotação de parceiros (3 partidas por grupo).</p>' +
          '<p><b>Divulgação imediata</b> — Todos recebem notificação quando o sorteio é realizado.</p>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Enquete entre Participantes</div>' +
          '<p>Quando há impasse (potência de 2, times incompletos), crie uma enquete para os participantes votarem.</p>' +
          '<p>Prazo padrão: 48h. Contagem regressiva ao vivo. Recomendação por Nash (justiça 45%, inclusão 35%, praticidade 20%).</p>' +
          '<p>Antes de votar: apenas descrições. Após votar: resultado parcial e seu voto visíveis. Pode mudar o voto até encerrar.</p>' +
        '</div>'
    },
    {
      id: 'checkin',
      title: _t('help.checkin'),
      icon: '✅',
      content: '<p><b>Check-in</b> — Após iniciar o torneio, faça a chamada na aba "Inscritos". Toggle Presente/Ausente por participante.</p>' +
        '<p><b>Filtros</b> — Todos, Presentes, Ausentes, Pendentes. Facilita o controle no dia do evento.</p>' +
        '<p><b>Indicadores nas chaves</b> — Ponto verde (presente), vermelho (ausente), cinza (pendente). Partida verde quando ambos presentes.</p>' +
        '<p><b>W.O. (Walkover)</b> — Marque ausente → botão W.O. dá vitória automática ao adversário. Escopo configurável: Individual (só o ausente) ou Time Inteiro.</p>' +
        '<p><b>Substituição automática</b> — Marque W.O. e o próximo presente da lista de espera entra no lugar.</p>' +
        '<p><b>Limpar check-in</b> — Botão "Limpar" reseta todos os check-ins para recomeçar.</p>' +
        '<p><b>Ordenação</b> — Botões A-Z (alfabética) e 🕐 (cronológica) no cabeçalho da lista.</p>'
    },
    {
      id: 'resultados',
      title: _t('help.results'),
      icon: '📝',
      content: '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Lançando Resultados</div>' +
          '<p><b>Placar simples</b> — Digite o placar diretamente nos campos numéricos do card da partida e clique ✓ para confirmar.</p>' +
          '<p><b>Game-Set-Match (GSM)</b> — Para torneios com sets, clique em "Lançar Sets" para abrir o overlay dedicado. Insira o placar set a set; tiebreaks aparecem automaticamente quando necessário.</p>' +
          '<p><b>Editar resultado</b> — Clique no ✏️ para reabrir os campos e corrigir o placar.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Progressão Automática</div>' +
          '<p><b>Eliminatórias</b> — Vencedor avança automaticamente. Ao completar todas as partidas, o torneio encerra e exibe o pódio.</p>' +
          '<p><b>Grupos</b> — Ao completar todos os jogos do grupo, os classificados avançam para eliminatória automaticamente.</p>' +
          '<p><b>Liga/Suíço</b> — Classificação atualizada em tempo real. "Fechar Rodada" gera a próxima. Na Liga, jogadores inativos (toggle desativado) ficam de folga com 0 pontos; quem fica de fora por número insuficiente de jogadores recebe a média dos seus pontos.</p>' +
          '<p><b>Rei/Rainha</b> — Standings individuais por grupo. Top jogadores avançam para eliminatória.</p>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Compartilhar e Exportar</div>' +
          '<p><b>Compartilhar resultado</b> — Botão de compartilhar em cada partida concluída (WhatsApp, clipboard).</p>' +
          '<p><b>Exportar CSV</b> — Baixe todos os resultados em planilha para Excel/Google Sheets.</p>' +
          '<p><b>Imprimir</b> — Imprima o chaveamento completo (orientação paisagem automática).</p>' +
        '</div>'
    },
    {
      id: 'convidar',
      title: _t('help.invite'),
      icon: '👥',
      content: '<p>Clique em "Convidar" dentro do torneio para abrir o painel com 5 canais:</p>' +
        '<p><b>👥 Amigos na plataforma</b> — Envie convites para todos os seus amigos com um clique. Eles recebem notificação direta.</p>' +
        '<p><b>📱 QR Code</b> — Código exclusivo para projetar no evento. Escaneie com a câmera e se inscreva na hora.</p>' +
        '<p><b>💬 WhatsApp</b> — Link formatado aberto direto no WhatsApp. Ideal para grupos.</p>' +
        '<p><b>📧 E-mail</b> — Envie convite por e-mail digitando o endereço do destinatário.</p>' +
        '<p><b>🔗 Copiar link</b> — Copie o link para colar em Instagram, Telegram, SMS ou qualquer rede.</p>' +
        '<p><b>Auto-inscrição</b> — Quem clicar no link e fizer login é inscrito automaticamente + amizade com quem convidou.</p>' +
        '<p><b>Sem login</b> — Visitantes podem ver o torneio sem login. Ao clicar em "Inscrever-se", o login é solicitado.</p>'
    },
    {
      id: 'perfil',
      title: _t('help.profile'),
      icon: '👤',
      content: '<p><b>Acessar</b> — Clique no seu avatar (foto ou iniciais) no canto superior direito.</p>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Informações Pessoais</div>' +
          '<p><b>Nome</b> — Exibido em torneios, chaveamentos e classificações.</p>' +
          '<p><b>Gênero</b> — Usado para atribuição automática de categorias (Fem/Masc).</p>' +
          '<p><b>Data de nascimento</b> — Exibida na aba Explorar para outros jogadores.</p>' +
          '<p><b>Cidade e localização</b> — Busca automática no mapa. Botão 📍 usa GPS.</p>' +
          '<p><b>Esportes preferidos</b> — Separados por vírgula. Usado para sugestões.</p>' +
          '<p><b>Categoria/nível</b> — Seu nível de jogo (A, B, C, etc.).</p>' +
          '<p><b>Telefone</b> — Com código do país para notificações por WhatsApp.</p>' +
          '<p><b>Avatar</b> — Escolha entre avatares pré-definidos ou use sua foto do Google.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Configurações</div>' +
          '<p><b>Idioma</b> — 🇧🇷 Português ou 🇺🇸 English. Bandeiras clicáveis com destaque visual.</p>' +
          '<p><b>Tema</b> — Noturno (escuro), Claro, Pôr do Sol, Oceano. 4 opções visuais.</p>' +
          '<p><b>Notificações</b> — Todas (padrão), Só Importantes ou Só Fundamentais. Canais: Plataforma, E-mail, WhatsApp.</p>' +
          '<p><b>Dicas visuais</b> — Ative/desative as dicas que aparecem quando você fica parado.</p>' +
        '</div>' +
        '<div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Estatísticas e Conta</div>' +
          '<p><b>Meu Desempenho</b> — Torneios, partidas, vitórias, derrotas, aproveitamento e títulos.</p>' +
          '<p><b>Histórico</b> — Últimos 8 torneios com posição final e link direto.</p>' +
          '<p><b>Excluir conta</b> — Exclusão permanente com dupla confirmação (digitar "EXCLUIR"). Remove todos os dados.</p>' +
        '</div>'
    },
    {
      id: 'notificacoes',
      title: _t('help.notifications'),
      icon: '🔔',
      content: '<p>O scoreplace.app notifica sobre tudo que acontece nos seus torneios:</p>' +
        '<p><b>Inscrição</b> — Confirmação ao se inscrever. Organizador também é notificado.</p>' +
        '<p><b>Alterações</b> — Data, local, formato ou configurações mudaram? Você sabe.</p>' +
        '<p><b>Sorteio e resultados</b> — Notificação quando rodada é sorteada e quando resultado é lançado.</p>' +
        '<p><b>Comunicados</b> — Mensagens do organizador com nível: Fundamental, Importante ou Geral.</p>' +
        '<p><b>Lembretes</b> — Automáticos: 7 dias, 2 dias e no dia do torneio.</p>' +
        '<p><b>Torneios próximos</b> — Baseado na sua localização (perfil). Avisado quando abrem inscrições perto.</p>' +
        '<p><b>Amizade e co-organização</b> — Pedidos de amizade e convites para co-organizar aparecem nas notificações. Aceite ou recuse diretamente.</p>' +
        '<p><b>Níveis</b> — <span style="color:#ef4444;">Fundamentais</span> (inscrição, dia do torneio), <span style="color:#f59e0b;">Importantes</span> (alterações, 2 dias antes), <span style="color:#60a5fa;">Gerais</span> (7 dias antes, comunicados, proximidade).</p>' +
        '<p><b>Push</b> — Notificações push no navegador (requer permissão). Funcionam mesmo com o app fechado.</p>'
    },
    {
      id: 'explorar',
      title: _t('help.explore'),
      icon: '🌐',
      content: '<p><b>Aba Explorar</b> — Encontre jogadores e expanda sua rede na comunidade.</p>' +
        '<p><b>Pedidos pendentes</b> — No topo, aceite ou recuse pedidos de amizade recebidos.</p>' +
        '<p><b>Seus amigos</b> — Lista com avatar, cidade, esportes e idade. Remova amigos se quiser.</p>' +
        '<p><b>Conhecidos</b> — Jogadores de torneios que você participou mas que ainda não são amigos. Envie convite de amizade.</p>' +
        '<p><b>Busca</b> — Encontre jogadores por nome, cidade ou esporte. Envie convites diretamente.</p>' +
        '<p><b>Cancelar</b> — Cancele um pedido de amizade enviado que ainda está pendente.</p>'
    },
    {
      id: 'organizador',
      title: _t('help.organizers'),
      icon: '🛠️',
      content: '<p><b>Visão de Organizador</b> — Botão "Organizador/Participante" no cabeçalho alterna perspectivas.</p>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Ferramentas do Organizador</div>' +
          '<p><b>Editar</b> — Reabra o formulário completo para alterar qualquer configuração.</p>' +
          '<p><b>Comunicar</b> — Envie mensagens para todos os inscritos com nível de importância (Fundamental/Importante/Geral).</p>' +
          '<p><b>+ Participante / + Time</b> — Adicione inscritos manualmente.</p>' +
          '<p><b>Add Bot</b> — Preencha vagas com jogadores fictícios para testes.</p>' +
          '<p><b>Categorias</b> — Gerencie categorias: mova, mescle, atribua participantes.</p>' +
          '<p><b>Exportar CSV</b> — Baixe resultados em planilha.</p>' +
          '<p><b>Salvar Template</b> — Salve configurações para reusar em futuros torneios.</p>' +
          '<p><b>QR Code</b> — Gere QR para projetar no evento.</p>' +
          '<p><b>Modo TV</b> — Projete placar ao vivo em telão (fullscreen, auto-refresh 30s).</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Fluxo do Organizador</div>' +
          '<ol style="padding-left:20px;margin:6px 0;">' +
            '<li>Crie o torneio (rápido ou detalhado)</li>' +
            '<li>Convide participantes</li>' +
            '<li>Gerencie categorias (se aplicável)</li>' +
            '<li>Encerre inscrições (manual ou automático)</li>' +
            '<li>Sorteie o chaveamento</li>' +
            '<li>Inicie o torneio + check-in</li>' +
            '<li>Lance resultados ou aguarde os jogadores</li>' +
            '<li>Feche rodadas (Liga/Suíço) ou aguarde encerramento automático</li>' +
            '<li>Encerre e veja o pódio!</li>' +
          '</ol>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Co-organização</div>' +
          '<p><b>Compartilhar organização</b> — Convide um participante para ser co-organizador (botão 👑 Organização).</p>' +
          '<p><b>Transferir</b> — Transfira a organização completa para outro participante.</p>' +
          '<p>Co-organizadores têm acesso a todas as ferramentas exceto excluir o torneio.</p>' +
        '</div>'
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
      content: '<p><b>Busca automática</b> — Digite o nome do local e o Google Maps sugere endereços reais com foto e coordenadas.</p>' +
        '<p><b>Localização GPS</b> — Botão 📍 usa sua localização atual para preencher o campo.</p>' +
        '<p><b>Acesso</b> — Público (visível para todos), Sócios ou Convite.</p>' +
        '<p><b>Endereço público/privado</b> — Toggle controla se o endereço aparece na aba Explorar.</p>' +
        '<p><b>Quadras</b> — 1 a 50 quadras com nomes personalizados (ex: Quadra Central, Quadra 2).</p>' +
        '<p><b>Duração estimada</b> — Cálculo automático: duração da partida × número de partidas ÷ quadras + aquecimento + chamada.</p>' +
        '<p><b>Previsão do tempo</b> — Quando o local tem coordenadas e a data é nos próximos 5 dias, exibe previsão automática.</p>' +
        '<p><b>Foto do local</b> — Aparece como fundo nos cards do dashboard e na página de detalhes.</p>'
    },
    {
      id: 'chaveamento',
      title: _t('help.bracket'),
      icon: '🏅',
      content: '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Navegação no Chaveamento</div>' +
          '<p><b>Zoom</b> — Slider e botões +/- para ajustar o tamanho. Arraste para navegar.</p>' +
          '<p><b>Ocultar rodadas</b> — Clique para esconder rodadas concluídas e economizar espaço.</p>' +
          '<p><b>Navegação por grupos</b> — Botões coloridos (A, B, C...) para pular direto ao grupo desejado.</p>' +
          '<p><b>Só meus jogos</b> — Toggle filtra para mostrar apenas suas partidas.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Classificação (Liga/Suíço)</div>' +
          '<p><b>Tabela de standings</b> — Colunas: Posição, Nome, Pts, V, E, D, PF, PC, Saldo. GSM adiciona ±S e ±G.</p>' +
          '<p><b>Ordenação</b> — Clique nos cabeçalhos (▲/▼) para ordenar por qualquer coluna.</p>' +
          '<p><b>Clique no nome</b> — Abre estatísticas globais do jogador ou histórico de partidas no torneio.</p>' +
          '<p><b>Confrontos diretos</b> — Matriz NxN expansível abaixo da classificação (verde=vantagem, vermelho=desvantagem).</p>' +
          '<p><b>Rodadas anteriores</b> — Seção colapsável mostrando resultados de rodadas passadas.</p>' +
          '<p><b>Estatísticas do torneio</b> — Destaques automáticos: mais vitórias, maior sequência, total de partidas.</p>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Ferramentas</div>' +
          '<p><b>Modo TV</b> — Fullscreen para projetar em telão. Auto-refresh 30s. Sair com ESC.</p>' +
          '<p><b>Imprimir</b> — CSS otimizado para impressão (paisagem, bordas, fundo branco).</p>' +
          '<p><b>Exportar CSV</b> — Classificação ou resultados em planilha.</p>' +
          '<p><b>Compartilhar resultado</b> — Cada partida tem botão de compartilhar (WhatsApp/clipboard).</p>' +
          '<p><b>Pódio</b> — Torneios encerrados exibem podio visual com medalhas (🥇🥈🥉).</p>' +
        '</div>'
    },
    {
      id: 'partida-casual',
      title: 'Partida Casual',
      icon: '📡',
      content: '<p>Jogue partidas avulsas com placar ao vivo em tela cheia — sem precisar criar um torneio.</p>' +
        '<div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Como funciona</div>' +
          '<p><b>1. Abrir</b> — Botão "📡 Partida Casual" na dashboard ou menu.</p>' +
          '<p><b>2. Configurar</b> — Escolha esporte, single/dupla, pontuação (sets, games, tie-break). Configurações salvas por esporte.</p>' +
          '<p><b>3. Convidar</b> — QR Code ou código da sala (6 caracteres). Jogadores logados entram automaticamente no lobby.</p>' +
          '<p><b>4. Montar times</b> — "Sortear" ON = duplas aleatórias ao iniciar. OFF = arraste jogadores para Time 1 / Time 2.</p>' +
          '<p><b>5. Jogar</b> — Placar ao vivo em tela cheia. Todos os participantes veem e podem marcar pontos em tempo real.</p>' +
        '</div>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Placar ao Vivo</div>' +
          '<p><b>Pontuação</b> — Toque ▲ para marcar ponto, ▼ para corrigir. Placares grandes para fácil visualização.</p>' +
          '<p><b>AD (vantagem no game)</b> — Toggle logo abaixo da contagem (15-30-40 / 1-2-3). Ligado: em 40-40 (deuce) exige 2 pontos de vantagem para fechar o game. Desligado: ponto de ouro (quem fizer o próximo ponto vence). Padrão por modalidade — Tênis e Padel ligado, Beach Tennis / Pickleball / Tênis de Mesa desligado.</p>' +
          '<p><b>Vantagem de 2 pontos (set)</b> — <b>Ativada por padrão em todas as modalidades.</b> Ligada: o set não termina em 5-6 — ao empatar em (g-1)-(g-1) ou a cada novo empate que impossibilite a vantagem de 2 games, o app pergunta "Prorrogar ou Tie-break". Desligada: o set acaba no primeiro a chegar em g games, sem extensão e sem tie-break.</p>' +
          '<p><b>Sets/Games</b> — Automático: ao completar games, avança set. Empate (ex: 5×5) oferece Prorrogar ou Tie-break (quando "Vantagem de 2 pontos" ligada).</p>' +
          '<p><b>Prorrogação</b> — Continua até vantagem de 2 games. Botão "⚡ Tie-break" ganha destaque com <b>glow pulsante</b> durante a prorrogação para facilitar a mudança a qualquer momento.</p>' +
          '<p><b>Tie-break</b> — Vence quem fizer 7 pontos primeiro com 2 de vantagem; se empatar em 7 continua até alguém abrir 2.</p>' +
          '<p><b>Ordem de saque</b> — Arraste a bolinha 🎾 para trocar o sacador. Após o 1º game o time que começou trava; após o 2º game a ordem inteira trava com um cadeado 🔒.</p>' +
          '<p><b>Decisões restritas aos jogadores</b> — Escolha de prorrogar vs tie-break e botão de tie-break só aparecem para usuários cadastrados envolvidos na partida. Não-jogadores veem "Aguardando decisão".</p>' +
          '<p><b>Nomes editáveis</b> — Toque no nome para alterar. Fotos de perfil exibidas para jogadores logados.</p>' +
        '</div>' +
        '<div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.20);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Tela de Resultado</div>' +
          '<p><b>Layout</b> — Vencedor no topo com troféu, placar e nomes clicáveis. Logo abaixo vem o gráfico Momentum (animação visível de imediato). Depois a seção Comparação dos Times e os stats do perdedor.</p>' +
          '<p><b>Gráfico Momentum</b> — Duas linhas cumulativas animadas: azul para o Time 1, vermelha para o Time 2. Linhas desenham da esquerda para a direita em ~3s com marcadores de ponto final e divisores de set (S1, S2...). Botão ↻ Replay reexecuta a animação.</p>' +
          '<p><b>Comparação dos Times</b> — Barras lado a lado: Sets, Games, Pontos, % Pontos no Saque, % Pontos na Recepção, Games Mantidos, Quebras de Saque, Killer Points (40-40), Maior Sequência e Maior Vantagem.</p>' +
          '<p><b>Cards de jogador clicáveis</b> — Toque em qualquer jogador para ver suas estatísticas individuais: games servidos/mantidos, aproveitamento, maior sequência, e também pts servidos/ganhos/% no saque.</p>' +
          '<p><b>Jogar Novamente + Re-sortear duplas</b> — Botões fixos no rodapé da tela de resultado (não somem ao rolar). Recomeça a partida com placar zerado. Ative o toggle ao lado para redistribuir os jogadores aleatoriamente entre os times.</p>' +
          '<p><b>Botões não cortam</b> — O rodapé usa 100dvh + safe-area-inset para não ficar escondido pelo URL bar do navegador ou pelo home-indicator.</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Lobby e Compartilhamento</div>' +
          '<p><b>Código da sala</b> — 6 caracteres. Digite na dashboard ("📷 Escanear QR") ou acesse #casual/CODIGO.</p>' +
          '<p><b>Lobby em tempo real</b> — Organizador e participantes veem quem já entrou. Atualização automática a cada 3s.</p>' +
          '<p><b>Times visíveis no lobby</b> — Quando o organizador monta os times (arraste jogadores, edite nomes), as mudanças aparecem em tempo real no lobby dos outros usuários sob "⚔ Times formados".</p>' +
          '<p><b>Sair libera a vaga</b> — Clicar em Sair (ou Voltar ao Dashboard) remove seu uid do slot e te redireciona para o dashboard — outro jogador pode ocupar a vaga imediatamente.</p>' +
          '<p><b>Fechar partida</b> — O botão ✕ Fechar durante a partida pede confirmação; ao confirmar o abandono, sua vaga é liberada e você volta para o dashboard.</p>' +
          '<p><b>Resultado</b> — Ao finalizar, confirme o resultado. Estatísticas detalhadas salvas no seu perfil (persistentes).</p>' +
        '</div>'
    },
    {
      id: 'estatisticas-detalhadas',
      title: 'Estatísticas Detalhadas',
      icon: '📊',
      content: '<p>O scoreplace guarda estatísticas detalhadas de cada partida na sua conta. Essas estatísticas sobrevivem mesmo se o torneio for apagado ou se a partida casual for encerrada.</p>' +
        '<p><b>Como acessar</b> — Toque no nome de qualquer jogador em qualquer tela (dashboard, chaveamento, classificação, resultado de partida casual) para abrir o modal de estatísticas. O botão <b>Voltar</b> fica fixo no topo, logo abaixo do menu, sempre visível durante o scroll.</p>' +
        '<div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">O que é registrado</div>' +
          '<p><b>Por partida</b> — Sets, games, pontos, % pontos no saque, % pontos na recepção, games mantidos no saque, quebras, killer points (40-40), maior sequência, maior vantagem, duração, esporte.</p>' +
          '<p><b>Por jogador</b> — Games servidos, games mantidos, aproveitamento (%), maior sequência de games mantidos, pontos servidos, pontos ganhos no saque e % no saque por ponto.</p>' +
          '<p><b>Casuais vs Torneios</b> — Estatísticas mantidas separadas entre partidas casuais (⚡) e torneios (🏆). Barras divergentes e ícones lado a lado em cada linha.</p>' +
        '</div>' +
        '<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Barras Divergentes (Desempenho)</div>' +
          '<p>Derrotas à esquerda (vermelho), vitórias à direita (verde). O tamanho é proporcional ao total. Ordem das linhas:</p>' +
          '<p><b>1. Vitórias/Derrotas</b> — V-D totais.</p>' +
          '<p><b>2. Sets</b> — Sets vencidos e perdidos.</p>' +
          '<p><b>3. Games</b> — Games vencidos e perdidos.</p>' +
          '<p><b>4. Pontos</b> — Pontos vencidos e perdidos.</p>' +
          '<p><b>5. Tiebreaks</b> — TBs vencidos e perdidos.</p>' +
          '<p><b>6. Pontos TB Médios</b> — Média do placar vencedor em cada TB. À direita (verde): média dos seus pontos nos TBs que você venceu. À esquerda (vermelho): média dos pontos do adversário nos TBs em que ele venceu contra você.</p>' +
          '<p><b>7. TB Vencidos (mín/máx pts)</b> — Pontos que você marcou nos TBs que venceu. <b>Máx</b> = recorde positivo (o maior placar que você fez ganhando um TB). <b>Mín</b> = recorde negativo (seu menor placar em um TB vencido, geralmente o 7 limpo). Ambos os lados em verde — é o seu mesmo placar.</p>' +
          '<p><b>8. TB Perdidos (mín/máx pts)</b> — Pontos que o adversário marcou nos TBs em que ele venceu contra você. <b>Máx</b> = a maior surra (placar mais alto do adversário quando ganhou). <b>Mín</b> = a derrota mais apertada (menor placar do adversário ao vencer um TB, geralmente 7). Ambos os lados em vermelho.</p>' +
          '<p style="color:var(--text-muted);font-size:0.78rem;">As 3 linhas de TB (6-8) aparecem apenas quando há tiebreaks registrados.</p>' +
        '</div>' +
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Top 3 Adversários / Parceiros</div>' +
          '<p><b>Adversários</b> — Contra quem você mais joga: casuais e torneios listados separadamente.</p>' +
          '<p><b>Parceiros</b> — Com quem você mais forma dupla: descubra sua dupla ideal pelas vitórias compartilhadas.</p>' +
        '</div>' +
        '<div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.20);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:var(--text-bright);margin-bottom:8px;">Persistência</div>' +
          '<p>Os dados ficam salvos em <code>users/{seu_uid}/matchHistory</code> — cada jogador cadastrado envolvido recebe sua própria cópia. Mesmo que o torneio seja deletado ou a sala casual expire, seu histórico permanece.</p>' +
          '<p>Seção <b>📋 Torneios Disputados</b> no rodapé do modal lista cada torneio com link direto.</p>' +
        '</div>'
    },
    {
      id: 'desempate',
      title: _t('help.tiebreak'),
      icon: '⚖️',
      content: '<p>Critérios de desempate configuráveis pelo organizador (arraste para reordenar prioridade):</p>' +
        '<p><b>Confronto Direto</b> — Quem ganhou no confronto entre os empatados.</p>' +
        '<p><b>Saldo de Pontos</b> — Diferença entre pontos feitos e sofridos.</p>' +
        '<p><b>Número de Vitórias</b> — Total de vitórias no torneio.</p>' +
        '<p><b>Buchholz</b> — Força dos adversários enfrentados (soma dos pontos dos adversários).</p>' +
        '<p><b>Sonneborn-Berger</b> — Qualidade das vitórias (pontos dos adversários que você derrotou).</p>' +
        '<p><b>Sorteio</b> — Desempate aleatório como último recurso.</p>' +
        '<p><b>GSM extras</b> — Torneios com sets: saldo de sets (±S), saldo de games (±G), sets vencidos, games vencidos, tiebreaks vencidos.</p>'
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
      id: 'dicas-app',
      title: _t('help.hints'),
      icon: '💡',
      content: '<p>O scoreplace.app exibe <b>dicas visuais contextuais</b> quando você fica parado por alguns segundos. Elas aparecem como balões com seta apontando para o elemento. Clique "Entendi" para dispensar ou "Desativar dicas" para parar.</p>' +
        '<p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">Você pode reativar as dicas no seu Perfil. São 152 dicas ao todo, organizadas por área:</p>' +

        // ── Global / Topbar ──
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#818cf8;margin-bottom:8px;">🔝 Barra Superior (8)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Login</b> — Faça login para criar e gerenciar torneios<br>' +
            '• <b>Menu ☰</b> — Abra o menu para navegar pelo app<br>' +
            '• <b>Perfil</b> — Acesse estatísticas e configurações<br>' +
            '• <b>Tema</b> — Noturno, Claro, Pôr do Sol e Oceano<br>' +
            '• <b>Ajuda (?)</b> — Manual completo com todas as funcionalidades<br>' +
            '• <b>Busca rápida</b> — Ctrl+K para buscar torneios e jogadores<br>' +
            '• <b>Notificações</b> — Avisos de torneios e convites<br>' +
            '• <b>Explorar</b> — Torneios públicos da comunidade' +
          '</p>' +
        '</div>' +

        // ── Strategic ──
        '<div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#fbbf24;margin-bottom:8px;">💡 Apoie / Pro (4)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Apoie (Dashboard)</b> — PIX mantém a plataforma gratuita<br>' +
            '• <b>Pro (Dashboard)</b> — Torneios ilimitados, logo, Modo TV sem marca<br>' +
            '• <b>Apoie (Torneio)</b> — Cada contribuição faz diferença<br>' +
            '• <b>Pro (Torneio)</b> — Criar torneios ilimitados e personalizar' +
          '</p>' +
        '</div>' +

        // ── Dashboard ──
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#34d399;margin-bottom:8px;">📊 Dashboard (15)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>+ Novo Torneio</b> — Crie em menos de 1 minuto<br>' +
            '• <b>Filtro Todos</b> — Veja todos os torneios de uma vez<br>' +
            '• <b>Filtro Organizados</b> — Só os que você organiza<br>' +
            '• <b>Filtro Participando</b> — Só onde está inscrito<br>' +
            '• <b>Filtro Abertos</b> — Inscrições disponíveis<br>' +
            '• <b>Filtro Favoritos</b> — Seus favoritados<br>' +
            '• <b>Filtro Encerrados</b> — Classificação final e pódio<br>' +
            '• <b>Filtros gerais</b> — Por tipo, esporte, local, formato<br>' +
            '• <b>Cards/Lista</b> — Alterne visualização compacta<br>' +
            '• <b>Estrela ⭐</b> — Favoritar torneio<br>' +
            '• <b>Filtro por esporte</b> — Beach Tennis, Tênis, Padel...<br>' +
            '• <b>Filtro por local</b> — Torneios perto de você<br>' +
            '• <b>Filtro por formato</b> — Eliminatórias, Liga, Suíço...<br>' +
            '• <b>Carregar mais</b> — Próximos torneios (paginação)' +
          '</p>' +
        '</div>' +

        // ── Tournament Detail: Participant ──
        '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#60a5fa;margin-bottom:8px;">🏆 Detalhe do Torneio — Participante (6)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Convidar</b> — WhatsApp, QR Code, link<br>' +
            '• <b>Inscrever-se</b> — Organizador notificado automaticamente<br>' +
            '• <b>Cancelar inscrição</b> — Se inscrições abertas, pode voltar<br>' +
            '• <b>QR Code</b> — Projetar no evento<br>' +
            '• <b>Inscritos</b> — Lista, check-in, gerenciar<br>' +
            '• <b>Regras</b> — Configurações, desempate, histórico' +
          '</p>' +
        '</div>' +

        // ── Tournament Detail: Organizer ──
        '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#a855f7;margin-bottom:8px;">🛠️ Ferramentas do Organizador (17)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Editar</b> — Local, datas, formato, categorias<br>' +
            '• <b>Comunicar</b> — Mensagens para todos os inscritos<br>' +
            '• <b>Sortear</b> — Gerar chaveamento automaticamente<br>' +
            '• <b>+ Participante</b> — Adicionar manualmente<br>' +
            '• <b>+ Time</b> — Adicionar dupla/equipe<br>' +
            '• <b>Add Bot</b> — Jogadores fictícios para completar<br>' +
            '• <b>Categorias</b> — Mover, mesclar, atribuir<br>' +
            '• <b>Abrir/Fechar inscrições</b> — Controlar período<br>' +
            '• <b>Salvar Template</b> — Reusar configurações<br>' +
            '• <b>Clonar</b> — Copiar torneio sem participantes<br>' +
            '• <b>Encerrar</b> — Finalizar e exibir pódio<br>' +
            '• <b>Excluir</b> — Remover permanentemente<br>' +
            '• <b>Co-organização</b> — Convidar ou transferir<br>' +
            '• <b>Iniciar Torneio</b> — Liberar partidas<br>' +
            '• <b>Ver Chaves</b> — Chaveamento completo<br>' +
            '• <b>Exportar CSV</b> — Planilha de resultados<br>' +
            '• <b>Liga ativo</b> — Toggle de participação: ativo = entra nos sorteios; inativo = folga com 0 pts' +
          '</p>' +
        '</div>' +

        // ── Create Tournament ──
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#f59e0b;margin-bottom:8px;">➕ Criar/Editar Torneio (32)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Esporte</b> — Padrões de pontuação por modalidade<br>' +
            '• <b>Formato</b> — Eliminatória, Dupla, Grupos, Suíço, Liga<br>' +
            '• <b>Modo de sorteio</b> — Sorteio ou Rei/Rainha<br>' +
            '• <b>Modo de inscrição</b> — Individual, Times, Misto<br>' +
            '• <b>Tipo de jogo</b> — Simples (1v1) ou Duplas (2v2)<br>' +
            '• <b>Local</b> — Busca Google Maps + previsão do tempo<br>' +
            '• <b>Endereço público</b> — Visível ou privado<br>' +
            '• <b>Quadras</b> — Quantidade e nomes<br>' +
            '• <b>Categorias gênero</b> — Fem, Masc, Misto<br>' +
            '• <b>Categorias habilidade</b> — A, B, C separados por vírgula<br>' +
            '• <b>Pontuação (GSM)</b> — Sets, games, tiebreaks<br>' +
            '• <b>Logo</b> — Gerar automático ou upload<br>' +
            '• <b>Público/Privado</b> — Visível no Explorar<br>' +
            '• <b>Data de início</b> — Contagem regressiva nos cards<br>' +
            '• <b>Prazo de inscrição</b> — Encerramento automático<br>' +
            '• <b>Máximo participantes</b> — Limite opcional<br>' +
            '• <b>Auto-encerrar</b> — Ao atingir o limite<br>' +
            '• <b>Duração da partida</b> — Para estimativa total<br>' +
            '• <b>Classificados Rei/Rainha</b> — 1 ou 2 por grupo<br>' +
            '• <b>Grupos</b> — Número e classificados por grupo<br>' +
            '• <b>Rodadas Suíço</b> — Recomendado: log₂ participantes<br>' +
            '• <b>W.O.</b> — Individual ou Time Inteiro<br>' +
            '• <b>Inscrições tardias</b> — Fechado, Standby, Expansão<br>' +
            '• <b>Desempate</b> — Arrastar para reordenar critérios<br>' +
            '• <b>Template</b> — Carregar configuração salva<br>' +
            '• <b>Liga: temporada</b> — Duração em meses<br>' +
            '• <b>Liga: inscrições abertas</b> — Durante toda temporada<br>' +
            '• <b>Liga: sorteio manual</b> — Ou agendar automáticos<br>' +
            '• <b>Liga: agendamento</b> — Data, hora e intervalo<br>' +
            '• <b>Liga: novos jogadores</b> — Zero, Mínimo, Média<br>' +
            '• <b>Liga: inatividade</b> — Manter, Decair, Remover<br>' +
            '• <b>Liga: formato rodada</b> — Padrão ou Rei/Rainha' +
          '</p>' +
        '</div>' +

        // ── Invite Modal ──
        '<div style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#22d3ee;margin-bottom:8px;">👥 Modal de Convite (5)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Amigos</b> — Convidar da plataforma com um clique<br>' +
            '• <b>WhatsApp</b> — Link direto para grupos<br>' +
            '• <b>Copiar link</b> — Instagram, Telegram, SMS<br>' +
            '• <b>QR Code</b> — Projetar no evento<br>' +
            '• <b>E-mail</b> — Enviar por e-mail' +
          '</p>' +
        '</div>' +

        // ── Power of 2 + Incomplete Teams ──
        '<div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#f87171;margin-bottom:8px;">🔢 Painéis de Resolução (10)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Nash (P2)</b> — Cores indicam equilíbrio: verde=melhor<br>' +
            '• <b>Reabrir (P2)</b> — Completar potência de 2<br>' +
            '• <b>BYE</b> — Avançar sem jogar na 1ª rodada<br>' +
            '• <b>Play-in</b> — Rodada extra para excedentes<br>' +
            '• <b>Suíço</b> — Várias rodadas antes de afunilar<br>' +
            '• <b>Enquete</b> — Participantes votam na solução<br>' +
            '• <b>Nash (Times)</b> — Score de equilíbrio por opção<br>' +
            '• <b>Reabrir (Times)</b> — Novos jogadores completam times<br>' +
            '• <b>Bots</b> — Preencher vagas com nomes fictícios<br>' +
            '• <b>Ajuste Manual</b> — Arrastar e soltar entre times' +
          '</p>' +
        '</div>' +

        // ── Poll ──
        '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#c084fc;margin-bottom:8px;">📊 Enquete (3)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Prazo</b> — Encerramento automático<br>' +
            '• <b>Opções</b> — Marcar e ver Nash<br>' +
            '• <b>Votar</b> — Mudar voto até encerrar' +
          '</p>' +
        '</div>' +

        // ── GSM ──
        '<div style="background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#ec4899;margin-bottom:8px;">🎾 Pontuação GSM (8)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Sets para vencer</b> — 1 a 5 (amador vs profissional)<br>' +
            '• <b>Games por set</b> — 6 (tênis), 11 (mesa), 25 (vôlei)<br>' +
            '• <b>Tiebreak</b> — Para sets empatados<br>' +
            '• <b>Super tiebreak</b> — Set decisivo curto (10 pts)<br>' +
            '• <b>Contagem</b> — Numérica ou Tênis (15-30-40)<br>' +
            '• <b>Vantagem</b> — Deuce/advantage em 40-40<br>' +
            '• <b>Placar dos sets</b> — Entrada set a set automática<br>' +
            '• <b>Salvar sets</b> — Vencedor determinado automaticamente' +
          '</p>' +
        '</div>' +

        // ── Partida Casual ──
        '<div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#38bdf8;margin-bottom:8px;">📡 Partida Casual (8)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Partida Casual</b> — Jogue sem criar torneio<br>' +
            '• <b>Esporte</b> — Pontuação ajustada por modalidade<br>' +
            '• <b>Single/Dupla</b> — Toggle na configuração<br>' +
            '• <b>Sortear Duplas</b> — ON = aleatório, OFF = arrastar<br>' +
            '• <b>QR Code / Código</b> — Convide jogadores presentes<br>' +
            '• <b>Lobby</b> — Veja quem entrou em tempo real<br>' +
            '• <b>Ordem de saque</b> — ⇅ troca sacador no time<br>' +
            '• <b>Tie-break</b> — Ative a qualquer momento na prorrogação' +
          '</p>' +
        '</div>' +

        // ── Bracket ──
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#818cf8;margin-bottom:8px;">🏅 Chaveamento / Classificação (15)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Zoom</b> — Slider + arraste para navegar<br>' +
            '• <b>Imprimir</b> — Para colar na parede do evento<br>' +
            '• <b>Exportar CSV</b> — Excel / Google Sheets<br>' +
            '• <b>Ordenar colunas</b> — Clique nos cabeçalhos<br>' +
            '• <b>Compartilhar resultado</b> — WhatsApp / clipboard<br>' +
            '• <b>Modo TV</b> — Telão fullscreen, auto-refresh 30s<br>' +
            '• <b>Placar inline</b> — Digitar direto no card<br>' +
            '• <b>Confirmar placar</b> — Registrar resultado<br>' +
            '• <b>Editar resultado</b> — Reabrir campos<br>' +
            '• <b>Ocultar rodada</b> — Economizar espaço<br>' +
            '• <b>Fechar rodada</b> — Gerar próxima automaticamente<br>' +
            '• <b>Avançar eliminatória</b> — Classificados dos grupos<br>' +
            '• <b>Estatísticas do jogador</b> — Clique no nome<br>' +
            '• <b>Histórico de partidas</b> — Adversários e placares<br>' +
            '• <b>Só meus jogos</b> — Filtrar suas partidas' +
          '</p>' +
        '</div>' +

        // ── Check-in ──
        '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#34d399;margin-bottom:8px;">✅ Participantes / Check-in (8)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>VIP</b> — Prioridade no cabeçamento<br>' +
            '• <b>Remover</b> — Excluir participante<br>' +
            '• <b>Toggle check-in</b> — Confirmar presença<br>' +
            '• <b>Filtros</b> — Todos, Presentes, Ausentes<br>' +
            '• <b>Limpar</b> — Resetar todos os check-ins<br>' +
            '• <b>Ordenar</b> — A-Z ou cronológico<br>' +
            '• <b>W.O.</b> — Marcar ausente/walkover<br>' +
            '• <b>Substituir W.O.</b> — Próximo da lista de espera' +
          '</p>' +
        '</div>' +

        // ── Pre-draw ──
        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#f59e0b;margin-bottom:8px;">🎲 Pré-Sorteio (3)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Confirmar sorteio</b> — Gerar chaveamento<br>' +
            '• <b>Renomear categoria</b> — Antes do sorteio<br>' +
            '• <b>Mesclar categorias</b> — Unir poucas inscrições' +
          '</p>' +
        '</div>' +

        // ── Explore ──
        '<div style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#22d3ee;margin-bottom:8px;">🌐 Explorar (2)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Busca</b> — Nome, esporte, formato, cidade<br>' +
            '• <b>Pedido de amizade</b> — Conectar para convites futuros' +
          '</p>' +
        '</div>' +

        // ── Notifications ──
        '<div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#fbbf24;margin-bottom:8px;">🔔 Notificações (2)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Aceitar co-organização</b> — Convite para organizar junto<br>' +
            '• <b>Aceitar amizade</b> — Trocar convites de torneio' +
          '</p>' +
        '</div>' +

        // ── Profile ──
        '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:12px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#c084fc;margin-bottom:8px;">👤 Perfil (6)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Gênero</b> — Atribuição automática de categorias<br>' +
            '• <b>Idioma</b> — 🇧🇷 Português / 🇺🇸 English<br>' +
            '• <b>Esportes</b> — Para sugestões de torneios<br>' +
            '• <b>Localização</b> — Torneios perto de você<br>' +
            '• <b>Notificações</b> — Todas, Importantes, Fundamentais<br>' +
            '• <b>Dicas visuais</b> — Ativar/desativar este sistema' +
          '</p>' +
        '</div>' +

        // ── Meta ──
        '<div style="background:rgba(107,114,128,0.06);border:1px solid rgba(107,114,128,0.15);border-radius:10px;padding:12px;">' +
          '<div style="font-weight:700;font-size:0.85rem;color:#9ca3af;margin-bottom:8px;">ℹ️ Meta (1)</div>' +
          '<p style="margin:0;font-size:0.8rem;line-height:1.7;">' +
            '• <b>Sobre as dicas</b> — Como desativar e reativar no Perfil' +
          '</p>' +
        '</div>'
    },
    {
      id: 'notas-versoes',
      title: _t('help.changelog'),
      icon: '📋',
      content: '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.80-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Convidado preso em "Partida não encontrada" após encerramento + regras do torneio documentam lançamento manual de tie-break</b> — Dois problemas observados em partida casual real. (1) Fluxo do convidado após encerramento: quando o anfitrião fechava o placar ao vivo (mesmo com resultado salvo), o código chamava <code>cancelCasualMatch</code> que <i>deletava</i> o doc Firestore. Qualquer convidado que abria o link depois via "Partida não encontrada" e ficava preso numa tela sem contexto. Agora o doc é preservado com <code>status=\'finished\'</code> quando a partida é concluída — só é deletado quando o anfitrião abandona <i>antes</i> de finalizar. Resultado: convidados que abrem o link depois caem na tela de resumo/estatísticas do casual view (que já existia mas era inalcançável) com botão para o dashboard. Convidados que estavam assistindo ao vivo agora também transicionam automaticamente para essa tela quando o listener detecta <code>status=\'finished\'</code>, em vez de serem expulsos com notificação genérica. (2) Regras do torneio não documentavam como lançar tie-break manualmente. Adicionada nova seção "🎾 Sistema de Pontuação" na página de regras mostrando tipo de placar (simples ou Game/Set/Match), sets para vencer, games por set, tipo de contagem (tênis 15-30-40 ou numérica), regra de vantagem, configuração do tie-break (placar de disparo calculado do <code>gamesPerSet</code> — ex: 6-6, pontos até atingir, diferença mínima), super tie-break e instrução passo-a-passo: "digite os games; ao atingir 6-6 o sistema abre dois novos campos para os pontos do tie-break de cada time". Para torneios sem tie-break, mensagem alternativa explicando o critério de decisão do set.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.79-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Placar do tie-break por time como sobrescrito entre parênteses</b> — Em todos os displays de resultados (chaveamento, placar ao vivo, log do torneio, histórico casual), quando um set é decidido no tie-break agora o placar do TB de <i>cada</i> time aparece como sobrescrito entre parênteses ao lado dos games. Exemplo: <code>7⁽⁷⁾-6⁽⁵⁾</code> (vencedor fez 7 games e 7 pontos no TB; perdedor 6 games e 5 pontos). Antes o comportamento era inconsistente entre os 7 sites de exibição: alguns mostravam só o <code>Math.max</code> (ambíguo), outros só do perdedor (convenção do tênis), outros combinavam <code>(7-5)</code>. Criados dois helpers compartilhados em <code>bracket-model.js</code>: <code>window._formatSetForPlayer(set, playerNum, opts)</code> devolve <code>7⁽⁷⁾</code> para uma coluna de jogador, e <code>window._formatSetCombined(set, opts)</code> devolve <code>7⁽⁷⁾-6⁽⁵⁾</code>. Ambos normalizam as duas shapes de dado existentes (<code>{p1,p2}</code> em partidas casuais e <code>{pointsP1,pointsP2}</code> em torneios). <code>opts.html=true</code> usa <code>&lt;sup&gt;</code>; sem opts usa dígitos Unicode sobrescritos para texto puro (notificações, logs, CSV). Aplicado em: <code>bracket.js</code> (coluna por jogador + resumo do vencedor + fixed-set com TB), <code>bracket-ui.js</code> (log de torneio, <code>scoreSummary</code> do record, summary da partida casual e display HTML inline ao vivo).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.78-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Sexta onda de migrações canônicas — 6 silent-miss corrigidos em bracket/analytics/draw/categories</b> — Após v0.12.77 concluir os core helpers (<code>_findMatch</code> + <code>_showPlayerHistory</code>), este release varre os sites restantes. (1) <code>_byeWinners</code> em <code>bracket.js</code> (L1237): detecção de jogadores que avançaram via BYE em R1 só olhava <code>t.matches</code>; agora usa o collector. (2) Champion detection em <code>tournaments-analytics.js</code> (L197): títulos/pódios de eliminação liam só <code>t.matches[last]</code> — se o elim foi escrito via canonical writer em <code>t.rounds[].matches</code>, o campeão era invisível. Agora prefere o adapter (busca última coluna de fase <code>grandfinal</code>/<code>elim</code>) com fallback legado. (3) <code>generateDrawFunction</code> em <code>tournaments-draw.js</code> (L101): a proteção contra re-sorteio só detectava resultados em <code>t.matches</code> e <code>t.rounds</code> — em Grupos/thirdPlace/rodadas, um redraw apagava resultados reais sem aviso. Migrado. (4) <code>_executeMerge</code> em <code>tournaments-categories.js</code> (L1100): ao mesclar categorias, referências <code>m.category</code> em <code>t.groups[].matches</code>, <code>t.thirdPlaceMatch</code> e <code>t.rodadas</code> não eram atualizadas; agora o collector mutate-by-reference aplica a mudança em todas as 7 shapes. (5) <code>finishTournament</code> em <code>tournaments-draw-prep.js</code> (L2202): cálculo de <code>hasResults</code> e <code>pendingMatches</code> (usado na confirmação de encerramento manual) também migrado. (6) Substituição W.O. e desqualificação de times em <code>bracket-ui.js</code> (L142/L202): o rewrite de <code>p1</code>/<code>p2</code>/<code>winner</code> de <code>oldTeamName</code>→<code>newTeamName</code> só alcançava <code>t.matches</code> e <code>t.rounds</code> — em Grupos/thirdPlace/rodadas, o nome antigo sobrevivia. Migrado. Bonus: <code>_showPlayerHistory</code> agora também cobre <code>c.subgroups[].matches</code> (Groups/Monarch) que ficaram fora da v0.12.77. Verificado em preview: fixture com dados em 4 shapes devolve 5/5 matches, substituição propaga para as 5 shapes, campeão é detectado via adapter quando <code>t.matches</code> está vazio. Fallback legado preservado em todos os sites.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.77-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Core <code>_findMatch</code> e Player History migrados para o helper canônico</b> — Duas migrações internas aos módulos <code>bracket-*</code> (antes deixadas fora do escopo). (1) <code>_findMatch</code> em <code>bracket-logic.js</code>, a função utilitária mais chamada do sistema (14 call sites, incluindo <code>_advanceWinner</code>, save de resultado, repescagem e merge do lower bracket), tinha um silent miss duplo: omitia <code>t.groups[].matches</code> (partidas diretas no grupo, fora de sub-rounds) e <code>t.rodadas</code> (tanto <code>.matches</code> quanto array direto). Resultado: operações que dependiam de encontrar um match por ID — advance de vencedor, save de placar — falhavam silenciosamente se o match estivesse numa dessas shapes. Migrado para <code>window._collectAllMatches(t)</code>, cobrindo as 7 shapes. Verificado em fixture com todas as shapes: 8/8 matches encontráveis por ID (antes: 5/8); mutação via referência preservada (crítico para advance-winner). (2) <code>_showPlayerHistory</code> em <code>bracket-ui.js</code> — o popup de histórico que abre ao clicar no nome de um jogador — tinha silent miss em <code>t.thirdPlaceMatch</code>, <code>t.rodadas</code> e <code>t.groups[].rounds</code>. Migrado para <code>_getUnifiedRounds(t)</code>, que além de cobrir todas as shapes entrega rótulos semânticos. Resultado visível: jogador que disputou semifinal + 3º lugar agora aparece com "Semifinais" e "Disputa de 3º Lugar" na coluna Fase (antes: só "Rodada 1" da semi, o 3º lugar nunca aparecia). Em elim de 4 jogadores: Alice (campeã) mostra "Semifinais"/"Final"; Bob (3º) mostra "Semifinais"/"Disputa de 3º Lugar" — antes o 3º lugar era invisível no histórico. Fallback legado preservado em ambos os sites.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.76-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>W.O. e check-in de Liga/Suíço/Grupos ganham lookup funcional</b> — Dois scans em <code>participants.js</code> que só olhavam <code>t.matches</code> foram migrados para <code>window._collectAllMatches(t)</code>. (1) <code>_declareAbsent</code> (W.O.) em L253: antes, ao declarar ausência em torneio Liga/Suíço/Grupos, a busca do match retornava null silenciosamente — a dialog mostrava "Partida ?" sem saber o adversário. Agora a busca atravessa todas as 7 shapes e encontra a partida em qualquer formato. (2) O builder do mapa <code>nameToMatch</code>/<code>nameToOpponent</code> no check-in (L506) tinha o mesmo silent miss: em formatos não-elim, o mapa ficava vazio e nenhum participante mostrava número/adversário da próxima partida. Agora popula corretamente para Liga, Suíço, Grupos e Rei/Rainha. <b>Regressão zero em elim:</b> a ordem do helper começa com <code>t.matches</code>, preservando o índice amigável ("Partida N") para chaves eliminatórias — verificado em fixtures (Alice vs Bob mantém index 1, Alice vs Charlie mantém index 3). Em Liga/Grupos, o número é o índice flat na lista coletada, o que pode não ser tão semântico quanto "Rodada 2 / Partida 1" mas é um <i>strict improvement</i> sobre o "?" anterior — e habilita toda a lógica downstream (detecção de decidido, opponent lookup) para esses formatos. Fallback legado preservado em ambos os sites. Com esta migração, <b>todos os scans multi-shape fora de <code>bracket-*</code></b> passam pelo helper canônico: a refatoração da fase 3 está funcionalmente completa.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.75-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Rotina AutoFixNames (3 scans) consome helper canônico</b> — <code>_scanForStaleNames</code> em <code>auth.js</code>, que roda em toda abertura de sessão para detectar e corrigir nomes desatualizados de participantes (quando usuário editou <code>displayName</code> no perfil entre sessões), tinha 3 scans multi-shape espalhados pela rotina: <code>_scanMatch</code> (coleta de uid/email, L1875), <code>_scanMatchStale</code> (detecção de nome stale em partidas, L1985) e <code>_collectFromMatch</code> (coleta de strings para matching contra <code>previousDisplayNames</code>, L2033). Os 3 seguiam o mesmo padrão de 5 branches (<code>t.matches</code>, <code>t.rounds</code>, <code>t.groups.matches</code>, <code>t.groups.rounds</code>) — todos com o mesmo silent miss: <b>omitiam</b> <code>t.thirdPlaceMatch</code> e <code>t.rodadas</code>. Resultado: se um usuário mudava de displayName e só tinha partidas em fase de 3º lugar ou em rodadas legadas, o AutoFix simplesmente não detectava a divergência — o propagate (já migrado em v0.12.74) tinha consertado a correção, mas a <i>detecção</i> ainda escapava. Com esta migração, os 3 scans delegam para <code>window._collectAllMatches(t)</code>, cobrindo as 7 shapes. <code>g.players</code> (roster) segue tratado separadamente em cada scan que precisa dele. Verificado: helper devolve 7/7 matches da fixture (antes: 4/7). Fallback legado preservado em cada site. Com estas migrações, <b>todos os 4 scans multi-shape do auth.js</b> (AutoFix × 3 + propagate × 1) passam pelo helper canônico — a detecção/correção de nomes stale agora cobre todas as shapes de storage.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.74-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Propagação global de rename consome helper canônico</b> — <code>_propagateNameChange</code> em <code>auth.js</code> (usado sempre que o usuário edita o <code>displayName</code> no perfil, espalhando a mudança por todos os torneios onde ele aparece como <code>p1</code>/<code>p2</code>/<code>winner</code>/<code>team1</code>/<code>team2</code>) era a última cópia viva do padrão de 5 branches manuais que já havia sido migrado em <code>participants.js</code> (v0.12.72). O scan agora delega para <code>window._collectAllMatches(t)</code>, cobrindo as 7 shapes de armazenamento (<code>t.matches</code>, <code>t.rounds[].matches</code>, <code>t.groups[].matches</code>, <code>t.groups[].rounds[]</code> — array direto e <code>.matches</code>, <code>t.thirdPlaceMatch</code>, <code>t.rodadas</code> — array direto e <code>.matches</code>). O campo <code>g.players</code> (roster, não match) segue tratado separadamente. <b>Correção de bug silencioso:</b> nomes que só apareciam em <code>t.thirdPlaceMatch</code> antes não eram propagados — verificado em fixture onde "Zulu" aparecia apenas em <code>thirdPlaceMatch</code>: antes o rename ficava órfão, agora p1/team1/winner são atualizados corretamente. Fixture com todas as 7 shapes: 10/10 campos propagados corretamente. Fallback legado preservado caso <code>bracket-model.js</code> não carregue. Com essa migração, todos os 3 scans globais de rename (participants, dashboard widget, propagate) passam pelo helper canônico.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.73-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Pódio de eliminatória e scan <code>_nameInDraw</code> consomem adaptador/collector canônicos</b> — Mais duas leituras diretas de storage legado migradas. (1) O cálculo do pódio em torneios encerrados (<code>tournaments.js</code> L883) agora prefere as colunas <code>grandfinal</code> e <code>elim</code> devolvidas por <code>_getUnifiedRounds(t)</code> para localizar a partida final; cai na última coluna <code>elim</code> caso não haja <code>grandfinal</code>, e só então recorre ao scan legado <code>Math.max(m.round)</code> em <code>t.matches</code>. O 3º lugar vem da coluna canônica <code>thirdplace</code>. Verificado em 3 fixtures: eliminatória simples de 4 jogadores com 3º (A/D/B), elim sem 3º (X/Z/null), e dupla eliminatória com grande final (A/D/null via prioridade <code>grandfinal</code>). (2) O scan <code>_nameInDraw</code> dentro de <code>_executeMerge</code> em <code>tournaments-utils.js</code> — que verifica se um nome aparece em alguma partida antes de permitir merge de categorias — tinha uma falha silenciosa: olhava <code>t.matches</code>, <code>t.rounds[].matches</code> e <code>t.groups[].matches</code>, mas <b>omitia</b> <code>t.thirdPlaceMatch</code>, <code>t.groups[].rounds</code> e <code>t.rodadas</code>. Resultado: participantes que só apareciam nessas 3 shapes eram considerados "fora do chaveamento" e podiam ter a categoria mudada mesmo já tendo partida marcada. Agora delega para <code>window._collectAllMatches(t)</code>, que cobre todas as 7 shapes. Verificado: nomes em <code>thirdPlaceMatch.team1</code>, <code>rodadas[].matches</code> e <code>rodadas[].jogos</code> agora retornam <code>true</code> corretamente (antes: <code>false</code>). Fallback legado preservado em ambos os sites caso <code>bracket-model.js</code> não carregue.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.72-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Rename de jogador e widget "Próximas Partidas" consomem helper canônico</b> — Duas varreduras multi-shape migradas para <code>window._collectAllMatches(t)</code>: (1) O scan de renomeação de jogador em <code>participants.js</code> (que acompanha toda mudança de nome no perfil, propagando para <code>p1</code>/<code>p2</code>/<code>winner</code>/<code>team1</code>/<code>team2</code> em todas as partidas do torneio) antes tinha 5 branches explícitas (<code>t.matches</code>, <code>t.thirdPlaceMatch</code>, <code>t.rounds[].matches</code>, <code>t.groups[].matches</code> + <code>g.rounds</code>, <code>t.rodadas</code>); agora é uma única chamada ao helper. O campo <code>g.players</code> (roster, não match) segue tratado separadamente. (2) O widget "Próximas Partidas" na dashboard — que coleta todas as partidas pendentes do usuário em torneios ativos — tinha a mesma duplicação de 5 branches. Idem. Fallback legado preservado em ambos os sites caso <code>bracket-model.js</code> não esteja carregado. Verificado em fixtures cobrindo as 7 variantes de armazenamento (elim, 3º lugar, swiss, groups.matches, groups.rounds sub-array, rodadas array-direto, rodadas.matches): helper coleta todas as 7 refs, rename aplicado via refs atualiza o estado original por completo (0 leftovers); widget coleta 1 match pendente por fixture em cada shape. Com estas duas migrações, 7 dos ~8 sites remanescentes de varredura "flat-across-all-shapes" fora de <code>bracket-*</code> agora passam pelo helper canônico.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.71-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>CSV de resultados ganha rótulos semânticos e passa a incluir Suíço/Liga; progresso de torneio consome helper canônico</b> — Duas migrações focadas em caminhos de leitura remanescentes fora de <code>bracket-*</code>. (1) <code>_getTournamentProgress(t)</code> em <code>tournaments-utils.js</code>, que alimenta as barras de progresso no dashboard e na página de detalhes, agora delega sua varredura de 5 shapes legados para <code>window._collectAllMatches(t)</code>. Paridade byte-a-byte verificada em 6 fixtures (elim com 3º lugar, Suíço, Grupos com sub-rounds, Rei/Rainha, <code>t.rodadas</code> com <code>rd.jogos</code>, e elim com BYE). (2) <code>_exportTournamentCSV</code> em <code>tournaments-sharing.js</code>, que antes duplicava um scan incompleto (<b>silenciosamente omitia <code>t.rounds</code> e <code>t.rodadas</code> por inteiro</b> — ou seja, exports de Suíço/Ranking vinham sempre vazios na seção de matches), agora consome as colunas canônicas de <code>_getUnifiedRounds(t)</code>. Resultado: a coluna "Rodada/Fase" do CSV agora traz rótulos humanos do adaptador em vez de números genéricos — "Semifinais", "Final", "Quartas de Final", "Grupo A - Partida 1", "Disputa 3º lugar", "Rodada N". Em fixture de 4 jogadores com 3º lugar, o CSV passa de cabeçalho nu (0 matches exportados, bug existente) para 4 linhas rotuladas "Semifinais", "Semifinais", "Final", "Disputa 3º lugar". Fallback legado preservado em ambos os caminhos caso o adaptador não carregue; inclui agora também <code>t.rounds</code> e <code>t.rodadas</code> (fix defensivo).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.70-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Histórico de Atividades ganha rótulos semânticos + analytics consome helper canônico</b> — Duas migrações em <code>tournaments-analytics.js</code>: (1) O helper local <code>_getAllMatches(t)</code>, que duplicava a lógica de varredura multi-shape em ~22 linhas, agora delega para <code>window._collectAllMatches(t)</code>, com fallback legado preservado caso <code>bracket-model.js</code> não esteja carregado. Antes era uma das últimas cópias vivas do padrão "flat-every-match-across-shapes"; agora resta apenas o helper global. (2) <code>_buildActivityLog</code> passa a ler matches via <code>_getUnifiedRounds(t)</code>, aplicando rótulos humanos do adaptador em cada partida listada. Efeito visual: o Histórico de Atividades na página de detalhes do torneio agora mostra "(Semifinais)", "(Final)", "(Quartas de Final)", "(Grupo A)" e "(Disputa 3º lugar)" em vez do genérico "(Rodada 1)", "(Rodada 2)" etc. Em um torneio eliminatório de 4 jogadores, o card de atividade passa de "<i>Alice vs Bob → Alice (Rodada 1)</i>" para "<i>Alice vs Bob → Alice (Semifinais)</i>". Fallback legado mantido: se o adaptador não carregar ou retornar colunas vazias, o scan antigo (t.matches/t.rounds/t.groups/t.rodadas/t.thirdPlaceMatch) é usado. <code>_collectAllMatches</code> também foi estendido para reconhecer o campo legado <code>rd.jogos</code> dentro de <code>t.rodadas</code>. Verificado em fixture de torneio de 4 jogadores com 3 matches resolvidas + disputa de 3º lugar — HTML resultante contém "Semifinais" (2x), "Final" e "Disputa 3º lugar", sem nenhum "Rodada 1".</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.69-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Modo TV — "Próximos Jogos" ganha rótulos semânticos via adaptador canônico</b> — O quarto scan pendente (<code>_tvBuildNextMatches</code>) foi migrado para consumir as colunas devolvidas por <code>_getUnifiedRounds(t)</code>. Cada coluna já carrega um rótulo humano ("Final", "Semifinais", "Quartas de Final", "Oitavas", "Rodada N", "Grupos"), e o scan usa esse rótulo como <code>_roundLabel</code> da partida. Resultado visível para o usuário: em torneio eliminatório de 4 jogadores, as partidas da Rodada 1 agora aparecem rotuladas como "Semifinais" e a Rodada 2 como "Final" (antes, partidas de <code>t.matches</code> não tinham rótulo algum no Modo TV); em 8 jogadores, "Quartas"/"Semifinais"/"Final"; em 16, "Oitavas"/"Quartas"/etc. Formatos Suíço/Liga preservam "Rodada N" (adaptador usa o mesmo rótulo) e grupos preservam "Grupo A"/"Grupo B"/etc. por subgrupo. Fallback legado mantido quando adaptador não carrega ou retorna colunas vazias (ex: torneio sem <code>currentStage</code>). Verificado em 5 fixtures: elim 4 jogadores, elim 8 jogadores, Suíço 2 rodadas, Grupos com <code>currentStage=\'groups\'</code>, e Grupos sem currentStage (exercitando o fallback). Com isso, todos os 4 sites de varredura multi-shape em <code>bracket-ui.js</code> agora passam por helpers canônicos (3 por <code>_collectAllMatches</code>, 1 por <code>_getUnifiedRounds</code>).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.68-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Helper canônico de leitura <code>_collectAllMatches</code> unifica 3 varreduras duplicadas em <code>bracket-ui.js</code></b> — Extraído <code>window._collectAllMatches(t)</code> em <code>bracket-model.js</code>: devolve um array flat com todas as partidas espalhadas pelas 5 formas legadas (<code>t.matches</code>, <code>t.rounds[].matches</code>, <code>t.groups[].matches</code>, <code>t.groups[].rounds[].matches</code>, <code>t.thirdPlaceMatch</code>, e o campo legado <code>t.rodadas</code> com suas 2 shapes). Três sites em <code>bracket-ui.js</code> migrados: <code>_substituteWO</code> (detecção de jogador ausente para W.O., L248), <code>_shareMatchResult</code> (busca de match por id para compartilhar, L1124) e <code>_tvBuildAttendance</code> (scan de presença no modo TV, L1283). Byte-parity test confirma que o helper é um <i>strict superset</i> de cada scan legado — extras (3º lugar, sub-rounds de grupos, rodadas legadas) são filtrados pelos guards existentes em cada chamador (<code>!m.winner</code>, <code>!m.isBye</code>, <code>p1 &amp;&amp; p2</code>, TBD guard). Como efeito colateral benigno, o scan de W.O. e o share agora também encontram matches em sub-rounds de grupos e no 3º lugar, o que antes escapava silenciosamente. Quarto scan em <code>_tvBuildNextMatches</code> (L1233) <b>não</b> migrado — ele pina <code>_roundLabel</code> como metadado em cada match durante a enumeração, um side-effect específico que não cabe no helper genérico. Parity verificada em fixtures elim/swiss/groups/rodadas via 6 casos unitários (helperPresent, empty, elim, swiss, groups com sub-rounds, rodadas legadas, null/undef safe), todos passaram.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.67-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Helper canônico <code>_appendCanonicalColumn</code> corrige branch <code>thirdplace</code> e sites de inicialização migrados</b> — O helper tinha uma branch morta para <code>phase=\'thirdplace\'</code> que erroneamente empurrava o match para <code>t.matches[]</code> (caminho legado de fases elim/grand). Como a legacy storage do 3º lugar é o campo único <code>t.thirdPlaceMatch</code>, chamar o helper com essa fase corrompia o estado. Corrigido com early-return dedicado: <code>if (phase === \'thirdplace\') { t.thirdPlaceMatch = desc.matches[0]; return; }</code>. Com a branch funcional, os 2 sites de inicialização de <code>t.thirdPlaceMatch</code> foram migrados: <code>bracket-logic.js</code> L887 (em <code>_maybeAdvanceWinner</code>, ao detectar que faltava o match de 3º lugar) e <code>bracket.js</code> L569 (em <code>_ensureFutureRounds</code>, garantindo o match ao renderizar). Ambos passam a criar o match via <code>_appendCanonicalColumn(t, {phase:\'thirdplace\', matches:[{...}]})</code>. Zero mudança comportamental — a saída é literalmente a mesma atribuição <code>t.thirdPlaceMatch = {...}</code> feita antes, mas agora roteada pelo mesmo helper usado pelas demais fases. Verificado por testes unitários (helper define campo corretamente e não toca <code>t.matches</code>; matches vazio não crasha) e teste ao vivo (renderizar torneio sem 3º lugar → card aparece automaticamente com placeholder TBD × TBD, conforme política "always on"). Com isso, 100% das escritas canônicas em campos legados (elim, grand, thirdplace, swiss, monarch, liga) passam pelo helper — a Fase 3 está essencialmente completa.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.66-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Leitura do 3º lugar no renderer de eliminatória simples migrada para o adaptador</b> — <code>renderSingleElimBracket</code> agora obtém o match de 3º lugar da coluna canônica <code>thirdplace</code> emitida por <code>_getUnifiedRounds(t)</code>, com fallback para <code>t.thirdPlaceMatch</code> e depois para o placeholder vazio. Antes o renderer lia <code>t.thirdPlaceMatch</code> diretamente; agora segue o mesmo padrão dos demais campos (colunas elim, grand, groups, swiss-past, etc.). Verificado em 3 cenários: (1) com <code>thirdPlaceMatch</code> configurado, card renderiza com participantes corretos; (2) sem <code>thirdPlaceMatch</code>, placeholder "3º LUGAR" aparece conforme política "always on" (project memory); (3) com adaptador desabilitado, fallback legado para <code>t.thirdPlaceMatch</code> funciona. A/B byte-parity: com adaptador vs sem adaptador, saída idêntica (19978 bytes vs 19978 bytes, 0 delta). Essa é a última leitura direta de <code>t.thirdPlaceMatch</code> no renderer — futuras mudanças visuais no 3º lugar podem ser feitas em um único lugar (emissão da coluna no adaptador) e propagam para o renderer.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.65-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Geradores de eliminatória migrados para o helper canônico — Fase 3 contínua</b> — 8 sites de <code>t.matches.push</code> espalhados por 3 arquivos agora passam pelo helper <code>_appendCanonicalColumn</code>: 6 em <code>tournaments-draw.js</code> (single-elim shell rounds 2+, dupla eliminatória upper bracket, lower R1, lower merge rounds, lower battle rounds, grande final), 1 em <code>bracket.js</code> (rebuild de rodadas faltantes no advance-winner) e 1 em <code>bracket-ui.js</code> (transição Rei/Rainha → eliminatória). Cada chamada marca explicitamente a fase (<code>elim</code> ou <code>grandfinal</code>) e, quando aplicável, o bracket (<code>upper | lower | grand</code>). Zero mudança comportamental — o helper para fases elim apenas concatena em <code>t.matches[]</code> preservando ordem e semântica legada. Verificado em fixtures de 4 jogadores: single-elim (2 R1 + 1 Final, links nextMatchId corretos) e dupla eliminatória (2 upper R1, 1 upper R2, 1 lower R1, 1 grand final, todos com bracket tag). Adaptador <code>_getUnifiedRounds</code> consome corretamente a saída migrada — 4 colunas para dupla (upper R1, upper R2, lower R1, grand final) com labels "Rodada 1", "Rodada 2", "Grande Final". Com isso, ~90% dos writes para <code>t.matches/t.rounds</code> passam pelo helper. Sites remanescentes são caminhos raros (seed de times via drag-drop em <code>tournaments-draw.js</code>) ou operações de mutação in-place (advance winner), a migrar sob demanda.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.64-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Geradores Swiss/Liga/Rei-Rainha migrados para helper de escrita canônico — início da Fase 3</b> — Extraído <code>window._appendCanonicalColumn(t, desc)</code> em <code>bracket-model.js</code>: a função encapsula o conhecimento de "qual campo legado receber o append dada a fase" (<code>elim | grandfinal | thirdplace</code> → <code>t.matches[]</code>; <code>swiss | liga | monarch</code> → <code>t.rounds[round-1]</code>, com merge correto quando a posição já existe). Os 3 sites de push quase-idênticos em <code>bracket-logic.js</code> foram substituídos por chamadas ao helper: <code>_generateReiRainhaRoundForPlayers</code> (rodada de Rei/Rainha com grupos e <code>format: \'rei_rainha\'</code>), <code>_generateNextRound</code> na branch Liga (matches acumulam na rodada existente quando chamado por categoria), e <code>_generateNextRound</code> na branch Swiss. Nenhuma mudança comportamental — o helper reproduz exatamente a sequência legada (incluindo o sobrescreve-sempre em <code>.format</code>). Verificado por testes unitários diretos do helper (6 casos de shape) e testes end-to-end chamando os geradores ao vivo com fixtures Swiss (4 jogadores), Liga (8 jogadores, formato duplas), e Rei/Rainha (4 jogadores com grupo AB/CD/AC/BD/AD/BC): todas as saídas têm shape canônico correto (<code>round</code>, <code>status</code>, <code>matches</code>, <code>format</code> e <code>monarchGroups</code> quando aplicável). Primeiro passo em unificar a escrita — próximos candidatos: sites <code>t.matches.push</code> em <code>tournaments-draw.js</code> (geração de eliminatória), rebuild de <code>bracket-ui.js</code>, e advance-winner em <code>bracket.js</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.63-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Renderer de Classificação (Liga/Suíço/Rei-Rainha) migrado para o adaptador canônico — fim da Fase 2</b> — <code>renderStandings</code> agora deriva o array de rodadas a partir das colunas <code>swiss | monarch | liga</code> devolvidas por <code>_getUnifiedRounds(t)</code>, achatando cada coluna de volta para o shape legado <code>{matches, status, format, monarchGroups, round}</code> que a renderização consome. Todas as seções do render (classificação principal com categorias, rodada atual, rodadas anteriores, estatísticas de torneio, matriz de confrontos diretos, layout em colunas do Suíço) continuam funcionando sem alteração. Verificado por teste A/B byte-a-byte em 4 fixtures (Suíço 3 rodadas, Liga com 2 categorias, Rei/Rainha com grupo de 4 jogadores, Suíço 2 rodadas): <b>0 bytes de diferença</b> entre a saída com e sem adaptador. Com isso, os 5 renderers (eliminatória simples, dupla, grupos, Rei/Rainha, Liga/Suíço) agora consomem a mesma forma canônica — qualquer refinamento visual feito uma vez propaga para todos os formatos. Próxima fase: unificar também os geradores (draw logic) para gravar direto no shape canônico.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.62-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Renderer de Dupla Eliminatória migrado para o adaptador canônico</b> — <code>renderDoubleElimBracket</code> agora consome as colunas devolvidas por <code>_getUnifiedRounds(t)</code>, particionadas pelo novo campo <code>bracket</code> (<code>upper</code>, <code>lower</code>, <code>grand</code>). O adaptador foi enriquecido para emitir uma coluna por combinação (bracket, rodada) em vez de uma coluna por rodada: chaveamento superior e inferior aparecem como seções separadas com suas próprias rodadas, e a grande final sai etiquetada como fase <code>grandfinal</code> com rótulo correto em PT/EN. Single-elim continua intocado (sem campo <code>m.bracket</code>, o adaptador roteia pelo caminho <code>bracketOrder = [null]</code> preservando rótulos Semifinais/Final/etc.). Verificado em fixture dupla (upper R1+R2, lower R1, grand R1) e em fixture single-elim (regressão). Zero regressão. Quarto renderer migrado — falta apenas <code>renderStandings</code> (Liga/Suíço).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.61-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Renderer de Fase de Grupos migrado para o adaptador canônico</b> — <code>renderGroupStage</code> agora consome os subgrupos devolvidos por <code>_getUnifiedRounds(t)</code> (fase <code>groups</code>). O adaptador ficou um pouco mais rico: agora cada subgrupo preserva também o array <code>rounds[]</code> com <code>{round, status, matches}</code>, de modo que o renderer iterando sobre as rodadas continua tendo acesso aos rótulos "Rodada 1 — Concluído ✓", "Rodada 2 — Em andamento" etc., sem precisar reler <code>t.groups[i].rounds</code>. Verificado em fixture de 2 grupos × 4 jogadores × 3 rodadas (Grupo A totalmente concluído, Grupo B com rodada 2 em andamento e 3 pendente): mesmos nomes, mesmas cores por grupo (laranja/roxo), mesmas classificações com badge CLASSIF. nos top-2, mesmos rótulos de rodada, botão "Avançar para Eliminatória" corretamente oculto quando ainda há partidas pendentes. Zero regressão. Terceiro renderer migrado — faltam <code>renderDoubleElimBracket</code> e <code>renderStandings</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.60-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Renderer Rei/Rainha migrado para o adaptador canônico</b> — <code>_renderMonarchStage</code> agora itera sobre os subgrupos devolvidos por <code>_getUnifiedRounds(t)</code> (fase <code>monarch</code>) em vez de ler <code>t.groups</code> diretamente. O cálculo de classificação via <code>_computeMonarchStandings</code> continua exatamente o mesmo, assim como o HTML de cada grupo (status, tabela, cards de partida). Segundo renderer consumindo o modelo canônico — verificado em fixture de 2 grupos × 4 jogadores (Grupo A finalizado, Grupo B em andamento): mesmos rótulos, mesmas bordas coloridas, mesmas tabelas de classificação, mesmos cards de partida. Zero regressão. Faltam <code>renderDoubleElimBracket</code>, <code>renderGroupStage</code> e <code>renderStandings</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.59-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Primeiro renderer migrado para o adaptador canônico</b> — O renderer da eliminatória simples (<code>renderSingleElimBracket</code>) agora deriva a estrutura de colunas (rodadas eliminatórias + colunas históricas de Suíço classificatório) a partir de <code>_getUnifiedRounds(t)</code> em vez de ler <code>t.matches</code> e <code>t.swissRoundsData</code> diretamente. A saída visual é <b>idêntica</b> à versão anterior (verificado em dois cenários: torneio Suíço→Elim de 20 jogadores e eliminatória pura de 8 jogadores — mesmas 6 e 3 colunas, mesma largura de scroll, mesmas marcas de avanço ✓). Zero regressão, mas este é o primeiro renderer consumindo o modelo canônico. Nos próximos passos os outros 4 renderers (dupla eliminatória, grupos, Rei/Rainha, Liga/Suíço) também serão migrados, e a partir daí qualquer refinamento visual ou correção feita uma vez propaga para todos os formatos automaticamente.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.58-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Adaptador unificado de chaves (fundação arquitetural)</b> — Novo módulo <code>bracket-model.js</code> expõe <code>window._getUnifiedRounds(t)</code>, que lê qualquer um dos três formatos internos (<code>t.matches</code>, <code>t.rounds</code>, <code>t.groups</code>) e devolve uma única forma canônica de "colunas da tira unificada". Cada coluna já traz fase (<code>swiss</code>, <code>elim</code>, <code>groups</code>, <code>monarch</code>, <code>thirdplace</code> etc.), rótulo, status e partidas — prontos para o renderer consumir de um jeito só. É código novo, inerte nesta versão (nenhum renderer o chama ainda), mas é a base para unificarmos, nos próximos deploys, os 5 renderers e os N geradores numa única pipeline — eliminando o problema de ajustes visuais e correções precisarem ser reaplicados formato a formato. Verificado com 5 fixtures (elim, Suíço→elim, Liga, Grupos+Elim, Rei/Rainha). Disponível para inspeção via <code>window._bracketModelSanityChecks()</code> no console.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.57-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Tira única: Suíço + Eliminatória num só chaveamento horizontal</b> — Na v0.12.56 a fase classificatória Suíço virava um card separado <i>abaixo</i> do bracket eliminatório, com botão Mostrar/Ocultar. Agora as rodadas Suíço já disputadas aparecem como <b>colunas à esquerda do bracket</b>, na mesma tira horizontal das Quartas/Semi/Final — uma chave única sincrética, adaptada por caso. Cada coluna Suíço leva o selo "Suíço R1 ✓", "Suíço R2 ✓" etc. com os placares compactos, e o ✓ verde marca quem avançou para a eliminatória. O organizador/participante enxerga a linha do tempo completa do torneio num só scroll, sem troca de contexto ou abrir/fechar acordeões. Primeiro passo de uma refatoração maior para unificar os caminhos de geração/renderização de todos os formatos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.56-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Correção: após o Suíço classificatório, bracket eliminatório aparece continuamente</b> — Em torneios que usavam Suíço como resolução de potência de 2 (ex: 20 inscritos → 2 rodadas Suíço → top 16 eliminatória), assim que a última rodada Suíço era fechada, a tela caía num estado "Nenhuma rodada gerada ainda / 🎲 Iniciar Primeira Rodada" por uns instantes — apagando a sensação de continuidade do torneio. A transição para a eliminatória agora faz o bracket (já desenhado pelo sorteio automático) aparecer imediatamente na tela.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.55-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>"3º Lugar" com ordinal sobrescrito</b> — As chaves i18n <code>bracket.thirdPlace</code> e <code>bracket.thirdPlaceLabel</code> em português estavam escritas como "3o Lugar" (letra "o" minúscula), o que em maiúsculas virava "3O LUGAR" e podia ser lido como "30 LUGAR". Trocado pelo caractere ordinal masculino (º), deixando "3º Lugar" — legível em qualquer casing.</p>' +
        '<p><b>Classificação colapsável (oculta por padrão)</b> — A tabela de classificação do Suíço/Liga agora aparece recolhida por padrão, com um cabeçalho clicável "▸ Mostrar classificação" no card. Ao clicar, expande para a tabela completa com todos os critérios de desempate e vira "▾ Ocultar classificação". Tira carga visual da tela inicial (os cards de partida e o bracket continuam em destaque) e dá acesso rápido a quem quer ver a tabela detalhada.</p>' +
        '<p><b>Rodadas Anteriores abertas por padrão</b> — O bloco "📜 Rodadas Anteriores" do Suíço/Liga volta a aparecer expandido por padrão (como já acontecia na eliminatória simples), mas mantém o cabeçalho clicável para ocultar quando o histórico fica longo.</p>' +
        '<p><b>Botão "Ocultar" padronizado nas Rodadas Anteriores</b> — Substituímos o antigo <code>&lt;details&gt;</code> do bloco "📜 Rodadas Anteriores" pelo mesmo botãozinho pill "Ocultar" / "Mostrar" já usado inline nas rodadas da eliminatória linear. Assim a UX fica consistente entre os formatos e o organizador/jogador identifica o controle de imediato.</p>' +
        '<p><b>Botão "Voltar" no fluxo de Novo Torneio</b> — O modal rápido de criação e o formulário avançado agora trazem o botão "← Voltar" (estilo pill padrão do app) fixo no topo, sempre visível enquanto o usuário rola o formulário. Consistente com a navegação de outras telas e oferece uma saída previsível para quem abriu por engano ou mudou de ideia.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.54-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>3º Lugar sempre visível no chaveamento futuro</b> — Na v0.12.53 o card "🥉 3º Lugar" só aparecia quando o torneio tinha flags legadas (thirdPlace/elimThirdPlace) ligadas. Como a disputa de terceiro lugar é obrigatória no Scoreplace há tempos (não é mais opção do organizador), o card agora é sempre exibido abaixo da Final — em todo torneio eliminatório.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.53-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Disputa de 3º Lugar no chaveamento futuro</b> — A coluna da Final ganhou, logo abaixo do card da partida final, um card tracejado "🥉 3º Lugar" para a disputa de terceiro colocado. Antes só aparecia a Final — agora o organizador e os participantes veem desde o início que haverá disputa de 3º lugar e quantos confrontos no total (mesmo padrão do bracket linear já existente, onde o 3º lugar fica empilhado na coluna da Final).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.52-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Cada rodada numa coluna (sistema linear) no chaveamento Suíço</b> — Na v0.12.51 as rodadas futuras apareciam empilhadas verticalmente como cards de largura total, uma embaixo da outra. Agora a visualização segue o mesmo sistema do chaveamento eliminatório linear: cada rodada ocupa uma coluna vertical, e as colunas ficam lado a lado numa tira horizontal com scroll. A rodada atual (com inputs de placar, botões de confirmar, Encerrar Rodada) fica na primeira coluna; as rodadas Suíço pendentes seguem à direita; e, quando o Suíço é resolução de potência de 2, as rodadas eliminatórias (Oitavas → Quartas → Semi → Final, tracejadas em dourado) seguem depois. O cabeçalho "🎯 Fase Classificatória → 🏆 Fase Eliminatória" fica acima da tira, unificado. Assim o organizador enxerga o fluxo completo da esquerda pra direita, igual ao bracket linear, sem ter que scrollar pra baixo pra ver as próximas rodadas.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.51-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Rodadas futuras com slots "A definir" no lugar dos times</b> — As rodadas ainda não disputadas apareciam como um único card de texto ("Aguardando rodada anterior"), sem dar ideia de quantos jogos teriam nem como seriam visualmente. Agora cada rodada futura (Suíço classificatório remanescente + toda a fase eliminatória) é renderizada como um card completo, com o mesmo número de partidas que a rodada vai ter e cada partida mostrando dois slots "? A definir" em estilo tracejado. Conforme os adversários são definidos (Suíço: pela classificação da rodada anterior; eliminatória: pelos top N classificados), os slots são preenchidos. Assim o organizador e os participantes enxergam desde o primeiro jogo a estrutura completa do torneio — não só quantas rodadas, mas também quantos confrontos em cada uma.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.50-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Correção crítica: Confirmar placar da Rodada 2/2 do Suíço não salvava</b> — Em torneios Eliminatórios com Suíço como resolução de potência de 2 (ex: 20 inscritos → 2 rodadas Suíço → top 16 na eliminatória), ao encerrar a Rodada 1 o app disparava o fechamento dela por <i>dois caminhos duplicados</i> — o auto-close do último placar (v0.12.47) e a rede de segurança do render (v0.12.48) — no mesmo tick. O primeiro fechava a Rodada 1 e gerava a Rodada 2; o segundo, chamado imediatamente depois com o mesmo índice, via <code>rounds.length = 2</code>, achava que as 2 rodadas Suíço já estavam cumpridas e <i>transicionava direto para a eliminatória</i>, apagando a Rodada 2 recém-gerada. O organizador via os confrontos da Rodada 2 sumirem antes mesmo de poder lançar placares. Adicionado guard em <code>_doCloseRound</code>: ignora chamadas com <code>roundIdx</code> obsoleto (já não é a última rodada) ou para rodadas já marcadas como <code>complete</code>. O fechamento da rodada agora é idempotente — qualquer número de disparos produz o mesmo resultado.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.49-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fase eliminatória também visível quando Suíço é apenas a resolução de potência de 2</b> — Continuação da v0.12.48. Em torneios onde o formato é Eliminatórias mas o Suíço foi escolhido como resolução para o problema de potência de 2 (ex: 20 inscritos → 2 rodadas Suíço → top 16 entra na chave eliminatória), o chaveamento só mostrava as rodadas Suíço — parecia um torneio Suíço puro sem eliminatória. Agora o chaveamento exibe a estrutura completa desde o início: um cabeçalho azul <i>"🎯 Fase Classificatória — Suíço — N rodadas"</i> acima da rodada atual, e depois dos placeholders Suíço um cabeçalho dourado <i>"🏆 Fase Eliminatória (Top N)"</i> seguido de cards tracejados para cada rodada eliminatória (Oitavas, Quartas, Semifinais, Final — com nomes apropriados ao número de classificados). Assim o organizador e os participantes veem desde o primeiro dia todas as fases do torneio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.48-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Todas as rodadas Suíço visíveis desde o início + desbloqueio de torneios travados</b> — O chaveamento Suíço mostrava só a rodada atual; o usuário tinha que deduzir pelas contagens quantas rodadas faltavam. Agora as rodadas futuras aparecem como cards tracejados ("Rodada 2/2 • Aguardando rodada anterior") abaixo da rodada em andamento — os confrontos são sorteados automaticamente quando a rodada anterior termina (pareamento Suíço precisa das classificações do round anterior pra ser justo, então não dá pra sortear tudo de uma vez). Também foi adicionada uma rede de segurança no render do chaveamento: se uma rodada está com todos os resultados lançados mas não foi encerrada (caso de torneios criados antes da v0.12.47), o app dispara o fechamento automaticamente, gerando a próxima rodada. Dashboard: a seção "Torneios Encerrados" agora abre fechada por padrão — clique na seta para expandir.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.47-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Suíço: avanço automático para a próxima rodada</b> — Em torneios com Suíço como resolução de potência de 2 (e em Suíço puro também), ao lançar o último resultado de uma rodada, o app não gerava a próxima rodada automaticamente — o organizador precisava clicar em "Encerrar Rodada" manualmente, e isso não estava óbvio. Relatado em torneio de 2 rodadas Suíço: após registrar todos os placares da Rodada 1, a Rodada 2 simplesmente não aparecia. Agora, quando o último resultado de uma rodada é registrado, o app dispara automaticamente o fechamento da rodada e gera a próxima (ou transiciona para a fase eliminatória, se Suíço estava sendo usado como classificação). O botão manual "Encerrar Rodada" continua disponível caso se queira encerrar antes da hora.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.46-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Painel "Tudo Pronto para o Sorteio!": botões sempre visíveis + registro no histórico</b> — O painel final estava cortando embaixo em telas altas: o botão "Voltar e Revisar" aparecia parcialmente atrás da barra de endereço do iOS. Reestruturado em flex-column com rodapé fixo — os botões "Rodar Sorteio Agora" e "Voltar e Revisar" ficam sempre visíveis, o meio (checklist e histórico) rola internamente se precisar. A resolução do resto (Lista de Espera, Exclusão) agora também é gravada no Histórico de Resoluções, com indicação do método (sorteio geral ou últimos inscritos) e os nomes dos afetados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.45-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Painel do resto: cobertura total e descrição dinâmica do toggle</b> — Em telas altas (iPhone com barra de endereço recolhida), o overlay escuro deixava aparecer o conteúdo do torneio abaixo do painel. Trocado para cobertura absoluta (<code>inset:0</code> + <code>100dvh</code>) com opacidade 0.96 e blur de fundo, garantindo isolamento visual total. A descrição do toggle "Sorteio Geral" agora alterna em tempo real: com ele ativo mostra "Sorteio entre todos os inscritos."; desligado, "Aplica aos últimos inscritos.".</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.44-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Resolução do resto: painel único com toggle "Sorteio Geral"</b> — Ao clicar em <b>Sortear</b> num torneio em que sobram participantes sem formar time/chave completa, o app mostrava <i>dois painéis diferentes</i> dependendo do caminho: um amarelo ("Times Incompletos") com Repescagem/Lista de Espera/Exclusão, e outro roxo ("Participantes Restantes") com Reabrir/Lista de Espera/Exclusão. Além disso, escolher Lista de Espera ou Exclusão abria <i>mais um painel</i> perguntando se deveria sortear entre todos ou remover os últimos inscritos — 3 telas para uma decisão.</p>' +
        '<p>Agora é tudo num painel só (o roxo). Acima das opções aparece um toggle <b>Sorteio Geral</b>, ligado por padrão: com ele ativo, o app sorteia aleatoriamente entre todos os inscritos; desligado, retira os que se inscreveram por último. Clicar em Lista de Espera ou Exclusão aplica a ação imediatamente segundo o toggle, sem tela intermediária. O painel amarelo antigo foi removido, assim como o painel de sub-escolha.</p>' +
        '<p>Correção de layout: o painel estava cortando embaixo em telas estreitas (iOS Safari com a barra de endereço dinâmica). Trocado <code>100vh</code> por <code>100svh</code> e <code>90vh</code> por <code>94svh</code> para que a última opção apareça inteira.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.43-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Nomes tradicionais de rodada só até Oitavas</b> — "Dezesseis avos" e "Trinta e dois avos" não são nomes usados na prática — torneios reais começam a nomear rodadas a partir das Oitavas de Final (8 jogos). Rodadas anteriores voltam a ser exibidas como "Rodada 1", "Rodada 2", etc. Chaveamentos com mais de 16 participantes agora mostram: Rodada 1 → Oitavas → Quartas → Semifinais → Final.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.42-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botão "Voltar" parou de funcionar no chaveamento depois que todos os resultados foram lançados</b> — Sintoma: com o torneio finalizado (todos os jogos com placar e o banner "🏆 Campeão" no topo da chave), clicar em "Voltar" na barra sticky no alto da tela não tinha efeito. Causa raiz: em telas estreitas a topbar pode quebrar em duas linhas (ficando ~90px de altura em vez de 60px), mas a <code>.sticky-back-header</code> estava fixada em <code>top: 60px</code> no CSS — então a parte baixa da topbar pintava <i>por cima</i> do botão Voltar. Mesmo com <code>z-index: 101</code> no back-header (acima do 100 da topbar), <code>position:sticky</code> com backdrop-filter acaba vencendo <code>position:fixed</code> quando os retângulos se cruzam, em vários browsers. Correção: o helper <code>_syncBackHeaderSpacer</code> agora mede a altura real da topbar e seta <code>top</code> do back-header para esse valor — header fica empurrado pra baixo até onde a topbar terminar, sem sobreposição. ResizeObserver agora também observa a topbar para recalcular na hora que ela quebra/desdobra (login/logout, filtros, redimensionamento). Não era um bug ligado a "finalizar torneio" em si — ficava aparente nessa tela porque o torneio finalizado era exibido em contextos de viewport mais estreito (tablet/mobile landscape) onde a topbar quebrava.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.41-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Rodadas com nomes tradicionais — Oitavas de Final e além</b> — Antes, só as três últimas rodadas de um chaveamento eliminatório recebiam nomes tradicionais: <i>Final</i>, <i>Semifinais</i> e <i>Quartas de Final</i>. Rodadas anteriores caíam no genérico "Rodada N". Agora a nomenclatura segue até onde os torneios de verdade nomeiam: rodada com 8 jogos = <b>Oitavas de Final</b> (em inglês, <i>Round of 16</i>), rodada com 16 jogos = <b>Dezesseis Avos de Final</b> (<i>Round of 32</i>), rodada com 32 jogos = <b>Trinta e Dois Avos de Final</b> (<i>Round of 64</i>). O cálculo continua sendo por distância da final (fromEnd), então funciona tanto em eliminatória simples quanto em repescagem/double elimination, respeitando o tamanho real do chaveamento (torneios menores pulam direto para Quartas/Semis/Final).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.40-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Check-in da view de Inscritos — boxes de jogos uniformes e botão "Limpar" removido</b> — Duas correções visuais na tela de check-in do torneio: (1) O botão <b>"Limpar"</b> (vermelho, ao lado da barra de progresso) foi removido — ele chamava <code>_resetCheckIn</code> e zerava todos os check-ins e ausências do torneio sem distinguir entre "corrigir engano" e "recomeçar do zero", o que era perigoso e sem atalho de desfazer. Controle fino continua disponível via toggle individual por participante. (2) Os <b>boxes de jogos</b> (cartões "Jogo X" com os jogadores e dots de presença) eram renderizados com <code>flex-wrap</code> e <code>flex:1</code>, o que fazia o último box de cada linha esticar para preencher a largura disponível — inconsistente quando sobrava um jogo no final da linha. Agora usam CSS grid com <code>grid-template-columns:repeat(auto-fill, minmax(200px, 220px))</code>: boxes sempre com o mesmo tamanho fixo (~200–220px, o tamanho de 2 colunas no mobile), e mais colunas aparecem conforme a tela fica mais larga, nunca esticando um box isolado.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.39-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Placar ao vivo em torneio — agora faz check-in, avança o vencedor e usa "Semifinais" no plural</b> — Três correções na gravação de resultado via placar ao vivo de um card do chaveamento: (1) <b>Check-in automático</b>: antes, só o fluxo do lançamento inline (<code>_saveSetResult</code>) marcava ambas as duplas como presentes; o <code>_saveResult</code> do live-scoring salvava o placar mas deixava perdedores sem <code>checkedIn</code>, o que disparava WO e outras heurísticas de ausência mesmo após o jogo ter sido disputado. Agora o live-scoring também popula <code>t.checkedIn</code> para os 4 jogadores (ou 2 no individual), limpa <code>t.absent</code>, e marca <code>t.tournamentStarted</code> se ainda não estava — suportando tanto o separador <code>A / B</code> do fluxo padrão quanto <code>A/B</code> do live-scoring. (2) <b>Avanço antes do re-render</b>: a ordem era <code>syncImmediate → saveTournament → _rerenderBracket → _advanceWinner → _maybeFinishElimination</code>. O re-render lia o estado <i>antes</i> do avanço, então o próximo card da rodada seguinte continuava com "TBD" até o próximo tick de sync. A nova ordem é <code>_advanceWinner → _maybeFinishElimination → syncImmediate → saveTournament → _rerenderBracket</code>, e o card da próxima rodada já mostra o vencedor imediatamente. (3) <b>"Semifinais" no plural</b>: a label <code>bracket.semiFinal</code> em pt e en estava como "Semifinal"/"Semifinal" mas agrupa <i>múltiplos</i> jogos da mesma rodada (como "Quartas de Final" / "Quarterfinals" já estão). Corrigida para "Semifinais" (pt) e "Semifinals" (en).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.38-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Tela final do placar ao vivo em partida de torneio — só mostra "Confirmar Resultado"</b> — Quando o placar ao vivo é aberto a partir de um card do chaveamento, a tela de vitória exibia os mesmos botões da Partida Casual: "↺ Resetar" e "✕ Fechar" no cabeçalho, e "🔄 Jogar Novamente" + toggle "Re-sortear duplas" pinados no topo. Nenhum deles faz sentido num torneio — resetar jogaria fora o resultado que já vai para o chaveamento, re-sortear misturaria as duplas do torneio, e o próprio "Fechar" era ambíguo (salva? descarta?). Agora, ao terminar a partida em modo torneio, <b>todos esses botões somem</b> e no lugar aparece um único botão verde <b>"✓ Confirmar Resultado"</b>. Clicar grava o resultado na partida, avança o vencedor pelo chaveamento (via <code>_advanceWinner</code> e <code>_maybeFinishElimination</code>), fecha o overlay e o usuário cai de volta no bracket já rolado para o card daquela partida (ancoragem existente em <code>_rerenderBracket(tId, matchId)</code>). Modo Partida Casual continua com os botões originais.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.37-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Cabeçalho fixo não corta mais o primeiro card em telas estreitas</b> — O cabeçalho fixo no topo das views (Inscritos, Explorar, Notificações, Regras, etc.) usava um espaçador CSS de altura fixa (<code>margin-top: 50px</code>) para que o conteúdo abaixo não ficasse por trás dele. O problema: em telas estreitas o cabeçalho podia ter 2 ou 3 linhas (título + pílulas de filtro Todos/Presentes/Ausentes/Aguardando + barra de progresso + botão Limpar) e ficar com 140–160px de altura, fazendo o primeiro card de participante desaparecer atrás do cabeçalho. Agora um helper global (<code>_syncBackHeaderSpacer</code>) mede a altura real do cabeçalho via <code>getBoundingClientRect()</code> e aplica um <code>margin-top</code> correspondente no próximo elemento, mais 8px de folga. ResizeObserver no cabeçalho e MutationObserver no <code>view-container</code> mantêm o espaçador sempre em sinc — se o usuário redimensiona a janela, ativa um filtro que adiciona/remove linhas, ou navega entre views, o espaçador recalcula automaticamente.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.36-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Placar ao Vivo em partidas de torneio — organizador, participante ou árbitro podem lançar pontos ao vivo</b> — Antes o botão "📡 Ao Vivo" só aparecia no card de partida para o <i>participante</i> (quando a regra "Jogadores lançam" estava ativa) e em jogos que eram dele. Agora o mesmo botão fica disponível para qualquer um que a regra de lançamento permita: <b>organizador</b> (sempre, inclusive em jogos que não são dele), <b>participante</b> (quando "Jogadores" estiver ativo e o jogo for dele — comportamento preservado) e <b>árbitro</b> (quando a regra "Árbitro" estiver ativa, em qualquer jogo). Clicando abre exatamente a mesma tela de placar ao vivo das Partidas Casuais — com contagem de sets, games, pontos, tiebreak, log de rally, controle de saque — e ao final grava o resultado no card, avança o vencedor no chaveamento e sincroniza com o Firestore como se fosse um lançamento manual. Configurar quem pode lançar continua no campo "Lançamento de Resultado" das regras do torneio (organizador / jogadores / árbitro ou qualquer combinação).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.35-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Sup do tie-break agora mostra o placar real do vencedor, não a base 7</b> — Quando um tie-break é decidido com a regra de 2 pontos de vantagem, pode terminar além dos 7 pontos nominais (9-7, 11-9, 13-11, etc.). O sup entre parênteses exibido no placar do set passava o <b>menor</b> dos dois números do TB — se o TB terminava 9-7, aparecia <code>(7)</code>, fazendo parecer que o vencedor marcou só 7 pontos e mascarando a extensão do TB. Agora o sup mostra o <b>placar real do vencedor do tie-break</b> (o maior dos dois números): 9-7 vira <code>(9)</code>, 11-9 vira <code>(11)</code>, 7-5 vira <code>(7)</code>, etc. Alterado em quatro pontos de renderização: resumo textual ao salvar o resultado casual, string de <code>scoreSummary</code> persistida por partida, sup na tela de Estatísticas Detalhadas, e sup no card de partida do bracket de torneios. Isso corresponde ao que o usuário efetivamente viu na quadra e torna imediata a leitura de TBs prolongados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.34-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida Casual — toggle "AD" agora é respeitado de verdade (migração remove chave legada)</b> — Correção do bug que deixava a vantagem no game (AD) sendo aplicada mesmo quando o usuário desligava o toggle em Beach Tennis. Causa raiz: a migração de <code>advantageRule</code> → <code>deuceRule</code> introduzida na v0.12.32 <i>adicionava</i> <code>deuceRule</code> ao objeto salvo em <code>localStorage</code>, mas <i>não removia</i> a chave legada <code>advantageRule</code>. Na inicialização do estado da partida, o fallback <code>sc.deuceRule === true || sc.advantageRule === true</code> fazia o OR com a chave velha — então mesmo após o usuário desligar o toggle (novo <code>deuceRule: false</code>), o <code>advantageRule: true</code> remanescente forçava o modo AD a se reativar. Correção em duas camadas: (1) <code>_getConfig()</code> agora <code>delete stored.advantageRule</code> assim que migra, e reescreve o <code>localStorage</code> imediatamente para que o objeto persistido fique limpo; (2) a inicialização do estado (<code>_startLiveScoring</code>, linha 1885) passou a preferir <code>deuceRule</code> quando definido — só cai no <code>advantageRule</code> quando <code>deuceRule</code> está de fato ausente. Assim tanto jogadores que abriram o painel após a v0.12.32 (e já têm o objeto migrado) quanto os que nunca abriram (e ainda têm só <code>advantageRule</code>) terminam no comportamento correto. Resolve o relato "continua aplica a AD quando está desligado e o jogo é beach tennis".</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.33-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida Casual — AD desligado agora fecha o game no primeiro a 4 pontos (sem vantagem)</b> — Ao desligar o toggle "AD" (vantagem no game, golden point) em modalidades como Beach Tennis, o game não terminava — ficava preso em 40-40 porque a função <code>_checkGameWon</code> continuava exigindo 2 pontos de vantagem mesmo com <code>deuceRule: false</code>. Agora a lógica é explícita: se <code>deuceRule</code> está desligado, o primeiro lado a chegar em 4 pontos vence o game independentemente da diferença — comportamento correto de golden point em tennis-style scoring.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.32-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida Casual — separação clara entre "AD" (game) e "Vantagem de 2 pontos" (set); remoção de Placar Simples e da seção Tipo de Placar</b> — Limpeza e precisão no painel de configuração da Partida Casual. (1) <b>Removido "Placar Simples"</b>: a modalidade <code>_simple</code> saiu da lista de esportes — não era uma modalidade, era um modo de placar disfarçado. (2) <b>Removida a seção "Tipo de Placar" (Simples × Game Set Match)</b>: a escolha era redundante, já que o modo "simples" não existia como modalidade de verdade e todo jogo casual agora usa o modelo Game-Set-Match. (3) <b>Novo toggle "AD" logo abaixo da Contagem (15-30-40 / 1-2-3)</b>: representa a <i>regra de deuce no game</i> — ao empatar em 40-40, exige 2 pontos de vantagem (AD → jogo) em vez de ponto de ouro. Padrão por modalidade: Beach Tennis <b>desligado</b> (golden point), Pickleball <b>desligado</b>, Tênis <b>ligado</b>, Tênis de Mesa <b>desligado</b>, Padel <b>ligado</b>. (4) <b>Toggle "Vantagem de 2 pontos" agora é claramente set-level</b>: não se confunde mais com o AD do game. Ligado (padrão em todas as modalidades), o set não acaba em 5-6 — prorroga para 7 (extend) ou decide em tie-break, perguntando a cada novo empate que impossibilite a vantagem de 2 games. Desligado, o set termina no primeiro a chegar em g games, sem extensão e sem tie-break. O toggle de Tie-break só aparece quando a vantagem de 2 pontos está ligada (caso contrário não tem efeito). (5) Internamente: <code>advantageRule</code> foi renomeado para <code>deuceRule</code> no estado, com shim de migração que lê valores antigos de <code>localStorage</code> e de torneios salvos. <code>twoPointAdvantage</code> é novo, default <code>true</code>, e gate o <code>_checkSetWon</code> para terminar sets cedo quando desligado. GSM de torneios permanece inalterado — a mudança é só do painel casual.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.31-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas — TB Perdidos agora mostra o placar do adversário (não o seu)</b> — Correção semântica nas linhas "TB Perdidos" e "Pontos TB Médios (lado perdidos)". Antes, quando um TB era perdido, o app mostrava o placar que <i>você</i> tinha feito naquele TB (sempre o menor dos dois números, já que quem perdeu tem menos pontos). Isso era informativo mas não casava com a simetria desejada: "TB Vencidos mín/máx" = os seus pontos, "TB Perdidos mín/máx" = os pontos do <i>adversário</i>. Agora a regra é uniforme: cada linha mostra o <b>placar do vencedor</b> daquele TB. À direita (vencidos, verde) = os seus pontos quando venceu. À esquerda (perdidos, vermelho) = os pontos do adversário quando venceu contra você. Assim o <b>máximo</b> dos TB Perdidos vira a "maior surra que tomou" (maior placar do adversário), o <b>mínimo</b> vira a "derrota mais apertada" (menor placar do adversário, geralmente 7), e a média do lado perdidos do bloco "Pontos TB Médios" vira a média dos placares vencedores contra você. A seção de agregação em <code>_aggregate</code> passou a registrar <code>_oppPts</code> em vez de <code>_myPts</code> nos três trackers de TB perdidos (<code>tbLostPointsSum</code>, <code>tbLostMax</code>, <code>tbLostMin</code>), então os valores recalculam automaticamente com os dados históricos já salvos. Manual também atualizado para descrever cada métrica com a nova leitura.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.30-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Dicas contextuais nas Estatísticas, Voltar fixo no manual e manual atualizado</b> — Três ajustes focados em descoberta e navegação: (1) <b>Dicas na tela de Estatísticas Detalhadas</b>: criado o contexto <code>player-stats</code> no sistema de hints com nove dicas específicas (Voltar, avatar, barras divergentes, linhas de tiebreak, barras casuais vs torneios, Top 3 Parceiros/Adversários, Torneios Disputados). Diferente dos outros overlays que bloqueiam dicas globais, o <code>player-stats</code> permite que as dicas do menu (topbar) continuem aparecendo junto com as dicas da tela — como o overlay das estatísticas fica abaixo da topbar (<code>z-index: 90</code> vs 100), o menu segue interativo e merece sua própria orientação visual. Dicas da dashboard foram removidas enquanto o modal está aberto, exatamente como pedido. (2) <b>Botão Voltar fixo no topo do manual</b>: a Central de Ajuda ganhou o mesmo padrão das sub-views (<code>position: sticky</code> no cabeçalho do modal): pill "← Voltar" à esquerda com ícone SVG, título centralizado e × à direita, com a barra de busca logo abaixo. Tudo permanece visível ao rolar pelo conteúdo das 20+ seções. (3) <b>Manual atualizado</b>: a seção "Partida Casual" ganhou menção explícita da <i>vantagem de 2 pontos ligada por padrão</i> (v0.12.29) e do <i>glow pulsante no botão de tie-break durante prorrogação</i> (v0.12.26). A seção "Estatísticas Detalhadas" foi reescrita para refletir a nova ordem das barras (1-5 são V/D/Sets/Games/Pontos/Tiebreaks, 6-8 são Pontos TB Médios/TB Vencidos mín-máx/TB Perdidos mín-máx, todas logo após Tiebreaks), com explicação de cores e do bloco Top 3 Adversários / Parceiros. Botão de Voltar do modal de estatísticas agora aparece documentado como "fixo no topo, sempre visível durante o scroll".</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.29-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Pacote com quatro ajustes pedidos: tiebreaks detalhados, Voltar fixo, Explorar agrupado por data e vantagem de 2 pontos por padrão</b> — (1) <b>Estatísticas Detalhadas — três novas linhas de tiebreak mais informativas</b>: as três últimas linhas da seção "📊 Estatísticas Detalhadas" (antes "TB Média", "TB Máximo", "TB Mínimo", todas barras casuais ⇄ torneios) foram substituídas por três linhas divergentes que separam os tiebreaks ganhos dos perdidos: <i>"Pontos TB Médios"</i> (média de pontos que o jogador fez em TBs perdidos à esquerda em vermelho · média em TBs vencidos à direita em verde, ícones ⚡ casuais e 🏆 torneios nas extremidades), <i>"TB Vencidos"</i> (mínimo e máximo de pontos que o jogador marcou dentro de um único TB vencido — ambos os lados em verde, refletindo que os dois valores vêm do mesmo grupo semântico) e <i>"TB Perdidos"</i> (mínimo e máximo em um único TB perdido — ambos em vermelho). A seção inteira só aparece se pelo menos um tiebreak já foi jogado. Internamente, <code>_aggregate</code> passou a trackear <code>tbWonPointsSum</code>/<code>tbLostPointsSum</code>, <code>tbWonMin</code>/<code>tbWonMax</code> e <code>tbLostMin</code>/<code>tbLostMax</code>, e <code>_diffBarRow</code> recebeu parâmetro opcional <code>opts.leftClr</code>/<code>opts.rightClr</code> para renderizar barras com mesma cor nos dois lados quando a semântica é "range dentro do mesmo grupo" em vez de vitória×derrota. (2) <b>Estatísticas Detalhadas — botão "← Voltar" agora fica fixo no topo</b>: antes o botão Voltar do v0.12.28 era parte do corpo do modal e desaparecia ao rolar para ver as estatísticas de tiebreak ou os Top 3. Agora a barra superior (Voltar à esquerda, × à direita) usa <code>position: sticky; top: 0</code> dentro do container de scroll do overlay, com margens negativas para estender flush até as bordas arredondadas do modal e <code>backdrop-filter: blur(12px)</code> para manter legibilidade quando o conteúdo desliza por trás. Mesma promessa do <code>.sticky-back-header</code> das outras sub-views do app: o Voltar está sempre visível, não importa o quanto rolou. (3) <b>Explorar — cards agrupados por data</b>: na lista "Outros usuários" da tela Explorar, quando o modo de ordenação é Data (padrão), as pessoas encontradas em torneios ou com última atividade recente agora aparecem agrupadas por dia. Cada grupo tem um cabeçalho com emoji 📅 e a data legível (ex: "15 abr, 2026") seguido pelo grid de cards daquele dia. Sem data registrada? Vai para um bucket final "Sem encontros registrados". A data foi removida da parte inferior de cada card individual já que agora está centralizada no cabeçalho do grupo, deixando os cards mais limpos. No modo alfabético, os cards seguem num grid único sem grupos, como antes. (4) <b>Nomes longos quebram em duas linhas nos cards de Explorar</b>: o <code>text-overflow: ellipsis</code> dos nomes e chips foi substituído por <code>-webkit-line-clamp: 2</code> com <code>word-break: break-word</code> — nomes compostos ou com sobrenome longo agora quebram naturalmente em duas linhas antes de serem truncados, melhorando a legibilidade sem alargar os cards. Aplicado tanto em <code>_userCardWithEncounterHtml</code> (resultados principais) quanto em <code>_userCardHtml</code> (convites enviados). (5) <b>Partida Casual — vantagem de 2 pontos ligada por padrão</b>: o toggle "Regra de vantagem" do painel de configuração de Partida Casual agora vem ativado por padrão em todas as modalidades (Beach Tennis, Pickleball, Tênis de Mesa e Padel — Tênis já vinha ligado). A regra "ao empatar em 40-40, exige 2 pontos de vantagem" espelha melhor o que acontece em quadra, então faz mais sentido ser o default e o usuário desativar se quiser jogar sem advantage. Preferências salvas em <code>scoreplace_casual_prefs</code> continuam respeitadas — a mudança afeta apenas novos usuários ou quem ainda não personalizou a config.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.28-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botão "Voltar" na tela de Estatísticas Detalhadas</b> — O modal de estatísticas ganhou uma barra superior com botão pill "← Voltar" à esquerda (mesmo padrão visual do Gerenciador de Categorias e demais sub-views: ícone SVG de seta + texto, borda e fundo via variáveis de tema, hover-lift). O × de fechar continua à direita, então o usuário tem dois caminhos redundantes para sair — clicar fora do modal, apertar ESC, usar o × ou o novo "Voltar".</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.27-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas Detalhadas: menu visível, tema aplicado, contraste melhorado e listas enxutas</b> — A tela de "📊 Estatísticas Detalhadas" (modal aberto ao clicar no nome do jogador) recebeu quatro ajustes pedidos: (1) <b>Menu do app agora permanece visível</b> — o overlay deixou de cobrir a topbar (começa em <code>top: 60px</code> com <code>z-index: 90</code>, abaixo da topbar que é 100), assim o usuário pode navegar para outra seção a qualquer momento sem precisar fechar o modal primeiro. (2) <b>Tema escolhido é aplicado na tela</b> — fundos, bordas e tracks de barras usam agora variáveis CSS (<code>--bg-card</code>, <code>--info-box-bg</code>, <code>--stat-box-bg</code>, <code>--border-color</code>, <code>--info-pill-bg</code>) em vez de <code>rgba(255,255,255,0.xx)</code> hardcoded; em modos Claro/Pôr do Sol/Oceano as caixas e barras ganham o tom correto do tema em vez de sumirem por baixa opacidade. (3) <b>Cores de texto com contraste adequado</b> — títulos "Top 3 Parceiros/Adversários" trocaram o cinza sobre escuro pelo <code>--text-bright</code>, nomes dos jogadores nas listas usam <code>--text-main</code>, e V/D/aproveitamento usam <code>--success-color</code> / <code>--danger-color</code> (tons adaptativos por tema) em vez de #22c55e/#ef4444 fixos, garantindo legibilidade no tema Claro. (4) <b>Top 5 virou Top 3</b> — as quatro listas (Parceiros Casuais, Adversários Casuais, Parceiros Torneios, Adversários Torneios) agora mostram apenas os 3 primeiros colocados ordenados por partidas disputadas, deixando a tela mais compacta e o "top" realmente entre os mais relevantes.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.26-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas suplementares viraram barras comparativas casuais ⇄ torneios</b> — As 14 métricas de valor único da seção "📊 Estatísticas Detalhadas" (Aproveitamento, % Saque, % Recepção, Games Mantidos, Quebras, Maior Seq. de Pontos, Maior Seq. de Vitórias, Tempo Total, Média por Ponto, Ponto Mais Longo, Ponto Mais Curto, TB Média, TB Máximo e TB Mínimo) deixaram de aparecer como grade de caixinhas compactas e agora seguem o mesmo padrão de barras divergentes das métricas pareadas acima. Cada métrica ocupa uma linha: no cabeçalho, rótulo azul-claro "CASUAIS" à esquerda, nome da métrica centralizado, rótulo azul-escuro "TORNEIOS" à direita; na linha de valores, o ícone ⚡ e o número das partidas casuais ficam colados na borda esquerda da tela, o número e o ícone 🏆 de torneios ficam colados na borda direita; entre eles, duas barras partem do centro e crescem para fora, escaladas proporcionalmente ao maior dos dois valores. <b>Cores unificadas com os botões da dashboard</b> — o azul-claro <code>#38bdf8</code> (idêntico ao gradiente do botão "Partida Casual") é usado em todas as barras e números de casuais; o azul-escuro <code>#1e40af</code> (idêntico ao botão "+Novo Torneio") é usado no lado de torneios. Agora toda a seção tem leitura visual consistente: basta correr o olho pela coluna esquerda para ver o perfil em partidas casuais e pela direita para ver o perfil em torneios, sem precisar comparar caixinha por caixinha.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.25-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Barras divergentes: ícone casual ⚡, rótulos no lugar dos "V/P" e grupos afastados às extremidades</b> — Três ajustes pedidos na seção "📊 Estatísticas Detalhadas" após o redesign do v0.12.24: (1) <b>Ícone de partidas casuais unificado com o botão da dashboard</b> — era 📡 (antena), agora é ⚡ (raio), o mesmo símbolo do botão "Partida Casual" da tela inicial. Aplicado no badge da seção, nos cabeçalhos das barras divergentes, nas caixas de estatísticas duplas e nos títulos "Top 5 Parceiros/Adversários — Casuais". (2) <b>"V/P" removido dos rótulos</b> — antes cada barra trazia "Sets V/P", "Games V/P" etc.; agora o nome da métrica aparece sozinho no centro do cabeçalho ("Sets", "Games", "Pontos", "Tiebreaks") e a palavra "perdidos" (vermelho, à esquerda) e "vencidos" (verde, à direita) substituem a abreviação nos lados. A primeira barra, que <i>é</i> o próprio par vitórias/derrotas, ganhou rótulos "Derrotas" à esquerda e "Vitórias" à direita (sem métrica central). (3) <b>Ícones e números empurrados para as extremidades</b> — antes o par 🏆+⚡ ficava centralizado perto do divisor central; agora cada grupo encosta na borda externa da sua metade (⚡🏆 grudados à direita do lado verde, 🏆⚡ grudados à esquerda do lado vermelho), deixando o meio da linha livre para as barras divergentes e criando simetria visual clara entre os dois lados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.24-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas Detalhadas redesenhadas como barras divergentes</b> — A seção "📊 Estatísticas Detalhadas" do perfil do jogador deixou de ser duas grades separadas (uma para Casuais e outra para Torneios, cada uma com 18 caixinhas) e virou uma única visão unificada, mais parecida com o gráfico de "Comparação dos Times" ao final de partida casual. As métricas pareadas (Vitórias/Derrotas, Sets V/P, Games V/P, Pontos V/P, Tiebreaks V/P) aparecem como linhas horizontais com rótulo centralizado no topo, ícones e números espelhados dos dois lados (📡 casuais e 🏆 torneios), e barras coloridas que divergem do centro — verde para a direita (vitórias) e vermelho para a esquerda (derrotas), proporcionais ao total. As métricas de valor único (Aproveitamento, % Saque, % Recepção, Games Mantidos, Quebras, Maiores Sequências, Tempos, TB Média/Máx/Mín) virão abaixo, num grid responsivo de caixas compactas onde cada caixa mostra o valor de casuais e de torneios lado a lado, separados por um divisor sutil. Top 5 Parceiros e Top 5 Adversários permanecem separados por origem (casuais 📡 e torneios 🏆) já que as listas diferem entre os dois contextos. Mesma informação, apresentação mais comparável e ocupando menos rolagem vertical.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.23-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida casual: "Parceiro"/"Adversário" por perspectiva agora sobrevive ao sync remoto</b> — O fix do v0.12.21 fazia o remap de rótulos uma vez na abertura da tela ao vivo, mas o snapshot listener do Firestore sobrescrevia <code>p1Players</code>/<code>p2Players</code> com a versão do host a cada atualização (ponto marcado, troca de saque, etc.), voltando "Parceiro" para todos. Ou seja: por meio segundo Kelly e Nelson viam "Adversário 2", então o host pontuava, o Firestore propagava, e eles voltavam a ver "Parceiro" — o oposto do que se esperava. Correção: (1) <code>_localizeRoleLabels</code> deixou de ser IIFE e virou função nomeada que muta <code>p1Players</code>/<code>p2Players</code> in-place; (2) os dois handlers de <code>remote.p1Players</code>/<code>p2Players</code> (o listener em tempo real da partida casual e o <code>_applyRemoteState</code> do modo multi-device) agora chamam <code>_localizeRoleLabels()</code> imediatamente após copiar os nomes remotos, antes do <code>_render</code>. A lógica é idempotente: cada cliente sempre converge para ver "Parceiro" apenas nos slots do seu próprio time e "Adversário N" nos slots do time oposto, independente de qual cliente escreveu por último no Firestore.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.22-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Safari/iOS: fim do flicker entre lobby e tela de login + ícone do tema atualiza no menu hambúrguer</b> — Duas correções distintas: (1) <b>Lobby de partida casual parava de piscar no Safari</b>. O v0.12.20 já esperava o Firebase Auth rehidratar antes de renderizar, mas em alguns iPhones o <code>onAuthStateChanged</code> continuava emitindo eventos <i>transientes</i> com <code>user=null</code> (típico de ITP/cookies de terceiros), o que limpava o <code>scoreplace_authCache</code>, zerava <code>AppStore.currentUser</code>, disparava <code>_softRefreshView()</code> → re-roteava → renderizava a tela de login. Segundos depois o auth voltava com o usuário, outra refresh, de volta ao lobby. O usuário via lobby → login → lobby → login. Correções: (a) o handler de null em <code>onAuthStateChanged</code> agora <b>espera 2,5s</b> antes de comprometer o logout — se o auth reaparecer com um usuário nesse intervalo, o logout é <i>cancelado silenciosamente</i>; (b) logout manual (botão "Sair") bypassa esse grace via flag <code>_manualLogoutInProgress</code>, então quem clica em Sair vai embora na hora; (c) <code>_renderCasualJoin</code> agora faz fallback ao <code>scoreplace_authCache</code> quando <code>currentUser</code> está null temporariamente, mantendo a identidade do viewer estável; (d) a identidade é <i>re-lida</i> em cada render do lobby em vez de capturada em closure, pegando qualquer transição de auth em tempo real. (2) <b>Ícone do tema agora atualiza no menu hambúrguer</b>. O dropdown do hambúrguer <i>clona</i> o botão de tema da topbar, criando dois elementos com o mesmo <code>id="theme-toggle-btn"</code>. <code>getElementById</code> devolve só o primeiro, então o ícone do clone ficava preso no tema antigo mesmo após o clique. Agora <code>_applyThemeIcon</code> usa <code>querySelectorAll</code> e atualiza todas as cópias vivas.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.21-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida casual: Duplas Mistas automáticas e rótulos "Parceiro/Adversário" por perspectiva</b> — Duas melhorias que trabalham juntas na configuração de Partida Casual em duplas: (1) <b>Toggle "Duplas mistas"</b> — quando o sistema detecta 2 homens + 2 mulheres no lobby (via campo <code>gender</code> do perfil dos 4 jogadores), aparece um novo toggle rosa abaixo de "Sortear Duplas", ligado por padrão. Com ele ativo, o shuffle ao iniciar garante que cada time tenha exatamente 1 homem + 1 mulher, com o usuário logado sempre na Team 1. Gêneros faltantes são buscados do Firestore (<code>FirestoreDB.loadUserProfile</code>) assim que alguém entra no lobby. (2) <b>Rótulos por perspectiva</b> — antes, o slot sem nome do time do usuário era salvo globalmente como "Parceiro" e todos os clientes viam o mesmo rótulo; mas "Parceiro" só faz sentido para quem está no <i>mesmo</i> time. Agora a tela ao vivo remapeia os rótulos localmente com base em quem está olhando: a mesma pessoa anônima é "Parceiro" para o viewer do seu próprio time e "Adversário N" para o viewer do time oposto, numerada pela posição na equipe dele. Nomes reais (quem já entrou na sala com conta) passam intactos — só slots genéricos são remapeados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.20-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Convite de partida casual não pede login desnecessário no Safari/iOS</b> — Quando um usuário já logado abria um link <code>#casual/CODE</code> (ex: via QR code escaneado no Safari), a tela de lobby decidia "logado ou não" lendo <code>AppStore.currentUser</code> de forma <i>síncrona</i> no carregamento da página. Mas o Firebase Auth no Safari/iOS precisa de algumas centenas de ms para rehidratar a sessão do IndexedDB — nesse intervalo, <code>currentUser</code> ainda é <code>null</code> e o usuário caía na tela "Entre para entrar na sala". Se ele escolhia Google, o OAuth pedia senha + 2FA de novo. Agora <code>_renderCasualJoin</code> detecta a presença do <code>scoreplace_authCache</code> no localStorage e espera pela flag <code>_authStateResolved</code> (polling de 200ms, timeout de 6s) antes de renderizar, exibindo apenas o spinner de "carregando". Quem realmente não tem conta/cache passa direto para a tela de login como antes.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.19-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida casual: nomenclatura de times corrigida</b> — No início de uma Partida Casual em duplas, os rótulos automáticos estavam trocando de lado. O usuário logado às vezes acabava como "Adversário" na equipe vermelha, e a equipe azul ficava com dois "Parceiro". Causa: <code>var cu</code> estava declarado depois do uso (hoisting deixava ele <code>undefined</code>), então o swap "usuário sempre na Team 1" nunca rodava, e o rename nomeava <b>todos</b> os slots sem nome da Team 1 como "Parceiro". Agora: (1) <code>cu</code> é lido antes do shuffle, garantindo que o usuário logado seja movido para a Team 1 se acabar sorteado na Team 2; (2) o usuário <b>nunca</b> é renomeado para "Parceiro" — ele mantém o primeiro nome do perfil; (3) apenas um slot da Team 1 vira "Parceiro" (o parceiro de verdade); (4) adversários são numerados pela posição dentro da Team 2 ("Adversário 1" + "Adversário 2"), não mais por índice absoluto. Vale tanto no modo Sortear ON quanto OFF.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.18-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Explorar reestruturado: busca ao vivo, seções de amigos/convites unificadas, ordenação dos outros usuários</b> — A página Explorar ganhou quatro melhorias que trabalham juntas: (1) <b>Busca ao vivo</b> — o input filtra a lista à medida que você digita (debounce de 250ms), sem precisar clicar em Buscar. Enter ainda dispara imediatamente. (2) <b>Seções reorganizadas</b> em 4 blocos lógicos: <i>Convites Recebidos</i> (pessoas que te convidaram — precisam da sua resposta), <i>Meus Amigos</i> (amizades confirmadas), <i>Convites Pendentes</i> (pessoas que você convidou e ainda não responderam), e <i>Outros Usuários</i> (todos os demais). (3) <b>Unificação de Conhecidos e Outros</b> — a seção antes separada de Conhecidos foi fundida em Outros Usuários. Usuários com os quais você compartilhou torneios mantêm o destaque âmbar (borda + badge "N torneio(s) em comum" e data do encontro mais recente). (4) <b>Ordenação por setas de direção</b> — duas pílulas-toggle (<code>📅 Data</code> e <code>A–Z</code>) no cabeçalho de Outros Usuários, alinhadas à direita na mesma linha do título. Clicar na pílula ativa inverte a direção (↑/↓), clicar na inativa ativa com direção natural. Padrão: data decrescente (encontro mais recente primeiro). Botão Buscar enxuto (<code>btn-outline btn-sm</code>).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.17-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Explorar: botão Buscar compacto e ordenação de Conhecidos com setas de direção</b> — Na página Explorar, o botão "Buscar" foi enxugado para <code>btn-outline btn-sm</code> (largura natural com borda, não mais bloco azul full-width ao lado do input). A seção <b>Conhecidos</b> (pessoas encontradas em torneios compartilhados) agora mostra os encontros mais recentes no topo por padrão. As três pílulas antigas de ordenação (Recentes/Antigos/A–Z) foram substituídas por <b>duas pílulas-toggle com setas de direção</b>: <code>📅 Data</code> e <code>A–Z</code>. Clicar em uma pílula ativa ou inverte sua direção — ↓ para decrescente (mais recente primeiro, ou Z→A), ↑ para crescente (mais antigo primeiro, ou A→Z). A pílula inativa mostra ⇅ indicando que pode ser usada. Os modos internos viraram <code>date-desc</code>, <code>date-asc</code>, <code>alpha-asc</code>, <code>alpha-desc</code>, com compat reversa dos rótulos legados recent/oldest/alpha.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.16-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Tela de resultado simplificada: confirmação implícita ao Jogar Novamente ou Fechar</b> — Na tela de resultado da partida casual, o botão verde "✅ Confirmar Resultado" foi removido. O botão de recomeçar agora aparece em verde com o rótulo "🔄 Jogar Novamente" (sozinho no singles, ou lado-a-lado com o toggle "Re-sortear duplas" no doubles). Tanto o clique em <b>Jogar Novamente</b> quanto em <b>✕ Fechar</b> passam a tratar o resultado como confirmado — ambos persistem o registro da partida (localStorage v2 + Firestore + matchHistory por jogador) antes de recomeçar ou encerrar. Refatoração: <code>_saveResult()</code> aceita <code>{keepOpen, silent}</code> e usa guarda <code>_resultSaved</code> para ser idempotente — impede gravações duplicadas mesmo se o usuário clicar rapidamente em múltiplos caminhos de saída. Diálogos de confirmação agora informam explicitamente que "O resultado será salvo como confirmado".</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.15-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas de Tie-break no modal do jogador</b> — A grade de estatísticas detalhadas (Partidas Casuais e Torneios) ganhou uma sexta linha com 4 métricas dedicadas a tie-breaks: <b>TB V/P</b> (tiebreaks vencidos/perdidos), <b>TB Média</b> (média de pontos do jogador por tiebreak), <b>TB Máx</b> (máximo de pontos feitos em um TB) e <b>TB Mín</b> (mínimo de pontos feitos em um TB). Agregação itera cada <code>r.sets[].tiebreak</code> do histórico persistente (aceita ambos os schemas <code>{p1,p2}</code> e <code>{pointsP1,pointsP2}</code>), identifica o lado do jogador via <code>myTeam</code> e acumula vitórias/derrotas, soma e extremos dos pontos do jogador. Quando não há tiebreaks registrados, os cards exibem "—" mas continuam visíveis para sinalizar o que é rastreável.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.14-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida Casual: Sortear Duplas auto-dirigido + toggle Misto removido</b> — O toggle "Sortear Duplas" no setup da partida casual agora reflete automaticamente o estado de formação de duplas: começa <b>ON</b> por padrão (sem times formados), passa para <b>OFF</b> assim que o organizador pareia dois jogadores via drag-and-drop (ícone de corrente), e volta para <b>ON</b> quando a dupla é desfeita. Se um participante sai da sala e os cards precisam ser rearranjados, o toggle também volta para ON. Os cards agora são arrastáveis o tempo todo (antes só eram quando Sortear estava OFF) — o organizador pode formar times com o toggle ON e ele é automaticamente desligado. Toggle <b>Misto</b> removido completamente (era puramente cosmético — não tinha efeito em nenhuma parte do fluxo de sorteio/start).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.13-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Convidado da partida casual agora sai de verdade ao clicar "Sair"</b> — Antes, o jogador clicava Sair, via a dashboard por uma fração de segundo e era arremessado de volta ao lobby, ficando preso até o organizador cancelar a sala. A causa: o polling do lobby (<code>setInterval</code> a cada 3s) tinha um <code>if (_hasLeft) return;</code> só no topo do callback, mas o <code>await FirestoreDB.loadCasualMatch()</code> que vinha em seguida já estava em voo quando o usuário clicava em Sair. Quando o await resolvia, o callback continuava, chamava <code>_renderLobby()</code> e sobrescrevia o HTML da dashboard com o lobby. Adicionadas duas guardas adicionais: uma logo após o <code>await</code> e outra dentro do próprio <code>_renderLobby()</code>, para impedir qualquer renderização após a saída. Isso também protege contra outras in-flights (ex: <code>_autoJoin</code>).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.12-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Convidado da partida casual volta à dashboard ao sair ou quando o criador cancela + ícone ⚡ padronizado</b> — Antes, quando o convidado clicava em "Sair" no lobby (ou quando o criador clicava "✕ Fechar" e a sala era deletada), o app fazia apenas <code>window.location.hash = "#dashboard"</code>. Em navegadores embutidos (scanner de QR do iOS, webview do WhatsApp) o evento <code>hashchange</code> é engolido e o convidado ficava preso na tela do lobby indefinidamente. Agora um helper <code>_evacuateToDashboard</code> faz dupla evacuação: limpa o <code>container</code> e chama <code>renderDashboard</code> diretamente <b>e</b> seta o hash, garantindo atualização de UI mesmo sem <code>hashchange</code>. Ao sair, o <code>sessionStorage._pendingCasualRoom</code> também é limpo para evitar auto-rejoin. Os três caminhos de saída (botão "Sair" logado, "Voltar ao Dashboard" não-logado, detecção de cancelamento pelo polling) usam o novo helper. Ícones do lobby e do cabeçalho da partida casual trocados de 📡 para ⚡ para casar com o botão "Partida Casual" da dashboard.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.11-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Top 5 Parceiros/Adversários ignora nomes genéricos de slot vazio</b> — Quando o organizador iniciava uma partida casual sem renomear os cards "Jogador 2", "Jogador 3", "Jogador 4" (ou quando o nome gravado era "Parceiro", "Adversário 1", "Adversário 2" etc.), esses rótulos apareciam no ranking de parceiros e adversários do modal de estatísticas, poluindo a lista com entradas sem jogador real. Agora <code>_computeH2hAndPartners</code> filtra por uma regex de nomes placeholder (<code>jogador|player|parceiro|partner|oponente|opponent|adversário|adversario</code> sozinho ou seguido de número) quando o participante não tem <code>uid</code> — jogadores reais identificados por uid continuam sendo contabilizados mesmo que o nome coincida.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.10-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Dashboard: botões "Novo Torneio" e "Partida Casual" lado a lado + botão "Iniciar" no topo do setup casual</b> — Na hero box da dashboard, os dois botões principais agora ficam na mesma linha, com tamanhos iguais (altura 64px, fonte 0.95rem), ícones atualizados (🏆 para Novo Torneio, ⚡ para Partida Casual) e layout compacto sem quebra em telas estreitas (<code>flex-wrap:nowrap</code>). Na tela de setup de partida casual, o botão "Iniciar Partida" que ocupava a base da tela foi substituído por um botão verde "Iniciar" (<code>linear-gradient(135deg,#10b981,#059669)</code>) fixo no cabeçalho, ao lado do "✕ Fechar" — fica sempre visível sem precisar rolar pelo QR code, código de sala e campo de convite.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas do jogador sempre mostram o grid completo de métricas</b> — Antes, quando o jogador tinha só 1 partida casual salva no cache legado <code>scoreplace_casual_history</code> (ou quando o <code>_buildAndPersistMatchRecord</code> fazia early-return por ausência de <code>FirestoreDB.saveUserMatchRecords</code>), o modal exibia apenas Vitórias / Derrotas / Aproveitamento. Agora o grid completo é sempre renderizado — Sets V/P, Games V/P, Pontos V/P, % Saque, % Recep., Games Mantidos, Quebras, Maior Seq. Pontos/Vitórias, Tempo total/médio/mais longo/mais curto — mesmo que zerados, para mostrar ao jogador o que é rastreável e incentivá-lo a jogar mais partidas no app. Correção: <code>_buildAndPersistMatchRecord</code> não faz mais early-return; o cache <code>scoreplace_casual_history_v2</code> agora é sempre gravado, mesmo quando a escrita no Firestore falha (offline, sem permissão, uid ausente). Fluxo unificado: <code>_showPlayerStats</code> sempre usa <code>_renderPersistentMatchStats</code> como renderer primário, seedando com registros locais v2 para render inicial instantâneo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.8-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login com Google: popup em todas as plataformas (incluindo iOS)</b> — Antes o iOS e o Safari eram forçados a usar <code>signInWithRedirect</code>, mas o redirect cross-origin falha no iOS moderno por causa do ITP (cookies de terceiros em <code>firebaseapp.com</code> são bloqueados e o <code>getRedirectResult</code> retorna <code>null</code>). Agora todas as plataformas tentam <code>signInWithPopup</code> primeiro — o iOS Safari 16+ suporta popup com <code>postMessage</code> sem depender de cookies cross-origin. Se o popup for bloqueado (código <code>auth/popup-blocked</code> ou similar), o handler de erro faz fallback para <code>signInWithRedirect</code> automaticamente. Log do userAgent adicionado para diagnóstico.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.7-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login com Google no celular (iOS/Safari) volta a funcionar</b> — No desktop o v0.12.6 resolveu o login via popup, mas no celular (iOS Safari e iOS Chrome, que também usa WebKit) o fluxo usa <code>signInWithRedirect</code> por causa do ITP da Apple. O handler <code>getRedirectResult</code> que recebe o usuário após o redirect também dependia exclusivamente do <code>onAuthStateChanged</code> — que pode não disparar no iOS com cookies 3rd-party bloqueados contra o <code>authDomain</code> cross-origin. Agora o próprio <code>getRedirectResult</code> chama <code>simulateLoginSuccess</code> diretamente e grava o <code>scoreplace_authCache</code>, com o mesmo guard contra execução dupla.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.6-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login com Google — aciona a dashboard diretamente do popup</b> — Antes o fluxo dependia exclusivamente do <code>onAuthStateChanged</code> do Firebase Auth para completar o login após o popup. Com a depreciação de cookies de terceiros no Chrome e o <code>authDomain</code> cross-origin (<code>firebaseapp.com</code>), esse callback pode não disparar de forma confiável, deixando o usuário preso na landing mesmo após o popup fechar com sucesso. Agora o sucesso do popup já executa <code>simulateLoginSuccess</code> diretamente (com proteção contra execução dupla via <code>_simulateLoginInProgress</code>) e gravação síncrona do <code>scoreplace_authCache</code>. Adicionados logs de diagnóstico (prefixo <code>[scoreplace-auth]</code> / <code>[scoreplace-router]</code>) no console para rastrear cada etapa.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login com Google volta a funcionar</b> — Removidos os escopos sensíveis do OAuth do Google (<code>user.gender.read</code>, <code>user.birthday.read</code>, <code>user.addresses.read</code>, <code>user.phonenumbers.read</code>) que exigem verificação formal do app pelo Google. Sem essa verificação, o Google mostrava uma tela de alerta "app não verificado" que interrompia silenciosamente o login para muitos usuários — o popup fechava, parecia que ia logar e voltava à landing. Agora o provider Google usa apenas escopos padrão (profile, email) e o fluxo de login volta a funcionar normalmente. Gênero, data de nascimento, endereço e telefone podem ser preenchidos manualmente no perfil.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.4-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Notificações por e-mail com o conteúdo real + toggle de volta no perfil</b> — O toggle "E-mail" voltou à seção "Canais de notificação" do perfil (ao lado de "Plataforma"), permitindo ligar/desligar o envio de e-mails independentemente das notificações dentro do app. Além disso, os e-mails foram reescritos: o corpo do e-mail agora carrega a <i>mensagem real</i> da notificação (ex.: "O resultado do seu jogo foi registrado: Ana 6-4 6-3 Beto") em vez de um genérico "você tem uma nova notificação no app". Cabeçalho e ícone mudam conforme o tipo (resultado, chaveamento, comunicado, convite de co-organização, etc.), partidas exibem um placar formatado, atualizações listam as alterações e torneios encerrados mostram o campeão. O botão "Ver no scoreplace.app" continua ao final para quem quiser abrir o app.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.3-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Versão do app na landing page + correção do retorno à landing após login</b> — A landing page (visitante não logado) agora exibe a versão atual (<code>vX.Y.Z-alpha</code>) logo abaixo do nome "scoreplace.app", tornando mais fácil identificar a build em uso sem precisar logar. Também corrigido: após login (Google, e-mail, etc.), se qualquer operação assíncrona de pós-login falhasse (ex.: regra do Firestore bloqueando uma leitura) a chamada final ao <code>initRouter()</code> era pulada e o usuário voltava a ver a landing. Agora o modal de login é fechado e o router é reexecutado imediatamente após setar <code>AppStore.currentUser</code>, dentro de um <code>try/catch</code> — a dashboard passa a renderizar antes mesmo de qualquer carga de perfil.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.2-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botão "Login" no menu hambúrguer voltou a funcionar</b> — O menu mobile clona o conteúdo da topbar via <code>cloneNode(true)</code>, mas listeners registrados por <code>addEventListener</code> não sobrevivem à clonagem. Mudamos o botão <code>#btn-login</code> para usar um <code>onclick</code> inline (fecha o hambúrguer e abre o modal de login com todas as opções: Google, e-mail/senha, link mágico, SMS). Aplicado também ao reset pós-logout e pós-exclusão de conta.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.12.1-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>CTA da landing page agora abre o modal de login completo</b> — O botão verde "Crie seu torneio grátis" (e o "Comece agora — é grátis!" no rodapé) deixaram de disparar o login direto com o Google e agora abrem o modal de login padrão, com todas as opções de autenticação disponíveis (Google, e-mail/senha, link mágico por e-mail, SMS). O visitante pode escolher o método que preferir.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.76-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Campo de e-mail e botão "Enviar" do link mágico redesenhados</b> — Na página de login, o campo de e-mail para envio do link mágico ficou maior (fonte 1rem, padding 12px 14px) e ganhou um placeholder de exemplo ("ex: joao.silva@gmail.com"), tornando-o mais visível e amigável. O botão "Enviar" foi reduzido para caber apenas a palavra com uma borda fina na cor primária (outline transparente 1px, fonte 0.72rem, padding 6px 10px), liberando mais espaço para o campo de e-mail.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.75-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botões principais da partida casual movidos para o topo</b> — "Iniciar Partida" (na tela de ordem de saque) e "Confirmar Resultado" (na tela de fim de partida) agora ficam fixos no topo da página, não mais no rodapé. O conteúdo (cards de saque, estatísticas, gráfico de momentum, comparativos, tempo) passou a rolar abaixo dos botões. O toggle "Re-sortear duplas" continua junto do botão "Jogar Novamente" no cabeçalho fixo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.74-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Notificações por E-mail e WhatsApp removidas do perfil (temporariamente)</b> — Os toggles de canal de notificação por E-mail e WhatsApp foram removidos do formulário de perfil, pois esses canais ainda não estão realmente implementados. O despacho automático para os dois canais também foi desligado (em <code>_sendUserNotification</code>). Quando o backend estiver pronto, reativamos tanto a UI quanto o envio. O canal 🔔 Plataforma (push in-app) permanece ativo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.73-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas detalhadas também para partidas casuais no hero box</b> — Corrigido: o modal de estatísticas do dashboard mostrava apenas Vitórias, Derrotas e % de Aproveitamento para partidas casuais. Agora, toda partida casual encerrada grava também no cache local (<code>scoreplace_casual_history_v2</code>) o mesmo registro completo que é salvo no Firestore — com stats de times, pontos, games, sets, saque/recepção, quebras, tempo por ponto, duração e jogadores. O modal de "Estatísticas" agora combina os registros do Firestore com os do cache local, renderizando a mesma seção ultra-detalhada (🏅 Sets V/P, 🎾 Games V/P, 🎯 Pontos V/P, 🚀 % Saque, 🎯 % Recep., 📊 Games Mantidos, 💥 Quebras, 🔥 Maior Seq. Pontos, 🏆 Maior Seq. Vitórias, ⏱ Tempo total, ⏲ Média/ponto, 📏 Ponto + longo, ⚡ Ponto + curto, 🤝 Top 5 Parceiros, ⚔ Top 5 Adversários) para casuais — não só para torneios.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.72-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas pessoais ultra-detalhadas por categoria</b> — Cada seção (📡 Partidas Casuais e 🏆 Torneios) agora mostra TODOS os metrics pedidos: Vitórias, Derrotas, % de Aproveitamento, 🏅 Sets V/P, 🎾 Games V/P, 🎯 Pontos V/P, 🚀 % Pontos no Saque, 🎯 % Pontos na Recepção, 📊 Games Mantidos (saque), 💥 Quebras de Saque, 🔥 Maior Sequência de Pontos, 🏆 Maior Sequência de Vitórias, ⏱ Tempo total de jogo, ⏲ Tempo médio por ponto, 📏 Ponto mais longo, ⚡ Ponto mais curto, 🤝 Top 5 Parceiros e ⚔ Top 5 Adversários. Os dados são lidos de <code>users/{uid}/matchHistory</code> no Firestore, onde cada partida é gravada automaticamente para cada jogador registrado ao final do jogo — persistem mesmo se o torneio ou a partida casual forem apagados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.71-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas pessoais viraram "Casual vs Torneios" com barras comparativas</b> — O modal do botão "Estatísticas" foi redesenhado para o padrão de comparação lado a lado da tela de fim de partida casual: quem tem histórico nos dois tipos vê agora barras horizontais comparando 📡 Casual (azul, à esquerda) contra 🏆 Torneios (dourado, à direita) em Partidas, Vitórias, Aproveitamento, Sets, Games, Pontos, % Pontos no Saque/Recepção, Games Mantidos, Quebras, Killer Points, Maior Sequência e Maior Vantagem. Quando só há um dos lados, cai num card compacto daquele lado. Funciona tanto com os dados persistentes do Firestore quanto com o fallback do histórico local — o visual é o mesmo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.70-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas do hero box no padrão da partida casual</b> — O modal aberto pelo botão "Estatísticas" do hero box foi totalmente reescrito para usar a mesma linguagem visual da tela de fim de partida casual: duas seções claramente separadas — 📡 <b>Partidas Casuais</b> (ciano) e 🏆 <b>Torneios</b> (dourado) — com cards de Vitórias/Derrotas/Aproveitamento, Sets/Games/Pontos, Saque%/Recepção%/Killer/Quebras, Maior Sequência/Maior Vantagem e Títulos. Quando há histórico detalhado do Firestore, os cards são enriquecidos automaticamente; quando não há, o fallback lê o histórico local das partidas casuais e mostra as duas seções mesmo assim. E para reduzir duplicação, a aba de estatísticas que ficava dentro do perfil foi <b>removida</b> — agora há um único ponto canônico: o botão "Estatísticas" do dashboard.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.69-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas do perfil estruturadas como partida casual</b> — A página de estatísticas dentro do perfil (no hero box do dashboard) foi totalmente reescrita para usar a mesma linguagem visual da tela de fim de partida casual. Agora com duas seções paralelas claramente separadas — 📡 <b>Partidas Casuais</b> e 🏆 <b>Torneios</b> — cada uma com seu próprio badge, cartões de estatísticas (V/D/Aproveit.) e cores. Quando há histórico detalhado (sets, games, saque%, recepção%, killer points, breaks, maior sequência, maior vantagem), os cards são enriquecidos automaticamente. Quem tem ambos os tipos de partida vê a barra comparativa "Casual vs Torneio" e tabelas de confrontos diretos / parcerias logo abaixo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.68-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Desfazer times propaga para todos + fechar encerra para todos</b> — Quando o organizador desfaz os times formados na tela de montagem da partida casual, a mudança agora aparece em tempo real para todos os jogadores no lobby (antes os convidados continuavam vendo "Times Formados" mesmo depois de o organizador quebrar a dupla). E quando o organizador clica em "Fechar" — tanto na tela de montagem quanto durante o placar ao vivo — a partida casual é encerrada para todos: os demais jogadores são automaticamente desconectados e voltam para o dashboard, em vez de ficar presos numa sala fantasma.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.67-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Cards de jogador uniformes + duplas por padrão</b> — Os 4 cards de jogador na montagem da partida casual agora têm altura sempre igual (alinhamento automático à maior), e nomes longos quebram em múltiplas linhas dentro do card em vez de vazar ou serem cortados. Fluxo também ficou mais previsível: ao abrir a partida casual, lembramos o último esporte e modalidade (simples/duplas) escolhidos; usuários sem preferência configurada caem em Beach Tennis (duplas) em vez de Placar Simples — corrige o caso em que alguns usuários viam jogo single sem querer.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.65-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Login no Safari estável + QR de convite para o app</b> — Safari e iOS (incluindo Chrome no iOS, que usa WebKit) agora usam o fluxo <code>signInWithRedirect</code> em vez de popup, fugindo do ITP que derrubava a sessão após leitura do QR code; persistência LOCAL é aplicada explicitamente e <code>getRedirectResult</code> é capturado no carregamento da página, trazendo o usuário de volta logado. Popup-blocked em outros navegadores também cai automaticamente para redirect. Novo botão 📱 "Convidar amigos" no hero box abre um QR code apontando para <code>scoreplace.app</code> (com <code>?ref</code> automático de quem convida) — ideal para passar o link direto para alguém que ainda não está no app.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.64-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Avatares + refresh ao vivo na partida casual</b> — A tela de montagem do organizador agora mostra a foto de perfil e o nome cadastrado de cada jogador que entra na sala, atualizando os cards em tempo real. Quando um jogador sai, seu nome desaparece instantaneamente dos demais, os inputs dos convidados são reabertos e as duplas já formadas são desfeitas — a vaga fica livre para outro jogador ocupar, com aviso ("Fulano saiu da sala — vaga liberada") para o organizador.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.63-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Desfazer duplas e sair da partida casual</b> — Times formados por arrastar-e-soltar agora exibem um ícone de corrente 🔗 entre os parceiros; um toque quebra a dupla para reformar ou sortear de novo antes de iniciar. Sair da partida casual é efetivo: o organizador que fecha a tela de montagem cancela a partida no Firestore (remove-se da sala e libera os convidados), e jogadores convidados cuja sala foi cancelada são redirecionados automaticamente ao dashboard com aviso — ninguém fica preso em sala fantasma nem visível aos demais.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.62-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Estatísticas do usuário reescritas</b> — Tela de estatísticas no perfil adota o padrão visual do pós-jogo da partida casual: cards <code>_boxStat</code> com ícone + valor em cor de destaque + label pequeno uppercase. Grade principal expandida (Partidas, Vitórias, Derrotas, Aproveitamento, Títulos, Torneios) com códigos de cor por faixa de aproveitamento. Seções detalhadas (Casual 📡 e Torneio 🏆) agora com ícones em cada métrica (saque 🚀, recepção 🛡, killer ⚡, quebras 💥, sequência 🔥, vantagem 📈). Nova seção comparativa "⚖ Casual vs Torneio" com barras lado a lado (partidas, vitórias, aproveitamento, % saque, % recepção) usando o mesmo padrão <code>_compareBar</code> da tela de comparação de times. Dados vêm do <code>matchHistory</code> persistente por usuário no Firestore — sobrevive à exclusão do torneio ou partida casual de origem.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.68-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Arrastar e soltar em toda a partida casual</b> — Ordem de saque: arraste cards para reordenar (desktop + touch). Formar times: arraste um jogador sobre outro → "Formar time?" → os 2 restantes formam o outro time automaticamente. Botão "Refazer times" para recomeçar. Nome completo do perfil em todas as telas.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.65-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida Casual completa + Manual atualizado</b> — Placar ao vivo ponto a ponto em tela cheia (sets, games, tie-break, prorrogação). Lobby em tempo real via QR Code e código de sala. Montagem de times por drag-and-drop ou sorteio automático. Fotos de perfil em todas as telas. Ordem de saque com slots fixos por time e correção durante a partida. Empate oferece Prorrogar ou Tie-break. Badge ⭐ PRO e 📊 Estatísticas na dashboard. Nova seção "Partida Casual" no manual de ajuda. 8 novas dicas contextuais para partidas casuais (152 total).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.25-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Hamburger + Voltar coexistem</b> — Menu hamburger renderiza FORA do header como elemento irmão. Quando aberto, o botão Voltar é empurrado para baixo automaticamente — ambos visíveis e clicáveis ao mesmo tempo. Z-index hierárquico: topbar (100) < Voltar (101) < dropdown (102). Estrutura à prova de regressão.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.20-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: simulação Suíço pareamento correto</b> — Rodadas 2+ agora mostram pareamento por adjacência (1º vs 2º, 3º vs 4º, etc.) em vez de metade superior vs inferior. Antes, 8 participantes mostravam "1º vs 5º, 2º vs 6º..." o que sugeria haver 16 colocados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.19-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Beta Testers</b> — Lista de emails com acesso Pro completo sem necessidade de assinatura Stripe. Testadores têm todas as funcionalidades desbloqueadas automaticamente ao fazer login.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.18-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Exclusão de torneio instantânea</b> — Apagar torneio agora usa UI otimista: remove da tela e navega ao dashboard imediatamente. Notificações aos participantes e exclusão do Firestore rodam em background sem bloquear a interface.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.17-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Escolha de rodadas no Suíço classificatório</b> — Ao selecionar Suíço como resolução de potência de 2, o organizador agora escolhe quantas rodadas jogar (de 2 até N). Cada opção exibe pontuação de equilíbrio de Nash com 4 critérios: Precisão (35%), Justiça (30%), Esforço (20%) e Velocidade (15%). A opção recomendada é destacada com badge. Ao clicar numa opção, a simulação visual atualiza em tempo real mostrando rodadas, partidas e fase eliminatória.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.16-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: Suíço como classificatória para Dupla Eliminatória</b> — Quando o Suíço é escolhido como resolução de potência de 2 (p2Resolution), ele agora funciona corretamente como fase classificatória: gera rodadas suíças, e ao encerrar a última rodada, os top N classificados (potência de 2 mais próxima) avançam automaticamente para a fase eliminatória do formato original (Eliminatórias, Dupla Eliminatória, etc.). Antes, o Suíço-como-resolução era tratado como torneio Suíço puro, ignorando o formato real.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.15-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: sorteio Suíço não gerava confrontos</b> — Torneios Suíço e Liga agora pulam direto para o sorteio sem passar pelo painel de resolução de potência de 2 (que não se aplica a esses formatos). Antes, o painel bloqueava o fluxo exigindo resolução de "número ímpar" ou "não é potência de 2" — problemas que o Suíço resolve naturalmente com BYE.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.14-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: flickering nos painéis de resolução</b> — Removido <code>backdrop-filter:blur</code> de todos os 10 overlays em draw-prep e draw (resolução de potência de 2, simulação, enquete, reabrir, revisão final). Scroll do body travado enquanto painel está aberto e restaurado ao fechar. Background opaco (92-95%) substitui o blur problemático.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.13-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Inscrição/desinscrição instantânea</b> — UI otimista: ao clicar em Inscrever-se ou Desinscrever-se, a tela atualiza imediatamente sem esperar a resposta do servidor. A transação Firestore roda em background; se falhar, o estado é revertido automaticamente com aviso ao usuário.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.12-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix estrutural: detecção de Suíço como classificação</b> — Corrigido problema recorrente onde torneios com formato Suíço aplicado via resolução de potência de 2 renderizavam tela em branco no bracket. A causa raiz era que 9 arquivos verificavam apenas <code>t.format === \'Suíço Clássico\'</code>, ignorando <code>classifyFormat</code> e <code>currentStage</code>. Agora todos os pontos de detecção incluem as 3 condições. Removido hack temporário de troca de formato no sorteio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.11-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: Suíço como ajuste de potência de 2</b> — Ao selecionar formato Suíço na resolução de potência de 2, o sorteio agora gera corretamente a Rodada 1 com standings, pairings e notificações (antes apenas marcava status sem gerar partidas). Corrigido flickering na tela de simulação: painel de resolução é escondido quando a simulação abre e restaurado ao voltar.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.10-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Notificações de torneio encerrado</b> — Todos os participantes agora recebem notificação quando um torneio é encerrado, seja manualmente pelo organizador, automaticamente ao completar todas as partidas, ou por expiração de temporada da Liga. Corrigidos 3 pontos de encerramento que não enviavam notificação.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: torneios encerrados visíveis</b> — Torneios encerrados públicos e de participação agora aparecem corretamente no dashboard. Seção "Torneios Encerrados" aberta por padrão (não mais colapsada). Filtro "Encerrados" inclui todos os encerrados visíveis.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.8-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Torneios encerrados com destaque</b> — Seção "Torneios Encerrados" agora separa os torneios em que você participou ou organizou (com badge 🏆) dos demais. Seus torneios aparecem primeiro com sub-título destacado. No filtro "Encerrados" a mesma priorização é aplicada. Canais de notificação (Plataforma, E-mail, WhatsApp) movidos para dentro da seção Social no perfil, entre filtros de comunicação e locais de preferência.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.52-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments.js</b> — 28 novas chaves <code>tourn.*</code> cobrindo mensagens e labels do orquestrador principal. Notificações: friendInvitedMsg/aFriend, noInvitesSent. Diálogos: removeParticipantTitle/Msg, splitTeamTitle/Msg. Datas: dateTo ("A"), dateTbd ("A DEFINIR"), singleCat. Banner de convite de organização: inviteTransfer/Cohost + descs. Eventos Liga: ligaStart, nextDraw, seasonEnd. Inscritos: teamEnrolled/Drawn/Formed, individualEnroll. VIP: removeVip/markVip. Ordenação de inscritos: sortAlphaAsc/Desc, sortChronoAsc/Desc.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.53-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — dashboard.js</b> — 15 novas chaves <code>dashboard.*</code>: monthAbbrevs (meses abreviados), statEnrolled/Teams/Waiting (contadores), labelFormat/Access/Progress, inProgress ("Em andamento"), votes/remaining (enquete), tournamentName (fallback), andMore (paginação), clearFilters, statistics, casualMatch.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.54-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — participants.js</b> — 16 novas chaves <code>participants.*</code>: diálogos de ausência (4 variantes de título/mensagem/botão), teamIndividual, splitTeam, drawDoneMsg, inProgressBadge, startTournament, defaultFormat. Nova chave <code>common.opponent</code>. Reutiliza tourn.teamEnrolled/Drawn/Formed e tourn.removeVip/markVip.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.55-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments-categories.js</b> — 22 novas chaves <code>cat.*</code>: estimatedDuration, matchesSuffix, endTimePrefix, noCategory, dragToAssign, dragInstructions, oneCourtLabel/nCourtsLabel, mergeDialogTitle/Msg, removeFromCatTitle/Msg, unmergeDialogTitle/Msg/MsgInferred, assignedDialogMsg, sourceProfile/Organizer, questionOrg.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.56-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments-draw.js</b> — 16 novas chaves <code>tdraw.*</code>: painel de revisão final (readyTitle/Subtitle, enrollClosed/Desc, teamsConsolidated/Desc, bracketStructure, p2AchievedVia, resolutionHistory, rollDrawNow, backAndReview), notificações (round1NotifTitle/Msg, swissNotifTitle/Msg).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.57-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments-organizer.js</b> — 6 novas chaves <code>org.*</code>: cloneSuffixFull, reminder7d/2d/0d, nearbyMsg, commFullMsg. Lembretes de torneio e mensagens de torneio próximo totalmente traduzíveis.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.58-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — pre-draw.js</b> — 32 novas chaves <code>predraw.*</code> e <code>btn.goDashboard</code>: janela pré-sorteio (notFound/Msg, emptyDrop, standbySection, title, enrolledCount, addCategory, runDraw, statEnrolled/Categories/Bracket/ResultBy, pow2Exact/Gap, resultPlayers/Referee/Organizer, changeFormat), diálogos (renameCat, mergeCat, newCat, catExists, formatChanged).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.61-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments-draw-prep.js (simulações e enquetes)</b> — ~200 novas chaves <code>predraw.*</code> cobrindo toda a tela de simulação de resolução e o sistema de enquetes. Simulações: BYE (título/subtítulo/seções R1/Byes/R2/footer), Play-in (título/stats/R1/Repescagem/R2/tiebreak/classificados), Standby/Lista de Espera (header/modos teams/indiv/badge/lista/subtítulos com teamSize), Suíço Classificatório (título/subtítulo/colunas Rodadas/Classificados/Partidas/legenda Nash/preview de fases/labels de rodada/partidas/empate/classificação). Enquetes (pollSystem): títulos/subtítulos de dialog/countdown/notificações de enquete aberta/encerrada, contextos (Ajuste de Chaveamento/Times Incompletos), labels de voto e minutos. Helpers: simTeam/Participant/Player/Match, votesLabel, backLabel/confirmLabel/simNote, gauge (centerTeams/Parts), P2 confirm (lastTeams/Parts, options titles/descs). Todas as strings hardcoded de <code>showResolutionSimulationPanel</code>, <code>_showPollCreationDialog</code>, <code>_showPollVotingDialog</code>, <code>_renderPollBanner</code>, <code>_renderClosedPollBanner</code>, <code>_checkPollNotifications</code>, <code>_handleP2Option</code> e <code>_showReopenPanel</code> conectadas ao <code>_t()</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.60-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — create-tournament.js</b> — 85 novas chaves <code>create.*</code> cobrindo todo o formulário de criação/edição: cabeçalho (modalTitle, saveTournament), nome/esporte/logo (nameLabel, sportLabel, logoSection, noLogo, genLogo), acesso (publicLabel, publicDesc), configurações de formato (gruposConfig/Count/DistDesc/Classified, suicoConfig/Rounds/Recommendation, ligaConfig/NewScore/InactRule, drawSchedule, manualDraw/Desc), datas (enrollDeadline, tournamentStart/End), local (venueSection/Label/Placeholder, accessOpen/Desc, courtsLabel/Names/Sep/Hint), tempo (weatherSection, timeEstSection, callTime/Desc, warmup/Desc, gameDur/Desc, estDuration), placar (matchFormat, gsmAdvantage/Desc), participantes (maxParticipants, noLimit, simples/DuplasSideDesc), inscrições (enrollIndividual/Desc, enrollTeam/Desc, autoClose/Desc), WO (woSection, woIndividual/TeamDesc), inscrição tardia (lateEnrollSection, lateEnrollClosed/Standby/Expand e Descs), categorias (catSection, genderCatLabel, catFem/Masc/MistoAle/Obr, skillCatLabel/Placeholder/Hint, catPreview), resultado (resultSection, resultOrg/Players/Referee e Descs), classificação (classificationSection, rankingPersonalized/Blocks/TypeHint), desempate (tiebreakerSection/Desc, tbHeadToHead/PointDiff/Wins/Buchholz/Sonneborn/Random), umidade (humidity).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.59-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments-enrollment.js</b> — 9 novas chaves <code>enroll.*</code>: mensagens de notificação ao organizador (orgEnrollMsg, orgTeamEnrollMsg, orgUnenrollMsg), inscrição tardia (lateAddTitle/Msg, lateTeamTitle), campos de time (memberPlaceholder, memberLabel, anonParticipant).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.51-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — auth.js</b> — 75+ strings do perfil, autenticação e estatísticas conectadas ao <code>_t()</code>. 21 novas chaves <code>auth.*</code>: provedores de login (providerPassword/Phone), notificações (friendAcceptedMsg, participantEnrolledMsg), botão Google (signInGoogle), defaults (defaultUser/someone/someParticipant/orgShort), localização (myLocation/noLocationAdded/mapUnavailable/locationSearchError), diálogo comunicações fundamentais, categorias de gênero (genderFem/Masc/MistoAl/Ob). 52 novas chaves <code>profile.*</code>: modal completo (myProfile, labels de todos os campos, sexo, cidade, categoria, esportes, WhatsApp), social/notificações (socialCommsTitle/Desc, acceptFriends, receiveComms, notifAll/Important/Fundamental, notifChannels/Platform), locais (labelLocations/Desc/searchLocation), aparência (labelAppearance, themeNight/Light/Sunset/Ocean, visualHints/hintsDesc, language), desempenho (myPerformance, calculating, deleteAccountPerm), estatísticas (statWins/Losses/Rate/Points/Serve/Recv/Breaks, matchOne/Many, detailedStats/Desc, casualMatches/tournamentsSection, h2h/partners Casual/Tournament).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.50-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — bracket-ui.js e bracket-logic.js</b> — 22 novas chaves <code>bui.*</code> cobrindo UI interativa do bracket e lógica de rodadas. bracket-ui.js: overlay de sets (fixedSet/setResult), desempate tie-break (drawTiebreak), diálogo editar resultado (editResultTitle/Confirm), placar compartilhado (resultShareTitle/drawResult), Modo TV (nextGames, waitingPresence/Count, groupLabel). bracket-logic.js: label BYE (byeLabel), 3º Lugar (thirdPlaceMatch), diálogo rodada incompleta (incompleteRound/Msg), notificação de classificação suíça encerrada (swissFinishedNotif), notificação nova rodada (newRoundTitle/NotifMsg), roundClosed.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.49-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — bracket.js</b> — 50+ strings do chaveamento conectadas ao <code>_t()</code>. Labels de jogo/rodada: matchNum (Jogo {n}), playIn, round, final, semiFinal, quarterFinal, grandFinal, lowerBracket. Check-in: checkedIn/notCheckedIn/partial, ready badge, liveBtn/liveScore. Standings: standingsTitle/Cat (Classificação — Rodada {n}), draw/pending, tournamentFinished, closeRound, startFirstRound. Estatísticas: statMostWins/statStreak/statTotal/statsTitle. Confrontos Diretos: h2hTitle/Simple/Legend. Layout: layoutLinear/Mirror, classified ({n} posições definidas), monarchMatchRotation. Estados vazios: noRounds/noRoundsDesc/noGroups/noActiveRounds. Avançar para eliminatória. <code>var _t</code> adicionado a renderGroupStage. 37 novas chaves: <code>bracket.*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.48-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — tournaments-draw-prep.js</b> — 75 strings do painel de resolução, enquetes e encerramento conectadas ao <code>_t()</code>. Painel unificado: 8 títulos/descrições de opções (Reabrir, BYE, Play-in, Lista de Espera, Exclusão, Suíço, Ajuste Manual, Enquete), gauge (Inferior/Superior/Times Atuais/Inscritos, sobram/faltam), badge "⭐ Recomendado", "Excluídas:". Lista de problemas: Times incompletos/Resto/Número ímpar/Não é potência de 2. Painel de realocação manual: título/descrição/botões. Dialog de votação de enquete: contexto (Ajuste de Chaveamento/Número Ímpar/Times Incompletos), Tempo restante, instrução, Fechar, ⚖️ Recomendado, Seu voto. Banners de enquete: ENQUETE/ENQUETE ENCERRADA, Votar Agora/Ver Alterar Voto, Você já votou/Aguardando, Encerrar Agora, restante, suspensas, Aplicar Resultado, Reabrir Enquete, Ver Detalhes. Dialog encerrar enquete. Encerrar Torneio (🏁). Painel Reabrir Inscrições: título/labels/botões. 79 novas chaves: <code>predraw.*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.47-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — GSM, nomes de campos e tabela P2</b> — Strings finais de create-tournament.js conectadas ao <code>_t()</code>: _buildP2Table (inscritos, tempo/partida, cabeçalho), okCapacity (com interpolação), objeto _checkFields (8 labels de validação). Resumo curto GSM (7 chaves: fixed/Tb, points, 1set/Tb, bestOf, decider, tb, advantage). Resumo detalhado GSM (8 chaves: title, desc, tieWithTb/NoTb, sets, counting/Adv, tbDetail, superTb). 34 novas chaves: <code>create.field*</code>, <code>create.okCapacity</code>, <code>create.gsm*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.46-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — _p2Resolution e sugestões</b> — 30+ strings do sistema de estimativa de duração conectadas ao <code>_t()</code>: _p2Resolution (potência de 2 não é, classificatórias/BYEs, recomendação mais rápido), 4 sugestões de overflow (limitar/potência de 2, limitar com classificatórias, limitar simples, estender horário, +1 dia, trocar formato), 2 sugestões de near-limit (encerrar inscrições). Novas chaves: <code>create.notPow2Title</code>, <code>create.playinRow</code>, <code>create.matchesTime</code>, <code>create.byeRow</code>, <code>create.playinFaster</code>, <code>create.byeFaster</code>, <code>create.limitEnroll*</code> (3), <code>create.applyN</code>, <code>create.extendTime*</code>, <code>create.addExtraDay</code>, <code>create.switchTo</code>, <code>create.closeEnrollAt</code>, <code>create.nearLimitCap</code> + auxiliares (30 novas chaves).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.45-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — estimativa de duração e labels de acesso</b> — 20 strings em create-tournament.js conectadas ao <code>_t()</code>: estimativa de duração (quadra/s, Tempo disponível, min/partida, rodada/s, sequenciais, jogos, classificatória/s, chave, aviso de overflow, máximo), visibilidade de acesso ternária (🌐/🔒 na restauração de template), lançamento de resultado (Organizador/Jogadores/Árbitro, "Quem lança: {list}"), labels curtos de acesso. 17 novas chaves: <code>create.*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.44-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — inline HTML em create-tournament</b> — 9 strings inline conectadas ao <code>_t()</code>: Sem logo, 🌐 Aberto ao Público, 🔒 Acesso Restrito, Carregando API do Google, Nenhum resultado encontrado, Mapa indisponível (2x), Previsão apenas para próximos 5 dias, X min por partida (com interpolação), detalhe de duração Chamada/Aquecimento/Jogo (com 3 interpolações). 9 novas chaves <code>create.*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.43-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — labels descritivos e UI</b> — strings descritivas de interface conectadas ao <code>_t()</code> em 3 arquivos. bracket-ui.js: <code>Tie-break!</code> e <code>🔄 Atualizado</code>. tournaments-draw-prep.js: <code>Encerrada</code> (countdown de enquete) e <code>Jogadores em Espera</code>. create-tournament.js: 11 strings — tipos de jogo (simples/duplas/misto), visibilidade (público/privado), acesso (aberto/restrito), dica de quadras, título de editar torneio, labels de tie-break com interpolação, descrição de games fixos. 19 novas chaves: <code>bui.*</code> (2), <code>predraw.*</code> (2), <code>create.*</code> (9).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.42-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — textContent/innerText</b> — todas as atribuições diretas de DOM hardcoded em português conectadas ao <code>_t()</code> em 5 arquivos. bracket-ui.js: 10 strings de scoring de sets/games (Enter games, Total deve ser N, Empate + tie-break completo/preencher, Jogador 1/2, vence, TB, Em andamento, Para o Set N, Auto-refresh). auth.js: 3 strings do fluxo de exclusão de conta. store.js: 2 strings de checkout Pro. main.js: 2 títulos do modal de criação. tournaments.js: 1 string de envio. 19 novas chaves: <code>bui.*</code> (10), <code>auth.*</code> (2), <code>store.*</code> (2), <code>create.*</code> (2), <code>tourn.sending</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.41-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — botões de diálogo e labels</b> — todos os <code>confirmText</code>/<code>cancelText</code> hardcoded em português conectados ao sistema <code>_t()</code> em 9 arquivos. 22 novas chaves <code>btn.*</code>: remove, merge, mergeFuse, unmerge, group, keepSeparate, undo, keepTeam, finishTourn, finishAndDraw, keepOpen, finishAnyway, removeAndContinue, directDraw, playoff, voteNow, later, waitMore, deleteReedit, dqSub. Corrigidos também: inline onclick de QR Code (tournaments-sharing.js), label "Participante sem partida" (tournaments-utils.js).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.40-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — diálogos</b> — todas as strings hardcoded em português em <code>showAlertDialog</code>, <code>showConfirmDialog</code> e <code>showInputDialog</code> conectadas ao <code>_t()</code> em 7 arquivos: tournaments-draw.js (6 calls: sorteio já realizado, refazer, inscritos insuficientes, sem categoria, modo individual, agrupar), tournaments-draw-prep.js (5 calls: reabrir enquete, não permitido, reabrir/encerrar inscrições), create-tournament.js (4 calls: nome obrigatório/duplicado, datas/prazo inválido), tournaments-utils.js, pre-draw.js, dashboard.js e bracket-ui.js (8 calls: jogadores insuficientes, substituir W.O., resultado copiado, torneio não encontrado, confrontos, insuficiente). Novas chaves: <code>draw.*</code> (14), <code>create.*</code> (8), <code>bui.*</code> (8), <code>predraw.*</code> (3), <code>utils.*</code> (1), <code>btn.back</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.39-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — zero strings hardcoded em português</b> — últimos 6 arquivos conectados ao sistema <code>_t()</code>: tournaments-organizer.js (1 call, erro ao salvar template), tournaments-utils.js (2 calls, merge de participantes, correção de nomes), pre-draw.js (1 call, formato alterado), notifications.js (2 calls, FCM ativado/bloqueado), main.js (1 call, torneio criado), tournaments-draw-prep.js (1 call, torneio encerrado). Nenhuma string hardcoded em português restante em <code>showNotification</code> em todo o codebase.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.38-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo — 10 arquivos em uma release</b> — todas as strings hardcoded em português conectadas ao sistema <code>_t()</code> em: tournaments-enrollment.js (20 calls, incl. lista de espera, cancelamento, liga ativo/inativo), tournaments-categories.js (12 calls, merge/unmerge/atribuição), participants.js (9 calls, check-in, substituição, W.O.), tournaments-sharing.js (8 calls, copiar link, QR, CSV), tournaments-draw.js (8 calls, duplicatas, torneio iniciado, grupos, suíço, sorteio), tournaments.js (10 calls, amigos, convites, bots, onclicks inline), store.js (6 calls, login Pro, pagamento, sync error, notificações), bracket-logic.js (5 calls, torneio encerrado, classificatória, nova rodada), hints.js (6 calls, ativar/desativar/resetar dicas), enroll-modal.js (3 calls, copiar link). Variáveis locais redundantes <code>_tFn/_tFn2/_tFn2a/_tFn3/_tFnRem/_tFnSeason</code> removidas. ~30 novas chaves adicionadas em <code>bui.*</code>, <code>enroll.*</code>, <code>cat.*</code>, <code>store.*</code>, <code>hints.*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.37-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo de Criação de Torneio e Bracket UI</b> — todas as strings hardcoded em português de create-tournament.js (14 calls) e bracket-ui.js (13 calls) conectadas ao sistema <code>_t()</code>. Cobertura: logo, erros de local, torneio criado/salvo, auto-atribuição de categorias, template aplicado, substituição de jogadores, fase eliminatória, lançamento de resultado, leitura de QR code. Novos namespaces adicionados: <code>sub.*</code>, <code>bui.*</code>, <code>share.*</code>, <code>tdraw.*</code>, <code>cat.*</code>, <code>tourn.*</code>, <code>store.*</code>, <code>enroll.*</code> com ~90 novas chaves em pt/en.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.36-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo da Preparação de Sorteio</b> — todas as 25 strings hardcoded em português de tournaments-draw-prep.js conectadas ao sistema <code>_t()</code>. Cobertura: ajuste de times, reabertura de inscrições, BYE rotativo, exclusão de participante, restauração de inscrições, enquetes (criação, votação, encerramento, reabertura), remoção para potência de 2, reabrir torneio, encerrar inscrições. 53 novas chaves adicionadas no namespace <code>draw.*</code>. Variáveis locais redundantes <code>_tFnFin/_tFnReopen/_tFnClose/_tFnClose2</code> removidas — substituídas pelo alias IIFE <code>_t</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.35-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo da Autenticação</b> — todas as ~80 strings hardcoded em português das funções de login/perfil (auth.js) conectadas ao sistema <code>_t()</code>. Cobertura: login Google, vinculação de conta, link por e-mail, SMS/telefone, e-mail+senha, cadastro, redefinição de senha, auto-inscrição pós-login, logout, exclusão de conta, propagação de nome, locais de preferência e geolocalização, salvamento de perfil. 105 novas chaves adicionadas em i18n-pt.js e i18n-en.js no namespace <code>auth.*</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.34-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>i18n completo da Partida Casual</b> — todas as ~80 strings hardcoded em português da feature de partida casual (bracket-ui.js) conectadas ao sistema <code>_t()</code>. Cobertura: lobby setup, tela de espera, preview de times, status de ingresso, notificações de shuffle/ingresso/saída/início, telas de erro offline/not-found/closed, display de resultado final. 7 novas chaves adicionadas em i18n-pt.js e i18n-en.js: <code>casual.draw</code>, <code>casual.offlineMsg</code>, <code>casual.notFoundMsg</code>, <code>casual.playerFallback</code>, <code>casual.someone</code>, <code>casual.liveTitle</code>, <code>casual.liveConnectedMsg</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.33-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Limpeza de código — resultado-modal removido e console.log de produção eliminados</b> — <code>result-modal.js</code> (marcado como deprecated desde v0.4.0, nunca chamado) removido de index.html e sw.js. Logs de debug <code>console.log</code> em host-transfer.js (6 chamadas de rastreamento de notificação), auth.js (AutoFixNames + PropageName, disparados a cada login), bracket-ui.js (save casual) e tournaments-utils.js (Merge/Dedup/FixOrphans) rebaixados para <code>console.debug</code> — visíveis apenas quando o nível de log do DevTools incluir Verbose.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.32-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Correção: parseInt com radix e NaN guard no auto-encerramento de inscrições</b> — <code>parseInt(maxParticipants)</code> sem radix podia interpretar valores com prefixo <code>0x</code> como hexadecimal; sem NaN guard, um valor malformado como <code>"unlimited"</code> retornaria NaN e desabilitaria silenciosamente o auto-encerramento ao atingir capacidade. Agora usa <code>parseInt(..., 10)</code> com validação <code>!isNaN</code> e <code>&gt; 0</code>.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.31-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria de segurança — XSS em atributos data- dos cards de participante</b> — Os atributos <code>data-participant-name</code> e <code>data-merge-name</code> nos cards de participante em tournaments.js usavam apenas <code>replace(/"/g, \'&amp;quot;\')</code>, deixando <code>&amp;</code>, <code>&lt;</code> e <code>&gt;</code> sem escape. Substituído por <code>_safeHtml()</code> para escape completo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.30-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria de segurança — XSS em nomes de jogadores na lista de participantes</b> — Nomes de jogadores individuais e membros de equipe no participants.js agora passam por <code>_safeHtml()</code> antes de serem injetados em atributos <code>title</code>, <code>data-player-name</code> e no conteúdo do span. Corrige potencial XSS via nome contendo <code>&lt;</code>, <code>&gt;</code> ou <code>&quot;</code>. Complementa a correção de escaping de onclick da v0.11.29.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.29-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria de segurança — escaping completo em participants.js e host-transfer.js</b> — Três variáveis de escape de nome de jogador em participants.js (_nmSafe, _pSafe, safeP) e o tId em host-transfer.js passaram a escapar barra invertida antes de aspas simples. Completa a varredura de todos os onclick handlers do codebase — agora todos os arquivos JS seguem o padrão correto: escapar \\\\ antes de \'.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.28-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria de segurança — correção de escaping em onclick handlers</b> — (1) <b>Ordem errada corrigida</b>: pre-draw.js escapava aspas antes de barras invertidas, o que podia quebrar categorias com backslash. Corrigido para sempre escapar <code>\\</code> antes de <code>\'</code>. (2) <b>Backslash ausente</b>: dashboard.js (filtros de esporte/local/formato e botão Estatísticas), bracket.js (nomes de jogadores nos cards e na classificação), bracket-ui.js (seletor de esporte e URL de partida casual) e tournaments-sharing.js (URL de cópia de link) — todos passaram a escapar também a barra invertida, não apenas aspas simples. (3) <b>Memory leak do hamburger</b>: handler de clique externo agora sempre remove listener anterior antes de adicionar novo, evitando acumulação em double-open rápido. (4) <b>Null check</b>: doc.data() validado antes de push em loadAllTournaments do Firestore.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.27-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Modal de estatísticas do dashboard completamente reescrito com histórico persistente como dado primário</b> — O modal "📊 Estatísticas" agora exibe diretamente as estatísticas ricas do <code>users/{uid}/matchHistory</code> como conteúdo principal (o mesmo formato da tela de resultado de partida casual): seções separadas para Partidas Casuais e Torneios com vitórias/derrotas/aproveitamento, sets, games, pontos, %saque, %recepção, killer points e quebras. Tabelas de Confrontos Diretos (H2H) e Parcerias com foto e winrate. Os números mostrados sempre refletem partidas reais registradas — não mais o scan do AppStore que podia retornar zeros. Fallback para stats do AppStore apenas quando uid não é resolvível.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.26-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Foto + estatísticas detalhadas no modal de estatísticas do dashboard + botão Perfil do menu hambúrguer consertado</b> — Ao clicar no botão "📊 Estatísticas" do dashboard, o modal agora: (1) carrega a foto real do perfil quando é você mesmo (via currentUser.photoURL) ou de um amigo conhecido (AppStore.friends); (2) resolve o uid do jogador e carrega o histórico persistente em <code>users/{uid}/matchHistory</code>; (3) renderiza seções separadas para Partidas Casuais e Torneios com estatísticas ricas (vitórias, derrotas, aproveitamento, sets/games/pontos, %saque, %recepção, killer points, quebras, duração média, tempo/ponto médio); (4) exibe tabelas de Confrontos Diretos (H2H) e Parcerias separadas para casuais e torneios — registro preservado mesmo se o torneio for apagado ou a sala casual encerrada. O botão de perfil dentro do menu hambúrguer agora abre o modal corretamente — antes o addEventListener era perdido quando o menu clonava o nav; agora usa inline onclick + funções globais (<code>window._onProfileBtnClick</code> e <code>window._openMyProfileModal</code>) que sobrevivem ao cloneNode.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.25-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Cabeçalho do perfil blindado</b> — O render do cabeçalho de avatar + nome + e-mail dentro do bloco de estatísticas foi envolvido em try/catch para garantir que nenhuma falha (photoURL inválida, nome ausente, etc.) impeça a abertura do modal de perfil ou o carregamento das estatísticas abaixo. Fallback da inicial usa charAt() seguro. Bump força auto-update client-side para usuários com cache antigo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.24-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Cabeçalho de usuário nas estatísticas do perfil</b> — Ao abrir "Meu Desempenho" no perfil pelo dashboard, o conteúdo do bloco de estatísticas agora começa com avatar (foto real ou fallback com inicial colorida), nome e e-mail do usuário — mesmo estilo do cabeçalho de perfil. Fornece contexto imediato de que os dados exibidos são do próprio usuário.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.23-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Tempo por ponto + dicas + manual atualizados</b> — Cada ponto agora registra timestamp (t: Date.now()) no pointLog. Nova seção "⏱ Tempo" na tela de resultado exibe Duração, Tempo médio/ponto, Intervalo mais longo e Intervalo mais curto. Dados persistidos em matchHistory como timeStats (avgPointMs, longestPointMs, shortestPointMs) para análises futuras. Novas dicas contextuais cobrem: bolinha de saque travada, botão Sair libera vaga, Fechar partida, cards de jogador clicáveis, gráfico Momentum com Replay, seção Comparação, botão Jogar Novamente + toggle Re-sortear, tie-break 7 com 2 de margem, times visíveis no lobby, e seção de Estatísticas Detalhadas no perfil (H2H + parcerias). Manual de ajuda ganhou seção "📊 Estatísticas Detalhadas" e expandiu "Partida Casual" com as sub-seções Placar ao Vivo, Tela de Resultado, Lobby e Compartilhamento.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.22-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Histórico persistente por usuário + estatísticas detalhadas no perfil</b> — Toda partida (casual ou torneio) passa a gravar um registro detalhado (stats de time, serve %, killer points, quebras, sequência, vantagem, per-player serve stats) em <code>users/{uid}/matchHistory</code> para cada jogador registrado envolvido. Os dados sobrevivem mesmo se o torneio for apagado ou a partida casual terminada. Nova seção "📊 Estatísticas Detalhadas" no perfil carrega esse histórico e mostra agregações separadas para Partidas Casuais vs Torneios, tabelas de Confrontos Diretos (H2H) e de Parcerias para cada modalidade — com W-L-E e aproveitamento por oponente/parceiro.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.21-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Momentum logo abaixo do vencedor + toggle elegante</b> — Box "Momentum da Partida" movido para logo abaixo do box Vencedor na tela de resultado, de forma que a animação de desenho das linhas seja visível no momento de abertura. Botão "🔄 Jogar" ficou compacto para dar espaço ao toggle "Re-sortear duplas" que agora renderiza como switch pill elegante (toggle-switch toggle-sm) no lado direito — cabe sem espremer em viewports de 303px+.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.20-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Gráfico Momentum redesenhado: linhas duplas animadas</b> — Substituído o gráfico de diferença com preenchimento por duas linhas cumulativas distintas: azul para o Time 1 e vermelha para o Time 2, ambas crescendo da esquerda para a direita. Y-axis com gridlines e rótulos (0, 5, 10, ...). Ao abrir a tela, as linhas se desenham progressivamente ao longo de 2.8s via stroke-dashoffset + pathLength="100". Marcadores finais (círculos + pontuação) aparecem ao final da animação. Botão ↻ Replay re-executa a animação. Linhas tracejadas verticais marcam o fim de cada set (S1, S2...).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.19-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botões da tela de vitória sem cortes no navegador</b> — Overlay agora usa 100dvh (altura dinâmica do viewport) para respeitar o URL bar que aparece/desaparece em Safari e Chrome mobile. O rodapé com Confirmar Resultado, Jogar Novamente e toggle Re-sortear duplas agora tem padding-bottom = 12px + env(safe-area-inset-bottom), garantindo que o home-indicator (iPhone X+) e a barra do navegador não cobrem os botões. Também removido o gate de "usuário envolvido" — os botões aparecem para todos os usuários na tela de resultado.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.18-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botão Sair do lobby agora funciona de verdade</b> — Ao clicar Sair (ou Voltar ao Dashboard) no lobby da partida casual, o handler agora: (1) marca _hasLeft para bloquear auto-join concorrente, (2) para o interval de refresh, (3) libera a vaga no Firestore (fire-and-forget) e (4) navega imediatamente para o dashboard — o usuário não fica mais preso no lobby esperando Firestore responder.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.17-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Times formados visíveis no lobby</b> — Quando o organizador monta os times na tela de setup (via drag-and-drop ou renomeia jogadores), as mudanças são sincronizadas no Firestore em tempo real (debounced). Os outros usuários cadastrados que já estão na sala passam a ver "⚔ Times formados" com Time 1 vs Time 2 em vez de só "Aguardando jogador". Auto-refresh agora atualiza o snapshot completo da partida (não só participants).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.16-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Abandonar partida libera a vaga</b> — Ao clicar em Fechar e confirmar o abandono da partida casual, agora a vaga do jogador é efetivamente liberada (uid removido do slot em players, além de participants e playerUids). O jogador sai da tela e é redirecionado ao dashboard em vez de ficar preso na tela de lobby.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.15-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Decisões de jogo restritas aos jogadores</b> — Botão "Jogar Novamente" e toggle "Re-sortear duplas" (agora lado a lado) só aparecem para usuários cadastrados que estão jogando a partida. O mesmo vale para a escolha de prorrogar/tie-break e para o botão de ir pro tie-break durante prorrogação — não-jogadores veem "Aguardando decisão dos jogadores". Guard também no handler _liveResolveTie para impedir bypass via console. Tie-break continua a 7 pts com margem de 2 (se não houver 2 pts de vantagem, segue até ter).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.14-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Dashboard sempre no topo</b> — Ao navegar de volta para o dashboard, a página agora sempre pula instantaneamente para o topo (window + documentElement + body), cancelando qualquer smooth-scroll em andamento e cobrindo reflows pós-render.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.13-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Analytics completa de partida + cards clicáveis</b> — pointLog enriquecido com sacador, contexto do game e flag de tiebreak para cada ponto. Nova seção "Comparação dos Times" lado a lado com barras: Sets, Games, Pontos, % Pontos no Saque, % Pontos na Recepção, Games Mantidos (saque), Quebras de Saque, Killer Points (40-40), Maior Sequência, Maior Vantagem. Cards de jogador clicáveis abrem modal com estatísticas individuais detalhadas: saque por game (servidos, mantidos, aproveit., maior sequência) e por ponto (pts servidos, ganhos, % no saque).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.12-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Gráfico Momentum ponto a ponto na tela de vitória</b> — SVG do desenvolvimento da partida exibe a diferença cumulativa de pontos ao longo de todo o jogo. Área azul acima do zero indica vantagem do time 1, vermelha abaixo indica vantagem do time 2. Linha amarela suave sobre as áreas com pontos maiores nos extremos (maior vantagem de cada time) e marcador final. Linhas tracejadas verticais com rótulos S1, S2, ... marcam o final de cada set.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.11-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Travamento do saque reforçado + UI</b> — Após 2 jogos, ordem de saque fica travada em todos os canais (drag, _liveSetServer, _liveSwapServerInTeam) com guards explícitos. A bolinha de saque mostra um cadeado 🔒 quando travada, glow dimmer e tooltip "Ordem de saque travada". Campo "Sala de um amigo" agora tem mesma altura (44px) do botão Entrar.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.10-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Tela de vitória com aproveitamento de saque por jogador</b> — Estatísticas do vencedor em destaque no topo (troféu, nomes, placar, sets/games/pontos) e as do perdedor abaixo. Cada jogador mostra seu aproveitamento de saque (% de games mantidos como sacador) calculado a partir do histórico de saques. Tiebreaks não entram no cálculo.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Layout da tela de resultado ajustado</b> — Botões "Confirmar Resultado" e "Jogar Novamente" agora fixos no rodapé (não ficam mais cortados). Estatísticas em área com scroll interno quando necessário. Toggle "Sortear duplas" reposicionado abaixo do botão Jogar Novamente seguindo padrão toggle-switch do app.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.3-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Games visíveis em portrait</b> — Box de games movido para acima das placas de placar em portrait, garantindo visibilidade em qualquer tamanho de tela. Corrigido bug de variáveis leftTeam/rightTeam usadas antes da declaração (cores dos games ignoravam lado da quadra).</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.2-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: partida de 1 set não encerrava</b> — Partidas configuradas com 1 set (ex: Beach Tennis 1×6) não encerravam após o primeiro set, iniciando incorretamente um segundo set. Causa: _setsWon() excluía sempre o último set da contagem. Corrigido com parâmetro includeAll em _setsWon e _checkMatchWon. Tie-break agora aparece corretamente em prorrogação de 1 set.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.1-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Games refletem lado da quadra</b> — Cores dos games agora acompanham qual time está em cada lado (ao trocar lados, os números trocam também). Layout portrait sobe para caber tudo sem cortar o box de games. Gaps e paddings reduzidos para otimizar espaço vertical.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.11.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida Casual v2</b> — Box unificado: QR code maior (88px), código da sala, Convidar, campo "Sala de um amigo" e botão Entrar em um único bloco compacto. Landscape otimizado. Sync em tempo real entre dispositivos (tema e sala casual via Firestore onSnapshot). Sem zoom/scroll nas telas de partida.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.92-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auto-update e sync completo</b> — App detecta automaticamente novas versões e recarrega, limpando caches antigos. SW sem cache HTTP e check a cada 5 min. Sync em tempo real de todo o estado (placar, saque, lado de quadra) entre dispositivos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.72-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Partida casual: cores de time e ordem de saque</b> — Cards de jogadores na tela de setup agora sempre mostram cores de time (azul para Time 1, vermelho para Time 2). Ordem de saque no picker alterna obrigatoriamente entre times (T1-T2-T1-T2); arrastar e soltar restrito a troca dentro do mesmo time para manter a alternância.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.7-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: email e WhatsApp nas notificações</b> — Canais de email e WhatsApp estavam completamente inativos (função _dispatchChannels existia mas nunca era chamada). Agora, _sendUserNotification e _notifyTournamentParticipants auto-disparam email e WhatsApp automaticamente para TODAS as notificações. Novos métodos queueEmail e queueWhatsApp no FirestoreDB escrevem na collection mail (Firebase Extension) e whatsapp_queue. Flag _skipDispatch evita duplicação em broadcasts batch.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.6-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Liga Rei/Rainha sem eliminatória</b> — Painel "Classificados por grupo" (1 ou 2) agora escondido quando formato é Liga com rodada Rei/Rainha (pontos corridos, sem fase eliminatória). Guard extra impede auto-advance para eliminatória em torneios Liga.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.5-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Notificações de co-organização completas</b> — Ao aceitar ou recusar convite de co-organização ou transferência, ambos (convidante e convidado) recebem notificação. Notificação original de convite é marcada como lida automaticamente para ambos os lados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.4-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: notificação ao deletar torneio</b> — Callback de exclusão agora é async e aguarda (await) o envio de todas as notificações antes de remover o torneio do Firestore. Antes, a notificação era fire-and-forget e podia ser perdida na race condition com a exclusão.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.3-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fix: notificações do app</b> — Notificações agora usam o uid do participante diretamente em vez de buscar por email no Firestore (mais rápido e confiável). Novo helper _resolveOrganizerUid usa creatorUid do torneio com fallback para email. Corrigido em: inscrição individual, inscrição de time, cancelamento de inscrição, auto-inscrição por convite, e broadcast para todos os participantes.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.2-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Dicas e manual atualizados</b> — Dica do toggle Liga corrigida: descreve participação nos sorteios e regras de pontuação (inativo = 0 pts, folga por falta de jogadores = média). Manual de ajuda atualizado nas seções Formatos, Resultados e Referência Rápida com detalhes do toggle ativo e pontuação diferenciada.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.1-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Liga: pontuacao diferenciada para inativos</b> — Jogador que desativa o toggle de participacao recebe 0 pontos na rodada (antes recebia media). Jogador que fica de fora por falta de participantes suficientes continua recebendo a media de seus pontos. Card de folga diferenciado: inativo com icone vermelho e 0 pts, remainder com icone amarelo e media.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.10.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Sistema de notificações reescrito</b> — Todos os eventos agora geram notificações classificadas em 3 níveis: fundamental, importante e geral. Novos eventos cobertos: torneio apagado, sorteio realizado (todos os formatos), torneio encerrado, inscrições encerradas/reabertas, participante removido, torneio criado (notifica amigos). Catálogo centralizado de notificações (notification-catalog.js). Resultado de partida agora classificado como fundamental. Validação de perfil: WhatsApp sem telefone ou email sem email cadastrado bloqueia o save com alerta. Novos templates de email para todos os tipos. View de notificações refatorada com ícones/cores do catálogo. Navegação inteligente: draw/resultado levam ao bracket, torneio apagado não mostra botão.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.9.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Convites de co-organização corrigidos</b> — Notificações de convite agora entregues corretamente via sistema unificado. Dashboard detecta convites pendentes e redireciona automaticamente para o torneio. Banner dourado pulsante com botões Aceitar/Recusar na página do torneio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.9.2-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Placares sempre visíveis na copa</b> — Todas as partidas com ambos os jogadores definidos agora exibem campos de placar permanentes, inclusive partidas já decididas (pré-preenchidas com valores existentes para edição direta). Não é mais necessário clicar "Editar" para alterar um resultado.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.9.1-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Liga com duplas aleatórias</b> — Rodadas da Liga agora formam duplas aleatórias a cada sorteio e confrontam dupla vs dupla. Parceiros são sorteados a cada rodada para máxima variedade. Pontuação individual mantida (vitória = 3pts, empate = 1pt). Jogadores excedentes (quando não múltiplo de 4) recebem folga com pontuação média.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.9.0-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Dicas do App no manual</b> — Nova seção "Dicas do App" no manual de ajuda com todas as 144 dicas visuais do sistema organizadas por área (Barra Superior, Dashboard, Criar Torneio, Ferramentas do Organizador, Chaveamento, Perfil, etc.) em boxes coloridos para consulta rápida.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.79-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Dicas visuais expandidas</b> — Sistema de hints ampliado de 67 para 144 dicas contextuais cobrindo absolutamente todos os botões, toggles, campos e funcionalidades do app: formulário de criação (formato, esporte, modo de sorteio, inscrição, GSM, categorias, Liga, quadras, datas, W.O., desempate, templates), ferramentas do organizador (editar, comunicar, sortear, categorias, co-organização, encerrar, excluir), bracket (zoom, imprimir, fechar rodada, avançar eliminatória, placar inline, GSM overlay), perfil (gênero, idioma, notificações), check-in (filtros, W.O., substituição, ordenação) e explore (amizade, busca).</p>' +
        '<p><b>Manual de ajuda reescrito</b> — Todas as 20 seções do manual completamente reescritas com cobertura completa de cada funcionalidade. Nova seção "Chaveamento e Classificação" com documentação de zoom, navegação por grupos, Modo TV, standings, confrontos diretos, rodadas anteriores e exportação. Seções existentes expandidas com boxes visuais passo a passo cobrindo todos os campos do formulário, fluxo do organizador, formatos detalhados com descrições coloridas, check-in com W.O./substituição, resultados GSM, e co-organização.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.58-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Configuração de Grupos</b> — Formato "Fase de Grupos + Eliminatórias" agora exibe painel dedicado com todas as distribuições possíveis de grupos. Mostra grupos iguais e mistos (ex: 3 grupos de 4 + 1 grupo de 3), classificados por grupo configurável (1-4), e destaque para configurações com potência de 2 na eliminatória. BYE, Suíço e Lista de Espera não são permitidos neste formato.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.50-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Voltar sempre fixo</b> — Botão "Voltar" usa position: fixed para visibilidade permanente no topo. Desde v0.10.29, coexiste com o menu hamburger (ambos visíveis).</p>' +
        '<p><b>Voltar no Explorar</b> — Página "Explorar" agora inclui botão Voltar fixo no topo.</p>' +
        '<p><b>Badge BYE compacto</b> — Badge "BYE" no chaveamento posicionado acima do campo de placar para não aumentar a altura do card.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.46-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>BYE brackets consistentes</b> — Chaves com BYE agora distribuem os byes intercalados com partidas reais, garantindo que a segunda rodada cruze vencedores reais com classificados por BYE. Corrige brackets onde BYE jogava contra BYE.</p>' +
        '<p><b>Toasts sem duplicata</b> — Inscrição e desinscrição não geram mais notificações duplicadas.</p>' +
        '<p><b>Divulgação imediata</b> — Sorteio sempre com divulgação pública imediata, sem diálogo de visibilidade.</p>' +
        '<p><b>Header sticky corrigido</b> — Botão Voltar e toggle "Só meus jogos" no chaveamento e na página de detalhes agora ficam fixos no topo ao rolar a página.</p>' +
        '<p><b>Box Equipes</b> — Cards do dashboard e detalhes do torneio mostram box "Equipes" com contagem de times formados (por sorteio, inscrição ou organizador), entre Inscritos e Espera.</p>' +
        '<p><b>BYE limpo no chaveamento</b> — R1 mostra apenas jogos reais (BYE matches ocultos). Na R2+, times que avançaram de BYE exibem badge verde "BYE" ao lado do nome.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.32-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>3º lugar com número do jogo</b> — Card da disputa de 3º lugar agora exibe o número do jogo em azul (ex: "Jogo 15") como todas as outras partidas, em vez de repetir "3º LUGAR" no cabeçalho do card.</p>' +
        '<p><b>Headers sticky</b> — Botão Voltar + "Só meus jogos" fixos no topo do chaveamento. Voltar + filtros de check-in fixos nos Inscritos. Voltar/Confirmar fixos nos painéis de simulação.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.30-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Repescagem com critérios de desempate</b> — Classificação na repescagem agora usa todos os critérios configurados do torneio (saldo de pontos, vitórias, confronto direto, saldo de sets/games para GSM, etc.) em vez de apenas placar simples. Passam tantos quantos houverem vagas na rodada seguinte.</p>' +
        '<p><b>Escopo do W.O.</b> — Novo toggle na criação: "Individual" (substitui só o ausente, parceiro fica) ou "Time Inteiro" (time eliminado por W.O.). Configurável por torneio.</p>' +
        '<p><b>Inscrições após encerramento</b> — 3 modos: Fechadas (bloqueado), Lista de Espera (suplentes), Novos Confrontos (suplentes podem gerar jogos extras). Aplica-se a inscrição própria, times e adição pelo organizador.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.27-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Check-in redesenhado</b> — Toggle Presente/Ausente substitui botao na lista de chamada. Botao W.O. substitui Ausente. Lista de espera na pagina de inscritos com toggle+W.O. Substituicao automatica: marca W.O. e o proximo presente da lista de espera entra no lugar.</p>' +
        '<p><b>Paineis de decisao com header sticky</b> — Botoes cancelar/voltar ficam fixos no topo ao rolar paineis de potencia de 2 e times incompletos.</p>' +
        '<p><b>Dashboard</b> — Box lista de espera com contagem separada. Inscritos descontam lista de espera. Barra de progresso conta partidas de grupos Rei/Rainha. Nome do organizador exibido corretamente.</p>' +
        '<p><b>Limpeza</b> — Botao Clonar removido (templates o substituem). Lista de participantes inline oculta apos sorteio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.9-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Convite sem login obrigatorio</b> — Visitantes podem ver o torneio sem fazer login. Se inscricoes abertas, scroll ate o botao "Inscrever-se" com destaque. Se inscricoes fechadas, mensagem explicativa e sugestao para criar proprio torneio. Login so e solicitado ao clicar em Inscrever-se.</p>' +
        '<p><b>Add Bot corrigido</b> — Bots agora persistem no Firestore (antes sync() ignorava participantes). Bots criados como objetos completos com nome, email e uid.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.78-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Countdown excludente da Liga</b> — Liga exibe apenas um countdown por vez, por prioridade: 🏁 Início da Liga (antes de começar) → 🎲 Próximo sorteio (quando há sorteio agendado dentro da temporada) → 🏁 Fim da temporada (quando não há mais sorteios). Tempo decorrido ("Em andamento") não aparece em Ligas. Aplicado tanto no dashboard quanto no detalhe do torneio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.75-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botão Voltar hierárquico</b> — Botão Voltar no detalhe do torneio agora navega por hierarquia (sempre volta ao dashboard) em vez de seguir o histórico do browser. Resolve loop infinito ao navegar nível 3 → nível 2 → nível 3.</p>' +
        '<p><b>Testes 116/116</b> — Corrigidos 4 testes que falhavam: TBD conta como partida pendente, templates async com retorno string, runner suporta funções async.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.74-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Auditoria v0.8.70-73</b> — Correções de segurança e lógica: atributo style duplicado no card de folga (bracket.js), ID de torneio escapado no toggle Liga ativo (XSS), progresso do torneio não conta mais folgas como partidas pendentes, guard contra 0 jogadores ativos na geração de rodadas (Liga), oninput→onchange nos campos de data/hora do sorteio Liga.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.73-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Card de folga</b> — Jogadores em folga (Liga) exibem card compacto com emoji, nome e pontuação média recebida, em vez de card de partida normal.</p>' +
        '<p><b>Notificação pós-sorteio</b> — Todos os participantes recebem notificação quando uma rodada é sorteada (Liga/Suíço), tanto na primeira rodada quanto nas seguintes.</p>' +
        '<p><b>Folgas não bloqueiam rodada</b> — Matches de folga (isSitOut) não contam como "partidas incompletas" ao encerrar rodada.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.72-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Fase de Grupos com duplas</b> — Formato Grupos + Eliminatórias agora forma duplas/times antes de distribuir nos grupos. Jogadores individuais são sorteados em times automaticamente.</p>' +
        '<p><b>Botão Voltar corrigido</b> — Botão Voltar no detalhe do torneio agora usa history.back() para retornar à tela anterior (dashboard, explorar, etc.) em vez de sempre ir ao dashboard.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.71-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Liga: folga justa e toggle ativo</b> — Jogadores que não completam grupo recebem folga com pontuação média (sem BYE/extra). Sistema distribui folgas de forma igualitária. Toggle "Participando dos sorteios" permite que o inscrito se desative temporariamente — recebe pontuação média e não entra no próximo sorteio. Histórico de folgas (sitOutHistory) garante rotação justa entre todos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.70-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Liga simplificada</b> — Configurações da Liga enxutas: removidos duração da temporada e toggle duplicado de formato de rodada. Dropdowns substituídos por botões exclusivos. Data de início sincroniza com agendamento. Datas reposicionadas após agendamento de sorteios.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.7-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Repescagem com melhor perdedor</b> — Sem BYEs: melhores perdedores de R1 jogam repescagem, vencedores + melhor perdedor (por desempenho R1) classificam. Barra de progresso conta todas as partidas do torneio. Numeracao: final = ultimo jogo. Lista de espera visivel no card com contagem separada.</p>' +
        '<p><b>Templates no Firestore</b> — Templates de torneio migrados de localStorage para Firestore (sincroniza entre dispositivos). Botao "Carregar Template" no modal de criacao quando ha templates salvos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.62-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Navegacao por grupos</b> — Botoes coloridos (A, B, C...) no cabecalho fixo do chaveamento para scroll direto ao grupo desejado em Fase de Grupos.</p>' +
        '<p><b>Painel de configuracao de grupos</b> — Ao sortear formato Fase de Grupos, painel dedicado exibe todas as distribuicoes possiveis de grupos com detalhes de classificados e fase eliminatoria.</p>' +
        '<p><b>Badge BYE elegante</b> — Partidas com BYE exibem badge compacto e sinalizado no area do placar, visivel mesmo com campo de resultado presente.</p>' +
        '<p><b>Numeracao de final/3o lugar corrigida</b> — Partidas ocultas com BYE nao contam na numeracao; final e 3o lugar sempre sequenciais apos ultima semifinal real.</p>' +
        '<p><b>Menu hamburger com header fixo</b> — Menu mobile empurra o cabecalho de voltar para baixo dinamicamente em vez de ficar oculto.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.60-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Painel dedicado de resto</b> — Quando sobram participantes que nao formam time, painel roxo exclusivo com 3 opcoes: reabrir inscricoes, lista de espera ou exclusao. Visualmente distinto do painel de potencia de 2.</p>' +
        '<p><b>Sub-escolha de remocao</b> — Organizador decide entre sorteio aleatorio ou ultimos inscritos para lista de espera/exclusao.</p>' +
        '<p><b>Tipo de jogo e inscricao independentes</b> — Trocar entre Simples/Duplas nao altera mais o modo de inscricao.</p>' +
        '<p><b>Games fixos no Personalizado</b> — Toggle para disputar N games fixos (quem vence mais ganha) em vez de melhor de N.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.59-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Sortear direto</b> — Tela intermediaria de pre-sorteio eliminada. Clicar em Sortear abre o painel de resolucao diretamente.</p>' +
        '<p><b>Inscricao individual por padrao</b> — Criacao rapida agora usa modo Individual como padrao.</p>' +
        '<p><b>Descricoes dinamicas nos presets de pontuacao</b> — As descricoes dos presets (1 Set, Melhor de 3, etc.) atualizam em tempo real conforme a configuracao.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.58-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Inscricoes encerram automaticamente</b> — Quando a data/hora limite e atingida, inscricoes sao encerradas sem input do organizador. Quando o maximo de participantes e atingido, tambem encerra automaticamente. Validacao server-side bloqueia inscricoes mesmo via convite.</p>' +
        '<p><b>CRITICO: Race condition de inscricoes corrigida</b> — Inscricoes nao somem mais. Sync do organizador nao sobrescreve participantes. Desinscricao e adicionar participante agora usam transacoes atomicas.</p>' +
        '<p><b>Formato da Partida redesenhado</b> — Presets visuais (1 Set, Melhor de 3, Melhor de 5, 4 Sets, Personalizado). Toggle de vantagem automatico por modalidade.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.50-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Tipo de Jogo com toggles</b> — "Simples" e "Duplas" agora sao toggles independentes com icones e descricoes. Ambos ligados = chaves paralelas. Sincroniza automaticamente com Modo de Inscricao.</p>' +
        '<p><b>Modo de Inscricao com toggles</b> — "Individual" e "Times Montados" como toggles independentes. Ambos ligados = aceita os dois tipos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.48-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Mesclar participantes com suporte mobile</b> — Touch drag-and-drop (long press) na lista de inscritos para mesclar duplicatas.</p>' +
        '<p><b>Lista de inscritos sempre visivel</b> — Inscritos Confirmados exibido mesmo apos o sorteio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.47-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Mesclar participantes por arrastar e soltar</b> — O organizador pode arrastar um participante sobre outro na lista de inscritos para mescla-los.</p>' +
        '<p><b>Deteccao automatica por iniciais</b> — Detecta que "C M" sao as iniciais de "Cica Mange" e corrige automaticamente.</p>' +
        '<p><b>Historico de nomes no perfil e propagacao em team strings.</b></p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.43-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Ordenação de inscritos</b> — Botões A-Z e 🕐 no cabeçalho "Inscritos Confirmados" permitem alternar entre ordem alfabética e ordem cronológica de inscrição. Funciona tanto no modo normal quanto no modo check-in.</p>' +
        '<p><b>Lista de inscritos sem duplicatas</b> — Participantes que aparecem tanto como individual quanto em time agora são exibidos uma única vez (com parceiro e adversário). Deduplicação também remove entradas de nomes antigos que já existem dentro de equipes.</p>' +
        '<p><b>Edição inline de nomes</b> — Organizadores podem clicar diretamente no nome de qualquer participante para editá-lo. Enter ou Tab confirma, Escape cancela. A alteração é propagada em todos os dados do torneio (partidas, classificação, check-in).</p>' +
        '<p><b>Propagação de nomes em times</b> — Troca de nome no perfil agora atualiza corretamente nomes dentro de equipes (ex: "C M / Ana" → "Ciça / Ana").</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.41-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Deduplicação de participantes</b> — Quando um participante troca o nome no perfil, o sistema agora detecta e remove automaticamente a entrada duplicada (nome antigo + nome novo), mantendo apenas o nome atual. Limpeza executada ao visualizar o torneio e antes do sorteio.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.40-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Inscrições bloqueadas quando encerradas</b> — Quando o organizador encerra as inscrições, ninguém mais pode se inscrever por nenhum caminho: link de convite, dashboard, +Participante, +Time. Validação adicionada em 5 pontos do código incluindo a transação do banco de dados.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.39-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Placar inline consistente</b> — Torneios com sistema Game-Set-Match agora usam campos de placar direto no card da partida (mesmo padrão dos jogos normais), em vez de botão separado que abria modal. Confirmar e Editar resultado funcionam de forma idêntica em todos os formatos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.38-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Chaveamento corrigido</b> — Renderização do bracket falhava silenciosamente por referência a variável inexistente, impedindo qualquer chaveamento de aparecer.</p>' +
        '<p><b>Repescagem: BYE automático</b> — Quando a repescagem tem número ímpar de sobreviventes, o jogador excedente agora recebe BYE e avança automaticamente, garantindo o número correto de classificados para a R2.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.31-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Repescagem real</b> — Sistema de repescagem reescrito: todos os times jogam a 1a rodada, perdedores disputam mini-chave de repescagem, e os classificados se juntam aos vencedores na 2a rodada formando potência de 2. Antes a repescagem se comportava como BYE.</p>' +
        '<p><b>W.O. na lista de presença</b> — Na lista de inscritos de torneios em andamento, o label &quot;Ausente&quot; foi substituído por &quot;W.O.&quot; nos cards individuais e no botão de filtro.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.30-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Manual corrigido</b> — Texto das notas de versão no manual não vaza mais como texto sem formatação. Aspas duplas no conteúdo quebravam o atributo de busca do HTML, fazendo o texto aparecer como bloco ilegível abaixo das seções do manual.</p>' +
        '<p><b>Coroa do organizador</b> — Ícone de coroa agora aparece corretamente ao lado direito do nome do organizador nos cards de participantes, em vez de abaixo do avatar.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.25-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Botão Clonar removido</b> — A função de clonar torneio foi substituída pelo sistema de Templates, que faz o mesmo com mais flexibilidade.</p>' +
        '<p><b>Inscritos ocultos após sorteio</b> — Na página de detalhes do torneio, a lista de inscritos e check-in não aparece mais quando o chaveamento já foi gerado. Acesse via botão 👥 Inscritos no bracket.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.24-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Nome do organizador</b> — Organizador agora exibe nome do perfil em vez do e-mail. Torneios antigos sem nome salvo resolvem automaticamente via lista de participantes.</p>' +
        '<p><b>Lista de chamada movida</b> — Banner de jogos prontos para chamar (check-in) foi removido do topo do chaveamento e movido para a página de Inscritos, acessível pelo botão 👥 Inscritos.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.23-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Painéis de decisão</b> — Botão Cancelar/Voltar agora fica em cabeçalho sticky no topo dos painéis de potência de 2, participantes restantes e sub-escolhas. Sempre visível ao rolar.</p>' +
        '<p><b>Lista de espera no dashboard</b> — Cards do dashboard agora mostram stat-box de lista de espera quando há jogadores em standby, e contagem de inscritos não inclui mais os jogadores na espera.</p>' +
        '<p><b>Barra de progresso corrigida</b> — Contagem de partidas agora inclui jogos dentro de grupos com rodadas (Rei/Rainha, Grupos + Eliminatórias).</p>' +
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
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.17-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Toggle Público/Privado</b> — Visibilidade do torneio agora usa toggle switch "Público" (padrão ativado). Desativar torna o torneio privado.</p>' +
        '<p><b>Coroa do organizador</b> — Ícone de coroa no card de detalhe reposicionado para canto inferior direito, igual ao card do dashboard.</p>' +
        '<p><b>Templates acessíveis</b> — Botão "Usar Template" agora aparece corretamente no modal de criação rápida. Corrigido MutationObserver que não detectava abertura do modal.</p>' +
        '</div>' +
        '<div style="margin-bottom:1rem;">' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-bottom:6px;">v0.8.14-alpha <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">(Abril 2026)</span></div>' +
        '<p><b>Lista de Espera visível</b> — Stat-box "Lista de Espera" agora aparece corretamente após mover participantes para espera no painel de resolução.</p>' +
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

  // Build sections HTML
  var sectionsHtml = '';
  for (var i = 0; i < helpSections.length; i++) {
    var s = helpSections[i];
    sectionsHtml += '<div class="help-section" data-help-id="' + s.id + '" data-search="' + (s.title + ' ' + s.content).replace(/<[^>]+>/g, '').toLowerCase().replace(/"/g, '&quot;') + '" style="margin-bottom: 1rem;">' +
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
      // Sticky header — Voltar pill (tournament-details style) stays pinned while body scrolls.
      '<div style="position:sticky; top:0; z-index:2; background:var(--bg-card, var(--bg-darker)); padding:12px 1.5rem 10px; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px;">' +
          '<button class="btn btn-outline btn-sm hover-lift" onclick="if(typeof closeModal===\'function\')closeModal(\'modal-help\');" style="display:inline-flex; align-items:center; gap:6px; padding:6px 16px; border-radius:20px;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
            ' Voltar' +
          '</button>' +
          '<h2 style="margin:0; font-size:1rem; font-weight:800; color:var(--text-bright);">Central de Ajuda</h2>' +
          '<button onclick="if(typeof closeModal===\'function\')closeModal(\'modal-help\');" aria-label="Fechar" style="background:none;border:none;color:var(--text-muted,#94a3b8);font-size:1.5rem;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>' +
        '</div>' +
        '<input type="text" id="help-search-input" placeholder="Buscar no manual..." style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid var(--border-color); background:var(--bg-darker); color:var(--text-color); font-size:0.85rem; outline:none;" oninput="window._filterHelpSections(this.value)">' +
      '</div>' +
      '<div id="help-sections-container" style="padding:1.25rem 1.5rem 1.5rem; overflow-y:auto; flex:1;">' +
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
      <div class="modal" style="max-width:420px;">
        <div class="modal-voltar-bar" style="position:sticky;top:0;z-index:11;background:var(--bg-dark);padding:12px 1.5rem 10px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;">
          <button class="btn btn-outline btn-sm hover-lift" onclick="if(typeof closeModal==='function')closeModal('modal-quick-create');" style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;flex-shrink:0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            ${(window._t || function(k){return k;})('btn.back') || 'Voltar'}
          </button>
        </div>
        <div style="padding:1.5rem 2rem 2rem;">
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
          <button class="btn btn-tool-amber btn-block" id="btn-quick-template">
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
    const qcTeamSize = _qcSportTeamDefaults[sportClean] || 1;

    const tourData = {
      id: 'tour_' + Date.now(),
      name: autoName,
      sport: sportRaw,
      format: 'Eliminatórias Simples',
      isPublic: true,
      enrollmentMode: 'individual',
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
      showNotification(window._t ? window._t('quickCreate.created') : 'Torneio Criado!', autoName, 'success');
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
    if (title) title.innerText = _t('create.newTournament');
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
    if (typeof window._refreshTemplateBtn === 'function') window._refreshTemplateBtn();
    // Ensure GSM summary renders after modal is visible
    setTimeout(function() {
      if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
      if (typeof window._initPlacesAutocomplete === 'function') window._initPlacesAutocomplete();
      if (typeof window._autoShowVenueMap === 'function') window._autoShowVenueMap();
    }, 100);
  });

  // ─── Template Integration ────────────────────────────────────────────────
  // "Usar Template" button handler (always visible, loads on demand)
  document.getElementById('btn-quick-template').addEventListener('click', function() {
    var area = document.getElementById('qc-template-area');
    if (!area) return;
    var templates = typeof window._getTemplates === 'function' ? window._getTemplates() : [];
    var _t = window._t || function(k) { return k; };
    if (templates.length === 0) {
      area.style.display = 'block';
      area.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;">Nenhum template salvo. Salve um a partir de um torneio existente (Ferramentas do Organizador → Salvar como Template).</p>';
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
        '<button class="btn btn-micro btn-danger-ghost" onclick="event.stopPropagation();window._qcDeleteTemplate(\'' + window._safeHtml(tpl._id || String(i)) + '\')" title="Apagar">✕</button>' +
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
    if (title) title.innerText = _t('create.newFromTemplate');
    var pub = document.getElementById('tourn-public');
    if (pub) pub.checked = true;

    // Pre-fill from template
    if (typeof window._prefillFromTemplate === 'function') {
      window._prefillFromTemplate(tpl);
    }
    if (typeof openModal === 'function') openModal('modal-create-tournament');
    if (typeof window._refreshTemplateBtn === 'function') window._refreshTemplateBtn();
    setTimeout(function() {
      if (typeof window._updateGSMSummaryFromHidden === 'function') window._updateGSMSummaryFromHidden();
      if (typeof window._initPlacesAutocomplete === 'function') window._initPlacesAutocomplete();
      if (typeof window._autoShowVenueMap === 'function') window._autoShowVenueMap();
    }, 100);
  };

  window._qcDeleteTemplate = async function(templateId) {
    if (typeof window._deleteTemplate === 'function') await window._deleteTemplate(templateId);
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
