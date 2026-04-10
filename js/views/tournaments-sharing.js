// ── Sharing & Export Functions ──

// Copy tournament link to clipboard (with native share fallback on mobile)
window._shareTournament = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t) return;
    var url = window._tournamentUrl(t.id);
    var title = t.name;
    var text = '\uD83C\uDFC6 ' + t.name + ' — scoreplace.app';
    // Try native share API first (mobile)
    if (navigator.share) {
        navigator.share({ title: title, text: text, url: url }).catch(function() {
            // Fallback to clipboard
            navigator.clipboard.writeText(url).then(function() {
                if (typeof showNotification === 'function') showNotification('Copiado!', 'Link do torneio copiado.', 'success');
            });
        });
    } else {
        navigator.clipboard.writeText(url).then(function() {
            if (typeof showNotification === 'function') showNotification('Copiado!', 'Link do torneio copiado.', 'success');
        }).catch(function() {
            // Very old browser fallback
            var inp = document.createElement('input');
            inp.value = url;
            document.body.appendChild(inp);
            inp.select();
            document.execCommand('copy');
            document.body.removeChild(inp);
            if (typeof showNotification === 'function') showNotification('Copiado!', 'Link do torneio copiado.', 'success');
        });
    }
};

// Show QR Code modal for a tournament link
window._showQRCode = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t) return;
    var url = window._tournamentUrl(t.id);
    var qrImageUrl = window._qrCodeUrl(url, 280, true);
    var qrImageUrlLight = window._qrCodeUrl(url, 280, false);
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var safeN = window._safeHtml(t.name);

    // Remove previous QR modal if any
    var prev = document.getElementById('qr-modal-overlay');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'qr-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;animation:fadeIn 0.2s ease;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--card-bg,#1e2235);border-radius:20px;padding:2rem;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;';

    modal.innerHTML = '' +
      '<button onclick="document.getElementById(\'qr-modal-overlay\').remove()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:1.8rem;cursor:pointer;line-height:1;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>' +
      '<h3 style="margin:0 0 0.5rem;font-size:1.2rem;color:var(--text-bright,#fff);">QR Code do Torneio</h3>' +
      '<p style="margin:0 0 1rem;font-size:0.85rem;color:var(--text-muted,#94a3b8);word-break:break-all;">' + safeN + '</p>' +
      '<div style="background:' + (isLight ? '#ffffff' : '#1a1e2e') + ';border-radius:16px;padding:16px;display:inline-block;margin-bottom:1rem;">' +
        '<img id="qr-code-img" src="' + (isLight ? qrImageUrlLight : qrImageUrl) + '" alt="QR Code" style="width:280px;height:280px;border-radius:8px;" onerror="this.parentElement.innerHTML=\'<p style=color:#ef4444;font-size:0.85rem;>Erro ao gerar QR Code. Verifique sua conexão.</p>\'">' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button onclick="navigator.clipboard.writeText(\'' + url.replace(/'/g, "\\'") + '\').then(function(){if(typeof showNotification===\'function\')showNotification(\'Copiado!\',\'Link copiado.\',\'success\');})" class="btn btn-sm hover-lift" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">📋 Copiar Link</button>' +
        '<button onclick="window._downloadQRCode(\'' + t.id + '\')" class="btn btn-sm hover-lift" style="background:rgba(16,185,129,0.15);color:#4ade80;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">💾 Baixar QR</button>' +
        '<button onclick="window._printQRCode()" class="btn btn-sm hover-lift" style="background:rgba(139,92,246,0.15);color:#c4b5fd;border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">🖨️ Imprimir</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ESC to close
    var _escHandler = function(e) {
        if (e.key === 'Escape') {
            var el = document.getElementById('qr-modal-overlay');
            if (el) el.remove();
            document.removeEventListener('keydown', _escHandler);
        }
    };
    document.addEventListener('keydown', _escHandler);
};

// Download QR code image
window._downloadQRCode = function(tournamentId) {
    var img = document.getElementById('qr-code-img');
    if (!img) return;
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    var name = t ? (t.name || 'torneio').replace(/[^a-zA-Z0-9À-ü\s-]/g, '').replace(/\s+/g, '_') : 'torneio';
    // Fetch the image and download it
    fetch(img.src).then(function(resp) { return resp.blob(); }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'QRCode_' + name + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof showNotification === 'function') showNotification('QR Code Salvo!', 'Imagem baixada.', 'success');
    }).catch(function() {
        if (typeof showNotification === 'function') showNotification('Erro', 'Não foi possível baixar o QR Code.', 'error');
    });
};

