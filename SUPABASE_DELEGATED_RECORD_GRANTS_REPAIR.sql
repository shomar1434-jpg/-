-- إصلاح صلاحيات السجلات المفوضة الحالية والجديدة
-- لا يحذف بيانات، ويضيف صلاحية دقيقة لكل سجل مرتبط بتكليف نشط.
begin;

insert into public.task_access_grants (
  school_id, task_id, user_id, user_email,
  module_key, record_type, record_id, permission_scope,
  can_view, can_create, can_update, can_upload, can_submit, can_approve, can_delete,
  starts_at, expires_at, status, granted_by
)
select
  t.school_id,
  t.id,
  t.assigned_to,
  t.assignee_email,
  l.module_key,
  l.record_type,
  l.record_id,
  'record',
  true,
  coalesce(base.can_create,true),
  coalesce(base.can_update,true),
  coalesce(base.can_upload,true),
  coalesce(base.can_submit,true),
  coalesce(base.can_approve,false),
  coalesce(base.can_delete,false),
  coalesce(base.starts_at, t.start_date::timestamptz, t.created_at, now()),
  coalesce(base.expires_at, case when t.due_date is not null then (t.due_date::date + time '23:59:59')::timestamptz end),
  'active',
  coalesce(base.granted_by,t.created_by)
from public.central_tasks t
join public.task_record_links l on l.task_id=t.id and l.school_id=t.school_id
left join lateral (
  select g.*
  from public.task_access_grants g
  where g.task_id=t.id and g.status='active'
  order by g.created_at desc
  limit 1
) base on true
where t.deleted_at is null
  and t.status in ('active','in_progress','transferred','pending_approval','returned')
  and coalesce(t.metadata->>'legacy_archived','false') <> 'true'
  and (t.assigned_to is not null or nullif(lower(t.assignee_email),'') is not null)
  and not exists (
    select 1
    from public.task_access_grants x
    where x.task_id=t.id
      and x.status='active'
      and x.can_view=true
      and x.module_key=l.module_key
      and x.record_type=l.record_type
      and coalesce(x.record_id,'')=coalesce(l.record_id,'')
      and (x.user_id=t.assigned_to or (x.user_id is null and t.assigned_to is null))
      and coalesce(lower(x.user_email),'')=coalesce(lower(t.assignee_email),'')
  );

commit;

-- تحقق: يجب أن تظهر السجلات المفوضة مع صلاحية can_view=true
select
  t.id as task_id,
  t.title,
  t.assignee_name,
  l.module_key,
  l.record_type,
  g.permission_scope,
  g.can_view,
  g.status
from public.central_tasks t
join public.task_record_links l on l.task_id=t.id
left join public.task_access_grants g
  on g.task_id=t.id
 and g.module_key=l.module_key
 and g.record_type=l.record_type
 and coalesce(g.record_id,'')=coalesce(l.record_id,'')
 and g.status='active'
where t.deleted_at is null
  and t.status in ('active','in_progress','transferred','pending_approval','returned')
order by t.updated_at desc, l.created_at desc
limit 100;
