// ¿El producto califica para el acuerdo comercial? Una estimación con
// las reglas de origen generales, a partir de unas pocas preguntas. La
// regla exacta es por partida y la confirma el certificado de origen;
// esto sirve para no dar por hecho un acuerdo que el producto no cumple
// (o al revés).
//
// Textiles y ropa (capítulos 50 a 63): "del hilado en adelante". El hilo
// y la tela tienen que ser de la región del acuerdo y la prenda se corta
// y se cose en el país. Se tolera hasta un 10 % del peso en fibras de
// fuera (de minimis), salvo el elastano, que con EE. UU. tiene que ser
// de la región aunque sea poco. Con la UE y el Reino Unido la regla es
// la "doble transformación" (tela hecha en la región desde el hilo):
// misma pregunta, misma tolerancia.
//
// Lo demás: el producto se tiene que fabricar o transformar en el país.
// Si los insumos de fuera del acuerdo son hasta el 10 % del costo,
// califica. Si son más, depende de la regla de su partida: con EE. UU.
// suele bastar con que no pasen del 55 % (contenido regional del 45 %),
// con la UE y el Reino Unido del 50 %. Por encima de eso, no.

export type Fibra = 'algodon' | 'poliester' | 'nylon' | 'elastano' | 'acrilico' | 'viscosa' | 'lana' | 'seda' | 'lino' | 'otra';

export const FIBRAS: Array<{ id: Fibra; es: string; en: string }> = [
  { id: 'algodon', es: 'Algodón', en: 'Cotton' },
  { id: 'poliester', es: 'Poliéster', en: 'Polyester' },
  { id: 'nylon', es: 'Nylon / poliamida', en: 'Nylon / polyamide' },
  { id: 'elastano', es: 'Elastano / spandex', en: 'Elastane / spandex' },
  { id: 'acrilico', es: 'Acrílico', en: 'Acrylic' },
  { id: 'viscosa', es: 'Viscosa / rayón', en: 'Viscose / rayon' },
  { id: 'lana', es: 'Lana', en: 'Wool' },
  { id: 'seda', es: 'Seda', en: 'Silk' },
  { id: 'lino', es: 'Lino', en: 'Linen' },
  { id: 'otra', es: 'Otra', en: 'Other' },
];

export interface FilaFibra {
  fibra: Fibra;
  /** Porcentaje del peso de la tela. */
  pct: number;
  /** El hilo o la tela de esta fibra vienen de fuera del acuerdo. */
  importada: boolean;
}

export interface RespuestasOrigen {
  /** Ya tiene certificado o declaración de origen para este producto. */
  certificado: boolean;
  /** Sólo se pregunta cuando no hay partida elegida (si hay, lo dice su capítulo). */
  tipo: 'textil' | 'otro' | null;
  fibras: FilaFibra[];
  cosidoEnOrigen: boolean | null;
  transformado: boolean | null;
  /** Porcentaje del costo del producto en insumos de fuera del acuerdo. */
  importadoPct: number | null;
}

export const RESPUESTAS_INICIALES: RespuestasOrigen = {
  certificado: false,
  tipo: null,
  fibras: [],
  cosidoEnOrigen: null,
  transformado: null,
  importadoPct: null,
};

export const DE_MINIMIS = 10;
export const TOPE_IMPORTADO = { US: 55, otro: 50 } as const;

export type Razon =
  | 'certificado'
  | 'falta_tipo'
  | 'faltan_fibras'
  | 'suma'
  | 'falta_confeccion'
  | 'sin_confeccion'
  | 'elastano'
  | 'tela_importada'
  | 'textil_regional'
  | 'textil_de_minimis'
  | 'falta_transformacion'
  | 'sin_transformacion'
  | 'falta_importado'
  | 'totalmente'
  | 'de_minimis'
  | 'valor'
  | 'exceso';

export interface Veredicto {
  estado: 'califica' | 'probable' | 'no' | 'incompleto';
  razon: Razon;
  /** Porcentaje importado que decidió (fibras por peso o insumos por costo). */
  importado?: number;
  tope?: number;
}

export function capituloDe(codigo: string | null | undefined): number | null {
  const d = (codigo ?? '').replace(/\D/g, '');
  return d.length >= 2 ? Number(d.slice(0, 2)) : null;
}

export const esCapituloTextil = (cap: number | null) => cap !== null && cap >= 50 && cap <= 63;

export const sumaFibras = (fibras: FilaFibra[]) => fibras.reduce((s, f) => s + (Number.isFinite(f.pct) ? f.pct : 0), 0);

