import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// El cobro de consultas, probado con el SQL de verdad (supabase/schema.sql)
// sobre un Postgres en memoria. Es dinero: el orden en que se gasta, que
// un webhook repetido no regale un plan, y que un plan se renueve y
// venza cuando debe, no se prueba leyendo el código.

const schema = fs.readFileSync(path.resolve(__dirname, '../supabase/schema.sql'), 'utf8');
const parte = schema.slice(
  schema.indexOf('create table if not exists public.research_usage'),
  schema.indexOf('-- Diagnóstico de madurez.')
);

const U = '11111111-1111-1111-1111-111111111111';
let db: PGlite;

async function gastar(limite = 2): Promise<string> {
  const r = await db.query<{ b: string }>(`select public.spend_research_quota($1, $2, 'kalodata', 'x') as b`, [U, limite]);
  return r.rows[0].b;
}
async function creditos(): Promise<number> {
  const r = await db.query<{ credits: number }>(`select credits from public.research_credits where user_id = $1`, [U]);
  return r.rows[0]?.credits ?? 0;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create role anon; create role authenticated;
    create table public.profiles (id uuid primary key, role text default 'cliente');
  `);
  await db.exec(parte);
  await db.query(`insert into public.profiles (id) values ($1)`, [U]);
}, 30_000);

describe('el cobro de consultas', () => {
  it('primero las gratis del día; sin nada más, bloqueado', async () => {
    expect([await gastar(), await gastar(), await gastar()]).toEqual(['free', 'free', 'blocked']);
  });

  it('después de las gratis gasta el plan del mes y recién después los tokens de paquete', async () => {
    await db.query(`select public.grant_research_credits($1, 3)`, [U]);
    await db.query(`select public.grant_token_plan($1, 'tokens_300', 2, 6, 'orden:A')`, [U]);
    await gastar();
    await gastar();
    expect([await gastar(), await gastar(), await gastar()]).toEqual(['plan', 'plan', 'credit']);
    expect(await creditos()).toBe(2);
  });

  it('el mismo pago dos veces (webhook y vuelta del navegador) da un solo plan', async () => {
    await db.query(`select public.grant_token_plan($1, 'tokens_300', 2, 6, 'orden:A')`, [U]);
    await db.query(`select public.grant_token_plan($1, 'tokens_300', 2, 6, 'orden:A')`, [U]);
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.token_plans`);
    expect(r.rows[0].n).toBe(1);
  });

  it('una consulta fallida devuelve lo cobrado: el token del plan y el de paquete', async () => {
    await db.query(`select public.grant_research_credits($1, 1)`, [U]);
    await db.query(`select public.grant_token_plan($1, 'tokens_200', 1, 1, 'orden:B')`, [U]);
    await gastar(0); // plan
    await db.query(`select public.refund_research_quota($1, 'plan')`, [U]);
    expect(await gastar(0)).toBe('plan');
    expect(await gastar(0)).toBe('credit');
    await db.query(`select public.refund_research_quota($1, 'credit')`, [U]);
    expect(await creditos()).toBe(1);
  });

  it('lo que no se usa en el mes no pasa al siguiente, y el mes nuevo trae los suyos', async () => {
    await db.query(`select public.grant_token_plan($1, 'tokens_300', 2, 6, 'orden:C')`, [U]);
    expect([await gastar(0), await gastar(0), await gastar(0)]).toEqual(['plan', 'plan', 'blocked']);
    // Pasa un mes: el plan empezó hace un mes y un día.
    await db.exec(`update public.token_plans set starts_at = now() - interval '1 month 1 day', ends_at = now() - interval '1 month 1 day' + interval '6 months'`);
    await db.exec(`update public.research_usage set created_at = now() - interval '5 days' where plan_id is not null`);
    expect([await gastar(0), await gastar(0), await gastar(0)]).toEqual(['plan', 'plan', 'blocked']);
  });

  it('un plan vencido ya no da tokens', async () => {
    await db.query(`select public.grant_token_plan($1, 'tokens_200', 5, 1, 'orden:D')`, [U]);
    await db.exec(`update public.token_plans set ends_at = now() - interval '1 second'`);
    expect(await gastar(0)).toBe('blocked');
  });
});
