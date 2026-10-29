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

  it('el código de casillero no lo cambia el dueño', async () => {
    await como(A);
    await expect(db.query(`update public.profiles set casillero_codigo='DM9999' where id=$1`, [A])).rejects.toThrow(/no se puede cambiar/);
  });
});
