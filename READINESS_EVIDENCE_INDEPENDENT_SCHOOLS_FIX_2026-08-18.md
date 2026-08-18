# مراجعة وحل حفظ شواهد محرك الجاهزية — 2026-08-18

## السبب الجذري المثبت من الكود
1. `platform-files` كان يسمح بالرفع بنطاق `school` للمدير فقط، بينما المكلف بمهمة جاهزية يحتاج رفع شاهد من حسابه.
2. عند الرفع من مركز التكليفات كان `recordId` يحمل معرف التكليف `central_tasks.id`، لكن محرك الملفات كان يستخدمه خطأً كـ `school_readiness_evidence.plan_id`.
3. مركز التكليفات يرسل `readinessTaskKey` بينما محرك الملفات كان يبحث عن `taskKey` فقط، فيتجاوز إنشاء سجل `school_readiness_evidence`.
4. تعريف صلاحية المدير لم يشمل صيغ `مدير المدرسة` و`مديرة المدرسة` وبعض aliases المستخدمة في المنصة.
5. مفتاح مهمة الشاهد في صفحة الجاهزية كان يستخدم `section:index` بينما بقية محرك التكليفات يستخدم `section::index`.
6. مسار رفع الشواهد لم يكن ذرياً عند فشل جزء من عملية الرفع/الربط.

## الإصلاح
- فصل `readinessPlanId` عن `taskId` بصورة صريحة.
- السماح للمكلف برفع شاهد مدرسي فقط إذا كان لديه `task_access_grants.can_upload=true` لتكليف الجاهزية في نفس المدرسة، مع fallback تحقق من `central_tasks.assigned_to`.
- استخدام `readinessPlanId` الصحيح في `school_readiness_evidence.plan_id`.
- دعم `taskKey` و`readinessTaskKey` و`sectionKey`/`sectionId`.
- توسيع aliases مدير المدرسة.
- توحيد task key على `section::index`.
- منع الحفظ المحلي الصامت للشواهد في المدارس المستقلة؛ أي فشل سحابي يظهر بوضوح ولا يعتبر المهمة منفذة.
- تنظيف الملفات الجزئية عند فشل عملية متعددة الملفات.
- في مساحة المكلف: رفع الشاهد أولاً ثم تسجيل التنفيذ والربط والإرسال للاعتماد، مع حذف الملف إذا فشل الربط قبل الإرفاق.
- مسار التخزين يبقى معزولاً: `schools/<school_id>/shared/school_readiness/...`.

## الملفات المعدلة
- `supabase/functions/platform-files/index.ts`
- `school_readiness.html`
- `central_task_center.html`

## النشر
يجب أن ينجح Deploy Supabase Edge Functions، وبالتحديد `platform-files` (health version: `3.1.0-readiness-evidence`).

## ملاحظة قاعدة البيانات
تعذر تنفيذ استعلام تحقق حي عبر موصل Supabase في جلسة المراجعة بسبب رفض صلاحية MCP. لذلك لم يتم تعديل المخطط. النسخة تعتمد على أعمدة تكامل الشواهد الموجودة مسبقاً في `SUPABASE_READINESS_EVIDENCE_INTEGRATION.sql` (`platform_file_id`, `status`, `deleted_at`).
