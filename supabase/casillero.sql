-- Casillero de Easycomex — se monta sobre el schema de Easycomex.
--
-- Reutiliza lo que ya existe en schema.sql:
--   * public.profiles (login, rol cliente/vendedor)  -> el "vendedor" es el admin del casillero
--   * public.notifications y notify_vendedores()     -> campanita + push
--   * Wompi (server/wompi.ts)                        -> recarga del wallet
--
-- Correr DESPUÉS de schema.sql, una sola vez (es re-ejecutable).

-- ---------------------------------------------------------------------
-- Datos extra del cliente del casillero, en la misma ficha de profiles
-- ---------------------------------------------------------------------
create sequence if not exists public.casillero_codigo_seq start 1001;

alter table public.profiles add column if not exists casillero_codigo text unique;
alter table public.profiles add column if not exists telefono text;
alter table public.profiles add column if not exists tipo_doc text;
alter table public.profiles add column if not exists num_doc text;
alter table public.profiles add column if not exists direccion text;
alter table public.profiles add column if not exists pais text;
alter table public.profiles add column if not exists departamento text;
alter table public.profiles add column if not exists ciudad text;
alter table public.profiles add column if not exists codigo_postal text;
alter table public.profiles add column if not exists como_nos_conocio text;
alter table public.profiles add column if not exists es_empresa boolean not null default false;

-- Código de casillero para quien ya tenía cuenta de Easycomex.
update public.profiles set casillero_codigo = 'DM' || nextval('public.casillero_codigo_seq')
  where casillero_codigo is null;

-- handle_new_user(): la misma función de schema.sql, más los campos del
-- casillero. Lo que llega en raw_user_meta_data lo manda el formulario
-- de registro; el rol sigue fijo en 'cliente'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  referrer_id uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if meta ->> 'referred_by_code' is not null then
    select id into referrer_id from public.profiles where referral_code = meta ->> 'referred_by_code';
  end if;

  insert into public.profiles (
    id, email, full_name, company, role, referred_by,
    casillero_codigo, telefono, tipo_doc, num_doc, direccion, pais, departamento, ciudad,
    codigo_postal, como_nos_conocio, es_empresa
  )
  values (
    new.id, new.email,
    coalesce(meta ->> 'full_name', meta ->> 'name'),
    meta ->> 'company', 'cliente', referrer_id,
    'DM' || nextval('public.casillero_codigo_seq'),
    meta ->> 'telefono', meta ->> 'tipo_doc', meta ->> 'num_doc', meta ->> 'direccion',
    meta ->> 'pais', meta ->> 'departamento', meta ->> 'ciudad', meta ->> 'codigo_postal',
    meta ->> 'como_nos_conocio', coalesce((meta ->> 'es_empresa')::boolean, false)
  )
  on conflict (id) do nothing;

  if referrer_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (referrer_id, 'referral_signup', 'Nuevo referido',
      coalesce(meta ->> 'full_name', new.email) || ' se registró con tu link.', '/dashboard');
  end if;
  return new;
end;
$$;

-- Quien es del equipo (vendedor) administra el casillero.
create or replace function public.casillero_es_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'vendedor');
$$;
revoke execute on function public.casillero_es_staff() from public, anon;
grant execute on function public.casillero_es_staff() to authenticated;

-- ---------------------------------------------------------------------
-- Paquetes y su historial
-- ---------------------------------------------------------------------
create table if not exists public.casillero_despachos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  modalidad text not null check (modalidad in ('rec_oficina','local','regional','nacional')),
  destino text,
  peso_total numeric(8,2) not null,
  costo numeric(12,2) not null,
  estado text not null default 'solicitado' check (estado in ('solicitado','despachado','entregado','cancelado')),
  guia_despacho text,
  created_at timestamptz not null default now()
);

create table if not exists public.casillero_paquetes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  guia text not null,
  proveedor text,
  descripcion text,
  valor_declarado numeric(12,2) default 0,
  peso_lb numeric(8,2),
  estado text not null default 'prealertado'
    check (estado in ('prealertado','recibido','alistamiento','despachado','entregado')),
  despacho_id uuid references public.casillero_despachos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists casillero_paquetes_user_idx on public.casillero_paquetes (user_id);
create index if not exists casillero_paquetes_guia_idx on public.casillero_paquetes (guia);

create table if not exists public.casillero_eventos (
  id bigint generated always as identity primary key,
  paquete_id uuid not null references public.casillero_paquetes (id) on delete cascade,
  estado text not null,
  nota text,
  created_at timestamptz not null default now()
);

