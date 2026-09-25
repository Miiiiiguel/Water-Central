import { describe, expect, it } from 'vitest';
import { chooseVoice, rankVoices, scoreVoice, type VoiceLike } from './voice';

// Las voces instaladas cambian de un equipo a otro, así que Marco Polo
// no puede pedir una por nombre: ordena lo que haya. Elegir mal significa
// que le hable con acento de España a un cliente colombiano, y eso no se
// nota hasta que alguien lo escucha en vivo.

const v = (name: string, lang: string): VoiceLike => ({ name, lang, voiceURI: `${name}|${lang}` });

const PAULINA = v('Paulina', 'es-MX');
const SABINA = v('Microsoft Sabina Desktop', 'es-MX');
const MONICA = v('Mónica', 'es-ES');
const SALOME = v('Microsoft Salome Online (Natural)', 'es-CO');
const GOOGLE_ES = v('Google español', 'es-ES');
const SAMANTHA = v('Samantha', 'en-US');

describe('rankVoices', () => {
  it('deja fuera las voces de otro idioma', () => {
    expect(rankVoices([PAULINA, SAMANTHA], 'es')).toEqual([PAULINA]);
    expect(rankVoices([PAULINA, SAMANTHA], 'en')).toEqual([SAMANTHA]);
  });

  it('pone el español de América antes que el de España', () => {
    const [first] = rankVoices([MONICA, PAULINA], 'es');
    expect(first).toBe(PAULINA);
  });

  it('prefiere una voz neural sobre una vieja del sistema', () => {
    const [first] = rankVoices([SABINA, SALOME], 'es');
    expect(first).toBe(SALOME);
  });

  it('no se queda sin voz cuando solo hay una de España', () => {
    expect(rankVoices([MONICA, GOOGLE_ES], 'es')[0]).toBe(GOOGLE_ES);
  });

  it('devuelve vacío en vez de romperse cuando el equipo no tiene voces', () => {
    expect(rankVoices([], 'es')).toEqual([]);
  });

  it('mantiene el orden original entre voces empatadas', () => {
    const a = v('A', 'es-MX');
    const b = v('B', 'es-MX');
    expect(rankVoices([a, b], 'es')).toEqual([a, b]);
    expect(rankVoices([b, a], 'es')).toEqual([b, a]);
  });
});

describe('scoreVoice', () => {
  it('castiga las voces de escritorio, que suenan a robot', () => {
    expect(scoreVoice(SABINA, 'es')).toBeLessThan(scoreVoice(PAULINA, 'es'));
  });

  it('puntúa un locale desconocido sin descartarlo', () => {
    expect(scoreVoice(v('X', 'es-GT'), 'es')).toBeGreaterThan(0);
  });
});

describe('chooseVoice', () => {
  it('respeta la voz que eligió la persona, aunque no sea la mejor puntuada', () => {
    expect(chooseVoice([PAULINA, MONICA], 'es', MONICA.voiceURI)).toBe(MONICA);
  });

  it('vuelve a la automática si la voz guardada ya no está instalada', () => {
    // Pasa de verdad: cambiar de navegador o de equipo, o desinstalar
    // un paquete de idioma. Quedarse mudo sería peor.
    expect(chooseVoice([PAULINA], 'es', 'una-que-ya-no-existe')).toBe(PAULINA);
  });

  it('devuelve null cuando no hay ninguna voz utilizable', () => {
    expect(chooseVoice([SAMANTHA], 'es', null)).toBeNull();
  });
});
