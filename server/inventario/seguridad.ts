import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// El servidor va a llamar a la dirección que escribe el cliente (su tienda
// de WooCommerce). Sin cuidado, eso es SSRF: pedirle al servidor que le
// hable a localhost, a la red interna del hosting o al servicio de
// metadatos de la nube. Por eso solo se acepta https, sin credenciales en
// la URL, en el puerto 443 y a un nombre que resuelva únicamente a
// direcciones públicas.

const SHOPIFY_RE = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;

/** "https://Mi-Tienda.myshopify.com/" -> "mi-tienda.myshopify.com", o null si no es un dominio de Shopify. */
export function normalizarDominioShopify(entrada: string): string | null {
  const d = entrada.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return SHOPIFY_RE.test(d) ? d : null;
}

export function esIpPrivada(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    if (x.startsWith('::ffff:')) return esIpPrivada(x.slice(7));
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true; // lo que no es una IP válida no se acepta
}

export type Resolver = (host: string) => Promise<string[]>;
const resolverReal: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

/** Devuelve el origen público (https://dominio) o lanza un Error con un mensaje para el usuario. */
export async function urlTiendaPublica(entrada: string, resolver: Resolver = resolverReal): Promise<string> {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(entrada.trim()) ? entrada.trim() : `https://${entrada.trim()}`);
  } catch {
    throw new Error('La dirección de la tienda no es válida.');
  }
  if (u.protocol !== 'https:') throw new Error('La tienda debe usar https.');
  if (u.username || u.password) throw new Error('La dirección no puede llevar usuario ni clave.');
  if (u.port && u.port !== '443') throw new Error('Solo se aceptan tiendas en el puerto estándar (443).');
  const host = u.hostname.toLowerCase();
  if (isIP(host) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) {
    throw new Error('La dirección de la tienda debe ser un dominio público.');
  }
  let ips: string[];
  try {
    ips = await resolver(host);
  } catch {
    throw new Error('No pudimos encontrar esa tienda en internet.');
  }
  if (!ips.length || ips.some(esIpPrivada)) throw new Error('La dirección de la tienda debe ser un dominio público.');
  return `https://${host}`;
}
