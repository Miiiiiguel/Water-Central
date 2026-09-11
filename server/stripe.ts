import express from 'express';
import Stripe from 'stripe';

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
//
// This server only serves static files today — to actually run these
// routes in production you need to deploy the Express server itself
// (e.g. Render, Railway, Fly.io, a VPS), not just upload the static
// build to something like Netlify/Vercel's static hosting.

const PLAN_PRICE_ENV: Record<string, string> = {
  diagnostico_madurez: 'STRIPE_PRICE_DIAGNOSTICO_MADUREZ',
  analisis_mercado: 'STRIPE_PRICE_ANALISIS_MERCADO',
};

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const stripeRouter = express.Router();

stripeRouter.post('/create-checkout-session', express.json(), async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe no está configurado en el servidor (falta STRIPE_SECRET_KEY).' });
  }

  const { plan } = req.body as { plan?: string };
  const envKey = plan ? PLAN_PRICE_ENV[plan] : undefined;
  const priceId = envKey ? process.env[envKey] : undefined;

  if (!priceId) {
    return res.status(400).json({ error: `Plan desconocido o sin price ID configurado: ${plan}` });
  }

  const appUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
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
stripeRouter.post('/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => {
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
    console.error('Stripe webhook signature verification failed:', err);
    return res.status(400).send('Webhook signature verification failed.');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    // TODO: once the `plan_subscriptions` table exists (see
    // supabase/schema.sql), look up the user by session.customer_email
    // and mark their plan as paid here using the Supabase service-role
    // key (never the anon key) from a server-only env var.
    console.log('Checkout completed for', session.customer_email);
  }

  res.json({ received: true });
});
