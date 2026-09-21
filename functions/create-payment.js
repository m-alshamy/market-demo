// POST /create-payment  (يعادل _handle_create_payment في server.py)
import { json, missingEnv, siteOrigin } from "./_lib/http.js";
import { getUser, serviceRequest } from "./_lib/supabase.js";
import { createPayment, GatewayRejected } from "./_lib/kashier.js";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KASHIER_URL",
  "KASHIER_MERCHANT_ID",
  "KASHIER_API_KEY",
  "KASHIER_SECRET_KEY",
];

export async function onRequestPost({ request, env }) {
  const missing = missingEnv(env, REQUIRED_ENV);
  if (missing.length) {
    return json(500, { error: `إعدادات الخادم ناقصة: ${missing.join(", ")}` });
  }

  const body = (await request.json().catch(() => ({}))) || {};
  const accessToken = body.access_token;

  if (!accessToken) return json(401, { error: "يجب تسجيل الدخول" });

  const user = await getUser(env, accessToken);
  if (!user || !user.id) return json(401, { error: "الجلسة غير صالحة" });

  // التحقق من المبلغ
  const raw = body.amount;
  const amount =
    typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
      ? Number(raw)
      : NaN;
  if (!Number.isFinite(amount)) return json(400, { error: "مبلغ غير صالح" });
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return json(400, { error: "المبلغ خارج الحد المسموح" });
  }

  // إنشاء العملية بحالة pending
  let tranId;
  try {
    const rows = await serviceRequest(env, "POST", "/rest/v1/transactions", {
      user_id: user.id,
      amount,
      status: "pending",
    });
    tranId = rows[0].id;
  } catch (e) {
    return json(500, { error: `تعذر إنشاء العملية: ${e.message}` });
  }

  // إنشاء جلسة الدفع في Kashier
  let session;
  try {
    session = await createPayment(env, {
      orderId: tranId,
      amount,
      email: user.email || "",
      origin: siteOrigin(env, request),
    });
  } catch (e) {
    if (e instanceof GatewayRejected) {
      return json(400, { error: `رفضت البوابة البيانات: ${e.details}` });
    }
    return json(502, { error: `تعذر الاتصال بالبوابة: ${e.message}` });
  }

  if (!session.sessionUrl) {
    return json(502, { error: "رفضت البوابة إنشاء العملية ولم ترجع رابط دفع" });
  }
  return json(200, { redirect_url: session.sessionUrl });
}
