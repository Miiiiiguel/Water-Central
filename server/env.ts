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

  // Wompi: el entorno y las llaves tienen que ir juntos, y descuadrarlos
  // falla de dos formas distintas.
  const wompiPublica = process.env.WOMPI_PUBLIC_KEY ?? '';
  const wompiPrivada = process.env.WOMPI_PRIVATE_KEY ?? '';
  const wompiProduccion = process.env.WOMPI_ENV === 'production';

  if (wompiPublica.startsWith('pub_prod_') && !wompiProduccion) {
    warn('WOMPI_PUBLIC_KEY is a production key but WOMPI_ENV is not "production" — transactions will be checked against the sandbox and never confirm.');
  }

  // El caso contrario es el que muerde el día del lanzamiento: se cambia
  // WOMPI_ENV a production, se olvidan las llaves, y TODOS los cobros
  // fallan contra la API de producción con una llave de prueba. Son
  // ventas reales perdiéndose, y sin este aviso no hay forma de saberlo
  // hasta que alguien intenta pagar.
  if (wompiProduccion) {
    const deprueba = [
      wompiPublica.startsWith('pub_test_') ? 'WOMPI_PUBLIC_KEY' : null,
      wompiPrivada.startsWith('prv_test_') ? 'WOMPI_PRIVATE_KEY' : null,
    ].filter(Boolean);
    if (deprueba.length) {
      warn(
        `WOMPI_ENV es "production" pero ${deprueba.join(' y ')} ${deprueba.length > 1 ? 'son llaves' : 'es una llave'} de PRUEBA (test). ` +
          'Nadie va a poder pagar: cambialas por las de producción (pub_prod_ / prv_prod_) en el panel de Wompi.'
      );
    }
  }

  // Una credencial dentro de CUALQUIER variable VITE_.
  //
  // Todo lo que empieza por VITE_ se hornea dentro del JavaScript que
  // recibe cada visitante. Pasó de verdad: VITE_SUPABASE_URL tenía la
  // cadena de conexión de la base de datos, contraseña incluida, y esa
  // contraseña quedó publicada en el paquete que baja todo el mundo.
  //
  // El aviso pide ROTAR, no corregir: el valor se corrige en un minuto,
  // lo que ya se publicó no se despublica.
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('VITE_') || !value) continue;
    const esCadenaDeConexion = /^postgres(ql)?:\/\//i.test(value.trim());
    const llevaUsuarioYClave = /^[a-z][a-z0-9+.-]*:\/\/[^/@\s]+:[^/@\s]+@/i.test(value.trim());
    if (esCadenaDeConexion || llevaUsuarioYClave) {
      warn(
        `${name} contiene una credencial (usuario y contraseña dentro de una URL). Todo lo que empieza por VITE_ ` +
          'se entrega dentro del JavaScript a cada visitante, así que esa contraseña está publicada. ' +
          'ROTALA ahora y poné en su lugar el valor que corresponde, sin credenciales.'
      );
    }
  }

  // Una URL de Supabase mal escrita no falla al arrancar: falla en el
  // navegador de quien intenta registrarse, y con un error genérico.
  // `easycomex.supabase.co` sin el https:// delante es el caso típico, y
  // supabase-js sólo se queja al construir el cliente — ya dentro del
  // registro, con la persona esperando.
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    let ok = false;
    try {
      const parsed = new URL(supabaseUrl);
      ok = parsed.protocol === 'https:' || ((parsed.protocol === 'http:') && ['localhost', '127.0.0.1'].includes(parsed.hostname));
    } catch {
      ok = false;
    }
    if (!ok) {
      // El valor se enseña para poder verlo de un vistazo... salvo
      // cuando lleva una credencial dentro. Escribir una contraseña en
      // el log para avisar de que una contraseña está expuesta es
      // dejarla en un sitio más.
      const llevaCredencial = /^[a-z][a-z0-9+.-]*:\/\/[^/@\s]+:[^/@\s]+@/i.test(supabaseUrl.trim());
      const mostrado = llevaCredencial ? '(oculto: contiene una credencial)' : `"${supabaseUrl}"`;
      warn(
        `VITE_SUPABASE_URL no es una URL válida: ${mostrado}. NADIE va a poder registrarse ni entrar. ` +
          'Tiene que ser la dirección completa con https:// y sin barra final (https://<proyecto>.supabase.co), ' +
          'la que aparece en Supabase -> Settings -> API como "Project URL".'
      );
    }
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
