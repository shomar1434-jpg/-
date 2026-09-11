دمج قسم «متابعة مؤشرات فريق التقويم» — 11 سبتمبر 2026

الملفات الجديدة:
- evaluation_team_monitor.html
- evaluation-team-monitor.js
- supabase/functions/platform-evaluation-team/index.ts
- supabase/migrations/20260911170000_evaluation_team_monitor.sql
- .github/workflows/deploy-platform-evaluation-team.yml

الملفات المعدلة:
- manager.html
- platform-record-catalog.js

قواعد التنفيذ:
1) القسم صفحة مستقلة كاملة في واجهة المدير وليس iframe.
2) زر العودة يعيد إلى manager.html.
3) القسم الرئيسي للمدير فقط. المكلفون يعملون عبر محرك التكليفات/assignment_workspace ولا يحصلون على صفحة المدير.
4) حالة البرامج تحفظ سحابيا عبر PlatformStateEngine بنطاق school، مع school_id مأخوذ من الجلسة وليس من المتصفح.
5) المكلفون يُجلبون من دليل مستخدمي المدرسة عبر CloudTaskEngine.listUsers.
6) مهام البرامج تنشأ في Central Task Engine مع المسؤول الفعلي (المدير المنشئ) كمراجع.
7) الشاهد الداخلي يمر بمعاينة ثم اعتماد/إعادة/رفض.
8) روابط الرفع الخارجية Token آمن مخزن كبصمة SHA-256 ويمكن تدويره عند إعادة المشاركة.
9) الملفات الخارجية تحفظ في Storage المدرسة، ويُتحقق من الحجم بعد الرفع قبل إنشاء سجل نجاح.
10) المصطلحات المصححة تستخدم «الطلاب - الطالبات» ولا يوجد في القسم «طفل/أطفال/الأطفال».

النشر:
أ) ارفع الملفات إلى نفس المسارات في GitHub.
ب) نفذ migration في Supabase SQL Editor إن لم تكن آلية migrations تعمل تلقائيا.
ج) Workflow المنفصل ينشر platform-evaluation-team ولا يستبدل Workflow الوظائف الحالي.
د) انتظر نجاح Pages + Deploy Evaluation Team Function.

اختبار القبول:
- ظهور بطاقة القسم في manager.html وفتحه كصفحة مستقلة.
- إنشاء برنامج وربطه بمؤشر.
- تكليف مستخدم: يظهر في مركز تكليفاته ولا تفتح له لوحة المدير.
- رفع شاهد داخلي ثم معاينته واعتماده.
- إنشاء رابط خارجي وفتحه من جهاز آخر ورفع ملف ثم ظهوره في المراجعة الداخلية.
- التأكد من عزل school_id بين مدرستين.
- تجربة iPhone/iPad Safari للفتح والرفع.
