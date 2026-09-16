import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { checkoutRateLimiter, apiRateLimiter, JSON_BODY_LIMIT } from './security';
import { getSupabaseAdmin, getUserFromRequest } from './supabaseAdmin';
import { requireUser } from './auth';
import { logSecurityEvent } from './log';
import { CREDIT_PACK } from './research';

// Server-side Stripe integration.
//
// Required env vars (never commit real values, see .env.example):
//   STRIPE_SECRET_KEY                 sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET              whsec_... (from the Stripe CLI or
//                                       the webhook endpoint you create in
//                                       the Stripe dashboard)
//   STRIPE_PRICE_DIAGNOSTICO_MADUREZ   price_... del diagnóstico si se
//                                      cobrara por Stripe. Hoy va por
//                                      Wompi (USD 9.99 / $39.900 COP).
//   STRIPE_PRICE_ANALISIS_MERCADO      price_... for the USD 499 plan
//   STRIPE_PRICE_ACOMPANAMIENTO        price_... optional recurring plan
//   PUBLIC_APP_URL                     e.g. https://easycomex.com (used to
//                                       build the success/cancel redirect
//                                       URLs)
//   SUPABASE_SERVICE_ROLE_KEY          so the webhook can record the
//                                       payment in public.payments
//
// Flow:
//   1. Browser POSTs /api/create-checkout-session with the plan id and,
//      when logged in, its Supabase JWT. The server verifies the JWT
//      itself — it never trusts a user id sent by the client.
//   2. Stripe hosts the checkout page; the user pays there. Whether that
//      is a one-off payment or a subscription is decided by the *price*
//      configured in Stripe, not by this code (see resolveMode).
//   3. Stripe calls /api/stripe-webhook (signature-verified). The server
//      writes to public.payments / public.subscriptions with the
//      service-role key. Those rows are what the dashboard reads — never
//      the success redirect, which anyone can type into a URL bar.

export const PLANS = {
  diagnostico_madurez: { priceEnv: 'STRIPE_PRICE_DIAGNOSTICO_MADUREZ', label: 'Diagnóstico de madurez' },
  analisis_mercado: { priceEnv: 'STRIPE_PRICE_ANALISIS_MERCADO', label: 'Análisis de mercado y competencia' },
  acompanamiento: { priceEnv: 'STRIPE_PRICE_ACOMPANAMIENTO', label: 'Acompañamiento mensual' },
  // Pack of extra Marco Polo research lookups (Kalodata / Sicex).
  creditos_marco_polo: { priceEnv: 'STRIPE_PRICE_CREDITOS_MARCO_POLO', label: `${CREDIT_PACK.credits} consultas de Marco Polo` },
  // ROI calculator reports (see client/src/pages/RoiCalculator.tsx).
  reporte_detalle: { priceEnv: 'STRIPE_PRICE_REPORTE_DETALLE', label: 'Desglose de costos mes a mes' },
  reporte_pronostico: { priceEnv: 'STRIPE_PRICE_REPORTE_PRONOSTICO', label: 'Pronóstico completo a 2 años' },
} as const;

type PlanId = keyof typeof PLANS;
const PLAN_IDS = Object.keys(PLANS) as [PlanId, ...PlanId[]];

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// ---------------------------------------------------------------------
// Price lookup. Cached for 5 minutes: the checkout page, the pricing
// section and the order summary all ask for the same few prices, and
// Stripe rate-limits (and charges latency for) every call.
// ---------------------------------------------------------------------

type PriceInfo = { id: string; amountCents: number | null; currency: string; interval: string | null; recurring: boolean };
const priceCache = new Map<string, { at: number; info: PriceInfo }>();
const PRICE_TTL_MS = 5 * 60 * 1000;

async function getPriceInfo(stripe: Stripe, priceId: string): Promise<PriceInfo | null> {
  const cached = priceCache.get(priceId);
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached.info;
  try {
    const price = await stripe.prices.retrieve(priceId);
    const info: PriceInfo = {
      id: price.id,
      amountCents: price.unit_amount ?? null,
      currency: price.currency ?? 'usd',
      interval: price.recurring?.interval ?? null,
      recurring: price.type === 'recurring',
    };
    priceCache.set(priceId, { at: Date.now(), info });
    return info;
  } catch (err) {
    console.warn(`Stripe price ${priceId} could not be read:`, (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------
// Stripe Customer per buyer. One customer id, reused across purchases,
// is what makes receipts, refunds, invoices and the billing portal all
// point at the same person.
// ---------------------------------------------------------------------

async function getOrCreateCustomerId(stripe: Stripe, userId: string, email: string | null, name?: string | null): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
    if (data?.stripe_customer_id) return data.stripe_customer_id as string;
  }
  try {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      name: name ?? undefined,
      metadata: { supabase_user_id: userId },
    });
    if (admin) await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);
    return customer.id;
  } catch (err) {
    console.warn('Could not create Stripe customer:', (err as Error).message);
    return null;
  }
}

