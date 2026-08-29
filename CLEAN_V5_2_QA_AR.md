# Clean V5.2 — QA

- واجهة الأرشيف تعتمد PerformanceArchiveCleanV5 فقط ولا تعود إلى V3/V2.
- تعديل التقرير يعيد content إلى report-content-container داخل نفس manager.html.
- المعاينة بقيت مساراً منفصلاً للقراءة فقط.
- التقارير Legacy قابلة للاستعادة إلى نفس المحرر، وعند الحفظ تُكتب في المسار Clean بنفس الهوية دون حذف الأصل التاريخي.
- بدء تقرير جديد يصفر حالة التحرير السابقة.
- تم حفظ قيم select/input/textarea داخل snapshot قبل الأرشفة وإعادتها عند التحرير.
- معرفات التقارير النصية ذات underscore تُمرر للأزرار بين علامات اقتباس.
- JavaScript syntax: PASS (66 script blocks / 0 errors).
