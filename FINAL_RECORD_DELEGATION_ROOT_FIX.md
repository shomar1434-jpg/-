# إصلاح جذري لربط التكليف بالسجلات

- السجل المحدد أصبح يُحفظ صراحة داخل delegatedRecords.
- مجموعات السجلات تُعاد بناؤها من platform_record_types حسب record_group_key و owner_section.
- روابط record العامة القديمة يتم تجاهلها.
- Platform Core يصلح التكليفات القديمة عند فتح مساحة التكليف.
- لا يوجد SQL جديد. يجب نشر platform-core و platform-tasks.
