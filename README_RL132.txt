RL132 — إصلاح إنشاء وتفعيل حسابات المستخدمين من قسم المدير

الملفات المعدلة فقط:
1) manager.html
2) supabase/functions/platform-directory/index.ts

ما تم إصلاحه:
- إزالة الاعتماد على endpoint قديم school-accounts عند تحميل حسابات المدرسة.
- استخدام platform-directory/list-users المرتبط بجلسة المدير والمدرسة الحالية.
- عدم إرسال id محلي مؤقت من نوع user_* عند إنشاء مستخدم جديد.
- منع إنشاء حساب مدير/مالك من واجهة إدارة المستخدمين.
- التحقق من school_id قبل تعديل/تفعيل أي مستخدم.
- مزامنة users و school_members عند التفعيل/التعطيل والتحقق من النتيجة.
- إنشاء عضوية school_members مفقودة للحسابات القديمة التابعة لنفس المدرسة فقط.
- رفض أي بريد تابع لمدرسة أخرى بدل نقله أو الاستيلاء عليه.
- إظهار رسالة الخطأ الحقيقية بدل [object Object].
- عدم تعديل school-login.html أو platform-session أو روابط دخول المدارس.

فحص محلي:
- manager.html: 69 inline scripts / 0 syntax errors.
- platform-directory/index.ts: TypeScript syntax check passed after Deno/import shim.
- Workflow الحالي يتضمن platform-directory في paths وخطوة Deploy platform-directory.
