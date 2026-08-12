
-- Internal messaging system v1
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  sender_user_id uuid,
  sender_name text not null default '',
  sender_role text not null default '',
  subject text not null,
  body text not null,
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  thread_id uuid,
  parent_message_id uuid,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists internal_messages_school_created_idx on public.internal_messages(school_id,created_at desc);

create table if not exists public.internal_message_recipients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  recipient_user_id uuid,
  recipient_email text,
  recipient_name text not null default '',
  recipient_role text not null default '',
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists internal_message_recipients_lookup_idx on public.internal_message_recipients(school_id,recipient_user_id,created_at desc);
create index if not exists internal_message_recipients_email_idx on public.internal_message_recipients(school_id,recipient_email,created_at desc);

create table if not exists public.internal_message_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  file_id uuid,
  file_name text not null default '',
  file_url text,
  created_at timestamptz not null default now()
);
alter table public.internal_messages enable row level security;
alter table public.internal_message_recipients enable row level security;
alter table public.internal_message_attachments enable row level security;
-- Access is intentionally through platform-messages Edge Function using validated platform_sessions.
