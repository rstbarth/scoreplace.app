function renderDashboard(container) {
  const visible = window.AppStore.getVisibleTournaments();

  // Filtros Básicos
  const torneiosCount = visible.length;
  const torneiosPublicos = visible.filter(t => t.isPublic).length;
  const inscricoesAbertas = visible.filter(t => {
    const sorteioRealizado = t.status === 'active' && (t.matches || t.rounds || t.groups);
    const ligaAberta = t.format === 'Liga' && t.ligaOpenEnrollment !== false && sorteioRealizado;
    return (t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date())) || ligaAberta;
  }).length;


  // Filtros de Relacionamento (Dono / Participante)
  const organizados = window.AppStore.getMyOrganized();
  const participacoes = window.AppStore.getMyParticipations();
  const organizadosCount = organizados.length;
  const participacoesCount = participacoes.length;

  const sortByDate = (a, b) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const timeB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return timeA - timeB;
  };

  const participacoesSorted = [...participacoes].sort(sortByDate);
  const organizadosSorted = [...organizados].sort(sortByDate);

  const abertosParaVoce = visible.filter(t => {
    const isOrg = organizados.some(org => org.id === t.id);
    const isPart = participacoes.some(pt => pt.id === t.id);
    if (isOrg || isPart) return false;
    const isAberto = t.status !== 'closed' && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date());
    return isAberto;
  }).sort(sortByDate);

  const cleanSportName = (sport) => sport ? sport.replace(/^[^\w\u00C0-\u024F]+/u, '').trim() : '';
  const getSportIcon = (sport) => {
    if (!sport) return '🏅';
    const s = sport.toLowerCase();
    if (s.includes('futebol') || s.includes('society') || s.includes('futsal')) return '⚽';
    if (s.includes('vôlei') || s.includes('volei')) return '🏐';
    if (s.includes('basquete')) return '🏀';
    if (s.includes('tênis de mesa') || s.includes('ping')) return '🏓';
    if (s.includes('tênis') || s.includes('tennis') || s.includes('padel')) return '🎾';
    if (s.includes('xadrez')) return '♟️';
    if (s.includes('magic') || s.includes('tcg') || s.includes('card')) return '🃏';
    if (s.includes('esports') || s.includes('game')) return '🎮';
    if (s.includes('kart') || s.includes('corrida')) return '🏎️';
    if (s.includes('luta') || s.includes('boxe')) return '🥊';
    return '🏅';
  };

  const renderTournamentCard = (t, type) => {
    const publicText = t.isPublic ? 'Público' : 'Privado';

    const formatDateBr = (dStr) => {
      if (!dStr) return '';
      try {
        const datePart = dStr.includes('T') ? dStr.split('T')[0] : dStr;
        const timePart = dStr.includes('T') ? dStr.split('T')[1] : '';
        const [y, m, d] = datePart.split('-');
        if (y && m && d) {
          let result = d + '/' + m + '/' + y;
          if (timePart) result += ' ' + timePart.substring(0, 5);
          return result;
        }
      } catch (e) { }
      return dStr;
    };

    const start = formatDateBr(t.startDate);
    const end = formatDateBr(t.endDate);
    const dates = start ? (end ? `${start} A ${end}` : `${start}`) : 'A DEFINIR';
    const regLimit = formatDateBr(t.registrationLimit);
    const cats = (t.categories && t.categories.length) ? t.categories.join(', ') : 'Cat. Única';

    // Inscrições fecham após sorteio (status 'active'), exceto Liga com inscrições abertas na temporada
    const sorteioRealizado = t.status === 'active' && (t.matches || t.rounds || t.groups);
    const ligaAberta = t.format === 'Liga' && t.ligaOpenEnrollment !== false && sorteioRealizado;
    const isAberto = t.status !== 'closed' && !sorteioRealizado && (!t.registrationLimit || new Date(t.registrationLimit) >= new Date()) || ligaAberta;
    const statusText = isAberto ? 'Inscrições Abertas' : (sorteioRealizado ? 'Em Andamento' : 'Inscrições Encerradas');
    const statusBg = isAberto ? '#fbbf24' : (sorteioRealizado ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)');
    const statusColor = isAberto ? '#78350f' : (sorteioRealizado ? '#34d399' : '#fca5a5');
    const statusFontWeight = isAberto ? '700' : '600';

    let enrollmentText = 'Misto (Individual e Times)';
    if (t.enrollmentMode === 'individual') enrollmentText = 'Individual';
    else if (t.enrollmentMode === 'time') enrollmentText = 'Apenas Times';
    else if (t.enrollmentMode === 'misto') enrollmentText = 'Misto (Individual e Times)';

    const isOrg = window.AppStore.currentUser && t.organizerEmail === window.AppStore.currentUser.email;

    let isParticipating = false;
    if (t.participants && window.AppStore.currentUser) {
      const user = window.AppStore.currentUser;
      const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
      isParticipating = arr.some(p => {
        const str = typeof p === 'string' ? p : (p.email || p.displayName);
        return str && (str.includes(user.email) || str.includes(user.displayName));
      });
    }

    let bgGradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
    if (isParticipating) bgGradient = 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)';
    else if (isOrg) bgGradient = 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)';

    // Venue photo background
    let venuePhotoBg = '';
    if (t.venuePhotoUrl) {
      var overlayGrad = isOrg
        ? 'linear-gradient(135deg, rgba(67,56,202,0.85) 0%, rgba(99,102,241,0.8) 100%)'
        : isParticipating
          ? 'linear-gradient(135deg, rgba(15,118,110,0.85) 0%, rgba(20,184,166,0.8) 100%)'
          : 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.8) 100%)';
      venuePhotoBg = 'background-image: ' + overlayGrad + ', url(' + t.venuePhotoUrl + '); background-size: cover; background-position: center;';
    }

    let individualCount = 0;
    let teamCount = 0;
    if (t.participants) {
      const arr = Array.isArray(t.participants) ? t.participants : Object.values(t.participants);
      arr.forEach(p => {
        const pStr = typeof p === 'string' ? p : (p.displayName || p.name || p.email || '');
        if (pStr.includes('/')) {
          teamCount++;
          individualCount += pStr.split('/').filter(n => n.trim().length > 0).length;
        } else {
          individualCount++;
        }
      });
    }

    let participandoText = '';
    if (isParticipating) {
      participandoText = `<div style="margin-top: 1rem; text-align: right; font-weight: 700; color: #fef08a; font-size: 0.85rem; text-transform: uppercase;">Inscrito ✓</div>`;
    }

    return `
        <div class="card mb-3" style="position: relative; overflow: hidden; ${venuePhotoBg ? venuePhotoBg : 'background: ' + bgGradient + ';'} color: white; border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='#tournaments/${t.id}'" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'">
          ${(isParticipating && isOrg) ? `
             <div style="position: absolute; bottom: 0; right: 0; width: 36px; height: 36px; overflow: hidden; display: flex; align-items: flex-end; justify-content: flex-end;" title="Você é o Organizador e também está Inscrito">
               <svg viewBox="0 0 36 36" width="36" height="36" style="display: block;">
                 <path d="M0 36 L36 0 L36 36 Z" fill="rgba(251, 191, 36, 0.95)" />
               </svg>
             </div>
          ` : ''}
          <div class="card-body p-4">
            
            <!-- Top Row: Icon/Modality | Status -->
            <div class="d-flex justify-between" style="align-items: flex-start; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
               <div style="display: flex; align-items: center; gap: 6px; opacity: 0.65; margin-top: 2px;">
                  <span style="font-size: 1.1rem;">${getSportIcon(t.sport)}</span>
                  <span>${cleanSportName(t.sport) || 'Esporte'}</span>
               </div>
               <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                  <div style="color: ${statusColor}; background: ${statusBg}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: ${statusFontWeight}; opacity: 1;">
                     ${statusText}
                  </div>
                  <div style="font-size: 0.7rem; opacity: 0.8; font-weight: 600; text-transform: none; letter-spacing: 0;">Inscrição: ${enrollmentText}</div>
               </div>
            </div>

            <!-- Middle Left: Nome -->
            <h4 style="margin: 1.8rem 0 1.5rem 0; font-size: 1.8rem; font-weight: 800; color: white; line-height: 1.2; text-align: left;">
              ${t.name}
            </h4>

            <!-- Below Name: Calendário + Data -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500; opacity: 0.7;">
               <span style="font-size: 1.1rem;">🗓️</span>
               <span>${dates}</span>
            </div>

            <!-- Linha separadora -->
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1.8rem 0;"></div>

            <!-- Bottom Section -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center; opacity: 0.75;">
               
               <!-- Stats Column -->
               <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap;">
                   <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px;">
                      <div style="display: flex; align-items: center; gap: 4px;">
                         <span style="font-size: 1.1rem;">👤</span>
                         <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${individualCount}</span>
                      </div>
                      <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">Inscritos</span>
                   </div>
                   ${(teamCount > 0 && t.enrollmentMode !== 'individual') ? `
                   <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 12px; min-width: 100px;">
                      <div style="display: flex; align-items: center; gap: 4px;">
                         <span style="font-size: 1.1rem;">👥</span>
                         <span style="font-size: 1.4rem; font-weight: 800; line-height: 1; opacity: 0.95;">${teamCount}</span>
                      </div>
                      <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; opacity: 0.8;">Equipes</span>
                   </div>
                   ` : ''}
               </div>

               <!-- Formato, Regras e Categorias -->
               <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem;">
                  <div><strong>Formato:</strong> ${t.format}</div>
                  <div><strong>Acesso:</strong> ${publicText}</div>
                  <div><strong>Categorias:</strong> ${cats}</div>
               </div>
            </div>

            ${participandoText}

          </div>
        </div>
      `;
  };

  // Grupo 1: torneios que o usuário organiza OU participa (sem duplicata), ordem cronológica
  const seenIds = new Set();
  const meus = [];
  [...organizadosSorted, ...participacoesSorted].forEach(t => {
    if (!seenIds.has(t.id)) {
      seenIds.add(t.id);
      meus.push(t);
    }
  });
  meus.sort(sortByDate);

  // Grupo 2: abertos para se inscrever (já excluem org e participante por definição)
  const abertos = abertosParaVoce; // já ordenado por sortByDate

  let listsHtml = '';
  if (meus.length > 0 || abertos.length > 0) {
    const meusHtml = meus.map(t => renderTournamentCard(t, t.type)).join('');
    const abertosHtml = abertos.map(t => renderTournamentCard(t, 'aberto')).join('');

    listsHtml = `<div class="dashboard-list" style="margin-bottom: 2rem;">
        <div class="cards-grid">
          ${meusHtml}
          ${abertosHtml}
        </div>
      </div>`;
  }


  const userName = window.AppStore.currentUser ? window.AppStore.currentUser.displayName.split(' ')[0] : 'Visitante';

  const html = `
    <!-- Header Hero Box com Degrade Simples e Elegante -->
    <div class="mb-4 hero-box" style="
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        border-radius: 24px;
        padding: 2.5rem 2rem;
        color: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        filter: saturate(0.9) brightness(0.95);
        position: relative;
    ">
      
      <!-- Botão Canto Direito Superipr -->
      <button class="btn hover-lift btn-create-hero" id="btn-create-tournament-in-box" style="background: #1e40af; color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); padding: 0.6rem 1.2rem; cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: all 0.2s ease;" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='#1e40af'" onclick="if(typeof openModal==='function')openModal('modal-quick-create');">
        + Novo Torneio
      </button>

      <div style="margin-bottom: 2.5rem; display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
        <h2 style="margin:0; font-size: 2.2rem; font-weight: 700;">
          Olá, ${userName}
      </h2>
        <p style="margin: 0.5rem 0 0 0; opacity: 0.85; font-size: 1.1rem;">Gerencie seus torneios e partidas esportivas</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
        
        <!-- Card 1: Meus Torneios -->
        <div style="background: rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 1.5rem 1rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" onclick="document.querySelector('.dashboard-list') && document.querySelector('.dashboard-list').scrollIntoView({behavior:'smooth'})" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
          <div style="font-size: 2rem; margin-bottom: 0.25rem;">🏆</div>
          <span style="font-size: 2.5rem; font-weight: 700; line-height: 1;">${organizadosCount}</span>
          <h3 style="margin: 0.5rem 0 0 0; font-size: 1rem; font-weight: 600; opacity: 0.9;">Meus Torneios</h3>
        </div>

        <!-- Card 2: Participando -->
        <div style="background: rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 1.5rem 1rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" onclick="document.querySelector('.dashboard-list') && document.querySelector('.dashboard-list').scrollIntoView({behavior:'smooth'})" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
          <div style="font-size: 2rem; margin-bottom: 0.25rem;">👤</div>
          <span style="font-size: 2.5rem; font-weight: 700; line-height: 1;">${participacoesCount}</span>
          <h3 style="margin: 0.5rem 0 0 0; font-size: 1rem; font-weight: 600; opacity: 0.9;">Participando</h3>
        </div>

        <!-- Card 3: Inscrições Abertas -->
        <div style="background: rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 1.5rem 1rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" onclick="document.querySelector('.dashboard-list') && document.querySelector('.dashboard-list').scrollIntoView({behavior:'smooth'})" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
          <div style="font-size: 2rem; margin-bottom: 0.25rem;">🗓️</div>
          <span style="font-size: 2.5rem; font-weight: 700; line-height: 1;">${inscricoesAbertas}</span>
          <h3 style="margin: 0.5rem 0 0 0; font-size: 1rem; font-weight: 600; opacity: 0.9;">Inscrições Abertas</h3>
        </div>

      </div>
    </div>
    
    ${listsHtml}
  `;
  container.innerHTML = html;
}
