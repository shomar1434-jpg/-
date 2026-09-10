-- Cloud Document Workspace COMPLETE
-- إضافي وغير هدّام: جلسات تحرير + قفل تحرير فقط. إصدارات الملفات تستعمل platform_files الموجودة.
create table if not exists public.document_workspace_sessions (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, file_id uuid not null, current_file_id uuid not null, user_id uuid not null,
  editor_provider text not null default 'onlyoffice', document_key text not null, callback_secret_hash text not null,
  status text not null default 'active' check (status in ('active','saving','completed','closed','expired','failed')),
  opened_at timestamptz not null default now(), expires_at timestamptz not null, closed_at timestamptz, last_callback_at timestamptz,
  saved_file_id uuid, error_message text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.document_workspace_sessions add column if not exists current_file_id uuid;
alter table public.document_workspace_sessions add column if not exists last_callback_at timestamptz;
alter table public.document_workspace_sessions add column if not exists saved_file_id uuid;
alter table public.document_workspace_sessions add column if not exists error_message text;
alter table public.document_workspace_sessions add column if not exists metadata jsonb not null default '{}'::jsonb;
update public.document_workspace_sessions set current_file_id=file_id where current_file_id is null;
create index if not exists document_workspace_sessions_school_idx on public.document_workspace_sessions(school_id,created_at desc);
create index if not exists document_workspace_sessions_file_idx on public.document_workspace_sessions(school_id,file_id,created_at desc);
create index if not exists document_workspace_sessions_user_idx on public.document_workspace_sessions(school_id,user_id,created_at desc);
drop index if exists public.document_workspace_one_active_editor_idx;
create unique index if not exists document_workspace_one_writer_idx on public.document_workspace_sessions(school_id,file_id) where status in ('active','saving');
alter table public.document_workspace_sessions enable row level security;
revoke all on table public.document_workspace_sessions from public,anon,authenticated;
