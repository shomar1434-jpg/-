# RL70 — السبب الفعلي المؤكد لاختفاء شاشة الموظف الإداري بعد ظهورها

الملاحظة الحاسمة من اختبار RL69:
صفحة admin_employee_management.html تظهر للحظة ثم تختفي.

تتبع جميع السكربتات التي تحملها الصفحة كشف أن platform-cloud-session.js (RL33)
يحتوي routeRequiredRole() بهذه القاعدة العامة:

[/^administrative_employee|^admin_employee/, 'administrative_employee']

وبالتالي admin_employee_management.html تُصنّف كصفحة دور administrative_employee،
رغم أنها صفحة إشراف يفتحها manager أو agent.

بعد DOMContentLoaded ينفذ enforceRouteRole():
- المدير/الوكيل لا يطابق administrative_employee.
- يضع data-platform-role-denied.
- ثم location.replace() إلى ROLE_ROOT للدور الحالي.
- لذلك تظهر الصفحة أولاً ثم تختفي؛ وهذا يطابق الاختبار الفعلي حرفياً.

لماذا RL69 لم ينجح رغم تحميل session-v12 داخل الصفحة؟
لأن المنصة الحالية تحمل/تعيد حقن عقد RL33 عبر طبقات الجلسة/المساحة الحالية،
والتصحيح الصحيح ليس إرجاع الصفحة، بل إصلاح مصنف المسار المركزي نفسه.

RL70:
- يبقي نظام عزل RL33 كاملاً.
- يضيف استثناءً وحيداً لـ admin_employee_management.html:
  supervisor=manager => required role manager
  supervisor=agent => required role agent
- إذا لم يوجد supervisor يستخدم الدور الحالي manager/agent.
- بقية administrative_employee*.html تبقى محمية بدور administrative_employee.
- لا تخفيف لعزل المدارس، ولا localStorage authority، ولا تغيير Supabase.

الملفات:
1. platform-cloud-session.js — التصحيح الفعلي.
2. admin_employee_management.html — نسخة RL68 المتوافقة مع supervisor/school context.
