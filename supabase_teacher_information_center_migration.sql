-- Migration: بيانات المعلمين في مركز المعلومات المدرسية
-- ينشئ جدولًا اختياريًا لحفظ بيانات المعلمين التعليمية المرتبطة بحسابات المستخدمين والمدرسة.
create table if not exists public.school_teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  user_id text not null,
  teacher_name text,
  email text,
  subject text,
  weekly_lessons integer default 0,
  assignments jsonb not null default '[]'::jsonb,
  extra_roles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create index if not exists idx_school_teacher_profiles_school on public.school_teacher_profiles(school_id);
create index if not exists idx_school_teacher_profiles_user on public.school_teacher_profiles(user_id);
