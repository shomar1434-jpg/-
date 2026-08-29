# QA — فصل سياق مدير النظام عن المدارس المستقلة

## نتائج فحص JavaScript
- index-app.js: **PASS** 
- platform-cloud-session.js: **PASS** 
- system-admin-context.js: **PASS** 
- student_advisor.html: **PASS** 25 inline blocks; errors=0
- health_advisor.html: **PASS** 21 inline blocks; errors=0
- kindergarten_teacher.html: **PASS** 20 inline blocks; errors=0
- activity_leader.html: **PASS** 24 inline blocks; errors=0
- teacher.html: **PASS** 19 inline blocks; errors=0

## اختبارات منطقية
- admin_launch_all_sections_explicit_mode: **PASS**
- admin_path_does_not_write_currentRole: **PASS**
- cloud_token_hidden_in_admin_context: **PASS**
- cloud_ensure_blocked_in_admin_context: **PASS**
- teacher.html_dual_verify: **PASS**
- student_advisor.html_dual_verify: **PASS**
- health_advisor.html_dual_verify: **PASS**
- kindergarten_teacher.html_dual_verify: **PASS**
- activity_leader.html_dual_verify: **PASS**

## نطاق الحزمة
- index-app.js: فتح أقسام مدير النظام بسياق system_admin صريح ومنع الكتابة على سياق المدرسة المشترك.
- platform-cloud-session.js: تجاهل كامل لجلسة المدرسة أثناء سياق مدير النظام دون حذفها، حتى لا تتأثر مدرسة مفتوحة في تبويب/نافذة أخرى.
- teacher.html + student_advisor.html + health_advisor.html + kindergarten_teacher.html + activity_leader.html: تحقق مزدوج System Admin / School Member.
- system-admin-context.js: مرفق من النسخة المرجعية لضمان التطابق في النشر.

لم يتم تعديل manager.html لأنه يحتوي بالفعل مسار System Admin موثق، ولم يتم تعديل administrative_employee_portal.html لأنه يحتوي وضع system_admin مستقل. ولم يتم تعديل agent.html في هذه الحزمة لأن حارس التدفق لديه يتجاهل أصلًا systemAdmin ولا يملك حارس العضوية الصارم الذي سبب المشكلة الحالية.