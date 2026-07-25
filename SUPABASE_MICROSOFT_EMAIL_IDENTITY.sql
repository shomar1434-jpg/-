-- توحيد هوية مستخدمي الاجتماعات عبر البريد الرسمي لحساب Microsoft Teams
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor.

alter table public.school_members
  add column if not exists microsoft_email text;

update public.school_members
set microsoft_email = lower(trim(email))
where (microsoft_email is null or trim(microsoft_email) = '')
  and email is not null
  and trim(email) <> '';

create index if not exists school_members_microsoft_email_lookup_idx
  on public.school_members (school_id, lower(microsoft_email));

-- إنشاء قيد فريد فقط عندما لا توجد تكرارات حالية؛ وإلا يعرض تنبيهًا بدل إيقاف الترقية.
do $$
begin
  if not exists (
    select 1
    from public.school_members
    where microsoft_email is not null and trim(microsoft_email) <> ''
    group by school_id, lower(trim(microsoft_email))
    having count(*) > 1
  ) then
    if not exists (
      select 1 from pg_indexes
      where schemaname='public' and indexname='school_members_school_microsoft_email_unique'
    ) then
      execute 'create unique index school_members_school_microsoft_email_unique on public.school_members (school_id, lower(trim(microsoft_email))) where microsoft_email is not null and trim(microsoft_email) <> ''''';
    end if;
  else
    raise notice 'لم يتم إنشاء القيد الفريد لوجود بريد Microsoft مكرر داخل إحدى المدارس. عالج التكرارات ثم أعد تشغيل الملف.';
  end if;
end $$;

-- مزامنة email و microsoft_email تلقائيًا؛ البريد نفسه هو هوية Microsoft المعتمدة.
create or replace function public.sync_school_member_microsoft_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(coalesce(new.email, new.microsoft_email, '')));
  new.microsoft_email := lower(trim(coalesce(new.microsoft_email, new.email, '')));
  return new;
end;
$$;

drop trigger if exists trg_sync_school_member_microsoft_email on public.school_members;
create trigger trg_sync_school_member_microsoft_email
before insert or update of email, microsoft_email on public.school_members
for each row execute function public.sync_school_member_microsoft_email();

-- التحقق من النتيجة
select school_id, email, microsoft_email, role, status
from public.school_members
order by school_id, microsoft_email;
