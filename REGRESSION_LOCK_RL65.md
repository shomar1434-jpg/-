# RL65 — تصحيح دخول قسم الموظف الإداري من واجهة المدير

السبب:
بطاقة «الموظف الإداري» في manager.html كانت تفتح:
admin_employee_management.html?supervisor=manager
من دون تمرير schoolId الصريح ولا سياق أن الفاتح هو مدير المدرسة.
مع منطق المدارس المستقلة يمكن أن تفقد الصفحة سياق المدرسة وتعيد المستخدم إلى بوابة/ترحيب المدير.

التصحيح:
- استبدال الرابط المباشر بدالة openAdministrativeEmployeeManagerSection().
- استخراج schoolId من سياق المدير الحالي نفسه.
- تمرير schoolId + school + schoolMode=independent صراحة.
- تمرير viewerRole=manager و supervisor=manager و mode=supervisor.
- عدم تبديل دور التبويب إلى administrative_employee.
- حفظ سياق عودة محدود في sessionStorage فقط.
- إذا لم توجد مدرسة حالية لا يحدث Redirect عشوائي؛ تظهر رسالة واضحة.

Regression Lock:
- تعديل manager.html فقط.
- مبني على RL64.
- يحافظ على RL61/RL62/RL63/RL64.
- لا تعديل على admin_employee_management.html أو بوابة الموظف أو Supabase.
- لا تعديل على teacher.html أو impact_assessment.html.
