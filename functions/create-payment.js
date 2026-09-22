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
async function markFailed(env, tranId) {
  try {
    await serviceRequest(env, "PATCH", `/rest/v1/transactions?id=eq.${tranId}`, {
      status: "failed",
    });
  } catch (patchErr) {
    console.error(`فشل تحديث حالة العملية ${tranId} إلى failed:`, patchErr);
  }
}

export async function onRequestPost({ request, env }) {
  const missing = missingEnv(env, REQUIRED_ENV);
  if (missing.length) {
    console.error(`إعدادات الخادم ناقصة: ${missing.join(", ")}`);
    return json(500, { error: "خطأ في إعدادات الخادم، حاول لاحقاً" });
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
    console.error("فشل إنشاء العملية:", e);
    return json(500, { error: "تعذر إنشاء العملية، حاول لاحقاً" });
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
    await markFailed(env, tranId);
    if (e instanceof GatewayRejected) {
      console.error("رفضت البوابة البيانات:", e.details);
      return json(400, { error: "رفضت البوابة البيانات المُرسلة، تحقق من المدخلات وحاول مجدداً" });
    }
    console.error("تعذر الاتصال بالبوابة:", e);
    return json(502, { error: "تعذر الاتصال بالبوابة حالياً، حاول لاحقاً" });
  }

  if (!session.sessionUrl) {
    await markFailed(env, tranId);
    return json(502, { error: "رفضت البوابة إنشاء العملية ولم ترجع رابط دفع" });
  }
  return json(200, { redirect_url: session.sessionUrl });
}
