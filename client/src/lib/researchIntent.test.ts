import { describe, expect, it } from 'vitest';
import { detectResearch, esClasificacion, extractTerm } from './researchIntent';

// Las preguntas de abajo son las de la conversación real que nos pasó el
// cliente, más las variantes que cualquiera escribe. Esta es la
// diferencia entre "pregunto y no responde" y que responda.

describe('preguntas que sí son una consulta de datos', () => {
  const casos: Array<[string, 'tiktok' | 'aduanas', string]> = [
    ['cuales son los 3 jeans mas vendidos', 'tiktok', 'jeans'],
    ['mejores productos ue se vendan en tik tok', 'tiktok', ''],
    ['que se vende mas en tiktok shop', 'tiktok', ''],
    ['tendencias de shapewear', 'tiktok', 'shapewear'],
    ['que empresas colombianas importan zapatos', 'aduanas', 'colombianas zapatos'],
    ['quien exporta cafe a estados unidos', 'aduanas', 'cafe estados unidos'],
    ['cuanto se importa de velas de soya', 'aduanas', 'velas soya'],
    ['best selling jeans', 'tiktok', 'jeans'],
    ['which companies import shoes', 'aduanas', 'shoes'],
    ['what sells best on tiktok', 'tiktok', ''],
  ];

  for (const [pregunta, source, term] of casos) {
    it(`"${pregunta}" -> ${source}${term ? ` · "${term}"` : ' · ranking general'}`, () => {
      const intent = detectResearch(pregunta);
      expect(intent, pregunta).not.toBeNull();
      expect(intent!.source).toBe(source);
      expect(intent!.term).toBe(term);
    });
  }
});

describe('preguntas que NO son una consulta de datos', () => {
  // Cada consulta se cobra. Buscar cuando nadie pidió un dato es
  // cobrarle a alguien por nada, y encima contestarle otra cosa.
  const noCasos = [
    'cuanto cuesta el flete a miami',
    'cuanto cuesta el servicio',
    'quiero vender en amazon',
    'como empiezo',
    'tienen prep center en usa',
    'hola',
    'gracias',
    'quien eres',
    'como pago',
  ];

  for (const pregunta of noCasos) {
    it(`"${pregunta}" no dispara una consulta`, () => {
      expect(detectResearch(pregunta), pregunta).toBeNull();
    });
  }
});

describe('el término de búsqueda', () => {
  it('se queda con el producto y tira la pregunta', () => {
    expect(extractTerm('cuales son los 3 jeans mas vendidos')).toBe('jeans');
    expect(extractTerm('¿qué marcas de cosmética natural están creciendo?')).toBe('cosmetica natural creciendo');
  });

  it('queda vacío cuando no hay producto, y eso está bien', () => {
    // "lo más vendido" sin decir de qué es el ranking de arriba: la
    // fuente acepta una consulta sin palabra clave.
    expect(extractTerm('que se vende mas en tiktok')).toBe('');
    expect(extractTerm('mejores productos')).toBe('');
  });

  it('no manda frases largas: las fuentes buscan por palabra clave', () => {
    const term = extractTerm('cuales son los mejores zapatos deportivos de cuero negro para correr maraton');
    expect(term.split(' ').length).toBeLessThanOrEqual(3);
  });

  it('aguanta acentos, signos y erratas sin romperse', () => {
    expect(detectResearch('¿Cuáles son los jeans más vendidos?')!.term).toBe('jeans');
    expect(detectResearch('mejores productos ue se vendan en tik tok')).not.toBeNull();
  });
});

describe('clasificar un producto no es una consulta de mercado', () => {
  // Cada consulta se cobra. "Analizá mi producto" lleva el verbo
  // ("analiza") y el contexto ("producto"), así que tenía la forma
  // exacta de una búsqueda y se iba derecho a la mesa de consultas.
  const propias = [
    'analiza mi producto',
    'analizar producto',
    'quiero clasificar mi producto',
    'como saco la partida arancelaria',
    'que codigo hts le corresponde',
    'leeme la etiqueta',
    'cual es la composicion',
    'escanear producto',
    'classify my product',
    'what hs code is this',
  ];
  for (const q of propias) {
    it(`"${q}" no dispara una consulta`, () => {
      expect(detectResearch(q)).toBeNull();
      expect(esClasificacion(q)).toBe(true);
    });
  }

  it('y las consultas de aduanas de verdad siguen funcionando', () => {
    expect(detectResearch('que empresas colombianas importan zapatos')?.source).toBe('aduanas');
    expect(detectResearch('quien exporta cafe a estados unidos')?.source).toBe('aduanas');
  });
});
