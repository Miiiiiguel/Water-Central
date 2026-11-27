import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTasa, type Tasa } from '../../client/src/lib/tasaArancel';

// Los aranceles oficiales de otros países, descargados de cada aduana y
// guardados con la app, igual que el de EE. UU. (server/hts).
//
// Cada archivo (arancel-<ID>.ndjson.gz) tiene una fila por renglón del
// arancel, en el orden oficial:
//   { c: código (sólo dígitos; '' en un renglón de grupo), n: nivel,
//     d: descripción, t: tasa general como la publica el país, f: es la
//     línea que se declara }
// y arancel-<ID>.meta.json dice de dónde salió, cuándo y qué no incluye.
//
// Los arma scripts/aranceles/ a partir de los archivos oficiales. Acá sólo
// se leen: nada se completa ni se inventa. Una línea sin tasa publicada
// vuelve sin tasa, y la calculadora usa el estimado y lo dice.

export interface FilaArancel {
  c: string;
  n: number;
  d: string;
  t: string | null;
  f: boolean;
  /** El texto original en inglés, si `d` ya está en español (scripts/aranceles/traducir_es.py). */
  o?: string;
}

export interface MetaArancel {
  pais: string;
  fuente: string;
  url: string;
  idioma: string;
  nota: string;
  descargado?: string;
  lineas?: number;
}

interface Registro {
  fila: FilaArancel;
  /** Las descripciones desde la partida de 4 dígitos hasta esta fila. */
  ruta: string[];
}

interface Indice {
  meta: MetaArancel;
  lineas: Registro[];
  porCodigo: Map<string, Registro>;
  /** Los textos de las filas que siguen en inglés (sin `o`). */
  enIngles: Set<string>;
}

/** Qué archivo usa cada país de destino. */
export const ARANCEL_DE: Record<string, string> = {
  MX: 'MX',
  CA: 'CA',
  CO: 'CO',
  CL: 'CL',
  PE: 'PE',
  BR: 'BR',
  // El resto del Mercosur aplica la Tarifa Externa Común (con sus excepciones nacionales).
  AR: 'MERCOSUR',
  UY: 'MERCOSUR',
  PY: 'MERCOSUR',
};

/** Los aranceles cuyas tarifas específicas no están en USD. */
const MONEDA_LOCAL: Record<string, string> = { CA: 'dólares canadienses (CAD)' };

/** La UE: el arancel común descargado, para cuando la consulta en vivo no responde. */
export const ARANCEL_UE = 'UE';

function ruta(nombre: string): string {
  // En desarrollo, junto a este archivo; compilado, en dist/ (scripts/copy-hts.mjs).
  return join(dirname(fileURLToPath(import.meta.url)), nombre);
}

const cache = new Map<string, Indice | null>();

function limpiar(d: string): string {
  return d.replace(/\s+/g, ' ').replace(/[:.;]\s*$/, '').trim();
}

export function construir(filas: FilaArancel[], meta: MetaArancel): Indice {
  const lineas: Registro[] = [];
  const porCodigo = new Map<string, Registro>();
  const enIngles = new Set<string>();
  // Pila de ancestros por nivel, como en el HTS.
  const pila: FilaArancel[] = [];
  for (const fila of filas) {
    while (pila.length && pila[pila.length - 1].n >= fila.n) pila.pop();
    const ancestros = pila.filter((p) => p.n > 0);
    // Sin repetir: en México la fracción suele repetir el texto de su subpartida.
    const partes = [...ancestros.map((a) => limpiar(a.d)), limpiar(fila.d)].filter(Boolean);
    const ruta = partes.filter((d, i) => i === 0 || d.toLowerCase() !== partes[i - 1].toLowerCase());
    const reg: Registro = { fila, ruta };
    if (fila.c) porCodigo.set(fila.c, reg);
    if (fila.o === undefined && fila.d.trim()) enIngles.add(limpiar(fila.d));
    if (fila.f && fila.c) lineas.push(reg);
    pila.push(fila);
  }
  return { meta, lineas, porCodigo, enIngles };
}

export function cargarArancel(id: string): Indice | null {
  if (cache.has(id)) return cache.get(id)!;
  const archivo = ruta(`arancel-${id}.ndjson.gz`);
  if (!existsSync(archivo)) {
    cache.set(id, null);
    return null;
  }
  const filas = gunzipSync(readFileSync(archivo))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as FilaArancel);
  let meta: MetaArancel = { pais: id, fuente: '', url: '', idioma: 'es', nota: '' };
  try {
    meta = { ...meta, ...JSON.parse(readFileSync(ruta(`arancel-${id}.meta.json`), 'utf8')) };
  } catch {
    /* sin ficha: el arancel sirve igual */
  }
  const idx = construir(filas, meta);
  cache.set(id, idx);
  return idx;
}

/** Sólo para las pruebas. */
export function usarArancel(id: string, idx: Indice | null): void {
  cache.set(id, idx);
}

export interface LineaLocal {
  codigo: string;
  descripcion: string;
}

