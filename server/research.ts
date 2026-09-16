import express from 'express';
import { z } from 'zod';
import { apiRateLimiter, makeLimiter, JSON_BODY_LIMIT } from './security';
import { requireUser } from './auth';
import { getSupabaseAdmin } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import { runKalodata, runSicex, isConfigured, missingConfig, type ResearchResult } from './connectors';
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

export const RESEARCH_SOURCES = ['kalodata', 'sicex'] as const;
export type ResearchSource = (typeof RESEARCH_SOURCES)[number];

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
  source: z.enum(RESEARCH_SOURCES),
  query: z.string().trim().min(2).max(160),
  country: z.string().trim().max(60).optional(),
});

// Tighter than the general API limit: each call hits a paid third-party
// API, so a loop here costs real money.
const researchRateLimiter = makeLimiter('research', 30);

export const researchRouter = express.Router();

/** The plan a user currently holds, best first. */
async function getUserPlan(userId: string): Promise<string> {
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

type QuotaView = {
  plan: string;
  dailyLimit: number;
  usedToday: number;
  freeRemaining: number;
  credits: number;
  canQuery: boolean;
  sources: Record<ResearchSource, boolean>;
};

async function getQuota(userId: string): Promise<QuotaView> {
  const admin = getSupabaseAdmin();
  const plan = await getUserPlan(userId);
  const dailyLimit = DAILY_QUOTA[plan] ?? DAILY_QUOTA.free;

  let usedToday = 0;
  let credits = 0;
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
  }

  const freeRemaining = Math.max(0, dailyLimit - usedToday);
  return {
    plan,
    dailyLimit,
    usedToday,
    freeRemaining,
    credits,
    canQuery: freeRemaining > 0 || credits > 0,
    sources: {
      kalodata: isConfigured('kalodata'),
      sicex: isConfigured('sicex'),
    },
  };
}

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
  const { source, query, country } = parsed.data;

  // Refuse before charging anything if the provider is not connected.
  if (!isConfigured(source)) {
    return res.status(503).json({
      error: 'source_not_connected',
      source,
      missing: missingConfig(source),
      // Al cliente no se le nombra al proveedor ni la variable que falta:
      // lo primero le regala la fuente, lo segundo es configuración
      // interna. Lo que sí necesita el equipo está en el panel de
      // Integraciones del dashboard, que sólo ve un vendedor.
      message:
        source === 'kalodata'
          ? 'La inteligencia de TikTok Shop todavía no está disponible. Escríbenos y la activamos para tu cuenta.'
          : 'Los datos de comercio exterior todavía no están disponibles. Escríbenos y los activamos para tu cuenta.',
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'database_not_configured' });

  const plan = await getUserPlan(auth.user.id);
  const dailyLimit = DAILY_QUOTA[plan] ?? DAILY_QUOTA.free;

  // One atomic SQL function decides free-vs-credit and records the use,
  // so two parallel requests can never both take the last free query.
  const { data: spend, error: spendError } = await admin.rpc('spend_research_quota', {
    p_user_id: auth.user.id,
    p_daily_limit: dailyLimit,
    p_source: source,
    p_query: query.slice(0, 160),
  });

  if (spendError) {
    console.error('spend_research_quota failed:', spendError.message);
    return res.status(500).json({ error: 'quota_check_failed' });
  }

  const billed = (spend as string | null) ?? 'blocked';
  if (billed === 'blocked') {
    const quota = await getQuota(auth.user.id);
    return res.status(402).json({
      error: 'quota_exhausted',
      quota,
      creditPack: CREDIT_PACK,
      message: `Se te acabaron las ${dailyLimit} consultas gratis de hoy. Podés comprar un paquete de ${CREDIT_PACK.credits} consultas o esperar a mañana.`,
    });
  }

  let result: ResearchResult;
  try {
    result = source === 'kalodata' ? await runKalodata(query, country) : await runSicex(query, country);
  } catch (err) {
    // The lookup failed through no fault of the user: give the query back.
    await admin.rpc('refund_research_quota', { p_user_id: auth.user.id, p_billed: billed });
    console.error(`${source} lookup failed:`, (err as Error).message);
    return res.status(502).json({ error: 'source_failed', source, message: 'La fuente no respondió. No te descontamos la consulta.' });
  }

  const quota = await getQuota(auth.user.id);
  // `sourceUrl` apunta al endpoint del proveedor. Aunque hoy no se pinte
  // en pantalla, viaja en el JSON y cualquiera lo ve abriendo las
  // herramientas del navegador — es regalar de dónde salen los datos.
  const { sourceUrl: _oculto, ...publico } = result as typeof result & { sourceUrl?: string };
  res.json({ source, query, country: country ?? null, billed, result: publico, quota });
});
