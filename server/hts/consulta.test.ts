import { describe, expect, it } from 'vitest';
import { arbol, buscarPartidas, capitulos, detalle } from './consulta';
import { existe } from './store';

// Contra el arancel real: lo que escribiría una marca latinoamericana.

const primeros = (q: string, n = 5) => buscarPartidas(q).slice(0, n).map((x) => x.digitos);
const algunoEmpieza = (q: string, prefijo: string, n = 5) => primeros(q, n).some((d) => d.startsWith(prefijo));

describe('buscar en español', () => {
  const casos: Array<[string, string]> = [
    ['camiseta de algodón', '610910'],
    ['café tostado', '0901'],
    ['jeans de mujer', '6204'],
    ['atún en lata', '160414'],
    ['velas', '3406'],
    ['zapatos de cuero', '640'],
    ['bolso de cuero', '420221'],
    ['champú', '330510'],
    ['esmeraldas', '710391'],
    ['rosas', '060311'],
    ['aguacate', '080440'],
  ];
  for (const [q, prefijo] of casos) {
    it(`"${q}" → ${prefijo}…`, () => {
      expect(algunoEmpieza(q, prefijo), JSON.stringify(primeros(q))).toBe(true);
    });
  }

  it('la ropa de bebé no le gana a la de adulto si no se pidió', () => {
    expect(primeros('camiseta de algodón', 1)[0].startsWith('6109')).toBe(true);
    expect(algunoEmpieza('camiseta de algodón para bebé', '6111')).toBe(true);
  });

  it('en inglés también', () => {
    expect(algunoEmpieza('cotton t-shirts', '6109')).toBe(true);
  });
});

describe('buscar por código', () => {
  it('lista lo que empieza con esos dígitos, en orden', () => {
    const r = buscarPartidas('6109');
    // Los títulos de 4 y 6 dígitos no tienen tarifa: se lista desde la línea de 8.
    expect(r[0].codigo).toBe('6109.10.00');
    expect(r.every((x) => x.digitos.length >= 8)).toBe(true);
    expect(r.every((x) => x.digitos.startsWith('6109'))).toBe(true);
    expect(buscarPartidas('6109.10.00.12')[0].codigo).toBe('6109.10.00.12');
  });

  it('los capítulos 98 y 99 no son partidas de producto', () => {
    expect(buscarPartidas('9903')).toEqual([]);
    expect(detalle('9903.01.25')).toBeNull();
  });
});

describe('cada resultado existe en el arancel cargado', () => {
  it('ninguno se inventa', () => {
    for (const q of ['camiseta', 'café', 'jeans', 'velas', '6109', 'xyz sin sentido']) {
      for (const r of buscarPartidas(q)) expect(existe(r.digitos), `${q}: ${r.codigo}`).toBe(true);
    }
  });
});

describe('recorrer el arbol', () => {
  it('capítulo → partidas → subpartidas → líneas de 10 dígitos', () => {
    const cap = arbol({ capitulo: '61' });
    expect(cap[0].codigo).toBe('6101');
    const p6109 = cap.find((n) => n.codigo === '6109')!;
    const hijos = arbol({ linea: p6109.linea });
    expect(hijos.some((n) => n.codigo === '6109.10.00')).toBe(true);
    const algodon = hijos.find((n) => n.codigo === '6109.10.00')!;
    expect(algodon.tarifa).toBe('16.5%');
    // Debajo hay filas sin número ("Men's or boys':") que agrupan; se
    // recorren igual hasta llegar a los 10 dígitos.
    let nivel = arbol({ linea: algodon.linea });
    while (nivel.length && !nivel.some((n) => n.codigo && n.codigo.replace(/\D/g, '').length === 10)) {
      nivel = arbol({ linea: nivel[0].linea });
    }
    expect(nivel.some((n) => n.codigo?.replace(/\D/g, '').length === 10)).toBe(true);
  });

  it('están los 96 capítulos de producto con nombre en español', () => {
    const c = capitulos();
    expect(c.length).toBe(96);
    expect(c.find((x) => x.codigo === '09')?.nombre).toMatch(/Café/);
  });
});

describe('el detalle de una partida', () => {
  it('camiseta de algodón de hombre: 16,5 % heredado, libre para Colombia por el TPA', () => {
    const d = detalle('6109.10.00.12')!;
    expect(d.general).toMatchObject({ texto: '16.5%', segun: '6109.10.00', heredado: true });
    expect(d.preferencial.CO).toMatchObject({ programa: 'CO', texto: 'Free' });
    expect(d.preferencial.MX?.programa).toMatch(/^S/);
    expect(d.preferencial.BR).toBeUndefined();
    expect(d.estadistica).toBe(true);
  });

  it('un artículo de acero avisa la Sección 232', () => {
    const acero = buscarPartidas('7323')[1];
    expect(detalle(acero.codigo)!.avisos.join(' ')).toMatch(/232/);
  });

  it('un código de 8 dígitos avisa que hay que declarar uno de 10', () => {
    expect(detalle('6109.10.00')!.avisos.join(' ')).toMatch(/10 dígitos/);
  });

  it('un código que no existe no tiene detalle', () => {
    expect(detalle('6109.10.00.99')).toBeNull();
  });
});
