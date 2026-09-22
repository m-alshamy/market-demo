// يعتمد على supabaseClient المُعرَّف في interface.js، حمّله بعده في index.html

async function purchaseCourse(courseId, buttonEl) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '/';
        return;
    }

    const originalText = buttonEl ? buttonEl.textContent : null;
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.textContent = 'جاري الشراء...';
    }

    try {
        const response = await fetch('/purchase-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: session.access_token,
                course_id: courseId
            })
        });
        const data = await response.json();

        if (data.success) {
            alert('تم الشراء بنجاح');
            if (typeof fetchWalletBalance === 'function') fetchWalletBalance();
        } else {
            alert(data.error || 'تعذر إتمام الشراء');
        }
    } catch (e) {
        alert('فشل الاتصال بالخادم');
    } finally {
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.textContent = originalText;
        }
    }
}