-- USACARGOS SHOP · esquema aislado "shop" (no expuesto por la API de Supabase).
-- El servidor accede SOLO mediante public.shop_api(secret, action, args), que valida una clave secreta.

create schema if not exists shop;
create schema if not exists shop_private;
revoke all on schema shop, shop_private from public, anon, authenticated;

create table if not exists shop_private.config (key text primary key, value text not null);

create table if not exists shop.products (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  price integer not null check (price >= 0),
  cost integer,
  stock integer not null default 0 check (stock >= 0),
  image text,
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists shop.affiliates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  token text not null,
  name text not null,
  email text not null unique,
  phone text not null,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists shop.orders (
  id uuid primary key default gen_random_uuid(),
  code text,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  payment_method text not null default 'mercadopago' check (payment_method in ('mercadopago','contraentrega')),
  fulfillment text not null default 'unfulfilled' check (fulfillment in ('unfulfilled','packed','shipped','delivered','cancelled')),
  ref_code text references shop.affiliates(code),
  customer jsonb not null,
  items jsonb not null,
  subtotal integer not null,
  shipping integer not null default 0,
  total integer not null,
  commission integer not null default 0,
  commission_status text not null default 'none' check (commission_status in ('none','pending','paid','cancelled')),
  stock_applied boolean not null default false,
  carrier text,
  tracking text,
  admin_note text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz, packed_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on shop.orders (created_at desc);
create index if not exists orders_ref_idx on shop.orders (ref_code);

create table if not exists shop.order_events (
  id bigserial primary key,
  order_id uuid not null references shop.orders(id) on delete cascade,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on shop.order_events (order_id, created_at);

-- PQRS: peticiones, quejas, reclamos, sugerencias, garantías y retractos (formulario /contacto)
create table if not exists shop.messages (
  id uuid primary key default gen_random_uuid(),
  code text,
  kind text not null default 'peticion' check (kind in ('peticion','queja','reclamo','sugerencia','garantia','retracto','otro')),
  name text not null,
  email text not null,
  phone text,
  order_code text,
  message text not null,
  status text not null default 'nuevo' check (status in ('nuevo','en_proceso','resuelto')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists messages_created_idx on shop.messages (created_at desc);

alter table shop.products enable row level security;
alter table shop.affiliates enable row level security;
alter table shop.orders enable row level security;
alter table shop.order_events enable row level security;
alter table shop.messages enable row level security;
alter table shop_private.config enable row level security;

create or replace function public.shop_api(p_secret text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = shop, shop_private, pg_temp
as $$
declare
  v jsonb;
  v_id uuid;
begin
  if p_secret is null or p_secret is distinct from (select value from shop_private.config where key = 'api_secret') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  case p_action
  -- ---------- productos ----------
  when 'products' then
    return coalesce((select jsonb_agg(to_jsonb(p) order by p.sort, p.id) from shop.products p), '[]'::jsonb);
  when 'product_update' then
    update shop.products set
      price = coalesce((p_args->>'price')::int, price),
      stock = coalesce((p_args->>'stock')::int, stock),
      active = coalesce((p_args->>'active')::boolean, active),
      name = coalesce(nullif(p_args->>'name', ''), name),
      description = coalesce(p_args->>'description', description),
      updated_at = now()
    where id = p_args->>'id'
    returning to_jsonb(products.*) into v;
    return v;
  when 'stock_adjust' then
    update shop.products p
      set stock = greatest(0, p.stock + (p_args->>'sign')::int * (i->>'qty')::int), updated_at = now()
      from jsonb_array_elements(p_args->'items') i
      where p.id = i->>'id';
    return '{}'::jsonb;
  -- ---------- referidos ----------
  when 'affiliate_create' then
    insert into shop.affiliates (code, token, name, email, phone)
    values (p_args->>'code', p_args->>'token', p_args->>'name', p_args->>'email', p_args->>'phone')
    returning to_jsonb(affiliates.*) into v;
    return v;
  when 'affiliate_get' then
    select to_jsonb(a) into v from shop.affiliates a
    where (p_args->>'field' = 'code' and a.code = p_args->>'value')
       or (p_args->>'field' = 'email' and a.email = p_args->>'value')
    limit 1;
    return coalesce(v, 'null'::jsonb);
  when 'affiliates' then
    return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from shop.affiliates a), '[]'::jsonb);
  when 'inc_clicks' then
    update shop.affiliates set clicks = clicks + 1 where code = p_args->>'code';
    return '{}'::jsonb;
  -- ---------- pedidos ----------
  when 'order_create' then
    insert into shop.orders (status, payment_method, ref_code, customer, items, subtotal, shipping, total, stock_applied)
    values (
      coalesce(p_args->>'status', 'pending'), coalesce(p_args->>'payment_method', 'mercadopago'), nullif(p_args->>'ref_code', ''),
      p_args->'customer', p_args->'items', (p_args->>'subtotal')::int, coalesce((p_args->>'shipping')::int, 0), (p_args->>'total')::int,
      coalesce((p_args->>'stock_applied')::boolean, false))
    returning id into v_id;
    update shop.orders set code = upper(substr(replace(v_id::text, '-', ''), 1, 8)) where id = v_id returning to_jsonb(orders.*) into v;
    return v;
  when 'order_get' then
    select to_jsonb(o) into v from shop.orders o where o.id = (p_args->>'id')::uuid;
    return coalesce(v, 'null'::jsonb);
  when 'order_update' then
    update shop.orders o set
      (status, payment_method, fulfillment, commission, commission_status, stock_applied, carrier, tracking, admin_note,
       mp_preference_id, mp_payment_id, paid_at, packed_at, shipped_at, delivered_at, cancelled_at) =
      (select r.status, r.payment_method, r.fulfillment, r.commission, r.commission_status, r.stock_applied, r.carrier, r.tracking, r.admin_note,
              r.mp_preference_id, r.mp_payment_id, r.paid_at, r.packed_at, r.shipped_at, r.delivered_at, r.cancelled_at
         from jsonb_populate_record(o, p_args->'patch') r),
      updated_at = now()
    where o.id = (p_args->>'id')::uuid
    returning to_jsonb(o.*) into v;
    return coalesce(v, 'null'::jsonb);
  when 'orders' then
    return coalesce((
      select jsonb_agg(to_jsonb(o) order by o.created_at desc)
      from (select * from shop.orders
            where (p_args->>'ref' is null or ref_code = p_args->>'ref')
            order by created_at desc
            limit coalesce((p_args->>'limit')::int, 2000)) o), '[]'::jsonb);
  when 'event_add' then
    insert into shop.order_events (order_id, type, detail) values ((p_args->>'order_id')::uuid, p_args->>'type', p_args->>'detail');
    return '{}'::jsonb;
  when 'events' then
    return coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from shop.order_events e where e.order_id = (p_args->>'order_id')::uuid), '[]'::jsonb);
  -- ---------- PQRS ----------
  when 'message_create' then
    insert into shop.messages (kind, name, email, phone, order_code, message)
    values (coalesce(nullif(p_args->>'kind', ''), 'peticion'), p_args->>'name', p_args->>'email', nullif(p_args->>'phone', ''),
            nullif(p_args->>'order_code', ''), p_args->>'message')
    returning id into v_id;
    update shop.messages set code = 'PQR-' || upper(substr(replace(v_id::text, '-', ''), 1, 6)) where id = v_id returning to_jsonb(messages.*) into v;
    return v;
  when 'messages' then
    return coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc)
      from (select * from shop.messages order by created_at desc limit coalesce((p_args->>'limit')::int, 500)) m), '[]'::jsonb);
  when 'message_update' then
    update shop.messages set
      status = coalesce(nullif(p_args->>'status', ''), status),
      admin_note = case when p_args ? 'admin_note' then p_args->>'admin_note' else admin_note end,
      updated_at = now()
    where id = (p_args->>'id')::uuid returning to_jsonb(messages.*) into v;
    return coalesce(v, 'null'::jsonb);
  else
    raise exception 'unknown action %', p_action;
  end case;
end;
$$;

revoke all on function public.shop_api(text, text, jsonb) from public;
grant execute on function public.shop_api(text, text, jsonb) to anon, authenticated, service_role;
