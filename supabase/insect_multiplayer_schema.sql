-- IN-SECT multiplayer V1
-- These tables are intentionally NOT exposed to browser clients.
-- Edge Function `insect-match` accesses them with the server-side secret key.

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
  expires_at timestamptz not null default (now() + interval '24 hours'),
  host_sp_vote boolean,
  guest_sp_vote boolean,
  sp_enabled boolean,
  sp_decided_at timestamptz
);

-- Additive compatibility for databases created from an older version of this file.
alter table public.insect_matches add column if not exists host_sp_vote boolean;
alter table public.insect_matches add column if not exists guest_sp_vote boolean;
alter table public.insect_matches add column if not exists sp_enabled boolean;
alter table public.insect_matches add column if not exists sp_decided_at timestamptz;

create index if not exists insect_matches_code_idx on public.insect_matches (code);
create index if not exists insect_matches_expires_idx on public.insect_matches (expires_at);

create table if not exists public.insect_matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  player_secret_hash text not null unique,
  requested_at timestamptz not null default now(),
  matched_code text,
  matched_role text check (matched_role in ('host','guest')),
  consumed boolean not null default false,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  queue_secret_hash text,
  match_secret text,
  last_seen_at timestamptz not null default now()
);

-- Heartbeat used by Edge Function v4 to reject abandoned/ghost searches.
alter table public.insect_matchmaking_queue add column if not exists queue_secret_hash text;
alter table public.insect_matchmaking_queue add column if not exists match_secret text;
alter table public.insect_matchmaking_queue add column if not exists last_seen_at timestamptz not null default now();

create index if not exists insect_matchmaking_queue_waiting_idx
  on public.insect_matchmaking_queue (consumed, expires_at, last_seen_at, requested_at)
  where matched_code is null;

alter table public.insect_matches enable row level security;
alter table public.insect_matchmaking_queue enable row level security;

-- No anon/authenticated policies on purpose: browser access is denied.
-- All multiplayer operations go through the Edge Function, which authenticates
-- room and matchmaking requests with unguessable per-player secrets.
revoke all on table public.insect_matches from anon, authenticated;
revoke all on table public.insect_matchmaking_queue from anon, authenticated;
