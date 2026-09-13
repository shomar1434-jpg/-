RL150 — ربط مركز المعلومات بالجلسة السحابية الموثقة

السبب الجذري المثبت:
1) RL149 كان يسمح بختم recentlyVerified لمدة 5 دقائق أن يتجاوز التحقق الخادمي الحي.
2) مركز المعلومات بعد ذلك يرسل token قديم/منتهي إلى school-information-structure، فيظهر المركز لكن يفشل المصدر السحابي والحفظ.
3) عند فشل التحقق مبكرًا كان showRetryGate ينفذ document.body.appendChild قبل إنشاء body، فيظهر Cannot read properties of null (reading appendChild).

التصحيح:
- ensureLive(requiredRoles,{force:true}) يتجاوز ختم التحقق المحلي ويثبت الجلسة على الخادم.
- secureSchoolInfo و phase2Call يجددان/يثبتان الجلسة مباشرة قبل كل طلب سحابي حساس.
- بوابة مركز المعلومات نفسها تستخدم force:true ولا تعتمد على ختم قديم.
- إصلاح appendChild قبل body.
- متابعة أعمال التقويم تستخدم نفس التحقق الحي.
- توحيد cache-buster لمحرك الجلسة في جميع صفحات الحزمة إلى RL150.

لا حذف ولا ترحيل بيانات، ولا تعديل school_id/user_id، ولا SQL، ولا Edge Function، ولا Workflow.
