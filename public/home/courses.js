// يعتمد على supabaseClient المُعرَّف في interface.js، حمّله بعده في index.html

async function fetchCourses() {
    // التحقق من الجلسة الحالية
    const { data: { session } } = await supabaseClient.auth.getSession();

    // 1) بيانات الكورسات العامة فقط (نفس النتيجة لكل الزوار) — من العميل
    //    القابل للكاش (supabasePublic)، يمر عبر /rest/v1/courses على موقعنا.
    const { data: courses, error: coursesError } = await supabasePublic
        .from('courses')
        .select('id, name, price');

    if (coursesError) {
        console.error('تعذر جلب الكورسات:', coursesError.message);
        return [];
    }

    // 2) مشتريات المستخدم الحالي فقط — بيانات شخصية، لازم تُستعلم دائماً
    //    من العميل الأساسي (supabaseClient) بدون أي كاش، حتى لا يتسرب
    //    وضع "مملوك/غير مملوك" الخاص بمستخدم إلى مستخدم آخر.
    let ownedIds = new Set();
    if (session) {
        const { data: purchases, error: purchasesError } = await supabaseClient
            .from('purchases')
            .select('course_id');

        if (purchasesError) {
            console.error('تعذر جلب المشتريات:', purchasesError.message);
        } else {
            ownedIds = new Set(purchases.map((p) => p.course_id));
        }
    }

    // دمج الجزء العام (المخزّن مؤقتاً) مع الجزء الشخصي (الحي دائماً) محلياً
    return courses.map((course) => ({
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