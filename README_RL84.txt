RL84 — إصلاح تراكمي مستقل لروابط تسجيل المدارس المستقلة

السبب:
- رسالة "رابط تسجيل المستخدمين قديم أو غير موثق" كانت تصدر من register.html قبل استدعاء platform-directory.
- RL83 احتوى على Edge Function فقط، ولذلك تركيب RL83 منفرداً لا يستبدل register.html القديمة.

الملفات المطلوبة معاً:
1) register.html -> يرفع مع ملفات الواجهة.
2) supabase/functions/platform-directory/index.ts -> يعاد نشر Edge Function: platform-directory.

لا يتم تغيير schoolId أو schoolCode أو registrationCode ولا يلزم إعادة توليد الروابط القديمة.
لا توجد أي عمليات حذف أو تنظيف بيانات.
