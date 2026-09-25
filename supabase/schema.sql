-- Easycomex — Supabase schema: auth profiles (cliente / vendedor),
-- referral program, freight quotes, contact leads, and notifications.
--
-- How to use:
-- 1. Create a free project at https://supabase.com
-- 2. Open the SQL editor in your project and run this whole file once.
-- 3. Copy Project Settings -> API -> "Project URL" and "anon public" key
--    into your .env as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
-- 4. To make someone a "vendedor" (internal team member), run:
--      update public.profiles set role = 'vendedor' where email = 'teammate@easycomex.com';
--    There is no public sign-up flow for the vendedor role on purpose —
--    every new sign-up defaults to 'cliente'.

-- Postgres no tiene `create type if not exists`, así que lo envolvemos:
-- este archivo tiene que poder correrse otra vez sin dar error.
do $$
begin
  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'user_role' and n.nspname = 'public') then
    create type public.user_role as enum ('cliente', 'vendedor');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  role public.user_role not null default 'cliente',
  referral_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  referred_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone can read their own profile.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

-- A user can see the (limited) profiles of people they referred, to
-- power the "Tus referidos" card on the dashboard.
drop policy if exists "profiles: read own referrals" on public.profiles;
create policy "profiles: read own referrals"
  on public.profiles for select
  using (referred_by = auth.uid());

-- Vendedores (internal team) can read every profile — needed for the
-- client-list dashboard.
drop policy if exists "profiles: vendedor reads all" on public.profiles;
create policy "profiles: vendedor reads all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'vendedor'
    )
  );

-- Users can update their own profile, but never their own role
-- (role changes are an admin/SQL-only action, see step 4 above).
drop policy if exists "profiles: update own, role locked" on public.profiles;
create policy "profiles: update own, role locked"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- =======================================================================
-- Notifications (in-app, shown via the bell icon on the dashboard)
-- =======================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications: mark own as read" on public.notifications;
create policy "notifications: mark own as read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No insert policy on purpose — rows are only ever created by the
-- SECURITY DEFINER trigger functions below, which bypass RLS.

create or replace function public.notify_vendedores(p_type text, p_title text, p_body text, p_link text default '/dashboard')
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link
  from public.profiles
  where role = 'vendedor';
end;
$$;

-- =======================================================================
-- Auto-create a profile row (role = cliente) whenever someone signs up.
-- If the sign-up came through a referral link (?ref=CODE, captured
-- client-side in localStorage and sent as the 'referred_by_code' auth
-- metadata field — see client/src/lib/referral.ts), resolve that code
-- to the referrer's profile id, store it in referred_by, and notify
-- the referrer.
-- =======================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  referrer_id uuid;
begin
  if new.raw_user_meta_data ->> 'referred_by_code' is not null then
    select id into referrer_id
    from public.profiles
    where referral_code = new.raw_user_meta_data ->> 'referred_by_code';
  end if;

  -- Email/password sign-ups send full_name + company; Google sign-ins
  -- send full_name / name (and avatar_url) from the Google profile.
  insert into public.profiles (id, email, full_name, company, role, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'company',
    'cliente',
    referrer_id
  )
  on conflict (id) do nothing;

  if referrer_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      referrer_id,
      'referral_signup',
      'Nuevo referido',
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email) || ' se registró con tu link.',
      '/dashboard'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =======================================================================
-- Freight quotes (calculadora de fletes)
-- =======================================================================

create table if not exists public.freight_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text,
  email text,
  phone text,
  origin text not null,
  destination text not null,
  weight_kg numeric,
  client_type text,
  status text not null default 'pending', -- pending | quoted | won | lost
  created_at timestamptz not null default now()
);

alter table public.freight_quotes enable row level security;

-- The calculator is public (no login required), so anyone can submit one.
drop policy if exists "freight_quotes: anyone can submit" on public.freight_quotes;
create policy "freight_quotes: anyone can submit"
  on public.freight_quotes for insert
  with check (true);

drop policy if exists "freight_quotes: read own" on public.freight_quotes;
create policy "freight_quotes: read own"
  on public.freight_quotes for select
  using (auth.uid() = user_id);

drop policy if exists "freight_quotes: vendedor reads all" on public.freight_quotes;
create policy "freight_quotes: vendedor reads all"
  on public.freight_quotes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

drop policy if exists "freight_quotes: vendedor updates status" on public.freight_quotes;
create policy "freight_quotes: vendedor updates status"
  on public.freight_quotes for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

