import { describe, expect, it } from 'vitest';
import {
  arancelDe, buscar, existe, formatearCodigo, indiceDePrueba, linaje,
  normalizarCodigo, registro, unidadesDe,
} from './store';

// El arancel es dato oficial: el trabajo de este módulo es no
// estropearlo. Dos cosas se prueban con datos de verdad —que el archivo
// cargado siga siendo el que creemos— y el resto con filas a mano.

const ARBOL = indiceDePrueba([
  { htsno: '6101', indent: '0', description: "Men's or boys' overcoats, knitted:" },
  { htsno: '6101.20.00', indent: '1', description: 'Of cotton', general: '15.9%', special: 'Free (CO,PE)' },
  { htsno: '6101.20.00.10', indent: '2', description: "Men's (334)", units: '["doz.","<u>kg</u>"]' },
  { htsno: '6101.30.00', indent: '1', description: 'Of man-made fibers', general: '28.2%' },
  { htsno: '6102', indent: '0', description: "Women's overcoats, knitted:" },
  { htsno: '', indent: '1', description: 'Of wool:' },
  { htsno: '6102.10.00', indent: '2', description: 'Other', general: '' },
]);

describe('leer una partida', () => {
  it('encuentra la misma partida con puntos o sin ellos', () => {
    expect(registro('6101.20.00.10', ARBOL)?.fila.description).toBe("Men's (334)");
    expect(registro('6101200010', ARBOL)?.fila.description).toBe("Men's (334)");
  });

  it('una partida que no está en el arancel no existe, y punto', () => {
    // Esta es la regla que impide que alguien —o una IA— se invente un
    // código: si no salió del archivo cargado, no se puede usar.
    expect(existe('9999.99.99', ARBOL)).toBe(false);
    expect(registro('9999.99.99', ARBOL)).toBeNull();
  });

  it('arma la descripción completa, no sólo la última línea', () => {
    // "Other" a secas no clasifica nada. La ruta es lo que significa.
    const ruta = registro('6102.10.00', ARBOL)!.rutaDescripcion;
    expect(ruta).toEqual(["Women's overcoats, knitted:", 'Of wool:', 'Other']);
  });

  it('las filas sin número también son padres', () => {
    // "Of wool:" no tiene código propio pero es parte del linaje.
    expect(linaje('6102.10.00', ARBOL).map((r) => r.fila.htsno)).toEqual(['6102', '', '6102.10.00']);
  });
});

describe('qué arancel aplica de verdad', () => {
  it('lo hereda del padre cuando la línea estadística viene vacía', () => {
    // El caso que rompe a quien lee la fila sola: 6101.20.00.10 no
    // publica tarifa, y sin subir al padre parecería libre de arancel.
    const a = arancelDe('6101.20.00.10', ARBOL)!;
    expect(a.texto).toBe('15.9%');
    expect(a.segun).toBe('6101.20.00');
    expect(a.heredado).toBe(true);
  });

  it('cuando la partida publica su propia tarifa, no hereda nada', () => {
    const a = arancelDe('6101.20.00', ARBOL)!;
    expect(a.heredado).toBe(false);
    expect(a.especial).toContain('CO');
  });

  it('si nadie en el árbol publica tarifa, lo dice en vez de suponer "Free"', () => {
    expect(arancelDe('6102.10.00', ARBOL)).toBeNull();
  });

  it('una partida inexistente no devuelve arancel', () => {
    expect(arancelDe('9999.99.99', ARBOL)).toBeNull();
  });

  it('la unidad también se hereda, y sin el subrayado del HTML', () => {
    expect(unidadesDe('6101.20.00.10', ARBOL)).toEqual(['doz.', 'kg']);
  });
});

describe('buscar partidas', () => {
  it('encuentra por palabras de la ruta, no sólo de la última línea', () => {
    const r = buscar('cotton overcoats', { limite: 5 }, ARBOL);
    expect(r[0].registro.digitos.startsWith('610120')).toBe(true);
  });

  it('el capítulo acota la búsqueda', () => {
    const r = buscar('overcoats', { capitulo: '6102', limite: 5 }, ARBOL);
    expect(r.every((m) => m.registro.digitos.startsWith('6102'))).toBe(true);
  });

  it('sin palabras útiles no inventa resultados', () => {
    expect(buscar('of the other', {}, ARBOL)).toEqual([]);
  });
});

describe('formato de los códigos', () => {
  it('va y vuelve entre las dos escrituras', () => {
    expect(normalizarCodigo('6101.20.00.10')).toBe('6101200010');
    expect(formatearCodigo('6101200010')).toBe('6101.20.00.10');
    expect(formatearCodigo('610120')).toBe('6101.20');
  });
});

describe('el archivo cargado', () => {
  it('es el export oficial completo y sigue respondiendo lo mismo', () => {
    // Si alguien recarga el arancel con otra revisión, esta prueba
    // avisa: la tarifa de la camiseta de algodón es conocida.
    const camiseta = arancelDe('6109.10.00.12');
    expect(camiseta?.texto).toBe('16.5%');
    expect(camiseta?.heredado).toBe(true);
    expect(existe('6109.10.00.12')).toBe(true);
  });
});
