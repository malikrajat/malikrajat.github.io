/*!
 * pages.js — small behaviour layer for the article, about, contact and policy
 * pages: mobile navigation, footer year, and an automatic "on this page" list.
 * It intentionally does not load the home page's animation/isotope stack.
 */
(function () {
  'use strict';

  function initNav() {
    var header = document.getElementById('header');
    var toggle = document.querySelector('.header-toggle');
    if (!header || !toggle) return;

    toggle.addEventListener('click', function () {
      toggleNav();
    });

    toggle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleNav();
      }
    });

    function toggleNav() {
      var open = header.classList.toggle('header-show');
      toggle.classList.toggle('bi-list', !open);
      toggle.classList.toggle('bi-x', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    header.querySelectorAll('#navmenu a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (header.classList.contains('header-show')) {
          header.classList.remove('header-show');
          toggle.classList.add('bi-list');
          toggle.classList.remove('bi-x');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  function slugify(text, index) {
    var slug = text.toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return slug || 'section-' + index;
  }

  function initToc() {
    var toc = document.querySelector('[data-toc]');
    var prose = document.querySelector('.prose');
    if (!toc || !prose) return;

    var headings = Array.prototype.slice.call(prose.querySelectorAll('h2'));
    if (headings.length < 3) {
      toc.remove();
      return;
    }

    var list = document.createElement('ol');
    headings.forEach(function (heading, index) {
      /* Headings may carry their own "1." numbering; the TOC already numbers
         entries, so strip it from the link label and the slug. */
      var label = heading.textContent.replace(/^\s*\d+[.)]\s*/, '').trim();
      if (!heading.id) heading.id = slugify(label, index + 1);
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = label;
      item.appendChild(link);
      list.appendChild(item);
    });

    toc.appendChild(list);
  }

  function initScrollTop() {
    var top = document.querySelector('.scroll-top');
    if (!top) return;
    window.addEventListener('scroll', function () {
      top.classList.toggle('active', window.scrollY > 400);
    }, { passive: true });
  }

  function boot() {
    initNav();
    initYear();
    initToc();
    initScrollTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
