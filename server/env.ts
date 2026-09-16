// Startup sanity check for environment configuration. Never crashes the
// server (every integration is optional and degrades gracefully), but
// prints one clear warning per problem so a misconfigured deploy is
// obvious in the logs instead of silently half-working.

const isProduction = process.env.NODE_ENV === 'production';

function warn(message: string) {
  console.warn(`[env] ${message}`);
}

function isSet(name: string) {
  return Boolean(process.env[name] && process.env[name]!.trim());
}

// Groups of variables that only make sense together: if some but not all
// of a group are set, that's almost always a mistake.
const GROUPS: { label: string; vars: string[] }[] = [
  { label: 'Stripe', vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_DIAGNOSTICO_MADUREZ', 'STRIPE_PRICE_ANALISIS_MERCADO'] },
  { label: 'Wompi (todos los cobros)', vars: ['WOMPI_PUBLIC_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'] },
  { label: 'Push notifications', vars: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'SUPABASE_SERVICE_ROLE_KEY', 'PUSH_WEBHOOK_SECRET'] },
  { label: 'Supabase (client)', vars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] },
  { label: 'Marco Polo premium voice', vars: ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'] },
];

// Secrets that must never carry the VITE_ prefix (Vite would inline them
// into the public browser bundle).
const SERVER_ONLY = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ANTHROPIC_API_KEY', 'VAPID_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUSH_WEBHOOK_SECRET', 'ELEVENLABS_API_KEY', 'KALODATA_API_KEY', 'SICEX_API_KEY', 'SICEX_SAS_URL', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET'];

export function validateEnv() {
  for (const group of GROUPS) {
    const set = group.vars.filter(isSet);
    if (set.length > 0 && set.length < group.vars.length) {
      const missing = group.vars.filter((v) => !isSet(v));
      warn(`${group.label}: partially configured — missing ${missing.join(', ')}. That integration will stay disabled.`);
    }
  }

  for (const name of SERVER_ONLY) {
    if (isSet(`VITE_${name}`)) {
      warn(`VITE_${name} is set — this is a secret and would be shipped to every browser. Rename it to ${name}.`);
    }
  }

  if (isSet('STRIPE_SECRET_KEY') && process.env.STRIPE_SECRET_KEY!.startsWith('sk_live_') && !isProduction) {
    warn('STRIPE_SECRET_KEY is a LIVE key but NODE_ENV is not "production". Use sk_test_ locally.');
  }

  if (isSet('WOMPI_PUBLIC_KEY') && process.env.WOMPI_PUBLIC_KEY!.startsWith('pub_prod_') && process.env.WOMPI_ENV !== 'production') {
    warn('WOMPI_PUBLIC_KEY is a production key but WOMPI_ENV is not "production" — transactions will be checked against the sandbox and never confirm.');
  }

  // Lo más caro que puede pasar en producción: la web abierta, los
  // botones puestos, y ninguna pasarela detrás. Nadie puede pagar y en
  // los logs no aparece nada, porque no falla — simplemente no cobra.
  const stripeListo = isSet('STRIPE_SECRET_KEY');
  const wompiListo = isSet('WOMPI_PUBLIC_KEY') && isSet('WOMPI_INTEGRITY_SECRET');
  if (!stripeListo && !wompiListo) {
    warn('Ninguna pasarela de pago configurada: nadie puede pagar nada. Poné las llaves de Wompi (WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET, WOMPI_PRIVATE_KEY) o las de Stripe.');
  } else if (wompiListo && !isSet('SUPABASE_SERVICE_ROLE_KEY')) {
    warn('Wompi está configurado pero falta SUPABASE_SERVICE_ROLE_KEY: sin eso no se puede registrar ninguna compra, y el checkout se niega a cobrar.');
  }

  if (isProduction) {
    if (!isSet('PUBLIC_APP_URL')) {
      warn('PUBLIC_APP_URL is not set — Stripe redirects and CORS will fall back to the request host, which is spoofable. Set it to https://your-domain.');
    } else if (!process.env.PUBLIC_APP_URL!.startsWith('https://')) {
      warn('PUBLIC_APP_URL is not https:// — production must run behind HTTPS (HSTS is enabled).');
    }
    if (isSet('PUSH_WEBHOOK_SECRET') && process.env.PUSH_WEBHOOK_SECRET!.length < 32) {
      warn('PUSH_WEBHOOK_SECRET is short — use at least 32 random characters (e.g. `openssl rand -hex 32`).');
    }
  }
}

// Origins allowed to call /api/* from a browser context. Same-origin
// requests never need CORS; this list exists for the native app
// (Capacitor serves the bundle from its own scheme) and local dev.
export function allowedOrigins(): string[] {
  const origins = new Set<string>([
    'capacitor://localhost', // iOS Capacitor
    'https://localhost',     // Android Capacitor (androidScheme: https)
    'http://localhost',
  ]);
  if (isSet('PUBLIC_APP_URL')) origins.add(process.env.PUBLIC_APP_URL!.replace(/\/$/, ''));
  if (!isProduction) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:5173');
  }
  return Array.from(origins);
}
