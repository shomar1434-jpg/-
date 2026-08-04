# قائمة نشر النسخة المكتملة لمحرك التخزين

## قبل الرفع إلى GitHub

- استبدال ملفات المستودع بمحتويات هذه النسخة كاملة.
- عدم حذف GitHub Secrets الموجودة:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
- التأكد من أن الفرع المنتج هو `main`.

## قاعدة البيانات

إذا سبق تنفيذ `SUPABASE_PLATFORM_FILES_FINAL_SETUP.sql`، نفّذ فقط:

- `SUPABASE_READINESS_EVIDENCE_INTEGRATION.sql`

أما المشروع الجديد فيمكنه تنفيذ الملف الموحد:

- `SUPABASE_PLATFORM_FILES_FINAL_SETUP.sql`

الملف الموحد يتضمن الآن استكمال ربط جدول `school_readiness_evidence`.

## Edge Functions

عند رفع النسخة إلى `main` سيعيد GitHub Action نشر:

- `platform-session`
- `platform-files`

## اختبار القبول

1. تسجيل خروج ثم دخول مدير مدرسة مستقلة.
2. ظهور `POST 200` في استدعاء `platform-session`.
3. ظهور سجل فعال في `platform_sessions`.
4. رفع ملف من مكتبة المدير.
5. رفع شاهد من مركز الجاهزية.
6. التأكد من السجلات في `platform_files` و`platform_file_links` و`school_readiness_evidence`.
7. اختبار مدرسة ثانية ومستخدمين مختلفين داخل المدرسة نفسها للتحقق من العزل.
