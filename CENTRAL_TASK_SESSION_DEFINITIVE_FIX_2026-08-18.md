# الإصلاح النهائي لبنية جلسة مركز التكليفات — 2026-08-18

## السبب الجذري
1. صفحة دخول المدرسة كانت تسمح بمتابعة الدخول حتى عند فشل إنشاء `platform-session`.
2. جلسة Supabase Auth الناتجة عن تسجيل الدخول لم تكن تُحفظ كمسار استعادة مستقل داخل `PlatformCloudSession`.
3. مسار renew كان يحتوي تناقضًا: يسمح بمهلة سماح للجلسة القديمة ثم يرفض الجلسة revoked فور انتهاء expires_at.
4. المتصفح قد يحتفظ بإصدار JavaScript سابق من GitHub Pages.

## الإصلاح
- جعل نجاح `PlatformCloudSession.open()` شرطًا لإكمال دخول المدرسة المستقلة.
- إعادة `authAccessToken`, `authRefreshToken`, `authExpiresAt` من `platform-session` عند نجاح Supabase Auth، وحفظها بدون حفظ كلمة المرور.
- إضافة تجديد Auth عبر refresh token ثم `auth-recover` عند تعذر renew.
- إزالة الاعتماد على كلمة مرور محفوظة من مسار الاستعادة نهائيًا.
- السماح للجلسة revoked/expired ضمن مهلة السماح فقط عند وجود جلسة شقيقة فعالة واستمرار عضوية المستخدم.
- إضافة cache-busting لمحرك الجلسة في 69 صفحة ولمحرك التكليفات في الصفحات التي تستخدمه.

## اختبارات داخلية
- Login -> platform session + auth tokens: PASS
- Expired platform token -> renew succeeds: PASS
- renew=401 -> auth-recover -> new platform token: PASS
- expired auth access token -> refresh token -> auth-recover: PASS
- 54 external JS files syntax: PASS
- 88 HTML / 321 inline JS scripts syntax: PASS
- platform-session TS syntax class TS1xxx: PASS
- Workflow includes deploy of platform-session: PASS

## تحقق قاعدة البيانات الحية
- إنشاء التكليفات في `central_tasks`: موجود وفعال.
- `task_access_grants` للمكلفين: موجودة وفعالة مع can_view/can_update/can_upload/can_submit.

## ملاحظة نشر
يجب نجاح GitHub Action الخاص بـ `Deploy Supabase Edge Functions` ونشر `platform-session` بعد رفع النسخة.
بعد النشر يُفضّل تسجيل خروج/دخول مرة واحدة للحساب المفتوح قبل التحديث، كي تُلتقط Auth refresh token الجديدة وتصبح الاستعادة التلقائية دائمة بعد ذلك.