// Print QR Code
window._printQRCode = function() {
    var img = document.getElementById('qr-code-img');
    if (!img) return;
    var win = window.open('', '_blank');
    win.document.write('<html><head><title>QR Code - scoreplace.app</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;"><div style="text-align:center;"><h2 style="font-family:sans-serif;color:#333;">scoreplace.app</h2><img src="' + img.src.replace(/bgcolor=[^&]+/, 'bgcolor=ffffff').replace(/color=[^&]+/, 'color=1a1e2e') + '" style="width:400px;height:400px;"><p style="font-family:sans-serif;color:#666;font-size:14px;margin-top:1rem;">Escaneie para acessar o torneio</p></div></body></html>');
    win.document.close();
    win.onload = function() { win.print(); };
};

// Export tournament results as CSV file
window._exportTournamentCSV = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t) return;
    var rows = [];
    var hasStandings = false;
    var isLiga = window._isLigaFormat ? window._isLigaFormat(t) : false;
    var isSuico = t.format === 'Suíço Clássico';

    // For Liga/Suíço: export standings
    if (isLiga || isSuico) {
        var categories = (t.combinedCategories && t.combinedCategories.length) ? t.combinedCategories : ['default'];
        categories.forEach(function(cat) {
            var computed = typeof window._computeStandings === 'function' ? window._computeStandings(t, cat === 'default' ? undefined : cat) : [];
            if (computed.length === 0) return;
            hasStandings = true;
            if (cat !== 'default') rows.push(['--- Categoria: ' + cat + ' ---']);
            rows.push(['Posição', 'Participante', 'Pontos', 'Vitórias', 'Empates', 'Derrotas', 'Saldo', 'Jogos']);
            computed.forEach(function(s, i) {
                rows.push([i + 1, s.name, s.points, s.wins, s.draws || 0, s.losses, s.pointsDiff, s.played]);
            });
            rows.push([]); // blank line between categories
        });
    }

    // For elimination formats: export match results
    if (!hasStandings) {
        rows.push(['Partida', 'Jogador 1', 'Jogador 2', 'Placar 1', 'Placar 2', 'Vencedor', 'Rodada/Fase']);
        var allMatches = [];
        if (Array.isArray(t.matches)) {
            t.matches.forEach(function(m, idx) {
                allMatches.push({ m: m, label: m.round || m.label || ('Partida ' + (idx + 1)) });
            });
        }
        if (Array.isArray(t.groups)) {
            t.groups.forEach(function(g, gi) {
                (g.matches || []).forEach(function(m, mi) {
                    allMatches.push({ m: m, label: 'Grupo ' + (gi + 1) + ' - Partida ' + (mi + 1) });
                });
            });
        }
        if (t.thirdPlaceMatch) {
            allMatches.push({ m: t.thirdPlaceMatch, label: 'Disputa 3º lugar' });
        }
        var matchNum = 0;
        allMatches.forEach(function(item) {
            var m = item.m;
            if (!m.p1 && !m.p2) return;
            matchNum++;
            rows.push([
                matchNum,
                m.p1 || 'TBD',
                m.p2 || 'TBD',
                m.scoreP1 !== undefined && m.scoreP1 !== null ? m.scoreP1 : '',
                m.scoreP2 !== undefined && m.scoreP2 !== null ? m.scoreP2 : '',
                m.winner || '',
                item.label
            ]);
        });
    }

    if (rows.length === 0) {
        if (typeof showNotification === 'function') showNotification('Exportar', 'Nenhum resultado para exportar.', 'warning');
        return;
    }

    // Add header with tournament info — horizontal layout for landscape viewing
    var header = [
        ['Torneio', 'Formato', 'Esporte', 'Data', 'Local', 'Inscritos', 'Exportado em'],
        [t.name, t.format || '', t.sport || '', t.startDate || '', t.venue || '', (typeof window._getCompetitors === 'function' ? window._getCompetitors(t).length : (Array.isArray(t.participants) ? t.participants.length : 0)), new Date().toLocaleString('pt-BR')],
        []
    ];
    rows = header.concat(rows);

    // Generate CSV
    var csvContent = rows.map(function(row) {
        return row.map(function(cell) {
            var str = String(cell === undefined || cell === null ? '' : cell);
            // Escape quotes and wrap in quotes if contains comma/quote/newline
            if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }).join(',');
    }).join('\n');

    // Add BOM for UTF-8 support in Excel
    var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (t.name || 'torneio').replace(/[^a-zA-Z0-9À-ü\s-]/g, '').replace(/\s+/g, '_') + '_resultados.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showNotification === 'function') showNotification('Exportado!', 'Arquivo CSV baixado.', 'success');
};
