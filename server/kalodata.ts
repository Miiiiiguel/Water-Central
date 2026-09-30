import type { ResearchResult, ResearchRow } from './connectors';
import { aConsulta } from '../client/src/lib/researchIntent';

// Kalodata Open API — TikTok Shop (productos, tiendas, creadores, vídeos,
// transmisiones en vivo, categorías).
//
// Forma real de la API, tomada de su documentación:
//   - Todos los endpoints son POST + JSON.
//   - La llave va en un encabezado (`secret-key`).
//   - Campos obligatorios: region / language / currency / date_range.
//   - `language` y `currency` son códigos suyos, no los de la app:
//     `en-US`, `es-ES`… y `USD`, `MXN`, `EUR`…
//   - `date_range` es un STRING: un rango con nombre (`last30Day`), un
//     rango natural `yyyy-MM-dd~yyyy-MM-dd`, o un mes `yyyy-MM`.
//   - Respuesta: { success, data, message, cached, code }.
//
// La ruta sigue el patrón
//   https://www.kalodata.com/openapi/v1/tiktok/{módulo}/{acción}
// con acciones `rank` (ranking filtrado) y `detail` (una entidad).
//
// Precios (tabla de Kalodata, 1 crédito ≈ 0.1 USD):
//   ranking  0.1 × techo(filas / 100) créditos
//   detalle  0.1 créditos
// O sea: una consulta cuesta USD 0.01, y **pedir 1 fila cuesta lo mismo
// que pedir 100** — el cobro va por bloques de cien. Bajar `page_size`
// no ahorra un centavo; lo único que ahorra llamadas es no hacerlas.
// Por eso pedimos un bloque entero y mostramos lo que quepa.
//
// El reembolso por volumen solo empieza pasando 30.000 llamadas al mes
// (USD 300/mes); hasta ahí no hay nada que optimizar.
//
// Aun así esto vive en el servidor, detrás de la cuota de
// server/research.ts: nunca se llama desde el navegador y nunca se
// reintenta en silencio.

const MODULES_RAW = ['product', 'shop', 'creator', 'video', 'livestream', 'category'];

/**
 * `KALODATA_API_URL` es la BASE, no un endpoint. Si alguien pega la ruta
 * completa (fácil de hacer: es la que aparece en la documentación), le
 * quitamos el /{módulo}/{acción} en vez de construir una URL doblada que
 * daría 404 — y gastaría un intento.
 */
export function baseFrom(raw?: string): string {
  const fallback = 'https://www.kalodata.com/openapi/v1/tiktok';
  const value = raw?.trim().replace(/\/+$/, '');
  if (!value) return fallback;
  return value.replace(
    new RegExp(`/(${MODULES_RAW.join('|')})/(rank|detail)$`),
    ''
  );
}

const BASE = baseFrom(process.env.KALODATA_API_URL);
const AUTH_HEADER = process.env.KALODATA_AUTH_NAME || 'secret-key';

/** Mercados que cubre Kalodata, tal como los lista su documentación. */
export const MARKETS = ['US', 'GB', 'ID', 'TH', 'VN', 'PH', 'MY', 'SG', 'JP', 'MX', 'DE', 'IT', 'FR', 'ES', 'BR'] as const;
export type Market = (typeof MARKETS)[number];

export const DEFAULT_MARKET: Market = 'US';

/** Moneda con la que se consulta cada mercado (de su lista admitida). */
const CURRENCY: Record<Market, string> = {
  US: 'USD', GB: 'GBP', ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP', MY: 'MYR',
  SG: 'SGD', JP: 'JPY', MX: 'MXN', DE: 'EUR', IT: 'EUR', FR: 'EUR', ES: 'EUR', BR: 'BRL',
};

/**
 * Los idiomas de la app son 'es' y 'en'; Kalodata quiere un locale de su
 * lista (zh-CN, en-US, id-ID, th-TH, vi-VN, es-ES, ja-JP, pt-BR, ko-KR,
 * fr-FR). Mandar 'es' a secas es un error garantizado.
 */
