// El arancel de EE. UU., del lado del navegador: buscar una partida,
// recorrer un capítulo y traer el detalle de un código. El servidor es
// el único que tiene el arancel; acá sólo se le pregunta.

import type { Tasa } from './tasaArancel';

export interface ItemPartida {
  codigo: string;
  digitos: string;
  descripcion: string;
  capitulo: string;
  tarifa: string | null;
  estadistica: boolean;
}

export interface Nodo {
  linea: number;
  codigo: string | null;
  descripcion: string;
  tarifa: string | null;
  tieneHijos: boolean;
}

export interface DetallePartida {
  codigo: string;
  digitos: string;
  descripcion: string[];
  capitulo: { codigo: string; nombre: string | null };
  general: { texto: string; segun: string; heredado: boolean; tasa: Tasa } | null;
  especial: string;
  preferencial: Record<string, { texto: string; programa: string; acuerdo: string; tasa: Tasa }>;
  unidades: string[];
  avisos: string[];
  estadistica: boolean;
  fuente: { nombre: string; cargadoEl: string };
}

async function pedir<T>(ruta: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(ruta, { signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function buscarPartidas(q: string, signal?: AbortSignal): Promise<ItemPartida[] | null> {
  const r = await pedir<{ resultados: ItemPartida[] }>(`/api/hts/buscar?q=${encodeURIComponent(q)}`, signal);
  return r ? r.resultados : null;
}

export async function listarCapitulos(): Promise<Array<{ codigo: string; nombre: string }> | null> {
  const r = await pedir<{ capitulos: Array<{ codigo: string; nombre: string }> }>('/api/hts/capitulos');
  return r ? r.capitulos : null;
}

export async function ramas(opciones: { capitulo?: string; linea?: number }): Promise<Nodo[] | null> {
  const q = opciones.capitulo !== undefined ? `capitulo=${opciones.capitulo}` : `linea=${opciones.linea}`;
  const r = await pedir<{ nodos: Nodo[] }>(`/api/hts/arbol?${q}`);
  return r ? r.nodos : null;
}

export function detallePartida(codigo: string): Promise<DetallePartida | null> {
  return pedir<DetallePartida>(`/api/hts/partida/${encodeURIComponent(codigo)}`);
}
