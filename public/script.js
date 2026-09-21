const SUPABASE_URL = 'https://whiiadjocmkppzfpbkeh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWlhZGpvY21rcHB6ZnBia2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTk1NzQsImV4cCI6MjEwNDk3NTU3NH0.1IipeBlRqwehixssS-xCDTP0JB8Fj5ajBuKE8AVKlqA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const errorMessage = document.getElementById('error-message');

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        window.location.href = './home';
    } else {
        document.body.removeAttribute('hidden');
    }
});