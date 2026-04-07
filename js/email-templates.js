// ─── Email Templates: HTML email generators for Cloud Function integration ──
// Client-side only. Returns HTML strings ready to be sent via a Cloud Function.
(function() {
  'use strict';

  var BRAND_COLOR = '#3b82f6';
  var BG_COLOR = '#111827';
  var TEXT_COLOR = '#e5e7eb';
  var MUTED_COLOR = '#9ca3af';

  function _header() {
    return '<tr><td style="padding:24px 32px;text-align:center;background:' + BRAND_COLOR + ';">' +
      '<h1 style="margin:0;font-size:1.4rem;font-weight:700;color:#fff;">🏆 scoreplace.app</h1>' +
    '</td></tr>';
  }

  function _footer(unsubscribeUrl) {
    return '<tr><td style="padding:20px 32px;text-align:center;border-top:1px solid #374151;">' +
      '<p style="margin:0 0 8px;font-size:0.75rem;color:' + MUTED_COLOR + ';">scoreplace.app — Gestao de torneios esportivos</p>' +
      (unsubscribeUrl ? '<p style="margin:0;font-size:0.72rem;"><a href="' + unsubscribeUrl + '" style="color:' + MUTED_COLOR + ';">Cancelar notificacoes por email</a></p>' : '') +
    '</td></tr>';
  }

  function _ctaButton(text, url) {
    return '<table cellpadding="0" cellspacing="0" border="0" style="margin:20px auto;"><tr><td style="background:' + BRAND_COLOR + ';border-radius:8px;padding:12px 32px;">' +
      '<a href="' + url + '" style="color:#fff;text-decoration:none;font-weight:600;font-size:0.95rem;">' + text + '</a>' +
    '</td></tr></table>';
  }

  function _wrap(bodyRows) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">' +
      '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:20px auto;background:' + BG_COLOR + ';border-radius:12px;overflow:hidden;border:1px solid #1f2937;">' +
      _header() + bodyRows + _footer('{unsubscribeUrl}') +
      '</table></body></html>';
  }

  function _body(title, message, ctaText, ctaUrl) {
    return '<tr><td style="padding:28px 32px;color:' + TEXT_COLOR + ';">' +
      '<h2 style="margin:0 0 12px;font-size:1.15rem;font-weight:700;color:#fff;">' + title + '</h2>' +
      '<p style="margin:0 0 4px;font-size:0.92rem;line-height:1.6;color:' + TEXT_COLOR + ';">' + message + '</p>' +
      (ctaText && ctaUrl ? _ctaButton(ctaText, ctaUrl) : '') +
    '</td></tr>';
  }

  /**
   * Generate an email template HTML string.
   * @param {string} type - 'enrollment' | 'result' | 'reminder' | 'tournament_update'
   * @param {Object} data - { playerName, tournamentName, tournamentUrl, score1, score2, player1, player2, winner, days, changes }
   * @returns {string} Complete HTML email string
   */
  window._emailTemplate = function(type, data) {
    data = data || {};
    var name = data.tournamentName || 'Torneio';
    var url = data.tournamentUrl || 'https://scoreplace.app';

    switch (type) {
      case 'enrollment':
        return _wrap(_body(
          'Inscricao Confirmada!',
          (data.playerName || 'Voce') + ' foi inscrito(a) no torneio <b>' + name + '</b>. Acompanhe o torneio pelo link abaixo.',
          'Ver Torneio', url
        ));

      case 'result':
        var scoreText = (data.player1 || '?') + ' ' + (data.score1 || '0') + ' x ' + (data.score2 || '0') + ' ' + (data.player2 || '?');
        var winnerText = data.winner ? '<br>Vencedor: <b>' + data.winner + '</b>' : '';
        return _wrap(_body(
          'Resultado — ' + name,
          scoreText + winnerText,
          'Ver Chaves', url
        ));

      case 'reminder':
        return _wrap(_body(
          'Lembrete: ' + name,
          'Seu torneio <b>' + name + '</b> comeca em <b>' + (data.days || '?') + ' dias</b>. Confira os detalhes e confirme sua presenca!',
          'Ver Torneio', url
        ));

      case 'tournament_update':
        var changesHtml = data.changes ? '<br><br><b>Alteracoes:</b><br>' + data.changes : '';
        return _wrap(_body(
          'Atualizacao — ' + name,
          'O torneio <b>' + name + '</b> foi atualizado.' + changesHtml,
          'Ver Torneio', url
        ));

      default:
        return _wrap(_body('Notificacao', 'Voce tem uma nova notificacao do scoreplace.app.', 'Abrir App', url));
    }
  };
})();
