# إصلاح جذري لاستعادة جلسة مركز التكليفات

- ثبت من سجلات Supabase أن `platform-session` الإصدار 10 كان منشورًا، ومع ذلك ظهرت 401 عند التجديد.
- السبب المتبقي: بعض المتصفحات تحمل رمز `platform-session` قديمًا سبق إلغاؤه، بينما كلمة المرور لا تُحفظ (ولا ينبغي حفظها) لإعادة تسجيل الدخول تلقائيًا.
- عائق إضافي: `central_task_center.html` لا يحمل `supabase-bridge.js`، لذلك الاعتماد على `SmartSchoolSupabase` وحده لاستعادة Auth لا يعمل في هذه الصفحة.
- أضيف `action=auth-recover` إلى Edge Function `platform-session`: يتحقق من Bearer token الخاص بـ Supabase Auth، ثم من عضوية المستخدم في المدرسة الحالية (`school_members` أو users أو manager_email)، ويصدر جلسة منصة جديدة.
- `platform-cloud-session.js` يجرب بالترتيب: renew للرمز الحالي، ثم auth-recover من Supabase Auth، ثم توافق تسجيل الدخول المحلي القديم إن توفرت بياناته أصلًا.
- استخراج Auth يعمل عبر Supabase client إن كان محملًا، أو مباشرة من مفتاح `sb-<project-ref>-auth-token` عند غياب الـBridge.
- لا يتم حفظ كلمة مرور المستخدم في localStorage.
- تم اختبار حالة: OLD_REVOKED -> renew 401 -> auth-recover 200 -> تخزين NEW_TOKEN بنجاح.
