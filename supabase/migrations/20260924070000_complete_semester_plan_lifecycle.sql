begin;

alter table public.semester_plan_weeks
  add column if not exists program_execution_items jsonb not null default '[]'::jsonb;
alter table public.semester_plan_weeks
  add column if not exists evidence_returned_at timestamptz;
alter table public.semester_plan_weeks
  add column if not exists evidence_returned_by uuid;
alter table public.semester_plan_weeks
  add column if not exists evidence_return_note text;

create table if not exists public.semester_plan_archives (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  owner_user_id uuid not null,
  owner_role text not null,
  plan_type text not null,
  academic_year text not null,
  semester text not null,
  weeks_count integer not null default 0,
  completed_weeks integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '[]'::jsonb,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, owner_user_id, plan_type, academic_year, semester)
);

create index if not exists idx_semester_plan_archives_school_period
  on public.semester_plan_archives(school_id, academic_year, semester, plan_type);

alter table public.semester_plan_archives enable row level security;
revoke all on table public.semester_plan_archives from anon, authenticated;

commit;
