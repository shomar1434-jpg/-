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
