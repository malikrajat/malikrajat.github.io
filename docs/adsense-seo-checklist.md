# AdSense + SEO implementation and launch checklist

This document records what was implemented on rajatmalik.dev for Google AdSense and
Google Search, and the manual steps that still have to happen inside Google's
products. Code cannot guarantee approval: AdSense review is a policy and content-quality
decision made by Google. What the site can do is remove every technical and structural
reason for rejection and give reviewers substantial, original content to assess.

The companion document [adsense-policy-compliance.md](adsense-policy-compliance.md) maps the
AdSense Program policies, Google Publisher Policies/Restrictions and ad implementation rules
to the site, and lists the console settings that must match the code.

---

## 1. What is now implemented in the repository

### AdSense and consent

| Item | Where | Notes |
| --- | --- | --- |
| AdSense publisher meta tag | every page `<head>` | `google-adsense-account` = `ca-pub-4991682021863699` |
| AdSense script | content pages only | Home, About, article hub and the six articles. Deliberately absent from Contact, Privacy, Terms and 404, so utility pages stay ad-free under the “screens without publisher-content” and “private communications” policies. |
| Publisher ID matches ads.txt | `ads.txt` | `google.com, pub-4991682021863699, DIRECT, f08c47fec0942fa0` |
| Google Consent Mode v2 defaults | `assets/js/consent-defaults.js` | Loaded synchronously **before** GTM and AdSense. Granted outside the EEA/UK/CH; denied in those regions until consent. |
| Cookie banner | `assets/js/consent.js` | Accept all / reject non-essential, saved in `localStorage`, re-openable from every footer ("Cookie settings"). |
| Consent update signals | `assets/js/consent.js` | Sends `gtag('consent','update', …)` on every choice. |
| Direct ad opt-out | every footer | “Ad settings” links to Google Ads Settings. |

> **EEA/UK/Swiss traffic:** Google requires a **Google-certified CMP** for ads in those
> regions. Enable it in AdSense → **Privacy & messaging** → GDPR message and publish it.
> The site banner remains a useful site-wide notice and handles non-Google storage, but
> the AdSense GDPR message is the signal Google requires for personalised ads there.
> Publish the **LGPD message** for Brazil at the same time if you want consent-based ads
> there.

### Required policy and trust pages

| Page | URL | Purpose |
| --- | --- | --- |
| Privacy policy | `/privacy-policy.html` | Cookies, AdSense/DoubleClick disclosure, GoatCounter, Formspree, Google Fonts/Maps, GDPR/UK/LGPD/CCPA/India DPDP rights, retention, opt-outs |
| Terms of use | `/terms.html` | Content ownership, permitted use, advertising and affiliate disclosure, testimonials, liability |
| About | `/about.html` | Author identity, experience, expertise, credentials, contact paths (E-E-A-T) |
| Contact | `/contact.html` | Direct channels, contact form, response expectations, FAQ |
| 404 | `/404.html` | Useful recovery page, `noindex` |

All four are linked in the footer of every page, and About/Contact are in the header.

### Original content (the main AdSense approval factor)

An articles hub plus six long-form, original articles, each with its own canonical URL,
unique title and meta description, Article/BlogPosting structured data, breadcrumbs,
author box and internal links:

- `/articles/` — hub with editorial standards
- `/articles/angular-performance-checklist.html`
- `/articles/micro-frontend-boundaries.html`
- `/articles/core-web-vitals-order-of-operations.html`
- `/articles/design-systems-that-survive.html`
- `/articles/ai-assisted-frontend-development.html`
- `/articles/wcag-2-2-component-checklist.html`

The home page now has an "Articles on this site" section linking to all six, so the content
is reachable from the root in one click.

### Technical SEO (Google SEO Starter Guide coverage)

- **Titles and descriptions:** unique `<title>` and meta description on every page; the
  old keyword-stuffed `meta keywords` tag was removed (Google ignores it).
- **Canonical URLs:** one absolute canonical per page.
- **Crawlability:** `robots.txt` allows all search engines, explicitly allows
  `AdsBot-Google`, `AdsBot-Google-Mobile` and `Mediapartners-Google`, and points to the
  sitemap. No page or asset needed by crawlers is blocked.
