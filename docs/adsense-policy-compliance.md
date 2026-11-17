# AdSense policy compliance matrix

This document maps every policy area in Google's AdSense / Publisher policy set to what the
site does, what was changed, and what must be configured in the AdSense console. It is an
operational checklist, not legal advice.

Policy sources reviewed (August 2026 versions of the pages):

1. AdSense Program policies — https://support.google.com/adsense/answer/48182
2. Families / age-restricted treatment — https://support.google.com/adsense/topic/9020627
3. Monetization and ads / invalid traffic — https://support.google.com/adsense/topic/9886078
4. Privacy and security / user-generated content — https://support.google.com/adsense/topic/9886175
5. Required content (privacy policy disclosures) — https://support.google.com/adsense/answer/1348695
6. LGPD — https://support.google.com/adsense/topic/9930900
7. Ad implementation guidelines — https://support.google.com/adsense/topic/1271508
8. Ad placement policies — https://support.google.com/adsense/answer/1346295
9. Modifications of AdSense ad code — https://support.google.com/adsense/answer/1354736
10. AdSense policy FAQs — https://support.google.com/adsense/answer/3394713
11. Google Publisher Policies — https://support.google.com/adsense/answer/10502938
12. Google Publisher Restrictions — https://support.google.com/adsense/answer/10437795
13. Google Publisher Policies / Restrictions help centre — https://support.google.com/publisherpolicies

---

## 1. AdSense Program policies

| Policy | Site status | Implementation / evidence |
| --- | --- | --- |
| Invalid clicks and impressions | Compliant | No paid traffic, no click exchanges, no automated tools, no self-clicks. Terms prohibit invalid activity and state that no one is asked to click ads. |
| Encouraging clicks or views | Compliant | No "support us / click the ads" language, no arrows or gimmicks, no compensation, no ads disguised as content. Terms include an explicit no-incentive statement. |
| Traffic sources | Compliant | Content is promoted organically (LinkedIn, newsletter, search). No paid-to-click, autosurf, mass email or software-triggered traffic. |
| Ad behavior | Compliant | The standard, unmodified AdSense Auto ads snippet is used. No code modification, refresh, targeting manipulation or click alteration. |
| Ad placement | Compliant | Ad script is loaded only on content pages (home, About, articles hub, six articles). Contact, privacy, terms and 404 are deliberately ad-free. No pop-ups, emails, software, private communication or framed pages. |
| Site behavior | Compliant | Static site, clear navigation, no redirects, downloads, malware, pop-ups or pop-unders. The stats panel and cookie banner require user action and do not interfere with navigation. |
| Sensitive events | Not applicable | No news/emergency content or sensitive-event monetization. |
| Product-specific policies | Not applicable | AdSense for Search, AdMob, rewarded inventory and video are not used. |

## 2. Google Publisher Policies

### Content policies

| Category | Status | Why |
| --- | --- | --- |
| Illegal content / IP abuse | Compliant | Original portfolio and technical articles; trademarks are used only to identify employers, clients and tools; no copyrighted material reproduced. |
| Dangerous or derogatory content | Compliant | No hate, harassment, threats, self-harm, extremism or extortion content. |
| Animal cruelty | Compliant | Not applicable. |
| Misrepresentative content | Compliant | Author identity, role, experience and contact details are accurate. Articles are labelled as opinion/experience where relevant. No fake affiliation or fake download claims. |
| Unreliable/harmful claims | Compliant | Technical content only; no medical, electoral, climate or scientific misinformation. |
| Deceptive practices | Compliant | No phishing, fake documents, get-rich-quick schemes, identity concealment or political content. |
| Manipulated media | Compliant | No manipulated media. |
| Enabling dishonest behaviour | Compliant | No hacking instructions, spyware, bypass tools or fake documents. |
| Sexually explicit / compensated sexual acts / mail-order brides | Compliant | No adult or sexual content. |
| Adult themes in family content | Compliant | No child-oriented content and no adult themes. |
| Child sexual abuse and exploitation | Compliant | No such content; any report would be escalated to the authorities. |

### Behavioral policies

| Policy | Status | Why |
| --- | --- | --- |
| Dishonest declarations | Compliant | Publisher ID in `ads.txt` matches the page code; site and contact details are accurate. |
| Ads interfering with content/navigation | Compliant | Ads are not placed by hand near navigation or controls. Auto ads formats must be configured to avoid overlays (see manual steps). The consent banner is a small, dismissible notice, not an ad. |
| Inventory value / no publisher content | Compliant | Ad-free utility pages; ads only alongside long-form articles, the portfolio and the About page. No under-construction screens, alerts or navigation-only screens. |
| Out-of-context ads | Compliant | Ads load only with visible page content, never in background tabs or off-screen placements. |
| Replicated content | Compliant | Articles are original to this domain and are not copied from other sites. |
| More ads than content | Compliant | Ad density can be capped in Auto ads; articles are 1,000+ words each. |
| Unsupported languages | Compliant | English is a supported language. |
| Spam policies | Compliant | No cloaking, doorway pages, scaled content abuse, link spam or keyword stuffing; the keyword meta tag was removed. |
| Abusive experiences | Compliant | No auto-redirects, misleading downloads, false close buttons or pop-unders. |
| Malware / unwanted software | Compliant | Static HTML/CSS/JS with no downloads or executables; dependencies are local vendored libraries. |
| Better Ads Standards | Compliant | No prestitial, pop-up, large sticky ad or auto-playing ad implemented by the site. Auto ads formats must be configured to stay within the standard. |
| Authorized inventory | Compliant | `ads.txt` declares Google as an authorized seller: `google.com, pub-4991682021863699, DIRECT, f08c47fec0942fa0`. |
| Sanctions compliance | Compliant | Publisher and traffic are not in a sanctioned country/region or on a restricted-party list. |

