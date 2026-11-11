import { createHmac, randomBytes } from 'node:crypto';
import { iguales } from './crypto';
import type { Fetch } from './shopify';

// «Conectar con Shopify»: el flujo de autorización estándar de Shopify.
//
//   1. El cliente escribe su tienda (mi-tienda.myshopify.com) y pulsa el botón.
//   2. Le damos una dirección de Shopify con un `state` firmado que dice QUIÉN
//      lo pidió, para QUÉ tienda y hasta cuándo.
//   3. Shopify le pregunta si acepta los permisos y lo devuelve a nuestro
//      `callback` con un código de un solo uso y una firma (`hmac`).
//   4. Verificamos la firma y el `state`, cambiamos el código por el token de
//      acceso y dejamos la tienda conectada, igual que con el método anterior.
//
// Funciona con una app de Easycomex creada en Shopify (Dev Dashboard); sus dos
// claves viven solo en el servidor (SHOPIFY_CLIENT_ID y SHOPIFY_CLIENT_SECRET).

// read_locations: desde la versión 2024-10 de la API, leer las ubicaciones de la tienda exige su propio permiso (sin él, Shopify responde 403).
export const SCOPES = ['read_products', 'read_orders', 'read_inventory', 'write_inventory', 'read_locations'] as const;
export const RUTA_CALLBACK = '/api/inventario/shopify/callback';

export interface AppShopify { clientId: string; clientSecret: string }

export function appShopify(env: NodeJS.ProcessEnv = process.env): AppShopify | null {
  const clientId = env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = env.SHOPIFY_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** La dirección a la que Shopify devuelve al cliente (debe estar permitida en la app de Shopify). */
export const urlRetorno = (base: string) => `${base.replace(/\/$/, '')}${RUTA_CALLBACK}`;

/* ------------------------------ state firmado ------------------------------ */

const VIGENCIA_MS = 10 * 60_000;
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const firmar = (cuerpo: string, secreto: string) => createHmac('sha256', `easycomex:shopify-state:${secreto}`).update(cuerpo).digest('base64url');

export function crearEstado(userId: string, dominio: string, secreto: string, ahora = Date.now()): string {
  const cuerpo = b64(JSON.stringify({ u: userId, s: dominio, n: randomBytes(12).toString('hex'), e: Math.floor((ahora + VIGENCIA_MS) / 1000) }));
  return `${cuerpo}.${firmar(cuerpo, secreto)}`;
}

export type LecturaEstado = { ok: true; userId: string; dominio: string } | { ok: false; motivo: 'estado' | 'vencido' };

export function leerEstado(estado: string, secreto: string, ahora = Date.now()): LecturaEstado {
  const [cuerpo, firma, resto] = String(estado ?? '').split('.');
  if (!cuerpo || !firma || resto !== undefined || !iguales(firmar(cuerpo, secreto), firma)) return { ok: false, motivo: 'estado' };
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as { u?: unknown; s?: unknown; e?: unknown };
    if (typeof d.u !== 'string' || typeof d.s !== 'string' || typeof d.e !== 'number') return { ok: false, motivo: 'estado' };
    if (d.e * 1000 < ahora) return { ok: false, motivo: 'vencido' };
    return { ok: true, userId: d.u, dominio: d.s };
  } catch {
    return { ok: false, motivo: 'estado' };
  }
}

/* ------------------------------ firma de Shopify ------------------------------ */

/**
 * Shopify firma la consulta con que devuelve al cliente: HMAC-SHA256 (hex) con la
 * clave secreta de la app sobre los parámetros (sin `hmac`) ordenados y unidos
 * con «&». Cualquier parámetro que no sea un texto simple se rechaza.
 */
export function verificarHmacConsulta(consulta: Record<string, unknown>, secreto: string): boolean {
  const recibido = consulta.hmac;
  if (typeof recibido !== 'string' || !recibido) return false;
  const pares: [string, string][] = [];
  for (const [k, v] of Object.entries(consulta)) {
    if (k === 'hmac' || k === 'signature') continue;
    if (typeof v !== 'string') return false;
    pares.push([k.replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D'), v.replace(/%/g, '%25').replace(/&/g, '%26')]);
  }
  pares.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const esperado = createHmac('sha256', secreto).update(pares.map(([k, v]) => `${k}=${v}`).join('&')).digest('hex');
  return iguales(esperado, recibido.toLowerCase());
}

/* ------------------------------ autorización ------------------------------ */

export function urlAutorizar(p: { dominio: string; clientId: string; redirectUri: string; estado: string }): string {
  const u = new URL(`https://${p.dominio}/admin/oauth/authorize`);
  u.searchParams.set('client_id', p.clientId);
  u.searchParams.set('scope', SCOPES.join(','));
  u.searchParams.set('redirect_uri', p.redirectUri);
  u.searchParams.set('state', p.estado);
  return u.toString();
}

/** Cambia el código de un solo uso por el token de acceso de la tienda. */
export async function cambiarCodigo(f: Fetch, app: AppShopify, dominio: string, codigo: string): Promise<{ token: string; permisos: string[] }> {
  const res = await f(`https://${dominio}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code: codigo }),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { access_token?: unknown; scope?: unknown };
  if (!res.ok || typeof cuerpo.access_token !== 'string' || !cuerpo.access_token) {
    throw new Error('Shopify no aceptó la autorización: el código venció o ya se usó.');
  }
  return { token: cuerpo.access_token, permisos: String(cuerpo.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean) };
}

/** Permisos que pedimos y Shopify no concedió. Un permiso de escritura incluye el de lectura. */
export function faltanPermisos(otorgados: string[]): string[] {
  return SCOPES.filter((s) => !otorgados.includes(s) && !(s.startsWith('read_') && otorgados.includes(s.replace('read_', 'write_'))));
}

/* ------------------------------ resultado hacia el navegador ------------------------------ */

export type MotivoError = 'config' | 'hmac' | 'estado' | 'vencido' | 'tienda' | 'permisos' | 'ocupada' | 'shopify';

/** Ruta de vuelta al portal del cliente con el resultado (solo códigos, nunca texto de Shopify). */
export function rutaDeVuelta(r: { ok: true; id: string; reconectada: boolean } | { ok: false; motivo: MotivoError }): string {
  const q = new URLSearchParams(r.ok ? { shopify: 'ok', id: r.id, ...(r.reconectada ? { reconectada: '1' } : {}) } : { shopify: 'error', motivo: r.motivo });
  return `/casillero/integraciones?${q.toString()}`;
}
