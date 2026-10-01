import { describe, expect, it } from 'vitest';
import { RESPUESTAS_INICIALES as R0, aplicaAcuerdo, capituloDe, choqueConPartida, evaluarOrigen, grupoPredominante, type FilaFibra } from './reglasOrigen';

const US = { destinoUS: true, capitulo: 61 };
const tela = (...f: Array<[FilaFibra['fibra'], number, boolean?]>) => f.map(([fibra, pct, importada = false]) => ({ fibra, pct, importada }));

describe('evaluarOrigen: ropa y textiles', () => {
  it('waits until the composition adds up to 100 % and the sewing is answered', () => {
    expect(evaluarOrigen(R0, US)).toMatchObject({ estado: 'incompleto', razon: 'faltan_fibras' });
    expect(evaluarOrigen({ ...R0, fibras: tela(['algodon', 90]) }, US)).toMatchObject({ estado: 'incompleto', razon: 'suma' });
    expect(evaluarOrigen({ ...R0, fibras: tela(['algodon', 100]) }, US)).toMatchObject({ estado: 'incompleto', razon: 'falta_confeccion' });
    expect(aplicaAcuerdo(evaluarOrigen(R0, US))).toBe(false);
  });

  it('qualifies when yarn and fabric are regional and it is sewn in the country', () => {
    const v = evaluarOrigen({ ...R0, fibras: tela(['algodon', 95], ['elastano', 5]), cosidoEnOrigen: true }, US);
    expect(v).toMatchObject({ estado: 'califica', razon: 'textil_regional' });
    expect(aplicaAcuerdo(v)).toBe(true);
  });

  it('tolerates up to 10 % of the weight in outside fibers', () => {
    expect(evaluarOrigen({ ...R0, fibras: tela(['algodon', 90], ['poliester', 10, true]), cosidoEnOrigen: true }, US))
      .toMatchObject({ estado: 'califica', razon: 'textil_de_minimis', importado: 10 });
    expect(evaluarOrigen({ ...R0, fibras: tela(['algodon', 60], ['poliester', 40, true]), cosidoEnOrigen: true }, US))
      .toMatchObject({ estado: 'no', razon: 'tela_importada', importado: 40 });
  });

  it('does not tolerate imported elastane into the US, but does elsewhere', () => {
    const r = { ...R0, fibras: tela(['algodon', 95], ['elastano', 5, true]), cosidoEnOrigen: true };
    expect(evaluarOrigen(r, US)).toMatchObject({ estado: 'no', razon: 'elastano' });
    expect(evaluarOrigen(r, { destinoUS: false, capitulo: 61 })).toMatchObject({ estado: 'califica', razon: 'textil_de_minimis' });
  });

  it('does not qualify if it is not cut and sewn in the country', () => {
    expect(evaluarOrigen({ ...R0, fibras: tela(['algodon', 100]), cosidoEnOrigen: false }, US)).toMatchObject({ estado: 'no', razon: 'sin_confeccion' });
  });
});

describe('evaluarOrigen: los demás productos', () => {
  const OTRO = { destinoUS: true, capitulo: 33 };
  it('needs the product to be made in the country', () => {
    expect(evaluarOrigen(R0, OTRO)).toMatchObject({ estado: 'incompleto', razon: 'falta_transformacion' });
    expect(evaluarOrigen({ ...R0, transformado: false, importadoPct: 0 }, OTRO)).toMatchObject({ estado: 'no', razon: 'sin_transformacion' });
  });

  it('grades the share of outside inputs: all local, up to 10 %, up to the cap, above it', () => {
    const con = (p: number, ctx = OTRO) => evaluarOrigen({ ...R0, transformado: true, importadoPct: p }, ctx);
    expect(con(0)).toMatchObject({ estado: 'califica', razon: 'totalmente' });
    expect(con(10)).toMatchObject({ estado: 'califica', razon: 'de_minimis' });
    expect(con(55)).toMatchObject({ estado: 'probable', razon: 'valor', tope: 55 });
    expect(con(56)).toMatchObject({ estado: 'no', razon: 'exceso' });
    expect(con(55, { destinoUS: false, capitulo: 33 })).toMatchObject({ estado: 'no', tope: 50 });
    expect(aplicaAcuerdo(con(40))).toBe(true);
  });

  it('asks what the product is when no tariff code is chosen yet', () => {
    expect(evaluarOrigen(R0, { destinoUS: true, capitulo: null })).toMatchObject({ estado: 'incompleto', razon: 'falta_tipo' });
    expect(evaluarOrigen({ ...R0, tipo: 'otro', transformado: true, importadoPct: 0 }, { destinoUS: true, capitulo: null }).estado).toBe('califica');
  });

  it('a certificate of origin settles it', () => {
    expect(evaluarOrigen({ ...R0, certificado: true }, OTRO)).toMatchObject({ estado: 'califica', razon: 'certificado' });
  });
});

describe('composition vs tariff code', () => {
  const camisetaAlgodon = { capitulo: 61, descripcion: ['T-shirts, singlets, tank tops and similar garments, knitted or crocheted', 'Of cotton'] };
  const deSinteticas = { capitulo: 61, descripcion: ['T-shirts...', 'Of man-made fibers'] };

  it('finds the fiber that weighs most, by group', () => {
    expect(grupoPredominante(tela(['poliester', 30], ['nylon', 30], ['algodon', 40]))).toBe('sinteticas');
    expect(grupoPredominante(tela(['algodon', 50], ['poliester', 50]))).toBeNull();
  });

  it('warns when a garment code names another fiber', () => {
    expect(choqueConPartida(tela(['poliester', 70], ['algodon', 30]), camisetaAlgodon)).toEqual({ predominante: 'sinteticas', partida: ['algodon'] });
    expect(choqueConPartida(tela(['algodon', 100]), camisetaAlgodon)).toBeNull();
    expect(choqueConPartida(tela(['viscosa', 100]), deSinteticas)).toBeNull();
    // Not a garment chapter, or the composition is not complete: no warning.
    expect(choqueConPartida(tela(['poliester', 100]), { capitulo: 52, descripcion: ['Of cotton'] })).toBeNull();
    expect(choqueConPartida(tela(['poliester', 60]), camisetaAlgodon)).toBeNull();
  });
});

it('capituloDe reads the first two digits', () => {
  expect(capituloDe('6109.10.00.04')).toBe(61);
  expect(capituloDe('0901.21')).toBe(9);
  expect(capituloDe(null)).toBeNull();
});
