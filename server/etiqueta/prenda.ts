// Qué prenda es. Fase 3 del análisis de producto.
//
// Para el arancel de Estados Unidos, una prenda no se clasifica por
// cómo se llama sino por tres datos, y los tres cambian la partida:
//
//   1. Si es de punto o plana. Capítulo 61 contra 62. Una camisa de
//      hombre de algodón paga 19.7% si es plana (6205.20.20) y 19.7%
//      /distinto tramo si es de punto (6105.10.00): son partidas
//      distintas y el dato casi nunca está impreso en la etiqueta.
//   2. Para quién es: hombre, mujer, niño o bebé.
//   3. Qué prenda es: camiseta, pantalón, vestido…
//
// Este módulo saca lo que puede del texto y, sobre todo, dice qué
// falta. Lo que no está no se adivina: se pregunta.

export type Tejido = 'punto' | 'plano';
export type Genero = 'hombre' | 'mujer' | 'nina_nino' | 'bebe';

export interface TipoPrenda {
  /** Identificador interno; el término de búsqueda va aparte. */
  tipo: string;
  /** Cómo se le dice en español, para la pantalla. */
  etiqueta: string;
  /** Las palabras con las que se busca en el arancel, que está en inglés. */
  terminos: string[];
  /** Cuando la prenda casi siempre se hace de un tejido, se asume y se dice. */
  tejidoHabitual?: Tejido;
}

export interface Prenda {
  prenda: TipoPrenda | null;
  genero: Genero | null;
  tejido: Tejido | null;
  /** Cómo se supo cada cosa: de la etiqueta, del tejido habitual, o preguntando. */
  origenDelTejido: 'etiqueta' | 'habitual' | 'desconocido';
  /** 61 si es de punto, 62 si es plana. Vacío mientras no se sepa. */
  capitulo: string | null;
  faltante: FaltaPrenda[];
}

export type FaltaPrenda = 'tipo' | 'genero' | 'tejido';

const PRENDAS: TipoPrenda[] = [
  { tipo: 'camiseta', etiqueta: 'Camiseta / T-shirt', terminos: ['t-shirts', 'singlets', 'tank tops'], tejidoHabitual: 'punto' },
  { tipo: 'camisa', etiqueta: 'Camisa', terminos: ['shirts'] },
  { tipo: 'blusa', etiqueta: 'Blusa', terminos: ['blouses', 'shirts'] },
  { tipo: 'polo', etiqueta: 'Polo', terminos: ['shirts'], tejidoHabitual: 'punto' },
  { tipo: 'pantalon', etiqueta: 'Pantalón', terminos: ['trousers', 'breeches'] },
  { tipo: 'jean', etiqueta: 'Jean', terminos: ['trousers', 'denim'], tejidoHabitual: 'plano' },
  { tipo: 'short', etiqueta: 'Short / Bermuda', terminos: ['shorts'] },
  { tipo: 'falda', etiqueta: 'Falda', terminos: ['skirts'] },
  { tipo: 'vestido', etiqueta: 'Vestido', terminos: ['dresses'] },
  { tipo: 'chaqueta', etiqueta: 'Chaqueta / Casaca', terminos: ['anoraks', 'windbreakers', 'jackets'] },
  { tipo: 'abrigo', etiqueta: 'Abrigo', terminos: ['overcoats', 'carcoats'] },
  { tipo: 'sueter', etiqueta: 'Suéter / Buzo', terminos: ['sweaters', 'pullovers', 'sweatshirts'], tejidoHabitual: 'punto' },
  { tipo: 'sudadera', etiqueta: 'Sudadera / Hoodie', terminos: ['sweatshirts', 'pullovers'], tejidoHabitual: 'punto' },
  { tipo: 'ropa_interior', etiqueta: 'Ropa interior', terminos: ['briefs', 'underpants'], tejidoHabitual: 'punto' },
  { tipo: 'sosten', etiqueta: 'Sostén', terminos: ['brassieres'] },
  { tipo: 'pijama', etiqueta: 'Pijama', terminos: ['pajamas', 'nightwear'] },
  { tipo: 'medias', etiqueta: 'Medias / Calcetines', terminos: ['socks', 'hosiery'], tejidoHabitual: 'punto' },
  { tipo: 'leggings', etiqueta: 'Leggings', terminos: ['tights', 'trousers'], tejidoHabitual: 'punto' },
  { tipo: 'traje_bano', etiqueta: 'Vestido de baño', terminos: ['swimwear'] },
  { tipo: 'gorra', etiqueta: 'Gorra / Sombrero', terminos: ['headgear', 'caps'] },
  { tipo: 'bufanda', etiqueta: 'Bufanda / Pañuelo', terminos: ['scarves', 'shawls'] },
];

