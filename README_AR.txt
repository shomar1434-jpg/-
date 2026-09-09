تصحيح: مركز الأحداث والتنبيهات + Web Push للمدير
التاريخ: 2026-09-09

الهدف
- بناء محرك مركزي يسجل أحداث المستخدمين حسب school_id.
- إنشاء صندوق تنبيهات للمدير مرتبط بـ user_id + school_id.
- تسجيل أجهزة المدير واستقبال Web Push.
- إضافة رقم جوال للمدير في حسابه (مخزن للحساب، ولا يستخدم كهوية Push).
- عدم تثبيت أي مدرسة داخل الكود.

الملفات المعدلة
1) manager.html
   - تحميل مركز التنبيهات داخل واجهة المدير.
   - إظهار رقم جوال المدير في قائمة الحسابات.
2) platform-event-bus.js
   - يعكس الأحداث إلى school_events بدون تعطيل العملية الأصلية عند فشل خدمة التنبيهات.
3) supabase/functions/platform-directory/index.ts
   - يعيد mobile_number/mobile_verified ضمن بيانات الحسابات.

الملفات الجديدة
4) platform-notification-center.js
5) platform-push-sw.js
6) supabase/functions/platform-notifications/index.ts
7) supabase/migrations/20260909230000_platform_notifications_push.sql

ترتيب النشر
1. نفّذ migration:
   supabase/migrations/20260909230000_platform_notifications_push.sql
2. انشر Edge Function الجديدة:
   platform-notifications
3. أعد نشر platform-directory بعد استبدال index.ts المرفق.
4. أضف Supabase Secrets التالية (مرة واحدة على مستوى المشروع):
   VAPID_PUBLIC_KEY
   VAPID_PRIVATE_KEY
   VAPID_SUBJECT  مثال: mailto:admin@example.com
5. ارفع ملفات الواجهة المعدلة/الجديدة إلى نفس مجلد المنصة:
   manager.html
   platform-event-bus.js
   platform-notification-center.js
   platform-push-sw.js
6. افتح حساب المدير > جرس التنبيهات > الإعدادات > تفعيل إشعارات هذا الجهاز > إرسال تنبيه تجريبي.

الحماية والعزل
- school_id يؤخذ من platform_sessions داخل Edge Function، ولا يؤخذ من مدخلات المتصفح.
- هوية المستلم هي recipient_user_id داخل المدرسة نفسها.
- reviewer_id / requester_id / supervisor_id لها الأولوية إذا كانت موجودة ومرتبطة بعضوية فعالة في نفس المدرسة.
- فشل Push لا يفشل حفظ الحدث ولا العملية الأصلية.
- اشتراكات الأجهزة المنتهية 404/410 يتم تعطيلها فقط ولا تُحذف بيانات المستخدم.
- لا توجد أي عملية حذف لملفات أو سجلات المنصة ضمن هذا التصحيح.

ملاحظة مهمة عن النطاق
- هذا الإصدار يسجل تلقائيًا العمليات التي تمر عبر PlatformEventBus في الصفحات المرتبطة به.
- العمليات القديمة التي لا تستدعي PlatformEventBus لن تظهر تلقائيًا حتى تُربط بحدث emit؛ البنية المركزية نفسها جاهزة ولا تحتاج إعادة بناء.
