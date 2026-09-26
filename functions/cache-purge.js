// POST /cache-purge  — تفريغ يدوي لكاش جدول معيّن بعد تعديله من لوحة الأدمن
// مثال استدعاء:
//   POST /cache-purge
//   Headers: { "X-Purge-Token": "<CACHE_PURGE_TOKEN>" }
//   Body: { "path": "/rest/v1/courses" }
import { json, missingEnv } from "./_lib/http.js";

const REQUIRED_ENV = ["CACHE_PURGE_TOKEN"];

export async function onRequestPost({ request, env }) {
  const missing = missingEnv(env, REQUIRED_ENV);
  if (missing.length) {
    return json(500, { error: `إعدادات ناقصة: ${missing.join(", ")}` });
  }

  const token = request.headers.get("x-purge-token");
  if (!token || token !== env.CACHE_PURGE_TOKEN) {
    return json(401, { error: "غير مصرح" });
  }

  const body = (await request.json().catch(() => ({}))) || {};
  const path = body.path;
  if (!path || typeof path !== "string" || !path.startsWith("/rest/v1/")) {
    return json(400, { error: "path مطلوب ويجب أن يبدأ بـ /rest/v1/" });
  }

  const targetUrl = new URL(path, request.url);
  const deleted = await caches.default.delete(new Request(targetUrl.toString()));

  return json(200, { deleted, path });
}