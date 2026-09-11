تصحيح تنظيف وإصلاح جذري لقسم الموجه الصحي — 2026-09-11

الهدف:
إيقاف تراكم تصحيحات بوابة الدخول ومعالجة السبب البنيوي داخل health_advisor.html نفسه.

التغييرات:
1) جعل بوابة welcome-gate ظاهرة افتراضياً من CSS، بدلاً من اعتماد ظهورها على window.onload أو مؤقتات.
2) يبقى حاجز الأمان health-advisor-auth-pending هو المسؤول عن إخفاء كامل الصفحة حتى نجاح التحقق من المدرسة/الجلسة/التفويض.
3) إزالة منطق RL80 المتراكم الذي كان يعيد فرض display/visibility/opacity على الواجهة.
4) تصحيح data-ss-role من teacher إلى health_advisor مع بقاء data-platform-role=health_advisor.
5) تصحيح رابط مركز التكليفات داخل القسم ليستخدم role=health_advisor بدلاً من role=teacher.

لا يوجد:
- SQL
- Edge Function جديدة
- تعديل Workflow
- حذف بيانات أو أرشيف أو تقارير

الملف المعدل فقط:
health_advisor.html