### Privacy-related policies

| Policy | Status | Implementation |
| --- | --- | --- |
| personalized advertising | Compliant | No audience lists, no sensitive-category targeting, no data from children, health, finance, politics, religion, unions or sexual orientation. Google controls personalization. |
| Privacy disclosures | Compliant | `privacy-policy.html` discloses Google/third-party cookies, web beacons, IP addresses, identifiers, the required “third-party vendors, including Google…” wording, opt-outs, third-party ad technology providers and the Google partner-sites link. |
| California opt-out | Compliant | Privacy policy has a “Do Not Sell or Share My Personal Information” mechanism, and every footer links to it. |
| User-generated content | Not applicable | The site has no comments, forums, profiles or public submissions. Testimonials are curated quotes, not open UGC. |
| Cookies on Google domains | Compliant | The site never sets, intercepts or deletes cookies on Google domains. |
| Identifying users | Compliant | No PII is passed to Google ad systems. The contact form goes to Formspree, not to ad targeting. No data disaggregation. |
| Device and location data | Compliant | No precise location collection by the site. The Google Maps embed is disclosed. |
| COPPA / child-directed treatment | Compliant | Professional, general-audience content; privacy policy states it is not directed to children under 13/16 and that no child-directed treatment is requested. |

## 3. Google Publisher Restrictions

The site does not contain sexual content, shocking content, explosives, firearms, other
weapons, tobacco, recreational drugs, alcohol sales/misuse, online gambling, prescription
drugs, unapproved supplements or removed apps. No video inventory is used. No restricted
inventory labels are required.

## 4. Ad implementation rules

| Rule | Status |
| --- | --- |
| No accidental clicks / no ads mistaken for menus, navigation or downloads | Compliant by placement; Auto ads formats still need console review. |
| No unnatural attention (arrows, flashy animation) | Compliant. |
| No misleading headers above ads | Compliant; ads are labelled by Google. |
| No images aligned with individual ads | Compliant. |
| No content formatted to mimic ads | Compliant. |
| No compensation for clicks/views | Compliant; terms say so. |
| No auto-refresh or pre-roll | Compliant. |
| No ads in private communications, emails, software or new windows | Compliant; no such surfaces. |
| No pop-ups/pop-unders | Compliant. |
| Content must be crawlable | Compliant; `robots.txt` allows all relevant crawlers and the sitemap is public. |
| No hidden or overlapping ad units | Compliant; no manual units. Auto ads are visible and responsive. |
| No ad code modification/IFRAME targeting | Compliant; standard snippet only. |
| One publisher per page | Compliant; only this AdSense account is used. |
| Host terms | GitHub Pages permits a static personal site; custom domain configured via `CNAME`. |

## 5. Changes made for this policy pass

- Removed the AdSense script from `contact.html`, `privacy-policy.html` and `terms.html`
  (plus `404.html`, which never had it). Ads now run only on content pages.
- Expanded the privacy policy with the exact required Google disclosures, third-party ad
  technology providers, web beacons/IP addresses, Google's partner-sites link, no-PII
  statement, sensitive-category statement, LGPD/ANPD rights and COPPA/age treatment.
- Added an “Ad serving standards” and “Invalid activity” section to the terms.
- Added a direct “Ad settings” opt-out link and a “Do not sell or share” link to every footer.
- Kept the standard AdSense snippet and `ads.txt` publisher ID unchanged.

## 6. Manual AdSense console settings (required)

1. **Privacy & messaging**
   - Create and publish a **GDPR message** for the EEA, UK and Switzerland.
   - Create and publish an **LGPD message** for Brazil if you want consent-based ads there.
   - Optionally publish a CCPA message for California.
2. **Auto ads**
   - Keep **In-page ads** if you want them; turn off **Anchor** and **Vignette** if they
     overlay content, navigation or the resume download buttons.
   - Exclude `/contact.html`, `/privacy-policy.html`, `/terms.html` and `/404.html` from
     Auto ads as a second layer of protection.
   - Use a low/medium ad density; do not place ads above the fold on the home page if they
     push the actual content below the viewport.
3. **Sites** — verify `rajatmalik.dev` after the updated files are live.
4. **Ads.txt** — confirm `https://rajatmalik.dev/ads.txt` is reachable and shows the
   publisher ID above.
5. **Policy center** — after approval, review it weekly for the first month and act on any
   notification across the whole site, not just the example URL.
6. **Ad review center** — block categories or advertisers that are inappropriate for a
   professional portfolio.
7. **Payments, tax and identity** — complete verification before requesting review.

## 7. Ongoing operating rules

- Never click your own ads, and never ask readers to click them. Do not buy paid-to-click,
  autosurf, click-exchange or bot traffic.
- Do not modify the AdSense snippet or wrap ads in iframes.
- Keep ads off utility pages and away from download/navigation controls.
- Publish original articles and correct errors; do not scrape or republish other people's
  work.
- Keep the privacy policy aligned with every new tool, embed, analytics service or
  advertising partner.
- Re-check the AdSense Program policies, Publisher Policies and Publisher Restrictions
  before each review request and at least quarterly. Policy pages change; the current
  versions are the authority.
