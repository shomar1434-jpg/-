تصحيح حصر سجل المعلم الشامل + تكليف الدور الكامل — 2026-09-11

الملفات المعدلة:
1) platform-record-catalog.js
2) central_task_center.html
3) supabase/migrations/20260911183000_fix_health_advisor_record_catalog.sql

ما تم تصحيحه:
- إزالة الاستخدام الداخلي الخاطئ للمعرف teacher_comprehensive_record من سجل الموجه الصحي الشامل.
- المعرف الصحيح أصبح health_advisor_comprehensive_record.
- سجل المعلم الشامل يبقى خاصًا بقسم المعلم، مع السماح بنسخة معلمة رياض الأطفال في وحدتها الخاصة.
- إضافة حاجز في تكليف الدور الكامل يمنع إدخال أي سجل تابع teacher_records أو kindergarten_teacher_records أو teacher_comprehensive_record ضمن أدوار:
  الموجه الصحي / الموجه الطلابي / رائد النشاط.
- تسجيل سجلات الموجه الصحي اللازمة في القاموس السحابي حتى لا يتوقف تكليف الدور الكامل عند السجل التالي.
- لا يوجد حذف لبيانات أو ملفات محفوظة. أي تعريف خاطئ سابق في قاعدة البيانات يتم تعطيله فقط، لا حذفه.

ترتيب التطبيق:
1) ارفع platform-record-catalog.js و central_task_center.html.
2) نفذ migration: supabase/migrations/20260911183000_fix_health_advisor_record_catalog.sql
3) حدّث الصفحة تحديثًا قسريًا ثم اختبر تكليف دور كامل للموجه الصحي والموجه الطلابي ورائد النشاط.

لا توجد Edge Function جديدة في هذا التصحيح، لذلك لا يحتاج workflow إلى إضافة جديدة.
