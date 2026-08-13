create table if not exists public.school_staff_discipline_states (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 academic_year text not null,
 state jsonb not null default '{}'::jsonb,
 updated_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,academic_year)
);
create index if not exists school_staff_discipline_school_year_idx on public.school_staff_discipline_states(school_id,academic_year);
alter table public.school_staff_discipline_states enable row level security;
-- الوصول التشغيلي يتم عبر platform-discipline بعد التحقق من جلسة المنصة و school_id.
