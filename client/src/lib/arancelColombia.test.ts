import { describe, expect, it } from 'vitest';
import { sugerenciaColombia } from './arancelColombia';

describe('sugerenciaColombia', () => {
  it('girdles from China pay 40 % (Decreto 2598 de 2022)', () => {
    expect(sugerenciaColombia('CN', '6212.20.00.20')).toEqual({ tipo: 'fija', pct: 40, norma: 'Decreto 2598 de 2022' });
    expect(sugerenciaColombia('VN', '6109.10')).toMatchObject({ tipo: 'fija', pct: 40 });
  });

  it('from a country with an FTA it depends on the certificate of origin', () => {
    expect(sugerenciaColombia('MX', '6212.20.00')).toMatchObject({ tipo: 'segun_origen', acuerdo: 'TLC con México', preferencial: 0, sinCertificado: 40 });
    expect(sugerenciaColombia('ES', '6203.42')).toMatchObject({ tipo: 'segun_origen', acuerdo: 'Acuerdo con la Unión Europea' });
    expect(sugerenciaColombia('PE', '6104.62')).toMatchObject({ tipo: 'segun_origen', acuerdo: 'Comunidad Andina' });
  });

  it('only knows clothing (chapters 61 and 62), and nothing for a Colombian origin', () => {
    expect(sugerenciaColombia('CN', '3304.99')).toBeNull();
    expect(sugerenciaColombia('CN', '6402.99')).toBeNull();
    expect(sugerenciaColombia('CO', '6212.20')).toBeNull();
  });
});
