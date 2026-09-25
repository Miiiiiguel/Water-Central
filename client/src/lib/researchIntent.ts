import type { ResearchKind, ResearchSource } from '@/lib/research';

// ¿Esta pregunta se contesta con datos, o con palabras?
//
// Escribir "cuáles son los jeans más vendidos" en el chat no consultaba
// nada: para llegar a los datos había que tocar antes el botón de la
// fuente. Quien escribe su pregunta —que es lo que hace todo el mundo—
// recibía un párrafo explicando que podemos buscarlo, en vez del dato.
//
// La primera versión de esto reconocía la pregunta sólo si venía con una
// frase muy concreta ("más vendidos", "qué se vende"). Probada contra
// quince formas normales de pedir lo mismo, reconocía dos: "buscame
// jeans", "analiza el mercado de shapewear" o "dame información de velas
// de soya" caían todas en la respuesta genérica. Por eso ahora suma
// señales en vez de exigir una sola.

/**
 * Qué se está preguntando dentro de TikTok Shop. "Los creadores que más
 * venden shampoo" no se contesta con el ranking de productos: se iba a
 * productos igual, con la frase entera de palabra clave, y volvía vacío.
 */
export type { ResearchKind };

export interface ResearchIntent {
  source: ResearchSource;
  kind: ResearchKind;
  /** Mercado de TikTok Shop (ISO), cuando la pregunta lo nombra. */
  country?: string;
  /**
   * El término que se manda a la fuente. Puede ir VACÍO a propósito:
   * "qué se vende más en TikTok Shop" no tiene término, es el ranking
   * de arriba. La fuente acepta una consulta sin palabra clave.
   */
  term: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Señales de que la pregunta pide un DATO. */
const PIDE_DATOS = [
  /\bmas vendid/, /\bmejor(es)? (producto|articulo|venta|vendido)/, /\bque se vende/, /\bque se venden/,
  /\bse vende mas/, /\bcuanto se vende/, /\bmas vend/, /\bvenden mas\b/, /\bmas venta/, /\btop\b/, /\branking\b/, /\btendencia/, /\bde moda\b/,
  /\bque vender\b/, /\bproductos? ganador/, /\bmercado de\b/, /\bque hay de nuevo/, /\binteligencia\b/,
  /\bquien (importa|exporta|compra|vende)/, /\bque empresas/, /\bcuanto se (importa|exporta)/,
  /\bcompetencia\b/, /\bcompetidor/, /\bdemanda\b/, /\bnicho/, /\boportunidad/, /\bestadistica/,
  /\bbest selling\b/, /\btop selling\b/, /\bwhat sells\b/, /\bselling best\b/, /\bwho (imports|exports|buys)\b/,
  /\bwhich companies\b/, /\btrending\b/, /\btrends\b/, /\bwinning products\b/, /\bdemand\b/,
];

/**
 * Verbos con los que se pide una búsqueda. "Buscame jeans" es una
 * consulta tan clara como "cuáles son los jeans más vendidos".
 */
const VERBO_DE_BUSQUEDA =
  /\b(busca|buscame|buscar|busque|muestra|muestrame|mostrar|dame|damelo|ver|veamos|analiza|analizar|analisis|consulta|consultar|investiga|investigar|revisa|revisame|averigua|averiguame|mira|mirame|search|find|show|analyze|check)\b/;

/** Que la pregunta trata de mercado, no de nuestro servicio. */
const CONTEXTO_MERCADO =
  /\b(tik ?tok|shop|amazon|shopify|marketplace|mercado|mercados|aduana|aduanas|importa|exporta|comercio exterior|competencia|nicho|categoria|categorias|producto|productos|marca|marcas|creador|creadores|gmv|ventas|market|customs)\b/;

/**
 * Lo que NUNCA es una consulta de mercado, por mucho verbo de búsqueda
 * que lleve. Cada consulta se cobra: "buscame el flete a Miami" tiene la
 * forma de una búsqueda y es otra cosa completamente distinta.
 */
const NO_ES_BUSQUEDA =
  /\b(flete|fletes|envio|envios|cotiza|cotizar|cotizacion|como empiezo|empezar|agendar|reunion|llamada|consultoria|prep center|quien eres|contacto|whatsapp|telefono|reembolso|factura|suscripcion|cancelar)\b/;

/**
 * Clasificar un producto tampoco es una consulta de mercado, y tiene
 * exactamente la forma de una: "analizá mi producto" lleva el verbo
 * ("analiza") y el contexto ("producto"), así que se iba derecho a la
 * mesa de consultas —que se cobra— y contestaba otra cosa.
 *
 * Esto va aparte de NO_ES_BUSQUEDA porque no sólo frena la consulta:
 * marca que la pregunta es para el lector de etiquetas, que es de la
 * casa y no cuesta un crédito.
 */
const ES_CLASIFICAR =
  /\b(clasificar|clasificacion|clasifico|arancelaria|hts|nandina|etiqueta|etiquetas|composicion|escanear|escaneo|analizar (mi |el |este )?producto|analiza (mi |el |este )?producto|foto (de|del|a la)|classify|classification|tariff code|hs code|customs code|scan|label)\b/;

/** A qué fuente va. */
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

/** ¿Esto es para el lector de etiquetas y no para la mesa de consultas? */
export function esClasificacion(pregunta: string): boolean {
  return ES_CLASIFICAR.test(normalize(pregunta));
}

/**
 * Palabras que nunca son el producto que se busca: preguntas, verbos,
 * conectores, y lo que es vocabulario NUESTRO y no de mercado.
 *
 * Que "precio", "plan" o "servicio" estén acá hace doble trabajo: además
 * de limpiar el término, desactivan la regla del verbo. "Dame los
 * precios" se queda sin término y por eso no dispara una consulta que se
 * cobra — está preguntando por lo nuestro, no por el mercado.
 */
const VACIAS = new Set([
  'que', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'quien', 'quienes', 'donde', 'como', 'cuando',
  'son', 'es', 'esta', 'estan', 'hay', 'me', 'te', 'se', 'le', 'lo', 'la', 'las', 'los', 'el', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'y', 'o', 'u', 'mi', 'tu', 'su', 'sus', 'mas', 'menos', 'muy',
  'mejor', 'mejores', 'peor', 'peores', 'top', 'ranking', 'tendencia', 'tendencias', 'vendido', 'vendidos', 'vendida', 'vendidas',
  'vende', 'venden', 'vendan', 'vender', 'venta', 'ventas', 'compra', 'compran', 'comprar', 'importa', 'importan', 'importar',
  'exporta', 'exportan', 'exportar', 'aduana', 'aduanas', 'empresa', 'empresas', 'marca', 'marcas', 'pais', 'paises',
  'producto', 'productos', 'articulo', 'articulos', 'cosa', 'cosas', 'categoria', 'categorias', 'nicho', 'nichos',
  'tiktok', 'tik', 'tok', 'shop', 'amazon', 'shopify', 'marketplace', 'demanda', 'competencia', 'oportunidad', 'oportunidades',
  'ganador', 'ganadores', 'actualmente', 'ahora', 'hoy', 'ue', 'dime', 'quiero', 'saber', 'sobre', 'algo', 'tiene', 'tienen',
  // Vocabulario nuestro, no del mercado.
  'precio', 'precios', 'tarifa', 'tarifas', 'plan', 'planes', 'servicio', 'servicios', 'costo', 'costos',
  'dato', 'datos', 'informacion', 'info', 'mercado', 'mercados', 'moda', 'nuevo', 'nueva', 'inteligencia',
  // Los verbos de búsqueda tampoco son el producto.
  'busca', 'buscame', 'buscar', 'busque', 'muestra', 'muestrame', 'mostrar', 'dame', 'damelo', 'ver', 'veamos',
  'analiza', 'analizar', 'analisis', 'consulta', 'consultar', 'investiga', 'investigar', 'revisa', 'revisame',
  'averigua', 'averiguame', 'mira', 'mirame',
  // Qué se pregunta (creadores, tiendas, videos), no de qué producto.
  'creador', 'creadores', 'creadora', 'creadoras', 'contenido', 'influencer', 'influencers', 'afiliado', 'afiliados',
  'tienda', 'tiendas', 'vendedor', 'vendedores', 'video', 'videos', 'vivo', 'vivos', 'live', 'lives', 'transmision',
  'transmisiones', 'creator', 'creators', 'shops', 'sellers', 'seller', 'livestream', 'livestreams',
  'what', 'which', 'who', 'where', 'how', 'best', 'selling', 'sells', 'sell', 'trending', 'trends', 'products',
  'product', 'companies', 'company', 'imports', 'import', 'exports', 'export', 'customs', 'the', 'an', 'in', 'on',
  'of', 'for', 'and', 'or', 'is', 'are', 'most', 'sold', 'suppliers', 'supplier', 'demand', 'search', 'find', 'show',
]);

/**
 * El término de búsqueda: lo que queda de la pregunta al quitarle todo
 * lo que es pregunta. Máximo tres palabras — las fuentes buscan por
 * palabra clave, no por frase.
 */
export function extractTerm(text: string, opts: { sinMercado?: boolean } = {}): string {
  let limpio = normalize(text).replace(/[^a-z0-9ñ\s]/g, ' ');
  // En TikTok Shop el país es el mercado, no parte del producto:
  // "shampoo en USA" busca "shampoo" en el mercado US. En aduanas no se
  // toca, porque ahí el país sí puede ser lo que se pregunta.
  if (opts.sinMercado) for (const [, patron] of MERCADOS) limpio = limpio.replace(patron, ' ');
  const palabras = limpio
    .split(/\s+/)
    .filter((w) => w.length > 2 && !VACIAS.has(w) && !/^\d+$/.test(w));
  return palabras.slice(0, 3).join(' ');
}

/**
 * Los mercados de TikTok Shop, como los escribe la gente. Sólo los que
 * la fuente cubre: nombrar otro país no cambia el mercado.
 */
const MERCADOS: Array<[string, RegExp]> = [
  ['US', /\b(usa|eeuu|ee uu|estados unidos|united states|norteamerica|gringolandia)\b/g],
  ['MX', /\b(mexico)\b/g],
  ['BR', /\b(brasil|brazil)\b/g],
  ['ES', /\b(espana|spain)\b/g],
  ['GB', /\b(reino unido|inglaterra|united kingdom|uk)\b/g],
  ['DE', /\b(alemania|germany)\b/g],
  ['FR', /\b(francia|france)\b/g],
  ['IT', /\b(italia|italy)\b/g],
  ['JP', /\b(japon|japan)\b/g],
  ['ID', /\b(indonesia)\b/g],
  ['TH', /\b(tailandia|thailand)\b/g],
  ['VN', /\b(vietnam|viet nam)\b/g],
  ['PH', /\b(filipinas|philippines)\b/g],
  ['MY', /\b(malasia|malaysia)\b/g],
  ['SG', /\b(singapur|singapore)\b/g],
];

/** El mercado que nombra la pregunta, o nada (la fuente usa US). */
export function detectMarket(text: string): string | undefined {
  const q = normalize(text).replace(/[^a-z0-9ñ\s]/g, ' ');
  for (const [codigo, patron] of MERCADOS) {
    patron.lastIndex = 0;
    if (patron.test(q)) return codigo;
  }
  return undefined;
}

/** De qué habla la pregunta: productos (lo normal), creadores, tiendas… */
export function detectKind(text: string): ResearchKind {
  const q = normalize(text);
  if (/\b(creador|creadora|influencer|creator|afiliad)/.test(q)) return 'creator';
  if (/\b(en vivo|lives?|livestreams?|transmision)/.test(q)) return 'livestream';
  if (/\bvideos?\b/.test(q)) return 'video';
  // "tiktok shop" lleva "shop": sólo cuentan las formas que nombran a
  // quien vende, no a la plataforma.
  if (/\b(tiendas?|vendedores|sellers|shops)\b/.test(q)) return 'shop';
  return 'product';
}

/**
 * Lo que se manda a la fuente cuando la persona escribió una frase
 * entera en lugar de una palabra clave (después del botón "Buscar en
 * TikTok Shop", o una pregunta guardada mientras entraba). Una palabra
 * clave corta se respeta tal cual.
 */
export function aConsulta(source: ResearchSource, texto: string): { term: string; kind: ResearchKind; country?: string } {
  const tiktok = source === 'tiktok';
  const larga = texto.trim().split(/\s+/).length > 3;
  return {
    term: larga ? extractTerm(texto, { sinMercado: tiktok }) : texto.trim(),
    kind: tiktok ? detectKind(texto) : 'product',
    country: tiktok ? detectMarket(texto) : undefined,
  };
}

export function detectResearch(text: string): ResearchIntent | null {
  const q = normalize(text);
  if (q.length < 4) return null;

  // El veto va primero: hay preguntas con forma de búsqueda que no lo
  // son, y buscar ahí cuesta dinero y contesta otra cosa.
  if (NO_ES_BUSQUEDA.test(q) || ES_CLASIFICAR.test(q)) return null;

  const term = extractTerm(text);
  const datos = hit(PIDE_DATOS, q);
  const contexto = CONTEXTO_MERCADO.test(q);
  const verbo = VERBO_DE_BUSQUEDA.test(q) && term.length > 0;

  // Suma de señales, con dos puntos como umbral. Una sola señal débil
  // —sólo "amazon", sólo "productos"— no alcanza: sería cobrar una
  // consulta por nombrar un marketplace de pasada.
  if ((datos ? 2 : 0) + (verbo ? 2 : 0) + (contexto ? 1 : 0) < 2) return null;

  const aduanas = hit(SENAL_ADUANAS, q);
  const tiktok = hit(SENAL_TIKTOK, q);

  // Las dos señales a la vez, o ninguna: manda aduanas sólo si es la
  // única, porque es la más específica. Sin ninguna, el ranking de
  // marketplace es la respuesta útil por defecto.
  const source: ResearchSource = aduanas && !tiktok ? 'aduanas' : 'tiktok';
  if (source === 'aduanas') return { source, kind: 'product', term };
  return { source, kind: detectKind(text), country: detectMarket(text), term: extractTerm(text, { sinMercado: true }) };
}
