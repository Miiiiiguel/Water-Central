import { describe, expect, it } from 'vitest';
import { preguntasDe } from './route';
import { revisarImagen, MAXIMO_BYTES } from './ocr';

// Lo que se le pregunta a la persona y en qué orden. Importa: el tejido
// va primero porque sin él no hay capítulo, y sin capítulo no se puede
// ni empezar a buscar la partida.

describe('qué se pregunta cuando falta un dato', () => {
  it('el tejido va primero, antes que el resto', () => {
    const p = preguntasDe(['origen', 'talla'], ['genero', 'tejido']);
    expect(p[0].campo).toBe('tejido');
  });

  it('el tejido y el género se contestan con botones, no escribiendo', () => {
    const p = preguntasDe([], ['tejido', 'genero']);
    expect(p.find((q) => q.campo === 'tejido')?.opciones?.map((o) => o.valor)).toEqual(['punto', 'plano']);
    expect(p.find((q) => q.campo === 'genero')?.opciones).toHaveLength(4);
  });

  it('cada pregunta explica por qué hace falta', () => {
    const tejido = preguntasDe([], ['tejido'])[0];
    expect(tejido.pregunta).toMatch(/capítulo del arancel/i);
  });

  it('sin nada que falte, no se pregunta nada', () => {
    expect(preguntasDe([], [])).toEqual([]);
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
