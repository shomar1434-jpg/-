تصحيح عام لصلاحيات «تكليف دور كامل» داخل جميع الأقسام — 2026-09-11

الهدف
====
عند وجود تكليف دور كامل موثق ونشط، يعامل المستخدم داخل أقسام الدور المكلف به كصاحب الدور نفسه، دون تغيير دوره الأساسي في الحساب.

المبدأ الأمني
===========
- الدور الأساسي محفوظ ولا يتغير.
- الدور الفعّال للتفويض لا يُقبل من الرابط أو sessionStorage وحدهما.
- كل صفحة داخلية تستدعي PlatformCloudSession.ensure() تعيد التحقق خادميًا من التكليف النشط والمستخدم والمدرسة والدور.
- إذا ألغي التكليف أو لم يعد نشطًا، يمسح سياق التفويض ويعود العزل الطبيعي.
- زر «العودة إلى قسمي الرئيسي» يستخدم baseRole وليس الدور المفوض.

الملفات المعدلة
==============
platform-cloud-session.js
platform-delegated-role-portal.js
platform-core-engine.js
semester_plan.html
impact_assessment.html
health_advisor_weekly_tasks.html
school_health_unified_registry.html
health_advisor.html
student_advisor.html
activity_leader.html
supabase/functions/platform-core/index.ts

ما تم إصلاحه
============
1) أضيف مفهوم baseRole للدور الأساسي و role للدور الفعّال الموثق عند التفويض.
2) ensure() يعيد التحقق من التكليف في الصفحات الداخلية ويمنع بقاء تفويض ملغى أو قديم.
3) Platform Core يرسل مع الطلب سياق التفويض الموثق فقط.
4) platform-core Edge Function يعيد التحقق من task_id + school_id + assignee + assignment_type + status + delegated role قبل استعمال الدور المفوض.
5) الخطة الأسبوعية/الفصلية المشتركة أصبحت ترى health_advisor / student_advisor / activity_leader ... بحسب الدور المفوض بدل الدور الأساسي.
6) تم تحديث إصدار platform-cloud-session في الصفحات المتأثرة لمنع تحميل نسخة مخبأة قديمة.

النشر
=====
- ارفع الملفات بنفس المسارات.
- platform-core موجود أصلًا داخل workflow المركزي deploy-supabase-functions.yml، لذلك لا توجد إضافة Workflow جديدة.
- انتظر نجاح GitHub Actions لنشر platform-core.
- نفّذ Ctrl+F5 قبل الاختبار.

اختبار القبول
============
مثال: معلم مكلف بدور الموجه الصحي بالكامل:
المعلم -> مركز التكليفات -> الموجه الصحي -> الخطة الأسبوعية -> يجب فتح الخطة والعمل عليها دون رسالة حجب -> العودة للموجه الصحي -> زر العودة لقسمي الرئيسي يبقى موجودًا -> العودة للمعلم.
كرر الاختبار للموجه الطلابي ورائد النشاط وبقية أدوار «دور كامل».
