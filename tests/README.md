# Browser checks

Build the site first with `python3 scripts/build.py`, then run:

```sh
node tests/browser.cjs
```

The script uses Playwright and Chromium already installed in the development environment. It starts and stops its own local Python HTTP server. It does not add runtime dependencies to the website or alter the generated pages.

For another machine, install Playwright separately and either make `require('playwright')` available or set `PLAYWRIGHT_MODULE` to its module path. Set `CHROMIUM_PATH` to the browser executable when it is not `/usr/bin/chromium`.

Optional variables:

- `BASE_URL`: use an existing server instead of starting one.
- `SCREENSHOT_DIR`: change the default `/tmp/alberto-review` output directory.

The suite checks the nine pages, local asset and anchor links, metadata and restaurant schema, source menu fidelity, search and category navigation, gallery filtering and lightbox navigation, mobile dialog focus, reduced motion, JavaScript-free fallbacks, browser errors, and horizontal overflow at desktop, tablet and two phone widths. Full-page screenshots and a JSON report are saved for visual review.

Automated checks do not replace reviewing the screenshots, reading legal content before publication, or checking the final public domain and delivery links.
