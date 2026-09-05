# RL68 — السبب الفعلي لقسم الموظف الإداري

بعد فشل RL65 وRL66 وRL67 تم تتبع جميع الملفات المحملة فعلياً داخل admin_employee_management.html.

السبب الفعلي الأول:
`unified_workspace.js` يحتوي تعييناً صريحاً:
`'admin_employee_management.html':'administrative_employee_portal.html'`
وهذا الملف يُحمّل داخل صفحة إدارة الموظفين نفسها.
لذلك ظل يعامل صفحة إشراف المدير/الوكيل كأنها بوابة الموظف الإداري حتى بعد تصحيح
school_navigation_guard.js وplatform-page-navigation.js.

السبب الفعلي الثاني:
`admin_employee_management.html` كان ينفذ `render()` قبل تحميل `platform-cloud-session.js`.
أي أن أول قراءة للمدرسة/الدور كانت تحدث قبل جاهزية مصدر الجلسة السحابي.

التصحيح:
- unified_workspace.js أصبح يحدد جذر admin_employee_management ديناميكياً:
  supervisor=manager -> manager.html
  supervisor=agent -> agent.html
- لم تعد الصفحة تُربط بـ administrative_employee_portal.html.
- تأجيل render إلى حدث load بعد تحميل platform-cloud-session وبقية ملفات السياق.
- قبل render يتم التحقق من schoolId ومن تطابق الدور الفعلي مع supervisor.
- إذا فشل السياق لا يحدث تحويل إلى بوابة ترحيب؛ تظهر رسالة داخل القسم.
- إبقاء تصحيحات RL67 في school_navigation_guard وplatform-page-navigation.

لا تعديل على Supabase أو بيانات الموظفين أو روابط التسجيل.
