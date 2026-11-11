import { createHmac } from 'node:crypto';
import { iguales } from './crypto';
import type { LineaPedido } from './movimientos';
import type { ProductoExterno } from './shopify';

// WordPress / WooCommerce (REST API v3). El cliente genera una clave en
// WooCommerce > Ajustes > Avanzado > API REST (permisos de lectura y
// escritura) y nos da la dirección del sitio, la Consumer key (ck_…) y la
// Consumer secret (cs_…). La dirección del sitio SOLO se acepta tras
// pasar por urlTiendaPublica() (seguridad.ts).

export type Fetch = typeof fetch;

export interface CredWoo {
  url: string;            // https://mitienda.com (ya validada)
  clave: string;          // ck_...
  secreto: string;        // cs_...
}

const auth = (c: CredWoo) => `Basic ${Buffer.from(`${c.clave}:${c.secreto}`).toString('base64')}`;

async function llamar<T>(f: Fetch, c: CredWoo, ruta: string, init: RequestInit = {}): Promise<{ data: T; paginas: number }> {
  const res = await f(`${c.url}/wp-json/wc/v3${ruta}`, {
    ...init,
    headers: { Authorization: auth(c), 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const txt = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(res.status === 401 || res.status === 403
      ? 'WooCommerce rechazó las llaves: revisa que sean de lectura y escritura y que el sitio use https.'
      : `WooCommerce respondió ${res.status}${txt ? `: ${txt}` : ''}`);
  }
  return { data: (await res.json().catch(() => ({}))) as T, paginas: Number(res.headers.get('x-wp-totalpages') ?? 1) };
}

/** Firma de un webhook de Woo: base64(HMAC-SHA256(cuerpo crudo, secreto del webhook)). */
export function firmaWebhook(cuerpo: Buffer | string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo).digest('base64');
}
export function verificarWebhook(cuerpo: Buffer, firmaRecibida: string | undefined, secreto: string): boolean {
  return Boolean(firmaRecibida) && iguales(firmaWebhook(cuerpo, secreto), firmaRecibida!);
}

export async function verificarCredenciales(f: Fetch, c: CredWoo): Promise<void> {
  await llamar(f, c, '/products?per_page=1');
}

interface WooProducto { id: number; name: string; sku: string; type: string; description: string; images?: { src: string }[] }
interface WooVariacion { id: number; sku: string; attributes?: { option: string }[]; image?: { src: string } | null }

const sinHtml = (s: string | null | undefined) => (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

/** Productos simples y variaciones con SKU. externoId = id del producto; externoExtra = id de la variación. */
export async function listarProductos(f: Fetch, c: CredWoo, maxPaginas = 20): Promise<(ProductoExterno & { externoExtra: string | null })[]> {
  const out: (ProductoExterno & { externoExtra: string | null })[] = [];
  for (let pag = 1; pag <= maxPaginas; pag++) {
    const { data, paginas } = await llamar<WooProducto[]>(f, c, `/products?per_page=100&page=${pag}&status=publish`);
    for (const p of data) {
      const imagen = p.images?.[0]?.src ?? null;
      if (p.type === 'variable') {
        const { data: vars } = await llamar<WooVariacion[]>(f, c, `/products/${p.id}/variations?per_page=100`);
        for (const v of vars) {
          const sku = (v.sku ?? '').trim();
          if (!sku) continue;
          const opc = (v.attributes ?? []).map((a) => a.option).join(' / ');
          out.push({ sku, nombre: opc ? `${p.name} — ${opc}` : p.name, descripcion: sinHtml(p.description), imagen: v.image?.src ?? imagen, externoId: String(p.id), externoExtra: String(v.id) });
        }
      } else if ((p.sku ?? '').trim()) {
        out.push({ sku: p.sku.trim(), nombre: p.name, descripcion: sinHtml(p.description), imagen, externoId: String(p.id), externoExtra: null });
      }
    }
    if (pag >= paginas) break;
  }
  return out;
}

export async function fijarStock(f: Fetch, c: CredWoo, productoId: string, variacionId: string | null, disponibles: number): Promise<void> {
  const ruta = variacionId ? `/products/${productoId}/variations/${variacionId}` : `/products/${productoId}`;
  await llamar(f, c, ruta, { method: 'PUT', body: JSON.stringify({ manage_stock: true, stock_quantity: Math.max(0, Math.trunc(disponibles)) }) });
}

export const TEMAS_WEBHOOK = ['order.created', 'order.updated'] as const;

export async function registrarWebhooks(f: Fetch, c: CredWoo, urlEntrega: string, secreto: string): Promise<number[]> {
  const ids: number[] = [];
  for (const topic of TEMAS_WEBHOOK) {
    const { data } = await llamar<{ id: number }>(f, c, '/webhooks', {
      method: 'POST', body: JSON.stringify({ name: `Easycomex ${topic}`, topic, delivery_url: urlEntrega, secret: secreto, status: 'active' }),
    });
    ids.push(data.id);
  }
  return ids;
}

export interface WebhookWoo { id: number; topic: string; delivery_url: string; status: string }

export async function listarWebhooks(f: Fetch, c: CredWoo): Promise<WebhookWoo[]> {
  const { data } = await llamar<WebhookWoo[]>(f, c, '/webhooks?per_page=100');
  return Array.isArray(data) ? data : [];
}

export async function borrarWebhooks(f: Fetch, c: CredWoo, ids: number[]): Promise<void> {
  for (const id of ids) await llamar(f, c, `/webhooks/${id}?force=true`, { method: 'DELETE' }).catch(() => undefined);
}

/** Estados de pedido de Woo que descuentan stock / lo devuelven. */
export const ESTADOS_VENTA = new Set(['processing', 'completed', 'on-hold']);
export const ESTADOS_ANULADO = new Set(['cancelled', 'refunded', 'failed']);

export function lineasDePedido(pedido: { id?: number; status?: string; line_items?: { id: number; sku?: string | null; quantity: number }[] }): { pedidoId: string; estado: string; lineas: LineaPedido[] } {
  return {
    pedidoId: String(pedido.id ?? ''),
    estado: String(pedido.status ?? ''),
    lineas: (pedido.line_items ?? [])
      .filter((l) => (l.sku ?? '').trim() && l.quantity > 0)
      .map((l) => ({ sku: l.sku!.trim(), cantidad: l.quantity, lineaId: String(l.id) })),
  };
}