export function languageFor(appLanguage?: string): string {
  return appLanguage === 'es' ? 'es-ES' : 'en-US';
}

/** Rangos con nombre que acepta `date_range`. */
export const NAMED_RANGES = ['lastDay', 'last7Day', 'last30Day', 'last60Day', 'last90Day', 'last180Day', 'last365Day'] as const;
export type NamedRange = (typeof NAMED_RANGES)[number];

export const DEFAULT_RANGE: NamedRange = 'last30Day';

/**
 * `date_range` es un string. Aceptamos un rango con nombre tal cual, o
 * dos fechas ISO que se convierten al formato natural que ellos piden
 * (`yyyy-MM-dd~yyyy-MM-dd`). Cualquier otra cosa cae al rango por
 * defecto en vez de gastar un crédito en una petición inválida.
 */
export function dateRangeFor(range?: string): string {
  if (!range) return DEFAULT_RANGE;
  const value = range.trim();
  if ((NAMED_RANGES as readonly string[]).includes(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return value;                                  // mes natural
  if (/^\d{4}-\d{2}-\d{2}~\d{4}-\d{2}-\d{2}$/.test(value)) return value;        // rango natural
  return DEFAULT_RANGE;
}

export const MODULES = ['product', 'shop', 'creator', 'video', 'livestream', 'category'] as const;
export type Module = (typeof MODULES)[number];
export type Action = 'rank' | 'detail';

export function endpointFor(module: Module, action: Action = 'rank'): string {
  return `${BASE.replace(/\/$/, '')}/${module}/${action}`;
}

/**
 * Normaliza lo que pida el usuario a un mercado que Kalodata cubra.
 * Acepta el código ISO en cualquier caja; cualquier otra cosa cae al
 * mercado por defecto en vez de mandar una consulta que va a fallar.
 */
export function marketFor(country?: string | null): Market {
  if (!country) return DEFAULT_MARKET;
  const code = country.trim().toUpperCase();
  return (MARKETS as readonly string[]).includes(code) ? (code as Market) : DEFAULT_MARKET;
}

export interface KalodataRequest {
  region: Market;
  language: string;
  currency: string;
  date_range: string;
  keyword?: string;
  page: number;
  page_size: number;
}

/** El cuerpo exacto que se le manda a Kalodata. Puro, para poder probarlo. */
export function buildRequest(opts: { query?: string; country?: string | null; language?: string; range?: string; pageSize?: number }): KalodataRequest {
  const region = marketFor(opts.country);
  return {
    region,
    language: languageFor(opts.language),
    currency: CURRENCY[region],
    date_range: dateRangeFor(opts.range),
    // `keyword`, `page` y `page_size` no salen de la doc de /video/detail
    // que tenemos; se mandan porque los endpoints de ranking los piden.
    // Si algún módulo los rechaza, el error de Kalodata lo dirá literal.
    ...(opts.query?.trim() ? { keyword: opts.query.trim() } : {}),
    page: 1,
    // El tope es 100 porque ahí está el borde del bloque de cobro: pedir
    // 101 filas cuesta el doble que pedir 100. Por debajo de 100 el
    // precio es plano, así que pedir de a poco solo pierde datos.
    page_size: Math.min(100, Math.max(1, opts.pageSize ?? 50)),
  };
}

export function isConfigured(): boolean {
  return Boolean(process.env.KALODATA_API_KEY);
}

export function missingConfig(): string[] {
  return isConfigured() ? [] : ['KALODATA_API_KEY'];
}

/** La envoltura estándar de Kalodata. */
export interface KalodataEnvelope {
  success?: boolean;
  data?: unknown;
  message?: string;
  cached?: boolean;
  code?: string;
}

/**
 * Kalodata puede contestar HTTP 200 con `success: false` — un fallo
 * disfrazado de éxito. Esto lo detecta para que el llamador devuelva la
 * cuota en vez de mostrar una respuesta vacía como si fuera un resultado.
 */
export function envelopeError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const env = payload as KalodataEnvelope;
  if (env.success === false) return env.message?.trim() || env.code || 'Kalodata respondió success: false';
  return null;
}

/**
 * "No hay resultados", dicho a la manera de Kalodata: HTTP 200 con
 * `success: false` y `message: "product not found"`. No es una falla —
 * es una búsqueda vacía — y tratarla como falla cortaba la búsqueda en
 * el primer intento y le decía al cliente "la fuente no respondió".
 * Pasó tal cual en producción.
 */
export function esNoEncontrado(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const env = payload as KalodataEnvelope;
  if (env.success !== false) return false;
  return /not.?found|no.?data|no.?result|empty/i.test(`${env.message ?? ''} ${env.code ?? ''}`);
}

/** True cuando Kalodata sirvió de su caché (no debería costar créditos). */
export function wasCached(payload: unknown): boolean {
  return Boolean(payload && typeof payload === 'object' && (payload as KalodataEnvelope).cached === true);
}

/**
 * Saca la lista de registros venga como venga envuelta. Los endpoints
 * `detail` devuelven UN objeto en `data`, no una lista: se envuelve para
 * que el resto del código no tenga que distinguir.
 */
export function pickRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ['data', 'result', 'results', 'items', 'records', 'rows', 'list']) {
    const value = obj[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
    if (value && typeof value === 'object') {
      for (const inner of ['list', 'items', 'results', 'records', 'data']) {
        const nested = (value as Record<string, unknown>)[inner];
        if (Array.isArray(nested)) return nested as Record<string, unknown>[];
      }
    }
  }
  // Un solo registro (endpoints `detail`): una lista de uno.
  const data = obj.data;
  if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
    return [data as Record<string, unknown>];
  }
  return [];
}

