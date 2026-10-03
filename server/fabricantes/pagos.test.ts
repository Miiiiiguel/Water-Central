import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../email', () => ({ escapeHtml: (s: string) => s, sendEmail: vi.fn(async () => true), teamAddress: () => null }));
vi.mock('./portal', async (orig) => ({ ...(await orig<typeof import('./portal')>()), hoyColombia: () => '2026-10-03' }));

const { aplicarPagoDePauta } = await import('./pagos');

type Fila = Record<string, unknown>;

/** Lo justo de la API de Supabase que usa pagos.ts, sobre tablas en memoria. */
function baseFalsa(tablas: Record<string, Fila[]>) {
  const consulta = (tabla: string) => {
    const filtros: Array<[string, unknown]> = [];
    let cambio: Fila | null = null;
    const filas = () => tablas[tabla].filter((f) => filtros.every(([k, v]) => f[k] === v));
    const q = {
      update(obj: Fila) {
        cambio = obj;
        return q;
      },
      select() {
        return q;
      },
      eq(k: string, v: unknown) {
        filtros.push([k, v]);
        return q;
      },
      async maybeSingle() {
        return { data: filas()[0] ?? null, error: null };
      },
      then(resolve: (r: { data: Fila[]; error: null }) => void) {
        const elegidas = filas();
        if (cambio) for (const f of elegidas) Object.assign(f, cambio);
        resolve({ data: elegidas.map((f) => ({ ...f })), error: null });
      },
    };
    return q;
  };
  return { from: consulta } as unknown as SupabaseClient;
}

describe('aplicarPagoDePauta', () => {
  const nuevas = () => ({
    manufacturer_payments: [{ payment_id: 'p1', manufacturer_id: 'm1', meses: 3, aplicado: false, pauta_hasta_nueva: null }],
    manufacturers: [{ id: 'm1', nombre: 'Lab', pauta_hasta: '2026-10-20', estado: 'pendiente', activo: false, contacto_email: 'ventas@lab.co', acceso_email: null }],
  });

  it('extends the listing the months paid, from when it ends, and turns it on', async () => {
    const t = nuevas();
    await aplicarPagoDePauta(baseFalsa(t), 'p1');
    expect(t.manufacturers[0]).toMatchObject({ pauta_hasta: '2027-01-20', estado: 'aprobado', activo: true });
    expect(t.manufacturer_payments[0]).toMatchObject({ aplicado: true, pauta_hasta_nueva: '2027-01-20' });
  });

  it('extends only once even if called twice (browser return and webhook)', async () => {
    const t = nuevas();
    const db = baseFalsa(t);
    await aplicarPagoDePauta(db, 'p1');
    await aplicarPagoDePauta(db, 'p1');
    expect(t.manufacturers[0].pauta_hasta).toBe('2027-01-20');
  });

  it('starts from today when the listing had already ended', async () => {
    const t = nuevas();
    t.manufacturers[0].pauta_hasta = '2026-01-01';
    await aplicarPagoDePauta(baseFalsa(t), 'p1');
    expect(t.manufacturers[0].pauta_hasta).toBe('2027-01-03');
  });

  it('does nothing for a payment that is not a listing', async () => {
    const t = nuevas();
    await aplicarPagoDePauta(baseFalsa(t), 'otro');
    expect(t.manufacturers[0].pauta_hasta).toBe('2026-10-20');
  });
});
