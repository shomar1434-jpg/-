
-- دعم مدير واحد مرتبط بأكثر من مدرسة
-- نفذ هذا الملف في Supabase SQL Editor قبل الاعتماد الكامل على الربط متعدد المدارس.

create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid null,
  email text not null,
  role text not null default 'manager',
  status text not null default 'active',
  is_primary_manager boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, email, role)
);

create index if not exists idx_school_members_email on public.school_members(lower(email));
create index if not exists idx_school_members_school_id on public.school_members(school_id);

alter table public.school_members enable row level security;

-- سياسة مبدئية يمكن تعديلها حسب نموذج auth لديك.
-- إذا كانت المنصة تستخدم service role/anon مباشرة في الواجهة الحالية، ابدأ بدون تشديد إضافي ثم اضبط السياسات لاحقًا.
drop policy if exists "school_members_read" on public.school_members;
create policy "school_members_read"
on public.school_members for select
using (true);

drop policy if exists "school_members_insert" on public.school_members;
create policy "school_members_insert"
on public.school_members for insert
with check (true);

drop policy if exists "school_members_update" on public.school_members;
create policy "school_members_update"
on public.school_members for update
using (true)
with check (true);
