-- تعدد المدارس والأدوار لجميع مستخدمي المنصة
-- ينفذ مرة واحدة في Supabase SQL Editor. لا يدمج بيانات المدارس؛ العضوية تمنح الوصول فقط.
create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid null,
  email text not null,
  microsoft_email text null,
  microsoft_user_id text null,
  role text not null,
  role_label text null,
  status text not null default 'active',
  is_primary boolean not null default false,
  is_primary_manager boolean not null default false,
  academic_year_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.school_members add column if not exists microsoft_email text;
alter table public.school_members add column if not exists microsoft_user_id text;
alter table public.school_members add column if not exists role_label text;
alter table public.school_members add column if not exists is_primary boolean not null default false;
alter table public.school_members add column if not exists academic_year_id text;
alter table public.school_members add column if not exists updated_at timestamptz not null default now();
create unique index if not exists uq_school_members_school_email_role on public.school_members(school_id, lower(email), role);
create index if not exists idx_school_members_user_id on public.school_members(user_id);
create index if not exists idx_school_members_email_lower on public.school_members(lower(email));
create index if not exists idx_school_members_ms_email_lower on public.school_members(lower(microsoft_email));
create index if not exists idx_school_members_school on public.school_members(school_id);
-- مثال: نفس المستخدم في مدرستين
-- insert into public.school_members(school_id,user_id,email,role) values ('<school-a>','<user-id>','user@school.sa','teacher'),('<school-b>','<user-id>','user@school.sa','teacher');
-- يمكن إضافة أكثر من دور للمستخدم نفسه في المدرسة نفسها بسجل عضوية مستقل.