/** Las líneas que se declaran dentro de una subpartida de 6 dígitos. */
export function lineasLocales(id: string, hs6: string): LineaLocal[] | null {
  const idx = cargarArancel(id);
  if (!idx) return null;
  return idx.lineas
    .filter((r) => r.fila.c.startsWith(hs6))
    .map((r) => ({ codigo: r.fila.c, descripcion: r.ruta.slice(-3).join(' › ') || 'Sin descripción' }));
}

/**
 * La tasa como la publica cada país, en el formato que entiende el
 * cálculo: "Ex." (exento, México) es 0 %; "12.6% BK" (bienes de capital,
 * Brasil) es 12.6 %. Lo compuesto ("20% + 0.36 USD/kg de azúcar") queda
 * como texto y no se calcula: lo confirma el agente de aduanas.
 */
export function tasaLocal(texto: string | null): { tasa: Tasa | null; aviso: string | null } {
  if (texto === null || texto.trim() === '') return { tasa: null, aviso: null };
  const t = texto.trim();
  // "N/A" (Canadá): el arancel no publica una tarifa NMF para esa línea.
  if (/^n\/a$/i.test(t)) return { tasa: null, aviso: null };
  if (/^ex\.?$/i.test(t)) return { tasa: { ...parseTasa('0%'), texto: 'Exento (0 %)' }, aviso: null };
  const bk = /^(\d+(?:\.\d+)?)%\s*(BK|BIT)$/i.exec(t);
  if (bk) {
    return {
      tasa: { ...parseTasa(`${bk[1]}%`), texto: `${bk[1]}%` },
      aviso: `Bien de ${bk[2].toUpperCase() === 'BK' ? 'capital' : 'informática y telecomunicaciones'} (${bk[2].toUpperCase()}): puede pedirse una reducción ("ex-tarifário").`,
    };
  }
  return { tasa: parseTasa(t), aviso: null };
}

export interface ArancelLocal {
  codigo: string;
  descripcion: string;
  general: Tasa | null;
  preferencial: null;
  avisos: string[];
  fuente: string;
  vivo: false;
}

export function arancelLocal(id: string, codigo: string): ArancelLocal | null {
  const idx = cargarArancel(id);
  const reg = idx?.porCodigo.get(codigo);
  if (!idx || !reg || !reg.fila.f) return null;
  const leida = tasaLocal(reg.fila.t);
  const { aviso } = leida;
  let { tasa } = leida;
  // Las tarifas por kilo, litro o tonelada de Canadá van en dólares
  // canadienses (y "¢" son centavos canadienses): el cálculo, que trabaja en
  // USD, no las usa como si fueran de EE. UU.
  if (tasa && MONEDA_LOCAL[id] && tasa.componentes.some((c) => c.tipo === 'especifico')) {
    tasa = { ...tasa, componentes: [], calculable: false, necesita: [], motivo: `Tarifa en ${MONEDA_LOCAL[id]} por unidad: confírmala con tu agente de aduanas.` };
  }
  const avisos = [
    ...(aviso ? [aviso] : []),
    ...(tasa === null ? ['Esta línea no trae tarifa publicada en el archivo oficial: confírmala con tu agente de aduanas.'] : []),
    'Es la tarifa general (sin tratado). Si tu país tiene un acuerdo comercial con el destino y el producto cumple las reglas de origen, puede pagar menos o 0 %.',
    ...(idx.meta.nota ? [idx.meta.nota] : []),
  ];
  return {
    codigo,
    descripcion: reg.ruta.slice(-3).join(' › '),
    general: tasa,
    preferencial: null,
    avisos,
    fuente: idx.meta.fuente,
    vivo: false,
  };
}

/** La descripción de una línea en el arancel descargado (para la UE en vivo, que llega en inglés). */
export function descripcionLocal(id: string, codigo: string): string | null {
  const reg = cargarArancel(id)?.porCodigo.get(codigo);
  return reg ? reg.ruta.slice(-3).join(' › ') : null;
}

// Los aranceles publicados en inglés: lo que quedó sin traducir al
// descargarlos se traduce al mostrarlo (server/hts/traduccion.ts), y sólo
// se aceptan textos que de verdad están en ellos.
const EN_INGLES = ['CA', ARANCEL_UE];
let pendientes: Set<string> | null = null;

/** ¿Es una parte de descripción, todavía en inglés, de un arancel descargado? */
export function esDescripcionLocal(texto: string): boolean {
  if (!pendientes) {
    pendientes = new Set();
    for (const id of EN_INGLES) {
      cargarArancel(id)?.enIngles.forEach((t) => pendientes!.add(t));
    }
  }
  return pendientes.has(texto.trim());
}

/** Qué hay cargado, para el panel del equipo. */
export function resumenAranceles(): Array<{ id: string; pais: string; lineas: number; fuente: string; descargado: string | null }> {
  return Array.from(new Set([...Object.values(ARANCEL_DE), ARANCEL_UE])).map((id) => {
    const idx = cargarArancel(id);
    return { id, pais: idx?.meta.pais ?? id, lineas: idx?.lineas.length ?? 0, fuente: idx?.meta.fuente ?? 'no cargado', descargado: idx?.meta.descargado ?? null };
  });
}