create or replace function public.casillero_paquete_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists casillero_paquete_touch_t on public.casillero_paquetes;
create trigger casillero_paquete_touch_t before update on public.casillero_paquetes
  for each row execute function public.casillero_paquete_touch();

-- Cada cambio de estado deja un evento, y el dueño recibe una notificación
-- en la campanita (que además dispara el push, ver server/push.ts).
create or replace function public.casillero_paquete_eventos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.casillero_eventos (paquete_id, estado, nota)
      values (new.id, new.estado, case when new.estado = 'prealertado' then 'Prealerta creada' else 'Registrado en la bodega' end);
    if new.estado = 'prealertado' then
      perform public.notify_vendedores('casillero_prealerta', 'Nueva prealerta', 'Guía ' || new.guia, '/admin/casillero/paquetes');
    end if;
  elsif new.estado is distinct from old.estado then
    insert into public.casillero_eventos (paquete_id, estado) values (new.id, new.estado);
    insert into public.notifications (user_id, type, title, body, link)
    values (new.user_id, 'casillero_estado', 'Tu paquete cambió de estado',
            'Guía ' || new.guia || ': ' || new.estado, '/casillero');
  end if;
  return new;
end $$;
revoke execute on function public.casillero_paquete_eventos() from public, anon, authenticated;
drop trigger if exists casillero_paquete_ev_i on public.casillero_paquetes;
create trigger casillero_paquete_ev_i after insert on public.casillero_paquetes
  for each row execute function public.casillero_paquete_eventos();
drop trigger if exists casillero_paquete_ev_u on public.casillero_paquetes;
create trigger casillero_paquete_ev_u after update on public.casillero_paquetes
  for each row execute function public.casillero_paquete_eventos();

-- ---------------------------------------------------------------------
-- Tarifas (la tabla "Tarifas mínimas 2026"; el admin las edita)
-- ---------------------------------------------------------------------
create table if not exists public.casillero_tarifas (
  id serial primary key,
  libras_desde int not null,
  libras_hasta int not null,
  rec_oficina numeric(8,2) not null,
  local numeric(8,2) not null,
  regional numeric(8,2) not null,
  nacional numeric(8,2) not null
);
insert into public.casillero_tarifas (libras_desde, libras_hasta, rec_oficina, local, regional, nacional)
select * from (values (1,3,6.00,9.36,10.06,12.67),(4,5,10.00,13.36,14.06,16.67),
                      (6,7,14.00,18.10,19.10,21.99),(8,9,17.92,23.02,23.95,24.50)) v
where not exists (select 1 from public.casillero_tarifas);

