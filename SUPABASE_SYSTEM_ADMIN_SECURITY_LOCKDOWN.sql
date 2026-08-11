begin;

create table if not exists public.system_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.system_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action text not null,
  target_school_id uuid,
  success boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.system_admins enable row level security;
alter table public.system_admin_audit_log enable row level security;
revoke all on table public.system_admins from anon, authenticated;
revoke all on table public.system_admin_audit_log from anon, authenticated;

-- إغلاق الإدارة المباشرة من المتصفح. القراءة/الكتابة الإدارية تمر عبر system-admin فقط.
revoke insert, update, delete on table public.schools from anon, authenticated;
-- users permissions are not globally revoked here because school managers currently manage school users.
-- Their school-scoped RLS is reviewed separately; the emergency lock closes school administration first.

commit;

-- بعد إنشاء حساب مدير النظام في Authentication > Users، نفذ السطر التالي مرة واحدة
-- بعد استبدال القيم الفعلية:
-- insert into public.system_admins(user_id,email,is_active)
-- values ('PUT-AUTH-USER-UUID-HERE','admin@example.com',true)
-- on conflict (user_id) do update set email=excluded.email,is_active=true;

select 'system_admin_security_lockdown_ready' as result;
