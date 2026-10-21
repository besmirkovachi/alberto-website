"use strict";
const PLACE_ID = "ChIJvxMbe4y5kUcRX1GLsx9MlT0";
const LIEFERANDO_URL = "https://www.ristorantepizzeriaalberto-weilamrhein.de/review";
const validScore = (rating, count) => Number.isFinite(rating) && rating > 0 && rating <= 5 && Number.isSafeInteger(count) && count > 0;

function parseLieferando(html) {
  // Match the provider's own labelled aggregate, never an individual review.
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;|&#xA0;/gi, " ").replace(/\s+/g, " ");
  if (!/Ristorante\s+Pizzeria\s+Alberto/i.test(text) || !/Holzmattenweg/i.test(text) || !/Lieferando/i.test(text)) throw new Error("Unexpected restaurant");
  const match = /([0-5](?:[.,]\d+)?)\s+Sterne\s+aus\s+([\d.\s]+)\s+Bewertungen/i.exec(text);
  if (!match) throw new Error("Provider aggregate unavailable");
  const rating = Number(match[1].replace(",", "."));
  const count = Number(match[2].replace(/[.\s]/g, ""));
  if (!validScore(rating, count)) throw new Error("Invalid aggregate");
  return { rating, count };
}

async function readLimited(response) {
  if (!response.ok) throw new Error("Provider request failed");
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw new Error("Provider response too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString("utf8");
}

function createRatingsService({ fetchImpl = fetch, googleKey = process.env.GOOGLE_PLACES_API_KEY, now = Date.now } = {}) {
  // Coalesce simultaneous requests; do not persist or cache Google Places data.
  const pending = new Map();
  return async function getRating(provider) {
    if (!["google", "lieferando"].includes(provider)) throw new Error("Unknown provider");
    if (provider === "google" && !googleKey) return { provider, status: "unavailable" };
    if (pending.has(provider)) return pending.get(provider);
    const request = (async () => {
      try {
        let score; let attributions = [];
        if (provider === "google") {
          const response = await fetchImpl(`https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=de`, {
            headers: { "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "id,rating,userRatingCount,attributions" },
            signal: AbortSignal.timeout(6000), redirect: "error",
          });
          const data = JSON.parse(await readLimited(response));
          if (data.id !== PLACE_ID || !validScore(data.rating, data.userRatingCount)) throw new Error("Invalid Google response");
          score = { rating: data.rating, count: data.userRatingCount };
          attributions = (data.attributions || []).filter(a => typeof a.provider === "string" && /^https:\/\//.test(a.providerUri || "")).map(a => ({ name: a.provider, url: a.providerUri }));
        } else {
          const response = await fetchImpl(LIEFERANDO_URL, { headers: { Accept: "text/html" }, signal: AbortSignal.timeout(6000), redirect: "error" });
          score = parseLieferando(await readLimited(response));
        }
        return { provider, status: "ok", ...score, attributions, checkedAt: new Date(now()).toISOString() };
      } catch (_) {
        // No key, raw upstream response or stale fabricated score reaches clients.
        return { provider, status: "unavailable" };
      }
    })();
    pending.set(provider, request);
    try { return await request; } finally { pending.delete(provider); }
  };
}
module.exports = { PLACE_ID, LIEFERANDO_URL, validScore, parseLieferando, createRatingsService };
