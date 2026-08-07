begin;

create or replace view public.vw_task_execution_facts as
select
  t.school_id,
  t.id task_id,
  t.title,
  t.module_key,
  t.record_type,
  t.record_id,
  t.current_assignee_id assignee_id,
  t.current_assignee_role assignee_role,
  t.status,
  coalesce(t.progress_percent,0)::numeric progress_percent,
  t.created_at,
  t.updated_at,
  t.due_date,
  case when t.due_date is not null and t.due_date < current_date and t.status not in ('approved','closed','archived','canceled') then true else false end is_overdue,
  exists(select 1 from public.platform_record_events e where e.school_id=t.school_id and e.task_id=t.id) has_internal_execution,
  (select count(*) from public.platform_record_events e where e.school_id=t.school_id and e.task_id=t.id) record_event_count,
  (select max(e.occurred_at) from public.platform_record_events e where e.school_id=t.school_id and e.task_id=t.id) last_execution_at,
  (select count(*) from public.central_task_reviews r where r.school_id=t.school_id and r.task_id=t.id) review_count,
  (select max(r.reviewed_at) from public.central_task_reviews r where r.school_id=t.school_id and r.task_id=t.id) last_review_at
from public.central_tasks t;

create or replace view public.vw_school_execution_summary as
select school_id,
 count(*) total_tasks,
 count(*) filter(where status in ('active','in_progress','transferred','returned')) active_tasks,
 count(*) filter(where status='pending_approval') pending_approval,
 count(*) filter(where status='approved') approved_tasks,
 count(*) filter(where status='returned') returned_tasks,
 count(*) filter(where is_overdue) overdue_tasks,
 round(coalesce(avg(progress_percent),0),1) average_progress,
 count(*) filter(where has_internal_execution) internally_evidenced_tasks,
 count(*) filter(where status='approved' and review_count<=1) first_pass_approved,
 round(100.0*count(*) filter(where status='approved' and review_count<=1)/nullif(count(*) filter(where status='approved'),0),1) first_pass_approval_rate,
 max(greatest(updated_at,last_execution_at,last_review_at)) last_activity_at
from public.vw_task_execution_facts
group by school_id;

create or replace view public.vw_execution_by_record_group as
select f.school_id,
 coalesce(rt.configuration_json->>'record_group_name',rt.configuration_json->>'groupName','غير مصنف') record_group_name,
 count(*) total_tasks,
 count(*) filter(where f.status='approved') approved_tasks,
 count(*) filter(where f.is_overdue) overdue_tasks,
 round(coalesce(avg(f.progress_percent),0),1) average_progress
from public.vw_task_execution_facts f
left join public.platform_record_types rt on rt.module_key=f.module_key and rt.record_type=f.record_type
group by f.school_id,coalesce(rt.configuration_json->>'record_group_name',rt.configuration_json->>'groupName','غير مصنف');

create or replace view public.vw_platform_core_dashboard as
select s.id school_id,
 coalesce(x.total_tasks,0) total_tasks,
 coalesce(x.active_tasks,0) active_tasks,
 coalesce(x.pending_approval,0) pending_approval,
 coalesce(x.approved_tasks,0) approved_tasks,
 coalesce(x.returned_tasks,0) returned_tasks,
 coalesce(x.overdue_tasks,0) overdue_tasks,
 coalesce(x.average_progress,0) average_progress,
 coalesce(x.internally_evidenced_tasks,0) internally_evidenced_tasks,
 coalesce(x.first_pass_approval_rate,0) first_pass_approval_rate,
 x.last_activity_at,
 (select count(*) from public.platform_record_events e where e.school_id=s.id and e.occurred_at>=now()-interval '30 days') events_30d,
 (select count(*) from public.platform_decision_actions d where d.school_id=s.id and d.status in ('created','pending')) pending_decisions
from public.schools s
left join public.vw_school_execution_summary x on x.school_id=s.id;

commit;
