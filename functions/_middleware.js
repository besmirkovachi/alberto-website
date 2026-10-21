const pages = new Set(["/", "/index", "/index/", "/index.html", "/bestellen", "/bestellen/", "/bestellen.html"]);
const privatePath = /^\/(?:server|scripts|tests|templates|functions)(?:\/|$)|^\/(?:\.[^/]*|package(?:-lock)?\.json|MANIFEST\.json|README\.md|KONTROLLET\.md|LEXO-FILLIMISHT\.txt|THIRD-PARTY\.md)$/i;

export async function onRequest(context) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(context.request.url).pathname); }
  catch { return new Response("Bad request", { status: 400 }); }
  if (pathname.split("/").some(part => part.startsWith(".")) || privatePath.test(pathname)) return new Response("Not found", { status: 404 });
  const response = await context.next();
  if (!pages.has(pathname) || !response.ok || !response.headers.get("Content-Type")?.includes("text/html")) return response;
  return new HTMLRewriter().on('meta[name="alberto-ratings-endpoint"]', {
    element(element) { element.setAttribute("content", "/api/ratings"); },
  }).transform(response);
}
