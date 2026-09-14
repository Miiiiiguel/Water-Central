// Marco Polo's research desk (client side).
//
// The server owns the quota: these helpers only call it and render what
// comes back. Every failure mode is explicit so the chat can say the
// truth — "not connected yet", "out of lookups", "the source failed" —
// instead of showing invented numbers.

export type ResearchSource = 'kalodata' | 'sicex';

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

export const SOURCE_LABEL: Record<ResearchSource, string> = {
  kalodata: 'Kalodata',
  sicex: 'Sicex',
};

export const SOURCE_BLURB: Record<ResearchSource, { es: string; en: string }> = {
  kalodata: {
    es: 'productos, ventas y competencia en TikTok Shop',
    en: 'products, sales and competition on TikTok Shop',
  },
  sicex: {
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