const checkoutBodySchema = z.object({
  plan: z.enum(PLAN_IDS),
  // The native app opens Checkout in the system browser; its return
  // pages get a flag so they can say "you can go back to the app now".
  platform: z.enum(['web', 'native']).default('web'),
});

export const stripeRouter = express.Router();

// ---------------------------------------------------------------------
// GET /api/plans — the real prices, read from Stripe.
//
// The marketing copy stays in the client (it is more than a number), but
// the amount shown at checkout comes from Stripe so the page can never
// advertise a price different from the one that gets charged. Before the
// keys are connected this answers {configured:false} and the client
// keeps its own copy.
// ---------------------------------------------------------------------
stripeRouter.get('/plans', apiRateLimiter, async (_req, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.json({ configured: false, plans: [] });

  const plans = await Promise.all(
    (Object.keys(PLANS) as PlanId[]).map(async (id) => {
      const priceId = process.env[PLANS[id].priceEnv];
      if (!priceId) return null;
      const info = await getPriceInfo(stripe, priceId);
      if (!info) return null;
      return { id, label: PLANS[id].label, amountCents: info.amountCents, currency: info.currency, interval: info.interval };
    })
  );

  res.json({ configured: true, plans: plans.filter(Boolean) });
});

stripeRouter.post('/create-checkout-session', checkoutRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe no está configurado en el servidor (falta STRIPE_SECRET_KEY).' });
  }

  const parsed = checkoutBodySchema.safeParse(req.body);
  if (!parsed.success) {
    logSecurityEvent('invalid_input', req, { form: 'checkout' });
    return res.status(400).json({ error: 'Plan inválido.' });
  }
  const plan = parsed.data.plan as PlanId;

  const priceId = process.env[PLANS[plan].priceEnv];
  if (!priceId) {
    return res.status(400).json({ error: `Plan sin price ID configurado: ${plan}` });
  }

  const appUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
  const user = await getUserFromRequest(req);
  const native = parsed.data.platform === 'native' ? '&native=1' : '';

  try {
    // A recurring price must be checked out in 'subscription' mode and a
    // one-off price in 'payment' mode. Deriving it from the price means
    // you can switch a plan to monthly in the Stripe dashboard without
    // touching this code.
    const info = await getPriceInfo(stripe, priceId);
    const mode: Stripe.Checkout.SessionCreateParams.Mode = info?.recurring ? 'subscription' : 'payment';

    // Reuse the buyer's Stripe customer when we know who they are, so
    // their invoices and subscriptions live under one record.
    const customerId = user ? await getOrCreateCustomerId(stripe, user.id, user.email ?? null, (user.user_metadata as any)?.full_name ?? null) : null;

    const metadata = { plan, user_id: user?.id ?? '' };

    const session = await stripe.checkout.sessions.create(
      {
        mode,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/pago/exito?session_id={CHECKOUT_SESSION_ID}${native}`,
        cancel_url: `${appUrl}/pago/cancelado?x=1${native}`,
        ...(customerId ? { customer: customerId } : user?.email ? { customer_email: user.email } : { customer_creation: 'always' as const }),
        ...(user ? { client_reference_id: user.id } : {}),
        metadata,
        // Carry the same metadata onto the object the webhook sees for
        // refunds (payment) and renewals (subscription).
        ...(mode === 'payment' ? { payment_intent_data: { metadata } } : { subscription_data: { metadata } }),
        // Checkout page in the buyer's language; Apple Pay / Google Pay
        // appear automatically once enabled in the Stripe dashboard.
        locale: 'auto',
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      },
      {
        // A double-tap on a slow phone must not create two sessions (and
        // two chances to be charged). Same user + plan within the same
        // minute returns the session already created.
        idempotencyKey: `co:${user?.id ?? req.ip}:${plan}:${Math.floor(Date.now() / 60000)}`,
      }
    );
    res.json({ url: session.url, mode });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: 'No se pudo crear la sesión de pago.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/checkout-session/:id — did this payment actually go through?
//
// The success page used to just say "thanks" to anyone who opened the
// URL. Now it asks Stripe. Only non-sensitive fields are returned, and
// the id is an unguessable Stripe session id (cs_...).
// ---------------------------------------------------------------------
stripeRouter.get('/checkout-session/:id', apiRateLimiter, async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.status(503).json({ error: 'stripe_not_configured' });

  const id = req.params.id;
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) {
    logSecurityEvent('invalid_input', req, { form: 'checkout_session_lookup' });
    return res.status(400).json({ error: 'invalid_session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const plan = (session.metadata?.plan as string | undefined) ?? null;
    // 'paid' | 'unpaid' | 'no_payment_required'; async methods (OXXO,
    // bank debit) sit at 'unpaid' until the funds clear.
    res.json({
      status: session.payment_status,
      paid: session.payment_status === 'paid',
      plan,
      planLabel: plan && plan in PLANS ? PLANS[plan as PlanId].label : null,
      amountCents: session.amount_total ?? null,
      currency: session.currency ?? null,
    });
  } catch {
    res.status(404).json({ error: 'session_not_found' });
  }
});

// ---------------------------------------------------------------------
// POST /api/billing-portal — Stripe's own billing portal.
//
// Invoices, payment method, and cancelling a subscription: all handled
// by Stripe's hosted page, so none of that lives (or can leak) here.
// ---------------------------------------------------------------------
stripeRouter.post('/billing-portal', checkoutRateLimiter, requireUser(), express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.status(503).json({ error: 'Stripe no está configurado.' });

  const auth = res.locals.auth!;
  const admin = getSupabaseAdmin();
  let customerId: string | null = null;
  if (admin) {
    const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', auth.user.id).maybeSingle();
    customerId = (data?.stripe_customer_id as string | undefined) ?? null;
  }
  if (!customerId) return res.status(404).json({ error: 'no_customer', message: 'Todavía no hay compras asociadas a esta cuenta.' });

  const appUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl}/dashboard` });
    res.json({ url: portal.url });
  } catch (err) {
    // The portal needs to be activated once in the Stripe dashboard
    // (Settings → Billing → Customer portal). Say so instead of a 500.
    console.error('Stripe billing portal error:', (err as Error).message);
    res.status(503).json({ error: 'portal_unavailable', message: 'Activá el portal de facturación en Stripe → Settings → Billing → Customer portal.' });
  }
});

