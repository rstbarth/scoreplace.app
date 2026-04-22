// ─── Landing Page: conversion page for non-logged visitors ──────────────────
(function() {
  'use strict';

  var _sportIcons = {
    'Beach Tennis': '🏖️', 'Pickleball': '🥒', 'Tenis': '🎾',
    'Tenis de Mesa': '🏓', 'Padel': '🏸'
  };

  window.renderLanding = function(container) {
    var t = window._t || function(k) { return k; };

    container.innerHTML = '<div class="landing-page">' +
      _css() +
      _hero(t) +
      _features(t) +
      _howItWorks(t) +
      _stats(t) +
      _ctaBottom(t) +
      _footer() +
    '</div>';

    // Attach CTA click handlers — open full login modal (all sign-in options)
    var btns = container.querySelectorAll('[data-landing-cta]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        if (typeof window.openModal === 'function') {
          window.openModal('modal-login');
        } else if (typeof window.handleGoogleLogin === 'function') {
          window.handleGoogleLogin();
        }
      });
    }
  };

  function _hero(t) {
    var ver = window.SCOREPLACE_VERSION || '';
    return '<section class="landing-hero">' +
      '<div class="landing-hero-content">' +
        '<div class="landing-logo">🏆</div>' +
        '<h1 class="landing-title">scoreplace<span class="landing-dot">.app</span></h1>' +
        (ver ? '<div class="landing-version" style="font-size:0.78rem;color:var(--text-muted,#9ca3af);margin-top:-4px;margin-bottom:14px;letter-spacing:0.3px;">v' + ver + '</div>' : '') +
        '<p class="landing-tagline">' + t('landing.tagline') + '</p>' +
        '<button class="btn btn-cta btn-success landing-cta-btn" data-landing-cta>' +
          t('landing.cta') +
        '</button>' +
        '<div class="landing-sports-row">' +
          Object.keys(_sportIcons).map(function(s) {
            return '<span class="landing-sport-pill">' + _sportIcons[s] + ' ' + s + '</span>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function _features(t) {
    var feats = [
      { key: 'feat1', icon: '🎯' },
      { key: 'feat2', icon: '📋' },
      { key: 'feat3', icon: '🔗' },
      { key: 'feat4', icon: '⚡' },
      { key: 'feat5', icon: '📍' },
      { key: 'feat6', icon: '🏢' }
    ];
    var cards = feats.map(function(f) {
      return '<div class="landing-feat-card">' +
        '<div class="landing-feat-icon">' + f.icon + '</div>' +
        '<h3>' + t('landing.' + f.key + 'Title') + '</h3>' +
        '<p>' + t('landing.' + f.key + 'Desc') + '</p>' +
      '</div>';
    }).join('');
    return '<section class="landing-features">' +
      '<div class="landing-grid">' + cards + '</div>' +
    '</section>';
  }

  function _howItWorks(t) {
    var steps = [
      { num: '1', key: 'step1', icon: '🏗️' },
      { num: '2', key: 'step2', icon: '📨' },
      { num: '3', key: 'step3', icon: '🏅' }
    ];
    var html = steps.map(function(s) {
      return '<div class="landing-step">' +
        '<div class="landing-step-num">' + s.icon + '</div>' +
        '<h3>' + t('landing.' + s.key + 'Title') + '</h3>' +
        '<p>' + t('landing.' + s.key + 'Desc') + '</p>' +
      '</div>';
    }).join('<div class="landing-step-arrow">→</div>');
    return '<section class="landing-how">' +
      '<h2>' + t('landing.howTitle') + '</h2>' +
      '<div class="landing-steps">' + html + '</div>' +
    '</section>';
  }

  function _stats(t) {
    var items = [
      { value: '500+', label: t('landing.statsT') },
      { value: '2.000+', label: t('landing.statsP') },
      { value: '5', label: t('landing.statsS') }
    ];
    var html = items.map(function(s) {
      return '<div class="landing-stat">' +
        '<div class="landing-stat-value">' + s.value + '</div>' +
        '<div class="landing-stat-label">' + s.label + '</div>' +
      '</div>';
    }).join('');
    return '<section class="landing-stats">' + html + '</section>';
  }

  function _ctaBottom(t) {
    return '<section class="landing-cta-section">' +
      '<button class="btn btn-cta btn-success landing-cta-btn" data-landing-cta>' +
        t('landing.ctaBottom') +
      '</button>' +
    '</section>';
  }

  function _footer() {
    var ver = window.SCOREPLACE_VERSION || '';
    return '<footer class="landing-footer">' +
      '<p>scoreplace.app v' + ver + '</p>' +
      '<p><a href="mailto:scoreplace.app@gmail.com">scoreplace.app@gmail.com</a></p>' +
    '</footer>';
  }

  function _css() {
    return '<style>' +
    '.landing-page { max-width: 900px; margin: 0 auto; padding: 0 16px; }' +

    /* Hero */
    '.landing-hero { text-align: center; padding: 48px 0 32px; }' +
    '.landing-logo { font-size: 3.5rem; margin-bottom: 8px; }' +
    '.landing-title { font-size: 2.2rem; font-weight: 800; color: var(--text-bright); margin: 0; }' +
    '.landing-dot { color: var(--primary-color); }' +
    '.landing-tagline { font-size: 1.1rem; color: var(--text-muted); margin: 12px 0 28px; max-width: 500px; margin-left: auto; margin-right: auto; }' +
    '.landing-cta-btn { font-size: 1.05rem; padding: 14px 36px; border-radius: 12px; cursor: pointer; }' +
    '.landing-sports-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 28px; }' +
    '.landing-sport-pill { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 6px 14px; font-size: 0.82rem; color: var(--text-main); }' +

    /* Features grid */
    '.landing-features { padding: 24px 0; }' +
    '.landing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }' +
    '.landing-feat-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 24px 20px; text-align: center; transition: transform 0.2s, box-shadow 0.2s; }' +
    '.landing-feat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }' +
    '.landing-feat-icon { font-size: 2rem; margin-bottom: 10px; }' +
    '.landing-feat-card h3 { font-size: 1rem; font-weight: 700; color: var(--text-bright); margin: 0 0 8px; }' +
    '.landing-feat-card p { font-size: 0.88rem; color: var(--text-muted); margin: 0; line-height: 1.5; }' +

    /* How it works */
    '.landing-how { padding: 32px 0; text-align: center; }' +
    '.landing-how h2 { font-size: 1.4rem; font-weight: 700; color: var(--text-bright); margin: 0 0 24px; }' +
    '.landing-steps { display: flex; align-items: flex-start; justify-content: center; gap: 12px; flex-wrap: wrap; }' +
    '.landing-step { flex: 1; min-width: 180px; max-width: 240px; text-align: center; }' +
    '.landing-step-num { font-size: 2rem; margin-bottom: 8px; }' +
    '.landing-step h3 { font-size: 0.95rem; font-weight: 700; color: var(--text-bright); margin: 0 0 6px; }' +
    '.landing-step p { font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.5; }' +
    '.landing-step-arrow { font-size: 1.5rem; color: var(--text-muted); padding-top: 16px; }' +

    /* Stats */
    '.landing-stats { display: flex; justify-content: center; gap: 40px; padding: 32px 0; flex-wrap: wrap; }' +
    '.landing-stat { text-align: center; }' +
    '.landing-stat-value { font-size: 2rem; font-weight: 800; color: var(--primary-color); }' +
    '.landing-stat-label { font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; }' +

    /* CTA bottom */
    '.landing-cta-section { text-align: center; padding: 24px 0 40px; }' +

    /* Footer */
    '.landing-footer { text-align: center; padding: 24px 0; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-muted); }' +
    '.landing-footer a { color: var(--primary-color); text-decoration: none; }' +

    /* Mobile */
    '@media (max-width: 767px) {' +
      '.landing-title { font-size: 1.6rem; }' +
      '.landing-tagline { font-size: 0.95rem; }' +
      '.landing-step-arrow { display: none; }' +
      '.landing-steps { flex-direction: column; align-items: center; }' +
      '.landing-stats { gap: 24px; }' +
      '.landing-cta-btn { width: 100%; max-width: 320px; }' +
    '}' +
    '</style>';
  }
})();
