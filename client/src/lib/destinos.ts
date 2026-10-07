// Los países de destino de la calculadora ROI y de dónde sale el arancel
// de cada uno. Lo usan los dos lados: el navegador para el selector, el
// servidor para saber a qué arancel preguntar.
//
// Están todos los países. Tres fuentes traen el arancel oficial: el HTS
// cargado (EE. UU.) y el Trade Tariff británico, en vivo, para el Reino
// Unido y los 27 de la UE (que comparten el arancel común). En los demás
// ('manual') el cliente escribe la tarifa de su subpartida: la página le
// dice cuál es y dónde buscarla. Conectar la fuente oficial de un país es
// cambiar su fuente acá y agregar el lector en server/destinos.

import type { Tasa } from './tasaArancel';
import { PAISES, UNION_EUROPEA } from './paises';

export type FuenteArancel = 'hts' | 'uk' | 'xi' | 'manual';

export interface Destino {
  iso: string;
  nombre: string;
  nombreEn: string;
  fuente: FuenteArancel;
  /** Sobre qué valor se cobra el arancel en ese destino. */
  base: 'fob' | 'cif';
}

/**
 * Los que cobran el arancel sobre el valor FOB (sin el flete
 * internacional): EE. UU., Canadá, Australia, Nueva Zelanda y la unión
 * aduanera del sur de África. Los demás, sobre el CIF.
 */
export const BASE_FOB = new Set(['US', 'CA', 'AU', 'NZ', 'ZA', 'BW', 'LS', 'NA', 'SZ']);

/** Territorios de EE. UU.: entran con su arancel o no tienen aduana propia que importe acá. */
const SIN_DESTINO = new Set(['US', 'PR', 'VI', 'GU', 'AS', 'MP']);

const UE = new Set(UNION_EUROPEA);

export const DESTINOS: Destino[] = [
  { iso: 'US', nombre: 'Estados Unidos', nombreEn: 'United States', fuente: 'hts', base: 'fob' },
  { iso: 'GB', nombre: 'Reino Unido', nombreEn: 'United Kingdom', fuente: 'uk', base: 'cif' },
  // Los de la UE primero, por nombre.
  ...PAISES.filter((p) => UE.has(p.iso)).map((p): Destino => ({ iso: p.iso, nombre: `${p.es} (UE)`, nombreEn: `${p.en} (EU)`, fuente: 'xi', base: 'cif' })),
  ...PAISES.filter((p) => !UE.has(p.iso) && !SIN_DESTINO.has(p.iso) && p.iso !== 'GB').map(
    (p): Destino => ({ iso: p.iso, nombre: p.es, nombreEn: p.en, fuente: 'manual', base: BASE_FOB.has(p.iso) ? 'fob' : 'cif' })
  ),
];

const POR_ISO = new Map(DESTINOS.map((d) => [d.iso, d]));

/**
 * Los mercados a los que más exportan los clientes, arriba del selector
 * y en este orden. El resto va debajo: la UE y después todos los demás.
 */
export const DESTINOS_PRINCIPALES = [
  'US', 'CA', 'MX', 'GB', 'ES', 'DE', 'FR', 'IT', 'NL', 'JP', 'KR', 'AU', 'CN', 'AE', 'SA', 'CH', 'CL', 'CO', 'PE', 'BR', 'PA', 'CR',
];

export function destino(iso: string): Destino | null {
  return POR_ISO.get(iso) ?? null;
}

/**
 * Vender en el propio mercado: el mismo país, o dos países de la UE (un
 * solo territorio aduanero). Ahí no hay arancel de importación.
 */
export function mismoMercado(destinoIso: string, origenIso: string): boolean {
  return destinoIso === origenIso || (UE.has(destinoIso) && UE.has(origenIso));
}

/** El destino trae su arancel oficial en vivo (no lo escribe el cliente). */
export const conArancelEnVivo = (d: Destino) => d.fuente !== 'manual';

export const NOMBRE_DE_FUENTE: Record<FuenteArancel, string> = {
  hts: 'Harmonized Tariff Schedule de EE. UU. (USITC)',
  uk: 'UK Global Tariff (Trade Tariff, gobierno del Reino Unido)',
  xi: 'Arancel común de la UE (TARIC), publicado por el Trade Tariff del gobierno del Reino Unido para Irlanda del Norte',
  manual: 'Tarifa que escribe el cliente para su subpartida',
};

export interface LineaDestino {
  codigo: string;
  descripcion: string;
}

export interface ArancelDestino {
  codigo: string;
  descripcion: string;
  general: Tasa | null;
  preferencial: { tasa: Tasa; acuerdo: string } | null;
  avisos: string[];
  fuente: string;
}

async function pedir<T>(ruta: string): Promise<{ ok: true; datos: T } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(ruta);
    const cuerpo = await res.json().catch(() => null);
    if (res.ok && cuerpo) return { ok: true, datos: cuerpo as T };
    return { ok: false, mensaje: (cuerpo as { mensaje?: string } | null)?.mensaje ?? 'El arancel del destino no respondió. Prueba de nuevo en unos minutos.' };
  } catch {
    return { ok: false, mensaje: 'Sin conexión: no se pudo consultar el arancel del destino.' };
  }
}

export function lineasDelDestino(iso: string, hs6: string) {
  return pedir<{ lineas: LineaDestino[] }>(`/api/destinos/${iso}/lineas?hs6=${hs6}`);
}

export function arancelDelDestino(iso: string, codigo: string, origen: string) {
  return pedir<ArancelDestino>(`/api/destinos/${iso}/linea/${codigo}?origen=${origen}`);
}
