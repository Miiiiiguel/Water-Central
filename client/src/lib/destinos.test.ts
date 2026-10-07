import { describe, expect, it } from 'vitest';
import { DESTINOS, DESTINOS_PRINCIPALES, destino, mismoMercado } from './destinos';
import { PAISES, UNION_EUROPEA } from './paises';

describe('DESTINOS', () => {
  it('has (almost) every country, each once', () => {
    expect(DESTINOS.length).toBeGreaterThan(220);
    expect(new Set(DESTINOS.map((d) => d.iso)).size).toBe(DESTINOS.length);
    for (const d of DESTINOS) expect(PAISES.some((p) => p.iso === d.iso), d.iso).toBe(true);
  });

  it('reads the US, the UK and the 27 EU members live; the rest take a typed rate', () => {
    expect(destino('US')?.fuente).toBe('hts');
    expect(destino('GB')?.fuente).toBe('uk');
    expect(UNION_EUROPEA).toHaveLength(27);
    for (const iso of UNION_EUROPEA) expect(destino(iso)?.fuente, iso).toBe('xi');
    expect(destino('JP')?.fuente).toBe('manual');
    expect(destino('MX')?.fuente).toBe('manual');
  });

  it('values goods FOB where that country does, CIF elsewhere', () => {
    for (const iso of ['US', 'CA', 'AU', 'NZ', 'ZA']) expect(destino(iso)?.base, iso).toBe('fob');
    for (const iso of ['GB', 'ES', 'MX', 'JP', 'CN', 'BR']) expect(destino(iso)?.base, iso).toBe('cif');
  });

  it('leaves out US territories, which enter under the US tariff', () => {
    for (const iso of ['PR', 'VI', 'GU']) expect(destino(iso)).toBeNull();
  });
});

it('every main market is a real destination, Canada right after the US', () => {
  for (const iso of DESTINOS_PRINCIPALES) expect(destino(iso), iso).not.toBeNull();
  expect(DESTINOS_PRINCIPALES.slice(0, 2)).toEqual(['US', 'CA']);
  expect(new Set(DESTINOS_PRINCIPALES).size).toBe(DESTINOS_PRINCIPALES.length);
});

describe('mismoMercado', () => {
  it('the same country, or two EU countries, pay no import duty', () => {
    expect(mismoMercado('CO', 'CO')).toBe(true);
    expect(mismoMercado('ES', 'DE')).toBe(true);
    expect(mismoMercado('GB', 'ES')).toBe(false);
    expect(mismoMercado('US', 'CO')).toBe(false);
  });
});
