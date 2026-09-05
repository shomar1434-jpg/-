# RL69 — إرجاع عقد الموظف الإداري إلى ما قبل RL33

تمت مقارنة AUDIT_PRE_RL33 مباشرة مع RL33_WORK، وثبت أن RL33 غيّر داخل
admin_employee_management.html ثلاث نقاط مرتبطة مباشرة بمنظومة الموظف الإداري:

1) استبدال قراءة المدرسة من schoolId + جدول schools بخدمة
platformDirectoryCall('school-registration-context').
2) إضافة supervisorUserId و adminRegistrationToken إلى رابط تسجيل الموظف.
3) استبدال platform-cloud-session v12 بمحرك RL33 للعزل الكامل.

RL69 يعيد هذه النقاط إلى سلوك ما قبل RL33 داخل قسم الموظف الإداري فقط.
وأزيلت تعويضات RL67/RL68 من صفحة الإدارة ليكون الاختبار العكسي نظيفاً.

تم الحفاظ على وظائف دورة الموظف اللاحقة الموجودة في النسخة الحالية:
التفعيل، التعطيل، الخطط السحابية، الاعتماد، التنفيذ والتحسين.

الملف المعدل: admin_employee_management.html فقط.
لا رجوع لنظام العزل العام، ولا تعديل على Supabase أو manager/agent/teacher/impact.
