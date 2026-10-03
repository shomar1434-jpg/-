-- RL231: non-destructive central sources for teacher profiles and deputy follow-up.
-- Access is intentionally service-role only through the school-information Edge Function,
-- which validates the signed platform session, school scope, and manager role.

create table if not exists public.school_teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null,
  teacher_name text not null default '',
  email text not null default '',
  subject text not null default '',
  weekly_lessons integer not null default 0 check (weekly_lessons >= 0),
  teaching_subjects jsonb not null default '[]'::jsonb,
  assignments jsonb not null default '[]'::jsonb,
  extra_roles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_teacher_profiles_school_user_key unique (school_id,user_id),
  constraint school_teacher_profiles_subjects_array check (jsonb_typeof(teaching_subjects)='array'),
  constraint school_teacher_profiles_assignments_array check (jsonb_typeof(assignments)='array'),
  constraint school_teacher_profiles_roles_array check (jsonb_typeof(extra_roles)='array')
);

create index if not exists school_teacher_profiles_school_idx
  on public.school_teacher_profiles (school_id,updated_at desc);

alter table public.school_teacher_profiles enable row level security;
revoke all on table public.school_teacher_profiles from anon, authenticated;

create table if not exists public.deputy_weekly_teacher_source (
  school_id uuid primary key references public.schools(id) on delete restrict,
  school_name text not null default '',
  teachers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deputy_weekly_teacher_source_teachers_array check (jsonb_typeof(teachers)='array')
);

alter table public.deputy_weekly_teacher_source enable row level security;
revoke all on table public.deputy_weekly_teacher_source from anon, authenticated;

comment on table public.school_teacher_profiles is
  'School-scoped teaching subjects and teaching assignments; written and read via school-information Edge Function.';
comment on table public.deputy_weekly_teacher_source is
  'Verified school-scoped export consumed by deputy teacher follow-up.';
