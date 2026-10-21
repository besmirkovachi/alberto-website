import ratings from "../../server/ratings.cjs";

export async function onRequest({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
  }
  const provider = new URL(request.url).searchParams.get("provider");
  if (!["google", "lieferando"].includes(provider)) {
    return new Response(request.method === "HEAD" ? null : JSON.stringify({ error: "Unknown provider" }), { status: 400, headers });
  }
  if (request.method === "HEAD") return new Response(null, { headers });
  const getRating = ratings.createRatingsService({ googleKey: env.GOOGLE_PLACES_API_KEY || "" });
  return new Response(JSON.stringify(await getRating(provider)), { headers });
}
