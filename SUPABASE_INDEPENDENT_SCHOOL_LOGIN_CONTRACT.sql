-- عقد ربط المدارس المستقلة - طبقة Supabase الجذرية
-- نفّذ هذا الملف في Supabase SQL Editor إذا كانت صفحة school-login لا تستطيع قراءة سجل المدرسة من الرابط.

-- 1) تأكد من وجود أعمدة الربط الأساسية في schools
alter table if exists public.schools add column if not exists school_code text;
alter table if exists public.schools add column if not exists registration_code text;
alter table if exists public.schools add column if not exists manager_email text;
alter table if exists public.schools add column if not exists manager_name text;
alter table if exists public.schools add column if not exists status text default 'active';

-- 2) فهارس تمنع الالتباس وتسرّع حل الرابط
create unique index if not exists schools_school_code_unique on public.schools (school_code) where school_code is not null;
create index if not exists schools_registration_code_idx on public.schools (registration_code);
create index if not exists schools_manager_email_idx on public.schools (lower(manager_email));

-- 3) جدول عضويات اختياري لكنه مهم للمجمعات التعليمية: مدير واحد يمكن ربطه بأكثر من مدرسة دون خلط
create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid null,
  email text not null,
  role text not null default 'member',
  status text not null default 'active',
  is_primary_manager boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists school_members_school_id_idx on public.school_members (school_id);
create index if not exists school_members_email_idx on public.school_members (lower(email));
create unique index if not exists school_members_school_email_role_unique on public.school_members (school_id, lower(email), role);

-- 4) مزامنة مدير المدرسة الموجود في schools إلى school_members حتى تعمل المجمعات التعليمية
insert into public.school_members (school_id, email, role, status, is_primary_manager)
select id, lower(manager_email), 'manager', coalesce(status,'active'), true
from public.schools
where manager_email is not null and manager_email <> ''
on conflict do nothing;

-- 5) View آمن لصفحة الدخول: يعرض بيانات تعريف المدرسة فقط لحل الرابط، وليس بيانات الطلاب أو السجلات
create or replace view public.school_login_directory as
select
  id,
  school_code,
  registration_code,
  school_name,
  manager_name,
  manager_email,
  status
from public.schools
where coalesce(status,'active') not in ('deleted','disabled','blocked','inactive','محذوف','معطل','موقوف');

grant select on public.school_login_directory to anon, authenticated;

-- 6) سياسات RLS المقترحة إن كانت مفعلة
alter table public.schools enable row level security;
alter table public.school_members enable row level security;

drop policy if exists "public can resolve school login directory" on public.schools;
create policy "public can resolve school login directory" on public.schools
for select to anon, authenticated
using (coalesce(status,'active') not in ('deleted','disabled','blocked','inactive','محذوف','معطل','موقوف'));

drop policy if exists "members read own membership" on public.school_members;
create policy "members read own membership" on public.school_members
for select to anon, authenticated
using (coalesce(status,'active') = 'active');
