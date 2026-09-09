-- ربط السجلات الفعلية بمركز التكليفات ودعم بوابة الدور الكامل
-- إضافة فقط؛ لا حذف ولا تنظيف لأي بيانات حالية.
begin;

insert into public.platform_modules(module_key,display_name,owner_role,route_url,is_active) values
('deputy_shared_records','السجلات المشتركة للوكيل','deputy','wakil-records.html',true),
('delegated_roles','الأدوار الكاملة المفوضة','shared','central_task_center.html',true)
on conflict(module_key) do update set
 display_name=excluded.display_name,
 owner_role=excluded.owner_role,
 route_url=excluded.route_url,
 is_active=true;

insert into public.platform_record_types
(module_key,record_type,display_name,route_url,is_assignable,supports_files,supports_approval,supports_analysis,configuration_json)
values
('manager_records','canonical_record','سجل المدير الفعلي','manager_records.html',true,true,true,true,'{"dynamic_source":"manager_records.html","record_id_required":true,"owner":"manager"}'::jsonb),
('academic_affairs','canonical_record','سجل الشؤون التعليمية الفعلي','wakil-records.html',true,true,true,true,'{"dynamic_source":"wakil-records.html","agency_type":"educational","record_id_required":true,"owner":"agent"}'::jsonb),
('school_operations','canonical_record','سجل الشؤون المدرسية الفعلي','wakil-records.html',true,true,true,true,'{"dynamic_source":"wakil-records.html","agency_type":"school_affairs","record_id_required":true,"owner":"agent"}'::jsonb),
('student_affairs','canonical_record','سجل شؤون الطلاب الفعلي','wakil-records.html',true,true,true,true,'{"dynamic_source":"wakil-records.html","agency_type":"student_affairs","record_id_required":true,"owner":"agent"}'::jsonb),
('deputy_shared_records','canonical_record','سجل الوكيل المشترك الفعلي','wakil-records.html',true,true,true,true,'{"dynamic_source":"wakil-records.html","agency_type":"shared","record_id_required":true,"owner":"agent"}'::jsonb),
('delegated_roles','full_role_portal','بوابة دور كامل مفوض','central_task_center.html',true,true,true,true,'{"delegation_mode":"full_role","single_assignee":true,"record_id_is_role_code":true}'::jsonb)
on conflict(module_key,record_type) do update set
 display_name=excluded.display_name,
 route_url=excluded.route_url,
 is_assignable=true,
 supports_files=true,
 supports_approval=true,
 supports_analysis=true,
 configuration_json=coalesce(public.platform_record_types.configuration_json,'{}'::jsonb)||excluded.configuration_json;

commit;
