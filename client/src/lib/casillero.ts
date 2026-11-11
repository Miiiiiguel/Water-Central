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

export interface EventoPaquete { estado: string; created_at: string; nota: string | null }

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

/** Saldo = suma de movimientos aprobados. */
export function saldoDe(movs: Pick<MovimientoWallet, 'monto' | 'estado'>[]): number {
  return movs.filter((m) => m.estado === 'aprobado').reduce((a, m) => a + Number(m.monto), 0);
}

export type ConfigCasillero = Record<string, string>;

/**
 * Costo de despachar `peso` libras, o null si la tabla no lo cubre.
 * Igual que casillero_cotizar en la base: sobre la última fila, si el equipo
 * fijó un precio por libra extra (libra_extra_<modalidad>), se suma; si no,
 * hay que consultar a un asesor.
 */
export function cotizar(tarifas: Tarifa[], peso: number, modalidad: Modalidad, config: ConfigCasillero = {}): number | null {
  const libras = Math.ceil(peso);
  const fila = tarifas.find((t) => libras >= t.libras_desde && libras <= t.libras_hasta);
  if (fila) return Number(fila[modalidad]);
  const ultima = [...tarifas].sort((a, b) => b.libras_hasta - a.libras_hasta)[0];
  const extra = Number(config[`libra_extra_${modalidad}`]);
  if (!ultima || !config[`libra_extra_${modalidad}`]?.trim() || !Number.isFinite(extra) || libras <= ultima.libras_hasta) return null;
  return Number(ultima[modalidad]) + extra * (libras - ultima.libras_hasta);
}

/** El precio en cada modalidad (null = fuera de tabla). */
export function cotizarTodas(tarifas: Tarifa[], peso: number, config: ConfigCasillero = {}): Record<Modalidad, number | null> {
  return { rec_oficina: cotizar(tarifas, peso, 'rec_oficina', config), local: cotizar(tarifas, peso, 'local', config), regional: cotizar(tarifas, peso, 'regional', config), nacional: cotizar(tarifas, peso, 'nacional', config) };
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

export interface ResumenCliente {
  saldo: number;
  recargas_pendientes: number;
  paquetes: Record<string, number>;
  gasto_6m: { mes: string; gasto: number; recargas: number }[];
  saldo_serie: { dia: string; saldo: number }[];
  ventas_30d: { dia: string; shopify: number; woocommerce: number; api: number; manual: number }[];
  top_productos: { sku: string; nombre: string; vendidos: number }[];
  stock_bajo: { sku: string; nombre: string; disponibles: number; stock_minimo: number }[];
  sin_vincular: number;
  onboarding: { prealerta: boolean; wallet: boolean; productos: boolean; tienda: boolean; stock: boolean };
  actividad: { tipo: 'paquete' | 'wallet' | 'stock'; titulo: string; detalle: string | null; fecha: string }[];
}

export async function resumenCliente(): Promise<ResumenCliente> {
  const { data, error } = await (await getSupabase()).rpc('casillero_resumen_cliente');
  if (error) throw error;
  return data as ResumenCliente;
}

export interface FilaTarifa { libras_desde: number; libras_hasta: number; rec_oficina: number; local: number; regional: number; nacional: number }

/**
 * Revisa una tabla de tarifas antes de guardarla. `errores` impiden guardar
 * (rangos al revés, traslapados o precios inválidos); `avisos` solo advierten
 * (huecos entre rangos: esos pesos saldrían «fuera de tabla»).
 */
export function validarTarifas(filas: FilaTarifa[]): { errores: string[]; avisos: string[] } {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (!filas.length) errores.push('Debe haber al menos un rango de peso.');
  filas.forEach((f, i) => {
    const n = i + 1;
    if (![f.libras_desde, f.libras_hasta].every((x) => Number.isInteger(x) && x >= 1)) errores.push(`Fila ${n}: las libras deben ser números enteros desde 1.`);
    else if (f.libras_hasta < f.libras_desde) errores.push(`Fila ${n}: «hasta» no puede ser menor que «desde».`);
    for (const m of Object.keys(MODALIDADES) as Modalidad[]) {
      const v = f[m];
      if (!Number.isFinite(v) || v < 0 || v > 9999) { errores.push(`Fila ${n}: el precio de ${MODALIDADES[m].toLowerCase()} no es válido.`); break; }
    }
  });
  const orden = [...filas].filter((f) => Number.isInteger(f.libras_desde) && Number.isInteger(f.libras_hasta)).sort((a, b) => a.libras_desde - b.libras_desde);
  for (let i = 1; i < orden.length; i++) {
    const a = orden[i - 1];
    const b = orden[i];
    if (b.libras_desde <= a.libras_hasta) errores.push(`Los rangos ${a.libras_desde}–${a.libras_hasta} y ${b.libras_desde}–${b.libras_hasta} se traslapan.`);
    else if (b.libras_desde > a.libras_hasta + 1) avisos.push(`Hueco entre ${a.libras_hasta} y ${b.libras_desde} lb: los paquetes con ese peso quedarían fuera de la tabla.`);
  }
  return { errores, avisos };
}
