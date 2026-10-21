#!/usr/bin/env node
"use strict";

// Run with: node tests/browser.cjs
// No project dependencies are required; see tests/README.md for browser setup.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const screenshots = process.env.SCREENSHOT_DIR || "/tmp/alberto-review-2026";
const pages = [
  "index",
  "speisekarte",
  "ueber-uns",
  "galerie",
  "feiern",
  "bestellen",
  "kontakt",
  "impressum",
  "datenschutz",
];
const sourceCommit = "43749a496c5e66064a33e21137de92f53aaf341a";
// This independent fixture comes from the two PDF audits, not production menu.json.
// tests/v1-menu.json remains the historical V1 reference, not the current menu.
const menuReference = JSON.parse(fs.readFileSync(path.join(__dirname, "menu-2026.json"), "utf8"));
const sourceMenu = menuReference.rows;
assert.equal(sourceMenu.length, 151, "2026 PDF contains 151 comparable menu rows");
const socialLinks = {
  Instagram: "https://www.instagram.com/ristorantealberto/",
  Facebook: "https://www.facebook.com/share/18fm5KVA2n/",
  TikTok: "https://www.tiktok.com/@ristorante.alberto",
};
const failures = [];
const passed = [];
const skipped = [];
const metrics = {};
const browserErrors = new Set();
let server;
let browser;
let baseURL = process.env.BASE_URL;

