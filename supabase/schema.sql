# Supabase SQL – run once in the SQL editor
# Creates the `sessions` table used by the Chrome Extension & Playwright driver.

create table if not exists public.sessions (
  id            uuid default gen_random_uuid() primary key,
  telegram_user_id bigint not null,
  cookies       jsonb not null,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- Index for fast lookups
create index if not exists idx_sessions_user_active
  on public.sessions (telegram_user_id, is_active);

-- RLS (optional – service-role key bypasses RLS anyway)
alter table public.sessions enable row level security;
