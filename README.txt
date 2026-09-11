تصحيح دخول «تكليف دور كامل» — 2026-09-11

السبب الجذري:
platform-cloud-session.js يفرض عزل المسارات حسب الدور الأساسي للمستخدم. عند فتح دور مكلف به عبر:
?delegated_role=1&delegated_role_task=<task-id>
كان routeRequiredRole() يرى مثلاً health_advisor بينما جلسة المستخدم الأساسية teacher، فيستدعي verifyAccess([health_advisor]) ثم يعيد المستخدم إلى قسمه الأساسي.

التصحيح:
1) لا يتم إلغاء عزل الأدوار ولا تغيير الدور الأساسي للمستخدم.
2) أضيف تحقق خادمي جديد داخل platform-tasks باسم validate-delegated-role.
3) يسمح بتجاوز شرط الدور للمسار فقط إذا تحقق الخادم من:
   - أن التكليف من نوع additional_role.
   - أن التكليف نشط.
   - أن المستخدم الحالي هو المكلف الفعلي، وليس مجرد منشئ التكليف أو مدير المدرسة.
   - أن الدور المطلوب في الصفحة يطابق delegatedRoleCode المسجل في التكليف.
   - أن التكليف ضمن المدرسة الحالية؛ وهذا مضمون من جلسة platform-tasks وعزل school_id.
4) بعد التحقق، يحفظ سياق التفويض في sessionStorage للتاب الحالي فقط حتى يستطيع المستخدم فتح صفحات الدور الفرعية دون تغيير دوره الأساسي.
5) عند الضغط على «العودة إلى قسمي الرئيسي» يمسح سياق التفويض.
6) إذا انتهى/سحب/أغلق التكليف، يفشل التحقق التالي تلقائياً ويعاد تطبيق عزل الدور الطبيعي.

الأدوار المدعومة:
- وكيل/وكيلة الشؤون التعليمية
- وكيل/وكيلة الشؤون المدرسية
- وكيل/وكيلة شؤون الطلاب
- الموجه/الموجهة الصحي/الصحية
- الموجه/الموجهة الطلابية
- رائد/رائدة النشاط

الملفات المعدلة:
- platform-cloud-session.js
- platform-delegated-role-portal.js
- unified_workspace.js
- health_advisor.html
- student_advisor.html
- activity_leader.html
- agent.html
- supabase/functions/platform-tasks/index.ts

النشر:
- ارفع الملفات بنفس المسارات.
- platform-tasks موجود مسبقاً في .github/workflows/deploy-supabase-functions.yml، لذلك نشره يتم تلقائياً ولا يحتاج إضافة Workflow جديدة.
- انتظر نجاح GitHub Actions ثم نفذ تحديثاً إجبارياً للمتصفح.

لا توجد Migration أو SQL في هذا التصحيح.