const NAME_KEYS = ['video_title', 'product_name', 'shop_name', 'creator_handle', 'belonged_creator_handle', 'title', 'name', 'nickname', 'category_name'];
const SKIP_KEYS = /^(id|_id|.*_id|url|link|image|images|cover|thumbnail|avatar|logo|.*_trend)$/i;

// Los campos que de verdad le importan a alguien que vende, en el orden
// en que los quiere ver. `sales_volumn` está escrito así en su API.
const HEADLINE: { key: string; label: string; money?: boolean }[] = [
  { key: 'revenue', label: 'ingresos', money: true },
  { key: 'sales_volumn', label: 'ventas' },
  { key: 'sales_volume', label: 'ventas' },
  { key: 'views', label: 'vistas' },
  { key: 'video_gpm', label: 'GPM', money: true },
  { key: 'ads_roas', label: 'ROAS' },
  { key: 'price', label: 'precio', money: true },
  { key: 'product_number', label: 'productos' },
];

const compact = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/** Lo interesante de un registro, sin inventar nada que no venga. */
function describe(record: Record<string, unknown>, currency = ''): ResearchRow {
  const label = String(NAME_KEYS.map((k) => record[k]).find((v) => typeof v === 'string' && v) ?? '—').slice(0, 90);

  const seen = new Set<string>();
  const facts: string[] = [];
  for (const f of HEADLINE) {
    const v = record[f.key];
    if (typeof v !== 'number' || seen.has(f.label)) continue;
    seen.add(f.label);
    facts.push(`${f.label}: ${f.money && currency ? `${compact(v)} ${currency}` : compact(v)}`);
    if (facts.length >= 4) break;
  }
  // Si el módulo no trae ninguno de los de arriba, mostramos lo que haya.
  if (!facts.length) {
    for (const [k, v] of Object.entries(record)) {
      if (SKIP_KEYS.test(k) || NAME_KEYS.includes(k)) continue;
      if ((typeof v !== 'number' && typeof v !== 'string') || String(v).length > 40) continue;
      facts.push(`${k.replace(/_/g, ' ')}: ${v}`);
      if (facts.length >= 4) break;
    }
  }
  return { label, value: facts.join(' · ') || '—' };
}

