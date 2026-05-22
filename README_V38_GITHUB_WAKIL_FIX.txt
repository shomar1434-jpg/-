تم تنفيذ V38:
- إصلاح مسار iframe الخاص بسجلات الوكيل ليكون:
  ./records/wakil/wakil-records.html
- التأكد من وجود الملف في:
  records/wakil/wakil-records.html
- إضافة fallback يمنع استخدام المسار المطلق /records/... على GitHub Pages.
سبب الخطأ السابق: GitHub Pages يعتبر /records مسارًا من جذر github.io وليس من داخل مجلد المشروع، فيظهر 404.