/** Cómo se nombra cada prenda en la etiqueta, en los idiomas que aparecen. */
const NOMBRES: Record<string, string[]> = {
  camiseta: ['camiseta', 'camisetas', 't-shirt', 'tshirt', 'tee', 'remera', 'playera', 'franela', 'esqueleto', 'tank top'],
  camisa: ['camisa', 'camisas', 'shirt', 'dress shirt', 'camisa manga larga'],
  blusa: ['blusa', 'blouse'],
  polo: ['polo', 'piqué', 'pique'],
  pantalon: ['pantalon', 'pantalones', 'trouser', 'trousers', 'pants', 'calca'],
  jean: ['jean', 'jeans', 'denim', 'vaquero', 'mezclilla'],
  short: ['short', 'shorts', 'bermuda', 'bermudas', 'pantaloneta'],
  falda: ['falda', 'skirt', 'saia'],
  vestido: ['vestido', 'dress', 'enterizo'],
  chaqueta: ['chaqueta', 'jacket', 'casaca', 'campera', 'cazadora', 'windbreaker', 'anorak', 'parka', 'chamarra'],
  abrigo: ['abrigo', 'overcoat', 'coat', 'gabardina', 'sobretodo'],
  sueter: ['sueter', 'sweater', 'pullover', 'jersey', 'buzo', 'chompa', 'cardigan'],
  sudadera: ['sudadera', 'hoodie', 'sweatshirt', 'capucha', 'canguro'],
  ropa_interior: ['boxer', 'boxers', 'calzoncillo', 'panty', 'panties', 'brief', 'briefs', 'interior', 'underwear', 'cachetero'],
  sosten: ['sosten', 'brasier', 'brassiere', 'bra', 'corpino', 'top deportivo'],
  pijama: ['pijama', 'pyjama', 'pajama', 'nightgown', 'bata'],
  medias: ['medias', 'calcetines', 'socks', 'meia', 'tobilleras'],
  leggings: ['leggings', 'legging', 'licra', 'lycra deportiva', 'calza'],
  traje_bano: ['vestido de bano', 'traje de bano', 'swimsuit', 'swimwear', 'bikini', 'pantaloneta de bano'],
  gorra: ['gorra', 'cap', 'sombrero', 'hat', 'visera'],
  bufanda: ['bufanda', 'scarf', 'panuelo', 'chalina', 'pashmina'],
};

const GENERO: { genero: Genero; palabras: string[] }[] = [
  { genero: 'bebe', palabras: ['bebe', 'baby', 'babies', 'recien nacido', 'newborn', 'infant', 'meses'] },
  { genero: 'nina_nino', palabras: ['nino', 'nina', 'ninos', 'kids', 'boys', 'girls', 'junior', 'infantil', 'children'] },
  { genero: 'hombre', palabras: ['hombre', 'caballero', 'men', 'mens', "men's", 'masculino', 'homem', 'masculina'] },
  { genero: 'mujer', palabras: ['mujer', 'dama', 'women', 'womens', "women's", 'femenino', 'ladies', 'femenina', 'mulher'] },
];

const TEJIDO: { tejido: Tejido; palabras: string[] }[] = [
  { tejido: 'punto', palabras: ['punto', 'tejido de punto', 'knit', 'knitted', 'jersey', 'crocheted', 'malha', 'rib'] },
  { tejido: 'plano', palabras: ['plano', 'tejido plano', 'woven', 'tecido plano', 'poplin', 'popelina', 'denim', 'gabardina', 'twill'] },
];

function normalizar(texto: string): string {
  return ' ' + texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
}

function contiene(heno: string, aguja: string): boolean {
  return heno.includes(' ' + aguja + ' ') || heno.includes(' ' + aguja + 's ');
}