-- ---------------------------------------------------------------------
-- Wallet (en USD). Saldo = suma de movimientos aprobados.
--   recarga  -> + (Wompi la aprueba sola; la transferencia la aprueba el equipo)
--   cargo    -> - (lo crea casillero_solicitar_despacho)
--   ajuste   -> +/- (solo el equipo)
-- ---------------------------------------------------------------------
create table if not exists public.casillero_wallet (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('recarga','cargo','ajuste')),
  monto numeric(12,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  metodo text,
  referencia text,
  wompi_ref text unique,           -- ecw_<hex>, la referencia del Web Checkout
  wompi_tx text,
  cop_cents bigint,                -- lo que se cobró en pesos
  despacho_id uuid references public.casillero_despachos (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists casillero_wallet_user_idx on public.casillero_wallet (user_id);

create or replace function public.casillero_mi_saldo() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(monto), 0) from public.casillero_wallet where user_id = auth.uid() and estado = 'aprobado';
$$;
revoke execute on function public.casillero_mi_saldo() from public, anon;
grant execute on function public.casillero_mi_saldo() to authenticated;

create or replace function public.casillero_cotizar(p_peso numeric, p_modalidad text) returns numeric
language plpgsql stable set search_path = public as $$
declare v numeric;
begin
  if p_modalidad not in ('rec_oficina','local','regional','nacional') then raise exception 'Modalidad invalida'; end if;
  select case p_modalidad when 'rec_oficina' then rec_oficina when 'local' then local
                          when 'regional' then regional else nacional end
    into v from public.casillero_tarifas where ceil(p_peso) between libras_desde and libras_hasta;
  if v is null then raise exception 'Peso fuera de la tabla de tarifas, contacta a un asesor'; end if;
  return v;
end $$;

create or replace function public.casillero_solicitar_despacho(p_paquetes uuid[], p_modalidad text, p_destino text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); peso numeric; costo numeric; did uuid; n int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  -- Bloquea la fila del perfil: dos solicitudes simultáneas no pueden
  -- gastar el mismo saldo.
  perform 1 from public.profiles where id = uid for update;
  select count(*), coalesce(sum(peso_lb), 0) into n, peso from public.casillero_paquetes
    where id = any (p_paquetes) and user_id = uid and estado = 'recibido' and peso_lb is not null;
  if n = 0 or n <> array_length(p_paquetes, 1) then raise exception 'Paquetes invalidos o sin recibir/pesar'; end if;
  costo := public.casillero_cotizar(peso, p_modalidad);
  if public.casillero_mi_saldo() < costo then raise exception 'Saldo insuficiente en wallet'; end if;
  insert into public.casillero_despachos (user_id, modalidad, destino, peso_total, costo)
    values (uid, p_modalidad, p_destino, peso, costo) returning id into did;
  insert into public.casillero_wallet (user_id, tipo, monto, estado, referencia, despacho_id)
    values (uid, 'cargo', -costo, 'aprobado', 'Despacho ' || left(did::text, 8), did);
  update public.casillero_paquetes set estado = 'alistamiento', despacho_id = did where id = any (p_paquetes);
  perform public.notify_vendedores('casillero_despacho', 'Nuevo despacho solicitado',
    'Despacho ' || left(did::text, 8) || ' (' || peso || ' lb)', '/admin/casillero/despachos');
  return did;
end $$;
revoke execute on function public.casillero_solicitar_despacho(uuid[], text, text) from public, anon;
grant execute on function public.casillero_solicitar_despacho(uuid[], text, text) to authenticated;

-- Rastreo público: solo estado y fecha, ningún dato personal.
create or replace function public.casillero_rastrear(p_guia text)
returns table (estado text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.estado, e.created_at
  from public.casillero_eventos e join public.casillero_paquetes p on p.id = e.paquete_id
  where p.guia = p_guia order by e.created_at;
$$;
grant execute on function public.casillero_rastrear(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.casillero_paquetes enable row level security;
alter table public.casillero_eventos enable row level security;
alter table public.casillero_tarifas enable row level security;
alter table public.casillero_despachos enable row level security;
alter table public.casillero_wallet enable row level security;

drop policy if exists "casillero_paquetes: select" on public.casillero_paquetes;
create policy "casillero_paquetes: select" on public.casillero_paquetes for select
  using (user_id = auth.uid() or public.casillero_es_staff());
drop policy if exists "casillero_paquetes: insert" on public.casillero_paquetes;
create policy "casillero_paquetes: insert" on public.casillero_paquetes for insert
  with check ((user_id = auth.uid() and estado = 'prealertado') or public.casillero_es_staff());
drop policy if exists "casillero_paquetes: update" on public.casillero_paquetes;
create policy "casillero_paquetes: update" on public.casillero_paquetes for update
  using (public.casillero_es_staff()) with check (public.casillero_es_staff());
drop policy if exists "casillero_paquetes: delete" on public.casillero_paquetes;
create policy "casillero_paquetes: delete" on public.casillero_paquetes for delete
  using ((user_id = auth.uid() and estado = 'prealertado') or public.casillero_es_staff());

drop policy if exists "casillero_eventos: select" on public.casillero_eventos;
create policy "casillero_eventos: select" on public.casillero_eventos for select
  using (exists (select 1 from public.casillero_paquetes p
                 where p.id = paquete_id and (p.user_id = auth.uid() or public.casillero_es_staff())));

drop policy if exists "casillero_tarifas: select" on public.casillero_tarifas;
create policy "casillero_tarifas: select" on public.casillero_tarifas for select using (true);
drop policy if exists "casillero_tarifas: staff" on public.casillero_tarifas;
create policy "casillero_tarifas: staff" on public.casillero_tarifas for all
  using (public.casillero_es_staff()) with check (public.casillero_es_staff());

drop policy if exists "casillero_despachos: select" on public.casillero_despachos;
create policy "casillero_despachos: select" on public.casillero_despachos for select
  using (user_id = auth.uid() or public.casillero_es_staff());
drop policy if exists "casillero_despachos: update" on public.casillero_despachos;
create policy "casillero_despachos: update" on public.casillero_despachos for update
  using (public.casillero_es_staff()) with check (public.casillero_es_staff());

-- Wallet: el cliente solo LEE. Las recargas con Wompi las crea el servidor
-- (service-role) y la reporta-transferencia entra por /api/casillero/wallet/reportar.
drop policy if exists "casillero_wallet: select" on public.casillero_wallet;
create policy "casillero_wallet: select" on public.casillero_wallet for select
  using (user_id = auth.uid() or public.casillero_es_staff());
drop policy if exists "casillero_wallet: staff insert" on public.casillero_wallet;
create policy "casillero_wallet: staff insert" on public.casillero_wallet for insert
  with check (public.casillero_es_staff());
drop policy if exists "casillero_wallet: staff update" on public.casillero_wallet;
create policy "casillero_wallet: staff update" on public.casillero_wallet for update
  using (public.casillero_es_staff()) with check (public.casillero_es_staff());

-- Los datos personales del casillero (telefono, documento, dirección…) los
-- edita el dueño con la política "update own, role locked" de profiles.

-- El código de casillero no lo cambia el dueño (la política de profiles
-- le deja editar su propia fila).
create or replace function public.casillero_codigo_bloqueado() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.casillero_codigo is distinct from old.casillero_codigo and auth.uid() is not null then
    raise exception 'El código de casillero no se puede cambiar';
  end if;
  return new;
end $$;
drop trigger if exists casillero_codigo_lock on public.profiles;
create trigger casillero_codigo_lock before update on public.profiles
  for each row execute function public.casillero_codigo_bloqueado();

-- =======================================================================
-- Portal del administrador: control total
-- =======================================================================

-- ---- Bloqueo de clientes ---------------------------------------------
alter table public.profiles add column if not exists casillero_bloqueado boolean not null default false;

create or replace function public.casillero_bloqueado_yo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select casillero_bloqueado from public.profiles where id = auth.uid()), false);
$$;
revoke execute on function public.casillero_bloqueado_yo() from public, anon;
grant execute on function public.casillero_bloqueado_yo() to authenticated;

-- Un cliente bloqueado no puede crear prealertas (el equipo sí registra por él).
drop policy if exists "casillero_paquetes: insert" on public.casillero_paquetes;
create policy "casillero_paquetes: insert" on public.casillero_paquetes for insert
  with check ((user_id = auth.uid() and estado = 'prealertado' and not public.casillero_bloqueado_yo())
              or public.casillero_es_staff());

-- Solo el equipo cambia estos dos campos del perfil, y siempre por función.
create or replace function public.casillero_set_rol(p_user uuid, p_rol text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.casillero_es_staff() then raise exception 'Solo el equipo'; end if;
  if p_rol not in ('cliente','vendedor') then raise exception 'Rol invalido'; end if;
  if p_user = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  update public.profiles set role = p_rol::public.user_role where id = p_user;
end $$;
revoke execute on function public.casillero_set_rol(uuid, text) from public, anon;
grant execute on function public.casillero_set_rol(uuid, text) to authenticated;

create or replace function public.casillero_set_bloqueo(p_user uuid, p_bloqueado boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.casillero_es_staff() then raise exception 'Solo el equipo'; end if;
  if p_user = auth.uid() then raise exception 'No puedes bloquearte a ti mismo'; end if;
  update public.profiles set casillero_bloqueado = p_bloqueado where id = p_user;
end $$;
revoke execute on function public.casillero_set_bloqueo(uuid, boolean) from public, anon;
grant execute on function public.casillero_set_bloqueo(uuid, boolean) to authenticated;

-- ---- Configuración (la edita el equipo) --------------------------------
create table if not exists public.casillero_config (
  clave text primary key,
  valor text not null,
  descripcion text
);
insert into public.casillero_config (clave, valor, descripcion) values
  ('libra_extra_rec_oficina', '', 'USD por cada libra adicional sobre la última fila de la tabla (vacío = cotiza un asesor)'),
  ('libra_extra_local', '', 'Idem, modalidad local'),
  ('libra_extra_regional', '', 'Idem, modalidad regional'),
  ('libra_extra_nacional', '', 'Idem, modalidad nacional'),
  ('direccion_bodega', '7569 NW 70th St, Miami, FL 33166, EE.UU.', 'Dirección que ven los clientes'),
  ('valor_declarado_max', '100', 'USD máximo declarado para aplicar las tarifas mínimas'),
  ('recarga_min_usd', '5', 'Recarga mínima del wallet'),
  ('aviso_clientes', '', 'Mensaje visible en el inicio del casillero (vacío = ninguno)')
on conflict (clave) do nothing;

alter table public.casillero_config enable row level security;
drop policy if exists "casillero_config: select" on public.casillero_config;
create policy "casillero_config: select" on public.casillero_config for select using (true);
drop policy if exists "casillero_config: staff" on public.casillero_config;
create policy "casillero_config: staff" on public.casillero_config for all
  using (public.casillero_es_staff()) with check (public.casillero_es_staff());

-- Cotización: si el peso pasa de la última fila y hay precio por libra extra, se suma.
create or replace function public.casillero_cotizar(p_peso numeric, p_modalidad text) returns numeric
language plpgsql stable set search_path = public as $$
declare v numeric; extra numeric; ult record; libras int := ceil(p_peso);
begin
  if p_modalidad not in ('rec_oficina','local','regional','nacional') then raise exception 'Modalidad invalida'; end if;
  select case p_modalidad when 'rec_oficina' then rec_oficina when 'local' then local
                          when 'regional' then regional else nacional end
    into v from public.casillero_tarifas where libras between libras_desde and libras_hasta;
  if v is not null then return v; end if;

  select * into ult from public.casillero_tarifas order by libras_hasta desc limit 1;
  select nullif(valor, '')::numeric into extra from public.casillero_config where clave = 'libra_extra_' || p_modalidad;
  if ult is null or extra is null or libras <= ult.libras_hasta then
    raise exception 'Peso fuera de la tabla de tarifas, contacta a un asesor';
  end if;
  return (case p_modalidad when 'rec_oficina' then ult.rec_oficina when 'local' then ult.local
                           when 'regional' then ult.regional else ult.nacional end)
         + extra * (libras - ult.libras_hasta);
end $$;

-- Despacho: igual que antes, y un cliente bloqueado no puede solicitarlo.
create or replace function public.casillero_solicitar_despacho(p_paquetes uuid[], p_modalidad text, p_destino text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); peso numeric; costo numeric; did uuid; n int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform 1 from public.profiles where id = uid for update;
  if public.casillero_bloqueado_yo() then raise exception 'Tu casillero está bloqueado, contacta al equipo'; end if;
  select count(*), coalesce(sum(peso_lb), 0) into n, peso from public.casillero_paquetes
    where id = any (p_paquetes) and user_id = uid and estado = 'recibido' and peso_lb is not null;
  if n = 0 or n <> array_length(p_paquetes, 1) then raise exception 'Paquetes invalidos o sin recibir/pesar'; end if;
  costo := public.casillero_cotizar(peso, p_modalidad);
  if public.casillero_mi_saldo() < costo then raise exception 'Saldo insuficiente en wallet'; end if;
  insert into public.casillero_despachos (user_id, modalidad, destino, peso_total, costo)
    values (uid, p_modalidad, p_destino, peso, costo) returning id into did;
  insert into public.casillero_wallet (user_id, tipo, monto, estado, referencia, despacho_id)
    values (uid, 'cargo', -costo, 'aprobado', 'Despacho ' || left(did::text, 8), did);
  update public.casillero_paquetes set estado = 'alistamiento', despacho_id = did where id = any (p_paquetes);
  perform public.notify_vendedores('casillero_despacho', 'Nuevo despacho solicitado',
    'Despacho ' || left(did::text, 8) || ' (' || peso || ' lb)', '/admin/casillero/despachos');
  return did;
end $$;

-- ---- Anuncios a todos los clientes -------------------------------------
create or replace function public.casillero_anunciar(p_titulo text, p_cuerpo text, p_link text default '/casillero')
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.casillero_es_staff() then raise exception 'Solo el equipo'; end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'El anuncio necesita un título'; end if;
  insert into public.notifications (user_id, type, title, body, link)
    select id, 'casillero_anuncio', p_titulo, p_cuerpo, p_link from public.profiles where role = 'cliente';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.casillero_anunciar(text, text, text) from public, anon;
grant execute on function public.casillero_anunciar(text, text, text) to authenticated;

-- ---- Auditoría: quién (del equipo) cambió qué ---------------------------
create table if not exists public.casillero_auditoria (
  id bigint generated always as identity primary key,
  actor uuid,
  tabla text not null,
  accion text not null,
  fila text,
  detalle jsonb,
  created_at timestamptz not null default now()
);
alter table public.casillero_auditoria enable row level security;
drop policy if exists "casillero_auditoria: staff" on public.casillero_auditoria;
create policy "casillero_auditoria: staff" on public.casillero_auditoria for select using (public.casillero_es_staff());

create or replace function public.casillero_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  -- Solo acciones hechas a mano por alguien del equipo (no las del sistema ni las del cliente).
  if auth.uid() is not null and public.casillero_es_staff() then
    insert into public.casillero_auditoria (actor, tabla, accion, fila, detalle)
    values (auth.uid(), tg_table_name, tg_op, fila ->> coalesce(tg_argv[0], 'id'),
            case when tg_op = 'UPDATE' then jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new)) else fila end);
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.casillero_auditar() from public, anon, authenticated;

drop trigger if exists casillero_aud_paquetes on public.casillero_paquetes;
create trigger casillero_aud_paquetes after update or delete on public.casillero_paquetes for each row execute function public.casillero_auditar();
drop trigger if exists casillero_aud_despachos on public.casillero_despachos;
create trigger casillero_aud_despachos after update on public.casillero_despachos for each row execute function public.casillero_auditar();
drop trigger if exists casillero_aud_wallet on public.casillero_wallet;
create trigger casillero_aud_wallet after insert or update on public.casillero_wallet for each row execute function public.casillero_auditar();
drop trigger if exists casillero_aud_tarifas on public.casillero_tarifas;
create trigger casillero_aud_tarifas after insert or update or delete on public.casillero_tarifas for each row execute function public.casillero_auditar();
drop trigger if exists casillero_aud_config on public.casillero_config;
create trigger casillero_aud_config after update on public.casillero_config for each row execute function public.casillero_auditar('clave');
drop trigger if exists casillero_aud_perfiles on public.profiles;
create trigger casillero_aud_perfiles after update on public.profiles for each row execute function public.casillero_auditar();

-- ---- Números del tablero ---------------------------------------------------
create or replace function public.casillero_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.casillero_es_staff() then raise exception 'Solo el equipo'; end if;
  select jsonb_build_object(
    'clientes', (select count(*) from public.profiles where role = 'cliente'),
    'clientes_nuevos_30d', (select count(*) from public.profiles where role = 'cliente' and created_at > now() - interval '30 days'),
    'bloqueados', (select count(*) from public.profiles where casillero_bloqueado),
    'paquetes', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (select estado, count(*) n from public.casillero_paquetes group by estado) x),
    'despachos', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (select estado, count(*) n from public.casillero_despachos group by estado) x),
    'recargas_pendientes', (select count(*) from public.casillero_wallet where tipo = 'recarga' and estado = 'pendiente'),
    'recargas_pendientes_usd', (select coalesce(sum(monto), 0) from public.casillero_wallet where tipo = 'recarga' and estado = 'pendiente'),
    'saldo_total_wallets', (select coalesce(sum(monto), 0) from public.casillero_wallet where estado = 'aprobado'),
    'ingresos_30d', (select coalesce(-sum(monto), 0) from public.casillero_wallet where tipo = 'cargo' and estado = 'aprobado' and created_at > now() - interval '30 days'),
    'recargado_30d', (select coalesce(sum(monto), 0) from public.casillero_wallet where tipo = 'recarga' and estado = 'aprobado' and created_at > now() - interval '30 days'),
    'serie_30d', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'ingresos', coalesce(i.v, 0), 'paquetes', coalesce(p.n, 0)) order by d), '[]'::jsonb)
                  from generate_series(current_date - 29, current_date, interval '1 day') d
                  left join (select created_at::date dia, -sum(monto) v from public.casillero_wallet where tipo = 'cargo' and estado = 'aprobado' group by 1) i on i.dia = d::date
                  left join (select created_at::date dia, count(*) n from public.casillero_paquetes group by 1) p on p.dia = d::date)
  ) into r;
  return r;
end $$;
revoke execute on function public.casillero_stats() from public, anon;
grant execute on function public.casillero_stats() to authenticated;

-- ---- Clientes: el equipo edita sus datos; saldos por cliente --------------
drop policy if exists "profiles: staff updates" on public.profiles;
create policy "profiles: staff updates" on public.profiles for update
  using (public.casillero_es_staff()) with check (public.casillero_es_staff());

create or replace view public.casillero_saldos with (security_invoker = true) as
  select user_id, coalesce(sum(monto) filter (where estado = 'aprobado'), 0)::numeric(12,2) as saldo
  from public.casillero_wallet group by user_id;
