document.addEventListener("DOMContentLoaded", () => {
    const payButton = document.getElementById('payButton');
    const errorMsg = document.getElementById('errorMsg');
    
    // التحقق من حالة الشراء السابقة المحفوظة في المتصفح
    const isPurchased = localStorage.getItem("course_purchased");

    if (isPurchased === "success") {
        payButton.textContent = "أنت تمتلك الكورس بالفعل";
        payButton.classList.replace("bg-blue-600", "bg-green-600");
        payButton.classList.replace("hover:bg-blue-700", "hover:bg-green-700");
        payButton.classList.replace("cursor-pointer", "cursor-not-allowed");
        payButton.disabled = true;
    }

    payButton.addEventListener('click', async () => {
        // منع تنفيذ الدفع إذا كان الكورس مملوكاً
        if (payButton.disabled) return;

        const endpoint = "/create-payment"; // دالة Cloudflare Pages Function

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();

            if (data.redirect_url) {
                // تسجيل حالة معلقة في التخزين الدائم قبل التوجيه
                localStorage.setItem("course_purchased", "pending");
                window.location.href = data.redirect_url;
            } else if (data.payment_result && data.payment_result.response_status === "A") {
                localStorage.setItem("course_purchased", "success");
                window.location.href = "/success";
            } else {
                errorMsg.textContent = data.payment_result?.response_message || "رفضت البوابة إنشاء معاملة الدفع.";
                errorMsg.classList.remove('hidden');
            }
        } catch (error) {
            errorMsg.textContent = "فشل الاتصال بالخادم.";
            errorMsg.classList.remove('hidden');
        }
    });
});