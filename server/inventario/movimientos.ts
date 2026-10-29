import type { SupabaseClient } from '@supabase/supabase-js';

// Lo que cambia el stock. Un solo lugar, usado por los webhooks de las
// tiendas, la API con llave y el panel del equipo.

export type TipoMov = 'ingreso' | 'venta' | 'ajuste' | 'devolucion';
export type Origen = 'manual' | 'bodega' | 'shopify' | 'woocommerce' | 'api';

/** La cantidad con el signo que la base exige para cada tipo. */
export function cantidadConSigno(tipo: TipoMov, cantidad: number): number {
  const n = Math.abs(Math.trunc(cantidad));
  if (!n) throw new Error('La cantidad no puede ser cero');
  if (tipo === 'venta') return -n;
  if (tipo === 'ajuste') return Math.trunc(cantidad); // el ajuste conserva su signo
  return n;
}

export interface Movimiento {
  userId: string;
  sku: string;
  tipo: TipoMov;
  cantidad: number;
  origen: Origen;
  referencia?: string;
  /** Para no aplicar dos veces el mismo pedido. */
  refExterna?: string;
}

export type ResultadoMov =
  | { ok: true; productoId: string; duplicado: false }
  | { ok: true; productoId: string; duplicado: true }
  | { ok: false; motivo: 'sin_producto' | 'error'; detalle?: string };

/** Registra un movimiento por SKU. Idempotente si trae refExterna. */
export async function registrarMovimiento(admin: SupabaseClient, m: Movimiento): Promise<ResultadoMov> {
  const { data: prod } = await admin.from('casillero_productos').select('id').eq('user_id', m.userId).eq('sku', m.sku).maybeSingle();
  if (!prod) return { ok: false, motivo: 'sin_producto' };

  const { error } = await admin.from('casillero_inv_mov').insert({
    producto_id: prod.id,
    user_id: m.userId,
    tipo: m.tipo,
    cantidad: cantidadConSigno(m.tipo, m.cantidad),
    origen: m.origen,
    referencia: m.referencia ?? null,
    ref_externa: m.refExterna ?? null,
  });
  if (error) {
    if (error.code === '23505') return { ok: true, productoId: prod.id, duplicado: true };
    return { ok: false, motivo: 'error', detalle: error.message };
  }
  return { ok: true, productoId: prod.id, duplicado: false };
}

/** Stock disponible hoy de un producto. */
export async function disponiblesDe(admin: SupabaseClient, productoId: string): Promise<number> {
  const { data } = await admin.from('casillero_inventario').select('disponibles').eq('id', productoId).maybeSingle();
  return Number(data?.disponibles ?? 0);
}

/** Línea de un pedido de la tienda ya normalizada. */
export interface LineaPedido {
  sku: string;
  cantidad: number;
  /** id de la línea en la tienda, para la idempotencia */
  lineaId: string;
}
