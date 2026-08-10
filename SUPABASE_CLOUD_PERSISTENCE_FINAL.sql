begin;

create extension if not exists pgcrypto;

create table if not exists public.platform_module_state (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  owner_key text not null default 'school',
  module_key text not null,
  state_key text not null,
  payload jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_module_state_unique unique (school_id, owner_key, module_key, state_key)
);

alter table public.platform_module_state add column if not exists updated_by text;
create index if not exists idx_platform_module_state_school_module on public.platform_module_state(school_id,module_key);
create index if not exists idx_platform_module_state_owner on public.platform_module_state(school_id,owner_key,module_key);
create index if not exists idx_platform_module_state_updated on public.platform_module_state(school_id,updated_at desc);

-- لا يُسمح للمتصفح بالوصول المباشر إلى حالة الوحدات؛ القراءة والكتابة تمر عبر Edge Function platform-state.
alter table public.platform_module_state enable row level security;
revoke all on table public.platform_module_state from anon, authenticated;

commit;

select 'platform_module_state ready' as result;
