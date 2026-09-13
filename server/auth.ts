import type { RequestHandler } from 'express';
import { getProfileFromRequest, type AuthContext } from './supabaseAdmin';
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

export function requireUser(): RequestHandler {
  return async (req, res, next) => {
    const ctx = await getProfileFromRequest(req);
    if (!ctx) {
      logSecurityEvent('unauthenticated', req);
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.locals.auth = ctx;
    next();
  };
}

export function requireRole(role: 'vendedor' | 'cliente', opts: { mfa?: boolean } = {}): RequestHandler {
  return async (req, res, next) => {
    const ctx = await getProfileFromRequest(req);
    if (!ctx) {
      logSecurityEvent('unauthenticated', req);
      return res.status(401).json({ error: 'Authentication required' });
    }
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
