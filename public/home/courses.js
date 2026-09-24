// يعتمد على supabaseClient المُعرَّف في interface.js، حمّله بعده في index.html

async function fetchCourses() {
    // التحقق من الجلسة الحالية
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    // جلب الكورسات مع دمج جدول المشتريات في استعلام واحد
    // سياسات RLS ستضمن إرجاع المشتريات الخاصة بالمستخدم الحالي فقط
    const { data, error } = await supabaseClient
        .from('courses')
        .select(`
            id,
            name,
            price,
            purchases ( course_id )
        `);

    if (error) {
        console.error('تعذر جلب البيانات:', error.message);
        return [];
    }

    // تحويل البيانات المستلمة إلى الشكل المطلوب محلياً
    return data.map(course => ({
        id: course.id,
        name: course.name,
        price: course.price,
        // الكورس يعتبر مملوكاً إذا كانت مصفوفة المشتريات تحتوي على عناصر
        owned: course.purchases && course.purchases.length > 0
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