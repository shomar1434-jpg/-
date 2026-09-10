تصحيح تكامل Cloud Document Workspace — 10 سبتمبر 2026

سبب الخطأ الذي ظهر بصورة "Failed to fetch":
1) دالة platform-document-workspace الجديدة لم تكن موجودة ضمن workflow النشر التلقائي للـ Edge Functions في النسخة المرجعية.
2) محرك cloud-document-workspace.js كان يحتوي fallback ثابتاً لرابط Supabase ومفتاح anon، ما قد يؤدي إلى الاتصال بمشروع غير المشروع الفعلي.
3) لم يكن هناك Probe مستقل يفرق بين: الدالة غير المنشورة، منع Supabase Gateway، انتهاء الجلسة، وعدم تهيئة ONLYOFFICE.
4) callback الخاص بـ ONLYOFFICE يحتاج أن تصل الطلبات إلى الدالة دون Supabase JWT؛ لذلك يجب نشر هذه الدالة تحديداً بخيار --no-verify-jwt، بينما التحقق الفعلي يتم داخل الدالة بجلسة المنصة وJWT الخاص بـ ONLYOFFICE.

الملفات المعدلة:
- cloud-document-workspace.js
- cloud_document_workspace.html
- supabase/functions/platform-document-workspace/index.ts

ملف جديد آمن لا يستبدل workflow الحالي:
- .github/workflows/deploy-platform-document-workspace.yml

التغييرات:
- إزالة fallback الثابت لـ Supabase من محرك Workspace.
- قراءة رابط المشروع ومفتاح anon من إعدادات المنصة الفعلية فقط.
- فحص تطابق project-ref الموجود في رابط Supabase مع ref الموجود في JWT لمفتاح anon؛ وعند الاختلاف يتوقف الفتح لحماية عزل المدارس.
- إضافة Authorization: Bearer <anon> مع apikey للطلبات المتجهة إلى Supabase Gateway.
- إضافة مهلة اتصال واضحة بدل بقاء fetch معلقاً.
- إضافة action=probe خفيف لا يحتاج جلسة المنصة لتأكيد أن الدالة منشورة ويمكن الوصول إليها.
- health يتحقق بعد ذلك من جلسة المنصة ومن بقاء school_id مستخرجاً خادمياً.
- صفحة التحرير تجري health قبل open-session وتظهر سبباً دقيقاً بدلاً من Failed to fetch.
- إضافة workflow مستقل لنشر platform-document-workspace تلقائياً بخيار --no-verify-jwt، دون تعديل workflow السابق أو إسقاط نشر أي Edge Function أخرى.

ترتيب النشر:
1) ارفع الملفات الثلاثة المعدلة إلى مساراتها نفسها.
2) أضف ملف workflow الجديد كما هو تحت .github/workflows/.
3) Push إلى main؛ سيعمل Deploy Platform Document Workspace تلقائياً عند تغير الدالة، أو شغله يدوياً من Actions.
4) تأكد في Supabase > Edge Functions من ظهور platform-document-workspace.
5) أضف/تحقق من أسرار Supabase التالية:
   ONLYOFFICE_DOCUMENT_SERVER_URL
   ONLYOFFICE_JWT_SECRET
6) Hard Refresh ثم افتح ملف DOCX/XLSX من مكتبة القسم واضغط تحرير.

نتائج التشخيص المتوقعة بعد التصحيح:
- WORKSPACE_FUNCTION_NOT_DEPLOYED: الدالة غير منشورة.
- WORKSPACE_GATEWAY_JWT_BLOCKED: الدالة نُشرت دون --no-verify-jwt.
- PLATFORM_SESSION_MISSING: جلسة المنصة غير موجودة.
- SUPABASE_PROJECT_MISMATCH: رابط Supabase ومفتاح anon من مشروعين مختلفين.
- ONLYOFFICE_NOT_CONFIGURED: الدالة تعمل والعزل سليم لكن أسرار ONLYOFFICE غير مكتملة.
- عند نجاح الجميع يبدأ المحرر الفعلي.

الحماية والعزل:
- لم تتم إضافة school_id إلى الطلب من الواجهة.
- الملف ما زال يجلب داخل Edge Function بشرط school_id المستخرج من platform_sessions.
- callback لا يعتمد على هوية قادمة من المتصفح، بل على session id + secret hash + ONLYOFFICE JWT + أصل document server المعتمد.
- لا يوجد حذف أو استبدال مدمر لأي ملف أو إصدار.

الفحص:
- اختبارات CDW السابقة: 34/34 PASS.
- cloud-document-workspace.js: Node syntax PASS.
- JavaScript المضمن في cloud_document_workspace.html: syntax PASS.
- تحقق وجود probe وhealth الجديدين: PASS.
- تحقق أن workflow الجديد يستخدم --no-verify-jwt: PASS.
