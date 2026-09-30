import express from 'express';
import { cspReportLimiter } from './security';
import { logSecurityEvent } from './log';

// Browsers POST here whenever the Content-Security-Policy blocks
// something (see report-uri in security.ts). A burst of reports for the
// same blocked-uri is either a new integration missing from the
// allowlist, or someone trying to inject a script — both worth seeing.

export const cspRouter = express.Router();

cspRouter.post(
  '/csp-report',
  cspReportLimiter,
  express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '16kb' }),
  (req, res) => {
    const body = req.body ?? {};
    const report = body['csp-report'] ?? (Array.isArray(body) ? body[0]?.body : body) ?? {};
    logSecurityEvent('csp_violation', req, {
      documentUri: String(report['document-uri'] ?? report.documentURL ?? '').slice(0, 200),
      violatedDirective: String(report['violated-directive'] ?? report.effectiveDirective ?? '').slice(0, 100),
      blockedUri: String(report['blocked-uri'] ?? report.blockedURL ?? '').slice(0, 200),
    });
    res.status(204).end();
  }
);
