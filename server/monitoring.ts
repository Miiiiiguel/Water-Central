import * as Sentry from '@sentry/node';
import type { Express } from 'express';

// Optional error monitoring. With SENTRY_DSN set, unhandled server errors
// and security events land in Sentry with stack traces and request
// context; without it everything still goes to stdout (which Render /
// Railway / Docker collect). Never sends PII by default.

let enabled = false;

export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || undefined,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  enabled = true;
  console.log('[monitoring] Sentry enabled');
}

export function isMonitoringEnabled() {
  return enabled;
}

export function attachErrorMonitoring(app: Express) {
  if (enabled) Sentry.setupExpressErrorHandler(app);
}

export function captureException(err: unknown, extra?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(err, { extra });
}

export function captureSecurityEvent(type: string, extra: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureMessage(`security:${type}`, { level: 'warning', extra });
}
