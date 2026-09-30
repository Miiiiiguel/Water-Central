import type { Request, RequestHandler, Response } from 'express';
import { authenticate, type AuthContext, type AuthFailure } from './supabaseAdmin';
import { logSecurityEvent } from './log';

// Server-side authorization. The browser hiding a button is not
// security; these middlewares are. They verify the caller's JWT with
// Supabase, load the caller's own profile (through RLS, as that user)
// and check the role on the server before a route runs.

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthContext;
    }
  }
}

/**
 * Qué se le contesta a quien no pudo identificarse.
 *
 * Antes era un solo 401 "Authentication required" para las cinco causas.
 * Con eso, alguien que acababa de entrar con Google veía "necesito saber
 * quién sos" y no tenía forma de saber que lo que faltaba era preparar la
 * base de datos del proyecto. El código va en `error` para que el
 * navegador decida qué botón mostrar; el `message` es lo que se lee.
 */
export const AUTH_RESPONSE: Record<AuthFailure, { status: number; error: string; message: string }> = {
  sin_token: {
    status: 401,
    error: 'sin_sesion',
    message: 'No llegó ninguna sesión con la petición. Entrá a tu cuenta y volvé a intentar.',
  },
  token_invalido: {
    status: 401,
    error: 'sesion_vencida',
    message: 'Tu sesión ya no vale —venció o quedó de otra instalación—. Salí y entrá de nuevo.',
  },
  servidor_sin_llaves: {
    status: 503,
    error: 'servidor_sin_llaves',
    message:
      'El servidor no tiene puesta la conexión con las cuentas, así que no puede verificar quién sos. ' +
      'Es configuración nuestra, no tuya: avisale al equipo.',
  },
  base_sin_preparar: {
    status: 503,
    error: 'base_sin_preparar',
    message:
      'La base de datos de la app todavía no está preparada: tu sesión es válida, pero no hay dónde guardar tu cuenta. ' +
      'Es configuración nuestra, no tuya: avisale al equipo.',
  },
  sin_perfil: {
    status: 503,
    error: 'sin_perfil',
    message:
      'Tu sesión es válida pero no pudimos crear tu ficha de cliente. Avisale al equipo y lo resolvemos.',
  },
};

/** Manda la respuesta que corresponde y la deja anotada en el log. */
function negar(req: Request, res: Response, reason: AuthFailure, detail?: string) {
  const r = AUTH_RESPONSE[reason];
  logSecurityEvent('unauthenticated', req, { reason, ...(detail ? { detail } : {}) });
  // El detalle técnico va al log del servidor, no a la respuesta: puede
  // traer nombres de tablas y de proyecto.
  return res.status(r.status).json({ error: r.error, reason, message: r.message });
}

export function requireUser(): RequestHandler {
  return async (req, res, next) => {
    const intento = await authenticate(req);
    if (!intento.ok) return negar(req, res, intento.reason, intento.detail);
    res.locals.auth = intento.ctx;
    next();
  };
}

export function requireRole(role: 'vendedor' | 'cliente', opts: { mfa?: boolean } = {}): RequestHandler {
  return async (req, res, next) => {
    const intento = await authenticate(req);
    if (!intento.ok) return negar(req, res, intento.reason, intento.detail);
    const ctx = intento.ctx;
    if (role === 'vendedor' && ctx.profile.role !== 'vendedor') {
      logSecurityEvent('forbidden', req, { userId: ctx.user.id, needed: role, has: ctx.profile.role });
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (opts.mfa && ctx.aal !== 'aal2') {
      logSecurityEvent('forbidden', req, { userId: ctx.user.id, reason: 'mfa_required' });
      return res.status(403).json({ error: 'MFA required', code: 'mfa_required' });
    }
    res.locals.auth = ctx;
    next();
  };
}
