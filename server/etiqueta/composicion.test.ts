import { describe, expect, it } from 'vitest';
import { fibraDe, leerEtiqueta } from './composicion';

// Las etiquetas de estas pruebas están copiadas de prendas reales: el
// texto con saltos raros, los dos idiomas encima, y los números que el
// OCR lee mal. Si el parser sólo funciona con etiquetas limpias, no
// funciona.

const soloFibras = (t: string) =>
  leerEtiqueta(t).fibras.map((f) => `${f.fibra}:${f.porcentaje ?? '?'}`);

describe('la composición de la tela', () => {
  it('lee el porcentaje delante de la fibra', () => {
    expect(soloFibras('95% ALGODÓN 5% ELASTANO')).toEqual(['algodon:95', 'elastano:5']);
  });

  it('lee el porcentaje detrás de la fibra', () => {
    expect(soloFibras('ALGODON 95%\nELASTANO 5%')).toEqual(['algodon:95', 'elastano:5']);
  });

  it('lee la fibra aunque el OCR haya puesto ceros por oes', () => {
    // "P0LYESTER" y "C0TT0N" son lo que devuelve el OCR sobre una
    // etiqueta impresa en tinta clara. Descartarlas sería descartar la
    // etiqueta entera.
    expect(soloFibras('65% P0LYESTER 35% C0TT0N')).toEqual(['poliester:65', 'algodon:35']);
  });

  it('aguanta una letra de más o de menos', () => {
    expect(soloFibras('100% POLIESTERR')).toEqual(['poliester:100']);
  });

  it('no confunde dos fibras de nombre parecido', () => {
    // "lana" y "lino" se parecen; equivocarse cambia el capítulo del
    // arancel entero (51 contra 53).
    expect(fibraDe('lana')?.fibra).toBe('lana');
    expect(fibraDe('lino')?.fibra).toBe('lino');
    expect(fibraDe('limo')).toBeNull();
  });

  it('cuenta una sola vez la fibra repetida en varios idiomas', () => {
    expect(soloFibras('100% ALGODÓN\n100% COTTON\n100% COTON')).toEqual(['algodon:100']);
  });

  it('separa por comas, barras y puntos', () => {
    expect(soloFibras('60% COTTON, 35% POLYESTER / 5% SPANDEX')).toEqual([
      'algodon:60', 'poliester:35', 'elastano:5',
    ]);
  });

  it('reconoce la fibra aunque no venga el porcentaje', () => {
    const e = leerEtiqueta('COMPOSICIÓN: ALGODÓN');
    expect(e.fibras.map((f) => f.fibra)).toEqual(['algodon']);
    expect(e.fibras[0].porcentaje).toBeNull();
    expect(e.faltante).toContain('porcentajes');
  });
});

describe('las capas de la prenda', () => {
  const chaqueta = [
    'SHELL: 100% POLYESTER',
    'LINING: 100% COTTON',
    'FILLING: 90% DOWN 10% FEATHER',
  ].join('\n');

  it('clasifica por la tela exterior, no por el forro', () => {
    // El error que cambia la partida: esta chaqueta NO es de algodón.
    const e = leerEtiqueta(chaqueta);
    expect(e.fibraPrincipal?.fibra).toBe('poliester');
    expect(e.fibras.map((f) => f.fibra)).toEqual(['poliester']);
  });

  it('guarda el forro aparte, sin mezclarlo con el exterior', () => {
    const e = leerEtiqueta(chaqueta);
    const forro = e.capas.find((c) => c.capa === 'forro');
    expect(forro?.fibras.map((f) => f.fibra)).toEqual(['algodon']);
  });

  it('entiende las capas en español', () => {
    const e = leerEtiqueta('TELA EXTERIOR: 100% NYLON\nFORRO: 100% POLIÉSTER');
    expect(e.fibraPrincipal?.fibra).toBe('nylon');
  });

  it('cuando la etiqueta no separa capas, lo que hay es el exterior', () => {
    const e = leerEtiqueta('97% ALGODÓN 3% ELASTANO');
    expect(e.fibraPrincipal?.fibra).toBe('algodon');
    expect(e.faltante).not.toContain('tela_exterior');
  });
});

describe('lo que hay que revisar antes de clasificar', () => {
  it('avisa cuando los porcentajes no llegan a 100', () => {
    const e = leerEtiqueta('60% ALGODÓN 30% POLIÉSTER');
    expect(e.advertencias.join(' ')).toMatch(/suman 90%/);
  });

  it('avisa cuando dos fibras empatan, porque ahí cambia la partida', () => {
    const e = leerEtiqueta('50% ALGODÓN 50% POLIÉSTER');
    expect(e.advertencias.join(' ')).toMatch(/empatan/i);
  });

  it('no inventa una fibra principal cuando no hay con qué decidir', () => {
    const e = leerEtiqueta('ALGODÓN Y POLIÉSTER');
    expect(e.fibraPrincipal).toBeNull();
  });
});

describe('el resto de la etiqueta', () => {
  const real = [
    'CAMISETA MANGA CORTA',
    '95% ALGODÓN 5% ELASTANO',
    'TALLA: M',
    'HECHO EN COLOMBIA',
    'RN 123456',
    'LAVAR A MÁQUINA AGUA FRÍA',
    'NO USAR BLANQUEADOR',
    'NO PLANCHAR',
  ].join('\n');

  it('saca talla, origen y registro del fabricante', () => {
    const e = leerEtiqueta(real);
    expect(e.talla).toBe('M');
    expect(e.origen).toBe('COLOMBIA');
    expect(e.rn).toBe('123456');
  });

  it('entiende "MADE IN" igual que "HECHO EN"', () => {
    expect(leerEtiqueta('MADE IN VIETNAM').origen).toBe('VIETNAM');
  });

  it('lista los cuidados que declara', () => {
    const e = leerEtiqueta(real);
    expect(e.cuidados).toContain('lavar_a_maquina');
    expect(e.cuidados).toContain('no_blanqueador');
    expect(e.cuidados).toContain('no_planchar');
  });

  it('con la etiqueta completa no queda nada por preguntar', () => {
    expect(leerEtiqueta(real).faltante).toEqual([]);
  });
});

describe('cuando no hay etiqueta que leer', () => {
  it('con texto vacío pide la composición en vez de suponerla', () => {
    const e = leerEtiqueta('');
    expect(e.fibras).toEqual([]);
    expect(e.fibraPrincipal).toBeNull();
    expect(e.faltante).toContain('composicion');
  });

  it('con una foto borrosa que sólo dio ruido, tampoco inventa', () => {
    const e = leerEtiqueta('|||  ~~~ ???\n...');
    expect(e.fibras).toEqual([]);
    expect(e.faltante).toContain('composicion');
  });
});
