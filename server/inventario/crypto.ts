import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Cifrado de las llaves de las tiendas (Shopify, WooCommerce).
//
// Son llaves que mueven el stock y leen los pedidos de otra empresa: no
// se guardan en claro ni siquiera en nuestra base. AES-256-GCM con una
// clave que vive solo en el servidor (INTEGRATIONS_ENC_KEY, 32 bytes en
// base64 o 64 caracteres hex). Sin esa clave, las integraciones quedan
// apagadas: preferimos no guardar nada a guardarlo mal.
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

export function claveDeCifrado(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.INTEGRATIONS_ENC_KEY?.trim();
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

export function cifradoDisponible(): boolean {
  return claveDeCifrado() !== null;
}

export function cifrar(texto: string, clave = claveDeCifrado()): string {
  if (!clave) throw new Error('INTEGRATIONS_ENC_KEY no está configurada');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave, iv);
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

export function descifrar(valor: string, clave = claveDeCifrado()): string {
  if (!clave) throw new Error('INTEGRATIONS_ENC_KEY no está configurada');
  const [v, iv, tag, ct] = valor.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Formato de secreto desconocido');
  const d = createDecipheriv('aes-256-gcm', clave, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

/** Llave de API para los sistemas del cliente: ecx_ + 32 bytes. Solo se guarda el hash. */
export function nuevaLlaveApi(): { llave: string; prefijo: string; hash: string } {
  const llave = `ecx_${randomBytes(32).toString('hex')}`;
  return { llave, prefijo: llave.slice(0, 8), hash: hashLlave(llave) };
}

export const hashLlave = (llave: string) => createHash('sha256').update(llave).digest('hex');

/** Comparación en tiempo constante de dos cadenas (firmas, secretos). */
export function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
