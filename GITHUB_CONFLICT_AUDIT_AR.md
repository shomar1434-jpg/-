# تدقيق تعارضات GitHub

لم تتوفر وصلة GitHub مصادق عليها تسمح بالحذف المباشر من المستودع في هذه الجلسة، لذلك لم يتم الادعاء بحذف أي ملف عن بعد.

## ما تم تعطيله/إزالته داخل الملفات المسلمة
- تعطيل الدوال النشطة القديمة `saveReportToArchive` وإسناد المسار التنفيذي للمحرك Clean V3 فقط.
- إزالة سكربت `STABLE_PERFORMANCE_ARCHIVE_V10` المستقل من واجهات الأداء التي كان موجودًا فيها.
- إبقاء مفاتيح Legacy للقراءة فقط، وعدم حذف بياناتها.
- في manager_records.html تم تعطيل مسار `saveArchive/toggleArchive/renderArchive/restoreArchive/editArchive/deleteArchive` القديم وتثبيت Clean V1 كمسار واجهة فعلي.

## ملفات لا يجب حذفها من GitHub دون Dependency Scan
- `platform-persistence-guard.js`
- `platform-state-engine.js`
- `platform-record-registry.js`
- `section-records-repository.js`
- `performance-file-engine.js`

هذه ملفات مشتركة وتستخدمها أقسام أخرى؛ حذفها لمجرد الاشتباه قد يسبب Regression واسع. `performance-file-engine.js` يقرأ أرشيفات محلية لأغراض التجميع/العرض لكنه لم يثبت ككاتب لمسار Clean V3؛ لذلك لم يتم حذفه.

## عند توفر اتصال GitHub
يجب البحث عن نسخ/ملفات Patch قديمة تضيف أو تعيد حقن:
- `STABLE_PERFORMANCE_ARCHIVE_V10`
- `PERFORMANCE_ARCHIVE_CANONICAL_V6`
- `PERFORMANCE_ARCHIVE_FOLDER_V8`
- `STABLE_PERFORMANCE_ARCHIVE_V9/V10`
- أي سكربت يعيد تعريف `saveReportToArchive` بعد Clean V3
- أي سكربت يعيد تعريف `saveArchive` في manager_records.html بعد Clean V1
ثم حذف/تعطيل النسخ التي يثبت عدم وجود مستهلك حي لها.
