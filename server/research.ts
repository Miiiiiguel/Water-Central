import express from 'express';
import { z } from 'zod';
import { apiRateLimiter, makeLimiter, JSON_BODY_LIMIT } from './security';
import { requireUser } from './auth';
import { getSupabaseAdmin } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import { runAmazon, runKalodata, runSicex, isConfigured, type ResearchResult } from './connectors';
import { CATALOG } from './catalog';

// Marco Polo's research desk.
//
// The chatbot can look up real demand/competition data in Kalodata
// (TikTok Shop analytics) and Sicex (import/export trade intelligence).
// Every lookup costs one query. Each plan includes a number of free
// queries per day; past that the user spends credits bought with Stripe.
//
// Two rules this file exists to enforce:
//   1. Quota is counted and spent ON THE SERVER, inside one atomic SQL
//      function. A client can never grant itself queries.
//   2. If a provider is not configured (no API key), the request is
//      refused and NO quota is consumed — we never invent numbers to
//      look like the integration works.

/** Los proveedores reales. Este nombre no sale del servidor. */
export const RESEARCH_SOURCES = ['kalodata', 'sicex', 'junglescout'] as const;
export type ResearchSource = (typeof RESEARCH_SOURCES)[number];

/**
 * Cómo se llaman esas fuentes en la API pública.
 *
 * El navegador pide `{"source":"tiktok"}`, no `{"source":"kalodata"}`.
 * No es cosmética: quien abra la pestaña de red del navegador y lea el
 * nombre del proveedor tiene a un clic el contratarlo directo, y ahí se
 * acabó la razón por la que nos paga. El nombre del proveedor no cruza
 * la frontera del servidor — ni en la petición, ni en la respuesta, ni
 * en un mensaje de error.
 */
export const PUBLIC_SOURCES = ['tiktok', 'aduanas', 'amazon'] as const;
export type PublicSource = (typeof PUBLIC_SOURCES)[number];

const PROVIDER_OF: Record<PublicSource, ResearchSource> = {
  tiktok: 'kalodata',
  aduanas: 'sicex',
  amazon: 'junglescout',
};

/**
 * Normaliza lo que llegue. Acepta también los ids viejos: una pestaña
 * abierta desde antes del cambio sigue funcionando en vez de romperse
 * con un 400 que nadie sabría explicar.
 */
export function toPublicSource(value: string): PublicSource | null {
  if (value === 'tiktok' || value === 'aduanas' || value === 'amazon') return value;
  if (value === 'junglescout') return 'amazon';
  if (value === 'kalodata') return 'tiktok';
  if (value === 'sicex') return 'aduanas';
  return null;
}

// Free lookups per day, by the plan the user has actually paid for.
// 'free' is any registered user without a paid plan.
export const DAILY_QUOTA: Record<string, number> = {
  free: 2,
  diagnostico_madurez: 5,
  analisis_mercado: 25,
  acompanamiento: 100,
};

// Cuántas consultas trae el paquete lo decide el catálogo, que es
// también quien le pone precio y quien se lo dice a Marco Polo.
export const CREDIT_PACK = {
  plan: 'creditos_marco_polo' as const,
  credits: CATALOG.creditos_marco_polo.grants!.researchCredits,
};

const bodySchema = z.object({
  source: z.enum(['tiktok', 'aduanas', 'amazon', 'kalodata', 'sicex', 'junglescout']),
  // Vacío es válido a propósito: "qué se vende más en TikTok Shop" no
  // tiene término de búsqueda, es el ranking de arriba, y las fuentes
  // aceptan una consulta sin palabra clave. Lo que se rechaza es una
  // sola letra, que nunca es una búsqueda de verdad.
  query: z.string().trim().max(160).refine((v) => v.length !== 1, 'consulta muy corta'),
  country: z.string().trim().max(60).optional(),
  // Qué se pregunta dentro de TikTok Shop. Sin esto, "los creadores que
  // más venden shampoo" se contestaba con el ranking de productos.
  kind: z.enum(['product', 'creator', 'shop', 'video', 'livestream']).optional(),
});

// Tighter than the general API limit: each call hits a paid third-party
// API, so a loop here costs real money.
const researchRateLimiter = makeLimiter('research', 30);

export const researchRouter = express.Router();

/** The plan a user currently holds, best first. */
export async function getUserPlan(userId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  if (!admin) return 'free';

  // An active subscription outranks a one-off purchase.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .maybeSingle();
  if (sub?.plan && DAILY_QUOTA[sub.plan as string] !== undefined) return sub.plan as string;

  const { data: payments } = await admin
    .from('payments')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'paid');

  let best = 'free';
  for (const row of payments ?? []) {
    const plan = (row as { plan: string }).plan;
    if ((DAILY_QUOTA[plan] ?? 0) > (DAILY_QUOTA[best] ?? 0)) best = plan;
  }
  return best;
}

