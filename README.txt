تصحيح التوافق الشامل المحافظ مع iOS / Safari — 2026-09-10
المرجع: المرجعية.zip المرفوعة من المستخدم.

الملفات المعدلة فقط:
1) platform-cloud-session.js
2) unified_workspace.js
3) index.html
4) register.html

النطاق:
- طبقة عرض WebKit/iOS مشروطة بوجود WebKit + touch، ولا تغير auth/storage/school_id.
- VisualViewport لتفادي انهيار الارتفاع مع شريط Safari ولوحة المفاتيح.
- safe-area وviewport-fit لصفحات الدخول/التسجيل.
- منع zoom التلقائي لحقول الإدخال على iPhone.
- تحسين touch والجداول/النوافذ والوسائط.
- استبدال ارتفاع full-screen في unified workspace بـ 100dvh مع fallback وVisualViewport.

لم يتم تعديل:
- Supabase Edge Functions أو SQL
- CDW/ONLYOFFICE
- محركات الشواهد/التكليفات/التنبيهات/مركز المعلومات
- منطق الأدوار أو school_id

ملاحظة: موثوقية رفع Safari موجودة في حزمة الرفع السابقة؛ هذه الحزمة خاصة بالتوافق البصري/التنقل المشترك.
