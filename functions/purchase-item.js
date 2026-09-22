// POST /purchase-item  — شراء عنصر داخلي من رصيد المحفظة
import { json, missingEnv } from "./_lib/http.js";
import { getUser, serviceRequest } from "./_lib/supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

const ERROR_MESSAGES = {
    wallet_not_found: "لم يتم العثور على محفظة",
    course_not_found: "الكورس غير موجود",
    already_owned: "أنت تمتلك هذا الكورس بالفعل",
    insufficient_balance: "الرصيد غير كافٍ",
};

export async function onRequestPost({ request, env }) {
    const missing = missingEnv(env, REQUIRED_ENV);
    if (missing.length) {
        console.error(`إعدادات الخادم ناقصة: ${missing.join(", ")}`);
        return json(500, { error: "خطأ في إعدادات الخادم، حاول لاحقاً" });
    }

    const body = (await request.json().catch(() => ({}))) || {};
    const accessToken = body.access_token;
    const courseId = Number(body.course_id);


    if (!accessToken) return json(401, { error: "يجب تسجيل الدخول" });
    if (!Number.isInteger(courseId) || courseId <= 0) return json(400, { error: "كورس غير صالح" });

    const user = await getUser(env, accessToken);
    if (!user || !user.id) return json(401, { error: "الجلسة غير صالحة" });

    try {
        await serviceRequest(env, "POST", "/rest/v1/rpc/purchase_course", {
            p_user_id: user.id,
            p_course_id: courseId,
        });
        return json(200, { success: true });
    } catch (e) {
        const reason = extractReason(e);
        if (reason && ERROR_MESSAGES[reason]) {
            return json(400, { error: ERROR_MESSAGES[reason] });
        }
        console.error("purchase-item: فشل الشراء:", e.message);
        return json(500, { error: "تعذر إتمام الشراء، حاول لاحقاً" });
    }
}

// يستخرج اسم الاستثناء (raise exception) من رسالة خطأ PostgREST
function extractReason(err) {
    try {
        const idx = err.message.indexOf(": ");
        const parsed = JSON.parse(err.message.slice(idx + 2));
        return parsed.message || null;
    } catch {
        return null;
    }
}