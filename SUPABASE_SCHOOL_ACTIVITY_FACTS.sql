begin;
create or replace view public.vw_school_activity_facts as
select
 e.id,e.school_id,e.actor_id,e.execution_role,e.module_key,e.record_type,e.record_id,e.task_id,e.event_type,e.event_data,e.occurred_at,
 case when e.task_id is null then 'direct_role' else 'delegated_task' end as execution_source,
 case
   when jsonb_typeof(e.event_data->'progress')='number' then greatest(0,least(100,(e.event_data->>'progress')::numeric))
   when e.event_type='record_completed' then 100
   when e.event_type='record_submitted' then 80
   when e.event_type in ('record_updated','record_saved','record_created') then 60
   when e.event_type='record_opened' then 10
   else 40
 end as execution_progress
from public.platform_record_events e;
create index if not exists idx_platform_events_school_actor_time on public.platform_record_events(school_id,actor_id,occurred_at desc);
commit;
select execution_source,count(*) events,count(distinct actor_id) users,count(distinct (module_key,record_type,coalesce(record_id,''))) records
from public.vw_school_activity_facts
where occurred_at>=now()-interval '30 days'
group by execution_source;
