import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * La llave anónima viaja en un encabezado HTTP en cada petición, y los
 * encabezados solo admiten Latin-1. Si al copiar y pegar se cuela una
 * comilla curva, unos puntos suspensivos «…» o un espacio invisible, el
 * navegador rompe TODAS las peticiones con un error incomprensible:
 *
 *   Failed to read the 'headers' property from 'RequestInit':
 *   String contains non ISO-8859-1 code point.
 *
 * Nada en ese mensaje dice "revisa tu variable de entorno". Así que lo
 * detectamos acá: limpiamos los espacios de sobra y, si queda algún
 * carácter imposible, lo decimos claro y tratamos la configuración como
 * ausente — la app muestra "no configurado" en vez de fallar en cada
 * clic sin explicación.
 */
function cleanEnv(value: string | undefined, name: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  // eslint-disable-next-line no-control-regex
  const bad = trimmed.match(/[^\u0000-\u00ff]/);
  if (bad) {
    console.error(
      `[supabase] ${name} tiene un carácter que no cabe en un encabezado HTTP: ` +
        `"${bad[0]}" (U+${bad[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}), ` +
        `en la posición ${bad.index}. Casi siempre es basura de copiar y pegar. ` +
        `Vuelve a copiar el valor desde Supabase (Settings -> API) con el botón de copiar ` +
        `y pégalo de nuevo, borrando antes el campo entero.`
    );
    return undefined;
  }
  return trimmed;
}

/**
 * Lee el campo `role` de un JWT de Supabase sin verificar la firma: acá
 * no nos interesa si es auténtico, solo QUÉ llave nos dieron. Cualquier
 * cosa que no se deje leer devuelve null y sigue su camino.
 */
export function jwtRole(value: string): string | null {
  const payload = value.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/**
 * Supabase le cambió el nombre a sus llaves: lo que antes eran `anon` y
 * `service_role` (dos JWT que empiezan con `eyJ`) hoy se llaman
 * Publishable (`sb_publishable_…`) y Secret (`sb_secret_…`). Están una
 * al lado de la otra en el panel, y confundirlas acá no da ningún error
 * visible: la app funcionaría perfecto mientras le entrega a cualquier
 * visitante una llave que se salta la seguridad de TODAS las tablas.
 *
 * Por eso esto no avisa y sigue: rechaza la llave. Preferimos una app
 * que dice "no configurado" a una app que funciona y está abierta.
 */
export function isServerKey(value: string): boolean {
  return value.startsWith('sb_secret_') || jwtRole(value) === 'service_role';
}

function rejectServerKey(value: string | undefined): string | undefined {
  if (!value || !isServerKey(value)) return value;
  console.error(
    '[supabase] VITE_SUPABASE_ANON_KEY tiene la llave PRIVADA del servidor ' +
      '(la "Secret key" / `service_role`). Esa llave se salta la seguridad de ' +
      'todas las tablas y acá la vería cualquiera que abra la página. ' +
      'La app se queda sin conexión a propósito. Cámbiala por la llave pública ' +
      '("Publishable key" o `anon`) y rota la privada en Supabase: ya estuvo expuesta.'
  );
  return undefined;
}

/**
 * ¿Es esto una URL de verdad?
 *
 * `isSupabaseConfigured` sólo miraba que la variable no estuviera
 * vacía. Con eso, un valor como `easycomex.supabase.co` —sin el
 * https://— pasaba el filtro, y el error salía mucho después: al
 * construir el cliente, supabase-js hace `new URL(...)` y lanza
 * "Invalid URL". Esa excepción llegaba al registro como "algo falló y
 * no fue tu conexión", que no le sirve a nadie. El valor estaba mal
 * desde el primer segundo y la app se enteraba en el peor momento.
 *
 * Se acepta http:// sólo en local, donde vive el Supabase de desarrollo.
 */
export function validSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

function requireUrl(value: string | undefined): string | undefined {
  if (!value || validSupabaseUrl(value)) return value;
  console.error(
    `[supabase] VITE_SUPABASE_URL no es una URL válida: "${value}". ` +
      'Tiene que ser la dirección completa del proyecto, con https:// adelante y sin barra final — ' +
      'algo como https://abcdefghijklm.supabase.co. La encontrás en Supabase, en Settings -> API, ' +
      'como "Project URL". No es la cadena de conexión de la base de datos ni el identificador del proyecto solo.'
  );
  return undefined;
}

const supabaseUrl = requireUrl(cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined, 'VITE_SUPABASE_URL'));
const supabaseAnonKey = rejectServerKey(
  cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined, 'VITE_SUPABASE_ANON_KEY')
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Qué falta exactamente, para poder decirlo en pantalla en vez de
 * "faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY", que es verdad a
 * medias cuando el problema es que una de las dos está MAL, no ausente.
 */
