-- منصة القيادة المدرسية: محرك الملفات السحابي الموحد
create extension if not exists pgcrypto;

create table if not exists public.platform_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  user_id uuid not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists platform_sessions_lookup_idx on public.platform_sessions(session_token_hash,status,expires_at);
create index if not exists platform_sessions_school_user_idx on public.platform_sessions(school_id,user_id);

create table if not exists public.platform_folders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  ownership_scope text not null check (ownership_scope in ('user','school')),
  owner_user_id uuid,
  module_key text not null,
  parent_folder_id uuid references public.platform_folders(id) on delete restrict,
  folder_name text not null,
  folder_type text not null default 'standard' check (folder_type in ('standard','archive','system','temporary')),
  sort_order integer not null default 0,
  created_by uuid not null,
  status text not null default 'active' check (status in ('active','trashed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((ownership_scope='user' and owner_user_id is not null) or (ownership_scope='school' and owner_user_id is null))
);
create index if not exists platform_folders_scope_idx on public.platform_folders(school_id,owner_user_id,module_key,parent_folder_id);
create unique index if not exists platform_folders_unique_name_idx on public.platform_folders(
  school_id,coalesce(owner_user_id,'00000000-0000-0000-0000-000000000000'::uuid),module_key,
  coalesce(parent_folder_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(folder_name)
) where deleted_at is null;

create table if not exists public.platform_files (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  ownership_scope text not null check (ownership_scope in ('user','school')),
  owner_user_id uuid,
  uploaded_by uuid not null,
  module_key text not null,
  folder_id uuid references public.platform_folders(id) on delete set null,
  primary_record_type text,
  primary_record_id text,
  bucket_name text not null default 'school-platform-files',
  storage_path text not null unique,
  original_name text not null,
  display_name text not null,
  stored_name text not null,
  extension text,
  mime_type text not null,
  file_size bigint not null check(file_size>=0),
  checksum_sha256 text,
  visibility text not null default 'private' check (visibility in ('private','school','shared','restricted')),
  status text not null default 'active' check (status in ('uploading','active','failed','trashed','quarantined','deleted')),
  version_number integer not null default 1,
  replaced_file_id uuid references public.platform_files(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((ownership_scope='user' and owner_user_id is not null) or (ownership_scope='school' and owner_user_id is null))
);
create index if not exists platform_files_scope_idx on public.platform_files(school_id,owner_user_id,module_key,status);
create index if not exists platform_files_folder_idx on public.platform_files(folder_id);
create index if not exists platform_files_record_idx on public.platform_files(school_id,primary_record_type,primary_record_id);

create table if not exists public.platform_file_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  file_id uuid not null references public.platform_files(id) on delete cascade,
  module_key text not null,
  record_type text not null,
  record_id text not null,
  relation_type text not null default 'attachment',
  linked_by uuid not null,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists platform_file_links_record_idx on public.platform_file_links(school_id,module_key,record_type,record_id);
create unique index if not exists platform_file_links_unique_idx on public.platform_file_links(school_id,file_id,module_key,record_type,record_id,relation_type) where deleted_at is null;

create table if not exists public.platform_file_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  file_id uuid references public.platform_files(id) on delete set null,
  folder_id uuid references public.platform_folders(id) on delete set null,
  user_id uuid not null,
  event_type text not null,
  module_key text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_file_events_idx on public.platform_file_events(school_id,file_id,created_at desc);

create or replace function public.platform_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists platform_folders_touch on public.platform_folders;
create trigger platform_folders_touch before update on public.platform_folders for each row execute function public.platform_touch_updated_at();
drop trigger if exists platform_files_touch on public.platform_files;
create trigger platform_files_touch before update on public.platform_files for each row execute function public.platform_touch_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('school-platform-files','school-platform-files',false,52428800,array[
'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
'image/jpeg','image/png','image/webp','image/svg+xml','text/plain','text/csv','application/zip'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.platform_sessions enable row level security;
alter table public.platform_folders enable row level security;
alter table public.platform_files enable row level security;
alter table public.platform_file_links enable row level security;
alter table public.platform_file_events enable row level security;
revoke all on public.platform_sessions,public.platform_folders,public.platform_files,public.platform_file_links,public.platform_file_events from anon,authenticated;
