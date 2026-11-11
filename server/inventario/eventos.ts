import type { SupabaseClient } from '@supabase/supabase-js';

// El registro de lo que pasa con cada tienda: es lo que el cliente y el
// equipo miran cuando algo no cuadra ("¿llegó el pedido?, ¿por qué no bajó el stock?").

export type TipoEvento = 'conexion' | 'webhook' | 'importar' | 'sync' | 'error' | 'sin_producto';

const MAX_EVENTOS = 300;

export async function anotarEvento(
  admin: SupabaseClient,
  e: { integracionId: string | null; userId: string; tipo: TipoEvento; resumen: string; detalle?: Record<string, unknown> },
): Promise<void> {
  try {
    await admin.from('casillero_integracion_eventos').insert({
      integracion_id: e.integracionId, user_id: e.userId, tipo: e.tipo, resumen: e.resumen.slice(0, 300), detalle: e.detalle ?? null,
    });
    // De vez en cuando se recorta el historial de esa tienda: no crece sin límite.
    if (e.integracionId && Math.random() < 0.05) {
      const { data } = await admin.from('casillero_integracion_eventos').select('id').eq('integracion_id', e.integracionId).order('id', { ascending: false }).range(MAX_EVENTOS, MAX_EVENTOS);
      const corte = data?.[0]?.id;
      if (corte) await admin.from('casillero_integracion_eventos').delete().eq('integracion_id', e.integracionId).lte('id', corte);
    }
  } catch (err) {
    console.error('[inventario] no se pudo anotar el evento:', (err as Error).message);
  }
}
