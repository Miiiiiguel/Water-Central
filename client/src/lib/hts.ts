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

/** Por qué no llegó la respuesta, para decirlo bien en pantalla. */
export type FalloHts = 'sin_internet' | 'limite' | 'servidor';

type Respuesta<T> = { ok: true; datos: T } | { ok: false; fallo: FalloHts };

const ESPERA_MS = 15_000;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Un pedido al arancel. Si el servidor no contesta o contesta con un
 * error suyo (se está reiniciando, un tropiezo de red), se reintenta una
 * vez antes de rendirse: casi siempre el segundo intento llega.
 */
async function pedirConCausa<T>(ruta: string, signal?: AbortSignal): Promise<Respuesta<T>> {
  let fallo: FalloHts = 'servidor';
  for (let intento = 0; intento < 2; intento++) {
    if (signal?.aborted) break;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, fallo: 'sin_internet' };
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MS);
    const cortar = () => control.abort();
    signal?.addEventListener('abort', cortar);
    try {
      const res = await fetch(ruta, { signal: control.signal });
      if (res.ok) return { ok: true, datos: (await res.json()) as T };
      if (res.status === 429) return { ok: false, fallo: 'limite' };
      // Un 4xx no se arregla reintentando.
      if (res.status < 500) return { ok: false, fallo: 'servidor' };
      fallo = 'servidor';
    } catch {
      fallo = typeof navigator !== 'undefined' && navigator.onLine === false ? 'sin_internet' : 'servidor';
    } finally {
      clearTimeout(reloj);
      signal?.removeEventListener('abort', cortar);
    }
    if (intento === 0 && !signal?.aborted) await dormir(800);
  }
  return { ok: false, fallo };
}

async function pedir<T>(ruta: string, signal?: AbortSignal): Promise<T | null> {
  const r = await pedirConCausa<T>(ruta, signal);
  return r.ok ? r.datos : null;
}

/** Buscar, diciendo por qué falló si falla. */
export async function buscarPartidasConCausa(q: string, signal?: AbortSignal): Promise<Respuesta<ItemPartida[]>> {
  const r = await pedirConCausa<{ resultados: ItemPartida[] }>(`/api/hts/buscar?q=${encodeURIComponent(q)}`, signal);
  return r.ok ? { ok: true, datos: r.datos.resultados } : r;
}

export async function buscarPartidas(q: string, signal?: AbortSignal): Promise<ItemPartida[] | null> {
  const r = await buscarPartidasConCausa(q, signal);
  return r.ok ? r.datos : null;
}

/** El mensaje para cada causa. */
export function mensajeFalloHts(f: FalloHts, es: boolean): string {
  if (f === 'sin_internet') return es ? 'Parece que no tienes internet. Revisa la conexión y vuelve a intentar.' : 'You seem to be offline. Check your connection and try again.';
  if (f === 'limite') return es ? 'Hiciste muchas búsquedas seguidas. Espera un minuto y vuelve a intentar.' : 'Too many searches in a row. Wait a minute and try again.';
  return es ? 'No pudimos conectar con el servidor de Easycomex. Vuelve a intentar en un momento.' : 'We could not reach the Easycomex server. Try again in a moment.';
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
