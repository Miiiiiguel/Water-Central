import { describe, expect, it } from 'vitest';
import {
  analizar, CAMPO_CAPITULO, CAMPO_DESCRIPCION, CAMPO_FAMILIA, CAMPO_SECCION, LISTA, OTRO,
} from './analisis';
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
    expect(a.preguntas[0].campo).toBe(CAMPO_DESCRIPCION);
  });

  it('si la etiqueta no da ninguna pista, se pide que lo cuente con sus palabras', () => {
    // Antes se ofrecían catorce familias, y un reloj no era ninguna.
    const a = analizar('PRODUCTO\nSKU 8891');
    expect(a.preguntas[0].opciones ?? []).toEqual([]);
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
    expect(analizar(texto).preguntas.map((p) => p.campo)).toEqual([CAMPO_DESCRIPCION]);

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

describe('ningún producto se queda sin lugar', () => {
  const GORRA = 'GORRA\n100% ALGODON\nHECHO EN COLOMBIA';

  it('con candidatas, se ofrecen ellas y una salida', () => {
    const p = analizar(GORRA).preguntas[0];
    expect(p.campo).toBe(CAMPO_FAMILIA);
    const valores = (p.opciones ?? []).map((o) => o.valor);
    expect(valores).toContain('cap65');
    expect(valores).toContain('textil');
    expect(valores[valores.length - 1]).toBe(OTRO);
    // Unas pocas, no el catálogo entero: esto se contesta en un chat.
    expect(valores.length).toBeLessThanOrEqual(6);
  });

  it('"otro producto" pide que lo cuente, sin botones', () => {
    const p = analizar(GORRA, { [CAMPO_FAMILIA]: OTRO }).preguntas[0];
    expect(p.campo).toBe(CAMPO_DESCRIPCION);
    expect(p.opciones ?? []).toEqual([]);
  });

  it('contada con sus palabras, una gorra es una gorra aunque sea de algodón', () => {
    const a = analizar(GORRA, { [CAMPO_FAMILIA]: OTRO, [CAMPO_DESCRIPCION]: 'gorra de algodón' });
    expect(a.familia?.id).toBe('cap65');
  });

  it('lo que cuenta la persona decide la familia', () => {
    const a = analizar(GORRA, { [CAMPO_FAMILIA]: OTRO, [CAMPO_DESCRIPCION]: 'un reloj de pulsera' });
    expect(a.familia?.id).toBe('cap91');
    expect(a.familia?.capitulos).toEqual(['91']);
    expect(a.terminos).toContain('watches');
  });

  it('si lo que cuenta tampoco se reconoce, se elige de las 21 secciones', () => {
    const p = analizar(GORRA, { [CAMPO_FAMILIA]: OTRO, [CAMPO_DESCRIPCION]: 'una cosa que no sé nombrar' }).preguntas[0];
    expect(p.campo).toBe(CAMPO_SECCION);
    expect(p.opciones).toHaveLength(21);
  });

  it('después de contarlo, la salida lleva a la lista y no a contarlo otra vez', () => {
    // "Cuero y algodón" puede ser marroquinería o ropa: sigue siendo una duda.
    const p = analizar(GORRA, { [CAMPO_FAMILIA]: OTRO, [CAMPO_DESCRIPCION]: 'algo de cuero y algodón' }).preguntas[0];
    expect(p.campo).toBe(CAMPO_FAMILIA);
    const valores = (p.opciones ?? []).map((o) => o.valor);
    expect(valores[valores.length - 1]).toBe(LISTA);
    expect(valores).not.toContain(OTRO);
  });

  it('"ninguno de estos" lleva a las secciones', () => {
    const p = analizar(GORRA, { [CAMPO_FAMILIA]: LISTA }).preguntas[0];
    expect(p.campo).toBe(CAMPO_SECCION);
  });

  it('elegida la sección, se ofrecen sus capítulos', () => {
    const p = analizar(GORRA, { [CAMPO_FAMILIA]: LISTA, [CAMPO_SECCION]: 'XVIII' }).preguntas[0];
    expect(p.campo).toBe(CAMPO_CAPITULO);
    expect((p.opciones ?? []).map((o) => o.valor)).toEqual(['90', '91', '92']);
  });

  it('elegido el capítulo, queda elegida la familia que lo clasifica', () => {
    const reloj = analizar(GORRA, { [CAMPO_FAMILIA]: LISTA, [CAMPO_SECCION]: 'XVIII', [CAMPO_CAPITULO]: '91' });
    expect(reloj.familia?.id).toBe('cap91');

    // Si el capítulo es de una familia hecha a mano, siguen sus preguntas.
    const ropa = analizar(GORRA, { [CAMPO_FAMILIA]: LISTA, [CAMPO_SECCION]: 'XI', [CAMPO_CAPITULO]: '61' });
    expect(ropa.familia?.id).toBe('textil');
    expect(ropa.preguntas.map((p) => p.campo)).toContain('tejido');
  });

  it('un capítulo que no existe no elige nada', () => {
    const a = analizar(GORRA, { [CAMPO_FAMILIA]: LISTA, [CAMPO_CAPITULO]: '77' });
    expect(a.familia).toBeNull();
    expect(a.preguntas[0].campo).toBe(CAMPO_SECCION);
  });

  it('una sección que no existe se vuelve a preguntar', () => {
    const a = analizar(GORRA, { [CAMPO_FAMILIA]: LISTA, [CAMPO_SECCION]: 'XXX' });
    expect(a.preguntas[0].campo).toBe(CAMPO_SECCION);
  });
});

describe('lo que se ve en la foto', () => {
  it('decide la familia cuando la etiqueta no dice qué es', () => {
    const a = analizar('ACERO INOXIDABLE\nHECHO EN JAPON\nPRODUCTO_VISTO: reloj de pulsera');
    expect(a.familia?.id).toBe('cap91');
  });

  it('no aparece como dato leído de la etiqueta', () => {
    const a = analizar('HECHO EN COLOMBIA\nPRODUCTO_VISTO: bolso de cuero');
    expect(a.familia?.id).toBe('marroquineria');
    expect(a.generico.materiales).not.toContain('cuero');
    expect(a.atributos.filter((at) => at.origen === 'etiqueta').map((at) => at.valor)).not.toContain('cuero');
  });

  it('alcanza para empezar aunque la foto no tenga texto', () => {
    const a = analizar('PRODUCTO_VISTO: taza de cerámica');
    expect(a.legible).toBe(true);
    expect(a.familia?.id).toBe('cocina_hogar');
  });

  it('"desconocido" no cuenta como lectura', () => {
    expect(analizar('PRODUCTO_VISTO: desconocido').legible).toBe(false);
  });

  it('vuelve con el texto, para que cada respuesta se analice igual', () => {
    const texto = 'HECHO EN COLOMBIA\nPRODUCTO_VISTO: bolso de cuero';
    expect(analizar(texto).texto).toBe(texto);
  });
});
