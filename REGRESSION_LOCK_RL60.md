# RL60 — تثبيت جلسة المعلم من بوابة المدرسة المستقلة

## التشخيص
بعد RL59 أصبحت صفحة school-login تحفظ دور المعلم كـ `teacher`.
لكن `platform-cloud-session.js` كان يتحقق من العضوية بشرط مساواة الدور حرفياً:
`normalizeRole(m.role) === normalizeRole(current.role)`.

بعض حسابات المعلمين القديمة تظهر في عضوية الخادم بالدور legacy `performance`.
لذلك:
- جلسة التبويب = teacher
- عضوية الخادم = performance
- نفس school_id + نفس user_id
- لكن التحقق يرفض بسبب اختلاف اسم الدور فقط.

بعد ذلك كانت بوابة teacher RL55 تعيد المستخدم إلى:
`school-login.html?reason=teacher_access_denied`
من دون schoolId، فتظهر بوابة مدارس مستقلة عامة غير مرتبطة بمدرسة.

## التصحيح
1. `platform-cloud-session.js`
   - مطابقة الدور أصبحت alias-aware للعضوية نفسها فقط.
   - teacher يقبل membership legacy `performance` مع بقاء school_id + user_id مطابقين تماماً.
   - بعد التحقق يثبت دور التبويب canonical كـ `teacher`.
   - لا توسعة لأي مدرسة أو مستخدم أو دور آخر.

2. `teacher.html`
   - بوابة RL55 تقبل `performance` كاسم legacy لدور المعلم فقط.
   - عند الرفض الحقيقي، رابط العودة يحتفظ بـ schoolId واسم المدرسة ولا يعود إلى بوابة عامة.
   - بقي teacher.html على بنية RL58 السليمة قبل RL48؛ لا عودة لمشكلة الومضة/الأرشيف.

## لم يتغير
- لا تعديل على Supabase data.
- لا حذف/نسخ للتقارير.
- لا تعديل على PerformanceArchiveCleanV5.
- لا تعديل على RL48 وما بعده.
- لا تغيير في عزل المدرسة والمستخدم.

الملفان المعدلان فقط:
- platform-cloud-session.js
- teacher.html

ويجب إبقاء school-login.html من RL59 كما هو.
