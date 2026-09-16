// Marco Polo's research desk (client side).
//
// The server owns the quota: these helpers only call it and render what
// comes back. Every failure mode is explicit so the chat can say the
// truth — "not connected yet", "out of lookups", "the source failed" —
// instead of showing invented numbers.

/**
 * Las fuentes, con el nombre que se usa de cara al cliente.
 *
 * Nunca el del proveedor. Antes el navegador pedía la fuente por su
 * nombre comercial, y ese nombre se leía abriendo la pestaña de red:
 * quien lo leyera tenía a un clic el contratarlo directo. El servidor
 * traduce estos ids a sus proveedores y no los devuelve nunca.
 */
export type ResearchSource = 'tiktok' | 'aduanas';

/**
 * Any part of the site can ask Marco Polo to run a lookup by dispatching
 * this event; the chat widget listens, opens itself and takes over. Kept
 * as an event (not a context) so a section can trigger the chatbot
 * without the two components importing each other.
 */
export const RESEARCH_EVENT = 'easycomex:research';

export interface ResearchRequest {
  source: ResearchSource;
  /** The term sent to the provider. */
  query: string;
  /** The human phrasing to echo in the chat, when there is one. */
  question?: string;
}

// Marco Polo mounts lazily, once the browser is idle, so a visitor who
// taps an example question in the first seconds would fire the event
// into nothing. The request is therefore parked here as well: whichever
// happens first — the listener hearing the event, or the widget mounting
// and draining the buffer — the lookup still runs, exactly once.
let pending: ResearchRequest | null = null;

export function requestResearch(req: ResearchRequest) {
  pending = req;
  window.dispatchEvent(new CustomEvent(RESEARCH_EVENT, { detail: req }));
}

/** Takes the parked request, if any, and clears it. */
export function consumePendingResearch(): ResearchRequest | null {
  const req = pending;
  pending = null;
  return req;
}

export interface ResearchRow {
  label: string;
  value: string;
}

export interface ResearchQuota {
  plan: string;
  dailyLimit: number;
  usedToday: number;
  freeRemaining: number;
  credits: number;
  canQuery: boolean;
  sources: Record<ResearchSource, boolean>;
}

export interface ResearchOk {
  kind: 'ok';
  source: ResearchSource;
  billed: 'free' | 'credit';
  summary: string;
  rows: ResearchRow[];
  quota: ResearchQuota;
}

export type ResearchOutcome =
  | ResearchOk
  | { kind: 'unauthenticated' }
  | { kind: 'not_connected'; source: ResearchSource; message: string }
  | { kind: 'quota_exhausted'; message: string; quota?: ResearchQuota }
  | { kind: 'failed'; message: string };

/**
 * El nombre que se pinta en pantalla: el dato, no de dónde sale.
 *
 * El equipo sí ve los nombres reales, en el panel de Integraciones del
 * dashboard, que sólo carga para un vendedor.
 */
export const SOURCE_LABEL: Record<ResearchSource, string> = {
  tiktok: 'TikTok Shop',
  aduanas: 'Comercio exterior',
};

export const SOURCE_BLURB: Record<ResearchSource, { es: string; en: string }> = {
  tiktok: {
    es: 'productos, ventas y competencia en TikTok Shop',
    en: 'products, sales and competition on TikTok Shop',
  },
  aduanas: {
    es: 'importaciones y exportaciones reales por país y producto',
    en: 'real import and export records by country and product',
  },
};

export async function fetchQuota(token: string | null): Promise<ResearchQuota | null> {
  if (!token) return null;
  try {
    const res = await fetch('/api/research/quota', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()) as ResearchQuota;
  } catch {
    return null;
  }
}

export async function runResearch(
  token: string | null,
  source: ResearchSource,
  query: string,
  country?: string
): Promise<ResearchOutcome> {
  if (!token) return { kind: 'unauthenticated' };

  try {
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source, query, ...(country ? { country } : {}) }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) return { kind: 'unauthenticated' };
    if (res.status === 503 && data.error === 'source_not_connected') {
      return { kind: 'not_connected', source, message: data.message ?? '' };
    }
    if (res.status === 402) {
      return { kind: 'quota_exhausted', message: data.message ?? '', quota: data.quota };
    }
    if (!res.ok) return { kind: 'failed', message: data.message ?? 'No pudimos completar la consulta.' };

    return {
      kind: 'ok',
      source,
      billed: data.billed,
      summary: data.result?.summary ?? '',
      rows: (data.result?.rows ?? []) as ResearchRow[],
      quota: data.quota as ResearchQuota,
    };
  } catch {
    return { kind: 'failed', message: 'No hubo conexión con el servidor.' };
  }
}

/** Renders a result as chat text — no numbers are added here. */
export function formatResult(result: ResearchOk, language: 'es' | 'en'): string {
  const head = result.summary;
  if (!result.rows.length) {
    return language === 'es'
      ? `${head}\nProbá con otra palabra o con el nombre en inglés.`
      : `${head}\nTry another term, or the English name.`;
  }
  const body = result.rows.map((r) => `• ${r.label} — ${r.value}`).join('\n');
  const left =
    result.quota.freeRemaining > 0
      ? language === 'es'
        ? `Te quedan ${result.quota.freeRemaining} consultas gratis hoy.`
        : `${result.quota.freeRemaining} free lookups left today.`
      : language === 'es'
        ? `Usaste un crédito. Te quedan ${result.quota.credits}.`
        : `Used a credit. ${result.quota.credits} left.`;
  return `${head}\n${body}\n\n${left}`;
}
