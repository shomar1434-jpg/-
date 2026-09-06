RL89 — إصلاح جذري لمسار تسجيل المدارس المستقلة

السبب المثبت:
register.html كانت توقف التسجيل بسبب اختلاف إصدار عقد RL87 قبل إرسال الطلب، بينما platform-directory المنشورة تقبل بالفعل system_admin_school_registration بعد تحقق المدرسة ورمز التسجيل.

التصحيح:
- لا تعديل على روابط الدخول.
- لا تعديل على schoolId/schoolCode/registrationCode.
- resolveInviteSchool يبقى هو بوابة تحديد المدرسة وتحويلها إلى school_id الحقيقي.
- فحص إصدار platform-directory أصبح تشخيصيًا وغير حاجب.
- رابط مالك النظام يرسل التسجيل إلى نفس school_id الذي تم التحقق منه.
- لا حاجة لإعادة نشر Supabase لهذا Patch؛ الملف الوحيد المعدل register.html.

الملفات المعدلة:
- register.html