create or replace function public.handle_new_freight_quote()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_vendedores(
    'new_quote',
    'Nueva cotización de flete',
    coalesce(new.name, new.email, 'Un visitante') || ': ' || new.origin || ' → ' || new.destination
  );
  return new;
end;
$$;

drop trigger if exists on_freight_quote_created on public.freight_quotes;
create trigger on_freight_quote_created
  after insert on public.freight_quotes
  for each row execute procedure public.handle_new_freight_quote();

-- =======================================================================
-- Contact form leads
-- =======================================================================

create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  country text,
  sales_channel text,
  interests text[],
  message text,
  status text not null default 'new', -- new | contacted | won | lost
  created_at timestamptz not null default now()
);

alter table public.contact_leads enable row level security;

drop policy if exists "contact_leads: anyone can submit" on public.contact_leads;
create policy "contact_leads: anyone can submit"
  on public.contact_leads for insert
  with check (true);

drop policy if exists "contact_leads: read own" on public.contact_leads;
create policy "contact_leads: read own"
  on public.contact_leads for select
  using (auth.uid() = user_id);

drop policy if exists "contact_leads: vendedor reads all" on public.contact_leads;
create policy "contact_leads: vendedor reads all"
  on public.contact_leads for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

drop policy if exists "contact_leads: vendedor updates status" on public.contact_leads;
create policy "contact_leads: vendedor updates status"
  on public.contact_leads for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

create or replace function public.handle_new_contact_lead()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_vendedores(
    'new_lead',
    'Nuevo lead de contacto',
    coalesce(new.first_name || ' ' || new.last_name, new.email, 'Un visitante') || ' llenó el formulario de contacto.'
  );
  return new;
end;
$$;

drop trigger if exists on_contact_lead_created on public.contact_leads;
create trigger on_contact_lead_created
  after insert on public.contact_leads
  for each row execute procedure public.handle_new_contact_lead();

-- =======================================================================
-- Push notification subscriptions (real push, works with the tab/app
-- closed — see SETUP.md section 6 for how to wire this up end to end).
-- One row per browser/device that opted in.
-- =======================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: manage own" on public.push_subscriptions;
create policy "push_subscriptions: manage own"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No policy grants access to other users' rows — the server-side push
-- sender reads this table with the Supabase service role key instead,
-- which bypasses RLS on purpose (see server/push.ts).

-- =======================================================================
-- Referral code for OAuth sign-ups (Google). Email sign-ups pass the
-- code as auth metadata and handle_new_user() resolves it; OAuth has no
-- metadata hook, so the client calls this right after the first login.
-- Only sets referred_by if it's still empty, never lets you refer
-- yourself, and notifies the referrer exactly like the trigger does.
-- =======================================================================

create or replace function public.apply_referral_code(p_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  referrer_id uuid;
  my_name text;
begin
  if me is null or p_code is null then
    return false;
  end if;

  select id into referrer_id from public.profiles where referral_code = p_code;
  if referrer_id is null or referrer_id = me then
    return false;
  end if;

  update public.profiles
  set referred_by = referrer_id
  where id = me and referred_by is null;

  if not found then
    return false;
  end if;

  select coalesce(full_name, email) into my_name from public.profiles where id = me;
  insert into public.notifications (user_id, type, title, body, link)
  values (referrer_id, 'referral_signup', 'Nuevo referido', my_name || ' se registró con tu link.', '/dashboard');

  return true;
end;
$$;

-- =======================================================================
-- Payments (written ONLY by the server's Stripe webhook using the
-- service-role key — see server/stripe.ts). This table is the source of
-- truth for "Plan activo" in the dashboard.
-- =======================================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text,
  plan text not null,                 -- diagnostico_madurez | analisis_mercado
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'paid', -- paid | refunded
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  receipt_url text,                    -- Stripe-hosted receipt ("Ver recibo")
  created_at timestamptz not null default now()
);

-- Safe to re-run on a project that created the table before this column existed.
alter table public.payments add column if not exists receipt_url text;
-- status also takes 'pending' (voucher/bank-debit payments that clear
-- later) and 'failed' (the buyer never completed one of those).

alter table public.payments enable row level security;

drop policy if exists "payments: read own" on public.payments;
create policy "payments: read own"
  on public.payments for select
  using (auth.uid() = user_id);

