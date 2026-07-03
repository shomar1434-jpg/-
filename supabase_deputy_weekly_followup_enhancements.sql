-- Optional Supabase tables for Deputy Weekly Teacher Follow-up enhancements
-- يمكن تنفيذها عند الرغبة في نقل التخزين من localStorage إلى Supabase.

create table if not exists public.deputy_followup_calendars (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  academic_year text,
  term text,
  week_number int not null,
  start_date date,
  end_date date,
  status text default 'لم يبدأ',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.deputy_followup_week_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  week_id text,
  academic_year text,
  term text,
  week_number int,
  start_date date,
  end_date date,
  metrics jsonb default '{}'::jsonb,
  teachers jsonb default '[]'::jsonb,
  variable_assignments jsonb default '[]'::jsonb,
  extra_tasks jsonb default '[]'::jsonb,
  closed_by text,
  closed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.deputy_followup_teacher_metrics (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  week_id text,
  teacher_id text not null,
  teacher_name text,
  subject text,
  attendance_score numeric,
  lineup_score numeric,
  weekly_plan_score numeric,
  madrasati_score numeric,
  variable_tasks_score numeric,
  extra_tasks_score numeric,
  final_score numeric,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_deputy_followup_calendars_school on public.deputy_followup_calendars(school_id, academic_year, term);
create index if not exists idx_deputy_followup_snapshots_school on public.deputy_followup_week_snapshots(school_id, academic_year, term);
create index if not exists idx_deputy_followup_metrics_teacher on public.deputy_followup_teacher_metrics(school_id, teacher_id, week_id);

-- المرحلة الثالثة B: شواهد وإرسال أعمال المعلم للوكيل
create table if not exists public.teacher_weekly_task_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  week_id text not null,
  teacher_user_id text not null,
  status text default 'draft',
  viewed_at timestamptz,
  submitted_at timestamptz,
  score numeric default 0,
  items jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (school_id, week_id, teacher_user_id)
);

create table if not exists public.teacher_weekly_task_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  week_id text not null,
  teacher_user_id text not null,
  task_key text not null,
  evidence_type text,
  evidence_value text,
  file_name text,
  file_type text,
  file_size numeric,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_teacher_weekly_submissions_school_week on public.teacher_weekly_task_submissions(school_id, week_id);
create index if not exists idx_teacher_weekly_evidence_school_week on public.teacher_weekly_task_evidence(school_id, week_id, teacher_user_id);
