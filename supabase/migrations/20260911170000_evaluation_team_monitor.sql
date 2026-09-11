-- Evaluation Team Monitor - additive/non-destructive migration
create extension if not exists pgcrypto;

create table if not exists public.evaluation_team_upload_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  token_hash text not null unique,
  title text not null,
  indicator_code text,
  program_id text,
  task_id uuid,
  created_by uuid not null,
  reviewer_user_id uuid not null,
  reviewer_role text,
  expires_at timestamptz,
  max_files integer not null default 5 check (max_files between 1 and 20),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_team_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  link_id uuid not null references public.evaluation_team_upload_links(id) on delete restrict,
  batch_id text,
  platform_file_id uuid not null,
  title text,
  original_name text,
  uploader_name text,
  reviewer_user_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','returned','rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists evaluation_team_links_school_idx on public.evaluation_team_upload_links(school_id,created_at desc);
create index if not exists evaluation_team_links_reviewer_idx on public.evaluation_team_upload_links(school_id,reviewer_user_id,status);
create index if not exists evaluation_team_submissions_school_idx on public.evaluation_team_submissions(school_id,created_at desc);
create index if not exists evaluation_team_submissions_reviewer_idx on public.evaluation_team_submissions(school_id,reviewer_user_id,status);
create index if not exists evaluation_team_submissions_link_idx on public.evaluation_team_submissions(link_id,created_at desc);

alter table public.evaluation_team_upload_links enable row level security;
alter table public.evaluation_team_submissions enable row level security;
revoke all on table public.evaluation_team_upload_links from public, anon, authenticated;
revoke all on table public.evaluation_team_submissions from public, anon, authenticated;

-- Register the section in the central platform catalog without altering existing modules.
insert into public.platform_modules
(module_key,display_name,owner_role,route_url,icon_key,is_active,configuration)
values
('evaluation_team_monitor','متابعة مؤشرات فريق التقويم','manager','evaluation_team_monitor.html','evaluation-team-monitor',true,'{"school_scoped":true,"manager_section":true}'::jsonb)
on conflict (module_key) do update set
 display_name=excluded.display_name,
 owner_role=excluded.owner_role,
 route_url=excluded.route_url,
 icon_key=excluded.icon_key,
 is_active=true,
 configuration=coalesce(public.platform_modules.configuration,'{}'::jsonb) || excluded.configuration;

insert into public.platform_record_types
(module_key,record_type,display_name,route_url,is_assignable,supports_files,supports_approval,supports_analysis,is_active,configuration)
values
('evaluation_team_monitor','evaluation_indicator_task','متابعة مؤشرات فريق التقويم','assignment_workspace.html',true,true,true,true,true,'{"permission_scope":"record","owner_section":"evaluation_team_monitor"}'::jsonb)
on conflict (module_key,record_type) do update set
 display_name=excluded.display_name,
 route_url=excluded.route_url,
 is_assignable=true,
 supports_files=true,
 supports_approval=true,
 supports_analysis=true,
 is_active=true,
 configuration=coalesce(public.platform_record_types.configuration,'{}'::jsonb) || excluded.configuration;