drop policy if exists "payments: vendedor reads all" on public.payments;
create policy "payments: vendedor reads all"
  on public.payments for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

-- No insert/update policy on purpose: only the service-role key (server)
-- can write here, so a client can never mark itself as paid.

-- Tell the team when money comes in.
create or replace function public.handle_new_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_vendedores(
    'new_payment',
    'Nuevo pago recibido',
    coalesce(new.email, 'Un cliente') || ' pagó ' || new.plan || ' (' || (new.amount_cents / 100.0)::text || ' ' || upper(new.currency) || ')'
  );
  if new.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'payment_confirmed', 'Pago confirmado', 'Tu pago fue recibido. Te contactamos en menos de 24 horas.', '/dashboard');
  end if;
  return new;
end;
$$;

drop trigger if exists on_payment_created on public.payments;
create trigger on_payment_created
  after insert on public.payments
  for each row execute procedure public.handle_new_payment();

-- =======================================================================
-- Stripe customer id on the profile.
--
-- One Stripe Customer per buyer is what ties receipts, invoices,
-- subscriptions and the billing portal to the same person. Written only
-- by the server (service-role key); the "update own, role locked"
-- policy below already prevents a client from changing it.
-- =======================================================================

alter table public.profiles add column if not exists stripe_customer_id text unique;

-- =======================================================================
-- Subscriptions (recurring plans). Written ONLY by the Stripe webhook.
--
-- Whether a plan is one-off or recurring is decided by the price you
-- create in Stripe — the server reads the price and picks the checkout
-- mode. If every plan stays one-off this table simply stays empty.
-- =======================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  plan text,
  status text not null,                 -- active | trialing | past_due | canceled | unpaid
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "subscriptions: vendedor reads all" on public.subscriptions;
create policy "subscriptions: vendedor reads all"
  on public.subscriptions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

-- No insert/update policy on purpose: the server's service-role key is
-- the only writer, so nobody can grant themselves an active plan.

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, status);

-- =======================================================================
-- Stripe webhook event log — replay protection.
--
-- Stripe retries an event until it receives a 2xx and can deliver the
-- same event more than once. The server inserts the event id before
-- handling it: a duplicate hits this unique key and is skipped, so a
-- retry can never charge, record or notify twice.
-- =======================================================================

create table if not exists public.stripe_events (
  id text primary key,                  -- Stripe event id (evt_...)
  type text,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- Deliberately no policies: server-only table, invisible to every client.

-- ---------------------------------------------------------------------
-- Suggested next table (not created here, add when you build it):
--
-- referral_commissions (id, referrer_id -> profiles.id, referred_id ->
--                        profiles.id, payment_id -> payments.id, amount,
--                        status, created_at)
--   If you want to pay out real commissions (not just track who
--   referred whom), add this once a referral converts to a paid plan.
-- ---------------------------------------------------------------------

-- =======================================================================
-- Marco Polo research desk: Kalodata / Sicex lookups with a daily quota.
--
-- Each plan includes N free lookups per day (the number lives in
-- server/research.ts, so pricing changes do not need a migration). Past
-- that the user spends credits bought with Stripe.
--
-- Everything is written by the server with the service-role key. The
-- client can read its own usage (to show "3 left today") but can never
-- insert a row or hand itself credits.
-- =======================================================================

create table if not exists public.research_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,                 -- kalodata | sicex
  query text,
  billed text not null,                 -- free | credit
  created_at timestamptz not null default now()
);

alter table public.research_usage enable row level security;

drop policy if exists "research_usage: read own" on public.research_usage;
create policy "research_usage: read own"
  on public.research_usage for select
  using (auth.uid() = user_id);

drop policy if exists "research_usage: vendedor reads all" on public.research_usage;
create policy "research_usage: vendedor reads all"
  on public.research_usage for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

-- The daily count is the hottest query in this feature.
create index if not exists research_usage_daily_idx
  on public.research_usage (user_id, billed, created_at desc);

