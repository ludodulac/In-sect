create table public.drop_service_request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.drop_service_requests(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table public.drop_service_request_photos enable row level security;

grant insert on public.drop_service_request_photos to anon, authenticated;
grant select on public.drop_service_request_photos to authenticated;
grant select, insert, update, delete on public.drop_service_request_photos to service_role;

create policy "drop_service_public_can_attach_photo"
on public.drop_service_request_photos
for insert to anon
with check (true);

create policy "drop_service_authenticated_can_attach_photo"
on public.drop_service_request_photos
for insert to authenticated
with check (true);

create policy "drop_service_artisans_can_view_own_request_photos"
on public.drop_service_request_photos
for select to authenticated
using (
  exists (
    select 1
    from public.drop_service_requests r
    join public.drop_service_artisans a on a.id = r.artisan_id
    where r.id = drop_service_request_photos.request_id
      and a.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drop-service-request-photos',
  'drop-service-request-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "drop_service_public_can_upload_request_photos"
on storage.objects
for insert to anon
with check (
  bucket_id = 'drop-service-request-photos'
  and (storage.foldername(name))[1] = 'requests'
);

create policy "drop_service_authenticated_can_upload_request_photos"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'drop-service-request-photos'
  and (storage.foldername(name))[1] = 'requests'
);

create policy "drop_service_artisans_can_read_own_request_photos"
on storage.objects
for select to authenticated
using (
  bucket_id = 'drop-service-request-photos'
  and exists (
    select 1
    from public.drop_service_request_photos p
    join public.drop_service_requests r on r.id = p.request_id
    join public.drop_service_artisans a on a.id = r.artisan_id
    where p.storage_path = storage.objects.name
      and a.user_id = (select auth.uid())
  )
);
