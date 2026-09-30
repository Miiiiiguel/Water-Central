// Dónde vive el avance de la ruta exportadora.
//
// Sin cuenta: en el navegador, para que cualquiera pueda empezar sin
// registrarse. Con cuenta: en Supabase (tabla export_route, sólo el dueño
// la lee y la escribe), para verlo desde cualquier equipo. Al entrar con
// la cuenta se juntan los dos: nada que se haya marcado se pierde.
//
// Si la tabla todavía no existe (falta correr schema.sql), sigue en el
// navegador sin romper nada.

import { getSupabase } from './supabase';
import { loadStored } from './diagnosticApi';
import { TODAS, hechasPorDiagnostico } from './ruta';

const CLAVE = 'ecx:ruta';
const VALIDAS = new Set(TODAS.map((t) => t.id));

function limpiar(ids: Iterable<string>): Set<string> {
  const s = new Set<string>();
  for (const id of Array.from(ids)) if (VALIDAS.has(id)) s.add(id);
  return s;
}

function leerLocal(): Set<string> | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const v = JSON.parse(raw) as { hechas?: unknown };
    return Array.isArray(v.hechas) ? limpiar(v.hechas.filter((x): x is string => typeof x === 'string')) : null;
  } catch {
    return null;
  }
}

function guardarLocal(hechas: Set<string>) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ hechas: Array.from(hechas), at: Date.now() }));
  } catch {
    /* modo privado: la ruta funciona igual, sólo no sobrevive a recargar */
  }
}

/**
 * El punto de partida. Si nunca se guardó nada, las respuestas "Sí" del
 * diagnóstico hecho en este navegador marcan lo que ya está resuelto.
 */
export async function cargarAvance(userId: string | null): Promise<{ hechas: Set<string>; desdeDiagnostico: boolean; enCuenta: boolean }> {
  const local = leerLocal();
  const diag = loadStored();
  const base = local ?? (diag ? hechasPorDiagnostico(diag.answers) : new Set<string>());
  const desdeDiagnostico = !local && Boolean(diag);

  if (!userId) return { hechas: base, desdeDiagnostico, enCuenta: false };

  try {
    const sb = await getSupabase();
    const { data, error } = await sb.from('export_route').select('done').eq('user_id', userId).maybeSingle();
    if (error) return { hechas: base, desdeDiagnostico, enCuenta: false };
    const remoto = limpiar(((data as { done?: string[] } | null)?.done ?? []) as string[]);
    const juntas = new Set([...Array.from(remoto), ...Array.from(base)]);
    return { hechas: juntas, desdeDiagnostico: desdeDiagnostico && remoto.size === 0, enCuenta: true };
  } catch {
    return { hechas: base, desdeDiagnostico, enCuenta: false };
  }
}

/** Guarda en el navegador siempre, y en la cuenta si hay. Devuelve si quedó en la cuenta. */
export async function guardarAvance(userId: string | null, hechas: Set<string>): Promise<boolean> {
  const limpias = limpiar(hechas);
  guardarLocal(limpias);
  if (!userId) return false;
  try {
    const sb = await getSupabase();
    const { error } = await sb
      .from('export_route')
      .upsert({ user_id: userId, done: Array.from(limpias), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return !error;
  } catch {
    return false;
  }
}
