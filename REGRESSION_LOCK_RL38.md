# Regression Lock RL38 — مركز المعلومات المدرسي

النطاق: ملف واحد فقط `school_information_center.html`.

- استعادة منطق RL23 المستقر كمصدر سحابي موحد للطلاب والهيكل.
- منع إعادة بناء/توسيع الهيكل من قائمة الطلاب (`reconcileAcademicStructureFromStudents` لا يكتب الهيكل).
- إضافة/تحديث مرحلة لا تستبدل المراحل الأخرى؛ تحفظ المجموعة الكاملة ثم تعيد قراءتها من السحابة.
- عدد الفصول يُحفظ سحابيًا ويُعاد إلى القيمة السابقة عند فشل الحفظ.
- الطلاب يبقون في جدول الطلاب السحابي، والحذف صريح وناعم فقط.
- الإبقاء على عزل جلسة RL33: `platform-cloud-session.js?v=20260905-RL33-complete-tab-role-isolation` وعدم استخدام token من localStorage.
- لم يتم تعديل manager/agent/register/login أو دورة الموظف الإداري RL36/RL37 أو أي ملف آخر.
- Edge Function `school-information-structure` الحي هو أصلًا RL23 v4.0.0، لذلك لم يُنشر Backend جديد ولم تُمس البيانات.
