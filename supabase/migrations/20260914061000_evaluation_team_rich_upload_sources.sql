-- RL166: richer evidence sources for evaluation team upload links.
-- Additive only: existing submissions remain valid.
alter table public.evaluation_team_submissions
  alter column platform_file_id drop not null;

alter table public.evaluation_team_submissions
  add column if not exists source_type text not null default 'upload',
  add column if not exists external_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_evaluation_team_submissions_source
  on public.evaluation_team_submissions (school_id, source_type, created_at desc);
