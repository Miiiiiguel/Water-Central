import { arancelDe, buscar, cargar, formatearCodigo, normalizarCodigo, registro, unidadesDe, type HtsRegistro } from './store';
import { aIngles } from './glosario';
import { CAPITULOS, capitulo as capituloDe } from '../etiqueta/capitulos';
import { detectarFamilias } from '../etiqueta/familias';
import { PAISES_DE_ORIGEN, limpiar, parseTasa, tasaPreferencial, type Tasa } from '../../client/src/lib/tasaArancel';

// Consultar el arancel desde afuera: buscar una partida, recorrer el
// árbol de un capítulo y ver el detalle de un código.
//
// Todo lo que sale de acá es una fila que existe en el arancel cargado.
// Nada se arma, se completa ni se recorta: la búsqueda elige entre filas
// reales y el detalle sólo responde por un código que existe.
//
// Quedan fuera los capítulos 98 y 99: no dicen qué es un producto sino
// cómo se trata (devoluciones, sobretasas). Elegir "9903.01.25" como la
// partida de una camiseta daría un cálculo sin sentido.

type Indice = ReturnType<typeof cargar>;

const FUERA = /^9[89]/;

export interface ItemPartida {
  codigo: string;
  digitos: string;
  /** Las últimas partes de la descripción, que son las que distinguen. */
  descripcion: string;
  capitulo: string;
  tarifa: string | null;
  /** 10 dígitos: la línea estadística que se declara en aduana. */
  estadistica: boolean;
}

function textoLimpio(s: string): string {
  return limpiar(s).replace(/:$/, '');
}

function descripcionCorta(r: HtsRegistro, partes = 3): string {
  return r.rutaDescripcion.slice(-partes).map(textoLimpio).filter(Boolean).join(' › ');
}

function item(r: HtsRegistro, idx: Indice): ItemPartida {
  return {
    codigo: r.fila.htsno || formatearCodigo(r.digitos),
    digitos: r.digitos,
    descripcion: descripcionCorta(r),
    capitulo: r.digitos.slice(0, 2),
    tarifa: arancelDe(r.digitos, idx)?.texto ?? null,
    estadistica: r.digitos.length === 10,
  };
}

