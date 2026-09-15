التصحيح الجذري لمسار دخول المدير متعدد المدارس — RL161

الملفات:
1) supabase/functions/platform-session/index.ts
2) school-login.html

سبب المشكلة المثبت:
- school-login كان يسمح بالتوافق المحلي عند فشل platform-session ثم يفتح manager.html.
- manager.html يشترط جلسة cloud موقعة، لذلك كانت الواجهة تظهر ثم تُطرد.
- في المدير الأساسي متعدد المدارس، platform-session كان يصل إلى LD204 إذا لم توجد users/school_members مطابقة للمدرسة الثانية، قبل الوصول إلى manager_email fallback.

الحل:
- إذا أثبت Supabase Auth البريد وكلمة المرور وكان schools.manager_email لنفس المدرسة يطابق البريد، تُنشأ جلسة manager canonical بالـ Auth UUID لنفس school_id فقط.
- school-login لا يفتح أي واجهة مدرسة إذا لم تصدر platform-session؛ يعرض رمز التشخيص بدل الوميض والخروج.

النشر:
- ارفع الملفين.
- platform-session موجود مسبقًا في workflow المركزي، لذا لا تعديل على workflow.
- انتظر نجاح Deploy platform-session ثم اختبر.