// Stripe requires the *raw* request body to verify the webhook signature,
// so this route must NOT go through express.json() — it's mounted with
// express.raw() here instead.
stripeRouter.post('/stripe-webhook', express.raw({ type: 'application/json', limit: '64kb' }), async (req, res) => {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return res.status(503).send('Stripe webhook not configured.');
  }

  let event: Stripe.Event;
  try {
    const signature = req.headers['stripe-signature'] as string;
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    logSecurityEvent('webhook_signature_failed', req, { webhook: 'stripe' });
    return res.status(400).send('Webhook signature verification failed.');
  }

  // Stripe retries an event until it gets a 2xx, and can deliver the same
  // event more than once anyway. Record the id first: if it was already
  // handled, acknowledge and do nothing.
  if (await alreadyProcessed(event)) return res.json({ received: true, duplicate: true });

  try {
    await handleEvent(stripe, event);
  } catch (err) {
    console.error(`Stripe webhook ${event.type} failed:`, (err as Error).message);
    // 500 asks Stripe to retry; the event row is removed so the retry is
    // not rejected as a duplicate.
    await releaseEvent(event.id);
    return res.status(500).send('handler_failed');
  }

  res.json({ received: true });
});

async function alreadyProcessed(event: Stripe.Event): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { error } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  // 23505 = unique_violation → we have seen this event before.
  return !!error && (error as { code?: string }).code === '23505';
}

async function releaseEvent(id: string) {
  const admin = getSupabaseAdmin();
  if (admin) await admin.from('stripe_events').delete().eq('id', id);
}