// Partidas que coinciden por palabras pero son un caso particular que
// nadie pidió: ropa de bebé, conjuntos de prendas. Bajan en la lista
// salvo que la consulta las nombre.
// `bajoElTitulo`: sólo cuenta debajo del título de la partida. El título
// de la 6204 dice "suits, ensembles, trousers…" y ahí viven los jeans de
// mujer: penalizarlo entero los hundía a todos.
const PARTICULARES: Array<{ en: RegExp; salvo: RegExp; bajoElTitulo?: boolean }> = [
  { en: /\bbabies'/i, salvo: /\b(bebe|bebes|baby|babies)\b/ },
  { en: /\bensembles?\b/i, salvo: /\b(conjunto|conjuntos|ensemble|set)\b/, bajoElTitulo: true },
  { en: /\bsubject to cotton restraints\b/i, salvo: /$^/ },
  // "Roasted chicory and other roasted coffee substitutes" no es café.
  // Bajo el título: el de la 1604 dice "caviar substitutes" y ahí vive el atún.
  { en: /\bsubstitutes?\b/i, salvo: /\b(sustituto|sustitutos|sucedaneo|sucedaneos|substitute)\b/, bajoElTitulo: true },
  // Casos raros que comparten palabras con el producto común.
  { en: /\brecreational performance outerwear\b/i, salvo: /\b(deportiv[oa]s?|outdoor|performance|impermeables?|esqui|montana)\b/ },
  { en: /\bbase or platform of wood\b/i, salvo: /\b(madera|zuecos?|plataforma)\b/ },
  { en: /\bski[- ]boots\b/i, salvo: /\b(esqui|ski|snowboard)\b/ },
  { en: /\bwelt footwear\b|\bturn or turned footwear\b/i, salvo: /\b(welt|goodyear)\b/ },
  { en: /\btennis shoes\b|\bsports footwear\b/i, salvo: /\b(tenis|deportiv[oa]s?|zapatillas|gimnasio|basket|basquet|running)\b/ },
  { en: /\bgolf shoes\b/i, salvo: /\b(golf)\b/ },
  { en: /\bhouse slippers\b/i, salvo: /\b(pantuflas?|babuchas?)\b/ },
  { en: /\bleather straps across the instep\b/i, salvo: /\b(sandalias?|chanclas?)\b/ },
  { en: /\bwork footwear\b|\bprotective metal toe-cap\b/i, salvo: /\b(trabajo|seguridad|industrial|dotacion)\b/ },
  { en: /\bpetroleum jelly\b/i, salvo: /\b(vaselina)\b/ },
  { en: /\bcoffee husks\b/i, salvo: /\b(cascara|cascaras|cascarilla|cisco)\b/ },
];

/**
 * Las partidas típicas de los productos que más exportan los clientes.
 * Las palabras traen filas de todo el arancel ("café tostado" también
 * calza en "sucedáneos tostados del café"); estas suben a la cabeza las
 * del producto que se nombra. Sólo ordenan: lo que sale sigue siendo una
 * fila que existe, y si el prefijo no está en el arancel no suma nada.
 * Claves normalizadas (minúsculas, sin tildes); las frases antes que sus
 * palabras sueltas, y una frase que calza ya no deja calzar a sus partes.
 */
export const PREFERIDAS: Array<[string, string[]]> = [
  ['cafe tostado', ['090121']],
  ['cafe molido', ['090121']],
  ['cafe verde', ['090111']],
  ['cafe pergamino', ['090111']],
  ['cafe soluble', ['210111']],
  ['cafe instantaneo', ['210111']],
  ['cafe liofilizado', ['210111']],
  ['cafe', ['090111', '090121', '0901']],
  ['cacao en polvo', ['1805']],
  ['cacao en grano', ['1801']],
  ['cacao', ['1801', '1806']],
  ['chocolates', ['180632', '180631', '180690', '1806']],
  ['chocolate', ['180632', '180631', '180690', '1806']],
  ['bombones', ['180631', '180690']],
  ['panela', ['170113']],
  ['miel', ['040900']],
  ['aguacates', ['080440']],
  ['aguacate', ['080440']],
  ['bananos', ['080390', '080310']],
  ['banano', ['080390', '080310']],
  ['platano', ['080310']],
  ['mango', ['080450']],
  ['pina', ['080430']],
  ['rosas', ['060311']],
  ['flores', ['0603']],
  ['jeans', ['620342', '620462']],
  ['jean', ['620342', '620462']],
  ['leggins', ['610463', '610462']],
  ['leggings', ['610463', '610462']],
  ['fajas', ['621220', '621230']],
  ['faja', ['621220', '621230']],
  ['brasier', ['621210']],
  ['sosten', ['621210']],
  ['vestido de bano', ['611241', '611249', '621112']],
  ['traje de bano', ['611241', '611249', '621112']],
  ['bikini', ['611241', '611249', '621112']],
  ['zapatos de cuero', ['640399', '640359', '640391', '640351']],
  ['botas de cuero', ['640391', '640351']],
  ['tenis', ['640411', '640419']],
  ['zapatillas', ['640411', '640419']],
  ['sandalias', ['640299', '640420', '640399']],
  ['zapatos', ['640399', '640391', '640419', '6403', '6404', '6402']],
  ['calzado', ['640399', '640391', '640419', '6403', '6404', '6402']],
  ['bolsos', ['420221', '420222', '420229']],
  ['bolso', ['420221', '420222', '420229']],
  ['carteras', ['420221', '420222', '420229']],
  ['cartera', ['420221', '420222', '420229']],
  ['billeteras', ['420231', '420232']],
  ['billetera', ['420231', '420232']],
  ['crema facial', ['330499']],
  ['crema corporal', ['330499']],
  ['serum', ['330499']],
  ['cremas', ['330499']],
  ['crema', ['330499']],
  ['labial', ['330410']],
  ['maquillaje', ['3304']],
  ['shampoo', ['330510']],
  ['champu', ['330510']],
  ['perfumes', ['330300']],
  ['perfume', ['330300']],
  ['jabon', ['3401']],
  ['velas', ['340600']],
  ['joyas', ['7113', '7117']],
  ['joyeria', ['7113', '7117']],
  ['bisuteria', ['7117']],
  ['gafas de sol', ['900410']],
  ['ron', ['220840']],
  ['aguardiente', ['220890']],
  ['vino', ['2204']],
  ['cerveza', ['220300']],
  ['galletas', ['190531']],
  ['dulces', ['1704']],
  ['mermelada', ['2007']],
];

/** Los prefijos preferidos que nombra la consulta (ya normalizada, con espacios a los lados). */
export function preferidas(pedido: string): string[] {
  let resto = pedido;
  const out: string[] = [];
  for (const [clave, prefijos] of PREFERIDAS) {
    const k = ` ${clave} `;
    if (!resto.includes(k)) continue;
    resto = resto.split(k).join(' ');
    for (const p of prefijos) if (!out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Cuánto suben las filas de una partida preferida: más que cualquier
 * coincidencia de palabras. La primera de la lista, un poco más que las
 * siguientes (el chocolate en barra antes que el cacao en polvo).
 */
const EMPUJE_PREFERIDA = 200;

function penalizacion(r: HtsRegistro, pedido: string): number {
  let menos = 0;
  for (const p of PARTICULARES) {
    const ruta = (p.bajoElTitulo ? r.rutaDescripcion.slice(1) : r.rutaDescripcion).join(' ');
    if (p.en.test(ruta) && !p.salvo.test(pedido)) menos += 40;
  }
  return menos;
}

/**
 * Buscar por código ("6109", "6109.10") o por palabras, en español o en
 * inglés ("camiseta de algodón", "cotton t-shirts").
 */
export function buscarPartidas(consulta: string, idx: Indice = cargar(), limite = 30): ItemPartida[] {
  const q = (consulta || '').trim().slice(0, 120);
  if (!q) return [];

  // Por código: todo lo que empieza con esos dígitos, en el orden del arancel.
  if (/^[\d.\s]+$/.test(q)) {
    const d = normalizarCodigo(q);
    if (d.length < 2 || FUERA.test(d)) return [];
    const out: ItemPartida[] = [];
    for (const r of idx.registros) {
      if (r.digitos.length >= 8 && r.digitos.startsWith(d)) out.push(item(r, idx));
      if (out.length >= limite) break;
    }
    return out;
  }

  // Por palabras: el español se pasa al inglés del arancel, y el
  // detector de familias (el mismo del lector de etiquetas) dice en qué
  // capítulos vive el producto, para que "camiseta" no traiga toallas.
  const { terminos } = aIngles(q);
  const capitulos = new Set<string>();
  for (const d of detectarFamilias(q).slice(0, 2)) d.familia.capitulos.forEach((c) => capitulos.add(c));

  const pedido = ` ${q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ')} `;
  const vistos = new Set<string>();
  const puntuados: Array<{ r: HtsRegistro; puntaje: number }> = [];
  const prefijos = preferidas(pedido);
  const empuje = (d: string) => {
    const i = prefijos.findIndex((p) => d.startsWith(p));
    return i < 0 ? 0 : EMPUJE_PREFERIDA - 10 * Math.min(i, 5);
  };
  const sumar = (r: HtsRegistro, puntaje: number) => {
    // Sólo se elige entre líneas con tarifa: la de 8 dígitos o la
    // estadística de 10. Una partida de 4 o 6 es un título.
    if (r.digitos.length < 8 || FUERA.test(r.digitos) || vistos.has(r.digitos)) return;
    vistos.add(r.digitos);
    puntuados.push({ r, puntaje: puntaje + (capitulos.has(r.digitos.slice(0, 2)) ? 60 : 0) + empuje(r.digitos) - penalizacion(r, pedido) });
  };
  if (terminos.length) {
    // Primero dentro de las partidas preferidas, para que no se pierdan
    // entre las 200 primeras de todo el arancel.
    for (const p of prefijos) for (const c of buscar(terminos.join(' '), { capitulo: p, limite: 60 }, idx)) sumar(c.registro, c.puntaje);
    for (const c of buscar(terminos.join(' '), { limite: 200 }, idx)) sumar(c.registro, c.puntaje);
  }
  // Una partida preferida sin ninguna palabra en común (p. ej. "chocolate"
  // en la 1806, que dice "cocoa"): igual entran sus líneas.
  for (const p of prefijos) {
    if (puntuados.some((x) => x.r.digitos.startsWith(p))) continue;
    for (const r of idx.registros) if (r.digitos.startsWith(p)) sumar(r, 0);
  }
  puntuados.sort((a, b) => b.puntaje - a.puntaje || a.r.linea - b.r.linea);
  const resultado = puntuados.slice(0, limite).map((x) => item(x.r, idx));
  if (resultado.length || !capitulos.size) return resultado;

  // Se sabe el capítulo pero ninguna palabra coincidió: se ofrecen sus
  // primeras líneas, y el resto se recorre con "Explorar por capítulo".
  return idx.registros
    .filter((r) => r.digitos.length === 8 && capitulos.has(r.digitos.slice(0, 2)))
    .slice(0, limite)
    .map((r) => item(r, idx));
}

// ---- El árbol ---------------------------------------------------------

export interface Nodo {
  linea: number;
  codigo: string | null;
  descripcion: string;
  tarifa: string | null;
  tieneHijos: boolean;
}

const hijosCache = new WeakMap<Indice, Map<number, HtsRegistro[]>>();

function hijosDe(idx: Indice): Map<number, HtsRegistro[]> {
  let mapa = hijosCache.get(idx);
  if (mapa) return mapa;
  mapa = new Map();
  for (const r of idx.registros) {
    if (r.padre === null) continue;
    const lista = mapa.get(r.padre) ?? [];
    lista.push(r);
    mapa.set(r.padre, lista);
  }
  hijosCache.set(idx, mapa);
  return mapa;
}

function nodo(r: HtsRegistro, hijos: Map<number, HtsRegistro[]>): Nodo {
  return {
    linea: r.linea,
    codigo: r.digitos ? r.fila.htsno || formatearCodigo(r.digitos) : null,
    descripcion: textoLimpio(r.fila.description),
    tarifa: r.fila.general.trim() ? limpiar(r.fila.general) : null,
    tieneHijos: (hijos.get(r.linea)?.length ?? 0) > 0,
  };
}

/** Los capítulos, con el nombre en español, para empezar a recorrer. */
export function capitulos(): Array<{ codigo: string; nombre: string }> {
  return CAPITULOS.map((c) => ({ codigo: c.codigo, nombre: c.nombre }));
}

/** Las partidas de cuatro dígitos de un capítulo, o los hijos de una fila. */
export function arbol(opciones: { capitulo?: string; linea?: number }, idx: Indice = cargar()): Nodo[] {
  const hijos = hijosDe(idx);
  if (opciones.capitulo) {
    const cap = normalizarCodigo(opciones.capitulo).padStart(2, '0').slice(0, 2);
    if (FUERA.test(cap)) return [];
    return idx.registros.filter((r) => r.nivel === 0 && r.digitos.startsWith(cap)).map((r) => nodo(r, hijos));
  }
  if (typeof opciones.linea === 'number' && idx.registros[opciones.linea]) {
    const r = idx.registros[opciones.linea];
    if (r.digitos && FUERA.test(r.digitos)) return [];
    return (hijos.get(r.linea) ?? []).map((h) => nodo(h, hijos));
  }
  return [];
}

// ---- El detalle -------------------------------------------------------

export interface Detalle {
  codigo: string;
  digitos: string;
  descripcion: string[];
  capitulo: { codigo: string; nombre: string | null };
  general: { texto: string; segun: string; heredado: boolean; tasa: Tasa } | null;
  especial: string;
  /** Por país de origen con acuerdo: la tarifa que le toca en esta partida. */
  preferencial: Record<string, { texto: string; programa: string; acuerdo: string; tasa: Tasa }>;
  unidades: string[];
  avisos: string[];
  estadistica: boolean;
  fuente: { nombre: string; cargadoEl: string };
}

// Las sobretasas de la Sección 232 dependen del material, no de una
// columna del arancel, y cambian por proclamación. No se calculan: se
// avisan, para que nadie crea que el número de arriba es el total.
// Sección 232 (proclamación vigente en 2026): 50 % sobre el valor total
// de lo que es entera o casi enteramente acero, aluminio o cobre; 25 %
// sobre sus derivados; 10 % si el metal es de EE. UU. Qué línea va en qué
// anexo no está en el arancel cargado, así que se avisa con las tasas y
// no se suma (el cálculo podría quedar corto en estos capítulos). Estos
// productos no pagan además el recargo por trabajo forzoso.
const AVISOS_232: Record<string, string> = {
  '72': 'Hierro y acero: paga además 50 % (Sección 232) sobre el valor total. No está sumado en el cálculo: confírmalo con tu agente de aduanas.',
  '73': 'Artículos de acero: pagan además 50 % si son casi enteramente de acero o 25 % si son derivados (Sección 232). No está sumado en el cálculo: confírmalo con tu agente de aduanas.',
  '76': 'Aluminio: paga además 50 % si es casi enteramente de aluminio o 25 % si es derivado (Sección 232). No está sumado en el cálculo: confírmalo con tu agente de aduanas.',
  '74': 'Cobre: los semielaborados pagan además 50 % y otros artículos 25 % (Sección 232). No está sumado en el cálculo: confírmalo con tu agente de aduanas.',
};

export function detalle(codigo: string, idx: Indice = cargar()): Detalle | null {
  const r = registro(codigo, idx);
  if (!r || FUERA.test(r.digitos)) return null;

  const a = arancelDe(r.digitos, idx);
  const general = a ? { texto: limpiar(a.texto), segun: a.segun, heredado: a.heredado, tasa: parseTasa(a.texto) } : null;
  const especial = a ? limpiar(a.especial) : '';

  const preferencial: Detalle['preferencial'] = {};
  for (const p of PAISES_DE_ORIGEN) {
    const pref = tasaPreferencial(especial, p.iso);
    if (pref) preferencial[p.iso] = { texto: pref.tasa.texto, programa: pref.programa, acuerdo: pref.acuerdo, tasa: pref.tasa };
  }

  const cap = r.digitos.slice(0, 2);
  const avisos: string[] = [];
  if (AVISOS_232[cap]) avisos.push(AVISOS_232[cap]);
  if (general && !general.tasa.calculable) avisos.push(general.tasa.motivo ?? 'Esta tarifa hay que confirmarla con el agente de aduanas.');
  if (r.digitos.length < 10) avisos.push('Este código no es la línea final de 10 dígitos: al declarar en aduana se usa una de sus subpartidas.');

  const meta = idx.meta;
  return {
    codigo: r.fila.htsno || formatearCodigo(r.digitos),
    digitos: r.digitos,
    descripcion: r.rutaDescripcion.map(textoLimpio).filter(Boolean),
    capitulo: { codigo: cap, nombre: capituloDe(cap)?.nombre ?? null },
    general,
    especial,
    preferencial,
    unidades: unidadesDe(r.digitos, idx),
    avisos,
    estadistica: r.digitos.length === 10,
    fuente: { nombre: meta.fuente, cargadoEl: meta.cargadoEl },
  };
}
