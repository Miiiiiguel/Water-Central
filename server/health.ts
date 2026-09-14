import express from 'express';
import { getProfileFromRequest } from './supabaseAdmin';

// GET /api/health
//   - Unauthenticated (hosting health checks): { ok: true } only.
//   - Team members (vendedor JWT): which integrations are configured, as
//     booleans — never values. Powers the "Integraciones" dashboard panel.
// Configuration details aren't secret, but there's no reason to hand a
// map of the stack to anonymous visitors either.

const set = (name: string) => Boolean(process.env[name] && process.env[name]!.trim());

export const healthRouter = express.Router();

healthRouter.get('/health', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const ctx = await getProfileFromRequest(req);
  if (!ctx || ctx.profile.role !== 'vendedor') {
    return res.json({ ok: true });
  }

  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    integrations: {
      supabase: set('VITE_SUPABASE_URL') && set('VITE_SUPABASE_ANON_KEY'),
      supabaseServer: set('SUPABASE_SERVICE_ROLE_KEY'),
      stripe: set('STRIPE_SECRET_KEY') && set('STRIPE_PRICE_ANALISIS_MERCADO'),
      stripeWebhook: set('STRIPE_WEBHOOK_SECRET'),
      push: set('VAPID_PUBLIC_KEY') && set('VAPID_PRIVATE_KEY') && set('PUSH_WEBHOOK_SECRET'),
      chatAI: set('ANTHROPIC_API_KEY'),
      voicePremium: set('ELEVENLABS_API_KEY') && set('ELEVENLABS_VOICE_ID'),
      monitoring: set('SENTRY_DSN'),
      calendly: set('VITE_CALENDLY_URL'),
      metaPixel: set('VITE_META_PIXEL_ID'),
      tiktokPixel: set('VITE_TIKTOK_PIXEL_ID'),
      googleAnalytics: set('VITE_GA_MEASUREMENT_ID'),
      kalodata: set('KALODATA_API_KEY') && set('KALODATA_API_URL'),
      sicex: set('SICEX_API_KEY') && set('SICEX_API_URL'),
    },
  });
});
