import type { ResearchSource } from '@/lib/research';

// ¿Esta pregunta se contesta con datos, o con palabras?
//
// Hasta ahora, escribir "cuáles son los jeans más vendidos" en el chat
// no consultaba nada: para llegar a los datos había que tocar antes el
// botón "Tendencias en TikTok Shop". Quien escribe su pregunta —que es
// lo que hace todo el mundo— recibía un párrafo explicando que podemos
// buscarlo, en vez del dato. "Pregunto y no responde".
//
// Esto reconoce la pregunta y decide dos cosas: en qué fuente buscar, y
// con qué término. Cuando no está seguro devuelve null y la pregunta
// sigue su camino normal — preferimos no buscar a gastar una consulta
// (que se cobra) en algo que no era una búsqueda.

export interface ResearchIntent {
  source: ResearchSource;
  /**
   * El término que se manda a la fuente. Puede ir VACÍO a propósito:
   * "qué se vende más en TikTok Shop" no tiene término, es el ranking
   * de arriba. La fuente acepta una consulta sin palabra clave.
   */
  term: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Señales de que la pregunta pide un DATO, no una explicación. */
const PIDE_DATOS = [
  /\bmas vendid/, /\bmejor(es)? (producto|articulo|venta|vendido)/, /\bque se vende/, /\bque se venden/,
  /\bse vende mas/, /\btop\b/, /\branking\b/, /\btendencia/, /\bque vender\b/, /\bproductos? ganador/,
  /\bquien (importa|exporta|compra|vende)/, /\bque empresas/, /\bcuanto se (importa|exporta)/,
  /\bcompetencia\b/, /\bcompetidor/, /\bdemanda\b/, /\bnicho/, /\boportunidad/,
  /\bbest selling\b/, /\btop selling\b/, /\bwhat sells\b/, /\bselling best\b/, /\bwho (imports|exports|buys)\b/,
  /\bwhich companies\b/, /\btrending\b/, /\btrends\b/, /\bwinning products\b/, /\bdemand\b/,
];

/** Señales de a qué fuente va. */
const SENAL_ADUANAS = [
  /\bimporta/, /\bexporta/, /\baduana/, /\barancel/, /\bpartida\b/, /\bproveedor/,
  /\bque empresas/, /\bquien compra/, /\bquien vende/, /\bcomercio exterior/,
  /\bimports?\b/, /\bexports?\b/, /\bcustoms\b/, /\bsuppliers?\b/, /\bwhich companies\b/,
];
const SENAL_TIKTOK = [
  /\btik ?tok\b/, /\bshop\b/, /\bamazon\b/, /\bmarketplace/, /\bcreador/, /\bcreator/,
  /\bgmv\b/, /\bvendid/, /\bse vende/, /\btendencia/, /\btrending\b/, /\bsells?\b/, /\bselling\b/,
];

const hit = (patterns: RegExp[], q: string) => patterns.some((p) => p.test(q));

// Palabras que no son el producto: preguntas, verbos, conectores y los
// sustantivos genéricos que nunca sirven como término de búsqueda
// ("productos más vendidos" → el término útil es ninguno, no "productos").
const VACIAS = new Set([
  'que', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'quien', 'quienes', 'donde', 'como', 'cuando',
  'son', 'es', 'esta', 'estan', 'hay', 'me', 'te', 'se', 'le', 'lo', 'la', 'las', 'los', 'el', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'y', 'o', 'u', 'mi', 'tu', 'su', 'sus', 'mas', 'menos', 'muy',
  'mejor', 'mejores', 'peor', 'peores', 'top', 'ranking', 'tendencia', 'tendencias', 'vendido', 'vendidos', 'vendida', 'vendidas',
  'vende', 'venden', 'vendan', 'vender', 'venta', 'ventas', 'compra', 'compran', 'comprar', 'importa', 'importan', 'importar',
  'exporta', 'exportan', 'exportar', 'aduana', 'aduanas', 'empresa', 'empresas', 'marca', 'marcas', 'pais', 'paises',
  'producto', 'productos', 'articulo', 'articulos', 'cosa', 'cosas', 'categoria', 'categorias', 'nicho', 'nichos',
  'tiktok', 'tik', 'tok', 'shop', 'amazon', 'shopify', 'marketplace', 'demanda', 'competencia', 'oportunidad', 'oportunidades',
  'ganador', 'ganadores', 'actualmente', 'ahora', 'hoy', 'ue', 'que se', 'dime', 'busca', 'buscame', 'quiero', 'saber',
  'what', 'which', 'who', 'where', 'how', 'best', 'selling', 'sells', 'sell', 'top', 'trending', 'trends', 'products',
  'product', 'companies', 'company', 'imports', 'import', 'exports', 'export', 'customs', 'the', 'a', 'an', 'in', 'on',
  'of', 'for', 'and', 'or', 'is', 'are', 'most', 'sold', 'suppliers', 'supplier', 'demand',
]);

/**
 * El término de búsqueda: lo que queda de la pregunta al quitarle todo
 * lo que es pregunta. Máximo tres palabras — las fuentes buscan por
 * palabra clave, no por frase, y una frase larga no devuelve nada.
 */
export function extractTerm(text: string): string {
  const palabras = normalize(text)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !VACIAS.has(w) && !/^\d+$/.test(w));
  return palabras.slice(0, 3).join(' ');
}

export function detectResearch(text: string): ResearchIntent | null {
  const q = normalize(text);
  if (q.length < 5) return null;

  // Sin señal de "quiero un dato" no se busca. "¿Cuánto cuesta el flete
  // a Miami?" nombra un país y un precio y no es una consulta de
  // mercado; gastar un crédito ahí sería cobrarle a alguien por nada.
  if (!hit(PIDE_DATOS, q)) return null;

  const aduanas = hit(SENAL_ADUANAS, q);
  const tiktok = hit(SENAL_TIKTOK, q);

  // Las dos señales a la vez ("qué empresas importan lo más vendido en
  // TikTok") o ninguna: manda la de aduanas sólo si es la única, porque
  // es la más específica. Sin ninguna, el ranking de marketplace es la
  // respuesta útil por defecto para "qué se vende más".
  const source: ResearchSource = aduanas && !tiktok ? 'aduanas' : 'tiktok';

  return { source, term: extractTerm(text) };
}
