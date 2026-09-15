التصحيح النهائي للحساب متعدد المدارس — مبني مباشرة من المرجعية.zip دون مراكمة 02B/02C.

الملف المعدل فقط:
supabase/functions/platform-session/index.ts

المبدأ:
1) رابط الدخول يثبت المدرسة المطلوبة أولاً.
2) بيانات الاعتماد تثبت هوية واحدة فقط.
3) school_members هو مسار العضوية الأساسي.
4) للمدير الأساسي في المدارس القديمة، schools.manager_email داخل نفس school_id هو ربط إداري موثوق بعد نجاح إثبات بيانات الاعتماد.
5) Supabase Auth UUID يبقى الهوية canonical متى توفر.
6) لا يتم استعارة school_id أو user_id من مدرسة أخرى، ولا دمج بيانات المدارس.
7) memberships يعيد userId الخاص بالجلسة canonical، لذلك verifyAccess لا يطرد الحساب بسبب user_id تاريخي لمدرسة أخرى.

الـ workflow المركزي لا يحتاج تعديلًا لأن platform-session موجود أصلًا في paths وخطوة deploy.
