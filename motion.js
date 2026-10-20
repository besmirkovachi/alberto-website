/* Alberto Premium V1 — optional motion, with a fully usable static fallback. */
"use strict";

(() => {
  const root = document.documentElement;
  const gsap = window.gsap;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Keep preference state and its lifecycle update in the same change event.
  // Reading diagnostics must not repeatedly evaluate a live media query.
  let prefersReducedMotion = reducedMotion.matches;
  const all = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const logo = document.querySelector(".firma-logo");
  const logoMasks = all(".firma-part", logo || document);
  const logoParts = all(".firma-part img", logo || document);
  const logoMat = logo?.querySelector(".firma-mat");
  const logoCaption = logo?.querySelector(".firma-caption");
  const headerLogo = document.querySelector(".brand img");
  const photo = document.querySelector(".hero-photo");
  const lines = all(".hero-line");
  const supporting = all(".hero-description, .hero-baseline");
  const kicker = document.querySelector(".hero-kicker");
  const introContent = [...lines, ...supporting, ...(kicker ? [kicker] : []), ...(photo ? [photo] : [])];
  const rule = document.querySelector(".firma-rule");
  const revealRecords = [];
  let intro = null;
  let introPending = false;
  let introClean = false;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let logoPlacement = null;
  let menuTween = null;
  let lenis = null;
  let tickerActive = false;
  let refreshQueued = false;
  const desktopPointer = window.matchMedia("(min-width: 1001px) and (hover: hover) and (pointer: fine)");
  let hasDesktopPointer = desktopPointer.matches;
  const connection = navigator.connection;
  const ScrollTrigger = window.ScrollTrigger;
  const keyboardScrollKeys = new Set(["Tab", "Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

  root.classList.add("js");
  // Native keyboard navigation must never inherit CSS smooth scrolling.
  // Pointer anchor scrolling below opts into motion explicitly.
  root.style.scrollBehavior = "auto";

  // Reuse the site's CSS curve in GSAP without requiring another plugin.
  function bezier(x1, y1, x2, y2) {
    const coordinate = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
    return (progress) => {
      if (progress <= 0 || progress >= 1) return progress;
      let lower = 0;
      let upper = 1;
      let t = progress;
      for (let index = 0; index < 14; index += 1) {
        if (coordinate(t, x1, x2) < progress) lower = t;
        else upper = t;
        t = (lower + upper) / 2;
      }
      return coordinate(t, y1, y2);
    };
  }

  function tokenEase(name, fallback) {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    const match = /^cubic-bezier\(([^)]+)\)$/.exec(value);
    const numbers = match ? match[1].split(",").map(Number) : fallback;
    return bezier(...(numbers.length === 4 && numbers.every(Number.isFinite) ? numbers : fallback));
  }

  const ease = tokenEase("--ease-out", [0.23, 1, 0.32, 1]);
  const moveEase = tokenEase("--ease-in-out", [0.77, 0, 0.175, 1]);
  const drawerEase = tokenEase("--ease-drawer", [0.32, 0.72, 0, 1]);

  function clearMotion(elements) {
    const targets = elements.filter(Boolean);
    if (gsap) {
      gsap.killTweensOf(targets);
      gsap.set(targets, { clearProps: "opacity,visibility,transform,transformOrigin,clipPath" });
    } else {
      targets.forEach((element) => {
        ["opacity", "visibility", "transform", "transform-origin", "clip-path"].forEach((property) => element.style.removeProperty(property));
      });
    }
  }

  function finishIntro() {
    introPending = false;
    // Keyboard navigation and content filters can call this repeatedly after
    // the opening has ended. Do not rewrite every hero style on each input.
    if (introClean && !intro && !logoPlacement) return;
    introClean = true;
    if (intro) {
      const active = intro;
      intro = null;
      active.kill();
    }
    clearMotion([...introContent, headerLogo]);
    clearMotion([...logoMasks, ...logoParts, logoMat, logoCaption, rule]);
    if (logo) {
      if (gsap) gsap.killTweensOf(logo);
      logo.style.opacity = "0";
      logo.style.visibility = "hidden";
      logo.style.pointerEvents = "none";
      logo.style.removeProperty("transform");
      logo.style.removeProperty("transform-origin");
      if (logoPlacement) {
        const { parent, sibling, styles } = logoPlacement;
        logoPlacement = null;
        parent.insertBefore(logo, sibling?.parentNode === parent ? sibling : null);
        styles.forEach(({ property, value, priority }) => {
          if (value) logo.style.setProperty(property, value, priority);
          else logo.style.removeProperty(property);
        });
      }
    }
  }

  function playIntro({ replay = false } = {}) {
    finishIntro();
    if (!logo || !photo || !gsap || prefersReducedMotion || connection?.saveData || document.hidden || window.scrollY > 32 || document.querySelector("dialog[open]")) return false;
    if (!replay && window.location.hash) return false;

    try {
      introClean = false;
      const logoImage = logoParts[0];
      const source = logoImage?.getBoundingClientRect();
      const frame = logo?.getBoundingClientRect();
      const destination = headerLogo?.getBoundingClientRect();
      const hasLogo = logoImage?.naturalWidth > 0 && source?.width > 0 && destination?.width > 0 && frame?.width > 0;

      intro = gsap.timeline({ onComplete: finishIntro });
      if (kicker) intro.fromTo(kicker, { opacity: 0 }, { opacity: 1, duration: 0.2, ease }, 0.04);
      if (photo) intro.fromTo(photo, { scale: 1.025 }, { scale: 1, duration: 1.7, ease }, 0);
      if (lines.length) intro.fromTo(lines, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.04, ease }, 0.04);
      if (supporting.length) intro.fromTo(supporting, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease }, 0.1);

      // Primary actions and the logo link stay usable; the decorative mark lands in its place.
      if (hasLogo) {
        gsap.set(headerLogo, { opacity: 0 });
        // Leave the hero's stacking context so the mark can visibly land in the
        // sticky header. Restore its original placement on every exit path.
        const overlayProperties = ["position", "left", "top", "right", "bottom", "width", "height", "z-index"];
        logoPlacement = {
          parent: logo.parentNode,
          sibling: logo.nextSibling,
          styles: overlayProperties.map((property) => ({
            property,
            value: logo.style.getPropertyValue(property),
            priority: logo.style.getPropertyPriority(property),
          })),
        };
        document.body.appendChild(logo);
        Object.assign(logo.style, {
          position: "fixed", left: `${frame.left}px`, top: `${frame.top}px`,
          right: "auto", bottom: "auto", width: `${frame.width}px`,
          height: `${frame.height}px`, zIndex: "1000",
        });
        // The measured frame already includes its CSS centering transform.
        // Reset percentages when promoting it to the fixed overlay to avoid a
        // second translate(-50%) and keep the flight aligned on every viewport.
        gsap.set(logo, { autoAlpha: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, transformOrigin: "0 0", pointerEvents: "none" });
        if (logoMat) intro.fromTo(logoMat, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.22, ease }, 0);

        // Reveal the original mark as a signature, keeping the real letterforms
        // and their Italian colors intact instead of replacing them with type.
        const groups = [
          { color: "green", left: 0, right: 31 },
          { color: "white", left: 31, right: 72 },
          { color: "red", left: 72, right: 100 },
        ];
        groups.forEach(({ color, left, right }, index) => {
          const part = logo.querySelector(`.firma-part--${color}`);
          if (!part) return;
          intro.fromTo(part, {
            clipPath: `polygon(${left}% 0, ${left}% 0, ${left}% 100%, ${left}% 100%)`,
          }, {
            clipPath: `polygon(${left}% 0, ${right}% 0, ${right}% 100%, ${left}% 100%)`,
            duration: 0.34,
            ease,
          }, 0.08 + index * 0.18);
        });
        if (rule) intro.fromTo(rule, { opacity: 0, scaleX: 0.3, transformOrigin: "left center" }, { opacity: 1, scaleX: 1, duration: 0.32, ease }, 0.42);
        if (logoCaption) intro.fromTo(logoCaption, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease }, 0.52);
        const stationery = [logoMat, logoCaption, rule].filter(Boolean);
        // A short readable hold makes the signature register before it lands
        // in the header. It never captures pointer events or locks scrolling.
        if (stationery.length) intro.to(stationery, { opacity: 0, duration: 0.16, ease }, 1.04);

        const scale = destination.width / source.width;
        const x = destination.left - frame.left - (source.left - frame.left) * scale;
        const y = destination.top - frame.top - (source.top - frame.top) * scale;
        intro.to(logo, { x, y, scale, duration: 0.58, ease: moveEase }, 1.12);
        intro.to(logo, { opacity: 0, duration: 0.08, ease }, 1.64);
        intro.to(headerLogo, { opacity: 1, duration: 0.08, ease }, 1.64);
      }
      return true;
    } catch (error) {
      finishIntro();
      console.warn("Alberto: introductory motion unavailable.", error);
      return false;
    }
  }

  async function startOpening() {
    if (!logo || !photo || !gsap || prefersReducedMotion || connection?.saveData) return;
    // Each fresh homepage entry gets its opening; a previous tab visit or
    // disabled browser storage must not permanently hide the signature.
    // Decode the two existing assets first so the mark cannot animate empty.
    const images = [photo, logoParts[0]].filter(Boolean);
    const ready = () => images.every((image) => image.complete && image.naturalWidth > 0);
    if (ready()) {
      playIntro({ replay: embeddedDemo });
      return;
    }
    introPending = true;
    let timeout;
    const decoded = await Promise.race([
      Promise.allSettled(images.map((image) => Promise.resolve().then(() => image.decode()))).then(ready),
      new Promise((resolve) => { timeout = window.setTimeout(() => resolve(false), 1200); }),
    ]);
    window.clearTimeout(timeout);
    const canStart = introPending && decoded;
    introPending = false;
    // Slow assets leave the static, usable hero in place. Never start a late
    // opening after someone has already scrolled, clicked or used the keyboard.
    if (canStart) playIntro({ replay: embeddedDemo });
  }

  function showReveal(record) {
    if (record.visible) return;
    record.visible = true;
    record.trigger?.kill();
    record.tween?.kill();
    record.trigger = null;
    record.tween = null;
    clearMotion([record.element]);
    record.element.classList.add("is-visible", "visible");
  }

  function setupReveals() {
    if (!gsap || !ScrollTrigger || prefersReducedMotion || connection?.saveData) return;
    gsap.registerPlugin(ScrollTrigger);
    const denseContent = ".page-impressum, .page-datenschutz, .legal-content, #menu-list, .menu-item, [data-menu-category], .menu-sidebar, .category-nav";
    // Read bounds as one batch. Search results, prices and legal information
    // never wait on an animation; content already in view remains visible.
    const candidates = all(".reveal")
      .filter((element) => !element.closest(denseContent) && !element.querySelector(".menu-item, .legal-content"))
      .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
      .filter(({ element, bounds }) => !element.hidden && bounds.width > 0 && bounds.top >= window.innerHeight);
    candidates.forEach(({ element }) => {
      const record = { element, trigger: null, tween: null, visible: false };
      revealRecords.push(record);
      gsap.set(element, { opacity: 0, y: hasDesktopPointer ? 12 : 6 });
      record.trigger = ScrollTrigger.create({
        trigger: element,
        start: "top 96%",
        once: true,
        onEnter() {
          if (prefersReducedMotion || element.contains(document.activeElement)) {
            showReveal(record);
            return;
          }
          record.tween = gsap.to(element, { opacity: 1, y: 0, duration: 0.4, ease, onComplete: () => showReveal(record) });
        },
      });
    });
  }

  function revealWithin(scope) {
    if (!(scope instanceof Element)) return;
    revealRecords.forEach((record) => {
      if (scope.contains(record.element) || record.element.contains(scope)) showReveal(record);
    });
  }

  function requestRefresh() {
    if (!ScrollTrigger || refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      lenis?.resize();
      ScrollTrigger.refresh();
    });
  }

  const tick = (seconds) => lenis?.raf(seconds * 1000);
  function addTicker() {
    if (tickerActive || !gsap) return;
    gsap.ticker.add(tick);
    tickerActive = true;
  }
  function removeTicker() {
    if (!tickerActive || !gsap) return;
    gsap.ticker.remove(tick);
    tickerActive = false;
  }
  function disableSmoothScroll() {
    removeTicker();
    if (!lenis) return;
    if (ScrollTrigger) lenis.off("scroll", ScrollTrigger.update);
    lenis.destroy();
    lenis = null;
  }
  function syncSmoothScroll() {
    if (!lenis) return;
    if (document.hidden || document.querySelector("dialog[open]")) {
      lenis.stop();
      removeTicker();
    } else {
      lenis.start();
      addTicker();
    }
  }
  function enableSmoothScroll() {
    if (!gsap || !window.Lenis || !hasDesktopPointer || prefersReducedMotion || connection?.saveData || document.hidden) {
      disableSmoothScroll();
      return null;
    }
    if (!lenis) {
      lenis = new window.Lenis({
        autoRaf: false,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
        lerp: 0.1,
        // Preserve browser scrolling inside controls and native dialogs.
        prevent: (element) => Boolean(element.closest?.("dialog, textarea, select, input, [data-lenis-prevent]")),
      });
      if (ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
    }
    syncSmoothScroll();
    return lenis;
  }

  function cancelMomentum() {
    if (lenis && !lenis.isStopped) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  }

  function scrollToTarget(target, { immediate = false, focus = false } = {}) {
    if (!(target instanceof Element)) return false;
    finishIntro();
    revealWithin(target);
    const instant = immediate || prefersReducedMotion;
    const headerOffset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const elementOffset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const destination = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset - elementOffset);
    if (focus && target instanceof HTMLElement) {
      const temporaryTabindex = !target.hasAttribute("tabindex") && !target.matches("a[href], button, input, select, textarea");
      if (temporaryTabindex) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      }
      target.focus({ preventScroll: true });
    }
    if (lenis && !lenis.isStopped) lenis.scrollTo(destination, { immediate: instant, duration: 0.55, easing: ease });
    else window.scrollTo({ top: destination, behavior: instant ? "instant" : "smooth" });
    return true;
  }

  function setupAnchors() {
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.hasAttribute("data-category")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
      let target;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) { return; }
      if (!target) return;
      event.preventDefault();
      if (location.hash !== url.hash) {
        try { history.pushState(null, "", url.hash); } catch (_) { /* Scrolling works without storage or history privileges. */ }
      }
      scrollToTarget(target, { immediate: event.detail === 0, focus: true });
    });
  }

  function finishMenu() {
    if (!menuTween) return;
    menuTween.kill();
    menuTween = null;
    clearMotion([document.querySelector("#mobile-menu")]);
  }

  // script.js owns native dialogs, focus, backdrop and scroll locking. Motion
  // only observes those changes, so a missing animation library cannot break UI.
  document.addEventListener("alberto:dialogchange", (event) => {
    const { dialog, open, keyboard } = event.detail;
    finishIntro();
    syncSmoothScroll();
    if (dialog.id !== "mobile-menu") return;
    finishMenu();
    if (open && !keyboard && !prefersReducedMotion && gsap) {
      menuTween = gsap.fromTo(dialog, { opacity: 0, y: -8 }, {
        opacity: 1, y: 0, duration: 0.24, ease: drawerEase, onComplete: finishMenu,
      });
    }
  });
  document.addEventListener("alberto:contentchange", (event) => {
    revealWithin(event.detail.scope);
    requestRefresh();
  });
  document.addEventListener("focusin", (event) => {
    cancelMomentum();
    revealWithin(event.target);
  });
  document.addEventListener("keydown", (event) => {
    if (introPending) finishIntro();
    if (keyboardScrollKeys.has(event.key)) {
      finishIntro();
      finishMenu();
      cancelMomentum();
      // Browser Find, tabbing and keyboard scrolling must not land in content
      // waiting for a decorative reveal to finish.
      revealRecords.forEach(showReveal);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") revealRecords.forEach(showReveal);
  });
  window.addEventListener("pointerdown", finishIntro, { passive: true });
  window.addEventListener("scroll", () => { if (intro || introPending) finishIntro(); }, { passive: true });
  window.addEventListener("resize", () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Mobile browsers can dispatch an initial resize after a cached reload
    // without changing the viewport. Keep that event from cancelling entry.
    if (width === viewportWidth && height === viewportHeight) return;
    viewportWidth = width;
    viewportHeight = height;
    if (intro || introPending) finishIntro();
  }, { passive: true });
  window.addEventListener("pagehide", () => {
    finishIntro();
    finishMenu();
    revealRecords.forEach(showReveal);
    disableSmoothScroll();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      finishIntro();
      enableSmoothScroll();
      requestRefresh();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      finishIntro();
      finishMenu();
      syncSmoothScroll();
    } else enableSmoothScroll();
  });
  reducedMotion.addEventListener("change", (event) => {
    prefersReducedMotion = event.matches;
    if (prefersReducedMotion) {
      finishIntro();
      finishMenu();
      revealRecords.forEach(showReveal);
    }
    enableSmoothScroll();
  });
  desktopPointer.addEventListener("change", (event) => {
    hasDesktopPointer = event.matches;
    enableSmoothScroll();
  });
  connection?.addEventListener?.("change", () => {
    if (connection.saveData) {
      finishIntro();
      revealRecords.forEach(showReveal);
    }
    enableSmoothScroll();
  });
  // Also cover dialogs opened directly by the browser or a future component.
  const dialogObserver = new MutationObserver(syncSmoothScroll);
  all("dialog").forEach((dialog) => dialogObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  window.addEventListener("beforeprint", () => {
    finishIntro();
    revealRecords.forEach(showReveal);
  });
  document.fonts?.ready.then(requestRefresh);
  window.addEventListener("load", requestRefresh, { once: true });

  window.AlbertoMotion = Object.freeze({
    gsap, ScrollTrigger,
    replay: () => playIntro({ replay: true }),
    finishIntro,
    enableSmoothScroll,
    disableSmoothScroll,
    scrollToTarget,
    get lenis() { return lenis; },
    getState: () => ({
      introRunning: Boolean(intro),
      introPending,
      reducedMotion: prefersReducedMotion,
      smoothScroll: Boolean(lenis),
      smoothScrollPaused: Boolean(lenis?.isStopped),
      smoothScrollStopped: Boolean(lenis?.isStopped),
      dialogLocked: Boolean(document.querySelector("dialog[open]")),
      triggerCount: ScrollTrigger?.getAll().length || 0,
      tickerActive,
      desktopPointer: hasDesktopPointer,
      saveData: Boolean(connection?.saveData),
      pendingReveals: revealRecords.filter((record) => record.trigger || record.tween).length,
    }),
  });
  // Kept for the isolated visual review harness and its replay control.
  window.AlbertoPrototype = window.AlbertoMotion;
  const embeddedDemo = window.parent !== window && (root.dataset.prototypeDemo === "true" || new URLSearchParams(location.search).has("demo"));
  if (embeddedDemo) {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== "r") return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      event.preventDefault();
      window.parent.postMessage({ type: "alberto-replay" }, "*");
    });
  }

  [setupReveals, setupAnchors, enableSmoothScroll].forEach((setup) => {
    try { setup(); }
    catch (error) {
      revealRecords.forEach(showReveal);
      console.warn(`Alberto: ${setup.name} unavailable.`, error);
    }
  });
  startOpening();
})();
