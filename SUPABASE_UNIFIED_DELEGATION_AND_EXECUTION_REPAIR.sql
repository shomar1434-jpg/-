-- توحيد صلاحيات التفويض لجميع السجلات والأدوار + دورة حياة التنفيذ
-- آمن على البيانات: لا يحذف التكليفات أو السجلات.
begin;

-- 1) إنهاء أي صلاحيات مرتبطة بتكليفات انتهت/أوقفت.
update public.task_access_grants g
set status='revoked'
from public.central_tasks t
where g.task_id=t.id
  and g.status='active'
  and (t.deleted_at is not null or t.status in ('approved','rejected','withdrawn','archived','closed','canceled'));

update public.central_task_assignments a
set is_current=false,
    ended_at=coalesce(a.ended_at,now())
from public.central_tasks t
where a.task_id=t.id
  and a.is_current=true
  and (t.deleted_at is not null or t.status in ('approved','rejected','withdrawn','archived','closed','canceled'));

-- 2) تاريخ الاستحقاق ليس تاريخ انتهاء صلاحية. يبقى الوصول حتى إيقاف/إنهاء التكليف.
update public.task_access_grants g
set expires_at=null
from public.central_tasks t
where g.task_id=t.id
  and g.status='active'
  and t.deleted_at is null
  and t.status in ('active','in_progress','transferred','returned');

-- 3) إلغاء الصلاحيات النشطة القديمة التي لا تخص المكلف الحالي بعد نقل التكليف.
update public.task_access_grants g
set status='revoked'
from public.central_tasks t
where g.task_id=t.id
  and g.status='active'
  and t.deleted_at is null
  and t.status in ('active','in_progress','transferred','returned')
  and not (
    (g.user_id is not null and t.assigned_to is not null and g.user_id=t.assigned_to)
    or (nullif(lower(g.user_email),'') is not null and nullif(lower(t.assignee_email),'') is not null and lower(g.user_email)=lower(t.assignee_email))
  );

-- 4) إنشاء صلاحية دقيقة لكل سجل مرتبط بالتكليف، بصرف النظر عن مالك السجل أو دور المكلف.
insert into public.task_access_grants (
  school_id, task_id, user_id, user_email,
  module_key, record_type, record_id, permission_scope,
  can_view, can_create, can_update, can_upload, can_submit, can_approve, can_delete,
  starts_at, expires_at, status, granted_by
)
select
  t.school_id,t.id,t.assigned_to,t.assignee_email,
  l.module_key,l.record_type,l.record_id,'record',
  true,
  coalesce(base.can_create,true),coalesce(base.can_update,true),coalesce(base.can_upload,true),coalesce(base.can_submit,true),
  coalesce(base.can_approve,false),coalesce(base.can_delete,false),
  coalesce(base.starts_at,t.created_at,now()),null,'active',coalesce(base.granted_by,t.created_by)
from public.central_tasks t
join public.task_record_links l on l.task_id=t.id and l.school_id=t.school_id
left join lateral (
  select g.* from public.task_access_grants g
  where g.task_id=t.id
  order by (g.status='active') desc,g.created_at desc
  limit 1
) base on true
where t.deleted_at is null
  and t.status in ('active','in_progress','transferred','returned')
  and coalesce(t.metadata->>'legacy_archived','false')<>'true'
  and (t.assigned_to is not null or nullif(lower(t.assignee_email),'') is not null)
  and not exists (
    select 1 from public.task_access_grants x
    where x.task_id=t.id and x.status='active' and x.can_view=true
      and x.module_key=l.module_key
      and coalesce(x.record_type,'')=coalesce(l.record_type,'')
      and coalesce(x.record_id,'')=coalesce(l.record_id,'')
      and ((t.assigned_to is not null and x.user_id=t.assigned_to)
        or (nullif(lower(t.assignee_email),'') is not null and lower(coalesce(x.user_email,''))=lower(t.assignee_email)))
  );

commit;

-- تحقق: كل رابط سجل لتكليف قابل للتنفيذ يجب أن يملك grant نشطًا للمكلف الحالي.
select
  t.id task_id,t.title,t.status,t.assignee_name,
  l.module_key,l.record_type,l.record_id,
  bool_or(g.status='active' and g.can_view=true) as has_active_grant
from public.central_tasks t
join public.task_record_links l on l.task_id=t.id
left join public.task_access_grants g
  on g.task_id=t.id
 and g.module_key=l.module_key
 and coalesce(g.record_type,'')=coalesce(l.record_type,'')
 and coalesce(g.record_id,'')=coalesce(l.record_id,'')
 and ((t.assigned_to is not null and g.user_id=t.assigned_to)
   or (nullif(lower(t.assignee_email),'') is not null and lower(coalesce(g.user_email,''))=lower(t.assignee_email)))
where t.deleted_at is null
  and t.status in ('active','in_progress','transferred','returned')
group by t.id,t.title,t.status,t.assignee_name,l.module_key,l.record_type,l.record_id
order by t.updated_at desc;
