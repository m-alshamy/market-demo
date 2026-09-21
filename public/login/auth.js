const SUPABASE_URL = 'https://whiiadjocmkppzfpbkeh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWlhZGpvY21rcHB6ZnBia2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTk1NzQsImV4cCI6MjEwNDk3NTU3NH0.1IipeBlRqwehixssS-xCDTP0JB8Fj5ajBuKE8AVKlqA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const errorMessage = document.getElementById('error-message');

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        window.location.href = '../home';
    } else {
        document.body.removeAttribute('hidden');
    }
});

function showTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.classList.add('text-green-600', 'border-b-2', 'border-green-600');
        tabLogin.classList.remove('text-gray-400');
        tabRegister.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
        tabRegister.classList.add('text-gray-400');
    } else {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        tabRegister.classList.add('text-green-600', 'border-b-2', 'border-green-600');
        tabRegister.classList.remove('text-gray-400');
        tabLogin.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
        tabLogin.classList.add('text-gray-400');
    }
    errorMessage.classList.add('hidden');
}

async function register() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const username = document.getElementById('username').value;
    const phone = document.getElementById('phone').value;
    const gender = document.getElementById('gender').value;
    const age = document.getElementById('age').value;
    
    if(!email || !password || !username || !gender || !age) {
        showError('يجب تعبئة كافة الحقول المطلوبة');
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username,
                phone: phone,
                gender: gender,
                age: age
            }
        }
    });
    
    if (error) {
        showError(error.message);
    } else if (data.user) {
        showError('تم إنشاء الحساب بنجاح. يتم الآن تسجيل الدخول...', true);
    }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    if (error) showError(error.message);
}

function showError(msg, isSuccess = false) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden', 'text-red-500', 'text-green-500');
    errorMessage.classList.add(isSuccess ? 'text-green-500' : 'text-red-500');
}