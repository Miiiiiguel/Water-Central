import { describe, expect, it } from 'vitest';
import { sugerenciaArancel, tarifaInicial } from './sugerenciasArancel';

const caso = (destino: string, origen: string, codigo: string, fobUnidad = 12) => sugerenciaArancel({ destino, origen, codigo, fobUnidad });

describe('Colombia', () => {
  it('clothing from a non-FTA country pays 40 % (Decreto 2598 de 2022)', () => {
    expect(caso('CO', 'CN', '6212.20.00.20')).toEqual({ tipo: 'fija', pct: 40, norma: 'Decreto 2598 de 2022' });
    expect(caso('CO', 'VN', '6109.10')).toMatchObject({ tipo: 'fija', pct: 40 });
  });

  it('clothing with an FTA depends on the certificate of origin', () => {
    expect(caso('CO', 'MX', '6212.20.00')).toMatchObject({ tipo: 'segun_origen', acuerdo: 'TLC con México', preferencial: 0, sinCertificado: 40 });
    expect(caso('CO', 'ES', '6203.42')).toMatchObject({ acuerdo: 'Acuerdo con la Unión Europea' });
  });

  it('footwear from a non-FTA country pays 35 % at or under the per-pair threshold (Decreto 0594 de 2026)', () => {
    expect(caso('CO', 'CN', '6402.99', 6.5)).toMatchObject({ tipo: 'fija', pct: 35, norma: 'Decreto 0594 de 2026' });
    expect(caso('CO', 'CN', '6403.91', 11)).toMatchObject({ tipo: 'fija', pct: 35 });
    expect(caso('CO', 'CN', '6403.91', 11.5)).toMatchObject({ tipo: 'escribir' });
    expect(caso('CO', 'CN', '6405.20', 8)).toMatchObject({ tipo: 'fija', pct: 35 });
    // FTA origins are excluded from the decree.
    expect(caso('CO', 'BR', '6402.99', 5)).toBeNull();
  });

  it('knows nothing else, and nothing for a Colombian origin', () => {
    expect(caso('CO', 'CN', '3304.99')).toBeNull();
    expect(caso('CO', 'CO', '6212.20')).toBeNull();
  });
});

describe('México (2026)', () => {
  it('raises clothing to 35 %, toys to 30 % and footwear to 20–35 % for non-FTA origins', () => {
    expect(caso('MX', 'CN', '6109.10')).toMatchObject({ tipo: 'fija', pct: 35 });
    expect(caso('MX', 'IN', '9503.00')).toMatchObject({ tipo: 'fija', pct: 30 });
    const calzado = caso('MX', 'CN', '6402.99');
    expect(calzado).toMatchObject({ tipo: 'opciones', porDefecto: 35 });
    expect(tarifaInicial(calzado)).toBe(35);
  });

  it('FTA partners (T-MEC, Pacific Alliance, CPTPP...) go by certificate of origin', () => {
    expect(caso('MX', 'CO', '6109.10')).toMatchObject({ tipo: 'segun_origen', acuerdo: 'Alianza del Pacífico', sinCertificado: 35 });
    expect(caso('MX', 'VN', '6109.10')).toMatchObject({ acuerdo: 'CPTPP' });
    expect(caso('MX', 'CN', '3304.99')).toBeNull();
  });
});

describe('Chile', () => {
  it('charges a flat 6 %, or 0 % with an FTA certificate', () => {
    expect(caso('CL', 'IN', '3304.99')).toMatchObject({ tipo: 'fija', pct: 6 });
    expect(caso('CL', 'CN', '6109.10')).toMatchObject({ tipo: 'segun_origen', acuerdo: 'TLC con China', preferencial: 0, sinCertificado: 6 });
    expect(caso('CL', 'CO', '0901.21')).toMatchObject({ tipo: 'segun_origen' });
  });
});

it('other destinations get no suggestion', () => {
  expect(caso('JP', 'CN', '6109.10')).toBeNull();
  expect(tarifaInicial(null)).toBeNull();
});
