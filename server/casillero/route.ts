import express from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { checkoutRateLimiter, JSON_BODY_LIMIT } from '../security';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { requireUser, requireRole } from '../auth';
import { logSecurityEvent } from '../log';
import { captureException } from '../monitoring';
import { USD_COP_RATE } from '../catalog';
import { checkoutUrl, fetchTransaction, integritySignature, transactionPaysFor, wompiConfigured, type WompiTransaction } from '../wompi';
import { appUrl, emailConfigured, escapeHtml, safeSubject, sendEmail } from '../email';

// El casillero de DMatrixUSA.
//
// Casi todo lo del casillero lo hace el navegador directo contra Supabase
// con RLS (ver supabase/casillero.sql). Acá viven solo las dos cosas que
// no pueden depender del navegador:
//   * el dinero: la recarga del wallet con Wompi (misma pasarela, misma
//     firma y misma verificación que el resto de cobros, ver checkout.ts)
//   * el correo al cliente cuando su paquete llega a la bodega

export const WALLET_REF_RE = /^ecw_[a-f0-9]{32}$/;
const newRef = () => `ecw_${randomBytes(16).toString('hex')}`;

export const MONTO_MIN_USD = 5;
export const MONTO_MAX_USD = 1000;

/** USD con centavos -> centavos de peso, con la tasa del catálogo. */
export function usdToCopCents(usd: number, rate = USD_COP_RATE()): number {
  return Math.round(usd * rate * 100);
}

export const casilleroRouter = express.Router();

// ---------------------------------------------------------------------
// POST /api/casillero/wallet/recargar — { montoUsd } -> { url }
// ---------------------------------------------------------------------
const recargaSchema = z.object({ montoUsd: z.number().min(MONTO_MIN_USD).max(MONTO_MAX_USD) });

casilleroRouter.post(
  '/casillero/wallet/recargar',
  checkoutRateLimiter,
  express.json({ limit: JSON_BODY_LIMIT }),
  requireUser(),
  async (req, res) => {
    const parsed = recargaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'monto_invalido', min: MONTO_MIN_USD, max: MONTO_MAX_USD });
    if (!wompiConfigured()) return res.status(503).json({ error: 'sin_pasarela', message: 'Falta configurar Wompi en el servidor.' });
    const admin = getSupabaseAdmin();
    if (!admin) return res.status(503).json({ error: 'sin_registro' });

    const { user } = res.locals.auth!;
    const montoUsd = Math.round(parsed.data.montoUsd * 100) / 100;
    const copCents = usdToCopCents(montoUsd);
    const ref = newRef();

    const { error } = await admin.from('casillero_wallet').insert({
      user_id: user.id,
      tipo: 'recarga',
      monto: montoUsd,
      estado: 'pendiente',
      metodo: 'wompi',
      referencia: `Recarga Wompi USD ${montoUsd.toFixed(2)}`,
      wompi_ref: ref,
      cop_cents: copCents,
    });
    if (error) {
      captureException(error, { route: 'casillero.recargar' });
      return res.status(500).json({ error: 'orden_fallida' });
    }

    const base = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
    const url = checkoutUrl({
      publicKey: process.env.WOMPI_PUBLIC_KEY!,
      reference: ref,
      amountInCents: copCents,
      currency: 'COP',
      signature: integritySignature(ref, copCents, 'COP', process.env.WOMPI_INTEGRITY_SECRET!),
      redirectUrl: `${base}/casillero/wallet`,
      email: user.email ?? null,
    });
    res.json({ url, reference: ref, copCents });
  }
);

// ---------------------------------------------------------------------
// POST /api/casillero/wallet/confirmar — { transactionId }
// La vuelta de Wompi es una pista; acá se lee la transacción de Wompi.
// ---------------------------------------------------------------------
const txSchema = z.string().regex(/^[A-Za-z0-9_-]{6,80}$/);

casilleroRouter.post(
  '/casillero/wallet/confirmar',
  checkoutRateLimiter,
  express.json({ limit: JSON_BODY_LIMIT }),
  requireUser(),
  async (req, res) => {
    const txId = txSchema.safeParse(req.body?.transactionId);
    if (!txId.success) return res.status(400).json({ error: 'transaccion_invalida' });
    try {
      const tx = await fetchTransaction(txId.data);
      if (!tx || !WALLET_REF_RE.test(String(tx.reference ?? ''))) return res.status(404).json({ error: 'no_encontrada' });
      res.json(await settleWalletTransaction(tx, req));
    } catch (err) {
      captureException(err, { route: 'casillero.confirmar' });
      res.status(502).json({ error: 'wompi_no_responde' });
    }
  }
);

/**
 * Pasa una recarga de pendiente a aprobada, una sola vez, y solo si la
 * transacción de Wompi pagó exactamente esa referencia, monto y moneda.
 * La llaman el webhook (checkout.ts) y la vuelta del navegador.
 */
