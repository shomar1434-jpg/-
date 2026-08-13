# مراجعة شاملة للعودة والصفحات الداخلية

- إجمالي صفحات HTML التي تم فحصها: **84**
- صفحات الأقسام/السجلات المرتبطة مباشرة بالأدوار التي خضعت لفحص زر العودة: **42**
- صفحات لديها زر/سهم عودة أصلي وتم الإبقاء عليه دون إضافة أي عنصر جديد: **16**
- صفحات لم يكن لديها زر عودة فعلي وتمت إضافة سهم عودة بجوار العنوان الرئيسي فقط: **26**
- صفحات HTML تشغيلية ما زالت محقونة حرفيًا داخل iframe: **0**

## قواعد التصحيح
1. حذف جميع أزرار/أشرطة العودة التي أضافها التصحيح السابق (`uwExplicitBack` / `uwStandaloneBack`).
2. عدم إضافة زر إذا كانت الصفحة تحتوي زرًا أو سهمًا أصليًا قابلًا للنقر للعودة/الرجوع/الرئيسية.
3. في الصفحات الناقصة فقط، إضافة سهم صغير بجوار العنوان الرئيسي بدل إنشاء شريط مستقل.
4. تحويل صفحات التشغيل التي كانت تُفتح داخل iframe أو panel إلى تنقل مباشر لصفحة كاملة.
5. تحويل نافذة «المتابعة وإدارة المستخدمين» في قسم المدير إلى واجهة كاملة الشاشة مع الإبقاء على زر الإغلاق الأصلي.
6. الإبقاء على معاينات PDF/الطباعة خارج هذه القاعدة.

## صفحات تم التأكد من عدم إضافة زر زائد إليها
- school_information_center.html
- performance_evaluation.html
- wakil-records.html
- manager.html

## الصفحات التي احتفظت بزر العودة الأصلي
- admin_employee_management.html
- administrative_employee_execution.html
- administrative_employee_improvement.html
- administrative_employee_library.html
- administrative_employee_plan.html
- deputy_weekly_teacher_followup.html
- external_evaluation_archive.html
- health_advisor_records_index.html
- health_advisor_weekly_tasks.html
- kindergarten_teacher_records_index.html
- kindergarten_teacher_weekly_tasks.html
- student_advisor_analysis_tool.html
- student_advisor_records.html
- teacher_records_index.html
- teacher_weekly_tasks.html
- wakil-records.html

## الصفحات التي أضيف لها سهم عودة بعد التحقق من عدم وجود زر أصلي
- activity_leader_records.html
- administrative_employee_evaluation.html
- agent_exams_management.html
- health_advisor_comprehensive_record.html
- health_advisor_data_analysis.html
- health_advisor_records_attendance.html
- health_advisor_records_participation.html
- health_advisor_records_student_work.html
- health_advisor_section_library.html
- kindergarten_teacher_comprehensive_record.html
- kindergarten_teacher_data_analysis.html
- kindergarten_teacher_records_attendance.html
- kindergarten_teacher_records_participation.html
- kindergarten_teacher_records_student_work.html
- kindergarten_teacher_section_library.html
- manager_exams_management.html
- manager_library_records.html
- manager_records.html
- self_evaluation_records.html
- student_followup_analysis_updated.html
- teacher_comprehensive_record.html
- teacher_data_analysis.html
- teacher_records_attendance.html
- teacher_records_participation.html
- teacher_records_student_work.html
- teacher_section_library.html

## فحص iframe
لا توجد صفحات HTML تشغيلية محقونة حرفيًا داخل iframe بعد التصحيح.
