// ── Sharing & Export Functions ──
var _t = window._t || function(k) { return k; };

// Copy tournament link to clipboard (with native share fallback on mobile)
window._shareTournament = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t) return;
    var url = window._tournamentUrl(t.id);
    // Append ref=UID so the recipient auto-friends the sharer
    var cu = window.AppStore.currentUser;
    if (cu && (cu.uid || cu.email)) {
        url += '?ref=' + encodeURIComponent(cu.uid || cu.email);
    }
    var title = t.name;
    var text = '\uD83C\uDFC6 ' + t.name + ' — scoreplace.app';
    // Try native share API first (mobile)
    if (navigator.share) {
        navigator.share({ title: title, text: text, url: url }).catch(function() {
            // Fallback to clipboard
            navigator.clipboard.writeText(url).then(function() {
                if (typeof showNotification === 'function') showNotification(_t('share.copied'), _t('share.copiedMsg'), 'success');
            });
        });
    } else {
        navigator.clipboard.writeText(url).then(function() {
            if (typeof showNotification === 'function') showNotification(_t('share.copied'), _t('share.copiedMsg'), 'success');
        }).catch(function() {
            // Very old browser fallback
            var inp = document.createElement('input');
            inp.value = url;
            document.body.appendChild(inp);
            inp.select();
            document.execCommand('copy');
            document.body.removeChild(inp);
            if (typeof showNotification === 'function') showNotification(_t('share.copied'), _t('share.copiedMsg'), 'success');
        });
    }
};

// Show QR Code modal inviting people to the app (no tournament/casual match attached)
window._showAppInviteQR = function() {
    var baseUrl = window.SCOREPLACE_URL || 'https://scoreplace.app';
    var url = baseUrl;
    var cu = window.AppStore && window.AppStore.currentUser;
    if (cu && (cu.uid || cu.email)) {
        url += '/?ref=' + encodeURIComponent(cu.uid || cu.email);
    }
    var qrImageUrl = window._qrCodeUrl(url, 280, true);
    var qrImageUrlLight = window._qrCodeUrl(url, 280, false);
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';

    var prev = document.getElementById('qr-modal-overlay');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'qr-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;animation:fadeIn 0.2s ease;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--card-bg,#1e2235);border-radius:20px;padding:2rem;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;';

    var title = (_t && _t('invite.appQrTitle')) || 'Convidar para o scoreplace.app';
    var desc = (_t && _t('invite.appQrDesc')) || 'Escaneie o QR code para entrar no app';
    var copyLabel = (_t && _t('invite.copyLink')) || 'Copiar Link';
    var dlLabel = (_t && _t('invite.downloadQr')) || 'Baixar QR';
    var printLabel = (_t && _t('invite.printQr')) || 'Imprimir';

    modal.innerHTML = '' +
      '<button onclick="document.getElementById(\'qr-modal-overlay\').remove()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:1.8rem;cursor:pointer;line-height:1;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>' +
      '<h3 style="margin:0 0 0.5rem;font-size:1.2rem;color:var(--text-bright,#fff);">📱 ' + window._safeHtml(title) + '</h3>' +
      '<p style="margin:0 0 1rem;font-size:0.85rem;color:var(--text-muted,#94a3b8);">' + window._safeHtml(desc) + '</p>' +
      '<div style="background:' + (isLight ? '#ffffff' : '#1a1e2e') + ';border-radius:16px;padding:16px;display:inline-block;margin-bottom:1rem;">' +
        '<img id="qr-code-img" src="' + (isLight ? qrImageUrlLight : qrImageUrl) + '" alt="QR Code" style="width:280px;height:280px;border-radius:8px;" onerror="this.parentElement.innerHTML=\'<p style=color:#ef4444;font-size:0.85rem;>Erro ao gerar QR Code. Verifique sua conexão.</p>\'">' +
      '</div>' +
      '<p style="margin:0 0 1rem;font-size:0.78rem;color:var(--text-muted,#94a3b8);word-break:break-all;">' + window._safeHtml(url) + '</p>' +
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button onclick="navigator.clipboard.writeText(\'' + url.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\').then(function(){if(typeof showNotification===\'function\')showNotification(window._t(\'share.copied\'),window._t(\'share.copiedLinkMsg\'),\'success\');})" class="btn btn-sm hover-lift" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">📋 ' + window._safeHtml(copyLabel) + '</button>' +
        '<button onclick="window._downloadAppInviteQR()" class="btn btn-sm hover-lift" style="background:rgba(16,185,129,0.15);color:#4ade80;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">💾 ' + window._safeHtml(dlLabel) + '</button>' +
        '<button onclick="window._printQRCode()" class="btn btn-sm hover-lift" style="background:rgba(139,92,246,0.15);color:#c4b5fd;border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">🖨️ ' + window._safeHtml(printLabel) + '</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var _escHandler = function(e) {
        if (e.key === 'Escape') {
            var el = document.getElementById('qr-modal-overlay');
            if (el) el.remove();
            document.removeEventListener('keydown', _escHandler);
        }
    };
    document.addEventListener('keydown', _escHandler);
};

