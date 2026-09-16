import express from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { formRateLimiter, checkoutRateLimiter, JSON_BODY_LIMIT } from './security';
import { getSupabaseAdmin, getUserFromRequest } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import { captureException } from './monitoring';
import { ACTIONS } from './diagnosticActions';
import {
  fetchTransaction, integritySignature, transactionPaysFor, verifyEventChecksum, wompiConfigured, wompiEnv, type WompiEvent,
} from './wompi';
import { FLAT, TOTAL_QUESTIONS, gapsIn, scorePct, tierFor, type Answer } from '../client/src/lib/diagnosticContent';
import { appUrl, diagnosticReceipt, emailConfigured, sendEmail } from './email';

// Diagnóstico de madurez.
//
// The questionnaire and the free comments live in the browser; what the
// client pays for — the recommended action per gap — lives only here
// (diagnosticActions.ts) and is returned by GET /diagnostic/:ref once the
// row is marked paid. Nothing the browser sends can flip that flag: it
// is set either by the webhook Wompi signs, or by /confirm after this
// server reads the transaction back from Wompi's API.
//
// `ref` is a 128-bit random token that doubles as the Wompi payment
// reference: knowing it is what lets a client see their own result, the
// same way a receipt link works. It is never guessable and never listed.
//
// Price: one number, in COP cents, because Wompi settles in pesos. The
// display for a non-Colombian buyer is "USD 9.99" with the peso amount
// underneath — their bank converts. Override both with env vars.

const PRICE_COP_CENTS = Number(process.env.DIAGNOSTIC_PRICE_COP_CENTS) || 3990000; // $39.900
const PRICE_USD_DISPLAY = process.env.DIAGNOSTIC_PRICE_USD_DISPLAY || '9.99';
const CURRENCY = 'COP';

const safeText = (max: number) =>
  z.string().trim().max(max).refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s), 'control characters');

const createSchema = z.object({
  empresa: safeText(120).default(''),
  nombre: safeText(120).min(2),
  celular: safeText(40).default(''),
  correo: z.string().trim().toLowerCase().email().max(160),
  pais: z.enum(['CO', 'US', 'OT']),
  // One slot per question, in FLAT order. Scored questions hold si/no;
  // the open one holds free text (capped) or null.
  answers: z.array(z.union([z.literal('si'), z.literal('no'), safeText(300), z.null()])).length(TOTAL_QUESTIONS),
  website: z.string().max(200).optional(), // honeypot
});

const refSchema = z.string().regex(/^ecx_[a-f0-9]{32}$/);

function newRef() {
  return `ecx_${randomBytes(16).toString('hex')}`;
}

