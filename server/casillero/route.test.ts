import { describe, expect, it } from 'vitest';
import { MONTO_MIN_USD, WALLET_REF_RE, estadoDelSistema, montoMinimoUsd, usdToCopCents } from './route';
import { integritySignature, transactionPaysFor } from '../wompi';

describe('wallet del casillero', () => {
  it('convierte USD a centavos de peso con la tasa dada', () => {
    expect(usdToCopCents(10, 4000)).toBe(4_000_000);
    expect(usdToCopCents(9.99, 4000)).toBe(3_996_000);
  });
  it('solo reconoce referencias ecw_', () => {
    expect(WALLET_REF_RE.test('ecw_' + 'a'.repeat(32))).toBe(true);
    expect(WALLET_REF_RE.test('ecp_' + 'a'.repeat(32))).toBe(false);
  });
  it('una transacción por otro monto no paga la recarga', () => {
    const esperado = { reference: 'ecw_' + 'b'.repeat(32), amountInCents: 4_000_000, currency: 'COP' };
    const tx = { status: 'APPROVED', reference: esperado.reference, amount_in_cents: 100, currency: 'COP' };
    expect(transactionPaysFor(tx, esperado)).toBe(false);
    expect(transactionPaysFor({ ...tx, amount_in_cents: 4_000_000 }, esperado)).toBe(true);
  });
  it('la firma de integridad cambia si cambia el monto', () => {
    expect(integritySignature('r', 100, 'COP', 's')).not.toBe(integritySignature('r', 101, 'COP', 's'));
  });
});

import { avisoPaquete } from './correo';

describe('correo del casillero', () => {
  it('sale con la plantilla de Easycomex y escapa lo que viene del cliente', () => {
    const m = avisoPaquete({ to: 'a@b.co', nombre: '<b>Ana</b>', guia: 'G<1>', pesoLb: 2, accion: 'llegó a nuestra bodega en Miami', enlace: 'https://x.co/casillero' });
    expect(m.html).toContain('comex');
    expect(m.html).not.toContain('<b>Ana</b>');
    expect(m.html).not.toContain('G<1>');
    expect(`${m.html}${m.text}`.toLowerCase()).not.toContain('dmatrix');
  });
});

describe('recarga mínima configurable', () => {
  const con = (valor: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: valor === undefined ? null : { valor } }) }) }) }) }) as unknown as Parameters<typeof montoMinimoUsd>[0];
  it('usa el valor que fijó el equipo', async () => {
    expect(await montoMinimoUsd(con('20'))).toBe(20);
    expect(await montoMinimoUsd(con('7.5'))).toBe(7.5);
  });
  it('si falta, no es número o es absurdo, vale el mínimo de siempre', async () => {
    expect(await montoMinimoUsd(con(undefined))).toBe(MONTO_MIN_USD);
    expect(await montoMinimoUsd(con(''))).toBe(MONTO_MIN_USD);
    expect(await montoMinimoUsd(con('abc'))).toBe(MONTO_MIN_USD);
    expect(await montoMinimoUsd(con('0'))).toBe(MONTO_MIN_USD);
    expect(await montoMinimoUsd(con('999999'))).toBe(MONTO_MIN_USD);
    expect(await montoMinimoUsd(null)).toBe(MONTO_MIN_USD);
  });
});

describe('estado del sistema', () => {
  it('dice qué está configurado sin revelar ningún valor', () => {
    const e = estadoDelSistema('app.example.com', { WOMPI_ENV: 'production', WOMPI_EVENTS_SECRET: 'sek', PUBLIC_APP_URL: 'https://easycomex.co' } as NodeJS.ProcessEnv);
    expect(e.wompiEntorno).toBe('production');
    expect(e.wompiEventos).toBe(true);
    expect(e.wompiLectura).toBe(false);
    expect(typeof e.registro).toBe('boolean');
    expect(JSON.stringify(e)).not.toContain('sek');
  });
});
