/* Live ratings are optional: provider links work without JavaScript or a backend. */
"use strict";
(() => {
  const configured = document.querySelector('meta[name="alberto-ratings-endpoint"]')?.content;
  if (!configured || !/^https?:$/.test(location.protocol)) return;
  let endpoint;
  try { endpoint = new URL(configured, location.href); } catch (_) { return; }
  if (endpoint.origin !== location.origin) return;
  const MAX_AGE = 5 * 60 * 1000;
  const cards = [...document.querySelectorAll('[data-rating-provider]:not([data-rating-mode="manual"])')].map(element => ({ element, provider: element.dataset.ratingProvider, checkedAt: 0, pending: false, visible: false, expiry: null }));
  const number = new Intl.NumberFormat("de-DE");
  const score = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function reset(card) {
    card.element.querySelector("[data-rating-live]").hidden = true;
    card.element.querySelector("[data-rating-fallback]").hidden = false;
    const headline = card.element.querySelector("[data-rating-headline]");
    if (headline) headline.textContent = "Von unseren Gästen geschätzt.";
    card.element.querySelector("[data-rating-attributions]")?.replaceChildren();
    card.checkedAt = 0;
    clearTimeout(card.expiry);
  }
  async function refresh(card) {
    if (card.pending || document.hidden || !card.visible) return;
    card.pending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(endpoint);
      url.searchParams.set("provider", card.provider);
      const response = await fetch(url, { signal: controller.signal, cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json();
      const checkedAt = Date.parse(data.checkedAt);
      const age = Date.now() - checkedAt;
      if (data.status !== "ok" || data.provider !== card.provider || !Number.isFinite(data.rating) || data.rating <= 0 || data.rating > 5 || !Number.isSafeInteger(data.count) || data.count < 1 || !Number.isFinite(checkedAt) || age < -60000 || age >= MAX_AGE) throw new Error("Invalid or expired rating");
      card.element.querySelector("[data-rating-score]").textContent = score.format(data.rating);
      card.element.querySelector("[data-rating-stars]").style.width = `${data.rating / 5 * 100}%`;
      card.element.querySelector("[data-rating-count]").textContent = `Basierend auf ${number.format(data.count)} Bewertungen`;
      card.element.querySelector("[data-rating-updated]").textContent = `Abgerufen am ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(checkedAt)}`;
      const attribution = card.element.querySelector("[data-rating-attributions]");
      if (attribution) {
        attribution.replaceChildren();
        for (const item of data.attributions || []) {
          if (typeof item.name !== "string" || typeof item.url !== "string") continue;
          let url; try { url = new URL(item.url); } catch (_) { continue; }
          if (url.protocol !== "https:") continue;
          const link = document.createElement("a");
          link.textContent = item.name; link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
          attribution.append(link, document.createTextNode(" "));
        }
      }
      const headline = card.element.querySelector("[data-rating-headline]");
      if (headline) headline.textContent = data.rating === 5 ? "Mit 5 Sternen bewertet." : "Von unseren Gästen geschätzt.";
      card.element.querySelector("[data-rating-live]").hidden = false;
      card.element.querySelector("[data-rating-fallback]").hidden = true;
      card.checkedAt = checkedAt;
      clearTimeout(card.expiry);
      card.expiry = setTimeout(() => { reset(card); refresh(card); }, Math.max(0, MAX_AGE - age));
    } catch (_) { reset(card); }
    finally { clearTimeout(timeout); card.pending = false; }
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const card = cards.find(card => card.element === entry.target);
      card.visible = entry.isIntersecting;
      if (card.visible && (!card.checkedAt || Date.now() - card.checkedAt >= MAX_AGE)) refresh(card);
    }
  }, { rootMargin: "150px" });
  cards.forEach(card => observer.observe(card.element));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    cards.forEach(card => {
      if (!card.checkedAt || Date.now() - card.checkedAt >= MAX_AGE) { reset(card); refresh(card); }
    });
  });
  // Retry transient failures while the visitor is viewing the section.
  setInterval(() => cards.forEach(card => { if (!card.checkedAt) refresh(card); }), 60000);
})();