async function handleEvent(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    // One-off purchase, or the first payment of a subscription.
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') await recordPayment(stripe, session);
      else await recordPayment(stripe, session, 'pending'); // OXXO & co.
      if (session.mode === 'subscription' && typeof session.subscription === 'string') {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await recordSubscription(sub, session.metadata?.user_id || session.client_reference_id || null);
      }
      break;
    }

    // Delayed payment methods (bank debit, vouchers) settle later.
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordPayment(stripe, session);
      break;
    }
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordPayment(stripe, session, 'failed');
      break;
    }

    // A refund issued from the Stripe dashboard flips the dashboard row
    // so "Plan activo" never claims a refunded purchase.
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const admin = getSupabaseAdmin();
      const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
      if (admin && intent && charge.refunded) {
        await admin.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent', intent);
      }
      break;
    }

    // Subscription lifecycle: renewals, plan changes, cancellations.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await recordSubscription(sub, sub.metadata?.user_id || null);
      break;
    }

    // Each renewal invoice is money in: record it like a payment so the
    // dashboard history is complete.
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(invoice, 'paid');
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(invoice, 'failed');
      break;
    }

    default:
      break;
  }
}

async function recordPayment(stripe: Stripe, session: Stripe.Checkout.Session, status: 'paid' | 'pending' | 'failed' = 'paid') {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn('Payment received but SUPABASE_SERVICE_ROLE_KEY is not set — not recorded:', session.id);
    return;
  }

  const plan = session.metadata?.plan ?? null;
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const customerId = typeof session.customer === 'string' ? session.customer : null;

  // Stripe's hosted receipt — shown as "Ver recibo" in the dashboard.
  let receiptUrl: string | null = null;
  if (paymentIntent && status === 'paid') {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge'] });
      const charge = intent.latest_charge;
      if (charge && typeof charge !== 'string') receiptUrl = charge.receipt_url ?? null;
    } catch (err) {
      console.warn('Could not fetch receipt URL:', (err as Error).message);
    }
  }

  // Idempotent on stripe_session_id — Stripe retries webhooks, and we
  // must never record the same purchase twice.
  const { error } = await admin.from('payments').upsert(
    {
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      user_id: userId || null,
      email,
      plan,
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status,
      receipt_url: receiptUrl,
    },
    { onConflict: 'stripe_session_id' }
  );

  if (error) console.error('Failed to record payment:', error);

  // Buying the research pack tops up Marco Polo's lookups. Done here, in
  // the webhook, so credits only ever appear after Stripe confirms money
  // actually moved — and only once per session id (the upsert above is
  // idempotent, and so is the stripe_events guard around this handler).
  if (status === 'paid' && plan === CREDIT_PACK.plan && userId) {
    const { error: creditError } = await admin.rpc('grant_research_credits', { p_user_id: userId, p_credits: CREDIT_PACK.credits });
    if (creditError) console.error('Failed to grant research credits:', creditError.message);
  }

  // Keep the customer id on the profile so the billing portal works even
  // if the purchase was made before this account existed.
  if (userId && customerId) {
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId).is('stripe_customer_id', null);
  }
}

async function recordSubscription(sub: Stripe.Subscription, userIdFromSession: string | null) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId = userIdFromSession;
  if (!userId) {
    const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = (data?.id as string | undefined) ?? null;
  }

  const item = sub.items.data[0];
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;

  const { error } = await admin.from('subscriptions').upsert(
    {
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      user_id: userId,
      plan: sub.metadata?.plan ?? null,
      status: sub.status, // active | past_due | canceled | ...
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    },
    { onConflict: 'stripe_subscription_id' }
  );
  if (error) console.error('Failed to record subscription:', error);
}

async function recordInvoice(invoice: Stripe.Invoice, status: 'paid' | 'failed') {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId || !invoice.id) return;

  // The first invoice of a subscription is already recorded by
  // checkout.session.completed; keep one row per invoice id.
  const { data: profile } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();

  const { error } = await admin.from('payments').upsert(
    {
      stripe_session_id: `invoice_${invoice.id}`,
      user_id: (profile?.id as string | undefined) ?? null,
      email: invoice.customer_email ?? null,
      plan: (invoice.lines.data[0]?.metadata?.plan as string | undefined) ?? 'suscripcion',
      amount_cents: invoice.amount_paid || invoice.amount_due || 0,
      currency: invoice.currency ?? 'usd',
      status,
      receipt_url: invoice.hosted_invoice_url ?? null,
    },
    { onConflict: 'stripe_session_id' }
  );
  if (error) console.error('Failed to record invoice:', error);
}
