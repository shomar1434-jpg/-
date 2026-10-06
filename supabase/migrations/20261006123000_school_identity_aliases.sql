create table if not exists public.school_identity_aliases (
  alias text primary key,
  canonical_school_id uuid not null references public.schools(id) on delete restrict,
  alias_type text not null default 'legacy_school_id',
  status text not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_identity_aliases_status_check check (status in ('active','disabled'))
);
alter table public.school_identity_aliases enable row level security;
revoke all on table public.school_identity_aliases from anon, authenticated;
insert into public.school_identity_aliases(alias,canonical_school_id,alias_type,status,note)
values ('695d22d8-1483-412b-8ac8-97ce8c37e7f6','f836a31f-af7c-4928-8744-7bf0d514a896','legacy_school_id','active','رابط قديم للثانوية الثانية والخمسون بنات؛ تحويل غير مدمر إلى هوية المدرسة المركزية')
on conflict (alias) do update set canonical_school_id=excluded.canonical_school_id,status='active',note=excluded.note,updated_at=now();
