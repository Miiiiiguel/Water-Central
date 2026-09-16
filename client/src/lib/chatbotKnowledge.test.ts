import { describe, expect, it } from 'vitest';
import { knowledgeBase, matchKnowledge } from './chatbotKnowledge';

// Las preguntas de abajo no son inventadas: salieron de una conversación
// real con un cliente, copiada tal cual — con las erratas incluidas. Es la
// única prueba que vale para un buscador de palabras clave: lo que la
// gente escribe de verdad, no lo que nosotros creemos que va a escribir.

const idFor = (q: string) => matchKnowledge(q)?.id ?? null;

describe('la conversación que salió mal', () => {
  // El bug: la búsqueda era por subcadena, así que la clave "ok" de la
  // respuesta "de nada" coincidía dentro de "tik tok".
  it('no contesta "de nada" a quien pregunta por productos en tik tok', () => {
    expect(idFor('mejores productos ue se vendan en tik tok')).toBe('inteligencia');
  });

  it('entiende "cuales son los 3 jeans mas vendidos"', () => {
    expect(idFor('cuales son los 3 jeans mas vendidos')).toBe('inteligencia');
  });

  it('sigue reconociendo el nombre de la fuente si el cliente lo escribe', () => {
    expect(idFor('kalodata')).toBe('inteligencia');
  });

  it('nunca nombra a los proveedores de datos en la respuesta', () => {
    const intel = knowledgeBase.find((e) => e.id === 'inteligencia')!;
    for (const texto of [intel.answer.es, intel.answer.en]) {
      expect(texto.toLowerCase()).not.toContain('kalodata');
      expect(texto.toLowerCase()).not.toContain('sicex');
    }
  });
});

describe('palabras, no subcadenas', () => {
  it('"ok" solo coincide como palabra suelta', () => {
    expect(idFor('ok')).toBe('gracias');
    expect(idFor('gracias')).toBe('gracias');
    expect(idFor('tik tok')).not.toBe('gracias');
    expect(idFor('stock')).not.toBe('gracias');
  });

  it('aguanta el plural y el acento', () => {
    expect(idFor('cuales son los precios')).toBe('precio');
    expect(idFor('¿cuánto cuesta?')).toBe('precio');
    expect(idFor('que tendencias hay')).toBe('inteligencia');
  });

  it('no responde nada cuando no hay nada que responder', () => {
    expect(matchKnowledge('')).toBeNull();
    expect(matchKnowledge('   ?? ')).toBeNull();
    expect(matchKnowledge('zzz qwerty')).toBeNull();
  });
});

describe('cada pregunta a su respuesta', () => {
  const casos: Array<[string, string]> = [
    ['quien eres?', 'quien-eres'],
    ['que servicios ofrecen', 'servicios'],
    ['como empiezo', 'empezar'],
    ['cuanto gano con esto', 'roi'],
    ['como pago', 'pago'],
    ['venden en amazon?', 'amazon-tiktok'],
    ['tienen prep center en usa', 'prep-center'],
    ['cuanto cuesta el flete a miami', 'logistica'],
    ['quiero agendar una llamada', 'consultoria'],
    ['como funciona el programa de referidos', 'referidos'],
    ['no puedo entrar a mi cuenta', 'cuenta'],
    ['tienen whatsapp?', 'contacto'],
    ['what do you do', 'servicios'],
    ['how much does it cost', 'precio'],
    ['what is selling best on tiktok', 'inteligencia'],
  ];

  for (const [pregunta, id] of casos) {
    it(`"${pregunta}" -> ${id}`, () => expect(idFor(pregunta)).toBe(id));
  }
});

describe('la base en sí', () => {
  it('no tiene ids repetidos', () => {
    const ids = knowledgeBase.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada entrada responde en los dos idiomas y tiene palabras clave', () => {
    for (const entry of knowledgeBase) {
      expect(entry.keywords.length, entry.id).toBeGreaterThan(0);
      expect(entry.answer.es.length, entry.id).toBeGreaterThan(20);
      expect(entry.answer.en.length, entry.id).toBeGreaterThan(20);
    }
  });
});
