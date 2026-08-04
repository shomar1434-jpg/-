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
-- المرحلة الثانية: استكمال إدارة المجلدات وسلة المحذوفات وروابط الملفات
create index if not exists idx_platform_folders_active_tree
  on public.platform_folders(school_id, owner_user_id, module_key, parent_folder_id, sort_order)
  where deleted_at is null;

create index if not exists idx_platform_files_trashed
  on public.platform_files(school_id, owner_user_id, deleted_at desc)
  where status = 'trashed';

create or replace view public.platform_file_usage as
select
  f.id as file_id,
  f.school_id,
  f.owner_user_id,
  f.module_key as source_module_key,
  f.display_name,
  f.mime_type,
  f.file_size,
  f.status,
  f.created_at,
  count(l.id) filter (where l.deleted_at is null) as active_links
from public.platform_files f
left join public.platform_file_links l on l.file_id = f.id
 group by f.id;

revoke all on public.platform_file_usage from anon, authenticated;
-- المرحلة النهائية: الإصدارات، الحذف المتداخل، إحصاءات التشغيل، وتدقيق سلامة البنية
begin;

-- إضافة archived لحالات الملفات لأن الاستبدال يحفظ النسخة السابقة ولا يحذفها.
alter table public.platform_files drop constraint if exists platform_files_status_check;
alter table public.platform_files add constraint platform_files_status_check
  check (status in ('uploading','active','failed','trashed','quarantined','archived','deleted'));

create index if not exists idx_platform_files_module_active
  on public.platform_files(school_id,module_key,ownership_scope,owner_user_id,created_at desc)
  where status='active' and deleted_at is null;

create index if not exists idx_platform_file_events_module_time
  on public.platform_file_events(school_id,module_key,created_at desc);

create index if not exists idx_platform_links_file_active
  on public.platform_file_links(file_id,created_at desc)
  where deleted_at is null;

-- حذف منطقي متداخل للمجلد وما تحته. لا يحذف أي كائن فعلي من Storage.
create or replace function public.platform_trash_folder_tree(p_folder_id uuid,p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
begin
  select school_id into v_school from public.platform_folders where id=p_folder_id;
  if v_school is null then raise exception 'folder_not_found'; end if;

  with recursive tree as (
    select id from public.platform_folders where id=p_folder_id
    union all
    select f.id from public.platform_folders f join tree t on f.parent_folder_id=t.id
  )
  update public.platform_files
     set status='trashed',deleted_at=now()
   where folder_id in (select id from tree) and status='active';

  with recursive tree as (
    select id from public.platform_folders where id=p_folder_id
    union all
    select f.id from public.platform_folders f join tree t on f.parent_folder_id=t.id
  )
  update public.platform_folders
     set status='trashed',deleted_at=now()
   where id in (select id from tree);

  insert into public.platform_file_events(school_id,folder_id,user_id,event_type,new_values)
  values(v_school,p_folder_id,p_user_id,'folder_tree_trashed',jsonb_build_object('recursive',true));
end $$;

revoke all on function public.platform_trash_folder_tree(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_trash_folder_tree(uuid,uuid) to service_role;

-- عرض تشخيصي لا يُتاح للمتصفح مباشرة.
create or replace view public.platform_storage_diagnostics as
select
  school_id,
  module_key,
  ownership_scope,
  owner_user_id,
  count(*) filter(where status='active') active_files,
  count(*) filter(where status='trashed') trashed_files,
  count(*) filter(where status='archived') archived_versions,
  coalesce(sum(file_size) filter(where status<>'deleted'),0) total_bytes,
  max(created_at) latest_upload_at
from public.platform_files
group by school_id,module_key,ownership_scope,owner_user_id;
revoke all on public.platform_storage_diagnostics from anon,authenticated;

commit;


-- منصة القيادة المدرسية
-- استكمال ربط شواهد مركز الجاهزية بمحرك الملفات السحابي الموحد
begin;

alter table public.school_readiness_evidence
  add column if not exists platform_file_id uuid null
    references public.platform_files(id) on delete cascade,
  add column if not exists status text not null default 'active',
  add column if not exists deleted_at timestamptz null;

alter table public.school_readiness_evidence
  drop constraint if exists school_readiness_evidence_status_check;

alter table public.school_readiness_evidence
  add constraint school_readiness_evidence_status_check
  check (status in ('active','trashed','archived'));

create unique index if not exists uq_school_readiness_evidence_platform_file
  on public.school_readiness_evidence(platform_file_id)
  where platform_file_id is not null;

create index if not exists idx_school_readiness_evidence_task_active
  on public.school_readiness_evidence(school_id,plan_id,section_key,task_key,created_at desc)
  where status='active' and deleted_at is null;

create index if not exists idx_school_readiness_evidence_uploader
  on public.school_readiness_evidence(school_id,uploaded_by,created_at desc);

comment on column public.school_readiness_evidence.platform_file_id is
'يربط سجل شاهد الجاهزية بالملف الفعلي داخل محرك platform_files وSupabase Storage.';

comment on column public.school_readiness_evidence.status is
'حالة سجل الشاهد: active أو trashed أو archived.';

commit;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='school_readiness_evidence'
  and column_name in ('platform_file_id','status','deleted_at')
order by ordinal_position;
