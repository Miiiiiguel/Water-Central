import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { allowedOrigins } from './env';

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
      // blob: is how Marco Polo plays server-generated voice clips.
      mediaSrc: ["'self'", 'blob:'],
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
  // One year, subdomains included, eligible for browser preload lists.
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Cross-Origin-Embedder-Policy off — it would block the Calendly/YouTube iframes.
  crossOriginEmbedderPolicy: false,
});

// Helmet doesn't ship Permissions-Policy; this turns off browser
// features the app never uses so a script injection can't reach them.
export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com"), usb=(), bluetooth=(), interest-cohort=()'
  );
  next();
};

// Browser-facing API calls are allowed from the site itself (whatever
// host it's currently served on — so a fresh deploy works before
// PUBLIC_APP_URL/DNS are final), the native app shells, PUBLIC_APP_URL,
// and (in dev) Vite. Server-to-server callers (Stripe, Supabase
// webhooks) send no Origin header and are unaffected.
export const corsPolicy: RequestHandler = (req, res, next) => {
  const self = `${req.protocol}://${req.get('host')}`;
  cors({
    origin(origin, callback) {
      if (!origin || origin === self || allowedOrigins().includes(origin)) return callback(null, true);
      callback(new Error('Origin not allowed'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })(req, res, next);
};

// Reject anything that isn't a method this API actually uses.
export const methodAllowlist: RequestHandler = (req, res, next) => {
  if (!['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  next();
};

// Every JSON body this API accepts is tiny — anything bigger is abuse.
export const JSON_BODY_LIMIT = '16kb';

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

// Premium voice hits a paid API per call — keep it tight.
export const ttsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

// Called by the Supabase Database Webhook on every new notification row —
// bursty by nature (a busy day can fire many), but still capped.
export const pushRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
