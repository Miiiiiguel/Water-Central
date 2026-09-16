import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { allowedOrigins } from './env';
import { logSecurityEvent } from './log';

// Security headers. The CSP allowlist covers every third-party
// integration this app actually uses (fonts, Calendly, ad pixels,
// Supabase, YouTube embed for the VSL section, Sentry ingest). If you
// add a new integration later, its domain needs to be added here too or
// the browser will silently block it — and report it to /api/csp-report.
/**
 * El origen de Supabase que esta instalación usa de verdad.
 *
 * La lista de `connect-src` tenía `https://*.supabase.co` escrito a
 * mano. Mientras el proyecto viva en ese dominio, perfecto. Si vive en
 * otro —otra región, un dominio propio— el navegador BLOQUEA la
 * petición y reporta "Failed to fetch": el mismo texto que da una caída
 * de red, y sin nada que lo distinga. La app quedaría rota por su
 * propia política de seguridad, que es la peor forma de estar rota:
 * todo está bien configurado y nada funciona.
 *
 * Así que se deriva de la variable, y el comodín se queda como red por
 * si la variable no está puesta.
 */
function supabaseOrigins(): string[] {
  const raw = process.env.VITE_SUPABASE_URL?.trim();
  if (!raw) return [];
  try {
    const { origin, host } = new URL(raw);
    if (!origin.startsWith('https://') && !origin.startsWith('http://')) return [];
    return [origin, `wss://${host}`];
  } catch {
    return [];
  }
}

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://checkout.wompi.co',
        'https://assets.calendly.com',
        'https://connect.facebook.net',
        'https://analytics.tiktok.com',
        'https://www.googletagmanager.com',
      ],
      // 'unsafe-inline' for styles only: framer-motion/Radix/sonner set
      // inline style attributes and inject <style> tags at runtime, and
      // CSS injection is not a code-execution vector. Scripts stay strict.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://assets.calendly.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      // blob: is how Marco Polo plays server-generated voice clips.
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: [
        "'self'",
        ...supabaseOrigins(),
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://www.google-analytics.com',
        'https://analytics.tiktok.com',
        'https://*.ingest.sentry.io',
        'https://*.ingest.us.sentry.io',
        'https://*.ingest.de.sentry.io',
        'https://*.wompi.co',
      ],
      frameSrc: ["'self'", 'https://calendly.com', 'https://www.youtube.com', 'https://checkout.wompi.co'],
      workerSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://checkout.stripe.com', 'https://checkout.wompi.co'],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
      reportUri: ['/api/csp-report'],
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
// Microphone stays on for Marco Polo's dictation (same-origin only).
export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=(self "https://checkout.stripe.com" "https://checkout.wompi.co"), usb=(), bluetooth=(), interest-cohort=()'
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
      logSecurityEvent('cors_rejected', req);
      callback(new Error('Origin not allowed'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })(req, res, next);
};

// Reject anything that isn't a method this API actually uses.
export const methodAllowlist: RequestHandler = (req, res, next) => {
  // DELETE entró con /api/account: borrar la cuenta es lo único que
  // esta API borra, y merece el verbo correcto.
  if (!['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method)) {
    logSecurityEvent('method_rejected', req);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  next();
};

// Every JSON body this API accepts is tiny — anything bigger is abuse.
export const JSON_BODY_LIMIT = '16kb';

// All limiters log who hit them, so a brute-force or scraping attempt
// shows up in the security log instead of silently getting 429s.
export function makeLimiter(
  name: string,
  limit: number,
  windowMs = 15 * 60 * 1000,
  skip?: (req: Request) => boolean
) {
  return rateLimit({
    windowMs,
    limit,
    ...(skip ? { skip } : {}),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurityEvent('rate_limited', req, { limiter: name, limit, windowMs });
      res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' });
    },
  });
}

/**
 * Techo general por IP.
 *
 * `/health` queda fuera, y no es un detalle: el host lo consulta cada
 * pocos segundos para saber si la app sigue viva. Con el límite puesto,
 * pasaba de 100 peticiones en 15 minutos, recibía 429, y Render lo leía
 * como "la instancia está caída" — reiniciaba el servicio, y vuelta a
 * empezar. Un limitador pensado para frenar abuso terminaba tumbando el
 * servidor solo.
 *
 * Exponerlo sin límite es seguro: a quien no está autenticado le
 * contesta `{ ok: true }` y nada más.
 */
export const apiRateLimiter = makeLimiter('api', 100, 15 * 60 * 1000, (req) => req.path === '/health');
export const chatRateLimiter = makeLimiter('chat', 30);       // paid LLM API
export const checkoutRateLimiter = makeLimiter('checkout', 20);
export const ttsRateLimiter = makeLimiter('tts', 40);         // paid voice API
export const pushRateLimiter = makeLimiter('push', 300);      // bursty webhook
export const formRateLimiter = makeLimiter('forms', 8);       // contact + freight submissions
export const cspReportLimiter = makeLimiter('csp_report', 60);
