# تنفيذ محرك الملفات السحابي الموحد – المرحلة الأولى

تمت إضافة البنية التنفيذية التالية إلى النسخة:

- `SUPABASE_PLATFORM_FILES_MIGRATION.sql`: إنشاء Bucket خاص والجداول والفهارس وRLS.
- `supabase/functions/platform-session/index.ts`: إنشاء جلسة ملفات موثوقة بعد تسجيل الدخول.
- `supabase/functions/platform-files/index.ts`: الرفع، العرض، الروابط المؤقتة، إنشاء المجلدات، الربط والحذف المنطقي.
- `platform-cloud-session.js`: إدارة رمز جلسة الملفات في الواجهة.
- `cloud-file-engine.js`: واجهة موحدة لجميع أقسام المنصة.
- `cloud-file-panel.js`: لوحة اختبار فعلية للمكتبات.

تم الربط الأولي مع:

1. مركز جاهزية المدرسة: شواهد التنفيذ تُرفع إلى Supabase Storage، مع بقاء IndexedDB كخيار استرداد إذا لم تُنشر الوظائف بعد.
2. مكتبة المدير.
3. مكتبة الوكيل.
4. مكتبة المعلم.

## خطوات النشر في Supabase

1. تنفيذ `SUPABASE_PLATFORM_FILES_MIGRATION.sql` في SQL Editor.
2. نشر الوظيفتين:
   - `platform-session`
   - `platform-files`
3. ضبط Secret باسم `SUPABASE_SERVICE_ROLE_KEY` داخل بيئة Edge Functions.
4. تسجيل الخروج من المنصة ثم الدخول مجددًا لإنشاء جلسة الملفات.
5. إجراء اختبار الرفع من الأقسام الأربعة.

## قاعدة المسار المطبقة

- ملفات المستخدم:
  `schools/{school_id}/users/{user_id}/{module_key}/{folder_or_record_id}/{file_id}.{extension}`
- ملفات المدرسة المشتركة:
  `schools/{school_id}/shared/{module_key}/{record_id}/{file_id}.{extension}`
