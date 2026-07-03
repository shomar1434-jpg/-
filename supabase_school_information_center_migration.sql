-- مركز المعلومات المدرسية - جدول الطلاب
create table if not exists public.students (
  id bigint generated always as identity primary key,
  school_id text not null,
  student_name text not null,
  stage text not null default 'غير محدد',
  grade text not null default 'غير محدد',
  noor_section_code text,
  section_name text not null default 'غير محدد',
  national_id text,
  student_status text default 'نشط',
  academic_year text default '1447',
  created_at timestamptz default now()
);

create index if not exists idx_students_school on public.students(school_id);
create index if not exists idx_students_school_grade_section on public.students(school_id, grade, section_name);

alter table public.students enable row level security;

do $$ begin
  create policy "students_select" on public.students for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "students_insert" on public.students for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "students_update" on public.students for update using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "students_delete" on public.students for delete using (true);
exception when duplicate_object then null; end $$;


-- مصدر بيانات المعلمين المصدّر لقسم الوكيل من مركز المعلومات
create table if not exists deputy_weekly_teacher_source (
  school_id text primary key,
  school_name text,
  teachers jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- الدفعة الثانية: متابعة أعمال المعلمين الأسبوعية للوكيل
create table if not exists deputy_weekly_followups (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  week_number text,
  term text,
  start_date date,
  end_date date,
  status text default 'active',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_deputy_weekly_followups_school on deputy_weekly_followups(school_id);

create table if not exists deputy_weekly_teacher_tasks (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  followup_id uuid references deputy_weekly_followups(id) on delete cascade,
  teacher_user_id text not null,
  task_type text not null,
  task_name text not null,
  task_day text,
  task_status text default 'required',
  evidence_type text,
  evidence_url text,
  deputy_note text,
  teacher_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_deputy_weekly_teacher_tasks_school on deputy_weekly_teacher_tasks(school_id);
create index if not exists idx_deputy_weekly_teacher_tasks_teacher on deputy_weekly_teacher_tasks(teacher_user_id);
