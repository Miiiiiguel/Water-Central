import { createHmac } from 'node:crypto';
import { iguales } from './crypto';
import type { LineaPedido } from './movimientos';

// Shopify (Admin API). El cliente crea una "app personalizada" en su
// admin (Configuración > Apps > Desarrollar apps) con permisos de lectura
// de productos y pedidos y de lectura/escritura de inventario, y nos da el
// dominio, el token de acceso de Admin API y la "clave secreta de API"
// (con ella firma Shopify los webhooks).

export const API_VERSION = '2024-10';
export type Fetch = typeof fetch;

export interface CredShopify {
  dominio: string;       // mi-tienda.myshopify.com
  token: string;         // shpat_...
  secretoApi: string;    // firma de los webhooks
}

const base = (c: CredShopify) => `https://${c.dominio}/admin/api/${API_VERSION}`;
const cab = (c: CredShopify) => ({ 'X-Shopify-Access-Token': c.token, 'Content-Type': 'application/json', Accept: 'application/json' });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Shopify limita a ~2 llamadas por segundo: ante un 429 (o un 503 pasajero)
// se espera lo que pide `Retry-After` y se reintenta, hasta 3 veces.
async function llamar<T>(f: Fetch, c: CredShopify, ruta: string, init: RequestInit = {}): Promise<{ data: T; link: string | null }> {
  let res!: Response;
  for (let intento = 0; intento < 4; intento++) {
    res = await f(`${base(c)}${ruta}`, { ...init, headers: { ...cab(c), ...(init.headers ?? {}) }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if ((res.status !== 429 && res.status !== 503) || intento === 3) break;
    const espera = Number(res.headers.get('retry-after'));
    await dormir(Math.min(Number.isFinite(espera) && espera >= 0 ? espera * 1000 : 500 * 2 ** intento, 5000));
  }
  if (!res.ok) {
    const txt = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(res.status === 401 || res.status === 403
      ? 'Shopify rechazó el token: revisa que sea el de Admin API y que tenga los permisos de productos, pedidos e inventario.'
      : `Shopify respondió ${res.status}${txt ? `: ${txt}` : ''}`);
  }
  return { data: (await res.json().catch(() => ({}))) as T, link: res.headers.get('link') };
}

/** Firma de un webhook: base64(HMAC-SHA256(cuerpo crudo, secreto de la app)). */
export function firmaWebhook(cuerpo: Buffer | string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo).digest('base64');
}
export function verificarWebhook(cuerpo: Buffer, firmaRecibida: string | undefined, secreto: string): boolean {
  return Boolean(firmaRecibida) && iguales(firmaWebhook(cuerpo, secreto), firmaRecibida!);
}

export async function datosTienda(f: Fetch, c: CredShopify): Promise<{ nombre: string; ubicacionId: string }> {
  const { data: shop } = await llamar<{ shop: { name: string } }>(f, c, '/shop.json');
  const { data: locs } = await llamar<{ locations: { id: number; active: boolean }[] }>(f, c, '/locations.json');
  const loc = locs.locations?.find((l) => l.active) ?? locs.locations?.[0];
  if (!loc) throw new Error('Tu tienda de Shopify no tiene ninguna ubicación de inventario.');
  return { nombre: shop.shop.name, ubicacionId: String(loc.id) };
}

export interface ProductoExterno {
  sku: string;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  externoId: string;       // inventory_item_id
}

const sinHtml = (s: string | null | undefined) => (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

/** Variantes con SKU de toda la tienda (pagina por el encabezado Link). */
export async function listarProductos(f: Fetch, c: CredShopify, maxPaginas = 20): Promise<ProductoExterno[]> {
  const out: ProductoExterno[] = [];
  let ruta: string | null = '/products.json?limit=250&fields=id,title,body_html,image,variants';
  for (let i = 0; i < maxPaginas && ruta; i++) {
    const pagina: { data: { products: { title: string; body_html: string | null; image: { src: string } | null; variants: { sku: string | null; title: string; inventory_item_id: number }[] }[] }; link: string | null } = await llamar<{ products: { title: string; body_html: string | null; image: { src: string } | null; variants: { sku: string | null; title: string; inventory_item_id: number }[] }[] }>(f, c, ruta);
    const { data, link } = pagina;
    for (const p of data.products ?? []) {
      for (const v of p.variants ?? []) {
        const sku = (v.sku ?? '').trim();
        if (!sku) continue;
        out.push({ sku, nombre: v.title && v.title !== 'Default Title' ? `${p.title} — ${v.title}` : p.title, descripcion: sinHtml(p.body_html), imagen: p.image?.src ?? null, externoId: String(v.inventory_item_id) });
      }
    }
    const sig: string | undefined = link?.split(',').find((x: string) => x.includes('rel="next"'))?.match(/<([^>]+)>/)?.[1];
    ruta = sig ? sig.replace(/^https:\/\/[^/]+\/admin\/api\/[^/]+/, '') : null;
  }
  return out;
}

/** Deja el stock de la tienda en `disponibles` (la bodega es la verdad). */
export async function fijarStock(f: Fetch, c: CredShopify, ubicacionId: string, inventoryItemId: string, disponibles: number): Promise<void> {
  await llamar(f, c, '/inventory_levels/set.json', {
    method: 'POST',
    body: JSON.stringify({ location_id: Number(ubicacionId), inventory_item_id: Number(inventoryItemId), available: Math.max(0, Math.trunc(disponibles)) }),
  });
}

export const TEMAS_WEBHOOK = ['orders/paid', 'orders/cancelled', 'refunds/create'] as const;

export async function registrarWebhooks(f: Fetch, c: CredShopify, urlBase: string): Promise<{ id: number; topic: string }[]> {
  const creados: { id: number; topic: string }[] = [];
  for (const topic of TEMAS_WEBHOOK) {
    const { data } = await llamar<{ webhook: { id: number } }>(f, c, '/webhooks.json', {
      method: 'POST', body: JSON.stringify({ webhook: { topic, address: urlBase, format: 'json' } }),
    });
    creados.push({ id: data.webhook.id, topic });
  }
  return creados;
}

export interface WebhookTienda { id: number; topic: string; address: string }

export async function listarWebhooks(f: Fetch, c: CredShopify): Promise<WebhookTienda[]> {
  const { data } = await llamar<{ webhooks: WebhookTienda[] }>(f, c, '/webhooks.json?limit=250');
  return data.webhooks ?? [];
}

export async function borrarWebhooks(f: Fetch, c: CredShopify, ids: number[]): Promise<void> {
  for (const id of ids) await llamar(f, c, `/webhooks/${id}.json`, { method: 'DELETE' }).catch(() => undefined);
}

/** Líneas de un pedido de Shopify con SKU. */
export function lineasDePedido(pedido: { id?: number; line_items?: { id: number; sku?: string | null; quantity: number; fulfillable_quantity?: number }[] }): { pedidoId: string; lineas: LineaPedido[] } {
  return {
    pedidoId: String(pedido.id ?? ''),
    lineas: (pedido.line_items ?? [])
      .filter((l) => (l.sku ?? '').trim() && l.quantity > 0)
      .map((l) => ({ sku: l.sku!.trim(), cantidad: l.quantity, lineaId: String(l.id) })),
  };
}

/** Un reembolso de Shopify: devuelve al stock solo lo que la tienda marcó para reponer. */
export function lineasDeReembolso(r: { id?: number; order_id?: number; refund_line_items?: { line_item_id: number; quantity: number; restock_type?: string; line_item?: { sku?: string | null } }[] }): { pedidoId: string; reembolsoId: string; lineas: LineaPedido[] } {
  return {
    pedidoId: String(r.order_id ?? ''),
    reembolsoId: String(r.id ?? ''),
    lineas: (r.refund_line_items ?? [])
      .filter((l) => l.restock_type && l.restock_type !== 'no_restock' && (l.line_item?.sku ?? '').trim() && l.quantity > 0)
      .map((l) => ({ sku: l.line_item!.sku!.trim(), cantidad: l.quantity, lineaId: String(l.line_item_id) })),
  };
}
