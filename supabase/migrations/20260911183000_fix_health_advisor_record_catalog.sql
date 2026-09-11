-- تصحيح غير هدّام: فصل سجل الموجه الصحي الشامل عن سجل المعلم الشامل
-- وإكمال تسجيل سجلات الموجه الصحي اللازمة لتكليف الدور الكامل.
begin;

insert into public.platform_modules (module_key, display_name, is_active)
values ('health_advisor_records','سجلات الموجه الصحي',true)
on conflict (module_key) do update
set display_name = excluded.display_name,
    is_active = excluded.is_active;

insert into public.platform_record_types
(module_key,record_type,display_name,route_url,owner_role,owner_section,record_group_key,record_group_name,
 is_assignable,supports_files,supports_approval,supports_analysis,is_active,configuration_json)
values
('health_advisor_records','health_advisor_comprehensive_record','سجل الموجه الصحي الشامل','health_advisor_comprehensive_record.html','health_advisor',null,null,null,true,true,true,true,true,
 '{"owner":"health_advisor","permission_scope":"module","aliases":[]}'::jsonb),
('health_advisor_records','student_attendance_record','سجل حضور الطلاب','health_advisor_records_attendance.html','health_advisor',null,null,null,true,true,true,true,true,
 '{"owner":"health_advisor","permission_scope":"module","aliases":[]}'::jsonb),
('health_advisor_records','student_participation_record','سجل المشاركة الصفية','health_advisor_records_participation.html','health_advisor',null,null,null,true,true,true,true,true,
 '{"owner":"health_advisor","permission_scope":"module","aliases":[]}'::jsonb),
('health_advisor_records','student_work_record','سجل أعمال الطلاب','health_advisor_records_student_work.html','health_advisor',null,null,null,true,true,true,true,true,
 '{"owner":"health_advisor","permission_scope":"module","aliases":[]}'::jsonb)
on conflict (module_key,record_type) do update
set display_name=excluded.display_name,
    route_url=excluded.route_url,
    owner_role=excluded.owner_role,
    owner_section=excluded.owner_section,
    record_group_key=excluded.record_group_key,
    record_group_name=excluded.record_group_name,
    is_assignable=excluded.is_assignable,
    supports_files=excluded.supports_files,
    supports_approval=excluded.supports_approval,
    supports_analysis=excluded.supports_analysis,
    is_active=excluded.is_active,
    configuration_json=excluded.configuration_json;

-- إذا كان تعريف خاطئ قد أُضيف سابقًا، لا نحذف أي بيانات أو سجلات محفوظة.
-- فقط نعطل تعريف التكليف الخاطئ الخاص بسجل المعلم داخل وحدة الموجه الصحي.
update public.platform_record_types
set is_active = false,
    is_assignable = false,
    configuration_json = coalesce(configuration_json,'{}'::jsonb) || '{"deprecated_reason":"teacher comprehensive record is restricted to teacher/kindergarten teacher sections"}'::jsonb
where module_key='health_advisor_records'
  and record_type='teacher_comprehensive_record';

commit;
