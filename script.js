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

  function lockScroll(dialog) {
    if (lockedDialogs.has(dialog)) return;
    if (!lockedDialogs.size) {
      savedScrollStyles = {
        rootOverflow: root.style.overflow,
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
    const open = (trigger = document.activeElement) => {
      if (dialog.open) return;
      returnFocus = trigger;
      dialog.showModal();
      active = true;
      lockScroll(dialog);
      onChange(true);
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
      toggle.addEventListener("click", () => controls.open(toggle));
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

  function reveals() {
    const elements = all(".reveal");
    const show = (element) => {
      element.classList.add("is-visible", "visible");
    };
    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      elements.forEach(show);
      return;
    }
    let observer;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              show(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
      );
      elements.forEach((element) => {
        // Content already in view is never hidden while JavaScript initializes.
        if (element.getBoundingClientRect().top < window.innerHeight - 24) {
          show(element);
        } else {
          observer.observe(element);
          element.classList.add("reveal-ready");
        }
      });
      document.addEventListener("focusin", (event) => {
        const element = event.target.closest?.(".reveal");
        if (element) {
          show(element);
          observer.unobserve(element);
        }
      });
      motionPreference.addEventListener("change", (event) => {
        if (event.matches) {
          observer.disconnect();
          elements.forEach(show);
        }
      });
    } catch (error) {
      observer?.disconnect();
      elements.forEach(show);
    }
  }

  function cinematicHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const slides = all(".hero-slide", hero);
    const dots = all("[data-go-slide]", hero);
    const pause = hero.querySelector(".slideshow-pause");
    const visual = hero.querySelector(".hero-visual");
    if (slides.length < 2 || !pause || !visual) return;

    let current = 0;
    let paused =
      motionPreference.matches || Boolean(navigator.connection?.saveData);
    let inView = true;
    let hovering = false;
    let focused = false;
    let interactionResume = false;
    let advances = 0;
    let timer = null;
    const delay = 6500;
    const slideContainer = hero.querySelector(".hero-slides");
    slideContainer.setAttribute("aria-roledescription", "Karussell");
    slideContainer.setAttribute("role", "group");
    slides.forEach((slide, index) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "Bild");
      slide.setAttribute("aria-label", `${index + 1} von ${slides.length}`);
      slide.setAttribute("aria-hidden", String(index !== current));
    });

    function updateControls() {
      pause.setAttribute("aria-pressed", String(paused));
      pause.setAttribute(
        "aria-label",
        paused ? "Bildwechsel fortsetzen" : "Bildwechsel pausieren",
      );
      pause.textContent = paused ? "▷" : "Ⅱ";
      pause.hidden = motionPreference.matches;
    }

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        const active = position === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot) => {
        const active = Number(dot.dataset.goSlide) === current;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-pressed", String(active));
      });
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = null;
      if (
        paused ||
        motionPreference.matches ||
        document.hidden ||
        !inView ||
        ((hovering || focused) && !interactionResume)
      )
        return;
      timer = window.setTimeout(() => {
        show(current + 1);
        advances += 1;
        // A short opening sequence settles after showing all three images.
        // The visitor can restart it or explore directly with the controls.
        if (advances >= slides.length - 1) paused = true;
        updateControls();
        schedule();
      }, delay);
    }

    dots.forEach((dot) =>
      dot.addEventListener("click", () => {
        const index = Number(dot.dataset.goSlide);
        if (!Number.isInteger(index) || index < 0 || index >= slides.length)
          return;
        paused = true;
        interactionResume = false;
        show(index);
        updateControls();
        schedule();
      }),
    );
    pause.addEventListener("click", () => {
      paused = !paused;
      // An explicit Play action takes effect even while its control retains
      // focus or hover. A new focus/hover interaction pauses the tour again.
      interactionResume = !paused;
      advances = 0;
      updateControls();
      schedule();
    });
    visual.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        hovering = true;
        interactionResume = false;
        schedule();
      }
    });
    visual.addEventListener("pointerleave", () => {
      hovering = false;
      schedule();
    });
    visual.addEventListener("focusin", () => {
      focused = true;
      interactionResume = false;
      schedule();
    });
    visual.addEventListener("focusout", (event) => {
      focused = visual.contains(event.relatedTarget);
      schedule();
    });
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("pagehide", () => window.clearTimeout(timer));
    window.addEventListener("pageshow", schedule);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting;
          schedule();
        },
        { threshold: 0.15 },
      );
      observer.observe(hero);
    }
    motionPreference.addEventListener("change", (event) => {
      if (event.matches) {
        paused = true;
        document.body.classList.remove("intro-play");
      }
      updateControls();
      schedule();
    });

    if (!motionPreference.matches) {
      try {
        const key = "alberto-intro-seen";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          document.body.classList.add("intro-play");
          window.setTimeout(
            () => document.body.classList.remove("intro-play"),
            2400,
          );
        }
      } catch (error) {
        // Browsing and image controls still work when storage is unavailable.
      }
    }
    updateControls();
    schedule();
  }

  function searchableMenu() {
    const menu = document.querySelector("#menu-list");
    if (!menu) return;
    const sections = all("[data-menu-category]", menu);
    const links = all("[data-category]");
    const input = menu.querySelector("#dish-search");
    const clear = menu.querySelector("#clear-search");
    const reset = menu.querySelector("#reset-menu");
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
      items: all(".menu-item", section).map((element) => ({
        element,
        text: normalize(element.dataset.search || element.textContent),
      })),
    }));
    const validCategories = new Set(data.map((section) => section.category));
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
      "getraenke",
      "wein",
      "wein",
    ];
    let category = "all";

    function categoryFromHash() {
      let hash;
      try {
        hash = decodeURIComponent(window.location.hash.slice(1));
      } catch (error) {
        return "all";
      }
      const old = /^menu-(\d+)$/.exec(hash);
      if (old) hash = legacy[Number(old[1])] || "";
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

    function render() {
      const terms = normalize(input.value).split(/\s+/).filter(Boolean);
      let count = 0;
      data.forEach((section) => {
        let visible = 0;
        section.items.forEach((item) => {
          const match =
            (category === "all" || category === section.category) &&
            terms.every((term) => item.text.includes(term));
          item.element.hidden = !match;
          if (match) visible += 1;
        });
        section.element.hidden = !visible;
        count += visible;
      });
      links.forEach((link) => {
        if (link.dataset.category === category)
          link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
      const categoryTitle =
        category === "all"
          ? ""
          : sections
              .find((section) => section.dataset.menuCategory === category)
              ?.querySelector("h2")?.textContent;
      counter.textContent = count
        ? `${count} ${count === 1 ? "Eintrag" : "Einträge"}${categoryTitle ? ` · ${categoryTitle}` : " auf unserer Karte"}${terms.length ? " für Ihre Suche" : ""}`
        : "Keine passenden Einträge gefunden.";
      empty.hidden = count !== 0;
      if (clear) clear.hidden = input.value.length === 0;
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
          menu.scrollIntoView({
            behavior: motionPreference.matches ? "instant" : "smooth",
            block: "start",
          });
        }
      }),
    );
    input.addEventListener("input", render);
    input.addEventListener("search", render);
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
        controls.open(link);
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
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) video.pause();
    });
    window.addEventListener("pagehide", () => video.pause());
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting && !video.paused) video.pause();
        },
        { threshold: 0 },
      );
      observer.observe(video);
    }
  }

  root.classList.add("js");
  [
    navigation,
    reveals,
    cinematicHero,
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
