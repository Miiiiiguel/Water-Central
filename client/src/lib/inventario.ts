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

/** El CSV que exporta Shopify (Productos → Exportar): columnas Handle, Title, Variant SKU, Image Src… */
export function esExportShopify(filas: Record<string, string>[]): boolean {
  const f = filas[0];
  return Boolean(f && 'handle' in f && 'variant_sku' in f && 'title' in f);
}

const SIN_SKU_SHOPIFY = 'Este producto no tiene SKU en Shopify: ponle uno en Shopify (Productos → el producto → SKU) y vuelve a exportar';

/**
 * Pasa la exportación de Shopify a la forma de la plantilla. Shopify escribe una fila
 * por variante y otra por cada foto extra (sólo con el Handle y la foto): se agrupa por
 * Handle, cada variante es un producto (su SKU es el de Shopify, el mismo con que llegan
 * los pedidos), y las filas de fotos se omiten. El stock de Shopify no se importa: el de
 * la bodega lo dan los ingresos.
 */
export function desdeShopify(filas: Record<string, string>[]): Array<Record<string, string> & { _fila: string }> {
  const porHandle = new Map<string, Array<{ f: Record<string, string>; fila: number }>>();
  filas.forEach((f, i) => {
    const h = (f.handle ?? '').trim();
    if (!h) return;
    const lista = porHandle.get(h) ?? [];
    lista.push({ f, fila: i + 2 });
    porHandle.set(h, lista);
  });
  const sinHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  const out: Array<Record<string, string> & { _fila: string }> = [];
  for (const rs of Array.from(porHandle.values())) {
    const principal = rs.find((r) => r.f.title) ?? rs[0];
    const titulo = (principal.f.title ?? '').trim();
    const descripcion = sinHtml(principal.f.body_html ?? '');
    const foto = (rs.find((r) => (r.f.image_position ?? '') === '1' && r.f.image_src)?.f.image_src ?? rs.find((r) => r.f.image_src)?.f.image_src ?? '').trim();
    // Una variante es una fila con SKU, opción o precio; las de sólo foto no lo son.
    const variantes = rs.filter((r) => r.f.variant_sku || r.f.option1_value || r.f.variant_price);
    for (const v of variantes) {
      const opciones = [v.f.option1_value, v.f.option2_value, v.f.option3_value].map((x) => (x ?? '').trim()).filter((x) => x && x !== 'Default Title');
      out.push({
        _fila: String(v.fila),
        sku: (v.f.variant_sku ?? '').trim(),
        nombre: variantes.length > 1 && opciones.length ? `${titulo} — ${opciones.join(' / ')}` : titulo,
        descripcion,
        imagen: (v.f.variant_image ?? '').trim() || foto,
        stock_minimo: '',
        _shopify: '1',
      });
    }
  }
  return out;
}

/**
 * Lee un CSV de productos (columnas sku, nombre, descripcion, imagen, stock_minimo; acepta
 * alias en inglés y con tildes, y también la exportación de productos de Shopify) y marca
 * cada fila como nueva, ya existente o con error.
 */
export function revisarImportacion(entrada: Record<string, string>[], existentes: Set<string>): FilaImportada[] {
  const filas: Record<string, string>[] = esExportShopify(entrada) ? desdeShopify(entrada) : entrada;
  const vistos = new Set<string>();
  const pick = (f: Record<string, string>, ...ks: string[]) => ks.map((k) => f[k]).find((x) => x !== undefined && x !== '') ?? '';
  return filas.map((f, i) => {
    const sku = pick(f, 'sku', 'codigo', 'referencia').trim();
    const nombre = pick(f, 'nombre', 'producto', 'name', 'title').trim();
    const minRaw = pick(f, 'stock_minimo', 'minimo', 'min', 'stock_min');
    const min = minRaw === '' ? 0 : Number(minRaw);
    const base = { fila: f._fila ? Number(f._fila) : i + 2, sku, nombre, descripcion: pick(f, 'descripcion', 'description').trim() || null, imagen_url: pick(f, 'imagen', 'imagen_url', 'image', 'foto').trim() || null, stock_minimo: Number.isInteger(min) && min >= 0 ? min : 0 };
    const error = !sku ? (f._shopify ? SIN_SKU_SHOPIFY : 'Falta el SKU') : sku.length > 80 ? 'SKU demasiado largo' : !nombre ? 'Falta el nombre' : !Number.isInteger(min) || min < 0 ? 'El stock mínimo debe ser un entero ≥ 0' : vistos.has(sku.toLowerCase()) ? 'SKU repetido en el archivo' : base.imagen_url && !/^https?:\/\//i.test(base.imagen_url) ? 'La imagen debe ser un enlace http(s)' : undefined;
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
