# RL74 — فتح بوابة الموظفين الإداريين وصفحة التقييم من المدير/الوكيل

بعد نجاح RL73 في إظهار الإداريين المرتبطين بالمدرسة بقي خللان:
- زر "الدخول إلى بوابة الموظفين الإداريين" يستدعي دالة غير موجودة.
- صفحات التقييم/التنفيذ/التحسين تُصنَّف افتراضياً كدور administrative_employee،
  فيرفضها محرك العزل عند فتحها من المدير أو الوكيل.

تم في RL74:
1. إضافة openAdministrativeEmployeesPortal() فعلياً.
2. تمرير schoolId + supervisor + mode=supervisor للبوابة.
3. تمرير نفس عقد الإشراف لصفحات التقييم والتنفيذ والتحسين.
4. تعديل routeRequiredRole() بحيث mode=supervisor يحافظ على دور manager/agent.
5. إبقاء المسار العادي للموظف الإداري محمياً بدور administrative_employee.
6. لا تعديل على Supabase ولا بيانات الموظفين ولا عزل المدارس.

الملفات:
- admin_employee_management.html
- platform-cloud-session.js
