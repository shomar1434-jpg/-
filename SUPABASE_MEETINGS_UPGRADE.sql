-- ترقية جدول الاجتماعات الحالي دون حذفه أو فقد بياناته
create extension if not exists pgcrypto;

alter table public.meetings
  add column if not exists meeting_type text,
  add column if not exists meeting_date date,
  add column if not exists meeting_time time,
  add column if not exists agenda text,
  add column if not exists recommendations text,
  add column if not exists tasks text,
  add column if not exists participants jsonb not null default '[]'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists chat_notes jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists created_by uuid,
  add column if not exists created_by_name text,
  add column if not exists created_by_email text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists meetings_school_id_idx on public.meetings(school_id);
create index if not exists meetings_date_idx on public.meetings(meeting_date desc);
create index if not exists meetings_created_by_email_idx on public.meetings(lower(created_by_email));

create or replace function public.set_meetings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at
before update on public.meetings
for each row execute function public.set_meetings_updated_at();

alter table public.meetings enable row level security;

-- سياسات تعتمد على وجود school_id في JWT أو جدول school_members.
-- إن كانت المنصة تستخدم مصادقة مخصصة دون Supabase Auth، راجع السياسة قبل تفعيل الإنتاج.
drop policy if exists meetings_school_select on public.meetings;
create policy meetings_school_select on public.meetings
for select using (
  school_id::text = coalesce(auth.jwt() ->> 'school_id', '')
  or exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id
      and (sm.user_id = auth.uid() or lower(sm.email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
);

drop policy if exists meetings_school_insert on public.meetings;
create policy meetings_school_insert on public.meetings
for insert with check (
  school_id::text = coalesce(auth.jwt() ->> 'school_id', '')
  or exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id
      and (sm.user_id = auth.uid() or lower(sm.email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
);

drop policy if exists meetings_school_update on public.meetings;
create policy meetings_school_update on public.meetings
for update using (
  school_id::text = coalesce(auth.jwt() ->> 'school_id', '')
  or exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id
      and (sm.user_id = auth.uid() or lower(sm.email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
) with check (
  school_id::text = coalesce(auth.jwt() ->> 'school_id', '')
  or exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id
      and (sm.user_id = auth.uid() or lower(sm.email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
);