export async function settleWalletTransaction(tx: Partial<WompiTransaction>, req: express.Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return { paid: false, error: 'sin_registro' as const };

  const ref = String(tx.reference);
  const { data: row } = await admin.from('casillero_wallet').select('*').eq('wompi_ref', ref).maybeSingle();
  if (!row) return { paid: false, error: 'no_encontrada' as const };
  if (row.estado === 'aprobado') return { paid: true, estado: 'aprobado' as const, montoUsd: Number(row.monto) };

  const paga = transactionPaysFor(tx, { reference: ref, amountInCents: Number(row.cop_cents), currency: 'COP' });
  if (!paga) {
    if (tx.status === 'APPROVED') {
      logSecurityEvent('forbidden', req, { route: 'casillero.settle', reason: 'transaction_mismatch', ref, tx: tx.id });
    }
    const fallo = tx.status === 'DECLINED' || tx.status === 'ERROR' || tx.status === 'VOIDED';
    if (fallo) await admin.from('casillero_wallet').update({ estado: 'rechazado', wompi_tx: tx.id ?? null }).eq('id', row.id).eq('estado', 'pendiente');
    return { paid: false, estado: fallo ? ('rechazado' as const) : ('pendiente' as const), montoUsd: Number(row.monto) };
  }

  // `.eq('estado','pendiente')` + `.select()`: solo una de las dos vías
  // (webhook o vuelta del navegador) acredita; la otra ve 0 filas.
  const { data: actualizadas } = await admin
    .from('casillero_wallet')
    .update({ estado: 'aprobado', wompi_tx: tx.id ?? null })
    .eq('id', row.id)
    .eq('estado', 'pendiente')
    .select('id');
  if (actualizadas?.length) {
    await admin.from('notifications').insert({
      user_id: row.user_id,
      type: 'casillero_wallet',
      title: 'Recarga acreditada',
      body: `Se acreditaron USD ${Number(row.monto).toFixed(2)} a tu wallet.`,
      link: '/casillero/wallet',
    });
  }
  return { paid: true, estado: 'aprobado' as const, montoUsd: Number(row.monto) };
}

// ---------------------------------------------------------------------
// POST /api/casillero/wallet/reportar — recarga por transferencia/Zelle/efectivo
// Queda pendiente hasta que el equipo la apruebe.
// ---------------------------------------------------------------------
const reporteSchema = z.object({
  montoUsd: z.number().min(MONTO_MIN_USD).max(MONTO_MAX_USD * 5),
  metodo: z.enum(['Transferencia', 'Zelle', 'Efectivo', 'Otro']),
  referencia: z.string().trim().max(120).default(''),
});

casilleroRouter.post(
  '/casillero/wallet/reportar',
  checkoutRateLimiter,
  express.json({ limit: JSON_BODY_LIMIT }),
  requireUser(),
  async (req, res) => {
    const parsed = reporteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'datos_invalidos' });
    const admin = getSupabaseAdmin();
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    const { user } = res.locals.auth!;
    const { error } = await admin.from('casillero_wallet').insert({
      user_id: user.id,
      tipo: 'recarga',
      monto: Math.round(parsed.data.montoUsd * 100) / 100,
      estado: 'pendiente',
      metodo: parsed.data.metodo,
      referencia: parsed.data.referencia,
    });
    if (error) return res.status(500).json({ error: 'no_guardado' });
    await admin.rpc('notify_vendedores', {
      p_type: 'casillero_recarga',
      p_title: 'Recarga por verificar',
      p_body: `${user.email} reportó USD ${parsed.data.montoUsd.toFixed(2)} (${parsed.data.metodo})`,
      p_link: '/casillero/admin',
    });
    res.json({ ok: true });
  }
);

// ---------------------------------------------------------------------
// POST /api/casillero/paquetes/:id/avisar — el equipo cambió el estado y
// quiere avisar por correo al cliente (solo vendedor).
// ---------------------------------------------------------------------
const ESTADO_TEXTO: Record<string, string> = {
  recibido: 'llegó a nuestra bodega en Miami',
  alistamiento: 'está en alistamiento para el despacho',
  despachado: 'fue despachado',
  entregado: 'fue entregado',
};

casilleroRouter.post('/casillero/paquetes/:id/avisar', checkoutRateLimiter, requireRole('vendedor'), async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: 'id_invalido' });
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'sin_registro' });

  const { data: p } = await admin
    .from('casillero_paquetes')
    .select('guia, estado, peso_lb, profiles!inner(email, full_name, casillero_codigo)')
    .eq('id', id.data)
    .maybeSingle();
  if (!p) return res.status(404).json({ error: 'no_encontrado' });
  const perfil = (Array.isArray(p.profiles) ? p.profiles[0] : p.profiles) as { email: string; full_name: string | null; casillero_codigo: string | null };

  const accion = ESTADO_TEXTO[p.estado];
  if (!accion) return res.json({ enviado: false, motivo: 'estado_sin_aviso' });
  if (!emailConfigured()) return res.json({ enviado: false, motivo: 'correo_sin_configurar' });

  const nombre = escapeHtml(perfil.full_name ?? 'cliente');
  const guia = escapeHtml(p.guia);
  const peso = p.peso_lb ? ` (${Number(p.peso_lb)} lb)` : '';
  const enlace = `${appUrl(req.get('host') ?? undefined)}/casillero`;
  const enviado = await sendEmail({
    to: perfil.email,
    subject: safeSubject(`Tu paquete ${p.guia} ${accion}`),
    html: `<p>Hola ${nombre},</p><p>Tu paquete con guía <b>${guia}</b>${peso} ${accion}.</p><p><a href="${enlace}">Ver mi casillero</a></p><p>DMatrixUSA</p>`,
    text: `Hola ${perfil.full_name ?? ''}, tu paquete con guía ${p.guia}${peso} ${accion}. Ver mi casillero: ${enlace}`,
  });
  res.json({ enviado });
});
