begin;
create table if not exists public.semester_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  owner_user_id uuid not null,
  owner_role text not null,
  plan_type text not null,
  academic_year text not null,
  semester text not null,
  week_key text not null,
  week_order integer not null default 0,
  title text not null,
  dates text,
  behavior text,
  event_name text,
  is_vacation boolean not null default false,
  programs jsonb not null default '[]'::jsonb,
  notes text,
  plan_status text not null default 'draft',
  manager_note text,
  plan_submitted_at timestamptz,
  plan_approved_at timestamptz,
  plan_approved_by uuid,
  execution_status text not null default 'not_started',
  evidence_file_id uuid,
  evidence_name text,
  evidence_submitted_at timestamptz,
  execution_approved_at timestamptz,
  execution_approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,plan_type,academic_year,semester,week_key)
);
create index if not exists idx_semester_plan_school on public.semester_plan_weeks(school_id,academic_year,semester,plan_type,week_order);
create index if not exists idx_semester_plan_status on public.semester_plan_weeks(school_id,plan_status,execution_status);
alter table public.semester_plan_weeks enable row level security;
revoke all on public.semester_plan_weeks from anon, authenticated;
insert into public.platform_modules(module_key,display_name,owner_role,route_url,is_active) values
('semester_plans','الخطط الفصلية','shared','semester_plan.html',true)
on conflict(module_key) do update set display_name=excluded.display_name,route_url=excluded.route_url,is_active=true;
insert into public.platform_record_types(module_key,record_type,display_name,route_url,is_assignable,supports_files,supports_approval,supports_analysis,configuration_json) values
('semester_plans','semester_plan_week','الخطة الفصلية الأسبوعية','semester_plan.html',false,true,true,true,'{"permission_scope":"school_role","manager_monitor":"semester_plans_monitor.html"}'::jsonb)
on conflict(module_key,record_type) do update set display_name=excluded.display_name,route_url=excluded.route_url,supports_files=true,supports_approval=true,supports_analysis=true,is_active=true;
commit;
