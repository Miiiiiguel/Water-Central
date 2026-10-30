import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// El SQL de verdad del casillero (supabase/casillero.sql) sobre un Postgres
// en memoria: es dinero (el wallet), así que el cobro del despacho, el saldo
// insuficiente y el aislamiento entre clientes se prueban aquí, no leyendo.

const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/casillero.sql'), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

const como = (uid: string) => db.exec(`select set_config('app.uid', '${uid}', false)`);
async function paquete(user: string, guia: string, peso: number | null, estado = 'recibido') {
  const r = await db.query<{ id: string }>(
    `insert into public.casillero_paquetes (user_id, guia, peso_lb, estado) values ($1,$2,$3,$4) returning id`, [user, guia, peso, estado]);
  return r.rows[0].id;
}
const recarga = (user: string, monto: number, estado = 'aprobado') =>
  db.query(`insert into public.casillero_wallet (user_id, tipo, monto, estado) values ($1,'recarga',$2,$3)`, [user, monto, estado]);
const saldo = async () => Number((await db.query<{ s: string }>(`select public.casillero_mi_saldo() as s`)).rows[0].s);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    create role anon; create role authenticated;
    create type public.user_role as enum ('cliente', 'vendedor');
    create table public.profiles (id uuid primary key, email text, full_name text, company text,
      role public.user_role not null default 'cliente', referral_code text, referred_by uuid,
      created_at timestamptz not null default now());
    create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid, type text, title text, body text, link text);
    create function public.notify_vendedores(p_type text, p_title text, p_body text, p_link text default '/dashboard')
      returns void language sql as $$ select 1 $$;
    insert into public.profiles (id, email) values ('${A}','a@x.com'), ('${B}','b@x.com');
  `);
  await db.exec(sql);
}, 30_000);

describe('wallet y despachos del casillero', () => {
  it('cobra el despacho al wallet y deja los paquetes en alistamiento', async () => {
    await como(A);
    await recarga(A, 50);
    const p1 = await paquete(A, 'G1', 1.5);
    const p2 = await paquete(A, 'G2', 1.2); // 2.7 lb -> 3 lb
    await db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'Bogotá')`, [[p1, p2]]);
    expect(await saldo()).toBeCloseTo(50 - 9.36);
    const e = await db.query<{ estado: string }>(`select distinct estado from public.casillero_paquetes where user_id=$1`, [A]);
    expect(e.rows).toEqual([{ estado: 'alistamiento' }]);
  });

  it('rechaza el despacho si el saldo no alcanza', async () => {
    await como(A);
    await recarga(A, 5);
    const p = await paquete(A, 'G1', 2);
    await expect(db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'x')`, [[p]])).rejects.toThrow(/Saldo insuficiente/);
    expect(await saldo()).toBe(5);
  });

  it('una recarga pendiente o rechazada no cuenta como saldo', async () => {
    await como(A);
    await recarga(A, 100, 'pendiente');
    await recarga(A, 40, 'rechazado');
    expect(await saldo()).toBe(0);
  });

  it('no se puede despachar el mismo paquete dos veces', async () => {
    await como(A);
    await recarga(A, 100);
    const p = await paquete(A, 'G1', 2);
    await db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'x')`, [[p]]);
    await expect(db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'x')`, [[p]])).rejects.toThrow(/invalidos/);
  });

  it('no se despachan paquetes de otro cliente ni sin pesar', async () => {
    await como(A);
    await recarga(A, 100);
    const ajeno = await paquete(B, 'GB', 2);
    const sinPeso = await paquete(A, 'GA', null);
    await expect(db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'x')`, [[ajeno]])).rejects.toThrow(/invalidos/);
    await expect(db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'x')`, [[sinPeso]])).rejects.toThrow(/invalidos/);
  });

  it('un peso fuera de la tabla no se cotiza solo', async () => {
    await expect(db.query(`select public.casillero_cotizar(12, 'local')`)).rejects.toThrow(/fuera de la tabla/);
    expect(Number((await db.query<{ c: string }>(`select public.casillero_cotizar(8.5, 'nacional') as c`)).rows[0].c)).toBe(24.5);
  });

  it('el rastreo público solo devuelve estados y fechas', async () => {
    const id = await paquete(A, 'RASTREO1', null, 'prealertado');
    await db.query(`update public.casillero_paquetes set estado='recibido' where id=$1`, [id]);
    const r = await db.query<Record<string, unknown>>(`select * from public.casillero_rastrear('RASTREO1')`);
    expect(r.rows.map((x) => x.estado)).toEqual(['prealertado', 'recibido']);
    expect(Object.keys(r.rows[0]).sort()).toEqual(['created_at', 'estado']);
  });

  it('un peso sobre la tabla solo se cotiza si el equipo fijó el precio por libra extra', async () => {
    await db.query(`update public.casillero_config set valor='2.5' where clave='libra_extra_nacional'`);
    // 12 lb nacional = 24.50 (fila 8-9) + 3 libras * 2.5
    expect(Number((await db.query<{ c: string }>(`select public.casillero_cotizar(12, 'nacional') as c`)).rows[0].c)).toBe(32);
    await expect(db.query(`select public.casillero_cotizar(12, 'local')`)).rejects.toThrow(/fuera de la tabla/);
  });

  it('un cliente bloqueado no puede solicitar despachos', async () => {
    await como(A);
    await recarga(A, 50);
    const p = await paquete(A, 'G1', 1);
    await db.exec(`update public.profiles set casillero_bloqueado = true where id = '${A}'`);
    await expect(db.query(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'x')`, [[p]])).rejects.toThrow(/bloqueado/);
  });

  it('solo el equipo cambia roles, anuncia y ve el tablero; no puede cambiarse a sí mismo', async () => {
    await como(A);
    await expect(db.query(`select public.casillero_set_rol('${B}', 'vendedor')`)).rejects.toThrow(/Solo el equipo/);
    await expect(db.query(`select public.casillero_anunciar('x', 'y')`)).rejects.toThrow(/Solo el equipo/);
    await expect(db.query(`select public.casillero_stats()`)).rejects.toThrow(/Solo el equipo/);
    await db.exec(`update public.profiles set role = 'vendedor' where id = '${A}'`);
    await db.query(`select public.casillero_set_rol('${B}', 'vendedor')`);
    expect((await db.query<{ role: string }>(`select role from public.profiles where id = '${B}'`)).rows[0].role).toBe('vendedor');
    await expect(db.query(`select public.casillero_set_rol('${A}', 'cliente')`)).rejects.toThrow(/propio rol/);
  });

  it('el anuncio llega a todos los clientes y el tablero suma el wallet', async () => {
    await db.exec(`update public.profiles set role = 'vendedor' where id = '${A}'`);
    await como(A);
    await recarga(B, 40);
    const n = (await db.query<{ n: number }>(`select public.casillero_anunciar('Feriado', 'No hay despachos el lunes') as n`)).rows[0].n;
    expect(n).toBe(1); // solo B es cliente
    const h = (await db.query<{ tabla: string; detalle: { titulo: string; destinatarios: number } }>(`select tabla, detalle from public.casillero_auditoria where tabla = 'anuncio'`)).rows;
    expect(h).toHaveLength(1);
    expect(h[0].detalle).toMatchObject({ titulo: 'Feriado', destinatarios: 1 }); // el historial de anuncios
    const st = (await db.query<{ s: Record<string, unknown> }>(`select public.casillero_stats() as s`)).rows[0].s;
    expect(Number(st.saldo_total_wallets)).toBe(40);
    expect(st.clientes).toBe(1);
    expect((st.serie_30d as unknown[]).length).toBe(30);
  });

  it('la auditoría anota lo que hace el equipo y no lo que hace un cliente', async () => {
    await como(A);
    const id = await paquete(A, 'G1', 1);
    await db.exec(`update public.casillero_paquetes set peso_lb = 2 where id = '${id}'`); // cliente A (aún no es staff)
    expect((await db.query(`select 1 from public.casillero_auditoria`)).rows).toHaveLength(0);
    await db.exec(`update public.profiles set role = 'vendedor' where id = '${A}'`);
    await db.exec(`update public.casillero_paquetes set peso_lb = 3 where id = '${id}'`);
    const a = await db.query<{ tabla: string; accion: string }>(`select tabla, accion from public.casillero_auditoria where tabla = 'casillero_paquetes'`);
    expect(a.rows).toEqual([{ tabla: 'casillero_paquetes', accion: 'UPDATE' }]);
  });

  it('el inventario suma ingresos, descuenta ventas y calcula la rotación', async () => {
    const prod = (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre) values ($1,'CAM-01','Camiseta') returning id`, [A])).rows[0].id;
    const mov = (tipo: string, cantidad: number, ref?: string) =>
      db.query(`insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad, ref_externa) values ($1,$2,$3,$4,$5)`, [prod, A, tipo, cantidad, ref ?? null]);
    await mov('ingreso', 100);
    await mov('venta', -30, 'shopify:order:1:1');
    await mov('devolucion', 5);
    await mov('ajuste', -2); // merma: baja el stock pero no cuenta como venta
    const r = (await db.query<Record<string, number>>(`select total_unidades, disponibles, vendidos, rotacion from public.casillero_inventario where id = $1`, [prod])).rows[0];
    expect(r).toMatchObject({ total_unidades: 105, disponibles: 73, vendidos: 30 });
    expect(Number(r.rotacion)).toBeCloseTo(28.6, 1);
  });

  it('un mismo pedido de la tienda no se descuenta dos veces', async () => {
    const prod = (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre) values ($1,'X','X') returning id`, [A])).rows[0].id;
    const venta = () => db.query(`insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad, ref_externa) values ($1,$2,'venta',-1,'shopify:order:9:1')`, [prod, A]);
    await venta();
    await expect(venta()).rejects.toThrow(/duplicate|unique/i);
  });

  it('las reglas del movimiento: una venta no puede ser positiva ni un ingreso negativo', async () => {
    const prod = (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre) values ($1,'Y','Y') returning id`, [A])).rows[0].id;
    const ins = (tipo: string, c: number) => db.query(`insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad) values ($1,$2,$3,$4)`, [prod, A, tipo, c]);
    await expect(ins('venta', 3)).rejects.toThrow();
    await expect(ins('ingreso', -3)).rejects.toThrow();
    await expect(ins('ajuste', 0)).rejects.toThrow();
    await ins('ajuste', -4);
  });

  it('una venta de un SKU que aún no existe se aplica sola cuando el cliente crea el producto', async () => {
    const ev = (sku: string, ref: string, cant: number) => db.query(
      `insert into public.casillero_integracion_eventos (user_id, tipo, resumen, detalle) values ($1,'sin_producto','Pedido sin producto',$2::jsonb)`,
      [A, JSON.stringify({ sku, tipo: 'venta', cantidad: cant, origen: 'shopify', referencia: 'Pedido 5', ref_externa: ref })]);
    await ev('NUEVO-1', 'shopify:order:5:1', -3);
    await ev('NUEVO-1', 'shopify:order:6:1', -2);
    expect((await db.query<{ unidades: number; pedidos: number }>(`select unidades, pedidos from public.casillero_skus_sin_producto where sku = 'NUEVO-1'`)).rows[0]).toEqual({ unidades: 5, pedidos: 2 });
    const prod = (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre) values ($1,'NUEVO-1','Nuevo') returning id`, [A])).rows[0].id;
    const inv = (await db.query<{ disponibles: number; vendidos: number }>(`select disponibles, vendidos from public.casillero_inventario where id = $1`, [prod])).rows[0];
    expect(inv).toEqual({ disponibles: -5, vendidos: 5 });
    expect((await db.query(`select 1 from public.casillero_skus_sin_producto`)).rows).toHaveLength(0);
  });

  it('avisa una sola vez cuando el stock cruza el mínimo hacia abajo', async () => {
    const prod = (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre, stock_minimo) values ($1,'MIN','Mínimo',10) returning id`, [A])).rows[0].id;
    const mov = (t: string, c: number) => db.query(`insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad) values ($1,$2,$3,$4)`, [prod, A, t, c]);
    await mov('ingreso', 50);
    await mov('venta', -30); // 20: aún por encima
    expect((await db.query(`select 1 from public.notifications where type = 'casillero_stock'`)).rows).toHaveLength(0);
    await mov('venta', -12); // 8: cruzó
    await mov('venta', -2);  // 6: ya estaba abajo, no repite
    expect((await db.query(`select title from public.notifications where type = 'casillero_stock'`)).rows).toEqual([{ title: 'Stock bajo: MIN' }]);
  });

  it('el resumen del cliente cuadra: saldo, serie, ventas por origen, stock bajo y primeros pasos', async () => {
    await como(A);
    await recarga(A, 100);
    await db.query(`insert into public.casillero_wallet (user_id, tipo, monto, estado) values ($1,'cargo',-20,'aprobado')`, [A]);
    const prod = (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre, stock_minimo) values ($1,'R1','Resumen',20) returning id`, [A])).rows[0].id;
    const mov = (t: string, c: number, o: string) => db.query(`insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad, origen) values ($1,$2,$3,$4,$5)`, [prod, A, t, c, o]);
    await mov('ingreso', 40, 'bodega'); await mov('venta', -15, 'shopify'); await mov('venta', -5, 'woocommerce');
    await paquete(A, 'GR', 1, 'recibido');
    const r = (await db.query<{ r: Record<string, any> }>(`select public.casillero_resumen_cliente() as r`)).rows[0].r;
    expect(Number(r.saldo)).toBe(80);
    expect(r.paquetes).toEqual({ recibido: 1 });
    expect(r.saldo_serie).toHaveLength(30);
    expect(Number(r.saldo_serie.at(-1).saldo)).toBe(80);
    const hoy = r.ventas_30d.at(-1);
    expect([hoy.shopify, hoy.woocommerce, hoy.api]).toEqual([15, 5, 0]);
    expect(r.top_productos[0]).toMatchObject({ sku: 'R1', vendidos: 20 });
    expect(r.stock_bajo[0]).toMatchObject({ sku: 'R1', disponibles: 20 });
    expect(r.onboarding).toEqual({ prealerta: true, wallet: true, productos: true, tienda: false, stock: true });
    expect(r.gasto_6m.at(-1)).toMatchObject({ gasto: 20, recargas: 100 });
    expect(r.actividad.length).toBeGreaterThan(0);
    const an = (await db.query<{ a: Record<string, any> }>(`select public.casillero_inv_analisis(30) as a`)).rows[0].a;
    expect(an.por_origen).toEqual([{ origen: 'shopify', unidades: 15 }, { origen: 'woocommerce', unidades: 5 }]);
    expect(an.productos[0]).toMatchObject({ vendidas: 20, cobertura_dias: 30 }); // 20 disp. / (20/30 por día)
    expect(an.serie).toHaveLength(30);
  });

  it('el tablero del administrador suma las nuevas gráficas y la cola de trabajo', async () => {
    await db.exec(`update public.profiles set role = 'vendedor' where id = '${A}'`);
    await como(A);
    await recarga(B, 60);
    await db.query(`insert into public.casillero_wallet (user_id, tipo, monto, estado) values ($1,'cargo',-25,'aprobado')`, [B]);
    await paquete(B, 'P1', null, 'prealertado');
    const st = (await db.query<{ s: Record<string, any> }>(`select public.casillero_stats() as s`)).rows[0].s;
    expect(Number(st.ingresos_30d)).toBe(25);
    expect(st.ingresos_6m).toHaveLength(6);
    expect(st.top_clientes_30d[0]).toMatchObject({ gasto: 25 });
    expect(st.cola).toMatchObject({ por_recibir: 1, por_alistar: 0, recargas: 0 });
    expect(st.flujo_30d).toHaveLength(30);
  });

  describe('operaciones del administrador', () => {
    const volverStaff = () => db.exec(`update public.profiles set role = 'vendedor' where id = '${A}'`);
    const mov = async (user: string) => Number((await db.query<{ s: string }>(`select coalesce(sum(monto),0) as s from public.casillero_wallet where user_id=$1 and estado='aprobado'`, [user])).rows[0].s);

    it('ninguna la puede llamar un cliente', async () => {
      await como(B);
      const id = '33333333-3333-3333-3333-333333333333';
      await expect(db.query(`select public.casillero_despacho_estado($1,'despachado')`, [id])).rejects.toThrow(/Solo el equipo/);
      await expect(db.query(`select public.casillero_cancelar_despacho($1)`, [id])).rejects.toThrow(/Solo el equipo/);
      await expect(db.query(`select public.casillero_resolver_recarga($1, true)`, [id])).rejects.toThrow(/Solo el equipo/);
      await expect(db.query(`select public.casillero_ajustar_saldo($1, 5, 'x')`, [B])).rejects.toThrow(/Solo el equipo/);
    });

    it('despachar y entregar lleva los paquetes con el despacho', async () => {
      await como(B);
      await recarga(B, 50);
      const p = await paquete(B, 'G1', 2);
      const did = (await db.query<{ d: string }>(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'Calle 1 # 2-3') as d`, [[p]])).rows[0].d;
      await volverStaff(); await como(A);
      await db.query(`select public.casillero_despacho_estado($1, 'despachado', 'SERV-123')`, [did]);
      let r = (await db.query<{ e: string; g: string }>(`select p.estado e, d.guia_despacho g from public.casillero_paquetes p join public.casillero_despachos d on d.id = p.despacho_id`)).rows[0];
      expect(r).toEqual({ e: 'despachado', g: 'SERV-123' });
      await db.query(`select public.casillero_despacho_estado($1, 'entregado')`, [did]);
      r = (await db.query<{ e: string; g: string }>(`select p.estado e, d.guia_despacho g from public.casillero_paquetes p join public.casillero_despachos d on d.id = p.despacho_id`)).rows[0];
      expect(r).toEqual({ e: 'entregado', g: 'SERV-123' }); // la guía se conserva si no se manda otra
    });

    it('cancelar devuelve el dinero y los paquetes una sola vez', async () => {
      await como(B);
      await recarga(B, 50);
      const p = await paquete(B, 'G1', 2);
      const did = (await db.query<{ d: string }>(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'Calle 1 # 2-3') as d`, [[p]])).rows[0].d;
      expect(await mov(B)).toBeCloseTo(50 - 9.36);
      await volverStaff(); await como(A);
      await db.query(`select public.casillero_cancelar_despacho($1)`, [did]);
      expect(await mov(B)).toBeCloseTo(50);
      const e = (await db.query<{ estado: string; despacho_id: string | null }>(`select estado, despacho_id from public.casillero_paquetes where id=$1`, [p])).rows[0];
      expect(e).toEqual({ estado: 'recibido', despacho_id: null });
      await expect(db.query(`select public.casillero_cancelar_despacho($1)`, [did])).rejects.toThrow(/aún no salió/);
      expect(await mov(B)).toBeCloseTo(50); // no se reembolsó dos veces
      await expect(db.query(`select public.casillero_despacho_estado($1, 'despachado')`, [did])).rejects.toThrow(/cancelado/);
    });

    it('un despacho que ya salió no se cancela', async () => {
      await como(B);
      await recarga(B, 50);
      const p = await paquete(B, 'G1', 2);
      const did = (await db.query<{ d: string }>(`select public.casillero_solicitar_despacho($1::uuid[], 'local', 'Calle 1 # 2-3') as d`, [[p]])).rows[0].d;
      await volverStaff(); await como(A);
      await db.query(`select public.casillero_despacho_estado($1, 'despachado')`, [did]);
      await expect(db.query(`select public.casillero_cancelar_despacho($1)`, [did])).rejects.toThrow(/aún no salió/);
    });

    it('una recarga pendiente se aprueba (suma saldo, avisa) o se rechaza, y solo una vez', async () => {
      const w = async (m: number) => (await db.query<{ id: string }>(`insert into public.casillero_wallet (user_id, tipo, monto, estado, metodo, referencia) values ($1,'recarga',$2,'pendiente','Zelle','ZL-1') returning id`, [B, m])).rows[0].id;
      const a = await w(30); const b = await w(10);
      await volverStaff(); await como(A);
      await db.query(`select public.casillero_resolver_recarga($1, true, 'Verificado en el banco')`, [a]);
      await db.query(`select public.casillero_resolver_recarga($1, false, 'No llegó')`, [b]);
      expect(await mov(B)).toBe(30);
      const ref = (await db.query<{ r: string }>(`select referencia r from public.casillero_wallet where id=$1`, [a])).rows[0].r;
      expect(ref).toBe('ZL-1 · Verificado en el banco');
      const avisos = (await db.query<{ title: string }>(`select title from public.notifications where user_id=$1 order by title`, [B])).rows.map((x) => x.title);
      expect(avisos).toEqual(['Recarga aprobada', 'Recarga rechazada']);
      await expect(db.query(`select public.casillero_resolver_recarga($1, true)`, [a])).rejects.toThrow(/ya fue resuelta/);
      await expect(db.query(`select public.casillero_resolver_recarga($1, true)`, [b])).rejects.toThrow(/ya fue resuelta/);
      expect(await mov(B)).toBe(30);
    });

    it('el ajuste de saldo pide motivo, avisa al cliente y no deja el saldo en negativo', async () => {
      await recarga(B, 20);
      await volverStaff(); await como(A);
      await expect(db.query(`select public.casillero_ajustar_saldo($1, 5, '  ')`, [B])).rejects.toThrow(/motivo/);
      await expect(db.query(`select public.casillero_ajustar_saldo($1, 0, 'x')`, [B])).rejects.toThrow(/Monto/);
      expect(Number((await db.query<{ s: string }>(`select public.casillero_ajustar_saldo($1, 7.5, 'Bono de bienvenida') as s`, [B])).rows[0].s)).toBe(27.5);
      await expect(db.query(`select public.casillero_ajustar_saldo($1, -100, 'Cobro')`, [B])).rejects.toThrow(/negativo/);
      expect(Number((await db.query<{ s: string }>(`select public.casillero_ajustar_saldo($1, -27.5, 'Corrección') as s`, [B])).rows[0].s)).toBe(0);
      expect(await mov(B)).toBe(0);
      const n = (await db.query<{ n: number }>(`select count(*)::int n from public.notifications where user_id=$1 and type='casillero_wallet'`, [B])).rows[0].n;
      expect(n).toBe(2);
    });
  });

  it('el inventario global suma a todos los clientes y solo lo ve el equipo', async () => {
    const prod = async (u: string, sku: string, min = 0) => (await db.query<{ id: string }>(`insert into public.casillero_productos (user_id, sku, nombre, stock_minimo) values ($1,$2,$3,$4) returning id`, [u, sku, `Prod ${sku}`, min])).rows[0].id;
    const mov = (p: string, u: string, tipo: string, c: number, origen = 'manual') => db.query(`insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad, origen) values ($1,$2,$3,$4,$5)`, [p, u, tipo, c, origen]);
    const pa = await prod(A, 'A-1', 10); const pb = await prod(B, 'B-1'); const pc = await prod(B, 'B-2');
    await mov(pa, A, 'ingreso', 20, 'bodega'); await mov(pa, A, 'venta', -12, 'shopify');
    await mov(pb, B, 'ingreso', 50, 'bodega'); await mov(pb, B, 'venta', -5, 'woocommerce'); await mov(pb, B, 'devolucion', 1, 'manual');
    await mov(pc, B, 'ingreso', 4, 'bodega'); await mov(pc, B, 'venta', -4, 'api');
    await como(B);
    await expect(db.query(`select public.casillero_inv_global(7)`)).rejects.toThrow(/Solo el equipo/);
    await db.exec(`update public.profiles set role = 'vendedor' where id = '${A}'`);
    await como(A);
    const g = (await db.query<{ g: Record<string, any> }>(`select public.casillero_inv_global(7) as g`)).rows[0].g;
    expect(g.serie).toHaveLength(7);
    expect(g.serie.reduce((a: number, d: { ventas: number }) => a + d.ventas, 0)).toBe(21);
    expect(g.serie.reduce((a: number, d: { ingresos: number }) => a + d.ingresos, 0)).toBe(74);
    expect(Object.fromEntries(g.por_origen.map((o: { origen: string; unidades: number }) => [o.origen, o.unidades]))).toEqual({ shopify: 12, woocommerce: 5, api: 4 });
    expect(g.top_productos[0]).toMatchObject({ sku: 'A-1', vendidas: 12 });
    expect(g.stock_por_cliente.map((c: { unidades: number }) => c.unidades)).toEqual([46, 8]); // B: 50-5+1 = 46 · A: 20-12 = 8 (B-2 quedó en 0)
    expect(g.totales).toMatchObject({ productos: 3, clientes: 2, disponibles: 54, vendidos: 21, agotados: 1, bajos: 1 });
  });

  it('el SQL se puede correr otra vez sobre una base que ya lo tiene, sin perder datos', async () => {
    await recarga(A, 25);
    const p = await paquete(A, 'G1', 2);
    await db.exec(sql); // segunda vez, como cuando el dueño lo pega de nuevo en Supabase
    await como(A);
    expect(await saldo()).toBe(25);
    expect((await db.query(`select 1 from public.casillero_paquetes where id = $1`, [p])).rows).toHaveLength(1);
    expect((await db.query(`select count(*)::int n from public.casillero_tarifas`)).rows[0]).toEqual({ n: 4 });
  });

  it('el código de casillero no lo cambia el dueño', async () => {
    await como(A);
    await expect(db.query(`update public.profiles set casillero_codigo='DM9999' where id=$1`, [A])).rejects.toThrow(/no se puede cambiar/);
  });
});