- **Sitemap:** `sitemap.xml` lists all 12 indexable URLs with `lastmod`.
- **Structured data:** Person, ProfilePage/AboutPage/ContactPage/CollectionPage, WebSite,
  BlogPosting, BreadcrumbList; all JSON-LD validates.
- **Social previews:** Open Graph and Twitter card tags on every page; image dimensions
  corrected to the real 840×400 asset.
- **Semantics:** one `<h1>` per page, descriptive headings, real `<nav>`, `<main>`,
  `<article>`, `<aside>`, `<footer>`, breadcrumb navigation and a skip link.
- **Internal linking:** header, footer, article hub, related-reading boxes and prev/next
  links connect the new pages.
- **RSS:** `feed.xml` lists all articles.
- **AI/answer-engine discovery:** `llms.txt` updated with the article catalogue, policies,
  key facts and last-updated date; linked from the home page `<head>` and `robots.txt`.
- **Mobile:** `manifest.webmanifest` with 192/512 icons; responsive layouts on all new pages.
- **404:** custom GitHub Pages 404 with `noindex`.
- **Performance hygiene:** no new blocking JS; new pages use the existing cached CSS/JS;
  article pages omit the home page's animation/isotope stack.

### Privacy and security fixes made along the way

- The full apartment address was removed from the visible home page (city/country kept).
- The hard-coded GoatCounter API token in `assets/js/site.js` was removed. **Revoke that
  token in GoatCounter** — it was public in the repository and in the deployed JS, and
  GoatCounter keys are all-or-nothing. Removing it from the file does not invalidate the
  leaked key.

---

## 2. Manual steps, in order

### A. Publish

1. Review the new pages locally (`python -m http.server 8000`, then open
   `http://localhost:8000/`).
2. Commit and push to the branch GitHub Pages deploys from.
3. Confirm the live URLs return 200 over HTTPS:
   - `https://rajatmalik.dev/`
   - `https://rajatmalik.dev/about.html`
   - `https://rajatmalik.dev/articles/`
   - `https://rajatmalik.dev/privacy-policy.html`
   - `https://rajatmalik.dev/terms.html`
   - `https://rajatmalik.dev/sitemap.xml`
   - `https://rajatmalik.dev/robots.txt`
   - `https://rajatmalik.dev/ads.txt`

### B. Google Search Console (do this first)

1. Confirm the property `rajatmalik.dev` is verified (the meta tag is already present).
2. **Sitemaps** → submit `https://rajatmalik.dev/sitemap.xml`.
3. **URL Inspection** → request indexing for the home page, About, the article hub, each of
   the six articles, Contact, Privacy and Terms. Do not request the same URL repeatedly.
4. Check **Page indexing** after a few days; fix any "Crawled – currently not indexed" pages
   by improving content and internal links, not by resubmitting.
5. Check **Core Web Vitals** and **HTTPS** reports after field data accumulates.
6. Optional: verify in Bing Webmaster Tools and submit the same sitemap.

### C. AdSense console

1. **Sites** → add `rajatmalik.dev` if it is not already listed. The verification meta tag
   and script are live after publishing, so click **Verify**.
2. **Privacy & messaging** → create and publish a **GDPR message** for EEA/UK/CH, an
   **LGPD message** for Brazil, and a CCPA message if you want one for California. Without
   the GDPR message, Google may serve limited or no ads to those visitors.
3. **Auto ads** → after approval, enable the formats you actually want. Keep **In-page
   ads**; turn off **Anchor** and **Vignette** if they obscure content, navigation or the
   resume download buttons. Exclude `/contact.html`, `/privacy-policy.html`,
   `/terms.html` and `/404.html` by URL, and cap ad density at low/medium.
4. Complete **Payments**, **Tax** and **Identity/address verification** now rather than
   after approval; these commonly delay first payment.
5. Only click **Request review** once the site is live, indexed, and you have checked every
   page yourself on mobile. Review is typically days to a few weeks.
6. After approval, review the **Policy center** and **Ad review center** weekly. Act on
   every notification site-wide, not just the example URL.