/**
 * Lee el tipo de prenda del texto. Devuelve también lo que NO se pudo
 * determinar, porque eso es lo que hay que preguntar antes de poder
 * clasificar: sin tejido no hay capítulo, y sin capítulo no hay partida.
 */
export function leerPrenda(texto: string, pistas: Partial<Pick<Prenda, 'genero' | 'tejido'>> = {}): Prenda {
  const heno = normalizar(texto || '');

  let prenda: TipoPrenda | null = null;
  let mejorLargo = 0;
  for (const tipo of PRENDAS) {
    for (const nombre of NOMBRES[tipo.tipo] ?? []) {
      // Gana el nombre más largo que coincida: "vestido de bano" antes
      // que "vestido", que si no clasificaría un bikini como vestido.
      if (contiene(heno, nombre) && nombre.length > mejorLargo) {
        prenda = tipo;
        mejorLargo = nombre.length;
      }
    }
  }

  let genero: Genero | null = pistas.genero ?? null;
  if (!genero) {
    for (const g of GENERO) {
      if (g.palabras.some((p) => contiene(heno, p))) { genero = g.genero; break; }
    }
  }

  let tejido: Tejido | null = pistas.tejido ?? null;
  let origenDelTejido: Prenda['origenDelTejido'] = pistas.tejido ? 'etiqueta' : 'desconocido';
  if (!tejido) {
    for (const t of TEJIDO) {
      if (t.palabras.some((p) => contiene(heno, p))) { tejido = t.tejido; origenDelTejido = 'etiqueta'; break; }
    }
  }
  if (!tejido && prenda?.tejidoHabitual) {
    // Una camiseta es de punto salvo rarezas. Se asume, pero queda
    // marcado como supuesto para que la pantalla lo deje confirmar.
    tejido = prenda.tejidoHabitual;
    origenDelTejido = 'habitual';
  }

  const faltante: FaltaPrenda[] = [];
  if (!prenda) faltante.push('tipo');
  if (!genero) faltante.push('genero');
  if (!tejido) faltante.push('tejido');

  return {
    prenda,
    genero,
    tejido,
    origenDelTejido,
    capitulo: tejido ? (tejido === 'punto' ? '61' : '62') : null,
    faltante,
  };
}

export const PREGUNTA_PRENDA: Record<FaltaPrenda, string> = {
  tipo: '¿Qué prenda es? (camiseta, pantalón, vestido, chaqueta…)',
  genero: '¿Para quién es? Hombre, mujer, niño o bebé. En el arancel de EE. UU. cada uno tiene su propia partida.',
  tejido: '¿La tela es de punto (elástica, tipo camiseta) o plana (rígida, tipo camisa de vestir)? De eso depende el capítulo del arancel.',
};

/**
 * Las palabras con las que se busca en el arancel. Se arma en inglés
 * porque el HTS está en inglés, y sin inventar nada: si falta el
 * género, no se pone uno.
 */
export function terminosDeBusqueda(prenda: Prenda, fibraPrincipal: string | null): string {
  const partes: string[] = [];
  if (prenda.prenda) partes.push(...prenda.prenda.terminos);
  if (fibraPrincipal) partes.push(FIBRA_EN_INGLES[fibraPrincipal] ?? fibraPrincipal);
  if (prenda.genero === 'hombre') partes.push("men's boys'");
  if (prenda.genero === 'mujer') partes.push("women's girls'");
  if (prenda.genero === 'bebe') partes.push('babies');
  if (prenda.tejido === 'punto') partes.push('knitted crocheted');
  return partes.join(' ');
}

/** Cómo nombra el arancel a cada fibra. */
export const FIBRA_EN_INGLES: Record<string, string> = {
  algodon: 'cotton',
  poliester: 'polyester man-made fibers',
  elastano: 'elastomeric',
  nylon: 'man-made fibers nylon',
  lana: 'wool',
  viscosa: 'artificial fibers rayon',
  lino: 'flax linen',
  seda: 'silk',
  acrilico: 'man-made fibers acrylic',
  modal: 'artificial fibers',
  lyocell: 'artificial fibers',
  bambu: 'artificial fibers',
  canamo: 'hemp',
  yute: 'jute',
  cuero: 'leather',
  cachemira: 'cashmere',
  alpaca: 'alpaca',
  angora: 'angora',
};
