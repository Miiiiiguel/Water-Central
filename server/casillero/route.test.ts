import { describe, expect, it } from 'vitest';
import { WALLET_REF_RE, usdToCopCents } from './route';
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

import { avisoPaquete, layoutCasillero } from './correo';
import { rewriteHead } from '../seo';

describe('marca DMatrixUSA', () => {
  it('el correo del paquete no menciona Easycomex y escapa lo que viene del cliente', () => {
    const m = avisoPaquete({ to: 'a@b.co', nombre: '<b>Ana</b>', guia: 'G<1>', pesoLb: 2, accion: 'llegó a nuestra bodega en Miami', enlace: 'https://x.co/casillero' });
    expect(`${m.html}${m.text}${m.subject}`.toLowerCase()).not.toContain('easycomex');
    expect(m.html).toContain('DMatrix');
    expect(m.html).not.toContain('<b>Ana</b>');
    expect(layoutCasillero('t', '')).toContain('#b01c2e');
  });
  it('las rutas del casillero se sirven con el título y el favicon de DMatrixUSA', () => {
    const base = '<head><title>Easycomex | x</title><meta name="description" content="e"/><meta name="theme-color" content="#1B1A45" /><link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" /><meta name="robots" content="index, follow" /></head>';
    for (const ruta of ['/casillero', '/casillero/wallet', '/rastreo']) {
      const out = rewriteHead(base, 'https://x.co', ruta);
      expect(out).toContain('<title>DMatrixUSA');
      expect(out).toContain('/dmatrix/favicon.png');
      expect(out).toContain('noindex');
      expect(out).not.toMatch(/Easycomex/);
    }
    expect(rewriteHead(base, 'https://x.co', '/roi')).not.toContain('DMatrixUSA');
  });
});
