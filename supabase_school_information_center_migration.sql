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
