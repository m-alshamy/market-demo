// POST /kashier-webhook  ← Kashier يستدعيه من خادمه بعد كل عملية دفع (serverWebhook)
// هذا هو المكان الوحيد الذي يُعتمد فيه الرصيد، ولا يعتمد على المتصفح إطلاقًا.
//
// أكواد الرد (Kashier يقرأ الكود فقط ويتجاهل الجسم):
//   200 = استُلم/تجاهلناه عمدًا (لا إعادة محاولة)
//   401 = توقيع غير صالح
//   500 = خطأ عندنا (Kashier يعيد المحاولة حتى 10 مرات بفواصل متزايدة)
import { missingEnv } from "./_lib/http.js";
import { serviceRequest } from "./_lib/supabase.js";
import { verifyWebhookSignature } from "./_lib/kashier.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "KASHIER_API_KEY"];
const reply = (status) => new Response(null, { status });

export async function onRequestPost({ request, env }) {
  const missing = missingEnv(env, REQUIRED_ENV);
  if (missing.length) {
    console.error("kashier-webhook: missing env:", missing.join(", "));
    return reply(500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return reply(400);
  }
  const data = body?.data;
  if (!data) return reply(400);

  // 1) التوقيع: يثبت أن الإشعار من Kashier ولم يُعدَّل
  const signature = request.headers.get("x-kashier-signature");
  if (!(await verifyWebhookSignature(env, data, signature))) {
    console.warn("kashier-webhook: invalid signature");
    return reply(401);
  }

  // 2) نعتمد فقط عملية "pay" الناجحة. (refund الناجحة لها status=SUCCESS أيضًا، ويجب ألا تضيف رصيدًا)
  if (body.event !== "pay" || data.status !== "SUCCESS") return reply(200);

  const orderId = String(data.merchantOrderId ?? "");
  if (!orderId) return reply(200);

  try {
    const rows = await serviceRequest(
      env,
      "GET",
      `/rest/v1/transactions?id=eq.${encodeURIComponent(orderId)}&select=*`
    );
    if (!rows || !rows.length) {
      console.warn("kashier-webhook: unknown order", orderId);
      return reply(200);
    }
    const tran = rows[0];

    // 3) مكررة؟ (Kashier قد يرسل نفس الإشعار أكثر من مرة)
    if (tran.status === "completed") return reply(200);

    // 4) نقارن مع ما سجلناه نحن، ولا نثق بمبلغ الإشعار في الاعتماد
    const sameAmount = Math.abs(Number(data.amount) - Number(tran.amount)) < 0.001;
    if (data.currency !== "EGP" || !sameAmount) {
      console.error("kashier-webhook: amount/currency mismatch", orderId, data.amount, data.currency, tran.amount);
      return reply(200);
    }

    // 5) حفظ رقم عملية Kashier (TX-...) في tran_ref للمطابقة والتدقيق.
    //    لا يمنع الاعتماد إن فشل، ولا يكتب فوق قيمة موجودة، ويُتجاهل إن لم يوجد العمود.
    if ("tran_ref" in tran && !tran.tran_ref && data.transactionId) {
      try {
        await serviceRequest(
          env,
          "PATCH",
          `/rest/v1/transactions?id=eq.${encodeURIComponent(tran.id)}`,
          { tran_ref: String(data.transactionId) }
        );
      } catch (e) {
        console.warn("kashier-webhook: could not store tran_ref", orderId, e.message);
      }
    }

    // 6) اعتماد الرصيد (بالمبلغ المخزّن في قاعدة البيانات)
    await serviceRequest(env, "POST", "/rest/v1/rpc/credit_wallet", {
      p_user_id: tran.user_id,
      p_transaction_id: tran.id,
      p_amount: tran.amount,
    });
    return reply(200);
  } catch (e) {
    console.error("kashier-webhook: failed for order", orderId, e.message);
    // معرف بصيغة لا تخصنا (400 من PostgREST) لا فائدة من إعادة المحاولة عليه
    return reply(e.status === 400 ? 200 : 500);
  }
}
