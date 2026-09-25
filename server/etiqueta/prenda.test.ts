import { describe, expect, it } from 'vitest';
import { leerPrenda, terminosDeBusqueda } from './prenda';

// Lo que este módulo tiene que hacer bien no es adivinar: es saber qué
// NO sabe. Una prenda mal clasificada en punto o plano cambia de
// capítulo entero, y el cliente paga otro arancel.

describe('qué prenda es', () => {
  it('reconoce la prenda por su nombre en la etiqueta', () => {
    expect(leerPrenda('CAMISETA MANGA CORTA').prenda?.tipo).toBe('camiseta');
    expect(leerPrenda("MEN'S DENIM JEANS").prenda?.tipo).toBe('jean');
    expect(leerPrenda('BLUSA DAMA').prenda?.tipo).toBe('blusa');
  });

  it('gana el nombre más específico', () => {
    // "vestido de baño" no es un vestido: es otra partida.
    expect(leerPrenda('VESTIDO DE BAÑO').prenda?.tipo).toBe('traje_bano');
    expect(leerPrenda('VESTIDO LARGO').prenda?.tipo).toBe('vestido');
  });

  it('cuando no reconoce la prenda lo dice, en vez de elegir una', () => {
    const p = leerPrenda('REF 4412 LOTE 7');
    expect(p.prenda).toBeNull();
    expect(p.faltante).toContain('tipo');
  });
});

describe('para quién es', () => {
  it('lee el género de la etiqueta en los dos idiomas', () => {
    expect(leerPrenda('CAMISETA HOMBRE').genero).toBe('hombre');
    expect(leerPrenda("WOMEN'S T-SHIRT").genero).toBe('mujer');
    expect(leerPrenda('CAMISETA NIÑO').genero).toBe('nina_nino');
    expect(leerPrenda('BODY BEBÉ').genero).toBe('bebe');
  });

  it('sin género en la etiqueta, queda por preguntar', () => {
    expect(leerPrenda('CAMISETA').faltante).toContain('genero');
  });
});

describe('punto o plano: el dato que cambia el capítulo', () => {
  it('lo toma de la etiqueta cuando está', () => {
    const p = leerPrenda('CAMISA WOVEN 100% COTTON');
    expect(p.tejido).toBe('plano');
    expect(p.capitulo).toBe('62');
    expect(p.origenDelTejido).toBe('etiqueta');
  });

  it('lo supone cuando la prenda casi siempre es de ese tejido, y lo marca como supuesto', () => {
    const p = leerPrenda('CAMISETA ALGODÓN');
    expect(p.tejido).toBe('punto');
    expect(p.capitulo).toBe('61');
    expect(p.origenDelTejido).toBe('habitual');
  });

  it('en una camisa no lo supone: puede ser de punto o plana, y son partidas distintas', () => {
    const p = leerPrenda('CAMISA MANGA LARGA');
    expect(p.tejido).toBeNull();
    expect(p.capitulo).toBeNull();
    expect(p.faltante).toContain('tejido');
  });

  it('acepta que la persona conteste lo que faltaba', () => {
    const p = leerPrenda('CAMISA MANGA LARGA', { tejido: 'plano', genero: 'hombre' });
    expect(p.capitulo).toBe('62');
    expect(p.faltante).toEqual([]);
  });
});

describe('los términos con que se busca en el arancel', () => {
  it('van en inglés, que es el idioma del HTS', () => {
    const p = leerPrenda("CAMISETA HOMBRE");
    const t = terminosDeBusqueda(p, 'algodon');
    expect(t).toContain('t-shirts');
    expect(t).toContain('cotton');
    expect(t).toContain("men's");
    expect(t).toContain('knitted');
  });

  it('no rellena lo que no se sabe', () => {
    const t = terminosDeBusqueda(leerPrenda('CAMISA'), null);
    expect(t).not.toMatch(/men's|women's/);
    expect(t).not.toMatch(/cotton/);
  });
});
