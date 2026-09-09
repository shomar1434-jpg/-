-- منصة القيادة المدرسية — مركز الأحداث والتنبيهات وWeb Push
-- لا يحذف أي جدول أو سجل قائم.
begin;

alter table if exists public.users add column if not exists mobile_number text;
alter table if exists public.users add column if not exists mobile_verified boolean not null default false;
alter table if exists public.users add column if not exists mobile_updated_at timestamptz;

create table if not exists public.school_notification_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  push_enabled boolean not null default true,
  important_only boolean not null default true,
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_user_id uuid null,
  actor_name text,
  actor_role text,
  event_type text not null,
  event_label text,
  module_key text,
  record_type text,
  record_id text,
  summary text,
  severity text not null default 'normal' check (severity in ('normal','important','critical')),
  recipient_user_id uuid null,
  action_url text,
  event_data jsonb not null default '{}'::jsonb,
  source_key text,
  created_at timestamptz not null default now()
);
create index if not exists school_events_school_created_idx on public.school_events(school_id,created_at desc);
create index if not exists school_events_recipient_idx on public.school_events(school_id,recipient_user_id,created_at desc);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  recipient_user_id uuid not null,
  source_event_id uuid null references public.school_events(id) on delete set null,
  title text not null,
  body text,
  severity text not null default 'normal' check (severity in ('normal','important','critical')),
  action_url text,
  actor_user_id uuid null,
  actor_name text,
  read_at timestamptz,
  push_sent_at timestamptz,
  push_attempts integer not null default 0,
  source_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_notifications_inbox_idx on public.platform_notifications(school_id,recipient_user_id,created_at desc);
create index if not exists platform_notifications_unread_idx on public.platform_notifications(school_id,recipient_user_id,read_at) where read_at is null;
create unique index if not exists platform_notifications_source_key_uq on public.platform_notifications(school_id,recipient_user_id,source_key) where source_key is not null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_name text,
  user_agent text,
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_error text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,user_id,endpoint)
);
create index if not exists push_subscriptions_target_idx on public.push_subscriptions(school_id,user_id,is_active);

alter table public.school_notification_settings enable row level security;
alter table public.school_events enable row level security;
alter table public.platform_notifications enable row level security;
alter table public.push_subscriptions enable row level security;

commit;
