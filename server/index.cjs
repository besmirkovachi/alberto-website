"use strict";
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createRatingsService } = require("./ratings.cjs");
const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp4": "video/mp4", ".txt": "text/plain", ".xml": "application/xml" };
function createServer({ getRating = createRatingsService() } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(req.url, "http://localhost");
      if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }
      if (url.pathname === "/api/ratings") {
        const provider = url.searchParams.get("provider");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (!["google", "lieferando"].includes(provider)) { res.writeHead(400); return res.end('{"error":"Unknown provider"}'); }
        if (req.method === "HEAD") return res.end();
        return res.end(JSON.stringify(await getRating(provider)));
      }
      const name = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).slice(1);
      // Serve only public website files; never .env, server source or Git metadata.
      const publicRoot = /^(?:[a-z][a-z0-9-]*\.(?:html|css|js)|menu\.json|robots\.txt|sitemap\.xml)$/.test(name);
      const publicAsset = /^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:css|js|svg|webp|png|jpg|woff2|mp4)$/.test(name);
      if (!publicRoot && !publicAsset) { res.writeHead(404); return res.end("Not found"); }
      const file = path.join(ROOT, name);
      let body = await fs.readFile(file);
      if (name.endsWith(".html")) body = Buffer.from(body.toString().replace('<meta name="alberto-ratings-endpoint" content="">', '<meta name="alberto-ratings-endpoint" content="/api/ratings">'));
      res.setHeader("Content-Type", TYPES[path.extname(name)] || "application/octet-stream");
      res.setHeader("Content-Length", body.length);
      res.setHeader("Cache-Control", name.endsWith(".html") ? "no-cache" : "public, max-age=300");
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      res.writeHead(error.code === "ENOENT" || error instanceof URIError ? 404 : 500);
      res.end("Unavailable");
    }
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  createServer().listen(port, process.env.HOST || "127.0.0.1", () => console.log(`Alberto preview: http://127.0.0.1:${port}`));
}
module.exports = { createServer };
