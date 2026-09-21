const SUPABASE_URL = 'https://whiiadjocmkppzfpbkeh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWlhZGpvY21rcHB6ZnBia2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTk1NzQsImV4cCI6MjEwNDk3NTU3NH0.1IipeBlRqwehixssS-xCDTP0JB8Fj5ajBuKE8AVKlqA';

// الاعتماد يتم على الخادم عبر إشعار موقّع من بوابة الدفع (webhook)، وقد يصل بعد ثوانٍ.
// لذلك نعيد الفحص تلقائيًا بدل الحكم من أول طلب. المتصفح هنا للعرض فقط.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 15; // ~45 ثانية

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.addEventListener("DOMContentLoaded", async () => {
    const statusTitle = document.getElementById('statusTitle');
    const statusDesc = document.getElementById('statusDesc');

    const show = (title, color, desc) => {
        statusTitle.textContent = title;
        statusTitle.classList.remove("text-red-400", "text-green-400", "text-yellow-400");
        statusTitle.classList.add(color);
        statusDesc.textContent = desc || "";
    };

    const params = new URLSearchParams(window.location.search);
    const txId = params.get('tx');

    if (!txId) {
        show("عملية غير صالحة", "text-red-400", "لم يتم العثور على معرف عملية في الرابط.");
        return;
    }

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        show("يجب تسجيل الدخول", "text-red-400", "الرجاء تسجيل الدخول للتحقق من حالة العملية.");
        return;
    }

    const url = `/check-transaction?tx=${encodeURIComponent(txId)}&access_token=${encodeURIComponent(session.access_token)}`;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let data;
        try {
            const response = await fetch(url);
            data = await response.json();
        } catch (e) {
            show("تعذر التحقق", "text-red-400", "فشل الاتصال بالخادم.");
            return;
        }

        if (data.status === "completed") {
            show("تمت عملية الشحن بنجاح!", "text-green-400", `رصيدك الحالي: ${data.balance} ج.م`);
            return;
        }
        if (data.status !== "pending") {
            show("تعذر التحقق", "text-red-400", data.error || "حدث خطأ غير متوقع.");
            return;
        }

        show("جاري تأكيد الدفع...", "text-yellow-400", "قد يستغرق ذلك بضع ثوانٍ.");
        await sleep(POLL_INTERVAL_MS);
    }

    show(
        "لم يصل تأكيد الدفع بعد",
        "text-yellow-400",
        "إن كان المبلغ قد خُصم من حسابك فسيُضاف إلى رصيدك تلقائيًا خلال دقائق، حتى لو أغلقت هذه الصفحة."
    );
});
