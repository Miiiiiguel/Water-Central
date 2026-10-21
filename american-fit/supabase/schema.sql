-- American Fit · Supabase schema. Run once in the SQL editor.
--
-- af_user_state     each account's app data (workouts, meals, weight…), one JSON row
-- af_subscriptions  the active plan; written only by the payments webhook
-- af_payments       every checkout attempt and its result; written only by functions

create table if not exists public.af_user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.af_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('pro', 'elite')),
  period text not null check (period in ('monthly', 'yearly')),
  provider text not null check (provider in ('wompi', 'stripe')),
  status text not null check (status in ('active', 'canceled', 'past_due')),
  current_period_end timestamptz not null,
  provider_ref text,
  updated_at timestamptz not null default now()
);

create table if not exists public.af_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('wompi', 'stripe')),
  reference text not null unique,
  plan text not null,
  period text not null,
  amount numeric not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.af_user_state enable row level security;
alter table public.af_subscriptions enable row level security;
alter table public.af_payments enable row level security;

-- Each person reads and writes only their own data.
drop policy if exists "own state" on public.af_user_state;
create policy "own state" on public.af_user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Plans and payments are read-only from the app; the service role (Edge
-- Functions) is the only writer, so nobody can grant themselves a plan.
drop policy if exists "read own subscription" on public.af_subscriptions;
create policy "read own subscription" on public.af_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "read own payments" on public.af_payments;
create policy "read own payments" on public.af_payments
  for select using (auth.uid() = user_id);

-- Support cases created from the app's help panel.
create table if not exists public.af_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ref text not null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'abierto' check (status in ('abierto', 'en-revision', 'resuelto')),
  created_at timestamptz not null default now()
);

alter table public.af_support_tickets enable row level security;

drop policy if exists "own tickets read" on public.af_support_tickets;
create policy "own tickets read" on public.af_support_tickets
  for select using (auth.uid() = user_id);

drop policy if exists "own tickets create" on public.af_support_tickets;
create policy "own tickets create" on public.af_support_tickets
  for insert with check (auth.uid() = user_id);

-- One-time purchases from the Tienda reuse af_payments with a product id.
alter table public.af_payments add column if not exists product text;
alter table public.af_payments alter column plan drop not null;
alter table public.af_payments alter column period drop not null;
