begin;
alter table public.semester_plan_weeks add column if not exists evidence_items jsonb not null default '[]'::jsonb;
alter table public.semester_plan_weeks add column if not exists execution_rating text;
alter table public.semester_plan_weeks add column if not exists execution_reviewed_at timestamptz;
alter table public.semester_plan_weeks add column if not exists execution_reviewed_by uuid;
create index if not exists idx_semester_plan_exec_rating on public.semester_plan_weeks(school_id,academic_year,semester,plan_type,execution_rating);
commit;
