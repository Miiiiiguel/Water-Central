import { describe, expect, it } from 'vitest';
import { diaColombia, esSuyo, porLugar, precioPauta, serieDiaria, topBusquedas } from './portal';
import { extenderMeses } from '../../client/src/lib/fabricantes';

const confirmado = (email: string) => ({ email, email_confirmed_at: '2026-10-01T00:00:00Z' });

describe('esSuyo', () => {
  it('lets in the access email, or the contact email when there is none, case-insensitive', () => {
    expect(esSuyo({ contacto_email: 'ventas@lab.co', acceso_email: 'gerencia@lab.co' }, confirmado('Gerencia@Lab.co'))).toBe(true);
    expect(esSuyo({ contacto_email: 'ventas@lab.co', acceso_email: 'gerencia@lab.co' }, confirmado('ventas@lab.co'))).toBe(false);
    expect(esSuyo({ contacto_email: 'ventas@lab.co', acceso_email: null }, confirmado('ventas@lab.co'))).toBe(true);
  });

  it('never lets in an unconfirmed email, or a manufacturer without email', () => {
    expect(esSuyo({ contacto_email: 'ventas@lab.co' }, { email: 'ventas@lab.co', email_confirmed_at: null })).toBe(false);
    expect(esSuyo({ contacto_email: null, acceso_email: null }, confirmado('x@y.co'))).toBe(false);
    expect(esSuyo({ contacto_email: 'ventas@lab.co' }, null)).toBe(false);
  });
});

describe('serieDiaria', () => {
  it('has one row per day up to today, in Colombia time', () => {
    const s = serieDiaria(
      [
        { tipo: 'impresion', created_at: '2026-10-03T15:00:00Z' },
        { tipo: 'impresion', created_at: '2026-10-03T16:00:00Z' },
        // 2 a.m. UTC on Oct 3 is still Oct 2 in Bogotá.
        { tipo: 'contacto', created_at: '2026-10-03T02:00:00Z' },
        { tipo: 'impresion', created_at: '2026-08-01T00:00:00Z' },
      ],
      '2026-10-03',
      30
    );
    expect(s).toHaveLength(30);
    expect(s[0].dia).toBe('2026-09-04');
    expect(s[29]).toEqual({ dia: '2026-10-03', vistas: 2, contactos: 0 });
    expect(s[28]).toEqual({ dia: '2026-10-02', vistas: 0, contactos: 1 });
    expect(s.reduce((n, d) => n + d.vistas, 0)).toBe(2);
  });

  it('crosses month boundaries', () => {
    expect(serieDiaria([], '2026-03-01', 3).map((d) => d.dia)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

it('diaColombia', () => {
  expect(diaColombia('2026-10-04T03:00:00Z')).toBe('2026-10-03');
});

it('topBusquedas groups by text ignoring case and accents', () => {
  const t = topBusquedas([
    { tipo: 'impresion', contexto: 'Champú', created_at: '' },
    { tipo: 'impresion', contexto: 'champu', created_at: '' },
    { tipo: 'contacto', contexto: 'crema', created_at: '' },
    { tipo: 'impresion', contexto: null, created_at: '' },
  ]);
  expect(t).toEqual([
    { texto: 'Champú', veces: 2 },
    { texto: 'crema', veces: 1 },
  ]);
});

it('porLugar counts views by where they happened', () => {
  expect(
    porLugar([
      { tipo: 'impresion', lugar: 'chat', created_at: '' },
      { tipo: 'impresion', lugar: 'roi', created_at: '' },
      { tipo: 'impresion', lugar: 'roi', created_at: '' },
      { tipo: 'contacto', lugar: 'roi', created_at: '' },
    ])
  ).toEqual({ chat: 1, roi: 2, directorio: 0, etiqueta: 0 });
});

describe('precioPauta', () => {
  it('charges the monthly USD price times the months, in pesos rounded down to the hundred', () => {
    // 150 USD × 3 = 450 USD × 4000 = 1.800.000 pesos.
    expect(precioPauta(150, 3, 4000)).toEqual({ usdCents: 45000, amountInCents: 180000000, currency: 'COP' });
    expect(precioPauta(99.99, 1, 4000)?.amountInCents).toBe(39990000);
  });

  it('does not charge without a price or for an odd number of months', () => {
    expect(precioPauta(null, 1)).toBeNull();
    expect(precioPauta(0, 1)).toBeNull();
    expect(precioPauta(150, 2)).toBeNull();
  });
});

describe('extenderMeses', () => {
  it('extends from today, or from the end of a running listing', () => {
    expect(extenderMeses(null, '2026-10-03', 3)).toBe('2027-01-03');
    expect(extenderMeses('2026-12-15', '2026-10-03', 12)).toBe('2027-12-15');
    expect(extenderMeses('2026-08-31', '2026-10-03', 1)).toBe('2026-11-03');
    expect(extenderMeses('2026-10-31', '2026-10-03', 1)).toBe('2026-11-30');
  });
});
