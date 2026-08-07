-- Final task delegation integrity repair
-- Preserves record work/history, prevents cross-owner record mixing, and soft-deletes tasks only.
begin;

alter table public.central_tasks
  add column if not exists deleted_by uuid null;

create index if not exists idx_central_tasks_deleted_at
  on public.central_tasks(school_id, deleted_at, updated_at desc);

-- Rebuild active delegated links only from exact catalog identities stored in task metadata.
-- This repair is deliberately strict: records that do not match the registered owner/section/group are not linked.
with repair_tasks as (
  select t.id, t.school_id, t.created_by, t.assigned_to, t.assignee_email,
         t.start_date, t.metadata, t.source_owner
  from public.central_tasks t
  where t.deleted_at is null
    and t.status in ('active','in_progress','transferred','returned','pending_approval')
    and jsonb_typeof(t.metadata->'delegatedRecords') = 'array'
), valid_records as (
  select rt.id as task_id, rt.school_id, rt.created_by, rt.assigned_to, rt.assignee_email,
         rt.start_date,
         p.module_key, p.record_type,
         p.owner_section, p.record_group_key
  from repair_tasks rt
  cross join lateral jsonb_array_elements(rt.metadata->'delegatedRecords') j
  join public.platform_record_types p
    on p.module_key = j->>'moduleKey'
   and p.record_type = j->>'recordType'
   and p.is_active = true
  where coalesce(p.configuration_json->>'owner','') = coalesce(rt.source_owner,'')
    and (coalesce(rt.metadata->>'ownerSection','') = '' or p.owner_section = rt.metadata->>'ownerSection')
    and (coalesce(rt.metadata->>'recordGroupKey','') = '' or p.record_group_key = rt.metadata->>'recordGroupKey')
)
delete from public.task_record_links l
using repair_tasks rt
where l.task_id = rt.id
  and l.relation_type in ('delegated_record','execution_source');

with repair_tasks as (
  select t.id, t.school_id, t.created_by, t.assigned_to, t.assignee_email,
         t.start_date, t.metadata, t.source_owner
  from public.central_tasks t
  where t.deleted_at is null
    and t.status in ('active','in_progress','transferred','returned','pending_approval')
    and jsonb_typeof(t.metadata->'delegatedRecords') = 'array'
), valid_records as (
  select distinct rt.id as task_id, rt.school_id, rt.created_by,
         p.module_key, p.record_type
  from repair_tasks rt
  cross join lateral jsonb_array_elements(rt.metadata->'delegatedRecords') j
  join public.platform_record_types p
    on p.module_key = j->>'moduleKey'
   and p.record_type = j->>'recordType'
   and p.is_active = true
  where coalesce(p.configuration_json->>'owner','') = coalesce(rt.source_owner,'')
    and (coalesce(rt.metadata->>'ownerSection','') = '' or p.owner_section = rt.metadata->>'ownerSection')
    and (coalesce(rt.metadata->>'recordGroupKey','') = '' or p.record_group_key = rt.metadata->>'recordGroupKey')
)
insert into public.task_record_links
  (school_id, task_id, module_key, record_type, record_id, relation_type, created_by)
select school_id, task_id, module_key, record_type, null, 'delegated_record', created_by
from valid_records
where not exists (
  select 1 from public.task_record_links x
  where x.task_id = valid_records.task_id
    and x.module_key = valid_records.module_key
    and x.record_type = valid_records.record_type
    and x.record_id is null
    and x.relation_type = 'delegated_record'
);

-- Rebuild grants from the exact linked records for the current assignee.
update public.task_access_grants g
set status='revoked'
from public.central_tasks t
where g.task_id=t.id
  and t.deleted_at is null
  and t.status in ('active','in_progress','transferred','returned','pending_approval')
  and jsonb_typeof(t.metadata->'delegatedRecords')='array'
  and g.status='active';

insert into public.task_access_grants
  (school_id,task_id,user_id,user_email,module_key,record_type,record_id,permission_scope,
   can_view,can_create,can_update,can_upload,can_submit,can_approve,can_delete,
   starts_at,expires_at,status,granted_by)
select distinct
  t.school_id,t.id,t.assigned_to,t.assignee_email,l.module_key,l.record_type,l.record_id,'record',
  true,true,true,true,true,false,false,
  coalesce(t.start_date::timestamptz,t.created_at),null,'active',t.created_by
from public.central_tasks t
join public.task_record_links l on l.task_id=t.id
where t.deleted_at is null
  and t.status in ('active','in_progress','transferred','returned')
  and (t.assigned_to is not null or nullif(t.assignee_email,'') is not null)
  and not exists (
    select 1 from public.task_access_grants g
    where g.task_id=t.id and g.status='active'
      and g.module_key=l.module_key and g.record_type=l.record_type
      and coalesce(g.record_id,'')=coalesce(l.record_id,'')
      and coalesce(g.user_id::text,'')=coalesce(t.assigned_to::text,'')
      and lower(coalesce(g.user_email,''))=lower(coalesce(t.assignee_email,''))
  );

-- Database-level safety: when a task is stopped/deleted, delegated access ends automatically.
create or replace function public.sync_task_delegation_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null
     or new.status in ('approved','rejected','withdrawn','archived','closed','canceled') then
    update public.task_access_grants
       set status='revoked'
     where task_id=new.id and status='active';
    update public.central_task_assignments
       set is_current=false, ended_at=coalesce(ended_at,now())
     where task_id=new.id and is_current=true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_task_delegation_lifecycle on public.central_tasks;
create trigger trg_sync_task_delegation_lifecycle
after update of status,deleted_at on public.central_tasks
for each row execute function public.sync_task_delegation_lifecycle();

commit;

-- Verification
select
  count(*) filter (where deleted_at is null) as visible_tasks,
  count(*) filter (where deleted_at is not null) as soft_deleted_tasks
from public.central_tasks;

select count(*) as active_exact_grants
from public.task_access_grants
where status='active' and record_type is not null;