export function toResult(query: string, market: Market, payload: unknown, sourceUrl: string, currency = ''): ResearchResult {
  const records = pickRecords(payload);
  if (!records.length) {
    const loQueSeBusco = query.trim() ? `para "${query}"` : 'en el ranking general';
    return { summary: `Sin resultados ${loQueSeBusco} en TikTok Shop ${market}.`, rows: [], sourceUrl };
  }
  const totalRaw = (payload as { total?: unknown; data?: { total?: unknown } })?.total ?? (payload as { data?: { total?: unknown } })?.data?.total;
  const total = typeof totalRaw === 'number' ? totalRaw : undefined;
  return {
    // El resumen es lo ÚNICO de todo esto que el cliente lee entero, así
    // que es el peor lugar posible para nombrar al proveedor — y es
    // justo donde estaba: "Kalodata · TikTok Shop US: 40 resultado(s)".
    // Se nombra el dato y el mercado; de dónde sale, no.
    // Sin término se pidió el ranking general; decir 'para ""' ahí
    // parece un error de la app.
    summary: query.trim()
      ? `TikTok Shop ${market}: ${total ?? records.length} resultado(s) para "${query}".`
      : `TikTok Shop ${market}: lo más vendido ahora mismo (${total ?? records.length} resultado(s)).`,
    rows: records.slice(0, 5).map((r) => describe(r, currency)),
    total,
    sourceUrl,
  };
}

/**
 * Qué se pregunta. Llega del chat: "los creadores que más venden X" no
 * es lo mismo que "los productos más vendidos de X".
 */
export type Kind = 'product' | 'creator' | 'shop' | 'video' | 'livestream';

/**
 * Qué ranking contesta cada pregunta.
 *
 * "Los creadores que más venden shampoo" no se contesta con el ranking de
 * creadores: ahí la palabra clave busca por el nombre del creador, y
 * nadie se llama shampoo. Se contesta con los videos que más venden
 * shampoo, agrupados por quién los hizo (cada video trae
 * `belonged_creator_handle`). Sin producto, sí va el ranking de
 * creadores.
 */
export function moduleFor(kind: Kind = 'product', query = ''): Module {
  if (kind === 'creator') return query.trim() ? 'video' : 'creator';
  if (kind === 'shop' || kind === 'video' || kind === 'livestream') return kind;
  return 'product';
}

/**
 * Las palabras clave que se prueban, de la más precisa a la más amplia.
 * "shampoo natural sant" (con la errata) no coincide con nada;
 * "shampoo" sí. Cada intento es otra llamada (USD 0.01 cada una), así
 * que son tres como mucho, y se corta en el primero que trae algo.
 */
export function termsToTry(query: string): string[] {
  const palabras = query.trim().split(/\s+/).filter(Boolean);
  const intentos: string[] = [];
  for (let n = palabras.length; n >= 1 && intentos.length < 3; n--) intentos.push(palabras.slice(0, n).join(' '));
  return intentos.length ? intentos : [''];
}

export interface CreadorAgrupado {
  handle: string;
  revenue: number;
  sales: number;
  videos: number;
}

/** Los videos, sumados por creador y ordenados por lo que vendieron. */
export function creatorsFromVideos(records: Record<string, unknown>[]): CreadorAgrupado[] {
  const porCreador: Record<string, CreadorAgrupado> = {};
  const orden: string[] = [];
  for (const r of records) {
    const handle = [r.belonged_creator_handle, r.creator_handle].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
    if (!handle) continue;
    // "@Ana" y "ana" son la misma cuenta: TikTok no distingue mayúsculas.
    const clave = handle.trim().replace(/^@/, '').toLowerCase();
    if (!porCreador[clave]) {
      porCreador[clave] = { handle: handle.trim().replace(/^@/, ''), revenue: 0, sales: 0, videos: 0 };
      orden.push(clave);
    }
    const c = porCreador[clave];
    if (typeof r.revenue === 'number') c.revenue += r.revenue;
    const ventas = typeof r.sales_volumn === 'number' ? r.sales_volumn : r.sales_volume;
    if (typeof ventas === 'number') c.sales += ventas;
    c.videos += 1;
  }
  return orden.map((k) => porCreador[k]).sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);
}

