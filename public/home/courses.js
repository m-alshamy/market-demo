// يعتمد على supabaseClient المُعرَّف في interface.js، حمّله بعده في index.html

async function fetchOwnedCourses() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return [];

    // استعلام واحد يجلب الكورسات المملوكة مع سعرها، عبر العلاقة course_id → courses(id)
    const { data, error } = await supabaseClient
        .from('purchases')
        .select('course_id, courses(id, price)')
        .eq('user_id', session.user.id);

    if (error) {
        console.error('تعذر جلب الكورسات المملوكة:', error.message);
        return [];
    }

    return data;
}

function renderOwnedCourses(courses) {
    const container = document.getElementById('ownedCoursesList');
    if (!container) return;

    if (!courses.length) {
        container.innerHTML = '<p>لا تملك أي كورسات بعد</p>';
        return;
    }

    container.innerHTML = courses.map(row => `
        <div class="owned-course">
            <span>الكورس: ${row.course_id}</span>
            <span>السعر: ${row.courses?.price ?? '—'}</span>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const courses = await fetchOwnedCourses();
    renderOwnedCourses(courses);
});