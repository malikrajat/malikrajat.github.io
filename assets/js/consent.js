/*!
 * consent.js — cookie / advertising consent banner.
 *
 * - Shows a small, accessible banner on the first visit.
 * - "Accept all" grants analytics + advertising storage.
 * - "Reject non-essential" keeps only strictly necessary storage.
 * - The choice is saved in localStorage and can be changed at any time from
 *   the "Cookie settings" button in the footer.
 * - Sends Google Consent Mode v2 updates. See consent-defaults.js for defaults.
 *
 * The banner is deliberately plain: no third-party CMP script, no tracking,
 * and no dark patterns. Google's certified CMP (configured in AdSense) remains
 * the authoritative consent signal for Google ads in the EEA/UK/CH; this
 * banner covers the rest of the site and gives every visitor a visible choice.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'rm.consent.v1';
  var banner = null;

  function readChoice() {
    try {
      var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (value && typeof value.analytics === 'boolean' && typeof value.ads === 'boolean') {
        return value;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (e) { /* storage blocked — apply for this page only */ }
  }

  function applyChoice(choice) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: choice.ads ? 'granted' : 'denied',
        ad_user_data: choice.ads ? 'granted' : 'denied',
        ad_personalization: choice.ads ? 'granted' : 'denied',
        analytics_storage: choice.analytics ? 'granted' : 'denied'
      });
    }
    window.dispatchEvent(new CustomEvent('rm:consent', { detail: choice }));
  }

  function decide(allowAll) {
    var choice = {
      analytics: !!allowAll,
      ads: !!allowAll,
      ts: new Date().toISOString()
    };
    saveChoice(choice);
    applyChoice(choice);
    hideBanner();
  }

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.className = 'cookie-banner';
    wrap.id = 'cookie-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('aria-labelledby', 'cookie-banner-title');
    wrap.setAttribute('aria-describedby', 'cookie-banner-copy');

    wrap.innerHTML =
      '<div class="cookie-inner">' +
        '<p class="cookie-copy" id="cookie-banner-copy">' +
          '<strong id="cookie-banner-title">Cookies and privacy</strong>' +
          'This site uses cookies for analytics and, through Google AdSense, to show ' +
          'advertising. You can accept all, or keep only what is needed for the site to work. ' +
          'Read the <a href="/privacy-policy.html">privacy policy</a>.' +
        '</p>' +
        '<div class="cookie-actions">' +
          '<button class="cookie-reject" type="button" data-consent="reject">Reject non-essential</button>' +
          '<button class="cookie-accept" type="button" data-consent="accept">Accept all</button>' +
        '</div>' +
      '</div>';

    wrap.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (!button) return;
      decide(button.getAttribute('data-consent') === 'accept');
    });

    document.body.appendChild(wrap);
    return wrap;
  }

  function showBanner() {
    if (!banner) banner = buildBanner();
    banner.hidden = false;
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function wireSettingsButtons() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-cookie-settings]');
      if (!trigger) return;
      event.preventDefault();
      showBanner();
      var first = banner && banner.querySelector('button');
      if (first) first.focus();
    });
  }

  function init() {
    var choice = readChoice();
    if (choice) {
      applyChoice(choice);
    } else {
      showBanner();
    }
    wireSettingsButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
