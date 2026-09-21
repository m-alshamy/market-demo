# MarketDemo على Cloudflare Pages

```
public/         الموقع الثابت (هذا فقط ما يُنشر علنًا)
functions/      دوال Pages: /create-payment و /check-transaction
wrangler.toml   إعدادات غير سرية (لا أسرار هنا أبدًا)
```

## التشغيل محليًا
```bash
cp .dev.vars.example .dev.vars      # ثم املأ الأسرار الثلاثة
npx wrangler pages dev public       # http://localhost:8788
```

## النشر عبر GitHub (المسار الموصى به)
لا تشغّل `wrangler pages project create`: هذا الأمر ينشئ مشروع Direct Upload ولا يمكن تحويله إلى Git لاحقًا.

1. ارفع المجلد إلى مستودع GitHub (يفضّل Private).
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. سمِّ المشروع `marketdemo` (يطابق `name` في wrangler.toml) وأدخل:
   - Framework preset: None
   - Build command: (فارغ)
   - Build output directory: `public`
   - Root directory: (فارغ)
4. Settings → Variables and Secrets → أضف بنوع Secret:
   `SUPABASE_SERVICE_ROLE_KEY` و `KASHIER_API_KEY` و `KASHIER_SECRET_KEY`
   (لبيئة Production، وPreview أيضًا إن أردت اختبار الفروع)
5. أعد النشر (Retry deployment) لأن الأسرار تُطبَّق على النشرات الجديدة فقط.

## كيف يُعتمد الرصيد
1. المستخدم يدفع في صفحة Kashier.
2. Kashier يرسل من خادمه إشعارًا موقّعًا إلى `/kashier-webhook` (يُمرَّر تلقائيًا في كل جلسة عبر `serverWebhook`، ولا يلزم ضبط شيء في لوحة Kashier).
3. الدالة تتحقق من التوقيع (بمفتاح `KASHIER_API_KEY`) وتطابق المبلغ مع قاعدة البيانات ثم تستدعي `credit_wallet`.
4. صفحة `/success` للعرض فقط: تسأل `/check-transaction` (قراءة من قاعدة البيانات) كل 3 ثوانٍ.

يعمل الاعتماد حتى لو أغلق المستخدم المتصفح بعد الدفع. وإن فشل الاستلام عندك يعيد Kashier المحاولة حتى 10 مرات.
لا يعمل الـ webhook محليًا (localhost غير قابل للوصول من الإنترنت)؛ اختبره على النسخة المنشورة.

## بعد أول نشر
1. Supabase → Authentication → URL Configuration: أضف رابط الموقع (Site URL + Redirect URLs).
2. Kashier: تأكد أن النطاق مسموح به كـ redirect إن كانت لوحتهم تشترط ذلك.
3. للإنتاج: غيّر KASHIER_URL في wrangler.toml وبدّل مفاتيح Kashier.

## بديل: النشر من الطرفية (Direct Upload)
لا يمكنك لاحقًا التحويل منه إلى Git.
```bash
npx wrangler pages project create marketdemo --production-branch main
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name marketdemo
npx wrangler pages secret put KASHIER_API_KEY           --project-name marketdemo
npx wrangler pages secret put KASHIER_SECRET_KEY        --project-name marketdemo
npx wrangler pages deploy public --project-name marketdemo
```
