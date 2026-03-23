-- file location: supabase/migrations/20260323_vhc_customer_media.sql

create table if not exists public.vhc_customer_media (
  id uuid primary key default gen_random_uuid(),
  job_number text not null,
  media_type text not null check (media_type in ('video', 'image')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text,
  mime_type text,
  file_size_bytes bigint,
  overlays jsonb not null default '[]'::jsonb,
  context_label text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vhc_customer_media_job_number_idx on public.vhc_customer_media (job_number);
create index if not exists vhc_customer_media_created_at_idx on public.vhc_customer_media (created_at desc);

create or replace function public.vhc_customer_media_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vhc_customer_media_updated_at on public.vhc_customer_media;
create trigger trg_vhc_customer_media_updated_at
before update on public.vhc_customer_media
for each row
execute function public.vhc_customer_media_set_updated_at();

alter table public.vhc_customer_media enable row level security;

-- authenticated staff can read/write their workshop media records
drop policy if exists "vhc_customer_media_select_authenticated" on public.vhc_customer_media;
create policy "vhc_customer_media_select_authenticated"
on public.vhc_customer_media
for select
to authenticated
using (true);

drop policy if exists "vhc_customer_media_insert_authenticated" on public.vhc_customer_media;
create policy "vhc_customer_media_insert_authenticated"
on public.vhc_customer_media
for insert
to authenticated
with check (true);

drop policy if exists "vhc_customer_media_update_authenticated" on public.vhc_customer_media;
create policy "vhc_customer_media_update_authenticated"
on public.vhc_customer_media
for update
to authenticated
using (true)
with check (true);

-- Storage bucket and policies
insert into storage.buckets (id, name, public)
values ('vhc-customer-media', 'vhc-customer-media', true)
on conflict (id) do nothing;

drop policy if exists "vhc_customer_media_storage_read" on storage.objects;
create policy "vhc_customer_media_storage_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'vhc-customer-media');

drop policy if exists "vhc_customer_media_storage_insert" on storage.objects;
create policy "vhc_customer_media_storage_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'vhc-customer-media');

drop policy if exists "vhc_customer_media_storage_update" on storage.objects;
create policy "vhc_customer_media_storage_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'vhc-customer-media')
with check (bucket_id = 'vhc-customer-media');
