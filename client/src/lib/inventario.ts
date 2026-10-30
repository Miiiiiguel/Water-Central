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
  stock_minimo: number;
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
  user_id?: string;
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

export interface Analisis {
  dias: number;
  serie: { dia: string; ventas: number; ingresos: number; devoluciones: number }[];
  por_origen: { origen: string; unidades: number }[];
  productos: { id: string; vendidas: number; cobertura_dias: number | null }[];
}

export interface SinVincular { user_id: string; sku: string; pedidos: number; unidades: number; ultima: string }

export interface EventoIntegracion {
  id: number;
  integracion_id: string | null;
  user_id: string;
  tipo: 'conexion' | 'webhook' | 'importar' | 'sync' | 'error' | 'sin_producto';
  resumen: string;
  detalle: Record<string, unknown> | null;
  resuelto: boolean;
  created_at: string;
}

export interface Chequeo { id: string; ok: boolean; titulo: string; detalle: string }

/** Cómo está el stock de un producto: agotado, bajo (en o bajo su mínimo) o bien. */
export function estadoStock(p: Pick<ProductoInv, 'disponibles' | 'stock_minimo' | 'vendidos'>): 'agotado' | 'bajo' | 'ok' {
  if (p.disponibles <= 0) return 'agotado';
  if (p.stock_minimo > 0 && p.disponibles <= p.stock_minimo) return 'bajo';
  return 'ok';
}

/** Días de cobertura -> tono de color. */
export function tonoCobertura(dias: number | null): 'rojo' | 'ambar' | 'verde' | 'gris' {
  if (dias === null) return 'gris';
  return dias <= 7 ? 'rojo' : dias <= 15 ? 'ambar' : 'verde';
}

export interface FilaImportada { fila: number; sku: string; nombre: string; descripcion: string | null; imagen_url: string | null; stock_minimo: number; estado: 'nuevo' | 'existente' | 'error'; error?: string }

/**
 * Lee un CSV de productos (columnas sku, nombre, descripcion, imagen, stock_minimo; acepta
 * alias en inglés y con tildes) y marca cada fila como nueva, ya existente o con error.
 */
export function revisarImportacion(filas: Record<string, string>[], existentes: Set<string>): FilaImportada[] {
  const vistos = new Set<string>();
  const pick = (f: Record<string, string>, ...ks: string[]) => ks.map((k) => f[k]).find((x) => x !== undefined && x !== '') ?? '';
  return filas.map((f, i) => {
    const sku = pick(f, 'sku', 'codigo', 'referencia').trim();
    const nombre = pick(f, 'nombre', 'producto', 'name', 'title').trim();
    const minRaw = pick(f, 'stock_minimo', 'minimo', 'min', 'stock_min');
    const min = minRaw === '' ? 0 : Number(minRaw);
    const base = { fila: i + 2, sku, nombre, descripcion: pick(f, 'descripcion', 'description').trim() || null, imagen_url: pick(f, 'imagen', 'imagen_url', 'image', 'foto').trim() || null, stock_minimo: Number.isInteger(min) && min >= 0 ? min : 0 };
    const error = !sku ? 'Falta el SKU' : sku.length > 80 ? 'SKU demasiado largo' : !nombre ? 'Falta el nombre' : !Number.isInteger(min) || min < 0 ? 'El stock mínimo debe ser un entero ≥ 0' : vistos.has(sku.toLowerCase()) ? 'SKU repetido en el archivo' : base.imagen_url && !/^https?:\/\//i.test(base.imagen_url) ? 'La imagen debe ser un enlace http(s)' : undefined;
    if (sku) vistos.add(sku.toLowerCase());
    return { ...base, estado: error ? 'error' : existentes.has(sku.toLowerCase()) ? 'existente' : 'nuevo', error } as FilaImportada;
  });
}

export interface FilaMovimiento { fila: number; codigo: string; sku: string; tipo: MovInv['tipo'] | null; cantidad: number; referencia: string; error?: string }

const TIPOS: Record<string, MovInv['tipo']> = { ingreso: 'ingreso', entrada: 'ingreso', recepcion: 'ingreso', venta: 'venta', salida: 'venta', ajuste: 'ajuste', devolucion: 'devolucion' };

/**
 * Lee las filas de un CSV de ingreso masivo (columnas codigo, sku, tipo, cantidad, referencia)
 * y deja cada una lista para enviar: la cantidad con el signo que pide el servidor
 * (venta en negativo) o con el error que impide enviarla.
 */
export function revisarMovimientos(filas: Record<string, string>[]): FilaMovimiento[] {
  const pick = (f: Record<string, string>, ...ks: string[]) => ks.map((k) => f[k]).find((x) => x !== undefined && x !== '') ?? '';
  return filas.map((f, i) => {
    const codigo = pick(f, 'codigo', 'cliente', 'casillero').trim().toUpperCase();
    const sku = pick(f, 'sku', 'referencia_producto', 'producto').trim();
    const tipoTxt = (pick(f, 'tipo', 'movimiento') || 'ingreso').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const tipo = TIPOS[tipoTxt] ?? null;
    const bruto = pick(f, 'cantidad', 'unidades', 'qty').trim().replace(/\s/g, '');
    const n = bruto === '' ? Number.NaN : Number(bruto);
    const referencia = pick(f, 'referencia', 'nota', 'pedido').trim().slice(0, 200);
    let error: string | undefined;
    if (!/^[A-Z0-9]{3,20}$/.test(codigo)) error = 'Falta el código del cliente (ej. DM1001)';
    else if (!sku) error = 'Falta el SKU';
    else if (sku.length > 80) error = 'SKU demasiado largo';
    else if (!tipo) error = `Tipo desconocido «${tipoTxt}» (usa ingreso, venta, ajuste o devolución)`;
    else if (!Number.isInteger(n) || n === 0) error = 'La cantidad debe ser un entero distinto de cero';
    else if (Math.abs(n) > 100_000) error = 'La cantidad es demasiado grande';
    else if ((tipo === 'ingreso' || tipo === 'devolucion') && n < 0) error = `${tipo === 'ingreso' ? 'Un ingreso' : 'Una devolución'} no puede ser negativo`;
    const cantidad = tipo === 'venta' ? -Math.abs(n) : n;
    return { fila: i + 2, codigo, sku, tipo, cantidad: Number.isFinite(cantidad) ? cantidad : 0, referencia, error };
  });
}
