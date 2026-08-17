# استعادة المسار المرجعي الآمن لمركز التكليفات — 2026-08-18

## المنهج
تم اعتماد الحالة السابقة التي كان فيها مركز التكليفات يعمل كمرجع وظيفي، مع الإبقاء على آخر نسخة للمنصة كأساس وعدم الرجوع الشامل إلى نسخة قديمة.

## الملفات التي أعيدت لمسارها المرجعي فقط
1. `central_task_center.html`
2. `cloud-task-engine.js`
3. `platform-cloud-session.js`
4. `agent-core-v2.js`
5. `school-login.html`
6. `supabase/functions/platform-session/index.ts`

تم الإبقاء على إصلاح توافق قاعدة البيانات في `platform-session`: البحث في `schools.manager_email` فقط وعدم الاستعلام عن أعمدة غير موجودة.

## ملفات قلب دورة التكليف التي لم يتم تغييرها
- `supabase/functions/platform-tasks/index.ts` مطابق للنسخة المرجعية الناجحة ولم يجر تعديله.
- جداول ومسار `central_tasks`, `task_access_grants`, `central_task_updates`, `central_task_evidence`, `central_task_reviews`, `central_task_events` لم تُعد بناؤها أو تغييرها في هذا الدمج.

## اختبارات ما قبل التسليم
- فحص 54 ملف JavaScript خارجي: PASS.
- فحص 316 سكربت JavaScript مضمنًا داخل HTML (مع تجاهل script type=text/plain): PASS.
- جميع مراجع السكربتات المحلية داخل `central_task_center.html`: موجودة.
- Workflow يتضمن نشر `platform-session` و`platform-tasks`: PASS.
- تحقق نطاق التغيير مقابل النسخة الحالية: 6 ملفات فقط: PASS.
- محاكاة جلسة صالحة: PASS.
- محاكاة جلسة منتهية ثم `renew`: PASS.
- محاكاة طلب تكليف يعيد 401 ثم تجديد الجلسة وإعادة الطلب بنجاح: PASS.
- ربط نموذج إنشاء التكليف بـ `window.createTask` والمحول السحابي: موجود.

## حماية بقية التعديلات
جميع الملفات خارج القائمة الستة بقيت مطابقة للنسخة الحالية باختبار SHA-256، لذلك لم يتم التراجع عن تحديثات المدارس المستقلة، الجاهزية، الوكلاء، الانضباط الوظيفي، مركز المعلومات، المراسلات، أو بقية الأقسام.
