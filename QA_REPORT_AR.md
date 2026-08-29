# تقرير QA — Performance Clean V3 + Manager Records Pilot V1

## تقارير الأداء الوظيفي
- تم تعميم المحرك الجديد على 8 واجهات: manager, agent, teacher, student_advisor, student_advisor_analysis_tool, activity_leader, health_advisor, kindergarten_teacher.
- مفتاح جديد مستقل لكل قسم بصيغة `<role>_performance_reports_clean_v3`.
- جميع الكتابات الجديدة `scope=school` ولا تستخدم `school_reports` أو `reports_archive` للكتابة.
- المفاتيح القديمة تقرأ فقط عند فتح الأرشيف لعرض التقارير التاريخية.
- Fast Path: الحفظ يقرأ المفتاح الجديد فقط قبل/بعد الكتابة ولا ينتظر تحميل Legacy.
- اختبار محاكاة: تم فرض تأخير 700ms على قراءة Legacy؛ الحفظ الجديد لم يتأثر، بينما تأخر فتح Legacy فقط.
- تم تعطيل اسم دالة الحفظ القديمة بحيث لا تكون مسار التنفيذ النشط.
- تم إزالة سكربت STABLE_PERFORMANCE_ARCHIVE_V10 من الصفحات التي كان مستقلاً فيها.
- فحص JavaScript: جميع الصفحات الجديدة اجتازت syntax check، باستثناء خطأين قديمين موجودين أصلًا في agent.html ولم يضيفهما هذا التصحيح (embedded-agent-template-base64 و RECORDS_ARCHIVE_ENGINE).

## سجلات المدير — Pilot V1
- مفتاح جديد: `manager_records_clean_v1`.
- المسارات القديمة `manager_records_archive_v2` و `school_manager_records_archive_v1` للقراءة فقط.
- الحفظ الجديد Cloud-only ولا يكتب الأرشيف في localStorage.
- التوجيه للمجلد يعتمد `folderId=current.id` و `folderName=current.title`.
- بعد الكتابة تتم إعادة قراءة المفتاح الجديد والتحقق من `id + folderId` قبل النجاح.
- المعاينة لا تملأ النموذج؛ التعديل وحده يعيد السجل للنموذج.
- السجلات التاريخية لا تُحذف أو تعدل من المحرك الجديد.
- اختبار محاكاة: تم فرض تأخير 500ms على Legacy؛ الحفظ الجديد لم ينتظر Legacy.
- manager_records.html اجتاز فحص JavaScript بالكامل.

## قواعد الحماية
- لا حذف لأي بيانات قديمة من Supabase.
- لا كتابة إلى المفاتيح التاريخية من المحركات الجديدة.
- لا تعميم لمسار السجلات حتى ينجح Pilot المدير حيًا.
