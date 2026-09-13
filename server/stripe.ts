import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { checkoutRateLimiter, JSON_BODY_LIMIT } from './security';
import { getSupabaseAdmin, getUserFromRequest } from './supabaseAdmin';
import { logSecurityEvent } from './log';

// Server-side Stripe integration.
//
// Required env vars (never commit real values, see .env.example):
//   STRIPE_SECRET_KEY                 sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET              whsec_... (from the Stripe CLI or
//                                       the webhook endpoint you create in
//                                       the Stripe dashboard)
//   STRIPE_PRICE_DIAGNOSTICO_MADUREZ   price_... for the USD 6.90 plan
//   STRIPE_PRICE_ANALISIS_MERCADO      price_... for the USD 499 plan
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
//   2. Stripe hosts the checkout page; the user pays there.
//   3. Stripe calls /api/stripe-webhook (signature-verified). The server
//      writes a row to public.payments with the service-role key. That
//      row is what the dashboard's "Plan activo" reads — never the
//      success redirect, which anyone can type into a URL bar.

export const PLANS = {
  diagnostico_madurez: { priceEnv: 'STRIPE_PRICE_DIAGNOSTICO_MADUREZ', label: 'Diagnóstico de madurez' },
  analisis_mercado: { priceEnv: 'STRIPE_PRICE_ANALISIS_MERCADO', label: 'Análisis de mercado y competencia' },
} as const;

type PlanId = keyof typeof PLANS;

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

const checkoutBodySchema = z.object({
  plan: z.enum(['diagnostico_madurez', 'analisis_mercado']),
  // The native app opens Checkout in the system browser; its return
  // pages get a flag so they can say "you can go back to the app now".
  platform: z.enum(['web', 'native']).default('web'),
});

export const stripeRouter = express.Router();

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
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pago/exito?session_id={CHECKOUT_SESSION_ID}${native}`,
      cancel_url: `${appUrl}/pago/cancelado?x=1${native}`,
      ...(user ? { client_reference_id: user.id, customer_email: user.email } : {}),
      metadata: { plan, user_id: user?.id ?? '' },
      // Checkout page in the buyer's language; Apple Pay / Google Pay
      // appear automatically once enabled in the Stripe dashboard.
      locale: 'auto',
      allow_promotion_codes: true,
      // Always create a Stripe Customer so receipts, refunds and any
      // future subscription are tied to one record per buyer.
      customer_creation: 'always',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: 'No se pudo crear la sesión de pago.' });
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid') {
      await recordPayment(stripe, session);
    }
  }

  // A refund issued from the Stripe dashboard flips the dashboard row so
  // "Plan activo" never claims a refunded purchase.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const admin = getSupabaseAdmin();
    const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (admin && intent && charge.refunded) {
      await admin.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent', intent);
    }
  }

  res.json({ received: true });
});

async function recordPayment(stripe: Stripe, session: Stripe.Checkout.Session) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn('Payment received but SUPABASE_SERVICE_ROLE_KEY is not set — not recorded:', session.id);
    return;
  }

  const plan = session.metadata?.plan ?? null;
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  // Stripe's hosted receipt — shown as "Ver recibo" in the dashboard.
  let receiptUrl: string | null = null;
  if (paymentIntent) {
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
      status: 'paid',
      receipt_url: receiptUrl,
    },
    { onConflict: 'stripe_session_id' }
  );

  if (error) console.error('Failed to record payment:', error);
}
