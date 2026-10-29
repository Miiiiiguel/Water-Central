export interface ProductoInv {
  id: string;
  user_id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  created_at: string;
  total_unidades: number;
  disponibles: number;
  vendidos: number;
  rotacion: number;
}

export interface MovInv {
  id: string;
  producto_id: string;
  user_id: string;
  tipo: 'ingreso' | 'venta' | 'ajuste' | 'devolucion';
  cantidad: number;
  referencia: string | null;
  origen: string;
  created_at: string;
  casillero_productos?: { sku: string; nombre: string } | null;
}

export interface Integracion {
  id: string;
  plataforma: 'shopify' | 'woocommerce';
  dominio: string;
  estado: 'activa' | 'error';
  ultimo_sync: string | null;
  ultimo_error: string | null;
  sync_stock: boolean;
  created_at: string;
}

export interface LlaveApi {
  id: string;
  nombre: string;
  prefijo: string;
  ultimo_uso: string | null;
  created_at: string;
}

export function totales(productos: Pick<ProductoInv, 'total_unidades' | 'disponibles' | 'vendidos'>[]) {
  return {
    productos: productos.length,
    totalUnidades: productos.reduce((a, p) => a + p.total_unidades, 0),
    disponibles: productos.reduce((a, p) => a + p.disponibles, 0),
    vendidos: productos.reduce((a, p) => a + p.vendidos, 0),
  };
}

/** Movimientos dentro de un rango de fechas (YYYY-MM-DD, ambos inclusive). */
export function enRango<T extends { created_at: string }>(filas: T[], desde: string, hasta: string): T[] {
  const d = desde ? new Date(`${desde}T00:00:00`).getTime() : -Infinity;
  const h = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : Infinity;
  return filas.filter((f) => {
    const t = new Date(f.created_at).getTime();
    return t >= d && t <= h;
  });
}

export const ETIQUETA_TIPO: Record<MovInv['tipo'], string> = { ingreso: 'Ingreso', venta: 'Venta', ajuste: 'Ajuste', devolucion: 'Devolución' };
