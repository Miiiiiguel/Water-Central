import type { SupabaseClient } from '@supabase/supabase-js';
import { descifrar } from './crypto';
import * as shopify from './shopify';
import * as woo from './woocommerce';
import { disponiblesDe, registrarMovimiento, type LineaPedido, type Origen } from './movimientos';

// Lo que une el inventario del casillero con la tienda del cliente.
//
// Regla de oro: la BODEGA es la verdad del stock. Pero empujar el stock a
// la tienda es opt-in (sync_stock): si alguien conecta su tienda antes de
// que la bodega registre sus ingresos, empujar "0" dejaría sus productos
// agotados. Importar el catálogo nunca toca el stock de la tienda.

export interface Integracion {
  id: string;
  user_id: string;
  plataforma: 'shopify' | 'woocommerce';
  dominio: string;
  ubicacion_id: string | null;
  webhooks: unknown;
  sync_stock: boolean;
}

export type Credenciales =
  | { plataforma: 'shopify'; cred: shopify.CredShopify }
  | { plataforma: 'woocommerce'; cred: woo.CredWoo };

export async function cargarIntegracion(admin: SupabaseClient, id: string): Promise<{ fila: Integracion; secretos: { json: Record<string, string>; webhookSecret: string } } | null> {
  const { data: fila } = await admin.from('casillero_integraciones').select('*').eq('id', id).maybeSingle();
  if (!fila) return null;
  const { data: sec } = await admin.from('casillero_integraciones_secretos').select('*').eq('integracion_id', id).maybeSingle();
  if (!sec) return null;
  return { fila: fila as Integracion, secretos: { json: JSON.parse(descifrar(sec.secretos_cifrados)) as Record<string, string>, webhookSecret: sec.webhook_secret } };
}

export function credencialesDe(fila: Integracion, json: Record<string, string>): Credenciales {
  return fila.plataforma === 'shopify'
    ? { plataforma: 'shopify', cred: { dominio: fila.dominio, token: json.token, secretoApi: json.secretoApi } }
    : { plataforma: 'woocommerce', cred: { url: fila.dominio, clave: json.clave, secreto: json.secreto } };
}

async function anotar(admin: SupabaseClient, id: string, error: string | null) {
  await admin.from('casillero_integraciones').update({ ultimo_sync: new Date().toISOString(), ultimo_error: error, estado: error ? 'error' : 'activa' }).eq('id', id);
}

/** Trae el catálogo de la tienda al casillero (solo productos nuevos; no pisa lo que el cliente ya editó). */
export async function importarCatalogo(admin: SupabaseClient, f: typeof fetch, fila: Integracion, c: Credenciales): Promise<{ nuevos: number; existentes: number }> {
  const lista = c.plataforma === 'shopify' ? await shopify.listarProductos(f, c.cred) : await woo.listarProductos(f, c.cred);
  let nuevos = 0;
  let existentes = 0;
  for (const p of lista) {
    const { data: ya } = await admin.from('casillero_productos').select('id').eq('user_id', fila.user_id).eq('sku', p.sku).maybeSingle();
    let productoId = ya?.id as string | undefined;
    if (productoId) existentes++;
    else {
      const { data: nuevo, error } = await admin.from('casillero_productos')
        .insert({ user_id: fila.user_id, sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || null, imagen_url: p.imagen })
        .select('id').single();
      if (error) throw new Error(`No se pudo guardar ${p.sku}: ${error.message}`);
      productoId = nuevo.id as string;
      nuevos++;
    }
    await admin.from('casillero_productos_externos').upsert({
      producto_id: productoId, integracion_id: fila.id, externo_id: p.externoId, externo_extra: 'externoExtra' in p ? (p as { externoExtra: string | null }).externoExtra : null,
    });
  }
  await anotar(admin, fila.id, null);
  return { nuevos, existentes };
}

