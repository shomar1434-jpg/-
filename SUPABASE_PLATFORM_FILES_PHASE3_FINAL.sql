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
