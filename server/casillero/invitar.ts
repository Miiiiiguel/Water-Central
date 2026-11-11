import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Invitar a un cliente al casillero por correo.
//
// El equipo escribe el correo (y, si quiere, el nombre y la empresa) y la
// persona recibe un enlace para crear su contraseña. Al aceptar entra
// directo a su portal, con su código de casillero ya creado: la cuenta se
// crea en el momento de invitar, y el mismo disparador del registro
// (handle_new_user) le arma la ficha con rol 'cliente'.
//
// El enlace no es el de Supabase sino uno nuestro con el token (token_hash)
// que la página /restablecer canjea con verifyOtp. Dos razones:
//   * Funciona igual con cualquier configuración de sesión del navegador
//     (el enlace por defecto de Supabase choca con el flujo PKCE).
//   * Los antivirus de correo que "abren" los enlaces para revisarlos no
//     ejecutan JavaScript, así que no gastan la invitación antes que la
//     persona.
//
// Si el correo de la app no está configurado, igual se devuelve el enlace
// para que el equipo lo mande por WhatsApp.

export const invitacionSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  nombre: z.string().trim().max(120).optional().default(''),
  empresa: z.string().trim().max(120).optional().default(''),
});
export type DatosInvitacion = z.infer<typeof invitacionSchema>;

export type EstadoInvitacion =
  /** Cuenta nueva: se creó y se le manda la invitación. */
  | 'invitado'
  /** Ya estaba invitado pero nunca entró: se le manda un enlace nuevo. */
  | 'reenviado'
  /** Ya entra con su correo: no hace falta invitarlo. */
  | 'ya_tiene_cuenta'
  /** Es del equipo (administrador), no un cliente. */
  | 'es_equipo';

export interface ResultadoInvitacion {
  estado: EstadoInvitacion;
  userId: string | null;
  codigo: string | null;
  /** El enlace para crear la contraseña; null si no hace falta. */
  enlace: string | null;
}

export type FalloInvitacion = { error: 'fallo'; message: string };

/** El enlace que la página /restablecer sabe canjear. */
export function enlaceInvitacion(base: string, tokenHash: string, tipo: 'invite' | 'recovery'): string {
  const q = new URLSearchParams({ token_hash: tokenHash, tipo, destino: 'casillero' });
  return `${base.replace(/\/$/, '')}/restablecer?${q.toString()}`;
}

/** Escapa % _ y \ para buscar el correo exacto con ilike (sin distinguir mayúsculas). */
const literal = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const yaRegistrado = (msg: string) => /already (been )?registered|already exists|email_exists/i.test(msg);

async function perfilPorCorreo(admin: SupabaseClient, email: string) {
  const { data } = await admin
    .from('profiles')
    .select('id, role, casillero_codigo')
    .ilike('email', literal(email))
    .maybeSingle();
  return data as { id: string; role: 'cliente' | 'vendedor'; casillero_codigo: string | null } | null;
}

export async function invitarCliente(
  admin: SupabaseClient,
  datos: DatosInvitacion,
  base: string
): Promise<ResultadoInvitacion | FalloInvitacion> {
  const { email } = datos;
  let perfil = await perfilPorCorreo(admin, email);

  if (perfil) {
    if (perfil.role === 'vendedor') return { estado: 'es_equipo', userId: perfil.id, codigo: perfil.casillero_codigo, enlace: null };
    const { data: u } = await admin.auth.admin.getUserById(perfil.id);
    if (u?.user?.last_sign_in_at) return { estado: 'ya_tiene_cuenta', userId: perfil.id, codigo: perfil.casillero_codigo, enlace: null };
    return reenviar(admin, email, base, perfil.id, perfil.casillero_codigo);
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: {
        ...(datos.nombre ? { full_name: datos.nombre } : {}),
        ...(datos.empresa ? { company: datos.empresa, es_empresa: true } : {}),
        invitado: true,
      },
    },
  });
  if (error || !data?.properties?.hashed_token) {
    // La cuenta existe en Auth pero sin ficha (raro): se manda un enlace nuevo.
    if (error && yaRegistrado(error.message)) return reenviar(admin, email, base, null, null);
    console.error('casillero invite generateLink failed:', error?.message ?? 'sin token');
    return { error: 'fallo', message: 'Supabase no pudo crear la invitación. Revisa que el servidor tenga la llave de servicio.' };
  }

  perfil = await perfilPorCorreo(admin, email);
  return {
    estado: 'invitado',
    userId: data.user?.id ?? perfil?.id ?? null,
    codigo: perfil?.casillero_codigo ?? null,
    enlace: enlaceInvitacion(base, data.properties.hashed_token, 'invite'),
  };
}

async function reenviar(admin: SupabaseClient, email: string, base: string, userId: string | null, codigo: string | null): Promise<ResultadoInvitacion | FalloInvitacion> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data?.properties?.hashed_token) {
    console.error('casillero re-invite generateLink failed:', error?.message ?? 'sin token');
    return { error: 'fallo', message: 'Supabase no pudo crear el enlace nuevo.' };
  }
  return { estado: 'reenviado', userId: userId ?? data.user?.id ?? null, codigo, enlace: enlaceInvitacion(base, data.properties.hashed_token, 'recovery') };
}

/**
 * Quiénes están invitados y todavía no entraron nunca: el equipo los ve
 * marcados en Clientes y les puede reenviar la invitación.
 */
export async function invitacionesPendientes(admin: SupabaseClient, maxPaginas = 20): Promise<string[]> {
  const pendientes: string[] = [];
  for (let page = 1; page <= maxPaginas; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (u.invited_at && !u.last_sign_in_at) pendientes.push(u.id);
    if (data.users.length < 1000) break;
  }
  return pendientes;
}
