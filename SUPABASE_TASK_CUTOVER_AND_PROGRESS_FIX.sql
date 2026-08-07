-- تصحيح دورة حياة التكليفات التجريبية وربط جيل المحرك الموحد
-- تاريخ القطع معتمد لهذه النسخة التجريبية: 2026-08-07
begin;

-- حفظ التكليفات القديمة تاريخياً بدلاً من حذفها، ومنع ظهورها ضمن التكليفات النشطة.
update public.central_tasks
set status = 'archived',
    closed_at = coalesce(closed_at, now()),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'legacy_archived', true,
      'legacy_archive_reason', 'pre_unified_assignment_cutover',
      'legacy_archived_at', now()
    )
where deleted_at is null
  and status in ('active','in_progress','transferred','pending_approval','returned')
  and coalesce(start_date, created_at::date) < date '2026-08-07';

-- إنهاء منح الوصول القديمة حتى لا تظل الصلاحيات فعالة بعد الأرشفة.
update public.task_access_grants g
set status='revoked'
from public.central_tasks t
where g.task_id=t.id
  and t.metadata->>'legacy_archived'='true'
  and g.status='active';

-- إنهاء الإسنادات القديمة الحالية مع الحفاظ على التاريخ.
update public.central_task_assignments a
set is_current=false,
    ended_at=coalesce(ended_at,now())
from public.central_tasks t
where a.task_id=t.id
  and t.metadata->>'legacy_archived'='true'
  and a.is_current=true;

-- وسم التكليفات الحالية في يوم القطع وما بعده بأنها تابعة للمحرك الموحد.
update public.central_tasks
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'assignment_engine_version','2.0.0',
      'assignment_engine','unified'
    )
where deleted_at is null
  and coalesce(start_date, created_at::date) >= date '2026-08-07'
  and coalesce(metadata->>'legacy_archived','false') <> 'true';

commit;

-- تحقق
select status, count(*)
from public.central_tasks
where deleted_at is null
group by status
order by status;

select id,title,start_date,status,progress_percent,
       metadata->>'assignment_engine_version' as engine_version,
       metadata->>'legacy_archived' as legacy_archived
from public.central_tasks
where deleted_at is null
order by created_at desc
limit 50;
