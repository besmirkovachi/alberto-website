#!/usr/bin/env node
"use strict";

// Run with: node tests/browser.cjs
// No project dependencies are required; see tests/README.md for browser setup.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const screenshots = process.env.SCREENSHOT_DIR || "/tmp/alberto-review";
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
const sourceMenu = JSON.parse(
  fs.readFileSync(path.join(root, "menu.json"), "utf8"),
).flatMap((category) => category.items);
const failures = [];
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
    console.log(`PASS ${name}`);
  } catch (error) {
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
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      width,
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
    result.scrollWidth <= result.width + 2,
    `${label}: width ${result.width}, scrollWidth ${result.scrollWidth}; ${result.suspects.join(", ")}`,
  );
}

async function visibleCategories(page) {
  return page
    .locator(".menu-category:visible")
    .evaluateAll((elements) =>
      elements.map((element) => element.dataset.menuCategory),
    );
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
      const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
      for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
        const url = new URL(match[1], `${baseURL}/style.css`);
        if (url.origin === new URL(baseURL).origin)
          localReferences.add(url.pathname);
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
    `Menu preserves all ${sourceMenu.length} supplied names, prices and descriptions`,
    async () => {
      const { context, page } = await newPage();
      await visit(page, "speisekarte");
      const rendered = await page.locator(".menu-item").evaluateAll((items) =>
        items.map((item) => ({
          name: item.querySelector("h3").textContent.trim(),
          price: item.querySelector(".dish-price").textContent.trim(),
          description: item.querySelector("p")?.textContent.trim() || "",
        })),
      );
      const key = (item) =>
        JSON.stringify([
          item.name.trim(),
          item.price.trim(),
          item.description.trim(),
        ]);
      assert.deepEqual(rendered.map(key).sort(), sourceMenu.map(key).sort());
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
      await screenshot(page, "desktop-menu");
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
    "Reduced motion: static hero, manual slide controls, video does not autoplay",
    async () => {
      const { context, page } = await newPage({ reducedMotion: "reduce" });
      await visit(page);
      const active = () =>
        page.locator(".hero-slide.is-active").getAttribute("data-slide");
      const first = await active();
      await page.waitForTimeout(7000);
      assert.equal(
        await active(),
        first,
        "Reduced motion disables automatic image rotation",
      );
      await page.locator('[data-go-slide="1"]').click();
      assert.equal(await active(), "1", "Manual image controls still work");
      assert.equal(
        await page.locator('[data-go-slide="1"]').getAttribute("aria-pressed"),
        "true",
      );
      const videos = await page
        .locator("video")
        .evaluateAll((elements) =>
          elements.map((video) => ({
            paused: video.paused,
            autoplay: video.autoplay,
          })),
        );
      assert.ok(
        videos.every((video) => video.paused && !video.autoplay),
        "Video starts only on request",
      );
      await context.close();
    },
  );

  await check(
    "Cinematic hero advances with motion enabled and respects pause",
    async () => {
      const { context, page } = await newPage({
        reducedMotion: "no-preference",
      });
      await visit(page);
      await page.waitForFunction(
        () =>
          document.querySelector(".hero-slide.is-active")?.dataset.slide ===
          "1",
        null,
        { timeout: 11000 },
      );
      const pause = page.locator(".slideshow-pause");
      await pause.click();
      assert.equal(await pause.getAttribute("aria-pressed"), "true");
      await page.mouse.move(1, 1);
      await page.locator("h1").click();
      const active = await page
        .locator(".hero-slide.is-active")
        .getAttribute("data-slide");
      await page.waitForTimeout(7000);
      assert.equal(
        await page.locator(".hero-slide.is-active").getAttribute("data-slide"),
        active,
        "Pause stops automatic transitions",
      );
      await page.locator('[data-go-slide="2"]').click();
      assert.equal(
        await page.locator(".hero-slide.is-active").getAttribute("data-slide"),
        "2",
      );
      await context.close();
    },
  );

  await check(
    "Responsive layout: every page at 1440, 820, 390 and 360 pixels",
    async () => {
      for (const width of [1440, 820, 390, 360]) {
        const { context, page } = await newPage({
          viewport: { width, height: width > 1000 ? 1000 : 844 },
          isMobile: width < 600,
          hasTouch: width < 1000,
        });
        for (const slug of pages) {
          await visit(page, slug);
          await noOverflow(page, `${slug} at ${width}px`);
          if (slug === "index" && [1440, 820, 390].includes(width))
            await screenshot(page, `${width}-home`);
          if (slug === "feiern" && width === 1440)
            await screenshot(page, "desktop-events");
          if (slug === "speisekarte" && width === 390) {
            await page.locator('[data-category="pizza"]').click();
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
    fs.writeFileSync(
      path.join(screenshots, "results.json"),
      JSON.stringify(
        { failures, browserErrors: [...browserErrors], screenshots },
        null,
        2,
      ),
    );
    if (failures.length) {
      console.error(
        `\n${failures.length} check(s) failed. Details: ${path.join(screenshots, "results.json")}`,
      );
      for (const failure of failures)
        console.error(`\n${failure.name}\n${failure.error}`);
      process.exitCode = 1;
    } else console.log(`\nAll checks passed. Screenshots: ${screenshots}`);
  }
})();
