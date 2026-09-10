تصحيح جذري لنشر Cloud Document Workspace — 2026-09-10
========================================================

سبب المشكلة المؤكد:
الدالة platform-document-workspace كانت موجودة ضمن حزمة Cloud Document Workspace، لكن مسار النشر الأساسي الموجود فعلياً في المنصة
.github/workflows/deploy-supabase-functions.yml
لم يكن يتابع مجلد هذه الدالة ولم يكن ينشرها. الاعتماد على Workflow منفصل جعل النشر قابلاً للفقد عند رفع التصحيحات.

الحل الجذري:
1) إدخال platform-document-workspace داخل Workflow Supabase الأساسي نفسه.
2) إضافة مجلد الدالة إلى paths حتى أي تعديل عليها يشغل النشر الأساسي تلقائياً.
3) إضافة خطوة تحقق بعد النشر تتصل فعلياً بالدالة action=probe. إذا لم تصبح الدالة قابلة للوصول يفشل GitHub Action ولا يعطي نجاحاً وهمياً.
4) الإبقاء على Workflow مستقل كخيار يدوي احتياطي فقط، بلا push trigger، لمنع تشغيل عمليتي نشر متوازيتين لنفس الدالة.
5) إرفاق أحدث نسخة من Edge Function نفسها لضمان أن الملف الذي يشغل الـWorkflow موجود في المستودع.

الملفات في الحزمة:
- .github/workflows/deploy-supabase-functions.yml  [تعديل موضعي على Workflow الموجود]
- .github/workflows/deploy-platform-document-workspace.yml [احتياطي يدوي فقط]
- supabase/functions/platform-document-workspace/index.ts [أحدث نسخة]

لا يوجد:
- تعديل manager.html أو agent.html
- تعديل unified_workspace.js أو جرس التنبيهات
- SQL Migration
- حذف بيانات أو ملفات

طريقة الرفع:
استبدل الملفات الثلاثة في نفس مساراتها داخل المستودع ثم Push إلى main.
يجب أن يعمل Workflow: Deploy Supabase Edge Functions
وتظهر داخله خطوتان متتاليتان:
Deploy platform-document-workspace
Verify platform-document-workspace is reachable

نتيجة القبول:
- إذا نجحت خطوة Verify باللون الأخضر: الدالة منشورة فعلياً ويمكن للواجهة الوصول إليها.
- إذا ظهر Warning ONLYOFFICE: النشر سليم، والمتبقي فقط أسرار ONLYOFFICE في Supabase.
- إذا فشلت Verify: لا تعتبر النشر ناجحاً، وستظهر الاستجابة/HTTP داخل سجل GitHub Action لتحديد السبب.

أسرار Supabase المطلوبة للـWorkflow نفسه (مستخدمة أصلاً في المنصة):
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF

أسرار Supabase المطلوبة لتشغيل المحرر بعد نجاح النشر:
ONLYOFFICE_DOCUMENT_SERVER_URL
ONLYOFFICE_JWT_SECRET
