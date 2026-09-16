// Third-party market-intelligence connectors for Marco Polo.
//
// Kalodata = TikTok Shop analytics (products, creators, shops).
// Sicex     = foreign-trade intelligence (real import/export records).
//
// Neither vendor publishes a public API spec, so each connector is driven
// entirely by environment variables: you paste the endpoint and the key
// the vendor gives you, and the code adapts to whatever JSON comes back
// (see toResult). Nothing here ever synthesises data — when a provider is
// not configured or answers with nothing, the caller is told exactly
// that.
//
//   KALODATA_API_KEY   llave del Centro Abierto. Kalodata vive en su
//                      propio módulo (server/kalodata.ts) porque su forma
//                      es conocida: POST + JSON, llave en el encabezado
//                      `secret-key`, ruta /openapi/v1/tiktok/{módulo}/rank.
//   SICEX_API_KEY / SICEX_API_URL / SICEX_AUTH_STYLE / SICEX_AUTH_NAME
//                      el conector genérico de abajo, para cuando Sicex
//                      exponga una API HTTP directa.

import { isConfigured as kalodataConfigured, missingConfig as kalodataMissing, runKalodata as kalodataQuery } from './kalodata';

export interface ResearchRow {
  label: string;
  value: string;
}

export interface ResearchResult {
  /** One line describing what came back — never a claim we invented. */
  summary: string;
  rows: ResearchRow[];
  /** How many records the provider returned in total, when it says so. */
  total?: number;
  sourceUrl?: string;
}

type AuthStyle = 'bearer' | 'header' | 'query';

interface ProviderConfig {
  id: 'kalodata' | 'sicex';
  label: string;
  key?: string;
  url?: string;
  authStyle: AuthStyle;
  authName: string;
}

function readConfig(id: 'kalodata' | 'sicex'): ProviderConfig {
  const prefix = id.toUpperCase();
  const style = (process.env[`${prefix}_AUTH_STYLE`] as AuthStyle) || 'bearer';
  return {
    id,
    label: id === 'kalodata' ? 'Kalodata' : 'Sicex',
    key: process.env[`${prefix}_API_KEY`],
    url: process.env[`${prefix}_API_URL`],
    authStyle: ['bearer', 'header', 'query'].includes(style) ? style : 'bearer',
    authName: process.env[`${prefix}_AUTH_NAME`] || 'x-api-key',
  };
}

export function isConfigured(id: 'kalodata' | 'sicex'): boolean {
  // Kalodata tiene endpoint conocido: le basta la llave.
  if (id === 'kalodata') return kalodataConfigured();
  const c = readConfig(id);
  return !!(c.key && c.url);
}

/** What is still missing before this source can be used. */
export function missingConfig(id: 'kalodata' | 'sicex'): string[] {
  if (id === 'kalodata') return kalodataMissing();
  const c = readConfig(id);
  const missing: string[] = [];
  if (!c.key) missing.push(`${id.toUpperCase()}_API_KEY`);
  if (!c.url) missing.push(`${id.toUpperCase()}_API_URL`);
  return missing;
}

/**
 * Turn whatever JSON the provider returns into a short, readable answer.
 * Deliberately generic: it reports the fields that are actually present
 * and nothing else, so it keeps working when the vendor changes shape and
 * never pretends to know a number it was not given.
 */
function toResult(label: string, query: string, payload: unknown, sourceUrl?: string): ResearchResult {
  const records = pickRecords(payload);
  if (!records.length) {
    return { summary: `${label} no devolvió resultados para "${query}".`, rows: [], sourceUrl };
  }

  const rows: ResearchRow[] = [];
  for (const record of records.slice(0, 5)) {
    const name = String(
      record.name ?? record.title ?? record.product_name ?? record.productName ?? record.company ?? record.importer ?? record.exporter ?? '—'
    ).slice(0, 80);
    const facts = Object.entries(record)
      .filter(([k, v]) => !/^(id|_id|url|image|images|thumbnail|logo)$/i.test(k) && (typeof v === 'number' || typeof v === 'string'))
      .filter(([, v]) => String(v).length <= 40)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    rows.push({ label: name, value: facts || '—' });
  }

  const total = typeof (payload as { total?: unknown })?.total === 'number' ? ((payload as { total: number }).total) : undefined;
  return {
    summary: `${label}: ${total ?? records.length} resultado(s) para "${query}".`,
    rows,
    total,
    sourceUrl,
  };
}

function pickRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === 'object') {
    for (const key of ['data', 'results', 'items', 'records', 'rows', 'list']) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as Record<string, unknown>[];
      // One level deeper: { data: { list: [...] } }
      if (value && typeof value === 'object') {
        for (const inner of ['list', 'items', 'results', 'records']) {
          const nested = (value as Record<string, unknown>)[inner];
          if (Array.isArray(nested)) return nested as Record<string, unknown>[];
        }
      }
    }
  }
  return [];
}

async function call(config: ProviderConfig, query: string, country?: string): Promise<ResearchResult> {
  if (!config.key || !config.url) {
    throw new Error(`${config.label} is not configured (${missingConfig(config.id).join(', ')})`);
  }

  const url = new URL(config.url);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.authStyle === 'bearer') headers.Authorization = `Bearer ${config.key}`;
  else if (config.authStyle === 'header') headers[config.authName] = config.key;
  else url.searchParams.set(config.authName, config.key);

  url.searchParams.set('q', query);
  url.searchParams.set('keyword', query);
  if (country) url.searchParams.set('country', country);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`${config.label} responded ${res.status}`);
    const payload = await res.json();
    return toResult(config.label, query, payload, config.url);
  } finally {
    clearTimeout(timeout);
  }
}

// Kalodata no encaja en el conector genérico: es POST + JSON con la
// llave en un encabezado, y su cuerpo lleva region / language /
// currency / date_range. Vive en su propio módulo, con pruebas.
export function runKalodata(query: string, country?: string): Promise<ResearchResult> {
  return kalodataQuery(query, country);
}

export function runSicex(query: string, country?: string): Promise<ResearchResult> {
  return call(readConfig('sicex'), query, country);
}
