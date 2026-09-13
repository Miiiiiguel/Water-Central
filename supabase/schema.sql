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

create type public.user_role as enum ('cliente', 'vendedor');

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
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

-- A user can see the (limited) profiles of people they referred, to
-- power the "Tus referidos" card on the dashboard.
create policy "profiles: read own referrals"
  on public.profiles for select
  using (referred_by = auth.uid());

-- Vendedores (internal team) can read every profile — needed for the
-- client-list dashboard.
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
create policy "profiles: update own, role locked"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

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

create policy "notifications: read own"
  on public.notifications for select
  using (auth.uid() = user_id);

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

  insert into public.profiles (id, email, full_name, company, role, referred_by)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
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
create policy "freight_quotes: anyone can submit"
  on public.freight_quotes for insert
  with check (true);

create policy "freight_quotes: read own"
  on public.freight_quotes for select
  using (auth.uid() = user_id);

create policy "freight_quotes: vendedor reads all"
  on public.freight_quotes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

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

create policy "contact_leads: anyone can submit"
  on public.contact_leads for insert
  with check (true);

create policy "contact_leads: read own"
  on public.contact_leads for select
  using (auth.uid() = user_id);

create policy "contact_leads: vendedor reads all"
  on public.contact_leads for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor'));

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

create policy "push_subscriptions: manage own"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No policy grants access to other users' rows — the server-side push
-- sender reads this table with the Supabase service role key instead,
-- which bypasses RLS on purpose (see server/push.ts).

-- ---------------------------------------------------------------------
-- Suggested next tables (not created here, add when you build the
-- matching feature):
--
-- plan_subscriptions (id, user_id -> profiles.id, plan, stripe_customer_id,
--                      stripe_subscription_id, status, created_at)
--   Feeds the "Elige tu plan" card and links to Stripe (see server/stripe.ts).
--
-- referral_commissions (id, referrer_id -> profiles.id, referred_id ->
--                        profiles.id, amount, status, created_at)
--   If you want to pay out real commissions (not just track who
--   referred whom), add this once a referral converts to a paid plan.
-- ---------------------------------------------------------------------
