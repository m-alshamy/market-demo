// يعتمد هذا الملف على supabaseClient المُعرَّف مسبقًا في interface.js
// لذا يجب تحميله بعد interface.js في index.html

async function fetchWalletBalance() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data, error } = await supabaseClient
        .from('wallet')
        .select('balance')
        .eq('user_id', session.user.id)
        .single();

    document.getElementById('walletBalance').textContent = data ? data.balance : 0;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchWalletBalance();

    const rechargeButton = document.getElementById('rechargeButton');
    const rechargeAmountInput = document.getElementById('rechargeAmount');
    const rechargeError = document.getElementById('rechargeError');

    rechargeButton.addEventListener('click', async () => {
        rechargeError.classList.add('hidden');

        const amount = Number(rechargeAmountInput.value);
        if (!amount || amount <= 0) {
            rechargeError.textContent = 'أدخل مبلغًا صحيحًا';
            rechargeError.classList.remove('hidden');
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = '/';
            return;
        }

        rechargeButton.disabled = true;
        rechargeButton.textContent = 'جاري التحويل للبوابة...';

        try {
            const response = await fetch('/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: session.access_token,
                    amount: amount
                })
            });
            const data = await response.json();

            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            } else {
                rechargeError.textContent = data.error || 'تعذر بدء عملية الشحن';
                rechargeError.classList.remove('hidden');
                rechargeButton.disabled = false;
                rechargeButton.textContent = 'شحن';
            }
        } catch (e) {
            rechargeError.textContent = 'فشل الاتصال بالخادم';
            rechargeError.classList.remove('hidden');
            rechargeButton.disabled = false;
            rechargeButton.textContent = 'شحن';
        }
    });
});