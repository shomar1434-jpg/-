V39 FINAL REFERENCE FIX

تم تنفيذ تصحيح جذري ونهائي لمشكلة 404 الخاصة بسجلات الوكيل على GitHub Pages.

الإصلاحات:
- تثبيت ملف wakil-records.html داخل:
  records/wakil/wakil-records.html

- تحويل جميع المسارات إلى:
  ./records/wakil/wakil-records.html

- منع استخدام المسارات المطلقة /records/... التي تسبب 404 في GitHub Pages.

- إضافة fallback ذكي يقوم بإصلاح أي iframe أو نافذة أو رابط يتم توليده ديناميكياً أثناء تشغيل المنصة.

هذه النسخة مهيأة لتكون النسخة المرجعية الرسمية للرفع على GitHub Pages.
