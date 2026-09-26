// أي طلب على /rest/v1/* (courses, lectures, books, ...) يمر من هنا تلقائيًا
// بفضل تسمية الملف [[path]].js في Pages Functions.
//
// المسؤولية الوحيدة لهذا الملف: تخزين استجابات الجداول "العامة" (نفس النتيجة
// لأي مستخدم) في Cache API، وتمرير أي شيء آخر مباشرة إلى Supabase بدون تعديل.
//
// ⚠️ لا تُضِف هنا أي جدول تختلف نتيجته حسب هوية المستخدم (محفظة، بروفايل،
// إشعارات) — لأن الكاش هيتشارك بين كل الزوار وممكن يسرّب بيانات مستخدم لآخر.
//
// لا يلمس ولا يتعارض مع: purchase-item.js, create-payment.js,
// check-transaction.js, kashier-webhook.js (مسارات مختلفة تمامًا).

import { json, missingEnv } from "../../_lib/http.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

// الجداول العامة القابلة للكاش + مدة الصلاحية بالثواني
const CACHEABLE_PREFIXES = [
  { prefix: "/rest/v1/courses", ttl: 60 * 30 },      // نص ساعة
  { prefix: "/rest/v1/lectures", ttl: 60 * 60 },     // ساعة
  { prefix: "/rest/v1/books", ttl: 60 * 60 * 6 },    // 6 ساعات
];

export async function onRequest({ request, env, ctx }) {
  const missing = missingEnv(env, REQUIRED_ENV);
  if (missing.length) {
    console.error(`rest-cache: إعدادات ناقصة: ${missing.join(", ")}`);
    return json(500, { error: "خطأ في إعدادات الخادم" });
  }

  const url = new URL(request.url);

  if (request.method !== "GET") {
    return proxyToSupabase(request, env, url);
  }

  const match = CACHEABLE_PREFIXES.find((c) => url.pathname.startsWith(c.prefix));
  if (!match) {
    return proxyToSupabase(request, env, url);
  }

  return handleCacheable(request, env, ctx, url, match.ttl);
}

async function handleCacheable(request, env, ctx, url, ttlSeconds) {
  const cacheKey = new Request(url.toString(), request);
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set("X-Cache-Status", "HIT");
    return res;
  }

  const upstream = await proxyToSupabase(request, env, url);
  if (!upstream.ok) return upstream;

  const toCache = new Response(upstream.body, upstream);
  toCache.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
  toCache.headers.set("X-Cache-Status", "MISS");

  ctx.waitUntil(cache.put(cacheKey, toCache.clone()));
  return toCache;
}

async function proxyToSupabase(request, env, url) {
  const target = new URL(url.pathname + url.search, env.SUPABASE_URL);

  const headers = new Headers(request.headers);
  headers.set("apikey", env.SUPABASE_ANON_KEY);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${env.SUPABASE_ANON_KEY}`);
  }
  headers.delete("host");
  headers.delete("cf-connecting-ip");

  const init = {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.clone().text(),
  };

  return fetch(target.toString(), init);
}