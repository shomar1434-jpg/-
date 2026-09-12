تصحيح ظهور خطط الموظفين الإداريين لدى المسؤول المباشر — 2026-09-12

السبب الجذري:
- خطة الموظف الإداري تُحفظ مرجعيًا في module: admin_employee_records / recordType: admin_plan.
- شاشة المسؤول كانت تعتمد أساسًا على مرآة قديمة في admin_performance / administrative_employee_plans.
- إذا لم تُكتب المرآة أو تأخرت مزامنتها، تبقى الخطة محفوظة سحابيًا ولكن لا تظهر للمسؤول.

التصحيح العام:
1) admin_employee_management.html
   - قراءة السجل المرجعي admin_employee_records لكل موظفي المسؤول المباشر.
   - استخدامه كمسار استرداد عند غياب المرآة القديمة.
   - إبقاء المرآة القديمة أولوية بعد الاعتماد/الإعادة للمحافظة على دورة العمل الحالية.
2) administrative_employee_plan.html
   - محاولة مزامنة المرآة الثانوية صراحة بعد الحفظ المرجعي، دون اعتبار فشل المرآة فقدًا للخطة المرجعية.
3) supabase/functions/platform-state/index.ts
   - السماح للمسؤول المباشر فقط بقراءة admin_employee_records لموظفيه داخل نفس المدرسة.
   - التصفية مستمرة بواسطة school_id + school_members + supervisor_user_id.

الحماية:
- لا توجد قراءة بين المدارس.
- لا يسمح المدير/الوكيل بقراءة موظف إداري لا يتبعه.
- لا حذف أو ترحيل للبيانات القديمة.
- الخطط القديمة في admin_performance تبقى مدعومة.

النشر:
- platform-state موجود أصلًا في .github/workflows/deploy-supabase-functions.yml ضمن on.push.paths وخطوة النشر المركزية، لذلك لا يلزم تعديل workflow إضافي.
