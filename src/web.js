import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPlaces } from "./extractor.js";

const publicDir = path.resolve(fileURLToPath(new URL("../public", import.meta.url)));

export function createWebServer({ store, bot, webhookSecret }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === "/api/health") {
        return json(res, { ok: true });
      }

      const webhook = url.pathname.match(/^\/telegram\/webhook\/([^/]+)$/);
      if (webhook && req.method === "POST") {
        if (!bot) return json(res, { error: "Bot is disabled" }, 503);
        if (webhook[1] !== webhookSecret) return json(res, { error: "Forbidden" }, 403);
        const update = await readJson(req);
        await bot.handleUpdate(update);
        return json(res, { ok: true });
      }

      const userApi = url.pathname.match(/^\/api\/u\/([^/]+)$/);
      if (userApi && req.method === "GET") {
        const user = await store.getUserByToken(userApi[1]);
        if (!user) return json(res, { error: "Not found" }, 404);
        return json(res, serializeUser(user));
      }

      const addPlaces = url.pathname.match(/^\/api\/u\/([^/]+)\/places$/);
      if (addPlaces && req.method === "POST") {
        const user = await store.getUserByToken(addPlaces[1]);
        if (!user) return json(res, { error: "Not found" }, 404);
        const body = await readJson(req);
        const candidates = extractPlaces(body.text || "");
        const result = await store.addPlaces(user.id, candidates);
        return json(res, {
          added: result.added,
          duplicates: result.duplicates,
          user: serializeUser(user)
        });
      }

      if (url.pathname === "/" || /^\/u\/[^/]+$/.test(url.pathname)) {
        return file(res, "index.html", "text/html; charset=utf-8");
      }

      if (url.pathname.startsWith("/public/") || ["/styles.css", "/app.js"].includes(url.pathname)) {
        const name = path.basename(url.pathname);
        const contentType = contentTypeFor(name);
        return file(res, name, contentType);
      }

      return text(res, "Not found", 404);
    } catch (error) {
      console.error("Web error:", error);
      return json(res, { error: "Internal error" }, 500);
    }
  });
}

function serializeUser(user) {
  return {
    firstName: user.firstName,
    username: user.username,
    createdAt: user.createdAt,
    places: user.places.map((place) => ({
      ...place,
      mapsUrl: googleMapsUrl(place)
    }))
  };
}

function googleMapsUrl(place) {
  const query = [place.title, place.city !== "Нужно уточнить" ? place.city : ""].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function file(res, name, contentType) {
  const fullPath = path.join(publicDir, name);
  if (!fullPath.startsWith(publicDir)) return text(res, "Forbidden", 403);
  const body = await fs.readFile(fullPath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function text(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function contentTypeFor(name) {
  if (name.endsWith(".css")) return "text/css; charset=utf-8";
  if (name.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
