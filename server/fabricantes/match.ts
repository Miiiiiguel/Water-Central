// Qué fabricantes patrocinados se muestran para una búsqueda.
//
// Un fabricante sale si:
//   - está aprobado, activo y con la pauta vigente (pauta_hasta >= hoy), y
//   - lo que busca la persona tiene que ver con lo que fabrica: la partida
//     del arancel cae en una de sus categorías (capítulo o partida), o el
//     texto buscado nombra una de sus palabras.
//
// Entre los que salen, primero el que mejor encaja; a igual encaje, el de
// más prioridad (lo que se vende como "aparecer de primero"). Todo puro,
// sin base de datos, para poder probarlo.

export interface FabricanteFila {
  id: string;
  nombre: string;
  descripcion: string | null;
  pais: string;
  ciudad: string | null;
  categorias: string[];
  palabras: string[];
  pedido_minimo: string | null;
  certificaciones: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_whatsapp: string | null;
  sitio_web: string | null;
  /** Correo con que entra a su portal; si falta, vale contacto_email. */
  acceso_email?: string | null;
  estado: 'pendiente' | 'aprobado';
  activo: boolean;
  pauta_hasta: string | null;
  prioridad: number;
  plan: string | null;
  precio_mensual_usd: number | null;
  notas: string | null;
  created_at: string;
}

/** Lo que ve el público: sin contacto directo (va por el formulario, que se cuenta), sin precios ni notas. */
export interface FabricantePublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  pais: string;
  ciudad: string | null;
  pedido_minimo: string | null;
  certificaciones: string | null;
  sitio_web: string | null;
}

export const publico = (f: FabricanteFila): FabricantePublico => ({
  id: f.id,
  nombre: f.nombre,
  descripcion: f.descripcion,
  pais: f.pais,
  ciudad: f.ciudad,
  pedido_minimo: f.pedido_minimo,
  certificaciones: f.certificaciones,
  sitio_web: f.sitio_web,
});

/** Minúsculas, sin tildes ni signos: "Champú" y "champu" son lo mismo. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'para', 'con', 'por', 'y', 'en', 'un', 'una', 'of', 'the', 'and', 'for', 'with']);

/** Las palabras que cuentan de una búsqueda. */
export function terminos(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter((t) => t.length >= 3 && !PALABRAS_VACIAS.has(t));
}

/** "arenas" encaja con "arena" y "champus" con "champu": se compara por raíz. */
function mismaPalabra(a: string, b: string): boolean {
  if (a === b) return true;
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a];
  return corta.length >= 4 && larga.startsWith(corta) && larga.length - corta.length <= 2;
}

export function pautaVigente(f: Pick<FabricanteFila, 'estado' | 'activo' | 'pauta_hasta'>, hoy: string): boolean {
  return f.estado === 'aprobado' && f.activo && f.pauta_hasta !== null && f.pauta_hasta >= hoy;
}

export interface Busqueda {
  /** Lo que escribió la persona (o la descripción del producto). */
  q?: string | null;
  /** La partida del arancel, con o sin puntos. */
  codigo?: string | null;
}

/** Cuánto encaja un fabricante con la búsqueda. 0 = no encaja. */
export function puntaje(f: Pick<FabricanteFila, 'categorias' | 'palabras' | 'nombre' | 'descripcion'>, b: Busqueda): number {
  let p = 0;

  const digitos = (b.codigo ?? '').replace(/\D/g, '');
  if (digitos.length >= 2) {
    // La categoría más larga que encaja manda: una partida exacta (3304)
    // pesa más que el capítulo entero (33).
    let mejor = 0;
    for (const c of f.categorias) {
      const cd = c.replace(/\D/g, '');
      if (cd.length >= 2 && digitos.startsWith(cd)) mejor = Math.max(mejor, cd.length);
    }
    if (mejor) p += mejor >= 4 ? 6 : 4;
  }

  const buscados = terminos(b.q ?? '');
  if (buscados.length) {
    const suyas = f.palabras.flatMap((w) => terminos(w));
    const texto = terminos(`${f.nombre} ${f.descripcion ?? ''}`);
    for (const t of buscados) {
      if (suyas.some((w) => mismaPalabra(t, w))) p += 3;
      else if (texto.some((w) => mismaPalabra(t, w))) p += 1;
    }
  }
  return p;
}

/** Los que se muestran, en orden. */
export function sugeridos(filas: FabricanteFila[], b: Busqueda, hoy: string, max = 3): FabricanteFila[] {
  return filas
    .filter((f) => pautaVigente(f, hoy))
    .map((f) => ({ f, p: puntaje(f, b) }))
    .filter((x) => x.p > 0)
    .sort((a, b2) => b2.p - a.p || b2.f.prioridad - a.f.prioridad || a.f.nombre.localeCompare(b2.f.nombre))
    .slice(0, max)
    .map((x) => x.f);
}

/** Para el directorio: todos los vigentes, primero los de más prioridad; si hay búsqueda, sólo los que encajan. */
export function directorio(filas: FabricanteFila[], q: string | null, hoy: string): FabricanteFila[] {
  const vigentes = filas.filter((f) => pautaVigente(f, hoy));
  if (q && terminos(q).length) return sugeridos(vigentes, { q }, hoy, 50);
  return vigentes.sort((a, b) => b.prioridad - a.prioridad || a.nombre.localeCompare(b.nombre));
}

export interface Metricas {
  impresiones30: number;
  contactos30: number;
  contactos: number;
}

/** Vistas y contactos de un fabricante, de sus eventos. */
export function metricas(eventos: Array<{ tipo: string; created_at: string }>, ahora: Date): Metricas {
  const desde = ahora.getTime() - 30 * 24 * 3600 * 1000;
  let impresiones30 = 0;
  let contactos30 = 0;
  let contactos = 0;
  for (const e of eventos) {
    const reciente = new Date(e.created_at).getTime() >= desde;
    if (e.tipo === 'impresion' && reciente) impresiones30++;
    if (e.tipo === 'contacto') {
      contactos++;
      if (reciente) contactos30++;
    }
  }
  return { impresiones30, contactos30, contactos };
}
