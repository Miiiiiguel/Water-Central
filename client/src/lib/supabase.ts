import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined, 'VITE_SUPABASE_URL');
const supabaseAnonKey = rejectServerKey(
  cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined, 'VITE_SUPABASE_ANON_KEY')
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// During local/dev setup before the real project keys are added, we fall back
// to a placeholder client so the app doesn't crash on import. Every call will
// simply fail until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set — see
// SETUP.md for setup steps.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

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
