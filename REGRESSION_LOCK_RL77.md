# RL77 — إعادة بناء موضعية لمنظومة الموظف الإداري على خط RL33 الوظيفي

القرار:
- لم يتم إرجاع المنصة إلى نسخة قديمة.
- لم يتم تعديل manager.html أو agent.html.
- لم يتم تعديل admin_employee_management.html لأنه يعمل الآن ويعرض إداريي المدرسة.
- لم يتم تعديل administrative_employee_login.html في هذه المرحلة لأنه خارج الخطأ الحالي.
- لم يتم تعديل Supabase أو بيانات المدارس.

المرجع الوظيفي:
تم اعتماد ملفات RL33 الأصلية كأساس للصفحات التي ما زالت في المسار المعطل:
1. administrative_employee_portal.html
2. administrative_employee_evaluation.html
3. administrative_employee_plan.html
4. administrative_employee_execution.html
5. administrative_employee_improvement.html
6. administrative_employee_library.html

ما تم نقله من التصحيحات الحديثة فقط:
- تصحيح جلسة supervisor للمدير/الوكيل، دون تحويلهما إلى administrative_employee.
- الحفاظ على schoolId نفسه عبر كامل المسار.
- دعم الموظفين الإداريين المرتبطين بالمدرسة، لا المسجلين من الرابط الجديد فقط.
- تحميل platform-cloud-session قبل بدء جلب بيانات البوابة.
- تمرير mode=supervisor وviewerRole وreturnRole لكل انتقال داخلي.
- توسيع الاستثناء الموضعي في platform-cloud-session ليشمل plan/library أيضًا.
- بقية قواعد عزل المنصة لم تُمس.

نطاق الاختبار المطلوب:
المدير/الوكيل → إدارة الموظفين → البوابة → خطة الأداء → التنفيذ → التقييم → التحسين → المكتبة → العودة.

مبدأ Regression Lock:
أي ملف خارج هذه المنظومة لم يدخل الحزمة.