export function evaluarOrigen(r: RespuestasOrigen, ctx: { destinoUS: boolean; capitulo: number | null }): Veredicto {
  if (r.certificado) return { estado: 'califica', razon: 'certificado' };

  const tipo = ctx.capitulo !== null ? (esCapituloTextil(ctx.capitulo) ? 'textil' : 'otro') : r.tipo;
  if (!tipo) return { estado: 'incompleto', razon: 'falta_tipo' };

  if (tipo === 'textil') {
    if (r.fibras.length === 0) return { estado: 'incompleto', razon: 'faltan_fibras' };
    if (Math.abs(sumaFibras(r.fibras) - 100) > 0.5) return { estado: 'incompleto', razon: 'suma' };
    if (r.cosidoEnOrigen === null) return { estado: 'incompleto', razon: 'falta_confeccion' };
    if (!r.cosidoEnOrigen) return { estado: 'no', razon: 'sin_confeccion' };
    const importado = r.fibras.filter((f) => f.importada).reduce((s, f) => s + f.pct, 0);
    if (ctx.destinoUS && r.fibras.some((f) => f.fibra === 'elastano' && f.importada && f.pct > 0)) {
      return { estado: 'no', razon: 'elastano', importado };
    }
    if (importado === 0) return { estado: 'califica', razon: 'textil_regional', importado };
    if (importado <= DE_MINIMIS) return { estado: 'califica', razon: 'textil_de_minimis', importado, tope: DE_MINIMIS };
    return { estado: 'no', razon: 'tela_importada', importado, tope: DE_MINIMIS };
  }

  if (r.transformado === null) return { estado: 'incompleto', razon: 'falta_transformacion' };
  if (!r.transformado) return { estado: 'no', razon: 'sin_transformacion' };
  if (r.importadoPct === null || !Number.isFinite(r.importadoPct)) return { estado: 'incompleto', razon: 'falta_importado' };
  const importado = Math.min(100, Math.max(0, r.importadoPct));
  const tope = ctx.destinoUS ? TOPE_IMPORTADO.US : TOPE_IMPORTADO.otro;
  if (importado === 0) return { estado: 'califica', razon: 'totalmente', importado };
  if (importado <= DE_MINIMIS) return { estado: 'califica', razon: 'de_minimis', importado, tope: DE_MINIMIS };
  if (importado <= tope) return { estado: 'probable', razon: 'valor', importado, tope };
  return { estado: 'no', razon: 'exceso', importado, tope };
}

export const aplicaAcuerdo = (v: Veredicto) => v.estado === 'califica' || v.estado === 'probable';

// ---------------------------------------------------------------------
// La composición también decide la partida: en los capítulos 61 y 62 la
// prenda se clasifica por la fibra que más pesa. Si la partida elegida
// dice otra fibra, se avisa (no se cambia sola: la partida la elige el
// cliente entre las del arancel cargado).
// ---------------------------------------------------------------------

type Grupo = 'algodon' | 'sinteticas' | 'artificiales' | 'lana' | 'seda' | 'otras';

const GRUPO: Record<Fibra, Grupo> = {
  algodon: 'algodon',
  poliester: 'sinteticas',
  nylon: 'sinteticas',
  elastano: 'sinteticas',
  acrilico: 'sinteticas',
  viscosa: 'artificiales',
  lana: 'lana',
  seda: 'seda',
  lino: 'otras',
  otra: 'otras',
};

export const NOMBRE_GRUPO: Record<Grupo, { es: string; en: string }> = {
  algodon: { es: 'algodón', en: 'cotton' },
  sinteticas: { es: 'fibras sintéticas', en: 'synthetic fibers' },
  artificiales: { es: 'fibras artificiales', en: 'artificial fibers' },
  lana: { es: 'lana', en: 'wool' },
  seda: { es: 'seda', en: 'silk' },
  otras: { es: 'otras fibras', en: 'other fibers' },
};

/** La fibra (por grupo) que más pesa, o null si hay empate o no hay datos. */
export function grupoPredominante(fibras: FilaFibra[]): Grupo | null {
  const pesos = new Map<Grupo, number>();
  for (const f of fibras) pesos.set(GRUPO[f.fibra], (pesos.get(GRUPO[f.fibra]) ?? 0) + f.pct);
  const orden = Array.from(pesos.entries()).sort((a, b) => b[1] - a[1]);
  if (orden.length === 0 || orden[0][1] <= 0) return null;
  if (orden.length > 1 && orden[0][1] === orden[1][1]) return null;
  return orden[0][0];
}

/** Qué fibras nombra la descripción de la partida ("Of cotton", "Of man-made fibers"...). */
function gruposDeLaPartida(descripcion: string[]): Set<Grupo> | null {
  const t = descripcion.join(' › ').toLowerCase();
  const g = new Set<Grupo>();
  if (/\bof cotton\b/.test(t)) g.add('algodon');
  if (/\bof synthetic\b/.test(t)) g.add('sinteticas');
  if (/\bof artificial\b/.test(t)) g.add('artificiales');
  if (/\bof man-made\b/.test(t)) {
    g.add('sinteticas');
    g.add('artificiales');
  }
  if (/\bof wool\b|fine animal hair/.test(t)) g.add('lana');
  if (/\bof silk\b/.test(t)) g.add('seda');
  if (/\bof other textile materials\b/.test(t)) g.add('otras');
  return g.size > 0 ? g : null;
}

/**
 * Si la partida es de ropa (61 o 62) y nombra una fibra distinta a la
 * que más pesa en la composición, devuelve las dos para avisar.
 */
export function choqueConPartida(
  fibras: FilaFibra[],
  partida: { capitulo: number | null; descripcion: string[] } | null
): { predominante: Grupo; partida: Grupo[] } | null {
  if (!partida || (partida.capitulo !== 61 && partida.capitulo !== 62)) return null;
  if (Math.abs(sumaFibras(fibras) - 100) > 0.5) return null;
  const predominante = grupoPredominante(fibras);
  const nombra = gruposDeLaPartida(partida.descripcion);
  if (!predominante || !nombra || nombra.has(predominante)) return null;
  return { predominante, partida: Array.from(nombra) };
}

/** La región cuyos hilos y telas cuentan como "del acuerdo". */
export function regionDelAcuerdo(pais: string, nombrePais: string, destinoUS: boolean, es: boolean, destinoNombre: string): string {
  if (!destinoUS) return es ? `${nombrePais} o ${destinoNombre}` : `${nombrePais} or ${destinoNombre}`;
  if (pais === 'MX') return es ? 'México, EE. UU. o Canadá' : 'Mexico, the US or Canada';
  if (['CR', 'DO', 'SV', 'GT', 'HN', 'NI'].includes(pais)) {
    return es ? 'Centroamérica, R. Dominicana o EE. UU.' : 'Central America, the Dominican Rep. or the US';
  }
  return es ? `${nombrePais} o EE. UU.` : `${nombrePais} or the US`;
}
