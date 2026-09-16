import type { Request } from 'express';
import { captureSecurityEvent } from './monitoring';

// Structured security event log. One JSON line per event on stdout so
// any host's log search can filter `kind:"security"`; forwarded to
// Sentry too when it's configured. Never logs bodies, tokens or keys —
// only what's needed to spot abuse (who, what, from where, how often).

export type SecurityEventType =
  | 'rate_limited'
  | 'cors_rejected'
  | 'method_rejected'
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'honeypot_triggered'
  | 'webhook_signature_failed'
  | 'webhook_unauthorized'
  | 'csp_violation'
  | 'account_deleted'
  | 'server_error';

export function logSecurityEvent(type: SecurityEventType, req: Request | null, details: Record<string, unknown> = {}) {
  const entry = {
    at: new Date().toISOString(),
    level: type === 'server_error' ? 'error' : 'warn',
    kind: 'security',
    type,
    ...(req
      ? {
          ip: req.ip,
          method: req.method,
          path: (req.originalUrl || req.url || '').split('?')[0],
          ua: (req.get('user-agent') || '').slice(0, 120),
          origin: req.get('origin') || undefined,
        }
      : {}),
    ...details,
  };
  const line = JSON.stringify(entry);
  if (entry.level === 'error') console.error(line);
  else console.warn(line);
  captureSecurityEvent(type, entry);
}
