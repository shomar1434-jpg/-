-- Smart School Platform - Supabase compatibility check
-- Optional: run only if saving still fails due to missing columns.
alter table public.schools
add column if not exists manager_name text,
add column if not exists manager_email text,
add column if not exists status text default 'active',
add column if not exists active boolean default true,
add column if not exists registration_code text,
add column if not exists login_link text,
add column if not exists created_at timestamp with time zone default now();

alter table public.users
add column if not exists name text,
add column if not exists password text,
add column if not exists role text,
add column if not exists status text default 'pending',
add column if not exists active boolean default false,
add column if not exists is_primary_manager boolean default false,
add column if not exists must_change_password boolean default false,
add column if not exists created_at timestamp with time zone default now();

NOTIFY pgrst, 'reload schema';
