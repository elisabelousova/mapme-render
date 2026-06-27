create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null unique,
  token text not null unique,
  first_name text not null default '',
  username text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  title text not null,
  city text not null,
  category text not null default 'place',
  note text not null default '',
  source_url text not null default '',
  raw_text text not null default '',
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now(),
  unique(user_id, key)
);

create index if not exists places_user_created_idx on public.places(user_id, created_at desc);

alter table public.users enable row level security;
alter table public.places enable row level security;