function priceFor(pais: string) {
  const cop = `$${(PRICE_COP_CENTS / 100).toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
  return pais === 'CO'
    ? { amountInCents: PRICE_COP_CENTS, currency: CURRENCY, display: cop, note: 'PSE · Nequi · Daviplata · Tarjetas' }
    : { amountInCents: PRICE_COP_CENTS, currency: CURRENCY, display: `USD ${PRICE_USD_DISPLAY}`, note: `Se cobra ${cop} · tarjeta internacional` };
}

/** Only the scored answers, normalised: anything odd becomes null. */
function scoredAnswers(raw: unknown[]): Answer[] {
  return FLAT.map((q, i) => {
    if (q.type === 'input') return null;
    const v = raw[i];
    return v === 'si' || v === 'no' ? v : null;
  });
}

interface DiagnosticRow {
  id: string;
  ref: string;
  user_id: string | null;
  empresa: string | null;
  nombre: string | null;
  correo: string | null;
  celular: string | null;
  pais: string | null;
  answers: unknown[];
  score: number;
  gaps: number;
  paid: boolean;
  paid_at: string | null;
  transaction_id: string | null;
}

async function loadRow(ref: string): Promise<DiagnosticRow | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.from('diagnostics').select('*').eq('ref', ref).maybeSingle();
  return (data as DiagnosticRow | null) ?? null;
}

async function markPaid(ref: string, tx: { id?: string; amount_in_cents?: number; currency?: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  // Idempotent on purpose: el webhook y /confirm pueden llegar los dos.
  // `.select()` dice si esta llamada fue la que lo marcó; la segunda no
  // devuelve filas, y así el recibo sale una sola vez.
  const { data } = await admin
    .from('diagnostics')
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      gateway: 'wompi',
      transaction_id: tx.id ?? null,
      amount_cents: tx.amount_in_cents ?? null,
      currency: tx.currency ?? null,
    })
    .eq('ref', ref)
    .eq('paid', false)
    .select('*');

  const row = (data as DiagnosticRow[] | null)?.[0];
  if (row) void sendReceipt(row);
}

/**
 * El recibo con el enlace para volver a entrar.
 *
 * La referencia vive en el localStorage del comprador: si cierra la
 * pestaña o cambia de equipo, este correo es su única forma de volver a
 * lo que pagó. Se manda sin esperar y sin propagar errores — un correo
 * caído no puede deshacer un pago que ya entró.
 */
async function sendReceipt(row: DiagnosticRow) {
  if (!emailConfigured() || !row.correo) return;
  const base = appUrl();
  if (!base) {
    console.warn('[diagnostic] PUBLIC_APP_URL sin definir: no se manda el recibo, el enlace saldría roto.');
    return;
  }
  const gaps = gapsIn(scoredAnswers(row.answers)).length;
  const sent = await sendEmail(
    diagnosticReceipt(
      {
        nombre: row.nombre ?? '',
        empresa: row.empresa ?? '',
        correo: row.correo,
        score: row.score,
        tier: tierFor(row.score).name,
        gaps,
        ref: row.ref,
      },
      base
    )
  );
  if (!sent) console.error('[diagnostic] no se pudo mandar el recibo de', row.ref);
}

/** What the browser is allowed to see for a row. Actions only once paid. */
function publicView(row: DiagnosticRow) {
  const answers = scoredAnswers(row.answers);
  const gaps = gapsIn(answers);
  const price = priceFor(row.pais ?? 'OT');
  return {
    ref: row.ref,
    score: row.score,
    tier: tierFor(row.score).name,
    gaps: gaps.length,
    paid: row.paid,
    pais: row.pais ?? 'OT',
    empresa: row.empresa,
    // Their own answers, so a return trip from the checkout (or another
    // device) can rebuild the free comments without re-asking.
    answers,
    price,
    actions: row.paid ? gaps.map((q) => ({ index: q.index, question: q.t, section: q.section.title, action: ACTIONS[q.index] ?? '' })) : null,
  };
}

export const diagnosticRouter = express.Router();

// Public config for the page: whether paying is possible at all, and
// the public key the widget needs (public by design).
diagnosticRouter.get('/diagnostic/config', (_req, res) => {
  res.json({
    enabled: wompiConfigured() && Boolean(getSupabaseAdmin()),
    publicKey: process.env.WOMPI_PUBLIC_KEY ?? null,
    env: wompiEnv(),
    price: { CO: priceFor('CO'), INTL: priceFor('OT') },
  });
});

// Saves the finished questionnaire and hands back the reference.
diagnosticRouter.post('/diagnostic', formRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    logSecurityEvent('invalid_input', req, { form: 'diagnostic' });
    return res.status(400).json({ error: 'Datos inválidos.' });
  }
  if (parsed.data.website) {
    logSecurityEvent('honeypot_triggered', req, { form: 'diagnostic' });
    return res.json({ ok: true, ref: newRef() });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'not_configured' });

  const answers = scoredAnswers(parsed.data.answers);
  const score = scorePct(answers);
  const gaps = gapsIn(answers).length;
  const user = await getUserFromRequest(req);
  const ref = newRef();

  const { error } = await admin.from('diagnostics').insert({
    ref,
    user_id: user?.id ?? null,
    empresa: parsed.data.empresa || null,
    nombre: parsed.data.nombre,
    celular: parsed.data.celular || null,
    correo: parsed.data.correo,
    pais: parsed.data.pais,
    answers: parsed.data.answers,
    score,
    gaps,
  });
  if (error) {
    captureException(error, { route: 'diagnostic.create' });
    return res.status(500).json({ error: 'No pudimos guardar el diagnóstico.' });
  }
  return res.json({ ref, score, gaps, tier: tierFor(score).name, price: priceFor(parsed.data.pais) });
});

// Signature for the widget. The amount is decided here, never by the
// browser, and the secret never leaves this process.
diagnosticRouter.post('/diagnostic/wompi-init', checkoutRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const ref = refSchema.safeParse(req.body?.ref);
  if (!ref.success) return res.status(400).json({ error: 'Referencia inválida.' });
  if (!wompiConfigured()) return res.status(503).json({ error: 'not_configured' });

  const row = await loadRow(ref.data);
  if (!row) return res.status(404).json({ error: 'No encontramos ese diagnóstico.' });
  if (row.paid) return res.status(409).json({ error: 'already_paid' });
  if (row.gaps === 0) return res.status(409).json({ error: 'nothing_to_unlock' });

  const price = priceFor(row.pais ?? 'OT');
  const signature = integritySignature(row.ref, price.amountInCents, price.currency, process.env.WOMPI_INTEGRITY_SECRET!);
  return res.json({
    reference: row.ref,
    amountInCents: price.amountInCents,
    currency: price.currency,
    signature,
    publicKey: process.env.WOMPI_PUBLIC_KEY,
    customer: { email: row.correo, fullName: row.nombre, phone: (row.celular ?? '').replace(/\D/g, '') },
  });
});

// The browser says "Wompi told me it was approved" and names the
// transaction. We read that transaction from Wompi ourselves and only
// then unlock — the widget callback is a hint, not proof.
diagnosticRouter.post('/diagnostic/confirm', checkoutRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const ref = refSchema.safeParse(req.body?.ref);
  const txId = z.string().regex(/^[A-Za-z0-9_-]{6,80}$/).safeParse(req.body?.transactionId);
  if (!ref.success) return res.status(400).json({ error: 'Referencia inválida.' });

  const row = await loadRow(ref.data);
  if (!row) return res.status(404).json({ error: 'No encontramos ese diagnóstico.' });
  if (row.paid) return res.json(publicView(row));
  if (!txId.success) return res.json(publicView(row));

  try {
    const tx = await fetchTransaction(txId.data);
    const price = priceFor(row.pais ?? 'OT');
    if (transactionPaysFor(tx, { reference: row.ref, amountInCents: price.amountInCents, currency: price.currency })) {
      await markPaid(row.ref, tx!);
      const fresh = await loadRow(row.ref);
      return res.json(publicView(fresh ?? { ...row, paid: true }));
    }
    if (tx && tx.status === 'APPROVED') {
      // Approved, but for something else. Worth a look in the logs.
      logSecurityEvent('forbidden', req, { route: 'diagnostic.confirm', reason: 'transaction_mismatch', ref: row.ref, tx: tx.id });
    }
  } catch (err) {
    captureException(err, { route: 'diagnostic.confirm' });
  }
  return res.json(publicView(row));
});

// Wompi's server-to-server event. Signed with the events secret; the
// authoritative path to "paid" even if the buyer closes the tab.
diagnosticRouter.post('/diagnostic/wompi-events', express.json({ limit: '64kb' }), async (req, res) => {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return res.status(503).json({ error: 'not_configured' });
  const event = req.body as WompiEvent;
  if (!event?.signature?.checksum || !Array.isArray(event.signature.properties) || !event.data) {
    return res.status(400).json({ error: 'bad_event' });
  }
  if (!verifyEventChecksum(event, secret)) {
    logSecurityEvent('webhook_signature_failed', req, { source: 'wompi' });
    return res.status(401).json({ error: 'bad_signature' });
  }

  const tx = event.data.transaction;
  const ref = refSchema.safeParse(tx?.reference);
  // Always 200 once the signature checks out: Wompi retries anything else
  // and there is nothing to retry for a reference that isn't ours.
  if (event.event !== 'transaction.updated' || !ref.success) return res.json({ received: true });

  const row = await loadRow(ref.data);
  if (row && !row.paid) {
    const price = priceFor(row.pais ?? 'OT');
    if (transactionPaysFor(tx, { reference: row.ref, amountInCents: price.amountInCents, currency: price.currency })) {
      await markPaid(row.ref, tx!);
    }
  }
  return res.json({ received: true });
});

// "Perdí mi diagnóstico": se lo reenviamos al correo con el que pagó.
//
// Contesta lo mismo exista o no ese correo. Si dijera "ese correo no
// tiene nada", cualquiera podría averiguar quién te compró probando
// direcciones — y eso no se lo debemos a nadie.
diagnosticRouter.post('/diagnostic/recover', formRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const correo = z.string().trim().toLowerCase().email().max(160).safeParse(req.body?.correo);
  // Un "ok" también cuando el correo viene mal formado sería mentirle a
  // quien se equivocó escribiendo; eso sí se le puede decir.
  if (!correo.success) return res.status(400).json({ error: 'Escribe un correo válido.' });

  const respuesta = {
    ok: true,
    message: 'Si ese correo tiene un plan de acción pagado, ya va en camino. Revisa también la carpeta de spam.',
  };

  const admin = getSupabaseAdmin();
  if (!admin || !emailConfigured()) return res.json(respuesta);

  const { data } = await admin
    .from('diagnostics')
    .select('*')
    .eq('correo', correo.data)
    .eq('paid', true)
    .order('paid_at', { ascending: false })
    .limit(1);

  const row = (data as DiagnosticRow[] | null)?.[0];
  if (row) await sendReceipt(row);
  return res.json(respuesta);
});

// The result behind a reference. Actions come back only if paid.
diagnosticRouter.get('/diagnostic/:ref', async (req, res) => {
  const ref = refSchema.safeParse(req.params.ref);
  if (!ref.success) return res.status(400).json({ error: 'Referencia inválida.' });
  const row = await loadRow(ref.data);
  if (!row) return res.status(404).json({ error: 'No encontramos ese diagnóstico.' });
  res.setHeader('Cache-Control', 'no-store');
  return res.json(publicView(row));
});
