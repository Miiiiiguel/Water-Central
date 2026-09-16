import express from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { checkoutRateLimiter, apiRateLimiter, JSON_BODY_LIMIT } from './security';
import { getSupabaseAdmin, getUserFromRequest } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import { captureException } from './monitoring';
import { CATALOG, PLAN_IDS, priceOf, type PlanId } from './catalog';
import {
  checkoutUrl, fetchTransaction, integritySignature, transactionPaysFor, verifyEventChecksum,
  wompiConfigured, wompiEnv, type WompiEvent, type WompiTransaction,
} from './wompi';
import { stripeCheckoutUrl, stripeConfiguredFor } from './stripe';
import { settleDiagnosticTransaction } from './diagnostic';

// Una sola puerta de cobro para todo lo que se vende.
//
// Antes cada botón de pago iba directo a Stripe. En Render no hay una
// sola variable STRIPE_*, así que todos esos botones contestaban 503 y
// el cliente veía "no pude abrir el pago" — con las llaves de Wompi
// puestas y funcionando al lado, cobrando el diagnóstico sin problema.
// Un negocio colombiano no puede quedarse sin cobrar porque falte la
// pasarela del otro hemisferio.
//
// Ahora el servidor elige: Stripe si está configurado para ese plan,
// Wompi si no. El navegador pide /api/checkout y recibe una URL; le da
// igual quién cobra.
//
// Wompi se usa por su Web Checkout (una URL con firma), no por el widget
// JavaScript: así el pago es un redirect normal, funciona igual en el
// navegador del sistema de la app nativa, y no hay un script de terceros
// más en la página.

const REF_RE = /^ecp_[a-f0-9]{32}$/;
const newRef = () => `ecp_${randomBytes(16).toString('hex')}`;

/** El id de orden que guardamos en payments.stripe_session_id. */
const orderId = (ref: string) => `wompi_${ref}`;

const bodySchema = z.object({
  plan: z.enum(PLAN_IDS),
  platform: z.enum(['web', 'native']).default('web'),
});

export const checkoutRouter = express.Router();

// ---------------------------------------------------------------------
// GET /api/checkout/catalog — qué se puede comprar y con qué pasarela.
//
// El front lo usa para no mostrar un botón de pago que no puede cobrar:
// si nada está configurado, el plan lleva a hablar con el equipo en vez
// de a una pantalla de error.
// ---------------------------------------------------------------------
checkoutRouter.get('/checkout/catalog', apiRateLimiter, (_req, res) => {
  const wompi = wompiConfigured();
  const items = (Object.keys(CATALOG) as PlanId[]).map((plan) => {
    const price = priceOf(plan);
    const gateway = stripeConfiguredFor(plan) ? 'stripe' : price && wompi ? 'wompi' : null;
    return {
      plan,
      label: CATALOG[plan].label,
      labelEn: CATALOG[plan].labelEn,
      amountInCents: price?.amountInCents ?? null,
      currency: price?.currency ?? null,
      displayCop: price?.displayCop ?? null,
      displayUsd: price?.displayUsd ?? null,
      gateway,
      payable: gateway !== null,
    };
  });
  res.json({ items, wompiEnv: wompi ? wompiEnv() : null });
});

