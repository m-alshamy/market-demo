// GET /check-transaction?tx=...&access_token=...
// للقراءة فقط: يرجع حالة العملية من قاعدة البيانات.
// اعتماد الرصيد يتم حصرًا في /kashier-webhook (إشعار موقّع من Kashier).
import { json, missingEnv } from "./_lib/http.js";
import { getUser, serviceRequest, getBalance } from "./_lib/supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

export async function onRequestGet({ request, env }) {
  const missing = missingEnv(env, REQUIRED_ENV);
  if (missing.length) {
    return json(500, { error: `إعدادات الخادم ناقصة: ${missing.join(", ")}` });
  }

  const params = new URL(request.url).searchParams;
  const accessToken = params.get("access_token");
  const txId = params.get("tx");
  if (!accessToken || !txId) return json(400, { error: "بيانات ناقصة" });

  const user = await getUser(env, accessToken);
  if (!user || !user.id) return json(401, { error: "الجلسة غير صالحة" });

  // العملية يجب أن تخص هذا المستخدم فقط (encodeURIComponent يمنع حقن فلاتر في الاستعلام)
  let tran;
  try {
    const rows = await serviceRequest(
      env,
      "GET",
      `/rest/v1/transactions?id=eq.${encodeURIComponent(txId)}` +
        `&user_id=eq.${encodeURIComponent(user.id)}&select=status`
    );
    if (!rows || !rows.length) return json(404, { error: "العملية غير موجودة" });
    tran = rows[0];
  } catch (e) {
    // معرف عملية بصيغة غير صالحة يرفضه PostgREST بـ 400
    if (e.status === 400) return json(404, { error: "العملية غير موجودة" });
    return json(500, { error: e.message });
  }

  if (tran.status === "completed") {
    return json(200, { status: "completed", balance: await getBalance(env, user.id) });
  }
  return json(200, { status: "pending" });
}
