import express from 'express';

// GET /api/health — which integrations are configured. Booleans only,
// never values. This is what the "Integraciones" panel in the team
// dashboard reads so you can see at a glance what's left to connect.

const set = (name: string) => Boolean(process.env[name] && process.env[name]!.trim());

export const healthRouter = express.Router();

healthRouter.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
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
      calendly: set('VITE_CALENDLY_URL'),
      metaPixel: set('VITE_META_PIXEL_ID'),
      tiktokPixel: set('VITE_TIKTOK_PIXEL_ID'),
      googleAnalytics: set('VITE_GA_MEASUREMENT_ID'),
      kalodata: set('KALODATA_API_KEY'),
      sicex: set('SICEX_API_KEY'),
    },
  });
});
