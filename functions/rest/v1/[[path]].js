// أي طلب على /rest/v1/* (courses, lectures, books, ...) يمر من هنا تلقائيًا
// بفضل تسمية الملف [[path]].js في Pages Functions.
//
// المسؤولية الوحيدة لهذا الملف: تخزين استجابات الجداول "العامة" (نفس النتيجة
// لأي مستخدم) في Workers KV، وتمرير أي شيء آخر مباشرة إلى Supabase بدون تعديل.
//
// ⚠️ لا تُضِف هنا أي جدول تختلف نتيجته حسب هوية المستخدم (محفظة، بروفايل،
// إشعارات) — لأن الكاش هيتشارك بين كل الزوار وممكن يسرّب بيانات مستخدم لآخر.
//
// لا يلمس ولا يتعارض مع: purchase-item.js, create-payment.js,
// check-transaction.js, kashier-webhook.js (مسارات مختلفة تمامًا).
//
// يتطلب: KV binding باسم CACHE_KV مربوط بالمشروع من لوحة Cloudflare
// (Settings → Functions → KV namespace bindings).

import { json, missingEnv } from "../../_lib/http.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

// الجداول العامة القابلة للكاش + مدة الصلاحية بالثواني
const CACHEABLE_PREFIXES = [
  { prefix: "/rest/v1/courses", ttl: 60 * 30 },      // نص ساعة
  { prefix: "/rest/v1/lectures", ttl: 60 * 60 },     // ساعة
  { prefix: "/rest/v1/books", ttl: 60 * 60 * 6 },    // 6 ساعات
];

// هيدرز لا ننسخها من استجابة Supabase عند التخزين (خاصة بالاتصال نفسه، مش بالمحتوى)
const SKIP_HEADERS = new Set(["set-cookie", "content-encoding", "content-length", "transfer-encoding"]);

export async function onRequest({ request, env, waitUntil }) {
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

  // لو الـ KV مش مربوط لأي سبب، نكمل عادي بدون كاش بدل ما نكسر الموقع
  if (!env.CACHE_KV) {
    console.error("rest-cache: CACHE_KV غير مربوط، سيتم التمرير بدون كاش");
    return proxyToSupabase(request, env, url);
  }

  return handleCacheable(request, env, url, match.ttl);
}

async function handleCacheable(request, env, url, ttlSeconds) {
  const key = url.pathname + url.search;

  let cached = null;
  try {
    cached = await env.CACHE_KV.get(key, "json");
  } catch (e) {
    console.error("rest-cache: خطأ في قراءة KV:", e.message);
  }

  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...cached.headers, "X-Cache-Status": "HIT" },
    });
  }

  const upstream = await proxyToSupabase(request, env, url);
  if (!upstream.ok) return upstream;

  const bodyText = await upstream.text();
  const headersObj = {};
  upstream.headers.forEach((value, name) => {
    if (!SKIP_HEADERS.has(name.toLowerCase())) headersObj[name] = value;
  });

  try {
    await env.CACHE_KV.put(
      key,
      JSON.stringify({ status: upstream.status, headers: headersObj, body: bodyText }),
      { expirationTtl: ttlSeconds }
    );
  } catch (e) {
    console.error("rest-cache: خطأ في الكتابة إلى KV:", e.message);
  }

  return new Response(bodyText, {
    status: upstream.status,
    headers: { ...headersObj, "X-Cache-Status": "MISS" },
  });
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