export function supabaseConfigProblem(): string | null {
  const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined, 'VITE_SUPABASE_URL');
  const key = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined, 'VITE_SUPABASE_ANON_KEY');
  if (!url) return 'Falta la dirección del proyecto de Supabase (VITE_SUPABASE_URL).';
  if (!validSupabaseUrl(url)) return `La dirección de Supabase está mal escrita: "${url}". Tiene que empezar con https://`;
  if (!key) return 'Falta la llave pública de Supabase (VITE_SUPABASE_ANON_KEY).';
  if (isServerKey(key)) return 'La llave de Supabase configurada es la PRIVADA del servidor. Hay que poner la pública (Publishable / anon).';
  return null;
}

/**
 * supabase-js pesa 56 KB comprimidos — la cuarta parte del paquete
 * principal — y hasta ahora se lo bajaba todo el que abría la página,
 * incluido quien nunca va a iniciar sesión. En un sitio que sobre todo
 * recibe visitantes, eso es peso puro en el camino crítico.
 *
 * Así que se carga cuando de verdad hace falta. El cliente se construye
 * una sola vez y se comparte: dos clientes distintos sobre el mismo
 * proyecto se pelean por la sesión guardada.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      // Con las llaves sin poner se construye igual, contra un host que
      // no existe: cada llamada falla, pero la app no se cae al importar.
      // Quién puede llamar está gobernado por isSupabaseConfigured.
      createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key')
    );
  }
  return clientPromise;
}

/**
 * ¿Hay que cargar supabase-js de una, antes de que nadie toque nada?
 *
 * Tres casos, y el tercero es el que muerde si se olvida:
 *   1. Hay una sesión guardada: la persona ya entró, hay que reconocerla.
 *   2. Volvemos de un OAuth por hash (`#access_token=...`): supabase-js
 *      tiene que leer ese hash antes de que el navegador lo descarte.
 *   3. Volvemos de un OAuth por PKCE (`?code=...`): igual.
 *
 * Si se saltara el 2 o el 3, entrar con Google llevaría de vuelta a la
 * página sin sesión y sin ningún error visible.
 *
 * Es una función pura sobre el almacenamiento y la URL para poder
 * probarla: equivocarse acá sólo se nota con una cuenta real.
 */
export function needsSessionOnLoad(storageKeys: string[], hash: string, search: string): boolean {
  if (storageKeys.some((k) => /^sb-.+-auth-token$/.test(k))) return true;
  if (/[#&](access_token|error_description)=/.test(hash)) return true;
  if (/[?&]code=/.test(search)) return true;
  return false;
}

/** Lo mismo, leyendo del navegador de verdad. */
export function hasSessionToRestore(): boolean {
  if (typeof window === 'undefined') return false;
  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage);
  } catch {
    // Ventana privada o almacenamiento bloqueado: no hay sesión guardada
    // que restaurar, pero un OAuth de vuelta sigue siendo posible.
  }
  return needsSessionOnLoad(keys, window.location.hash, window.location.search);
}

export type UserRole = 'cliente' | 'vendedor';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: UserRole;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export type QuoteStatus = 'pending' | 'quoted' | 'won' | 'lost';
export type LeadStatus = 'new' | 'contacted' | 'won' | 'lost';

export interface FreightQuote {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  origin: string;
  destination: string;
  weight_kg: number | null;
  client_type: string | null;
  zone?: string | null;
  quote_cop?: number | null;
  status: QuoteStatus;
  created_at: string;
}

export interface ContactLead {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  country: string | null;
  sales_channel: string | null;
  interests: string[] | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
}

export type PlanId = 'diagnostico_madurez' | 'analisis_mercado';

export interface Payment {
  id: string;
  user_id: string | null;
  email: string | null;
  plan: PlanId | string;
  amount_cents: number;
  currency: string;
  // 'pending' = a voucher/bank-debit payment that has not cleared yet.
  status: 'paid' | 'refunded' | 'pending' | 'failed';
  stripe_session_id: string;
  receipt_url: string | null;
  created_at: string;
}

// Recurring plans. Written only by the Stripe webhook; empty unless the
// price configured in Stripe is a recurring one.
export interface Subscription {
  id: string;
  user_id: string | null;
  stripe_subscription_id: string;
  plan: string | null;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}
