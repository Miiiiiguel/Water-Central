import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerTrm, olvidarTrm, trmVigente } from './trm';
import { enMoneda, quote } from './freight';

describe('TRM', () => {
  beforeEach(() => olvidarTrm());

  it('reads the official rate as the open-data portal publishes it', () => {
    expect(leerTrm([{ valor: '3269.88', unidad: 'COP', vigenciadesde: '2026-11-10T00:00:00.000' }])).toEqual({ valor: 3269.88, fecha: '2026-11-10', oficial: true });
    // Nonsense is not a rate.
    expect(leerTrm([{ valor: '3.26988' }])).toBeNull();
    expect(leerTrm({})).toBeNull();
  });

  it('keeps the official rate for a while, and falls back to the configured one (saying so) when the portal fails', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => [{ valor: '3269.88', vigenciadesde: '2026-11-10T00:00:00.000' }] }) as unknown as Response);
    expect((await trmVigente(ok, 0)).valor).toBe(3269.88);
    await trmVigente(ok, 1000);
    expect(ok).toHaveBeenCalledTimes(1);

    olvidarTrm();
    const caido = vi.fn(async () => { throw new Error('down'); });
    expect(await trmVigente(caido as unknown as typeof fetch, 0)).toEqual({ valor: 4000, fecha: null, oficial: false });
  });
});

describe('enMoneda', () => {
  const trm = { valor: 3269.88, fecha: '2026-11-10', oficial: true };

  it('shows an export quote (pesos) in dollars, with a breakdown that adds up', () => {
    // 10 kg to Miami, VIP: $662,101 − $251,598 = $410,503
    const q = quote({ customerType: 'VIP', destination: '197', packages: [{ weight: 10 }] }, new Date('2026-11-10'), []);
    const d = enMoneda(q, 'USD', trm);
    expect(d.currency).toBe('USD');
    expect(d.pricing.list_price).toBe(202.48); // 662,101 / 3,269.88
    expect(d.pricing.discount_amount).toBe(76.94); // 251,598 / 3,269.88
    expect(d.pricing.final_price).toBe(125.54);
    expect(d.pricing.discount_percent).toBe(38);
    expect(d.cambio).toEqual({ trm: 3269.88, fecha: '2026-11-10', oficial: true, original: { currency: 'COP', final_price: 410503 } });
  });

  it('shows an import quote (dollars) in pesos, and leaves a quote alone in its own currency', () => {
    const q = quote({ customerType: 'VIP', destination: '196', direction: 'importar', packages: [{ weight: 5 }] }, new Date('2026-11-10'), []);
    const p = enMoneda(q, 'COP', trm);
    expect(p.currency).toBe('COP');
    expect(p.pricing.final_price).toBe(p.pricing.list_price - p.pricing.discount_amount);
    expect(Number.isInteger(p.pricing.final_price)).toBe(true);
    expect(enMoneda(q, 'USD', trm)).toBe(q);
  });
});
