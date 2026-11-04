import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// La seguridad de verdad: schema.sql + casillero.sql completos y cada consulta
// hecha COMO un cliente, como otro cliente, como el equipo y como un visitante,
// con las reglas de fila (RLS) puestas. Las otras pruebas corren como dueño de
// la base, que se salta esas reglas; por eso un error como «infinite recursion
// detected in policy for relation profiles» (nadie podía leer su perfil) no se veía.

const leer = (f: string) => fs.readFileSync(path.resolve(__dirname, '../../supabase', f), 'utf8');
const A = '11111111-1111-1111-1111-111111111111'; // cliente
const B = '22222222-2222-2222-2222-222222222222'; // otro cliente
const S = '33333333-3333-3333-3333-333333333333'; // equipo
let db: PGlite;

type Rol = 'authenticated' | 'anon';
async function como<T = Record<string, any>>(uid: string | null, sql: string, params: unknown[] = [], rol: Rol = 'authenticated') {
  await db.exec(`select set_config('app.uid', '${uid ?? ''}', false); set role ${rol};`);
  try {
    const r = await db.query<T>(sql, params);
    return { ok: true as const, filas: r.rows, n: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message, filas: [] as T[], n: 0 };
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create role anon; create role authenticated; create role service_role;`);
  await db.exec(leer('schema.sql'));
  await db.exec(leer('casillero.sql'));
  // Lo que Supabase da por defecto a sus roles de API (las reglas de fila son lo que filtra).
  await db.exec(`
    grant usage on schema public, auth to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  // Tres cuentas: el disparador handle_new_user crea cada ficha.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}', 'ana@x.co', '{"full_name":"Ana","telefono":"300"}'),
      ('${B}', 'beto@x.co', '{"full_name":"Beto"}'),
      ('${S}', 'jefe@x.co', '{"full_name":"Jefe"}');
    update public.profiles set role = 'vendedor' where id = '${S}';`);
}, 60_000);

describe('fichas (profiles)', () => {
  it('un cliente lee su propia ficha y no la de otros', async () => {
    const r = await como<{ email: string }>(A, `select email from public.profiles`);
    expect(r.ok).toBe(true);
    expect(r.filas.map((x) => x.email)).toEqual(['ana@x.co']);
  });
  it('el equipo lee todas las fichas', async () => {
    const r = await como(S, `select 1 from public.profiles`);
    expect(r.ok && r.filas.length).toBe(3);
  });
  it('un cliente edita sus datos, pero no puede volverse del equipo ni cambiar su código', async () => {
    expect((await como(A, `update public.profiles set telefono = '311' where id = '${A}' returning telefono`)).filas).toEqual([{ telefono: '311' }]);
    const subir = await como(A, `update public.profiles set role = 'vendedor' where id = '${A}'`);
    expect(subir.ok).toBe(false);
    expect((await como<{ role: string }>(S, `select role from public.profiles where id = '${A}'`)).filas[0].role).toBe('cliente');
    expect((await como(A, `update public.profiles set casillero_codigo = 'DM9999' where id = '${A}'`)).ok).toBe(false);
  });
  it('un cliente no edita la ficha de otro', async () => {
    const r = await como(A, `update public.profiles set telefono = 'robado' where id = '${B}' returning id`);
    expect(r.filas).toHaveLength(0);
  });
  it('un visitante sin sesión no ve ninguna ficha', async () => {
    const r = await como(null, `select 1 from public.profiles`, [], 'anon');
    expect(r.ok ? r.filas.length : 0).toBe(0);
  });
  it('solo el equipo cambia roles y bloqueos, y nunca el propio', async () => {
    expect((await como(A, `select public.casillero_set_rol('${B}', 'vendedor')`)).ok).toBe(false);
    expect((await como(S, `select public.casillero_set_rol('${S}', 'cliente')`)).ok).toBe(false);
    expect((await como(S, `select public.casillero_set_bloqueo('${B}', true)`)).ok).toBe(true);
    expect((await como(S, `select public.casillero_set_bloqueo('${B}', false)`)).ok).toBe(true);
  });
});

describe('paquetes y despachos', () => {
  it('un cliente prealerta lo suyo, y solo como prealertado', async () => {
    expect((await como(A, `insert into public.casillero_paquetes (user_id, guia, estado) values ('${A}', 'GA1', 'prealertado')`)).ok).toBe(true);
    expect((await como(A, `insert into public.casillero_paquetes (user_id, guia, estado) values ('${A}', 'GA2', 'recibido')`)).ok).toBe(false);
    expect((await como(A, `insert into public.casillero_paquetes (user_id, guia, estado) values ('${B}', 'GA3', 'prealertado')`)).ok).toBe(false);
  });
  it('cada cliente ve solo sus paquetes y el equipo ve todos', async () => {
    await como(B, `insert into public.casillero_paquetes (user_id, guia) values ('${B}', 'GB1')`);
    expect((await como<{ guia: string }>(A, `select guia from public.casillero_paquetes`)).filas.map((x) => x.guia)).toEqual(['GA1']);
    expect((await como<{ guia: string }>(B, `select guia from public.casillero_paquetes`)).filas.map((x) => x.guia)).toEqual(['GB1']);
    expect((await como(S, `select 1 from public.casillero_paquetes`)).filas).toHaveLength(2);
  });
  it('un cliente no cambia el estado ni el peso; el equipo sí', async () => {
    expect((await como(A, `update public.casillero_paquetes set estado = 'recibido', peso_lb = 1 where guia = 'GA1' returning id`)).filas).toHaveLength(0);
    expect((await como(S, `update public.casillero_paquetes set estado = 'recibido', peso_lb = 2 where guia = 'GA1' returning id`)).filas).toHaveLength(1);
  });
  it('el rastreo público solo muestra estados y fechas', async () => {
    const r = await como<Record<string, unknown>>(null, `select * from public.casillero_rastrear('GA1')`, [], 'anon');
    expect(r.ok).toBe(true);
    expect(r.filas.length).toBeGreaterThan(0);
    expect(Object.keys(r.filas[0]).sort()).toEqual(['created_at', 'estado']);
  });
});

describe('wallet y dinero', () => {
  it('un cliente ve su wallet pero no puede escribir en él', async () => {
    expect((await como(A, `insert into public.casillero_wallet (user_id, tipo, monto, estado) values ('${A}', 'recarga', 1000, 'aprobado')`)).ok).toBe(false);
    expect((await como(A, `update public.casillero_wallet set monto = 9999`)).filas).toHaveLength(0);
  });
  it('solo el equipo ajusta saldos; el cliente lo ve y despacha con él', async () => {
    expect((await como(A, `select public.casillero_ajustar_saldo('${A}', 50, 'regalo')`)).ok).toBe(false);
    expect((await como(S, `select public.casillero_ajustar_saldo('${A}', 50, 'Bono de prueba')`)).ok).toBe(true);
    expect(Number((await como<{ s: string }>(A, `select public.casillero_mi_saldo() as s`)).filas[0].s)).toBe(50);
    expect((await como(B, `select 1 from public.casillero_wallet`)).filas).toHaveLength(0); // B no ve el de A
    const p = (await como<{ id: string }>(A, `select id from public.casillero_paquetes where guia = 'GA1'`)).filas[0].id;
    const d = await como<{ d: string }>(A, `select public.casillero_solicitar_despacho($1::uuid[], 'local', 'Calle 1') as d`, [[p]]);
    expect(d.ok).toBe(true);
    expect(Number((await como<{ s: string }>(A, `select public.casillero_mi_saldo() as s`)).filas[0].s)).toBeCloseTo(50 - 9.36);
  });
  it('solo el equipo cancela con reembolso y resuelve recargas', async () => {
    const id = (await como<{ id: string }>(S, `select id from public.casillero_despachos limit 1`)).filas[0].id;
    expect((await como(A, `select public.casillero_cancelar_despacho('${id}')`)).ok).toBe(false);
    expect((await como(S, `select public.casillero_cancelar_despacho('${id}')`)).ok).toBe(true);
    expect(Number((await como<{ s: string }>(A, `select public.casillero_mi_saldo() as s`)).filas[0].s)).toBe(50);
  });
});

describe('inventario, configuración y tablero', () => {
  it('cada cliente ve solo sus productos; el equipo ve todos', async () => {
    expect((await como(A, `insert into public.casillero_productos (user_id, sku, nombre) values ('${A}', 'CAM-1', 'Camiseta')`)).ok).toBe(true);
    expect((await como(A, `insert into public.casillero_productos (user_id, sku, nombre) values ('${B}', 'X-1', 'Ajeno')`)).ok).toBe(false);
    expect((await como(B, `select 1 from public.casillero_productos`)).filas).toHaveLength(0);
    expect((await como(B, `select 1 from public.casillero_inventario`)).filas).toHaveLength(0);
    expect((await como(S, `select 1 from public.casillero_inventario`)).filas).toHaveLength(1);
  });
  it('el cliente no se registra ingresos a sí mismo; el equipo sí', async () => {
    const pid = (await como<{ id: string }>(A, `select id from public.casillero_productos where sku = 'CAM-1'`)).filas[0].id;
    expect((await como(A, `insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad) values ('${pid}', '${A}', 'ingreso', 999)`)).ok).toBe(false);
    expect((await como(S, `insert into public.casillero_inv_mov (producto_id, user_id, tipo, cantidad, origen) values ('${pid}', '${A}', 'ingreso', 40, 'bodega')`)).ok).toBe(true);
    expect((await como<{ disponibles: number }>(A, `select disponibles from public.casillero_inventario`)).filas[0].disponibles).toBe(40);
    expect((await como(S, `select public.casillero_inv_global(7) as g`)).ok).toBe(true);
    expect((await como(A, `select public.casillero_inv_global(7) as g`)).ok).toBe(false);
  });
  it('todos leen la configuración; solo el equipo la cambia', async () => {
    expect((await como(A, `select 1 from public.casillero_config`)).filas.length).toBeGreaterThan(0);
    expect((await como(A, `update public.casillero_config set valor = '1' where clave = 'recarga_min_usd' returning clave`)).filas).toHaveLength(0);
    expect((await como(S, `update public.casillero_config set valor = '10' where clave = 'recarga_min_usd' returning clave`)).filas).toHaveLength(1);
  });
  it('las llaves de las tiendas no las lee nadie desde el navegador', async () => {
    await db.exec(`insert into public.casillero_integraciones (id, user_id, plataforma, dominio) values ('44444444-4444-4444-4444-444444444444', '${A}', 'shopify', 'a.myshopify.com');
      insert into public.casillero_integraciones_secretos (integracion_id, secretos_cifrados, webhook_secret) values ('44444444-4444-4444-4444-444444444444', 'cifrado', 'sec');`);
    expect((await como(A, `select 1 from public.casillero_integraciones_secretos`)).filas).toHaveLength(0);
    expect((await como(S, `select 1 from public.casillero_integraciones_secretos`)).filas).toHaveLength(0);
    expect((await como(A, `select 1 from public.casillero_integraciones`)).filas).toHaveLength(1);
    expect((await como(B, `select 1 from public.casillero_integraciones`)).filas).toHaveLength(0);
  });
  it('el tablero y la auditoría son solo del equipo', async () => {
    expect((await como(A, `select public.casillero_stats()`)).ok).toBe(false);
    expect((await como(S, `select public.casillero_stats()`)).ok).toBe(true);
    expect((await como(A, `select 1 from public.casillero_auditoria`)).filas).toHaveLength(0);
    expect((await como(S, `select 1 from public.casillero_auditoria`)).filas.length).toBeGreaterThan(0);
  });
  it('las notificaciones son de cada dueño', async () => {
    const a = await como<{ user_id: string }>(A, `select user_id from public.notifications`);
    expect(a.ok).toBe(true);
    expect(a.filas.every((x) => x.user_id === A)).toBe(true);
  });
});
