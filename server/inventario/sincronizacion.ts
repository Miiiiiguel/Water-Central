import type { SupabaseClient } from '@supabase/supabase-js';
import { descifrar } from './crypto';
import * as shopify from './shopify';
import * as woo from './woocommerce';
import { anotarEvento } from './eventos';
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

async function marcar(admin: SupabaseClient, id: string, error: string | null) {
  await admin.from('casillero_integraciones').update({ ultimo_sync: new Date().toISOString(), ultimo_error: error, estado: error ? 'error' : 'activa' }).eq('id', id);
}

/** Trae el catálogo de la tienda al casillero (solo productos nuevos; no pisa lo que el cliente ya editó). */
export async function importarCatalogo(admin: SupabaseClient, f: typeof fetch, fila: Integracion, c: Credenciales): Promise<{ nuevos: number; existentes: number }> {
  let lista;
  try {
    lista = c.plataforma === 'shopify' ? await shopify.listarProductos(f, c.cred) : await woo.listarProductos(f, c.cred);
  } catch (e) {
    await marcar(admin, fila.id, (e as Error).message);
    await anotarEvento(admin, { integracionId: fila.id, userId: fila.user_id, tipo: 'error', resumen: `No se pudo importar el catálogo: ${(e as Error).message}` });
    throw e;
  }
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
  await marcar(admin, fila.id, null);
  await anotarEvento(admin, { integracionId: fila.id, userId: fila.user_id, tipo: 'importar', resumen: `Catálogo importado: ${nuevos} productos nuevos, ${existentes} ya existían`, detalle: { nuevos, existentes } });
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
  await marcar(admin, fila.id, errores[0] ?? null);
  await anotarEvento(admin, {
    integracionId: fila.id, userId: fila.user_id, tipo: errores.length ? 'error' : 'sync',
    resumen: errores.length ? `Stock enviado a ${actualizados} productos; falló: ${errores[0]}` : `Stock enviado a ${actualizados} productos`,
    detalle: { actualizados, errores },
  });
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

export interface PedidoAplicado { aplicadas: number; sinProducto: string[]; productos: string[] }

/**
 * Aplica las líneas de un pedido. Idempotente: el mismo pedido (o aviso
 * repetido) no descuenta ni devuelve dos veces.
 *
 *   venta      descuenta por SKU. Un SKU que aún no existe NO se pierde: queda
 *              como evento "sin_producto" y se aplica solo cuando el cliente
 *              cree ese producto (trigger casillero_aplicar_pendientes).
 *   anular     el pedido se canceló: devuelve lo descontado; si la venta seguía
 *              pendiente de un SKU sin producto, la descarta.
 *   reembolso  devolución parcial que la tienda marcó para reponer al stock.
 */
export async function aplicarPedido(
  admin: SupabaseClient,
  o: {
    userId: string;
    integracionId?: string;
    origen: Extract<Origen, 'shopify' | 'woocommerce' | 'api'>;
    prefijo: string;
    pedidoId: string;
    lineas: LineaPedido[];
    modo: 'venta' | 'anular' | 'reembolso';
    reembolsoId?: string;
  },
): Promise<PedidoAplicado> {
  let aplicadas = 0;
  const sinProducto: string[] = [];
  const productos = new Set<string>();

  for (const l of o.lineas) {
    const refVenta = `${o.prefijo}:order:${o.pedidoId}:${l.lineaId}`;

    if (o.modo === 'venta') {
      const r = await registrarMovimiento(admin, { userId: o.userId, sku: l.sku, tipo: 'venta', cantidad: l.cantidad, origen: o.origen, referencia: `Pedido ${o.pedidoId}`, refExterna: refVenta });
      if (!r.ok) {
        if (r.motivo !== 'sin_producto') throw new Error(r.detalle ?? 'No se pudo registrar la venta');
        sinProducto.push(l.sku);
        // Si el aviso se repite, no se duplica el pendiente.
        const { data: ya } = await admin.from('casillero_integracion_eventos').select('id').eq('user_id', o.userId).eq('tipo', 'sin_producto').eq('detalle->>ref_externa', refVenta).maybeSingle();
        if (!ya) {
          await anotarEvento(admin, {
            integracionId: o.integracionId ?? null, userId: o.userId, tipo: 'sin_producto',
            resumen: `Pedido ${o.pedidoId}: el SKU ${l.sku} no existe en tu casillero`,
            detalle: { sku: l.sku, tipo: 'venta', cantidad: -Math.abs(l.cantidad), origen: o.origen, referencia: `Pedido ${o.pedidoId}`, ref_externa: refVenta, pedido: o.pedidoId },
          });
        }
        continue;
      }
      if (!r.duplicado) { aplicadas++; productos.add(r.productoId); }
      continue;
    }

    // anular / reembolso: solo se devuelve lo que de verdad se había descontado.
    const { data: previa } = await admin.from('casillero_inv_mov').select('producto_id').eq('ref_externa', refVenta).maybeSingle();
    if (!previa) {
      // La venta nunca llegó a aplicarse (SKU sin producto): se descarta el pendiente.
      if (o.modo === 'anular') await admin.from('casillero_integracion_eventos').update({ resuelto: true }).eq('user_id', o.userId).eq('tipo', 'sin_producto').eq('detalle->>ref_externa', refVenta);
      continue;
    }
    const refDev = o.modo === 'anular' ? `${o.prefijo}:cancel:${o.pedidoId}:${l.lineaId}` : `${o.prefijo}:refund:${o.reembolsoId}:${l.lineaId}`;
    const r = await registrarMovimiento(admin, {
      userId: o.userId, sku: l.sku, tipo: 'devolucion', cantidad: l.cantidad, origen: o.origen,
      referencia: o.modo === 'anular' ? `Pedido ${o.pedidoId} cancelado` : `Reembolso del pedido ${o.pedidoId}`, refExterna: refDev,
    });
    if (r.ok && !r.duplicado) { aplicadas++; productos.add(r.productoId); }
  }

  if (o.integracionId) {
    const etiqueta = o.modo === 'venta' ? 'vendido' : o.modo === 'anular' ? 'cancelado' : 'reembolsado';
    await anotarEvento(admin, {
      integracionId: o.integracionId, userId: o.userId, tipo: 'webhook',
      resumen: `Pedido ${o.pedidoId} ${etiqueta}: ${aplicadas} ${aplicadas === 1 ? 'línea aplicada' : 'líneas aplicadas'}${sinProducto.length ? `, ${sinProducto.length} sin producto` : ''}`,
      detalle: { pedido: o.pedidoId, modo: o.modo, aplicadas, sin_producto: sinProducto },
    });
    await admin.from('casillero_integraciones').update({ ultimo_sync: new Date().toISOString(), ultimo_error: null, estado: 'activa' }).eq('id', o.integracionId);
  }
  return { aplicadas, sinProducto, productos: Array.from(productos) };
}

// ---------------------------------------------------------------------
// Diagnóstico y reparación de una conexión
// ---------------------------------------------------------------------
export interface Chequeo { id: string; ok: boolean; titulo: string; detalle: string }

const TEMAS: Record<Integracion['plataforma'], readonly string[]> = { shopify: shopify.TEMAS_WEBHOOK, woocommerce: woo.TEMAS_WEBHOOK };

/** ¿Está viva la conexión? Revisa credenciales, avisos de la tienda, catálogo vinculado y el último evento. */
export async function diagnosticar(admin: SupabaseClient, f: typeof fetch, fila: Integracion, c: Credenciales, urlAvisos: string): Promise<Chequeo[]> {
  const chequeos: Chequeo[] = [];

  try {
    if (c.plataforma === 'shopify') await shopify.datosTienda(f, c.cred); else await woo.verificarCredenciales(f, c.cred);
    chequeos.push({ id: 'credenciales', ok: true, titulo: 'Credenciales', detalle: 'La tienda responde y acepta tus llaves.' });
  } catch (e) {
    chequeos.push({ id: 'credenciales', ok: false, titulo: 'Credenciales', detalle: (e as Error).message });
    return chequeos; // sin credenciales no tiene sentido seguir
  }

  try {
    const hooks = c.plataforma === 'shopify'
      ? (await shopify.listarWebhooks(f, c.cred)).map((h) => ({ topic: h.topic, address: h.address, activo: true }))
      : (await woo.listarWebhooks(f, c.cred)).map((h) => ({ topic: h.topic, address: h.delivery_url, activo: h.status === 'active' }));
    const falta = TEMAS[fila.plataforma].filter((t) => !hooks.some((h) => h.topic === t && h.address === urlAvisos && h.activo));
    chequeos.push({
      id: 'avisos', ok: falta.length === 0, titulo: 'Avisos de ventas',
      detalle: falta.length ? `Tu tienda no nos está avisando de: ${falta.join(', ')}. Pulsa "Reparar conexión".` : 'Tu tienda nos avisa de cada pedido, cancelación y reembolso.',
    });
  } catch (e) {
    chequeos.push({ id: 'avisos', ok: false, titulo: 'Avisos de ventas', detalle: `No pudimos revisarlos: ${(e as Error).message}` });
  }

  const { count } = await admin.from('casillero_productos_externos').select('producto_id', { count: 'exact', head: true }).eq('integracion_id', fila.id);
  chequeos.push({
    id: 'catalogo', ok: (count ?? 0) > 0, titulo: 'Catálogo vinculado',
    detalle: (count ?? 0) > 0 ? `${count} productos vinculados con tu tienda.` : 'Ningún producto vinculado todavía. Pulsa "Importar catálogo".',
  });

  const { data: ult } = await admin.from('casillero_integracion_eventos').select('tipo, resumen, created_at').eq('integracion_id', fila.id).eq('tipo', 'webhook').order('id', { ascending: false }).limit(1);
  chequeos.push({
    id: 'actividad', ok: true, titulo: 'Última venta recibida',
    detalle: ult?.[0] ? `${ult[0].resumen} (${new Date(ult[0].created_at as string).toLocaleString('es-CO')}).` : 'Todavía no ha llegado ningún pedido. Haz un pedido de prueba en tu tienda para verificarlo.',
  });

  chequeos.push({
    id: 'stock', ok: true, titulo: 'Stock hacia la tienda',
    detalle: fila.sync_stock ? 'Activo: el stock de la bodega se refleja en tu tienda.' : 'Apagado: tu tienda no recibe el stock de la bodega (puedes enviarlo a mano).',
  });
  return chequeos;
}

/** Vuelve a dejar los avisos de la tienda como deben estar (borra los nuestros y los crea de nuevo). */
export async function repararAvisos(admin: SupabaseClient, f: typeof fetch, fila: Integracion, c: Credenciales, secretos: { webhookSecret: string }, urlAvisos: string): Promise<{ creados: number }> {
  let ids: unknown[];
  if (c.plataforma === 'shopify') {
    const mios = (await shopify.listarWebhooks(f, c.cred)).filter((h) => h.address === urlAvisos).map((h) => h.id);
    await shopify.borrarWebhooks(f, c.cred, mios);
    ids = await shopify.registrarWebhooks(f, c.cred, urlAvisos);
  } else {
    const mios = (await woo.listarWebhooks(f, c.cred)).filter((h) => h.delivery_url === urlAvisos).map((h) => h.id);
    await woo.borrarWebhooks(f, c.cred, mios);
    ids = await woo.registrarWebhooks(f, c.cred, urlAvisos, secretos.webhookSecret);
  }
  await admin.from('casillero_integraciones').update({ webhooks: ids, ultimo_error: null, estado: 'activa' }).eq('id', fila.id);
  await anotarEvento(admin, { integracionId: fila.id, userId: fila.user_id, tipo: 'conexion', resumen: `Conexión reparada: ${ids.length} avisos creados` });
  return { creados: ids.length };
}
