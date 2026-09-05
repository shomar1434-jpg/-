# RL57B — استرجاع مجلدات أرشيف الأداء وإلغاء رجوع RL57

السبب المؤكد لاختفاء المجلدات:
RL57 استبدل `openArchiveView()` بدل الاكتفاء بتأجيل Bootstrap، فتغير مسار العرض الذي كان مستقراً في RL56.

التنفيذ:
- البناء من RL56 مباشرة.
- إلغاء تعديلات RL57 على openArchiveView وenterApp وfast-init وجدولة requestIdleCallback.
- الإبقاء فقط على تعطيل Bootstrap عند DOMContentLoaded.
- فتح الأرشيف ما زال يستدعي `teacherPerformanceArchiveBootstrap(false)`.
- bootstrap الأصلي ما زال يعيد `renderArchiveFolders()` أو المجلد المفتوح بعد اكتمال القراءة.
- RL55 وRL56 محفوظان.
- لا تغيير في بيانات أو مفاتيح أو حفظ/حذف تقارير الأداء.
- لا تغيير في school_id/user_id/role أو Backend.

الملف المعدل فقط: teacher.html
