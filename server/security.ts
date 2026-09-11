import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security headers. The CSP allowlist covers every third-party
// integration this app actually uses (fonts, Calendly, ad pixels,
// Supabase, YouTube embed for the VSL section). If you add a new
// integration later, its domain needs to be added here too or the
// browser will silently block it.
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://assets.calendly.com',
        'https://connect.facebook.net',
        'https://analytics.tiktok.com',
        'https://www.googletagmanager.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://assets.calendly.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://www.google-analytics.com',
        'https://analytics.tiktok.com',
      ],
      frameSrc: ["'self'", 'https://calendly.com', 'https://www.youtube.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://checkout.stripe.com'],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  // Cross-Origin-Embedder-Policy off — it would block the Calendly/YouTube iframes.
  crossOriginEmbedderPolicy: false,
});

// General ceiling on API traffic per IP.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// The chatbot calls a paid LLM API — worth a tighter limit than the rest.
export const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes. Intenta de nuevo en unos minutos.' },
});

// Checkout session creation — cheap to call but still worth capping
// against accidental loops or abuse.
export const checkoutRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
