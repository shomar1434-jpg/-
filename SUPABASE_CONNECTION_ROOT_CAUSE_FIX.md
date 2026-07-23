# إصلاح السبب الجذري لاتصال Supabase

## الخطأ المكتشف
- ملف `supabase-setup.html` يحفظ الإعدادات في `smartSchoolSupabaseUrl` و`smartSchoolSupabaseAnonKey`.
- ملفا `index.html` و`school-login.html` كانا يتجاهلان الإعدادات المحفوظة ويستخدمان مفتاح `sb_publishable_...` ثابتًا مختلفًا.
- هذا التعارض أدى إلى `TypeError: Failed to fetch` عند تحميل المدارس وحفظها.

## التصحيح
- توحيد مصدر الإعدادات في الصفحتين.
- قراءة رابط المشروع ومفتاح anon من localStorage أولًا.
- استخدام مفتاح anon الاحتياطي المطابق لنفس project ref عند عدم وجود إعداد محفوظ.
- لم يتم تغيير منطق عزل المدارس أو روابطها الفريدة.
