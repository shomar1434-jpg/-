تصحيح مصدر اتصال Cloud Document Workspace من جلسة المنصة المركزية
2026-09-10

السبب:
صفحة مساحة العمل مستقلة، وكانت تبحث عن smartSchoolSupabaseUrl داخل localStorage/SmartSchoolSupabase، بينما محرك الجلسة المركزي نفسه يملك إعداد الاتصال الفعلي. لذلك ظهر SUPABASE_URL_MISSING رغم أن الدخول السحابي يعمل.

التصحيح:
1) platform-cloud-session.js
   - إضافة connectionConfig() للقراءة فقط.
   - يعيد رابط Supabase ومفتاح anon المستخدمين فعليًا بواسطة نفس محرك الجلسة.
   - لا يقبل school_id أو user_id من صفحة Workspace ولا يغير أي جلسة.

2) cloud-document-workspace.js
   - المصدر الأول والملزم للاتصال أصبح PlatformCloudSession.connectionConfig().
   - لا يوجد fallback ثابت داخل CDW لمشروع Supabase.
   - بقي فحص تطابق project ref مع anon JWT.

3) cloud_document_workspace.html
   - تحديث cache-busting لتحميل النسخ المصححة.

لا SQL ولا Edge Functions في هذا التصحيح.
لا تعديلات على manager.html / agent.html / unified_workspace.js / مركز التنبيهات.

ترتيب الرفع:
1. platform-cloud-session.js
2. cloud-document-workspace.js
3. cloud_document_workspace.html
ثم Hard Refresh.

اختبار القبول:
- الدخول إلى مكتبة قسم بنفس الجلسة الحالية.
- اختيار DOCX/XLSX قابل للتحرير.
- يجب ألا يظهر SUPABASE_URL_MISSING.
- النتيجة التالية إما فتح ONLYOFFICE، أو رسالة ONLYOFFICE_NOT_CONFIGURED إذا لم تتم تهيئة خادم المحرر.
