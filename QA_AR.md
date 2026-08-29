# QA — عزل روابط المدارس المستقلة
تم تصحيح أولوية هوية المدرسة: الرابط والجلسة السحابية قبل localStorage.
تم منع استخدام رابط دخول/تسجيل مخزن قديم عند عرض المدارس.
تم منع إنشاء رمز تسجيل محلي عشوائي من manager.html.
تم جعل school-login يحل المدرسة من id/code الصريحين فقط ثم fallback محلي مطابق حرفيًا.
تم جعل register يرفض أي تعارض بين schoolId وschoolCode وregistrationCode.
تم تحديث روابط جميع المدارس في Supabase لتكون Canonical مستقلة لكل مدرسة.
فحص JavaScript: PASS بدون أخطاء syntax.
