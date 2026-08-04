-- Platform Core Engine - محرك القرارات والتفاعل وقابلية التوسع
-- ينفذ بعد SUPABASE_CLOUD_TASKS_CORE.sql
create extension if not exists pgcrypto;

create table if not exists public.platform_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  display_name text not null,
  owner_role text null,
  route_url text null,
  icon_key text null,
  is_active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_record_types (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.platform_modules(module_key) on update cascade,
  record_type text not null,
  display_name text not null,
  source_table text null,
  route_url text null,
  is_assignable boolean not null default true,
  supports_files boolean not null default true,
  supports_approval boolean not null default true,
  supports_analysis boolean not null default true,
  default_workflow_key text null,
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_key,record_type)
);

create table if not exists public.platform_record_relationships (
  id uuid primary key default gen_random_uuid(),
  source_module_key text not null,
  source_record_type text not null,
  target_module_key text not null,
  target_record_type text null,
  relationship_type text not null check (relationship_type in ('produces_indicator','feeds_dashboard','creates_task','grants_access','depends_on','related_to')),
  event_type text null,
  mapping jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(source_module_key,source_record_type,target_module_key,target_record_type,relationship_type,event_type)
);

create table if not exists public.platform_workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null unique,
  display_name text not null,
  states jsonb not null default '[]'::jsonb,
  transitions jsonb not null default '[]'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  indicator_key text not null unique,
  display_name text not null,
  target_module_key text not null,
  value_type text not null default 'number' check (value_type in ('number','percentage','count','status','text','json')),
  aggregation_method text not null default 'latest' check (aggregation_method in ('latest','sum','average','count','max','min')),
  direction text not null default 'neutral' check (direction in ('higher_is_better','lower_is_better','neutral')),
  thresholds jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_indicator_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  display_name text not null,
  source_module_key text not null,
  source_record_type text null,
  source_event_type text not null,
  condition_json jsonb not null default '{}'::jsonb,
  action_type text not null check (action_type in ('indicator','notification','task','relationship')),
  action_config jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_record_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  module_key text not null,
  record_type text not null,
  record_id text null,
  task_id uuid null references public.central_tasks(id) on delete set null,
  actor_id uuid not null,
  execution_role text null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_result jsonb null
);

