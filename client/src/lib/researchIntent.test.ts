import { describe, expect, it } from 'vitest';
import { aConsulta, detectKind, detectMarket, detectResearch, esClasificacion, extractTerm } from './researchIntent';

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

describe('la pregunta real de los creadores de shampoo', () => {
  // Tal cual la escribió el cliente, con la errata. Antes: "más venden"
  // no contaba como pedir un dato, el botón mandaba la frase entera de
  // palabra clave, y "creadores" terminaba en el ranking de productos.
  const pregunta = 'Quienes son los creadores de contenido que mas venden shampoo de natural sant USA';

  it('es una consulta, de creadores, en el mercado US, por "shampoo"', () => {
    const intent = detectResearch(pregunta)!;
    expect(intent).not.toBeNull();
    expect(intent.source).toBe('tiktok');
    expect(intent.kind).toBe('creator');
    expect(intent.country).toBe('US');
    expect(intent.term).toBe('shampoo natural sant');
  });

  it('escrita después del botón, tampoco viaja la frase entera', () => {
    const c = aConsulta('tiktok', pregunta);
    expect(c.term).toBe('shampoo natural sant');
    expect(c.kind).toBe('creator');
    expect(c.country).toBe('US');
  });

  it('una palabra clave corta se respeta tal cual', () => {
    expect(aConsulta('tiktok', 'velas de soya')).toEqual({ term: 'velas de soya', kind: 'product', country: undefined });
  });
});

describe('de qué se pregunta y en qué mercado', () => {
  it('reconoce creadores, tiendas, videos y transmisiones', () => {
    expect(detectKind('top influencers de maquillaje')).toBe('creator');
    expect(detectKind('las tiendas que mas venden jeans')).toBe('shop');
    expect(detectKind('videos mas vistos de velas')).toBe('video');
    expect(detectKind('quien vende mas en vivo')).toBe('livestream');
  });

  it('"TikTok Shop" es la plataforma, no una pregunta por tiendas', () => {
    expect(detectKind('que se vende mas en tiktok shop')).toBe('product');
  });

  it('el país sale del término y pasa a ser el mercado', () => {
    expect(detectMarket('jeans mas vendidos en México')).toBe('MX');
    expect(detectMarket('best selling jeans in the United States')).toBe('US');
    expect(detectMarket('jeans mas vendidos en Colombia')).toBeUndefined();
    expect(detectResearch('jeans mas vendidos en España')!.term).toBe('jeans');
  });

  it('en aduanas el país sigue siendo parte de la pregunta', () => {
    expect(detectResearch('quien exporta cafe a estados unidos')!.term).toBe('cafe estados unidos');
  });
});
