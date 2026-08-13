# MULTI SCHOOL / MULTI ROLE – ALL USERS

تم تعميم مبدّل المدرسة والدور على جميع واجهات الأدوار.

## قواعد العزل
- المدرسة الحالية = school_id إلزامي.
- العضوية الحالية = membership_id.
- الدور الحالي = membership.role.
- عند التبديل تُحدّث جلسة platform-session أولًا، ثم سياق الواجهة، ثم يعاد تحميل صفحة الدور.
- إذا فشل تبديل الجلسة السحابية لا تتغير المدرسة محليًا.
- توجد طبقة حفظ/استعادة للحالة المحلية القديمة غير المقيّدة بمدرسة لتقليل اختلاط البيانات المحلية بين المدارس.

## النشر السحابي
1. نفذ SUPABASE_MULTI_SCHOOL_ALL_USERS.sql.
2. انشر supabase/functions/platform-session.
3. أضف school_members لكل مستخدم يعمل في أكثر من مدرسة أو أكثر من دور.

## الواجهات
manager / agent / teacher / student_advisor / health_advisor / activity_leader / kindergarten_teacher / administrative_employee_portal.