create table if not exists public.platform_indicator_values (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  indicator_key text not null references public.platform_indicator_definitions(indicator_key) on update cascade,
  module_key text not null,
  record_type text null,
  record_id text null,
  task_id uuid null references public.central_tasks(id) on delete set null,
  source_event_id uuid null references public.platform_record_events(id) on delete set null,
  numeric_value numeric null,
  text_value text null,
  json_value jsonb null,
  status text null,
  measured_at timestamptz not null default now(),
  created_by uuid not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.platform_decision_actions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  source_event_id uuid null references public.platform_record_events(id) on delete set null,
  rule_id uuid null references public.platform_indicator_rules(id) on delete set null,
  action_type text not null,
  target_module_key text null,
  target_user_id uuid null,
  target_user_email text null,
  task_id uuid null references public.central_tasks(id) on delete set null,
  status text not null default 'created' check (status in ('created','executed','failed','dismissed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  executed_at timestamptz null
);

create index if not exists idx_platform_events_school_time on public.platform_record_events(school_id,occurred_at desc);
create index if not exists idx_platform_events_record on public.platform_record_events(school_id,module_key,record_type,record_id);
create index if not exists idx_platform_indicator_values_school on public.platform_indicator_values(school_id,indicator_key,measured_at desc);
create index if not exists idx_platform_decisions_school on public.platform_decision_actions(school_id,status,created_at desc);
create index if not exists idx_platform_rules_source on public.platform_indicator_rules(source_module_key,source_record_type,source_event_type,is_active);

create or replace function public.platform_core_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
do $$ begin
 create trigger trg_platform_modules_updated before update on public.platform_modules for each row execute function public.platform_core_set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
 create trigger trg_platform_record_types_updated before update on public.platform_record_types for each row execute function public.platform_core_set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
 create trigger trg_platform_workflows_updated before update on public.platform_workflow_definitions for each row execute function public.platform_core_set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
 create trigger trg_platform_indicators_updated before update on public.platform_indicator_definitions for each row execute function public.platform_core_set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
 create trigger trg_platform_rules_updated before update on public.platform_indicator_rules for each row execute function public.platform_core_set_updated_at();
exception when duplicate_object then null; end $$;

-- القاموس المرجعي الأولي؛ إضافة أي سجل مستقبلي تتم عبر upsert فقط دون تعديل المحرك
insert into public.platform_modules(module_key,display_name,owner_role,route_url) values
 ('central_tasks','مركز التكليفات','manager','central_task_center.html'),
 ('school_readiness','جاهزية المدرسة','manager','school_readiness.html'),
 ('academic_affairs','الشؤون التعليمية','deputy_academic','agent.html'),
 ('student_affairs','شؤون الطلاب','deputy_students','agent.html'),
 ('student_advisor','التوجيه الطلابي','student_advisor','student_advisor.html'),
 ('teacher_records','سجلات المعلم','teacher','teacher_comprehensive_record.html'),
 ('health_guidance','التوجيه الصحي','health_guide','school_health_unified_registry.html'),
 ('exams','الاختبارات','deputy_academic','manager_exams_management.html'),
 ('administrative_employee','الموظف الإداري','administrative_employee','administrative_employee_portal.html')
on conflict(module_key) do update set display_name=excluded.display_name,owner_role=excluded.owner_role,route_url=excluded.route_url,is_active=true;

insert into public.platform_record_types(module_key,record_type,display_name,route_url,is_assignable,supports_files,supports_approval,supports_analysis) values
 ('central_tasks','central_task','التكليف المركزي','central_task_center.html',true,true,true,true),
 ('school_readiness','readiness_task','بند الجاهزية','school_readiness.html',true,true,true,true),
 ('student_affairs','student_affairs_record','سجل شؤون الطلاب','agent.html',true,true,true,true),
 ('student_advisor','student_case','حالة طلابية','student_advisor_records.html',true,true,true,true),
 ('teacher_records','teacher_comprehensive_record','سجل المعلم الشامل','teacher_comprehensive_record.html',true,true,true,true),
 ('health_guidance','health_record','السجل الصحي الموحد','school_health_unified_registry.html',true,true,true,true),
 ('exams','exam_record','سجل الاختبارات','manager_exams_management.html',true,true,true,true),
 ('administrative_employee','administrative_record','سجل الموظف الإداري','administrative_employee_portal.html',true,true,true,true)
on conflict(module_key,record_type) do update set display_name=excluded.display_name,route_url=excluded.route_url,is_active=true;

insert into public.platform_record_relationships(source_module_key,source_record_type,target_module_key,target_record_type,relationship_type,event_type,mapping) values
 ('teacher_records','teacher_comprehensive_record','student_advisor',null,'produces_indicator','record_updated','{"indicators":["student_guidance_need","attendance_risk","behavior_risk"]}'::jsonb),
 ('central_tasks','central_task','manager',null,'feeds_dashboard','task_status_changed','{"dashboard":"executive"}'::jsonb),
 ('central_tasks','central_task','academic_affairs',null,'feeds_dashboard','task_status_changed','{"dashboard":"role"}'::jsonb),
 ('central_tasks','central_task','student_advisor',null,'feeds_dashboard','task_status_changed','{"dashboard":"role"}'::jsonb),
 ('school_readiness','readiness_task','manager',null,'feeds_dashboard','evidence_uploaded','{"dashboard":"readiness"}'::jsonb)
on conflict(source_module_key,source_record_type,target_module_key,target_record_type,relationship_type,event_type) do update set mapping=excluded.mapping,is_active=true;

insert into public.platform_indicator_definitions(indicator_key,display_name,target_module_key,value_type,aggregation_method,direction,thresholds) values
 ('task_completion_rate','نسبة إنجاز التكليفات','manager','percentage','average','higher_is_better','{"warning":70,"good":90}'::jsonb),
 ('pending_approvals','تكليفات بانتظار الاعتماد','manager','count','count','lower_is_better','{"warning":5,"critical":10}'::jsonb),
 ('overdue_tasks','التكليفات المتأخرة','manager','count','count','lower_is_better','{"warning":3,"critical":8}'::jsonb),
 ('evidence_coverage','تغطية التنفيذ بالشواهد','manager','percentage','average','higher_is_better','{"warning":70,"good":90}'::jsonb),
 ('student_guidance_need','احتياج للتدخل التوجيهي','student_advisor','status','latest','lower_is_better','{}'::jsonb),
 ('attendance_risk','مخاطر الغياب والتأخر','student_advisor','status','latest','lower_is_better','{}'::jsonb),
 ('behavior_risk','مخاطر سلوكية','student_advisor','status','latest','lower_is_better','{}'::jsonb)
on conflict(indicator_key) do update set display_name=excluded.display_name,target_module_key=excluded.target_module_key,is_active=true;

insert into public.platform_indicator_rules(rule_key,display_name,source_module_key,source_record_type,source_event_type,condition_json,action_type,action_config,priority) values
 ('task-progress-indicator','تحديث مؤشر إنجاز التكليف','central_tasks','central_task','task_status_changed','{}','indicator','{"indicator_key":"task_completion_rate","value_path":"progress_percent","target_module_key":"manager"}',10),
 ('teacher-guidance-signal','تحويل مؤشرات سجل المعلم إلى التوجيه الطلابي','teacher_records','teacher_comprehensive_record','record_updated','{"any_paths":["guidance_need","attendance_risk","behavior_risk"]}','indicator','{"indicator_key":"student_guidance_need","value_path":"guidance_need","target_module_key":"student_advisor"}',20)
on conflict(rule_key) do update set condition_json=excluded.condition_json,action_config=excluded.action_config,is_active=true;

create or replace view public.vw_platform_core_dashboard as
select s.id school_id,
 coalesce(ts.total_tasks,0) total_tasks,
 coalesce(ts.active_tasks,0) active_tasks,
 coalesce(ts.pending_approval,0) pending_approval,
 coalesce(ts.approved_tasks,0) approved_tasks,
 coalesce(ts.overdue_tasks,0) overdue_tasks,
 coalesce(ts.average_progress,0) average_progress,
 (select count(*) from public.platform_record_events e where e.school_id=s.id and e.occurred_at>=now()-interval '30 days') events_30d,
 (select count(*) from public.platform_decision_actions d where d.school_id=s.id and d.status='created') pending_decisions
from public.schools s
left join public.vw_school_task_summary ts on ts.school_id=s.id;

create or replace view public.vw_student_guidance_signals as
select school_id,record_id,
 max(measured_at) last_signal_at,
 jsonb_object_agg(indicator_key,coalesce(json_value,to_jsonb(text_value),to_jsonb(numeric_value))) filter(where indicator_key is not null) indicators
from public.platform_indicator_values
where module_key='student_advisor' or indicator_key in ('student_guidance_need','attendance_risk','behavior_risk')
group by school_id,record_id;

alter table public.platform_modules enable row level security;
alter table public.platform_record_types enable row level security;
alter table public.platform_record_relationships enable row level security;
alter table public.platform_workflow_definitions enable row level security;
alter table public.platform_indicator_definitions enable row level security;
alter table public.platform_indicator_rules enable row level security;
alter table public.platform_record_events enable row level security;
alter table public.platform_indicator_values enable row level security;
alter table public.platform_decision_actions enable row level security;
revoke all on public.platform_modules,public.platform_record_types,public.platform_record_relationships,public.platform_workflow_definitions,public.platform_indicator_definitions,public.platform_indicator_rules,public.platform_record_events,public.platform_indicator_values,public.platform_decision_actions from anon,authenticated;

do $$ begin alter publication supabase_realtime add table public.platform_record_events; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.platform_indicator_values; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.platform_decision_actions; exception when duplicate_object then null; when undefined_object then null; end $$;