/** Empuja a la tienda el stock actual de los productos mapeados (todos, o solo `productoIds`). */
export async function empujarStock(admin: SupabaseClient, f: typeof fetch, fila: Integracion, c: Credenciales, productoIds?: string[]): Promise<{ actualizados: number; errores: string[] }> {
  let q = admin.from('casillero_productos_externos').select('producto_id, externo_id, externo_extra').eq('integracion_id', fila.id);
  if (productoIds?.length) q = q.in('producto_id', productoIds);
  const { data: mapas } = await q;
  let actualizados = 0;
  const errores: string[] = [];
  for (const m of mapas ?? []) {
    try {
      const disp = await disponiblesDe(admin, m.producto_id);
      if (c.plataforma === 'shopify') await shopify.fijarStock(f, c.cred, fila.ubicacion_id ?? '', m.externo_id, disp);
      else await woo.fijarStock(f, c.cred, m.externo_id, m.externo_extra, disp);
      actualizados++;
    } catch (e) {
      errores.push((e as Error).message);
      if (errores.length >= 5) break;
    }
  }
  await anotar(admin, fila.id, errores[0] ?? null);
  return { actualizados, errores };
}

/** Tras un movimiento: refleja el nuevo stock en las tiendas del cliente que lo pidieron. Nunca lanza. */
export async function empujarProductoSiCorresponde(admin: SupabaseClient, f: typeof fetch, userId: string, productoId: string): Promise<void> {
  try {
    const { data: filas } = await admin.from('casillero_integraciones').select('id').eq('user_id', userId).eq('sync_stock', true);
    for (const { id } of filas ?? []) {
      const ci = await cargarIntegracion(admin, id);
      if (ci) await empujarStock(admin, f, ci.fila, credencialesDe(ci.fila, ci.secretos.json), [productoId]);
    }
  } catch (e) {
    console.error('[inventario] no se pudo empujar el stock:', (e as Error).message);
  }
}

/** Aplica las líneas de un pedido: ventas, o su reversa si se canceló. Idempotente. */
export async function aplicarPedido(
  admin: SupabaseClient,
  o: { userId: string; origen: Extract<Origen, 'shopify' | 'woocommerce' | 'api'>; prefijo: string; pedidoId: string; lineas: LineaPedido[]; anular: boolean },
): Promise<{ aplicadas: number; sinProducto: string[]; productos: string[] }> {
  let aplicadas = 0;
  const sinProducto: string[] = [];
  const productos = new Set<string>();
  for (const l of o.lineas) {
    const refVenta = `${o.prefijo}:order:${o.pedidoId}:${l.lineaId}`;
    if (o.anular) {
      // Solo se devuelve lo que de verdad se había descontado.
      const { data: previa } = await admin.from('casillero_inv_mov').select('producto_id').eq('ref_externa', refVenta).maybeSingle();
      if (!previa) continue;
      const r = await registrarMovimiento(admin, { userId: o.userId, sku: l.sku, tipo: 'devolucion', cantidad: l.cantidad, origen: o.origen, referencia: `Pedido ${o.pedidoId} cancelado`, refExterna: `${o.prefijo}:cancel:${o.pedidoId}:${l.lineaId}` });
      if (r.ok && !r.duplicado) { aplicadas++; productos.add(r.productoId); }
      continue;
    }
    const r = await registrarMovimiento(admin, { userId: o.userId, sku: l.sku, tipo: 'venta', cantidad: l.cantidad, origen: o.origen, referencia: `Pedido ${o.pedidoId}`, refExterna: refVenta });
    if (!r.ok) {
      if (r.motivo === 'sin_producto') sinProducto.push(l.sku); else throw new Error(r.detalle ?? 'No se pudo registrar la venta');
      continue;
    }
    if (!r.duplicado) { aplicadas++; productos.add(r.productoId); }
  }
  return { aplicadas, sinProducto, productos: Array.from(productos) };
}
