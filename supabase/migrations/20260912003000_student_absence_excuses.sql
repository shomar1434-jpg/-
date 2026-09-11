create extension if not exists pgcrypto;
create table if not exists public.student_absence_excuse_links (
 id uuid primary key default gen_random_uuid(), school_id text not null, created_by uuid not null, reviewer_user_id uuid not null,
 token_hash text not null unique, student_source_id text, student_name text not null, civil_hash text not null,
 stage text, grade text, class_name text, track text, absence_date date not null, absence_days int not null check(absence_days between 1 and 60),
 expires_at timestamptz not null, revoked_at timestamptz, submitted_at timestamptz, verification_hash text, verified_at timestamptz, verify_attempts int not null default 0, locked_until timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.student_absence_excuses (
 id uuid primary key default gen_random_uuid(), school_id text not null, link_id uuid not null references public.student_absence_excuse_links(id),
 reference_no text not null unique, student_source_id text, student_name text not null, stage text, grade text, class_name text, track text,
 absence_date date not null, absence_days int not null, parent_note varchar(200), status text not null default 'pending' check(status in('pending','accepted','returned','rejected')),
 reviewer_user_id uuid not null, reviewer_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.student_absence_excuse_attachments (
 id uuid primary key default gen_random_uuid(), excuse_id uuid not null references public.student_absence_excuses(id), school_id text not null,
 file_id uuid, storage_path text not null, file_name text not null, mime_type text, size_bytes bigint, created_at timestamptz not null default now()
);
create index if not exists idx_abs_excuses_school on public.student_absence_excuses(school_id,created_at desc);
create index if not exists idx_abs_excuse_links_school on public.student_absence_excuse_links(school_id,created_at desc);
alter table public.student_absence_excuse_links enable row level security;
alter table public.student_absence_excuses enable row level security;
alter table public.student_absence_excuse_attachments enable row level security;
revoke all on public.student_absence_excuse_links from anon,authenticated;
revoke all on public.student_absence_excuses from anon,authenticated;
revoke all on public.student_absence_excuse_attachments from anon,authenticated;