create table if not exists public.research_credits (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.research_credits enable row level security;

drop policy if exists "research_credits: read own" on public.research_credits;
create policy "research_credits: read own"
  on public.research_credits for select
  using (auth.uid() = user_id);

-- No insert/update policy: only the Stripe webhook (service role) grants
-- credits, so nobody can top themselves up for free.

-- ---------------------------------------------------------------------
-- spend_research_quota: decide and record in ONE atomic statement.
--
-- Returns 'free' (a free daily lookup was used), 'credit' (a purchased
-- credit was spent) or 'blocked' (nothing left). Without this being a
-- single transaction, two parallel requests could both spend the last
-- free lookup — the classic double-spend.
-- ---------------------------------------------------------------------
create or replace function public.spend_research_quota(
  p_user_id uuid,
  p_daily_limit integer,
  p_source text,
  p_query text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_billed text;
begin
  -- Lock this user's credit row (creating it if needed) so the whole
  -- decision for one user is serialized.
  insert into public.research_credits (user_id, credits)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  perform 1 from public.research_credits where user_id = p_user_id for update;

  select count(*) into v_used
  from public.research_usage
  where user_id = p_user_id
    and billed = 'free'
    and created_at >= date_trunc('day', now() at time zone 'utc');

  if v_used < p_daily_limit then
    v_billed := 'free';
  elsif (select credits from public.research_credits where user_id = p_user_id) > 0 then
    update public.research_credits
      set credits = credits - 1, updated_at = now()
      where user_id = p_user_id;
    v_billed := 'credit';
  else
    return 'blocked';
  end if;

  insert into public.research_usage (user_id, source, query, billed)
  values (p_user_id, p_source, left(coalesce(p_query, ''), 160), v_billed);

  return v_billed;
end;
$$;

revoke all on function public.spend_research_quota(uuid, integer, text, text) from public, anon, authenticated;

-- Give the lookup back when the provider itself failed: drop the usage
-- row we just wrote and return the credit if one was spent.
create or replace function public.refund_research_quota(p_user_id uuid, p_billed text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.research_usage
  where user_id = p_user_id and billed = p_billed
  order by created_at desc
  limit 1;

  if v_id is not null then
    delete from public.research_usage where id = v_id;
    if p_billed = 'credit' then
      update public.research_credits
        set credits = credits + 1, updated_at = now()
        where user_id = p_user_id;
    end if;
  end if;
end;
$$;

revoke all on function public.refund_research_quota(uuid, text) from public, anon, authenticated;

-- Credits bought with Stripe land here (see recordPayment in
-- server/stripe.ts): the webhook is the only writer.
create or replace function public.grant_research_credits(p_user_id uuid, p_credits integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.research_credits (user_id, credits)
  values (p_user_id, greatest(p_credits, 0))
  on conflict (user_id) do update
    set credits = public.research_credits.credits + greatest(p_credits, 0),
        updated_at = now();
end;
$$;

revoke all on function public.grant_research_credits(uuid, integer) from public, anon, authenticated;

-- =======================================================================
-- Diagnóstico de madurez.
--
-- One row per completed diagnosis: who took it, what they answered, the
-- score, and whether they paid to unlock the recommended actions.
--
-- Written and read ONLY by the server (service-role key). No client
-- policies on purpose: the recommended actions are the paid product, so
-- they must never reach a browser that has not paid — which is why the
-- answers live here and the server decides what to send back.
-- =======================================================================

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  -- Payment reference; also the key the client uses to fetch its result.
  ref text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  empresa text,
  nombre text,
  celular text,
  correo text,
  pais text,
  -- Answers indexed the same way as FLAT in diagnosticContent.ts.
  answers jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  gaps integer not null default 0,
  paid boolean not null default false,
  amount_cents integer,
  currency text,
  gateway text,                          -- wompi | stripe
  transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.diagnostics enable row level security;
-- Deliberately no policies: server-only table.

create index if not exists diagnostics_created_idx on public.diagnostics (created_at desc);
create index if not exists diagnostics_user_idx on public.diagnostics (user_id, created_at desc);

-- Tell the team when someone finishes a diagnosis.
create or replace function public.handle_new_diagnostic()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_vendedores(
    'new_diagnostic',
    'Nuevo diagnóstico de madurez',
    coalesce(new.empresa, new.correo, 'Alguien') || ' obtuvo ' || new.score || '% (' || new.gaps || ' brechas).'
  );
  return new;
end;
$$;

drop trigger if exists on_diagnostic_created on public.diagnostics;
create trigger on_diagnostic_created
  after insert on public.diagnostics
  for each row execute procedure public.handle_new_diagnostic();

-- ---------------------------------------------------------------------
-- Freight calculator: the quoted price travels with the lead.
-- ---------------------------------------------------------------------
alter table public.freight_quotes add column if not exists zone text;
alter table public.freight_quotes add column if not exists quote_cop integer;
