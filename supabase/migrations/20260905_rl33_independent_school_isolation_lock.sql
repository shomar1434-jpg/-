-- RL33 Independent School Isolation Lock
-- Apply only together with the RL33 frontend + Edge Functions.
-- Goal: browser clients cannot enumerate users, memberships, students, private state/files, or internal impact data.

alter table if exists public.schools enable row level security;
alter table if exists public.users enable row level security;
alter table if exists public.school_members enable row level security;
alter table if exists public.students enable row level security;
alter table if exists public.platform_sessions enable row level security;
alter table if exists public.platform_module_state enable row level security;
alter table if exists public.platform_files enable row level security;
alter table if exists public.platform_folders enable row level security;
alter table if exists public.platform_file_links enable row level security;
alter table if exists public.platform_file_events enable row level security;
alter table if exists public.impact_surveys enable row level security;
alter table if exists public.impact_assessments enable row level security;
alter table if exists public.impact_survey_responses enable row level security;
alter table if exists public.impact_analysis_snapshots enable row level security;
alter table if exists public.external_evaluation_decisions enable row level security;
alter table if exists public.external_evaluation_drafts enable row level security;
alter table if exists public.external_evaluation_files enable row level security;
alter table if exists public.external_evaluation_survey_responses enable row level security;
alter table if exists public.external_evaluation_surveys enable row level security;
alter table if exists public.external_evaluation_visits enable row level security;

alter table if exists public.school_members add column if not exists supervisor_user_id uuid;
create index if not exists school_members_school_supervisor_idx on public.school_members(school_id, supervisor_user_id) where supervisor_user_id is not null;
create index if not exists platform_state_school_owner_module_idx on public.platform_module_state(school_id, owner_key, module_key);
create index if not exists platform_files_school_owner_module_idx on public.platform_files(school_id, owner_user_id, module_key) where owner_user_id is not null;
create index if not exists impact_surveys_school_creator_idx on public.impact_surveys(school_id, creator_user_id);
create index if not exists impact_assessments_school_creator_idx on public.impact_assessments(school_id, creator_user_id);

-- All internal access is through server-authoritative Edge Functions using service_role.
revoke all on table public.schools from public, anon, authenticated;
revoke all on table public.users from public, anon, authenticated;
revoke all on table public.school_members from public, anon, authenticated;
revoke all on table public.students from public, anon, authenticated;
revoke all on table public.platform_sessions from public, anon, authenticated;
revoke all on table public.platform_module_state from public, anon, authenticated;
revoke all on table public.platform_files from public, anon, authenticated;
revoke all on table public.platform_folders from public, anon, authenticated;
revoke all on table public.platform_file_links from public, anon, authenticated;
revoke all on table public.platform_file_events from public, anon, authenticated;
revoke all on table public.impact_surveys from public, anon, authenticated;
revoke all on table public.impact_assessments from public, anon, authenticated;
revoke all on table public.impact_survey_responses from public, anon, authenticated;
revoke all on table public.impact_analysis_snapshots from public, anon, authenticated;
revoke all on table public.external_evaluation_decisions from public, anon, authenticated;
revoke all on table public.external_evaluation_drafts from public, anon, authenticated;
revoke all on table public.external_evaluation_files from public, anon, authenticated;
revoke all on table public.external_evaluation_survey_responses from public, anon, authenticated;
revoke all on table public.external_evaluation_surveys from public, anon, authenticated;
revoke all on table public.external_evaluation_visits from public, anon, authenticated;

-- Remove permissive legacy browser policies. Edge Functions use service_role and do not depend on them.
drop policy if exists "allow read schools" on public.schools;
drop policy if exists "allow insert schools" on public.schools;
drop policy if exists "allow update schools" on public.schools;
drop policy if exists "allow delete schools" on public.schools;
drop policy if exists school_members_read on public.school_members;
drop policy if exists school_members_insert on public.school_members;
drop policy if exists school_members_update on public.school_members;
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
drop policy if exists students_delete on public.students;
drop policy if exists impact_surveys_platform_access on public.impact_surveys;
drop policy if exists impact_assessments_platform_access on public.impact_assessments;
drop policy if exists impact_responses_platform_read on public.impact_survey_responses;
drop policy if exists impact_analysis_platform_access on public.impact_analysis_snapshots;
drop policy if exists "allow all external decisions" on public.external_evaluation_decisions;
drop policy if exists "allow all external drafts" on public.external_evaluation_drafts;
drop policy if exists "allow all external files" on public.external_evaluation_files;
drop policy if exists "allow all external survey responses" on public.external_evaluation_survey_responses;
drop policy if exists "allow all external surveys" on public.external_evaluation_surveys;
drop policy if exists "allow all external visits" on public.external_evaluation_visits;

-- Public survey is intentionally token-based. Keep only these two narrow RPCs public.
revoke all on function public.get_public_impact_survey(text) from public;
revoke all on function public.submit_public_impact_response(text,text,text,jsonb) from public;
grant execute on function public.get_public_impact_survey(text) to anon, authenticated;
grant execute on function public.submit_public_impact_response(text,text,text,jsonb) to anon, authenticated;

-- Do not expose internal school/user identifiers through the public survey read.
create or replace function public.get_public_impact_survey(p_token text)
returns table(
  id text, public_token text, school_id text, program_name text, title text,
  audience text, role text, role_label text, template text, questions jsonb,
  status text, measure_date date, created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.public_token, null::text as school_id, s.program_name, s.title, s.audience,
         null::text as role, null::text as role_label, s.template, s.questions, s.status,
         s.measure_date, s.created_at
  from public.impact_surveys s
  where s.public_token = p_token and s.status = 'active'
  limit 1;
$$;

alter function public.submit_public_impact_response(text,text,text,jsonb) set search_path = public, pg_temp;

-- The old aggregate view must not bypass the new bank Edge Function.
do $$ begin
  if to_regclass('public.vw_impact_bank_summary') is not null then
    execute 'revoke all on public.vw_impact_bank_summary from public, anon, authenticated';
  end if;
end $$;
