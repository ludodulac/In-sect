-- Applied to Supabase project IN-SECT (nczdadkyysrxxcsnsrrn)
-- Migration name: create_drop_service_core
-- Keep all Drop Service objects prefixed drop_service_ to avoid collisions with the game.

create table public.drop_service_artisans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  activity text not null check (char_length(activity) between 2 and 120),
  service_area text,
  phone text,
  email text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drop_service_requests (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.drop_service_artisans(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 40),
  email text,
  city text not null check (char_length(city) between 1 and 120),
  category text not null check (char_length(category) between 1 and 120),
  description text not null check (char_length(description) between 5 and 4000),
  urgency text not null default 'normal' check (urgency in ('low','normal','urgent')),
  availability text,
  status text not null default 'new' check (status in ('new','contacted','quote_sent','won','lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drop_service_requests_artisan_created_idx
  on public.drop_service_requests (artisan_id, created_at desc);
create index drop_service_requests_artisan_status_idx
  on public.drop_service_requests (artisan_id, status);

create or replace function public.drop_service_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.drop_service_set_updated_at() from public, anon, authenticated;

create trigger drop_service_artisans_set_updated_at
before update on public.drop_service_artisans
for each row execute function public.drop_service_set_updated_at();

create trigger drop_service_requests_set_updated_at
before update on public.drop_service_requests
for each row execute function public.drop_service_set_updated_at();

alter table public.drop_service_artisans enable row level security;
alter table public.drop_service_requests enable row level security;

revoke all on table public.drop_service_artisans from anon, authenticated;
revoke all on table public.drop_service_requests from anon, authenticated;

grant select on table public.drop_service_artisans to anon;
grant select, insert, update on table public.drop_service_artisans to authenticated;
grant insert on table public.drop_service_requests to anon;
grant insert, select, update on table public.drop_service_requests to authenticated;

create policy "drop_service_public_can_view_active_artisans"
on public.drop_service_artisans for select to anon
using (is_active = true);

create policy "drop_service_artisans_can_view_own_profile"
on public.drop_service_artisans for select to authenticated
using ((select auth.uid()) = user_id);

create policy "drop_service_artisans_can_create_own_profile"
on public.drop_service_artisans for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "drop_service_artisans_can_update_own_profile"
on public.drop_service_artisans for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "drop_service_public_can_submit_request"
on public.drop_service_requests for insert to anon
with check (
  exists (
    select 1 from public.drop_service_artisans a
    where a.id = artisan_id and a.is_active = true
  )
  and status = 'new'
);

create policy "drop_service_authenticated_can_submit_request"
on public.drop_service_requests for insert to authenticated
with check (
  exists (
    select 1 from public.drop_service_artisans a
    where a.id = artisan_id and a.is_active = true
  )
  and status = 'new'
);

create policy "drop_service_artisans_can_view_own_requests"
on public.drop_service_requests for select to authenticated
using (
  exists (
    select 1 from public.drop_service_artisans a
    where a.id = artisan_id and a.user_id = (select auth.uid())
  )
);

create policy "drop_service_artisans_can_update_own_requests"
on public.drop_service_requests for update to authenticated
using (
  exists (
    select 1 from public.drop_service_artisans a
    where a.id = artisan_id and a.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.drop_service_artisans a
    where a.id = artisan_id and a.user_id = (select auth.uid())
  )
);
