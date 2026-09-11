تصحيح نهائي لمسار تكليف الدور الكامل للموجه الصحي – 11 سبتمبر 2026

سبب استمرار الرسالة:
- الواجهة أصبحت ترسل المعرف الصحيح health_advisor_comprehensive_record.
- لكن platform-tasks يتحقق من جدول platform_record_types في Supabase؛ إذا لم يكن migration قد نُفّذ أو لم يصل التعريف إلى القاعدة، يرفض التكليف برسالة «السجل غير مسجل في القاموس الموحد».

التصحيح:
1) يبقى سجل المعلم الشامل محصورًا في teacher_records و kindergarten_teacher_records فقط.
2) سجل الموجه الصحي الشامل يستخدم health_advisor_comprehensive_record.
3) platform-tasks ينفذ فحصًا مسبقًا قبل إنشاء التكليف.
4) للسجلات المعيارية المعروفة للموجه الصحي فقط، إذا كان تعريف القاموس مفقودًا يتم إصلاحه تلقائيًا في platform_record_types من قائمة خادم مغلقة، وليس من بيانات العميل.
5) يمنع الفحص المسبق إنشاء تكليفات يتيمة إذا فشل التحقق من السجلات.
6) migration السابقة مرفقة أيضًا كإجراء دائم وآمن.

الملفات:
- central_task_center.html
- platform-record-catalog.js
- supabase/functions/platform-tasks/index.ts
- supabase/migrations/20260911183000_fix_health_advisor_record_catalog.sql

النشر:
- ارفع الملفات بنفس المسارات.
- platform-tasks موجود أصلًا في workflow المركزي deploy-supabase-functions.yml، لذلك سيُنشر تلقائيًا عند رفع تغييره ولا توجد وظيفة جديدة تحتاج إضافة للـworkflow.
- يُفضّل تنفيذ migration المرفقة مرة واحدة أيضًا، لكن التصحيح الجديد لا يعتمد على نجاح تنفيذها حتى يعمل سجل الموجه الصحي المعياري.
