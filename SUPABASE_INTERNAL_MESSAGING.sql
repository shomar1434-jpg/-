-- Internal Messaging v3 — run once in Supabase SQL Editor.
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  sender_user_id uuid,
  sender_name text not null default '',
  sender_role text not null default '',
  subject text not null,
  body text not null,
  priority text not null default 'normal',
  message_type text not null default 'message',
  require_ack boolean not null default false,
  due_at timestamptz,
  thread_id uuid,
  parent_message_id uuid,
  linked_module text,
  linked_record_type text,
  linked_record_id text,
  linked_title text,
  linked_url text,
  converted_task_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.internal_messages add column if not exists message_type text not null default 'message';
alter table public.internal_messages add column if not exists require_ack boolean not null default false;
alter table public.internal_messages add column if not exists due_at timestamptz;
alter table public.internal_messages add column if not exists linked_module text;
alter table public.internal_messages add column if not exists linked_record_type text;
alter table public.internal_messages add column if not exists linked_record_id text;
alter table public.internal_messages add column if not exists linked_title text;
alter table public.internal_messages add column if not exists linked_url text;
alter table public.internal_messages add column if not exists converted_task_id uuid;
alter table public.internal_messages add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists internal_messages_school_created_idx on public.internal_messages(school_id,created_at desc);
create index if not exists internal_messages_thread_idx on public.internal_messages(school_id,thread_id,created_at);

create table if not exists public.internal_message_recipients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  recipient_user_id uuid,
  recipient_email text,
  recipient_name text not null default '',
  recipient_role text not null default '',
  read_at timestamptz,
  acknowledged_at timestamptz,
  action_status text not null default 'none',
  action_note text,
  pinned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.internal_message_recipients add column if not exists acknowledged_at timestamptz;
alter table public.internal_message_recipients add column if not exists action_status text not null default 'none';
alter table public.internal_message_recipients add column if not exists action_note text;
alter table public.internal_message_recipients add column if not exists pinned_at timestamptz;
create unique index if not exists internal_message_recipient_unique on public.internal_message_recipients(message_id,recipient_user_id) where recipient_user_id is not null;
create index if not exists internal_message_recipients_lookup_idx on public.internal_message_recipients(school_id,recipient_user_id,created_at desc);
create index if not exists internal_message_recipients_email_idx on public.internal_message_recipients(school_id,recipient_email,created_at desc);

create table if not exists public.internal_message_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  file_id uuid,
  file_name text not null default '',
  file_url text,
  mime_type text,
  file_size bigint not null default 0,
  source text not null default 'device',
  created_at timestamptz not null default now()
);
alter table public.internal_message_attachments add column if not exists mime_type text;
alter table public.internal_message_attachments add column if not exists file_size bigint not null default 0;
alter table public.internal_message_attachments add column if not exists source text not null default 'device';
create unique index if not exists internal_message_attachment_unique on public.internal_message_attachments(message_id,file_id) where file_id is not null;

alter table public.internal_messages enable row level security;
alter table public.internal_message_recipients enable row level security;
alter table public.internal_message_attachments enable row level security;
-- All reads/writes go through platform-messages Edge Function after validating platform_sessions and school_id.
