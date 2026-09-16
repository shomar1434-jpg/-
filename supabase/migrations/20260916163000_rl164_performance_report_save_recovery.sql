create table if not exists public.platform_module_state_recovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  backup_batch text not null,
  source_id uuid not null,
  school_id text not null,
  owner_key text not null,
  module_key text not null,
  state_key text not null,
  payload jsonb,
  updated_by text,
  source_updated_at timestamptz not null,
  source_deleted_at timestamptz,
  source_created_at timestamptz not null,
  payload_sha256 text,
  backed_up_at timestamptz not null default now(),
  restored_at timestamptz,
  restore_note text,
  unique(backup_batch,source_id)
);

alter table public.platform_module_state_recovery_snapshots enable row level security;
revoke all on table public.platform_module_state_recovery_snapshots from public, anon, authenticated;

create index if not exists platform_state_recovery_school_owner_idx
  on public.platform_module_state_recovery_snapshots(school_id,owner_key,module_key);

comment on table public.platform_module_state_recovery_snapshots is
  'نسخ استرداد داخلية غير مكشوفة تحفظ الحالة الأصلية قبل إصلاحات غير إتلافية.';
