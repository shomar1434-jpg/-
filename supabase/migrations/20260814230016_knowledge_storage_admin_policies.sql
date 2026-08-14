drop policy if exists "knowledge_admin_insert" on storage.objects;
drop policy if exists "knowledge_admin_select" on storage.objects;
drop policy if exists "knowledge_admin_update" on storage.objects;
drop policy if exists "knowledge_admin_delete" on storage.objects;

create policy "knowledge_admin_insert" on storage.objects for insert to authenticated
with check(bucket_id='regulatory-knowledge' and exists(select 1 from public.system_admins sa where sa.user_id=auth.uid() and sa.is_active=true));
create policy "knowledge_admin_select" on storage.objects for select to authenticated
using(bucket_id='regulatory-knowledge' and exists(select 1 from public.system_admins sa where sa.user_id=auth.uid() and sa.is_active=true));
create policy "knowledge_admin_update" on storage.objects for update to authenticated
using(bucket_id='regulatory-knowledge' and exists(select 1 from public.system_admins sa where sa.user_id=auth.uid() and sa.is_active=true))
with check(bucket_id='regulatory-knowledge' and exists(select 1 from public.system_admins sa where sa.user_id=auth.uid() and sa.is_active=true));
create policy "knowledge_admin_delete" on storage.objects for delete to authenticated
using(bucket_id='regulatory-knowledge' and exists(select 1 from public.system_admins sa where sa.user_id=auth.uid() and sa.is_active=true));
