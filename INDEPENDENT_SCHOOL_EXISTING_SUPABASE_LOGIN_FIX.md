# إصلاح دخول المدارس المستقلة الموجودة سابقًا على Supabase

## نطاق التصحيح
تم التصحيح داخل `school-login.html` فقط للحفاظ على بنية المنصة وعدم التأثير على الأقسام الأخرى.

## المشكلة
الحسابات القديمة المرتبطة بمدارس موجودة على Supabase قد لا تدخل بسبب اعتماد محرك الدخول السابق على تطابق ضيق جدًا:
- البحث في جدول `users` بشرط `email + password` فقط.
- حصر دور المدير في `manager` فقط.
- عدم دعم الحسابات القديمة المرتبطة عبر `school_members` أو `schools.manager_email`.
- عدم دعم بعض أسماء حقول كلمات المرور القديمة.
- عدم دعم حسابات Supabase Auth عند عدم وجود كلمة المرور داخل جدول `users`.

## ما تم إصلاحه
1. دعم تسجيل الدخول عبر Supabase Auth أولًا عند توفره.
2. دعم جدول `users` مع مقارنة كلمة المرور من عدة حقول متوافقة:
   - `password`
   - `pass`
   - `manager_password`
   - `school_password`
   - `login_password`
   - `temp_password`
   - `default_password`
   - `pin`
   - `code`
   - `access_code`
3. دعم ربط المدارس القديمة عبر:
   - `users.school_id`
   - `school_members.school_id`
   - `schools.manager_email`
   - `schools.principal_email`
   - `schools.admin_email`
   - `schools.owner_email`
4. دعم أدوار المدير القديمة والجديدة:
   - `manager`
   - `school_manager`
   - `principal`
   - `admin`
   - `owner`
   - `مدير / مديرة / مدير المدرسة`
5. عدم منع الدخول بسبب اختلاف بسيط في الحالة إلا في الحالات المعطلة أو المحذوفة.
6. الحفاظ على التوجيه حسب الدور بعد نجاح الدخول.

## نتيجة الفحص الفني
تم فحص سكربتات `school-login.html` نحويًا عبر Node، ولا توجد أخطاء JavaScript Syntax.

## ملاحظة مهمة
هذا التصحيح لا يغير بنية قاعدة البيانات ولا ينشئ جداول جديدة. هو فقط يجعل واجهة الدخول تقرأ الحسابات القديمة والجديدة بمرونة أكبر.
