-- BSG Kitchen Standards: Supabase setup (run once: SQL Editor -> New query -> paste -> Run)
-- Safe to run again, and safe if you ran the OLDER setup before.
-- No secrets to type in the app. Only the Vercel server (service key) can touch these tables.

-- 0. Clean up the older version (removes its secret column and old functions; does nothing if they are not there)
alter table if exists public.bsg_state drop column if exists secret_hash;
drop function if exists public.bsg_pull(text, text);
drop function if exists public.bsg_push(text, text, jsonb, bigint);
drop function if exists public.bsg_check(text, text);

-- 1. Tables
create table if not exists public.bsg_state (
  org         text primary key,
  data        jsonb  not null default '{}'::jsonb,
  version     bigint not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.bsg_snapshots (
  id          bigserial primary key,
  org         text   not null,
  version     bigint not null,
  data        jsonb  not null,
  created_at  timestamptz not null default now()
);
create index if not exists bsg_snapshots_org_time on public.bsg_snapshots (org, created_at desc);

-- 2. Lock both tables for the public key (RLS on, no policies). The Vercel functions use the service key, which bypasses this.
alter table public.bsg_state     enable row level security;
alter table public.bsg_snapshots enable row level security;
revoke all on public.bsg_state, public.bsg_snapshots from anon, authenticated;
revoke all on sequence public.bsg_snapshots_id_seq from anon, authenticated;

-- 3. Private bucket for photo evidence
insert into storage.buckets (id, name, public) values ('bsg-evidence', 'bsg-evidence', false)
on conflict (id) do nothing;

-- 4. Your organisation row (the name must match BSG_ORG in Vercel; default is bsg)
insert into public.bsg_state (org) values ('bsg') on conflict (org) do nothing;
