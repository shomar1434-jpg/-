create extension if not exists pgcrypto;

create table if not exists public.student_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  student_id text not null,
  national_id text not null,
  student_name text not null,
  stage text,
  grade text,
  class_name text,
  movement_type text not null default 'absence' check (movement_type = 'absence'),
  movement_date date not null,
  source text not null default 'noor' check (source = 'noor'),
  notes text,
  synced_by text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint student_daily_attendance_one_absence unique (school_id, national_id, movement_date, movement_type)
);

create index if not exists idx_student_daily_attendance_school_date
  on public.student_daily_attendance (school_id, movement_date desc);
create index if not exists idx_student_daily_attendance_student_date
  on public.student_daily_attendance (school_id, student_id, movement_date desc);

alter table public.student_daily_attendance enable row level security;
revoke all on table public.student_daily_attendance from anon, authenticated;

comment on table public.student_daily_attendance is
  'غياب نور اليومي؛ لا يصل إليه المتصفح مباشرة، بل عبر وظيفة تتحقق من جلسة المنصة والمدرسة والدور.';