/** Suma meses de calendario, como `make_interval(months => n)` en la base. */
export function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

/** El mes del plan en curso: desde cuándo cuentan los tokens de este mes. */
export function inicioDelMes(inicio: Date, ahora: Date): Date {
  let meses = (ahora.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (ahora.getUTCMonth() - inicio.getUTCMonth());
  if (sumarMeses(inicio, meses) > ahora) meses -= 1;
  return sumarMeses(inicio, Math.max(0, meses));
}

/**
 * Lo que queda este mes en los planes activos. Es para mostrarlo: quien
 * decide de verdad es spend_research_quota, en la base, en una sola
 * transacción.
 */
async function tokensDePlanes(userId: string, ahora = new Date()): Promise<{ restantes: number; terminaEl: string | null }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { restantes: 0, terminaEl: null };
  const { data, error } = await admin
    .from('token_plans')
    .select('id, monthly_tokens, starts_at, ends_at')
    .eq('user_id', userId)
    .lte('starts_at', ahora.toISOString())
    .gt('ends_at', ahora.toISOString())
    .order('ends_at', { ascending: true });
  // Sin la tabla (falta correr schema.sql) no hay planes: no es un error.
  if (error || !data?.length) return { restantes: 0, terminaEl: null };

  let restantes = 0;
  for (const p of data as Array<{ id: string; monthly_tokens: number; starts_at: string; ends_at: string }>) {
    const desde = inicioDelMes(new Date(p.starts_at), ahora);
    const { count } = await admin
      .from('research_usage')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', p.id)
      .gte('created_at', desde.toISOString());
    restantes += Math.max(0, p.monthly_tokens - (count ?? 0));
  }
  return { restantes, terminaEl: (data[0] as { ends_at: string }).ends_at };
}

export type Cobro = { ok: true; billed: string } | { ok: false; motivo: 'sin_saldo' | 'sin_base' | 'error'; dailyLimit: number };

/**
 * Cobra una consulta (búsqueda o lectura de etiqueta): la gratis del día,
 * un token del plan del mes o un token de paquete, en ese orden. Es una
 * sola función en la base, así dos pedidos a la vez no gastan el mismo
 * token.
 */
export async function cobrarConsulta(userId: string, fuente: string, texto: string): Promise<Cobro> {
  const admin = getSupabaseAdmin();
  const plan = await getUserPlan(userId);
  const dailyLimit = DAILY_QUOTA[plan] ?? DAILY_QUOTA.free;
  if (!admin) return { ok: false, motivo: 'sin_base', dailyLimit };
  const { data, error } = await admin.rpc('spend_research_quota', {
    p_user_id: userId,
    p_daily_limit: dailyLimit,
    p_source: fuente,
    p_query: texto.slice(0, 160),
  });
  if (error) {
    console.error('spend_research_quota failed:', error.message);
    return { ok: false, motivo: 'error', dailyLimit };
  }
  const billed = (data as string | null) ?? 'blocked';
  if (billed === 'blocked') return { ok: false, motivo: 'sin_saldo', dailyLimit };
  return { ok: true, billed };
}

/** Devuelve lo cobrado cuando la falla no fue de quien pidió. */
export async function devolverConsulta(userId: string, billed: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.rpc('refund_research_quota', { p_user_id: userId, p_billed: billed });
}

type QuotaView = {
  plan: string;
  dailyLimit: number;
  usedToday: number;
  freeRemaining: number;
  credits: number;
  /** Tokens que le quedan este mes en sus planes activos. */
  planTokens: number;
  /** Cuándo termina el plan que vence primero. */
  planEndsAt: string | null;
  canQuery: boolean;
  sources: Record<PublicSource, boolean>;
};

async function getQuota(userId: string): Promise<QuotaView> {
  const admin = getSupabaseAdmin();
  const plan = await getUserPlan(userId);
  const dailyLimit = DAILY_QUOTA[plan] ?? DAILY_QUOTA.free;

  let usedToday = 0;
  let credits = 0;
  let planTokens = 0;
  let planEndsAt: string | null = null;
  if (admin) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from('research_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('billed', 'free')
      .gte('created_at', since.toISOString());
    usedToday = count ?? 0;

    const { data } = await admin.from('research_credits').select('credits').eq('user_id', userId).maybeSingle();
    credits = (data?.credits as number | undefined) ?? 0;

    const planes = await tokensDePlanes(userId);
    planTokens = planes.restantes;
    planEndsAt = planes.terminaEl;
  }

  const freeRemaining = Math.max(0, dailyLimit - usedToday);
  return {
    plan,
    dailyLimit,
    usedToday,
    freeRemaining,
    credits,
    planTokens,
    planEndsAt,
    canQuery: freeRemaining > 0 || credits > 0 || planTokens > 0,
    sources: {
      tiktok: isConfigured('kalodata'),
      aduanas: isConfigured('sicex'),
      amazon: isConfigured('junglescout'),
    },
  };
}