// ---------------------------------------------------------------------
// POST /api/checkout — { plan, platform } -> { url, gateway }
// ---------------------------------------------------------------------
checkoutRouter.post('/checkout', checkoutRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    logSecurityEvent('invalid_input', req, { form: 'checkout' });
    return res.status(400).json({ error: 'plan_invalido' });
  }
  const plan = parsed.data.plan as PlanId;
  const native = parsed.data.platform === 'native';
  const appUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;

  // Stripe primero si está configurado para este plan: quien ya lo tenga
  // andando no pierde recibos, portal de facturación ni suscripciones.
  if (stripeConfiguredFor(plan)) {
    try {
      const url = await stripeCheckoutUrl(req, plan, native, appUrl);
      if (url) return res.json({ url, gateway: 'stripe' });
    } catch (err) {
      captureException(err, { route: 'checkout.stripe' });
      // No cortamos acá: si Wompi puede cobrarlo, que cobre.
    }
  }

  const price = priceOf(plan);
  if (!price) {
    // Plan a medida (o sin precio configurado): no se cobra de un botón.
    return res.status(409).json({ error: 'plan_a_medida', plan });
  }
  if (!wompiConfigured()) {
    return res.status(503).json({
      error: 'sin_pasarela',
      message: 'No hay pasarela de pago configurada (faltan las llaves de Wompi o de Stripe).',
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    // Sin service-role no podemos dejar constancia de la orden, y cobrar
    // sin poder registrar quién pagó qué es peor que no cobrar.
    return res.status(503).json({
      error: 'sin_registro',
      message: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: sin eso no podemos registrar la compra.',
    });
  }

  const user = await getUserFromRequest(req);

  // Lo que se entrega a una cuenta exige una cuenta.
  //
  // El paquete de consultas de Marco Polo se acredita contra un user_id.
  // Sin sesión, la compra cobraba y no acreditaba nada: dinero recibido,
  // nada entregado, y la persona sin forma de reclamarlo. Antes de
  // cobrar, se pide entrar.
  if (CATALOG[plan].grants && !user) {
    return res.status(401).json({
      error: 'requiere_cuenta',
      message: 'Entrá a tu cuenta antes de comprar: las consultas se acreditan a tu usuario.',
    });
  }

  const ref = newRef();

  const { error } = await admin.from('payments').insert({
    stripe_session_id: orderId(ref),
    user_id: user?.id ?? null,
    email: user?.email ?? null,
    plan,
    amount_cents: price.amountInCents,
    currency: price.currency,
    status: 'pending',
  });
  if (error) {
    console.error('[checkout] no se pudo crear la orden:', error.message);
    return res.status(500).json({ error: 'orden_fallida' });
  }

  const signature = integritySignature(ref, price.amountInCents, price.currency, process.env.WOMPI_INTEGRITY_SECRET!);
  const redirect = `${appUrl}/pago/exito${native ? '?native=1' : ''}`;

  const url = checkoutUrl({
    publicKey: process.env.WOMPI_PUBLIC_KEY!,
    reference: ref,
    amountInCents: price.amountInCents,
    currency: price.currency,
    signature,
    redirectUrl: redirect,
    email: user?.email ?? null,
  });

  res.json({ url, gateway: 'wompi', reference: ref });
});

// ---------------------------------------------------------------------
// POST /api/checkout/confirm — { transactionId } -> estado real
//
// Wompi devuelve al comprador con ?id=<transacción>. Esa vuelta es una
// pista, no una prueba: acá se lee la transacción desde la API de Wompi
// y se compara referencia, monto y moneda antes de dar nada por pagado.
// ---------------------------------------------------------------------
const txSchema = z.string().regex(/^[A-Za-z0-9_-]{6,80}$/);

checkoutRouter.post('/checkout/confirm', checkoutRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const txId = txSchema.safeParse(req.body?.transactionId);
  if (!txId.success) return res.status(400).json({ error: 'transaccion_invalida' });

  try {
    const tx = await fetchTransaction(txId.data);
    if (!tx || !REF_RE.test(String(tx.reference ?? ''))) {
      return res.status(404).json({ error: 'no_encontrada' });
    }
    const settled = await settle(tx, req);
    return res.json(settled);
  } catch (err) {
    captureException(err, { route: 'checkout.confirm' });
    return res.status(502).json({ error: 'wompi_no_responde' });
  }
});

