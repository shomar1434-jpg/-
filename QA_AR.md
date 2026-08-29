# فحص تصحيح معاينة أرشيف التقويم الذاتي — Print Exact V3

## أصل المشكلة
الإصدار السابق كان يبني htmlContent من #app main كاملًا، لذلك كانت المعاينة تمثل منطقة المتصفح أكثر من تمثيلها للمستند الذي يذهب إلى الطابعة.

## التصحيح
- buildArchivePrintSnapshot(title,type) أصبح يحدد مصدر الطباعة الفعلي حسب نوع السجل.
- واقع المدرسة: .actual-reality-sheet.
- قرار اللجان/الفرق/المجالس: .committee-print-sheet.
- الاجتماعات: بطاقة الاجتماع القابلة للطباعة داخل .committee-print-root.
- بقية النماذج: .print-card داخل التبويب النشط، وليس #app main كاملًا.
- يتم تحويل input/textarea/select إلى قيم ثابتة للقراءة فقط قبل الحفظ.
- يتم جمع قواعد @media print وتطبيقها داخل مستند المعاينة على الشاشة حتى تكون المعاينة مطابقة للطباعة قدر الإمكان.
- archiveFormat الجديد: print-snapshot-v3-exact.
- سجلات الوحدة الثانية self_evaluation_record أصبحت تحفظ htmlContent من .recordShell.officialRecord باستخدام نفس قواعد الطباعة.

## التوافق مع السجلات السابقة
manager.html يحتوي upgradeLegacySelfPrintSnapshot لمعالجة print-snapshot-v2 عند المعاينة دون حذف السجل القديم أو تغيير بياناته.

## عدم التراجع
- تعديل السجل ما زال يستخدم نفس id عند إعادة الحفظ.
- الحذف السحابي و rollback لم يتم تغييرهما.
- أزرار تعديل / معاينة / حذف لم يتم تغييرها.
- العزل scope=school لم يتم تغييره.

## فحص JavaScript
- manager.html: 27 كتلة JavaScript مضمّنة، 0 أخطاء Syntax.
- self_evaluation_records.html: 5 كتل خارجية، 0 أخطاء Syntax.
- تطبيق srcdoc الداخلي: 1 كتلة رئيسية، 0 أخطاء Syntax.
