create extension if not exists pgcrypto;

create table if not exists public.school_external_access_tokens (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  access_type text not null check (access_type in ('external_evaluation','supervisor_visit')),
  token_hash text not null unique,
  visit_number text,
  permissions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','closed','revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);
create index if not exists idx_school_external_access_school on public.school_external_access_tokens(school_id,access_type,status);
create index if not exists idx_school_external_access_hash on public.school_external_access_tokens(token_hash);

alter table public.school_external_access_tokens enable row level security;
revoke all on public.school_external_access_tokens from anon, authenticated;

create or replace function public.register_school_external_access(
  p_token text,
  p_school_id uuid,
  p_access_type text,
  p_created_by uuid,
  p_visit_number text default null,
  p_permissions jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_status text default 'active',
  p_expires_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_role text;
  v_hash text;
  v_id uuid;
begin
  if coalesce(length(trim(p_token)),0) < 16 then raise exception 'TOKEN_TOO_SHORT'; end if;
  if p_access_type not in ('external_evaluation','supervisor_visit') then raise exception 'INVALID_ACCESS_TYPE'; end if;
  select role into v_role from public.users where id=p_created_by and school_id=p_school_id and coalesce(status,'active')='active' limit 1;
  if coalesce(v_role,'') not in ('manager','owner') then raise exception 'NOT_AUTHORIZED'; end if;
  v_hash := encode(digest(p_token,'sha256'),'hex');
  insert into public.school_external_access_tokens(
    school_id,access_type,token_hash,visit_number,permissions,metadata,status,created_by,expires_at,updated_at,revoked_at,revoked_by
  ) values (
    p_school_id,p_access_type,v_hash,p_visit_number,coalesce(p_permissions,'{}'::jsonb),coalesce(p_metadata,'{}'::jsonb),
    case when p_status in ('active','closed','revoked') then p_status else 'active' end,p_created_by,p_expires_at,now(),null,null
  )
  on conflict (token_hash) do update set
    school_id=excluded.school_id,
    access_type=excluded.access_type,
    visit_number=excluded.visit_number,
    permissions=excluded.permissions,
    metadata=excluded.metadata,
    status=excluded.status,
    expires_at=excluded.expires_at,
    updated_at=now(),
    revoked_at=null,
    revoked_by=null
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.validate_school_external_access(
  p_token text,
  p_access_type text
) returns table(
  access_id uuid,
  school_id uuid,
  school_name text,
  access_type text,
  visit_number text,
  permissions jsonb,
  metadata jsonb,
  status text,
  expires_at timestamptz
)
language sql security definer set search_path=public
as $$
  select a.id,a.school_id,s.school_name,a.access_type,a.visit_number,a.permissions,a.metadata,
         case when a.expires_at is not null and a.expires_at <= now() then 'expired' else a.status end,
         a.expires_at
  from public.school_external_access_tokens a
  join public.schools s on s.id=a.school_id
  where a.token_hash=encode(digest(p_token,'sha256'),'hex')
    and a.access_type=p_access_type
  limit 1
$$;

create or replace function public.revoke_school_external_access(
  p_token text,
  p_school_id uuid,
  p_revoked_by uuid
) returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_role text; v_count int;
begin
  select role into v_role from public.users where id=p_revoked_by and school_id=p_school_id and coalesce(status,'active')='active' limit 1;
  if coalesce(v_role,'') not in ('manager','owner') then raise exception 'NOT_AUTHORIZED'; end if;
  update public.school_external_access_tokens
     set status='revoked', revoked_at=now(), revoked_by=p_revoked_by, updated_at=now()
   where school_id=p_school_id and token_hash=encode(digest(p_token,'sha256'),'hex') and status<>'revoked';
  get diagnostics v_count = row_count;
  return v_count>0;
end $$;

create or replace function public.list_external_visit_users(p_token text)
returns table(id uuid, full_name text, email text, role text, status text)
language sql security definer set search_path=public
as $$
  with access as (
    select a.school_id
    from public.school_external_access_tokens a
    where a.token_hash=encode(digest(p_token,'sha256'),'hex')
      and a.access_type='supervisor_visit'
      and a.status='active'
      and (a.expires_at is null or a.expires_at>now())
    limit 1
  )
  select u.id,coalesce(to_jsonb(u)->>'full_name',to_jsonb(u)->>'name',''),coalesce(to_jsonb(u)->>'email',''),u.role,coalesce(u.status,'active')
  from public.users u join access a on a.school_id=u.school_id
  where coalesce(u.status,'active')='active' and u.role in ('manager','agent','teacher','student_advisor')
  order by u.role,coalesce(to_jsonb(u)->>'full_name',to_jsonb(u)->>'name',to_jsonb(u)->>'email','')
$$;

grant execute on function public.register_school_external_access(text,uuid,text,uuid,text,jsonb,jsonb,text,timestamptz) to anon, authenticated;
grant execute on function public.validate_school_external_access(text,text) to anon, authenticated;
grant execute on function public.revoke_school_external_access(text,uuid,uuid) to anon, authenticated;
grant execute on function public.list_external_visit_users(text) to anon, authenticated;
