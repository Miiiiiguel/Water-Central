import type { SupabaseClient } from '@supabase/supabase-js';
import { extenderMeses } from '../../client/src/lib/fabricantes';
import { escapeHtml, sendEmail, teamAddress } from '../email';
import { hoyColombia } from './portal';

// Lo que pasa cuando el pago en línea de una pauta queda aprobado: la
// pauta se extiende los meses pagados (desde hoy o desde que vence, lo
// que sea más tarde) y el fabricante queda aprobado y activo. Lo llama
// settle() en checkout.ts, que ya garantiza que la orden pasó a pagada
// una sola vez; además `aplicado` se marca con una condición, así que
// aunque lo llamaran dos veces la pauta se extiende una.

export async function aplicarPagoDePauta(admin: SupabaseClient, paymentId: string): Promise<void> {
  const { data: marcados, error } = await admin
    .from('manufacturer_payments')
    .update({ aplicado: true })
    .eq('payment_id', paymentId)
    .eq('aplicado', false)
    .select('manufacturer_id, meses');
  if (error) {
    console.error('[fabricantes] no se pudo marcar el pago de pauta:', error.message);
    return;
  }
  const pago = (marcados as Array<{ manufacturer_id: string; meses: number }> | null)?.[0];
  if (!pago) return;

  const { data: f } = await admin
    .from('manufacturers')
    .select('nombre, pauta_hasta, contacto_email, acceso_email')
    .eq('id', pago.manufacturer_id)
    .maybeSingle();
  if (!f) return;

  const nueva = extenderMeses((f.pauta_hasta as string | null) ?? null, hoyColombia(), pago.meses);
  const { error: errPauta } = await admin
    .from('manufacturers')
    .update({ pauta_hasta: nueva, activo: true, estado: 'aprobado' })
    .eq('id', pago.manufacturer_id);
  if (errPauta) {
    // El pago está registrado y marcado: queda para que el equipo lo
    // aplique a mano desde el panel, y el log lo dice.
    console.error(`[fabricantes] pago ${paymentId} aprobado pero la pauta no se extendió:`, errPauta.message);
    return;
  }
  await admin.from('manufacturer_payments').update({ pauta_hasta_nueva: nueva }).eq('payment_id', paymentId);

  const texto = `${f.nombre}: recibimos tu pago de ${pago.meses} ${pago.meses === 1 ? 'mes' : 'meses'} de pauta en Easycomex. Tu pauta queda al aire hasta el ${nueva}. Mira tus vistas y contactos en easycomex.com/fabricante.`;
  const html = `<p>${escapeHtml(texto)}</p>`;
  const correo = (f.acceso_email as string | null) || (f.contacto_email as string | null);
  if (correo) void sendEmail({ to: correo, subject: 'Tu pauta en Easycomex está al aire', text: texto, html });
  const equipo = teamAddress();
  if (equipo) void sendEmail({ to: equipo, subject: `[Fabricantes] Pago en línea de ${f.nombre}`, text: texto, html });
}
