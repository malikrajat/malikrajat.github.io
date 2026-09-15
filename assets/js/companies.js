/*!
 * companies.js — the "Companies & Clients" logo wall.
 *
 * This file is CONTENT, not analytics. It holds the list of companies and
 * clients shown on the page and renders the logo tiles into #company-grid.
 * Nothing here is tracked, counted or sent anywhere.
 *
 * TO ADD A COMPANY
 *   1. Drop the logo file into assets/img/logos/
 *   2. Add an entry to the list below
 *   A missing logo file degrades to the company name instead of a broken image.
 *
 * Set `current: true` on your present employer to show the accent "Current" badge.
 */
(function () {
  'use strict';

  /* ========================================================================== *
   *  THE LIST — edit this
   * ========================================================================== */

  var COMPANIES = [
    {
      name: 'Siemens',
      logo: 'assets/img/logos/siemens.svg',
      current: true,
      url: 'https://www.siemens.com/'
    },
    {
      name: 'Siemens Energy',
      logo: 'assets/img/logos/siemens-energy.svg',
      url: 'https://www.siemens-energy.com/'
    },
    {
      /* No official "Siemens Mobility" lockup exists in the public sources used
       * here, so this tile uses the official Siemens mark, which the division's
       * branding is built on. Point `logo` elsewhere to swap it. */
      name: 'Siemens Mobility',
      logo: 'assets/img/logos/siemens.svg',
      url: 'https://www.mobility.siemens.com/global/en/company.html'
    },
    {
      name: 'HCL',
      logo: 'assets/img/logos/hcl.svg',
      url: 'https://www.hcltech.com/'
    },
    {
      name: 'AT&T',
      logo: 'assets/img/logos/att.svg',
      url: 'https://www.att.com/'
    },
    {
      name: 'Airtel',
      logo: 'assets/img/logos/airtel.svg',
      url: 'https://www.airtel.in/'
    },
    {
      name: 'GIPL',
      logo: 'assets/img/logos/gipl.png',
      url: 'https://gipl.in/'
    },
    {
      name: 'RMG Worldwide',
      logo: 'assets/img/logos/rmg-worldwide.png',
      url: 'https://www.rmgworldwide.co.in/'
    },
    {
      name: 'AllCAD Services',
      logo: 'assets/img/logos/allcad-services.png',
      url: 'https://www.allcadservices.com/'
    }
  ];

  /* Exposed so page scripts and tests can inspect it */
  window.SITE_COMPANIES = COMPANIES;

  /* ========================================================================== *
   *  Renderer
   * ========================================================================== */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderCompanies() {
    var grid = document.getElementById('company-grid');
    if (!grid) return;

    grid.innerHTML = '';

    COMPANIES.forEach(function (company) {
      var item = el('li', 'company-item' + (company.current ? ' is-current' : ''));
      var card = el('a', 'company-logo-card');

      card.href = company.url || '#contact';
      if (company.url) {
        card.target = '_blank';
        card.rel = 'noopener';
      }
      card.setAttribute('aria-label', company.name + (company.url ? ' — opens in a new tab' : ''));

      var img = document.createElement('img');
      img.className = 'company-mark';
      img.src = company.logo;
      img.alt = company.name + ' logo';
      img.loading = 'lazy';
      img.decoding = 'async';

      /* If a logo file is ever missing, show the name instead of an empty box */
      img.addEventListener('error', function () {
        img.remove();
        if (!card.querySelector('.company-fallback')) {
          card.appendChild(el('span', 'company-fallback', company.name));
        }
      });

      card.appendChild(img);
      card.appendChild(el('span', 'company-name', company.name));
      if (company.current) {
        card.appendChild(el('span', 'company-current', 'Current'));
      }

      item.appendChild(card);
      grid.appendChild(item);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCompanies);
  } else {
    renderCompanies();
  }
})();
