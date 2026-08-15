alter table public.internal_messages add column if not exists acknowledgement_mode text not null default 'none';
alter table public.internal_messages drop constraint if exists internal_messages_acknowledgement_mode_check;
alter table public.internal_messages add constraint internal_messages_acknowledgement_mode_check check (acknowledgement_mode in ('none','read_receipt','signature'));

alter table public.internal_message_recipients add column if not exists signature_storage_path text;
alter table public.internal_message_recipients add column if not exists signature_hash text;
alter table public.internal_message_recipients add column if not exists signature_mime_type text;
alter table public.internal_message_recipients add column if not exists signed_at timestamptz;
alter table public.internal_message_recipients add column if not exists acknowledgement_metadata jsonb not null default '{}'::jsonb;

create index if not exists internal_message_recipients_signature_idx
on public.internal_message_recipients(message_id,signed_at) where signed_at is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('internal-message-signatures','internal-message-signatures',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
