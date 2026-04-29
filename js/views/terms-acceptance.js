// scoreplace.app — Aceite explícito de Termos + Política de Privacidade
//
// Modal forçado no primeiro login (ou quando a versão dos termos muda).
// Compliance LGPD: usuário precisa marcar checkbox e clicar Confirmar antes
// de usar o app. Sem aceite = logout forçado.
//
// Persistência em users/{uid}:
//   acceptedTerms: true,
//   acceptedTermsAt: ISO timestamp,
//   acceptedTermsVersion: string ('1.0' atual)
//
// Bumpar _CURRENT_TERMS_VERSION quando o conteúdo de Privacy ou Terms mudar
// substancialmente — todos os usuários precisam re-aceitar a partir daí.

(function () {
  'use strict';

  // Versão atual dos termos. Bumpar quando docs/privacy ou docs/terms mudarem
  // de forma que afeta direitos/obrigações do usuário.
  window._CURRENT_TERMS_VERSION = '1.0';

  /**
   * @param {Object} profile — currentUser ou objeto loadado do Firestore
   * @returns {boolean} true se o user precisa aceitar (não aceitou ainda OU
   *   aceitou versão antiga)
   */
  window._needsTermsAcceptance = function (profile) {
    if (!profile) return true;
    if (profile.acceptedTerms !== true) return true;
    if (profile.acceptedTermsVersion !== window._CURRENT_TERMS_VERSION) return true;
    return false;
  };

  /**
   * Mostra o modal de aceite. Retorna Promise<boolean>:
   *   true  → usuário aceitou (e o profile foi atualizado no Firestore)
   *   false → usuário cancelou/saiu (caller deve fazer logout)
   */
  window._showTermsAcceptanceModal = function () {
    return new Promise(function (resolve) {
      var _t = window._t || function (k) { return k; };

      // Remove se já existia (idempotente)
      var existing = document.getElementById('modal-terms-acceptance');
      if (existing) existing.remove();

      var html =
        '<div class="modal-overlay active" id="modal-terms-acceptance" style="z-index:10050;">' +
          '<div class="modal" style="max-width:520px;padding:0;">' +
            '<div style="padding:1.5rem 1.5rem 1rem;border-bottom:1px solid var(--border-color);">' +
              '<div style="font-size:1.6rem;margin-bottom:0.5rem;">⚠️</div>' +
              '<h2 style="margin:0 0 0.5rem;font-size:1.2rem;font-weight:800;color:var(--text-bright);">' +
                _t('terms.acceptTitle') +
              '</h2>' +
              '<p style="margin:0;font-size:0.85rem;color:var(--text-main);line-height:1.6;">' +
                _t('terms.acceptIntro') +
              '</p>' +
            '</div>' +
            '<div style="padding:1.25rem 1.5rem;">' +
              '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.25rem;">' +
                '<a href="#terms" target="_blank" rel="noopener" id="terms-accept-link-terms" style="display:block;padding:10px 14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:10px;color:var(--primary-color);text-decoration:none;font-size:0.88rem;font-weight:600;transition:all 0.2s;">' +
                  '📜 ' + _t('terms.openTerms') +
                  ' <span style="float:right;opacity:0.6;font-size:0.75rem;">↗</span>' +
                '</a>' +
                '<a href="#privacy" target="_blank" rel="noopener" id="terms-accept-link-privacy" style="display:block;padding:10px 14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:10px;color:var(--primary-color);text-decoration:none;font-size:0.88rem;font-weight:600;transition:all 0.2s;">' +
                  '🔐 ' + _t('terms.openPrivacy') +
                  ' <span style="float:right;opacity:0.6;font-size:0.75rem;">↗</span>' +
                '</a>' +
              '</div>' +
              '<label for="terms-accept-checkbox" style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;cursor:pointer;font-size:0.85rem;color:var(--text-main);line-height:1.55;">' +
                '<input type="checkbox" id="terms-accept-checkbox" style="margin-top:3px;flex-shrink:0;width:18px;height:18px;cursor:pointer;accent-color:#22c55e;">' +
                '<span>' + _t('terms.acceptCheckbox') + '</span>' +
              '</label>' +
            '</div>' +
            '<div style="padding:1rem 1.5rem 1.5rem;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border-color);">' +
              '<button type="button" id="terms-accept-cancel" class="btn btn-outline" style="padding:9px 18px;font-size:0.85rem;">' +
                _t('terms.acceptCancel') +
              '</button>' +
              '<button type="button" id="terms-accept-confirm" class="btn btn-success" disabled style="padding:9px 22px;font-size:0.85rem;font-weight:700;opacity:0.5;cursor:not-allowed;">' +
                _t('terms.acceptConfirm') +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.body.insertAdjacentHTML('beforeend', html);

      var checkbox = document.getElementById('terms-accept-checkbox');
      var btnConfirm = document.getElementById('terms-accept-confirm');
      var btnCancel = document.getElementById('terms-accept-cancel');

      function updateConfirmState() {
        var enabled = checkbox.checked;
        btnConfirm.disabled = !enabled;
        btnConfirm.style.opacity = enabled ? '1' : '0.5';
        btnConfirm.style.cursor = enabled ? 'pointer' : 'not-allowed';
      }
      checkbox.addEventListener('change', updateConfirmState);

      function cleanup() {
        var modal = document.getElementById('modal-terms-acceptance');
        if (modal) modal.remove();
      }

      btnCancel.addEventListener('click', function () {
        cleanup();
        resolve(false);
      });

      btnConfirm.addEventListener('click', async function () {
        if (!checkbox.checked) return;
        btnConfirm.disabled = true;
        btnConfirm.textContent = _t('terms.acceptSaving') || 'Salvando…';

        var cu = window.AppStore && window.AppStore.currentUser;
        if (!cu || !cu.uid) {
          if (typeof window._captureException === 'function') {
            window._captureException(new Error('Terms accept attempted without uid'), { area: 'termsAccept' });
          }
          cleanup();
          resolve(false);
          return;
        }

        var payload = {
          acceptedTerms: true,
          acceptedTermsAt: new Date().toISOString(),
          acceptedTermsVersion: window._CURRENT_TERMS_VERSION
        };

        try {
          if (window.FirestoreDB && window.FirestoreDB.db) {
            await window.FirestoreDB.db.collection('users').doc(cu.uid).set(payload, { merge: true });
          }
          // Atualiza estado local
          Object.assign(cu, payload);
          cleanup();
          resolve(true);
        } catch (err) {
          console.error('[TermsAccept] save failed:', err);
          if (typeof window._captureException === 'function') {
            window._captureException(err, { area: 'termsAccept', uid: cu.uid });
          }
          if (typeof window.showNotification === 'function') {
            window.showNotification('⚠️ ' + (_t('terms.acceptFailed') || 'Falha ao salvar'),
              (_t('terms.acceptFailedMsg') || 'Tente novamente em instantes.'),
              'error');
          }
          btnConfirm.disabled = false;
          btnConfirm.textContent = _t('terms.acceptConfirm');
          resolve(false);
        }
      });

      // Esc + click outside fecham (= cancelar)
      var overlay = document.getElementById('modal-terms-acceptance');
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });

      // Fecha modal ao clicar nos links de Terms/Privacy (eles abrem em nova
      // aba via target=_blank, mas no caso de hash a navegação é interna —
      // queremos que o modal feche pra usuário ler em paz, e mostre de novo
      // ao voltar pro app). Solução simples: deixa o link funcionar e o user
      // re-loga depois pra ver o modal de novo. Pra evitar isso, abrimos
      // em nova aba via target=_blank — preserva o modal-acceptance ativo
      // na aba original.
    });
  };
})();
