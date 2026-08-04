# تقرير تنفيذ استقرار الجلسة السحابية وربط شواهد الجاهزية

## نطاق التنفيذ

تم تنفيذ التعديلات على النسخة المرجعية الكاملة فقط، دون تعديل بقية وظائف المنصة غير المرتبطة بالمشكلة.

## التعديلات المنفذة

1. إعادة بناء `platform-session` لمعالجة خطأ HTTP 500.
2. إزالة الاعتماد على عمود `users.name` غير المضمون وجوده.
3. إضافة تحقق صريح من متغيرات بيئة Edge Functions.
4. دعم التحقق عبر Supabase Auth عند توفر الحساب، مع دعم كلمات المرور القديمة في جدول `users`.
5. التحقق من المدرسة عبر `id` أو `school_code` أو `registration_code`.
6. التحقق من عضوية المستخدم في `school_members` عند الحاجة.
7. منع إنشاء جلسة لمعرف مستخدم غير UUID.
8. التحقق من نجاح إدراج سجل `platform_sessions` وإرجاع رمز خطأ واضح مع `requestId`.
9. منع تراكم الجلسات النشطة لنفس المستخدم والمدرسة عبر إلغاء الجلسة السابقة عند تسجيل الدخول من جديد.
10. تحسين `platform-cloud-session.js` لتخزين هوية المدرسة والمستخدم والدور وتفاصيل الخطأ.
11. ربط رفع شاهد الجاهزية بالمسار السحابي العام وبجدول `school_readiness_evidence`.
12. تمرير `sectionKey` و`taskKey` وبيانات المهمة عند رفع الشاهد.
13. مزامنة الحذف والاستعادة والحذف النهائي بين `platform_files` و`school_readiness_evidence`.
14. تحسين معاينة الشاهد السحابي باستخدام Signed URL بدل تحويله دائمًا إلى Blob محلي.

## الملفات المعدلة

- `supabase/functions/platform-session/index.ts`
- `supabase/functions/platform-files/index.ts`
- `platform-cloud-session.js`
- `school_readiness.html`

## الملف المضاف لقاعدة البيانات

- `SUPABASE_READINESS_EVIDENCE_INTEGRATION.sql`

## خطوات النشر بعد اعتماد النسخة

1. تنفيذ `SUPABASE_READINESS_EVIDENCE_INTEGRATION.sql` في Supabase SQL Editor.
2. رفع النسخة المكتملة إلى GitHub.
3. سيتولى GitHub Actions إعادة نشر:
   - `platform-session`
   - `platform-files`
4. تسجيل الخروج والدخول بحساب مدرسة مستقلة.
5. التحقق من أن `platform_sessions` يسجل جلسة بحالة active.
6. رفع شاهد من مركز الجاهزية والتحقق من ظهوره في:
   - Storage bucket: `school-platform-files`
   - جدول `platform_files`
   - جدول `platform_file_links`
   - جدول `school_readiness_evidence`
