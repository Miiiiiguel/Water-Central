import type { ResearchResult, ResearchRow } from './connectors';

// Kalodata Open API — TikTok Shop (productos, tiendas, creadores, vídeos,
// transmisiones en vivo, categorías).
//
// Forma real de la API, confirmada por su soporte:
//   - Todos los endpoints son POST + JSON.
//   - La llave va en un encabezado (`secret-key`).
//   - Campos comunes en el cuerpo: region / language / currency / date_range.
//
// La ruta sigue el patrón
//   https://www.kalodata.com/openapi/v1/tiktok/{módulo}/{acción}
// con acciones `rank` (ranking filtrado) y `detail` (una entidad).
//
// Cada llamada gasta créditos (1 crédito ≈ 0.1 USD), así que esto vive en
// el servidor detrás de la cuota de server/research.ts — nunca se llama
// desde el navegador, y nunca se reintenta en silencio.

const BASE = process.env.KALODATA_API_URL || 'https://www.kalodata.com/openapi/v1/tiktok';
const AUTH_HEADER = process.env.KALODATA_AUTH_NAME || 'secret-key';

/** Mercados que cubre Kalodata, tal como los lista su documentación. */
export const MARKETS = ['US', 'GB', 'ID', 'TH', 'VN', 'PH', 'MY', 'SG', 'JP', 'MX', 'DE', 'IT', 'FR', 'ES', 'BR'] as const;
export type Market = (typeof MARKETS)[number];

export const DEFAULT_MARKET: Market = 'US';

/** Moneda con la que se consulta cada mercado. */
const CURRENCY: Record<Market, string> = {
  US: 'USD', GB: 'GBP', ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP', MY: 'MYR',
  SG: 'SGD', JP: 'JPY', MX: 'MXN', DE: 'EUR', IT: 'EUR', FR: 'EUR', ES: 'EUR', BR: 'BRL',
};

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

/** Rango de fechas por defecto: los últimos `days` días, en ISO. */
export function dateRange(days = 30, today = new Date()): { start_date: string; end_date: string } {
  const end = new Date(today);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start_date: iso(start), end_date: iso(end) };
}

export interface KalodataRequest {
  region: Market;
  language: string;
  currency: string;
  date_range: { start_date: string; end_date: string };
  keyword?: string;
  page: number;
  page_size: number;
}

/** El cuerpo exacto que se le manda a Kalodata. Puro, para poder probarlo. */
export function buildRequest(opts: { query?: string; country?: string | null; language?: string; days?: number; pageSize?: number; today?: Date }): KalodataRequest {
  const region = marketFor(opts.country);
  return {
    region,
    language: opts.language === 'es' ? 'es' : 'en',
    currency: CURRENCY[region],
    date_range: dateRange(opts.days ?? 30, opts.today),
    ...(opts.query?.trim() ? { keyword: opts.query.trim() } : {}),
    page: 1,
    page_size: Math.min(20, Math.max(1, opts.pageSize ?? 10)),
  };
}

export function isConfigured(): boolean {
  return Boolean(process.env.KALODATA_API_KEY);
}

export function missingConfig(): string[] {
  return isConfigured() ? [] : ['KALODATA_API_KEY'];
}

/** Saca la lista de registros venga como venga envuelta. */
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
  return [];
}

const NAME_KEYS = ['title', 'name', 'product_name', 'productName', 'shop_name', 'shopName', 'creator_name', 'nickname'];
const SKIP_KEYS = /^(id|_id|.*_id|url|link|image|images|cover|thumbnail|avatar|logo)$/i;

/** Lo interesante de un registro, sin inventar nada que no venga. */
function describe(record: Record<string, unknown>): ResearchRow {
  const label = String(NAME_KEYS.map((k) => record[k]).find((v) => typeof v === 'string' && v) ?? '—').slice(0, 90);
  const facts = Object.entries(record)
    .filter(([k, v]) => !SKIP_KEYS.test(k) && !NAME_KEYS.includes(k) && (typeof v === 'number' || typeof v === 'string'))
    .filter(([, v]) => String(v).length <= 40)
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' · ');
  return { label, value: facts || '—' };
}

export function toResult(query: string, market: Market, payload: unknown, sourceUrl: string): ResearchResult {
  const records = pickRecords(payload);
  if (!records.length) {
    return { summary: `Kalodata no devolvió resultados para "${query}" en ${market}.`, rows: [], sourceUrl };
  }
  const totalRaw = (payload as { total?: unknown; data?: { total?: unknown } })?.total ?? (payload as { data?: { total?: unknown } })?.data?.total;
  const total = typeof totalRaw === 'number' ? totalRaw : undefined;
  return {
    summary: `Kalodata · TikTok Shop ${market}: ${total ?? records.length} resultado(s) para "${query}".`,
    rows: records.slice(0, 5).map(describe),
    total,
    sourceUrl,
  };
}

/**
 * Una consulta real. Lanza si no está configurado o si Kalodata responde
 * mal — el llamador devuelve la cuota en ese caso, porque no hubo dato.
 */
export async function runKalodata(query: string, country?: string, opts: { module?: Module; language?: string } = {}): Promise<ResearchResult> {
  const key = process.env.KALODATA_API_KEY;
  if (!key) throw new Error('Kalodata is not configured (KALODATA_API_KEY)');

  const module = opts.module ?? 'product';
  const url = endpointFor(module, 'rank');
  const body = buildRequest({ query, country, language: opts.language });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', [AUTH_HEADER]: key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`Kalodata responded ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return toResult(query, body.region, await res.json(), url);
}
