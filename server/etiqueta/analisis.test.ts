import { describe, expect, it } from 'vitest';
import { analizar, CAMPO_FAMILIA } from './analisis';
import { revisarImagen, MAXIMO_BYTES } from './ocr';

// El análisis completo: de un texto de etiqueta a datos y preguntas.
//
// La regla de fondo, y la que más cuida esta prueba: mientras no se
// sepa qué producto es, no se pregunta nada de ninguna familia. Una
// pregunta de textil sobre una lata de atún no es una molestia; es
// haber supuesto de qué se estaba hablando.

const LATA = 'ATUN EN ACEITE\nCONTENIDO NETO 170 g\nINGREDIENTES: Atun, sal.\nINFORMACION NUTRICIONAL\nHECHO EN COLOMBIA';
const CAMISETA = 'CAMISETA HOMBRE\n95% ALGODON 5% ELASTANO\nTALLA M\nLAVAR A MAQUINA\nHECHO EN PERU';

describe('cuando no se sabe qué producto es', () => {
  it('lo único que se pregunta es qué producto es', () => {
    const a = analizar('PRODUCTO\nSKU 8891');
    expect(a.familia).toBeNull();
    expect(a.preguntas).toHaveLength(1);
    expect(a.preguntas[0].campo).toBe(CAMPO_FAMILIA);
  });

  it('se ofrecen todas las familias para elegir', () => {
    const a = analizar('PRODUCTO\nSKU 8891');
    expect((a.preguntas[0].opciones ?? []).length).toBeGreaterThanOrEqual(12);
  });

  it('no se arma ningún término de búsqueda ni se leen atributos', () => {
    const a = analizar('PRODUCTO\nSKU 8891');
    expect(a.terminos).toBe('');
    expect(a.atributos).toEqual([]);
  });

  it('sin texto no se pregunta nada: primero hay que leer la foto', () => {
    const a = analizar('');
    expect(a.legible).toBe(false);
    expect(a.preguntas).toEqual([]);
  });
});

describe('cuando la familia sí se reconoce', () => {
  it('una lata de atún clasifica como alimento y no pregunta por tejidos', () => {
    const a = analizar(LATA);
    expect(a.familia?.id).toBe('alimento');
    expect(a.textil).toBeNull();
    expect(a.preguntas.map((p) => p.campo)).not.toContain('tejido');
  });

  it('a una camiseta se le conserva la lectura fina de la etiqueta', () => {
    const a = analizar(CAMISETA);
    expect(a.familia?.id).toBe('textil');
    expect(a.textil?.etiqueta.fibraPrincipal?.fibra).toBe('algodon');
    expect(a.textil?.prenda.capitulo).toBe('61');
  });

  it('lo decisivo se pregunta antes que lo que sólo afina', () => {
    const a = analizar(LATA);
    const decisivas = a.preguntas.filter((p) => p.decisiva);
    const resto = a.preguntas.filter((p) => !p.decisiva);
    if (decisivas.length && resto.length) {
      expect(a.preguntas.indexOf(decisivas[decisivas.length - 1]))
        .toBeLessThan(a.preguntas.indexOf(resto[0]));
    }
  });

  it('el origen se pregunta sólo cuando no está en la etiqueta', () => {
    expect(analizar(LATA).preguntas.map((p) => p.campo)).not.toContain('origen');
    const sinOrigen = analizar('ATUN EN ACEITE\nINGREDIENTES: Atun, sal.\nINFORMACION NUTRICIONAL');
    expect(sinOrigen.preguntas.map((p) => p.campo)).toContain('origen');
  });

  it('el contenido neto se pregunta en un alimento, no en una prenda', () => {
    const sinPeso = analizar('ATUN EN ACEITE\nINGREDIENTES: Atun, sal.\nINFORMACION NUTRICIONAL\nHECHO EN COLOMBIA');
    expect(sinPeso.preguntas.map((p) => p.campo)).toContain('contenido_neto');
    expect(analizar(CAMISETA).preguntas.map((p) => p.campo)).not.toContain('contenido_neto');
  });
});

describe('lo que contesta la persona', () => {
  it('elegir la familia desbloquea las preguntas de esa familia', () => {
    const texto = 'PRODUCTO\nSKU 8891';
    expect(analizar(texto).preguntas.map((p) => p.campo)).toEqual([CAMPO_FAMILIA]);

    const despues = analizar(texto, { [CAMPO_FAMILIA]: 'papeleria' });
    expect(despues.familia?.id).toBe('papeleria');
    expect(despues.preguntas.map((p) => p.campo)).toContain('articulo');
    expect(despues.preguntas.map((p) => p.campo)).not.toContain(CAMPO_FAMILIA);
  });

  it('una familia inventada no se acepta: se sigue preguntando', () => {
    const a = analizar(LATA, { [CAMPO_FAMILIA]: 'naves_espaciales' });
    expect(a.familia).toBeNull();
    expect(a.preguntas[0].campo).toBe(CAMPO_FAMILIA);
  });

  it('contestar un dato lo saca de la lista de preguntas', () => {
    const familia = { [CAMPO_FAMILIA]: 'calzado' };
    const antes = analizar('ZAPATO', familia);
    expect(antes.preguntas.map((p) => p.campo)).toContain('material_suela');
    const despues = analizar('ZAPATO', { ...familia, material_suela: 'cuero' });
    expect(despues.preguntas.map((p) => p.campo)).not.toContain('material_suela');
    expect(despues.terminos).toContain('outer soles of leather');
  });

  it('el origen contestado a mano vale como dato de la etiqueta', () => {
    const a = analizar('ATUN EN ACEITE\nINGREDIENTES: Atun, sal.\nINFORMACION NUTRICIONAL', { origen: 'Ecuador' });
    expect(a.generico.origen).toBe('Ecuador');
    expect(a.preguntas.map((p) => p.campo)).not.toContain('origen');
  });
});

describe('la imagen, antes de gastar una llamada', () => {
  const valida = 'A'.repeat(4000);

  it('acepta una foto normal', () => {
    expect(revisarImagen(valida, 'image/jpeg')).toBeNull();
  });

  it('rechaza lo que no es una imagen', () => {
    expect(revisarImagen(valida, 'application/pdf')).toBe('formato');
  });

  it('rechaza una imagen que pesa demasiado', () => {
    const enorme = 'A'.repeat(Math.ceil((MAXIMO_BYTES * 4) / 3) + 100);
    expect(revisarImagen(enorme, 'image/jpeg')).toBe('tamano');
  });

  it('rechaza lo que llega vacío o en miniatura', () => {
    expect(revisarImagen('', 'image/jpeg')).toBe('vacia');
    expect(revisarImagen('AAAA', 'image/jpeg')).toBe('vacia');
  });
});
