الإجراء المنفذ:
- تم إخراج كل سكربتات index.html الداخلية إلى ملف خارجي index-app.js لمنع ظهور الأكواد كنص داخل الواجهة.
- تم تعطيل Firebase داخل index-app.js باستبداله بتوافق آمن.
- تم إنشاء supabase-bridge.js كمصدر مركزي وحيد للمدارس والمستخدمين.
- تم إصلاح meeting_minutes_template.html بإغلاق وسم Tailwind بشكل صحيح.
- تم ربط register.html و school-login.html بجسر Supabase دون لمس التصميم.
اختبار:
1) شغّل عبر Live Server.
2) تأكد أن واجهة index لا تعرض أي كود.
3) أنشئ مدرسة وتحقق من جدول schools في Supabase.
4) جرّب تسجيل مستخدم وتحقق من جدول users.
