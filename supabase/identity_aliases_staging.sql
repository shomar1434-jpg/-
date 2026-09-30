-- RL230 / STAGING ONLY
-- Non-destructive identity alias foundation. Do not rewrite existing school_id values.
create table if not exists public.school_identity_aliases (
  alias_school_id uuid primary key,
  canonical_school_id uuid not null,
  reason text not null default 'duplicate_school_identity',
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_identity_alias_not_self check (alias_school_id <> canonical_school_id)
);

alter table public.school_identity_aliases enable row level security;
revoke all on public.school_identity_aliases from anon, authenticated;

comment on table public.school_identity_aliases is
  'Internal, non-destructive old school id to canonical school id map. Read only by trusted server workflows.';

create index if not exists school_identity_aliases_canonical_idx
  on public.school_identity_aliases (canonical_school_id)
  where enabled = true;

-- No alias rows are inserted automatically. Repeated school labels can be caused
-- by a legitimate multi-school manager combined with stale browser mirrors.
-- A mapping may be inserted only after ownership and isolation are verified.
