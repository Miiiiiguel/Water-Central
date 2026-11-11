import { createContext, useContext } from 'react';

export interface Stats {
  clientes: number; clientes_nuevos_30d: number; bloqueados: number;
  paquetes: Record<string, number>; despachos: Record<string, number>;
  recargas_pendientes: number; recargas_pendientes_usd: number; saldo_total_wallets: number;
  ingresos_30d: number; recargado_30d: number;
  serie_30d: { dia: string; ingresos: number; paquetes: number }[];
  ingresos_6m: { mes: string; ingresos: number; recargas: number }[];
  top_clientes_30d: { codigo: string; nombre: string; gasto: number }[];
  flujo_30d: { dia: string; recibidos: number; despachados: number }[];
  ventas_por_origen_30d: { origen: string; unidades: number }[];
  integraciones: { total: number; con_error: number };
  inventario: { productos: number; unidades: number; stock_bajo: number };
  cola: { por_recibir: number; por_alistar: number; recargas: number; sin_vincular: number };
}

export interface AdminCtx { stats: Stats | null; cargando: boolean; error: string | null; recargar: () => Promise<void> }
export const AdminContext = createContext<AdminCtx | null>(null);
export function useAdmin(): AdminCtx {
  const c = useContext(AdminContext);
  if (!c) throw new Error('useAdmin necesita el portal del administrador');
  return c;
}

/** Cliente de la fila (lo que traen los joins de profiles). */
export interface Dueno { full_name: string | null; casillero_codigo: string | null; email?: string | null }
export const quien = (p?: Dueno | null) => (p ? `${p.casillero_codigo ?? ''} · ${p.full_name ?? ''}` : '—');

/**
 * Supabase corta cada consulta en 1.000 filas. Esto pide página por página
 * (con `.range`) hasta traer todo, o hasta `tope` filas, y lanza el error si lo hay.
 */
export async function leerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, tope = 20_000, tam = 1000): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; desde < tope; desde += tam) {
    const { data, error } = await pagina(desde, desde + tam - 1);
    if (error) throw error;
    todo.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < tam) break;
  }
  return todo.slice(0, tope);
}
