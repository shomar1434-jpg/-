# RL36 — العقد النهائي لروابط المدارس المستقلة

## المسارات المعتمدة
1. دخول مستخدمي المدرسة: `school-login.html` مع `schoolId/schoolCode` موثقين من رابط المدرسة.
2. تسجيل مستخدمي المدرسة: `register.html` من رابط يصدره المدير فقط. الرابط يحمل `generalRegistrationToken` موقعاً ومؤقتاً.
3. تسجيل الموظف الإداري: من `admin_employee_management.html?supervisor=manager|agent` ويولد رابطاً موقعاً مربوطاً بـ `school_id + supervisor_user_id + supervisor_role`.
4. دخول الموظف الإداري: `administrative_employee_login.html` مربوط بالمدرسة؛ لا يقبل إلا دور `administrative_employee` المفعّل.

## أقفال العزل
- الوكيل لا يملك زر أو دالة لإنشاء رابط تسجيل مستخدمين عام.
- الخادم يرفض التسجيل العام ما لم يكن الرابط موقعاً من جلسة مدير فعالة.
- تسجيل الموظف الإداري يتطلب رمز المشرف الموقع، ويربط `supervisor_user_id` بالمستخدم.
- تفعيل/تعطيل الموظف وخططه يمر عبر تحقق المشرف المالك في `platform-state/platform-directory`.
- إدارة الموظف لا تستنتج الدور أو المدرسة من `localStorage` العام.
- رابط دخول الموظف لا يغير المشرف ولا يمنح صلاحية إشراف؛ هو فقط بوابة دخول مدرسية بعد التفعيل.

## QA
- Inline JavaScript: 0 syntax errors in all 6 HTML files.
- `platform-directory/index.ts`: syntax parse passed.
- Agent generic registration references: 0.
- Manager general registration requires signed manager token.
