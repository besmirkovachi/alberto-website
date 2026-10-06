# Ristorante Pizzeria Alberto

A new, German-language, nine-page restaurant website built around Alberto's original photography and branding. Static HTML, CSS and small independent JavaScript enhancements; no application server, production npm packages or third-party embeds.

## Run locally

From the project directory:

```sh
python3 scripts/build.py
python3 -m http.server 8000 --bind 127.0.0.1
```

Python 3's standard library is sufficient. Generated HTML is included, so serving an existing build does not require running the generator. Use the existing cloud checkout; a new Git worktree is unnecessary.

## Edit the website

| File | Purpose |
| --- | --- |
| `templates/*.html` | Page copy and page-specific sections |
| `menu.json` | All supplied menu names, prices, descriptions and groups |
| `scripts/build.py` | Shared navigation, footer, menu rendering, gallery and metadata |
| `style.css` | Responsive design, typography and motion |
| `script.js` | Mobile navigation, hero sequence, menu filtering and gallery |
| `assets/` | Original media and generated optimizations |

Run `python3 scripts/build.py` after editing templates, the menu or shared markup. Root HTML files are generated: edits made directly to those files will be overwritten on the next build. Menu data is rendered into HTML rather than fetched at runtime; it remains readable without JavaScript.

The pages are Home, Speisekarte, Über uns, Galerie, Private Feiern, Lieferung, Kontakt, Impressum and Datenschutz. Existing page filenames remain valid. The menu supports direct category links such as `speisekarte.html#pizza`; older `#menu-N` links are also recognized by JavaScript.

## Media and behavior

- Original photographs and video are retained. `assets/responsive/` holds 480px and 960px WebP derivatives; images include dimensions, responsive sources and appropriate lazy loading.
- The two font families are served locally. Their licenses are included in `assets/fonts/`.
- The homepage has a brief masked entrance, a three-image sequence with manual/pause controls, and section reveals. Reduced-motion preferences disable automatic animation. Session storage records only whether the entrance has already played in the current tab session.
- The kitchen video loads on demand and pauses when it leaves view. It never autoplays.
- The private upstairs room has a dedicated page, with telephone contact and no fixed guest capacity or booking system.
- Delivery is advertised from the supplied €20 minimum. External ordering links lead to the existing services; no payment or ordering backend is simulated.
- Navigation and core content work without JavaScript. The gallery uses native modal dialogs with keyboard controls and focus restoration.

The shared navigation and page builder can accommodate a future reservation page without coupling it to the menu or event-room content. No reservation feature is currently implemented.

## Validate

```sh
python3 scripts/build.py
node --check script.js
node tests/browser.cjs
```

The browser checks use Playwright and Chromium available in the cloud environment. See `tests/README.md` for other machines and the scope of the checks. Screenshots and the test report are written outside the checkout, by default in `/tmp/alberto-review`.

## Public launch

Default builds deliberately retain draft search-indexing settings. Complete the supplied legal drafts with the actual owner's and hosting details, and verify menu prices and ambiguous allergen codes with the restaurant before launch. No awards, reviews or missing legal identities have been invented.

When the final website URL and launch content are approved, set `SITE_URL` to that HTTPS URL and `SITE_INDEXABLE=1`, then run the generator. It creates canonical URLs, absolute social images and `sitemap.xml`, and updates the robots directives. Indexable builds require `SITE_URL`; a draft build without a URL removes a stale generated sitemap. The website's final hosting address is not assumed to be the existing external ordering address.

Build and validation do not deploy the website. Verify the live hosting configuration and external order links as part of a later deployment.
