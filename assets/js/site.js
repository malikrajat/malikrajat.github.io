/*!
 * site.js — VISITOR ANALYTICS for the site.
 *
 *   1. SITE_CONFIG  — GoatCounter settings (companies list is in companies.js)
 *   2. GoatCounter  — visit counting
 *   3. The private visitor + traffic-source panel (footer → "Site stats")
 *
 * The "Companies & Clients" logo wall is page content and lives in
 * assets/js/companies.js. The two files are independent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SETUP (two minutes, both steps optional — the site works without them):
 *
 * 1. Visitor counting (works out of the box)
 *    A free GoatCounter site is expected at https://rajatmalik.goatcounter.com.
 *    If your GoatCounter code is different, change `goatcounterCode` below.
 *
 * 2. Traffic sources, locations and browsers (needs a token)
 *    - GoatCounter dashboard → [your username] → API → create a key, then paste
 *      it into `apiToken` below.
 *
 *    IMPORTANT — READ BEFORE SETTING A TOKEN: this is a static site, so
 *    EVERYTHING IN THIS FILE IS PUBLIC. Anyone can read the token from your
 *    published page. GoatCounter API keys are all-or-nothing: they can export
 *    your data and manage your sites, not just read stats.
 *
 *    Recommendation: leave `apiToken` empty. You then get visit totals plus a
 *    local "this visitor came from X" hint and a link to your dashboard, and
 *    you publish no credentials. Only set it if you accept that trade.
 *    The former fallback (public counter) is documented in the GoatCounter docs.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ========================================================================== *
   *  SITE CONFIG — visitor analytics only
   *
   *  The companies / clients list is not here: it lives in companies.js.
   * ========================================================================== */

  var SITE_CONFIG = window.SITE_CONFIG || {};

  /* Your GoatCounter code. The site lives at https://<code>.goatcounter.com */
  SITE_CONFIG.goatcounterCode = SITE_CONFIG.goatcounterCode || 'rajatmalik';

  /* Optional read-only GoatCounter API token, for source/location breakdowns.
   * SECURITY: this file is public on a static site. See the header comment. */
  SITE_CONFIG.apiToken = SITE_CONFIG.apiToken || '1c695hmitnua1tky3tyuqkvf41m5zmxfxrgx26x4hca0oy546a';

  /* Show the visit total in the footer */
  SITE_CONFIG.showFooterCount = SITE_CONFIG.showFooterCount !== false;

  /* Open the panel automatically when the URL ends with #site-stats */
  SITE_CONFIG.openOnHash = SITE_CONFIG.openOnHash || '#site-stats';

  window.SITE_CONFIG = SITE_CONFIG;

  /* ========================================================================== *
   *  Helpers
   * ========================================================================== */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function formatNumber(value) {
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-IN');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Friendly label + icon for a referrer row coming from GoatCounter */
  var REFERRER_MAP = [
    { match: /linkedin/i,        label: 'LinkedIn',        icon: 'bi-linkedin' },
    { match: /google/i,          label: 'Google',          icon: 'bi-google' },
    { match: /bing|duckduckgo|yahoo|yandex|ecosia|search/i, label: 'Search engines', icon: 'bi-search' },
    { match: /github/i,          label: 'GitHub',          icon: 'bi-github' },
    { match: /medium/i,          label: 'Medium',          icon: 'bi-medium' },
    { match: /twitter|x\.com/i,  label: 'X (Twitter)',     icon: 'bi-twitter-x' },
    { match: /facebook|meta/i,   label: 'Facebook',        icon: 'bi-facebook' },
    { match: /whatsapp/i,        label: 'WhatsApp',        icon: 'bi-whatsapp' },
    { match: /telegram/i,        label: 'Telegram',        icon: 'bi-telegram' },
    { match: /reddit/i,          label: 'Reddit',          icon: 'bi-reddit' },
    { match: /dev\.to/i,         label: 'DEV Community',   icon: 'bi-code-slash' },
    { match: /hashnode/i,        label: 'Hashnode',        icon: 'bi-rss' },
    { match: /substack/i,        label: 'Substack',        icon: 'bi-envelope-paper' },
    { match: /instagram/i,       label: 'Instagram',       icon: 'bi-instagram' },
    { match: /(^|\.)direct$|^direct$/i, label: 'Direct / typed', icon: 'bi-box-arrow-in-right' },
    { match: /campaign/i,        label: 'Campaign link',   icon: 'bi-megaphone' }
  ];

  function describeReferrer(rawName, refScheme) {
    var name = (rawName || '').trim();
    if (refScheme === 'c') {
      return { label: name || 'Campaign link', icon: 'bi-megaphone', sub: 'Campaign' };
    }
    if (!name || /^direct$/i.test(name) || /^\(direct\)$/i.test(name)) {
      return { label: 'Direct / typed', icon: 'bi-box-arrow-in-right', sub: 'No referrer' };
    }
    for (var i = 0; i < REFERRER_MAP.length; i++) {
      if (REFERRER_MAP[i].match.test(name)) {
        var entry = REFERRER_MAP[i];
        /* Skip the sub-line when it would just repeat the label */
        var sub = entry.label.toLowerCase() === name.toLowerCase() ? '' : name;
        return { label: entry.label, icon: entry.icon, sub: sub };
      }
    }
    return { label: name, icon: 'bi-globe2', sub: 'Referring site' };
  }

  /* ========================================================================== *
   *  Companies & clients
   *
   *  Lives in assets/js/companies.js — that wall is page content, not
   *  analytics. Load companies.js first if you rely on SITE_CONFIG.companies.
   * ========================================================================== */

  /* ========================================================================== *
   *  GoatCounter: pageview tracking + public total
   * ========================================================================== */

  var code = (SITE_CONFIG.goatcounterCode || '').trim();

  function goatcounterEnabled() {
    return !!code && !/^YOUR/i.test(code) && location.protocol !== 'file:';
  }

  function initGoatCounter() {
    if (!goatcounterEnabled()) return;

    /* count.js sends the pageview itself on load. That is deliberate: its
     * built-in guard skips localhost, private IPs and file:// URLs, so local
     * previews never inflate the stats, and it filters known bots. */
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
    document.head.appendChild(script);
  }

  function fetchPublicTotal() {
    if (!goatcounterEnabled()) return Promise.resolve(null);
    var url = 'https://' + code + '.goatcounter.com/counter/TOTAL.json';
    return fetch(url, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return null;
        var raw = data.count != null ? data.count : data.count_unique;
        var num = Number(String(raw).replace(/[^0-9]/g, ''));
        return isFinite(num) && num > 0 ? num : null;
      })
      .catch(function () { return null; });
  }

  /* ========================================================================== *
   *  GoatCounter API (optional token) — full breakdowns
   * ========================================================================== */

  /* Last API failure, surfaced in the panel so problems are visible */
  var lastApiError = null;

  function hasToken() {
    var token = (SITE_CONFIG.apiToken || '').trim();
    return !!token && !/^YOUR/i.test(token);
  }

  function apiAuthHeader() {
    var token = (SITE_CONFIG.apiToken || '').trim();
    if (!token || /^YOUR/i.test(token)) return null;
    /* Bearer is GoatCounter's documented scheme. Basic also works, but Bearer
     * is the one the API docs use and is unambiguous. */
    return 'Bearer ' + token;
  }

  function apiGet(path, params) {
    var auth = apiAuthHeader();
    if (!auth) return Promise.reject(new Error('no-token'));

    var url = new URL('https://' + code + '.goatcounter.com/api/v0/' + path);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] != null) url.searchParams.set(key, params[key]);
    });

    return fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) {
        /* Surface the reason instead of swallowing it — a 400 here is usually
         * a query-parameter problem, a 401 a bad/absent token, a 403 a token
         * without permission. Network/CORS failures land in .catch() instead. */
        lastApiError = 'HTTP ' + res.status + ' on ' + path;
        console.warn('[site.js] GoatCounter API', res.status, url.toString());
        throw new Error('api-' + res.status);
      }
      lastApiError = null;
      return res.json();
    }).catch(function (err) {
      if (!lastApiError) lastApiError = 'network/CORS failure on ' + path;
      throw err;
    });
  }

  function isoDay(date) {
    return date.toISOString().slice(0, 10);
  }

  function startOfMonth() {
    var now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  function fetchFullStats() {
    var today = isoDay(new Date());
    var monthStart = isoDay(startOfMonth());
    var allTime = '2000-01-01';

    /* Reset so a previous run's failure is never reported against this one */
    lastApiError = null;

    /* GoatCounter's query parser accepts `2026-09-15` and
     * `2026-09-15T23:59:59Z`, but NOT `2026-09-15 23:59:59` (space separator)
     * — it answers those with HTTP 400 "no suitable time formats".
     * Use a plain date / RFC3339 here or every call fails silently. */
    var endOfToday = today + 'T23:59:59Z';

    return Promise.all([
      /* Public all-time counter (needs "allow visitor counts" in GoatCounter) */
      fetchPublicTotal(),
      /* All-time totals from the API, so the panel still works without it */
      apiGet('stats/total', { start: allTime, end: endOfToday }).catch(function () { return null; }),
      apiGet('stats/toprefs', { start: monthStart, end: endOfToday, limit: 8 }).catch(function () { return null; }),
      apiGet('stats/locations', { start: monthStart, end: endOfToday, limit: 8 }).catch(function () { return null; }),
      apiGet('stats/browsers', { start: monthStart, end: endOfToday, limit: 8 }).catch(function () { return null; }),
      apiGet('stats/hits', { start: monthStart, end: endOfToday, limit: 5 }).catch(function () { return null; })
    ]).then(function (results) {
      return {
        publicTotal: results[0],
        allTime: results[1],
        referrers: results[2],
        locations: results[3],
        browsers: results[4],
        pages: results[5],
        apiWorked: !!(results[1] || results[2] || results[3] || results[4] || results[5])
      };
    });
  }

  /* Sum the daily buckets GoatCounter returns for the requested range */
  function sumDaily(totalResponse) {
    if (!totalResponse || !totalResponse.stats) return null;
    return totalResponse.stats.reduce(function (acc, row) {
      return acc + (Number(row.daily) || 0);
    }, 0);
  }

  /* ========================================================================== *
   *  Local fallback counting (this browser only)
   * ========================================================================== */

  var LOCAL_KEY = 'rm.local-visits.v1';

  function readLocalVisits() {
    try {
      var parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : { visits: 0, days: {} };
    } catch (e) {
      return { visits: 0, days: {} };
    }
  }

  function recordLocalVisit() {
    var state = readLocalVisits();
    var now = new Date();
    var stamp = Date.now();

    /* Count a new visit at most once every 30 minutes in this browser */
    if (!state.last || stamp - state.last > 30 * 60 * 1000) {
      state.visits = (state.visits || 0) + 1;
      state.last = stamp;
    }

    var day = isoDay(now);
    state.days = state.days || {};
    state.days[day] = (state.days[day] || 0) + 1;

    /* Keep the store small */
    var keys = Object.keys(state.days).sort();
    while (keys.length > 60) delete state.days[keys.shift()];

    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch (e) { /* storage disabled — ignore */ }
    return state;
  }

  function detectReferrer() {
    var ref = document.referrer || '';
    if (!ref) return { label: 'Direct / typed', icon: 'bi-box-arrow-in-right', sub: 'No referrer' };
    try {
      var host = new URL(ref).hostname.replace(/^www\./, '');
      var described = describeReferrer(host, 'h');
      described.sub = host;
      return described;
    } catch (e) {
      return { label: 'Direct / typed', icon: 'bi-box-arrow-in-right', sub: 'No referrer' };
    }
  }

  /* ========================================================================== *
   *  Panel rendering
   * ========================================================================== */

  function setText(selector, value) {
    var node = $(selector);
    if (node) node.textContent = value;
  }

  function renderList(selector, rows, emptyMessage) {
    var list = $(selector);
    if (!list) return;
    list.innerHTML = '';

    /* Keep a row when it has a NAME even if the label is blank: GoatCounter
     * returns `"name": ""` for direct/unattributed traffic, which is a real
     * data point and must not be dropped. */
    var items = (rows || []).filter(function (row) {
      return row && (row.label || row.name || row.label === '' || row.name === '');
    });
    if (!items.length) {
      list.appendChild(el('li', 'stats-empty', emptyMessage || 'No data yet.'));
      return;
    }

    var max = items.reduce(function (acc, row) {
      return Math.max(acc, Number(row.count) || 0);
    }, 0) || 1;

    items.forEach(function (row) {
      var li = el('li', 'stats-row');
      var icon = row.icon || 'bi-dot';
      /* Fall back rather than render an empty label */
      var label = row.label || row.name || 'Direct / typed';

      li.innerHTML =
        '<i class="bi ' + escapeAttr(icon) + '"></i>' +
        '<span class="stats-row-body">' +
        '<span class="stats-row-label">' + escapeAttr(label) + '</span>' +
        (row.sub ? '<span class="stats-row-sub">' + escapeAttr(row.sub) + '</span>' : '') +
        '</span>' +
        '<span class="stats-row-count">' + formatNumber(row.count) + '</span>' +
        '<span class="stats-row-bar" style="--stats-fill:' +
        Math.round(((Number(row.count) || 0) / max) * 100) + '%"></span>';
      list.appendChild(li);
    });
  }

  function firstDayCount(totalResponse) {
    if (!totalResponse || !totalResponse.stats) return null;
    var stats = totalResponse.stats;
    if (!stats.length) return 0;
    return Number(stats[stats.length - 1].daily) || 0;
  }

  /* Nothing but the local browser counter is available yet */
  function showLocalFallback(state, reason) {
    var ref = detectReferrer();

    setText('#stats-total-visits', formatNumber(state.visits));
    setText('#stats-total-meta', 'this browser only');
    setText('#stats-total-unique', '—');
    setText('#stats-unique-meta', 'needs GoatCounter setup');
    setText('#stats-today', formatNumber(state.days[isoDay(new Date())] || 0));
    setText('#stats-today-meta', 'this browser only');
    setText('#stats-month', '—');
    setText('#stats-month-meta', 'needs GoatCounter setup');

    renderList('#stats-referrers', [{ label: ref.label, icon: ref.icon, sub: ref.sub, count: state.visits || 1 }],
      'No source data yet.');
    renderList('#stats-countries', [], 'Location data needs a GoatCounter token.');
    renderList('#stats-browsers', [], 'Browser data needs a GoatCounter token.');
    renderList('#stats-pages', [], 'Page data needs a GoatCounter token.');

    var note = $('#stats-source-note');
    if (note) {
      note.textContent = reason ||
        'GoatCounter is not connected yet, so these numbers cover this browser only.';
    }

    var footnote = $('#stats-footnote');
    if (footnote) {
      footnote.innerHTML =
        'To see real visitor totals, traffic sources (LinkedIn, Google, direct), locations and browsers, ' +
        'create a free GoatCounter site and paste its code into <code>assets/js/site.js</code>. ' +
        'Adding a read-only API token unlocks the source breakdowns in this panel.';
    }
  }

  function renderFullStats(data) {
    var allTime = data.allTime;
    /* Prefer the public counter; fall back to summed API data */
    var total = data.publicTotal != null ? data.publicTotal : sumDaily(allTime);
    var today = firstDayCount(allTime);

    setText('#stats-total-visits', total != null ? formatNumber(total) : '—');
    setText('#stats-total-meta', total != null ? 'all time' : 'not available yet');
    setText('#stats-total-unique', total != null ? formatNumber(total) : '—');
    setText('#stats-unique-meta', 'sessions, not pageviews');
    setText('#stats-today', today != null ? formatNumber(today) : '—');
    setText('#stats-month', '—');
    setText('#stats-month-meta', 'see dashboard');

    var note = $('#stats-source-note');
    if (note) {
      if (data.apiWorked) {
        note.textContent = 'Live from GoatCounter — traffic sources, locations and browsers for the current month.';
      } else if (hasToken()) {
        /* A token IS set, so "add a token" would be misleading */
        note.textContent = 'Visit totals are live, but the breakdown requests failed' +
          (lastApiError ? ' (' + lastApiError + ')' : '') +
          '. Open the browser console for details.';
      } else {
        note.textContent = 'Visit totals are live. Source, location and browser breakdowns stay in the GoatCounter dashboard.';
      }
    }

    if (data.apiWorked) {
      /* GoatCounter returns referrers under `refs` (documented) but direct /
       * unattributed traffic under `stats`, with an empty name. Read whichever
       * key is present so the Direct row is not silently lost. */
      var refRows = (data.referrers || {}).refs || (data.referrers || {}).stats || [];
      var referrers = refRows
        .filter(function (row) { return Number(row.count) > 0; })
        .map(function (row) {
          var described = describeReferrer(row.name, row.ref_scheme);
          return { label: described.label, sub: described.sub, icon: described.icon, count: row.count };
        });
      renderList('#stats-referrers', referrers, 'No referrers recorded this month.');

      renderList('#stats-countries', ((data.locations || {}).stats || []).map(function (row) {
        return { label: row.name, icon: 'bi-geo-alt-fill', count: row.count };
      }), 'No location data this month.');

      renderList('#stats-browsers', ((data.browsers || {}).stats || []).map(function (row) {
        return { label: row.name, icon: 'bi-window-stack', count: row.count };
      }), 'No browser data this month.');

      renderList('#stats-pages', ((data.pages || {}).hits || []).map(function (row) {
        return { label: row.path || row.title || '/', icon: 'bi-signpost-split', count: row.count };
      }), 'No page data this month.');
    } else {
      /* Say which of the two problems it actually is */
      var why = hasToken()
        ? 'Request failed' + (lastApiError ? ' (' + lastApiError + ')' : '') + ' — see the browser console.'
        : 'Set a read-only API token in assets/js/site.js to show this here.';
      renderList('#stats-referrers', [], why);
      renderList('#stats-countries', [], why);
      renderList('#stats-browsers', [], why);
      renderList('#stats-pages', [], why);
    }

    var footnote = $('#stats-footnote');
    if (footnote) {
      footnote.textContent = data.apiWorked
        ? 'Source and location data come from the GoatCounter API for the current month.'
        : 'Totals come from the public GoatCounter counter. Add a read-only API token in assets/js/site.js to show sources here.';
    }
  }

  /* ========================================================================== *
   *  Panel open / close
   * ========================================================================== */

  var panel, toggleButton, lastFocused;

  function openPanel() {
    if (!panel) return;
    panel.hidden = false;
    document.body.classList.add('stats-open');
    if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
    var close = $('.stats-panel-close', panel);
    if (close) close.focus();
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove('stats-open');
    if (toggleButton) toggleButton.setAttribute('aria-expanded', 'false');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function wirePanel() {
    panel = $('#site-stats-panel');
    toggleButton = $('#stats-toggle');
    if (!panel) return;

    if (toggleButton) {
      toggleButton.addEventListener('click', function () {
        lastFocused = document.activeElement;
        if (panel.hidden) openPanel(); else closePanel();
      });
    }

    panel.querySelectorAll('[data-stats-close]').forEach(function (node) {
      node.addEventListener('click', closePanel);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) closePanel();
    });

    if (SITE_CONFIG.openOnHash && location.hash === SITE_CONFIG.openOnHash) openPanel();
  }

  function loadStats() {
    var localState = readLocalVisits();

    fetchFullStats().then(function (data) {
      var apiTotal = sumDaily(data.allTime);
      var hasRemoteTotal = data.publicTotal != null || (apiTotal != null && apiTotal > 0) || data.apiWorked;

      if (hasRemoteTotal) {
        renderFullStats(data);
        var footerCount = data.publicTotal != null ? data.publicTotal : apiTotal;
        if (SITE_CONFIG.showFooterCount && footerCount != null && footerCount > 0) {
          var footer = $('#footer-visitors');
          var countNode = $('#footer-visitors-count');
          if (countNode) countNode.textContent = formatNumber(footerCount);
          if (footer) footer.hidden = false;
        }
      } else {
        showLocalFallback(localState);
      }
    }).catch(function () {
      showLocalFallback(localState);
    });
  }

  /* ========================================================================== *
   *  Boot
   * ========================================================================== */

  function boot() {
    initGoatCounter();
    recordLocalVisit();

    wirePanel();

    var year = $('#footer-year');
    if (year) year.textContent = String(new Date().getFullYear());

    /* Load totals after the page has settled so they stay off the critical path */
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(loadStats, { timeout: 2500 });
    } else {
      window.setTimeout(loadStats, 1200);
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', function () {
        if (panel && !panel.hidden) loadStats();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
