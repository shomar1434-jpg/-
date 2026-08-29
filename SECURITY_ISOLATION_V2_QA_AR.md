# تقرير فحص Security Isolation V2

التاريخ: 2026-08-29

## النطاق
- manager.html
- school_information_center.html
- school-information-source.js
- platform-cloud-session.js
- supabase/functions/school-information/index.ts

## التصحيح
1. منع عرض manager.html ومركز المعلومات قبل تحقق جلسة manager الموثقة.
2. المدرسة في مركز المعلومات تؤخذ حصريًا من جلسة PlatformCloudSession.
3. تعطيل اختيار المدرسة ووضع التجربة داخل مركز المعلومات.
4. إزالة كل القراءة/الكتابة المباشرة إلى schools/students/school_members من مركز المعلومات ومن SchoolInformationSource.
5. نشر Edge Function جديدة school-information؛ تستخرج school_id من platform_sessions على الخادم ولا تقبل school_id من جسم الطلب.
6. عمليات الطلاب (قراءة/استيراد/تحديث/حذف/تنظيف العام) مقيدة على الخادم بمدرسة الجلسة.
7. عمليات الكتابة في مركز المعلومات مقيدة بدور مدير المدرسة.
8. بيانات الموظفين والمعلمين تُقرأ من عضويات المدرسة الحالية فقط داخل الخدمة السحابية.

## نتائج الفحص
- school_information_center.html: 4 كتل JavaScript داخلية، 0 أخطاء Syntax.
- school-information-source.js: node --check ناجح.
- لا توجد أي مراجع مباشرة إلى .from('schools') أو .from('students') أو .from('school_members') أو REST لهذه الجداول في الملفين بعد التصحيح.
- Edge Function school-information منشورة في Supabase وحالتها ACTIVE (version 1).

## ملاحظة منع الانحدار
لم يتم حذف سياسات RLS العامة الحالية بصورة عمياء لأن فحص الاعتماديات وجد صفحات دخول/تسجيل قديمة تعتمد عليها مباشرة؛ حذفها فورًا قد يعطل الدخول والتسجيل. هذا الإصدار يغلق مسار التسرب الفعلي في manager + مركز المعلومات عبر وسيط خادمي موثق. تشديد RLS العام لكل المنصة يجب أن يتم كمرحلة cutover مستقلة بعد نقل صفحات الدخول/التسجيل المتبقية إلى endpoints موثقة.
