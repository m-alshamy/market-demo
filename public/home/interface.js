const SUPABASE_URL = 'https://whiiadjocmkppzfpbkeh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWlhZGpvY21rcHB6ZnBia2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTk1NzQsImV4cCI6MjEwNDk3NTU3NH0.1IipeBlRqwehixssS-xCDTP0JB8Fj5ajBuKE8AVKlqA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// في interface.js، جنب تعريف supabaseClient الموجود بالفعل
const supabasePublic = supabase.createClient(
  window.location.origin,
  SUPABASE_ANON_KEY   // نفس المفتاح اللي بتستخدمه في supabaseClient
);

const userEmailSpan = document.getElementById('user-email');
const userExtraDataSpan = document.getElementById('user-extra-data');
const USER_DATA_CACHE_KEY = 'user_data_cache';

let initialized = false;
// دمج منطق التحقق وإزالة الإخفاء في المراقب الفوري كما فعلت في login
supabaseClient.auth.onAuthStateChange(async (event, session) => {

    // في حال عدم وجود جلسة نشطة
    if (!session) {
        clearCachedUserData();
        window.location.href = (event === 'SIGNED_OUT') ? '/' : '../login';
        return;
    }

    // إزالة الإخفاء فوراً بمجرد تأكيد الجلسة المحلية
    document.body.removeAttribute('hidden');

    // تعبئة البيانات الأساسية و الاضافية
    if (!initialized || event === 'USER_UPDATED') {
        initialized = true;
        userEmailSpan.textContent = session.user.email;
        await loadUserData(session.user.id, event === 'USER_UPDATED');
    }
});

function clearCachedUserData() {
    localStorage.removeItem(USER_DATA_CACHE_KEY);
}

function renderUserData(data) {
    userExtraDataSpan.innerHTML = `
        الاسم: ${data.username} <br>
        الهاتف: <span dir="ltr">${data.phone}</span> <br>
        النوع: ${data.gender} <br>
        العمر: ${data.age}
    `;
}

async function loadUserData(userId, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = localStorage.getItem(USER_DATA_CACHE_KEY);
        if (cached) {
            try {
                renderUserData(JSON.parse(cached));
                return;
            } catch (e) {
                clearCachedUserData();
            }
        }
    }

    await fetchUserData(userId);
}

async function fetchUserData(userId) {
    const { data, error } = await supabaseClient
        .from('user_data')
        .select('username, phone, gender, age')
        .eq('id', userId)
        .single();

    if (data) {
        localStorage.setItem(USER_DATA_CACHE_KEY, JSON.stringify(data));
        renderUserData(data);
    }
    else if (error) {
        userExtraDataSpan.textContent = 'تعذر جلب البيانات المرتبطة';
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
}