# RL67
الإصلاح الجذري لمسار قسم الموظف الإداري للمدير والوكيل.

سبب استمرار الخطأ بعد RL65/RL66: الصفحة الهدف نفسها كانت تُصنف من ملفات التنقل العامة كبوابة موظف إداري بسبب اسم admin_employee_management.html، بدل اعتبارها صفحة إشراف مدير/وكيل.

تم:
- تعريف الصفحة كصفحة supervisor.
- supervisor=manager => manager.html.
- supervisor=agent => agent.html.
- استبدال history.back برجوع صريح للمسؤول.
- تصحيح school_navigation_guard.js وplatform-page-navigation.js.
- الحفاظ على schoolId وعدم تبديل دور الجلسة إلى administrative_employee.
- لا تعديل على Supabase أو روابط التسجيل والدخول.
