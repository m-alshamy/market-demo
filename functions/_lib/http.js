// أدوات HTTP مشتركة بين الدوال.
// ملاحظة: الملفات داخل functions/ التي لا تصدّر onRequest* لا تتحول إلى مسارات (routes).

export function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// يرجع أسماء المتغيرات الناقصة (بدون أي قيم) لتسهيل اكتشاف خطأ الإعداد بعد النشر.
export function missingEnv(env, names) {
  return names.filter((n) => !env[n]);
}

// عنوان الموقع الحالي (يستبدل HOST_URL الثابت في server.py).
// يمكن تثبيته بمتغير SITE_URL، وإلا يؤخذ من الطلب نفسه.
export function siteOrigin(env, request) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
}
