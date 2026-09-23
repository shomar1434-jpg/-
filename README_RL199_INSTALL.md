# RL199 — حزمة تصحيح دخول المدارس فقط

هذه حزمة فرق صغيرة وليست نسخة كاملة من المنصة.

## الملفات المعدلة

1. `school-login.html`
2. `platform-cloud-session.js`
3. `supabase/functions/platform-session/index.ts`
4. `.github/workflows/deploy-supabase-functions.yml`
5. `RL199_INDEPENDENT_SCHOOL_LOGIN_TIMEOUT_FIX_2026-09-23.md` (تقرير فقط)

## طريقة التركيب

فك الضغط في جذر المستودع مع السماح باستبدال الملفات الأربعة المطابقة فقط. لا تحذف أي ملفات أو مجلدات أخرى.

بعد الرفع إلى فرع `main` يجب أن يعمل الـworkflow المركزي، وأن تنجح الخطوتان:

- `Deploy platform-session login gateway`
- `Verify platform-session is reachable`

## قاعدة التسليم

هذه الحزمة تتبع قاعدة «ملفات التصحيح فقط»: لا تحتوي صور المنصة أو الصفحات غير المعدلة أو أي نسخة كاملة من المستودع.