### D. Do not do these (common policy failures)

- Click your own ads or ask anyone to click them, including "support me" requests.
- Offer rewards, content unlocks or entries for viewing/clicking ads.
- Put ads on pages with no meaningful content (thank-you pages, empty category pages, the
   contact form itself).
- Use pop-ups, overlays or interstitials that block the main content.
- Publish scraped, spun, auto-generated or duplicate content. The six articles are original;
  keep it that way.
- Republish the same article in full on Medium/DEV without a canonical link to the on-site
  version, which competes with your own page.
- Add affiliate links without a clear disclosure before the link.

---

## 3. Why a portfolio can be rejected — and what to do

The most common AdSense rejection reasons for personal sites are **"low value content"**,
**"insufficient content"** and **"site does not comply with policies"**. A one-page CV with
mostly outbound links is a thin site, even when it is well designed.

This repository now has 12 indexable pages: six substantial technical articles, an About page,
a Contact page, Privacy, Terms, the hub and the portfolio home. That is a real content base,
but approval still depends on quality and on keeping it current.

Recommended cadence:

- Publish **2–4 original articles per month** for the next three months. Aim for 1,000+
  words that answer a specific question better than the existing results.
- Update the oldest article first each quarter; put the real `dateModified` in the JSON-LD.
- Link new articles from the hub and from at least two related older articles.
- Share each article on LinkedIn and in *The Angular Insider* newsletter. Traffic and
  engagement help; bought traffic does not.
- Keep the About page accurate and the contact channels working. Reviewers do check them.

Ten follow-up topics that fit the site's expertise:

1. Migrating an Angular app to zoneless change detection: a staged plan.
2. Signals vs RxJS: choosing state primitives per use case.
3. A practical bundle-budget setup for Angular and React in CI.
4. Micro-frontend observability: versioned telemetry and error boundaries.
5. Designing forms that pass WCAG 2.2 without a rewrite.
6. Core Web Vitals for authenticated dashboards.
7. Nx module boundaries that actually stop circular dependencies.
8. When a design system should say no: deprecation and migration.
9. AI code review: prompts, guard rails and what still needs a human.
10. Measuring the real cost of third-party scripts.

---

## 4. Verification checklist

- [ ] Live site returns 200 on all 12 sitemap URLs.
- [ ] `view-source:` shows the AdSense meta tag and `adsbygoogle.js` on every page.
- [ ] `ads.txt` shows `google.com, pub-4991682021863699, DIRECT, f08c47fec0942fa0`.
- [ ] `robots.txt` fetches without error and contains the sitemap line.
- [ ] `sitemap.xml` is valid XML and accepted by Search Console.
- [ ] Article pages pass the Rich Results Test (BlogPosting + Breadcrumb).
- [ ] Mobile-friendly test / responsive check passes on home, article, contact and privacy.
- [ ] Cookie banner shows on first visit; choice persists; "Cookie settings" reopens it.
- [ ] Consent Mode appears in Tag Assistant before GTM/AdSense fire.
- [ ] AdSense GDPR message is published (EEA/UK/CH).
- [ ] Payment, tax and identity verification completed.
- [ ] AdSense script appears only on content pages, not on Contact, Privacy, Terms or 404.
- [ ] Footer “Ad settings” link opens Google Ads Settings.
- [ ] Privacy policy contains the three required Google cookie/ad disclosures and the
      partner-sites link.
- [ ] GoatCounter API token revoked and replaced with an empty value.
- [ ] Search Console sitemap submitted and key URLs indexed.
- [ ] Request review submitted only after all of the above.

---

## 5. Honest limitations

- These changes remove technical and content-structure blockers. They cannot guarantee
  AdSense approval, ranking positions or revenue.
- Search indexing and AdSense review both take time. Re-crawling after a sitemap submission
  is usually days; AdSense review can take longer.
- The six articles were drafted for this repository and must be reviewed by the site owner
  before publishing under his name. Check every personal claim, metric and code sample.
- Google's products and policies change. Re-check the AdSense programme policies and the
  Search Essentials before each review request.
