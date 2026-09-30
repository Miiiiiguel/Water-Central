// Los países de destino de la calculadora ROI y de dónde sale el arancel
// de cada uno. Lo usan los dos lados: el navegador para el selector, el
// servidor para saber a qué arancel preguntar.
//
// Sólo están los destinos con un arancel oficial consultable. Agregar uno
// es agregar su fuente, no una fila acá.

import type { Tasa } from './tasaArancel';

export type FuenteArancel = 'hts' | 'uk' | 'xi';

export interface Destino {
  iso: string;
  nombre: string;
  nombreEn: string;
  fuente: FuenteArancel;
  /** Sobre qué valor se cobra el arancel en ese destino. */
  base: 'fob' | 'cif';
}

export const DESTINOS: Destino[] = [
  { iso: 'US', nombre: 'Estados Unidos', nombreEn: 'United States', fuente: 'hts', base: 'fob' },
  { iso: 'GB', nombre: 'Reino Unido', nombreEn: 'United Kingdom', fuente: 'uk', base: 'cif' },
  { iso: 'DE', nombre: 'Alemania (UE)', nombreEn: 'Germany (EU)', fuente: 'xi', base: 'cif' },
  { iso: 'FR', nombre: 'Francia (UE)', nombreEn: 'France (EU)', fuente: 'xi', base: 'cif' },
  { iso: 'IT', nombre: 'Italia (UE)', nombreEn: 'Italy (EU)', fuente: 'xi', base: 'cif' },
  { iso: 'ES', nombre: 'España (UE)', nombreEn: 'Spain (EU)', fuente: 'xi', base: 'cif' },
];

export function destino(iso: string): Destino | null {
  return DESTINOS.find((d) => d.iso === iso) ?? null;
}

export const NOMBRE_DE_FUENTE: Record<FuenteArancel, string> = {
  hts: 'Harmonized Tariff Schedule de EE. UU. (USITC)',
  uk: 'UK Global Tariff (Trade Tariff, gobierno del Reino Unido)',
  xi: 'Arancel común de la UE (TARIC), publicado por el Trade Tariff del gobierno del Reino Unido para Irlanda del Norte',
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
    return { ok: false, mensaje: (cuerpo as { mensaje?: string } | null)?.mensaje ?? 'El arancel del destino no respondió. Probá de nuevo en unos minutos.' };
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
