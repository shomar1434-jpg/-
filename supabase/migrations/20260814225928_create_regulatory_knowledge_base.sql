create extension if not exists vector;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'عام',
  authority text not null default 'وزارة التعليم',
  version_label text,
  issue_date date,
  effective_date date,
  status text not null default 'active' check (status in ('draft','active','superseded','archived')),
  replaces_document_id uuid references public.knowledge_documents(id) on delete set null,
  storage_bucket text not null default 'regulatory-knowledge',
  storage_path text not null,
  original_name text not null,
  mime_type text,
  file_size bigint,
  page_count integer not null default 0,
  chunk_count integer not null default 0,
  source_hash text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists knowledge_documents_status_idx on public.knowledge_documents(status,category,updated_at desc);
create unique index if not exists knowledge_documents_source_hash_uq on public.knowledge_documents(source_hash) where source_hash is not null;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  heading text,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id,chunk_index)
);
create index if not exists knowledge_chunks_document_idx on public.knowledge_chunks(document_id,chunk_index);
create index if not exists knowledge_chunks_embedding_idx on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists=100);

create table if not exists public.knowledge_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  document_id uuid references public.knowledge_documents(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_audit_log enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('regulatory-knowledge','regulatory-knowledge',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/msword'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.match_knowledge_chunks(
 query_embedding vector(1536), match_threshold double precision default .22,
 match_count integer default 8, category_filter text default null)
returns table(chunk_id uuid,document_id uuid,title text,category text,authority text,version_label text,page_start integer,page_end integer,heading text,content text,similarity double precision)
language sql stable security definer set search_path=public as $$
 select c.id,d.id,d.title,d.category,d.authority,d.version_label,c.page_start,c.page_end,c.heading,c.content,
        (1-(c.embedding <=> query_embedding))::double precision
 from public.knowledge_chunks c join public.knowledge_documents d on d.id=c.document_id
 where d.status='active' and c.embedding is not null
   and (category_filter is null or d.category=category_filter)
   and (1-(c.embedding <=> query_embedding))>=match_threshold
 order by c.embedding <=> query_embedding
 limit greatest(1,least(match_count,20));
$$;
revoke all on function public.match_knowledge_chunks(vector,double precision,integer,text) from public;
