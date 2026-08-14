-- Agent Core V2: محادثات وذاكرة وتدقيق مقيدة بالمدرسة والمستخدم والعام.
create extension if not exists pgcrypto;

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid,
  role text not null,
  academic_year text not null,
  title text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_conversations_scope_idx on public.agent_conversations(school_id,user_id,academic_year,updated_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid,
  role text not null,
  content text not null,
  tools_used jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_conv_idx on public.agent_messages(conversation_id,created_at);

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid,
  role text,
  academic_year text not null,
  scope text not null default 'user',
  content text not null,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_memories_scope_idx on public.agent_memories(school_id,user_id,academic_year,created_at desc);

create table if not exists public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid,
  role text,
  academic_year text,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists agent_audit_scope_idx on public.agent_audit_log(school_id,user_id,created_at desc);

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_memories enable row level security;
alter table public.agent_audit_log enable row level security;
-- القراءة/الكتابة تتم من Edge Function عبر service role بعد التحقق من platform session.
