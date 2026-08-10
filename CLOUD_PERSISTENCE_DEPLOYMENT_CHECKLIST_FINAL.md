# قائمة النشر النهائية

1. نفّذ `SUPABASE_CLOUD_PERSISTENCE_FINAL.sql` مرة واحدة في Supabase SQL Editor.
2. ارفع محتويات حزمة التغييرات إلى نفس المسارات في GitHub دون إنشاء ملفات `index (1).ts` أو نسخ مكررة.
3. تأكد أن `supabase/functions/platform-state/index.ts` موجود في مساره.
4. ارفع Workflow المعدل `.github/workflows/deploy-supabase-functions.yml`.
5. راقب GitHub Actions حتى تنجح الوظائف: platform-session, platform-files, platform-tasks, platform-core, platform-state.
6. نفّذ Ctrl+F5 ثم سجّل خروجًا ودخولًا.
7. نفّذ اختبار جهازين/متصفحين المذكور في تقرير الاعتماد.

ملاحظة: لا تنفذ أي ملف SQL مرحلي سابق باسم `SUPABASE_PLATFORM_MODULE_STATE.sql`؛ تم حذفه من النسخة النهائية.