window._downloadAppInviteQR = function() {
    var img = document.getElementById('qr-code-img');
    if (!img) return;
    fetch(img.src).then(function(resp) { return resp.blob(); }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'scoreplace-app-invite.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof showNotification === 'function') showNotification(_t('share.qrSaved'), _t('share.qrSavedMsg'), 'success');
    }).catch(function() {
        if (typeof showNotification === 'function') showNotification(_t('auth.error'), _t('share.qrError'), 'error');
    });
};

// Show QR Code modal for a tournament link
window._showQRCode = function(tournamentId) {
    var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
    if (!t) return;
    var url = window._tournamentUrl(t.id);
    // Append ref=UID so the recipient auto-friends the sharer
    var cu = window.AppStore.currentUser;
    if (cu && (cu.uid || cu.email)) {
        url += '?ref=' + encodeURIComponent(cu.uid || cu.email);
    }
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
        '<button onclick="navigator.clipboard.writeText(\'' + url.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\').then(function(){if(typeof showNotification===\'function\')showNotification(window._t(\'share.copied\'),window._t(\'share.copiedLinkMsg\'),\'success\');})" class="btn btn-sm hover-lift" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:500;cursor:pointer;">📋 Copiar Link</button>' +
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
        if (typeof showNotification === 'function') showNotification(_t('share.qrSaved'), _t('share.qrSavedMsg'), 'success');
    }).catch(function() {
        if (typeof showNotification === 'function') showNotification(_t('auth.error'), _t('share.qrError'), 'error');
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
    var isSuico = t.format === 'Suíço Clássico' || t.classifyFormat === 'swiss' || t.currentStage === 'swiss';

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
        // Prefer canonical adapter so labels match bracket headers ("Final",
        // "Semifinais", "Grupo A", "Disputa 3º lugar") across all formats.
        var _unified = (typeof window._getUnifiedRounds === 'function') ? window._getUnifiedRounds(t) : null;
        var _hasUnified = _unified && Array.isArray(_unified.columns) && _unified.columns.length > 0;
        if (_hasUnified) {
            _unified.columns.forEach(function(c) {
                // CSV export includes completed rounds — only skip swiss recap
                // (swiss-past is already reflected in standings for swiss/liga).
                if (!c || c.phase === 'swiss-past') return;
                if (c.phase === 'thirdplace') {
                    (c.matches || []).forEach(function(m) {
                        allMatches.push({ m: m, label: 'Disputa 3º lugar' });
                    });
                    return;
                }
                if ((c.phase === 'groups' || c.phase === 'monarch') && Array.isArray(c.subgroups)) {
                    c.subgroups.forEach(function(sg, gi) {
                        var gname = (sg && sg.name) || String.fromCharCode(65 + gi);
                        (sg && sg.matches || []).forEach(function(m, mi) {
                            allMatches.push({ m: m, label: 'Grupo ' + gname + ' - Partida ' + (mi + 1) });
                        });
                    });
                    return;
                }
                var lbl = c.label || ('Rodada ' + c.round);
                (c.matches || []).forEach(function(m) {
                    allMatches.push({ m: m, label: lbl });
                });
            });
        } else {
            // Defensive fallback: legacy scan across all shapes.
            if (Array.isArray(t.matches)) {
                t.matches.forEach(function(m, idx) {
                    allMatches.push({ m: m, label: m.round || m.label || ('Partida ' + (idx + 1)) });
                });
            }
            if (Array.isArray(t.rounds)) {
                t.rounds.forEach(function(r, ri) {
                    (r.matches || []).forEach(function(m, mi) {
                        allMatches.push({ m: m, label: 'Rodada ' + (ri + 1) });
                    });
                });
            }
            if (Array.isArray(t.groups)) {
                t.groups.forEach(function(g, gi) {
                    (g.matches || []).forEach(function(m, mi) {
                        allMatches.push({ m: m, label: 'Grupo ' + (gi + 1) + ' - Partida ' + (mi + 1) });
                    });
                });
            }
            if (Array.isArray(t.rodadas)) {
                t.rodadas.forEach(function(rd, ri) {
                    (rd.matches || []).concat(rd.jogos || []).forEach(function(m) {
                        allMatches.push({ m: m, label: 'Rodada ' + (ri + 1) });
                    });
                });
            }
            if (t.thirdPlaceMatch) {
                allMatches.push({ m: t.thirdPlaceMatch, label: 'Disputa 3º lugar' });
            }
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
        if (typeof showNotification === 'function') showNotification(_t('share.noResults'), _t('share.noResultsMsg'), 'warning');
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
    if (typeof showNotification === 'function') showNotification(_t('share.exported'), _t('share.exportedMsg'), 'success');
};

// ─── Calendar export (Google Calendar URL + .ics download) ──────────────────
// Permite qualquer usuário (organizador, participante ou visitante logado)
// adicionar o torneio à agenda em 2 cliques. Evita que o usuário precise
// copiar data/hora/local manualmente — reduz fricção de "vou me esquecer".
//
// Estratégia: picker com 3 opções (Google Calendar, Apple/Outlook via .ics,
// Outlook Web). Evita o pior caso — browser sem detecção de default calendar.

// Formata Date como ICS UTC: YYYYMMDDTHHMMSSZ
function _icsFormatDate(d) {
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z';
}

// Escapa caracteres especiais do formato iCalendar: vírgula, ponto-e-vírgula,
// barra invertida, quebra de linha. RFC 5545 §3.3.11.
function _icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function _tournamentCalendarPayload(t) {
  // Resolve start/end. Se endDate ausente, assume startDate + 4h (ball-park).
  var startRaw = t.startDate;
  var endRaw = t.endDate;
  if (!startRaw) return null;
  var start = new Date(startRaw);
  if (isNaN(start.getTime())) return null;
  var end = endRaw ? new Date(endRaw) : null;
  if (!end || isNaN(end.getTime())) {
    end = new Date(start.getTime() + 4 * 3600 * 1000);
  }
  // Se o usuário não deu hora explícita (só data), startRaw é "2026-04-25"
  // sem T; nesse caso o Date vira meia-noite UTC. Pra não virar evento
  // cruzando dias por fuso, setamos 09:00 local como default.
  if (startRaw && startRaw.indexOf('T') === -1) {
    start = new Date(startRaw + 'T09:00:00');
    end = new Date(start.getTime() + 4 * 3600 * 1000);
  }
  var title = '🏆 ' + (t.name || 'Torneio');
  var sport = t.sport ? window._safeHtml(t.sport) : '';
  var format = t.format || '';
  var venue = t.venue || t.venueName || '';
  var addr = t.venueAddress || '';
  var loc = venue && addr ? (venue + ' — ' + addr) : (venue || addr || '');
  var url = window._tournamentUrl ? window._tournamentUrl(t.id) : ('https://scoreplace.app/#tournaments/' + t.id);
  var desc = 'Torneio no scoreplace.app\n\n' +
             (sport ? 'Modalidade: ' + sport + '\n' : '') +
             (format ? 'Formato: ' + format + '\n' : '') +
             '\nAcompanhe e lance resultados em:\n' + url;
  return { title: title, start: start, end: end, location: loc, description: desc, url: url };
}

// Google Calendar URL — abre em nova aba, pré-preenche tudo.
function _googleCalendarUrl(payload) {
  var dates = _icsFormatDate(payload.start) + '/' + _icsFormatDate(payload.end);
  var params = new URLSearchParams({
    action: 'TEMPLATE',
    text: payload.title,
    dates: dates,
    details: payload.description,
    location: payload.location || ''
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

// Outlook Web URL — similar à do Google, útil pra usuários de Microsoft.
function _outlookCalendarUrl(payload) {
  var params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: payload.title,
    startdt: payload.start.toISOString(),
    enddt: payload.end.toISOString(),
    body: payload.description,
    location: payload.location || ''
  });
  return 'https://outlook.live.com/calendar/0/deeplink/compose?' + params.toString();
}

// ICS blob download — Apple Calendar (iOS/macOS), Outlook desktop, Thunderbird.
function _icsDownload(payload, filename) {
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//scoreplace.app//Tournament//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:tournament-' + Date.now() + '@scoreplace.app',
    'DTSTAMP:' + _icsFormatDate(new Date()),
    'DTSTART:' + _icsFormatDate(payload.start),
    'DTEND:' + _icsFormatDate(payload.end),
    'SUMMARY:' + _icsEscape(payload.title),
    'DESCRIPTION:' + _icsEscape(payload.description),
    'LOCATION:' + _icsEscape(payload.location),
    'URL:' + payload.url,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  var blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Picker overlay — 3 opções. Se o torneio não tem startDate, avisa e sai.
window._tournamentAddToCalendar = function(tournamentId) {
  var t = window.AppStore.tournaments.find(function(tour) { return String(tour.id) === String(tournamentId); });
  if (!t) {
    if (Array.isArray(window.AppStore.publicDiscovery)) {
      t = window.AppStore.publicDiscovery.find(function(tour) { return String(tour.id) === String(tournamentId); });
    }
  }
  if (!t) return;
  var payload = _tournamentCalendarPayload(t);
  if (!payload) {
    if (typeof showNotification === 'function') {
      showNotification('Sem data definida', 'Defina a data de início do torneio antes de adicionar à agenda.', 'warning');
    }
    return;
  }
  var _safe = window._safeHtml || function(s) { return String(s || ''); };
  var prev = document.getElementById('cal-picker-overlay');
  if (prev) prev.remove();
  var overlay = document.createElement('div');
  overlay.id = 'cal-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10020;display:flex;align-items:center;justify-content:center;padding:16px;';
  var safeFilename = (t.name || 'torneio').replace(/[^a-zA-Z0-9À-ü\s-]/g, '').replace(/\s+/g, '_') + '.ics';
  // Guardamos o payload numa var global temporária pra que os handlers do
  // overlay consigam acessar sem serializar tudo em onclick string.
  window._calPendingPayload = payload;
  window._calPendingFilename = safeFilename;
  overlay.innerHTML =
    '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:22px;max-width:440px;width:100%;text-align:center;">' +
      '<div style="font-size:2rem;margin-bottom:8px;">📅</div>' +
      '<div style="font-weight:800;color:var(--text-bright);font-size:1.05rem;margin-bottom:6px;">Adicionar à agenda</div>' +
      '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">' + _safe(t.name || 'Torneio') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        '<button class="btn hover-lift" onclick="window._calPick(\'google\')" style="background:#4285f4;color:#fff;border:none;font-weight:700;padding:10px 16px;border-radius:10px;">🟦 Google Calendar</button>' +
        '<button class="btn hover-lift" onclick="window._calPick(\'outlook\')" style="background:#0078d4;color:#fff;border:none;font-weight:700;padding:10px 16px;border-radius:10px;">🔷 Outlook.com</button>' +
        '<button class="btn hover-lift" onclick="window._calPick(\'ics\')" style="background:#6366f1;color:#fff;border:none;font-weight:700;padding:10px 16px;border-radius:10px;">📄 Apple/Outlook (.ics)</button>' +
      '</div>' +
      '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'cal-picker-overlay\').remove()" style="margin-top:14px;">Cancelar</button>' +
    '</div>';
  overlay.addEventListener('click', function(ev) { if (ev.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

window._calPick = function(kind) {
  var payload = window._calPendingPayload;
  var filename = window._calPendingFilename;
  if (!payload) return;
  var ov = document.getElementById('cal-picker-overlay');
  if (ov) ov.remove();
  if (kind === 'google') {
    window.open(_googleCalendarUrl(payload), '_blank', 'noopener');
  } else if (kind === 'outlook') {
    window.open(_outlookCalendarUrl(payload), '_blank', 'noopener');
  } else if (kind === 'ics') {
    _icsDownload(payload, filename || 'torneio.ics');
    if (typeof showNotification === 'function') showNotification('Arquivo gerado', 'Abra o .ics pra importar na sua agenda.', 'success');
  }
  window._calPendingPayload = null;
  window._calPendingFilename = null;
};
