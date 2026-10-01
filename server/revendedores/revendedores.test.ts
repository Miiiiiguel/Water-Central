import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formaValida, generarSerial, hashSerial, normalizarSerial, pistaSerial } from './serial';
import { billeteraDe, entrarConSerial } from './route';
import { esCuentaMaestra } from '../maestros';

describe('serial', () => {
  it('has the ECX-XXXX-XXXX-XXXX-XXXX shape, no look-alike characters, and is random', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const s = generarSerial();
      expect(s).toMatch(/^ECX-[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/);
      expect(formaValida(s)).toBe(true);
      vistos.add(s);
    }
    expect(vistos.size).toBe(200);
  });

  it('accepts it typed loosely: lower case, spaces, without the prefix', () => {
    const s = 'ECX-ABCD-EFGH-JKMN-PQRS';
    for (const variante of ['ecx-abcd-efgh-jkmn-pqrs', ' ABCD EFGH JKMN PQRS ', 'abcdefghjkmnpqrs']) {
      expect(normalizarSerial(variante)).toBe('ABCDEFGHJKMNPQRS');
      expect(hashSerial(variante)).toBe(hashSerial(s));
    }
    expect(pistaSerial(s)).toBe('PQRS');
  });

  it('rejects the wrong length or characters outside the alphabet', () => {
    expect(formaValida('ECX-ABCD-EFGH-JKMN')).toBe(false);
    expect(formaValida('ECX-ABCD-EFGH-JKMN-PQR0')).toBe(false); // 0 is not in the alphabet
    expect(formaValida('ECX-ABCD-EFGH-JKMN-PQRI')).toBe(false); // nor I
  });
});

describe('cuentas maestras', () => {
  const env = { CUENTAS_MAESTRAS: 'Duena@Easycomex.com, socio@easycomex.com' } as NodeJS.ProcessEnv;

  it('are the confirmed accounts listed in CUENTAS_MAESTRAS, case-insensitive', () => {
    expect(esCuentaMaestra({ email: 'duena@easycomex.com', email_confirmed_at: '2026-01-01' }, env)).toBe(true);
    expect(esCuentaMaestra({ email: 'SOCIO@easycomex.com', email_confirmed_at: '2026-01-01' }, env)).toBe(true);
  });

  it('never an unconfirmed email, someone else, or anyone when the variable is empty', () => {
    expect(esCuentaMaestra({ email: 'duena@easycomex.com', email_confirmed_at: null }, env)).toBe(false);
    expect(esCuentaMaestra({ email: 'otro@easycomex.com', email_confirmed_at: '2026-01-01' }, env)).toBe(false);
    expect(esCuentaMaestra({ email: 'duena@easycomex.com', email_confirmed_at: '2026-01-01' }, {} as NodeJS.ProcessEnv)).toBe(false);
    expect(esCuentaMaestra(null, env)).toBe(false);
  });
});

describe('billetera', () => {
  it('owes commissions minus payments, to the cent, and counts distinct clients', () => {
    const b = billeteraDe([
      { tipo: 'comision', monto_usd: 120.1, cliente: 'Café Andino' },
      { tipo: 'comision', monto_usd: 80.2, cliente: 'café andino ' },
      { tipo: 'comision', monto_usd: 50, cliente: 'Textiles Sur' },
      { tipo: 'pago', monto_usd: 100.15, cliente: null },
    ]);
    expect(b).toEqual({ saldo: 150.15, comisiones: 250.3, pagado: 100.15, clientes: 2 });
  });

  it('is zero with no movements', () => {
    expect(billeteraDe([])).toEqual({ saldo: 0, comisiones: 0, pagado: 0, clientes: 0 });
  });
});

describe('entrarConSerial', () => {
  const SERIAL = 'ECX-ABCD-EFGH-JKMN-PQRS';

  function falsos(fila: { id: string; user_id: string; activo: boolean } | null) {
    const consultas: string[] = [];
    const admin = {
      from: () => ({
        select: () => ({
          eq: (_col: string, valor: string) => {
            consultas.push(valor);
            return { maybeSingle: async () => ({ data: fila && valor === hashSerial(SERIAL) ? fila : null, error: null }) };
          },
        }),
      }),
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({ data: { user: { email: 'revendedor-x@revendedores.easycomex.com' } }, error: null })),
          generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'hash-123' } }, error: null })),
        },
      },
    } as unknown as SupabaseClient;
    const anon = {
      auth: {
        verifyOtp: vi.fn(async () => ({ data: { session: { access_token: 'at', refresh_token: 'rt', expires_at: 123 } }, error: null })),
      },
    } as unknown as SupabaseClient;
    return { admin, anon, consultas };
  }

  it('turns a valid serial into a session, looking it up only by its hash', async () => {
    const { admin, anon, consultas } = falsos({ id: 'r1', user_id: 'u1', activo: true });
    const r = await entrarConSerial(' ecx abcd efgh jkmn pqrs ', admin, anon);
    expect(r).toEqual({ ok: true, session: { access_token: 'at', refresh_token: 'rt', expires_at: 123 } });
    expect(consultas).toEqual([hashSerial(SERIAL)]);
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'revendedor-x@revendedores.easycomex.com' });
    expect(anon.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-123', type: 'magiclink' });
  });

  it('refuses an unknown serial, a malformed one (without touching the base) and a paused reseller', async () => {
    const otro = falsos({ id: 'r1', user_id: 'u1', activo: true });
    expect(await entrarConSerial('ECX-ZZZZ-ZZZZ-ZZZZ-ZZZZ', otro.admin, otro.anon)).toEqual({ ok: false, motivo: 'serial_invalido' });

    const mal = falsos(null);
    expect(await entrarConSerial('hola', mal.admin, mal.anon)).toEqual({ ok: false, motivo: 'serial_invalido' });
    expect(mal.consultas).toEqual([]);

    const pausado = falsos({ id: 'r1', user_id: 'u1', activo: false });
    expect(await entrarConSerial(SERIAL, pausado.admin, pausado.anon)).toEqual({ ok: false, motivo: 'inactivo' });
    expect(pausado.anon.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('says so when the server has no database keys', async () => {
    expect(await entrarConSerial(SERIAL, null, null)).toEqual({ ok: false, motivo: 'sin_base' });
  });
});

describe('cobrar a una cuenta maestra', () => {
  it('never charges it: the lookup goes through as "maestra" without touching quota or tokens', async () => {
    const { cobrarConsulta } = await import('../research');
    expect(await cobrarConsulta('u-maestra', 'kalodata', 'café', { maestra: true })).toEqual({ ok: true, billed: 'maestra' });
  });
});