function playwright() {
  if (process.env.PLAYWRIGHT_MODULE)
    return require(process.env.PLAYWRIGHT_MODULE);
  try {
    return require("playwright");
  } catch {
    return require("/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  }
}

async function check(name, run) {
  try {
    await run();
    passed.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    if (error.skipReason) {
      skipped.push({ name, reason: error.skipReason });
      console.log(`SKIP ${name}: ${error.skipReason}`);
      return;
    }
    failures.push({ name, error: error.stack || String(error) });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function serve() {
  if (baseURL) return;
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
  baseURL = `http://127.0.0.1:${port}`;
  server = spawn(
    "python3",
    [
      "-m",
      "http.server",
      String(port),
      "--bind",
      "127.0.0.1",
      "--directory",
      root,
    ],
    { stdio: "ignore" },
  );
  server.on("error", (error) =>
    failures.push({ name: "HTTP server", error: String(error) }),
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${baseURL}/index.html`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local HTTP server did not start.");
}

async function newPage(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    ...options,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on("pageerror", (error) =>
    browserErrors.add(`${page.url()}: ${error.message}`),
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && message.text().startsWith("Alberto:"))
    ) {
      browserErrors.add(`${page.url()}: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      browserErrors.add(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED")
      browserErrors.add(`${request.failure()?.errorText}: ${request.url()}`);
  });
  return { context, page };
}

async function visit(page, slug = "index", suffix = "") {
  const response = await page.goto(`${baseURL}/${slug}.html${suffix}`, {
    waitUntil: "networkidle",
  });
  // Navigating between fragments on the same page has no HTTP response.
  if (response)
    assert.equal(response.status(), 200, `${slug} must return HTTP 200`);
  assert.equal(new URL(page.url()).pathname, `/${slug}.html`);
  await page.evaluate(() => document.fonts.ready);
}

async function settleReveals(page) {
  await page.evaluate(async () => {
    for (
      let y = 0;
      y < document.documentElement.scrollHeight;
      y += window.innerHeight * 0.8
    ) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(
    () =>
      [...document.images]
        .filter(
          (image) => image.hasAttribute("src") && image.getClientRects().length,
        )
        .every((image) => image.complete && image.naturalWidth > 0),
    null,
    { timeout: 10000 },
  );
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images]
        .filter(
          (image) => image.hasAttribute("src") && image.getClientRects().length,
        )
        .map((image) => image.decode()),
    );
  });
}

async function screenshot(page, name) {
  await settleReveals(page);
  await page.screenshot({
    path: path.join(screenshots, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function noOverflow(page, label) {
  const expectedWidth = page.viewportSize().width;
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      width,
      innerWidth: window.innerWidth,
      visualWidth: window.visualViewport?.width,
      scrollWidth: document.documentElement.scrollWidth,
      suspects: [...document.querySelectorAll("body *")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            (rect.right > width + 2 || rect.left < -2)
          );
        })
        .slice(0, 10)
        .map(
          (element) => `${element.tagName.toLowerCase()}.${element.className}`,
        ),
    };
  });
  assert.ok(
    result.width <= expectedWidth + 2 && result.innerWidth <= expectedWidth + 2 && result.scrollWidth <= expectedWidth + 2,
    `${label}: configured ${expectedWidth}, client ${result.width}, inner ${result.innerWidth}, visual ${result.visualWidth}, scrollWidth ${result.scrollWidth}; ${result.suspects.join(", ")}`,
  );
}

async function visibleCategories(page) {
  return page
    .locator(".menu-category:visible")
    .evaluateAll((elements) =>
      elements.map((element) => element.dataset.menuCategory),
    );
}

function expectedMenuRow(row) {
  const sizeMatch = row.name_printed.match(/\s*((?:Fl\.|FI\.)?\s*\d+[,.]?\d*\s*(?:I|l|cl))\s*$/);
  const normalizeSize = (size) => size.trim().replace(/^FI\./, "Fl.").replace(/I$/, "l").replace(/(\d)cl$/, "$1 cl").replace(/\s+/g, " ");
  return {
    page: String(row.page),
    row: String(row.source_row),
    category: row.category,
    name: sizeMatch ? row.name_printed.slice(0, sizeMatch.index).trim() : row.name_printed,
    prices: row.prices,
    description: row.description,
    sizes: row.prices.length > 1
      ? row.price_labels.map((label) => normalizeSize(label.replace(/\s*\d+,\d{2}\s*€$/, "")))
      : sizeMatch ? [normalizeSize(sizeMatch[1])] : [],
  };
}

async function main() {
  fs.mkdirSync(screenshots, { recursive: true });
  await serve();
  browser = await playwright().chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });

  await check(
    "All nine pages: metadata, semantics, local links and referenced assets",
    async () => {
      const { context, page } = await newPage();
      const localReferences = new Set();
      const anchorReferences = [];
      for (const slug of pages) {
        await visit(page, slug);
        assert.equal(
          await page.locator("h1").count(),
          1,
          `${slug}: one main heading`,
        );
        assert.equal(
          await page.locator("main").count(),
          1,
          `${slug}: one main landmark`,
        );
        assert.equal(await page.locator("html").getAttribute("lang"), "de");
        assert.ok(
          (await page.title()).includes("Alberto"),
          `${slug}: page title`,
        );
        assert.ok(
          (
            await page
              .locator('meta[name="description"]')
              .getAttribute("content")
          ).length > 25,
          `${slug}: description`,
        );
        assert.ok(
          await page.locator('meta[property="og:image"]').count(),
          `${slug}: Open Graph image`,
        );
        assert.equal(
          await page.locator("img:not([alt])").count(),
          0,
          `${slug}: image alternatives`,
        );
        assert.ok(
          await page.locator('a[href="tel:+4976216869205"]').count(),
          `${slug}: phone link`,
        );
        for (const [name, url] of Object.entries(socialLinks)) {
          const link = page.locator(`footer a[href="${url}"]`);
          assert.equal(await link.count(), 1, `${slug}: one ${name} footer link`);
          assert.equal(await link.getAttribute("target"), "_blank");
          assert.match(await link.getAttribute("rel"), /noopener/);
          assert.ok((await link.getAttribute("aria-label") || await link.textContent()).includes(name), `${slug}: accessible ${name} name`);
          assert.ok(await link.locator("svg").count(), `${slug}: ${name} icon`);
          if (slug === "kontakt") {
            assert.equal(await page.locator(`main a[href="${url}"]`).count(), 1, `Contact: ${name} also appears in the social section`);
          }
        }
        const data = JSON.parse(
          await page
            .locator('script[type="application/ld+json"]')
            .textContent(),
        );
        assert.equal(data["@type"], "Restaurant");
        assert.equal(data.address.streetAddress, "Holzmattenweg 13");
        assert.equal(data.telephone, "+4976216869205");
        assert.ok(
          data.openingHoursSpecification.every(
            (hours) => !hours.dayOfWeek.includes("Wednesday"),
          ),
          `${slug}: Wednesday is closed`,
        );
        const refs = await page.evaluate(() => {
          const urls = [
            ...document.querySelectorAll("[src], [href], [poster]"),
          ].flatMap((element) =>
            ["src", "href", "poster"]
              .map((name) => element.getAttribute(name))
              .filter(Boolean),
          );
          for (const image of document.querySelectorAll("[srcset]"))
            urls.push(
              ...image.srcset
                .split(",")
                .map((candidate) => candidate.trim().split(/\s+/)[0]),
            );
          return urls;
        });
        for (const ref of refs) {
          const url = new URL(ref, page.url());
          if (url.origin !== new URL(baseURL).origin) continue;
          localReferences.add(url.pathname);
          if (url.hash) anchorReferences.push(url);
        }
      }
      for (const stylesheet of fs.readdirSync(root).filter((file) => file.endsWith(".css"))) {
        const css = fs.readFileSync(path.join(root, stylesheet), "utf8");
        for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
          const url = new URL(match[1], `${baseURL}/${stylesheet}`);
          if (url.origin === new URL(baseURL).origin)
            localReferences.add(url.pathname);
        }
      }
      for (const pathname of localReferences) {
        const response = await fetch(`${baseURL}${pathname}`, {
          method: "HEAD",
        });
        assert.equal(
          response.status,
          200,
          `Referenced asset/link missing: ${pathname}`,
        );
      }
      for (const url of anchorReferences) {
        const localPath = path.join(root, decodeURIComponent(url.pathname));
        if (!fs.existsSync(localPath) || !localPath.endsWith(".html")) continue;
        const source = fs.readFileSync(localPath, "utf8");
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(
          source.includes(`id="${id}"`) || source.includes(`id='${id}'`),
          `Missing anchor: ${url.pathname}${url.hash}`,
        );
      }
      console.log(
        `  Validated ${localReferences.size} unique local resources and ${anchorReferences.length} anchor links.`,
      );
      await context.close();
    },
  );

  await check(
    "Social cards stay readable after touch interaction and keyboard focus",
    async () => {
      const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await visit(page, "kontakt");
      for (const selector of [".contact-bottom .social-links", ".site-footer .social-links"]) {
        const cards = page.locator(`${selector} .social-link`);
        const expected = selector.startsWith(".contact") ? "rgb(23, 59, 46)" : "rgb(245, 241, 232)";
        for (let index = 0; index < await cards.count(); index += 1) {
          const card = cards.nth(index);
          await card.evaluate((element) => element.addEventListener("click", (event) => event.preventDefault()));
          await card.tap();
          assert.equal(await card.evaluate((element) => getComputedStyle(element).color), expected, "Sticky touch hover must retain readable brand icon and label colors");
          const box = await card.boundingBox();
          assert.ok(box.width >= 44 && box.height >= 44, "Social cards retain comfortable touch targets");
          await card.focus();
          assert.ok(await card.evaluate((element) => document.activeElement === element));
        }
      }
      await context.close();
    },
  );

  await check(
    "2026 PDF fidelity: 151 rows, 153 prices, exact names, portions, descriptions and 18 categories",
    async () => {
      const { context, page } = await newPage();
      await visit(page, "speisekarte");
      const categories = await page.locator(".menu-category").evaluateAll((items) => items.map((item) => ({
        id: item.dataset.menuCategory,
        title: item.querySelector("h2").textContent.trim(),
      })));
      assert.deepEqual(categories, menuReference.categories, "Category order follows the PDF, including soups and children's dishes");
      const rendered = await page.locator(".menu-item").evaluateAll((items) =>
        items.map((item) => ({
          page: item.dataset.sourcePage,
          row: item.dataset.sourceRow,
          category: item.closest(".menu-category").dataset.menuCategory,
          name: item.querySelector("h3").textContent.trim(),
          prices: [...item.querySelectorAll(".dish-price")].map((price) => price.textContent.trim()),
          description: item.querySelector("p")?.textContent.trim() || "",
          sizes: [...item.querySelectorAll(".dish-size")].map((size) => size.textContent.trim()),
        })),
      );
      assert.equal(rendered.length, menuReference.row_count);
      assert.equal(rendered.reduce((count, item) => count + item.prices.length, 0), menuReference.price_count);
      assert.deepEqual(rendered, sourceMenu.map(expectedMenuRow), "Every rendered product is checked against independently audited PDF records in source order");
      const menuText = rendered.map((item) => item.name).join("\n").toUpperCase();
      for (const removed of menuReference.removed_names)
        assert.ok(!menuText.includes(removed), `${removed} must not survive from the old menu`);
      assert.equal(await page.locator('[data-category="desserts"]').evaluate((element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim()), "Desserts");
      assert.match(await page.locator('[data-menu-category="kindermenue"]').textContent(), /bis 12 Jahre/i);
      assert.match(await page.locator('[data-menu-category="pizza"]').textContent(), /36\s*cm/);
      assert.match(await page.locator('[data-menu-category="wein"]').textContent(), /0,75\s*l/);
      assert.equal(rendered.filter((item) => item.category === "fleisch").every((item) => item.prices.length === 1), true, "Kalb/Schwein does not imply unprinted dual prices");
      assert.equal(rendered.filter((item) => item.name.startsWith("SCHORLE ")).every((item) => item.sizes.length === 0), true, "Wine Schorle has no invented volume");
      const menuJSON = JSON.parse(fs.readFileSync(path.join(root, "menu.json"), "utf8"));
      assert.deepEqual(menuJSON.map(({ id, title }) => ({ id, title })), menuReference.categories);
      assert.equal(menuJSON.flatMap((category) => category.items).length, menuReference.row_count);
      await context.close();
    },
  );

  await check(
    "Menu search, empty state, reset, category filtering and deep links",
    async () => {
      const { context, page } = await newPage();
      await visit(page, "speisekarte");
      await page.locator('[data-category="pizza"]').click();
      assert.deepEqual(await visibleCategories(page), ["pizza"]);
      assert.equal(new URL(page.url()).hash, "#pizza");
      await page.locator('[data-category="all"]').click();
      await page.locator("#dish-search").fill("Carbonara");
      await page.waitForTimeout(300);
      const results = await page
        .locator(".menu-item:visible")
        .evaluateAll((items) =>
          items.map((item) => item.dataset.search.toLowerCase()),
        );
      assert.ok(results.length > 0 && results.length < sourceMenu.length);
      assert.ok(results.every((result) => result.includes("carbonara")));
      await page.locator("#clear-search").click();
      assert.equal(await page.locator("#dish-search").inputValue(), "");
      assert.equal(
        await page.locator(".menu-item:visible").count(),
        sourceMenu.length,
      );
      await page.locator("#dish-search").fill("Unfindbaresgericht987654321");
      await page.waitForTimeout(300);
      assert.equal(await page.locator(".menu-item:visible").count(), 0);
      assert.ok(await page.locator("#no-results").isVisible());
      await page.locator("#reset-menu").click();
      assert.equal(await page.locator("#dish-search").inputValue(), "");
      assert.equal(
        await page.locator(".menu-item:visible").count(),
        sourceMenu.length,
      );
      await visit(page, "speisekarte", "#pasta");
      assert.deepEqual(await visibleCategories(page), ["pasta"]);
      assert.equal(
        await page
          .locator('[data-category="pasta"]')
          .getAttribute("aria-current"),
        "true",
      );
      await visit(page, "speisekarte", "#dolci");
      assert.deepEqual(await visibleCategories(page), ["desserts"], "Old dessert links still work");
      await visit(page, "speisekarte", "#menu-9");
      assert.deepEqual(await visibleCategories(page), ["bier"], "Original V1 beer links resolve to their new category");
      await visit(page, "speisekarte", "#menu-11");
      assert.deepEqual(await visibleCategories(page), ["aperitifs"], "Original aperitif links resolve to their new category");
      await visit(page, "speisekarte", "#%E0%A4%A");
      assert.equal((await visibleCategories(page)).length, menuReference.categories.length, "Malformed URL encodings cannot break filtering");
      await screenshot(page, "desktop-menu");
      await context.close();
    },
  );

  await check(
    "Mobile category selector, search combination, Back/Forward and direct links stay synchronized",
    async () => {
      const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await visit(page, "speisekarte");
      const select = page.locator("#menu-category-select");
      assert.ok(await select.isVisible(), "All18 categories are available without a long horizontal scroll");
      assert.equal(await select.locator("option").count(), 19);
      await select.selectOption("kindermenue");
      assert.deepEqual(await visibleCategories(page), ["kindermenue"]);
      assert.equal(await page.locator(".menu-item:visible").count(), 4);
      assert.equal(new URL(page.url()).hash, "#kindermenue");
      await select.selectOption("pizza");
      assert.deepEqual(await visibleCategories(page), ["pizza"]);
      await page.goBack();
      await page.waitForFunction(() => document.querySelector("#menu-category-select").value === "kindermenue");
      assert.deepEqual(await visibleCategories(page), ["kindermenue"]);
      await page.goForward();
      await page.waitForFunction(() => document.querySelector("#menu-category-select").value === "pizza");
      await page.locator("#dish-search").fill("Familienpizza");
      assert.equal(await page.locator(".menu-item:visible").count(), 1);
      await select.selectOption("desserts");
      assert.ok(await page.locator("#no-results").isVisible(), "Category filtering preserves an explicit search");
      await page.locator("#reset-menu").click();
      assert.equal(await select.inputValue(), "all");
      assert.equal(await page.locator(".menu-item:visible").count(), sourceMenu.length);
      await context.close();
    },
  );

  await check(
    "Search handles rapid input, accents, composition and literal markup with responsive 4×CPU rendering",
    async () => {
      const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await visit(page, "speisekarte");
      const input = page.locator("#dish-search");
      await input.fill("schoko souffle");
      assert.equal(await page.locator(".menu-item:visible").count(), 1);
      assert.match(await page.locator(".menu-item:visible h3").textContent(), /SCHOKO-SOUFFLÉ/);
      await input.fill("<img src=x onerror=alert(1)>");
      assert.equal(await page.locator(".menu-item:visible").count(), 0);
      assert.equal(await page.locator("img[src=x]").count(), 0, "Search text must remain literal text");
      await input.evaluate((element) => {
        element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
        element.value = "Tiram";
        element.dispatchEvent(new InputEvent("input", { bubbles: true, data: "Tiram", isComposing: true }));
        element.value = "Tiramisú";
        element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Tiramisú" }));
        element.dispatchEvent(new InputEvent("input", { bubbles: true, data: "Tiramisú", isComposing: false }));
      });
      assert.equal(await input.inputValue(), "Tiramisú");
      assert.equal(await page.locator(".menu-item:visible").count(), 1);
      assert.match(await page.locator(".menu-item:visible h3").textContent(), /TIRAMISÚ/);
      await input.fill("");
      await input.focus();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.evaluate(() => {
        window.__searchSamples = [];
        window.__searchLongTasks = [];
        new PerformanceObserver((list) => {
          window.__searchLongTasks.push(...list.getEntries().map((entry) => entry.duration));
        }).observe({ type: "longtask", buffered: false });
        document.querySelector("#dish-search").addEventListener("input", () => {
          const started = performance.now();
          requestAnimationFrame(() => requestAnimationFrame(() => window.__searchSamples.push(performance.now() - started)));
        }, { capture: true });
      });
      for (const query of ["Carbonara", "frutti di mare", "peperoncino", "Familienpizza"]) {
        await input.fill("");
        await input.pressSequentially(query, { delay: 0 });
        assert.equal(await input.inputValue(), query, "Rapid typing never loses characters");
        assert.ok((await page.locator(".menu-item:visible").count()) > 0, `Latest query renders: ${query}`);
      }
      await page.waitForTimeout(200);
      const samples = await page.evaluate(() => ({ frames: window.__searchSamples, longTasks: window.__searchLongTasks }));
      const sorted = samples.frames.sort((a, b) => a - b);
      assert.ok(sorted.length >= 35);
      metrics.search = {
        environment: "Headless Chromium, 390×844 touch emulation, 4× CPU throttling; synthetic lab measurement, not field INP or a physical phone",
        samples: sorted.length,
        inputToSecondAnimationFrameP95Ms: Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)] * 10) / 10,
        maximumMs: Math.round(sorted.at(-1) * 10) / 10,
        longTasksOver50Ms: samples.longTasks.length,
        longestTaskMs: samples.longTasks.length ? Math.round(Math.max(...samples.longTasks) * 10) / 10 : 0,
      };
      assert.ok(metrics.search.inputToSecondAnimationFrameP95Ms < 250, `Search P95 must stay below250ms in lab: ${JSON.stringify(metrics.search)}`);
      console.log(`  Search lab measurement: ${JSON.stringify(metrics.search)}`);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.detach();
      await context.close();
    },
  );

  await check(
    "Gallery filters and keyboard lightbox navigation preserve the active group",
    async () => {
      const { context, page } = await newPage();
      await visit(page, "galerie");
      const allCount = await page.locator("[data-gallery-category]").count();
      await page.locator('[data-gallery-filter="raeume"]').click();
      const roomTiles = page.locator(
        '[data-gallery-category="raeume"]:visible',
      );
      assert.ok((await roomTiles.count()) > 1);
      assert.equal(
        await page.locator('[data-gallery-category="kueche"]:visible').count(),
        0,
      );
      assert.equal(
        await page
          .locator('[data-gallery-filter="raeume"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      const roomSources = await roomTiles
        .locator("[data-lightbox]")
        .evaluateAll((links) =>
          links.map((link) => new URL(link.href).pathname),
        );
      const first = roomTiles.first().locator("[data-lightbox]");
      await first.click();
      assert.ok(await page.locator("#lightbox").isVisible());
      const currentSource = () =>
        page
          .locator("#lightbox img")
          .evaluate((image) => new URL(image.src).pathname);
      assert.equal(await currentSource(), roomSources[0]);
      await page.keyboard.press("ArrowRight");
      assert.equal(await currentSource(), roomSources[1]);
      await page.locator(".lightbox-prev").click();
      assert.equal(await currentSource(), roomSources[0]);
      await page.keyboard.press("ArrowLeft");
      assert.equal(await currentSource(), roomSources.at(-1));
      await page.keyboard.press("Escape");
      assert.ok(!(await page.locator("#lightbox").isVisible()));
      assert.ok(
        await first.evaluate((element) => document.activeElement === element),
        "Focus returns to enlarged image link",
      );
      await page.locator('[data-gallery-filter="all"]').click();
      assert.equal(
        await page.locator("[data-gallery-category]:visible").count(),
        allCount,
      );
      await screenshot(page, "desktop-gallery");
      await context.close();
    },
  );

  await check(
    "Mobile navigation: dialog, focus containment, Escape and link navigation",
    async () => {
      const { context, page } = await newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await visit(page);
      const toggle = page.locator(".nav-toggle");
      await toggle.click();
      assert.ok(await page.locator("#mobile-menu").isVisible());
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.ok(
        await page.evaluate(() =>
          document
            .querySelector("#mobile-menu")
            .contains(document.activeElement),
        ),
      );
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press("Tab");
        // Native dialogs may briefly return focus to browser chrome (reported as
        // body). No interactive element behind the modal may receive focus.
        assert.ok(
          await page.evaluate(
            () =>
              document.activeElement === document.body ||
              document
                .querySelector("#mobile-menu")
                .contains(document.activeElement),
          ),
          `No background control receives focus after Tab ${i + 1}`,
        );
      }
      await page.locator(".brand").evaluate((element) => element.focus());
      assert.ok(
        await page.evaluate(() =>
          document
            .querySelector("#mobile-menu")
            .contains(document.activeElement),
        ),
        "Background content is inert while the menu is open",
      );
      await page.screenshot({
        path: path.join(screenshots, "mobile-navigation.png"),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      assert.ok(!(await page.locator("#mobile-menu").isVisible()));
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.ok(
        await toggle.evaluate((element) => document.activeElement === element),
        "Focus restored to menu trigger",
      );
      await toggle.click();
      await page.locator('#mobile-menu a[href="feiern.html"]').click();
      await page.waitForURL("**/feiern.html");
      assert.ok((await page.locator("h1").textContent()).length > 5);
      await screenshot(page, "mobile-events");
      await context.close();
    },
  );

  await check(
    "Reduced motion: original hero stays visible, intro and smooth scrolling are disabled",
    async () => {
      const { context, page } = await newPage({ reducedMotion: "reduce" });
      await visit(page);
      const state = await page.evaluate(() => window.AlbertoMotion.getState());
      assert.equal(state.reducedMotion, true);
      assert.equal(state.introRunning, false);
      assert.equal(state.smoothScroll, false);
      assert.equal(state.tickerActive, false);
      assert.equal(state.pendingReveals, 0);
      assert.equal(await page.evaluate(() => window.AlbertoMotion.replay()), false);
      assert.ok(await page.locator(".hero-photo").isVisible());
      assert.equal(await page.locator(".hero-photo").evaluate((image) => image.naturalWidth), 1536);
      assert.equal(await page.locator(".brand img").evaluate((image) => getComputedStyle(image).opacity), "1");
      assert.equal(await page.locator(".hero-slide").count(), 0, "Approved R2 has one dominant original photograph");
      const videos = await page.locator("video").evaluateAll((elements) => elements.map((video) => ({ paused: video.paused, autoplay: video.autoplay })));
      assert.ok(videos.every((video) => video.paused && !video.autoplay), "Reduced-motion visitors choose when to play video");
      await context.close();
    },
  );

  await check(
    "Kitchen video: lazy viewport autoplay, inline muted loop, persistent manual pause and preference change",
    async () => {
      const { context, page } = await newPage({ reducedMotion: "no-preference" });
      const requests = [];
      page.on("request", (request) => { if (request.url().includes("/assets/kueche.mp4")) requests.push(request.url()); });
      await visit(page);
      const video = page.locator("#kitchen-video");
      const toggle = page.locator(".video-toggle");
      assert.equal(requests.length, 0, "Offscreen video must not consume media bandwidth on load");
      assert.deepEqual(await video.evaluate((element) => ({ muted: element.muted, inline: element.playsInline, loop: element.loop, controls: element.controls, preload: element.preload, paused: element.paused })), { muted: true, inline: true, loop: true, controls: false, preload: "none", paused: true });
      assert.equal(await toggle.getAttribute("aria-controls"), "kitchen-video");
      await video.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForFunction(() => { const video = document.querySelector("#kitchen-video"); return !video.paused && video.currentTime > 0; });
      assert.ok(requests.length > 0);
      assert.equal(await toggle.getAttribute("aria-label"), "Küchenvideo pausieren");
      await toggle.click();
      assert.ok(await video.evaluate((element) => element.paused));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(100);
      await video.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(200);
      assert.ok(await video.evaluate((element) => element.paused), "Scrolling back never overrides an explicit Pause");
      await toggle.click();
      await page.waitForFunction(() => !document.querySelector("#kitchen-video").paused);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForFunction(() => document.querySelector("#kitchen-video").paused);
      await video.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForFunction(() => !document.querySelector("#kitchen-video").paused);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => document.querySelector("#kitchen-video").paused);
      await context.close();
    },
  );

  await check(
    "Kitchen video: reduced-motion/data-saver opt-in and blocked-autoplay recovery remain usable",
    async () => {
      for (const preference of ["reduced-motion", "data-saver", "autoplay-blocked"]) {
        const { context, page } = await newPage({ reducedMotion: preference === "reduced-motion" ? "reduce" : "no-preference" });
        if (preference === "data-saver") {
          await page.addInitScript(() => {
            const connection = new EventTarget();
            connection.saveData = true;
            Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
          });
        }
        if (preference === "autoplay-blocked") {
          await page.addInitScript(() => {
            const original = HTMLMediaElement.prototype.play;
            let attempts = 0;
            HTMLMediaElement.prototype.play = function () {
              attempts += 1;
              if (attempts === 1) return Promise.reject(new DOMException("Simulated browser autoplay policy", "NotAllowedError"));
              return original.call(this);
            };
          });
        }
        await visit(page);
        const video = page.locator("#kitchen-video");
        await video.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
        await page.waitForTimeout(250);
        assert.ok(await video.evaluate((element) => element.paused), `${preference}: video remains paused`);
        assert.equal(await page.locator(".video-toggle").getAttribute("aria-label"), "Küchenvideo abspielen");
        await page.locator(".video-toggle").click();
        await page.waitForFunction(() => !document.querySelector("#kitchen-video").paused);
        assert.ok(await video.evaluate((element) => element.muted && element.playsInline));
        await context.close();
      }
    },
  );

  await check(
    "Homepage photograph fills the opening on desktop and small phones",
    async () => {
      assert.equal(
        crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "assets/hero.webp"))).digest("hex"),
        "af94d4bcf74310bb1c8fd1b8aee5ce47e49ef222a3973d4224cab979d3769858",
        "The large hero retains Alberto's original photograph",
      );
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
        const { context, page } = await newPage({
          viewport,
          isMobile: viewport.width < 600,
          hasTouch: viewport.width < 600,
        });
        try {
          await visit(page);
          const geometry = await page.evaluate(() => {
            const rect = (selector) => {
              const bounds = document.querySelector(selector).getBoundingClientRect();
              return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
            };
            return {
              width: document.documentElement.clientWidth,
              height: window.innerHeight,
              header: rect(".site-header"),
              media: rect(".hero-media"),
              title: rect("#hero-title"),
              action: rect(".hero-primary"),
              imageSource: document.querySelector(".hero-photo").getAttribute("src"),
            };
          });
          assert.equal(geometry.imageSource, "assets/hero.webp");
          assert.ok(geometry.media.width >= geometry.width * 0.98, `${viewport.width}px: photo spans the viewport`);
          assert.ok(geometry.media.height >= geometry.height * 0.75, `${viewport.width}px: photo dominates the opening`);
          assert.ok(Math.abs(geometry.media.y - geometry.header.bottom) <= 2, `${viewport.width}px: photo begins directly under the header`);
          for (const name of ["title", "action"]) {
            const bounds = geometry[name];
            assert.ok(bounds.x >= 0 && bounds.right <= geometry.width + 1, `${viewport.width}px: ${name} fits horizontally`);
            assert.ok(bounds.y >= geometry.media.y && bounds.bottom <= geometry.media.bottom + 1, `${viewport.width}px: ${name} sits inside the large photograph`);
          }
          await noOverflow(page, `Homepage opening at ${viewport.width}×${viewport.height}`);
          metrics[`hero-${viewport.width}x${viewport.height}`] = geometry;
        } finally {
          await context.close();
        }
      }
    },
  );

  await check(
    "Automatic logo intro is visible on fresh entry and reload despite the old session flag or blocked storage",
    async () => {
      const scenarios = [
        { name: "desktop", viewport: { width: 1440, height: 900 } },
        { name: "mobile", viewport: { width: 390, height: 844 } },
        { name: "blocked-storage", viewport: { width: 1440, height: 900 }, blockedStorage: true },
      ];
      for (const scenario of scenarios) {
        const { context, page } = await newPage({
          viewport: scenario.viewport,
          isMobile: scenario.viewport.width < 600,
          hasTouch: scenario.viewport.width < 600,
          reducedMotion: "no-preference",
        });
        try {
          await page.addInitScript(({ blockedStorage }) => {
            if (blockedStorage) {
              Object.defineProperty(window, "sessionStorage", {
                configurable: true,
                get() { throw new DOMException("Storage is disabled for this test", "SecurityError"); },
              });
            } else {
              sessionStorage.setItem("alberto-premium-v1-intro-seen", "1");
            }
          }, { blockedStorage: Boolean(scenario.blockedStorage) });
          for (const entry of ["fresh", "reload"]) {
            if (entry === "fresh") await page.goto(`${baseURL}/index.html`, { waitUntil: "domcontentloaded" });
            else await page.reload({ waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => {
              const logo = document.querySelector(".firma-logo");
              const caption = logo?.querySelector(".firma-caption");
              return window.AlbertoMotion?.getState().introRunning &&
                getComputedStyle(logo).visibility === "visible" &&
                Number(getComputedStyle(logo).opacity) > 0.9 &&
                Number(getComputedStyle(caption).opacity) > 0.9;
            }, null, { timeout: 2000 });
            const visible = await page.locator(".firma-logo").evaluate((logo) => {
              const bounds = logo.getBoundingClientRect();
              const image = logo.querySelector("img");
              return {
                x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom,
                viewportWidth: innerWidth, viewportHeight: innerHeight,
                imageLoaded: image.complete && image.naturalWidth > 0,
                pointerEvents: getComputedStyle(logo).pointerEvents,
              };
            });
            assert.ok(visible.imageLoaded, `${scenario.name}/${entry}: original logo is decoded`);
            assert.ok(visible.x >= 0 && visible.right <= visible.viewportWidth && visible.y >= 0 && visible.bottom <= visible.viewportHeight, `${scenario.name}/${entry}: animated logo is onscreen`);
            assert.equal(visible.pointerEvents, "none", "Decorative entrance cannot intercept navigation");
            if (entry === "fresh" && !scenario.blockedStorage)
              await page.screenshot({ path: path.join(screenshots, `intro-${scenario.name}.png`) });
            await page.waitForFunction(() => !window.AlbertoMotion.getState().introRunning, null, { timeout: 2500 });
            assert.equal(await page.locator(".brand img").evaluate((image) => getComputedStyle(image).opacity), "1");
            assert.equal(await page.locator(".firma-logo").evaluate((logo) => getComputedStyle(logo).visibility), "hidden");
          }
          await visit(page, "index", "#benvenuti");
          assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().introRunning), false, "An anchor visit does not replay the opening over the requested section");
        } finally {
          await context.close();
        }
      }
    },
  );

  await check(
    "GSAP intro completes and interrupts; Lenis and ScrollTrigger respond to preference changes",
    async () => {
      const { context, page } = await newPage({ reducedMotion: "no-preference" });
      await visit(page);
      await page.waitForFunction(() => !window.AlbertoMotion.getState().introRunning);
      let state = await page.evaluate(() => window.AlbertoMotion.getState());
      assert.equal(state.desktopPointer, true);
      assert.equal(state.smoothScroll, true);
      assert.equal(state.tickerActive, true);
      assert.ok(state.triggerCount > 0, "Below-fold marketing reveals use ScrollTrigger");
      assert.equal(await page.evaluate(() => window.AlbertoMotion.replay()), true);
      await page.waitForFunction(() => !window.AlbertoMotion.getState().introRunning, null, { timeout: 2500 });
      assert.equal(await page.locator(".brand img").evaluate((image) => getComputedStyle(image).opacity), "1");
      assert.equal(await page.evaluate(() => window.AlbertoMotion.replay()), true);
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().introRunning), false, "Keyboard navigation immediately finishes decorative motion");
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().pendingReveals), 0, "Keyboard navigation exposes all content");
      await page.emulateMedia({ reducedMotion: "reduce" });
      // State uses media-change snapshots so inspection cannot consume a
      // pending MediaQueryList notification during a preference switch.
      await page.waitForFunction(() => !window.AlbertoMotion.getState().smoothScroll);
      state = await page.evaluate(() => window.AlbertoMotion.getState());
      assert.equal(state.reducedMotion, true);
      assert.equal(state.smoothScroll, false);
      assert.equal(state.tickerActive, false);
      assert.equal(state.introRunning, false);
      assert.equal(state.triggerCount, 0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(() => window.AlbertoMotion.getState().smoothScroll);
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().reducedMotion), false);
      await page.setViewportSize({ width: 820, height: 1000 });
      await page.waitForFunction(() => !window.AlbertoMotion.getState().smoothScroll);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForFunction(() => window.AlbertoMotion.getState().smoothScroll);
      await context.close();
    },
  );

  await check(
    "Touch scrolling stays native and mobile dialog locks, restores and dismisses correctly",
    async () => {
      const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
      await visit(page);
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().smoothScroll), false);
      await page.evaluate(() => { window.AlbertoMotion.finishIntro(); window.scrollTo(0, 460); });
      const initialScroll = await page.evaluate(() => window.scrollY);
      // Use a real on-screen touch. locator.click() first scrolls a sticky
      // header into view and changes the very position this check measures.
      const toggleBounds = await page.locator(".nav-toggle").boundingBox();
      assert.ok(toggleBounds && toggleBounds.y >= 0 && toggleBounds.y + toggleBounds.height < 844, "Sticky menu trigger is available at the current scroll position");
      await page.touchscreen.tap(toggleBounds.x + toggleBounds.width / 2, toggleBounds.y + toggleBounds.height / 2);
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().dialogLocked), true);
      assert.ok(await page.evaluate(() => ["hidden", "clip"].includes(getComputedStyle(document.body).overflowY) || getComputedStyle(document.body).position === "fixed"));
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().dialogLocked), false);
      assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - initialScroll) < 3, "Dialog restores page scroll position");
      await page.locator(".nav-toggle").click();
      await page.locator(".menu-close").click();
      assert.ok(!(await page.locator("#mobile-menu").isVisible()));
      assert.ok(await page.locator(".nav-toggle").evaluate((element) => document.activeElement === element));
      await context.close();
    },
  );

  await check(
    "Gallery lightbox pauses desktop Lenis, restores focus and closes on backdrop",
    async () => {
      const { context, page } = await newPage({ reducedMotion: "no-preference" });
      await visit(page, "galerie");
      const image = page.locator("[data-lightbox]").first();
      await image.click();
      let state = await page.evaluate(() => window.AlbertoMotion.getState());
      assert.equal(state.dialogLocked, true);
      assert.equal(state.smoothScrollStopped, true);
      assert.equal(state.tickerActive, false);
      await page.locator("#lightbox").click({ position: { x: 2, y: 2 } });
      assert.ok(!(await page.locator("#lightbox").isVisible()));
      await page.waitForFunction(() => !window.AlbertoMotion.getState().smoothScrollStopped);
      state = await page.evaluate(() => window.AlbertoMotion.getState());
      assert.equal(state.tickerActive, true);
      assert.equal(state.dialogLocked, false);
      assert.ok(await image.evaluate((element) => document.activeElement === element));
      await context.close();
    },
  );

  await check(
    "Unavailable optional animation libraries preserve content, menu search and native navigation",
    async () => {
      const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
      await page.route(/assets\/vendor\/(gsap|ScrollTrigger|lenis)\.min\.js$/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "/* Optional motion library unavailable in this test. */" }));
      await visit(page);
      assert.ok(await page.locator("h1").isVisible());
      assert.equal(await page.locator(".brand img").evaluate((image) => getComputedStyle(image).opacity), "1");
      assert.equal(await page.evaluate(() => window.AlbertoMotion.getState().smoothScroll), false);
      await page.locator(".nav-toggle").click();
      await page.locator('#mobile-menu a[href="speisekarte.html"]').click();
      await page.waitForURL("**/speisekarte.html");
      await page.locator("#dish-search").fill("Carbonara");
      await page.waitForTimeout(300);
      assert.ok((await page.locator(".menu-item:visible").count()) > 0);
      assert.ok((await page.locator(".menu-item:visible").count()) < sourceMenu.length);
      await noOverflow(page, "Unavailable optional animation libraries");
      await context.close();
    },
  );

  await check(
    "Responsive layout: every page at 1440, 820, 390, 360 and 320 pixels",
    async () => {
      for (const width of [1440, 820, 390, 360, 320]) {
        const { context, page } = await newPage({
          viewport: { width, height: width > 1000 ? 1000 : 844 },
          isMobile: width < 600,
          hasTouch: width < 1000,
        });
        for (const slug of pages) {
          await visit(page, slug);
          await noOverflow(page, `${slug} at ${width}px`);
          if ([1440, 390].includes(width))
            await screenshot(page, `${width}-${slug}`);
          if (slug === "index" && width === 820)
            await screenshot(page, `${width}-index`);
          if (slug === "speisekarte" && width === 390) {
            await page.locator("#menu-category-select").selectOption("pizza");
            await noOverflow(page, `filtered menu at ${width}px`);
            await screenshot(page, "mobile-menu");
          }
        }
        await context.close();
      }
    },
  );

  await check(
    "Progressive enhancement: content and navigation remain available without JavaScript",
    async () => {
      const { context, page } = await newPage({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
      });
      await visit(page, "speisekarte");
      assert.equal(
        await page.locator(".menu-item:visible").count(),
        sourceMenu.length,
      );
      assert.ok(
        await page.locator('noscript nav a[href="feiern.html"]').isVisible(),
      );
      assert.ok(
        !(await page.locator("#dish-search").isVisible()),
        "Nonfunctional search is hidden without JS",
      );
      await noOverflow(page, "no-JavaScript menu");
      await visit(page);
      const video = page.locator("#kitchen-video");
      assert.ok(await video.evaluate((element) => element.controls && element.paused && element.preload === "none"), "Native video controls remain available when JavaScript is disabled");
      assert.equal(await page.locator(".video-toggle").count(), 0);
      await context.close();
    },
  );

  await check(
    "Offline ZIP opening: all nine file:// pages load styles, local fonts, navigation and assets",
    async () => {
      const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      for (const slug of pages) {
        try {
          await page.goto(`file://${path.join(root, `${slug}.html`)}`, { waitUntil: "networkidle" });
        } catch (error) {
          if (!String(error).includes("ERR_BLOCKED_BY_ADMINISTRATOR")) throw error;
          await context.close();
          throw Object.assign(new Error("Managed browser blocks local file URLs"), {
            skipReason: "Chromium administrator policy blocks file:// URLs. Policy was not changed; all nine pages, styles and assets are verified over the local HTTP server. Direct file opening requires a check outside this managed browser.",
          });
        }
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.locator("h1").isVisible(), `${slug}: offline main heading`);
        const styles = await page.evaluate(() => ({
          sheets: document.styleSheets.length,
          background: getComputedStyle(document.body).backgroundColor,
          titleFont: getComputedStyle(document.querySelector("h1")).fontFamily,
          bodyFont: getComputedStyle(document.body).fontFamily,
          loadedFonts: [...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family.replace(/["']/g, "")),
        }));
        assert.ok(styles.sheets >= 3, `${slug}: local CSS loaded`);
        assert.notEqual(styles.background, "rgba(0, 0, 0, 0)");
        assert.match(styles.titleFont, /Cormorant/);
        assert.match(styles.bodyFont, /Manrope/);
        assert.ok(styles.loadedFonts.some((font) => font.includes("Manrope")), `${slug}: local Manrope font loaded`);
        assert.ok(styles.loadedFonts.some((font) => font.includes("Cormorant")), `${slug}: local Cormorant font loaded`);
        assert.equal(await page.locator(".brand img").evaluate((image) => image.complete && image.naturalWidth > 0), true);
        if (slug === "speisekarte") {
          await page.locator("#dish-search").fill("Carbonara");
          assert.equal(await page.locator(".menu-item:visible").count(), 1);
        }
        await noOverflow(page, `${slug}: offline file`);
      }
      await page.locator(".nav-toggle").click();
      await page.locator('#mobile-menu a[href="speisekarte.html"]').click();
      await page.waitForURL("**/speisekarte.html");
      assert.equal(new URL(page.url()).protocol, "file:");
      await context.close();
    },
  );

  await check(
    "No browser JavaScript errors or HTTP errors during the complete suite",
    async () => {
      assert.deepEqual([...browserErrors], []);
    },
  );
}

(async () => {
  try {
    await main();
  } catch (error) {
    failures.push({
      name: "Test harness",
      error: error.stack || String(error),
    });
  } finally {
    if (browser) await browser.close();
    if (server) server.kill("SIGTERM");
    fs.mkdirSync(screenshots, { recursive: true });
    const hashedFiles = [
      ...fs.readdirSync(root).filter((file) => /\.(html|css|js)$/.test(file) || file === "menu.json"),
      ...fs.readdirSync(path.join(root, "scripts")).filter((file) => /\.(py|cjs)$/.test(file)).map((file) => `scripts/${file}`),
      ...fs.readdirSync(path.join(root, "templates")).filter((file) => file.endsWith(".html")).map((file) => `templates/${file}`),
      "_routes.json", "functions/_middleware.js", "functions/api/ratings.js", "tests/browser.cjs", "tests/menu-2026.json", "tests/v1-menu.json", "tests/ratings.cjs", "tests/ratings-browser.cjs",
      ...fs.readdirSync(path.join(root, "server")).filter(file => file.endsWith(".cjs")).map(file => `server/${file}`),
    ].sort();
    const sourceHashes = Object.fromEntries(hashedFiles.map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
    const report = {
      completedAt: new Date().toISOString(),
      passed, failures, skipped, browserErrors: [...browserErrors], metrics, screenshots,
      sourceCommit, menuSource: menuReference.source, menuSourceSHA256: menuReference.source_sha256,
      sourceHashes, viewports: [1440, 820, 390, 360, 320],
    };
    fs.writeFileSync(path.join(screenshots, "results.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(__dirname, "delivery-results.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (failures.length) {
      console.error(
        `\n${failures.length} check(s) failed. Details: ${path.join(screenshots, "results.json")}`,
      );
      for (const failure of failures)
        console.error(`\n${failure.name}\n${failure.error}`);
      process.exitCode = 1;
    } else console.log(`\n${passed.length} checks passed, ${skipped.length} skipped. Screenshots: ${screenshots}`);
  }
})();
