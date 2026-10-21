# Browser checks — menu 2026 and homepage opening

Build first with `python3 scripts/build.py`, then run `node tests/browser.cjs`.

Playwright and Chromium are development-only tools. The script starts and stops its own local Python HTTP server. Use an installed `playwright` module or set `PLAYWRIGHT_MODULE`; the managed environment also provides it at `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`. `CHROMIUM_PATH` defaults to `/usr/bin/chromium`.

Options:

- `BASE_URL`: use an existing local server.
- `SCREENSHOT_DIR`: destination for screenshots and report (default `/tmp/alberto-review-2026`).

The independent `menu-2026.json` fixture preserves the PDF's source hash, category order, raw source rows, descriptions, prices and portions. It was prepared from two independent PDF audits before the production menu rewrite. The old `v1-menu.json` stays unchanged as a historical reference; it is no longer the expected current menu. No checkout of the old Git repository is needed to test the new menu.

Checks cover:

- All nine pages, local assets/anchors, metadata and schema.
- 151 menu rows, 153 prices, 18 categories, exact portions and removal of old products.
- Category selection, search, Back/Forward, legacy links, malformed hashes and literal markup input.
- Rapid typing, composition/accents and a synthetic input-to-render measurement under 4× CPU throttling.
- Original hero photograph by SHA-256, full-width viewport composition and headline/action placement at 1440×900, 390×844 and 320×568.
- Visible automatic GSAP logo intro on fresh entry and reload, including visitors with the previous session flag and browsers that block session storage. Captures the active intro on desktop and mobile.
- Intro completion/interruption, anchor visits, runtime Reduced Motion, native touch scrolling and desktop Lenis.
- Video viewport playback, manual pause, reduced motion/data saver, browser autoplay rejection and JavaScript-free controls.
- Gallery filtering/lightbox and mobile dialog focus, scroll restoration and Escape.
- Three social SVG links on every footer and on Kontakt.
- All nine pages at 1440, 820, 390, 360 and 320 pixels.
- Content and navigation without JavaScript or optional animation libraries.

The direct `file://` opening check is attempted. If Chromium explicitly returns `ERR_BLOCKED_BY_ADMINISTRATOR`, only that check is recorded as skipped with its reason. Browser policy is never disabled. All pages and assets still undergo the local HTTP checks; the skipped case must not be reported as verified direct file opening.

`delivery-results.json` records passed/failed/skipped checks, browser errors, lab measurements and SHA-256 hashes of tested source files. `scripts/package.py` rejects failures or changed sources. Screenshots must also be reviewed visually. These checks are not a field INP measurement, a real iPhone/Safari test, or a live test of ordering/reservation providers.

Automatic rating adapter checks: `node --test tests/ratings.cjs` and `node tests/ratings-browser.cjs`. The latter uses controlled provider fixtures; it does not prove live Google API access. Production HTML contains no fixture scores. See `server/README.md` for activation status.
