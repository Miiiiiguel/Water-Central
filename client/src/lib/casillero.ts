import { getSupabase } from '@/lib/supabase';

// Tipos y utilidades del casillero de Easycomex. Las lecturas y los
// cambios simples van directo a Supabase (la seguridad la pone RLS, ver
// supabase/casillero.sql); lo que toca dinero pasa por /api/casillero.

export type EstadoPaquete = 'prealertado' | 'recibido' | 'alistamiento' | 'despachado' | 'entregado';
export const ESTADOS_PAQUETE: EstadoPaquete[] = ['prealertado', 'recibido', 'alistamiento', 'despachado', 'entregado'];

export type Modalidad = 'rec_oficina' | 'local' | 'regional' | 'nacional';
export const MODALIDADES: Record<Modalidad, string> = {
  rec_oficina: 'Recoger en oficina',
  local: 'Local',
  regional: 'Regional',
  nacional: 'Nacional',
};

export const DIRECCION_MIAMI = '7569 NW 70th St, Miami, FL 33166, EE.UU.';

export interface Paquete {
  id: string;
  user_id: string;
  guia: string;
  proveedor: string | null;
  descripcion: string | null;
  valor_declarado: number | null;
  peso_lb: number | null;
  estado: EstadoPaquete;
  despacho_id: string | null;
  created_at: string;
  profiles?: { full_name: string | null; casillero_codigo: string | null } | null;
}

export interface Tarifa {
  id: number;
  libras_desde: number;
  libras_hasta: number;
  rec_oficina: number;
  local: number;
  regional: number;
  nacional: number;
}

export interface MovimientoWallet {
  id: string;
  user_id: string;
  tipo: 'recarga' | 'cargo' | 'ajuste';
  monto: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  metodo: string | null;
  referencia: string | null;
  created_at: string;
  profiles?: { full_name: string | null; casillero_codigo: string | null } | null;
}

export interface Despacho {
  id: string;
  user_id: string;
  modalidad: Modalidad;
  destino: string | null;
  peso_total: number;
  costo: number;
  estado: 'solicitado' | 'despachado' | 'entregado' | 'cancelado';
  guia_despacho: string | null;
  created_at: string;
  profiles?: { full_name: string | null; casillero_codigo: string | null } | null;
}

export const usd = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

/** Saldo = suma de movimientos aprobados. */
export function saldoDe(movs: Pick<MovimientoWallet, 'monto' | 'estado'>[]): number {
  return movs.filter((m) => m.estado === 'aprobado').reduce((a, m) => a + Number(m.monto), 0);
}

/** Costo de despachar `peso` libras, o null si la tabla no lo cubre. */
export function cotizar(tarifas: Tarifa[], peso: number, modalidad: Modalidad): number | null {
  const libras = Math.ceil(peso);
  const fila = tarifas.find((t) => libras >= t.libras_desde && libras <= t.libras_hasta);
  return fila ? Number(fila[modalidad]) : null;
}

/** Llamada a nuestro API con la sesión del usuario. */
export async function api<T>(ruta: string, token: string | null, cuerpo?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; message?: string }> {
  try {
    const res = await fetch(`/api${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(cuerpo ?? {}),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: String(json.error ?? res.status), message: json.message as string | undefined };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'sin_conexion', message: 'Sin conexión con el servidor.' };
  }
}

export async function db() {
  return getSupabase();
}

export async function rastrear(guia: string): Promise<{ estado: string; created_at: string }[]> {
  const { data, error } = await (await getSupabase()).rpc('casillero_rastrear', { p_guia: guia });
  if (error) throw error;
  return (data ?? []) as { estado: string; created_at: string }[];
}
