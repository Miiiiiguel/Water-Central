import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Request } from 'express';

// Server-side Supabase access.
//
// - getSupabaseAdmin(): service-role client that bypasses RLS. Only ever
//   used for things the browser must not be able to do itself (recording
//   a payment, reading someone's push subscriptions). Needs
//   SUPABASE_SERVICE_ROLE_KEY, which is server-only — see .env.example.
// - getUserClient(token): anon client acting AS the caller (their JWT).
//   Every query still goes through RLS, so it can only see what that
//   user could see from the browser — ideal for reading their own
//   profile/role without service-role privileges.
// - getUserFromRequest() / getProfileFromRequest(): verify the
//   "Authorization: Bearer <jwt>" header against Supabase and return who
//   is calling. Routes trust *this*, never anything the client claims.

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function getAnonClient(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getUserClient(token: string): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function getBearerToken(req: Request): string {
  const header = req.header('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const client = getUserClient(token);
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export interface ProfileRow {
  id: string;
  email: string;
  role: 'cliente' | 'vendedor';
}

export interface AuthContext {
  user: User;
  profile: ProfileRow;
  // Authenticator assurance level from the JWT: 'aal2' means the user
  // completed MFA in this session.
  aal: 'aal1' | 'aal2';
}

/**
 * Por qué no se pudo identificar a quien llama.
 *
 * Existe porque todas estas fallas contestaban lo mismo —401, "necesito
 * saber quién sos"— y son cosas distintas: una se arregla entrando, otra
 * es una llave que falta en el servidor, y otra es que la base de datos
 * del proyecto nunca se preparó. Decirlas por separado es la diferencia
 * entre "arreglalo en dos minutos" y "no entiendo qué pasa".
 */
export type AuthFailure =
  /** No vino ningún token: nadie ha entrado. */
  | 'sin_token'
  /** Al servidor le faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. */
  | 'servidor_sin_llaves'
  /** El token existe pero Supabase lo rechaza: vencido o de otro proyecto. */
  | 'token_invalido'
  /** La tabla `profiles` no existe: falta correr supabase/schema.sql. */
  | 'base_sin_preparar'
  /** El token vale, pero no hay fila de perfil y no se pudo crear. */
  | 'sin_perfil';

export type AuthAttempt =
  | { ok: true; ctx: AuthContext }
  | { ok: false; reason: AuthFailure; detail?: string };

/** ¿Este error de Postgres quiere decir "esa tabla no existe"? */
function tablaFaltante(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  // 42P01 es el código de Postgres. PGRST205 es el de PostgREST cuando la
  // tabla no está en su caché de esquema, que es lo que contesta un
  // proyecto de Supabase recién creado donde nunca se corrió el schema.
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  return /does not exist|schema cache/i.test(err.message || '');
}

/**
 * Identifica a quien llama, y dice por qué no pudo cuando no pudo.
 *
 * Si el token es válido pero no hay fila en `profiles` —le pasa a quien
 * entra con Google en un proyecto donde el disparador de alta no corrió—
 * la crea acá mismo en vez de dejar a esa persona sin cuenta utilizable.
 */
export async function authenticate(req: Request): Promise<AuthAttempt> {
  const token = getBearerToken(req);
  if (!token) return { ok: false, reason: 'sin_token' };

  const client = getUserClient(token);
  if (!client) return { ok: false, reason: 'servidor_sin_llaves' };

  const { data: userData, error: userError } = await client.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return { ok: false, reason: 'token_invalido', detail: userError?.message };
  }

  const aal = decodeAal(token);
  const { data, error } = await client.from('profiles').select('id, email, role').eq('id', user.id).maybeSingle();
  if (data) return { ok: true, ctx: { user, profile: data as ProfileRow, aal } };
  if (tablaFaltante(error)) return { ok: false, reason: 'base_sin_preparar', detail: error?.message };

  // Sin fila de perfil: crearla. Va con la llave de servicio porque el
  // alta la hace normalmente un disparador del propio Supabase, y si ese
  // disparador no está, quien entró con Google se queda con una sesión
  // válida y una cuenta que no sirve para nada.
  const creado = await crearPerfil(user);
  if (creado === 'base_sin_preparar') return { ok: false, reason: 'base_sin_preparar' };
  if (creado) return { ok: true, ctx: { user, profile: creado, aal } };

  return { ok: false, reason: 'sin_perfil', detail: error?.message };
}

async function crearPerfil(user: User): Promise<ProfileRow | 'base_sin_preparar' | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre = (meta.full_name ?? meta.name ?? null) as string | null;
  const { data, error } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? '', full_name: nombre, role: 'cliente' },
      { onConflict: 'id' }
    )
    .select('id, email, role')
    .maybeSingle();
  if (tablaFaltante(error)) return 'base_sin_preparar';
  if (error) {
    console.error('[auth] no se pudo crear el perfil que faltaba:', error.message);
    return null;
  }
  return (data as ProfileRow) ?? null;
}

/** La versión corta, para quien sólo necesita saber si hay alguien. */
export async function getProfileFromRequest(req: Request): Promise<AuthContext | null> {
  const intento = await authenticate(req);
  return intento.ok ? intento.ctx : null;
}

function decodeAal(token: string): 'aal1' | 'aal2' {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}
