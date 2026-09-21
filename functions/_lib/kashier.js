// التعامل مع Kashier v3: إنشاء جلسة الدفع + التحقق من توقيع الـ webhook.
// لا يوجد استعلام عن حالة الدفع هنا عمدًا: الاعتماد يتم فقط عبر الـ webhook الموقّع.

const TIMEOUT_MS = 15_000;

// خطأ HTTP من بوابة Kashier نفسها (رفضت الطلب) - يختلف عن فشل الاتصال
export class GatewayRejected extends Error {
  constructor(details) {
    super(details);
    this.details = details;
  }
}

export async function createPayment(env, { orderId, amount, email, origin }) {
  // انتهاء الجلسة بعد ساعة، بصيغة ISO 8601 مع .000Z
  const expireAt = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, ".000Z");

  const payload = {
    expireAt,
    maxFailureAttempts: 3,
    amount: Number(amount).toFixed(2),
    currency: "EGP",
    order: String(orderId),
    merchantId: env.KASHIER_MERCHANT_ID,
    merchantRedirect: `${origin}/success?tx=${orderId}`,
    // Kashier يرسل إشعار الدفع (موقّعًا) من خادمه إلى هنا، حتى لو أغلق المستخدم المتصفح
    serverWebhook: `${origin}/kashier-webhook`,
    display: "ar",
    type: "one-time",
    allowedMethods: "card,wallet",
    customer: { email, reference: String(orderId) },
  };

  const res = await fetch(`${env.KASHIER_URL}/v3/payment/sessions`, {
    method: "POST",
    headers: {
      Authorization: env.KASHIER_SECRET_KEY,
      "api-key": env.KASHIER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new GatewayRejected(text);
  return JSON.parse(text);
}

// ---------- التحقق من توقيع الـ webhook ----------

// HMAC-SHA256 بـ Web Crypto
export async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ترميز القيمة فقط (وليس السلسلة كلها) كما يطلب التوثيق
function encodeValue(v) {
  return encodeURIComponent(String(v)).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// التوقيع = HMAC-SHA256 بمفتاح Payment API Key (قيمة api-key) على:
// المفاتيح الموجودة في data.signatureKeys مرتبة أبجديًا، key=value مفصولة بـ &
export async function verifyWebhookSignature(env, data, headerSignature) {
  if (!headerSignature || !Array.isArray(data?.signatureKeys)) return false;

  const payload = [...data.signatureKeys]
    .sort()
    .filter((k) => data[k] !== undefined)
    .map((k) => (data[k] === null ? k : `${k}=${encodeValue(data[k])}`))
    .join("&");

  const expected = await hmacSha256Hex(env.KASHIER_API_KEY, payload);
  return timingSafeEqual(expected, String(headerSignature).toLowerCase());
}
