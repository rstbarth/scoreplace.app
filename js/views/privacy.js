// scoreplace.app — Política de Privacidade
//
// Página pública (rota #privacy). Acessível sem login.
//
// ⚠️ TODO LEGAL REVIEW: o texto abaixo é placeholder estruturado pelos
// princípios da LGPD (Brasil) e cobre os pontos típicos. Antes de beta
// público, revisar com advogado especializado em proteção de dados.

(function () {
  'use strict';

  function renderPrivacyPage(container) {
    var _t = window._t || function (k) { return k; };
    var supportEmail = 'scoreplace.app@gmail.com';
    var lastUpdated = '29 de Abril de 2026';

    var html = '';

    // Sticky back-header padrão do app
    if (typeof window._renderBackHeader === 'function') {
      html += window._renderBackHeader({
        label: _t('btn.back') || 'Voltar',
        middleHtml: '<span style="font-weight:700;color:var(--text-bright);">' + _t('privacy.title') + '</span>'
      });
    }

    html +=
      '<div style="max-width:760px;margin:0 auto;padding:1.25rem 1rem 3rem;">' +
        '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:1.5rem;">' +
          '<h1 style="font-size:1.6rem;font-weight:800;color:var(--text-bright);margin:0 0 0.4rem;">' +
            _t('privacy.title') + '</h1>' +
          '<p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 1.5rem;">' +
            _t('privacy.lastUpdated', { date: lastUpdated }) + '</p>' +

          '<p style="font-size:0.92rem;color:var(--text-main);line-height:1.7;margin:0 0 1.25rem;">' +
            _t('privacy.intro', { email: supportEmail }) + '</p>' +

          '<h2 style="font-size:1.05rem;font-weight:700;color:var(--text-bright);margin:1.5rem 0 0.6rem;">' +
            '1. ' + _t('privacy.section1Title') + '</h2>' +
          '<p style="font-size:0.88rem;color:var(--text-main);line-height:1.7;margin:0 0 0.75rem;">' +
            _t('privacy.section1Body') + '</p>' +

          '<h2 style="font-size:1.05rem;font-weight:700;color:var(--text-bright);margin:1.5rem 0 0.6rem;">' +
            '2. ' + _t('privacy.section2Title') + '</h2>' +
          '<p style="font-size:0.88rem;color:var(--text-main);line-height:1.7;margin:0 0 0.75rem;">' +
            _t('privacy.section2Body') + '</p>' +

          '<h2 style="font-size:1.05rem;font-weight:700;color:var(--text-bright);margin:1.5rem 0 0.6rem;">' +
            '3. ' + _t('privacy.section3Title') + '</h2>' +
          '<p style="font-size:0.88rem;color:var(--text-main);line-height:1.7;margin:0 0 0.75rem;">' +
            _t('privacy.section3Body') + '</p>' +

          '<h2 style="font-size:1.05rem;font-weight:700;color:var(--text-bright);margin:1.5rem 0 0.6rem;">' +
            '4. ' + _t('privacy.section4Title') + '</h2>' +
          '<p style="font-size:0.88rem;color:var(--text-main);line-height:1.7;margin:0 0 0.75rem;">' +
            _t('privacy.section4Body') + '</p>' +

          '<h2 style="font-size:1.05rem;font-weight:700;color:var(--text-bright);margin:1.5rem 0 0.6rem;">' +
            '5. ' + _t('privacy.section5Title') + '</h2>' +
          '<p style="font-size:0.88rem;color:var(--text-main);line-height:1.7;margin:0 0 0.75rem;">' +
            _t('privacy.section5Body') + '</p>' +

          '<h2 style="font-size:1.05rem;font-weight:700;color:var(--text-bright);margin:1.5rem 0 0.6rem;">' +
            '6. ' + _t('privacy.contactTitle') + '</h2>' +
          '<p style="font-size:0.88rem;color:var(--text-main);line-height:1.7;margin:0;">' +
            _t('privacy.contactBody') +
            ' <a href="mailto:' + supportEmail + '" style="color:var(--primary-color);">' +
              supportEmail +
            '</a>.' +
          '</p>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;
  }

  // Expose globally pra router
  window.renderPrivacy = renderPrivacyPage;
})();
