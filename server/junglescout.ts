import type { ResearchResult, ResearchRow } from './connectors';
import { aIngles } from './hts/glosario';

// Inteligencia de Amazon: ventas estimadas por producto y por marca, de
// la API de Jungle Scout (developer.junglescout.com). Este archivo es lo
// único que sabe hablar con ellos; el cliente ve "Amazon", nunca el
// nombre del proveedor.
//
// Lo que Jungle Scout da son ESTIMACIONES: Amazon no publica las ventas
// de nadie. Se calculan con el ranking de ventas, el precio y el
// historial. El resumen lo dice siempre, para que nadie las tome por
// ventas reales.
//
// La llamada: POST /api/product_database_query con la palabra clave. Los
// productos que vuelven traen marca, precio, ingresos y unidades de los
// últimos 30 días; acá se suman por marca, que es la pregunta del
// negocio ("¿cuánto vende cada marca de café?").
//
// Autenticación, como la documenta Jungle Scout:
//   Authorization: <nombre de la llave>:<llave>
//   X-API-Type: junglescout
// Con guion, no con guion bajo: la primera versión mandaba X_API_Type y
// los servidores que descartan encabezados con guion bajo (la mayoría de
// los proxys) la dejaban sin el tipo de API, así que no devolvía nada.

const BASE = 'https://developer.junglescout.com/api';
const ESPERA_MS = 15_000;

/** Los mercados de Amazon que cubre, con su moneda. */
export const MERCADOS: Record<string, { codigo: string; moneda: string; ingles: boolean }> = {
  US: { codigo: 'us', moneda: 'USD', ingles: true },
  CA: { codigo: 'ca', moneda: 'CAD', ingles: true },
  GB: { codigo: 'uk', moneda: 'GBP', ingles: true },
  DE: { codigo: 'de', moneda: 'EUR', ingles: false },
  FR: { codigo: 'fr', moneda: 'EUR', ingles: false },
  IT: { codigo: 'it', moneda: 'EUR', ingles: false },
  ES: { codigo: 'es', moneda: 'EUR', ingles: false },
  MX: { codigo: 'mx', moneda: 'MXN', ingles: false },
  IN: { codigo: 'in', moneda: 'INR', ingles: true },
  JP: { codigo: 'jp', moneda: 'JPY', ingles: false },
};

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): { nombre: string; llave: string } | null {
  const nombre = env.JUNGLESCOUT_API_KEY_NAME?.trim();
  const llave = env.JUNGLESCOUT_API_KEY?.trim();
  return nombre && llave ? { nombre, llave } : null;
}

export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return leerConfiguracion(env) !== null;
}

export function missingConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  const falta: string[] = [];
  if (!env.JUNGLESCOUT_API_KEY_NAME?.trim()) falta.push('JUNGLESCOUT_API_KEY_NAME');
  if (!env.JUNGLESCOUT_API_KEY?.trim()) falta.push('JUNGLESCOUT_API_KEY');
  return falta;
}

/**
 * La palabra clave en el idioma del mercado: amazon.com busca en inglés,
 * así que "café tostado" se manda como "coffee roasted". En México o
 * España se deja como la escribió la persona.
 */
export function palabraClave(consulta: string, ingles: boolean): string {
  const limpia = consulta.trim().slice(0, 80);
  if (!ingles) return limpia;
  const { terminos, traducidas } = aIngles(limpia);
  return traducidas > 0 && terminos.length ? terminos.slice(0, 4).join(' ') : limpia;
}

export interface Producto {
  asin: string;
  titulo: string;
  marca: string;
  precio: number | null;
  ingresos30: number | null;
  unidades30: number | null;
  resenas: number | null;
}

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** `{ data: [{ id: "us/B0…", attributes: {...} }], meta: { total_items } }` */
export function leerProductos(cuerpo: unknown): { productos: Producto[]; total: number | null } {
  const c = cuerpo as { data?: unknown; meta?: { total_items?: unknown } } | null;
  const lista = Array.isArray(c?.data) ? (c!.data as Array<{ id?: unknown; attributes?: Record<string, unknown> }>) : [];
  const productos: Producto[] = [];
  for (const r of lista) {
    const a = r?.attributes;
    if (!a || typeof a !== 'object') continue;
    const id = typeof r.id === 'string' ? r.id : '';
    productos.push({
      asin: id.includes('/') ? id.split('/')[1] : id,
      titulo: typeof a.title === 'string' ? a.title : '',
      marca: typeof a.brand === 'string' && a.brand.trim() ? a.brand.trim() : 'Sin marca',
      precio: numero(a.price),
      ingresos30: numero(a.approximate_30_day_revenue),
      unidades30: numero(a.approximate_30_day_units_sold),
      resenas: numero(a.reviews),
    });
  }
  return { productos, total: numero(c?.meta?.total_items) };
}

