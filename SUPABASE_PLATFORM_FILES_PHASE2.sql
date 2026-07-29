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
