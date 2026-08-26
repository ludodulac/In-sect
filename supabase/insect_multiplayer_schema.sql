-- IN-SECT multiplayer V1
-- This table is intentionally NOT exposed to browser clients.
-- Edge Function `insect-match` accesses it with the server-side secret key.

create table if not exists public.insect_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  status text not null default 'waiting' check (status in ('waiting','active','finished','expired')),
  host_secret_hash text not null,
  guest_secret_hash text,
  state jsonb,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists insect_matches_code_idx on public.insect_matches (code);
create index if not exists insect_matches_expires_idx on public.insect_matches (expires_at);

alter table public.insect_matches enable row level security;

-- No anon/authenticated policies on purpose: browser access is denied.
-- All multiplayer operations go through the Edge Function, which authenticates
-- each room request with an unguessable per-player secret.

revoke all on table public.insect_matches from anon, authenticated;