// ---------------------------------------------------------------------
// El evento firmado de Wompi. UNA sola puerta.
//
// Wompi acepta una sola URL de eventos por comercio. Por eso entra todo
// acá y se reparte según el prefijo de la referencia: ecx_ es un
// diagnóstico de madurez, ecp_ es cualquier otra compra. Están montadas
// las tres rutas (la corta y las dos viejas) para que siga funcionando
// la que ya esté escrita en el panel de Wompi, sin tocar nada allá.
//
// Es el camino autoritativo: vale aunque el comprador cierre la pestaña
// antes de volver.
// ---------------------------------------------------------------------
async function wompiEvents(req: express.Request, res: express.Response) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return res.status(503).json({ error: 'not_configured' });

  const event = req.body as WompiEvent;
  if (!event?.signature?.checksum || !Array.isArray(event.signature.properties) || !event.data) {
    return res.status(400).json({ error: 'bad_event' });
  }
  if (!verifyEventChecksum(event, secret)) {
    logSecurityEvent('webhook_signature_failed', req, { source: 'wompi' });
    return res.status(401).json({ error: 'bad_signature' });
  }

  const tx = event.data.transaction;
  const ref = String(tx?.reference ?? '');

  // 200 en todo lo demás: Wompi reintenta cualquier otra respuesta, y no
  // hay nada que reintentar con una referencia que no es nuestra.
  if (event.event === 'transaction.updated' && tx) {
    try {
      if (REF_RE.test(ref)) await settle(tx as WompiTransaction, req);
      else if (/^ecx_[a-f0-9]{32}$/.test(ref)) await settleDiagnosticTransaction(tx, req);
    } catch (err) {
      captureException(err, { route: 'wompi-events' });
    }
  }
  return res.json({ received: true });
}

const eventsJson = express.json({ limit: '64kb' });
checkoutRouter.post('/wompi-events', eventsJson, wompiEvents);
checkoutRouter.post('/checkout/wompi-events', eventsJson, wompiEvents);
checkoutRouter.post('/diagnostic/wompi-events', eventsJson, wompiEvents);

// ---------------------------------------------------------------------
// El corazón: pasar una orden a pagada, una sola vez.
// ---------------------------------------------------------------------
interface OrderRow {
  id: string;
  user_id: string | null;
  email: string | null;
  plan: string;
  amount_cents: number;
  currency: string;
  status: string;
}

async function settle(tx: Partial<WompiTransaction>, req: express.Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return { paid: false, error: 'sin_registro' as const };

  const ref = String(tx.reference);
  const { data } = await admin.from('payments').select('*').eq('stripe_session_id', orderId(ref)).maybeSingle();
  const order = data as OrderRow | null;
  if (!order) return { paid: false, error: 'no_encontrada' as const };

  const view = (status: string) => ({
    paid: status === 'paid',
    status,
    plan: order.plan,
    planLabel: order.plan in CATALOG ? CATALOG[order.plan as PlanId].label : order.plan,
    amountCents: order.amount_cents,
    currency: order.currency,
  });

  if (order.status === 'paid') return view('paid');

  const paysForIt = transactionPaysFor(tx, {
    reference: ref,
    amountInCents: order.amount_cents,
    currency: order.currency,
  });

  if (!paysForIt) {
    if (tx.status === 'APPROVED') {
      // Aprobada, pero por otra cosa: monto distinto, moneda distinta.
      // Eso no paga esta orden, y queda anotado.
      logSecurityEvent('forbidden', req, { route: 'checkout.settle', reason: 'transaction_mismatch', ref, tx: tx.id });
    }
    const failed = tx.status === 'DECLINED' || tx.status === 'ERROR' || tx.status === 'VOIDED';
    if (failed) await admin.from('payments').update({ status: 'failed' }).eq('id', order.id).eq('status', 'pending');
    return view(failed ? 'failed' : 'pending');
  }

  // `.eq('status','pending')` + `.select()`: sólo una de las dos vías
  // (la vuelta del navegador y el webhook) marca la orden, y sólo esa
  // entrega los créditos. Sin eso, pagar una vez daría dos paquetes.
  const { data: updated } = await admin
    .from('payments')
    .update({ status: 'paid', stripe_payment_intent: tx.id ?? null })
    .eq('id', order.id)
    .eq('status', 'pending')
    .select('*');

  const flipped = (updated as OrderRow[] | null)?.[0];
  if (flipped) await grantEntitlements(flipped);

  return view('paid');
}

async function grantEntitlements(order: OrderRow) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const item = order.plan in CATALOG ? CATALOG[order.plan as PlanId] : null;
  if (!item?.grants?.researchCredits || !order.user_id) return;

  const { error } = await admin.rpc('grant_research_credits', {
    p_user_id: order.user_id,
    p_credits: item.grants.researchCredits,
  });
  if (error) console.error('[checkout] no se pudieron acreditar las consultas:', error.message);
}
