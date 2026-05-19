-- Supabase patch: أعمدة مطلوبة لربط المدارس والمستخدمين
-- نفّذه مرة واحدة إذا ظهرت أخطاء أعمدة مفقودة في Console

alter table public.schools
add column if not exists school_name text,
add column if not exists school_code text,
add column if not exists manager_name text,
add column if not exists manager_email text,
add column if not exists status text default 'pending',
add column if not exists registration_code text,
add column if not exists registration_link text,
add column if not exists login_link text,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

alter table public.users
add column if not exists school_id uuid,
add column if not exists full_name text,
add column if not exists name text,
add column if not exists email text,
add column if not exists password text,
add column if not exists role text default 'teacher',
add column if not exists status text default 'pending',
add column if not exists is_primary_manager boolean default false,
add column if not exists must_change_password boolean default false,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();