export interface Marca {
  marca: string;
  ingresos30: number;
  unidades30: number;
  productos: number;
}

/**
 * Suma por marca. Un producto sin estimación de ingresos no suma cero:
 * no suma, y la marca cuenta sólo lo que sí se sabe.
 */
export function porMarca(productos: Producto[]): Marca[] {
  const mapa = new Map<string, Marca>();
  for (const p of productos) {
    const clave = p.marca.toLowerCase();
    const m = mapa.get(clave) ?? { marca: p.marca, ingresos30: 0, unidades30: 0, productos: 0 };
    m.ingresos30 += p.ingresos30 ?? 0;
    m.unidades30 += p.unidades30 ?? 0;
    m.productos += 1;
    mapa.set(clave, m);
  }
  return Array.from(mapa.values()).sort((a, b) => b.ingresos30 - a.ingresos30);
}

function dinero(n: number, moneda: string): string {
  const redondo = n >= 1000 ? Math.round(n) : Math.round(n * 100) / 100;
  return `${moneda} ${redondo.toLocaleString('en-US')}`;
}

export function toResult(consulta: string, mercado: string, cuerpo: unknown): ResearchResult {
  const m = MERCADOS[mercado] ?? MERCADOS.US;
  const { productos, total } = leerProductos(cuerpo);
  const donde = `Amazon ${mercado}`;
  if (!productos.length) {
    return { summary: `Sin productos para "${consulta}" en ${donde}.`, rows: [] };
  }

  const marcas = porMarca(productos);
  const suma = marcas.reduce((s, x) => s + x.ingresos30, 0);
  const rows: ResearchRow[] = marcas.slice(0, 8).map((x) => ({
    label: x.marca,
    value: `${dinero(x.ingresos30, m.moneda)}/mes · ${x.unidades30.toLocaleString('en-US')} unidades · ${x.productos} producto${x.productos === 1 ? '' : 's'}${suma > 0 ? ` · ${Math.round((x.ingresos30 / suma) * 100)} %` : ''}`,
  }));
  for (const p of productos.filter((x) => x.ingresos30 !== null).sort((a, b) => (b.ingresos30 ?? 0) - (a.ingresos30 ?? 0)).slice(0, 3)) {
    rows.push({
      label: `Top: ${p.titulo.slice(0, 70)}`,
      value: `${p.marca} · ${p.precio !== null ? dinero(p.precio, m.moneda) : 's/p'} · ${dinero(p.ingresos30 ?? 0, m.moneda)}/mes`,
    });
  }

  return {
    summary: `${donde}: ${marcas.length} marcas en los ${productos.length} productos que más venden para "${consulta}"${total ? ` (de ${total.toLocaleString('en-US')})` : ''}. Ventas ESTIMADAS de los últimos 30 días, no reportadas por Amazon.`,
    rows,
    total: total ?? productos.length,
  };
}

type Fetch = typeof fetch;

/** Falla con el detalle para el log; el mensaje al cliente lo arma quien llama. */
export async function runJungleScout(consulta: string, pais?: string, hacer: Fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<ResearchResult> {
  const config = leerConfiguracion(env);
  if (!config) throw new Error(`amazon no configurado (${missingConfig(env).join(', ')})`);
  const mercado = pais && MERCADOS[pais.toUpperCase()] ? pais.toUpperCase() : 'US';
  const m = MERCADOS[mercado];
  const clave = palabraClave(consulta, m.ingles);
  if (!clave) throw new Error('amazon: consulta vacía');

  const url = `${BASE}/product_database_query?marketplace=${m.codigo}&sort=-revenue&page[size]=50`;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  let res: Response;
  try {
    res = await hacer(url, {
      method: 'POST',
      headers: {
        Authorization: `${config.nombre}:${config.llave}`,
        'X-API-Type': 'junglescout',
        Accept: 'application/vnd.junglescout.v1+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'product_database_query',
          attributes: { include_keywords: [clave], exclude_unavailable_products: true },
        },
      }),
      signal: control.signal,
    });
  } finally {
    clearTimeout(reloj);
  }

  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const errores = (cuerpo as { errors?: Array<{ title?: string; detail?: string }> } | null)?.errors;
    const detalle = Array.isArray(errores) ? errores.map((e) => e.detail || e.title).filter(Boolean).join(' | ').slice(0, 200) : '';
    throw new Error(`jungle scout respondió ${res.status}${detalle ? ` (${detalle})` : ''}`);
  }
  return toResult(consulta, mercado, cuerpo);
}
