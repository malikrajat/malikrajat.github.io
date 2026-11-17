/*!
 * consent-defaults.js — Google Consent Mode v2 defaults.
 *
 * MUST load synchronously in <head> BEFORE Google Tag Manager and AdSense, so
 * the consent state is known before any Google tag fires. It sets:
 *
 *   1. analytics/ad storage GRANTED outside the EEA, UK and Switzerland
 *   2. ad storage DENIED in the EEA, UK and Switzerland until the visitor
 *      chooses in the cookie banner (or until Google's certified CMP does)
 *   3. a saved choice from an earlier visit, if there is one
 *
 * The banner itself is in consent.js. This file stores nothing and collects
 * nothing; the only state is the visitor's own choice in localStorage.
 */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  var GRANTED = {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted'
  };

  var DENIED = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  };

  /* EEA member states + UK + Switzerland. Google Consent Mode expects ISO
   * 3166-1 alpha-2 codes in `region`. */
  var CONSENT_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'
  ];

  try {
    /* Baseline: granted everywhere ... */
    window.gtag('consent', 'default', {
      wait_for_update: 500,
      ad_storage: GRANTED.ad_storage,
      ad_user_data: GRANTED.ad_user_data,
      ad_personalization: GRANTED.ad_personalization,
      analytics_storage: GRANTED.analytics_storage
    });

    /* ... then override the regions that require prior consent. */
    window.gtag('consent', 'default', {
      region: CONSENT_REGIONS,
      ad_storage: DENIED.ad_storage,
      ad_user_data: DENIED.ad_user_data,
      ad_personalization: DENIED.ad_personalization,
      analytics_storage: DENIED.analytics_storage
    });
  } catch (e) { /* very old browser — tags simply stay denied */ }

  /* Re-apply an explicit choice made on an earlier visit. */
  try {
    var saved = JSON.parse(window.localStorage.getItem('rm.consent.v1') || 'null');
    if (saved && typeof saved.analytics === 'boolean' && typeof saved.ads === 'boolean') {
      window.gtag('consent', 'update', {
        ad_storage: saved.ads ? 'granted' : 'denied',
        ad_user_data: saved.ads ? 'granted' : 'denied',
        ad_personalization: saved.ads ? 'granted' : 'denied',
        analytics_storage: saved.analytics ? 'granted' : 'denied'
      });
    }
  } catch (e) { /* storage blocked — keep the regional defaults */ }
})();
