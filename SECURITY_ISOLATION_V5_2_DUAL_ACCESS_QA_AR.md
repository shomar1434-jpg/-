# فحص Security Isolation V5.2 — Dual Access

- البناء مبني مباشرة على V5.1 Gate Fix، دون إضافة طبقات واجهة أو تغيير دوال الدخول الأصلية.
- مسار مدير المدرسة بقي كما هو: PlatformCloudSession.verifyAccess(['manager']).
- مسار مدير النظام أصبح منفصلاً ولا يطلب school_id.
- وجود systemAdmin=1 أو sessionStorage لا يكفي وحده؛ يتم استدعاء Edge Function `system-admin` بالإجراء `verify` عبر جلسة Supabase Auth الحالية.
- وظيفة `system-admin` المنشورة تستخدم verify_jwt=true وتتحقق أيضاً من جدول system_admins/is_active.
- عند نجاح مدير النظام: يتم تحرير الصفحة مع سياق system_admin، دون تحويل إلى school-login.
- عند فشل تحقق مدير النظام: العودة إلى index.html وليس شاشة المدرسة المستقلة.
- عند فشل مدير المدرسة: يبقى التحويل إلى school-login كما في الحماية الحالية.
- لم تتغير enterApp/showManagerSectionsHome/goHome أو بطاقات الأقسام.
- فحص JavaScript للملفات والكتل المضمنة: ناجح، صفر أخطاء Syntax في البوابة الجديدة.