/**
 * Qué fuentes están conectadas. Sin sesión, y sin nombrar a nadie.
 *
 * Existe para que la página /estado pueda contestar sola la pregunta
 * "pregunto y no responde": si la fuente no está conectada, eso se ve en
 * un renglón en vez de terminar en un mensaje genérico dentro del chat.
 * Lo que sale es un sí/no por fuente pública —los nombres de proveedor y
 * las variables que faltan siguen siendo cosa del panel del equipo.
 */
researchRouter.get('/research/status', apiRateLimiter, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    sources: {
      tiktok: isConfigured('kalodata'),
      aduanas: isConfigured('sicex'),
      amazon: isConfigured('junglescout'),
    },
  });
});

// How many lookups are left today, and what the account is entitled to.
researchRouter.get('/research/quota', apiRateLimiter, requireUser(), async (_req, res) => {
  const auth = res.locals.auth!;
  res.json(await getQuota(auth.user.id));
});

researchRouter.post('/research', researchRateLimiter, requireUser(), express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const auth = res.locals.auth!;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    logSecurityEvent('invalid_input', req, { form: 'research' });
    return res.status(400).json({ error: 'invalid_query' });
  }
  const { query, country, kind } = parsed.data;
  const source = toPublicSource(parsed.data.source)!;
  const provider = PROVIDER_OF[source];

  // Refuse before charging anything if the provider is not connected.
  if (!isConfigured(provider)) {
    return res.status(503).json({
      error: 'source_not_connected',
      source,
      // Al cliente no se le nombra al proveedor ni la variable que falta:
      // lo primero le regala la fuente, lo segundo es configuración
      // interna. Lo que sí necesita el equipo está en el panel de
      // Integraciones del dashboard, que sólo ve un vendedor.
      message:
        source === 'tiktok'
          ? 'La inteligencia de TikTok Shop todavía no está disponible. Escríbenos y la activamos para tu cuenta.'
          : source === 'amazon'
            ? 'La inteligencia de Amazon todavía no está disponible. Escríbenos y la activamos para tu cuenta.'
            : 'Los datos de comercio exterior todavía no están disponibles. Escríbenos y los activamos para tu cuenta.',
    });
  }

  const cobro = await cobrarConsulta(auth.user.id, provider, query);
  if (!cobro.ok) {
    if (cobro.motivo === 'sin_base') return res.status(503).json({ error: 'database_not_configured' });
    if (cobro.motivo === 'error') return res.status(500).json({ error: 'quota_check_failed' });
    const quota = await getQuota(auth.user.id);
    return res.status(402).json({
      error: 'quota_exhausted',
      quota,
      creditPack: CREDIT_PACK,
      message: `Se te acabaron las ${cobro.dailyLimit} consultas gratis de hoy. Cada consulta extra usa un token: los venden en paquetes desde 10 tokens, o podés esperar a mañana.`,
    });
  }
  const billed = cobro.billed;

  let result: ResearchResult;
  try {
    result =
      provider === 'kalodata' ? await runKalodata(query, country, kind)
      : provider === 'junglescout' ? await runAmazon(query, country)
      : await runSicex(query, country);
  } catch (err) {
    // The lookup failed through no fault of the user: give the query back.
    await devolverConsulta(auth.user.id, billed);
    // En el log del servidor sí va el nombre real: es quien falló.
    console.error(`${provider} lookup failed:`, (err as Error).message);
    return res.status(502).json({ error: 'source_failed', source, message: 'La fuente no respondió. No te descontamos la consulta.' });
  }

  const quota = await getQuota(auth.user.id);
  // `sourceUrl` apunta al endpoint del proveedor. Aunque hoy no se pinte
  // en pantalla, viaja en el JSON y cualquiera lo ve abriendo las
  // herramientas del navegador — es regalar de dónde salen los datos.
  const { sourceUrl: _oculto, ...publico } = result as typeof result & { sourceUrl?: string };
  res.json({ source, query, country: country ?? null, billed, result: publico, quota });
});
