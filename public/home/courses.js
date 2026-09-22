// يعتمد على supabaseClient المُعرَّف في interface.js، حمّله بعده في index.html

async function fetchCourses() {
    // 1) كل الكورسات المتاحة: المعرف والسعر، من جدول courses مباشرة
    const { data: allCourses, error: coursesError } = await supabaseClient
        .from('courses')
        .select('id, name, price');

    if (coursesError) {
        console.error('تعذر جلب الكورسات:', coursesError.message);
        return [];
    }

    // 2) معرفات الكورسات المملوكة لهذا المستخدم فقط، من جدول purchases
    const { data: { session } } = await supabaseClient.auth.getSession();
    let ownedIds = new Set();

    if (session) {
        const { data: owned, error: ownedError } = await supabaseClient
            .from('purchases')
            .select('course_id')
            .eq('user_id', session.user.id);

        if (ownedError) {
            console.error('تعذر جلب المشتريات:', ownedError.message);
        } else {
            ownedIds = new Set(owned.map(row => row.course_id));
        }
    }

    // 3) دمج القائمتين محلياً: كل كورس مع حالة امتلاكه
    return allCourses.map(course => ({
        id: course.id,
        name: course.name,
        price: course.price,
        owned: ownedIds.has(course.id),
    }));
}

function renderCourses(courses) {
    const container = document.getElementById('coursesList');
    if (!container) return;

    if (!courses.length) {
        container.innerHTML = '<p>لا توجد كورسات متاحة حالياً</p>';
        return;
    }

    container.innerHTML = courses.map(course => `
    <div class="course-card">
        <span>الكورس: ${course.name}</span>
        <span>السعر: ${course.price}</span>
        <span>${course.owned ? '✅ مملوك' : '🔒 غير مشترى'}</span>
        ${course.owned
            ? ''
            : `<button onclick="purchaseCourse(${course.id}, this)">شراء</button>`}
    </div>
`).join('');
}

async function refreshCourses() {
    renderCourses(await fetchCourses());
}

document.addEventListener('DOMContentLoaded', refreshCourses);