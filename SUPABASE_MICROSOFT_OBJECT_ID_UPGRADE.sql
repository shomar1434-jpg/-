-- إضافة Microsoft Object ID كهوية Microsoft الأعلى دقة للمستخدمين
-- شغّل هذا الملف مرة واحدة بعد ملف SUPABASE_MICROSOFT_EMAIL_IDENTITY.sql

alter table public.school_members
  add column if not exists microsoft_user_id text;

update public.school_members
set microsoft_user_id = lower(trim(microsoft_user_id))
where microsoft_user_id is not null;

create index if not exists school_members_microsoft_user_id_lookup_idx
  on public.school_members (school_id, lower(trim(microsoft_user_id)))
  where microsoft_user_id is not null and trim(microsoft_user_id) <> '';

do $$
begin
  if not exists (
    select 1 from public.school_members
    where microsoft_user_id is not null and trim(microsoft_user_id) <> ''
    group by school_id, lower(trim(microsoft_user_id))
    having count(*) > 1
  ) then
    if not exists (select 1 from pg_indexes where schemaname='public' and indexname='school_members_school_microsoft_user_id_unique') then
      execute 'create unique index school_members_school_microsoft_user_id_unique on public.school_members (school_id, lower(trim(microsoft_user_id))) where microsoft_user_id is not null and trim(microsoft_user_id) <> ''''';
    end if;
  else
    raise notice 'لم يتم إنشاء القيد الفريد لوجود Microsoft Object ID مكرر داخل إحدى المدارس.';
  end if;
end $$;

create or replace function public.normalize_school_member_microsoft_identity()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(coalesce(new.email, new.microsoft_email, '')));
  new.microsoft_email := lower(trim(coalesce(new.microsoft_email, new.email, '')));
  new.microsoft_user_id := nullif(lower(trim(coalesce(new.microsoft_user_id, ''))), '');
  return new;
end;
$$;

drop trigger if exists trg_normalize_school_member_microsoft_identity on public.school_members;
create trigger trg_normalize_school_member_microsoft_identity
before insert or update of email, microsoft_email, microsoft_user_id on public.school_members
for each row execute function public.normalize_school_member_microsoft_identity();

select school_id, email, microsoft_email, microsoft_user_id, role, status
from public.school_members
order by school_id, microsoft_email;
