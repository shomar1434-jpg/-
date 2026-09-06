RL86 - عقد تسجيل المدارس المستقلة V2

الهدف:
إزالة الاعتماد الهش على source أو رقم إصدار الرابط في تحديد صلاحية رابط تسجيل المستخدمين.

العقد النهائي:
1) يتم أولاً التحقق من المدرسة نفسها بواسطة schoolId/schoolCode/registrationCode وأنها فعالة.
2) الموظف الإداري: يبقى مساره الموقع كما هو ويتطلب supervisorUserId + adminRegistrationToken.
3) رابط المدير: إذا وُجد managerUserId أو generalRegistrationToken فيعامل كرابط مدير ويجب اكتمال التوقيع وصحته وعضوية المدير الفعالة.
4) رابط مالك النظام الثابت: إذا لم توجد بيانات توقيع مدير، يقبل بعد تحقق المدرسة ورمز registrationCode، بغض النظر عن source أو تاريخ إنشاء الرابط.
5) لا يتم تغيير schoolId أو schoolCode أو registrationCode ولا إنشاء روابط بديلة.
6) روابط الدخول لم تُعدل لأنها تعمل حسب اختبار المستخدم.

الملفات المعدلة فقط:
- register.html
- supabase/functions/platform-directory/index.ts

النشر:
- رفع register.html إلى GitHub Pages.
- إعادة نشر Edge Function: platform-directory.
