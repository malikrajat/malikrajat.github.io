# malikrajat.github.io — rajatmalik.dev

The personal site of Rajat Malik: a portfolio, an article library, and the policy pages
required for advertising and privacy compliance. Hand-written HTML/CSS/JS, published from
GitHub Pages at <https://rajatmalik.dev/>.

## Structure

```
index.html                     Portfolio home (experience, work, libraries, products, writing)
about.html                     Long-form author and experience page
contact.html                   Contact channels, form and FAQ
articles/index.html            Article hub + editorial standards
articles/*.html                Six in-depth original articles
privacy-policy.html            Cookies, analytics, AdSense and privacy rights
terms.html                     Terms of use + advertising/affiliate disclosure
404.html                       Custom not-found page
sitemap.xml                    All indexable URLs
robots.txt                     Crawl permissions (search, ads and AI crawlers) + sitemap
llms.txt                       Plain-text profile for assistants and answer engines
feed.xml                       RSS feed for the articles
ads.txt                        Authorised digital sellers (Google AdSense)
manifest.webmanifest           Installable web app metadata
docs/adsense-seo-checklist.md  What was implemented + manual AdSense/Search Console steps
docs/adsense-policy-compliance.md Policy-by-policy matrix and console settings
assets/css/pages.css           Article, policy, contact and cookie-banner styles
assets/js/consent-defaults.js  Google Consent Mode v2 defaults (load before GTM/AdSense)
assets/js/consent.js           Cookie banner and consent updates
assets/js/pages.js             Subpage navigation, TOC and footer year
```

## Local preview

```powershell
python -m http.server 8000
# then open http://localhost:8000/
```

The site has no build step. Everything is static and can be served from any directory.

## Content and advertising

- Advertising is served by Google AdSense (`ca-pub-4991682021863699`) on content pages only.
  Contact, privacy, terms and 404 pages are ad-free. The publisher ID must stay identical
  in `ads.txt` and in the page `<head>`.
- Google Consent Mode v2 defaults live in `consent-defaults.js`. It must stay synchronous
  and must load before Google Tag Manager and AdSense.
- The cookie banner is re-openable from the **Cookie settings** button in every footer.
- Policy pages are linked from every footer. If you add a new data processor, analytics
  tool, embed or affiliate programme, update `privacy-policy.html` and `terms.html` first.
- New articles: add the page, a card in `articles/index.html`, a card in the home page's
  `#articles` section, a URL in `sitemap.xml`, an item in `feed.xml`, and a summary in
  `llms.txt`.

## Before requesting AdSense review

Read `docs/adsense-seo-checklist.md`. It covers Search Console submission, the AdSense
GDPR message, payment/tax verification, the review request and the policy traps to avoid.

## Notes

- The full home address was removed from the public pages; only the city and country remain.
- The GoatCounter API token previously committed in `assets/js/site.js` was removed. Revoke
  it in the GoatCounter dashboard; it was public and remains in git history.