const QUE: Record<Kind, string> = {
  product: 'productos',
  creator: 'creadores',
  shop: 'tiendas',
  video: 'videos',
  livestream: 'transmisiones en vivo',
};

/** El resultado de "los creadores que más venden X", armado de sus videos. */
export function toCreatorResult(query: string, market: Market, creadores: CreadorAgrupado[], currency = ''): ResearchResult {
  const dinero = (n: number) => (currency ? `${compact(n)} ${currency}` : compact(n));
  return {
    summary: `TikTok Shop ${market}: los creadores que más venden "${query}", según sus videos de los últimos 30 días.`,
    rows: creadores.slice(0, 5).map((c) => ({
      label: `@${c.handle}`,
      value: [
        c.revenue ? `ingresos: ${dinero(c.revenue)}` : '',
        c.sales ? `ventas: ${compact(c.sales)}` : '',
        `${c.videos} video${c.videos === 1 ? '' : 's'}`,
      ].filter(Boolean).join(' · '),
    })),
    total: creadores.length,
  };
}

async function pedirRanking(module: Module, query: string, country: string | undefined, language: string | undefined, key: string) {
  const url = endpointFor(module, 'rank');
  const body = buildRequest({ query, country, language });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', [AUTH_HEADER]: key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`Kalodata ${module}/rank responded ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = await res.json();
  // 200 con success:false es un fallo suyo: hay que tratarlo como tal,
  // no mostrar una respuesta vacía como si fuera un resultado.
  // Salvo "no encontrado", que es una búsqueda vacía y se devuelve como tal.
  const failure = envelopeError(payload);
  if (failure && !esNoEncontrado(payload)) throw new Error(`Kalodata ${module}/rank: ${failure}`);
  return { url, body, payload: failure ? { data: { list: [] } } : payload };
}

/**
 * Una consulta real. Lanza si no está configurado o si Kalodata responde
 * mal — el llamador devuelve la cuota en ese caso, porque no hubo dato.
 */
export async function runKalodata(
  query: string,
  country?: string,
  opts: { module?: Module; kind?: Kind; language?: string } = {}
): Promise<ResearchResult> {
  const key = process.env.KALODATA_API_KEY;
  if (!key) throw new Error('Kalodata is not configured (KALODATA_API_KEY)');

  // La pregunta se limpia también acá, no sólo en el navegador. Una
  // pestaña con la versión anterior de la app (el service worker la
  // cambia recién en la segunda recarga) seguía mandando la frase entera
  // y sin decir que preguntaba por creadores.
  const limpia = aConsulta('tiktok', query);
  const term = limpia.term;
  const kind = opts.kind && opts.kind !== 'product' ? opts.kind : limpia.kind;
  const pais = country || limpia.country;
  const module = opts.module ?? moduleFor(kind, term);

  let usado = '';
  let r: Awaited<ReturnType<typeof pedirRanking>> | null = null;
  for (const intento of termsToTry(term)) {
    usado = intento;
    r = await pedirRanking(module, intento, pais, opts.language, key);
    if (pickRecords(r.payload).length) break;
  }
  const { url, body, payload } = r!;
  const records = pickRecords(payload);
  // Si ni la palabra más amplia trajo nada, se informa lo que la persona
  // preguntó, no el último recorte.
  const buscado = records.length ? usado : term;
  const aviso = records.length && usado !== term ? `Con "${term}" no hubo resultados, así que busqué "${usado}". ` : '';

  let result: ResearchResult;
  const creadores = kind === 'creator' && module === 'video' ? creatorsFromVideos(records) : [];
  if (creadores.length) {
    result = toCreatorResult(buscado, body.region, creadores, body.currency);
  } else {
    result = toResult(buscado, body.region, payload, url, body.currency);
    if (records.length && kind !== 'product') {
      result.summary = result.summary.replace('resultado(s)', QUE[module === 'video' && kind === 'creator' ? 'video' : kind]);
    }
  }
  result.summary = aviso + result.summary;
  result.sourceUrl = url;
  return result;
}
