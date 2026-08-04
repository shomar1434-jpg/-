-- نواة التكليفات السحابية الموحدة - منصة القيادة المدرسية
create extension if not exists pgcrypto;

create table if not exists public.central_tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  module_key text not null default 'central_tasks',
  record_type text null,
  record_id text null,
  title text not null,
  description text null,
  assignment_type text not null default 'partial' check (assignment_type in ('record','partial','additional_role')),
  source_owner text null,
  record_key text null,
  created_by uuid not null,
  owner_role text null,
  owner_label text null,
  assigned_to uuid null,
  assignee_email text null,
  assignee_name text null,
  assignee_role text null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'active' check (status in ('active','in_progress','transferred','pending_approval','returned','approved','rejected','withdrawn','archived','closed','canceled')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  start_date date null,
  due_date date null,
  requires_approval boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null,
  deleted_at timestamptz null
);

create table if not exists public.central_task_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  assigned_from uuid null,
  assigned_to uuid null,
  assignee_email text null,
  assignee_name text null,
  assignee_role text null,
  assigned_by uuid not null,
  assignment_reason text null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz null,
  is_current boolean not null default true
);

create table if not exists public.central_task_updates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  user_id uuid not null,
  update_type text not null default 'progress' check (update_type in ('progress','note','execution','submission','correction')),
  title text null,
  notes text null,
  link_url text null,
  progress_percent integer null check (progress_percent between 0 and 100),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','returned','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.central_task_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  reviewer_id uuid not null,
  decision text not null check (decision in ('approved','returned_for_correction','rejected')),
  review_notes text null,
  reviewed_at timestamptz not null default now()
);

create table if not exists public.central_task_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  update_id uuid null references public.central_task_updates(id) on delete set null,
  platform_file_id uuid not null references public.platform_files(id) on delete cascade,
  uploaded_by uuid not null,
  evidence_type text not null default 'execution',
  status text not null default 'active' check (status in ('active','trashed','archived')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  unique(task_id, platform_file_id)
);

create table if not exists public.central_task_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  actor_id uuid not null,
  event_type text not null,
  event_note text null,
  old_values jsonb null,
  new_values jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.central_task_notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid null references public.central_tasks(id) on delete cascade,
  recipient_user_id uuid null,
  recipient_email text null,
  notification_type text not null default 'info',
  title text not null,
  message text null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_access_grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  user_id uuid null,
  user_email text null,
  module_key text not null,
  record_type text null,
  record_id text null,
  permission_scope text not null default 'record' check (permission_scope in ('record','module','workspace')),
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_upload boolean not null default false,
  can_submit boolean not null default false,
  can_approve boolean not null default false,
  can_delete boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz null,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  granted_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_record_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  task_id uuid not null references public.central_tasks(id) on delete cascade,
  module_key text not null,
  record_type text not null,
  record_id text null,
  relation_type text not null default 'execution_source',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(task_id,module_key,record_type,record_id,relation_type)
);

create index if not exists idx_central_tasks_school_status on public.central_tasks(school_id,status,updated_at desc);
create index if not exists idx_central_tasks_assignee on public.central_tasks(school_id,assigned_to,status);
create index if not exists idx_central_tasks_assignee_email on public.central_tasks(school_id,lower(assignee_email),status);
create index if not exists idx_central_tasks_record on public.central_tasks(school_id,module_key,record_type,record_id);
create index if not exists idx_task_assignments_current on public.central_task_assignments(task_id,is_current);
create index if not exists idx_task_updates_task on public.central_task_updates(task_id,created_at desc);
create index if not exists idx_task_events_task on public.central_task_events(task_id,created_at desc);
create index if not exists idx_task_grants_user on public.task_access_grants(school_id,user_id,status,expires_at);
create index if not exists idx_task_grants_email on public.task_access_grants(school_id,lower(user_email),status,expires_at);

create or replace function public.set_central_task_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_central_tasks_updated_at on public.central_tasks;
create trigger trg_central_tasks_updated_at before update on public.central_tasks for each row execute function public.set_central_task_updated_at();
drop trigger if exists trg_central_task_updates_updated_at on public.central_task_updates;
create trigger trg_central_task_updates_updated_at before update on public.central_task_updates for each row execute function public.set_central_task_updated_at();

create or replace view public.vw_school_task_summary as
select school_id,
 count(*) filter(where deleted_at is null) total_tasks,
 count(*) filter(where status in ('active','in_progress','transferred','returned') and deleted_at is null) active_tasks,
 count(*) filter(where status='pending_approval' and deleted_at is null) pending_approval,
 count(*) filter(where status='approved' and deleted_at is null) approved_tasks,
 count(*) filter(where due_date<current_date and status not in ('approved','archived','closed','withdrawn','rejected','canceled') and deleted_at is null) overdue_tasks,
 round(coalesce(avg(progress_percent) filter(where deleted_at is null),0),1) average_progress
from public.central_tasks group by school_id;

create or replace view public.vw_assignee_task_workload as
select school_id,assigned_to,assignee_email,assignee_name,assignee_role,
 count(*) filter(where status in ('active','in_progress','transferred','returned','pending_approval')) active_workload,
 count(*) filter(where due_date<current_date and status not in ('approved','archived','closed','withdrawn','rejected','canceled')) overdue_workload,
 round(coalesce(avg(progress_percent),0),1) average_progress
from public.central_tasks where deleted_at is null group by school_id,assigned_to,assignee_email,assignee_name,assignee_role;

alter table public.central_tasks enable row level security;
alter table public.central_task_assignments enable row level security;
alter table public.central_task_updates enable row level security;
alter table public.central_task_reviews enable row level security;
alter table public.central_task_evidence enable row level security;
alter table public.central_task_events enable row level security;
alter table public.central_task_notifications enable row level security;
alter table public.task_access_grants enable row level security;
alter table public.task_record_links enable row level security;
revoke all on public.central_tasks,public.central_task_assignments,public.central_task_updates,public.central_task_reviews,public.central_task_evidence,public.central_task_events,public.central_task_notifications,public.task_access_grants,public.task_record_links from anon,authenticated;

do $$ begin
 alter publication supabase_realtime add table public.central_tasks;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.central_task_updates;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.central_task_notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;
