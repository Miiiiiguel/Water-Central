-- Easycomex — Supabase schema for auth profiles (cliente / vendedor)
-- + referral program tracking
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

-- Auto-create a profile row (role = cliente) whenever someone signs up.
-- If the sign-up came through a referral link (?ref=CODE, captured
-- client-side in localStorage and sent as the 'referred_by_code' auth
-- metadata field — see client/src/lib/referral.ts), resolve that code
-- to the referrer's profile id and store it in referred_by.
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Suggested next tables (not created here, add when you build the
-- matching feature):
--
-- freight_quotes   (id, user_id -> profiles.id, origin, destination,
--                    weight_kg, client_type, status, created_at)
--   Feeds the "Tus cotizaciones de flete" card on the client dashboard
--   and the freight calculator form.
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
