/* Alberto — small, independent enhancements for a fully usable static website. */
"use strict";

(() => {
  const root = document.documentElement;
  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const all = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));
  const lockedDialogs = new Set();
  let savedScrollStyles;

  const notifyDialog = (dialog, open, keyboard = false) => {
    document.dispatchEvent(new CustomEvent("alberto:dialogchange", {
      detail: { dialog, open, keyboard },
    }));
  };
  const notifyContent = (scope) => {
    document.dispatchEvent(new CustomEvent("alberto:contentchange", {
      detail: { scope },
    }));
  };

  function lockScroll(dialog) {
    if (lockedDialogs.has(dialog)) return;
    if (!lockedDialogs.size) {
      savedScrollStyles = {
        rootOverflow: root.style.overflow,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        bodyOverflow: document.body.style.overflow,
        bodyPadding: document.body.style.paddingRight,
      };
      const stableGutter = (
        getComputedStyle(root).scrollbarGutter || ""
      ).includes("stable");
      const gutter = stableGutter ? 0 : window.innerWidth - root.clientWidth;
      if (gutter > 0) {
        const padding =
          parseFloat(getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.paddingRight = `${padding + gutter}px`;
      }
      root.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      root.classList.add("modal-open");
    }
    lockedDialogs.add(dialog);
  }

  function unlockScroll(dialog) {
    lockedDialogs.delete(dialog);
    if (!lockedDialogs.size && savedScrollStyles) {
      root.style.overflow = savedScrollStyles.rootOverflow;
      document.body.style.overflow = savedScrollStyles.bodyOverflow;
      document.body.style.paddingRight = savedScrollStyles.bodyPadding;
      root.classList.remove("modal-open");
      // Native mobile dialogs may move the document while focusing their first
      // control. Restore the pre-dialog position before returning focus.
      window.scrollTo({ left: savedScrollStyles.scrollX, top: savedScrollStyles.scrollY, behavior: "instant" });
      savedScrollStyles = null;
    }
  }

  function prepareDialog(dialog, onChange = () => {}) {
    if (!dialog || typeof dialog.showModal !== "function") return null;
    let returnFocus = null;
    let backdropPress = false;
    let active = false;

    const finishClose = () => {
      if (!active) return;
      active = false;
      unlockScroll(dialog);
      onChange(false);
      notifyDialog(dialog, false);
      const target = returnFocus;
      returnFocus = null;
      if (target instanceof HTMLElement && target.isConnected) {
        target.focus({ preventScroll: true });
      }
    };
    const close = () => {
      if (!dialog.open) return;
      dialog.close();
      // The native close event is queued; keep ARIA and scroll state in sync
      // with the immediately closed dialog, then ignore its duplicate event.
      finishClose();
    };
    const open = (trigger = document.activeElement, keyboard = false) => {
      if (dialog.open) return;
      returnFocus = trigger;
      window.AlbertoMotion?.finishIntro();
      // Measure the scrollbar before the dialog's :has() rule locks the body.
      lockScroll(dialog);
      try {
        dialog.showModal();
      } catch (error) {
        unlockScroll(dialog);
        returnFocus = null;
        throw error;
      }
      active = true;
      onChange(true);
      notifyDialog(dialog, true, keyboard);
    };

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("close", () => {
      // A queued event from a previous close must not affect a reopened dialog.
      if (!dialog.open) finishClose();
    });
    // Requiring the press and release to both hit the backdrop avoids closing
    // when someone drags from the image or selects text inside the dialog.
    dialog.addEventListener("pointerdown", (event) => {
      backdropPress = event.target === dialog;
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && backdropPress) close();
      backdropPress = false;
    });
    return { open, close };
  }

  function navigation() {
    const toggle = document.querySelector(".nav-toggle");
    const menu = document.querySelector("#mobile-menu");
    const controls = prepareDialog(menu, (open) => {
      if (toggle) toggle.setAttribute("aria-expanded", String(open));
    });
    if (toggle && controls) {
      toggle.addEventListener("click", (event) => controls.open(toggle, event.detail === 0));
      menu
        .querySelector(".menu-close")
        ?.addEventListener("click", controls.close);
      all("a", menu).forEach((link) =>
        link.addEventListener("click", controls.close),
      );
      window
        .matchMedia("(min-width: 1001px)")
        .addEventListener("change", (event) => {
          if (event.matches) controls.close();
        });
    }

    let pending = false;
    const updateHeader = () => {
      root.classList.toggle("is-scrolled", window.scrollY > 32);
      pending = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!pending) {
          pending = true;
          requestAnimationFrame(updateHeader);
        }
      },
      { passive: true },
    );
    window.addEventListener("pageshow", updateHeader);
    updateHeader();
  }

  function searchableMenu() {
    const menu = document.querySelector("#menu-list");
    if (!menu) return;
    const sections = all("[data-menu-category]", menu);
    const links = all("[data-category]");
    const input = menu.querySelector("#dish-search");
    const clear = menu.querySelector("#clear-search");
    const reset = menu.querySelector("#reset-menu");
    const categorySelect = document.querySelector("#menu-category-select");
    const counter = menu.querySelector("#menu-count");
    const empty = menu.querySelector("#no-results");
    if (!input || !counter || !empty) return;
    const normalize = (value) =>
      value
        .toLocaleLowerCase("de-DE")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .trim();
    const data = sections.map((section) => ({
      element: section,
      category: section.dataset.menuCategory,
      title: section.querySelector("h2")?.textContent || "",
      items: all(".menu-item", section).map((element) => ({
        element,
        text: normalize(element.dataset.search || element.textContent),
      })),
    }));
    const categoryTitles = new Map(data.map((section) => [section.category, section.title]));
    const validCategories = new Set(categoryTitles.keys());
    const legacy = [
      "antipasti",
      "salate",
      "pasta",
      "pasta",
      "pizza",
      "pizza",
      "fleisch",
      "fisch",
      "getraenke",
      "bier",
      "wein",
      "aperitifs",
    ];
    let category = "all";
    let lastRender = "";
    let contentTimer = 0;

    function contentChanged(afterTyping) {
      window.clearTimeout(contentTimer);
      if (afterTyping) {
        // Results update synchronously. Expensive scroll measurements wait until
        // typing settles, rather than competing with the next input event.
        contentTimer = window.setTimeout(() => notifyContent(menu), 140);
      } else {
        notifyContent(menu);
      }
    }

    function categoryFromHash() {
      let hash;
      try {
        hash = decodeURIComponent(window.location.hash.slice(1));
      } catch (error) {
        return "all";
      }
      const old = /^menu-(\d+)$/.exec(hash);
      if (old) hash = legacy[Number(old[1])] || "";
      if (hash === "dolci") hash = "desserts";
      return validCategories.has(hash) ? hash : "all";
    }

    function updateHash() {
      const hash = category === "all" ? "#menu-list" : `#${category}`;
      if (window.location.hash !== hash) {
        try {
          window.history.pushState(null, "", hash);
        } catch (error) {
          /* Filtering remains available in restricted contexts. */
        }
      }
    }

    function render(afterTyping = false) {
      const query = normalize(input.value);
      const renderKey = `${category}\n${query}`;
      // Native search can fire after input, and history traversal can dispatch
      // both popstate and hashchange. Avoid doing the same DOM work twice.
      if (clear) clear.hidden = input.value.length === 0;
      if (lastRender === renderKey) return;
      lastRender = renderKey;
      const terms = query.split(/\s+/).filter(Boolean);
      let count = 0;
      data.forEach((section) => {
        let visible = 0;
        section.items.forEach((item) => {
          const match =
            (category === "all" || category === section.category) &&
            terms.every((term) => item.text.includes(term));
          if (item.element.hidden === match) item.element.hidden = !match;
          if (match) visible += 1;
        });
        if (section.element.hidden !== !visible) section.element.hidden = !visible;
        count += visible;
      });
      links.forEach((link) => {
        if (link.dataset.category === category)
          link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
      if (categorySelect) categorySelect.value = category;
      const categoryTitle = category === "all" ? "" : categoryTitles.get(category);
      counter.textContent = count
        ? `${count} ${count === 1 ? "Eintrag" : "Einträge"}${categoryTitle ? ` · ${categoryTitle}` : " auf unserer Karte"}${terms.length ? " für Ihre Suche" : ""}`
        : "Keine passenden Einträge gefunden.";
      empty.hidden = count !== 0;
      contentChanged(afterTyping);
    }

    links.forEach((link) =>
      link.addEventListener("click", (event) => {
        // Keep opening links in a new tab and the ordinary anchor fallback intact.
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const next = link.dataset.category;
        if (next !== "all" && !validCategories.has(next)) return;
        event.preventDefault();
        category = next;
        render();
        updateHash();
        if (menu.getBoundingClientRect().top < 0) {
          const immediate = event.detail === 0 || motionPreference.matches;
          if (window.AlbertoMotion) window.AlbertoMotion.scrollToTarget(menu, { immediate });
          else menu.scrollIntoView({ behavior: immediate ? "instant" : "smooth", block: "start" });
        }
      }),
    );
    categorySelect?.addEventListener("change", () => {
      const next = categorySelect.value;
      if (next !== "all" && !validCategories.has(next)) return;
      category = next;
      render();
      updateHash();
    });
    input.addEventListener("input", () => render(true));
    input.addEventListener("search", () => render(true));
    clear?.addEventListener("click", () => {
      input.value = "";
      render();
      input.focus({ preventScroll: true });
    });
    reset?.addEventListener("click", () => {
      category = "all";
      input.value = "";
      render();
      updateHash();
      input.focus({ preventScroll: true });
    });
    const followHash = () => {
      category = categoryFromHash();
      render();
    };
    window.addEventListener("hashchange", followHash);
    window.addEventListener("popstate", followHash);
    followHash();
  }

  function gallery() {
    const tiles = all("[data-gallery-category]");
    const filters = all("[data-gallery-filter]");
    const counter = document.querySelector("#gallery-count");
    const links = all("[data-lightbox]");
    const box = document.querySelector("#lightbox");
    let controls;
    let selected = 0;
    let visibleLinks = [];

    filters.forEach((button) =>
      button.addEventListener("click", () => {
        const category = button.dataset.galleryFilter;
        document
          .querySelector(".gallery-grid")
          ?.classList.toggle("is-filtered", category !== "all");
        let count = 0;
        tiles.forEach((tile) => {
          tile.hidden =
            category !== "all" && tile.dataset.galleryCategory !== category;
          if (!tile.hidden) count += 1;
        });
        filters.forEach((filter) =>
          filter.setAttribute("aria-pressed", String(filter === button)),
        );
        if (counter)
          counter.textContent = `${count} ${count === 1 ? "Bild" : "Bilder"} angezeigt.`;
        notifyContent(document.querySelector(".gallery-grid"));
      }),
    );
    if (counter && tiles.length)
      counter.textContent = `${tiles.length} Bilder angezeigt.`;
    if (!box || !links.length) return;
    const image = box.querySelector("img");
    const caption = box.querySelector("figcaption");
    const previous = box.querySelector(".lightbox-prev");
    const next = box.querySelector(".lightbox-next");
    if (!image || !caption || !previous || !next) return;
    controls = prepareDialog(box);
    if (!controls) return;

    function show(index) {
      if (!visibleLinks.length) return;
      selected = (index + visibleLinks.length) % visibleLinks.length;
      const link = visibleLinks[selected];
      const thumbnail = link.querySelector("img");
      image.src = link.href;
      image.alt = thumbnail?.alt || "";
      image.decoding = "async";
      caption.textContent = `${link.dataset.caption || image.alt} · Bild ${selected + 1} von ${visibleLinks.length}`;
      previous.disabled = visibleLinks.length < 2;
      next.disabled = visibleLinks.length < 2;
    }

    links.forEach((link) =>
      link.addEventListener("click", (event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        visibleLinks = links.filter(
          (item) => !item.closest("[data-gallery-category]")?.hidden,
        );
        show(visibleLinks.indexOf(link));
        controls.open(link, event.detail === 0);
      }),
    );
    box
      .querySelector(".lightbox-close")
      ?.addEventListener("click", controls.close);
    previous.addEventListener("click", () => show(selected - 1));
    next.addEventListener("click", () => show(selected + 1));
    box.addEventListener("keydown", (event) => {
      if (!box.open || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        show(selected + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
  }

  function kitchenVideo() {
    const video = document.querySelector("#kitchen-video");
    if (!video) return;
    // Browsers without viewport observation retain their native controls.
    if (!("IntersectionObserver" in window)) return;

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "video-toggle";
    toggle.setAttribute("aria-controls", video.id);
    let visible = false;
    let autoplayVisible = false;
    let pageHidden = false;
    let userPaused = false;
    let userStarted = false;
    let autoplayBlocked = false;
    let reducedMotion = motionPreference.matches;
    let saveData = Boolean(connection?.saveData);
    let playRequest = 0;
    let playPending = false;

    const updateButton = () => {
      const playing = !video.paused || playPending;
      toggle.textContent = playing ? "Video pausieren" : "Video abspielen";
      toggle.setAttribute("aria-label", playing ? "Küchenvideo pausieren" : "Küchenvideo abspielen");
      toggle.dataset.playing = String(playing);
    };
    const shouldPlay = () =>
      visible && !document.hidden && !pageHidden && !userPaused &&
      (userStarted || (!reducedMotion && !saveData && !autoplayBlocked &&
        (autoplayVisible || !video.paused || playPending)));

    function pause() {
      // Invalidate a pending play promise: a late resolution must not restart
      // playback after scrolling away, hiding the tab or pressing Pause.
      playRequest += 1;
      playPending = false;
      video.pause();
      updateButton();
    }

    function syncPlayback() {
      if (!shouldPlay()) {
        pause();
        return;
      }
      if (!video.paused || playPending) return;
      const request = ++playRequest;
      playPending = true;
      updateButton();
      try {
        const result = video.play();
        Promise.resolve(result).then(() => {
          if (request !== playRequest) return;
          playPending = false;
          if (!shouldPlay()) pause();
          else updateButton();
        }).catch(() => {
          if (request !== playRequest) return;
          // Autoplay restrictions are normal browser behavior. Keep the poster
          // and manual Play available, without unhandled promise rejections.
          playPending = false;
          autoplayBlocked = true;
          userStarted = false;
          updateButton();
        });
      } catch (_) {
        playPending = false;
        autoplayBlocked = true;
        userStarted = false;
        updateButton();
      }
    }

    toggle.addEventListener("click", () => {
      if (!video.paused || playPending) {
        userPaused = true;
        userStarted = false;
        pause();
      } else {
        userPaused = false;
        userStarted = true;
        autoplayBlocked = false;
        // A click can precede the observer callback after a quick scroll.
        const rect = video.getBoundingClientRect();
        visible = rect.bottom > 0 && rect.top < window.innerHeight &&
          rect.right > 0 && rect.left < window.innerWidth;
        syncPlayback();
      }
    });
    video.addEventListener("play", () => {
      if (!shouldPlay()) pause();
      else updateButton();
    });
    video.addEventListener("pause", updateButton);
    video.addEventListener("error", () => {
      pause();
      toggle.hidden = true;
      video.controls = true;
    });
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("pagehide", () => {
      pageHidden = true;
      pause();
    });
    window.addEventListener("pageshow", () => {
      pageHidden = false;
      syncPlayback();
    });
    motionPreference.addEventListener("change", (event) => {
      reducedMotion = event.matches;
      // Changing the preference also stops an explicitly started video; the
      // visitor can choose Play again in manual mode.
      if (reducedMotion) userStarted = false;
      syncPlayback();
    });
    connection?.addEventListener?.("change", () => {
      saveData = Boolean(connection.saveData);
      if (saveData) userStarted = false;
      syncPlayback();
    });
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      autoplayVisible = entry.intersectionRatio >= 0.5;
      syncPlayback();
    }, { threshold: [0, 0.5] });

    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    updateButton();
    video.insertAdjacentElement("afterend", toggle);
    observer.observe(video);
    // This is last: a failed enhancement must leave the native player usable.
    video.controls = false;
  }

  root.classList.add("js");
  // Content is visible even when the optional GSAP enhancement cannot load.
  all(".reveal").forEach((element) => {
    element.classList.remove("reveal-ready");
    element.classList.add("is-visible", "visible");
  });
  [
    navigation,
    searchableMenu,
    gallery,
    kitchenVideo,
  ].forEach((enhance) => {
    try {
      enhance();
    } catch (error) {
      // Each component is independent, so static content and other controls
      // remain usable if one optional browser enhancement cannot initialize.
      console.warn(
        `Alberto: ${enhance.name} konnte nicht aktiviert werden.`,
        error,
      );
    }
  });
})();
